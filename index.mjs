import Fastify from "fastify";
import Stockfish from "./stockfish.mjs";

const stockfish = new Stockfish();
await stockfish.start();

const fastify = Fastify({ logger: false });

const MAX_DEPTH = 30;
const MAX_TIME = 10_000;
// Only characters that can appear in a FEN or a UCI move list; a newline would inject UCI commands
const FEN_PATTERN = /^[1-8pnbrqkPNBRQKwW\/ \-a-h0-9]+$/;
const MOVES_PATTERN = /^[a-h1-8qrbn ]+$/;

// One engine, so searches run one after another instead of interrupting each other
let queue = Promise.resolve();
const enqueue = job => (queue = queue.catch(() => { }).then(job));

fastify.get("/", async (request, reply) => {
  let { moves, time, fen, depth } = request.query;
  moves = (moves || "").trim().split(",").join(" ");
  time = parseInt(time);
  depth = parseInt(depth);
  fen = (fen || "").trim();

  console.log("Received request:", { time, depth, moves, fen });

  if (!moves && !fen) return reply.code(400).send({ error: "Fen or moves required!" });
  if (moves && fen) return reply.code(400).send({ error: "Fen and moves are exclusive!" });
  if (!time && !depth) return reply.code(400).send({ error: "Time or depth is required!" });
  if (time && depth) return reply.code(400).send({ error: "Time and depth are exclusive!" });
  if (fen && !FEN_PATTERN.test(fen)) return reply.code(400).send({ error: "Invalid fen!" });
  if (moves && !MOVES_PATTERN.test(moves)) return reply.code(400).send({ error: "Invalid moves!" });
  if (depth && (depth < 1 || depth > MAX_DEPTH)) return reply.code(400).send({ error: `Depth must be 1-${MAX_DEPTH}!` });
  if (time && (time < 1 || time > MAX_TIME)) return reply.code(400).send({ error: `Time must be 1-${MAX_TIME} ms!` });

  return enqueue(() => {
    if (moves) stockfish.moves(moves);
    else if (fen) stockfish.fen(fen);

    if (time) return stockfish.goTime(time);
    return stockfish.goDepth(depth);
  });
});

fastify.listen({ port: process.env.PORT || 3000, host: process.env.HOST || "0.0.0.0" }, (err, addr) => {
  if (err) throw new Error(err);
  console.log("Listening on", addr);
});
