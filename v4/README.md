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
| `v4/tests/` | `node v4/tests/core.test.js`, `locations.test.js`, `commands.test.js` and `items.test.js` (focused rule tests; no match simulations) |
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
| v2 | `v2/src/engine/game.js`: `playSupporter`, `supporterPlayable` and `favourMet`; `v2/src/engine/cardtypes.js`: `FAVOURS` (three conditions) and the Supporter shape | Adapted (F3): no targets, no Trainer Points; the Favour gives Recognition |
| v1 | `src/engine/game.js`: Open Bag's buy-from-hand and buy-from-PokéMart, `BAG_SIZE` (6), Consumed Items going to the PokéMart | Adapted (F4): a separate Purchase Item action; no In Delivery wait |
| v2 | `v2/src/engine/game.js`: `unlockTier` / `partnerInto` and the waiting-Partner list; printed Partner cards | Adapted (F4): Partners come from Trainer Objectives |

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

- **F3 — Command Cards and Supporters (step 3 of 5).**
  - **Command Cards:** three ways to play, each with its own Energy cost:
    - **Adapt** (a Battle Phase action): the standard effect, now.
    - **React:** cheaper and weaker.
      - It's played in response to the opponent committing an attack, a summon or an Adapt, and resolves before that action.
      - The window opens only if you can afford a React that has a target.
      - The committed action then resolves; it may fizzle, and its cost stays paid.
      - A React doesn't use a turn and can't be reacted to.
    - **Strat** (a Battle Phase action): dearer and stronger. Paid and targeted now; it resolves at the start of your next turn (or at Supper if the Battle Phase ends first), and fizzles if its target is gone.
  - **The four Command Cards:**

    | Card | Target | Adapt | React | Strat |
    |---|---|---|---|---|
    | Ember | an enemy Pokémon | 2 Energy: 3 damage | 1: 2 damage | 3: 5 damage |
    | Recover | one of yours | 2: heal 4 | 1: heal 2 | 3: heal 8 |
    | X Attack | one of yours | 2: +2 Attack until Supper | 1: +1 | 3: +4 |
    | Rock Slide | an enemy Pokémon | 3: 1 damage to each enemy Pokémon in its Location | 2: 1 damage to it | 4: 2 damage to each |

  - **Supporters** (a Battle Phase action, no Energy):
    - Release N other cards from hand. They go to the Released Pile for good and are never reshuffled. Then the Supporter is Released too.
    - **Favour:** if a Released card meets the condition, the enhanced effect applies and you earn +1 Recognition.

    | Supporter | Release | Effect | Favour: Release… | Enhanced |
    |---|---|---|---|---|
    | Nurse Joy | 1 | heal your Pokémon 2 | a Water Pokémon | heal 4 |
    | Professor Oak | 1 | search 1 Pokémon card | a Location | search 2 |
    | Brock | 2 | +1 Strength to your Pokémon | a Pokémon of Level 4+ | +2 |

  - **The demo deck:** 31 cards, the same for both players: the 20 Pokémon, the 4 Locations, the 4 Command Cards and the 3 Supporters.
  - **The AI:**
    - It plays Adapt and Strat.
    - It Reacts to the player when that helps, for example defeating an attacker before its attack.
    - It plays Supporters, Releasing its least useful cards or one that meets the Favour.
  - **The interface:**
    - **Command cards** show all three modes with their costs. Selecting one offers Adapt and Strat buttons, with costs and reasons when unaffordable. The targets then glow.
    - **The React window:**
      - The prompt bar describes the committed action, which is outlined on the board.
      - Command cards you can React with glow orange.
      - Pick one and a target, or press **Let it happen**.
      - While the Opponent decides on a React, you see that too.
    - **Pending Strats** show as badges on their target (blue for yours, orange for theirs), and in a Pending Strats panel with the effect.
    - **The Supporter screen:**
      - It marks which cards will be Released and which meet the Favour (★).
      - It says whether the Favour is met.
      - It enables the button only at the right count.
    - Released Pile counts are shown for both players, with the cards listed on hover.
    - The Actions panel includes Command and Supporter.
  - **Checks:**
    - `node v4/tests/commands.test.js` covers:
      - each Command mode;
      - React: the window opens only when affordable, resolves before the committed action (an attack, a summon or an Adapt), can make it fizzle with its cost still paid, uses no turn, and can't be reacted to;
      - Strat: resolves after the opponent's next turn or at Supper, and fizzles when its target is gone;
      - Supporters: Release is permanent and never reshuffled, the Supporter is Released too, and the Favour gives the enhanced effect and Recognition;
      - unaffordable or unavailable options are refused, with the reason;
      - the AI's React, Adapt and Strat choices.
    - `core.test.js` and `locations.test.js` still pass.
    - `layout.mjs` reports ok at all three sizes, with new scenarios: the Command chooser, a React window, pending Strats and the Supporter screen.
    - A browser click-through of Adapt, a Supporter and a React to a real AI attack showed no errors.
  - **Art:** all existing (ember, recover, x-attack, rock-slide, nurse-joy, professor-oak, brock); none missing.

- **F4 — Items and Trainers (step 4 of 5).**
  - **PokéDollars:**
    - +$1 at each Breakfast.
    - When an enemy Pokémon is defeated, its Energy cost at its Level (at least $1).
    - Carried between Rounds, and shown on both Player Characters.
  - **Items:** each has a price and is **Held** (attaches to one of your Pokémon, one each, lost when it is defeated) or **Consumed** (resolves, then goes to the PokéMart).

    | Item | Price | Type | Effect | Where |
    |---|---|---|---|---|
    | Potion | $2 | Consumed | heal 3 | deck and PokéMart |
    | Choice Band | $2 | Consumed | +2 Attack until Supper | deck and PokéMart |
    | Charcoal | $2 | Held | +1 Attack | deck and PokéMart |
    | Oran Berry | $1 | Consumed | heal 2 | PokéMart only |
    | Mystic Water | $2 | Held | +2 Strength | PokéMart only |
    | Leftovers | $3 | Held | heal 1 at each Breakfast | PokéMart only |

  - **Purchase Item** (a Battle Phase action):
    - Buy an Item from your hand or the PokéMart.
    - Then use it now, or store it in your Inventory Bag (6 spaces).
    - An unbought Item in hand is discarded at Supper.
  - **Play Inventory Item** (a Battle Phase action): use an Item from your Bag.
  - **The PokéMart:**
    - One shared pool with one copy of each Item.
    - At each Breakfast, unsold Items go back and 3 random Items go on sale.
    - Used and lost Items return to the pool.
  - **Trainer Cards**, two ways:
    - **Trainer Objective** (1 Energy):
      - It goes to your Trainer area and is tracked from then on; it isn't discarded at Supper.
      - **On completion:** its Partner arrives in your first empty space (or waits for one), its On Summon resolves, you earn +2 Recognition, and the Trainer is discarded.
    - **Trainer Command** (its own cost): resolves at once, then it's discarded.
  - **The two Trainers:**

    | Trainer | Objective | Partner (On Summon) | Trainer Command |
    |---|---|---|---|
    | Misty | Defeat 2 enemy Pokémon | Starmie (draw 2) | 1 Energy: draw 2 cards |
    | Blaine | Dominate a Location at Supper | Ninetales (1 damage to each enemy Pokémon) | 2 Energy: 1 damage to each enemy Pokémon |

  - **The demo deck:** 36 cards, the same for both players. Potion, Charcoal, Choice Band, Misty and Blaine are added.
  - **The AI:**
    - It buys Items from hand and the PokéMart, and uses them at once or stores them.
    - It uses Bag Items.
    - It plays Trainers as Objectives and as Trainer Commands.
  - **The interface:**
    - **PokéDollars:** a gold chip on each Player Character.
    - **Trainer areas** beside the Player Characters show each Trainer, its Objective, its progress (e.g. 1/2) and its Partner, plus any Partner waiting for a space.
    - **Partners** on the battlefield are marked ★ Partner, with a gold frame. Held Items show as a ◆ badge on their Pokémon.
    - **A strip under the battlefield** holds the PokéMart (3 Items with prices and Buy buttons, disabled with a reason on hover) and both Inventory Bags.
    - **Buying** offers *Buy & use now* or *Buy & store*, with reasons when unavailable. Usable Bag Items glow.
    - **Trainer cards** offer Objective and Command buttons with costs and reasons.
    - The Actions panel adds Purchase Item, Inventory Item, Trainer Objective and Trainer Command.
  - **Checks:**
    - `node v4/tests/items.test.js` covers:
      - income and defeat rewards;
      - buying from hand and from the PokéMart, used now or stored;
      - the Bag limit and playing from the Bag;
      - the PokéMart showing 3 each Breakfast, with unsold, used and lost Items returning to the pool;
      - Held and Consumed;
      - an unbought Item discarded at Supper;
      - Trainer Objective progress and completion, the Partner's arrival (including waiting for a free space), its On Summon and the Recognition;
      - Trainer Commands;
      - refusals with reasons;
      - the AI buying, using, and playing Trainers both ways.
    - The earlier tests still pass.
    - `layout.mjs` reports ok at all three sizes, with new scenarios: Items, Bags and Trainer areas; the buy chooser; the Trainer chooser.
    - A browser click-through showed no errors. It bought from the PokéMart and used it, bought from hand and stored it, used an Item from the Bag, and played a Trainer Objective and a Trainer Command.
  - **Art:** all existing (potion, oran-berry, choice-band, charcoal, mystic-water, leftovers, misty, starmie, blaine, ninetales); none missing.
