import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../app.mjs';

test('HTTP ponder endpoints validate input, renew, consume hits and cancel', async t => {
    let done, starts = 0, stops = 0;
    const engine = {
        fen() {},
        goPonder() { starts++; return new Promise(resolve => { done = resolve; }); },
        stop() { stops++; done({ bestmove: 'g1f3', depth: 15, score: 25 }); },
        goDepth: async depth => ({ bestmove: 'e2e4', depth, score: 20 }),
    };
    const app = createApp(engine);
    t.after(() => app.close());
    for (const payload of [{}, { fen: 42 }, { fen: 'startpos\ngo infinite' }]) {
        assert.equal((await app.inject({ method: 'POST', url: '/ponder', payload })).statusCode, 400);
    }
    const fen = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
    for (let i = 0; i < 2; i++) {
        const response = await app.inject({ method: 'POST', url: '/ponder', payload: { fen } });
        assert.equal(response.statusCode, 200);
        assert.equal(response.json().pondering, true);
    }
    assert.equal(starts, 1);
    const hit = await app.inject('/?' + new URLSearchParams({ fen, depth: 12 }));
    assert.equal(hit.json().ponderHit, true);
    assert.equal(stops, 1);
    await app.inject({ method: 'POST', url: '/ponder', payload: { fen } });
    const cancelled = await app.inject({ method: 'DELETE', url: '/ponder' });
    assert.deepEqual(cancelled.json(), { pondering: false });
    assert.equal(stops, 2);
});
