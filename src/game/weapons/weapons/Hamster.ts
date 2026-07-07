import { WeaponBase } from '../WeaponBase';
import type { GameScene } from '../../scenes/GameScene';
import type { Player } from '../../entities/Player';

export class Hamster extends WeaponBase {
  id = 'hamster';
  name = 'Hamster';
  nameKo = '햄스터';
  description = 'Spinning hamster friend';
  descriptionKo = '회전하는 햄스터 친구';
  maxLevel = 8;

  private hamsters: Phaser.GameObjects.Sprite[] = [];
  private orbitAngle: number = 0;
  private static readonly HIT_RESET_INTERVAL = 500;

  constructor(scene: GameScene, player: Player) {
    super(scene, player);
    this.baseStats = {
      damage: 18,
      cooldown: 100,
      area: 1,
      speed: 4,
      duration: 999999,
      amount: 1,
      pierce: 999,
      knockback: 0,
    };
    this.levelUpgrades = [
      { damage: 4 },
      { amount: 1 },
      { speed: 1 },
      { damage: 5 },
      { amount: 1 },
      { damage: 6 },
      { amount: 1 },
    ];
  }

  attack(): void {
    const amount = this.getAmount();
    const damage = this.getDamage();
    const area = this.getArea();

    // Create missing hamsters
    while (this.hamsters.length < amount) {
      // Use actual sprite
      const hamster = this.scene.add.sprite(
        this.player.x,
        this.player.y,
        'weapon_hamster'
      );
      hamster.setScale(1.0 * area);
      hamster.setDepth(9);

      this.scene.physics.add.existing(hamster);
      const body = hamster.body as Phaser.Physics.Arcade.Body;
      body.setSize(hamster.width * 0.8, hamster.height * 0.8);

      (hamster as any).damage = damage;
      (hamster as any).pierce = 999;
      (hamster as any).dashExtra = 0;
      (hamster as any).nextDashAt = this.scene.time.now + 3000;
      (hamster as any).__lastHitReset = this.scene.time.now;

      this.scene.addProjectile(hamster as any);
      this.hamsters.push(hamster);
    }

    // Update positions
    const orbitRadius = 70 * area;
    this.orbitAngle += this.getSpeed() * 0.02;

    this.hamsters.forEach((hamster, i) => {
      if (!hamster.active) return;

      const angle = this.orbitAngle + (i / this.hamsters.length) * Math.PI * 2;
      const radius = orbitRadius + ((hamster as any).dashExtra || 0);
      hamster.x = this.player.x + Math.cos(angle) * radius;
      hamster.y = this.player.y + Math.sin(angle) * radius;

      // Update damage
      (hamster as any).damage = damage;

      // GameScene의 (projectile, monster) 중복타격 방지 Set은 영구적이라 궤도를 돌며 계속
      // 맞닿아있는 보스 등은 최초 1회 이후 영원히 못 때린다. 주기적으로 초기화해 재타격 허용.
      const lastReset = (hamster as any).__lastHitReset ?? 0;
      if (this.scene.time.now - lastReset > Hamster.HIT_RESET_INTERVAL) {
        (hamster as any).__hitMonsters?.clear();
        (hamster as any).__lastHitReset = this.scene.time.now;
      }

      // Rolling animation
      hamster.setRotation(this.orbitAngle * 3);

      // Dash out and back every 3s
      if (!(hamster as any).dashing && this.scene.time.now >= (hamster as any).nextDashAt) {
        this.startDash(hamster, area);
      }

      // Update physics body position
      const body = hamster.body as Phaser.Physics.Arcade.Body;
      body.updateFromGameObject();
    });

    // Clean up
    this.hamsters = this.hamsters.filter(h => h.active);
  }

  private startDash(hamster: Phaser.GameObjects.Sprite, area: number): void {
    (hamster as any).dashing = true;

    this.scene.tweens.add({
      targets: hamster,
      dashExtra: 40 * area,
      duration: 200,
      ease: 'Sine.easeOut',
      yoyo: true,
      onYoyo: () => {
        this.playImpact(hamster.x, hamster.y, 'hit_small');
      },
      onComplete: () => {
        (hamster as any).dashing = false;
        (hamster as any).nextDashAt = this.scene.time.now + 3000;
      },
    });
  }
}
