-- DRAFT — not yet applied to production. Prepared 2026-07-10 per
-- umi/outputs/reel_dashboard_integration_20260710.md §3-4.
-- Waiting on 祐紀さんGO (本文1欄/2欄・アカウント枠の増え方 の2点確定待ち) before running.
-- See saku memory: project_reel_dashboard_firebase_exposure.md

-- 1. 投稿URL（IGリンク）の受け皿。chatgpt_url と分離必須。
ALTER TABLE reels ADD COLUMN IF NOT EXISTS post_url TEXT;

-- 2. アカウント区分の拡張。kind の CHECK を広げる（サブアカウント対応）。
--    shokunin=住職 / shashinka=写真家 / ldl=LiFE DESiGN LAB / kokoro=こころをうつす / other
ALTER TABLE reels DROP CONSTRAINT IF EXISTS reels_kind_check;
ALTER TABLE reels ADD CONSTRAINT reels_kind_check
  CHECK (kind IN ('shokunin','shashinka','ldl','kokoro','other'));

-- 3. ステータス語彙を光の4値＋前段＋終端に整理（下書き/収録待ち/撮影済み/予約済み/投稿済み/削除予定）。
--    「編集待ち」「収録済み」を廃し4本流に寄せる。適用前に既存値をマップすること。
ALTER TABLE reels DROP CONSTRAINT IF EXISTS reels_status_check;
ALTER TABLE reels ADD CONSTRAINT reels_status_check
  CHECK (status IN ('下書き','収録待ち','撮影済み','予約済み','投稿済み','削除予定'));

-- 4. アイデア/執筆の前段フラグ（4値本流と区別したい場合）。任意。
ALTER TABLE reels ADD COLUMN IF NOT EXISTS stage TEXT
  CHECK (stage IN ('idea','writing','production')) DEFAULT 'production';

-- 5. script/caption の二本立てを維持（本文を1欄化する場合はここを変更）。
--    ★未決事項：script=フル本文一本化 か script+caption二本立てか、祐紀さん確定待ち。

-- 6. 移行元トレース（surge由来か）と冪等移行のための一意キー。
ALTER TABLE reels ADD COLUMN IF NOT EXISTS source_ref TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS reels_source_ref_uidx ON reels (source_ref) WHERE source_ref IS NOT NULL;

-- 7. 重複検索用の複合インデックス（title/theme + publish_date）。
CREATE INDEX IF NOT EXISTS reels_theme_date_idx ON reels (theme, publish_date);
