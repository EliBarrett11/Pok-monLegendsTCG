// The glossary (v2 Feedback B): every rule, keyword, trigger and status, in plain words, for
// the Codex. Written from docs/v2-design.md and the deck docs (docs/v2-fire.md, v2-water.md,
// v2-grass.md, with the shared keyword rules in docs/decks.md 2), as v2 plays them.
//
// THE ONE PLACE FOR TERMS: a new card's new keyword, trigger or rule gets its entry here, and
// the Codex links it everywhere it appears (card text, log lines, other entries).
// tests/info.test.js checks that every keyword, trigger and status on any card has an entry.
//
// Each entry: { id, term, kind, aliases?, text, source }. In `text`, [[Term]] (or
// [[Term|shown words]]) is an explicit link; any other glossary term is linked automatically.
// kind: 'rule' · 'keyword' · 'trigger' · 'status' · 'card' · 'resource' · 'weather' · 'phase'.

export const GLOSSARY = [
  // --- Winning ---------------------------------------------------------------------------------
  { id: 'recognition', term: 'Recognition', kind: 'resource', source: 'v2-design 1.3, 7a',
    text: 'Your score. It starts at 0 and goes up. Damage you deal to the enemy player gains you that much Recognition, and Location milestones, completions and some effects give more. Burn on you and some enemy effects take it away (never below 0). The first to 90 wins at once; otherwise the highest after Round 12 wins.' },
  { id: 'player-character', term: 'Player character', kind: 'rule', aliases: ['enemy player', 'the enemy player', 'player characters'], source: 'v2-design 1.3',
    text: 'Each player is a target with no health. Damage to the enemy player gains you that much [[Recognition]]. It can be attacked by any [[Alert]] Pokémon unless a matching [[Lane guard|guard]] stands across from the attacker. It can be Burned: Burn on a player removes Recognition at Supper.' },
  { id: 'round', term: 'Round', kind: 'phase', aliases: ['Rounds'], source: 'v2-design 7a',
    text: 'A match lasts 12 Rounds. Each Round is [[Breakfast]], then the [[Battle Phase]], then [[Supper]]. Initiative (who acts first) switches every Round; a coin flip decides Round 1.' },
  { id: 'championship', term: 'Championship', kind: 'rule', source: 'v2-design 7a',
    text: 'The final Location. It arrives at the start of Round 9 over all 9 lanes: every other Location ends (milestones already earned are kept), and Pokémon stay where they are. It runs to the end of Round 12 and has the biggest rewards. After Round 12 the highest Recognition wins; a tie goes to the most Championship progress, then one sudden-death Round; a tie after that is a draw.' },
  { id: 'sudden-death', term: 'Sudden death', kind: 'rule', source: 'v2-design 7a',
    text: 'If Recognition and Championship progress are both tied after Round 12, one more Round is played. The highest Recognition after it wins; still tied, the match is a draw.' },

  // --- The Round ---------------------------------------------------------------------------------
  { id: 'breakfast', term: 'Breakfast', kind: 'phase', source: 'game.js startRound',
    text: 'The start of a Round. Spent Pokémon become Active (an Asleep one stays Spent and wakes). Each card off the board follows the Round to its new [[Level]]. Each player draws 7 and gets this Round\'s [[Energy]]. Then [[Regenerate]] and On Breakfast abilities, and Trainer Points are assigned.' },
  { id: 'battle-phase', term: 'Battle Phase', kind: 'phase', aliases: ['Battle Action', 'Battle Actions', 'your turn'], source: 'game.js',
    text: 'Players take turns, one Battle Action each: summon a Pokémon, place a Location, play a card, use an Item from the Bag, use a Trainer\'s Ability or move a Trainer, [[Nurture]], attack with an [[Alert]] Pokémon, or [[Pass]]. Two Passes in a row end it.' },
  { id: 'supper', term: 'Supper', kind: 'phase', source: 'game.js supper',
    text: 'The end of a Round. In order: Downpour (Rain 8) washes away Burn; [[Burn]] deals its damage and loses 1; [[Leech Seed]] drains; "this Round" effects end; your hand is discarded except [[Retain]] cards; up to 1 unspent Energy is [[Stored Energy|stored]]. Then Location timers tick down.' },
  { id: 'pass', term: 'Pass', kind: 'rule', source: 'game.js pass',
    text: 'A Battle Action: +1 Energy. If both players Pass in a row, the Battle Phase ends (the second Pass gains nothing). Passing while your fastest Active Pokémon are faster than all of theirs makes those Pokémon Spent (they had their chance).' },

  // --- Energy ------------------------------------------------------------------------------------
  { id: 'energy', term: 'Energy', kind: 'resource', source: 'v2-design 6.2',
    text: 'What cards cost. At Breakfast you get the Round number (up to 10), plus 1 [[Stored Energy|stored]] from last Round, plus any from Location milestones. A [[Pass]] gives +1; some cards and abilities give more.' },
  { id: 'stored-energy', term: 'Stored Energy', kind: 'resource', aliases: ['stored'], source: 'v2-design 6.2',
    text: 'At Supper, up to 1 unspent Energy carries over to the next Round.' },

  // --- The board ---------------------------------------------------------------------------------
  { id: 'lane', term: 'Lane', kind: 'rule', aliases: ['lanes', 'space', 'spaces'], source: 'v2-design 1.1',
    text: 'Each player has one row of 9 spaces; the rows face each other, so space 1 on both sides is lane 1. One Pokémon per space; a Trainer can share it. Lanes matter for Locations, lane effects and [[Lane guard|guards]]; attacks can reach any enemy Pokémon.' },
  { id: 'home', term: 'Home', kind: 'rule', source: 'v2-design 1.1',
    text: 'Every lane no Location covers. At Home, "its Location" means only that Pokémon\'s own lane.' },
  { id: 'location', term: 'Location', kind: 'card', aliases: ['Locations', 'its Location', 'a chosen Location'], source: 'v2-design 1.2',
    text: 'A place played over 1, 2 or 3 free Home lanes, on both sides of the board (it costs no Energy). Both players work on its [[Objective]], each with their own progress, earning [[Milestone]] rewards and a completion reward. It carries Weather and lasts a set number of Rounds; then its lanes are Home again.' },
  { id: 'objective', term: 'Objective', kind: 'rule', aliases: ['objectives', 'progress'], source: 'v2-design 1.2',
    text: 'What a Location asks for, e.g. "Summon 3 Pokémon here" or "Attack 4 times from here". Progress counts for the Pokémon standing in its lanes. Each player has their own progress bar.' },
  { id: 'milestone', term: 'Milestone', kind: 'rule', aliases: ['milestones', 'completion', 'completed'], source: 'v2-design 1.2',
    text: 'A step on a Location\'s objective with its own reward (Energy next Round, cards, an Item, Recognition, a Trainer Point). Completing the objective gives the completion reward. Each is paid once per player.' },
  { id: 'lane-guard', term: 'Lane guard', kind: 'rule', aliases: ['guard', 'guards', 'Guarded', 'Defence guard', 'Special Defence guard'], source: 'v2-design 1.2 (V7)',
    text: 'A Defence Pokémon guards against Physical attackers, and a Special Defence one against Special attackers, but only in its own lane and only the player: a Pokémon can\'t attack the enemy player while a matching guard stands across from it. Every enemy Pokémon can always be attacked. [[Infiltrator]] ignores guards.' },

  // --- Pokémon -------------------------------------------------------------------------------------
  { id: 'level', term: 'Level', kind: 'rule', aliases: ['Levels', 'Lv'], source: 'v2-design 4',
    text: 'Each Pokémon is a series of cards, Level 1 to 6. Off the board a card\'s Level is the Round number, up to its [[Cap]]: a Kingdra drawn in Round 1 is a Level-1 Horsea. Once played it stays at that Level unless it [[Train|trains]].' },
  { id: 'cap', term: 'Cap', kind: 'rule', aliases: ['training cap'], source: 'v2-design 4',
    text: 'The Level a card will train up to, chosen when building the deck. A card never goes above its cap.' },
  { id: 'series', term: 'Series', kind: 'rule', aliases: ['Training series'], source: 'v2-design 4',
    text: 'The ladder of a Pokémon line, Level 1 to 6, 2 Levels per stage (e.g. Horsea L1–2, Seadra L3–4, Kingdra L5–6), or 3 per stage for two-stage lines. Higher Levels have better stats and abilities, and cost more.' },
  { id: 'train', term: 'Train', kind: 'rule', aliases: ['trains', 'trained', 'training', 'Evolve', 'evolves', 'evolved'], source: 'v2-design 4',
    text: 'Raise a Pokémon on the board by Levels, up to its cap: it takes the new Level\'s stats, name and ability, and its damage carries over (it is never defeated by it). Training into a new stage is evolving: it fires On Evolve and cures Sleep and Leech Seed.' },
  { id: 'weight', term: 'Weight class', kind: 'rule', aliases: ['heavy', 'very heavy'], source: 'v2-design 7',
    text: 'Shifts a line\'s costs: light −1, standard 0, heavy +1, very heavy +2 on the cost curve (1, 1, 2, 3, 3, 4 for Levels 1–6).' },
  { id: 'legendary', term: 'Legendary', kind: 'rule', source: 'v2-design 4',
    text: 'A single card with no series and no Levels: one fixed cost and fixed stats. One per deck.' },
  { id: 'empowered', term: 'Empowered summon', kind: 'rule', aliases: ['Empowered', 'Empower'], source: 'v2-design 7',
    text: 'Some Pokémon can be summoned for extra Energy to unlock a bonus (e.g. +2 Energy for +2/+2 and Quick Attack). You choose when you summon.' },
  { id: 'attack', term: 'Attack', kind: 'rule', aliases: ['attacks', 'attacked', 'Physical', 'Special'], source: 'game.js attack',
    text: 'An [[Alert]] Pokémon deals its Attack to an enemy Pokémon or the enemy player. Physical or Special decides which [[Lane guard|guards]] stop it. If the target Pokémon is also Alert, it hits back (a trade). Both become Spent.' },
  { id: 'strength', term: 'Strength', kind: 'rule', aliases: ['Hitpoints', 'Defence', 'Special Defence'], source: 'game.js',
    text: 'A Pokémon\'s health: at 0 it is defeated and goes to the Released Pile. Its kind (Hitpoints, Defence or Special Defence) says whether it is a [[Lane guard|guard]].' },
  { id: 'speed', term: 'Speed', kind: 'rule', aliases: ['Slow', 'Steady', 'Swift'], source: 'game.js',
    text: 'Slow, Steady or Swift. Only the fastest Active Pokémon on the whole board are [[Alert]].' },
  { id: 'alert', term: 'Alert', kind: 'rule', source: 'game.js isAlert',
    text: 'An Active Pokémon of the highest Speed among all Active Pokémon on the board (both sides). Only Alert Pokémon attack, and an Alert Pokémon that is attacked hits back.' },
  { id: 'active', term: 'Active', kind: 'rule', aliases: ['becomes Active', 'Spent'], source: 'game.js',
    text: 'Active Pokémon can act; Spent ones have acted. A summoned Pokémon arrives Spent (unless [[Quick Attack]]); attacking or being attacked in a trade makes it Spent. All become Active again at Breakfast.' },
  { id: 'type', term: 'Type', kind: 'rule', aliases: ['Types'], source: 'v2 decks',
    text: 'Fire, Water, Grass, Electric, Normal, Fighting, Dark, Ghost, Dragon, Bug or Rock. Some cards and Trainers work only on a Type ("your Water Pokémon").' },
  { id: 'rarity', term: 'Rarity', kind: 'rule', aliases: ['Common', 'Rare', 'Epic'], source: 'v2-design 4',
    text: 'Common (3 copies), Rare (2), Epic (1) or Legendary (1). Each card of a series uses one copy slot of its rarity.' },
  { id: 'effect-damage', term: 'Effect damage', kind: 'rule', source: 'game.js effectDamage',
    text: 'Damage from cards, abilities, Burn and Leech Seed rather than an attack. It can defeat a Pokémon and wakes it if Asleep. Damage to the enemy player still gains you Recognition.' },

  // --- Keywords ------------------------------------------------------------------------------------
  { id: 'scorch', term: 'Scorch', kind: 'keyword', source: 'decks.md 2.2',
    text: 'Scorch X: when this Pokémon\'s own attack deals damage, it also applies [[Burn]] X to the target (Pokémon or player), if it\'s still in play. Hitting back in a trade doesn\'t Scorch. Numbers add up.' },
  { id: 'overrun', term: 'Overrun', kind: 'keyword', source: 'decks.md 2.2',
    text: 'When this Pokémon\'s attack defeats an enemy Pokémon, the damage left over goes to the enemy player as [[Recognition]] for you.' },
  { id: 'infiltrator', term: 'Infiltrator', kind: 'keyword', source: 'decks.md 2.2',
    text: 'This Pokémon\'s attacks ignore [[Lane guard|guards]]: it can always attack the enemy player.' },
  { id: 'shell', term: 'Shell', kind: 'keyword', source: 'decks.md 2.2',
    text: 'Shell X: each instance of damage this Pokémon takes is X less, but at least 1. It applies to all damage, Burn included. Numbers add up.' },
  { id: 'regenerate', term: 'Regenerate', kind: 'keyword', source: 'decks.md 2.2',
    text: 'Regenerate X: this Pokémon heals X at Breakfast.' },
  { id: 'retaliate', term: 'Retaliate', kind: 'keyword', source: 'v2-water.md',
    text: 'Retaliate X: when an attack damages this Pokémon, the attacker takes X (its Shell reduces it).' },
  { id: 'rage', term: 'Rage', kind: 'keyword', source: 'v2-fire.md',
    text: '+1 Attack for good each time this Pokémon survives damage.' },
  { id: 'quick-attack', term: 'Quick Attack', kind: 'keyword', source: 'rules.md',
    text: 'This Pokémon arrives Active instead of Spent, so it can attack the Round it is summoned.' },
  { id: 'agility', term: 'Agility', kind: 'keyword', source: 'rules.md',
    text: 'Strategy Cards can\'t choose this Pokémon as a target. Effects that hit every enemy still reach it, and attacks and Trainer Abilities can still target it.' },
  { id: 'big-root', term: 'Big Root', kind: 'keyword', source: 'v2-grass.md',
    text: 'A Held Item: healing the holder receives is +1, and your Leech Seeds heal the holder first.' },
  { id: 'retain', term: 'Retain', kind: 'keyword', source: 'decks.md 2.4',
    text: 'At Supper this card stays in your hand instead of being discarded. Printed on a card, or granted ("gains Retain") until the card leaves your hand.' },

  // --- Triggers ------------------------------------------------------------------------------------
  { id: 'on-summon', term: 'On Summon', kind: 'trigger', source: 'decks.md 2.3', text: 'Fires when this Pokémon arrives (a summon, a free summon or a Partner). You choose its target if it has one.' },
  { id: 'on-attack', term: 'On Attack', kind: 'trigger', source: 'decks.md 2.3', text: 'Fires after this Pokémon attacks, if it survived.' },
  { id: 'on-defend', term: 'On Defend', kind: 'trigger', source: 'decks.md 2.3', text: 'Fires when this Pokémon survives an attack that damaged it.' },
  { id: 'on-defeated', term: 'On Defeated', kind: 'trigger', source: 'decks.md 2.3', text: 'Fires when this Pokémon is defeated.' },
  { id: 'on-knockout', term: 'On Knockout', kind: 'trigger', source: 'decks.md 2.3', text: 'Fires when this Pokémon\'s attack (or hitting back) defeats an enemy Pokémon.' },
  { id: 'on-breakfast', term: 'On Breakfast', kind: 'trigger', source: 'decks.md 2.3', text: 'Fires at each Breakfast while this Pokémon is in play.' },
  { id: 'on-evolve', term: 'On Evolve', kind: 'trigger', aliases: ['On Evolve or Summon'], source: 'v2-grass.md', text: 'Fires when this Pokémon trains into a new stage on the board. You choose its target if there is more than one.' },
  { id: 'on-heal', term: 'On Heal', kind: 'trigger', source: 'decks.md 2.3', text: 'Fires when this Pokémon is healed by at least 1.' },
  { id: 'rally', term: 'Rally', kind: 'trigger', source: 'decks.md 2.3', text: 'Fires when another friendly Pokémon is summoned into this Pokémon\'s Location.' },

  // --- Statuses ------------------------------------------------------------------------------------
  { id: 'burn', term: 'Burn', kind: 'status', aliases: ['Burned', 'burns'], source: 'decks.md 2.1, v2-design 1.3',
    text: 'Burn X puts X Burn counters on a Pokémon or a player; more Burn adds up. At Supper a burned Pokémon takes its Burn as damage, and a burned player loses that much Recognition (never below 0); then the Burn goes down by 1. Healing doesn\'t remove it; [[Douse]] does.' },
  { id: 'douse', term: 'Douse', kind: 'rule', aliases: ['Doused'], source: 'decks.md 2.1', text: 'Removes all Burn from a Pokémon or a player.' },
  { id: 'sleep', term: 'Sleep', kind: 'status', aliases: ['Asleep', 'put to Sleep'], source: 'rules.md',
    text: 'The Pokémon becomes Spent and Asleep: at the next Breakfast it stays Spent, then wakes, so it misses a Round. Damage wakes it (it stays Spent). An Asleep Pokémon can\'t hit back. Sleep doesn\'t stack.' },
  { id: 'leech-seed', term: 'Leech Seed', kind: 'status', aliases: ['Seeded', 'Leech Seeded'], source: 'rules.md',
    text: 'At Supper the seeded Pokémon takes 1 damage (2 at Rain 6), and the seeder\'s most-damaged Pokémon heals that much. Evolving cures it.' },
  { id: 'heal', term: 'Heal', kind: 'rule', aliases: ['heals', 'healed', 'healing'], source: 'game.js',
    text: 'Restores Strength, never above the Pokémon\'s Strength. Rain 2 adds 1; Drought (Sun 8) stops all healing.' },

  // --- Cards ---------------------------------------------------------------------------------------
  { id: 'strategy', term: 'Strategy Card', kind: 'card', aliases: ['Strategy Cards', 'Strategy'], source: 'v2-design 5',
    text: 'A one-shot card with a cost range. The Energy you choose to pay picks a [[Breakpoint]]: more Energy, a bigger effect. It goes to your Discard Pile.' },
  { id: 'breakpoint', term: 'Breakpoint', kind: 'rule', aliases: ['breakpoints'], source: 'v2-design 5',
    text: 'One of a Strategy Card\'s costs and its effect (e.g. Ember: 2 Burn 2 · 4 two targets · 6 every enemy). Only those amounts can be paid. In your hand the card shows the highest one you can afford; ▲ ▼ show the others.' },
  { id: 'supporter', term: 'Supporter', kind: 'card', aliases: ['Supporters'], source: 'v2-design 3',
    text: 'Costs no Energy: you [[Release]] other cards from your hand instead, then the Supporter itself is Released. No limit per Round. Its [[Favour]] improves it.' },
  { id: 'release', term: 'Release', kind: 'rule', aliases: ['Released', 'Releasing', 'Released Pile'], source: 'v2-design 3',
    text: 'Released cards are gone for the match: they go to the Released Pile and never come back (Return can\'t take them). Defeated Pokémon go there too.' },
  { id: 'favour', term: 'Favour', kind: 'rule', source: 'v2-design 3',
    text: 'If a card you Release meets the Supporter\'s Favour condition (e.g. "a Water Pokémon"), its improved effect replaces the plain one. With a Trainer in play, meeting a Favour also earns a Trainer Point.' },
  { id: 'item', term: 'Item', kind: 'card', aliases: ['Items', 'Held', 'Held Item', 'Consumed'], source: 'v2-design 7a',
    text: 'Held Items attach to one of your Pokémon (stats and keywords while it\'s there); Consumed Items work once. From your hand an Item costs Energy: use it now or put it in your [[Bag]]. Items are also found at Locations, from the shared Item pool; used Items go back to the pool.' },
  { id: 'bag', term: 'Bag', kind: 'rule', aliases: ['Item pool'], source: 'v2-design 7a',
    text: 'Holds up to 6 Items. Using an Item from the Bag costs no Energy (it\'s still a Battle Action).' },
  { id: 'trainer', term: 'Trainer', kind: 'card', aliases: ['Trainers'], source: 'v2-design 2',
    text: 'Played for Energy above or below one of your spaces (a Pokémon can share it). Trainers unlock in three tiers as you give them [[Trainer Points]]: a Passive, an Ability, and a Partner Pokémon. Once per Round you may move one to another space (a Battle Action).' },
  { id: 'trainer-points', term: 'Trainer Points', kind: 'resource', aliases: ['Trainer Point'], source: 'v2-design 2, 7',
    text: 'Earned from Location rewards, Supporter Favours (with a Trainer in play) and some Items. At Breakfast both players assign them to their Trainers at the same time, hidden until both lock in. Points stay on the Trainer.' },
  { id: 'tier', term: 'Tier', kind: 'rule', aliases: ['tiers', 'Passive', 'Ability', 'Partner', 'Partner Pokémon'], source: 'v2-design 2',
    text: 'A Trainer\'s three unlocks, usually at 2, 4 and 6 points: the Passive (always on), the Ability (a Battle Action, once per Round, for its Energy cost) and the Partner Pokémon (it arrives in the Trainer\'s space from outside the deck, or waits for a free space).' },
  { id: 'growth', term: 'Growth', kind: 'resource', source: 'v2-grass.md',
    text: 'Grass\'s resource, made by abilities, cards and Sun 4. Spend it to [[Nurture]] or on cards like Solar Beam.' },
  { id: 'nurture', term: 'Nurture', kind: 'rule', aliases: ['Nurtured'], source: 'v2-grass.md',
    text: 'A Battle Action (0 Energy): spend 2 Growth to train 1 one of your Pokémon (up to its cap). Each Pokémon can be Nurtured once per Round.' },

  // --- Piles ---------------------------------------------------------------------------------------
  { id: 'draw-pile', term: 'Draw Pile', kind: 'rule', source: 'game.js draw',
    text: 'Your face-down deck. When it runs out, your Discard Pile is shuffled to become the new Draw Pile.' },
  { id: 'discard-pile', term: 'Discard Pile', kind: 'rule', aliases: ['Discard', 'discarded'], source: 'game.js',
    text: 'Played Strategy Cards, ended Locations and discarded hands go here (face up). Return takes cards back from it.' },
  { id: 'search', term: 'Search', kind: 'rule', aliases: ['Return', 'Free summon'], source: 'decks.md 2.4',
    text: 'Search: choose a matching card from your Draw Pile into your hand, then shuffle. Return: a matching card from your Discard Pile into your hand. Free summon: play a Pokémon from your hand without paying (it still arrives Spent).' },
  { id: 'this-round', term: 'This Round', kind: 'rule', aliases: ['until Breakfast', 'until your next Breakfast'], source: 'decks.md 2.4',
    text: '"This Round" effects end at Supper; "until your next Breakfast" ones at the next Breakfast. Everything else is permanent.' },

  // --- Weather -------------------------------------------------------------------------------------
  { id: 'weather', term: 'Weather', kind: 'weather', aliases: ['Rain', 'Sun', 'Weather Tokens', 'bracket'], source: 'decks.md 2.12',
    text: 'Locations and some Pokémon carry Rain and Sun tokens; the board\'s total of each turns on brackets. Sun 2: each Burn applied is +1 · Sun 4: each player gains 1 Growth at Breakfast · Sun 8, Drought: no healing. Rain 2: each heal is +1 · Rain 4: Burn deals 1 less at Supper · Rain 6: Leech Seed drains 2 · Rain 8, Downpour: all Burn is washed away at Supper.' },
  { id: 'codex', term: 'Codex', kind: 'rule', source: 'v2 Feedback B',
    text: 'Right-click anything (or hover it and press Space) to read about it here. The match carries on; Esc or ✕ closes it. Every underlined word links to its rule.' },
];

// The weather brackets (for the Codex's Weather entry and the board).
export const WEATHER_BRACKETS = [
  { kind: 'Sun', at: 2, text: 'each Burn applied is +1' },
  { kind: 'Sun', at: 4, text: 'each player gains 1 Growth at Breakfast' },
  { kind: 'Sun', at: 8, text: 'Drought: no healing' },
  { kind: 'Rain', at: 2, text: 'each heal is +1' },
  { kind: 'Rain', at: 4, text: 'Burn deals 1 less at Supper' },
  { kind: 'Rain', at: 6, text: 'Leech Seed drains 2' },
  { kind: 'Rain', at: 8, text: 'Downpour: all Burn is washed away at Supper' },
];

// Term → entry (every term and alias, case-insensitive), and a finder for linking.
const INDEX = new Map();
for (const e of GLOSSARY) for (const t of [e.term, ...(e.aliases ?? [])]) INDEX.set(t.toLowerCase(), e);
export const glossaryEntry = (term) => INDEX.get(String(term).toLowerCase()) ?? GLOSSARY.find((e) => e.id === term) ?? null;

// Split text into plain parts and glossary terms: [{ text, id? }]. Longest terms first,
// whole words only; [[Term]] / [[Term|words]] are explicit links.
const TERMS = [...INDEX.keys()].sort((a, b) => b.length - a.length).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
const FINDER = new RegExp(`\\[\\[([^\\]|]+)(?:\\|([^\\]]+))?\\]\\]|(?<![\\p{L}\\d])(${TERMS.join('|')})(?![\\p{L}\\d])`, 'giu');
export function termsIn(text, skip = null) {
  const out = [];
  let last = 0;
  for (const m of String(text).matchAll(FINDER)) {
    const entry = glossaryEntry(m[1] ?? m[3]);
    if (!entry || entry.id === skip) {
      if (m[1]) { out.push({ text: String(text).slice(last, m.index) }, { text: m[2] ?? m[1] }); last = m.index + m[0].length; }
      continue;
    }
    out.push({ text: String(text).slice(last, m.index) }, { text: m[2] ?? m[1] ?? m[3], id: entry.id });
    last = m.index + m[0].length;
  }
  out.push({ text: String(text).slice(last) });
  return out.filter((p) => p.text);
}

// Search: entries whose term, aliases or text match every word of the query.
export function searchGlossary(query) {
  const words = String(query).toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return GLOSSARY;
  const score = (e) => {
    const head = [e.term, ...(e.aliases ?? [])].join(' ').toLowerCase();
    const all = `${head} ${e.text.toLowerCase()}`;
    if (!words.every((w) => all.includes(w))) return -1;
    return words.filter((w) => head.includes(w)).length * 10 + (head.startsWith(words[0]) ? 5 : 0);
  };
  return GLOSSARY.map((e) => [e, score(e)]).filter(([, n]) => n >= 0).sort((a, b) => b[1] - a[1]).map(([e]) => e);
}
