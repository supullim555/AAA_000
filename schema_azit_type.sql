-- ═══════════════════════════════════════════════════════
-- Open Azitfh — azits 테이블에 type 컬럼 추가
-- Supabase 대시보드 SQL Editor에서 실행하세요.
-- ═══════════════════════════════════════════════════════

ALTER TABLE public.azits
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'general';
