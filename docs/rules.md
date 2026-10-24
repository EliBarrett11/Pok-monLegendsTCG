# Pokémon Legends TCG — Rules

The rules as settled while building the game, in match order. The code follows this document; when a rule changes, it changes here first.

## 1. Components

- **Deck:** 40 cards.
- **Card types:** Pokémon, Strategy, Item, Location, Supporter.
- **Trainers:** each player has 3 Trainers, kept outside the 40-card deck. Each Trainer has its own **Trainer Strength**, a **Power** and a **Passive** (section 7).
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
| Effect Trigger Word + Effect Text | optional: the Pokémon's ability (section 8) |
| Rarity-Tier | Common (grey), Uncommon (green), Rare (blue), Epic (purple), Legendary (orange) |
| Innate Power Keyword | optional |
| Weather Token | optional |

- A Pokémon in play tracks its **current Strength** separately from its printed Strength Value. It starts equal to the Strength Value. Damage stays between Rounds.
- A Pokémon in play is either **Active** or **Spent**. Newly played Pokémon arrive Spent; at Breakfast all Spent Pokémon become Active.
- **Alert:** an Active Pokémon is Alert if its Speed-Tier equals the highest Speed-Tier among *all* Active Pokémon in the arena, both sides combined. Order: **Swift > Steady > Slow**. Alert is recalculated after every Action. Example: my Swift and the opponent's Steady Pokémon are both Active → only mine is Alert; once all Swift Pokémon are Spent, Steady Pokémon become Alert.
- Only Alert Pokémon can be Commanded.
- Pokémon Types have no combat effect. Strength-Types matter only for attack targeting (section 4.2) and Strength-Type buffs (section 7.1).

Card definitions live in `src/engine/cardData.js`, so real cards can replace the placeholders without code changes.

### 1.2 Strategy Cards

| Field | Values |
|---|---|
| Name | |
| Card-Type | Strategy |
| Energy Cost | number |
| Effect Text | what it does |
| Rarity-Tier | as for Pokémon |
| Image | card art |

| Card | Cost | Effect |
|---|---|---|
| **Quickdraw** | 1 | Draw 2 cards (normal draw rules, including reshuffling the Discard Pile if the Draw Pile runs out). Can't be played if there is nothing to draw; with only 1 card available it draws 1. |
| **Hypervoice** | 3 | Deal 2 damage to all opponent Pokémon (area). Can't be played if the opponent has no Pokémon. |
| **Recover** | 3 | Heal 5 Strength to any target (targeted): any damaged Pokémon or Trainer on either side, capped at maximum Strength. Only cards below their maximum Strength can be chosen. |

### 1.3 Innate Powers

Keyword abilities on Pokémon that always apply.

- **Quick Attack:** this Pokémon is summoned Active instead of Spent, so it can be Alert and Commanded the Round it arrives (by the normal Alert rules).
- **Agility:** this Pokémon can't be chosen as a target by Strategy Cards. Area effects (e.g. Hypervoice) still affect it. Trainer Powers and attacks can still target it.

### 1.4 Supporter Cards

| Field | Values |
|---|---|
| Name | |
| Card-Type | Supporter |
| Card-Cost | a number of cards to **Discard** and/or **Release** |
| Effect Text | what it does |
| Gift Bonus Challenge | a condition on the paid cards |
| Gift Bonus | what happens if the challenge is met: an enhanced effect, or an extra one |
| Rarity-Tier | as for Pokémon |
| Image | card art |

- **Supporters cost cards, not Energy.** The Card-Cost is paid exactly, with cards from your hand other than the Supporter itself. Discarded cards go to the Discard Pile; Released cards go to the Released Pile and are gone for the match (never reshuffled).
- **Gift Bonus Challenge:** a condition that can refer to anything printed on a card (Card-Type, Pokémon Type, Speed-Tier, Rarity, Energy Cost, and so on). It's met if at least one paid card, discarded or released, matches it. Then the Gift Bonus applies.
- **Order:** the cost is paid first (so a draw can reshuffle a card just discarded to pay), then the effect, with any Gift Bonus, resolves, then the Supporter goes to your Discard Pile.
- **Once per Round:** each player may play only **one Supporter Card per Round**.
- A Supporter can't be played if you don't have enough other cards in hand to pay, or if it has no legal target.

| Card | Card-Cost | Effect | Gift Bonus Challenge | Gift Bonus |
|---|---|---|---|---|
| **Field Researcher** | Discard 1 | Draw 2 cards. | a Strategy Card | Draw 1 more card. |
| **Veteran Coach** | Release 1 | Friendly Pokémon in a chosen Zone gain +1/+1 (permanent). Only a Zone where you have at least one Pokémon can be chosen (a fallen zone is fine); Pokémon summoned there later don't get it. | a Swift-Tier Pokémon | +2/+2 instead. |
| **Field Medic** | Discard 1, Release 1 | Heal a friendly Trainer 4 Strength. Only a damaged friendly Trainer can be chosen. | a Water Pokémon | Also heal all friendly Pokémon in that Trainer's Zone 2 Strength. |

## 2. The Battle Arena

- Each player has a horizontal row of **9 Pokémon Spaces**.
- The row is split into **3 equal zones** of 3 Pokémon Spaces each.
- Behind the Pokémon Spaces, each zone has **1 Trainer Space**.
- **Zones run across both sides:** my Zone 1 and the opponent's Zone 1 are the same zone. "X's Zone" means that whole zone, both sides, unless a card says "friendly" or "opponent".
- **Fallen zones:** when a Trainer is removed (section 7.3), its zone falls on that player's side. Pokémon already there stay and keep fighting, but that player can't play new Pokémon (or, later, Locations) into that zone. The opponent's side of the zone is unaffected.

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
6. **On Breakfast** abilities fire (section 8).

**Mulligan (Round 1 only):** each player may put any number of cards from their hand into their Discard Pile, then draw the same number from their Draw Pile. Both players choose in secret and reveal together.

### 4.2 Battle Phase

- Players alternate turns, starting with the player who has initiative.
- Each turn is exactly **1 Action**. The Actions so far:
  - **Pass.**
  - **Play a Pokémon Card:** play a Pokémon from your hand into any empty Pokémon Space on your side of the arena (not in a fallen zone), paying its Energy Cost (section 5). You can't play it if you can't afford it. It arrives **Spent** and can't be Commanded this Round.
  - **Command an Alert Pokémon:** choose one of your Alert Pokémon and a legal target. A Command is always an Attack, and costs no Energy. See 4.2.1.
  - **Use a Trainer Power:** pay its cost (section 5); each Trainer's Power can be used once per Round, and not if it has no legal target. See 7.2.
  - **Play a Strategy Card:** on any of your turns, pay its Energy Cost (section 5). Its effect resolves immediately, then the card goes to your Discard Pile. A Strategy Card can't be played if it has no legal target (or, for an area card, nothing to affect). Cards drawn during Battle go into your hand and can be played this Round; they're discarded at Supper with the rest of your hand.
  - **Play a Supporter Card:** on any of your turns, once per Round, pay its Card-Cost in cards (section 1.4). Its effect, with any Gift Bonus, resolves immediately, then the card goes to your Discard Pile.
- Passing doesn't lock a player out: if one player passes and the other takes an Action, the first player gets another turn.
- The Battle Phase ends when **both players Pass consecutively**.

#### 4.2.1 Attacks

- **Targets:** any opponent Pokémon (Active or Spent) or any opponent Trainer, with these restrictions:
  - If the opponent has any Pokémon with **Defence** Strength-Type (Active or Spent), a **Physical** attacker must target one of those.
  - If the opponent has any Pokémon with **Special Defence** Strength-Type (Active or Spent), a **Special** attacker must target one of those.
  - A Trainer at 0 Strength can't be targeted.
- **Damage:** the attacker deals its Attack Value (including buffs and Passive bonuses) to the target's current Strength. Extra damage beyond what the target has left is lost.
- **Trading damage:** if the target is an **Alert** Pokémon, it deals its Attack Value back to the attacker at the same time, and both become Spent.
- If the target is a Spent or non-Alert Pokémon, or a Trainer, it takes the damage without hitting back. Only the attacker becomes Spent.
- **Defeat:** a Pokémon at 0 Strength or less is defeated and goes to its owner's Released Pile. Both Pokémon can be defeated in the same trade.
- Trainer Strength can't go below 0.

### 4.3 Supper Phase

- **On Supper** abilities fire (section 8).
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

Playing a Pokémon and using a Trainer Power cost Energy so far.

## 6. End of the match

- **Win:** a player wins immediately when all 3 opponent Trainers are at 0 Strength.
- **Draw:** if neither player has a Pokémon left in their arena, hand, Draw Pile or Discard Pile, nobody can deal damage again, so the match ends in a draw.

## 7. Trainers and effects

### 7.1 Stat rules (all effects)

- "+A/+S" means +A Attack Value and +S Strength.
- "+X Hitpoints / +X Defence / +X Special Defence" means +X Strength, but only for a Pokémon with that Strength-Type. Others can't be chosen as targets, and area versions skip them.
- Buffs are permanent unless a card says otherwise. Buffed stats are shown in green.
- A Strength buff raises both current and maximum Strength.
- Healing can't go above maximum Strength (for Trainers: their starting Strength). Healing can target Trainers.
- Effect damage uses the same defeat rules as combat: Pokémon at 0 or less go to the Released Pile; Trainer Strength stops at 0.
- **Targeted** means the card makes the player choose a target. **Area** means it affects all matching cards without a choice.

### 7.2 Powers and Passives

- **Power (Battle Phase Action):** uses your 1 Action for the turn. Its cost is paid like any other (Base Energy first, Exert only for a shortfall). Each Trainer's Power can be used **once per Round**, and can't be used if it has no legal target.
- **Passive:** always applies, but only in that Trainer's Zone. Passive stat bonuses are recalculated continuously: a Pokémon summoned into the zone gains them, and they're lost if the Trainer is removed.
- **When a Passive is lost**, maximum Strength drops by the bonus; current Strength only drops if it's above the new maximum. Losing a Passive never defeats a Pokémon.
- **Summoning order:** a Pokémon arrives, gains its Passive bonuses, then "when summoned" effects (like Brock's) apply.

### 7.3 Trainer removal

- A Trainer at 0 Strength is **removed**: its Passive and Power stop working, and it can't be targeted.
- Its zone **falls** on that player's side (section 2).

### 7.4 The Trainers

Both players use these three for now (placeholders until the real Trainers arrive).

| Trainer | Strength | Power | Passive |
|---|---|---|---|
| **Ash** | 15 | **(1):** Draw 1 card. If it's a 1-cost Pokémon, you may summon it immediately without paying its cost (normal summoning rules: any empty space in your row outside a fallen zone, arrives Spent unless it has Quick Attack; if there is no such space, it stays in hand). Can't be used if there is no card to draw. | Friendly Pokémon in Ash's Zone gain +1/+1. |
| **Misty** | 15 | **(1):** Deal 1 damage to an opponent Pokémon in Misty's Zone. | Friendly Water Pokémon in Misty's Zone gain +3 Strength. |
| **Brock** | 15 | **(1):** Give a friendly Pokémon +2 Defence (Defence Strength-Type only). | Opponent Pokémon summoned to Brock's Zone take 1 damage. |

## 8. Pokémon abilities

A Pokémon ability is an **Effect Trigger Word** plus **Effect Text**. It fires every time its condition is met.

| Trigger Word | Fires… |
|---|---|
| **On Summon** | when this Pokémon enters the arena, whether played or summoned by an effect (e.g. Ash's Power). |
| **On Attack** | after this Pokémon's attack deals damage, if it's still in the arena. |
| **On Defend** | after this Pokémon is attacked (by a Command) and takes damage, if it's still in the arena. Effect damage never triggers it. |
| **On Defeated** | when this Pokémon is defeated by any cause, as it goes to the Released Pile. |
| **On Breakfast** | at each Breakfast while it's in the arena, after cards are drawn and Energy is gained. |
| **On Supper** | at each Supper while it's in the arena, before hands are discarded. |

- **Choosing targets:** if an ability says to choose a target, its owner must pick one when it resolves (they can't decline). With no legal target, nothing happens.
- **Order:** when several abilities or Passives trigger at the same moment, the player with initiative resolves theirs first, then the other player. Within each player, in zone order 1 → 2 → 3, then left to right. (In the build, a Trainer's Passive comes after the Pokémon in its zone.)
- **Chains:** if an ability's result sets off another ability (e.g. its damage defeats a Pokémon with On Defeated), the new one resolves immediately, before anything still waiting.
- **In a trade:** (1) both Pokémon deal their damage at once; (2) defeated Pokémon fire On Defeated and go to the Released Pile; (3) survivors fire On Attack / On Defend, in the order above. The attacker's On Attack and the target's On Defend can both fire.
- **Winning** still happens immediately: a match that is won mid-resolution stops there.
- **Extra Base Energy** from an ability can go above the limit of 10; it still doesn't carry over to the next Round.

## Open questions

- **Stalled matches:** healing (Recover) can keep up with the only damage left, so a match can go on forever while a Pokémon is still in play (about 1 in 30 AI-vs-AI matches before Supporters; none in the latest 60, as Released cards now thin decks out). Should there be a Round limit or a "no progress" draw? (For now the AI-vs-AI test stops matches at Round 100 and reports them as stalled.)
- **Quick Attack and Ash:** Ash's Power says the free summon "arrives Spent". The build lets Quick Attack win (the Pokémon arrives Active), because every summon follows the same rules. Is that right?
- What do Item and Location cards do, and how are they played?
- Can a Command be anything other than an Attack?
- What do Weather Tokens do?
- **Trainer vs Pokémon order:** when a Trainer's Passive and a Pokémon in the same zone trigger at the same moment, which goes first? (The build puts the Trainer after the Pokémon in its zone.)
- **On Supper:** no placeholder uses it yet; the hook is built and tested.
- Does Rarity limit how many copies go in a deck?
- Is there a hand size limit?

## Placeholders in the current build

- Decks are 16 Pokémon, 8 Strategy (3 Quickdraw, 3 Hypervoice, 2 Recover), 8 Item, 4 Location and 4 Supporter (2 Field Researcher, 1 Veteran Coach, 1 Field Medic) cards. This mix is a stand-in, not a rule.
- The 16 Pokémon are invented placeholders, one of each per deck, with the same list for both players. Stats: Energy Cost 1–6, Attack 1–6, Strength 2–10.
- Placeholder art is a box tinted by Pokémon Type (striped blue for Strategy Cards). Weather text on placeholder Pokémon is sample text and does nothing.
- Placeholder abilities (section 8):

| Ability | Pokémon |
|---|---|
| **On Summon:** Deal 1 damage to an opponent Pokémon in this Pokémon's Zone. | Emberkit, Shadepup, Quakemaw |
| **On Attack:** If this Pokémon attacked a Trainer, draw 1 card. | Gustling, Duskfang |
| **On Defend:** Deal 1 damage to the attacker. | Sproutle, Pebblet, Ironhorn |
| **On Defeated:** Heal the friendly Trainer in this Pokémon's Zone 3 Strength (nothing if that Trainer has been removed). | Puddlop, Mothdust, Toxifin |
| **On Breakfast:** Gain 1 extra Base Energy this Round. | Frostail, Glimmeria |

  Zappip, Brawlix and Mindrake have no ability.
- Innate Powers on placeholder Pokémon: **Quick Attack** on Zappip, Brawlix and Duskfang; **Agility** on Gustling, Shadepup and Glimmeria.
- Strategy Card rarities are placeholders: Quickdraw Common, Hypervoice Uncommon, Recover Rare. So are the Supporters': Field Researcher Common, Veteran Coach Uncommon, Field Medic Rare.
- Item and Location cards have only a name and Card-Type.
- Both players use the same three Trainers: Ash, Misty and Brock (section 7.4), each with Strength 15.
- To give every Trainer something to work with, three placeholder Pokémon are Water (Puddlop, Frostail, Toxifin), four cost 1, and five have Defence Strength-Type.
- **The AI** places Trainers at random and only spends Base Energy (never Exert). On a Battle turn it scores every legal move and picks the best (ties at random), passing only when nothing else is legal. From the top: winning the match; bringing an enemy Trainer to 0; defeating an enemy Pokémon (by attack or Misty) without losing its own; attacking the weakest enemy Trainer; playing its most expensive affordable Pokémon, preferring zones where its own Passives boost it and avoiding the opponent's Brock zone; Brock's buff on its strongest Defence Pokémon, Ash's draw, Misty chip damage; other attacks; and last, trades that lose the attacker for nothing. It always takes Ash's free summon when there is room. Strategy Cards: Hypervoice only when you have Pokémon (scored by damage dealt and Pokémon defeated), Recover only on its own damaged Pokémon or Trainers (more when a Trainer is low), Quickdraw about as highly as Ash's draw. Supporters: it pays with random cards from its hand, but puts a card that meets the Gift Challenge in when it has one; it scores them by what they gain (Field Researcher like a draw, Veteran Coach by stats gained, Field Medic by Strength healed) minus the cards paid, a Released card counting double. When one of its abilities needs a target, it picks a random legal one. It tries moves on a copy of the game to score them (abilities included), except draws (Ash, Quickdraw), so it never sees its own Draw Pile.
