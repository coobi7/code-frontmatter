/*---
intent: "从代码文件中提取 CFM 表头：根据语言规则定位注释标记，去除行前缀，解析 YAML 并校验"
role: service
exports:
  - "extractFrontmatter: 从单个文件中提取并解析 CFM 表头"
depends_on: ["./registry.ts", "./schema.ts", "yaml"]
when_to_load: "修改表头提取逻辑或 YAML 解析方式时加载"
ai_notes: "使用简单文本匹配而非 AST 解析，保持零重型依赖的设计原则"
---*/

import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { parse as parseYaml } from "yaml";
import { getLanguageByExtension } from "./registry.js";
import { CfmSchemaLoose, type CfmEntry } from "./schema.js";

/** 读取文件的最大字节数（只读开头部分以查找表头） */
const MAX_READ_BYTES = 4096;

/**
 * 从单个文件中提取 CFM 表头
 *
 * 提取流程：
 * 1. 根据文件扩展名查找语言注释规则
 * 2. 在文件开头区域匹配 comment_start / comment_end 标记对
 * 3. 提取标记之间的文本，去除 line_prefix（如 "# "）
 * 4. 用 YAML 解析器解析，再用 Zod Schema 校验
 *
 * @param filePath - 文件的绝对路径
 * @param relativePath - 用于输出的相对路径
 * @returns CFM 条目（含解析数据或 null + 警告信息）
 */
export async function extractFrontmatter(
    filePath: string,
    relativePath: string
): Promise<CfmEntry> {
    const ext = extname(filePath);
    const lang = getLanguageByExtension(ext);

    // 未知语言类型，跳过
    if (!lang) {
        return {
            file: relativePath,
            language: undefined,
            frontmatter: null,
            warnings: ["未注册的文件类型，跳过表头提取"],
        };
    }

    const warnings: string[] = [];

    try {
        // 只读取文件开头部分，节省 I/O
        const content = await readFileHead(filePath, MAX_READ_BYTES);
        const { comment_start, comment_end, line_prefix } = lang.rule;

        // 查找表头区域
        const headerContent = extractHeaderContent(
            content,
            comment_start,
            comment_end,
            line_prefix
        );

        if (!headerContent) {
            return {
                file: relativePath,
                language: lang.name,
                frontmatter: null,
            };
        }

        // 解析 YAML
        let parsed: Record<string, unknown>;
        try {
            parsed = parseYaml(headerContent) as Record<string, unknown>;
        } catch (yamlError) {
            return {
                file: relativePath,
                language: lang.name,
                frontmatter: null,
                warnings: [`YAML 解析失败: ${(yamlError as Error).message}`],
            };
        }

        // 如果 YAML 解析结果不是对象（可能是纯文本）
        if (!parsed || typeof parsed !== "object") {
            return {
                file: relativePath,
                language: lang.name,
                frontmatter: null,
                warnings: ["表头内容不是有效的 YAML 对象"],
            };
        }

        // 宽松模式校验
        const validation = CfmSchemaLoose.safeParse(parsed);
        if (!validation.success) {
            warnings.push(
                `Schema 校验警告: ${validation.error.issues.map((i) => i.message).join("; ")}`
            );
        }

        // 检查必选字段缺失
        if (!parsed.intent) warnings.push("缺少必选字段: intent");
        if (!parsed.role) warnings.push("缺少推荐字段: role");
        if (!parsed.exports) warnings.push("缺少推荐字段: exports");

        return {
            file: relativePath,
            language: lang.name,
            frontmatter: parsed,
            warnings: warnings.length > 0 ? warnings : undefined,
        };
    } catch (error) {
        return {
            file: relativePath,
            language: lang.name,
            frontmatter: null,
            warnings: [`文件读取失败: ${(error as Error).message}`],
        };
    }
}

/**
 * 从文件内容中提取表头区域的 YAML 文本
 * @returns 清理后的 YAML 字符串，或 null（未找到表头）
 */
function extractHeaderContent(
    content: string,
    commentStart: string,
    commentEnd: string,
    linePrefix: string | null
): string | null {
    // 统一换行符为 \n，兼容 Windows (\r\n) 和 Mac (\r)
    let normalized = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

    // 去除 Shebang 行（如 #!/usr/bin/env node）
    if (normalized.startsWith("#!")) {
        const firstNewLine = normalized.indexOf("\n");
        if (firstNewLine !== -1) {
            normalized = normalized.slice(firstNewLine + 1);
        } else {
            // 文件只有 Shebang
            normalized = "";
        }
    }

    const trimmedContent = normalized.trimStart();

    // 查找起始标记
    if (!trimmedContent.startsWith(commentStart)) {
        return null;
    }

    // 查找结束标记（从起始标记之后开始搜索）
    const afterStart = trimmedContent.slice(commentStart.length);
    const endIndex = afterStart.indexOf(commentEnd);

    if (endIndex === -1) {
        return null;
    }

    // 提取标记之间的原始文本
    let rawContent = afterStart.slice(0, endIndex);

    // 去除每行的 line_prefix（如 Python 的 "# "）
    if (linePrefix) {
        const lines = rawContent.split("\n");
        rawContent = lines
            .map((line) => {
                const trimmedLine = line.trimStart();
                // 尝试完整前缀匹配（如 "# "），然后尝试去尾空格后的匹配（如 "#"）
                if (trimmedLine.startsWith(linePrefix)) {
                    return trimmedLine.slice(linePrefix.length);
                }
                const trimmedPrefix = linePrefix.trim();
                if (trimmedPrefix && trimmedLine.startsWith(trimmedPrefix)) {
                    return trimmedLine.slice(trimmedPrefix.length);
                }
                return line;
            })
            .join("\n");
    }

    const cleaned = rawContent.trim();
    return cleaned.length > 0 ? cleaned : null;
}

/**
 * 只读取文件的前 N 个字节
 * 大文件只需读开头就能找到表头，避免全文读取
 */
async function readFileHead(
    filePath: string,
    maxBytes: number
): Promise<string> {
    const { open } = await import("node:fs/promises");
    const fileHandle = await open(filePath, "r");
    try {
        const buffer = Buffer.alloc(maxBytes);
        const { bytesRead } = await fileHandle.read(buffer, 0, maxBytes, 0);
        return buffer.slice(0, bytesRead).toString("utf-8");
    } finally {
        await fileHandle.close();
    }
}
