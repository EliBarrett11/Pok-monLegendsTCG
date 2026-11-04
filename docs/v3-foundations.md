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
