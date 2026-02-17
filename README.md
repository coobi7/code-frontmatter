---
intent: "Project documentation and usage guide"
role: documentation
when_to_load: "Initial setup or reference"
---

# Code Frontmatter (CFM)

[![npm version](https://img.shields.io/npm/v/code-frontmatter.svg?style=flat-square)](https://www.npmjs.com/package/code-frontmatter)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](https://makeapullrequest.com)

[中文文档](./README.zh-CN.md) | [English](./README.md)

> **The "Passport" for your code files.**  
> **Empower AI to understand your entire repository with < 5% of the token cost.**

---

**Code Frontmatter (CFM)** is an open standard and [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) Server that manages structured metadata within your source code. 

By adding a lightweight YAML header to your files, you promote your codebase from "text files" to a "semantic graph" that AI agents (like Cursor, Windsurf, Claude) can navigate instantly and accurately.

## 🚀 Why CFM?

AI coding assistants often struggle with large codebases:
1.  **Context Overflow**: Reading every file to understand the architecture consumes massive context windows ($$$).
2.  **Hallucination**: Guessing file purposes leads to bugs.
3.  **blindness**: Agents don't know *where* to look for specific logic.

**CFM solves this by exposing high-level intent, architectural roles, and dependency graphs without requiring the AI to read the code body.**

| Metric | Without CFM | With CFM |
| :--- | :--- | :--- |
| **Context Cost** | 100% (Full Source) | **~3-5% (Headers Only)** |
| **Search Speed** | Slow (Grep/Read) | **Instant (Semantic Index)** |
| **Accuracy** | Probabilistic | **Deterministic** |

## 📦 Installation

This project is designed as a **Model Context Protocol (MCP)** server.

### 1. For [Cursor](https://cursor.sh)

Add the following to your `~/.cursor/mcp.json` (or strictly via the Cursor Settings UI):

```json
{
  "mcpServers": {
    "code-frontmatter": {
      "command": "npx",
      "args": ["-y", "code-frontmatter"]
    }
  }
}
```

### 2. For [Claude Desktop](https://claude.ai/download)

Add the following to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "code-frontmatter": {
      "command": "npx",
      "args": ["-y", "code-frontmatter"]
    }
  }
}
```

## 🤖 Instructions for AI Agents (Critical)

**To get the most out of CFM, you must instruct your AI assistant to use it.** 
AI models are lazy; they will try to guess instead of calling tools unless explicitly told otherwise.

**Copy and paste the following into your Project Rules (`.cursorrules` / `.windsurfrules`) or Custom Instructions:**

```markdown
# Code Frontmatter Protocol (CFM)

This project uses Code Frontmatter (CFM) to manage file metadata. 
You MUST follow these rules strictly:

1.  **Initialize Context**: At the start of a session, ALWAYS call `cfm_read` (or `cfm_scan`) on the project root to build your mental map. 
    - DO NOT list all files with `ls -R`. Use `cfm_read` instead.
2.  **Search First**: When looking for specific functionality (e.g., "auth logic"), use `cfm_search` before reading file contents.
3.  **Maintain Headers**: 
    - When creating a new file, you MUST generate a valid CFM header (intent, role, exports).
    - When significantly modifying code, you MUST update the `exports` and `ai_notes` in the header using `cfm_write`.
    - KEEP `ai_notes` BRIEF. Only store permanent architectural constraints, not change logs.
```

## 🛠 Usage & Syntax

### The Header Format

CFM uses a YAML block inside your language's standard comment syntax.

**TypeScript / JavaScript / Java / C#:**
```typescript
/*---
intent: "Handles JWT token validation and rotation"
role: service
exports:
  - "verifyToken: Checks signature"
  - "refreshToken: Issues new access token"
depends_on: ["config.ts", "db-client.ts"]
ai_notes: "Do not modify the secret key derivation logic."
---*/

export function verifyToken(token) { ... }
```

**Python / Ruby / Shell / YAML:**
```python
#---
# intent: "User data model definition"
# role: model
# domain: "identity"
# mutates_state: false
#---

class User(BaseModel): ...
```

### Available Tools

When installed as an MCP server, your AI gains these super-powers:

*   **`cfm_read({ directory })`**: 
    *   Returns a high-level summary of all files (paths, intents, roles, exports) in one JSON object. 
    *   *Best for: Initializing session context.*
*   **`cfm_search({ query, role, domain })`**: 
    *   Semantic search over the headers. 
    *   *Best for: "Find where user billing is handled".*
*   **`cfm_write({ file, intent, ... })`**: 
    *   Writes or updates the header.
    *   *Best for: Creating new files or updating documentation.*
*   **`cfm_register_language({ name, extensions, ... })`**: 
    *   Teaches the server how to parse headers for custom file types.

## ✨ Automated Maintenance (Preventing Rot)

The biggest risk with documentation is that it becomes outdated ("Documentation Rot"). CFM includes built-in tools to prevent this.

### 1. Drift Detection (`cfm-check`)

Code Frontmatter comes with a CLI tool that verifies if your CFM headers match your actual code exports.

```bash
# Check the entire project
npx cfm-check

# Check specific directory
npx cfm-check src/
```

If it detects discrepancies (e.g., you exported a new function but didn't update the `exports` list in the header), it will exit with an error.

### 2. Git Pre-commit Hook

You can install a git hook to automatically check for drift before every commit:

```bash
npm run setup-hooks
```

Once installed, `git commit` will be blocked if your CFM headers are outdated, ensuring your documentation is always synchronized with your code.

## 🤝 Contributing

We want to make this the industry standard for AI-Code interaction.
1.  Fork the repo.
2.  Create a feature branch.
3.  Submit a PR.

**Focus areas:**
- Parsers for more languages (Rust, Go, Swift).
- IDE Extensions (VS Code, JetBrains).
- Analysis tools.

## 📄 License

MIT © 2026 [coobi7](https://github.com/coobi7)
