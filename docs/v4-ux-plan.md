# v4 UX and Quality of Life overhaul plan

**Status:** a plan for Elliott's approval. It builds on the finished v4 Foundation (F1–F5, commit 884676e).

**Aim:** bring the Foundation's gameplay up to the feel of a polished PC card game (the bar is Hearthstone, Marvel Snap, MTG Arena and Legends of Runeterra) **without changing any feature or the starting deck**. Every rule, number and card stays as it is, except Elliott's three changes in section 2.

**Where:** the work happens in `v4/` (the same link, https://elibarrett11.github.io/Pok-monLegendsTCG/v4/). The engine stays DOM-free and the AI keeps playing through `applyAction`.

---

## 1. What the review found

These findings come from playing v4 at 1920×1080 (the mulligan, a mid-match turn, and a defeat in the Tournament at Round 8).

| # | Area | Problem today | Why it matters |
|---|---|---|---|
| 1 | **Actions panel** | A text list of 11 actions, each saying "Not the Battle Phase" outside your turn | It's the biggest panel on the right and tells you nothing useful. The reasons belong on the cards themselves. |
| 2 | **Hand** | Small cards packed with text ("Mid · Fire · Physical · Def guard"). Trainers show "Obj / Cmd" lines. Commands show every mode at all times | Hard to scan, and the player can't see at a glance what is playable now |
| 3 | **Board** | A dark, empty grid with a "Default Location" label. Ready and Spent Pokémon look almost the same | The board is where the drama happens, and today it reads as a spreadsheet |
| 4 | **Turn flow** | AI actions resolve instantly, with only a log line. React windows are a plain modal | The player misses what the AI did and why their Pokémon lost Strength |
| 5 | **Feedback** | No animation or VFX in v4 (v1 and v2 both had a WebGL layer) | Attacks, defeats, Recognition and the Tournament don't land |
| 6 | **Panels** | Empty Trainer boxes. The PokéMart and both Bags sit as a strip under the board. A text pile-count panel. A small log | Space goes to things that are rarely relevant, and the important things are small |
| 7 | **Weather** | The panel prints all four bracket rules at all times | Hard to read. Only the active and next bracket matter |
| 8 | **Recognition** | Shows past the target (102 / 100) | Looks like a bug |
| 9 | **End of match** | A plain modal with the scores | No sense of a result, and no summary of how it was won |
| 10 | **Learning** | No Codex, inspect view, hints or tutorial. Terms such as Exert, Retain, guard and Favour are never explained in the game | A new player can't learn the rules from the game itself |
| 11 | **Control** | Click-only, with no keyboard, no drag, no speed setting and no way to skip animations | Slow for experienced players |

**What's already good and stays:**

- the art;
- v3's "necessary information only" look with coded icons;
- the gold and brown palette;
- the standout Energy tile;
- the layout rule (nothing clipped at 1920×1080, 1366×768 and 1280×720).

---

## 2. Elliott's three changes

### 2a. Command Cards show only the modes that apply now

**On your turn,** a Command card in hand shows:

- **Adapt** always (greyed with its reason if you can't afford it or there's no target);
- **Strat** only if you can afford it.

React isn't shown.

**On the opponent's turn and between turns,** no mode is shown. The card is quietly dimmed.

**During a React window** (the opponent has just attacked, summoned or Adapted, and you have an affordable React with a target):

- **The pause:** the game pauses on the opponent's action. The action is shown on the board: the attacker with a targeting arrow to its target, the summoned card in its space, or the Adapt card with its arrow.
- **The banner:** a large banner across the middle reads **"REACT?"** and explains what's happening in plain words. For example: *"The Opponent's Gyarados is attacking your Charizard for 9."*
- **The options:** each React card you can play is lifted out of the hand and shown large, with:
  - the React effect in plain words (*"Heal 2 on your Charizard before the attack"*);
  - its cost (*"1 Energy"*) and your Energy after (*"you'll have 2 left"*);
  - a **React** button.

  Cards that can't React stay in the hand, dimmed.
- **The timer:** a countdown bar runs across the banner, **5 seconds** by default. Choosing a card shows its target arrows; choose a target to commit (with a single target, it commits on the first click).
- **The default:** a **Let it happen** button. When the timer runs out, it chooses Let it happen.
- **The keys:** **Space** plays the React when there is exactly one option and one target. **Esc** chooses Let it happen.
- **The timer belongs to the UI, not the engine.** On timeout the UI sends the same `decline` action a click would. Tests and autoplay never wait.
- **Settings:** the timer length is a setting: **5 s** (default), 8 s, 12 s or 20 s. There is no "off", since a short window is part of the design. It doesn't scale with animation speed.

### 2b. Trainer Objectives begin the game in play

**This is a rule change.** The rulebook and FOUNDATION_ASSUMPTIONS.md are updated with it.

**Settled by Elliott (Q1 and Q2):**

- **At match start** the Trainer cards are shuffled into the 40-card deck with everything else. Each Trainer's **Objective is active from Round 1** at no cost, with progress 0, and is tracked from the start.
- **The player is always told how their Objectives stand.** Each one shows as a tracker in their Trainer area: the Trainer, the Objective, its progress (e.g. 1/2) and the Partner. The opponent's trackers are visible too.
- **A drawn Trainer card can only be played as its Trainer Command.** It then goes to the Discard Pile and keeps cycling through the deck as normal. The "play as Objective" action is removed.
- **When an Objective completes,** the Trainer card is played at once from wherever it is: the Draw Pile, the hand (Retained or not) or the Discard Pile.
  - It leaves the deck for good.
  - Its Partner is summoned as now: at once into the first free space on your side, or waiting for a free space.
  - Its On Summon resolves.
  - You gain +2 Recognition.
- **A completed Trainer stays on show** in the Trainer area for the rest of the match, ticked. Its Command can't be played again, since the card is no longer in the deck.

### 2c. Light, Mid and Heavy are hidden

The series stays in the data and the rules (Levels and costs), but it's removed from:

- every card face;
- the hand line;
- the board;
- the hover text.

The Codex doesn't show it either; it explains the Level range as *"Level 2 now; grows to 7"*.

---

## 3. The overhaul, by area

### 3.1 Screen layout (1920×1080; the same proportions at 1366 and 1280)

```
┌──────────────────────────────── Prompt bar (what to do now) ─────────────────────────────┐
│ Opponent portrait · Recognition ring · $ · Bag · Trainer Objectives     Round · Phase     │
│ ┌────────────────────────── Opponent row (9 lanes) ──────────────────────────┐  Energy   │
│ │                                                                             │  tile    │
│ │         Locations (bold tiles, centred between the rows, same height)       │          │
│ │                                                                             │  Pass /  │
│ └────────────────────────── Your row (9 lanes) ──────────────────────────────┘  End turn │
│ You: portrait · Recognition ring · $ · Bag · Trainer Objectives      Deck ▣  Discard ▣    │
│                      Hand (fanned, larger, lifts on hover)                    Log ▸       │
└───────────────────────────────────────────────────────────────────────────────────────────┘
```

**Removed:**

- the Actions panel (replaced by the prompt bar, reasons on the cards themselves, and highlighted legal spaces);
- the "You / Opponent" pile-count panel (replaced by Deck and Discard piles with counts, which open on click).

**Moved:**

- **The PokéMart** opens as a drawer from a shop button with a "3 new" badge at Breakfast. It's not a permanent strip.
- **The Bags** become 6 small slots beside each player's portrait.
- **Weather** totals are shared across the board, so they become one compact chip in the right column showing the active bracket and the next (*"Sun 2 · Physical +1 damage · at Sun 4: all Pokémon +1 Attack"*). Each Location tile shows what it adds (*"+2 Sun"*). The full table is in the Codex.
- **Trainer Objectives** become compact trackers beside each portrait: Trainer art, the Objective, a progress pip such as **1/2**, and the Partner's thumbnail. They pulse on progress.

**The log** becomes a collapsible side drawer with icons, coloured names and clickable cards. A short "last 3 actions" ticker stays visible.

### 3.2 The prompt bar (ported from v2's `prompt.js`)

The bar always says three things:

- the step (*"Your turn · Round 4"*);
- what you can do (*"Summon, play a Command or Item, Attack, Retain or Pass"*);
- what a choice in progress needs (*"Choose a Pokémon to attack"*, gold, with **Cancel**).

During the AI's turn it reads *"Opponent is thinking…"* and then names the AI's action as it plays out. A **Hints** setting (Full, Short, Off) controls how wordy it is.

### 3.3 Cards

- **Hand cards:**
  - **Size:** about 30% larger. They fan out and lift when hovered, then scale up to a readable zoom.
  - **Playability:**
    - a playable card has a gold edge;
    - an unplayable card is dimmed, with its reason on hover (*"Needs 3 Energy · you have 2"*);
    - a card you can't afford shows its cost in red.
  - **Face:** the face keeps the necessary information only: cost, name, Level, Attack, Speed icon, Strength and guard icon, plus one rules line. Type and attack style become small icons, not words.
  - **Previews:** the ▲/▼ version arrows from v2 preview next Round's Level on hover (*"Lv 3 next Round: Attack 3, Strength 5"*).
- **Board cards:**
  - **Contents:** art, Attack, Speed, current/maximum Strength, guard icon, a Held Item chip and Level.
  - **Ready vs Spent:** a Ready Pokémon has a strong animated gold glow and stands upright. A Spent Pokémon is greyed and tilted 8°.
  - **Damage** shows as a red Strength number with a crack overlay.
- **Inspect:** right-click or hold Alt on any card, anywhere, to open the Codex view (3.6).

### 3.4 Interaction

- **Drag to play:**
  - Drag a hand card to a lane, a Pokémon or a Location. Legal drops light up as you drag, and illegal ones show their reason.
  - Click-to-select-then-click stays as an alternative.
  - Targeted effects (Attack, Commands, Items) draw a curved **targeting arrow** from source to cursor, and a hover preview shows the result: *"Charizard deals 7 → Gyarados 12 → 5"*, *"Defeats it: +2 Recognition, +$3"*.
- **Attack:** drag from a Ready Pokémon to its target, or click it and then the target. The Player Character is a valid target when unguarded.
- **Cancel:** right-click, or press Esc. A choice in progress can always be backed out before it's committed. Nothing committed is undone.
- **Confirmations, only where a mistake is costly:**
  - Pass when you still have Energy and a playable card (*"Pass with 3 Energy unused?"*, with *Don't ask again*);
  - Release on a Supporter;
  - Retain on your last card.
- **Keyboard:**
  - **Space** = Pass / End turn;
  - **1–9** = select a hand card;
  - **A** = Attack mode;
  - **R** = Retain mode;
  - **Tab** = cycle legal targets;
  - **Enter** = confirm;
  - **Esc** = cancel;
  - **L** = log;
  - **C** = Codex;
  - **?** = the key list.

### 3.5 Motion, VFX and pacing (ported from v2's `present.js`, `particles.js` and `vfx/`)

- **The presenter:** every engine event plays as a short beat, one after another. The 25 VFX textures are already in `assets/vfx/`. The beats are:
  - summons drop in, with a dust ring;
  - attacks lunge, with a hit flash and a damage number;
  - a guard catching a hit shows a shield flare;
  - defeats shatter, with +Recognition flying to the ring and +$ to the purse;
  - Commands sweep in, with Strat sealed under the Location until it resolves;
  - a Supporter's Release burns cards away, then **"Favour!"**;
  - Items are bagged and used;
  - Locations unfold, count down and fold away;
  - Weather particles fall over Locations at bracket 2+;
  - Partner arrival is a cinematic;
  - the Tournament arrival sweeps the stadium across all 9 lanes, with "×1.5" stamped on both Recognition rings.
- **Pacing and speed:**
  - The AI's actions are shown one at a time (about 0.9 s each at Normal), with a "thinking" pause of about 0.5 s before each.
  - Click anywhere skips to the end of the current beat.
  - Settings offer Slow, Normal, Fast and Instant.
- **Phase banners:**
  - **Breakfast** gives a quick summary strip (*"+1 Energy · +$1 · 3 new Items · Ponyta is now Lv 4"*).
  - **Supper** shows dominance results per Location and Strats resolving, then the hand discarding.
  - The "Your turn" banner is brief and skippable.
- **Recognition:**
  - The ring fills smoothly, with a ghost bar showing the pending gain during previews.
  - Milestone flares appear at 50, 70 and 90.
  - The ring caps at **100**, and the winner's reads "Champion".
  - The Tournament ×1.5 is shown as an aside: *"+2 → +3"*.
- **Low-motion setting:** VFX off, with movement and numbers kept. Without WebGL, the 2D fallback (v2's `particles.js`) is used.

### 3.6 Learning: the Codex, hover reasons and onboarding (ported from v2's `codex.js`, `explain.js` and `glossary.js`)

- **The Codex** inspects anything: a card, Location, Weather, the Energy tile, a Recognition ring, a pile or a log line.
  - It shows what the thing does now and **where its numbers come from** (*"Attack 7 = 5 base + 2 Choice Band (until Supper)"*).
  - Every game term is a link to its glossary entry: Exert, Exhaust, Retain, guard, Speed, Ready, Favour, Release, Held, Consumed, Strat, React, dominance and the Tournament.
- **Hover reasons** replace the Actions panel. Every disabled thing says why, in one line.
- **First match:** a set of tooltips explains each new thing the first time it appears, and can be dismissed. Covered:
  - the hand, Energy and Exert, Summon, Attack, Pass, Retain, a React window, Locations and dominance, Weather, the PokéMart and Bag, Supporters, Trainer Objectives, and the Tournament.
  - "Show tips again" lives in Settings.

  This isn't a scripted tutorial. It's guidance inside a normal match against the AI.
- **The ? key** opens the key list and a one-page rules summary.

### 3.7 Match flow and screens

- **Title and setup screen:**
  - **Play** vs the AI;
  - AI difficulty (Normal only, for now);
  - Settings;
  - Rules (the Codex);
  - who goes first (random coin, shown).
- **Mulligan:** the hand is shown large in the middle; click a card to mark it (it shows a ✕ and dims), then **Keep** or **Replace 2**.
- **End screen:** a Victory or Defeat banner, then a match summary:
  - Recognition by source, as a stacked bar (damage, defeats, dominance, Favours, Objectives, Tournament bonus);
  - Rounds played;
  - your Pokémon with the most damage dealt;
  - **Rematch**, **Title** and **View board** (closes the overlay so you can look at the final board).
- **Settings,** saved per browser in localStorage, read safely:
  - animation speed;
  - the React timer;
  - Hints;
  - low motion;
  - card text size (100 / 115 / 130%);
  - the colourblind palette (the Rain and Sun and the player colours get shape cues as well as colour);
  - Pass confirmation;
  - "show tips again".
- **Resume:** the match state saves at each Breakfast. Reloading the page offers **Resume match**.

### 3.8 Sound

v4 has no audio. A proper soundscape (UI clicks, attack hits, defeats, Recognition chimes, the Tournament fanfare, a music bed) is a big part of a game feeling finished.

**Settled by Elliott (Q3):** yes, but only at a good level of quality and for free.

**How:**
- **Sound effects** come from free CC0 packs (e.g. Kenney's interface, impact and RPG audio, which need no credit but are credited in the README anyway), mixed and trimmed to a consistent loudness.
- **Music** is only included if a free track of real quality is found, with a licence that allows use on GitHub Pages. Otherwise UX6 ships sound effects only and says so.
- **The quality check:** I listen-test the selection before the prompt and list each file, its source and its licence. Anything that sounds cheap is left out.
- **Settings:** master, effects and music volume, plus a mute. Sound starts after the first click, as browsers require.

---

## 4. Build stages (Claude Code prompts)

Five stages, plus an optional sixth for sound, each sized like F1–F5 so Claude Code doesn't run out of context. Each one:

- leaves the game playable;
- adds tests;
- runs `v4/tools/layout.mjs` at the three sizes;
- is committed to `main` with a README build-log entry.

I review each report and screenshot before writing the next prompt.

| Stage | Contents | Depends on |
|---|---|---|
| **UX1: Rules and React** ✅ | Elliott's changes 2a, 2b and 2c. The React window with its banner, options, timer and default. Recognition capped at 100. Tests for all of it | Done: commit 3ba8b7c |
| **UX2: Layout, HUD and card faces** ✅ | The approved mockup: the new layout (3.1), full-size Location tiles, the five stat icons, hand and board card faces (3.3), Ready/Spent states. Also Elliott's Objective targets and Partner stats. The Actions panel is removed | Done: commit 7b022aa |
| **UX3: Interaction** ✅ | Drag and drop, targeting arrows with result previews, hover reasons, Cancel, confirmations, keyboard (3.4), plus the UX2 polish list | Done: commit d4a2523 |
| **UX4: Motion and VFX** | Port the effects layer and presenter (3.5). Every engine event animated, AI pacing, speed settings, click to skip, phase banners and summaries, Recognition rings, Partner and Tournament moments, low motion, sound hooks for UX6 | Prompt in section 9 |
| **UX5: Learning and flow** | Port the Codex, explain and glossary. First-match tips, title screen, mulligan screen, end screen with match summary, settings, resume, colourblind and text size, and a final polish and layout pass | UX4 |
| **UX6: Sound** | Free CC0 sound effects (and music, only if a good free track is found), volume settings and mute | UX5, plus my listen-tested file list |

---

## 5. Prompt UX1 (ready to send)

> **v4 UX1: Elliott's rule and display changes, and the React window**
>
> Work only in `v4/`. Read `v4/FOUNDATION_ASSUMPTIONS.md` and `docs/v4-ux-plan.md` sections 2 and 3.4 first. Don't change any other rule, number or card. The AI must still play only through `applyAction`. Keep the engine free of DOM code and of any timer.
>
> **1. Trainer Objectives are active from the start (a rule change Elliott has settled).**
> - The Trainer cards stay shuffled into the 40-card deck with everything else.
> - At match setup, put one Objective tracker in each player's Trainer area for each Trainer card in their deck (today: Misty and Blaine). Each tracker is linked to its card's `uid`, is active from Round 1, costs nothing, and starts at progress 0. Objective progress works exactly as now.
> - Remove the `trainerObjective` action. A Trainer card drawn into the hand can only be played as its Trainer Command. It then goes to the Discard Pile and keeps cycling through the deck (it can be drawn and used as a Command again). Playing the Command doesn't affect its Objective.
> - **When an Objective completes,** take that Trainer card at once from wherever it is (Draw Pile, hand, Retained or not, or Discard Pile) and remove it from the deck for good. Then, as now:
>   - its Partner arrives at once in your first free space, or waits for one;
>   - its On Summon resolves;
>   - +2 Recognition.
> - The tracker stays in the Trainer area for the rest of the match, marked complete, and makes no further progress.
> - **Show the trackers to both players at all times,** in each player's Trainer area: the Trainer's art and name, the Objective text, its progress (e.g. 1/2) and the Partner's name. A completed one shows a tick. Log progress and completion. When a Trainer card is pulled out of the hand or a pile on completion, log where it came from.
> - Update the AI so it never tries to play an Objective; it may still play Trainer Commands.
> - Update FOUNDATION_ASSUMPTIONS.md (the Trainer section and the match setup) and `docs/rules.md` if it covers v4.
>
> **2. Command Card modes by situation.** Add a pure engine helper `commandModesFor(s, who, uid)` that returns the modes to *display* for a Command card in hand:
> - **On your own turn:** Adapt, with its reason if it isn't playable, plus Strat only if you can afford it.
> - **During a React window where you are the reactor:** React only, and only if it's affordable and has a target.
> - **Otherwise:** none.
>
> Use it in the hand display, the click menu and the AI's choices. The engine's legality checks don't change.
>
> **3. The React window.** When the engine opens a React window for the human player:
> - Pause all other input.
> - Show the opponent's committed action on the board: an arrow from the attacker or the Adapt card to its target, or the summoned card highlighted.
> - Show a banner in the middle of the board: **REACT?**, with a plain sentence saying what is about to happen (e.g. *"The Opponent's Gyarados is attacking your Charizard for 9."*).
> - Show each playable React card large, with its React effect in plain words aimed at the actual target, its cost, the Energy you'll have left, and a **React** button. If the card needs a target, clicking it highlights the legal targets; with one target, it commits at once.
> - Add a **Let it happen** button.
> - Run a countdown bar of 5 seconds by default. Add a small settings control for `reactTimer` (5, 8, 12 or 20 s), saved in localStorage inside try/catch; the full Settings screen comes in UX5. On timeout, send exactly the same `decline` action as the button.
> - **Keys:** Space reacts when there's exactly one option and one target. Esc lets it happen.
> - The AI's own React decisions stay instant.
> - Autoplay (`?autoplay`) and tests must never wait on the timer.
>
> **4. Hide the series.** Remove Light, Mid and Heavy from every displayed string: card faces, the hand line, board cards, hover and detail text, and the log. Keep it in the data and the rules.
>
> **5. Recognition display.** Show Recognition capped at 100 everywhere on screen. The real total can stay in the log and the end screen's detail.
>
> **6. Tests** (`node v4/tests/ux1.test.js`), checking that:
> - both players start with 2 active Objectives at progress 0, and still have 40 cards (including both Trainers) across the Draw Pile and hand;
> - `trainerObjective` isn't a legal action;
> - a Trainer in hand is playable only as a Command, goes to the Discard Pile, and its Objective stays active;
> - completing an Objective removes the Trainer card from the Draw Pile, from the hand, or from the Discard Pile (one test each), summons its Partner, gives +2, and leaves a completed tracker; the deck total drops to 39;
> - `commandModesFor` returns:
>   - Adapt (plus Strat only when affordable) on your turn;
>   - [] on the opponent's turn;
>   - React only inside your React window;
> - a React window resolves the committed action after `decline`;
> - no displayed card text contains "Light", "Mid" or "Heavy" (check the render helpers' output strings).
>
> Run every existing test, update any that relied on the Objective action, and run `v4/tools/layout.mjs` at all three sizes. Take a screenshot of a React window at 1920×1080.
>
> **7. Finish.** Commit and push to `main`, add a README build-log entry, and report:
> - what changed;
> - the test results;
> - the layout results;
> - the screenshot path;
> - anything you had to decide that this prompt doesn't settle.

---

## 6. Open questions

Settled 9 November 2026:
- **Q1:** Trainer cards are shuffled into the deck. Their Objectives are active from the start. A drawn Trainer is a Command only and cycles as normal, until its Objective completes and the card is played at once from wherever it is (section 2b).
- **Q2:** A completed Trainer stays on show, ticked.
- **Q3:** Sound is in scope, but only at good quality and for free (section 3.8).
- **Q4:** The React timer defaults to 5 s, with 8, 12 and 20 s in Settings.

- **Q5 (from UX1), settled:** Option 2. Trainer Objectives should be something players work towards all match, paying off in the mid to late game with a Partner that feels like a real reward. Over 120 AI-vs-AI simulations (median match length 8 Rounds), the target pairs completed at these median Rounds:
  - **6 / 4: Round 5.**
  - **8 / 5: Round 6.** About 93% of Mistys and 68% of Blaines complete.
  - **10 / 6: Round 7.**

  **Approved:** **Misty "Defeat 8 enemy Pokémon"** and **Blaine "Dominate a Location 5 times"** (each Location dominated at a Supper counts once, and so does dominating the Tournament).
- **Q6, settled with changes (9 November 2026):**
  - **Locations are full board tiles again.** A Location's art covers its lanes on both sides, from the opponent's row to yours. The Location plate (name, passive, Rounds left, Weather added, Strength on each side) sits across the middle.
  - **The Attack icon and the guard tags are replaced** by five stat icons, one each for Physical Attack, Special Attack, Hitpoints, Defence and Special Defence (`docs/design/v4-stat-icons.jpg`). Each Pokémon shows its attack icon beside Attack and its Strength icon beside Strength, so the "Def" and "Sp.Def" tags go.
  - **Location cards in the hand show no cost,** since they are always free.

- **Q7, approved:** the Partners were weak for a mid-to-late reward. Today each is Level 5 with Attack 4–5 and Strength 6, below a Level 7 Charizard (Attack 8, Strength 9). Proposed starting values:
  - **Starmie:** Swift, Special, Attack 8, Hitpoints 10. On Summon: draw 2 (unchanged).
  - **Ninetales:** Steady, Special, Attack 9, Hitpoints 11. On Summon: 2 damage to each enemy Pokémon (up from 1).
  - Both count as cost 4 when defeated (Level 8).
- **Q8, approved:** the revised UX2 mockup and the stat icons.

None open.

---

## 7. Prompt UX2 (ready to send)

> **v4 UX2: Objective targets, stronger Partners, and the new layout, HUD and card faces**
>
> Work only in `v4/` (plus the shared `assets/`, read only). First read:
> - `docs/v4-ux-plan.md`, sections 2b, 3.1, 3.3 and 6 (Q5–Q8);
> - the approved mockup image `docs/design/v4-ux2-layout-mockup.jpg` and its page source `docs/design/v4-ux2-layout-mockup.html`. Use the source for sizes, colours and SVG paths;
> - the stat icon sheet `docs/design/v4-stat-icons.jpg` and `.html`.
>
> The mockup is the target. Match it closely at 1920×1080. Keep the engine DOM-free. The AI still plays only through `applyAction`. Don't change any rule or number except those in part A. Every action that works today must still work after this stage, by clicking, even where its button has moved. Drag and drop, targeting arrows and keyboard shortcuts beyond UX1's come in UX3, so don't build them now.
>
> **A. Numbers Elliott has approved** (`src/engine/cards.js` and `src/rules.js`):
> - **Misty's Objective:** `need: 8`, text "Defeat 8 enemy Pokémon".
> - **Blaine's Objective:** `need: 5`, text "Dominate a Location 5 times". The counting stays as it is: each Location dominated at a Supper counts 1, and dominating the Tournament counts 1.
> - **Starmie (Partner):** Level 8, Swift, Special, Hitpoints, Attack 8, Strength 10, cost 4. On Summon: draw 2 (unchanged).
> - **Ninetales (Partner):** Level 8, Steady, Special, Hitpoints, Attack 9, Strength 11, cost 4. On Summon: 2 damage to each enemy Pokémon (up from 1).
> - **A defeated Partner** gives its opponent $4, through its cost as today.
>
> Update `FOUNDATION_ASSUMPTIONS.md` and any tests that relied on the old values.
>
> **B. The layout** (a fixed 1920×1080 stage, as now). Build it as in the mockup:
>
> 1. **Prompt bar** across the top. It's the only place for step text and action buttons (Adapt, Strat, Command, Retain, Cancel and so on), with the status tag on the left.
> 2. **Opponent HUD** at the top-left:
>    - a Recognition ring with the number inside, shown capped at 100;
>    - the PokéDollar purse;
>    - 6 Bag slots;
>    - two Trainer Objective trackers. Each has the Trainer's art, name and short goal, a progress pip for each step (filled as progress is made), and the Partner's thumbnail. A completed tracker turns green with a tick.
>
>    Add a small line for the opponent's Energy and Exert, which today is in the panel being removed. The opponent's hand shows as card backs with a count. Their Deck and Discard piles sit to the right, with counts.
> 3. **The board**: 9 lanes, two rows.
>    - **Locations are full board tiles:** the Location's art covers all its lanes on both sides, from the top row to the bottom row, with a border in the Location's colour. Pokémon stand on the art.
>    - **The Location plate** sits across the middle band and shows:
>      - name and passive;
>      - Rounds left as pips plus "N left";
>      - the Weather it adds (e.g. "+2 Sun");
>      - Strength on each side, as "16 vs 3" and a two-colour bar along the plate's bottom edge.
>    - **During the Tournament,** one tile covers all 9 lanes with the Tournament's plate (×1.5, dominance +3).
>    - **Lanes with no Location** are plain board mat. Remove the "Default Location" label.
> 4. **Board cards:**
>    - **Contents:** the art, a Level chip (★ for a Partner, with a "Partner" chip), the Held Item as a small round chip, and a bottom bar with: the attack icon and Attack, the Speed chevrons, and the Strength icon and current Strength (red when damaged).
>    - **Remove** the "Def" and "Sp.Def" tags.
>    - **Ready:** a strong gold glow that pulses gently, as a CSS animation. Respect `prefers-reduced-motion` by making it static.
>    - **Spent:** greyed and rotated −6°.
> 5. **The five stat icons:** add them to `src/ui/icons.js` as inline SVG, copying the paths from `docs/design/v4-stat-icons.html`:
>    - Physical Attack: orange claw slashes;
>    - Special Attack: a violet burst;
>    - Hitpoints: a pink heart;
>    - Defence: a silver shield;
>    - Special Defence: a cyan hexagon barrier.
>
>    Export pure helpers `attackIcon(card)` (by `attackType`) and `strengthIcon(card)` (by `strengthType`). They must have no DOM use, so tests can import them. Use them everywhere a Pokémon's Attack or Strength is shown: board, hand, React window, previews, log and detail text. The old Attack icon is retired.
> 6. **Right-hand column**, top to bottom:
>    - **Round,** with the phase tag and a hint of when the Tournament comes ("Tournament at Round 10 or 70").
>    - **A Weather chip** with the current totals, the active bracket's effect and the next bracket. Weather totals are shared across the board, so there's one chip. Remove the old bracket list.
>    - **The Energy tile:** Energy left this turn in a large number, "of N this turn", Exert diamonds (ready, used or Exhausted) and the Exhaust return Rounds.
>    - **END TURN:** Pass, "+1 Base Energy", Space.
>    - **A PokéMart button** with a "N new" badge after each Breakfast. It opens a drawer or panel showing the 3 Items with Buy buttons, keeping all of today's buying behaviour and reasons. Closing it hides it.
>    - **A log ticker** with the last 3 lines and "Open log (L)", which opens a full log drawer. L is the only new key in this stage.
> 7. **Your HUD** at the bottom-left: a Recognition ring, the purse, 6 Bag slots (clicking a Bag Item uses it as today) and your two Objective trackers.
> 8. **The hand** at the bottom centre. Cards are 182×254, fanned and overlapping.
>    - **Cost** sits at the top-left:
>      - a blue Energy gem;
>      - a gold $ gem for Items;
>      - a red gem when you can't afford it;
>      - **no cost element at all on Location cards**, since they're free.
>    - **Level** goes under the cost.
>    - **Pokémon cards:** the Type as a small coloured icon before the name; one rules line only if the card has one; and a stats bar with the new icons.
>    - **Other cards** show a kind line instead ("Command", "Item · Consumed", "Location · 2 lanes", "Trainer Command").
>    - **Commands** show only the modes from `commandModesFor`, as chips (e.g. "ADAPT 2 dmg ⚡2").
>    - **Playable cards** have a gold edge. Unplayable ones are dimmed, with the reason as a hover tooltip.
>    - **Hovering** lifts a card and brings it to the front.
> 9. **Bottom-right:** your Deck and Discard piles with counts, a small key hint, and a line with Released and Retained counts.
> 10. **Removed:** the Actions panel, the You/Opponent pile-count panel, the strip under the board, the Weather bracket list and the "Default Location" label. Nothing they showed may be lost. Each fact must now be on the HUD, a pile, a tooltip or the prompt bar.
> 11. **Kept working in the new layout:** the UX1 React window (banner, large React cards, timer, keys), the mulligan, the end screen, the Supporter Release choice, and Item targeting. Restyling the mulligan and end screen comes in UX5, so here they only need to fit.
>
> **C. Tests and checks:**
> - **`node v4/tests/ux2.test.js`** checks:
>   - the new Objective targets and texts;
>   - the new Partner stats, On Summon effects and the $4 defeat value;
>   - that Blaine's Objective counts one per dominated Location at a Supper;
>   - that `attackIcon` and `strengthIcon` return the right icon for all 2 attack types and 3 Strength types;
>   - that a Location card's hand render has no cost element, and no rendered text contains Light, Mid or Heavy (use the render helpers' output strings).
> - **All existing tests pass.**
> - **The layout check:** update `v4/tools/layout.mjs` for the new class names, add scenarios for the PokéMart drawer open and the log drawer open, and run it at all three sizes. Nothing may be clipped, covered or off-screen.
> - **Screenshots at 1920×1080:** a mid-match board with two Locations, an attack target choice, the React window, the Tournament, the PokéMart drawer and the log drawer. Compare the mid-match board against the mockup and fix any visible differences in layout or style.
>
> **D. Finish:** bump the `?v=` stamp, commit and push to `main`, add a README build-log entry, and report:
> - what changed;
> - test and layout results;
> - the screenshot paths;
> - anything that differs from the mockup, and why;
> - any decision this prompt didn't settle.

---

## 8. Prompt UX3 (ready to send)

> **v4 UX3: interaction (drag and drop, targeting arrows with previews, keyboard, confirmations) and UX2 polish**
>
> Work only in `v4/`. First read `docs/v4-ux-plan.md` section 3.4, and look at the mockup `docs/design/v4-ux2-layout-mockup.jpg`, which shows the targeting arrow and preview. Don't change any rule or number. Keep the engine DOM-free, with any new engine code pure. The AI still plays only through `applyAction`. Every way of playing that works by clicking today must keep working; drag and keys are added alongside.
>
> **A. Result previews** (pure engine helpers in a new `src/engine/preview.js`, with no DOM use, so they can be tested):
> - **`attackPreview(s, who, from, target)`** returns:
>   - the damage;
>   - the target's Strength before and after;
>   - whether it's defeated, and the rewards: Recognition after the Tournament's ×1.5, and $;
>   - Recognition from damage to a Player Character;
>   - **the hit-back:** if the target is Ready it hits back, so the attacker's damage taken, its Strength after, and whether it's defeated, with the opponent's rewards;
>   - **where the attack number comes from,** as parts (e.g. `[{ label: 'Attack', n: 8 }, { label: 'Mt. Ember', n: 1 }]`): base Attack, Location, Weather, Held Item, "until Supper" effects.
>
>   It must use the same functions the engine uses to resolve an attack, so the preview can never disagree with the result.
> - **`effectPreview(s, who, card, mode, target)`** does the same for Commands (each mode), Items and Trainer Commands. Damage and heal show before and after, plus any defeat and its rewards. Effects with no number (e.g. draw 2) return a plain sentence.
>
> **B. Targeting arrows and previews:**
> - **When a choice needs a target** (an attack, a Command, an Item, a React target, a Bag Item), draw a curved, glowing, dotted arrow from the source to the pointer, as in the mockup. The source is the attacker, or the hand or Bag card. It's an SVG layer above the board and below dialogs. The arrow turns red and snaps to a legal target on hover.
> - **Hovering a legal target** shows a preview panel beside it, as in the mockup:
>   - the title (e.g. "Charizard attacks Gyarados");
>   - the stat icons with before → after;
>   - the breakdown line (e.g. "9 = 8 Attack + 1 Mt. Ember");
>   - gain chips (e.g. "Defeats it · +2 Recognition", "+$4");
>   - when the target is Ready, a line "Gyarados hits back: 9 → Charizard 9 → 0 (defeated)".
> - **Hovering an illegal space or Pokémon** shows its reason (e.g. "Guarded by Arcanine").
> - **Summoning and placing a Location:** legal lanes glow. Hovering one shows the cost there, including the Route 119 discount. For a Location, its outline over the lanes it would cover.
>
> **C. Drag and drop** (pointer events, no library):
> - **Dragging a hand card:**
>   - a Pokémon → a legal empty space (summon);
>   - a Location → a lane, which sets its start;
>   - a Command, Item or Trainer Command with a target → a legal target;
>   - a card with no target (Supporter, draw effects) → anywhere on the board.
>
>   While dragging, the card follows the pointer at a slightly smaller size. Legal drops glow, and illegal ones show their reason on hover.
> - **Dragging a Ready board Pokémon** to an enemy Pokémon or the enemy Recognition ring attacks. Dragging a Bag Item works like a hand Item.
> - **Command modes:** if more than one mode is available, dropping shows a small mode picker at the drop point. Each option shows its mode, effect and cost.
> - **Dropping somewhere illegal,** or pressing Esc or right-click, cancels and the card glides back. Nothing is committed until a legal drop, or the final click in the click flow.
>
> **D. Keyboard:**
> - **Space** = End turn.
> - **1–9** = select a hand card.
> - **A** = attack mode. It selects the first attacker; A again cycles through them.
> - **R** = Retain the selected card.
> - **Tab / Shift+Tab** cycle legal targets or spaces, showing the preview.
> - **Enter** confirms.
> - **Esc** or right-click cancels a choice in progress.
> - **L** = log (already built).
> - **? opens a key-list overlay.**
>
> Keys never act while a dialog with its own keys is open (React window, mulligan, Release, the Tournament banner), except that dialog's own keys. Update the key hint at the bottom-right to list the main keys, and show "Space" on END TURN as in the mockup.
>
> **E. Confirmations** (only these, each with a "Don't ask again" box saved in localStorage inside try/catch):
> - **Ending your turn** while you have Energy left and at least one playable card: "End turn with 3 Energy unused?"
> - **Releasing cards** for a Supporter: "Release 2 cards? Released cards leave the match."
> - **Retaining your last card in hand.**
>
> **F. Polish from the UX2 review:**
> - **Log ticker:** the lines run past the panel's right edge. Fit every line inside the panel, trimming with "…" in JS if needed.
> - **Weather chip:** the third line is cut off at the bottom. During the Tournament, its text spills out of the chip.
> - **Round panel:** during the Tournament, the "TOURNAMENT" chip pokes out past the panel's right edge.
> - **Opponent's piles:** the count badges sit on top of the "DECK" and "DISCARD" labels.
> - **Layout check:** extend `tools/layout.mjs` to fail when any text element's content overflows its own box (`scrollWidth > clientWidth + 1` or `scrollHeight > clientHeight + 1`, where it doesn't scroll), so this kind of fault is caught in future.
>
> **G. Tests and checks:**
> - **`node v4/tests/ux3.test.js`** checks `attackPreview` against the real result. Play out at least 200 random legal attacks from AI-played matches with a fixed seed, and for each compare the preview with the state after `applyAction`: damage, both Strengths, defeats, Recognition and $. Include Location, Weather, Held Item and Tournament cases. Do the same for `effectPreview` on every Command mode and every Item in the deck.
> - **All existing tests pass.**
> - **A browser check (Playwright)** that:
>   - drags to summon, place a Location, attack, play a Command with the mode picker, and use an Item;
>   - drives one full turn with keys only;
>   - triggers each confirmation and its "Don't ask again";
>   - cancels a drag with Esc.
>
>   No page errors.
> - **The layout check** at all three sizes, including the new overflow rule, plus scenarios for an attack preview with a hit-back, a drag in progress, the mode picker, the key overlay and a confirmation.
> - **Screenshots at 1920×1080:** an attack preview with a hit-back, a Command drag over a target, the mode picker, a Location placement preview, and the key overlay.
>
> **H. Finish:** bump the `?v=` stamp, commit and push to `main`, add a README build-log entry, and report:
> - what changed;
> - test and layout results;
> - the screenshot paths;
> - anything that differs from this prompt, and why;
> - any decision this prompt didn't settle.

---

## 9. Prompt UX4 (ready to send)

> **v4 UX4: motion and visual effects (the presenter, effects layer, AI pacing, speed settings and phase moments)**
>
> Work only in `v4/` (plus the shared `assets/`, read only). First read:
> - `docs/v4-ux-plan.md` section 3.5;
> - `docs/vfx.md` (the agreed animation spec from v1/v2: clarity first, cards are the actors, weight, timing budgets, reduced motion, effects as data).
>
> Then study v2's working version: `v2/src/ui/present.js` (the presenter), `v2/src/ui/vfx/engine.js` (the WebGL layer), `v2/src/ui/vfx/library.js` and the root `src/ui/vfx/library.js` it builds on (timelines and presets), `v2/src/ui/particles.js` (the 2D fallback), `v2/src/ui/toasts.js`, and `v2/tests/vfx.test.js`.
>
> **Copy what you reuse into `v4/src/ui/`,** with a "Copied from …" header comment, as F1–F5 did. Don't import across versions, so later changes to v1 or v2 can't break v4.
>
> Don't change any rule or number. The engine stays DOM-free. You may add data fields to existing engine events, such as amounts, before/after Strength and a source, when a beat needs them, but never change what the engine does. The AI still plays only through `applyAction`.
>
> **A. The presenter** (`src/ui/present.js`):
> - **How it plays:** after every action, by either player, it plays that action's events back one beat after another, then draws the new state. Use v2's approach: the action on the board as it was, then the new state, then arrivals.
> - **Input:** it's locked while a beat plays, except for click-to-skip, which jumps to the end of the current action. The game state is never changed by the presenter.
> - **Coverage:** every event type the engine emits must have a beat in an `EVENT_BEATS` table in `src/ui/vfx/library.js`, which is pure data with no DOM.
> - **Fallback:** without WebGL, the 2D particles stand in, and every number, banner and card movement still plays.
>
> **B. The beats** (timings follow `docs/vfx.md`'s budgets at Normal speed):
>
> 1. **Attacks, chosen by Type + attack type.** v4 has five:
>    - **Fire Physical:** Ponyta, Rapidash, Growlithe, Arcanine. Flame Wheel charge.
>    - **Fire Special:** Charmander, Charmeleon, Charizard, Ninetales. Flamethrower.
>    - **Water Physical:** Magikarp, Gyarados. Waterfall crash.
>    - **Water Special:** Squirtle, Wartortle, Blastoise, Starmie. Hydro Pump jet.
>    - **Electric Special:** Chinchou, Lanturn. Forked lightning.
>
>    Physical attacks make contact; Special attacks fire across. Add hit-stop, shake and bloom scaled by damage, and a damage number on the target. **A hit-back** plays a shorter version of the defender's own animation. **An attack on a Player Character** hits the Recognition ring. **A guard** being the reason a target was protected doesn't need a beat, since guards block targeting rather than damage.
> 2. **Damage, heal and defeat:**
>    - Strength numbers tick to the new value.
>    - Heal shows green motes and "+N".
>    - A defeat dissolves the card (v1's defeat timeline), then the +Recognition and +$ beats.
> 3. **Command Cards:** the card rises to centre stage, flares, and resolves into its effect at the target.
>    - **Ember** and **Rock Slide** use v1's Strategy animations.
>    - **Recover** (heal) and **X Attack** (an Attack boost aura until Supper) are composed from the shared presets.
>    - **Mode scale:** React is a quick version, Adapt the standard one, and Strat the big one.
>    - **A Strat** is shown sealed: a glowing card back with an hourglass on the board edge of its owner's side, until it resolves at the start of their next turn or at Supper with the full animation.
>    - **A React** plays inside the React window flow: the committed action is shown paused, the React's effect plays, then the action.
> 4. **Summons:** the card drops into its space, with dust and a short glow. Its On Summon effect plays next (e.g. Magikarp's draw, or Charizard's 2 damage to each enemy, using its own attack animation aimed at each target).
> 5. **Partner arrival:** a cinematic of about 2 s.
>    - The Objective tracker bursts.
>    - The Trainer's art sweeps across.
>    - The Partner lands with a gold shockwave, then its On Summon.
>
>    **Objective progress:** the next pip fills with a pulse. **Completion:** the tracker turns green with a flare.
> 6. **Recognition:** "+N" flies from its source (the defeated card, the Location plate or the tracker) to the ring, and the ring fills smoothly.
>    - During the Tournament, show "+2 → +3" (×1.5) on the chip.
>    - The ring flares at 50, 70 and 90.
>    - The ring is still capped at 100 on screen.
> 7. **PokéDollars:** coins fly to the purse, and the number ticks up. A purchase flies the Item from the PokéMart to the Bag or hand. Using an Item plays a small effect on its target (heal for Potion and Oran Berry, an aura for Held Items).
> 8. **Supporters:** the Released cards burn away (v2's Release effect), then the Supporter's effect, then "Favour!" with its Recognition when it's a Favour.
> 9. **Locations:** a new Location unfolds over its lanes (the art wipes in across both rows). Expiring Locations fold away. Retaining a card shows a small lock on it.
>
>    **Weather:** ambient Weather plays over the board while a bracket of 2 or more is active, cheap and low-density: light rain streaks for Rain, a warm shimmer and drifting motes for Sun. **When a bracket is reached,** briefly pulse the Weather chip.
> 10. **Supper:**
>     - pending Strats resolve;
>     - then each Location's dominance: the winner's side of the plate glows, then +Recognition flies;
>     - then Objective progress;
>     - then Location countdowns;
>     - then the hand slides away to the Discard Pile, with Retained cards staying.
>
>     **Breakfast:** a short summary strip, for example "Round 5 · +1 Energy · +$1 · 3 new Items · your Pokémon off the board gained a Level". Then the new hand deals in, one card at a time, quickly.
> 11. **Banners:** "Round N", "Your turn" and "Opponent's turn". They're short, skippable and never block for more than about 0.8 s at Normal.
> 12. **The Tournament:** a stadium sweep across all 9 lanes as the Locations are cleared, then the existing explanatory banner. Each Recognition ring is stamped "×1.5".
> 13. **The end of the match:** the winner's ring fills to 100 and flares with "Champion". The existing end screen follows; restyling it is UX5.
>
> **C. AI pacing:**
> - Before each AI action, a short "thinking" pause (about 0.5 s at Normal), with the prompt bar reading "The Opponent is thinking…".
> - Then the prompt bar names the action in plain words (e.g. "The Opponent's Gyarados attacks your Charizard").
> - For anything with a target, the UX3 targeting arrow is drawn from source to target for about 0.4 s before the beat plays, so the player always sees who did what to whom.
>
> **D. Speed and settings:**
> - **The setting:** Slow / **Normal** / Fast / Instant (×1.5, ×1, ×0.5, none). Add a small control beside the React timer at the bottom-right, saved in localStorage inside try/catch. The full Settings screen is UX5.
> - **Instant:** no animation at all; the new state is drawn at once.
> - **Low motion:** a toggle beside it, which defaults on if the OS asks for reduced motion. It means far fewer particles, no shake, no screen-wide distortion and no ambient Weather; movement and numbers stay.
> - **Autoplay and tests:** `?autoplay` uses Fast, and the layout tool and tests use Instant, so nothing slows them down.
>
> **E. Sound hooks for UX6:** the presenter calls `sfx(name, opts)` at each beat. Names include `attack-fire-physical`, `hit`, `defeat`, `heal`, `summon`, `partner`, `recognition`, `coins`, `command-adapt`, `command-strat`, `react`, `location-place`, `tournament`, `turn` and `victory`. Make it a no-op for now, in `src/ui/sound.js`.
>
> **F. Performance:**
> - 60 fps at 1920×1080 on integrated graphics.
> - The render loop runs only while effects are alive, plus the ambient Weather at low cost, which is paused while the tab is hidden.
> - Load textures once from `assets/vfx/` using its `manifest.json`.
> - Where a needed texture doesn't exist, use a procedural placeholder drawn in code and list it in your report, so Elliott can generate it.
>
> **G. Polish:** the log ticker trims lines to a fixed number of characters. When the web fonts fail to load and a wider fallback font is used, the lines overflow the panel (the layout check fails then). Trim by measured width instead (e.g. `canvas.measureText` or a binary search on the element), so it fits with any font.
>
> **H. Tests and checks:**
> - **`node v4/tests/ux4.test.js`** checks:
>   - every event type the engine emits has an `EVENT_BEATS` entry. Play 30 fixed-seed AI-vs-AI matches and collect every emitted event type;
>   - every attack combination in the deck maps to an animation;
>   - every Command card and mode, Supporter, Item and Trainer Command maps to a beat;
>   - timelines stay within their `docs/vfx.md` budgets at Normal;
>   - **the presenter can't affect the result:** a seeded match played through to the end gives an identical final state with the speed at Instant and at Normal. Run the presenter's planning step headless if the beats themselves need a DOM.
> - **All existing tests pass.**
> - **A browser check (Playwright)** that plays a seeded match at Normal for 3 Rounds:
>   - no page errors;
>   - frames keep up (report the average and worst frame time during a big beat);
>   - click-to-skip works;
>   - Instant draws at once;
>   - low motion removes shake and ambient Weather;
>   - the WebGL-off fallback (force it) still plays.
> - **The layout check** at all three sizes, run at Instant.
> - **Screenshots or short GIFs** (Playwright video, or frames stitched) at 1920×1080, mid-beat, of:
>   - a Fire Special attack with a hit-back;
>   - a defeat with Recognition flying;
>   - a Strat resolving;
>   - a Partner arrival;
>   - the Tournament sweep;
>   - Supper dominance;
>   - the Breakfast strip;
>   - an AI action with its arrow and the prompt bar naming it.
>
> **I. Finish:** bump the `?v=` stamp, commit and push to `main`, add a README build-log entry, and report:
> - what changed;
> - test, performance and layout results;
> - the screenshot or GIF paths;
> - any placeholder textures Elliott should generate;
> - anything that differs from this prompt, and why;
> - any decision this prompt didn't settle.
