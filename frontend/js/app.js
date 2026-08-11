// ===== js/app.js =====
document.addEventListener('DOMContentLoaded', () => {
    if (typeof Auth !== 'undefined') {
        Auth.init();
        if (Auth.isLoggedIn()) {
            initApp();
        } else {
            document.getElementById('login-section')?.classList.remove('hidden');
            document.getElementById('app-section')?.classList.add('hidden');
        }
    } else {
        document.getElementById('login-section')?.classList.add('hidden');
        document.getElementById('app-section')?.classList.remove('hidden');
        initApp();
    }

    document.getElementById('login-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const key = document.getElementById('license-key-input')?.value.trim();
        if (key) {
            if (typeof Auth !== 'undefined' && Auth.login) {
                Auth.login(key);
            } else {
                document.getElementById('login-section')?.classList.add('hidden');
                document.getElementById('app-section')?.classList.remove('hidden');
                initApp();
            }
        }
    });
});

let currentFolderId = null;
let folderBreadcrumbMap = {};

function initApp() {
    document.getElementById('login-section')?.classList.add('hidden');
    document.getElementById('app-section')?.classList.remove('hidden');

    loadContent(null);

    // Navigation & Drawer events
    document.getElementById('drawer-toggle')?.addEventListener('click', toggleDrawer);
    document.getElementById('drawer-close')?.addEventListener('click', closeDrawer);
    document.getElementById('drawer-overlay')?.addEventListener('click', closeDrawer);
    
    // FAB Events
    document.getElementById('fab-plus')?.addEventListener('click', toggleFabModal);
    document.getElementById('fab-modal-overlay')?.addEventListener('click', closeFabModal);
    document.getElementById('fab-new-folder')?.addEventListener('click', () => {
        closeFabModal();
        handleCreateFolder();
    });
    document.getElementById('fab-upload-pdf')?.addEventListener('click', () => {
        closeFabModal();
        document.getElementById('file-input')?.click();
    });
    document.getElementById('file-input')?.addEventListener('change', handleFileUpload);

    // PDF Modal events
    document.getElementById('close-pdf-btn')?.addEventListener('click', closePdfModal);
    document.getElementById('bottom-sheet-overlay')?.addEventListener('click', closeBottomSheet);
}

// ----- Drawer Controls -----
function toggleDrawer() {
    document.getElementById('drawer')?.classList.toggle('open');
    document.getElementById('drawer-overlay')?.classList.toggle('active');
}
function closeDrawer() {
    document.getElementById('drawer')?.classList.remove('open');
    document.getElementById('drawer-overlay')?.classList.remove('active');
}

// ----- FAB Actions -----
function toggleFabModal() {
    document.getElementById('fab-modal')?.classList.toggle('open');
    document.getElementById('fab-modal-overlay')?.classList.toggle('active');
}
function closeFabModal() {
    document.getElementById('fab-modal')?.classList.remove('open');
    document.getElementById('fab-modal-overlay')?.classList.remove('active');
}

// ----- Bottom Sheet Actions -----
function openBottomSheet(items) {
    const sheet = document.getElementById('bottom-sheet');
    const overlay = document.getElementById('bottom-sheet-overlay');
    const content = document.getElementById('bottom-sheet-content');

    if (!sheet || !content) return;

    content.innerHTML = items.map((item, idx) => `
        <button class="bottom-sheet-item ${item.danger ? 'danger' : ''}" data-index="${idx}">
            <i class="${item.icon}"></i>
            <span>${escapeHtml(item.label)}</span>
        </button>
    `).join('');

    content.querySelectorAll('.bottom-sheet-item').forEach((btn) => {
        const idx = parseInt(btn.dataset.index, 10);
        btn.onclick = () => {
            closeBottomSheet();
            if (typeof items[idx].action === 'function') items[idx].action();
        };
    });

    sheet.classList.add('open');
    overlay?.classList.add('active');
}

function closeBottomSheet() {
    document.getElementById('bottom-sheet')?.classList.remove('open');
    document.getElementById('bottom-sheet-overlay')?.classList.remove('active');
}

// ----- Load Directory Content -----
async function loadContent(folderId = null, folderName = '') {
    currentFolderId = folderId;
    const container = document.getElementById('file-list-container');
    if (!container) return;

    if (folderId !== null && folderName) {
        folderBreadcrumbMap[folderId] = folderName;
    }
    
    const path = folderId ? `/storage/emulated/0/${folderBreadcrumbMap[folderId] || 'Folder'}/` : '/storage/emulated/0/';
    const breadcrumbEl = document.getElementById('breadcrumb-path');
    if (breadcrumbEl) breadcrumbEl.textContent = path;

    container.innerHTML = `
        <div class="loading-state">
            <i class="fa-solid fa-spinner fa-spin"></i>
            <span>Loading...</span>
        </div>
    `;

    try {
        const url = folderId ? `/api/folders/${folderId}` : '/api/folders/root';
        const res = await fetch(url, { headers: getAuthHeaders() });
        
        if (!res.ok) throw new Error('API Error');
        const data = await res.json();
        renderFileList(container, data, folderId);
    } catch (err) {
        console.warn('Backend API connection pending/failed. Displaying status fallback.');
        container.innerHTML = `
            <div class="loading-state" style="color:#888;">
                <i class="fa-regular fa-folder-open" style="font-size:2rem; margin-bottom:8px;"></i>
                <span>No files found or server offline</span>
            </div>
        `;
    }
}

function renderFileList(container, data, folderId) {
    container.innerHTML = '';

    if (folderId !== null) {
        const backRow = document.createElement('div');
        backRow.className = 'file-row';
        backRow.innerHTML = `
            <div class="file-row-left" onclick="loadContent(null)">
                <div class="icon-wrap"><i class="fa-solid fa-folder" style="color:#aaa;"></i></div>
                <div class="file-row-info"><div class="file-row-name">..</div></div>
            </div>
        `;
        container.appendChild(backRow);
    }

    const folders = data.folders || [];
    const files = data.files || [];

    if (folders.length === 0 && files.length === 0) {
        container.innerHTML += `
            <div class="loading-state" style="color:#777;">
                <i class="fa-regular fa-folder-open"></i>
                <span>Folder is empty</span>
            </div>
        `;
        return;
    }

    // Render Folders
    folders.forEach(f => {
        const row = document.createElement('div');
        row.className = 'file-row';
        row.innerHTML = `
            <div class="file-row-left">
                <div class="icon-wrap"><i class="fa-solid fa-folder" style="color:#f1c40f;"></i></div>
                <div class="file-row-info">
                    <div class="file-row-name"></div>
                </div>
            </div>
            <div class="file-row-actions">
                <button class="action-btn"><i class="fa-solid fa-ellipsis-vertical"></i></button>
            </div>
        `;
        
        // Safe Text Assignment (Urdu / Arabic friendly)
        row.querySelector('.file-row-name').textContent = f.name;
        row.querySelector('.file-row-left').onclick = () => loadContent(f.id, f.name);
        row.querySelector('.action-btn').onclick = (e) => {
            e.stopPropagation();
            showFolderActions(f.id, f.name);
        };
        container.appendChild(row);
    });

    // Render Files
    files.forEach(f => {
        const row = document.createElement('div');
        row.className = 'file-row';
        row.innerHTML = `
            <div class="file-row-left">
                <div class="icon-wrap"><i class="fa-solid fa-file-pdf" style="color:#e74c3c;"></i></div>
                <div class="file-row-info">
                    <div class="file-row-name"></div>
                </div>
            </div>
            <div class="file-row-actions">
                <button class="action-btn"><i class="fa-solid fa-ellipsis-vertical"></i></button>
            </div>
        `;

        // Safe Text Assignment (Urdu / Arabic friendly)
        row.querySelector('.file-row-name').textContent = f.name;
        row.querySelector('.file-row-left').onclick = () => openPdf(f.cloudinary_url, f.name);
        row.querySelector('.action-btn').onclick = (e) => {
            e.stopPropagation();
            showFileActions(f.id, f.name, f.cloudinary_url);
        };
        container.appendChild(row);
    });
}

// ----- Actions Menu -----
function showFileActions(id, name, url) {
    const items = [
        { icon: 'fa-regular fa-eye', label: 'Open', action: () => openPdf(url, name) },
        { icon: 'fa-solid fa-pen', label: 'Rename', action: () => handleRename(id, name, 'file') },
        { icon: 'fa-solid fa-download', label: 'Download', action: () => downloadFile(url, name) },
        { icon: 'fa-regular fa-trash-can', label: 'Delete', danger: true, action: () => handleDelete(id, 'file') }
    ];
    openBottomSheet(items);
}

function showFolderActions(id, name) {
    const items = [
        { icon: 'fa-regular fa-folder-open', label: 'Open', action: () => loadContent(id, name) },
        { icon: 'fa-solid fa-pen', label: 'Rename', action: () => handleRename(id, name, 'folder') },
        { icon: 'fa-regular fa-trash-can', label: 'Delete', danger: true, action: () => handleDelete(id, 'folder') }
    ];
    openBottomSheet(items);
}

// ----- Operations (Rename, Delete, Create, Upload) -----
async function handleRename(id, oldName, type) {
    const newName = prompt('Enter new name:', oldName);
    if (!newName || newName.trim() === '' || newName === oldName) return;

    try {
        const endpoint = type === 'file' ? `/api/files/${id}` : `/api/folders/${id}`;
        const res = await fetch(endpoint, {
            method: 'PUT',
            headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newName.trim() })
        });
        if (res.ok) loadContent(currentFolderId);
    } catch (e) {
        alert('Rename action sent.');
    }
}

async function handleDelete(id, type) {
    if (!confirm('Are you sure you want to delete this?')) return;
    try {
        const endpoint = type === 'file' ? `/api/files/${id}` : `/api/folders/${id}`;
        const res = await fetch(endpoint, { method: 'DELETE', headers: getAuthHeaders() });
        if (res.ok) loadContent(currentFolderId);
    } catch (e) {
        alert('Delete request sent.');
    }
}

async function handleCreateFolder() {
    const name = prompt('Folder Name:');
    if (!name || !name.trim()) return;
    try {
        await fetch('/api/folders', {
            method: 'POST',
            headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name.trim(), parent_id: currentFolderId })
        });
        loadContent(currentFolderId);
    } catch (e) { console.error(e); }
}

async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('pdf', file);
    if (currentFolderId) formData.append('folder_id', currentFolderId);

    try {
        await fetch('/api/files/upload', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: formData
        });
        loadContent(currentFolderId);
    } catch (e) { console.error(e); }
    e.target.value = '';
}

// ----- PDF Engine -----
function openPdf(url, title) {
    if (!url) {
        alert('Invalid File URL');
        return;
    }
    const titleEl = document.getElementById('pdf-title');
    if (titleEl) titleEl.textContent = title;

    const embedUrl = `https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=true`;
    
    const iframe = document.getElementById('pdf-frame');
    if (iframe) iframe.src = embedUrl;

    const openBtn = document.getElementById('pdf-open-new');
    if (openBtn) openBtn.href = url;

    const downloadBtn = document.getElementById('pdf-download-link');
    if (downloadBtn) {
        downloadBtn.href = url;
        downloadBtn.setAttribute('download', title || 'file.pdf');
    }

    document.getElementById('pdf-modal')?.classList.add('active');
}

function downloadFile(url, title) {
    const a = document.createElement('a');
    a.href = url;
    a.download = title || 'download.pdf';
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

function closePdfModal() {
    document.getElementById('pdf-modal')?.classList.remove('active');
    const iframe = document.getElementById('pdf-frame');
    if (iframe) iframe.src = 'about:blank';
}

// ----- Helpers -----
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function getAuthHeaders() {
    return { 'Authorization': `Bearer ${localStorage.getItem('authToken') || 'mock-token'}` };
}

window.loadContent = loadContent;
window.openPdf = openPdf;
