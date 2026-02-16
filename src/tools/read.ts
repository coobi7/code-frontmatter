/*---
intent: "实现 cfm_read 工具：支持单文件表头读取和目录批量扫描两种模式"
role: service
exports:
  - "readSingleFile: 读取单个文件的 CFM 表头"
  - "scanDirectory: 扫描指定目录，返回所有文件的 CFM 表头索引"
depends_on: ["../parser.ts", "../registry.ts", "../schema.ts"]
when_to_load: "修改文件扫描逻辑、过滤规则或结果格式时加载"
ai_notes: "默认跳过 node_modules, .git, dist 等常见非源码目录"
---*/

import { readdir, stat } from "node:fs/promises";
import { join, relative, extname, basename } from "node:path";
import { extractFrontmatter } from "../parser.js";
import { getLanguageByExtension } from "../registry.js";
import type { CfmEntry, ScanResult } from "../schema.js";

/**
 * 读取单个文件的 CFM 表头
 *
 * @param filePath - 文件的绝对路径
 * @returns CFM 条目（含解析数据或 null + 警告信息）
 */
export async function readSingleFile(filePath: string): Promise<CfmEntry> {
    const relativePath = basename(filePath);
    return extractFrontmatter(filePath, relativePath);
}

/** 默认跳过的目录名 */
const DEFAULT_IGNORE_DIRS = new Set([
    "node_modules",
    ".git",
    ".svn",
    ".hg",
    "dist",
    "build",
    "out",
    ".next",
    ".nuxt",
    "__pycache__",
    ".pytest_cache",
    "venv",
    ".venv",
    "target",
    "vendor",
    ".idea",
    ".vscode",
    "coverage",
]);

/** 默认跳过的文件名 */
const DEFAULT_IGNORE_FILES = new Set([
    ".DS_Store",
    "Thumbs.db",
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
]);

/**
 * 扫描目录中所有代码文件的 CFM 表头
 *
 * @param directory - 要扫描的根目录（绝对路径）
 * @param options - 扫描选项
 * @returns 扫描结果汇总（含所有文件的 CFM 条目）
 */
export async function scanDirectory(
    directory: string,
    options: {
        /** 自定义忽略目录 */
        ignoreDirs?: string[];
        /** 是否只返回有 CFM 表头的文件 */
        cfmOnly?: boolean;
    } = {}
): Promise<ScanResult> {
    const ignoreDirs = new Set([
        ...DEFAULT_IGNORE_DIRS,
        ...(options.ignoreDirs ?? []),
    ]);

    const entries: CfmEntry[] = [];

    // 递归遍历
    await walkDirectory(directory, directory, ignoreDirs, entries);

    // 按选项过滤
    const filteredEntries = options.cfmOnly
        ? entries.filter((e) => e.frontmatter !== null)
        : entries;

    return {
        total_files: entries.length,
        files_with_cfm: entries.filter((e) => e.frontmatter !== null).length,
        files_without_cfm: entries.filter((e) => e.frontmatter === null).length,
        entries: filteredEntries,
    };
}

/**
 * 递归遍历目录
 */
async function walkDirectory(
    rootDir: string,
    currentDir: string,
    ignoreDirs: Set<string>,
    entries: CfmEntry[]
): Promise<void> {
    const items = await readdir(currentDir);

    for (const item of items) {
        const fullPath = join(currentDir, item);

        // 跳过被忽略的文件
        if (DEFAULT_IGNORE_FILES.has(item)) continue;

        const itemStat = await stat(fullPath);

        if (itemStat.isDirectory()) {
            // 跳过被忽略的目录
            if (ignoreDirs.has(item)) continue;
            await walkDirectory(rootDir, fullPath, ignoreDirs, entries);
        } else if (itemStat.isFile()) {
            const ext = extname(item);

            // 只处理已注册语言的文件
            if (!getLanguageByExtension(ext)) continue;

            const relativePath = relative(rootDir, fullPath).replace(/\\/g, "/");
            const entry = await extractFrontmatter(fullPath, relativePath);
            entries.push(entry);
        }
    }
}
