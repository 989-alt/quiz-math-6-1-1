import { WeaponBase } from '../WeaponBase';
import type { GameScene } from '../../scenes/GameScene';
import type { Player } from '../../entities/Player';

export class Leaf extends WeaponBase {
  id = 'leaf';
  name = 'Leaf';
  nameKo = '나뭇잎';
  description = 'Drifting leaf projectile';
  descriptionKo = '바람에 흔들리는 나뭇잎';
  maxLevel = 8;

  constructor(scene: GameScene, player: Player) {
    super(scene, player);
    this.baseStats = {
      damage: 8,
      cooldown: 600,
      area: 1,
      speed: 200,
      duration: 3000,
      amount: 3,
      pierce: 3,
      knockback: 0,
    };
    this.levelUpgrades = [
      { amount: 1 },
      { damage: 2 },
      { amount: 1 },
      { pierce: 1 },
      { damage: 3 },
      { amount: 2 },
      { damage: 5 },
    ];
  }

  attack(): void {
    const amount = this.getAmount();
    const targets = this.findClosestEnemies(amount);
    for (let i = 0; i < amount; i++) {
      const assigned = targets.length > 0 ? targets[i % targets.length] : null;
      this.scene.time.delayedCall(i * 100, () => {
        this.createLeaf(assigned);
      });
    }
  }

  private createLeaf(assigned: Phaser.Physics.Arcade.Sprite | null): void {
    const speed = this.getSpeed();
    const duration = this.getDuration();
    const angle = Math.random() * Math.PI * 2;

    const leaf = this.createProjectile(
      this.player.x,
      this.player.y,
      'weapon_leaf',
      Math.cos(angle) * speed,
      Math.sin(angle) * speed,
      { rotation: angle, lifespan: duration }
    );

    this.attachImpactEffect(leaf, 'heal');

    // Gentle tumble: rock ±30° instead of spinning freely
    this.scene.tweens.add({
      targets: leaf,
      rotation: angle + Phaser.Math.DegToRad(30),
      duration: 400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Sine-wave drift + gentle homing toward the nearest enemy
    const body = leaf.body as Phaser.Physics.Arcade.Body;
    const driftTimer = this.scene.time.addEvent({
      delay: 50,
      callback: () => {
        if (!leaf.active) return;

        // 배정 타겟이 죽으면 최근접으로 폴백해 계속 유도
        const target = assigned && assigned.active ? assigned : this.findClosestEnemy();
        if (target) {
          const toTarget = Phaser.Math.Angle.Between(leaf.x, leaf.y, target.x, target.y);
          const current = Math.atan2(body.velocity.y, body.velocity.x);
          const steered = Phaser.Math.Angle.RotateTo(current, toTarget, 0.015);
          body.setVelocity(Math.cos(steered) * speed, Math.sin(steered) * speed);
        }

        const wave = Math.sin(Date.now() / 200) * 20;
        body.setVelocityY(body.velocity.y + wave * 0.1);
      },
      loop: true,
    });

    this.scene.time.delayedCall(duration, () => {
      driftTimer.destroy();
      if (leaf.active) {
        this.scene.tweens.add({
          targets: leaf,
          alpha: 0,
          duration: 200,
          onComplete: () => leaf.destroy(),
        });
      }
    });
  }

  private attachImpactEffect(sprite: Phaser.Physics.Arcade.Sprite, kind: string): void {
    const hit = new Set<Phaser.Physics.Arcade.Sprite>();
    const overlap = this.scene.physics.add.overlap(sprite, this.scene.getMonsters(), (_s, monster) => {
      const m = monster as Phaser.Physics.Arcade.Sprite;
      if (hit.has(m)) return;
      hit.add(m);
      this.playImpact(m.x, m.y, kind);
    });
    sprite.once('destroy', () => overlap.destroy());
  }
}
