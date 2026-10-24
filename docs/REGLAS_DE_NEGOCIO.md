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
| Portales (Doctor Strange) | 1 portal | +1 portal | Disparan más rápido (−22 % entre chispas) | +1 portal | +40 % de daño |
| Escudos orbitales (Capitán América) | 2 escudos | +1 escudo | Giran más rápido (+30 %) | +1 escudo | +40 % de daño, +20 % de área |
| Trampas de telaraña (Spider-Man) | 1 telaraña | +1 telaraña | +25 % de área | +30 % de duración | +1 telaraña, +50 % de daño |
| Tormenta (Thor) | 3 rayos | +1 rayo | Tormenta más seguida (−20 %) | +1 rayo | +30 % de daño, +25 % de área |
| Onda de choque (Hulk) | Base | +20 % de área | Golpea más seguido (−20 %) | +35 % de daño | +20 % de área, +30 % de empuje |

Pendiente: los Minimisiles de Iron Man (y su evolución en fuego) todavía usan el sistema anterior.

## 2. Qué significa cada estadística

- **Cadencia** (velocidad de disparo / enfriamiento): qué tan seguido pegan o disparan las armas. En Doctor Strange: la velocidad de las chispas de los portales y el ritmo del aura.
- **Duración**: cuánto tiempo dura un efecto una vez creado (por ejemplo, cuánto quedan abiertos los portales, el fuego, las telarañas). No cambia cada cuánto se crea uno nuevo.
- **Cantidad**: unidades extra de lo que lanza el arma (portales, escudos, telarañas, rayos, misiles, disparos).
- **Área**: tamaño del daño o del efecto (aura, explosiones, rayos, telarañas).

## 3. Mejoras de la ronda

- Solo se pueden tener 4 tipos de pasivas distintas por ronda (`PROGRESSION.maxPassiveTypes`).
- Pasivas que existen en la ronda: Más daño, Cadencia, Duración, Cantidad (máx. 3), Área, Velocidad, Vida máxima, Imán, Alcance (más "Reparación", que no ocupa lugar).
- **Nombres:** "Vida máxima" es la que sube la vida máxima y "Armadura" es la que reduce el daño de cada golpe (esta última hoy es solo permanente).
- Cada pasiva de la ronda debería tener su equivalente permanente en la tienda y viceversa.

## 4. Ideas aprobadas, todavía NO implementadas

- **Rareza en las mejoras de la ronda:** que no todas valgan lo mismo. Por ejemplo, Cadencia común +2 % y legendaria +15 %. La rareza se sortea al ofrecer la mejora (y la Suerte la inclina).
