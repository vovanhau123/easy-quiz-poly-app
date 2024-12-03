class ToastManager {
    constructor() {
        this.container = document.getElementById('toastContainer');
    }

    show(message, type = 'success', duration = 3000) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        toast.innerHTML = `
            <div class="toast-content">${message}</div>
            <div class="toast-progress"></div>
        `;

        this.container.appendChild(toast);

        // Xóa toast sau khi hết thời gian
        setTimeout(() => {
            toast.classList.add('removing');
            toast.addEventListener('animationend', () => {
                toast.remove();
            });
        }, duration);
    }

    success(message) {
        this.show(message, 'success');
    }

    error(message) {
        this.show(message, 'error', 5000); // Thời gian hiển thị lâu hơn cho lỗi
    }

    warning(message) {
        this.show(message, 'warning', 4000); // Thời gian trung bình cho cảnh báo
    }
}

window.toast = new ToastManager(); 