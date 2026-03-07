import { test } from 'node:test';
import assert from 'node:assert';
import { matchesQuery } from './search.js';
import type { CfmEntry } from '../schema.js';

test('matchesQuery should handle multi-word AND searches', () => {
    const entry: CfmEntry = {
        file: '/test/auth.ts',
        language: 'typescript',
        frontmatter: {
            intent: '用户认证和权限管理',
            role: 'service',
            exports: ['login', 'logout'],
            domain: 'authentication'
        }
    };

    // Single word matches
    console.log("Keyword:", '认证', "Result:", matchesQuery(entry, { keyword: '认证' }));
    assert.strictEqual(matchesQuery(entry, { keyword: '认证' }), true);
    assert.strictEqual(matchesQuery(entry, { keyword: 'auth' }), true);

    // Multi-word matches (AND logic)
    assert.strictEqual(matchesQuery(entry, { keyword: '用户 权限' }), true);
    assert.strictEqual(matchesQuery(entry, { keyword: 'auth.ts login' }), true);

    // Multi-word not matching (one word missing)
    assert.strictEqual(matchesQuery(entry, { keyword: '用户 数据库' }), false);

    // Case insensitivity
    assert.strictEqual(matchesQuery(entry, { keyword: 'Auth.ts LOGIN' }), true);

    // Empty query matches
    assert.strictEqual(matchesQuery(entry, {}), true);
});
