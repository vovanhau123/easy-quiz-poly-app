class ImageUploader {
  constructor() {
    this.token = localStorage.getItem("token");
    this.currentFolderId = "";
    this.folderPath = [];
    this.currentView = localStorage.getItem("viewMode") || "grid";
    this.currentImageIndex = 0;
    this.currentImages = [];
    this.currentFolders = [];
    this.contextMenu = null;
    this.initializeContextMenu();
    this.setupEventListeners();
    this.loadCurrentFolder();
    this.setupViewButtons();
    this.setupImageViewer();
    this.loadStorageInfo();
    this.setupMobileNavigation();
    this.setupWebSocket();

    // Đảm bảo image viewer modal được ẩn khi khởi tạo
    const imageViewerModal = document.getElementById("imageViewerModal");
    if (imageViewerModal) {
      imageViewerModal.classList.add("hidden");
    }
  }

  initializeContextMenu() {
    // Tạo context menu element nếu chưa tồn tại
    if (!document.getElementById("contextMenu")) {
      const contextMenu = document.createElement("div");
      contextMenu.id = "contextMenu";
      contextMenu.className = "context-menu";
      contextMenu.style.display = "none";
      document.body.appendChild(contextMenu);
    }
    this.contextMenu = document.getElementById("contextMenu");
  }

  setupEventListeners() {
    // Click outside to close context menu
    document.addEventListener("click", (e) => {
      if (this.contextMenu && !e.target.closest(".context-menu")) {
        this.hideContextMenu();
      }
    });

    // ESC key to close modals and context menu
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        this.hideContextMenu();
        this.closeAllModals();
      }
    });

    // Prevent default context menu
    document.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      this.hideContextMenu();
    });

    // Forms
    const createFolderForm = document.getElementById("createFolderForm");
    if (createFolderForm) {
      createFolderForm.addEventListener("submit", (e) =>
        this.handleCreateFolder(e)
      );
    }

    const uploadForm = document.getElementById("uploadForm");
    if (uploadForm) {
      uploadForm.addEventListener("submit", (e) => this.handleUpload(e));
    }

    // Breadcrumb navigation
    document.getElementById("breadcrumb").addEventListener("click", (e) => {
      if (e.target.classList.contains("breadcrumb-item")) {
        this.navigateToPath(e.target.dataset.path);
      }
    });

    // Context menu items
    const createFolderBtn = document.querySelector(
      '[data-action="createFolder"]'
    );
    const uploadBtn = document.querySelector('[data-action="upload"]');
    const connectBtn = document.querySelector('[data-action="connect"]');

    if (createFolderBtn) {
      createFolderBtn.addEventListener("click", () => {
        this.showModal("folderDialog");
      });
    }

    if (uploadBtn) {
      uploadBtn.addEventListener("click", () => {
        this.showModal("uploadDialog");
      });
    }

    if (connectBtn) {
      connectBtn.addEventListener("click", () => {
        this.showModal("connectDialog");
      });
    }

    // Quick action buttons
    const quickCreateFolderBtn = document.querySelector(
      '.action-btn[onclick*="folderDialog"]'
    );
    const quickUploadBtn = document.querySelector(
      '.action-btn[onclick*="uploadDialog"]'
    );

    if (quickCreateFolderBtn) {
      quickCreateFolderBtn.addEventListener("click", (e) => {
        e.preventDefault();
        this.showModal("folderDialog");
      });
    }

    if (quickUploadBtn) {
      quickUploadBtn.addEventListener("click", (e) => {
        e.preventDefault();
        this.showModal("uploadDialog");
      });
    }

    // Form submissions
    const connectFolderForm = document.getElementById("connectFolderForm");
    if (connectFolderForm) {
      connectFolderForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const folderId = e.target.folderId.value.trim();

        if (!folderId) {
          window.toast.error("Please enter a folder ID");
          return;
        }

        await this.connectToSharedFolder(folderId);
        this.closeModal("connectDialog");
        e.target.reset();
      });
    }
  }

  setupViewButtons() {
    const gridBtn = document.querySelector(".view-btn:first-child");
    const listBtn = document.querySelector(".view-btn:last-child");

    // Set initial active state
    if (this.currentView === "list") {
      gridBtn.classList.remove("active");
      listBtn.classList.add("active");
      this.setListView();
    } else {
      gridBtn.classList.add("active");
      listBtn.classList.remove("active");
      this.setGridView();
    }

    // Add click handlers
    gridBtn.addEventListener("click", () => {
      if (this.currentView !== "grid") {
        this.currentView = "grid";
        localStorage.setItem("viewMode", "grid");
        gridBtn.classList.add("active");
        listBtn.classList.remove("active");
        this.setGridView();
      }
    });

    listBtn.addEventListener("click", () => {
      if (this.currentView !== "list") {
        this.currentView = "list";
        localStorage.setItem("viewMode", "list");
        listBtn.classList.add("active");
        gridBtn.classList.remove("active");
        this.setListView();
      }
    });
  }

  setGridView() {
    const foldersContainer = document.getElementById("foldersContainer");
    const gallery = document.getElementById("imageGallery");

    foldersContainer.classList.remove("list-view");
    gallery.classList.remove("list-view");
  }

  setListView() {
    const foldersContainer = document.getElementById("foldersContainer");
    const gallery = document.getElementById("imageGallery");

    foldersContainer.classList.add("list-view");
    gallery.classList.add("list-view");
  }

  handleContextMenu(e) {
    e.preventDefault();
    const contextMenu = document.getElementById("contextMenu");
    contextMenu.style.display = "block";
    contextMenu.style.left = `${e.pageX}px`;
    contextMenu.style.top = `${e.pageY}px`;

    this.contextMenuTarget =
      e.target.closest(".folder-item") || this.currentPath;
  }

  hideContextMenu() {
    if (this.contextMenu) {
      this.contextMenu.style.display = "none";
    }
  }

  showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.style.display = "block";
      // Thêm class để hiển thị modal
      modal.classList.remove("hidden");

      // Thêm event listener để đóng modal khi click bên ngoài
      modal.addEventListener("click", (e) => {
        if (e.target === modal) {
          this.closeModal(modalId);
        }
      });

      // Thêm event listener cho nút close trong modal
      const closeBtn = modal.querySelector(".cancel-btn");
      if (closeBtn) {
        closeBtn.addEventListener("click", () => this.closeModal(modalId));
      }
    }
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.style.display = "none";
      modal.classList.add("hidden");
    }
  }

  async handleCreateFolder(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const name = formData.get('folderName');

    if (!name.trim()) {
        window.toast.error('Please enter a folder name');
        return;
    }

    try {
        const response = await fetch('/api/folders', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${this.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name,
                parentId: this.currentFolderId
            })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Failed to create folder');
        }

        // Đóng modal và reset form
        this.closeModal('folderDialog');
        e.target.reset();

        // Thêm folder mới vào danh sách hiện tại
        const newFolder = {
            ...result.folder,
            created_at: new Date().toISOString() // Thêm created_at nếu không có
        };

        if (!this.currentFolders.some(f => f.id === newFolder.id)) {
            this.currentFolders.push(newFolder);
            this.renderFolders(this.currentFolders);
        }

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
      formData.append("folderId", this.currentFolderId);
    }

    const progressBar = document.getElementById("uploadProgress");
    const progressElement = progressBar.querySelector(".progress");

    try {
      progressBar.classList.remove("hidden");
      progressElement.style.width = "0%";

      const response = await fetch("/api/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Upload failed");
      }

      progressElement.style.width = "100%";
      setTimeout(() => {
        progressBar.classList.add("hidden");
        this.closeModal("uploadDialog");
        e.target.reset();
      }, 1000);

      await this.loadCurrentFolder();
      window.toast.success(`${files.length} files uploaded successfully`);
      await this.loadStorageInfo();
    } catch (error) {
      console.error("Error uploading files:", error);
      window.toast.error(error.message);
      progressBar.classList.add("hidden");
    }
  }

  async loadCurrentFolder() {
    try {
      const response = await fetch(
        `/api/folders/${this.currentFolderId || ""}`,
        {
          headers: {
            Authorization: `Bearer ${this.token}`,
          },
        }
      );

      if (!response.ok) throw new Error("Failed to load folder contents");

      const data = await response.json();

      // Cập nhật breadcrumb path
      if (data.currentFolder) {
        this.folderPath = data.folderPath || [];
      } else {
        this.folderPath = [];
      }
      this.updateBreadcrumb();

      // Lưu danh sách folders hiện tại
      this.currentFolders = data.folders || [];
      this.renderFolders(this.currentFolders);
      this.renderFiles(data.files || []);
    } catch (error) {
      console.error("Error loading folders:", error);
      window.toast.error("Failed to load folders");
    }
  }

  updateBreadcrumb() {
    const breadcrumb = document.getElementById("breadcrumb");
    if (!breadcrumb) return;

    // Luôn bắt đầu với My Drive và thêm sự kiện click
    breadcrumb.innerHTML = `
            <i class="fas fa-folder"></i>
            <span class="breadcrumb-item home-link" data-id="">My Drive</span>
        `;

    // Thêm các folder trong path
    if (this.folderPath.length > 0) {
      this.folderPath.forEach((folder) => {
        breadcrumb.innerHTML += `
                    <i class="fas fa-chevron-right"></i>
                    <span class="breadcrumb-item" data-id="${folder.id}">${folder.name}</span>
                `;
      });
    }

    // Thêm event listeners cho tất cả breadcrumb items
    breadcrumb.querySelectorAll(".breadcrumb-item").forEach((item) => {
      item.addEventListener("click", () => {
        const folderId = item.dataset.id;
        this.navigateToFolder(folderId || null);
      });
    });
  }

  renderFolders(folders) {
    const container = document.getElementById("foldersContainer");
    if (!container) return;

    container.innerHTML = "";
    container.className = `folders-grid${this.currentView === "list" ? " list-view" : ""}`;

    folders.forEach((folder) => {
        const div = document.createElement("div");
        div.className = "folder-item";
        div.dataset.folderId = folder.id;

        // Kiểm tra nếu folder được tạo trong vòng 5 phút
        const isNew = folder.created_at ? (() => {
            const createdAt = new Date(folder.created_at);
            const now = new Date();
            return !isNaN(createdAt) && (now - createdAt < 300000); // 5 phút
        })() : false;

        if (isNew) {
            div.classList.add("new");
            const newBadge = document.createElement("span");
            newBadge.className = "new-badge";
            newBadge.textContent = "NEW";
            div.appendChild(newBadge);
        }

        // Tạo folder content
        const content = document.createElement("div");
        content.className = "folder-content";

        // Icon container
        const iconContainer = document.createElement("i");
        iconContainer.className = "fas fa-folder";

        // Folder info container
        const folderInfo = document.createElement("div");
        folderInfo.className = "folder-info";

        // Folder name
        const folderName = document.createElement("span");
        folderName.className = "folder-name";
        folderName.textContent = folder.name || 'Untitled Folder';

        // Thêm các phần tử vào folder info
        folderInfo.appendChild(folderName);

        // Thêm shared badge nếu là shared folder
        if (folder.owner_name && !folder.is_owner) {
            const sharedBadge = document.createElement("span");
            sharedBadge.className = "shared-badge";
            sharedBadge.innerHTML = `
                <i class="fas fa-share-alt"></i>
                Shared by ${folder.owner_name}
            `;
            folderInfo.appendChild(sharedBadge);
        }

        // Thêm icon và folder info vào content
        content.appendChild(iconContainer);
        content.appendChild(folderInfo);

        // Thêm folder actions
        const actions = document.createElement("div");
        actions.className = "folder-actions";
        actions.innerHTML = `
            <button class="copy-id-btn" title="Copy Folder ID">
                <i class="fas fa-copy"></i>
            </button>
            ${folder.is_owner ? `
                <button class="manage-share-btn" title="Manage Sharing">
                    <i class="fas fa-users-cog"></i>
                </button>
            ` : ''}
        `;

        // Thêm content và actions vào folder item
        div.appendChild(content);
        div.appendChild(actions);

        // Event listeners
        content.addEventListener('click', () => this.navigateToFolder(folder.id));

        // Copy ID button
        const copyBtn = actions.querySelector('.copy-id-btn');
        if (copyBtn) {
            copyBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                try {
                    const shareLink = `${window.location.origin}/shared/${folder.id}`;
                    await navigator.clipboard.writeText(shareLink);
                    
                    // Tạo rich preview khi share
                    const shareData = {
                        title: 'Butterfly Drive - Shared Folder',
                        text: `Check out this shared folder: ${folder.name}`,
                        url: shareLink
                    };

                    if (navigator.share && navigator.canShare(shareData)) {
                        await navigator.share(shareData);
                    } else {
                        window.toast.success('Share link copied to clipboard!');
                    }
                } catch (err) {
                    window.toast.error('Failed to copy share link');
                }
            });
        }

        // Manage share button
        const shareBtn = actions.querySelector('.manage-share-btn');
        if (shareBtn) {
            shareBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showShareManagement(folder.id, folder.name);
            });
        }

        container.appendChild(div);
    });

    // Log để debug
    console.log('Rendered folders:', folders);
  }

  renderFiles(files) {
    this.currentImages = files;

    const gallery = document.getElementById("imageGallery");
    gallery.innerHTML = "";
    gallery.className = `gallery${
      this.currentView === "list" ? " list-view" : ""
    }`;

    files.forEach((file) => {
      const item = document.createElement("div");
      item.className = "gallery-item";

      const isNew =
        file.created_at && new Date() - new Date(file.created_at) < 300000;

      if (isNew) {
        item.classList.add("new");
        const newBadge = document.createElement("span");
        newBadge.className = "new-badge";
        newBadge.textContent = "NEW";
        item.appendChild(newBadge);
      }

      const img = document.createElement("img");
      const imageUrl = `/api/files/${file.id}?token=${this.token}`;
      img.src = imageUrl;
      img.alt = file.original_name;

      const fileInfo = document.createElement("div");
      fileInfo.className = "file-info";
      fileInfo.innerHTML = `
                <div class="file-name">${file.original_name}</div>
                <div class="file-date">
                    ${new Date(file.created_at).toLocaleDateString()}
                </div>
            `;

      item.appendChild(img);
      item.appendChild(fileInfo);

      const downloadBtn = document.createElement("button");
      downloadBtn.className = "download-btn";
      downloadBtn.innerHTML = '<i class="fas fa-download"></i>';
      downloadBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.handleDownload(file.id);
      });

      item.appendChild(downloadBtn);
      gallery.appendChild(item);

      img.addEventListener("click", () => {
        this.showImageViewer(file.id);
      });
    });
  }

  navigateToFolder(folderId) {
    this.currentFolderId = folderId;
    this.loadCurrentFolder();
  }

  loadHomeView() {
    // Reset state
    this.currentFolderId = null;
    this.folderPath = [];

    // Cập nht UI ngay lập tức
    const breadcrumb = document.getElementById("breadcrumb");
    const foldersContainer = document.getElementById("foldersContainer");
    const galleryContainer = document.getElementById("imageGallery");

    if (breadcrumb) {
      breadcrumb.innerHTML = `
                <i class="fas fa-folder"></i>
                <span class="breadcrumb-item" data-id="">My Drive</span>
            `;
    }

    if (foldersContainer) {
      foldersContainer.innerHTML =
        '<div class="loading-message">Loading folders...</div>';
    }

    if (galleryContainer) {
      galleryContainer.innerHTML =
        '<div class="loading-message">Loading files...</div>';
    }

    // Load data mới
    this.loadCurrentFolder(true);
  }

  async handleDownload(fileId) {
    try {
      window.location.href = `/api/files/${fileId}/download?token=${this.token}`;
    } catch (error) {
      console.error("Error downloading file:", error);
      window.toast.error("Failed to download file");
    }
  }
  showFolderContextMenu(e, folder) {
    const contextMenu = document.getElementById("contextMenu");
    contextMenu.style.display = "block";
    contextMenu.style.left = `${e.pageX}px`;
    contextMenu.style.top = `${e.pageY}px`;
    this.selectedFolder = folder;
  }

  setupImageViewer() {
    const modal = document.getElementById("imageViewerModal");
    const closeBtn = modal.querySelector(".close-btn");
    const prevBtn = modal.querySelector(".prev-btn");
    const nextBtn = modal.querySelector(".next-btn");

    closeBtn.addEventListener("click", () => this.closeImageViewer());
    prevBtn.addEventListener("click", () => this.showPrevImage());
    nextBtn.addEventListener("click", () => this.showNextImage());

    // Thêm keyboard navigation
    document.addEventListener("keydown", (e) => {
      if (!modal.classList.contains("hidden")) {
        if (e.key === "Escape") this.closeImageViewer();
        if (e.key === "ArrowLeft") this.showPrevImage();
        if (e.key === "ArrowRight") this.showNextImage();
      }
    });
  }

  showImageViewer(imageId) {
    const modal = document.getElementById("imageViewerModal");
    const img = document.getElementById("viewerImage");

    // Thêm token vào URL ảnh
    img.src = `/api/files/${imageId}?token=${this.token}`;

    modal.classList.remove("hidden");
    document.body.style.overflow = "hidden"; // Prevent scrolling

    // Find current image index
    this.currentImageIndex = this.currentImages.findIndex(
      (img) => img.id === imageId
    );
  }

  closeImageViewer() {
    const modal = document.getElementById("imageViewerModal");
    modal.classList.add("hidden");
    document.body.style.overflow = ""; // Restore scrolling
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
      const response = await fetch("/api/storage/info", {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      });

      if (!response.ok) throw new Error("Failed to load storage info");

      const data = await response.json();
      this.updateStorageUI(data);
    } catch (error) {
      console.error("Error loading storage info:", error);
      this.updateStorageUI({
        used: 0,
        total: 5 * 1024 * 1024 * 1024,
        percentage: 0,
      });
    }
  }

  updateStorageUI(data) {
    const usedGB = (data.used / (1024 * 1024 * 1024)).toFixed(1);
    const totalGB = (data.total / (1024 * 1024 * 1024)).toFixed(1);
    const percentage = data.percentage.toFixed(1);

    document.querySelector(".storage-text").innerHTML = `
            <span>Storage Used</span>
            <span>${usedGB}GB / ${totalGB}GB</span>
        `;

    document.querySelector(".storage-fill").style.width = `${percentage}%`;
  }

  setupMobileNavigation() {
    const navLinks = document.querySelectorAll(".navigation .nav-link");
    const sidebarLinks = document.querySelectorAll(".sidebar-nav .nav-item");

    const handleNavigation = async (view) => {
      // Cập nhật active state cho cả mobile và desktop
      [...navLinks, ...sidebarLinks].forEach((link) => {
        if (link.dataset.view === view) {
          link.classList.add("active");
        } else {
          link.classList.remove("active");
        }
      });

      try {
        switch (view) {
          case "home":
            // Reset state và load home view
            this.currentFolderId = null;
            this.folderPath = [];

            // Cập nhật breadcrumb ngay lập tức
            const breadcrumb = document.getElementById("breadcrumb");
            const foldersContainer =
              document.getElementById("foldersContainer");
            const galleryContainer = document.getElementById("imageGallery");

            if (breadcrumb) {
              breadcrumb.innerHTML = `
                                <i class="fas fa-folder"></i>
                                <span class="breadcrumb-item" data-id="">My Drive</span>
                            `;
            }

            // Load data
            const response = await fetch("/api/folders/", {
              headers: {
                Authorization: `Bearer ${this.token}`,
              },
            });

            if (!response.ok) throw new Error("Failed to load folder contents");

            const data = await response.json();

            // Render data
            if (foldersContainer) {
              if (data.folders && data.folders.length > 0) {
                this.renderFolders(data.folders);
              } else {
                foldersContainer.innerHTML =
                  '<div class="empty-message">No folders found</div>';
              }
            }

            if (galleryContainer) {
              if (data.files && data.files.length > 0) {
                this.renderFiles(data.files);
              } else {
                galleryContainer.innerHTML =
                  '<div class="empty-message">No files found</div>';
              }
            }
            break;

          case "recent":
            await this.loadRecentFiles();
            break;
          case "starred":
            await this.loadStarredFiles();
            break;
          case "trash":
            await this.loadTrashFiles();
            break;
        }
      } catch (error) {
        console.error("Navigation error:", error);
        

        const foldersContainer = document.getElementById("foldersContainer");
        const galleryContainer = document.getElementById("imageGallery");

        if (foldersContainer) {
          foldersContainer.innerHTML =
            '<div class="error-message">Failed to load folders</div>';
        }

        if (galleryContainer) {
          galleryContainer.innerHTML =
            '<div class="error-message">Failed to load files</div>';
        }
      }
    };

    // Xử lý click cho cả mobile navigation và sidebar
    [...navLinks, ...sidebarLinks].forEach((link) => {
      link.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();

        const view = link.dataset.view;

        // Hiển thị loading state trước khi xử lý
        const foldersContainer = document.getElementById("foldersContainer");
        const galleryContainer = document.getElementById("imageGallery");

        if (foldersContainer) {
          foldersContainer.innerHTML =
            '<div class="loading-message">Loading folders...</div>';
        }

        if (galleryContainer) {
          galleryContainer.innerHTML =
            '<div class="loading-message">Loading files...</div>';
        }

        // Xử lý navigation
        await handleNavigation(view);
      });
    });
  }

  // Cập nhật các phương thức xử lý cho từng view
  async loadRecentFiles() {
    try {
      const response = await fetch("/api/files/recent", {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      });

      if (!response.ok) throw new Error("Failed to load recent files");

      const data = await response.json();

      // Kiểm tra các container trước khi cập nhật
      const foldersContainer = document.getElementById("foldersContainer");
      const galleryContainer = document.getElementById("imageGallery");
      const breadcrumb = document.getElementById("breadcrumb");

      if (galleryContainer) {
        this.renderFiles(data.files);
      }

      if (foldersContainer) {
        foldersContainer.innerHTML = "";
      }

      if (breadcrumb) {
        breadcrumb.innerHTML = `
                    <i class="fas fa-clock"></i>
                    <span class="breadcrumb-item">Recent Files</span>
                `;
      }
    } catch (error) {
      console.error("Error loading recent files:", error);
      window.toast?.error("Failed to load recent files");
    }
  }

  async loadStarredFiles() {
    try {
      const response = await fetch("/api/files/starred", {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      });

      if (!response.ok) throw new Error("Failed to load starred files");

      const data = await response.json();

      const foldersContainer = document.getElementById("foldersContainer");
      const galleryContainer = document.getElementById("imageGallery");
      const breadcrumb = document.getElementById("breadcrumb");

      if (galleryContainer) {
        this.renderFiles(data.files);
      }

      if (foldersContainer) {
        foldersContainer.innerHTML = "";
      }

      if (breadcrumb) {
        breadcrumb.innerHTML = `
                    <i class="fas fa-star"></i>
                    <span class="breadcrumb-item">Starred Files</span>
                `;
      }
    } catch (error) {
      console.error("Error loading starred files:", error);
      window.toast?.error("Failed to load starred files");
    }
  }

  async loadTrashFiles() {
    try {
      const response = await fetch("/api/files/trash", {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      });

      if (!response.ok) throw new Error("Failed to load trash");

      const data = await response.json();

      const foldersContainer = document.getElementById("foldersContainer");
      const galleryContainer = document.getElementById("imageGallery");
      const breadcrumb = document.getElementById("breadcrumb");

      if (galleryContainer) {
        this.renderFiles(data.files);
      }

      if (foldersContainer) {
        foldersContainer.innerHTML = "";
      }

      if (breadcrumb) {
        breadcrumb.innerHTML = `
                    <i class="fas fa-trash"></i>
                    <span class="breadcrumb-item">Trash</span>
                `;
      }
    } catch (error) {
      console.error("Error loading trash:", error);
      window.toast?.error("Failed to load trash");
    }
  }

  closeAllModals() {
    document.querySelectorAll(".modal").forEach((modal) => {
      modal.classList.add("hidden");
    });
  }

  // Thêm hàm formatFileSize
  formatFileSize(bytes) {
    if (bytes === 0) return "0 B";

    const units = ["B", "KB", "MB", "GB", "TB"];
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + units[i];
  }

  // Add new method for connecting to shared folder
  async connectToSharedFolder(folderId) {
    try {
      const response = await fetch("/api/folders/connect", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ folderId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to connect to folder");
      }

      window.toast.success("Successfully connected to shared folder!");
      this.loadCurrentFolder();
    } catch (error) {
      window.toast.error(error.message || "Unknown Folder ID");
    }
  }

  // Thêm phương thức mới để hiển thị modal quản lý share
  async showShareManagement(folderId, folderName) {
    try {
      const response = await fetch(`/api/folders/${folderId}/shares`, {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      });

      if (!response.ok) throw new Error("Failed to load share info");
      const shares = await response.json();

      const modal = document.createElement("div");
      modal.className = "modal";
      modal.id = "shareManagementModal";
      modal.innerHTML = `
                <div class="modal-content share-management">
                    <h3>
                        <i class="fas fa-users"></i>
                        Manage Sharing - ${folderName}
                    </h3>
                    <div class="shares-list">
                        ${
                          shares.length
                            ? shares
                                .map(
                                  (share) => `
                            <div class="share-item" data-user-id="${
                              share.user_id
                            }">
                                <div class="user-info">
                                    <i class="fas fa-user"></i>
                                    <span>${share.username}</span>
                                </div>
                                <div class="permissions">
                                    <label class="permission-toggle">
                                        <input type="checkbox" class="view-images" 
                                            ${
                                              share.can_view_images
                                                ? "checked"
                                                : ""
                                            }>
                                        <span>View Images</span>
                                    </label>
                                    <label class="permission-toggle">
                                        <input type="checkbox" class="view-videos" 
                                            ${
                                              share.can_view_videos
                                                ? "checked"
                                                : ""
                                            }>
                                        <span>View Videos</span>
                                    </label>
                                </div>
                                <button class="remove-share-btn" title="Remove Access">
                                    <i class="fas fa-user-minus"></i>
                                </button>
                            </div>
                        `
                                )
                                .join("")
                            : '<p class="no-shares">No users have access to this folder yet</p>'
                        }
                    </div>
                    <div class="modal-buttons">
                        <button type="button" class="cancel-btn">
                            <i class="fas fa-times"></i>
                            Close
                        </button>
                    </div>
                </div>
            `;

      document.body.appendChild(modal);
      modal.classList.remove("hidden");

      // Event listeners cho các controls
      modal.querySelectorAll(".permission-toggle input").forEach((checkbox) => {
        checkbox.addEventListener("change", (e) => {
          const userId = e.target.closest(".share-item").dataset.userId;
          const permission = e.target.classList.contains("view-images")
            ? "images"
            : "videos";
          this.updateSharePermissions(
            folderId,
            userId,
            permission,
            e.target.checked
          );
        });
      });

      modal.querySelectorAll(".remove-share-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const shareItem = e.target.closest(".share-item");
          const userId = shareItem.dataset.userId;
          const username =
            shareItem.querySelector(".user-info span").textContent;
          this.removeShare(folderId, userId, username);
        });
      });

      modal.querySelector(".cancel-btn").addEventListener("click", () => {
        modal.remove();
      });
    } catch (error) {
      console.error("Error showing share management:", error);
      window.toast.error("Failed to load sharing information");
    }
  }

  // Thêm phương thức để cập nhật quyền
  async updateSharePermissions(folderId, userId, permission, value) {
    try {
      const response = await fetch(
        `/api/folders/${folderId}/shares/${userId}/permissions`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${this.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            permission,
            value,
          }),
        }
      );

      if (!response.ok) throw new Error("Failed to update permissions");
      window.toast.success("Permissions updated successfully");
    } catch (error) {
      console.error("Error updating permissions:", error);
      window.toast.error("Failed to update permissions");
    }
  }

  // Thêm phương thức để xóa share
  async removeShare(folderId, userId, username) {
    // Tạo và hiển thị modal xác nhận
    const confirmModal = document.createElement("div");
    confirmModal.className = "modal confirmation-modal";
    confirmModal.innerHTML = `
            <div class="modal-content confirmation-dialog">
                <div class="confirmation-icon warning">
                    <i class="fas fa-exclamation-triangle"></i>
                </div>
                <h3>Remove Access</h3>
                <p>Are you sure you want to remove <strong>${username}</strong>'s access?</p>
                <div class="confirmation-buttons">
                    <button class="cancel-btn">
                        <i class="fas fa-times"></i>
                        Cancel
                    </button>
                    <button class="confirm-btn">
                        <i class="fas fa-check"></i>
                        Confirm
                    </button>
                </div>
            </div>
        `;

    document.body.appendChild(confirmModal);
    confirmModal.classList.remove("hidden");

    // Xử lý response thông qua Promise
    const result = await new Promise((resolve) => {
      const confirmBtn = confirmModal.querySelector(".confirm-btn");
      const cancelBtn = confirmModal.querySelector(".cancel-btn");

      confirmBtn.addEventListener("click", () => {
        confirmModal.remove();
        resolve(true);
      });

      cancelBtn.addEventListener("click", () => {
        confirmModal.remove();
        resolve(false);
      });

      // Click outside to cancel
      confirmModal.addEventListener("click", (e) => {
        if (e.target === confirmModal) {
          confirmModal.remove();
          resolve(false);
        }
      });
    });

    // Nếu người dùng xác nhận, thực hiện xóa
    if (result) {
      try {
        const response = await fetch(
          `/api/folders/${folderId}/shares/${userId}`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${this.token}`,
            },
          }
        );

        if (!response.ok) throw new Error("Failed to remove access");

        const shareItem = document.querySelector(
          `.share-item[data-user-id="${userId}"]`
        );
        shareItem.remove();

        window.toast.success("Access removed successfully");
      } catch (error) {
        console.error("Error removing share:", error);
        window.toast.error("Failed to remove access");
      }
    }
  }

  setupWebSocket() {
    try {
        this.socket = io();

        this.socket.on('connect', () => {
            console.log('Socket connected');
            const token = localStorage.getItem('token');
            if (token) {
                const decoded = jwt_decode(token);
                this.socket.emit('join-user-space', decoded.id);
            }
        });

        this.socket.on('folder-created', (newFolder) => {
            console.log('New folder created:', newFolder);
            
            // Chỉ cập nhật nếu đang ở cùng thư mục cha
            if (this.currentFolderId === newFolder.parent_id) {
                // Kiểm tra xem folder đã tồn tại chưa
                if (!this.currentFolders.some(f => f.id === newFolder.id)) {
                    this.currentFolders.push(newFolder);
                    // Gọi renderFolders với mảng folders mới
                    this.renderFolders([...this.currentFolders]);
                    
                    // Thông báo cho người dùng
                    window.toast.info(`New folder "${newFolder.name}" has been added`);
                }
            }
        });

        this.socket.on('disconnect', () => {
            console.log('Socket disconnected');
            // Thử kết nối lại sau 5 giây
            setTimeout(() => {
                this.socket.connect();
            }, 5000);
        });

        this.socket.on('error', (error) => {
            console.error('Socket error:', error);
        });

    } catch (error) {
        console.error('Error setting up WebSocket:', error);
    }
  }

  setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Remove active class from all items
            navItems.forEach(nav => nav.classList.remove('active'));
            
            // Add active class to clicked item
            item.classList.add('active');
            
            const view = item.dataset.view;
            this.switchView(view);
        });
    });
  }
  switchView(view) {
    // Hide all views
    document.querySelectorAll('.view-container').forEach(container => {
        container.classList.remove('active');
    });

    // Show selected view
    const viewContainer = document.querySelector(`.${view}-view`);
    if (!viewContainer) return;

    switch(view) {
        case 'home':
            viewContainer.classList.add('active');
            break;

        case 'recent':
            viewContainer.innerHTML = `
                <div class="recent-container">
                    <div class="recent-header">
                        <h2><i class="fas fa-clock"></i> Recent Files</h2>
                        <div class="time-filter">
                            <button class="filter-btn active">
                                <i class="fas fa-calendar-day"></i>
                                Today
                            </button>
                            <button class="filter-btn">
                                <i class="fas fa-calendar-week"></i>
                                This Week
                            </button>
                            <button class="filter-btn">
                                <i class="fas fa-calendar-alt"></i>
                                This Month
                            </button>
                        </div>
                    </div>
                    <div class="recent-content">
                        <div class="timeline">
                            <div class="timeline-section">
                                <div class="timeline-header">
                                    <span class="date">Today</span>
                                    <span class="count">5 files</span>
                                </div>
                                <div class="timeline-grid">
                                    <!-- Placeholder for files -->
                                    <div class="file-card">
                                        <div class="file-icon"><i class="fas fa-file-image"></i></div>
                                        <div class="file-info">
                                            <div class="file-name">Image1.jpg</div>
                                            <div class="file-date">2 hours ago</div>
                                        </div>
                                    </div>
                                    <!-- Add more placeholder files as needed -->
                                </div>
                            </div>
                            <div class="timeline-section">
                                <div class="timeline-header">
                                    <span class="date">Yesterday</span>
                                    <span class="count">3 files</span>
                                </div>
                                <div class="timeline-grid">
                                    <!-- Placeholder for files -->
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            viewContainer.classList.add('active');
            break;

        case 'starred':
            viewContainer.innerHTML = `
                <div class="starred-container">
                    <div class="starred-header">
                        <h2><i class="fas fa-star"></i> Starred Files</h2>
                        <div class="view-options">
                            <button class="view-btn grid-view active">
                                <i class="fas fa-th-large"></i>
                            </button>
                            <button class="view-btn list-view">
                                <i class="fas fa-list"></i>
                            </button>
                        </div>
                    </div>
                    <div class="starred-content">
                        <div class="filter-chips">
                            <button class="chip active">All Files</button>
                            <button class="chip">Images</button>
                            <button class="chip">Documents</button>
                            <button class="chip">Videos</button>
                        </div>
                        <div class="starred-grid">
                            <!-- Placeholder for starred files -->
                            <div class="file-card">
                                <div class="file-icon"><i class="fas fa-star"></i></div>
                                <div class="file-info">
                                    <div class="file-name">Important.pdf</div>
                                    <div class="file-date">Starred yesterday</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            viewContainer.classList.add('active');
            break;

        case 'trash':
            viewContainer.innerHTML = `
                <div class="trash-container">
                    <div class="trash-header">
                        <h2><i class="fas fa-trash"></i> Trash</h2>
                        <div class="trash-actions">
                            <button class="restore-all-btn">
                                <i class="fas fa-undo"></i>
                                Restore All
                            </button>
                            <button class="empty-trash-btn">
                                <i class="fas fa-trash-alt"></i>
                                Empty Trash
                            </button>
                        </div>
                    </div>
                    <div class="trash-content">
                        <div class="trash-info">
                            <i class="fas fa-info-circle"></i>
                            <span>Items in trash will be automatically deleted after 30 days</span>
                        </div>
                        <div class="trash-grid">
                            <!-- Placeholder for trash items -->
                            <div class="file-card">
                                <div class="file-icon"><i class="fas fa-file"></i></div>
                                <div class="file-info">
                                    <div class="file-name">Deleted.txt</div>
                                    <div class="file-date">Deleted 2 days ago</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            viewContainer.classList.add('active');
            break;
    }
  }
}

// Initialize ImageUploader after DOM content is loaded
document.addEventListener("DOMContentLoaded", () => {
  if (localStorage.getItem("token")) {
    window.imageUploader = new ImageUploader();
  }
}); // Global function for closing modals
window.closeModal = function (modalId) {
  document.getElementById(modalId).style.display = "none";
};

