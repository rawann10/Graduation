// ========================================
// API and Auth Helpers
// ========================================
function getAPIURL() {
    return `${window.location.origin}/api`;
}

function getAuthHeaders() {
    const token = sessionStorage.getItem('lawgic_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
}

function getCurrentUser() {
    const stored = sessionStorage.getItem('lawgic_user');
    return stored ? JSON.parse(stored) : null;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ========================================
// Theme Management
// ========================================
function loadTheme() {
    const saved = localStorage.getItem('theme') || 'light';
    if (saved === 'dark') {
        document.documentElement.classList.add('dark');
        const icon = document.getElementById('themeIcon');
        if (icon) icon.textContent = 'light_mode';
    }
}

function toggleTheme() {
    const html = document.documentElement;
    const dark = html.classList.toggle('dark');
    localStorage.setItem('theme', dark ? 'dark' : 'light');
    const icon = document.getElementById('themeIcon');
    if (icon) icon.textContent = dark ? 'light_mode' : 'dark_mode';
}

// ========================================
// Page Navigation
// ========================================
let currentPage = 'dashboard';

function showPage(pageName) {
    // Hide all pages
    document.querySelectorAll('.page-content').forEach(page => {
        page.classList.add('hidden');
    });

    // Show selected page
    const pageElement = document.getElementById(pageName + 'Page');
    if (pageElement) {
        pageElement.classList.remove('hidden');
    }

    // Update nav buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('sidebar-active', 'bg-primary/10', 'dark:bg-primary/20', 'border-l-4', 'border-primary', 'text-primary');
        btn.classList.add('hover:bg-slate-100', 'dark:hover:bg-slate-800');
    });

    const activeBtn = document.querySelector(`[data-page="${pageName}"]`);
    if (activeBtn) {
        activeBtn.classList.add('sidebar-active', 'bg-primary/10', 'dark:bg-primary/20', 'border-l-4', 'border-primary', 'text-primary');
        activeBtn.classList.remove('hover:bg-slate-100', 'dark:hover:bg-slate-800');
    }

    currentPage = pageName;

    // Load page data
    if (pageName === 'dashboard') {
        loadDashboard();
    } else if (pageName === 'users') {
        loadUsers();
    } else if (pageName === 'documents') {
        loadDocuments();
    } else if (pageName === 'results') {
        loadResults();
    }
}

// ========================================
// Dashboard Data
// ========================================
async function loadDashboard() {
    try {
        const res = await fetch(`${getAPIURL()}/admin/summary`, { headers: getAuthHeaders() });
        if (!res.ok) throw new Error('Failed to load summary');
        
        const data = await res.json();
        
        document.getElementById('statTotalUsers').textContent = data.totalUsers || 0;
        document.getElementById('statAdminUsers').textContent = data.adminUsers || 0;

        // Load recent activity
        loadRecentActivity();
    } catch (err) {
        console.error('Dashboard load error:', err);
    }
}

async function loadRecentActivity() {
    try {
        const activityList = document.getElementById('recentActivityList');
        activityList.innerHTML = '';

        const res = await fetch(`${getAPIURL()}/admin/activity`, { 
            headers: getAuthHeaders(),
            method: 'GET'
        });

        if (!res.ok) {
            activityList.innerHTML = '<p class="text-sm text-slate-500">No recent activity</p>';
            return;
        }

        const activities = await res.json();
        
        if (!activities || activities.length === 0) {
            activityList.innerHTML = '<p class="text-sm text-slate-500">No recent activity</p>';
            return;
        }

        activities.slice(0, 5).forEach(activity => {
            const timeAgo = getTimeAgo(new Date(activity.timestamp));
            const div = document.createElement('div');
            div.className = 'flex items-start gap-3 pb-3 border-b border-slate-200 dark:border-slate-700 last:border-0';
            div.innerHTML = `
                <div class="flex-shrink-0">
                    <span class="inline-flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 text-primary">
                        <span class="material-icons-round text-sm">event</span>
                    </span>
                </div>
                <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-slate-900 dark:text-white">${activity.description || 'Activity'}</p>
                    <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">${timeAgo}</p>
                </div>
            `;
            activityList.appendChild(div);
        });
    } catch (err) {
        console.error('Activity load error:', err);
        document.getElementById('recentActivityList').innerHTML = '<p class="text-sm text-slate-500">Could not load activity</p>';
    }
}

function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    let interval = seconds / 31536000;

    if (interval > 1) return Math.floor(interval) + ' years ago';
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + ' months ago';
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + ' days ago';
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + ' hours ago';
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + ' minutes ago';
    return Math.floor(seconds) + ' seconds ago';
}

// ========================================
// Users Page
// ========================================
async function loadUsers() {
    try {
        const res = await fetch(`${getAPIURL()}/admin/users`, { headers: getAuthHeaders() });
        if (!res.ok) throw new Error('Failed to load users');

        const users = await res.json();
        const tbody = document.getElementById('usersTable');
        tbody.innerHTML = '';

        if (!users || users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-4 text-center text-sm text-slate-500">No users found</td></tr>';
            return;
        }

        users.forEach(user => {
            const createdAt = new Date(user.createdAt).toLocaleDateString();
            const roleBadgeClass = user.role === 'admin' 
                ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-400';
            
            const tr = document.createElement('tr');
            tr.className = 'border-b border-slate-200 dark:border-slate-700 table-row-hover';
            tr.innerHTML = `
                <td class="px-6 py-4 text-sm font-medium text-slate-900 dark:text-white">${escapeHtml(user.fullName || user.email)}</td>
                <td class="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">${escapeHtml(user.email)}</td>
                <td class="px-6 py-4 text-sm">
                    <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${roleBadgeClass}">
                        ${user.role === 'admin' ? '👑 Admin' : '👤 User'}
                    </span>
                </td>
                <td class="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">${createdAt}</td>
                <td class="px-6 py-4 text-sm space-x-2">
                    <button onclick="editUser(${user.id})" class="text-blue-600 hover:underline">Edit</button>
                    <button onclick="deleteUser(${user.id})" class="text-red-600 hover:underline">Delete</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error('Users load error:', err);
        document.getElementById('usersTable').innerHTML = `<tr><td colspan="5" class="px-6 py-4 text-center text-sm text-red-600">Error loading users</td></tr>`;
    }
}

// Add new user (open modal)
function addNewUser() {
    openUserModal();
}

// Edit user (fetch data and open modal)
async function editUser(userId) {
    try {
        const res = await fetch(`${getAPIURL()}/admin/users`, { headers: getAuthHeaders() });
        if (!res.ok) throw new Error('Failed to load users');
        
        const users = await res.json();
        const user = users.find(u => u.id === userId);
        
        if (!user) throw new Error('User not found');
        
        // Populate form
        const names = (user.fullName || '').split(' ');
        const firstName = names[0] || '';
        const lastName = names.slice(1).join(' ') || '';
        
        document.getElementById('userFormFirstName').value = firstName;
        document.getElementById('userFormLastName').value = lastName;
        document.getElementById('userFormEmail').value = user.email || '';
        document.getElementById('userFormRole').value = user.role || 'user';
        
        openUserModal(userId);
    } catch (err) {
        showError(err.message);
    }
}

// Delete user
async function deleteUser(userId) {
    if (!confirm('Are you sure you want to delete this user?')) return;

    try {
        const res = await fetch(`${getAPIURL()}/admin/users/${userId}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Failed to delete user');
        }

        showSuccess('User deleted successfully');
        loadUsers();
        loadDashboard();
    } catch (err) {
        showError(err.message);
    }
}

// ========================================
// Documents Page
// ========================================
async function loadDocuments() {
    try {
        const res = await fetch(`${getAPIURL()}/admin/documents`, { headers: getAuthHeaders() });
        
        const tbody = document.getElementById('documentsTable');
        tbody.innerHTML = '';

        if (!res.ok) {
            tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-4 text-center text-sm text-slate-500">No documents found</td></tr>';
            return;
        }

        const documents = await res.json();
        
        if (!documents || documents.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-4 text-center text-sm text-slate-500">No documents found</td></tr>';
            return;
        }

        documents.forEach(doc => {
            const uploadDate = new Date(doc.uploadedAt).toLocaleDateString();
            const statusClass = {
                'pending': 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
                'analyzing': 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
                'analyzed': 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
                'error': 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
            }[doc.status] || 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-400';
            
            const tr = document.createElement('tr');
            tr.className = 'border-b border-slate-200 dark:border-slate-700 table-row-hover';
            tr.innerHTML = `
                <td class="px-6 py-4 text-sm font-medium text-slate-900 dark:text-white">${escapeHtml(doc.filename || 'Document')}</td>
                <td class="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">${uploadDate}</td>
                <td class="px-6 py-4 text-sm">
                    <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${statusClass}">
                        ${doc.status.charAt(0).toUpperCase() + doc.status.slice(1)}
                    </span>
                </td>
                <td class="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">${doc.userId || '-'}</td>
                <td class="px-6 py-4 text-sm space-x-2">
                    <button onclick="editDocument(${doc.id})" class="text-blue-600 hover:underline">Edit</button>
                    <button onclick="deleteDocument(${doc.id})" class="text-red-600 hover:underline">Delete</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error('Documents load error:', err);
        document.getElementById('documentsTable').innerHTML = `<tr><td colspan="5" class="px-6 py-4 text-center text-sm text-red-600">Error loading documents</td></tr>`;
    }
}

// Add new document
async function addNewDocument() {
    const filename = prompt('Enter document filename:');
    if (!filename) return;

    const userIdStr = prompt('Enter user ID (optional):');
    const userId = userIdStr ? parseInt(userIdStr) : null;

    try {
        const res = await fetch(`${getAPIURL()}/admin/documents`, {
            method: 'POST',
            headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename, userId })
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Failed to create document');
        }

        alert('Document created successfully!');
        loadDocuments();
    } catch (err) {
        alert('Error: ' + err.message);
    }
}

// Edit document
async function editDocument(docId) {
    const filename = prompt('Enter new filename:');
    if (filename === null) return;

    const statusOptions = 'pending\nanalyzing\nanalyzed\nerror';
    const newStatus = prompt('Enter status:\n' + statusOptions, 'analyzed');
    if (!newStatus) return;

    if (!['pending', 'analyzing', 'analyzed', 'error'].includes(newStatus)) {
        alert('Invalid status. Must be: pending, analyzing, analyzed, or error');
        return;
    }

    try {
        const res = await fetch(`${getAPIURL()}/admin/documents/${docId}`, {
            method: 'PUT',
            headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename, status: newStatus })
        });

        if (!res.ok) throw new Error('Failed to update document');

        alert('Document updated successfully!');
        loadDocuments();
    } catch (err) {
        alert('Error: ' + err.message);
    }
}

// Delete document
async function deleteDocument(docId) {
    if (!confirm('Are you sure you want to delete this document?')) return;

    try {
        const res = await fetch(`${getAPIURL()}/admin/documents/${docId}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });

        if (!res.ok) throw new Error('Failed to delete document');

        alert('Document deleted successfully!');
        loadDocuments();
    } catch (err) {
        alert('Error: ' + err.message);
    }
}

// ========================================
// AI Results Page
// ========================================
async function loadResults() {
    try {
        const res = await fetch(`${getAPIURL()}/admin/results`, { headers: getAuthHeaders() });
        
        const container = document.getElementById('resultsContainer');
        container.innerHTML = '';

        if (!res.ok) {
            container.innerHTML = '<div class="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-6 text-center"><p class="text-slate-500">No results available</p></div>';
            return;
        }

        const results = await res.json();

        if (!results || results.length === 0) {
            container.innerHTML = '<div class="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-6 text-center"><p class="text-slate-500">No AI results available</p></div>';
            return;
        }

        results.slice(0, 10).forEach(result => {
            const riskColor = result.riskLevel === 'high' ? 'red' : result.riskLevel === 'medium' ? 'yellow' : 'green';
            const riskBg = `bg-${riskColor}-50 dark:bg-${riskColor}-900/20`;
            const riskText = `text-${riskColor}-700 dark:text-${riskColor}-400`;
            const riskBorder = `border-l-4 border-${riskColor}-500`;
            
            const div = document.createElement('div');
            div.className = `rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-6 shadow-sm ${riskBorder}`;
            
            div.innerHTML = `
                <div class="flex items-start justify-between mb-4">
                    <div>
                        <h4 class="font-bold text-navy dark:text-white">${escapeHtml(result.documentName || 'Analysis Result')}</h4>
                        <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">${new Date(result.createdAt).toLocaleString()}</p>
                    </div>
                    <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-${riskColor}-100 dark:bg-${riskColor}-900/30 text-${riskColor}-700 dark:text-${riskColor}-400">
                        Risk: ${result.riskLevel ? result.riskLevel.toUpperCase() : 'N/A'}
                    </span>
                </div>
                
                <div class="grid grid-cols-2 gap-4 mb-4">
                    <div>
                        <p class="text-xs text-slate-500 dark:text-slate-400">Confidence Score</p>
                        <p class="text-lg font-bold text-navy dark:text-white">${(result.confidence * 100).toFixed(0)}%</p>
                    </div>
                    <div>
                        <p class="text-xs text-slate-500 dark:text-slate-400">Clauses Found</p>
                        <p class="text-lg font-bold text-navy dark:text-white">${result.clausesCount || 0}</p>
                    </div>
                </div>

                ${result.topClauses && result.topClauses.length > 0 ? `
                    <div>
                        <p class="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">Top Clauses:</p>
                        <div class="flex flex-wrap gap-2">
                            ${result.topClauses.slice(0, 3).map(clause => `
                                <span class="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                    ${escapeHtml(clause)}
                                </span>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
            `;
            container.appendChild(div);
        });
    } catch (err) {
        console.error('Results load error:', err);
        document.getElementById('resultsContainer').innerHTML = '<div class="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-6 text-center text-red-600"><p>Error loading results</p></div>';
    }
}

// ========================================
// Utility Functions
// ========================================
function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// ========================================
// Init
// ========================================
document.addEventListener('DOMContentLoaded', async () => {
    loadTheme();

    const loadingState = document.getElementById('loadingState');
    const contentContainer = document.getElementById('contentContainer');
    const errorState = document.getElementById('errorState');
    const errorMessage = document.getElementById('errorMessage');

    function showError(msg) {
        loadingState?.classList.add('hidden');
        contentContainer?.classList.add('hidden');
        errorState?.classList.remove('hidden');
        if (errorMessage) errorMessage.textContent = msg;
    }

    // Check auth
    if (!sessionStorage.getItem('lawgic_token')) {
        window.location.href = '/';
        return;
    }

    try {
        // Verify user is admin
        const meRes = await fetch(`${getAPIURL()}/auth/me`, { headers: getAuthHeaders() });
        if (!meRes.ok) {
            sessionStorage.removeItem('lawgic_token');
            sessionStorage.removeItem('lawgic_user');
            window.location.href = '/';
            return;
        }

        const meData = await meRes.json();
        if (meData.token) sessionStorage.setItem('lawgic_token', meData.token);
        if (meData.user) sessionStorage.setItem('lawgic_user', JSON.stringify(meData.user));

        if (!meData.user || meData.user.role !== 'admin') {
            showError('Access denied. Admin privileges required.');
            return;
        }

        // Display user email
        const userEmail = document.getElementById('userEmail');
        if (userEmail && meData.user) {
            userEmail.textContent = meData.user.email;
        }

        // Setup event listeners
        document.getElementById('themeToggle')?.addEventListener('click', toggleTheme);
        document.getElementById('logoutBtn')?.addEventListener('click', () => {
            sessionStorage.removeItem('lawgic_token');
            sessionStorage.removeItem('lawgic_user');
            window.location.href = '/';
        });

        // Nav button listeners
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const page = btn.dataset.page;
                if (page) showPage(page);
            });
        });

        // Show dashboard
        loadingState?.classList.add('hidden');
        contentContainer?.classList.remove('hidden');
        showPage('dashboard');

    } catch (err) {
        console.error('Init error:', err);
        showError(err.message || 'Failed to initialize dashboard');
    }
});

// ========================================
// USER FORM MODAL
// ========================================
function openUserModal(userId = null) {
    const modal = document.getElementById('userFormModal');
    if (!modal) return;

    const form = document.getElementById('userForm');
    const title = document.getElementById('userFormTitle');
    const passwordRequired = document.getElementById('userPasswordRequired');
    const passwordInput = document.getElementById('userFormPassword');

    if (userId) {
        // Edit mode
        title.textContent = 'Edit User';
        passwordRequired.innerHTML = '<span class="text-xs text-slate-500">(Leave blank to keep current)</span>';
        passwordInput.required = false;
    } else {
        // Create mode
        title.textContent = 'Add New User';
        passwordRequired.innerHTML = '<span class="text-red-600">*</span>';
        passwordInput.required = true;
    }

    form.dataset.userId = userId || '';
    form.reset();
    modal.classList.remove('hidden');
    document.getElementById('userFormFirstName').focus();
}

function closeUserModal() {
    const modal = document.getElementById('userFormModal');
    if (modal) modal.classList.add('hidden');
}

async function submitUserForm(event) {
    event.preventDefault();
    
    const form = document.getElementById('userForm');
    const userId = form.dataset.userId;

    const firstName = document.getElementById('userFormFirstName').value.trim();
    const lastName = document.getElementById('userFormLastName').value.trim();
    const email = document.getElementById('userFormEmail').value.trim().toLowerCase();
    const password = document.getElementById('userFormPassword').value.trim();
    const role = document.getElementById('userFormRole').value;

    // Validation
    if (!firstName) {
        showError('First name is required');
        return;
    }
    if (!lastName) {
        showError('Last name is required');
        return;
    }
    if (!email || !email.includes('@')) {
        showError('Valid email is required');
        return;
    }
    if (!userId && !password) {
        showError('Password is required for new users');
        return;
    }
    if (password && password.length < 8) {
        showError('Password must be at least 8 characters');
        return;
    }

    try {
        const fullName = `${firstName} ${lastName}`;
        const url = userId ? `/admin/users/${userId}` : '/admin/users';
        const method = userId ? 'PUT' : 'POST';

        const body = {
            fullName,
            email,
            role
        };
        if (password) body.password = password;

        const res = await fetch(getAPIURL() + url, {
            method,
            headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || `Failed to ${userId ? 'update' : 'create'} user`);
        }

        showSuccess(`User ${userId ? 'updated' : 'created'} successfully`);
        closeUserModal();
        loadUsers();
        loadDashboard(); // Refresh stats
    } catch (err) {
        showError(err.message);
    }
}

// ========================================
// DOCUMENT FORM MODAL
// ========================================
function openDocumentModal(docId = null) {
    const modal = document.getElementById('documentFormModal');
    if (!modal) return;

    const title = document.getElementById('documentFormTitle');
    const statusGroup = document.getElementById('documentStatusGroup');

    if (docId) {
        title.textContent = 'Edit Document';
        statusGroup.classList.remove('hidden');
    } else {
        title.textContent = 'Add New Document';
        statusGroup.classList.add('hidden');
    }

    const form = document.getElementById('documentForm');
    form.dataset.docId = docId || '';
    form.reset();
    modal.classList.remove('hidden');
    document.getElementById('documentFormFilename').focus();
}

function closeDocumentModal() {
    const modal = document.getElementById('documentFormModal');
    if (modal) modal.classList.add('hidden');
}

async function submitDocumentForm(event) {
    event.preventDefault();
    
    const form = document.getElementById('documentForm');
    const docId = form.dataset.docId;

    const filename = document.getElementById('documentFormFilename').value.trim();
    const status = document.getElementById('documentFormStatus')?.value;

    if (!filename) {
        showError('Document filename is required');
        return;
    }

    try {
        const url = docId ? `/admin/documents/${docId}` : '/admin/documents';
        const method = docId ? 'PUT' : 'POST';

        const body = { filename };
        if (docId && status) body.status = status;

        const res = await fetch(getAPIURL() + url, {
            method,
            headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || `Failed to ${docId ? 'update' : 'create'} document`);
        }

        showSuccess(`Document ${docId ? 'updated' : 'created'} successfully`);
        closeDocumentModal();
        loadDocuments();
        loadDashboard();
    } catch (err) {
        showError(err.message);
    }
}

// ========================================
// NOTIFICATION SYSTEM
// ========================================
function showSuccess(message) {
    const toast = document.createElement('div');
    toast.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function showError(message) {
    const toast = document.createElement('div');
    toast.className = 'fixed top-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ========================================
// CLOSE MODALS ON ESC
// ========================================
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeUserModal();
        closeDocumentModal();
    }
});

