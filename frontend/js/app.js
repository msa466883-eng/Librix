// ===== Kutub Cloud frontend logic =====
// Everything talks to /api/* on the same server (see backend/server.js).

const API = '/api';

let allFolders = [];
let currentFolderId = null; // null = root level
let editTarget = null;      // { type: 'folder'|'file', id }

const el = (id) => document.getElementById(id);

// ---------- Boot ----------
window.addEventListener('DOMContentLoaded', () => {
  if (Auth.isLoggedIn()) {
    showApp();
  } else {
    showLogin();
  }
  bindEvents();
});

function showLogin() {
  el('login-screen').classList.remove('hidden');
  el('app-screen').classList.add('hidden');
}

function showApp() {
  el('login-screen').classList.add('hidden');
  el('app-screen').classList.remove('hidden');
  loadEverything();
}

// ---------- Login ----------
function bindEvents() {
  el('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = el('login-username').value.trim();
    const password = el('login-password').value;
    el('login-error').textContent = '';

    try {
      const res = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login fail hua');
      Auth.setToken(data.token);
      showApp();
    } catch (err) {
      el('login-error').textContent = err.message;
    }
  });

  el('logout-btn').addEventListener('click', () => {
    Auth.clearToken();
    showLogin();
  });

  el('search-input').addEventListener('input', debounce(renderGrid, 250));

  el('new-folder-btn').addEventListener('click', () => {
    el('folder-name-input').value = '';
    el('folder-musannif-input').value = '';
    el('folder-modal').classList.remove('hidden');
  });
  el('folder-cancel-btn').addEventListener('click', () => el('folder-modal').classList.add('hidden'));
  el('folder-save-btn').addEventListener('click', createFolder);

  el('upload-btn').addEventListener('click', () => {
    el('upload-file-input').value = '';
    el('upload-name-input').value = '';
    el('upload-progress').textContent = '';
    el('upload-modal').classList.remove('hidden');
  });
  el('upload-cancel-btn').addEventListener('click', () => el('upload-modal').classList.add('hidden'));
  el('upload-save-btn').addEventListener('click', uploadFile);

  el('edit-cancel-btn').addEventListener('click', () => el('edit-modal').classList.add('hidden'));
  el('edit-save-btn').addEventListener('click', saveEdit);
  el('edit-delete-btn').addEventListener('click', deleteEditTarget);

  el('viewer-close-btn').addEventListener('click', () => el('viewer-modal').classList.add('hidden'));
}

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

function authFetch(url, options = {}) {
  options.headers = { ...(options.headers || {}), ...Auth.authHeaders() };
  return fetch(url, options).then(async (res) => {
    if (res.status === 401) {
      Auth.clearToken();
      showLogin();
      throw new Error('Session khatam ho gaya, dobara login karo');
    }
    return res;
  });
}

// ---------- Load data ----------
async function loadEverything() {
  await Promise.all([loadFolders(), loadStorageUsage()]);
  renderGrid();
}

async function loadFolders() {
  const res = await authFetch(`${API}/folders`);
  allFolders = await res.json();
}

async function loadStorageUsage() {
  const res = await authFetch(`${API}/files/storage-usage`);
  const data = await res.json();
  el('storage-usage').textContent = `💾 ${formatBytes(data.total_bytes)}`;
}

function formatBytes(bytes) {
  if (!bytes) return '0 MB';
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

// ---------- Rendering ----------
async function renderGrid() {
  const query = el('search-input').value.trim();
  const grid = el('content-grid');
  grid.innerHTML = '';

  renderBreadcrumb();

  if (query) {
    // Search mode: search files by name across all folders, plus matching folders/musannif.
    const res = await authFetch(`${API}/files?q=${encodeURIComponent(query)}`);
    const files = await res.json();
    const matchingFolders = allFolders.filter(
      (f) => f.name.toLowerCase().includes(query.toLowerCase()) ||
             (f.musannif && f.musannif.toLowerCase().includes(query.toLowerCase()))
    );

    if (files.length === 0 && matchingFolders.length === 0) {
      grid.innerHTML = '<div class="empty-state">Kuch nahi mila</div>';
      return;
    }
    matchingFolders.forEach((f) => grid.appendChild(folderCard(f)));
    files.forEach((f) => grid.appendChild(fileCard(f)));
    return;
  }

  const subFolders = allFolders.filter((f) => f.parent_id === currentFolderId);
  const res = await authFetch(`${API}/files?folder_id=${currentFolderId ?? ''}`);
  const files = currentFolderId ? await res.json() : [];

  if (subFolders.length === 0 && files.length === 0) {
    grid.innerHTML = '<div class="empty-state">Ye folder khali hai</div>';
    return;
  }

  subFolders.forEach((f) => grid.appendChild(folderCard(f)));
  files.forEach((f) => grid.appendChild(fileCard(f)));
}

function renderBreadcrumb() {
  const crumb = el('breadcrumb');
  const path = [];
  let id = currentFolderId;
  while (id) {
    const f = allFolders.find((x) => x.id === id);
    if (!f) break;
    path.unshift(f);
    id = f.parent_id;
  }
  crumb.innerHTML = '';
  const home = document.createElement('span');
  home.textContent = '🏠 Home';
  home.onclick = () => { currentFolderId = null; renderGrid(); };
  crumb.appendChild(home);

  path.forEach((f) => {
    crumb.appendChild(document.createTextNode(' / '));
    const span = document.createElement('span');
    span.textContent = f.name;
    span.onclick = () => { currentFolderId = f.id; renderGrid(); };
    crumb.appendChild(span);
  });
}

function folderCard(folder) {
  const card = document.createElement('div');
  card.className = 'card';
  card.innerHTML = `
    <span class="edit-dot" data-edit="folder-${folder.id}">⋮</span>
    <span class="icon">📁</span>
    <div class="label">${escapeHtml(folder.name)}</div>
    ${folder.musannif ? `<div class="sub-label">✍️ ${escapeHtml(folder.musannif)}</div>` : ''}
  `;
  card.addEventListener('click', (e) => {
    if (e.target.dataset.edit) return;
    currentFolderId = folder.id;
    el('search-input').value = '';
    renderGrid();
  });
  card.querySelector('.edit-dot').addEventListener('click', (e) => {
    e.stopPropagation();
    openEdit('folder', folder);
  });
  return card;
}

function fileCard(file) {
  const card = document.createElement('div');
  card.className = 'card';
  card.innerHTML = `
    <span class="edit-dot" data-edit="file-${file.id}">⋮</span>
    <span class="icon">📕</span>
    <div class="label">${escapeHtml(file.name)}</div>
    <div class="sub-label">${formatBytes(file.size_bytes)}</div>
  `;
  card.addEventListener('click', (e) => {
    if (e.target.dataset.edit) return;
    openViewer(file);
  });
  card.querySelector('.edit-dot').addEventListener('click', (e) => {
    e.stopPropagation();
    openEdit('file', file);
  });
  return card;
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// ---------- Folder create ----------
async function createFolder() {
  const name = el('folder-name-input').value.trim();
  const musannif = el('folder-musannif-input').value.trim();
  if (!name) return;

  await authFetch(`${API}/folders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, musannif, parent_id: currentFolderId }),
  });

  el('folder-modal').classList.add('hidden');
  await loadFolders();
  renderGrid();
}

// ---------- Upload ----------
async function uploadFile() {
  const fileInput = el('upload-file-input');
  const name = el('upload-name-input').value.trim();
  const file = fileInput.files[0];
  if (!file) {
    el('upload-progress').textContent = 'Pehle PDF chuno';
    return;
  }

  el('upload-progress').textContent = 'Upload ho raha hai...';
  el('upload-save-btn').disabled = true;

  const formData = new FormData();
  formData.append('file', file);
  formData.append('name', name);
  formData.append('folder_id', currentFolderId ?? '');

  try {
    const res = await authFetch(`${API}/files/upload`, {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    el('upload-modal').classList.add('hidden');
    await loadStorageUsage();
    renderGrid();
  } catch (err) {
    el('upload-progress').textContent = err.message;
  } finally {
    el('upload-save-btn').disabled = false;
  }
}

// ---------- Rename / Move / Delete ----------
function openEdit(type, item) {
  editTarget = { type, id: item.id };
  el('edit-modal-title').textContent = type === 'folder' ? 'Folder Edit' : 'Kitab Edit';
  el('edit-name-input').value = item.name;

  const select = el('edit-move-select');
  select.innerHTML = '<option value="">🏠 Home (top level)</option>';
  allFolders
    .filter((f) => f.id !== item.id) // can't move a folder into itself
    .forEach((f) => {
      const opt = document.createElement('option');
      opt.value = f.id;
      opt.textContent = f.name;
      if (item.folder_id === f.id || item.parent_id === f.id) opt.selected = true;
      select.appendChild(opt);
    });

  el('edit-modal').classList.remove('hidden');
}

async function saveEdit() {
  const { type, id } = editTarget;
  const name = el('edit-name-input').value.trim();
  const moveTo = el('edit-move-select').value || null;
  if (!name) return;

  if (type === 'folder') {
    await authFetch(`${API}/folders/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    await authFetch(`${API}/folders/${id}/move`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parent_id: moveTo }),
    });
  } else {
    await authFetch(`${API}/files/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    await authFetch(`${API}/files/${id}/move`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder_id: moveTo }),
    });
  }

  el('edit-modal').classList.add('hidden');
  await loadFolders();
  renderGrid();
}

async function deleteEditTarget() {
  const { type, id } = editTarget;
  const confirmMsg = type === 'folder'
    ? 'Ye folder aur isme jo bhi hai, sab delete ho jayega. Pakka?'
    : 'Ye kitab delete karni hai?';
  if (!confirm(confirmMsg)) return;

  const endpoint = type === 'folder' ? `${API}/folders/${id}` : `${API}/files/${id}`;
  await authFetch(endpoint, { method: 'DELETE' });

  el('edit-modal').classList.add('hidden');
  await loadFolders();
  await loadStorageUsage();
  renderGrid();
}

// ---------- PDF Viewer ----------
function openViewer(file) {
  el('viewer-title').textContent = file.name;
  el('viewer-frame').src = file.cloudinary_url;
  el('viewer-download').href = file.cloudinary_url;
  el('viewer-download').setAttribute('download', file.name);
  el('viewer-modal').classList.remove('hidden');
}
