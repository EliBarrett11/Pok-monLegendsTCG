# DRAFT: neutral cards for the current game (v1)

**Status: a proposal for Elliott. Don't build from this file yet.** Once it's approved, the cards move into `docs/decks.md`, and a round-robin balance check follows.

## Purpose

Each deck gets its own **unique neutral cards**: off-Type Pokémon, Type-free Strategy Cards, Supporters and Items. They fill gaps in that deck's kit and replace duplicate copies, so the decks feel less one-note. Every card is designed to work in any future deck too, so all of them can join the later **deck library**.

**Gaps Elliott has felt in play:**
1. too few damaging Strategy Cards and area effects (board clears), especially in Fire and Grass;
2. no guard of the right defensive type for the attackers the opponent's deck is likely to use;
3. not enough effects that build on the deck's own strategy.

**Which guard counters whom:**

| Deck | Mostly attacks with | Countered by |
|---|---|---|
| Fire | Physical | Defence guards |
| Water | Special | Special Defence guards |
| Grass | Special | Special Defence guards |

Fire has no guards at all, so it gets a **Special Defence** guard. Grass needs more early **Defence** against Fire.

**Construction stays the same:** 40 cards, split 18/8/4/4/6, with the same copy limits. Each neutral replaces one copy of a duplicate, about 4–5 per deck. Most reuse art already in the repo.

---

## 🔥 Fire: neutrals (4)

| Card | × | Type | Details | Gap it fills | Replaces | Art |
|---|---|---|---|---|---|---|
| **Dusclops** | 1 | Ghost Pokémon | Cost 3 · 2 Special · 8 **Special Defence** · Slow · Rare. **On Defend:** Burn 1 to the attacker. | A guard against Water's and Grass's Special attackers; it punishes them with Burn. | 1 Growlithe | ✅ dusclops |
| **Absol** | 1 | Dark Pokémon | Cost 3 · 5 Physical · 5 Hitpoints · Swift · Rare. Deals +2 damage with its attack to a **burned** target. | Builds on Burn: it finishes burned Pokémon. | 1 Magmar | ✅ absol |
| **Hyper Voice** | 1 | Strategy | Cost 4 · Rare. Deal 2 damage to each enemy Pokémon. (Area) | A board clear. | 1 Ember | ✅ hypervoice |
| **Black Belt** | 1 | Item (Held) | $3 · Rare. Holder gains +1 Attack and Overrun. | Pushes damage through onto Trainers. | 1 X Attack | ✅ black-belt |

## 💧 Water: neutrals (5)

| Card | × | Type | Details | Gap it fills | Replaces | Art |
|---|---|---|---|---|---|---|
| **Dragonite** | 1 | Dragon Pokémon | Cost 6 · 7 Physical · 8 Hitpoints · Steady · Epic. Infiltrator, Shell 1. | Reach and a finisher: it flies over guards to hit Trainers. | 1 Quagsire | ✅ dragonite |
| **Shinx** | 1 | Electric Pokémon | Cost 1 · 3 Physical · 4 Hitpoints · Swift · Common. Quick Attack. | An early answer to Water's slow start. | 1 Lapras | ✅ shinx |
| **Thunderbolt** | 1 | Strategy | Cost 4 · Rare. Deal 4 damage to an enemy Pokémon or Trainer. (Targeted) | Burst, which Water lacks. | 1 Bubble Beam | ❌ new art: thunderbolt |
| **Rocky Helmet** | 1 | Item (Held) | $3 · Rare. When the holder takes damage from an attack, deal 2 damage to the attacker. | A defence that punishes Fire's Infiltrators, which ignore guards. | 1 Mystic Water | ✅ rocky-helmet |
| **Tracey** | 1 | Supporter | Rare · Discard 1. Look at the top 4 cards of your Draw Pile: put 2 into your hand, the rest on the bottom. **Gift:** a Pokémon card → put 3 into your hand. | Card selection, which builds on Water's value plan. | 1 Nurse Joy | ✅ tracey |

## 🌿 Grass: neutrals (4)

| Card | × | Type | Details | Gap it fills | Replaces | Art |
|---|---|---|---|---|---|---|
| **Metapod** | 1 | Bug Pokémon | Cost 1 · 1 Physical · 6 **Defence** · Slow · Common. Shell 1 (Harden). | A cheap Round-1 guard against Fire's Physical attackers. | 1 Sewaddle | ✅ metapod |
| **Geodude** | 1 | Rock Pokémon | Cost 2 · 3 Physical · 6 **Defence** · Slow · Common. **On Defend:** deal 1 damage to the attacker. | A second early guard that chips at aggro. | 1 Bulbasaur (see note) | ✅ geodude |
| **Rock Slide** | 1 | Strategy | Cost 3 · Rare. Deal 2 damage to each enemy Pokémon in a chosen Zone. (Area) | Damage and a partial board clear; Grass had neither. | 1 Leech Seed | ❌ new art: rock-slide |
| **Brock** | 1 | Supporter | Rare · Release 1. Friendly Pokémon in a chosen Zone gain +2 Strength and Shell 1 until your next Breakfast. **Gift:** a Rock Pokémon → every Zone instead. | A defensive turn to survive the early rush; builds on Sudowoodo and Geodude. | 1 Mallow | ✅ brock |

*Note:* Geodude replaces **1 Bulbasaur** (3 → 2) to keep 18 Pokémon. If the engine needs all three Bulbasaur, it could replace a Sunkern instead.

---

## Summary

- **13 new neutral cards** (Fire 4, Water 5, Grass 4). Only **2 need new art:** Thunderbolt and Rock Slide.
- **What each deck gains:**
  - **Fire:** a Special Defence guard, a board clear, Burn payoff, Overrun.
  - **Water:** reach, a cheap early body, burst damage, punishment for Infiltrators, card selection.
  - **Grass:** early Defence guards, area damage, a defensive Supporter.
- **Balance:** after Elliott approves, a 400-match round-robin. Fire–Water, Grass–Fire and Grass–Water should each stay at 45–55%, tuned only with the new neutrals (the existing balance stays settled).
- **v2:** all of these port to v2 as the start of the neutral library, with costs, levels and breakpoints redone then.
