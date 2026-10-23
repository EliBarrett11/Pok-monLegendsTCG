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
| `docs/` | The game's rules. |
| `assets/` | Card art and other images. |

No build step: plain HTML, CSS and JavaScript modules.

## Build log

- **Step 0** — project shell: empty board, turn indicator, game log.
