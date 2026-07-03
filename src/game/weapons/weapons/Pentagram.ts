import { WeaponBase } from '../WeaponBase';
import type { GameScene } from '../../scenes/GameScene';
import type { Player } from '../../entities/Player';

export class Pentagram extends WeaponBase {
  id = 'pentagram';
  name = 'Pentagram';
  nameKo = '펜타그램';
  description = 'Erases everything on screen';
  descriptionKo = '화면의 모든 것을 지웁니다';
  maxLevel = 8;

  constructor(scene: GameScene, player: Player) {
    super(scene, player);
    this.baseStats = {
      damage: 999,
      cooldown: 20000,
      area: 1,
      speed: 0,
      duration: 500,
      amount: 1,
      pierce: 999,
      knockback: 0,
    };
    this.levelUpgrades = [
      { cooldown: -2000 },
      { cooldown: -2000 },
      { cooldown: -2000 },
      { cooldown: -2000 },
      { cooldown: -2000 },
      { cooldown: -2000 },
      { cooldown: -2000 },
    ];
  }

  attack(): void {
    const camera = this.scene.cameras.main;

    // Full screen pentagram effect
    const pentagram = this.scene.add.star(
      this.player.x,
      this.player.y,
      5,
      50,
      100,
      0xff0000,
      0.8
    );
    pentagram.setDepth(100);

    // Expand to fill screen
    this.scene.tweens.add({
      targets: pentagram,
      scale: 20,
      rotation: Math.PI * 2,
      alpha: 0,
      duration: 500,
      ease: 'Cubic.easeOut',
      onComplete: () => pentagram.destroy(),
    });

    // Screen flash
    const flash = this.scene.add.rectangle(
      camera.scrollX + camera.width / 2,
      camera.scrollY + camera.height / 2,
      camera.width * 2,
      camera.height * 2,
      0xff0000,
      0.5
    );
    flash.setDepth(99);

    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 300,
      onComplete: () => flash.destroy(),
    });

    // Kill all monsters on screen
    const monsters = this.scene.getMonsters();
    monsters.getChildren().forEach((monster) => {
      const m = monster as Phaser.Physics.Arcade.Sprite;
      if (!m.active) return;

      // Check if on screen
      if (
        m.x > camera.scrollX - 100 &&
        m.x < camera.scrollX + camera.width + 100 &&
        m.y > camera.scrollY - 100 &&
        m.y < camera.scrollY + camera.height + 100
      ) {
        (m as any).takeDamage?.(9999);
      }
    });
  }
}
