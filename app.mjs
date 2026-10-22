import Fastify from "fastify";
import { Searches } from "./searches.mjs";

export function createApp(stockfish) {
  const fastify = Fastify({ logger: false });

  const MAX_DEPTH = 30;
  const MAX_TIME = 10_000;
  // Only characters that can appear in a FEN or a UCI move list; a newline would inject UCI commands
  const FEN_PATTERN = /^[1-8pnbrqkPNBRQKwW\/ \-a-h0-9]+$/;
  const MOVES_PATTERN = /^[a-h1-8qrbn ]+$/;

  // One engine, so searches run one after another instead of interrupting each other
  const searches = new Searches(stockfish);

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

    return searches.evaluate({ fen, moves, depth, time });
  });

  fastify.post('/ponder', async (request, reply) => {
    const fen = request.body?.fen;
    if (typeof fen !== 'string' || !FEN_PATTERN.test(fen) || fen.trim().split(/\s+/).length !== 6) {
      return reply.code(400).send({ error: 'Invalid fen!' });
    }
    return searches.startPonder(fen.trim());
  });

  fastify.delete('/ponder', () => searches.stopPonder());

  return fastify;
}
