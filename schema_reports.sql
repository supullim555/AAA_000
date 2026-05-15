-- ═══════════════════════════════════════════════════════
-- Open Azitfh — Reports & Admins Migration
-- schema.sql 실행 후 이 파일을 순서대로 실행하세요.
-- ═══════════════════════════════════════════════════════

-- ── 1. posts 테이블에 hidden 컬럼 추가 ────────────────

ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS hidden BOOLEAN NOT NULL DEFAULT false;

-- ── 2. Reports 테이블 ─────────────────────────────────

CREATE TABLE IF NOT EXISTS public.reports (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     UUID        NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  reporter_id UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (post_id, reporter_id)
);

-- ── 3. Admins 테이블 ──────────────────────────────────

CREATE TABLE IF NOT EXISTS public.admins (
  user_id    UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      TEXT        NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 4. RLS ────────────────────────────────────────────

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admins  ENABLE ROW LEVEL SECURITY;

-- reports: 자신의 신고 내역 조회 + 관리자 전체 조회
DROP POLICY IF EXISTS "reports_select" ON public.reports;
CREATE POLICY "reports_select" ON public.reports
  FOR SELECT USING (
    reporter_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "reports_insert" ON public.reports;
CREATE POLICY "reports_insert" ON public.reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "admins_select" ON public.admins;
CREATE POLICY "admins_select" ON public.admins
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "admins_manage" ON public.admins;
CREATE POLICY "admins_manage" ON public.admins
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
  );

-- ── 5. posts SELECT 정책 업데이트 ────────────────────
--   hidden=true 게시물은 관리자에게만 보임

DROP POLICY IF EXISTS "posts_select" ON public.posts;

CREATE POLICY "posts_select" ON public.posts
  FOR SELECT USING (
    hidden = false
    OR EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
  );

-- 공지사항 쓰기/삭제를 관리자 전용으로 변경
DROP POLICY IF EXISTS "notices_insert" ON public.notices;
DROP POLICY IF EXISTS "notices_delete" ON public.notices;

CREATE POLICY "notices_insert" ON public.notices
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
  );

CREATE POLICY "notices_delete" ON public.notices
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
  );

-- ── 6. Database Functions ────────────────────────────

-- 신고 제출 + 30% 초과 시 자동 숨김 (최소 3건 이상 필요)
CREATE OR REPLACE FUNCTION submit_report(p_post_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_category       TEXT;
  v_category_users INTEGER;
  v_report_count   INTEGER;
BEGIN
  -- 이미 신고했으면 중단
  IF EXISTS (
    SELECT 1 FROM public.reports
    WHERE post_id = p_post_id AND reporter_id = auth.uid()
  ) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'already_reported');
  END IF;

  -- 게시물 카테고리 조회
  SELECT category INTO v_category FROM public.posts WHERE id = p_post_id;

  -- 신고 등록
  INSERT INTO public.reports (post_id, reporter_id) VALUES (p_post_id, auth.uid());

  -- 해당 카테고리 고유 작성자 수
  SELECT COUNT(DISTINCT author_id) INTO v_category_users
  FROM public.posts WHERE category = v_category;

  -- 이 게시물의 신고 수
  SELECT COUNT(*) INTO v_report_count FROM public.reports WHERE post_id = p_post_id;

  -- 30% 초과 AND 최소 3건 이상이면 숨김
  IF v_category_users > 0
     AND v_report_count >= 3
     AND v_report_count::float / v_category_users >= 0.3
  THEN
    UPDATE public.posts SET hidden = true WHERE id = p_post_id;
    RETURN jsonb_build_object('success', true, 'hidden', true);
  END IF;

  RETURN jsonb_build_object('success', true, 'hidden', false, 'report_count', v_report_count);
END;
$$;

-- 게시물 복원 (관리자 전용, 신고 초기화 포함)
CREATE OR REPLACE FUNCTION unhide_post(p_post_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  UPDATE public.posts SET hidden = false WHERE id = p_post_id;
  DELETE FROM public.reports WHERE post_id = p_post_id;
END;
$$;

-- 관리자 게시물 삭제 (관리자 전용)
CREATE OR REPLACE FUNCTION admin_delete_post(p_post_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  DELETE FROM public.posts WHERE id = p_post_id;
END;
$$;

-- 이메일로 관리자 추가 (관리자 전용)
CREATE OR REPLACE FUNCTION add_admin_by_email(target_email TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT id INTO v_user_id FROM auth.users WHERE email = target_email;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'user_not_found');
  END IF;

  INSERT INTO public.admins (user_id, email)
  VALUES (v_user_id, target_email)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 관리자 제거 (마지막 관리자는 제거 불가)
CREATE OR REPLACE FUNCTION remove_admin(target_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF (SELECT COUNT(*) FROM public.admins) <= 1 THEN
    RAISE EXCEPTION 'Cannot remove the last admin';
  END IF;
  DELETE FROM public.admins WHERE user_id = target_user_id;
END;
$$;

-- ── 7. 첫 번째 관리자 등록 ───────────────────────────
-- 아래 이메일을 실제 관리자 계정으로 바꾸고 실행하세요.
-- (Supabase SQL Editor는 RLS를 우회하므로 직접 삽입 가능)
--
-- INSERT INTO public.admins (user_id, email)
-- SELECT id, email FROM auth.users WHERE email = 'admin@example.com';
