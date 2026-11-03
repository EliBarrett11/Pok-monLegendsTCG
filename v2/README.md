# Pokémon Legends v2

The next version of Elliott's card game: a match tells the story of one Trainer's career, from the first day to becoming a legend. The design lives in [`docs/v2-design.md`](../docs/v2-design.md); the approved look is [`docs/design/v2-board-concept.jpg`](../docs/design/v2-board-concept.jpg).

v2 is built here, in `v2/`, as a separate game beside the current one (v1, tagged `v1.0`, which stays live at the root and doesn't change). At launch (roadmap step V10) v2 moves to the root and v1 to `classic/`.

- **Play v2 (in development):** https://elibarrett11.github.io/Pok-monLegendsTCG/v2/
- **Play the current game:** https://elibarrett11.github.io/Pok-monLegendsTCG/

## How it's built

The same rules as the current game (the root `CLAUDE.md`): plain HTML, CSS and JavaScript modules, no build step, no npm dependencies, every path relative, so it runs on GitHub Pages straight from `main` at `…/Pok-monLegendsTCG/v2/`.

| Folder | Contents |
|---|---|
| `v2/src/engine/` | v2's rules and game state. **No DOM code.** |
| `v2/src/ai/` | The v2 AI opponent (it plays through the same engine actions as the player). |
| `v2/src/ui/` | Drawing the board and handling clicks. |
| `v2/tests/` | Tests, run with Node: `for t in v2/tests/*.test.js; do node $t; done` |

**Shared with the current game, never copied:**
- **Art and assets** come from the root `assets/` folder by relative path (`../assets/…` from the page, `../../../assets/…` from `v2/src/ui/style.css`): card art, UI art, icons and VFX textures.
- **Code** from the root `src/` is imported read-only where it works cleanly. V0 imports v1's card data (`src/engine/cardData.js`, pure data) for the preview cards. The VFX layer (`src/ui/vfx/`) and networking (`src/net/`) will be imported the same way in V8 and V9; anything that can't be shared cleanly gets copied into `v2/` with a note here.
- v2 never changes a file outside `v2/`; the current game's tests keep passing.

To play locally: `python3 -m http.server` at the repository root, then open http://localhost:8000/v2/.

## Build log

- **V0 — setup.**
  - The current game is tagged `v1.0` (the N1-tuned build).
  - `v2/` scaffold: `index.html`, `src/engine`, `src/ai`, `src/ui`, `tests`.
  - `src/engine/rules.js` holds the numbers the design has settled: 9 lanes, the Recognition target 60, Round limit 12, the Championship from Round 10 (Claude's starting picks, to be tuned), Levels 1–6 (7 for Legendaries) with Level = Round up to the cap, the cost curve and weight classes, 40-card decks. `src/ai/opponent.js` is a stub until V1.
  - **The placeholder page** at `v2/`: "Pokémon Legends v2 — in development", in the approved look: the tabletop and leather mat, two facing rows of 9 unlit Home spaces, each player's Recognition (of 60) on the left, the side panel (Round, Championship, Energy, Trainer Points, Bag, Weather) on the right, and a fanned hand of preview cards in the full-art, minimal-stats style (Level badge, Type icon, name, ⚔/♥). A link goes back to the current game.
  - **Tests** (`v2/tests/setup.test.js`): the folders exist; every path is relative and resolves (shared assets used from the root, never copied); the engine has no DOM code; the settled numbers; the placeholder page's shape; v2 never writes files. The current game's suite still passes, unchanged.
