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
- Parámetros de URL para probar: `?ronda=30` (ronda corta), `?joystick` (joystick con mouse), `?debug` (cajas de colisión).

## Estado por fase
- Fase 1 (hecha): proyecto, mapa de pruebas, Iron Man con 8 direcciones, cámara, colisiones.
- Fase 2 (hecha): menú, ronda de 5 min con oleadas de un enemigo (Dron), jefe (Overlord), vida y daño por contacto, ataque automático, joystick táctil, pantalla de resultado.
- Fase 3 (hecha): gemas de XP, niveles, elegir 1 de 3 mejoras de stats.
- Fase 4 (hecha): enemigos Explorador (rápido, frágil, desde el 15%) y Blindado (lento, resistente, gema de 4 XP, desde el 40%); arma Minimisiles (se desbloquea con una mejora, hasta 4 misiles por ráfaga, daño en área).
- Fase 5 (hecha): mejoras del repulsor (disparo múltiple, perforación, velocidad, crítico) y evolución Misiles incendiarios (misiles nv4 + "Más daño" x3; deja fuego en el piso; 4 mejoras de fuego de hasta 5 niveles). Las mejoras guardan cuántas veces se eligieron (`taken`) para los requisitos.
- Pendiente / fuera de alcance por ahora: enemigos a distancia, habilidades únicas por héroe, gacha, más héroes (objetivo: 10) y mapas, guardado de progreso.
- Verificado en el navegador (`npm run dev`, con el juego avanzado cuadro por cuadro y eventos simulados): pantalla de VICTORIA, pantalla de DERROTA, botón "Volver al menú" (desde las dos; la ronda siguiente arranca de cero) y joystick con `?joystick` (8 direcciones, diagonal a la misma velocidad, se frena al soltar, ignora la mitad derecha).
- Sin verificar: joystick en un celular real, cómo se siente en tiempo real y balance de dificultad (quieto se pierde en ~30 s; al jefe solo le pega cuando no hay drones más cerca).

## Dónde tocar qué
- Balance (oleadas, XP, duración, minimisiles, fuego, límites del repulsor): `src/config/gameplayConfig.ts`
- Mejoras: `src/progression/upgrades.ts` (cada una con su ícono en `src/ui/upgradeIcons.ts`; `isAvailable` y `describe` para mejoras con estado, como las armas) · Enemigos: `src/enemies/enemyKinds.ts` (cuándo y cuánto aparecen: `spawn`)
- Armas: `src/systems/AutoAttackSystem.ts` (repulsor) y `src/systems/MissileWeapon.ts` (minimisiles)
- Interfaz: `src/ui/` (`UiButton`, `UpgradeCard`, `drawPanel` y escalas en `uiLayout.ts`)
- Héroes: `src/characters/` (registro en `registry.ts`) · Escenas: `src/scenes/` (Boot, Menu, Game, Hud)
- Detalles de sprites y cómo agregar animaciones o personajes: `README.md`
