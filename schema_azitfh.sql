-- ═══════════════════════════════════════════════════════
-- Open Azitfh — Azitfh Framework Migration
-- categories 테이블에 아지트 전용 컬럼 추가
-- ═══════════════════════════════════════════════════════

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS type        TEXT NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS cover_color TEXT NOT NULL DEFAULT '#4aab8e',
  ADD COLUMN IF NOT EXISTS icon        TEXT NOT NULL DEFAULT '🏠';

-- type 값:
--   general  커뮤니티 (기본)
--   video    영상 특화
--   game     게임 특화
--   gallery  갤러리/이미지 특화

-- 기존 카테고리 기본값 적용 (이미 DEFAULT로 처리되나 명시적 업데이트)
UPDATE public.categories
SET type = 'general', cover_color = '#4aab8e', icon = '🏠'
WHERE type IS NULL OR type = '';
