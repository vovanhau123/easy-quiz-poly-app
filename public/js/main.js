class ImageUploader {
    constructor() {
        this.token = localStorage.getItem('token');
        this.currentFolderId = null;
        this.folderPath = [];
        this.currentView = localStorage.getItem('viewMode') || 'grid';
        this.currentImageIndex = 0;
        this.currentImages = [];
        this.setupEventListeners();
        this.loadCurrentFolder();
        this.setupViewButtons();
        this.setupImageViewer();
        this.loadStorageInfo();

        // Đảm bảo image viewer modal được ẩn khi khởi tạo
        const imageViewerModal = document.getElementById('imageViewerModal');
        if (imageViewerModal) {
            imageViewerModal.classList.add('hidden');
        }
    }

    setupEventListeners() {
        // Context menu
        document.addEventListener('contextmenu', (e) => this.handleContextMenu(e));
        document.addEventListener('click', () => this.hideContextMenu());

        // Forms
        document.getElementById('createFolderForm').addEventListener('submit', (e) => this.handleCreateFolder(e));
        document.getElementById('uploadForm').addEventListener('submit', (e) => this.handleUpload(e));

        // Breadcrumb navigation
        document.getElementById('breadcrumb').addEventListener('click', (e) => {
            if (e.target.classList.contains('breadcrumb-item')) {
                this.navigateToPath(e.target.dataset.path);
            }
        });

        // Context menu items
        document.querySelectorAll('.menu-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const action = e.currentTarget.dataset.action;
                if (action === 'createFolder') {
                    this.showModal('folderDialog');
                } else if (action === 'upload') {
                    this.showModal('uploadDialog');
                }
            });
        });
    }

    setupViewButtons() {
        const gridBtn = document.querySelector('.view-btn:first-child');
        const listBtn = document.querySelector('.view-btn:last-child');

        // Set initial active state
        if (this.currentView === 'list') {
            gridBtn.classList.remove('active');
            listBtn.classList.add('active');
            this.setListView();
        } else {
            gridBtn.classList.add('active');
            listBtn.classList.remove('active');
            this.setGridView();
        }

        // Add click handlers
        gridBtn.addEventListener('click', () => {
            if (this.currentView !== 'grid') {
                this.currentView = 'grid';
                localStorage.setItem('viewMode', 'grid');
                gridBtn.classList.add('active');
                listBtn.classList.remove('active');
                this.setGridView();
            }
        });

        listBtn.addEventListener('click', () => {
            if (this.currentView !== 'list') {
                this.currentView = 'list';
                localStorage.setItem('viewMode', 'list');
                listBtn.classList.add('active');
                gridBtn.classList.remove('active');
                this.setListView();
            }
        });
    }

    setGridView() {
        const foldersContainer = document.getElementById('foldersContainer');
        const gallery = document.getElementById('imageGallery');
        
        foldersContainer.classList.remove('list-view');
        gallery.classList.remove('list-view');
    }

    setListView() {
        const foldersContainer = document.getElementById('foldersContainer');
        const gallery = document.getElementById('imageGallery');
        
        foldersContainer.classList.add('list-view');
        gallery.classList.add('list-view');
    }

    handleContextMenu(e) {
        e.preventDefault();
        const contextMenu = document.getElementById('contextMenu');
        contextMenu.style.display = 'block';
        contextMenu.style.left = `${e.pageX}px`;
        contextMenu.style.top = `${e.pageY}px`;

        this.contextMenuTarget = e.target.closest('.folder-item') || this.currentPath;
    }

    hideContextMenu() {
        document.getElementById('contextMenu').style.display = 'none';
    }

    showModal(modalId) {
        document.getElementById(modalId).style.display = 'block';
    }

    closeModal(modalId) {
        document.getElementById(modalId).style.display = 'none';
    }

    async handleCreateFolder(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const name = formData.get('folderName');

        try {
            const response = await fetch('/api/folders', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    name,
                    parentId: this.currentFolderId 
                })
            });

            if (!response.ok) throw new Error('Failed to create folder');

            const result = await response.json();
            this.closeModal('folderDialog');
            e.target.reset();
            await this.loadCurrentFolder();
            
            window.toast.success(`Folder "${name}" created successfully`);
        } catch (error) {
            console.error('Error creating folder:', error);
            window.toast.error(error.message);
        }
    }

    async handleUpload(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const files = e.target.querySelector('input[type="file"]').files;
        
        if (this.currentFolderId) {
            formData.append('folderId', this.currentFolderId);
        }
        
        const progressBar = document.getElementById('uploadProgress');
        const progressElement = progressBar.querySelector('.progress');

        try {
            progressBar.classList.remove('hidden');
            progressElement.style.width = '0%';

            const response = await fetch('/api/upload', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                },
                body: formData
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Upload failed');
            }

            progressElement.style.width = '100%';
            setTimeout(() => {
                progressBar.classList.add('hidden');
                this.closeModal('uploadDialog');
                e.target.reset();
            }, 1000);

            await this.loadCurrentFolder();
            window.toast.success(`${files.length} files uploaded successfully`);
            await this.loadStorageInfo();
        } catch (error) {
            console.error('Error uploading files:', error);
            window.toast.error(error.message);
            progressBar.classList.add('hidden');
        }
    }

    async loadCurrentFolder() {
        try {
            console.log('Loading folder:', this.currentFolderId);

            const response = await fetch(`/api/folders/${this.currentFolderId || ''}`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (!response.ok) throw new Error('Failed to load folder contents');

            const data = await response.json();
            console.log('API Response:', data);

            const { currentFolder, folderPath, folders, files } = data;

            this.folderPath = folderPath || [];
            if (currentFolder && !this.folderPath.find(f => f.id === currentFolder.id)) {
                this.folderPath.push(currentFolder);
            }

            this.updateBreadcrumb();
            this.renderFolders(folders);
            this.renderFiles(files);
        } catch (error) {
            console.error('Error loading folder contents:', error);
        }
    }

    updateBreadcrumb() {
        const breadcrumb = document.getElementById('breadcrumb');
        let html = '<span class="breadcrumb-item" data-id="">My Drive</span>';
        
        this.folderPath.forEach(folder => {
            html += ` > <span class="breadcrumb-item" data-id="${folder.id}">${folder.name}</span>`;
        });
        
        breadcrumb.innerHTML = html;

        breadcrumb.querySelectorAll('.breadcrumb-item').forEach(item => {
            item.addEventListener('click', () => {
                const folderId = item.dataset.id;
                this.navigateToFolder(folderId || null);
            });
        });
    }

    renderFolders(folders) {
        const container = document.getElementById('foldersContainer');
        container.innerHTML = '';
        container.className = `folders-grid${this.currentView === 'list' ? ' list-view' : ''}`;

        folders.forEach(folder => {
            const div = document.createElement('div');
            div.className = 'folder-item';
            
            const isNew = folder.created_at && 
                (new Date() - new Date(folder.created_at)) < 300000;
            
            if (isNew) {
                div.classList.add('new');
                const newBadge = document.createElement('span');
                newBadge.className = 'new-badge';
                newBadge.textContent = 'NEW';
                div.appendChild(newBadge);

                setTimeout(() => {
                    div.classList.remove('new');
                    newBadge.remove();
                }, 300000 - (new Date() - new Date(folder.created_at)));
            }

            div.innerHTML = `
                <i class="fas fa-folder"></i>
                <span>${folder.name}</span>
            `;

            div.addEventListener('click', () => this.navigateToFolder(folder.id));
            div.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.showFolderContextMenu(e, folder);
            });
            container.appendChild(div);
        });
    }

    renderFiles(files) {
        this.currentImages = files;
        
        const gallery = document.getElementById('imageGallery');
        gallery.innerHTML = '';
        gallery.className = `gallery${this.currentView === 'list' ? ' list-view' : ''}`;

        files.forEach(file => {
            const item = document.createElement('div');
            item.className = 'gallery-item';
            
            const isNew = file.created_at && 
                (new Date() - new Date(file.created_at)) < 300000;
            
            if (isNew) {
                item.classList.add('new');
                const newBadge = document.createElement('span');
                newBadge.className = 'new-badge';
                newBadge.textContent = 'NEW';
                item.appendChild(newBadge);

                setTimeout(() => {
                    item.classList.remove('new');
                    newBadge.remove();
                }, 300000 - (new Date() - new Date(file.created_at)));
            }

            const img = document.createElement('img');
            const imageUrl = `/api/files/${file.id}?token=${this.token}`;
            img.src = imageUrl;
            img.alt = file.original_name;
            
            const fileInfo = document.createElement('div');
            fileInfo.className = 'file-info';
            fileInfo.innerHTML = `
                <div class="file-name">${file.original_name}</div>
                <div class="file-date">
                    ${new Date(file.created_at).toLocaleDateString()}
                </div>
            `;
            
            item.appendChild(img);
            item.appendChild(fileInfo);
            
            const downloadBtn = document.createElement('button');
            downloadBtn.className = 'download-btn';
            downloadBtn.innerHTML = '<i class="fas fa-download"></i>';
            downloadBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.handleDownload(file.id);
            });
            
            item.appendChild(downloadBtn);
            gallery.appendChild(item);
            
            img.addEventListener('click', () => {
                this.showImageViewer(file.id);
            });
        });
    }

    navigateToFolder(folderId) {
        this.currentFolderId = folderId;
        this.loadCurrentFolder();
    }

    async handleDownload(imageId) {
        try {
            window.location.href = `/api/download/${imageId}?token=${this.token}`;
        } catch (error) {
            console.error('Error downloading image:', error);
        }
    }

    showFolderContextMenu(e, folder) {
        const contextMenu = document.getElementById('contextMenu');
        contextMenu.style.display = 'block';
        contextMenu.style.left = `${e.pageX}px`;
        contextMenu.style.top = `${e.pageY}px`;
        this.selectedFolder = folder;
    }

    setupImageViewer() {
        const modal = document.getElementById('imageViewerModal');
        const closeBtn = modal.querySelector('.close-btn');
        const prevBtn = modal.querySelector('.prev-btn');
        const nextBtn = modal.querySelector('.next-btn');

        closeBtn.addEventListener('click', () => this.closeImageViewer());
        prevBtn.addEventListener('click', () => this.showPrevImage());
        nextBtn.addEventListener('click', () => this.showNextImage());

        // Thêm keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (!modal.classList.contains('hidden')) {
                if (e.key === 'Escape') this.closeImageViewer();
                if (e.key === 'ArrowLeft') this.showPrevImage();
                if (e.key === 'ArrowRight') this.showNextImage();
            }
        });
    }

    showImageViewer(imageId) {
        const modal = document.getElementById('imageViewerModal');
        const viewerImage = document.getElementById('viewerImage');
        const imageName = modal.querySelector('.image-name');
        const imageDate = modal.querySelector('.image-date');

        // Lấy thông tin ảnh hiện tại
        const currentImage = this.currentImages.find(img => img.id === imageId);
        this.currentImageIndex = this.currentImages.findIndex(img => img.id === imageId);

        if (!currentImage) {
            console.error('Image not found:', imageId);
            return;
        }

        // Cập nhật ảnh và thông tin
        viewerImage.src = `/api/files/${imageId}?token=${this.token}`;
        imageName.textContent = currentImage.original_name;
        imageDate.textContent = new Date(currentImage.created_at).toLocaleDateString();

        // Hiển thị/ẩn nút điều hướng
        modal.querySelector('.prev-btn').style.display = 
            this.currentImageIndex > 0 ? 'flex' : 'none';
        modal.querySelector('.next-btn').style.display = 
            this.currentImageIndex < this.currentImages.length - 1 ? 'flex' : 'none';

        // Hiển thị modal
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';

        // Debug
        console.log('Opening image viewer:', {
            imageId,
            currentImage,
            index: this.currentImageIndex,
            totalImages: this.currentImages.length
        });
    }

    closeImageViewer() {
        const modal = document.getElementById('imageViewerModal');
        modal.classList.add('hidden');
        document.body.style.overflow = ''; // Restore scrolling
    }

    showPrevImage() {
        if (this.currentImageIndex > 0) {
            this.currentImageIndex--;
            const prevImage = this.currentImages[this.currentImageIndex];
            this.showImageViewer(prevImage.id);
        }
    }

    showNextImage() {
        if (this.currentImageIndex < this.currentImages.length - 1) {
            this.currentImageIndex++;
            const nextImage = this.currentImages[this.currentImageIndex];
            this.showImageViewer(nextImage.id);
        }
    }

    async loadStorageInfo() {
        try {
            const response = await fetch('/api/storage/info', {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (!response.ok) throw new Error('Failed to load storage info');

            const data = await response.json();
            this.updateStorageDisplay(data);
        } catch (error) {
            console.error('Error loading storage info:', error);
        }
    }

    updateStorageDisplay(data) {
        const storageText = document.querySelector('.storage-text');
        const storageFill = document.querySelector('.storage-fill');
        
        // Convert bytes to GB with 1 decimal place
        const usedGB = (data.used / (1024 * 1024 * 1024)).toFixed(1);
        const totalGB = (data.total / (1024 * 1024 * 1024)).toFixed(1);
        
        // Update text
        storageText.innerHTML = `
            <span>Storage Used</span>
            <span>${usedGB}GB / ${totalGB}GB</span>
        `;

        // Update progress bar
        storageFill.style.width = `${data.percentage}%`;

        // Add warning class if storage is almost full
        if (data.percentage > 90) {
            storageFill.classList.add('warning');
        } else {
            storageFill.classList.remove('warning');
        }
    }
}

// Initialize ImageUploader after DOM content is loaded
document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('token')) {
        window.imageUploader = new ImageUploader();
    }
});

// Global function for closing modals
window.closeModal = function(modalId) {
    document.getElementById(modalId).style.display = 'none';
}; 