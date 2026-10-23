# Pokémon Legends TCG — Rules

The rules as settled while building the game, in match order. The code follows this document; when a rule changes, it changes here first.

## 1. Components

- **Deck:** 40 cards.
- **Card types:** Pokémon, Strategy, Item, Location, Supporter.
- **Trainers:** each player has 3 Trainers, kept outside the 40-card deck. Each Trainer has its own **Trainer Strength**.
- **Piles:** each player has a Draw Pile, a hand, a Discard Pile and a **Released Pile**. The Draw Pile is shuffled before the match. Defeated Pokémon go to the Released Pile, which is never shuffled back into the Draw Pile.

### 1.1 Pokémon cards

| Field | Values |
|---|---|
| Name | |
| Card-Type | Pokémon |
| Energy Cost | number |
| Pokémon Type | one of the 18 standard types: Normal, Fire, Water, Grass, Electric, Ice, Fighting, Poison, Ground, Flying, Psychic, Bug, Rock, Ghost, Dragon, Dark, Steel, Fairy |
| Image | card art |
| Attack-Type | Physical or Special |
| Attack Value | number |
| Strength-Type | Hitpoints, Defence or Special Defence |
| Strength Value | number: the Pokémon's health |
| Speed-Tier | Slow, Steady or Swift |
| Effect Trigger Word + Effect Text | optional |
| Rarity-Tier | Common (grey), Uncommon (green), Rare (blue), Epic (purple), Legendary (orange) |
| Innate Power Keyword | optional |
| Weather Token | optional |

- A Pokémon in play tracks its **current Strength** separately from its printed Strength Value. It starts equal to the Strength Value. Damage stays between Rounds.
- A Pokémon in play is either **Active** or **Spent**. Newly played Pokémon arrive Spent; at Breakfast all Spent Pokémon become Active.
- **Alert:** an Active Pokémon is Alert if its Speed-Tier equals the highest Speed-Tier among *all* Active Pokémon in the arena, both sides combined. Order: **Swift > Steady > Slow**. Alert is recalculated after every Action. Example: my Swift and the opponent's Steady Pokémon are both Active → only mine is Alert; once all Swift Pokémon are Spent, Steady Pokémon become Alert.
- Only Alert Pokémon can be Commanded.
- Pokémon Types have no combat effect. Strength-Types matter only for targeting (section 4.2).

Card definitions live in `src/engine/cardData.js`, so real cards can replace the placeholders without code changes.

## 2. The Battle Arena

- Each player has a horizontal row of **9 Pokémon Spaces**.
- The row is split into **3 equal zones** of 3 Pokémon Spaces each.
- Behind the Pokémon Spaces, each zone has **1 Trainer Space**.

## 3. Before Round 1

1. Lay out the Battle Arena.
2. Each player secretly chooses which of their 3 Trainers takes each zone.
3. Both players reveal their Trainers at the same time.
4. Flip a coin. The winner has **initiative** for Round 1.

## 4. Rounds

Every Round has three phases, in this order:

| Phase | How it is played |
|---|---|
| **Breakfast** | Simultaneous |
| **Battle** | Alternating turns, starting with the player who has initiative |
| **Supper** | Simultaneous |

Initiative switches to the other player at the start of each new Round.

### 4.1 Breakfast Phase

Every Round, each player:

1. **Recovers Exhaust** that is due this Round (see section 5).
2. **Spent Pokémon become Active** again.
3. **Base Energy** is set to the Round number, with a maximum of 10. Unspent Base Energy does not carry over.
4. **Exert maximum** goes up by 1 each Round, to a limit of 3 (Round 1 = 1, Round 2 = 2, Round 3 onward = 3). Unspent Exert carries over.
5. **Draws 7 cards**, one at a time. If the Draw Pile is empty when a card needs drawing, shuffle the Discard Pile to form a new Draw Pile, then keep drawing. If both piles are empty, drawing stops and the player keeps a smaller hand.

**Mulligan (Round 1 only):** each player may put any number of cards from their hand into their Discard Pile, then draw the same number from their Draw Pile. Both players choose in secret and reveal together.

### 4.2 Battle Phase

- Players alternate turns, starting with the player who has initiative.
- Each turn is exactly **1 Action**. The Actions so far:
  - **Pass.**
  - **Play a Pokémon Card:** play a Pokémon from your hand into any empty Pokémon Space on your side of the arena, paying its Energy Cost (section 5). You can't play it if you can't afford it. It arrives **Spent** and can't be Commanded this Round.
  - **Command an Alert Pokémon:** choose one of your Alert Pokémon and a legal target. A Command is always an Attack, and costs no Energy. See 4.2.1.
- Passing doesn't lock a player out: if one player passes and the other takes an Action, the first player gets another turn.
- The Battle Phase ends when **both players Pass consecutively**.

#### 4.2.1 Attacks

- **Targets:** any opponent Pokémon (Active or Spent) or any opponent Trainer, with these restrictions:
  - If the opponent has any Pokémon with **Defence** Strength-Type (Active or Spent), a **Physical** attacker must target one of those.
  - If the opponent has any Pokémon with **Special Defence** Strength-Type (Active or Spent), a **Special** attacker must target one of those.
  - A Trainer at 0 Strength can't be targeted.
- **Damage:** the attacker deals its Attack Value to the target's current Strength. Extra damage beyond what the target has left is lost.
- **Trading damage:** if the target is an **Alert** Pokémon, it deals its Attack Value back to the attacker at the same time, and both become Spent.
- If the target is a Spent or non-Alert Pokémon, or a Trainer, it takes the damage without hitting back. Only the attacker becomes Spent.
- **Defeat:** a Pokémon at 0 Strength or less is defeated and goes to its owner's Released Pile. Both Pokémon can be defeated in the same trade.
- Trainer Strength can't go below 0.

### 4.3 Supper Phase

- Each player puts all cards left in their hand into their Discard Pile.
- Then the next Round begins.

## 5. Energy: Base Energy, Exert and Exhaust

- A player always has as many Exert points as their Exert maximum. Each is either **available** or **Exhausted**, so available Exert = Exert maximum − Exhaust points.
- **Paying a cost:** Base Energy is spent first. Exert can only cover a shortfall: when the cost is more than the Base Energy left, or no Base Energy is left. Example: 2 Base Energy, cost 3 → spend 2 Base Energy + 1 Exert.
- An Action can't be taken if Base Energy + available Exert is less than its cost.
- **Exhaust:** each Exert point spent becomes 1 Exhaust point. Each point runs its own clock and takes the fastest free **Recovery Position**:

| Recovery Position | Recovers into Exert at Breakfast… |
|---|---|
| 1 | 2 Rounds after the Round it was spent |
| 2 | 3 Rounds after |
| 3 | 4 Rounds after |

- A position is free again once its point has recovered. Points never move up a position.
- Examples:
  - Spend 1 in Round 1 → position 1 → recovers Round 3.
  - Spend 2 in Round 2 → positions 1 and 2 → recover Rounds 4 and 5. Then spend 1 in Round 3 → position 3 → recovers Round 7. Then spend 1 in Round 4 (position 1 was freed at Round 4 Breakfast) → position 1 → recovers Round 6.

Playing a Pokémon is the only Action that costs Energy so far.

## 6. End of the match

- **Win:** a player wins immediately when all 3 opponent Trainers are at 0 Strength.
- **Draw:** if neither player has a Pokémon left in their arena, hand, Draw Pile or Discard Pile, nobody can deal damage again, so the match ends in a draw.

## Open questions

- What do Strategy, Item, Location and Supporter cards do, and how are they played?
- Can a Command be anything other than an Attack?
- Do Trainers do anything besides take damage (abilities, zone effects)?
- What do Effects, Innate Powers and Weather Tokens do?
- Can Pokémon heal?
- Does Rarity limit how many copies go in a deck?
- Is there a hand size limit, or any limit on Rounds?

## Placeholders in the current build

- Decks are 16 Pokémon, 8 Strategy, 8 Item, 4 Location and 4 Supporter cards. This mix is a stand-in, not a rule.
- The 16 Pokémon are invented placeholders, one of each per deck, with the same list for both players. Stats: Energy Cost 1–6, Attack 1–6, Strength 2–10.
- Placeholder art is a box tinted by Pokémon Type. Effect, Innate Power and Weather text on placeholders is sample text and does nothing.
- Strategy, Item, Location and Supporter cards have only a name and Card-Type.
- Trainers are named Trainer A, B and C and have no abilities yet.
- Every Trainer has Strength 15.
- The AI's turn: if it has an Alert Pokémon, it Commands one at random to attack a random legal target. Otherwise it plays a random Pokémon it can afford with Base Energy alone (it never uses Exert) into a random empty space. Otherwise it passes.
