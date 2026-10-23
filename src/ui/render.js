// Draws the current game state. Reads state only; never changes rules.

export function render(root, state) {
  root.innerHTML = `
    <section class="side opponent">
      <h2>${state.players.ai.name}</h2>
      <div class="zone">Opponent's field</div>
    </section>
    <section class="status">
      Turn ${state.turn} · ${state.players[state.activePlayer].name} to act
    </section>
    <section class="side player">
      <div class="zone">Your field</div>
      <h2>${state.players.player.name}</h2>
    </section>
    <section class="log">
      ${state.log.map((line) => `<p>${line}</p>`).join('')}
    </section>
  `;
}
