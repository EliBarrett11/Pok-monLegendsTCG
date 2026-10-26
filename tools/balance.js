// Balance report: plays seeded AI-vs-AI matches of Fire against Water, in both
// seat orders, and prints how each deck did.
// Run with: node tools/balance.js [matches per seat order] [--variant X]   (default 100)
//
// --variant X tries a balance change for this run only, by changing the card
// data in memory before the matches start (the card files never change).
// Variants: A (current cards), S, C, D, E, E2, E3, I (an AI plan, not a
// card change), L, T, W, B (a rule change), and combinations such as SCE or
// E3TB (see VARIANTS below). (Round 1's Trainer Strength variant "B" is now
// "S"; "B" is the Burn rule from round 3.)
// --decks fire,fire plays a mirror match instead (for checking the seats).
//
// The same matches every time (seeds 1..N for each seat order, the AI's
// choices seeded too), so two runs before and after a change compare like for
// like. A match still going at Round 100 counts as stalled.
import {
  createGame, applyAction, PLAYERS, legalActions, opponentOf, weatherCounts, alertPokemon, legalTargets,
} from '../src/engine/game.js';
import { RULE_FLAGS, cardAt } from '../src/engine/board.js';
import { chooseAction, usePlan } from '../src/ai/opponent.js';
import { nextRandom } from '../src/engine/random.js';
import {
  DECKS, POKEMON_CARDS, STRATEGY_CARDS, SUPPORTER_CARDS, LOCATION_CARDS, ITEM_CARDS, TRAINER_CARDS,
} from '../src/engine/cardData.js';

const args = process.argv.slice(2);
const flag = args.indexOf('--variant');
const VARIANT = flag >= 0 ? args.splice(flag, 2)[1].toUpperCase() : 'A';
const deckFlag = args.indexOf('--decks');
const [SEAT1, SEAT2] = deckFlag >= 0 ? args.splice(deckFlag, 2)[1].split(',') : ['fire', 'water'];
const MATCHES = Number(args[0] ?? 100);

// Balance variants, applied to the card definitions in memory (decks and
// Trainers are built from them, so every match uses the changed numbers).
const card = (list, id) => list.find((c) => c.id === id);
const VARIANTS = {
  A: 'current cards',
  S: () => {   // Trainer Strength level: Fire 46, Water 46 (round 1's "B")
    const set = { blaine: 15, flannery: 14, kabu: 17, misty: 16, 'crasher-wake': 16, wallace: 14 };
    for (const t of TRAINER_CARDS) t.strength = set[t.id];
  },
  C: () => {   // Pelipper and Kyogre carry 1 Rain instead of 2
    for (const id of ['pelipper', 'kyogre']) card(POKEMON_CARDS, id).weatherTokens = { Rain: 1 };
  },
  D: () => {   // Less Trainer healing for Water
    const joy = card(SUPPORTER_CARDS, 'nurse-joy');
    joy.effects[0].amount = 2;
    joy.gift.effects[0].amount = 4;
    card(LOCATION_CARDS, 'route-119').effects[0].amount = 2;
    card(ITEM_CARDS, 'full-heal').effects.find((e) => e.op === 'heal').amount = 1;
  },
  E: () => {   // Every Fire-deck Pokémon gets +1 Strength
    for (const c of POKEMON_CARDS) if (DECKS.fire.list[c.id]) c.strengthValue += 1;
  },
  E2: () => {   // Every Fire-deck Pokémon gets +2 Strength
    for (const c of POKEMON_CARDS) if (DECKS.fire.list[c.id]) c.strengthValue += 2;
  },
  E3: () => {   // Fire-deck Pokémon +1 Strength, +2 for those costing 2 or less
    for (const c of POKEMON_CARDS) if (DECKS.fire.list[c.id]) c.strengthValue += c.energyCost <= 2 ? 2 : 1;
  },
  I: () => usePlan('fire', 'pressure'),   // Fire's AI: Trainer damage ×2, attacks on Pokémon ×0.5
  L: () => {   // Match length: every Trainer +3 Strength
    for (const t of TRAINER_CARDS) t.strength += 3;
  },
  T: () => {   // Fire gets guards: Magmar Special Defence, Arcanine Defence
    card(POKEMON_CARDS, 'magmar').strengthType = 'Special Defence';
    card(POKEMON_CARDS, 'arcanine').strengthType = 'Defence';
  },
  W: () => {   // Weaker Water walls: Quagsire and Vaporeon Regenerate 1 (was 2)
    card(POKEMON_CARDS, 'quagsire').innatePower = 'Regenerate 1';
    card(POKEMON_CARDS, 'vaporeon').innatePower = 'Regenerate 1';
  },
  B: () => {   // Rule: a burned card can't be healed; Douse effects Douse first, then heal
    RULE_FLAGS.burnBlocksHealing = true;
    // Aqua Ring and Nurse Joy (and its Gift) heal, then Douse: swap the order.
    // (Full Heal already Douses first.)
    for (const c of [card(STRATEGY_CARDS, 'aqua-ring'), card(SUPPORTER_CARDS, 'nurse-joy')]) {
      for (const effects of [c.effects, c.gift?.effects].filter(Boolean)) {
        const heal = effects.find((e) => e.op === 'heal');
        effects.splice(0, effects.length, { op: 'douse', target: heal.target }, { op: 'heal', amount: heal.amount, target: { mode: 'chosen' } });
      }
    }
  },
};
const parts = VARIANT.match(/E[23]?|[A-ILSTW]/g) ?? [];
if (parts.join('') !== VARIANT) throw new Error(`Unknown variant: ${VARIANT}`);
for (const part of parts) if (typeof VARIANTS[part] === 'function') VARIANTS[part]();
const STALL_ROUND = 100;
const ORDERS = [{ player: SEAT1, ai: SEAT2 }, { player: SEAT2, ai: SEAT1 }];

// Pokémon a player still has to play: hand, Draw Pile and Discard Pile (not the arena).
const pokemonToPlay = (p) => [...p.hand, ...p.drawPile, ...p.discard].filter((c) => c.cardType === 'Pokémon').length;
const trainerStrength = (p) => p.zones.reduce((sum, z) => sum + Math.max(0, z.trainer?.strength ?? 0), 0);

const blank = () => ({
  matches: 0, wins: 0, losses: 0, draws: 0, stalls: 0, rounds: 0, winRounds: 0,
  trainerDamage: 0, burnDamage: 0, attackDamage: 0, overrunDamage: 0, effectDamage: 0, ranDry: 0, keptPct: 0,
  lostPokemon: 0, initiative: 0, initiativeWins: 0,
  atkGuard: 0, atkOther: 0, atkTrainer: 0, alertChecks: 0, alertBlocked: 0, guardHealed: 0,
});
// Defence and Special Defence Pokémon guard their Trainers (rules 4.2.1).
const GUARD = ['Defence', 'Special Defence'];
// The highest Rain and Sun counts each match reached.
const weather = { Rain: 0, Sun: 0, rain6: 0, sun6: 0 };
// Per seat (and per deck in it): byDeck is keyed by deck, or by seat in a mirror match.
const MIRROR = SEAT1 === SEAT2;
const byDeck = MIRROR ? { player: blank(), ai: blank() } : { [SEAT1]: blank(), [SEAT2]: blank() };
const keyOf = (decks, w) => (MIRROR ? w : decks[w]);
const byOrder = ORDERS.map(() => ({ player: 0, ai: 0, draws: 0, stalls: 0, playerInitiative: 0 }));

ORDERS.forEach((decks, order) => {
  for (let seed = 1; seed <= MATCHES; seed++) {
    let s = createGame(seed, { decks });
    const box = { rng: seed * 7919 + order };
    const rng = () => nextRandom(box);
    const ranDry = { player: false, ai: false };
    let start = null;
    const peak = { Rain: 0, Sun: 0 };
    let last = null;              // the action just applied
    let firstInitiative = null;   // who had Round 1 initiative
    while (s.phase !== 'gameOver' && s.round < STALL_ROUND) {
      const who = PLAYERS.find((w) => legalActions(s, w).length) ?? 'player';
      const action = chooseAction(s, who, { rng }) ?? { type: 'flipCoin' };
      const d = byDeck[keyOf(decks, who)];
      // On each of its Battle decisions: which of its Alert Pokémon can't reach
      // any enemy Trainer because Defence / Special Defence Pokémon guard them.
      if (s.phase === 'battle' && s.turn === who && !s.pending) {
        const trainersUp = s.players[opponentOf(who)].zones.some((z) => z.trainer?.strength > 0);
        for (const a of alertPokemon(s, who)) {
          d.alertChecks += 1;
          if (trainersUp && !legalTargets(s, who, a).some((t) => t.kind === 'trainer')) d.alertBlocked += 1;
        }
      }
      // Where its attacks go.
      if (action.type === 'command') {
        if (action.target.kind === 'trainer') d.atkTrainer += 1;
        else {
          const hit = s.players[opponentOf(who)].zones[action.target.zone].pokemon[action.target.space];
          if (GUARD.includes(hit?.strengthType)) d.atkGuard += 1;
          else d.atkOther += 1;
        }
      }
      last = action.type;
      s = applyAction(s, action);
      if (action.type === 'flipCoin') {
        byDeck[keyOf(decks, s.initiative)].initiative += 1;
        if (s.initiative === 'player') byOrder[order].playerInitiative += 1;
        firstInitiative = s.initiative;
      }
      if (start === null && PLAYERS.every((w) => s.players[w].zones.every((z) => z.trainer))) {
        start = Object.fromEntries(PLAYERS.map((w) => [w, trainerStrength(s.players[w])]));
      }
      // Damage to Trainers by source: Burn (at Supper), Overrun (follows its
      // 'overrun' event), an attack (the rest during a Command), or an effect.
      let overrun = false;
      for (const e of s.events) {
        if (e.type === 'overrun') overrun = true;
        if (e.type === 'defeated' && e.target.kind === 'pokemon') byDeck[keyOf(decks, e.target.owner)].lostPokemon += 1;
        if (e.type === 'heal' && e.target.kind === 'pokemon' && e.amount > 0) {
          const healed = cardAt(s, e.target);
          if (healed?.uid === e.target.uid && GUARD.includes(healed.strengthType)) byDeck[keyOf(decks, e.target.owner)].guardHealed += e.amount;
        }
        if (e.type !== 'damage' || e.target.kind !== 'trainer') continue;
        const dealt = Math.max(0, e.before - Math.max(0, e.after));   // what was actually lost
        const by = byDeck[keyOf(decks, opponentOf(e.target.owner))];
        by.trainerDamage += dealt;
        if (e.cause === 'burn') by.burnDamage += dealt;
        else if (overrun) { by.overrunDamage += dealt; overrun = false; }
        else if (last === 'command') by.attackDamage += dealt;
        else by.effectDamage += dealt;
      }
      if (s.round > 0) for (const w of PLAYERS) if (pokemonToPlay(s.players[w]) === 0) ranDry[w] = true;
      const now = weatherCounts(s);
      for (const type of ['Rain', 'Sun']) peak[type] = Math.max(peak[type], now[type] ?? 0);
    }
    weather.Rain += peak.Rain;
    weather.Sun += peak.Sun;
    if (peak.Rain >= 6) weather.rain6 += 1;
    if (peak.Sun >= 6) weather.sun6 += 1;
    for (const w of PLAYERS) {
      const d = byDeck[keyOf(decks, w)];
      d.matches += 1;
      d.rounds += s.round;
      if (ranDry[w]) d.ranDry += 1;
      if (s.phase !== 'gameOver') d.stalls += 1;
      else if (!s.winner) d.draws += 1;
      else if (s.winner === w) {
        d.wins += 1;
        if (firstInitiative === w) d.initiativeWins += 1;
        d.winRounds += s.round;
        d.keptPct += (100 * trainerStrength(s.players[w])) / start[w];
      } else d.losses += 1;
    }
    const o = byOrder[order];
    if (s.phase !== 'gameOver') o.stalls += 1;
    else if (!s.winner) o.draws += 1;
    else o[s.winner] += 1;
  }
});

const pct = (n, of) => `${((100 * n) / (of || 1)).toFixed(1)}%`;
const avg = (n, of) => (of ? (n / of).toFixed(1) : '-');
console.log(`Variant ${VARIANT}${VARIANT === 'A' ? ' (current cards)' : ''}`);
console.log(`Balance report: ${DECKS[SEAT1].name} vs ${DECKS[SEAT2].name}${MIRROR ? ' (rows are seats)' : ''}, ${MATCHES} seeded AI-vs-AI matches in each seat order (${2 * MATCHES} in all; stalled = still going at Round ${STALL_ROUND})`);
for (const [id, d] of Object.entries(byDeck)) {
  console.log(`  ${(DECKS[id]?.name ?? id).padEnd(6)} won ${pct(d.wins, d.matches)} · lost ${pct(d.losses, d.matches)} · drawn ${pct(d.draws, d.matches)} · stalled ${pct(d.stalls, d.matches)}`);
  console.log(`         ${avg(d.rounds, d.matches)} Rounds per match (${avg(d.winRounds, d.wins)} in its wins, keeping ${avg(d.keptPct, d.wins)}% of its Trainer Strength)`);
  console.log(`         ${avg(d.trainerDamage, d.matches)} damage to enemy Trainers per match: attacks ${avg(d.attackDamage, d.matches)} · Burn ${avg(d.burnDamage, d.matches)} · Overrun ${avg(d.overrunDamage, d.matches)} · effects ${avg(d.effectDamage, d.matches)}`);
  console.log(`         ${avg(d.lostPokemon, d.matches)} of its Pokémon defeated per match`);
  const attacks = d.atkGuard + d.atkOther + d.atkTrainer;
  console.log(`         attacks (${avg(attacks, d.matches)} per match): into Defence/Sp. Defence Pokémon ${pct(d.atkGuard, attacks)} · other Pokémon ${pct(d.atkOther, attacks)} · Trainers ${pct(d.atkTrainer, attacks)}`);
  console.log(`         its Alert Pokémon couldn't target any Trainer (guarded) ${pct(d.alertBlocked, d.alertChecks)} of the time; `
    + `its Defence/Sp. Defence Pokémon healed ${avg(d.guardHealed, d.matches)} per match`);
  console.log(`         Round 1 initiative in ${pct(d.initiative, d.matches)} of matches; won ${pct(d.initiativeWins, d.initiative)} of those, ${pct(d.wins - d.initiativeWins, d.matches - d.initiative)} of the rest`);
  console.log(`         ran dry (no Pokémon left in hand, Draw Pile and Discard Pile) in ${pct(d.ranDry, d.matches)} of matches`);
}
ORDERS.forEach((decks, i) => {
  const o = byOrder[i];
  console.log(`  You ${DECKS[decks.player].name} vs AI ${DECKS[decks.ai].name}: You ${o.player}, AI ${o.ai}, drawn ${o.draws}, stalled ${o.stalls}; you had Round 1 initiative in ${o.playerInitiative}`);
});
console.log(`  Weather: highest Rain per match ${avg(weather.Rain, 2 * MATCHES)} (6+ in ${pct(weather.rain6, 2 * MATCHES)} of matches); `
  + `highest Sun ${avg(weather.Sun, 2 * MATCHES)} (6+ in ${pct(weather.sun6, 2 * MATCHES)})`);
