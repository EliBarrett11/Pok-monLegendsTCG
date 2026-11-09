# Pokémon Legends v4: the foundation

v4 builds `docs/v4-foundation-spec.md`: sections 1–16, with section 16's clarifications taking priority. It's built in five steps. v1 (the root), v2 (`v2/`) and v3 (`v3/`) don't change.

- **Play v4:** https://elibarrett11.github.io/Pok-monLegendsTCG/v4/
- **Assumptions:** `v4/FOUNDATION_ASSUMPTIONS.md`.

## How it's built

Plain HTML, CSS and JavaScript modules: no build step and relative paths only. It shares only the art in `assets/cards/`.

| Folder | Contents |
|---|---|
| `v4/src/rules.js` | The numbers |
| `v4/src/engine/` | Game rules and state (`game.js`), cards (`cards.js`), Energy (`energy.js`), random numbers. **No DOM code.** |
| `v4/src/ai/` | The simple AI: greedy, one move ahead, through the engine's actions |
| `v4/src/ui/` | The interface (v3's look), coded icons |
| `v4/tests/` | `node v4/tests/core.test.js` and `node v4/tests/locations.test.js` (focused rule tests; no match simulations) |
| `v4/tools/` | `node v4/tools/layout.mjs` (the nothing-clipped check); `node v4/tools/stamp.mjs` (cache-busting: run before each commit) |

**Reused (copied, with the source noted in each file):**

| From | What | Changed? |
|---|---|---|
| v1 | `src/engine/energy.js` (Base Energy, Exert and Exhaust) | Unchanged |
| v1 | `src/engine/random.js` | Unchanged |
| v3 | `v3/src/ui/style.css` and `icons.js` | Renamed `v3-` → `v4-` |
| v3 | `v3/src/main.js` | Adapted |
| v3 | `v3/src/ai/ai.js` | Adapted |
| v3 | `v3/tools/layout.mjs` and `stamp.mjs` | Adapted |
| v2 | `v2/src/engine/game.js`: `locationStarts` (where a Location fits) and `syncPassives` (keeping stat bonuses in step), now `locationStarts` and `syncBonuses` in `v4/src/engine/game.js` | Adapted (F2) |

The rules for Ready, the unmatched-Speed Pass and trades follow v3's engine.

**URL options:** `?seed=123` replays the same match; `?autoplay` lets the AI play both sides; `?debug` exposes `window.__v4` for checks.

## Build log

- **F1 — the core (step 1 of 5).**
  - **The battlefield:**
    - 9 lanes, with one space per player in each.
    - The whole battlefield is the Default Location (placed Locations come later), with no passive, Weather or dominance.
    - The Player Characters sit outside it.
  - **Rounds:**
    - **Breakfast:** Exhaust recovers; Base Energy is the Round (max 10); Exert maximum is the Round (max 3); Spent Pokémon become Active; Pokémon cards off the battlefield gain their Level; draw 7, less one per Retained card.
    - **Round 1:** draw 7, then a v1 mulligan.
    - **Battle:** alternating turns, with one action each:
      - Summon;
      - Attack (a Ready Pokémon attacks an enemy Pokémon or the enemy Player Character, subject to guards);
      - Retain (1 Energy);
      - Pass (+1 Base Energy, except the Pass that ends the phase; the unmatched-Speed rule applies).
    - **Supper:** the hand is discarded except Retained cards. The Discard Pile reshuffles into the Draw Pile when it runs out (v1).
  - **Energy:** v1's Base Energy, Exert and Exhaust exactly (recovery positions 2, 3 and 4 Rounds later).
  - **Pokémon:**
    - Light (Levels 1–6), Mid (2–7) and Heavy (3–8) series, +1 Level per Round off the battlefield.
    - A summoned Pokémon is a snapshot.
    - Form, stats, ability and cost come from the Level; Mid costs about half the Round's Base Energy.
    - **Evolution paths:** Ponyta → Rapidash, Chinchou → Lanturn, Squirtle → Wartortle → Blastoise, Growlithe → Arcanine, Magikarp → Gyarados, Charmander → Charmeleon → Charizard.
  - **Speed and combat:**
    - Ready and Spent work as in v3.
    - **Guards (section 16):** a Defence or Special Defence guard protects its side's other Pokémon in the same Location, and its Player Character against attackers in its Location.
  - **Recognition:** 1 per damage to the enemy Player Character and +2 per Pokémon defeated; 100 wins.
  - **The AI:** greedy, one move ahead, through the same engine actions.
  - **The interface:**
    - Both Recognition totals with progress to 100.
    - Base Energy, available Exert with its maximum, and each Exhaust point's recovery Round.
    - Hand, Deck, Discard and Released counts for both players.
    - Board Pokémon show their Level, art, Attack, Speed icon and Strength, with full details on hover.
    - An Actions panel shows each action as available or why not.
    - Unplayable hand cards say why on hover.
    - Retain: select a card, then click Retain.
  - **The demo deck so far:** 20 Pokémon cards, the same for both players:

    | Series | Pokémon | Copies | Guard |
    |---|---|---|---|
    | Light | Ponyta | 4 | — |
    | Light | Chinchou | 3 | Special Defence |
    | Mid | Squirtle | 4 | Defence |
    | Mid | Growlithe | 4 | — |
    | Heavy | Magikarp | 3 | — |
    | Heavy | Charmander | 2 | — |

  - **Checks:**
    - `node v4/tests/core.test.js` covers:
      - setup: v4 stands alone, both players get the same deck, the mulligan;
      - development Levels and snapshots;
      - Retain and the draw reduction;
      - Base Energy, Pass, Exert and Exhaust positions;
      - Ready and the unmatched-Speed Pass;
      - guards, Attack and trades;
      - both Recognition sources, and winning at 100.
    - `node v4/tools/layout.mjs` reports `layout: ok` at 1920×1080, 1366×768 and 1280×720.
  - **Art:** all existing; none missing for F1.

- **F2 — Locations (step 2 of 5).**
  - **Location Cards:**
    - **Place Location** is a Battle Phase action costing no Energy.
    - A Location covers 2, 3 or 4 adjacent free lanes (set per card) on both sides, including lanes with Pokémon already there.
    - It stays for a set number of Rounds (set per card), counted down at Supper. Then its lanes are the Default Location again, and Pokémon there stay where they are.
    - It can only be placed where enough adjacent free lanes exist; otherwise it says why.
  - **The four Locations:** each has a name, art, a passive on the Pokémon in it, and Weather of one type:

    | Location | Lanes | Rounds | Weather | Passive |
    |---|---|---|---|---|
    | Cerulean Cape | 2 | 3 | 1 Rain | +1 Strength |
    | Mt. Ember | 3 | 3 | 2 Sun | +1 Attack |
    | Lake of Rage | 2 | 2 | 1 Sun | Heal 2 at Breakfast |
    | Route 119 | 4 | 2 | 2 Rain | Summoning here costs 1 less |

    They're in the demo deck: 20 Pokémon plus the four Locations, the same list for both players.
  - **Weather:** Rain and Sun counts combine across all placed Locations. Brackets apply to both players:
    - **Rain 2:** every Pokémon heals 1 at Breakfast.
    - **Rain 4:** every Pokémon has +1 Strength.
    - **Sun 2:** Physical attacks deal +1 damage.
    - **Sun 4:** every Pokémon has +1 Attack.
  - **Dominance:** at Supper, for each placed Location, the player whose Pokémon there have the greater total current Strength earns +1 Recognition. Ties give nothing.
  - **The AI:**
    - It places Locations, valuing each one it dominates at the Recognition it would bring over the Rounds left.
    - It contests dominance, for example summoning into a Location you dominate.
    - It now only tries spaces it can pay for, since Route 119 makes cost depend on the lane.
  - **The interface:**
    - Locations are bold tiles in their own colour and art over their lanes on both sides.
    - Each has a compact panel with the name, Weather, Rounds left, who dominates now (with both Strength totals) and what that gives at Supper. The passive and details appear on hover.
    - The Default Location label sits over the widest stretch of Default lanes.
    - A Weather panel shows the Rain and Sun counts and which brackets are active.
    - Location cards in hand show their lanes, Rounds, passive and Weather.
    - **To place one:** select it, then click a glowing lane. It covers that lane and the ones to its right.
    - The Actions panel includes Place Location.
  - **Checks:**
    - `node v4/tests/locations.test.js` covers:
      - placement: widths, free lanes, over Pokémon, no room, no Energy;
      - duration and removal;
      - each passive;
      - the Weather brackets;
      - dominance and its Recognition, including ties;
      - the AI placing and contesting.
    - `core.test.js` still passes.
    - `layout.mjs` reports ok at all three sizes, with two new scenarios: placed Locations and choosing where to place one.
  - **Art:** all existing (cerulean-cape, mt-ember, lake-of-rage, route-119); none missing.
