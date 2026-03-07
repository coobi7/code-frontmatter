import { readFile } from "node:fs/promises";

// RegExp patterns to match Python public definitions at the top level
const PYTHON_EXPORT_PATTERNS = [
    /^def\s+([a-zA-Z_]\w*)\s*\(/gm,             // def function_name(
    /^class\s+([a-zA-Z_]\w*)/gm,                // class ClassName
    /^([A-Z_][A-Z0-9_]*)\s*=/gm,                // CONSTANT = ...
    /^async\s+def\s+([a-zA-Z_]\w*)\s*\(/gm,     // async def func(
];

/**
 * Extract public exports from a Python file using regex.
 * Skips names starting with underscore (private).
 */
export async function extractPythonExports(filePath: string): Promise<string[]> {
    try {
        const content = await readFile(filePath, "utf-8");
        const exports = new Set<string>();

        for (const pattern of PYTHON_EXPORT_PATTERNS) {
            const matches = content.matchAll(pattern);
            for (const match of matches) {
                if (match[1] && !match[1].startsWith("_")) {
                    exports.add(match[1]);
                }
            }
        }

        return Array.from(exports).sort();
    } catch {
        return [];
    }
}
