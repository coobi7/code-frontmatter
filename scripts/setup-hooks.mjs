/*---
intent: 设置 git pre-commit hook，用于在提交前自动运行 cfm-check
role: script
exports: []
depends_on: []
when_to_load: "手动运行或 npm postinstall 时"
ai_notes: "此脚本仅用于开发环境，写入 .git/hooks/pre-commit"
---*/

import { writeFileSync, chmodSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const gitHooksDir = join(rootDir, '.git', 'hooks');
const preCommitPath = join(gitHooksDir, 'pre-commit');

// 检查 .git 目录是否存在
if (!existsSync(join(rootDir, '.git'))) {
    console.log('⚠️  未找到 .git 目录，跳过 hook 安装。');
    process.exit(0);
}

// 确保 hooks 目录存在
if (!existsSync(gitHooksDir)) {
    mkdirSync(gitHooksDir, { recursive: true });
}

const hookContent = `#!/bin/sh
# Code Frontmatter Pre-commit Hook
# Checks for documentation drift before commit

echo "🔍 Running Code Frontmatter Verification..."

# 尝试使用 tsx 运行源码检查 (开发环境)
if [ -f "src/bin/cfm-check.ts" ]; then
    npx tsx src/bin/cfm-check.ts
    EXIT_CODE=$?
else
    # 生产环境/无源码环境回退
    echo "⚠️  src/bin/cfm-check.ts not found, skipping check."
    EXIT_CODE=0
fi

if [ $EXIT_CODE -ne 0 ]; then
    echo "❌ Documentation rot detected! Please fix CFM headers before committing."
    exit 1
fi

echo "✅ CFM Verification Passed."
exit 0
`;

try {
    writeFileSync(preCommitPath, hookContent, { mode: 0o755 });
    // 双重保险：chmod +x
    try {
        chmodSync(preCommitPath, '755');
    } catch (e) {
        // Windows 上可能会失败，忽略
    }
    console.log('✅ Git pre-commit hook installed successfully.');
} catch (error) {
    console.error('❌ Failed to install pre-commit hook:', error);
    process.exit(1);
}
