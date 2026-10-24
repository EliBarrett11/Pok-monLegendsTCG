# Working rules for Pokémon Legends TCG

A browser version of Elliott's custom card game, played against an AI opponent. The rules live in Elliott's head, so the game is built one small feature at a time, in the order things happen in a real match.

## Tech

- Plain HTML, CSS and JavaScript modules. No build step, no bundler, no npm dependencies.
- It must run on GitHub Pages straight from the `main` branch, so every path is relative and `index.html` stays at the repo root.
- To play locally: `python3 -m http.server`, then open http://localhost:8000.

## Where code goes

| Folder | Contents |
|---|---|
| `src/engine/` | Game rules and game state. **No DOM code.** |
| `src/ai/` | The AI opponent. |
| `src/ui/` | Drawing the board and handling clicks. |
| `tests/` | Tests that check the rules, run with Node. |

The AI must play through the same engine functions as the player (e.g. `applyAction`). It never edits game state directly and never gets a shortcut the player doesn't have.

## The rulebook

- `docs/rules.md` is the rulebook. The code follows it.
- Update it whenever Elliott settles a rule.
- Keep a list of open questions at the bottom.

## Before coding a feature

- Ask Elliott about any rule that is unclear. Don't invent rules.
- If a placeholder is needed (for example, card stats before the real assets arrive), say so, and record it under the placeholders section of `docs/rules.md`.

## Finishing a feature

Every feature must:

1. Leave the game playable in the browser.
2. Come with a test in `tests/` that checks the rule (`node tests/<name>.test.js`).
3. Be committed and pushed to `main`.
4. Add an entry to the build log in `README.md`.
5. Share the link to play the current build: https://elibarrett11.github.io/Pok-monLegendsTCG/
