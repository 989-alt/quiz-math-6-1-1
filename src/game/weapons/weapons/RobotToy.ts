import { WeaponBase } from '../WeaponBase';
import type { GameScene } from '../../scenes/GameScene';
import type { Player } from '../../entities/Player';

export class RobotToy extends WeaponBase {
  id = 'robot_toy';
  name = 'Robot Toy';
  nameKo = '로봇 장난감';
  description = 'Auto-attacking robot';
  descriptionKo = '자동으로 공격하는 로봇';
  maxLevel = 8;

  private robots: Phaser.GameObjects.Sprite[] = [];
  private robotFireTimers: Map<Phaser.GameObjects.Sprite, number> = new Map();

  constructor(scene: GameScene, player: Player) {
    super(scene, player);
    this.baseStats = {
      damage: 10,
      cooldown: 100,
      area: 1,
      speed: 300,
      duration: 999999,
      amount: 1,
      pierce: 1,
      knockback: 0,
    };
    this.levelUpgrades = [
      { damage: 2 },
      { amount: 1 },
      { damage: 3 },
      { speed: 30 },
      { damage: 3 },
      { amount: 1 },
      { damage: 5 },
    ];
  }

  attack(): void {
    const amount = this.getAmount();
    const damage = this.getDamage();
    const area = this.getArea();

    // Create missing robots
    while (this.robots.length < amount) {
      const robot = this.createRobot(area);
      this.robots.push(robot);
      this.robotFireTimers.set(robot, 0);
    }

    // Update robot positions and firing
    const orbitRadius = 50 * area;

    this.robots.forEach((robot, i) => {
      if (!robot.active) return;

      // Orbit around player
      const angle = (Date.now() / 2000 + (i / this.robots.length) * Math.PI * 2) % (Math.PI * 2);
      robot.x = this.player.x + Math.cos(angle) * orbitRadius;
      robot.y = this.player.y + Math.sin(angle) * orbitRadius;

      // Fire at nearest enemy every 1.5s (attack()는 매 프레임이 아니라 쿨다운(getCooldown())마다 호출됨)
      const fireTimer = this.robotFireTimers.get(robot) || 0;
      if (fireTimer <= 0) {
        this.robotFire(robot, damage, area);
        this.robotFireTimers.set(robot, 1500);
      } else {
        this.robotFireTimers.set(robot, fireTimer - this.getCooldown());
      }
    });

    // Clean up
    this.robots = this.robots.filter(r => r.active);
  }

  private createRobot(area: number): Phaser.GameObjects.Sprite {
    const robot = this.scene.add.sprite(this.player.x, this.player.y, 'weapon_robot_toy');
    robot.setScale(area);
    robot.setDepth(9);

    // 2-frame walking bob (squash/stretch stand-in since art is a single sprite)
    const bobTween = this.scene.tweens.add({
      targets: robot,
      scaleY: area * 0.88,
      duration: 220,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    robot.once('destroy', () => bobTween.stop());

    return robot;
  }

  private robotFire(robot: Phaser.GameObjects.Sprite, damage: number, area: number): void {
    const target = this.findClosestEnemy();
    if (!target) return;

    const angle = Phaser.Math.Angle.Between(robot.x, robot.y, target.x, target.y);
    const speed = this.getSpeed();

    // Muzzle flash (1 frame)
    const muzzleX = robot.x + Math.cos(angle) * 10 * area;
    const muzzleY = robot.y + Math.sin(angle) * 10 * area;
    const flash = this.scene.add.circle(muzzleX, muzzleY, 5 * area, 0xffff00, 0.9);
    flash.setDepth(10);
    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 1.6,
      duration: 80,
      onComplete: () => flash.destroy(),
    });

    const bullet = this.scene.add.circle(
      robot.x,
      robot.y,
      4 * area,
      0xffe066
    );
    bullet.setDepth(8);

    this.scene.physics.add.existing(bullet);
    const body = bullet.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);

    (bullet as any).damage = damage;
    (bullet as any).pierce = this.getPierce();

    this.scene.addProjectile(bullet as any);
    this.attachImpactEffect(bullet as any, 'hit_small');

    this.scene.time.delayedCall(2000, () => {
      if (bullet.active) bullet.destroy();
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

  // 게임 리셋 시 그룹 밖에서 직접 들고 있던 로봇 스프라이트 정리 (§WeaponBase.destroy)
  destroy(): void {
    this.robots.forEach((robot) => robot.destroy());
    this.robots = [];
    this.robotFireTimers.clear();
  }
}
