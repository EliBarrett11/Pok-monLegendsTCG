// The glossary (G2, extended in C3): every v4 term in plain words, for the Codex, its links and the
// Rules page. Data and pure helpers only (no DOM).
//
// Written only from v4/FOUNDATION_ASSUMPTIONS.md, docs/v4-foundation-spec.md, docs/v4-gameplay-update.md
// and the engine (game.js, cards.js, rules.js, energy.js). Terms that aren't settled anywhere are left
// out (the C3 report lists them). Never the series names: a Pokémon's Levels are given by its line.
//
// Copied from v2/src/engine/glossary.js (C3): the entry shape { id, term, kind, aliases, text }, the
// term index, [[Term|shown]] explicit links, termsIn() and searchGlossary(). The G2 ids of the
// triggers and keywords are kept (tests/g2.test.js reads them by id).
import { RULES } from '../rules.js?v=202611120821';
import { BAG_SIZE, PATHS, LOCATIONS, COMMANDS, SUPPORTERS, ITEMS, TRAINERS } from './cards.js?v=202611120821';

// kind: the Rules page's groups, in its order.
export const KINDS = [
  ['flow', 'The Round'], ['energy', 'Energy'], ['pokemon', 'Pokémon'], ['combat', 'Attacks and guards'],
  ['trigger', 'Triggers'], ['keyword', 'Keywords'], ['board', 'The battlefield'], ['command', 'Command Cards'],
  ['supporter', 'Supporters'], ['item', 'Items'], ['trainer', 'Trainers'], ['winning', 'Winning'], ['rule', 'Card wording'],
];

export const GLOSSARY = [
  // --- The Round ---------------------------------------------------------------------------------------
  { id: 'round', term: 'Round', kind: 'flow', aliases: ['Rounds'], text: 'One Breakfast, one Battle Phase and one Supper. Cards off the battlefield gain a Level each Round.' },
  { id: 'breakfast-phase', term: 'Breakfast', kind: 'flow', text: `The start of a Round, in order: the Tournament begins if it is due; Exhaust recovers into Exert; Base Energy and the Exert maximum are set; Spent Pokémon become Active; +$${RULES.dollarsPerRound}; Breakfast heals (Lake of Rage, Rain 2, Regenerate); cards off the battlefield take this Round's Level; each player draws ${RULES.handDraw}, less one per Retained card; waiting Partners arrive.` },
  { id: 'battle-phase', term: 'Battle Phase', kind: 'flow', aliases: ['Battle'], text: 'The players take turns, one action each. Initiative alternates each Round. Two Passes in a row end the Battle Phase.' },
  { id: 'supper', term: 'Supper', kind: 'flow', text: 'The end of a Round, in order: pending Strats resolve (each may open a React window); dominance is scored; Trainer Objectives progress; Locations count down and expired ones leave; "until Supper" effects end; each hand is discarded, except Retained cards.' },
  { id: 'turn', term: 'turn', kind: 'flow', aliases: ['turns'], text: 'One action in the Battle Phase: summon, play a Command, Supporter or Trainer Command, place a Location, buy or use an Item, Retain, or Pass. A React or a resolving Strat isn\'t a turn.' },
  { id: 'initiative', term: 'initiative', kind: 'flow', text: 'Who takes the first turn of the Battle Phase. It alternates each Round.' },
  { id: 'mulligan', term: 'Mulligan', kind: 'flow', text: 'In Round 1, after the draw, each player may put any cards back and draw as many.' },
  { id: 'hand', term: 'hand', kind: 'flow', text: `Your cards to play. You draw ${RULES.handDraw} at each Breakfast (less one per Retained card); at Supper the hand is discarded, except Retained cards.` },
  { id: 'draw-pile', term: 'Draw Pile', kind: 'flow', aliases: ['Deck'], text: 'Your shuffled deck. Its order is hidden; only its count is shown. When it runs out, the Discard Pile is shuffled into it.' },
  { id: 'discard-pile', term: 'Discard Pile', kind: 'flow', aliases: ['Discard'], text: 'Played and discarded cards. It is shuffled back into the Draw Pile when that runs out, so its cards keep developing with the Rounds.' },
  { id: 'released-pile', term: 'Released Pile', kind: 'flow', text: 'Cards Released by a Supporter, and defeated Pokémon. It is never reshuffled.' },
  { id: 'retain', term: 'Retain', kind: 'energy', aliases: ['Retained', 'Retaining'], text: `A Battle Phase action: pay ${RULES.retainCost} Energy to keep one card in your hand through one Supper. You draw one fewer card at the next Breakfast for each card Retained. Any card can be Retained.` },
  { id: 'pass', term: 'Pass', kind: 'energy', aliases: ['Passes', 'End turn'], text: `End your turn and take +${RULES.passEnergy} Base Energy (not on the Pass that ends the Battle Phase). You can't Pass while a Ready Pokémon of yours with unmatched Speed has a legal target: attack with it, or take another action, first.` },
  { id: 'unmatched-speed', term: 'unmatched Speed', kind: 'energy', text: 'A Ready Pokémon has unmatched Speed when the opponent has no Active Pokémon of the same Speed. It blocks your Pass while it has a legal target. If none has a target, you may Pass and they become Spent.' },
  // --- Energy ------------------------------------------------------------------------------------------
  { id: 'energy', term: 'Energy', kind: 'energy', text: 'What actions cost: Base Energy first, then Exert for the shortfall.' },
  { id: 'base-energy', term: 'Base Energy', kind: 'energy', text: `Set at Breakfast to the Round number (at most 10). Each Pass adds ${RULES.passEnergy}, and some effects add more for the rest of the Round (Chinchou's On Summon). It is spent first.` },
  { id: 'exert', term: 'Exert', kind: 'energy', text: 'Extra Energy for what Base Energy can\'t cover. The Exert maximum is the Round number, at most 3. Each point spent is Exhausted.' },
  { id: 'exhaust', term: 'Exhaust', kind: 'energy', aliases: ['Exhausted'], text: 'A spent Exert point rests in a Recovery Position for 2, 3 or 4 Rounds, by position, then recovers into Exert at Breakfast.' },
  // --- Pokémon -----------------------------------------------------------------------------------------
  { id: 'pokemon', term: 'Pokémon', kind: 'pokemon', aliases: ['Pokémon card', 'Pokémon cards'], text: 'Summoned into an empty space of your row for its Energy cost. Each line has forms by Level; off the battlefield a card develops each Round, and once summoned it stays as it was.' },
  { id: 'summon-action', term: 'Summon', kind: 'pokemon', aliases: ['summoned', 'summoning', 'summons'], text: 'Put a Pokémon from your hand into an empty space of your row, paying its cost. It arrives Spent (Quick Attack: Active). Summons can\'t be Reacted to.' },
  { id: 'level', term: 'Level', kind: 'pokemon', aliases: ['Levels'], text: 'A Pokémon card\'s development. Off the battlefield (hand, Draw Pile, Discard Pile) its line\'s first Level in Round 1, +1 each Round up to its line\'s maximum. A summoned Pokémon keeps its Level.' },
  { id: 'forms', term: 'forms', kind: 'pokemon', aliases: ['form'], text: 'A line\'s Pokémon by Level, e.g. Charmander 3–4, Charmeleon 5–6, Charizard 7–8. The form, stats, trigger and keywords come from the Level.' },
  { id: 'cost', term: 'cost', kind: 'pokemon', text: 'A Pokémon costs half its Level, rounded up: Level 1–2 cost 1, 3–4 cost 2, 5–6 cost 3, 7–8 cost 4. Route 119 makes summoning there 1 cheaper. Commands, Trainer Commands and Retain have their own costs.' },
  { id: 'ready', term: 'Ready', kind: 'pokemon', text: 'An Active Pokémon of the highest Speed among all Active Pokémon on both sides (Quick Claw counts one step higher). Only Ready Pokémon attack, and a Ready target hits back (not one holding Choice Band).' },
  { id: 'active', term: 'Active', kind: 'pokemon', text: 'Not Spent. Spent Pokémon become Active at Breakfast.' },
  { id: 'spent', term: 'Spent', kind: 'pokemon', text: 'A Pokémon that has attacked, was summoned, or was made Spent this Round (by a Pass with unmatched Speed, or Bubble Beam\'s Adapt or Strat). It can\'t attack and isn\'t Ready until Breakfast.' },
  { id: 'speed', term: 'Speed', kind: 'pokemon', aliases: ['Slow', 'Steady', 'Swift'], text: 'Slow, Steady or Swift. The fastest Active Pokémon on both sides are Ready. Quick Claw raises it one step.' },
  { id: 'attack-stat', term: 'Attack', kind: 'combat', text: 'The damage a Pokémon\'s attack deals: its printed Attack plus what it has kept, Location and Weather bonuses, a Held Item and "until Supper" effects; Physical attacks also gain Sun 2.' },
  { id: 'physical', term: 'Physical', kind: 'combat', text: 'An attack kind. A Defence guard stops it; Sun 2 adds 1 damage to it.' },
  { id: 'special', term: 'Special', kind: 'combat', text: 'An attack kind. A Special Defence guard stops it.' },
  { id: 'strength', term: 'Strength', kind: 'combat', text: 'A Pokémon\'s health. Damage lowers it; at 0 the Pokémon is defeated. Bonuses raise its maximum; losing a bonus never defeats it (at least 1 is left).' },
  { id: 'hitpoints', term: 'Hitpoints', kind: 'combat', text: 'The Strength type of a Pokémon with no guard.' },
  { id: 'defence', term: 'Defence', kind: 'combat', text: 'A guard\'s Strength type. It protects its side\'s other Pokémon in its Location, and its Player Character against Physical attackers standing in that Location.' },
  { id: 'special-defence', term: 'Special Defence', kind: 'combat', text: 'A guard\'s Strength type. It protects its side\'s other Pokémon in its Location, and its Player Character against Special attackers standing in that Location.' },
  { id: 'guard', term: 'guard', kind: 'combat', aliases: ['guards', 'guarded', 'Guarded'], text: 'A Defence or Special Defence Pokémon. Attackers must target it before its side\'s other Pokémon in its Location. Commands ignore guards; Infiltrator ignores them.' },
  { id: 'hit-back', term: 'hit-back', kind: 'combat', aliases: ['hits back', 'hit back'], text: 'A Ready Pokémon that is attacked deals its own damage back to the attacker (not one holding Choice Band).' },
  { id: 'defeat', term: 'defeated', kind: 'combat', aliases: ['defeat', 'defeats', 'defeating'], text: `A Pokémon at 0 Strength goes to the Released Pile; its Held Item goes back to the PokéMart. Its opponent gains ${RULES.perDefeat} Recognition and $${RULES.dollarsPerDefeat}.` },
  { id: 'player-character', term: 'Player Character', kind: 'combat', text: `Each player\'s person on the battlefield. Damage to it gives its opponent ${RULES.perDamageToPlayer} Recognition per damage. Only attacks can reach it: Commands and Items target Pokémon only.` },
  { id: 'fizzle', term: 'fizzle', kind: 'combat', aliases: ['fizzles', 'fizzled'], text: 'An action with no legal target any more does nothing; its cost stays paid. A fizzled attack still makes the attacker Spent.' },
  // --- Triggers (one per form; resolved after the action that caused them) ---
  { id: 'summon', term: 'On Summon', kind: 'trigger', text: 'Fires when this Pokémon arrives (a summon, or a Partner). You choose its target if it has one; with no legal target, that part fizzles. It can\'t be Reacted to.' },
  { id: 'attack', term: 'On Attack', kind: 'trigger', text: 'Fires after this Pokémon attacks (a Pokémon or the Player Character), if it survived.' },
  { id: 'defend', term: 'On Defend', kind: 'trigger', text: 'Fires when this Pokémon survives an attack that damaged it (attacks only, not Command or trigger damage).' },
  { id: 'defeated', term: 'On Defeated', kind: 'trigger', text: 'Fires when this Pokémon is defeated, by anything; its effects use the lane it stood in.' },
  { id: 'knockout', term: 'On Knockout', kind: 'trigger', text: 'Fires when this Pokémon\'s attack, or its hit-back, defeats an enemy Pokémon, if it\'s still in play. A defeat by Retaliate alone doesn\'t count.' },
  { id: 'breakfast', term: 'On Breakfast', kind: 'trigger', text: 'Fires at each Breakfast while this Pokémon is in play.' },
  { id: 'trigger-order', term: 'triggers', kind: 'trigger', aliases: ['trigger'], text: 'Each form has one trigger. Triggers resolve after the action that caused them, in a queue: the acting Pokémon\'s, then the other Pokémon\'s, then On Defeated. A chain stops after 4 levels. Triggers can\'t be Reacted to.' },
  // --- Keywords ---
  { id: 'quickAttack', term: 'Quick Attack', kind: 'keyword', text: 'This Pokémon arrives Active instead of Spent, so it can attack the turn it is summoned if it\'s Ready.' },
  { id: 'infiltrator', term: 'Infiltrator', kind: 'keyword', text: 'This Pokémon\'s attacks ignore guards: it can attack any enemy Pokémon, or the enemy Player Character.' },
  { id: 'overrun', term: 'Overrun', kind: 'keyword', text: 'When this Pokémon\'s attack defeats an enemy Pokémon, the damage left over (after Shell) goes to the enemy Player Character, as Recognition for you (1 per damage).' },
  { id: 'shell', term: 'Shell', kind: 'keyword', text: 'Shell X: each instance of damage this Pokémon takes is X less, but at least 1. It applies to all damage, Retaliate included. Numbers add up.' },
  { id: 'regenerate', term: 'Regenerate', kind: 'keyword', text: 'Regenerate X: this Pokémon heals X at Breakfast, with Breakfast\'s other heals.' },
  { id: 'retaliate', term: 'Retaliate', kind: 'keyword', text: 'Retaliate X: when an attack damages this Pokémon, the attacker takes X (its Shell reduces it). Not for its own hit-back.' },
  { id: 'rage', term: 'Rage', kind: 'keyword', text: '+1 Attack for good each time this Pokémon survives damage (any damage).' },
  // --- The battlefield ---------------------------------------------------------------------------------
  { id: 'lane', term: 'lane', kind: 'board', aliases: ['lanes', 'space', 'spaces'], text: `The battlefield has ${RULES.lanes} lanes, each with one space per player.` },
  { id: 'location', term: 'Location', kind: 'board', aliases: ['Locations', 'Location card'], text: 'Placed as a Battle Phase action for no Energy, over the chosen free lane and those to its right. Its passive applies to both players\' Pokémon there. It counts down at Supper and goes to its owner\'s Discard Pile when it expires.' },
  { id: 'default-location', term: 'Default Location', kind: 'board', text: 'Every lane no Location covers. It is never scored.' },
  { id: 'dominance', term: 'dominance', kind: 'board', aliases: ['dominate', 'dominating', 'dominated'], text: `At Supper, for each placed Location, the player with more total current Strength there gains ${RULES.perDominance} Recognition. Ties and empty Locations give nothing. In the Tournament, the whole battlefield is scored for ${RULES.perTournamentDominance}.` },
  { id: 'weather', term: 'Weather', kind: 'board', text: 'Each Location adds Rain or Sun. Counts combine across placed Locations, and each bracket reached applies to both players.' },
  { id: 'rain', term: 'Rain', kind: 'board', text: 'Rain 2: every Pokémon heals 1 at Breakfast. Rain 4: every Pokémon has +1 Strength.' },
  { id: 'sun', term: 'Sun', kind: 'board', text: 'Sun 2: Physical attacks deal +1 damage. Sun 4: every Pokémon has +1 Attack.' },
  { id: 'in-its-location', term: 'In its Location', kind: 'board', aliases: ['its Location'], text: 'The lanes of the Location it stands in (all 9 in the Pokémon League Tournament); in a lane with no Location, just its own lane.' },
  { id: 'targets-location', term: "the target's Location", kind: 'board', text: 'The Location of the Pokémon an attack hit. An attack on the Player Character has none, so such an effect does nothing.' },
  // --- Command Cards -----------------------------------------------------------------------------------
  { id: 'command', term: 'Command', kind: 'command', aliases: ['Commands', 'Command Card', 'Command Cards'], text: 'A Pokémon move with three ways to play, each with its own Energy cost and target: React, Adapt or Strat. Commands ignore guards and target Pokémon only.' },
  { id: 'command-modes', term: 'Adapt · React · Strat', kind: 'command', text: 'Each Command has three ways to play, each with its own Energy cost and target. Adapt: at once. React: cheaper and weaker, in reply to the opponent\'s attack, Adapt or resolving Strat, before it. Strat: dearer and stronger, after the opponent\'s next turn.' },
  { id: 'adapt', term: 'Adapt', kind: 'command', text: 'Play a Command now: it is paid and resolves at once, as your turn\'s action. The opponent may React to it.' },
  { id: 'react', term: 'React', kind: 'command', aliases: ['Reacted', 'React window', 'Reacts'], text: 'Answer the opponent\'s attack, Adapt or resolving Strat before it resolves, with one Command\'s React mode. A React window opens only if you can pay for a React with a target. The React resolves fully, then the action resolves against the new state (it fizzles if its attacker or target is gone or now guarded). A React isn\'t a turn. Summons, Trainer Commands, Supporters, Items, Locations, Retain, Pass, a face-down Strat and a React can\'t be Reacted to.' },
  { id: 'strat', term: 'Strat', kind: 'command', aliases: ['Strats'], text: 'Play a Command face-down: paid and targeted now, as your turn\'s action. It resolves at the start of your next turn, or at Supper (before dominance) if the Battle Phase ends first; the opponent may React then. It fizzles if its target Pokémon is gone.' },
  { id: 'sealed-strat', term: 'sealed Strat', kind: 'command', aliases: ['sealed Strats', 'sealed'], text: 'A waiting Strat is hidden from the other player until it resolves: they see a face-down card and its target, never its name or effect. It flips face up as it resolves, when they may React to it. Your own sealed Strats stay visible to you.' },
  { id: 'until-supper', term: 'until Supper', kind: 'command', text: 'An effect that ends at this Round\'s Supper. From a Strat that resolves at Supper, it has no effect.' },
  { id: 'kept', term: 'kept', kind: 'command', text: 'A bonus that stays for the rest of the match while the Pokémon is in play (unlike "until Supper"), e.g. Flame Charge\'s Attack. Dive loses it.' },
  { id: 'location-target', term: 'Choose a Location', kind: 'command', text: 'Rock Slide and Surf: choose a lane on the enemy side; each enemy Pokémon in that Location is hit (in a lane with no Location, just that lane\'s; in the Tournament, every enemy Pokémon). A lane is a target only if that area holds an enemy Pokémon.' },
  { id: 'all-enemies', term: 'Each enemy Pokémon', kind: 'command', text: 'Heat Wave hits every enemy Pokémon on the battlefield; there is nothing to choose.' },
  { id: 'react-targets', term: 'The attacker · the Pokémon being attacked', kind: 'command', text: 'Some React modes act on the attack they reply to, so they are offered only against an attack by a Pokémon on a Pokémon: Heat Wave damages the attacker; Surf heals your Pokémon being attacked; Bubble Beam makes the attack deal 2 less damage (minimum 0); Dive returns your Pokémon being attacked to your hand, so the attack fizzles.' },
  { id: 'dive', term: 'Dive', kind: 'command', text: 'Return one of your Pokémon to your hand (not a Partner). The card develops again with the Rounds; its Held Item goes back to the PokéMart; damage and anything it kept are lost.' },
  { id: 'on-summon-targets', term: 'chosen target', kind: 'rule', aliases: ['chosen targets'], text: 'An On Summon that names "an enemy Pokémon" or "one of your Pokémon": the summoner picks it with the targeting arrow. The summon can\'t be cancelled; until the target is chosen, choosing is the only legal action. With no legal target that part fizzles.' },
  // --- Supporters --------------------------------------------------------------------------------------
  { id: 'supporter', term: 'Supporter', kind: 'supporter', aliases: ['Supporters'], text: 'Played as a Battle Phase action for no Energy, any number per Round: Release the number of other cards it asks for, then the Supporter itself is Released.' },
  { id: 'release', term: 'Release', kind: 'supporter', aliases: ['Releases', 'Releasing', 'Released'], text: 'Put cards from your hand into the Released Pile for good, to pay for a Supporter.' },
  { id: 'favour', term: 'Favour', kind: 'supporter', aliases: ['Favours'], text: `A Supporter's Favour is met if any card you Release meets its condition. You get its enhanced effect and ${RULES.perFavour} Recognition.` },
  { id: 'recover', term: 'From your Discard Pile', kind: 'supporter', text: 'Pokémon Breeder: choose Pokémon cards from your Discard Pile and put them into your hand (1, or 2 with its Favour). They take this Round\'s Level.' },
  // --- Items -------------------------------------------------------------------------------------------
  { id: 'item', term: 'Item', kind: 'item', aliases: ['Items'], text: 'Bought with PokéDollars, from your hand or the PokéMart, as a Battle Phase action; then used now on one of your Pokémon, or stored in your Bag. An unbought Item in hand is discarded at Supper.' },
  { id: 'held', term: 'Held Item', kind: 'item', aliases: ['Held'], text: 'Attaches to one of your Pokémon in play, one Item each, and is lost (back to the PokéMart\'s pool) when that Pokémon is defeated. Choice Band: +3 Attack, but it can\'t hit back. Quick Claw: Speed one step higher (Swift stays Swift). Rocky Helmet: Retaliate 2 (adds to a printed Retaliate). Leftovers: Regenerate 1.' },
  { id: 'consumed', term: 'Consumed Item', kind: 'item', aliases: ['Consumed'], text: 'Resolves at once, then goes back to the PokéMart\'s pool. Amulet Coin has no target: buy it to use, and you gain 3 Recognition at once.' },
  { id: 'bag', term: 'Bag', kind: 'item', aliases: ['Inventory Bag'], text: `Holds up to ${BAG_SIZE} bought Items. A stored Item can be used from your next turn, as a Battle Phase action.` },
  { id: 'pokemart', term: 'PokéMart', kind: 'item', text: 'One shared pool with one copy of each Item, and one Item on sale with its Stock. Used and lost Items go back to the pool.' },
  { id: 'stock', term: 'Stock', kind: 'item', text: 'How many more turns the PokéMart\'s Item stays on sale: $1 → 8, $2 → 6, $3 → 4, $4 → 3. Each turn taken by either player in the Battle Phase uses 1 (React decisions and resolving Strats aren\'t turns). At 0 the Item goes back to the pool and a different random Item replaces it. Stock carries over between Rounds.' },
  { id: 'sold-out', term: 'Sold out', kind: 'item', text: 'After the PokéMart\'s Item is bought, until the buyer has finished their next turn (not the turn of the purchase). Then a random Item arrives with full Stock. Nothing counts down while it is Sold out.' },
  { id: 'pokedollars', term: 'PokéDollars', kind: 'item', aliases: ['$'], text: `Money for Items: +$${RULES.dollarsPerRound} at each Breakfast, and +$${RULES.dollarsPerDefeat} for each enemy Pokémon you defeat (Partners included).` },
  // --- Trainers ----------------------------------------------------------------------------------------
  { id: 'trainer', term: 'Trainer', kind: 'trainer', aliases: ['Trainers', 'Trainer card'], text: 'A Trainer card is shuffled into the deck. Drawn, it can only be played as its Trainer Command; its Objective is tracked from the start of the match.' },
  { id: 'trainer-command', term: 'Trainer Command', kind: 'trainer', aliases: ['Trainer Commands'], text: 'A Battle Phase action with its own Energy cost. It resolves at once, then the card is discarded and keeps cycling. It can\'t be Reacted to and doesn\'t affect the Objective.' },
  { id: 'objective', term: 'Trainer Objective', kind: 'trainer', aliases: ['Objective', 'Objectives'], text: `Tracked from Round 1 for each Trainer card in your deck, free. On completion, the Trainer card leaves the deck for good, its Partner arrives (its On Summon resolves) and you gain ${RULES.perObjective} Recognition.` },
  { id: 'partner', term: 'Partner', kind: 'trainer', aliases: ['Partners'], text: 'A Level 8 Pokémon that arrives when its Trainer\'s Objective completes: in your first empty space, Spent, or as soon as a space frees. A defeated Partner goes to the Released Pile. It isn\'t a deck card (it can\'t Dive).' },
  // --- Winning -----------------------------------------------------------------------------------------
  { id: 'recognition', term: 'Recognition', kind: 'winning', text: `Reach ${RULES.win} to win, at once. From damage to the enemy Player Character (1 per damage), defeats (${RULES.perDefeat}), Overrun, dominance (${RULES.perDominance}), Favours (${RULES.perFavour}), Objectives (${RULES.perObjective}) and Amulet Coin (3).` },
  { id: 'tournament', term: 'Pokémon League Tournament', kind: 'winning', aliases: ['Tournament'], text: `Begins at Breakfast in Round ${RULES.tournamentRound}, or at the first Breakfast where either player has ${RULES.tournamentRecognition}+ Recognition. Placed Locations leave and one Location covers all ${RULES.lanes} lanes: no passives, no Weather, no new Locations. All Recognition is increased by half, rounded up. Dominating it gives ${RULES.perTournamentDominance} (8 with the passive).` },
  { id: 'champion', term: 'Pokémon League Champion', kind: 'winning', aliases: ['Champion'], text: `The first player to reach ${RULES.win} Recognition wins, at any moment, even mid-action.` },
];

// --- Lookup and links (copied from v2/src/engine/glossary.js) ------------------------------------------

const INDEX = new Map();
for (const e of GLOSSARY) for (const t of [e.term, ...(e.aliases ?? [])]) if (!INDEX.has(t.toLowerCase())) INDEX.set(t.toLowerCase(), e);
// By id or by a term or alias (any case).
export const glossaryEntry = (key) => GLOSSARY.find((e) => e.id === key) ?? INDEX.get(String(key).toLowerCase()) ?? null;
export const glossaryText = (key) => { const g = glossaryEntry(key); return g ? `${g.term}: ${g.text}` : ''; };
export const allTerms = () => [...INDEX.keys()];

// Split text into plain parts and glossary terms: [{ text, id? }]. Longest terms first, whole words only;
// [[Term]] / [[Term|words]] are explicit links. `skip`: an id not to link (an entry's own term).
// Card names are never split into terms (Lake of Rage isn't Rage; Pokémon Breeder isn't Pokémon): a name that
// isn't itself a term is matched as a whole and left as plain text.
const NAMES = [...PATHS.flatMap((p) => p.forms.map((f) => f.name)), ...[...LOCATIONS, ...COMMANDS, ...SUPPORTERS, ...ITEMS, ...TRAINERS].map((c) => c.name), ...TRAINERS.map((x) => x.partner.name)]
  .filter((n) => !INDEX.has(n.toLowerCase()));
const CARD_NAME = new Set(NAMES.map((n) => n.toLowerCase()));
const TERMS = [...new Set([...INDEX.keys(), ...CARD_NAME])].sort((a, b) => b.length - a.length).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
const FINDER = new RegExp(`\\[\\[([^\\]|]+)(?:\\|([^\\]]+))?\\]\\]|(?<![\\p{L}\\d$-])(${TERMS.join('|')})(?![\\p{L}\\d-])`, 'giu');
// Case: a term written in lower case in the glossary (turn, guard, summoned) links in either case; one written
// with a capital (Attack, Level, Spent) links only with its capital, so plain words (an attack, its level) don't.
const SPELLING = new Map();
for (const e of GLOSSARY) for (const w of [e.term, ...(e.aliases ?? [])]) if (!SPELLING.has(w.toLowerCase())) SPELLING.set(w.toLowerCase(), w);
function accept(match) {
  const own = SPELLING.get(match.toLowerCase()) ?? match;
  return own[0] === own[0].toLowerCase() || match[0] === match[0].toUpperCase();
}
export function termsIn(text, skip = null) {
  const out = [];
  let last = 0;
  const src = String(text);
  for (const m of src.matchAll(FINDER)) {
    const word = m[1] ?? m[3];
    const entry = !m[1] && CARD_NAME.has(word.toLowerCase()) ? null : glossaryEntry(word);
    if (!entry || entry.id === skip || (!m[1] && !accept(word))) {
      if (m[1]) { out.push({ text: src.slice(last, m.index) }, { text: m[2] ?? m[1] }); last = m.index + m[0].length; }
      continue;
    }
    out.push({ text: src.slice(last, m.index) }, { text: m[2] ?? m[1] ?? m[3], id: entry.id });
    last = m.index + m[0].length;
  }
  out.push({ text: src.slice(last) });
  return out.filter((p) => p.text);
}

// Search: entries whose term, aliases or text match every word of the query; matches in the term first.
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
