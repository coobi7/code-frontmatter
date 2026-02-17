/*---
intent: "实现 cfm_write 工具：将标准 CFM 表头写入指定代码文件，确保字段名和注释格式严格合规"
role: service
exports:
  - "CfmWriteInput: 写入表头所需的输入数据接口"
  - "writeFrontmatter: 将 CFM 表头写入指定文件"
depends_on: ["../registry.ts", "../schema.ts"]
when_to_load: "修改表头写入逻辑、格式生成或替换策略时加载"
ai_notes: "此工具是 CFM 规范的唯一写入入口，从根源杜绝字段名不统一的问题"
---*/

import { readFile, writeFile } from "node:fs/promises";
import { extname } from "node:path";
import { stringify as stringifyYaml } from "yaml";
import { getLanguageByExtension } from "../registry.js";

/**
 * CFM 表头数据（写入时的输入）
 */
export interface CfmWriteInput {
    intent: string;
    role: string;
    exports: string[];
    depends_on?: string[];
    when_to_load?: string;
    mutates_state?: boolean;
    side_effects?: string[];
    domain?: string;
    ai_notes?: string;
}

/**
 * 将 CFM 表头写入指定文件
 *
 * 流程：
 * 1. 根据扩展名查找语言注释规则
 * 2. 构建标准 YAML 内容
 * 3. 用正确的注释语法包裹
 * 4. 替换旧表头或插入到文件顶部
 *
 * @param filePath - 文件绝对路径
 * @param data - CFM 表头数据
 * @returns 操作结果
 */
export async function writeFrontmatter(
    filePath: string,
    data: CfmWriteInput
): Promise<{ success: boolean; message: string }> {
    const ext = extname(filePath);
    const lang = getLanguageByExtension(ext);

    if (!lang) {
        return {
            success: false,
            message: `不支持的文件类型 "${ext}"，请先用 cfm_register_language 注册该语言。`,
        };
    }

    const { comment_start, comment_end, line_prefix } = lang.rule;

    // ── 构建 YAML 内容 ──
    // 按照标准字段顺序构建对象，只包含有值的字段
    const orderedData: Record<string, unknown> = {};
    orderedData.intent = data.intent;
    orderedData.role = data.role;
    orderedData.exports = data.exports;
    if (data.depends_on && data.depends_on.length > 0) orderedData.depends_on = data.depends_on;
    if (data.when_to_load) orderedData.when_to_load = data.when_to_load;
    if (data.mutates_state !== undefined) orderedData.mutates_state = data.mutates_state;
    if (data.side_effects && data.side_effects.length > 0) orderedData.side_effects = data.side_effects;
    if (data.domain) orderedData.domain = data.domain;
    if (data.ai_notes) orderedData.ai_notes = data.ai_notes;

    const yamlStr = stringifyYaml(orderedData, { lineWidth: 0 }).trim();

    // ── 生成注释块 ──
    let header: string;
    if (line_prefix) {
        // 脚本语言（Python, Ruby 等）：每行加前缀
        const yamlLines = yamlStr.split("\n");
        const prefixedLines = yamlLines.map((line) => line ? `${line_prefix}${line}` : line_prefix.trim());
        header = `${comment_start}\n${prefixedLines.join("\n")}\n${comment_end}`;
    } else {
        // C 家族语言（JS, TS, Java 等）：块注释
        header = `${comment_start}\n${yamlStr}\n${comment_end}`;
    }

    // ── 读取原文件 ──
    let content: string;
    try {
        content = await readFile(filePath, "utf-8");
    } catch {
        return {
            success: false,
            message: `无法读取文件: ${filePath}`,
        };
    }

    // 统一换行符
    const normalized = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

    // ── 检测是否已有表头，如果有则替换 ──
    const newContent = replaceOrInsertHeader(normalized, comment_start, comment_end, header);

    // ── 写入文件 ──
    try {
        await writeFile(filePath, newContent, "utf-8");
    } catch {
        return {
            success: false,
            message: `无法写入文件: ${filePath}`,
        };
    }

    return {
        success: true,
        message: `CFM 表头已写入 ${filePath}`,
    };
}

/**
 * 替换已有表头或在文件顶部插入新表头
 */
function replaceOrInsertHeader(
    content: string,
    commentStart: string,
    commentEnd: string,
    newHeader: string
): string {
    const trimmed = content.trimStart();
    const leadingWhitespace = content.slice(0, content.length - trimmed.length);

    // 检查是否以 shebang (#!) 开头
    let shebangLine = "";
    let restContent = trimmed;

    if (trimmed.startsWith("#!")) {
        const newlineIdx = trimmed.indexOf("\n");
        if (newlineIdx !== -1) {
            shebangLine = trimmed.slice(0, newlineIdx + 1);
            restContent = trimmed.slice(newlineIdx + 1);
        }
    }

    const restTrimmed = restContent.trimStart();

    // 检查是否已有 CFM 表头
    if (restTrimmed.startsWith(commentStart)) {
        const afterStart = restTrimmed.slice(commentStart.length);
        const endIdx = afterStart.indexOf(commentEnd);

        if (endIdx !== -1) {
            // 找到旧表头，替换
            const afterOldHeader = afterStart.slice(endIdx + commentEnd.length);
            // 保留旧表头后的空行
            const cleaned = afterOldHeader.replace(/^\n{0,2}/, "\n");
            return shebangLine + newHeader + cleaned;
        }
    }

    // 没有旧表头，插入到文件顶部
    return shebangLine + newHeader + "\n\n" + restContent;
}
