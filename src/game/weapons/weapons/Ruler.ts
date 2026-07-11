import Phaser from 'phaser';
import { WeaponBase } from '../WeaponBase';
import type { GameScene } from '../../scenes/GameScene';
import type { Player } from '../../entities/Player';

// 텔레그래프/슬램/잔류 타이밍 및 가로 밴드 판정 크기 (설계: 화면 가로 60%+ 를 덮는 자 내려치기, 좌우 랜덤 등장)
const SWEEP_WIDTH_RATIO = 0.7; // 카메라 폭 대비 밴드 길이 비율
const BAND_HEIGHT = 90; // 밴드 기본 두께 (×area로 스케일)
const TELEGRAPH_MS = 450;
const SLAM_MS = 180;
const LINGER_MS = 300;

export class Ruler extends WeaponBase {
  id = 'ruler';
  name = 'Ruler';
  nameKo = '자';
  description = 'Giant ruler slams down for area damage';
  descriptionKo = '거대한 자로 내려쳐 넓은 범위를 강타';
  maxLevel = 8;

  constructor(scene: GameScene, player: Player) {
    super(scene, player);
    this.baseStats = {
      damage: 100,
      cooldown: 30000,
      area: 1,
      speed: 0,
      duration: 0, // (미사용 스탯)
      amount: 1,
      pierce: 999,
      knockback: 0,
    };
    this.levelUpgrades = [
      { damage: 25 },
      { cooldown: -3000 },
      { area: 0.2 },
      { damage: 30 },
      { cooldown: -3000 },
      { area: 0.2 },
      { damage: 40, cooldown: -2000 },
    ];
  }

  attack(): void {
    const amount = this.getAmount();
    for (let i = 0; i < amount; i++) {
      this.scene.time.delayedCall(i * 400, () => {
        this.performSlam();
      });
    }
  }

  private performSlam(): void {
    // 지연 실행이라 player가 이미 파괴/리셋됐을 수 있음
    if (!this.player.active) return;
    // 정답 판정 등으로 씬이 이미 종료 처리된 경우 연출/판정 생성 방지
    if ((this.scene as any).gameFinished) return;

    // 밴드가 위치할 행(y)은 가장 강한 적 → 없으면 가장 가까운 적 → 없으면 플레이어 위치 순으로 결정
    const target = this.findToughestEnemy() ?? this.findClosestEnemy();
    const rowY = target ? target.y : this.player.y;

    this.createSlam(rowY);
  }

  private createSlam(rowY: number): void {
    const area = this.getArea();
    const cam = this.scene.cameras.main;
    const thickness = BAND_HEIGHT * area;

    // 밴드가 화면 안에 온전히 들어오도록 카메라 worldView 기준으로 y를 clamp
    const minY = cam.worldView.top + thickness / 2;
    const maxY = cam.worldView.bottom - thickness / 2;
    const bandY = Phaser.Math.Clamp(rowY, minY, maxY);

    // 밴드 x범위: 카메라 폭의 SWEEP_WIDTH_RATIO만큼, 중심은 카메라 중심
    const length = cam.worldView.width * SWEEP_WIDTH_RATIO;
    const centerX = cam.worldView.centerX;

    // 자가 등장하는 방향(좌/우) 랜덤 결정 — 슬램마다 독립적으로 재추첨
    const pivotLeft = Math.random() < 0.5;

    // 1. 텔레그래프: 밴드 전체를 덮는 사각형 페이드인 + 테두리 라인으로 낙하 위치 예고
    const telegraphRect = this.scene.add.rectangle(centerX, bandY, length, thickness, 0xffe066, 0);
    telegraphRect.setDepth(7);
    this.scene.tweens.add({
      targets: telegraphRect,
      fillAlpha: 0.22,
      duration: TELEGRAPH_MS,
      ease: 'Quad.easeOut',
    });

    const telegraphStroke = this.scene.add.rectangle(centerX, bandY, length, thickness, 0xffe066, 0);
    telegraphStroke.setStrokeStyle(4, 0xffe066, 0.9);
    telegraphStroke.setDepth(7);

    this.scene.time.delayedCall(TELEGRAPH_MS, () => {
      telegraphRect.destroy();
      telegraphStroke.destroy();
      this.sweepRuler(centerX, bandY, length, area, pivotLeft);
    });
  }

  private sweepRuler(centerX: number, bandY: number, length: number, area: number, pivotLeft: boolean): void {
    const hasGiant = this.scene.textures.exists('weapon_ruler_giant');
    // 피벗은 밴드의 좌/우 끝단 — 자가 그 지점에서 수평으로 내리쳐짐
    const pivotX = pivotLeft ? centerX - length / 2 : centerX + length / 2;

    const ruler = this.scene.add.sprite(pivotX, bandY, hasGiant ? 'weapon_ruler_giant' : 'weapon_ruler');
    ruler.setDepth(11);

    let startRotationDeg: number;
    let endRotationDeg: number;

    if (hasGiant) {
      // 세로로 긴 스프라이트: origin을 바닥(피벗)에 맞추고, 균일 스케일로 길이를 밴드 길이에 맞춤
      ruler.setOrigin(0.5, 1);
      const targetScale = length / ruler.height;
      ruler.setScale(targetScale);
      // 좌측 피벗=25도→90도, 우측 피벗=-25도→-90도 (쳐들었다가 수평으로 내리침)
      startRotationDeg = pivotLeft ? 25 : -25;
      endRotationDeg = pivotLeft ? 90 : -90;
    } else {
      // weapon_ruler 폴백: 가로로 눕혀진 작은 텍스처, 피벗쪽 끝을 origin으로 삼음
      ruler.setOrigin(pivotLeft ? 0 : 1, 0.5);
      ruler.setScale(length / ruler.width, (BAND_HEIGHT * area * 0.8) / ruler.height);
      startRotationDeg = pivotLeft ? -25 : 25;
      endRotationDeg = 0;
    }

    ruler.setRotation(Phaser.Math.DegToRad(startRotationDeg));

    // 2. 슬램: 쳐든 자세에서 수평으로 내리치는 회전 트윈
    this.scene.tweens.add({
      targets: ruler,
      rotation: Phaser.Math.DegToRad(endRotationDeg),
      duration: SLAM_MS,
      ease: 'Quad.easeIn',
      onComplete: () => this.onLand(ruler, centerX, bandY, length, area),
    });
  }

  // 3. 착지: 카메라 셰이크 + 사각 데미지존 + 임팩트 이펙트(3곳) + 흙먼지(밴드 전체 분산)
  private onLand(ruler: Phaser.GameObjects.Sprite, centerX: number, bandY: number, length: number, area: number): void {
    if (!ruler.active) return;

    this.scene.cameras.main.shake(250, 0.012);
    this.spawnDamageZone(centerX, bandY, length, area);

    // 밴드를 3등분한 지점(각 구간의 중심) 3곳에 임팩트 이펙트 재생
    const thirds = [centerX - length / 3, centerX, centerX + length / 3];
    for (const x of thirds) {
      this.playSlamFx(x, bandY);
    }

    this.spawnBandDust(centerX, bandY, length, BAND_HEIGHT * area);

    // 4. 자 잔류 후 페이드 아웃
    this.scene.time.delayedCall(LINGER_MS, () => {
      if (!ruler.active) return;
      this.scene.tweens.add({
        targets: ruler,
        alpha: 0,
        duration: 200,
        onComplete: () => ruler.destroy(),
      });
    });
  }

  private playSlamFx(tx: number, ty: number): void {
    if (this.scene.anims.exists('fx_ruler_slam') && this.scene.textures.exists('fx_ruler_slam')) {
      const fx = this.scene.add.sprite(tx, ty, 'fx_ruler_slam');
      fx.setDepth(12);
      fx.play('fx_ruler_slam');
      fx.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => fx.destroy());
    } else {
      // 폴백: 기본 임팩트 + 즉석 확장 링
      this.playImpact(tx, ty, 'hit_large');
      const fallbackRing = this.scene.add.circle(tx, ty, 20, 0xffffff, 0.6);
      fallbackRing.setDepth(12);
      this.scene.tweens.add({
        targets: fallbackRing,
        scale: 6,
        alpha: 0,
        duration: 300,
        ease: 'Quad.easeOut',
        onComplete: () => fallbackRing.destroy(),
      });
    }
  }

  private spawnBandDust(centerX: number, bandY: number, length: number, thickness: number): void {
    // 흙먼지 파티클을 밴드 전체 영역에 랜덤 분산 (8~10개)
    const count = 8 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      const x = centerX + (Math.random() - 0.5) * length;
      const y = bandY + (Math.random() - 0.5) * thickness;
      const angle = Math.random() * Math.PI * 2;
      const dist = 20 + Math.random() * 30;
      const dust = this.scene.add.circle(x, y, 4, 0x8a6d4c, 0.7);
      dust.setDepth(11);
      this.scene.tweens.add({
        targets: dust,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        alpha: 0,
        duration: 300,
        ease: 'Quad.easeOut',
        onComplete: () => dust.destroy(),
      });
    }
  }

  private spawnDamageZone(centerX: number, bandY: number, length: number, area: number): void {
    const damage = this.getDamage();
    const thickness = BAND_HEIGHT * area;

    const zone = this.scene.add.rectangle(centerX, bandY, length, thickness, 0xffe066, 0);
    zone.setDepth(1);
    this.scene.physics.add.existing(zone);
    const body = (zone as unknown as { body: Phaser.Physics.Arcade.Body }).body;
    body.setSize(length, thickness);

    (zone as any).damage = damage;
    (zone as any).pierce = 999;
    this.scene.addProjectile(zone as any);

    const hitMonsters = new Set<Phaser.Physics.Arcade.Sprite>();
    const overlap = this.scene.physics.add.overlap(zone, this.scene.getMonsters(), (_z, monster) => {
      const m = monster as Phaser.Physics.Arcade.Sprite;
      if (hitMonsters.has(m)) return;
      hitMonsters.add(m);
      this.playImpact(m.x, m.y, 'hit_large');
    });

    this.scene.time.delayedCall(150, () => {
      overlap.destroy();
      zone.destroy();
    });
  }
}
