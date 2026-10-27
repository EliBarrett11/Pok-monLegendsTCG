# DRAFT: the Grass deck, Evolution, Growth, new statuses and the Weather rework

**Status: proposal awaiting Elliott's approval. Don't build from this file yet.** Once it's approved it moves into `docs/decks.md` (deck and mechanics) and `docs/rules.md` (rules).

Systems Elliott has approved in principle (27 Oct):
- Growth as a new resource;
- Evolution, option A (evolution cards);
- Sleep and Leech Seed, with Full Heal curing all statuses;
- Weather reworked to bend game mechanics instead of buffing Types.

The details below are the proposal.

| Deck | Archetype | Specialization | Pokémon Type |
|---|---|---|---|
| Grass | Combo | Engine | Grass |

**Plan:** plant cheap engine Pokémon and Locations that produce **Growth** every Round, spend Growth to **evolve** them into large final stages, and finish with **Solar Beam**, which turns stored Growth into a big hit on a Trainer. Sleep and Leech Seed buy time while the engine runs.
**Trade-off:** a weak start (Rounds 1–3) and engine pieces that must survive on the board. It's vulnerable to fast pressure and to losing its Basics before they evolve.
**How opponents fight it:** race it (Fire), or grind its board down so nothing gets to evolve (Water).

---

## A. New mechanics

### A.1 Growth (a new player resource)

- Each player has a **Growth** pool, starting at 0. Like XP and PokéDollars, it carries over between Rounds and has no maximum.
- **Gained** only by card effects (and by Sun 4, see A.6).
- **Spent:**
  - on **Evolve costs**, where 1 Growth replaces 1 Energy, mixed with Energy as the player chooses;
  - on card effects that say "spend Growth".
- It's shown in the resource panel as its own tile (Elliott to make a Growth icon).

### A.2 Evolution

- **Stages:** every Pokémon is a **Basic**, **Stage 1** or **Stage 2**. An evolution card names what it evolves from ("Evolves from Bulbasaur") and has an **Evolve cost** instead of an Energy Cost. Evolution cards can't be summoned on their own.
- **Evolve** is a Battle Phase Action: play the evolution card from your hand onto a matching Pokémon in your arena, paying the Evolve cost in Energy (Base Energy, then Exert) and/or Growth.
  - The Pokémon must have been in your arena since the start of this Round: it can't have been summoned or evolved this Round.
  - It can be Active or Spent; it stays as it was. Evolving doesn't Spend it.
- **What changes:**
  - It takes the evolution card's name, Type, Attack, Strength (and Strength-Type), Speed, Innate Powers, abilities and Weather Tokens.
  - Damage carries over: new current Strength = new maximum − damage it had taken.
- **What stays:** its Held Item, XP buffs, other permanent buffs, and "this Round" effects.
- **What's removed:** **all statuses** (Burn, Sleep, Leech Seed) are cured.
- **Not a summon:** it doesn't trigger On Summon, Rally, summon quests or summon Passives. It triggers the new **On Evolve**.
- **The stack:** the card underneath stays under it. If the Pokémon is defeated or Released, the whole stack goes to the Released Pile. PokéDollars earned = the Basic's Energy Cost + each Evolve cost in the stack.
- **Returned or Searched cards:** evolution cards are Pokémon cards for Search, Return, Supporter costs and Gift Challenges.

### A.3 New statuses

**Sleep** (Pokémon only)
- "Put to Sleep" makes the Pokémon **Spent** at once, and it's **Asleep**.
- At Breakfast an Asleep Pokémon stays Spent, then wakes. So it misses one Round's actions.
- If it takes any damage, it wakes immediately. It stays Spent for the rest of this Round, but becomes Active normally at the next Breakfast.
- An Asleep (Spent) Pokémon can't hit back in a trade.
- Sleep doesn't stack.
- Cured by Evolving and Full Heal.
- **Sun 6:** Sleep can't be applied.

**Leech Seed** (Pokémon only, placed on an enemy Pokémon; it belongs to whoever applied it)
- At Supper (after Burn), each Leech Seed:
  - deals 1 effect damage to the seeded Pokémon (Shell applies, minimum 1);
  - heals the seeder's most-damaged Pokémon by 1 (ties: the engine picks);
  - gives the seeder +1 Growth.
- **Rain 6:** it drains 2 instead (2 damage, heals 2).
- A defeat by Leech Seed counts as the seeder's (PokéDollars, quests).
- One seed per Pokémon (reapplying does nothing).
- Removed when the Pokémon leaves play, Evolves, or is cured by Full Heal.

**Cures**
- **Douse** is unchanged: it removes Burn only.
- **Full Heal** (Item) becomes: "Cure a friendly Pokémon or Trainer of all statuses and heal it 2. Retain."

### A.4 New trigger

| Trigger | When it fires |
|---|---|
| **On Evolve** | When this Pokémon has just evolved into this card. |

### A.5 New quest types (Locations)

| Quest | Counts |
|---|---|
| Gain N Growth | All Growth you gain, from any source. |
| Evolve N Pokémon | Each of your Evolves. |
| Put to Sleep or Leech Seed N times | Each Sleep or Leech Seed you apply to an enemy Pokémon. |

### A.6 Weather rework: mechanics, not Types

How Weather builds up is unchanged: tokens on cards, the combined count from both sides, and brackets at 2/4/6/8. Every bracket now bends a game mechanic for **everyone**. "Instead" and "also" work as before; here every bracket adds to the ones below it.

| Bracket | ☀ Sun: intensity and growth | ☔ Rain: washing and renewal |
|---|---|---|
| **2** | Each Burn applied is increased by 1. | Each heal is increased by 1. |
| **4** | At Breakfast, each player gains +1 Growth. | Burn deals 1 less damage at Supper (minimum 0). |
| **6** | Sleep can't be applied. | Leech Seed drains 2 instead of 1. |
| **8** | **Drought:** no healing of any kind (Regenerate and Leech Seed included). | **Downpour:** at Supper, before Burn, all Burn is removed from every card. |

- **Removed:** every Type-based Weather effect (Fire/Water +Attack, +1/+1, −1 Attack, Water healing at Rain 8, non-Fire damage at Sun 8).
- **Unchanged:** Bubble Beam still checks "Rain is 2 or more".
- **The cost:** Fire and Water lose their Weather Attack bonuses. Rain now dampens Burn. **Both decks get a rebalance pass** (section D) before the Grass build ships.

**Ideas for future Weathers** (one mechanic theme each; not built now):
- Sandstorm: chip damage, Shell.
- Snow: Freeze, Speed.
- Fog: attacks only within the same Zone.
- Strong Winds: Speed, Agility.
- Thunderstorm: Paralysis.
- Mist: status immunity.

---

## B. 🌿 Grass Deck: "Engine" (Combo)

Stat guideline: Basics use the normal budget (Attack + Strength ≈ 2 × Cost + 6, adjusted). Evolutions use the budget of their **total** cost (Basic cost + Evolve costs) **+1 per stage**, for the setup risk. All numbers are a first pass, to be tuned with the balance tool.

### Pokémon (18: 15 Grass, 3 allies)

| id | Name | × | Stage | Cost | Type | Attack | Strength | Speed | Rarity | Abilities / Weather |
|---|---|---|---|---|---|---|---|---|---|---|
| bulbasaur | Bulbasaur | 3 | Basic | 1 | Grass | 1 Special | 5 Hitpoints | Steady | Common | On Breakfast: gain 1 Growth. |
| ivysaur | Ivysaur | 2 | Stage 1 (Bulbasaur) | Evolve 2 | Grass | 3 Special | 7 Hitpoints | Steady | Common | On Breakfast: gain 1 Growth. On Evolve: Leech Seed an enemy Pokémon in this Pokémon's Zone. |
| venusaur | Venusaur | 1 | Stage 2 (Ivysaur) | Evolve 3 | Grass | 5 Special | 12 Hitpoints | Slow | Epic | Shell 1. On Breakfast: gain 2 Growth. |
| oddish | Oddish | 2 | Basic | 1 | Grass | 2 Special | 4 Hitpoints | Steady | Common | On Attack: gain 1 Growth. |
| gloom | Gloom | 2 | Stage 1 (Oddish) | Evolve 2 | Grass | 3 Special | 6 Hitpoints | Steady | Common | On Evolve: put an enemy Pokémon in this Pokémon's Zone to Sleep. |
| bellossom | Bellossom | 1 | Stage 2 (Gloom) | Evolve 2 | Grass | 4 Special | 9 Hitpoints | Steady | Rare | On Evolve: put each enemy Pokémon in this Pokémon's Zone to Sleep. On Attack: gain 1 Growth. |
| sunkern | Sunkern | 2 | Basic | 1 | Grass | 2 Special | 6 Hitpoints | Slow | Common | Weather Tokens: 1 Sun. |
| sunflora | Sunflora | 1 | Stage 1 (Sunkern) | Evolve 2 | Grass | 5 Special | 8 Hitpoints | Slow | Rare | Weather Tokens: 2 Sun. Deals +2 damage with its attack while Sun is 4 or more. |
| celebi | Celebi | 1 | Basic | 4 | Grass | 3 Special | 7 Hitpoints | Swift | Legendary | On Summon: gain 3 Growth. Your Pokémon can Evolve the Round they're summoned. |
| sewaddle | Sewaddle | 2 | Basic | 1 | Bug | 2 Physical | 5 Hitpoints | Steady | Common | On Defeated: gain 2 Growth. |
| sudowoodo | Sudowoodo | 1 | Basic | 3 | Rock | 3 Physical | 9 Defence | Slow | Rare | (none: a sturdy guard) |

Basic curve: cost 1 ×11, 3 ×1, 4 ×1. Evolutions: Evolve 2 ×6, Evolve 3 ×1.

### Strategy (8)

| id | Name | × | Cost | Rarity | Effect |
|---|---|---|---|---|---|
| leech-seed | Leech Seed | 3 | 1 | Common | Leech Seed an enemy Pokémon. (Targeted) |
| sleep-powder | Sleep Powder | 2 | 2 | Common | Put an enemy Pokémon to Sleep. (Targeted) |
| synthesis | Synthesis | 1 | 1 | Common | Gain 2 Growth, or 3 if Sun is 2 or more. Heal a friendly Pokémon 2. |
| solar-beam | Solar Beam | 2 | 3 | Rare | Spend up to 8 Growth: deal that much damage to an enemy Pokémon or Trainer. Retain. (Targeted) |

### Supporters (4)

| id | Name | × | Rarity | Card-Cost | Effect | Gift Challenge | Gift Bonus |
|---|---|---|---|---|---|---|---|
| mallow | Mallow | 2 | Common | Discard 1 | Gain 2 Growth. | a Grass Pokémon | Gain 3 Growth and heal a friendly Pokémon 2. |
| pokemon-breeder | Pokémon Breeder | 1 | Rare | Release 1 | Search your Draw Pile for a Pokémon that evolves from one in your arena; it gains Retain. | an evolution card | Search for two instead. |
| professor-oak | Professor Oak | 1 | Rare | Discard 2 | Draw 3 cards. | a Pokémon card | Draw 4 instead. |

### Locations (4)

| id | Name | × | Rarity | Weather | Quest | XP | Effect on completion |
|---|---|---|---|---|---|---|---|
| floaroma-meadow | Floaroma Meadow | 2 | Common | 2 Sun | Gain 6 Growth. | 2 | Friendly Pokémon in this Zone gain +2 Strength. |
| eterna-forest | Eterna Forest | 1 | Rare | 1 Sun | Evolve 2 Pokémon. | 3 | Search your Draw Pile for an evolution card; it gains Retain. |
| petalburg-woods | Petalburg Woods | 1 | Rare | 2 Sun | Put to Sleep or Leech Seed 3 times. | 2 | Leech Seed each enemy Pokémon in this Zone. |

### Items (6)

| id | Name | × | Rarity | Item-Type | PokéDollars | Effect |
|---|---|---|---|---|---|---|
| miracle-seed | Miracle Seed | 2 | Common | Held | 2 | Holder gains +1 Attack. If it's a Grass Pokémon, it also gains Regenerate 1. |
| oran-berry | Oran Berry | 2 | Common | Consumed | 1 | Heal a friendly Pokémon 3. If it's a Grass Pokémon, also gain 1 Growth. Retain. |
| rare-candy | Rare Candy | 1 | Rare | Consumed | 3 | This Round, a friendly Basic Pokémon may Evolve straight into its Stage 2 (paying only the Stage 2's Evolve cost), even if it was summoned this Round. |
| big-root | Big Root | 1 | Rare | Held | 3 | Healing the holder receives is increased by 1. Leech Seeds you apply heal the holder first. |

### Trainers (total Strength 46)

| id | Name | Strength | Power | Passive |
|---|---|---|---|---|
| erika | Erika | 15 | (2) Put an enemy Pokémon in Erika's Zone to Sleep. | Friendly Pokémon in Erika's Zone gain +2 Strength. |
| gardenia | Gardenia | 16 | (1) Gain 1 Growth. | Evolving a Pokémon in Gardenia's Zone costs 1 less (minimum 0). |
| ramos | Ramos | 15 | (1) Leech Seed an enemy Pokémon in Ramos's Zone. | Leech Seeds on enemy Pokémon in Ramos's Zone drain 1 more. |

---

## C. Shared changes

- **PokéMart:** add Miracle Seed, Oran Berry, Rare Candy and Big Root (11 Items in all).
- **Full Heal:** cures all statuses (A.3).
- **Weather:** the new table (A.6) replaces section 1.6's brackets.
- **Art reused:** mallow, professor-oak, floaroma-meadow, miracle-seed, oran-berry, sewaddle.
- **Art needed (Elliott):**
  - Pokémon: bulbasaur, ivysaur, venusaur, oddish, gloom, bellossom, sunkern, sunflora, celebi, sudowoodo.
  - Strategy: leech-seed, sleep-powder, synthesis, solar-beam.
  - Supporter: pokemon-breeder.
  - Locations: eterna-forest, petalburg-woods.
  - Items: rare-candy, big-root.
  - Trainers: erika, gardenia, ramos.
- **Icons needed:** growth, type-grass, type-bug, type-rock, plus status badges for sleep and leech-seed.
- **VFX (a later step):**
  - attacks: Grass Special, Bug Physical, Rock Physical;
  - Strategy Cards: Leech Seed, Sleep Powder, Synthesis, Solar Beam;
  - Evolution: a glow-and-transform moment;
  - statuses: Sleep ("Zzz" and a dimmed card) and Leech Seed (vines).

## D. Balance plan

1. Build the systems and the Grass deck behind the same balance tool, which becomes a **round-robin**: Fire–Water, Fire–Grass and Water–Grass, 200 matches each.
2. **Target:** every matchup at 45–55%, with no deck below 45% overall.
3. **Retune Fire and Water for the new Weather first** (Fire vs Water back to 45–55%), then tune Grass. Elliott decides every number. Variants are tested with `--variant` and never committed until he chooses.
4. **Match length** should also be reported per matchup. Combo vs Aggro is expected to be shorter and Combo vs Board longer.
