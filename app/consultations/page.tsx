'use client';
import { useState, useEffect, useCallback } from 'react';
import type { Consultation, ConsultationStatus } from '@/lib/types';

const STATUS_ORDER: ConsultationStatus[] = ['未対応', '対応中', '祐紀さん返信待ち', '完了'];
const STATUS_COLOR: Record<ConsultationStatus, string> = {
  '未対応': 'border-amber-600 text-amber-400',
  '対応中': 'border-sky-600 text-sky-400',
  '祐紀さん返信待ち': 'border-violet-600 text-violet-400',
  '完了': 'border-stone-600 text-stone-500',
};

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function ConsultationsPage() {
  const [items, setItems] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Consultation | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);

  const load = useCallback(async () => {
    const data = await fetch('/api/consultations').then(r => r.json());
    setItems(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const patch = useCallback(async (id: string, updates: Partial<Consultation>) => {
    const res = await fetch(`/api/consultations?id=${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    const updated = await res.json();
    setItems(prev => prev.map(c => (c.id === id ? updated : c)));
    setSelected(prev => (prev && prev.id === id ? updated : prev));
  }, []);

  const dangerOpen = items.filter(c => c.danger_flag && !c.danger_ack);
  const activeByStatus = (status: ConsultationStatus) =>
    items.filter(c => c.status === status && !(c.danger_flag && !c.danger_ack));

  return (
    <div className="min-h-screen bg-stone-900 text-stone-200 flex">
      <aside className="w-56 border-r border-stone-800 p-4">
        <h1 className="text-sm font-medium text-stone-300 mb-4">💬 相談</h1>
        {dangerOpen.length > 0 && (
          <div className="mb-3 px-2 py-1.5 rounded bg-red-950 border border-red-700 text-red-300 text-xs">
            🔴 要確認 {dangerOpen.length}件
          </div>
        )}
        <label className="flex items-center gap-2 text-xs text-stone-500 mt-2 cursor-pointer">
          <input type="checkbox" checked={showCompleted} onChange={e => setShowCompleted(e.target.checked)} />
          完了を表示
        </label>
      </aside>

      <main className="flex-1 p-6 max-w-2xl">
        {loading ? (
          <p className="text-sm text-stone-600 text-center py-12">読み込み中...</p>
        ) : (
          <div className="space-y-6">
            {dangerOpen.length > 0 && (
              <section>
                <h2 className="text-xs font-medium text-red-400 mb-2">🔴 要確認（危険フラグ・未確認）</h2>
                <div className="space-y-2">
                  {dangerOpen.map(c => (
                    <ConsultationRow key={c.id} c={c} onOpen={setSelected} danger />
                  ))}
                </div>
              </section>
            )}
            {STATUS_ORDER.filter(s => showCompleted || s !== '完了').map(status => {
              const list = activeByStatus(status);
              if (list.length === 0) return null;
              return (
                <section key={status}>
                  <h2 className={`text-xs font-medium mb-2 ${STATUS_COLOR[status]}`}>{status} ({list.length})</h2>
                  <div className="space-y-2">
                    {list.map(c => <ConsultationRow key={c.id} c={c} onOpen={setSelected} />)}
                  </div>
                </section>
              );
            })}
            {items.length === 0 && <p className="text-sm text-stone-600">相談はありません</p>}
          </div>
        )}
      </main>

      {selected && (
        <ConsultationDetail
          c={selected}
          onClose={() => setSelected(null)}
          onPatch={updates => patch(selected.id, updates)}
        />
      )}
    </div>
  );
}

function ConsultationRow({ c, onOpen, danger }: { c: Consultation; onOpen: (c: Consultation) => void; danger?: boolean }) {
  return (
    <div
      onClick={() => onOpen(c)}
      className={`rounded-lg p-3 text-xs cursor-pointer hover:brightness-125 transition-[filter] ${
        danger ? 'bg-red-950 border border-red-700' : 'bg-stone-800'
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="font-medium text-stone-100">{c.consultant_name}さん</span>
        <span className="text-stone-500">{formatDateTime(c.received_at)}</span>
      </div>
      <p className="text-stone-500">[{c.channel}]</p>
      <p className="text-stone-400 truncate mt-1">{c.content}</p>
    </div>
  );
}

function ConsultationDetail({ c, onClose, onPatch }: {
  c: Consultation;
  onClose: () => void;
  onPatch: (updates: Partial<Consultation>) => void;
}) {
  const [replyDraft, setReplyDraft] = useState(c.reply_draft ?? '');
  useEffect(() => { setReplyDraft(c.reply_draft ?? ''); }, [c.id, c.reply_draft]);

  return (
    <div className="w-96 border-l border-stone-800 p-5 overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-base text-stone-100 font-medium">{c.consultant_name}さん</p>
          <p className="text-xs text-stone-500">[{c.channel}] 受信: {formatDateTime(c.received_at)}</p>
        </div>
        <button onClick={onClose} className="text-stone-500 hover:text-stone-300 text-sm">✕</button>
      </div>

      {c.danger_flag && (
        <div className={`mb-4 p-3 rounded border ${c.danger_ack ? 'border-stone-600 bg-stone-800' : 'border-red-600 bg-red-950'}`}>
          <p className={`text-sm font-medium ${c.danger_ack ? 'text-stone-400' : 'text-red-300'}`}>
            ⚠️ 危険フラグ: {c.danger_ack ? '確認済み' : 'ON（未確認）'}
          </p>
          {c.danger_note && <p className="text-xs text-stone-500 mt-1">{c.danger_note}</p>}
          <div className="flex gap-2 mt-2">
            {!c.danger_ack && (
              <button
                onClick={() => onPatch({ danger_ack: true })}
                className="text-xs px-2 py-1 rounded bg-red-700 hover:bg-red-600 text-white"
              >
                確認済みにする
              </button>
            )}
            <button
              onClick={() => onPatch({ danger_flag: false })}
              className="text-xs px-2 py-1 rounded bg-stone-700 hover:bg-stone-600 text-stone-300"
            >
              フラグ解除
            </button>
          </div>
        </div>
      )}
      {!c.danger_flag && (
        <button
          onClick={() => onPatch({ danger_flag: true, danger_note: '手動フラグ' })}
          className="mb-4 text-xs px-2 py-1 rounded border border-red-700 text-red-400 hover:bg-red-950"
        >
          ⚠️ 危険フラグを立てる
        </button>
      )}

      <div className="mb-4">
        <p className="text-xs text-stone-500 mb-1">相談内容</p>
        <div className="text-sm text-stone-200 bg-stone-800 rounded p-3 whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
          {c.content}
        </div>
      </div>

      <div className="mb-4">
        <p className="text-xs text-stone-500 mb-1">返信文</p>
        <textarea
          value={replyDraft}
          onChange={e => setReplyDraft(e.target.value)}
          onBlur={() => { if (replyDraft !== (c.reply_draft ?? '')) onPatch({ reply_draft: replyDraft }); }}
          className="w-full text-sm bg-stone-800 border border-stone-700 rounded p-3 text-stone-200 min-h-32"
          placeholder="返信文をここに書く"
        />
      </div>

      <div>
        <p className="text-xs text-stone-500 mb-1">ステータス</p>
        <select
          value={c.status}
          onChange={e => onPatch({ status: e.target.value as ConsultationStatus })}
          className="text-sm bg-stone-800 border border-stone-700 rounded px-2 py-1.5 text-stone-200"
        >
          {STATUS_ORDER.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
    </div>
  );
}
