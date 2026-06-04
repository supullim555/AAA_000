# Open Azitfh — Claude Code 가이드

> 이 파일은 Claude Code가 프로젝트를 이해하고 작업하기 위한 완전한 참조 문서입니다.
> 새 세션에서는 이 파일을 먼저 읽고 시작하세요.

## 1. 프로젝트 개요

**Open Azitfh** — 한국어 커뮤니티 플랫폼 (Vanilla JS + Supabase)

| 항목 | 값 |
|------|-----|
| 사이트 URL | https://aaa-000.vercel.app |
| GitHub 저장소 | https://github.com/supullim555/AAA_000 |
| Supabase URL | https://ywyzcyvlfafmwoxjxmck.supabase.co |
| Supabase Anon Key | `sb_publishable_y7y5eFDZ3N2YDJsTL5RZ2g_b-Y91W7k` |
| Supabase 프로젝트 ID | `ywyzcyvlfafmwoxjxmck` (MCP 도구에서 사용) |
| 호스팅 | Vercel 정적 사이트 |
| 기본 브랜치 | `master` |

## 2. 파일 구조

```
FFS/
├── CLAUDE.md          ← 이 파일
├── index.html         ← 홈페이지 (아지트 목록 + 게시물 목록)
├── dashboard.html     ← 내 공간 (아지트 관리)
├── azit-create.html   ← 아지트 만들기
├── azit-rename.html   ← 아지트 수정
├── azit-type-create.html ← 커스텀 아지트 타입 생성
├── azitfh.html        ← 아지트 상세 페이지
├── post-write.html    ← 게시물 작성
├── post-edit.html     ← 게시물 수정
├── post-detail.html   ← 게시물 상세
├── post-manage.html   ← 내 게시물 관리
├── login.html / signup.html / forgot.html / reset-password.html
├── admin.html         ← 관리자 패널
├── app.js             ← 핵심 로직 (~2800줄, 모든 페이지 공통)
├── azitfh.js          ← 아지트 상세 전용 로직
├── admin.js           ← 관리자 패널 로직
├── style.css          ← 다크/라이트 테마 스타일
├── supabase-config.js ← Supabase 클라이언트 초기화
├── vercel.json        ← 보안 헤더 설정
└── scripts/
    └── ai.js          ← AI용 CLI 도구 (읽기/쓰기/댓글)
```

## 3. 기술 스택

- **프론트엔드**: Vanilla JS (빌드 없음), CSS 변수 기반 다크/라이트 테마
- **DB + Auth**: Supabase (PostgreSQL + PostgREST + Auth)
- **파일 저장**: Supabase Storage (`post-media` 버킷, 공개)
- **코드 실행**: Judge0 CE (https://ce.judge0.com, 무료, 키 불필요)
- **리치 에디터**: Quill.js 1.3.7 (post-write/edit에서만 로드)
- **HTML 정화**: DOMPurify 3 (post-detail에서만 로드)

## 4. DB 스키마

### posts
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid PK | gen_random_uuid() |
| title | text NOT NULL | 게시물 제목 |
| content | text NULL | 본문 HTML (Quill) 또는 설명 텍스트 또는 코드 |
| category | text NOT NULL | 아지트 이름 (azits.name 참조) |
| author_id | uuid NOT NULL | auth.users.id |
| author_nickname | text NOT NULL | 작성자 닉네임 (비정규화) |
| views | int DEFAULT 0 | 조회수 |
| hidden | bool DEFAULT false | 신고로 숨김 처리됨 |
| created_at | timestamptz | |
| game_url | text NULL | 웹게임 URL (Supabase Storage) |
| game_genre | text NULL | 게임 장르 |
| thumbnail_url | text NULL | 썸네일 이미지 URL |
| video_url | text NULL | 영상 URL (Supabase Storage) |
| code_lang | text NULL | 코드 언어 (있으면 코드 게시물) |
| code_files | jsonb NULL | 멀티파일 [{name, lang, code}, ...] |

**게시물 타입 판별:**
- 웹게임: `game_url IS NOT NULL`
- 영상: `video_url IS NOT NULL`
- 코드(단일파일): `code_lang IS NOT NULL AND code_files IS NULL`
- 코드(멀티파일): `code_files IS NOT NULL`
- 일반 리치텍스트: 위 모두 NULL

### azits
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid PK | |
| name | text NOT NULL UNIQUE | 아지트 이름 |
| description | text NULL | 소개 |
| created_by | text DEFAULT '익명' | 만든이 닉네임 |
| creator_id | uuid NULL | auth.users.id |
| type | text DEFAULT 'general' | azit_types.key 참조 |
| icon | text DEFAULT '🏠' | 이모지 아이콘 |
| cover_color | text DEFAULT '#4aab8e' | 헥스 색상 |
| sort_order | int NULL | 대시보드 정렬 순서 |
| created_at | timestamptz | |

### azit_types
| key | label | default_icon | default_color | 설명 |
|-----|-------|-------------|---------------|------|
| general | 기본 | 🏠 | #4aab8e | 리치텍스트 게시물 |
| 웹게임 | 웹게임 | 🎮 | #5c4fc2 | HTML5 게임 폴더 업로드 |
| 영상 | 영상 | 🎬 | #c0392b | 영상 파일 업로드 |
| 코드 | 코드 | 💻 | #2563eb | 멀티파일 코드 에디터 + 실행 |

### comments
| 컬럼 | 타입 |
|------|------|
| id | uuid PK |
| post_id | uuid NOT NULL → posts.id |
| author_id | uuid NOT NULL → auth.users.id |
| author_nickname | text NOT NULL |
| content | text NOT NULL |
| parent_id | uuid NULL → comments.id (대댓글) |
| created_at | timestamptz |

### bookmarks

- user_id, post_id (UNIQUE), created_at
- RLS: 본인만 관리

### notifications

- user_id, type('comment'|'reply'|'vote'), post_id, comment_id, actor_nickname, read, created_at
- trg_notify_comment: 댓글 INSERT 시 게시물 작성자/원댓글 작성자에게 자동 알림 생성

### votes
- post_id, user_id, vote_type ('up' or 'down'), created_at

### reports
- post_id, reporter_id, reason, created_at
- 3건 이상 신고 → posts.hidden = true 자동 처리

### notices, admins
- notices: title, date(text), created_at
- admins: user_id, email, granted_at

## 5. Supabase REST API

**기본 헤더:**
```
apikey: sb_publishable_y7y5eFDZ3N2YDJsTL5RZ2g_b-Y91W7k
Authorization: Bearer <JWT 또는 anon key>
Content-Type: application/json
Prefer: return=representation  (INSERT 시 생성된 레코드 반환)
```

**인증 (로그인):**
```
POST https://ywyzcyvlfafmwoxjxmck.supabase.co/auth/v1/token?grant_type=password
Body: {"email": "...", "password": "..."}
응답: {"access_token": "...", "user": {...}}
```

**읽기 예시:**
```
# 최근 게시물 (숨김 제외)
GET /rest/v1/posts?select=*&hidden=eq.false&order=created_at.desc&limit=20

# 특정 아지트 게시물
GET /rest/v1/posts?select=*&category=eq.코딩아지트&hidden=eq.false&order=created_at.desc

# 아지트 목록
GET /rest/v1/azits?select=*&order=sort_order.asc.nullslast,created_at.asc

# 게시물 상세
GET /rest/v1/posts?select=*&id=eq.<UUID>&single=true

# 댓글
GET /rest/v1/comments?select=*&post_id=eq.<UUID>&order=created_at.asc
```

**쓰기 예시 (JWT 필요):**
```
# 일반 게시물 작성
POST /rest/v1/posts
Body: {
  "title": "제목",
  "content": "<p>HTML 내용</p>",
  "category": "공부용 아지트",
  "author_id": "<user-uuid>",
  "author_nickname": "닉네임",
  "views": 0
}

# 코드 게시물 (단일파일)
Body: {
  "title": "제목",
  "content": "print('hello')",
  "category": "코딩아지트",
  "author_id": "<uuid>",
  "author_nickname": "닉네임",
  "code_lang": "Python",
  "views": 0
}

# 코드 게시물 (멀티파일)
Body: {
  "title": "제목",
  "content": null,
  "code_lang": "Python",
  "code_files": [
    {"name": "main.py", "lang": "Python", "code": "from utils import add\nprint(add(1,2))"},
    {"name": "utils.py", "lang": "Python", "code": "def add(a,b): return a+b"}
  ],
  "category": "코딩아지트",
  "author_id": "<uuid>",
  "author_nickname": "닉네임",
  "views": 0
}

# 댓글 작성
POST /rest/v1/comments
Body: {
  "post_id": "<post-uuid>",
  "author_id": "<user-uuid>",
  "author_nickname": "닉네임",
  "content": "댓글 내용"
}
```

## 6. MCP Supabase 도구 (Claude Code에서 바로 사용)

```javascript
// DB 직접 쿼리 (관리자 권한)
mcp__supabase__execute_sql({
  project_id: "ywyzcyvlfafmwoxjxmck",
  query: "SELECT * FROM posts WHERE hidden = false ORDER BY created_at DESC LIMIT 10"
})

// 로그 확인
mcp__supabase__get_logs({ project_id: "ywyzcyvlfafmwoxjxmck", service: "api" })

// 테이블 목록
mcp__supabase__list_tables({ project_id: "ywyzcyvlfafmwoxjxmck", schemas: ["public"] })
```

## 7. CLI 스크립트 사용법

```bash
# 읽기 (인증 불필요)
node scripts/ai.js read posts                    # 최근 게시물 20개
node scripts/ai.js read posts --cat 코딩아지트   # 특정 아지트 게시물
node scripts/ai.js read post <UUID>              # 게시물 상세
node scripts/ai.js read azits                   # 아지트 목록
node scripts/ai.js read comments <POST_UUID>    # 댓글 목록

# 쓰기 (이메일/비밀번호 필요)
node scripts/ai.js write post \
  --email aaaa@gmail.com --password aaaaaaaa \
  --title "AI가 작성한 글" \
  --content "안녕하세요! AI가 작성한 게시물입니다." \
  --cat "공부용 아지트"

node scripts/ai.js write code \
  --email aaaa@gmail.com --password aaaaaaaa \
  --title "피보나치 수열" \
  --lang Python \
  --cat "코딩아지트"
  # (코드는 stdin 또는 --file 옵션)

node scripts/ai.js write comment \
  --email aaaa@gmail.com --password aaaaaaaa \
  --post <UUID> \
  --content "좋은 글이에요!"

# 정보 조회
node scripts/ai.js info   # 사이트 현황 요약
```

## 8. app.js 핵심 패턴

### 캐시 시스템
```javascript
// _makeCache(fetcher, ttlMs) — thundering herd 방지, 실패 시 재시도 허용
const _postsStore  = _makeCache(() => getPosts(), 30_000);   // 30초
const _catsStore   = _makeCache(() => getCategories(), 60_000); // 1분
const _typesStore  = _makeCache(() => getAzitTypes(), 300_000); // 5분

// 캐시 무효화: insertPost/deletePost → invalidatePostsCache()
//              insertCategory/deleteCategory/renameAzit → invalidateCategoriesCache()
```

### 각 페이지 진입점

| 페이지 | init 함수 | 로드하는 JS |
|--------|----------|------------|
| index.html | `initIndex()` | app.js |
| dashboard.html | `initDashboard()` | app.js |
| azit-create.html | `initAzitCreate()` | app.js |
| azitfh.html | `initAzitfh()` | app.js + azitfh.js |
| post-write.html | `initPostWrite()` | app.js + quill.js |
| post-detail.html | `initPostDetail()` | app.js + dompurify.js + prism.js |
| post-edit.html | `initPostEdit()` | app.js + quill.js |
| profile.html | `initProfile()` | app.js |
| bookmarks.html | `initBookmarksPage()` | app.js |
| notifications.html | `initNotificationsPage()` | app.js |
| admin.html | `initAdminPanel()` | app.js + admin.js |

### 코드 실행
- **브라우저 실행** (HTML/JS/CSS): `buildCodeSrcdoc(code, lang)` → `srcdoc` iframe
- **서버 실행** (Python/C/C++): `runWithJudge0(code, lang)` → Judge0 CE API
- **멀티파일 서버**: `runMultiFilesWithJudge0(files, lang)` → ZIP `additional_files`
- **멀티파일 브라우저**: `buildMultiFileSrcdoc(files)` → HTML+CSS+JS 합성

### DB 트리거
- `trg_sanitize_post`: 빈 문자열 → NULL 자동 변환 (content, url 필드들)
- `trg_sanitize_azit`: description 빈 문자열 → NULL

## 9. 보안 패턴

- **RLS**: Supabase Row Level Security 활성화
  - posts 읽기: 공개 (hidden=false)
  - posts 쓰기: 로그인한 사용자만
  - azits 쓰기: creator_id = auth.uid()
- **게임 iframe**: `sandbox="allow-scripts"` (allow-same-origin 없음, null origin 격리)
- **XSS 방지**: DOMPurify (post-detail), escapeHTML() (카드/목록)
- **코드 실행 보안**: Judge0 CE 서버 샌드박스

## 10. 개발 워크플로우

```bash
# 로컬 서버 (선택)
npx serve . -p 3000

# 변경 → 커밋 → 자동 배포 (Vercel GitHub 연동)
git add <files>
git commit -m "설명"
git push  # Vercel이 자동으로 배포

# MCP로 DB 직접 수정 시 VACUUM 필요 없음 (ANALYZE는 주기적으로)
```

## 11. 알려진 제한 사항

- C/C++ 멀티파일: 여러 .c 파일 동시 컴파일 미지원 (헤더 파일은 가능)
- 영상 업로드: 최대 200MB
- Judge0 CE: 무료 공개 인스턴스 — 동시 사용자 많으면 느릴 수 있음
- 게임 폴더 업로드: WASM 파일은 MIME 타입 문제 가능 (getGameFileContentType 함수로 처리)

## 12. 현재 아지트 목록 (2026-05-29)

| 이름 | 타입 | 아이콘 | 색상 |
|------|------|------|------|
| 테스트용 아지트 | general | 🏠 | #4aab8e |
| HTML5 기반 게임 아지트 | 웹게임 | 🎮 | #5c4fc2 |
| 공부용 아지트 | general | 🏠 | #4aab8e |
| 영상 아지트 | 영상 | 🎬 | #c0392b |
| 코딩아지트 | 코드 | 💻 | #2563eb |
