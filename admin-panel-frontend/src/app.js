import { api, getFreshAccessToken, getSession, login, logout, setSession, verifyLoginOtp } from './api.js';

const state = {
  session: getSession(),
  lang: localStorage.getItem('admin-panel-lang') || 'ar',
  theme: localStorage.getItem('admin-panel-theme') || 'light',
  view: window.location.hash.replace('#', '') || 'dashboard',
  articles: { items: [], meta: null },
  users: { items: [], meta: null },
  logs: { items: [], meta: null },
  conversations: [],
  messages: { items: [], meta: null },
  selectedConversationId: null,
  articlePage: 1,
  userPage: 1,
  logPage: 1,
  messagePage: 1,
  limit: 8,
  messageLimit: 20,
  search: '',
  socket: null,
  socketRetryTimer: null,
  socketRetryDelay: 1000,
  onlineUserIds: new Set(),
  dashboardStats: null
};

const app = document.querySelector('#app');
const API_ORIGIN = `${window.location.protocol}//${window.location.hostname}:9999`;
let globalEventsBound = false;
let pendingLogin = { userId: null, email: '' };

const copy = {
  brand: ['مركز الإدارة', 'Admin Center'], dashboard: ['الرئيسية', 'Dashboard'], articles: ['المقالات', 'Articles'], users: ['المستخدمون', 'Users'], audit: ['سجل العمليات', 'Audit logs'], chat: ['المحادثات', 'Chat'], settings: ['الإعدادات', 'Settings'], menu: ['القائمة الرئيسية', 'Main menu'], welcome: ['مرحبًا', 'Welcome'], welcomeText: ['إليك ملخصًا واضحًا لما يحدث داخل النظام اليوم.', 'Here is a clear overview of what is happening today.'], loginTitle: ['مرحبًا بعودتك', 'Welcome back'], loginText: ['سجّل دخولك لإدارة المحتوى والمستخدمين بأمان.', 'Sign in to manage your content and users securely.'], registerTitle: ['إنشاء حساب جديد', 'Create a new account'], registerText: ['أنشئ حسابًا جديدًا للبدء باستخدام لوحة الإدارة.', 'Create a new account to get started.'], username: ['اسم المستخدم', 'Username'], email: ['البريد الإلكتروني', 'Email address'], password: ['كلمة المرور', 'Password'], signIn: ['تسجيل الدخول', 'Sign in'], signUp: ['إنشاء حساب', 'Create account'], createAccount: ['إنشاء الحساب', 'Create account'], noAccount: ['ليس لديك حساب؟', 'Do not have an account?'], hasAccount: ['لديك حساب بالفعل؟', 'Already have an account?'], signingIn: ['جاري الدخول...', 'Signing in...'], creating: ['جاري الإنشاء...', 'Creating...'], logout: ['تسجيل الخروج', 'Log out'], refresh: ['تحديث', 'Refresh'], language: ['English', 'عربي'], active: ['نشط', 'Active'], systemOnline: ['النظام متصل', 'System online'], totalArticles: ['إجمالي المقالات', 'Total articles'], totalUsers: ['إجمالي المستخدمين', 'Total users'], totalLogs: ['إجمالي العمليات', 'Total operations'], totalConversations: ['المحادثات', 'Conversations'], recentArticles: ['أحدث المقالات', 'Recent articles'], quickActions: ['إجراءات سريعة', 'Quick actions'], addArticle: ['إضافة مقال', 'Add article'], manageUsers: ['إدارة المستخدمين', 'Manage users'], viewAll: ['عرض الكل', 'View all'], articlesIntro: ['إنشاء وتعديل المحتوى حسب صلاحيات حسابك.', 'Create and manage content according to your account permissions.'], usersIntro: ['إدارة الحسابات والأدوار والمستخدمين النشطين.', 'Manage accounts, roles, and active users.'], auditIntro: ['مراجعة النشاطات التي تمت داخل النظام.', 'Review activity performed inside the system.'], chatIntro: ['محادثات فورية محمية بعضوية المستخدمين.', 'Real-time conversations protected by membership.'], searchArticles: ['بحث في المقالات...', 'Search articles...'], searchUsers: ['بحث بالاسم أو البريد...', 'Search by name or email...'], titleAr: ['العنوان بالعربية', 'Arabic title'], titleEn: ['العنوان بالإنجليزية', 'English title'], contentAr: ['المحتوى بالعربية', 'Arabic content'], contentEn: ['المحتوى بالإنجليزية', 'English content'], owner: ['المالك', 'Owner'], createdAt: ['تاريخ الإنشاء', 'Created at'], actions: ['إجراءات', 'Actions'], role: ['الدور', 'Role'], newUser: ['مستخدم جديد', 'New user'], editUser: ['تعديل المستخدم', 'Edit user'], editArticle: ['تعديل المقال', 'Edit article'], newArticle: ['مقال جديد', 'New article'], save: ['حفظ التعديلات', 'Save changes'], cancel: ['إلغاء', 'Cancel'], delete: ['حذف', 'Delete'], restore: ['استعادة', 'Restore'], restoreHint: ['أدخل رقم المستخدم المحذوف لاستعادته.', 'Enter the deleted user ID to restore it.'], userId: ['رقم المستخدم', 'User ID'], noData: ['لا توجد بيانات لعرضها.', 'There is no data to display.'], noArticles: ['لا توجد مقالات مطابقة.', 'No matching articles.'], noUsers: ['لا توجد حسابات مطابقة.', 'No matching users.'], noLogs: ['لا توجد عمليات مسجلة بعد.', 'No operations recorded yet.'], noConversations: ['لا توجد محادثات بعد.', 'No conversations yet.'], selectConversation: ['اختر محادثة للبدء', 'Select a conversation to start'], newConversation: ['محادثة جديدة', 'New conversation'], participantId: ['رقم المستخدم الآخر', 'Other user ID'], startConversation: ['بدء المحادثة', 'Start conversation'], messagePlaceholder: ['اكتب رسالتك هنا...', 'Write your message...'], send: ['إرسال', 'Send'], online: ['متصل', 'Online'], session: ['الجلسة', 'Session'], apiPath: ['مسار الاتصال', 'API connection'], currentUser: ['الحساب الحالي', 'Current account'], rolePermissions: ['الصلاحيات حسب الدور', 'Role permissions'], loading: ['جاري تحميل البيانات...', 'Loading data...'], invalidSession: ['انتهت الجلسة، سجّل الدخول مرة أخرى.', 'Your session expired. Please sign in again.'], loginSuccess: ['تم تسجيل الدخول بنجاح', 'Signed in successfully'], logoutSuccess: ['تم تسجيل الخروج', 'Signed out'], articleAdded: ['تمت إضافة المقال', 'Article added'], articleUpdated: ['تم تحديث المقال', 'Article updated'], articleDeleted: ['تم حذف المقال', 'Article deleted'], userUpdated: ['تم تحديث المستخدم', 'User updated'], userCreated: ['تم إنشاء المستخدم', 'User created'], userDeleted: ['تم حذف المستخدم', 'User deleted'], userRestored: ['تمت استعادة المستخدم', 'User restored'], conversationCreated: ['تم إنشاء المحادثة', 'Conversation created'], error: ['حدث خطأ غير متوقع', 'Something went wrong']
};

const roleCopy = { USER: ['MindSpace', 'MindSpace'], EDITOR: ['نشر المحتوى', 'MindSpace Publishing'], MODERATOR: ['الإشراف', 'MindSpace Moderation'], ADMIN: ['إدارة MindSpace', 'MindSpace Admin'] };
const actionCopy = { CREATE: ['إنشاء', 'Create'], READ: ['قراءة', 'Read'], UPDATE: ['تعديل', 'Update'], DELETE: ['حذف', 'Delete'], VIEW: ['مشاهدة', 'View'], RESTORE: ['استعادة', 'Restore'] };
const permissionCopy = {
  'users.read': ['قراءة المستخدمين', 'Read users'],
  'users.update': ['تعديل المستخدمين', 'Update users'],
  'users.delete': ['حذف المستخدمين', 'Delete users'],
  'users.restore': ['استعادة المستخدمين', 'Restore users'],
  'articles.*': ['جميع صلاحيات المقالات', 'All article permissions'],
  'articles.read': ['قراءة المقالات', 'Read articles'],
  'articles.create': ['إنشاء المقالات', 'Create articles'],
  'articles.update': ['تعديل المقالات', 'Update articles'],
  'articles.delete': ['حذف المقالات', 'Delete articles'],
  'articles.delete (own)': ['حذف المقالات الخاصة', 'Delete own articles'],
  'audit.read': ['قراءة سجل العمليات', 'Read audit logs']
};
const otpTranslations = {
  otpTitle: ['تحقق من رمز التحقق', 'Verify your code'],
  otpText: ['أرسلنا رمز تحقق إلى بريدك الإلكتروني.', 'We sent a verification code to your email.'],
  otpCode: ['رمز التحقق', 'Verification code'],
  verifyOtp: ['تحقق', 'Verify code'],
  backToLogin: ['العودة لتسجيل الدخول', 'Back to sign in'],
  otpErrorNotFound: ['رمز التحقق غير موجود أو انتهت صلاحيته.', 'The verification code was not found or has expired.'],
  otpErrorExpired: ['انتهت صلاحية رمز التحقق.', 'The verification code has expired.'],
  otpErrorInvalid: ['رمز التحقق غير صحيح.', 'The verification code is incorrect.'],
  otpErrorTooMany: ['تم تجاوز عدد المحاولات. حاول لاحقًا.', 'Too many attempts. Please try again later.'],
  otpVerifying: ['جارٍ التحقق...', 'Verifying...']
};
const t = (key) => {
  if (otpTranslations[key]) return otpTranslations[key][state.lang === 'ar' ? 0 : 1];
  if (key === 'brand') return 'MindSpace';
  if (key === 'welcomeText') return state.lang === 'ar' ? 'مساحة للأفكار والمحتوى والتواصل' : 'Ideas. Stories. Conversations.';
  return (copy[key] || [key, key])[state.lang === 'ar' ? 0 : 1];
};
const roleLabel = (role) => (roleCopy[role] || [role, role])[state.lang === 'ar' ? 0 : 1];
const roleIcon = (role) => ({ USER: 'role-user', EDITOR: 'role-editor', MODERATOR: 'role-moderator', ADMIN: 'role-admin' }[role] || 'role-user');
const actionLabel = (action) => (actionCopy[action] || [action, action])[state.lang === 'ar' ? 0 : 1];
const permissionLabel = (permission) => (permissionCopy[permission] || [permission, permission])[state.lang === 'ar' ? 0 : 1];
const actionIcon = (action) => ({ CREATE: 'plus', READ: 'audit', UPDATE: 'edit', DELETE: 'delete', VIEW: 'articles', RESTORE: 'restore' }[action] || 'audit');
const esc = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
const iconPaths = {
  dashboard: '<path d="M4 13h6V4H4v9Zm10 7h6V4h-6v16ZM4 20h6v-3H4v3Zm10-7h6v-3h-6v3Z"/>',
  articles: '<path d="M6 3h9l4 4v14H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M14 3v5h5M8 12h8M8 16h8"/>',
  chat: '<path d="M4 5a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3h-6l-5 4v-4H7a3 3 0 0 1-3-3V5Z"/><path d="M8 8h8M8 12h5"/>',
  users: '<path d="M16 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM17 11a3 3 0 1 0 0-6M21 20v-1a4 4 0 0 0-3-3.87"/>',
  'role-user': '<path d="M18 20v-1a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v1M11 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"/>',
  'role-editor': '<path d="m4 16-.8 4.8L8 20l11-11-4-4L4 16Z"/><path d="m13 6 4 4"/>',
  'role-moderator': '<path d="M12 3 20 6v5c0 5-3.4 8.4-8 10-4.6-1.6-8-5-8-10V6l8-3Z"/><path d="m8.5 12 2.2 2.2 4.8-4.8"/>',
  'role-admin': '<path d="M12 3 20 7v5c0 4.5-3.2 7.7-8 9-4.8-1.3-8-4.5-8-9V7l8-4Z"/><path d="M12 8v5M9.5 10.5h5"/>' ,
  audit: '<path d="M5 3h14v18H5zM8 7h8M8 11h8M8 15h5"/>',
  settings: '<path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path d="m19.4 15 .1.1-1.8 3.1-.2-.1a2 2 0 0 0-2 .1l-.2.1a2 2 0 0 0-1 1.7v.1h-3.6v-.1a2 2 0 0 0-1-1.7l-.2-.1a2 2 0 0 0-2-.1l-.2.1-1.8-3.1.1-.1a2 2 0 0 0 1-1.7v-.3a2 2 0 0 0-1-1.7l-.1-.1 1.8-3.1.2.1a2 2 0 0 0 2-.1l.2-.1a2 2 0 0 0 1-1.7V6h3.6v.1a2 2 0 0 0 1 1.7l.2.1a2 2 0 0 0 2 .1l.2-.1 1.8 3.1-.1.1a2 2 0 0 0-1 1.7v.3a2 2 0 0 0 1 1.7Z"/>',
  publish: '<path d="m5 12 4 4L19 6"/>',
  unpublish: '<path d="M18 6L6 18M6 6l12 12"/>',
  edit: '<path d="m4 16-.8 4.8L8 20l11-11-4-4L4 16Z"/><path d="m13 6 4 4"/>',
  delete: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3"/>',
  restore: '<path d="M4 12a8 8 0 1 0 2.3-5.7L4 8.5M4 4v4.5h4.5"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
  alert: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
  arrow: '<line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/>',
  bolt: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42"/>',
  moon: '<path d="M20.5 15.7A8.5 8.5 0 0 1 8.3 3.5 8.5 8.5 0 1 0 20.5 15.7Z"/>'
};
const iconAliases = { '⌂': 'dashboard', '▤': 'articles', '◌': 'chat', '♙': 'users', '◷': 'audit', '⚙': 'settings', '✎': 'edit', '⌫': 'delete', '↻': 'restore', '↗': 'arrow', '＋': 'plus', '⌁': 'bolt', '!': 'alert' };
const iconSvg = (name, className = '') => `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${iconPaths[iconAliases[name] || name] || ''}</svg>`;
function wireLegacyIcons(root = document) {
  const replacements = { dashboard: 'dashboard', articles: 'articles', chat: 'chat', users: 'users', audit: 'audit', settings: 'settings', '◌': 'chat', '♙': 'users', '◷': 'audit', '▤': 'articles', '✎': 'edit', '⌫': 'delete', '↻': 'restore', '↗': 'publish', '＋': 'plus' };
  root.querySelectorAll('.nav-icon, .stat-icon, .quick-action > span, .restore-icon, .chat-empty-icon, .empty-icon, .icon-btn').forEach((node) => {
    const key = replacements[node.textContent.trim()];
    if (key) node.innerHTML = iconSvg(key);
  });
}
const date = (value) => value ? new Intl.DateTimeFormat(state.lang === 'ar' ? 'ar-JO' : 'en-US', { dateStyle: 'medium' }).format(new Date(value)) : '—';
const dateTime = (value) => value ? new Intl.DateTimeFormat(state.lang === 'ar' ? 'ar-JO' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';
const initials = (name = '?') => name.trim().slice(0, 2).toUpperCase();
const isAdmin = () => state.session?.user?.role === 'ADMIN';
const isModerator = () => state.session?.user?.role === 'MODERATOR';
const canCreateArticle = () => ['ADMIN', 'EDITOR', 'USER'].includes(state.session?.user?.role);
const canManageArticle = (article) => isAdmin() || isModerator() || Number(article?.userId) === Number(state.session?.user?.id);
// Only ADMIN or the owning EDITOR has articles.publish permission.
const canPublishArticle = (article) => isAdmin() || (state.session?.user?.role === 'EDITOR' && Number(article?.userId) === Number(state.session?.user?.id));

function readableError(error) {
  if (error?.details && typeof error.details === 'object') return Object.entries(error.details).flatMap(([field, value]) => Array.isArray(value) ? value.map((item) => `${field}: ${item}`) : `${field}: ${value}`).join(' • ');
  return error?.message || t('error');
}

function applyPreferences() {
  document.documentElement.lang = state.lang;
  document.documentElement.dir = state.lang === 'ar' ? 'rtl' : 'ltr';
  document.body.classList.toggle('dark', state.theme === 'dark');
}

function toast(message, type = 'success') {
  document.querySelector('.toast')?.remove();
  const node = document.createElement('div');
  node.className = `toast ${type === 'error' ? 'error' : ''}`;
  node.innerHTML = `<span class="toast-dot"></span><span>${esc(message)}</span>`;
  document.body.appendChild(node);
  window.setTimeout(() => node.remove(), 3800);
}

function render() {
  applyPreferences();
  if (!state.session) { disconnectSocket(); renderAuth(pendingLogin.userId ? 'otp' : 'login'); return; }
  // Keep one Socket alive for the whole session, not only while the chat view is open,
  // عشان تظهر حالة الاتصال للمستخدم الآخر حتى لو كان في صفحة ثانية
  connectSocket();
  const visibleNav = [['dashboard', 'dashboard'], ['articles', 'articles'], ['chat', 'chat'], ...(isAdmin() ? [['users', 'users'], ['audit-logs', 'audit']] : []), ['settings', 'settings']];
  if (!visibleNav.some(([key]) => key === state.view)) state.view = 'dashboard';
  app.innerHTML = `<div class="ambient ambient-one"></div><div class="ambient ambient-two"></div><div class="app-shell"><aside class="sidebar" id="sidebar"><div class="sidebar-brand"><span class="brand-symbol">✦</span><div><strong>${t('brand')}</strong><small>ADMIN OS / 01</small></div></div><div class="nav-label">${t('menu')}</div><nav class="nav-list">${visibleNav.map(([key, icon]) => `<button class="nav-item ${state.view === key ? 'active' : ''}" data-view="${key}"><span class="nav-icon">${iconSvg(icon)}</span><span class="nav-text">${t(key)}</span></button>`).join('')}</nav><div class="sidebar-footer"><div class="profile-card"><span class="avatar">${esc(initials(state.session.user.username))}</span><div class="profile-copy"><strong>${esc(state.session.user.username)} <span class="id-badge">#${state.session.user.id}</span></strong><small>${roleLabel(state.session.user.role)}</small></div></div><button class="logout-btn" data-action="logout"><span>${iconSvg('logout')}</span>${t('logout')}</button></div></aside><main class="main-area"><header class="topbar"><div class="topbar-heading"><button class="mobile-menu" data-action="toggle-sidebar" aria-label="Menu">${iconSvg('menu')}</button><div><span class="eyebrow">${t('brand')} / 2026</span><h1>${t(state.view === 'audit-logs' ? 'audit' : state.view)}</h1><p>${t('welcome')}, ${esc(state.session.user.username)} <span class="id-badge">#${state.session.user.id}</span> — ${t('welcomeText')}</p></div></div><div class="topbar-actions"><span class="status-pill"><i></i>${t('systemOnline')}</span><button class="round-btn" data-action="toggle-language" title="${t('language')}">${state.lang === 'ar' ? 'EN' : 'ع'}</button><button class="round-btn" data-action="toggle-theme" title="${state.theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}" aria-label="${state.theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}">${iconSvg(state.theme === 'dark' ? 'sun' : 'moon')}</button></div></header><section class="page-content" id="page-content"></section></main></div>`;
  document.querySelectorAll('.sidebar-brand small').forEach((node) => { node.textContent = 'MINDSPACE / 01'; });
  bindGlobalEvents();
  const viewReady = state.view === 'dashboard' ? loadDashboardStats() : Promise.resolve();
  viewReady.catch(() => { state.dashboardStats = null; }).then(() => renderView()).then(() => { wireLegacyIcons(); if (state.view === 'chat') scrollMessagesToEnd(); });
}

function updateAuthThemeButton() {
  const button = document.querySelector('.auth-tools [data-action="toggle-theme"]');
  if (!button) return;
  const dark = state.theme === 'dark';
  button.innerHTML = iconSvg(dark ? 'sun' : 'moon');
  button.title = dark ? 'Switch to light mode' : 'Switch to dark mode';
  button.setAttribute('aria-label', button.title);
}

function renderOtpAuth(error = '') {
  app.innerHTML = `<div class="auth-screen"><section class="auth-visual"><div class="visual-grid"></div><div class="auth-visual-content"><div class="sidebar-brand"><span class="brand-symbol">✦</span><div><strong>${t('brand')}</strong><small>MINDSPACE / 01</small></div></div><div class="visual-copy"><span class="eyebrow">SECURE WORKSPACE</span><h1>${state.lang === 'ar' ? 'حماية أوضح.<br><em>دخول أكثر أمانًا.</em>' : 'Clearer control.<br><em>Safer access.</em>'}</h1><p>${t('welcomeText')}</p></div></div></section><section class="auth-panel"><div class="auth-tools"><button class="round-btn" data-action="toggle-language">${state.lang === 'ar' ? 'EN' : 'عربي'}</button><button class="round-btn" data-action="toggle-theme">${state.theme === 'dark' ? '☀' : '◐'}</button></div><div class="auth-card"><div class="mobile-auth-brand"><span class="brand-symbol">✦</span><strong>${t('brand')}</strong></div><span class="eyebrow">SECURE LOGIN</span><h2>${t('otpTitle')}</h2><p class="auth-subtitle">${t('otpText')} ${pendingLogin.email ? `<strong dir="ltr">${esc(pendingLogin.email)}</strong>` : ''}</p>${error ? `<div class="error-box"><span>!</span>${esc(error)}</div>` : ''}<form id="otp-form"><label class="field"><span>${t('otpCode')}</span><input name="otp" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" minlength="6" placeholder="000000" required autofocus></label><button class="primary-btn wide" type="submit"><span>${t('verifyOtp')}</span><b>→</b></button></form><button class="link-btn auth-back-btn" data-action="back-to-login">${t('backToLogin')}</button></div></section></div>`;
  applyPreferences();
  updateAuthThemeButton();
  bindGlobalEvents();
  document.querySelector('#otp-form')?.addEventListener('submit', handleVerifyOtp);
}

function renderAuth(mode = 'login', error = '') {
  if (mode === 'otp') { renderOtpAuth(error); return; }
  const register = mode === 'register';
  app.innerHTML = `<div class="auth-screen"><section class="auth-visual"><div class="visual-grid"></div><div class="auth-visual-content"><div class="sidebar-brand"><span class="brand-symbol">✦</span><div><strong>${t('brand')}</strong><small>ADMIN OS / 01</small></div></div><div class="visual-copy"><span class="eyebrow">SECURE WORKSPACE</span><h1>${state.lang === 'ar' ? 'تحكم أوضح.<br><em>قرارات أسرع.</em>' : 'Clearer control.<br><em>Faster decisions.</em>'}</h1><p>${state.lang === 'ar' ? 'مساحة عمل حديثة لإدارة المستخدمين والمحتوى وسجل العمليات في مكان واحد.' : 'A modern workspace for managing users, content, and activity in one place.'}</p></div><div class="visual-metrics"><div><strong>99.9%</strong><span>${state.lang === 'ar' ? 'استقرار' : 'Uptime'}</span></div><div><strong>24/7</strong><span>${state.lang === 'ar' ? 'متابعة' : 'Monitoring'}</span></div><div><strong>JWT</strong><span>${state.lang === 'ar' ? 'حماية' : 'Security'}</span></div></div></div></section><section class="auth-panel"><div class="auth-tools"><button class="round-btn" data-action="toggle-language">${state.lang === 'ar' ? 'EN' : 'عربي'}</button><button class="round-btn" data-action="toggle-theme">${state.theme === 'dark' ? '☀' : '◐'}</button></div><div class="auth-card"><div class="mobile-auth-brand"><span class="brand-symbol">✦</span><strong>${t('brand')}</strong></div><span class="eyebrow">${register ? 'CREATE ACCESS' : 'WELCOME BACK'}</span><h2>${register ? t('registerTitle') : t('loginTitle')}</h2><p class="auth-subtitle">${register ? t('registerText') : t('loginText')}</p>${error ? `<div class="error-box"><span>!</span>${esc(error)}</div>` : ''}<form id="auth-form">${register ? `<label class="field"><span>${t('username')}</span><input name="username" autocomplete="username" placeholder="${state.lang === 'ar' ? 'مثال: ahmad' : 'e.g. ahmad'}" required></label>` : ''}<label class="field"><span>${t('email')}</span><input name="email" type="email" autocomplete="email" placeholder="you@example.com" required></label><label class="field"><span>${t('password')}</span><input name="password" type="password" autocomplete="current-password" placeholder="••••••••" required></label><button class="primary-btn wide" type="submit"><span>${register ? t('createAccount') : t('signIn')}</span><b>↗</b></button></form><p class="auth-switch">${register ? t('hasAccount') : t('noAccount')} <button class="link-btn" data-action="switch-auth">${register ? t('signIn') : t('signUp')}</button></p></div></section></div>`;
  document.querySelectorAll('.sidebar-brand small').forEach((node) => { node.textContent = 'MINDSPACE / 01'; });
  applyPreferences(); updateAuthThemeButton(); bindGlobalEvents();
  document.querySelector('#auth-form')?.addEventListener('submit', register ? handleRegister : handleLogin);
}

function bindGlobalEvents() {
  if (globalEventsBound) return;
  globalEventsBound = true;
  document.addEventListener('click', handleClick);
  document.addEventListener('submit', handleSubmit);
  // Handle Restore directly in capture phase so the button always submits its own form.
  document.addEventListener('submit', (event) => {
    if (event.target.id !== 'restore-form') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    handleRestoreSubmit(event);
  }, true);
  // Handle a direct click as a fallback for browsers or extensions that block form submit events.
  document.addEventListener('click', (event) => {
    if (!event.target.closest('#restore-form button')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const form = document.querySelector('#restore-form');
    if (form) restoreUser(new FormData(form).get('id'));
  }, true);
}

async function handleClick(event) {
  const participantAvatar = event.target.closest('.chat-header .role-avatar');
  if (participantAvatar) {
    const selected = state.conversations.find((conversation) => Number(conversation.id) === Number(state.selectedConversationId));
    if (selected) openParticipantIdentity(otherMember(selected));
    return;
  }
  const viewButton = event.target.closest('[data-view]');
  if (viewButton) { state.view = viewButton.dataset.view; state.search = ''; window.location.hash = state.view; document.body.classList.remove('sidebar-open'); render(); return; }
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const action = button.dataset.action;
  if (action === 'toggle-language') { state.lang = state.lang === 'ar' ? 'en' : 'ar'; localStorage.setItem('admin-panel-lang', state.lang); render(); }
  if (action === 'toggle-theme') { state.theme = state.theme === 'dark' ? 'light' : 'dark'; localStorage.setItem('admin-panel-theme', state.theme); render(); }
  if (action === 'toggle-sidebar') document.body.classList.toggle('sidebar-open');
  if (action === 'switch-auth') renderAuth(document.querySelector('#auth-form input[name="username"]') ? 'login' : 'register');
  if (action === 'back-to-login') { pendingLogin = { userId: null, email: '' }; renderAuth('login'); }
  if (action === 'logout') await handleLogout();
  if (action === 'new-article') openArticleModal();
  if (action === 'edit-article') openArticleModal(state.articles.items.find((item) => String(item.id) === String(button.dataset.id)));
  if (action === 'delete-article') await deleteArticle(button.dataset.id);
  if (action === 'toggle-article-publication') await toggleArticlePublication(button.dataset.id, button.dataset.published === 'true');
  if (action === 'new-user') openUserModal();
  if (action === 'edit-user') openUserModal(state.users.items.find((item) => String(item.id) === String(button.dataset.id)));
  if (action === 'delete-user') await deleteUser(button.dataset.id);
  if (action === 'restore-user') await restoreUser(button.dataset.id);
  if (action === 'restore-current-user') {
    const form = document.querySelector('#restore-form');
    if (form) await restoreUser(new FormData(form).get('id'));
  }
  if (action === 'go-articles') { state.view = 'articles'; window.location.hash = 'articles'; render(); }
  if (action === 'go-users') { state.view = 'users'; window.location.hash = 'users'; render(); }
  if (action === 'close-modal') { closeModal(); if (button.dataset.thenEdit) openArticleModal(state.articles.items.find((item) => String(item.id) === String(button.dataset.thenEdit))); }
  if (action === 'new-conversation') openConversationModal();
  if (action === 'select-conversation') await selectConversation(button.dataset.id);
  if (action === 'delete-conversation') await deleteConversation(button.dataset.id);
  if (action === 'view-article') openMindSpaceArticleViewModal(state.articles.items.find((item) => String(item.id) === String(button.dataset.id)));
  if (action === 'article-page') { state.articlePage = Number(button.dataset.page); await renderView(); }
  if (action === 'user-page') { state.userPage = Number(button.dataset.page); await renderView(); }
  if (action === 'log-page') { state.logPage = Number(button.dataset.page); await renderView(); }
  if (action === 'message-page') { state.messagePage = Number(button.dataset.page); await renderView(); }
}

function sendMessageOverSocket(payload) {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      const error = new Error(state.lang === 'ar' ? 'انتهت مهلة الاتصال، سيتم استخدام الإرسال الاحتياطي.' : 'The live connection timed out; using the fallback sender.');
      error.transportFailure = true;
      reject(error);
    }, 10000);
    try {
      state.socket.emit('send_message', payload, (result) => {
        window.clearTimeout(timeout);
        if (result?.success) {
          resolve(result.data || null);
          return;
        }
        reject(new Error(result?.message || t('error')));
      });
    } catch (error) {
      window.clearTimeout(timeout);
      error.transportFailure = true;
      reject(error);
    }
  });
}

async function sendMessageOverHttp(payload) {
  const result = await api(`/conversations/${payload.conversationId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content: payload.content })
  });
  return result?.data || null;
}

function updateConversationPreview(message, incrementUnread = false) {
  const conversation = state.conversations.find((item) => Number(item.id) === Number(message?.conversationId));
  if (!conversation || !message) return;
  conversation.lastMessage = message;
  if (incrementUnread) conversation.unreadCount = (Number(conversation.unreadCount) || 0) + 1;
  state.conversations = [conversation, ...state.conversations.filter((item) => item !== conversation)];
}

function appendMessage(message) {
  if (!message?.id || state.messages.items.some((item) => Number(item.id) === Number(message.id))) return;
  state.messages.items.push(message);
  updateConversationPreview(message, false);
  renderMessages(true);
}

async function handleSubmit(event) {
  const form = event.target;
  if (form.id === 'article-form') { event.preventDefault(); const rawData = Object.fromEntries(new FormData(form)); const data = Object.fromEntries(Object.entries(rawData).filter(([, value]) => value.trim() !== '')); const id = form.dataset.id; if (!data.titleAr && !data.titleEn) { toast(state.lang === 'ar' ? 'أدخل عنوانًا عربيًا أو إنجليزيًا واحدًا على الأقل' : 'Enter at least one Arabic or English title', 'error'); return; } try { await api(id ? `/articles/${id}` : '/articles', { method: id ? 'PUT' : 'POST', body: JSON.stringify(data) }); closeModal(); toast(id ? t('articleUpdated') : t('articleAdded')); await renderView(); } catch (error) { toast(readableError(error), 'error'); } }
  if (form.id === 'user-form') { event.preventDefault(); const data = Object.fromEntries(new FormData(form)); const id = form.dataset.id; try { if (id) await api(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }); else await api('/register', { method: 'POST', body: JSON.stringify({ username: data.username, email: data.email, password: data.password }) }, false); closeModal(); toast(id ? t('userUpdated') : t('userCreated')); await renderView(); } catch (error) { toast(readableError(error), 'error'); } }
  if (form.id === 'conversation-form') { event.preventDefault(); const participantId = Number(new FormData(form).get('participantId')); try { const result = await api('/conversations', { method: 'POST', body: JSON.stringify({ participantId }) }); const createdConversation = result?.data; const createdId = Number(createdConversation?.id); if (!Number.isInteger(createdId) || createdId <= 0) throw new Error(state.lang === 'ar' ? 'تعذر تحديد المحادثة الجديدة.' : 'The new conversation could not be identified.'); closeModal(); state.selectedConversationId = createdId; state.messagePage = 1; state.messages = { items: [], meta: null }; state.conversations = []; toast(result?.existing ? (state.lang === 'ar' ? 'المحادثة موجودة، تم فتحها' : 'Conversation already exists; opened it') : t('conversationCreated')); await renderChat(document.querySelector('#page-content'), createdConversation); scrollMessagesToEnd(); } catch (error) { toast(readableError(error), 'error'); } }
  if (form.id === 'restore-form') { event.preventDefault(); await restoreUser(new FormData(form).get('id')); }
  if (form.id === 'message-form') {
    event.preventDefault();
    const input = form.elements.content;
    const content = input.value.trim();
    if (!content || !state.selectedConversationId) return;
    input.disabled = true;
    try {
      const payload = { conversationId: Number(state.selectedConversationId), content };
      let message;
      if (state.socket?.connected) {
        try {
          message = await sendMessageOverSocket(payload);
        } catch (error) {
          if (!error.transportFailure) throw error;
          state.socket.disconnect();
          scheduleSocketReconnect();
          message = await sendMessageOverHttp(payload);
        }
      } else {
        message = await sendMessageOverHttp(payload);
      }
      appendMessage(message);
      input.value = '';
    } catch (error) {
      toast(readableError(error), 'error');
    } finally {
      input.disabled = false;
      input.focus();
    }
  }
}

async function handleRestoreSubmit(event) {
  const id = Number(new FormData(event.target).get('id'));

  if (!Number.isInteger(id) || id <= 0) {
    toast(state.lang === 'ar' ? 'أدخل ID صحيحًا للمستخدم' : 'Enter a valid user ID', 'error');
    return;
  }

  await restoreUser(id);
}

async function completeLogin(result) {
  if (!result?.accessToken || !result?.refreshToken) throw new Error(t('error'));
  const session = { user: result.data, accessToken: result.accessToken, refreshToken: result.refreshToken };
  setSession(session);
  pendingLogin = { userId: null, email: '' };
  state.session = session;
  state.view = 'dashboard';
  window.location.hash = 'dashboard';
  render();
  toast(t('loginSuccess'));
}

function otpErrorMessage(error) {
  const code = String(error?.code || error?.message || '').toUpperCase();
  if (code === 'OTP_NOT_FOUND') return t('otpErrorNotFound');
  if (code === 'OTP_EXPIRED') return t('otpErrorExpired');
  if (code === 'INVALID_OTP') return t('otpErrorInvalid');
  if (code === 'TOO_MANY_ATTEMPTS') return t('otpErrorTooMany');
  return state.lang === 'ar' ? 'تعذر التحقق من الرمز. حاول مرة أخرى.' : 'We could not verify the code. Please try again.';
}

async function handleLogin(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  button.querySelector('span').textContent = t('signingIn');
  const data = new FormData(form);
  try {
    const result = await login(data.get('email'), data.get('password'));
    if (result?.otpRequired === true) {
      pendingLogin = { userId: result.userId, email: String(data.get('email') || '') };
      renderAuth('otp');
      return;
    }
    await completeLogin(result);
  } catch (error) {
    renderAuth('login', readableError(error));
  }
}

async function handleVerifyOtp(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  const otp = String(new FormData(form).get('otp') || '').replace(/\D/g, '');
  if (!/^\d{6}$/.test(otp) || pendingLogin.userId == null) {
    renderAuth('otp', t('otpErrorInvalid'));
    return;
  }
  button.disabled = true;
  button.querySelector('span').textContent = t('otpVerifying');
  try {
    const result = await verifyLoginOtp(pendingLogin.userId, otp);
    await completeLogin(result);
  } catch (error) {
    renderAuth('otp', otpErrorMessage(error));
  }
}
async function handleRegister(event) { event.preventDefault(); const form = event.currentTarget; const button = form.querySelector('button[type="submit"]'); button.disabled = true; button.querySelector('span').textContent = t('creating'); const data = new FormData(form); try { await api('/register', { method: 'POST', body: JSON.stringify({ username: data.get('username'), email: data.get('email'), password: data.get('password') }) }, false); renderAuth('login'); toast(t('userCreated')); } catch (error) { renderAuth('register', readableError(error)); } }
async function handleLogout() { await logout(); state.session = null; disconnectSocket(); render(); toast(t('logoutSuccess')); }
async function renderView() { const target = document.querySelector('#page-content'); if (!target) return; target.innerHTML = `<div class="loading-state"><div class="spinner"></div><span>${t('loading')}</span></div>`; try { if (state.view === 'dashboard') await renderDashboard(target); if (state.view === 'articles') await renderArticles(target); if (state.view === 'users') await renderUsers(target); if (state.view === 'audit-logs') await renderAuditLogs(target); if (state.view === 'chat') await renderChat(target); if (state.view === 'settings') renderSettings(target); } catch (error) { target.innerHTML = `<div class="empty-state glass-card"><div class="empty-icon">!</div><h3>${t('error')}</h3><p>${esc(readableError(error))}</p></div>`; } }

async function loadDashboardStats() { const result = await api('/dashboard/stats'); state.dashboardStats = result?.data || null; return state.dashboardStats; }
async function loadArticles(page = state.articlePage) { const result = await api(`/articles?page=${page}&limit=${state.limit}`); state.articles = { items: Array.isArray(result?.data) ? result.data : [], meta: result?.meta || null }; return state.articles; }
async function loadUsers(page = state.userPage) { if (!isAdmin()) return state.users; const result = await api(`/users?page=${page}&limit=${state.limit}`); state.users = { items: Array.isArray(result?.data) ? result.data : [], meta: result?.meta || null }; return state.users; }
async function loadLogs(page = state.logPage) { const result = await api(`/audit-logs?page=${page}&limit=${state.limit}`); state.logs = { items: Array.isArray(result?.data) ? result.data : [], meta: result?.meta || null }; return state.logs; }

function statCard(icon, label, value, tone = '') { if (label === t('totalLogs') && !isAdmin()) return ''; const stats = state.dashboardStats || {}; const unavailable = state.lang === 'ar' ? 'غير متاح' : 'Unavailable'; let displayValue = value; if (label === t('totalUsers')) displayValue = stats.totalUsers ?? unavailable; if (label === t('totalLogs')) displayValue = stats.totalOperations ?? unavailable; if (label === t('totalConversations')) displayValue = stats.totalConversations ?? unavailable; return `<div class="stat-card glass-card ${tone}"><div class="stat-icon">${iconSvg(icon)}</div><span>${label}</span><strong>${displayValue}</strong><i class="stat-glow"></i></div>`; }
async function renderDashboard(target) { const jobs = [loadArticles(1)]; if (isAdmin()) jobs.push(loadUsers(1)); await Promise.all(jobs); const recent = state.articles.items.slice(0, 4); target.innerHTML = `<div class="page-intro"><div><span class="eyebrow">OVERVIEW / ${new Date().getFullYear()}</span><h2>${t('welcome')}, ${esc(state.session.user.username)}.</h2><p>${t('welcomeText')}</p></div>${canCreateArticle() ? `<button class="primary-btn" data-action="new-article">＋ ${t('addArticle')}</button>` : ''}</div><div class="stats-grid">${statCard('▤', t('totalArticles'), state.articles.meta?.totalCount ?? state.articles.items.length, 'tone-teal')}${statCard('♙', t('totalUsers'), isAdmin() ? (state.users.meta?.totalCount ?? state.users.items.length) : '—', 'tone-blue')}${statCard('◷', t('totalLogs'), isAdmin() ? '↗' : '—', 'tone-violet')}${statCard('◌', t('totalConversations'), state.conversations.length || '—', 'tone-amber')}</div><div class="dashboard-grid"><section class="glass-card section-card recent-card"><div class="section-heading"><div><span class="eyebrow">CONTENT STREAM</span><h3>${t('recentArticles')}</h3></div><button class="text-btn" data-action="go-articles">${t('viewAll')} ↗</button></div><div class="recent-list">${recent.length ? recent.map(articleRow).join('') : emptyState(t('noArticles'))}</div></section><section class="glass-card section-card quick-card"><div class="section-heading"><div><span class="eyebrow">SHORTCUTS</span><h3>${t('quickActions')}</h3></div></div><div class="quick-list"><button class="quick-action" data-action="new-article" ${canCreateArticle() ? '' : 'disabled'}><span>＋</span><div><strong>${t('addArticle')}</strong><small>${state.lang === 'ar' ? 'أضف محتوى عربيًا وإنجليزيًا' : 'Add Arabic and English content'}</small></div><b>↗</b></button>${isAdmin() ? `<button class="quick-action" data-action="go-users"><span>♙</span><div><strong>${t('manageUsers')}</strong><small>${state.lang === 'ar' ? 'راجع الأدوار والحسابات' : 'Review roles and accounts'}</small></div><b>↗</b></button>` : ''}<button class="quick-action" data-view="chat"><span>◌</span><div><strong>${t('chat')}</strong><small>${state.lang === 'ar' ? 'تواصل لحظيًا مع أعضاء النظام' : 'Talk to workspace members'}</small></div><b>↗</b></button></div></section></div>`; }
function articleRow(article) { const title = state.lang === 'en' ? article.titleEn : article.titleAr; const content = state.lang === 'en' ? article.contentEn : article.contentAr; return `<div class="article-row"><div class="article-mark">${iconSvg('articles')}</div><div class="article-row-copy"><strong>${esc(title)}</strong><span>${esc(content || '').slice(0, 92)}${String(content || '').length > 92 ? '…' : ''}</span></div><time>${date(article.createdAt)}</time></div>`; }

async function renderArticles(target) { await loadArticles(); renderArticlesView(target); }
function renderArticlesView(target) { const term = state.search.toLowerCase(); const filtered = state.articles.items.filter((article) => `${article.titleAr} ${article.titleEn} ${article.contentAr} ${article.contentEn}`.toLowerCase().includes(term)); target.innerHTML = `<div class="page-intro"><div><span class="eyebrow">CONTENT / ARTICLES</span><h2>${t('articles')}</h2><p>${t('articlesIntro')}</p></div>${canCreateArticle() ? `<button class="primary-btn" data-action="new-article">＋ ${t('newArticle')}</button>` : ''}</div><section class="glass-card section-card"><div class="section-heading toolbar-heading"><div><h3>${t('articles')}</h3><span class="result-count">${state.articles.meta?.totalCount ?? filtered.length} ${state.lang === 'ar' ? 'نتيجة' : 'results'}</span></div><input class="search-input" id="article-search" value="${esc(state.search)}" placeholder="${t('searchArticles')}"></div>${filtered.length ? `<div class="table-wrap"><table><thead><tr><th>${t('titleAr')} / ${t('titleEn')}</th><th>${t('owner')}</th><th>${state.lang === 'ar' ? 'الحالة' : 'Status'}</th><th>${t('createdAt')}</th><th>${t('actions')}</th></tr></thead><tbody>${filtered.map(articleTableRow).join('')}</tbody></table></div>` : emptyState(term ? t('noArticles') : t('noData'))}${pagination(state.articles.meta, 'article-page')}</section>`; const searchInput = document.querySelector('#article-search'); searchInput?.addEventListener('input', (event) => { const cursor = event.target.selectionStart; state.search = event.target.value; renderArticlesView(document.querySelector('#page-content')); const restored = document.querySelector('#article-search'); if (restored) { restored.focus(); restored.setSelectionRange(cursor, cursor); } }); }
function articleTableRow(article) { const owner = article.user?.username || `#${article.userId}`; const manage = canManageArticle(article); const canPublish = canPublishArticle(article); const published = article.isPublished === true; const status = published ? (state.lang === 'ar' ? 'منشور' : 'Published') : (state.lang === 'ar' ? 'مسودة' : 'Draft'); const publicationTitle = published ? (state.lang === 'ar' ? 'إلغاء النشر' : 'Unpublish') : (state.lang === 'ar' ? 'نشر' : 'Publish'); return `<tr><td><div class="table-title article-title-cell" data-action="view-article" data-id="${article.id}" title="${state.lang === 'ar' ? 'عرض المقال كاملاً' : 'View full article'}"><span class="article-mark small">${iconSvg('articles')}</span><div class="article-title-bilingual"><span class="title-en" dir="ltr">${esc(article.titleEn || '—')}</span><span class="title-ar" dir="rtl">${esc(article.titleAr || '—')}</span></div></div></td><td><span class="owner-chip">@${esc(owner)}</span></td><td><span class="publication-badge ${published ? 'published' : 'draft'}">${status}</span></td><td>${date(article.createdAt)}</td><td>${manage || canPublish ? `<div class="row-actions">${canPublish ? `<button class="icon-btn publication-action" data-action="toggle-article-publication" data-id="${article.id}" data-published="${published}" title="${publicationTitle}">${iconSvg(published ? 'unpublish' : 'publish')}</button>` : ''}${manage ? `<button class="icon-btn" data-action="edit-article" data-id="${article.id}" title="${t('editArticle')}">${iconSvg('edit')}</button><button class="icon-btn danger" data-action="delete-article" data-id="${article.id}" title="${t('delete')}">${iconSvg('delete')}</button>` : ''}</div>` : `<span class="muted-label">${state.lang === 'ar' ? 'قراءة فقط' : 'Read only'}</span>`}</td></tr>`; }

async function renderUsers(target) { if (!isAdmin()) return; await loadUsers(); renderUsersView(target); }
function renderUsersView(target) { const filtered = state.users.items.filter((user) => `${user.username} ${user.email}`.toLowerCase().includes(state.search.toLowerCase())); target.innerHTML = `<div class="page-intro"><div><span class="eyebrow">ACCESS / USERS</span><h2>${t('users')}</h2><p>${t('usersIntro')}</p></div><button class="primary-btn" data-action="new-user">＋ ${t('newUser')}</button></div><section class="glass-card section-card"><div class="section-heading toolbar-heading"><div><h3>${t('users')}</h3><span class="result-count">${state.users.meta?.totalCount ?? filtered.length} ${state.lang === 'ar' ? 'حساب نشط' : 'active accounts'}</span></div><input class="search-input" id="user-search" value="${esc(state.search)}" placeholder="${t('searchUsers')}"></div>${filtered.length ? `<div class="table-wrap"><table><thead><tr><th>${t('username')}</th><th>${t('email')}</th><th>${t('role')}</th><th>${t('createdAt')}</th><th>${t('actions')}</th></tr></thead><tbody>${filtered.map(userTableRow).join('')}</tbody></table></div>` : emptyState(t('noUsers'))}${pagination(state.users.meta, 'user-page')}</section><section class="glass-card restore-strip"><div class="restore-icon">↻</div><div><strong>${t('restore')}</strong><p>${t('restoreHint')}</p></div><form id="restore-form"><input name="id" type="number" min="1" placeholder="${t('userId')}" required><button class="secondary-btn" type="submit">${t('restore')}</button></form></section>`; const searchInput = document.querySelector('#user-search'); searchInput?.addEventListener('input', (event) => { const cursor = event.target.selectionStart; state.search = event.target.value; renderUsersView(document.querySelector('#page-content')); const restored = document.querySelector('#user-search'); if (restored) { restored.focus(); restored.setSelectionRange(cursor, cursor); } }); }
function userTableRow(user) { const ownAccount = Number(user.id) === Number(state.session.user.id); return `<tr><td><div class="table-title"><span class="role-avatar role-${String(user.role).toLowerCase()}">${iconSvg(roleIcon(user.role))}</span><div><strong>${esc(user.username)}</strong><small>#${user.id}</small></div></div></td><td dir="ltr" class="email-cell">${esc(user.email)}</td><td><span class="role-badge role-${String(user.role).toLowerCase()}">${roleLabel(user.role)}</span></td><td>${date(user.createdAt)}</td><td><div class="row-actions"><button class="icon-btn" data-action="edit-user" data-id="${user.id}" title="${t('editUser')}">✎</button>${ownAccount ? '' : `<button class="icon-btn danger" data-action="delete-user" data-id="${user.id}" title="${t('delete')}">⌫</button>`}</div></td></tr>`; }

async function renderAuditLogs(target) { if (!isAdmin()) return; await loadLogs(); target.innerHTML = `<div class="page-intro"><div><span class="eyebrow">OBSERVABILITY / AUDIT</span><h2>${t('audit')}</h2><p>${t('auditIntro')}</p></div><span class="metric-chip">${state.logs.meta?.totalCount ?? state.logs.items.length} ${state.lang === 'ar' ? 'عملية' : 'operations'}</span></div><section class="glass-card section-card"><div class="section-heading"><div><h3>${t('audit')}</h3><span class="result-count">${state.lang === 'ar' ? 'آخر النشاطات المسجلة' : 'Latest recorded activity'}</span></div></div>${state.logs.items.length ? `<div class="table-wrap"><table><thead><tr><th>${t('username')}</th><th>${state.lang === 'ar' ? 'العملية' : 'Action'}</th><th>${state.lang === 'ar' ? 'الكيان' : 'Entity'}</th><th>${state.lang === 'ar' ? 'المعرف' : 'ID'}</th><th>${t('createdAt')}</th></tr></thead><tbody>${state.logs.items.map(logRow).join('')}</tbody></table></div>` : emptyState(t('noLogs'))}${pagination(state.logs.meta, 'log-page')}</section>`; }
function logRow(log) { const username = log.user?.username || (state.lang === 'ar' ? 'مستخدم محذوف' : 'Deleted user'); return `<tr><td><div class="table-title"><span class="role-avatar role-${String(log.user?.role || 'USER').toLowerCase()}">${iconSvg(roleIcon(log.user?.role || 'USER'))}</span><div><strong>${esc(username)}</strong><small dir="ltr">#${log.userId ?? '—'}${log.user?.email ? ` · ${esc(log.user.email)}` : ''}</small></div></div></td><td><span class="action-badge"><span class="audit-action-icon">${iconSvg(actionIcon(log.action))}</span>${actionLabel(log.action)}</span></td><td>${esc(log.entity)}</td><td>#${log.entityId ?? '—'}</td><td>${dateTime(log.createdAt)}</td></tr>`; }
function pagination(meta, action) { if (!meta || meta.totalPages <= 1) return ''; const buttons = []; for (let page = 1; page <= meta.totalPages; page += 1) { if (page <= 3 || page === meta.totalPages || Math.abs(page - meta.page) <= 1) buttons.push(`<button class="page-btn ${page === meta.page ? 'active' : ''}" data-action="${action}" data-page="${page}">${page}</button>`); else if (buttons[buttons.length - 1] !== '<span class="page-dots">…</span>') buttons.push('<span class="page-dots">…</span>'); } return `<div class="pagination"><span>${meta.page} / ${meta.totalPages}</span><div>${buttons.join('')}</div></div>`; }

async function loadConversations() { const result = await api('/conversations'); state.conversations = Array.isArray(result?.data) ? result.data : []; state.conversations.sort((a, b) => new Date(b.lastMessage?.createdAt || b.updatedAt || b.createdAt || 0) - new Date(a.lastMessage?.createdAt || a.updatedAt || a.createdAt || 0)); if (!state.selectedConversationId && state.conversations[0]) state.selectedConversationId = state.conversations[0].id; return state.conversations; }
async function loadMessages(id = state.selectedConversationId) { if (!id) { state.messages = { items: [], meta: null }; return state.messages; } const result = await api(`/conversations/${id}/messages?page=${state.messagePage}&limit=${state.messageLimit}`); state.messages = { items: Array.isArray(result?.data) ? result.data : [], meta: result?.meta || null }; markMessagesRead(id); return state.messages; }
async function selectConversation(id) { state.selectedConversationId = Number(id); state.messagePage = 1; const selected = state.conversations.find((conversation) => Number(conversation.id) === Number(id)); if (selected) selected.unreadCount = 0; await loadMessages(); connectSocket(); await renderChat(document.querySelector('#page-content')); const refreshed = state.conversations.find((conversation) => Number(conversation.id) === Number(id)); if (refreshed) refreshed.unreadCount = 0; renderConversationList(); scrollMessagesToEnd(); }
async function renderChat(target, preferredConversation = null) { await loadConversations(); if (preferredConversation?.id && !state.conversations.some((conversation) => Number(conversation.id) === Number(preferredConversation.id))) state.conversations.unshift(preferredConversation); if (state.selectedConversationId && !state.conversations.some((conversation) => Number(conversation.id) === Number(state.selectedConversationId))) state.selectedConversationId = state.conversations[0]?.id || null; if (state.selectedConversationId) await loadMessages(); connectSocket(); const selected = state.conversations.find((conversation) => Number(conversation.id) === Number(state.selectedConversationId)); target.innerHTML = `<div class="page-intro"><div><span class="eyebrow">REAL-TIME / SOCKET.IO</span><h2>${t('chat')}</h2><p>${t('chatIntro')}</p></div><button class="primary-btn" data-action="new-conversation">＋ ${t('newConversation')}</button></div><section class="chat-layout glass-card"><aside class="conversation-list"><div class="conversation-list-head"><strong>${t('chat')}</strong><span>${state.conversations.length}</span></div>${state.conversations.length ? state.conversations.map(conversationItem).join('') : emptyState(t('noConversations'))}</aside><div class="chat-panel">${selected ? chatPanel(selected) : `<div class="chat-empty"><div class="chat-empty-icon">${iconSvg('chat')}</div><h3>${t('selectConversation')}</h3><p>${t('chatIntro')}</p></div>`}</div></section>`; }
function renderConversationList() { const list = document.querySelector('.conversation-list'); if (!list) return; list.innerHTML = `<div class="conversation-list-head"><strong>${t('chat')}</strong><span>${state.conversations.length}</span></div>${state.conversations.length ? state.conversations.map(conversationItem).join('') : emptyState(t('noConversations'))}`; }
function otherMember(conversation) { return (conversation?.members || []).find((member) => Number(member.user?.id) !== Number(state.session.user.id))?.user || conversation?.members?.[0]?.user || {}; }
function presenceLabel(isOnline) { return `<i class="online-dot ${isOnline ? '' : 'offline'}"></i>${isOnline ? t('online') : (state.lang === 'ar' ? 'غير متصل' : 'Offline')}`; }
function conversationItem(conversation) { const other = otherMember(conversation); const active = Number(conversation.id) === Number(state.selectedConversationId); const unreadCount = Number(conversation.unreadCount) || 0; const preview = conversation.lastMessage?.content || (state.lang === 'ar' ? 'لا توجد رسائل بعد' : 'No messages yet'); const previewSender = Number(conversation.lastMessage?.senderId) === Number(state.session.user.id) ? (state.lang === 'ar' ? 'أنت: ' : 'You: ') : ''; return `<div class="conversation-item-wrap"><button class="conversation-item ${active ? 'active' : ''} ${unreadCount ? 'has-unread' : ''}" data-action="select-conversation" data-id="${conversation.id}"><span class="role-avatar role-${String(other.role || 'USER').toLowerCase()}">${iconSvg(roleIcon(other.role || 'USER'))}</span><span><strong>${esc(other.username || `Conversation #${conversation.id}`)}</strong><small>${esc(previewSender + preview)}</small></span>${unreadCount ? `<em class="unread-badge">${unreadCount > 99 ? '99+' : unreadCount}</em>` : ''}<b>›</b></button><button class="conversation-delete icon-btn danger" data-action="delete-conversation" data-id="${conversation.id}" title="${state.lang === 'ar' ? 'حذف المحادثة' : 'Delete conversation'}">${iconSvg('delete')}</button></div>`; }
function chatPanel(conversation) { const other = otherMember(conversation); const isOnline = state.onlineUserIds.has(Number(other.id)); return `<header class="chat-header"><div class="table-title"><span class="role-avatar role-${String(other.role || 'USER').toLowerCase()}">${iconSvg(roleIcon(other.role || 'USER'))}</span><div><strong>${esc(other.username || `Conversation #${conversation.id}`)}</strong><small id="presence-label">${presenceLabel(isOnline)}</small></div></div><div class="chat-header-actions"><span class="connection-label ${state.socket?.connected ? 'connected' : ''}"><i></i>${state.socket?.connected ? 'Socket connected' : 'HTTP fallback'}</span><button class="icon-btn danger" data-action="delete-conversation" data-id="${conversation.id}" title="${state.lang === 'ar' ? 'حذف المحادثة' : 'Delete conversation'}">${iconSvg('delete')}</button></div></header><div class="messages" id="messages-list">${state.messages.items.length ? state.messages.items.map(messageBubble).join('') : emptyState(t('noData'))}</div><form id="message-form" class="message-form"><input name="content" maxlength="2000" autocomplete="off" placeholder="${t('messagePlaceholder')}" required><button class="send-btn" type="submit">${t('send')} <span>↗</span></button></form>`; }
function messageBubble(message) { const mine = Number(message.senderId) === Number(state.session.user.id); const read = mine && Boolean(message.isRead); return `<div class="message-line ${mine ? 'mine' : ''}"><div class="message-bubble"><p>${esc(message.content)}</p><small>${dateTime(message.createdAt)}${mine ? ` <span class="read-indicator ${read ? 'read' : ''}" title="${read ? 'Read' : 'Sent'}" aria-label="${read ? 'Read' : 'Sent'}">${read ? '✓✓' : '✓'}</span>` : ''}</small></div></div>`; }

function joinSelectedConversation() { if (!state.socket?.connected || !state.selectedConversationId) return; const conversationId = Number(state.selectedConversationId); state.socket.emit('join_conversation', conversationId, (result) => { if (result?.success) markMessagesRead(conversationId); }); }

// Repaint only the message list so the typed text inside the input is never lost.
// تحديث قائمة الرسائل فقط حتى لا يضيع النص المكتوب في الحقل
function scrollMessagesToEnd() { const list = document.querySelector('#messages-list'); if (!list) return; window.requestAnimationFrame(() => { list.scrollTop = list.scrollHeight; }); }
function renderMessages(scrollToEnd = false) { const list = document.querySelector('#messages-list'); if (!list) return; const wasAtEnd = list.scrollHeight - list.scrollTop - list.clientHeight < 48; list.innerHTML = state.messages.items.length ? state.messages.items.map(messageBubble).join('') : emptyState(t('noData')); if (scrollToEnd || wasAtEnd) scrollMessagesToEnd(); }
function updateConnectionUi() { const label = document.querySelector('.connection-label'); if (!label) return; const connected = Boolean(state.socket?.connected); label.classList.toggle('connected', connected); label.innerHTML = `<i></i>${connected ? 'Socket connected' : 'HTTP fallback'}`; }
function updatePresenceUi() { const selected = state.conversations.find((conversation) => Number(conversation.id) === Number(state.selectedConversationId)); const label = document.querySelector('#presence-label'); if (selected && label) label.innerHTML = presenceLabel(state.onlineUserIds.has(Number(otherMember(selected).id))); updateConnectionUi(); }

function connectSocket() {
  if (!getSession()?.accessToken || !window.io) return;
  // One Socket per session. window.io() caches the instance per URL, so we never build a second one.
  // Socket واحد للجلسة، لأن window.io() يرجع نفس النسخة لنفس الرابط
  if (state.socket) { joinSelectedConversation(); return; }
  // Passing auth as a function makes Socket.IO read the token again on every reconnect attempt,
  // وهذا هو الحل لمشكلة انتهاء صلاحية Access Token بعد 15 دقيقة وموت الـ Socket للأبد
  state.socket = window.io(API_ORIGIN, { auth: async (callback) => callback({ token: await getFreshAccessToken() }) });
  bindSocketEvents(state.socket);
}

function bindSocketEvents(socket) {
  socket.on('connect', () => { state.socketRetryDelay = 1000; joinSelectedConversation(); updatePresenceUi(); });
  socket.on('disconnect', () => { state.onlineUserIds.clear(); updatePresenceUi(); });

  socket.on('connect_error', (error) => {
    console.warn('Socket connection failed:', error.message);
    updateConnectionUi();
    // A handshake rejected by the server (expired token) never reconnects on its own.
    // لما السيرفر يرفض الـ Handshake لازم نعيد المحاولة يدويًا بتوكن جديدة
    if (!socket.active) scheduleSocketReconnect();
  });

  socket.on('presence_snapshot', (data) => {
    state.onlineUserIds = new Set((Array.isArray(data?.userIds) ? data.userIds : []).map(Number).filter(Number.isInteger));
    updatePresenceUi();
  });

  socket.on('user_presence', (data) => {
    const userId = Number(data?.userId);
    if (!Number.isInteger(userId)) return;
    if (data.online) state.onlineUserIds.add(userId); else state.onlineUserIds.delete(userId);
    updatePresenceUi();
  });

  socket.on('new_message', (message) => {
    const conversationId = Number(message.conversationId);
    const isMine = Number(message.senderId) === Number(state.session.user.id);
    const isOpen = conversationId === Number(state.selectedConversationId);
    updateConversationPreview(message, !isMine && !isOpen);
    renderConversationList();
    if (!isOpen) {
      return;
    }
    if (!state.messages.items.some((item) => Number(item.id) === Number(message.id))) state.messages.items.push(message);
    if (!isMine) message.isRead = true;
    renderMessages(true);
    // The conversation is open in front of the user, so mark it read immediately
    // المستخدم فاتح المحادثة فعلاً، فنعلّم الرسالة كمقروءة فورًا بدون انتظار Refresh
    if (!isMine && isChatVisible()) markMessagesRead(conversationId);
  });

  socket.on('messages_read', (data) => {
    const readConversation = state.conversations.find((item) => Number(item.id) === Number(data.conversationId));
    if (readConversation) readConversation.unreadCount = 0;
    renderConversationList();
    if (Number(data.conversationId) !== Number(state.selectedConversationId)) return;
    state.messages.items = state.messages.items.map((message) => Number(message.senderId) !== Number(data.userId) ? { ...message, isRead: true, readAt: data.readAt } : message);
    renderMessages(true);
  });
}

function scheduleSocketReconnect() {
  if (state.socketRetryTimer || !getSession()?.accessToken) return;
  state.socketRetryTimer = window.setTimeout(() => {
    state.socketRetryTimer = null;
    state.socketRetryDelay = Math.min(state.socketRetryDelay * 2, 30000);
    if (state.socket && !state.socket.connected) state.socket.connect();
  }, state.socketRetryDelay);
}

function isChatVisible() { return state.view === 'chat' && document.visibilityState !== 'hidden'; }

function markMessagesRead(id) {
  const conversationId = Number(id);
  if (!Number.isInteger(conversationId) || conversationId <= 0) return;
  const conversation = state.conversations.find((item) => Number(item.id) === conversationId);
  if (conversation) conversation.unreadCount = 0;
  renderConversationList();
  if (state.socket?.connected) { state.socket.emit('mark_messages_read', conversationId); return; }
  // No live Socket, so use the HTTP endpoint. The server still notifies the sender.
  // بدون Socket نستخدم HTTP، والسيرفر يبلّغ المرسل بنفس الطريقة
  api(`/conversations/${conversationId}/read`, { method: 'PATCH' }).catch(() => undefined);
}

function disconnectSocket() {
  if (state.socketRetryTimer) { window.clearTimeout(state.socketRetryTimer); state.socketRetryTimer = null; }
  // Drop the listeners too, because window.io() hands back this same cached instance after login.
  // نحذف الـ Listeners لأن window.io() يرجع نفس النسخة بعد تسجيل دخول جديد
  if (state.socket) { state.socket.removeAllListeners(); state.socket.disconnect(); }
  state.socket = null;
  state.socketRetryDelay = 1000;
  state.onlineUserIds.clear();
}

function renderSettings(target) { const permissions = { ADMIN: ['users.read', 'users.update', 'users.delete', 'users.restore', 'articles.*', 'audit.read'], MODERATOR: ['articles.read', 'articles.update', 'articles.delete'], EDITOR: ['articles.read', 'articles.create', 'articles.update', 'articles.delete (own)'], USER: ['articles.read', 'articles.create', 'articles.update', 'articles.delete (own)'] }[state.session.user.role] || []; target.innerHTML = `<div class="page-intro"><div><span class="eyebrow">PREFERENCES / ACCOUNT</span><h2>${t('settings')}</h2><p>${state.lang === 'ar' ? 'معلومات الاتصال والحساب الحالي.' : 'Connection and current account information.'}</p></div></div><div class="settings-grid"><section class="glass-card settings-card"><div class="settings-avatar"><span class="avatar large">${esc(initials(state.session.user.username))}</span><div><span class="eyebrow">CURRENT USER</span><h3>${esc(state.session.user.username)}</h3><span class="role-badge role-${String(state.session.user.role).toLowerCase()}">${roleLabel(state.session.user.role)}</span></div></div><div class="settings-row"><span>${t('email')}</span><strong dir="ltr">${esc(state.session.user.email)}</strong></div><div class="settings-row"><span>${t('apiPath')}</span><code>/api → ${esc(API_ORIGIN)}</code></div><div class="settings-row"><span>${t('session')}</span><strong class="success-text">● ${t('active')}</strong></div></section><section class="glass-card settings-card"><div class="section-heading"><div><span class="eyebrow">ACCESS MATRIX</span><h3>${t('rolePermissions')}</h3></div></div><div class="permission-list">${permissions.map((permission) => `<span>${permissionLabel(permission)}</span>`).join('')}</div></section></div>`; }
function emptyState(message) { return `<div class="empty-state"><div class="empty-icon">${iconSvg('bolt')}</div><p>${esc(message)}</p></div>`; }
function openModal(content) { closeModal(); document.body.insertAdjacentHTML('beforeend', `<div class="modal-backdrop" id="modal-backdrop"><div class="modal glass-card">${content}</div></div>`); document.querySelector('#modal-backdrop')?.addEventListener('click', (event) => { if (event.target.id === 'modal-backdrop') closeModal(); }); }
function closeModal() { document.querySelector('#modal-backdrop')?.remove(); }
function openArticleViewModal(article) { if (!article) return; openModal(`<div class="modal-head"><div><span class="eyebrow">CONTENT / ARTICLE</span><h3>${state.lang === 'ar' ? 'عرض المقال' : 'View Article'}</h3></div><button class="close-btn" data-action="close-modal">×</button></div><div class="modal-body article-view-body"><div class="article-view-block" dir="rtl"><span class="eyebrow">${t('titleAr')}</span><h3>${esc(article.titleAr || '—')}</h3><p>${esc(article.contentAr || '—')}</p></div><div class="article-view-block" dir="ltr"><span class="eyebrow">${t('titleEn')}</span><h3>${esc(article.titleEn || '—')}</h3><p>${esc(article.contentEn || '—')}</p></div></div><div class="modal-foot">${canManageArticle(article) ? `<button class="primary-btn" data-action="close-modal" data-then-edit="${article.id}">${t('editArticle')}</button>` : ''}<button class="ghost-btn" type="button" data-action="close-modal">${t('cancel')}</button></div>`); }
function openArticleModal(article = null) { openModal(`<div class="modal-head"><div><span class="eyebrow">CONTENT EDITOR</span><h3>${article ? t('editArticle') : t('newArticle')}</h3></div><button class="close-btn" data-action="close-modal">×</button></div><form id="article-form" data-id="${article?.id || ''}"><div class="modal-body form-grid"><label class="field"><span>${t('titleAr')}</span><input name="titleAr" value="${esc(article?.titleAr || '')}"></label><label class="field" dir="ltr"><span>${t('titleEn')}</span><input name="titleEn" value="${esc(article?.titleEn || '')}"></label><label class="field full"><span>${t('contentAr')}</span><textarea name="contentAr" rows="5">${esc(article?.contentAr || '')}</textarea></label><label class="field full" dir="ltr"><span>${t('contentEn')}</span><textarea name="contentEn" rows="5">${esc(article?.contentEn || '')}</textarea></label></div><div class="modal-foot"><button class="primary-btn" type="submit">${article ? t('save') : t('addArticle')}</button><button class="ghost-btn" type="button" data-action="close-modal">${t('cancel')}</button></div></form>`); }
function openUserModal(user = null) { const roleOptions = ['USER', 'EDITOR', 'MODERATOR', 'ADMIN'].map((role) => `<option value="${role}" ${user?.role === role ? 'selected' : ''}>${roleLabel(role)}</option>`).join(''); openModal(`<div class="modal-head"><div><span class="eyebrow">ACCESS CONTROL</span><h3>${user ? t('editUser') : t('newUser')}</h3></div><button class="close-btn" data-action="close-modal">×</button></div><form id="user-form" data-id="${user?.id || ''}"><div class="modal-body form-grid"><label class="field"><span>${t('username')}</span><input name="username" value="${esc(user?.username || '')}" required></label><label class="field" dir="ltr"><span>${t('email')}</span><input type="email" name="email" value="${esc(user?.email || '')}" required></label><label class="field"><span>${user ? (state.lang === 'ar' ? 'كلمة مرور جديدة (اختياري)' : 'New password (optional)') : t('password')}</span><input type="password" name="password" ${user ? '' : 'required'}></label>${user ? `<label class="field"><span>${t('role')}</span><select name="role">${roleOptions}</select></label>` : ''}</div><div class="modal-foot"><button class="primary-btn" type="submit">${user ? t('save') : t('newUser')}</button><button class="ghost-btn" type="button" data-action="close-modal">${t('cancel')}</button></div></form>`); }
function openConversationModal() { openModal(`<div class="modal-head"><div><span class="eyebrow">REAL-TIME CHANNEL</span><h3>${t('newConversation')}</h3></div><button class="close-btn" data-action="close-modal">×</button></div><form id="conversation-form"><div class="modal-body"><p class="modal-note">${state.lang === 'ar' ? 'سيتم استخدام حسابك الحالي والطرف الآخر لإنشاء Conversation جديدة.' : 'Your current account and the other participant will be added to a new conversation.'}</p><label class="field"><span>${t('participantId')}</span><input name="participantId" type="number" min="1" required placeholder="2"></label></div><div class="modal-foot"><button class="primary-btn" type="submit">${t('startConversation')}</button><button class="ghost-btn" type="button" data-action="close-modal">${t('cancel')}</button></div></form>`); }
async function deleteArticle(id) { if (!window.confirm(state.lang === 'ar' ? 'هل أنت متأكد من حذف المقال؟' : 'Delete this article?')) return; try { await api(`/articles/${id}`, { method: 'DELETE' }); toast(t('articleDeleted')); await renderView(); } catch (error) { toast(readableError(error), 'error'); } }
async function deleteConversation(id) { if (!window.confirm(state.lang === 'ar' ? 'هل أنت متأكد من حذف هذه المحادثة ورسائلها؟' : 'Delete this conversation and its messages?')) return; try { await api(`/conversations/${id}`, { method: 'DELETE' }); if (Number(state.selectedConversationId) === Number(id)) { state.selectedConversationId = null; state.messages = { items: [], meta: null }; } state.conversations = []; toast(state.lang === 'ar' ? 'تم حذف المحادثة' : 'Conversation deleted'); await renderView(); } catch (error) { toast(readableError(error), 'error'); } }
async function toggleArticlePublication(id, isPublished) { const action = isPublished ? 'unpublish' : 'publish'; const message = isPublished ? (state.lang === 'ar' ? 'هل تريد تحويل المقال إلى مسودة؟' : 'Move this article to draft?') : (state.lang === 'ar' ? 'هل تريد نشر هذا المقال؟' : 'Publish this article?'); if (!window.confirm(message)) return; try { await api(`/articles/${id}/${action}`, { method: 'PATCH' }); toast(isPublished ? (state.lang === 'ar' ? 'تم تحويل المقال إلى مسودة' : 'Article moved to draft') : (state.lang === 'ar' ? 'تم نشر المقال' : 'Article published')); await renderView(); } catch (error) { toast(readableError(error), 'error'); } }
async function deleteUser(id) { if (!window.confirm(state.lang === 'ar' ? 'سيتم تنفيذ Soft Delete للمستخدم. هل تريد المتابعة؟' : 'This user will be soft-deleted. Continue?')) return; try { await api(`/users/${id}`, { method: 'DELETE' }); toast(t('userDeleted')); await renderView(); } catch (error) { toast(readableError(error), 'error'); } }
async function restoreUser(id) { const userId = Number(id); if (!Number.isInteger(userId) || userId <= 0) { toast(state.lang === 'ar' ? 'أدخل ID صحيحًا للمستخدم' : 'Enter a valid user ID', 'error'); return; } try { await api(`/users/${userId}/restore`, { method: 'POST' }); toast(t('userRestored')); await renderView(); } catch (error) { toast(readableError(error), 'error'); } }

function openParticipantIdentity(user = {}) {
  const isOnline = state.onlineUserIds.has(Number(user.id));
  openModal(`<section class="profile-modal"><div class="modal-head"><div><span class="eyebrow">MINDSPACE / PROFILE</span><h3>${esc(user.username || 'Participant')}</h3></div><button class="close-btn" type="button" data-action="close-modal" aria-label="Close">×</button></div><div class="profile-modal-body"><span class="role-avatar role-${String(user.role || 'USER').toLowerCase()}">${iconSvg(roleIcon(user.role || 'USER'))}</span><div class="profile-modal-details"><div><span>${state.lang === 'ar' ? 'اسم المستخدم' : 'Username'}</span><strong>${esc(user.username || '—')}</strong></div><div><span>${state.lang === 'ar' ? 'معرف المستخدم' : 'User ID'}</span><strong dir="ltr">#${esc(user.id || '—')}</strong></div><div><span>${state.lang === 'ar' ? 'البريد الإلكتروني' : 'Email'}</span><strong dir="ltr">${esc(user.email || '—')}</strong></div><div><span>${state.lang === 'ar' ? 'الدور' : 'Role'}</span><strong>${roleLabel(user.role || 'USER')}</strong></div><div><span>${state.lang === 'ar' ? 'الحالة' : 'Status'}</span><strong class="profile-status ${isOnline ? 'online' : ''}"><i></i>${isOnline ? (state.lang === 'ar' ? 'متصل' : 'Online') : (state.lang === 'ar' ? 'غير متصل' : 'Offline')}</strong></div></div></div></section>`);
}

function openMindSpaceArticleViewModal(article) {
  if (!article) return;
  const arabicAvailable = Boolean(article.titleAr || article.contentAr);
  const englishAvailable = Boolean(article.titleEn || article.contentEn);
  const useArabic = state.lang === 'ar' ? arabicAvailable || !englishAvailable : !englishAvailable;
  const title = useArabic ? article.titleAr : article.titleEn;
  const content = useArabic ? article.contentAr : article.contentEn;
  openModal(`<article class="article-reading" dir="${useArabic ? 'rtl' : 'ltr'}"><div class="article-reading-head"><button class="close-btn" type="button" data-action="close-modal" aria-label="Close">×</button></div><h2>${esc(title || '')}</h2><div class="article-reading-content">${esc(content || '').replace(/\r?\n/g, '<br>')}</div></article>`);
}

// Messages that arrived while the tab was in the background are read once the user comes back.
// الرسائل اللي وصلت والتاب في الخلفية تُعلَّم كمقروءة لما يرجع المستخدم
document.addEventListener('visibilitychange', () => { if (isChatVisible() && state.selectedConversationId) markMessagesRead(state.selectedConversationId); });
window.addEventListener('hashchange', () => { state.view = window.location.hash.replace('#', '') || 'dashboard'; if (state.session) render(); });
window.addEventListener('session-expired', () => { state.session = null; renderAuth('login', t('invalidSession')); });
render();
