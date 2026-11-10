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
| **Full** | 240–320 px | Codex, hover zoom, React window, mode picker, Release choice, Discard viewer | Everything: art, cost, Level, Type crest, keywords, name, type line, rules text or mode ladder, stat gems |
| **Mini** | 120–200 px | Hand, PokéMart, Bag | Art, cost gem, name, stat gems, one **trigger tag** (e.g. "On Summon") or Command mode chips ("ADAPT 2 · STRAT 3"). No rules text. |
| **Token** | ~150 px | A Pokémon on the board | Art (focal-point framed), name, Level, keyword chips, Held Item, Speed, stat gems, Ready/Spent/damaged state |
| **Chip** | 24–40 px | Objective trackers, log, Bag slots | A round art crop on the subject's face |

**Hover replaces the tooltip.**
- A hand card lifts out of the fan and grows to Full size above it.
- Hovering a board token shows its Full card beside it.
- Right-click or **C** opens the Codex.

### 2.2 A unique silhouette for each card type

Following Legends of Runeterra, the frame's outline is different for each card type. Cost and stats sit in **sockets carved into the frame**, never in generic shapes (diamonds, hearts, hexagons) laid on top. Every frame is an SVG path drawn at 300×420 and scaled, so it's crisp at every size.

| Card type | Silhouette | Cost socket | Other built-in parts |
|---|---|---|---|
| **Pokémon** | An arched crown over a straight body | A round **Energy medallion** breaking the top-left of the arch, with the Level tag under it | Two **stat bastions** carved into the bottom corners: Attack on the left, Strength on the right. Speed chevrons sit between them. |
| **Command** (a Pokémon move) | A chamfered shield that narrows to a point | An Energy medallion set into the top edge (the Adapt cost) | The move's Type crest at the point. A **mode ladder** of React, Adapt and Strat rows, each with its own cost. |
| **Supporter** | A tall arched window | A red **wax seal** for Release N | A gold-edged **Favour box** with ★ and +3 Recognition |
| **Item** | A shop tag with a punched eyelet | A gold **price coin** | The PokéMart **Stock** pips and "N turns left" built into the base |
| **Trainer** | A crowned frame | An Energy medallion (its Command cost) | The **Objective track** built into the base, ending in the Partner's portrait |
| **Location** | A map scroll with rolled ends | none (free) | Lanes and Rounds on the type line, plus Weather and dominance chips |

**Stat sockets:** each socket's **enamel colour and small glyph** say which stat it is:
- **attack:** orange claw for Physical, violet burst for Special;
- **Strength:** pink heart for Hitpoints, silver shield for Defence, cyan barrier for Special Defence.

The number sits large and centred, with room for two digits. Damaged Strength turns red.

**Shared parts:**
- the **name ribbon,** a dark banner with pointed ends set into the frame;
- the **type line** under it;
- the **Type crest** (top-right; at the point on Commands);
- **keyword chips** under the crest.

### 2.2a Neat text, guaranteed

- **Fixed text zones:** every frame defines its zones: name ribbon, type line, rules box, mode rows, Favour box, Stock line and chips. Nothing is placed outside them, and no zone overlaps another.
- **Names:** one line, at a fixed size. A long name (Pokémon Breeder) uses one tighter letter-spacing step, never a smaller font.
- **Rules:** 13.5 px on Full cards and hidden on Mini cards. The rules for every card are written to fit their box. Where they can't, the wording on the card is shortened and the full text lives in the Codex. Text never shrinks below a readable size.
- **Chips** (keywords, tags, mode chips): one line each, stacked with fixed gaps.
- **The test:** it renders every card in the game at every size and fails on any overflow, overlap, clipped glyph or text outside its zone.

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

- **Q1:** approve the revised mockup (unique frames, carved sockets, neat text zones) and the design system (sections 2–4), or tell me what to change.
- **Q2:** the holo finish goes on final forms, Partners and Trainers. Should it go on more cards, fewer, or different ones?
- **Q3:** the two art prompts (section 5). Generate them whenever suits; C1 doesn't need them.
