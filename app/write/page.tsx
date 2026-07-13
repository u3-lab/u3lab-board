'use client';
import { useState } from 'react';
import type { ReelKind } from '@/lib/types';

// リール下書き・作業領域
// 2026-07-13 B-1: リールの正は祐紀さんの reel board（Firebase）に一本化。
// このページからボードへの送信（POST /api/reels）は廃止。ローカルの下書き・コピー用として残す。
// ※このページの最終的な扱い（残す/消す/redirect）は海の判断待ち。

const KIND_LABEL: Record<ReelKind, string> = { shokunin: '住職', shashinka: '写真家', ldl: 'LDL', kokoro: 'こころをうつす', other: 'その他' };
const KIND_ACCENT: Record<ReelKind, string> = {
  shokunin: 'border-l-amber-500', shashinka: 'border-l-sky-500', ldl: 'border-l-emerald-500', kokoro: 'border-l-pink-500', other: 'border-l-stone-500',
};

export default function WritePage() {
  const [kind, setKind] = useState<ReelKind>('shokunin');
  const [theme, setTheme] = useState('');
  const [script, setScript] = useState('');
  const [caption, setCaption] = useState('');

  return (
    <div className="min-h-screen flex justify-center px-4 py-10">
      <div className="w-full max-w-3xl flex flex-col gap-4">
        <div>
          <h1 className="text-lg text-stone-100 font-semibold">✍️ リール下書き</h1>
          <p className="text-xs text-stone-500 mt-1">下書き・コピー用の作業領域です。リールの管理は祐紀さんの reel board に一本化されました（このページからボードへは送信しません）。</p>
        </div>

        <div className={`flex gap-2 flex-wrap pl-3 border-l-4 ${KIND_ACCENT[kind]}`}>
          <select value={kind} onChange={e => setKind(e.target.value as ReelKind)} className="text-sm border border-stone-600 rounded px-3 py-2 bg-stone-800 text-stone-200">
            {Object.entries(KIND_LABEL).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
          <input
            value={theme}
            onChange={e => setTheme(e.target.value)}
            placeholder="テーマ・タイトル"
            className="flex-1 min-w-0 text-sm border border-stone-600 rounded px-3 py-2 bg-stone-800 text-stone-100 placeholder-stone-500 outline-none focus:border-stone-400"
          />
        </div>

        <textarea
          value={script}
          onChange={e => setScript(e.target.value)}
          placeholder="本文（シナリオ）"
          rows={20}
          className="w-full text-base border border-stone-600 rounded-lg px-4 py-3 bg-stone-800 text-stone-100 placeholder-stone-500 outline-none focus:border-stone-400 leading-relaxed font-mono"
        />

        <textarea
          value={caption}
          onChange={e => setCaption(e.target.value)}
          placeholder="キャプション"
          rows={8}
          className="w-full text-sm border border-stone-600 rounded-lg px-4 py-3 bg-stone-800 text-stone-100 placeholder-stone-500 outline-none focus:border-stone-400 leading-relaxed"
        />

        <div className="flex items-center justify-between pt-2">
          <a href="/?tab=reels" className="text-xs text-stone-500 hover:text-stone-300">← ボード（🎬配信）を見る</a>
        </div>
      </div>
    </div>
  );
}
