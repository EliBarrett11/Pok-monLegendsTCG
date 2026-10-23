# Pokémon Legends TCG

A browser version of Elliott's custom card game, played against an AI opponent. Built from scratch one small feature at a time.

## Play

- **Online:** the GitHub Pages link for this repo (Settings → Pages).
- **Locally:** run `python3 -m http.server` in this folder and open http://localhost:8000. (Opening `index.html` directly won't work, because browsers block JS modules from `file://`.)

## Layout

| Folder | What lives there |
|---|---|
| `src/engine/` | Game rules only. No DOM, so the AI and tests use the same rules. |
| `src/ai/` | The AI opponent's decision-making. |
| `src/ui/` | Drawing the board and handling clicks. |
| `docs/rules.md` | The game's rules, written as they're settled. |
| `assets/` | Card art and other images. |

No build step: plain HTML, CSS and JavaScript modules. Working rules for each session are in `CLAUDE.md`.

## Build log

- **Step 0** — project shell: empty board, turn indicator, game log.
- **Step 1** — match setup: Battle Arena, secret Trainer placement, coin flip for initiative, Round 1 Breakfast draw and mulligan. Stops at the start of the Battle Phase.
- **Step 2** — Round loop: Rounds run continuously from Breakfast to Battle to Supper. Breakfast sets Base Energy and Exert and draws 7 (reshuffling the Discard Pile when needed). Battle turns are Pass-only; Supper discards hands. Exert/Exhaust payment logic and Trainer Strength (placeholder 15) are in, tested ahead of use.

Add `?seed=123` to the URL to replay the same shuffle and coin flip.

## Tests

```
for t in tests/*.test.js; do node $t; done
```
