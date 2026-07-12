import { WeaponBase } from '../WeaponBase';
import type { GameScene } from '../../scenes/GameScene';
import type { Player } from '../../entities/Player';

export class Rainbow extends WeaponBase {
  id = 'rainbow';
  name = 'Rainbow';
  nameKo = '무지개';
  description = 'Giant rainbow sweeps across the whole screen';
  descriptionKo = '거대한 무지개가 화면 전체를 쓸어버린다';
  maxLevel = 8;

  constructor(scene: GameScene, player: Player) {
    super(scene, player);
    // 컨셉: 저빈도 광역 "궁극기" — 자주 안 나가는 대신 발동 시 화면 대부분을 타격
    this.baseStats = {
      damage: 70,
      cooldown: 30000,
      area: 1,
      speed: 0,
      duration: 1400, // 스윕 1회가 화면을 관통하는 데 걸리는 시간
      amount: 1, // 스윕 횟수
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
      // 스윕마다 방향 교대(좌→우, 우→좌) + 300ms 시간차로 연속 파도 연출. 첫 스윕은 항상 좌→우.
      const dir = i % 2 === 0 ? 1 : -1; // +1 = 좌→우, -1 = 우→좌
      if (i === 0) {
        this.createSweep(dir);
      } else {
        this.scene.time.delayedCall(i * 300, () => this.createSweep(dir));
      }
    }
  }

  // 거대 무지개 아치가 화면 위에 "닦아내듯" 좌→우(또는 우→좌)로 그려지는 연출
  // (설계: 저빈도 초광역, wipe/paint reveal — 날아오는 게 아니라 제자리에서 그려짐).
  //
  // 시각(wave): 풀프레임(1:1) weapon_rainbow_sweep 아트를 **균등(cover) 스케일**로 화면에
  // 고정 배치한다 — 이전의 비균등 스트레치(X/Y 별도 배율)는 도트를 세로로 뭉개 픽셀아트가
  // 완전히 깨졌다. 균등 배율 하나로 카메라를 덮으면(넘치는 부분은 화면 밖) 도트가 항상
  // 정사각으로 유지된다. 스프라이트 자체는 이동하지 않고, setCrop으로 노출 영역만
  // 점진적으로 넓혀 "그려지는" 느낌을 만든다.
  // setCrop 좌표는 스케일이 적용되기 전 텍스처(프레임) 좌표계 기준이므로, wave.width/height
  // (원본 프레임 크기)를 그대로 fullWidth/fullHeight로 사용해 변환한다.
  // - dir>0(좌→우): 왼쪽 끝(x=0)을 고정하고 crop 폭만 키움 → 왼쪽이 앵커, 오른쪽으로 자라남.
  // - dir<0(우→좌): crop.x = fullWidth - revealWidth로 줄여가며 폭을 키움 → 오른쪽이 앵커,
  //   왼쪽으로 자라남 (setCrop(x, 0, w, h)에서 x가 줄고 w가 느는 형태).
  //
  // 피격(frontier): 화면에는 안 보이는 얇은 세로 히트박스가 리빌 경계선과 정확히 같은
  // 속도로 좌→우(또는 우→좌)로 이동하며, 기존 데미지/관통(pierce 999)/__hitMonsters
  // 메커니즘(addProjectile 경로)을 그대로 사용한다. 시각과 분리했기 때문에 스케일이
  // 균일(1)해도 되고, 회전된 아트용으로 썼던 body 오프셋 역산이 필요 없어진다.
  // dir: +1 = 왼쪽에서 오른쪽으로, -1 = 오른쪽에서 왼쪽으로
  private createSweep(dir: number): void {
    const damage = this.getDamage();
    const area = this.getArea();
    const duration = this.getDuration();
    const cam = this.scene.cameras.main;

    const sweepHeight = cam.height * 0.9; // 카메라 높이의 90%
    const frontierWidth = 120 * area; // 히트 프론티어 두께(이전 버전의 파동 두께 역할, 범위 업그레이드 반영)

    // --- 시각: 카메라 앵커 위치에 고정 배치, 이동 없이 crop만 넓혀간다 ---
    // 풀프레임 커튼 아트(1:1) 우선, 없으면 기존 아치(도감 아이콘용 16:9)로 폴백
    const texKey = this.scene.textures.exists('weapon_rainbow_sweep') ? 'weapon_rainbow_sweep' : 'weapon_rainbow';
    const wave = this.scene.add.sprite(this.player.x, this.player.y, texKey);
    wave.setDepth(8);
    // 균등 cover 스케일: 도트 정사각 유지가 최우선 — 큰 쪽 배율 하나로 화면을 덮는다
    const coverScale = Math.max(cam.width / wave.width, sweepHeight / wave.height);
    wave.setScale(coverScale);
    wave.setAlpha(0);

    const fullWidth = wave.width; // 텍스처 좌표계 기준 원본 프레임 크기 (스케일 적용 전)
    const fullHeight = wave.height;

    // 스폰 팝 대체: 알파 페이드 인 (허공 등장/소멸 금지 규칙)
    this.scene.tweens.add({
      targets: wave,
      alpha: 0.9,
      duration: 150,
      ease: 'Sine.easeOut',
    });

    // 리빌 진행: t(0→1)에 비례해 crop 폭을 넓혀 "그려지는" 연출을 만든다.
    const revealState = { t: 0 };
    this.scene.tweens.add({
      targets: revealState,
      t: 1,
      duration,
      ease: 'Linear',
      onUpdate: () => {
        if (!wave.active) return;
        const revealWidth = Math.max(1, Math.round(revealState.t * fullWidth));
        if (dir > 0) {
          wave.setCrop(0, 0, revealWidth, fullHeight);
        } else {
          wave.setCrop(fullWidth - revealWidth, 0, revealWidth, fullHeight);
        }
      },
      onComplete: () => {
        // 완전히 그려진 상태로 잠깐 유지 후 페이드 아웃
        this.scene.time.delayedCall(300, () => {
          this.scene.tweens.add({
            targets: wave,
            alpha: 0,
            duration: 250,
            ease: 'Sine.easeIn',
            onComplete: () => {
              if (wave.active) wave.destroy();
            },
          });
        });
      },
    });

    // --- 피격: 리빌 경계선을 그대로 따라가는 투명 히트박스 ---
    const leftBound = this.player.x - cam.width / 2;
    const rightBound = this.player.x + cam.width / 2;
    const frontier = this.scene.physics.add.sprite(dir > 0 ? leftBound : rightBound, this.player.y, 'weapon_rainbow');
    frontier.setVisible(false);
    // 프론티어는 스케일 1(안 보이는 판정 전용)이라 setSize에 원하는 world 단위 크기를
    // 그대로 넘기면 프레임 실제 크기와 무관하게 스프라이트 중심에 정확히 맞춰진다.
    const body = frontier.body as Phaser.Physics.Arcade.Body;
    body.setSize(frontierWidth, sweepHeight, true);
    // 리빌과 정확히 같은 속도로 이동해야 "경계선이 그려지는 순간 피격"이 성립
    const travelSpeed = cam.width / (duration / 1000);
    frontier.setVelocity(dir * travelSpeed, 0);

    (frontier as any).damage = damage;
    (frontier as any).pierce = this.getPierce();
    this.attachImpactEffect(frontier, 'collect');
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
