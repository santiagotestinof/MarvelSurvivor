import type Phaser from 'phaser';

/** Combina las poses con brazos con el cuerpo inferior de la levitación original. */
export function createStrangeUltimateVisual(scene: Phaser.Scene): void {
  const key = 'strange-ultimate';
  const sourceKey = `${key}-source`;
  if (scene.textures.exists(sourceKey)) return;
  scene.textures.renameTexture(key, sourceKey);
  const arms = scene.textures.get(sourceKey).getSourceImage() as HTMLImageElement;
  const levitation = scene.textures.get('strange-walk').getSourceImage() as HTMLImageElement;
  const size = 92;
  const count = 7;
  const texture = scene.textures.createCanvas(key, size * count, size * 8);
  if (!texture) throw new Error('No se pudo crear la levitación de la ulti de Strange.');
  const context = texture.context;
  context.imageSmoothingEnabled = false;
  const bob = [0, -1, -2, -3, -2, -1, 0];
  // Unión en la cintura: conservar capa, piernas y pies de la animación de vuelo.
  const waist = 49;
  for (let direction = 0; direction < 8; direction++) {
    for (let frame = 0; frame < count; frame++) {
      const x = frame * size;
      const y = direction * size;
      const split = waist + bob[frame];
      context.drawImage(arms, 0, y, size, waist, x, y + bob[frame], size, waist);
      context.drawImage(levitation, x, y + split, size, size - split,
        x, y + split, size, size - split);
      texture.add(direction * count + frame, 0, x, y, size, size);
    }
  }
  texture.refresh();
}
