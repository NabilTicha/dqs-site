(() => {
  const params = new URLSearchParams(window.location.search);
  const userId = params.get('id');

  if (!userId) {
    Auth.onReady(user => {
      if (user) {
        window.location.replace(`/profile.html?id=${user.id}`);
      } else {
        document.getElementById('profile-hero').innerHTML = `
          <div class="cta-block">
            <h2>Sign in to view your profile</h2>
            <p>Or visit a profile via the leaderboard.</p>
            <button class="btn btn-primary" onclick="Auth.login()">Sign in with TU Delft</button>
          </div>
        `;
      }
    });
    return;
  }

  loadProfile(userId);

  async function loadProfile(id) {
    try {
      const res = await fetch(`/api/users/${id}`, { credentials: 'same-origin' });
      if (!res.ok) {
        document.getElementById('profile-hero').innerHTML =
          `<div class="empty-state"><p>Server returned ${res.status}.</p></div>`;
        return;
      }
      const data = await res.json();
      renderProfile(data);
    } catch (e) {
      document.getElementById('profile-hero').innerHTML =
        `<div class="empty-state"><p>Failed to load profile.</p></div>`;
    }
  }

  function parseDate(s) {
    if (!s) return new Date(NaN);
    const iso = typeof s === 'string' && /^\d{4}-\d{2}-\d{2} /.test(s)
      ? s.replace(' ', 'T') + 'Z'
      : s;
    return new Date(iso);
  }

  function fmtDate(s, opts) {
    const d = parseDate(s);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-US', opts);
  }

  function renderProfile(data) {
    const user = data.user || {};
    const drill = data.drill;
    const created = fmtDate(user.created_at, { month: 'long', year: 'numeric' });
    const attemptCount = drill ? drill.attempts : 0;

    document.getElementById('profile-hero').innerHTML = `
      <div class="profile-header">
        ${user.picture_url ? `<img src="${user.picture_url}" class="profile-avatar" referrerpolicy="no-referrer" alt="" />` : ''}
        <div class="profile-info">
          <h2 style="margin-bottom: 0.3rem;">${user.name || 'Unknown user'}</h2>
          <span class="profile-meta">Member since ${created} · ${attemptCount} drill attempt${attemptCount !== 1 ? 's' : ''}</span>
        </div>
      </div>
    `;

    const drillSection = document.getElementById('drill-section');
    const cards = document.getElementById('score-cards');

    if (drill && drill.best) {
      drillSection.style.display = '';
      const b = drill.best;
      cards.innerHTML = `
        <div class="score-card">
          <span class="score-value">${b.score}</span>
          <span class="score-label">Best score</span>
        </div>
        <div class="score-card">
          <span class="score-value">${b.correct}</span>
          <span class="score-label">Correct</span>
        </div>
        <div class="score-card">
          <span class="score-value">${b.wrong}</span>
          <span class="score-label">Wrong</span>
        </div>
        <div class="score-card">
          <span class="score-value">${b.skipped}</span>
          <span class="score-label">Skipped</span>
        </div>
      `;
    }
  }
})();
