// Drawing a v2 match (V1 + V2), in the approved look (docs/design/v2-board-concept.jpg):
// each player's Recognition on the left, two facing rows of 9 spaces on the leather
// mat, Locations as coloured frames over their lanes on both sides with an
// objective banner in the middle (name, Weather, objective, both players' progress
// bars with milestone ticks, Rounds left), the side panel on the right (Round of 12,
// the Championship, Energy with stored Energy, Weather), and the fanned hand below.
// Pokémon use the minimal card style: Level badge, small Type icon, name, Attack and
// Strength. Every icon is coded (icons.js, V7a): no icon images from the current game.
//
// Clicks: a Pokémon in hand, then an empty space of your row, summons it (one with
// an Empowered summon asks whether to pay for its bonus); a
// Location in hand, then a glowing lane in the middle of the board, places it
// there (from that lane to the right); one of your Alert Pokémon, then a glowing
// target (an enemy Pokémon, or the Opponent's Recognition panel for the player
// character), attacks.
import {
  legalTargets, alertSpaces, playable, placeable, locationStarts, locationAt, weatherTotals, championship,
  isAlert, passEndsPhase, passSpends, opponentOf, summonCost, targetOptions, breakpointsFor, playableStrategies,
  playableSupporters, playableItems, usableBagItems, itemUsable, bagFull, favourMet, bracket, trainTop,
  trainerAt, tiersUnlocked, trainerSpaces, playableTrainers, canMoveTrainer, usableAbilities, freeSpaces, legalActions,
  pickOptions, nurtureSpaces, nurtureCost,
} from '../engine/game.js';
import { DECKS } from '../engine/cards.js';
import { costRange, BAG_SIZE, FAVOURS } from '../engine/cardtypes.js';
import { RECOGNITION_TARGET, LANES, ROUND_LIMIT, CHAMPIONSHIP_ROUND } from '../engine/rules.js';
import { rewardText, lastsText } from '../engine/locations.js';
import { seriesDef, stagesText } from '../engine/series.js';
import { icon, typeIcon, attackIcon, strengthIcon, speedIcon, rarityIcon, weatherIcon } from './icons.js';
import { statusLevel } from './vfx/library.js';
import { SPEEDS, getSpeed } from '../../../src/ui/settings.js';

const ASSETS = '../assets';   // the shared art, from the page (v2/index.html)
const slug = (s) => s.toLowerCase().replace(/\s+/g, '-');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

// A Pokémon card in the minimal style. opts: { cls, alert, attrs, showCost, inHand }.
// In hand the Level badge is its current Level (Round, up to its cap; the cap shows
// beside it); on the board, the Level it was played at.
function pokemonCard(card, opts = {}) {
  const strength = card.currentStrength ?? card.strength;
  const cls = ['v2-card', opts.cls, card.spent && 'spent', opts.alert && 'alert', card.empowered && 'empowered'].filter(Boolean).join(' ');
  const line = card.series ? seriesDef(card.series) : null;
  const tip = [
    `${card.name} · Level ${card.level}${card.cap ? ` (cap ${card.cap})` : ''}`, `${card.type} · ${card.attackType} ${card.attack} · ${card.strengthType} ${card.strength} · ${card.speed}`,
    line && `${line.legendary ? 'Legendary · a single card' : stagesText(line)} · ${line.rarity}${line.weight !== 'standard' && !line.legendary ? ` · ${line.weight}` : ''}`,
    card.keywords?.length && card.keywords.join(', '), card.retain && 'Retain', card.ability?.text, card.empower && `Empowered summon ${card.empower.text}`,
    card.empowered && 'Empowered',
  ].filter(Boolean).join('\n');
  const notes = [card.ability?.text, opts.inHand && card.empower && `Empower ${card.empower.text}`].filter(Boolean);
  // For the effects layer (V8): what it attacks with, and each status's visual level
  // (the ambient Burn, Sleep and Leech Seed effects; vfx/engine.js syncStatus).
  const vfx = `data-ptype="${card.type}" data-atype="${card.attackType}"${card.burn ? ` data-status-burn="${statusLevel('burn', card.burn)}"` : ''}${card.asleep ? ' data-status-sleep="1"' : ''}${card.seededBy ? ' data-status-leechseed="1"' : ''}`;
  return `
    <div class="${cls}" ${opts.attrs ?? ''} ${vfx} title="${esc(tip)}">
      <div class="v2-art" style="background-image: url('${card.art === null ? `${ASSETS}/ui/frame-pokemon.jpg` : `${ASSETS}/cards/${card.art ?? card.id}.jpg`}')"></div>
      ${card.partner ? `<span class="v2-partner-tag" title="${esc(card.trainer)}'s Partner Pokémon">Partner</span>` : ''}
      ${card.legendary ? `<span class="v2-level legendary" title="Legendary: a single card, no Levels">${icon('legendary')}Legendary</span>`
        : `<span class="v2-level">Lv ${card.level}${opts.inHand && card.cap > card.level ? `<small>/${card.cap}</small>` : ''}</span>`}
      ${typeIcon(card.type, 'v2-type')}
      <span class="v2-speed" title="${card.speed}">${speedIcon(card.speed)}</span>
      ${card.strengthType !== 'Hitpoints' ? `<span class="v2-guard">${card.strengthType === 'Defence' ? 'Def' : 'Sp. Def'}</span>` : ''}
      ${card.keywords?.length ? `<span class="v2-keys">${keywordChips(card).map((k) => `<i>${k}</i>`).join('')}</span>` : ''}
      ${card.cost !== undefined && opts.showCost ? `<span class="v2-cost">${icon('energy')}<b>${card.cost}</b></span>` : ''}
      <div class="v2-name">${card.name}</div>
      ${notes.length ? `<div class="v2-ability">${notes.map(esc).join('<br>')}</div>` : ''}
      <div class="v2-stats"><span title="${card.attackType} Attack">${attackIcon(card.attackType)}${card.attack}</span><span class="${strength < card.strength ? 'hurt' : ''}" title="${card.strengthType}">${strengthIcon(card.strengthType)}${strength}</span></div>
      ${card.asleep ? `<span class="v2-spent asleep">${icon('sleep')}Asleep</span>` : card.spent ? '<span class="v2-spent">Spent</span>' : opts.alert ? '<span class="v2-alert">Alert</span>' : ''}
      ${statusChips(card)}
      ${card.held ? `<img class="v2-held" src="${artUrl(card.held)}" alt="${esc(card.held.name)}" title="Holding ${esc(card.held.name)}: ${esc(card.held.text)}">` : ''}
      ${opts.badge ? `<span class="v2-flourish">${opts.badge}</span>` : ''}
    </div>`;
}

// Keyword chips: numbered keywords summed (Scorch 1 + Scorch 1 = Scorch 2), the others once.
function keywordChips(card) {
  const sums = new Map();
  for (const k of card.keywords) {
    const m = /^(.*) (\d+)$/.exec(k);
    const name = m ? m[1] : k;
    sums.set(name, m ? (sums.get(name) ?? 0) + Number(m[2]) : 0);
  }
  return [...sums].filter(([name]) => name !== 'Big Root').map(([name, n]) => (n ? `${name} ${n}` : name));
}

const artUrl = (c) => (c.art ? `${ASSETS}/cards/${c.art}.jpg` : `${ASSETS}/ui/frame-item.jpg`);

// Burn, Leech Seed (V4): small chips on the card, and its look (classes on the card).
function statusChips(card) {
  return `<span class="v2-status">${card.burn ? `<i class="burn" title="Burn ${card.burn}: ${card.burn} damage at Supper, then 1 less">${icon('burn')}${card.burn}</i>` : ''}${card.seededBy ? `<i class="seed" title="Leech Seed: 1 damage at Supper, healing the seeder">${icon('seed')}Seeded</i>` : ''}</span>`;
}

// A Trainer tab (V5), above the opponent's space or below yours, as in the mockup: the
// portrait, name, points toward the top tier ("4/6"), and the three tier pips, lit when
// unlocked. Your own tab is clickable on your turn (Ability, Move).
function trainerTab(state, who, t, ui) {
  const lit = tiersUnlocked(t);
  const mine = who === 'player' && state.phase === 'battle' && state.turn === 'player' && !ui.locked && !ui.pending;
  const ability = who === 'player' && usableAbilities(state, 'player').some((x) => x.uid === t.uid);
  const moved = state.events.some((e) => e.type === 'trainerMoved' && e.uid === t.uid);
  const unlocked = state.events.some((e) => e.type === 'tierUnlocked' && e.uid === t.uid);
  const cls = ['v2-trainer', who === 'ai' ? 'top' : 'bottom', mine && 'clickable', ability && mine && 'ability', moved && 'moved', unlocked && 'unlocked'].filter(Boolean).join(' ');
  const tip = `${t.name} · ${t.points}/${t.tiers[2].cost} Trainer Points\n${t.tiers.map((x, i) => `${i < lit ? '●' : '○'} ${x.cost} · ${x.kind}: ${x.text}`).join('\n')}`;
  return `<div class="${cls}" data-trainer="${t.uid}" title="${esc(tip)}">
    <i class="v2-portrait" style="background-image: url('${ASSETS}/cards/${t.art}.jpg')"></i>
    <b>${t.name}</b><span class="v2-tpts">${t.points}/${t.tiers[2].cost}</span>
    <span class="v2-pips">${t.tiers.map((x, i) => `<i class="${i < lit ? 'lit' : ''}">${x.kind}</i>`).join('')}</span>
    ${moved ? '<span class="v2-moved">↔</span>' : ''}
  </div>`;
}

const partnerWaitingNow = (state, ui) => state.phase === 'battle' && state.turn === 'player' && !ui.locked && !ui.pending
  && state.players.player.waiting.length > 0 && legalActions(state, 'player').includes('placePartner');

// The Growth tree: four images by amount (1, 3, 5, 8+), as in the current game.
const GROWTH_STAGES = [1, 3, 5, 8];
function growthTree(n) {
  const stage = GROWTH_STAGES.filter((m) => n >= m).length;
  return `<div class="v2-growth" style="background-image: url('${ASSETS}/ui/growth-${stage}.jpg')" title="Growth ${n}"><b>${icon('growth')}${n}</b><span>Growth</span></div>`;
}

// A Strategy Card, Supporter or Item (V4): its art, type, name, cost and text.
function actionCard(card, opts = {}) {
  const cls = ['v2-card', 'v2-act-card', card.cardType === 'Trainer' ? 'v2-trainer-card' : `v2-${card.cardType.toLowerCase()}`, opts.cls].filter(Boolean).join(' ');
  let cost = '';
  let body = '';
  let label = card.cardType;
  if (card.cardType === 'Strategy') {
    cost = `<span class="v2-cost wide">${icon('energy')}<b>${costRange(card)}</b></span>`;
    body = card.breakpoints.map((b) => `<p><b>${b.cost}:</b> ${esc(b.text)}</p>`).join('');
  } else if (card.cardType === 'Trainer') {
    cost = `<span class="v2-cost">${icon('energy')}<b>${card.cost}</b></span>`;
    body = card.tiers.map((t) => `<p><b>${t.cost} · ${t.kind}:</b> ${esc(t.text)}</p>`).join('');
  } else if (card.cardType === 'Supporter') {
    cost = `<span class="v2-cost release" title="Release ${card.release} card${card.release === 1 ? '' : 's'} from your hand">⟲${card.release}</span>`;
    body = `<p>${esc(card.text)}</p><p class="favour"><b>Favour</b> (${esc(FAVOURS[card.favour.condition].text)}): ${esc(card.favour.text)}</p>`;
  } else {
    cost = `<span class="v2-cost">${icon('energy')}<b>${card.cost}</b></span>`;
    label = `Item · ${card.kind}`;
    body = `<p>${esc(card.text)}</p>`;
  }
  const tip = `${card.name} · ${label}\n${card.cardType === 'Strategy' ? card.breakpoints.map((b) => `${b.cost}: ${b.text}`).join('\n') : card.cardType === 'Trainer' ? card.tiers.map((t) => `${t.cost} · ${t.kind}: ${t.text}`).join('\n') : card.text}${card.favour ? `\nRelease ${card.release}. Favour (${FAVOURS[card.favour.condition].text}): ${card.favour.text}` : ''}`;
  return `
    <div class="${cls}" ${opts.attrs ?? ''} title="${esc(tip)}">
      <div class="v2-art" style="background-image: url('${artUrl(card)}')"></div>
      <span class="v2-level">${label}</span>
      ${cost}
      <div class="v2-name">${card.name}</div>
      <div class="v2-act-text">${body}</div>
    </div>`;
}

const weatherIcons = (weather = {}) => Object.entries(weather).filter(([, n]) => n)
  .map(([kind, n]) => `<span class="v2-wx" title="${kind}">${weatherIcon(kind)}${n}</span>`).join('');

// A Location card (in hand): its art, name, lanes and Rounds, Weather and objective.
function locationCard(card, opts = {}) {
  const cls = ['v2-card', 'v2-loc-card', opts.cls].filter(Boolean).join(' ');
  const goals = [...card.milestones.map((m) => `${m.at}: ${rewardText(m.reward)}`), `${card.objective.count}: ${rewardText(card.completion)}`].join(' · ');
  return `
    <div class="${cls}" ${opts.attrs ?? ''} style="--loc: ${card.color}" title="${esc(`${card.name} · Location · ${card.lanes} lane${card.lanes > 1 ? 's' : ''} · ${lastsText(card.rounds)} · ${card.objective.text} · ${goals}`)}">
      <div class="v2-art" style="background-image: url('${ASSETS}/cards/${card.art ?? card.id}.jpg')"></div>
      <span class="v2-level">Location</span>
      <span class="v2-loc-wx">${weatherIcons(card.weather)}</span>
      <div class="v2-name">${card.name}</div>
      <div class="v2-loc-meta">${card.lanes} lane${card.lanes > 1 ? 's' : ''} · ${lastsText(card.rounds)}</div>
      <div class="v2-loc-goal">${card.objective.text}</div>
    </div>`;
}

function recognitionPanel(state, who, targetable, ui) {
  const p = state.players[who];
  const pct = Math.min(100, (100 * p.recognition) / RECOGNITION_TARGET);
  const turn = state.phase === 'battle' && state.turn === who;
  const options = pendingOptions(state, ui);
  const effect = options.some((o) => o.who === who && o.kind === 'player');
  const chosen = (ui.pending?.chosen ?? []).some((o) => o.who === who && o.kind === 'player');
  const less = bracket(state, 'Rain', 4) ? 1 : 0;
  return `
    <section class="v2-panel v2-recognition ${who === 'ai' ? 'top' : 'bottom'}${targetable ? ' target' : ''}${effect ? ' effect-target' : ''}${chosen ? ' chosen' : ''}${turn ? ' turn' : ''}${p.burn ? ' burning' : ''}" data-player="${who}">
      ${p.burn ? `<div class="v2-pc-burn" title="Burn on the player character: at Supper it removes that much Recognition (never below 0), then 1 less">${icon('burn')} Burn ${p.burn}<small>−${Math.max(0, p.burn - less)} Recognition at Supper</small></div>` : ''}
      <div class="v2-avatar"></div>
      <h3>${who === 'ai' ? 'Opponent' : 'You'}</h3>
      <div class="v2-label">${icon('recognition')} Recognition</div>
      <b class="v2-score">${p.recognition}</b>
      <div class="v2-of">of ${RECOGNITION_TARGET} to win</div>
      <div class="v2-bar"><i style="width: ${pct}%"></i></div>
      ${targetable ? '<div class="v2-target-tag">Attack the Opponent</div>' : ''}
      ${effect ? `<div class="v2-target-tag">${chosen ? 'Chosen' : 'Choose'}</div>` : ''}
    </section>`;
}

function row(state, who, ui, targets) {
  const mine = who === 'player';
  const p = state.players[who];
  // The Growth tree (V6, as in the current game): in the rightmost empty space, display only.
  const treeSpace = p.growth > 0 ? [...p.row.keys()].reverse().find((i) => !p.row[i]) : undefined;
  const spaces = Array.from({ length: LANES }, (_, space) => {
    const card = p.row[space];
    const summonHere = mine && ui.summon && !card;
    const target = !mine && targets.some((t) => t.kind === 'pokemon' && t.space === space);
    const attacker = mine && ui.attacker === space;
    const loc = locationAt(state, space);
    const effect = pendingOptions(state, ui).some((o) => o.who === who && o.kind === 'pokemon' && o.space === space);
    const chosen = (ui.pending?.chosen ?? []).some((o) => o.who === who && o.kind === 'pokemon' && o.space === space);
    const cls = ['v2-space', loc && 'in-loc', summonHere && !ui.pending && 'target', target && 'attack-target', attacker && 'selected', effect && 'effect-target', chosen && 'chosen'].filter(Boolean).join(' ');
    const alert = card && isAlert(state, card) && state.phase === 'battle';
    const canAct = mine && alert && state.turn === 'player' && !ui.locked;
    const trained = card && state.events.find((e) => e.type === 'trained' && e.who === who && e.space === space);
    const cardCls = [canAct && !ui.pending && 'selectable', trained && 'levelup', card?.asleep && 'asleep', card?.burn && 'burning', card?.seededBy && 'seeded'].filter(Boolean).join(' ');
    const face = card ? pokemonCard(card, { alert, cls: cardCls, badge: trained ? `Level ${trained.to}${trained.name !== trained.fromName ? ` · ${trained.name}!` : ''}` : '' }) : '';
    const trainer = trainerAt(state, who, space);
    const placeHere = mine && ((ui.trainer || ui.moveTrainer) && !trainer);
    const partnerHere = mine && !card && partnerWaitingNow(state, ui);
    const arrived = card && state.events.find((e) => e.type === 'partnerArrived' && e.who === who && e.space === space);
    const extra = [placeHere && 'trainer-target', partnerHere && 'partner-target', arrived && 'partner-arrive'].filter(Boolean).join(' ');
    const tree = space === treeSpace ? growthTree(p.growth) : '';
    return `<div class="${cls}${extra ? ` ${extra}` : ''}" data-who="${who}" data-space="${space}"${loc ? ` style="--loc: ${loc.color}"` : ''}>${tree}${face}${arrived ? '<span class="v2-flourish partner">Partner!</span>' : ''}${trainer ? trainerTab(state, who, trainer, ui) : ''}</div>`;
  }).join('');
  return `<div class="v2-row ${who === 'ai' ? 'opponent' : 'player'}">${spaces}</div>`;
}

function sidePanel(state, ui, ctx) {
  const me = state.players.player;
  const myTurn = state.phase === 'battle' && state.turn === 'player' && !ui.locked;
  let hint = '';
  let button = '';
  if (state.phase === 'initiative') {
    hint = `${deckPicker(ctx)}Flip a coin to decide who has initiative in Round 1.`;
    button = '<button data-action="flip">Flip the coin</button>';
  } else if (state.phase === 'gameOver') {
    hint = resultLine(state);
    button = `<button data-action="new"${ctx.endDisabled ? ' disabled' : ''}>${ctx.endLabel ?? 'New match'}</button>`;
  } else if (ui.pending?.action.type === 'chooseTarget') {
    hint = pendingHint(state, ui);
  } else if (state.phase === 'assign') {
    hint = legalActions(state, 'player').length ? 'Breakfast: assign your Trainer Points.' : 'Waiting for the Opponent to assign theirs…';
  } else if (myTurn) {
    hint = ui.pending ? pendingHint(state, ui)
      : partnerWaitingNow(state, ui) ? `${me.waiting[0].trainer}'s Partner ${me.waiting[0].name} is waiting: click a free space of yours (glowing green) for it.`
      : ui.trainer ? 'Click one of your spaces (glowing) to attach the Trainer above or below it; a Pokémon may stand there too.'
      : ui.moveTrainer ? 'Click one of your spaces without a Trainer to move it there (once per Round).'
      : ui.summon ? 'Click an empty space in your row to summon it, or the card again to cancel.'
      : ui.location ? 'Click a glowing lane in the middle of the board: the Location covers it and the lanes to its right, on both sides.'
      : ui.attacker !== null ? 'Click a glowing target: an enemy Pokémon, or the Opponent (their Recognition panel).'
        : 'Your turn: summon a Pokémon, place a Location, play a card, use an Item from your Bag, attack with an Alert Pokémon, or Pass.';
    const ends = passEndsPhase(state);
    const spends = passSpends(state, 'player').length;
    const nurture = !ui.pending && nurtureSpaces(state, 'player').length
      ? `<button data-action="nurture" class="v2-nurture">Nurture<small>${Math.min(...nurtureSpaces(state, 'player').map((sp) => nurtureCost(state, 'player', sp)))} Growth: train 1 one of your Pokémon</small></button>` : '';
    button = nurture + (ui.pending
      ? `${ui.pending.spec.count !== 1 ? `<button data-action="targets-done"${ui.pending.chosen.length ? '' : ' disabled'}>Confirm<small>${ui.pending.chosen.length} chosen</small></button>` : ''}<button data-action="targets-cancel" class="v2-ask-cancel">Cancel</button>`
      : `<button data-action="pass" class="pass">Pass<small>${ends ? 'ends the Battle Phase' : `+1 Energy${spends ? ` · ${spends} become${spends === 1 ? 's' : ''} Spent` : ''}`}</small></button>`);
  } else hint = ctx.autoplay ? 'Autoplay: the AI plays both sides.' : 'The Opponent is thinking…';
  const recent = state.log.slice(-4).map((l) => `<p>${esc(l)}</p>`).join('');
  return `
    <aside class="v2-side">
      <section class="v2-panel"><div class="v2-label">Round</div><b class="v2-big">${state.round || '—'} <small>of ${ROUND_LIMIT}${state.suddenDeath ? ' · sudden death' : ''}</small></b>
        <p class="v2-note">${state.phase === 'battle' ? `Battle Phase · ${state.turn === 'player' ? 'your turn' : 'their turn'}` : state.phase === 'gameOver' ? 'Match over' : 'Setup'}</p></section>
      ${champPanel(state)}
      <section class="v2-panel"><div class="v2-label">${icon('energy')} Energy</div>
        <b class="v2-big">${me.energy} <small>/ ${me.roundEnergy}${me.stored ? ` · +${me.stored} stored` : ''}${me.bonus ? ` · +${me.bonus} milestone` : ''}</small></b>
        ${me.bonusNext ? `<p class="v2-note">+${me.bonusNext} next Round</p>` : ''}
        ${me.growth || state.players.ai.growth ? `<p class="v2-note on"><b>${icon('growth')} Growth ${me.growth}</b> · Opponent ${state.players.ai.growth}</p>` : ''}</section>
      ${trainerPointsPanel(state)}
      ${bagPanel(state, ui)}
      <section class="v2-panel"><div class="v2-label">Weather</div>${weatherPanel(state)}</section>
      <section class="v2-panel v2-act"><p class="v2-hint">${hint}</p>${button}</section>
      <section class="v2-panel v2-log">${recent}</section>
      <div class="v2-build">${ctx.build}<label class="v2-speed-pick" title="How fast animations play (shared with the current game)">Animations <select data-speed>${Object.entries(SPEEDS).map(([k, v]) => `<option value="${k}"${k === getSpeed() ? ' selected' : ''}>${v.label}</option>`).join('')}</select></label></div>
    </aside>`;
}

function champPanel(state) {
  const champ = championship(state);
  let text;
  if (champ) text = `<b>Now</b>, over all 9 lanes: ${esc(champ.objective.text)}. ${champ.roundsLeft} Round${champ.roundsLeft === 1 ? '' : 's'} left.`;
  else if (state.phase === 'gameOver') text = 'The match ended before it arrived.';
  else text = `Arrives in <b>Round ${CHAMPIONSHIP_ROUND}</b>: the final Location over every lane, with the biggest rewards.`;
  return `<section class="v2-panel v2-champ${champ ? ' live' : ''}"><div class="v2-label">Championship</div><p>${text}</p></section>`;
}

function weatherPanel(state) {
  const totals = weatherTotals(state);
  const icons = ['Rain', 'Sun'].map((kind) => `<span class="v2-wx big">${weatherIcon(kind)}${totals[kind] ?? 0}<small>${kind}</small></span>`).join('');
  const on = WEATHER_BRACKETS.filter((b) => bracket(state, b.kind, b.at)).map((b) => `<p class="v2-note on"><b>${b.kind} ${b.at}:</b> ${b.text}</p>`).join('');
  return `<div class="v2-wx-row">${icons}</div>${on || '<p class="v2-note">No bracket reached (2, 4, 6, 8).</p>'}`;
}

// The Weather brackets in play (docs/decks.md 2.12, without Growth and Evolve until V6).
const WEATHER_BRACKETS = [
  { kind: 'Sun', at: 2, text: 'each Burn applied +1' },
  { kind: 'Sun', at: 8, text: 'Drought: no healing' },
  { kind: 'Rain', at: 2, text: 'each heal +1' },
  { kind: 'Rain', at: 4, text: 'Burn 1 less at Supper' },
  { kind: 'Rain', at: 6, text: 'Leech Seed drains 2' },
  { kind: 'Rain', at: 8, text: 'Downpour: Burn washed away at Supper' },
];

// Deck selection (V6): Fire, Water, Grass or Random for both players (mirrors allowed),
// before the coin flip; Your deck when one is built.
function deckPicker(ctx) {
  // The decks are chosen on the setup screen (v2 Feedback A), not in the side panel.
  if (!ctx.inlineDecks) return '';
  const opts = (who) => [...Object.entries(DECKS).map(([k, d]) => [k, d.name]), ['random', 'Random'], ...(who === 'player' && ctx.customDeck ? [['custom', 'Your deck']] : [])]
    .map(([k, name]) => `<option value="${k}"${ctx.deckChoice?.[who] === k ? ' selected' : ''}>${name}</option>`).join('');
  return `<span class="v2-decks"><label>You <select data-deck="player">${opts('player')}</select></label>
    <label>Opponent <select data-deck="ai">${opts('ai')}</select></label></span>
    <span class="v2-modes"><button class="v2-mode-btn" data-action="hotseat">Two players, one screen</button><button class="v2-mode-btn" data-action="online">Play a friend online</button></span>`;
}

// Trainer Points (V5): the pool, assigned at Breakfast; and whether the Round's move is used.
function trainerPointsPanel(state) {
  const me = state.players.player;
  const them = state.players.ai;
  return `<section class="v2-panel v2-tp"><div class="v2-label">Trainer Points</div>
    <b class="v2-big">${icon('star')} ${me.trainerPoints} <small>to assign at Breakfast</small></b>
    <p class="v2-note">${me.trainers.length ? `${me.trainers.length} Trainer${me.trainers.length === 1 ? '' : 's'} in play · move ${me.movedTrainer ? 'used this Round' : 'available'}` : 'No Trainers in play yet'}${them.trainerPoints || them.trainers.length ? ` · Opponent ${icon('star')} ${them.trainerPoints}` : ''}</p></section>`;
}

// The Bag (V4): 6 spaces, in the side panel as in the mockup. On your turn, an Item
// you can use now glows; click it to use it (a Battle Action, cost 0).
function bagPanel(state, ui) {
  const me = state.players.player;
  const mine = state.phase === 'battle' && state.turn === 'player' && !ui.locked && !ui.pending;
  const usable = new Set(mine ? usableBagItems(state, 'player').map((c) => c.uid) : []);
  const slots = Array.from({ length: BAG_SIZE }, (_, i) => {
    const c = me.bag[i];
    if (!c) return '<i></i>';
    return `<i class="item${usable.has(c.uid) ? ' usable' : ''}" data-bag="${c.uid}" style="background-image: url('${artUrl(c)}')" title="${esc(`${c.name} (${c.kind}): ${c.text}`)}"></i>`;
  }).join('');
  return `<section class="v2-panel"><div class="v2-label">Bag <small>${me.bag.length}/${BAG_SIZE}</small></div><div class="v2-bag">${slots}</div>
    <p class="v2-note">Items found at Locations${state.players.ai.bag.length ? ` · Opponent's Bag: ${state.players.ai.bag.length}` : ''}</p></section>`;
}

// --- Choosing targets (V4): a Strategy breakpoint, Supporter, Item or On summon ability -----

function pendingOptions(state, ui) {
  const pend = ui?.pending;
  if (!pend) return [];
  return [...targetOptions(state, 'player', pend.spec, pend.ctx ?? {}), ...(pend.extra ?? [])];
}
function pendingHint(state, ui) {
  const { spec, label } = ui.pending;
  const what = spec.side === 'enemy' ? (spec.kinds.includes('player') ? 'an enemy Pokémon or the Opponent (their Recognition panel)' : 'an enemy Pokémon')
    : spec.kinds.includes('player') ? 'one of your Pokémon or yourself (your Recognition panel)' : 'one of your Pokémon';
  return `${label}: click ${spec.count === 1 ? what : `up to ${spec.count} targets: ${what}`}${spec.count !== 1 ? ', then Confirm' : ''}.`;
}

function hand(state, ui) {
  const cards = state.players.player.hand;
  const mine = state.phase === 'battle' && state.turn === 'player' && !ui.locked;
  const can = new Set(mine && !ui.pending ? [...playable(state, 'player'), ...placeable(state, 'player'), ...playableStrategies(state, 'player'),
    ...playableSupporters(state, 'player'), ...playableItems(state, 'player'), ...playableTrainers(state, 'player')].map((c) => c.uid) : []);
  const n = cards.length;
  // Nothing clipped (v2 Feedback A): the hand fans across a fixed band (between the
  // Recognition panels and the side panel), overlapping more as it grows; the middle rises
  // instead of the edges dropping, so no card goes past the stage.
  const BAND = 1480;
  const CARD = 150;
  const step = n > 1 ? Math.min(CARD + 8, (BAND - CARD) / (n - 1)) : 0;
  const start = (BAND - (CARD + step * (n - 1))) / 2;
  return `<div class="v2-hand">${cards.map((c, i) => {
    const picked = ui.summon === c.uid || ui.location === c.uid || ui.trainer === c.uid;
    const off = i - (n - 1) / 2;
    const angle = off * Math.min(3, 18 / Math.max(1, n));
    const lift = -(((n - 1) / 2) ** 2 - off ** 2) * Math.min(2.5, 30 / Math.max(1, n * n / 4)) - (picked ? 24 : 0);
    const cls = [can.has(c.uid) ? 'playable' : 'unaffordable', picked && 'picked'].filter(Boolean).join(' ');
    const attrs = `data-uid="${c.uid}" data-kind="${c.cardType.toLowerCase().replace('é', 'e')}"`;
    const up = state.events.find((e) => e.type === 'levelUp' && e.uid === c.uid);
    const face = c.cardType === 'Location' ? locationCard(c, { cls, attrs })
      : ['Strategy', 'Supporter', 'Item', 'Trainer'].includes(c.cardType) ? actionCard(c, { cls, attrs })
      : pokemonCard(c, { cls: [cls, up && 'levelup'].filter(Boolean).join(' '), showCost: true, inHand: true, attrs, badge: up ? `Evolved: ${up.to}!` : '' });
    return `<div class="v2-hand-slot" style="left: ${Math.round(start + step * i)}px; z-index: ${i + 1}; transform: translateY(${lift.toFixed(1)}px) rotate(${angle.toFixed(2)}deg)">${face}</div>`;
  }).join('')}</div>`;
}

// A progress bar for one player on a Location's objective, with milestone ticks.
function progressBar(loc, who) {
  const count = loc.objective.count;
  const n = loc.progress[who];
  const ticks = loc.milestones.map((m) => `<i class="tick${loc.reached[who].includes(m.at) ? ' hit' : ''}" style="left: ${(100 * m.at) / count}%" title="${m.at}: ${esc(rewardText(m.reward))}"></i>`).join('');
  return `<div class="v2-prog ${who}${loc.completed[who] ? ' done' : ''}"><span>${who === 'player' ? 'You' : 'Opp'}</span>
    <div class="v2-prog-bar"><b style="width: ${(100 * n) / count}%"></b>${ticks}</div><em>${n}/${count}${loc.completed[who] ? ' ✓' : ''}</em></div>`;
}

// The Location frames over their lanes (both rows), each with its banner in the
// middle of the board; the middle of Home lanes says Home. While a Location from
// hand is picked, the lanes it can start at glow.
function locationLayer(state, ui) {
  // "A chosen Location" (V6): the Locations (and Home) an effect may choose glow.
  const locTargets = new Set(pendingOptions(state, ui).filter((o) => o.kind === 'location').map((o) => o.id));
  const flash = new Set(state.events.filter((e) => ['milestone', 'completed', 'locationPlaced', 'championship'].includes(e.type)).map((e) => e.location ?? e.uid));
  const frames = state.locations.map((loc) => {
    const width = loc.lanes.length;
    const goals = [...loc.milestones.map((m) => `${m.at}: ${rewardText(m.reward)}`), `${loc.objective.count}: ${rewardText(loc.completion)}`].join(' · ');
    return `
      <div class="v2-loc w${width}${loc.championship ? ' champ' : ''}${flash.has(loc.uid) ? ' flash' : ''}${locTargets.has(loc.uid) ? ' loc-target' : ''}" data-loc-target="${loc.uid}" style="grid-column: ${loc.lanes[0] + 1} / span ${width}; --loc: ${loc.color}">
        <div class="v2-loc-art" style="background-image: url('${ASSETS}/${loc.image.replace(/^assets\//, '')}')"></div>
        <div class="v2-loc-banner" title="${esc(`${loc.name}: ${loc.objective.text}. Milestones and completion · ${goals}`)}">
          <header><h4>${esc(loc.name)}</h4><span class="v2-loc-wx">${weatherIcons(loc.weather)}</span></header>
          <p>${esc(loc.objective.text)}</p>
          ${progressBar(loc, 'player')}
          ${progressBar(loc, 'ai')}
          <footer><span class="v2-rounds">${icon('timer')} ${loc.roundsLeft} Round${loc.roundsLeft === 1 ? '' : 's'} left</span>${loc.championship ? `<span class="v2-goals">${esc(goals)}</span>` : ''}</footer>
        </div>
      </div>`;
  }).join('');
  const pick = ui.location ? state.players.player.hand.find((c) => c.uid === ui.location) : null;
  const starts = pick ? locationStarts(state, pick) : [];
  const lanes = Array.from({ length: LANES }, (_, lane) => {
    if (locationAt(state, lane)) return '';
    const can = starts.includes(lane);
    const home = locTargets.has(`home-${lane}`);
    return `<div class="v2-lane${can ? ' pick' : ''}${home ? ' loc-target' : ''}" style="grid-column: ${lane + 1}" data-lane="${lane}"${home ? ` data-loc-target="home-${lane}"` : ''}>${can ? `<span>Place<br>here</span>` : `<span>${home ? 'Home lane<br>(choose)' : 'Home'}</span>`}</div>`;
  }).join('');
  const ghost = pick ? `<div class="v2-loc ghost" style="--loc: ${pick.color}; display: none"></div>` : '';
  return `<div class="v2-locs">${frames}${ghost}</div><div class="v2-lanes">${lanes}</div>`;
}

function backs(n) {
  return `<div class="v2-opp-hand">${Array.from({ length: n }, () => `<i style="background-image: url('${ASSETS}/ui/card-back.jpg')"></i>`).join('')}<span>Hand ${n}</span></div>`;
}

// The slim strip at the top of the mat: the phase and the last thing that happened.
function strip(state) {
  const phase = state.phase === 'battle' ? `Round ${state.round} · Battle Phase` : state.phase === 'gameOver' ? 'Match over' : 'Setup';
  return `<div class="v2-strip"><b>${phase}</b><span>${esc(state.log.at(-1) ?? '')}</span></div>`;
}

// How the match ended, in words.
function resultLine(state) {
  const r = state.result ?? {};
  const who = state.winner === 'player' ? 'You' : 'The Opponent';
  const champ = state.locations.find((l) => l.championship);
  switch (r.reason) {
    case 'target': return `${who} reached ${RECOGNITION_TARGET} Recognition in Round ${state.round}${champ ? ', during the Championship' : ''}.`;
    case 'recognition': return `After Round ${ROUND_LIMIT}, ${who === 'You' ? 'you have' : 'the Opponent has'} the most Recognition.`;
    case 'championship': return `Tied on Recognition after Round ${ROUND_LIMIT}: ${who === 'You' ? 'you have' : 'the Opponent has'} more Championship progress (${champ?.progress.player ?? 0} to ${champ?.progress.ai ?? 0}).`;
    case 'suddenDeath': return `${who} won the sudden-death Round on Recognition.`;
    case 'draw': return 'Still tied after the sudden-death Round: a draw.';
    default: return 'Match over.';
  }
}

// The Empowered summon chooser (the Growth chooser's small dialog style).
function empowerBox(state, ui) {
  const a = ui.empowerAsk;
  const card = a && state.players.player.hand.find((c) => c.uid === a.uid);
  if (!card) return '';
  const energy = state.players.player.energy;
  const can = summonCost(card, true) <= energy;
  return `<div class="v2-ask" role="dialog" aria-label="Empowered summon"><div class="v2-panel">
    <p>Summon <b>${card.name}</b> (Level ${card.level}) into space ${a.space + 1}.</p>
    <div class="v2-ask-buttons">
      <button data-action="summon-plain">Summon<small>${card.cost} Energy</small></button>
      <button data-action="summon-empowered"${can ? '' : ' disabled'}>Empowered<small>${summonCost(card, true)} Energy · ${esc(card.empower.text)}</small></button>
    </div>
    <button data-action="summon-cancel" class="v2-ask-cancel">Cancel</button>
  </div></div>`;
}

// The cost chooser (Strategy Cards): each breakpoint, what it does, which you can pay.
function costBox(state, ui) {
  const a = ui.ask;
  const card = a?.kind === 'cost' && state.players.player.hand.find((c) => c.uid === a.uid);
  if (!card) return '';
  const ok = new Set(breakpointsFor(state, 'player', card).map((b) => b.cost));
  return `<div class="v2-ask" role="dialog" aria-label="Choose the cost"><div class="v2-panel v2-cost-ask">
    <p><b>${card.name}</b>: choose how much Energy to pay (you have ${state.players.player.energy}).</p>
    <div class="v2-bps">${card.breakpoints.map((b) => `<button data-pay="${b.cost}"${ok.has(b.cost) ? '' : ' disabled'}><b>${b.cost}</b><span>${esc(b.text)}</span></button>`).join('')}</div>
    <button data-action="ask-cancel" class="v2-ask-cancel">Cancel</button>
  </div></div>`;
}

// Solar Beam (V6): how much Growth to spend, from 1 up to the breakpoint's most.
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

// Choosing cards (V6): Search, Return, Tracey, Burglar, Swimmer. Up to `n`.
function pickBox(state, ui) {
  const a = ui.ask;
  if (a?.kind !== 'pick') return '';
  const options = pickOptions(state, 'player', a.op);
  const tile = (c) => `<button class="v2-rel${a.chosen.includes(c.uid) ? ' on' : ''}" data-pick="${c.uid}" style="background-image: url('${c.cardType === 'Pokémon' ? (c.art ? `${ASSETS}/cards/${c.art}.jpg` : `${ASSETS}/ui/frame-pokemon.jpg`) : c.cardType === 'Location' ? `${ASSETS}/cards/${c.art ?? c.id}.jpg` : artUrl(c)}')"><span>${esc(c.name)}${c.level ? ` L${c.level}` : ''}</span></button>`;
  return `<div class="v2-ask" role="dialog" aria-label="Choose cards"><div class="v2-panel v2-release-ask">
    <p>${esc(a.label)}: choose ${a.n === 1 ? 'one' : `up to ${a.n}`}.</p>
    <div class="v2-rels">${options.map(tile).join('') || '<p>Nothing matches.</p>'}</div>
    <div class="v2-ask-buttons"><button data-action="pick-done"${a.chosen.length || !options.length ? '' : ' disabled'}>Done</button></div>
  </div></div>`;
}

// Escape Rope (V6): which empty space to move to.
function spaceBox(state, ui) {
  const a = ui.ask;
  if (a?.kind !== 'space') return '';
  return `<div class="v2-ask" role="dialog" aria-label="Choose a space"><div class="v2-panel">
    <p>${esc(a.label)}: move it to which empty space?</p>
    <div class="v2-ask-buttons">${freeSpaces(state, 'player').map((i) => `<button data-space-pick="${i}">${i + 1}</button>`).join('')}</div>
    <button data-action="ask-cancel" class="v2-ask-cancel">Cancel</button>
  </div></div>`;
}

// The Release payment (Supporters): pick exactly N other cards from your hand; the
// Favour shows whether it's met.
function releaseBox(state, ui) {
  const a = ui.ask;
  const card = a?.kind === 'release' && state.players.player.hand.find((c) => c.uid === a.uid);
  if (!card) return '';
  const others = state.players.player.hand.filter((c) => c !== card);
  const picked = others.filter((c) => a.chosen.includes(c.uid));
  const met = favourMet(card, picked);
  const tiles = others.map((c) => `<button class="v2-rel${a.chosen.includes(c.uid) ? ' on' : ''}${FAVOURS[card.favour.condition].test(c) ? ' favour' : ''}" data-rel="${c.uid}" style="background-image: url('${c.cardType === 'Pokémon' ? `${ASSETS}/cards/${c.art}.jpg` : c.cardType === 'Location' ? `${ASSETS}/cards/${c.art ?? c.id}.jpg` : artUrl(c)}')"><span>${esc(c.name)}${c.level ? ` L${c.level}` : ''}</span></button>`).join('');
  return `<div class="v2-ask" role="dialog" aria-label="Release cards"><div class="v2-panel v2-release-ask">
    <p><b>${card.name}</b>: Release ${card.release} card${card.release === 1 ? '' : 's'} from your hand (gone for the match). ${esc(card.text)}.</p>
    <p class="v2-rel-favour${met ? ' met' : ''}">Favour: Release ${esc(FAVOURS[card.favour.condition].text)} → ${esc(card.favour.text)} ${met ? '✓ met' : ''}</p>
    <div class="v2-rels">${tiles}</div>
    <div class="v2-ask-buttons"><button data-action="release-done"${picked.length === card.release ? '' : ' disabled'}>Release ${picked.length}/${card.release} and play</button></div>
    <button data-action="ask-cancel" class="v2-ask-cancel">Cancel</button>
  </div></div>`;
}

// An Item from hand: use it now, or put it into the Bag.
function itemBox(state, ui) {
  const a = ui.ask;
  const card = a?.kind === 'item' && state.players.player.hand.find((c) => c.uid === a.uid);
  if (!card) return '';
  return `<div class="v2-ask" role="dialog" aria-label="Play an Item"><div class="v2-panel">
    <p><b>${card.name}</b> (${card.kind}, ${card.cost} Energy): ${esc(card.text)}</p>
    <div class="v2-ask-buttons">
      <button data-action="item-use"${itemUsable(state, 'player', card) ? '' : ' disabled'}>Use now<small>${card.cost} Energy</small></button>
      <button data-action="item-bag"${bagFull(state, 'player') ? ' disabled' : ''}>Put in the Bag<small>${card.cost} Energy · use it later for 0</small></button>
    </div>
    <button data-action="ask-cancel" class="v2-ask-cancel">Cancel</button>
  </div></div>`;
}

// Your Trainer (clicked): its tiers, and its Ability and the Round's move.
function trainerBox(state, ui) {
  const a = ui.ask;
  const t = a?.kind === 'trainer' && state.players.player.trainers.find((x) => x.uid === a.uid);
  if (!t) return '';
  const lit = tiersUnlocked(t);
  const ab = t.tiers[1].ability;
  const canAbility = usableAbilities(state, 'player').some((x) => x.uid === t.uid);
  const why = lit < 2 ? `unlocks at ${t.tiers[1].cost} points` : t.abilityRound === state.round ? 'used this Round' : `${ab.cost} Energy`;
  return `<div class="v2-ask" role="dialog" aria-label="${esc(t.name)}"><div class="v2-panel v2-trainer-ask">
    <p><b>${t.name}</b> · ${t.points}/${t.tiers[2].cost} Trainer Points · space ${t.space + 1}</p>
    <ul class="v2-tiers">${t.tiers.map((x, i) => `<li class="${i < lit ? 'lit' : ''}"><b>${x.cost} · ${x.kind}</b> ${esc(x.text)}</li>`).join('')}</ul>
    <div class="v2-ask-buttons">
      <button data-action="trainer-ability"${canAbility ? '' : ' disabled'}>Ability<small>${why}</small></button>
      <button data-action="trainer-move"${canMoveTrainer(state, 'player') ? '' : ' disabled'}>Move<small>${state.players.player.movedTrainer ? 'used this Round' : 'once per Round'}</small></button>
    </div>
    <button data-action="ask-cancel" class="v2-ask-cancel">Close</button>
  </div></div>`;
}

// The Breakfast assign step: give your Trainer Points to your Trainers, then lock in.
// The Opponent chooses at the same time; neither sees the other's until both lock in.
function assignBox(state, ui) {
  if (state.phase !== 'assign' || !legalActions(state, 'player').includes('assignPoints')) return '';
  const p = state.players.player;
  const draft = ui.assignDraft ?? {};
  const used = Object.values(draft).reduce((a, b) => a + b, 0);
  const rows = p.trainers.map((t) => {
    const add = draft[t.uid] ?? 0;
    const total = t.points + add;
    const next = t.tiers.find((x) => x.cost > total);
    return `<div class="v2-assign-row">
      <i class="v2-portrait" style="background-image: url('${ASSETS}/cards/${t.art}.jpg')"></i>
      <div><b>${t.name}</b> <span class="v2-tpts">${total}/${t.tiers[2].cost}</span>
        <span class="v2-pips">${t.tiers.map((x) => `<i class="${total >= x.cost ? 'lit' : ''}">${x.kind}</i>`).join('')}</span>
        <small>${next ? `next: ${next.kind} at ${next.cost} (${next.text})` : 'every tier unlocked'}</small></div>
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
  // The end screen (V8): a crest for the ending animation (Victory or Defeat).
  return `<div class="v2-over"><div class="v2-panel"><div class="v2-crest ${title.toLowerCase()}"><h2>${title}</h2></div>
    <p>${resultLine(state)}</p>
    <p>You ${state.players.player.recognition} · Opponent ${state.players.ai.recognition}</p>
    <button data-action="new"${ctx.endDisabled ? ' disabled' : ''}>${ctx.endLabel ?? 'New match'}</button>${ctx.mode && ctx.mode !== 'ai' ? ' <button data-action="leave" class="v2-ask-cancel">Leave</button>' : ''}</div></div>`;
}

export function renderMatch(root, state, ui, ctx) {
  // An On Evolve target to choose (Elliott's V6 ruling): the target picking, at once.
  const choice = state.choices?.[0];
  if (choice?.who === 'player' && !ui.locked && ui.pending?.action.type !== 'chooseTarget') {
    ui.pending = { action: { type: 'chooseTarget', who: 'player' }, spec: choice.spec, label: `${choice.name} (On Evolve): ${choice.text}`, chosen: [], extra: [], ops: [], ctx: choice.ctx };
  }
  const targets = ui.attacker !== null && state.phase === 'battle' ? legalTargets(state, 'player', ui.attacker) : [];
  const playerTarget = targets.some((t) => t.kind === 'player');
  root.innerHTML = `
    <div class="v2-table">
      <header class="v2-title"><h1>Pokémon Legends v2</h1><p>${ctx.playing ? `${ctx.playing.player} vs ${ctx.playing.ai} · ` : ''}${ctx.build} · <a href="../">the current game</a> · ${ctx.mode && ctx.mode !== 'ai' ? `${ctx.modeLabel ?? ''} · <button class="v2-linkbtn" data-action="leave">Leave match</button>` : `<button class="v2-linkbtn" data-action="deck">${ctx.customDeck ? 'Your deck' : 'Deck builder'}</button>`}</p></header>
      ${backs(state.players.ai.hand.length)}
      ${recognitionPanel(state, 'ai', playerTarget, ui)}
      ${recognitionPanel(state, 'player', false, ui)}
      <section class="v2-board">
        <div class="v2-mat"></div>
        ${locationLayer(state, ui)}
        ${row(state, 'ai', ui, targets)}
        ${row(state, 'player', ui, targets)}
      </section>
      ${sidePanel(state, ui, ctx)}
      ${hand(state, ui)}
      <div class="v2-piles"><span>Draw ${state.players.player.drawPile.length}</span><span>Discard ${state.players.player.discard.length}</span><span>Released ${state.players.player.released.length}</span></div>
      ${empowerBox(state, ui)}
      ${costBox(state, ui)}
      ${releaseBox(state, ui)}
      ${itemBox(state, ui)}
      ${amountBox(state, ui)}
      ${pickBox(state, ui)}
      ${spaceBox(state, ui)}
      ${trainerBox(state, ui)}
      ${assignBox(state, ui)}
      ${gameOver(state, ctx)}
    </div>`;
  wire(root, state, ui, ctx);
  fitText(root);
}

// Nothing clipped (v2 Feedback A): text that doesn't fit its box (card text, Location and
// Trainer names) is set smaller until it does, never cut off.
const FIT = [['.v2-act-text', 8], ['.v2-ability', 8], ['.v2-loc-goal', 8], ['.v2-loc-meta', 8], ['.v2-loc-banner h4', 11], ['.v2-loc-banner p', 9], ['.v2-trainer b', 9], ['.v2-name', 10], ['.v2-keys', 7]];
function fitText(root) {
  if (typeof getComputedStyle !== 'function') return;
  for (const [sel, min] of FIT) {
    for (const el of root.querySelectorAll(sel)) {
      let size = parseFloat(getComputedStyle(el).fontSize);
      for (let i = 0; i < 24 && size > min && (el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1); i++) {
        size -= 0.5;
        el.style.fontSize = `${size}px`;
      }
    }
  }
}

function wire(root, state, ui, ctx) {
  const on = (sel, fn) => root.querySelectorAll(sel).forEach((el) => el.addEventListener('click', (e) => { e.stopPropagation(); fn(el); }));
  on('[data-action="flip"]', () => ctx.act({ type: 'flipCoin' }));
  on('[data-action="pass"]', () => ctx.act({ type: 'pass', who: 'player' }));
  on('[data-action="new"]', () => ctx.newMatch());
  on('[data-action="hotseat"]', () => ctx.hotseat?.());
  on('[data-action="online"]', () => ctx.online?.());
  on('[data-action="leave"]', () => ctx.leave?.());
  on('[data-action="deck"]', () => ctx.openDeck());
  root.querySelectorAll('select[data-deck]').forEach((el) => el.addEventListener('change', () => ctx.setDeck(el.dataset.deck, el.value)));
  root.querySelectorAll('select[data-speed]').forEach((el) => {
    el.addEventListener('click', (e) => e.stopPropagation());
    el.addEventListener('change', () => ctx.setSpeed?.(el.value));
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
  // A waiting On Evolve choice: only its targets can be clicked.
  if (ui.pending?.action.type === 'chooseTarget' && !ui.locked) {
    const pick = (ref) => ctx.act({ type: 'chooseTarget', who: 'player', targets: [ref] });
    on('.v2-space.effect-target', (el) => pick({ who: el.dataset.who, kind: 'pokemon', space: Number(el.dataset.space) }));
    on('.v2-recognition.effect-target', (el) => pick({ who: el.dataset.player, kind: 'player' }));
    return;
  }
  if (!(state.phase === 'battle' && state.turn === 'player') || ui.locked) return;
  const hand = state.players.player.hand;
  // Start an action that may need targets: none (or 'all') acts at once; else choose.
  // After targets: a card to pick (Search, Return, Tracey, Burglar, Swimmer) or a space
  // (Escape Rope) asks; otherwise it acts.
  const PICK_OPS = { search: (o) => o.count ?? 1, returnFromDiscard: (o) => o.count ?? 1, lookTop: (o) => o.take, stealItem: () => 1, freeSummon: () => 1 };
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
  const begin = (action, spec, label, extra = [], ops = [], tctx = {}) => {
    ui.ask = null;
    const options = spec && spec.count !== 'all' && !spec.special ? [...targetOptions(state, 'player', spec, tctx), ...extra] : [];
    if (!options.length) return finish(action, ops, label);
    ui.pending = { action, spec, label, chosen: [], extra, ops, ctx: tctx };
    ctx.redraw();
  };
  // A summon with an On summon ability (Chansey): choose its target, the new Pokémon included.
  const summonWith = (action) => {
    const card = hand.find((c) => c.uid === action.uid);
    const spec = card?.ability?.onSummon?.target;
    // The new Pokémon itself only for a train target (Chansey may train itself).
    const self = spec?.side === 'friendly' && spec.filter === 'canTrain' && card.level < trainTop(card) ? [{ who: 'player', kind: 'pokemon', space: action.space }] : [];
    if (!spec || spec.count === 'all' || spec.special) return ctx.act(action);
    ui.empowerAsk = null;
    begin(action, spec, `${card.name}: ${card.ability.text}`, self, [], { space: action.space });
  };
  on('.v2-hand .v2-card.playable', (el) => {
    ui.attacker = null;
    const kind = el.dataset.kind;
    const card = hand.find((c) => c.uid === el.dataset.uid);
    if (kind === 'strategy') { ui.summon = null; ui.location = null; ui.ask = { kind: 'cost', uid: card.uid }; return ctx.redraw(); }
    if (kind === 'supporter') { ui.summon = null; ui.location = null; ui.ask = { kind: 'release', uid: card.uid, chosen: [] }; return ctx.redraw(); }
    if (kind === 'item') { ui.summon = null; ui.location = null; ui.ask = { kind: 'item', uid: card.uid }; return ctx.redraw(); }
    if (kind === 'trainer') { ui.summon = null; ui.location = null; ui.moveTrainer = null; ui.trainer = ui.trainer === card.uid ? null : card.uid; return ctx.redraw(); }
    const key = el.dataset.kind === 'location' ? 'location' : 'summon';
    const other = key === 'location' ? 'summon' : 'location';
    ui[other] = null;
    ui[key] = ui[key] === el.dataset.uid ? null : el.dataset.uid;
    ctx.redraw();
  });
  on('.v2-lane.pick', (el) => ctx.act({ type: 'playLocation', who: 'player', uid: ui.location, start: Number(el.dataset.lane) }));
  // Hovering a lane shows where the Location would go.
  const ghost = root.querySelector('.v2-loc.ghost');
  const pick = state.players.player.hand.find((c) => c.uid === ui.location);
  root.querySelectorAll('.v2-lane.pick').forEach((el) => {
    el.addEventListener('mouseenter', () => { ghost.style.display = ''; ghost.style.gridColumn = `${Number(el.dataset.lane) + 1} / span ${pick.lanes}`; });
    el.addEventListener('mouseleave', () => { ghost.style.display = 'none'; });
  });
  on('.v2-row.player .v2-space.target', (el) => {
    const space = Number(el.dataset.space);
    const card = state.players.player.hand.find((c) => c.uid === ui.summon);
    // A Pokémon with an Empowered summon asks first.
    if (card?.empower) { ui.empowerAsk = { uid: card.uid, space }; ctx.redraw(); return; }
    summonWith({ type: 'summon', who: 'player', uid: ui.summon, space });
  });
  on('[data-action="summon-plain"]', () => summonWith({ type: 'summon', who: 'player', uid: ui.empowerAsk.uid, space: ui.empowerAsk.space }));
  on('[data-action="summon-empowered"]', () => summonWith({ type: 'summon', who: 'player', uid: ui.empowerAsk.uid, space: ui.empowerAsk.space, empowered: true }));
  // Strategy Cards: the chosen breakpoint, then its targets.
  on('[data-pay]', (el) => {
    const card = hand.find((c) => c.uid === ui.ask.uid);
    const bp = card.breakpoints.find((b) => b.cost === Number(el.dataset.pay));
    const label = `${card.name} (${bp.cost}): ${bp.text}`;
    const spend = bp.ops.find((o) => o.op === 'solarBeam');
    if (spend) {
      const max = Math.min(spend.max, state.players.player.growth);
      ui.ask = { kind: 'amount', uid: card.uid, pay: bp.cost, x: max, max, label };
      return ctx.redraw();
    }
    begin({ type: 'playStrategy', who: 'player', uid: card.uid, pay: bp.cost }, bp.target, label, [], bp.ops);
  });
  on('[data-action="amount-step"]', (el) => { ui.ask.x = Math.max(1, Math.min(ui.ask.max, ui.ask.x + Number(el.dataset.step))); ctx.redraw(); });
  on('[data-action="amount-done"]', () => {
    const a = ui.ask;
    const card = hand.find((c) => c.uid === a.uid);
    const bp = card.breakpoints.find((b) => b.cost === a.pay);
    begin({ type: 'playStrategy', who: 'player', uid: card.uid, pay: bp.cost, x: a.x }, bp.target, a.label, [], bp.ops);
  });
  on('[data-pick]', (el) => {
    const a = ui.ask;
    if (a.chosen.includes(el.dataset.pick)) a.chosen = a.chosen.filter((u) => u !== el.dataset.pick);
    else if (a.chosen.length < a.n) a.chosen.push(el.dataset.pick);
    else if (a.n === 1) a.chosen = [el.dataset.pick];
    ctx.redraw();
  });
  on('[data-action="pick-done"]', () => ctx.act({ ...ui.ask.action, picks: ui.ask.chosen }));
  on('[data-space-pick]', (el) => ctx.act({ ...ui.ask.action, picks: { space: Number(el.dataset.spacePick) } }));
  on('[data-action="nurture"]', () => {
    ui.summon = null; ui.location = null; ui.attacker = null;
    begin({ type: 'nurture', who: 'player' }, { side: 'friendly', kinds: ['pokemon'], count: 1, filter: 'canNurture' }, 'Nurture: train 1 one of your Pokémon');
  });
  // Supporters: pick the cards to Release, then targets.
  on('[data-rel]', (el) => {
    const card = hand.find((c) => c.uid === ui.ask.uid);
    const list = ui.ask.chosen;
    if (list.includes(el.dataset.rel)) ui.ask.chosen = list.filter((u) => u !== el.dataset.rel);
    else if (list.length < card.release) list.push(el.dataset.rel);
    ctx.redraw();
  });
  on('[data-action="release-done"]', () => {
    const card = hand.find((c) => c.uid === ui.ask.uid);
    const met = favourMet(card, hand.filter((c) => ui.ask.chosen.includes(c.uid)));
    const spec = met && 'target' in card.favour ? card.favour.target : card.target;
    begin({ type: 'playSupporter', who: 'player', uid: card.uid, release: [...ui.ask.chosen] }, spec, `${card.name}: ${met ? card.favour.text : card.text}`, [], met ? card.favour.ops : card.ops);
  });
  // Items from hand: use now (then targets) or into the Bag; from the Bag: use.
  on('[data-action="item-use"]', () => {
    const card = hand.find((c) => c.uid === ui.ask.uid);
    begin({ type: 'playItem', who: 'player', uid: card.uid, mode: 'use' }, card.target, `${card.name}: ${card.text}`, [], card.ops);
  });
  on('[data-action="item-bag"]', () => ctx.act({ type: 'playItem', who: 'player', uid: ui.ask.uid, mode: 'bag' }));
  on('.v2-bag .item.usable', (el) => {
    const card = state.players.player.bag.find((c) => c.uid === el.dataset.bag);
    ui.summon = null; ui.location = null; ui.attacker = null;
    begin({ type: 'useItem', who: 'player', uid: card.uid }, card.target, `${card.name}: ${card.text}`, [], card.ops);
  });
  on('[data-action="ask-cancel"]', () => { ui.ask = null; ctx.redraw(); });
  // Trainers: attach one from hand; open your Trainer (Ability, Move); a waiting Partner.
  on('.v2-row.player .v2-space.trainer-target', (el) => {
    const space = Number(el.dataset.space);
    if (ui.trainer) return ctx.act({ type: 'playTrainer', who: 'player', uid: ui.trainer, space });
    return ctx.act({ type: 'moveTrainer', who: 'player', uid: ui.moveTrainer, space });
  });
  on('.v2-trainer.clickable', (el) => { ui.summon = null; ui.location = null; ui.trainer = null; ui.ask = { kind: 'trainer', uid: el.dataset.trainer }; ctx.redraw(); });
  on('[data-action="trainer-ability"]', () => {
    const t = state.players.player.trainers.find((x) => x.uid === ui.ask.uid);
    begin({ type: 'useAbility', who: 'player', uid: t.uid }, t.tiers[1].ability.target, `${t.name}: ${t.tiers[1].text}`, [], t.tiers[1].ability.ops, { space: t.space, lane: t.space });
  });
  on('[data-action="trainer-move"]', () => { ui.moveTrainer = ui.ask.uid; ui.ask = null; ctx.redraw(); });
  on('.v2-row.player .v2-space.partner-target', (el) => ctx.act({ type: 'placePartner', who: 'player', uid: state.players.player.waiting[0].uid, space: Number(el.dataset.space) }));
  // Choosing targets: one target acts at once; for more, toggle, then Confirm.
  const pickTarget = (ref) => {
    const pend = ui.pending;
    if (!pend) return;
    if (pend.action.type === 'nurture') return ctx.act({ ...pend.action, space: ref.space });
    if (pend.spec.count === 1) return finish({ ...pend.action, targets: [ref] }, pend.ops, pend.label);
    const key = (t) => `${t.who}:${t.kind}:${t.space ?? ''}`;
    if (pend.chosen.some((t) => key(t) === key(ref))) pend.chosen = pend.chosen.filter((t) => key(t) !== key(ref));
    else if (pend.chosen.length < pend.spec.count) pend.chosen.push(ref);
    ctx.redraw();
  };
  on('.v2-space.effect-target', (el) => pickTarget({ who: el.dataset.who, kind: 'pokemon', space: Number(el.dataset.space) }));
  on('.v2-recognition.effect-target', (el) => pickTarget({ who: el.dataset.player, kind: 'player' }));
  on('.loc-target', (el) => {
    const opt = pendingOptions(state, ui).find((o) => o.kind === 'location' && o.id === el.dataset.locTarget);
    if (opt) pickTarget(opt);
  });
  on('[data-action="targets-done"]', () => finish({ ...ui.pending.action, targets: ui.pending.chosen }, ui.pending.ops, ui.pending.label));
  on('[data-action="targets-cancel"]', () => { ui.pending = null; ctx.redraw(); });
  if (ui.pending) return;
  on('[data-action="summon-cancel"]', () => { ui.empowerAsk = null; ctx.redraw(); });
  on('.v2-row.player .v2-card.selectable', (el) => {
    const space = Number(el.closest('.v2-space').dataset.space);
    ui.summon = null;
    ui.location = null;
    ui.trainer = null;
    ui.moveTrainer = null;
    ui.attacker = ui.attacker === space ? null : space;
    ctx.redraw();
  });
  on('.v2-space.attack-target', (el) => ctx.act({ type: 'attack', who: 'player', from: ui.attacker, target: { kind: 'pokemon', space: Number(el.dataset.space) } }));
  on('.v2-recognition.target', () => ctx.act({ type: 'attack', who: 'player', from: ui.attacker, target: { kind: 'player' } }));
}

export { alertSpaces, opponentOf, pokemonCard, actionCard, locationCard, artUrl };
