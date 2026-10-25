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
| Unibeam (Iron Man) | 1 rayo del reactor | +1 rayo | Dispara más seguido (−20 %) | El rayo dura más (+40 %) | +40 % de daño, rayo más ancho (+30 %) | +1 rayo | +30 % de daño, rayo más ancho (+20 %) |
| Portales (Doctor Strange) | 1 portal | +1 portal | Disparan más rápido (−22 % entre chispas) | +1 portal | +40 % de daño | +1 portal | +30 % de daño, disparan más rápido (−15 %) |
| Escudos orbitales (Capitán América) | 2 escudos | +1 escudo | Giran más rápido (+30 %) | +1 escudo | +40 % de daño, +20 % de área | +1 escudo | +30 % de daño, giran más rápido (+20 %) |
| Trampas de telaraña (Spider-Man) | 1 telaraña | +1 telaraña | +25 % de área | +30 % de duración | +1 telaraña, +50 % de daño | +1 telaraña | +40 % de daño, +20 % de área |
| Tormenta (Thor) | 3 rayos | +1 rayo | Tormenta más seguida (−20 %) | +1 rayo | +30 % de daño, +25 % de área | +1 rayo | +30 % de daño, más seguida (−15 %) |
| Onda de choque (Hulk) | Base | +20 % de área | Golpea más seguido (−20 %) | +35 % de daño | +20 % de área, +30 % de empuje | Golpea más seguido (−15 %) | +30 % de daño, +15 % de área |

Los Minimisiles de Iron Man son su arma principal (no tienen niveles fijos); su arma especial es el Unibeam.

## 2. Qué significa cada estadística

- **Cadencia** (velocidad de disparo / enfriamiento): qué tan seguido pegan o disparan las armas. En Doctor Strange: la velocidad de las chispas de los portales y el ritmo del aura.
- **Duración**: cuánto tiempo dura un efecto una vez creado (por ejemplo, cuánto quedan abiertos los portales, el fuego, las telarañas). No cambia cada cuánto se crea uno nuevo.
- **Cantidad** (pasiva, ocupa casillero): unidades extra de las armas **especiales** (portales, escudos orbitales, trampas, tormenta de rayos, Unibeam). No afecta al ataque principal. Solo se ofrece cuando el héroe ya tiene su arma especial.
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

## Evoluciones del arma principal

Cada héroe evoluciona su arma **principal** (el ataque básico) cuando tomó `EVOLUTION.passivePicks` (3) veces la pasiva asociada. La evolución es una mejora más que sale en el sorteo (peso alto) y se elige una sola vez.

| Héroe | Arma principal | Evolución | Pasiva requerida (x3) |
|---|---|---|---|
| Iron Man | Minimisiles (cohetes teledirigidos; reemplazaron al repulsor) | Misiles incendiarios: las explosiones dejan fuego (+ mejoras de fuego) | Cadencia |
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
- Aparece una sola vez, a los 15 minutos de la ronda de 30 (el jefe final sale al terminar). Es un Doombot gigante dorado, con mucha vida (escala con el avance y la Maldición) y 12 de daño por contacto. Un cartel avisa "¡MINI JEFE!".
- Al derrotarlo suelta mucha experiencia, 12 monedas (2 de oro cada una), una fruta y un imán.


## Dificultad progresiva
- Al inicio de la ronda los enemigos comunes (Dron, Centinela, Explorador) mueren de un solo golpe del ataque básico de cualquier héroe. Su vida crece durante la ronda (`healthRamp`) hasta llegar al final con la vida que tenían antes (un Dron ~100), así que cada vez hacen falta más golpes.
