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
    const endX = startX + Math.cos(baseAngle) * length;
    const endY = startY + Math.sin(baseAngle) * length;

    const drawDuration = segmentCount * drawInterval;
    // 새 에셋 3종은 생성 실패해도 게임이 깨지지 않도록 런타임에 존재 여부를 확인한다.
    const hasTrailTex = this.scene.textures.exists('trail_crayon_spectrum');

    // --- 트레일 시각: 스펙트럼 텍스처를 setCrop으로 "그려지듯" 노출 (딱딱한 6색 블록 폐기) ---
    // 텍스처가 있으면 판정 사각형은 숨기고 이 스프라이트가 시각을 전담한다.
    if (hasTrailTex) {
      const trail = this.scene.add.sprite(startX, startY, 'trail_crayon_spectrum');
      trail.setOrigin(0, 0.5); // 왼쪽(시작점)을 앵커로 → crop이 시작점에서 끝점으로 자라남
      trail.setRotation(baseAngle);
      const texW = trail.width;
      const texH = trail.height;
      trail.setScale(length / texW, (16 * area) / texH);
      trail.setAlpha(0.9);
      trail.setDepth(9);

      // 리빌: t(0→1)에 비례해 crop 폭을 넓혀 크레파스가 지나간 만큼만 보이게 (Rainbow.createSweep 패턴)
      const reveal = { t: 0 };
      this.scene.tweens.add({
        targets: reveal,
        t: 1,
        duration: drawDuration,
        ease: 'Linear',
        onUpdate: () => {
          if (!trail.active) return;
          trail.setCrop(0, 0, Math.round(reveal.t * texW), texH);
        },
        onComplete: () => this.placeSparkleDecals(startX, startY, baseAngle, length, area, duration),
      });

      // 수명이 다하면 페이드 아웃 후 제거 (허공 소멸 금지)
      this.scene.time.delayedCall(duration, () => {
        if (!trail.active) return;
        this.scene.tweens.add({
          targets: trail,
          alpha: 0,
          duration: 300,
          onComplete: () => trail.destroy(),
        });
      });
    } else {
      // 폴백(텍스처 없음): 사각형이 시각을 담당하되, 반짝임 데칼은 그릴 수 있으면 그린다.
      this.scene.time.delayedCall(drawDuration, () =>
        this.placeSparkleDecals(startX, startY, baseAngle, length, area, duration)
      );
    }

    // --- 크레파스 본체: 시작점→끝점으로 이동하며 그리는 연출 (손떨림 회전 yoyo) ---
    const bodyKey = this.scene.textures.exists('weapon_crayon_rainbow') ? 'weapon_crayon_rainbow' : 'weapon_crayon';
    const crayon = this.scene.add.sprite(startX, startY, bodyKey);
    crayon.setScale(1.0 * area);
    crayon.setAlpha(0);
    crayon.setDepth(10);
    crayon.setRotation(baseAngle + Math.PI / 4); // 비스듬히 쥔 느낌
    this.scene.tweens.add({ targets: crayon, alpha: 1, duration: 120, ease: 'Sine.easeOut' });
    // 손떨림: 미세한 회전 진동 (그리는 동안 반복, 본체 destroy 시 Phaser가 자동 정리)
    this.scene.tweens.add({
      targets: crayon,
      rotation: baseAngle + Math.PI / 4 + 0.15,
      duration: 90,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this.scene.tweens.add({
      targets: crayon,
      x: endX,
      y: endY,
      duration: drawDuration,
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
    // 팁 반짝임: 이동 중 크레파스 끝에서 주기적으로 collect 버스트
    this.scene.time.addEvent({
      delay: 90,
      repeat: Math.max(0, Math.floor(drawDuration / 90) - 1),
      callback: () => {
        if (crayon.active) this.playImpact(crayon.x, crayon.y, 'collect');
      },
    });

    // --- 히트판정: 세그먼트 사각형 (기존 메커니즘 유지) ---
    for (let i = 0; i < segmentCount; i++) {
      const distance = i * segmentLength;
      // 폴백 색: 하드코딩 6색 대신 스펙트럼 HSV 보간으로 자연스럽게 이어지게
      const color = hasTrailTex
        ? 0xffffff
        : Phaser.Display.Color.HSVToRGB((i / segmentCount) * 0.83, 0.85, 1).color;

      this.scene.time.delayedCall(i * drawInterval, () => {
        const x = startX + Math.cos(baseAngle) * (distance + segmentLength / 2);
        const y = startY + Math.sin(baseAngle) * (distance + segmentLength / 2);

        const segment = this.scene.add.rectangle(x, y, segmentLength, 12 * area, color, 0.9);
        segment.setRotation(baseAngle);
        segment.setDepth(9);
        if (hasTrailTex) segment.setVisible(false); // 텍스처 트레일이 시각 전담 → 판정만

        this.scene.physics.add.existing(segment);

        (segment as any).damage = damage / 2;
        (segment as any).pierce = 999;

        this.scene.addProjectile(segment as any);

        // 접촉 시 색 조각이 튀는 임팩트 (판정과 별개의 연출)
        const hitMonsters = new Set<Phaser.Physics.Arcade.Sprite>();
        const fxCollider = this.scene.physics.add.overlap(segment, this.scene.getMonsters(), (_s, monster) => {
          const m = monster as Phaser.Physics.Arcade.Sprite;
          if (hitMonsters.has(m)) return;
          hitMonsters.add(m);
          this.playImpact(m.x, m.y, 'collect');
        });
        segment.once('destroy', () => fxCollider.destroy());

        if (hasTrailTex) {
          // 시각은 트레일 스프라이트가 담당 → 사각형은 수명/판정만 유지하고 조용히 제거
          this.scene.time.delayedCall(duration + 200, () => {
            if (segment.active) segment.destroy();
          });
        } else {
          this.scene.tweens.add({
            targets: segment,
            alpha: 0,
            scaleY: 0.5,
            duration: duration,
            delay: 200,
            onComplete: () => segment.destroy(),
          });
        }
      });
    }
  }

  // 리빌 완료 시 트레일을 따라 4개의 반짝임 데칼(루프 애니메이션)을 흩뿌린다.
  // decal_crayon_sparkle 텍스처가 없으면 아무것도 하지 않는다(런타임 폴백).
  private placeSparkleDecals(
    startX: number,
    startY: number,
    baseAngle: number,
    length: number,
    area: number,
    lifespan: number
  ): void {
    const key = 'decal_crayon_sparkle';
    if (!this.scene.textures.exists(key)) return;
    const hasAnim = this.scene.anims.exists(key);

    for (let s = 0; s < 4; s++) {
      const frac = (s + 0.5) / 4;
      const sx = startX + Math.cos(baseAngle) * (length * frac);
      const sy = startY + Math.sin(baseAngle) * (length * frac);

      const sparkle = this.scene.add.sprite(sx, sy, key);
      sparkle.setDepth(10);
      sparkle.setAlpha(0.9);
      sparkle.setScale(area);
      if (hasAnim) sparkle.play(key);

      this.scene.time.delayedCall(lifespan, () => {
        if (!sparkle.active) return;
        this.scene.tweens.add({
          targets: sparkle,
          alpha: 0,
          duration: 300,
          onComplete: () => sparkle.destroy(),
        });
      });
    }
  }
}
