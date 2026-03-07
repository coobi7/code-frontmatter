/*---
intent: 使用 TypeScript Compiler API 解析文件 AST，提取所有导出符号名（ESM/CJS 均支持）
role: service
exports:
  - "extractExports: 从 TS/JS 文件中提取所有导出符号名列表"
depends_on:
  - typescript
  - fs
when_to_load: 修改导出提取逻辑或增加新导出模式支持时加载
mutates_state: false
domain: analyzer
ai_notes: 支持 export、export default、export {}、module.exports 和 exports.xxx 五种模式。解构导出也有基本处理。
---*/

import ts from "typescript";
import fs from "fs";
import { extractPythonExports } from "./extractors/python.js";
import { extractGoExports } from "./extractors/go.js";
import { extractRustExports } from "./extractors/rust.js";

/**
 * Extracts the names of all exported symbols from a TypeScript/JavaScript file.
 * This includes:
 * - `export const/let/var/function/class/interface/type/enum Name ...`
 * - `export { Name }`
 * - `export { Name as Alias }` (returns "Alias")
 * - `export default ...` (returns "default")
 * - `module.exports = ...` (returns "module.exports")
 *
 * @param filePath Absolute path to the file.
 * @returns A promise that resolves to an array of exported names, or null if the language is not supported.
 */
export async function extractExports(filePath: string): Promise<string[] | null> {
    if (filePath.endsWith(".ts") || filePath.endsWith(".js") || filePath.endsWith(".tsx") || filePath.endsWith(".jsx") || filePath.endsWith(".mjs") || filePath.endsWith(".cjs")) {
        return extractTypeScriptExports(filePath);
    }
    if (filePath.endsWith(".py")) {
        return extractPythonExports(filePath);
    }
    if (filePath.endsWith(".go")) {
        return extractGoExports(filePath);
    }
    if (filePath.endsWith(".rs")) {
        return extractRustExports(filePath);
    }
    return null;
}

async function extractTypeScriptExports(filePath: string): Promise<string[]> {
    // Read file content
    const fileContent = fs.readFileSync(filePath, "utf-8");

    // Parse SourceFile
    const sourceFile = ts.createSourceFile(
        filePath,
        fileContent,
        ts.ScriptTarget.Latest,
        true
    );

    const exports: Set<string> = new Set();

    function visit(node: ts.Node) {
        // 1. Check for `export` modifier on top-level declarations
        //    e.g. export const foo = 1;
        //    e.g. export function bar() {}
        if (
            ts.canHaveModifiers(node) &&
            ts.getModifiers(node)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
        ) {
            if (ts.isVariableStatement(node)) {
                node.declarationList.declarations.forEach((decl) => {
                    if (ts.isIdentifier(decl.name)) {
                        exports.add(decl.name.text);
                    } else if (ts.isObjectBindingPattern(decl.name) || ts.isArrayBindingPattern(decl.name)) {
                        // Handle destructuring exports like: export const { a, b } = obj;
                        // For simplicity in this v1, we might skip complex destructuring or best-effort.
                        // Let's implement basic binding element support.
                        decl.name.elements.forEach(element => {
                            if (ts.isBindingElement(element) && ts.isIdentifier(element.name)) {
                                exports.add(element.name.text);
                            }
                        });
                    }
                });
            } else if (
                ts.isFunctionDeclaration(node) ||
                ts.isClassDeclaration(node) ||
                ts.isInterfaceDeclaration(node) ||
                ts.isTypeAliasDeclaration(node) ||
                ts.isEnumDeclaration(node)
            ) {
                if (node.name && ts.isIdentifier(node.name)) {
                    exports.add(node.name.text);
                }
                // Handle `export default function/class ...`
                const hasDefault = ts.getModifiers(node)?.some(
                    (m) => m.kind === ts.SyntaxKind.DefaultKeyword
                );
                if (hasDefault) {
                    exports.add("default");
                }

            }
        }

        // 2. Check for `export { ... }` (Named Exports)
        //    e.g. export { foo, bar as baz };
        if (ts.isExportDeclaration(node)) {
            if (node.exportClause && ts.isNamedExports(node.exportClause)) {
                node.exportClause.elements.forEach((element) => {
                    // Use the exported name (alias if present)
                    exports.add(element.name.text);
                });
            }
        }

        // 3. Check for `export = ...` (CommonJS/TS export assignment)
        //    e.g. export = Foo;
        if (ts.isExportAssignment(node)) {
            // This typically maps to "default" or "module.exports" concept in TS compatibility
            // But for raw TS export =, it's an assignment.
            // Let's treat valid 'export default' as 'default'.
            if (!node.isExportEquals) {
                exports.add("default");
            }
            // 'export = X' is usually for CommonJS interop, typically acts like module.exports.
            // We can track it if needed, but 'default' is safe for typical ESM consumers.
        }

        // 4. Check for `module.exports = ...` or `exports.foo = ...` (Legacy JS/CommonJS)
        if (ts.isBinaryExpression(node)) {
            if (node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
                // Check left side for `module.exports` or `exports.foo`
                if (ts.isPropertyAccessExpression(node.left)) {
                    if (ts.isIdentifier(node.left.expression) && node.left.expression.text === "module" &&
                        node.left.name.text === "exports") {
                        exports.add("module.exports");
                    }
                    if (ts.isIdentifier(node.left.expression) && node.left.expression.text === "exports") {
                        // exports.foo = ...
                        exports.add(node.left.name.text);
                    }
                } else if (ts.isIdentifier(node.left) && node.left.text === "exports") {
                    // exports = ... (technically only valid in some contexts but worth catching)
                    exports.add("module.exports");
                }
            }
        }


        ts.forEachChild(node, visit);
    }

    visit(sourceFile);

    return Array.from(exports);
}
