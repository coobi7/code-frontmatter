/*---
intent: 验证 CFM 表头：检测 exports 漂移（Documentation Rot）+ 文档溢出（Documentation Overflow）
role: service
exports:
  - "ValidationResult: 验证结果(missing/stale/warnings)"
  - "validateFrontmatter: 对比 CFM exports 与代码导出 + 检测表头溢出"
  - "OVERFLOW_THRESHOLDS: 各字段溢出阈值常量"
depends_on:
  - ./extractor.js
  - ../parser.js
when_to_load: 修改验证逻辑、溢出阈值或扩展语言支持时加载
mutates_state: false
domain: analyzer
ai_notes: "exports 格式 'Name: Desc'，取冒号前名称比较。溢出检测只在有 CFM 表头时触发。"
---*/

import fs from "fs";
import { extractExports } from "./extractor.js";
import { extractFrontmatter } from "../parser.js";

/** 各字段溢出阈值（字符数） */
export const OVERFLOW_THRESHOLDS = {
    intent: 80,
    ai_notes: 200,
    export_item: 50,
    export_count: 10,
    when_to_load: 100,
    total_header: 500,
} as const;

export interface ValidationResult {
    file: string;
    hasFrontmatter: boolean;
    isValid: boolean;
    missing: string[];   // In code but not in frontmatter
    stale: string[];     // In frontmatter but not in code
    warnings: string[];  // Documentation overflow warnings
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
        warnings: [],
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
        }

        // ── Documentation Overflow Detection ──
        checkOverflow(frontmatter, result);

    } catch (error: any) {
        result.isValid = false;
        result.errors.push(error.message);
    }

    return result;
}

/**
 * 检测表头各字段是否溢出（又臭又长）
 */
function checkOverflow(fm: Record<string, unknown>, result: ValidationResult): void {
    const T = OVERFLOW_THRESHOLDS;

    // intent 过长
    const intent = fm.intent as string | undefined;
    if (intent && intent.length > T.intent) {
        result.warnings.push(`intent 过长 (${intent.length}/${T.intent} 字符)`);
    }

    // ai_notes 过长
    const aiNotes = fm.ai_notes as string | undefined;
    if (aiNotes && aiNotes.length > T.ai_notes) {
        result.warnings.push(`ai_notes 过长 (${aiNotes.length}/${T.ai_notes} 字符)`);
    }

    // when_to_load 过长
    const whenToLoad = fm.when_to_load as string | undefined;
    if (whenToLoad && whenToLoad.length > T.when_to_load) {
        result.warnings.push(`when_to_load 过长 (${whenToLoad.length}/${T.when_to_load} 字符)`);
    }

    // exports 单条过长 / 总数过多
    const exportsList = (fm.exports as string[]) || [];
    if (exportsList.length > T.export_count) {
        result.warnings.push(`exports 过多 (${exportsList.length}/${T.export_count} 条)`);
    }
    for (const exp of exportsList) {
        if (exp.length > T.export_item) {
            const name = exp.split(":")[0].trim();
            result.warnings.push(`export "${name}" 描述过长 (${exp.length}/${T.export_item} 字符)`);
        }
    }

    // 总表头大小
    const totalSize = JSON.stringify(fm).length;
    if (totalSize > T.total_header) {
        result.warnings.push(`表头总体积过大 (${totalSize}/${T.total_header} 字符)，建议精简`);
    }
}
