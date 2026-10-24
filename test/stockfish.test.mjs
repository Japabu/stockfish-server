import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import Stockfish from '../stockfish.mjs';

test('UCI finite searches track scored depth and preserve terminal results', async () => {
    const commands = [];
    const child = new EventEmitter();
    child.stdout = new EventEmitter(); child.stderr = new EventEmitter();
    child.stdin = { write: line => commands.push(line.trim()) };
    const engine = new Stockfish({ spawnEngine: () => child });
    const starting = engine.start();
    child.stdout.emit('data', 'uciok\n'); await starting;
    assert.equal(commands.includes('setoption Name Ponder value true'), false);
    const pending = engine.goDepth(12);
    assert.equal(commands.at(-1), 'go depth 12');
    child.stdout.emit('data', 'info depth 14 score cp 23 pv g1f3 d7d5\ninfo depth 15 currmove d2d4\n');
    child.stdout.emit('data', 'bestmove g1f3 ponder d7d5\n');
    assert.deepEqual(await pending, { bestmove: 'g1f3', score: 23, depth: 14 });
    const terminal = engine.goDepth(12);
    child.stdout.emit('data', 'info depth 0 score mate 0\nbestmove (none)\n');
    assert.deepEqual(await terminal, { bestmove: '(none)', score: -1_000_000_000, depth: 0 });
});
