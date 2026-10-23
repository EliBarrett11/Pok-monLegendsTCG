// Pure game rules. No DOM access in this folder, so the AI and tests
// can run the same rules the player sees.

export function createGame() {
  return {
    turn: 1,
    activePlayer: 'player',
    players: {
      player: { name: 'You' },
      ai: { name: 'AI Opponent' },
    },
    log: ['Game created. Rules will be added one feature at a time.'],
  };
}
