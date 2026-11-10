// The glossary (G2): every trigger and keyword, in plain words, for card tooltips and keyword chips.
// Adapted from v2/src/engine/glossary.js (the v2 wording Elliott settled, docs/v4-gameplay-update.md
// 4.1), in v4's terms: Ready (not Alert), the Player Character (not the player), Hitpoints guards.
// tests/g2.test.js checks every trigger and keyword on any card has an entry. Data only.

export const GLOSSARY = [
  // --- Triggers (one per form; resolved after the action that caused them) ---
  { id: 'summon', term: 'On Summon', kind: 'trigger', text: 'Fires when this Pokémon arrives (a summon, or a Partner). You choose its target if it has one; with no legal target, that part fizzles. It can\'t be Reacted to.' },
  { id: 'attack', term: 'On Attack', kind: 'trigger', text: 'Fires after this Pokémon attacks, if it survived.' },
  { id: 'defend', term: 'On Defend', kind: 'trigger', text: 'Fires when this Pokémon survives an attack that damaged it.' },
  { id: 'defeated', term: 'On Defeated', kind: 'trigger', text: 'Fires when this Pokémon is defeated.' },
  { id: 'knockout', term: 'On Knockout', kind: 'trigger', text: 'Fires when this Pokémon\'s attack, or its hit-back, defeats an enemy Pokémon (if it\'s still in play).' },
  { id: 'breakfast', term: 'On Breakfast', kind: 'trigger', text: 'Fires at each Breakfast while this Pokémon is in play.' },
  // --- Keywords ---
  { id: 'quickAttack', term: 'Quick Attack', kind: 'keyword', text: 'This Pokémon arrives Active instead of Spent, so it can attack the turn it is summoned if it\'s Ready.' },
  { id: 'infiltrator', term: 'Infiltrator', kind: 'keyword', text: 'This Pokémon\'s attacks ignore guards: it can attack any enemy Pokémon, or the enemy Player Character.' },
  { id: 'overrun', term: 'Overrun', kind: 'keyword', text: 'When this Pokémon\'s attack defeats an enemy Pokémon, the damage left over goes to the enemy Player Character, as Recognition for you (1 per damage).' },
  { id: 'shell', term: 'Shell', kind: 'keyword', text: 'Shell X: each instance of damage this Pokémon takes is X less, but at least 1. It applies to all damage, Retaliate included. Numbers add up.' },
  { id: 'regenerate', term: 'Regenerate', kind: 'keyword', text: 'Regenerate X: this Pokémon heals X at Breakfast.' },
  { id: 'retaliate', term: 'Retaliate', kind: 'keyword', text: 'Retaliate X: when an attack damages this Pokémon, the attacker takes X (its Shell reduces it).' },
  { id: 'rage', term: 'Rage', kind: 'keyword', text: '+1 Attack for good each time this Pokémon survives damage.' },
  // --- Terms the triggers use ---
  { id: 'in-its-location', term: 'In its Location', kind: 'rule', text: 'The lanes of the Location it stands in (all 9 in the Pokémon League Tournament); in a lane with no Location, just its own lane.' },
  { id: 'ready', term: 'Ready', kind: 'rule', text: 'An Active Pokémon of the highest Speed among all Active Pokémon on both sides (Quick Claw counts one step higher). Only Ready Pokémon attack, and a Ready target hits back (not one holding Choice Band).' },
  // --- G3 (gameplay update 5.1–5.3): Command targets and effects, Items, Supporters ---
  { id: 'command-modes', term: 'Adapt · React · Strat', kind: 'rule', text: 'Each Command has three ways to play, each with its own Energy cost and target. Adapt: at once. React: cheaper and weaker, in reply to the opponent\'s attack, Adapt or resolving Strat, before it. Strat: dearer and stronger, after the opponent\'s next turn.' },
  { id: 'location-target', term: 'Choose a Location', kind: 'rule', text: 'Rock Slide and Surf: choose a Location (or a lane with no Location); each enemy Pokémon there is hit. In the Tournament, the whole battlefield.' },
  { id: 'all-enemies', term: 'Each enemy Pokémon', kind: 'rule', text: 'Heat Wave hits every enemy Pokémon on the battlefield; there is nothing to choose.' },
  { id: 'react-targets', term: 'The attacker · the Pokémon being attacked', kind: 'rule', text: 'Some React modes act on the attack they reply to: Heat Wave damages the attacker; Surf heals your Pokémon being attacked; Bubble Beam makes the attacker Spent after its attack; Dive returns your Pokémon being attacked to your hand, so the attack fizzles.' },
  { id: 'dive', term: 'Dive', kind: 'rule', text: 'Return one of your Pokémon to your hand (not a Partner). The card develops again with the Rounds; its Held Item goes back to the PokéMart; damage and anything it kept are lost.' },
  { id: 'kept', term: 'Kept', kind: 'rule', text: 'A bonus that stays for the rest of the match (unlike "until Supper"), e.g. Flame Charge\'s Attack.' },
  { id: 'spent', term: 'Spent', kind: 'rule', text: 'A Pokémon that has attacked, was summoned, or was made Spent this Round (by a Pass, or Bubble Beam). It can\'t attack and isn\'t Ready until Breakfast.' },
  { id: 'recover', term: 'From your Discard Pile', kind: 'rule', text: 'Pokémon Breeder: choose Pokémon cards from your Discard Pile and put them into your hand (1, or 2 with its Favour).' },
  { id: 'held', term: 'Held Item', kind: 'rule', text: 'Attaches to one of your Pokémon in play, one Item each. Choice Band: +3 Attack, but it can\'t hit back. Quick Claw: Speed one step higher (Swift stays Swift). Rocky Helmet: Retaliate 2 (adds to a printed Retaliate). Leftovers: Regenerate 1.' },
  { id: 'consumed', term: 'Consumed Item', kind: 'rule', text: 'Resolves at once, then goes back to the PokéMart\'s pool. Amulet Coin has no target: buy it to use, and you gain 3 Recognition at once.' },
];
export const glossaryEntry = (id) => GLOSSARY.find((g) => g.id === id);
export const glossaryText = (id) => { const g = glossaryEntry(id); return g ? `${g.term}: ${g.text}` : ''; };
