/*---
intent: "实现 cfm_read 工具：支持单文件表头读取（含反向依赖）和目录批量扫描两种模式"
role: service
exports:
  - "readSingleFile: 读取单个文件的 CFM 表头（可含 depended_by）"
  - "scanDirectory: 扫描指定目录，返回所有文件的 CFM 表头索引"
  - "findProjectRoot: 向上查找项目根目录"
depends_on: ["../parser.ts", "../registry.ts", "../schema.ts"]
when_to_load: "修改文件扫描逻辑、过滤规则或结果格式时加载"
ai_notes: "默认跳过 node_modules, .git, dist 等常见非源码目录。单文件模式支持 depended_by 反向依赖。"
---*/

import { readdir, stat, access } from "node:fs/promises";
import { join, relative, extname, basename, dirname, resolve, normalize } from "node:path";
import { extractFrontmatter } from "../parser.js";
import { getLanguageByExtension } from "../registry.js";
import type { CfmEntry, ScanResult } from "../schema.js";

/** 项目根目录的标志文件（按优先级排列） */
const PROJECT_ROOT_MARKERS = [
    "package.json",
    ".git",
    "tsconfig.json",
    "pyproject.toml",
    "Cargo.toml",
    "go.mod",
    "pom.xml",
    "build.gradle",
    ".project",
];

/**
 * 向上查找项目根目录
 *
 * 从给定路径开始，逐级向上查找包含标志文件的目录。
 * 找到第一个包含 package.json / .git / tsconfig.json 等标志的目录即为项目根。
 *
 * @param startPath - 起始文件或目录路径
 * @returns 项目根目录路径，或 null（如遍历到文件系统根仍未找到）
 */
export async function findProjectRoot(startPath: string): Promise<string | null> {
    let current = resolve(startPath);

    // 如果起始路径是文件，先定位到其所在目录
    try {
        const s = await stat(current);
        if (s.isFile()) {
            current = dirname(current);
        }
    } catch {
        return null;
    }

    // 逐级向上查找
    const root = (current.match(/^[A-Za-z]:\\/) ?? current.match(/^\//))?.[0] ?? "/";
    while (current.length >= root.length) {
        for (const marker of PROJECT_ROOT_MARKERS) {
            try {
                await access(join(current, marker));
                return current; // 找到标志文件，返回该目录
            } catch {
                // 标志不存在，继续检查下一个
            }
        }
        const parent = dirname(current);
        if (parent === current) break; // 已到达根目录
        current = parent;
    }

    return null;
}

/**
 * 归一化路径以便比较
 * 统一为正斜杠 + 小写，去掉 ./ 前缀
 */
function normalizePath(p: string): string {
    return p.replace(/\\/g, "/").replace(/^\.\//, "").toLowerCase();
}

/**
 * 在项目中查找反向依赖
 *
 * 扫描项目内所有文件的 CFM 表头，从 depends_on 字段中反向索引，
 * 找出哪些文件依赖了目标文件。
 *
 * @param targetFilePath - 目标文件的绝对路径
 * @param projectRoot - 项目根目录的绝对路径
 * @returns 依赖了目标文件的文件相对路径列表
 */
async function findDependedBy(
    targetFilePath: string,
    projectRoot: string
): Promise<string[]> {
    // 目标文件的相对路径（相对于项目根）
    const targetRelative = normalizePath(relative(projectRoot, targetFilePath));
    // 目标文件的文件名（用于在 depends_on 中匹配简短引用）
    const targetBasename = normalizePath(basename(targetFilePath));

    // 扫描项目内所有文件
    const allEntries: CfmEntry[] = [];
    await walkDirectory(projectRoot, projectRoot, DEFAULT_IGNORE_DIRS, allEntries);

    const dependedBy: string[] = [];

    for (const entry of allEntries) {
        const fm = entry.frontmatter;
        if (!fm || !fm.depends_on || !Array.isArray(fm.depends_on)) continue;

        const dependsOnList = fm.depends_on as string[];
        for (const dep of dependsOnList) {
            const normalizedDep = normalizePath(dep);

            // 匹配策略：
            // 1. 完全匹配相对路径（如 "src/parser.ts"）
            // 2. 以目标路径结尾（如 "../parser.ts" 匹配 "src/parser.ts"）
            // 3. 文件名匹配（如 "parser.ts"）
            if (
                normalizedDep === targetRelative ||
                targetRelative.endsWith(normalizedDep.replace(/^\.\.\//, "").replace(/^\.\//, "")) ||
                normalizedDep.endsWith(targetBasename) ||
                normalizedDep.replace(/\.(js|ts)$/, "") === targetRelative.replace(/\.(js|ts)$/, "")
            ) {
                dependedBy.push(entry.file);
                break; // 一个文件只需记录一次
            }
        }
    }

    return dependedBy;
}

/**
 * 读取单个文件的 CFM 表头
 *
 * @param filePath - 文件的绝对路径
 * @param projectRoot - 可选，项目根目录。若提供则自动计算 depended_by 反向依赖
 * @returns CFM 条目（含解析数据或 null + 警告信息 + 可选 depended_by）
 */
export async function readSingleFile(
    filePath: string,
    projectRoot?: string
): Promise<CfmEntry> {
    const relativePath = basename(filePath);
    const entry = await extractFrontmatter(filePath, relativePath);

    // 如果提供了项目根目录，计算反向依赖
    if (projectRoot) {
        try {
            const depBy = await findDependedBy(filePath, projectRoot);
            entry.depended_by = depBy;
        } catch {
            // 反向依赖计算失败不应影响主功能，静默忽略
            entry.depended_by = [];
        }
    }

    return entry;
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

