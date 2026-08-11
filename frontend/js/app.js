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
        console.warn('Auth not defined, using fallback login state');
        document.getElementById('login-section')?.classList.add('hidden');
        document.getElementById('app-section')?.classList.remove('hidden');
        initApp();
    }

    document.getElementById('login-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const key = document.getElementById('license-key-input').value.trim();
        if (key.length > 0) {
            if (typeof Auth !== 'undefined' && Auth.login) {
                Auth.login(key);
            } else {
                document.getElementById('login-section').classList.add('hidden');
                document.getElementById('app-section').classList.remove('hidden');
                initApp();
            }
        } else {
            const errorElement = document.getElementById('login-error');
            if (errorElement) {
                errorElement.classList.remove('hidden');
                document.getElementById('error-text').textContent = 'Please enter a license key.';
            }
        }
    });
});

let currentFolderId = null;
let currentItemForSheet = null;
let folderBreadcrumbMap = {};

function initApp() {
    document.getElementById('login-section')?.classList.add('hidden');
    document.getElementById('app-section')?.classList.remove('hidden');

    loadContent(null);

    document.getElementById('drawer-toggle')?.addEventListener('click', toggleDrawer);
    document.getElementById('drawer-close')?.addEventListener('click', closeDrawer);
    document.getElementById('drawer-overlay')?.addEventListener('click', closeDrawer);
    document.getElementById('logout-btn-drawer')?.addEventListener('click', () => {
        if (typeof Auth !== 'undefined' && Auth.logout) {
            Auth.logout();
        } else {
            localStorage.clear();
            location.reload();
        }
    });

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

    document.getElementById('close-pdf-btn')?.addEventListener('click', closePdfModal);
    document.getElementById('pdf-modal')?.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closePdfModal();
    });

    document.getElementById('bottom-sheet-overlay')?.addEventListener('click', closeBottomSheet);
}

function toggleDrawer() {
    const drawer = document.getElementById('drawer');
    const overlay = document.getElementById('drawer-overlay');
    const isOpen = drawer.classList.contains('open');
    if (isOpen) {
        closeDrawer();
    } else {
        drawer.classList.add('open');
        overlay.classList.add('active');
        loadStats();
    }
}

function closeDrawer() {
    document.getElementById('drawer')?.classList.remove('open');
    document.getElementById('drawer-overlay')?.classList.remove('active');
}

function toggleFabModal() {
    const modal = document.getElementById('fab-modal');
    const overlay = document.getElementById('fab-modal-overlay');
    const isOpen = modal.classList.contains('open');
    if (isOpen) {
        closeFabModal();
    } else {
        modal.classList.add('open');
        overlay.classList.add('active');
    }
}

function closeFabModal() {
    document.getElementById('fab-modal')?.classList.remove('open');
    document.getElementById('fab-modal-overlay')?.classList.remove('active');
}

function openBottomSheet(items, title = 'Actions') {
    const sheet = document.getElementById('bottom-sheet');
    const overlay = document.getElementById('bottom-sheet-overlay');
    const content = document.getElementById('bottom-sheet-content');

    content.innerHTML = items.map((item, idx) => `
        <button class="bottom-sheet-item ${item.danger ? 'danger' : ''}" data-index="${idx}">
            <i class="${item.icon}"></i>
            ${escapeHtml(item.label)}
        </button>
    `).join('');

    content.querySelectorAll('.bottom-sheet-item').forEach((btn) => {
        const idx = parseInt(btn.dataset.index, 10);
        btn.addEventListener('click', () => {
            const action = items[idx].action;
            closeBottomSheet();
            if (typeof action === 'function') action();
        });
    });

    sheet.classList.add('open');
    overlay.classList.add('active');
}

function closeBottomSheet() {
    document.getElementById('bottom-sheet')?.classList.remove('open');
    document.getElementById('bottom-sheet-overlay')?.classList.remove('active');
    currentItemForSheet = null;
}

async function loadContent(folderId = null, folderName = '') {
    currentFolderId = folderId;
    const container = document.getElementById('file-list-container');

    let path = '/storage/emulated/0/';
    if (folderId !== null && folderId !== undefined) {
        if (folderName) {
            folderBreadcrumbMap[folderId] = folderName;
        }
        const currentFolderName = folderBreadcrumbMap[folderId] || `Folder_${folderId}`;
        path = `/storage/emulated/0/${currentFolderName}/`;
    }
    document.getElementById('breadcrumb-path').textContent = path;

    container.innerHTML = `
        <div class="loading-state">
            <i class="fa-solid fa-spinner fa-spin"></i>
            <span>Loading...</span>
        </div>
    `;

    try {
        const url = folderId ? `/api/folders/${folderId}` : '/api/folders/root';
        const res = await fetch(url, { headers: getAuthHeaders() });

        if (!res.ok) throw new Error(`Server status ${res.status}`);

        const data = await res.json();
        renderFileList(container, data, folderId);
        loadStats();

    } catch (err) {
        console.error('Load Error:', err);
        container.innerHTML = `
            <div class="loading-state" style="color:#e74c3c;">
                <i class="fa-solid fa-circle-exclamation"></i>
                <span>Failed to load content.</span>
            </div>
        `;
    }
}

function renderFileList(container, data, folderId) {
    container.innerHTML = '';

    if (folderId !== null && folderId !== undefined) {
        const backRow = document.createElement('div');
        backRow.className = 'file-row';
        backRow.innerHTML = `
            <div class="file-row-left" onclick="loadContent(null)">
                <div class="icon-wrap"><i class="fa-solid fa-folder" style="color:#aaa;"></i></div>
                <div class="file-row-info">
                    <div class="file-row-name">..</div>
                </div>
            </div>
        `;
        container.appendChild(backRow);
    }

    const folders = data.folders || [];
    const files = data.files || [];

    if (folders.length === 0 && files.length === 0) {
        container.innerHTML += `
            <div class="loading-state" style="color:#666; padding:40px 20px;">
                <i class="fa-regular fa-folder-open"></i>
                <span>Empty folder</span>
            </div>
        `;
        return;
    }

    folders.forEach(f => {
        const row = document.createElement('div');
        row.className = 'file-row';
        row.innerHTML = `
            <div class="file-row-left" onclick="loadContent(${f.id}, '${escapeJsString(f.name)}')">
                <div class="icon-wrap"><i class="fa-solid fa-folder" style="color:#f1c40f;"></i></div>
                <div class="file-row-info">
                    <div class="file-row-name">${escapeHtml(f.name)}</div>
                    <div class="file-row-date">${formatDate(f.created_at)}</div>
                </div>
            </div>
            <div class="file-row-actions">
                <button onclick="showFolderActions(${f.id}, '${escapeJsString(f.name)}', event)">
                    <i class="fa-solid fa-ellipsis-vertical"></i>
                </button>
            </div>
        `;
        container.appendChild(row);
    });

    files.forEach(f => {
        const row = document.createElement('div');
        row.className = 'file-row';
        row.innerHTML = `
            <div class="file-row-left" onclick="openPdf('${encodeURI(f.cloudinary_url)}', '${escapeJsString(f.name)}')">
                <div class="icon-wrap"><i class="fa-solid fa-file-pdf" style="color:#e74c3c;"></i></div>
                <div class="file-row-info">
                    <div class="file-row-name">${escapeHtml(f.name)}</div>
                    <div class="file-row-date">${formatDate(f.created_at)}</div>
                </div>
            </div>
            <div class="file-row-actions">
                <button onclick="showFileActions(${f.id}, '${escapeJsString(f.name)}', '${encodeURI(f.cloudinary_url)}', event)">
                    <i class="fa-solid fa-ellipsis-vertical"></i>
                </button>
            </div>
        `;
        container.appendChild(row);
    });
}

function showFileActions(id, name, url, e) {
    e.stopPropagation();
    currentItemForSheet = { type: 'file', id, name, url };
    const items = [
        { icon: 'fa-regular fa-eye', label: 'Open', action: () => openPdf(url, name) },
        { icon: 'fa-solid fa-download', label: 'Download', action: () => downloadPdfDirect(url, name) },
        { icon: 'fa-regular fa-trash-can', label: 'Delete', danger: true, action: () => deleteFile(id) },
        { icon: 'fa-regular fa-circle-info', label: 'File Details', action: () => showFileDetails(name, url) }
    ];
    openBottomSheet(items, 'File Actions');
}

function showFolderActions(id, name, e) {
    e.stopPropagation();
    currentItemForSheet = { type: 'folder', id, name };
    const items = [
        { icon: 'fa-regular fa-folder-open', label: 'Open', action: () => loadContent(id, name) },
        { icon: 'fa-regular fa-trash-can', label: 'Delete', danger: true, action: () => deleteFolder(id) }
    ];
    openBottomSheet(items, 'Folder Actions');
}

async function deleteFile(id) {
    if (!confirm('Delete this PDF?')) return;
    try {
        const res = await fetch(`/api/files/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        if (res.ok) {
            loadContent(currentFolderId);
            loadStats();
        } else {
            alert('Delete failed.');
        }
    } catch (e) {
        alert('Error deleting file.');
    }
}

async function deleteFolder(id) {
    if (!confirm('Delete this folder and all contents?')) return;
    try {
        const res = await fetch(`/api/folders/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        if (res.ok) {
            loadContent(currentFolderId);
            loadStats();
        } else {
            alert('Delete failed.');
        }
    } catch (e) {
        alert('Error deleting folder.');
    }
}

async function handleCreateFolder() {
    const name = prompt('Enter folder name:');
    if (!name || !name.trim()) return;
    try {
        const res = await fetch('/api/folders', {
            method: 'POST',
            headers: {
                ...getAuthHeaders(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name: name.trim(), parent_id: currentFolderId })
        });
        if (res.ok) {
            loadContent(currentFolderId);
            loadStats();
        } else {
            alert('Failed to create folder.');
        }
    } catch (e) {
        alert('Error creating folder.');
    }
}

async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('pdf', file);
    if (currentFolderId) formData.append('folder_id', currentFolderId);

    try {
        const res = await fetch('/api/files/upload', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: formData
        });
        if (res.ok) {
            loadContent(currentFolderId);
            loadStats();
        } else {
            alert('Upload failed.');
        }
    } catch (e) {
        alert('Upload error.');
    }
    e.target.value = '';
}

// ----- UPDATED PDF VIEWER & DOWNLOAD ENGINE -----
function openPdf(url, title) {
    if (!url || url === 'null' || url === 'undefined') {
        alert('PDF URL is invalid.');
        return;
    }

    const titleEl = document.getElementById('pdf-title');
    if (titleEl) {
        titleEl.innerHTML = `<i class="fa-solid fa-file-pdf"></i> ${escapeHtml(title)}`;
    }

    // Google Viewer Embed URL
    const embedUrl = `https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=true`;
    document.getElementById('pdf-frame').src = embedUrl;

    // Direct Open Link
    const openNewBtn = document.getElementById('pdf-open-new');
    if (openNewBtn) {
        openNewBtn.href = url;
    }

    // Download Link
    const downloadBtn = document.getElementById('pdf-download-link');
    if (downloadBtn) {
        downloadBtn.href = url;
        downloadBtn.setAttribute('download', title || 'document.pdf');
    }

    document.getElementById('pdf-modal').classList.add('active');
}

function downloadPdfDirect(url, fileName) {
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName || 'document.pdf';
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

function closePdfModal() {
    document.getElementById('pdf-modal')?.classList.remove('active');
    document.getElementById('pdf-frame').src = 'about:blank';
}

function showFileDetails(name, url) {
    alert(`File: ${name}\nURL: ${url}`);
}

async function loadStats() {
    try {
        const res = await fetch('/api/files/stats', { headers: getAuthHeaders() });
        if (!res.ok) throw new Error('Stats failed');
        const stats = await res.json();

        document.getElementById('drawer-folders').textContent = stats.foldersCount || 0;
        document.getElementById('drawer-pdfs').textContent = stats.filesCount || 0;
        document.getElementById('drawer-storage').textContent = `${(stats.totalStorageMB || 0).toFixed(1)} MB`;
        document.getElementById('drawer-license').textContent = 'Active';
    } catch (e) {
        console.warn('Stats error:', e);
    }
}

function formatDate(dateStr) {
    if (!dateStr) return '26-08-12 00:00';
    const d = new Date(dateStr);
    const yy = String(d.getFullYear()).slice(-2);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${yy}-${mm}-${dd} ${hh}:${min}`;
}

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function escapeJsString(str) {
    if (!str) return '';
    return str.replace(/'/g, "\\'").replace(/"/g, '\\"');
}

function getAuthHeaders() {
    let token = null;
    if (typeof Auth !== 'undefined' && Auth.getToken) {
        token = Auth.getToken();
    } else {
        token = localStorage.getItem('authToken') || 'mock-token';
    }
    return { 'Authorization': `Bearer ${token}` };
}

window.loadContent = loadContent;
window.openPdf = openPdf;
window.downloadPdfDirect = downloadPdfDirect;
window.showFileActions = showFileActions;
window.showFolderActions = showFolderActions;
window.deleteFile = deleteFile;
window.deleteFolder = deleteFolder;
window.closeBottomSheet = closeBottomSheet;
window.toggleDrawer = toggleDrawer;
window.closeDrawer = closeDrawer;
window.closeFabModal = closeFabModal;
window.toggleFabModal = toggleFabModal;
