class Auth {
    constructor() {
        this.token = localStorage.getItem('token');
        this.currentEmail = localStorage.getItem('pendingVerification');
        this.countdownTime = parseInt(localStorage.getItem('resendCountdown')) || 0;
        this.setupEventListeners();
        this.checkAuthValidity();
        
        if (this.currentEmail) {
            this.showVerificationOnly();
            this.setupResendCode();
        }
    }

    setupEventListeners() {
        document.querySelectorAll('.tab-btn').forEach(button => {
            button.addEventListener('click', () => {
                if (localStorage.getItem('pendingVerification')) {
                    window.toast.error('Please complete verification first');
                    return;
                }
                this.switchTab(button.dataset.form);
            });
        });

        document.getElementById('loginForm').addEventListener('submit', (e) => {
            if (localStorage.getItem('pendingVerification')) {
                e.preventDefault();
                window.toast.error('Please complete verification first');
                this.showVerificationOnly();
                return;
            }
            this.handleLogin(e);
        });
        document.getElementById('registerForm').addEventListener('submit', (e) => this.handleRegister(e));
        document.getElementById('verificationForm').addEventListener('submit', (e) => this.handleVerification(e));
        document.getElementById('logoutBtn').addEventListener('click', () => this.handleLogout());

        document.querySelectorAll('.toggle-password').forEach(button => {
            button.addEventListener('click', function() {
                const input = this.previousElementSibling;
                const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
                input.setAttribute('type', type);
                
                const icon = this.querySelector('i');
                icon.classList.toggle('fa-eye');
                icon.classList.toggle('fa-eye-slash');
            });
        });
    }

    setupResendCode() {
        const resendBtn = document.getElementById('resendCodeBtn');
        const countdownEl = document.getElementById('countdownTimer');
        
        // Kiểm tra nếu đang trong thời gian chờ
        if (this.countdownTime > 0) {
            this.startCountdown(this.countdownTime);
        }

        resendBtn.addEventListener('click', async () => {
            if (resendBtn.disabled) return;

            try {
                const response = await fetch('/auth/resend-code', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: this.currentEmail })
                });

                const result = await response.json();
                if (!response.ok) throw new Error(result.error);

                window.toast.success('Verification code resent! Please check your email.');
                this.startCountdown(60);
            } catch (error) {
                window.toast.error(error.message);
            }
        });
    }

    startCountdown(seconds) {
        const resendBtn = document.getElementById('resendCodeBtn');
        const countdownEl = document.getElementById('countdownTimer');
        
        resendBtn.disabled = true;
        countdownEl.classList.remove('hidden');
        
        let timeLeft = seconds;
        this.countdownTime = timeLeft;
        localStorage.setItem('resendCountdown', timeLeft);

        const updateCountdown = () => {
            countdownEl.textContent = `${timeLeft}s`;
            localStorage.setItem('resendCountdown', timeLeft);
            
            if (timeLeft <= 0) {
                clearInterval(this.countdownInterval);
                resendBtn.disabled = false;
                countdownEl.classList.add('hidden');
                this.countdownTime = 0;
                localStorage.removeItem('resendCountdown');
            }
            timeLeft--;
        };

        updateCountdown();
        this.countdownInterval = setInterval(updateCountdown, 1000);
    }

    showVerificationOnly() {
        document.querySelectorAll('.auth-form').forEach(form => {
            form.classList.add('hidden');
        });
        
        document.getElementById('verificationForm').classList.remove('hidden');
        
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
            btn.style.opacity = '0.5';
            btn.style.cursor = 'not-allowed';
        });
    }

    resetAuthUI() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.style.opacity = '';
            btn.style.cursor = '';
        });
        
        this.switchTab('login');
    }

    async checkAuthValidity() {
        if (!this.token) {
            this.showAuthForms();
            return;
        }

        try {
            const response = await fetch('/auth/verify-token', {
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
            this.handleLogout();
        }
    }

    showAuthForms() {
        document.getElementById('authForms').classList.remove('hidden');
        document.getElementById('mainContent').classList.add('hidden');
        document.body.classList.add('auth-active');
    }

    hideAuthForms() {
        document.getElementById('authForms').classList.add('hidden');
        document.getElementById('mainContent').classList.remove('hidden');
        document.body.classList.remove('auth-active');
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
        const username = document.getElementById('loginUsername').value;
        const password = document.getElementById('loginPassword').value;

        try {
            const response = await fetch('/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.error);

            localStorage.setItem('token', result.token);
            this.token = result.token;
            window.toast.success('Login successful! Welcome back!');
            window.location.reload();
        } catch (error) {
            window.toast.error(error.message);
        }
    }

    async handleRegister(e) {
        e.preventDefault();
        
        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating Account...';

        const username = document.getElementById('registerUsername').value;
        const email = document.getElementById('registerEmail').value.trim();
        const password = document.getElementById('registerPassword').value;

        if (!email) {
            window.toast.error('Email is required');
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-user-plus"></i> Create Account';
            return;
        }

        try {
            const response = await fetch('/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password })
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.error);

            this.currentEmail = email;
            localStorage.setItem('pendingVerification', email);
            document.getElementById('registerForm').classList.add('hidden');
            document.getElementById('verificationForm').classList.remove('hidden');
            window.toast.success('Registration successful! Please check your email for verification code.');
            
            e.target.reset();
            
        } catch (error) {
            window.toast.error(error.message);
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-user-plus"></i> Create Account';
        }
    }

    async handleVerification(e) {
        e.preventDefault();
        const code = document.getElementById('verificationCode').value.trim();

        if (!code) {
            window.toast.error('Verification code is required');
            return;
        }

        try {
            const response = await fetch('/auth/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    email: this.currentEmail,
                    code: code
                })
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.error);

            localStorage.removeItem('pendingVerification');
            this.currentEmail = null;
            window.toast.success('Account verified successfully! Please login.');
            
            this.resetAuthUI();
            e.target.reset();
        } catch (error) {
            window.toast.error(error.message);
        }
    }

    handleLogout() {
        localStorage.removeItem('token');
        this.token = null;
        window.location.reload();
    }
}

const auth = new Auth(); 