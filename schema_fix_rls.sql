-- ═══════════════════════════════════════════════════════
-- Open Azitfh — RLS 보안 수정
-- schema_rename_azit.sql 이후에 실행하세요.
--
-- 수정 사항:
--   1. admins_manage 정책 제거: admins 테이블을 자기 참조해
--      SELECT 시 무한 루프(500 에러) 유발 → 삭제.
--      (INSERT/DELETE는 SECURITY DEFINER 함수가 처리)
--
--   2. azits DELETE 정책: 본인 또는 관리자만 삭제 가능.
--
--   3. azits INSERT 정책: creator_id 검증 추가.
-- ═══════════════════════════════════════════════════════

-- ── 0. admins 무한 재귀 정책 제거 ────────────────────
DROP POLICY IF EXISTS admins_manage ON public.admins;

-- ── 1. azits DELETE — 본인 또는 관리자만 ─────────────
DROP POLICY IF EXISTS categories_delete ON public.azits;
DROP POLICY IF EXISTS azits_delete      ON public.azits;

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
