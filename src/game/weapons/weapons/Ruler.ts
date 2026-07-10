import Phaser from 'phaser';
import { WeaponBase } from '../WeaponBase';
import type { GameScene } from '../../scenes/GameScene';
import type { Player } from '../../entities/Player';

// 텔레그래프/낙하/잔류 타이밍 및 광역 판정 반경 (설계: 손오공 여의봉 내려치기)
const TELEGRAPH_MS = 450;
const FALL_MS = 150;
const LINGER_MS = 300;
const AOE_RADIUS = 150;
const DROP_HEIGHT = 300;

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
      duration: 300,
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

    const target = this.findToughestEnemy() ?? this.findClosestEnemy();
    let tx: number;
    let ty: number;
    if (target) {
      // target은 텔레그래프~낙하 도중 죽을 수 있으므로 좌표를 즉시 확정
      tx = target.x;
      ty = target.y;
    } else {
      const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
      const hasVelocity = playerBody.velocity.lengthSq() > 0;
      const angle = hasVelocity ? playerBody.velocity.angle() : 0;
      tx = this.player.x + Math.cos(angle) * 120;
      ty = this.player.y + Math.sin(angle) * 120;
    }

    this.createSlam(tx, ty);
  }

  private createSlam(tx: number, ty: number): void {
    const area = this.getArea();

    // 1. 텔레그래프: 축소하는 링 + 확대되는 그림자 타원으로 낙하지점 예고
    const ring = this.scene.add.circle(tx, ty, AOE_RADIUS * area, 0xffe066, 0);
    ring.setStrokeStyle(4, 0xffe066, 0.9);
    ring.setDepth(7);
    this.scene.tweens.add({
      targets: ring,
      scale: 0.15,
      duration: TELEGRAPH_MS,
      ease: 'Quad.easeIn',
    });

    const shadow = this.scene.add.ellipse(tx, ty, 20, 10, 0x000000, 0.35);
    shadow.setDepth(6);
    this.scene.tweens.add({
      targets: shadow,
      scaleX: (AOE_RADIUS * area * 1.6) / 20,
      scaleY: (AOE_RADIUS * area * 0.8) / 10,
      duration: TELEGRAPH_MS,
      ease: 'Quad.easeOut',
    });

    this.scene.time.delayedCall(TELEGRAPH_MS, () => {
      ring.destroy();
      shadow.destroy();
      this.dropRuler(tx, ty, area);
    });
  }

  private dropRuler(tx: number, ty: number, area: number): void {
    const hasGiant = this.scene.textures.exists('weapon_ruler_giant');
    const ruler = this.scene.add.sprite(tx, ty - DROP_HEIGHT, hasGiant ? 'weapon_ruler_giant' : 'weapon_ruler');
    ruler.setDepth(11);

    if (hasGiant) {
      // 세로로 긴 스프라이트의 아랫부분(끝)이 착지 지점이 되도록 origin 조정
      ruler.setOrigin(0.5, 1);
      const targetScale = (AOE_RADIUS * 1.6 * area) / ruler.height;
      ruler.setScale(targetScale);
      ruler.setRotation(-0.35);
    } else {
      // weapon_ruler 폴백: 눕혀진 자를 세워서 여의봉처럼 보이게
      ruler.setOrigin(0.5, 1);
      ruler.setRotation(-Math.PI / 4 - 0.35);
      ruler.setScale(1.6 * area);
    }

    // 2. 내려치기: 위에서 아래로 낙하
    this.scene.tweens.add({
      targets: ruler,
      y: ty,
      rotation: hasGiant ? 0 : -Math.PI / 4,
      duration: FALL_MS,
      ease: 'Quad.easeIn',
      onComplete: () => this.onLand(ruler, tx, ty, area),
    });
  }

  // 3. 착지: 임팩트 이펙트 + 카메라 셰이크 + 광역 데미지존
  private onLand(ruler: Phaser.GameObjects.Sprite, tx: number, ty: number, area: number): void {
    if (!ruler.active) return;

    this.playSlamFx(tx, ty);
    this.scene.cameras.main.shake(250, 0.01);
    this.spawnAoeZone(tx, ty, area);

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

    // 흙먼지 파티클
    for (let i = 0; i < 6; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 20 + Math.random() * 30;
      const dust = this.scene.add.circle(tx, ty, 4, 0x8a6d4c, 0.7);
      dust.setDepth(11);
      this.scene.tweens.add({
        targets: dust,
        x: tx + Math.cos(angle) * dist,
        y: ty + Math.sin(angle) * dist,
        alpha: 0,
        duration: 300,
        ease: 'Quad.easeOut',
        onComplete: () => dust.destroy(),
      });
    }
  }

  private spawnAoeZone(tx: number, ty: number, area: number): void {
    const damage = this.getDamage();
    const radius = AOE_RADIUS * area;

    const zone = this.scene.add.circle(tx, ty, radius, 0xffe066, 0);
    zone.setDepth(1);
    this.scene.physics.add.existing(zone);
    const body = (zone as unknown as { body: Phaser.Physics.Arcade.Body }).body;
    body.setCircle(radius);

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
