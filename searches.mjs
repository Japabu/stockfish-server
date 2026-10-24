// One engine handles finite searches sequentially; failures cannot poison later requests.
export class Searches {
    constructor(engine) {
        this.engine = engine;
        this.queue = Promise.resolve();
    }

    evaluate({ fen, moves, depth, time, multipv = 1 }) {
        return (this.queue = this.queue.catch(() => {}).then(() => {
            this.engine.multiPv?.(multipv);
            if (moves) this.engine.moves(moves);
            else this.engine.fen(fen);
            return time ? this.engine.goTime(time) : this.engine.goDepth(depth);
        }));
    }
}
