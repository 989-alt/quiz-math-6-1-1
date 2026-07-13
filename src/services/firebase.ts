import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
  type Auth,
  type User,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  addDoc,
  query,
  orderBy,
  limit as fsLimit,
  where,
  getDocs,
  serverTimestamp,
  Timestamp,
  type Firestore,
} from 'firebase/firestore';
import type { Grade, Semester } from '../data/unit';
import type { Difficulty } from '../game/difficulty';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Firestore | null = null;

export function isFirebaseConfigured(): boolean {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);
}

function ensureApp(): { app: FirebaseApp; auth: Auth; db: Firestore } {
  if (!isFirebaseConfigured()) {
    throw new Error(
      'Firebase 환경변수가 설정되지 않았습니다. .env.local의 VITE_FIREBASE_* 키를 확인하세요.'
    );
  }
  if (!_app) {
    _app = initializeApp(firebaseConfig);
    _auth = getAuth(_app);
    _db = getFirestore(_app);
  }
  return { app: _app!, auth: _auth!, db: _db! };
}

let _signInPromise: Promise<User> | null = null;

export function ensureAnonymousAuth(): Promise<User> {
  const { auth } = ensureApp();
  if (auth.currentUser) return Promise.resolve(auth.currentUser);
  if (_signInPromise) return _signInPromise;

  const signInPromise = new Promise<User>((resolve, reject) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        unsub();
        resolve(user);
      }
    });
    signInAnonymously(auth).catch((err) => {
      unsub();
      reject(err);
    });
  });

  _signInPromise = signInPromise;
  // 로그인 실패 시 캐시를 해제해 다음 호출에서 재시도할 수 있게 한다.
  signInPromise.catch(() => {
    if (_signInPromise === signInPromise) _signInPromise = null;
  });
  return signInPromise;
}

export interface ScoreEntry {
  nickname: string;
  unitId: string;
  grade: Grade;
  semester: Semester;
  score: number;
  survivalTime: number;
  level: number;
  kills: number;
  weightedScore: number;
  /** 난이도별 랭킹 분리용 (설계 §4). 필드 부재 = 구기록 = '쉬움'으로 분류 */
  difficulty?: Difficulty;
}

export interface ScoreEntryWithMeta extends ScoreEntry {
  docId: string;
  authUid: string;
  createdAt: number;
}

export interface ScoreListResult {
  scores: ScoreEntryWithMeta[];
  offline: boolean;
}

export interface ScoreResult {
  entry: ScoreEntryWithMeta | null;
  offline: boolean;
}

const RANKING_TIMEOUT_MS = 8000;
const LOCAL_SCORE_KEY_PREFIX = 'sqb:scores:';

function withTimeout<T>(promise: Promise<T>, ms = RANKING_TIMEOUT_MS): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error('랭킹 서버 응답이 지연되고 있습니다.')), ms);
    }),
  ]);
}

function getLocalScores(unitId: string): ScoreEntryWithMeta[] {
  try {
    const raw = localStorage.getItem(LOCAL_SCORE_KEY_PREFIX + unitId);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ScoreEntryWithMeta[];
    return parsed.sort((a, b) => b.weightedScore - a.weightedScore);
  } catch {
    return [];
  }
}

function saveLocalScore(entry: ScoreEntry): ScoreEntryWithMeta {
  const saved: ScoreEntryWithMeta = {
    ...entry,
    docId: `local:${Date.now()}`,
    authUid: 'local',
    createdAt: Date.now(),
  };
  const existing = getLocalScores(entry.unitId);
  existing.push(saved);
  // localStorage 접근 자체가 실패할 수 있어(용량 초과, 프라이빗 모드 등) 호출자가 처리하도록 그대로 던진다.
  localStorage.setItem(LOCAL_SCORE_KEY_PREFIX + entry.unitId, JSON.stringify(existing));
  return saved;
}

function removeLocalScore(unitId: string, docId: string): void {
  try {
    const remaining = getLocalScores(unitId).filter((s) => s.docId !== docId);
    localStorage.setItem(LOCAL_SCORE_KEY_PREFIX + unitId, JSON.stringify(remaining));
  } catch {
    // localStorage 접근 실패 시 무시 (사본이 남는 것뿐)
  }
}

const VALID_DIFFICULTIES: Difficulty[] = ['easy', 'normal', 'hard'];

async function submitScoreToFirestore(entry: ScoreEntry): Promise<string> {
  const { db } = ensureApp();
  const user = await ensureAnonymousAuth();

  const safe = {
    nickname: entry.nickname.slice(0, 12),
    unitId: entry.unitId,
    grade: entry.grade,
    semester: entry.semester,
    score: Math.max(0, Math.min(1_000_000, Math.floor(entry.score))),
    survivalTime: Math.max(0, Math.min(7200, Math.floor(entry.survivalTime))),
    level: Math.max(1, Math.min(999, Math.floor(entry.level))),
    kills: Math.max(0, Math.min(1_000_000, Math.floor(entry.kills))),
    weightedScore: Math.max(0, Math.floor(entry.weightedScore)),
    difficulty: VALID_DIFFICULTIES.includes(entry.difficulty as Difficulty)
      ? (entry.difficulty as Difficulty)
      : 'easy',
    authUid: user.uid,
    createdAt: serverTimestamp(),
  };

  const ref = collection(db, 'leaderboards', entry.unitId, 'scores');
  const doc = await addDoc(ref, safe);
  return doc.id;
}

export interface SubmitScoreResult {
  /** 원격 등록 성공 시 Firestore 문서 ID, 실패/오프라인 시 로컬 사본의 docId */
  docId: string;
  /** true면 로컬 사본으로만 저장된 상태(오프라인/타임아웃/미설정) */
  offline: boolean;
}

// 로컬 우선: Firebase 설정·성공 여부와 무관하게 기록을 항상 먼저 localStorage에 남긴다.
// 원격 등록은 그 다음 시도이며, 원격이 실패하거나 타임아웃돼도 이미 저장된 로컬 사본은 지우지 않는다.
export async function submitScore(entry: ScoreEntry): Promise<SubmitScoreResult> {
  let localSaved: ScoreEntryWithMeta | null = null;
  try {
    localSaved = saveLocalScore(entry);
  } catch (err) {
    console.error('[submitScore] 로컬 저장 실패:', err);
  }

  if (!localSaved) {
    // 로컬 저장조차 실패한 극단적인 경우: Firebase라도 시도하고, 그마저 안 되면 에러를 전파한다.
    const docId = await withTimeout(submitScoreToFirestore(entry));
    return { docId, offline: false };
  }

  return retrySubmitScore(entry, localSaved.docId);
}

// 등록 실패/오프라인 후 원격 등록만 재시도한다 (로컬 사본은 새로 만들지 않음).
export async function retrySubmitScore(entry: ScoreEntry, localDocId: string): Promise<SubmitScoreResult> {
  if (!isFirebaseConfigured()) {
    return { docId: localDocId, offline: true };
  }
  try {
    const remoteId = await withTimeout(submitScoreToFirestore(entry));
    // 원격 등록이 확인된 경우에만 로컬 사본을 정리한다.
    removeLocalScore(entry.unitId, localDocId);
    return { docId: remoteId, offline: false };
  } catch (err) {
    console.error('[retrySubmitScore] 원격 랭킹 등록 실패 — 로컬 사본을 유지합니다:', err);
    return { docId: localDocId, offline: true };
  }
}

function timestampToMs(t: unknown): number {
  if (t instanceof Timestamp) return t.toMillis();
  if (typeof t === 'object' && t !== null && 'seconds' in t) {
    const s = (t as { seconds: number }).seconds;
    return s * 1000;
  }
  return Date.now();
}

async function fetchTopScoresFromFirestore(unitId: string, top: number): Promise<ScoreEntryWithMeta[]> {
  const { db } = ensureApp();
  const ref = collection(db, 'leaderboards', unitId, 'scores');
  const q = query(ref, orderBy('weightedScore', 'desc'), fsLimit(top));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      docId: d.id,
      nickname: data.nickname,
      unitId: data.unitId,
      grade: data.grade,
      semester: data.semester,
      score: data.score,
      survivalTime: data.survivalTime,
      level: data.level,
      kills: data.kills,
      weightedScore: data.weightedScore,
      difficulty: data.difficulty,
      authUid: data.authUid,
      createdAt: timestampToMs(data.createdAt),
    } as ScoreEntryWithMeta;
  });
}

export async function fetchTopScores(unitId: string, top = 100): Promise<ScoreListResult> {
  try {
    const scores = await withTimeout(fetchTopScoresFromFirestore(unitId, top));
    return { scores, offline: false };
  } catch (err) {
    console.error('[fetchTopScores] 원격 조회 실패, 로컬 기록으로 대체:', err);
    return { scores: getLocalScores(unitId).slice(0, top), offline: true };
  }
}

// where(authUid==) + orderBy(weightedScore) 조합은 Firestore 복합 인덱스가 필요하다.
// 리포에 인덱스 정의가 없으므로, authUid로만 필터링해 가져온 뒤 클라이언트에서 정렬해
// 인덱스 의존을 없앤다(같은 uid의 기록 수는 적어 성능 문제가 없다).
async function fetchMyBestFromFirestore(unitId: string): Promise<ScoreEntryWithMeta | null> {
  const { db } = ensureApp();
  const user = await ensureAnonymousAuth();
  const ref = collection(db, 'leaderboards', unitId, 'scores');
  const q = query(ref, where('authUid', '==', user.uid));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const entries = snap.docs.map((d) => {
    const data = d.data();
    return {
      docId: d.id,
      nickname: data.nickname,
      unitId: data.unitId,
      grade: data.grade,
      semester: data.semester,
      score: data.score,
      survivalTime: data.survivalTime,
      level: data.level,
      kills: data.kills,
      weightedScore: data.weightedScore,
      difficulty: data.difficulty,
      authUid: data.authUid,
      createdAt: timestampToMs(data.createdAt),
    } as ScoreEntryWithMeta;
  });
  entries.sort((a, b) => b.weightedScore - a.weightedScore);
  return entries[0];
}

export async function fetchMyBest(unitId: string): Promise<ScoreResult> {
  try {
    const entry = await withTimeout(fetchMyBestFromFirestore(unitId));
    return { entry, offline: false };
  } catch (err) {
    console.error('[fetchMyBest] 원격 조회 실패, 로컬 기록으로 대체:', err);
    const local = getLocalScores(unitId);
    return { entry: local[0] ?? null, offline: true };
  }
}

// 같은 닉네임의 중복 플레이 기록을 최고 기록 하나만 남긴다 (표시 전용, 서버 데이터는 그대로 둔다).
export function dedupeByNicknameBest(entries: ScoreEntryWithMeta[]): ScoreEntryWithMeta[] {
  const bestByNickname = new Map<string, ScoreEntryWithMeta>();
  for (const entry of entries) {
    const existing = bestByNickname.get(entry.nickname);
    if (
      !existing ||
      entry.weightedScore > existing.weightedScore ||
      (entry.weightedScore === existing.weightedScore && entry.createdAt < existing.createdAt)
    ) {
      bestByNickname.set(entry.nickname, entry);
    }
  }
  return Array.from(bestByNickname.values()).sort((a, b) => b.weightedScore - a.weightedScore);
}
