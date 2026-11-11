# AGENTS.md — PIXONA project context

Quick context for a future chat/agent. Read this first, then `README.md` (user-facing,
in Spanish) if you need the product description.

**Idioma:** UI strings, data descriptions and the README are **Spanish**. Identifiers,
filenames and this file are **English**. Keep it that way.

---

## 1. What this is

A small browser game: a *Persona*-styled turn-based battle engine plus a full-screen
main menu. Vanilla ES modules — **no build step, no framework, no dependencies, no
bundler**. It is a static site; the only reason it needs a server is ES modules + fetch,
and it is ready to publish on **GitHub Pages** as-is.

Current state: one run of five consecutive battles (hero vs. five shadows), fully
playable, with weapon/armor/accessory equipping, an item inventory, a Persona panel with
description and equipment, a stats panel, a requests log, a calendar, a theme/font-size
settings panel, encounter transitions and a Persona-style results screen.

---

## 2. Run it

`file://` will **not** work (module scripts are CORS-blocked). Always serve over HTTP.

```bash
start.bat                      # Windows: double click, opens the browser
npm start                      # same, via package.json
powershell -NoProfile -ExecutionPolicy Bypass -File .\serve.ps1 -Port 5173
python -m http.server 5173     # alternative
```

`serve.ps1` is a dependency-free `System.Net.HttpListener` server (no Node/Python
needed). It picks the next free port if 5173 is taken, sends `no-store`, blocks path
traversal (403) and serves 404s. Then open http://localhost:5173/.

Controls: `W`/`S`/`↑`/`↓` move · `Enter`/`Z` confirm · `M` main menu · `Esc` back/close.

---

## 3. File map

```
index.html                    canvas + #ui-layer (status panels, battle menu, log,
                              MENÚ chip) + #main-menu + encounter/results overlays
.nojekyll                     tells GitHub Pages not to run Jekyll
css/main.css                  all styles (~1700 lines). Sections: base, status panels,
                              battle menu, battle log, main menu, persona/request/stats/
                              calendar/system panels, entrance animations, encounter
                              transition, results screen, turn/hit feedback
data/characters.json          player base stats, player.persona, inventory, starting
                              weapon/armor/accessory and descriptions
data/enemies.json             five shadow opponents: stats, render height, EXP, money, drop
data/weapons.json             weapon list (atkBonus/defBonus/recoil — never visuals)
data/equipment.json           armor (defBonus/speedBonus/evasionBonus) and accessory
                              (evasion/speed) catalogs
data/items.json               item catalog (heal / sp)
data/requests.json            side requests: pending and completed
data/animations.json          sprite-sheet metadata: frame size, frame ids, fps
assets/hero_spritesheet.png   8 frames 48x48 (4x2): idle 0-3, attack 4-7
assets/enemy_spritesheet.png 16 frames 64x64 (4x4): idle 0-3, attack 4-7,
                              hurt 8-11, defeat 12-15. Faces LEFT natively
assets/background.png        1920x1080 battle backdrop; replace with Photoshop art
js/main.js                    bootstrap + render loop + menu wiring
js/logic/Fighter.js           HP/SP, equipment, items, damage/evasion/block
js/logic/BattleEngine.js      one-battle turn state machine, outcome callbacks
js/logic/BattleFlow.js        five-encounter run, healing, reward totals, results trigger
js/ui/UIController.js         bars, battle log, item label, turn/hit feedback
js/ui/BattleMenu.js           in-battle action buttons + keyboard
js/ui/TurnBanner.js           turn band + persistent turn chip
js/ui/MainMenu.js             full-screen menu shell: option list, focus zones,
                              keyboard/hover, row + panel helpers
js/ui/panels/                 one module per menu panel, `{ label, tall?, render(menu) }`:
                              items, persona, stats, requests, calendar, system, empty
js/ui/EncounterTransition.js  black fade + sliding next-shadow card
js/ui/ResultScreen.js         final EXP/money/loot screen + restart
js/graphics/SpriteAnimator.js frame animation (loop / hold-last-frame / playOnce) +
                              dynamic two-color alpha outline
js/graphics/BackgroundRenderer.js  image-backed battle backdrop (assets/background.png)
                              + the 1920x1080 stage transform and screen helpers
js/graphics/GroundShadow.js   ovalo de sombra por entidad (se mece y se desvanece)
js/utils/DataLoader.js        fetch JSON + load images
js/utils/dom.js               createNode/createButton helpers shared by the UI
js/utils/keys.js              navigation key map shared by both menus
serve.ps1 / start.bat         dev server / launcher
docs/*.png                    README screenshots
```

---

## 4. Architecture

### Boot (`js/main.js`)
`DOMContentLoaded` → one `Promise.all` loads 7 JSONs + 3 images → builds the shared
`catalogs` object (`{ items, weapons, equipment }`) → `new Fighter(character, catalogs)`
resolves the starting weapon/armor/accessory by id → creates `SpriteAnimator`s,
`GroundShadow`s, `UIController`, `EncounterTransition`, `ResultScreen`, `BattleFlow`
and `MainMenu` (which receives the catalogs plus callbacks) → `flow.start()` (which
calls `engine.enter()` and `engine.start()` for the first shadow) → `startRenderLoop()`.

`startRenderLoop()` is a module-level function in `js/main.js`; it owns the sway/fade
state and only reads `flow.encounter` / `flow.enemy`. It draws the background, then the
two ground shadows, then the enemy and the player. The scene uses a virtual 1920x1080
stage mapped with `cover` and anchored to the bottom. `ENTITY_LAYOUT` in `js/main.js`
places the player 530 px tall with feet at y=1004 (x=826); the enemy starts at 360 px
tall with feet at y=762 (x=1272) and grows
using each entry's `height` from `data/enemies.json`. Larger shadows shift right by half
their extra width so their left edge never overlaps the hero. Both sway a few pixels
sideways in opposite directions and their `GroundShadow` ovals follow the body; the
enemy oval fades when the shadow falls and resets for the next one. The character whose
turn it is grows 7 % (`TURN_SCALE`, 200 ms smoothing); its shadow and the enemy HP card
follow the scaled height. The enemy's HP panel is placed over its head every frame, while
the player's HP/SP panel and the action menu share the bottom-left column
(`.battle-actions`), so the two never overlap even with the largest text size.

### Battle flow (`js/logic/BattleFlow.js`)
`BattleFlow` owns the run index, totals and defeated list, and receives
`onVictory` / `onDefeat` from the engine. `start()` mounts `enemies[0]` through
`engine.enter()` and calls `engine.start()`. On victory it collects `xp`, `money` and
`drop`, then:
- for shadows 1–4: `EncounterTransition.play()` fades to black, calls `advance()` while
  covered (restores HP/SP, rebuilds the enemy `Fighter`, resets the HUD/log through
  `engine.enter()`) and starts the next battle after the card fades out;
- for shadow 5: `ResultScreen.show()` presents the complete run.

On defeat the same results screen renders the partial run with `is-defeat`. Restart
reloads the page (no save system).

### Turn machine (`js/logic/BattleEngine.js`)
States: `INIT → PLAYER_TURN → RESOLVING → ENEMY_TURN → …` ending in
`VICTORY`/`DEFEAT`. `enter(enemy)` mounts a shadow and syncs name/bars/idle animations;
`start()` logs the encounter and gives the first turn.

`executePlayerAction(action)` is `async` and early-returns unless
`state === PLAYER_TURN`. It switches to `RESOLVING` (menu disabled, `M` blocked) so the
player cannot act twice. `resolvePlayerAction(action)` returns `false` for a rejected
action (no SP, no items); the engine then restores `PLAYER_TURN` without re-announcing
the turn. An accepted action updates bars, checks end conditions, waits `TURN_PAUSE`
(250 ms) and only then enters `ENEMY_TURN`.

`processEnemyTurn()` waits `ENEMY_THINK_TIME` (850 ms), then attacks (70 %) or blocks
(30 %), checks end conditions and waits `TURN_PAUSE` before returning `PLAYER_TURN`.

`dealDamage(attacker, target, atk, verb)` starts `playOnce('attack', 600)`, waits
`ATTACK_WINDUP` (250 ms), applies damage and `ui.showHit`, animates `hurt`, writes one
log line and waits `ATTACK_RECOVERY` (350 ms). The attack frames are slowed to 8 fps
(hero) / 9 fps (enemy) in `data/animations.json`, so the impulse is readable.
`setState(PLAYER_TURN / ENEMY_TURN)` calls `ui.showTurn(...)`; `endBattle(victory)`
centralizes the final log line, the `defeat`/`idle` animation, `showTurn('over')` and the
delayed `onVictory`/`onDefeat` callback.

### Combat math (`js/logic/Fighter.js`)
Evasion roll first (`isDodging` adds +0.5) → `raw = max(1, atk - def)` → block multiplies
by `(1 - blockReduce)` → `max(1, …)` and clamp HP at 0.
Actions: ATTACK (`atk`), SKILL (15 SP, `atk * 1.5`), BLOCK, DODGE (5 SP), ITEM.
Player 100 HP / 25 ATK / 8 DEF. The five shadows live in `data/enemies.json` and scale
from 120 HP / 18 ATK / 5 DEF to 270 HP / 25 ATK / 10 DEF, each with its own XP, money,
drop and render height. `characters.json` only stores the player's `maxHp`/`maxSp`; fights
start at full health and HP/SP are restored between encounters. Base stats are recomputed
from the equipped weapon/armor/accessory objects (`recalculateStats`): the starting outfit
is 10 DEF, 20 % EVA and 15 SPD. Armor contributes `defBonus` plus optional
`speedBonus`/`evasionBonus`; accessories add EVA/SPD. `Fighter` stores the equipment
objects themselves (no id lookups afterwards); shadows fall back to neutral pieces.

Weapons may set `recoil`. After a player attack, `dealDamage` calls
`this.player.takeRecoil(recoil)` (direct HP loss, no evasion/defense/block), shows
`ui.showRecoil(...)` and logs the line. `Mandoble sangriento` is the demo high-risk
weapon (+24 ATK, -10 DEF, 14 recoil).

### Animation system
`SpriteAnimator` reads `data/animations.json`; the sheet grid is derived from
`image.width / frameWidth`. `setAnimation(name, loop)` resets the frame only when the
animation actually changes; `loop = false` freezes on the last frame (used by `defeat`).
`playOnce(name, duration)` plays without loop and schedules the return to `idle`.
`drawCentered(ctx, centerX, bottomY, height)` anchors a frame by its feet and scales it
to any height, which is how the battle resizes each shadow without touching the JSON.
`attackLunge(height)` advances the sprite 14 % of its height toward the rival on the
middle attack frames; `main.js` sets the direction with `setLungeDirection` (player +1,
enemy -1). The unused `meta.scale`, top-left `draw()`, `flipX` and `setSheet` were
removed.

The UI uses CSS keyframes with the individual `translate` property so entrance slides
compose with the existing `transform` skew/rotate: `.battle-actions` slides from the
left, menu options are staggered, panel rows stagger via `--row-index`, and the
main-menu panel/portrait/badge arrive from opposite sides. The encounter overlay and the
results screen use `is-open` / `is-closing` classes with keyframes (not transitions);
an `is-settled` fallback class forces the final visible state after the animation window.
Headless Edge can still leave late-started animations at their first frame; force them
with `document.getAnimations().forEach((animation) => animation.finish())` before taking a
screenshot. A `prefers-reduced-motion` block collapses all animation/transition
durations.

Sprites also get a runtime two-color outline: `SpriteAnimator` builds a tinted alpha
mask per frame (`source-in` on an offscreen canvas), draws one at -1 source pixel and one
at +1 source pixel, then draws the sprite. The light side is fixed white; the accent
side follows the SISTEMA accent via `setOutlineColors`. The offset is capped at 3.3
stage units so low-resolution placeholder sheets (48/64 px) do not get an enormous
border; a 160 px frame at 530 px tall uses the exact 1-pixel offset. The cache is keyed
by frame id + color and cleared when the colors change.

### Menu system (`js/ui/MainMenu.js`)
The overlay lives in `index.html`; the option list, panel rows and stat chips are built
in JS. Two focus zones: `'options'` (the big left list) and `'rows'` (the panel).
Rows are registered through `addRow(row, action, preview, container)`, which stores
`{ el, action, preview }` in one `rows` array (`preview` defaults to `action`).
`focusRow(index, preview)` syncs the highlight and the detail text; Arrow keys move
`rowIndex`; `Enter` fires the active action; clicking a row focuses it first.

The left list is `OBJETO / PERSONA / STATS / CONFIDENT / REQUEST / CALENDARIO / SISTEMA`
(the old top-level ARMA entry was removed; equipment lives inside PERSONA) and is the
`OPTIONS` array at the top of `MainMenu.js`. Each entry comes from a module in
`js/ui/panels/` shaped `{ label, tall?, render(menu) }`; `renderPanel(keepIndex)` clears
the panel, toggles `is-persona` when `tall`, and calls `option.render(this)`.
`refreshPanel(message)` re-renders, updates the chips and writes the result message after
an equip, theme, font-size or item change. Panels with no rows leave focus in `'options'`,
so Enter never traps the keyboard in an empty panel. A new panel needs one file in
`panels/` plus one entry in `OPTIONS`; the shell only provides rows, containers and
repainting.

PERSONA has a second level, all inside `js/ui/panels/persona.js`. The three slot rows set
`menu.gearCategory` (`'weapon' | 'armor' | 'accessory'`) and the panel then draws a back
row plus **every** piece in that category. `gearConfig(category)` supplies the list,
current piece, describe/stats/equip functions; `weaponStats`, `armorStats` and
`accessoryBonus` render aligned values (`ATK 49 · DEF 0 · RETRO -14`,
`DEF 6 · VEL -2 · EVA -2%`, etc.). Enter equips and keeps the list open for comparison;
Esc/← or the back row calls `closeGearCategory()` and returns focus to the matching slot.
`backToOptions()` asks `personaPanel.back(this)` first, then closes the options zone on
the next Esc. `selectOption()` clears the category when the user jumps to another main
option.

Panels are functional:
- **OBJETO** → `engine.setActiveItem()` → `onSelectItem`; the battle button label updates.
- **PERSONA** → player/persona descriptions plus ARMA / ARMADURA / ACCESORIO slots and
  the full category lists described above; armor adds DEF/EVA/SPD and accessories EVA/SPD.
- **STATS** → reads `player.persona` from `characters.json`; display-only.
- **REQUEST** → pending and completed requests from `data/requests.json`; display-only.
- **CALENDARIO** → current real month, Monday-first; past days red, today white.
- **SISTEMA** → accent color + root font size (see below); both live in `menu.settings`,
  seeded by `defaultSettings()` and applied through the callbacks.

### Turn & hit feedback
`TurnBanner` (created by `UIController`) owns the full-width band and the persistent
`#turn-chip`. `showTurn('player' | 'enemy' | 'over')` updates texts/classes; the band
auto-hides after 1400 ms. It sits at `z-index: 4` inside `#ui-layer`, below
`.battle-actions` / `.battle-log` (5) and `.enemy-status` (6), so the announcement never
covers the controls. The chip stays visible and uses `role="status"`.

`UIController.showHit(side, result)` creates a `.damage-float` over the victim's panel
(measured in the next `requestAnimationFrame`, because the enemy card position is set by
the render loop), toggles `#hit-flash` (`is-player-hit` red / `is-enemy-hit` white) and
adds `.is-shaking` to `#game-canvas`. `ESQUIVA` skips the flash/shake; `BLOQUEO` shows
the reduced damage. `prefers-reduced-motion` keeps the band/chip static and disables
shake, pulse and the float rise.

### Theme & text size
`--accent` (themeable) drives the UI; `--hp-color` is a **fixed red** used by the HP bar
and the calendar's past days so they never follow the theme. Changing the theme sets
`--accent` on `:root` and updates the accent rim of both `GroundShadow` ovals. The
battle backdrop is a fixed image, so it does not follow the accent.
Font size sets `document.documentElement.style.fontSize` (14/16/18/21 px) — every text
size must stay in `rem` for this to work; use fixed `px` only for layout boxes.
The battle HUD additionally caps its largest labels with `min(<rem>, <px>)` (menu
buttons 26px, entity names 22px, bar text 16px, log 17px) so L/XL cannot overflow the
player card; the card and command menu are stacked in `.battle-actions` instead of
being independently positioned. The main menu still scales to 21px.
Small labels (section headers, stat names, calendar weekdays, footer) are **0.8rem or
larger**; the detail panel is `clamp(400px, 32vw, 470px)` and the calendar/stat rows use
36px cells / 12px bars. Keep those minimums when editing, and test at 1440x900 and
1366x768: the portrait is hidden at `max-width: 1320px`, the panel reflows at 1100px and
the whole menu stacks at 760px.

---

## 5. Conventions

- **No dependencies, no build step.** Do not add npm packages or a bundler.
- One class per file (small helper modules like `js/utils/dom.js` may export plain
  functions), **named exports**, no default exports. Menu panels are one plain module
  each under `js/ui/panels/`.
- **Text in Spanish**, identifiers in English.
- Build DOM with `createNode` / `createButton` from `js/utils/dom.js` and set text with
  `textContent`. Never `innerHTML` with data values.
- Colors: always `var(--accent)` or `var(--hp-color)`. A literal hex red would break the
  theme. Accent-tinted shadows use `color-mix(in srgb, var(--accent) N%, transparent)`.
- Persona look: `skewX(-10deg)` on menu rows, black/white high contrast, uppercase,
  `monospace` everywhere, hard offset shadows instead of blurs.
- Data files are the source of truth for stats/balance — prefer editing JSON over code.
- **Do not add defensive fallbacks for data the JSON guarantees.** Constructors take the
  arguments they need (`MainMenu({...})` requires all callbacks) and `Fighter` starts at
  `maxHp`/`maxSp`; keep the code direct instead of sprinkling `|| {}` / `|| null`.

---

## 6. Environment gotchas (read before editing files)

**If this project is stored in a Google Drive folder**, atomic file replacement can fail:

> `SetFileSecurityW EIO (Win32 87)` when a tool writes a *new* copy over an *existing*
> file (temp-dir + rename). Creating a brand-new file works fine.

Workarounds, in order of preference:
1. Rewrite content with Python (`pathlib.Path.write_text`) or
   `[System.IO.File]::WriteAllText` — these truncate in place and work.
2. Delete the file first, then create it.
3. Append with `[System.IO.File]::AppendAllText` for the same file repeatedly.

**Node and Python are not on PATH on this machine.** Use the bundled runtimes (paths
vary per machine — call the `load_workspace_dependencies` tool to get them):

```
...\dsh-primary-runtime\dependencies\node\bin\node.exe
...\dsh-primary-runtime\dependencies\python\python.exe
```

---

## 7. How to verify a change

1. **Syntax** — `node --check <file.js>` works directly: `package.json` sets
   `"type": "module"`, so Node parses `.js` as ESM. Loop over `js/**/*.js`.
2. **Serve** — start `serve.ps1` as a background job; confirm with the job output that
   it printed the URL. If `System.Net.HttpListener` is unavailable (some sandboxes),
   use `python -m http.server 8000 --bind 127.0.0.1` instead.
3. **Screenshot** — headless Edge:
   ```powershell
   & "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" `
     --headless=new --disable-gpu --hide-scrollbars --no-first-run `
     --user-data-dir="$env:TEMP\prof" --window-size=1440,900 `
     --virtual-time-budget=2500 --screenshot="$env:TEMP\shot.png" "http://localhost:5173/"
   ```
   Use a throwaway `--user-data-dir` per run or Edge reuses the session.
4. **Interaction** — copy `index.html` to a temporary `_smoke.html` that injects a
   `<script>` clicking elements on timers (`setTimeout`), screenshot that, then **delete
   the smoke file**. It can also stub `window.fetch` to make the enemy fragile
   (deterministic victories) or give the player `evasion: 1` (deterministic dodges).
   When building the smoke file from PowerShell, read/write it as **UTF-8 explicitly**
   (`[System.Text.Encoding]::UTF8`); `Get-Content -Raw` uses the ANSI codepage and
   turns `MENÚ` into mojibake.
5. **State assertions** — `--dump-dom` prints the serialized DOM; grep it instead of
   eyeballing pixels (e.g. which `.menu-option` has `is-active`).

**Headless quirk:** CSS transitions can appear frozen mid-flight in screenshots (a
half-faded highlight looked like two active options). Late-started CSS animations can
also stay at their first frame (`getAnimations()[0].currentTime === 0`, `startTime ===
null`); check `--dump-dom` before "fixing" a visual glitch and call `animation.finish()`
in screenshot probe pages. Menu highlighting is intentionally transition-less for this
reason; only `transform` animates.

---

## 8. Known limitations / obvious next steps

- Persona stats (STR/MAG/END/AGI/LUK) are **display-only** — not wired into damage.
- The hero has no `hurt`/`defeat` animations (only the enemy does).
- No sound.
- Theme and font size reset on reload (no `localStorage`).
- One hard-coded run: five battles, no scene flow beyond the encounter fade, no save
  system. Restart reloads the page.
- Requests are static content: they have no quest state, objectives or reward payout.
- All armor/accessory pieces are available from the start (demo wardrobe, no shop).
- Encounter/result rewards are shown and added to the item inventory, but there is no
  persistent money or XP level system.
- The menu portrait is frame 0 of the hero sheet scaled 7x via CSS `background-size`
  — if the frame size changes, update `.menu-portrait` in `css/main.css`.
- The battle backdrop is a flat 1920x1080 image (`assets/background.png`); it does not
  animate and does not tint with the accent.
- The site is ready for GitHub Pages (relative paths + `.nojekyll`); see `README.md` for
  the branch-deploy steps. There is no CI workflow and no build output.

---

## 9. Changelog

| Date | Change |
|---|---|
| 2026-11-09 | Battle engine, Persona UI, battle log, battle menu |
| 2026-11-09 | Placeholder hero spritesheet + generator; on-screen battle log; dev server (`serve.ps1`, `start.bat`, `package.json`); README |
| 2026-11-09 | Enemy sprite (idle/attack/hurt/defeat), `hurt`/`defeat` animation wiring |
| 2026-11-09 | Full-screen main menu: ARMA (weapon stats), OBJETO (active item) |
| 2026-11-09 | STATS panel (Persona attributes), CALENDARIO grid, SISTEMA (accent theme + font size) |
| 2026-11-09 | Shibuya procedural battle backdrop, larger/closer hero, oval ground shadows, idle left-right sway; screens and billboards re-tint with the accent |
| 2026-11-09 | Enemy HP panel floats over the enemy, player HP/SP moves to the bottom-left; background converted to `assets/background.png`; sprite generators removed |
| 2026-11-09 | Idle sway mirrored: player and enemy move in opposite directions |
| 2026-11-09 | Code cleanup: removed defensive fallbacks, merged row bookkeeping into one array, shared damage/animation helpers, dropped dead `draw()`/`scale`, simplified the render loop; added GitHub Pages deploy docs and `.nojekyll` |
| 2026-11-09 | Typography pass: larger small labels across the HUD/log/menu, wider detail panel, bigger calendar cells and stat bars, responsive breakpoints; README screenshots refreshed |
| 2026-11-09 | Battle HUD L/XL fix: action menu and player card stacked in `.battle-actions`, battle-only font caps; player/enemy sprites enlarged (530/360 px) |
| 2026-11-09 | PERSONA panel: player + Persona descriptions and wearable ARMA/ARMADURA/ACCESORIO; REQUEST panel with pending/completed requests; armor/accessory stats wired into combat |
| 2026-11-09 | Five-shadow run: `data/enemies.json`, `BattleFlow`, HP/SP heal between fights, encounter fade/card transition, Persona-style results screen with EXP/money/loot and restart; UI entrance slide/fade animations |
| 2026-11-09 | Documentation pass: Spanish module/JSDoc comments across every JS module, named visual constants and small readability helpers (no behavior change) |
| 2026-11-09 | Runtime two-color sprite outline: cached tinted alpha masks, ±1 source-pixel offsets, theme-aware accent side, `SpriteAnimator.setSheet` for future per-monster sheets |
| 2026-11-10 | Simplification pass: equipment stored as objects in `Fighter`, shared `createNode`/`createButton` DOM helpers, `enter`/`start` split in the engine, `playOnce` moved into `SpriteAnimator`, menu selection/refresh dedup, unused sprite `flipX`/`setSheet` removed; README gains a file-communication map |
| 2026-11-10 | Turn announcements (`TurnBanner` + persistent chip), floating damage/`ESQUIVA`/`BLOQUEO`, hit flash, scene shake and attack lunge; README screenshots `docs/turn.png` and `docs/hit.png` |
| 2026-11-10 | Attack pacing: slower attack animations (8/9 fps), 250 ms wind-up, 350 ms recovery and 250 ms turn pause; `RESOLVING` state locks the menu; the character on turn scales 7 % with 200 ms smoothing; README screenshots `docs/turn.png`, `docs/enemy-turn.png` and `docs/hit.png` |
| 2026-11-10 | Gear redesign: top-level ARMA removed; PERSONA slots open full category lists with aligned stats; more weapons/armor/accessories; armor can modify EVA/SPD; `Mandoble sangriento` recoil weapon; `docs/menu.png` and `docs/persona.png` refreshed |
| 2026-11-10 | Size pass: shared navigation key map (`utils/keys.js`), one `Fighter.equip(slot, piece)` instead of three setters, merged gear stat/description helpers, single theme applier + `entityLayout` in `main.js`, `UIController`/`ResultScreen` list helpers simplified; anime.js CDN dropped (CSS keyframes only); docs screenshots recompressed (~62 % lighter) |
| 2026-11-10 | Main menu split: `MainMenu.js` keeps the shell (options, focus zones, keyboard, rows, panel swap) and one module per panel lives in `js/ui/panels/` as `{ label, tall?, render(menu) }`; SISTEMA settings moved to `menu.settings` |
