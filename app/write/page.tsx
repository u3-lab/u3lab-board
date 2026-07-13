import { redirect } from 'next/navigation';

// 2026-07-13 B-1: リールの正は祐紀さんの reel board（Firebase）に一本化。
// このボードからのリール執筆/送信は廃止so、孤立した /write はボードへ寄せる（redirect）。
export default function WritePage() {
  redirect('/');
}
