'use client';
import { useState, useEffect } from 'react';
import type { Reel, ReelKind } from '@/lib/types';

// リール執筆専用ページ（たたき台 v1・2026-07-10）
// 祐紀さんの原則：「ボード＝見る場所・作業しない／執筆＝作業だから別ページ」
// surgeダッシュボードの書き味（広い本文欄・集中できる単一フォーム）を引き継ぐ。
// 「ボードへ送る」を押すまでboard reelsには一切書き込まない。

const KIND_LABEL: Record<ReelKind, string> = { shokunin: '住職', shashinka: '写真家', ldl: 'LDL', kokoro: 'こころをうつす', other: 'その他' };
// アカウント別アクセント色（ボードのカード色分けと揃える）
const KIND_ACCENT: Record<ReelKind, string> = {
  shokunin: 'border-l-amber-500', shashinka: 'border-l-sky-500', ldl: 'border-l-emerald-500', kokoro: 'border-l-pink-500', other: 'border-l-stone-500',
};

type ReadbackResult = { ok: boolean; mismatches: string[] };

const todayJst = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

export default function WritePage() {
  const [reels, setReels] = useState<Reel[]>([]);
  const [kind, setKind] = useState<ReelKind>('shokunin');
  const [theme, setTheme] = useState('');
  const [publishDate, setPublishDate] = useState('');
  const [requestDate, setRequestDate] = useState(todayJst());
  const [script, setScript] = useState('');
  const [caption, setCaption] = useState('');
  const [chatgptUrl, setChatgptUrl] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<ReadbackResult | null>(null);

  useEffect(() => {
    fetch('/api/reels').then(r => r.json()).then(d => setReels(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  const themeMatch = theme.trim()
    ? reels.find(r => r.theme?.trim().toLowerCase() === theme.trim().toLowerCase())
    : undefined;

  const reset = () => {
    setTheme('');
    setPublishDate('');
    setRequestDate(todayJst());
    setScript('');
    setCaption('');
    setChatgptUrl('');
    setSent(null);
  };

  const canSend = theme.trim().length > 0 && publishDate.length > 0;

  const handleSend = async () => {
    if (!canSend) return;
    if (themeMatch && !window.confirm(`同じテーマ名のリールが既にあります（${KIND_LABEL[themeMatch.kind]}・${themeMatch.status}）。それでも送りますか？`)) {
      return;
    }
    setSending(true);
    const res = await fetch('/api/reels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        theme: theme.trim(),
        kind,
        status: '収録待ち',
        publish_date: publishDate,
        request_date: requestDate || null,
        script: script.trim() || null,
        caption: caption.trim() || null,
        chatgpt_url: chatgptUrl.trim() || null,
      }),
    });
    setSending(false);
    if (!res.ok) {
      window.alert('送信に失敗しました。もう一度お試しください');
      return;
    }
    const created: Reel & { _readback: ReadbackResult } = await res.json();
    setReels(rs => [...rs, created]);
    setSent(created._readback);
    if (created._readback.ok) reset();
  };

  return (
    <div className="min-h-screen flex justify-center px-4 py-10">
      <div className="w-full max-w-3xl flex flex-col gap-4">
        <div>
          <h1 className="text-lg text-stone-100 font-semibold">✍️ リール執筆</h1>
          <p className="text-xs text-stone-500 mt-1">ここは書くための場所です。書き終えたら「ボードへ送る」を押してください（それまでボードには反映されません）</p>
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
        {themeMatch && (
          <p className="text-xs text-yellow-500 -mt-2">⚠ 同じテーマ名のリールが既にあります（{KIND_LABEL[themeMatch.kind]}・{themeMatch.status}・公開日 {themeMatch.publish_date ?? '未設定'}）</p>
        )}

        <div className="flex gap-4 flex-wrap">
          <label className="flex items-center gap-2 text-xs text-stone-400">
            配信日 <span className="text-red-400">必須</span>
            <input type="date" value={publishDate} onChange={e => setPublishDate(e.target.value)} className="border border-stone-600 rounded px-2 py-1.5 bg-stone-800 text-stone-200 outline-none focus:border-stone-400" />
          </label>
          <label className="flex items-center gap-2 text-xs text-stone-400">
            依頼日
            <input type="date" value={requestDate} onChange={e => setRequestDate(e.target.value)} className="border border-stone-600 rounded px-2 py-1.5 bg-stone-800 text-stone-200 outline-none focus:border-stone-400" />
          </label>
        </div>

        <textarea
          value={script}
          onChange={e => setScript(e.target.value)}
          placeholder="本文（シナリオ）"
          rows={20}
          autoFocus
          className="w-full text-base border border-stone-600 rounded-lg px-4 py-3 bg-stone-800 text-stone-100 placeholder-stone-500 outline-none focus:border-stone-400 leading-relaxed font-mono"
        />

        <textarea
          value={caption}
          onChange={e => setCaption(e.target.value)}
          placeholder="キャプション"
          rows={8}
          className="w-full text-sm border border-stone-600 rounded-lg px-4 py-3 bg-stone-800 text-stone-100 placeholder-stone-500 outline-none focus:border-stone-400 leading-relaxed"
        />

        <input
          value={chatgptUrl}
          onChange={e => setChatgptUrl(e.target.value)}
          placeholder="ChatGPT URL（任意）"
          className="w-full text-xs border border-stone-600 rounded px-3 py-2 bg-stone-800 text-stone-300 placeholder-stone-500 outline-none focus:border-stone-400"
        />

        {sent && (
          sent.ok ? (
            <p className="text-sm text-green-400">✓ ボードへ送りました（read-back照合OK・字化けなし）</p>
          ) : (
            <p className="text-sm text-red-400">⚠ ボードへは送られましたが read-back照合で不一致: {sent.mismatches.join(', ')}（内容を確認してください）</p>
          )
        )}

        <div className="flex items-center justify-between pt-2">
          <a href="/?tab=reels" className="text-xs text-stone-500 hover:text-stone-300">← ボードを見る</a>
          <button
            onClick={handleSend}
            disabled={sending || !canSend}
            title={!canSend ? 'テーマ・配信日は必須です' : undefined}
            className="text-sm px-5 py-2.5 bg-stone-100 text-stone-900 rounded hover:bg-white disabled:opacity-40 font-medium"
          >
            {sending ? '送信中...' : 'ボードへ送る'}
          </button>
        </div>
      </div>
    </div>
  );
}
