import Phaser from 'phaser';
import { DRONE } from '../enemies/enemyKinds';
import type { Character } from '../entities/Character';
import type { Enemy } from '../entities/Enemy';
import type { WaveSystem } from './WaveSystem';
import type { WorldRect } from '../world/BossArena';

interface BossBolt {
  outer: Phaser.GameObjects.Arc;
  core: Phaser.GameObjects.Rectangle;
  vx: number;
  vy: number;
  damage: number;
}

interface CosmicRift {
  x: number;
  y: number;
  ring: Phaser.GameObjects.Arc;
  cube: Phaser.GameObjects.Rectangle;
  startedAt: number;
  detonateAt: number;
  radius: number;
  damage: number;
}

type PendingAction =
  | {
      kind: 'tesseract-cannon';
      startedAt: number;
      executeAt: number;
      targetX: number;
      targetY: number;
      lines: Phaser.GameObjects.Line[];
      chargeCube: Phaser.GameObjects.Rectangle;
    }
  | {
      kind: 'cosmic-rifts';
      startedAt: number;
      executeAt: number;
      aura: Phaser.GameObjects.Rectangle;
    }
  | {
      kind: 'hydra-lunge';
      startedAt: number;
      executeAt: number;
      targetX: number;
      targetY: number;
      corridor: Phaser.GameObjects.Line;
      targetRing: Phaser.GameObjects.Arc;
    };

const ATTACK_COOLDOWN_MS = 1200;
const FIRST_ATTACK_DELAY_MS = 1000;
const BOLT_HIT_RADIUS = 14;

/**
 * Los 3 ataques principales de Cráneo Rojo (Red Skull), inspirados en Capitán América: El Primer Vengador:
 * 1) Ráfaga del Cañón del Teseracto: abanico de 3 disparos de energía azul del Cubo Cósmico.
 * 2) Grietas del Cubo Cósmico (Teseracto): abre 4 portales espaciales inestables alrededor del jugador que explotan.
 * 3) Embestida de Súper Soldado + Escuadrón HYDRA: carga con fuerza sobrehumana, libera una onda carmesí y convoca refuerzos.
 */
export class BossAttackSystem {
  private trackedBoss: Enemy | null = null;
  private nextAttackAt = 0;
  private attackIndex = 0;
  private pending: PendingAction | null = null;
  private lungeEndAt = 0;
  private readonly bolts: BossBolt[] = [];
  private readonly rifts: CosmicRift[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly player: Character,
    private readonly waves: WaveSystem,
    private readonly world: WorldRect,
  ) {}

  update(now: number, delta: number, boss: Enemy | null): void {
    this.updateBolts(delta);
    this.updateRifts(now);

    if (!boss || !boss.active || boss.dying) {
      this.clearPending();
      this.trackedBoss = null;
      return;
    }

    if (this.trackedBoss !== boss) {
      this.clearPending();
      this.trackedBoss = boss;
      this.nextAttackAt = now + FIRST_ATTACK_DELAY_MS;
      this.attackIndex = 0;
      this.lungeEndAt = 0;
    }

    if (this.lungeEndAt > 0 && now >= this.lungeEndAt) {
      this.lungeEndAt = 0;
      this.finishHydraLunge(boss);
    }

    if (this.pending) {
      this.updatePending(now, boss);
      return;
    }

    if (now < this.nextAttackAt || this.lungeEndAt > 0) return;

    const choice = this.attackIndex % 3;
    this.attackIndex++;

    if (choice === 0) {
      this.startTesseractCannon(now, boss);
    } else if (choice === 1) {
      this.startCosmicRifts(now, boss);
    } else {
      this.startHydraLunge(now, boss);
    }
  }

  /** 1) Ráfaga del Cañón del Teseracto: apunta con 3 haces azules y dispara 3 descargas del Cubo Cósmico. */
  private startTesseractCannon(now: number, boss: Enemy): void {
    const telegraphMs = 750;
    const targetX = this.player.x;
    const targetY = this.player.y - 8;
    boss.lockForShot(telegraphMs, targetX, targetY);

    const baseAngle = Phaser.Math.Angle.Between(boss.x, boss.y - 16, targetX, targetY);
    const spreads = [-0.56, -0.28, 0, 0.28, 0.56];
    const lines = spreads.map((offset) => {
      const angle = baseAngle + offset;
      const endX = boss.x + Math.cos(angle) * 260;
      const endY = boss.y - 16 + Math.sin(angle) * 260;
      const line = this.scene.add.line(0, 0, boss.x, boss.y - 16, endX, endY, 0x38d0ff, 0.85);
      line.setOrigin(0, 0);
      line.setLineWidth(2, 1);
      line.setDepth(boss.y + 2);
      return line;
    });

    const chargeCube = this.scene.add
      .rectangle(boss.x, boss.y - 22, 9, 9, 0x38d0ff, 0.85)
      .setStrokeStyle(1.5, 0xffffff, 0.95)
      .setDepth(boss.y + 3);

    this.pending = {
      kind: 'tesseract-cannon',
      startedAt: now,
      executeAt: now + telegraphMs,
      targetX,
      targetY,
      lines,
      chargeCube,
    };
  }

  /** 2) Grietas del Cubo Cósmico: canaliza el Teseracto y abre 4 portales espaciales alrededor del jugador. */
  private startCosmicRifts(now: number, boss: Enemy): void {
    const channelMs = 650;
    boss.lockForShot(channelMs, this.player.x, this.player.y - 8);

    const aura = this.scene.add
      .rectangle(boss.x, boss.y - 30, 12, 12, 0x28b8ff, 0.75)
      .setStrokeStyle(2, 0xd8f8ff, 1)
      .setDepth(boss.y + 3);

    const count = 6;
    const baseAngle = Math.random() * Math.PI * 2;
    for (let i = 0; i < count; i++) {
      const angle = baseAngle + (i * Math.PI * 2) / count;
      const dist = i === 0 ? 18 : 56;
      const rx = Phaser.Math.Clamp(this.player.x + Math.cos(angle) * dist, this.world.x + 32, this.world.x + this.world.width - 32);
      const ry = Phaser.Math.Clamp(this.player.y - 6 + Math.sin(angle) * dist, this.world.y + 32, this.world.y + this.world.height - 32);
      const radius = 30;

      const ring = this.scene.add
        .circle(rx, ry, radius, 0x1e90ff, 0.16)
        .setStrokeStyle(2, 0x6ce5ff, 0.9)
        .setDepth(ry - 1);
      const cube = this.scene.add
        .rectangle(rx, ry, 14, 14, 0x4ae0ff, 0.35)
        .setStrokeStyle(1.5, 0xffffff, 0.9)
        .setDepth(ry);

      this.rifts.push({
        x: rx,
        y: ry,
        ring,
        cube,
        startedAt: now,
        detonateAt: now + 1050,
        radius,
        damage: 45,
      });
    }

    this.pending = {
      kind: 'cosmic-rifts',
      startedAt: now,
      executeAt: now + channelMs,
      aura,
    };
  }

  /** 3) Embestida de Súper Soldado + Escuadrón HYDRA: marca una trayectoria carmesí y se lanza a toda velocidad. */
  private startHydraLunge(now: number, boss: Enemy): void {
    const telegraphMs = 700;
    const dx = this.player.x - boss.x;
    const dy = this.player.y - 6 - boss.y;
    const angle = Math.atan2(dy, dx);
    const dashDist = 115;
    const targetX = Phaser.Math.Clamp(boss.x + Math.cos(angle) * dashDist, this.world.x + 24, this.world.x + this.world.width - 24);
    const targetY = Phaser.Math.Clamp(boss.y + Math.sin(angle) * dashDist, this.world.y + 24, this.world.y + this.world.height - 24);

    boss.lockForShot(telegraphMs, targetX, targetY);

    const corridor = this.scene.add.line(0, 0, boss.x, boss.y - 8, targetX, targetY, 0xe02828, 0.75);
    corridor.setOrigin(0, 0);
    corridor.setLineWidth(4, 2);
    corridor.setDepth(boss.y - 1);

    const targetRing = this.scene.add
      .circle(targetX, targetY, 28, 0xc42020, 0.18)
      .setStrokeStyle(2, 0xff5a5a, 0.9)
      .setDepth(targetY - 1);

    this.pending = {
      kind: 'hydra-lunge',
      startedAt: now,
      executeAt: now + telegraphMs,
      targetX,
      targetY,
      corridor,
      targetRing,
    };
  }

  private updatePending(now: number, boss: Enemy): void {
    const p = this.pending;
    if (!p) return;

    if (p.kind === 'tesseract-cannon') {
      const baseAngle = Phaser.Math.Angle.Between(boss.x, boss.y - 16, p.targetX, p.targetY);
      const spreads = [-0.56, -0.28, 0, 0.28, 0.56];
      p.lines.forEach((line, idx) => {
        const angle = baseAngle + spreads[idx];
        line.setTo(boss.x, boss.y - 16, boss.x + Math.cos(angle) * 260, boss.y - 16 + Math.sin(angle) * 260);
        line.setAlpha(0.45 + Math.sin(now / 35) * 0.35);
      });
      p.chargeCube.setPosition(boss.x, boss.y - 22).setRotation(now / 140);

      if (now >= p.executeAt) {
        const speed = 195;
        spreads.forEach((offset) => {
          const angle = baseAngle + offset;
          const outer = this.scene.add
            .circle(boss.x, boss.y - 16, 6, 0x24b0ff, 0.85)
            .setStrokeStyle(2, 0xd8f8ff, 1)
            .setDepth(boss.y + 2);
          const core = this.scene.add
            .rectangle(boss.x, boss.y - 16, 6, 6, 0xffffff, 0.95)
            .setRotation(angle)
            .setDepth(boss.y + 3);
          this.bolts.push({
            outer,
            core,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            damage: 38,
          });
        });
        this.clearPending();
        this.nextAttackAt = now + ATTACK_COOLDOWN_MS;
      }
      return;
    }

    if (p.kind === 'cosmic-rifts') {
      p.aura.setPosition(boss.x, boss.y - 30).setRotation(now / 120);
      if (now >= p.executeAt) {
        this.clearPending();
        this.nextAttackAt = now + ATTACK_COOLDOWN_MS;
      }
      return;
    }

    if (p.kind === 'hydra-lunge') {
      p.corridor.setTo(boss.x, boss.y - 8, p.targetX, p.targetY);
      p.corridor.setAlpha(0.5 + Math.sin(now / 35) * 0.35);
      p.targetRing.setAlpha(0.25 + Math.sin(now / 45) * 0.15);

      if (now >= p.executeAt) {
        const dx = p.targetX - boss.x;
        const dy = p.targetY - boss.y;
        const lungeMs = 420;
        boss.lunge(dx, dy, 245, lungeMs);
        this.lungeEndAt = now + lungeMs;
        this.clearPending();
        this.nextAttackAt = now + ATTACK_COOLDOWN_MS + lungeMs;
      }
    }
  }

  private finishHydraLunge(boss: Enemy): void {
    const shockRadius = 34;
    const wave = this.scene.add
      .circle(boss.x, boss.y - 6, shockRadius, 0xd62828, 0.5)
      .setStrokeStyle(2, 0xff9a9a, 0.95)
      .setScale(0.25)
      .setDepth(boss.y + 2);
    this.scene.tweens.add({
      targets: wave,
      scale: 1,
      alpha: 0,
      duration: 280,
      onComplete: () => wave.destroy(),
    });

    if (Phaser.Math.Distance.Between(boss.x, boss.y - 6, this.player.x, this.player.y - 8) <= shockRadius) {
      this.player.takeDamage(Math.round(45 * this.waves.curse));
    }

    // Convoca un par de escoltas al terminar la embestida si no hay demasiados enemigos en pantalla
    const escorts = Math.round(8 * this.waves.curse);
    for (let i = 0; i < escorts; i++) this.waves.spawnEnemy(DRONE, { health: 1.5 * this.waves.curse, speed: 1.15 * this.waves.curse });
  }

  private updateBolts(delta: number): void {
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i];
      const dt = delta / 1000;
      const nx = b.outer.x + b.vx * dt;
      const ny = b.outer.y + b.vy * dt;
      b.outer.setPosition(nx, ny);
      b.core.setPosition(nx, ny).setRotation(b.core.rotation + 8 * dt);

      if (Phaser.Math.Distance.Between(nx, ny, this.player.x, this.player.y - 8) <= BOLT_HIT_RADIUS) {
        this.player.takeDamage(Math.round(b.damage * this.waves.curse));
        b.outer.destroy();
        b.core.destroy();
        this.bolts.splice(i, 1);
        continue;
      }

      if (nx < this.world.x || ny < this.world.y || nx > this.world.x + this.world.width || ny > this.world.y + this.world.height) {
        b.outer.destroy();
        b.core.destroy();
        this.bolts.splice(i, 1);
      }
    }
  }

  private updateRifts(now: number): void {
    for (let i = this.rifts.length - 1; i >= 0; i--) {
      const r = this.rifts[i];
      const progress = Phaser.Math.Clamp((now - r.startedAt) / (r.detonateAt - r.startedAt), 0, 1);
      r.cube.setRotation(now / 140).setScale(0.6 + progress * 0.7);
      r.ring.setAlpha(0.2 + progress * 0.45);

      if (now < r.detonateAt) continue;

      if (Phaser.Math.Distance.Between(r.x, r.y, this.player.x, this.player.y - 8) <= r.radius) {
        this.player.takeDamage(Math.round(r.damage * this.waves.curse));
      }

      const flash = this.scene.add
        .circle(r.x, r.y, r.radius, 0x52e0ff, 0.75)
        .setStrokeStyle(2, 0xffffff, 1)
        .setDepth(r.y + 2);
      this.scene.tweens.add({
        targets: flash,
        scale: 1.25,
        alpha: 0,
        duration: 240,
        onComplete: () => flash.destroy(),
      });

      r.ring.destroy();
      r.cube.destroy();
      this.rifts.splice(i, 1);
    }
  }

  private clearPending(): void {
    if (!this.pending) return;
    if (this.pending.kind === 'tesseract-cannon') {
      for (const l of this.pending.lines) l.destroy();
      this.pending.chargeCube.destroy();
    } else if (this.pending.kind === 'cosmic-rifts') {
      this.pending.aura.destroy();
    } else if (this.pending.kind === 'hydra-lunge') {
      this.pending.corridor.destroy();
      this.pending.targetRing.destroy();
    }
    this.pending = null;
  }

  destroy(): void {
    this.clearPending();
    for (const b of this.bolts) {
      b.outer.destroy();
      b.core.destroy();
    }
    for (const r of this.rifts) {
      r.ring.destroy();
      r.cube.destroy();
    }
    this.bolts.length = 0;
    this.rifts.length = 0;
  }
}
