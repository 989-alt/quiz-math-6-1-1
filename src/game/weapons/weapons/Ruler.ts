import Phaser from 'phaser';
import { WeaponBase } from '../WeaponBase';
import type { GameScene } from '../../scenes/GameScene';
import type { Player } from '../../entities/Player';

export class Ruler extends WeaponBase {
  id = 'ruler';
  name = 'Ruler';
  nameKo = '자';
  description = 'Melee arc swing that hits nearby enemies';
  descriptionKo = '90도 부채꼴로 자를 휘둘러 주변 적을 공격';
  maxLevel = 8;

  constructor(scene: GameScene, player: Player) {
    super(scene, player);
    this.baseStats = {
      damage: 16,
      cooldown: 750,
      area: 1,
      speed: 400,
      duration: 220,
      amount: 1,
      pierce: 20,
      knockback: 0,
    };
    this.levelUpgrades = [
      { damage: 4 },
      { area: 0.15 },
      { cooldown: -80 },
      { damage: 5 },
      { amount: 1 },
      { damage: 6 },
      { pierce: 10 },
    ];
  }

  attack(): void {
    const amount = this.getAmount();
    const targets = this.findClosestEnemies(amount);
    for (let i = 0; i < amount; i++) {
      const assigned = targets.length > 0 ? targets[i % targets.length] : null;
      this.scene.time.delayedCall(i * 180, () => {
        this.performSwing(assigned);
      });
    }
  }

  private performSwing(assigned: Phaser.Physics.Arcade.Sprite | null): void {
    // 지연 실행이라 player가 이미 파괴/리셋됐을 수 있음
    if (!this.player.active) return;

    // 배정 타겟이 죽었거나 없으면 발사 시점 최근접으로 폴백
    const target = assigned && assigned.active ? assigned : this.findClosestEnemy();
    let baseAngle: number;
    if (target) {
      baseAngle = Phaser.Math.Angle.Between(this.player.x, this.player.y, target.x, target.y);
    } else {
      const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
      baseAngle = playerBody.velocity.lengthSq() > 0 ? playerBody.velocity.angle() : 0;
    }
    this.createRulerSwing(baseAngle);
  }

  private createRulerSwing(baseAngle: number): void {
    const damage = this.getDamage();
    const pierce = this.getPierce();
    const area = this.getArea();
    const reach = 70 * area;
    const swingArc = Math.PI / 2;
    const swingDuration = this.getDuration();

    const startAngle = baseAngle - swingArc / 2;
    const ruler = this.scene.add.sprite(
      this.player.x + Math.cos(startAngle) * reach,
      this.player.y + Math.sin(startAngle) * reach,
      'weapon_ruler'
    );
    ruler.setScale(1.1 * area);
    ruler.setDepth(9);
    ruler.setRotation(startAngle + Math.PI / 2);

    this.scene.physics.add.existing(ruler);
    const body = ruler.body as Phaser.Physics.Arcade.Body;
    body.setSize(ruler.width * 0.6, ruler.height * 0.6);

    (ruler as any).damage = damage;
    (ruler as any).pierce = pierce;

    this.scene.addProjectile(ruler as any);

    // Impact sparks chained along the swing
    const hitMonsters = new Set<Phaser.Physics.Arcade.Sprite>();
    const fxCollider = this.scene.physics.add.overlap(ruler, this.scene.getMonsters(), (_r, monster) => {
      const m = monster as Phaser.Physics.Arcade.Sprite;
      if (hitMonsters.has(m)) return;
      hitMonsters.add(m);
      this.playImpact(m.x, m.y, 'hit_small');
    });
    ruler.once('destroy', () => fxCollider.destroy());

    // Afterimage ghosts (alpha decay)
    const spawnGhost = () => {
      if (!ruler.active) return;
      const ghost = this.scene.add.sprite(ruler.x, ruler.y, 'weapon_ruler');
      ghost.setScale(ruler.scaleX);
      ghost.setRotation(ruler.rotation);
      ghost.setAlpha(0.35);
      ghost.setDepth(8);
      this.scene.tweens.add({
        targets: ghost,
        alpha: 0,
        duration: 180,
        onComplete: () => ghost.destroy(),
      });
    };
    this.scene.time.delayedCall(swingDuration * 0.33, spawnGhost);
    this.scene.time.delayedCall(swingDuration * 0.66, spawnGhost);

    // 90-degree swing arc, pivoting around the player
    const swingState = { t: 0 };
    this.scene.tweens.add({
      targets: swingState,
      t: 1,
      duration: swingDuration,
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        if (!ruler.active) return;
        const currentAngle = startAngle + swingArc * swingState.t;
        ruler.x = this.player.x + Math.cos(currentAngle) * reach;
        ruler.y = this.player.y + Math.sin(currentAngle) * reach;
        ruler.setRotation(currentAngle + Math.PI / 2);
      },
      onComplete: () => {
        if (ruler.active) ruler.destroy();
      },
    });
  }
}
