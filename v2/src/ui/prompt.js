// The prompt bar (v2 Feedback B; docs/design/v2-info-A2.jpg and v2-info-C.jpg): it always says
// what the current step is and the options actually available now, so the player knows what
// they can do, what they must do, and why. It turns gold for a choice in progress, with Cancel
// when allowed. Pure: promptFor(view, ui, ctx) → { tag, text, short, gold, buttons }.
// `text` is HTML (names in <b>); `short` is the Minimal hints version.
import {
  legalActions, alertSpaces, legalTargets, passEndsPhase, passSpends, playable, placeable, playableStrategies,
  playableSupporters, playableItems, playableTrainers, usableBagItems, usableAbilities, nurtureSpaces, canMoveTrainer,
  targetOptions, freeSpaces, choiceCards,
} from '../engine/game.js';
import { whyNot, opsVerb, strategyVersions } from '../engine/explain.js';
import { RECOGNITION_TARGET, ROUND_LIMIT } from '../engine/rules.js';
import { FAVOURS } from '../engine/cardtypes.js';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const b = (s) => `<b>${esc(s)}</b>`;
const list = (items, joiner = 'or') => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} ${joiner} ${items.at(-1)}`);
const names = (cards) => [...new Set(cards.map((c) => c.name))];
const CANCEL = { action: 'cancel', label: 'Cancel' };

// What a target spec asks for, in words.
export function targetWords(spec) {
  if (!spec) return '';
  const pokemon = spec.kinds.includes('pokemon');
  const player = spec.kinds.includes('player');
  const location = spec.kinds.includes('location');
  if (spec.side === 'enemy') return [pokemon && 'an enemy Pokémon', player && 'the enemy player (their Recognition panel)', location && 'a Location'].filter(Boolean).join(' or ');
  return [pokemon && 'one of your Pokémon', player && 'yourself (your Recognition panel)', location && 'a Location (or a Home lane)'].filter(Boolean).join(' or ');
}

// The step in progress, for the gold bar: { tag, text, buttons }.
function choiceStep(v, ui) {
  const me = v.players.player;
  const pend = ui.pending;
  if (pend) {
    const n = pend.spec.count === 1 ? 1 : pend.spec.count;
    const k = (pend.chosen?.length ?? 0) + 1;
    const head = pend.title ?? pend.label.split(':')[0];
    const what = pend.label.includes(':') ? pend.label.slice(pend.label.indexOf(':') + 1).trim() : opsVerb(pend.ops);
    const step = n === 1 ? `Choose ${b('a target')}` : `Choose ${b(`target ${Math.min(k, n)} of ${n}`)}`;
    const buttons = [...(n !== 1 ? [{ action: 'targets-done', label: `Confirm (${pend.chosen.length})`, disabled: !pend.chosen.length }] : []),
      ...(pend.action.type === 'chooseTarget' ? [] : [CANCEL])];
    return { tag: pend.tag ?? head, text: `${step}: ${esc(what)} · ${esc(targetWords(pend.spec))}${n !== 1 ? ', then Confirm' : ''}`, buttons };
  }
  const ask = ui.ask;
  if (ask) {
    const card = (uid) => me.hand.find((c) => c.uid === uid);
    switch (ask.kind) {
      case 'release': {
        const c = card(ask.uid);
        return { tag: `${c?.name} · Release ${c?.release}`, text: `Choose ${b(`${c?.release} card${c?.release === 1 ? '' : 's'}`)} from your hand to Release (gone for the match). ${c?.favour ? `Favour: Release ${esc(FAVOURS[c.favour.condition].text)} for the better effect.` : ''}`, buttons: [CANCEL] };
      }
      case 'item': { const c = card(ask.uid); return { tag: `${c?.name} · ${c?.cost} Energy`, text: `Use it now, or put it in your ${b('Bag')} to use later for 0 Energy.`, buttons: [CANCEL] }; }
      case 'amount': return { tag: ask.label.split(':')[0], text: `Choose how much ${b('Growth')} to spend (1 to ${ask.max}): 1 damage each.`, buttons: [CANCEL] };
      case 'pick': return ask.choice
        ? { tag: ask.label.split(':')[0], text: `Choose ${b(`${ask.n} of the ${ask.total} cards`)} to put in your hand; the rest go to the bottom of your Draw Pile. (The play is final now that they're revealed.)`, buttons: [] }
        : { tag: ask.label.split(':')[0], text: `Choose ${b(ask.n === 1 ? 'a card' : `up to ${ask.n} cards`)}, then Done.`, buttons: [] };
      case 'space': return { tag: ask.label.split(':')[0], text: `Choose ${b('an empty space')} to move it to.`, buttons: [CANCEL] };
      case 'trainer': { const t = me.trainers.find((x) => x.uid === ask.uid); return { tag: t?.name ?? 'Trainer', text: `Use ${b('its Ability')} or ${b('move it')} (once per Round), or close.`, buttons: [] }; }
      default: return null;
    }
  }
  if (ui.empowerAsk) { const c = me.hand.find((x) => x.uid === ui.empowerAsk.uid); return { tag: `${c?.name} · Empowered?`, text: `Summon it plainly, or ${b('Empowered')} for more Energy: ${esc(c?.empower?.text ?? '')}.`, buttons: [CANCEL] }; }
  if (ui.summon) {
    const c = me.hand.find((x) => x.uid === ui.summon);
    return { tag: `${c?.name} · ${c?.cost} Energy`, text: `Choose ${b('an empty space')} in your row (glowing) to summon it · ▲ ▼ show its other Levels.`, buttons: [CANCEL] };
  }
  if (ui.location) {
    const c = me.hand.find((x) => x.uid === ui.location);
    return { tag: `${c?.name} · Location`, text: `Choose ${b('a glowing lane')}: it covers that lane and the ${c?.lanes > 1 ? `${c.lanes - 1} to its right` : 'one only'}, on both sides.`, buttons: [CANCEL] };
  }
  if (ui.strategy) {
    const c = me.hand.find((x) => x.uid === ui.strategy);
    if (c) {
      const sv = strategyVersions(v, 'player', c, ui.version?.[c.uid]);
      const shown = sv.versions[sv.shown];
      return { tag: `${c.name} · ${shown.cost} Energy`, text: sv.can ? `Click it again (or Play) for this version: ${esc(shown.text)} · ▲ ▼ show the others.` : `${esc(shown.why ?? 'Not playable now')} · ▲ ▼ show the other versions.`,
        buttons: [...(sv.can ? [{ action: 'play-strategy', label: `Play (${shown.cost})` }] : []), CANCEL] };
    }
  }
  if (ui.trainer) { const c = me.hand.find((x) => x.uid === ui.trainer); return { tag: `${c?.name} · ${c?.cost} Energy`, text: `Choose ${b('one of your spaces')} (glowing) to attach the Trainer; a Pokémon may stand there too.`, buttons: [CANCEL] }; }
  if (ui.moveTrainer) { const t = me.trainers.find((x) => x.uid === ui.moveTrainer); return { tag: `Move ${t?.name}`, text: `Choose ${b('one of your spaces without a Trainer')} (once per Round).`, buttons: [CANCEL] }; }
  if (ui.attacker !== null && ui.attacker !== undefined) {
    const c = me.row[ui.attacker];
    const targets = legalTargets(v, 'player', ui.attacker);
    const player = targets.some((t) => t.kind === 'player');
    return { tag: `${c?.name} attacks`, text: `Choose ${b('a glowing target')}: an enemy Pokémon${player ? ' or the Opponent (their Recognition panel)' : ` (the Opponent is ${b('guarded')} across from it)`}. An Alert target hits back.`, buttons: [CANCEL] };
  }
  return null;
}

// Your turn with nothing in progress: the options you actually have now.
function turnOptions(v) {
  const me = v.players.player;
  const legal = legalActions(v, 'player');
  const opts = [];
  const attackers = alertSpaces(v, 'player').filter((s) => legalTargets(v, 'player', s).length).map((s) => me.row[s].name);
  if (attackers.length) opts.push(`attack with ${list(names(attackers.map((name) => ({ name }))).map(b))} (glowing)`);
  const cards = [...playable(v, 'player'), ...placeable(v, 'player'), ...playableStrategies(v, 'player'), ...playableSupporters(v, 'player'), ...playableItems(v, 'player'), ...playableTrainers(v, 'player')];
  if (cards.length) opts.push(cards.length === 1 ? `play ${b(cards[0].name)} (glowing)` : 'play a glowing card');
  const bag = usableBagItems(v, 'player');
  if (bag.length) opts.push(`use ${list(names(bag).map(b))} from your Bag`);
  const abilities = usableAbilities(v, 'player');
  if (abilities.length) opts.push(`use ${list(abilities.map((t) => `${b(t.name)}'s Ability`))}`);
  if (legal.includes('placePartner')) opts.unshift(`place ${b(me.waiting[0].name)}, ${esc(me.waiting[0].trainer)}'s Partner, in a free space (glowing green)`);
  if (nurtureSpaces(v, 'player').length) opts.push(b('Nurture'));
  if (canMoveTrainer(v, 'player') && opts.length) opts.push('move a Trainer');
  const ends = passEndsPhase(v);
  const spends = passSpends(v, 'player').length;
  const pass = ends ? `${b('Pass')} to end the Battle Phase` : `${b('Pass')} for +1 Energy${spends ? ` (${spends} of yours become${spends === 1 ? 's' : ''} Spent)` : ''}`;
  if (!opts.length) {
    // Pass is the only option: say so, and why.
    const blocked = me.hand.map((c) => whyNot(v, 'player', c)).filter(Boolean);
    const why = [!me.hand.length ? 'your hand is empty' : blocked.length ? `no card can be played (${esc(mostCommon(blocked))})` : '',
      !me.row.some(Boolean) ? 'you have no Pokémon in play' : !alertSpaces(v, 'player').length ? 'none of your Pokémon is Alert' : ''].filter(Boolean).join(', and ');
    return { text: `Only ${pass}${why ? `: ${why}.` : '.'}`, short: `Only ${pass}.` };
  }
  return { text: `${capital(list(opts))} — or ${pass}`, short: `${capital(list(opts.map((o) => o.replace(/ \(glowing.*?\)/, ''))))} — or ${pass}` };
}
const capital = (s) => s.replace(/^(<b>)?(.)/, (m, tag, c) => `${tag ?? ''}${c.toUpperCase()}`);
const mostCommon = (arr) => {
  const n = new Map();
  for (const x of arr) n.set(x, (n.get(x) ?? 0) + 1);
  return [...n].sort((a, c) => c[1] - a[1])[0][0];
};

export function promptFor(v, ui = {}, ctx = {}) {
  if (!v) return { tag: '', text: '', short: '', gold: false, buttons: [] };
  const me = v.players.player;
  if (v.phase === 'initiative') return { tag: 'New match', text: `Flip the coin to decide who has initiative in Round 1. Reach ${b(RECOGNITION_TARGET)} Recognition, or have the most after Round ${ROUND_LIMIT}.`, short: 'Flip the coin.', gold: false, buttons: [{ action: 'flip', label: 'Flip the coin' }] };
  if (v.phase === 'gameOver') return { tag: v.winner === 'player' ? 'Victory' : v.winner ? 'Defeat' : 'Draw', text: esc(ctx.resultLine ?? 'Match over.'), short: esc(ctx.resultLine ?? 'Match over.'), gold: false, buttons: [] };
  // A waiting choice of yours (On Evolve, Tracey): gold.
  const choice = v.choices?.[0];
  if (choice?.who === 'player' && choice.kind === 'pick') {
    const n = choiceCards(v, choice).length;
    return { tag: `${choice.name} · revealed`, text: `Choose ${b(`${choice.take} of the ${n} cards`)} to put in your hand; the rest go to the bottom of your Draw Pile.`, short: `Choose ${choice.take} cards.`, gold: true, buttons: [] };
  }
  const step = choiceStep(v, ui);
  if (step) return { ...step, short: step.text, gold: true };
  if (choice && choice.who !== 'player') return { tag: 'Opponent\'s turn', text: `The Opponent is choosing a target for ${esc(choice.name)}…`, short: 'Opponent is choosing…', gold: false, buttons: [] };
  if (v.phase === 'assign') {
    if (legalActions(v, 'player').includes('assignPoints')) return { tag: 'Breakfast', text: `Assign your ${b(me.trainerPoints)} Trainer Point${me.trainerPoints === 1 ? '' : 's'} to your Trainers, then ${b('Lock in')}. The Opponent assigns theirs at the same time, hidden until you both lock in.`, short: 'Assign your Trainer Points, then Lock in.', gold: true, buttons: [] };
    return { tag: 'Breakfast', text: 'The Opponent is assigning their Trainer Points…', short: 'Opponent is choosing…', gold: false, buttons: [] };
  }
  if (v.phase === 'battle' && v.turn === 'player' && !ui.locked) {
    const o = turnOptions(v);
    return { tag: 'Your turn', text: o.text, short: o.short, gold: false, buttons: [] };
  }
  if (ctx.autoplay) return { tag: 'Autoplay', text: 'The AI plays both sides.', short: 'Autoplay.', gold: false, buttons: [] };
  if (v.phase === 'battle' && v.turn === 'player') return { tag: 'Your turn', text: 'Showing what just happened…', short: '…', gold: false, buttons: [] };
  return { tag: 'Opponent\'s turn', text: 'The Opponent is choosing…', short: 'Opponent is choosing…', gold: false, buttons: [] };
}

export { freeSpaces, targetOptions };
