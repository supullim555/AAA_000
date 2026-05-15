/* ════════════════════════════════════════
   admin.js — Open Azitfh 운영자 패널
   app.js의 getSession, authSignOut, showToast,
   escapeHTML, formatDate, insertNotice, deleteNotice, getNotices 재사용
════════════════════════════════════════ */

/* ── 탭 전환 ── */
function initTabs() {
  document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('tab' + cap(tab.dataset.tab)).classList.add('active');
    });
  });
}

function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

/* ── 신고된(hidden) 게시물 목록 ── */
async function loadReportedPosts() {
  const wrap = document.getElementById('reportedList');

  const { data: posts, error } = await supabaseClient
    .from('posts')
    .select('*')
    .eq('hidden', true)
    .order('created_at', { ascending: false });

  if (error || !posts || posts.length === 0) {
    wrap.innerHTML = '<p class="admin-empty">숨겨진 게시물이 없습니다.</p>';
    return;
  }

  // 각 게시물의 신고 수 조회
  const postIds = posts.map(p => p.id);
  const { data: reports } = await supabaseClient
    .from('reports')
    .select('post_id')
    .in('post_id', postIds);

  const reportCounts = {};
  (reports || []).forEach(r => {
    reportCounts[r.post_id] = (reportCounts[r.post_id] || 0) + 1;
  });

  wrap.innerHTML = posts.map(p => `
    <div class="admin-card" id="post-card-${p.id}">
      <div class="admin-card-top">
        <div class="admin-card-body">
          <div class="admin-card-title">
            ${escapeHTML(p.title)}
            <span class="admin-report-count">신고 ${reportCounts[p.id] || 0}건</span>
          </div>
          <div class="admin-card-meta">
            <span class="admin-badge-hidden">숨김</span>
            &nbsp;${escapeHTML(p.category)} · ${escapeHTML(p.author_nickname)} · ${formatDate(p.created_at)}
          </div>
          <div class="admin-card-meta" style="margin-top:6px;white-space:pre-wrap;line-height:1.5">
            ${escapeHTML(p.content.slice(0, 120))}${p.content.length > 120 ? '…' : ''}
          </div>
        </div>
      </div>
      <div class="admin-card-actions">
        <button class="admin-btn admin-btn-restore" onclick="doUnhide('${p.id}')">복원</button>
        <button class="admin-btn admin-btn-delete"  onclick="doAdminDelete('${p.id}')">영구 삭제</button>
      </div>
    </div>
  `).join('');
}

async function doUnhide(postId) {
  try {
    const { error } = await supabaseClient.rpc('unhide_post', { p_post_id: postId });
    if (error) throw error;
    showToast('게시물이 복원됐어요.', 'green');
    document.getElementById(`post-card-${postId}`)?.remove();
    checkEmpty('reportedList', '숨겨진 게시물이 없습니다.');
  } catch {
    showToast('복원 실패', 'red');
  }
}

async function doAdminDelete(postId) {
  if (!confirm('영구 삭제하면 되돌릴 수 없어요. 계속할까요?')) return;
  try {
    const { error } = await supabaseClient.rpc('admin_delete_post', { p_post_id: postId });
    if (error) throw error;
    showToast('게시물이 삭제됐어요.', 'green');
    document.getElementById(`post-card-${postId}`)?.remove();
    checkEmpty('reportedList', '숨겨진 게시물이 없습니다.');
  } catch {
    showToast('삭제 실패', 'red');
  }
}

function checkEmpty(containerId, msg) {
  const wrap = document.getElementById(containerId);
  if (wrap && wrap.children.length === 0) {
    wrap.innerHTML = `<p class="admin-empty">${msg}</p>`;
  }
}

/* ── 관리자 목록 ── */
async function loadAdmins() {
  const wrap = document.getElementById('adminsList');

  const { data: admins, error } = await supabaseClient
    .from('admins')
    .select('*')
    .order('granted_at', { ascending: true });

  if (error || !admins || admins.length === 0) {
    wrap.innerHTML = '<p class="admin-empty">관리자가 없습니다.</p>';
    return;
  }

  const session = await getSession();

  wrap.innerHTML = admins.map(a => `
    <div class="admin-card" id="admin-card-${a.user_id}">
      <div class="admin-card-top">
        <div class="admin-card-body">
          <div class="admin-card-title">${escapeHTML(a.email)}</div>
          <div class="admin-card-meta">등록일 ${formatDate(a.granted_at)}</div>
        </div>
        ${a.user_id !== session?.user?.id ? `
          <button class="admin-btn admin-btn-delete" onclick="doRemoveAdmin('${a.user_id}')">제거</button>
        ` : '<span style="font-size:12px;color:var(--text-light)">(본인)</span>'}
      </div>
    </div>
  `).join('');
}

async function doAddAdmin() {
  const input = document.getElementById('adminEmailInput');
  const email = input.value.trim();
  if (!email) return;

  try {
    const { data, error } = await supabaseClient.rpc('add_admin_by_email', { target_email: email });
    if (error) throw error;
    if (!data.success) {
      showToast(data.reason === 'user_not_found' ? '가입된 계정이 없어요.' : '추가 실패', 'red');
      return;
    }
    input.value = '';
    showToast(`${email} 님을 관리자로 추가했어요.`, 'green');
    await loadAdmins();
  } catch {
    showToast('추가 실패', 'red');
  }
}

async function doRemoveAdmin(userId) {
  if (!confirm('이 관리자를 제거할까요?')) return;
  try {
    const { error } = await supabaseClient.rpc('remove_admin', { target_user_id: userId });
    if (error) throw error;
    showToast('관리자가 제거됐어요.', 'green');
    document.getElementById(`admin-card-${userId}`)?.remove();
    checkEmpty('adminsList', '관리자가 없습니다.');
  } catch (err) {
    const msg = err.message?.includes('last admin') ? '마지막 관리자는 제거할 수 없어요.' : '제거 실패';
    showToast(msg, 'red');
  }
}

/* ── 공지사항 관리 ── */
async function loadNoticesAdmin() {
  const wrap = document.getElementById('noticesAdminList');
  const list = await getNotices();

  if (list.length === 0) {
    wrap.innerHTML = '<p class="admin-empty">공지사항이 없습니다.</p>';
    return;
  }

  wrap.innerHTML = list.map(n => `
    <div class="admin-card" id="notice-card-${n.id}">
      <div class="admin-card-top">
        <div class="admin-card-body">
          <div class="admin-card-title">${escapeHTML(n.title)}</div>
          <div class="admin-card-meta">${n.date}</div>
        </div>
        <button class="admin-btn admin-btn-delete" onclick="doDeleteNoticeAdmin('${n.id}')">삭제</button>
      </div>
    </div>
  `).join('');
}

async function doAddNoticeAdmin() {
  const input = document.getElementById('noticeAdminInput');
  const title = input.value.trim();
  if (!title) return;
  try {
    await insertNotice({ title, date: new Date().toLocaleDateString('ko-KR') });
    input.value = '';
    showToast('공지가 등록됐어요.', 'green');
    await loadNoticesAdmin();
  } catch {
    showToast('공지 등록 실패', 'red');
  }
}

async function doDeleteNoticeAdmin(id) {
  try {
    await deleteNotice(id);
    showToast('공지가 삭제됐어요.', 'green');
    document.getElementById(`notice-card-${id}`)?.remove();
    checkEmpty('noticesAdminList', '공지사항이 없습니다.');
  } catch {
    showToast('삭제 실패', 'red');
  }
}

/* ── 진입점 ── */
async function initAdminPanel() {
  const session = await getSession();
  const admin   = session ? await isAdmin() : false;

  if (!admin) {
    document.getElementById('accessDenied').classList.remove('hidden');
    return;
  }

  document.getElementById('adminPanel').classList.remove('hidden');
  initTabs();

  // 탭별 데이터 로드
  await Promise.all([loadReportedPosts(), loadAdmins(), loadNoticesAdmin()]);

  // 관리자 추가 버튼
  document.getElementById('adminAddBtn')?.addEventListener('click', doAddAdmin);
  document.getElementById('adminEmailInput')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') doAddAdmin();
  });

  // 공지 추가 버튼
  document.getElementById('noticeAdminAddBtn')?.addEventListener('click', doAddNoticeAdmin);
  document.getElementById('noticeAdminInput')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') doAddNoticeAdmin();
  });

  // 로그아웃
  document.getElementById('adminLogoutBtn')?.addEventListener('click', async () => {
    await authSignOut();
    window.location.href = 'index.html';
  });
}
