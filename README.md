# Stockfish service

`GET /?fen=<full FEN>&depth=12` evaluates a position. The existing `moves` and `time` parameters are also supported. Searches share one engine and run in order.

`POST /ponder` with JSON `{ "fen": "<predicted full FEN>" }` starts UCI pondering on the position expected after the opponent's reply. It returns immediately. Repeating the request for the same position renews a 15-second lease without restarting the search. Speculative searches are capped at depth 18.

A subsequent depth search for exactly that FEN sends `ponderhit` and stops to collect the prepared result. It returns `ponderHit: true` only if the result reached the requested minimum depth. Otherwise a normal search completes that depth. Different positions and timed searches stop pondering before starting foreground work.

`DELETE /ponder` cancels background work. Leases also expire automatically if the client disconnects or stops renewing them.

Run `npm test` for the HTTP, search coordination, and UCI protocol checks.
