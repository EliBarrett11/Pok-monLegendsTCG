// Hot-seat (two players, one screen): shown whenever control passes to the
// other player. The board isn't drawn at all behind it, so nothing of the
// last player's hand stays on screen; the next player clicks "I'm ready".

export function renderPassScreen(root, { name, from, what = 'take over', ready }) {
  root.innerHTML = `<div class="table pass-screen">
    <div class="pass-box">
      <p class="pass-kicker">Two players, one screen</p>
      <h1>Pass to ${name}</h1>
      <p class="pass-hint">${from}, look away now. ${name}, click when you're ready to ${what}.</p>
      <button data-action="ready">I'm ready</button>
    </div>
  </div>`;
  root.querySelector('[data-action="ready"]').onclick = ready;
}
