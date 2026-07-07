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
      damage: 25,
      cooldown: 7000,
      area: 1,
      speed: 0,
      duration: 1400, // 스윕 1회가 화면을 관통하는 데 걸리는 시간
      amount: 1, // 스윕 횟수
      pierce: 999,
      knockback: 0,
    };
    this.levelUpgrades = [
      { damage: 5 },
      { amount: 1 },
      { area: 0.2 },
      { damage: 8 },
      { amount: 1 },
      { cooldown: -1000 },
      { damage: 12 },
    ];
  }

  attack(): void {
    const amount = this.getAmount();
    for (let i = 0; i < amount; i++) {
      // 스윕마다 방향 교대(아래→위, 위→아래) + 300ms 시간차로 연속 파도 연출
      const dir = i % 2 === 0 ? -1 : 1;
      if (i === 0) {
        this.createSweep(dir);
      } else {
        this.scene.time.delayedCall(i * 300, () => this.createSweep(dir));
      }
    }
  }

  // 거대 무지개 아치가 화면 한쪽 끝에서 반대쪽으로 수직 스윕 (설계: 저빈도 초광역).
  // 가로는 카메라 폭 전체를 덮고 세로로 카메라 높이 + 파동 두께만큼 이동하므로
  // 화면 내 몬스터가 사실상 전부 파동을 통과하며 피격된다.
  // 수직 이동이라 회전이 필요 없어 Arcade AABB body가 아트와 그대로 일치.
  // dir: -1 = 아래에서 위로, +1 = 위에서 아래로
  private createSweep(dir: number): void {
    const damage = this.getDamage();
    const area = this.getArea();
    const duration = this.getDuration();
    const cam = this.scene.cameras.main;

    const sweepWidth = cam.width * 1.2; // 화면 폭 + 좌우 여유
    const bandHeight = 240 * area; // 파동 두께(시각 = 히트 밴드)

    // createProjectile은 균일 scale만 지원하므로 가로/세로 비균일 스케일이 필요한
    // 초광역 아치는 physics sprite 직접 생성 + addProjectile 경로 사용 (velocity 보존됨)
    const startY = this.player.y - dir * (cam.height / 2 + bandHeight);
    const wave = this.scene.physics.add.sprite(this.player.x, startY, 'weapon_rainbow');
    wave.setDepth(8);
    wave.setScale(sweepWidth / wave.width, bandHeight / wave.height);
    wave.setFlipY(dir > 0); // 아래로 쓸 때는 아치가 진행 방향을 향하도록 뒤집기

    // 히트박스를 표시 크기 전체에 명시적으로 맞춤 (스케일만으로는 body가 안 커지는 함정 방지).
    // setSize는 프레임 좌표계 기준이라 프레임 크기 그대로 = 스케일 곱해진 표시 영역 전체
    const body = wave.body as Phaser.Physics.Arcade.Body;
    body.setSize(wave.width, wave.height, true);

    // 이동: 화면 높이 + 파동 두께 2배를 duration 동안 관통
    const travel = cam.height + bandHeight * 2;
    wave.setVelocity(0, dir * (travel / (duration / 1000)));

    (wave as any).damage = damage;
    (wave as any).pierce = this.getPierce();
    this.attachImpactEffect(wave, 'collect');
    this.scene.addProjectile(wave);

    // 스폰 팝 대체: 알파 페이드 인, 종결은 화면 밖으로 빠지며 알파 페이드 아웃 (허공 소멸 금지)
    wave.setAlpha(0);
    this.scene.tweens.add({
      targets: wave,
      alpha: 0.9,
      duration: 150,
      ease: 'Sine.easeOut',
    });
    this.scene.tweens.add({
      targets: wave,
      alpha: 0,
      delay: duration - 250,
      duration: 250,
      ease: 'Sine.easeIn',
      onComplete: () => {
        if (wave.active) wave.destroy();
      },
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
