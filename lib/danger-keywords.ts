// 相談内容の危険フラグ自動検知（補助のみ・外部AI不使用・単純な文字列マッチ）。
// 見落とし防止の一次スクリーニングであり、これだけに頼らない。
// 誰でも手動でdanger_flagを立てられる運用と併用する前提。
// キーワードは今後の運用状況を見て随時見直す。

export const DANGER_KEYWORDS = [
  '死にたい',
  '消えたい',
  '自殺',
  '死のう',
  '生きていたくない',
  '生きるのがつらい',
  '生きるのが辛い',
  'リストカット',
  'リスカ',
  '首を吊る',
  '飛び降り',
  'オーバードーズ',
  '終わりにしたい',
  'もう無理',
  'もう限界',
];

export function detectDangerKeyword(text: string): string | null {
  for (const kw of DANGER_KEYWORDS) {
    if (text.includes(kw)) return kw;
  }
  return null;
}
