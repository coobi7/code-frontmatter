#!/usr/bin/env node
/*---
intent: CLI入口：cfm-check 命令，报告 exports 漂移 + 文档溢出
role: entry
exports: []
depends_on:
  - ../tools/check.js
when_to_load: 修改 CLI 输出格式时加载
ai_notes: "exit(0)=通过, exit(1)=漂移或--strict下有溢出。--strict 让 warnings 也算失败。"
---*/

import { checkDrift } from "../tools/check.js";
import path from "path";
import process from "process";

async function main() {
    const args = process.argv.slice(2);
    const strict = args.includes("--strict");
    const targetPath = args.find(a => !a.startsWith("--")) ?? process.cwd();
    const resolved = path.resolve(targetPath);

    console.log(`🔍 Checking CFM in: ${resolved}${strict ? " (strict mode)" : ""}`);

    try {
        const result = await checkDrift(resolved);

        if (result.total === 0) {
            console.log("⚠️  No files with CFM found.");
            process.exit(0);
        }

        // ── Report errors (drift) ──
        if (result.failed > 0) {
            console.error(`\n❌ ${result.failed} file(s) with documentation rot:\n`);
            for (const f of result.details) {
                console.error(`📄 ${path.relative(process.cwd(), f.file)}`);
                if (f.missing.length > 0) {
                    console.error(`   missing: ${f.missing.join(", ")}`);
                }
                if (f.stale.length > 0) {
                    console.error(`   stale: ${f.stale.join(", ")}`);
                }
                if (f.errors.length > 0) {
                    console.error(`   errors: ${f.errors.join(", ")}`);
                }
                console.error("");
            }
        }

        // ── Report warnings (overflow) ──
        if (result.warned > 0) {
            console.warn(`\n⚠️  ${result.warned} file(s) with documentation overflow:\n`);
            for (const f of result.warnings) {
                console.warn(`📄 ${path.relative(process.cwd(), f.file)}`);
                for (const w of f.warnings) {
                    console.warn(`   ⚠️  ${w}`);
                }
                console.warn("");
            }
        }

        // ── Summary ──
        const hasErrors = result.failed > 0;
        const hasWarnings = result.warned > 0;

        if (!hasErrors && !hasWarnings) {
            console.log(`✅ All ${result.total} files passed!`);
            process.exit(0);
        }

        if (hasErrors) {
            console.error(`💥 Drift detected. Update CFM headers.`);
            process.exit(1);
        }

        if (hasWarnings && strict) {
            console.error(`💥 Overflow detected (strict mode). Trim headers.`);
            process.exit(1);
        }

        // warnings only, non-strict → pass
        console.log(`✅ ${result.passed} passed, ${result.warned} with overflow warnings.`);
        process.exit(0);

    } catch (error) {
        console.error("🔥 Fatal error:", error);
        process.exit(1);
    }
}

main();

