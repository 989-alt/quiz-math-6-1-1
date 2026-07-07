import { WeaponBase } from '../WeaponBase';
import type { GameScene } from '../../scenes/GameScene';
import type { Player } from '../../entities/Player';

export class Acorn extends WeaponBase {
  id = 'acorn';
  name = 'Acorn';
  nameKo = '도토리';
  description = 'Bouncing acorns';
  descriptionKo = '튕기는 도토리';
  maxLevel = 8;

  constructor(scene: GameScene, player: Player) {
    super(scene, player);
    this.baseStats = {
      damage: 15,
      cooldown: 900,
      area: 1,
      speed: 350,
      duration: 3000,
      amount: 2,
      pierce: 3,
      knockback: 0,
    };
    this.levelUpgrades = [
      { amount: 1 },
      { damage: 5 },
      { pierce: 1 },
      { amount: 1 },
      { damage: 5 },
      { pierce: 2 },
      { damage: 10 },
    ];
  }

  attack(): void {
    const amount = this.getAmount();

    for (let i = 0; i < amount; i++) {
      const angle = Math.random() * Math.PI * 2;
      this.createAcorn(angle);
    }
  }

  private createAcorn(angle: number): void {
    const speed = this.getSpeed();
    const area = this.getArea();
    const damage = this.getDamage();
    const pierce = this.getPierce();

    // Use actual sprite
    const acorn = this.scene.add.sprite(
      this.player.x,
      this.player.y,
      'weapon_acorn'
    );
    acorn.setScale(1.2 * area);
    acorn.setDepth(9);

    this.scene.physics.add.existing(acorn);
    const body = acorn.body as Phaser.Physics.Arcade.Body;
    body.setSize(acorn.width * 0.8, acorn.height * 0.8);
    body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
    body.setBounce(1, 1);

    (acorn as any).damage = damage;
    (acorn as any).pierce = pierce;

    this.scene.addProjectile(acorn as any);
    this.wireImpactFx(acorn, 'poof');

    // Rotation animation
    this.scene.tweens.add({
      targets: acorn,
      rotation: Math.PI * 4,
      duration: 1000,
      repeat: -1,
    });

    // 낙하-튕김: 화면 가장자리에 튕길 때마다 squash(y 0.8) 후 최대 3회까지만 반사
    const baseScale = acorn.scaleX;
    let bounceCount = 0;
    const maxBounces = 3;

    const squash = () => {
      this.scene.tweens.add({
        targets: acorn,
        scaleY: baseScale * 0.8,
        scaleX: baseScale * 1.15,
        duration: 90,
        yoyo: true,
        ease: 'Quad.easeOut',
      });
    };

    // Bounce off screen edges
    const checkBounds = () => {
      if (!acorn.active) return;
      if (bounceCount >= maxBounces) return;

      const cam = this.scene.cameras.main;
      const bounds = {
        left: cam.scrollX,
        right: cam.scrollX + cam.width,
        top: cam.scrollY,
        bottom: cam.scrollY + cam.height,
      };

      let bounced = false;
      if (acorn.x <= bounds.left || acorn.x >= bounds.right) {
        body.setVelocityX(-body.velocity.x);
        bounced = true;
      }
      if (acorn.y <= bounds.top || acorn.y >= bounds.bottom) {
        body.setVelocityY(-body.velocity.y);
        bounced = true;
      }

      if (bounced) {
        bounceCount++;
        squash();
      }
    };

    const bounceTimer = this.scene.time.addEvent({
      delay: 50,
      callback: checkBounds,
      loop: true,
    });

    this.scene.time.delayedCall(this.getDuration(), () => {
      bounceTimer.destroy();
      if (acorn.active) acorn.destroy();
    });
  }

  // 명중 시 먼지 퍼프 이펙트 재생
  private wireImpactFx(projectile: any, kind: string): void {
    const hitSet = new Set<any>();
    const overlap = this.scene.physics.add.overlap(projectile, this.scene.getMonsters(), (_p, monster) => {
      if (hitSet.has(monster)) return;
      hitSet.add(monster);
      const m = monster as Phaser.Physics.Arcade.Sprite;
      this.playImpact(m.x, m.y, kind);
    });

    projectile.once('destroy', () => overlap.destroy());
  }
}
