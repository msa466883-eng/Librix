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
        document.querySelectorAll('.grid-item').forEach(item => {
            const title = item.querySelector('.item-title').textContent.toLowerCase();
            item.style.display = title.includes(query) ? 'block' : 'none';
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

async function loadContent(folderId = null) {
    currentFolderId = folderId;
    const grid = document.getElementById('content-grid');
    grid.innerHTML = '<p><i class="fa-solid fa-spinner fa-spin"></i> Loading content...</p>';

    try {
        const url = folderId ? `/api/folders/${folderId}` : '/api/folders/root';
        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${Auth.getToken()}` }
        });
        const data = await res.json();

        grid.innerHTML = '';

        // Render Folders
        data.folders.forEach(f => {
            const item = document.createElement('div');
            item.className = 'grid-item';
            item.innerHTML = `
                <i class="fa-solid fa-folder main-icon folder-icon"></i>
                <div class="item-title">${f.name}</div>
                <div class="item-actions">
                    <button onclick="deleteFolder(${f.id}, event)" class="action-btn" title="Delete"><i class="fa-solid fa-trash"></i></button>
                </div>
            `;
            item.addEventListener('click', () => loadContent(f.id));
            grid.appendChild(item);
        });

        // Render Files
        data.files.forEach(file => {
            const item = document.createElement('div');
            item.className = 'grid-item';
            item.innerHTML = `
                <i class="fa-solid fa-file-pdf main-icon pdf-icon"></i>
                <div class="item-title">${file.name}</div>
                <div class="item-actions">
                    <button onclick="openPdf('${file.url}', '${file.name}', event)" class="action-btn" title="Open"><i class="fa-solid fa-eye"></i></button>
                    <button onclick="deleteFile(${file.id}, event)" class="action-btn" title="Delete"><i class="fa-solid fa-trash"></i></button>
                </div>
            `;
            grid.appendChild(item);
        });

    } catch (err) {
        grid.innerHTML = '<p class="error-msg">Failed to load content.</p>';
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
            alert('Upload failed!');
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
    
    // Ensure Cloudinary uses inline preview format
    const embedUrl = url.replace('/upload/', '/upload/fl_inline/');
    
    document.getElementById('pdf-frame').src = embedUrl;
    document.getElementById('pdf-download-link').href = url;
    document.getElementById('pdf-modal').classList.remove('hidden');
}

function closePdfModal() {
    document.getElementById('pdf-modal').classList.add('hidden');
    document.getElementById('pdf-frame').src = 'about:blank';
}

async function deleteFile(id, e) {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this PDF?')) return;
    await fetch(`/api/files/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${Auth.getToken()}` }
    });
    loadContent(currentFolderId);
    loadStats();
}

async function deleteFolder(id, e) {
    e.stopPropagation();
    if (!confirm('Delete this folder and contents?')) return;
    await fetch(`/api/folders/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${Auth.getToken()}` }
    });
    loadContent(currentFolderId);
    loadStats();
}
