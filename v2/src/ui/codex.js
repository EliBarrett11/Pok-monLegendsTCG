// The Codex (v2 Feedback B; docs/design/v2-info-B.jpg): right-click anything (or hover it and
// press Space) and a panel opens over the side panel. The board stays visible and the match
// carries on; Esc or ✕ closes it. Every game term in any text links to its rule (the glossary,
// engine/glossary.js), with Back and breadcrumbs, and a search over every rule and keyword.
//
// Entries (a ref string, e.g. "mon:ai:3"):
//   card:<uid>             a card you can see (hand, piles, Bag), by uid
//   def:<id>[:<cap>]       a card by id (the deck builder, the Partner of a Trainer…)
//   mon:<who>:<space>      a Pokémon in play: series ladder, where its numbers come from,
//                          keywords, abilities, statuses, Held Item, when it was played
//   loc:<uid> · trainer:<who>:<uid> · champ
//   rec:<who> (Recognition history) · energy:<who> (this Round's sources) · weather
//   pile:<who>:<draw|discard|released> · bag:<who> · log (the whole log) · log:<i>
//   term:<id> (a rule or keyword) · rules (the glossary, searchable)
// codexEntry(view, ref) is pure (Node can call it: tests/info.test.js); the panel is DOM.
import { GLOSSARY, WEATHER_BRACKETS, glossaryEntry, termsIn, searchGlossary } from '../engine/glossary.js';
import { statParts, weatherTotals, bracket, tiersUnlocked, summonCost, championship, champRoundOf, targetOf } from '../engine/game.js';
import { cardDef } from '../engine/cards.js';
import { seriesDef, pokemonAt, stagesText } from '../engine/series.js';
import { costRange, FAVOURS } from '../engine/cardtypes.js';
import { rewardText, lastsText, CHAMPIONSHIP } from '../engine/locations.js';
import { ROUND_LIMIT, MAX_BASE_ENERGY } from '../engine/rules.js';

const ASSETS = '../assets';
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const sideName = (who) => (who === 'player' ? 'You' : 'The Opponent');
const sideOwn = (who) => (who === 'player' ? 'Your' : 'The Opponent\'s');

// Text with every game term linked to its rule (skip: the entry being read).
export function linked(text, skip = null) {
  return termsIn(text, skip).map((p) => (p.id ? `<a class="v2-term" data-term="${p.id}">${esc(p.text)}</a>` : esc(p.text))).join('');
}
const ref = (r, label) => `<a class="v2-cref" data-codex-ref="${esc(r)}">${esc(label)}</a>`;
const section = (title, body) => (body ? `<section><h5>${esc(title)}</h5>${body}</section>` : '');
const rows = (list) => `<table class="v2-crows">${list.map(([a, b, cls]) => `<tr${cls ? ` class="${cls}"` : ''}><td>${a}</td><td>${b}</td></tr>`).join('')}</table>`;
const sign = (n) => (n > 0 ? `+${n}` : `${n}`);

function artOf(card) {
  if (!card) return null;
  if (card.cardType === 'Pokémon') return card.art === null ? `${ASSETS}/ui/frame-pokemon.jpg` : `${ASSETS}/cards/${card.art ?? card.id}.jpg`;
  if (card.cardType === 'Location') return card.image ? `${ASSETS}/${card.image.replace(/^assets\//, '')}` : `${ASSETS}/cards/${card.art ?? card.id}.jpg`;
  return card.art ? `${ASSETS}/cards/${card.art}.jpg` : `${ASSETS}/ui/frame-item.jpg`;
}
const head = (card, title, lines) => `<div class="v2-chead">${card ? `<i class="v2-cart" style="background-image: url('${artOf(card)}')"></i>` : ''}
  <div><h3>${esc(title)}</h3>${lines.filter(Boolean).map((l) => `<p>${l}</p>`).join('')}</div></div>`;

// Keyword chips summed (Scorch 1 + Scorch 1 = Scorch 2), as on the board.
export function keywordList(card) {
  const sums = new Map();
  for (const k of card.keywords ?? []) {
    const m = /^(.*) (\d+)$/.exec(k);
    const name = m ? m[1] : k;
    sums.set(name, m ? (sums.get(name) ?? 0) + Number(m[2]) : 0);
  }
  return [...sums].map(([name, n]) => ({ name, label: n ? `${name} ${n}` : name }));
}
function keywordBoxes(card) {
  return keywordList(card).map(({ name, label }) => {
    const g = glossaryEntry(name);
    return g ? `<div class="v2-cbox"><h6>${esc(label)}</h6><p>${linked(g.text, g.id)}</p></div>` : '';
  }).join('');
}

// The series ladder: each Level's species, the current one lit, Levels above the cap dim.
function ladder(card, current) {
  if (!card.series || card.legendary) return '';
  const line = seriesDef(card.series);
  const cells = Array.from({ length: line.maxLevel }, (_, i) => {
    const lv = i + 1;
    const at = pokemonAt(line, lv);
    const cls = [lv === current && 'on', lv > (card.cap ?? line.maxLevel) && 'over'].filter(Boolean).join(' ');
    return `<div class="${cls}" title="Level ${lv}: ${esc(at.name)} · ${at.attack}/${at.strength} · cost ${at.cost}"><b>${lv}</b><span>${esc(at.name)}</span></div>`;
  }).join('');
  return section(`Series · cap ${card.cap ?? line.maxLevel}`, `<div class="v2-cladder">${cells}</div><p class="v2-cnote">${esc(stagesText(line))} · ${esc(line.weight)} · Level = the Round, up to its cap; fixed once played.</p>`);
}

function typeLine(card) {
  const line = card.series ? seriesDef(card.series) : null;
  return [card.type, card.attackType, card.speed, card.rarity ?? line?.rarity, card.legendary ? 'Legendary' : line && line.weight !== 'standard' ? line.weight : null,
    card.strengthType !== 'Hitpoints' ? `${card.strengthType} guard` : null].filter(Boolean).map((t) => linked(t)).join(' · ');
}

function abilities(card) {
  const out = [];
  if (card.ability?.text) out.push(`<p>${linked(card.ability.text)}</p>`);
  if (card.empower) out.push(`<p><b>${linked('Empowered summon')}</b> (+${card.empower.cost} Energy): ${linked(card.empower.text)}</p>`);
  if (card.retain) out.push(`<p>${linked('Retain')}</p>`);
  if (card.weather) out.push(`<p>Carries ${Object.entries(card.weather).map(([k, n]) => `${n} ${linked(k)}`).join(' and ')} while in play.</p>`);
  return out.join('');
}

function statusLines(card) {
  const out = [];
  if (card.burn) out.push(`${linked('Burn')} ${card.burn} (−${card.burn} Strength at Supper, then 1 less)`);
  if (card.asleep) out.push(`${linked('Asleep')}: stays Spent next Breakfast, then wakes`);
  if (card.seededBy) out.push(`${linked('Leech Seeded')} (1 damage at Supper, healing the seeder)`);
  return out;
}

// --- Entries ---------------------------------------------------------------------------------------

function pokemonInPlay(v, who, space) {
  const card = v.players[who]?.row[space];
  if (!card) return null;
  const parts = statParts(v, who, space);
  const top = card.series ? Math.min(card.cap ?? 6, 6) : card.level;
  const lines = [
    typeLine(card),
    `${who === 'player' ? 'Yours' : 'The Opponent\'s'} · ${card.partner ? `${esc(card.trainer)}'s ${linked('Partner')}, arrived` : 'played'} at <b>Level ${card.level}</b> in Round ${card.arrivedRound ?? '?'}${card.legendary ? '' : card.level < top ? ` · it can still ${linked('train')} to Level ${top}` : ' · its Level is now fixed'}.`,
    `${card.spent ? (card.asleep ? linked('Asleep') : linked('Spent')) : linked('Active')}${card.empowered ? ` · ${linked('Empowered')}` : ''}`,
    ...statusLines(card).map((s) => `Status: ${s}`),
    card.held ? `Holding ${ref(`def:${card.held.id}`, card.held.name)}: ${linked(card.held.text)}` : '',
  ];
  const numbers = (stat, label, total) => [[`<b>${label}</b>`, `<b>${total}</b>`, 'sum'], ...parts.parts[stat].map((x) => [esc(x.label), sign(x.amount)])];
  const str = card.currentStrength < card.strength ? `${card.currentStrength} of ${card.strength}` : `${card.strength} of ${card.strength}`;
  return {
    title: card.name,
    html: head(card, card.name, lines)
      + ladder(card, card.level)
      + section('Where its numbers come from', rows([...numbers('attack', `⚔ ${card.attackType} Attack`, card.attack), ...numbers('strength', `♥ ${card.strengthType === 'Hitpoints' ? 'Strength' : card.strengthType}`, str)]))
      + section('Abilities', abilities(card))
      + keywordBoxes(card),
  };
}

function cardEntry(v, card, where) {
  const title = card.name;
  switch (card.cardType) {
    case 'Pokémon': {
      const line = card.series ? seriesDef(card.series) : null;
      const lines = [typeLine(card),
        card.legendary ? `${linked('Legendary')}: a single card · cost ${card.cost}` : `Level ${card.level}${where === 'hand' ? ' now (the Round, up to its cap)' : ''} · ${linked('cap')} ${card.cap ?? line?.maxLevel} · cost ${v && where === 'hand' ? summonCost(card, false) : card.cost} Energy`,
        `⚔ ${card.attack} ${card.attackType} · ♥ ${card.strength} ${card.strengthType}`,
        where ? `In ${esc(where)}` : ''];
      return { title, html: head(card, title, lines) + ladder(card, card.level) + section('Abilities', abilities(card)) + keywordBoxes(card) };
    }
    case 'Strategy': {
      const energy = v?.players.player.energy;
      const list = card.breakpoints.map((b) => `<li class="${energy !== undefined && b.cost > energy ? 'dim' : ''}"><b>${b.cost} Energy:</b> ${linked(b.text)}${energy !== undefined && b.cost > energy ? ` <em>· needs ${b.cost}</em>` : ''}</li>`).join('');
      return { title, html: head(card, title, [`${linked('Strategy Card')} · ${card.rarity} · cost ${costRange(card)}`, card.retain ? linked('Retain') : '', where ? `In ${esc(where)}` : ''])
        + section(`${plural(card.breakpoints.length, 'breakpoint')}`, `<ul class="v2-clist">${list}</ul><p class="v2-cnote">${linked('Breakpoint')}s: pay one of these amounts; more Energy, a bigger effect.</p>`) };
    }
    case 'Supporter':
      return { title, html: head(card, title, [`${linked('Supporter')} · ${card.rarity} · ${linked('Release')} ${card.release} other card${card.release === 1 ? '' : 's'} from your hand`, where ? `In ${esc(where)}` : ''])
        + section('Effect', `<p>${linked(card.text)}</p>`)
        + section('Favour', `<p>If you Release ${linked(FAVOURS[card.favour.condition].text)}: ${linked(card.favour.text)}</p><p class="v2-cnote">${linked(glossaryEntry('favour').text, 'favour')}</p>`) };
    case 'Item': {
      const held = card.kind === 'Held';
      return { title, html: head(card, title, [`${linked('Item')} · ${linked(card.kind)} · ${card.rarity ?? ''} · cost ${card.cost} Energy (0 from the ${linked('Bag')})`, where ? `In ${esc(where)}` : ''])
        + section('Effect', `<p>${linked(card.text)}</p>${held ? '<p class="v2-cnote">Held: attach it to one of your Pokémon; it stays while that Pokémon is in play.</p>' : ''}`)
        + keywordBoxes({ keywords: card.held?.keywords ?? [] }) };
    }
    case 'Trainer':
      return trainerHtml(null, card, where);
    case 'Location':
      return { title, html: head(card, title, [`${linked('Location')} · ${plural(card.lanes, 'lane')} · ${esc(lastsText(card.rounds))} · costs no Energy`, weatherLine(card.weather), where ? `In ${esc(where)}` : ''])
        + section('Objective', `<p>${linked(card.objective.text)}</p>`)
        + section('Rewards', rows([...card.milestones.map((m) => [`Milestone ${m.at}`, linked(rewardText(m.reward))]), [`Completed (${card.objective.count})`, linked(rewardText(card.completion))]])) };
    default: return { title, html: head(card, title, []) };
  }
}
const weatherLine = (w = {}) => {
  const list = Object.entries(w ?? {}).filter(([, n]) => n);
  return list.length ? `${linked('Weather')}: ${list.map(([k, n]) => `${linked(k)} ${n}`).join(' · ')}` : '';
};

function trainerHtml(v, t, where, who) {
  const lit = t.points !== undefined ? tiersUnlocked(t) : 0;
  const inPlay = t.points !== undefined;
  const tiers = t.tiers.map((x, i) => {
    const partner = x.partner ? ` ${x.partner.series ? ref(`def:${x.partner.series}`, 'see the Partner') : ''}` : '';
    const ab = x.ability ? ` <em>(${x.ability.cost} Energy, once per Round)</em>` : '';
    return `<li class="${inPlay && i < lit ? 'on' : ''}"><b>${x.cost} · ${linked(x.kind)}</b>${ab}: ${linked(x.text)}${partner}${inPlay ? (i < lit ? ' <em>· unlocked</em>' : ` <em>· ${x.cost - t.points} more</em>`) : ''}</li>`;
  }).join('');
  const lines = [`${linked('Trainer')} · ${t.rarity ?? ''} · cost ${t.cost} Energy`,
    inPlay ? `${sideOwn(who)} · space ${t.space + 1} · ${t.points}/${t.tiers[2].cost} ${linked('Trainer Points')}` : '',
    inPlay && v ? `Ability ${t.abilityRound === v.round ? 'used this Round' : 'not used this Round'} · move ${v.players[who].movedTrainer ? 'used' : 'available'} this Round` : '',
    where ? `In ${esc(where)}` : ''];
  return { title: t.name, html: head(t, t.name, lines) + section('Tiers', `<ul class="v2-clist">${tiers}</ul><p class="v2-cnote">${linked(glossaryEntry('tier').text, 'tier')}</p>`) };
}

function locationInPlay(v, uid) {
  const loc = v.locations.find((l) => l.uid === uid);
  if (!loc) return null;
  const prog = (who) => `${loc.progress[who]}/${loc.objective.count}${loc.completed[who] ? ' ✓ completed' : ''}${loc.reached[who].length ? ` · milestones ${loc.reached[who].join(', ')}` : ''}`;
  const rewardRow = (label, reward, at) => [label, `${linked(rewardText(reward))}${at !== undefined ? ['player', 'ai'].filter((w) => (at === 'done' ? loc.completed[w] : loc.reached[w].includes(at))).map((w) => ` <em>· ${w === 'player' ? 'you' : 'opp.'} ✓</em>`).join('') : ''}`];
  return {
    title: loc.name,
    html: head(loc, loc.name, [`${linked(loc.championship ? 'Championship' : 'Location')} · lanes ${loc.lanes[0] + 1}–${loc.lanes.at(-1) + 1} · ${plural(loc.roundsLeft, 'Round')} left${loc.owner ? ` · placed by ${sideName(loc.owner)} in Round ${loc.placedRound}` : ''}`, weatherLine(loc.weather)])
      + section('Objective', `<p>${linked(loc.objective.text)}</p>${rows([['You', prog('player')], ['Opponent', prog('ai')]])}`)
      + section('Rewards', rows([...loc.milestones.map((m) => rewardRow(`Milestone ${m.at}`, m.reward, m.at)), rewardRow(`Completed (${loc.objective.count})`, loc.completion, 'done')]))
      + `<p class="v2-cnote">${linked(glossaryEntry('location').text, 'location')}</p>`,
  };
}

function champEntry(v) {
  const live = v && championship(v);
  if (live) return { ...locationInPlay(v, live.uid), title: 'The Championship' };
  const at = v ? champRoundOf(v) : 9;
  return {
    title: 'The Championship',
    html: head(null, 'The Championship', [`Arrives at the start of <b>Round ${at}</b>${v?.round ? ` · in ${plural(Math.max(0, at - v.round), 'Round')}` : ''} · runs to the end of Round ${ROUND_LIMIT}`])
      + section('Objective', `<p>${linked(CHAMPIONSHIP.objective.text)} (over all 9 lanes)</p>`)
      + section('Rewards', rows([...CHAMPIONSHIP.milestones.map((m) => [`Milestone ${m.at}`, linked(rewardText(m.reward))]), [`Completed (${CHAMPIONSHIP.objective.count})`, linked(rewardText(CHAMPIONSHIP.completion))]]))
      + `<p class="v2-cnote">${linked(glossaryEntry('championship').text, 'championship')}</p>`,
  };
}

function recognitionEntry(v, who) {
  const p = v.players[who];
  const hist = p.recHistory ?? [];
  const by = new Map();
  for (const h of hist) by.set(h.source, (by.get(h.source) ?? 0) + h.amount);
  const list = [...hist].reverse().map((h) => [`Round ${h.round} · ${linked(h.source)}`, `${sign(h.amount)}${h.total !== undefined ? ` <em>→ ${h.total}</em>` : ''}`, h.amount < 0 ? 'loss' : '']);
  return {
    title: `${sideOwn(who)} Recognition`,
    html: head(null, `${sideOwn(who)} Recognition`, [`<b class="v2-cbig">${p.recognition}</b> of ${targetOf(v)} to win${p.burn ? ` · ${linked('Burn')} ${p.burn} on ${who === 'player' ? 'you' : 'them'}: −${p.burn} at Supper` : ''}`])
      + section('By source', by.size ? rows([...by].sort((a, b) => b[1] - a[1]).map(([k, n]) => [linked(k), sign(n), n < 0 ? 'loss' : ''])) : '<p class="v2-cnote">Nothing yet.</p>')
      + section('History (newest first)', hist.length ? rows(list) : '')
      + `<p class="v2-cnote">${linked(glossaryEntry('recognition').text, 'recognition')}</p>`,
  };
}

function energyEntry(v, who) {
  const p = v.players[who];
  const sources = p.energySources ?? [];
  const gained = sources.reduce((n, s) => n + s.amount, 0);
  return {
    title: `${sideOwn(who)} Energy`,
    html: head(null, `${sideOwn(who)} Energy`, [`<b class="v2-cbig">${p.energy}</b> left · ${gained} this Round · ${gained - p.energy} spent`,
      p.bonusNext ? `+${p.bonusNext} next Round (milestones)` : ''])
      + section('This Round\'s sources', sources.length ? rows(sources.map((s) => [linked(s.source), `+${s.amount}`])) : '<p class="v2-cnote">None yet (the match hasn\'t started).</p>')
      + `<p class="v2-cnote">${linked(glossaryEntry('energy').text, 'energy')} The Round's share is the Round number, up to ${MAX_BASE_ENERGY}.</p>`,
  };
}

function weatherEntry(v) {
  const totals = v ? weatherTotals(v) : { Rain: 0, Sun: 0 };
  const carriers = v ? [...v.locations.filter((l) => Object.values(l.weather ?? {}).some(Boolean)).map((l) => [ref(`loc:${l.uid}`, l.name), weatherLine(l.weather)]),
    ...['player', 'ai'].flatMap((w) => v.players[w].row.map((c, i) => (c?.weather ? [ref(`mon:${w}:${i}`, `${c.name} (${w === 'player' ? 'yours' : 'theirs'})`), weatherLine(c.weather)] : null)).filter(Boolean))] : [];
  return {
    title: 'Weather',
    html: head(null, 'Weather', [`${linked('Rain')} <b>${totals.Rain ?? 0}</b> · ${linked('Sun')} <b>${totals.Sun ?? 0}</b> on the board`])
      + section('Brackets', rows(WEATHER_BRACKETS.map((b) => [`${b.kind} ${b.at}`, linked(b.text), v && bracket(v, b.kind, b.at) ? 'on' : 'dim'])))
      + section('Where it comes from', carriers.length ? rows(carriers) : '<p class="v2-cnote">No Weather in play.</p>'),
  };
}

const PILES = { draw: 'drawPile', discard: 'discard', released: 'released' };
const PILE_NAMES = { draw: 'Draw Pile', discard: 'Discard Pile', released: 'Released Pile' };
function pileEntry(v, who, pile) {
  const list = v.players[who][PILES[pile]] ?? [];
  const term = glossaryEntry(PILE_NAMES[pile]) ?? glossaryEntry('release');
  const shown = pile === 'draw' ? '' : list.length ? `<ul class="v2-clist">${list.map((c) => `<li>${c.hidden ? 'a hidden card' : ref(`card:${c.uid}`, `${c.name}${c.level && c.cardType === 'Pokémon' ? ` (Level ${c.level})` : ''}`)}</li>`).join('')}</ul>` : '<p class="v2-cnote">Empty.</p>';
  return {
    title: `${sideOwn(who)} ${PILE_NAMES[pile]}`,
    html: head(null, `${sideOwn(who)} ${PILE_NAMES[pile]}`, [`<b class="v2-cbig">${list.length}</b> ${list.length === 1 ? 'card' : 'cards'}${pile === 'draw' ? ' · face down: their order is hidden' : ''}`])
      + section(pile === 'draw' ? '' : 'Cards', shown) + `<p class="v2-cnote">${linked(term.text, term.id)}</p>`,
  };
}

function bagEntry(v, who) {
  const bag = v.players[who].bag;
  return {
    title: `${sideOwn(who)} Bag`,
    html: head(null, `${sideOwn(who)} Bag`, [`${bag.length} of 6 Items`])
      + section('Items', bag.length ? `<ul class="v2-clist">${bag.map((c) => `<li>${ref(`card:${c.uid}`, c.name)}: ${linked(c.text)}</li>`).join('')}</ul>` : '<p class="v2-cnote">Empty: Items are found at Locations.</p>')
      + `<p class="v2-cnote">${linked(glossaryEntry('bag').text, 'bag')}</p>`,
  };
}

function logEntry(v, i) {
  if (i === undefined) {
    return { title: 'Log', html: `<h3>The match so far</h3><ol class="v2-clog" reversed>${[...v.log.keys()].reverse().map((k) => `<li data-codex-ref="log:${k}">${linked(v.log[k])}</li>`).join('')}</ol>` };
  }
  return { title: `Log line ${i + 1}`, html: `<h3>Log</h3><p class="v2-cquote">${linked(v.log[i] ?? '')}</p><p class="v2-cnote">${ref('log', 'The whole log')}</p>` };
}

function termEntry(id) {
  const e = glossaryEntry(id);
  if (!e) return null;
  const KIND = { rule: 'Rule', keyword: 'Keyword', trigger: 'Trigger', status: 'Status', card: 'Card type', resource: 'Resource', weather: 'Weather', phase: 'Part of the Round' };
  return {
    title: e.term,
    html: `<div class="v2-cterm"><h3>${esc(e.term)}</h3><p class="v2-ckind">${KIND[e.kind] ?? 'Rule'}${e.aliases?.length ? ` · also: ${e.aliases.map(esc).join(', ')}` : ''}</p>
      <div class="v2-cbox"><p>${linked(e.text, e.id)}</p></div>${e.id === 'weather' ? section('Brackets', rows(WEATHER_BRACKETS.map((b) => [`${b.kind} ${b.at}`, linked(b.text)]))) : ''}
      <p class="v2-cnote">From ${esc(e.source)}.</p></div>`,
  };
}

function rulesEntry(q = '') {
  const found = searchGlossary(q);
  const kinds = ['rule', 'phase', 'resource', 'card', 'keyword', 'trigger', 'status', 'weather'];
  const NAMES = { rule: 'Rules', phase: 'The Round', resource: 'Resources', card: 'Card types', keyword: 'Keywords', trigger: 'Triggers', status: 'Statuses', weather: 'Weather' };
  const body = q
    ? (found.length ? `<ul class="v2-clist">${found.map((e) => `<li><a class="v2-term" data-term="${e.id}">${esc(e.term)}</a> · ${esc(e.text.slice(0, 90))}…</li>`).join('')}</ul>` : '<p class="v2-cnote">No rule matches.</p>')
    : kinds.map((k) => section(NAMES[k], `<p class="v2-cindex">${GLOSSARY.filter((e) => e.kind === k).map((e) => `<a class="v2-term" data-term="${e.id}">${esc(e.term)}</a>`).join(' · ')}</p>`)).join('');
  return { title: q ? `Search: ${q}` : 'Rules', html: `<h3>${q ? `Rules matching “${esc(q)}”` : 'Every rule and keyword'}</h3>${body}` };
}

// A card the viewer can see, by uid: hand, Bag, piles, both sides' public piles, in play.
function findCard(v, uid) {
  for (const who of ['player', 'ai']) {
    const p = v.players[who];
    for (const [pile, where] of [['hand', 'your hand'], ['bag', 'the Bag'], ['discard', 'the Discard Pile'], ['released', 'the Released Pile']]) {
      const c = p[pile]?.find((x) => x.uid === uid && !x.hidden);
      if (c) return { card: c, where: who === 'player' ? where : `the Opponent's ${where.replace(/^(your|the) /, '')}` };
    }
    const t = p.trainers.find((x) => x.uid === uid);
    if (t) return { card: t, where: null, trainer: who };
  }
  return null;
}

// The entry for a ref, or null. v: the viewer's (oriented) view, or null outside a match.
export function codexEntry(v, r) {
  const [k, a, b] = String(r).split(':');
  try {
    switch (k) {
      case 'mon': return v && pokemonInPlay(v, a, Number(b));
      case 'card': {
        const f = v && findCard(v, a);
        if (!f) return null;
        return f.trainer ? trainerHtml(v, f.card, null, f.trainer) : cardEntry(v, f.card, f.where);
      }
      case 'def': {
        const c = cardDef(a, b ? Number(b) : undefined);
        return c.cardType === 'Trainer' ? trainerHtml(null, c) : cardEntry(null, b ? { ...c, cap: Number(b) } : c, null);
      }
      case 'loc': return v && locationInPlay(v, a);
      case 'trainer': { const t = v?.players[a]?.trainers.find((x) => x.uid === b); return t ? trainerHtml(v, t, null, a) : null; }
      case 'champ': return champEntry(v);
      case 'rec': return v && recognitionEntry(v, a);
      case 'energy': return v && energyEntry(v, a);
      case 'weather': return weatherEntry(v);
      case 'pile': return v && pileEntry(v, a, b);
      case 'bag': return v && bagEntry(v, a);
      case 'log': return v && logEntry(v, a === undefined ? undefined : Number(a));
      case 'term': return termEntry(a);
      case 'rules': return rulesEntry(a ?? '');
      default: return null;
    }
  } catch (err) {
    return { title: 'Codex', html: `<p class="v2-cnote">Nothing to show (${esc(err.message)}).</p>` };
  }
}

// --- The panel (DOM) -----------------------------------------------------------------------------
//
// One layer on the stage, above the board and the deck builder. ui.codex: { stack: [ref…], q }.
let layer = null;
let host = { ui: null, view: () => null, redraw: () => {} };
let hovered = null;

export function initCodex(stage, { ui, view }) {
  host = { ui, view };
  layer = document.createElement('div');
  layer.className = 'v2-codex-layer';
  stage.appendChild(layer);
  // Right-click anything with an entry (or hover it and press Space).
  stage.addEventListener('contextmenu', (e) => {
    const el = e.target.closest('[data-codex]');
    if (!el) return;
    e.preventDefault();
    openCodex(el.dataset.codex);
  });
  stage.addEventListener('mouseover', (e) => { hovered = e.target.closest('[data-codex]'); });
  addEventListener('keydown', (e) => {
    const typing = /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement?.tagName ?? '');
    if (e.key === 'Escape' && ui.codex) { e.preventDefault(); closeCodex(); return; }
    if (e.code === 'Space' && !typing && hovered?.isConnected) { e.preventDefault(); openCodex(hovered.dataset.codex); }
  });
  layer.addEventListener('click', (e) => {
    const t = e.target.closest('[data-term],[data-codex-ref],[data-codex-back],[data-codex-close],[data-crumb]');
    if (!t) return;
    e.stopPropagation();
    if (t.dataset.codexClose !== undefined) return closeCodex();
    if (t.dataset.codexBack !== undefined) { ui.codex.stack.pop(); ui.codex.q = ''; return drawCodex(); }
    if (t.dataset.crumb !== undefined) { ui.codex.stack.length = Number(t.dataset.crumb) + 1; ui.codex.q = ''; return drawCodex(); }
    push(t.dataset.term ? `term:${t.dataset.term}` : t.dataset.codexRef);
  });
  layer.addEventListener('contextmenu', (e) => e.preventDefault());
  layer.addEventListener('input', (e) => {
    if (!e.target.matches('.v2-codex-search')) return;
    ui.codex.q = e.target.value;
    drawCodex();
  });
}

export function openCodex(r) {
  const { ui } = host;
  if (!ui) return;
  ui.codex = { stack: [r], q: '' };
  drawCodex();
}
function push(r) {
  const { ui } = host;
  if (!ui.codex) ui.codex = { stack: [], q: '' };
  if (ui.codex.stack.at(-1) !== r) ui.codex.stack.push(r);
  ui.codex.q = '';
  drawCodex();
}
export function closeCodex() {
  host.ui.codex = null;
  drawCodex();
}

// Draw (or redraw, as the match carries on) the open Codex; keeps the search box's focus.
export function drawCodex() {
  if (!layer) return;
  const { ui } = host;
  if (!ui?.codex?.stack.length) { layer.innerHTML = ''; layer.classList.remove('open'); return; }
  const v = host.view();
  const input = layer.querySelector('.v2-codex-search');
  const focused = input && document.activeElement === input;
  const caret = focused ? input.selectionStart : null;
  const { stack, q } = ui.codex;
  const current = q ? `rules:${q}` : stack.at(-1);
  const entry = codexEntry(v, current) ?? { title: 'Gone', html: '<p class="v2-cnote">That is no longer in play.</p>' };
  const crumbs = stack.map((r, i) => {
    const t = codexEntry(v, r)?.title ?? '…';
    return i === stack.length - 1 && !q ? `<b>${esc(t)}</b>` : `<a data-crumb="${i}">${esc(t)}</a>`;
  }).join(' › ');
  layer.classList.add('open');
  layer.innerHTML = `<aside class="v2-codex v2-panel" role="dialog" aria-label="Codex">
    <header><span class="v2-codex-kicker">Codex · ${esc(entry.title)}</span>
      <input class="v2-codex-search" type="search" placeholder="Search rules…" value="${esc(q)}" aria-label="Search rules">
      <button class="v2-codex-x" data-codex-close aria-label="Close">✕</button></header>
    <nav class="v2-codex-crumbs">${stack.length > 1 || q ? '<button data-codex-back>‹ Back</button>' : ''}<span>${crumbs}${q ? ' › <b>search</b>' : ''}</span><a data-codex-ref="rules">Rules</a></nav>
    <div class="v2-codex-body">${entry.html}</div>
    <footer>Right-click or hover + Space on anything · Esc to close · the match carries on</footer>
  </aside>`;
  if (focused) {
    const again = layer.querySelector('.v2-codex-search');
    again.focus();
    again.setSelectionRange(caret, caret);
  }
}
