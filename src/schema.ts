/*---
intent: 定义 CFM 表头的 Zod Schema 和相关交互接口类型定义
role: model
exports:
  - "LanguageRuleSchema: 语言规则 Zod Schema"
  - "LanguageRule: 语言规则类型定义"
  - "CfmSchema: 完整 CFM 表头 Zod Schema"
  - "CfmData: 完整 CFM 表头类型"
  - "CfmSchemaLoose: 宽松模式 CFM 表头 Schema"
  - "CfmEntrySchema: 扫描结果条目 Schema"
  - "CfmEntry: 扫描结果条目类型"
  - "ScanResult: 扫描结果汇总类型"
  - "SearchResult: 搜索结果类型"
depends_on:
  - zod
when_to_load: 修改 CFM 字段定义或搜索/读取结果结构时加载
mutates_state: false
domain: core
ai_notes: SearchResult 新增 errors 字段，用于反馈解析失败的文件路径及原因。
---*/
import { z } from "zod";

/**
 * 语言注释规则 Schema
 * 定义某种编程语言的 CFM 注释语法
 */
export const LanguageRuleSchema = z.object({
    /** 注释起始标记，如 "/*---" */
    comment_start: z.string(),
    /** 注释结束标记，如 "---*​/" */
    comment_end: z.string(),
    /** 该语言的文件扩展名列表 */
    extensions: z.array(z.string()),
    /** 行前缀（脚本语言使用），如 "# "，C 家族为 null */
    line_prefix: z.string().nullable(),
});

export type LanguageRule = z.infer<typeof LanguageRuleSchema>;

/**
 * CFM 表头严格 Schema（含全部必选字段）
 * 用于校验完整规范的表头
 */
export const CfmSchema = z.object({
    // ---- 必选字段 ----
    /** 文件的核心用途和业务价值 (Be concise, < 50 words) */
    intent: z.string().max(500),
    /** 文件的角色类型 */
    role: z.string(),
    /** 暴露的关键 API / 函数 / 组件 (Signature: Brief description) */
    exports: z.array(z.string()),

    // ---- 推荐字段 ----
    /** 关键依赖 */
    depends_on: z.array(z.string()).optional(),
    /** 什么场景下才需要读取此文件全文 */
    when_to_load: z.string().optional(),

    // ---- 可选字段 ----
    /** 副作用描述 */
    side_effects: z.array(z.string()).optional(),
    /** 是否修改外部状态 */
    mutates_state: z.boolean().optional(),
    /** 业务领域标签 */
    domain: z.string().optional(),
    /** 给 AI 的特殊注意事项 (Critical constraints only. NO changelogs/history. Be concise!) */
    ai_notes: z.string().optional(),
    /** 表头规范版本号 */
    cfm_version: z.string().optional(),
});

export type CfmData = z.infer<typeof CfmSchema>;

/**
 * CFM 表头宽松 Schema（只要求 intent 字段）
 * 用于渐进式表头补充场景——已有表头但尚不完整的文件
 */
export const CfmSchemaLoose = z
    .object({
        intent: z.string(),
    })
    .passthrough();

/**
 * 单个文件的 CFM 条目
 * 包含文件路径和解析出的元数据
 */
export const CfmEntrySchema = z.object({
    /** 文件相对路径 */
    file: z.string(),
    /** 检测到的编程语言 */
    language: z.string().optional(),
    /** 解析出的 CFM 表头数据 */
    frontmatter: z.record(z.unknown()).nullable(),
    /** 校验警告信息 */
    warnings: z.array(z.string()).optional(),
    /** 反向依赖：哪些文件的 depends_on 包含当前文件（仅单文件模式返回） */
    depended_by: z.array(z.string()).optional(),
});

export type CfmEntry = z.infer<typeof CfmEntrySchema>;

/**
 * cfm_read 的返回结果
 */
export interface ScanResult {
    /** 扫描到的总文件数 */
    total_files: number;
    /** 有 CFM 表头的文件数 */
    files_with_cfm: number;
    /** 无 CFM 表头的文件数 */
    files_without_cfm: number;
    /** 所有文件的 CFM 条目 */
    entries: CfmEntry[];
}

/**
 * cfm_search 的返回结果
 */
export interface SearchResult {
    /** 搜索查询 */
    query: string;
    /** 匹配的文件数 */
    matches: number;
    /** 匹配的 CFM 条目 */
    entries: CfmEntry[];
    /** 解析错误的文件列表 */
    errors?: { file: string; message: string }[];
}
