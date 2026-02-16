<!--
---
intent: "Code Frontmatter (CFM) 项目的产品需求文档，定义了一种让每个代码文件具备 AI 自描述能力的新范式"
role: spec
when_to_load: "开发 CFM 项目、了解项目背景和技术细节时加载"
version: cfm-v1-draft
---
-->

# Code Frontmatter (CFM)
## 产品需求文档 (PRD)

> **让每一个代码文件拥有自己的"身份证"，让 AI 不读全文就能理解你的整个项目。**

---

## 一、 项目背景

### 1.1 行业痛点

**Vibe Coding 的致命软肋**：当项目超过一定规模后，AI 编程助手面临两个不可调和的矛盾：

1. **Token 成本**：用户不可能让 AI 无节制加载所有代码文件，API 调用费用太昂贵
2. **上下文上限**：大模型的上下文窗口有物理极限，超载后会严重"幻觉"——生成破坏现有功能的错误代码

**核心问题**：AI 不是不能做，而是当前阶段 AI 无法每次都加载整个代码工程。

### 1.2 现有方案的不足

| 方案 | 代表 | 粒度 | 核心缺陷 |
|---|---|---|---|
| 项目级规则文件 | `CLAUDE.md`, `.cursorrules` | 项目级 | 只定义规则，不描述具体文件 |
| 目录级上下文 | CCS (`.context.md`) | 目录级 | 粒度不够细，且需要额外维护独立文档 |
| RAG 向量检索 | 各家 IDE 内置 | 代码片段 | 基于概率而非确定性，丢失结构信息 |
| 行级锚点注释 | `AIDEV-NOTE:` | 行/块级 | 分散各处，AI 需读全文才能找到 |

**空白地带**：没有任何厂商提出过针对**每个源代码文件**的内嵌结构化自描述标准。

### 1.3 我们的解决方案

**Code Frontmatter (CFM)**——一种开放标准，要求每个代码文件顶部内嵌一段结构化的 YAML 元数据表头。

AI 只需扫描所有文件的表头（极低 Token 消耗），就能构建出整个项目的认知地图，仅在必要时按需加载文件全文。

### 1.4 Token 经济学论证

以一个 2000 文件的中型项目为例：

| 策略 | 计算 | Token 消耗 | 可行性 |
|---|---|---|---|
| 暴力全量加载 | 2000 × 1500 | **3,000,000** | ❌ 远超模型上限 |
| CFM 表头扫描 | 2000 × 60 | **120,000** | ✅ 安全区间 |
| 扫描 + 按需加载 5 文件 | 120,000 + 7,500 | **127,500** | ✅ 精准高效 |

> **上下文压缩率 > 95%，API 费用节省 > 95%，幻觉风险大幅降低。**

---

## 二、 产品定位

### 2.1 一句话描述

**CFM 是一个 MCP Server 工具，让 AI 编程助手能以极低成本理解整个代码库。**

### 2.2 目标用户

- 使用 AI IDE（Cursor、Windsurf、VS Code + Copilot 等）的开发者
- 使用 AI CLI（Claude Code 等）的开发者
- 尤其是：用 Vibe Coding 方式从零构建项目的用户

### 2.3 核心原则

| 原则 | 说明 |
|---|---|
| **只做一件事** | 只管代码文件表头，不插手项目级规则、目录级上下文、行级注释 |
| **零配置** | 安装 MCP 工具即可使用，无需任何前置配置 |
| **自然融入** | 表头在 AI 工作流中自然创建和维护，不增加额外步骤 |
| **语言无关** | 支持任何编程语言，含用户自创语言，通过可扩展的语言注册表实现 |
| **轻量无依赖** | 不依赖 Tree-sitter 等重型解析工具，用简单文本匹配提取表头 |

### 2.4 我们的范围

```
  ❌ 项目级规则（CLAUDE.md 等）      → 各家 IDE 的事
  ❌ 目录级上下文（.context.md 等）   → 不管
  ✅ 文件级表头（Code Frontmatter）  → 我们的全部
  ❌ 行级锚点注释（AIDEV-NOTE 等）   → 不纳入标准
```

---

## 三、 CFM 表头规范 (Schema v1)

### 3.1 多语言封装语法

表头用**目标语言的注释语法**包裹 YAML 数据：

| 语言生态 | 起始标记 | 结束标记 | 适用文件 |
|---|---|---|---|
| C家族 & Web前端 | `/*---` | `---*/` | `.js`, `.ts`, `.jsx`, `.tsx`, `.css`, `.java`, `.cpp`, `.go`, `.swift` |
| 脚本语言 | `#---` | `#---` | `.py`, `.rb`, `.sh`, `.yaml` |
| HTML / 模板 | `<!-----` | `----->` | `.html`, `.vue`, `.svelte` |
| Markdown / 纯文本 | `---` | `---` | `.md`, `.txt`（兼容 Jekyll 原生语法） |
| Lua / SQL | `----` | `----` | `.lua`, `.sql` |
| **自定义语言** | 通过语言注册表配置 | 通过语言注册表配置 | 任意 |

### 3.2 字段定义

#### 必选字段

| 字段 | 类型 | 说明 | 示例 |
|---|---|---|---|
| `intent` | string | 一两句话描述文件的核心用途和业务价值 | `"管理地图上的铁路图层，包括数据源加载和样式控制"` |
| `role` | string | 文件的角色类型 | `component`, `service`, `util`, `config`, `page`, `model`, `spec`, `test` 等 |
| `exports` | list | 暴露的关键 API / 函数 / 组件 | `["initMap: 初始化地图实例", "toggleLayer: 切换图层"]` |

#### 推荐字段

| 字段 | 类型 | 说明 | 示例 |
|---|---|---|---|
| `depends_on` | list | 该文件的关键依赖（内部文件或外部库） | `["./map-core.js", "mapbox-gl"]` |
| `when_to_load` | string | 告诉 AI 什么场景下才需要读取此文件全文 | `"涉及铁路图层样式修改或数据源更换时加载"` |

#### 可选字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `side_effects` | list | 副作用描述（写数据库、改 DOM、发请求等） |
| `mutates_state` | boolean | 是否修改外部状态（安全标记） |
| `domain` | string | 业务领域标签（`payment`, `auth`, `map-layer` 等） |
| `ai_notes` | string | 给 AI 的特殊注意事项、"陷阱提醒" |

#### 保留字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `cfm_version` | string | 表头规范版本号，默认 `v1`，用于未来兼容 |

### 3.3 完整示例

**JavaScript 文件：**
```javascript
/*---
intent: "管理地图上的铁路图层（国铁+城市地铁），包括数据源加载、样式控制和交互"
role: service
exports:
  - "initRailwayLayers: 初始化铁路图层系统"
  - "updateRailwayLayerStyle: 更新图层颜色（type: 'bg'|'dash'）"
  - "toggleRailwayLayer: 开关图层显示"
depends_on: ["mapbox-gl", "./map-core.js", "index.html#railway-panel"]
when_to_load: "涉及铁路图层的显示、样式或数据源修改时加载"
side_effects: ["修改 map 的图层和数据源", "操作铁路面板 DOM"]
mutates_state: true
ai_notes: "国铁数据来自自定义 tileset，不是 Mapbox 内置铁路数据"
---*/

import mapboxgl from 'mapbox-gl';
// 实际代码...
```

**Python 文件：**
```python
#---
# intent: "用户订单的核心状态机，管理从创建到完成的全生命周期"
# role: service
# exports:
#   - "create_order: 创建新订单"
#   - "transition_state: 状态流转"
# depends_on: ["database.py", "payment_gateway.py"]
# when_to_load: "涉及订单创建、支付回调或状态变更时加载"
# mutates_state: true
#---

from database import OrderRepository
# 实际代码...
```

**Markdown 文件：**
```markdown
---
intent: "Code Frontmatter 项目的产品需求文档"
role: spec
when_to_load: "了解 CFM 项目背景、规范定义或开发计划时加载"
---

# 正文内容...
```

---

## 四、 MCP Server 接口设计

### 4.1 暴露的工具接口

MCP Server 只向 AI 暴露 **3 个核心工具**，保持极简：

| 工具名 | 功能 | 调用时机 |
|---|---|---|
| `cfm_read` | 读取单个或多个文件的表头（支持文件路径和目录路径） | AI 在读取文件全文前，先查看表头决定是否需要深入阅读 |
| `cfm_search` | 按关键字/角色/领域搜索匹配的文件表头 | AI 收到用户任务后，精准定位相关文件（首选入口） |
| `cfm_register_language` | 注册新语言的注释语法规则 | 遇到未知语言类型时 |

### 4.2 AI 的标准工作流

> **核心理念：CFM 是 AI 正常工作流的“加速器”，不是“替代品”。**
>
> AI 应该保持自身 IDE/CLI 的正常工作流，CFM 作为透明的过滤层，在 AI **即将读取某个文件全文的前一刻**介入，帮它用极低成本判断“值不值得读”。

```
用户：「帮我修改下单后的库存扣减逻辑」

主路径（搜索命中）：
Step 1  AI 调用 cfm_search(keyword="库存") → 精准命中 inventory.py、order_service.py
Step 2  AI 根据返回的 intent/exports 判断需要深入阅读哪些文件
Step 3  AI 通过 IDE/CLI 原生工具读取目标文件的全文
Step 4  AI 完成编码修改
Step 5  AI 调用 cfm_write 更新涉及文件的表头

备选路径（搜索未命中时）：
Step 1  AI 用自身工具（grep/list_dir）定位候选文件
Step 2  对候选文件调用 cfm_read(path="文件路径") → 仅读取表头
Step 3  根据表头 intent/exports 判断是否需要读取全文
Step 4  按需读取 → 编码 → 更新表头
```

### 4.3 表头的生命周期管理

| 阶段 | 行为 | 说明 |
|---|---|---|
| **创建文件时** | 自动生成表头 | AI 创建新文件时，自然附带表头 |
| **读取文件时** | 发现无表头 → 补充 | 渐进式覆盖已有项目 |
| **修改文件后** | 检查是否需要更新 | 对比表头声明与修改内容 |
| **不强制全量覆盖** | 渐进式推进 | 无需一次性处理所有文件 |

---

## 五、 语言注册表

### 5.1 设计理念

> **CFM 标准与编程语言完全解耦。** 标准定义的是 YAML Schema，具体用什么注释语法封装是独立的可扩展配置。

### 5.2 内置语言注册表

```json
{
  "javascript": {
    "comment_start": "/*---",
    "comment_end": "---*/",
    "extensions": [".js", ".jsx", ".mjs", ".cjs"],
    "line_prefix": null
  },
  "python": {
    "comment_start": "#---",
    "comment_end": "#---",
    "extensions": [".py", ".pyw"],
    "line_prefix": "# "
  }
}
```

### 5.3 扩展机制

- **本地注册**：用户通过 `cfm_register_language` 工具注册自定义语言
- **社区共享（未来）**：注册数据上传至中央仓库，所有用户自动获得新语言支持

---

## 六、 技术实现

### 6.1 表头提取方式

**不使用 Tree-sitter**，用简单的文本模式匹配：

1. 根据文件扩展名，从语言注册表查找 `comment_start` / `comment_end`
2. 在文件开头找到匹配的标记对
3. 提取标记之间的文本，去掉 `line_prefix`（如有）
4. 用标准 YAML 解析器解析

零依赖、极轻量、安装即用。

### 6.2 安全考量

- 表头文本传入大模型前，进行基础的文本清洗，防止 Prompt Injection
- 字段值应有长度上限（如 `intent` 不超过 200 字符）
- `cfm_version` 字段确保未来版本兼容

---

## 七、 MVP 范围（v0.1）

### 7.1 MVP 必须实现

- [ ] MCP Server 基础框架搭建
- [ ] `cfm_read`：扫描目录，提取所有文件 CFM 表头，返回汇总索引
- [ ] `cfm_search`：按关键字搜索表头
- [ ] `cfm_register_language`：注册新语言注释规则
- [ ] 内置 10+ 主流语言的注释规则
- [ ] YAML Schema 校验（必选字段检查）
- [ ] README 和安装说明

### 7.2 MVP 之后

- [ ] 社区语言注册表（在线共享）
- [ ] CI/CD 集成（GitHub Action：PR 时校验表头）
- [ ] VS Code / Cursor 插件（可视化编辑表头）
- [ ] 发布 RFC 规范文档

---

## 八、 推广路线图

### 阶段一：MVP 验证（1-2 个月）
1. 在 GitHub 创建 `code-frontmatter` 仓库
2. 开发 MCP Server MVP
3. 在自己的项目上试点
4. 撰写 README

### 阶段二：社区传播（2-4 个月）
1. 发布到 MCP 工具市场
2. 在 Hacker News / Reddit / Twitter 推广
3. 核心卖点：**95% Token 节省 + 消除幻觉 + 即插即用**

### 阶段三：生态渗透（4-12 个月）
1. 向 Anthropic 提交提案
2. 发布 GitHub Action
3. 向框架社区提 PR（脚手架默认生成表头）
4. 正式发布 RFC

## 十一、自动化维护（v0.2 新增）

为了解决"文档腐烂"问题，v0.2 版本引入了自动化校验机制：

1.  **静态分析器 (`cfm-check`)**：
    - 基于 AST 分析代码实际 export。
    - 对比 CFM 表头中的 `exports` 字段。
    - 发现不一致即报错（Drift Detection）。

2.  **Git Hooks 集成**：
    - 提供 `npm run setup-hooks` 脚本。
    - 在 `pre-commit` 阶段自动运行校验，强制只有文档与代码一致时才能提交。

---

## 九、 竞品与差异化

| 维度 | CFM（我们） | CCS (.context.md) | CLAUDE.md / .cursorrules |
|---|---|---|---|
| **粒度** | 每个代码文件 | 每个目录 | 项目级 |
| **存放位置** | 代码文件内部顶部 | 独立 .md 文件 | 独立 .md 文件 |
| **维护方式** | AI 自然维护 | 需手动维护 | 需手动维护 |
| **额外文件** | 无 | 大量 .context.md | 1-2 个规则文件 |
| **渐进式披露** | ✅ 先读表头，再按需读全文 | ✅ 先读父目录 | ❌ 全量加载 |
| **交付形式** | MCP Server | 规范文档 | 规范文档 |

---

## 十、项目信息

| 项目 | 详情 |
|---|---|
| **名称** | Code Frontmatter (CFM) |
| **仓库** | github.com/（待创建）/code-frontmatter |
| **协议** | MIT License |
| **初始版本** | v0.1.0 |
| **创建日期** | 2026-02-12 |
