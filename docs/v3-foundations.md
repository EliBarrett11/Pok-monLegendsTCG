# Pokémon Legends v3: foundations

**Status: a blank canvas (Elliott, 4 Nov).** v3 starts fresh. Nothing from v1 or v2 is assumed: each feature is chosen and rebuilt from the ground up, in conversation with Elliott. v1 and v2 stay playable as they are.

## What Elliott has learned (his words, summarised)

1. **A Player Career.** The game follows the player's career as a Pokémon Trainer character, and should lean into that more.
2. **Locations can be fun without being in a deck or controlled by the player.**
3. **Energy is the key resource.** Gameplay is limited to managing one resource. Trainer Points, Growth, Weather Tokens and any other resources are to be revised so Energy stays the focus.
4. **Dynamic cards work.** Pokémon and Strategy Cards that change with the Rounds stop dead draws and make the game interesting.
5. **Traditional hands.** Discarding the hand every Round may not be best; try a traditional trading-card-game hand system instead.

## Working method

Elliott leads. Claude asks what to work on, discusses it, and writes down only what Elliott settles. Knowledge of v1 and v2 (what was built, tested and learned) is available as reference, never as a default.

## Round 1 (Elliott, 4 Nov)

- Each player draws **6 cards**.
- **Card types:** Pokémon, Moves (what v1 and v2 called Strategy Cards), Supporters, Items. Effects and keywords stay extremely basic for now.
- Each player has **1 Energy**.
- **The field:** one starting Location, **Pallet Town**, with **2 lanes**. There are no other lanes on the board. Art: `assets/cards/pallet-town.jpg`.
- There is nothing else yet.

## Round 1 details and the board (Elliott, 4 Nov)

- **Lanes:** one Pokémon per player per lane, facing each other.
- **Rounds:** Breakfast, Battle, Supper. Battle turns alternate.
- **No dead draws:** a Pokémon starts at Level 1 of 6 in Round 1 and gains +1 Level per Round while it isn't on the board. Its cost follows its cost band: Light 0–5, Medium 1–6, Heavy 2–7 (Level 1 = the band's lowest cost).
- **Attacking** works as before: a summoned Pokémon is Spent the turn it arrives.
- **Defence and Special Defence** protect all Pokémon and the player within the same Location.
- **Goal:** become Regional Champion by being the first to reach the Pokémon League Trophy on the right-most space.
  - Each player has an on-board portrait, whose border contains a board space. Each starts on space 1 in Pallet Town.
  - **Recognition** comes from attacking the opposing player character and from rewards: most successful actions give a little (e.g. defeating an opposing Pokémon).
  - Each time a player crosses into the next 10 Recognition (9 → 10, or 45 → 53), their portrait moves one space right.
- **The board** has at most 10 spaces, opened as Locations drop in.
- **Locations are controlled by the game** and work like a treadmill:
  - From Round 2, each Round Pallet Town loses a space as it moves one space left.
  - Pokémon and player characters keep their spaces; the Locations pass through them.
  - The game drops a new Location to the right at a Breakfast of its choosing, with 1, 2 or 3 lanes, available at once.
  - Locations travel left until they're removed completely.
- **Concept images:** `docs/design/v3-concept-R1.jpg`, `-R2.jpg`, `-R6.jpg`.

## Settled 4 Nov (evening)

- **Portrait spaces:** a Pokémon may stand on the space its player's portrait occupies. Your player character can only be protected by the Pokémon in its own space, whatever its Strength-Type. Defence and Special Defence Pokémon protect your *other* Pokémon in the same Location.
- **New Locations:** a new Location is added every Round. A portrait that would advance past the last open space waits there until a new Location opens the next one.
- **When a Location slides off the left edge:** Pokémon stay exactly where they are. The next Location slides into their spaces, so they're now in that Location without having moved.
- **Your portrait leaving its guards behind as it advances** is intentional, to keep players thinking.
- **Location objectives belong to the Location's identity,** not to a strategy. Some luck from which Locations arrive is acceptable (later drawn at random from a large pool).
- **Timing:** a Location's objective lasts until it naturally slides off the board. Milestone rewards are given immediately; completion rewards are given when the Location expires.
- **Elliott's ideas so far:**
  - **Pallet Town** rewards a unique Bulbasaur, Charmander, Squirtle, Pikachu, Professor Oak or Gary card.
  - **Viridian Forest:** each Move Card played summons a cheap wild Pokémon themed on the Location into an empty space there on your side.
  - **Cerulean City Gym:** defeat Misty's Starmie, a Pokémon taking up a whole lane, beaten by the player who deals it the most damage.

## Settled 4 Nov (late)

- **Treadmill, option 3:** when a new Location arrives, the board shifts left by its width (1–3 spaces), so a big Location pushes the world along. One new Location every Round. Players can't be sure whether the leftmost Location will go next Round or later.
- **Location ideas:** Claude's twelve Location concepts are ideas only; nothing is locked.
- **Hands:** a traditional TCG hand. A limited opening draw; unused cards are **kept**, not discarded. A draw at each Breakfast and a hand limit (numbers to set). Card draw matters again.
- **Supporters:** as in v2. Release cards from your hand to play them (stronger now, since a released card would otherwise have been kept).
- **Trainers:** on hold. What Elliott liked: permanent pieces on the board, perhaps extra portraits like the player character's, with more freedom to move. Trainer Points and tier unlocks are not returning.
- **Items:** on hold (undecided between PokéDollars and Energy; Energy risks making them too like Moves).
- **Exert:** may return in some form (Elliott enjoyed v1's version: exciting, flexible, a real cost).
- **Starting cards:** extremely basic, generic test cards first, before redesigning any decks. "If it's not fun with bad cards, it's not fun with great decks."

## Settled 4 Nov (night)

- **Deck and hand:** 40-card decks, opening hand 6, draw 2 at each Breakfast, hand limit 10 (a card drawn beyond 10 is lost).
- **Overexert:** once per Round you may spend up to 2 Energy you don't have; at the next Breakfast you get that much less, plus 1 (borrow 2, lose 3).
- **Energy:** the Round number, capped at 10. Pass gives +1 (as before). No Stored Energy.
- **Moves:** v2's breakpoints return (pay a chosen amount; each higher breakpoint gives more value per Energy).
- **Speed stays; it's what makes the game different.** It drives the tension of alternating turns, the passing strategy and targeting. Clearer presentation:
  - **Ready** replaces "Alert"; **Spent** stays.
  - Every Pokémon on the board shows its **Speed-Tier icon between its Attack and Strength**.
  - Ready Pokémon get a clearly visible, gently animated glow on both sides (stronger than v2's faint glow).
- **Pokémon on the board:** frozen at the Level they were played. They don't move between spaces.
- **Defeated Pokémon** go to the Released Pile (which also receives Supporter payments). No way back.
- **Running out of cards:** each draw you can't make gives your opponent escalating Recognition (numbers to set).
- **Mulligan:** yes; mulliganed cards are shuffled back into the deck.
- **Recognition:** 1 per damage to the enemy player (attacks or other damage); a small amount for defeating a Pokémon; Location milestones and completions; some Supporter Favour bonuses; possibly a small passive amount each Round to keep the pace steady.
- **Winning:** 100 Recognition. 90 brings you to the final space (space 10), and you must also complete it to reach the Trophy. If no one has reached it after a set number of Locations, the game places an end-game Location, the **Regional Championship Tournament**, which guarantees one player reaches the Trophy. Target match length: **45 minutes**.
- **No statuses** for now.

## Settled 4 Nov (V3-0)

- **Treadmill (Elliott):** a new Location is added each Round until all 10 spaces are covered by Locations. From then on, each new Location shifts the others left by its width. The board grows to the full 10 spaces and no further. (When a new Location is wider than the room left, it shifts by the overflow.)
- **Starting values (Elliott, a starting point, in `v3/src/rules.js`):**
  - +2 Recognition at each Breakfast;
  - +2 for defeating a Pokémon;
  - 1 per damage to the enemy player;
  - running out of cards gives the opponent +3, +6, +9…;
  - the Regional Championship arrives as the 10th Location if no one has reached the Trophy, covers every space, and at its end the higher Recognition is crowned Champion.
- **Claude's placeholders in V3-0 (to confirm):**
  - **The Championship:** it lasts 2 Rounds; a tie plays on Round by Round, up to 3 more, then it's a draw.
  - **Passive Recognition:** from Round 2's Breakfast.
  - **Overexert:** a free action on your turn, not a Battle Action.
  - **Lost cards:** a card drawn beyond the hand limit goes to the Released Pile. Played Moves go to a Discard Pile.
  - **Portrait protection** also stops Moves and Supporters from targeting the player character.
  - **The Trophy:** 100 Recognition wins only once space 10 is open.
  - **Locations:** the six test Locations' objectives and rewards are simple test values.

## Settled 4 Nov (late night)

- **Treadmill, revised (replaces option 3):** at the start of each Round, every Location moves one space left, and the leftmost Location shrinks by one lane (it's leaving the board). It's removed when no lanes are left. Pokémon and portraits still never move. New Locations arrive on the right, in the free spaces.
- **Test cards:** actual Pokémon, Moves and Supporters from v1 and v2 (their names and identities), keeping only their effects; anything relying on systems v3 doesn't have yet is dropped.
- **Art:** only art made for v1 and v2, plus Pallet Town.

## V3-1 (built; Claude's choices to confirm)

- **Treadmill as built:**
  - From Round 2, at the start of each Round every Location moves one space left. The leftmost loses a lane and is removed when none is left; its completion rewards are given then.
  - A new Location then arrives on the right if one fits the free spaces there. The game picks the widest that fits, so the board fills its 10 spaces and stays full; if nothing fits, it waits.
  - Once the board is full, only one space frees each Round, so only 1-lane Locations can arrive (V3-1 has three: Shalour City, Floaroma Meadow and Petalburg Woods).
- **The Regional Championship:**
  - The treadmill never clears the board, so the Championship arrives as soon as it's due (the 10th Location, Round 10).
  - It covers every space at once; the other Locations leave and pay their completion rewards.
- **Infiltrator** (from v1/v2): its attacks ignore guards and the portrait's protection.
- **Cards:** the test deck uses v1/v2 Pokémon, Moves and Supporters. Their dropped parts are listed in `v3/README.md` (V3-1).
