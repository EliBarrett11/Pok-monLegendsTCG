# Pokémon Legends TCG — Rules

The rules as settled while building the game, in match order. The code follows this document; when a rule changes, it changes here first.

## 1. Components

- **Deck:** 40 cards, in the **standard split**: 18 Pokémon, 8 Strategy, 4 Supporter, 4 Location, 6 Item. **Copy limits** per card, by Rarity-Tier: Common 3, Rare 2, Epic 1, Legendary 1, and **at most one Legendary card in a deck**. A deck that breaks these can't be used (`deckProblems` in `src/engine/cards.js`); every deck is checked as the game loads, and a broken one stops the game with an error naming the deck and each problem.
- **The decks:** there are two, Fire and Water (section 9). Before each match the player chooses Fire, Water or Random, and the AI plays the other deck.
- **Card types:** Pokémon, Strategy, Item, Location, Supporter.
- **Trainers:** each player has 3 Trainers, kept outside the 40-card deck; each deck comes with its own three (section 9). Each Trainer has its own **Trainer Strength**, a **Power** and a **Passive** (section 7).
- **Piles:** each player has a Draw Pile, a hand, a Discard Pile and a **Released Pile**. The Draw Pile is shuffled before the match. Defeated Pokémon, Released cards and completed Locations go to the Released Pile, which is never shuffled back into the Draw Pile.
- **XP:** each player has an XP pool, starting at 0. XP can be stored indefinitely (section 4.1.1).
- **PokéDollars:** each player has a PokéDollar pool, starting at 0, which carries over between Rounds. Each player gains **+1 PokéDollar at each Breakfast**, including Round 1. Whenever an opponent's Pokémon is defeated by any cause (your attack, damage traded back by your Pokémon, effects, Weather, Burn), you earn PokéDollars equal to that Pokémon's printed Energy Cost.
- **Bag:** each player has a Bag with 6 spaces (section 1.7). **PokéMart:** one shared by both players (section 1.7).

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
| Rarity-Tier | Common, Rare, Epic or Legendary (four tiers, each with its own icon) |
| Innate Power Keyword | optional |
| Weather Tokens | optional: one or more types with counts, e.g. 1 Sun (section 1.6) |

- A Pokémon in play tracks its **current Strength** separately from its printed Strength Value. It starts equal to the Strength Value. Damage stays between Rounds.
- A Pokémon in play is either **Active** or **Spent**. Newly played Pokémon arrive Spent; at Breakfast all Spent Pokémon become Active.
- **Alert:** an Active Pokémon is Alert if its Speed-Tier equals the highest Speed-Tier among *all* Active Pokémon in the arena, both sides combined. Order: **Swift > Steady > Slow**. A Held Item (Quick Claw) can raise a Pokémon's Speed-Tier. Alert is recalculated after every Action. Example: my Swift and the opponent's Steady Pokémon are both Active → only mine is Alert; once all Swift Pokémon are Spent, Steady Pokémon become Alert.
- Only Alert Pokémon can be Commanded.
- Pokémon Types have no combat effect. Strength-Types matter only for attack targeting (section 4.2) and Strength-Type buffs (section 7.1).

Card definitions live in `src/engine/cardData.js`; the cards themselves are listed with their decks in section 9.

### 1.2 Strategy Cards

| Field | Values |
|---|---|
| Name | |
| Card-Type | Strategy |
| Energy Cost | number |
| Effect Text | what it does |
| Rarity-Tier | as for Pokémon |
| Image | card art |

- A Strategy Card can't be played if a targeted part has no legal target, or, for an area card, if it has nothing to affect: at least one of its area parts must affect something (Surf with no enemy Pokémon can still be played to heal a damaged friendly Pokémon). A part that works on "the chosen Zone" or "it" follows whatever was chosen.
- The Strategy Cards are listed with their decks (section 9).

### 1.3 Innate Powers

Keyword abilities on Pokémon that always apply. A Pokémon can have more than one (e.g. "Overrun, Scorch 2"). X is the keyword's number.

- **Quick Attack:** this Pokémon is summoned Active instead of Spent, so it can be Alert and Commanded the Round it arrives (by the normal Alert rules).
- **Infiltrator:** This Pokémon's attacks ignore the Defence and Special Defence targeting restrictions: it may attack any enemy Pokémon or any enemy Trainer still in play. Trading damage works as normal (an Alert target still hits back). Fire's fast raiders (Ponyta, Mankey, Sneasel, Arcanine) have it.
- **Agility:** this Pokémon can't be chosen as a target by Strategy Cards. Area effects (e.g. Surf) still affect it. Trainer Powers and attacks can still target it.
- **Scorch X:** when this Pokémon's attack (a Command) deals damage, apply Burn X to the target, if it is still in play. Works on Trainers too. Only its own attack: hitting back in a trade doesn't Scorch, and Scorch never burns the Trainer that Overrun damage reaches. An attack that deals no damage (Attack 0) doesn't Scorch.
- **Overrun:** when this Pokémon's attack defeats an enemy Pokémon, the damage left over is dealt to the Trainer in that Zone on the defender's side. Leftover = damage actually dealt (after the defender's Shell) − the defender's remaining Strength. Example: Attack 6 into Shell 1 with 3 Strength left → 5 dealt → 2 to the Trainer. Lost if that Trainer has been removed. Only its own attack (not hitting back in a trade); it still happens if the attacker is also defeated in the trade. Overrun damage counts as damage from this Pokémon (it triggers On Trainer Strike).
- **Regenerate X:** at each Breakfast, with the On Breakfast abilities (after the Breakfast Weather), this Pokémon heals X, before its own On Breakfast ability. At full Strength nothing happens.
- **Shell X:** every instance of damage this Pokémon takes is reduced by X, to a minimum of 1: attacks, effects, Weather and Burn. No damage stays no damage (Attack 0 deals 0).
- **Having one twice:** numbered keywords add up (Scorch 1 + Scorch 1 = Scorch 2; Shell and Regenerate the same). Keywords without a number (Overrun, Quick Attack, Agility, Infiltrator) don't stack: having one twice is the same as having it once. Effects can grant keywords, permanently or "this Round".

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

- A "chosen Zone" can be any Zone where you have at least one Pokémon (a fallen zone is fine). Effects on "your Pokémon in a chosen Zone" affect the Pokémon there as it resolves, not ones summoned there later.
- The Supporters are listed with their decks (section 9).

### 1.5 Location Cards

| Field | Values |
|---|---|
| Name | |
| Card-Type | Location |
| Weather Tokens | one or more types with counts, e.g. "2 Rain" or "1 Rain, 1 Sun" |
| Quest | what you must do to complete it |
| XP Reward | XP gained when the quest is completed |
| Effect Text | what happens when the quest is completed |
| Rarity-Tier | as for Pokémon |
| Image | card art |

- Each zone on each player's side has **one Location space** (up to 3 Locations per player).
- **Play a Location Card** is a Battle Phase Action (it uses your 1 Action) but costs no Energy. Play it into the Location space of one of your zones, but not a fallen zone.
- If that space already has a Location, you may **replace** it: the old one goes to your Discard Pile and its quest progress is lost.
- If a zone falls after a Location is placed there, the Location stays and its quest keeps counting.
- **Quests:** playing a Location starts its quest. Progress counts only your own actions from that moment, carries over between Rounds, and is tracked separately for each Location (two Locations with the same quest both count the same event). A quest can be tied to the Location's zone or not.
- **Completing a quest:** you gain its XP Reward, its Effect resolves immediately, then the Location goes to your Released Pile.

**Quest types** (Quests are data: `quest.on` in `src/engine/cardData.js`):

| Quest | Counts |
|---|---|
| Summon N (matching) Pokémon (into this Zone) | Each of your Pokémon summoned (into this Zone): played, or summoned for free by any effect. |
| Attack N times with Pokémon in this Zone | Each attack (Command) by one of your Pokémon there. |
| Use N Trainer Powers | Each Trainer Power you use. |
| Apply Burn N times | Each card you apply Burn to counts once, whatever the Burn number, including Scorch. An area Burn counts once per card burned, so one Heat Wave can complete it (an intended combo). Burn the opponent applies doesn't count. |
| Heal N Strength in total | The Strength your own cards and effects actually heal on your own cards (Pokémon and Trainers), Regenerate included. Not Weather, not healing the opponent's cards; healing at full Strength adds nothing. |
| Damage enemy Trainers N times with Pokémon in this Zone | Each time one of your Pokémon in this Zone damages an enemy Trainer: its attack, its Overrun, or its own ability. Burn damage at Supper doesn't count (it has no source Pokémon). |
| Defeat N enemy Pokémon | Each enemy Pokémon defeated by your cards or effects, on anyone's turn: your attacks, your Pokémon hitting back in a trade, your effects, and Burn you applied. Not Weather. |
| Have N friendly Pokémon in this Zone at Supper | Checked at each Supper, right after On Supper (so Pokémon that Burn defeated that Supper don't count); it completes when the count is N or more then. Its progress shows how many are there now. |

- A Location's completion effect on "Pokémon in this Zone" is a one-off: it affects the Pokémon there when it completes, permanently, not ones summoned later.
- The Locations are listed with their decks (section 9).

### 1.6 Weather Tokens

- The game keeps a **combined count per Weather type** across both players' Locations and any Pokémon in the arena that carry a Weather Token. Tokens stop counting the moment their card leaves play (a card in hand doesn't count).

#### Weather effects

- Each Weather type has **milestone brackets at 2, 4, 6 and 8** combined tokens (both players' cards count). A bracket is active while the count is at or above it.
- Multiple Weather types can be active at once, each with its own count. Weather affects the whole arena, both sides.
- A bracket marked **"instead"** replaces the earlier bracket's effect; **"also"** adds to it.
- **Stat effects are continuous**, like Trainer Passives: recalculated whenever the count changes. When a stat effect switches off, the rule for losing a Passive applies (current Strength only drops if it's above the new maximum; Weather changing never defeats a Pokémon). Weather modifiers add up with each other and with other buffs. **Attack can't go below 0.**
- **Timed effects** (at Breakfast / at Supper) resolve before Pokémon abilities that trigger at the same moment: at Breakfast after cards are drawn and Energy is gained (before On Breakfast and the XP step), at Supper before On Supper and before hands are discarded. Pokémon defeated by Weather go to the Released Pile and trigger On Defeated as normal. Weather damage is effect damage (it never triggers On Defend), and Weather only affects Pokémon in the arena (not Trainers, not cards in hand).

> **Changing (approved by Elliott, 27 Oct):** this Type-based table is being replaced by the mechanics-based Weather in `docs/decks.md` section 2.12, together with Growth, Evolution, Sleep, Leech Seed and the Grass deck (`docs/decks.md` 2.7–2.11 and 5). Until that build lands, the game still uses the table below. The build that lands it rewrites this section and adds the new rules here.

| Bracket | ☔ Rain | ☀ Sun |
|---|---|---|
| **2** | Water Pokémon gain +1 Attack. | Fire Pokémon gain +1 Attack. |
| **4** | Water Pokémon gain +1/+1 *instead*. | Fire Pokémon gain +2 Attack *instead*. |
| **6** | *Also*, Fire Pokémon have −1 Attack. | *Also*, Water Pokémon have −1 Attack. |
| **8** | *Also*, at Supper, each Water Pokémon heals 2 Strength. | *Also*, at Breakfast, each non-Fire Pokémon takes 1 damage. |

Weather types are data (`WEATHER` in `src/engine/cardData.js`), so real Weather types can be added there.

### 1.7 Items, the Bag and the PokéMart

| Field | Values |
|---|---|
| Name | |
| Card-Type | Item |
| Item-Type | Held or Consumed |
| PokéDollar Cost | number |
| Effect Text | what it does |
| Rarity-Tier | as for Pokémon |
| Image | card art |

- **Buying:** an Item in your hand can't be used until it's purchased with PokéDollars. Unpurchased Items are discarded at Supper like any other card (to your Discard Pile).
- **Open Bag** (Battle Phase Action) does exactly one of:
  1. **Buy from hand:** pay an Item's cost from your hand, then either use it now or store it in your Bag.
  2. **Buy from the PokéMart:** pay an Item's cost from the PokéMart stock. It goes into your Bag marked **In Delivery** and can't be used until the next Round's Breakfast.
  3. **Use an Item from your Bag** (not one In Delivery).
- **The Bag** has 6 spaces; Items In Delivery count. If it's full you can't store an Item or buy from the PokéMart, but you can still buy from your hand and use it straight away. Bag contents carry over between Rounds and are never discarded at Supper.
- **The PokéMart** is shared. Its deck starts with one copy of every Item in the game. 3 Items are on sale at a time. At each Breakfast (including Round 1), unsold stock is shuffled back into the PokéMart deck and 3 new Items are revealed (fewer if the deck runs short). A slot that's bought stays empty until the next Breakfast.
- Used Consumed Items and lost Held Items (from either player) are shuffled into the PokéMart deck. They never return to a player's deck.
- **Held Items:** using one attaches it to a friendly Pokémon, in the arena or in your hand. One Held Item per Pokémon: attaching a new one sends the old one to the PokéMart (if the old one gave Strength, the rule for losing a Passive applies). The Held Item stays with that Pokémon card wherever it goes: hand, Discard Pile, reshuffled into the Draw Pile, and back into your hand in a later Round. Its effect applies while the Pokémon is in the arena. It is only lost when its Pokémon is Released (defeated, or used as a Released Supporter payment), and then goes to the PokéMart. (XP buffs are different: they're lost if the Pokémon is discarded before being played.)
- **Consumed Items:** the effect resolves immediately, then the Item goes to the PokéMart.
- An Item with no legal target can't be used, but it can still be bought and stored.

- **A Held Item that lowers Strength** (Choice Band: −2) lowers both current and maximum Strength, but never below 1, so it never defeats its holder. Example: a Pokémon at 1 of 3 Strength stays at 1 of 1.
- **A Held Item with a Type bonus** (Charcoal, Mystic Water) gives its extra part only to a holder of that Pokémon Type. Keywords from a Held Item add to the holder's own (Charcoal's Scorch 1 on a Scorch 2 Pokémon makes Scorch 3).
- The PokéMart holds one copy of each of the 7 Items (Charcoal, X Attack, Quick Claw, Choice Band, Mystic Water, Leftovers, Full Heal). The Items are listed with their decks (section 9).

### 1.8 Status Effects

A Status Effect is a counter on a Pokémon or a Trainer, shown as a numbered token on the card. Statuses are data (`STATUSES` in `src/engine/status.js`), so new ones (Poison, Paralysis, Sleep…) can be added there. Only Burn exists for now.

**Burn** (a flame token)
- "Burn X" adds X Burn counters to the target. Pokémon **and Trainers** can be burned. Burn stacks: applying more adds to the counters.
- **At Supper**, every burned card takes damage equal to its Burn, then loses 1 Burn (Burn 3 deals 3, then 2, then 1 over three Suppers). All burned cards, on both sides, take their Burn damage **at the same moment**.
- Burn damage is **effect damage**: it doesn't trigger On Defend. Shell reduces it (to a minimum of 1). It can defeat Pokémon (Released Pile, PokéDollars as normal, On Defeated fires) and reduce Trainers to 0 (removed as normal); Trainer Strength stops at 0.
- Burn damage has **no source Pokémon**: it never triggers On Knockout or On Trainer Strike, even if a Scorch Pokémon applied it. But Burn remembers **which player applied it**, so its damage and defeats count for that player's quests (e.g. a Pokémon defeated by Burn I applied counts towards my "Defeat N enemy Pokémon").
- Healing doesn't remove Burn. A card that leaves play keeps no Burn, and a removed Trainer's Burn is cleared.
- **Douse:** an effect that removes all Burn from a card.
- If Burn takes **both** players' last Trainers to 0 at the same Supper, the match is a **draw**.

### 1.9 Card keywords and effect types

- **Retain:** at Supper, a card with Retain stays in your hand instead of being discarded. Retain can be printed on a card or granted ("gains Retain"); a granted Retain lasts until the card leaves your hand (it keeps working at every Supper until then). A Pokémon kept by Retain keeps its XP buffs. Retain cards are marked with a red bookmark.
- **No hand size limit:** Breakfast still draws 7 on top of any cards you kept.
- **Search:** choose matching card(s) from your Draw Pile and put them in your hand, then shuffle your Draw Pile. Only the Draw Pile is searched (an empty one isn't refilled from the Discard Pile). If none match, nothing happens and the pile isn't shuffled. The card found is shown to the opponent. "Search for two" takes as many as match, up to two. A card that Searches can always be played (the Draw Pile is hidden).
- **Return:** choose matching card(s) from your Discard Pile and put them in your hand. Never from the Released Pile. A card that Returns can't be played if your Discard Pile has nothing matching (it's public), unless it says "up to", which may take fewer, even none.
- **Free summon:** you may play a matching Pokémon from your hand into an empty Pokémon Space without paying its cost (you can decline). Otherwise it's a normal summon: it arrives Spent (unless it has Quick Attack or the effect says "it arrives Active"), and it triggers On Summon, Rally, Passives that react to a summon, and quests. "Costing 2 or less" means the printed Energy Cost.
- **Cost reduction:** reduces the Energy Cost of a Pokémon, to a minimum of 0. Reductions stack. They only change what you pay: the printed Energy Cost still decides PokéDollars for defeating it, Gift Challenges and "costing N or less". A reduction can depend on the Zone (Wallace: the first Pokémon you summon into his Zone each Round costs 1 less), so a Pokémon's cost is worked out for the Zone it goes into, and whether you can afford it is too. Any summon into that Zone uses up "the first each Round", a free one included. A reduction on a card in hand lasts until it leaves your hand.
- **Becomes Active:** a Spent Pokémon becomes Active (Kabu's Power, Chili's Gift, Sneasel). Alert is worked out again.

## 2. The Battle Arena

- Each player has a horizontal row of **9 Pokémon Spaces**.
- The row is split into **3 equal zones** of 3 Pokémon Spaces each.
- Behind the Pokémon Spaces, each zone has **1 Trainer Space** and **1 Location space** on each side.
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

0. **Gains +1 PokéDollar.**
1. **The PokéMart restocks**, and Items In Delivery arrive in their Bags (section 1.7).
2. **Recovers Exhaust** that is due this Round (see section 5).
3. **Spent Pokémon become Active** again.
4. **Base Energy** is set to the Round number, with a maximum of 10. Unspent Base Energy does not carry over.
5. **Exert maximum** goes up by 1 each Round, to a limit of 3 (Round 1 = 1, Round 2 = 2, Round 3 onward = 3). Unspent Exert carries over.
6. **Draws 7 cards**, one at a time. If the Draw Pile is empty when a card needs drawing, shuffle the Discard Pile to form a new Draw Pile, then keep drawing. If both piles are empty, drawing stops and the player keeps a smaller hand.
7. **Timed Weather** effects (section 1.6), then **On Breakfast** abilities and **Regenerate** (section 1.3) fire (section 8).
8. **XP step** (after the mulligan in Round 1): see 4.1.1.

**Mulligan (Round 1 only):** each player may put any number of cards from their hand into their Discard Pile, then draw the same number from their Draw Pile. Both players choose in secret and reveal together.

#### 4.1.1 Spending XP

- Each player may spend any amount of their XP. Each point gives one Pokémon card in hand **+1 Attack or +1 Strength**. No limit per card.
- Both players choose in secret and lock in, like the mulligan. (A player with no XP, or no Pokémon in hand, has nothing to choose and skips it.)
- XP buffs become permanent once the Pokémon is played; a Strength buff raises current and maximum Strength.
- If the Pokémon leaves your hand without being played (discarded at Supper, or used to pay a Supporter), the buff and the XP are lost.

### 4.2 Battle Phase

- Players alternate turns, starting with the player who has initiative.
- Each turn is exactly **1 Action**. The Actions so far:
  - **Pass:** gain **+1 Base Energy** for this Round (see Passing below).
  - **Play a Pokémon Card:** play a Pokémon from your hand into any empty Pokémon Space on your side of the arena (not in a fallen zone), paying its Energy Cost (section 5). You can't play it if you can't afford it. It arrives **Spent** and can't be Commanded this Round.
  - **Command an Alert Pokémon:** choose one of your Alert Pokémon and a legal target. A Command is always an Attack, and costs no Energy. See 4.2.1.
  - **Use a Trainer Power:** pay its cost (section 5); each Trainer's Power can be used once per Round, and not if it has no legal target. See 7.2.
  - **Play a Strategy Card:** on any of your turns, pay its Energy Cost (section 5). Its effect resolves immediately, then the card goes to your Discard Pile. A Strategy Card can't be played if it has no legal target (or, for an area card, nothing to affect). Cards drawn during Battle go into your hand and can be played this Round; they're discarded at Supper with the rest of your hand.
  - **Play a Supporter Card:** on any of your turns, once per Round, pay its Card-Cost in cards (section 1.4). Its effect, with any Gift Bonus, resolves immediately, then the card goes to your Discard Pile.
  - **Play a Location Card:** no Energy; into one of your Location spaces outside a fallen zone, replacing any Location there (section 1.5).
  - **Open Bag:** buy an Item from your hand (then use or store it), buy one from the PokéMart, or use one from your Bag (section 1.7).
- Passing doesn't lock a player out: if one player passes and the other takes an Action, the first player gets another turn.
- The Battle Phase ends when **both players Pass consecutively**.
- **Passing gains Base Energy:** every Pass gives the player who passed **+1 Base Energy** for this Round. It is ordinary Base Energy: spent before Exert, and lost at the end of the Round like all Base Energy. It **can go above the limit of 10**, like the On Breakfast ability. Repeated passes in one Battle Phase stack.
- **Except the Pass that ends the phase:** if a Pass is the second of two consecutive Passes, it ends the Battle Phase instead, and that player gains nothing.
  - Example: I pass (+1). The opponent plays a card. I pass again (+1 more, 2 in total). The opponent passes: the Battle Phase ends, and the opponent gains nothing for that pass.
  - Example: I pass (+1). The opponent passes: the phase ends, and the opponent gains nothing.
- **Passing with unmatched speed spends those Pokémon.** When a player Passes (and the Pass doesn't end the phase), look at the top Speed-Tier among all Active Pokémon in the arena, both sides. If the passing player has one or more Active Pokémon at that tier and the opponent has none, all of the passing player's Active Pokémon at that tier become **Spent**. Then Alert is worked out again as normal, so the next tier down may become Alert, on either side. The player still gains the +1 Base Energy from the Pass.
  - It doesn't apply if the opponent also has an Active Pokémon at the top tier, or to the Pass that ends the Battle Phase.
  - Why: otherwise a player whose Pokémon are the only Alert ones could pass again and again, while the opponent has nothing Alert to act with and may be pushed into passing and ending the phase.
  - Example: I have an Active Swift Ponyta and a Steady Magmar; the opponent's best Active is Steady. I pass: Ponyta becomes Spent, and now my Magmar and the opponent's Steady Pokémon are Alert.
  - Example: both of us have an Active Swift Pokémon. I pass: nothing is Spent.
  - Example: my only Active Pokémon are Swift, and the opponent has no Active Pokémon. I pass: my Swift Pokémon become Spent.

#### 4.2.1 Attacks

- **Targets:** any opponent Pokémon (Active or Spent) or any opponent Trainer, with these restrictions:
  - If the opponent has any Pokémon with **Defence** Strength-Type (Active or Spent), a **Physical** attacker must target one of those.
  - If the opponent has any Pokémon with **Special Defence** Strength-Type (Active or Spent), a **Special** attacker must target one of those.
  - An attacker with **Infiltrator** (section 1.3) ignores both restrictions above.
  - A Trainer at 0 Strength can't be targeted.
- **Damage:** the attacker deals its Attack Value (including buffs and Passive bonuses) to the target's current Strength, reduced by the target's Shell (section 1.3). Extra damage beyond what the target has left is lost, unless the attacker has Overrun.
- **Trading damage:** if the target is an **Alert** Pokémon, it deals its Attack Value back to the attacker at the same time, and both become Spent.
- If the target is a Spent or non-Alert Pokémon, or a Trainer, it takes the damage without hitting back. Only the attacker becomes Spent.
- **Defeat:** a Pokémon at 0 Strength or less is defeated and goes to its owner's Released Pile. Both Pokémon can be defeated in the same trade.
- Trainer Strength can't go below 0.
- **Order inside an attack:**
  1. Damage lands (both sides of a trade at once, each reduced by Shell).
  2. Defeated Pokémon fire On Defeated and go to the Released Pile.
  3. Overrun damage hits the Trainer.
  4. Scorch burns the target, if it's still in play.
  5. On Attack, On Defend, On Knockout and On Trainer Strike fire, in the usual order (section 8). Like On Attack, On Knockout and On Trainer Strike only fire if that Pokémon is still in the arena: a Pokémon defeated in the same trade that knocked out its opponent gets no On Knockout.

### 4.3 Supper Phase

In this order:
1. **Timed Weather** effects (section 1.6).
2. **Burn** (section 1.8): every burned card takes its Burn damage at once, then loses 1 Burn. Defeats and removals follow, with any On Defeated.
3. **On Supper** abilities fire (section 8), for Pokémon still in the arena.
4. **"Have N friendly Pokémon in this Zone at Supper"** quests are checked (section 1.5).
5. **"This Round" effects expire** (section 7.1).
6. Each player puts all cards left in their hand into their Discard Pile, except cards with **Retain** (section 1.9).

Then the next Round begins.

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
- **Draw:** if both players' last Trainers reach 0 at the same moment (Burn at Supper, section 1.8), the match ends in a draw.

## 7. Trainers and effects

### 7.1 Stat rules (all effects)

- "+A/+S" means +A Attack Value and +S Strength.
- "+X Hitpoints / +X Defence / +X Special Defence" means +X Strength, but only for a Pokémon with that Strength-Type. Others can't be chosen as targets, and area versions skip them.
- Buffs are permanent unless a card says otherwise. Buffed stats are shown in green.
- **"This Round"** effects (buffs, granted keywords) expire at Supper, after Burn and On Supper (section 4.3). Everything else is permanent unless stated. Losing a "this Round" Strength buff follows the rule for losing a Passive (section 7.2): maximum Strength drops, and current Strength only drops if it's above the new maximum, so it never defeats a Pokémon. "This Round" effects are also gone if their card leaves the arena.
- A Strength buff raises both current and maximum Strength.
- Healing can't go above maximum Strength (for Trainers: their starting Strength). Healing can target Trainers.
- **Heal targets:** an effect that only heals (Goldeen, Misty's Power) needs a damaged target. One that heals **and Douses** (Aqua Ring, Nurse Joy, Full Heal) can target any friendly card it allows, damaged or not (it may only Douse). An area heal heals whatever is damaged.
- Effect damage uses the same defeat rules as combat: Pokémon at 0 or less go to the Released Pile; Trainer Strength stops at 0.
- **Targeted** means the card makes the player choose a target. **Area** means it affects all matching cards without a choice.

### 7.2 Powers and Passives

- **Power (Battle Phase Action):** uses your 1 Action for the turn. Its cost is paid like any other (Base Energy first, Exert only for a shortfall). Each Trainer's Power can be used **once per Round**, and can't be used if it has no legal target.
- **Passive:** always applies, but only in that Trainer's Zone. Passive stat bonuses are recalculated continuously: a Pokémon summoned into the zone gains them, and they're lost if the Trainer is removed.
- **When a Passive is lost**, maximum Strength drops by the bonus; current Strength only drops if it's above the new maximum. Losing a Passive never defeats a Pokémon.
- **Summoning order:** a Pokémon arrives, gains its Passive bonuses, then "when summoned" effects apply.

### 7.3 Trainer removal

- A Trainer at 0 Strength is **removed**: its Passive and Power stop working, and it can't be targeted.
- Its zone **falls** on that player's side (section 2).

### 7.4 The Trainers

Each deck has its own three Trainers (section 9). How their wording works:

- **Blaine's Passive** ("Burn applied by friendly Pokémon in Blaine's Zone is increased by 1") adds +1 to each Burn a friendly Pokémon in his Zone applies: its Scorch (Charcoal's included) and its own ability (Charmander's On Summon). +1 per card burned. Not Burn from Strategy Cards, Supporters, Locations or Blaine's own Power, and not Pokémon in other Zones.
- **Wallace's Passive** lowers the cost of the first Pokémon you summon into his Zone each Round (section 1.9).
- "In X's Zone" means that Trainer's Zone, on the side the card says ("friendly" or "enemy").

## 8. Pokémon abilities

A Pokémon ability is an **Effect Trigger Word** plus **Effect Text**. It fires every time its condition is met.

| Trigger Word | Fires… |
|---|---|
| **On Summon** | when this Pokémon enters the arena, whether played or summoned by an effect (e.g. Swimmer). |
| **On Attack** | after this Pokémon's attack deals damage, if it's still in the arena. |
| **On Defend** | after this Pokémon is attacked (by a Command) and takes damage, if it's still in the arena. Effect damage never triggers it. |
| **On Defeated** | when this Pokémon is defeated by any cause, as it goes to the Released Pile. |
| **On Breakfast** | at each Breakfast while it's in the arena, after cards are drawn and Energy is gained. |
| **On Supper** | at each Supper while it's in the arena, after Burn, before "this Round" effects expire and hands are discarded. |
| **On Knockout** | when damage dealt by this Pokémon (its attack, its hit back in a trade, or its own ability) defeats an enemy Pokémon, if it's still in the arena. Once per Pokémon defeated. Burn and Overrun never cause it (Overrun only damages Trainers). |
| **On Trainer Strike** | when this Pokémon damages an enemy Trainer with its attack or its Overrun, if it's still in the arena. |
| **Rally** | when another friendly Pokémon is summoned into this Pokémon's Zone (same side). It happens at the same moment as the new Pokémon's On Summon, so the order rule below applies. |
| **On Heal** | when this Pokémon is healed by at least 1 (healing at full Strength isn't a heal). Regenerate counts. |

- **Choosing targets:** if an ability says to choose a target, its owner must pick one when it resolves (they can't decline). With no legal target, nothing happens.
- **Order:** when several abilities or Passives trigger at the same moment, the player with initiative resolves theirs first, then the other player. Within each player, in zone order 1 → 2 → 3, then left to right. (In the build, a Trainer's Passive comes after the Pokémon in its zone.)
- **Chains:** if an ability's result sets off another ability (e.g. its damage defeats a Pokémon with On Defeated), the new one resolves immediately, before anything still waiting.
- **In a trade:** (1) both Pokémon deal their damage at once; (2) defeated Pokémon fire On Defeated and go to the Released Pile; (3) survivors fire On Attack / On Defend, in the order above. The attacker's On Attack and the target's On Defend can both fire.
- **Winning** still happens immediately: a match that is won mid-resolution stops there.
- **Once per Round:** an ability that says so (Sneasel's On Knockout) fires at most once each Round; it can fire again the next Round.
- **Extra Base Energy** from an ability (or from passing, section 4.2) can go above the limit of 10; it still doesn't carry over to the next Round.

## 9. The decks

Two decks, as approved in `docs/decks.md` (the source of truth for them). The game will eventually have 6 archetypes × 3 specializations, each matched to a Pokémon Type.

### 9.1 Choosing a deck

- Before each match the player chooses **Fire**, **Water** or **Random** on the deck selection screen. The player plays the chosen deck and the AI plays the other one, each with that deck's three Trainers.
- **New match** goes back to deck selection. The screen marks the deck chosen last time (remembered in this browser only).
- `?autoplay` (the AI plays both sides) picks the decks at random.
- **Against a friend** (section 10), each player chooses their own deck freely, in secret; both may choose the same deck (a mirror match). Each player's choice is revealed when both have locked in. Random picks one of the decks for that player.

## 10. Playing a friend online

- A match can be played against a friend instead of the AI: one player **hosts** and sends an invite link; the friend opens it to **join**. Two players only, no spectators.
- The rules are exactly the same as against the AI, including the coin flip for initiative in Round 1 (section 3).
- **No turn timer:** a player may take as long as they like over any decision.
- Each player sees only what they're allowed to see: their own hand, both arenas, and public information (pile sizes, Bag contents, revealed cards). Never the opponent's hand or either Draw Pile's order.
- **No extras for now:** no emotes and no chat.
- **What each player sees, in detail** (as built in Multiplayer M1; `src/engine/view.js`):
  - The opponent's hand: how many cards, not which. A card they **Search** for goes into their hand unseen ("searched the Draw Pile for 1 card"); a card they **Return** from the Discard Pile is seen, since the Discard Pile is public.
  - Both Draw Piles: how many cards, not which or in what order. Your own Search shows you only the matching cards.
  - The PokéMart: the 3 Items on sale and how many are left in its deck, not their order.
  - Simultaneous steps (placing Trainers, the mulligan, spending XP): only that the opponent has locked in, until both have. Then the Trainers are revealed and the mulligan count shows; for **XP**, how much the opponent spent and on which stat (e.g. "+1 Attack, +2 Strength"), but not which Pokémon in their hand got it (settled by Elliott: it stays hidden, since naming it would reveal a card in hand; the buff shows once that Pokémon is summoned).
  - Card uids (how the game tells cards apart) don't say which card it is, and are renumbered whenever a Discard Pile is shuffled into a new Draw Pile, so a card can't be followed into a hidden hand.
- **As built (Multiplayer M2):** the start screen offers Play the AI, Play a friend, and Two players, one screen. The host gets a 5-letter room code and an invite link (`?join=CODE`). Once connected, both choose decks in secret (the other sees only that you have chosen); both are revealed when both have locked in, then Trainers, the coin flip and the match follow as usual. The host's browser runs the match and checks every action; the friend's browser is only ever sent what that player may see. Both players need the same version of the game. (Multiplayer M3) A dropped connection or a refresh doesn't end the match: it waits, with no time limit, for the player to come back (the friend by reopening the same link; the host with "Resume your match with your friend", which keeps the same room code). Leave match ends it for both. After a match, a Rematch needs both players to accept; then both choose decks again and a new coin flip decides initiative.
- **Two players, one screen (hot-seat):** for testing and local play, two players can share one screen (the "Two players, one screen" button, or `?hotseat`). Each chooses a deck in turn, in secret. Whenever control passes to the other player (including either half of a simultaneous step), a "Pass to Player 2" screen hides the board until they click "I'm ready"; the board is then drawn from their side, and the last action is shown again from there.

### 9.2 🔥 Fire — Aggressive · Burn

**Plan:** fast pressure from Round 1; Burn keeps damaging Trainers every Supper; Overrun pushes damage onto Trainers. **Trade-off:** fragile Pokémon and lower Trainer Strength (43 in all); it fades in long matches.

| Pokémon | × | Cost | Type | Attack | Strength | Speed | Rarity | Abilities |
|---|---|---|---|---|---|---|---|---|
| Growlithe | 3 | 1 | Fire | 2 Physical | 5 Hitpoints | Swift | Common | Scorch 1 |
| Charmander | 2 | 1 | Fire | 3 Special | 6 Hitpoints | Steady | Common | On Summon: Burn 1 to an enemy Pokémon or Trainer in this Pokémon's Zone. |
| Ponyta | 3 | 2 | Fire | 3 Physical | 5 Hitpoints | Swift | Common | Quick Attack, Infiltrator |
| Mankey | 2 | 2 | Fighting | 4 Physical | 5 Hitpoints | Swift | Common | Overrun, Infiltrator |
| Magmar | 2 | 3 | Fire | 4 Special | 7 Hitpoints | Steady | Common | Scorch 2 |
| Sneasel | 2 | 3 | Dark | 4 Physical | 4 Hitpoints | Swift | Common | Infiltrator. On Knockout: this Pokémon becomes Active (once per Round). |
| Arcanine | 2 | 4 | Fire | 5 Physical | 6 Hitpoints | Swift | Rare | Overrun, Scorch 1, Infiltrator |
| Houndoom | 1 | 5 | Fire | 5 Special | 7 Hitpoints | Swift | Epic | On Summon: Burn 2 to each enemy Trainer. |
| Blaziken | 1 | 5 | Fire | 7 Physical | 8 Hitpoints | Steady | Legendary | Overrun, Scorch 2 |

| Strategy | × | Cost | Rarity | Effect |
|---|---|---|---|---|
| Ember | 3 | 1 | Common | Burn 2 to an enemy Pokémon or Trainer. (Targeted) |
| Flame Charge | 2 | 2 | Common | A friendly Pokémon gains +2 Attack this Round. If it's a Fire Pokémon, it also gains Scorch 1 this Round. (Targeted) |
| Heat Wave | 2 | 4 | Rare | Burn 1 to every enemy Pokémon and every enemy Trainer. (Area) |
| Fire Blast | 1 | 5 | Epic | Deal 4 damage to an enemy Pokémon or Trainer, then Burn 2 to it if it's still in play. (Targeted) |

| Supporter | × | Rarity | Card-Cost | Effect | Gift Challenge | Gift Bonus |
|---|---|---|---|---|---|---|
| Firebreather | 2 | Common | Discard 1 | Burn 1 to each enemy Trainer. | a Fire Pokémon | Burn 2 to each enemy Trainer instead. |
| Chili | 1 | Rare | Release 1 | Your Pokémon in a chosen Zone gain +2 Attack and Overrun this Round. | a Swift Pokémon | They also become Active. |
| Burglar | 1 | Rare | Discard 2 | Gain 3 PokéDollars. | an Item card | Gain 5 PokéDollars instead. |

| Location | × | Rarity | Weather | Quest | XP | Effect on completion |
|---|---|---|---|---|---|---|
| Mt. Ember | 2 | Common | 2 Sun | Apply Burn 4 times. | 2 | Burn 2 to each enemy Trainer. |
| Cinnabar Volcano | 1 | Rare | 2 Sun | Damage enemy Trainers 3 times with Pokémon in this Zone. | 3 | Friendly Fire Pokémon in this Zone gain +1/+1. |
| Stark Mountain | 1 | Rare | 3 Sun | Defeat 2 enemy Pokémon. | 2 | Deal 2 damage to each enemy Pokémon in this Zone. |

| Item | × | Rarity | Item-Type | PokéDollars | Effect |
|---|---|---|---|---|---|
| Charcoal | 2 | Common | Held | 2 | Holder gains +1 Attack. If it's a Fire Pokémon, it also gains Scorch 1. |
| X Attack | 2 | Common | Consumed | 2 | A friendly Pokémon in the arena gains +2 Attack this Round. Retain. |
| Quick Claw | 1 | Rare | Held | 3 | Holder's Speed-Tier is one higher (Slow → Steady → Swift). |
| Choice Band | 1 | Rare | Held | 4 | Holder gains +3 Attack and −2 Strength (can't reduce Strength below 1). |

| Trainer | Strength | Power | Passive |
|---|---|---|---|
| Blaine | 14 | (1) Burn 1 to an enemy Pokémon or Trainer. | Burn applied by friendly Pokémon in Blaine's Zone is increased by 1. |
| Flannery | 13 | (1) A friendly Pokémon in Flannery's Zone gains +2 Attack this Round. | Friendly Fire Pokémon in Flannery's Zone gain Overrun. |
| Kabu | 16 | (2) A friendly Spent Pokémon in Kabu's Zone becomes Active. | Friendly Pokémon in Kabu's Zone gain +2 Strength. |

### 9.3 💧 Water — Board-Based · Value-Midrange

**Plan:** sturdy Pokémon that heal, return from the Discard Pile and grow stronger together in a Zone; it wins longer matches. **Trade-off:** slow starts and low burst damage. Trainer Strength 48 in all.

| Pokémon | × | Cost | Type | Attack | Strength | Speed | Rarity | Abilities / Weather |
|---|---|---|---|---|---|---|---|---|
| Horsea | 2 | 1 | Water | 3 Special | 4 Hitpoints | Steady | Common | Rally: this Pokémon gains +1/+1. |
| Goldeen | 2 | 2 | Water | 4 Physical | 5 Hitpoints | Steady | Common | On Summon: heal a friendly Pokémon 2. |
| Chinchou | 2 | 2 | Electric | 3 Special | 5 Special Defence | Steady | Common | Regenerate 1 |
| Quagsire | 3 | 3 | Water | 4 Physical | 7 Defence | Slow | Common | Regenerate 2 |
| Wartortle | 2 | 3 | Water | 4 Special | 5 Defence | Steady | Common | Shell 1 |
| Lapras | 2 | 4 | Water | 5 Special | 7 Hitpoints | Steady | Rare | On Summon: heal all friendly Pokémon in this Pokémon's Zone 2. |
| Pelipper | 1 | 4 | Water | 5 Special | 5 Hitpoints | Swift | Rare | Weather Tokens: 2 Rain. On Summon: a card in your hand gains Retain. |
| Chansey | 1 | 4 | Normal | 1 Physical | 12 Hitpoints | Slow | Rare | On Breakfast: heal each friendly Pokémon in this Pokémon's Zone 2. |
| Gyarados | 1 | 5 | Water | 7 Physical | 6 Hitpoints | Steady | Epic | On Summon: deal 2 damage to each enemy Pokémon in this Pokémon's Zone. |
| Vaporeon | 1 | 5 | Water | 5 Special | 7 Special Defence | Steady | Epic | Regenerate 2. On Heal: this Pokémon gains +1 Attack. |
| Kyogre | 1 | 6 | Water | 7 Special | 11 Hitpoints | Slow | Legendary | Weather Tokens: 2 Rain. On Summon: heal every friendly Pokémon and Trainer 2. |

| Strategy | × | Cost | Rarity | Effect |
|---|---|---|---|---|
| Aqua Ring | 3 | 2 | Common | Heal a friendly Pokémon 3 and Douse it. Retain. (Targeted) |
| Bubble Beam | 2 | 3 | Common | Deal 2 damage to an enemy Pokémon, or 3 if Rain is 2 or more. (Targeted) |
| Dive | 2 | 2 | Common | Return a Pokémon from your Discard Pile to your hand. It gains Retain. |
| Surf | 1 | 5 | Rare | Deal 2 damage to each enemy Pokémon, and heal each friendly Pokémon 1. (Area) |

| Supporter | × | Rarity | Card-Cost | Effect | Gift Challenge | Gift Bonus |
|---|---|---|---|---|---|---|
| Nurse Joy | 2 | Common | Discard 1 | Heal a friendly Trainer 3 and Douse it. | a Normal Pokémon | Heal 5 instead. |
| Swimmer | 1 | Rare | Discard 2 | Free summon a Pokémon costing 2 or less from your hand. | a Water Pokémon | It arrives Active. |
| Fisherman | 1 | Rare | Release 1 | Search your Draw Pile for a Water Pokémon; it gains Retain. | a Strategy card | Search for two instead. |

| Location | × | Rarity | Weather | Quest | XP | Effect on completion |
|---|---|---|---|---|---|---|
| Cerulean Cape | 2 | Common | 2 Rain | Summon 3 Pokémon into this Zone. | 2 | Friendly Pokémon in this Zone gain +1/+1. |
| Lake of Rage | 1 | Rare | 2 Rain | Heal 10 Strength in total. | 3 | Return up to 2 Pokémon from your Discard Pile to your hand. |
| Route 119 | 1 | Rare | 3 Rain | Have 3 friendly Pokémon in this Zone at Supper. | 2 | Heal all friendly Trainers 3. |

| Item | × | Rarity | Item-Type | PokéDollars | Effect |
|---|---|---|---|---|---|
| Mystic Water | 2 | Common | Held | 2 | Holder gains +1 Attack. If it's a Water Pokémon, it also gains +1 Strength. |
| Leftovers | 2 | Common | Held | 3 | Holder gains Regenerate 1. |
| Full Heal | 2 | Common | Consumed | 1 | Douse a friendly Pokémon or Trainer and heal it 2. Retain. |

| Trainer | Strength | Power | Passive |
|---|---|---|---|
| Misty | 16 | (1) Heal a friendly Pokémon in Misty's Zone 3. | Friendly Water Pokémon in Misty's Zone gain +2 Strength. |
| Crasher Wake | 17 | (2) Deal 2 damage to an enemy Pokémon in Wake's Zone. | Friendly Pokémon in Wake's Zone gain Shell 1. |
| Wallace | 15 | (1) Return a Pokémon from your Discard Pile to your hand. | The first Pokémon you summon into Wallace's Zone each Round costs 1 less. |

## Open questions

- **Fire vs Water balance (settled after Step 18):** the Step 18 decks had Water winning 93%. Four rounds of AI-vs-AI tests (`node tools/balance.js --variant …`) found the cause: Water fields eight guards (Defence/Special Defence) and Fire none, so about 80% of the time an attacking Fire Pokémon had no legal Trainer target and Fire's attacks dealt only ~8 Trainer damage a match. Elliott chose: Fire Pokémon +1 Strength (+2 for those costing 2 or less), and the new Innate Power Infiltrator on Ponyta, Mankey, Sneasel and Arcanine (Fire won 46% in 200 test matches, ±3.5). Water is unchanged.
- **Match length:** Fire vs Water lasts about 6 Rounds, Fire mirrors about 5, Water mirrors about 9. Is that the right length? It depends on how many minutes a Round takes in real play (the target is a 30–40 minute match).
- **Zone guards (idea, not adopted):** guards would only protect their own Zone. Tested as variant Z; it adds depth but would need its own rebalance (with Infiltrator, Fire won 63%).
- **The Breakfast PokéDollar (judged in Step 18):** with the real decks it makes almost no difference: without it Water wins 93.5% instead of 93.0%, matches last the same 6.8 Rounds, and nothing stalls either way. It stays.
- **Stalled matches:** none of the 200 Fire vs Water matches stall, but nothing in the rules ends a match where healing keeps up with the only damage left. Should there be a Round limit or a "no progress" draw? (For now the AI-vs-AI test stops matches at Round 100 and reports them as stalled.)
- **Quest timing:** when a quest completes during an Action that also sets off abilities (e.g. a summon that also triggers Rally), the build resolves the quest's effect first. Is that right?
- Can a Command be anything other than an Attack?
- **Timed Weather order:** if two Weather types have timed effects at the same moment, the build resolves them in Weather order (Rain, then Sun). Is that right?
- **Trainer vs Pokémon order:** when a Trainer's Passive and a Pokémon in the same zone trigger at the same moment, which goes first? (The build puts the Trainer after the Pokémon in its zone.)
- **On Supper:** no card uses it yet; the hook is built and tested.

## Placeholders in the current build

- **Card art** comes from `assets/cards/<card id>.jpg` (e.g. `crasher-wake.jpg`). A card without a file shows the placeholder look: a box tinted by Pokémon Type or striped by Card-Type. Art for the retired placeholder cards stays in `assets/` but is no longer used.
- Rain and Sun (section 1.6) are placeholder Weather types.
- **Hot-seat names:** the two players are "Player 1" and "Player 2" until players can choose their own names.
- Agility and the Trigger Words On Attack, On Defend, On Defeated, On Supper and On Trainer Strike are built and tested (with test-only cards in `tests/`), but no Fire or Water card uses them yet. So are the quest types "Attack N times" and "Use N Trainer Powers".
- **The AI** places Trainers at random and only spends Base Energy (never Exert). On a Battle turn it scores every legal move and Pass, and picks the best (ties at random). It scores most moves by trying them on a copy of the game: winning, bringing an enemy Trainer to 0, defeating enemy Pokémon without losing its own, damage to enemy Trainers (Overrun and effects included), damage and healing, stats and keywords gained, Pokémon made Active, Burn (as the damage it will still deal over the coming Suppers, three times as much on a Trainer, and removing Burn from its own cards counts the same way), cards gained, PokéDollars and XP, less the Energy or cards it costs. Draws and Searches are scored without trying them, so it never sees its own Draw Pile. **Each deck's plan** weighs these differently: as **Fire** it values damage to Trainers, Burn and Overrun more; as **Water** it values healing, Dousing its own Burn, growing its board, keeping its Pokémon alive and summoning into Zones where it already has Pokémon. A Pass that gains +1 Base Energy scores what that Energy could buy, weighed by the chance the opponent passes straight back. Supporters: it puts a card that meets the Gift Challenge into the payment when it has one. Locations: only into empty Location spaces. XP: all of it on the cheapest Pokémon in hand it can afford this Round, split at random between Attack and Strength. Open Bag: an Item bought from hand is used straight away if it has a legal target (a Held Item preferring a Pokémon without one), otherwise stored; it sometimes buys from the PokéMart. Choices: it tries each target and takes the best; a Search, Return or free summon takes the strongest card it could afford next Round; Retain goes on a card it can't afford now but can next Round.
