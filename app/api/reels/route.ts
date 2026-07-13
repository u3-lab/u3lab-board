import { NextRequest, NextResponse } from 'next/server';
import { fetchFirebaseReels, type FirebaseReel } from '@/lib/firebase';
import type { Reel, ReelKind, ReelStatus, ReelStage } from '@/lib/types';

// B-1 リールデータ一本化（2026-07-13）:
// 🎬配信タブ = 祐紀さんのFirebase reel board の read-only ミラー。
// GET は Firebase(state.reels) を読んで Reel 型に変換して返す（フロント無改修）。
// 状態の"正"は Firebase 一本so、この board からの書き込み(POST/PATCH/DELETE)は廃止（410）。
//   → 以前は Supabase reels に書いていたが、GETがFirebase読みになった今、書くと
//     読めない先に書く split-brain になる。書き込み経路自体を塞ぐ。

// accountId(和・Firebase) → kind(Reel)（live probe 2026-07-13 の4値）
const ACCOUNT_TO_KIND: Record<string, ReelKind> = {
  '住職': 'shokunin',
  '写真': 'shashinka',
  'LiFE DESiGN LAB': 'ldl',
  'こころをうつす': 'kokoro',
};

// Firebase status(英) → ReelStatus(和)（海サイン 2026-07-13。filming/editing のラベルは光目視で微調整余地）
const STATUS_TO_JA: Record<string, ReelStatus> = {
  idea: '下書き',
  writing: '下書き',
  filming: '収録待ち',
  editing: '撮影済み',
  scheduled: '予約済み',
  published: '投稿済み',
};

// Firebase status → Reel.stage（idea/writing を保持）
const STATUS_TO_STAGE: Record<string, ReelStage> = {
  idea: 'idea',
  writing: 'writing',
  filming: 'production',
  editing: 'production',
  scheduled: 'production',
  published: 'production',
};

function mapFirebaseToReel(fb: FirebaseReel): Reel {
  return {
    id: fb.id,
    kind: (fb.accountId && ACCOUNT_TO_KIND[fb.accountId]) || 'other',
    theme: fb.title ?? null,
    status: (fb.status && STATUS_TO_JA[fb.status]) || '下書き',
    stage: (fb.status && STATUS_TO_STAGE[fb.status]) || null,
    publish_date: fb.scheduledAt ?? null,
    request_date: null, // Firebaseに無
    memo: null, // Firebaseに無
    koyomi_meta: null, // Firebaseに無
    chatgpt_url: fb.url ?? null,
    script: fb.script ?? null,
    caption: fb.caption ?? null,
    post_url: null, // Firebaseに無
    source_ref: 'firebase:reel-board', // 由来明示
    extra: fb.updatedAt ? { firebase_updated_at: fb.updatedAt } : null,
    created_at: fb.createdAt ?? new Date(0).toISOString(),
    posted_at: fb.publishedAt ?? null,
    notion_id: null, // Firebaseに無
  };
}

function nextMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
}

// GET /api/reels?kind=shokunin&status=予約済み&month=2026-07
// フィルタ挙動・並びは現行(Supabase版)を踏襲。データ源のみ Firebase に差し替え。
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const kind = searchParams.get('kind');
  const status = searchParams.get('status');
  const month = searchParams.get('month'); // YYYY-MM

  let reels: Reel[];
  try {
    const fb = await fetchFirebaseReels(); // 全件取得（.indexOn未設定so query不可）
    reels = fb.map(mapFirebaseToReel);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'firebase read error' },
      { status: 500 }
    );
  }

  if (kind) reels = reels.filter(r => r.kind === kind);
  if (status) reels = reels.filter(r => r.status === status);
  if (month) {
    const start = `${month}-01`;
    const end = nextMonth(month);
    reels = reels.filter(r => r.publish_date && r.publish_date >= start && r.publish_date < end);
  }

  // 並び: publish_date asc (null last) → created_at desc
  reels.sort((a, b) => {
    const ap = a.publish_date, bp = b.publish_date;
    if (ap && bp && ap !== bp) return ap < bp ? -1 : 1;
    if (ap && !bp) return -1;
    if (!ap && bp) return 1;
    return (b.created_at || '') < (a.created_at || '') ? -1 : 1;
  });

  return NextResponse.json(reels);
}

// 🎬配信タブは read-only ミラー。書き込み経路は廃止（split-brain防止）。
const READ_ONLY_MSG =
  'reels は Firebase reel board の読み取り専用ミラーになりました。編集は祐紀さんの reel board で行ってください（2026-07-13 B-1）。';

export async function POST() {
  return NextResponse.json({ error: READ_ONLY_MSG }, { status: 410 });
}
export async function PATCH() {
  return NextResponse.json({ error: READ_ONLY_MSG }, { status: 410 });
}
export async function DELETE() {
  return NextResponse.json({ error: READ_ONLY_MSG }, { status: 410 });
}
