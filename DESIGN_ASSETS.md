# Quiz Math 6-1-1 - Asset Inventory

Assets are organized across `public/assets/` subdirectories. Core game assets (character animations, monsters, weapons with variations, effects, decorations) reside in `public/assets/generated/`; specialized categories have mirrors in dedicated folders for organization.

## 🎮 Player Character
| Asset | Location | Description | Status |
|-------|----------|-------------|--------|
| hero_idle_strip | generated/ | Standing pose (4-frame strip) | ✅ Present |
| hero_walk_strip | generated/ | Walking animation (4-frame strip) | ✅ Present |
| hero_death_strip | generated/ | Death animation (4-frame strip) | ✅ Present |
| hero_hurt | generated/ | Damage flash frame | ✅ Present |
| player_* | character/ | Individual sprite frames (player_idle.png, player_walk_1.png, player_dead.png) | ✅ Present |

## 👾 Monsters

### Slimes (4 types × 2 animation frames each)
| Variant | Location | Description | Status |
|---------|----------|-------------|--------|
| slime_blue + walk_strip | generated/ | Blue slime with walk animation | ✅ Present |
| slime_green + walk_strip | generated/ | Green slime with walk animation | ✅ Present |
| slime_red + walk_strip | generated/ | Red slime with walk animation | ✅ Present |
| slime_elite + walk_strip | generated/ | Elite slime with walk animation | ✅ Present |

### Common Enemies (8 types × 2 animation frames each)
| Variant | Location | Description | Status |
|---------|----------|-------------|--------|
| monster_badger + walk_strip | generated/ | Badger with walk animation | ✅ Present |
| monster_bat + walk_strip | generated/ | Bat with walk animation | ✅ Present |
| monster_boar + walk_strip | generated/ | Boar with walk animation | ✅ Present |
| monster_crow + walk_strip | generated/ | Crow with walk animation | ✅ Present |
| monster_fox + walk_strip | generated/ | Fox with walk animation | ✅ Present |
| monster_ghost + walk_strip | generated/ | Ghost with walk animation | ✅ Present |
| monster_wasp + walk_strip | generated/ | Wasp with walk animation | ✅ Present |
| monster_wolf + walk_strip | generated/ | Wolf with walk animation | ✅ Present |

### Elite Enemies (3 types × 2 animation frames each)
| Variant | Location | Description | Status |
|---------|----------|-------------|--------|
| monster_elite_knight + walk_strip | generated/ | Knight with walk animation | ✅ Present |
| monster_elite_mage + walk_strip | generated/ | Mage with walk animation | ✅ Present |
| monster_elite_crowned + walk_strip | generated/ | Crowned elite with walk animation | ✅ Present |

### Bosses (5 types × 3 animation frames each)
| Boss | Location | Frames | Status |
|------|----------|--------|--------|
| boss_slime_king | generated/ | idle_strip, walk_strip, telegraph | ✅ Present |
| boss_orc_chief | generated/ | idle_strip, walk_strip, telegraph | ✅ Present |
| boss_golem | generated/ | idle_strip, walk_strip, telegraph | ✅ Present |
| boss_giant_bat | generated/ | idle_strip, walk_strip, telegraph | ✅ Present |
| boss_ghost_lord | generated/ | idle_strip, walk_strip, telegraph | ✅ Present |
| boss_warning_banner | generated/ | Boss approach warning visual | ✅ Present |

**Legacy note:** `monster/` folder contains simplified alternate versions (monster_1–15.png, boss_1–5.png) from an earlier asset iteration.

## ⚔️ Weapons (20 types)

All weapons have two forms: weapon sprite (`public/assets/weapon/` + `generated/`) and card artwork (`generated/card_*.png`).

| Weapon | Location | Card | Status |
|--------|----------|------|--------|
| banana | weapon/, generated/ | card_banana | ✅ Present |
| acorn | weapon/, generated/ | card_acorn | ✅ Present |
| pencil | weapon/, generated/ | card_pencil | ✅ Present |
| paper_plane | weapon/, generated/ | card_paper_plane | ✅ Present |
| marble | weapon/, generated/ | card_marble | ✅ Present |
| snowball | weapon/, generated/ | card_snowball | ✅ Present |
| leaf | weapon/, generated/ | card_leaf | ✅ Present |
| ruler | weapon/, generated/ | card_ruler | ✅ Present |
| eraser | weapon/, generated/ | card_eraser | ✅ Present |
| crayon | weapon/, generated/ | card_crayon | ✅ Present |
| lunch_box | weapon/, generated/ | card_lunch_box | ✅ Present |
| bubble | weapon/, generated/ | card_bubble | ✅ Present |
| water_balloon | weapon/, generated/ | card_water_balloon | ✅ Present |
| hamster | weapon/, generated/ | card_hamster | ✅ Present |
| butterfly | weapon/, generated/ | card_butterfly | ✅ Present |
| robot_toy | weapon/, generated/ | card_robot_toy | ✅ Present |
| rainbow | weapon/, generated/ | card_rainbow | ✅ Present |
| star | weapon/, generated/ | card_star | ✅ Present |
| magnet | weapon/, generated/ | card_magnet | ✅ Present |
| magnifying_glass | weapon/, generated/ | card_magnifying_glass | ✅ Present |

## 💎 Collectibles & Pickups
| Asset | Location | Description | Status |
|-------|----------|-------------|--------|
| xp_gem_small | generated/, gem/ | Small XP drop (1–5 value) | ✅ Present |
| xp_gem_mid | generated/, gem/ | Medium XP drop (10–25 value) | ✅ Present |
| xp_gem_large | generated/, gem/ | Large XP drop (50+ value) | ✅ Present |
| gem_health | generated/, gem/ | Health restore pickup | ✅ Present |
| magnet_item | generated/ | Attract all nearby gems | ✅ Present |
| heal_heart | generated/ | Heart recovery | ✅ Present |
| heal_potion | generated/ | Potion pickup | ✅ Present |
| shadow_blob | generated/ | Ground shadow under entities | ✅ Present |

## ✨ Effects
| Asset | Location | Frames | Description | Status |
|-------|----------|--------|-------------|--------|
| fx_hit_spark_small_strip | generated/ | 4 | Small impact spark | ✅ Present |
| fx_hit_spark_big_strip | generated/ | 4 | Large impact spark | ✅ Present |
| fx_death_poof_strip | generated/ | 4 | Monster death poof | ✅ Present |
| fx_collect_strip | generated/ | 3 | Gem collection sparkle | ✅ Present |
| fx_levelup_strip | generated/ | 8 | Level up burst | ✅ Present |
| fx_heal_strip | generated/ | 4 | Healing sparkle | ✅ Present |
| fx_explosion_strip | generated/ | 4 | Explosion | ✅ Present |
| fx_splash_strip | generated/ | 4 | Water splash | ✅ Present |
| fx_burn_strip | generated/ | 4 | Burn effect | ✅ Present |

## 🖼️ Backgrounds & Environment
| Asset | Location | Description | Status |
|-------|----------|-------------|--------|
| fantasy_pixel.png | background/ | Pixel art game background | ✅ Present |
| ground_tile.png | generated/ | Repeating tile floor | ✅ Present |
| keyart_home.png | generated/ | Home screen artwork | ✅ Present |
| deco_bush | generated/ | Bush decoration | ✅ Present |
| deco_crystals | generated/ | Crystal formation decoration | ✅ Present |
| deco_fallen_log | generated/ | Fallen log decoration | ✅ Present |
| deco_flower_bush | generated/ | Flower bush decoration | ✅ Present |
| deco_mushrooms | generated/ | Mushroom cluster decoration | ✅ Present |
| deco_pond | generated/ | Pond decoration | ✅ Present |
| deco_rock | generated/ | Rock decoration | ✅ Present |
| deco_rune_stone | generated/ | Rune stone decoration | ✅ Present |
| deco_signpost | generated/ | Signpost decoration | ✅ Present |
| deco_stump | generated/ | Tree stump decoration | ✅ Present |

## 🎨 UI Elements
| Component | Method | Status |
|-----------|--------|--------|
| HP bar | CSS gradient | ✅ CSS-based |
| XP bar | CSS gradient | ✅ CSS-based |
| Buttons | CSS styling | ✅ CSS-based |
| Upgrade cards | CSS styling | ✅ CSS-based |
| Badge indicators | CSS styling | ✅ CSS-based |

(No image files needed; all UI rendered via React + Tailwind/CSS.)

## 🔊 Audio
| Asset | Location | Type | Description | Status |
|-------|----------|------|-------------|--------|
| bgm.mp3 | audio/ | Music | Gameplay background music | ✅ Present |
| levelup.wav | audio/ | SFX | Level up sound | ✅ Present |
| monster_die.mp3 | audio/ | SFX | Monster death sound | ✅ Present |
| monster_hit.mp3 | audio/ | SFX | Monster hit sound | ✅ Present |
| player_hit.mp3 | audio/ | SFX | Player damage sound | ✅ Present |
| pickup.wav | audio/ | SFX | Gem collection sound | ✅ Present |
| quiz_correct.wav | audio/ | SFX | Correct answer sound | ✅ Present |
| quiz_wrong.wav | audio/ | SFX | Wrong answer sound | ✅ Present |

## Summary
- ✅ **Player character:** 4 animation frames (idle, walk, death, hurt) in `generated/` + individual sprite frames in `character/`
- ✅ **Monsters:** 15 base types + 5 bosses, all with idle/walk/telegraph animations in `generated/`
- ✅ **Weapons:** 20 kid-friendly weapons with card artworks, sprites in `weapon/` + `generated/`
- ✅ **Collectibles & effects:** All 9 effect animations + 8 pickup types
- ✅ **Environment:** Ground tile, 10 decorations, home screen art in `generated/`
- ✅ **Audio:** 8 tracks (1 BGM + 7 SFX) in `audio/`
- ✅ **UI:** CSS-based (no image dependencies)
