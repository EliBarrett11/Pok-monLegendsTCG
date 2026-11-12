# The Base Game: plan

**Status:** a plan for Elliott's approval (12 November 2026).

**Goal:** turn v4 from one shared deck into a **card library and a deck builder**, so players build their own decks and discover strategies and archetypes. Everything here builds on the rules and features Elliott is happy with. Current cards are kept only where they serve the library.

**Companion:** `docs/base-game-art-list.md`, the 160 pieces of new art by batch.

---

## 1. The answers in brief

| Elliott's question | Answer |
|---|---|
| **1. How many cards** | **180 collectable cards:** 66 Pokémon (60 evolution lines plus 6 Legendaries), 36 Moves, 24 Supporters, 24 Items, 18 Locations, 12 Main Trainers. Plus 12 Partners, which arrive through their Trainers. |
| **2. Triggers and keywords** | **9 triggers plus static auras, and 16 keywords** (section 4). 6 triggers and 7 keywords are already built. |
| **3. What's in it** | **All 18 Pokémon Types,** with 3–4 lines each, no favourites. 12 Gym Leaders and Elite Four members as Main Trainers. Moves, Items and Locations spread across the Types (section 5). **Art: 279 pieces in all. 119 already exist; 160 are new.** |
| **4. Design strategy** | **One value budget for every card,** a clear sense of what each Energy cost should buy, one strong verb per card, and every card belonging to at least one archetype. Balance is proven with archetype decks played against each other by the AI (section 6). |
| **5. Current cards** | Kept where they fit, redesigned where the library needs it. The biggest change: **Moves get a Type** (section 7). |
| **6. How to get there** | Six phases, with design in batches you approve, art in the same batches, and a data-driven engine so 180 cards stay manageable (section 8). |

---

## 2. Why 180 cards

| Card type | Cards | Why this many |
|---|---|---|
| **Pokémon** | **66** | 60 evolution lines (3–4 per Type), with a mix of Light, Mid and Heavy series (19 / 23 / 18), plus 6 Legendaries. |
| **Moves** (Command Cards) | **36** | Two per Type, the Pokémon's signature moves. That's enough for every archetype to have 3–5 interaction tools. |
| **Supporters** | **24** | The engines of each archetype: draw, search, recursion, money, Favours. |
| **Items** | **24** | 12 Consumed and 12 Held. They also make up the PokéMart pool, so each match sees real variety. |
| **Locations** | **18** | One for each archetype's home turf, plus neutral ones. A deck runs 3–6. |
| **Main Trainers** | **12** | The archetype anchors. Each has an Objective and a Partner. A deck takes exactly 2. |
| **Total** | **180** | |

**How this compares:**
- **Marvel Snap** launched with about 150 cards, and **Legends of Runeterra** launched with about 320 across 6 regions.
- **180** gives each of the 10 archetypes in section 3 about **25–30 relevant cards**, so there are real choices within an archetype (more than the ~20 a deck needs) and room to mix two archetypes.
- It's still a size we can design carefully and Elliott can illustrate.

**Deck-building rules (proposed, see Q1):**
- **40 cards.**
- **At most 2 copies** of any card. **Legendaries: 1 copy, and 1 Legendary per deck.**
- **Exactly 2 Main Trainers,** 1 copy each. Their Objectives are active from the start, as now.
- **3 to 6 Locations,** so every match has battlegrounds to fight over.
- **No Type limit;** the Move rule in section 7 gives decks their identity instead.

**Collection:** in the Base Game **every card is available from the start**. There are no packs or unlocking. The game is about building decks, not grinding.

**Rarity:** for look and feel only, plus the copy limit:
- **Common** (plain frame);
- **Rare** (final forms, with the holo from C2);
- **Legendary** (a gold-foil frame variant).

---

## 3. The ten archetypes

Designing for archetypes first means every card has a home. Each archetype is a way to win, built from 2–4 Types, and it has a Main Trainer and Locations that suit it. The Types are deliberately shared between archetypes, so decks can mix.

| # | Archetype | How it wins | Core Types | Trainer anchors |
|---|---|---|---|---|
| 1 | **Blitz** | Early pressure on the Player Character: Quick Attack, Infiltrator, Overrun | Fire, Dark, Flying | Blaine, Karen |
| 2 | **Fortress** | Guards, Shell and healing. Out-last, then win Locations | Water, Rock, Steel | Misty, Jasmine |
| 3 | **Territory** | Win Locations: Strength stacking, On Dominate rewards | Ground, Grass, Rock | Erika, Bruno |
| 4 | **Rain Dance** | Push Rain to its brackets; Rain Power Pokémon | Water, Electric, Flying | Misty, Lt. Surge |
| 5 | **Sunny Day** | Push Sun; Sun Power Pokémon and Solar moves | Fire, Grass | Blaine, Erika |
| 6 | **Big Game** | Energy ramp into Heavy finishers and Legendaries | Electric, Dragon, Normal | Lance, Lt. Surge |
| 7 | **Mind Games** | Moves and Strats: On Command Pokémon, hand control, hidden Strats | Psychic, Fairy, Dark | Sabrina, Karen |
| 8 | **Afterlife** | Value from defeats: On Defeated, recursion from the Discard | Ghost, Bug, Poison | Morty, Koga |
| 9 | **Swarm** | Many cheap Light Pokémon fill lanes; Swarm keyword and dominance | Bug, Normal, Poison | Koga, Whitney |
| 10 | **High Roller** | PokéDollars and Items: Pickup, Held Items, the PokéMart | Normal, Steel, Fairy | Whitney, Jasmine |

---

## 4. Triggers and keywords

### 4.1 Triggers (9 plus Aura)

The six already in v4, plus three new ones that the archetypes need. "Aura" is the standard way to write a static effect.

| Trigger | Fires | Status |
|---|---|---|
| **On Summon** | when it arrives | built |
| **On Attack** | after it attacks, if it survived | built |
| **On Defend** | when it survives damage from an attack | built |
| **On Defeated** | when it's defeated | built |
| **On Knockout** | when its attack or hit-back defeats an enemy Pokémon | built |
| **On Breakfast** | at each Breakfast while in play | built |
| **On Supper** | at each Supper while in play, before dominance | **new** (Territory, Fortress) |
| **On Command** | when you play a Move as Adapt or Strat | **new** (Mind Games) |
| **On Dominate** | at Supper, when you dominate its Location | **new** (Territory) |
| **Aura** | while it's in play (e.g. "Aura: your other Pokémon here have +1 Attack") | **new** (Swarm, Fortress) |

### 4.2 Keywords (16)

| Keyword | Meaning | Status | Main users |
|---|---|---|---|
| **Quick Attack** | arrives Active instead of Spent | built | Blitz |
| **Infiltrator** | its attacks ignore guards | built | Blitz, Flying |
| **Overrun** | leftover damage from a defeat hits the Player Character | built | Blitz, Big Game |
| **Shell X** | each instance of damage it takes is X less, minimum 1 | built | Fortress |
| **Regenerate X** | heals X at Breakfast | built | Fortress, Grass |
| **Retaliate X** | when an attack damages it, the attacker takes X | built | Fortress, Poison |
| **Rage** | +1 Attack for good each time it survives damage | built | Fighting |
| **Drain** | heals itself by the damage its attacks deal | **new** | Grass, Ghost, Dark |
| **Sturdy** | the first time each match it would be defeated, it survives with 1 Strength | **new** | Rock, Steel |
| **Agility** | enemy Moves can't target it | **new** | Psychic, Flying |
| **Intimidate X** | enemy Pokémon in its Location have −X Attack | **new** | Dark, Fighting |
| **Swarm** | +1 Attack for each other of your Pokémon in its Location | **new** | Bug, Swarm |
| **Stealth** | can't be attacked while you have another Pokémon in its Location | **new** | Dark, Ghost |
| **Sun Power** | +1 Attack and +1 Strength while Sun is 2 or more | **new** | Sunny Day |
| **Rain Power** | +1 Attack and +1 Strength while Rain is 2 or more | **new** | Rain Dance |
| **Pickup** | on a defeat by its attack, gain $1 | **new** | High Roller |

**Why stop at 16:** each keyword is one sentence a player learns once, and each one supports an archetype. More keywords would add reading load without adding strategy. Anything rarer is written out as a trigger.

### 4.3 The effect vocabulary

Triggers, Moves, Supporters and Items all use the same small set of effects, so every card reads the same way:
- **Damage:** to a chosen enemy, the enemy across, each enemy in a Location, or each enemy.
- **Heal:** one Pokémon, those in a Location, or all.
- **Stats:** +/− Attack or Strength, until Supper or kept.
- **Tempo:** make Spent, make Active, return to hand.
- **Cards:** draw, search, recursion from the Discard.
- **Resources:** gain Energy or $.
- **The board:** Weather +/−.
- **Rewards:** Recognition.

---

## 5. What's in the Base Game

### 5.1 Pokémon: all 18 Types

- **Four lines each** for the six Types players think of first (Normal, Fire, Water, Grass, Electric, Psychic). **Three lines each** for the other twelve.
- **Series:** L = Light, M = Mid, H = Heavy.
- **★** marks art that already exists for every form.

| Type | Identity | Lines |
|---|---|---|
| **Normal** | flexible, money, staying power | Eevee (L) ★ · Meowth→Persian (L) · Happiny→Chansey→Blissey (H) ★ · Munchlax→Snorlax (H) |
| **Fire** | burst damage, Sun, Overrun | Charmander→Charmeleon→Charizard (H) ★ · Growlithe→Arcanine (M) ★ · Ponyta→Rapidash (L) ★ · Magby→Magmar→Magmortar (H) ★ |
| **Water** | healing, Shell, Rain | Squirtle→Wartortle→Blastoise (M) ★ · Magikarp→Gyarados (H) ★ · Horsea→Seadra→Kingdra (M) ★ · Wooper→Quagsire (M) ★ |
| **Grass** | Regenerate, growth, Sun, Drain | Bulbasaur→Ivysaur→Venusaur (H) ★ · Oddish→Gloom→Vileplume (M) ★ · Sunkern→Sunflora (L) ★ · Budew→Roselia→Roserade (M) |
| **Electric** | Speed, Energy, Rain | Chinchou→Lanturn (L) ★ · Shinx→Luxio→Luxray (L) ★ · Pichu→Pikachu (L) · Mareep→Flaaffy→Ampharos (M) |
| **Psychic** | Moves, hand control, Agility | Abra→Kadabra→Alakazam (M) · Ralts→Kirlia→Gardevoir (M) · Natu→Xatu (L) · Slowpoke→Slowbro (H) |
| **Ice** | making enemies Spent, Shell | Snorunt→Glalie (M) · Swinub→Piloswine→Mamoswine (H) · Lapras (H) ★ |
| **Fighting** | Physical, Rage, hitting back | Machop→Machoke→Machamp (H) · Mankey→Primeape (L) ★ · Riolu→Lucario (M) |
| **Poison** | weakening (−Attack), Retaliate | Ekans→Arbok (L) · Zubat→Golbat→Crobat (L) · Koffing→Weezing (M) |
| **Ground** | big Strength, Location damage | Diglett→Dugtrio (L) · Cubone→Marowak (M) · Phanpy→Donphan (H) |
| **Flying** | Infiltrator, Speed, Rain | Pidgey→Pidgeotto→Pidgeot (M) · Wingull→Pelipper (L) ★ · Starly→Staravia→Staraptor (L) |
| **Bug** | Swarm, cheap bodies, recursion | Caterpie→Metapod→Butterfree (L) · Sewaddle→Swadloon→Leavanny (M) ★ · Scyther→Scizor (M) |
| **Rock** | Sturdy, Defence guards | Geodude→Graveler→Golem (H) · Larvitar→Pupitar→Tyranitar (H) · Bonsly→Sudowoodo (M) |
| **Ghost** | On Defeated, Stealth, recursion | Gastly→Haunter→Gengar (M) · Duskull→Dusclops→Dusknoir (H) · Litwick→Lampent→Chandelure (L) |
| **Dragon** | Heavy finishers, Overrun | Dratini→Dragonair→Dragonite (H) · Gible→Gabite→Garchomp (H) · Swablu→Altaria (L) |
| **Dark** | Intimidate, Stealth, the Player Character | Houndour→Houndoom (M) ★ · Sneasel→Weavile (L) ★ · Absol (M) ★ |
| **Steel** | Shell, Sturdy, Held Items | Aron→Lairon→Aggron (H) · Magnemite→Magneton→Magnezone (M) · Beldum→Metang→Metagross (H) |
| **Fairy** | Sp. Def guards, healing, Favours | Clefairy→Clefable (M) · Togepi→Togetic→Togekiss (M) · Snubbull→Granbull (L) |

**Legendaries (6):** one copy per deck. Each is a single Level 8 form, cost 5, with a match-defining effect. **Entei ★, Kyogre ★, Celebi ★**, plus Zapdos, Mewtwo, Rayquaza.

### 5.2 Main Trainers and Partners (12)

Each Trainer brings their Type's theme, an Objective that fits an archetype, and a Partner that isn't in the library (so it's special when it arrives).

| Trainer | Type | Partner | Objective theme |
|---|---|---|---|
| Misty ★ | Water | Starmie ★ | defeats (as now) |
| Blaine ★ | Fire | Ninetales ★ | dominance (as now) |
| Erika ★ | Grass | Bellossom ★ | heal a total amount |
| Lt. Surge | Electric | Raichu | spend Energy on Pokémon |
| Sabrina | Psychic | Espeon | play Moves |
| Koga | Poison | Muk | enemy Pokémon defeated by triggers |
| Bruno | Fighting | Hitmonchan | win hit-backs |
| Lance | Dragon | Salamence | summon Heavy Pokémon of Level 7+ |
| Morty | Ghost | Mismagius | your Pokémon defeated |
| Karen | Dark | Umbreon | damage to the Player Character |
| Jasmine | Steel | Steelix | equip Held Items |
| Whitney | Normal | Miltank | spend PokéDollars |

### 5.3 Supporters (24)

Nurse Joy ★, Professor Oak ★, Brock ★, Flannery ★, Pokémon Breeder ★, Tracey ★, Fisherman ★, Swimmer ★, Black Belt ★, Burglar ★, Firebreather ★, Chili ★, Crasher Wake ★, Kabu ★, Wallace ★, Ramos ★, Gardenia ★, Officer Jenny, Bill, Mr. Fuji, Team Rocket Grunt, Hiker, Bug Catcher, Ace Trainer.

**Spread of jobs:**
- draw and search (Oak, Bill, Tracey, Ace Trainer);
- healing (Nurse Joy, Mr. Fuji);
- Type supporters (Flannery, Wallace, Kabu, Crasher Wake, Gardenia, Bug Catcher, Hiker);
- recursion (Pokémon Breeder);
- money (Burglar, Team Rocket Grunt);
- disruption (Officer Jenny);
- Strength and Fortress (Brock, Black Belt).

### 5.4 Items (24): the deck and the PokéMart pool

- **Consumed (12):** Oran Berry ★, Sitrus Berry, Potion ★, Super Potion, Revive, X Attack ★, X Defend, X Speed, Rare Candy ★, Escape Rope, Amulet Coin ★, Ether.
- **Held (12):** Charcoal ★, Mystic Water ★, Miracle Seed ★, Magnet, Quick Claw ★, Choice Band ★, Choice Specs, Leftovers ★, Rocky Helmet ★, Focus Sash, Life Orb, Assault Vest.

### 5.5 Moves (36): two per Type, with Fire and Water at three and Bug and Rock at one

| Type | Moves |
|---|---|
| Normal | Recover ★, Protect |
| Fire | Ember ★, Flame Charge ★, Heat Wave ★ |
| Water | Surf ★, Bubble Beam ★, Dive ★ |
| Electric | Thunderbolt ★, Thunder Wave |
| Grass | Leech Seed ★, Solar Beam ★ |
| Psychic | Psychic, Calm Mind |
| Ice | Ice Beam, Blizzard |
| Fighting | Close Combat, Detect |
| Poison | Toxic, Sludge Bomb |
| Ground | Earthquake, Dig |
| Flying | Tailwind, Aerial Ace |
| Bug | U-turn |
| Rock | Rock Slide ★ |
| Ghost | Shadow Ball, Destiny Bond |
| Dragon | Dragon Dance, Draco Meteor |
| Dark | Sucker Punch, Thief |
| Steel | Iron Defense, Flash Cannon |
| Fairy | Moonblast, Misty Terrain |

### 5.6 Locations (18)

- **Already have art (11):** Cerulean Cape ★, Mt. Ember ★, Lake of Rage ★, Route 119 ★, Cinnabar Volcano ★, Eterna Forest ★, Floaroma Meadow ★, Pallet Town ★, Petalburg Woods ★, Shalour City ★, Stark Mountain ★.
- **New (7):** Lavender Town (Ghost), Saffron City (Psychic), Seafoam Islands (Ice), Power Plant (Electric), Dragon's Den (Dragon), Iron Island (Steel), Viridian Forest (Bug).

### 5.7 Art in numbers

| | Total | Have | New |
|---|---|---|---|
| Pokémon forms | 147 | 59 | 88 |
| Legendaries | 6 | 3 | 3 |
| Partners | 12 | 3 | 9 |
| Main Trainers | 12 | 3 | 9 |
| Supporters | 24 | 17 | 7 |
| Items | 24 | 12 | 12 |
| Moves | 36 | 11 | 25 |
| Locations | 18 | 11 | 7 |
| **Total** | **279** | **119** | **160** |

The new-art list, by batch, is `docs/base-game-art-list.md`.

---

## 6. Card design strategy

### 6.1 Principles

1. **Every card has one strong verb.** Each card does one thing a player can describe in five words ("Charizard burns the whole board"). A second ability only appears where it serves the same idea.
2. **Every card has a moment.** The best feeling in a card game is paying for something and watching it change the board. Triggers are written to be visible: damage, a draw, a swing in a Location.
3. **Every card has a home.** Each card is designed for at least one archetype, and it should be playable in at least two decks. No card exists only to fill a slot.
4. **Read once, know it forever.** Templated wording (e.g. "1 damage to an enemy Pokémon"), at most two lines on a Full card, and the keywords from section 4.
5. **Interaction over solitaire.** Effects answer or pressure the opponent's board. Big swings arrive on Strats and Reacts, which the opponent can see coming and answer.
6. **Timing is the game's signature.** Pokémon grow in the deck, so "when do I play this?" is the question no other card game asks. Light cards reward playing early, Heavy cards reward patience, and some cards should explicitly reward each choice (e.g. "On Summon: if Level 6+, also draw 1").

### 6.2 What a cost should feel like

| Energy | A player should expect |
|---|---|
| **1** | A quick Light body that does something small but useful, or a cheap React that saves a Pokémon or chips 2 damage |
| **2** | A body that holds a lane, or 3 damage: enough to defeat a typical early Pokémon. A Supporter-level card advantage. |
| **3** | A Level 5–6 body with a real ability, or an Adapt that defeats a typical mid-game Pokémon or swings a Location |
| **4** | An event. A Level 7–8 Pokémon whose arrival changes the board, or a Strat that decides a Location |
| **5** (Legendary, big Strats) | A match-defining play, which the opponent can see coming and must answer |

### 6.3 The value budget

Every card is scored on one budget, so cards at the same cost and Level are worth about the same:
- **Stats:** Attack + Strength ≈ **2 × Level + 2** for a Mid line.
  - **Light lines get +1** (efficient, but they stop at Level 6).
  - **Heavy early forms get −2 to −3,** paid back by their effect and their late forms.
- **Effects and keywords have a points price.** For example:

  | Effect or keyword | Points |
  |---|---|
  | Draw 1 | 2 |
  | 1 chosen damage | 1.5 |
  | 1 damage to each enemy | 2.5 |
  | Heal 2 | 1 |
  | +1 Energy | 2 |
  | Quick Attack | 2 |
  | Infiltrator | 2 |
  | Shell 1 | 2 |
  | Sturdy | 2 |
  | Regenerate 1 | 1.5 |
  | Retaliate 1 | 1.5 |
  | Rage | 1.5 |
  | A guard | 1 |
  | Swift / Slow | +1 / −1 |

  These are first values; the simulations correct them.
- **Moves and Items** are priced on the same points, scaled to their cost.
- **The budget lives in the card database** (Q-step B1) and flags any card more than one point over or under.

### 6.4 Balance proof

- **Starter decks:** one 40-card deck per archetype (10), built by me. They double as the AI's decks and the new player's first decks.
- **Round robin:** every archetype plays every other one, hundreds of AI-vs-AI matches each.
- **Targets:**
  - each archetype wins 45–55% overall, and no matchup is worse than 35/65;
  - match length is 7–9 Rounds;
  - no card wins more than 60% when played;
  - every card is played in at least one starter deck or competitive build.
- **Your playtests decide the feel;** the simulations catch the numbers.

---

## 7. Changes to the current cards and rules

- **Moves get a Type, and the Move rule (Q2):** a Move can only be played (Adapt, Strat or React) while you have a Pokémon of its Type in play. Moves are Pokémon moves, so a Pokémon has to perform them. This is what gives decks their identity without a Type limit. I recommend it.
- **The current 40-card deck** becomes the "Classic" starter deck (Fire, Water, Electric), with its cards kept or adjusted to fit the budget.
- **Kept, possibly re-tuned to the budget:** the current 10 Pokémon lines, 9 Moves, 5 Supporters, Items and 4 Locations.
- **Misty and Blaine's Objectives** stay as they are.
- **Brock** stays a Supporter. Ash, Mallow, Gogoat, Goldeen and other unused art aren't in the Base Game.

---

## 8. How we get there

| Phase | What | Who |
|---|---|---|
| **B0: Decisions** | Deck-building rules, the Move rule, Legendaries, rarity (section 9) | Elliott decides |
| **B1: Design bible and card database** | The value budget, effect vocabulary, wording templates, trigger and keyword rules, and **a card database** as a shared spreadsheet artifact you can sort, filter and comment on: every card's numbers, effects, archetypes, art status and budget score | I write it; Elliott reviews |
| **B2: Card design, in 4 batches** | Batch 1 (Normal, Fire, Water, Grass, Electric, plus neutral cards), then Batches 2–4. Each batch is presented as rendered card images in the approved design, for approval. | I design; Elliott approves |
| **B3: Engine** | Cards loaded from a data file. The 3 new triggers, Aura and 9 new keywords. Types for Moves and the Move rule. 18 Type crests, and attack animations for each Type, built from the effects kit. | Claude Code |
| **B4: Library and deck builder** | A Collection screen (search, filters by Type, cost, series, archetype, keyword). A deck builder (40-card counter, energy curve, Type mix, validation, saved decks, import/export code). The 10 starter decks. Choosing your deck and the AI's before a match. | Claude Code (I mock it up first, for approval) |
| **B5: AI and balance** | The AI plays any deck. A round-robin simulator. Tuning against section 6.4. | Claude Code runs it; I review and propose numbers; Elliott decides |
| **B6: Art and release** | Your art in batches; I process it (size, trim, focal points). A final polish and a "Base Game" release | Elliott and me |

**Running in parallel:** your art follows the same batches, so each batch can be built as soon as its art and design are ready. Batch 1 needs only 22 new pieces, so the first playable deck builder can arrive early.

**Other things to consider:**
- **The AI is the biggest risk.** A deck builder means the AI must play any deck sensibly. It already plays through real outcomes (G2), which is the right base, but it needs testing per archetype.
- **Save data:** decks are saved in the browser, with an export code so you can back them up or share them.
- **The Codex** already explains every card and term; the 180 cards just need their glossary entries.
- **UX5's leftovers** (title screen, end-of-match summary, settings, resume) fit naturally into B4. The title screen gains "Collection" and "Decks".
- **Sound (UX6)** is still on the list for after the Base Game.

---

## 9. Decisions for Elliott (B0)

- **Q1, deck rules:** 40 cards, at most 2 copies, Legendaries 1 copy and 1 per deck, exactly 2 Main Trainers, and 3–6 Locations. OK?
- **Q2, the Move rule:** a Move needs a Pokémon of its Type in play. Recommended. Yes or no?
- **Q3, Legendaries:** include the 6 (Entei, Kyogre, Celebi already drawn)?
- **Q4, collection:** everything available from the start in the Base Game?
- **Q5, the line-up:** the Types, lines, Trainers, Partners, Supporters, Items, Moves and Locations in section 5. Approve, or swap any favourites in or out.
- **Q6, the archetypes:** the ten in section 3. Approve, or tell me which strategies you want that are missing.
