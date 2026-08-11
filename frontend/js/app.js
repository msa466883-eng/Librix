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
        document.querySelectorAll('.explorer-item').forEach(item => {
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
            document.getElementById('stat-folders').textContent = stats.foldersCount || 0;
            document.getElementById('stat-files').textContent = stats.filesCount || 0;
            document.getElementById('stat-storage').textContent = `${(stats.totalStorageMB || 0).toFixed(1)} MB`;
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
    grid.innerHTML = '<p style="padding:15px; color:#ccc;"><i class="fa-solid fa-spinner fa-spin"></i> Loading content...</p>';

    try {
        const url = folderId ? `/api/folders/${folderId}` : '/api/folders/root';
        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${Auth.getToken()}` }
        });

        if (!res.ok) throw new Error(`Server status ${res.status}`);

        const data = await res.json();
        grid.innerHTML = '';

        if ((!data.folders || data.folders.length === 0) && (!data.files || data.files.length === 0)) {
            grid.innerHTML = '<p style="color:#888; padding:20px; text-align:center;">Empty Folder</p>';
            return;
        }

        // Parent / Go Back Row (agar inside folder ho)
        if (folderId !== null) {
            const backItem = document.createElement('div');
            backItem.className = 'explorer-item';
            backItem.style.cssText = 'display:flex; align-items:center; gap:12px; padding:10px; border-bottom:1px solid #333; cursor:pointer;';
            backItem.innerHTML = `
                <i class="fa-solid fa-folder" style="color:#e0e0e0; font-size:20px;"></i>
                <div><div class="item-name" style="font-weight:bold; color:#fff;">..</div></div>
            `;
            backItem.addEventListener('click', () => loadContent(null));
            grid.appendChild(backItem);
        }

        // Render Folders (File Explorer List View Layout)
        if (data.folders) {
            data.folders.forEach(f => {
                const item = document.createElement('div');
                item.className = 'explorer-item';
                item.style.cssText = 'display:flex; align-items:center; justify-content:space-between; padding:10px; border-bottom:1px solid #2a2a2a; cursor:pointer;';
                item.innerHTML = `
                    <div style="display:flex; align-items:center; gap:12px;">
                        <i class="fa-solid fa-folder" style="color:#cfcfcf; font-size:22px;"></i>
                        <div>
                            <div class="item-name" style="color:#e0e0e0; font-size:15px; font-weight:600;">${f.name}</div>
                            <div style="color:#777; font-size:11px; margin-top:2px;">${formatDate(f.created_at)}</div>
                        </div>
                    </div>
                    <div>
                        <button onclick="deleteFolder(${f.id}, event)" style="background:none; border:none; color:#888; cursor:pointer;" title="Delete"><i class="fa-solid fa-trash"></i></button>
                    </div>
                `;
                item.addEventListener('click', () => loadContent(f.id));
                grid.appendChild(item);
            });
        }

        // Render Files (File Explorer List View Layout)
        if (data.files) {
            data.files.forEach(file => {
                const item = document.createElement('div');
                item.className = 'explorer-item';
                item.style.cssText = 'display:flex; align-items:center; justify-content:space-between; padding:10px; border-bottom:1px solid #2a2a2a;';
                item.innerHTML = `
                    <div style="display:flex; align-items:center; gap:12px;">
                        <i class="fa-solid fa-file-pdf" style="color:#e74c3c; font-size:22px;"></i>
                        <div>
                            <div class="item-name" style="color:#e0e0e0; font-size:15px; font-weight:600;">${file.name}</div>
                            <div style="color:#777; font-size:11px; margin-top:2px;">${formatDate(file.created_at)}</div>
                        </div>
                    </div>
                    <div style="display:flex; gap:10px;">
                        <button onclick="openPdf('${file.cloudinary_url}', '${file.name}', event)" style="background:none; border:none; color:#3498db; cursor:pointer;" title="Open"><i class="fa-solid fa-eye"></i></button>
                        <button onclick="deleteFile(${file.id}, event)" style="background:none; border:none; color:#888; cursor:pointer;" title="Delete"><i class="fa-solid fa-trash"></i></button>
                    </div>
                `;
                grid.appendChild(item);
            });
        }

    } catch (err) {
        console.error("Load Error:", err);
        grid.innerHTML = '<p class="error-msg" style="padding:15px; color:#e74c3c;">Failed to load content.</p>';
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
            headers: { 'Authorization': `Bearer ${Auth.getToken()}` },
            body: formData
        });
        if (res.ok) {
            loadContent(currentFolderId);
            loadStats();
        } else {
            alert('Upload failed! Check Cloudinary keys in environment variables.');
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

function openPdf(url, title, e) {
    if (e) e.stopPropagation();
    document.getElementById('pdf-title').textContent = title;
    
    const embedUrl = url ? url.replace('/upload/', '/upload/fl_inline/') : '#';
    
    document.getElementById('pdf-frame').src = embedUrl;
    document.getElementById('pdf-download-link').href = url;
    document.getElementById('pdf-modal').classList.remove('hidden');
}

function closePdfModal() {
    document.getElementById('pdf-modal').classList.add('hidden');
    document.getElementById('pdf-frame').src = 'about:blank';
}

async function deleteFile(id, e) {
    if (e) e.stopPropagation();
    if (!confirm('Are you sure you want to delete this PDF?')) return;
    await fetch(`/api/files/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${Auth.getToken()}` }
    });
    loadContent(currentFolderId);
    loadStats();
}

async function deleteFolder(id, e) {
    if (e) e.stopPropagation();
    if (!confirm('Delete this folder and contents?')) return;
    await fetch(`/api/folders/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${Auth.getToken()}` }
    });
    loadContent(currentFolderId);
    loadStats();
}
