/*---
intent: "管理语言注册表：加载内置语言规则、按文件扩展名查找语言、支持运行时动态注册新语言"
role: service
exports:
  - "loadRegistry: 从 registry.json 加载内置语言注册表"
  - "getLanguageByExtension: 根据文件扩展名查找对应的语言规则"
  - "registerLanguage: 运行时注册新的语言注释规则"
  - "getAllLanguages: 获取所有已注册的语言列表"
depends_on: ["./schema.ts", "../languages/registry.json"]
when_to_load: "修改语言查找逻辑或注册机制时加载"
---*/

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { LanguageRuleSchema, type LanguageRule } from "./schema.js";

/**
 * 语言注册表：语言名称 → 注释规则映射
 * 键为语言名(如 "javascript")，值为注释标记配置
 */
const registry = new Map<string, LanguageRule>();

/**
 * 扩展名反向索引：扩展名 → 语言名映射
 * 用于快速按扩展名查找语言
 */
const extensionIndex = new Map<string, string>();

/**
 * 从 languages/registry.json 加载内置语言注册表
 * 应在 MCP Server 启动时调用一次
 */
export async function loadRegistry(): Promise<void> {
    // 定位 registry.json 文件路径（相对于当前模块）
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const registryPath = join(__dirname, "..", "languages", "registry.json");

    const raw = await readFile(registryPath, "utf-8");
    const data = JSON.parse(raw) as Record<string, unknown>;

    for (const [name, rule] of Object.entries(data)) {
        // 用 Zod 校验每条语言规则的格式
        const parsed = LanguageRuleSchema.parse(rule);
        registry.set(name, parsed);

        // 建立扩展名 → 语言名的反向索引
        for (const ext of parsed.extensions) {
            extensionIndex.set(ext.toLowerCase(), name);
        }
    }
}

/**
 * 根据文件扩展名查找对应的语言注释规则
 * @param ext - 文件扩展名，如 ".js", ".py"
 * @returns 匹配的语言规则，未找到则返回 null
 */
export function getLanguageByExtension(
    ext: string
): { name: string; rule: LanguageRule } | null {
    const normalizedExt = ext.toLowerCase();
    const langName = extensionIndex.get(normalizedExt);

    if (!langName) return null;

    const rule = registry.get(langName);
    if (!rule) return null;

    return { name: langName, rule };
}

/**
 * 运行时动态注册新语言
 * @param name - 语言名称
 * @param rule - 语言注释规则
 * @throws 如果该语言已存在则抛出错误
 */
export function registerLanguage(name: string, rule: LanguageRule): void {
    const normalizedName = name.toLowerCase();

    if (registry.has(normalizedName)) {
        throw new Error(
            `语言 "${name}" 已存在于注册表中。如需更新，请先移除旧注册。`
        );
    }

    // 检查扩展名是否与已有语言冲突
    for (const ext of rule.extensions) {
        const existing = extensionIndex.get(ext.toLowerCase());
        if (existing) {
            throw new Error(
                `扩展名 "${ext}" 已被语言 "${existing}" 注册。`
            );
        }
    }

    registry.set(normalizedName, rule);
    for (const ext of rule.extensions) {
        extensionIndex.set(ext.toLowerCase(), normalizedName);
    }
}

/**
 * 获取所有已注册的语言及其规则
 * @returns 语言名称与规则的映射
 */
export function getAllLanguages(): Record<string, LanguageRule> {
    const result: Record<string, LanguageRule> = {};
    for (const [name, rule] of registry.entries()) {
        result[name] = rule;
    }
    return result;
}
