import { test } from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import fs from 'node:fs';
import { extractRustExports } from './rust.js';

const TEMP_DIR = path.join(process.cwd(), 'temp_test_rust_extractor');

if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR);
}

test('extractRustExports should identify pub items', async (t) => {
    const filePath = path.join(TEMP_DIR, 'test.rs');
    const code = `
pub fn public_func() {}
fn private_func() {}

pub struct PublicStruct {}
struct PrivateStruct {}

pub enum PublicEnum {}
enum PrivateEnum {}

pub trait PublicTrait {}
trait PrivateTrait {}

pub type PublicType = i32;
type PrivateType = i32;

pub const PUBLIC_CONST: i32 = 1;
const PRIVATE_CONST: i32 = 2;
`;
    fs.writeFileSync(filePath, code);

    const exports = await extractRustExports(filePath);
    assert.deepStrictEqual(exports.sort(), ['PUBLIC_CONST', 'PublicEnum', 'PublicStruct', 'PublicTrait', 'PublicType', 'public_func']);
});

test('cleanup rust tests', () => {
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
});
