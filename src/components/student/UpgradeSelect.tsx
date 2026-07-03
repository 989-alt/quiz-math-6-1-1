import type { UpgradeOption } from '../../types/game';

interface UpgradeSelectProps {
  upgrades: UpgradeOption[];
  onSelect: (type: string, id: string) => void;
}

/** 카드 아이콘 (임시 이모지 — Phase 3B에서 픽셀아트 아이콘으로 교체 예정) */
const CARD_ICONS: Record<string, string> = {
  // 무기 20종
  pencil: '✏️', banana: '🍌', acorn: '🌰', paper_plane: '🛩️', marble: '🔮',
  snowball: '⛄', leaf: '🍃', ruler: '📏', eraser: '🧽', crayon: '🖍️',
  lunch_box: '🍱', bubble: '🫧', water_balloon: '🎈', hamster: '🐹', butterfly: '🦋',
  robot_toy: '🤖', rainbow: '🌈', star: '⭐', magnet: '🧲', magnifying_glass: '🔍',
  // 패시브 12종
  milk: '🥛', backpack: '🎒', vitamin: '💊', bandage: '🩹', alarm_clock: '⏰',
  reading_glasses: '👓', slingshot: '🪀', sneakers: '👟', magnet_case: '✒️',
  clover: '🍀', gold_star: '🌟', cheer_charm: '🧧',
  // 대체 보상
  heal: '💚', score: '💯', magnet_pulse: '💎',
};

export function UpgradeSelect({ upgrades, onSelect }: UpgradeSelectProps) {
  const getRarity = (upgrade: UpgradeOption): string => {
    if (upgrade.type === 'bonus') return 'bonus';
    if (upgrade.isEvolution) return 'evolution';
    if (upgrade.isNew) return 'new';
    return 'upgrade';
  };

  const rarityConfig: Record<string, { color: string; bg: string; label: string }> = {
    evolution: { color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.1)', label: '진화' },
    new: { color: '#a78bfa', bg: 'rgba(167, 139, 250, 0.1)', label: '신규' },
    upgrade: { color: '#67e8f9', bg: 'rgba(103, 232, 249, 0.1)', label: '강화' },
    bonus: { color: '#34d399', bg: 'rgba(52, 211, 153, 0.1)', label: '보상' },
  };

  const getCardStyle = (upgrade: UpgradeOption): React.CSSProperties => {
    const rarity = getRarity(upgrade);
    const config = rarityConfig[rarity];
    return {
      borderColor: `${config.color}40`,
      background: config.bg,
    };
  };

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(10, 10, 15, 0.92)',
      backdropFilter: 'blur(10px)',
      zIndex: 50,
      padding: 'clamp(16px, 4vw, 48px)',
    }}>
      <div style={{ width: '100%', maxWidth: 'clamp(420px, 65vw, 880px)', textAlign: 'center' }}>
        {/* Level Up Header */}
        <div style={{ marginBottom: 'clamp(24px, 4vh, 48px)' }}>
          {/* Animated dots */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 8,
            marginBottom: 16,
          }}>
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: i === 2 ? '#fbbf24' : '#6366f1',
                  animation: 'dot-pulse 1.5s ease-in-out infinite',
                  animationDelay: `${i * 0.1}s`,
                }}
              />
            ))}
          </div>
          <h2 style={{
            fontSize: 'clamp(24px, 4vw, 44px)',
            fontWeight: 800,
            letterSpacing: '-0.03em',
            marginBottom: 8,
          }}>
            <span className="gradient-text-amber">LEVEL UP!</span>
          </h2>

          <p style={{ fontSize: 'clamp(12px, 1.2vw, 16px)', color: '#71717a', fontWeight: 500 }}>
            {upgrades.length === 1
              ? '업그레이드를 획득하세요'
              : '업그레이드를 선택하세요'}
          </p>
        </div>

        {/* Upgrade Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${Math.min(upgrades.length, 3)}, 1fr)`,
          gap: 'clamp(12px, 2vw, 24px)',
          justifyContent: 'center',
        }}>
          {upgrades.map((upgrade, index) => {
            const rarity = getRarity(upgrade);
            const config = rarityConfig[rarity];

            return (
              <button
                key={`${upgrade.type}-${upgrade.id}`}
                onClick={() => onSelect(upgrade.type, upgrade.id)}
                className="animate-scale-in"
                style={{
                  ...getCardStyle(upgrade),
                  border: '1px solid',
                  borderRadius: 20,
                  padding: 'clamp(20px, 3vw, 36px) clamp(16px, 2vw, 24px)',
                  cursor: 'pointer',
                  transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                  animationDelay: `${index * 0.1}s`,
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-8px) scale(1.02)';
                  e.currentTarget.style.boxShadow = `0 20px 40px -12px ${config.color}30`;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = '';
                  e.currentTarget.style.boxShadow = '';
                }}
              >
                {/* Rarity Badge */}
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 12px',
                  borderRadius: 999,
                  background: `${config.color}15`,
                  border: `1px solid ${config.color}30`,
                  marginBottom: 16,
                }}>
                  <div style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: config.color,
                  }} />
                  <span style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: config.color,
                  }}>
                    {config.label}
                  </span>
                </div>

                {/* Icon */}
                <div style={{
                  fontSize: 'clamp(36px, 4.5vw, 56px)',
                  margin: '12px 0 16px',
                }}>
                  {CARD_ICONS[upgrade.id] || upgrade.icon || '⚡'}
                </div>

                {/* Name */}
                <p style={{
                  fontSize: 'clamp(14px, 1.4vw, 18px)',
                  fontWeight: 700,
                  color: '#fafafa',
                  marginBottom: 8,
                }}>
                  {upgrade.name}
                </p>

                {/* Description */}
                <p style={{
                  fontSize: 'clamp(11px, 1vw, 14px)',
                  color: '#a1a1aa',
                  lineHeight: 1.6,
                }}>
                  {upgrade.description}
                </p>

                {/* Level Dots */}
                {upgrade.type !== 'bonus' && upgrade.currentLevel !== undefined && (
                  <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: 6,
                    marginTop: 16,
                  }}>
                    {Array.from({ length: upgrade.maxLevel || 5 }).map((_, i) => (
                      <div key={i} style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: i <= (upgrade.currentLevel || 0)
                          ? '#6366f1'
                          : 'rgba(255, 255, 255, 0.1)',
                        transition: 'background 0.2s ease',
                      }} />
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
