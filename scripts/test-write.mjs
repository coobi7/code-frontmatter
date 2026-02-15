/*---
intent: 测试脚本：验证 cfm_write 工具的写入功能及 cfm_read 的读取功能是否形成闭环
role: test
exports: []
depends_on:
  - ../dist/registry.js
  - ../dist/tools/write.js
  - ../dist/parser.js
when_to_load: 开发或调试 cfm_write 工具时，或者需要验证发布版本功能时运行
ai_notes: 该脚本用于验证 CFM v0.2 的核心功能。包含对 JS/Python 文件的写入测试、读取验证以及异常情况处理。
---*/

/**
 * 验证 cfm_write + cfm_read 闭环
 */
import { loadRegistry } from "../dist/registry.js";
import { writeFrontmatter } from "../dist/tools/write.js";
import { extractFrontmatter } from "../dist/parser.js";
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function test() {
    await loadRegistry();
    let passed = 0;
    let failed = 0;

    function assert(name, condition) {
        if (condition) {
            console.log(`  ✅ ${name}`);
            passed++;
        } else {
            console.log(`  ❌ ${name}`);
            failed++;
        }
    }

    // ── 测试 1: JS 文件写入 + 读取 ──
    console.log("\n📝 测试 1: JS 文件写入 + 读取");
    const testJsFile = join(__dirname, "test-write.js");
    writeFileSync(testJsFile, 'export function hello() { return "hi"; }\n');

    const writeResult = await writeFrontmatter(testJsFile, {
        intent: "测试用 JS 文件",
        role: "test",
        exports: ["hello: 返回问候语"],
    });
    assert("写入成功", writeResult.success);

    const readResult = await extractFrontmatter(testJsFile, "test-write.js");
    assert("读取到表头", readResult.frontmatter !== null);
    assert("intent 正确", readResult.frontmatter?.intent === "测试用 JS 文件");
    assert("role 正确", readResult.frontmatter?.role === "test");
    assert("exports 正确", Array.isArray(readResult.frontmatter?.exports));

    // ── 测试 2: Python 文件写入 + 读取 ──
    console.log("\n📝 测试 2: Python 文件写入 + 读取");
    const testPyFile = join(__dirname, "test-write.py");
    writeFileSync(testPyFile, 'def greet():\n    return "hello"\n');

    const pyResult = await writeFrontmatter(testPyFile, {
        intent: "测试用 Python 文件",
        role: "util",
        exports: ["greet: 返回问候语"],
        mutates_state: false,
    });
    assert("Python 写入成功", pyResult.success);

    const pyRead = await extractFrontmatter(testPyFile, "test-write.py");
    assert("Python 读取到表头", pyRead.frontmatter !== null);
    assert("Python intent 正确", pyRead.frontmatter?.intent === "测试用 Python 文件");
    assert("Python mutates_state 正确", pyRead.frontmatter?.mutates_state === false);

    // ── 测试 3: 替换已有表头 ──
    console.log("\n📝 测试 3: 替换已有表头");
    const updateResult = await writeFrontmatter(testJsFile, {
        intent: "已更新的 JS 文件",
        role: "service",
        exports: ["hello: 返回问候语", "bye: 返回告别语"],
        depends_on: ["utils.js"],
    });
    assert("更新写入成功", updateResult.success);

    const updatedRead = await extractFrontmatter(testJsFile, "test-write.js");
    assert("更新后 intent 正确", updatedRead.frontmatter?.intent === "已更新的 JS 文件");
    assert("更新后 role 正确", updatedRead.frontmatter?.role === "service");
    assert("更新后 exports 数量正确", updatedRead.frontmatter?.exports?.length === 2);
    assert("更新后 depends_on 正确", Array.isArray(updatedRead.frontmatter?.depends_on));

    // ── 测试 4: 不支持的文件类型 ──
    console.log("\n📝 测试 4: 不支持的文件类型");
    const testTxtFile = join(__dirname, "test-write.xyz123");
    writeFileSync(testTxtFile, "hello");
    const txtResult = await writeFrontmatter(testTxtFile, {
        intent: "test",
        role: "test",
        exports: [],
    });
    assert("不支持的类型返回失败", !txtResult.success);

    // 清理临时文件
    const { unlinkSync } = await import("node:fs");
    try { unlinkSync(testJsFile); } catch { }
    try { unlinkSync(testPyFile); } catch { }
    try { unlinkSync(testTxtFile); } catch { }

    // 汇总
    console.log(`\n━━━ 测试结果: ${passed} 通过, ${failed} 失败 ━━━`);
    process.exit(failed > 0 ? 1 : 0);
}

test().catch(console.error);
