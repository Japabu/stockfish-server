import Fastify from "fastify";
import Stockfish from "./stockfish.mjs";

const stockfish = new Stockfish();
await stockfish.start();

const fastify = Fastify({ logger: false });

const queue = [];

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

  await stockfish.makeReady();

  if (moves) stockfish.moves(moves);
  else if (fen) stockfish.fen(fen);

  if (time) return stockfish.goTime(time);
  return stockfish.goDepth(depth);
});

fastify.listen({ port: process.env.PORT || 3000, host: process.env.HOST || "0.0.0.0" }, (err, addr) => {
  if (err) throw new Error(err);
  console.log("Listening on", addr);
});
