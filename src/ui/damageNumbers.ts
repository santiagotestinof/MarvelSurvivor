import Phaser from 'phaser';

/** Tope de números vivos a la vez: con muchos golpes por segundo (aura, tormenta) no se llena la pantalla. */
const MAX_LIVE = 45;
const live = new WeakMap<Phaser.Scene, number>();

/** Número de daño que sube y se desvanece sobre un enemigo (`x`, `y` = justo encima de su cabeza). */
export function showDamageNumber(scene: Phaser.Scene, x: number, y: number, amount: number): void {
  const count = live.get(scene) ?? 0;
  if (count >= MAX_LIVE) return;
  live.set(scene, count + 1);

  const value = Math.max(1, Math.round(amount));
  const text = scene.add
    .text(x + Phaser.Math.Between(-4, 4), y, String(value), {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '7px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2,
    })
    .setOrigin(0.5, 1)
    .setDepth(1_000_002)
    .setResolution(2);
  scene.tweens.add({
    targets: text,
    y: y - 12,
    alpha: 0,
    duration: 550,
    ease: 'Cubic.easeOut',
    onComplete: () => {
      text.destroy();
      live.set(scene, Math.max(0, (live.get(scene) ?? 1) - 1));
    },
  });
}
