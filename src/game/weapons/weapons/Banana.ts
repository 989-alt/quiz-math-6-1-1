import { WeaponBase } from '../WeaponBase';
import type { GameScene } from '../../scenes/GameScene';
import type { Player } from '../../entities/Player';

export class Banana extends WeaponBase {
  id = 'banana';
  name = 'Banana';
  nameKo = '바나나';
  description = 'Boomerang banana that returns';
  descriptionKo = '돌아오는 바나나 부메랑';
  maxLevel = 8;

  constructor(scene: GameScene, player: Player) {
    super(scene, player);
    this.baseStats = {
      damage: 25,
      cooldown: 1200,
      area: 1,
      speed: 300,
      duration: 1500,
      amount: 1,
      pierce: 999,
      knockback: 0,
    };
    this.levelUpgrades = [
      { damage: 5 },
      { speed: 50 },
      { damage: 5 },
      { amount: 1 },
      { damage: 10 },
      { area: 0.15 },
      { damage: 10 },
    ];
  }

  attack(): void {
    const amount = this.getAmount();
    const damage = this.getDamage();
    const speed = this.getSpeed();
    const area = this.getArea();

    for (let i = 0; i < amount; i++) {
      const angle = (i / amount) * Math.PI * 2 + Math.random() * 0.5;
      this.createBoomerang(angle, damage, speed, area);
    }
  }

  private createBoomerang(angle: number, damage: number, speed: number, area: number): void {
    // Use actual sprite
    const banana = this.scene.add.sprite(
      this.player.x,
      this.player.y,
      'weapon_banana'
    );
    banana.setScale(0.06 * area);
    banana.setDepth(9);

    this.scene.physics.add.existing(banana);
    const body = banana.body as Phaser.Physics.Arcade.Body;
    body.setSize(banana.displayWidth * 0.8, banana.displayHeight * 0.8);

    (banana as any).damage = damage;
    (banana as any).pierce = 999;

    this.scene.addProjectile(banana as any);

    // Boomerang motion using velocity, not tweens
    const distance = 200 * area;
    const outDuration = 600;
    const returnDuration = 600;
    const totalDuration = outDuration + returnDuration;

    let elapsed = 0;
    const startX = this.player.x;
    const startY = this.player.y;

    // Custom update function for boomerang movement
    const updateBoomerang = () => {
      if (!banana.active) return;

      elapsed += this.scene.game.loop.delta;
      const t = elapsed / totalDuration;

      // Rotation
      banana.rotation += 0.3;

      if (t < 0.5) {
        // Going out
        const outT = t / 0.5;
        const easeT = Math.sin(outT * Math.PI / 2); // Sine ease out
        banana.x = startX + Math.cos(angle) * distance * easeT;
        banana.y = startY + Math.sin(angle) * distance * easeT;
      } else {
        // Coming back - target current player position
        const returnT = (t - 0.5) / 0.5;
        const easeT = 1 - Math.cos(returnT * Math.PI / 2); // Sine ease in
        const midX = startX + Math.cos(angle) * distance;
        const midY = startY + Math.sin(angle) * distance;
        banana.x = midX + (this.player.x - midX) * easeT;
        banana.y = midY + (this.player.y - midY) * easeT;
      }

      // Update physics body position
      body.updateFromGameObject();

      if (t >= 1) {
        banana.destroy();
        return;
      }

      // Continue updating
      this.scene.time.delayedCall(16, updateBoomerang);
    };

    updateBoomerang();
  }
}
