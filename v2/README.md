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

URL options: `?seed=123` replays the same shuffle and coin flip; `?autoplay` lets the AI play both sides.

**Shared with the current game, never copied:**
- **Art and assets** come from the root `assets/` folder by relative path (`../assets/…` from the page, `../../../assets/…` from `v2/src/ui/style.css`): card art, UI art, icons and VFX textures.
- **Code** from the root `src/` is imported read-only where it works cleanly. V1 imports the seeded random numbers (`src/engine/random.js`, pure), so v2 matches replay from a seed like v1's. The VFX layer (`src/ui/vfx/`) and networking (`src/net/`) will be imported the same way in V8 and V9; anything that can't be shared cleanly gets copied into `v2/` with a note here.
- v2 never changes a file outside `v2/`; the current game's tests keep passing.

To play locally: `python3 -m http.server` at the repository root, then open http://localhost:8000/v2/.

## Build log

- **V0 — setup.**
  - The current game is tagged `v1.0` (the N1-tuned build).
  - `v2/` scaffold: `index.html`, `src/engine`, `src/ai`, `src/ui`, `tests`.
  - `src/engine/rules.js` holds the numbers the design has settled: 9 lanes, the Recognition target 60, Round limit 12, the Championship from Round 10 (Claude's starting picks, to be tuned), Levels 1–6 (7 for Legendaries) with Level = Round up to the cap, the cost curve and weight classes, 40-card decks. `src/ai/opponent.js` is a stub until V1.
  - **The placeholder page** at `v2/`: "Pokémon Legends v2 — in development", in the approved look: the tabletop and leather mat, two facing rows of 9 unlit Home spaces, each player's Recognition (of 60) on the left, the side panel (Round, Championship, Energy, Trainer Points, Bag, Weather) on the right, and a fanned hand of preview cards in the full-art, minimal-stats style (Level badge, Type icon, name, ⚔/♥). A link goes back to the current game.
  - **Tests** (`v2/tests/setup.test.js`): the folders exist; every path is relative and resolves (shared assets used from the root, never copied); the engine has no DOM code; the settled numbers; the placeholder page's shape; v2 never writes files. The current game's suite still passes, unchanged.
- **V1 — v2 core.** A whole v2 match against the AI, in the approved look:
  - **Board:** each player has one row of 9 spaces; the rows face each other, making 9 lanes. Every lane is Home for now (Locations come in V2).
  - **Match flow:** a coin flip for Round 1's initiative, then Breakfast (Spent Pokémon become Active; draw up to 7; Energy = the Round number, up to 10), Battle (alternating Actions, the player with initiative first) and Supper (the hand is discarded except Retain cards). Initiative switches each Round.
  - **Energy:** no Exert, PokéDollars or XP. Up to 1 unspent Energy is stored into the next Round, shown as "4 / 6 · +1 stored". A Pass gains +1, except the second Pass in a row, which ends the Battle Phase; passing with unmatched speed makes your fastest Active Pokémon Spent, as in v1.
  - **Pokémon:** summoned into an empty space of your row, paying their cost; they arrive Spent (Quick Attack: Active). Only Alert Pokémon (Active, and of the fastest Speed among all Active Pokémon) attack. Any enemy Pokémon or the enemy player character can be attacked, except that a Physical attacker must attack a Defence Pokémon if the enemy has one, and a Special attacker a Special Defence one; Infiltrator ignores both. An Alert target hits back (a trade); both become Spent. Defeated Pokémon go to the Released Pile. 14 test Pokémon with fixed stats (no Training yet), using v1's art; one has Retain.
  - **The player character and Recognition:** each player is a target with no health. Damage to the enemy player character adds that much Recognition to the attacker's player; the first to 60 wins at once. A Recognition panel for each player, with a meter toward 60. (The Round limit and the Championship come in V2.)
  - **Screen:** Recognition panels on the left (the Opponent's glows when it can be attacked: click it to attack the player character), the facing rows on the mat with a phase strip between them, the side panel (Round, Energy, a Weather placeholder, what to do, Pass, the last log lines), the fanned hand with costs (unaffordable cards dimmed), and the Opponent's hand as card backs. Pokémon in the minimal style: Level badge, small Type icon, name, ⚔ and ♥ (red when hurt), plus Alert/Spent, guard and keyword tags.
  - **AI:** tries every legal move on a copy of the game (the same `applyAction`) and takes the best: a winning hit, defeats it survives, direct hits for Recognition, then summons. `?autoplay` lets it play both sides.
  - **Tests:** `v2/tests/core.test.js` (setup, Energy and storing, summoning, Alert and targeting with guards and Infiltrator, trades and defeats, Recognition gain, the win at 60, passing, Retain at Supper, and 12 seeded AI-vs-AI matches that all reach 60), and `setup.test.js`. Checked in the browser: a match played by clicking through 8 Rounds, and an autoplay match to its end, without errors. 40 AI-vs-AI matches average 13 Rounds.
  - **Notes:** Breakfast draws *up to* 7 (v1 draws 7 on top of kept cards). The coin flip is seeded, like v1's.
