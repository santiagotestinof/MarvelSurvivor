import Phaser from 'phaser';
import { CAMERA_CONFIG, computeRoundZoom } from '../config/cameraConfig';

/** Cámara que sigue suavemente a un objetivo, queda dentro de los límites del mapa y usa zoom en pasos de 0,25. */
export class CameraRig {
  private readonly camera: Phaser.Cameras.Scene2D.Camera;

  constructor(
    private readonly scene: Phaser.Scene,
    target: Phaser.GameObjects.GameObject,
    bounds: { width: number; height: number },
  ) {
    this.camera = scene.cameras.main;
    this.camera.setBounds(0, 0, bounds.width, bounds.height);
    this.camera.setRoundPixels(true);
    this.camera.startFollow(target, true, CAMERA_CONFIG.followLerp, CAMERA_CONFIG.followLerp);

    this.applyZoom();
    scene.scale.on(Phaser.Scale.Events.RESIZE, this.applyZoom, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.scale.off(Phaser.Scale.Events.RESIZE, this.applyZoom, this);
    });
  }

  private applyZoom(): void {
    this.camera.setZoom(computeRoundZoom(this.scene.scale.width, this.scene.scale.height));
  }
}
