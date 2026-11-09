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
