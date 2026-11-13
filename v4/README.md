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
| `v4/src/data/` | `cards.js`, generated from `docs/base-game/cards.json` by `node v4/tools/buildcards.mjs` (B3-1) |
| `v4/src/ai/` | The simple AI: greedy, one move ahead, through the engine's actions |
| `v4/src/ui/` | The interface (v3's look), coded icons |
| `v4/tests/` | `node v4/tests/core.test.js`, `locations.test.js`, `commands.test.js`, `items.test.js`, `tournament.test.js`, `ux1.test.js`, `ux2.test.js` and `ux3.test.js` (focused rule tests; no match simulations) |
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

## The decks (B3-1: the four Batch 1 decks)

Every card comes from `docs/base-game/cards.json` (the approved Base Game): `node v4/tools/buildcards.mjs` generates `v4/src/data/cards.js` from its Batch 1 entries, and the game's wording is generated from the data (`tests/cardsdata.test.js` checks it word for word). Each side plays one of four decks (`v4/src/engine/decks.js`), chosen with `?deck=<name>` and `?aideck=<name>` (blaine, misty, erika, surge) or at random. Deck rules (`validateDeck`): 40 cards, at most 2 copies, a Legendary 1 copy, 0–3 Trainers (1 copy each), any number of Locations.

- **Blaine's Blitz** (40 cards): *Trainers* Blaine, Lt. Surge; *Locations* Mt. Ember, Cinnabar Volcano, Power Plant, Route 119; *Pokémon* Ponyta ×2, Growlithe ×2, Charmander ×2, Magby ×2, Pichu ×2, Shinx ×2, Chinchou, Entei, Zapdos; *Commands* Ember ×2, Flame Charge, Heat Wave, Thunderbolt ×2, Thunder Wave, Protect; *Supporters* Flannery, Firebreather, Chili, Kabu, Tracey; *Items* X Attack, Charcoal, Magnet, Quick Claw, Choice Band, Oran Berry.
- **Misty's Tide** (40 cards): *Trainers* Misty, Whitney; *Locations* Cerulean Cape, Lake of Rage, Floaroma Meadow, Pallet Town; *Pokémon* Squirtle ×2, Wooper ×2, Horsea ×2, Magikarp ×2, Happiny ×2, Munchlax ×2, Meowth, Eevee, Kyogre; *Commands* Surf ×2, Bubble Beam, Dive ×2, Recover ×2, Protect; *Supporters* Nurse Joy, Swimmer, Fisherman, Crasher Wake, Wallace; *Items* Mystic Water, Leftovers, Potion, Sitrus Berry, Rocky Helmet, Amulet Coin.
- **Erika's Garden** (40 cards): *Trainers* Erika; *Locations* Eterna Forest, Floaroma Meadow, Pallet Town, Route 119; *Pokémon* Bulbasaur ×2, Oddish ×2, Sunkern ×2, Budew ×2, Eevee ×2, Happiny, Munchlax, Meowth ×2, Celebi; *Commands* Leech Seed ×2, Solar Beam ×2, Recover ×2, Protect ×2; *Supporters* Ramos, Gardenia, Brock, Professor Oak, Pokémon Breeder; *Items* Miracle Seed, Leftovers, Super Potion, Sitrus Berry, Oran Berry, Quick Claw, X Attack.
- **Surge's Storm** (40 cards): *Trainers* Lt. Surge, Misty; *Locations* Power Plant, Cerulean Cape, Route 119, Mt. Ember; *Pokémon* Mareep ×2, Chinchou ×2, Pichu ×2, Shinx ×2, Horsea, Magikarp ×2, Squirtle, Eevee, Zapdos, Kyogre; *Commands* Thunderbolt ×2, Thunder Wave ×2, Surf, Dive, Bubble Beam, Protect; *Supporters* Tracey, Professor Oak, Swimmer, Nurse Joy, Pokémon Breeder; *Items* Magnet, Mystic Water, Quick Claw, X Attack, Potion, Amulet Coin.

As written in the B3-1 prompt, Blaine's Blitz, Erika's Garden and Surge's Storm had 39 cards; each got one more so it passes the 40-card rule (a second Magby; a second Protect; a Protect).

## Validation (spec sections 12 and 14)

No match simulations or AI-vs-AI matches were run. Each item was checked by a focused test (`node v4/tests/<name>.test.js`) or in the browser:

- **Browser check:** a real match in Chromium against the AI, with the human side keeping its hand, passing and letting each React window resolve. It ran start to finish with no errors: the Tournament began at Round 7 (70+ Recognition), its banner showed, and the AI won at 102 Recognition.
- **Click-through checks:** each feature's player flows (F3 and F4), and a player win at 100 by clicking an attack in the Tournament.
- **Layout check:** `node v4/tools/layout.mjs` checks every screen at 1920×1080, 1366×768 and 1280×720.

| Requirement | How it was verified |
|---|---|
| The project builds and runs without errors | No build step. Every test imports the modules. The layout check loads every scenario at three sizes with no page errors. Two browser checks (the full match and the player win) had no errors. |
| A match can be started; both players get the same deck | `core.test.js` and `tournament.test.js` compare both piles with the 40-card list. |
| Both players can perform the available actions; all nine Battle Phase actions work | Each action is applied through `applyAction` for the player and the AI:<br>- Summon: `core`<br>- Command (Adapt, React, Strat): `commands`<br>- Supporter: `commands`<br>- Place Location: `locations`<br>- Purchase Item: `items`<br>- Play Inventory Item: `items`<br>- Trainer Command: `items`<br>- Retain: `core`<br>- Pass: `core`<br>Attack and Trainer Objective also work.<br>Browser click-throughs covered each player flow. |
| Every approved card type works | Pokémon (`core`), Command (`commands`), Location (`locations`), Supporter (`commands`), Item and Trainer (`items`). |
| Pokémon development works | `core`: Levels by Round and series, the cost curve, snapshots on summon. |
| Energy and PokéDollar economies work | `core`: Base Energy, Pass, Exert and Exhaust. `items`: income, defeat rewards, spending. |
| Command React, Adapt and Strat work; React interrupts; Strat is delayed | `commands`:<br>- React resolves before an attack, a summon or an Adapt, can make it fizzle, uses no turn and can't be reacted to.<br>- Strat resolves after the opponent's next turn, or at Supper, and fizzles when its target is gone. |
| Supporter Release and Favour work | `commands`: Release is permanent and never reshuffled, the Supporter is Released too, and the Favour gives its effect and Recognition. |
| Locations can be placed and dominated | `locations`: placement, durations, passives, dominance, ties. |
| Items, the PokéMart (3 a Round) and the Inventory work | `items`: buying from hand and the PokéMart, use now or store, the Bag limit, playing from the Bag, Held and Consumed, and the refresh of 3 each Breakfast with Items returning to the pool. |
| Trainer Objectives and Commands work | `items`: progress, completion, the Partner (including waiting for a space), its On Summon, the Recognition, both Trainer Commands. |
| Recognition from every approved source | Damage to the Player Character and defeats: `core`. Dominance: `locations`, `tournament`. Favours: `commands`. Trainer Objectives: `items`. Card effects (a Command or Partner On Summon that defeats): `commands`, `items`. |
| The Tournament replaces the active Locations and functions | `tournament`:<br>- it triggers at Round 10 or 70+ Recognition;<br>- Locations are removed to the Discard Piles and Pokémon stay;<br>- passives end;<br>- Locations can't be placed;<br>- Recognition is +50%, rounded up;<br>- dominance gives +3 (5), ties give nothing.<br>The browser match also triggered it. |
| A player can win at 100 Recognition | `core` and `tournament`, including during the Tournament for either player. The browser checks ended a match both ways. |
| A complete match is playable with the same deck | The browser match above, start to finish. |
| Important assumptions are documented | `v4/FOUNDATION_ASSUMPTIONS.md`, in the section 13 format. |

## Build log

- **F1 — the core (step 1 of 5).**
  - **The battlefield:**
    - 9 lanes, with one space per player in each.
    - The whole battlefield is the Default Location (placed Locations come later), with no passive or dominance.
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
  - **The four Locations:** each has a name, art and a passive on the Pokémon in it (and, until B3-1 removed it, a second system of brackets):

    | Location | Lanes | Rounds | Passive |
    |---|---|---|---|
    | Cerulean Cape | 2 | 3 | +1 Strength |
    | Mt. Ember | 3 | 3 | +1 Attack |
    | Lake of Rage | 2 | 2 | Heal 2 at Breakfast |
    | Route 119 | 4 | 2 | Summoning here costs 1 less |

    They're in the demo deck: 20 Pokémon plus the four Locations, the same list for both players.
  - **Brackets** (removed in B3-1): counts from the placed Locations unlocked heals, Strength, Physical damage and Attack for both players.
  - **Dominance:** at Supper, for each placed Location, the player whose Pokémon there have the greater total current Strength earns +1 Recognition. Ties give nothing.
  - **The AI:**
    - It places Locations, valuing each one it dominates at the Recognition it would bring over the Rounds left.
    - It contests dominance, for example summoning into a Location you dominate.
    - It now only tries spaces it can pay for, since Route 119 makes cost depend on the lane.
  - **The interface:**
    - Locations are bold tiles in their own colour and art over their lanes on both sides.
    - Each has a compact panel with the name, its bracket count, Rounds left, who dominates now (with both Strength totals) and what that gives at Supper. The passive and details appear on hover.
    - The Default Location label sits over the widest stretch of Default lanes.
    - A panel showed the bracket counts and which were active (removed in B3-1).
    - Location cards in hand show their lanes, Rounds and passive.
    - **To place one:** select it, then click a glowing lane. It covers that lane and the ones to its right.
    - The Actions panel includes Place Location.
  - **Checks:**
    - `node v4/tests/locations.test.js` covers:
      - placement: widths, free lanes, over Pokémon, no room, no Energy;
      - duration and removal;
      - each passive;
      - the brackets;
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

- **F5 — the Pokémon League Tournament and completion (step 5 of 5).**
  - **The trigger:** at Breakfast at the start of Round 10, or at the first Breakfast where either player has 70+ Recognition, whichever comes first.
  - **The transition:**
    - All placed Locations are removed; their cards go to their owners' Discard Piles.
    - The Tournament covers all 9 lanes, and Pokémon stay where they are.
    - Location passives (and the brackets) end.
    - No new Locations can be placed; Location cards say why.
    - It lasts until the match ends.
  - **Passive:** all Recognition earned is increased by half, rounded up (3 → 5).
  - **Dominance:** at each Supper, more total current Strength on the battlefield earns +3 Recognition (5 with the passive). Ties give nothing. It counts as dominating a Location for Blaine's Objective.
  - **Winning** stays at 100 Recognition; there's no other victory condition.
  - **The interface:**
    - A banner when the Tournament begins.
    - A gold Tournament tile across the board, showing its passive, who dominates (with both Strength totals) and what that gives at Supper.
    - A 🏆 Tournament chip by the Round.
    - The bracket panel shows "None".
  - **The AI** counts the Tournament's dominance.
  - **The final foundation deck:** 40 cards, adding a second Ember, Recover, Potion and Professor Oak. See "The foundation deck" above.
  - **`FOUNDATION_ASSUMPTIONS.md`** is completed in the section 13 format. Each entry gives what was chosen, why it's the simplest, and whether it needs approval. It covers the Tournament, the starting values, the round-start order, React timing and the Retain limit.
  - **Checks:**
    - `node v4/tests/tournament.test.js` covers:
      - the deck;
      - the trigger, by Round and by Recognition;
      - Locations removed and Pokémon staying;
      - old passives and brackets ending;
      - no Locations;
      - the +50% passive;
      - Tournament dominance and ties;
      - winning at 100 during the Tournament, for either player;
      - the AI.
    - All five test files pass.
    - The layout check is ok at all three sizes, with the Tournament banner and board scenarios.
    - Browser checks: a complete match against the AI, and a player win at 100. See "Validation" above.
  - **Missing art:** the Pokémon League Tournament has no art, so it uses a plain gold frame. Elliott, it needs a Tournament image (e.g. `assets/cards/pokemon-league.jpg`).

- **UX1 — Elliott's rule and display changes, and the React window** (`docs/v4-ux-plan.md`, sections 2 and 3.4).
  - **Trainer Objectives are active from the start** (a rule change Elliott settled):
    - The Trainers stay shuffled into the 40-card deck.
    - At setup, each player's Trainer area gets one Objective tracker per Trainer card in their deck (Misty and Blaine). Each is linked to its card's `uid`, active from Round 1, free, and starts at progress 0.
    - The Objective action is gone. A drawn Trainer is played only as its Trainer Command, then discarded, and keeps cycling; the Command doesn't affect its Objective.
    - **On completion:**
      - the Trainer card is taken at once from the Draw Pile, the hand (Retained or not) or the Discard Pile, and leaves the deck for good (39 cards left);
      - its Partner arrives (or waits for a free space);
      - its On Summon resolves;
      - +2 Recognition.
    - The tracker stays, ticked. Progress, completion and where the card was taken from are logged.
    - The AI never plays an Objective.
  - **Command modes by situation:** a pure engine helper, `commandModesFor(s, who, uid)`. The hand display, the click menu and the AI all use it.
    - **Your turn:** Adapt (with its reason if it can't be played), plus Strat only if you can afford it.
    - **Your React window:** React only, if affordable with a target.
    - **Otherwise:** none, and the card is quietly dimmed.
  - **The React window** (when it's your React):
    - **The pause:** everything else stops.
    - **The committed action:** shown on the board, with a dashed arrow from the attacker (or from the banner, for an Adapt) to its target, or the incoming summoned card in its space.
    - **The banner:** a REACT? banner with a plain sentence (e.g. "The Opponent's Gyarados is attacking your Charizard for 9.") and a countdown bar.
    - **The options:** each playable React card shown large, with its effect aimed at the actual target, its cost, the Energy you'll have left, and a React button. A card with several targets highlights them first.
    - **Let it happen.**
    - **The timer:** 5 s by default. A small React timer control (5, 8, 12 or 20 s) is under the build line, saved in localStorage (inside try/catch). On timeout it sends the same `decline` as the button.
    - **Keys:** Space reacts when there's exactly one option and one target; Esc lets it happen.
    - The timer lives in `main.js`, not the engine. The AI's React decisions are instant, and autoplay and tests never wait.
  - **Series hidden:** Light, Mid and Heavy no longer appear in any displayed text (card faces, the hand line, board cards, hover and detail text, the log). They stay in the data and rules.
  - **Recognition** is shown capped at 100 everywhere on screen. The end screen also gives the real totals.
  - **Checks:**
    - `node v4/tests/ux1.test.js` covers:
      - 2 active Objectives at progress 0 and 40 cards at setup;
      - no `trainerObjective` action;
      - a Trainer played only as a Command and cycling;
      - completion from the Draw Pile, the hand (Retained) and the Discard Pile (39 left, the Partner, +2, a ticked tracker that makes no more progress);
      - `commandModesFor` in every situation;
      - `decline` resolving the committed attack;
      - no series in rendered text or the log;
      - Recognition capped on screen.
    - The other five test files were updated where they used the Objective action, or where always-active Objectives would change what they check. They all pass.
    - `layout.mjs` is ok at all three sizes.
    - **A browser check of the real React window** (opened by an AI attack): the timer declines after 5 s, Esc lets it happen, Space reacts, a multi-target React highlights its targets, and the timer setting survives a reload. No errors.

- **UX2 — Objective targets, stronger Partners, and the new layout, HUD and card faces** (`docs/v4-ux-plan.md` 2b, 3.1, 3.3, Q5–Q8; the mockup `docs/design/v4-ux2-layout-mockup.jpg`/`.html`; the stat icons `docs/design/v4-stat-icons`).
  - **Numbers Elliott approved:**
    - **Misty:** "Defeat 8 enemy Pokémon".
    - **Blaine:** "Dominate a Location 5 times". Each Location dominated at a Supper counts 1, and so does the Tournament.
    - **Starmie** (Partner): Level 8, Swift, Special Attack 8, Hitpoints 10, cost 4. On Summon: draw 2.
    - **Ninetales** (Partner): Level 8, Steady, Special Attack 9, Hitpoints 11, cost 4. On Summon: 2 damage to each enemy Pokémon.
    - A defeated Partner gives $4.
  - **The layout** (a fixed 1920×1080 stage, matching the mockup):
    - **The prompt bar:** the only place for step text and action buttons. Hover its text for every action and why it's unavailable (the old Actions panel).
    - **The opponent's HUD:**
      - a Recognition ring, capped at 100 on screen, which is also the attack target for the Player Character;
      - purse, Energy and Exert line, and 6 Bag slots;
      - two Objective trackers: art, name, short goal, one pip per step, the Partner's thumbnail, and green with a tick when complete;
      - hand backs with a count, the Released count, and the Deck and Discard piles.
    - **The board:**
      - Locations are full tiles: art over all their lanes on both rows, a coloured border, Pokémon standing on the art.
      - Each Location has a plate showing name, passive, Rounds-left pips, its bracket count, "N vs M" Strength, and a two-colour bar.
      - The Tournament is one tile with its plate (×1.5, dominance +3).
      - Empty lanes are plain mat, and the "Default Location" label is gone.
    - **Board cards:**
      - Level chip (★ and a Partner chip for Partners), a round Held Item chip, and a stat bar: attack icon and Attack, Speed chevrons, Strength icon and current Strength (red when damaged). No Def or Sp.Def tags.
      - **Ready:** a pulsing gold glow, static under `prefers-reduced-motion`.
      - **Spent:** greyed and tilted −6°.
      - **Legal attack targets:** a red ring. A guarded Pokémon is dimmed and says "Guarded by X".
    - **The five stat icons** live in `src/ui/icons.js`: Physical and Special Attack; Hitpoints, Defence and Special Defence. `attackIcon(card)` and `strengthIcon(card)` are pure helpers, used on board and hand cards and in the log. Tooltips name the stat in words.
    - **The right column:**
      - Round, with when the Tournament comes;
      - one bracket chip: totals, the active bracket effect and the next bracket;
      - the Energy tile: Base Energy left, "of N this turn", Exert diamonds (ready, Exhausted, locked) and return Rounds;
      - END TURN;
      - the PokéMart button with an "N new" badge after each Breakfast. It opens a drawer with the 3 Items and Buy buttons (same buying as before; reasons on hover).
      - the log ticker: the last 3 lines, coloured by player, with attack icons. It and the L key open the full log drawer.
    - **Your HUD:** ring, purse, Bag (click a usable Item to use it) and your two Objective trackers.
    - **The hand:** 182×254 cards, fanned and overlapping, lifting to the front on hover.
      - **Cost gem:** blue for Energy, gold $ for Items, red when unaffordable. Locations and Supporters have none.
      - **Faces:** Pokémon show a Level chip, a Type icon before the name, one rules line and a stat bar. Other cards show a kind line. Commands show only the `commandModesFor` modes as chips.
      - Playable cards have a gold edge; unplayable ones are dimmed, with the reason on hover.
    - **Bottom-right:** your Deck and Discard piles, the key hints (with the React timer setting), and the Released and Retained counts.
    - **Removed:** the Actions panel, the pile-count panel, the strip under the board, the bracket list and the "Default Location" label. Their facts are now on the HUDs, piles, tooltips and the prompt bar.
  - **Kept:** UX1's React window (banner, arrow, large React cards, timer, keys), the mulligan, the end screen, the Supporter Release choice, Item targeting and the Tournament banner.
  - **Checks:**
    - `node v4/tests/ux2.test.js` covers:
      - the Objective targets and texts;
      - the Partners' stats, On Summon and $4;
      - Blaine's per-Location counting, including the Tournament;
      - the five icons;
      - no cost gem on a Location;
      - no series in any rendered text.
    - All seven test files pass. Earlier tests were updated where they assumed Objective targets of 2 and 1.
    - `layout.mjs` is ok for all 19 scenarios at 1920×1080, 1366×768 and 1280×720, including the new PokéMart drawer and log drawer scenarios.
    - **Browser click-through of every action in the new layout:**
      - the mulligan and summon;
      - attacking a Pokémon and the Player Character;
      - Command Adapt and Strat;
      - a Supporter Release and placing a Location;
      - buying from the PokéMart drawer and from hand, and using a Bag Item;
      - a Trainer Command, Retain and End turn;
      - the log drawer by click and by L, and the PokéMart drawer.

      There were no errors, and the UX1 React window check still passes.

- **UX3 — interaction (drag and drop, targeting arrows with previews, keyboard, confirmations) and UX2 polish** (`docs/v4-ux-plan.md` 3.4; the mockup's arrow and preview).
  - **Result previews** (`src/engine/preview.js`, pure). Each one plays the action on a copy of the state with the engine's own functions, so it can never disagree with the result.
    - **`attackPreview(s, who, from, target)`** returns:
      - the damage, and the target's Strength before and after;
      - a defeat and its rewards (Recognition after the Tournament's ×1.5, and $), or Recognition from damage to a Player Character;
      - the hit-back from a Ready target: its damage, the attacker's Strength after, a defeat, and the opponent's rewards;
      - the parts of the attack number (base Attack, Location, brackets, Held Item, "until Supper"), which always add up to the engine's damage.
    - **`effectPreview(s, who, card, mode, target)`** does the same for every Command mode, Items and Trainer Commands. Damage and heals show before → after, plus defeats and rewards. Effects with no number (such as "Draw 2 cards") give a sentence.
  - **Targeting arrows and previews** (`src/ui/interact.js`, on a layer above the board and below dialogs):
    - **The arrow** is curved, glowing and dotted, from the attacker or the hand, Bag or React card to the pointer. It turns red and snaps onto a legal target.
    - **The preview panel** sits beside the target: the title, stat icons with before → after, the breakdown ("9 = 8 Attack + 1 Mt. Ember"), gain chips ("Defeats it · +2 Recognition", "+$4"), and a hit-back line when the target is Ready.
    - **Illegal places** show their reason, such as "Guarded by Arcanine".
    - **Summoning and placing a Location:** the legal lanes glow, and hovering shows the cost (with the Route 119 discount), or the Location's outline over the lanes it would cover.
  - **Drag and drop** (pointer events, no library):
    - **From the hand:** a Pokémon to an empty space; a Location to a lane on either row (that lane is its start); a Command or Item to a legal target; a Supporter or Trainer Command to anywhere on the board.
    - **From the board:** a Ready Pokémon to an enemy Pokémon or the Opponent's Recognition ring.
    - **From the Bag:** an Item to one of your Pokémon.
    - **While dragging,** the card follows the pointer at 85% size and legal drops glow.
    - **A Command with two playable modes** opens a mode picker at the drop, showing each mode with its effect and cost.
    - **Cancelling:** an illegal drop, Esc or right-click cancels, and the card glides back. Nothing is committed before a legal drop.
    - Clicking works as before; every click, drop and Enter goes through the same flow (`src/ui/flows.js`).
  - **Keyboard:**
    - **Space:** End turn. **1–9:** select a hand card. **A:** select an attacker; press again for the next one. **R:** Retain the selected card.
    - **Tab / Shift+Tab:** cycle legal targets or spaces, with the preview and a focus ring. **Enter:** confirm.
    - **Esc or right-click:** cancel. **L:** the log. **?:** the key list.
    - Keys do nothing under a dialog with its own keys: the React window, the mulligan, the Release choice, the Tournament banner, a confirmation or the key list. Those keep their own keys (Enter or Esc where they have them).
    - The key hint at the bottom-right and END TURN's Space keycap are updated.
  - **Confirmations,** each with "Don't ask again" (kept in localStorage inside try/catch):
    - "End turn with N Energy unused?", when you have Energy and a playable card;
    - "Release N cards? Released cards leave the match.";
    - Retaining your last card.
  - **Polish:**
    - The log ticker's lines are trimmed in JS to fit.
    - The bracket chip's lines fit, including in the Tournament.
    - The Round panel's Tournament chips fit.
    - The opponent's pile counts sit inside the piles, clear of the captions.
    - Tall display numbers no longer overflow their boxes.
    - Text selection is off while dragging.
  - **An engine bug the new tests found:** the React-window event put `type: pending.type` in its data, which overwrote the event's own type. So a React window was logged as an "attack" event, and an earlier test of "no window" passed trivially. It's renamed `action`.
  - **The layout check** now also fails when any text overflows its own box. It has new scenarios: an attack preview with a hit-back, a Command drag over a target, the mode picker, a Location placement preview, the key list and a confirmation.
  - **Checks:**
    - **`node v4/tests/ux3.test.js`:** 220 random legal attacks from AI-played matches (fixed seeds) agree with `applyAction`. It compares damage, both Strengths, defeats, Recognition and $ for both players, with Location, bracket, Held Item, Tournament, hit-back, Player Character and defeat cases all covered. 63 effect cases (every Command mode, every Item, both Trainer Commands, and a Tournament defeat) agree with the real results.
    - All eight test files pass.
    - The layout check is ok at all three sizes.
    - **The Playwright browser check:**
      - drags to summon, to place a Location, to attack (a Pokémon and the ring), to play a Command through the mode picker, and to use Items from the hand and the Bag;
      - Esc and right-click cancel a drag;
      - one turn with keys only (1, Tab, Enter; A, Tab, Enter; Space with its confirmation);
      - each confirmation and its "Don't ask again";
      - the key list.

      No page errors.
- **UX4 — motion and effects** (`docs/v4-ux-plan.md` 3.5, `docs/vfx.md`). No rule or number changed.
  - **Reused, copied into v4 (each with a "Copied from …" header):**
    - `src/ui/vfx/gl.js`, `timeline.js`, `textures.js` and `shared.js` (the root effects library), from `src/ui/vfx/`;
    - `src/ui/vfx/engine.js` and `src/ui/particles.js`, from v2.
    - v4's changes are small: local imports; low motion follows v4's setting; textures load from `../assets/vfx/`; the board shake moves `.v4-board`; one frame may advance up to 100 ms, so a slow GPU stays near real time.
  - **The presenter** (`src/ui/plan.js`, pure; `src/ui/present.js`, the page):
    - Each action plays beat by beat. First the action on the board as it was; then the new state is drawn (at the first arrival); then the arrivals.
    - A Pokémon defeated after the new board is drawn keeps a ghost card, so its defeat still plays.
    - Input is locked while a beat plays. A click, Space or Esc skips to the end of the action.
    - The presenter only reads `prev` and `next`. `main.js` sets the state once, when it draws.
    - Without WebGL (`?nowebgl` forces it), 2D particles stand in; numbers, banners and card moves still play.
  - **The library** (`src/ui/vfx/library.js`, data only):
    - **`EVENT_BEATS`:** each of the 33 engine event types has a beat, a budget and a sound hook.
    - **Attacks:** Fire Physical is Flame Wheel; Fire Special is Flamethrower; Water Physical is Waterfall; Water Special is Hydro Pump; Electric Special is forked lightning (the shared bolt plus a second fork).
    - **Commands:** Ember and Rock Slide use v1's Strategy animations; Recover and X Attack are composed from the shared presets. React is quick, Adapt standard, Strat big.
    - v4's own moments, and `MS`: every page-animation time at Normal.
  - **Engine data fields** (data only; the engine does the same):
    - `hits` (each Pokémon's Strength and Attack before and after, and defeats) on Commands, Items, Supporters, Trainer Commands, On Summons and Breakfast heals;
    - `from` (the source) on Recognition and $;
    - names and uids on several events;
    - a Breakfast `summary` (cards drawn, $, Base Energy);
    - `emit` now returns its event.
  - **The beats:**
    - **Attacks:** hit-stop, shake and bloom scale with the damage; damage numbers; Strength numbers tick down. A hit-back plays the defender's shorter counter. An attack on the Player Character hits the Recognition ring.
    - **Heals:** green motes and "+N". **Defeats:** the card dissolves (ash, wash or shatter, by the Type that defeated it), then coins fly to the purse and "+N" flies to the ring.
    - **Commands:** the card rises to centre stage, flares and resolves at its target. X Attack leaves an aura on its Pokémon until Supper.
    - **Strats:** a played Strat flies to its owner's board edge and stays there, sealed: a glowing card back with an hourglass. When it resolves, it rises from there. A React plays inside the React-window flow.
    - **Summons** drop in with dust and glow, bigger by Level, then their On Summon. Charizard's and Ninetales's damage uses their own attack animation.
    - **Partners** (about 2 s): the tracker bursts, the Trainer's art sweeps across, the Partner lands with a gold shockwave, then its On Summon.
    - **Objectives:** each step fills the next pip with a pulse; completion turns the tracker green with a flare.
    - **Recognition:** "+N" flies from its source to the ring, and the ring fills smoothly. In the Tournament it reads "+2 → +3". The ring flares at 50, 70 and 90 and stays capped at 100.
    - **PokéDollars and Items:** coins fly to the purse. A purchase flies the Item from the PokéMart or the hand to the Bag. Using an Item plays a small effect on its target.
    - **Supporters:** the Released cards burn away, then the effect, then "Favour!" and its Recognition.
    - **Locations:** a new one unfolds over its lanes and an expiring one folds away. Retaining a card shows a small lock.
    - **Brackets** (removed in B3-1): an ambient effect while a bracket of 2+ was active (CSS transforms; off in low motion), and a pulse naming a bracket when it was reached.
    - **Supper:** the Strats resolve; each dominated Location's plate glows on the winner's side, then its Recognition flies; then Objective progress; then the countdowns; then the hand slides to the Discard Pile, and Retained cards stay.
    - **Breakfast:** "Round N", a summary strip, then the new hand deals in.
    - **Banners:** "Round N", "Your turn", "Opponent's turn" and "Supper", each 0.7 s at Normal.
    - **The Tournament:** a stadium sweep across all 9 lanes, then the existing banner; closing the banner stamps "×1.5" on each ring.
    - **The end of the match:** the winner's ring fills and flares "Champion", then the end screen. The end screen and the Tournament banner wait for the beats.
  - **AI pacing:** a thinking pause (0.5 s at Normal) with "The Opponent is thinking…" in the prompt bar. Then the prompt bar names the action, and anything with a target gets the arrow from its source to its target for 0.4 s, before the beat.
  - **Speed:** Slow, Normal, Fast and Instant (×1.5, ×1, ×0.5, none), plus a Low motion toggle, beside the React timer. Both are kept in localStorage inside try/catch.
    - Low motion is on by default under the OS's reduced-motion setting. It means fewer particles, no shake, no distortion and no ambient effects.
    - `?autoplay` uses Fast. The layout tool uses `?speed=instant`.
    - `?timescale=N` (checks only) stretches every beat, so a slow renderer can be screenshotted mid-beat.
  - **Sound hooks:** `sfx(name, opts)` in `src/ui/sound.js` is a no-op, called at every beat. The calls are kept for `?debug` checks.
  - **Performance:** the WebGL loop runs only while an effect is alive. With nothing playing, a frame takes 16.7 ms (60 fps), with WebGL or without. Textures load once from `assets/vfx/manifest.json`. All 25 are present, so no placeholders were drawn.
  - **Polish:**
    - The log ticker trims each line by measured width: canvas `measureText` with a binary search, in the font the browser actually uses.
    - A bug where a new match could leave the AI loop stopped is fixed. It happened when the old loop was still waiting, because the new loop was refused.
  - **Checks:**
    - **`node v4/tests/ux4.test.js`** checks, without a browser:
      - every event type in 30 fixed-seed AI-vs-AI matches has a beat;
      - every attack combination maps to an animation, and the five named ones are right;
      - every Command card and mode, Supporter, Item and Trainer Command has an effect;
      - every timeline, moment and planned beat is within its vfx.md budget at Normal;
      - a seeded match ends in the same state planned at Instant or Normal.
    - **`node v4/tools/ux4check.mjs`** runs in the browser:
      - a seeded match at Normal for 3 Rounds;
      - frame times;
      - click-to-skip, Instant, low motion and the no-WebGL fallback;
      - the mid-beat screenshots.
    - **Results:**
      - all nine test files pass, `ux4` with 14,498 checks;
      - the layout check is ok at all three sizes, at Instant;
      - `ux4check` passes 11 of 11: 3 Rounds at Normal in 166 s with no page errors; click-to-skip draws the new state in 78 ms.
      - **Frame times** were measured in headless Chromium, which renders WebGL in software, not on a GPU:
        - over the 3-Round match: 27.6 ms average, 233 ms worst;
        - during the Supper → Breakfast → Tournament beat: 25.9 ms average, 183 ms worst;
        - during a Flamethrower with a hit-back: 125.8 ms average, 217 ms worst;
        - idle: 16.7 ms.

        60 fps on integrated graphics still needs checking on a real machine.
- **G1 — rules and economy** (`docs/v4-gameplay-update.md` sections 1, 2 and 7, approved by Elliott on 10 November 2026). The deck is unchanged; G2 and G3 rebuild it.
  - **Pass (2.1):** you can't Pass while a Ready Pokémon of yours with unmatched Speed has a legal target. This includes the Pass that would end the Battle Phase.
    - End turn is disabled and shows the reason, e.g. "Charizard is Ready and faster than anything the Opponent has: attack first"; Space does nothing then.
    - The prompt bar says why End turn waits. The UX3 end-turn confirmation can't offer an illegal Pass.
    - The AI plays through `legalActions`.
    - The no-target case can't arise with today's guards (a guard is always itself a target). `passBlockers` and `passReason` take an optional target check so the test can stage it.
  - **React (2.2):** a React window opens only for an attack, an Adapt when it's played, and a Strat as it resolves, at the start of its owner's next turn or at Supper.
    - No window opens for summons, a Strat played face-down, or Trainer Commands.
    - At Supper the window opens before dominance, and Supper goes on once it closes.
    - A resolving Strat isn't a turn. A React that removes its target makes it fizzle.
    - The interface's React window (banner, timer, keys) works for it. Its arrow starts at the Strat's sealed card, which glows on its owner's board edge until it resolves.
  - **Costs (2.3):** `costFor(level) = ceil(level / 2)`: Level 1–2 cost 1, 3–4 cost 2, 5–6 cost 3, 7–8 cost 4. Nothing is free; Partners stay cost 4.
  - **Recognition (2.4):** dominating a Location +3, a Favour +3, dominating the Tournament +5 (8 with its passive).
  - **PokéDollars (2.5):** +$1 at each Breakfast, plus a flat +$1 for each enemy Pokémon defeated, Partners included.
  - **The PokéMart (2.6):**
    - **The rules:**
      - One Item is on sale, with its Stock: Oran Berry $1, 8 turns; Potion, Choice Band, Charcoal and Mystic Water $2, 6 turns; Leftovers $3, 4 turns.
      - Each turn by either player in the Battle Phase uses 1 Stock. At 0 a different random Item from the pool replaces it, with full Stock.
      - Stock carries across Breakfast; there's no refresh.
      - Once bought, it's Sold out until the buyer has finished their next turn, and nothing counts down meanwhile.
    - **The interface:**
      - The button, drawer and "N new" badge are gone.
      - A small card in the right-hand column shows the Item's art, name, price gem, Held or Consumed, its effect, and a Stock pip per turn left (the last one pulsing).
      - Buy leads to the existing use-or-store choice, with the reason when you can't buy.
      - Sold out shows a stamp and "Restocks after your/the Opponent's next turn". A new Item slides in with a short beat.
      - The log ticker shrank to two lines to make room.
    - **The AI** gives a small bonus to buying it, because that takes it away from the opponent.
  - **Trainer Objective point moments (2.7):** a new presenter beat for each `objectiveProgress`, for either player:
    - A dark backdrop fades in, and the Trainer's portrait slides in large from that player's side, with the name and the Objective.
    - Below it is a track of pips with the Partner's portrait at the end. The new pip stamps in with a flash and a rising "+1", the count ticks ("3 → 4 / 8"), and the Partner glows a step brighter.
    - Then the portrait slides back into the tracker, which pulses.
    - It takes about 1.2 s at Normal. Several points in one action play as one moment.
    - The final point plays a longer version (the track fills and the portrait flares gold), leading straight into the Partner's arrival.
    - It follows the speed setting and is skippable. Low motion keeps the stamp and the count but drops the movement.
  - **Docs:** `FOUNDATION_ASSUMPTIONS.md` is updated for every rule here, including the Breakfast order (no PokéMart refresh), the Supper order, and the Pass and React sections. The hint and reason texts are updated too.
  - **Checks:**
    - **`node v4/tests/g1.test.js`** checks Pass, the React windows, costs, Recognition and $, the PokéMart's Stock, replacement, carry-over and Sold out, and the Objective beat.
    - The existing tests were updated for the new values: costs, $ per defeat, Favour, dominance and the Tournament; summons can't be Reacted to; a resolving Strat opens a window; the one-slot PokéMart. Their time-advancing Pass helpers make a blocking Pokémon Spent first.
    - The layout check has new scenarios: the PokéMart card, a long Item text, Sold out, End turn blocked, an Objective moment mid-beat, the final point, and a React window on a resolving Strat. The mart drawer scenario is gone.
    - `node v4/tools/sim-g1.mjs` runs the 100-match AI-vs-AI summary.
- **G2 — Pokémon triggers and keywords, and the 10 new lines** (`docs/v4-gameplay-update.md` 2.3, 3, 4 and 7; approved by Elliott).
  - **The 10 lines (4.2)** replace `PATHS` exactly: forms by Level, stats, Speed, guards, one trigger per form and the keywords. The new lines are Shinx → Luxio → Luxray, Horsea → Seadra → Kingdra, Wooper → Quagsire and Magby → Magmar → Magmortar, all with existing art. Partners keep their stats; their On Summon is now a trigger.
  - **Triggers (4.1):** On Summon, On Attack, On Defend, On Defeated, On Knockout and On Breakfast, as data on each form, resolved by the engine.
    - **Effects:** draw; +N Energy; damage to a chosen enemy (On Summon only), to each enemy, to each in its Location or in the target's Location; heals; +Attack until Supper; +Attack or +Strength (kept).
    - **Resolution:** after the action that caused them, in a fixed order: by chain depth, then the acting Pokémon's, the other Pokémon's, then On Defeated. Chains go 4 levels at most.
    - Triggers can't be Reacted to.
    - "In its Location" means just its own lane when there's no Location.
  - **On Summon targets:** a chosen-target On Summon pauses the summon for its target. The summoner picks with the targeting arrow and a preview (the engine's own `choose` action on a copy). It can't be cancelled. With no target it fizzles with a log line. The AI tries each target and keeps the best.
  - **Keywords (4.1):** Quick Attack, Infiltrator, Overrun, Shell X, Regenerate X, Retaliate X and Rage. They stack with Items and Locations (a Held Item's keywords add up). Shell reduces Retaliate too, as in v2.
  - **Card text:** the trigger name in bold, then the effect in plain words; keywords as small chips, with the glossary text on hover. The hand shows chips and the trigger line; board cards show the chips; the full text is in the tooltips.
  - **The glossary** (`src/engine/glossary.js`, new): every trigger and keyword in v2's wording, adapted to v4's terms (Ready, the Player Character).
  - **Previews:** `attackPreview` now reports the damage after Shell, Retaliate, the keyword callouts and the triggers an attack sets off. `choicePreview` previews an On Summon target.
  - **Presentation:**
    - **Trigger beats:** the card flashes the trigger's name, then the effect. Damage plays the Pokémon's own attack in miniature (its counter version); heals, buffs and draws use the existing presets.
    - **Keyword callouts:** "Shell −1", "Retaliate 1", "Rage +1", "Overrun 3" and "Quick Attack", kept inside the stage. An attack's Shell and Retaliate show after its impact.
    - **Electric Physical** (Shinx, Luxio, Luxray): the spark rush, from the shared lightning and impact effects, is in the attack table and has its sound hook.
  - **The AI** reads triggers and keywords through the results it scores (it won't attack into a Retaliate that would defeat its attacker for nothing), adds a little value for keywords on the board (Infiltrator's reach most), and picks On Summon targets.
  - **Docs:** `FOUNDATION_ASSUMPTIONS.md` has the 10-line table and a new section 4b (triggers, effects, keywords, resolution order, chains).
  - **Checks:**
    - **`node v4/tests/g2.test.js`** (449 checks): every line at every Level against 4.2 (written out independently), each trigger's moment, each keyword, the order, the chain cap, no React, choices, Overrun's Recognition (and ×1.5 in the Tournament), and 20 AI matches.
    - **`ux3.test.js`** now checks 300 random attacks with the new Pokémon. Every preview matches the real result, including Shell, Retaliate, Rage, Overrun, On Attack, On Knockout and On Defeated.
    - The older tests stage plain board Pokémon (no trigger or keywords), since they check rules.
    - **`node v4/tools/g2check.mjs`** (browser): a hand of new Pokémon; the player's chosen-target On Summon (prompt, glowing targets, preview, click); an On Knockout chain into an On Defeated; Retaliate defeating an attacker; the Electric Physical attack; no page errors.
    - **`node v4/tools/sim-g2.mjs`** is the 100-match summary.
  - **Results:**
    - All 11 test files pass.
    - The layout check is ok at all three sizes, with the trigger text on hand cards at 1280×720.
    - `g2check` passes 6 of 6 with no page errors.
    - **The 100-match simulation:**
      - median 7 Rounds (5–9);
      - the first player wins 55%;
      - Recognition: damage 40%, Overrun 2%, defeats 23%, Location dominance 21%, Favours 9%, Objectives 3%;
      - each line is summoned in 68% (Magby) to 99% (Charmander) of the matches where it's drawn;
      - 5.3 On Summon target choices per match;
      - keywords acting per match: Rage 5.6, Shell 3.8, Quick Attack 1.2, Overrun 1.0, Retaliate 0.7.
- **G3 — the nine Commands, five Supporters, the PokéMart pool and the final 40-card deck** (`docs/v4-gameplay-update.md` section 5; approved by Elliott).
  - **G2 follow-up:** Chinchou reads "+1 Energy this Round" on the card, in the glossary, in `FOUNDATION_ASSUMPTIONS.md` and in section 4.2.
  - **Commands (5.1)**, one copy each, exactly as the table says; X Attack is no longer a Command. Each mode has its own cost and target:
    - **a Location** (Rock Slide, Surf): pick a lane; each enemy Pokémon in its Location is hit (just that lane with no Location; the whole battlefield in the Tournament);
    - **all enemies** (Heat Wave): no choice;
    - **damage, then Spent** (Bubble Beam); **+Attack kept** (Flame Charge);
    - **Dive:** the Pokémon goes back to its owner's hand and develops with the Rounds again; its Held Item returns to the PokéMart's pool; damage and anything kept are lost. Partners can't Dive.
    - **React modes on the attack:** Heat Wave hits the attacker; Surf heals the Pokémon being attacked; Bubble Beam makes the attacker Spent after its attack; Dive returns the attacked Pokémon to hand, so the attack fizzles. The React window names the target ("your Charmeleon", "the attacker").
    - Card text gives each mode's cost and effect in one short line.
  - **Supporters (5.2):** Flannery (+1 Attack until Supper to each of yours; Favour a Fire Pokémon: +2) and Pokémon Breeder (a Pokémon card from your Discard Pile into your hand; Favour an Item: 2). One Professor Oak. The player picks Breeder's cards in a small Discard picker in the Release dialog; the AI takes its highest-Level ones.
  - **Items (5.3):** the ten-Item pool with its prices and Stock. X Attack is a Consumed Item (+2 Attack until Supper). Choice Band: Held, +3 Attack, can't hit back. Quick Claw: Speed one step higher everywhere Speed is checked (Ready, Pass, the card). Rocky Helmet: Retaliate 2, adding to a printed Retaliate. Leftovers: Regenerate 1. Amulet Coin: +3 Recognition, no target (buy-to-use resolves at once).
  - **The deck (5.4):** `DEMO_DECK` is exactly the 40-card list; the deck table above is updated.
  - **Presentation:** a beat for every new card. Thunderbolt, Heat Wave, Flame Charge, Rock Slide and Ember use v1's Strategy animations; Surf (a wave sweeping the target's lanes), Bubble Beam (a bubble stream, then the target dims to Spent) and Dive (the Pokémon sinks into a ripple; its card flies back to the hand) are composed from the water presets. Each new Item and Supporter has a small effect of its own. Floating text stays inside the stage.
  - **The AI** plays every new card through `applyAction`: per-mode targets, Dive as a React when a lethal attack would cost more than the card, Breeder picks, and the new Items through the results it scores.
  - **Fixes on the way:** a React window now counts its options with the window in place (so a React whose only target is the attacker opens one); the AI loop re-checks who acts after its thinking pause.
  - **Checks:**
    - **`node v4/tests/g3.test.js`** (205 checks): every Command mode, Supporter (with and without Favour) and Item against section 5 (written out independently), Dive returning a card and fizzling an attack, Quick Claw changing Ready, Choice Band stopping a hit-back, Rocky Helmet stacking, Amulet Coin's Recognition, the deck card for card, and the AI (Dive saving a Charizard; 12 whole matches playing every new card).
    - **`ux3.test.js`** previews every mode of every Command and every Item against the real result.
    - The older tests are updated for the new pool and the 40-card deck.
    - **`node v4/tools/g3check.mjs`** (browser): plays every new card, Dive as a React in the React window, the Breeder picker and the PokéMart's new Items, with no page errors.
    - **`node v4/tools/balance.mjs`** writes the 200-match report, `v4/docs/balance-g3.md`.
  - **Results:**
    - All 13 test files pass. The layout check is ok at 1920×1080, 1366×768 and 1280×720. `g3check` passes 16 of 16.
    - **The 200-match report:** median 8 Rounds (middle half 7–8); the first player wins 48%; Recognition: damage 42%, defeats 21%, dominance 22%, Favours 11%, Objectives 3%; $13.9 earned and 6.1 Items bought per player; 3.2 different PokéMart Items per Round; 33 of 35 cards played in ≥30% of the matches where drawn (Heat Wave 22%, Quick Claw 15%); no card above 60% wins when played.
    - **Suggestions (not applied):** `perFavour` 3 → 2; `perObjective` 2 → 5 (or Misty 8 → 6 defeats); `dollarsPerRound` 1 → 2; Heat Wave's Adapt 3 → 2; Quick Claw $3 → $2; a real effect for Bubble Beam's React.
- **C1 — the card renderer, with the new card designs used everywhere a card appears** (`docs/v4-card-overhaul.md` sections 1, 2 and 6, approved by Elliott; the mockup `docs/design/v4-cards-mockup.jpg`). No rule, number or card changes.
  - **`src/ui/card.js`** (new): one renderer for every card, drawn at 340×476 and scaled: Full 340, Mini 200, Token 164, Chip 24–40. The frame paths, sizes, colours, fonts, text zones, stat tabs, cost wells and type lines are copied from the mockup's source. One frame per card type (chamfered Pokémon, notched Command, arched Supporter, eyelet Item, peaked Trainer, scrolled Location), each a dark edge, a brass hairline and an inner rule. States: playable / unplayable with its reason, Ready, Spent, damaged, selected, legal and illegal target, Retained, Sold out. The art is framed by `artFocus(cardId)` (one default for now; C2 adds a focal point per piece).
  - **Everywhere:** the hand (Mini, fanned), the board (164-px tokens), the PokéMart card (Mini, with Stock and Buy beside it), the React window, the mode picker and the Release choice (Full), the mulligan and Pokémon Breeder's Discard picker (Mini), the new Discard and Released viewers (Full), the trackers, the Bag and log lines (chips).
  - **Hover replaces tooltips:** a hand card lifts and its Full card shows above the hand; a board token's beside it, on the side with room; the PokéMart card's to its left. Reasons stay as a short line under the hovered card. Everything clickable and draggable stays so.
  - **Layout:** board tokens are 164×230 (nine lanes 172.4 px apart leave 8 px between them); the rows moved to 14 px from the board's edges; the Location plate (restyled with the cards' hairline, panel rule and type-line styling) sits in the band between; the hand sits at 778; the right column is repacked around the PokéMart's Mini card.
  - **On-card wording shortened** (the full text stays in the data for the Codex): Brock's Favour, "Release a Pokémon of Level 4 or more: +2 Strength (kept) to each of your Pokémon." → "Release a Pokémon of Level 4+: +2 Strength (kept) to each." Command mode rows on Full cards use a short form of each mode (e.g. "1 to each enemy there", "save the attacked"); the full sentence is in the React window and the mode picker.
  - **Checks:**
    - **`node v4/tests/cardtext.test.js`** (new): 737 renders of every card at every size, 4,012 text elements: no overflow, overlap, text outside its zone or frame, or text under 10 px.
    - **`node v4/tools/c1check.mjs`** (browser): the mulligan; a full match played by hand through the interface (moves chosen by the AI's chooser, then clicked); hovering each kind of card in hand, a board token and the PokéMart card; the mode picker, the Release choice, the Discard viewer and a React window, all with Full cards; no page errors.
    - **`node v4/tools/cardsheet.mjs`** renders the mockup's six Full cards, a hand and a row of tokens for comparison.
    - The layout check has new scenarios (hover zoom in hand, on the board on each side and on the PokéMart; the Discard and Released viewers). `g2check` and `g3check` are updated for the new cards (trigger tags and chevrons instead of text lines and tooltips).
- **C2 — C1 fixes, art framing and the collectable finish** (`docs/v4-card-overhaul.md` 2.3–2.5 and 3). No rule, number or card changes; the approved card design is unchanged.
  - **No text is ever cut or overlapping:**
    - **The hand:** the fan spreads across all its room before overlapping. Each covered card's name and tag (or mode chips) sit left-aligned in its visible strip, under the cost well; whatever can't show whole is hidden, and hovering still shows the Full card.
    - **The bracket chip** (removed in B3-1): one whole line per bracket type, the next bracket only when there's a line for it.
    - **The log ticker:** a short form of each entry on up to two lines; whole clauses only. The full sentence stays in the log drawer.
    - All `text-overflow: ellipsis` and JS "…" trimming are gone.
  - **Recover** has the Normal crest and the sandstone accent.
  - **The 10 debug-hook moves from C1:** two were a real interface problem: once a React card that needs a target was picked, the React window's cards and banner still covered the board, so the targets couldn't be clicked. They now step aside while you choose. The other eight were the test script's: the Tournament banner (a modal) was up and the script never clicked "To the Tournament", and it clicked a fanned hand card in its covered middle. Also new: a click on the board finishes an Item with no target (Amulet Coin), which before needed Enter or a drag. `c1check`, `g2check` and `g3check` now make every player move through real clicks (`tools/realinput.mjs`) with no debug hook; a move that can't be clicked fails the check and names the step.
  - **Focal points:** `assets/cards/focus.json` (57 pieces and the card back): the subject's centre, a face and zoom for chips, a wide crop for each Location's tile. Chips centre on faces; Location tiles keep their landmark in view. `node v4/tools/artframe.mjs <dir>` makes the contact sheets.
  - **The finish:** a soft holo band that follows the pointer on the Full and Mini sizes of the ten final forms; a richer, slowly drifting holo on Partners and Trainers at every size. Every Full card tilts under the pointer (at most 6°). Low motion keeps a still sheen and drops the movement.
  - **Checks:** `cardtext.test.js` now also renders hands of 5, 7, 9 and 11 cards and fails if any visible text is partly covered. `tools/c2shots.mjs` takes the C2 screenshots and measures frame times with five holo cards on screen.
- **C3 — the Codex, the glossary and the Rules page** (`docs/v4-card-overhaul.md` 4; `docs/v4-ux-plan.md` 10 part A). No rule, number or card changes.
  - **The Codex:** right-click anything (when no choice is in progress; right-click still cancels one), press C over anything, or click the ⓘ on a Full card. A panel opens over the right-hand column; your hand and the board's centre stay visible and the match carries on. Card first: the Full card on the left; on the right, what it does now, where its numbers come from ("Attack 11 = 8 base + 1 kept + 1 Mt. Ember + 1 Charcoal"), its keywords and triggers, and for a Pokémon its forms by Level and what it becomes next Round. Every term is a link, with Back and breadcrumbs. Esc or ✕ closes it; the React countdown waits while it's open.
  - **What it covers:** any card you can see, Locations, the Tournament, Objective trackers, Recognition rings (history by source and Round), the Energy tile, the bracket chip (now the decks panel), the PokéMart, the piles (the Deck as a count only), log lines, every glossary term and Rules.
  - **The glossary:** 93 terms written from the rules documents and the engine (`src/engine/glossary.js`). Terms link in the prompt bar, the log and the Codex.
  - **Rules:** the ? overlay has a Rules tab, a searchable one-page summary with every term a link.
  - **`?fps`:** a frame-time readout in a corner.
  - **The engine records** each player's Recognition history and this Round's Energy sources (data only).
  - **Checks:**
    - `node v4/tests/c3.test.js`: coverage of every kind of thing, the Tournament included; no dead links; the number sums over 200 random states; forms and next Round for every line at every Level.
    - `node v4/tools/c3check.mjs`: real input (right-click and C on each kind of thing, three links and Back, Rules search, right-click cancelling a choice).
    - `node v4/tools/layout.mjs`: the Codex open on each kind of thing, failing on any overflow or overlap.

- **C4 — current stats, a React window that keeps the board visible, Bubble Beam's React and hidden Strats.** The only rule changes are Elliott's two rulings of 11 November 2026.
  - **Current stats:** board Pokémon (and their hover Full card) show the Attack they will deal and their current Strength, with every source applied: Locations, brackets (then), Held Items, "until Supper" and kept gains, damage.
    - Raised: green ▲. Lowered or damaged: red ▼.
    - Strength under its maximum: a slim bar on tokens, "/9" on the Full card.
    - Hovering a raised or lowered number gives its one-line sum ("Attack 10 = 8 + 1 Mt. Ember + 1 Charcoal").
    - Hand cards keep their printed numbers; the summon preview shows what they'd be in that lane.
    - One engine helper, `src/engine/stats.js` `effectiveStats`, built on the functions combat uses.
  - **The React window:**
    - A slim bar across the top: "REACT?", the sentence, the countdown.
    - A tray over your hand: your React cards as Mini cards with their outcomes, Let it happen and the timer.
    - The board stays fully visible, with the attacker highlighted, the arrow and outcome badges on each Pokémon it touches ("11 → Strength 4 → 0 · Defeated · Opponent +2 Recognition, +$1"). Hovering a React card switches the badges to its outcome.
    - Everything clears the instant you decide, before the action plays.
  - **Bubble Beam's React:** the attack deals 2 less damage (cost 1).
  - **Hidden Strats:**
    - The Opponent's waiting Strat is a face-down card with its target marked (an arrow on hover); the log, labels and Codex never name it.
    - It flips face up as it resolves, in your React window.
    - The AI never reads your sealed Strat.
  - **Checks:**
    - `node v4/tests/c4.test.js`: shown stats against combat over 300 states; every React window's previews against what resolves; Bubble Beam; the AI's choices whichever card is sealed.
    - `cardtext.test.js` renders raised, lowered and damaged two-digit stats.
    - `node v4/tools/c4check.mjs`: real input.
    - The layout check: a React window with three React cards, and two-digit stats.- **B3-1 — cards as data, and Batch 1 of the Base Game playable.** Every card now comes from `docs/base-game/cards.json` (the approved Base Game); the earlier Location bracket system is gone (Elliott, 12 November 2026).
  - **Cards as data:** `node v4/tools/buildcards.mjs` reads cards.json's Batch 1 (79 entries: 24 Pokémon series, 12 Moves, 15 Supporters, 14 Items, 9 Locations, 5 Trainers) and writes `v4/src/data/cards.js` (committed; `--check` proves a re-run gives the same file). Every effect is structured ops from one vocabulary, documented at the top of that file; every text the game shows is generated from the ops (`src/engine/wording.js`) and equals cards.json word for word. The old card definitions and the demo deck are gone; Misty, Blaine, Starmie and Ninetales are as cards.json has them (Misty's Command costs 2, Blaine's 1).
  - **One effect interpreter** runs every trigger, Move, Supporter, Item and Trainer Command; any choice after the first waits for its player (the AI chooses through its search).
  - **New rules (design bible section 4):** On Dominate; Drain, Sturdy, Agility, Intimidate X, Stealth, Pickup; "the attack deals no damage", Shell X until Supper, becomes Spent / Active, Speed one step higher, return to hand, hand Levels (kept in hand, added to growth, capped), Type-keyword Held Items, Gain N Recognition, a trigger's damage to the enemy Player Character; Objectives for Erika (kept gains, once per effect), Lt. Surge (extra Energy from cards) and Whitney (Items bought from the PokéMart); Legendaries cost 5 and are Level 8 from the start. The readings settled here are listed in `FOUNDATION_ASSUMPTIONS.md` section 16.
  - **Decks:** `validateDeck` (40 cards, at most 2 copies, a Legendary 1, 0–3 Trainers of 1 copy each, any number of Locations). Four decks replace the demo deck: Blaine's Blitz, Misty's Tide, Erika's Garden and Surge's Storm (three had 39 cards in the prompt; each got one more card). `?deck=` and `?aideck=` choose them (blaine, misty, erika, surge); otherwise random. The decks are named in the log, the panel under the Round (where the bracket chip was) and the ? overlay.
  - **Cards:** Art Pending for cards with no art yet (a soft glow in the card's colour, "ART PENDING", drawn in code); the Grass colour and crest; Moves show their Type's crest and colour; a card that gained Levels in hand shows "▲2" by its Level; long text sets a little tighter so it still fits.
  - **The AI** plays the new cards through `applyAction`, values every effect by its result (no per-card rules), and never reads the player's hand, Draw Pile or sealed Strats.
  - **Checks:**
    - `node v4/tests/cardsdata.test.js` (1404 checks): every Batch 1 entry, the wording round-trip, the generator's stability, the cost rules, `validateDeck` on the four decks and on broken ones.
    - `node v4/tests/b3rules.test.js` (80 checks): one focused test per new trigger, keyword, effect and Objective counter.
    - Every earlier test passes, updated where they used the old cards, the demo deck or the bracket system; `g2` and `g3` now stage their triggers and keywords, and `g3` plays every Batch 1 Move mode, Supporter, Item and Trainer Command through the engine.
    - `cardtext.test.js`: 1780 renders of every card at Full, Mini and Token size, with Art Pending and hand Levels. The layout check and the real-input match (`tools/c1check.mjs`, now with a size) at 1920×1080, 1366×768 and 1280×720, no page errors.
    - **Simulation** (`node v4/tools/sim-b3.mjs 200`): 200 seeded AI-vs-AI matches for each of the 16 pairings, 3200 in all, with no errors, stalls or illegal actions; 7.9 Rounds on average. Win rates (all games / excluding mirrors): Misty's Tide 59.0% / 62.0%, Blaine's Blitz 53.8% / 55.0%, Erika's Garden 46.3% / 45.1%, Surge's Storm 40.9% / 37.9%.
- **B3-2 — Batch 2 of the Base Game playable (Psychic, Fighting, Ghost, Dark), and three B3-1 fixes.** Rulings by Elliott, 13 November 2026.
  - **Cards:** all 40 `"batch": 2` entries of `docs/base-game/cards.json` (14 Pokémon series with Mewtwo, 8 Moves, 6 Supporters, 5 Items, 3 Locations, 4 Trainers) built through `tools/buildcards.mjs`, word for word; no number or word changed, nothing unbuildable.
  - **New rules:** On Command (after an Adapt resolves or a Strat is sealed; never a React), On Supper (after Strats, before dominance, lane order, initiative first), Aura (constant; different Auras stack, copies don't); random discards and steals with the seeded random numbers (a stolen card keeps its hand Level bonus; a short hand gives what there is); Sabrina's pick from the opponent's hand; Mr. Fuji and Revive (this Round's Level, a space you choose, a normal summon); returns from the Discard Pile; Kirlia and Gardevoir's +N Levels; Gastly's line back to hand on defeat (still a defeat; its Held Item to the PokéMart); "the Pokémon that defeated it"; Destiny Bond; Close Combat, Sucker Punch, Detect, Choice Specs, X Speed, Ether, Bill, Officer Jenny's Favour, Lavender Town; the Sabrina, Bruno, Morty and Karen Objectives; Mewtwo. All in `FOUNDATION_ASSUMPTIONS.md` section 17 with their sources.
  - **B3-1 fixes:** the six B3-1 readings are confirmed (On Dominate and the Tournament, Drain after Shell, Agility blocks only Moves, Erika once per effect, Whitney's PokéMart purchases, Eevee without Normal); Sturdy resets when its card leaves play; Art Pending in the hand fan shows the glow without the words on a strip (full, hovered and Codex cards keep them).
  - **Settled here:** your own Pokémon defeated by your own effect (Close Combat's 1 damage) gives no one rewards; Destiny Bond's React needs one of your Pokémon attacked; card picks are one at a time (taken without a pick when there are no more cards than needed); the AI never re-summons a card that came back to its hand this Round.
  - **Decks:** the four B3-1 decks plus Sabrina's Mind, Bruno's Dojo, Morty's Haunt and Karen's Night; `?deck=` and `?aideck=` take all eight (sabrina, bruno, morty, karen …), otherwise random.
  - **Interface:** Psychic, Fighting, Ghost and Dark colours and crests; a card picker (the Opponent's hand for Sabrina's choice only, your Discard Pile, Bill's list by name; select, confirm, Esc unselects); Mr. Fuji's and Revive's space chosen on the board; Codex entries for On Command, On Supper and Aura; "Aura (name)" in the stat sums.
  - **The AI** plays everything through `applyAction` and values effects by their result; it reads the player's hand only inside Sabrina's pick.
  - **Checks:**
    - `node v4/tests/b32rules.test.js` (118 checks): one test per new rule, including the hidden-information test; `cardsdata` (2232 checks) covers Batches 1–2 and the eight decks; `b3rules` covers the Sturdy reset; every earlier test passes.
    - `cardtext.test.js`: 2825 renders of every Batch 1–2 card at Full, Mini and Token, plus the hand fan with Art Pending cards.
    - The layout check (with the three pickers) and the real-input match at 1920×1080, 1366×768 and 1280×720; `tools/b32check.mjs` plays each picker by real input; no page errors or failed requests.
    - **Simulation** (`node v4/tools/sim-b3.mjs 100`): 100 matches for each of the 64 pairings, 6400 in all, no errors or illegal actions, 7.8 Rounds on average. Two stalls, both a Blaine's Blitz mirror where both decks ran out of Pokémon (an open question). Win rates (all games / excluding mirrors): Misty's Tide 61.6% / 63.3%, Blaine's Blitz 61.1% / 62.6%, Karen's Night 52.7% / 53.1%, Morty's Haunt 51.9% / 52.2%, Bruno's Dojo 50.3% / 50.3%, Erika's Garden 48.8% / 48.6%, Surge's Storm 46.9% / 46.4%, Sabrina's Mind 26.8% / 23.5%.
  - **Open questions for Elliott:** what happens when neither side has any Pokémon left; whether a Pokémon returned to hand by an On Summon can be summoned again the same Round.
