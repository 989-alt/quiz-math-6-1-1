import Phaser from 'phaser';
import { WeaponBase } from '../WeaponBase';
import type { GameScene } from '../../scenes/GameScene';
import type { Player } from '../../entities/Player';

export class PaperStorm extends WeaponBase {
  id = 'paper_storm';
  name = 'Paper Storm';
  nameKo = '쪽지시험 폭풍';
  description = 'A storm of quiz papers sweeps the whole screen';
  descriptionKo = '쪽지시험지 회오리가 화면 전체를 휩쓴다';
  maxLevel = 8;

  constructor(scene: GameScene, player: Player) {
    super(scene, player);
    // 컨셉: 저빈도 광역 "궁극기" — 자주 안 나가는 대신 발동 시 화면 대부분을 타격
    // (무지개 폐기: 고정 풀스크린 아트가 화면비마다 왜곡됨 → 시험지 낱장 스웜으로 대체해
    // 화면비 문제를 원천 차단. 밸런스 프로필은 무지개와 동일 유지)
    this.baseStats = {
      damage: 70,
      cooldown: 30000,
      area: 1,
      speed: 0,
      duration: 1600, // 폭풍 1웨이브가 화면을 관통하는 데 걸리는 시간
      amount: 1, // 웨이브 횟수
      pierce: 999,
      knockback: 0,
    };
    this.levelUpgrades = [
      { damage: 15 },
      { amount: 1 },
      { cooldown: -3000 },
      { damage: 20 },
      { amount: 1 },
      { cooldown: -3000 },
      { damage: 25 },
    ];
  }

  attack(): void {
    const amount = this.getAmount();
    for (let i = 0; i < amount; i++) {
      // 웨이브마다 방향 교대(좌→우, 우→좌) + 400ms 시간차로 연속 폭풍 연출. 첫 웨이브는 항상 좌→우.
      const dir = i % 2 === 0 ? 1 : -1; // +1 = 좌→우, -1 = 우→좌
      if (i === 0) {
        this.createStorm(dir);
      } else {
        this.scene.time.delayedCall(i * 400, () => this.createStorm(dir));
      }
    }
  }

  // 쪽지시험지 낱장 수십 장이 회오리처럼 화면 한쪽에서 반대쪽으로 휩쓸고 지나가는 연출.
  //
  // 시각(스웜): 화면 높이에 비례한 수의 시험지 스프라이트를 진입측 화면 밖에 랜덤 배치하고,
  // 각자 트윈으로 반대편 화면 밖까지 이동시킨다. 고정 풀프레임 아트가 아니라 개별 스프라이트라
  // 화면비가 달라져도 왜곡되지 않는다(무지개의 근본 문제 해결).
  //
  // 피격(frontier): 무지개 createSweep에서 검증된 패턴을 그대로 재사용 — 화면에는 안 보이는
  // 얇은 세로 히트박스가 진입측에서 반대편으로 스웜과 같은 속도로 이동하며, 기존
  // 데미지/관통(pierce 999)/__hitMonsters 메커니즘(addProjectile 경로)을 그대로 사용한다.
  // dir: +1 = 왼쪽에서 오른쪽으로, -1 = 오른쪽에서 왼쪽으로
  private createStorm(dir: number): void {
    if (!this.player.active || (this.scene as any).gameFinished) return;

    const damage = this.getDamage();
    const area = this.getArea();
    const duration = this.getDuration();
    const cam = this.scene.cameras.main;

    const sweepHeight = cam.height * 0.9; // 카메라 높이의 90%
    const frontierWidth = 120 * area; // 히트 프론티어 두께(범위 업그레이드 반영)
    const texKey = this.scene.textures.exists('weapon_paper_storm') ? 'weapon_paper_storm' : 'weapon_pencil';

    // --- 시각: 시험지 낱장 스웜 ---
    const sheetCount = Math.max(24, Math.ceil(cam.height / 34));
    for (let s = 0; s < sheetCount; s++) {
      this.scene.time.delayedCall(Math.random() * 400, () => {
        if (!this.player.active || (this.scene as any).gameFinished) return;

        const entryOffset = 60 + Math.random() * 80; // 60~140px
        const startX = dir > 0 ? this.player.x - cam.width / 2 - entryOffset : this.player.x + cam.width / 2 + entryOffset;
        const endX = dir > 0 ? this.player.x + cam.width / 2 + 60 : this.player.x - cam.width / 2 - 60;
        const y = this.player.y - sweepHeight / 2 + Math.random() * sweepHeight;

        const sheet = this.scene.add.sprite(startX, y, texKey);
        sheet.setDepth(8);
        sheet.setScale((0.8 + Math.random() * 0.5) * area);
        sheet.setFlipX(Math.random() < 0.5);
        sheet.setAlpha(0);

        // 스폰 팝 대체: 알파 페이드 인 (허공 등장/소멸 금지 규칙)
        this.scene.tweens.add({
          targets: sheet,
          alpha: 0.95,
          duration: 120,
          ease: 'Sine.easeOut',
        });

        // 팔랑임: 회전 왕복 트윈
        this.scene.tweens.add({
          targets: sheet,
          angle: Phaser.Math.Between(-40, 40),
          duration: 300 + Math.random() * 200,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });

        // 이동: 진입측 화면 밖 → 반대편 화면 밖까지 선형 이동 후 소멸
        this.scene.tweens.add({
          targets: sheet,
          x: endX,
          duration: duration * (0.75 + Math.random() * 0.4),
          ease: 'Linear',
          onComplete: () => {
            if (sheet.active) sheet.destroy();
          },
        });
      });
    }

    // --- 피격: 스웜과 같은 속도로 이동하는 투명 히트박스 (무지개 frontier 패턴 재사용) ---
    const leftBound = this.player.x - cam.width / 2;
    const rightBound = this.player.x + cam.width / 2;
    const frontier = this.scene.physics.add.sprite(dir > 0 ? leftBound : rightBound, this.player.y, texKey);
    frontier.setVisible(false);
    const body = frontier.body as Phaser.Physics.Arcade.Body;
    body.setSize(frontierWidth, sweepHeight, true);
    const travelSpeed = cam.width / (duration / 1000);
    frontier.setVelocity(dir * travelSpeed, 0);

    (frontier as any).damage = damage;
    (frontier as any).pierce = this.getPierce();
    this.attachImpactEffect(frontier, 'hit_small');
    this.scene.addProjectile(frontier);

    this.scene.time.delayedCall(duration, () => {
      if (frontier.active) frontier.destroy();
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
