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
- **The timer:** a countdown bar runs across the banner, **8 seconds** at the Normal speed setting. Choosing a card shows its target arrows; choose a target to commit (with a single target, it commits on the first click).
- **The default:** a **Let it happen** button. When the timer runs out, it chooses Let it happen.
- **The keys:** **Space** plays the React when there is exactly one option and one target. **Esc** chooses Let it happen.
- **The timer belongs to the UI, not the engine.** On timeout the UI sends the same `decline` action a click would. Tests and autoplay never wait.
- **Settings:** the timer length is a setting: 5 s, **8 s**, 12 s or 20 s. There is no "off", since a short window is part of the design. It doesn't scale with animation speed.

### 2b. Trainer Objectives begin the game in play

**This is a rule change.** The rulebook and FOUNDATION_ASSUMPTIONS.md are updated with it.

**Proposed reading — for Elliott to confirm:**

- **At match start,** each player's Trainer area holds one Objective for each Trainer in their deck list (today: Misty and Blaine). They're active from Round 1 at no cost, with progress 0.
- **The deck is unchanged** (still 40 cards, still one Misty and one Blaine). A Trainer card drawn into the hand can only be played as its **Trainer Command**. The "play as Objective" action is removed.
- **Completing an Objective** works as today:
  - its Partner is summoned (it arrives at the next Breakfast, as now);
  - its On Summon resolves;
  - you gain +2 Recognition.

  The Objective then shows as complete in the Trainer area, rather than going to the Discard Pile. Playing that Trainer's Command later is unaffected.

**Questions for Elliott:**

- **Q1.** Is that right, that the Objective is *not* one of the 40 cards, so both Misty cards stay in the deck as Commands? The alternative is that the Trainer card leaves the deck to start in play, which makes the deck 38.
- **Q2.** Should a completed Objective's Trainer stay on show in the Trainer area for the rest of the match (proposed: yes, as a trophy with a tick), or disappear?

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
- **Weather** becomes two icon counters on each Location tile, showing the active bracket and the next (*"Rain 2 · at 4: +1 Strength"*). The full table is in the Codex.
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

**Question for Elliott (Q3):** should it be in scope? It needs sourced audio files, for example CC0 packs from Kenney or freesound, credited in the README. I'd make it the last stage, so it can be dropped without affecting anything else.

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
| **UX1: Rules and React** | Elliott's changes 2a, 2b and 2c. The React window with its banner, options, timer and default. Recognition capped at 100. Tests for all of it | Elliott's answers to Q1 and Q2 |
| **UX2: Layout and HUD** | The new layout (3.1): prompt bar, portraits with Recognition rings, Trainer trackers, Bag slots, PokéMart drawer, piles, log drawer, Weather on Location tiles. The Actions panel is removed | A mockup approved by Elliott (I make it before the prompt) |
| **UX3: Cards and interaction** | Hand and board card faces (3.3), drag and drop, targeting arrows with result previews, hover reasons, Ready/Spent states, Cancel, confirmations, keyboard | UX2 |
| **UX4: Motion and VFX** | Port v2's presenter, particles and WebGL layer. AI pacing, speed settings, click to skip, phase banners and the Breakfast/Supper summaries, the Recognition ring animation, Partner and Tournament moments, low motion | UX3 |
| **UX5: Learning and flow** | Port the Codex, explain and glossary. First-match tips, title screen, mulligan screen, end screen with match summary, settings, resume, colourblind and text size, and a final polish and layout pass | UX4 |
| *UX6: Sound (optional)* | Sound effects and music with volume settings | Q3 |

---

## 5. Prompt UX1 (ready to send once Q1 and Q2 are answered)

> **v4 UX1: Elliott's rule and display changes, and the React window**
>
> Work only in `v4/`. Read `v4/FOUNDATION_ASSUMPTIONS.md` and `docs/v4-ux-plan.md` sections 2 and 3.4 first. Don't change any other rule, number or card. The AI must still play only through `applyAction`. Keep the engine free of DOM code and of any timer.
>
> **1. Trainer Objectives start in play (a rule change).**
> - At match setup, put one Objective in each player's Trainer area for each Trainer card in their deck list (today: Misty and Blaine). Each is active from Round 1, costs nothing, and starts at progress 0.
> - The deck is unchanged: still 40 cards, still including the Trainer cards.
> - Remove the `trainerObjective` action. A Trainer card in hand can only be played as its Trainer Command.
> - When an Objective completes, everything else works as now: the Partner is summoned (as now, it arrives at the next Breakfast), its On Summon resolves, and +2 Recognition. The Objective stays in the Trainer area marked complete and makes no further progress.
> - Update the AI so it never tries to play an Objective.
> - Update FOUNDATION_ASSUMPTIONS.md (the Trainer section and the Breakfast setup) and record the change in `docs/rules.md` if it covers v4.
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
> - Run a countdown bar of 8 seconds by default (a `reactTimer` setting of 5, 8, 12 or 20 s, saved in localStorage inside try/catch). On timeout, send exactly the same `decline` action as the button.
> - **Keys:** Space reacts when there's exactly one option and one target. Esc lets it happen.
> - The AI's own React decisions stay instant.
> - Autoplay (`?autoplay`) and tests must never wait on the timer.
>
> **4. Hide the series.** Remove Light, Mid and Heavy from every displayed string: card faces, the hand line, board cards, hover and detail text, and the log. Keep it in the data and the rules.
>
> **5. Recognition display.** Show Recognition capped at 100 everywhere on screen. The real total can stay in the log and the end screen's detail.
>
> **6. Tests** (`node v4/tests/ux1.test.js`), checking that:
> - both players start with 2 active Objectives at progress 0, and still have 40 cards in total in their Draw Pile and hand;
> - `trainerObjective` isn't a legal action;
> - a Trainer in hand is playable only as a Command;
> - an Objective completed in play summons its Partner and gives +2;
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

- **Q1:** Do the starting Objectives come in addition to the 40-card deck? Proposed: yes, and the Trainer cards stay in the deck as Commands.
- **Q2:** Does a completed Objective stay on show? Proposed: yes, ticked.
- **Q3:** Is sound in scope (stage UX6, with sourced CC0 audio)?
- **Q4:** Is 8 s right for the React timer at its default?
