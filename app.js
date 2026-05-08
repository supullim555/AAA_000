/* ── Dark Mode ── */
function initDarkMode() {
  const saved = localStorage.getItem('jnaver_theme');
  if (saved === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
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
  btn.textContent = isDark ? '☀️' : '🌙';
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

/* ── 공지사항 ── */
function getNotices() {
  return JSON.parse(localStorage.getItem('jnaver_notices') || '[]');
}

function saveNotices(list) {
  localStorage.setItem('jnaver_notices', JSON.stringify(list));
}

function renderNotices(isAdmin) {
  const ul = document.getElementById('noticeList');
  if (!ul) return;

  const list = getNotices();

  if (list.length === 0) {
    ul.innerHTML = '<li class="notice-empty">공지사항이 없습니다.</li>';
    return;
  }

  ul.innerHTML = list.map(n => `
    <li class="notice-item">
      <span class="notice-dot">●</span>
      <span class="notice-title">${n.title}</span>
      <span class="notice-date">${n.date}</span>
      ${isAdmin ? `<button class="notice-del" data-id="${n.id}" title="삭제">×</button>` : ''}
    </li>
  `).join('');

  if (isAdmin) {
    ul.querySelectorAll('.notice-del').forEach(btn => {
      btn.addEventListener('click', () => {
        saveNotices(getNotices().filter(n => n.id !== Number(btn.dataset.id)));
        renderNotices(true);
      });
    });
  }
}

function initNotices(isAdmin) {
  const addBtn  = document.getElementById('noticeAddBtn');
  const form    = document.getElementById('noticeForm');
  const input   = document.getElementById('noticeInput');

  if (isAdmin && addBtn) {
    addBtn.classList.remove('hidden');
    addBtn.addEventListener('click', () => {
      form.classList.toggle('hidden');
      if (!form.classList.contains('hidden')) input.focus();
    });
  }

  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = input.value.trim();
    if (!title) return;

    const list = getNotices();
    list.unshift({ id: Date.now(), title, date: new Date().toLocaleDateString('ko-KR') });
    saveNotices(list);
    input.value = '';
    form.classList.add('hidden');
    renderNotices(true);
  });

  renderNotices(isAdmin);
}

/* ── 게시물 (Posts) ── */
/* ── 카테고리 ── */
let _selectedCat = ''; // 현재 선택된 카테고리 ('': 전체)

function getCategories() {
  return JSON.parse(localStorage.getItem('jnaver_categories') || '[]');
}

function saveCategories(list) {
  localStorage.setItem('jnaver_categories', JSON.stringify(list));
}

/* 카테고리별 게시물 수 */
function getCatCounts() {
  const counts = {};
  getPosts().forEach(p => {
    counts[p.category] = (counts[p.category] || 0) + 1;
  });
  return counts;
}

/* ── 카테고리 칩 렌더링 ── */
function renderCategoryChips(chipsId, searchId, onSelect) {
  const wrap = document.getElementById(chipsId);
  if (!wrap) return;

  const cats    = getCategories();
  const search  = (document.getElementById(searchId)?.value || '').toLowerCase().trim();
  const visible = search ? cats.filter(c => c.toLowerCase().includes(search)) : cats;
  const counts  = getCatCounts();

  if (cats.length === 0) {
    wrap.innerHTML = '<span class="cat-chip-empty">카테고리가 없습니다.</span>';
    return;
  }

  // 칩 DOM 직접 생성 → data-cat 인코딩 문제 없음
  wrap.innerHTML = '';

  // 전체 칩
  const allBtn = document.createElement('button');
  allBtn.className = 'cat-chip' + (_selectedCat === '' ? ' active' : '');
  allBtn.textContent = '전체';
  allBtn.addEventListener('click', () => {
    _selectedCat = '';
    renderCategoryChips(chipsId, searchId, onSelect);
    if (onSelect) onSelect();
  });
  wrap.appendChild(allBtn);

  // 카테고리 칩
  if (visible.length === 0 && search) {
    const empty = document.createElement('span');
    empty.className = 'cat-chip-empty';
    empty.textContent = '검색 결과가 없습니다.';
    wrap.appendChild(empty);
  } else {
    visible.forEach(c => {
      const btn = document.createElement('button');
      btn.className = 'cat-chip' + (_selectedCat === c ? ' active' : '');
      btn.textContent = c;

      if (counts[c]) {
        const badge = document.createElement('span');
        badge.className = 'cat-count';
        badge.textContent = counts[c];
        btn.appendChild(badge);
      }

      btn.addEventListener('click', () => {
        _selectedCat = c;                              // 클로저로 원본 값 그대로 사용
        renderCategoryChips(chipsId, searchId, onSelect);
        if (onSelect) onSelect();
      });
      wrap.appendChild(btn);
    });
  }
}

/* ── 홈 카테고리 섹션 초기화 ── */
function initCategorySection() {
  renderCategoryChips('catChips', 'catSearch', renderPosts);
  document.getElementById('catSearch')?.addEventListener('input', () => {
    renderCategoryChips('catChips', 'catSearch', renderPosts);
  });
}

/* ── 대시보드 카테고리 섹션 초기화 (조회만) ── */
function initDashCategorySection() {
  renderCategoryChips('dashCatChips', 'dashCatSearch', null);
  document.getElementById('dashCatSearch')?.addEventListener('input', () => {
    renderCategoryChips('dashCatChips', 'dashCatSearch', null);
  });
}

function getPosts() {
  return JSON.parse(localStorage.getItem('jnaver_posts') || '[]');
}

function savePosts(list) {
  localStorage.setItem('jnaver_posts', JSON.stringify(list));
}

function getPost(id) {
  return getPosts().find(p => p.id === Number(id));
}

function deletePost(id) {
  savePosts(getPosts().filter(p => p.id !== Number(id)));
}

function incrementViews(id) {
  const list = getPosts();
  const post = list.find(p => p.id === Number(id));
  if (!post) return;
  post.views = (post.views || 0) + 1;
  savePosts(list);
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

/* ── 게시물 렌더링 (카테고리 필터 + 조회수 순) ── */
function renderPosts() {
  const grid    = document.getElementById('newsGrid');
  const titleEl = document.getElementById('postsSectionTitle');
  if (!grid) return;

  // 섹션 타이틀 동적 변경
  if (titleEl) {
    titleEl.textContent = _selectedCat ? `${_selectedCat} 게시물` : '인기 게시물';
  }

  let posts = getPosts();
  if (_selectedCat) posts = posts.filter(p => p.category === _selectedCat);
  posts = posts.slice().sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 12);

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
        <span class="news-date">${formatDate(p.createdAt)}</span>
      </div>
      <h3 class="news-title">${escapeHTML(p.title)}</h3>
      <p class="news-desc">${escapeHTML(truncate(p.content, 70))}</p>
      <div class="post-meta">by ${escapeHTML(p.authorNickname)} · 조회 ${p.views || 0}</div>
    </a>
  `).join('');
}

/* ── 카테고리 관리 (대시보드) ── */
function renderCategories() {
  const ul = document.getElementById('catList');
  if (!ul) return;

  const cats = getCategories();
  if (cats.length === 0) {
    ul.innerHTML = '<li class="cat-empty">카테고리가 없습니다.</li>';
    return;
  }

  ul.innerHTML = cats.map(c => `
    <li class="cat-item">
      <span class="cat-name">${escapeHTML(c)}</span>
      <button class="cat-del" data-name="${escapeHTML(c)}">×</button>
    </li>
  `).join('');

  ul.querySelectorAll('.cat-del').forEach(btn => {
    btn.addEventListener('click', () => {
      saveCategories(getCategories().filter(c => c !== btn.dataset.name));
      renderCategories();
    });
  });
}

function initCategoryManager() {
  renderCategories();

  const input  = document.getElementById('catInput');
  const addBtn = document.getElementById('catAddBtn');
  if (!input || !addBtn) return;

  addBtn.addEventListener('click', () => {
    const name = input.value.trim();
    if (!name) return;

    const cats = getCategories();
    if (cats.includes(name)) {
      showToast('이미 있는 카테고리예요.', 'red');
      return;
    }

    cats.push(name);
    saveCategories(cats);
    input.value = '';
    renderCategories();
    showToast(`"${name}" 카테고리가 추가됐어요.`, 'green');
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addBtn.click(); }
  });
}

/* ── 글쓰기 페이지 ── */
async function initPostWrite() {
  const session = await getSession();
  if (!session) {
    showToast('로그인이 필요해요.', 'red');
    setTimeout(() => { window.location.href = 'login.html'; }, 1200);
    return;
  }

  const form = document.getElementById('postWriteForm');
  if (!form) return;

  const cat = form.category;
  const cats = getCategories();

  if (cats.length === 0) {
    cat.innerHTML = '<option value="" disabled selected>카테고리가 없습니다</option>';
    cat.disabled = true;
    const hint = document.getElementById('catHint');
    if (hint) hint.classList.remove('hidden');
  } else {
    cats.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      cat.appendChild(opt);
    });
  }

  const submitBtn = form.querySelector('[type=submit]');
  submitBtn.dataset.label = submitBtn.textContent;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const title    = form.title.value.trim();
    const content  = form.content.value.trim();
    const category = form.category.value;

    if (!title || !content) {
      showToast('제목과 내용을 모두 입력해 주세요.', 'red');
      return;
    }

    const u = session.user;
    const list = getPosts();
    list.unshift({
      id: Date.now(),
      title,
      content,
      category,
      authorId:       u.id,
      authorEmail:    u.email,
      authorNickname: u.user_metadata?.nickname || u.email,
      createdAt:      new Date().toISOString(),
      views:          0,
    });
    savePosts(list);

    showToast('게시물이 등록됐어요! 🎉', 'green');
    setTimeout(() => { window.location.href = 'index.html'; }, 1000);
  });
}

/* ── 게시물 상세 페이지 ── */
async function initPostDetail() {
  const session = await getSession();
  updateNav(session);

  document.getElementById('navLogout')?.addEventListener('click', async (e) => {
    e.preventDefault();
    await authSignOut();
    location.reload();
  });

  const id = new URLSearchParams(location.search).get('id');
  const wrap = document.getElementById('postContent');

  if (!id) { wrap.innerHTML = '<p class="news-empty">게시물을 찾을 수 없어요.</p>'; return; }

  incrementViews(id);
  const post = getPost(id);
  if (!post) { wrap.innerHTML = '<p class="news-empty">게시물을 찾을 수 없어요.</p>'; return; }

  document.getElementById('postCategory').textContent = post.category;
  document.getElementById('postTitle').textContent    = post.title;
  document.getElementById('postAuthor').textContent   = post.authorNickname;
  document.getElementById('postDate').textContent     = formatDate(post.createdAt);
  document.getElementById('postViews').textContent    = post.views || 0;
  document.getElementById('postBody').textContent     = post.content;

  if (session && session.user.id === post.authorId) {
    const delBtn = document.getElementById('postDelBtn');
    delBtn.classList.remove('hidden');
    delBtn.addEventListener('click', () => {
      if (!confirm('정말 삭제하시겠어요?')) return;
      deletePost(id);
      window.location.href = 'index.html';
    });
  }
}

/* ────────────────────────────────────────
   Page: Index
──────────────────────────────────────── */
async function initIndex() {
  const session = await getSession();
  updateNav(session);
  initCategorySection();
  renderPosts();
  initNotices(!!session);

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

/* ────────────────────────────────────────
   Page: Signup
──────────────────────────────────────── */
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
      // 이메일 인증을 끄려면 Supabase 대시보드 → Authentication → Providers → Email → Confirm email 해제
      setTimeout(() => { window.location.href = 'login.html'; }, 2200);
    } catch (err) {
      showError('err-global', toKoreanError(err));
    } finally {
      setLoading(submitBtn, false);
    }
  });
}

/* ────────────────────────────────────────
   Page: Login
──────────────────────────────────────── */
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

/* ────────────────────────────────────────
   Page: Dashboard (세션 유지/로그아웃)
──────────────────────────────────────── */
async function initDashboard() {
  // 세션 확인 — 없으면 로그인 페이지로
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

  initDashCategorySection();
  initCategoryManager();

  // 로그아웃 버튼 (본문)
  document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    await authSignOut();
    window.location.href = 'index.html';
  });

  // 로그아웃 버튼 (헤더)
  document.getElementById('navLogout')?.addEventListener('click', async (e) => {
    e.preventDefault();
    await authSignOut();
    window.location.href = 'index.html';
  });

  // 토큰 갱신 등 세션 변화 감지
  supabaseClient.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') window.location.href = 'index.html';
  });
}
