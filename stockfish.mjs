import { spawn } from "node:child_process"
import path from "node:path";

const MAX_SCORE = 1_000_000_000;
const MATE_SCORE = 1_000_000;

export default class Stockfish {

    #jobResolve = null;
    #jobPromise = null;
    #jobName = null;
    #process = null;
    #inputBuffer = "";
    #score = 0;
    #depth = 0;

    start() {
        return this.#startJob("uci", () => {
            console.log("Starting stockfish process");
            this.#process = spawn(process.env.STOCKFISH_PATH || "./bin/stockfish-android-armv7");
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

    goTime(movetime) {
        this.#score = 0;
        this.#depth = 0;
        return this.#startJob("go", () => {
            this.#sendLine("go movetime " + movetime);
        });
    }

    goDepth(depth) {
        this.#score = 0;
        this.#depth = 0;
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
            if (depthIdx !== -1) {
                this.#depth = parseInt(splits[depthIdx + 1]);
            }
            const scoreIdx = splits.indexOf("score");
            if (scoreIdx !== -1) {
                if (splits[scoreIdx + 1] === "cp") {
                    this.#score = parseInt(splits[scoreIdx + 2]);
                } else if (splits[scoreIdx + 1] === "mate") {
                    const mateIn = parseInt(splits[scoreIdx + 2]);
                    // "mate 0" means the side to move is already checkmated
                    this.#score = mateIn === 0 ? -MAX_SCORE : Math.sign(mateIn) * (MAX_SCORE - Math.abs(mateIn) * MATE_SCORE);
                } else console.error("Unknown score unit:", line);
            }
        } else if (line.startsWith("bestmove ")) {
            console.log("Stockfish >>", line, "score", this.#score, "depth", this.#depth);
            this.#completeJob("go", { bestmove: line.split(" ")[1], score: this.#score, depth: this.#depth });
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