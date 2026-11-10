# v4 card visual overhaul plan

**Status:** a plan for Elliott's approval (10 November 2026).

**Aim:** cards that look like a premium digital trading card game, in the class of Legends of Runeterra, Hearthstone and Marvel Snap. They should be exciting to collect and see, clear at a glance, and make the most of the full art. The Codex comes back with it.

**Scope:** no rule, number or card changes.

**Mockup (revised 10 November, with unique frames):** `docs/design/v4-cards-mockup.jpg`, with its source in `docs/design/v4-cards-mockup.html` (sizes, colours and SVG shapes).

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
| **Full** | 340 px | Codex, hover zoom, React window, mode picker, Release choice, Discard viewer | Everything: art, cost, Level, Type crest, keywords, name, type line, rules text or mode ladder, stat gems |
| **Mini** | 200 px | Hand, PokéMart, Bag | Art, cost gem, name, stat gems, one **trigger tag** (e.g. "On Summon") or Command mode chips ("ADAPT 2 · STRAT 3"). No rules text. |
| **Token** | 170 px | A Pokémon on the board | Art (focal-point framed), name, Level, keyword chips, Held Item, Speed, stat gems, Ready/Spent/damaged state |
| **Chip** | 24–40 px | Objective trackers, log, Bag slots | A round art crop on the subject's face |

**Hover replaces the tooltip.**
- A hand card lifts out of the fan and grows to Full size above it.
- Hovering a board token shows its Full card beside it.
- Right-click or **C** opens the Codex.

### 2.2 Frames: near-rectangles, one distinct trait each (revised 10 November, third pass)

Elliott's direction:
- the general shape stays close to a rectangle, with distinct differences like the Item eyelet and the Location scroll;
- borders are fine, not thick or clunky;
- stats sit cleanly, not in bloated blocks;
- a mature look, for experienced adult players.

**The frame:** a dark edge, a fine **brass hairline**, and a fainter inner rule 7 px inside it. Every frame is an SVG path drawn at 340×476 and scaled.

**Colour:** only small accents (the type line, the crest, and the small diamond on the panel rule). The frame itself is the same brass for every card.

| Card type | Its one silhouette trait | Cost |
|---|---|---|
| **Pokémon** | Chamfered top corners | A small dark well with a fine blue ring, top-left |
| **Command** | A shallow notch in the top edge that seats the cost | The well sits in the notch (the Adapt cost) |
| **Supporter** | A low arch along the top edge | The well with a red ring; "Release N" on the type line |
| **Item** | A punched eyelet at the top centre | The well with a gold ring ($) |
| **Trainer** | A low central peak | The well with a blue ring (its Command cost) |
| **Location** | Thin scroll rolls top and bottom | none (free) |

**Stat tabs (Pokémon):**
- Two small tabs sit flush in the bottom corners, Attack on the left and Strength on the right. The frame's hairline steps around them.
- Each tab holds one number (25 px Cinzel) and a small symbol in the stat's colour: orange claw for Physical, violet star for Special, rose heart for Hitpoints, steel shield for Defence, cyan barrier for Special Defence.
- No big enamel shapes. Damaged Strength turns red.
- Between the tabs: the Level and the Speed chevrons.

**The text panel:** the lower third darkens smoothly under the art, starting at a hairline rule with a small accent diamond in the middle. It holds the name (21 px Cinzel), the type line (spaced small caps in the accent colour) and the rules (14.5 px). Keywords form a small-caps line above the rules ("OVERRUN").

**Card types:**
- **Commands** list React, Adapt and Strat as ruled rows, each with its Energy cost at the right.
- **Supporters** have a quiet Favour box.
- **Items** show Stock as small diamonds.
- **Trainers** show the Objective as a row of dots, ending in the Partner's portrait.

**Sizes** (larger than before, so nothing is cramped):

| Size | Width |
|---|---|
| Full card (Codex, hover) | 340 px |
| Hand | 200 px (was 182) |
| Board | 170 px (was 156) |

The board layout grows to fit; the layout check at all three screen sizes decides the exact numbers.

**A note on method:** these frames are drawn in code (vector), which keeps them sharp at every size and easy to vary by type. Painted frame art, the way some studios do it, is a possible later upgrade: textured brass, engraved corners. I'd only suggest it once the layout is settled in the game, and I'd write the art prompts then.

### 2.2a Neat text, guaranteed

- **Fixed text zones:** every frame defines its zones: name ribbon, type line, rules box, mode rows, Favour box, Stock line and chips. Nothing is placed outside them, and no zone overlaps another.
- **Names:** one line, at a fixed size. A long name (Pokémon Breeder) uses one tighter letter-spacing step, never a smaller font.
- **Rules:** 14.5 px on Full cards and hidden on Mini cards. The rules for every card are written to fit their box. Where they can't, the wording on the card is shortened and the full text lives in the Codex. Text never shrinks below a readable size.
- **Chips** (keywords, tags, mode chips): one line each, stacked with fixed gaps.
- **The test:** it renders every card in the game at every size and fails on any overflow, overlap, clipped glyph or text outside its zone.

### 2.3 Finish

**Collectable finish:**
- **Final-form Pokémon** (Rapidash, Lanturn, Luxray, Blastoise, Arcanine, Kingdra, Quagsire, Gyarados, Charizard, Magmortar) get a **holo sheen** that follows the pointer.
- **Partners and Trainers** get a full animated holo.
- **Every Full card** tilts gently in 3D under the pointer.
- **Low motion** turns the movement off but keeps the finish.

### 2.4 Board tokens

Tokens use the **Pokémon unit frame** with the art filling it and the two stat bastions.
- **The name** sits in the ribbon near the base, and the **Level** at the top-left.
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

- **Q1:** approve the third-pass mockup (near-rectangular frames with one trait each, hairline brass, flush stat tabs, larger sizes) and the design system (sections 2–4), or tell me what to change.
- **Q2:** the holo finish goes on final forms, Partners and Trainers. Should it go on more cards, fewer, or different ones?
- **Q3:** the two art prompts (section 5). Generate them whenever suits; C1 doesn't need them.
