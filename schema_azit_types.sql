-- ═══════════════════════════════════════════════════════
-- Open Azitfh — azit_types 테이블 (아지트 타입 관리)
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.azit_types (
  key        TEXT        PRIMARY KEY,
  label      TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.azit_types ENABLE ROW LEVEL SECURITY;

-- 전체 공개 읽기
CREATE POLICY "azit_types_select" ON public.azit_types
  FOR SELECT USING (true);

-- 로그인 유저면 누구나 타입 생성 가능
CREATE POLICY "azit_types_insert" ON public.azit_types
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 삭제는 관리자만
CREATE POLICY "azit_types_delete" ON public.azit_types
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
  );

-- 기본 시드
INSERT INTO public.azit_types (key, label)
VALUES ('general', '기본')
ON CONFLICT (key) DO NOTHING;
