import { test } from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import fs from 'node:fs';
import { extractPythonExports } from './python.js';

const TEMP_DIR = path.join(process.cwd(), 'temp_test_python_extractor');

if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR);
}

test('extractPythonExports should identify public defs, classes, and constants', async (t) => {
    const filePath = path.join(TEMP_DIR, 'test.py');
    const code = `
def public_func(a, b):
    pass

def _private_func():
    pass

class PublicClass:
    pass

class _PrivateClass:
    pass

CONSTANT_VAR = 42
_PRIVATE_CONST = 1

async def async_public():
    pass

async def _async_private():
    pass
`;
    fs.writeFileSync(filePath, code);

    const exports = await extractPythonExports(filePath);
    assert.deepStrictEqual(exports.sort(), ['CONSTANT_VAR', 'PublicClass', 'async_public', 'public_func']);
});

test('cleanup python tests', () => {
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
});
