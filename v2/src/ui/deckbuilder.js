// The deck builder (V3, simple for now): build a 40-card test deck by picking
// series and setting each card's cap (the highest Level it trains to), with its cost
// at the cap and the copy limits by rarity (each card in a series uses 1 copy slot).
// Locations are added by count. The deck is checked with the engine's deckProblems.
import { SERIES, TEST_DECK, deckProblems, copiesOf, copyLimit, ALL_OTHER_CARDS } from '../engine/cards.js';
import { costRange } from '../engine/cardtypes.js';
import { pokemonAt, stagesText } from '../engine/series.js';
import { TEST_LOCATIONS, lastsText } from '../engine/locations.js';
import { DECK_SIZE, LEGENDARY_PER_DECK } from '../engine/rules.js';

const ASSETS = '../assets';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

// ctx: { deck, onUse(deck), onClose() }. The working copy lives here until "Use this deck".
export function openDeckBuilder(host, ctx) {
  let deck = ctx.deck.map((e) => ({ ...e }));
  const el = document.createElement('div');
  el.className = 'v2-builder';
  host.appendChild(el);

  const close = () => { el.remove(); ctx.onClose?.(); };

  function seriesRow(line) {
    const cards = deck.map((e, i) => ({ e, i })).filter(({ e }) => e.series === line.id);
    const limit = copyLimit(line.id);
    const legendaryFull = line.legendary && deck.filter((e) => SERIES.find((l) => l.id === e.series)?.legendary).length >= LEGENDARY_PER_DECK;
    const full = cards.length >= limit || legendaryFull;
    const chips = cards.map(({ e, i }) => {
      const top = pokemonAt(line.id, e.cap);
      const options = Array.from({ length: line.maxLevel }, (_, k) => k + 1).map((lv) => `<option value="${lv}"${lv === e.cap ? ' selected' : ''}>Cap ${lv}</option>`).join('');
      return `<span class="v2-chip"><select data-i="${i}">${options}</select><em>${top.name} · cost ${top.cost}</em><button data-remove="${i}" title="Remove">×</button></span>`;
    }).join('');
    return `<div class="v2-brow">
      <div class="v2-bart" style="background-image: url('${ASSETS}/cards/${line.art}.jpg')"></div>
      <div class="v2-binfo"><b>${esc(stagesText(line))}</b>
        <small>${line.rarity} · ${line.type} · ${line.weight}${line.empower ? ` · Empower ${esc(line.empower.text)}` : ''} · copies ${cards.length}/${limit}</small>
        <div class="v2-chips">${chips}<button class="v2-add" data-add="${line.id}"${full ? ' disabled' : ''}>+ Add (cap ${line.maxLevel})</button></div>
      </div></div>`;
  }

  function locationRow(loc) {
    const n = copiesOf(deck)[loc.id] ?? 0;
    const limit = copyLimit(loc.id);
    return `<div class="v2-brow loc" style="--loc: ${loc.color}">
      <div class="v2-bart" style="background-image: url('${ASSETS}/cards/${loc.id}.jpg')"></div>
      <div class="v2-binfo"><b>${esc(loc.name)}</b><small>Location · ${loc.lanes} lane${loc.lanes > 1 ? 's' : ''} · ${lastsText(loc.rounds)} · ${esc(loc.objective.text)}</small>
        <div class="v2-chips"><button data-loc-minus="${loc.id}"${n ? '' : ' disabled'}>−</button><span class="v2-count">${n}/${limit}</span><button data-loc-plus="${loc.id}"${n >= limit ? ' disabled' : ''}>+</button></div>
      </div></div>`;
  }

  // Strategy Cards, Supporters and Items (V4), by count.
  function cardRow(card) {
    const n = copiesOf(deck)[card.id] ?? 0;
    const limit = copyLimit(card.id);
    const what = card.cardType === 'Strategy' ? `Strategy · cost ${costRange(card)} · ${card.breakpoints.map((b) => `${b.cost}: ${b.text}`).join(' · ')}`
      : card.cardType === 'Supporter' ? `Supporter · Release ${card.release} · ${card.text}`
        : `Item (${card.kind}) · cost ${card.cost} · ${card.text}`;
    const art = card.art ? `${ASSETS}/cards/${card.art}.jpg` : `${ASSETS}/ui/frame-item.jpg`;
    return `<div class="v2-brow">
      <div class="v2-bart" style="background-image: url('${art}')"></div>
      <div class="v2-binfo"><b>${esc(card.name)}</b><small title="${esc(what)}">${card.rarity} · ${esc(what)}</small>
        <div class="v2-chips"><button data-card-minus="${card.id}"${n ? '' : ' disabled'}>−</button><span class="v2-count">${n}/${limit}</span><button data-card-plus="${card.id}"${n >= limit ? ' disabled' : ''}>+</button></div>
      </div></div>`;
  }

  function draw() {
    const problems = deckProblems(deck);
    const pokemon = deck.filter((e) => e.series).length;
    const locations = deck.filter((e) => e.location).length;
    el.innerHTML = `<div class="v2-panel v2-builder-panel">
      <header><h2>Deck builder</h2>
        <p>Each card is a series and a cap: in a match its Level is the Round number, up to the cap. Copy limits by rarity: Common 3, Rare 2, Legendary 1 (one Legendary per deck).</p>
        <div class="v2-btotal ${deck.length === DECK_SIZE ? 'ok' : ''}">${deck.length} / ${DECK_SIZE} cards · ${pokemon} Pokémon · ${locations} Locations · ${deck.length - pokemon - locations} Strategy, Supporter and Item cards</div>
      </header>
      <div class="v2-blist">${SERIES.map(seriesRow).join('')}${TEST_LOCATIONS.map(locationRow).join('')}${ALL_OTHER_CARDS.map(cardRow).join('')}</div>
      <footer>
        <div class="v2-bproblems">${problems.length ? problems.map((p) => `<p>${esc(p)}</p>`).join('') : '<p class="ok">This deck is ready.</p>'}</div>
        <button data-b="premade">Premade deck</button>
        <button data-b="close">Close</button>
        <button data-b="use" class="main"${problems.length ? ' disabled' : ''}>Use this deck</button>
      </footer>
    </div>`;
    wire();
  }

  function wire() {
    const on = (sel, ev, fn) => el.querySelectorAll(sel).forEach((x) => x.addEventListener(ev, () => fn(x)));
    on('select[data-i]', 'change', (x) => { deck[Number(x.dataset.i)].cap = Number(x.value); draw(); });
    on('[data-remove]', 'click', (x) => { deck.splice(Number(x.dataset.remove), 1); draw(); });
    on('[data-add]', 'click', (x) => {
      const line = SERIES.find((l) => l.id === x.dataset.add);
      deck.push({ series: line.id, cap: line.maxLevel });
      draw();
    });
    on('[data-loc-plus]', 'click', (x) => { deck.push({ location: x.dataset.locPlus }); draw(); });
    on('[data-loc-minus]', 'click', (x) => { deck.splice(deck.findIndex((e) => e.location === x.dataset.locMinus), 1); draw(); });
    on('[data-card-plus]', 'click', (x) => { deck.push({ card: x.dataset.cardPlus }); draw(); });
    on('[data-card-minus]', 'click', (x) => { deck.splice(deck.findIndex((e) => e.card === x.dataset.cardMinus), 1); draw(); });
    on('[data-b="premade"]', 'click', () => { deck = TEST_DECK.map((e) => ({ ...e })); draw(); });
    on('[data-b="close"]', 'click', close);
    on('[data-b="use"]', 'click', () => { ctx.onUse(deck); close(); });
  }

  draw();
  return { close };
}
