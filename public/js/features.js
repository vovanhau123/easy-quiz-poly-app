class DriveFeatures {
    constructor() {
        this.currentView = 'home';
        this.setupThemeToggle();
        this.setupSidebarNavigation();
        this.loadStorageInfo();
    }

    setupThemeToggle() {
        const themeToggle = document.getElementById('themeToggle');
        const icon = themeToggle.querySelector('i');
        
        // Kiểm tra theme đã lưu
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.body.classList.toggle('dark-theme', savedTheme === 'dark');
        icon.classList.toggle('fa-sun', savedTheme === 'dark');
        icon.classList.toggle('fa-moon', savedTheme === 'light');

        themeToggle.addEventListener('click', () => {
            document.body.classList.toggle('dark-theme');
            const isDark = document.body.classList.contains('dark-theme');
            
            // Cập nhật icon
            icon.classList.toggle('fa-sun', isDark);
            icon.classList.toggle('fa-moon', !isDark);
            
            // Lưu preference
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
        });
    }

    setupSidebarNavigation() {
        const navItems = document.querySelectorAll('.nav-item');
        
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const view = item.getAttribute('data-view');
                this.switchView(view);
                
                // Update active state
                navItems.forEach(nav => nav.classList.remove('active'));
                item.classList.add('active');
            });
        });
    }

    async switchView(view) {
        this.currentView = view;
        const contentWrapper = document.querySelector('.content-wrapper');
        
        // Show loading state
        contentWrapper.innerHTML = '<div class="loading">Loading...</div>';
        
        try {
            let content;
            switch(view) {
                case 'home':
                    // Khôi phục giao diện My Drive
                    content = `
                        <div class="breadcrumb" id="breadcrumb">
                            <i class="fas fa-folder"></i>
                            <span class="breadcrumb-item" data-id="">My Drive</span>
                        </div>

                        <div class="quick-actions">
                            <button class="action-btn" onclick="window.imageUploader.showModal('folderDialog')">
                                <i class="fas fa-folder-plus"></i>
                                <span>New Folder</span>
                            </button>
                            <button class="action-btn" onclick="window.imageUploader.showModal('uploadDialog')">
                                <i class="fas fa-cloud-upload-alt"></i>
                                <span>Upload Files</span>
                            </button>
                            <div class="view-options">
                                <button class="view-btn active">
                                    <i class="fas fa-th"></i>
                                </button>
                                <button class="view-btn">
                                    <i class="fas fa-list"></i>
                                </button>
                            </div>
                        </div>

                        <div class="content-sections">
                            <section class="content-section">
                                <div class="section-header">
                                    <h2><i class="fas fa-folder"></i> Folders</h2>
                                </div>
                                <div id="foldersContainer" class="folders-grid"></div>
                            </section>

                            <section class="content-section">
                                <div class="section-header">
                                    <h2><i class="fas fa-image"></i> Files</h2>
                                </div>
                                <div id="imageGallery" class="gallery"></div>
                            </section>
                        </div>
                    `;
                    contentWrapper.innerHTML = content;
                    // Tải lại nội dung thư mục hiện tại
                    if (window.imageUploader) {
                        window.imageUploader.loadCurrentFolder();
                    }
                    break;
                case 'recent':
                    content = await this.getRecentFiles();
                    contentWrapper.innerHTML = content;
                    break;
                case 'starred':
                    content = await this.getStarredFiles();
                    contentWrapper.innerHTML = content;
                    break;
                case 'trash':
                    content = await this.getTrashFiles();
                    contentWrapper.innerHTML = content;
                    break;
            }
            
            this.setupViewHandlers(view);
        } catch (error) {
            console.error('Error switching view:', error);
            contentWrapper.innerHTML = '<div class="error">Failed to load content</div>';
        }
    }

    async getRecentFiles() {
        const response = await fetch('/api/files/recent', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        const data = await response.json();
        
        return this.renderFilesList(data.files, 'Recent Files');
    }

    async getStarredFiles() {
        const response = await fetch('/api/files/starred', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        const data = await response.json();
        
        return this.renderFilesList(data.files, 'Starred Files');
    }

    async getTrashFiles() {
        const response = await fetch('/api/files/trash', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        const data = await response.json();
        
        return this.renderFilesList(data.files, 'Trash', true);
    }

    renderFilesList(files, title, isTrash = false) {
        return `
            <div class="view-header">
                <h2>${title}</h2>
            </div>
            <div class="files-grid">
                ${files.map(file => this.renderFileItem(file, isTrash)).join('')}
            </div>
        `;
    }

    renderFileItem(file, isTrash) {
        return `
            <div class="file-item" data-id="${file.id}">
                <div class="file-preview">
                    <img src="/api/files/${file.id}?token=${localStorage.getItem('token')}" alt="${file.name}">
                </div>
                <div class="file-info">
                    <span class="file-name">${file.name}</span>
                    <span class="file-date">${new Date(file.created_at).toLocaleDateString()}</span>
                </div>
                <div class="file-actions">
                    ${isTrash ? `
                        <button class="restore-btn" title="Restore">
                            <i class="fas fa-undo"></i>
                        </button>
                        <button class="delete-permanent-btn" title="Delete Permanently">
                            <i class="fas fa-trash"></i>
                        </button>
                    ` : `
                        <button class="star-btn ${file.starred ? 'starred' : ''}" title="Star">
                            <i class="fas fa-star"></i>
                        </button>
                        <button class="delete-btn" title="Move to Trash">
                            <i class="fas fa-trash"></i>
                        </button>
                    `}
                </div>
            </div>
        `;
    }

    setupViewHandlers(view) {
        if (view === 'trash') {
            this.setupTrashHandlers();
        } else {
            this.setupNormalViewHandlers();
        }
    }

    setupTrashHandlers() {
        document.querySelectorAll('.restore-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const fileId = e.target.closest('.file-item').dataset.id;
                this.restoreFile(fileId);
            });
        });

        document.querySelectorAll('.delete-permanent-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const fileId = e.target.closest('.file-item').dataset.id;
                this.deletePermanently(fileId);
            });
        });
    }

    setupNormalViewHandlers() {
        document.querySelectorAll('.star-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const fileId = e.target.closest('.file-item').dataset.id;
                this.toggleStar(fileId, btn);
            });
        });

        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const fileId = e.target.closest('.file-item').dataset.id;
                this.moveToTrash(fileId);
            });
        });
    }

    async loadStorageInfo() {
        try {
            const response = await fetch('/api/storage/info', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            const data = await response.json();
            
            const storageText = document.querySelector('.storage-text');
            const storageFill = document.querySelector('.storage-fill');
            
            const usedGB = (data.used / (1024 * 1024 * 1024)).toFixed(1);
            const totalGB = (data.total / (1024 * 1024 * 1024)).toFixed(1);
            const percentage = (data.used / data.total) * 100;
            
            storageText.innerHTML = `
                <span>Storage Used</span>
                <span>${usedGB}GB / ${totalGB}GB</span>
            `;
            storageFill.style.width = `${percentage}%`;
        } catch (error) {
            console.error('Error loading storage info:', error);
        }
    }
}

// Initialize features
document.addEventListener('DOMContentLoaded', () => {
    window.driveFeatures = new DriveFeatures();
}); 