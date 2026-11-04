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
| `v2/tools/` | The round-robin: `node v2/tools/roundrobin.js [matches per matchup]` |

URL options: `?seed=123` replays the same shuffle and coin flip; `?autoplay` lets the AI play both sides; `?decks=fire,grass` picks both decks.

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
  - **Notes:** Breakfast drew *up to* 7 in V1; Elliott ruled in V2 that it draws 7 on top of kept cards, as in v1. The coin flip is seeded, like v1's.
- **V2 — Locations and the Championship.** Locations as shared lanes, objectives with milestones, the Championship and the end of the match:
  - **Elliott's ruling on V1:** Breakfast draws 7 cards on top of any kept (Retain) cards, as in the current game, not "up to 7".
  - **Locations** (`src/engine/locations.js`, data only): played from hand as a Battle Action, cost 0, onto free Home lanes. Each covers 1, 2 or 3 adjacent lanes (set per card) on both sides of the board, from the lane you pick to the right. They can go over lanes where Pokémon already stand (those Pokémon are now in it), and can't be replaced. Each has a Round timer (set per card, counting the Round it's placed): at the Supper it runs out, the Location is removed, its lanes are Home again and its card goes to its owner's discard pile. Each carries Weather Tokens; the side panel shows the Rain and Sun totals (no Weather effects yet).
  - **Objectives:** each Location has one generic objective; both players have their own progress, milestones along the way and a completion reward, each paid once per player. Rewards: +Recognition (now), +1 Energy next Round (at the next Breakfast), draw a card (now). Objective kinds, as data: summon N Pokémon into this Location; attack N times from this Location; deal N damage to the enemy player (from anywhere); have N Pokémon in this Location at Supper (progress is the most there at any Supper so far); defeat N enemy Pokémon (anywhere, including an Alert defender's hit back).
  - **5 test Locations** (v1's art), 6 cards in each 40-card test deck (34 Pokémon):

    | Location | Lanes | Rounds | Weather | Objective | Milestones | Completion |
    |---|---|---|---|---|---|---|
    | Cerulean Cape ×2 | 2 | 4 | Rain 2 | Summon 3 Pokémon into it | 2: +1 Energy | +3 Recognition |
    | Eterna Forest | 3 | 4 | Rain 1, Sun 1 | Attack 5 times from it | 2: draw 1 · 4: +1 Recognition | +4 Recognition |
    | Mt. Ember | 1 | 3 | Sun 2 | Deal 10 damage to the enemy player | 5: draw 1 | +3 Recognition |
    | Route 119 | 3 | 5 | Rain 3 | Have 3 Pokémon in it at Supper | 2: +1 Energy | +4 Recognition |
    | Stark Mountain | 2 | 4 | Sun 3 | Defeat 3 enemy Pokémon | 2: draw 1 | +3 Recognition |
  - **The end of the match:** 12 Rounds. **The Championship** arrives at the start of Round 10: a Location over all 9 lanes, to the end of Round 12. Every other Location ends (milestones already earned are kept; Pokémon stay where they are). Test objective: attack 9 times in the Championship; milestones 3: +3 and 6: +5 Recognition; completion +8. After Round 12's Supper the highest Recognition wins; a tie goes to the more Championship progress, then one sudden-death Round (Round 13, the Championship stays for it). Reaching 60 Recognition at any time, including from a reward, still wins at once.
  - **Screen:** Locations as coloured frames over their lanes on both rows, their art faint behind, with the objective banner in the middle of the board, as in the mockup: name, Weather Tokens, the objective, You/Opp progress bars with milestone ticks (lit once reached), and Rounds left. Home lanes say Home. A Location card in hand (art, lanes and Rounds, Weather, objective) is played by clicking it, then a glowing lane (a dashed frame previews where it goes). Milestones, completions, the Championship's arrival and sudden death get a short toast and the frame flares (simple for now; full VFX is V8). The side panel: Round "of 12", the Championship ("Arrives for both players in Round 10", then its objective and Rounds left), Energy with milestone Energy, and the Rain/Sun totals. The phase strip moved to the top edge of the mat. The end screen says how the match was decided.
  - **AI:** places Locations where they pay (over its own Pokémon for summon/attack/presence objectives, or empty lanes of its own for summon), summons into Locations that want Pokémon, values each move's objective progress and reward Recognition, and stops starting Locations from Round 9 (the Championship would end them).
  - **Tests:** `v2/tests/locations.test.js`: placement (width, free lanes, over Pokémon, both sides, no room, no replacing), the timer, both players' progress for every objective kind, milestone and completion rewards (Energy next Round, draws, Recognition, once each), the Championship's arrival and its effect on other Locations, the Round-12 end, both tiebreakers and the sudden-death Round (and a draw), the instant win at 60 (from a reward, at Supper, during the Championship), Breakfast drawing 7 on top, the AI placing and using Locations, and 40 AI-vs-AI matches that all finish. `core.test.js` updated for the draw ruling and the Round limit. Checked in the browser: a Location placed by clicking, and an autoplay match through the Championship, without errors. The current game's suite still passes, unchanged.
  - **How AI-vs-AI matches end** (seeds 1–40): 9 won at 60 before the Championship, 31 won at 60 during it, none decided on the final count after Round 12 (100 seeds: 27 / 73 / 0). The design aims for about a third early. With these fixed-stat test Pokémon and the AI's eagerness to hit the player, the Championship's rewards carry the leader to 60 before Round 12 ends. Reward values are test values to tune.
  - **Placeholders and open questions for Elliott:** all Location and Championship numbers (lanes, Rounds, rewards) are test values. Locations played after Round 9 still end when the Championship arrives (the AI avoids that). (The other V2 questions were settled in V3: see below.)
- **V3 — Training.** Pokémon as Training series, the cap, the cost curve, Empowered summon, training on the board, and a deck builder:
  - **Elliott's rulings on V2:** a tie after the sudden-death Round is a draw. A Location's timer counts the Round it's placed in, worded "Lasts N Rounds, including this one" (on the card, in the deck builder). "Deal damage" and "defeat" objectives count only damage and defeats by your Pokémon in that Location (an Alert defender's hit back counts from its own lane); Mt. Ember and Stark Mountain now say "from this Location". Reward cards drawn at Supper are kept. Tests updated for each.
  - **Series** (`src/engine/series.js`, data only): one entry per species line, with every Level's Attack and Strength, species name, ability and art. Three-stage lines evolve every 2 Levels (Horsea L1–2 · Seadra L3–4 · Kingdra L5–6), two-stage lines every 3 (Growlithe L1–3 · Arcanine L4–6), single-stage Pokémon train L1–6 without evolving. Level 7 is for Legendaries only. A stage without art yet uses the line's base art (Seadra and Kingdra show Horsea, as in the training mockup).
  - **The cap:** a deck card is a series plus a chosen cap (`{ series, cap }`). In a match its Level = the Round number, up to its cap, in hand, draw pile and discard alike (it keeps following the Round when drawn, discarded or reshuffled). Once played it stays at that Level (frozen), unless an effect trains it.
  - **Cost:** Level 1→1, 2→1, 3→2, 4→3, 5→3, 6→4, Legendary 7→6. Weight classes shift it: light −1 (never below 0), standard 0, heavy +1, very heavy +2 (so a heavy Legendary costs 7 at Level 7).
  - **Copy slots:** each card in a series uses 1 copy slot of its rarity (v1's limits: Common 3, Rare 2, Epic 1, Legendary 1), and at most one Legendary card in a deck. Locations count as Common.
  - **Empowered summon** (only on Pokémon that have it): when summoning you may pay extra Energy for the bonus printed on the card. The Growlithe line has "+2: +2/+2 and Quick Attack", the Ponyta line "+1: Quick Attack" and Kyogre "+2: +2/+2". You choose in a small dialog (the Growth chooser's style) after picking the space; the bonus stays if the Pokémon is later trained.
  - **Training on the board:** the effect op `{ op: 'train', amount: N }` raises a played Pokémon's Level by N, up to its cap (never into Level 7), applying the new Level's stats, name and ability. Damage carries over and never defeats it (at least 1 Strength is left), as with Evolution in the current game. This is the engine for Grass's Growth in V6. The test card: **Chansey** ("On summon: train 1 your lowest-Level Pokémon"; train 2 from Level 4: its ability gets stronger with its Level).
  - **Test series:** Horsea, Growlithe and Oddish lines, Chansey (single-stage) and Kyogre (Legendary, L1–7), as asked; to fill a 40-card deck within the copy limits, the other test Pokémon became lines too (Charmander, Bulbasaur, Goldeen, Ponyta, Chinchou, Wooper, Sudowoodo, Sneasel, Magmar). All stats are test values; art is v1's. The premade deck (34 Pokémon with mixed caps and 6 Locations) stays the default for both players.
  - **Screen:** cards in hand show their current Level (with the cap beside it, e.g. "Lv 3/6"), cost, ability and Empowered option, and update at each Breakfast; a card in hand that reaches a new stage at Breakfast flashes with "Evolved: Gloom!". On the board the Level badge shows the frozen Level; a trained Pokémon flashes with its new Level and name.
  - **Deck builder** (the "Deck builder" link at the top): every series with its stages, rarity, Type, weight and Empowered option; add cards, set each card's cap (showing its species and cost at the cap) or remove it; Locations by count; the copy limits per series, the card count and the deck's problems (the engine's `deckProblems`). "Use this deck" saves it in this browser and starts a match with it; "Premade deck" resets. The Opponent always plays the premade deck.
  - **AI:** scores a summon by what it adds to its board (stats, keywords, and any Pokémon an ability trains) instead of by cost; values waiting: a card whose cap is above its Level loses part of what it would gain in two Rounds (more with Retain, since it stays in hand), so it plays low-capped cards first and saves high-capped ones, until the Championship; and tries Empowered summon as its own move (its bonus, less 1.5 per extra Energy).
  - **Tests:** `v2/tests/training.test.js`: Level from Round and cap (in hand, draw pile and discard through 7 Rounds); the freeze on play; the cost curve and weight classes; evolution names and stats per Level and the art fallback; the level-up event; Empowered summon (cost, bonus, Quick Attack, not on other Pokémon); train N (cap, damage carry-over, never defeats, no Level 7, Empowered bonus kept) and Chansey; copy slots; the deck builder's validity check; the AI's waiting and Empowered choices; and 40 AI-vs-AI matches that finish. `setup.test.js` checks every Level of every series has art (its own or the line's base art). Checked in the browser: the Empowered dialog, the deck builder, and an autoplay match, without errors. The current game's suite still passes, unchanged.
  - **The numbers** (40 AI-vs-AI matches): **average Level when played 3.79**. Stages seen when played: Basic 39%, Stage 1 29%, Stage 2 14%, single-stage 14%, Legendary 5%. 22% of summons Empowered; Chansey trained 48 Pokémon. Most-played species: Oddish, Arcanine, Ponyta, Charizard, Bulbasaur, Growlithe. Match ends: 20 at 60 before the Championship, 20 at 60 during it (Level growth makes the race faster than in V2's 9/31).
  - **Placeholders and open questions for Elliott:** every series' stats, weights, rarities and Empowered bonuses are test values, and abilities are only Chansey's train and the existing keywords for now. Copy limits use v1's (Common 3, Rare 2, Epic 1, Legendary 1). The level-up flourish shows for cards already in hand (kept by Retain) that reach a new stage at Breakfast; newly drawn cards simply arrive at their Level.
- **V4 — card types.** Strategy breakpoints, Supporters, Items and the Bag, statuses and Weather:
  - **Elliott's ruling on V3:** a "train" effect lets the player choose its target: any of their Pokémon that can still train (Chansey may train itself). The AI chooses too. Chansey now reads "On summon: train 1 one of your Pokémon" (train 2 from Level 4); with no possible target, nothing happens.
  - **Strategy Cards with breakpoints** (`src/engine/cardtypes.js`, data only): a card is a list of breakpoints `{ cost, text, target, ops }`; the Energy you pay sets the effect, and only a breakpoint amount can be paid. When you play one, the cost chooser shows every breakpoint and what it does; the ones you can't afford (or that have no target) are greyed. A card that doesn't scale has one breakpoint (its single cost). Test cards: **Thunderbolt** (1: 2 damage to an enemy Pokémon · 3: 4 damage · 5: 4 damage to two), **Ember** (2: Burn 2 an enemy Pokémon or the enemy player · 4: also a second target · 6: every enemy), **Recover** (1: heal 2 · 3: heal 3 and Douse up to two · 5: heal 4 every friendly Pokémon, Douse them and your player character), **Quickdraw** (1: draw 1 · 3: draw 2 · 5: draw 3 and +1 Energy next Round); fixed cost: **Sleep Powder** (2) and **Leech Seed** (2).
  - **Supporters:** the cost is Release only: Release exactly N other cards from your hand (gone for the match), then the effect, then the Supporter itself is Released. No once-per-Round limit. **Favour** (renamed from Gift): if a Released card meets the condition, the improved effect replaces the plain one. The Release dialog shows the cards, marks the ones that meet the Favour, and says when it's met. Test Supporters: **Professor Oak** (Release 1: draw 3; Favour, a Location: draw 4), **Ash** (Release 2: +3 Recognition; Favour, a Pokémon of Level 4+: +6), **Pokémon Breeder** (Release 1: train 1 a chosen Pokémon and heal it 2; Favour, a Grass Pokémon: train 2, heal 3).
  - **Items, the Bag:** no PokéDollars, no PokéMart. Each player has a Bag of 6 spaces (in the side panel, as in the mockup). Location rewards can "find an Item": the next one from a shared Item pool (one of each test Item, shuffled) goes into your Bag (nothing if the Bag is full). **Eterna Forest** (milestone at 2) and **Stark Mountain** (completion) now reward an Item. Items are also deck cards with an Energy cost: from hand you use one at once or put it into the Bag; using an Item from the Bag is a Battle Action costing 0. **Held** Items attach to a friendly Pokémon in play (one each; a new one sends the old to the pool; kept through training; lost to the pool when its Pokémon is defeated). **Consumed** Items resolve, then go back into the pool (as v1's used Items went to the PokéMart). Test Items: **Choice Band** (Held: +2 Attack), **Leftovers** (Held: Regenerate 1, heals 1 at Breakfast), **Oran Berry** (heal 3), **Full Heal** (cure a Pokémon or your player character of all statuses and heal 2; Retain), **Amulet Coin** (+1 Energy now), **Field Notes** (draw 2; no art yet, it shows the Item frame).
  - **Statuses, as in the current game:** **Burn** (stacks; at Supper deals its damage, then 1 less), **Sleep** (Spent at once; stays Spent at the next Breakfast, then wakes; damage wakes it but it stays Spent that Round), **Leech Seed** (one per Pokémon; at Supper 1 effect damage, healing the seeder's most-damaged Pokémon as much), **Douse** (removes Burn), **Full Heal** (cures all). Training into a new stage cures Sleep and Leech Seed, as Evolving did. One change: **Burn on a player character** removes that much of their Recognition at Supper (never below 0), shown on their Recognition panel ("🔥 Burn 2 · −2 Recognition at Supper"). Effect damage counts for no Location objective (it has no attacking Pokémon). Supper order: Downpour, Burn, Leech Seed, then hands are discarded.
  - **Weather** now has its effects from the current game's mechanics table (docs/decks.md 2.12), without the Growth and Evolve brackets until Grass in V6: Sun 2 each Burn applied +1 · Sun 8 Drought, no healing · Rain 2 each heal +1 · Rain 4 Burn deals 1 less at Supper · Rain 6 Leech Seed drains 2 · Rain 8 Downpour, all Burn washed away at Supper before it deals damage. The side panel lists the brackets in play.
  - **Screen:** Strategy, Supporter and Item cards in hand (art, type, cost range or Release count, every breakpoint or effect, the Favour); the cost chooser; the Release payment; an Item's "Use now / Put in the Bag" choice; target picking for any effect (purple glow; one target acts at once, up to two then Confirm; "every" needs no choice; the player character by its Recognition panel); the Bag; status chips and looks on Pokémon (Burn smoulders, Asleep dims and sways, Seeded tints green) and the Held Item's icon; toasts for Items found and Favours met. The deck builder now has Strategy, Supporter and Item rows too.
  - **The premade deck:** 22 Pokémon, 5 Locations, 7 Strategy Cards (Ember ×2, Thunderbolt, Recover, Quickdraw, Sleep Powder, Leech Seed), 3 Supporters and 3 Items (Oran Berry, Choice Band, Full Heal).
  - **AI:** tries each move on a copy of the game and scores it by how much better the position gets (Recognition, both boards, hand and Bag, Energy, statuses), so a higher breakpoint must be worth its extra Energy; it tries every affordable breakpoint with each single target and the best pair; Releases its least useful cards, or the cheapest set that meets the Favour; uses Items now, bags them, or uses them from the Bag; and chooses its train targets.
  - **Tests:** `v2/tests/cardtypes.test.js`: breakpoint costs and effects for all four scaling cards (only breakpoint amounts, affordability, target counts, "every"); single-cost cards; Supporter Release costs, self-Release, Favour, the 60 win from Recognition, and no Supporter limit; the Bag (size, Location rewards, a full Bag, use from the Bag, Held and Consumed, replacing a Held Item, Regenerate, lost with its Pokémon, kept through training); Item deck cards (cost, use or Bag, Retain); Sleep, Leech Seed, Burn on Pokémon and on player characters (not below 0), Full Heal; every Weather bracket; the AI's breakpoint, Favour and Item choices; and 40 AI-vs-AI matches that finish. The training tests check the chosen train target. Checked in the browser: the cost chooser, target picking, the Release dialog, the deck builder and an autoplay match, without errors. The current game's suite still passes, unchanged.
  - **The numbers** (40 AI-vs-AI matches): **breakpoints chosen**: Thunderbolt 1: 77, 3: 2, 5: 2 · Ember 2: 47, 4: 3, 6: 11 · Recover 1: 28, 3: 1, 5: 1 · Quickdraw 1: 79 · Sleep Powder 2: 40 · Leech Seed 2: 8. **Supporters: 5.6 per match** (both players; 23% with Favour). **Items: 2.3 found and 4.6 used per match** (2.4 put into the Bag from hand). Match ends: 19 at 60 before the Championship, 19 at 60 during it, 2 after Round 12.
  - **Reading the numbers:** the AI mostly pays the lowest breakpoint. With these test values, a cheap breakpoint gives more per Energy (Quickdraw 1 draws 1 for 1; 3 draws 2 for 3), so the higher ones rarely pay off, except Ember 6 with several enemies on the board. That is a balance point for the real cards (5: "each extra Energy must be truly worth it").
  - **Placeholders and open questions for Elliott:** every card and number here is a test value; Field Notes has no art. Copy limits: Strategy Cards and Items are Common, Supporters Rare. Strategy Cards and Items ignore the guard rules when targeting (as in v1). Held Items attach only to Pokémon in play (in v1 they could attach to one in hand and travel with it). Used and lost Items return to the shared pool, never to a deck (as v1's went to the PokéMart). Effect damage and Burn don't count for "defeat"/"damage" objectives.
- **V5 — Trainers.** Trainer cards, Trainer Points and the Breakfast assign step, tiers (Passive, Ability, Partner):
  - **Fix from V4, Elliott's rule "each extra Energy must be truly worth it":** the scaling test cards were reworked so every higher breakpoint gives more value per Energy than the one below. **Ember** 2: Burn 2 one target · 4: Burn 2 two targets and the enemy player loses 1 Recognition · 6: Burn 2 every enemy Pokémon and the enemy player, and the enemy player loses 2 Recognition. **Thunderbolt** 1: 2 damage · 3: 7 damage · 5: 7 damage to two. **Recover** 1: heal 2 · 3: heal 4 and Douse up to two · 5: heal 6 every friendly Pokémon, Douse them and your player character, draw 1. **Quickdraw** 1: draw 1 · 3: draw 3, +1 Energy next Round · 5: draw 5, +2 Energy next Round. A test checks value per Energy rises at every step (one scale: 1 per damage, heal, Burn counter or Recognition point; 2 per card; 1.5 per next-Round Energy; "every" as two Pokémon). Recognition lost this way never goes below 0.
  - **Trainer cards** (a new card type, drawn from the deck): played as a Battle Action for their cost (1–2), attached above one of your spaces for the top player or below for the bottom player, as in the mockup. A Trainer doesn't take the space: a Pokémon can stand there too. Trainers can't be attacked or targeted (no effect removes them yet). No limit on Trainers in play. **Move:** once per Round, as a Battle Action, move one of your Trainers to another of your spaces.
  - **Trainer Points:** a pool per player, earned from Location milestones and completions (Cerulean Cape completion +2; Eterna Forest milestone 4 +1, completion +2; Mt. Ember milestone +1, completion +2; Route 119 milestone +1; Stark Mountain milestone +1, completion +1) and from meeting a Supporter's Favour while you have a Trainer in play (+1). **The assign step:** at Breakfast, after drawing, both players assign their points to their Trainers in play at the same time; nothing is applied or shown until both have locked in. Points stay on the Trainer; unassigned points stay in the pool. A player with no points (or no Trainer that can use them) takes no part, and with neither, there is no step.
  - **Tiers:** each Trainer unlocks three tiers as its points reach their costs (test costs 2 / 4 / 6, set per Trainer): **Passive** (always on; it may refer to its space or lane), **Ability** (a Battle Action with its own Energy cost), **Partner Pokémon** (summoned at once from outside the deck into the Trainer's space at a set Level; if that space is taken, the player chooses a free space of theirs on their turn, which isn't a Battle Action; if none is free, it waits until one frees). A Partner arrives like a summon (Spent; counts for summon objectives) and, when defeated, leaves the game. Partners can't be put in a deck.
  - **Test Trainers** (v1's art; Partners have no art yet and show the Pokémon frame): **Misty** (1 Energy): your Water Pokémon in this lane +1 Strength · 1 Energy: heal a friendly Pokémon 3 · Partner Starmie L4. **Blaine** (2): each Burn you apply +1 · 2 Energy: Burn 2 the enemy player · Partner Magmar L4. **Brock** (1): your Pokémon in this space has Shell 1 (each damage it takes is 1 less, minimum 1; attacks, trades, effects and Burn) · 1 Energy: a friendly Pokémon gains Shell 1 this Round · Partner Onix L4. **Erika** (2): at Breakfast, your Pokémon in this lane train 1 · 2 Energy: put an enemy Pokémon to Sleep · Partner Tangela L4. New Partner lines: Staryu/Starmie, Onix, Tangela (Magmar's line already existed). The premade deck now has the 4 Trainers and 18 Pokémon.
  - **Screen:** Trainer tabs as in the mockup (portrait, name, points "4/6", the three tier pips, lit when unlocked; your own tabs open a small Trainer dialog with its tiers, Ability and Move); a Trainer card in hand is attached by clicking a glowing space; the assign step at Breakfast (a dialog with + and − per Trainer, the next tier, and Lock in); the move indicator (the tab slides in, with a ↔ mark); the Partner flourish (it drops in with a "Partner!" badge and a toast); waiting Partners (free spaces glow green); Trainer Points in the side panel, with whether the Round's move is used; toasts for points earned and tiers unlocked. The phase strip on top of the mat made way for the tabs.
  - **AI:** plays Trainers early into good spaces (Misty beside its Water Pokémon, Brock behind a strong one, Erika where a Pokémon can still train); assigns points one at a time to the Trainer closest to its next tier, so it finishes a tier before spreading; moves a Trainer when its Passive is clearly worth more elsewhere; uses Abilities when they improve its position; places waiting Partners. It plays the assign step through the same action, without seeing the player's choice.
  - **Tests:** `v2/tests/trainers.test.js`: playing and attaching (paid, a Battle Action, one per space, no limit); sharing a space with a Pokémon; never a target (attacks, every effect spec, Ember 6); move once per Round; Trainer Point sources (milestone, completion, Favour with and without a Trainer in play); the assign step (after drawing, both choose, hidden until both lock in, limits, points stay, no step without points); tier unlocks; every Passive (Misty's Strength follows her lane and Type, Blaine's Burn, Brock's Shell on attacks and effects, Erika's Breakfast train) and every Ability (once per Round); Partners (into the Trainer's space, a chosen free space when it's taken, waiting until a space frees, gone when defeated); the AI's Trainer placement, point assignment, moves and Abilities; and 40 AI-vs-AI matches that finish. Checked in the browser: attaching a Trainer, the Trainer dialog, the assign step and autoplay matches, without errors. The current game's suite still passes, unchanged.
  - **The numbers** (40 AI-vs-AI matches, both players together): **Trainer Points earned 9.1 per match; tiers unlocked 3.6 per match; Partners arrived 18 times (0.45 per match), in 16 of 40 matches.** Trainers played 4.4, Abilities used 1.5, Trainer moves 1.1 per match. With the first Location rewards (5.2 points per match), a Trainer rarely reached 6 and Partners arrived in only 2 of 40 matches, so Eterna Forest and Stark Mountain now give Trainer Points too. **Breakpoints chosen after the rework**: Thunderbolt 1: 50, 3: 9, 5: 12 · Ember 2: 37, 4: 10, 6: 32 · Recover 1: 13, 3: 1, 5: 5 · Quickdraw 1: 49, 3: 4, 5: 5 · Sleep Powder 2: 48 · Leech Seed 2: 10 (before: Ember 6 was chosen 11 times, Thunderbolt 5 twice). The cheapest breakpoint still comes up most, mostly when only 1–2 Energy is left after a summon.
  - **Placeholders and open questions for Elliott:** all Trainer numbers are test values. One Trainer per space (so the tabs don't overlap). An Ability can be used once per Round per Trainer. Assigning is optional: unassigned points stay in the pool. Misty's "in this lane" counts only your own Pokémon in that lane. A defeated Partner leaves the game. Partners have no art yet.
- **V6 — the v2 decks.** Fire, Water and Grass, built from the approved docs (`docs/v2-fire.md`, `docs/v2-water.md`, `docs/v2-grass.md`) and the shared Item pool (`docs/v2-items-draft.md`, treated as approved):
  - **The decks** (`src/engine/decks.js`, data only): every Pokémon series as written (stages by Level, stats L1–6, weight, rarity, suggested cap, abilities by Level, Empower), every Strategy Card's breakpoints, the Release-only Supporters with their Favours, the Trainers with Passive / Ability / Partner (Partners with their printed stats), the Locations (lanes, Weather, timer, objective, milestones, completion) and the deck Items. Each deck is 40 cards: 17 Pokémon, 8 Strategy, 4 Supporters, 3 Trainers, 4 Locations, 4 Items; all three pass the deck check. Ids are prefixed by deck (`f-`, `w-`, `g-`, `p-` for the pool), so the old test cards stay for the tests that use them and never mix with the real ones. Missing art falls back to the line's base art (Dratini and Dragonair show Dragonite; Caterpie and Butterfree, Metapod; Graveler and Golem, Geodude; Bonsly, Sudowoodo; Leafeon, Eevee), and missing Item art to the Item frame. Ghost and Dragon have no Type icon yet: those cards show a short label.
  - **The Item pool:** the 12 shared Items (Potion, Super Potion, Full Heal, Revive, X Attack, Ether, Escape Rope, Exp. Share, Amulet Coin, Quick Claw, Leftovers, Rocky Helmet), found by Location rewards; used ones go back into the pool.
  - **New rules and keywords, as general mechanics** (`src/engine/game.js`):
    - **Growth** (a pool per player): gained by effects (On Breakfast abilities, Synthesis, Mallow, Celebi, Gardenia…) and by **Sun 4** (each player +1 at Breakfast); shown as **the Growth tree** in an empty space of that player's row (the current game's four images at 1, 3, 5 and 8), and in the Energy panel.
    - **Nurture** (a Battle Action, 0 Energy): spend 2 Growth (Gardenia's lane: 1) to train 1 one of your Pokémon, once per Pokémon per Round. A Nurture button appears in the side panel.
    - **On Evolve** fires when training reaches a new stage (Nurture, Erika, Pokémon Breeder, Rare Candy, Mallow…); **"On Evolve or Summon"** fires on both.
    - **Rage:** +1 Attack (permanent, kept through training) each time it survives damage. **Agility:** no Strategy Card can choose it as a target; "every" effects still reach it (v1's rule). **Retaliate X:** when it takes damage from an attack, the attacker takes X (Shell reduces it), even if the holder is defeated. **"Can't be guarded"** is on Solar Beam 4 (see the questions). **Burn on the player character** (V4) and **Douse your player character** (Synthesis, Recover, Oran Berry, Brock).
    - Also built for these decks: **Scorch X** (its attack burns the target, the enemy player too), **Overrun** (see the questions), **Shell X**, **Regenerate X**, numbered keywords adding up (Scorch 1 + Charcoal's Scorch 1 = Scorch 2); triggers **On Summon, On Attack, On Defend, On Knockout (once per Round where it says so), On Defeated, On Breakfast, On Heal, Rally**; "in its Location" (the Pokémon's Location; at Home, all of Home, the starting location of 1.1); "a chosen Location" (any Location in play, or Home); "this Round" and "until your next Breakfast" buffs; permanent gains (Rally, Rage, On Heal) kept through training; **Weather Tokens on Pokémon** (Wingull, Sunkern, Kyogre) counting toward the brackets; **Search, Return, look at the top N, take an Item from the enemy Bag, free summon, grant Retain** (the player picks in a dialog; the AI and abilities that fire on their own pick by value); **Solar Beam** spending 1 up to its most in Growth (an amount chooser); effect damage to a player character gaining its dealer that much Recognition (Fire Blast, Hydro Pump, Thunderbolt, Solar Beam); Held Items with a Type bonus (Charcoal, Mystic Water, Miracle Seed), a Strength loss that never goes below 1 (Choice Band), Speed one tier higher (Quick Claw, up to Swift), Big Root; Wallace's cost discount; Misty's +1/+1; Flannery's lane Overrun; Blaine's lane Burn; Ramos's lane drain; Kabu's lane Strength.
  - **Deck selection:** before the coin flip, the side panel picks You and Opponent: Fire, Water, Grass or Random (mirrors allowed), or Your deck when one is built; remembered in this browser. The header names the decks in play. The deck builder lists the real series and cards of all three decks (86 rows), with each deck's list as its "premade" starting point.
  - **AI deck plans:** **Fire** values its own Recognition more and Burn on the enemy player (it strips their Recognition each Supper), so it races and burns. **Water** values its board more, Location progress more, Locations more when placing them, and a board still standing from Round 8 (toward the Championship). **Grass** values Growth highly, Nurtures (training is board worth), and holds its Growth for a Solar Beam of 5+ unless it's late or the beam wins. All three play the new mechanics through the same actions as the player.
  - **Tests:** `v2/tests/decks.test.js`: deck legality for all three (counts by type, copy limits, one Legendary, the copies and caps as written, the 12-Item pool); stages, stats, weights, guards, Type and Speed changes by Level; Growth and Nurture (cost, once per Pokémon per Round, Gardenia, On Breakfast, Sun 4, Weather on Pokémon, Sunflora's Sun bonus); On Evolve (Ivysaur), "On Evolve or Summon" (Gloom by choice, Bellossom on all); Solar Beam (amounts, Growth spent, "can't be guarded" on its 4) and Douse on the player character; Scorch (on Pokémon and the player), Overrun, Rage, Agility (and an "every" card still reaching it), Retaliate, Shell 2, Quick Attack; On Summon (Houndour, Charizard with Empower), On Defend (Duskull, Geodude), On Knockout once per Round (Weavile), On Defeated (Sewaddle), Splash and Gyarados, Rally (Horsea), On Heal and On Breakfast (Vaporeon, Chansey); a sample of Strategy Cards, Supporters (Firebreather and Chili with Favour, Burglar, Fisherman, Tracey, Swimmer, Mallow, Brock until Breakfast), Trainers (Blaine, Kabu, Wallace, Misty, Ramos), Items (Choice Band, Quick Claw, Charcoal by Type, Escape Rope, Exp. Share) and a Partner (Ninetales); and seeded AI matches for Fire–Water, Fire–Grass, Water–Grass and each mirror, run to the end. The earlier test files all pass unchanged in what they test. Checked in the browser: deck selection, a Grass match played by clicking (Nurture, the Solar Beam amount, card picks, targets), and the deck builder, without errors. The current game's suite still passes, unchanged.
  - **Round-robin** (`node v2/tools/roundrobin.js 40`: 40 matches per matchup, seats alternating; no tuning yet, that's V7):

    | Matchup | Result | Avg Rounds | 60 early | 60 in the Championship | Final count |
    |---|---|---|---|---|---|
    | Fire–Water | Fire 35 (88%), Water 5 (13%) | 8.0 | 34 | 6 | 0 |
    | Fire–Grass | Fire 16 (40%), Grass 24 (60%) | 7.9 | 38 | 2 | 0 |
    | Water–Grass | Water 5 (13%), Grass 35 (88%) | 7.3 | 40 | 0 | 0 |
    | Fire mirror | first seat 17, second 22, 1 draw | 10.9 | 9 | 4 | 27 |
    | Water mirror | first seat 16, second 24 | 8.3 | 32 | 8 | 0 |
    | Grass mirror | first seat 23, second 17 | 7.6 | 40 | 0 | 0 |

    Most matches are decided at 60 well before the Championship (the design aims for about a third early), and Water loses both its matchups. The Fire mirror is the exception: each side's Burn strips the other's Recognition every Supper, so 27 of 40 go to the final count.
  - **Questions for Elliott (each built with the reading below, marked "Q:" in `decks.js`):**
    1. **Overrun:** in v1 the leftover damage hit the Trainer behind. Here it goes to the enemy player character as Recognition. Right?
    2. **"Can't be guarded" (Solar Beam 4):** Strategy Cards ignore guards, as in v1, so it changes nothing yet. Should Strategy Cards (or those that hit the enemy player) obey guards, with Solar Beam 4 the exception?
    3. **"In its Location" at Home:** a Pokémon in a Home lane counts every Home lane as its Location (Home is the starting location in 1.1). Or should Home not count as a Location, so those abilities do nothing there?
    4. **"A chosen Location"** (Chili, Nurse Joy, Aqua Ring 5, Bubble Beam 6, Synthesis 3, Rock Slide, Brock): Home can be chosen too. Right?
    5. **Scorch on the player character:** Scorch burns the enemy player when the attack hits them. Right?
    6. **Entei and Celebi:** the docs give only L1, L6 and L7. Levels 2–5 are filled in evenly (Entei 4/5, 5/6, 6/6, 7/7; Celebi 3/5, 4/6, 4/7, 5/7).
    7. **Trainer costs:** the docs don't give them. Every Trainer costs 1 Energy here.
    8. **Torkoal's Attack type** isn't given: Special here.
    9. **Kingdra's "Shell 1":** read as a keyword Kingdra always has, not part of Rally.
    10. **Blissey's "and Douse them":** read as Blissey's only (Happiny and Chansey just heal).
    11. **Flannery's Ability** ("a Pokémon in her lane"): read as one of yours.
    12. **Thunderbolt (Water) 2 and 4:** read like its 6, so an enemy Pokémon or the enemy player.
    13. **Choosing targets for abilities that fire on their own** (On Evolve, On Attack, On Breakfast, Pelipper's Retain, Leafeon's train): the engine picks (the strongest enemy, the most-damaged friend, the lowest Level, the most valuable card). On Summon lets the player choose when there's one target. Should On Evolve also ask the player?
    14. **Quick Claw on a Swift Pokémon** does nothing (there's no tier above Swift). Should there be one?
    15. **Aqua Ring's Regenerate 1** is permanent. Right?

- **V7a — rulings, Legendaries, coded icons and a balance experiment.**
  - **Elliott's rulings on the V6 questions** (the "Q:" marks in `decks.js` are now ruling notes): 1, 5, 7, 8, 9, 10, 11, 12 and 15 keep the V6 reading. **Solar Beam 4** no longer says "can't be guarded". **"In its Location" at Home** is only that Pokémon's own lane (both sides of it). **"A chosen Location"** is a real Location or a single Home lane. **On Evolve targets** are chosen by the player (the AI chooses for itself), like On Summon: when there's more than one option the match waits for a `chooseTarget` action, and the board asks for the target. **Quick Claw on a Swift Pokémon** gives Quick Attack instead.
  - **Legendaries are single cards:** no series, no Levels, no cap; one fixed cost and fixed stats (Entei cost 6, 9/9; Kyogre cost 7, 10/12; Celebi cost 3, 4/6, with their abilities as written). They show a Legendary mark instead of a Level badge, and the deck builder adds them without a cap. Level 7 and the Legendary series are gone from the engine, the deck builder and the tests (the cost curve stops at Level 6).
  - **Coded icons:** v2 uses no icon images from `assets/ui/icons` (or any of the current game's icons). Every icon in v2 is a coded SVG in `src/ui/icons.js`: the 11 Types (Ghost and Dragon included), Energy, Attack and Strength types, Speed, Rarity, Weather, statuses, Trainer Points, Growth, Recognition and the Location timer. The current game is unchanged.
  - **Diagnostics** in `node v2/tools/roundrobin.js [n] [--mixed] [--variant=…]`: for each deck in each matchup, Recognition per match by source (attacks on the enemy player, Overrun, Strategy and ability damage, Locations, the Championship, other), Recognition removed by Burn, the share of attacks limited by guards, Pokémon defeated per match, the average Level played and the ending split. Baseline, 100 matches per matchup:
    - **Fire–Water 54/46**, 8.0 Rounds. Fire's 47.9 Recognition per match comes from attacks 24, Locations 9, Strategy 8 and Overrun 7. It strips 25.4 a match from Water with Burn, but 36% of its attacks are held back by guards. Water's 59.6 is mostly attacks (43).
    - **Fire–Grass 22/78**, 7.7 Rounds. Grass makes 57 a match from attacks alone, and only 3% of its attacks are limited by guards.
    - **Water–Grass 14/86**, 7.0 Rounds. Water loses 10.2 Pokémon a match to Grass's 6.0.
    - **Mirrors:** Fire 44/56, 10.5 Rounds, 55 of 100 to the final count, because each side burns away about 80 of the other's Recognition. Water 53/47 and Grass 54/46 both end early.
    - Average Level played is about 3.1–3.5 for every deck.
  - **The variant experiment** (`node v2/tools/variants.js 100`). These are flags for the tools only; nothing is a game setting. 100 matches per matchup, 50 per seat order, on top of the rulings and Legendaries above. Win rates are for the first-named deck:

    | Variant | Fire v Water (Fire) | Fire v Grass (Fire) | Water v Grass (Water) | Avg Rounds | Ends: early / Championship / final |
    |---|---|---|---|---|---|
    | baseline | 54% | 22% | 14% | 7.6 | 92% / 7% / 0% |
    | T75 | 43% | 17% | 15% | 8.4 | 82% / 16% / 2% |
    | T90 | 40% | 17% | 16% | 9.1 | 62% / 34% / 4% |
    | L+ | 57% | 24% | 19% | 7.3 | 95% / 5% / 0% |
    | CH8 | 53% | 19% | 14% | 7.6 | 52% / 48% / 0% |
    | W1 | 39% | 22% | 26% | 7.6 | 92% / 8% / 0% |
    | W2 | 49% | 22% | 22% | 7.5 | 93% / 6% / 1% |
    | T75+L+ | 45% | 20% | 15% | 8.1 | 85% / 14% / 1% |
    | T75+W1 | 37% | 17% | 25% | 8.4 | 82% / 15% / 3% |
    | T75+L++W1 | 31% | 20% | 30% | 8.1 | 87% / 11% / 1% |
    | T90+L++W1+W2 | 31% | 17% | 23% | 8.5 | 77% / 21% / 3% |
    | T75+CH8+W1 | 35% | 17% | 24% | 8.3 | 28% / 70% / 2% |

  - **Recommendation:** no set reaches the targets (every matchup at 45–55%, about a third of matches early, 9–12 Rounds), so here is what each lever moved:
    - **The target (T75, T90)** is the only lever that lengthens matches: T90 gives 9.1 Rounds with 62% early. It slightly helps whichever deck is behind on board.
    - **CH8** moves endings from "early" into the Championship (92% to 52% early, 28% with T75+W1) but doesn't change length or win rates.
    - **L+** speeds matches up a little (7.3 Rounds) and helps nobody in particular.
    - **W1** is the strongest Water lever: Fire–Water goes from 54% to 39% Fire, and Water–Grass from 14% to 26% Water.
    - **W2** is milder: Fire–Water 49%, Water–Grass 22%.
    - **What none of them fix is Grass:** 76–83% against Fire and 70–86% against Water in every variant. It's the attack race: Grass's attacks almost never meet a guard against Fire, and it loses fewer Pokémon.
    - **Smallest nearby set:** **T90 alone** for pace (9.1 Rounds, 62% early). **T90+CH8** wasn't in the list; it's the next one to try for bringing early endings toward a third (CH8 alone halved them). Any matchup fix needs a Grass lever (its attack Recognition or its guards), not a Water or Location one. Fire–Water is already balanced at baseline (54%), so W1 would tip it toward Water.
    - Nothing is committed: Elliott decides.
  - **Tests:** `setup.test.js` checks the cost curve stops at Level 6, that no v2 file references `assets/ui/icons`, and that every series Type has a coded icon. `training.test.js` checks Legendaries as single cards. `decks.test.js` checks the three Legendaries' stats and abilities, the On Evolve choice queue (player and AI), own lane at Home (Gyarados, Ivysaur), "a chosen Location" with a Home lane (Chili), Solar Beam with guards, and Quick Claw on a Swift holder (Absol). All v2 tests pass, and so does the current game's suite, unchanged. Checked in the browser: the match board and the deck builder (Legendary rows with the mark, cost and stats) with coded icons only, no errors.

- **V7b — Grass and pacing experiment.** These are flags for the tools only. Nothing changes in the game until Elliott decides.
  - **New diagnostics** (`node v2/tools/roundrobin.js`), per deck:
    - Growth gained per match, by source;
    - Nurtures per match;
    - other training per match by source, counted in Levels gained (Erika, Rare Candy, Pokémon Breeder, Leafeon, Celebi, Mallow);
    - the average Level of its Pokémon on the board at each Supper, by Round;
    - how often its guards were Asleep when an enemy attack had to go through them.
    - The engine tags each Growth gain and each training with what caused it (a `cause` on the `growth` and `trained` events, for the tools only; the rules never read it).
  - **New flags:**
    - **N3:** Nurture costs 3 (Gardenia's lane: 2).
    - **N1:** Nurture is once per Round in total.
    - **NR:** Nurture can't raise a Pokémon above the Round number + 1.
    - **GX:** only the Bulbasaur line makes Growth at Breakfast.
    - **ER:** Erika gives +1 Strength in her lane instead of training.
    - **CH9:** the Championship arrives in Round 9.
    - **F1:** Fire Pokémon +1 Strength at every Level, W1's mirror. It wasn't requested; I added it to find a Fire–Water lever.
    - `node v2/tools/variants.js 100 --set=v7b` runs the Grass set. `--configs="T90,N3,GX;…"` runs any list. `--json > file.json` and `--show=file.json` save and print the full diagnostics.
  - **Results:** every config is on top of T90, with 100 matches per matchup (50 per seat order). Win rates are for the first-named deck:

    | Variant | Fire v Water (Fire) | Fire v Grass (Fire) | Water v Grass (Water) | Avg Rounds | Ends: early / Championship / final |
    |---|---|---|---|---|---|
    | T90 | 40% | 17% | 16% | 9.1 | 62% / 34% / 4% |
    | T90+N3 | 43% | 18% | 21% | 9.2 | 61% / 33% / 6% |
    | T90+N1 | 40% | 20% | 21% | 9.3 | 60% / 34% / 6% |
    | T90+NR | 40% | 23% | 17% | 9.2 | 61% / 34% / 5% |
    | T90+GX | 40% | 19% | 19% | 9.3 | 58% / 38% / 5% |
    | T90+ER | 40% | 18% | 15% | 9.1 | 62% / 33% / 5% |
    | T90+N3+GX | 43% | 21% | 21% | 9.4 | 55% / 38% / 6% |
    | T90+N1+GX | 40% | 25% | 20% | 9.3 | 59% / 36% / 5% |
    | T90+NR+GX | 40% | 19% | 16% | 9.2 | 58% / 37% / 4% |
    | T90+NR+N3 | 43% | 16% | 20% | 9.3 | 59% / 35% / 6% |
    | T90+NR+GX+ER | 40% | 19% | 17% | 9.2 | 59% / 37% / 4% |
    | T90+CH8 | 36% | 17% | 16% | 9.0 | 15% / 82% / 3% |
    | T90+CH9 | 38% | 15% | 16% | 9.0 | 41% / 55% / 4% |
    | T90+N3+GX+CH8 | 38% | 16% | 22% | 9.2 | 9% / 87% / 4% |
    | T90+N3+GX+CH9 | 39% | 14% | 21% | 9.3 | 30% / 65% / 5% |
    | T90+N1+GX+CH8 | 36% | 24% | 20% | 9.2 | 8% / 89% / 3% |
    | T90+N1+GX+CH9 | 38% | 22% | 21% | 9.2 | 31% / 66% / 3% |
    | T90+F1 | 47% | 31% | 16% | 9.1 | 62% / 33% / 5% |
    | T90+F1+CH9 | 47% | 27% | 16% | 9.0 | 38% / 57% / 5% |
    | T90+N1+GX+F1+CH9 | 47% | 41% | 21% | 9.3 | 29% / 66% / 4% |
    | T90+N3+GX+F1+CH9 | 50% | 44% | 21% | 9.3 | 25% / 71% / 4% |
    | T90+N3+GX+F1+W1+CH9 | 35% | 44% | 35% | 9.4 | 26% / 70% / 5% |
    | T90+N1+GX+F1+W1+CH9 | 36% | 41% | 42% | 9.3 | 26% / 70% / 4% |
    | T90+F1+W1+CH9 | 36% | 27% | 25% | 9.1 | 36% / 59% / 4% |
    | T90+N3+GX+W1+CH9 | 22% | 14% | 35% | 9.2 | 33% / 62% / 5% |

  - **What the diagnostics show** (T90 alone):
    - **Grass's board runs about a Level ahead from Round 2.** Board Level at Supper:
      - Grass: 2.2 / 3.2 / 4.1 / 5.0 in Rounds 2–5 against Fire, and 5.7 from Round 7.
      - Fire: 1.7 / 2.5 / 3.3 / 4.0 in Rounds 2–5.
      - Water: 1.6 / 2.2 / 2.7 / 3.5 in Rounds 2–5.
    - **Grass's Growth:** about 45 a match against Fire and 38 against Water. The largest sources are the Bulbasaur line (12–15), Synthesis (6–10) and the Oddish line (5).
    - **Grass's training:** 10–11 Nurtures a match, plus 5–7 Levels from other training (Celebi 2.5–4, Pokémon Breeder 2.2).
    - **The bigger cause is guards.** Fire's Pokémon have Hitpoints Strength (16 of 17) and no Defence guards, so only 3% of Grass's attacks and 4% of Water's meet a guard. Meanwhile 34% of Fire's attacks are limited by Grass's Defence guards. Grass's 85 attack Recognition a match against Fire comes from that.
    - **Asleep guards are rare:** 5–7% of the guards an attack had to go through (Water's and Fire's guards, put to Sleep by Grass). Sleep isn't a factor.
  - **What each lever moved:**
    - **Each Grass lever on its own** moves Grass's matchups only 2–6 points. Grass still wins 77–84%.
    - **N1+GX** halves Nurtures (9.8 → 5.4 a match) and slows the board by about half a Level from Round 3. Fire then wins 25% against Grass.
    - **N3+GX** gives 21% in both of Grass's matchups.
    - **NR and ER do almost nothing:** Grass rarely Nurtures past Round + 1, and Erika trained only about 0.3 Levels a match.
    - **CH9** gives about a third early (30–41%) without changing win rates. **CH8** pushes almost everything into the Championship (8–15% early). Average Rounds stays about 9.0–9.4 with either.
    - **F1** restores Fire–Water (40% → 47%) and helps Fire against Grass (17% → 31%).
    - **With F1, the Grass levers finally move Fire–Grass:** 41–44% with N1+GX or N3+GX, plus CH9.
    - **Water–Grass stays near 21% until W1 is added.** T90+N1+GX+F1+W1+CH9 gives 42%, but W1 pulls Fire–Water back to 36%.
  - **Recommendation:**
    - **No set reaches all three targets.** The closest is **T90 + N1 + GX + F1 + W1 + CH9**: Fire–Water 36%, Fire–Grass 41%, Water–Grass 42%, 9.3 Rounds and 26% early (16–38% by matchup).
    - **The smallest set that meets two of the three targets** (pace and endings) **and restores Fire–Water** is **T90 + F1 + CH9**: 47% / 27% / 16%, 9.0 Rounds, 38% early. It leaves Grass far too strong.
    - **Next to try:** Fire +2 with W1 (F1 moved Fire–Water by +7 and W1 by −14), or a guard lever for Fire. Fire's lack of Defence and Special Defence guards is the root of both Fire–Water and Fire–Grass.
  - **Fire–Water under T90 (40%):** **F1** (Fire Pokémon +1 Strength) restores it to 47%. That's the small lever.
  - **Tests:** `v2/tests/variants.test.js`:
    - each flag does only what it says, and nothing changes without it: N3 (and Gardenia's lane), N1 (and again the next Round), NR, GX, ER, F1, T90 and CH9;
    - the cause tags: Bulbasaur and Oddish Growth, Erika training, Nurture;
    - a seeded run fills every new diagnostic.
    - All v2 tests pass. The game in the browser is unchanged.

- **V7c — guards experiment.** These are flags for the tools only. Nothing changes in the game until Elliott decides.
  - **New flags:**
    - **LG, lane guards.** A Defence or Special Defence guard only restricts attacks on targets in its own lane. With one Pokémon per space, that leaves only the enemy player: an attack on the player is blocked only by a matching guard in the attacker's own lane (the space across). Every enemy Pokémon can be attacked. Infiltrator still ignores guards.
    - **FG, Fire guards.** Growlithe → Arcanine has the Defence Strength-Type, with the same numbers. Duskull → Dusclops goes to 2 copies, replacing 1 Mankey; the deck stays legal at 40 cards.
    - `node v2/tools/variants.js 100 --set=v7c` runs them, each on top of T90 + CH9.
  - **New diagnostics:** for each deck, the share of its attacks on a target in its own lane and the share on the enemy player.
  - **Results:** every config is on top of T90 + CH9, with 100 matches per matchup (50 per seat order). Win rates are for the first-named deck:

    | Variant | Fire v Water (Fire) | Fire v Grass (Fire) | Water v Grass (Water) | Avg Rounds | Ends: early / Championship / final |
    |---|---|---|---|---|---|
    | T90+CH9 | 38% | 15% | 16% | 9.0 | 41% / 55% / 4% |
    | T90+CH9+LG | 47% | 15% | 17% | 8.8 | 48% / 48% / 4% |
    | T90+CH9+LG+F1 | 56% | 35% | 17% | 8.8 | 45% / 52% / 2% |
    | T90+CH9+LG+N1+GX | 47% | 18% | 18% | 9.0 | 40% / 56% / 4% |
    | T90+CH9+FG | 33% | 7% | 16% | 9.1 | 38% / 56% / 6% |
    | T90+CH9+FG+F1 | 39% | 25% | 16% | 9.3 | 34% / 60% / 6% |
    | T90+CH9+FG+N1+GX | 33% | 15% | 21% | 9.4 | 29% / 65% / 6% |
    | T90+CH9+LG+FG | 41% | 11% | 17% | 8.8 | 49% / 47% / 5% |
    | T90+CH9+LG+FG+N1+GX | 41% | 14% | 18% | 9.1 | 40% / 55% / 5% |
    | T90+CH9+LG+FG+F1+W1+N1+GX | 40% | 40% | 30% | 8.9 | 40% / 57% / 3% |

  - **What the guards showed:**
    - **Guards aren't Grass's edge.**
      - With FG, Grass's attacks meet a guard 13% of the time instead of 3%, yet it still makes about 86 attack Recognition a match and Fire falls to 7%.
      - Fire loses a Mankey (its cheap Overrun damage), and Growlithe's Defence only guards against Physical attacks, while 11 of Grass's 17 Pokémon attack Special.
      - With LG, guards limit only 16% of Fire's attacks instead of 34%. Fire's attack Recognition against Grass rises from 19.5 to 27.9, but its win rate stays at 15%.
    - **Grass's real edge is attack volume.** It makes 28–32 attacks a match against 15–19 for Fire and Water. It loses fewer Pokémon (7–9 against 10–11).
    - **Under LG**, attacks on a target in the attacker's own lane are only 5–11%: targeting stays "anywhere".
      - Attacks on the enemy player rise for Fire (32% → 45%) and for Water against Grass (42% → 59%).
      - Water–Grass becomes faster: 7.7 Rounds, 77% early.
  - **What each lever moved:**
    - **LG** fixes Fire–Water (38% → 47%) and nothing else.
    - **LG+F1** gives Fire–Water 56% and Fire–Grass 35%.
    - **FG** hurts Fire in both its matchups (33%, 7%). With F1 it's 39% and 25%.
    - **N1+GX** adds 0–6 points for Grass's opponents, as in V7b.
    - **Water–Grass stays at 16–18%** with every guard lever. Only W1 moves it: LG+FG+F1+W1+N1+GX gives 30%.
    - **Pacing holds with T90 + CH9:** 8.8–9.4 Rounds and 29–49% early in every config.
  - **Recommendation:**
    - **No set puts all three matchups at 45–55%.** The closest are **LG + FG + F1 + W1 + N1 + GX** (40% / 40% / 30%, 8.9 Rounds, 40% early) and the smaller **LG + F1** (56% / 35% / 17%).
    - **For Fire–Water alone, LG is the smallest fix:** 47% at T90 + CH9.
    - **For Grass, guards are the wrong lever.** The next thing to look at is why Grass attacks almost twice as often (its Speed and the Alert rule, how many Pokémon it keeps Active, Quick Attack), and Water's lack of answers to it.
  - **Tests:** `v2/tests/variants.test.js` adds:
    - LG: a guard across blocks only the player; with no guard across, the player can be attacked too; without LG, any matching guard still restricts the attack;
    - FG: Growlithe and Arcanine have Defence with the same numbers, the Fire list is still legal with 2 Duskull and 1 Mankey, and the list is unchanged without FG;
    - the own-lane and player-attack counts.
    - All v2 tests pass. The game in the browser is unchanged.

- **V7d — attack volume experiment.** These are flags for the tools only. Nothing changes in the game until Elliott decides. The baseline is T90 + CH9 + LG, with LG as interpreted in V7c (Elliott confirmed it).
  - **New flags:**
    - **C1:** no Pokémon costs less than 1 (light weight and Wallace's discount can't make it free). Free summons by card effects stay free.
    - **GS:** Grass-deck Pokémon −1 Strength at every Level.
    - **SL:** Sleep Powder costs 3. Gloom, Bellossom and Butterfree's **On Evolve** Sleep only reaches a Pokémon of a lower Level than themselves. Gloom's On Summon Sleep is unchanged, as written.
    - `node v2/tools/variants.js 100 --set=v7d` runs them.
  - **New diagnostics,** per deck:
    - Pokémon in play per Round (counted at each Supper);
    - 0-cost summons per match;
    - attacks per Pokémon per Round;
    - passes per match;
    - the share of its attacks that hit a Spent target, and how many of those were Asleep;
    - Pokémon defeated per match.
  - **Results:** every config is on top of T90 + CH9 + LG, with 100 matches per matchup (50 per seat order). Win rates are for the first-named deck:

    | Variant | Fire v Water (Fire) | Fire v Grass (Fire) | Water v Grass (Water) | Avg Rounds | Ends: early / Championship / final |
    |---|---|---|---|---|---|
    | T90+CH9+LG | 47% | 15% | 17% | 8.8 | 48% / 48% / 4% |
    | T90+CH9+LG+C1 | 41% | 10% | 13% | 9.0 | 42% / 53% / 4% |
    | T90+CH9+LG+GS | 47% | 41% | 26% | 9.2 | 35% / 60% / 5% |
    | T90+CH9+LG+SL | 47% | 18% | 15% | 8.8 | 50% / 46% / 4% |
    | T90+CH9+LG+C1+GS | 41% | 33% | 21% | 9.3 | 33% / 62% / 5% |
    | T90+CH9+LG+C1+SL | 41% | 12% | 11% | 8.9 | 43% / 54% / 4% |
    | T90+CH9+LG+C1+GS+SL | 41% | 28% | 20% | 9.3 | 32% / 64% / 4% |
    | T90+CH9+LG+C1+F1 | 54% | 32% | 13% | 8.9 | 42% / 56% / 2% |
    | T90+CH9+LG+C1+GS+F1 | 54% | 62% | 21% | 9.2 | 33% / 65% / 2% |
    | T90+CH9+LG+C1+GS+F1+W1 | 50% | 62% | 34% | 9.2 | 33% / 65% / 2% |
    | T90+CH9+LG+C1+GS+SL+F1+W1 | 50% | 62% | 34% | 9.2 | 34% / 64% / 2% |

  - **What the diagnostics show** (baseline):
    - **Grass attacks more because it has more Pokémon in play, not because each one attacks more often.**
      - Pokémon in play per Round: Grass 4.6 against Fire and 5.6 against Water; Water 3.9–4.2; Fire only 1.9.
      - Attacks per Pokémon per Round: Grass 0.77–0.84; Water 0.69–0.74; Fire 1.07–1.19.
      - Fire passes 21–27 times a match, Water 14–22, Grass 9–10.
      - Fire loses 10–11 Pokémon a match.
    - **Free summons are few:** 1.7–3.1 a match for every deck.
    - **Sleep barely matters:** 21–38% of attacks hit a Spent target, but at most 6% of those were Asleep.
  - **What each lever moved:**
    - **GS is the strong lever:** Fire–Grass goes from 15% to 41%, and Water–Grass from 17% to 26%. Grass's board shrinks, and so do its Recognition and its Pokémon in play.
    - **C1 hurts Fire and Water more than Grass:** they have light Pokémon too (Ponyta, Mankey, Wooper, Chinchou, Wingull). Fire–Water drops to 41%, Fire–Grass to 10% and Water–Grass to 13%.
    - **SL does almost nothing** (±3 points).
    - **F1** adds about 7–30 points to Fire's matchups. **W1** adds about 13 to Water–Grass.
    - **With C1 + GS + F1 + W1:**
      - Fire–Water is 50% and Fire–Grass is 62% (Fire overshoots).
      - Water–Grass is 34%, the best Water has reached in any experiment.
      - Board size against Grass evens out: Grass has 3.2 Pokémon in play and Fire 2.4.
    - **Pacing holds:** 8.8–9.3 Rounds and 32–50% early in every config.
  - **Recommendation:**
    - **No set puts all three matchups at 45–55%.** The closest is **C1 + GS + F1 + W1**: 50% / 62% / 34%, 9.2 Rounds, 33% early. SL adds nothing to it.
    - **C1 is probably not needed:** its effect works against Fire and Water. The next run to try is **GS + F1 + W1 without C1**.
    - **Fire–Grass will likely need a smaller Fire lever than F1 once GS is in.**
    - **Water–Grass still needs more than W1.** Water keeps 4 Pokémon in play but attacks least per Pokémon (about 0.7 a Round).
  - **Tests:** `v2/tests/variants.test.js` adds:
    - C1: Oddish costs 1 instead of 0, isn't playable with 0 Energy, and can't be summoned free;
    - GS: Grass −1 Strength, Fire unchanged;
    - SL: Sleep Powder at 3 (2 without SL); Gloom's On Evolve Sleep skips a higher Level, and reaches a lower one with SL or any Level without it.
    - All v2 tests pass. The game in the browser is unchanged.

- **V7e — balance search.** These are flags for the tools only. Nothing changes in the game until Elliott decides. The baseline is T90 + CH9 + LG.
  - **AI check** (`node v2/tools/aicheck.js 20 --variant=T90,CH9,LG[,GS]`): per deck, unspent Energy per Round, passes per Round (split into "a play was available" and "nothing affordable"), and hand size at Supper. For each pass made with a play available, it also records the best play skipped and how it scored.
    - **No AI bug.** In 20 matches per matchup (baseline and GS), no deck passed with an affordable play more than 1% of the time.
    - The only such passes were Water's: 2 Strategy Cards whose best target scored −3.2, below the pass's 0.
    - **Passing is about Energy, not judgement:**
      - unspent Energy is about 0.4–1.2 a Round;
      - Fire passes 2.2–3.2 times a Round and Water 1.8–3.5, both with nothing affordable;
      - Grass passes about 1.3 times a Round;
      - hand size at Supper is 2.8–3.9.
    - No AI change was made.
  - **New flags:**
    - **F½:** Fire Pokémon +1 Strength at Levels 3–6 only.
    - **WA:** Water Pokémon +1 Attack at every Level.
    - `node v2/tools/variants.js 100 --set=v7e` runs the grid.
  - **The grid:** Grass (GS | GS + N1 + GX) × Fire (none | F½ | F1) × Water (none | W1 | WA | W1 + WA) gives 24 configs. Each is on top of T90 + CH9 + LG, with 100 matches per matchup (50 per seat order). Win rates are for the first-named deck:

    | Grass | Fire | Water | Fire v Water (Fire) | Fire v Grass (Fire) | Water v Grass (Water) | Avg Rounds | Ends: early / Championship / final | Distance from 50% |
    |---|---|---|---|---|---|---|---|---|
    | GS | – | – | 47% | 41% | 26% | 9.2 | 35% / 60% / 5% | 36 |
    | GS | – | W1 | 27% | 41% | 34% | 9.2 | 32% / 64% / 4% | 48 |
    | GS | – | WA | 34% | 41% | 41% | 9.2 | 38% / 57% / 5% | 34 |
    | GS | – | W1+WA | 18% | 41% | 59% | 9.1 | 39% / 57% / 4% | 50 |
    | GS | F½ | – | 53% | 52% | 26% | 9.1 | 35% / 61% / 4% | 29 |
    | GS | F½ | W1 | 43% | 52% | 34% | 9.1 | 33% / 63% / 4% | 25 |
    | GS | F½ | WA | 43% | 52% | 41% | 9.2 | 37% / 58% / 5% | 18 |
    | GS | F½ | W1+WA | 19% | 52% | 59% | 8.9 | 38% / 59% / 3% | 42 |
    | GS | F1 | – | 56% | 55% | 26% | 9.0 | 38% / 59% / 3% | 35 |
    | GS | F1 | W1 | 50% | 55% | 34% | 9.0 | 39% / 58% / 3% | 21 |
    | GS | F1 | WA | 43% | 55% | 41% | 9.1 | 40% / 57% / 3% | 21 |
    | GS | F1 | W1+WA | 21% | 55% | 59% | 9.0 | 36% / 63% / 1% | 43 |
    | GS+N1+GX | – | – | 47% | 42% | 32% | 9.3 | 31% / 63% / 6% | 29 |
    | GS+N1+GX | – | W1 | 27% | 42% | 46% | 9.3 | 31% / 64% / 5% | 35 |
    | GS+N1+GX | – | WA | 34% | 42% | 50% | 9.5 | 26% / 68% / 6% | 24 |
    | GS+N1+GX | – | W1+WA | 18% | 42% | 78% | 9.2 | 37% / 58% / 5% | 68 |
    | GS+N1+GX | F½ | – | 53% | 66% | 32% | 9.2 | 29% / 68% / 3% | 37 |
    | GS+N1+GX | F½ | W1 | 43% | 66% | 46% | 9.2 | 31% / 66% / 3% | 27 |
    | GS+N1+GX | F½ | WA | 43% | 66% | 50% | 9.5 | 24% / 72% / 4% | 23 |
    | GS+N1+GX | F½ | W1+WA | 19% | 66% | 78% | 9.1 | 34% / 64% / 2% | 75 |
    | GS+N1+GX | F1 | – | 56% | 73% | 32% | 9.1 | 36% / 60% / 4% | 47 |
    | GS+N1+GX | F1 | W1 | 50% | 73% | 46% | 9.0 | 40% / 56% / 3% | 27 |
    | GS+N1+GX | F1 | WA | 43% | 73% | 50% | 9.3 | 30% / 66% / 4% | 30 |
    | GS+N1+GX | F1 | W1+WA | 21% | 73% | 78% | 9.1 | 36% / 62% / 2% | 80 |

  - **No config puts all three matchups at 45–55%.**
  - **The 5 closest configs,** by total distance from 50%:
    1. **GS + F½ + WA:** 43% / 52% / 41%, 9.2 Rounds, 37% early (distance 18).
    2. **GS + F1 + W1:** 50% / 55% / 34%, 9.0 Rounds, 39% early (21).
    3. **GS + F1 + WA:** 43% / 55% / 41%, 9.1 Rounds, 40% early (21).
    4. **GS + N1 + GX + F½ + WA:** 43% / 66% / 50%, 9.5 Rounds, 24% early (23).
    5. **GS + N1 + GX + WA:** 34% / 42% / 50%, 9.5 Rounds, 26% early (24).
  - **Pacing:** 8.9–9.5 Rounds and 24–40% early in every config.
  - **Which lever moves which matchup:** each matchup depends only on its own two decks' levers, so the effects can be read straight off the grid.
    - **Fire–Water** (47% with no Fire or Water lever):
      - F½ adds 6 and F1 adds 9;
      - W1 takes away 20, WA 13, and W1 + WA 29.
    - **Fire–Grass** (41% with GS alone):
      - F½ adds 11 and F1 adds 14;
      - N1 + GX adds 1 on its own, but 14 with F½ and 18 with F1.
    - **Water–Grass** (26% with GS alone):
      - W1 adds 8, WA 15, and W1 + WA 33;
      - N1 + GX adds 6 on its own, and about 6–19 more with the Water levers.
  - **Why no set lands:**
    - Every Water lever that lifts Water–Grass into range costs Fire–Water more than any Fire lever gives back (WA −13 against F1 +9).
    - Every Grass lever strong enough for Water–Grass (N1 + GX) pushes Fire–Grass past 55% once Fire has its boost.
    - The closest, **GS + F½ + WA**, still needs about +2 for Fire against Water and about +4 for Water against Grass.
  - **Recommendation:** if one of these is adopted, **GS + F½ + WA** (three card-stat changes, no rule changes). To close the last gap, it needs a lever that only touches Water against Grass, or Fire against Water. One example would be a Water card that answers Grass's wide board. A blanket stat change can't do it, because each one moves two matchups at once.
  - **Tests:** `v2/tests/variants.test.js` adds:
    - F½: Fire unchanged at Level 2, +1 Strength at Level 4;
    - WA: Water +1 Attack, Grass unchanged;
    - the 24-config grid.
    - All v2 tests pass. The game in the browser is unchanged.

- **V7f — confirm and finish.** These are flags for the tools only. Nothing changes in the game until Elliott decides. The baseline is T90 + CH9 + LG + GS.
  - **New flags:**
    - **WA½:** Water Pokémon +1 Attack at Levels 3–6 only.
    - **S2:** a second Surf replaces Dive in Water's deck (Surf is Rare, so 2 copies are allowed).
    - **S2c:** S2, and Surf's 3 breakpoint costs 2.
    - `node v2/tools/variants.js 400 --set=v7f-confirm` and `200 --set=v7f` run them.
    - `roundrobin.js` takes `--seed=N` and reports Surf plays and Surf damage per match. Surf damage is the Strength enemy Pokémon lost to it, capped by what each had left.
  - **The V7e top 3, confirmed at 400 matches per matchup** (200 per seat order). Win rates are for the first-named deck, with a 95% margin of error:

    | Config | Fire v Water (Fire) | Fire v Grass (Fire) | Water v Grass (Water) | Avg Rounds | Ends: early / Championship / final | Distance from 50% |
    |---|---|---|---|---|---|---|
    | GS+F½+WA | 41% ±4.8 | 54% ±4.9 | 47% ±4.9 | 9.2 | 33% / 63% / 4% | 16 |
    | GS+F1+W1 | 50% ±4.9 | 59% ±4.8 | 38% ±4.8 | 9.0 | 37% / 60% / 3% | 21 |
    | GS+F1+WA | 46% ±4.9 | 59% ±4.8 | 47% ±4.9 | 9.1 | 35% / 62% / 3% | 16 |

    - V7e's 100-match numbers held within their margin. F1 against Grass settles at 59% (above range) and F½ at 54%.
    - **GS + F1 + WA** (46% / 59% / 47%) and **GS + F½ + WA** (41% / 54% / 47%) tie at distance 16.
  - **The Water grid:** Fire (F½ | F1) × Water stats (none | WA½ | WA) × Water area damage (none | S2 | S2c) gives 18 configs, each at 200 matches per matchup (100 per seat order). The margin of error is about ±7 points. The last two columns are Water's Surf plays / Surf damage per match against Fire and against Grass:

    | Config | Fire v Water (Fire) | Fire v Grass (Fire) | Water v Grass (Water) | Avg Rounds | Ends: early / Championship / final | Distance | Surf vs Fire | Surf vs Grass |
    |---|---|---|---|---|---|---|---|---|
    | GS+F½ | 55% | 52% | 28% | 9.0 | 36% / 61% / 3% | 29 | 0.17 / 1.5 | 0.43 / 5.7 |
    | GS+F½+S2 | 54% | 52% | 23% | 9.0 | 38% / 59% / 4% | 33 | 0.29 / 2.4 | 0.69 / 9.1 |
    | GS+F½+S2c | 52% | 52% | 33% | 9.2 | 32% / 63% / 5% | 21 | 0.70 / 5.1 | 1.60 / 16.8 |
    | GS+F½+WA½ | 48% | 52% | 34% | 9.2 | 33% / 62% / 6% | 20 | 0.18 / 1.4 | 0.43 / 4.8 |
    | GS+F½+WA½+S2 | 42% | 52% | 34% | 9.2 | 34% / 63% / 4% | 26 | 0.27 / 2.0 | 0.64 / 7.2 |
    | GS+F½+WA½+S2c | 41% | 52% | 40% | 9.3 | 30% / 66% / 4% | 21 | 0.61 / 4.3 | 1.66 / 15.9 |
    | GS+F½+WA | 42% | 52% | 44% | 9.1 | 36% / 60% / 5% | 16 | 0.20 / 1.4 | 0.28 / 2.9 |
    | GS+F½+WA+S2 | 36% | 52% | 44% | 9.2 | 33% / 64% / 3% | 22 | 0.28 / 2.0 | 0.46 / 5.1 |
    | GS+F½+WA+S2c | 37% | 52% | 52% | 9.2 | 31% / 65% / 4% | 17 | 0.60 / 4.1 | 1.34 / 12.5 |
    | GS+F1 | 63% | 57% | 28% | 8.9 | 40% / 57% / 3% | 42 | 0.20 / 1.7 | 0.43 / 5.7 |
    | GS+F1+S2 | 63% | 57% | 23% | 8.9 | 41% / 56% / 3% | 47 | 0.29 / 2.5 | 0.69 / 9.1 |
    | GS+F1+S2c | 54% | 57% | 33% | 9.2 | 33% / 63% / 4% | 28 | 0.90 / 6.9 | 1.60 / 16.8 |
    | GS+F1+WA½ | 50% | 57% | 34% | 9.1 | 37% / 61% / 3% | 23 | 0.17 / 1.3 | 0.43 / 4.8 |
    | GS+F1+WA½+S2 | 53% | 57% | 34% | 9.1 | 37% / 61% / 3% | 26 | 0.26 / 2.0 | 0.64 / 7.2 |
    | GS+F1+WA½+S2c | 50% | 57% | 40% | 9.2 | 33% / 64% / 4% | 17 | 0.83 / 6.1 | 1.66 / 15.9 |
    | GS+F1+WA | 48% | 57% | 44% | 9.0 | 40% / 57% / 3% | 15 | 0.19 / 1.4 | 0.28 / 2.9 |
    | GS+F1+WA+S2 | 49% | 57% | 44% | 9.1 | 37% / 60% / 4% | 14 | 0.28 / 2.0 | 0.46 / 5.1 |
    | GS+F1+WA+S2c | 47% | 57% | 52% | 9.2 | 34% / 62% / 4% | 12 | 0.83 / 6.1 | 1.34 / 12.5 |

  - **No config puts all three matchups at 45–55%.**
  - **The 5 closest:**
    1. **GS + F1 + WA + S2c:** 47% / 57% / 52%, 9.2 Rounds, 34% early (distance 12).
    2. **GS + F1 + WA + S2:** 49% / 57% / 44% (14).
    3. **GS + F1 + WA:** 48% / 57% / 44% (15).
    4. **GS + F½ + WA:** 42% / 52% / 44% (16).
    5. **GS + F½ + WA + S2c:** 37% / 52% / 52% (17).
  - **Pacing holds everywhere:** 8.9–9.3 Rounds and 30–41% early.
  - **What moved what:**
    - **S2c is the Water lever that helps against Grass without hurting Fire–Water much.**
      - Surf plays against Grass rise from about 0.3–0.4 to 1.3–1.7 a match, and Surf damage from 3–6 to 12.5–17.
      - Water–Grass rises by 7–9 points.
      - Against Fire, Surf does far less (4–7 damage a match), because Fire keeps only about 2 Pokémon on the board.
      - Fire–Water drops 1–9 points (the most, 63% → 54%, with F1 and no Water stats).
    - **S2 without the cheaper breakpoint does little.** Water rarely pays 3 for it: 0.5–0.7 plays a match against Grass.
    - **WA½ is between none and WA** in both of Water's matchups.
    - **F1 against F½:** Fire–Water about +5 points; Fire–Grass +5 (59% against 54% at 400 matches).
  - **Recommendation:**
    - **GS + F1 + WA + S2c** comes closest: Fire–Water 47%, Water–Grass 52%. Fire–Grass is 57% here; at 400 matches the same Fire–Grass pairing (GS + F1) measured 59% ±4.8, so it is genuinely a little high.
    - **The swap to F½ fixes Fire–Grass** (52–54%) **but costs Fire–Water about 5–10 points** (37–42%).
    - **The last step needs a Fire change worth about +5 against Water and −4 against Grass,** something between F½ and F1 that matters more against Water. If Elliott takes this set as it stands, every matchup lands within about 7 points of 50%.
  - **Tests:** `v2/tests/variants.test.js` adds:
    - WA½: no change at Level 2, +1 Attack at Level 4;
    - S2 and S2c: the Water list is still legal with 2 Surf and no Dive;
    - Surf's breakpoints: 3/5 with S2 and 2/5 with S2c;
    - the V7f sets.
    - All v2 tests pass. The game in the browser is unchanged.
