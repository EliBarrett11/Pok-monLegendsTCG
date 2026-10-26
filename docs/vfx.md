# Animations & VFX — spec

The plan for the "Animations Enhanced" milestone, agreed with Elliott. The goal is Pokémon-inspired effects at the quality of a 2027 PC card game (Hearthstone, Legends of Runeterra), in the game's warm tabletop style. Gameplay rules live in `rules.md`; this file covers only how things look and move.

## 1. Principles

- **Clarity first.** Every animation must make it obvious *who did what to whom*, especially for the AI's moves. Spectacle never hides the result: the number, the target and the outcome stay readable.
- **The cards are the actors.** Pokémon are card art, so cards lunge, recoil, tilt, smoulder and dissolve, and the effects wrap around them.
- **Weight.** Impacts use **hit-stop** (a few frozen frames), a short camera shake and a bloom flash, all scaled by the damage dealt.
- **Timing budget:** an attack takes about 1–1.5 s, a Strategy Card about 2–2.5 s, and a Legendary summon about 2.5 s. The existing speed setting scales everything, and click-to-skip still jumps to the end of the current beat. Elliott will tune timings in the Gameplay Feedback milestone.
- **Reduced motion** (the OS setting) keeps meaning far fewer particles, no camera shake and no screen-wide distortion.

## 2. Technology

- **A hand-written WebGL effects layer with no libraries.** It keeps the no-build, no-dependency rule. It's one canvas over the stage, replacing the 2D particle canvas, and provides:
  - GPU particles: additive (fire, light, electricity) and alpha-blended (smoke, water, shadow).
  - Textured sprites and sprite-sheet flipbooks.
  - Ribbons and trails (beams, Flame Wheel, water jets).
  - Post-processing: bloom, and a distortion pass for heat shimmer, water refraction and shockwaves.
- **Fallback:** if WebGL isn't available, the current 2D particle effects are used, so the game always works.
- **Performance target:** 60 fps at 1920×1080 on a laptop with integrated graphics. The render loop only runs while effects are alive.
- **Effects are data.** Each animation is a timeline of beats (emitters, sprites, card motions, shake, hit-stop, distortion) declared in one place (e.g. `src/ui/vfx/library.js`), so new types and cards are added without new engine code.
- **Textures:** Elliott generates a VFX texture kit (section 8), which is processed into transparent sprites in `assets/vfx/`. Until a texture arrives, its effect uses a procedural placeholder drawn in code.

## 3. Attack animations

Each attack is chosen by the attacker's **Pokémon Type + Attack-Type**: 18 × 2 = 36 in the full game. **Physical** attacks make contact (the card charges into the target). **Special** attacks fire something across the board. Only the 8 combinations the two decks use are needed now; any other combination falls back to a generic Physical or Special animation, tinted by type.

| Type + Attack-Type | Used by | Concept |
|---|---|---|
| Fire Physical | Growlithe, Ponyta, Arcanine, Blaziken | Card catches fire and charges with a Flame Wheel trail; the impact bursts into embers |
| Fire Special | Charmander, Magmar, Houndoom | Flamethrower stream with heat shimmer that engulfs the target |
| Water Physical | Goldeen, Quagsire, Gyarados | Card surges inside a column of water (Waterfall) and crashes down in spray |
| Water Special | Horsea, Wartortle, Lapras, Pelipper, Vaporeon, Kyogre | Spiralling Hydro Pump jet; droplets bead and run down the target |
| Electric Special | Chinchou | Forked lightning bolt, a white flicker, and the target crackles |
| Fighting Physical | Mankey | Flurry of three rapid strikes with shockwave rings |
| Dark Physical | Sneasel | Melts into shadow, reappears behind the target and slashes (Feint Attack) |
| Normal Physical | Chansey | Heavy Body Slam with a dust burst |

- **Scale:** bigger hits get bigger effects, a stronger shake and longer hit-stop.
- **Trades:** a defender hitting back plays a shorter version of its own type's animation, at the same moment.
- **Effect damage from a Pokémon** (e.g. Gyarados's On Summon) reuses that Pokémon's attack animation, aimed at each target.
- **Trainer targets:** the same animation, hitting the Trainer portrait.
- **Keywords:**
  - **Infiltrator:** the attacker visibly arcs over the enemy guards.
  - **Overrun:** the leftover blast carries on through to the Trainer.
  - **Scorch:** embers cling to the target and become its Burn.
  - **Shell:** a shimmer that visibly absorbs part of the hit.

## 4. Strategy Cards

Every Strategy Card gets its own animation, a big moment. It opens the same way each time: the card rises to centre stage, flares, and dissolves into its effect.

| Card | Animation |
|---|---|
| Ember | A single glowing coal arcs over and catches on the target |
| Flame Charge | Fire spirals up around the friendly Pokémon and stays as a burning aura for the Round |
| Heat Wave | A shimmering wall of heat rolls across the whole enemy side and leaves everything smouldering |
| Fire Blast | The iconic 大-shaped five-pointed fire burst slams into the target |
| Aqua Ring | Rings of water circle the Pokémon, put out any Burn with a hiss of steam, and glisten as it heals |
| Bubble Beam | A stream of bubbles that pop on impact, fuller when Rain is 2 or more |
| Dive | A water surface ripples over the Discard Pile, and the Pokémon rises out of it into the hand |
| Surf | A full wave sweeps from Water's side across the board, crashes over the enemies, and leaves friendly cards glinting |

## 5. Status: Burn

- A burned card's edges smoulder and char, with embers rising. It grows with the Burn count: Burn 1 is a faint edge glow, Burn 4 or more is a properly burning card. The Burn number stays clearly visible.
- At Supper the fire flares as it deals its damage, then visibly dies down one step.
- **Douse:** the fire goes out in a burst of steam.
- Burned Trainers get the same treatment on their portrait.
- Built as a general status-visual system, so future statuses (Poison, Paralysis, Sleep, Freeze, Confusion) plug in.

## 6. Other animations

1. **Summon entrances by rarity:**
   - Common slams onto the board with a dust ring.
   - Rare slams in with a type-coloured flare.
   - Epic arrives with a larger flare and a light shaft.
   - Legendary gets a short cinematic: Kyogre brings a wave and a burst of rain, Blaziken an eruption.
2. **Defeat:** a Pokémon dissolves according to what defeated it (burnt to ash for Fire and Burn, washed away for Water, shattered for others), and the pieces drift to the Released Pile.
3. **Weather on the board:** Rain falls across the board, and Sun brings heat haze and light shafts. Both get stronger at each bracket (2, 4, 6, 8), so the Weather level is readable at a glance. This is ambient, low-key, and never hides cards.
4. **Defensive feedback:** Shell is shown as an absorbing shimmer on hit. Regenerate and healing show as a rising glow with the number.
5. **Trainers:** they flinch when hit; when removed, the portrait cracks and falls, and the Zone visibly dims. Supporters slide in as a Trainer portrait moment.
6. **Hover polish:** a holographic foil sheen on Epic and Legendary cards when hovered (a WebGL or CSS shader, following the cursor).
7. **End of match:** a proper victory or defeat screen with a short celebration (or a slump), match stats, and New match.

## 7. Build order

| Step | Contents |
|---|---|
| 20 | The WebGL layer (particles, sprites, trails, bloom, distortion, hit-stop, shake, data-driven timelines, 2D fallback); Burn status visuals; Fire Physical and Fire Special attacks |
| 21 | The other 6 attack animations, trades, keyword touches (Infiltrator, Overrun, Scorch, Shell), effect damage from Pokémon |
| 22 | The 8 Strategy Card animations |
| 23 | Summon entrances, defeats, healing and Regenerate, Trainers and Supporters |
| 24 | Weather on the board, foil hover, the victory and defeat screen |

Each step leaves the game playable and comes with a test. Visual quality can't be unit-tested, so tests check the wiring:
- every card in both decks resolves to an animation;
- every event type has a beat;
- durations stay within budget;
- skip and Instant speed finish every timeline;
- the fallback runs without WebGL.

## 8. VFX texture kit

Elliott generates these images. Each is processed into a transparent WebP in `assets/vfx/`. **Style:** anime battle-effect style, cel-shaded with 2–3 flat tones per colour, bold clean shapes and crisp edges, saturated colours, not photorealistic. The procedural effects should match it (chunky shapes and flat colour bands rather than soft realistic noise).

| File | Contents |
|---|---|
| `flame` | Single flame tongue |
| `fire-burst` | Fiery explosion |
| `embers` | Scattered glowing embers (cut into single sprites) |
| `smoke` | Soft smoke puff |
| `splash` | Water crown splash |
| `droplets` | Cluster of water droplets |
| `water-jet` | Spiralling horizontal water stream |
| `lightning` | Forked horizontal lightning bolt |
| `slash` | Three glowing claw slash marks |
| `shadow` | Dark shadow-smoke tendrils |
| `impact` | Star-shaped burst of light rays |
| `shockwave` | Thin glowing ring |
| `bubble` | Single glossy bubble |
| `char-edge` | Scorched, glowing card-edge frame |

**Delivered (all 14).** `assets/vfx/manifest.json` lists each texture's size and suggested blend mode (`additive` for glowing effects, `alpha` for solid ones such as water, smoke, shadow, the bubble and the char edge). `embers` and `droplets` also have `-atlas.webp` sprite sheets with one sprite per ember or droplet; their rectangles are in the manifest. Orientation: `water-jet` and `lightning` run left to right and rise slightly (about 15°), so rotate them to the attack direction. `shockwave` is a flattened ellipse, as if lying on the table, ready for ground rings.

These are drawn procedurally rather than as textures: rain, sun shafts, heat haze, the foil sheen, the Fire Blast shape (built from `flame` sprites), and dust (tinted `smoke`).
