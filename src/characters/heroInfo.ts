import type { CharacterDefinition } from './CharacterDefinition';

/** Textos del arma principal y de la ulti de cada héroe, para las fichas del menú (el arma exclusiva sale de `HERO_WEAPONS`). */
export const HERO_INFO: Record<string, { main: { name: string; text: string }; ultimate: { name: string; text: string; cooldown: string } }> = {
  ironman: {
    main: { name: 'Repulsores', text: 'Disparan al enemigo más cercano.' },
    ultimate: { name: 'Vuelo', text: 'Vuela 5 s por encima de todo y dispara con más fuerza.', cooldown: '40 s' },
  },
  capitan: {
    main: { name: 'Escudo', text: 'Va y vuelve atravesando enemigos.' },
    ultimate: { name: 'Carga', text: 'Embestida invulnerable que daña y empuja a lo que toca.', cooldown: '30 s' },
  },
  spiderman: {
    main: { name: 'Telarañas', text: 'Disparo rápido que frena a los enemigos.' },
    ultimate: { name: 'Telaraña', text: 'Se engancha a un obstáculo y gira alrededor mientras sus telarañas siguen atacando.', cooldown: '25 s' },
  },
  thor: {
    main: { name: 'Martillo volador', text: 'Siempre en el aire, va de enemigo en enemigo sin parar.' },
    ultimate: { name: 'Trueno', text: '4 s de rayos continuos sobre los enemigos de la pantalla.', cooldown: '40 s' },
  },
  strange: {
    main: { name: 'Aura de runas', text: 'Daña a todo lo que entra al círculo.' },
    ultimate: { name: 'Tiempo detenido', text: 'Congela a todos 4 s y descarga el daño acumulado al soltar.', cooldown: '45 s' },
  },
  hulk: {
    main: { name: 'Zarpazo', text: 'Abanico fino cuerpo a cuerpo que crece con las mejoras.' },
    ultimate: { name: 'Aplastar', text: 'Onda enorme con mucho daño y mucho empuje.', cooldown: '42 s' },
  },
};

/** Porcentaje con signo de un multiplicador (1,5 → +50; 0,85 → −15). */
function signed(mult: number): string {
  const pct = Math.round((mult - 1) * 100);
  return `${pct >= 0 ? '+' : '−'}${Math.abs(pct)}`;
}

/** Vida y velocidad finales del héroe (con su bono propio) y el texto de ese bono, si lo tiene. */
export function heroStatLines(def: CharacterDefinition): { health: number; speed: number; bonus: string } {
  const bonus = def.statBonus ?? {};
  const parts: string[] = [];
  if (bonus.maxHealthMult) parts.push(`${signed(bonus.maxHealthMult)} % de vida`);
  if (bonus.moveSpeedMult) parts.push(`${signed(bonus.moveSpeedMult)} % de velocidad`);
  if (bonus.areaMult) parts.push(`+${Math.round((bonus.areaMult - 1) * 100)} % de área`);
  if (bonus.regenPerSecond) parts.push(`+${String(bonus.regenPerSecond).replace('.', ',')} de vida por segundo`);
  return {
    health: Math.round(def.stats.maxHealth * (bonus.maxHealthMult ?? 1)),
    speed: Math.round(def.stats.moveSpeed * (bonus.moveSpeedMult ?? 1)),
    bonus: parts.join(' · '),
  };
}
