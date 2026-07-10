// Backfills script/caption/post_url from the surge Firebase snapshot onto board
// reels that were linked via source_ref-only backfill (dedup path in
// migrate_reeldash_to_board.mjs) -- those rows kept their pre-existing (null)
// script/caption because they came from the Notion sync gap. Never touches a
// non-null field. Read-back verifies only the fields actually written.
//
// Usage:
//   bun tools/backfill_reeldash_body.mjs <snapshot.json>            # dry-run
//   bun tools/backfill_reeldash_body.mjs <snapshot.json> --apply     # writes + read-back

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

function loadEnv(path) {
  return Object.fromEntries(
    fs.readFileSync(path, 'utf8').replace(/^﻿/, '').split('\n').filter(l => l.includes('='))
      .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
  );
}

async function main() {
  const apply = process.argv.includes('--apply');
  const snapshotPath = process.argv[2];
  if (!snapshotPath) throw new Error('usage: backfill_reeldash_body.mjs <snapshot.json> [--apply]');

  const raw = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
  const state = raw.state ?? raw;
  const surgeById = new Map((state.reels ?? []).map(r => [`surge:${r.id}`, r]));

  const env = loadEnv('.env.local');
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  const { data: boardRows, error } = await db.from('reels').select('*').like('source_ref', 'surge:%');
  if (error) throw error;

  const candidates = boardRows.filter(r => r.script === null || r.caption === null || r.post_url === null);
  console.log(`[scan] ${boardRows.length} surge-linked rows, ${candidates.length} with at least one null field to backfill`);

  const plan = [];
  for (const row of candidates) {
    const surge = surgeById.get(row.source_ref);
    if (!surge) { console.warn(`[skip] ${row.source_ref} not found in snapshot`); continue; }
    const patch = {};
    if (row.script === null && surge.script) patch.script = surge.script;
    if (row.caption === null && surge.caption) patch.caption = surge.caption;
    if (row.post_url === null && surge.url) patch.post_url = surge.url;
    if (Object.keys(patch).length > 0) plan.push({ id: row.id, source_ref: row.source_ref, theme: row.theme, patch });
  }
  console.log(`[plan] ${plan.length} rows have surge content to backfill (null-only, never overwrites non-null)`);

  if (!apply) {
    console.log('[dry-run] sample (first 2):', JSON.stringify(plan.slice(0, 2).map(p => ({
      id: p.id, theme: p.theme, patch_fields: Object.keys(p.patch),
    })), null, 2));
    console.log('[dry-run] pass --apply to write.');
    return;
  }

  const results = { updated: 0, failed: 0, readback_mismatch: 0 };
  const failures = [];
  for (const p of plan) {
    try {
      const { error: updErr } = await db.from('reels').update(p.patch).eq('id', p.id);
      if (updErr) throw updErr;
      results.updated++;

      const { data: readback, error: rbErr } = await db.from('reels').select('*').eq('id', p.id).single();
      if (rbErr) throw rbErr;
      for (const field of Object.keys(p.patch)) {
        if (readback[field] !== p.patch[field]) {
          results.readback_mismatch++;
          failures.push({ source_ref: p.source_ref, field, expected: p.patch[field], actual: readback[field] });
          console.error(`[READBACK MISMATCH] ${p.source_ref} field=${field}`);
        }
      }
    } catch (err) {
      results.failed++;
      failures.push({ source_ref: p.source_ref, error: err.message });
      console.error(`[FAILED] ${p.source_ref}: ${err.message}`);
    }
  }

  console.log('[done]', JSON.stringify(results, null, 2));
  if (failures.length > 0) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const failPath = `outputs/reeldash_backfill_failures_${stamp}.json`;
    fs.writeFileSync(failPath, JSON.stringify(failures, null, 2));
    console.log(`[done] issues logged to ${failPath}`);
  }
}

main().catch(err => { console.error('[FATAL]', err.message); process.exit(1); });
