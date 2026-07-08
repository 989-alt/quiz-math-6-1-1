const SOUND_SETTINGS_KEY = 'sqb:sound';

export interface SoundSettings {
  bgm: boolean;
  sfx: boolean;
}

const DEFAULT_SOUND_SETTINGS: SoundSettings = { bgm: true, sfx: true };

/** 저장된 브금/효과음 설정 조회. 미저장/손상 시 둘 다 기본값 true. */
export function getSoundSettings(): SoundSettings {
  try {
    const raw = localStorage.getItem(SOUND_SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SOUND_SETTINGS };
    const parsed = JSON.parse(raw);
    return {
      bgm: typeof parsed.bgm === 'boolean' ? parsed.bgm : true,
      sfx: typeof parsed.sfx === 'boolean' ? parsed.sfx : true,
    };
  } catch {
    return { ...DEFAULT_SOUND_SETTINGS };
  }
}

/** 부분 업데이트 후 저장하고 최종 설정을 반환. */
export function setSoundSettings(partial: Partial<SoundSettings>): SoundSettings {
  const next = { ...getSoundSettings(), ...partial };
  try {
    localStorage.setItem(SOUND_SETTINGS_KEY, JSON.stringify(next));
  } catch {
    // localStorage 접근 실패 시 무시 (설정이 저장 안 될 뿐)
  }
  return next;
}
