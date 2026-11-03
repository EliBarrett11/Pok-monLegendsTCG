// Pokémon Legends v2 — entry point. V0: the "in development" page, in the
// approved look (docs/design/v2-board-concept.jpg). V1 replaces it with a match.
import { renderPlaceholder } from './ui/placeholder.js';

export const BUILD = 'V0 — setup';

// A fixed 1920×1080 stage, scaled to fit the window (as v1 does).
const STAGE = { width: 1920, height: 1080 };
const stage = document.getElementById('stage');
function fitStage() {
  const scale = Math.min(innerWidth / STAGE.width, innerHeight / STAGE.height);
  const x = (innerWidth - STAGE.width * scale) / 2;
  const y = (innerHeight - STAGE.height * scale) / 2;
  stage.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
}
addEventListener('resize', fitStage);
fitStage();

renderPlaceholder(document.getElementById('app'), { build: BUILD });
