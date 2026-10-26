# Marvel Survivors

Videojuego web 2D top-down inspirado en Vampire Survivors, ambientado en el universo Marvel.
Hecho con **TypeScript + Phaser 3 + Vite**. Corre directamente en el navegador.

**Estado: Fase 1** — escenario de pruebas e Iron Man jugable (movimiento y animaciones en 8 direcciones).

## Cómo ejecutarlo

Requiere [Node.js](https://nodejs.org) 18 o superior.

```bash
npm install      # una sola vez
npm run dev      # abre http://localhost:5173
```

Otros comandos:

| Comando | Qué hace |
| --- | --- |
| `npm run build` | Revisa tipos y genera la versión publicable en `dist/` |
| `npm run preview` | Sirve el build de `dist/` para probarlo |
| `npm run typecheck` | Solo revisa tipos de TypeScript |
| `npm run sprites` | Regenera los sprites provisionales (ver más abajo) |

Agregando `?debug` a la URL (`http://localhost:5173/?debug`) se dibujan las cajas de colisión.

## Jugar online (GitHub Pages)

El workflow `.github/workflows/deploy.yml` compila y publica el juego cada vez que se hace push a la rama `main` o `villa`.
Para activarlo, una sola vez: en GitHub → **Settings → Pages → Source: GitHub Actions**, y en **Settings → Environments → github-pages** permitir las ramas `main` y `villa`.
El juego queda en `https://santiagotestinof.github.io/MarvelSurvivor/`. Las rutas son relativas, así que funciona en cualquier hosting estático.

## Controles

- PC: `W A S D` o flechas. Ocho direcciones, velocidad constante también en diagonal.
- Celular: tocá y deslizá en la mitad izquierda de la pantalla (joystick virtual flotante).
- Iron Man dispara solo al enemigo más cercano.

Parámetros de URL para probar: `?ronda=30` (ronda de 30 segundos), `?joystick` (joystick también con mouse), `?debug` (cajas de colisión), `?test=1` (empieza a 1 minuto del jefe).

## Enemigos y armas

Enemigos de oleada (`src/enemies/enemyKinds.ts`). Cada uno declara en `spawn` desde qué punto de la ronda aparece y su peso; las oleadas eligen al azar entre los disponibles:

| Enemigo | Aparece desde | Rasgo |
| --- | --- | --- |
| Dron | el inicio | equilibrado |
| Explorador | 15% de la ronda | rápido y frágil |
| Blindado | 40% de la ronda | lento, mucha vida, pega fuerte; suelta una gema grande (4 XP) |

Para sumar un enemigo: dibujarlo en `tools/generate-sprites.mjs` (o poner su PNG) y agregar una entrada con `spawn` en `enemyKinds.ts`.

Armas:

- **Repulsor** (automático, al más cercano). Mejoras propias: Disparo múltiple (abanico, hasta 4), Perforación (atraviesa hasta 3 enemigos), Velocidad del disparo (hasta 4 veces) y Crítico (+10% por nivel, hasta 50%, doble daño; el disparo crítico se ve dorado y más grande). Límites en `BASIC_ATTACK_LIMITS`.
- **Minimisiles**, que se desbloquean con la mejora "Minimisiles". Cada vez que se vuelve a elegir suma un misil por ráfaga (hasta 4). Persiguen al enemigo y explotan con daño en área. Sus números están en `MISSILES` y la lógica en `src/systems/MissileWeapon.ts`.
- **Evolución: Misiles incendiarios.** Con los misiles al máximo y "Más daño" elegido 3 veces (`MISSILES.evolutionDamagePicks`), aparece la carta dorada de evolución (con más peso en el sorteo). Desde ahí cada explosión deja fuego en el piso (`FIRE`) y se suman 4 mejoras de fuego, hasta 5 niveles cada una: duración, daño, cadencia y tamaño.

Las mejoras de daño, cadencia y alcance afectan a todas las armas (el daño también al fuego). Todos los números están en `src/config/gameplayConfig.ts`.

## Fase 6: oro y mejoras permanentes

Las cajas y rocas del mapa se rompen con los disparos y sueltan monedas; algunos enemigos también. Al terminar la ronda el oro se guarda en el navegador (`localStorage`, por dispositivo): todo el oro juntado se guarda, se gane o se pierda (el bono del jefe es solo si se gana). En el menú, **MEJORAS** abre la tienda con 8 mejoras permanentes de hasta 5 niveles que valen para todos los héroes. Para sumar una mejora: agregar una entrada en `src/meta/metaUpgrades.ts`. Los números (oro de props, costos, bono del jefe) están en `src/config/gameplayConfig.ts`.

## Fase 3: experiencia y mejoras

Los Drones sueltan gemas de XP que se acercan al jugador (radio de imán). Al subir de nivel el juego se pausa y se eligen 1 de 3 mejoras (teclas 1/2/3 o toque). Las mejoras son solo de stats y están en `src/progression/upgrades.ts` (agregar una = sumar una entrada). La curva de XP y el balance de oleadas están en `src/config/gameplayConfig.ts`.

## Fase 2: ronda de juego

Menú principal → ronda de 15 minutos (`ROUND.durationMs` en `src/config/gameplayConfig.ts`) con oleadas de un enemigo genérico (Dron) cada vez más frecuentes → aparece un jefe genérico (Overlord) → se gana al derrotarlo. Si la vida llega a 0, derrota. En ambos casos se vuelve al menú.

## Estructura

```
src/
├── main.ts                      Punto de entrada
├── config/
│   ├── gameConfig.ts            Configuración de Phaser (pixel art, escala, física)
│   ├── cameraConfig.ts          Suavizado y zoom entero de la cámara
│   ├── controlsConfig.ts        Teclas asignadas
│   └── assetKeys.ts             Claves y rutas de recursos que no son de personajes
├── core/
│   ├── direction.ts             Las 8 direcciones y conversión vector → dirección
│   └── random.ts                Aleatorio con semilla (mapa reproducible)
├── input/
│   ├── MoveInput.ts             Interfaz de entrada de movimiento
│   └── KeyboardMoveInput.ts     Implementación por teclado
├── systems/
│   ├── MovementSystem.ts        Vector de intención → velocidad (normalizada)
│   ├── AnimationSystem.ts       Carga de spritesheets, registro de animaciones y animador
│   └── CameraRig.ts             Seguimiento suave, límites del mapa, zoom entero
├── entities/
│   └── Character.ts             Entidad base de todos los personajes
├── characters/
│   ├── CharacterDefinition.ts   "Contrato" de datos de un personaje
│   ├── registry.ts              Catálogo de personajes
│   └── ironman/                 Definición e implementación de Iron Man
├── world/
│   └── TestMap.ts               Mapa provisional con obstáculos
└── scenes/
    ├── BootScene.ts             Carga de recursos
    └── GameScene.ts             Escena de juego
public/assets/                   Sprites y tiles (PNG)
tools/generate-sprites.mjs       Generador de los sprites provisionales
```

Ideas de diseño:

- **Datos separados de lógica.** Un personaje es una `CharacterDefinition` (sprites, velocidad, caja de colisión) más una clase que hereda de `Character`. Todo el movimiento, la orientación y la animación están en la base y no se duplican.
- **Entrada desacoplada.** `MovementSystem` solo recibe un vector. Un joystick virtual para móviles es una clase nueva que implementa `MoveInput`; no hay que tocar nada más.
- **Pixel art nítido.** `pixelArt` y `roundPixels` activados, zoom de cámara siempre entero, sin escalados fraccionarios.
- **Orden de dibujo por altura** (`depth = y`), con sombra elíptica bajo cada personaje.

## Sprites: formato y cómo reemplazarlos

Cada acción de un personaje es un spritesheet PNG con **una fila por dirección** y una columna por cuadro:

| Fila | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Dirección | abajo | abajo-izq | izquierda | arriba-izq | arriba | arriba-der | derecha | abajo-der |

Iron Man usa cuadros de 32×32 con los pies en el píxel (16, 30), así no "salta" al cambiar de animación:

- `ironman-idle.png`: 4 cuadros × 8 direcciones (128×256)
- `ironman-walk.png`: 6 cuadros × 8 direcciones (192×256)

**Los sprites actuales son provisionales y originales**, generados por código con `npm run sprites` (no se usó ningún material de terceros). Para poner arte definitivo basta con reemplazar esos PNG respetando el formato; no hay que cambiar código. Si cambia el tamaño de cuadro o la cantidad de cuadros, se ajusta `ironManDefinition.ts`.

## Agregar una animación nueva (ataque, vuelo, daño, muerte...)

1. Sumar el nombre en `CharacterAction` (`CharacterDefinition.ts`).
2. Dibujar el spritesheet con el mismo formato (8 filas).
3. Declararlo en `sheets` de la definición del personaje.
4. Pedirlo desde la lógica con `animator.play('attack', direction)`.

La carga y el registro de animaciones se hacen solos a partir de `sheets`.

## Agregar un personaje

1. Crear `src/characters/<nombre>/` con su definición (y su clase si necesita comportamiento propio).
2. Registrarlo en `src/characters/registry.ts`.

## Qué está completo y qué es provisional

Completo:

- Proyecto Vite + TypeScript + Phaser 3, build de producción.
- Movimiento en 8 direcciones, velocidad constante en diagonales, conserva la orientación al detenerse.
- Spritesheets idle y walk con las 8 direcciones dibujadas por separado (no hay un sprite girado).
- Cámara con seguimiento suave y límites del mapa; mapa de 1920×1280 px.
- Colisiones con obstáculos y con los bordes del mapa.

Provisional:

- Sprites de Iron Man, enemigos, jefe, proyectil, suelo, árboles, rocas y cajas (arte generado por código).
- El mapa de pruebas.

Fase 2 incluida: menú, oleadas, jefe, vida y daño por contacto, ataque automático, joystick táctil, pantalla de resultado.

Fase 3 incluida: XP, gemas, niveles y mejoras de stats.

Incluido después: dos enemigos nuevos (Explorador y Blindado), el arma Minimisiles con su evolución (Misiles incendiarios) y mejoras del repulsor.

Fuera de alcance por ahora: enemigos a distancia, habilidades únicas por héroe, más héroes/mapas y guardado.
