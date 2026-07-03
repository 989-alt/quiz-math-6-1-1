import { WeaponBase } from '../WeaponBase';
import type { GameScene } from '../../scenes/GameScene';
import type { Player } from '../../entities/Player';

export class Magnet extends WeaponBase {
  id = 'magnet';
  name = 'Magnet';
  nameKo = '자석';
  description = 'Pulls and damages enemies';
  descriptionKo = '적을 끌어당겨 공격';
  maxLevel = 8;

  constructor(scene: GameScene, player: Player) {
    super(scene, player);
    this.baseStats = {
      damage: 8,
      cooldown: 2000,
      area: 1,
      speed: 100,
      duration: 1500,
      amount: 1,
      pierce: 999,
      knockback: -50, // Negative = pull
    };
    this.levelUpgrades = [
      { damage: 2 },
      { area: 0.15 },
      { damage: 2 },
      { duration: 200 },
      { damage: 3 },
      { area: 0.15 },
      { damage: 4 },
    ];
  }

  attack(): void {
    const amount = this.getAmount();
    for (let i = 0; i < amount; i++) {
      const angle = (i / amount) * Math.PI * 2;
      const distance = 80 + i * 30;
      this.createMagnetField(angle, distance);
    }
  }

  private createMagnetField(angle: number, distance: number): void {
    const damage = this.getDamage();
    const area = this.getArea();
    const duration = this.getDuration();

    const x = this.player.x + Math.cos(angle) * distance;
    const y = this.player.y + Math.sin(angle) * distance;

    // U-shaped magnet
    const magnet = this.scene.add.container(x, y);

    // Red pole
    const redPole = this.scene.add.rectangle(-10 * area, 0, 8 * area, 24 * area, 0xff0000);
    // Blue pole
    const bluePole = this.scene.add.rectangle(10 * area, 0, 8 * area, 24 * area, 0x0000ff);
    // Base
    const base = this.scene.add.rectangle(0, 10 * area, 28 * area, 8 * area, 0x808080);

    magnet.add([base, redPole, bluePole]);
    magnet.setDepth(9);

    // Magnetic field visualization
    const fieldRadius = 60 * area;
    const field = this.scene.add.circle(x, y, fieldRadius, 0x9370db, 0.2);
    field.setDepth(8);

    this.scene.physics.add.existing(field);
    (field as any).damage = damage;
    (field as any).pierce = 999;

    this.scene.addProjectile(field as any);

    // Pull effect on nearby enemies
    const pullInterval = this.scene.time.addEvent({
      delay: 100,
      callback: () => {
        const monsters = this.scene.getMonsters();
        monsters.getChildren().forEach((monster) => {
          const m = monster as Phaser.Physics.Arcade.Sprite;
          if (!m.active) return;

          const dist = Phaser.Math.Distance.Between(x, y, m.x, m.y);
          if (dist < fieldRadius && dist > 10) {
            const pullAngle = Phaser.Math.Angle.Between(m.x, m.y, x, y);
            const pullForce = 30 * area;
            m.x += Math.cos(pullAngle) * pullForce * 0.1;
            m.y += Math.sin(pullAngle) * pullForce * 0.1;
          }
        });
      },
      loop: true,
    });

    // Pulsing animation
    this.scene.tweens.add({
      targets: field,
      scale: { from: 0.8, to: 1.2 },
      alpha: { from: 0.3, to: 0.1 },
      duration: 500,
      yoyo: true,
      repeat: Math.floor(duration / 1000),
    });

    this.scene.time.delayedCall(duration, () => {
      pullInterval.destroy();
      magnet.destroy();
      field.destroy();
    });
  }
}
