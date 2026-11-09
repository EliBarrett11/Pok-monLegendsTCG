# v4 foundation: assumptions

Decisions made where `docs/v4-foundation-spec.md` (and its section 16) doesn't give an exact rule. Each is the simplest working choice. ✱ = may need Elliott's approval.

## F1: the core

1. **Pokémon Levels off the battlefield.**
   - The series' first Level in Round 1, +1 each Round, up to the maximum (Light 1–6, Mid 2–7, Heavy 3–8).
   - The rule applies to every card off the battlefield (hand, Draw Pile and Discard Pile), so a Discard Pile reshuffled into the Draw Pile is already at the current Level.
   - *Why:* the spec says "Hand and Deck", and the Discard Pile becomes the deck again (v1).
2. **Cost by Level ✱:** one curve for every series, `cost = ceil((Level − 1) / 2)`. So Level 1 costs 0, Levels 2–3 cost 1, 4–5 cost 2, 6–7 cost 3, and 8 costs 4.
   - A Mid Pokémon reaches Level L in Round L−1, when Base Energy is L−1, so it costs about half the Round's Base Energy (the spec's target).
   - Light is cheaper and Heavy dearer in any given Round, because of their Levels.
   - *Why:* one formula, in `v4/src/rules.js`.
3. **Stats and abilities ✱:** six evolution paths, written as simple stats per Level from existing Pokémon and art:
   - Ponyta → Rapidash, Chinchou → Lanturn (Light);
   - Squirtle → Wartortle → Blastoise, Growlithe → Arcanine (Mid);
   - Magikarp → Gyarados, Charmander → Charmeleon → Charizard (Heavy).
   - Two abilities only: Magikarp's "On Summon: draw 1" and Charizard's "On Summon: 2 damage to each enemy Pokémon".
4. **Demo deck so far:** 20 Pokémon cards (Pokémon only, as F1 asks), the same list for both players. Later steps add the other card types.
5. **Mulligan (v1):** in Round 1, after drawing 7, each player chooses any cards to put into their Discard Pile and draws as many. The player chooses, then the AI.
6. **Retain ✱:**
   - It's a Battle Phase action like the others (it uses the turn) and costs 1 Energy, paid like any cost: Base Energy first, then Exert.
   - There's no limit beyond Energy and turns.
   - A Retained card stays through one Supper.
   - Each Retained card draws one fewer at the next Breakfast (never below 0).
7. **Breakfast order:**
   1. Exhaust recovers.
   2. Base Energy and the Exert maximum are set (v1: the Round, max 10; Exert maximum the Round, max 3).
   3. Spent Pokémon become Active.
   4. Cards off the battlefield take their new Level.
   5. Draw 7, less one per Retained card.
8. **Guards and the Player Character ✱:**
   - A guard protects its Player Character only against attacks of its kind: Defence against Physical attackers, Special Defence against Special.
   - It does so only when the attacker stands in the guard's own Location. In F1, with no placed Locations, that means anywhere.
   - *Why:* it matches "Special Defence does the same against Special attacks".
9. **Recognition values ✱:**
   - 1 per damage to the enemy Player Character (section 16);
   - +2 for defeating an enemy Pokémon, a starting value (both are in `v4/src/rules.js`).
   - 100 wins at once.
10. **Trades:** as in v3. A Ready target hits back; both become Spent; a Pokémon at 0 Strength or less goes to its owner's Released Pile.

## F2: Locations

1. **Placing ✱:**
   - Place Location is a Battle Phase action like the others: it uses the turn and costs no Energy (as in v2).
   - It covers the chosen lane and the lanes to its right. It can't overlap another placed Location or run off the battlefield.
   - Either player may place one. There's no limit beyond the free lanes, so at most 4 can be placed at once.
   - A Location card can be Retained like any card. It has no Level.
2. **Duration and removal ✱:**
   - Rounds left count down at each Supper, after dominance is scored.
   - A Location placed with 3 Rounds is scored at 3 Suppers and then removed. Placing it late in a Round still counts that Round.
   - When removed, its card goes to its owner's Discard Pile, and its lanes are the Default Location again. Pokémon there stay where they are and lose its passive.
3. **The four Locations ✱:** placeholder values, using the v1/v2 art:

   | Location | Lanes | Rounds | Weather | Passive (on both players' Pokémon in it) |
   |---|---|---|---|---|
   | Cerulean Cape | 2 | 3 | 1 Rain | +1 Strength |
   | Mt. Ember | 3 | 3 | 2 Sun | +1 Attack |
   | Lake of Rage | 2 | 2 | 1 Sun | Heal 2 at Breakfast |
   | Route 119 | 4 | 2 | 2 Rain | Summoning here costs 1 less (minimum 0) |

4. **Passives apply to both players' Pokémon in the Location ✱:**
   - +Strength raises both the maximum and the current Strength.
   - When the bonus ends, the maximum drops back and current Strength is capped at it. Losing a bonus never defeats a Pokémon: at least 1 Strength is left.
   - A Pokémon that is already there when the Location is placed gets the passive at once.
5. **Weather brackets ✱:** placeholder values. Counts combine across all placed Locations. Each bracket applies to every Pokémon of both players while the count is at or above it:
   - **Rain 2:** every Pokémon heals 1 at Breakfast.
   - **Rain 4:** every Pokémon has +1 Strength.
   - **Sun 2:** Physical attacks deal +1 damage (including a trade's hit back).
   - **Sun 4:** every Pokémon has +1 Attack.
6. **Breakfast heals:** they happen after Pokémon become Active, and never above a Pokémon's Strength.
7. **Dominance ✱:**
   - At Supper, each placed Location is scored. The player whose Pokémon there have the greater total current Strength earns +1 Recognition, a starting value (`perDominance` in `v4/src/rules.js`).
   - A tie, including an empty Location, gives nothing.
   - Who placed the Location doesn't matter. The Default Location is never scored.
8. **The demo deck:** the 20 Pokémon plus one of each Location, 24 cards, the same list for both players.

## F3: Command Cards and Supporters

1. **Eligible actions and the React window ✱:**
   - Three actions can be reacted to: an attack, a summon, and a Command Card played as Adapt. Pass, Retain, Place Location, Supporters, Strats and Reacts can't.
   - The acting player commits the action first, and its cost is paid then:
     - **Summon:** the Energy is paid and the card leaves the hand.
     - **Adapt:** the Energy is paid and the card leaves the hand.
     - **Attack:** it has no cost to pay.
   - A React window then opens for the other player only if they hold a Command Card whose React they can pay for and that has a target. Otherwise the action resolves at once.
   - In the window, that player either Reacts with one card or lets it happen. Then the committed action resolves, and the acting player's turn ends.
2. **React timing ✱:**
   - The React's weaker effect resolves fully before the committed action, which then resolves against the new state.
   - **The committed action fizzles** (cost still paid) if:
     - the attacker is gone;
     - the attacked Pokémon is gone, or is now guarded;
     - the Adapt's target is gone.
   - A fizzled attack still makes the attacker Spent. A fizzled Adapt card goes to the Discard Pile.
   - A summon can't fizzle: the React can't fill its space. The summoned Pokémon arrives after the React, Spent as usual.
   - A React doesn't use the reacting player's turn, and nothing can be reacted to in turn. There's no stack: at most one React per committed action.
   - React Energy comes from the same pool as everything else (Base Energy, then Exert).
3. **Strat timing ✱:**
   - Paid and targeted when played; this is the turn's action. It is not eligible for React.
   - It resolves at the start of its owner's next turn, after the opponent's turn. If the Battle Phase ends first, it resolves at Supper, before dominance is scored.
   - Several pending Strats resolve in the order they were played.
   - It fizzles if its target Pokémon is gone, even if another Pokémon now stands in that space. The cost stays paid.
   - A resolved or fizzled Strat card goes to its owner's Discard Pile.
   - X Attack's "+Attack until Supper" lasts until that Round's Supper. So an X Attack Strat that resolves at Supper has no effect.
4. **Command targets:**
   - Commands target Pokémon only, never a Player Character.
   - Guards don't apply to Commands (section 16 makes them about attacks).
   - A Command that defeats a Pokémon gives its player the usual +2 Recognition.
   - Rock Slide hits each enemy Pokémon in its target's Location; the Default Location counts as one.
5. **The four Command Cards ✱:** placeholder values. React is always cheaper than Adapt, and Strat dearer:

   | Card | Target | Adapt | React | Strat |
   |---|---|---|---|---|
   | Ember | an enemy Pokémon | 2: 3 damage | 1: 2 damage | 3: 5 damage |
   | Recover | one of yours | 2: heal 4 | 1: heal 2 | 3: heal 8 |
   | X Attack | one of yours | 2: +2 Attack until Supper | 1: +1 | 3: +4 |
   | Rock Slide | an enemy Pokémon | 3: 1 damage to each enemy Pokémon in its Location | 2: 1 damage to it | 4: 2 damage to each in its Location |

6. **Supporters ✱:**
   - A Battle Phase action costing no Energy, with no limit per Round. Released cards are chosen by the player.
   - It needs that many other cards in hand; the Supporter can't Release itself as its cost. It is Released after its effect.
   - Released cards go to the Released Pile and are never reshuffled (as in v2).
   - The Favour is met if any Released card meets its condition. It gives the enhanced effect and **+1 Recognition**, a starting value (`perFavour` in `v4/src/rules.js`).
7. **The three Supporters ✱:** placeholder values, adapted from v2's Supporters and Favours:

   | Supporter | Release | Effect | Favour: Release… | Enhanced |
   |---|---|---|---|---|
   | Nurse Joy | 1 | heal each of your Pokémon 2 | a Water Pokémon | heal 4 |
   | Professor Oak | 1 | put the first Pokémon card in your Draw Pile into your hand | a Location | 2 Pokémon cards |
   | Brock | 2 | +1 Strength (kept) to each of your Pokémon | a Pokémon of Level 4+ | +2 |

   Oak's search doesn't reshuffle and finds what's there; the Draw Pile is already shuffled.
8. **The demo deck:** 20 Pokémon, the four Locations, and one of each Command Card and Supporter: 31 cards, the same list for both players.
9. **AI:**
   - It judges a move as if the player lets it happen.
   - It values a pending Strat as 70% resolved.
   - It Releases its least useful cards, or a card that meets the Favour when it can.

## F4: Items and Trainers

1. **PokéDollars ✱:**
   - +$1 at each Breakfast, including Round 1.
   - When a Pokémon is defeated, its opponent gains its Energy cost at its Level, at least $1, whatever caused the defeat. A Partner counts as costing 3.
   - PokéDollars carry between Rounds. They are shown on each Player Character.
2. **Purchase Item ✱:**
   - A Battle Phase action that uses the turn. It is not eligible for React.
   - You buy one Item from your hand or the PokéMart, then use it at once (choosing a target) or store it in your Inventory Bag (6 spaces, as in v1).
   - There's no v1-style "In Delivery" wait: a stored Item can be used from your next turn.
   - A sold PokéMart slot stays empty until the next Breakfast.
   - An unbought Item in hand is discarded at Supper like any card. Bag Items stay through Supper.
3. **Items ✱:**
   - Every Item targets one of your Pokémon in play.
   - **Held:** it attaches, one Held Item per Pokémon, and gives its bonus while held. It is lost when that Pokémon is defeated.
   - **Consumed:** it resolves, then leaves play.
   - Used Consumed Items and lost Held Items go to the PokéMart's pool, including copies that came from a deck (as in v1). So the pool can hold more than one copy of an Item.
4. **The six Items ✱:** placeholder values. Potion, Charcoal and Choice Band are in the demo deck; Oran Berry, Mystic Water and Leftovers are only in the PokéMart.

   | Item | Price | Type | Effect |
   |---|---|---|---|
   | Potion | $2 | Consumed | heal 3 |
   | Oran Berry | $1 | Consumed | heal 2 |
   | Choice Band | $2 | Consumed | +2 Attack until Supper |
   | Charcoal | $2 | Held | +1 Attack |
   | Mystic Water | $2 | Held | +2 Strength |
   | Leftovers | $3 | Held | heal 1 at each Breakfast |

5. **The PokéMart:**
   - One shared pool with one copy of each of the six Items, separate from the decks.
   - At each Breakfast, including Round 1, unsold Items go back to the pool and 3 random Items from the pool go on sale.
6. **Breakfast order (added):** after Exhaust and Energy, $1 is added and Spent Pokémon become Active. Then heals happen (Location, Rain, Leftovers), cards take their Level, the draw happens, the PokéMart refreshes, and waiting Partners arrive.
7. **Trainer Objective ✱:**
   - A Battle Phase action costing 1 Energy. The Trainer goes to your Trainer area beside your Player Character.
   - It counts only what happens after it's played. It stays until completed, with no limit on how many you have.
   - **On completion:**
     - The Partner arrives in your first empty space (leftmost), Spent, as a summoned snapshot.
     - Its On Summon resolves.
     - You gain +2 Recognition (`perObjective` in `v4/src/rules.js`, a starting value).
     - The Trainer card goes to your Discard Pile.
   - If no space is free, the Partner waits. It arrives as soon as a space frees, checked after every action and at Breakfast.
   - A defeated Partner goes to the Released Pile; it isn't a deck card.
8. **Trainer Command:** a separate Battle Phase action with its own Energy cost. It resolves at once, then the card is discarded. It isn't eligible for React.
9. **The two Trainers ✱:** placeholder values.

   | Trainer | Objective (1 Energy) | Partner | Partner On Summon | Trainer Command |
   |---|---|---|---|---|
   | Misty | Defeat 2 enemy Pokémon | Starmie (Water, Special, Swift; Attack 4, Strength 6) | draw 2 cards | 1 Energy: draw 2 cards |
   | Blaine | Dominate a Location at Supper | Ninetales (Fire, Special, Steady; Attack 5, Strength 6) | 1 damage to each enemy Pokémon | 2 Energy: 1 damage to each enemy Pokémon |

10. **The demo deck:** 36 cards, the same list for both players: 20 Pokémon, 4 Locations, 4 Command Cards, 3 Supporters, 3 Items and 2 Trainers.
11. **AI values:**
    - PokéDollars count a little.
    - Bag Items count by price.
    - A Trainer in play counts by its progress.
    - An unbought Item in hand counts less than other cards, because it would be discarded at Supper.
