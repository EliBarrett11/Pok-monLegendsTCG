# Pokémon Legends TCG

A browser version of Elliott's custom card game, played against an AI opponent. Built from scratch one small feature at a time.

## Play

- **Online:** the GitHub Pages link for this repo (Settings → Pages).
- **Locally:** run `python3 -m http.server` in this folder and open http://localhost:8000. (Opening `index.html` directly won't work, because browsers block JS modules from `file://`.)

## Layout

| Folder | What lives there |
|---|---|
| `src/engine/` | Game rules only. No DOM, so the AI and tests use the same rules. |
| `src/engine/cardData.js` | Card definitions as data (Pokémon, Trainers). Replace the placeholders with real cards here. |
| `src/engine/effects.js` | The effect system: what every card effect means, as data. |
| `src/ai/` | The AI opponent's decision-making. |
| `src/ui/` | Drawing the board and handling clicks. |
| `docs/rules.md` | The game's rules, written as they're settled. |
| `assets/` | Card art and other images. |

No build step: plain HTML, CSS and JavaScript modules. Working rules for each session are in `CLAUDE.md`.

## Build log

- **Step 0** — project shell: empty board, turn indicator, game log.
- **Step 1** — match setup: Battle Arena, secret Trainer placement, coin flip for initiative, Round 1 Breakfast draw and mulligan. Stops at the start of the Battle Phase.
- **Step 2** — Round loop: Rounds run continuously from Breakfast to Battle to Supper. Breakfast sets Base Energy and Exert and draws 7 (reshuffling the Discard Pile when needed). Battle turns are Pass-only; Supper discards hands. Exert/Exhaust payment logic and Trainer Strength (placeholder 15) are in, tested ahead of use.
- **Step 3** — Pokémon cards and "Play a Pokémon Card": card definitions as data (`src/engine/cardData.js`) with 16 placeholder Pokémon. On your turn, click a Pokémon then an empty space to play it, paying Base Energy first and Exert (after a confirm) for any shortfall. Played Pokémon arrive Spent and become Active at the next Breakfast. The AI plays affordable Pokémon using Base Energy only.
- **Step 4** — Combat: Command an Alert Pokémon to attack an enemy Pokémon or Trainer, with Defence / Special Defence targeting restrictions and damage traded between two Alert Pokémon. Defeated Pokémon go to the Released Pile. Matches end in a win (all 3 enemy Trainers at 0) or a draw (no Pokémon left on either side), with a victory/defeat screen. A full match is now playable to the end.
- **Step 5** — Effect system and Trainers: a data-driven effect system (`src/engine/effects.js`) designed for Trainers, Strategy Cards, Pokémon abilities and Innate Powers. Ash, Misty and Brock replace the placeholder Trainers, with Powers (a Battle Action, once per Round) and zone Passives. Trainers at 0 Strength are removed and their zone falls on that side. The AI now scores its moves instead of choosing at random.
- **Step 6** — Strategy Cards and Innate Powers: the "Play a Strategy Card" Action with Quickdraw, Hypervoice and Recover (mostly card data on the effect system), replacing the placeholder Strategy cards in each deck. Quick Attack (summoned Active) and Agility (can't be targeted by Strategy Cards) on placeholder Pokémon. The AI plays Strategy Cards with basic sense.
- **Step 7** — Pokémon abilities: On Summon, On Attack, On Defend, On Defeated, On Breakfast and On Supper, as card data on the effect system. Resolution now runs through one stack, so chained abilities resolve immediately, simultaneous triggers follow the initiative/zone order rule, and an ability can pause for your target choice. Five placeholder abilities on 13 placeholder Pokémon.
- **Step 8** — Supporter Cards: the "Play a Supporter Card" Action, paid in cards (Discard and/or Release) with a Gift Bonus Challenge checked by a general card-matching condition. Field Researcher, Veteran Coach and Field Medic replace the placeholder Supporters. One Supporter per Round.

Add `?seed=123` to the URL to replay the same shuffle and coin flip.

## Tests

```
for t in tests/*.test.js; do node $t; done
```
