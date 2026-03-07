import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { getEncoding } from "js-tiktoken";
import { resolve } from "path";

async function run() {
    console.log("启动 MCP 客户端连接...");
    const transport = new StdioClientTransport({
        command: "node",
        args: [resolve("dist/index.js")]
    });

    // 初始化客户端
    const client = new Client({ name: "ai-tester", version: "1.0.0" }, { capabilities: {} });
    await client.connect(transport);
    console.log("客户端连接成功！");

    // 实例化 tiktoken
    const enc = getEncoding('cl100k_base');

    let totalToolTokens = 0;

    try {
        // 请求工具列表
        console.log("正在请求 tools/list...");
        const toolsResult = await client.listTools();

        console.log("\n====== 工具 (Tools) Token 消耗测试 ======");
        for (const tool of toolsResult.tools) {
            const tStr = JSON.stringify(tool, null, 2);
            const tokens = enc.encode(tStr).length;
            totalToolTokens += tokens;
            console.log(`- ${tool.name}: ${tokens} tokens (约 ${tStr.length} 字符)`);
        }
        console.log(`\n全部 Tools 总消耗: ${totalToolTokens} tokens`);

        // 请求资源列表
        console.log("\n正在请求 resources/list...");
        const resourcesResult = await client.listResources();

        console.log("\n====== 资源 (Resources) Token 消耗测试 ======");
        let totalResourceTokens = 0;
        for (const res of resourcesResult.resources) {
            const rStr = JSON.stringify(res, null, 2);
            const tokens = enc.encode(rStr).length;
            totalResourceTokens += tokens;
            console.log(`- ${res.name}: ${tokens} tokens (约 ${rStr.length} 字符)`);
        }
        console.log(`全部 Resources 总消耗: ${totalResourceTokens} tokens`);

        console.log(`\n====== 最终总消耗 ======`);
        const allData = JSON.stringify({ tools: toolsResult.tools, resources: resourcesResult.resources }, null, 2);
        const allTokens = enc.encode(allData).length;
        console.log(`初始化时系统理解 MCP 的数据总 Token: ${allTokens}`);
        console.log(`按照 Claude 偏向可能会有多出 5-10% 的计算量。当前用 OpenAI 的 cl100k_base 编码器测算。`);

    } catch (e) {
        console.error("测试过程出错：", e);
    } finally {
        await client.close();
        process.exit(0);
    }
}

run();
