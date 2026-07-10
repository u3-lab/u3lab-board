// DRAFT — prepared 2026-07-10, NOT YET RUN against production.
// Migrates surge diagram-reel-dashboard (Firebase RTDB) -> board `reels` table.
// See umi/outputs/reel_dashboard_integration_20260710.md §3-5 for the full plan.
//
// Waiting on 祐紀さんGO before running with --apply. Safe to run without --apply
// any time (read-only: fetches Firebase snapshot + prints a dry-run plan, touches
// neither Firebase nor Supabase).
//
// Usage:
//   bun tools/migrate_reeldash_to_board.mjs                 # dry-run, prints plan only
//   bun tools/migrate_reeldash_to_board.mjs --apply          # actually upserts into Supabase
//
// Requires supabase/migrations/20260710_reels_dashboard_integration.sql to have
// been applied first (post_url/stage/source_ref columns, updated CHECK constraints).

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const FIREBASE_SNAPSHOT_URL =
  'https://u3-reel-dashboard-default-rtdb.firebaseio.com/syncRooms/539e88e3d7d9d84fc356e28b1a6c23de.json';

const KIND_MAP = {
  '住職': 'shokunin',
  '写真': 'shashinka',
  'LiFE DESiGN LAB': 'ldl',
  'こころをうつす': 'kokoro',
};
const kindOf = (accountId) => KIND_MAP[accountId] ?? 'other';

// surge 6値 -> board 4値+stage。surge に無い「撮影済み」はboard到達後の遷移で使う
// ので移行では作らない（filming/editing の対応のみ埋める）。
const STATUS_MAP = {
  idea: { status: '下書き', stage: 'idea' },
  writing: { status: '下書き', stage: 'writing' },
  filming: { status: '収録待ち', stage: 'production' },
  editing: { status: '撮影済み', stage: 'production' },
  scheduled: { status: '予約済み', stage: 'production' },
  published: { status: '投稿済み', stage: 'production' },
};

function mapReel(surgeReel) {
  const { status, stage } = STATUS_MAP[surgeReel.status] ?? { status: '下書き', stage: 'production' };
  return {
    source_ref: `surge:${surgeReel.id}`,
    theme: surgeReel.title || '無題のリール',
    kind: kindOf(surgeReel.accountId),
    status,
    stage,
    publish_date: surgeReel.scheduledAt || surgeReel.publishedAt || null,
    script: surgeReel.script || null,
    caption: surgeReel.caption || null,
    post_url: surgeReel.url || null,
  };
}

function loadEnv(path) {
  return Object.fromEntries(
    fs.readFileSync(path, 'utf8').replace(/^﻿/, '').split('\n').filter(l => l.includes('='))
      .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
  );
}

async function main() {
  const apply = process.argv.includes('--apply');

  console.log(`[fetch] ${FIREBASE_SNAPSHOT_URL}`);
  const res = await fetch(FIREBASE_SNAPSHOT_URL);
  if (!res.ok) throw new Error(`Firebase fetch failed: HTTP ${res.status}`);
  const raw = await res.json();
  const state = raw.state ?? raw; // tolerate either {state:{...}} or flat shape

  const surgeReels = state.reels ?? [];
  const surgeIdeas = state.ideas ?? [];
  console.log(`[fetch] reels=${surgeReels.length} ideas=${surgeIdeas.length} accounts=${JSON.stringify(state.accounts)}`);

  // Snapshot the raw original before any transform, per §3-5 step 1.
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const snapshotPath = `outputs/reeldash_firebase_snapshot_${stamp}.json`;
  fs.mkdirSync('outputs', { recursive: true });
  fs.writeFileSync(snapshotPath, JSON.stringify(raw, null, 2));
  console.log(`[snapshot] saved raw Firebase export to ${snapshotPath}`);

  const planned = surgeReels.map(mapReel);
  const byKind = {};
  for (const p of planned) byKind[p.kind] = (byKind[p.kind] || 0) + 1;
  console.log('[plan] account breakdown:', JSON.stringify(byKind));

  if (!apply) {
    console.log(`[dry-run] would upsert ${planned.length} reels by source_ref. Sample (first 3):`);
    console.log(JSON.stringify(planned.slice(0, 3), null, 2));
    console.log('[dry-run] pass --apply to actually write to Supabase (requires migration SQL applied first).');
    return;
  }

  const env = loadEnv('.env.local');
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  const results = { inserted: 0, updated: 0, failed: 0, readback_mismatch: 0 };
  const failures = [];

  for (const reel of planned) {
    try {
      // Dedup against Notion-sourced reels first: same theme + publish_date already
      // present without a source_ref means it came from Notion -> don't overwrite,
      // just backfill source_ref so we know it's linked (§3-5 step 7).
      const { data: existingBySourceRef } = await db.from('reels').select('*').eq('source_ref', reel.source_ref).maybeSingle();

      let written;
      if (existingBySourceRef) {
        const { data, error } = await db.from('reels').update(reel).eq('id', existingBySourceRef.id).select().single();
        if (error) throw error;
        written = data;
        results.updated++;
      } else {
        const { data: dup } = await db.from('reels')
          .select('*').eq('theme', reel.theme).eq('publish_date', reel.publish_date).is('source_ref', null).maybeSingle();
        if (dup) {
          const { data, error } = await db.from('reels').update({ source_ref: reel.source_ref }).eq('id', dup.id).select().single();
          if (error) throw error;
          written = data;
          results.updated++;
        } else {
          const { data, error } = await db.from('reels').insert([reel]).select().single();
          if (error) throw error;
          written = data;
          results.inserted++;
        }
      }

      // Read-back: re-fetch and full-text compare the fields we just wrote (光の絶対条件).
      const { data: readback, error: rbErr } = await db.from('reels').select('*').eq('id', written.id).single();
      if (rbErr) throw rbErr;
      for (const field of ['theme', 'script', 'caption', 'status', 'publish_date']) {
        if ((readback[field] ?? null) !== (reel[field] ?? null)) {
          results.readback_mismatch++;
          failures.push({ source_ref: reel.source_ref, field, expected: reel[field], actual: readback[field] });
          console.error(`[READBACK MISMATCH] ${reel.source_ref} field=${field}`);
        }
      }
    } catch (err) {
      results.failed++;
      failures.push({ source_ref: reel.source_ref, error: err.message });
      console.error(`[FAILED] ${reel.source_ref}: ${err.message}`);
    }
  }

  console.log('[done]', JSON.stringify(results, null, 2));
  if (failures.length > 0) {
    const failPath = `outputs/reeldash_migration_failures_${stamp}.json`;
    fs.writeFileSync(failPath, JSON.stringify(failures, null, 2));
    console.log(`[done] ${failures.length} issue(s) logged to ${failPath}`);
  }
}

main().catch(err => { console.error('[FATAL]', err.message); process.exit(1); });
