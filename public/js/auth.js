class Auth {
    constructor() {
        this.token = localStorage.getItem('token');
        this.setupEventListeners();
        this.checkAuthValidity();
    }

    setupEventListeners() {
        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(button => {
            button.addEventListener('click', () => this.switchTab(button.dataset.form));
        });

        // Form submissions
        document.getElementById('loginForm').addEventListener('submit', (e) => this.handleLogin(e));
        document.getElementById('registerForm').addEventListener('submit', (e) => this.handleRegister(e));
        document.getElementById('logoutBtn').addEventListener('click', () => this.handleLogout());
    }

    async checkAuthValidity() {
        if (!this.token) {
            this.showAuthForms();
            return;
        }

        try {
            // Thêm một endpoint mới để verify token
            const response = await fetch('/auth/verify', {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (!response.ok) {
                throw new Error('Token invalid');
            }

            this.showMainContent();
        } catch (error) {
            console.error('Auth check failed:', error);
            this.handleLogout(); // Tự động logout nếu token không hợp lệ
        }
    }

    showAuthForms() {
        document.getElementById('authForms').classList.remove('hidden');
        document.getElementById('mainContent').classList.add('hidden');
    }

    showMainContent() {
        document.getElementById('authForms').classList.add('hidden');
        document.getElementById('mainContent').classList.remove('hidden');
    }

    switchTab(formId) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.form === formId);
        });
        document.querySelectorAll('.auth-form').forEach(form => {
            form.classList.toggle('hidden', form.id !== `${formId}Form`);
        });
    }

    async handleLogin(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = {
            username: formData.get('username'),
            password: formData.get('password')
        };

        try {
            const response = await fetch('/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.error);

            localStorage.setItem('token', result.token);
            this.token = result.token;
            window.toast.success('Login successful! Welcome back!');
            window.location.reload();
        } catch (error) {
            window.toast.error(error.message);
            document.getElementById('loginError').textContent = error.message;
        }
    }

    async handleRegister(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = {
            username: formData.get('username'),
            password: formData.get('password')
        };

        try {
            const response = await fetch('/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.error);

            window.toast.success('Registration successful! Please login.');
            this.switchTab('login');
            document.getElementById('registerError').textContent = '';
            document.getElementById('loginError').textContent = 'Registration successful! Please login.';
        } catch (error) {
            window.toast.error(error.message);
            document.getElementById('registerError').textContent = error.message;
        }
    }

    handleLogout() {
        localStorage.removeItem('token');
        this.token = null;
        window.location.reload(); // Reload trang sau khi logout
    }
}

// Initialize Auth
const auth = new Auth(); 

document.querySelectorAll('.toggle-password').forEach(button => {
    button.addEventListener('click', function() {
        const input = this.previousElementSibling;
        const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
        input.setAttribute('type', type);
        
        // Thay đổi icon
        const icon = this.querySelector('i');
        icon.classList.toggle('fa-eye');
        icon.classList.toggle('fa-eye-slash');
    });
}); 