import { spawn } from "node:child_process"
import path from "node:path";

const MAX_SCORE = 1_000_000_000;
const MATE_SCORE = 1_000_000;

export default class Stockfish {

    constructor({ spawnEngine = spawn } = {}) {
        this.spawnEngine = spawnEngine;
    }

    #jobResolve = null;
    #jobPromise = null;
    #jobName = null;
    #process = null;
    #inputBuffer = "";
    #score = 0;
    #depth = 0;
    #multiPv = 1;
    #variations = new Map();

    start() {
        return this.#startJob("uci", () => {
            console.log("Starting stockfish process");
            this.#process = this.spawnEngine(process.env.STOCKFISH_PATH || "./bin/stockfish-android-armv7");
            this.#process.stdout.on('data', (data) => {
                this.#inputBuffer += data;
                this.#processData();
            });

            this.#process.stderr.on('data', (data) => {
                console.error("Stockfish [ERR] >> ", data);
            });

            // Without the engine every request would hang forever, so exit and let Docker restart us
            this.#process.on('close', (code) => {
                console.error("Stockfish process exited with code", code);
                process.exit(1);
            });

            this.#sendLine("uci");
        });
    }

    moves(moves) {
        this.#sendLine("position startpos moves " + moves);
    }

    fen(fen) {
        this.#sendLine("position fen " + fen);
    }

    multiPv(count = 1) {
        if (![1, 2].includes(count)) throw Error("MultiPV must be 1 or 2");
        if (count !== this.#multiPv) this.#setOption("MultiPV", count);
        this.#multiPv = count;
    }

    goTime(movetime) {
        this.#score = 0;
        this.#depth = 0;
        this.#variations.clear();
        return this.#startJob("go", () => {
            this.#sendLine("go movetime " + movetime);
        });
    }

    goDepth(depth) {
        this.#score = 0;
        this.#depth = 0;
        this.#variations.clear();
        return this.#startJob("go", () => {
            this.#sendLine("go depth " + depth);
        });
    }

    #startJob(name, fn) {
        if (this.#jobName) throw new Error("Tried to start job " + name + " but busy with " + this.#jobName);
        this.#jobName = name;
        this.#jobPromise = new Promise(resolve => {
            this.#jobResolve = resolve;
            fn();
        });
        return this.#jobPromise;
    }

    #completeJob(name, value) {
        if (this.#jobName !== name) throw new Error("Tried to complete job " + name + " but busy with " + this.#jobName);
        const resolve = this.#jobResolve;
        this.#jobResolve = null;
        this.#jobPromise = null;
        this.#jobName = null;
        resolve(value);
    }

    #send(data) {
        this.#process.stdin.write(data);
    }

    #sendLine(data) {
        this.#send(data + "\n");
    }

    #processData() {
        if (!this.#inputBuffer) return;

        // The last element is an incomplete line (or "" when the chunk ended with a newline)
        const lines = this.#inputBuffer.split("\n");
        this.#inputBuffer = lines.pop();

        lines.forEach((line) => this.#processLine(line));
    }

    #processLine(line) {
        line = line.trim();
        if (!line) return;

        if (line === "uciok") {
            console.log("Loading Stockfish settings");
            this.#loadSettings();
            console.log("Stockfish is ready!");
            this.#completeJob("uci");
        } else if (line.startsWith("info ")) {
            const splits = line.split(" ");
            const depthIdx = splits.indexOf("depth");
            const scoreIdx = splits.indexOf("score");
            if (scoreIdx !== -1 && !splits.includes('lowerbound') && !splits.includes('upperbound')) {
                const rankIdx = splits.indexOf('multipv');
                const rank = rankIdx === -1 ? 1 : Number(splits[rankIdx + 1]);
                const depth = depthIdx === -1 ? this.#depth : Number(splits[depthIdx + 1]);
                const value = Number(splits[scoreIdx + 2]);
                const score = splits[scoreIdx + 1] === 'cp' ? value
                    : splits[scoreIdx + 1] === 'mate' ? value === 0 ? -MAX_SCORE : Math.sign(value) * (MAX_SCORE - Math.abs(value) * MATE_SCORE) : NaN;
                if (Number.isFinite(score) && Number.isInteger(depth) && rank >= 1 && rank <= this.#multiPv) {
                    if (rank === 1) { this.#score = score; this.#depth = depth; }
                    const pvIdx = splits.indexOf('pv');
                    if (pvIdx !== -1) this.#variations.set(rank, { rank, depth, score, moves: splits.slice(pvIdx + 1) });
                }
            }
        } else if (line.startsWith("bestmove ")) {
            console.log("Stockfish >>", line, "score", this.#score, "depth", this.#depth);
            const parts = line.split(/\s+/);
            const result = { bestmove: parts[1], score: this.#score, depth: this.#depth };
            if (this.#multiPv > 1) result.variations = [...this.#variations.values()].filter(pv => pv.depth === this.#depth).sort((a, b) => a.rank - b.rank);
            this.#completeJob("go", result);
        }
    }

    #setOption(name, value) {
        this.#sendLine(`setoption Name ${name} value ${value}`);
    }

    #loadSettings() {
        this.#setOption("Threads", 2);
        this.#setOption("Hash", 32);
        this.#setOption("SyzygyPath", path.resolve("./bin/syzygy"));
        this.#setOption("SyzygyProbeLimit", "5");
    }
}
