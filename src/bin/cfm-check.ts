#!/usr/bin/env node
import { checkDrift } from "../tools/check.js";
import path from "path";
import process from "process";

async function main() {
    const args = process.argv.slice(2);
    const targetPath = args[0] ? path.resolve(args[0]) : process.cwd();

    console.log(`🔍 Checking for Code Frontmatter drift in: ${targetPath}`);

    try {
        const result = await checkDrift(targetPath);

        if (result.total === 0) {
            console.log("⚠️  No files with Code Frontmatter found.");
            process.exit(0);
        }

        if (result.failed === 0) {
            console.log(`✅ All ${result.total} files are in sync!`);
            process.exit(0);
        }

        console.error(`❌ Found ${result.failed} files with documentation rot:\n`);

        for (const failure of result.details) {
            console.error(`📄 ${path.relative(process.cwd(), failure.file)}`);
            if (failure.missing.length > 0) {
                console.error(`   - Missing exports (in code, not in CFM): ${failure.missing.join(", ")}`);
            }
            if (failure.stale.length > 0) {
                console.error(`   - Stale exports (in CFM, not in code): ${failure.stale.join(", ")}`);
            }
            if (failure.errors.length > 0) {
                console.error(`   - Errors: ${failure.errors.join(", ")}`);
            }
            console.error("");
        }

        console.error(`💥 Verification failed. Please update the CFM headers.`);
        process.exit(1);

    } catch (error) {
        console.error("🔥 Fatal error:", error);
        process.exit(1);
    }
}

main();
