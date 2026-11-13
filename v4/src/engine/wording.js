// B3-1: every piece of card wording is generated here, from the cards' ops (src/data/cards.js). Pure: no DOM.
//   effectText(effect)    a trigger's, Move mode's, Supporter's, Item's or Trainer Command's full sentence
//   shortModeText(mode)   a Move mode's short line on the card ("Heal 5, +1 Strength (kept)")
//   favourText(sup)       a Supporter's Favour line ("Heal 5 instead.")
//   passiveText(loc)      a Location's passive; heldText(item) a Held Item's rules; objectiveText(obj)
// An effect is a list of clauses { say, sep, ops }: `say` names the sentence pattern below, `sep` joins it to the
// clause before ('', '. ', ', and ', ', '), and `ops` are what the engine runs. tests/cardsdata.test.js checks the
// generated wording equals docs/base-game/cards.json word for word, for every Batch 1 and 2 card (B3-2).

export const KEYWORD_NAMES = {
  quickAttack: 'Quick Attack', infiltrator: 'Infiltrator', overrun: 'Overrun', shell: 'Shell', regenerate: 'Regenerate', retaliate: 'Retaliate', rage: 'Rage',
  drain: 'Drain', sturdy: 'Sturdy', agility: 'Agility', intimidate: 'Intimidate', stealth: 'Stealth', pickup: 'Pickup',
};
export const KEYWORD_ORDER = ['quickAttack', 'infiltrator', 'overrun', 'shell', 'regenerate', 'retaliate', 'rage', 'drain', 'sturdy', 'agility', 'intimidate', 'stealth', 'pickup'];
export const TRIGGER_NAMES = { summon: 'On Summon', attack: 'On Attack', defend: 'On Defend', defeated: 'On Defeated', knockout: 'On Knockout', breakfast: 'On Breakfast', dominate: 'On Dominate',
  command: 'On Command', supper: 'On Supper', aura: 'Aura' };
export const keywordText = (k, v) => (v === true || v === undefined ? KEYWORD_NAMES[k] : `${KEYWORD_NAMES[k]} ${v}`);

// The target phrases. `word` picks a shorter form some cards use ("each enemy", "one of yours").
const TARGET = {
  chosenEnemy: 'an enemy Pokémon', chosenOwn: { '': 'one of your Pokémon', yours: 'one of yours' },
  eachEnemy: { '': 'each enemy Pokémon', short: 'each enemy' }, eachEnemyHere: 'each enemy Pokémon in its Location',
  chosenLocEnemies: { '': 'each enemy Pokémon in a Location', short: 'each enemy in a Location' },
  oneOtherEnemyTargetLoc: 'another enemy Pokémon in the target\'s Location', otherEnemiesTargetLoc: 'each other enemy Pokémon in the target\'s Location',
  otherEnemiesItsLoc: 'each other enemy in its Location',
  eachOwn: { '': 'each of your Pokémon', yours: 'each of yours' }, eachOwnHere: { '': 'each of your Pokémon in its Location', your: 'your Pokémon in its Location' },
  // B3-2
  chosenOtherOwn: 'another of your Pokémon', defeater: 'the Pokémon that defeated it', thisCard: 'it', chosenActiveEnemy: 'an Active enemy Pokémon',
  acrossFromChosenOwn: 'the enemy across from one of your Pokémon',
  chosenLocOwn: 'each of your Pokémon in a Location', thereOwn: 'each of yours there',
  acrossEnemy: 'the enemy across from it', enemyPC: 'the enemy Player Character', attacker: 'the attacker',
  attacked: 'your Pokémon being attacked', attackerLocEnemies: 'each enemy Pokémon in the attacker\'s Location',
};
export const targetPhrase = (to, word = '') => { const t = TARGET[to]; return typeof t === 'string' ? t : t?.[word] ?? t?.[''] ?? to; };
// The subjects of "… gets +1 Attack until Supper" (and whether they take a plural verb).
const SUBJECT = {
  chosenOwn: ['One of your Pokémon', false], attacked: ['Your Pokémon being attacked', false], chosenEnemy: ['An enemy Pokémon', false],
  chosenLocEnemies: ['Each enemy Pokémon in a Location', false], eachOtherOwnHere: ['Your other Pokémon in its Location', true],
  eachOtherOwn: ['Your other Pokémon', true], attacker: ['The attacker', false], it: ['It', false], they: ['They', true],
  eachEnemy: ['Each enemy Pokémon', false],
};
const eachOwnSubject = (word) => (word === 'your' ? ['Your Pokémon', true] : ['Each of your Pokémon', false]);
export const subjectOf = (op) => (op.to === 'eachOwn' ? eachOwnSubject(op.word) : SUBJECT[op.to] ?? [op.to, false]);

const s = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const signed = (n) => (n < 0 ? `−${-n}` : `+${n}`);
const STAT = { attack: 'Attack', strength: 'Strength', tempAttack: 'Attack', tempStrength: 'Strength' };
// "+3 Attack and +2 Strength" from consecutive stat ops.
const stats = (ops) => ops.map((o) => `${signed(o.amount)} ${STAT[o.op]}`).join(' and ');

// A subject's predicates: consecutive Attack/Strength changes of one duration read as one ("gets +1 Attack and +1
// Strength until Supper"); the rest one each ("becomes Active").
function predicates(ops, plural) {
  const gets = plural ? 'get' : 'gets';
  const becomes = plural ? 'become' : 'becomes';
  const out = [];
  for (let i = 0; i < ops.length; i++) {
    const o = ops[i];
    if (o.op === 'attack' || o.op === 'strength') {
      const run = [o];
      while (ops[i + 1] && (ops[i + 1].op === 'attack' || ops[i + 1].op === 'strength')) run.push(ops[++i]);
      out.push(`${gets} ${stats(run)} (kept)`);
    } else if (o.op === 'tempAttack' || o.op === 'tempStrength') {
      const run = [o];
      while (ops[i + 1] && (ops[i + 1].op === 'tempAttack' || ops[i + 1].op === 'tempStrength')) run.push(ops[++i]);
      out.push(`${gets} ${stats(run)} until Supper`);
    } else if (o.op === 'shellTemp') out.push(`${gets} Shell ${o.amount} until Supper`);
    else if (o.op === 'activate') out.push(`${becomes} Active`);
    else if (o.op === 'spend') out.push(`${becomes} Spent`);
    else if (o.op === 'tempKeyword') out.push(`${gets} ${keywordText(o.keyword, o.amount)} until Supper`);
    else if (o.op === 'tempTrigger') out.push(`has "${TRIGGER_NAMES[o.trigger.on]}: ${effectText(o.trigger.effect)}"`);
    else out.push(o.op);
  }
  return out.join(' and ');
}

// The clause patterns. Each returns the clause as it reads at the start of a sentence.
export const SAY = {
  damage: ([o]) => `${o.amount} damage to ${targetPhrase(o.to, o.word)}${o.before ? ', before its attack' : ''}`,
  damageShort: ([o]) => `${o.amount} to ${targetPhrase(o.to, o.word)}`,
  heal: ([o]) => `Heal ${o.amount} to ${targetPhrase(o.to, o.word)}${o.before ? ', before the damage' : ''}`,
  healEach: ([o]) => `Heal ${o.amount} to each`,
  healKept: ([h, k]) => `Heal ${h.amount} and ${signed(k.amount)} ${STAT[k.op]} (kept) to ${targetPhrase(h.to, h.word)}`,
  kept: (ops) => `${stats(ops)} (kept)${ops[0].to === 'self' ? '' : ` to ${targetPhrase(ops[0].to, ops[0].word)}`}`,
  typeKept: ([o]) => `${o.stats.map((k) => `+${o.amount} ${STAT[k]}`).join(' and ')} (kept) for each other Type among your Pokémon, up to +${o.cap}`,
  subject: (ops) => { const [name, plural] = subjectOf(ops[0]); return `${name} ${predicates(ops, plural)}`; },
  energy: ([o]) => `+${o.amount} Energy this Round`,
  draw: ([o]) => `Draw ${s(o.amount, 'card', 'cards')}`,
  dollars: ([o]) => `Gain $${o.amount}`,
  recognition: ([o]) => `Gain ${o.amount} Recognition`,
  handLevels: ([o]) => (o.to === 'found' ? `It gains +${s(o.amount, 'Level', 'Levels')}` : `Each Pokémon card in your hand gains +${s(o.amount, 'Level', 'Levels')}`),
  search: ([o]) => `Put ${o.amount === 1 ? 'a Pokémon card' : `${o.amount} Pokémon cards`} from your ${o.op === 'recover' ? 'Discard Pile' : 'Draw Pile'} into your hand`,
  returnHand: ([o]) => `Return ${targetPhrase(o.to, o.word)} to your hand`,
  attackFizzles: () => 'The attack fizzles',
  reduce: ([o]) => `The attack deals ${o.amount} less damage (minimum 0)`,
  noDamage: () => 'The attack deals no damage',
  // B3-2
  reduceShort: ([o]) => `The attack deals ${o.amount} less damage`,
  returnHandLv: ([o]) => `Return ${targetPhrase(o.to, o.word)} to your hand with +${s(o.levels, 'Level', 'Levels')}`,
  returnDiscard: ([o]) => `Return ${o.amount === 1 ? 'a Pokémon card' : `${o.amount} Pokémon cards`} from your Discard Pile to your hand`,
  discardRandom: ([o]) => `The opponent discards ${o.amount === 1 ? 'a random card' : `${o.amount} random cards`}`,
  discardChosen: () => 'The opponent discards a card you choose',
  randomDiscardShort: () => 'A random discard',
  steal: () => 'Put a random card from the opponent\'s hand into yours',
  dollarsYou: ([o]) => `You gain $${o.amount}`,
  drawYou: ([o]) => `You draw ${s(o.amount, 'card', 'cards')}`,
  reviveSummon: ([o]) => `Summon a Pokémon of Level ${o.maxLevel} or less from your Discard Pile, for free`,
  pickDraw: ([o]) => `Put any ${o.amount} cards from your Draw Pile into your hand`,
  yoursTakes: ([o]) => `Yours takes ${o.amount} damage`,
  destinyBond: () => 'If your Pokémon being attacked is defeated, the attacker is defeated too',
  tempTrigger: ([o]) => `Until Supper, ${targetPhrase(o.to, o.word)} has "${TRIGGER_NAMES[o.trigger.on]}: ${effectText(o.trigger.effect)}"`,
  itsSpeed: () => 'Its Speed is one step higher until Supper',
  aura: (ops) => `Your other Pokémon in its Location have ${stats(ops)}`,
  heldStatKw: ([a, k]) => `+${a.amount} ${STAT[a.op]} and ${keywordText(k.keyword, k.amount)}`,
  locDrawOnDefeat: ([o]) => `When a Pokémon here is defeated, its owner draws ${s(o.amount, 'card', 'cards')}`,
  alsoTake: ([o]) => `They also take ${o.amount} damage`,
  // Held Items and Locations (passives).
  heldStat: ([o]) => `+${o.amount} ${STAT[o.op]}${o.noHitBack ? ', but it can\'t hit back' : ''}`,
  heldKeyword: ([o]) => keywordText(o.keyword, o.amount),
  heldTypeKeyword: ([o]) => `${/^[AEIOU]/.test(o.type) ? 'An' : 'A'} ${o.type} Pokémon also has ${keywordText(o.keyword, o.amount)}`,
  heldSpeed: () => 'Its Speed is one step higher',
  locStat: (ops) => (ops[0].maxLevel ? `Pokémon of Level ${ops[0].maxLevel} or less here have ${stats(ops)}` : `Pokémon here have ${stats(ops)}`),
  locKeyword: ([o]) => `Pokémon here have ${keywordText(o.keyword, o.amount)}`,
  locDiscount: ([o]) => `Summoning a Pokémon here costs ${o.amount} less (minimum 0)`,
  locHeal: ([o]) => `Pokémon here heal ${o.amount} at Breakfast`,
};
const LOWER_MID = /^(Heal|Draw|Gain|Return|Put|It|Its|They|You|Yours|A random)\b/;
// The full sentence(s) of an effect.
export function effectText(effect) {
  let out = '';
  for (const [i, c] of effect.entries()) {
    let t = SAY[c.say](c.ops);
    if (i && (c.sep === ', and ' || c.sep === ', ') && LOWER_MID.test(t)) t = t.charAt(0).toLowerCase() + t.slice(1);
    out += (i ? c.sep : '') + t;
  }
  // (A quoted trigger ends in its own full stop: 'has "On Defeated: … it."')
  return out.endsWith('"') ? out : `${out}.`;
}
export const effectOps = (effect) => effect.flatMap((c) => c.ops);

// A Move mode's short line on the card.
// B3-2: a few card lines use the game's other short forms; `style` (chosen by tools/buildcards.mjs to match the card,
// stored with the mode) picks them: abbr ("+1 Atk, +1 Str kept"), first ("+2 Strength first": before the attack).
export function shortModeText(effect, style = {}) {
  const ops = effectOps(effect);
  const A = style.abbr ? 'Atk' : 'Attack';
  const S = style.abbr ? 'Str' : 'Strength';
  const parts = [];
  ops.forEach((o, i) => {
    const prev = ops[i - 1];
    const next = ops[i + 1];
    const single = ops.filter((x) => x.op !== 'attackFizzles').length === 1;
    switch (o.op) {
      case 'damage': {
        if (o.to === 'theChosenOwn') { parts.push(`yours takes ${o.amount}`); break; }
        if (o.to === 'attacker' && i > 0) { parts.push(`${o.amount} to attacker`); break; }
        if (o.to === 'chosenActiveEnemy') { parts.push(`${o.amount} damage, Active enemy`); break; }
        const where = { eachEnemy: ' to all', chosenLocEnemies: ' in a Location', attackerLocEnemies: ' in its Location' }[o.to] ?? (o.to === 'attacker' && single ? ' to the attacker' : '');
        parts.push(`${o.amount} damage${where}`);
        break;
      }
      case 'heal':
        if (o.to === 'attacked' && o.before) parts.push(`Heal ${o.amount} first`);
        else parts.push(`heal ${o.amount}${o.to === 'eachOwn' && next?.to !== 'they' ? ' to all' : ''}`);
        break;
      case 'attack': parts.push(`+${o.amount} ${A}${next?.op === 'strength' ? '' : ' (kept)'}`); break;
      case 'strength': parts.push(o.to === 'they' ? `+${o.amount} ${S} to all` : prev?.op === 'attack' ? `+${o.amount} ${S} kept` : `+${o.amount} ${S} (kept)`); break;
      case 'tempAttack': parts.push(o.to === 'attacker' && single ? `The attacker gets ${signed(o.amount)} Attack` : `${signed(o.amount)} Attack`); break;
      case 'tempStrength': parts.push(`${signed(o.amount)} Strength${style.first ? ' first' : ''}`); break;
      case 'reduce': parts.push(effect.some((c) => c.say === 'reduceShort') ? `−${o.amount} damage` : `The attack deals ${o.amount} less`); break;
      case 'tempKeyword': parts.push(`${keywordText(o.keyword, o.amount)} until Supper`); break;
      case 'returnDiscard': parts.push(`recover ${o.amount}`); break;
      case 'destinyBond': parts.push('Attacker falls with it'); break;
      case 'tempTrigger': parts.push(`${TRIGGER_NAMES[o.trigger.on].replace(/^On /, '')}: ${shortModeText(o.trigger.effect).replace(/^(\d+ damage).*/, '$1')} back`); break;
      case 'dollars': parts.push(`Gain $${o.amount}`); break;
      case 'discardRandom': parts.push('They discard at random'); break;
      case 'steal': parts.push('Take a random card'); break;
      case 'activate': parts.push('Active'); break;
      case 'spend': parts.push(o.to === 'chosenEnemy' ? 'An enemy becomes Spent' : o.to === 'chosenLocEnemies' ? 'Spend all in a Location' : 'Spent'); break;
      case 'shellTemp': parts.push(`Shell ${o.amount} until Supper`); break;
      case 'noDamage': parts.push('No damage from the attack'); break;
      case 'returnHand': parts.push(o.to === 'attacked' ? 'Save it: back to your hand' : 'Back to your hand'); break;
      case 'draw': parts.push(`draw ${o.amount}`); break;
      case 'attackFizzles': break;
      default: parts.push(o.op);
    }
  });
  const line = parts.join(', ');
  return line.charAt(0).toUpperCase() + line.slice(1);
}

// A Supporter's Favour line, from what it changes in (or adds to) the effect.
export const FAVOUR_RELEASE = { water: 'a Water Pokémon', fire: 'a Fire Pokémon', grass: 'a Grass Pokémon', electric: 'an Electric Pokémon', location: 'a Location',
  bigPokemon: 'a Pokémon of Level 4 or more', item: 'an Item', move: 'a Move',
  fighting: 'a Fighting Pokémon', dark: 'a Dark Pokémon', psychic: 'a Psychic Pokémon', ghost: 'a Ghost Pokémon' };
function changeWord(o) {
  switch (o.op) {
    case 'heal': return `Heal ${o.amount}`;
    case 'draw': return `Draw ${o.amount}`;
    case 'search': case 'recover': case 'pickDraw': case 'discardRandom': return `${o.amount} cards`;
    case 'dollars': return `Gain $${o.amount}`;
    case 'reviveSummon': return `Level ${o.maxLevel} or less`;
    case 'strength': return `+${o.amount} Strength`;
    case 'attack': return `+${o.amount} Attack`;
    case 'tempAttack': return `${signed(o.amount)} Attack`;
    case 'handLevels': return `+${s(o.amount, 'Level', 'Levels')}`;
    case 'damage': return `${o.amount} damage`;
    case 'shellTemp': return `Shell ${o.amount}`;
    case 'tempKeyword': return `${keywordText(o.keyword, o.amount)} until Supper`;
    default: return o.op;
  }
}
export function favourDiff(base, favour) {
  const a = effectOps(base);
  const b = effectOps(favour);
  const changed = [];
  for (const [i, o] of a.entries()) if (b[i] && JSON.stringify(b[i]) !== JSON.stringify(o)) changed.push(b[i]);
  return { changed, added: b.slice(a.length) };
}
export function favourText(sup) {
  const { changed, added } = favourDiff(sup.effect, sup.favour.effect);
  // B3-2: Officer Jenny's "They also take 1 damage."
  if (!changed.length && added.length === 1 && added[0].op === 'damage' && added[0].to === 'they') return `They also take ${added[0].amount} damage.`;
  if (added.length) return `${[...changed, ...added].map((o, i) => (i === changed.length + added.length - 1 && i ? `and ${changeWord(o)}` : changeWord(o))).join(', ')}.`;
  if (changed.length === 2 && changed.every((o) => o.op === 'damage')) return `${changed[0].amount} and ${changed[1].amount} instead.`;
  if (changed.length === 2 && changed[0].op === 'attack' && changed[1].op === 'strength') return `+${changed[0].amount} and +${changed[1].amount} instead.`;
  return `${changed.map(changeWord).join(', ')} instead.`;
}

// A Held Item's rules, a Location's passive, an Objective.
export const passiveText = (passive) => effectText(passive);
export const objectiveText = (o) => ({
  defeat: `Defeat ${o.need} enemy Pokémon.`,
  dominate: `Dominate a Location ${o.need} times.`,
  keptGain: `Give your Pokémon kept Attack or Strength ${o.need} times.`,
  extraEnergy: `Gain ${o.need} extra Energy from your cards.`,
  itemsBought: `Buy ${o.need} Items from the PokéMart.`,
  movesPlayed: `Play ${o.need} Moves as Adapt or Strat.`,
  survived: `Your Pokémon survive ${o.need} enemy attacks.`,
  discardReturned: `Return ${o.need} cards from your Discard Pile.`,
  pcDamaged: `Damage the enemy Player Character ${o.need} times.`,
}[o.op] ?? o.op);
// A trigger in one line: "On Summon: 1 damage to an enemy Pokémon."
export const triggerLine = (t) => (t ? `${TRIGGER_NAMES[t.on]}: ${effectText(t.effect)}` : '');
