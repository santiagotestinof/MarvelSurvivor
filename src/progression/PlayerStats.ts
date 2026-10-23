/** Multiplicadores que modifican el ataque y la recolección del jugador. Las mejoras los van subiendo. */
export class PlayerStats {
  damageMult = 1;
  /** Menor = dispara más rápido. */
  cooldownMult = 1;
  rangeMult = 1;
  /** Distancia a la que las gemas empiezan a ir hacia el jugador. */
  pickupRadius = 36;

  /** Multiplicador de la experiencia que dan las gemas. */
  xpMult = 1;
  /** Multiplicador del valor de cada moneda de oro. */
  goldMult = 1;
  /** Multiplicador de la probabilidad de que un enemigo suelte oro. */
  goldChanceMult = 1;

  /** Daño que se resta a cada golpe recibido (nunca baja de 1). */
  armor = 0;
  /** Vida que se recupera por segundo. */
  regenPerSecond = 0;
  /** Tamaño de los ataques: disparos, explosiones y fuego. */
  areaMult = 1;
  /** Duración de los efectos: misiles en el aire y fuego en el piso. */
  durationMult = 1;
  /** Disparos (y misiles) extra por ataque. */
  amountBonus = 0;
  /** Más dificultad: enemigos más rápidos, resistentes, numerosos y frecuentes. */
  curseMult = 1;
  /** Frecuencia y cantidad extra de enemigos (más enemigos, más experiencia y oro). */
  spawnMult = 1;
  /** Probabilidad (0..1) de que cada enemigo nuevo no pueda hacer daño. */
  defangChance = 0;
  /** Veces que se puede revivir en la ronda. */
  revivals = 0;
  /** Usos por ronda al subir de nivel: cambiar las opciones, saltear y desterrar una mejora. */
  rerolls = 0;
  skips = 0;
  banishes = 0;
  /** Probabilidad de que usar una de las tres anteriores no gaste el uso. */
  preserveChance = 0;

  // Ataque básico (repulsor)
  /** Disparos por ataque, abiertos en abanico hacia el mismo objetivo. */
  projectileCount = 1;
  /** Cuántos enemigos más atraviesa cada disparo antes de desaparecer. */
  pierce = 0;
  projectileSpeedMult = 1;
  /** Probabilidad (0..1) de que un disparo haga daño crítico. */
  critChance = 0;
  critMult = 2;

  // Ataque básico de Hulk (abanico)
  /** Multiplica el ángulo del abanico. */
  fanAngleMult = 1;
  /** Multiplica el alcance del abanico. */
  fanReachMult = 1;
}
