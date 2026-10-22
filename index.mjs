import Stockfish from './stockfish.mjs';
import { createApp } from './app.mjs';

const stockfish = new Stockfish();
await stockfish.start();
const fastify = createApp(stockfish);
fastify.listen({ port: process.env.PORT || 3000, host: process.env.HOST || '0.0.0.0' }, (err, addr) => {
  if (err) throw new Error(err);
  console.log('Listening on', addr);
});
