import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import type { Reel } from '@/lib/types';

// GET /api/reels?kind=shokunin&status=予約済み&month=2026-07
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const kind = searchParams.get('kind');
  const status = searchParams.get('status');
  const month = searchParams.get('month'); // YYYY-MM

  const db = supabaseAdmin();
  let query = db.from('reels').select('*').order('publish_date', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false });

  if (kind) query = query.eq('kind', kind);
  if (status) query = query.eq('status', status);
  if (month) {
    const start = `${month}-01`;
    const [y, m] = month.split('-').map(Number);
    const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
    query = query.gte('publish_date', start).lt('publish_date', nextMonth);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// POST /api/reels
export async function POST(req: NextRequest) {
  const body: Partial<Reel> = await req.json();
  const db = supabaseAdmin();
  const { data, error } = await db.from('reels').insert([body]).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

// PATCH /api/reels?id=xxx
export async function PATCH(req: NextRequest) {
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const body: Partial<Reel> = await req.json();
  const db = supabaseAdmin();
  const { data, error } = await db.from('reels').update(body).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE /api/reels?id=xxx
export async function DELETE(req: NextRequest) {
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const db = supabaseAdmin();
  const { error } = await db.from('reels').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: id });
}
