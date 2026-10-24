# Stockfish service

`GET /?fen=<full FEN>&depth=12` evaluates a position. The existing `moves` and `time` parameters are also supported. Finite searches share one engine and run in order. No speculative background searches run between requests.

Run `npm test` for the HTTP, search queue and UCI parsing checks.

`multipv=2` optionally returns the two best principal variations (`rank`, `depth`, `score`, `moves`). It is used for candidate brilliant-move verification. Only exact scores at the top line's completed depth are returned; ordinary requests keep the original response and reset MultiPV to 1. All searches are still finite and sequential.
