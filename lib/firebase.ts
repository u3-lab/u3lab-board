import { google } from 'googleapis';

// B-1 リールデータ一本化（2026-07-13）:
// 🎬配信タブは祐紀さんのFirebase RTDB（reel board）の read-only ミラー。
// RTDBルールが auth != null 必須so、service account 経由（Admin権限）で読む。
// 本番(Vercel)は FIREBASE_SERVICE_ACCOUNT (Sensitive env・JSON文字列) から資格情報を読む。
// ローカルは .env.local に同JSONを一行で入れる。
// ※ orderBy/equalTo は state/reels に .indexOn 未設定so400で弾かれる。必ず全件取得＋JS側filter
//   （reel-watch/check-reel-db.js と同じ経路。144件規模so性能問題なし）。

const FIREBASE_STATE_URL =
  'https://u3-reel-dashboard-default-rtdb.firebaseio.com/syncRooms/539e88e3d7d9d84fc356e28b1a6c23de.json';

// Firebase 上の1リールの生shape（live probe 2026-07-13 で確認した実キー）
export interface FirebaseReel {
  id: string;
  title?: string;
  caption?: string;
  script?: string;
  url?: string;
  status?: string; // idea | writing | filming | editing | scheduled | published
  accountId?: string; // 住職 | 写真 | LiFE DESiGN LAB | こころをうつす
  scheduledAt?: string; // YYYY-MM-DD
  publishedAt?: string; // YYYY-MM-DD
  createdAt?: string; // ISO
  updatedAt?: string; // ISO
}

let cachedToken: { token: string; exp: number } | null = null;

async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.exp > now + 60_000) return cachedToken.token;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT env var missing');
  const credentials = JSON.parse(raw);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: [
      'https://www.googleapis.com/auth/firebase.database',
      'https://www.googleapis.com/auth/userinfo.email',
    ],
  });
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  const token = typeof tokenResponse === 'string' ? tokenResponse : tokenResponse?.token;
  if (!token) throw new Error('Failed to mint Firebase access token');
  cachedToken = { token, exp: now + 50 * 60_000 }; // google token ~1h, cache 50min
  return token;
}

// 祐紀さんboardの state.reels[] を返す（read-only）。
export async function fetchFirebaseReels(): Promise<FirebaseReel[]> {
  const token = await getAccessToken();
  const res = await fetch(`${FIREBASE_STATE_URL}?access_token=${token}`);
  if (!res.ok) {
    throw new Error(`Firebase read failed ${res.status}: ${res.statusText}`);
  }
  const data = await res.json();
  const reels = data?.state?.reels;
  if (!Array.isArray(reels)) {
    throw new Error('state.reels not found (Firebase structure changed?)');
  }
  return reels as FirebaseReel[];
}
