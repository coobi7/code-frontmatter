#!/usr/bin/env node
/*---
intent: "MCP Server 入口：注册 cfm_read、cfm_write、cfm_search、cfm_register_language 四个工具，通过 stdio 与 AI IDE 通信"
role: entry
exports:
  - "main: MCP Server 启动函数"
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
import { scanDirectory } from "./tools/read.js";
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
        "扫描项目目录中所有代码文件的 CFM 表头，返回结构化索引。这是 AI 建立项目全局认知的第一步：用极低 Token 消耗获取整个项目的文件身份信息。",
        {
            directory: z
                .string()
                .describe("要扫描的项目根目录的绝对路径"),
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
        async ({ directory, cfm_only, ignore_dirs }) => {
            try {
                const result = await scanDirectory(directory, {
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
            } catch (error) {
                return {
                    content: [
                        {
                            type: "text" as const,
                            text: `扫描失败: ${(error as Error).message}`,
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
        "将标准 CFM 表头写入指定代码文件。AI 在完成编码任务后调用此工具补充/更新表头，确保字段名和注释格式严格合规。工具会自动根据文件类型选择正确的注释语法。",
        {
            file: z
                .string()
                .describe("目标文件的绝对路径"),
            intent: z
                .string()
                .max(200)
                .describe("文件的核心用途，简洁明了（必填）"),
            role: z
                .string()
                .describe("文件角色（如 service, component, util, config, page, model, entry, example）"),
            exports: z
                .array(z.string())
                .describe("导出的关键 API / 函数 / 组件（格式: \"名称: 简述\"）"),
            depends_on: z
                .array(z.string())
                .optional()
                .describe("关键依赖的文件路径列表"),
            when_to_load: z
                .string()
                .optional()
                .describe("什么场景下 AI 才需要读取此文件全文"),
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
                .describe("给 AI 的特殊注意事项"),
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
        "在项目中搜索匹配条件的 CFM 表头。支持按关键字（在 intent, exports 等字段中全文搜索）、按角色（role）和按业务领域（domain）过滤，用于精准定位目标文件。",
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
