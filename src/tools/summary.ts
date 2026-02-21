/*---
intent: "生成项目 CFM 覆盖概况的轻量文本摘要，供 MCP Resource 暴露给 AI 客户端"
role: service
exports:
  - "generateProjectSummary: 扫描项目并返回极轻量的文本摘要（不超过 20 行）"
depends_on:
  - "./read.ts"
when_to_load: "修改项目摘要生成逻辑或格式时加载"
ai_notes: "此模块是纯逻辑函数，不依赖 MCP SDK，便于独立测试。"
---*/

import { scanDirectory } from "./read.js";
import type { CfmEntry } from "../schema.js";

/**
 * 生成项目的 CFM 覆盖概况文本摘要
 *
 * 扫描指定目录，从所有有表头的文件中提取统计信息，
 * 返回极轻量的文本（不超过 20 行），供 MCP Resource 暴露给 AI 客户端。
 *
 * @param directory - 项目根目录的绝对路径
 * @returns 格式化的文本摘要
 */
export async function generateProjectSummary(directory: string): Promise<string> {
    const result = await scanDirectory(directory);

    // 收集所有 domain 标签（去重）
    const domains = new Set<string>();
    // 收集所有 role 标签（计数）
    const roleCounts = new Map<string, number>();

    for (const entry of result.entries) {
        const fm = entry.frontmatter;
        if (!fm) continue;

        if (fm.domain) {
            domains.add(fm.domain as string);
        }

        if (fm.role) {
            const role = fm.role as string;
            roleCounts.set(role, (roleCounts.get(role) ?? 0) + 1);
        }
    }

    // 计算覆盖率
    const coverage = result.total_files > 0
        ? ((result.files_with_cfm / result.total_files) * 100).toFixed(1)
        : "0.0";

    // 构建 role 摘要字符串：role(count), role(count), ...
    const rolesSummary = Array.from(roleCounts.entries())
        .sort((a, b) => b[1] - a[1]) // 按数量降序
        .map(([role, count]) => `${role}(${count})`)
        .join(", ");

    // 构建 domain 摘要字符串
    const domainsSummary = Array.from(domains).sort().join(", ");

    // 拼装最终摘要
    const lines: string[] = [
        `项目 CFM 概况:`,
        `- 总文件数: ${result.total_files}`,
        `- 有表头文件: ${result.files_with_cfm} (${coverage}%)`,
        `- 无表头文件: ${result.files_without_cfm}`,
    ];

    if (domainsSummary) {
        lines.push(`- 涵盖领域: ${domainsSummary}`);
    }

    if (rolesSummary) {
        lines.push(`- 涵盖角色: ${rolesSummary}`);
    }

    lines.push(``);
    lines.push(`提示: 使用 cfm_search 按 domain 或 role 精准定位文件，避免逐个探索。`);

    return lines.join("\n");
}
