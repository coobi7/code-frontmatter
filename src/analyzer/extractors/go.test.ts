import { test } from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import fs from 'node:fs';
import { extractGoExports } from './go.js';

const TEMP_DIR = path.join(process.cwd(), 'temp_test_go_extractor');

if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR);
}

test('extractGoExports should identify public func, type, var, const', async (t) => {
    const filePath = path.join(TEMP_DIR, 'test.go');
    const code = `
package main

func PublicFunc() {}
func privateFunc() {}

type PublicType struct {}
type privateType struct {}

var PublicVar = 1
var privateVar = 2

const PublicConst = "a"
const privateConst = "b"
`;
    fs.writeFileSync(filePath, code);

    const exports = await extractGoExports(filePath);
    assert.deepStrictEqual(exports.sort(), ['PublicConst', 'PublicFunc', 'PublicType', 'PublicVar']);
});

test('cleanup go tests', () => {
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
});
