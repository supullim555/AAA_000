#!/usr/bin/env node
/**
 * Open Azitfh AI CLI
 * Claude Code가 사이트를 읽고 쓰기 위한 도구
 *
 * 사용법:
 *   node scripts/ai.js read posts [--cat 아지트이름] [--limit 20]
 *   node scripts/ai.js read post <UUID>
 *   node scripts/ai.js read azits
 *   node scripts/ai.js read comments <POST_UUID>
 *   node scripts/ai.js write post --email E --password P --title T --content C --cat 아지트
 *   node scripts/ai.js write code --email E --password P --title T --lang Python --cat 아지트 (코드는 stdin)
 *   node scripts/ai.js write comment --email E --password P --post UUID --content C
 *   node scripts/ai.js info
 */

const SUPABASE_URL = 'https://ywyzcyvlfafmwoxjxmck.supabase.co';
const ANON_KEY     = 'sb_publishable_y7y5eFDZ3N2YDJsTL5RZ2g_b-Y91W7k';

// ── 공통 헬퍼 ─────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) { args[key] = next; i++; }
      else args[key] = true;
    } else {
      args._.push(a);
    }
  }
  return args;
}

async function sbFetch(method, path, body, jwt) {
  const headers = {
    'Content-Type': 'application/json',
    'apikey': ANON_KEY,
    'Authorization': `Bearer ${jwt || ANON_KEY}`,
  };
  if (method === 'POST' || method === 'PATCH') headers['Prefer'] = 'return=representation';
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
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': ANON_KEY },
    body: JSON.stringify({ email, password }),
  });
  const d = await res.json();
  if (!res.ok) throw new Error(`로그인 실패: ${d.error_description || d.message || JSON.stringify(d)}`);
  return d; // { access_token, user: { id, email, user_metadata: { nickname } } }
}

function fmt(obj, indent = 0) {
  const pad = ' '.repeat(indent);
  if (typeof obj === 'string') return obj;
  return JSON.stringify(obj, null, 2).split('\n').map(l => pad + l).join('\n');
}

function truncate(str, n = 100) {
  if (!str) return '';
  const plain = str.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  return plain.length > n ? plain.slice(0, n) + '…' : plain;
}

function formatDate(iso) {
  return new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
}

// ── 읽기 ──────────────────────────────────────────────────────────────────

async function readPosts(opts = {}) {
  let qs = 'select=id,title,category,author_nickname,views,created_at,hidden,code_lang,game_url,video_url'
         + '&hidden=eq.false&order=created_at.desc';
  if (opts.cat)   qs += `&category=eq.${encodeURIComponent(opts.cat)}`;
  if (opts.limit) qs += `&limit=${opts.limit}`;
  else            qs += '&limit=20';

  const posts = await sbFetch('GET', `/rest/v1/posts?${qs}`);
  console.log(`\n📋 게시물 목록 (${posts.length}개)\n`);
  posts.forEach((p, i) => {
    const type = p.game_url ? '🎮' : p.video_url ? '🎬' : p.code_lang ? '💻' : '📝';
    console.log(`${String(i + 1).padStart(2)}. ${type} [${p.category}] ${p.title}`);
    console.log(`    by ${p.author_nickname} · 조회 ${p.views} · ${formatDate(p.created_at)}`);
    console.log(`    ID: ${p.id}`);
  });
}

async function readPost(id) {
  const [post] = await sbFetch('GET', `/rest/v1/posts?select=*&id=eq.${id}`);
  if (!post) { console.log('게시물을 찾을 수 없어요.'); return; }

  console.log('\n' + '═'.repeat(60));
  console.log(`📄 ${post.title}`);
  console.log(`아지트: ${post.category} · by ${post.author_nickname}`);
  console.log(`조회 ${post.views} · ${formatDate(post.created_at)}`);
  console.log('─'.repeat(60));

  if (post.code_files) {
    console.log(`\n💻 멀티파일 코드 (${post.code_files.length}개 파일)`);
    post.code_files.forEach(f => {
      console.log(`\n── ${f.name} (${f.lang}) ──`);
      console.log(f.code);
    });
  } else if (post.code_lang) {
    console.log(`\n💻 코드 (${post.code_lang})`);
    console.log(post.content || '(내용 없음)');
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

async function readAzits() {
  const azits = await sbFetch('GET',
    '/rest/v1/azits?select=*&order=sort_order.asc.nullslast,created_at.asc');
  console.log(`\n🏠 아지트 목록 (${azits.length}개)\n`);
  azits.forEach(a => {
    console.log(`${a.icon} [${a.type}] ${a.name}`);
    if (a.description) console.log(`   ${a.description}`);
    console.log(`   ID: ${a.id} · 색상: ${a.cover_color}`);
  });
}

async function readComments(postId) {
  const comments = await sbFetch('GET',
    `/rest/v1/comments?select=*&post_id=eq.${postId}&order=created_at.asc`);
  console.log(`\n💬 댓글 (${comments.length}개)\n`);
  comments.forEach((c, i) => {
    console.log(`${i + 1}. ${c.author_nickname} · ${formatDate(c.created_at)}`);
    console.log(`   ${c.content}`);
  });
}

// ── 쓰기 ──────────────────────────────────────────────────────────────────

async function writePost(args) {
  const { email, password, title, content, cat, thumbnail } = args;
  if (!email || !password) throw new Error('--email 과 --password 가 필요합니다.');
  if (!title)    throw new Error('--title 이 필요합니다.');
  if (!cat)      throw new Error('--cat (아지트 이름) 이 필요합니다.');

  const session = await login(email, password);
  const jwt     = session.access_token;
  const user    = session.user;
  const nick    = user.user_metadata?.nickname || user.email;

  // 아지트 타입 확인
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
  console.log(`\n✅ 게시물이 등록됐어요!`);
  console.log(`   ID: ${created.id}`);
  console.log(`   URL: https://aaa-000.vercel.app/post-detail.html?id=${created.id}`);
  return created;
}

async function writeCodePost(args) {
  const { email, password, title, lang, cat } = args;
  if (!email || !password) throw new Error('--email 과 --password 가 필요합니다.');
  if (!title) throw new Error('--title 이 필요합니다.');
  if (!cat)   throw new Error('--cat (아지트 이름) 이 필요합니다.');
  if (!lang)  throw new Error('--lang (Python/C/C++/JavaScript/HTML 등) 이 필요합니다.');

  // 코드는 stdin에서 읽기
  let code = args.code || '';
  if (!code) {
    process.stdout.write('코드를 입력하세요 (EOF로 종료, Ctrl+D):\n');
    for await (const chunk of process.stdin) code += chunk;
    code = code.trim();
  }
  if (!code) throw new Error('코드가 없습니다.');

  const session = await login(email, password);
  const jwt     = session.access_token;
  const user    = session.user;
  const nick    = user.user_metadata?.nickname || user.email;

  const body = {
    title,
    content:         code,
    code_lang:       lang,
    category:        cat,
    author_id:       user.id,
    author_nickname: nick,
    views:           0,
  };

  const [created] = await sbFetch('POST', '/rest/v1/posts', body, jwt);
  console.log(`\n✅ 코드 게시물이 등록됐어요!`);
  console.log(`   ID: ${created.id}`);
  console.log(`   언어: ${lang}`);
  console.log(`   URL: https://aaa-000.vercel.app/post-detail.html?id=${created.id}`);
  return created;
}

async function writeMultifileCodePost(args) {
  // args.files: JSON 문자열 [{name, lang, code}, ...]
  // 또는 --file path1 --file path2 (TODO: 파일 읽기)
  const { email, password, title, cat, files: filesJson, 'main-lang': mainLang } = args;
  if (!filesJson) throw new Error('--files \'[{"name":"main.py","lang":"Python","code":"..."}]\' 가 필요합니다.');

  const files = JSON.parse(filesJson);
  const session = await login(email, password);
  const jwt     = session.access_token;
  const user    = session.user;

  const body = {
    title,
    content:         null,
    code_lang:       mainLang || files[0]?.lang || 'Python',
    code_files:      files,
    category:        cat,
    author_id:       user.id,
    author_nickname: user.user_metadata?.nickname || user.email,
    views:           0,
  };

  const [created] = await sbFetch('POST', '/rest/v1/posts', body, jwt);
  console.log(`\n✅ 멀티파일 코드 게시물이 등록됐어요! (${files.length}개 파일)`);
  console.log(`   ID: ${created.id}`);
  console.log(`   URL: https://aaa-000.vercel.app/post-detail.html?id=${created.id}`);
  return created;
}

async function writeComment(args) {
  const { email, password, post: postId, content } = args;
  if (!email || !password) throw new Error('--email 과 --password 가 필요합니다.');
  if (!postId)   throw new Error('--post <UUID> 가 필요합니다.');
  if (!content)  throw new Error('--content 가 필요합니다.');

  const session = await login(email, password);
  const jwt     = session.access_token;
  const user    = session.user;

  const body = {
    post_id:         postId,
    author_id:       user.id,
    author_nickname: user.user_metadata?.nickname || user.email,
    content,
  };

  const [created] = await sbFetch('POST', '/rest/v1/comments', body, jwt);
  console.log(`\n✅ 댓글이 등록됐어요! ID: ${created.id}`);
  return created;
}

// ── 사이트 현황 ────────────────────────────────────────────────────────────

async function showInfo() {
  const [posts, azits] = await Promise.all([
    sbFetch('GET', '/rest/v1/posts?select=id,category,code_lang,game_url,video_url,hidden&limit=1000'),
    sbFetch('GET', '/rest/v1/azits?select=name,type,icon&order=sort_order.asc.nullslast,created_at.asc'),
  ]);

  const visible = posts.filter(p => !p.hidden);
  const byType  = { general: 0, game: 0, video: 0, code: 0 };
  visible.forEach(p => {
    if (p.game_url)    byType.game++;
    else if (p.video_url) byType.video++;
    else if (p.code_lang) byType.code++;
    else byType.general++;
  });

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

// ── 메인 ──────────────────────────────────────────────────────────────────

async function main() {
  const args  = parseArgs(process.argv.slice(2));
  const [cmd, sub, ...rest] = args._;

  try {
    if (cmd === 'read') {
      if (sub === 'posts')    await readPosts({ cat: args.cat, limit: args.limit });
      else if (sub === 'post' && rest[0]) await readPost(rest[0]);
      else if (sub === 'azits')  await readAzits();
      else if (sub === 'comments' && rest[0]) await readComments(rest[0]);
      else {
        console.log('사용법: node scripts/ai.js read <posts|post <id>|azits|comments <post_id>>');
      }
    } else if (cmd === 'write') {
      if (sub === 'post')      await writePost(args);
      else if (sub === 'code') await writeCodePost(args);
      else if (sub === 'multifile') await writeMultifileCodePost(args);
      else if (sub === 'comment')  await writeComment(args);
      else {
        console.log('사용법: node scripts/ai.js write <post|code|multifile|comment> [options]');
      }
    } else if (cmd === 'info') {
      await showInfo();
    } else {
      console.log(`
Open Azitfh AI CLI

읽기 (인증 불필요):
  node scripts/ai.js read posts [--cat 아지트이름] [--limit 20]
  node scripts/ai.js read post <UUID>
  node scripts/ai.js read azits
  node scripts/ai.js read comments <POST_UUID>
  node scripts/ai.js info

쓰기 (로그인 필요):
  node scripts/ai.js write post \\
    --email E --password P --title T --content "내용" --cat 아지트이름

  node scripts/ai.js write code \\
    --email E --password P --title T --lang Python --cat 코딩아지트
    (코드는 stdin 또는 --code "코드문자열")

  node scripts/ai.js write multifile \\
    --email E --password P --title T --cat 코딩아지트 \\
    --files '[{"name":"main.py","lang":"Python","code":"print(1)"}]'

  node scripts/ai.js write comment \\
    --email E --password P --post <POST_UUID> --content "댓글 내용"
      `);
    }
  } catch (err) {
    console.error('\n❌', err.message);
    process.exit(1);
  }
}

main();
