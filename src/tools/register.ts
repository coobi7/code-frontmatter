/*---
intent: 实现 cfm_register_language 工具：允许运行时动态、智能地注册新语言支持
role: service
exports:
  - "registerNewLanguage: 校验并自动补全扩展名点号后注册新语言"
depends_on:
  - ../registry.js
  - ../schema.js
when_to_load: 修改语言注册接口或参数校验逻辑时加载
mutates_state: false
domain: registry
ai_notes: 扩展名注册已实现自动规范化：用户传入 "js" 会自动补全为 ".js"。
---*/
import { registerLanguage, getAllLanguages } from "../registry.js";
import type { LanguageRule } from "../schema.js";

/**
 * 注册新语言的返回结果
 */
export interface RegisterResult {
    /** 是否注册成功 */
    success: boolean;
    /** 结果消息 */
    message: string;
    /** 注册后的总语言数 */
    total_languages?: number;
}

/**
 * 校验输入参数并注册新语言
 *
 * @param name - 语言名称（如 "elixir"）
 * @param config - 注释规则配置
 * @returns 注册结果
 */
export function registerNewLanguage(
    name: string,
    config: {
        comment_start: string;
        comment_end: string;
        extensions: string[];
        line_prefix?: string | null;
    }
): RegisterResult {
    // 参数校验
    if (!name || name.trim().length === 0) {
        return {
            success: false,
            message: "语言名称不能为空",
        };
    }

    if (!config.comment_start || !config.comment_end) {
        return {
            success: false,
            message: "comment_start 和 comment_end 不能为空",
        };
    }

    if (!config.extensions || config.extensions.length === 0) {
        return {
            success: false,
            message: "extensions 不能为空，至少需要一个文件扩展名",
        };
    }

    // 校验并规范化扩展名格式
    const normalizedExtensions = config.extensions.map((ext) => {
        if (ext.startsWith(".")) return ext;
        return `.${ext}`;
    });

    // 构造语言规则
    const rule: LanguageRule = {
        comment_start: config.comment_start,
        comment_end: config.comment_end,
        extensions: normalizedExtensions,
        line_prefix: config.line_prefix ?? null,
    };

    try {
        registerLanguage(name, rule);

        const allLanguages = getAllLanguages();
        return {
            success: true,
            message: `语言 "${name}" 注册成功（扩展名: ${normalizedExtensions.join(", ")}）`,
            total_languages: Object.keys(allLanguages).length,
        };
    } catch (error) {
        return {
            success: false,
            message: (error as Error).message,
        };
    }
}
