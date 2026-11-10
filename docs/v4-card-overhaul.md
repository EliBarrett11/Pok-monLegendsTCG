# v4 card visual overhaul plan

**Status:** a plan for Elliott's approval (10 November 2026).

**Aim:** cards that look like a premium digital trading card game, in the class of Legends of Runeterra, Hearthstone and Marvel Snap. They should be exciting to collect and see, clear at a glance, and make the most of the full art. The Codex comes back with it.

**Scope:** no rule, number or card changes.

**Mockup:** `docs/design/v4-cards-mockup.jpg`, with its source in `docs/design/v4-cards-mockup.html` (sizes, colours and SVG shapes).

---

## 1. What's wrong now

| # | Problem | Seen in |
|---|---|---|
| 1 | **The art is cut down to a strip.** Hand cards show the top ~half of the art and crop through heads and bodies. The best part of every illustration is thrown away. | Hand, PokéMart, pickers |
| 2 | **Flat dark boxes.** There's no frame, material or card identity, and a Command, a Supporter and a Pokémon look almost the same. | Everywhere |
| 3 | **Text is cut off mid-word** ("heal 2 t…", "1 dmg in an…"), and the full text is only in a small hover tooltip. | Hand, board |
| 4 | **Hard to read at a glance.** Stats are small numbers beside small icons. Board cards have no name. Guards and keywords are tiny marks. | Board |
| 5 | **No Codex.** It was planned for UX5, which was paused. | — |

**The art is the game's best asset.** Every piece is a full portrait illustration at the shape of a real trading card (about 5:7), and 55 of the 57 the deck uses share one consistent painted style.

---

## 2. The card design system

### 2.1 One card, four sizes

Every card is drawn by a single renderer (`v4/src/ui/card.js`) at one of four levels of detail. Everything scales from the card's width, so the cards are the same object at every size.

| Level | Width | Where | Shows |
|---|---|---|---|
| **Full** | 240–320 px | Codex, hover zoom, React window, mode picker, Release choice, Discard viewer | Everything: art, cost, Level, Type crest, keywords, name, type line, rules text or mode ladder, stat gems |
| **Mini** | 120–200 px | Hand, PokéMart, Bag | Art, cost gem, name, stat gems, one **trigger tag** (e.g. "On Summon") or Command mode chips ("ADAPT 2 · STRAT 3"). No rules text. |
| **Token** | ~150 px | A Pokémon on the board | Art (focal-point framed), name, Level, keyword chips, Held Item, Speed, stat gems, Ready/Spent/damaged state |
| **Chip** | 24–40 px | Objective trackers, log, Bag slots | A round art crop on the subject's face |

**Hover replaces the tooltip.**
- A hand card lifts out of the fan and grows to Full size above it.
- Hovering a board token shows its Full card beside it.
- Right-click or **C** opens the Codex.

### 2.2 Anatomy of a Full card

- **Full-bleed art** fills the whole card. Text sits on a soft dark gradient over the lower third only, so about two-thirds of the illustration stays completely clear.
- **The metal frame:** a bevelled rim plus an inner hairline, coloured by Type for Pokémon and moves, and by card type for everything else (2.3).
- **The cost gem** at the top-left, its shape saying what you pay:
  - a **blue crystal hexagon** for Energy;
  - a **gold coin** for PokéDollars;
  - a **red gem** for Release N on Supporters.
- **The Level ribbon** sits under the cost gem.
- **The Type crest** sits at the top-right. **Keyword chips** sit under the crest.
- **The nameplate:** a gold-edged banner with the name in Cinzel. Under it, the type line ("Fire · Special") and Speed chevrons.
- **Rules text,** centred under the plate:
  - the trigger name in gold bold, and keywords as linked terms;
  - **it shrinks to fit and is never cut off.** A test fails if any card can't fit at its smallest allowed size.
- **Stat gems** sit on the bottom corners, large, their **shape** saying the stat:
  - a **diamond** for attack (orange Physical, violet Special);
  - a **heart** for Hitpoints;
  - a **shield** for Defence;
  - a **hexagon** for Special Defence.

  Damaged Strength turns red.

**By card type:**

| Card type | What changes |
|---|---|
| **Command** (a Pokémon move) | The cost gem shows the Adapt cost. The text area becomes a **mode ladder**, one row each for React, Adapt and Strat, with its cost and effect. Modes that don't apply now are dimmed, as in UX1. |
| **Supporter** | A red Release gem. The Favour line is marked with a gold ★ and shows its +3 Recognition. |
| **Item** | A gold price coin, Held or Consumed on the type line, and its PokéMart Stock. |
| **Trainer** | Its Command, its Objective and a live progress track ending in the Partner's portrait. |
| **Location** | Its passive, lane count and duration pips, and the Weather it adds. It shows no cost element, since it's free. |

### 2.3 Colour and finish

| Frame | Rim | Crest |
|---|---|---|
| Fire Pokémon and moves | warm gold to ember red | flame |
| Water | ice blue to deep blue | drop |
| Electric | pale gold to amber | bolt |
| Rock and Normal moves (Rock Slide, Recover) | sandstone | rock, orb |
| Supporter | rose gold to crimson | person |
| Item | mint silver to teal | flask |
| Trainer and Partner | gold to royal purple | star |

**Collectable finish:**
- **Final-form Pokémon** (Rapidash, Lanturn, Luxray, Blastoise, Arcanine, Kingdra, Quagsire, Gyarados, Charizard, Magmortar) get a **holo sheen** that follows the pointer.
- **Partners and Trainers** get a full animated holo.
- **Every Full card** tilts gently in 3D under the pointer.
- **Low motion** turns the movement off but keeps the finish.

### 2.4 Board tokens

- **Name** on top and **Level** at the top-right.
- **Keyword chips** at the top-left, and the **Held Item** as a gold-rimmed coin.
- **Speed** chevrons between the two large stat gems.
- **Ready:** a pulsing gold glow. **Spent:** greyed and tilted. **Damaged:** a red Strength gem number.
- **Partners** wear the holo finish.
- **The art is framed by a per-card focal point** (section 3), so the Pokémon is always fully in view.

### 2.5 Locations on the board

The full-height tiles stay. Their art uses each Location's focal point for a landscape crop across 2–4 lanes, and the plate gets the same nameplate and gem styling as the cards.

---

## 3. Art framing

- **Per-card focal points:** a metadata file (`assets/cards/focus.json`) gives each piece of art a focal point (the subject's face or centre) and a zoom for tokens and chips. Every crop at every size is centred on it, so heads and bodies are never cut.
- **The review tool:** `v4/tools/artframe.mjs` renders every card at all four sizes onto contact sheets. Claude Code reviews them and tunes each focal point until no subject is clipped, and the sheets go in the report so Elliott can check them too.
- **Cover:** the whole deck, the PokéMart pool, Partners, Trainers and Locations (57 pieces), plus the card back.

---

## 4. The Codex (reinstated)

Section 10A of `docs/v4-ux-plan.md`, the UX5 Codex spec, is taken over unchanged, with a card-first layout:
- **The Full card,** large on the left, with its holo and tilt.
- **The details on the right:**
  - what it does now;
  - where its numbers come from (base + Level + Location + Weather + Items + effects);
  - every term a link to its glossary entry, with Back and breadcrumbs;
  - for a Pokémon, its other forms by Level as small cards, so you can see what it grows into (v2's ▲/▼ version arrows).
- **Opening it:** right-click (when no choice is in progress) or **C** on anything. It opens over the right-hand column, and the match carries on underneath.
- **Glossary:** written only from settled rules, never invented; unsettled terms are listed in the report.
- **The ? key:** a searchable Rules page and a key list.

---

## 5. Art needed from Elliott

Only two pieces. Everything else is already right.

**House style** (matching the existing 55): anime-style Pokémon-world illustration, highly detailed painterly digital art, dramatic golden-hour lighting, vibrant saturated colour, glowing magical particles and sparkles, an epic landscape behind.

**Composition for card art:**
- portrait **5:7** (at least 600×840; 1200×1680 is ideal);
- **the subject large and centred in the upper 60%**;
- the lower third calmer (it sits under the text);
- no text, logos, borders or frames.

### 5.1 Amulet Coin

The current art is in a different style (a dark interior with figures) and at a different size.

> Anime-style Pokémon-world item illustration, highly detailed painterly digital art. A large, gleaming gold Amulet Coin charm (a thick ornate gold coin engraved with a stylised cat face, hung on a braided red silk cord) floats and slowly spins in the upper centre of the image, radiating warm golden light and sparkles. Small gold coins tumble and glint around it. Background: a treasure-strewn rocky mountain ledge at golden-hour sunset, dramatic clouds, distant mountains, glowing magical particles drifting in the air. Vibrant saturated colours, cinematic lighting, sharp focus on the coin. Portrait 5:7, the coin large and centred in the upper 60%, the lower third calmer with soft rocks and glow. No text, no logos, no border, no frame, no people.

### 5.2 Charcoal

The current art is hard to read: dark coal on dark lava.

> Anime-style Pokémon-world item illustration, highly detailed painterly digital art. A single large lump of glowing Charcoal (cracked matte-black coal with bright molten orange-gold embers glowing through its cracks) floats in the upper centre of the image, wrapped in curling heat haze and a ring of rising sparks, with a soft fiery rim light separating it clearly from the background. Background: a volcanic mountainside at dusk, lava rivers far below, a warm orange-to-violet sky, glowing embers drifting in the air. Vibrant saturated colours, cinematic lighting, strong contrast between the black coal and the bright glow, sharp focus on the charcoal. Portrait 5:7, the charcoal large and centred in the upper 60%, the lower third calmer with dim rocks and glow. No text, no logos, no border, no frame, no people.

**When the art arrives:** I'll process it to the house size and trim, and push it to `assets/cards/` under the same file names.

---

## 6. Build stages

| Stage | Contents |
|---|---|
| **C1: The card renderer** | `card.js` with the four sizes, frames, gems, crests, nameplates, shrink-to-fit text, the mode ladder and trigger tags. Used everywhere a card appears: hand, board, React window, mode picker, Release choice, PokéMart, Bag, Discard and Released viewers, trackers, log. Hover zoom replaces tooltips. Tests that every card fits at every size. |
| **C2: Art framing and finish** | `focus.json` for all 57 pieces plus the card back, the `artframe` review tool and its contact sheets, holo and tilt, Partner and final-form finish, Location tile crops, Low motion. The two new pieces of art go in. |
| **C3: The Codex** | The card-first Codex (section 4), the glossary and its links, the forms view, the ? Rules page, and a final pass over every screen at all three sizes. |

Each stage follows the usual routine: tests, the layout check at three sizes (including the mid-beat mode), screenshots, a README entry and a push to `main`. I review each report before writing the next prompt.

---

## 7. Questions for Elliott

- **Q1:** approve the mockup and the design system (sections 2–4), or tell me what to change.
- **Q2:** the holo finish goes on final forms, Partners and Trainers. Should it go on more cards, fewer, or different ones?
- **Q3:** the two art prompts (section 5). Generate them whenever suits; C1 doesn't need them.
