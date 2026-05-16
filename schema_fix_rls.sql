-- ═══════════════════════════════════════════════════════
-- Open Azitfh — RLS 보안 수정
-- schema_rename_azit.sql 이후에 실행하세요.
--
-- 수정 사항:
--   1. azits DELETE 정책: 기존에는 로그인한 모든 유저가
--      타인의 아지트를 삭제할 수 있었습니다.
--      → 본인이 만든 아지트 또는 관리자만 삭제 가능하도록 수정.
--
--   2. azits INSERT 정책: creator_id 검증 추가.
-- ═══════════════════════════════════════════════════════

-- ── 1. azits DELETE — 본인 또는 관리자만 ─────────────
DROP POLICY IF EXISTS "categories_delete" ON public.azits;
DROP POLICY IF EXISTS "azits_delete"      ON public.azits;

CREATE POLICY "azits_delete" ON public.azits
  FOR DELETE USING (
    creator_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
  );

-- ── 2. azits INSERT — 로그인 + 본인 creator_id 검증 ──
DROP POLICY IF EXISTS "categories_insert" ON public.azits;
DROP POLICY IF EXISTS "azits_insert"      ON public.azits;

CREATE POLICY "azits_insert" ON public.azits
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND (creator_id IS NULL OR creator_id = auth.uid())
  );
