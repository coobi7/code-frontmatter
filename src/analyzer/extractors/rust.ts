import { readFile } from "node:fs/promises";

// Rust public exports use the 'pub' keyword
const RUST_EXPORT_PATTERNS = [
    /^pub\s+fn\s+([a-zA-Z_]\w*)/gm,            // pub fn function_name
    /^pub\s+struct\s+([a-zA-Z_]\w*)/gm,        // pub struct StructName
    /^pub\s+enum\s+([a-zA-Z_]\w*)/gm,          // pub enum EnumName
    /^pub\s+trait\s+([a-zA-Z_]\w*)/gm,         // pub trait TraitName
    /^pub\s+type\s+([a-zA-Z_]\w*)/gm,          // pub type TypeAlias
    /^pub\s+const\s+([a-zA-Z_]\w*)/gm,         // pub const CONSTANT
];

/**
 * Extract public exports from a Rust file using regex.
 */
export async function extractRustExports(filePath: string): Promise<string[]> {
    try {
        const content = await readFile(filePath, "utf-8");
        const exports = new Set<string>();

        for (const pattern of RUST_EXPORT_PATTERNS) {
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
