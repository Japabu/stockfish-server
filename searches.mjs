// Every command uses the same queue, but starting a ponder does not hold it until the search ends.
// Foreground work can therefore stop speculative work before touching the single engine.
export class Searches {
    constructor(engine, { leaseMs = 15000, ponderDepth = 18 } = {}) {
        this.engine = engine;
        this.leaseMs = leaseMs;
        this.ponderDepth = ponderDepth;
        this.queue = Promise.resolve();
        this.ponder = null;
    }

    enqueue(job) {
        return (this.queue = this.queue.catch(() => {}).then(job));
    }

    async stop(hit = false) {
        const ponder = this.ponder;
        if (!ponder) return null;
        this.ponder = null;
        clearTimeout(ponder.timer);
        this.engine.stop(hit);
        return ponder.result;
    }

    renew(ponder) {
        clearTimeout(ponder.timer);
        ponder.timer = setTimeout(() => {
            void this.enqueue(() => this.ponder === ponder ? this.stop() : null)
                .catch(error => console.error('Ponder expiry failed:', error));
        }, this.leaseMs);
        ponder.timer.unref?.();
    }

    startPonder(fen) {
        return this.enqueue(async () => {
            if (this.ponder?.fen !== fen) {
                await this.stop();
                this.engine.fen(fen);
                this.ponder = { fen, result: this.engine.goPonder(this.ponderDepth) };
            }
            this.renew(this.ponder);
            return { pondering: true, depth: this.ponderDepth };
        });
    }

    stopPonder() {
        return this.enqueue(async () => { await this.stop(); return { pondering: false }; });
    }

    evaluate({ fen, moves, depth, time }) {
        return this.enqueue(async () => {
            const hit = !!fen && !time && this.ponder?.fen === fen;
            const prepared = await this.stop(hit);
            if (hit && prepared?.depth >= depth) {
                console.log('Ponder hit:', { fen, depth: prepared.depth });
                return { ...prepared, ponderHit: true };
            }
            if (moves) this.engine.moves(moves);
            else this.engine.fen(fen);
            return time ? this.engine.goTime(time) : this.engine.goDepth(depth);
        });
    }
}
