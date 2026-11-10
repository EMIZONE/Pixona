# PIXONA — arquitectura y flujo

> **Cómo usarlo:** este archivo tiene **varios** diagramas. Mermaid Live y la
> mayoría de visores aceptan **un solo diagrama por documento**, así que:
>
> 1. Abre el generador (mermaid.live, draw.io, etc.).
> 2. Borra todo lo que haya en el editor.
> 3. Copia **solo el contenido entre las vallas** de un bloque ` ```mermaid `.
>    No copies el título, la valla, ni texto como este.
> 4. Pega y listo.
>
> Si pegas el archivo completo o el título Markdown, sale
> `UnknownDiagramError: No diagram type detected`.

**Versión lista para copiar:** cada diagrama está también como archivo suelto
en [`docs/diagramas/`](diagramas/), sin vallas ni Markdown. Abre uno, `Ctrl+A`,
`Ctrl+C` y pégalo en el generador:

| Bloque | Archivo |
|---|---|
| 1. Arranque | [`01-arranque.mmd`](diagramas/01-arranque.mmd) |
| 2. Capas | [`02-capas.mmd`](diagramas/02-capas.mmd) |
| 3. Estados del combate | [`03-estados-combate.mmd`](diagramas/03-estados-combate.mmd) |
| 4. Turno | [`04-turno.mmd`](diagramas/04-turno.mmd) |
| 5. Run de sombras | [`05-run.mmd`](diagramas/05-run.mmd) |
| 6. Menú | [`06-menu.mmd`](diagramas/06-menu.mmd) |
| 7. Ciclo de la tarjeta | [`07-swap-tarjeta.mmd`](diagramas/07-swap-tarjeta.mmd) |
| 8. Archivos | [`08-archivos.mmd`](diagramas/08-archivos.mmd) |
| 9. Daño | [`09-dano.mmd`](diagramas/09-dano.mmd) |

---

## 1. Arranque y capas

```mermaid
flowchart TD
    HTML[index.html] --> CSS[css/main.css]
    HTML --> MAIN[js/main.js]

    DATA[data/*.json<br/>characters, enemies, weapons,<br/>equipment, items, requests, animations]
    IMG[assets/*.png<br/>hero, enemy, background]

    MAIN -->|Promise.all| DATA
    MAIN -->|Promise.all| IMG
    DATA --> CAT[catalogs<br/>items + weapons + equipment]
    CAT --> FIGHTER[Fighter<br/>jugador]

    MAIN --> ENGINE[BattleEngine]
    MAIN --> FLOW[BattleFlow]
    MAIN --> UI[UIController]
    MAIN --> MENU[MainMenu]
    MAIN --> TRANS[EncounterTransition]
    MAIN --> RESULT[ResultScreen]
    MAIN --> ANIM[SpriteAnimator]
    MAIN --> SHADOW[GroundShadow]
    MAIN --> BG[BackgroundRenderer]

    ENGINE --> FIGHTER
    ENGINE --> UI
    FLOW --> ENGINE
    FLOW --> TRANS
    FLOW --> RESULT
    UI --> BANNER[TurnBanner]
    MENU --> FIGHTER
    MENU --> CAT
    ANIM --> ANIMS[(animations.json)]
    MAIN --> LOOP[startRenderLoop]

    LOOP --> BG
    LOOP --> SHADOW
    LOOP --> ANIM
```

```mermaid
flowchart LR
    subgraph Logica
        F[Fighter] --> E[BattleEngine] --> FL[BattleFlow]
    end
    subgraph UI
        UI1[UIController] --> TB[TurnBanner]
        BM[BattleMenu]
        MM[MainMenu]
        ET[EncounterTransition]
        RS[ResultScreen]
    end
    subgraph Graficos
        SA[SpriteAnimator]
        GS[GroundShadow]
        BR[BackgroundRenderer]
    end
    subgraph Utilidades
        DL[DataLoader]
        DOM[dom.js]
    end
    FL --> ET
    FL --> RS
    E --> UI1
    E --> BM
    MAIN[main.js] --> Logica
    MAIN --> UI
    MAIN --> Graficos
    Logica --> Utilidades
    UI --> Utilidades
```

---

## 2. Máquina de estados del combate

```mermaid
stateDiagram-v2
    [*] --> INIT
    INIT --> PLAYER_TURN: enter enemigo + start
    PLAYER_TURN --> RESOLVING: executePlayerAction
    RESOLVING --> PLAYER_TURN: acción rechazada
    RESOLVING --> ENEMY_TURN: acción aceptada
    ENEMY_TURN --> PLAYER_TURN: ataque o bloqueo
    RESOLVING --> VICTORY: enemigo a 0 HP
    ENEMY_TURN --> DEFEAT: jugador a 0 HP
    VICTORY --> [*]
    DEFEAT --> [*]
```

---

## 3. Turno del jugador y del enemigo

```mermaid
sequenceDiagram
    actor P as Jugador
    participant BM as BattleMenu
    participant E as BattleEngine
    participant F as Fighter
    participant UI as UIController
    participant A as SpriteAnimator

    P->>BM: tecla o clic
    BM->>E: executePlayerAction
    E->>E: state = RESOLVING
    E->>F: resolvePlayerAction
    alt acción rechazada
        F-->>E: false
        E->>E: state = PLAYER_TURN
    else acción aceptada
        F-->>E: resultado
        E->>UI: updateBars + showHit
        E->>A: playOnce attack 600 ms
        E->>F: takeRecoil si el arma lo tiene
        E->>UI: updateLog
        E->>E: TURN_PAUSE 250 ms
        E->>E: state = ENEMY_TURN
        E->>E: ENEMY_THINK_TIME 850 ms
        alt enemigo ataca 70%
            E->>A: attack + hurt
            E->>F: takeDamage
        else enemigo bloquea 30%
            E->>F: setBlocking
        end
        E->>E: TURN_PAUSE 250 ms
        E->>E: state = PLAYER_TURN
    end
```

---

## 4. Run de cinco sombras

```mermaid
flowchart TD
    START[flow.start] --> E1[engine.enter enemigo 1]
    E1 --> B1[engine.start]
    B1 --> COMBATE{combate}
    COMBATE -->|derrota| DEFEAT[ResultScreen is-defeat]
    COMBATE -->|victoria| REWARD[xp, money, drop]
    REWARD --> INDEX{índice menor que 5}
    INDEX -->|sí| FADE[EncounterTransition.play]
    FADE --> HEAL[restaurar HP y SP]
    HEAL --> ADVANCE[advance: siguiente Fighter y enter]
    ADVANCE --> NEXT[tarjeta de encuentro]
    NEXT --> COMBATE
    INDEX -->|no, sombra 5| RESULT[ResultScreen completo]
    RESULT --> RESTART[reiniciar = recargar página]
    DEFEAT --> RESTART
```

---

## 5. Menú principal

```mermaid
flowchart TD
    OPEN[open] --> RENDER[renderPanel opción 0]
    RENDER --> IN[playPanelEnter<br/>tarjeta fade + slide]
    IN --> ZONE{zona}
    ZONE -->|options| NAV[Arrow arriba/abajo<br/>selectOption]
    ZONE -->|rows| ROWS[focusRow / moveRow]
    NAV --> SWAP{opción distinta}
    SWAP -->|sí| OUT[playPanelSwap<br/>is-leaving 160 ms]
    OUT --> RENDER
    SWAP -->|no| RENDER
    NAV -->|Enter / derecha| ACTIVATE[activateOption]
    ACTIVATE -->|panel con filas| ROWS
    ROWS -->|Enter| ACTION[equipar, tema, tamaño, objeto]
    ACTION --> REFRESH[refreshPanel<br/>sin animación de tarjeta]
    ROWS -->|Esc / izquierda| BACK[backToOptions]
    BACK -->|categoría abierta| CLOSE[closeGearCategory]
    BACK -->|si no| NAV
    ZONE -->|Esc en options| CLOSE_MENU[close]
```

Ciclo de la tarjeta de detalle:

```mermaid
stateDiagram-v2
    [*] --> Visible
    Visible --> Leaving: selectOption con índice distinto
    Leaving --> Rebuild: 160 ms
    Rebuild --> Entering: playPanelEnter
    Entering --> Visible: 280 ms
```

---

## 6. Jerarquía de archivos

```mermaid
flowchart TD
    ROOT[Pixona]
    ROOT --> IDX[index.html]
    ROOT --> CSS[css/main.css]
    ROOT --> JS[js]
    ROOT --> DATA[data]
    ROOT --> ASSETS[assets]
    ROOT --> DOCS[docs]
    ROOT --> SRV[serve.ps1 / start.bat / package.json]

    JS --> MAIN[main.js]
    JS --> LOGIC[logic]
    JS --> UI[ui]
    JS --> GFX[graphics]
    JS --> UTILS[utils]

    LOGIC --> L1[Fighter.js]
    LOGIC --> L2[BattleEngine.js]
    LOGIC --> L3[BattleFlow.js]

    UI --> U1[UIController.js]
    UI --> U2[BattleMenu.js]
    UI --> U3[TurnBanner.js]
    UI --> U4[MainMenu.js]
    UI --> U5[EncounterTransition.js]
    UI --> U6[ResultScreen.js]

    GFX --> G1[SpriteAnimator.js]
    GFX --> G2[BackgroundRenderer.js]
    GFX --> G3[GroundShadow.js]

    UTILS --> T1[DataLoader.js]
    UTILS --> T2[dom.js]

    DATA --> D1[characters.json]
    DATA --> D2[enemies.json]
    DATA --> D3[weapons.json]
    DATA --> D4[equipment.json]
    DATA --> D5[items.json]
    DATA --> D6[requests.json]
    DATA --> D7[animations.json]
```

---

## 7. Combate: fórmulas y responsabilidades

```mermaid
flowchart LR
    A[atacante] --> EVA{esquiva?<br/>evasion + 0.5 si DODGE}
    EVA -->|sí| MISS[0 daño]
    EVA -->|no| RAW[raw = max 1, atk - def]
    RAW --> BLOCK{bloqueo?}
    BLOCK -->|sí| RED[daño = max 1, raw * 1 - reducción]
    BLOCK -->|no| HIT[daño = raw]
    RED --> HP[HP clamp a 0]
    HIT --> HP
```

Reparto de responsabilidades:

| Capa | Archivo | Hace |
|---|---|---|
| Datos | `data/*.json` | stats, catálogos, enemigos, solicitudes |
| Combate | `js/logic/Fighter.js` | HP/SP, equipo, daño, evasión, bloqueo, ítems |
| Turnos | `js/logic/BattleEngine.js` | estados, animaciones de ataque, pausas |
| Run | `js/logic/BattleFlow.js` | 5 combates, curación, totales, resultados |
| HUD | `js/ui/UIController.js` | barras, log, daño flotante, flash |
| Menús | `js/ui/BattleMenu.js`, `js/ui/MainMenu.js` | acciones de combate y menú completo |
| Gráficos | `js/graphics/*` | sprites, contorno, fondo, sombras |
| Boot | `js/main.js` | carga, instancias, render loop 1920x1080 |

---

## 8. Texto plano (para herramientas sin Mermaid)

```text
PIXONA
├── index.html
├── css/main.css
├── data/ (characters, enemies, weapons, equipment, items, requests, animations)
├── assets/ (hero_spritesheet, enemy_spritesheet, background)
├── js/
│   ├── main.js            boot + render loop + wiring de menús
│   ├── logic/
│   │   ├── Fighter.js     stats, equipo, daño, evasión, bloqueo, ítems
│   │   ├── BattleEngine.js turnos INIT > PLAYER_TURN > RESOLVING > ENEMY_TURN
│   │   └── BattleFlow.js  5 sombras, curación, totales, resultados
│   ├── ui/
│   │   ├── UIController.js, BattleMenu.js, TurnBanner.js
│   │   ├── MainMenu.js    opciones + paneles + swap de tarjeta
│   │   ├── EncounterTransition.js, ResultScreen.js
│   ├── graphics/ (SpriteAnimator, BackgroundRenderer, GroundShadow)
│   └── utils/ (DataLoader, dom)
└── serve.ps1 · start.bat · package.json

FLUJO
DOMContentLoaded
  -> Promise.all(7 JSON + 3 imágenes)
  -> catalogs
  -> Fighter(catalogs)
  -> BattleEngine + UIController + BattleFlow + MainMenu
  -> flow.start() -> engine.enter(0) -> engine.start()
  -> requestAnimationFrame loop

COMBATE
PLAYER_TURN
  -> acción aceptada -> RESOLVING -> daño/animación/pausa
  -> ENEMY_TURN -> pensar 850 ms -> atacar o bloquear
  -> PLAYER_TURN
  -> VICTORY o DEFEAT

RUN
victoria 1..4 -> fade -> curar -> siguiente sombra
victoria 5    -> ResultScreen con totales
derrota       -> ResultScreen parcial

MENÚ
M abre -> renderPanel(0) -> tarjeta entra
flechas -> selectOption -> tarjeta sale 160 ms
        -> renderPanel -> tarjeta entra 280 ms
Enter -> foco en filas -> acción -> refreshPanel sin animación
Esc -> vuelve a opciones o cierra
```
