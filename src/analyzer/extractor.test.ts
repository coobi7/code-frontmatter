import { test } from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import fs from 'node:fs';
import { extractExports } from './extractor.js';

const TEMP_DIR = path.join(process.cwd(), 'temp_test_analyzer');

if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR);
}

test('extractExports should identify named exports', async (t) => {
    const filePath = path.join(TEMP_DIR, 'named.ts');
    const code = `
    export const a = 1;
    export function b() {}
    export class C {}
    export interface D {}
    type E = string;
    export { E };
  `;
    fs.writeFileSync(filePath, code);

    const exports = await extractExports(filePath);
    assert.deepStrictEqual(exports.sort(), ['C', 'D', 'E', 'a', 'b']);
});

test('extractExports should identify default export', async (t) => {
    const filePath = path.join(TEMP_DIR, 'default.ts');
    const code = `
    export default function() {}
  `;
    fs.writeFileSync(filePath, code);

    const exports = await extractExports(filePath);
    assert.ok(exports.includes('default'));
});

test('extractExports should identify aliased exports', async (t) => {
    const filePath = path.join(TEMP_DIR, 'aliased.ts');
    const code = `
    const secret = 123;
    export { secret as publicName };
  `;
    fs.writeFileSync(filePath, code);

    const exports = await extractExports(filePath);
    assert.ok(exports.includes('publicName'));
    assert.ok(!exports.includes('secret'));
});

test('cleanup', () => {
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
});
