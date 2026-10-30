import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

// Comprueba que Phaser recibe las hojas importadas completas, con transparencia.
for (const [name, width, height] of [
  ['ironman-idle.png', 92, 736],
  ['ironman-walk.png', 644, 736],
  ['ironman-menu.png', 44, 61],
]) {
  const sprite = readFileSync(new URL(`../public/assets/characters/ironman/${name}`, import.meta.url));
  const imported = readFileSync(new URL(`../character-studio/iron-man/imported/${name}`, import.meta.url));
  assert.deepEqual(sprite, imported, `${name}: el juego debe usar el diseño importado`);
  assert.equal(sprite.readUInt32BE(16), width, `${name}: ancho`);
  assert.equal(sprite.readUInt32BE(20), height, `${name}: alto`);
  assert.equal(sprite[25], 6, `${name}: debe conservar RGBA/transparencia`);
  console.log(`${name}: arte importado y dimensiones correctas (${width}×${height}).`);
}
