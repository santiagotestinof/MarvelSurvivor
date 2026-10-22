/** Multiplicadores que modifican el ataque y la recolección del jugador. Las mejoras los van subiendo. */
export class PlayerStats {
  damageMult = 1;
  /** Menor = dispara más rápido. */
  cooldownMult = 1;
  rangeMult = 1;
  /** Distancia a la que las gemas empiezan a ir hacia el jugador. */
  pickupRadius = 36;
}
