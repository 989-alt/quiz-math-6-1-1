import { WeaponBase } from '../WeaponBase';
import type { GameScene } from '../../scenes/GameScene';
import type { Player } from '../../entities/Player';

export class Eraser extends WeaponBase {
  id = 'eraser';
  name = 'Eraser';
  nameKo = '지우개';
  description = 'Erases enemies in area';
  descriptionKo = '범위 내 적을 지우는 지우개';
  maxLevel = 8;

  constructor(scene: GameScene, player: Player) {
    super(scene, player);
    this.baseStats = {
      damage: 30,
      cooldown: 2500,
      area: 1,
      speed: 0,
      duration: 500,
      amount: 1,
      pierce: 999,
      knockback: 0,
    };
    this.levelUpgrades = [
      { area: 0.15 },
      { damage: 8 },
      { cooldown: -200 },
      { area: 0.15 },
      { damage: 10 },
      { area: 0.2 },
      { damage: 15 },
    ];
  }

  attack(): void {
    const amount = this.getAmount();
    const damage = this.getDamage();
    const area = this.getArea();
    const duration = this.getDuration();

    for (let i = 0; i < amount; i++) {
      const angle = (i / amount) * Math.PI * 2;
      const distance = 60 + i * 30;
      this.createEraserZone(angle, distance, damage, area, duration);
    }
  }

  private createEraserZone(angle: number, distance: number, damage: number, area: number, duration: number): void {
    const x = this.player.x + Math.cos(angle) * distance;
    const y = this.player.y + Math.sin(angle) * distance;

    // Use actual sprite
    const eraser = this.scene.add.sprite(x, y, 'weapon_eraser');
    eraser.setScale(0.07 * area);
    eraser.setDepth(9);

    this.scene.physics.add.existing(eraser);
    const body = eraser.body as Phaser.Physics.Arcade.Body;
    body.setSize(eraser.displayWidth * 0.9, eraser.displayHeight * 0.9);

    (eraser as any).damage = damage;
    (eraser as any).pierce = 999;

    this.scene.addProjectile(eraser as any);

    // Erasing animation with physics body update
    let elapsed = 0;
    const startScale = 0;
    const endScale = 0.09 * area;

    const updateEraser = () => {
      if (!eraser.active) return;

      elapsed += this.scene.game.loop.delta;
      const t = elapsed / duration;

      if (t >= 1) {
        eraser.destroy();
        return;
      }

      // Ease out cubic
      const easeT = 1 - Math.pow(1 - t, 3);
      const scale = startScale + (endScale - startScale) * easeT;
      eraser.setScale(scale);
      eraser.setAlpha(1 - t);

      // Update physics body
      body.setSize(eraser.displayWidth * 0.9, eraser.displayHeight * 0.9);

      this.scene.time.delayedCall(16, updateEraser);
    };

    updateEraser();
  }
}
