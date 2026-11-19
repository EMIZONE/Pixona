# AGENTS.md — PIXONA project context

Short version first. `README.md` (Spanish) is the product description and
`docs/arquitectura.md` the diagrams; this file only keeps the rules a future agent must
not break. History lives in `git log`, not here.

**Language:** UI strings, data descriptions and README are **Spanish**. Identifiers,
filenames and this file are **English**.

---

## 1. What this is

A *Persona*-styled turn-based battle engine plus a full-screen main menu. Vanilla ES
modules — **no build step, no framework, no dependencies, no bundler**. Static site:
it only needs a server for ES modules + fetch, and it is ready for GitHub Pages as-is.

One run of five consecutive battles (hero vs. five shadows) with gear equipping, an item
inventory, requests that close when their shadow falls, EXP/level/money tracked for the
run, encounter transitions and a results screen.

---

## 2. Run it

`file://` will **not** work (module scripts are CORS-blocked). Always serve over HTTP.

```bash
start.bat                      # Windows: double click, opens the browser
npm start                      # same, via package.json
powershell -NoProfile -ExecutionPolicy Bypass -File .\serve.ps1 -Port 5173
python -m http.server 5173     # alternative
```

Controls: `W`/`S`/`↑`/`↓` move · `Enter`/`Z` confirm · `M` main menu · `Esc` back/close.

---

## 3. File map

```
index.html                    canvas + #ui-layer (panels, battle menu, log, MENÚ chip)
                              + #main-menu + encounter/results overlays
css/main.css                  all styles (~1750 lines)
data/characters.json          player stats, persona, inventory, starting gear, money, xp
data/enemies.json             five shadows: stats, render height, EXP, money, drop
data/weapons.json             weapons (atkBonus/defBonus/recoil — never visuals)
data/equipment.json           armor (def/speed/evasion) and accessory catalogs
data/items.json               item catalog (heal / sp)
data/requests.json            requests: target shadow, numeric reward, status
data/progression.json         xp thresholds per level
data/weather.json             weather location: city, latitude, longitude, refresh minutes
data/animations.json          sprite-sheet metadata: frame size, frame ids, fps
assets/background.png         1920x1080 battle backdrop (palette PNG)
js/main.js                    bootstrap + render loop + menu wiring
js/logic/Fighter.js           HP/SP, gear, items, money/xp, damage/evasion/block
js/logic/BattleEngine.js      one-battle turn state machine, outcome callbacks
js/logic/BattleFlow.js        five-encounter run, healing, rewards, requests, results
js/logic/Progression.js       level from xp thresholds
js/logic/Requests.js          closes the requests whose target shadow falls
js/ui/MainMenu.js             menu shell: options, focus zones, keyboard, rows, panel swap
js/ui/panels/                 one module per panel: items, persona, stats, requests,
                              calendar, system, empty
js/ui/UIController.js         bars, battle log, item label, turn/hit feedback
js/ui/BattleMenu.js           in-battle action buttons + keyboard
js/ui/TurnBanner.js           turn band + persistent turn chip
js/ui/EncounterTransition.js  black fade + sliding next-shadow card
js/ui/ResultScreen.js         final EXP/level/money/loot screen + restart
js/ui/WeatherWidget.js        top-left current-weather card + 10-minute refresh loop
js/services/WeatherService.js Open-Meteo `current` query (no API key)
js/graphics/SpriteAnimator.js frame animation + two-color alpha outline
js/graphics/BackgroundRenderer.js  stage transform (1920x1080, cover, bottom-anchored)
js/graphics/GroundShadow.js   cached oval shadow texture + accent rim
js/utils/DataLoader.js        fetch JSON + load images
js/utils/dom.js               createNode/createButton
js/utils/format.js            formatMoney (es-MX thousands)
js/utils/keys.js              navigation key map shared by both menus
tests/combat.test.js          node:test suite for logic
tests/weather.test.js         node:test suite for WMO labels + weather.json
serve.ps1 / start.bat         dev server / launcher
docs/*.png, docs/*.mmd        README screenshots and diagrams
```

---

## 4. Invariants

### Scene
- Virtual stage 1920x1080, mapped with `cover` and anchored to the bottom. `ENTITY_LAYOUT`
  in `js/main.js`: player 530 px tall, feet y=1004, x=826; enemy base 360 px, feet
  y=762, x=1272, height from `data/enemies.json`; larger shadows shift right by half
  their extra height.
- The enemy HP card is positioned every frame over its head; the player card and the
  action menu share `.battle-actions` so L/XL text never overlaps. The character on turn
  grows 7 % (`TURN_SCALE`, 200 ms smoothing); the enemy shadow fades on death.
- HUD z-index order: `.battle-actions`/`.battle-log` 5, `.enemy-status` 6, hit flash 9,
  `.weather-widget` 11, `.open-menu-btn` 12, `.turn-chip`/`.damage-float`/`.guard-float`
  14, turn band 15 (topmost HUD; the modal overlays at 100+ still cover it).

### Menu
- `MainMenu.js` is only the shell. Each panel is `{ label, tall?, render(menu) }` in
  `js/ui/panels/`, listed in `OPTIONS`; `renderPanel()` calls `option.render(this)` and
  toggles `is-persona` from `tall`. A new panel = one file + one entry.
- Rows go through `addRow(row, action, preview, container)`; clicking focuses first.
  Panels with no rows leave focus in `'options'`.
- PERSONA has a second level: `menu.gearCategory` makes the panel draw the whole gear
  list; `personaPanel.back(menu)` returns to the slots.
- OBJETO marks the active item; SISTEMA owns `menu.settings` (`accent`, `fontPx`),
  persisted in `localStorage` under `pixona.settings` and re-applied at boot.

### Weather
- `WeatherWidget` fills `#weather-widget` in the top-left HUD (z 11) from Open-Meteo;
  `WeatherService` only fetches the `current` block. Coordinates and `refreshMinutes`
  live in `data/weather.json`.
- A failed fetch keeps the last reading and retries after 60 s; `online` and
  `visibilitychange` refresh early. The CSP `connect-src` must list
  `https://api.open-meteo.com`; a different provider needs that host plus
  `WeatherService` updated.
- `max-height: 680px` compacts the card and drops the wind/humidity line;
  `max-width: 760px` hides the `CLIMA ·` prefix, so it never covers ATACAR or MENÚ.

### Combat
- States `INIT → PLAYER_TURN → RESOLVING → ENEMY_TURN → …`. `RESOLVING` locks the menu
  and `M`; a rejected action restores `PLAYER_TURN` without spending the turn.
- Math: evasion first (`isDodging` +0.5) → `max(1, atk - def)` → block
  `(1 - blockReduce)` → `max(1, …)`, HP clamped at 0. Recoil is direct HP loss.
- Timings: attack wind-up 250 ms, recovery 350 ms, turn pause 250 ms, damage float
  1650 ms (the next turn banner waits for it to disappear), enemy think 850 ms,
  victory 1500 ms / defeat 1000 ms.
- Block/dodge shows a persistent `BLOQUEO`/`ESQUIVA` tag above that side's head
  (`guard-float`, anchored with `getGuardPoint` at 0.98 of the render height) and it is
  removed 2.2 s after that side's next turn starts, so it can be read past the banner.
  A blocked hit shows only the reduced damage number; a passive evasion keeps the
  one-shot `ESQUIVA`. Floats live inside `#ui-layer` so the z-15 banner covers them.
- VEL decides who opens a fight (`start()`); the faster side acts first.
- Shadows may replace their 70 % attack with a skill (`skillChance`, `skillPower` in
  `data/enemies.json`); the player's skill is the menu action (15 SP, ×1.5).
- A rejected action restores `PLAYER_TURN`; async failures go through `recover()` and
  never leave the menu disabled.
- Stats come from JSON and are recomputed by `recalculateStats()`; `Fighter` stores gear
  objects, shadows fall back to neutral pieces. Money/xp live on the player `Fighter`.
- `BattleFlow` adds money/xp/drop, closes requests whose `target` fell, logs level-ups,
  heals HP/SP between fights and passes the final level to `ResultScreen`, which shows it
  as **RANGO** (the Persona level in the stats panel is separate).

### Visuals
- Fonts: `--font-display` is Silkscreen (pixel headings), `--font-ui` is Pixelify Sans
  (everything else); both come from Google Fonts. The CSP allows those hosts plus
  `api.open-meteo.com` for the weather fetch.
- `SpriteAnimator` derives the grid from `image.width / frameWidth`; `playOnce` returns
  to `idle`; the two-color outline is cached per frame + color, offset capped at 3.3
  stage units. Hero lunges +1, enemy -1.
- `GroundShadow` paints its gradient once into a small canvas; only the accent rim is
  stroked per frame.
- Colors: `var(--accent)` (themeable) or `var(--hp-color)` (fixed red). Never literal hex
  red. Accent tints use `color-mix(in srgb, var(--accent) N%, transparent)`.
- Font size sets root `font-size` (14/16/18/21 px): all text in `rem`, fixed `px` only
  for layout boxes. Battle HUD caps its largest labels with `min(<rem>, <px>)` (menu 26,
  names 22, bars 16, log 17). Small labels stay ≥ 0.8rem.
- Entrance animations use CSS keyframes on the individual `translate` property so they
  compose with `transform` skew. Overlays use `is-open`/`is-closing` + `is-settled`
  fallback. A `prefers-reduced-motion` block collapses all durations.
- Closed overlays are `aria-hidden` + `inert`; the results card keeps Tab on its restart
  button.

---

## 5. Conventions

- **No dependencies, no build step.** Do not add npm packages or a bundler.
- One class per file (plain-function modules: `js/utils/`, `js/ui/panels/`), **named
  exports**, no default exports.
- Text in Spanish, identifiers in English.
- DOM through `createNode`/`createButton` + `textContent`; never `innerHTML` with data.
- Data files are the source of truth for stats/balance — edit JSON before code.
- **No defensive fallbacks for data the JSON guarantees.** Constructors take what they
  need; keep the code direct instead of `|| {}` / `|| null`.

---

## 6. Environment gotchas

**Google Drive folders** can fail atomic replacement:

> `SetFileSecurityW EIO (Win32 87)` when a tool writes a *new* copy over an existing file.

Workarounds: rewrite with Python `pathlib.Path.write_text` or
`[System.IO.File]::WriteAllText` (truncate in place), or delete then create.

**Node and Python are not on PATH.** Use the bundled runtimes from the
`load_workspace_dependencies` tool (`.../dependencies/node/bin/node.exe`,
`.../dependencies/python/python.exe`).

---

## 7. How to verify

1. **Tests** — `node --test` (or `npm test`). Add `node --check` per file when in doubt.
   In sandboxed shells the runner cannot spawn children; run
   `node tests/combat.test.js` directly instead.
2. **Syntax** — `node --check <file.js>` works directly (ESM via `"type": "module"`).
3. **Serve** — `serve.ps1` as a background job; if `System.Net.HttpListener` is
   unavailable, `python -m http.server 8000 --bind 127.0.0.1`.
4. **Screenshot** — headless Edge (throwaway `--user-data-dir`):
   ```powershell
   & "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" `
     --headless=new --disable-gpu --hide-scrollbars --no-first-run `
     --user-data-dir="$env:TEMP\prof" --window-size=1440,900 `
     --virtual-time-budget=2500 --screenshot="$env:TEMP\shot.png" "http://localhost:5173/"
   ```
5. **Interaction** — copy `index.html` to `_smoke.html`, inject a script that clicks on
   timers, screenshot, then delete it. Build it as **UTF-8** explicitly (`MENÚ` turns to
   mojibake under the ANSI codepage).
6. **State** — `--dump-dom` and grep classes (e.g. which `.menu-option` is `is-active`).

Headless quirk: late animations can stay on frame 0; call
`document.getAnimations().forEach((a) => a.finish())` in probe pages before capturing.
Menu highlighting is transition-less on purpose.

---

## 8. Known limitations

- Persona stats (STR/MAG/END/AGI/LUK) are display-only.
- The hero has no `hurt`/`defeat` animation (only the enemy does). **Art pending.**
- No sound.
- One hard-coded run; no save. Restart reloads the page. Only theme/font persist.
- Money/EXP/level are shown but there is no shop or cross-reload progression.
- Requests have one completion step (`target` shadow) and no follow-up phases.
- All gear is available from the start.
- The weather uses the fixed coordinate from `data/weather.json`; it does not ask for
  geolocation. Changing the city is a JSON edit.
- The menu portrait is a separate `assets/hero_portrait.png`: a 4-frame idle strip
  (105x150 each) in high-contrast black-and-white with a 1 px white outline, scaled 5x
  in CSS and clipped by the right screen edge. Regenerate it if the hero art changes.
- The backdrop is a flat image; it does not animate or tint with the accent.
- Ready for GitHub Pages (relative paths + `.nojekyll`); no CI.
- Fonts load from Google Fonts (the CSP allows them); offline falls back to system
  fonts. Self-hosting needs the woff2/ttf files under `assets/fonts/`.
- Line endings are normalized by `.gitattributes` (`eol=lf`, CRLF for `.bat`/`.ps1`);
  after touching many files run `git add --renormalize .` before committing.
