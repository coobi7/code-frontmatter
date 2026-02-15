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
        // Only support JS/TS for now for auto-extraction
        if (filePath.endsWith(".ts") || filePath.endsWith(".js") || filePath.endsWith(".tsx") || filePath.endsWith(".jsx") || filePath.endsWith(".mjs") || filePath.endsWith(".cjs")) {
            const codeExports = await extractExports(filePath);

            // 3. Compare

            // specific case logic for "default":
            // if code exports "default", and CFM has "default" or file role is "component" (often default exported), maybe loose match?
            // Let's stick to strict name matching for now.

            // specific case logic for "module.exports":
            // if code exports "module.exports", CFM might say "Name" (if it exports a single object).
            // This is tricky. For now, let's treat "module.exports" as a special token that matches anything OR specific handling.
            // ACTUALLY, simplicity first: Strict match.

            const cfmSet = new Set(cfmExports);
            const codeSet = new Set(codeExports);

            // Find Missing (In Code but NOT in CFM)
            codeExports.forEach(e => {
                if (!cfmSet.has(e)) {
                    // If code has "default", and CFM has main exported thing, it's a common pattern mismatch.
                    // But we want to enforce accuracy.
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
