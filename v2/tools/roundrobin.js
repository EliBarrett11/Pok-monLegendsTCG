// The v2 round-robin (V6; diagnostics and variants V7a): AI-vs-AI matches for every pairing
// of the three decks, seats alternating (half the matches each way round).
//
//   node v2/tools/roundrobin.js [matches per matchup, default 40] [--mixed] [--variant=T75,L+,W1] [--json]
//
// --mixed     only the three mixed matchups (no mirrors)
// --variant   balance-experiment flags, off by default and never the game's settings:
//             T75 / T90  Recognition target 75 / 90
//             L+         every Location Recognition reward ×1.5 (rounded up)
//             CH8        the Championship arrives in Round 8 (the limit stays 12)
//             W1         Water Pokémon +1 Strength at every Level
//             W2         Water's Locations last 1 Round longer; their milestones give +1 Recognition
//             CH9        the Championship arrives in Round 9
//             N3         Nurture costs 3 Growth (Gardenia's lane: 2)
//             N1         Nurture is once per Round in total (not per Pokémon)
//             NR         Nurture can't raise a Pokémon above the Round number + 1
//             GX         only the Bulbasaur line makes Growth at Breakfast (Oddish and Sunkern don't)
//             F1         Fire Pokémon +1 Strength at every Level
//             LG         lane guards: a guard only restricts attacks in its own lane (so the enemy
//                        player is guarded only by a matching guard across from the attacker)
//             FG         Fire guards: Growlithe → Arcanine has Defence; Duskull 2 copies (for 1 Mankey)
//             C1         no Pokémon costs less than 1 (light weight can't make it free)
//             GS         Grass-deck Pokémon −1 Strength at every Level
//             SL         Sleep Powder costs 3; Gloom / Bellossom / Butterfree's On Evolve Sleep
//                        only reaches a Pokémon of a lower Level than themselves
//             ER         Erika's Passive is "your Pokémon in her lane gain +1 Strength" (no training)
// --json      one JSON line with the results (for v2/tools/variants.js)
//
// For each deck in each matchup it reports, per match: Recognition by source (attacks on
// the enemy player, Overrun, Strategy and ability damage to the player, Location
// milestones and completions, the Championship, other), Recognition it removed from the
// enemy (by Burn at Supper, and Ember-style losses), how often its attacks were limited by
// guards, its Pokémon defeated, the average Level of the Pokémon it played, and Rounds.
// V7b adds: Growth gained by source, Nurtures, other training by source (Levels gained),
// the average Level of its Pokémon on the board at each Supper against the Round number,
// and how often its guards were Asleep when an enemy attack had to go through them.
import { createGame, applyAction, actor, legalTargets } from '../src/engine/game.js';
import { DECKS, POOL_ITEMS } from '../src/engine/cards.js';
import { chooseAction } from '../src/ai/opponent.js';

export const VARIANTS = {
  T75: { target: 75 }, T90: { target: 90 }, 'L+': { locMult: 1.5 }, CH8: { champRound: 8 },
  W1: { waterStrength: 1 }, W2: { waterLocations: true }, CH9: { champRound: 9 }, F1: { fireStrength: 1 }, LG: { laneGuards: true }, FG: { fireGuards: true },
  C1: { minCost: 1 }, GS: { grassStrength: -1 }, SL: { sleepLimit: true },
  N3: { nurtureCost: 3 }, N1: { nurtureOnce: true }, NR: { nurtureRoundCap: true }, GX: { growthBulbasaurOnly: true }, ER: { erikaStrength: true },
};
export const variantOf = (flags = []) => (flags.length ? Object.assign({}, ...flags.map((f) => {
  if (!VARIANTS[f]) throw new Error(`No variant ${f}`);
  return VARIANTS[f];
})) : null);

// The deck list a matchup plays (FG swaps 1 Mankey for a second Duskull in Fire's list).
export function deckList(name, variant) {
  const list = DECKS[name].list;
  if (!(variant?.fireGuards && name === 'fire')) return list;
  const i = list.findIndex((e) => e.series === 'f-mankey');
  const duskull = list.find((e) => e.series === 'f-duskull');
  return list.map((e, k) => (k === i ? { ...duskull } : e));
}

const SOURCES = ['attack', 'overrun', 'effect', 'location', 'championship', 'other'];
const blank = () => ({ wins: 0, recognition: Object.fromEntries(SOURCES.map((k) => [k, 0])), burnRemoved: 0, lossRemoved: 0,
  attacks: 0, guarded: 0, defeated: 0, levels: 0, played: 0,
  growth: {}, nurtures: 0, training: {}, board: {}, guardsMet: 0, guardsAsleep: 0, ownLane: 0, atPlayer: 0,
  free: 0, passes: 0, atSpent: 0, atAsleep: 0, monRounds: 0, suppers: 0 });
const add = (o, k, n) => { o[k] = (o[k] ?? 0) + n; };
// A readable source for a Growth or training cause ('ability:g-oddish' → 'Oddish line').
const LINE_NAMES = { 'g-eevee': 'Leafeon (Eevee line)', 'g-celebi': 'Celebi' };
export function sourceName(cause) {
  if (!cause) return 'other';
  if (cause === 'nurture' || cause === 'Sun 4') return cause === 'nurture' ? 'Nurture' : 'Sun 4';
  if (cause === 'attack') return 'On Attack';
  if (cause === 'chooseTarget') return 'On Evolve (chosen target)';
  const [kind, rest] = cause.split(/:(.*)/s);
  if (kind === 'ability') return LINE_NAMES[rest] ?? `${rest.replace(/^[a-z]-/, '').replace(/^./, (c) => c.toUpperCase())} line`;
  if (['strategy', 'supporter', 'item', 'trainer'].includes(kind)) return rest;
  return kind;
}

// One matchup: n matches, seats alternating. Returns totals per deck (by seat-free name).
export function runMatchup(a, b, n, variant = null, seed0 = 1000) {
  const r = { pair: [a, b], n, draws: 0, rounds: 0, ends: { early: 0, championship: 0, final: 0 }, deck: { [a]: blank(), [b]: blank() }, seats: { first: 0, second: 0 } };
  const mirror = a === b;
  if (mirror) r.deck = { player: blank(), ai: blank() };
  const champ = variant?.champRound ?? 10;
  for (let i = 0; i < n; i++) {
    const seed = seed0 + i;
    const swap = i % 2 === 1;
    const [p, q] = swap ? [b, a] : [a, b];
    const deckOf = (who) => (mirror ? who : who === 'player' ? p : q);
    let s = createGame(seed, { decks: { player: deckList(p, variant), ai: deckList(q, variant) }, itemPool: POOL_ITEMS, plans: { player: p, ai: q }, variant });
    let k = seed;
    const rng = () => { k = (k * 9301 + 49297) % 233280; return k / 233280; };
    for (let guard = 0; guard < 10000 && s.phase !== 'gameOver'; guard++) {
      const who = actor(s);
      const action = chooseAction(s, who, { rng });
      if (action.type === 'attack') {
        const d = r.deck[deckOf(who)];
        d.attacks += 1;
        if (action.target?.kind === 'player') d.atPlayer += 1;
        else {
          if (action.target?.space === action.from) d.ownLane += 1;
          const t = s.players[who === 'player' ? 'ai' : 'player'].row[action.target.space];
          if (t?.spent) { d.atSpent += 1; if (t.asleep) d.atAsleep += 1; }
        }
        const options = legalTargets(s, who, action.from);
        if (!options.some((t) => t.kind === 'player')) {
          d.guarded += 1;
          const foe = who === 'player' ? 'ai' : 'player';
          const g = r.deck[deckOf(foe)];
          for (const t of options) {
            g.guardsMet += 1;
            if (s.players[foe].row[t.space]?.asleep) g.guardsAsleep += 1;
          }
        }
      }
      if (action.type === 'pass') r.deck[deckOf(who)].passes += 1;
      const prev = s;
      s = applyAction(s, action);
      // Supper: the board as it stood (the action that ends a Round changes nothing on it).
      if (s.events.some((e) => e.type === 'phaseChanged' && e.phase === 'supper')) {
        for (const w of ['player', 'ai']) {
          const mons = prev.players[w].row.filter(Boolean);
          r.deck[deckOf(w)].suppers += 1;
          r.deck[deckOf(w)].monRounds += mons.length;
          if (!mons.length) continue;
          const b = r.deck[deckOf(w)].board;
          const at = (b[prev.round] ??= { level: 0, n: 0 });
          at.level += mons.reduce((x, c) => x + c.level, 0) / mons.length;
          at.n += 1;
        }
      }
      for (const e of s.events) {
        if (e.type === 'growth') add(r.deck[deckOf(e.who)].growth, sourceName(e.cause), e.amount);
        else if (e.type === 'nurtured') r.deck[deckOf(e.who)].nurtures += 1;
        else if (e.type === 'trained' && e.cause !== 'nurture') add(r.deck[deckOf(e.who)].training, sourceName(e.cause), e.to - e.from);
        else if (e.type === 'recognition') r.deck[deckOf(e.who)].recognition[e.source ?? 'other'] += e.amount;
        else if (e.type === 'burnRecognition') r.deck[deckOf(e.who === 'player' ? 'ai' : 'player')].burnRemoved += e.amount;
        else if (e.type === 'recognitionLost') r.deck[deckOf(e.who === 'player' ? 'ai' : 'player')].lossRemoved += e.amount;
        else if (e.type === 'defeated') r.deck[deckOf(e.who)].defeated += 1;
        else if (e.type === 'summoned' && !e.partner && e.level !== undefined) {
          const d = r.deck[deckOf(e.who)];
          d.levels += e.level;
          d.played += 1;
          if (e.cost === 0) d.free += 1;
        }
      }
    }
    if (s.phase !== 'gameOver') throw new Error(`${a}–${b} seed ${seed} did not finish`);
    r.rounds += s.round;
    if (!s.winner) r.draws += 1;
    else {
      r.deck[deckOf(s.winner)].wins += 1;
      if (mirror) r.seats[s.winner === 'player' ? 'first' : 'second'] += 1;
    }
    if (s.result.reason === 'target') r.ends[s.round < champ ? 'early' : 'championship'] += 1;
    else r.ends.final += 1;
  }
  return r;
}

const PAIRS = { all: [['fire', 'water'], ['fire', 'grass'], ['water', 'grass'], ['fire', 'fire'], ['water', 'water'], ['grass', 'grass']], mixed: [['fire', 'water'], ['fire', 'grass'], ['water', 'grass']] };
export const pairsFor = (mixed) => (mixed ? PAIRS.mixed : PAIRS.all);

const per = (x, n) => (x / n).toFixed(1);
const bySource = (o, n) => {
  const list = Object.entries(o).sort((x, y) => y[1] - x[1]);
  const total = list.reduce((x, [, v]) => x + v, 0);
  return list.length ? `${per(total, n)} (${list.map(([k, v]) => `${k} ${per(v, n)}`).join(', ')})` : '0';
};
export function extraReport(d, n) {
  const rounds = Object.keys(d.board).map(Number).sort((x, y) => x - y);
  const curve = rounds.map((k) => `R${k} ${(d.board[k].level / d.board[k].n).toFixed(1)}`).join(', ');
  const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0);
  return `Pokémon in play per Round ${d.suppers ? (d.monRounds / d.suppers).toFixed(1) : '–'} · 0-cost summons/match ${per(d.free, n)} · `
    + `attacks per Pokémon per Round ${d.monRounds ? (d.attacks / d.monRounds).toFixed(2) : '–'} · passes/match ${per(d.passes, n)} · `
    + `attacks on a Spent target ${pct(d.atSpent, d.attacks)}% (Asleep ${pct(d.atAsleep, d.atSpent)}% of those) · Pokémon defeated/match ${per(d.defeated, n)} · `
    + `Growth/match ${bySource(d.growth, n)} · Nurtures/match ${per(d.nurtures, n)} · other training (Levels)/match ${bySource(d.training, n)} · `
    + `attacks on a target in its own lane ${d.attacks ? Math.round((100 * d.ownLane) / d.attacks) : 0}%, on the enemy player ${d.attacks ? Math.round((100 * d.atPlayer) / d.attacks) : 0}% · `
    + `avg board Level at Supper by Round: ${curve || '–'} · its guards Asleep when attacked through: ${d.guardsMet ? Math.round((100 * d.guardsAsleep) / d.guardsMet) : 0}% of ${per(d.guardsMet, n)}/match`;
}
export function report(r) {
  const [a, b] = r.pair;
  const name = (k) => (DECKS[k] ? DECKS[k].name : k === 'player' ? 'first seat' : 'second seat');
  const pct = (x) => `${Math.round((100 * x) / r.n)}%`;
  const lines = [];
  const head = a === b
    ? `${DECKS[a].name} mirror: first seat ${r.deck.player.wins}, second ${r.deck.ai.wins}${r.draws ? `, draws ${r.draws}` : ''}`
    : `${DECKS[a].name}–${DECKS[b].name}: ${DECKS[a].name} ${r.deck[a].wins} (${pct(r.deck[a].wins)}), ${DECKS[b].name} ${r.deck[b].wins} (${pct(r.deck[b].wins)})${r.draws ? `, draws ${r.draws}` : ''}`;
  lines.push(`${head} · avg ${per(r.rounds, r.n)} Rounds · ends: early (target reached before the Championship) ${r.ends.early}, in the Championship ${r.ends.championship}, final count ${r.ends.final}`);
  for (const [k, d] of Object.entries(r.deck)) {
    const rec = d.recognition;
    const total = SOURCES.reduce((x, s) => x + rec[s], 0);
    lines.push(`  ${name(k)}: Recognition/match ${per(total, r.n)} = attacks ${per(rec.attack, r.n)}, Overrun ${per(rec.overrun, r.n)}, Strategy/ability damage ${per(rec.effect, r.n)}, Locations ${per(rec.location, r.n)}, Championship ${per(rec.championship, r.n)}, other ${per(rec.other, r.n)} · removed from the enemy: Burn ${per(d.burnRemoved, r.n)}, Ember-style ${per(d.lossRemoved, r.n)} · attacks ${per(d.attacks, r.n)}/match, ${d.attacks ? Math.round((100 * d.guarded) / d.attacks) : 0}% limited by guards · Pokémon defeated ${per(d.defeated, r.n)}/match · avg Level played ${d.played ? (d.levels / d.played).toFixed(2) : '–'}`);
    lines.push(`    ${extraReport(d, r.n)}`);
  }
  return lines.join('\n');
}

// The command line.
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const n = Number(args.find((x) => /^\d+$/.test(x))) || 40;
  const flags = args.find((x) => x.startsWith('--variant='))?.slice(10).split(',').filter(Boolean) ?? [];
  const variant = variantOf(flags);
  const results = pairsFor(args.includes('--mixed')).map(([a, b]) => runMatchup(a, b, n, variant));
  if (args.includes('--json')) console.log(JSON.stringify({ flags, results }));
  else for (const r of results) console.log(report(r));
}
