import { readFile } from "node:fs/promises";

// Go exports start with a capital letter
const GO_EXPORT_PATTERNS = [
    /^func\s+([A-Z]\w*)\s*\(/gm,               // func ExportedFunc(
    /^type\s+([A-Z]\w*)\s+/gm,                 // type ExportedType struct {
    /^var\s+([A-Z]\w*)\s+/gm,                  // var ExportedVar ...
    /^const\s+([A-Z]\w*)\s+/gm,                // const ExportedConst = ...
];

/**
 * Extract public exports from a Go file using regex.
 * Only extracts names starting with an uppercase letter.
 */
export async function extractGoExports(filePath: string): Promise<string[]> {
    try {
        const content = await readFile(filePath, "utf-8");
        const exports = new Set<string>();

        for (const pattern of GO_EXPORT_PATTERNS) {
            const matches = content.matchAll(pattern);
            for (const match of matches) {
                if (match[1]) exports.add(match[1]);
            }
        }

        return Array.from(exports).sort();
    } catch {
        return [];
    }
}
