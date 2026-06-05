/* CONFIG, escapeHTML, truncate, formatDate, postTypeIcon, stripHtml,
   extractFirstImage, darkenHex, nullIfEmpty, showToast, showError,
   clearErrors, setLoading, renderAvatar, initNavLogout,
   renderPostRowHTML, renderPostThumbHtml, renderPostDescHtml
   → utils.js 로 이전됨 */

/* ── 캐시 레이어 — 동일 세션 내 중복 DB 호출 방지 ── */
// 동시 요청이 몰려도 Promise 하나만 실행 (thundering herd 방지)
function _makeCache(fetcher, ttl) {
  let _data = null, _ts = 0, _p = null;
  return {
    get:  async () => {
      if (_data && Date.now() - _ts < ttl) return _data;
      if (!_p) _p = fetcher()
        .then(d => { _data = d; _ts = Date.now(); _p = null; return d; })
        .catch(e => { _p = null; throw e; }); // 실패 시 재시도 허용
      return _p;
    },
    bust: () => { _data = null; _ts = 0; _p = null; },
  };
}

const _postsStore = _makeCache(() => getPosts(), 30_000);
const _catsStore  = _makeCache(() => getCategories(), 60_000);
const _typesStore = _makeCache(() => getAzitTypes(), 300_000);

async function fetchPostsCached()      { return _postsStore.get(); }
async function fetchCategoriesCached() { return _catsStore.get(); }
async function fetchAzitTypesCached()  { return _typesStore.get(); }

function invalidatePostsCache()      { _postsStore.bust(); }
function invalidateCategoriesCache() { _catsStore.bust(); }

/* ── Dark Mode ── */
function initDarkMode() {
  const saved = localStorage.getItem('jnaver_theme');
  // 저장된 값이 없으면 다크모드가 기본값
  if (saved !== 'light') document.documentElement.setAttribute('data-theme', 'dark');
  updateToggleIcon();

  document.getElementById('themeToggle')?.addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (isDark) {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('jnaver_theme', 'light');
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('jnaver_theme', 'dark');
    }
    updateToggleIcon();
  });
}

function updateToggleIcon() {
  const btn = document.getElementById('themeToggle');
  if (!btn) return;
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  btn.textContent = isDark ? '🌙' : '☀️';
  btn.title = isDark ? '라이트 모드로 전환' : '다크 모드로 전환';
}

/* ── Toast ── */

/* ── AI/SEO 메타 태그 동적 업데이트 ── */
function setMeta(id, value) {
  const el = document.getElementById(id);
  if (el) el.setAttribute(el.tagName === 'SCRIPT' ? 'textContent' : 'content', value);
}

function updatePostMeta(post) {
  const desc = truncate(stripHtml(post.content || ''), 160);
  document.title = `${post.title} — Open Azitfh`;
  setMeta('ogTitle',        post.title + ' — Open Azitfh');
  setMeta('ogDescription',  desc);
  setMeta('metaDescription', desc);
  const schema = {
    '@context': 'https://schema.org',
    '@type':    'Article',
    'headline': post.title,
    'description': desc,
    'author': { '@type': 'Person', 'name': post.author_nickname },
    'datePublished': post.created_at,
    'url': window.location.href,
    'isPartOf': { '@type': 'WebSite', 'name': 'Open Azitfh', 'url': 'https://aaa-000.vercel.app' },
  };
  if (post.thumbnail_url) schema.image = post.thumbnail_url;
  const schemaEl = document.getElementById('postSchema');
  if (schemaEl) schemaEl.textContent = JSON.stringify(schema);
}

function updateAzitMeta(azit, postCount) {
  const desc = azit.description
    ? `${azit.description} — ${postCount}개 게시물`
    : `${azit.name} 아지트 — ${postCount}개 게시물 · Open Azitfh`;
  document.title = `${azit.icon} ${azit.name} — Open Azitfh`;
  setMeta('ogTitle',         `${azit.icon} ${azit.name} — Open Azitfh`);
  setMeta('ogDescription',   desc);
  setMeta('metaDescription', desc);
  const schema = {
    '@context':   'https://schema.org',
    '@type':      'CollectionPage',
    'name':       azit.name,
    'description': desc,
    'url': window.location.href,
    'isPartOf': { '@type': 'WebSite', 'name': 'Open Azitfh', 'url': 'https://aaa-000.vercel.app' },
  };
  const schemaEl = document.getElementById('azitSchema');
  if (schemaEl) schemaEl.textContent = JSON.stringify(schema);
}

/* HTML 태그 제거 — 미리보기 텍스트 추출용 */

/* ── Supabase Auth ── */
async function authSignUp(email, password, nickname) {
  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: { data: { nickname } }
  });
  if (error) throw error;
  return data;
}

async function authSignIn(email, password) {
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

async function authSignOut() {
  const { error } = await supabaseClient.auth.signOut();
  if (error) throw error;
}

async function getSession() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  return session;
}

/* ── Nav 상태 업데이트 ── */
function updateNav(session) {
  const navLogin  = document.getElementById('navLogin');
  const navSignup = document.getElementById('navSignup');
  const navDash   = document.getElementById('navDash');
  const navLogout = document.getElementById('navLogout');
  const navNotif  = document.getElementById('navNotif');
  const navMsg    = document.getElementById('navMsg');

  if (session) {
    navLogin?.classList.add('hidden');
    navSignup?.classList.add('hidden');
    navDash?.classList.remove('hidden');
    navLogout?.classList.remove('hidden');
    navNotif?.classList.remove('hidden');
    navMsg?.classList.remove('hidden');
    loadNotifBadge(session.user.id);
    loadMsgBadge(session);
  } else {
    navLogin?.classList.remove('hidden');
    navSignup?.classList.remove('hidden');
    navDash?.classList.add('hidden');
    navLogout?.classList.add('hidden');
    navNotif?.classList.add('hidden');
    navMsg?.classList.add('hidden');
  }
}


async function loadNotifBadge(userId) {
  try {
    const { count } = await supabaseClient
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false);
    const badge = document.getElementById('notifBadge');
    if (!badge) return;
    if (count > 0) {
      badge.textContent = count > 9 ? '9+' : String(count);
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  } catch { /* 조용히 무시 */ }
}

/* ── Supabase 에러 메시지 한국어 변환 ── */
function toKoreanError(err) {
  const msg = err.message || '';
  if (msg.includes('already registered') || msg.includes('User already registered'))
    return '이미 사용 중인 이메일이에요.';
  if (msg.includes('Invalid login credentials'))
    return '이메일 또는 비밀번호가 틀렸어요.';
  if (msg.includes('Email not confirmed'))
    return '이메일 인증이 필요해요. 받은 메일함을 확인해 주세요 📬';
  if (msg.includes('Network') || msg.includes('fetch'))
    return '네트워크 오류가 발생했어요. 잠시 후 다시 시도해 주세요.';
  return `오류: ${msg}`;
}

/* ── 아지트 타입 ── */
async function getAzitTypes() {
  const { data } = await supabaseClient
    .from('azit_types')
    .select('key, label, description, default_icon, default_color')
    .order('created_at');
  return data && data.length > 0 ? data : [{ key: 'general', label: '기본', description: '', default_icon: '🏠', default_color: '#4aab8e' }];
}

async function insertAzitType({ label, description = '', default_icon = '🏠', default_color = '#4aab8e' }) {
  const { error } = await supabaseClient
    .from('azit_types')
    .insert({ key: label, label, description, default_icon, default_color });
  if (error) throw error;
}

async function renderTypeFilterBtns(containerId, onSelect) {
  const wrap = document.getElementById(containerId);
  if (!wrap) return;
  const types = await fetchAzitTypesCached().catch(() => [{ key: 'general', label: '기본' }]);
  wrap.querySelectorAll('.azit-type-btn:not([data-type=""])').forEach(b => b.remove());
  types.forEach(t => {
    const btn = document.createElement('button');
    btn.className = 'azit-type-btn';
    btn.dataset.type = t.key;
    btn.textContent = t.default_icon ? `${t.default_icon} ${t.label}` : t.label;
    wrap.appendChild(btn);
  });
  wrap.querySelectorAll('.azit-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      wrap.querySelectorAll('.azit-type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      onSelect(btn.dataset.type);
    });
  });
}

/* ── 관리자 권한 확인 ── */
async function isAdmin() {
  const session = await getSession();
  if (!session) return false;
  try {
    const { data, error } = await supabaseClient
      .from('admins')
      .select('user_id')
      .eq('user_id', session.user.id)
      .maybeSingle();
    if (error) return false;
    return !!data;
  } catch {
    return false;
  }
}

/* ── 로그인 필수 페이지 가드 ── */
async function requireAuth() {
  const session = await getSession();
  if (!session) { window.location.href = 'login.html'; return null; }
  return session;
}

/* ── 신고 제출 ── */
async function reportPost(postId, reason = '기타') {
  const { data, error } = await supabaseClient.rpc('submit_report', {
    p_post_id: postId,
    p_reason: reason,
  });
  if (error) throw error;
  return data;
}

/* ── 이 게시물을 이미 신고했는지 확인 ── */
async function hasReported(postId) {
  const session = await getSession();
  if (!session) return false;
  const { data } = await supabaseClient
    .from('reports')
    .select('id')
    .eq('post_id', postId)
    .eq('reporter_id', session.user.id)
    .maybeSingle();
  return !!data;
}

/* ════════════════════════════════════════
   공지사항 (Supabase)
════════════════════════════════════════ */
async function getNotices() {
  try {
    const { data, error } = await supabaseClient
      .from('notices')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('getNotices:', err);
    return [];
  }
}

async function insertNotice({ title, date }) {
  const { error } = await supabaseClient.from('notices').insert({ title, date });
  if (error) throw error;
}

async function deleteNotice(id) {
  const { error } = await supabaseClient.from('notices').delete().eq('id', id);
  if (error) throw error;
}

async function renderNotices(isAdmin) {
  const wrap = document.getElementById('noticeList');
  if (!wrap) return;

  const list = await getNotices();

  if (list.length === 0) {
    wrap.innerHTML = '<p class="news-empty">공지사항이 없습니다.</p>';
    return;
  }

  wrap.innerHTML = list.map(n => `
    <div class="news-card notice-card">
      <div class="news-card-top">
        <span class="news-badge">📢 공지</span>
        <span class="news-date">${escapeHTML(n.date)}</span>
        ${isAdmin ? `<button class="notice-del" data-id="${n.id}">×</button>` : ''}
      </div>
      <p class="news-title">${escapeHTML(n.title)}</p>
    </div>
  `).join('');

  if (isAdmin) {
    wrap.querySelectorAll('.notice-del').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          await deleteNotice(btn.dataset.id);
          await renderNotices(true);
        } catch {
          showToast('삭제 실패', 'red');
        }
      });
    });
  }
}

async function initNotices(isAdmin) {
  const addBtn = document.getElementById('noticeAddBtn');
  const form   = document.getElementById('noticeForm');
  const input  = document.getElementById('noticeInput');

  if (isAdmin && addBtn) {
    addBtn.classList.remove('hidden');
    addBtn.addEventListener('click', () => {
      form.classList.toggle('hidden');
      if (!form.classList.contains('hidden')) input.focus();
    });
  }

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = input.value.trim();
    if (!title) return;
    try {
      await insertNotice({ title, date: new Date().toLocaleDateString('ko-KR') });
      input.value = '';
      form.classList.add('hidden');
      await renderNotices(true);
    } catch {
      showToast('공지 등록 실패', 'red');
    }
  });

  await renderNotices(isAdmin);
}

/* ════════════════════════════════════════
   카테고리 (Supabase)
════════════════════════════════════════ */
let _selectedCat  = '';
let _selectedType = '';
let _dashType     = '';
let _typeVisible  = false;

const TYPE_LABELS = { general: '기본' };


async function getCategories() {
  try {
    const { data, error } = await supabaseClient
      .from('azits')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('getCategories:', err);
    return [];
  }
}

async function getCategoryNames() {
  const cats = await fetchCategoriesCached();
  return cats.map(c => c.name);
}

async function insertCategory({ name, description = '', created_by = '익명', creator_id = null, type = 'general', icon = '🏠', cover_color = '#4aab8e' }) {
  let sortOrder = 1;
  if (creator_id) {
    const { data: last } = await supabaseClient
      .from('azits').select('sort_order')
      .eq('creator_id', creator_id)
      .order('sort_order', { ascending: false, nullsFirst: false })
      .limit(1).maybeSingle();
    sortOrder = (last?.sort_order || 0) + 1;
  }
  const { error } = await supabaseClient
    .from('azits')
    .insert({ name, description, created_by, creator_id, type, icon, cover_color, sort_order: sortOrder });
  if (error) throw error;
  invalidateCategoriesCache();
}

async function deleteCategory(id) {
  const { error } = await supabaseClient.from('azits').delete().eq('id', id);
  if (error) throw error;
  invalidateCategoriesCache();
}

async function renameAzit(id, newName) {
  const { error } = await supabaseClient.rpc('rename_azit', {
    p_azit_id: id,
    p_new_name: newName,
  });
  if (error) throw error;
  invalidatePostsCache();
  invalidateCategoriesCache();
}

async function getAzitByName(name) {
  const { data } = await supabaseClient
    .from('azits').select('*').eq('name', name).maybeSingle();
  return data;
}

async function updatePost(id, data) {
  const { error } = await supabaseClient
    .from('posts').update(data).eq('id', id);
  if (error) throw error;
  invalidatePostsCache();
}

/* 카테고리별 게시물 수 + 고유 유저 수 — 단일 패스 */
function getCatStats(posts) {
  const counts = {}, sets = {};
  for (const p of posts) {
    counts[p.category] = (counts[p.category] || 0) + 1;
    (sets[p.category] ??= new Set()).add(p.author_id);
  }
  const userCounts = {};
  for (const [cat, s] of Object.entries(sets)) userCounts[cat] = s.size;
  return { postCounts: counts, userCounts };
}

/* ── 카테고리 칩 렌더링 (대시보드용) ── */
/* ── 카테고리 카드 렌더링 (홈 전용, 인기순 정렬) ── */
async function renderCategoryCards() {
  const wrap = document.getElementById('catChips');
  if (!wrap) return;

  const [cats, allPosts] = await Promise.all([
    fetchCategoriesCached(),
    fetchPostsCached().catch(() => []),
  ]);
  const { postCounts, userCounts } = getCatStats(allPosts);
  const search     = (document.getElementById('catSearch')?.value || '').toLowerCase().trim();

  const sorted = cats
    .filter(c => (!search || c.name.toLowerCase().includes(search))
              && (!_selectedType || c.type === _selectedType))
    .sort((a, b) => {
      const sA = (postCounts[a.name] || 0) * 2 + (userCounts[a.name] || 0);
      const sB = (postCounts[b.name] || 0) * 2 + (userCounts[b.name] || 0);
      return sB - sA;
    });

  const maxScore = sorted.length > 0
    ? (postCounts[sorted[0].name] || 0) * 2 + (userCounts[sorted[0].name] || 0)
    : 0;

  wrap.innerHTML = '';

  const allBtn = document.createElement('button');
  allBtn.className = 'cat-card-btn' + (_selectedCat === '' ? ' active' : '');
  allBtn.innerHTML = `<div class="cat-card-name-row"><span class="cat-card-name">전체</span></div>`;
  allBtn.addEventListener('click', async () => {
    _selectedCat = '';
    _listSearch = '';
    const searchEl = document.getElementById('postsSearch');
    if (searchEl) searchEl.value = '';
    updateWriteBtn();
    hideAzitInfoPanel();
    await Promise.all([renderCategoryCards(), renderPosts(), renderPostsList(true)]);
  });
  wrap.appendChild(allBtn);

  if (cats.length === 0) {
    const empty = document.createElement('span');
    empty.className = 'cat-chip-empty';
    empty.textContent = '아지트가 없습니다.';
    wrap.appendChild(empty);
    return;
  }

  if (sorted.length === 0 && search) {
    const empty = document.createElement('span');
    empty.className = 'cat-chip-empty';
    empty.textContent = '검색 결과가 없습니다.';
    wrap.appendChild(empty);
    return;
  }

  sorted.forEach(c => {
    const pc    = postCounts[c.name] || 0;
    const uc    = userCounts[c.name] || 0;
    const score = pc * 2 + uc;
    const isHot = maxScore > 0 && score === maxScore && score > 0;

    const btn = document.createElement('button');
    btn.className = 'cat-card-btn' + (_selectedCat === c.name ? ' active' : '');
    if (c.cover_color) btn.style.setProperty('--cat-color', c.cover_color);

    // ── 이름 행: [아이콘] [이름] [HOT] [→] ──
    const nameRow = document.createElement('div');
    nameRow.className = 'cat-card-name-row';

    if (c.icon) {
      const iconEl = document.createElement('span');
      iconEl.className = 'cat-card-type-icon';
      iconEl.textContent = c.icon;
      nameRow.appendChild(iconEl);
    }

    const nameSpan = document.createElement('span');
    nameSpan.className = 'cat-card-name';
    nameSpan.textContent = c.name;
    nameRow.appendChild(nameSpan);

    if (isHot) {
      const badge = document.createElement('span');
      badge.className = 'cat-hot-badge';
      badge.textContent = 'HOT';
      nameRow.appendChild(badge);
    }

    btn.appendChild(nameRow);

    // ── 타입 배지 (타입 보기 토글 시 표시) ──
    if (c.type) {
      const typeEl = document.createElement('span');
      typeEl.className = 'cat-card-type';
      typeEl.textContent = TYPE_LABELS[c.type] || c.type;
      btn.appendChild(typeEl);
    }

    btn.addEventListener('click', async () => {
      _selectedCat = c.name;
      _listSearch = '';
      const searchEl = document.getElementById('postsSearch');
      if (searchEl) searchEl.value = '';
      updateWriteBtn();
      showAzitInfoPanel(c);
      await Promise.all([renderCategoryCards(), renderPosts(), renderPostsList(true)]);
    });
    wrap.appendChild(btn);
  });

  // 렌더 후 overflow 행 감지 (1행 초과 시 숨기고 "더 보기" 표시)
  requestAnimationFrame(() => _applyRowLimit(wrap));
}

/* ── 아지트 카드 행 넘침 숨김/펼치기 ── */
function _applyRowLimit(wrap) {
  // 이전 "더 보기" 버튼 제거
  wrap.parentElement?.querySelectorAll('.cat-more-btn').forEach(b => b.remove());

  const allBtns = [...wrap.querySelectorAll('.cat-card-btn')];
  allBtns.forEach(b => b.classList.remove('cat-card-hidden'));

  if (!allBtns.length) return;

  const rowTop  = allBtns[0].offsetTop;
  const hidden  = allBtns.filter(b => b.offsetTop > rowTop);

  if (!hidden.length) return;

  hidden.forEach(b => b.classList.add('cat-card-hidden'));

  const moreBtn = document.createElement('button');
  moreBtn.className = 'cat-more-btn';
  moreBtn.textContent = `+ ${hidden.length}개 더 보기`;
  moreBtn.addEventListener('click', () => {
    hidden.forEach(b => b.classList.remove('cat-card-hidden'));
    moreBtn.remove();
    // 접기 버튼 추가
    const lessBtn = document.createElement('button');
    lessBtn.className = 'cat-more-btn cat-less-btn';
    lessBtn.textContent = '접기 ↑';
    lessBtn.addEventListener('click', () => { lessBtn.remove(); _applyRowLimit(wrap); });
    wrap.parentElement?.appendChild(lessBtn);
  });
  wrap.parentElement?.appendChild(moreBtn);
}

/* ── 선택된 아지트 정보 패널 ── */
function showAzitInfoPanel(azit) {
  const panel  = document.getElementById('selectedAzitSection');
  if (!panel) return;
  panel.classList.remove('hidden');

  const icon   = document.getElementById('selAzitIcon');
  const name   = document.getElementById('selAzitName');
  const desc   = document.getElementById('selAzitDesc');
  const enter  = document.getElementById('selAzitEnterBtn');
  const edit   = document.getElementById('selAzitEditBtn');

  if (icon)  { icon.style.color = azit.cover_color || '#4aab8e'; icon.textContent = azit.icon || '🏠'; }
  if (name)  name.textContent   = azit.name;
  if (desc)  desc.textContent   = azit.description || '';
  if (enter) enter.href         = `azitfh.html?cat=${encodeURIComponent(azit.name)}`;
  if (edit)  { edit.href = `azit-edit.html?id=${azit.id}`; }

  // 컬러 액센트
  panel.style.setProperty('--sel-color', azit.cover_color || '#4aab8e');
}

function hideAzitInfoPanel() {
  const panel = document.getElementById('selectedAzitSection');
  panel?.classList.add('hidden');
}

/* ── 전역 헤더 검색 ── */
async function searchAll(q) {
  const [postsRes, azitsRes] = await Promise.all([
    supabaseClient.from('posts')
      .select('id,title,category,code_lang,game_url,video_url')
      .eq('hidden', false).ilike('title', `%${q}%`).limit(5),
    supabaseClient.from('azits')
      .select('id,name,type,icon,cover_color').ilike('name', `%${q}%`).limit(4),
  ]);
  return { posts: postsRes.data || [], azits: azitsRes.data || [] };
}

function initHeaderSearch() {
  const input    = document.getElementById('headerSearch');
  const dropdown = document.getElementById('searchDropdown');
  if (!input || !dropdown) return;

  let timer;

  function renderDropdown(results, q) {
    const { posts, azits } = results;
    if (!posts.length && !azits.length) {
      dropdown.innerHTML = `<p class="sd-empty">검색 결과가 없어요.</p>`;
      dropdown.classList.remove('hidden');
      return;
    }
    let html = '';
    if (azits.length) {
      html += `<div class="sd-group-label">🏠 아지트</div>`;
      html += azits.map(a => `
        <a class="sd-item" href="azitfh.html?cat=${encodeURIComponent(a.name)}">
          <span class="sd-icon" style="color:${escapeHTML(a.cover_color||'#4aab8e')}">${escapeHTML(a.icon||'🏠')}</span>
          <span class="sd-text">${escapeHTML(a.name)}</span>
          <span class="sd-type">${escapeHTML(a.type||'')}</span>
        </a>`).join('');
    }
    if (posts.length) {
      html += `<div class="sd-group-label">📝 게시물</div>`;
      html += posts.map(p => {
        const ti = postTypeIcon(p) || '📝';
        return `
        <a class="sd-item" href="post-detail.html?id=${p.id}">
          <span class="sd-icon">${ti}</span>
          <span class="sd-text">${escapeHTML(p.title)}</span>
          <span class="sd-type">${escapeHTML(p.category)}</span>
        </a>`;
      }).join('');
    }
    html += `<a class="sd-more" href="search.html?q=${encodeURIComponent(q)}">전체 결과 보기 →</a>`;
    dropdown.innerHTML = html;
    dropdown.classList.remove('hidden');
  }

  input.addEventListener('input', () => {
    clearTimeout(timer);
    const q = input.value.trim();
    if (!q) { dropdown.classList.add('hidden'); return; }
    timer = setTimeout(async () => {
      const results = await searchAll(q).catch(() => ({ posts: [], azits: [] }));
      renderDropdown(results, q);
    }, 300);
  });

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const q = input.value.trim();
      if (q) location.href = `search.html?q=${encodeURIComponent(q)}`;
    }
    if (e.key === 'Escape') dropdown.classList.add('hidden');
  });

  document.addEventListener('click', e => {
    if (!e.target.closest('#headerSearchWrap')) dropdown.classList.add('hidden');
  });
}

/* ── 글쓰기 버튼 URL 동기화 ── */
function updateWriteBtn() {
  const btn = document.getElementById('writeBtn');
  if (!btn) return;
  const url = new URL('post-write.html', location.href);
  if (_selectedCat) url.searchParams.set('cat', _selectedCat);
  btn.href = url.toString();
}

/* ── 홈 카테고리 섹션 초기화 ── */
async function initCategorySection() {
  await renderCategoryCards();

  document.getElementById('catSearch')?.addEventListener('input', () => {
    renderCategoryCards();
  });

  await renderTypeFilterBtns('azitTypeFilter', (type) => {
    _selectedType = type;
    renderCategoryCards();
  });

  const toggleBtn = document.getElementById('typeToggleBtn');
  const catChips  = document.getElementById('catChips');
  if (toggleBtn && catChips) {
    toggleBtn.addEventListener('click', () => {
      _typeVisible = !_typeVisible;
      catChips.classList.toggle('azit-type-show', _typeVisible);
      toggleBtn.textContent = _typeVisible ? '타입 숨기기' : '타입 보기';
      toggleBtn.classList.toggle('active', _typeVisible);
    });
  }
}

/* ── 대시보드 카테고리 섹션 초기화 (조회만) ── */
/* ════════════════════════════════════════
   게시물 (Supabase)
════════════════════════════════════════ */
async function getPosts(categoryFilter = '') {
  let query = supabaseClient.from('posts').select('*').eq('hidden', false);
  if (categoryFilter) query = query.eq('category', categoryFilter);
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function getPost(id) {
  try {
    const { data, error } = await supabaseClient
      .from('posts')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('getPost:', err);
    return null;
  }
}

async function insertPost(postData) {
  const { error } = await supabaseClient
    .from('posts')
    .insert(postData);
  if (error) throw error;
  invalidatePostsCache();
}

async function deletePost(id) {
  const { error } = await supabaseClient.from('posts').delete().eq('id', id);
  if (error) throw error;
  invalidatePostsCache();
}

async function incrementViews(id) {
  try {
    await supabaseClient.rpc('increment_views', { post_id: id });
  } catch (err) {
    console.error('incrementViews:', err);
  }
}

/* HTML 이스케이프 (XSS 방지) */
/* Quill HTML 정제: 앞뒤 빈 단락 제거 후 null 반환 */
function cleanQuillHTML(html) {
  if (!html) return null;
  const emptyP = /(\s*<p>(\s|&nbsp;)*(<br\s*\/?>)?\s*<\/p>\s*)/gi;
  let cleaned = html
    .replace(new RegExp(`^(${emptyP.source})+`, 'gi'), '')
    .replace(new RegExp(`(${emptyP.source})+$`,  'gi'), '')
    .trim();
  return cleaned || null;
}


/* ── 인기 게시물 렌더링 (조회수순, 최대 12개) ── */
async function renderPosts() {
  const grid    = document.getElementById('newsGrid');
  const titleEl = document.getElementById('postsSectionTitle');
  if (!grid) return;

  if (titleEl) titleEl.textContent = '인기 게시물';

  try {
    let posts = await fetchPostsCached();
    if (_selectedCat) posts = posts.filter(p => p.category === _selectedCat);
    posts = posts.slice().sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, CONFIG.POPULAR_LIMIT);

    if (posts.length === 0) {
      const msg = _selectedCat
        ? `"${escapeHTML(_selectedCat)}" 아지트에 게시물이 없습니다.`
        : '아직 게시물이 없습니다.';
      grid.innerHTML = `<p class="news-empty">${msg}</p>`;
      return;
    }

    grid.innerHTML = posts.map(p => {
      const isCode    = !!p.code_lang;
      const langBadge = isCode ? `<span class="code-lang-badge-sm">${escapeHTML(p.code_lang)}</span>` : '';
      return `
        <a class="news-card" href="post-detail.html?id=${p.id}">
          ${renderPostThumbHtml(p)}
          <div class="news-card-top">
            <span class="news-badge">${escapeHTML(p.category)}</span>${langBadge}
            <span class="news-date">${formatDate(p.created_at)}</span>
          </div>
          <h3 class="news-title">${escapeHTML(p.title)}</h3>
          ${renderPostDescHtml(p)}
          <div class="post-meta">by ${escapeHTML(p.author_nickname)} · 조회 ${p.views || 0}</div>
        </a>`;
    }).join('');

    // 펼쳐보기 버튼: 실제로 2줄 초과 시에만 표시
    setTimeout(() => {
      grid.querySelectorAll('.expand-btn').forEach(btn => {
        const desc = btn.previousElementSibling;
        if (!desc || desc.scrollHeight <= desc.clientHeight + 2) {
          btn.style.display = 'none';
          return;
        }
        btn.addEventListener('click', e => {
          e.preventDefault();
          e.stopPropagation();
          const expanded = btn.dataset.expanded === 'true';
          desc.classList.toggle('expanded', !expanded);
          btn.dataset.expanded = String(!expanded);
          btn.textContent = !expanded ? '접기' : '펼쳐보기';
        });
      });
    }, 0);
  } catch (err) {
    console.error('renderPosts 오류:', err);
    grid.innerHTML = `<p class="news-empty">게시물을 불러오지 못했어요.<br><small style="font-size:11px;opacity:.7">${escapeHTML(err.message || '')}</small></p>`;
  }
}

/* ── 게시물 목록 — 페이지네이션 + 검색 ── */
const LIST_PAGE_SIZE = 20;
let _listPage = 0;
let _listSearch = '';

async function renderPostsList(resetPage = false) {
  const wrap    = document.getElementById('postsList');
  const titleEl = document.getElementById('postsListTitle');
  if (!wrap) return;

  if (resetPage) _listPage = 0;
  if (titleEl) titleEl.textContent = '게시물';

  try {
    let q = supabaseClient
      .from('posts')
      .select('id,title,category,author_nickname,views,created_at,game_url,video_url,code_lang,pinned', { count: 'exact' })
      .eq('hidden', false)
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .range(_listPage * LIST_PAGE_SIZE, (_listPage + 1) * LIST_PAGE_SIZE - 1);

    if (_selectedCat) q = q.eq('category', _selectedCat);
    if (_listSearch)  q = q.ilike('title', `%${_listSearch}%`);

    const { data: posts, count, error } = await q;
    if (error) throw error;

    const totalPages = Math.ceil((count || 0) / LIST_PAGE_SIZE);

    const rows = (posts || []).map(p =>
      renderPostRowHTML(p, { showPin: true })
    ).join('');

    const pagination = totalPages > 1 ? `
      <div class="pagination">
        <button class="page-btn" ${_listPage === 0 ? 'disabled' : ''} onclick="_listPage--;renderPostsList()">← 이전</button>
        <span class="page-info">${_listPage + 1} / ${totalPages}</span>
        <button class="page-btn" ${_listPage >= totalPages - 1 ? 'disabled' : ''} onclick="_listPage++;renderPostsList()">다음 →</button>
      </div>` : '';

    wrap.innerHTML = posts?.length === 0
      ? `<p class="news-empty">${_listSearch ? `"${escapeHTML(_listSearch)}" 검색 결과가 없어요.` : '게시물이 없습니다.'}</p>${pagination}`
      : rows + pagination;

  } catch (err) {
    console.error('renderPostsList 오류:', err);
    wrap.innerHTML = `<p class="news-empty">게시물을 불러오지 못했어요.</p>`;
  }
}

/* ── 아지트 관리 (대시보드, 본인 아지트만) ── */
async function renderCategories(userId) {
  const ul = document.getElementById('catList');
  if (!ul) return;

  const { data: rawCats, error } = await supabaseClient
    .from('azits')
    .select('*')
    .eq('creator_id', userId)
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('created_at',  { ascending: true });

  if (error) {
    ul.innerHTML = '<li class="cat-empty">아지트를 불러오지 못했어요.</li>';
    console.error('renderCategories:', error);
    return;
  }

  const cats = _dashType
    ? (rawCats || []).filter(c => c.type === _dashType)
    : (rawCats || []);

  if (cats.length === 0) {
    ul.innerHTML = '<li class="cat-empty">내가 만든 아지트가 없습니다.</li>';
    return;
  }

  ul.innerHTML = cats.map(c => {
    const typeLabel = TYPE_LABELS[c.type] || c.type || '';
    const color     = c.cover_color || '#4aab8e';
    const icon      = c.icon || '🏠';
    return `
    <li class="cat-item" data-id="${c.id}" style="--cat-color:${escapeHTML(color)}">
      <div class="cat-drag-handle" title="드래그하여 순서 변경">⠿</div>
      <span class="cat-item-icon-dot" title="${escapeHTML(typeLabel)}">${escapeHTML(icon)}</span>
      <div style="flex:1;min-width:0;overflow:hidden">
        <div class="cat-name-row">
          <span class="cat-name">${escapeHTML(c.name)}</span>
          ${typeLabel ? `<span class="cat-item-type">${escapeHTML(typeLabel)}</span>` : ''}
        </div>
        ${c.description ? `<div class="cat-item-desc">${escapeHTML(c.description)}</div>` : ''}
        <div class="cat-item-meta">${new Date(c.created_at).toLocaleDateString('ko-KR')}</div>
      </div>
      <div class="cat-actions">
        <a href="azitfh.html?cat=${encodeURIComponent(c.name)}"
           class="cat-action-btn cat-action-visit" title="아지트 입장">입장 →</a>
        <a href="azit-edit.html?id=${c.id}"
           class="cat-action-btn cat-action-ren" title="아지트 편집">✏️</a>
        <button class="cat-action-btn cat-action-del"
                data-id="${c.id}" data-name="${escapeHTML(c.name)}" title="삭제">×</button>
      </div>
    </li>`;
  }).join('');

  ul.querySelectorAll('.cat-action-del').forEach(btn => {
    btn.addEventListener('click', async () => {
      const { count } = await supabaseClient
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .eq('category', btn.dataset.name);

      const postNote = count > 0
        ? `\n\n게시물 ${count}개는 삭제되지 않고 그대로 유지됩니다.`
        : '';

      if (!confirm(`"${btn.dataset.name}" 아지트를 삭제할까요?${postNote}`)) return;

      try {
        await deleteCategory(btn.dataset.id);
        await renderCategories(userId);
        showToast('아지트가 삭제됐어요. 게시물은 유지됩니다.', 'green');
      } catch {
        showToast('삭제 실패', 'red');
      }
    });
  });

  initDragSort(ul);
}

/* ── 아지트 순서 드래그 정렬 ── */
function initDragSort(ul) {
  // 핸들을 누를 때만 드래그 활성화
  ul.querySelectorAll('.cat-drag-handle').forEach(handle => {
    handle.addEventListener('mousedown', () => {
      handle.closest('.cat-item').draggable = true;
    });
    handle.addEventListener('touchstart', () => {
      handle.closest('.cat-item').draggable = true;
    }, { passive: true });
  });

  ul.addEventListener('dragstart', e => {
    const item = e.target.closest('.cat-item');
    if (!item) return;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', ''); // Firefox 필수
    setTimeout(() => item.classList.add('dragging'), 0);
  });

  ul.addEventListener('dragend', e => {
    const item = e.target.closest('.cat-item');
    item?.classList.remove('dragging');
    ul.querySelectorAll('.cat-item').forEach(i => { i.draggable = false; });
    saveAzitOrder(ul);
  });

  ul.addEventListener('dragover', e => {
    e.preventDefault();
    const target = e.target.closest('.cat-item');
    if (!target) return;
    const dragging = ul.querySelector('.cat-item.dragging');
    if (!dragging || dragging === target) return;
    const rect = target.getBoundingClientRect();
    if (e.clientY < rect.top + rect.height / 2) {
      ul.insertBefore(dragging, target);
    } else {
      target.after(dragging);
    }
  });
}

async function saveAzitOrder(ul) {
  const items = [...ul.querySelectorAll('.cat-item[data-id]')];
  try {
    await Promise.all(
      items.map((item, idx) =>
        supabaseClient.from('azits').update({ sort_order: idx + 1 }).eq('id', item.dataset.id)
      )
    );
  } catch (err) {
    console.error('순서 저장 실패:', err);
  }
}

async function initCategoryManager(userId) {
  await Promise.all([
    renderCategories(userId),
    renderTypeFilterBtns('dashTypeFilter', (type) => {
      _dashType = type;
      renderCategories(userId);
    }),
  ]);
}

/* ════════════════════════════════════════
   Page: Azit Edit (전체 편집)
════════════════════════════════════════ */
async function initAzitEdit() {
  const session = await requireAuth();
  if (!session) return;
  updateNav(session);

  const id = new URLSearchParams(location.search).get('id');
  if (!id) { location.href = 'dashboard.html'; return; }

  // 아지트 데이터 로드
  const { data: azit } = await supabaseClient.from('azits').select('*').eq('id', id).maybeSingle();
  if (!azit || azit.creator_id !== session.user.id) {
    showToast('편집 권한이 없어요.', 'red');
    setTimeout(() => { location.href = 'dashboard.html'; }, 1000);
    return;
  }

  document.title = `${azit.name} 편집 — Open Azitfh`;
  document.getElementById('azitId').value = id;

  // 폼에 기존값 채우기
  document.getElementById('editAzitName').value   = azit.name;
  document.getElementById('editAzitDesc').value   = azit.description || '';
  document.getElementById('editIcon').value       = azit.icon || '🏠';
  document.getElementById('editColor').value      = azit.cover_color || '#4aab8e';
  document.getElementById('editColorHex').textContent = azit.cover_color || '#4aab8e';

  // 기존 게시물 레이아웃
  const layout = azit.post_layout || 'card';
  const layoutRadio = document.querySelector(`input[name="postLayout"][value="${layout}"]`);
  if (layoutRadio) layoutRadio.checked = true;

  // ── 미리보기 초기화 ──
  function updatePreview() {
    const name  = document.getElementById('editAzitName').value  || '아지트 이름';
    const desc  = document.getElementById('editAzitDesc').value  || '';
    const icon  = document.getElementById('editIcon').value      || '🏠';
    const color = document.getElementById('editColor').value     || '#4aab8e';
    const bannerUrl = _currentBannerUrl;
    const iconUrl   = _currentIconUrl;

    document.getElementById('previewName').textContent = name;
    document.getElementById('previewDesc').textContent = desc;

    const bg = document.getElementById('previewBg');
    if (bannerUrl) {
      bg.style.background = '';
      bg.style.backgroundImage = `url('${escapeHTML(bannerUrl)}')`;
      bg.style.backgroundSize = 'cover';
      bg.style.backgroundPosition = 'center';
    } else {
      bg.style.backgroundImage = '';
      bg.style.background = `linear-gradient(135deg, ${color} 0%, ${darkenHex(color, 50)} 100%)`;
    }

    const iconEl = document.getElementById('previewIcon');
    if (iconUrl) {
      iconEl.innerHTML = `<img src="${escapeHTML(iconUrl)}" style="width:44px;height:44px;border-radius:50%;object-fit:cover">`;
    } else {
      iconEl.textContent = icon;
    }
  }

  let _currentBannerUrl = azit.banner_url || '';
  let _currentIconUrl   = azit.icon_url   || '';
  let _bannerFile = null, _iconFile = null;

  // 기존 배너/아이콘 표시
  if (_currentBannerUrl) {
    document.getElementById('bannerPreviewImg').src = _currentBannerUrl;
    document.getElementById('bannerPreviewImg').classList.remove('hidden');
    document.getElementById('bannerPlaceholder').classList.add('hidden');
  }
  if (_currentIconUrl) {
    document.getElementById('iconImgEl').src = _currentIconUrl;
    document.getElementById('iconImgEl').classList.remove('hidden');
    document.getElementById('iconImgPlaceholder').classList.add('hidden');
  }

  updatePreview();

  // ── 입력 이벤트 ──
  ['editAzitName', 'editAzitDesc', 'editIcon'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', updatePreview);
  });
  document.getElementById('editColor')?.addEventListener('input', function() {
    document.getElementById('editColorHex').textContent = this.value;
    updatePreview();
  });

  // ── 배너 파일 선택 ──
  const bannerInput = document.getElementById('bannerFileInput');
  document.getElementById('bannerUploadBtn')?.addEventListener('click', () => bannerInput?.click());
  bannerInput?.addEventListener('change', () => {
    const file = bannerInput.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { showToast('이미지는 5MB 이하여야 해요.', 'red'); return; }
    _bannerFile = file;
    const url = URL.createObjectURL(file);
    _currentBannerUrl = url;
    document.getElementById('bannerPreviewImg').src = url;
    document.getElementById('bannerPreviewImg').classList.remove('hidden');
    document.getElementById('bannerPlaceholder').classList.add('hidden');
    document.getElementById('bannerFileInfo').textContent = file.name;
    updatePreview();
  });
  document.getElementById('bannerClearBtn')?.addEventListener('click', () => {
    _bannerFile = null; _currentBannerUrl = '';
    bannerInput.value = '';
    document.getElementById('bannerPreviewImg').classList.add('hidden');
    document.getElementById('bannerPlaceholder').classList.remove('hidden');
    document.getElementById('bannerFileInfo').textContent = '(제거됨)';
    updatePreview();
  });

  // ── 아이콘 이미지 선택 ──
  const iconInput = document.getElementById('iconFileInput');
  document.getElementById('iconUploadBtn')?.addEventListener('click', () => iconInput?.click());
  iconInput?.addEventListener('change', () => {
    const file = iconInput.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { showToast('아이콘 이미지는 2MB 이하여야 해요.', 'red'); return; }
    _iconFile = file;
    const url = URL.createObjectURL(file);
    _currentIconUrl = url;
    document.getElementById('iconImgEl').src = url;
    document.getElementById('iconImgEl').classList.remove('hidden');
    document.getElementById('iconImgPlaceholder').classList.add('hidden');
    updatePreview();
  });
  document.getElementById('iconClearBtn')?.addEventListener('click', () => {
    _iconFile = null; _currentIconUrl = '';
    iconInput.value = '';
    document.getElementById('iconImgEl').classList.add('hidden');
    document.getElementById('iconImgPlaceholder').classList.remove('hidden');
    updatePreview();
  });

  // 레이아웃 라디오 변경
  document.querySelectorAll('input[name="postLayout"]').forEach(r => {
    r.addEventListener('change', () => {
      document.querySelectorAll('.layout-option').forEach(el => el.classList.remove('selected'));
      r.closest('.layout-option')?.classList.add('selected');
    });
  });
  document.querySelector(`input[name="postLayout"][value="${layout}"]`)?.closest('.layout-option')?.classList.add('selected');

  // ── 고급 설정 ──
  const dcfg = typeof azit.display_config === 'object' && azit.display_config
    ? azit.display_config
    : {};

  // 토글 패널
  const advToggle = document.getElementById('advancedToggle');
  const advPanel  = document.getElementById('advancedPanel');
  const advArrow  = document.getElementById('advancedArrow');
  advToggle?.addEventListener('click', () => {
    const open = !advPanel.classList.contains('hidden');
    advPanel.classList.toggle('hidden', open);
    if (advArrow) advArrow.textContent = open ? '▼' : '▲';
    advToggle.classList.toggle('active', !open);
  });

  // 열 수 피커
  const currentCols = dcfg.columns || 3;
  document.querySelectorAll('.col-btn').forEach(btn => {
    const n = parseInt(btn.dataset.cols);
    btn.classList.toggle('active', n === currentCols);
    btn.addEventListener('click', () => {
      document.querySelectorAll('.col-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // 카드 크기 피커
  const currentSize = dcfg.cardSize || 'normal';
  document.querySelectorAll('.size-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.size === currentSize);
    btn.addEventListener('click', () => {
      document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // 표시 정보 토글
  document.querySelectorAll('[data-cfg]').forEach(cb => {
    const key = cb.dataset.cfg;
    cb.checked = dcfg[key] !== false; // 기본 true
  });

  // 기본 정렬
  const sortSel = document.getElementById('defaultSortSel');
  if (sortSel && dcfg.defaultSort) sortSel.value = dcfg.defaultSort;

  // display_config 수집 함수
  function collectDisplayConfig() {
    const cfg = {};
    const activeCol = document.querySelector('.col-btn.active');
    cfg.columns  = activeCol ? parseInt(activeCol.dataset.cols) : 3;
    const activeSz = document.querySelector('.size-btn.active');
    cfg.cardSize = activeSz ? activeSz.dataset.size : 'normal';
    document.querySelectorAll('[data-cfg]').forEach(cb => { cfg[cb.dataset.cfg] = cb.checked; });
    cfg.defaultSort = document.getElementById('defaultSortSel')?.value || 'newest';
    return cfg;
  }

  // ── 저장 ──
  const form    = document.getElementById('azitEditForm');
  const saveBtn = form.querySelector('[type=submit]');
  saveBtn.dataset.label = saveBtn.textContent;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('editAzitName').value.trim();
    if (!name) { showToast('이름을 입력해 주세요.', 'red'); return; }

    setLoading(saveBtn, true);
    try {
      let bannerUrl = _currentBannerUrl.startsWith('blob:') ? azit.banner_url : _currentBannerUrl;
      let iconUrl   = _currentIconUrl.startsWith('blob:')   ? azit.icon_url   : _currentIconUrl;

      // 배너 업로드
      if (_bannerFile) {
        const ext  = _bannerFile.name.split('.').pop().toLowerCase();
        const path = `azit-banners/${id}.${ext}`;
        const { error: upErr } = await supabaseClient.storage
          .from('post-media').upload(path, _bannerFile, { contentType: _bannerFile.type, upsert: true });
        if (upErr) throw new Error('배너 업로드 실패: ' + upErr.message);
        bannerUrl = supabaseClient.storage.from('post-media').getPublicUrl(path).data.publicUrl;
      }
      if (!_currentBannerUrl) bannerUrl = null; // 제거

      // 아이콘 이미지 업로드
      if (_iconFile) {
        const ext  = _iconFile.name.split('.').pop().toLowerCase();
        const path = `azit-icons/${id}.${ext}`;
        const { error: upErr } = await supabaseClient.storage
          .from('post-media').upload(path, _iconFile, { contentType: _iconFile.type, upsert: true });
        if (upErr) throw new Error('아이콘 업로드 실패: ' + upErr.message);
        iconUrl = supabaseClient.storage.from('post-media').getPublicUrl(path).data.publicUrl;
      }
      if (!_currentIconUrl) iconUrl = null; // 제거

      const postLayout = document.querySelector('input[name="postLayout"]:checked')?.value || 'card';
      const updateData = {
        name:        name,
        description: nullIfEmpty(document.getElementById('editAzitDesc').value),
        icon:        document.getElementById('editIcon').value || '🏠',
        cover_color: document.getElementById('editColor').value,
        banner_url:  bannerUrl || null,
        icon_url:    iconUrl   || null,
        post_layout:     postLayout,
        display_config:  collectDisplayConfig(),
      };

      // 이름 변경 시 RPC (게시물 category도 변경)
      if (name !== azit.name) {
        const { error: rnErr } = await supabaseClient.rpc('rename_azit', { p_azit_id: id, p_new_name: name });
        if (rnErr) throw rnErr;
        delete updateData.name; // rename_azit이 처리
      }
      const { error } = await supabaseClient.from('azits').update(updateData).eq('id', id);
      if (error) throw error;

      invalidateCategoriesCache();
      showToast('아지트가 업데이트됐어요!', 'green');
      setTimeout(() => { location.href = `azitfh.html?cat=${encodeURIComponent(name)}`; }, 900);
    } catch (err) {
      showToast('저장 실패: ' + (err.message || ''), 'red');
    } finally {
      setLoading(saveBtn, false);
    }
  });
}

/* ════════════════════════════════════════
   Page: Azit Rename
════════════════════════════════════════ */
async function initAzitRename() {
  const session = await requireAuth();
  if (!session) return;
  updateNav(session);

  const params = new URLSearchParams(location.search);
  const id   = params.get('id');
  const name = decodeURIComponent(params.get('name') || '');
  if (!id || !name) { location.href = 'dashboard.html'; return; }

  document.getElementById('currentAzitName').textContent = name;
  const input = document.getElementById('azitNewName');
  input.value = name;
  input.focus();
  input.select();

  const form      = document.getElementById('azitRenameForm');
  const submitBtn = form.querySelector('[type=submit]');
  submitBtn.dataset.label = submitBtn.textContent;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newName = input.value.trim();
    if (!newName)        { showToast('이름을 입력해 주세요.', 'red'); return; }
    if (newName === name) { location.href = 'dashboard.html'; return; }

    setLoading(submitBtn, true);
    try {
      await renameAzit(id, newName);
      showToast(`"${newName}" 으로 변경됐어요.`, 'green');
      setTimeout(() => { location.href = 'dashboard.html'; }, 800);
    } catch (err) {
      showToast('변경 실패', 'red');
      setLoading(submitBtn, false);
    }
  });
}

/* ════════════════════════════════════════
   Page: Azit Create
════════════════════════════════════════ */
async function initAzitCreate() {
  const session = await requireAuth();
  if (!session) return;
  updateNav(session);

  const form = document.getElementById('azitCreateForm');
  if (!form) return;

  const types = await fetchAzitTypesCached().catch(() => [
    { key: 'general', label: '기본', description: '기본 형태의 커뮤니티 공간입니다.', default_icon: '🏠', default_color: '#4aab8e' },
  ]);

  // ── 비주얼 타입 카드 렌더링 ──
  const grid      = document.getElementById('azitTypeCards');
  const hiddenSel = document.getElementById('azitType');

  if (grid && hiddenSel) {
    grid.innerHTML = types.map(t => `
      <button type="button" class="azit-type-row" data-key="${escapeHTML(t.key)}"
              style="--type-color:${escapeHTML(t.default_color || '#4aab8e')}">
        <span class="atr-icon">${escapeHTML(t.default_icon || '🏠')}</span>
        <div class="atr-info">
          <span class="atr-name">${escapeHTML(t.label)}</span>
          <span class="atr-desc">${escapeHTML(t.description || '')}</span>
        </div>
        <span class="atr-check">✓</span>
      </button>
    `).join('');

    function selectType(key) {
      grid.querySelectorAll('.azit-type-row').forEach(c => c.classList.toggle('selected', c.dataset.key === key));
      if (hiddenSel) hiddenSel.value = key;
    }

    grid.querySelectorAll('.azit-type-row').forEach(card => {
      card.addEventListener('click', () => selectType(card.dataset.key));
    });

    selectType(types[0]?.key || 'general');
  }

  const submitBtn = form.querySelector('[type=submit]');
  submitBtn.dataset.label = submitBtn.textContent;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = form.azitName.value.trim();
    const desc = form.azitDesc.value.trim();
    const type        = hiddenSel?.value || 'general';
    const selectedType = types.find(t => t.key === type);

    if (!name) { showToast('아지트 이름을 입력해 주세요.', 'red'); return; }

    const user     = session.user;
    const nickname = user.user_metadata?.nickname || user.email;
    setLoading(submitBtn, true);

    try {
      await insertCategory({
        name,
        description: nullIfEmpty(desc),
        created_by:  nickname,
        creator_id:  user.id,
        type,
        icon:        selectedType?.default_icon  || '🏠',
        cover_color: selectedType?.default_color || '#4aab8e',
      });
      showToast(`"${name}" 아지트가 만들어졌어요!`, 'green');
      setTimeout(() => { location.href = 'dashboard.html'; }, 900);
    } catch (err) {
      setLoading(submitBtn, false);
      if (err.code === '23505') showToast('이미 있는 아지트 이름이에요.', 'red');
      else showToast('아지트 생성 실패', 'red');
    }
  });
}

/* ════════════════════════════════════════
   Page: Azit Type Create
════════════════════════════════════════ */
async function initAzitTypeCreate() {
  const session = await requireAuth();
  if (!session) return;
  updateNav(session);

  const form = document.getElementById('azitTypeCreateForm');
  if (!form) return;

  const submitBtn  = form.querySelector('[type=submit]');
  const iconInput  = document.getElementById('azitTypeIcon');
  const colorInput = document.getElementById('azitTypeColor');
  const hexSpan    = document.getElementById('azitTypeColorHex');
  const prevBanner = document.getElementById('typePreviewBanner');
  const prevIcon   = document.getElementById('typePreviewIcon');
  const prevName   = document.getElementById('typePreviewName');
  const prevDesc   = document.getElementById('typePreviewDesc');

  submitBtn.dataset.label = submitBtn.textContent;

  function updatePreview() {
    const label = form.azitTypeLabel.value.trim() || '타입 이름';
    const desc  = form.azitTypeDesc.value.trim()  || '엔진 설명';
    const icon  = iconInput.value  || '🏠';
    const color = colorInput.value || '#4aab8e';
    hexSpan.textContent  = color;
    prevIcon.textContent = icon;
    prevName.textContent = label;
    prevDesc.textContent = desc;
    prevBanner.style.background =
      `linear-gradient(135deg, ${color} 0%, ${darkenHex(color, 50)} 100%)`;
  }

  form.azitTypeLabel.addEventListener('input', updatePreview);
  form.azitTypeDesc.addEventListener('input', updatePreview);
  iconInput.addEventListener('input', updatePreview);
  colorInput.addEventListener('input', updatePreview);
  updatePreview();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const label = form.azitTypeLabel.value.trim();
    if (label.length < 2) { showToast('타입 이름은 2자 이상이어야 해요.', 'red'); return; }

    setLoading(submitBtn, true);
    try {
      await insertAzitType({
        label,
        description:   form.azitTypeDesc.value.trim(),
        default_icon:  iconInput.value.trim() || '🏠',
        default_color: colorInput.value,
      });
      showToast(`"${label}" 엔진이 등록됐어요!`, 'green');
      setTimeout(() => { location.href = 'dashboard.html'; }, 900);
    } catch (err) {
      setLoading(submitBtn, false);
      if (err.code === '23505') showToast('이미 있는 타입 이름이에요.', 'red');
      else showToast('타입 생성 실패', 'red');
    }
  });
}

/* ════════════════════════════════════════
   Page: Post Write  (Quill 리치 에디터)
════════════════════════════════════════ */
async function initPostWrite() {
  const session = await requireAuth();
  if (!session) return;
  updateNav(session);

  const form = document.getElementById('postWriteForm');
  if (!form) return;

  /* ── Quill 폰트·크기 등록 ── */
  const Font = Quill.import('formats/font');
  Font.whitelist = ['serif', 'monospace'];
  Quill.register(Font, true);

  const Size = Quill.import('attributors/style/size');
  Size.whitelist = ['12px', '14px', '18px', '24px', '32px'];
  Quill.register(Size, true);

  /* ── Quill 초기화 ── */
  let quill;
  quill = new Quill('#quillEditor', {
    theme: 'snow',
    placeholder: '내용을 입력하세요',
    modules: {
      toolbar: {
        container: '#quillToolbar',
        handlers: {
          image: () => triggerMediaUpload(quill, 'image/*,image/gif'),
        },
      },
    },
  });

  /* 첨부파일 버튼 */
  document.getElementById('attachBtn')?.addEventListener('click', () => triggerFileAttach(quill));

  /* ── 아지트 드롭다운 + 타입 맵 ── */
  const catSelect = form.category;
  const cats      = await fetchCategoriesCached();
  const azitMap   = Object.fromEntries(cats.map(c => [c.name, c]));
  const preselect = new URLSearchParams(location.search).get('cat') || '';

  if (cats.length === 0) {
    catSelect.innerHTML = '<option value="" disabled selected>아지트가 없습니다</option>';
    catSelect.disabled = true;
    document.getElementById('catHint')?.classList.remove('hidden');
  } else {
    cats.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.name;
      opt.textContent = c.name;
      if (c.name === preselect) opt.selected = true;
      catSelect.appendChild(opt);
    });
  }

  /* ── 아지트 타입에 따라 폼 전환 ── */
  const quillSection = document.getElementById('quillSection');
  const gameSection  = document.getElementById('gameSection');
  const videoSection = document.getElementById('videoSection');
  const codeSection  = document.getElementById('codeSection');

  function applyFormType() {
    const type    = azitMap[catSelect.value]?.type;
    const isGame  = type === '웹게임';
    const isVideo = type === '영상';
    const isCode  = type === '코드';
    quillSection?.classList.toggle('hidden', isGame || isVideo || isCode);
    gameSection?.classList.toggle('hidden',  !isGame);
    videoSection?.classList.toggle('hidden', !isVideo);
    codeSection?.classList.toggle('hidden',  !isCode);
  }

  catSelect.addEventListener('change', applyFormType);
  applyFormType();

  /* ── 게임 폴더 선택 ── */
  const gameFolderInput = document.getElementById('gameFolderInput');
  const gameFolderBtn   = document.getElementById('gameFolderBtn');
  const gameFolderInfo  = document.getElementById('gameFolderInfo');
  gameFolderBtn?.addEventListener('click', () => gameFolderInput?.click());
  gameFolderInput?.addEventListener('change', () => {
    const files = gameFolderInput.files;
    if (files.length > 0) {
      const folderName = files[0].webkitRelativePath.split('/')[0];
      gameFolderInfo.textContent = `${folderName} (${files.length}개 파일)`;
    } else {
      gameFolderInfo.textContent = '선택된 폴더 없음';
    }
  });

  /* ── 영상 파일 선택 ── */
  const videoFileInput = document.getElementById('videoFileInput');
  const videoFileBtn   = document.getElementById('videoFileBtn');
  const videoFileInfo  = document.getElementById('videoFileInfo');
  const MAX_VIDEO_BYTES = 200 * 1024 * 1024; // 200MB
  videoFileBtn?.addEventListener('click', () => videoFileInput?.click());
  videoFileInput?.addEventListener('change', () => {
    const file = videoFileInput.files[0];
    if (!file) { videoFileInfo.textContent = '선택된 파일 없음'; return; }
    if (file.size > MAX_VIDEO_BYTES) {
      showToast('영상 파일은 200MB 이하여야 해요.', 'red');
      videoFileInput.value = '';
      videoFileInfo.textContent = '선택된 파일 없음';
      return;
    }
    videoFileInfo.textContent = `${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB)`;
  });

  /* ── 멀티파일 코드 에디터 ── */

  // 멀티파일 상태
  let _codeFiles    = [];
  let _activeFileId = null;
  const _codeTA     = document.getElementById('codeContent');
  const _codeLangSel = document.getElementById('codeLang');

  function _saveActiveCode() {
    const file = _codeFiles.find(f => f.id === _activeFileId);
    if (file && _codeTA) file.code = _codeTA.value;
  }

  function _loadActiveCode() {
    const file = _codeFiles.find(f => f.id === _activeFileId);
    if (!_codeTA || !file) return;
    _codeTA.value       = file.code;
    _codeTA.placeholder = _CODE_HINTS[file.lang] || '코드를 입력하세요...';
    _codeTA.focus();
  }

  function _renderCodeFileTabs() {
    const tabsEl = document.getElementById('codeFileTabs');
    if (!tabsEl) return;
    tabsEl.innerHTML = '';
    _codeFiles.forEach(file => {
      const tab = document.createElement('button');
      tab.type = 'button';
      tab.className = 'code-file-tab' + (file.id === _activeFileId ? ' active' : '');
      const nameSpan = document.createElement('span');
      nameSpan.className = 'code-file-tab-name';
      nameSpan.textContent = file.name;
      tab.appendChild(nameSpan);
      if (_codeFiles.length > 1) {
        const close = document.createElement('span');
        close.className = 'code-file-tab-close';
        close.textContent = '×';
        close.addEventListener('click', e => {
          e.stopPropagation();
          _saveActiveCode();
          _codeFiles = _codeFiles.filter(f => f.id !== file.id);
          if (_activeFileId === file.id) _activeFileId = _codeFiles[0]?.id || null;
          _renderCodeFileTabs();
          _loadActiveCode();
        });
        tab.appendChild(close);
      }
      tab.addEventListener('click', () => {
        _saveActiveCode();
        _activeFileId = file.id;
        _renderCodeFileTabs();
        _loadActiveCode();
      });
      tabsEl.appendChild(tab);
    });
  }

  function _initCodeFiles(lang) {
    const firstName = _LANG_DEFAULT_FILE[lang] || 'main.txt';
    _codeFiles    = [{ id: Date.now(), name: firstName, lang, code: '' }];
    _activeFileId = _codeFiles[0].id;
    _renderCodeFileTabs();
    _loadActiveCode();
  }

  _codeLangSel?.addEventListener('change', () => {
    _saveActiveCode();
    // 첫 번째 파일의 언어와 이름을 변경 (코드 보존)
    const first = _codeFiles[0];
    if (first) {
      first.lang = _codeLangSel.value;
      first.name = _LANG_DEFAULT_FILE[_codeLangSel.value] || first.name;
      if (_activeFileId === first.id) _loadActiveCode();
      _renderCodeFileTabs();
    }
  });

  document.getElementById('addCodeFileBtn')?.addEventListener('click', () => {
    const name = prompt('추가할 파일 이름을 입력하세요\n예) utils.py, helper.h, module.js, style.css');
    if (!name?.trim()) return;
    _saveActiveCode();
    const lang   = detectLangFromFilename(name.trim()) || _codeLangSel?.value || 'Python';
    const newFile = { id: Date.now(), name: name.trim(), lang, code: '' };
    _codeFiles.push(newFile);
    _activeFileId = newFile.id;
    _renderCodeFileTabs();
    _loadActiveCode();
  });

  _codeTA?.addEventListener('keydown', function(e) {
    if (e.key !== 'Tab') return;
    e.preventDefault();
    const s = this.selectionStart, end = this.selectionEnd;
    this.value = this.value.substring(0, s) + '  ' + this.value.substring(end);
    this.selectionStart = this.selectionEnd = s + 2;
  });

  // 초기 파일 생성
  _initCodeFiles(_codeLangSel?.value || 'Python');

  /* ── 초안 자동 저장 / 복원 ── */
  const _DRAFT_KEY = 'post_draft_' + (new URLSearchParams(location.search).get('cat') || 'default');
  const _draftNotice = document.createElement('p');
  _draftNotice.className = 'hint draft-notice hidden';
  form.querySelector('.post-write-actions')?.before(_draftNotice);

  function _saveDraft() {
    const title = form.title?.value || '';
    const quillContent = quill?.root.innerHTML || '';
    if (!title && !quillContent.replace(/<[^>]+>/g, '').trim()) return;
    localStorage.setItem(_DRAFT_KEY, JSON.stringify({ title, content: quillContent, ts: Date.now() }));
  }

  function _loadDraft() {
    try {
      const raw  = localStorage.getItem(_DRAFT_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (Date.now() - data.ts > 7 * 86400000) { localStorage.removeItem(_DRAFT_KEY); return; }
      if (data.title) { const ti = document.getElementById('title'); if (ti) ti.value = data.title; }
      if (data.content && quill) quill.clipboard.dangerouslyPasteHTML(data.content);
      _draftNotice.innerHTML = `초안이 있어요 <button type="button" class="draft-clear-btn">지우기</button>`;
      _draftNotice.classList.remove('hidden');
      _draftNotice.querySelector('.draft-clear-btn')?.addEventListener('click', () => {
        localStorage.removeItem(_DRAFT_KEY);
        _draftNotice.classList.add('hidden');
      });
    } catch { localStorage.removeItem(_DRAFT_KEY); }
  }

  _loadDraft();
  const _draftTimer = setInterval(_saveDraft, 8000);

  /* ── 제출 ── */
  const submitBtn = form.querySelector('[type=submit]');
  submitBtn.dataset.label = submitBtn.textContent;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title    = form.title.value.trim();
    const category = form.category.value;
    const type     = azitMap[category]?.type;
    const isGame   = type === '웹게임';
    const isVideo  = type === '영상';
    const isCode   = type === '코드';

    if (!title) { showToast('제목을 입력해 주세요.', 'red'); return; }
    if (!isGame && !isVideo && !isCode && !quill.getText().trim()) {
      showToast('내용을 입력해 주세요.', 'red'); return;
    }

    const u = session.user;
    setLoading(submitBtn, true);

    try {
      let content;
      const extra = {};

      if (isCode) {
        _saveActiveCode();
        const hasCode = _codeFiles.some(f => f.code.trim());
        if (!hasCode) { showToast('코드를 입력해 주세요.', 'red'); setLoading(submitBtn, false); return; }
        content             = null;
        extra.code_lang     = _codeFiles[0]?.lang || 'Python';
        extra.code_files    = _codeFiles.map(f => ({ name: f.name, lang: f.lang, code: f.code }));

      } else if (isVideo) {
        content = nullIfEmpty(document.getElementById('videoDesc')?.value);
        const thumb = document.getElementById('videoThumbnailUrl')?.value.trim();
        if (thumb) extra.thumbnail_url = thumb;

        const file = videoFileInput?.files[0];
        if (!file) { showToast('영상 파일을 선택해 주세요.', 'red'); setLoading(submitBtn, false); return; }

        submitBtn.textContent = '영상을 업로드하는 중...';
        const ext      = file.name.split('.').pop().toLowerCase();
        const path     = `videos/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabaseClient.storage
          .from('post-media').upload(path, file, { contentType: file.type || 'video/mp4' });
        if (upErr) throw new Error(`영상 업로드 실패: ${upErr.message}`);
        extra.video_url = supabaseClient.storage.from('post-media').getPublicUrl(path).data.publicUrl;

      } else if (isGame) {
        content = nullIfEmpty(document.getElementById('gameDesc')?.value);
        const genre = document.getElementById('gameGenre')?.value;
        const thumb = document.getElementById('thumbnailUrl')?.value.trim();
        if (genre) extra.game_genre    = genre;
        if (thumb) extra.thumbnail_url = thumb;

        // ── 폴더 업로드 ──
        const files = gameFolderInput?.files;
        if (files && files.length > 0) {
          const gameUUID = crypto.randomUUID();
          const basePath = `games/${gameUUID}`;
          const total    = files.length;
          let   indexUrl = null;

          for (let i = 0; i < total; i++) {
            const file         = files[i];
            const relativePath = file.webkitRelativePath.split('/').slice(1).join('/');
            const uploadPath   = `${basePath}/${relativePath}`;

            submitBtn.textContent = `게임을 서버에 올리는 중... (${i + 1}/${total})`;

            const contentType = getGameFileContentType(file);
            const { error: upErr } = await supabaseClient.storage
              .from('post-media')
              .upload(uploadPath, file, { contentType });

            if (upErr) throw new Error(`'${file.name}' 업로드 실패: ${upErr.message}`);

            if (relativePath === 'index.html' && !indexUrl) {
              indexUrl = supabaseClient.storage
                .from('post-media').getPublicUrl(uploadPath).data.publicUrl;
            }
          }

          if (!indexUrl) {
            for (const file of files) {
              const rel = file.webkitRelativePath.split('/').slice(1).join('/');
              if (rel.endsWith('.html')) {
                indexUrl = supabaseClient.storage
                  .from('post-media').getPublicUrl(`${basePath}/${rel}`).data.publicUrl;
                break;
              }
            }
          }

          if (indexUrl) extra.game_url = indexUrl;
        }
      } else {
        content = cleanQuillHTML(quill.root.innerHTML);
      }

      await insertPost({
        title, content: content ?? null, category,
        author_id:       u.id,
        author_nickname: u.user_metadata?.nickname || u.email,
        views: 0,
        ...extra,
      });
      clearInterval(_draftTimer);
      localStorage.removeItem(_DRAFT_KEY);
      const successMsg = isVideo ? '영상이 등록됐어요! 🎬' : isGame ? '게임이 등록됐어요! 🎮' : isCode ? '코드가 등록됐어요! 💻' : '게시물이 등록됐어요! 🎉';
      showToast(successMsg, 'green');
      setTimeout(() => { window.location.href = 'index.html'; }, 1000);
    } catch (err) {
      console.error('insertPost 오류:', err);
      showToast(err.message || '등록 실패', 'red');
    } finally {
      setLoading(submitBtn, false);
    }
  });
}

/* ── 코드 에디터 공통 상수 ── */
const _CODE_HINTS = {
  HTML:       '<h1>Hello!</h1>\n<p>HTML을 작성하세요.</p>',
  JavaScript: 'console.log("Hello, World!");\n// JavaScript를 작성하세요.',
  CSS:        'body {\n  background: #f0f0f0;\n}\n/* CSS를 작성하세요. */',
  '혼합':     '<!DOCTYPE html>\n<html>\n<body>\n  <h1>Hello!</h1>\n</body>\n</html>',
  Python:     'print("Hello, World!")\n# Python을 작성하세요.',
  C:          '#include <stdio.h>\n\nint main() {\n    printf("Hello, World!\\n");\n    return 0;\n}',
  'C++':      '#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Hello, World!" << endl;\n    return 0;\n}',
};

/* ── 멀티파일 코드 에디터 유틸리티 ── */
const _LANG_DEFAULT_FILE = {
  HTML: 'index.html', JavaScript: 'main.js', CSS: 'style.css',
  '혼합': 'index.html', Python: 'main.py', C: 'main.c', 'C++': 'main.cpp',
};

function detectLangFromFilename(name) {
  const ext = (name.split('.').pop() || '').toLowerCase();
  return { py:'Python', c:'C', cpp:'C++', cc:'C++', h:'C', hpp:'C++',
           js:'JavaScript', mjs:'JavaScript', html:'HTML', htm:'HTML', css:'CSS' }[ext] || null;
}

// 브라우저 실행용 멀티파일 → 단일 srcdoc 빌드
function buildMultiFileSrcdoc(files) {
  const ext     = n => (n.split('.').pop() || '').toLowerCase();
  const htmlF   = files.filter(f => ['html','htm'].includes(ext(f.name)));
  const cssF    = files.filter(f => ext(f.name) === 'css');
  const jsF     = files.filter(f => ['js','mjs'].includes(ext(f.name)));

  if (htmlF.length > 0) {
    let html      = htmlF[0].code;
    const cssBlk  = cssF.map(f  => `<style>\n${f.code}\n</style>`).join('\n');
    const jsBlk   = jsF.map(f   => `<script>\n${f.code}\n<\/script>`).join('\n');
    html = /<\/head>/i.test(html) ? html.replace(/<\/head>/i, `${cssBlk}\n</head>`) : cssBlk + html;
    html = /<\/body>/i.test(html) ? html.replace(/<\/body>/i, `${jsBlk}\n</body>`) : html + jsBlk;
    return _injectCodeResize(html);
  }
  if (jsF.length > 0 && cssF.length === 0) {
    const combined = files.map(f => `/* === ${f.name} === */\n${f.code}`).join('\n\n');
    return buildCodeSrcdoc(combined, 'JavaScript'); // already injects resize
  }
  if (cssF.length > 0 && jsF.length === 0) {
    return buildCodeSrcdoc(cssF.map(f => f.code).join('\n'), 'CSS'); // already injects resize
  }
  // 혼합
  const cssBlk = cssF.map(f => `<style>\n${f.code}\n</style>`).join('\n');
  const jsBlk  = jsF.map(f  => `<script>\n${f.code}\n<\/script>`).join('\n');
  return _injectCodeResize(
    `<!DOCTYPE html><html><head><meta charset="UTF-8">${cssBlk}</head><body>${jsBlk}</body></html>`
  );
}

/* ── Judge0 CE 서버 실행 (Python / C / C++) ── */
const _JUDGE0_URL  = 'https://ce.judge0.com/submissions?base64_encoded=true&wait=true';
const _JUDGE0_IDS  = { Python: 71, C: 50, 'C++': 54 };
const _SERVER_LANGS = new Set(['Python', 'C', 'C++']);

async function runWithJudge0(code, lang) {
  const langId = _JUDGE0_IDS[lang];
  if (!langId) throw new Error(`지원하지 않는 언어: ${lang}`);

  // UTF-8 안전 base64 인코딩
  const bytes = new TextEncoder().encode(code);
  let bin = ''; bytes.forEach(b => (bin += String.fromCharCode(b)));
  const b64 = btoa(bin);

  const res = await fetch(_JUDGE0_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source_code: b64, language_id: langId }),
  });
  if (!res.ok) throw new Error(`Judge0 오류 (HTTP ${res.status})`);
  const d = await res.json();

  const dec = b64str => {
    if (!b64str) return '';
    const bin2 = atob(b64str);
    const bytes2 = new Uint8Array(bin2.length);
    for (let i = 0; i < bin2.length; i++) bytes2[i] = bin2.charCodeAt(i);
    return new TextDecoder().decode(bytes2);
  };

  return {
    statusId:  d.status?.id,
    statusMsg: d.status?.description || '알 수 없음',
    stdout:    dec(d.stdout),
    stderr:    dec(d.compile_output) || dec(d.stderr),
  };
}

// 멀티파일을 ZIP base64로 묶는 유틸리티 (브라우저 환경)
function _buildZipBase64(entries) {
  // entries: [{name: string, data: Uint8Array}]
  const enc = new TextEncoder();

  function crc32(data) {
    let crc = 0xFFFFFFFF;
    for (const b of data) {
      crc ^= b;
      for (let i = 0; i < 8; i++) crc = (crc & 1) ? ((crc >>> 1) ^ 0xEDB88320) : (crc >>> 1);
    }
    return (~crc) >>> 0;
  }
  function w16(n) { const a = new Uint8Array(2); new DataView(a.buffer).setUint16(0, n, true); return a; }
  function w32(n) { const a = new Uint8Array(4); new DataView(a.buffer).setUint32(0, n, true); return a; }
  function cat(...parts) {
    const total = parts.reduce((s, p) => s + p.length, 0);
    const out = new Uint8Array(total); let off = 0;
    for (const p of parts) { out.set(p, off); off += p.length; }
    return out;
  }

  const localParts = [], centralParts = [];
  let offset = 0;

  for (const { name, data } of entries) {
    const nb  = enc.encode(name);
    const crc = crc32(data);
    const local = cat(
      new Uint8Array([0x50,0x4B,0x03,0x04]),
      w16(20), w16(0), w16(0), w16(0), w16(0),
      w32(crc), w32(data.length), w32(data.length),
      w16(nb.length), w16(0), nb
    );
    centralParts.push(cat(
      new Uint8Array([0x50,0x4B,0x01,0x02]),
      w16(20), w16(20), w16(0), w16(0), w16(0), w16(0),
      w32(crc), w32(data.length), w32(data.length),
      w16(nb.length), w16(0), w16(0), w16(0), w16(0), w32(0), w32(offset),
      nb
    ));
    localParts.push(cat(local, data));
    offset += local.length + data.length;
  }

  const cd    = cat(...centralParts);
  const eocd  = cat(
    new Uint8Array([0x50,0x4B,0x05,0x06]), w16(0), w16(0),
    w16(entries.length), w16(entries.length),
    w32(cd.length), w32(offset), w16(0)
  );
  const zip = cat(...localParts, cd, eocd);
  let bin = ''; zip.forEach(b => (bin += String.fromCharCode(b)));
  return btoa(bin);
}

// 멀티파일 Judge0 실행 — main 파일 + 나머지를 ZIP additional_files로 전송
async function runMultiFilesWithJudge0(files, mainLang) {
  const langId = _JUDGE0_IDS[mainLang];
  if (!langId) throw new Error(`지원하지 않는 언어: ${mainLang}`);

  const enc = new TextEncoder();
  function encB64(str) {
    const b = enc.encode(str); let bin = '';
    b.forEach(c => (bin += String.fromCharCode(c)));
    return btoa(bin);
  }

  // 메인 파일 결정: 이름이 main.* 인 것 우선, 없으면 첫 번째
  const mainExt = { Python: 'py', C: 'c', 'C++': 'cpp' }[mainLang] || 'py';
  const mainFile = files.find(f => f.name === `main.${mainExt}`) || files[0];
  const otherFiles = files.filter(f => f !== mainFile);

  const body = { language_id: langId, source_code: encB64(mainFile.code) };

  if (otherFiles.length > 0) {
    body.additional_files = _buildZipBase64(
      otherFiles.map(f => ({ name: f.name, data: enc.encode(f.code) }))
    );
  }

  const res = await fetch(_JUDGE0_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Judge0 오류 (HTTP ${res.status})`);
  const d = await res.json();

  const dec = b64 => {
    if (!b64) return '';
    const b = atob(b64); const arr = new Uint8Array(b.length);
    for (let i = 0; i < b.length; i++) arr[i] = b.charCodeAt(i);
    return new TextDecoder().decode(arr);
  };
  return { statusId: d.status?.id, statusMsg: d.status?.description || '알 수 없음', stdout: dec(d.stdout), stderr: dec(d.compile_output) || dec(d.stderr) };
}

/* ── 코드 실행 srcdoc 빌더 ── */
function _injectCodeResize(html) {
  return /<\/body>/i.test(html)
    ? html.replace(/<\/body>/i, _CODE_RESIZE_SCRIPT + '</body>')
    : html + _CODE_RESIZE_SCRIPT;
}

function buildCodeSrcdoc(code, lang) {
  if (lang === 'JavaScript') {
    return _injectCodeResize(`<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>body{font-family:sans-serif;font-size:14px;padding:16px;margin:0}
pre{background:#f4f4f4;padding:10px;border-radius:4px;overflow-x:auto;white-space:pre-wrap}</style>
</head><body><div id="output"></div><script>
const _ol=console.log.bind(console),_oe=console.error.bind(console),_ow=console.warn.bind(console);
function _out(txt,col){const p=document.createElement('pre');p.textContent=txt;if(col)p.style.color=col;document.getElementById('output').appendChild(p);}
console.log=(...a)=>{_ol(...a);_out(a.map(x=>typeof x==='object'?JSON.stringify(x,null,2):String(x)).join(' '));};
console.error=(...a)=>{_oe(...a);_out(a.map(String).join(' '),'#e05252');};
console.warn=(...a)=>{_ow(...a);_out(a.map(String).join(' '),'#e08a00');};
try{${code}}catch(e){_out('오류: '+e.message,'#e05252');}
<\/script></body></html>`);
  }
  if (lang === 'CSS') {
    return _injectCodeResize(`<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>body{font-family:sans-serif;padding:20px;margin:0}
${code}
</style></head><body>
<h1>제목 (h1)</h1><h2>부제목 (h2)</h2>
<p>단락 텍스트 <a href="#">링크</a> · <strong>굵게</strong> · <em>기울임</em></p>
<button>버튼</button>
<input type="text" placeholder="입력 필드">
<ul><li>목록 1</li><li>목록 2</li></ul>
<div class="box">div.box</div>
<div class="card">div.card</div>
</body></html>`);
  }
  // HTML / 혼합: 완전한 HTML이면 그대로, 아니면 body에 삽입
  const isFullDoc = /^\s*<!DOCTYPE/i.test(code) || /^\s*<html/i.test(code);
  const base = isFullDoc ? code
    : `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>${code}</body></html>`;
  return _injectCodeResize(base);
}

/*
 * 게임 보안 모델 (3중 방어):
 * 1. srcdoc  — src= 직접 로드 대신 HTML 소스를 srcdoc에 주입
 *              → iframe이 null origin에서 실행 (localStorage·쿠키 접근 불가)
 * 2. CSP 주입 — connect-src 'none' 메타태그를 게임 HTML에 삽입
 *              → 게임 JS가 외부 서버로 데이터를 전송할 수 없음
 * 3. sandbox  — allow-same-origin 제외 → 어떤 도메인의 저장소도 접근 불가
 *              — allow-top-navigation 제외 → 상위 페이지 리다이렉트 불가
 *              — allow-popups 제외 → 새 창·탭 열기 불가
 */
/*
 * 게임 보안 모델:
 *
 * [Supabase Storage 업로드 게임]
 *   fetch → HTML 소스 획득 → <base href="게임폴더URL"> 주입 → srcdoc 렌더링
 *   - srcdoc은 브라우저가 반드시 HTML로 해석 (텍스트 표시 문제 없음)
 *   - <base> 태그로 .js/.wasm/.pck 상대경로가 Storage URL로 해석됨
 *   - Storage는 public 버킷이므로 CORS(Allow-Origin: *) 허용 → null origin 로드 가능
 *   - allow-same-origin 불필요 → 더 안전한 null origin 격리 유지
 *
 * [외부 URL]
 *   fetch 성공 시 → srcdoc + connect-src 'none' CSP 주입 (외부 통신 차단)
 *   fetch 실패(CORS) 시 → src= 직접 (sandbox는 그대로 적용)
 */
// 게임 canvas 크기를 부모에게 알리는 스크립트
const _GAME_RESIZE_SCRIPT = `<script>(function(){
  var _sent=0;
  function _gs(){
    var c=document.querySelector('canvas');
    var w=c?c.width:document.documentElement.scrollWidth;
    var h=c?c.height:document.documentElement.scrollHeight;
    if(w>80&&h>80&&(w!==_sent)){_sent=w;parent.postMessage({type:'gameResize',w:w,h:h},'*');}
  }
  window.addEventListener('load',function(){
    _gs();
    var mo=new MutationObserver(_gs);
    mo.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['width','height','style']});
    [500,1500,3000,6000].forEach(function(t){setTimeout(_gs,t);});
  });
})();<\/script>`;

// 코드·멀티파일 iframe 콘텐츠 높이를 부모에게 알리는 스크립트
const _CODE_RESIZE_SCRIPT = `<script>(function(){
  function _report(){
    var h=Math.max(
      document.documentElement?document.documentElement.scrollHeight:0,
      document.documentElement?document.documentElement.offsetHeight:0,
      document.body?document.body.scrollHeight:0,
      document.body?document.body.offsetHeight:0
    );
    if(h>40) parent.postMessage({type:'iframeResize',h:h},'*');
  }
  window.addEventListener('load',function(){
    _report();
    if(window.ResizeObserver) new ResizeObserver(_report).observe(document.documentElement);
    [200,600,1200,2500].forEach(function(t){setTimeout(_report,t);});
  });
  window.addEventListener('resize',_report);
})();<\/script>`;

function _injectResizeScript(html) {
  return /<\/body>/i.test(html)
    ? html.replace(/<\/body>/i, _GAME_RESIZE_SCRIPT + '</body>')
    : html + _GAME_RESIZE_SCRIPT;
}

async function loadGameSecurely(gameFrame, rawInput) {
  if (!rawInput) return;

  // iframe 코드에서 src URL 추출
  let url = rawInput.trim();
  if (/^<iframe/i.test(url)) {
    const m = url.match(/src=['"]([^'"]+)['"]/i);
    url = m ? m[1] : '';
  }
  if (!url) {
    gameFrame.srcdoc = `<p style="font-family:sans-serif;color:#e05252;padding:24px;text-align:center">올바른 URL이 아닙니다.</p>`;
    return;
  }

  // Supabase Storage 업로드 게임
  if (url.includes('supabase.co/storage')) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('fetch_failed');
      const html = await res.text();

      // 게임 폴더 경로를 base 태그로 주입 → 상대경로 리소스 로딩 가능
      const baseUrl = url.substring(0, url.lastIndexOf('/') + 1);
      const withBase = /<head/i.test(html)
        ? html.replace(/<head([^>]*)>/i, `<head$1><base href="${baseUrl}">`)
        : `<base href="${baseUrl}">${html}`;

      gameFrame.srcdoc = _injectResizeScript(withBase);
    } catch {
      // fetch 실패 시 allow-same-origin 폴백
      gameFrame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-pointer-lock');
      gameFrame.src = url;
    }
    return;
  }

  // 외부 URL: srcdoc + CSP 주입, CORS 실패 시 src= 폴백
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) throw new Error();
    const html = await res.text();
    const csp = `<meta http-equiv="Content-Security-Policy" ` +
      `content="default-src 'self' 'unsafe-inline' 'unsafe-eval' blob: data:; connect-src 'none';">`;
    const secured = /<head/i.test(html)
      ? html.replace(/<head([^>]*)>/i, `<head$1>${csp}`)
      : csp + html;
    gameFrame.srcdoc = _injectResizeScript(secured);
  } catch {
    gameFrame.src = url;
  }
}

/* HTML5 게임 파일 MIME 타입 매핑 — 브라우저가 파일을 정확히 해석하도록 강제 지정 */
function getGameFileContentType(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  const map = {
    'wasm': 'application/wasm',          // 필수: 없으면 브라우저가 실행 거부
    'js':   'text/javascript',
    'mjs':  'text/javascript',
    'html': 'text/html',
    'css':  'text/css',
    'json': 'application/json',
    'pck':  'application/octet-stream',  // Godot 패키지
    'data': 'application/octet-stream',  // Unity WebGL 등
    'png':  'image/png',
    'jpg':  'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif':  'image/gif',
    'webp': 'image/webp',
    'svg':  'image/svg+xml',
    'ico':  'image/x-icon',
    'ogg':  'audio/ogg',
    'mp3':  'audio/mpeg',
    'wav':  'audio/wav',
    'mp4':  'video/mp4',
    'webm': 'video/webm',
  };
  return map[ext] || file.type || 'application/octet-stream';
}

/* ── 이미지 / GIF 업로드 ── */
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_IMAGE_BYTES     = 10 * 1024 * 1024; // 10 MB
const MAX_ATTACH_BYTES    = 50 * 1024 * 1024; // 50 MB

async function triggerMediaUpload(quill, accept) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = accept;
  input.click();
  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      showToast('JPEG, PNG, GIF, WebP 파일만 업로드할 수 있어요.', 'red');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      showToast('이미지는 10MB 이하여야 해요.', 'red');
      return;
    }
    showToast('업로드 중...', 'green');
    const ext  = file.name.split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
    const path = `images/${Date.now()}.${ext}`;
    const { error } = await supabaseClient.storage
      .from('post-media').upload(path, file, { contentType: file.type });
    if (error) { showToast('업로드 실패: ' + error.message, 'red'); return; }
    const url = supabaseClient.storage.from('post-media').getPublicUrl(path).data.publicUrl;
    const range = quill.getSelection() || { index: quill.getLength() };
    quill.insertEmbed(range.index, 'image', url, 'user');
    quill.setSelection(range.index + 1);
    showToast('추가됐어요!', 'green');
  };
}

/* ── 첨부파일 업로드 ── */
async function triggerFileAttach(quill) {
  const input = document.createElement('input');
  input.type = 'file';
  input.click();
  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;
    if (file.size > MAX_ATTACH_BYTES) {
      showToast('첨부파일은 50MB 이하여야 해요.', 'red');
      return;
    }
    showToast('첨부파일 업로드 중...', 'green');
    const path = `attachments/${Date.now()}-${encodeURIComponent(file.name)}`;
    const { error } = await supabaseClient.storage
      .from('post-media').upload(path, file, { contentType: file.type });
    if (error) { showToast('업로드 실패: ' + error.message, 'red'); return; }
    const url = supabaseClient.storage.from('post-media').getPublicUrl(path).data.publicUrl;
    const idx = quill.getLength();
    quill.insertText(idx, '\n📎 ' + file.name, 'link', url, 'user');
    quill.setSelection(idx + file.name.length + 3);
    showToast('첨부됐어요!', 'green');
  };
}

/* ════════════════════════════════════════
   공유 버튼
════════════════════════════════════════ */
function initShareBtn(post) {
  document.getElementById('shareBtn')?.addEventListener('click', async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      showToast('링크가 복사됐어요!', 'green');
    } catch {
      prompt('이 링크를 복사하세요:', url);
    }
  });
}

/* ════════════════════════════════════════
   북마크
════════════════════════════════════════ */
async function isBookmarked(postId, userId) {
  const { data } = await supabaseClient
    .from('bookmarks').select('id').eq('post_id', postId).eq('user_id', userId).maybeSingle();
  return !!data;
}

async function toggleBookmark(postId, userId) {
  const already = await isBookmarked(postId, userId);
  if (already) {
    await supabaseClient.from('bookmarks').delete().eq('post_id', postId).eq('user_id', userId);
    return false;
  }
  await supabaseClient.from('bookmarks').insert({ post_id: postId, user_id: userId });
  return true;
}

async function initBookmarkBtn(postId, session) {
  const btn   = document.getElementById('bookmarkBtn');
  const label = document.getElementById('bookmarkLabel');
  if (!btn) return;

  if (!session) { btn.addEventListener('click', () => showToast('로그인 후 이용할 수 있어요.', 'red')); return; }

  const refresh = async () => {
    const saved = await isBookmarked(postId, session.user.id);
    btn.classList.toggle('active-up', saved);
    if (label) label.textContent = saved ? '저장됨' : '저장';
  };
  await refresh();

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    const saved = await toggleBookmark(postId, session.user.id).catch(() => null);
    if (saved !== null) {
      btn.classList.toggle('active-up', saved);
      if (label) label.textContent = saved ? '저장됨' : '저장';
      showToast(saved ? '북마크에 저장됐어요.' : '북마크에서 제거됐어요.', 'green');
    }
    btn.disabled = false;
  });
}

/* ════════════════════════════════════════
   핀 게시물
════════════════════════════════════════ */
async function initPinBtn(post, session) {
  const btn = document.getElementById('pinBtn');
  if (!btn || !session) return;

  const isOwner = session.user.id === post.author_id;
  const admin   = await isAdmin();
  if (!isOwner && !admin) return;

  btn.classList.remove('hidden');
  btn.textContent = post.pinned ? '📌 핀 해제' : '📌 핀';

  btn.addEventListener('click', async () => {
    try {
      await supabaseClient.from('posts').update({ pinned: !post.pinned }).eq('id', post.id);
      post.pinned = !post.pinned;
      btn.textContent = post.pinned ? '📌 핀 해제' : '📌 핀';
      showToast(post.pinned ? '핀 게시물로 설정됐어요.' : '핀이 해제됐어요.', 'green');
      invalidatePostsCache();
    } catch { showToast('오류 발생', 'red'); }
  });
}

/* ════════════════════════════════════════
   추천/비추천 (Votes)
════════════════════════════════════════ */
async function getVoteCounts(postId) {
  const { data } = await supabaseClient
    .from('votes').select('vote_type').eq('post_id', postId);
  const up   = (data || []).filter(v => v.vote_type === 'up').length;
  const down = (data || []).filter(v => v.vote_type === 'down').length;
  return { up, down };
}

async function getMyVote(postId, userId) {
  const { data } = await supabaseClient
    .from('votes').select('vote_type')
    .eq('post_id', postId).eq('user_id', userId).maybeSingle();
  return data?.vote_type || null;
}

async function castVote(postId, voteType, userId) {
  const { data: existing } = await supabaseClient
    .from('votes').select('id, vote_type')
    .eq('post_id', postId).eq('user_id', userId).maybeSingle();

  if (existing) {
    if (existing.vote_type === voteType) {
      await supabaseClient.from('votes').delete().eq('id', existing.id);
      return null;
    }
    await supabaseClient.from('votes').update({ vote_type: voteType }).eq('id', existing.id);
    return voteType;
  }
  await supabaseClient.from('votes').insert({ post_id: postId, user_id: userId, vote_type: voteType });
  return voteType;
}

async function initVotes(postId, session) {
  const upBtn   = document.getElementById('voteUpBtn');
  const downBtn = document.getElementById('voteDownBtn');
  const upCount = document.getElementById('voteUpCount');
  const dnCount = document.getElementById('voteDownCount');
  if (!upBtn) return;

  const refresh = async () => {
    const [{ up, down }, mine] = await Promise.all([
      getVoteCounts(postId),
      session ? getMyVote(postId, session.user.id) : Promise.resolve(null),
    ]);
    upCount.textContent = up;
    dnCount.textContent = down;
    if (session) {
      upBtn.classList.toggle('active-up', mine === 'up');
      downBtn.classList.toggle('active-down', mine === 'down');
      upBtn.disabled = false;
      downBtn.disabled = false;
    }
  };

  await refresh();
  if (!session) return;

  const onVote = (type) => async () => {
    upBtn.disabled = true; downBtn.disabled = true;
    await castVote(postId, type, session.user.id).catch(() => {});
    await refresh();
  };
  upBtn.addEventListener('click', onVote('up'));
  downBtn.addEventListener('click', onVote('down'));
}

/* ════════════════════════════════════════
   신고 모달
════════════════════════════════════════ */
function initReportModal(postId) {
  const reportBtn  = document.getElementById('postReportBtn');
  const modal      = document.getElementById('reportModal');
  const confirmBtn = document.getElementById('reportConfirmBtn');
  const cancelBtn  = document.getElementById('reportCancelBtn');
  if (!reportBtn || !modal) return;

  reportBtn.classList.remove('hidden');

  const close = () => modal.classList.add('hidden');

  reportBtn.addEventListener('click', async () => {
    const already = await hasReported(postId);
    if (already) { showToast('이미 신고한 게시물이에요.', 'red'); return; }
    modal.classList.remove('hidden');
  });

  cancelBtn?.addEventListener('click', close);
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

  confirmBtn?.addEventListener('click', async () => {
    const reasonEl = document.querySelector('input[name="reportReason"]:checked');
    const reason   = reasonEl?.value || '기타';
    close();
    try {
      const result = await reportPost(postId, reason);
      if (!result.success && result.reason === 'already_reported') {
        showToast('이미 신고한 게시물이에요.', 'red');
      } else if (result.hidden) {
        showToast('신고가 누적되어 게시물이 숨겨졌습니다.', 'green');
        setTimeout(() => { window.location.href = 'index.html'; }, 1500);
      } else {
        showToast(`"${reason}" 사유로 신고가 접수됐어요.`, 'green');
        reportBtn.textContent = '신고됨';
        reportBtn.disabled = true;
        reportBtn.classList.add('reported');
      }
    } catch { showToast('신고에 실패했어요.', 'red'); }
  });
}

/* ════════════════════════════════════════
   댓글 (Comments)
════════════════════════════════════════ */
async function getComments(postId) {
  const { data, error } = await supabaseClient
    .from('comments').select('*')
    .eq('post_id', postId).order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

async function insertComment({ post_id, author_id, author_nickname, content, parent_id = null }) {
  const row = { post_id, author_id, author_nickname, content };
  if (parent_id) row.parent_id = parent_id;
  const { error } = await supabaseClient.from('comments').insert(row);
  if (error) throw error;
}

async function deleteComment(id) {
  const { error } = await supabaseClient.from('comments').delete().eq('id', id);
  if (error) throw error;
}

async function renderComments(postId, session) {
  const list    = document.getElementById('commentList');
  const countEl = document.getElementById('commentCount');
  if (!list) return;

  const comments = await getComments(postId).catch(() => []);
  if (countEl) countEl.textContent = comments.length;

  if (comments.length === 0) {
    list.innerHTML = '<p class="comment-empty">첫 번째 댓글을 남겨보세요!</p>';
    return;
  }

  // 트리 구조: 부모 댓글 → 자식 댓글
  const roots    = comments.filter(c => !c.parent_id);
  const children = {};
  comments.filter(c => c.parent_id).forEach(c => {
    (children[c.parent_id] ??= []).push(c);
  });

  function renderCmt(c, isReply = false) {
    const replies = (children[c.id] || []).map(r => renderCmt(r, true)).join('');
    return `
    <div class="comment-item${isReply ? ' comment-reply' : ''}" id="cmt-${c.id}">
      <div class="comment-meta">
        <a class="comment-author" href="profile.html?id=${c.author_id}">${escapeHTML(c.author_nickname)}</a>
        <span class="comment-date">${formatDate(c.created_at)}</span>
        ${session ? `<button class="comment-reply-btn" data-id="${c.id}" data-nick="${escapeHTML(c.author_nickname)}">답글</button>` : ''}
        ${session?.user?.id === c.author_id
          ? `<button class="comment-del-btn" data-id="${c.id}">×</button>` : ''}
      </div>
      <p class="comment-content">${escapeHTML(c.content).replace(/\n/g, '<br>')}</p>
      ${replies ? `<div class="comment-replies">${replies}</div>` : ''}
    </div>`;
  }

  list.innerHTML = roots.map(c => renderCmt(c)).join('');

  // 삭제 버튼
  list.querySelectorAll('.comment-del-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      try { await deleteComment(btn.dataset.id); await renderComments(postId, session); }
      catch { showToast('댓글 삭제 실패', 'red'); }
    });
  });

  // 답글 버튼
  list.querySelectorAll('.comment-reply-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const replyArea = document.getElementById('commentInput');
      const form      = document.getElementById('commentForm');
      if (!replyArea || !form) return;
      form.dataset.parentId   = btn.dataset.id;
      form.dataset.parentNick = btn.dataset.nick;
      replyArea.placeholder = `@${btn.dataset.nick}님에게 답글 작성...`;
      replyArea.focus();
      // 취소 버튼 표시
      let cancelBtn = form.querySelector('.reply-cancel');
      if (!cancelBtn) {
        cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'reply-cancel btn-secondary';
        cancelBtn.textContent = '답글 취소';
        cancelBtn.style.cssText = 'font-size:12px;padding:4px 10px';
        form.querySelector('.comment-form-actions')?.prepend(cancelBtn);
      }
      cancelBtn.onclick = () => {
        delete form.dataset.parentId;
        replyArea.placeholder = '댓글을 입력하세요';
        cancelBtn.remove();
      };
      btn.closest('.comment-item')?.querySelector('.comment-replies')?.scrollIntoView({ behavior: 'smooth' });
    });
  });
}

async function initComments(postId, session) {
  await renderComments(postId, session);

  const form      = document.getElementById('commentForm');
  const loginMsg  = document.getElementById('commentLoginMsg');
  const input     = document.getElementById('commentInput');
  const charCount = document.getElementById('commentCharCount');

  if (!session) { loginMsg?.classList.remove('hidden'); return; }

  form?.classList.remove('hidden');
  input?.addEventListener('input', () => {
    if (charCount) charCount.textContent = `${input.value.length}/500`;
  });

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const content = input.value.trim();
    if (!content) return;
    const submitBtn = form.querySelector('[type=submit]');
    submitBtn.disabled = true;
    try {
      const parentId = form.dataset.parentId || null;
      await insertComment({
        post_id: postId,
        author_id: session.user.id,
        author_nickname: session.user.user_metadata?.nickname || session.user.email,
        content,
        parent_id: parentId,
      });
      input.value = '';
      input.placeholder = '댓글을 입력하세요';
      if (charCount) charCount.textContent = '0/500';
      delete form.dataset.parentId;
      form.querySelector('.reply-cancel')?.remove();
      await renderComments(postId, session);
    } catch { showToast('댓글 등록에 실패했어요.', 'red'); }
    finally  { submitBtn.disabled = false; }
  });
}

/* ════════════════════════════════════════
   Page: Post Detail
════════════════════════════════════════ */
async function initPostDetail() {
  const session = await getSession();
  updateNav(session);

  document.getElementById('navLogout')?.addEventListener('click', async e => {
    e.preventDefault(); await authSignOut(); location.reload();
  });

  const id   = new URLSearchParams(location.search).get('id');
  const wrap = document.getElementById('postContent');
  if (!id) { wrap.innerHTML = '<p class="news-empty">게시물을 찾을 수 없어요.</p>'; return; }

  const [, post] = await Promise.all([incrementViews(id), getPost(id)]);
  if (!post) { wrap.innerHTML = '<p class="news-empty">게시물을 찾을 수 없어요.</p>'; return; }

  updatePostMeta(post);
  document.getElementById('postCategory').textContent = post.category;
  document.getElementById('postTitle').textContent    = post.title;
  const authorEl = document.getElementById('postAuthor');
  if (authorEl) {
    authorEl.textContent = post.author_nickname;
    authorEl.href = `profile.html?id=${post.author_id}`;
  }
  document.getElementById('postDate').textContent     = formatDate(post.created_at);
  document.getElementById('postViews').textContent    = post.views || 0;
  const bodyEl = document.getElementById('postBody');

  // 웹게임 타입: 장르 배지 표시 (썸네일은 카드에서만, 상세에서는 제외)
  if (post.game_genre) {
    const meta = document.createElement('div');
    meta.className = 'game-detail-meta';
    const badge = document.createElement('span');
    badge.className = 'game-tag';
    badge.textContent = post.game_genre;
    meta.appendChild(badge);
    bodyEl.before(meta);
  }

  // 웹게임·영상 타입: 설명을 제목 바로 밑에 2줄 클램프 + 펼쳐보기로 표시
  if (post.code_lang) {
    bodyEl.style.display = 'none';
    const codeRunSection = document.getElementById('codeRunSection');
    const codeDisplay    = document.getElementById('codeDisplay');
    const codeLangBadge  = document.getElementById('codeLangBadge');
    if (!codeRunSection || !codeDisplay) { /* no-op */ }
    else {
      // ── 멀티파일 or 단일파일 결정 ──
      const files = post.code_files && post.code_files.length > 0
        ? post.code_files
        : [{ name: _LANG_DEFAULT_FILE[post.code_lang] || 'main', lang: post.code_lang, code: post.content || '' }];

      // 배지 표시
      if (codeLangBadge) {
        codeLangBadge.textContent = files.length > 1 ? `${post.code_lang} +${files.length - 1}` : post.code_lang;
      }
      codeRunSection.classList.remove('hidden');

      // ── 파일 탭 렌더링 ──
      let _detailActiveIdx = 0;
      const detailTabsEl = document.getElementById('codeDetailTabs');
      if (files.length > 1 && detailTabsEl) {
        detailTabsEl.classList.remove('hidden');
        function _renderDetailTabs() {
          detailTabsEl.innerHTML = files.map((f, i) =>
            `<button type="button" class="code-detail-tab${i === _detailActiveIdx ? ' active' : ''}" data-i="${i}">${escapeHTML(f.name)}</button>`
          ).join('');
          detailTabsEl.querySelectorAll('.code-detail-tab').forEach(btn => {
            btn.addEventListener('click', () => {
              _detailActiveIdx = parseInt(btn.dataset.i);
              codeDisplay.textContent = files[_detailActiveIdx]?.code || '';
              _renderDetailTabs();
            });
          });
        }
        _renderDetailTabs();
      }
      codeDisplay.textContent = files[_detailActiveIdx]?.code || '';

      // ── 실행 버튼 ──
      const isBrowser = files.every(f => !_SERVER_LANGS.has(f.lang));
      const mainLang  = files.find(f => _SERVER_LANGS.has(f.lang))?.lang || post.code_lang;

      const runBtn = document.getElementById('codeRunBtn');
      runBtn?.addEventListener('click', async () => {
        if (!isBrowser) {
          // 서버 실행 (Python / C / C++)
          const serverWrap = document.getElementById('codeServerOutputWrap');
          const stdoutEl   = document.getElementById('codeServerStdout');
          const stderrEl   = document.getElementById('codeServerStderr');
          const statusEl   = document.getElementById('codeServerStatus');
          if (!serverWrap || !stdoutEl) return;

          const origLabel = runBtn.textContent;
          runBtn.disabled = true;
          runBtn.textContent = '실행 중...';
          stderrEl.classList.add('hidden');
          statusEl.classList.add('hidden');
          serverWrap.classList.remove('hidden');
          stdoutEl.textContent = '잠시 기다려 주세요...';

          try {
            const r = files.length > 1
              ? await runMultiFilesWithJudge0(files, mainLang)
              : await runWithJudge0(files[0].code, mainLang);
            stdoutEl.textContent = r.stdout || '(출력 없음)';
            if (r.stderr) { stderrEl.textContent = r.stderr; stderrEl.classList.remove('hidden'); }
            if (r.statusId !== 3) { statusEl.textContent = `종료 상태: ${r.statusMsg}`; statusEl.classList.remove('hidden'); }
          } catch (err) {
            stdoutEl.textContent = '';
            stderrEl.textContent = '실행 실패: ' + (err.message || '네트워크 오류');
            stderrEl.classList.remove('hidden');
          } finally {
            runBtn.disabled = false;
            runBtn.textContent = origLabel;
            serverWrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        } else {
          // 브라우저 실행
          const outputWrap  = document.getElementById('codeOutputWrap');
          const outputFrame = document.getElementById('codeOutputFrame');
          if (!outputWrap || !outputFrame) return;
          outputWrap.classList.remove('hidden');

          // 실행 전 iframe 높이 초기화
          outputFrame.style.height = '';

          outputFrame.srcdoc = files.length > 1
            ? buildMultiFileSrcdoc(files)
            : buildCodeSrcdoc(files[0].code, files[0].lang);

          // 콘텐츠 높이 자동 조정 (iframeResize postMessage)
          const _onCodeResize = e => {
            if (!e.data || e.data.type !== 'iframeResize') return;
            const h = e.data.h;
            if (h < 40 || h > 6000) return;
            const maxH = Math.round(window.innerHeight * 0.82);
            outputFrame.style.height = Math.min(h + 24, maxH) + 'px';
          };
          window.addEventListener('message', _onCodeResize);

          outputFrame.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      });

      document.getElementById('codeRunFullscreenBtn')?.addEventListener('click', () => {
        const frame = document.getElementById('codeOutputFrame');
        frame?.requestFullscreen?.() || frame?.webkitRequestFullscreen?.();
      });
    }
  } else if (post.game_url || post.video_url) {
    bodyEl.style.display = 'none';
    if (post.content) {
      const descWrap = document.createElement('div');
      descWrap.className = 'game-card-desc-wrap';
      descWrap.style.marginBottom = '16px';

      const descEl = document.createElement('p');
      descEl.className = 'game-card-desc';
      descEl.textContent = post.content;
      descWrap.appendChild(descEl);

      const expandBtn = document.createElement('button');
      expandBtn.className = 'expand-btn';
      expandBtn.type = 'button';
      expandBtn.dataset.expanded = 'false';
      expandBtn.textContent = '펼쳐보기';
      descWrap.appendChild(expandBtn);

      bodyEl.before(descWrap);

      setTimeout(() => {
        if (descEl.scrollHeight <= descEl.clientHeight + 2) {
          expandBtn.style.display = 'none';
        } else {
          expandBtn.addEventListener('click', () => {
            const expanded = expandBtn.dataset.expanded === 'true';
            descEl.classList.toggle('expanded', !expanded);
            expandBtn.dataset.expanded = String(!expanded);
            expandBtn.textContent = !expanded ? '접기' : '펼쳐보기';
          });
        }
      }, 0);
    }
  } else if (typeof DOMPurify !== 'undefined') {
    bodyEl.innerHTML = DOMPurify.sanitize(post.content || '');
  } else {
    bodyEl.textContent = stripHtml(post.content || '');
  }

  // 영상 플레이어
  if (post.video_url) {
    const videoSection = document.getElementById('videoPlaySection');
    const videoPlayer  = document.getElementById('videoPlayer');
    if (videoSection && videoPlayer) {
      videoPlayer.src = post.video_url;
      if (post.thumbnail_url) videoPlayer.poster = post.thumbnail_url;
      videoSection.classList.remove('hidden');
    }
  }

  // 게임 플레이 영역 + iframe 자동 크기 조정
  if (post.game_url) {
    const playSection = document.getElementById('gamePlaySection');
    const gameFrame   = document.getElementById('gameFrame');
    if (playSection && gameFrame) {
      playSection.classList.remove('hidden');
      loadGameSecurely(gameFrame, post.game_url);
      document.getElementById('gameFullscreenBtn')?.addEventListener('click', () => {
        gameFrame.requestFullscreen?.() || gameFrame.webkitRequestFullscreen?.();
      });

      let _lastGameW = 0, _lastGameH = 0;

      function _applyGameSize(w, h) {
        const wrapEl = gameFrame.closest('.game-play-wrap') || gameFrame.parentElement;
        const maxW   = wrapEl.clientWidth || 800;
        const scale  = Math.min(1, maxW / w);
        const dispH  = Math.round(h * scale);
        const finalH = Math.min(dispH, Math.round(window.innerHeight * 0.85));
        // 명시적 높이 지정 시 aspect-ratio CSS가 자동으로 무시됨
        gameFrame.style.height = finalH + 'px';
      }

      window.addEventListener('message', function onGameResize(e) {
        if (!e.data || e.data.type !== 'gameResize') return;
        const { w, h } = e.data;
        if (!w || !h || w < 80 || h < 80 || w > 8000 || h > 8000) return;
        _lastGameW = w; _lastGameH = h;
        _applyGameSize(w, h);
      });

      window.addEventListener('resize', function onWindowResize() {
        if (_lastGameW && _lastGameH) _applyGameSize(_lastGameW, _lastGameH);
      });
    }
  }

  // 삭제 버튼 (본인만)
  if (session && session.user.id === post.author_id) {
    const delBtn = document.getElementById('postDelBtn');
    delBtn?.classList.remove('hidden');
    delBtn?.addEventListener('click', async () => {
      if (!confirm('정말 삭제하시겠어요?')) return;
      try { await deletePost(id); window.location.href = 'index.html'; }
      catch { showToast('삭제에 실패했어요.', 'red'); }
    });
  }

  // 추천/비추천 + 공유·북마크·핀 병렬 초기화
  await Promise.all([
    initVotes(id, session),
    initBookmarkBtn(id, session),
    initPinBtn(post, session),
  ]);
  initShareBtn(post);

  // 코드 신택스 하이라이팅
  if (post.code_lang) {
    setTimeout(() => {
      const el = document.getElementById('codeDisplay');
      if (!el || !window.Prism) return;
      const langMap = { Python: 'python', C: 'c', 'C++': 'cpp', JavaScript: 'javascript', HTML: 'html', CSS: 'css' };
      const lang = langMap[post.code_lang] || 'none';
      el.className = `language-${lang}`;
      el.closest('pre')?.classList.add(`language-${lang}`);
      Prism.highlightElement(el);
    }, 400);
  }

  // 신고 모달 (로그인 & 타인 게시물)
  if (session && session.user.id !== post.author_id) {
    initReportModal(id);
  }

  // 댓글
  await initComments(id, session);
}

/* ════════════════════════════════════════
   Page: Index
════════════════════════════════════════ */
async function initIndex() {
  const session = await getSession();
  updateNav(session);

  // 각 섹션 병렬 로드 — 독립적이므로 동시에 실행
  await Promise.all([
    initCategorySection().catch(err => console.error('카테고리 로드 실패:', err)),
    renderPosts().catch(err => console.error('인기 게시물 로드 실패:', err)),
    renderPostsList().catch(err => console.error('게시물 목록 로드 실패:', err)),
    isAdmin().catch(() => false)
      .then(admin => initNotices(admin).catch(err => console.error('공지 로드 실패:', err))),
  ]);

  // 검색 입력
  let _searchTimer;
  document.getElementById('postsSearch')?.addEventListener('input', e => {
    clearTimeout(_searchTimer);
    _searchTimer = setTimeout(() => {
      _listSearch = e.target.value.trim();
      renderPostsList(true);
    }, 350);
  });

  initHeaderSearch();

  const writeBtn = document.getElementById('writeBtn');
  if (session) writeBtn?.classList.remove('hidden');

  document.getElementById('navLogout')?.addEventListener('click', async e => {
    e.preventDefault(); await authSignOut(); location.reload();
  });

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    updateNav(session);
  });
}

/* ════════════════════════════════════════
   Page: Forgot (아이디·비밀번호 찾기)
════════════════════════════════════════ */
async function findEmailByNickname(nickname) {
  const { data, error } = await supabaseClient.rpc('find_email_by_nickname', {
    target_nickname: nickname,
  });
  if (error) throw error;
  return data; // 마스킹된 이메일 or null
}

async function sendPasswordReset(email) {
  const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + '/reset-password.html',
  });
  if (error) throw error;
}

async function updatePassword(newPassword) {
  const { error } = await supabaseClient.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

function initForgot() {
  // 탭 전환
  document.querySelectorAll('.forgot-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.forgot-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.forgot-section').forEach(s => s.classList.add('hidden'));
      tab.classList.add('active');
      document.getElementById(tab.dataset.target)?.classList.remove('hidden');
    });
  });

  // 아이디 찾기
  const idForm = document.getElementById('findIdForm');
  idForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors();
    const nickname = idForm.nickname.value.trim();
    if (!nickname) return;

    const submitBtn = idForm.querySelector('[type=submit]');
    setLoading(submitBtn, true);
    try {
      const masked = await findEmailByNickname(nickname);
      if (!masked) {
        showError('err-nickname', '해당 닉네임으로 가입된 계정을 찾을 수 없어요.');
      } else {
        document.getElementById('foundEmail').textContent = masked;
        document.getElementById('idResult').classList.remove('hidden');
      }
    } catch {
      showError('err-nickname', '조회 중 오류가 발생했어요. Supabase 함수 설정을 확인해 주세요.');
    } finally {
      setLoading(submitBtn, false);
    }
  });

  // 비밀번호 찾기
  const pwForm = document.getElementById('findPwForm');
  pwForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors();
    const email = pwForm.email.value.trim();
    if (!email) return;

    const submitBtn = pwForm.querySelector('[type=submit]');
    setLoading(submitBtn, true);
    try {
      await sendPasswordReset(email);
      document.getElementById('pwSent').classList.remove('hidden');
      pwForm.classList.add('hidden');
    } catch (err) {
      showError('err-reset-email', toKoreanError(err));
    } finally {
      setLoading(submitBtn, false);
    }
  });
}

/* ════════════════════════════════════════
   Page: Reset Password (비밀번호 재설정 콜백)
════════════════════════════════════════ */
function initResetPassword() {
  const waiting = document.getElementById('resetWaiting');
  const form    = document.getElementById('resetPasswordForm');
  const invalid = document.getElementById('resetInvalid');

  // Supabase가 URL 해시에서 토큰을 자동 처리 → PASSWORD_RECOVERY 이벤트 발생
  supabaseClient.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') {
      waiting?.classList.add('hidden');
      form?.classList.remove('hidden');
    } else if (event === 'SIGNED_OUT' || event === 'INITIAL_SESSION') {
      // 유효한 복구 세션이 없으면 만료 화면 표시
      getSession().then(session => {
        if (!session) {
          waiting?.classList.add('hidden');
          invalid?.classList.remove('hidden');
        }
      });
    }
  });

  const submitBtn = form?.querySelector('[type=submit]');
  if (submitBtn) submitBtn.dataset.label = submitBtn.textContent;

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors();

    const pw      = form.password.value;
    const pwCheck = form.passwordCheck.value;

    if (pw.length < 8) {
      showError('err-pw', '비밀번호는 8자 이상이어야 해요.');
      return;
    }
    if (pw !== pwCheck) {
      showError('err-pwcheck', '비밀번호가 일치하지 않아요.');
      return;
    }

    setLoading(submitBtn, true);
    try {
      await updatePassword(pw);
      showToast('비밀번호가 변경됐어요! 다시 로그인해 주세요.', 'green');
      setTimeout(() => { window.location.href = 'login.html'; }, 2000);
    } catch (err) {
      showError('err-reset', toKoreanError(err));
    } finally {
      setLoading(submitBtn, false);
    }
  });
}

/* ════════════════════════════════════════
   Page: Signup
════════════════════════════════════════ */
async function initSignup() {
  const session = await getSession();
  if (session) { window.location.href = 'dashboard.html'; return; }

  const form = document.getElementById('signupForm');
  if (!form) return;

  const submitBtn = form.querySelector('[type=submit]');
  submitBtn.dataset.label = submitBtn.textContent;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors();

    const email    = form.email.value.trim();
    const pw       = form.password.value;
    const pwCheck  = form.passwordCheck.value;
    const nickname = form.nickname.value.trim();

    let ok = true;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showError('err-email', '올바른 이메일 형식으로 입력해 주세요.');
      ok = false;
    }
    if (pw.length < 8) {
      showError('err-pw', '비밀번호는 8자 이상이어야 해요.');
      ok = false;
    }
    if (pw !== pwCheck) {
      showError('err-pwcheck', '비밀번호가 일치하지 않아요.');
      ok = false;
    }
    if (nickname.length < 2 || nickname.length > 10) {
      showError('err-nickname', '닉네임은 2~10자로 입력해 주세요.');
      ok = false;
    }
    if (!ok) return;

    setLoading(submitBtn, true);
    try {
      await authSignUp(email, pw, nickname);
      showToast('가입 완료! 이메일을 확인해 주세요 📬', 'green');
      setTimeout(() => { window.location.href = 'login.html'; }, 2200);
    } catch (err) {
      showError('err-global', toKoreanError(err));
    } finally {
      setLoading(submitBtn, false);
    }
  });
}

/* ════════════════════════════════════════
   Page: Login
════════════════════════════════════════ */
async function initLogin() {
  const session = await getSession();
  if (session) { window.location.href = 'dashboard.html'; return; }

  const form = document.getElementById('loginForm');
  if (!form) return;

  const submitBtn = form.querySelector('[type=submit]');
  submitBtn.dataset.label = submitBtn.textContent;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors();

    const email = form.email.value.trim();
    const pw    = form.password.value;

    if (!email || !pw) {
      showError('err-login', '이메일과 비밀번호를 모두 입력해 주세요.');
      return;
    }

    setLoading(submitBtn, true);
    try {
      const { user } = await authSignIn(email, pw);
      const nickname = user.user_metadata?.nickname || user.email;
      showToast(`반가워요, ${nickname}님! 🌟`, 'green');
      setTimeout(() => { window.location.href = 'dashboard.html'; }, 1200);
    } catch (err) {
      showError('err-login', toKoreanError(err));
    } finally {
      setLoading(submitBtn, false);
    }
  });
}

/* ════════════════════════════════════════
   Page: Post Manage (게시물 관리 목록)
════════════════════════════════════════ */
async function initPostManage() {
  const session = await requireAuth();
  if (!session) return;
  updateNav(session);

  const wrap = document.getElementById('myPostsList');
  if (!wrap) return;

  const { data: posts, error } = await supabaseClient
    .from('posts')
    .select('id, title, category, views, created_at, hidden')
    .eq('author_id', session.user.id)
    .order('created_at', { ascending: false });

  if (error || !posts || posts.length === 0) {
    wrap.innerHTML = '<p class="news-empty">작성한 게시물이 없습니다.</p>';
    return;
  }

  wrap.innerHTML = posts.map(p => `
    <div class="post-manage-card">
      <div class="post-manage-info">
        <span class="post-row-cat">${escapeHTML(p.category)}</span>
        <span class="post-manage-title">${escapeHTML(p.title)}</span>
        ${p.hidden ? `<span class="admin-badge-hidden">숨김</span>` : ''}
      </div>
      <div class="post-manage-meta">${formatDate(p.created_at)} &nbsp;·&nbsp; 조회 ${p.views || 0}</div>
      <div class="post-manage-actions">
        <a href="post-detail.html?id=${p.id}" class="btn-secondary" style="font-size:12px;padding:6px 14px">보기</a>
        <a href="post-edit.html?id=${p.id}"   class="btn btn-primary" style="font-size:12px;padding:6px 14px">수정</a>
      </div>
    </div>
  `).join('');
}

/* ════════════════════════════════════════
   Page: Post Edit (게시물 수정)
════════════════════════════════════════ */
async function initPostEdit() {
  const session = await requireAuth();
  if (!session) return;
  updateNav(session);

  const id = new URLSearchParams(location.search).get('id');
  if (!id) { location.href = 'post-manage.html'; return; }

  const post = await getPost(id);
  if (!post || post.author_id !== session.user.id) {
    showToast('수정 권한이 없어요.', 'red');
    setTimeout(() => { location.href = 'post-manage.html'; }, 1000);
    return;
  }

  const azit    = await getAzitByName(post.category);
  const isGame  = azit?.type === '웹게임';
  const isVideo = azit?.type === '영상';
  const isCode  = azit?.type === '코드';

  document.getElementById('editCategory').textContent = post.category;
  document.getElementById('editTitle').value = post.title;
  document.getElementById('editCancelBtn').href = `post-detail.html?id=${id}`;

  if (isCode) {
    document.getElementById('editQuillSection').classList.add('hidden');
    document.getElementById('editCodeSection').classList.remove('hidden');

    // 멀티파일 상태
    let _editFiles    = [];
    let _editActiveId = null;
    const _editTA     = document.getElementById('editCodeContent');
    const _editLangSel = document.getElementById('editCodeLang');

    // 기존 파일 로드
    const existingFiles = post.code_files && post.code_files.length > 0
      ? post.code_files
      : [{ id: Date.now(), name: _LANG_DEFAULT_FILE[post.code_lang] || 'main', lang: post.code_lang || 'Python', code: post.content || '' }];
    _editFiles    = existingFiles.map(f => ({ ...f, id: f.id || Date.now() + Math.random() }));
    _editActiveId = _editFiles[0]?.id;
    if (_editLangSel) _editLangSel.value = _editFiles[0]?.lang || 'Python';

    function _editSave() { const f = _editFiles.find(x => x.id === _editActiveId); if (f && _editTA) f.code = _editTA.value; }
    function _editLoad() {
      const f = _editFiles.find(x => x.id === _editActiveId);
      if (_editTA && f) { _editTA.value = f.code; _editTA.placeholder = _CODE_HINTS[f.lang] || '코드를 입력하세요...'; }
    }
    function _editRenderTabs() {
      const tabsEl = document.getElementById('editCodeFileTabs');
      if (!tabsEl) return;
      tabsEl.innerHTML = '';
      _editFiles.forEach(file => {
        const tab = document.createElement('button');
        tab.type = 'button';
        tab.className = 'code-file-tab' + (file.id === _editActiveId ? ' active' : '');
        const ns = document.createElement('span'); ns.className = 'code-file-tab-name'; ns.textContent = file.name;
        tab.appendChild(ns);
        if (_editFiles.length > 1) {
          const cls = document.createElement('span'); cls.className = 'code-file-tab-close'; cls.textContent = '×';
          cls.addEventListener('click', e => {
            e.stopPropagation(); _editSave();
            _editFiles = _editFiles.filter(f => f.id !== file.id);
            if (_editActiveId === file.id) _editActiveId = _editFiles[0]?.id;
            _editRenderTabs(); _editLoad();
          });
          tab.appendChild(cls);
        }
        tab.addEventListener('click', () => { _editSave(); _editActiveId = file.id; _editRenderTabs(); _editLoad(); });
        tabsEl.appendChild(tab);
      });
    }

    document.getElementById('editAddCodeFileBtn')?.addEventListener('click', () => {
      const name = prompt('추가할 파일 이름을 입력하세요\n예) utils.py, helper.h, module.js');
      if (!name?.trim()) return;
      _editSave();
      const newFile = { id: Date.now(), name: name.trim(), lang: detectLangFromFilename(name.trim()) || _editLangSel?.value || 'Python', code: '' };
      _editFiles.push(newFile); _editActiveId = newFile.id;
      _editRenderTabs(); _editLoad();
    });

    _editTA?.addEventListener('keydown', function(e) {
      if (e.key !== 'Tab') return;
      e.preventDefault();
      const s = this.selectionStart, end = this.selectionEnd;
      this.value = this.value.substring(0, s) + '  ' + this.value.substring(end);
      this.selectionStart = this.selectionEnd = s + 2;
    });

    _editRenderTabs(); _editLoad();

    const form = document.getElementById('postEditForm');
    const submitBtn = form.querySelector('[type=submit]');
    submitBtn.dataset.label = submitBtn.textContent;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      _editSave();
      const title = document.getElementById('editTitle').value.trim();
      if (!title) { showToast('제목을 입력해 주세요.', 'red'); return; }
      setLoading(submitBtn, true);
      try {
        await updatePost(id, {
          title,
          content:    null,
          code_lang:  _editFiles[0]?.lang || 'Python',
          code_files: _editFiles.map(f => ({ name: f.name, lang: f.lang, code: f.code })),
        });
        showToast('수정됐어요!', 'green');
        setTimeout(() => { location.href = `post-detail.html?id=${id}`; }, 800);
      } catch (err) {
        showToast('수정 실패: ' + (err.message || ''), 'red');
      } finally {
        setLoading(submitBtn, false);
      }
    });
    return;
  }

  if (isVideo) {
    document.getElementById('editQuillSection').classList.add('hidden');
    document.getElementById('editVideoSection').classList.remove('hidden');
    document.getElementById('editVideoDesc').value          = post.content       || '';
    document.getElementById('editVideoUrl').value           = post.video_url     || '';
    document.getElementById('editVideoThumbnailUrl').value  = post.thumbnail_url || '';

    const form = document.getElementById('postEditForm');
    const submitBtn = form.querySelector('[type=submit]');
    submitBtn.dataset.label = submitBtn.textContent;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('editTitle').value.trim();
      if (!title) { showToast('제목을 입력해 주세요.', 'red'); return; }
      setLoading(submitBtn, true);
      try {
        await updatePost(id, {
          title,
          content:       nullIfEmpty(document.getElementById('editVideoDesc').value),
          video_url:     nullIfEmpty(document.getElementById('editVideoUrl').value),
          thumbnail_url: nullIfEmpty(document.getElementById('editVideoThumbnailUrl').value),
        });
        showToast('수정됐어요!', 'green');
        setTimeout(() => { location.href = `post-detail.html?id=${id}`; }, 800);
      } catch (err) {
        showToast('수정 실패: ' + (err.message || ''), 'red');
      } finally {
        setLoading(submitBtn, false);
      }
    });
    return;
  }

  if (isGame) {
    document.getElementById('editQuillSection').classList.add('hidden');
    document.getElementById('editGameSection').classList.remove('hidden');
    document.getElementById('editGameDesc').value     = post.content      || '';
    document.getElementById('editGameGenre').value    = post.game_genre   || '';
    document.getElementById('editThumbnailUrl').value = post.thumbnail_url || '';
    document.getElementById('editGameUrl').value      = post.game_url     || '';
  } else {
    const Font = Quill.import('formats/font');
    Font.whitelist = ['serif', 'monospace'];
    Quill.register(Font, true);
    const Size = Quill.import('attributors/style/size');
    Size.whitelist = ['12px', '14px', '18px', '24px', '32px'];
    Quill.register(Size, true);

    const quill = new Quill('#editQuillEditor', {
      theme: 'snow',
      modules: { toolbar: { container: '#editQuillToolbar' } },
    });
    quill.clipboard.dangerouslyPasteHTML(post.content || '');

    // 수정 페이지 초안 자동 저장
    const _EDIT_DRAFT_KEY = `edit_draft_${id}`;
    function _saveEditDraft() {
      const t = document.getElementById('editTitle')?.value || '';
      const c = quill.root.innerHTML || '';
      if (t || c.replace(/<[^>]+>/g, '').trim()) {
        localStorage.setItem(_EDIT_DRAFT_KEY, JSON.stringify({ title: t, content: c, ts: Date.now() }));
      }
    }
    const _editDraftTimer = setInterval(_saveEditDraft, 8000);

    const form = document.getElementById('postEditForm');
    const submitBtn = form.querySelector('[type=submit]');
    submitBtn.dataset.label = submitBtn.textContent;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('editTitle').value.trim();
      if (!title) { showToast('제목을 입력해 주세요.', 'red'); return; }
      setLoading(submitBtn, true);
      try {
        clearInterval(_editDraftTimer);
        localStorage.removeItem(_EDIT_DRAFT_KEY);
        await updatePost(id, { title, content: cleanQuillHTML(quill.root.innerHTML) });
        showToast('수정됐어요!', 'green');
        setTimeout(() => { location.href = `post-detail.html?id=${id}`; }, 800);
      } catch (err) {
        showToast('수정 실패: ' + (err.message || ''), 'red');
      } finally {
        setLoading(submitBtn, false);
      }
    });
    return;
  }

  const form = document.getElementById('postEditForm');
  const submitBtn = form.querySelector('[type=submit]');
  submitBtn.dataset.label = submitBtn.textContent;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('editTitle').value.trim();
    if (!title) { showToast('제목을 입력해 주세요.', 'red'); return; }
    setLoading(submitBtn, true);
    try {
      const data = {
        title,
        content:       nullIfEmpty(document.getElementById('editGameDesc').value),
        game_genre:    nullIfEmpty(document.getElementById('editGameGenre').value),
        thumbnail_url: nullIfEmpty(document.getElementById('editThumbnailUrl').value),
        game_url:      nullIfEmpty(document.getElementById('editGameUrl').value),
      };
      await updatePost(id, data);
      showToast('수정됐어요!', 'green');
      setTimeout(() => { location.href = `post-detail.html?id=${id}`; }, 800);
    } catch (err) {
      showToast('수정 실패: ' + (err.message || ''), 'red');
    } finally {
      setLoading(submitBtn, false);
    }
  });
}

/* ════════════════════════════════════════
   Page: Profile
════════════════════════════════════════ */
async function getProfile(userId) {
  const { data } = await supabaseClient
    .from('profiles').select('*').eq('user_id', userId).maybeSingle();
  return data;
}

async function upsertProfile(userId, patch) {
  const { error } = await supabaseClient
    .from('profiles')
    .upsert(
      { user_id: userId, ...patch, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );
  if (error) throw error;
}


async function initProfile() {
  const session = await getSession();
  updateNav(session);
  loadMsgBadge(session);

  initNavLogout();

  const params   = new URLSearchParams(location.search);
  const targetId = params.get('id');
  const userId   = targetId || session?.user?.id;
  if (!userId) { window.location.href = 'login.html'; return; }

  const isMe = session?.user?.id === userId;

  // 병렬 로드
  const [profile, postsRes] = await Promise.all([
    getProfile(userId),
    supabaseClient.from('posts')
      .select('id,title,category,views,created_at,author_nickname,game_url,video_url,code_lang,pinned')
      .eq('author_id', userId).eq('hidden', false)
      .order('created_at', { ascending: false }),
  ]);

  const posts    = postsRes.data || [];
  const nickname = profile?.nickname || posts[0]?.author_nickname
    || (isMe ? (session.user.user_metadata?.nickname || session.user.email.split('@')[0]) : '알 수 없음');
  const bio      = profile?.bio || '';
  const avatarUrl = profile?.avatar_url || '';
  const bannerColor = profile?.banner_color || '#4aab8e';

  document.title = `${nickname}님의 프로필 — Open Azitfh`;

  // 배너
  const banner = document.getElementById('pfBanner');
  if (banner) banner.style.background = `linear-gradient(135deg, ${bannerColor} 0%, ${darkenHex(bannerColor, 50)} 100%)`;

  // 아바타
  const avatarEl = document.getElementById('pfAvatar');
  if (avatarEl) renderAvatar(avatarEl, nickname, avatarUrl, bannerColor);

  // 이름 / 소개 / 메타
  document.getElementById('pfName').textContent = nickname;
  const bioEl = document.getElementById('pfBio');
  if (bioEl) { bioEl.textContent = bio; bioEl.classList.toggle('hidden', !bio); }
  const metaEl = document.getElementById('pfMeta');
  if (metaEl) metaEl.textContent = isMe ? session.user.email : '멤버';

  // 버튼
  const actionsEl = document.getElementById('pfActions');
  if (actionsEl) {
    if (isMe) {
      actionsEl.innerHTML = `<button class="btn btn-outline btn-sm" id="editProfileBtn">✏️ 프로필 편집</button>`;
      document.getElementById('editProfileBtn')?.addEventListener('click', () => openProfileEdit(profile, nickname, bio, avatarUrl, bannerColor, session, posts));
    } else if (session) {
      actionsEl.innerHTML = `<a class="btn btn-primary btn-sm" href="messages.html?to=${userId}">✉️ 메시지 보내기</a>`;
    }
  }

  // 통계
  const totalViews = posts.reduce((s, p) => s + (p.views || 0), 0);
  document.getElementById('pfStats').innerHTML = `
    <div class="pf-stat"><span class="pf-stat-num">${posts.length}</span><span>게시물</span></div>
    <div class="pf-stat"><span class="pf-stat-num">${totalViews}</span><span>총 조회</span></div>
  `;

  // 탭 전환
  document.querySelectorAll('.pf-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.pf-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.pf-pane').forEach(p => p.classList.add('hidden'));
      tab.classList.add('active');
      document.getElementById(`pf-pane-${tab.dataset.tab}`)?.classList.remove('hidden');
    });
  });

  // 게시물 탭
  const list = document.getElementById('pfPostsList');
  if (list) {
    list.innerHTML = posts.length === 0
      ? '<p class="news-empty">작성한 게시물이 없습니다.</p>'
      : posts.map(p => renderPostRowHTML(p, { showAuthor: false })).join('');
  }

  // 정보 탭
  const aboutEl = document.getElementById('pfAbout');
  if (aboutEl) {
    const joinDate = isMe
      ? new Date(session.user.created_at).toLocaleDateString('ko-KR')
      : (profile?.created_at ? new Date(profile.created_at).toLocaleDateString('ko-KR') : '');
    aboutEl.innerHTML = `
      <div class="pf-about-list">
        ${bio ? `<div class="pf-about-row"><span>소개</span><span>${escapeHTML(bio)}</span></div>` : ''}
        ${joinDate ? `<div class="pf-about-row"><span>가입일</span><span>${joinDate}</span></div>` : ''}
        <div class="pf-about-row"><span>게시물</span><span>${posts.length}개</span></div>
        <div class="pf-about-row"><span>총 조회</span><span>${totalViews}회</span></div>
      </div>`;
  }
}

let _profileEditAbort = null;

function openProfileEdit(profile, nickname, bio, avatarUrl, bannerColor, session, posts) {
  const modal = document.getElementById('editProfileModal');
  if (!modal) return;
  modal.classList.remove('hidden');

  // 이전 열림에서 등록된 리스너 모두 제거 (AbortController 패턴)
  _profileEditAbort?.abort();
  _profileEditAbort = new AbortController();
  const { signal } = _profileEditAbort;

  document.getElementById('editNickname').value    = nickname;
  document.getElementById('editBio').value         = bio;
  document.getElementById('editBannerColor').value = bannerColor;
  document.getElementById('editBannerHex').textContent = bannerColor;

  const preview = document.getElementById('editAvatarPreview');
  if (preview) renderAvatar(preview, nickname, avatarUrl, bannerColor);

  let _avatarFile   = null;
  let _currentAvUrl = avatarUrl;
  let _removeAvatar = false;

  const colorInput = document.getElementById('editBannerColor');
  colorInput?.addEventListener('input', () => {
    document.getElementById('editBannerHex').textContent = colorInput.value;
  }, { signal });

  const avatarInput = document.getElementById('avatarFileInput');
  document.getElementById('avatarUploadBtn')?.addEventListener('click', () => avatarInput?.click(), { signal });
  avatarInput?.addEventListener('change', () => {
    const file = avatarInput.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { showToast('이미지는 2MB 이하여야 해요.', 'red'); return; }
    _avatarFile   = file;
    _removeAvatar = false;
    _currentAvUrl = URL.createObjectURL(file);
    document.getElementById('avatarFileInfo').textContent = file.name;
    if (preview) renderAvatar(preview, nickname, _currentAvUrl, colorInput.value);
  }, { signal });
  document.getElementById('avatarClearBtn')?.addEventListener('click', () => {
    _avatarFile   = null;
    _removeAvatar = true;
    _currentAvUrl = '';
    avatarInput.value = '';
    document.getElementById('avatarFileInfo').textContent = '(제거됨)';
    if (preview) renderAvatar(preview, document.getElementById('editNickname').value || nickname, '', colorInput.value);
  }, { signal });

  const closeModal = () => {
    modal.classList.add('hidden');
    _profileEditAbort?.abort();
    _profileEditAbort = null;
  };
  document.getElementById('closeEditModal')?.addEventListener('click', closeModal, { signal });
  document.getElementById('cancelEditProfile')?.addEventListener('click', closeModal, { signal });

  const form    = document.getElementById('editProfileForm');
  const saveBtn = form?.querySelector('[type=submit]');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newNick  = document.getElementById('editNickname').value.trim();
    const newBio   = document.getElementById('editBio').value.trim();
    const newColor = colorInput.value;
    if (!newNick) { showToast('닉네임을 입력해 주세요.', 'red'); return; }

    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '저장 중…'; }
    try {
      let finalAvatarUrl = _currentAvUrl.startsWith('blob:') ? avatarUrl : _currentAvUrl;
      if (_removeAvatar) finalAvatarUrl = '';

      // 아바타 업로드
      if (_avatarFile) {
        const ext  = _avatarFile.name.split('.').pop().toLowerCase();
        const path = `avatars/${session.user.id}.${ext}`;
        const { error: upErr } = await supabaseClient.storage
          .from('post-media').upload(path, _avatarFile, { contentType: _avatarFile.type, upsert: true });
        if (upErr) throw new Error('아바타 업로드 실패: ' + upErr.message);
        finalAvatarUrl = supabaseClient.storage.from('post-media').getPublicUrl(path).data.publicUrl;
      }

      await upsertProfile(session.user.id, {
        nickname:     newNick,
        bio:          newBio || null,
        avatar_url:   finalAvatarUrl || null,
        banner_color: newColor,
      });

      // 닉네임이 바뀌면 Supabase auth metadata도 업데이트
      if (newNick !== nickname) {
        await supabaseClient.auth.updateUser({ data: { nickname: newNick } });
      }

      showToast('프로필이 업데이트됐어요!', 'green');
      closeModal();

      // 페이지 내 UI 즉시 업데이트 (reload 대신)
      const banner = document.getElementById('pfBanner');
      if (banner) banner.style.background = `linear-gradient(135deg, ${newColor} 0%, ${darkenHex(newColor, 50)} 100%)`;
      const pfAvEl = document.getElementById('pfAvatar');
      if (pfAvEl) renderAvatar(pfAvEl, newNick, finalAvatarUrl, newColor);
      const pfNameEl = document.getElementById('pfName');
      if (pfNameEl) pfNameEl.textContent = newNick;
      const pfBioEl  = document.getElementById('pfBio');
      if (pfBioEl) { pfBioEl.textContent = newBio; pfBioEl.classList.toggle('hidden', !newBio); }
      document.title = `${newNick}님의 프로필 — Open Azitfh`;
    } catch (err) {
      showToast('저장 실패: ' + (err.message || ''), 'red');
    } finally {
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = saveBtn.dataset.label || '저장'; }
    }
  }, { signal });
}

/* ════════════════════════════════════════
   메시지 뱃지 (공통)
════════════════════════════════════════ */
async function loadMsgBadge(session) {
  if (!session) return;
  try {
    const { count } = await supabaseClient
      .from('messages').select('id', { count: 'exact', head: true })
      .eq('receiver_id', session.user.id).eq('read', false);
    const badge = document.getElementById('msgBadge');
    if (!badge) return;
    if (count > 0) {
      badge.textContent = count > 9 ? '9+' : String(count);
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  } catch { /* 무시 */ }
}

/* ════════════════════════════════════════
   Page: Messages
════════════════════════════════════════ */
async function initMessages() {
  const session = await requireAuth();
  if (!session) return;

  updateNav(session);
  loadMsgBadge(session);

  initNavLogout();

  const me = session.user.id;
  let _activePeer   = null;
  let _msgChannel   = null;  // Supabase Realtime 채널

  // URL 파라미터: ?to=userId 로 바로 대화 열기
  const toParam = new URLSearchParams(location.search).get('to');

  // ── 대화 목록 로드 ──────────────────────────────────────
  async function loadConversations() {
    const { data, error } = await supabaseClient.rpc('get_conversations', { p_user_id: me });
    const list = document.getElementById('msgConvList');
    if (!list) return;

    if (error || !data?.length) {
      list.innerHTML = '<p class="msg-empty">아직 대화가 없어요.<br>새 메시지를 보내보세요!</p>';
      return;
    }

    list.innerHTML = data.map(c => {
      const unread   = c.unread_count > 0;
      const initials = (c.peer_nickname || '?').slice(0, 1).toUpperCase();
      const isActive = _activePeer === c.peer_id;
      return `
      <div class="msg-conv-item${isActive ? ' active' : ''}${unread ? ' unread' : ''}"
           data-peer="${c.peer_id}" data-nick="${escapeHTML(c.peer_nickname || '')}">
        <div class="msg-conv-avatar" style="background:${escapeHTML(c.peer_color || '#4aab8e')}">${c.peer_avatar ? `<img src="${escapeHTML(c.peer_avatar)}" alt="">` : initials}</div>
        <div class="msg-conv-info">
          <div class="msg-conv-name">${escapeHTML(c.peer_nickname || '알 수 없음')}${unread ? `<span class="msg-unread-dot">${c.unread_count}</span>` : ''}</div>
          <div class="msg-conv-last">${escapeHTML((c.last_message || '').slice(0, 40))}</div>
        </div>
        <div class="msg-conv-time">${c.last_at ? formatDate(c.last_at).slice(0, 10).replace(/\.$/, '') : ''}</div>
      </div>`;
    }).join('');

    list.querySelectorAll('.msg-conv-item').forEach(item => {
      item.addEventListener('click', () => openThread(item.dataset.peer, item.dataset.nick));
    });
  }

  // ── Realtime 구독 (수신 메시지 즉시 반영) ───────────────
  function subscribeMessages() {
    if (_msgChannel) supabaseClient.removeChannel(_msgChannel);
    _msgChannel = supabaseClient
      .channel(`inbox-${me}`)
      .on('postgres_changes', {
        event:  'INSERT',
        schema: 'public',
        table:  'messages',
        filter: `receiver_id=eq.${me}`,
      }, (payload) => {
        loadMsgBadge(session);
        loadConversations();
        if (_activePeer && payload.new.sender_id === _activePeer) {
          renderMessages(_activePeer, true);
        }
      })
      .subscribe();
  }

  // ── 스레드 열기 ─────────────────────────────────────────
  async function openThread(peerId, peerNick) {
    _activePeer = peerId;

    // 헤더
    document.getElementById('msgWelcome')?.classList.add('hidden');
    document.getElementById('msgThreadHeader')?.classList.remove('hidden');
    document.getElementById('msgThreadBody')?.classList.remove('hidden');
    document.getElementById('msgInputWrap')?.classList.remove('hidden');
    document.getElementById('threadName').textContent = peerNick || '알 수 없음';
    document.getElementById('threadProfileLink').href = `profile.html?id=${peerId}`;

    // 아바타
    const peerProfile = await getProfile(peerId);
    const avatarEl = document.getElementById('threadAvatar');
    if (avatarEl) renderAvatar(avatarEl, peerNick, peerProfile?.avatar_url, peerProfile?.banner_color);

    // 모바일: 사이드바 숨기기
    document.getElementById('msgSidebar')?.classList.add('msg-sidebar-hidden');
    document.getElementById('msgMain')?.classList.add('msg-main-active');

    // 읽음 처리 (비동기)
    supabaseClient.from('messages')
      .update({ read: true })
      .eq('sender_id', peerId).eq('receiver_id', me).eq('read', false)
      .then(() => { loadMsgBadge(session); loadConversations(); });

    await renderMessages(peerId);
    loadConversations();
    document.getElementById('msgInput')?.focus();
  }

  // ── 메시지 렌더링 ────────────────────────────────────────
  async function renderMessages(peerId, silent = false) {
    const { data: msgs } = await supabaseClient
      .rpc('get_thread', { p_user_a: me, p_user_b: peerId });

    const container = document.getElementById('msgMessages');
    if (!container) return;

    const prevScrollTop    = container.scrollTop;
    const prevScrollHeight = container.scrollHeight;
    const wasAtBottom      = prevScrollHeight - prevScrollTop - container.clientHeight < 60;

    container.innerHTML = (msgs || []).map(m => {
      const isMine = m.sender_id === me;
      return `
      <div class="msg-bubble-wrap${isMine ? ' mine' : ''}">
        <div class="msg-bubble${isMine ? ' msg-bubble-mine' : ''}">${escapeHTML(m.content)}</div>
        <div class="msg-bubble-meta">${new Date(m.created_at).toLocaleTimeString('ko-KR', { hour:'2-digit', minute:'2-digit' })}${isMine ? (m.read ? ' ✓✓' : ' ✓') : ''}</div>
      </div>`;
    }).join('');

    if (!silent || wasAtBottom) {
      container.scrollTop = container.scrollHeight;
    }

    // 읽음 처리
    const unread = (msgs || []).filter(m => m.sender_id === peerId && !m.read);
    if (unread.length) {
      supabaseClient.from('messages').update({ read: true })
        .eq('sender_id', peerId).eq('receiver_id', me).eq('read', false).then(() => loadMsgBadge(session));
    }
  }

  // ── 메시지 전송 ─────────────────────────────────────────
  async function sendMessage(peerId) {
    const input = document.getElementById('msgInput');
    const content = input?.value.trim();
    if (!content || !peerId) return;

    input.value = '';
    input.style.height = 'auto';

    const { error } = await supabaseClient.from('messages').insert({
      sender_id:   me,
      receiver_id: peerId,
      content,
    });
    if (error) { showToast('전송 실패', 'red'); input.value = content; return; }

    await renderMessages(peerId);
    loadConversations();
  }

  // ── 입력창 자동 높이 + Enter 전송 ───────────────────────
  const input   = document.getElementById('msgInput');
  const sendBtn = document.getElementById('msgSendBtn');

  input?.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  });
  input?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(_activePeer); }
  });
  sendBtn?.addEventListener('click', () => sendMessage(_activePeer));

  // ── 뒤로가기 (모바일) ────────────────────────────────────
  document.getElementById('msgBackBtn')?.addEventListener('click', () => {
    _activePeer = null;
    document.getElementById('msgSidebar')?.classList.remove('msg-sidebar-hidden');
    document.getElementById('msgMain')?.classList.remove('msg-main-active');
    document.getElementById('msgWelcome')?.classList.remove('hidden');
    document.getElementById('msgThreadHeader')?.classList.add('hidden');
    document.getElementById('msgThreadBody')?.classList.add('hidden');
    document.getElementById('msgInputWrap')?.classList.add('hidden');
  });

  // ── 새 메시지 모달 ──────────────────────────────────────
  const openNewMsgModal = () => {
    document.getElementById('newMsgModal')?.classList.remove('hidden');
    document.getElementById('newMsgNickname')?.focus();
  };
  document.getElementById('newMsgBtn')?.addEventListener('click', openNewMsgModal);
  document.getElementById('msgWelcomeNewBtn')?.addEventListener('click', openNewMsgModal);
  const closeNewMsg = () => {
    document.getElementById('newMsgModal')?.classList.add('hidden');
    document.getElementById('newMsgNickname').value  = '';
    document.getElementById('newMsgContent').value   = '';
    document.getElementById('newMsgUserList').innerHTML = '';
    document.getElementById('newMsgUserList').classList.add('hidden');
    _selectedNewUser = null;
  };
  document.getElementById('closeNewMsgModal')?.addEventListener('click', closeNewMsg);
  document.getElementById('cancelNewMsg')?.addEventListener('click', closeNewMsg);

  let _selectedNewUser = null;
  let _searchTimer;

  // 닉네임 검색
  document.getElementById('newMsgNickname')?.addEventListener('input', () => {
    clearTimeout(_searchTimer);
    const q = document.getElementById('newMsgNickname').value.trim();
    if (!q) { document.getElementById('newMsgUserList').classList.add('hidden'); return; }
    _searchTimer = setTimeout(async () => {
      const { data } = await supabaseClient
        .from('profiles')
        .select('user_id,nickname,avatar_url,banner_color')
        .ilike('nickname', `%${q}%`)
        .neq('user_id', me)
        .limit(8);
      const ul = document.getElementById('newMsgUserList');
      if (!data?.length) { ul.innerHTML = '<div class="msg-user-item">결과 없음</div>'; ul.classList.remove('hidden'); return; }
      ul.innerHTML = data.map(u => `
        <div class="msg-user-item" data-uid="${u.user_id}" data-nick="${escapeHTML(u.nickname)}">
          <div class="msg-conv-avatar msg-conv-avatar-sm" style="background:${escapeHTML(u.banner_color||'#4aab8e')}">${u.avatar_url ? `<img src="${escapeHTML(u.avatar_url)}" alt="">` : u.nickname.slice(0,1).toUpperCase()}</div>
          ${escapeHTML(u.nickname)}
        </div>`).join('');
      ul.classList.remove('hidden');
      ul.querySelectorAll('.msg-user-item[data-uid]').forEach(item => {
        item.addEventListener('click', () => {
          _selectedNewUser = { id: item.dataset.uid, nick: item.dataset.nick };
          document.getElementById('newMsgNickname').value = item.dataset.nick;
          ul.classList.add('hidden');
          document.getElementById('newMsgContent')?.focus();
        });
      });
    }, 300);
  });

  // 전송
  document.getElementById('sendNewMsgBtn')?.addEventListener('click', async () => {
    if (!_selectedNewUser) { showToast('받는 사람을 선택해 주세요.', 'red'); return; }
    const content = document.getElementById('newMsgContent').value.trim();
    if (!content) { showToast('메시지를 입력해 주세요.', 'red'); return; }
    const btn = document.getElementById('sendNewMsgBtn');
    btn.disabled = true; btn.textContent = '전송 중…';
    const { error } = await supabaseClient.from('messages').insert({
      sender_id: me, receiver_id: _selectedNewUser.id, content,
    });
    btn.disabled = false; btn.textContent = btn.dataset.label || '보내기';
    if (error) { showToast('전송 실패', 'red'); return; }
    const peer = { id: _selectedNewUser.id, nick: _selectedNewUser.nick };
    closeNewMsg();
    await loadConversations();
    await openThread(peer.id, peer.nick);
  });

  // ── 초기 로드 + Realtime 구독 ────────────────────────────
  await loadConversations();
  subscribeMessages();

  if (toParam) {
    const peerProfile = await getProfile(toParam);
    if (peerProfile) await openThread(toParam, peerProfile.nickname);
  }
}

/* ════════════════════════════════════════
   Page: Bookmarks
════════════════════════════════════════ */
async function initBookmarksPage() {
  const session = await requireAuth();
  if (!session) return;
  updateNav(session);

  initNavLogout();

  const list = document.getElementById('bookmarksList');
  list.innerHTML = '<p class="news-empty">불러오는 중…</p>';

  const { data, error } = await supabaseClient
    .from('bookmarks')
    .select('post_id, created_at, posts(id,title,category,views,created_at,author_nickname,game_url,video_url,code_lang,hidden)')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false });

  if (error || !data?.length) {
    list.innerHTML = '<p class="news-empty">저장한 게시물이 없어요.<br>게시물의 🔖 저장 버튼을 눌러보세요.</p>';
    return;
  }

  const rows = data
    .filter(b => b.posts && !b.posts.hidden)
    .map(b => renderPostRowHTML(b.posts)).join('');

  list.innerHTML = rows || '<p class="news-empty">표시할 게시물이 없습니다.</p>';
}

/* ════════════════════════════════════════
   Page: Search
════════════════════════════════════════ */
async function initSearchPage() {
  const session = await getSession();
  updateNav(session);

  initNavLogout();

  initHeaderSearch();

  const q     = new URLSearchParams(location.search).get('q') || '';
  const input = document.getElementById('headerSearch');
  if (input && q) input.value = q;

  document.title = q ? `"${q}" 검색 결과 — Open Azitfh` : '검색 — Open Azitfh';

  const resultsEl = document.getElementById('searchResults');
  const tabs      = document.querySelectorAll('.search-tab');
  let activeTab   = 'all';

  async function runSearch() {
    if (!q) return;
    resultsEl.innerHTML = '<p class="news-empty">검색 중…</p>';

    const [postsRes, azitsRes] = await Promise.all([
      supabaseClient.from('posts')
        .select('id,title,category,author_nickname,views,created_at,code_lang,game_url,video_url')
        .eq('hidden', false).ilike('title', `%${q}%`).order('views', { ascending: false }).limit(30),
      supabaseClient.from('azits')
        .select('id,name,type,icon,cover_color,description').ilike('name', `%${q}%`).limit(20),
    ]);

    const posts = postsRes.data || [];
    const azits = azitsRes.data || [];

    if (!posts.length && !azits.length) {
      resultsEl.innerHTML = `<p class="news-empty">"${escapeHTML(q)}"에 대한 결과가 없어요.</p>`;
      return;
    }

    let html = '';

    if ((activeTab === 'all' || activeTab === 'azits') && azits.length) {
      html += `<div class="sr-group"><h3 class="sr-group-title">🏠 아지트 <span class="sr-count">${azits.length}</span></h3>`;
      html += azits.map(a => `
        <a class="sr-azit-item" href="azitfh.html?cat=${encodeURIComponent(a.name)}"
           style="--sel-color:${escapeHTML(a.cover_color||'#4aab8e')}">
          <span class="sr-azit-icon">${escapeHTML(a.icon||'🏠')}</span>
          <div class="sr-azit-info">
            <span class="sr-azit-name">${escapeHTML(a.name)}</span>
            <span class="sr-azit-desc">${escapeHTML(a.description||'')}</span>
          </div>
          <span class="sr-azit-type">${escapeHTML(a.type||'')}</span>
        </a>`).join('');
      html += '</div>';
    }

    if ((activeTab === 'all' || activeTab === 'posts') && posts.length) {
      html += `<div class="sr-group"><h3 class="sr-group-title">📝 게시물 <span class="sr-count">${posts.length}</span></h3>`;
      html += posts.map(p => renderPostRowHTML(p)).join('');
      html += '</div>';
    }

    resultsEl.innerHTML = html;
  }

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeTab = tab.dataset.tab;
      runSearch();
    });
  });

  runSearch();
}

/* ════════════════════════════════════════
   Page: Notifications
════════════════════════════════════════ */
async function initNotificationsPage() {
  const session = await requireAuth();
  if (!session) return;
  updateNav(session);

  initNavLogout();

  const list = document.getElementById('notifList');
  list.innerHTML = '<p class="news-empty">불러오는 중…</p>';

  const { data: notifs, error } = await supabaseClient
    .from('notifications')
    .select('*')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error || !notifs?.length) {
    list.innerHTML = '<p class="news-empty">새 알림이 없어요.</p>';
    return;
  }

  const TYPE_LABEL = { comment: '댓글', reply: '답글', vote: '추천' };
  const TYPE_ICON  = { comment: '💬', reply: '↩️', vote: '👍' };

  list.innerHTML = notifs.map(n => `
    <a class="notif-item${n.read ? ' notif-read' : ''}" href="post-detail.html?id=${n.post_id}" data-id="${n.id}">
      <span class="notif-icon">${TYPE_ICON[n.type] || '🔔'}</span>
      <div class="notif-body">
        <span class="notif-actor">${escapeHTML(n.actor_nickname)}</span>님이
        ${TYPE_LABEL[n.type] || '알림'}을 남겼어요
        <span class="notif-date">${formatDate(n.created_at)}</span>
      </div>
      ${!n.read ? '<span class="notif-dot"></span>' : ''}
    </a>`).join('');

  // 클릭 시 읽음 처리
  list.querySelectorAll('.notif-item').forEach(el => {
    el.addEventListener('click', async () => {
      const id = el.dataset.id;
      if (!el.classList.contains('notif-read')) {
        el.classList.add('notif-read');
        el.querySelector('.notif-dot')?.remove();
        await supabaseClient.from('notifications').update({ read: true }).eq('id', id);
        loadNotifBadge(session.user.id);
      }
    });
  });

  // 모두 읽음 버튼
  document.getElementById('markAllReadBtn')?.addEventListener('click', async () => {
    await supabaseClient.from('notifications')
      .update({ read: true }).eq('user_id', session.user.id).eq('read', false);
    list.querySelectorAll('.notif-item:not(.notif-read)').forEach(el => {
      el.classList.add('notif-read');
      el.querySelector('.notif-dot')?.remove();
    });
    loadNotifBadge(session.user.id);
    showToast('모두 읽음으로 표시됐어요.', 'green');
  });
}

/* ════════════════════════════════════════
   Page: Dashboard
════════════════════════════════════════ */
async function initDashboard() {
  const session = await requireAuth();
  if (!session) return;
  updateNav(session);
  initHeaderSearch();

  const user     = session.user;
  const nickname = user.user_metadata?.nickname || user.email;
  const joinDate = new Date(user.created_at).toLocaleDateString('ko-KR');

  const nameEl  = document.getElementById('userName');
  const dateEl  = document.getElementById('joinDate');
  const emailEl = document.getElementById('userEmail');

  if (nameEl)  nameEl.textContent  = nickname;
  if (dateEl)  dateEl.textContent  = joinDate;
  if (emailEl) emailEl.textContent = user.email;

  await initCategoryManager(user.id);

  document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    await authSignOut();
    window.location.href = 'index.html';
  });

  initNavLogout();

  supabaseClient.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') window.location.href = 'index.html';
  });
}
