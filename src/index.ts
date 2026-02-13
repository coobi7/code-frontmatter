#!/usr/bin/env node
/*---
intent: "MCP Server 入口：注册 cfm_scan、cfm_search、cfm_register_language 三个工具，通过 stdio 与 AI IDE 通信"
role: entry
exports:
  - "main: MCP Server 启动函数"
depends_on:
  - "@modelcontextprotocol/sdk"
  - "./registry.ts"
  - "./tools/scan.ts"
  - "./tools/search.ts"
  - "./tools/register.ts"
when_to_load: "修改 MCP 工具注册、Server 配置或启动流程时加载"
ai_notes: "使用 stdio transport，兼容所有 MCP 客户端（Cursor、Claude Desktop 等）"
---*/

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadRegistry } from "./registry.js";
import { scanDirectory } from "./tools/scan.js";
import { searchFrontmatter } from "./tools/search.js";
import { registerNewLanguage } from "./tools/register.js";

/**
 * 创建并配置 MCP Server
 */
async function main(): Promise<void> {
    // 初始化语言注册表
    await loadRegistry();

    // 创建 MCP Server 实例
    const server = new McpServer({
        name: "code-frontmatter",
        version: "0.1.0",
    });

    // ─── 工具 1: cfm_scan ───────────────────────────────────
    server.tool(
        "cfm_scan",
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

    // ─── 工具 2: cfm_search ─────────────────────────────────
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

    // ─── 工具 3: cfm_register_language ──────────────────────
    server.tool(
        "cfm_register_language",
        "注册新的编程语言注释规则。当遇到 CFM 尚不支持的语言时，通过此工具添加该语言的注释语法，使 cfm_scan 能正确提取其表头。注册仅在当前会话有效。",
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
