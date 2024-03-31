import Fastify from "fastify";
import Stockfish from "./stockfish.mjs";

const stockfish = new Stockfish();
await stockfish.start();

const fastify = Fastify({ logger: false });

const queue = [];

fastify.get("/", async (request, reply) => {
  let { moves, time, fen } = request.query;
  moves = (moves || "").trim().split(",").join(" ");
  time = parseInt(time);
  fen = (fen || "").trim();

  console.log("Received request:", { time, moves, fen });

  if (!moves && !fen) return reply.code(400).send({ error: "Fen or moves required!" });
  if (moves && fen) return reply.code(400).send({ error: "Fen and moves are exclusive!" });
  if (!time) return reply.code(400).send({ error: "Time is required!" });

  await stockfish.makeReady();

  if (moves) stockfish.moves(moves);
  else if (fen) stockfish.fen(fen);

  return stockfish.go(parseInt(time));
});

fastify.listen({ port: process.env.PORT || 3000 }, (err, addr) => {
  if (err) throw new Error(err);
  console.log("Listening on", addr);
});
