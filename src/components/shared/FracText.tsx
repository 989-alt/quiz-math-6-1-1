import { Fragment } from 'react';

/**
 * 문제은행 분수 마크업 렌더러.
 * "{a/b}" → 세로 분수, "{w r/b}" → 대분수(자연수 + 세로 분수), 나머지는 일반 텍스트.
 * 분자/분모(a, b, r)는 숫자뿐 아니라 "(4÷2)", "▲" 같은 식/기호도 허용한다
 * (중괄호·슬래시만 제외) — 문제은행 explanation 필드의 식 분수 표기 대응.
 */

const MARKUP_RE = /\{(\d+) ([^{}/]+)\/([^{}/]+)\}|\{([^{}/]+)\/([^{}/]+)\}/g;

function Frac({ num, den }: { num: string; den: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        verticalAlign: 'middle',
        margin: '0 2px',
        lineHeight: 1.1,
        fontSize: '0.82em',
        fontWeight: 700,
      }}
    >
      <span style={{ padding: '0 4px' }}>{num}</span>
      <span
        style={{
          width: '100%',
          borderTop: '1.5px solid currentColor',
          padding: '0 4px',
        }}
      >
        {den}
      </span>
    </span>
  );
}

export function FracText({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;

  for (const m of text.matchAll(MARKUP_RE)) {
    const idx = m.index ?? 0;
    if (idx > lastIndex) {
      parts.push(<Fragment key={key++}>{text.slice(lastIndex, idx)}</Fragment>);
    }
    if (m[1] !== undefined) {
      // 대분수 {w r/b}
      parts.push(
        <span key={key++} style={{ whiteSpace: 'nowrap' }}>
          <span style={{ fontWeight: 700 }}>{m[1]}</span>
          <Frac num={m[2]} den={m[3]} />
        </span>
      );
    } else {
      // 진분수/가분수 {a/b}
      parts.push(<Frac key={key++} num={m[4]} den={m[5]} />);
    }
    lastIndex = idx + m[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(<Fragment key={key++}>{text.slice(lastIndex)}</Fragment>);
  }

  return <>{parts}</>;
}
