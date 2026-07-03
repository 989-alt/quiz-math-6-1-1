import Phaser from 'phaser';
import { WeaponBase } from '../WeaponBase';
import { GAME_CONFIG } from '../../config';
import type { GameScene } from '../../scenes/GameScene';
import type { Player } from '../../entities/Player';

export class Ruler extends WeaponBase {
  id = 'ruler';
  name = 'Banana Shooter';
  nameKo = '바나나 발사기';
  description = 'Shoots bananas at nearby enemies';
  descriptionKo = '주변 적에게 바나나를 발사합니다';
  maxLevel = 8;

  constructor(scene: GameScene, player: Player) {
    super(scene, player);
    this.baseStats = {
      damage: 10,
      cooldown: 800,
      area: 1,
      speed: 400,
      duration: 2000,
      amount: 1,
      pierce: 3,
      knockback: 0,
    };
    this.levelUpgrades = [
      { damage: 3 },
      { amount: 1 },
      { damage: 3 },
      { speed: 50 },
      { damage: 4 },
      { amount: 1 },
      { damage: 5 },
    ];
  }

  attack(): void {
    const amount = this.getAmount();
    const damage = this.getDamage();
    const speed = this.getSpeed();
    const area = this.getArea();

    // 화면 안(autoAimRange)에 있는 적만 자동조준
    const enemies = this.findNearestEnemies(amount, GAME_CONFIG.combat.autoAimRange);

    // 적이 한 명도 없으면 발사 안 함 (탄약 낭비 방지)
    if (enemies.length === 0) return;

    for (let i = 0; i < amount; i++) {
      const target = enemies[i % enemies.length];
      const angle = Phaser.Math.Angle.Between(
        this.player.x, this.player.y,
        target.x, target.y
      ) + (Math.random() - 0.5) * 0.2; // 약간의 산탄

      this.createBananaProjectile(angle, damage, speed, area);
    }
  }

  private findNearestEnemies(count: number, range: number): Phaser.Physics.Arcade.Sprite[] {
    const monsters = this.scene.getMonsters().getChildren() as Phaser.Physics.Arcade.Sprite[];
    const playerX = this.player.x;
    const playerY = this.player.y;

    return monsters
      .filter(m => m.active)
      .map(m => ({
        monster: m,
        dist: Phaser.Math.Distance.Between(playerX, playerY, m.x, m.y)
      }))
      .filter(m => m.dist <= range)
      .sort((a, b) => a.dist - b.dist)
      .slice(0, count)
      .map(m => m.monster);
  }

  private createBananaProjectile(angle: number, damage: number, speed: number, area: number): void {
    // Use banana sprite
    const banana = this.scene.add.sprite(
      this.player.x,
      this.player.y,
      'weapon_banana'
    );
    banana.setScale(0.08 * area); // Larger banana
    banana.setDepth(9);
    banana.setRotation(angle);

    this.scene.physics.add.existing(banana);
    const body = banana.body as Phaser.Physics.Arcade.Body;
    // Use full sprite size for hitbox
    body.setSize(banana.width, banana.height);
    body.setOffset(0, 0);

    (banana as any).damage = damage;
    (banana as any).pierce = this.getPierce();

    this.scene.addProjectile(banana as any);

    // Set velocity for straight line movement
    const velocityX = Math.cos(angle) * speed;
    const velocityY = Math.sin(angle) * speed;
    body.setVelocity(velocityX, velocityY);

    // Rotate while flying
    const rotationSpeed = 0.15;
    const updateRotation = () => {
      if (!banana.active) return;
      banana.rotation += rotationSpeed;
      this.scene.time.delayedCall(16, updateRotation);
    };
    updateRotation();

    // Destroy after duration
    this.scene.time.delayedCall(this.getDuration(), () => {
      if (banana.active) {
        banana.destroy();
      }
    });
  }
}
