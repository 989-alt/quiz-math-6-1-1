import { useEffect, useState } from 'react';

/** 최초 접속 시 튜토리얼 진행 여부를 묻는 프롬프트 (Task T1) */
interface TutorialPromptProps {
  onYes: () => void;
  onNo: () => void;
}

export function TutorialPrompt({ onYes, onNo }: TutorialPromptProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onNo();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onNo]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(10, 10, 15, 0.9)',
        backdropFilter: 'blur(8px)',
        zIndex: 100,
        padding: 'clamp(16px, 4vw, 48px)',
      }}
      onClick={onNo}
    >
      <div
        className="clean-card animate-scale-in"
        style={{ width: '100%', maxWidth: 380, padding: 'clamp(24px, 4vw, 40px)', textAlign: 'center' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          style={{
            fontSize: 'clamp(20px, 3vw, 26px)',
            fontWeight: 800,
            color: '#fafafa',
            marginBottom: 10,
          }}
        >
          튜토리얼을 진행하시겠습니까?
        </h2>
        <p style={{ fontSize: 14, color: '#a1a1aa', marginBottom: 24 }}>
          처음이라면 게임 방법을 먼저 살펴보세요!
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <button onClick={onNo} className="btn-clean btn-ghost" style={{ padding: '12px', fontSize: 13, fontWeight: 700 }}>
            아니오, 바로 할래요
          </button>
          <button onClick={onYes} className="btn-clean btn-indigo" style={{ padding: '12px', fontSize: 13, fontWeight: 700 }}>
            예, 볼래요
          </button>
        </div>
      </div>
    </div>
  );
}

interface WeaponEntry {
  id: string;
  nameKo: string;
  desc: string;
}

interface BonusEntry {
  emoji: string;
  nameKo: string;
  desc: string;
}

const RANGED_WEAPONS: WeaponEntry[] = [
  { id: 'pencil', nameKo: '연필', desc: '가장 가까운 몬스터에게 슝!' },
  { id: 'banana', nameKo: '바나나', desc: '던지면 돌아오는 부메랑' },
  { id: 'acorn', nameKo: '도토리', desc: '통통 튕기는 도토리' },
  { id: 'paper_plane', nameKo: '종이비행기', desc: '몬스터를 따라가는 비행기' },
  { id: 'marble', nameKo: '구슬', desc: '벽에 반사되는 구슬' },
  { id: 'snowball', nameKo: '눈덩이', desc: '맞은 적을 느리게 해요' },
  { id: 'leaf', nameKo: '나뭇잎', desc: '바람에 흔들리며 날아가요' },
  { id: 'ruler', nameKo: '자', desc: '거대한 자로 넓게 쾅!' },
  { id: 'butterfly', nameKo: '나비', desc: '나비 떼가 적을 쫓아 날아가요' },
];

const MELEE_WEAPONS: WeaponEntry[] = [
  { id: 'eraser', nameKo: '지우개', desc: '주변의 적을 쓱쓱 지워요' },
  { id: 'crayon', nameKo: '크레파스', desc: '무지개 선을 그리며 공격' },
  { id: 'lunch_box', nameKo: '도시락', desc: '펑! 터지는 도시락' },
  { id: 'bubble', nameKo: '비눗방울', desc: '내 주위를 빙글빙글 돌아요' },
  { id: 'water_balloon', nameKo: '물풍선', desc: '터지면 사방으로 촥!' },
];

const PET_FRIENDS: WeaponEntry[] = [
  { id: 'hamster', nameKo: '햄스터', desc: '적에게 돌진! 수정도 물어다 줘요' },
  { id: 'robot_toy', nameKo: '로봇 장난감', desc: '관통 레이저! 내가 맞으면 복수해요' },
];

const SPECIAL_WEAPONS: WeaponEntry[] = [
  { id: 'rainbow', nameKo: '무지개', desc: '무지개 파동으로 화면을 휩쓸어요' },
  { id: 'star', nameKo: '별', desc: '하늘에서 별똥별이 떨어져요' },
  { id: 'magnifying_glass', nameKo: '돋보기', desc: '햇빛을 모아 적을 태워요' },
];

const BONUS_ITEMS: BonusEntry[] = [
  { emoji: '❤️', nameKo: '체력 회복', desc: '체력을 30% 회복해요' },
  { emoji: '⭐', nameKo: '보너스 점수', desc: '점수 +500' },
  { emoji: '🧲', nameKo: '자석', desc: '화면의 수정을 전부 끌어와요' },
];

function WeaponRow({ weapon }: { weapon: WeaponEntry }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <img
        src={`assets/generated/weapon_${weapon.id}.png`}
        alt={weapon.nameKo}
        style={{ width: 36, height: 36, imageRendering: 'pixelated', flexShrink: 0 }}
      />
      <div style={{ textAlign: 'left' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#e4e4e7' }}>{weapon.nameKo}</div>
        <div style={{ fontSize: 11, color: '#a1a1aa' }}>{weapon.desc}</div>
      </div>
    </div>
  );
}

function BonusRow({ item }: { item: BonusEntry }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
        {item.emoji}
      </div>
      <div style={{ textAlign: 'left' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#e4e4e7' }}>{item.nameKo}</div>
        <div style={{ fontSize: 11, color: '#a1a1aa' }}>{item.desc}</div>
      </div>
    </div>
  );
}

const PAGES: { title: string; content: React.ReactNode }[] = [
  {
    title: '조작 방법',
    content: (
      <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#e4e4e7', marginBottom: 8 }}>🕹️ 움직이기</div>
          <div style={{ fontSize: 13, color: '#a1a1aa', lineHeight: 1.8 }}>
            · 컴퓨터: 방향키(↑↓←→) 또는 W A S D
            <br />
            · 태블릿/폰: 화면의 조이스틱을 드래그
          </div>
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#e4e4e7', marginBottom: 8 }}>⚔️ 공격하기</div>
          <div style={{ fontSize: 13, color: '#a1a1aa', lineHeight: 1.8 }}>
            · 공격은 자동! 무기가 가까운 몬스터를 알아서 공격해요.
            <br />
            · 우리는 잘 피하고, 잘 움직이기만 하면 돼요.
          </div>
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#e4e4e7', marginBottom: 8 }}>⏸️ 쉬고 싶을 때</div>
          <div style={{ fontSize: 13, color: '#a1a1aa', lineHeight: 1.8 }}>
            · 화면 오른쪽 위 [그만하기]를 두 번 누르면 지금까지의 점수가 저장돼요.
            <br />
            · 다른 탭으로 나가면 게임이 자동으로 멈춰요.
          </div>
        </div>
      </div>
    ),
  },
  {
    title: '게임 목표',
    content: (
      <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: '#a1a1aa', lineHeight: 1.9 }}>
          <li>몬스터를 잡으면 반짝이는 수정이 떨어져요.</li>
          <li>수정을 모아 레벨업하면 수학 퀴즈가 나와요! (15~20초)</li>
          <li>
            퀴즈를 맞히면 → 무기를 얻거나 강화! (빨리 맞힐수록 보너스 점수)
            <br />
            퀴즈를 틀리면 → 강화 없이 그냥 지나가요. (아프지는 않아요)
          </li>
        </ol>
        <div
          style={{
            padding: '16px 14px',
            borderRadius: 14,
            background: 'rgba(99,102,241,0.08)',
            border: '1px solid rgba(99,102,241,0.2)',
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 800, color: '#a5b4fc', marginBottom: 8 }}>🏆 최종 목표</div>
          <div style={{ fontSize: 13, color: '#c7d2fe', lineHeight: 1.8 }}>
            무기 6개를 모두 최고 레벨(Lv.8)로 만들면 최종 보스가 나타나요.
            <br />
            보스를 물리치면 게임 클리어! 🎉
            <br />
            퀴즈 300문제를 다 풀어도 명예로운 완주예요.
            <br />
            친구(펫)는 클리어 조건에 들어가지 않아요. 무기 6개가 핵심!
          </div>
        </div>
      </div>
    ),
  },
  {
    title: '무기 도감 ① 원거리',
    content: (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {RANGED_WEAPONS.map((w) => (
          <WeaponRow key={w.id} weapon={w} />
        ))}
      </div>
    ),
  },
  {
    title: '무기 도감 ② 근접 · 친구(펫)',
    content: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, textAlign: 'left' }}>
        <div>
          <div style={{ fontSize: 11, color: '#71717a', fontWeight: 700, marginBottom: 10 }}>근접</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {MELEE_WEAPONS.map((w) => (
              <WeaponRow key={w.id} weapon={w} />
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: '#71717a', fontWeight: 700, marginBottom: 10 }}>
            친구 (펫) — 무기 칸을 차지하지 않아요!
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {PET_FRIENDS.map((w) => (
              <WeaponRow key={w.id} weapon={w} />
            ))}
          </div>
          <div style={{ fontSize: 12, color: '#a1a1aa', lineHeight: 1.6, marginTop: 10 }}>
            친구는 무기 6칸과 별도로 최대 2마리까지 함께해요. 레벨업 카드에서 똑같이 뽑고 키울 수 있어요.
            단, 게임 클리어(무기 6개 만렙)에는 무기만 세어져요!
          </div>
        </div>
      </div>
    ),
  },
  {
    title: '무기 도감 ③ 특수',
    content: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, textAlign: 'left' }}>
        <div>
          <div style={{ fontSize: 11, color: '#71717a', fontWeight: 700, marginBottom: 10 }}>특수 — 아주 강력해요!</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {SPECIAL_WEAPONS.map((w) => (
              <WeaponRow key={w.id} weapon={w} />
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: '#71717a', fontWeight: 700, marginBottom: 10 }}>가끔 나오는 보너스</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {BONUS_ITEMS.map((b) => (
              <BonusRow key={b.nameKo} item={b} />
            ))}
          </div>
        </div>
        <div style={{ fontSize: 12, color: '#a5b4fc' }}>
          무기는 최대 6개 + 친구는 2마리까지! 어떤 조합을 만들지 골라 보세요.
        </div>
      </div>
    ),
  },
];

/** 게임 방법을 설명하는 5페이지 책자 (Task T1) */
interface TutorialBookletProps {
  onClose: () => void;
}

export function TutorialBooklet({ onClose }: TutorialBookletProps) {
  const pageCount = PAGES.length;
  const [page, setPage] = useState(0);
  const isFirst = page === 0;
  const isLast = page === pageCount - 1;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') setPage((p) => Math.max(0, p - 1));
      else if (e.key === 'ArrowRight') setPage((p) => Math.min(pageCount - 1, p + 1));
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, pageCount]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(10,10,15,0.92)',
        backdropFilter: 'blur(8px)',
        zIndex: 110,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'clamp(12px, 3vw, 48px)',
      }}
      onClick={onClose}
    >
      <div
        className="clean-card animate-scale-in"
        style={{
          width: '100%',
          maxWidth: 520,
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 'clamp(20px, 3vw, 32px)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div
            style={{
              display: 'inline-block',
              padding: '6px 14px',
              borderRadius: 999,
              background: 'rgba(99,102,241,0.08)',
              border: '1px solid rgba(99,102,241,0.2)',
              fontSize: 12,
              fontWeight: 700,
              color: '#a5b4fc',
            }}
          >
            {PAGES[page].title}
          </div>
          <button onClick={onClose} className="btn-clean btn-ghost" style={{ padding: '8px 12px', fontSize: 12 }}>
            ✕ 닫기
          </button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, marginBottom: 16 }}>{PAGES[page].content}</div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={isFirst}
            className="btn-clean btn-ghost"
            style={{ padding: '10px 16px', fontSize: 13, opacity: isFirst ? 0.3 : 1 }}
          >
            ◀ 이전
          </button>

          <div style={{ display: 'flex', gap: 6 }}>
            {PAGES.map((_, i) => (
              <div
                key={i}
                style={{
                  width: i === page ? 8 : 6,
                  height: i === page ? 8 : 6,
                  borderRadius: '50%',
                  background: i === page ? '#6366f1' : 'rgba(255,255,255,0.15)',
                }}
              />
            ))}
          </div>

          {isLast ? (
            <button onClick={onClose} className="btn-clean btn-indigo" style={{ padding: '10px 16px', fontSize: 13, fontWeight: 700 }}>
              다 봤어요!
            </button>
          ) : (
            <button
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              className="btn-clean btn-indigo"
              style={{ padding: '10px 16px', fontSize: 13, fontWeight: 700 }}
            >
              다음 ▶
            </button>
          )}
        </div>
        <div style={{ textAlign: 'right', fontSize: 11, color: '#52525b', marginTop: 8 }}>
          {page + 1} / {pageCount}
        </div>
      </div>
    </div>
  );
}
