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
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'toast' + (type ? ' ' + type : '');
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

function showError(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
}

function clearErrors() {
  document.querySelectorAll('.error-msg, .global-error').forEach(el => el.classList.remove('show'));
}

function setLoading(btn, loading) {
  btn.disabled = loading;
  btn.textContent = loading ? '처리 중...' : btn.dataset.label;
}

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

  if (session) {
    navLogin?.classList.add('hidden');
    navSignup?.classList.add('hidden');
    navDash?.classList.remove('hidden');
    navLogout?.classList.remove('hidden');
  } else {
    navLogin?.classList.remove('hidden');
    navSignup?.classList.remove('hidden');
    navDash?.classList.add('hidden');
    navLogout?.classList.add('hidden');
  }
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

/* ── 관리자 권한 확인 ── */
async function isAdmin() {
  const session = await getSession();
  if (!session) return false;
  const { data } = await supabaseClient
    .from('admins')
    .select('user_id')
    .eq('user_id', session.user.id)
    .single();
  return !!data;
}

/* ── 신고 제출 ── */
async function reportPost(postId) {
  const { data, error } = await supabaseClient.rpc('submit_report', { p_post_id: postId });
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
let _selectedCat = '';

async function getCategories() {
  try {
    const { data, error } = await supabaseClient
      .from('categories')
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
  const cats = await getCategories();
  return cats.map(c => c.name);
}

async function insertCategory({ name, description = '', created_by = '익명', creator_id = null }) {
  const { error } = await supabaseClient
    .from('categories')
    .insert({ name, description, created_by, creator_id });
  if (error) throw error;
}

async function deleteCategory(name) {
  const { error } = await supabaseClient.from('categories').delete().eq('name', name);
  if (error) throw error;
}

/* 카테고리별 게시물 수 / 고유 유저 수 (posts 배열 받아 계산) */
function getCatCounts(posts) {
  const counts = {};
  posts.forEach(p => { counts[p.category] = (counts[p.category] || 0) + 1; });
  return counts;
}

function getCatUserCounts(posts) {
  const sets = {};
  posts.forEach(p => {
    if (!sets[p.category]) sets[p.category] = new Set();
    sets[p.category].add(p.author_id);
  });
  const result = {};
  Object.entries(sets).forEach(([cat, s]) => { result[cat] = s.size; });
  return result;
}

/* ── 카테고리 칩 렌더링 (대시보드용) ── */
async function renderCategoryChips(chipsId, searchId, onSelect) {
  const wrap = document.getElementById(chipsId);
  if (!wrap) return;

  const cats     = await getCategories();
  const allPosts = await getPosts().catch(() => []);
  const counts   = getCatCounts(allPosts);
  const search = (document.getElementById(searchId)?.value || '').toLowerCase().trim();
  const visible = search ? cats.filter(c => c.name.toLowerCase().includes(search)) : cats;

  if (cats.length === 0) {
    wrap.innerHTML = '<span class="cat-chip-empty">카테고리가 없습니다.</span>';
    return;
  }

  wrap.innerHTML = '';

  const allBtn = document.createElement('button');
  allBtn.className = 'cat-chip' + (_selectedCat === '' ? ' active' : '');
  allBtn.textContent = '전체';
  allBtn.addEventListener('click', () => {
    _selectedCat = '';
    renderCategoryChips(chipsId, searchId, onSelect);
    if (onSelect) onSelect();
  });
  wrap.appendChild(allBtn);

  if (visible.length === 0 && search) {
    const empty = document.createElement('span');
    empty.className = 'cat-chip-empty';
    empty.textContent = '검색 결과가 없습니다.';
    wrap.appendChild(empty);
  } else {
    visible.forEach(c => {
      const btn = document.createElement('button');
      btn.className = 'cat-chip' + (_selectedCat === c.name ? ' active' : '');
      btn.textContent = c.name;

      if (counts[c.name]) {
        const badge = document.createElement('span');
        badge.className = 'cat-count';
        badge.textContent = counts[c.name];
        btn.appendChild(badge);
      }

      btn.addEventListener('click', () => {
        _selectedCat = c.name;
        renderCategoryChips(chipsId, searchId, onSelect);
        if (onSelect) onSelect();
      });
      wrap.appendChild(btn);
    });
  }
}

/* ── 카테고리 카드 렌더링 (홈 전용, 인기순 정렬) ── */
async function renderCategoryCards() {
  const wrap = document.getElementById('catChips');
  if (!wrap) return;

  // posts 실패해도 카테고리는 표시 (통계용이므로 catch로 빈 배열 대체)
  const cats     = await getCategories();
  const allPosts = await getPosts().catch(() => []);
  const postCounts = getCatCounts(allPosts);
  const userCounts = getCatUserCounts(allPosts);
  const search     = (document.getElementById('catSearch')?.value || '').toLowerCase().trim();

  const sorted = cats
    .filter(c => !search || c.name.toLowerCase().includes(search))
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
    await Promise.all([renderCategoryCards(), renderPosts(), renderPostsList()]);
  });
  wrap.appendChild(allBtn);

  if (cats.length === 0) {
    const empty = document.createElement('span');
    empty.className = 'cat-chip-empty';
    empty.textContent = '카테고리가 없습니다.';
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

    const nameRow = document.createElement('div');
    nameRow.className = 'cat-card-name-row';
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

    btn.addEventListener('click', async () => {
      _selectedCat = c.name;
      await Promise.all([renderCategoryCards(), renderPosts(), renderPostsList()]);
    });
    wrap.appendChild(btn);
  });
}

/* ── 홈 카테고리 섹션 초기화 ── */
async function initCategorySection() {
  await renderCategoryCards();
  document.getElementById('catSearch')?.addEventListener('input', () => renderCategoryCards());
}

/* ── 대시보드 카테고리 섹션 초기화 (조회만) ── */
async function initDashCategorySection() {
  await renderCategoryChips('dashCatChips', 'dashCatSearch', null);
  document.getElementById('dashCatSearch')?.addEventListener('input', () => {
    renderCategoryChips('dashCatChips', 'dashCatSearch', null);
  });
}

/* ════════════════════════════════════════
   게시물 (Supabase)
════════════════════════════════════════ */
async function getPosts(categoryFilter = '') {
  let query = supabaseClient.from('posts').select('*');
  if (categoryFilter) query = query.eq('category', categoryFilter);
  const { data, error } = await query;
  if (error) {
    console.error('[getPosts 오류]', error.code, error.message, error.details);
    throw error;
  }
  console.log('[getPosts]', { categoryFilter, count: data?.length, sample: data?.[0] });
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
}

async function deletePost(id) {
  const { error } = await supabaseClient.from('posts').delete().eq('id', id);
  if (error) throw error;
}

async function incrementViews(id) {
  try {
    await supabaseClient.rpc('increment_views', { post_id: id });
  } catch (err) {
    console.error('incrementViews:', err);
  }
}

/* HTML 이스케이프 (XSS 방지) */
function escapeHTML(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function truncate(s, n) {
  return s.length > n ? s.slice(0, n) + '…' : s;
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('ko-KR');
}

/* ── 인기 게시물 렌더링 (조회수순, 최대 12개) ── */
async function renderPosts() {
  const grid    = document.getElementById('newsGrid');
  const titleEl = document.getElementById('postsSectionTitle');
  if (!grid) return;

  if (titleEl) titleEl.textContent = '인기 게시물';

  try {
    let posts = await getPosts(_selectedCat);
    posts = posts.sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 12);

    if (posts.length === 0) {
      const msg = _selectedCat
        ? `"${escapeHTML(_selectedCat)}" 카테고리에 게시물이 없습니다.`
        : '아직 게시물이 없습니다.';
      grid.innerHTML = `<p class="news-empty">${msg}</p>`;
      return;
    }

    grid.innerHTML = posts.map(p => `
      <a class="news-card" href="post-detail.html?id=${p.id}">
        <div class="news-card-top">
          <span class="news-badge">${escapeHTML(p.category)}</span>
          <span class="news-date">${formatDate(p.created_at)}</span>
        </div>
        <h3 class="news-title">${escapeHTML(p.title)}</h3>
        <p class="news-desc">${escapeHTML(truncate(p.content, 70))}</p>
        <div class="post-meta">by ${escapeHTML(p.author_nickname)} · 조회 ${p.views || 0}</div>
      </a>
    `).join('');
  } catch (err) {
    console.error('renderPosts 오류:', err);
    grid.innerHTML = `<p class="news-empty">게시물을 불러오지 못했어요.<br><small style="font-size:11px;opacity:.7">${escapeHTML(err.message || '')}</small></p>`;
  }
}

/* ── 게시물 목록 렌더링 (최신순, 전체) ── */
async function renderPostsList() {
  const wrap    = document.getElementById('postsList');
  const titleEl = document.getElementById('postsListTitle');
  if (!wrap) return;

  if (titleEl) titleEl.textContent = '게시물';

  try {
    let query = supabaseClient
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false });
    if (_selectedCat) query = query.eq('category', _selectedCat);

    const { data: posts, error } = await query;
    if (error) throw error;

    if (!posts || posts.length === 0) {
      wrap.innerHTML = '<p class="news-empty">게시물이 없습니다.</p>';
      return;
    }

    wrap.innerHTML = posts.map(p => `
      <a class="post-row" href="post-detail.html?id=${p.id}">
        <span class="post-row-cat">${escapeHTML(p.category)}</span>
        <span class="post-row-title">${escapeHTML(p.title)}</span>
        <span class="post-row-author">${escapeHTML(p.author_nickname)}</span>
        <span class="post-row-date">${formatDate(p.created_at)}</span>
        <span class="post-row-views">👁 ${p.views || 0}</span>
      </a>
    `).join('');
  } catch (err) {
    console.error('renderPostsList 오류:', err);
    wrap.innerHTML = `<p class="news-empty">게시물을 불러오지 못했어요.<br><small style="font-size:11px;opacity:.7">${escapeHTML(err.message || '')}</small></p>`;
  }
}

/* ── 카테고리 관리 (대시보드, 본인 카테고리만) ── */
async function renderCategories(userId) {
  const ul = document.getElementById('catList');
  if (!ul) return;

  const { data: cats, error } = await supabaseClient
    .from('categories')
    .select('*')
    .eq('creator_id', userId)
    .order('created_at', { ascending: true });

  if (error || !cats || cats.length === 0) {
    ul.innerHTML = '<li class="cat-empty">내가 만든 카테고리가 없습니다.</li>';
    return;
  }

  ul.innerHTML = cats.map(c => `
    <li class="cat-item">
      <div style="flex:1;min-width:0">
        <span class="cat-name">${escapeHTML(c.name)}</span>
        ${c.description ? `<div class="cat-item-desc">${escapeHTML(c.description)}</div>` : ''}
        <div class="cat-item-meta">${new Date(c.created_at).toLocaleDateString('ko-KR')}</div>
      </div>
      <button class="cat-del" data-name="${escapeHTML(c.name)}">×</button>
    </li>
  `).join('');

  ul.querySelectorAll('.cat-del').forEach(btn => {
    btn.addEventListener('click', async () => {
      try {
        await deleteCategory(btn.dataset.name);
        await renderCategories(userId);
      } catch {
        showToast('삭제 실패', 'red');
      }
    });
  });
}

async function initCategoryManager(userId, nickname) {
  await renderCategories(userId);

  const input  = document.getElementById('catInput');
  const addBtn = document.getElementById('catAddBtn');
  if (!input || !addBtn) return;

  addBtn.addEventListener('click', async () => {
    const name = input.value.trim();
    if (!name) return;

    try {
      await insertCategory({
        name,
        description: '',
        created_by: nickname,
        creator_id: userId,
      });
      input.value = '';
      await renderCategories(userId);
      showToast(`"${name}" 카테고리가 추가됐어요.`, 'green');
    } catch (err) {
      if (err.code === '23505') showToast('이미 있는 카테고리예요.', 'red');
      else showToast('추가 실패', 'red');
    }
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addBtn.click(); }
  });
}

/* ── 카테고리 생성 폼 초기화 (누구나 가능) ── */
function initCatCreate(session) {
  const createBtn   = document.getElementById('catCreateBtn');
  const createForm  = document.getElementById('catCreateForm');
  const createInput = document.getElementById('catCreateInput');
  const createDesc  = document.getElementById('catCreateDesc');
  const cancelBtn   = document.getElementById('catCreateCancel');

  if (!createBtn) return;

  createBtn.addEventListener('click', () => {
    createForm.classList.toggle('hidden');
    if (!createForm.classList.contains('hidden')) createInput.focus();
  });

  cancelBtn?.addEventListener('click', () => {
    createForm.classList.add('hidden');
    createInput.value = '';
    if (createDesc) createDesc.value = '';
  });

  createForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = createInput.value.trim();
    const desc = createDesc?.value.trim() || '';
    if (!name) return;

    const createdBy = session?.user?.user_metadata?.nickname
      || session?.user?.email
      || '익명';

    try {
      await insertCategory({
        name,
        description: desc,
        created_by: createdBy,
        creator_id: session?.user?.id || null,
      });
      createInput.value = '';
      if (createDesc) createDesc.value = '';
      createForm.classList.add('hidden');
      await renderCategoryCards();
      showToast(`"${name}" 카테고리가 추가됐어요.`, 'green');
    } catch (err) {
      if (err.code === '23505') showToast('이미 있는 카테고리예요.', 'red');
      else showToast('추가 실패. 로그인 후 다시 시도해 주세요.', 'red');
    }
  });
}

/* ════════════════════════════════════════
   Page: Post Write
════════════════════════════════════════ */
async function initPostWrite() {
  const session = await getSession();
  if (!session) {
    showToast('로그인이 필요해요.', 'red');
    setTimeout(() => { window.location.href = 'login.html'; }, 1200);
    return;
  }

  const form = document.getElementById('postWriteForm');
  if (!form) return;

  const catSelect = form.category;
  const names     = await getCategoryNames();

  if (names.length === 0) {
    catSelect.innerHTML = '<option value="" disabled selected>카테고리가 없습니다</option>';
    catSelect.disabled = true;
    const hint = document.getElementById('catHint');
    if (hint) hint.classList.remove('hidden');
  } else {
    names.forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      catSelect.appendChild(opt);
    });
  }

  const submitBtn = form.querySelector('[type=submit]');
  submitBtn.dataset.label = submitBtn.textContent;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title    = form.title.value.trim();
    const content  = form.content.value.trim();
    const category = form.category.value;

    if (!title || !content) {
      showToast('제목과 내용을 모두 입력해 주세요.', 'red');
      return;
    }

    const u = session.user;
    setLoading(submitBtn, true);
    try {
      await insertPost({
        title,
        content,
        category,
        author_id:       u.id,
        author_nickname: u.user_metadata?.nickname || u.email,
        views:           0,
      });
      showToast('게시물이 등록됐어요! 🎉', 'green');
      setTimeout(() => { window.location.href = 'index.html'; }, 1000);
    } catch (err) {
      console.error('insertPost 오류:', err);
      showToast(`게시물 등록 실패: ${err?.message || '알 수 없는 오류'}`, 'red');
    } finally {
      setLoading(submitBtn, false);
    }
  });
}

/* ════════════════════════════════════════
   Page: Post Detail
════════════════════════════════════════ */
async function initPostDetail() {
  const session = await getSession();
  updateNav(session);

  document.getElementById('navLogout')?.addEventListener('click', async (e) => {
    e.preventDefault();
    await authSignOut();
    location.reload();
  });

  const id   = new URLSearchParams(location.search).get('id');
  const wrap = document.getElementById('postContent');

  if (!id) { wrap.innerHTML = '<p class="news-empty">게시물을 찾을 수 없어요.</p>'; return; }

  await incrementViews(id);
  const post = await getPost(id);
  if (!post) { wrap.innerHTML = '<p class="news-empty">게시물을 찾을 수 없어요.</p>'; return; }

  document.getElementById('postCategory').textContent = post.category;
  document.getElementById('postTitle').textContent    = post.title;
  document.getElementById('postAuthor').textContent   = post.author_nickname;
  document.getElementById('postDate').textContent     = formatDate(post.created_at);
  document.getElementById('postViews').textContent    = post.views || 0;
  document.getElementById('postBody').textContent     = post.content;

  if (session && session.user.id === post.author_id) {
    const delBtn = document.getElementById('postDelBtn');
    delBtn.classList.remove('hidden');
    delBtn.addEventListener('click', async () => {
      if (!confirm('정말 삭제하시겠어요?')) return;
      try {
        await deletePost(id);
        window.location.href = 'index.html';
      } catch {
        showToast('삭제에 실패했어요.', 'red');
      }
    });
  }

  // 신고 버튼 (본인 게시물 제외, 로그인 필요)
  const reportBtn = document.getElementById('postReportBtn');
  if (reportBtn && session && session.user.id !== post.author_id) {
    reportBtn.classList.remove('hidden');
    const already = await hasReported(id);
    if (already) {
      reportBtn.textContent = '신고됨';
      reportBtn.disabled = true;
      reportBtn.classList.add('reported');
    } else {
      reportBtn.addEventListener('click', async () => {
        if (!confirm('이 게시물을 신고하시겠어요?')) return;
        try {
          const result = await reportPost(id);
          if (!result.success && result.reason === 'already_reported') {
            showToast('이미 신고한 게시물이에요.', 'red');
          } else if (result.hidden) {
            showToast('신고가 누적되어 게시물이 숨겨졌습니다.', 'green');
            setTimeout(() => { window.location.href = 'index.html'; }, 1500);
          } else {
            showToast('신고가 접수됐어요.', 'green');
            reportBtn.textContent = '신고됨';
            reportBtn.disabled = true;
            reportBtn.classList.add('reported');
          }
        } catch {
          showToast('신고에 실패했어요.', 'red');
        }
      });
    }
  }
}

/* ════════════════════════════════════════
   Page: Index
════════════════════════════════════════ */
async function initIndex() {
  const session = await getSession();
  updateNav(session);

  // 각 섹션이 독립적으로 실패하도록 분리
  await initCategorySection().catch(err => console.error('카테고리 로드 실패:', err));
  initCatCreate(session);
  await renderPosts().catch(err => console.error('인기 게시물 로드 실패:', err));
  await renderPostsList().catch(err => console.error('게시물 목록 로드 실패:', err));
  const admin = await isAdmin().catch(() => false);
  await initNotices(admin).catch(err => console.error('공지 로드 실패:', err));

  const writeBtn = document.getElementById('writeBtn');
  if (session) writeBtn?.classList.remove('hidden');

  document.getElementById('navLogout')?.addEventListener('click', async (e) => {
    e.preventDefault();
    await authSignOut();
    location.reload();
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
   Page: Dashboard
════════════════════════════════════════ */
async function initDashboard() {
  const session = await getSession();
  if (!session) { window.location.href = 'login.html'; return; }

  const user     = session.user;
  const nickname = user.user_metadata?.nickname || user.email;
  const joinDate = new Date(user.created_at).toLocaleDateString('ko-KR');

  const nameEl  = document.getElementById('userName');
  const dateEl  = document.getElementById('joinDate');
  const emailEl = document.getElementById('userEmail');

  if (nameEl)  nameEl.textContent  = nickname;
  if (dateEl)  dateEl.textContent  = joinDate;
  if (emailEl) emailEl.textContent = user.email;

  await initDashCategorySection();
  await initCategoryManager(user.id, nickname);

  document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    await authSignOut();
    window.location.href = 'index.html';
  });

  document.getElementById('navLogout')?.addEventListener('click', async (e) => {
    e.preventDefault();
    await authSignOut();
    window.location.href = 'index.html';
  });

  supabaseClient.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') window.location.href = 'index.html';
  });
}
