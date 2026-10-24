import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../app.mjs';

test('only finite searches are exposed and malformed positions are rejected', async t => {
    let calls = 0;
    const engine = {
        fen() {},
        goDepth: async depth => { calls++; return { bestmove: 'e2e4', depth, score: 20 }; },
    };
    const app = createApp(engine);
    t.after(() => app.close());
    const fen = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
    assert.equal((await app.inject({ method: 'POST', url: '/ponder', payload: { fen } })).statusCode, 404);
    assert.equal((await app.inject({ method: 'DELETE', url: '/ponder' })).statusCode, 404);
    assert.equal(calls, 0);
    assert.equal((await app.inject('/?' + new URLSearchParams({ fen: 'invalid\ngo infinite', depth: 12 }))).statusCode, 400);
    const result = await app.inject('/?' + new URLSearchParams({ fen, depth: 12 }));
    assert.deepEqual(result.json(), { bestmove: 'e2e4', depth: 12, score: 20 });
    assert.equal(calls, 1);
});
