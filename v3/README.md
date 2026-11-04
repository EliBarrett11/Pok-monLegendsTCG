# Pokémon Legends v3

v3 starts fresh. `docs/v3-foundations.md` is its only spec: nothing from v1 or v2 carries over unless it says so. v1 (the root) and v2 (`v2/`) stay as they are.

- **Play v3 (in development):** https://elibarrett11.github.io/Pok-monLegendsTCG/v3/
- Concept images: `docs/design/v3-concept-R1.jpg`, `-R2.jpg`, `-R6.jpg`.

## How it's built

Plain HTML, CSS and JavaScript modules: no build step, no npm dependencies, relative paths only. It runs on GitHub Pages at `…/Pok-monLegendsTCG/v3/`.

| Folder | Contents |
|---|---|
| `v3/src/rules.js` | Every number, in one place, to tune |
| `v3/src/engine/` | Rules and game state (`game.js`), keywords (`keywords.js`), the test cards (`cards.js`), the Locations (`locations.js`). **No DOM code.** |
| `v3/src/ai/` | The AI: it plays only through `applyAction` |
| `v3/src/ui/` | Drawing the match and handling clicks; coded icons |
| `v3/tests/` | `for t in v3/tests/*.test.js; do node $t; done` |
| `v3/tools/` | `node v3/tools/matches.js [n]` (AI-vs-AI report); `node v3/tools/layout.mjs` (the nothing-clipped check, run after every v3 step); `node v3/tools/stamp.mjs` (cache-busting: run before every commit) |

- **Shared with the other versions:** only the art in the root `assets/`, by relative path.
- **Copied code (simple, noted in the files):**
  - `v3/src/engine/random.js` (the seeded random numbers from `src/engine/random.js`);
  - `v3/tools/layout.mjs` (v2's layout check, with v3's screens).
- **URL options:**
  - `?seed=123` replays the same match;
  - `?autoplay` lets the AI play both sides;
  - `?debug` exposes `window.__v3` for checks.
- **To play locally:** `python3 -m http.server` at the repository root, then open http://localhost:8000/v3/.

## Build log

- **V3-0 — the first playable v3.** You against a basic AI, with generic test cards.
  - **The board:**
    - 10 spaces per side, in two facing rows.
    - Pallet Town (2 lanes) starts on spaces 1–2.
    - Each player's portrait frames its space, with a Recognition medal.
    - The Trophy (the Pokémon League) waits on space 10.
    - Spaces with no Location are closed: nothing can be summoned there.
  - **The treadmill** (Elliott's ruling, recorded in `docs/v3-foundations.md`):
    - From Round 2, a new Location (1–3 lanes) arrives every Breakfast at the right end of the Locations.
    - The board grows until all 10 spaces are covered. From then on, each new Location pushes the others left by its width.
    - Locations falling off the left are removed, and their completion rewards are given then.
    - Pokémon and portraits never move.
    - **Six test Locations:**
      - Viridian Forest: each Move you play brings a Wild Bug onto your side there.
      - Pokémon Center: your Pokémon there heal fully at Supper.
      - Cerulean Cape, Mt. Ember, Lake of Rage and Floaroma Meadow.
      - Each has an objective that belongs to it, milestones (rewards at once) and a completion reward (given as it leaves).
  - **Recognition and the race:**
    - **Sources:** +2 at each Breakfast, +2 for defeating a Pokémon, and 1 per damage to the enemy player. Running out of cards gives the opponent 3, then 6, then 9….
    - **Portraits:** one space right per 10 Recognition, never past the furthest open space.
    - **The Trophy:** 100 Recognition reaches it and wins.
    - **The Regional Championship:** otherwise it arrives as the 10th Location over every space. At its end (2 Rounds) the higher Recognition is crowned Champion.
  - **Rounds:**
    - **Breakfast:** Energy = the Round number (cap 10), and draw 2. Round 1 is different: draw 6, then a mulligan whose cards shuffle back into the deck.
    - **Battle:** alternating turns, with Pass for +1 Energy.
    - **Supper:** no discard.
    - **Hand and deck:** 40-card decks, hand limit 10 (cards drawn beyond it are lost), and unused cards are kept.
  - **Overexert:** once per Round, take up to 2 Energy you don't have; at the next Breakfast you get that much less, plus 1. The Energy tile shows the +1 / +2 buttons and, once used, "Overexerted: −3 next Breakfast" in red.
  - **Pokémon:**
    - **Levels:** generic series with Levels 1–6. Off the board, a card's Level = the Round number up to its cap; it is frozen when played.
    - **Cost bands:** Light 0–5, Medium 1–6, Heavy 2–7.
    - **On the board:** one Pokémon per space, and each arrives Spent.
    - **Ready:** only Pokémon of the highest Speed among all Active Pokémon on both sides are Ready and can attack. They glow, gently animated, on both sides.
    - **Passing:** passing with an unmatched Speed makes your fastest Active Pokémon Spent.
    - **Trades:** a Ready target hits back.
    - **Guards:** Defence and Special Defence guards protect your other Pokémon in the same Location.
    - **Portrait protection:** your player character is protected only by your Pokémon on your portrait's space.
    - **Defeated** Pokémon go to the Released Pile.
  - **Cards** (`v3/src/engine/cards.js`, existing art as placeholders):
    - **10 Pokémon series**, covering Light, Medium and Heavy, every Speed-Tier, Physical and Special, and both guards: Swift Striker, Ember Pup, Sprout, Shell Guard, Mist Warden, River Runner, Storm Wing, Iron Brute, Flame Titan and Rock Hound.
    - **4 Moves** with breakpoints, each higher one better value: Quick Strike (damage), Patch Up (heal), Study (draw) and Show Off (Recognition).
    - **2 Supporters** with a Release cost and a Favour: Professor and Rival.
    - **The deck:** one 40-card test deck for both players.
  - **The look:** v2's approved look and the v3 concept images.
    - A prompt bar saying what you can do.
    - Location tiles with their midline panels: objective, both progress bars with milestone ticks, rewards. A "New" tag marks the newest.
    - Board Pokémon show their art, ⚔ Attack, the Speed-Tier icon (one, two or three chevrons) and ♥ Strength.
    - The side panel holds Round with a Championship countdown, the Energy tile with crystals and Overexert, Pass, both players' piles and the log.
    - Hand cards show cost, Level and cap, type line, text and stats.
    - All icons are coded.
  - **The AI** (`v3/src/ai/ai.js`): it tries each legal move one step ahead and plays the best, including Overexert when it pays for a play.
  - **Nothing clipped:** `node v3/tools/layout.mjs` reports `layout: ok` at 1920×1080, 1366×768 and 1280×720. It covers the mulligan, Round 1, a mid-match board, a full hand, choosing a space, choosing an attack target, a Move's breakpoints and its target, a Supporter's Release, the Overexerted Energy tile, the Championship and the end screen.
  - **Tests** (`v3/tests`):
    - `setup.test.js`: v3 stands alone (imports only from v3, no DOM code in the engine, relative paths, art present, coded icons).
    - `rules.test.js` covers:
      - setup and the mulligan;
      - the treadmill (widths, filling, shifting, removal with completion rewards, Pokémon staying put);
      - closed spaces;
      - Recognition and portrait movement, and winning at 100;
      - the Regional Championship, including a tie;
      - Energy and Overexert;
      - the hand limit and deck-out;
      - Levels and cost bands;
      - Ready, guards, portrait protection, trades and passing with unmatched Speed;
      - Supporters and Favour.
    - `ai.test.js`: every AI move is legal, and 40 AI-vs-AI matches finish.
    - v1 and v2 are untouched: no file outside `v3/` changed except the new section in `docs/v3-foundations.md`.
  - **AI-vs-AI report** (`node v3/tools/matches.js 100`):
    - All 100 matches finish, averaging **10.19 Rounds** (Round 8: 1, Round 9: 14, Round 10: 50, Round 11: 35).
    - **How they end:**
      - the Trophy before the Championship: 15;
      - the Trophy during the Championship: 74;
      - crowned at the Championship's end: 11;
      - draws: 0.
    - The player with initiative in Round 1 won 53, the other 47.
    - Per match: an average final Recognition of 87, 95 actions, 12 Overexerts and no deck-outs.
  - **Placeholders to confirm with Elliott:** listed in `docs/v3-foundations.md` ("Settled 4 Nov (V3-0)").
  - **Screenshots** (`v3/screenshots/`): `v3-0-round1.jpg`, `v3-0-round2.jpg`, `v3-0-board.jpg` (Round 6), `v3-0-attack.jpg`, `v3-0-overexerted.jpg`, `v3-0-championship.jpg`, `v3-0-game-over.jpg`.

- **V3-1 — Elliott's changes to V3-0** (`docs/v3-foundations.md`, "Settled 4 Nov (late night)").
  - **The treadmill, revised:**
    - From Round 2, at the start of each Round every Location moves one space left, so the leftmost shrinks by a lane. It's removed when no lanes are left, and its completion rewards are given then.
    - Pokémon and portraits never move.
    - A new Location then arrives on the right if one fits the free spaces there. The game picks the widest that fits, at random among those and preferring one not already on the board, so the board fills its 10 spaces and stays full.
    - If none fits, it waits; for example, only 3-lane Locations in line and 1–2 free spaces.
    - **Consequence:** once the board is full, one space frees each Round, so only 1-lane Locations arrive from then on.
  - **The Regional Championship:** still the 10th Location if no one has reached the Trophy, covering every space. The shrinking treadmill never clears the board, so it arrives as soon as it's due (Round 10) over all 10 spaces; the remaining Locations leave and pay their completion rewards. It lasts 2 Rounds, then the higher Recognition is crowned.
  - **Locations** (`v3/src/engine/locations.js`): named for their v1/v2 art.
    - Pallet Town (2 lanes).
    - Eterna Forest (3; wild Pokémon: each Move you play brings a Wild Sewaddle).
    - Shalour City (1; its Pokémon Center heals your Pokémon there fully at Supper).
    - Cerulean Cape (2), Mt. Ember (3), Lake of Rage (2), Floaroma Meadow (1), Route 119 (2) and Petalburg Woods (1).
    - The Regional Championship at Stark Mountain.
  - **Cards** (`v3/src/engine/cards.js`): actual v1/v2 Pokémon, Moves and Supporters, with their names, art, stats and series. Each Pokémon's Level picks its stage, so Squirtle becomes Wartortle at Level 3 and Blastoise at 5. Bands come from v2's weights: light → Light, standard → Medium, heavy → Heavy.
    - **New in the engine for them:**
      - keywords: Quick Attack, Infiltrator, Overrun, Rage, Shell N, Regenerate N;
      - abilities: On Summon, On Attack, On Defend, Rally;
      - "this Round" and "until your next Breakfast" buffs;
      - effects with two targets, or a chosen Location (click its panel).
    - **The test deck** (both players; 40 cards):

      | Card | Copies | Type | Band, Speed, attack | What it keeps | Dropped |
      |---|---|---|---|---|---|
      | Growlithe → Arcanine | 3 | Fire | Medium, Swift, Physical | Arcanine: Infiltrator, Overrun | Scorch (Burn); Empowered summon |
      | Ponyta → Rapidash | 3 | Fire | Light, Swift, Physical | Quick Attack; Rapidash: Infiltrator | Level 6's "the enemy player gains Burn 1" |
      | Mankey → Primeape | 2 | Fighting | Light, Swift, Physical | Overrun; Primeape: Infiltrator, Rage | — |
      | Magby → Magmar → Magmortar | 2 | Fire | Heavy, Steady, Special | Magmortar: On Attack, 1 damage to each other enemy Pokémon in its Location | Scorch |
      | Duskull → Dusclops | 2 | Ghost | Heavy, Slow, Special, Special Defence guard | — | On Defend: Burn the attacker |
      | Squirtle → Wartortle → Blastoise | 3 | Water | Medium, Steady, Special, Defence guard | Shell 1, then Shell 2 | Empowered summon |
      | Horsea → Seadra → Kingdra | 2 | Water | Medium, Steady, Special | Rally +1/+1; Kingdra: Rally +2/+2 and Shell 1 | — |
      | Magikarp → Gyarados | 2 | Water | Heavy, Steady, Physical | Magikarp: On Summon, draw 1; Gyarados: Overrun, and On Summon 2 damage to each enemy Pokémon in its Location | — |
      | Chinchou → Lanturn | 2 | Electric | Light, Steady, Special, Special Defence guard | Regenerate 1; Lanturn: On Attack, heal another friendly Pokémon in its Location 2 | — |
      | Bulbasaur → Ivysaur → Venusaur | 2 | Grass | Medium, Steady, Special; Special Defence guard at Levels 1–2 | Venusaur: Shell 1 | On Breakfast Growth; Ivysaur's Leech Seed |
      | Geodude → Graveler → Golem | 2 | Rock | Heavy, Slow, Physical, Defence guard | On Defend: 1 damage to the attacker (Golem: 2) | — (Graveler and Golem use Geodude's art, as in v2) |
      | Wingull → Pelipper | 1 | Water | Light, Swift, Special | — | Weather (Rain); Pelipper's Retain |
      | **Moves:** Hydro Pump | 2 | | | 3: 4 damage; 6: 9 damage | — |
      | Thunderbolt | 2 | | | 2: 3 damage; 4: 6 damage; 6: 6 damage to two targets | — |
      | Surf | 2 | | | 2: 2 to each enemy Pokémon; 5: 3 to each, and heal each friendly 2 | — |
      | Hyper Voice | 1 | | | 4: 2 to every enemy Pokémon; 6: 3 to each, and 2 to the enemy player | — |
      | Flame Charge | 2 | | | 1: +2 Attack this Round; 3: also becomes Active | Scorch 1 |
      | Rock Slide | 1 | | | 3: 2 to every enemy Pokémon in a chosen Location; 5: 3 there and 1 to every other | — |
      | **Supporters:** Professor Oak | 2 | | | Release 2: draw 3; Favour (a Pokémon card): draw 4 | — |
      | Nurse Joy | 1 | | | Release 1: heal each friendly Pokémon in a chosen Location 3; Favour (a Normal Pokémon): every Location | Douse |
      | Brock | 1 | | | Release 1: friendly Pokémon in a chosen Location gain +2 Strength and Shell 1 until your next Breakfast; Favour (a Rock Pokémon): every Location | Douse your player character |

    - **Not used:**
      - Legendaries: v3 has no rule for them yet.
      - Cards whose effects are all Burn, Sleep, Leech Seed, Growth, Weather, Items or Trainers: Ember, Heat Wave, Leech Seed, Sleep Powder, Solar Beam, Firebreather and the others.
      - Cards that need systems not yet in v3: Dive (no Discard Pile of Pokémon), Swimmer, Fisherman, Tracey (searching and choosing from the deck).
  - **Art:** only v1/v2 card art from `assets/cards/` (and Pallet Town). The table and the mat are now drawn in CSS: no other images.
  - **Tests:**
    - `rules.test.js` covers:
      - the treadmill: moving, shrinking, removal with completion rewards, Pokémon staying put, arrivals only when they fit (a 3-lane one waits until 3 spaces are free), and the board filling and staying full;
      - the Championship;
      - the cards (a mix, series stages, no dropped systems in any effect);
      - every keyword and ability above, two targets and a chosen Location.
    - `setup.test.js` checks the art rule: only `assets/cards`, Locations named for their art, no images in the CSS.
    - The layout check adds two-target and chosen-Location screens and reports `layout: ok` at 1920×1080, 1366×768 and 1280×720.
  - **AI-vs-AI report** (`node v3/tools/matches.js 100`):
    - All 100 matches finish, averaging **9.88 Rounds** (Round 8: 3, Round 9: 21, Round 10: 61, Round 11: 15).
    - **How they end:**
      - the Trophy before the Championship: 24;
      - the Trophy during the Championship: 75;
      - crowned at the Championship's end: 1;
      - no draws, though one match ended with both players reaching the Trophy at once (no winner).
    - The player with initiative in Round 1 won 51, the other 48.
    - Per match: an average final Recognition of 90, 94 actions, 13 Overexerts and no deck-outs.
  - **Screenshots** (`v3/screenshots/`): `v3-1-round2.jpg`, `v3-1-round6.jpg`, `v3-1-round8.jpg`, `v3-1-location-target.jpg` (Rock Slide), `v3-1-two-targets.jpg` (Thunderbolt at 6) and `v3-1-championship.jpg`.

- **V3-1 fix — always the latest build.** After V3-1 went live, the v3 link still served V3-0's cards (Swift Striker…) to players who had played before. The GitHub Pages deploy had succeeded; browsers (and GitHub's 10-minute cache) were reusing the old JavaScript files.
  - `v3/tools/stamp.mjs` now stamps every v3 module import, the stylesheet and the entry script with `?v=<build>`, so each build's files have new addresses and are fetched fresh.
  - `setup.test.js` fails if any import is missing the stamp, or if two stamps differ.
  - Run it before every commit.

