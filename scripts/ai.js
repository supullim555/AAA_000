#!/usr/bin/env node
/**
 * Open Azitfh AI CLI v2
 *
 * 인증 (한 번만 실행하면 자격증명 저장):
 *   node scripts/ai.js auth login --email E --password P
 *   node scripts/ai.js auth logout
 *   node scripts/ai.js auth whoami
 *
 * 읽기 (인증 불필요):
 *   node scripts/ai.js read posts [--cat 아지트] [--limit 20] [--offset 0] [--json]
 *   node scripts/ai.js read post <UUID> [--json]
 *   node scripts/ai.js read azits [--json]
 *   node scripts/ai.js read comments <POST_UUID> [--json]
 *   node scripts/ai.js read search <검색어> [--json]
 *   node scripts/ai.js info [--json]
 *
 * 쓰기 (로그인 필요 — 저장된 자격증명 자동 사용):
 *   node scripts/ai.js write post --title T [--content C] --cat 아지트 [--thumbnail URL]
 *   node scripts/ai.js write code --title T --lang Python --cat 아지트 [--code C]
 *   node scripts/ai.js write multifile --title T --cat 아지트 --files '[{name,lang,code}]'
 *   node scripts/ai.js write comment --post UUID --content C
 *   node scripts/ai.js edit post <UUID> [--title T] [--content C]
 *   node scripts/ai.js delete post <UUID>
 *   node scripts/ai.js vote <UUID> up|down
 *
 * 환경 변수로도 자격증명 제공 가능:
 *   AZITFH_EMAIL=… AZITFH_PASSWORD=… node scripts/ai.js write post …
 */

const os   = require('os');
const fs   = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://ywyzcyvlfafmwoxjxmck.supabase.co';
const ANON_KEY     = 'sb_publishable_y7y5eFDZ3N2YDJsTL5RZ2g_b-Y91W7k';
const CONFIG_PATH  = path.join(os.homedir(), '.azitfh-ai.json');

// ── 설정 파일 ────────────────────────────────────────────────────────────────

function loadConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); }
  catch { return {}; }
}

function saveConfig(data) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2), { mode: 0o600 });
}

// 자격증명 해결 순서: CLI 인수 > 환경 변수 > 설정 파일
function resolveCredentials(args) {
  const cfg      = loadConfig();
  const email    = args.email    || process.env.AZITFH_EMAIL    || cfg.email;
  const password = args.password || process.env.AZITFH_PASSWORD || cfg.password;
  return { email, password };
}

// ── 공통 헬퍼 ────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key  = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) { args[key] = next; i++; }
      else args[key] = true;
    } else {
      args._.push(a);
    }
  }
  return args;
}

async function sbFetch(method, path, body, jwt, prefer) {
  const headers = {
    'Content-Type':  'application/json',
    'apikey':        ANON_KEY,
    'Authorization': `Bearer ${jwt || ANON_KEY}`,
  };
  if (method === 'POST' || method === 'PATCH')
    headers['Prefer'] = prefer || 'return=representation';
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${typeof data === 'object' ? JSON.stringify(data) : data}`);
  return data;
}

async function login(email, password) {
  if (!email || !password) throw new Error(
    '자격증명이 없어요. 먼저 실행하세요:\n  node scripts/ai.js auth login --email E --password P\n또는 환경 변수: AZITFH_EMAIL / AZITFH_PASSWORD'
  );
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': ANON_KEY },
    body:    JSON.stringify({ email, password }),
  });
  const d = await res.json();
  if (!res.ok) throw new Error(`로그인 실패: ${d.error_description || d.message || JSON.stringify(d)}`);
  return d; // { access_token, user: { id, email, user_metadata: { nickname } } }
}

async function getSession(args) {
  const { email, password } = resolveCredentials(args);
  const session = await login(email, password);
  return {
    jwt:  session.access_token,
    user: session.user,
    nick: session.user.user_metadata?.nickname || session.user.email,
  };
}

function truncate(str, n = 100) {
  if (!str) return '';
  const plain = str.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  return plain.length > n ? plain.slice(0, n) + '…' : plain;
}

function formatDate(iso) {
  return new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
}

function out(data, asJson) {
  if (asJson) { console.log(JSON.stringify(data, null, 2)); return; }
}

// ── 인증 관리 ────────────────────────────────────────────────────────────────

async function authLogin(args) {
  const email    = args.email    || process.env.AZITFH_EMAIL;
  const password = args.password || process.env.AZITFH_PASSWORD;
  if (!email || !password) throw new Error('--email 과 --password 가 필요합니다.');

  const session = await login(email, password);
  const nick    = session.user.user_metadata?.nickname || session.user.email;

  saveConfig({ email, password });
  console.log(`\n✅ 로그인 성공! 자격증명이 ${CONFIG_PATH} 에 저장됐어요.`);
  console.log(`   사용자: ${nick} (${session.user.email})`);
  console.log(`   앞으로는 --email / --password 없이도 쓰기 명령이 작동합니다.`);
}

function authLogout() {
  try {
    fs.unlinkSync(CONFIG_PATH);
    console.log(`\n✅ 자격증명이 삭제됐어요. (${CONFIG_PATH})`);
  } catch {
    console.log('\n저장된 자격증명이 없어요.');
  }
}

async function authWhoami() {
  const { email, password } = resolveCredentials({});
  if (!email) { console.log('\n로그인되어 있지 않아요. (node scripts/ai.js auth login --email E --password P)'); return; }
  try {
    const session = await login(email, password);
    const nick    = session.user.user_metadata?.nickname || session.user.email;
    console.log(`\n👤 ${nick}`);
    console.log(`   이메일: ${session.user.email}`);
    console.log(`   UID:   ${session.user.id}`);
    console.log(`   자격증명 출처: ${resolveCredentials({}).email === loadConfig().email ? CONFIG_PATH : '환경 변수'}`);
  } catch (e) {
    console.log(`\n자격증명이 잘못됐어요: ${e.message}`);
  }
}

// ── 읽기 ─────────────────────────────────────────────────────────────────────

async function readPosts(opts = {}) {
  const offset = parseInt(opts.offset || 0);
  const limit  = parseInt(opts.limit  || 20);
  let qs = `select=id,title,category,author_nickname,views,created_at,hidden,code_lang,game_url,video_url`
         + `&hidden=eq.false&order=created_at.desc&limit=${limit}&offset=${offset}`;
  if (opts.cat) qs += `&category=eq.${encodeURIComponent(opts.cat)}`;

  const posts = await sbFetch('GET', `/rest/v1/posts?${qs}`);
  if (opts.json) { out(posts, true); return; }

  console.log(`\n📋 게시물 목록 (${posts.length}개, offset=${offset})\n`);
  posts.forEach((p, i) => {
    const type = postTypeIcon(p);
    console.log(`${String(offset + i + 1).padStart(3)}. ${type} [${p.category}] ${p.title}`);
    console.log(`     by ${p.author_nickname} · 조회 ${p.views} · ${formatDate(p.created_at)}`);
    console.log(`     ID: ${p.id}`);
  });
}

async function readPost(id, opts = {}) {
  const [post] = await sbFetch('GET', `/rest/v1/posts?select=*&id=eq.${id}`);
  if (!post) { console.log('게시물을 찾을 수 없어요.'); return; }
  if (opts.json) { out(post, true); return; }

  console.log('\n' + '═'.repeat(60));
  console.log(`${postTypeIcon(post) || '📝'} ${post.title}`);
  console.log(`아지트: ${post.category} · by ${post.author_nickname}`);
  console.log(`조회 ${post.views} · ${formatDate(post.created_at)}`);
  console.log('─'.repeat(60));

  if (post.code_files) {
    console.log(`\n💻 멀티파일 코드 (${post.code_files.length}개 파일)`);
    post.code_files.forEach(f => { console.log(`\n── ${f.name} (${f.lang}) ──`); console.log(f.code); });
  } else if (post.code_lang) {
    console.log(`\n💻 코드 (${post.code_lang})\n${post.content || '(내용 없음)'}`);
  } else if (post.game_url) {
    console.log(`\n🎮 게임 URL: ${post.game_url}`);
    if (post.content) console.log(`설명: ${post.content}`);
  } else if (post.video_url) {
    console.log(`\n🎬 영상 URL: ${post.video_url}`);
    if (post.content) console.log(`설명: ${post.content}`);
  } else {
    console.log('\n' + truncate(post.content, 500));
  }
  console.log('═'.repeat(60));
}

async function readAzits(opts = {}) {
  const azits = await sbFetch('GET',
    '/rest/v1/azits?select=*&order=sort_order.asc.nullslast,created_at.asc');
  if (opts.json) { out(azits, true); return; }
  console.log(`\n🏠 아지트 목록 (${azits.length}개)\n`);
  azits.forEach(a => {
    console.log(`${a.icon} [${a.type}] ${a.name}`);
    if (a.description) console.log(`   ${a.description}`);
    console.log(`   ID: ${a.id} · 색상: ${a.cover_color}`);
  });
}

async function readComments(postId, opts = {}) {
  const comments = await sbFetch('GET',
    `/rest/v1/comments?select=*&post_id=eq.${postId}&order=created_at.asc`);
  if (opts.json) { out(comments, true); return; }
  console.log(`\n💬 댓글 (${comments.length}개)\n`);
  comments.forEach((c, i) => {
    console.log(`${i + 1}. ${c.author_nickname} · ${formatDate(c.created_at)}`);
    console.log(`   ${c.content}`);
    if (c.parent_id) console.log(`   (답글 → ${c.parent_id})`);
  });
}

async function readSearch(query, opts = {}) {
  const qs = `select=id,title,category,author_nickname,views,created_at,code_lang,game_url,video_url`
           + `&hidden=eq.false&title=ilike.*${encodeURIComponent(query)}*&order=views.desc&limit=20`;
  const posts = await sbFetch('GET', `/rest/v1/posts?${qs}`);
  if (opts.json) { out(posts, true); return; }
  console.log(`\n🔍 "${query}" 검색 결과 (${posts.length}개)\n`);
  posts.forEach((p, i) => {
    console.log(`${String(i + 1).padStart(2)}. ${postTypeIcon(p) || '📝'} [${p.category}] ${p.title}`);
    console.log(`    by ${p.author_nickname} · 조회 ${p.views} · ID: ${p.id}`);
  });
}

// ── 사이트 현황 ───────────────────────────────────────────────────────────────

async function showInfo(opts = {}) {
  const [posts, azits] = await Promise.all([
    sbFetch('GET', '/rest/v1/posts?select=id,category,code_lang,game_url,video_url,hidden&limit=1000'),
    sbFetch('GET', '/rest/v1/azits?select=name,type,icon&order=sort_order.asc.nullslast,created_at.asc'),
  ]);

  const visible = posts.filter(p => !p.hidden);
  const byType  = { general: 0, game: 0, video: 0, code: 0 };
  visible.forEach(p => {
    if (p.game_url)      byType.game++;
    else if (p.video_url)  byType.video++;
    else if (p.code_lang)  byType.code++;
    else                   byType.general++;
  });

  const info = {
    site_url:  'https://aaa-000.vercel.app',
    posts:     { total: visible.length, hidden: posts.length - visible.length, ...byType },
    azits:     azits.map(a => ({ ...a, post_count: visible.filter(p => p.category === a.name).length })),
  };

  if (opts.json) { out(info, true); return; }

  console.log('\n🌐 Open Azitfh 현황');
  console.log('─'.repeat(40));
  console.log(`📋 전체 게시물: ${visible.length}개 (숨김: ${posts.length - visible.length}개)`);
  console.log(`   📝 일반: ${byType.general}  🎮 게임: ${byType.game}  🎬 영상: ${byType.video}  💻 코드: ${byType.code}`);
  console.log(`🏠 아지트: ${azits.length}개`);
  azits.forEach(a => {
    const cnt = visible.filter(p => p.category === a.name).length;
    console.log(`   ${a.icon} ${a.name} [${a.type}] — ${cnt}개 게시물`);
  });
  console.log(`\n🔗 https://aaa-000.vercel.app`);
}

// ── 쓰기 ─────────────────────────────────────────────────────────────────────

async function writePost(args) {
  const { title, content, cat, thumbnail } = args;
  if (!title) throw new Error('--title 이 필요합니다.');
  if (!cat)   throw new Error('--cat (아지트 이름) 이 필요합니다.');

  const { jwt, user, nick } = await getSession(args);

  const [azit] = await sbFetch('GET', `/rest/v1/azits?select=type&name=eq.${encodeURIComponent(cat)}`);
  if (!azit) throw new Error(`아지트 "${cat}"를 찾을 수 없어요.`);

  const body = {
    title,
    content:         content || null,
    category:        cat,
    author_id:       user.id,
    author_nickname: nick,
    views:           0,
  };
  if (thumbnail) body.thumbnail_url = thumbnail;

  const [created] = await sbFetch('POST', '/rest/v1/posts', body, jwt);
  console.log(`\n✅ 게시물 등록 완료!`);
  console.log(`   ID: ${created.id}`);
  console.log(`   URL: https://aaa-000.vercel.app/post-detail.html?id=${created.id}`);
  return created;
}

async function writeCodePost(args) {
  const { title, lang, cat } = args;
  if (!title) throw new Error('--title 이 필요합니다.');
  if (!cat)   throw new Error('--cat (아지트 이름) 이 필요합니다.');
  if (!lang)  throw new Error('--lang (Python/C/C++/JavaScript/HTML 등) 이 필요합니다.');

  let code = args.code || '';
  if (!code) {
    process.stdout.write('코드를 입력하세요 (EOF로 종료, Ctrl+D):\n');
    for await (const chunk of process.stdin) code += chunk;
    code = code.trim();
  }
  if (!code) throw new Error('코드가 없습니다.');

  const { jwt, user, nick } = await getSession(args);

  const [created] = await sbFetch('POST', '/rest/v1/posts', {
    title, content: code, code_lang: lang,
    category: cat, author_id: user.id, author_nickname: nick, views: 0,
  }, jwt);
  console.log(`\n✅ 코드 게시물 등록 완료! (${lang})`);
  console.log(`   ID: ${created.id}`);
  console.log(`   URL: https://aaa-000.vercel.app/post-detail.html?id=${created.id}`);
  return created;
}

async function writeMultifileCodePost(args) {
  const { title, cat, files: filesJson, 'main-lang': mainLang } = args;
  if (!filesJson) throw new Error("--files '[{\"name\":\"main.py\",\"lang\":\"Python\",\"code\":\"...\"}]' 가 필요합니다.");
  const files = JSON.parse(filesJson);
  const { jwt, user, nick } = await getSession(args);

  const [created] = await sbFetch('POST', '/rest/v1/posts', {
    title, content: null,
    code_lang:  mainLang || files[0]?.lang || 'Python',
    code_files: files,
    category:   cat,
    author_id:       user.id,
    author_nickname: nick,
    views: 0,
  }, jwt);
  console.log(`\n✅ 멀티파일 코드 게시물 등록 완료! (${files.length}개 파일)`);
  console.log(`   ID: ${created.id}`);
  console.log(`   URL: https://aaa-000.vercel.app/post-detail.html?id=${created.id}`);
  return created;
}

async function writeComment(args) {
  const { post: postId, content } = args;
  if (!postId)  throw new Error('--post <UUID> 가 필요합니다.');
  if (!content) throw new Error('--content 가 필요합니다.');

  const { jwt, user, nick } = await getSession(args);
  const [created] = await sbFetch('POST', '/rest/v1/comments', {
    post_id: postId, author_id: user.id, author_nickname: nick, content,
  }, jwt);
  console.log(`\n✅ 댓글 등록 완료! ID: ${created.id}`);
  return created;
}

async function editPost(id, args) {
  if (!id) throw new Error('게시물 UUID가 필요합니다.');
  const { title, content } = args;
  if (!title && !content) throw new Error('--title 또는 --content 중 하나 이상 필요합니다.');

  const { jwt } = await getSession(args);
  const patch = {};
  if (title)   patch.title   = title;
  if (content) patch.content = content;

  await sbFetch('PATCH', `/rest/v1/posts?id=eq.${id}`, patch, jwt);
  console.log(`\n✅ 게시물이 수정됐어요! ID: ${id}`);
}

async function deletePost(id, args) {
  if (!id) throw new Error('게시물 UUID가 필요합니다.');
  const { jwt } = await getSession(args);
  await sbFetch('DELETE', `/rest/v1/posts?id=eq.${id}`, undefined, jwt);
  console.log(`\n✅ 게시물이 삭제됐어요! ID: ${id}`);
}

async function votePost(id, direction, args) {
  if (!id)        throw new Error('게시물 UUID가 필요합니다.');
  if (!['up','down'].includes(direction)) throw new Error('방향은 up 또는 down 이어야 합니다.');

  const { jwt, user } = await getSession(args);
  // upsert — 이미 투표했으면 vote_type 교체
  await sbFetch('POST', `/rest/v1/votes?on_conflict=post_id,user_id`, {
    post_id: id, user_id: user.id, vote_type: direction,
  }, jwt, 'resolution=merge-duplicates,return=representation');
  console.log(`\n✅ ${direction === 'up' ? '👍' : '👎'} 투표 완료! (게시물 ${id})`);
}

// ── postTypeIcon (CLI 전용 — 브라우저 버전과 동일 로직) ──────────────────────

function postTypeIcon(p) {
  return p.game_url ? '🎮' : p.video_url ? '🎬' : p.code_lang ? '💻' : '';
}

// ── 메인 ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const [cmd, sub, ...rest] = args._;
  const isJson = !!args.json;

  try {
    // ── 인증 관리 ──
    if (cmd === 'auth') {
      if (sub === 'login')  await authLogin(args);
      else if (sub === 'logout') authLogout();
      else if (sub === 'whoami') await authWhoami();
      else console.log('사용법: node scripts/ai.js auth <login|logout|whoami>');

    // ── 읽기 ──
    } else if (cmd === 'read') {
      if (sub === 'posts')   await readPosts({ cat: args.cat, limit: args.limit, offset: args.offset, json: isJson });
      else if (sub === 'post' && rest[0])    await readPost(rest[0], { json: isJson });
      else if (sub === 'azits')              await readAzits({ json: isJson });
      else if (sub === 'comments' && rest[0]) await readComments(rest[0], { json: isJson });
      else if (sub === 'search' && rest[0])  await readSearch(rest[0], { json: isJson });
      else console.log('사용법: node scripts/ai.js read <posts|post <id>|azits|comments <id>|search <쿼리>>');

    // ── 쓰기 ──
    } else if (cmd === 'write') {
      if (sub === 'post')       await writePost(args);
      else if (sub === 'code')  await writeCodePost(args);
      else if (sub === 'multifile') await writeMultifileCodePost(args);
      else if (sub === 'comment')   await writeComment(args);
      else console.log('사용법: node scripts/ai.js write <post|code|multifile|comment> [options]');

    // ── 수정 ──
    } else if (cmd === 'edit') {
      if (sub === 'post' && rest[0]) await editPost(rest[0], args);
      else console.log('사용법: node scripts/ai.js edit post <UUID> [--title T] [--content C]');

    // ── 삭제 ──
    } else if (cmd === 'delete') {
      if (sub === 'post' && rest[0]) await deletePost(rest[0], args);
      else console.log('사용법: node scripts/ai.js delete post <UUID>');

    // ── 투표 ──
    } else if (cmd === 'vote') {
      await votePost(sub, rest[0], args);

    // ── 현황 ──
    } else if (cmd === 'info') {
      await showInfo({ json: isJson });

    } else {
      console.log(`
Open Azitfh AI CLI v2

인증 (한 번만):
  node scripts/ai.js auth login --email E --password P
  node scripts/ai.js auth logout
  node scripts/ai.js auth whoami

읽기 (인증 불필요):
  node scripts/ai.js read posts [--cat 아지트] [--limit 20] [--offset 0] [--json]
  node scripts/ai.js read post <UUID> [--json]
  node scripts/ai.js read azits [--json]
  node scripts/ai.js read comments <POST_UUID> [--json]
  node scripts/ai.js read search <검색어> [--json]
  node scripts/ai.js info [--json]

쓰기 (저장된 자격증명 자동 사용):
  node scripts/ai.js write post --title T [--content C] --cat 아지트
  node scripts/ai.js write code --title T --lang Python --cat 아지트 [--code C]
  node scripts/ai.js write multifile --title T --cat 아지트 --files '[{...}]'
  node scripts/ai.js write comment --post UUID --content C
  node scripts/ai.js edit post <UUID> [--title T] [--content C]
  node scripts/ai.js delete post <UUID>
  node scripts/ai.js vote <UUID> up|down

환경 변수: AZITFH_EMAIL, AZITFH_PASSWORD
      `);
    }
  } catch (err) {
    console.error('\n❌', err.message);
    process.exit(1);
  }
}

main();
