import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Searches } from '../searches.mjs';

test('finite searches run sequentially and do no work between requests', async () => {
    const calls = [];
    let finish;
    const engine = {
        fen: value => calls.push(['fen', value]),
        moves: value => calls.push(['moves', value]),
        goDepth: depth => { calls.push(['depth', depth]); return new Promise(resolve => { finish = resolve; }); },
        goTime: async time => { calls.push(['time', time]); return { bestmove: 'e2e4', score: 20, depth: 8 }; },
    };
    const searches = new Searches(engine);
    assert.deepEqual(calls, []);
    const first = searches.evaluate({ fen: 'first', depth: 12 });
    const second = searches.evaluate({ moves: 'e2e4', time: 100 });
    await new Promise(setImmediate);
    assert.deepEqual(calls, [['fen', 'first'], ['depth', 12]]);
    finish({ bestmove: 'g1f3', score: 25, depth: 12 });
    await Promise.all([first, second]);
    assert.deepEqual(calls, [['fen', 'first'], ['depth', 12], ['moves', 'e2e4'], ['time', 100]]);
    await new Promise(setImmediate);
    assert.equal(calls.length, 4);
});

test('a failed search does not block later foreground work', async () => {
    let calls = 0;
    const searches = new Searches({ fen() {}, goDepth: async depth => {
        if (calls++ === 0) throw Error('temporary failure');
        return { bestmove: 'g1f3', depth, score: 25 };
    } });
    await assert.rejects(searches.evaluate({ fen: 'first', depth: 8 }), /temporary failure/);
    assert.equal((await searches.evaluate({ fen: 'second', depth: 12 })).depth, 12);
});
