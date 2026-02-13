/*---
intent: "实现 cfm_search 工具：在已扫描的 CFM 索引中按关键字、角色、领域等条件搜索匹配文件"
role: service
exports:
  - "searchFrontmatter: 搜索匹配条件的 CFM 条目"
depends_on: ["./scan.ts", "../schema.ts"]
when_to_load: "修改搜索逻辑或过滤条件时加载"
---*/

import { scanDirectory } from "./scan.js";
import type { CfmEntry, SearchResult } from "../schema.js";

/**
 * 在项目目录中搜索匹配条件的 CFM 表头
 *
 * 支持三种搜索维度：
 * - keyword: 在 intent、exports、ai_notes 等文本字段中全文搜索
 * - role: 精确匹配文件角色（如 "service", "component"）
 * - domain: 精确匹配业务领域标签
 *
 * @param directory - 扫描的根目录
 * @param query - 搜索条件
 * @returns 搜索结果
 */
export async function searchFrontmatter(
    directory: string,
    query: {
        /** 关键字搜索（在 intent、exports、ai_notes 等字段中匹配） */
        keyword?: string;
        /** 按角色过滤 */
        role?: string;
        /** 按业务领域过滤 */
        domain?: string;
    }
): Promise<SearchResult> {
    // 先获取全量扫描结果
    const scanResult = await scanDirectory(directory, { cfmOnly: true });

    // 拼接查询描述
    const queryParts: string[] = [];
    if (query.keyword) queryParts.push(`keyword="${query.keyword}"`);
    if (query.role) queryParts.push(`role="${query.role}"`);
    if (query.domain) queryParts.push(`domain="${query.domain}"`);
    const queryDescription = queryParts.join(", ");

    // 过滤匹配的条目
    const matched = scanResult.entries.filter((entry) =>
        matchesQuery(entry, query)
    );

    return {
        query: queryDescription,
        matches: matched.length,
        entries: matched,
    };
}

/**
 * 判断某个 CFM 条目是否匹配查询条件
 * 所有提供的条件都必须满足（AND 逻辑）
 */
function matchesQuery(
    entry: CfmEntry,
    query: { keyword?: string; role?: string; domain?: string }
): boolean {
    const fm = entry.frontmatter;
    if (!fm) return false;

    // 角色精确匹配
    if (query.role) {
        if (String(fm.role ?? "").toLowerCase() !== query.role.toLowerCase()) {
            return false;
        }
    }

    // 领域精确匹配
    if (query.domain) {
        if (String(fm.domain ?? "").toLowerCase() !== query.domain.toLowerCase()) {
            return false;
        }
    }

    // 关键字全文搜索
    if (query.keyword) {
        const kw = query.keyword.toLowerCase();
        const searchFields = [
            String(fm.intent ?? ""),
            String(fm.ai_notes ?? ""),
            String(fm.when_to_load ?? ""),
            String(fm.domain ?? ""),
            // 展开数组字段
            ...(Array.isArray(fm.exports) ? fm.exports.map(String) : []),
            ...(Array.isArray(fm.depends_on) ? fm.depends_on.map(String) : []),
            ...(Array.isArray(fm.side_effects) ? fm.side_effects.map(String) : []),
            // 文件路径也纳入搜索
            entry.file,
        ];

        const haystack = searchFields.join(" ").toLowerCase();
        if (!haystack.includes(kw)) {
            return false;
        }
    }

    return true;
}
