# Contributing to Code Frontmatter

First off, thanks for taking the time to contribute! 🎉

We welcome contributions of all kinds: bug fixes, feature implementations, documentation improvements, and more.
Following these guidelines helps to communicate that you respect the time of the developers managing and developing this open source project.

## How to Contribute

### 1. Reporting Bugs

This section guides you through submitting a bug report for Code Frontmatter. Following these guidelines helps maintainers and the community understand your report, reproduce the behavior, and find related reports.

- **Check existing issues**: Before creating a new issue, please search the issue tracker to see if the problem has already been reported.
- **Use the template**: When creating a bug report, please fill out the required template.

### 2. Suggesting Enhancements

This section guides you through submitting an enhancement suggestion for Code Frontmatter, including completely new features and minor improvements to existing functionality.

- **Use the template**: When creating an enhancement suggestion, please fill out the required template.
- **Be specific**: Provide a clear explanation of *why* this enhancement would be useful.

### 3. Your First Code Contribution

Unsure where to begin contributing to Code Frontmatter? You can start by looking through these issue tags:
- `good first issue`: Issues strictly curated for newcomers.
- `help wanted`: Issues which need extra attention.

### 4. Pull Requests

The process described here has several goals:
- Maintain Code Frontmatter's quality
- Fix problems that are important to users
- Engage the community in working toward the best possible Code Frontmatter

**Follow these steps:**

1.  **Fork the repository** and clone it locally.
2.  **Create a branch** for your edits.
3.  **Make changes**:
    - Ensure your code follows the existing style.
    - Add tests for any new functionality.
    - Ensure all tests pass.
4.  **Commit your changes**:
    - Use clear and meaningful commit messages.
    - Example: `feat: add support for Ruby files` or `fix: resolve crash on empty header`.
5.  **Push to your fork** and submit a Pull Request.
6.  **Wait for review**: We try to review PRs as quickly as possible.

## Development Setup

1.  **Clone the repo**:
    ```bash
    git clone https://github.com/coobi7/code-frontmatter.git
    cd code-frontmatter
    ```
2.  **Install dependencies**:
    ```bash
    npm install
    ```
3.  **Build the project**:
    ```bash
    npm run build
    ```
4.  **Run locally**:
    You can test changes by running the built script:
    ```bash
    node dist/index.js
    ```

## Styleguides

### Git Commit Messages

- Use the present tense ("Add feature" not "Added feature")
- Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
- Limit the first line to 72 characters or less
- Reference issues and pull requests liberally after the first line

### TypeScript Styleguide

- Use `camelCase` for variables and functions.
- Use `PascalCase` for classes and interfaces.
- Prefer `const` over `let`.
- Add type annotations where inference doesn't work.

Thanks! ❤️
