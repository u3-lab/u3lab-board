import { NextRequest, NextResponse } from 'next/server';

// POST /api/daily-gcal-draft  — called by task scheduler at 23:00 JST
// 2026-07-24無効化(海GO): このバックアップ網が拾う対象(completed_atが当日の
// doneタスク)は、旧board廃止に伴う事務的クローズ(Cockpit移行等)も「今日の
// 完了行動」として誤って02行動_下書きへ書き込んでしまう欠陥を、対になる
// PATCH /api/tasks のイベント駆動フックと共に持っていた(2026-07-23夜に実際に
// 発生した事故と同型)。旧board自体が廃止方向のため、時間窓ガードで延命する
// のではなくエンドポイント自体を無効化する。Windows Scheduled Task
// (U3LAB-DailyGcalDraft)は引き続き23:00に叩きに来るが、常に204を返すだけで
// 何も書き込まない。
export async function POST(_req: NextRequest) {
  return new NextResponse(null, { status: 204 });
}
