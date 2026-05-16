# Open Azitfh — 프로젝트 문서

> 바닐라 JS + Supabase 기반 한국어 커뮤니티 플랫폼.  
> 아지트(커뮤니티 채널)를 자유롭게 만들고 게시물을 올리는 공간.

---

## 목차
1. [개요](#1-개요)
2. [기술 스택](#2-기술-스택)
3. [파일 구조](#3-파일-구조)
4. [데이터베이스](#4-데이터베이스)
5. [페이지 레퍼런스](#5-페이지-레퍼런스)
6. [app.js 함수](#6-appjs-함수)
7. [azitfh.js 함수](#7-azitfhjs-함수)
8. [admin.js 함수](#8-adminjs-함수)
9. [보안](#9-보안)
10. [배포 & 초기 설정](#10-배포--초기-설정)

---

## 1. 개요

| 항목 | 내용 |
|---|---|
| 프로젝트명 | Open Azitfh |
| 목적 | 로그인 기반 커뮤니티 (아지트별 게시판) |
| 빌드 | 없음 — 정적 HTML/CSS/JS |
| 인증 | Supabase Auth (이메일/비밀번호) |
| DB | Supabase PostgreSQL (RLS 적용) |
| 스토리지 | Supabase Storage (`post-media` 버킷) |
| 배포 | Vercel (GitHub main 자동 배포) |
| URL | https://aaa-000-5cr4.vercel.app |

**핵심 기능**
- 아지트(채널) 생성·관리, 타입·색상·아이콘 설정
- Quill 리치 에디터 (폰트·크기·색상·이미지/GIF·첨부파일)
- 댓글 / 추천·비추천 (1인 1표)
- 신고 → 자동 숨김 (3건 이상 + 작성자 대비 30% 이상)
- 운영자 패널 (게시물 복원·삭제, 관리자 추가/제거, 공지)
- 다크모드 기본값 (FOUC 방지, localStorage 유지)
- 아이디·비밀번호 찾기 / 재설정

---

## 2. 기술 스택

```
Frontend   Vanilla JS (ES2020+) · HTML5 · CSS3 Variables
Backend    Supabase (PostgreSQL + Auth + PostgREST + Storage)
Hosting    Vercel
```

**CDN 의존성**
```html
@supabase/supabase-js@2   — Supabase 클라이언트
quill@1.3.7               — 리치 텍스트 에디터 (글쓰기 페이지)
dompurify@3               — HTML 새니타이저 (게시물 상세)
```

**CONFIG 상수** (`app.js` 최상단)
```js
CONFIG.POPULAR_LIMIT  = 12    // 인기 게시물 최대 표시 수
CONFIG.TRUNCATE_LEN   = 70    // 미리보기 최대 글자 수
CONFIG.TOAST_MS       = 3000  // 토스트 자동 닫힘 (ms)
CONFIG.REPORT_MIN     = 3     // 신고 자동 숨김 최소 건수
```

---

## 3. 파일 구조

```
FFS/
├── index.html            홈 (아지트 목록 + 인기/전체 게시물)
├── login.html            로그인
├── signup.html           회원가입
├── forgot.html           아이디·비밀번호 찾기
├── reset-password.html   비밀번호 재설정 (Supabase 콜백)
├── post-write.html       글쓰기 (Quill 리치 에디터)
├── post-detail.html      게시물 상세 (투표·댓글·신고)
├── dashboard.html        내 공간 (아지트 관리, 글쓰기 링크)
├── azit-create.html      아지트 만들기 (이름·설명·타입)
├── azitfh.html           아지트 상세 (히어로·게시물·정보 탭)
├── admin.html            운영자 패널
│
├── app.js                메인 로직 (모든 페이지 공유)
├── azitfh.js             아지트 상세 페이지 전용 로직
├── admin.js              운영자 패널 전용 로직
├── supabase-config.js    Supabase 클라이언트 초기화 (anon key)
│
├── style.css             전체 스타일 (라이트·다크 모드)
├── logo.png              로고 이미지
│
├── schema.sql                  기본 테이블 + RLS + increment_views
├── schema_reports.sql          신고·관리자 테이블 + SECURITY DEFINER 함수
├── schema_comments_votes.sql   댓글·투표 테이블
├── schema_storage.sql          Storage 버킷 RLS 정책
│
├── supabase-config.example.js  설정 파일 예시 (템플릿)
├── .gitignore
└── PROJECT.md            ← 이 파일
```

> **이미 적용 완료된 마이그레이션** (재실행 불필요):  
> `schema_rename_azit.sql` — categories → azits 테이블 이름 변경  
> `schema_azitfh.sql` — cover_color, icon 컬럼 추가  
> `schema_azit_type.sql` — type 컬럼 추가

---

## 4. 데이터베이스

### azits (아지트 채널)

| 컬럼 | 타입 | 기본값 | 설명 |
|---|---|---|---|
| `id` | UUID PK | gen_random_uuid() | |
| `name` | TEXT UNIQUE | | 아지트 이름 |
| `description` | TEXT | `''` | 소개 |
| `created_by` | TEXT | `'익명'` | 닉네임 스냅샷 |
| `creator_id` | UUID FK → auth.users | NULL | 소유권 |
| `cover_color` | TEXT | `'#4aab8e'` | 히어로 배경색 |
| `icon` | TEXT | `'🏠'` | 아지트 아이콘 |
| `type` | TEXT | `'general'` | 아지트 타입 |
| `created_at` | TIMESTAMPTZ | now() | |

### posts (게시물)

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | UUID PK | |
| `title` | TEXT | 제목 |
| `content` | TEXT | HTML (Quill 출력, DOMPurify로 렌더링) |
| `category` | TEXT | 아지트 이름 참조 |
| `author_id` | UUID FK | |
| `author_nickname` | TEXT | 닉네임 스냅샷 |
| `views` | INTEGER | 조회수 |
| `hidden` | BOOLEAN | 신고 임계값 초과 시 true |
| `created_at` | TIMESTAMPTZ | |

### 나머지 테이블

| 테이블 | 역할 |
|---|---|
| `notices` | 관리자 공지사항 |
| `reports` | 게시물 신고 (post_id + reporter_id UNIQUE) |
| `admins` | 관리자 목록 |
| `comments` | 댓글 (최대 500자) |
| `votes` | 추천/비추천 (post_id + user_id UNIQUE, CHECK 'up'\|'down') |

### SECURITY DEFINER 함수

| 함수 | 설명 |
|---|---|
| `increment_views(post_id)` | 조회수 원자적 +1 |
| `submit_report(p_post_id, p_reason)` | 신고 + 자동 숨김 (3건·30% 조건) |
| `unhide_post(p_post_id)` | 게시물 복원 + 신고 초기화 |
| `admin_delete_post(p_post_id)` | 게시물 영구 삭제 |
| `add_admin_by_email(email)` | 이메일로 관리자 추가 |
| `remove_admin(user_id)` | 관리자 제거 (마지막 1명 보호) |
| `find_email_by_nickname(nickname)` | 닉네임 → 마스킹 이메일 |

### Storage

| 버킷 | 공개 | 용도 |
|---|---|---|
| `post-media` | ✅ | 이미지·GIF·첨부파일 |

---

## 5. 페이지 레퍼런스

| 파일 | 진입 함수 | 로그인 필요 |
|---|---|---|
| `index.html` | `initIndex()` | 선택 |
| `login.html` | `initLogin()` | ✗ |
| `signup.html` | `initSignup()` | ✗ |
| `forgot.html` | `initForgot()` | ✗ |
| `reset-password.html` | `initResetPassword()` | ✗ (토큰 기반) |
| `post-write.html` | `initPostWrite()` | ✅ |
| `post-detail.html` | `initPostDetail()` | 선택 |
| `dashboard.html` | `initDashboard()` | ✅ |
| `azit-create.html` | `initAzitCreate()` | ✅ |
| `azitfh.html` | `initAzitfh()` | 선택 |
| `admin.html` | `initAdminPanel()` | ✅ + 어드민 |

모든 페이지 공통:
```html
<script>initDarkMode(); init페이지명();</script>
```

---

## 6. app.js 함수

### 유틸리티

| 함수 | 설명 |
|---|---|
| `escapeHTML(s)` | XSS 방지 이스케이프 |
| `truncate(s, n)` | n자 초과 시 `…` |
| `stripHtml(html)` | HTML 태그 제거 (미리보기용) |
| `formatDate(iso)` | ISO → `YYYY. M. D.` |
| `setLoading(btn, bool)` | 버튼 로딩 상태 전환 |
| `showToast(msg, type)` | 토스트 (`green`/`red`) |
| `initDarkMode()` | 다크모드 초기화 + 토글 |

### 인증

| 함수 | 설명 |
|---|---|
| `requireAuth()` | 미로그인 시 login.html 리다이렉트 |
| `getSession()` | 현재 세션 반환 |
| `isAdmin()` | 어드민 여부 확인 |
| `updateNav(session)` | 헤더 nav 상태 동기화 |
| `authSignUp/In/Out()` | Supabase 인증 래퍼 |
| `sendPasswordReset(email)` | 재설정 이메일 발송 |
| `updatePassword(newPw)` | 비밀번호 변경 |

### 아지트

| 함수 | 설명 |
|---|---|
| `getCategories()` | 전체 아지트 조회 |
| `getCategoryNames()` | 이름 배열 반환 |
| `insertCategory({name, description, created_by, creator_id, type})` | 아지트 추가 |
| `deleteCategory(name)` | 아지트 삭제 |
| `renderCategoryCards()` | 홈 카드 렌더링 (인기순·HOT·타입 필터) |
| `adjustCardWidths()` | 카드 너비 글자 수 기반 자동 조정 |
| `initCategorySection()` | 홈 섹션 초기화 (검색·필터·타입 토글) |
| `renderCategories(userId)` | 대시보드 목록 (타입 필터) |
| `initCategoryManager(userId)` | 대시보드 필터 초기화 |
| `initAzitCreate()` | 아지트 생성 페이지 |

### 게시물

| 함수 | 설명 |
|---|---|
| `getPosts(categoryFilter)` | 게시물 조회 |
| `insertPost(data)` | 게시물 작성 |
| `deletePost(id)` | 게시물 삭제 |
| `incrementViews(id)` | 조회수 +1 (RPC) |
| `renderPosts()` | 인기 게시물 카드 |
| `renderPostsList()` | 전체 게시물 목록 |
| `initPostWrite()` | Quill 에디터 초기화·제출 |
| `triggerMediaUpload(quill, accept)` | 이미지/GIF Storage 업로드 후 삽입 |
| `triggerFileAttach(quill)` | 첨부파일 업로드 후 링크 삽입 |

### 댓글·투표·신고

| 함수 | 설명 |
|---|---|
| `getComments / insertComment / deleteComment` | 댓글 CRUD |
| `renderComments / initComments` | 댓글 렌더링·폼 |
| `getVoteCounts / castVote / initVotes` | 투표 |
| `reportPost / hasReported / initReportModal` | 신고 |

---

## 7. azitfh.js 함수

아지트 상세 페이지(`azitfh.html`) 전용. `app.js`의 유틸 함수를 공유 사용.

| 함수 | 설명 |
|---|---|
| `initAzitfh()` | 진입점 — `?cat=` 파라미터로 아지트 로드 |
| `fetchAzitfh(catName)` | azits 단건 조회 |
| `fetchPosts(catName)` | 해당 아지트 게시물 |
| `renderHero(azitfh, session)` | 히어로 배너 (그라디언트·아이콘·통계) |
| `darkenHex(hex, amount)` | 그라디언트 끝 색상 계산 |
| `initAzitfhTabs(azitfh, catName)` | 탭 이벤트 (게시물·정보) |
| `loadPosts(azitfh, catName)` | 게시물 탭 로딩 |
| `renderPostCards(container, posts)` | 게시물 카드 그리드 |
| `renderAbout(azitfh)` | 정보 탭 렌더링 |

---

## 8. admin.js 함수

| 함수 | 설명 |
|---|---|
| `initAdminPanel()` | 어드민 권한 확인 후 패널 초기화 |
| `loadReportedPosts()` | 숨김 게시물 + 신고 수 표시 |
| `doUnhide(postId)` | 복원 + 신고 초기화 |
| `doAdminDelete(postId)` | 영구 삭제 |
| `loadAdmins()` | 관리자 목록 |
| `doAddAdmin / doRemoveAdmin` | 관리자 추가·제거 |
| `loadNoticesAdmin / doAddNoticeAdmin / doDeleteNoticeAdmin` | 공지 관리 |

---

## 9. 보안

### 키 현황

| 키 | 위치 | 상태 |
|---|---|---|
| `sb_publishable_...` (anon) | `supabase-config.js` (git 추적) | ✅ 공개 키, 노출 무방 |
| `sbp_...` (service/PAT) | `.mcp.json` (gitignore) | ✅ git에 없음 |

### RLS 요약

| 테이블 | SELECT | INSERT | DELETE |
|---|---|---|---|
| `azits` | 전체 | 로그인 | `creator_id = uid` |
| `posts` | `hidden=false` | 로그인 | `author_id = uid` |
| `notices` | 전체 | 어드민 | 어드민 |
| `comments` | 전체 | 로그인 | `author_id = uid` |
| `votes` | 전체 | 로그인 | `user_id = uid` |
| `reports` | 본인 | 로그인 | — |
| `admins` | 전체 | 함수만 | 함수만 |

### 주의사항

- `posts.content`는 Quill HTML 저장 → 렌더링 시 **DOMPurify** 적용 (완료)
- `escapeHTML()` 로 사용자 입력 직접 innerHTML 방지
- 어드민 기능은 전부 `SECURITY DEFINER` 함수 경유 (클라이언트 직접 조작 불가)
- Storage 업로드는 로그인 유저만 가능 (RLS 적용)

---

## 10. 배포 & 초기 설정

### Supabase SQL 적용 순서 (신규 프로젝트)

```
1. schema.sql                 기본 테이블 + RLS + 조회수 함수
2. schema_reports.sql         신고·관리자 테이블 + 함수
3. schema_comments_votes.sql  댓글·투표 테이블
4. schema_storage.sql         Storage RLS 정책
5. Storage 대시보드 → 'post-media' 버킷 생성 (Public ON)
6. 첫 관리자 등록:
   INSERT INTO public.admins (user_id, email)
   SELECT id, email FROM auth.users WHERE email = 'your@email.com';
7. Authentication → URL Configuration
   - Site URL: https://your-domain.vercel.app
   - Redirect URLs: https://your-domain.vercel.app/reset-password.html
```

> **현재 프로젝트는 모두 적용 완료** — 추가 SQL 실행 불필요.

### Vercel 설정

```
Framework Preset : Other
Build Command    : (없음)
Output Directory : (없음 또는 .)
```

### supabase-config.js

```js
const SUPABASE_URL      = 'https://<project-ref>.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_...';
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
```

---

*최종 업데이트: 2026-05-17*
