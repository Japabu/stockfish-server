# Stockfish service

`GET /?fen=<full FEN>&depth=12` evaluates a position. The existing `moves` and `time` parameters are also supported. Finite searches share one engine and run in order. No speculative background searches run between requests.

Run `npm test` for the HTTP, search queue and UCI parsing checks.
