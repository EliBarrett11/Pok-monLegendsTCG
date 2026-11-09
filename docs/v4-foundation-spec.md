# POKÉMON LEGENDS TCG — FOUNDATION BUILD

## 1. Your mission

Your task is to bring the latest approved design of Pokémon Legends TCG to life by implementing a basic, fully playable foundation of the game.

This is an implementation task, not a game design exploration exercise.

The objective is to take everything learned from the previous versions of the game, preserve the functionality and architecture that remains useful, and implement the newly approved mechanics into one coherent, playable version.

I want you to create the simplest possible starting point for the new game.

The foundation must include:
- One basic, symmetrical deck used by both players.
- Every approved card type.
- Every approved Battle Phase action.
- The Pokémon development system.
- The Energy and PokéDollar economies.
- Locations, weather and battlefield control.
- Recognition progression.
- The Pokémon League Tournament.
- A complete victory condition.

The deck should introduce every feature of the game using simple, straightforward cards and effects.

It must NOT be built around a particular strategy or archetype. Do not reproduce or adapt any of the previously designed Fire, Water or Grass decks.

Your priority is to get the complete game functioning as quickly and efficiently as possible.

Do not spend time on unnecessary polish, extensive refactoring, elaborate card designs or balance experimentation.

---

## 2. First: inspect the existing project

Before making changes:

1. Inspect the repository structure.
2. Read the existing documentation and relevant game rules.
3. Inspect the previous game implementations and identify the mechanics that were successfully implemented.
4. Understand the current game engine, card data structures, UI components, turn system, combat resolution and resource systems.
5. Identify which existing functionality can be reused, which needs modification and which has been superseded.

Use the existing implementation as your starting point wherever practical.

Do not rebuild working systems unnecessarily.

Do not assume the previous version's rules remain correct. The approved rules in this prompt take priority over every previous implementation or design document.

Check the current Git working tree before making changes. Preserve unrelated existing work and do not overwrite user changes.

Do not spend excessive tokens producing a lengthy analysis or design proposal. Once you understand the existing architecture, proceed directly with implementation.

---

## 3. Core development principles

Follow these principles throughout the task.

### Simplicity

Implement the simplest functional version of every approved feature.

Use basic card effects, straightforward numbers and minimal dependencies between mechanics.

Do not introduce unnecessary complexity simply because a feature could support more sophisticated mechanics in the future.

### Reuse

Reuse existing working game systems wherever possible.

Avoid replacing entire systems when targeted modifications will achieve the required result.

### Consistency

Every card type and mechanic should work within the same underlying game architecture.

Use reusable components and shared resolution logic rather than creating separate implementations for every card.

### No additional game design

Do not invent new card types, currencies, progression systems, victory conditions or major mechanics.

Do not expand the approved design.

Where a rule is not fully specified, use the simplest reasonable implementation and document the decision.

### No balance simulations

Do not run:
- Automated match simulations.
- AI-versus-AI matches.
- Monte Carlo simulations.
- Automated balance experiments.
- Large-scale match testing.
- Deck optimisation experiments.
- Automated searches for optimal strategies.

Do not spend time attempting to balance the game through simulated matches.

Basic software validation is permitted, including compilation, type checking, linting and focused functional tests.

---

# 4. APPROVED GAME MECHANICS

The following rules are the authoritative design specification for this foundation.

## A. Pokémon Cards — Dynamic Pokémon Evolution Card Series

Pokémon Cards represent the player's selected Partner Pokémon.

Every Pokémon Card belongs to one of three development series:

| Series | Development levels |
|---|---|
| Light | Levels 1–6 |
| Mid | Levels 2–7 |
| Heavy | Levels 3–8 |

The series determines the Pokémon's starting development level and maximum development level.

Each round, Pokémon Cards in the player's Hand and Deck gain +1 Level, subject to their series maximum.

The Pokémon's current form, statistics, abilities and energy cost are determined by its current development level.

The player selects the development series when building the deck.

A card selected as a Heavy Series Pokémon, for example, represents a Pokémon with a higher potential development ceiling. It begins at the appropriate initial level and naturally progresses towards its final form.

Pokémon already summoned onto the battlefield are snapshots of their development level at the time they were summoned. They do not automatically evolve when the corresponding card in the player's deck develops.

This allows players to:
- Summon Pokémon early at lower development levels and costs.
- Keep lower-development Pokémon as supporting options.
- Draw higher-potential Pokémon early and summon them in their weaker initial forms.
- Retain developing Pokémon in their Hand or Deck for later, stronger versions.

The Mid Series should aim for an energy cost of approximately half the total Base Energy supplied per round at its relevant development levels.

Create simple, illustrative evolution paths using a small number of existing Pokémon where suitable.

Do not attempt to populate a complete Pokémon catalogue.

Use basic statistics and simple abilities to demonstrate development.

## B. Command Cards — React, Adapt, Strat

Command Cards have three ways of being played.

### Adapt
- Standard energy cost.
- Resolves the standard effect immediately when played.

### React
- Lower energy cost.
- Resolves a weaker version of the same effect.
- Can be played in response to an eligible opponent action.
- Resolves immediately before the opponent's committed action.

### Strat
- Higher energy cost.
- Resolves a stronger version of the same effect.
- Does not resolve immediately.
- Resolves after the opponent's next turn.

Every Command Card should support these three variations.

Use straightforward effects such as damage, healing or simple battlefield effects to demonstrate the system.

Implement clear action-resolution timing. React must genuinely interrupt the opponent's committed action, while Strat must genuinely be delayed until the specified future timing.

Avoid creating a complicated reaction stack. Use the simplest consistent priority and resolution rules.

Document any necessary timing assumptions.

## C. Location Cards — Battlefield Lanes

Location Cards are a regular card type included in the deck.

Players can place Locations onto the shared battlefield, creating lanes where Pokémon can be summoned and battles can take place.

The battlefield should support between two and five active Locations.

Each Location has:
- A name and basic identity.
- A passive effect affecting Pokémon within that Location.
- Weather counters.
- A Weather Bracket with passive effects that apply to both players.
- A method of determining which player dominates the Location.

Location dominance is determined by the total combined Strength of each player's Pokémon within that Location.

The player with the greater combined Strength dominates the Location and earns Recognition each round.

Make dominance and Recognition updates clear in the game interface.

Create a small selection of simple Locations with different passive effects and weather identities.

Do not create a large Location catalogue.

## D. Supporter Cards — Release and Favour

Supporter Cards provide immediate one-time effects.

Playing a Supporter requires permanently Releasing a specified number of cards from the player's Hand.

Releasing a card removes it permanently from the player's available deck/card pool for the remainder of the match. It is not simply discarded.

Supporters may also have an optional Favour Bonus Effect.

The player can receive the enhanced effect by Releasing a card that meets the Supporter's Favour requirement.

Implement:
- Standard Supporter effects.
- Permanent card release.
- Optional Favour conditions.
- Enhanced Favour effects.
- Clear selection of which cards are being released.

Use simple Supporters such as healing, searching for a Pokémon or providing a straightforward battlefield benefit.

## E. Item Cards — PokéMart and PokéDollars

Items are purchased using PokéDollars.

Players earn:
- $1 PokéDollar per round.
- Additional PokéDollars when defeating opposing Pokémon.

Items can be included in the player's deck or purchased from the PokéMart.

The PokéMart refreshes three random Items each round.

When a player purchases an Item from their Hand or the PokéMart, they may either:
- Play it immediately.
- Place it into their Inventory Bag for later use.

Items already in the Inventory Bag can be played using the appropriate Battle Phase action.

Implement:
- PokéDollar tracking.
- Item prices.
- Purchasing Items from Hand.
- Purchasing Items from the PokéMart.
- Three-item shop refresh each round.
- Inventory storage.
- Playing Items from inventory.

Use simple items with straightforward effects, such as healing, temporary stat improvements or status removal.

## F. Trainer Cards — Deck Objectives

Trainer Cards represent important characters the player can encounter during their career.

Trainer Cards are included in the deck and can be used in two ways.

### Trainer Objective

Each Trainer has an objective.

When the objective is completed:
- The Trainer's associated Partner Pokémon is immediately summoned.
- The Trainer's On Summon Effect resolves.

### Trainer Command

A Trainer Card can alternatively be played as a special Command Card.

Implement both options.

Use simple objectives and effects for the foundation. Do not build a complicated relationship progression system unless the existing engine already supports the required functionality and it can be reused without expanding scope.

The important requirement is that both Trainer interaction routes work.

---

# 5. PLAYER ACTIONS — BATTLE PHASE

Implement the following nine available player actions.

1. **Summon Pokémon:** Summon a Pokémon from Hand onto the battlefield or into an available Location, paying its current development-level energy cost.

2. **Play Command Card:** Play a Command Card using Adapt, React or Strat.

3. **Play Supporter:** Play a Supporter, paying its cost by permanently Releasing cards, with the option to complete its Favour condition.

4. **Place Location:** Play a Location Card onto the battlefield, subject to the active Location limit.

5. **Purchase Item:** Purchase an Item from Hand or the PokéMart using PokéDollars, then either play it immediately or store it in the Inventory Bag.

6. **Play Inventory Item:** Use an Item previously stored in the Inventory Bag.

7. **Play Trainer Card as Command:** Use a Trainer Card's special Command option.

8. **Retain Card:** Pay 1 Energy to retain a card in Hand for the next round. Retaining a card reduces the number of cards drawn next round by one.

9. **Pass:** End the player's turn and apply the existing approved Pass Energy rules, including the additional +1 Base Energy.

All actions must respect their relevant energy, resource and timing requirements.

Do not allow players to perform actions they cannot afford.

Clearly communicate unavailable actions and their reasons.

Actions triggered automatically by card effects or passives should not incorrectly consume additional player actions.

---

# 6. ENERGY AND ROUND PROGRESSION

Preserve and adapt the existing Base Energy and Exert Energy systems.

The Energy system must support the approved Pokémon development curves and the different Command Card costs.

Pokémon costs should increase appropriately as their development level increases.

Command Cards must have different costs for Adapt, React and Strat.

The game should retain meaningful opportunities to perform multiple actions in a round.

Use the existing energy progression wherever it remains compatible with the approved rules.

If exact values or interactions are unspecified, choose simple starting values and document them.

Implement round progression so that:
- Pokémon in Hand and Deck gain +1 Level.
- PokéDollar income is applied.
- The PokéMart refreshes three Items.
- Retained cards are handled correctly.
- Draw counts and other round-start effects resolve in a consistent order.

Avoid changing the entire round structure unnecessarily.

---

# 7. MAIN OBJECTIVE — RECOGNITION

The main objective is to earn 100 Recognition and win the Pokémon League Trophy.

Recognition can be earned through the following sources, in descending order of importance:

1. Dealing damage directly to the opponent's Player Character.
2. Defeating opposing Pokémon.
3. Dominating battlefield Locations.
4. Completing Supporter Favours.
5. Completing Trainer Objectives.
6. Specific card effects.

Implement all six sources.

Recognition should be tracked independently for each player and displayed prominently.

Use simple starting values for Recognition rewards. These are initial implementation values, not the result of balance testing.

Do not invent alternative victory conditions.

A player reaching 100 Recognition becomes the Pokémon League Champion, subject to the Tournament rules below.

The Player Character must be capable of receiving direct damage and must have a clearly defined defeat/damage state consistent with the existing combat architecture.

---

# 8. POKÉMON LEAGUE TOURNAMENT

The Pokémon League Tournament is the late-game conclusion.

When the Tournament trigger is reached:

- Introduce the Pokémon League Tournament Location.
- Remove or replace all currently active battlefield Locations.
- The Tournament Location covers the entire battlefield.
- Pokémon already on the field remain in play.
- Previous Location-specific passives and Weather effects no longer apply unless explicitly retained by the existing rules.
- The Tournament has a passive effect that increases Recognition earned.
- Dominating the Tournament Location provides additional Recognition.

The Tournament should create a distinct final phase of the match.

Implement a simple trigger using the existing round and Recognition systems.

Do not create a complicated qualification or career campaign system at this stage.

Document the chosen trigger and any unspecified Tournament assumptions.

The Tournament must work as an actual gameplay transition, not just a visual announcement.

---

# 9. INITIAL DECK DESIGN

Create ONE basic deck composition.

Both players must use exactly the same deck list.

The deck must introduce every approved feature.

It must be intentionally simple and neutral.

Do not create:
- Fire, Water or Grass archetypes.
- Aggressive or defensive specialist decks.
- Previously designed deck compositions.
- Complex card synergies.
- Large numbers of unique effects.
- Unnecessary card variations.

Use a small number of cards with simple effects.

The deck should include enough examples to demonstrate:

- Light, Mid and Heavy Pokémon development.
- Different Pokémon evolution levels.
- Adapt, React and Strat Command variations.
- Locations with different passives and Weather effects.
- Supporters with standard Release and Favour effects.
- Items available through the deck and PokéMart.
- Items that can be stored in inventory.
- Trainer Objectives.
- Trainers played as Commands.

Where possible, use simple and familiar Pokémon and effects already present in the repository.

Do not create elaborate new card designs or extensive card descriptions.

The deck is a demonstration deck, not a competitive deck.

Make sure both players can access all relevant mechanics during a normal match.

Document the initial deck composition in the project's existing card/deck documentation.

---

# 10. USER INTERFACE

Preserve the existing interface and visual identity wherever practical.

The objective is to make the new mechanics playable, not to redesign the entire game.

Ensure the interface provides clear visibility of:

- Both Player Characters and their damage/health.
- Recognition totals and progress towards 100.
- Base Energy and Exert Energy.
- PokéDollars.
- Player Hands.
- Player Decks and Discard/Released cards where applicable.
- Pokémon development levels.
- Pokémon statistics and abilities.
- Active Locations and their Weather.
- Location dominance and Recognition rewards.
- Command Card options.
- Pending React windows.
- Pending Strat effects.
- Supporter Release and Favour selections.
- PokéMart inventory.
- Player Inventory Bags.
- Trainer Objectives.
- Pokémon League Tournament state.

Do not spend time creating elaborate visual effects, animations or premium collectible card artwork.

Cards and controls must be readable and functional.

Prioritise clarity and correct gameplay information over visual sophistication.

---

# 11. IMPLEMENTATION AND ARCHITECTURE

Use the existing project architecture wherever practical.

Keep card data separate from card rendering and game resolution logic.

Use reusable systems for:
- Card definitions.
- Card effects.
- Energy costs.
- Recognition rewards.
- Pokémon development.
- Location dominance.
- Weather.
- Item purchasing and inventory.
- Supporter release.
- Command timing and resolution.
- Trainer objectives.
- Victory detection.

Avoid hardcoding individual card behaviour into the UI.

Avoid introducing unnecessary dependencies or replacing the existing framework.

Do not undertake broad refactoring unrelated to this foundation.

Keep the code straightforward and maintainable.

---

# 12. VALIDATION

Once implementation is complete, perform only basic technical and functional validation.

Check that:

- The project builds and runs.
- A match can be started.
- Both players receive the same deck.
- Both players can perform the available actions.
- Pokémon development progresses correctly.
- Command Cards resolve in their three modes.
- React interrupts an eligible opponent action correctly.
- Strat resolves at the correct delayed timing.
- Supporter Release and Favour work correctly.
- Locations can be placed and dominated.
- Weather effects work.
- PokéDollar income and spending work.
- PokéMart refreshes three Items each round.
- Inventory Items can be played.
- Trainer Objectives and Trainer Commands work.
- Recognition is awarded from every approved source.
- The Pokémon League Tournament replaces the active Locations.
- A player can win at 100 Recognition.

Use focused tests or manual checks where appropriate.

DO NOT run automated match simulations, balance experiments or AI matches.

---

# 13. DOCUMENTATION AND UNRESOLVED ASSUMPTIONS

Create a concise document named FOUNDATION_ASSUMPTIONS.md.

Record only important decisions that were necessary because the approved design did not specify an exact rule.

Examples include:
- Exact starting Energy.
- Exact Pokémon energy-cost curves.
- Exact Recognition rewards.
- Exact Tournament trigger.
- Exact React timing and priority rules.
- Exact Retain limit.
- Exact round-start resolution order.

For each assumption:
1. State the chosen implementation.
2. Briefly explain why the simplest solution was selected.
3. Identify whether it may need future design approval.

Do not use this document to propose additional mechanics or reopen approved design decisions.

---

# 14. DEFINITION OF DONE

This task is complete when:

1. The new foundation runs successfully.
2. Both players can play a complete match using the same basic deck.
3. Every approved card type has a working implementation.
4. All nine Battle Phase actions work.
5. Pokémon development works.
6. Energy and PokéDollar economies work.
7. Command React, Adapt and Strat work.
8. Locations, Weather and dominance work.
9. Supporter Release and Favour work.
10. Items, PokéMart and Inventory work.
11. Trainer Objectives and Commands work.
12. Recognition can be earned through all approved sources.
13. The Pokémon League Tournament functions.
14. A player can win by reaching 100 Recognition.
15. The project builds and runs without errors.
16. Important implementation assumptions are documented.

Do not continue adding features after these requirements are satisfied.

---

# 15. FINAL INSTRUCTIONS

Work efficiently.

Minimise unnecessary token usage, planning overhead and implementation complexity.

Do not ask for approval between implementation stages unless a genuinely blocking issue arises.

Do not spend time running simulations or attempting to balance the game.

Do not redesign the entire game interface.

Do not create elaborate card catalogues.

Do not implement speculative features.

Do not overengineer the foundation for hypothetical future mechanics.

Use your understanding of the previous versions to preserve the best existing functionality, but treat this prompt as the definitive specification for the new foundation.

The goal is simple:

**Create the smallest, cleanest, fully playable implementation of the approved Pokémon Legends TCG design, with one basic deck shared by both players, every core feature working, and the Pokémon League Trophy providing the ultimate victory condition.**

When finished, provide a concise report covering:
- What was implemented.
- Which existing systems were reused.
- Which files were changed.
- Whether the complete match is playable.
- Which technical checks passed.
- Which assumptions were documented.
- Anything that remains incomplete.

Do not claim a feature is complete unless it has actually been implemented and verified.
---

# 16. CLARIFICATIONS FROM ELLIOTT (these settle every open question above; where they differ from sections 1–15, they take priority)

Build location: a new v4/ folder (its own engine, AI, UI and tests; plain HTML/CSS/JS modules, no build step, relative paths, playable on GitHub Pages at …/Pok-monLegendsTCG/v4/). v1, v2 and v3 must not change. Reuse code from them by copying what's useful into v4/; note where it came from.

Opponent: a simple AI only (it plays through the same engine actions as the player; a greedy one-move AI like v2's is enough). No hot-seat, online play or advanced AI yet. Do not run AI-vs-AI matches.

Hands (v1's system plus Retain): draw at Breakfast as in v1 (docs/rules.md: 7 cards), Round 1 mulligan as in v1, the hand is discarded at Supper, the Discard Pile reshuffles into the Draw Pile when it runs out, as in v1. Retain action: pay 1 Energy to keep a chosen card in hand through Supper; for each card retained, you draw one fewer at the next Breakfast.

Battlefield and Locations (v2's Locations, adapted):
- The default battlefield has 9 lanes. Each lane has one space per player, facing each other. Lanes not covered by a placed Location are the Default Location.
- Location Cards are deck cards. Placing one covers 2, 3 or 4 adjacent free lanes (set per card), on both sides; it can be placed over lanes where Pokémon already stand (they're now in it). It stays for a set number of Rounds (set per card), then is removed and its lanes return to the Default Location. Placement is only possible if enough adjacent free lanes exist.
- Pokémon are summoned into any empty space on your side, whether in a placed Location or the Default Location.
- Dominance: at Supper, for each placed Location, the player whose Pokémon there have the greater total current Strength dominates it and earns Recognition. The Default Location has no passive, Weather or dominance.

Player Character (v2's): sits outside the battlefield, has no Health and doesn't occupy a space. It shows Recognition 0–100. Pokémon can attack it; damage to it gives the attacker's player 1 Recognition per point.

Energy: Base Energy as in v1 (Round number, max 10; Pass +1 except a consecutive Pass) and v1's Exert and Exhaust mechanics exactly (docs/rules.md section 5).

Speed and Ready: keep the Speed-Tier and Ready/Spent rules exactly as they are in v3 (only Ready Pokémon attack; Ready = Active and of the highest Speed among all Active Pokémon on both sides; summoned Pokémon arrive Spent; the unmatched-speed Pass rule; trading damage).

Attack is an action: add "Command a Pokémon: attack with a Ready Pokémon" to the Battle Phase actions (targets: any enemy Pokémon or the enemy Player Character, subject to guards). Label it "Attack" in the interface so it isn't confused with Command Cards.

Guards: a Defence Pokémon protects the other Pokémon of its side in the same Location (the Default Location counts as one Location) from Physical attacks, wherever the attacker is: a Physical attack on a protected Pokémon must target the guard instead. Special Defence does the same against Special attacks. A guard also protects its Player Character from attacks by Pokémon in the guard's own Location. Infiltrator isn't in the foundation.

Weather: each Location carries Weather counters of one type. Counts are combined across placed Locations (both players') per Weather type, and simple brackets (e.g. at 2 and 4) apply passive effects to both players. Keep it to two Weather types and simple effects.

Not in the foundation: statuses (so no status-removal Items), Growth, Trainer Points, Recognition from anything other than the six approved sources.

Art and look: follow v3's "necessary information only" look (board cards show art, Attack, the Speed icon, Strength; full details in hand and on inspect). Use basic coded icons, not v1's icon images. You may reuse any card art in assets/cards/. Do not create or fetch new art: where a card needs art that doesn't exist, use a plain frame and list the missing art in your report so Elliott can make it.
