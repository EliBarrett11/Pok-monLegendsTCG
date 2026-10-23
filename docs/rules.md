# Pokémon Legends TCG — Rules

The rules as settled while building the game, in match order. The code follows this document; when a rule changes, it changes here first.

## 1. Components

- **Deck:** 40 cards.
- **Card types:** Pokémon, Strategy, Item, Location, Supporter.
- **Trainers:** each player has 3 Trainers, kept outside the 40-card deck. Each Trainer has its own **Trainer Strength**.
- **Piles:** each player has a Draw Pile, a hand and a Discard Pile. The Draw Pile is shuffled before the match.

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
2. **Base Energy** is set to the Round number, with a maximum of 10. Unspent Base Energy does not carry over.
3. **Exert maximum** goes up by 1 each Round, to a limit of 3 (Round 1 = 1, Round 2 = 2, Round 3 onward = 3). Unspent Exert carries over.
4. **Draws 7 cards**, one at a time. If the Draw Pile is empty when a card needs drawing, shuffle the Discard Pile to form a new Draw Pile, then keep drawing. If both piles are empty, drawing stops and the player keeps a smaller hand.

**Mulligan (Round 1 only):** each player may put any number of cards from their hand into their Discard Pile, then draw the same number from their Draw Pile. Both players choose in secret and reveal together.

### 4.2 Battle Phase

- Players alternate turns, starting with the player who has initiative.
- Each turn is exactly **1 Action**. For now the only Action is **Pass**.
- Passing doesn't lock a player out: if one player passes and the other takes an Action, the first player gets another turn.
- The Battle Phase ends when **both players Pass consecutively**.

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

No Action costs Energy yet; this logic is built and tested ahead of time.

## 6. Winning

- A player wins immediately when all 3 enemy Trainers are at 0 Strength. (Nothing can reduce Strength yet.)

## Open questions

- What Actions besides Pass can a player take on a Battle turn, and what do they cost?
- How is Trainer Strength reduced?
- Is there a hand size limit, or any limit on Rounds?

## Placeholders in the current build

- Decks are 16 Pokémon, 8 Strategy, 8 Item, 4 Location and 4 Supporter cards. This mix is a stand-in, not a rule.
- Trainers are named Trainer A, B and C and have no abilities yet.
- Every Trainer has Strength 15.
- The AI passes on every Battle turn.
