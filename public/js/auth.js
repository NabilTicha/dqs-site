const Auth = (() => {
  let _user = null;
  let _ready = false;
  const _listeners = [];
  
  async function init() {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        _user = await res.json();
      }
    } catch (_) {}
    _ready = true;
    _listeners.forEach(fn => fn(_user));
    renderAuthUI();
  }

  function onReady(fn) {
    if (_ready) fn(_user);
    else _listeners.push(fn);
  }

  function getUser() { return _user; }
  function isLoggedIn() { return _user !== null; }

  function login() {
    // Email one-time code. The Microsoft OAuth endpoints are still in the repo
    // but unreachable: TU Delft blocks non-admins from registering Entra apps,
    // so /api/auth/login stays dormant unless ICT ever grants us one.
    if (window.location.pathname === '/login.html') return;
    const next = window.location.pathname + window.location.search;
    window.location.href = '/login.html?next=' + encodeURIComponent(next);
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    _user = null;
    renderAuthUI();
    window.location.reload();
  }

  function initials(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    const first = parts[0][0];
    const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
    return (first + last).toUpperCase();
  }

  function renderAuthUI() {
    const container = document.getElementById('auth-ui');
    if (!container) return;

    if (_user) {
      // Email sign-in gives us no photo, so fall back to initials rather than
      // an <img> with an empty src, which renders as a broken-image icon.
      const avatar = _user.picture
        ? `<img src="${_user.picture}" alt="" class="auth-avatar" referrerpolicy="no-referrer" />`
        : `<span class="auth-avatar auth-avatar--initials">${initials(_user.name)}</span>`;

      container.innerHTML = `
        <div class="auth-user">
          <a href="/profile.html?id=${_user.id}" class="auth-avatar-link">
            ${avatar}
            <span class="auth-name">${_user.name}</span>
          </a>
          <button class="btn btn-sm" onclick="Auth.logout()">Sign out</button>
        </div>
      `;
    } else {
      container.innerHTML = `
        <button class="btn btn-primary btn-sm" onclick="Auth.login()">Sign in with TU Delft</button>
      `;
    }
  }

  function requireAuth() {
    if (!_ready) {
      onReady(() => requireAuth());
      return false;
    }
    if (!_user) {
      login();
      return false;
    }
    return true;
  }

  init();

  return { onReady, getUser, isLoggedIn, login, logout, requireAuth };
})();
