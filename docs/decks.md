# Pokémon Legends TCG — The Decks

Approved by Elliott. This file is the source of truth for the decks and the mechanics they introduce. When building, follow it exactly; if something is ambiguous, ask before guessing.

The game will eventually have **6 archetypes × 3 specializations = 18 deck types**, each matched to a Pokémon Type. Every deck must be balanced and competitive against **all** other deck types. Decks are not designed as counters to each other.

| Deck | Archetype | Specialization | Pokémon Type |
|---|---|---|---|
| Fire | Aggressive | Burn | Fire |
| Water | Board-Based | Value-Midrange | Water |
| Grass | Combo | Engine | Grass |

**Roster health:** every deck should win 45–55% against every other deck. Adding a deck may change existing ones; all decks evolve together toward the final 6 archetypes × 3 specialisations.

---

## 1. Deck construction rules

- **40 cards** per deck, plus **3 Trainers** outside the deck.
- **Rarity tiers (4):** Common, Rare, Epic, Legendary. **Copy limits** per card: Common 3, Rare 2, Epic 1, Legendary 1 — and **at most one Legendary card in a deck**.
- **Standard split:** 18 Pokémon, 8 Strategy, 4 Supporter, 4 Location, 6 Item.
- **Mostly-type:** about 14–15 Pokémon of the deck's type, plus 3–4 allies of other types.
- **Pokémon stat budget (design guideline):** Attack + Strength ≈ 2 × Cost + 6. Adjust: Swift −2, Slow +2, Defence or Special Defence Strength-Type −1, each ability or Innate −1 to −3 by strength, Legendary +1.

---

## 2. New mechanics

### 2.1 Status Effects

A Status Effect is a counter on a Pokémon or a Trainer, shown as a numbered token on the card. Build Status Effects as a general system (data-driven), so future statuses (Poison, Paralysis, Sleep, Freeze, Confusion…) can be added without engine rework. Burn came first; Sleep and Leech Seed arrive with the Grass deck (2.9).

**Burn**
- "Burn X" adds X Burn counters to the target. Pokémon **and Trainers** can be burned. Burn stacks: applying more adds to the counters.
- **At Supper**, every burned card takes damage equal to its Burn, then loses 1 Burn (e.g. Burn 3 deals 3, then 2, then 1 over three Suppers).
- Burn damage is **effect damage**: it does not trigger On Defend. It can defeat Pokémon (Released Pile, PokéDollars as normal) and reduce Trainers to 0 (removed as normal). Trainer Strength stops at 0.
- Healing does not remove Burn.
- **Supper order:** Weather timed effects → Burn → On Supper abilities → "this Round" effects expire → hands discarded.
- **Douse:** an effect that removes all Burn from a card.

### 2.2 Innate Powers (keywords on Pokémon)

| Keyword | Rule |
|---|---|
| **Scorch X** | When this Pokémon's attack (a Command) deals damage, apply Burn X to the target, if it is still in play. Works on Trainers too. |
| **Overrun** | When this Pokémon's attack defeats an enemy Pokémon, the damage left over beyond the target's remaining Strength is dealt to the Trainer in that Zone on the defender's side. Lost if that Trainer has been removed. Overrun damage counts as damage from this Pokémon (it triggers On Trainer Strike). |
| **Regenerate X** | At Breakfast (with On Breakfast abilities), this Pokémon heals X. |
| **Shell X** | Every instance of damage this Pokémon takes is reduced by X, to a minimum of 1. Applies to all damage, including Burn. |
| **Infiltrator** | This Pokémon's attacks ignore the Defence and Special Defence targeting restrictions: it may attack any enemy Pokémon or any enemy Trainer still in play. Trading damage works as normal (an Alert target still hits back). |
| Quick Attack, Agility | Unchanged. |

A Pokémon can have more than one Innate Power (e.g. "Overrun, Scorch 2").

### 2.3 Trigger Words (new)

| Trigger | When it fires |
|---|---|
| **On Knockout** | When damage dealt by this Pokémon (its attack, a trade, Overrun, or its own ability) defeats an enemy Pokémon. |
| **On Trainer Strike** | When this Pokémon damages an enemy Trainer (attack or Overrun). |
| **Rally** | When another friendly Pokémon is summoned into this Pokémon's Zone (same side). |
| **On Heal** | When this Pokémon is healed by at least 1. |

Existing triggers (On Summon, On Attack, On Defend, On Defeated, On Breakfast, On Supper) are unchanged.

### 2.4 Card keywords and effect types (new)

| Keyword / effect | Rule |
|---|---|
| **Retain** | At Supper, a card with Retain stays in your hand instead of being discarded. Retain can be printed on a card or granted ("gains Retain"); a granted Retain lasts until the card leaves your hand. There is no hand size limit. |
| **"This Round"** | Effects that say "this Round" expire at Supper (after Burn resolves). Everything else is permanent unless stated. |
| **Search** | Choose a matching card from your Draw Pile and put it in your hand, then shuffle your Draw Pile. If none match, nothing happens. |
| **Return** | Choose a matching card from your Discard Pile and put it in your hand. Never from the Released Pile. |
| **Free summon** | Play a Pokémon from your hand into an empty Pokémon Space without paying its cost (normal summon rules otherwise: arrives Spent, triggers On Summon, Rally, Brock-style Passives, quests). |
| **Cost reduction** | Reduces the Energy Cost of a Pokémon, to a minimum of 0. |
| **Becomes Active** | A Spent Pokémon becomes Active (as Wake-Up Tonic already does). Alert recalculates. |

### 2.5 Economy

- **+1 PokéDollar at each Breakfast** for each player, including Round 1. PokéDollars from defeating Pokémon are unchanged.

### 2.6 New quest types (Locations)

| Quest | Counts |
|---|---|
| Apply Burn N times | Each time you apply Burn to any card (one count per application). |
| Heal N Strength in total | The total amount you actually heal, on any of your cards. |
| Damage enemy Trainers N times with Pokémon in this Zone | Each time one of your Pokémon in this Zone damages an enemy Trainer. |
| Defeat N enemy Pokémon | Each enemy Pokémon defeated by your cards or effects. |
| Have N friendly Pokémon in this Zone at Supper | Checked at each Supper; completes when the condition is true then. |
| Summon N Pokémon into this Zone | Each of your Pokémon summoned into this Zone. |

## Grass mechanics (2.7–2.12, approved by Elliott, 27 Oct)

### 2.7 Growth (a new player resource)

- Each player has a **Growth** pool, starting at 0. Like XP and PokéDollars, it carries over between Rounds and has no maximum.
- **Gained** only by card effects (and by Sun 4, see 2.12).
- **Spent:**
  - on **Evolve costs**, where 1 Growth replaces 1 Energy, mixed with Energy as the player chooses;
  - on card effects that say "spend Growth".
- It's shown in the resource panel as its own tile (icon: `assets/ui/icons/growth.webp`).

### 2.8 Evolution

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

### 2.9 New statuses: Sleep and Leech Seed

Statuses are shown on the card by **animation only**, like Burn's smoulder (Elliott, 27 Oct): no separate status icons. Sleep and Leech Seed don't stack, so they need no number.

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

### 2.10 New trigger

| Trigger | When it fires |
|---|---|
| **On Evolve** | When this Pokémon has just evolved into this card. |

### 2.11 New quest types (Locations)

| Quest | Counts |
|---|---|
| Gain N Growth | All Growth you gain, from any source. |
| Evolve N Pokémon | Each of your Evolves. |
| Put to Sleep or Leech Seed N times | Each Sleep or Leech Seed you apply to an enemy Pokémon. |

### 2.12 Weather rework: mechanics, not Types

How Weather builds up is unchanged: tokens on cards, the combined count from both sides, and brackets at 2/4/6/8. Every bracket now bends a game mechanic for **everyone**. "Instead" and "also" work as before; here every bracket adds to the ones below it.

| Bracket | ☀ Sun: intensity and growth | ☔ Rain: washing and renewal |
|---|---|---|
| **2** | Each Burn applied is increased by 1. | Each heal is increased by 1. |
| **4** | At Breakfast, each player gains +1 Growth. | Burn deals 1 less damage at Supper (minimum 0). |
| **6** | Sleep can't be applied. | Leech Seed drains 2 instead of 1. |
| **8** | **Drought:** no healing of any kind (Regenerate and Leech Seed included). | **Downpour:** at Supper, before Burn, all Burn is removed from every card. |

- **Removed:** every Type-based Weather effect (Fire/Water +Attack, +1/+1, −1 Attack, Water healing at Rain 8, non-Fire damage at Sun 8).
- **Unchanged:** Bubble Beam still checks "Rain is 2 or more".
- **The cost:** Fire and Water lose their Weather Attack bonuses. Rain now dampens Burn. **Both decks get a rebalance pass** (section 7) before the Grass build ships.

**Ideas for future Weathers** (one mechanic theme each; not built now):
- Sandstorm: chip damage, Shell.
- Snow: Freeze, Speed.
- Fog: attacks only within the same Zone.
- Strong Winds: Speed, Agility.
- Thunderstorm: Paralysis.
- Mist: status immunity.


---

## 3. 🔥 Fire Deck — "Burn" (Aggressive)

**Plan:** fast pressure from Round 1; Burn keeps damaging Trainers every Supper; Overrun pushes damage onto Trainers. **Trade-off:** fragile Pokémon and lower Trainer Strength; it fades in long matches.

### Pokémon (18: 14 Fire, 4 allies)

| id | Name | × | Cost | Type | Attack | Strength | Speed | Rarity | Abilities |
|---|---|---|---|---|---|---|---|---|---|
| growlithe | Growlithe | 3 | 1 | Fire | 2 Physical | 5 Hitpoints | Swift | Common | Scorch 1 |
| charmander | Charmander | 2 | 1 | Fire | 3 Special | 6 Hitpoints | Steady | Common | On Summon: Burn 1 to an enemy Pokémon or Trainer in this Pokémon's Zone. |
| ponyta | Ponyta | 3 | 2 | Fire | 3 Physical | 5 Hitpoints | Swift | Common | Quick Attack, Infiltrator |
| mankey | Mankey | 2 | 2 | Fighting | 4 Physical | 5 Hitpoints | Swift | Common | Overrun, Infiltrator |
| magmar | Magmar | 2 | 3 | Fire | 4 Special | 7 Hitpoints | Steady | Common | Scorch 2 |
| sneasel | Sneasel | 2 | 3 | Dark | 4 Physical | 4 Hitpoints | Swift | Common | Infiltrator. On Knockout: this Pokémon becomes Active (once per Round). |
| arcanine | Arcanine | 2 | 4 | Fire | 5 Physical | 6 Hitpoints | Swift | Rare | Overrun, Scorch 1, Infiltrator |
| houndoom | Houndoom | 1 | 5 | Fire | 5 Special | 7 Hitpoints | Swift | Epic | On Summon: Burn 2 to each enemy Trainer. |
| blaziken | Blaziken | 1 | 5 | Fire | 7 Physical | 8 Hitpoints | Steady | Legendary | Overrun, Scorch 2 |

Curve: cost 1 ×5, 2 ×5, 3 ×4, 4 ×2, 5 ×2.

### Strategy (8)

| id | Name | × | Cost | Rarity | Effect |
|---|---|---|---|---|---|
| ember | Ember | 3 | 1 | Common | Burn 2 to an enemy Pokémon or Trainer. (Targeted) |
| flame-charge | Flame Charge | 2 | 2 | Common | A friendly Pokémon gains +2 Attack this Round. If it's a Fire Pokémon, it also gains Scorch 1 this Round. (Targeted) |
| heat-wave | Heat Wave | 2 | 4 | Rare | Burn 1 to every enemy Pokémon and every enemy Trainer. (Area) |
| fire-blast | Fire Blast | 1 | 5 | Epic | Deal 4 damage to an enemy Pokémon or Trainer, then Burn 2 to it if it's still in play. (Targeted) |

### Supporters (4)

| id | Name | × | Rarity | Card-Cost | Effect | Gift Challenge | Gift Bonus |
|---|---|---|---|---|---|---|---|
| firebreather | Firebreather | 2 | Common | Discard 1 | Burn 1 to each enemy Trainer. | a Fire Pokémon | Burn 2 to each enemy Trainer instead. |
| chili | Chili | 1 | Rare | Release 1 | Your Pokémon in a chosen Zone gain +2 Attack and Overrun this Round. | a Swift Pokémon | They also become Active. |
| burglar | Burglar | 1 | Rare | Discard 2 | Gain 3 PokéDollars. | an Item card | Gain 5 PokéDollars instead. |

### Locations (4)

| id | Name | × | Rarity | Weather | Quest | XP | Effect on completion |
|---|---|---|---|---|---|---|---|
| mt-ember | Mt. Ember | 2 | Common | 2 Sun | Apply Burn 4 times. | 2 | Burn 2 to each enemy Trainer. |
| cinnabar-volcano | Cinnabar Volcano | 1 | Rare | 2 Sun | Damage enemy Trainers 3 times with Pokémon in this Zone. | 3 | Friendly Fire Pokémon in this Zone gain +1/+1. |
| stark-mountain | Stark Mountain | 1 | Rare | 3 Sun | Defeat 2 enemy Pokémon. | 2 | Deal 2 damage to each enemy Pokémon in this Zone. |

### Items (6)

| id | Name | × | Rarity | Item-Type | PokéDollars | Effect |
|---|---|---|---|---|---|---|
| charcoal | Charcoal | 2 | Common | Held | 2 | Holder gains +1 Attack. If it's a Fire Pokémon, it also gains Scorch 1. |
| x-attack | X Attack | 2 | Common | Consumed | 2 | A friendly Pokémon in the arena gains +2 Attack this Round. Retain. |
| quick-claw | Quick Claw | 1 | Rare | Held | 3 | Holder's Speed-Tier is one higher (Slow → Steady → Swift). |
| choice-band | Choice Band | 1 | Rare | Held | 4 | Holder gains +3 Attack and −2 Strength (can't reduce Strength below 1). |

### Trainers (total Strength 43)

| id | Name | Strength | Power | Passive |
|---|---|---|---|---|
| blaine | Blaine | 14 | (1) Burn 1 to an enemy Pokémon or Trainer. | Burn applied by friendly Pokémon in Blaine's Zone is increased by 1. |
| flannery | Flannery | 13 | (1) A friendly Pokémon in Flannery's Zone gains +2 Attack this Round. | Friendly Fire Pokémon in Flannery's Zone gain Overrun. |
| kabu | Kabu | 16 | (2) A friendly Spent Pokémon in Kabu's Zone becomes Active. | Friendly Pokémon in Kabu's Zone gain +2 Strength. |

---

## 4. 💧 Water Deck — "Value-Midrange" (Board-Based)

**Plan:** sturdy Pokémon that heal, return from the Discard Pile and grow stronger together in a Zone; wins longer matches. **Trade-off:** slow starts and low burst damage.

### Pokémon (18: 15 Water, 3 allies)

| id | Name | × | Cost | Type | Attack | Strength | Speed | Rarity | Abilities / Weather |
|---|---|---|---|---|---|---|---|---|---|
| horsea | Horsea | 2 | 1 | Water | 3 Special | 4 Hitpoints | Steady | Common | Rally: this Pokémon gains +1/+1. |
| goldeen | Goldeen | 2 | 2 | Water | 4 Physical | 5 Hitpoints | Steady | Common | On Summon: heal a friendly Pokémon 2. |
| chinchou | Chinchou | 2 | 2 | Electric | 3 Special | 5 Special Defence | Steady | Common | Regenerate 1 |
| quagsire | Quagsire | 3 | 3 | Water | 4 Physical | 7 Defence | Slow | Common | Regenerate 2 |
| wartortle | Wartortle | 2 | 3 | Water | 4 Special | 5 Defence | Steady | Common | Shell 1 |
| lapras | Lapras | 2 | 4 | Water | 5 Special | 7 Hitpoints | Steady | Rare | On Summon: heal all friendly Pokémon in this Pokémon's Zone 2. |
| pelipper | Pelipper | 1 | 4 | Water | 5 Special | 5 Hitpoints | Swift | Rare | Weather Tokens: 2 Rain. On Summon: a card in your hand gains Retain. |
| chansey | Chansey | 1 | 4 | Normal | 1 Physical | 12 Hitpoints | Slow | Rare | On Breakfast: heal each friendly Pokémon in this Pokémon's Zone 2. |
| gyarados | Gyarados | 1 | 5 | Water | 7 Physical | 6 Hitpoints | Steady | Epic | On Summon: deal 2 damage to each enemy Pokémon in this Pokémon's Zone. |
| vaporeon | Vaporeon | 1 | 5 | Water | 5 Special | 7 Special Defence | Steady | Epic | Regenerate 2. On Heal: this Pokémon gains +1 Attack. |
| kyogre | Kyogre | 1 | 6 | Water | 7 Special | 11 Hitpoints | Slow | Legendary | Weather Tokens: 2 Rain. On Summon: heal every friendly Pokémon and Trainer 2. |

Curve: cost 1 ×2, 2 ×4, 3 ×5, 4 ×4, 5 ×2, 6 ×1.

### Strategy (8)

| id | Name | × | Cost | Rarity | Effect |
|---|---|---|---|---|---|
| aqua-ring | Aqua Ring | 3 | 2 | Common | Heal a friendly Pokémon 3 and Douse it. Retain. (Targeted) |
| bubble-beam | Bubble Beam | 2 | 3 | Common | Deal 2 damage to an enemy Pokémon, or 3 if Rain is 2 or more. (Targeted) |
| dive | Dive | 2 | 2 | Common | Return a Pokémon from your Discard Pile to your hand. It gains Retain. |
| surf | Surf | 1 | 5 | Rare | Deal 2 damage to each enemy Pokémon, and heal each friendly Pokémon 1. (Area) |

### Supporters (4)

| id | Name | × | Rarity | Card-Cost | Effect | Gift Challenge | Gift Bonus |
|---|---|---|---|---|---|---|---|
| nurse-joy | Nurse Joy | 2 | Common | Discard 1 | Heal a friendly Trainer 3 and Douse it. | a Normal Pokémon | Heal 5 instead. |
| swimmer | Swimmer | 1 | Rare | Discard 2 | Free summon a Pokémon costing 2 or less from your hand. | a Water Pokémon | It arrives Active. |
| fisherman | Fisherman | 1 | Rare | Release 1 | Search your Draw Pile for a Water Pokémon; it gains Retain. | a Strategy card | Search for two instead. |

### Locations (4)

| id | Name | × | Rarity | Weather | Quest | XP | Effect on completion |
|---|---|---|---|---|---|---|---|
| cerulean-cape | Cerulean Cape | 2 | Common | 2 Rain | Summon 3 Pokémon into this Zone. | 2 | Friendly Pokémon in this Zone gain +1/+1. |
| lake-of-rage | Lake of Rage | 1 | Rare | 2 Rain | Heal 10 Strength in total. | 3 | Return up to 2 Pokémon from your Discard Pile to your hand. |
| route-119 | Route 119 | 1 | Rare | 3 Rain | Have 3 friendly Pokémon in this Zone at Supper. | 2 | Heal all friendly Trainers 3. |

### Items (6)

| id | Name | × | Rarity | Item-Type | PokéDollars | Effect |
|---|---|---|---|---|---|---|
| mystic-water | Mystic Water | 2 | Common | Held | 2 | Holder gains +1 Attack. If it's a Water Pokémon, it also gains +1 Strength. |
| leftovers | Leftovers | 2 | Common | Held | 3 | Holder gains Regenerate 1. |
| full-heal | Full Heal | 2 | Common | Consumed | 1 | Douse a friendly Pokémon or Trainer and heal it 2. Retain. |

### Trainers (total Strength 48)

| id | Name | Strength | Power | Passive |
|---|---|---|---|---|
| misty | Misty | 16 | (1) Heal a friendly Pokémon in Misty's Zone 3. | Friendly Water Pokémon in Misty's Zone gain +2 Strength. |
| crasher-wake | Crasher Wake | 17 | (2) Deal 2 damage to an enemy Pokémon in Wake's Zone. | Friendly Pokémon in Wake's Zone gain Shell 1. |
| wallace | Wallace | 15 | (1) Return a Pokémon from your Discard Pile to your hand. | The first Pokémon you summon into Wallace's Zone each Round costs 1 less. |

---

## 5. 🌿 Grass Deck — "Engine" (Combo)

**Plan:** plant cheap engine Pokémon and Locations that produce **Growth** every Round, spend Growth to **evolve** them into large final stages, and finish with **Solar Beam**, which turns stored Growth into a big hit on a Trainer. Sleep and Leech Seed buy time while the engine runs. **Trade-off:** a weak start (Rounds 1–3) and engine pieces that must survive on the board; vulnerable to fast pressure and to losing its Basics before they evolve.

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


---

## 6. Shared

- **PokéMart:** one copy of every Item in the game (11): Charcoal, X Attack, Quick Claw, Choice Band, Mystic Water, Leftovers, Full Heal, Miracle Seed, Oran Berry, Rare Candy, Big Root.
- **Full Heal** (Water deck) becomes: "Cure a friendly Pokémon or Trainer of all statuses and heal it 2. Retain."
- **Weather:** the reworked table in 2.12 replaces the old Type-based brackets.
- **Art:** `assets/cards/<id>.jpg`. Cards without an image use the placeholder look until art arrives. Existing art reused: growlithe, magmar, blaziken, horsea, goldeen, quagsire, misty, cerulean-cape.
- **Retired:** all previous placeholder cards and the Ash/Brock Trainers are removed from play. Their art files may stay in `assets/`.

- **Grass art:** all 28 Grass cards have art in `assets/cards/`. Icons: `growth`, `type-grass`, `type-bug`, `type-rock` in `assets/ui/icons/` (with halo masks).

## 7. Balance plan (Grass and the Weather rework)

1. The balance tool becomes a **round-robin**: Fire–Water, Fire–Grass and Water–Grass, 200 matches each (100 per seat order).
2. **Target:** every matchup at 45–55%, no deck below 45% overall. Report average Rounds per matchup too.
3. **Retune Fire vs Water for the new Weather first**, then tune Grass. Elliott decides every number; variants are tested with `--variant` and never committed until he chooses.
