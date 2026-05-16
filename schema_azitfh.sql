-- ═══════════════════════════════════════════════════════
-- Open Azitfh — Azitfh Engine Migration
-- categories 테이블에 아지트 전용 컬럼 추가
-- ═══════════════════════════════════════════════════════

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS cover_color TEXT NOT NULL DEFAULT '#4aab8e',
  ADD COLUMN IF NOT EXISTS icon        TEXT NOT NULL DEFAULT '🏠';
