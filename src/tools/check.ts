/*---
intent: "实现 cfm_check 工具：验证项目中的 CFM 表头是否与代码实际 export 一致，防止文档腐烂"
role: service
exports:
  - "CheckResult: 检查结果接口定义"
  - "checkDrift: 检查指定文件或目录的 CFM 表头与代码实现的差异"
depends_on: ["../analyzer/validator.js", "./read.js"]
when_to_load: "用户请求检查文档漂移或 CI/CD 流程中运行时加载"
ai_notes: "此工具是防止 Documentation Rot 的核心防线"
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
    details: ValidationResult[];
}

/**
 * 检查文件或目录的 CFM 漂移情况
 * @param path 绝对路径
 */
export async function checkDrift(path: string): Promise<CheckResult> {
    // Ensure registry is loaded
    await loadRegistry();

    const stats = await stat(path);
    const results: ValidationResult[] = [];

    if (stats.isFile()) {
        const result = await validateFrontmatter(path);
        // Only report if it has issues OR has frontmatter (if it has no frontmatter, it's not "drift" per se, it's missing)
        // But for "rot", we care if CFM exists but is wrong.
        if (result.hasFrontmatter) {
            results.push(result);
        }
    } else if (stats.isDirectory()) {
        // Use scanDirectory to get all files
        // But scanDirectory returns CFM entries. We need files to check code exports.
        // Actually scanDirectory filters by registered languages.
        // We can use it to get list of files, then check each.
        const scan = await scanDirectory(path);

        for (const entry of scan.entries) {
            // We only check files that HAVE frontmatter
            if (entry.frontmatter) {
                // Reconstruct full path? scanDirectory entries have `file` as relative path usually?
                // Wait, scanDirectory entry.file is relative path. We need absolute path.
                // scanDirectory implementation:
                // line 116: const relativePath = relative(rootDir, fullPath).replace(/\\/g, "/");
                // So we need to join(path, entry.file)
                const absolutePath = join(path, entry.file);
                const result = await validateFrontmatter(absolutePath);
                results.push(result);
            }
        }
    }

    const failed = results.filter(r => !r.isValid);

    return {
        total: results.length,
        passed: results.length - failed.length,
        failed: failed.length,
        details: failed
    };
}
