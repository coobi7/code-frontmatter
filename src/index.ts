#!/usr/bin/env node
/*---
intent: "MCP Server 入口：注册 cfm_read、cfm_write、cfm_search、cfm_register_language 四个工具，通过 stdio 与 AI IDE 通信"
role: entry
exports: []
depends_on:
  - "@modelcontextprotocol/sdk"
  - "./registry.ts"
  - "./tools/read.ts"
  - "./tools/search.ts"
  - "./tools/register.ts"
  - "./tools/write.ts"
when_to_load: "修改 MCP 工具注册、Server 配置或启动流程时加载"
ai_notes: "使用 stdio transport，兼容所有 MCP 客户端（Cursor、Claude Desktop 等）"
---*/

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadRegistry } from "./registry.js";
import { scanDirectory, readSingleFile, findProjectRoot } from "./tools/read.js";
import { searchFrontmatter } from "./tools/search.js";
import { registerNewLanguage } from "./tools/register.js";
import { writeFrontmatter } from "./tools/write.js";

/**
 * 创建并配置 MCP Server
 */
async function main(): Promise<void> {
    // 初始化语言注册表
    await loadRegistry();

    // 创建 MCP Server 实例
    const server = new McpServer({
        name: "code-frontmatter",
        version: "0.2.0",
    });

    // ─── 工具 1: cfm_read ───────────────────────────────────
    server.tool(
        "cfm_read",
        "读取代码文件的 CFM 表头（文件的'身份证'）。\n\n关键工作流：在对代码文件执行全文阅读前，应先调用此工具检查表头。表头通常只有 5-10 行，包含 intent（用途）和 exports（导出接口），可以替代阅读 100-500 行全文来判断文件是否与当前任务相关。\n\n支持两种模式：\n- 传入单个文件路径：仅返回该文件的表头（轻量）\n- 传入目录路径：批量扫描该目录下所有文件的表头（较重，仅在需要项目全貌时使用）\n\n典型用法：先用 cfm_search 定位候选文件，再用 cfm_read 检查单个文件表头，根据 intent 和 exports 判断是否需要深入阅读全文。",
        {
            path: z
                .string()
                .describe("目标文件或目录的绝对路径。传入文件时读取单个表头，传入目录时批量扫描"),
            cfm_only: z
                .boolean()
                .optional()
                .default(false)
                .describe("是否只返回有 CFM 表头的文件（默认 false，返回全部）"),
            ignore_dirs: z
                .array(z.string())
                .optional()
                .describe("额外忽略的目录名列表（默认已忽略 node_modules, .git, dist 等）"),
        },
        async ({ path: targetPath, cfm_only, ignore_dirs }) => {
            try {
                // 检测是文件还是目录
                const { stat: fsStat } = await import("node:fs/promises");
                const pathStat = await fsStat(targetPath);

                if (pathStat.isFile()) {
                    // 单文件模式：读取单个文件的表头（含 depended_by 反向依赖）
                    const projectRoot = await findProjectRoot(targetPath);
                    const entry = await readSingleFile(targetPath, projectRoot ?? undefined);
                    return {
                        content: [
                            {
                                type: "text" as const,
                                text: JSON.stringify(entry, null, 2),
                            },
                        ],
                    };
                } else {
                    // 目录模式：批量扫描
                    const result = await scanDirectory(targetPath, {
                        cfmOnly: cfm_only,
                        ignoreDirs: ignore_dirs,
                    });
                    return {
                        content: [
                            {
                                type: "text" as const,
                                text: JSON.stringify(result, null, 2),
                            },
                        ],
                    };
                }
            } catch (error) {
                return {
                    content: [
                        {
                            type: "text" as const,
                            text: `读取失败: ${(error as Error).message}`,
                        },
                    ],
                    isError: true,
                };
            }
        }
    );

    // ─── 工具 2: cfm_write ──────────────────────────────────
    server.tool(
        "cfm_write",
        "将标准 CFM 表头写入指定代码文件。\n\n维护义务：当你修改了某个代码文件的核心逻辑、导出接口或依赖关系后，应调用此工具更新该文件的表头，保持表头与代码的一致性。\n\nCRITICAL: 更新表头时的规则：\n1. 读取旧表头\n2. 保留'永久性技术约束/经验教训'（如 ai_notes 中的警告）\n3. 丢弃'变更日志/历史/流程信息'\n4. 将剩余内容极致精简\n\n禁止盲目覆盖！",
        {
            file: z
                .string()
                .describe("目标文件的绝对路径"),
            intent: z
                .string()
                .max(300)
                .describe("文件的核心用途。必须精简高效（<50字），拒绝废话。"),
            role: z
                .string()
                .describe("文件角色（如 service, component, util, config, page, model, entry, example）"),
            exports: z
                .array(z.string())
                .describe("导出的关键 API/组件列表。格式：'Name: Brief desc'。只列出最重要的，拒绝冗长签名。"),
            depends_on: z
                .array(z.string())
                .optional()
                .describe("关键依赖的文件路径列表"),
            when_to_load: z
                .string()
                .optional()
                .describe("什么场景下才需要读取此文件全文。只描述关键触发条件，保持简短。"),
            mutates_state: z
                .boolean()
                .optional()
                .describe("是否修改外部状态（数据库、全局变量等）"),
            side_effects: z
                .array(z.string())
                .optional()
                .describe("副作用描述列表"),
            domain: z
                .string()
                .optional()
                .describe("业务领域标签（如 payment, auth, map）"),
            ai_notes: z
                .string()
                .optional()
                .describe("给 AI 的关键技术约束或警示。必须是永久性知识（如'使用捕获阶段监听'）。严禁记录变更日志/历史/作者/日期！只保留对理解代码至关重要的信息，越短越好。"),
        },
        async ({ file, intent, role, exports, depends_on, when_to_load, mutates_state, side_effects, domain, ai_notes }) => {
            try {
                const result = await writeFrontmatter(file, {
                    intent,
                    role,
                    exports,
                    depends_on,
                    when_to_load,
                    mutates_state,
                    side_effects,
                    domain,
                    ai_notes,
                });

                return {
                    content: [
                        {
                            type: "text" as const,
                            text: JSON.stringify(result, null, 2),
                        },
                    ],
                    isError: !result.success,
                };
            } catch (error) {
                return {
                    content: [
                        {
                            type: "text" as const,
                            text: `写入失败: ${(error as Error).message}`,
                        },
                    ],
                    isError: true,
                };
            }
        }
    );

    // ─── 工具 3: cfm_search ─────────────────────────────────
    server.tool(
        "cfm_search",
        "在项目中搜索匹配条件的 CFM 表头。\n\n这是精准定位目标文件的首选入口：先搜索再决定是否深入阅读，比逐个文件调用 grep 或 view_file 节省 5-10 倍 token。\n\n支持三种过滤维度：\n- keyword：在 intent、exports、ai_notes 等字段中全文搜索\n- role：按文件角色过滤（service, component, util, config, page, model, entry）\n- domain：按业务领域过滤（如 payment, auth, billing）\n\n返回匹配文件的完整表头摘要，无需读取文件全文即可做出决策。",
        {
            directory: z
                .string()
                .describe("要搜索的项目根目录的绝对路径"),
            keyword: z
                .string()
                .optional()
                .describe("关键字搜索，匹配 intent、exports、ai_notes 等字段"),
            role: z
                .string()
                .optional()
                .describe("按文件角色过滤（如 service, component, util, config, page）"),
            domain: z
                .string()
                .optional()
                .describe("按业务领域过滤（如 payment, auth, map-layer）"),
        },
        async ({ directory, keyword, role, domain }) => {
            // 至少需要一个搜索条件
            if (!keyword && !role && !domain) {
                return {
                    content: [
                        {
                            type: "text" as const,
                            text: "请至少提供一个搜索条件（keyword、role 或 domain）",
                        },
                    ],
                    isError: true,
                };
            }

            try {
                const result = await searchFrontmatter(directory, {
                    keyword,
                    role,
                    domain,
                });

                return {
                    content: [
                        {
                            type: "text" as const,
                            text: JSON.stringify(result, null, 2),
                        },
                    ],
                };
            } catch (error) {
                return {
                    content: [
                        {
                            type: "text" as const,
                            text: `搜索失败: ${(error as Error).message}`,
                        },
                    ],
                    isError: true,
                };
            }
        }
    );

    // ─── 工具 4: cfm_register_language ──────────────────────
    server.tool(
        "cfm_register_language",
        "注册新的编程语言注释规则。当遇到 CFM 尚不支持的语言时，通过此工具添加该语言的注释语法，使 cfm_read 能正确提取其表头。注册仅在当前会话有效。",
        {
            name: z
                .string()
                .describe("语言名称（如 elixir, dart, haskell）"),
            comment_start: z
                .string()
                .describe("CFM 表头的起始标记（如 \"#---\"）"),
            comment_end: z
                .string()
                .describe("CFM 表头的结束标记（如 \"#---\"）"),
            extensions: z
                .array(z.string())
                .describe("该语言的文件扩展名列表（如 [\".ex\", \".exs\"]）"),
            line_prefix: z
                .string()
                .nullable()
                .optional()
                .default(null)
                .describe("行前缀（脚本语言使用，如 \"# \"），C 家族传 null"),
        },
        async ({ name, comment_start, comment_end, extensions, line_prefix }) => {
            const result = registerNewLanguage(name, {
                comment_start,
                comment_end,
                extensions,
                line_prefix,
            });

            return {
                content: [
                    {
                        type: "text" as const,
                        text: JSON.stringify(result, null, 2),
                    },
                ],
                isError: !result.success,
            };
        }
    );

    // ─── 启动 Server ────────────────────────────────────────
    const transport = new StdioServerTransport();
    await server.connect(transport);
}

// 启动
main().catch((error) => {
    console.error("MCP Server 启动失败:", error);
    process.exit(1);
});
