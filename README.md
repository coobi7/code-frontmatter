---
intent: "README for Code Frontmatter project"
role: documentation
when_to_load: "Initial project setup or understanding CFM usage"
---

# Code Frontmatter (CFM)

> **"Identity Cards" for your code files.**  
> **Let AI understand your entire project without reading every single line.**

---

Code Frontmatter (CFM) is an open standard and MCP (Model Context Protocol) Server that allows you to embed structured metadata (YAML) at the top of every source code file.

By scanning these lightweight headers, AI coding assistants (like Cursor, Windsurf, Claude Code) can build a cognitive map of your entire project with **minimal token cost**, eliminating hallucinations caused by context overload.

## 🚀 Why CFM?

| Feature | Without CFM | With CFM |
|---|---|---|
| **Context Load** | Full project files (huge tokens) | Just headers (~5% tokens) |
| **Accuracy** | High hallucination risk | Deterministic file intent |
| **Cost** | $$$ Expensive API calls | $ Cheap & Efficient |
| **Scale** | Fails on large repos | Works on 10k+ file repos |

## 📦 Installation

To use CFM with your AI IDE (Cursor, Claude Desktop, etc.), install it as an MCP Server:

```bash
npx -y code-frontmatter
```

### Configuration

#### For Cursor (`~/.cursor/mcp.json`)
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

#### For Claude Desktop
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

## 🛠 Usage

### 1. Add Frontmatter to Your Code

Add a CFM header to the top of your files using your language's comment syntax.

**JavaScript / TypeScript:**
```javascript
/*---
intent: "Manages user authentication state and login logic"
role: service
exports:
  - "login: Authenticate user with email/pass"
  - "logout: Clear session"
depends_on: ["api-client.ts", "store.ts"]
when_to_load: "Modifying auth flow or session handling"
---*/

export function login(email, password) { ... }
```

**Python:**
```python
#---
# intent: "Data model for User entity"
# role: model
# exports:
#   - "User: Standard user class"
# mutates_state: false
#---

class User: ...
```

### 2. Available Tools

The MCP Server exposes the following tools to your AI assistant:

- **`cfm_read(directory)`**: Scans your project and returns a structured index of all CFM headers.
- **`cfm_search(query)`**: Search for files by keyword, role, or domain without reading full contents.
- **`cfm_register_language(name, config)`**: Teach CFM how to parse headers for a new language on the fly.

## 📋 Schema

A valid CFM header requires at least:
- **`intent`**: What is this file for? (String)
- **`role`**: What is its architectural role? (String, e.g., `component`, `service`, `util`)
- **`exports`**: What key things does it export? (Array of Strings)

Optional fields: `depends_on`, `when_to_load`, `side_effects`, `mutates_state`, `domain`, `ai_notes`.

## 🤝 Contributing

We welcome contributions! Please follow the standard GitHub workflow.

## 📄 License

MIT © 2026 coobi7
