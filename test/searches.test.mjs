import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Searches } from '../searches.mjs';

function setup(options) {
    const calls = [];
    let resolve;
    const engine = {
        fen: fen => calls.push(['fen', fen]),
        moves: moves => calls.push(['moves', moves]),
        goPonder(depth) {
            calls.push(['ponder', depth]);
            return new Promise(done => { resolve = done; });
        },
        stop(hit) { calls.push(['stop', hit]); resolve(engine.prepared); },
        goDepth: async depth => { calls.push(['search', depth]); return { bestmove: 'd2d4', score: 15, depth }; },
        goTime: async time => { calls.push(['time', time]); return { bestmove: 'e2e4', score: 15, depth: 12 }; },
        prepared: { bestmove: 'g1f3', ponder: 'd7d5', score: 25, depth: 16 },
    };
    const searches = new Searches(engine, options);
    return { engine, calls, searches };
}

test('a ponder hit reuses a deep result and never starts another search', async t => {
    const { searches, calls } = setup();
    t.after(() => searches.stopPonder());
    await searches.startPonder('expected');
    const result = await searches.evaluate({ fen: 'expected', depth: 12 });
    assert.equal(result.ponderHit, true);
    assert.equal(result.depth, 16);
    assert.equal(result.bestmove, 'g1f3');
    assert.deepEqual(calls, [['fen', 'expected'], ['ponder', 18], ['stop', true]]);
});

test('a miss stops speculation before searching the actual board', async t => {
    const { searches, calls } = setup();
    t.after(() => searches.stopPonder());
    await searches.startPonder('expected');
    const result = await searches.evaluate({ fen: 'actual', depth: 12 });
    assert.equal(result.ponderHit, undefined);
    assert.deepEqual(calls.slice(2), [['stop', false], ['fen', 'actual'], ['search', 12]]);
});

test('an unfinished shallow ponder cannot bypass the requested minimum depth', async t => {
    const { searches, engine, calls } = setup();
    t.after(() => searches.stopPonder());
    engine.prepared.depth = 4;
    await searches.startPonder('expected');
    const result = await searches.evaluate({ fen: 'expected', depth: 12 });
    assert.equal(result.depth, 12);
    assert.deepEqual(calls.slice(2), [['stop', true], ['fen', 'expected'], ['search', 12]]);
});

test('renewing the same position does not restart the engine; cancellation frees it', async () => {
    const { searches, calls } = setup();
    await searches.startPonder('expected');
    await searches.startPonder('expected');
    assert.equal(calls.filter(([name]) => name === 'ponder').length, 1);
    await searches.stopPonder();
    await searches.stopPonder();
    assert.equal(calls.filter(([name]) => name === 'stop').length, 1);
});

test('an abandoned lease expires, but a renewed lease remains active', async t => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const { searches, calls } = setup({ leaseMs: 15000 });
    t.after(() => searches.stopPonder());
    await searches.startPonder('expected');
    t.mock.timers.tick(10000);
    await searches.startPonder('expected');
    t.mock.timers.tick(10000); await searches.queue;
    assert.equal(calls.filter(([name]) => name === 'stop').length, 0);
    t.mock.timers.tick(5000); await searches.queue;
    assert.deepEqual(calls.at(-1), ['stop', false]);
    assert.equal(searches.ponder, null);
});

test('changing the prediction stops the previous search and timed searches preempt pondering', async () => {
    const { searches, calls } = setup();
    await searches.startPonder('old');
    await searches.startPonder('new');
    await searches.evaluate({ fen: 'new', time: 100 });
    assert.deepEqual(calls, [['fen', 'old'], ['ponder', 18], ['stop', false], ['fen', 'new'],
        ['ponder', 18], ['stop', false], ['fen', 'new'], ['time', 100]]);
});
