/** Multiplicadores que modifican el ataque y la recolección del jugador. Las mejoras los van subiendo. */
export class PlayerStats {
  damageMult = 1;
  /** Menor = dispara más rápido. */
  cooldownMult = 1;
  rangeMult = 1;
  /** Distancia a la que las gemas empiezan a ir hacia el jugador. */
  pickupRadius = 36;

  // Ataque básico (repulsor)
  /** Disparos por ataque, abiertos en abanico hacia el mismo objetivo. */
  projectileCount = 1;
  /** Cuántos enemigos más atraviesa cada disparo antes de desaparecer. */
  pierce = 0;
  projectileSpeedMult = 1;
  /** Probabilidad (0..1) de que un disparo haga daño crítico. */
  critChance = 0;
  critMult = 2;
}
