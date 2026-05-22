function getAPIURL() {
    return `${window.location.origin}/api`;
}

const tabActive = 'flex-1 py-3 text-sm font-semibold rounded-lg bg-white dark:bg-slate-700 text-navy dark:text-white shadow-sm';
const tabIdle   = 'flex-1 py-3 text-sm font-medium rounded-lg text-slate-500 dark:text-slate-400 hover:text-navy dark:hover:text-white';

function resetPasswordField(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    input.type = 'password';
    const wrap = input.closest('.relative');
    const btn  = wrap && wrap.querySelector('button[type="button"]');
    const icon = btn && btn.querySelector('.pwd-toggle-icon');
    if (icon) icon.textContent = 'visibility';
    if (btn)  btn.setAttribute('aria-label', 'Show password');
}

function togglePasswordVisibility(inputId, button) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const icon = button.querySelector('.pwd-toggle-icon');
    if (input.type === 'password') {
        input.type = 'text';
        if (icon) icon.textContent = 'visibility_off';
        button.setAttribute('aria-label', 'Hide password');
    } else {
        input.type = 'password';
        if (icon) icon.textContent = 'visibility';
        button.setAttribute('aria-label', 'Show password');
    }
}

function showTab(which) {
    const signin = document.getElementById('panel-signin');
    const signup = document.getElementById('panel-signup');
    const tabIn  = document.getElementById('tab-signin');
    const tabUp  = document.getElementById('tab-signup');
    if (which === 'signin') {
        signin.classList.remove('hidden');
        signup.classList.add('hidden');
        tabIn.className = tabActive;
        tabUp.className = tabIdle;
        resetPasswordField('reg-password');
    } else {
        signup.classList.remove('hidden');
        signin.classList.add('hidden');
        tabUp.className = tabActive;
        tabIn.className = tabIdle;
        resetPasswordField('login-password');
    }
}

// ── Email validation ──────────────────────────────────────────────────────────
const emailRegex = /^[a-zA-Z0-9._%+-]{3,}@[a-zA-Z0-9.-]+\.(com|net|org|edu|io|co|uk|de|fr|eg|gov|me)$/;

function validateEmail(value) {
    return !value.includes(' ') && emailRegex.test(value);
}

function applyEmailFeedback(inputEl, feedbackEl, value) {
    if (!value) {
        feedbackEl.classList.add('hidden');
        inputEl.style.borderColor = '';
        return false;
    }
    const valid = validateEmail(value);
    feedbackEl.classList.remove('hidden');
    if (valid) {
        feedbackEl.innerHTML =
            '<span style="display:flex;align-items:center;gap:4px;color:#16a34a">' +
            '<span class="material-icons-round" style="font-size:14px">check_circle</span> Valid email</span>';
        inputEl.style.borderColor = '#22c55e';
    } else {
        feedbackEl.innerHTML =
            '<span style="display:block;color:#dc2626">Please enter a valid email address (e.g. name@gmail.com)</span>' +
            '<span style="display:block;color:#dc2626;direction:rtl;text-align:right">يرجى إدخال بريد إلكتروني صحيح (مثال: name@gmail.com)</span>';
        inputEl.style.borderColor = '#f87171';
    }
    return valid;
}

// ── Password strength ─────────────────────────────────────────────────────────
const pwdRules = [
    { id: 'rule-len',   test: v => v.length >= 8 },
    { id: 'rule-upper', test: v => /[A-Z]/.test(v) },
    { id: 'rule-lower', test: v => /[a-z]/.test(v) },
    { id: 'rule-num',   test: v => /[0-9]/.test(v) },
    { id: 'rule-spec',  test: v => /[!@#$%^&*_\-+=?.,]/.test(v) },
];

function isPasswordStrong(value) {
    return pwdRules.every(r => r.test(value));
}

function updatePasswordUI(value) {
    const met   = pwdRules.map(r => r.test(value));
    const count = met.filter(Boolean).length;

    met.forEach((ok, i) => {
        const li   = document.getElementById(pwdRules[i].id);
        if (!li) return;
        const icon = li.querySelector('.rule-icon');
        if (ok) {
            li.style.color = '#16a34a';
            if (icon) icon.textContent = '✓';
        } else {
            li.style.color = '';
            li.className   = 'flex items-center gap-1.5 text-slate-400 dark:text-slate-500';
            if (icon) icon.textContent = '○';
        }
    });

    const bar   = document.getElementById('pwd-strength-bar');
    const label = document.getElementById('pwd-strength-label');
    if (!bar || !label) return;

    bar.style.width = (count / 5 * 100) + '%';

    const levels = [
        { color: '#ef4444', text: 'Weak' },   // 0
        { color: '#ef4444', text: 'Weak' },   // 1
        { color: '#ef4444', text: 'Weak' },   // 2
        { color: '#f97316', text: 'Fair' },   // 3
        { color: '#3b82f6', text: 'Good' },   // 4
        { color: '#22c55e', text: 'Strong' }, // 5
    ];
    const lvl = levels[count];
    bar.style.backgroundColor  = lvl.color;
    label.textContent          = count > 0 ? lvl.text : '';
    label.style.color          = lvl.color;
}

// ── Signup form validation ────────────────────────────────────────────────────
function validateSignupForm() {
    const emailInput    = document.getElementById('reg-email');
    const emailFeedback = document.getElementById('reg-email-feedback');
    const passwordInput = document.getElementById('reg-password');
    const err           = document.getElementById('register-error');

    const errors = [];

    const emailOk = applyEmailFeedback(emailInput, emailFeedback, emailInput.value.trim());
    if (!emailOk) errors.push('invalid_email');

    const pwdStrong = isPasswordStrong(passwordInput.value);
    if (!pwdStrong) {
        errors.push('weak_password');
        passwordInput.style.borderColor = '#f87171';
        // Make sure strength panel is visible so user sees what to fix
        const wrap = document.getElementById('pwd-strength-wrap');
        if (wrap) wrap.classList.remove('hidden');
        updatePasswordUI(passwordInput.value);
    } else {
        passwordInput.style.borderColor = '#22c55e';
    }

    if (errors.length > 0) {
        const lines = [];
        if (errors.includes('weak_password')) {
            lines.push('Password must be strong. Please meet all requirements.');
            lines.push('<span dir="rtl" style="display:block;text-align:right">يجب أن تكون كلمة المرور قوية. يرجى استيفاء جميع المتطلبات</span>');
        }
        err.innerHTML = lines.join('<br>');
        err.classList.remove('hidden');

        const firstError = errors.includes('invalid_email') ? emailInput : passwordInput;
        firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return false;
    }

    err.classList.add('hidden');
    return true;
}

// ── Auth handlers ─────────────────────────────────────────────────────────────
async function submitLogin(e) {
    e.preventDefault();
    const email    = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const err      = document.getElementById('login-error');
    err.classList.add('hidden');
    try {
        const res = await fetch(`${getAPIURL()}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || data.message || 'Login failed');
        sessionStorage.setItem('lawgic_token', data.token);
        sessionStorage.setItem('lawgic_user', JSON.stringify(data.user));
        window.location.href = 'app.html';
    } catch (ex) {
        err.textContent = ex.message || 'Login failed';
        err.classList.remove('hidden');
    }
}

async function submitRegister(e) {
    e.preventDefault();
    if (!validateSignupForm()) return;

    const email    = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const fullName = document.getElementById('reg-name').value.trim();
    const err      = document.getElementById('register-error');
    err.classList.add('hidden');

    try {
        const res = await fetch(`${getAPIURL()}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, fullName: fullName || undefined })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || data.message || 'Registration failed');
        sessionStorage.setItem('lawgic_token', data.token);
        sessionStorage.setItem('lawgic_user', JSON.stringify(data.user));
        window.location.href = 'app.html';
    } catch (ex) {
        err.textContent = ex.message || 'Registration failed';
        err.classList.remove('hidden');
    }
}

// ── Event wiring ──────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    if (sessionStorage.getItem('lawgic_token')) {
        window.location.href = 'app.html';
        return;
    }

    // Email — validate on blur; update live after first blur
    const regEmail      = document.getElementById('reg-email');
    const emailFeedback = document.getElementById('reg-email-feedback');
    if (regEmail && emailFeedback) {
        regEmail.addEventListener('blur', () => {
            applyEmailFeedback(regEmail, emailFeedback, regEmail.value.trim());
        });
        regEmail.addEventListener('input', () => {
            if (!emailFeedback.classList.contains('hidden')) {
                applyEmailFeedback(regEmail, emailFeedback, regEmail.value.trim());
            }
        });
    }

    // Password — show strength panel on focus, update live, hide on blur if strong
    const regPassword  = document.getElementById('reg-password');
    const strengthWrap = document.getElementById('pwd-strength-wrap');
    if (regPassword && strengthWrap) {
        regPassword.addEventListener('focus', () => {
            strengthWrap.classList.remove('hidden');
            updatePasswordUI(regPassword.value);
        });
        regPassword.addEventListener('input', () => {
            updatePasswordUI(regPassword.value);
            if (isPasswordStrong(regPassword.value)) {
                regPassword.style.borderColor = '#22c55e';
            } else {
                regPassword.style.borderColor = '';
            }
        });
        regPassword.addEventListener('blur', () => {
            if (isPasswordStrong(regPassword.value)) {
                strengthWrap.classList.add('hidden');
            }
        });
    }
});
