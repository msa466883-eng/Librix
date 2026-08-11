document.addEventListener('DOMContentLoaded', () => {
    Auth.init();
    if (Auth.isLoggedIn()) {
        initApp();
    }
});

let currentFolderId = null;

function initApp() {
    document.getElementById('login-section').classList.add('hidden');
    document.getElementById('app-section').classList.remove('hidden');

    loadContent(null);
    loadStats();

    // Event Listeners
    document.getElementById('upload-btn').addEventListener('click', () => {
        document.getElementById('file-input').click();
    });

    document.getElementById('file-input').addEventListener('change', handleFileUpload);
    document.getElementById('create-folder-btn').addEventListener('click', handleCreateFolder);
    document.getElementById('logout-btn').addEventListener('click', Auth.logout);
    document.getElementById('close-pdf-btn').addEventListener('click', closePdfModal);
    
    // Search Filter
    document.getElementById('search-input').addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        document.querySelectorAll('.file-row').forEach(item => {
            const title = item.querySelector('.item-name').textContent.toLowerCase();
            item.style.display = title.includes(query) ? 'flex' : 'none';
        });
    });
}

async function loadStats() {
    try {
        const res = await fetch('/api/files/stats', {
            headers: { 'Authorization': `Bearer ${Auth.getToken()}` }
        });
        const stats = await res.json();
        
        if (res.ok) {
            const folderCount = stats.foldersCount || 0;
            const fileCount = stats.filesCount || 0;
            const storageMB = (stats.totalStorageMB || 0).toFixed(1);

            // Update stats text inside header menu / UI
            const subTitle = document.querySelector('.header-sub-stats');
            if (subTitle) {
                subTitle.textContent = `Folders: ${folderCount}  Files: ${fileCount}  Disk: ${storageMB}MB`;
            }

            // Sync with stats elements if present
            const sf = document.getElementById('stat-folders');
            if (sf) sf.textContent = folderCount;
            const sfi = document.getElementById('stat-files');
            if (sfi) sfi.textContent = fileCount;
            const st = document.getElementById('stat-storage');
            if (st) st.textContent = `${storageMB} MB`;
        }
    } catch (e) {
        console.log("Stats error", e);
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

async function loadContent(folderId = null) {
    currentFolderId = folderId;
    const grid = document.getElementById('content-grid');
    
    // Top Bar Path & 3-line Menu Structure
    const headerTitlePath = folderId ? `/storage/emulated/0/Folder_${folderId}` : '/storage/emulated/0/';

    grid.innerHTML = `
        <div style="background:#1e1e1e; padding:10px 15px; border-bottom:1px solid #333; display:flex; align-items:center; justify-content:space-between; color:#fff;">
            <div style="display:flex; align-items:center; gap:12px;">
                <i class="fa-solid fa-bars" style="font-size:20px; cursor:pointer;" onclick="toggleStatsMenu()"></i>
                <div>
                    <div style="font-weight:bold; font-size:14px;">${headerTitlePath}</div>
                    <div class="header-sub-stats" style="font-size:11px; color:#aaa; margin-top:2px;">Folders: 0 Files: 0 Disk: 0MB</div>
                </div>
            </div>
            <div>
                <i class="fa-solid fa-ellipsis-vertical" style="font-size:18px; cursor:pointer;" onclick="toggleFolderOptions()"></i>
            </div>
        </div>
        <div id="file-list-container">
            <p style="padding:15px; color:#ccc;"><i class="fa-solid fa-spinner fa-spin"></i> Loading content...</p>
        </div>
    `;

    loadStats();

    const listContainer = document.getElementById('file-list-container');

    try {
        const url = folderId ? `/api/folders/${folderId}` : '/api/folders/root';
        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${Auth.getToken()}` }
        });

        if (!res.ok) throw new Error(`Server status ${res.status}`);

        const data = await res.json();
        listContainer.innerHTML = '';

        if ((!data.folders || data.folders.length === 0) && (!data.files || data.files.length === 0)) {
            listContainer.innerHTML = '<p style="color:#888; padding:20px; text-align:center;">No folders or files found.</p>';
            return;
        }

        // Back Folder Row (..)
        if (folderId !== null) {
            const backRow = document.createElement('div');
            backRow.className = 'file-row';
            backRow.style.cssText = 'display:flex; align-items:center; gap:12px; padding:10px 15px; border-bottom:1px solid #282828; cursor:pointer; background:#121212;';
            backRow.innerHTML = `
                <i class="fa-solid fa-folder" style="color:#cfcfcf; font-size:20px;"></i>
                <div style="color:#fff; font-weight:bold; font-size:15px;">..</div>
            `;
            backRow.addEventListener('click', () => loadContent(null));
            listContainer.appendChild(backRow);
        }

        // Folders Rendering
        if (data.folders) {
            data.folders.forEach(f => {
                const row = document.createElement('div');
                row.className = 'file-row';
                row.style.cssText = 'display:flex; align-items:center; justify-content:space-between; padding:10px 15px; border-bottom:1px solid #252525; background:#121212; cursor:pointer;';
                row.innerHTML = `
                    <div style="display:flex; align-items:center; gap:12px;" onclick="loadContent(${f.id})">
                        <i class="fa-solid fa-folder" style="color:#cccccc; font-size:22px;"></i>
                        <div>
                            <div class="item-name" style="color:#ffffff; font-size:14px; font-weight:500;">${f.name}</div>
                            <div style="color:#777777; font-size:11px; margin-top:2px;">${formatDate(f.created_at)}</div>
                        </div>
                    </div>
                    <div>
                        <i class="fa-solid fa-ellipsis-vertical" style="color:#888; font-size:16px; padding:8px; cursor:pointer;" onclick="showFolderMenu(${f.id}, event)"></i>
                    </div>
                `;
                listContainer.appendChild(row);
            });
        }

        // Files Rendering
        if (data.files) {
            data.files.forEach(file => {
                const row = document.createElement('div');
                row.className = 'file-row';
                row.style.cssText = 'display:flex; align-items:center; justify-content:space-between; padding:10px 15px; border-bottom:1px solid #252525; background:#121212;';
                row.innerHTML = `
                    <div style="display:flex; align-items:center; gap:12px; cursor:pointer; flex:1;" onclick="openPdf('${file.cloudinary_url}', '${file.name}')">
                        <i class="fa-solid fa-file-pdf" style="color:#e74c3c; font-size:22px;"></i>
                        <div>
                            <div class="item-name" style="color:#ffffff; font-size:14px; font-weight:500;">${file.name}</div>
                            <div style="color:#777777; font-size:11px; margin-top:2px;">${formatDate(file.created_at)}</div>
                        </div>
                    </div>
                    <div>
                        <i class="fa-solid fa-ellipsis-vertical" style="color:#888; font-size:16px; padding:8px; cursor:pointer;" onclick="showFileMenu(${file.id}, '${file.cloudinary_url}', '${file.name}', event)"></i>
                    </div>
                `;
                listContainer.appendChild(row);
            });
        }

    } catch (err) {
        console.error("Load Error:", err);
        listContainer.innerHTML = '<p style="padding:15px; color:#e74c3c;">Failed to load content.</p>';
    }
}

// 3-Dots Action Menu for File
function showFileMenu(id, url, name, e) {
    if (e) e.stopPropagation();
    const action = prompt(`File: ${name}\n\nEnter option number:\n1. Open PDF\n2. Delete PDF`);
    if (action === '1') {
        openPdf(url, name);
    } else if (action === '2') {
        deleteFile(id);
    }
}

// 3-Dots Action Menu for Folder
function showFolderMenu(id, e) {
    if (e) e.stopPropagation();
    const action = prompt(`Folder Action:\n\nEnter option number:\n1. Open Folder\n2. Delete Folder`);
    if (action === '1') {
        loadContent(id);
    } else if (action === '2') {
        deleteFolder(id);
    }
}

function toggleStatsMenu() {
    loadStats();
    alert("System Stats Status:\n• Active License\n• Fast Storage Node Attached");
}

function toggleFolderOptions() {
    const act = prompt("Actions:\n1. New Folder\n2. Upload File");
    if (act === '1') handleCreateFolder();
    if (act === '2') document.getElementById('file-input').click();
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
            headers: { 'Authorization': `Bearer ${Auth.getToken()}` },
            body: formData
        });
        if (res.ok) {
            loadContent(currentFolderId);
            loadStats();
        } else {
            alert('Upload failed! Check Cloudinary keys.');
        }
    } catch (err) {
        alert('Upload error!');
    }
}

async function handleCreateFolder() {
    const name = prompt("Enter Folder Name:");
    if (!name) return;

    try {
        await fetch('/api/folders', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${Auth.getToken()}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, parent_id: currentFolderId })
        });
        loadContent(currentFolderId);
        loadStats();
    } catch (e) {
        alert('Folder creation failed');
    }
}

// PDF Opening Fixed Function
function openPdf(url, title, e) {
    if (e) e.stopPropagation();
    if (!url || url === 'null' || url === 'undefined') {
        alert("PDF URL is invalid or file missing.");
        return;
    }
    
    document.getElementById('pdf-title').textContent = title;
    
    // Direct Google Docs PDF Viewer Embed Link for direct view without download blocking
    const embedUrl = `https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=true`;
    
    document.getElementById('pdf-frame').src = embedUrl;
    document.getElementById('pdf-download-link').href = url;
    document.getElementById('pdf-modal').classList.remove('hidden');
}

function closePdfModal() {
    document.getElementById('pdf-modal').classList.add('hidden');
    document.getElementById('pdf-frame').src = 'about:blank';
}

async function deleteFile(id) {
    if (!confirm('Are you sure you want to delete this PDF?')) return;
    await fetch(`/api/files/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${Auth.getToken()}` }
    });
    loadContent(currentFolderId);
    loadStats();
}

async function deleteFolder(id) {
    if (!confirm('Delete this folder and contents?')) return;
    await fetch(`/api/folders/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${Auth.getToken()}` }
    });
    loadContent(currentFolderId);
    loadStats();
}
