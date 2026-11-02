# Pokémon Legends TCG v2: design draft

**Status: brainstorm and design in progress with Elliott. Nothing here is approved for building.** The current game (`rules.md`, `decks.md`) stays the live build until v2 is settled.

**The theme behind v2:** a match tells the story of one Trainer's career, from the first day to becoming a legend. The board starts as one all-consuming home location and fills with places visited along the way. Pokémon are trained over the journey. Relationships with mentors and rivals grow. The player's **Recognition** rises as they make their name.

---

## 1. The board and the win condition

### 1.1 The starting location
- Each side has **one row of 9 spaces**, a single horizontal line, no front or back. The two rows face each other, making **9 lanes** (columns).
- At the start the whole row is the player's **starting location**. It "shrinks" as Locations are placed over its lanes.

### 1.2 Locations: shared lanes
- A player places a Location on free lanes of the starting location. Depending on the card, it covers **1, 2 or 3 lanes**, on **both** sides of the board.
- Placed Locations can't be replaced, only completed. Proposal: a **Round timer**, after which an unfinished Location is removed. There's no limit beyond the 9 lanes.
- **Both players** can work on its objective, each with their own progress. Objectives have **milestones**, so both players are rewarded for investing in it, not only whoever finishes first.
- Objectives must be achievable by **any deck**: generic goals, not Type- or mechanic-specific ones.
- Locations still carry **Weather Tokens** (the current Weather system stays).

### 1.3 The player character and Recognition
- Trainers-as-health are retired. Each player is a **player character** that can be targeted exactly as Trainers were (guard rules apply).
- **Recognition** starts at **0 and goes up.** Damaging the opponent's player character gains **you** Recognition, 1 per point of damage. Location milestones and other effects also give Recognition.
- Recognition can also be **lost** through effects; Burn is a natural fit.
- **Win:** the first to a target Recognition. The number is still to be set.

## 2. Trainers: a new card type

- Trainer cards are **drawn from the deck and played onto the field**, attached **above or below a space**. They don't take a Pokémon's space, so a Pokémon and a Trainer can share one.
- They can't be attacked or removed except by specific effects.
- Proposal: a Trainer can be **moved** to another space once per Round as an Action. Its Passive or Ability can refer to its space, lane or Location.
- **Trainer Points** (replacing XP) are earned during the match and **assigned to Trainers between Rounds**. Each Trainer unlocks in tiers:
  1. its **Passive**;
  2. its **Ability**;
  3. its **Partner Pokémon**, summoned from outside the deck into the Trainer's space.
- Points are earned per player, not per Trainer, so a Trainer played later can still catch up. Snowballing must be checked thoroughly.

## 3. Supporters: a real sacrifice

- Card-Costs become **Release only**, and the Supporter itself is Released after use. Each copy is a once-per-match moment.
- **No once-per-Round limit.** Release cost alone is the brake: every Supporter costs reactivity, bluff and card use for the rest of the Round.
- **Gift** is renamed **Favour**. It works as before: if a paid card meets the Favour condition, the effect improves.
- Supporter effects must be impactful enough to justify the cost.

## 4. Pokémon Training series

- Each Pokémon is a **series of cards, Level 1 to 9**. Levels improve base stats, **evolve the species** at set Levels (e.g. Horsea → Seadra → Kingdra) and strengthen its ability, and also raise its cost.
- **Level 10 is for Legendaries only** and can't be trained into.
- **Deckbuilding:** you choose each card's **training cap**, the Level it will train up to. Each card in a series uses 1 copy slot of its rarity.
- **In a match, a card's Level = the Round number, up to its cap.** A Level-9 Kingdra drawn in Round 1 is a Level-1 Horsea. The Level doesn't reset when the card is drawn or discarded.
- **Once played, a Pokémon stays at the Level it was played** (the moment the player committed to it). It trains on the board only through specific effects.
- **Evolution belongs to every Type** through Training. Grass can lean into it more strongly, for example with board-training effects.
- Elliott provides art for every species in each line.

## 5. Strategy Cards: scalable costs with breakpoints

- Most Strategy Cards have a **cost range** (e.g. 0–6 or 2–4). The Energy you choose to pay sets the effect, through **breakpoints**:
  - 2 Energy: Burn 2;
  - 4 Energy: also a second target;
  - 6 Energy: every enemy.
- **Each extra Energy must be truly worth it.**
- Cards whose effect can't scale keep a single cost.

## 6. Resources: trimming

| Resource | v2 |
|---|---|
| Base Energy | Stays |
| Exert / Exhaust | **Removed.** New ways to gain Energy replace it. |
| XP | **Replaced** by Trainer Points |
| PokéDollars, PokéMart | **Removed** |
| Items | **Stay** in some form, to be revisited (no PokéDollars) |
| Growth | Grass's resource; its role under Training is to be revisited |
| Weather | Stays (via Locations) |
| Recognition | **New**: the score and win condition |

## 7. Open questions

1. **Match length vs Training.** Levels follow the Round number, but matches last 5–9 Rounds today. Level 7–9 forms would rarely appear unless matches run longer (a Recognition target can be set for that) or Levels rise faster than one per Round.
2. **Cost curve.** Base Energy = Round number, and Level = Round number. If a Level-N Pokémon costs about N, a fully trained card takes your whole turn. Is that intended, or should costs grow more slowly than Levels?
3. **Lanes and combat.** Can a Pokémon attack anywhere, as now, or only its own lane or nearby lanes? Lanes and lane-based Locations suggest some lane combat, and Infiltrator and guards would need to fit it.
4. **Locations over Pokémon.** Can a Location be placed over lanes where Pokémon already stand (they stay and become "in" the Location), or only on empty lanes?
5. **Recognition target, and the trigger for each milestone reward.**
6. **The Partner Pokémon's space:** what if the Trainer's space is already occupied when its Partner unlocks?
7. **Trainer Point sources and unlock costs** (e.g. 2 / 4 / 6). Is there a hand limit on Trainers in play?
8. **Energy without Exert:** which new Energy-gain opportunities?
9. **Items without PokéDollars:** how are they played?
10. **Current systems:** do Breakfast Evolve and the Evolve action retire in favour of Training? What does Growth do in v2?

## 8. Build approach (proposal)

v2 replaces the board, the win condition, two card types and the resource system, so it's a new ruleset rather than a patch.

1. Settle this document with Elliott.
2. Keep the current game playable throughout.
3. Build v2's engine core (board, Recognition, Locations as lanes) alongside it, reusing the UI, VFX, multiplayer and balance tooling.
4. Then add Supporters and scalable Strategy costs (self-contained), then Trainers, then Training.
5. Rebuild Fire, Water and Grass for v2, and rebalance them with the round-robin tool.
