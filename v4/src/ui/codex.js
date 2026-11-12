// The Codex (C3; docs/v4-card-overhaul.md 4, docs/v4-ux-plan.md 10 part A): right-click anything when no choice
// is in progress, hover it and press C, or click the ⓘ on a Full card. A panel opens over the right-hand
// column and part of the board; your hand and the board's centre stay visible and the match carries on.
// Esc or ✕ closes it. Card first: the Full card at 340 px on the left (or a header for things that aren't
// cards); on the right, in order: what it does now, where its numbers come from, keywords and triggers, its
// forms by Level (and what it becomes next Round), with every game term a link to its glossary entry, Back
// and breadcrumbs.
//
// Copied from v2/src/ui/codex.js (C3): the ref strings, codexEntry(state, ref) as pure strings (Node calls it:
// tests/c3.test.js), linked(), and the panel (a stack of refs, breadcrumbs, Back, search, ✕); rewritten for
// v4's state, its card renderer and its explanations (src/engine/explain.js).
//
// Refs:
//   card:<uid>                a card you can see (your hand, the piles, the Bags, the PokéMart, Strats, Partners)
//   def:<id>[:<level>]        a card by id (a form in the forms row, a Partner)
//   mon:<who>:<space>         a Pokémon in play
//   loc:<uid> · tournament    a placed Location; the Pokémon League Tournament
//   trainer:<who>:<uid>       a Trainer Objective tracker
//   rec:<who> · energy:<who> · weather · mart
//   pile:<who>:<draw|discard|released> · bag:<who> · log:<i>
//   term:<id> · rules[:<query>]
import { GLOSSARY, KINDS, glossaryEntry, termsIn, searchGlossary } from '../engine/glossary.js?v=202611120821';
import {
  pathDef, pokemonAt, cardAtRound, keywordList, triggerText, KEYWORD_NAMES, KEYWORD_ORDER, TRIGGER_NAMES, MODES, MODE_NAMES,
  modeText, modeTarget, effectText, FAVOURS, TRAINERS, ITEMS, COMMANDS, SUPPORTERS, LOCATIONS,
} from '../engine/cards.js?v=202611120821';
import { RULES } from '../rules.js?v=202611120821';
import { playReason, commandModesFor, summonCost, emptySpaces, locationAt } from '../engine/game.js?v=202611120821';
import {
  statSums, statLines, formsRow, nextRound, levelGrowth, pokemonState, recognitionHistory, energyExplain, weatherExplain,
  martExplain, locationExplain, tournamentExplain, objectiveExplain,
} from '../engine/explain.js?v=202611120821';
import { cardHTML } from './card.js?v=202611120821';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const cap = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);
const stop = (t) => (/[.!:)]$/.test(t) ? t : `${t}.`);
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const Whose = (w) => (w === 'player' ? 'Your' : 'The Opponent\'s');

// Text with every game term linked to its glossary entry (skip: the entry being read).
export function linked(text, skip = null) {
  return termsIn(text, skip).map((p) => (p.id ? `<a class="v4-term" data-term="${p.id}">${esc(p.text)}</a>` : esc(p.text))).join('');
}
const cref = (r, label) => `<a class="v4-cref" data-codex-ref="${esc(r)}">${esc(label)}</a>`;
const para = (lines, skip) => lines.filter(Boolean).map((l) => `<p>${linked(l, skip)}</p>`).join('');
const section = (title, body) => (body ? `<section class="v4-csec"><h4>${esc(title)}</h4>${body}</section>` : '');
// A glossary meaning, the term itself a link.
const meaning = (id, shown) => { const g = glossaryEntry(id); return g ? `<p class="v4-cmean"><a class="v4-term" data-term="${g.id}"><b>${esc(shown ?? g.term)}</b></a>: ${linked(g.text, g.id)}</p>` : ''; };
const head = (title, kicker, big = '') => `<div class="v4-chead"><span class="k">${esc(kicker)}</span><b class="t">${esc(title)}</b>${big ? `<span class="big">${big}</span>` : ''}</div>`;
// A Mini card scaled down, as a link (the forms row, pile contents).
const small = (c, r, mark = '', scale = 0.5) => `<button class="v4-cmini${mark ? ` ${mark}` : ''}" data-codex-ref="${esc(r)}" data-codex="${esc(r)}" style="width:${Math.round(200 * scale)}px;height:${Math.round(280 * scale)}px"><span style="transform:scale(${scale})">${cardHTML(c, { size: 'mini' })}</span></button>`;

// --- Card wording in full (the Codex is where full wording lives) -------------------------------------
export function fullText(c) {
  switch (c.cardType) {
    case 'Pokémon': {
      const kws = keywordList(c.keywords);
      return [
        `${c.partner ? 'Partner, Level 8' : `Level ${c.level}`} · ${c.type} · ${c.attackType} attack · ${c.speed} · ${c.strengthType === 'Hitpoints' ? 'Hitpoints (no guard)' : `${c.strengthType} guard`}.`,
        kws.length ? `Keywords: ${kws.join(', ')}.` : '',
        c.trigger ? stop(triggerText(c.trigger)) : '',
        c.held ? `Held Item: ${c.held.name} (${c.held.text.replace(/^Held: /, '')}).` : '',
      ];
    }
    case 'Command': {
      const t = { enemy: 'an enemy Pokémon', own: 'one of your Pokémon', location: 'a Location (each enemy Pokémon there)', allEnemies: 'each enemy Pokémon (no choice)' }[c.target];
      return [`Target: ${t}.`, ...['react', 'adapt', 'strat'].map((m) => `${MODE_NAMES[m]} (${c.modes[m].cost} Energy): ${stop(modeText(c, m))}`)];
    }
    case 'Supporter':
      return [`Release ${plural(c.release, 'other card')} from your hand, then this card is Released too. No Energy.`, `Effect: ${stop(effectText(c.effect))}`,
        `Favour: Release ${FAVOURS[c.favour.condition].text} → ${effectText(c.favour)} instead, and +${RULES.perFavour} Recognition.`];
    case 'Item':
      return [`$${c.price} · ${c.itemType} · Stock ${c.stock} in the PokéMart.`, stop(c.text), c.noHitBack ? 'The holder is still Ready, but never hits back.' : '', c.noTarget ? 'No target: buy it to use, and it resolves at once.' : ''];
    case 'Trainer':
      return [`Objective: ${c.objective.text} (tracked from Round 1). Reward: ${c.partner.name} arrives as a Partner and +${RULES.perObjective} Recognition; this card leaves the deck for good.`,
        `Partner: ${c.partner.name}, Level 8, ${c.partner.type}, ${c.partner.attackType} attack, ${c.partner.speed}, Attack ${c.partner.attack}, Strength ${c.partner.strength}. ${stop(c.partner.text)}`,
        `Trainer Command (${c.command.cost} Energy): ${stop(c.command.text)} Then the card is discarded.`];
    case 'Location':
      return [stop(c.passive.text), `Covers ${c.width} lanes for ${plural(c.rounds, 'Round')}. Weather: adds ${c.weather.count} ${c.weather.type}.`, `Placing it costs no Energy. Dominating it at Supper: +${RULES.perDominance} Recognition.`];
    default: return [];
  }
}

// Keywords and triggers: each with its glossary meaning.
function keywordsAndTriggers(c) {
  const out = [];
  if (c.cardType === 'Pokémon') {
    const all = { ...(c.keywords ?? {}) };
    for (const [k, v] of Object.entries(c.held?.keywords ?? {})) all[k] = typeof v === 'number' ? (all[k] ?? 0) + v : v;
    for (const k of KEYWORD_ORDER.filter((x) => all[x])) out.push(meaning(k, all[k] === true ? KEYWORD_NAMES[k] : `${KEYWORD_NAMES[k]} ${all[k]}`));
    if (c.trigger) { out.push(meaning(c.trigger.on)); if (c.trigger.ops.some((o) => /chosen/.test(o.to ?? ''))) out.push(meaning('on-summon-targets')); }
    if (c.trigger?.ops.some((o) => /Here$/.test(o.to ?? ''))) out.push(meaning('in-its-location'));
    if (c.trigger?.ops.some((o) => /TargetLoc$/.test(o.to ?? ''))) out.push(meaning('targets-location'));
    if (c.trigger?.ops.some((o) => o.op === 'attack' || o.op === 'strength')) out.push(meaning('kept'));
    if (c.trigger?.ops.some((o) => o.op === 'tempAttack')) out.push(meaning('until-supper'));
    if (c.strengthType !== 'Hitpoints') out.push(meaning(c.strengthType === 'Defence' ? 'defence' : 'special-defence'), meaning('guard'));
    out.push(meaning(c.attackType === 'Physical' ? 'physical' : 'special'));
    if (c.held) out.push(meaning('held'));
    if (c.partner) out.push(meaning('partner'));
  } else if (c.cardType === 'Command') {
    out.push(meaning('react'), meaning('adapt'), meaning('strat'));
    if (c.target === 'location') out.push(meaning('location-target'));
    if (c.target === 'allEnemies') out.push(meaning('all-enemies'));
    if (MODES.some((m) => ['attacker', 'attacked'].includes(modeTarget(c, m)))) out.push(meaning('react-targets'));
    if (MODES.some((m) => c.modes[m].op === 'attackKept')) out.push(meaning('kept'));
    if (MODES.some((m) => c.modes[m].op === 'attackUp')) out.push(meaning('until-supper'));
    if (MODES.some((m) => c.modes[m].op === 'dive')) out.push(meaning('dive'));
  } else if (c.cardType === 'Supporter') {
    out.push(meaning('release'), meaning('favour'));
    if (c.effect.op === 'recover') out.push(meaning('recover'));
    if (c.effect.op === 'strengthAll') out.push(meaning('kept'));
    if (c.effect.op === 'attackAll') out.push(meaning('until-supper'));
  } else if (c.cardType === 'Item') {
    out.push(meaning(c.itemType === 'Held' ? 'held' : 'consumed'), meaning('stock'), meaning('pokedollars'));
  } else if (c.cardType === 'Trainer') {
    out.push(meaning('objective'), meaning('partner'), meaning('trainer-command'));
  } else if (c.cardType === 'Location') {
    out.push(meaning('location'), meaning('weather'), meaning(c.weather.type === 'Rain' ? 'rain' : 'sun'), meaning('dominance'));
  }
  return out.join('');
}

// Where the card is, and what it does now (for a card in your hand: can you play it, and how).
function stateLines(s, c, where) {
  const out = [];
  if (where.text) out.push(where.text);
  if (s && where.hand && s.players.player.hand.includes(c)) {
    if (c.retained) out.push('Retained: it stays in your hand through Supper.');
    if (c.cardType === 'Command') {
      const modes = commandModesFor(s, 'player', c.uid);
      if (modes.length) out.push(...modes.map((m) => `${MODE_NAMES[m.mode]} now (${m.cost} Energy): ${m.reason ? m.reason : 'playable'}.`));
      else out.push(`Not playable now: ${playReason(s, 'player', c) ?? 'not your turn'}.`);
    } else {
      const why = playReason(s, 'player', c);
      out.push(why ? `Not playable now: ${why}.` : 'Playable now.');
    }
    if (c.cardType === 'Pokémon' && emptySpaces(s, 'player').length) {
      const costs = [...new Set(emptySpaces(s, 'player').map((i) => summonCost(s, c, i)))];
      if (costs.length > 1) out.push(`Summoning it costs ${costs.sort((a, b) => a - b).join(' or ')} Energy, by space (Route 119 is cheaper).`);
    }
  }
  return out;
}

function pokemonSections(s, c, where) {
  const sums = statSums(s, c, where.mon ?? null);
  const sec = [
    ['What it does now', para([...fullText(c), ...stateLines(s, c, where), ...(where.mon ? pokemonState(s, c, where.mon) : pokemonState(s, c, null))])],
    ['Where its numbers come from', `<div class="v4-csums">${statLines(sums).map((l) => `<p>${linked(l)}</p>`).join('')}</div>`],
    ['Keywords and triggers', keywordsAndTriggers(c)],
  ];
  const forms = formsRow(c.id, c.level);
  if (forms.length) {
    const row = forms.map((f) => `<div class="v4-cform">${small(pokemonAt(c.id, f.from), `def:${c.id}:${f.from}`, f.current ? 'current' : '', 0.46)}<span class="lv">Lv ${f.from}–${f.to}${f.current ? ' · now' : ''}</span></div>`).join('');
    const off = !where.mon;
    const growth = s && off ? levelGrowth(c, s.round) : '';
    const next = s && off ? nextRound(c, s.round) : null;
    sec.push(['Forms by Level', `<div class="v4-cforms">${row}</div>${growth ? `<p>${linked(growth)}</p>` : ''}${next ? `<p class="v4-cnext">${linked(next.text)}</p>` : ''}${where.mon ? `<p>${linked('Once summoned, a Pokémon keeps its Level.')}</p>` : ''}`]);
  }
  return sec;
}
function otherSections(s, c, where) {
  const sec = [['What it does now', para([...fullText(c), ...stateLines(s, c, where)])]];
  const nums = [];
  if (c.cardType === 'Command') nums.push(...['react', 'adapt', 'strat'].map((m) => `${MODE_NAMES[m]}: ${c.modes[m].cost} Energy (printed).`));
  if (c.cardType === 'Item') nums.push(`Price: $${c.price} (printed). Stock: ${c.stock} turns on sale ($1 → 8, $2 → 6, $3 → 4, $4 → 3).`);
  if (c.cardType === 'Trainer') nums.push(`Trainer Command: ${c.command.cost} Energy (printed).`);
  if (c.cardType === 'Supporter') nums.push(`Cost: no Energy; Release ${c.release}.`);
  if (c.cardType === 'Location') nums.push(`Lanes ${c.width}, Rounds ${c.rounds}, Weather ${c.weather.count} ${c.weather.type} (printed).`);
  sec.push(['Where its numbers come from', para(nums)]);
  sec.push(['Keywords and triggers', keywordsAndTriggers(c)]);
  if (c.cardType === 'Trainer') sec.push(['Its Partner', `<div class="v4-cforms">${small(c.partner, `def:${c.partner.id}`, '', 0.6)}</div>`]);
  return sec;
}
function cardEntry(s, c, where = {}) {
  const sections = c.cardType === 'Pokémon' ? pokemonSections(s, c, where) : otherSections(s, c, where);
  return { title: c.name, kind: 'card', card: c, cardState: where.state ?? {}, sections };
}

// --- Finding things -------------------------------------------------------------------------------------
// A card you can see, and where it is. Never the Opponent's hand or either Draw Pile.
export function findCard(s, uid) {
  if (!s) return null;
  const me = s.players.player;
  const hit = me.hand.find((c) => c.uid === uid);
  if (hit) return { card: hit, where: { hand: true, text: 'In your hand.' } };
  for (const who of ['player', 'ai']) {
    const p = s.players[who];
    const sp = p.row.findIndex((c) => c?.uid === uid);
    if (sp >= 0) return { card: p.row[sp], where: { mon: { who, space: sp }, text: `${Whose(who)} Pokémon in lane ${sp + 1}.` } };
    for (const [pile, name] of [['discard', 'Discard Pile'], ['released', 'Released Pile'], ['bag', 'Bag'], ['waiting', 'Partners waiting for a space']]) {
      const c = p[pile].find((x) => x.uid === uid);
      if (c) return { card: c, where: { text: `In ${Whose(who).toLowerCase() === 'your' ? 'your' : 'the Opponent\'s'} ${name}.` } };
    }
    const t = p.trainers.find((x) => x.uid === uid);
    if (t) return { card: t.card, where: { text: `${Whose(who)} Trainer Objective: ${t.objective.text}.` } };
  }
  const strat = [...s.strats, ...(s.reactWindow?.pending?.strat ? [s.reactWindow.pending.strat] : [])].find((x) => x.card.uid === uid || x.uid === uid);
  if (strat) return { card: strat.card, where: { text: `${Whose(strat.owner)} Strat, sealed: on ${strat.targetName}; it resolves after ${strat.owner === 'player' ? 'the Opponent\'s' : 'your'} next turn, or at Supper.` } };
  const mart = s.mart.onSale.find((c) => c?.uid === uid);
  if (mart) return { card: mart, where: { text: `In the PokéMart: Stock ${s.mart.stock}.`, state: { stock: s.mart.stock } } };
  const pend = s.reactWindow?.pending?.card;
  if (pend?.uid === uid) return { card: pend, where: { text: 'Being played now (a React window is open).' } };
  return null;
}
const defCard = (id, level) => {
  if (pathDef(id)) return pokemonAt(id, Number(level ?? 1));
  const partner = TRAINERS.find((t) => t.partner.id === id)?.partner;
  if (partner) return { ...structuredClone(partner) };
  const def = [...COMMANDS, ...SUPPORTERS, ...ITEMS, ...TRAINERS, ...LOCATIONS].find((c) => c.id === id);
  return def ? cardAtRound(id, 1) : null;
};

// --- Things that aren't cards ---------------------------------------------------------------------------
function locEntry(s, l) {
  const c = l.card ?? LOCATIONS.find((x) => x.id === l.id);
  return {
    title: l.name, kind: 'card', card: c,
    sections: [
      ['What it does now', para(locationExplain(s, l))],
      ['Where its numbers come from', para([`Lanes ${l.width} and Rounds ${c.rounds} are printed; ${plural(l.roundsLeft, 'Round')} left now.`, `Strength here is the total current Strength of each side's Pokémon in lanes ${l.start + 1}–${l.start + l.width}.`, `Dominance: +${RULES.perDominance} Recognition at Supper.`])],
      ['Keywords and triggers', keywordsAndTriggers(c)],
    ],
  };
}
function tournamentEntry(s) {
  return {
    title: 'Pokémon League Tournament', kind: 'head', head: head('Pokémon League Tournament', s.tournament ? 'In play' : 'Not yet', '🏆'),
    sections: [['What it does now', para(tournamentExplain(s))], ['Keywords and triggers', meaning('tournament') + meaning('dominance') + meaning('recognition')]],
  };
}
function trainerEntry(s, who, t) {
  const p = t.card.partner;
  return {
    title: `${t.name}'s Objective`, kind: 'card', card: p, cardState: {},
    sections: [
      ['What it does now', `${para(objectiveExplain(s, who, t))}<div class="v4-cforms">${small(t.card, `def:${t.card.id}`, '', 0.5)}</div>`],
      ['Keywords and triggers', meaning('objective') + meaning('partner') + meaning('summon')],
    ],
  };
}
function recEntry(s, who) {
  const groups = recognitionHistory(s, who);
  const p = s.players[who];
  const body = groups.length ? groups.map((g) => `<div class="v4-crec"><p><b>${esc(g.label)}</b> <span class="n">+${g.total}</span></p><ul>${g.items.map((i) => `<li>Round ${i.round}: +${i.amount} ${linked(i.source)}</li>`).join('')}</ul></div>`).join('') : '<p>No Recognition yet.</p>';
  return {
    title: `${Whose(who)} Recognition`, kind: 'head', head: head(`${Whose(who)} Recognition`, `${p.recognition} of ${RULES.win}`, String(p.recognition)),
    sections: [['What it does now', para([`${p.recognition} Recognition; ${RULES.win} wins.`, s.tournament ? 'The Pokémon League Tournament is on: every gain is increased by half, rounded up.' : ''])],
      ['History by source', body], ['Keywords and triggers', meaning('recognition') + meaning('player-character') + meaning('champion')]],
  };
}
function energyEntry(s, who) {
  const p = s.players[who];
  return {
    title: `${Whose(who)} Energy`, kind: 'head', head: head(`${Whose(who)} Energy`, `Round ${s.round}`, String(p.baseEnergy)),
    sections: [['Where its numbers come from', para(energyExplain(s, who))], ['Keywords and triggers', meaning('base-energy') + meaning('pass') + meaning('exert') + meaning('exhaust') + meaning('retain')]],
  };
}
function weatherEntry(s) {
  const w = weatherExplain(s);
  const table = `<table class="v4-ctable"><tr><th>Bracket</th><th>Effect</th><th>Now</th></tr>${w.brackets.map((b) => `<tr class="${b.reached ? 'on' : ''}"><td>${linked(`${b.type} ${b.at}`)}</td><td>${linked(cap(b.text))}</td><td>${b.reached ? 'Active' : '—'}</td></tr>`).join('')}</table>`;
  const src = w.sources.length ? w.sources.map((x) => `${x.name} adds ${x.count} ${x.type}`).join('; ') : 'No Location is placed';
  return {
    title: 'Weather', kind: 'head', head: head('Weather', w.tournament ? 'None in the Tournament' : `Rain ${w.totals.Rain} · Sun ${w.totals.Sun}`, '☂ ☀'),
    sections: [['What it does now', `${para([w.tournament ? 'The Pokémon League Tournament replaced every Location and its Weather.' : `Totals now: Rain ${w.totals.Rain}, Sun ${w.totals.Sun}.`, `${src}.`])}${table}`],
      ['Keywords and triggers', meaning('weather') + meaning('rain') + meaning('sun')]],
  };
}
function martEntry(s) {
  const c = s.mart.onSale[0];
  return {
    title: 'PokéMart', kind: c ? 'card' : 'head', card: c ?? null, cardState: { stock: s.mart.stock }, head: c ? '' : head('PokéMart', s.mart.soldOut ? 'Sold out' : 'Empty', '🛒'),
    sections: [['What it does now', para(martExplain(s))], ['Keywords and triggers', meaning('pokemart') + meaning('stock') + meaning('sold-out') + meaning('item')]],
  };
}
const PILE = { draw: ['drawPile', 'Draw Pile', 'draw-pile'], discard: ['discard', 'Discard Pile', 'discard-pile'], released: ['released', 'Released Pile', 'released-pile'] };
function pileEntry(s, who, which) {
  const [key, name, term] = PILE[which];
  const list = s.players[who][key];
  const body = which === 'draw' ? para([`${plural(list.length, 'card')}. Its order is hidden.`])
    : list.length ? `<div class="v4-cforms wrap">${list.slice().reverse().map((c) => small(c, `card:${c.uid}`, '', 0.42)).join('')}</div>` : '<p>Empty.</p>';
  return {
    title: `${Whose(who)} ${name}`, kind: 'head', head: head(`${Whose(who)} ${name}`, plural(list.length, 'card'), String(list.length)),
    sections: [[which === 'draw' ? 'What it does now' : 'Its cards, newest first', body], ['Keywords and triggers', meaning(term)]],
  };
}
function bagEntry(s, who) {
  const list = s.players[who].bag;
  return {
    title: `${Whose(who)} Bag`, kind: 'head', head: head(`${Whose(who)} Bag`, `${list.length} of 6`, String(list.length)),
    sections: [['Its Items', list.length ? `<div class="v4-cforms wrap">${list.map((c) => small(c, `card:${c.uid}`, '', 0.42)).join('')}</div>` : '<p>Empty.</p>'], ['Keywords and triggers', meaning('bag') + meaning('item')]],
  };
}
function logEntry(s, i) {
  const line = s.log[i];
  if (line === undefined) return null;
  return {
    title: `Log, line ${i + 1}`, kind: 'head', head: head('Log', `Line ${i + 1} of ${s.log.length}`, '📜'),
    sections: [['What happened', `<p>${linked(line)}</p>`]],
  };
}
function termEntry(id) {
  const g = glossaryEntry(id);
  if (!g) return null;
  const kind = KINDS.find(([k]) => k === g.kind)?.[1] ?? '';
  const related = GLOSSARY.filter((e) => e.id !== g.id && termsIn(e.text).some((p) => p.id === g.id)).slice(0, 12);
  return {
    title: g.term, kind: 'head', head: head(g.term, kind, ''),
    sections: [['Meaning', `<p>${linked(g.text, g.id)}</p>${g.aliases?.length ? `<p class="v4-cnote">Also: ${g.aliases.map(esc).join(', ')}.</p>` : ''}`],
      ['Used in', related.length ? `<p>${related.map((e) => `<a class="v4-term" data-term="${e.id}">${esc(e.term)}</a>`).join(', ')}</p>` : '']],
  };
}
// The Rules page: the whole glossary, grouped, searchable (also the ? overlay's Rules page).
export function rulesHTML(q = '') {
  const hits = new Set(searchGlossary(q).map((e) => e.id));
  return KINDS.map(([k, name]) => {
    const list = GLOSSARY.filter((e) => e.kind === k && hits.has(e.id));
    return list.length ? `<section class="v4-csec"><h4>${esc(name)}</h4>${list.map((e) => meaning(e.id)).join('')}</section>` : '';
  }).join('') || '<p>No rule matches.</p>';
}
function rulesEntry(q = '') {
  return { title: q ? `Rules: “${q}”` : 'Rules', kind: 'head', head: head('Rules', q ? `Search: ${q}` : 'Every term', '📖'), sections: [['', rulesHTML(q)]], wide: true };
}

// C4: a sealed Strat of the Opponent's: hidden until it resolves.
function sealedEntry(s, x) {
  return {
    title: 'A sealed Strat', kind: 'head', head: head('A sealed Strat', 'The Opponent\'s', '⏳'),
    sections: [['What it does now', para([`The Opponent played a Command as a Strat on ${x.targetName} in Round ${x.playedRound}. It stays face down until it resolves, after your next turn (or at Supper, before dominance).`, 'When it resolves it flips face up, and you may React to it then if you can.', 'If its target is gone by then, it fizzles.'])],
      ['Keywords and triggers', meaning('sealed-strat') + meaning('strat') + meaning('react')]],
  };
}
// The entry for a ref: { title, kind: 'card' | 'head', card?, cardState?, head?, sections: [[title, html]] }.
export function codexEntry(s, r) {
  const [type, a, b] = String(r).split(':');
  try {
    switch (type) {
      case 'card': {
        // C4: the Opponent's sealed Strat: only that one exists and its target, never the card.
        const sealedStrat = s?.strats.find((x) => x.owner === 'ai' && (x.uid === a || x.card.uid === a));
        if (sealedStrat) return sealedEntry(s, sealedStrat);
        const f = findCard(s, a); return f ? (f.where.mon ? cardEntry(s, f.card, f.where) : cardEntry(s, f.card, f.where)) : null; }
      case 'def': { const c = defCard(a, b); return c ? cardEntry(s, c, { text: c.cardType === 'Pokémon' && !c.partner ? `${c.name} at Level ${c.level}.` : '' }) : null; }
      case 'mon': { const c = s?.players[a]?.row[Number(b)]; return c ? cardEntry(s, c, { mon: { who: a, space: Number(b) }, text: `${Whose(a)} Pokémon in lane ${Number(b) + 1}${locationAt(s, Number(b)) ? `, in ${locationAt(s, Number(b)).name}` : ''}.`, state: { ready: false } }) : null; }
      case 'loc': { const l = s?.locations.find((x) => x.uid === a); return l ? locEntry(s, l) : null; }
      case 'tournament': return s ? tournamentEntry(s) : null;
      case 'trainer': { const t = s?.players[a]?.trainers.find((x) => x.uid === b); return t ? trainerEntry(s, a, t) : null; }
      case 'rec': return s ? recEntry(s, a) : null;
      case 'energy': return s ? energyEntry(s, a) : null;
      case 'weather': return s ? weatherEntry(s) : null;
      case 'mart': return s ? martEntry(s) : null;
      case 'pile': return s && PILE[b] ? pileEntry(s, a, b) : null;
      case 'bag': return s ? bagEntry(s, a) : null;
      case 'log': return s ? logEntry(s, Number(a)) : null;
      case 'term': return termEntry(a);
      case 'rules': return rulesEntry(String(r).slice(6));
      default: return null;
    }
  } catch (err) {
    return { title: 'Codex', kind: 'head', head: head('Codex', 'Error', ''), sections: [['', `<p>Nothing to show (${esc(err.message)}).</p>`]] };
  }
}
// The entry as HTML: the left column (the Full card, or the header) and the right column.
export function entryHTML(e) {
  const left = e.kind === 'card' && e.card ? `<div class="v4-cleft">${cardHTML(e.card, { size: 'full', state: e.cardState ?? {} })}</div>` : `<div class="v4-cleft head">${e.head ?? ''}</div>`;
  const right = `<div class="v4-cright">${e.sections.map(([t, h]) => (t ? section(t, h) : h ? `<section class="v4-csec">${h}</section>` : '')).join('')}</div>`;
  return `<div class="v4-centry${e.wide ? ' wide' : ''}">${left}${right}</div>`;
}

// --- The panel (DOM) --------------------------------------------------------------------------------------
// One layer on the stage, above the board. ui.codex: { stack: [ref…], q }.
let layer = null;
let host = { ui: null, getState: () => null, redraw: () => {} };
export const codexOpen = () => !!host.ui?.codex?.stack.length;

export function initCodex(stage, { ui, getState, redraw }) {
  host = { ui, getState, redraw };
  layer = document.createElement('div');
  layer.className = 'v4-codex-layer';
  stage.appendChild(layer);
  layer.addEventListener('click', (e) => {
    const t = e.target.closest('[data-term],[data-codex-ref],[data-codex-back],[data-codex-close],[data-crumb]');
    if (!t) return;
    e.stopPropagation();
    if (t.dataset.codexClose !== undefined) return closeCodex();
    if (t.dataset.codexBack !== undefined) return back();
    if (t.dataset.crumb !== undefined) { ui.codex.stack.length = Number(t.dataset.crumb) + 1; ui.codex.q = ''; return drawCodex(); }
    push(t.dataset.term ? `term:${t.dataset.term}` : t.dataset.codexRef);
  });
  layer.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const el = e.target.closest('[data-codex]');
    if (el) push(el.dataset.codex);
  });
  layer.addEventListener('input', (e) => {
    if (!e.target.matches('.v4-codex-search')) return;
    ui.codex.q = e.target.value;
    drawCodex();
  });
  layer.addEventListener('keydown', (e) => {
    if (e.target.matches('.v4-codex-search') && e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (ui.codex.q) { ui.codex.q = ''; drawCodex(); } else closeCodex(); }
  });
  // The ⓘ on a Full card (the React window, the mode picker, the viewers, the Release choice), and a term
  // linked anywhere else (the prompt bar, the log, the Rules page): each opens the Codex.
  stage.addEventListener('click', (e) => {
    const term = e.target.closest?.('.v4-term');
    if (term && !layer.contains(term)) { e.stopPropagation(); e.preventDefault(); openCodex(`term:${term.dataset.term}`); return; }
    const i = e.target.closest?.('.v4-info');
    if (!i) return;
    const el = i.closest('[data-codex]');
    if (!el) return;
    e.stopPropagation();
    e.preventDefault();
    openCodex(el.dataset.codex);
  }, true);
}
export function openCodex(r) {
  const { ui } = host;
  if (!ui || !r) return;
  ui.codex = { stack: [r], q: '' };
  drawCodex();
  host.redraw();
}
export function push(r) {
  const { ui } = host;
  if (!ui.codex) ui.codex = { stack: [], q: '' };
  if (ui.codex.stack.at(-1) !== r) ui.codex.stack.push(r);
  ui.codex.q = '';
  drawCodex();
}
export function back() {
  const { ui } = host;
  if (!ui.codex) return;
  if (ui.codex.q) ui.codex.q = '';
  else if (ui.codex.stack.length > 1) ui.codex.stack.pop();
  drawCodex();
}
export function closeCodex() {
  if (!host.ui) return;
  host.ui.codex = null;
  drawCodex();
  host.redraw();
}

// Draw (or redraw, as the match carries on) the open Codex; keeps the search box's focus and the scroll.
export function drawCodex() {
  if (!layer) return;
  const { ui } = host;
  if (!ui?.codex?.stack.length) { layer.innerHTML = ''; layer.classList.remove('open'); return; }
  const s = host.getState();
  const input = layer.querySelector('.v4-codex-search');
  const focused = input && document.activeElement === input;
  const caret = focused ? input.selectionStart : null;
  const body = layer.querySelector('.v4-codex-body');
  const key = `${ui.codex.stack.join('|')}#${ui.codex.q}`;
  const scroll = body && layer.dataset.key === key ? body.scrollTop : 0;
  const { stack, q } = ui.codex;
  const current = q ? `rules:${q}` : stack.at(-1);
  const entry = codexEntry(s, current) ?? { title: 'Gone', kind: 'head', head: head('Gone', 'No longer in play', ''), sections: [['', '<p>That is no longer in play.</p>']] };
  const crumbs = stack.map((r, i) => {
    const t = codexEntry(s, r)?.title ?? 'Gone';
    return i === stack.length - 1 && !q ? `<b>${esc(t)}</b>` : `<a data-crumb="${i}">${esc(t)}</a>`;
  }).join(' › ');
  layer.classList.add('open');
  layer.dataset.key = key;
  layer.innerHTML = `<aside class="v4-codex v4-panel" role="dialog" aria-label="Codex">
    <header><span class="v4-codex-kicker">Codex</span><input class="v4-codex-search" type="search" placeholder="Search rules…" value="${esc(q)}" aria-label="Search rules">
      <a class="v4-codex-rules" data-codex-ref="rules">Rules</a><button class="v4-codex-x" data-codex-close aria-label="Close the Codex">✕</button></header>
    <nav class="v4-codex-crumbs">${stack.length > 1 || q ? '<button class="v4-codex-back" data-codex-back>‹ Back</button>' : ''}<span>${crumbs}${q ? ' › <b>search</b>' : ''}</span></nav>
    <div class="v4-codex-body">${entryHTML(entry)}</div>
    <footer>Right-click, or hover and press C, on anything · Esc closes · the match carries on</footer>
  </aside>`;
  const nb = layer.querySelector('.v4-codex-body');
  if (nb) nb.scrollTop = scroll;
  if (focused) {
    const again = layer.querySelector('.v4-codex-search');
    again.focus();
    again.setSelectionRange(caret, caret);
  }
}
