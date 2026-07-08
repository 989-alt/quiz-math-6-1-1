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

  _signInPromise = new Promise<User>((resolve, reject) => {
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
  return _signInPromise;
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

const RANKING_TIMEOUT_MS = 3000;
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
    authUid: user.uid,
    createdAt: serverTimestamp(),
  };

  const ref = collection(db, 'leaderboards', entry.unitId, 'scores');
  const doc = await addDoc(ref, safe);
  return doc.id;
}

export async function submitScore(entry: ScoreEntry): Promise<string> {
  const remote = submitScoreToFirestore(entry);
  try {
    return await withTimeout(remote);
  } catch (err) {
    const saved = saveLocalScore(entry);
    // 타임아웃이어도 진행 중인 addDoc은 취소되지 않는다 — 뒤늦게 성공하면
    // 서버/로컬 이중 기록이 되므로 로컬 사본을 제거한다.
    remote.then(() => removeLocalScore(entry.unitId, saved.docId)).catch(() => {});
    throw err;
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
      authUid: data.authUid,
      createdAt: timestampToMs(data.createdAt),
    } as ScoreEntryWithMeta;
  });
}

export async function fetchTopScores(unitId: string, top = 100): Promise<ScoreListResult> {
  try {
    const scores = await withTimeout(fetchTopScoresFromFirestore(unitId, top));
    return { scores, offline: false };
  } catch {
    return { scores: getLocalScores(unitId).slice(0, top), offline: true };
  }
}

async function fetchMyBestFromFirestore(unitId: string): Promise<ScoreEntryWithMeta | null> {
  const { db } = ensureApp();
  const user = await ensureAnonymousAuth();
  const ref = collection(db, 'leaderboards', unitId, 'scores');
  const q = query(
    ref,
    where('authUid', '==', user.uid),
    orderBy('weightedScore', 'desc'),
    fsLimit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
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
    authUid: data.authUid,
    createdAt: timestampToMs(data.createdAt),
  };
}

export async function fetchMyBest(unitId: string): Promise<ScoreResult> {
  try {
    const entry = await withTimeout(fetchMyBestFromFirestore(unitId));
    return { entry, offline: false };
  } catch {
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
