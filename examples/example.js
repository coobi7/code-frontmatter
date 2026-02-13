/*---
intent: "示例文件：展示如何在 JavaScript/TypeScript 文件中使用 Code Frontmatter 表头"
role: example
exports:
  - "greet: 返回一条欢迎消息"
  - "calculateTotal: 计算订单总价"
depends_on: []
when_to_load: "需要查看 CFM 表头在 JS 文件中的格式示例时加载"
side_effects: []
mutates_state: false
ai_notes: "这是一个纯演示文件，不包含任何实际业务逻辑"
---*/

/**
 * 返回一条欢迎消息
 * @param {string} name - 用户名
 * @returns {string} 欢迎消息
 */
export function greet(name) {
    return `你好，${name}！欢迎使用 Code Frontmatter。`;
}

/**
 * 计算订单总价
 * @param {Array<{price: number, quantity: number}>} items - 订单项
 * @returns {number} 总价
 */
export function calculateTotal(items) {
    return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}
