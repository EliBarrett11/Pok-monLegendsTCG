// Drawing a v2 match, in the approved information look (v2 Feedback B:
// docs/design/v2-info-A2.jpg, the board and hand; v2-info-C.jpg, choosing targets):
//   - the prompt bar along the top: the current step and the options actually available now
//     (gold for a choice in progress, with Cancel);
//   - each player's Recognition on the left (with their piles);
//   - the board: two facing rows of 9 spaces. Board cards show only their art, ⚔ and ♥, and
//     keyword and status chips; a Type, Level or name appears (highlighted) only while a card or
//     effect that refers to it is in play. Locations are bold tiles, each with one compact panel
//     on the board's midline (name, objective, Weather, both progress bars, Rounds left; the
//     rewards on hover and in the Codex). Trainers are slim tabs with three tier bars;
//   - the side panel: Round with a Championship countdown, Energy as the standout tile, the last
//     action, Pass, Log · Rules; Trainer Points, Bag, Weather and Growth only when relevant;
//   - the hand, which carries the most information: cost, Level and cap, type line, full text
//     and stats. Playable cards glow; the others dim and say why on hover. A selected Pokémon
//     shows ▲ ▼ (its other Levels, dimmed previews); a Strategy Card shows its highest
//     affordable version, ▲ ▼ for the others.
// Right-click anything (or hover + Space) for the Codex (codex.js). Every icon is coded (V7a).
import {
  legalTargets, playable, placeable, locationStarts, locationAt, weatherTotals, championship, champRoundOf, targetOf,
  isAlert, passEndsPhase, passSpends, summonCost, targetOptions, breakpointsFor, playableStrategies,
  playableSupporters, playableItems, usableBagItems, itemUsable, bagFull, favourMet, bracket, trainTop,
  trainerAt, tiersUnlocked, playableTrainers, canMoveTrainer, usableAbilities, freeSpaces, legalActions,
  pickOptions, nurtureSpaces, nurtureCost, choiceCards, alertSpaces, opponentOf,
} from '../engine/game.js';
import { costRange, BAG_SIZE, FAVOURS } from '../engine/cardtypes.js';
import { LANES, ROUND_LIMIT } from '../engine/rules.js';
import { rewardText, lastsText } from '../engine/locations.js';
import { seriesDef, pokemonAt } from '../engine/series.js';
import { whyNot, strategyVersions, targetNote, attackNote, targetWhyNot } from '../engine/explain.js';
import { WEATHER_BRACKETS } from '../engine/glossary.js';
import { icon, typeIcon, attackIcon, strengthIcon, weatherIcon } from './icons.js';
import { statusLevel } from './vfx/library.js';
import { SPEEDS, getSpeed } from '../../../src/ui/settings.js';
import { promptFor } from './prompt.js';
import { drawCodex, openCodex } from './codex.js';

const ASSETS = '../assets';   // the shared art, from the page (v2/index.html)
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

// --- Hints (Feedback B, 8): Full / Minimal / Off, beside the speed picker ------------------------
const HINTS_KEY = 'pokemon-legends-v2-hints';
export const HINTS = { full: 'Full', minimal: 'Minimal', off: 'Off' };
let hints = 'full';
try { hints = HINTS[localStorage.getItem(HINTS_KEY)] ? localStorage.getItem(HINTS_KEY) : 'full'; } catch { /* default */ }
export const getHints = () => hints;
export function setHints(v) {
  hints = HINTS[v] ? v : 'full';
  try { localStorage.setItem(HINTS_KEY, hints); } catch { /* this session only */ }
}
// A hover reason, unless hints are Off (the Codex stays available).
const tip = (text) => (text && hints !== 'off' ? ` data-tip="${esc(text)}"` : '');

// The view on screen (for the Codex).
let shownView = null;
export const currentView = () => shownView;

// --- Cards -------------------------------------------------------------------------------------------

const artUrl = (c) => (c.art ? `${ASSETS}/cards/${c.art}.jpg` : `${ASSETS}/ui/frame-item.jpg`);
const pokemonArt = (card) => (card.art === null ? `${ASSETS}/ui/frame-pokemon.jpg` : `${ASSETS}/cards/${card.art ?? card.id}.jpg`);
const stats = (card, strength = card.currentStrength ?? card.strength) => `<div class="v2-stats"><span title="${card.attackType} Attack">${attackIcon(card.attackType)}${card.attack}</span><span class="${strength < card.strength ? 'hurt' : ''}" title="${card.strengthType}">${strengthIcon(card.strengthType)}${strength}</span></div>`;

// Keyword chips: numbered keywords summed (Scorch 1 + Scorch 1 = Scorch 2), the others once.
function keywordChips(card) {
  const sums = new Map();
  for (const k of card.keywords ?? []) {
    const m = /^(.*) (\d+)$/.exec(k);
    const name = m ? m[1] : k;
    sums.set(name, m ? (sums.get(name) ?? 0) + Number(m[2]) : 0);
  }
  return [...sums].filter(([name]) => name !== 'Big Root').map(([name, n]) => (n ? `${name} ${n}` : name));
}
function statusChips(card) {
  return [card.burn && `<i class="burn">${icon('burn')}Burn ${card.burn}</i>`, card.asleep && `<i class="sleep">${icon('sleep')}Asleep</i>`,
    card.seededBy && `<i class="seed">${icon('seed')}Seeded</i>`].filter(Boolean).join('');
}

// A Pokémon on the board (A2): art, ⚔ and ♥, keyword and status chips only. Its Level, Type and
// name are there but hidden, shown (highlighted) when something in play refers to them.
function boardCard(card, who, space, opts = {}) {
  const cls = ['v2-card', 'v2-mon', opts.cls, card.spent && 'spent', opts.alert && 'alert', card.empowered && 'empowered', ...(opts.reveal ?? []).map((r) => `rv-${r}`)].filter(Boolean).join(' ');
  const vfx = `data-ptype="${card.type}" data-atype="${card.attackType}"${card.burn ? ` data-status-burn="${statusLevel('burn', card.burn)}"` : ''}${card.asleep ? ' data-status-sleep="1"' : ''}${card.seededBy ? ' data-status-leechseed="1"' : ''}`;
  const keys = keywordChips(card).map((k) => `<i>${esc(k)}</i>`).join('');
  return `<div class="${cls}" ${vfx} data-type="${card.type}" data-level="${card.level}" data-name="${esc(card.name)}" data-codex="mon:${who}:${space}"${opts.tip ? tip(opts.tip) : ''}>
    <div class="v2-art" style="background-image: url('${pokemonArt(card)}')"></div>
    <span class="v2-chips">${keys}${statusChips(card)}</span>
    <span class="v2-rvtags"><i class="rv-level">Lv ${card.level}</i><i class="rv-type">${typeIcon(card.type)}${card.type}</i><i class="rv-name">${esc(card.name)}</i></span>
    ${card.held ? `<img class="v2-held" src="${artUrl(card.held)}" alt="${esc(card.held.name)}">` : ''}
    ${stats(card)}
    ${opts.number ? `<span class="v2-pick-no">${opts.number}</span>` : ''}
    ${opts.badge ? `<span class="v2-flourish">${opts.badge}</span>` : ''}
  </div>`;
}

// A card in hand (A2): it carries the most information. version: a Strategy's shown breakpoint.
function handCard(state, card, opts = {}) {
  const kind = card.cardType === 'Pokémon' ? 'pokemon' : card.cardType.toLowerCase();
  const cls = ['v2-card', 'v2-hcard', `k-${kind}`, opts.cls].filter(Boolean).join(' ');
  let corner = '';
  let cost = '';
  let line = '';
  let body = '';
  let foot = '';
  let art = artUrl(card);
  switch (card.cardType) {
    case 'Pokémon': {
      art = pokemonArt(card);
      const s = seriesDef(card.series);
      corner = card.legendary ? `<span class="v2-hlevel legend" title="Legendary">${icon('legendary')}</span>` : `<span class="v2-hlevel">Lv ${card.level}<small>/${card.cap}</small></span>`;
      cost = `<span class="v2-hcost">${opts.cost ?? card.cost}</span>`;
      line = card.legendary ? `Legendary · ${card.type}` : [card.type, card.attackType, card.speed, s && s.weight !== 'standard' ? s.weight : null, card.strengthType !== 'Hitpoints' ? (card.strengthType === 'Defence' ? 'Def guard' : 'Sp. Def guard') : null].filter(Boolean).join(' · ');
      body = [card.ability?.text, card.empower && `Empower +${card.empower.cost}: ${card.empower.text}`, !card.ability?.text && keywordChips(card).join(', ')].filter(Boolean).map((t) => `<p>${esc(t)}</p>`).join('');
      foot = stats(card, card.strength);
      break;
    }
    case 'Strategy': {
      const v = opts.version ?? { cost: card.breakpoints[0].cost, text: card.breakpoints[0].text };
      cost = `<span class="v2-hcost">${v.cost}</span>`;
      line = `Strategy · ${v.cost} of ${card.breakpoints.map((b) => b.cost).join(' / ')} Energy`;
      body = `<p><b>${v.cost}:</b> ${esc(v.text)}</p>`;
      break;
    }
    case 'Supporter':
      cost = '<span class="v2-hcost">0</span>';
      line = `Supporter · Release ${card.release}`;
      body = `<p>${esc(card.text)}</p><p class="favour"><b>Favour</b> (${esc(FAVOURS[card.favour.condition].text)}): ${esc(card.favour.text)}</p>`;
      break;
    case 'Item':
      cost = `<span class="v2-hcost">${card.cost}</span>`;
      line = `Item · ${card.kind}`;
      body = `<p>${esc(card.text)}</p>`;
      break;
    case 'Trainer':
      cost = `<span class="v2-hcost">${card.cost}</span>`;
      line = `Trainer · tiers ${card.tiers.map((t) => t.cost).join('/')}`;
      body = card.tiers.map((t) => `<p><b>${t.cost} ${t.kind}:</b> ${esc(t.text)}</p>`).join('');
      break;
    case 'Location':
      art = `${ASSETS}/cards/${card.art ?? card.id}.jpg`;
      line = `Location · ${card.lanes} lane${card.lanes > 1 ? 's' : ''} · ${card.rounds} Rounds`;
      body = `<p>${esc(card.objective.text)}</p>`;
      break;
    default:
  }
  return `<div class="${cls}" ${opts.attrs ?? ''}${card.cardType === 'Location' ? ` style="--loc: ${card.color}"` : ''}${opts.tip ? tip(opts.tip) : ''}>
    <div class="v2-art" style="background-image: url('${art}')"></div>
    ${corner}${cost}
    <div class="v2-htext"><b class="v2-hname">${esc(card.name)}</b><small class="v2-hline">${esc(line)}</small><div class="v2-hbody">${body}</div></div>
    ${foot}
    ${opts.badge ? `<span class="v2-flourish">${opts.badge}</span>` : ''}
  </div>`;
}

// Strategy, Supporter and Item cards (V4) for the presenter's reveal (present.js).
function actionCard(card) { return handCard(null, card, { version: card.breakpoints ? { cost: card.breakpoints.at(-1).cost, text: card.breakpoints.at(-1).text } : undefined }); }

// --- What a card or effect refers to (Feedback B, 1): Types, Levels, names --------------------------
const TYPES = ['Fire', 'Water', 'Grass', 'Electric', 'Normal', 'Fighting', 'Dark', 'Ghost', 'Dragon', 'Bug', 'Rock'];
function refersTo(texts, boardNames) {
  const text = texts.filter(Boolean).join(' ');
  return {
    types: TYPES.filter((t) => new RegExp(`\\b${t}\\b`).test(text)),
    level: /\bLevel\b/.test(text),
    names: boardNames.filter((n) => new RegExp(`\\b${n}\\b`).test(text)),
  };
}
function cardTexts(card) {
  if (!card) return [];
  return [card.text, card.favour?.text, card.favour && FAVOURS[card.favour.condition]?.text, ...(card.breakpoints ?? []).map((b) => b.text),
    ...(card.tiers ?? []).map((t) => t.text), card.ability?.text, card.objective?.text, card.empower?.text];
}
// The reveal classes for a Pokémon on the board, given what is referred to now.
function revealFor(card, ref) {
  if (!ref) return [];
  return [ref.types.includes(card.type) && 'type', ref.level && 'level', ref.names.includes(card.name) && 'name'].filter(Boolean);
}

// --- The prompt bar ---------------------------------------------------------------------------------
function promptBar(p) {
  const text = hints === 'full' ? p.text : p.short;
  return `<div class="v2-prompt${p.gold ? ' gold' : ''}" role="status">
    ${p.tag ? `<span class="v2-prompt-tag">${esc(p.tag)}</span>` : ''}<span class="v2-prompt-text">${text}</span>
    <span class="v2-prompt-buttons">${p.buttons.map((b) => `<button data-prompt="${b.action}"${b.disabled ? ' disabled' : ''}>${esc(b.label)}</button>`).join('')}</span>
  </div>`;
}

// --- Recognition (left) -----------------------------------------------------------------------------
function recognitionPanel(state, who, ui, choose) {
  const p = state.players[who];
  const target = targetOf(state);
  const pct = Math.min(100, (100 * p.recognition) / target);
  const turn = state.phase === 'battle' && state.turn === who;
  const attackable = choose.attack.some((t) => t.kind === 'player') && who === 'ai';
  const effect = choose.options.some((o) => o.who === who && o.kind === 'player');
  const chosenAt = (ui.pending?.chosen ?? []).findIndex((o) => o.who === who && o.kind === 'player');
  const less = bracket(state, 'Rain', 4) ? 1 : 0;
  let hover = '';
  if (ui.attacker !== null && who === 'ai') hover = attackNote(state, 'player', ui.attacker, { kind: 'player' });
  else if (ui.pending?.spec.kinds.includes('player')) hover = targetNote(state, 'player', ui.pending.spec, { who, kind: 'player' }, ui.pending.ops ?? [], ui.pending.ctx ?? {});
  const cls = ['v2-panel', 'v2-recognition', who === 'ai' ? 'top' : 'bottom', attackable && 'target', effect && 'effect-target', chosenAt >= 0 && 'chosen', turn && 'turn', p.burn && 'burning'].filter(Boolean).join(' ');
  return `<section class="${cls}" data-player="${who}" data-codex="rec:${who}"${tip(hover)}>
    ${p.burn ? `<div class="v2-pc-burn">${icon('burn')} Burn ${p.burn} <small>−${Math.max(0, p.burn - less)} at Supper</small></div>` : ''}
    <h3>${who === 'ai' ? 'Opponent' : 'You'}</h3>
    <b class="v2-score">${p.recognition}</b>
    <div class="v2-of">of ${target}${attackable || effect ? ' · a target' : ''}</div>
    <div class="v2-bar"><i style="width: ${pct}%"></i></div>
    ${chosenAt >= 0 ? `<span class="v2-pick-no">${chosenAt + 1}</span>` : ''}
    ${piles(state, who)}
  </section>`;
}
function piles(state, who) {
  const p = state.players[who];
  const cls = who === 'player' ? 'v2-piles' : 'v2-opp-piles';
  return `<div class="${cls}">
    ${who === 'ai' ? `<span class="v2-opp-hand">Hand ${p.hand.length}</span>` : ''}
    <span data-codex="pile:${who}:draw">Draw ${p.drawPile.length}</span><span data-codex="pile:${who}:discard">Discard ${p.discard.length}</span><span data-codex="pile:${who}:released">Released ${p.released.length}</span>
  </div>`;
}

// --- The board ----------------------------------------------------------------------------------------
function row(state, who, ui, choose, ref) {
  const mine = who === 'player';
  const p = state.players[who];
  const treeSpace = p.growth > 0 ? [...p.row.keys()].reverse().find((i) => !p.row[i]) : undefined;
  const spaces = Array.from({ length: LANES }, (_, space) => {
    const card = p.row[space];
    const loc = locationAt(state, space);
    const summonHere = mine && ui.summon && !card;
    const attackTarget = !mine && choose.attack.some((t) => t.kind === 'pokemon' && t.space === space);
    const attacker = mine && ui.attacker === space;
    const effect = choose.options.some((o) => o.who === who && o.kind === 'pokemon' && o.space === space);
    const chosenAt = (ui.pending?.chosen ?? []).findIndex((o) => o.who === who && o.kind === 'pokemon' && o.space === space);
    const alert = card && isAlert(state, card) && state.phase === 'battle';
    const canAct = mine && alert && state.turn === 'player' && !ui.locked && legalTargets(state, 'player', space).length;
    const trained = card && state.events.find((e) => e.type === 'trained' && e.who === who && e.space === space);
    const trainer = trainerAt(state, who, space);
    const placeHere = mine && ((ui.trainer || ui.moveTrainer) && !trainer);
    const partnerHere = mine && !card && partnerWaitingNow(state, ui);
    const arrived = card && state.events.find((e) => e.type === 'partnerArrived' && e.who === who && e.space === space);
    const cls = ['v2-space', loc && 'in-loc', summonHere && !ui.pending && 'target', attackTarget && 'attack-target', attacker && 'selected', effect && 'effect-target', chosenAt >= 0 && 'chosen',
      placeHere && 'trainer-target', partnerHere && 'partner-target', arrived && 'partner-arrive'].filter(Boolean).join(' ');
    // Hover: what clicking it will do, or why it can't be chosen.
    let hover = '';
    if (card && attackTarget) hover = attackNote(state, 'player', ui.attacker, { kind: 'pokemon', space });
    else if (card && ui.pending) hover = targetNote(state, 'player', ui.pending.spec, { who, kind: 'pokemon', space }, ui.pending.ops ?? [], ui.pending.ctx ?? {});
    else if (card && canAct && !ui.pending && ui.attacker === null) hover = `${card.name} · Alert: click to attack`;
    const cardCls = [canAct && !ui.pending && 'selectable', trained && 'levelup', card?.asleep && 'asleep', card?.burn && 'burning', card?.seededBy && 'seeded'].filter(Boolean).join(' ');
    const reveal = card ? revealFor(card, ref) : [];
    const face = card ? boardCard(card, who, space, { alert, cls: cardCls, reveal, tip: hover, number: chosenAt >= 0 ? chosenAt + 1 : 0, badge: trained ? `Level ${trained.to}${trained.name !== trained.fromName ? ` · ${trained.name}!` : ''}` : '' }) : '';
    const tree = space === treeSpace ? growthTree(p.growth) : '';
    const spaceTip = summonHere ? 'click to summon it here' : partnerHere ? 'click to place the Partner here' : placeHere ? 'click to put the Trainer here' : '';
    return `<div class="${cls}" data-who="${who}" data-space="${space}"${loc ? ` style="--loc: ${loc.color}"` : ''}${!card && spaceTip ? tip(`Space ${space + 1} · ${spaceTip}`) : ''}>${tree}${face}${arrived ? '<span class="v2-flourish partner">Partner!</span>' : ''}${trainer ? trainerTab(state, who, trainer, ui) : ''}</div>`;
  }).join('');
  return `<div class="v2-row ${who === 'ai' ? 'opponent' : 'player'}">${spaces}</div>`;
}

const partnerWaitingNow = (state, ui) => state.phase === 'battle' && state.turn === 'player' && !ui.locked && !ui.pending
  && state.players.player.waiting.length > 0 && legalActions(state, 'player').includes('placePartner');

const GROWTH_STAGES = [1, 3, 5, 8];
function growthTree(n) {
  const stage = GROWTH_STAGES.filter((m) => n >= m).length;
  return `<div class="v2-growth" style="background-image: url('${ASSETS}/ui/growth-${stage}.jpg')"><b>${icon('growth')}${n}</b><span>Growth</span></div>`;
}

// A Trainer (A2): the slim tab, its name and three tier bars.
function trainerTab(state, who, t, ui) {
  const lit = tiersUnlocked(t);
  const mine = who === 'player' && state.phase === 'battle' && state.turn === 'player' && !ui.locked && !ui.pending;
  const ability = who === 'player' && usableAbilities(state, 'player').some((x) => x.uid === t.uid);
  const moved = state.events.some((e) => e.type === 'trainerMoved' && e.uid === t.uid);
  const unlocked = state.events.some((e) => e.type === 'tierUnlocked' && e.uid === t.uid);
  const cls = ['v2-trainer', who === 'ai' ? 'top' : 'bottom', mine && 'clickable', ability && mine && 'ability', moved && 'moved', unlocked && 'unlocked'].filter(Boolean).join(' ');
  const next = t.tiers.find((x) => x.cost > t.points);
  const hover = `${t.name} · ${t.points}/${t.tiers[2].cost} Trainer Points${next ? ` · ${next.kind} at ${next.cost}` : ' · every tier unlocked'}${mine ? ' · click for its Ability or to move it' : ''}`;
  return `<div class="${cls}" data-trainer="${t.uid}" data-codex="trainer:${who}:${t.uid}"${tip(hover)}>
    <i class="v2-tab-art" style="background-image: url('${ASSETS}/cards/${t.art}.jpg')"></i>
    <b>${esc(t.name)}</b>
    <span class="v2-pips">${t.tiers.map((x, i) => `<i class="${i < lit ? 'lit' : ''}"></i>`).join('')}</span>
    ${moved ? '<span class="v2-moved">↔</span>' : ''}
  </div>`;
}

// A progress bar with milestone ticks.
function progressBar(loc, who) {
  const count = loc.objective.count;
  const n = loc.progress[who];
  const ticks = loc.milestones.map((m) => `<i class="tick${loc.reached[who].includes(m.at) ? ' hit' : ''}" style="left: ${(100 * m.at) / count}%"></i>`).join('');
  return `<div class="v2-prog ${who}${loc.completed[who] ? ' done' : ''}"><span>${who === 'player' ? 'You' : 'Opp'}</span>
    <div class="v2-prog-bar"><b style="width: ${(100 * n) / count}%"></b>${ticks}</div><em>${n}/${count}</em></div>`;
}
const weatherIcons = (weather = {}) => Object.entries(weather ?? {}).filter(([, n]) => n).map(([kind, n]) => `<span class="v2-wx">${weatherIcon(kind)}${n}</span>`).join('');

// Locations (A2, Elliott's change): bold tiles, one compact panel on the midline, the same
// height for every width; the rewards on hover (a small card beside it) and in the Codex.
function locationLayer(state, ui, choose) {
  const locTargets = new Set(choose.options.filter((o) => o.kind === 'location').map((o) => o.id));
  const flash = new Set(state.events.filter((e) => ['milestone', 'completed', 'locationPlaced', 'championship'].includes(e.type)).map((e) => e.location ?? e.uid));
  const frames = state.locations.map((loc) => {
    const width = loc.lanes.length;
    const rewards = [...loc.milestones.map((m) => `<li><b>${m.at}:</b> ${esc(rewardText(m.reward))}</li>`), `<li><b>Done (${loc.objective.count}):</b> ${esc(rewardText(loc.completion))}</li>`].join('');
    const side = loc.lanes[0] >= 5 ? 'left' : 'right';
    return `<div class="v2-loc w${width}${loc.championship ? ' champ' : ''}${flash.has(loc.uid) ? ' flash' : ''}${locTargets.has(loc.uid) ? ' loc-target' : ''}" data-loc-target="${loc.uid}" style="grid-column: ${loc.lanes[0] + 1} / span ${width}; --loc: ${loc.color}">
        <div class="v2-loc-art" style="background-image: url('${ASSETS}/${loc.image.replace(/^assets\//, '')}')"></div>
        <div class="v2-loc-banner" data-codex="${loc.championship ? 'champ' : `loc:${loc.uid}`}">
          <header><h4>${esc(loc.name)}</h4><span class="v2-rounds">${icon('timer')}${loc.roundsLeft}</span></header>
          <p>${esc(loc.objective.text)} <span class="v2-loc-wx">${weatherIcons(loc.weather)}</span></p>
          ${progressBar(loc, 'player')}${progressBar(loc, 'ai')}
          <aside class="v2-loc-rewards ${side}"><h6>${esc(loc.name)} · rewards</h6><ul>${rewards}</ul><small>${loc.roundsLeft} Round${loc.roundsLeft === 1 ? '' : 's'} left · right-click for more</small></aside>
        </div>
      </div>`;
  }).join('');
  const pick = ui.location ? state.players.player.hand.find((c) => c.uid === ui.location) : null;
  const starts = pick ? locationStarts(state, pick) : [];
  const lanes = Array.from({ length: LANES }, (_, lane) => {
    if (locationAt(state, lane)) return '';
    const can = starts.includes(lane);
    const home = locTargets.has(`home-${lane}`);
    return `<div class="v2-lane${can ? ' pick' : ''}${home ? ' loc-target' : ''}" style="grid-column: ${lane + 1}" data-lane="${lane}"${home ? ` data-loc-target="home-${lane}"` : ''}${can ? tip(`Lane ${lane + 1} · click to place ${pick.name} here`) : ''}><span>${can ? 'Place here' : home ? 'Home lane (choose)' : 'Home'}</span></div>`;
  }).join('');
  const ghost = pick ? `<div class="v2-loc ghost" style="--loc: ${pick.color}; display: none"></div>` : '';
  return `<div class="v2-locs">${frames}${ghost}</div><div class="v2-lanes">${lanes}</div>`;
}

// --- The side panel (A2) ----------------------------------------------------------------------------
let lastEnergy = null;
function sidePanel(state, ui, ctx) {
  const me = state.players.player;
  const myTurn = state.phase === 'battle' && state.turn === 'player' && !ui.locked && !state.choices?.length;
  const champ = championship(state);
  const champIn = champRoundOf(state) - state.round;
  const chip = champ ? `Championship · ${champ.roundsLeft} left` : state.round && champIn > 0 ? `Championship in ${champIn}` : '';
  // Energy: "4 of 6 this Round", a crystal per point, dimming as spent, pulsing when it changes.
  const total = Math.max(me.energy, (me.energySources ?? []).reduce((n, x) => n + x.amount, 0));
  const pulse = lastEnergy !== null && lastEnergy !== me.energy;
  lastEnergy = me.energy;
  const crystals = Array.from({ length: total }, (_, i) => `<i class="${i < me.energy ? 'on' : ''}"></i>`).join('');
  const last = state.log.length ? state.log.at(-1) : '';
  // Pass (and Nurture) on your turn; Flip and New match otherwise.
  let act = '';
  if (state.phase === 'initiative') act = '<button data-action="flip" class="pass">Flip the coin</button>';
  else if (state.phase === 'gameOver') act = `<button data-action="new" class="pass"${ctx.endDisabled ? ' disabled' : ''}>${ctx.endLabel ?? 'New match'}</button>`;
  else if (myTurn && !ui.pending) {
    const ends = passEndsPhase(state);
    const spends = passSpends(state, 'player').length;
    const nurture = nurtureSpaces(state, 'player').length
      ? `<button data-action="nurture" class="v2-nurture"${tip(`Spend ${Math.min(...nurtureSpaces(state, 'player').map((sp) => nurtureCost(state, 'player', sp)))} Growth to train 1 one of your Pokémon`)}>Nurture</button>` : '';
    act = `${nurture}<button data-action="pass" class="pass"${tip(ends ? 'The Opponent passed last: this Pass ends the Battle Phase (no Energy)' : `+1 Energy${spends ? ` · ${spends} of yours become${spends === 1 ? 's' : ''} Spent (unmatched Speed)` : ''}`)}>Pass <small>${ends ? '(ends the Battle Phase)' : '(+1 Energy)'}</small></button>`;
  }
  const wx = weatherTotals(state);
  const wxOn = WEATHER_BRACKETS.filter((b) => bracket(state, b.kind, b.at));
  const showTp = me.trainerPoints > 0 || me.trainers.length > 0;
  return `
    <aside class="v2-side">
      <section class="v2-panel v2-sidemain">
        <div class="v2-roundline" data-codex="champ"><span class="v2-label">Round ${state.round || '—'}</span>${state.suddenDeath ? '<span class="v2-champ-chip">sudden death</span>' : chip ? `<span class="v2-champ-chip${champ ? ' live' : ''}">${chip}</span>` : `<span class="v2-champ-chip">of ${ROUND_LIMIT}</span>`}</div>
        <div class="v2-energy${pulse ? ' pulse' : ''}" data-codex="energy:player"${tip(`${me.energy} Energy left of ${total} this Round${me.stored ? ` (${me.stored} stored)` : ''}${me.bonusNext ? ` · +${me.bonusNext} next Round` : ''}`)}>
          <div class="v2-label">Energy</div><b>${me.energy}</b><span>of ${total} this Round</span><div class="v2-crystals">${crystals}</div>
        </div>
        ${last ? `<p class="v2-last" data-codex="log:${state.log.length - 1}"><small>Last:</small> ${esc(last)}</p>` : ''}
        <div class="v2-act">${act}</div>
        <div class="v2-logrules"><button data-codex-open="log">Log</button><button data-codex-open="rules">Rules</button></div>
      </section>
      ${showTp ? `<section class="v2-panel v2-tp" data-codex="term:trainer-points"><div class="v2-label">Trainer Points <b>${icon('star')} ${me.trainerPoints}</b></div>
        <p class="v2-note">${me.trainerPoints ? 'to assign at Breakfast' : 'none to assign'}${me.trainers.length ? ` · move ${me.movedTrainer ? 'used' : 'available'}` : ''}</p></section>` : ''}
      ${me.bag.length ? bagPanel(state, ui) : ''}
      ${wxOn.length ? `<section class="v2-panel v2-wxpanel" data-codex="weather"><div class="v2-wx-row">${['Rain', 'Sun'].filter((k) => wx[k]).map((k) => `<span class="v2-wx big">${weatherIcon(k)}${wx[k]}</span>`).join('')}</div>${wxOn.map((b) => `<p class="v2-note on"><b>${b.kind} ${b.at}:</b> ${esc(b.text)}</p>`).join('')}</section>` : ''}
      ${me.growth > 0 ? `<section class="v2-panel v2-growthpanel" data-codex="term:growth"><div class="v2-label">${icon('growth')} Growth <b>${me.growth}</b></div><p class="v2-note">Opponent ${state.players.ai.growth}${nurtureSpaces(state, 'player').length ? ' · Nurture available' : ''}</p></section>` : ''}
      <div class="v2-build">
        <p>${esc(ctx.build)}${ctx.playing ? ` · ${esc(ctx.playing.player)} vs ${esc(ctx.playing.ai)}` : ''}</p>
        <p><a href="../">the current game</a> · ${ctx.mode && ctx.mode !== 'ai' ? `<button class="v2-linkbtn" data-action="leave">Leave match</button>` : `<button class="v2-linkbtn" data-action="deck">${ctx.customDeck ? 'Your deck' : 'Deck builder'}</button>`}</p>
        <label class="v2-speed-pick">Animations <select data-speed>${Object.entries(SPEEDS).map(([k, v]) => `<option value="${k}"${k === getSpeed() ? ' selected' : ''}>${v.label}</option>`).join('')}</select></label>
        <label class="v2-speed-pick">Hints <select data-hints>${Object.entries(HINTS).map(([k, v]) => `<option value="${k}"${k === hints ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
      </div>
    </aside>`;
}

function bagPanel(state, ui) {
  const me = state.players.player;
  const mine = state.phase === 'battle' && state.turn === 'player' && !ui.locked && !ui.pending;
  const usable = new Set(mine ? usableBagItems(state, 'player').map((c) => c.uid) : []);
  const slots = Array.from({ length: BAG_SIZE }, (_, i) => {
    const c = me.bag[i];
    if (!c) return '<i></i>';
    return `<i class="item${usable.has(c.uid) ? ' usable' : ''}" data-bag="${c.uid}" data-codex="card:${c.uid}" style="background-image: url('${artUrl(c)}')"${tip(`${c.name} (${c.kind}): ${c.text}${usable.has(c.uid) ? ' · click to use it (0 Energy)' : mine ? ' · nothing to use it on now' : ''}`)}></i>`;
  }).join('');
  return `<section class="v2-panel v2-bagpanel"><div class="v2-label">Bag <small>${me.bag.length}/${BAG_SIZE}</small></div><div class="v2-bag">${slots}</div></section>`;
}

// --- Choosing targets ---------------------------------------------------------------------------------
function pendingOptions(state, ui) {
  const pend = ui?.pending;
  if (!pend) return [];
  return [...targetOptions(state, 'player', pend.spec, pend.ctx ?? {}), ...(pend.extra ?? [])];
}

// --- The hand -----------------------------------------------------------------------------------------
const BAND = 1100;
const CARD_W = 160;
function hand(state, ui) {
  const me = state.players.player;
  const cards = me.hand;
  const mine = state.phase === 'battle' && state.turn === 'player' && !ui.locked && !state.choices?.length;
  const can = new Set(mine && !ui.pending ? [...playable(state, 'player'), ...placeable(state, 'player'), ...playableStrategies(state, 'player'),
    ...playableSupporters(state, 'player'), ...playableItems(state, 'player'), ...playableTrainers(state, 'player')].map((c) => c.uid) : []);
  const n = cards.length;
  const step = n > 1 ? Math.min(CARD_W + 12, (BAND - CARD_W) / (n - 1)) : 0;
  const start = (BAND - (CARD_W + step * (n - 1))) / 2;
  const selected = ui.summon ?? ui.location ?? ui.trainer ?? ui.strategy ?? (ui.preview?.look ? ui.preview.uid : null);
  let preview = '';
  const slots = cards.map((c, i) => {
    const picked = selected === c.uid;
    const playableNow = can.has(c.uid);
    const reason = mine && !playableNow && !ui.pending ? whyNot(state, 'player', c) : null;
    let version;
    let strategyCan = playableNow;
    if (c.cardType === 'Strategy') {
      const sv = strategyVersions(state, 'player', c, ui.version?.[c.uid]);
      version = sv.versions[sv.shown];
      strategyCan = sv.can;
    }
    const cost = c.cardType === 'Pokémon' ? Math.min(...[...Array(LANES).keys()].filter((sp) => !me.row[sp]).map((sp) => summonCost(c, false, state, 'player', sp)).concat(c.cost)) : undefined;
    const up = state.events.find((e) => e.type === 'levelUp' && e.uid === c.uid);
    const cls = [playableNow ? 'playable' : mine ? 'dim' : 'idle', picked && 'picked', up && 'levelup'].filter(Boolean).join(' ');
    const hover = reason ? `${c.name} · ${reason}` : playableNow && !picked ? `${c.name} · click to ${c.cardType === 'Pokémon' ? 'choose where to summon it' : c.cardType === 'Location' ? 'choose where to place it' : c.cardType === 'Strategy' ? 'select it (▲ ▼ for its versions)' : 'play it'}` : '';
    const attrs = `data-uid="${c.uid}" data-kind="${c.cardType.toLowerCase().replace('é', 'e')}" data-codex="card:${c.uid}"`;
    const face = handCard(state, c, { cls, attrs, tip: hover, version, cost, badge: up ? `Evolved: ${up.to}!` : '' });
    const left = Math.round(start + step * i);
    const arrows = picked && (c.cardType === 'Pokémon' && !c.legendary || c.cardType === 'Strategy' && c.breakpoints.length > 1) ? versionArrows(c, ui, version) : '';
    if (picked) preview = previewCard(state, c, ui, left);
    return `<div class="v2-hand-slot${picked ? ' picked' : ''}${strategyCan ? '' : ''}" style="left: ${left}px; z-index: ${picked ? 30 : i + 1}">${arrows}${face}</div>`;
  }).join('');
  return `<div class="v2-hand">${slots}${preview}</div>`;
}

// ▲ above and ▼ below a selected card: a Pokémon's next and earlier Levels, a Strategy's versions.
function versionArrows(c, ui, version) {
  const off = ui.preview?.uid === c.uid ? ui.preview.offset : 0;
  let up = false;
  let down = false;
  if (c.cardType === 'Pokémon') {
    up = c.level + off < c.cap;
    down = c.level + off > 1;
  } else {
    const at = c.breakpoints.findIndex((b) => b.cost === version.cost) + off;
    up = at < c.breakpoints.length - 1;
    down = at > 0;
  }
  return `<button class="v2-ver up" data-ver="1"${up ? '' : ' disabled'} aria-label="Show the next version">▲</button><button class="v2-ver down" data-ver="-1"${down ? '' : ' disabled'} aria-label="Show the earlier version">▼</button>`;
}

// The dimmed preview above the hand (viewable, not playable).
function previewCard(state, c, ui, left) {
  const off = ui.preview?.uid === c.uid ? ui.preview.offset : 0;
  if (!off) return '';
  if (c.cardType === 'Pokémon') {
    const level = c.level + off;
    const at = { ...pokemonAt(c.series, level), cap: c.cap, uid: c.uid };
    const label = off > 0 ? `Level ${level} · from Round ${level}${level > c.cap ? '' : ''}` : `Level ${level} · earlier`;
    return `<div class="v2-preview" style="left: ${left}px"><span class="v2-preview-tag">${esc(label)}</span>${handCard(state, at, { cls: 'preview' })}</div>`;
  }
  const sv = strategyVersions(state, 'player', c, ui.version?.[c.uid]);
  const idx = sv.shown + off;
  const v = sv.versions[idx];
  if (!v) return '';
  return `<div class="v2-preview" style="left: ${left}px"><span class="v2-preview-tag">${v.can ? `${v.cost} Energy · click to play this version` : `${esc(v.why)} · you have ${state.players.player.energy}`}</span>${handCard(state, c, { cls: `preview${v.can ? ' can' : ''}`, version: v, attrs: v.can ? `data-pick-version="${v.cost}"` : '' })}</div>`;
}

// --- Dialogs ------------------------------------------------------------------------------------------

function resultLine(state) {
  const r = state.result ?? {};
  const who = state.winner === 'player' ? 'You' : 'The Opponent';
  const champ = state.locations.find((l) => l.championship);
  switch (r.reason) {
    case 'target': return `${who} reached ${targetOf(state)} Recognition in Round ${state.round}${champ ? ', during the Championship' : ''}.`;
    case 'recognition': return `After Round ${ROUND_LIMIT}, ${who === 'You' ? 'you have' : 'the Opponent has'} the most Recognition.`;
    case 'championship': return `Tied on Recognition after Round ${ROUND_LIMIT}: ${who === 'You' ? 'you have' : 'the Opponent has'} more Championship progress (${champ?.progress.player ?? 0} to ${champ?.progress.ai ?? 0}).`;
    case 'suddenDeath': return `${who} won the sudden-death Round on Recognition.`;
    case 'draw': return 'Still tied after the sudden-death Round: a draw.';
    default: return 'Match over.';
  }
}

function empowerBox(state, ui) {
  const a = ui.empowerAsk;
  const card = a && state.players.player.hand.find((c) => c.uid === a.uid);
  if (!card) return '';
  const energy = state.players.player.energy;
  const plain = summonCost(card, false, state, 'player', a.space);
  const full = summonCost(card, true, state, 'player', a.space);
  return `<div class="v2-ask" role="dialog" aria-label="Empowered summon"><div class="v2-panel">
    <p>Summon <b>${esc(card.name)}</b> (Level ${card.level}) into space ${a.space + 1}.</p>
    <div class="v2-ask-buttons">
      <button data-action="summon-plain">Summon<small>${plain} Energy</small></button>
      <button data-action="summon-empowered"${full <= energy ? '' : ' disabled'}${full > energy ? tip(`Needs ${full} Energy · you have ${energy}`) : ''}>Empowered<small>${full} Energy · ${esc(card.empower.text)}</small></button>
    </div>
    <button data-action="summon-cancel" class="v2-ask-cancel">Cancel</button>
  </div></div>`;
}

function amountBox(state, ui) {
  const a = ui.ask;
  if (a?.kind !== 'amount') return '';
  return `<div class="v2-ask" role="dialog" aria-label="Spend Growth"><div class="v2-panel">
    <p>${esc(a.label)}: spend how much Growth? (1 to ${a.max})</p>
    <div class="v2-ask-buttons">
      <button data-action="amount-step" data-step="-1"${a.x <= 1 ? ' disabled' : ''}>−</button>
      <span class="v2-count big">${a.x} Growth → ${a.x} damage</span>
      <button data-action="amount-step" data-step="1"${a.x >= a.max ? ' disabled' : ''}>+</button>
    </div>
    <div class="v2-ask-buttons"><button data-action="amount-done">Choose the target</button></div>
    <button data-action="ask-cancel" class="v2-ask-cancel">Cancel</button>
  </div></div>`;
}

const tileArt = (c) => (c.cardType === 'Pokémon' ? pokemonArt(c) : c.cardType === 'Location' ? `${ASSETS}/cards/${c.art ?? c.id}.jpg` : artUrl(c));
// Choosing cards (V6): Search, Return, Burglar, Swimmer; Tracey's revealed cards (Feedback B).
function pickBox(state, ui) {
  const a = ui.ask;
  if (a?.kind !== 'pick') return '';
  const options = a.choice ? choiceCards(state, state.choices[0]) : pickOptions(state, 'player', a.op);
  const tile = (c) => `<button class="v2-rel${a.chosen.includes(c.uid) ? ' on' : ''}" data-pick="${c.uid}" data-codex="${c.uid ? `card:${c.uid}` : ''}" style="background-image: url('${tileArt(c)}')"${tip(`${c.name}${c.level && c.cardType === 'Pokémon' ? ` · Level ${c.level}` : ''} · ${c.cardType}`)}><span>${esc(c.name)}${c.level && c.cardType === 'Pokémon' ? ` L${c.level}` : ''}</span></button>`;
  const ready = a.choice ? a.chosen.length === a.n : a.chosen.length || !options.length;
  return `<div class="v2-ask" role="dialog" aria-label="Choose cards"><div class="v2-panel v2-release-ask">
    <p>${esc(a.label)}: ${a.choice ? `choose ${a.n}; the rest go to the bottom of your Draw Pile.` : `choose ${a.n === 1 ? 'one' : `up to ${a.n}`}.`}</p>
    <div class="v2-rels">${options.map(tile).join('') || '<p>Nothing matches.</p>'}</div>
    <div class="v2-ask-buttons"><button data-action="pick-done"${ready ? '' : ' disabled'}>${a.choice ? `Take ${a.chosen.length}/${a.n}` : 'Done'}</button></div>
  </div></div>`;
}

function spaceBox(state, ui) {
  const a = ui.ask;
  if (a?.kind !== 'space') return '';
  return `<div class="v2-ask" role="dialog" aria-label="Choose a space"><div class="v2-panel">
    <p>${esc(a.label)}: move it to which empty space?</p>
    <div class="v2-ask-buttons">${freeSpaces(state, 'player').map((i) => `<button data-space-pick="${i}">${i + 1}</button>`).join('')}</div>
    <button data-action="ask-cancel" class="v2-ask-cancel">Cancel</button>
  </div></div>`;
}

function releaseBox(state, ui) {
  const a = ui.ask;
  const card = a?.kind === 'release' && state.players.player.hand.find((c) => c.uid === a.uid);
  if (!card) return '';
  const others = state.players.player.hand.filter((c) => c !== card);
  const picked = others.filter((c) => a.chosen.includes(c.uid));
  const met = favourMet(card, picked);
  const test = FAVOURS[card.favour.condition].test;
  const tiles = others.map((c) => `<button class="v2-rel${a.chosen.includes(c.uid) ? ' on' : ''}${test(c) ? ' favour' : ''}" data-rel="${c.uid}" data-codex="card:${c.uid}" style="background-image: url('${tileArt(c)}')"${tip(`${c.name}${test(c) ? ' · meets the Favour' : ''}`)}><span>${esc(c.name)}${c.level ? ` L${c.level}` : ''}</span></button>`).join('');
  return `<div class="v2-ask" role="dialog" aria-label="Release cards"><div class="v2-panel v2-release-ask">
    <p><b>${esc(card.name)}</b>: Release ${card.release} card${card.release === 1 ? '' : 's'} from your hand (gone for the match). ${esc(card.text)}.</p>
    <p class="v2-rel-favour${met ? ' met' : ''}">Favour: Release ${esc(FAVOURS[card.favour.condition].text)} → ${esc(card.favour.text)} ${met ? '✓ met' : ''}</p>
    <div class="v2-rels">${tiles}</div>
    <div class="v2-ask-buttons"><button data-action="release-done"${picked.length === card.release ? '' : ' disabled'}>Release ${picked.length}/${card.release} and play</button></div>
    <button data-action="ask-cancel" class="v2-ask-cancel">Cancel</button>
  </div></div>`;
}

function itemBox(state, ui) {
  const a = ui.ask;
  const card = a?.kind === 'item' && state.players.player.hand.find((c) => c.uid === a.uid);
  if (!card) return '';
  const use = itemUsable(state, 'player', card);
  const full = bagFull(state, 'player');
  return `<div class="v2-ask" role="dialog" aria-label="Play an Item"><div class="v2-panel">
    <p><b>${esc(card.name)}</b> (${card.kind}, ${card.cost} Energy): ${esc(card.text)}</p>
    <div class="v2-ask-buttons">
      <button data-action="item-use"${use ? '' : ' disabled'}${use ? '' : tip('No legal target now')}>Use now<small>${card.cost} Energy</small></button>
      <button data-action="item-bag"${full ? ' disabled' : ''}${full ? tip('Your Bag is full') : ''}>Put in the Bag<small>${card.cost} Energy · use it later for 0</small></button>
    </div>
    <button data-action="ask-cancel" class="v2-ask-cancel">Cancel</button>
  </div></div>`;
}

function trainerBox(state, ui) {
  const a = ui.ask;
  const t = a?.kind === 'trainer' && state.players.player.trainers.find((x) => x.uid === a.uid);
  if (!t) return '';
  const lit = tiersUnlocked(t);
  const ab = t.tiers[1].ability;
  const canAbility = usableAbilities(state, 'player').some((x) => x.uid === t.uid);
  const why = lit < 2 ? `unlocks at ${t.tiers[1].cost} points` : t.abilityRound === state.round ? 'used this Round' : `${ab.cost} Energy`;
  return `<div class="v2-ask" role="dialog" aria-label="${esc(t.name)}"><div class="v2-panel v2-trainer-ask">
    <p><b>${esc(t.name)}</b> · ${t.points}/${t.tiers[2].cost} Trainer Points · space ${t.space + 1}</p>
    <ul class="v2-tiers">${t.tiers.map((x, i) => `<li class="${i < lit ? 'lit' : ''}"><b>${x.cost} · ${x.kind}</b> ${esc(x.text)}</li>`).join('')}</ul>
    <div class="v2-ask-buttons">
      <button data-action="trainer-ability"${canAbility ? '' : ' disabled'}>Ability<small>${why}</small></button>
      <button data-action="trainer-move"${canMoveTrainer(state, 'player') ? '' : ' disabled'}>Move<small>${state.players.player.movedTrainer ? 'used this Round' : 'once per Round'}</small></button>
    </div>
    <button data-action="ask-cancel" class="v2-ask-cancel">Close</button>
  </div></div>`;
}

function assignBox(state, ui) {
  if (state.phase !== 'assign' || !legalActions(state, 'player').includes('assignPoints')) return '';
  const p = state.players.player;
  const draft = ui.assignDraft ?? {};
  const used = Object.values(draft).reduce((a, b) => a + b, 0);
  const rows = p.trainers.map((t) => {
    const add = draft[t.uid] ?? 0;
    const total = t.points + add;
    const next = t.tiers.find((x) => x.cost > total);
    return `<div class="v2-assign-row" data-codex="trainer:player:${t.uid}">
      <i class="v2-portrait" style="background-image: url('${ASSETS}/cards/${t.art}.jpg')"></i>
      <div><b>${esc(t.name)}</b> <span class="v2-tpts">${total}/${t.tiers[2].cost}</span>
        <span class="v2-pips">${t.tiers.map((x) => `<i class="${total >= x.cost ? 'lit' : ''}">${x.kind}</i>`).join('')}</span>
        <small>${next ? `next: ${next.kind} at ${next.cost} (${esc(next.text)})` : 'every tier unlocked'}</small></div>
      <button data-assign="${t.uid}" data-step="-1"${add ? '' : ' disabled'}>−</button><span class="v2-count">+${add}</span>
      <button data-assign="${t.uid}" data-step="1"${used < p.trainerPoints && total < t.tiers[2].cost ? '' : ' disabled'}>+</button>
    </div>`;
  }).join('');
  return `<div class="v2-ask" role="dialog" aria-label="Assign Trainer Points"><div class="v2-panel v2-assign-ask">
    <p><b>Breakfast · Trainer Points</b>: ${p.trainerPoints - used} of ${p.trainerPoints} left to assign. Points stay on the Trainer; the Opponent assigns theirs at the same time, hidden until you both lock in.</p>
    ${rows}
    <div class="v2-ask-buttons"><button data-action="assign-lock">Lock in</button></div>
  </div></div>`;
}

function gameOver(state, ctx = {}) {
  if (state.phase !== 'gameOver') return '';
  const title = state.winner === 'player' ? 'Victory' : state.winner === 'ai' ? 'Defeat' : 'Draw';
  return `<div class="v2-over"><div class="v2-panel"><div class="v2-crest ${title.toLowerCase()}"><h2>${title}</h2></div>
    <p>${resultLine(state)}</p>
    <p>You ${state.players.player.recognition} · Opponent ${state.players.ai.recognition}</p>
    <button data-action="new"${ctx.endDisabled ? ' disabled' : ''}>${ctx.endLabel ?? 'New match'}</button>${ctx.mode && ctx.mode !== 'ai' ? ' <button data-action="leave" class="v2-ask-cancel">Leave</button>' : ''}</div></div>`;
}

// --- Drawing the match --------------------------------------------------------------------------------

export function renderMatch(root, state, ui, ctx) {
  shownView = state;
  ui.version ??= {};
  // A waiting choice of yours: an On Evolve target (the target picking) or Tracey's cards.
  const choice = state.choices?.[0];
  if (choice?.who === 'player' && !ui.locked) {
    if (choice.kind === 'pick' && ui.ask?.kind !== 'pick') {
      ui.ask = { kind: 'pick', choice: true, n: choice.take, total: choiceCards(state, choice).length, chosen: [], label: `${choice.name}: the top ${choiceCards(state, choice).length} cards` };
    } else if (choice.kind !== 'pick' && ui.pending?.action.type !== 'chooseTarget') {
      ui.pending = { action: { type: 'chooseTarget', who: 'player' }, spec: choice.spec, label: `${choice.name} (On Evolve): ${choice.text}`, chosen: [], extra: [], ops: choice.ops ?? [], ctx: choice.ctx };
    }
  }
  // Things that went stale (a card played, Energy changed): drop them.
  const inHand = (uid) => state.players.player.hand.some((c) => c.uid === uid);
  if (ui.strategy && !inHand(ui.strategy)) ui.strategy = null;
  if (ui.preview && !inHand(ui.preview.uid)) ui.preview = null;
  const attack = ui.attacker !== null && ui.attacker !== undefined && state.phase === 'battle' ? legalTargets(state, 'player', ui.attacker) : [];
  const choose = { attack, options: pendingOptions(state, ui) };
  const choosing = Boolean(ui.pending || attack.length || ui.summon || ui.location || ui.trainer || ui.moveTrainer);
  // What the selected card or effect refers to (Type, Level, name): matching Pokémon show it.
  const boardNames = ['player', 'ai'].flatMap((w) => state.players[w].row.filter(Boolean).map((c) => c.name));
  const selectedCard = state.players.player.hand.find((c) => c.uid === (ui.strategy ?? ui.trainer ?? ui.summon ?? ui.ask?.uid));
  const ref = ui.pending ? refersTo([ui.pending.label, ...(ui.pending.spec?.belowLevel !== undefined ? ['Level'] : [])], boardNames) : selectedCard ? refersTo(cardTexts(selectedCard), boardNames) : null;
  const prompt = promptFor(state, ui, { ...ctx, resultLine: state.phase === 'gameOver' ? resultLine(state) : '' });
  root.innerHTML = `
    <div class="v2-table fb${choosing ? ' choosing' : ''} hints-${hints}">
      ${promptBar(prompt)}
      ${recognitionPanel(state, 'ai', ui, choose)}
      ${recognitionPanel(state, 'player', ui, choose)}
      <section class="v2-board">
        <div class="v2-mat"></div>
        ${locationLayer(state, ui, choose)}
        ${row(state, 'ai', ui, choose, ref)}
        ${row(state, 'player', ui, choose, ref)}
      </section>
      ${sidePanel(state, ui, ctx)}
      ${hand(state, ui)}
      ${empowerBox(state, ui)}
      ${releaseBox(state, ui)}
      ${itemBox(state, ui)}
      ${amountBox(state, ui)}
      ${pickBox(state, ui)}
      ${spaceBox(state, ui)}
      ${trainerBox(state, ui)}
      ${assignBox(state, ui)}
      ${gameOver(state, ctx)}
      <div class="v2-tip" hidden></div>
    </div>`;
  wire(root, state, ui, ctx);
  wireTips(root, state);
  fitText(root);
  drawCodex();
}

// Nothing clipped (v2 Feedback A): text that doesn't fit its box is set smaller until it does.
const FIT = [['.v2-hbody', 8], ['.v2-hname', 11], ['.v2-hline', 8], ['.v2-loc-banner h4', 10], ['.v2-loc-banner p', 8], ['.v2-trainer b', 8], ['.v2-chips', 7], ['.v2-prompt-text', 13], ['.v2-last', 10]];
function fitText(root) {
  if (typeof getComputedStyle !== 'function') return;
  for (const [sel, min] of FIT) {
    for (const el of root.querySelectorAll(sel)) {
      let size = parseFloat(getComputedStyle(el).fontSize);
      for (let i = 0; i < 30 && size > min && (el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1); i++) {
        size -= 0.5;
        el.style.fontSize = `${size}px`;
      }
    }
  }
}

// Hover reasons (data-tip): a small card above the element, inside the stage.
function wireTips(root, state) {
  const box = root.querySelector('.v2-tip');
  const stage = root.closest('#stage') ?? root;
  const show = (el) => {
    const text = el.dataset.tip;
    if (!text) return;
    box.textContent = text;
    box.hidden = false;
    const scale = stage.getBoundingClientRect().width / 1920 || 1;
    const sr = stage.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const w = box.offsetWidth;
    const h = box.offsetHeight;
    const x = Math.max(8, Math.min(1920 - w - 8, (r.left - sr.left) / scale + r.width / scale / 2 - w / 2));
    let y = (r.top - sr.top) / scale - h - 8;
    if (y < 8) y = (r.bottom - sr.top) / scale + 8;
    box.style.left = `${x}px`;
    box.style.top = `${Math.min(1080 - h - 8, y)}px`;
  };
  root.querySelectorAll('[data-tip]').forEach((el) => {
    el.addEventListener('mouseenter', () => show(el));
    el.addEventListener('mouseleave', () => { box.hidden = true; });
  });
  // Hovering a hand card shows what it refers to on the board (Type, Level, names).
  const names = ['player', 'ai'].flatMap((w) => state.players[w].row.filter(Boolean).map((c) => c.name));
  root.querySelectorAll('.v2-hand .v2-card[data-uid]').forEach((el) => {
    const card = state.players.player.hand.find((c) => c.uid === el.dataset.uid);
    if (!card) return;
    const ref = refersTo(cardTexts(card), names);
    if (!ref.types.length && !ref.level && !ref.names.length) return;
    const marks = [];
    el.addEventListener('mouseenter', () => {
      root.querySelectorAll('.v2-board .v2-mon').forEach((m) => {
        const add = [ref.types.includes(m.dataset.type) && 'rv-type', ref.level && 'rv-level', ref.names.includes(m.dataset.name) && 'rv-name'].filter(Boolean);
        if (add.length) { m.classList.add(...add, 'rv-hover'); marks.push([m, add]); }
      });
    });
    el.addEventListener('mouseleave', () => { for (const [m, add] of marks.splice(0)) m.classList.remove(...add, 'rv-hover'); });
  });
}

function wire(root, state, ui, ctx) {
  const on = (sel, fn) => root.querySelectorAll(sel).forEach((el) => el.addEventListener('click', (e) => { e.stopPropagation(); fn(el); }));
  const clear = () => Object.assign(ui, { summon: null, location: null, attacker: null, trainer: null, moveTrainer: null, strategy: null, preview: null });
  on('[data-action="flip"], [data-prompt="flip"]', () => ctx.act({ type: 'flipCoin' }));
  on('[data-action="pass"]', () => ctx.act({ type: 'pass', who: 'player' }));
  on('[data-action="new"]', () => ctx.newMatch());
  on('[data-action="leave"]', () => ctx.leave?.());
  on('[data-action="deck"]', () => ctx.openDeck());
  on('[data-codex-open]', (el) => openCodex(el.dataset.codexOpen));
  root.querySelectorAll('select[data-speed], select[data-hints]').forEach((el) => {
    el.addEventListener('click', (e) => e.stopPropagation());
    el.addEventListener('change', () => (el.dataset.speed !== undefined ? ctx.setSpeed?.(el.value) : (setHints(el.value), ctx.redraw())));
  });
  on('[data-prompt="cancel"]', () => {
    if (ui.pending && ui.pending.action.type !== 'chooseTarget') ui.pending = null;
    ui.ask = null;
    ui.empowerAsk = null;
    clear();
    ctx.redraw();
  });
  // The assign step (simultaneous: not your turn, the Breakfast).
  on('[data-assign]', (el) => {
    ui.assignDraft ??= {};
    const uid = el.dataset.assign;
    ui.assignDraft[uid] = Math.max(0, (ui.assignDraft[uid] ?? 0) + Number(el.dataset.step));
    ctx.redraw();
  });
  on('[data-action="assign-lock"]', () => {
    const points = Object.fromEntries(Object.entries(ui.assignDraft ?? {}).filter(([, n]) => n > 0));
    ui.assignDraft = null;
    ctx.act({ type: 'assignPoints', who: 'player', points });
  });
  // Card picks (both a waiting Tracey and a Search or Return).
  on('[data-pick]', (el) => {
    const a = ui.ask;
    if (a.chosen.includes(el.dataset.pick)) a.chosen = a.chosen.filter((u) => u !== el.dataset.pick);
    else if (a.chosen.length < a.n) a.chosen.push(el.dataset.pick);
    else if (a.n === 1) a.chosen = [el.dataset.pick];
    ctx.redraw();
  });
  on('[data-action="pick-done"]', () => {
    const a = ui.ask;
    ui.ask = null;
    ctx.act(a.choice ? { type: 'choosePick', who: 'player', picks: a.chosen } : { ...a.action, picks: a.chosen });
  });
  // A waiting On Evolve choice: only its targets can be clicked.
  if (ui.pending?.action.type === 'chooseTarget' && !ui.locked) {
    const pick = (r) => ctx.act({ type: 'chooseTarget', who: 'player', targets: [r] });
    on('.v2-space.effect-target', (el) => pick({ who: el.dataset.who, kind: 'pokemon', space: Number(el.dataset.space) }));
    on('.v2-recognition.effect-target', (el) => pick({ who: el.dataset.player, kind: 'player' }));
    return;
  }
  if (!(state.phase === 'battle' && state.turn === 'player') || ui.locked || state.choices?.length) return;
  const hand = state.players.player.hand;
  const PICK_OPS = { search: (o) => o.count ?? 1, returnFromDiscard: (o) => o.count ?? 1, stealItem: () => 1, freeSummon: () => 1 };
  const finish = (action, ops = [], label = '') => {
    ui.pending = null;
    const pickOp = ops.find((o) => PICK_OPS[o.op]);
    if (pickOp && pickOptions(state, 'player', pickOp).length) {
      ui.ask = { kind: 'pick', action, op: pickOp, n: PICK_OPS[pickOp.op](pickOp), chosen: [], label };
      return ctx.redraw();
    }
    if (ops.some((o) => o.op === 'moveTo')) { ui.ask = { kind: 'space', action, label }; return ctx.redraw(); }
    return ctx.act(action);
  };
  const begin = (action, spec, label, extra = [], ops = [], tctx = {}, tag = null) => {
    ui.ask = null;
    clear();
    const options = spec && spec.count !== 'all' && !spec.special ? [...targetOptions(state, 'player', spec, tctx), ...extra] : [];
    if (!options.length) return finish(action, ops, label);
    ui.pending = { action, spec, label, chosen: [], extra, ops, ctx: tctx, tag };
    ctx.redraw();
  };
  const summonWith = (action) => {
    const card = hand.find((c) => c.uid === action.uid);
    const spec = card?.ability?.onSummon?.target;
    const self = spec?.side === 'friendly' && spec.filter === 'canTrain' && card.level < trainTop(card) ? [{ who: 'player', kind: 'pokemon', space: action.space }] : [];
    if (!spec || spec.count === 'all' || spec.special) return ctx.act(action);
    ui.empowerAsk = null;
    begin(action, spec, `${card.name}: ${card.ability.text}`, self, card.ability.onSummon.ops ?? [], { space: action.space }, `${card.name} · On Summon`);
  };
  // A Strategy Card: play the version shown (then its targets).
  const playStrategy = (card, pay) => {
    const bp = card.breakpoints.find((b) => b.cost === pay);
    const label = `${card.name} (${bp.cost}): ${bp.text}`;
    const spend = bp.ops.find((o) => o.op === 'solarBeam');
    if (spend) {
      const max = Math.min(spend.max, state.players.player.growth);
      clear();
      ui.ask = { kind: 'amount', uid: card.uid, pay: bp.cost, x: max, max, label };
      return ctx.redraw();
    }
    begin({ type: 'playStrategy', who: 'player', uid: card.uid, pay: bp.cost }, bp.target, label, [], bp.ops, {}, `${card.name} · ${bp.cost} Energy`);
  };
  const shownVersion = (card) => { const sv = strategyVersions(state, 'player', card, ui.version[card.uid]); return sv.can ? sv.versions[sv.shown].cost : null; };
  on('.v2-hand .v2-card.playable', (el) => {
    ui.attacker = null;
    const kind = el.dataset.kind;
    const card = hand.find((c) => c.uid === el.dataset.uid);
    if (kind === 'strategy') {
      if (ui.strategy === card.uid) { const pay = shownVersion(card); if (pay !== null) return playStrategy(card, pay); }
      clear();
      ui.strategy = card.uid;
      return ctx.redraw();
    }
    if (kind === 'supporter') { clear(); ui.ask = { kind: 'release', uid: card.uid, chosen: [] }; return ctx.redraw(); }
    if (kind === 'item') { clear(); ui.ask = { kind: 'item', uid: card.uid }; return ctx.redraw(); }
    if (kind === 'trainer') { const again = ui.trainer === card.uid; clear(); ui.trainer = again ? null : card.uid; return ctx.redraw(); }
    const key = kind === 'location' ? 'location' : 'summon';
    const again = ui[key] === card.uid;
    clear();
    ui[key] = again ? null : card.uid;
    ctx.redraw();
  });
  // A dimmed card can still be selected to look at its versions (▲ ▼).
  on('.v2-hand .v2-card.dim', (el) => {
    const card = hand.find((c) => c.uid === el.dataset.uid);
    if (card?.cardType !== 'Strategy' && card?.cardType !== 'Pokémon') return;
    const again = (ui.strategy ?? ui.preview?.uid) === card.uid;
    clear();
    if (!again) { if (card.cardType === 'Strategy') ui.strategy = card.uid; else ui.preview = { uid: card.uid, offset: 0, look: true }; }
    ctx.redraw();
  });
  on('[data-prompt="play-strategy"]', () => { const card = hand.find((c) => c.uid === ui.strategy); const pay = card && shownVersion(card); if (pay !== null) playStrategy(card, pay); });
  // ▲ ▼: a Pokémon's other Levels (previews); a Strategy's versions (a lower affordable one is
  // selected; a higher one too if affordable, else it's previewed with "Needs N").
  on('[data-ver]', (el) => {
    const card = hand.find((c) => c.uid === el.closest('.v2-hand-slot').querySelector('[data-uid]').dataset.uid);
    const d = Number(el.dataset.ver);
    if (card.cardType === 'Pokémon') {
      const off = (ui.preview?.uid === card.uid ? ui.preview.offset : 0) + d;
      ui.preview = { uid: card.uid, offset: Math.max(1 - card.level, Math.min(card.cap - card.level, off)), look: ui.preview?.look };
      return ctx.redraw();
    }
    const sv = strategyVersions(state, 'player', card, ui.version[card.uid]);
    const off = (ui.preview?.uid === card.uid ? ui.preview.offset : 0) + d;
    const target = sv.versions[sv.shown + off];
    if (target?.can) { ui.version[card.uid] = target.cost; ui.preview = null; } else ui.preview = { uid: card.uid, offset: off };
    ctx.redraw();
  });
  on('[data-pick-version]', (el) => {
    const card = hand.find((c) => c.uid === ui.strategy);
    if (!card) return;
    ui.version[card.uid] = Number(el.dataset.pickVersion);
    ui.preview = null;
    ctx.redraw();
  });
  on('.v2-lane.pick', (el) => ctx.act({ type: 'playLocation', who: 'player', uid: ui.location, start: Number(el.dataset.lane) }));
  const ghost = root.querySelector('.v2-loc.ghost');
  const pickLoc = hand.find((c) => c.uid === ui.location);
  root.querySelectorAll('.v2-lane.pick').forEach((el) => {
    el.addEventListener('mouseenter', () => { ghost.style.display = ''; ghost.style.gridColumn = `${Number(el.dataset.lane) + 1} / span ${pickLoc.lanes}`; });
    el.addEventListener('mouseleave', () => { ghost.style.display = 'none'; });
  });
  on('.v2-row.player .v2-space.target', (el) => {
    const space = Number(el.dataset.space);
    const card = hand.find((c) => c.uid === ui.summon);
    if (card?.empower) { ui.empowerAsk = { uid: card.uid, space }; ctx.redraw(); return; }
    summonWith({ type: 'summon', who: 'player', uid: ui.summon, space });
  });
  on('[data-action="summon-plain"]', () => summonWith({ type: 'summon', who: 'player', uid: ui.empowerAsk.uid, space: ui.empowerAsk.space }));
  on('[data-action="summon-empowered"]', () => summonWith({ type: 'summon', who: 'player', uid: ui.empowerAsk.uid, space: ui.empowerAsk.space, empowered: true }));
  on('[data-action="amount-step"]', (el) => { ui.ask.x = Math.max(1, Math.min(ui.ask.max, ui.ask.x + Number(el.dataset.step))); ctx.redraw(); });
  on('[data-action="amount-done"]', () => {
    const a = ui.ask;
    const card = hand.find((c) => c.uid === a.uid);
    const bp = card.breakpoints.find((b) => b.cost === a.pay);
    begin({ type: 'playStrategy', who: 'player', uid: card.uid, pay: bp.cost, x: a.x }, bp.target, a.label, [], bp.ops, { x: a.x }, `${card.name} · ${bp.cost} Energy`);
  });
  on('[data-space-pick]', (el) => ctx.act({ ...ui.ask.action, picks: { space: Number(el.dataset.spacePick) } }));
  on('[data-action="nurture"]', () => begin({ type: 'nurture', who: 'player' }, { side: 'friendly', kinds: ['pokemon'], count: 1, filter: 'canNurture' }, 'Nurture: train 1 one of your Pokémon', [], [{ op: 'train', amount: 1 }], {}, 'Nurture · 2 Growth'));
  on('[data-rel]', (el) => {
    const card = hand.find((c) => c.uid === ui.ask.uid);
    const chosen = ui.ask.chosen;
    if (chosen.includes(el.dataset.rel)) ui.ask.chosen = chosen.filter((u) => u !== el.dataset.rel);
    else if (chosen.length < card.release) chosen.push(el.dataset.rel);
    ctx.redraw();
  });
  on('[data-action="release-done"]', () => {
    const card = hand.find((c) => c.uid === ui.ask.uid);
    const met = favourMet(card, hand.filter((c) => ui.ask.chosen.includes(c.uid)));
    const spec = met && 'target' in card.favour ? card.favour.target : card.target;
    begin({ type: 'playSupporter', who: 'player', uid: card.uid, release: [...ui.ask.chosen] }, spec, `${card.name}: ${met ? card.favour.text : card.text}`, [], met ? card.favour.ops : card.ops, {}, `${card.name}${met ? ' · Favour' : ''}`);
  });
  on('[data-action="item-use"]', () => {
    const card = hand.find((c) => c.uid === ui.ask.uid);
    begin({ type: 'playItem', who: 'player', uid: card.uid, mode: 'use' }, card.target, `${card.name}: ${card.text}`, [], card.ops, {}, `${card.name} · ${card.cost} Energy`);
  });
  on('[data-action="item-bag"]', () => ctx.act({ type: 'playItem', who: 'player', uid: ui.ask.uid, mode: 'bag' }));
  on('.v2-bag .item.usable', (el) => {
    const card = state.players.player.bag.find((c) => c.uid === el.dataset.bag);
    begin({ type: 'useItem', who: 'player', uid: card.uid }, card.target, `${card.name}: ${card.text}`, [], card.ops, {}, `${card.name} · from the Bag`);
  });
  on('[data-action="ask-cancel"]', () => { ui.ask = null; ctx.redraw(); });
  on('.v2-row.player .v2-space.trainer-target', (el) => {
    const space = Number(el.dataset.space);
    if (ui.trainer) return ctx.act({ type: 'playTrainer', who: 'player', uid: ui.trainer, space });
    return ctx.act({ type: 'moveTrainer', who: 'player', uid: ui.moveTrainer, space });
  });
  on('.v2-trainer.clickable', (el) => { clear(); ui.ask = { kind: 'trainer', uid: el.dataset.trainer }; ctx.redraw(); });
  on('[data-action="trainer-ability"]', () => {
    const t = state.players.player.trainers.find((x) => x.uid === ui.ask.uid);
    begin({ type: 'useAbility', who: 'player', uid: t.uid }, t.tiers[1].ability.target, `${t.name}: ${t.tiers[1].text}`, [], t.tiers[1].ability.ops, { space: t.space, lane: t.space }, `${t.name}'s Ability · ${t.tiers[1].ability.cost} Energy`);
  });
  on('[data-action="trainer-move"]', () => { const uid = ui.ask.uid; ui.ask = null; clear(); ui.moveTrainer = uid; ctx.redraw(); });
  on('.v2-row.player .v2-space.partner-target', (el) => ctx.act({ type: 'placePartner', who: 'player', uid: state.players.player.waiting[0].uid, space: Number(el.dataset.space) }));
  // Choosing targets: one target acts at once; for more, toggle, then Confirm.
  const pickTarget = (r) => {
    const pend = ui.pending;
    if (!pend) return;
    if (pend.action.type === 'nurture') return ctx.act({ ...pend.action, space: r.space });
    if (pend.spec.count === 1) return finish({ ...pend.action, targets: [r] }, pend.ops, pend.label);
    const key = (t) => `${t.who}:${t.kind}:${t.space ?? t.id ?? ''}`;
    if (pend.chosen.some((t) => key(t) === key(r))) pend.chosen = pend.chosen.filter((t) => key(t) !== key(r));
    else if (pend.chosen.length < pend.spec.count) pend.chosen.push(r);
    ctx.redraw();
  };
  on('.v2-space.effect-target', (el) => pickTarget({ who: el.dataset.who, kind: 'pokemon', space: Number(el.dataset.space) }));
  on('.v2-recognition.effect-target', (el) => pickTarget({ who: el.dataset.player, kind: 'player' }));
  on('.loc-target', (el) => {
    const opt = pendingOptions(state, ui).find((o) => o.kind === 'location' && o.id === el.dataset.locTarget);
    if (opt) pickTarget(opt);
  });
  on('[data-prompt="targets-done"]', () => finish({ ...ui.pending.action, targets: ui.pending.chosen }, ui.pending.ops, ui.pending.label));
  if (ui.pending) return;
  on('[data-action="summon-cancel"]', () => { ui.empowerAsk = null; ctx.redraw(); });
  on('.v2-row.player .v2-card.selectable', (el) => {
    const space = Number(el.closest('.v2-space').dataset.space);
    const again = ui.attacker === space;
    clear();
    ui.attacker = again ? null : space;
    ctx.redraw();
  });
  on('.v2-space.attack-target', (el) => ctx.act({ type: 'attack', who: 'player', from: ui.attacker, target: { kind: 'pokemon', space: Number(el.dataset.space) } }));
  on('.v2-recognition.target', () => ctx.act({ type: 'attack', who: 'player', from: ui.attacker, target: { kind: 'player' } }));
}

export { opponentOf, alertSpaces, actionCard, artUrl, handCard, boardCard, resultLine, targetWhyNot, breakpointsFor, costRange };
