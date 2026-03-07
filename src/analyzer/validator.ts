/*---
intent: 验证 CFM 表头 exports 与代码实际导出是否一致，检测文档腐烂（Documentation Rot）
role: service
exports:
  - "ValidationResult: 验证结果接口（含 missing/stale/errors）"
  - "validateFrontmatter: 对比 CFM exports 与实际代码导出，返回差异"
depends_on:
  - ./extractor.js
  - ../parser.js
when_to_load: 修改验证逻辑或扩展非 JS/TS 语言验证支持时加载
mutates_state: false
domain: analyzer
ai_notes: "目前仅支持 JS/TS 系文件的自动验证，其他语言仅检查 CFM 存在性。CFM exports 格式为 'Name: Desc'，提取冒号前的名称作为比较键。"
---*/

import fs from "fs";
import { extractExports } from "./extractor.js";
import { extractFrontmatter } from "../parser.js";

export interface ValidationResult {
    file: string;
    hasFrontmatter: boolean;
    isValid: boolean;
    missing: string[]; // In code but not in frontmatter
    stale: string[];   // In frontmatter but not in code
    errors: string[];
}

/**
 * Validates that the CFM header 'exports' match the actual code exports.
 * @param filePath Absolute path to the file.
 */
export async function validateFrontmatter(filePath: string): Promise<ValidationResult> {
    const result: ValidationResult = {
        file: filePath,
        hasFrontmatter: false,
        isValid: true,
        missing: [],
        stale: [],
        errors: [],
    };

    try {
        // const fileContent = fs.readFileSync(filePath, "utf-8"); // extractFrontmatter reads the file itself
        const cfm = await extractFrontmatter(filePath, filePath);

        if (!cfm) {
            // If no frontmatter, define policy: strictly it's "missing CFM", but for drift check
            // we only care if there IS frontmatter that is wrong.
            // However, the goal is to prevent rot. If no CFM, maybe we skip or report "no CFM".
            // Let's mark hasFrontmatter=false and return.
            return result;
        }

        result.hasFrontmatter = true;

        // 1. Get exports from CFM
        // The schema says `exports` is string[] (e.g. "Name: Description")
        // We need to parse out the names.
        const frontmatter = cfm.frontmatter as Record<string, unknown>;
        const exportsList = (frontmatter?.exports as string[]) || [];

        const cfmExports = exportsList.map((e: string) => {
            // Format is typically "Name: Description" or just "Name"
            const name = e.split(":")[0].trim();
            return name;
        });

        // 2. Get exports from Code
        // Supports JS/TS, Python, Go, Rust
        const codeExports = await extractExports(filePath);

        if (codeExports !== null) {

            // 3. Compare

            const cfmSet = new Set(cfmExports);
            const codeSet = new Set(codeExports);

            // Find Missing (In Code but NOT in CFM)
            codeExports.forEach(e => {
                if (!cfmSet.has(e)) {
                    result.missing.push(e);
                }
            });

            // Find Stale (In CFM but NOT in Code)
            cfmExports.forEach(e => {
                if (!codeSet.has(e)) {
                    result.stale.push(e);
                }
            });

            if (result.missing.length > 0 || result.stale.length > 0) {
                result.isValid = false;
            }

        } else {
            // For other languages, we cannot auto-validate exports yet.
            // Maybe we just check if CFM exists.
        }


    } catch (error: any) {
        result.isValid = false;
        result.errors.push(error.message);
    }

    return result;
}
