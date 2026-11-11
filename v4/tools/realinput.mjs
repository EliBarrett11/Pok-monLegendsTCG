// C2: making the player's moves through real input in the browser checks (c1check, g2check, g3check):
// clicks on hand cards (on their visible strip), spaces, the Recognition ring, prompt buttons, the mode
// picker and the Release choice; Enter only where the interface asks for it. No debug hook: a move that
// can't be made this way throws, naming the step.
export function realInput(page, { onOpen = () => {} } = {}) {
  const spaceSel = (who, sp) => `.v4-row.${who === 'ai' ? 'opponent' : 'player'} .v4-space[data-space="${sp}"]`;
  const click = async (sel, position) => {
    if (!(await page.$(sel))) throw new Error(`no ${sel}`);
    // A locator finds the element again if the interface redraws it between finding and clicking.
    try { await page.locator(sel).first().click({ timeout: 4000, ...(position ? { position } : {}) }); } catch (e) {
      const at = await page.evaluate((q) => { const t = document.querySelector(q); if (!t) return 'gone'; const r = t.getBoundingClientRect(); const h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return `${h?.tagName}.${String(h?.className?.baseVal ?? h?.className).slice(0, 50)}`; }, sel);
      throw new Error(`${sel}: ${e.message.split('\n')[0].slice(0, 80)} (at its centre: ${at})`);
    }
    await page.waitForTimeout(40);
  };
  const confirm = async () => { await page.waitForTimeout(40); if (await page.$('[data-action="confirm-yes"]')) await click('[data-action="confirm-yes"]'); };
  // A hand card is clicked on its visible strip (the left of a fanned card), as a player would.
  const handCard = (uid) => click(`.v4-hand .v4-hcard[data-uid="${uid}"]`, { x: 18, y: 120 });
  const banner = async () => { if (await page.$('[data-action="tournament-ok"]')) await click('[data-action="tournament-ok"]'); };
  // Wait, as a player would, until it's your move and the interface takes input.
  const ready = () => page.waitForFunction(() => window.__v4.ready(), null, { timeout: 60000 });
  async function play(a) {
    await ready();
    await banner();
    const s = await page.evaluate(() => window.__v4.state);
    if (a.type === 'mulligan') { for (const u of a.cards) await click(`[data-mull="${u}"]`); return click('[data-action="mull-done"]'); }
    if (a.type === 'pass') { await click('[data-action="pass"]:not([disabled])'); return confirm(); }
    if (a.type === 'decline') return click('[data-action="decline"]');
    if (a.type === 'choose') return click(`${spaceSel(a.target.who, a.target.space)}.target`);
    if (a.type === 'react') {
      await click(`[data-react="${a.uid}"]`);
      if (await page.evaluate(() => !!window.__v4.state.reactWindow)) {
        const sp = a.target.all ? s.players[a.target.who].row.findIndex(Boolean) : a.target.space;
        await click(`${spaceSel(a.target.who, sp)}.target`);
      }
      return undefined;
    }
    if (a.type === 'attack') {
      await click(`.v4-row.player .v4-mon.can-attack[data-space="${a.from}"]`);
      return a.target.kind === 'player' ? click('.v4-ring.ai.target') : click(`${spaceSel('ai', a.target.space)}.target`);
    }
    const target = async (t) => (t.space === null || t.space === undefined ? click('.v4-board.droppable', { x: 790, y: 290 }) : click(`${spaceSel('player', t.space)}.target`));
    if (a.type === 'useItem') { await click(`[data-bag="${a.uid}"].usable`); return target(a.target); }
    if (a.type === 'buyItem' && a.from === 'mart') {
      await click('[data-buy="0"]:not([disabled])');
      if (a.then === 'store') return click('[data-action="buy-store"]');
      await click('[data-action="buy-use"]');
      return target(a.target);
    }
    if (!a.uid) throw new Error(`no input for ${a.type}`);
    await handCard(a.uid);
    if (a.type === 'summon') return click(`${spaceSel('player', a.space)}.target`);
    if (a.type === 'placeLocation') return click(`${spaceSel('player', a.start)}.target`);
    if (a.type === 'trainerCommand') return click('[data-action="tr-command"]');
    if (a.type === 'retain') { await click('[data-action="retain"]'); return confirm(); }
    if (a.type === 'buyItem') {
      if (a.then === 'store') return click('[data-action="buy-store"]');
      await click('[data-action="buy-use"]');
      return target(a.target);
    }
    if (a.type === 'command') {
      // The mode button in the prompt bar, then the target (or, for all enemies, any enemy Pokémon).
      await click(`[data-action="mode-${a.mode}"]`);
      const t = a.target;
      const sp = t.all ? s.players[t.who].row.findIndex(Boolean) : t.space;
      return click(`${spaceSel(t.who, sp)}.target`);
    }
    if (a.type === 'supporter') {
      await click('[data-action="play-supporter"]');
      if (await page.$('.v4-release .v4-cardrow.full .cd-full')) onOpen('Release choice');
      for (const u of a.release) await click(`[data-rel="${u}"]`);
      for (const u of a.pick ?? []) await click(`[data-pickd="${u}"]`);
      await click('[data-action="sup-done"]:not([disabled])');
      return confirm();
    }
    throw new Error(`no input for ${a.type}`);
  }
  // The mode picker: a Command dropped straight on a target from the hand (both modes playable).
  async function playViaPicker(a) {
    await ready();
    await banner();
    const s = await page.evaluate(() => window.__v4.state);
    await handCard(a.uid);
    const t = a.target;
    const sp = t.all ? s.players[t.who].row.findIndex(Boolean) : t.space;
    await click(`${spaceSel(t.who, sp)}.target`);
    if (await page.$('.v4-picker')) { onOpen('mode picker'); await click(`[data-pick="${a.mode}"]`); }
  }
  // C3: the Codex. Inspect what a selector names, by right-click (as a player would: on the element) or by
  // hovering it and pressing C; click a link inside the panel; Back; Esc. Returns the Codex's ref after.
  const codexRef = () => page.evaluate(() => window.__v4.codex());
  async function inspect(sel, how = 'right', position) {
    const loc = page.locator(sel).first();
    if (!(await page.$(sel))) throw new Error(`no ${sel}`);
    // A disabled button (End turn while a Pass is blocked) still gets the real right-click: Playwright's wait for
    // "enabled" is skipped there, the click itself is the same mouse input at the same point.
    if (how === 'right') await loc.click({ button: 'right', timeout: 4000, force: await loc.isDisabled().catch(() => false), ...(position ? { position } : {}) });
    else if (how === 'info') { await loc.hover({ timeout: 4000 }); await page.locator(`${sel} .v4-info`).first().click({ timeout: 4000 }); }
    else { await loc.hover({ timeout: 4000, ...(position ? { position } : {}) }); await page.keyboard.press('c'); }
    await page.waitForTimeout(60);
    return codexRef();
  }
  async function codexLink(sel = '.v4-codex .v4-cright .v4-term') {
    const loc = page.locator(sel).first();
    const id = await loc.getAttribute('data-term');
    await loc.click({ timeout: 4000 });
    await page.waitForTimeout(40);
    return { id, ref: await codexRef() };
  }
  async function codexBack() { await page.locator('.v4-codex [data-codex-back]').click({ timeout: 4000 }); await page.waitForTimeout(40); return codexRef(); }
  async function closeCodex() { await page.keyboard.press('Escape'); await page.waitForTimeout(40); return codexRef(); }
  return { play, playViaPicker, inspect, codexLink, codexBack, closeCodex, codexRef };
}
