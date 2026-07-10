import { WeaponBase } from '../WeaponBase';
import type { GameScene } from '../../scenes/GameScene';
import type { Player } from '../../entities/Player';

export class PaperPlane extends WeaponBase {
  id = 'paper_plane';
  name = 'Paper Plane';
  nameKo = '종이비행기';
  description = 'Paper plane that explodes on impact';
  descriptionKo = '명중하면 폭발하는 종이비행기';
  maxLevel = 8;

  constructor(scene: GameScene, player: Player) {
    super(scene, player);
    this.baseStats = {
      damage: 30,
      cooldown: 2600,
      area: 1,
      speed: 250,
      duration: 4000,
      amount: 1,
      pierce: 1,
      knockback: 0,
    };
    this.levelUpgrades = [
      { damage: 8 },
      { area: 0.15 },
      { damage: 10 },
      { cooldown: -300 },
      { area: 0.2 },
      { damage: 12 },
      { amount: 1 },
    ];
  }

  attack(): void {
    const amount = this.getAmount();
    for (let i = 0; i < amount; i++) {
      this.scene.time.delayedCall(i * 150, () => {
        this.createPaperPlane();
      });
    }
  }

  private createPaperPlane(): void {
    // 컨셉: 장거리 활공 유도 — 가장 먼 적을 노려 근접 무기들과 역할을 분담
    const target = this.findFarthestEnemy() ?? this.findClosestEnemy();
    if (!target) return;

    const speed = this.getSpeed();
    const damage = this.getDamage();
    const pierce = this.getPierce();
    const area = this.getArea();

    // Use actual sprite
    const plane = this.scene.add.sprite(
      this.player.x,
      this.player.y,
      'weapon_paper_plane'
    );
    plane.setScale(1.0 * area);
    plane.setDepth(9);

    this.scene.physics.add.existing(plane);
    const body = plane.body as Phaser.Physics.Arcade.Body;
    body.setSize(plane.width * 0.8, plane.height * 0.8);

    // Spawn scale pop (0.7 -> 1.0)
    plane.setScale(1.0 * area * 0.7);
    this.scene.tweens.add({
      targets: plane,
      scale: 1.0 * area,
      duration: 80,
      ease: 'Sine.easeOut',
    });

    (plane as any).damage = damage;
    (plane as any).pierce = pierce;

    this.scene.addProjectile(plane as any);

    // 명중이든 수명종료든, 파괴되는 자리에서 폭발한다 (아래 explode() 참고)
    (plane as any).__exploded = false;
    plane.once('destroy', () => this.explode(plane));

    // Homing glide: sine-wave steering + banking roll
    const startTime = this.scene.time.now;
    const homingEvent = this.scene.time.addEvent({
      delay: 50,
      callback: () => {
        if (!plane.active || !target.active) {
          homingEvent.destroy();
          return;
        }
        const elapsed = this.scene.time.now - startTime;
        const baseAngle = Phaser.Math.Angle.Between(plane.x, plane.y, target.x, target.y);
        const sway = Math.sin(elapsed / 180) * 0.5;
        const moveAngle = baseAngle + sway;
        body.setVelocity(Math.cos(moveAngle) * speed, Math.sin(moveAngle) * speed);
        const bank = Math.sin(elapsed / 120) * 0.35;
        plane.setRotation(moveAngle + bank);
      },
      loop: true,
    });

    this.scene.time.delayedCall(this.getDuration(), () => {
      homingEvent.destroy();
      if (plane.active) plane.destroy(); // destroy 리스너(explode)가 공중폭발 처리
    });
  }

  // 명중 파괴(pierce 소진)든 수명 종료든, plane이 파괴되는 지점에서 스플래시 폭발.
  // 게임 리셋/그만하기(gameFinished 구간)로 인한 그룹 일괄 destroy는 폭발 금지 —
  // player.active만으로는 부족: resetGame()이 projectiles.clear()를 old player.destroy()보다
  // 먼저 실행하므로 그 시점엔 player.active가 아직 true. gameFinished는 handleGameOver()에서
  // true로 세워져 resetGame() 후반부(엔티티 정리 이후)에야 false로 복구되므로 이 구간을 정확히 덮는다.
  private explode(plane: Phaser.GameObjects.Sprite): void {
    if ((plane as any).__exploded) return;
    (plane as any).__exploded = true;
    if (!this.player.active || (this.scene as any).gameFinished) return;

    const area = this.getArea();
    this.playImpact(plane.x, plane.y, 'plane_explosion');

    const zone = this.scene.add.circle(plane.x, plane.y, 70 * area, 0xffa500, 0); // 판정 전용(투명)
    this.scene.physics.add.existing(zone);
    (zone as any).damage = Math.round(this.getDamage() * 0.7); // 스플래시 = 본데미지의 70%
    (zone as any).pierce = 999;
    this.scene.addProjectile(zone as any);
    this.scene.time.delayedCall(250, () => {
      if (zone.active) zone.destroy();
    });
  }
}
