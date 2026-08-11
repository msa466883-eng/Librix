// ===== js/app.js =====
document.addEventListener('DOMContentLoaded', () => {
    // Auth check logic remains same
    if (typeof Auth !== 'undefined') {
        Auth.init();
        if (Auth.isLoggedIn()) { initApp(); } else {
            document.getElementById('login-section')?.classList.remove('hidden');
            document.getElementById('app-section')?.classList.add('hidden');
        }
    } else {
        initApp();
    }
    // Login handler...
    document.getElementById('login-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const key = document.getElementById('license-key-input').value.trim();
        if (key.length > 0) {
            if (typeof Auth !== 'undefined' && Auth.login) Auth.login(key);
            else {
                document.getElementById('login-section').classList.add('hidden');
                document.getElementById('app-section').classList.remove('hidden');
                initApp();
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
    // ... Event listeners (Drawer, Fab, Modals) same ...
    document.getElementById('drawer-toggle')?.addEventListener('click', toggleDrawer);
    document.getElementById('drawer-close')?.addEventListener('click', closeDrawer);
    document.getElementById('drawer-overlay')?.addEventListener('click', closeDrawer);
    document.getElementById('fab-plus')?.addEventListener('click', toggleFabModal);
    document.getElementById('fab-modal-overlay')?.addEventListener('click', closeFabModal);
    document.getElementById('close-pdf-btn')?.addEventListener('click', closePdfModal);
    document.getElementById('bottom-sheet-overlay')?.addEventListener('click', closeBottomSheet);
    document.getElementById('file-input')?.addEventListener('change', handleFileUpload);
    document.getElementById('fab-new-folder')?.addEventListener('click', () => { closeFabModal(); handleCreateFolder(); });
    document.getElementById('fab-upload-pdf')?.addEventListener('click', () => { closeFabModal(); document.getElementById('file-input')?.click(); });
}

// ----- Encoding Helpers for Urdu/Special Chars -----
function encodeName(name) { return btoa(encodeURIComponent(name)); }
function decodeName(encoded) { try { return decodeURIComponent(atob(encoded)); } catch(e) { return encoded; } }

// ----- Content Loading -----
async function loadContent(folderId = null, encodedName = '') {
    currentFolderId = folderId;
    const container = document.getElementById('file-list-container');
    const folderName = encodedName ? decodeName(encodedName) : '';

    let path = '/storage/emulated/0/';
    if (folderId !== null && folderId !== undefined) {
        if (folderName) folderBreadcrumbMap[folderId] = folderName;
        const name = folderBreadcrumbMap[folderId] || `Folder_${folderId}`;
        path = `/storage/emulated/0/${name}/`;
    }
    document.getElementById('breadcrumb-path').textContent = path;

    container.innerHTML = `<div class="loading-state"><i class="fa-solid fa-spinner fa-spin"></i></div>`;

    try {
        const url = folderId ? `/api/folders/${folderId}` : '/api/folders/root';
        const res = await fetch(url, { headers: getAuthHeaders() });
        const data = await res.json();
        renderFileList(container, data, folderId);
        loadStats();
    } catch (err) {
        container.innerHTML = `<div class="loading-state">Error loading content</div>`;
    }
}

function renderFileList(container, data, folderId) {
    container.innerHTML = '';
    if (folderId !== null && folderId !== undefined) {
        const backRow = document.createElement('div');
        backRow.className = 'file-row';
        backRow.innerHTML = `<div class="file-row-left" onclick="loadContent(null)"><div class="icon-wrap"><i class="fa-solid fa-folder" style="color:#aaa;"></i></div><div class="file-row-name">..</div></div>`;
        container.appendChild(backRow);
    }

    // Folders
    data.folders.forEach(f => {
        const encName = encodeName(f.name);
        const row = document.createElement('div');
        row.className = 'file-row';
        row.innerHTML = `
            <div class="file-row-left" onclick="loadContent(${f.id}, '${encName}')">
                <div class="icon-wrap"><i class="fa-solid fa-folder" style="color:#f1c40f;"></i></div>
                <div class="file-row-name">${escapeHtml(f.name)}</div>
            </div>
            <div class="file-row-actions"><button onclick="showFolderActions(${f.id}, '${encName}', event)"><i class="fa-solid fa-ellipsis-vertical"></i></button></div>
        `;
        container.appendChild(row);
    });

    // Files
    data.files.forEach(f => {
        const encName = encodeName(f.name);
        const row = document.createElement('div');
        row.className = 'file-row';
        row.innerHTML = `
            <div class="file-row-left" onclick="openPdf('${encodeURI(f.cloudinary_url)}', '${escapeJsString(f.name)}')">
                <div class="icon-wrap"><i class="fa-solid fa-file-pdf" style="color:#e74c3c;"></i></div>
                <div class="file-row-name">${escapeHtml(f.name)}</div>
            </div>
            <div class="file-row-actions"><button onclick="showFileActions(${f.id}, '${encName}', '${encodeURI(f.cloudinary_url)}', event)"><i class="fa-solid fa-ellipsis-vertical"></i></button></div>
        `;
        container.appendChild(row);
    });
}

// ----- Actions & Rename -----
function showFileActions(id, encName, url, e) {
    e.stopPropagation();
    const name = decodeName(encName);
    const items = [
        { icon: 'fa-regular fa-eye', label: 'Open', action: () => openPdf(url, name) },
        { icon: 'fa-solid fa-pen', label: 'Rename', action: () => renameItem(id, name, 'file') },
        { icon: 'fa-solid fa-download', label: 'Download', action: () => downloadPdfDirect(url, name) },
        { icon: 'fa-regular fa-trash-can', label: 'Delete', danger: true, action: () => deleteFile(id) }
    ];
    openBottomSheet(items);
}

function showFolderActions(id, encName, e) {
    e.stopPropagation();
    const name = decodeName(encName);
    const items = [
        { icon: 'fa-regular fa-folder-open', label: 'Open', action: () => loadContent(id, encName) },
        { icon: 'fa-solid fa-pen', label: 'Rename', action: () => renameItem(id, name, 'folder') },
        { icon: 'fa-regular fa-trash-can', label: 'Delete', danger: true, action: () => deleteFolder(id) }
    ];
    openBottomSheet(items);
}

async function renameItem(id, oldName, type) {
    const newName = prompt('Enter new name:', oldName);
    if (!newName || newName === oldName) return;
    
    const endpoint = type === 'file' ? `/api/files/${id}` : `/api/folders/${id}`;
    try {
        const res = await fetch(endpoint, {
            method: 'PATCH',
            headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newName })
        });
        if (res.ok) loadContent(currentFolderId);
        else alert('Rename failed');
    } catch (e) { alert('Network error'); }
}

// ----- PDF & Utils (Same as before) -----
function openPdf(url, title) {
    const titleEl = document.getElementById('pdf-title');
    if (titleEl) titleEl.innerHTML = `<i class="fa-solid fa-file-pdf"></i> ${escapeHtml(title)}`;
    document.getElementById('pdf-frame').src = `https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=true`;
    document.getElementById('pdf-open-new').href = url;
    const downloadBtn = document.getElementById('pdf-download-link');
    downloadBtn.href = url;
    downloadBtn.setAttribute('download', title);
    document.getElementById('pdf-modal').classList.add('active');
}

function downloadPdfDirect(url, fileName) {
    const a = document.createElement('a'); a.href = url; a.download = fileName;
    a.target = '_blank'; document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

function deleteFile(id) { /* ... same as before ... */ }
function deleteFolder(id) { /* ... same as before ... */ }
function handleCreateFolder() { /* ... same as before ... */ }
function handleFileUpload(e) { /* ... same as before ... */ }

// Helper Functions
function escapeHtml(str) { const div = document.createElement('div'); div.textContent = str; return div.innerHTML; }
function escapeJsString(str) { return str.replace(/'/g, "\\'").replace(/"/g, '\\"'); }
function getAuthHeaders() { return { 'Authorization': `Bearer ${localStorage.getItem('authToken') || 'mock-token'}` }; }

// Expose globals
window.loadContent = loadContent; window.openPdf = openPdf; window.showFileActions = showFileActions;
window.showFolderActions = showFolderActions; window.deleteFile = deleteFile; window.deleteFolder = deleteFolder;
window.closeBottomSheet = closeBottomSheet; window.toggleDrawer = toggleDrawer; window.closeDrawer = closeDrawer;
window.closeFabModal = closeFabModal; window.toggleFabModal = toggleFabModal;
