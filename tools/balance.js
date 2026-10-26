// Balance report: plays seeded AI-vs-AI matches of Fire against Water, in both
// seat orders, and prints how each deck did.
// Run with: node tools/balance.js [matches per seat order] [--variant X]   (default 100)
//
// --variant X tries a balance change for this run only, by changing the card
// data in memory before the matches start (the card files never change).
// Variants: A (current cards), B, C, D, E, and combinations such as BC, BCE,
// BCDE (see VARIANTS below).
//
// The same matches every time (seeds 1..N for each seat order, the AI's
// choices seeded too), so two runs before and after a change compare like for
// like. A match still going at Round 100 counts as stalled.
import { createGame, applyAction, PLAYERS, legalActions, opponentOf, weatherCounts } from '../src/engine/game.js';
import { chooseAction } from '../src/ai/opponent.js';
import { nextRandom } from '../src/engine/random.js';
import { DECKS, POKEMON_CARDS, SUPPORTER_CARDS, LOCATION_CARDS, ITEM_CARDS, TRAINER_CARDS } from '../src/engine/cardData.js';

const args = process.argv.slice(2);
const flag = args.indexOf('--variant');
const VARIANT = flag >= 0 ? args.splice(flag, 2)[1].toUpperCase() : 'A';
const MATCHES = Number(args[0] ?? 100);

// Balance variants, applied to the card definitions in memory (decks and
// Trainers are built from them, so every match uses the changed numbers).
const card = (list, id) => list.find((c) => c.id === id);
const VARIANTS = {
  A: 'current cards',
  B: () => {   // Trainer Strength level: Fire 46, Water 46
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
};
for (const letter of VARIANT) {
  if (!VARIANTS[letter]) throw new Error(`Unknown variant: ${letter}`);
  if (typeof VARIANTS[letter] === 'function') VARIANTS[letter]();
}
const STALL_ROUND = 100;
const ORDERS = [{ player: 'fire', ai: 'water' }, { player: 'water', ai: 'fire' }];

// Pokémon a player still has to play: hand, Draw Pile and Discard Pile (not the arena).
const pokemonToPlay = (p) => [...p.hand, ...p.drawPile, ...p.discard].filter((c) => c.cardType === 'Pokémon').length;
const trainerStrength = (p) => p.zones.reduce((sum, z) => sum + Math.max(0, z.trainer?.strength ?? 0), 0);

const blank = () => ({
  matches: 0, wins: 0, losses: 0, draws: 0, stalls: 0, rounds: 0, winRounds: 0,
  trainerDamage: 0, burnDamage: 0, ranDry: 0, keptPct: 0,
});
// The highest Rain and Sun counts each match reached.
const weather = { Rain: 0, Sun: 0, rain6: 0, sun6: 0 };
const byDeck = { fire: blank(), water: blank() };
const byOrder = ORDERS.map(() => ({ player: 0, ai: 0, draws: 0, stalls: 0 }));

ORDERS.forEach((decks, order) => {
  for (let seed = 1; seed <= MATCHES; seed++) {
    let s = createGame(seed, { decks });
    const box = { rng: seed * 7919 + order };
    const rng = () => nextRandom(box);
    const ranDry = { player: false, ai: false };
    let start = null;
    const peak = { Rain: 0, Sun: 0 };
    while (s.phase !== 'gameOver' && s.round < STALL_ROUND) {
      const who = PLAYERS.find((w) => legalActions(s, w).length) ?? 'player';
      s = applyAction(s, chooseAction(s, who, { rng }) ?? { type: 'flipCoin' });
      if (start === null && PLAYERS.every((w) => s.players[w].zones.every((z) => z.trainer))) {
        start = Object.fromEntries(PLAYERS.map((w) => [w, trainerStrength(s.players[w])]));
      }
      for (const e of s.events) {
        if (e.type !== 'damage' || e.target.kind !== 'trainer') continue;
        const dealt = Math.max(0, e.before - Math.max(0, e.after));   // what was actually lost
        const by = byDeck[decks[opponentOf(e.target.owner)]];
        by.trainerDamage += dealt;
        if (e.cause === 'burn') by.burnDamage += dealt;
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
      const d = byDeck[decks[w]];
      d.matches += 1;
      d.rounds += s.round;
      if (ranDry[w]) d.ranDry += 1;
      if (s.phase !== 'gameOver') d.stalls += 1;
      else if (!s.winner) d.draws += 1;
      else if (s.winner === w) {
        d.wins += 1;
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
console.log(`Balance report: Fire vs Water, ${MATCHES} seeded AI-vs-AI matches in each seat order (${2 * MATCHES} in all; stalled = still going at Round ${STALL_ROUND})`);
for (const [id, d] of Object.entries(byDeck)) {
  console.log(`  ${DECKS[id].name.padEnd(6)} won ${pct(d.wins, d.matches)} · lost ${pct(d.losses, d.matches)} · drawn ${pct(d.draws, d.matches)} · stalled ${pct(d.stalls, d.matches)}`);
  console.log(`         ${avg(d.rounds, d.matches)} Rounds per match (${avg(d.winRounds, d.wins)} in its wins, keeping ${avg(d.keptPct, d.wins)}% of its Trainer Strength)`);
  console.log(`         ${avg(d.trainerDamage, d.matches)} damage to enemy Trainers per match (${avg(d.burnDamage, d.matches)} of it from Burn)`);
  console.log(`         ran dry (no Pokémon left in hand, Draw Pile and Discard Pile) in ${pct(d.ranDry, d.matches)} of matches`);
}
ORDERS.forEach((decks, i) => {
  const o = byOrder[i];
  console.log(`  You ${DECKS[decks.player].name} vs AI ${DECKS[decks.ai].name}: ${DECKS[decks.player].name} ${o.player}, ${DECKS[decks.ai].name} ${o.ai}, drawn ${o.draws}, stalled ${o.stalls}`);
});
console.log(`  Weather: highest Rain per match ${avg(weather.Rain, 2 * MATCHES)} (6+ in ${pct(weather.rain6, 2 * MATCHES)} of matches); `
  + `highest Sun ${avg(weather.Sun, 2 * MATCHES)} (6+ in ${pct(weather.sun6, 2 * MATCHES)})`);
