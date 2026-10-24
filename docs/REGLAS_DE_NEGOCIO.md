# Reglas de negocio — Marvel Survivors

Reglas de diseño que el equipo decidió y que el código tiene que respetar. Si una regla cambia, se cambia acá primero.
(Las pidió Santi; la implementación vive en `src/systems/HeroWeapons.ts` y `src/progression/upgrades.ts`.)

## 1. Niveles fijos de las armas especiales (estilo Vampire Survivors)

Cada héroe tiene un arma especial (se desbloquea eligiendo su mejora al subir de nivel) que llega hasta el **nivel 5**.

- **Nivel 1:** desbloquea el arma con sus valores base.
- **Niveles 2 a 5:** cada nivel da un bono **fijo y específico** (ver tabla). Nada más sube solo.
- **Cadencia, daño, duración, área, etc. NO aumentan por defecto al subir de nivel el arma.** Solo suben por la tabla de abajo o por las mejoras comunes (pasivas de la ronda y mejoras permanentes de la tienda), que valen para todas las armas.
- Los bonos de la tabla se suman a las mejoras comunes.
- En el código, cada arma tiene su tabla `table` (`LevelBonus`: cantidad, cadencia, daño, área, duración, giro, empuje) y sus textos `*_LEVELS` para la tarjeta de mejora.

| Arma (héroe) | Nv 1 | Nv 2 | Nv 3 | Nv 4 | Nv 5 |
|---|---|---|---|---|---|
| Unibeam (Iron Man) | 1 rayo del reactor | +1 rayo | Dispara más seguido (−20 %) | El rayo dura más (+40 %) | +40 % de daño, rayo más ancho (+30 %) |
| Portales (Doctor Strange) | 1 portal | +1 portal | Disparan más rápido (−22 % entre chispas) | +1 portal | +40 % de daño |
| Escudos orbitales (Capitán América) | 2 escudos | +1 escudo | Giran más rápido (+30 %) | +1 escudo | +40 % de daño, +20 % de área |
| Trampas de telaraña (Spider-Man) | 1 telaraña | +1 telaraña | +25 % de área | +30 % de duración | +1 telaraña, +50 % de daño |
| Tormenta (Thor) | 3 rayos | +1 rayo | Tormenta más seguida (−20 %) | +1 rayo | +30 % de daño, +25 % de área |
| Onda de choque (Hulk) | Base | +20 % de área | Golpea más seguido (−20 %) | +35 % de daño | +20 % de área, +30 % de empuje |

Los Minimisiles de Iron Man son su arma principal (no tienen niveles fijos); su arma especial es el Unibeam.

## 2. Qué significa cada estadística

- **Cadencia** (velocidad de disparo / enfriamiento): qué tan seguido pegan o disparan las armas. En Doctor Strange: la velocidad de las chispas de los portales y el ritmo del aura.
- **Duración**: cuánto tiempo dura un efecto una vez creado (por ejemplo, cuánto quedan abiertos los portales, el fuego, las telarañas). No cambia cada cuánto se crea uno nuevo.
- **Cantidad** (pasiva, ocupa casillero): unidades extra de las armas **especiales** (portales, escudos orbitales, trampas, tormenta de rayos, Unibeam). No afecta al ataque principal.
- **Disparo múltiple** (mejora del arma principal, no ocupa casillero): disparos/misiles/rayos/zarpazos extra del ataque principal. No afecta a las armas especiales.
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
- Al romper una caja o roca hay un 5 % de chance (`PROP_MAGNET_CHANCE`) de que suelte un imán. Al juntarlo, toda la experiencia que hay en el piso, en todo el mapa, va hacia el jugador (el oro no).

## Avisos de daño
- Al recibir un golpe el jugador ve una viñeta roja en los bordes de la pantalla y la cámara vibra; los dos son más fuertes cuanto más daño se recibe (`player-hurt` en `Character`, `GameScene` y `HudScene`).
- Sobre la cabeza de cada enemigo aparece un número con el daño que se le hizo (`ui/damageNumbers.ts`, hasta 45 a la vez).
