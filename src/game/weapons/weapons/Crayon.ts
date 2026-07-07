import Phaser from 'phaser';
import { WeaponBase } from '../WeaponBase';
import type { GameScene } from '../../scenes/GameScene';
import type { Player } from '../../entities/Player';

// 선이 지나갈 수 있는 방향: 가로 / 대각선 / 세로 / 역대각선 (사용자 확정 컨셉)
const LINE_ANGLES = [0, Math.PI / 4, Math.PI / 2, (Math.PI * 3) / 4];

export class Crayon extends WeaponBase {
  id = 'crayon';
  name = 'Crayon';
  nameKo = '크레파스';
  description = 'Draws a long rainbow line across the map';
  descriptionKo = '맵을 길게 가로지르는 무지개 선을 긋는 크레파스';
  maxLevel = 8;

  private colors = [0xff0000, 0xff7f00, 0xffff00, 0x00ff00, 0x0000ff, 0x8b00ff];

  constructor(scene: GameScene, player: Player) {
    super(scene, player);
    this.baseStats = {
      damage: 15,
      cooldown: 2500, // 맵 전체를 긋는 강한 선이라 저빈도
      area: 1,
      speed: 300,
      duration: 2000,
      amount: 1,
      pierce: 999,
      knockback: 0,
    };
    this.levelUpgrades = [
      { damage: 4 },
      { area: 0.1 },
      { amount: 1 },
      { damage: 5 },
      { duration: 100 },
      { damage: 6 },
      { amount: 1 },
    ];
  }

  attack(): void {
    const amount = this.getAmount();
    // 방향 중복 없이 랜덤 추첨 (amount ≥ 2면 서로 다른 방향으로 긋기)
    const shuffled = Phaser.Utils.Array.Shuffle([...LINE_ANGLES]);
    for (let i = 0; i < amount; i++) {
      const angle = shuffled[i % shuffled.length];
      this.scene.time.delayedCall(i * 250, () => {
        this.createCrayonLine(angle);
      });
    }
  }

  // 화면(카메라 뷰)을 끝에서 끝까지 가로지르는 긴 무지개 선을 긋는다.
  // 선은 플레이어 근처(수직 오프셋 ±80px)를 지나며, 크레용 본체가 시작점→끝점으로
  // 이동하면서 그리는 연출. 세그먼트 데칼은 duration 동안 잔존하며 지속 데미지.
  private createCrayonLine(baseAngle: number): void {
    if (!this.player.active) return;

    const damage = this.getDamage();
    const area = this.getArea();
    const duration = this.getDuration();
    const cam = this.scene.cameras.main;

    // 화면 대각선보다 길게 — 어느 방향이든 화면을 완전히 관통
    const length = Math.hypot(cam.width, cam.height) * 1.1;
    const segmentLength = 44;
    const segmentCount = Math.ceil(length / segmentLength);
    const drawInterval = 16; // 세그먼트당 그리기 간격(ms) — 전체 ~0.6s

    // 선이 플레이어 근처를 지나도록 수직 방향 랜덤 오프셋
    const perp = baseAngle + Math.PI / 2;
    const offset = Phaser.Math.FloatBetween(-80, 80);
    const centerX = this.player.x + Math.cos(perp) * offset;
    const centerY = this.player.y + Math.sin(perp) * offset;
    const startX = centerX - Math.cos(baseAngle) * (length / 2);
    const startY = centerY - Math.sin(baseAngle) * (length / 2);

    // 궤적을 그리는 크레용 본체: 시작점에서 끝점까지 이동하며 그리는 연출
    const crayon = this.scene.add.sprite(startX, startY, 'weapon_crayon');
    crayon.setScale(0.7 * area);
    crayon.setDepth(10);
    crayon.setRotation(baseAngle + Math.PI / 4); // 비스듬히 쥔 느낌
    this.scene.tweens.add({
      targets: crayon,
      x: startX + Math.cos(baseAngle) * length,
      y: startY + Math.sin(baseAngle) * length,
      duration: segmentCount * drawInterval,
      ease: 'Linear',
      onComplete: () => {
        // 다 그리면 살짝 튀어오르며 사라짐
        this.scene.tweens.add({
          targets: crayon,
          alpha: 0,
          scale: 0.4 * area,
          duration: 150,
          onComplete: () => crayon.destroy(),
        });
      },
    });

    for (let i = 0; i < segmentCount; i++) {
      const color = this.colors[i % this.colors.length];
      const distance = i * segmentLength;

      this.scene.time.delayedCall(i * drawInterval, () => {
        const x = startX + Math.cos(baseAngle) * (distance + segmentLength / 2);
        const y = startY + Math.sin(baseAngle) * (distance + segmentLength / 2);

        const segment = this.scene.add.rectangle(
          x, y,
          segmentLength,
          12 * area,
          color,
          0.9
        );
        segment.setRotation(baseAngle);
        segment.setDepth(9);

        this.scene.physics.add.existing(segment);

        (segment as any).damage = damage / 2;
        (segment as any).pierce = 999;

        this.scene.addProjectile(segment as any);

        // Rainbow decal persists on the trajectory, sparking color shards on contact
        const hitMonsters = new Set<Phaser.Physics.Arcade.Sprite>();
        const fxCollider = this.scene.physics.add.overlap(segment, this.scene.getMonsters(), (_s, monster) => {
          const m = monster as Phaser.Physics.Arcade.Sprite;
          if (hitMonsters.has(m)) return;
          hitMonsters.add(m);
          this.playImpact(m.x, m.y, 'collect');
        });
        segment.once('destroy', () => fxCollider.destroy());

        this.scene.tweens.add({
          targets: segment,
          alpha: 0,
          scaleY: 0.5,
          duration: duration,
          delay: 200,
          onComplete: () => segment.destroy(),
        });
      });
    }
  }
}
