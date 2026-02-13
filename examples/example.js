/*---
intent: "Example JavaScript module showcasing basic functions for greetings and order calculation"
role: example
exports:
  - "greet: Returns a welcome message"
  - "calculateTotal: Calculates total price for order items"
when_to_load: "Testing CFM parsing or as a reference for JS/TS frontmatter format"
ai_notes: "This is a clean example file with no dependencies."
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
