/*---
intent: cfm_check 核心：汇总 exports 漂移 + 文档溢出检测结果
role: service
exports:
  - "CheckResult: 检查结果接口（含 failed/warned 统计）"
  - "checkDrift: 检查文件/目录的 CFM 漂移和溢出"
depends_on: ["../analyzer/validator.js", "./read.js"]
when_to_load: 修改检查汇总逻辑时加载
ai_notes: "warned 统计溢出文件数，不影响 isValid；failed 统计漂移文件数。"
---*/

import { stat } from "node:fs/promises";
import { join } from "node:path";
import { scanDirectory } from "./read.js";
import { validateFrontmatter, type ValidationResult } from "../analyzer/validator.js";
import { loadRegistry } from "../registry.js";

export interface CheckResult {
    total: number;
    passed: number;
    failed: number;
    warned: number;
    details: ValidationResult[];
    warnings: ValidationResult[];
}

/**
 * 检查文件或目录的 CFM 漂移 + 溢出情况
 */
export async function checkDrift(path: string): Promise<CheckResult> {
    // Ensure registry is loaded
    await loadRegistry();

    const stats = await stat(path);
    const results: ValidationResult[] = [];

    if (stats.isFile()) {
        const result = await validateFrontmatter(path);
        if (result.hasFrontmatter) {
            results.push(result);
        }
    } else if (stats.isDirectory()) {
        const scan = await scanDirectory(path);

        for (const entry of scan.entries) {
            if (entry.frontmatter) {
                const absolutePath = join(path, entry.file);
                const result = await validateFrontmatter(absolutePath);
                results.push(result);
            }
        }
    }

    const failed = results.filter(r => !r.isValid);
    const warned = results.filter(r => r.isValid && r.warnings.length > 0);

    return {
        total: results.length,
        passed: results.length - failed.length - warned.length,
        failed: failed.length,
        warned: warned.length,
        details: failed,
        warnings: warned,
    };
}
