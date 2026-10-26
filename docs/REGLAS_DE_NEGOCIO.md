# Reglas de negocio — Marvel Survivors

Reglas de diseño que el equipo decidió y que el código tiene que respetar. Si una regla cambia, se cambia acá primero.
(Las pidió Santi; la implementación vive en `src/systems/HeroWeapons.ts` y `src/progression/upgrades.ts`.)

## 1. Niveles fijos de las armas especiales (estilo Vampire Survivors)

Cada héroe tiene un arma especial (se desbloquea eligiendo su mejora al subir de nivel) que llega hasta el **nivel 7**.

- **Nivel 1:** desbloquea el arma con sus valores base.
- **Niveles 2 a 7:** cada nivel da un bono **fijo y específico** (ver tabla). Nada más sube solo.
- **Cadencia, daño, duración, área, etc. NO aumentan por defecto al subir de nivel el arma.** Solo suben por la tabla de abajo o por las mejoras comunes (pasivas de la ronda y mejoras permanentes de la tienda), que valen para todas las armas.
- Los bonos de la tabla se suman a las mejoras comunes.
- En el código, cada arma tiene su tabla `table` (`LevelBonus`: cantidad, cadencia, daño, área, duración, giro, empuje) y sus textos `*_LEVELS` para la tarjeta de mejora.

| Arma (héroe) | Nv 1 | Nv 2 | Nv 3 | Nv 4 | Nv 5 | Nv 6 | Nv 7 |
|---|---|---|---|---|---|---|---|
| Minimisiles (Iron Man) | 1 misil por ráfaga (cada 1,5 s) | +1 misil | Dispara más seguido (−15 %) | Explosiones más grandes (+25 %) | +35 % de daño | +1 misil | +30 % de daño, explosiones +15 % |
| Portales (Doctor Strange) | 1 portal | +1 portal | Disparan más rápido (−22 % entre chispas) | +1 portal | +40 % de daño | +1 portal | +30 % de daño, disparan más rápido (−15 %) |
| Escudos orbitales (Capitán América) | 2 escudos | +1 escudo | Giran más rápido (+30 %) | +1 escudo | +40 % de daño, +20 % de área | +1 escudo | +30 % de daño, giran más rápido (+20 %) |
| Trampas de telaraña (Spider-Man) | 1 telaraña | +1 telaraña | +25 % de área | +30 % de duración | +1 telaraña, +50 % de daño | +1 telaraña | +40 % de daño, +20 % de área |
| Tormenta (Thor) | 3 rayos | +1 rayo | Tormenta más seguida (−20 %) | +1 rayo | +30 % de daño, +25 % de área | +1 rayo | +30 % de daño, más seguida (−15 %) |
| Onda de choque (Hulk) | Base | +20 % de área | Golpea más seguido (−20 %) | +35 % de daño | +20 % de área, +30 % de empuje | Golpea más seguido (−15 %) | +30 % de daño, +15 % de área |

El arma principal de Iron Man son los **repulsores** (disparo recto); los **Minimisiles** son su arma especial (secundaria). Los misiles se van a rediseñar más adelante (pedido de Santi).

## 2. Qué significa cada estadística

- **Cadencia** (velocidad de disparo / enfriamiento): qué tan seguido pegan o disparan las armas. En Doctor Strange: la velocidad de las chispas de los portales y el ritmo del aura.
- **Duración**: cuánto tiempo dura un efecto una vez creado (por ejemplo, cuánto quedan abiertos los portales, el fuego, las telarañas). No cambia cada cuánto se crea uno nuevo.
- **Cantidad** (pasiva, ocupa casillero): unidades extra de las armas **especiales** (portales, escudos orbitales, trampas, tormenta de rayos, minimisiles). No afecta al ataque principal. Solo se ofrece cuando el héroe ya tiene su arma especial.
- **Disparo múltiple** (mejora del arma principal, no ocupa casillero): disparos/misiles/rayos/zarpazos extra del ataque principal. No afecta a las armas especiales. Solo se ofrece si el ataque principal lo admite (no sale en el aura de Strange ni en el círculo evolucionado de Hulk).
- **Área**: tamaño del daño o del efecto (aura, explosiones, rayos, telarañas).

## 3. Mejoras de la ronda

- Solo se pueden tener 4 tipos de pasivas distintas por ronda (`PROGRESSION.maxPassiveTypes`).
- Pasivas que existen en la ronda: Más daño, Cadencia, Duración, Cantidad (máx. 3), Área, Velocidad, Vida máxima, Armadura, Imán, Alcance, Crítico, Suerte, Crecimiento, Codicia y Maldición (más "Reparación", que no ocupa lugar). Suerte/Crecimiento/Codicia/Maldición salen de las mejoras permanentes del mismo nombre y suman a lo que dé la tienda.
- **Nombres:** "Vida máxima" es la que sube la vida máxima y "Armadura" es la que reduce el daño de cada golpe (las dos existen en la ronda y en la tienda).
- Cada pasiva de la ronda debería tener su equivalente permanente en la tienda y viceversa.

## 4. Ideas aprobadas, todavía NO implementadas

(Ninguna por ahora.)

## Rareza de las mejoras pasivas (implementada)
- Cada vez que se ofrece una pasiva con valores por rareza se sortea común / rara / épica / legendaria (pesos 86/10/3/1, o sea 1 % legendaria; la Suerte al máximo deja 69 / 16 / 8 / 6 %, o sea 6 % legendaria). Los valores están en `tiers` de `src/progression/upgrades.ts`.
- Las tarjetas de mejora son solo ARMA o PASIVA (sin categorías de ataque/defensa/utilidad).
- Armadura (reduce el daño de cada golpe) y Vida máxima existen como pasivas en ronda y como mejoras permanentes.

## Arma principal con niveles fijos

El arma principal de cada héroe empieza en nivel 1 y sube hasta el **7** con una tarjeta de ARMA propia (una por héroe, `main-<héroe>` en `upgrades.ts`, tabla en `src/progression/mainWeapon.ts`). Cada nivel da un bono fijo, sin sorteo. Reemplaza a Disparo múltiple, Abanico ancho y Brazos largos; Perforación y Velocidad del disparo quedan solo para los portales de Strange.

| Héroe | Niveles 2 a 7 |
|---|---|
| Iron Man (Repulsor) | +1 disparo · atraviesa +1 · +1 disparo · +25% vel. · +1 disparo · atraviesa +1 y +25% vel. |
| Capitán (Escudo) | +1 escudo · +25% vel. · +1 escudo · +25% vel. · +1 escudo · +25% vel. |
| Spider-Man (Telarañas) | +1 telaraña · atraviesa +1 · +25% vel. · +1 telaraña · atraviesa +1 · +1 telaraña y atraviesa +1 |
| Thor (Rayos) | +1 rayo · +12% área · +1 rayo · +12% área · +1 rayo · +25% área |
| Hulk (Zarpazo) | +25% ángulo · +20% alcance · +1 zarpazo · +25% ángulo · +20% alcance · +1 zarpazo y +25% ángulo |
| Strange (Aura) | +12% radio ×5 · +25% radio |

## Evoluciones del arma principal

Cada héroe evoluciona su arma **principal** (el ataque básico) cuando tomó `EVOLUTION.passivePicks` (3) veces la pasiva asociada **y además tiene el arma principal y su arma exclusiva al nivel máximo (7)**. La evolución es una mejora más que sale en el sorteo (peso alto) y se elige una sola vez.

| Héroe | Arma principal | Evolución | Pasiva requerida (x3) |
|---|---|---|---|
| Iron Man | Repulsor (los minimisiles son su arma especial) | Misiles incendiarios: las explosiones de los minimisiles dejan fuego (+ mejoras de fuego) | Cadencia |
| Capitán América | Escudo boomerang | Escudo rebotador: se lanza a un enemigo y rebota entre ellos (5 rebotes; mejora "Más rebotes" hasta 10) | Cantidad |
| Spider-Man | Telarañas (frenan un poco, 30 % por 1,2 s) | Telaraña inmovilizadora: inmoviliza 2,5 s al que pega (el jefe solo se frena) | Duración |
| Thor | Rayos en área | Martillo sísmico: además, una onda en línea larga que rompe el piso | Alcance |
| Hulk | Zarpazo en abanico | Furia circular: el zarpazo es un círculo completo alrededor de Hulk | Más daño |
| Doctor Strange | Aura de runas | Dimensión lenta: aura 1,8 veces más grande que ralentiza a los enemigos | Área |

Valores en `EVOLUTION` de `gameplayConfig.ts`. Sin verificar el balance.

## Imán de experiencia
- Al romper una caja o roca hay un 8 % de chance (`PROP_MAGNET_CHANCE`) de que suelte un imán. Al juntarlo, toda la experiencia y todas las frutas que hay en el piso, en todo el mapa, van hacia el jugador (el oro no).

Los enemigos también pueden soltar un imán, con una chance muy baja (0,2 %, `ENEMY_MAGNET_CHANCE`).

## Frutas que curan
- Al morir, cualquier enemigo tiene un 1,5 % de chance (`FRUIT.chance`) de soltar una fruta. Al juntarla cura el 12 % de la vida máxima (mínimo 8). El imán las atrae igual que a la experiencia.

## Avisos de daño
- Al recibir un golpe el jugador ve una viñeta roja en los bordes de la pantalla y la cámara vibra; los dos son más fuertes cuanto más daño se recibe (`player-hurt` en `Character`, `GameScene` y `HudScene`).
- Sobre la cabeza de cada enemigo aparece un número con el daño que se le hizo (`ui/damageNumbers.ts`, hasta 45 a la vez).

## Oleadas especiales
- Primera al minuto 1 de la ronda y después cada 1:15 (`SPECIAL_WAVES`). Se alternan: **manada** (entre 20 y 45 enemigos del mismo tipo en un frente ancho que cruza la pantalla en línea recta, el doble de rápido que lo normal, sin perseguir: pasa por donde estaba el jugador y desaparece al salir del otro lado (los que se van no sueltan nada, pero los que matás sueltan experiencia y oro como cualquier enemigo); hace daño si te toca) y **círculo** (entre 22 y 40, todos juntos alrededor del jugador, justo fuera de pantalla). Un cartel en pantalla avisa ("¡MANADA!" / "¡TE RODEAN!"). El tipo de enemigo sale del sorteo normal según el avance de la ronda.


## Mini jefe
- Aparece una sola vez, a los 10 minutos de la ronda de 15 (el jefe final sale al terminar). Es un Doombot gigante dorado, con mucha vida (escala con el avance y la Maldición) y 12 de daño por contacto. Un cartel avisa "¡MINI JEFE!".
- Al derrotarlo suelta mucha experiencia, 12 monedas (2 de oro cada una), una fruta y un imán.


## Dificultad progresiva
- Al inicio de la ronda los enemigos comunes (Dron, Centinela, Explorador) mueren de un solo golpe del ataque básico de cualquier héroe. Su vida crece durante la ronda (`healthRamp`) hasta llegar al final con la vida que tenían antes (un Dron ~100), así que cada vez hacen falta más golpes.


## Arena del jefe
- Cuando termina el tiempo de la ronda (15 min) un fundido a negro lleva al jugador a una arena cerrada, donde solo está el jefe final (y los Drones que invoca). No vuelve al mapa: se gana al derrotar al jefe. Lo que había en el piso (experiencia y oro) se suma antes de pasar.


## Ultimates (tecla E / botón ULT)
| Héroe | Ulti | Efecto | Enfriamiento |
|---|---|---|---|
| Iron Man | Vuelo | 5 s de vuelo con misiles | 40 s |
| Doctor Strange | Tiempo detenido | 5 s: congela a todos y descarga el daño al final | 35 s |
| Capitán América | Escudos | 16 escudos en todas direcciones que atraviesan (45 de daño) | 38 s |
| Spider-Man | Red gigante | 25 de daño y casi inmóviles 4 s a todos los de la pantalla (al jefe lo frena a la mitad) | 36 s |
| Thor | Trueno | 4 s de 2 rayos cada 140 ms sobre enemigos de la pantalla (40 de daño) | 40 s |
| Hulk | Aplastar | Onda de radio 190, 110 de daño y mucho empuje | 42 s |


## Cofres y logros
- El mini jefe suelta un cofre: al juntarlo da 2 subidas de nivel gratis (se eligen 2 mejoras).
- Cada logro desbloquea una mejora pasiva; hasta cumplirlo esa pasiva no sale al subir de nivel. Las pasivas bloqueadas y sus logros: Armadura (aguantar 10 min en una ronda), Imán (juntar 300 de oro en total), Crítico (derrotar a un mini jefe), Suerte (llegar al nivel 15 en una ronda), Crecimiento (ganar una ronda), Codicia (juntar 2000 de oro en total) y Maldición (aguantar 14 min en una ronda). El progreso se guarda en el navegador junto con el oro.
- Idea aprobada para más adelante: que los logros también desbloqueen mapas nuevos.

## Aparición de enemigos según el movimiento
- Con el jugador en movimiento, el 70 % de los enemigos nuevos (`WAVES.aheadChance`) aparece fuera de la pantalla del lado hacia donde va (dentro de ±1 radián de su dirección); el resto, de cualquier lado. Quieto, aparecen de cualquier lado.
- Los enemigos de oleada que quedan lejos y fuera de la pantalla (más que la media diagonal + margen + `WAVES.relocateExtra`) reaparecen fuera de la vista, con la misma regla (hasta 6 cada 0,4 s). No se reubican la manada, el mini jefe, los congelados ni el jefe. Así parece que siempre vienen de todos lados.
