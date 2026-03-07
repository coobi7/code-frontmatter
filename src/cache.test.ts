import { test } from 'node:test';
import assert from 'node:assert';
import { CfmCache } from './cache.js';
import type { CfmEntry } from './schema.js';

test('CfmCache basic usage', () => {
    const cache = new CfmCache();
    assert.strictEqual(cache.isRootChanged('/test/dir'), true);

    cache.clear('/test/dir');
    assert.strictEqual(cache.isRootChanged('/test/dir'), false);

    const dummyEntry: CfmEntry = { file: 'a.ts', language: 'typescript', frontmatter: null };
    cache.set('a.ts', { entry: dummyEntry, mtimeMs: 12345 });

    assert.strictEqual(cache.get('a.ts')?.mtimeMs, 12345);

    cache.invalidate('a.ts');
    assert.strictEqual(cache.get('a.ts'), undefined);

    cache.set('a.ts', { entry: dummyEntry, mtimeMs: 12345 });
    cache.clear('/new/dir');
    assert.strictEqual(cache.isRootChanged('/test/dir'), true);
    assert.strictEqual(cache.get('a.ts'), undefined);
});
