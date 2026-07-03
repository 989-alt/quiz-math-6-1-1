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

  private robots: Phaser.GameObjects.Container[] = [];
  private robotFireTimers: Map<Phaser.GameObjects.Container, number> = new Map();

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

      // Fire at nearest enemy
      const fireTimer = this.robotFireTimers.get(robot) || 0;
      if (fireTimer <= 0) {
        this.robotFire(robot, damage, area);
        this.robotFireTimers.set(robot, 800);
      } else {
        this.robotFireTimers.set(robot, fireTimer - 16);
      }
    });

    // Clean up
    this.robots = this.robots.filter(r => r.active);
  }

  private createRobot(area: number): Phaser.GameObjects.Container {
    const robot = this.scene.add.container(this.player.x, this.player.y);

    // Body
    const body = this.scene.add.rectangle(0, 0, 16 * area, 20 * area, 0x808080);
    // Head
    const head = this.scene.add.rectangle(0, -14 * area, 12 * area, 10 * area, 0xa0a0a0);
    // Eyes
    const leftEye = this.scene.add.circle(-3 * area, -14 * area, 2 * area, 0xff0000);
    const rightEye = this.scene.add.circle(3 * area, -14 * area, 2 * area, 0xff0000);

    robot.add([body, head, leftEye, rightEye]);
    robot.setDepth(9);

    return robot;
  }

  private robotFire(robot: Phaser.GameObjects.Container, damage: number, area: number): void {
    const target = this.findClosestEnemy();
    if (!target) return;

    const angle = Phaser.Math.Angle.Between(robot.x, robot.y, target.x, target.y);
    const speed = this.getSpeed();

    const bullet = this.scene.add.circle(
      robot.x,
      robot.y,
      4 * area,
      0xff0000
    );
    bullet.setDepth(8);

    this.scene.physics.add.existing(bullet);
    const body = bullet.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);

    (bullet as any).damage = damage;
    (bullet as any).pierce = this.getPierce();

    this.scene.addProjectile(bullet as any);

    this.scene.time.delayedCall(2000, () => {
      if (bullet.active) bullet.destroy();
    });
  }
}
