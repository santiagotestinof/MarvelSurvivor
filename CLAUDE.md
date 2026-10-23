# Marvel Survivors — guía para Claude Code

Juego web 2D estilo Vampire Survivors con héroes de Marvel. Lo desarrolla un equipo de 5 estudiantes de ingeniería. Idioma del equipo y de los textos del juego: **español rioplatense**.

## Reglas del proyecto
- Rama principal: **`main`**. La rama de trabajo de Santi es **`villa`**. El push a `main` o a `villa` publica el juego en GitHub Pages (`.github/workflows/deploy.yml`): https://santiagotestinof.github.io/MarvelSurvivor/
- Tiene que ser jugable en el navegador, en PC (teclado) y en celular (joystick táctil).
- Stack: TypeScript (estricto) + Phaser 3 + Vite. Arquitectura modular: datos en definiciones (`CharacterDefinition`, `EnemyKind`, `UpgradeDefinition`), lógica en `systems/`.
- No copiar arte de terceros (ni de pokesurvivor ni de Marvel). Todo el arte actual es provisional y se genera con `npm run sprites` (`tools/generate-sprites.mjs`).
- No afirmar que algo funciona si no se verificó: typecheck, build y, si se puede, correrlo en un navegador.
- Commits: autor `villantisantiago <villantisantiago29@gmail.com>`, mensajes en español.

## Comandos
- `npm run dev` · `npm run typecheck` · `npm run build` · `npm run sprites`
- Parámetros de URL para probar: `?ronda=30` (ronda corta), `?joystick` (joystick con mouse), `?debug` (cajas de colisión), `?test=1` (empieza a 1 minuto del jefe), `?todos` (desbloquea todos los héroes) y `?oro=5000` (suma oro; ojo: se suma en cada carga de esa URL).

## Estado por fase
- Fase 1 (hecha): proyecto, mapa de pruebas, Iron Man con 8 direcciones, cámara, colisiones.
- Fase 2 (hecha): menú, ronda de 5 min con oleadas de un enemigo (Dron), jefe (Overlord), vida y daño por contacto, ataque automático, joystick táctil, pantalla de resultado.
- Fase 3 (hecha): gemas de XP, niveles, elegir 1 de 3 mejoras de stats.
- Fase 4 (hecha): enemigos Explorador (rápido, frágil, desde el 15%) y Blindado (lento, resistente, gema de 4 XP, desde el 40%); arma Minimisiles (se desbloquea con una mejora, hasta 4 misiles por ráfaga, daño en área).
- Fase 5 (hecha): mejoras del repulsor (disparo múltiple, perforación, velocidad, crítico) y evolución Misiles incendiarios (misiles nv4 + "Más daño" x3; deja fuego en el piso; 4 mejoras de fuego de hasta 5 niveles). Las mejoras guardan cuántas veces se eligieron (`taken`) para los requisitos.
- Rama `testi` (integrada): pausa (botón o ESC), separación entre enemigos y colisión con obstáculos, jefe con más vida/velocidad que invoca Drones, y `?test=1` para empezar a 1 minuto del jefe.
- Fase 6 (hecha): oro y mejoras permanentes. Cajas y rocas se rompen con los disparos (el repulsor las apunta si no hay enemigos cerca) y sueltan monedas; algunos enemigos sueltan una con cierta chance. El oro se guarda en localStorage (`src/meta/saveData.ts`): si el jugador gana se guarda todo (+bono del jefe), si pierde la mitad. Tienda en el menú (`ShopScene`, cada mejora con su ícono (`src/ui/metaIcons.ts`) y la descripción al tocarla, 8 por página con paginado y REEMBOLSAR en dos pasos, `src/meta/metaUpgrades.ts`): 23 mejoras permanentes con niveles (Fuerza, Armadura, Vida, Recuperación, Enfriamiento, Área, Vel. proyectil, Duración, Cantidad, Vel. movimiento, Imán, Suerte, Crecimiento, Codicia, Maldición, Revivir, Omni, Encanto, Desarmar, Repetir, Saltear, Desterrar, Conservar). Cada nivel cuesta 1,6 veces más; valen para todos los héroes. Maldición hace la ronda más difícil (más enemigos y más fuertes, a cambio de más XP y oro).
- Mejoras pasivas en la ronda: solo se pueden tener 4 tipos distintos de mejoras no ligadas a un arma (`passive` en `upgrades.ts`, `PROGRESSION.maxPassiveTypes`), se muestran en 4 casilleros abajo a la izquierda del HUD y, con los 4 llenos, solo salen esas (para mejorarlas) y las armas; las que ya se tienen se siguen mejorando. "Reparación" no ocupa lugar. En el menú de nivel hay REPETIR / SALTEAR / DESTERRAR (teclas R/S/B) según los usos que dio la tienda.
- Fase 7 (hecha): héroes y menú. 5 héroes jugables con arma propia (`AttackKind` en `CharacterDefinition`, lógica en `AutoAttackSystem`): Iron Man (repulsor, común, inicial), Capitán América (escudo que vuelve y atraviesa, común), Spider-Man (telarañas que frenan, raro), Thor (rayos en área, épico), Hulk (onda de choque con empuje, legendario). Definiciones en `src/characters/heroDefinitions.ts` y `registry.ts`; sprites provisionales de `tools/generate-sprites.mjs` (`HEROES`). Menú con PERSONAJES (`CharacterScene`, elegir héroe; el elegido se guarda), INVOCAR (`GachaScene` + `src/meta/gacha.ts`, con una máquina de gacha que suelta una cápsula y deja caer al héroe en cada tirada: 100 de oro por tirada, x10, rarezas con pesos en `GACHA`, garantía de épico o mejor cada 10 tiradas sin uno, los repetidos devuelven oro) y MEJORAS. Algunas mejoras del ataque básico no salen según el arma (`basicKind`: sin perforación en escudo/rayo/onda, sin disparo múltiple en la onda).
- Pendiente / fuera de alcance por ahora: enemigos a distancia, habilidades únicas por héroe (además del arma), más héroes (objetivo: 10, hoy 5) y mapas.
- Verificado en el navegador (`npm run dev`, con el juego avanzado cuadro por cuadro y eventos simulados): pantalla de VICTORIA, pantalla de DERROTA, botón "Volver al menú" (desde las dos; la ronda siguiente arranca de cero) y joystick con `?joystick` (8 direcciones, diagonal a la misma velocidad, se frena al soltar, ignora la mitad derecha).
- Verificado en el navegador (Fase 7): menú, PERSONAJES, INVOCAR (x1 y x10, repetidos devuelven oro) y una partida con cada uno de los 4 héroes nuevos (sus armas matan enemigos y rompen cajas, sin errores).
- Sin verificar: balance de las armas nuevas y del precio del gacha, revivir, regeneración, armadura, Maldición/Encanto/Desarmar y el límite de 4 pasivas jugando una ronda completa; joystick en un celular real, cómo se siente en tiempo real y balance de dificultad (quieto se pierde en ~30 s; al jefe solo le pega cuando no hay drones más cerca).

## Dónde tocar qué
- Balance (oleadas, XP, duración, minimisiles, fuego, límites del repulsor): `src/config/gameplayConfig.ts`
- Mejoras: `src/progression/upgrades.ts` (cada una con su ícono en `src/ui/upgradeIcons.ts`; `isAvailable` y `describe` para mejoras con estado, como las armas) · Enemigos: `src/enemies/enemyKinds.ts` (cuándo y cuánto aparecen: `spawn`)
- Armas: `src/systems/AutoAttackSystem.ts` (repulsor) y `src/systems/MissileWeapon.ts` (minimisiles)
- Oro y progreso permanente: `src/meta/` (guardado, mejoras permanentes) · balance del oro en `GOLD`, `BREAKABLE_PROPS` y `META` de `gameplayConfig.ts`
- Interfaz: `src/ui/` (`UiButton`, `UpgradeCard`, `drawPanel` y escalas en `uiLayout.ts`)
- Héroes: `src/characters/` (registro en `registry.ts`, rarezas en `rarity.ts`; para sumar uno: definición + sprites en `HEROES` del generador + entrada en el registro; entra solo al gacha por su `rarity`) · Escenas: `src/scenes/` (Boot, Menu, Game, Hud)
- Detalles de sprites y cómo agregar animaciones o personajes: `README.md`
