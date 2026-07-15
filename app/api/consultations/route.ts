import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { Consultation, ConsultationStatus } from '@/lib/types';
import { detectDangerKeyword } from '@/lib/danger-keywords';

const VALID_STATUSES: ConsultationStatus[] = ['未対応', '対応中', '祐紀さん返信待ち', '完了'];
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET ?? '';

// GET /api/consultations → 未アーカイブ一覧（danger_flag未確認を先頭に、次にreceived_at降順）
export async function GET() {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from('consultations')
    .select('*')
    .is('archived_at', null)
    .order('danger_flag', { ascending: false })
    .order('danger_ack', { ascending: true })
    .order('received_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// POST /api/consultations → 新規相談の登録（agent webhook or 手動）
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-agent-secret') ?? '';
  if (WEBHOOK_SECRET && req.headers.has('x-agent-secret') && secret !== WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const {
    consultant_name, contact_ref, channel, content, source_ref, danger_flag: explicitDangerFlag,
  } = body as {
    consultant_name: string;
    contact_ref?: string;
    channel: string;
    content: string;
    source_ref?: string;
    danger_flag?: boolean;
  };

  if (!consultant_name || !channel || !content) {
    return NextResponse.json({ error: 'consultant_name, channel, content are required' }, { status: 400 });
  }

  const matchedKeyword = detectDangerKeyword(content);
  const dangerFlag = explicitDangerFlag === true || matchedKeyword !== null;

  const db = supabaseAdmin();
  const { data, error } = await db.from('consultations').insert([{
    consultant_name,
    contact_ref: contact_ref ?? null,
    channel,
    content,
    danger_flag: dangerFlag,
    danger_note: dangerFlag
      ? (matchedKeyword ? `自動検知: 「${matchedKeyword}」` : '登録時に手動フラグ')
      : null,
    danger_flagged_at: dangerFlag ? new Date().toISOString() : null,
    source_ref: source_ref ?? null,
  }]).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

// PATCH /api/consultations?id=xxx
export async function PATCH(req: NextRequest) {
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const body: Partial<Consultation> = await req.json();

  if (body.status && !VALID_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` }, { status: 400 });
  }

  const now = new Date().toISOString();
  const updates: Partial<Consultation> = { ...body };

  if (body.status === '完了') {
    updates.completed_at = now;
  }

  // 手動でdanger_flagをON/OFFした場合のタイムスタンプ管理
  if (body.danger_flag === true) {
    updates.danger_flagged_at = now;
    updates.danger_ack = false;
    updates.danger_ack_at = null;
  } else if (body.danger_flag === false) {
    updates.danger_ack = false;
    updates.danger_ack_at = null;
  }

  // 確認（ack）操作
  if (body.danger_ack === true) {
    updates.danger_ack_at = now;
  }

  const db = supabaseAdmin();
  const { data, error } = await db.from('consultations').update(updates).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
