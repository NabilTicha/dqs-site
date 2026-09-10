// leaderboard.js — Optiver Prep leaderboard (averaged across 80-in-8, Zap-N, Math)

(() => {
  const fmt  = v => v == null ? '<span style="color:var(--muted)">—</span>' : Math.round(v);
  const fmtAvg = v => v == null ? '—' : parseFloat(v).toFixed(1);

  async function load() {
    const content = document.getElementById('leaderboard-content');
    if (!content) return;
    content.innerHTML = '<div class="loading">Loading…</div>';

    try {
      const res  = await fetch('/api/drill/optiver-leaderboard');
      const data = await res.json();
      const { leaderboard, personal } = data;

      // ---- Personal stats ----
      let personalHtml = '';
      if (personal) {
        const g = personal.by_game ?? {};
        personalHtml = `
          <div class="lb-personal">
            <span class="label">Your scores</span>
            <div class="lb-personal-stats">
              <span class="lb-personal-score">${fmtAvg(personal.optiver_score)}</span>
              <span class="lb-personal-detail">
                80-in-8: ${g['80in8'] != null ? Math.round(g['80in8']) : '—'} &nbsp;·&nbsp;
                Zap-N: ${g['zapn'] != null ? Math.round(g['zapn']) : '—'} &nbsp;·&nbsp;
                Math: ${g['math'] != null ? Math.round(g['math']) : '—'}
              </span>
            </div>
            <a href="/optiver-prep.html" class="btn btn-sm btn-primary">Practice</a>
          </div>`;
      } else if (personal === null) {
        personalHtml = `
          <div class="lb-personal lb-personal-cta">
            <p>Sign in and complete the assessments to appear on the leaderboard.</p>
            <a href="/optiver-prep.html" class="btn btn-primary btn-sm">Start Optiver Prep</a>
          </div>`;
      }

      if (!leaderboard || leaderboard.length === 0) {
        content.innerHTML = `
          ${personalHtml}
          <div class="empty-state">
            <p>No scores yet. <a href="/optiver-prep.html">Be the first to complete the prep.</a></p>
          </div>`;
        return;
      }

      const rows = leaderboard.map(row => {
        const medal   = row.rank === 1 ? '🥇' : row.rank === 2 ? '🥈' : row.rank === 3 ? '🥉' : row.rank;
        const modules = row.modules ?? 0;
        return `
          <tr>
            <td class="lb-rank">${medal}</td>
            <td>
              <div class="lb-user">
                ${row.picture_url ? `<img src="${row.picture_url}" class="lb-avatar" referrerpolicy="no-referrer" alt="" />` : ''}
                <span class="lb-name"><a href="/profile.html?id=${row.user_id}">${row.name}</a></span>
              </div>
            </td>
            <td class="lb-score">${fmtAvg(row.optiver_score)}</td>
            <td class="lb-detail">${fmt(row.s_80in8)}</td>
            <td class="lb-detail">${fmt(row.s_zapn)}</td>
            <td class="lb-detail">${fmt(row.s_math)}</td>
            <td class="lb-count">${modules} / 3</td>
          </tr>`;
      }).join('');

      content.innerHTML = `
        ${personalHtml}
        <p class="lb-note">
          Scores normalized to 0–100 per component · averaged across completed modules ·
          negative scores treated as 0
        </p>
        <table class="lb-table">
          <thead>
            <tr>
              <th>#</th>
              <th>User</th>
              <th>Average</th>
              <th>80-in-8</th>
              <th>Zap-N</th>
              <th>Math</th>
              <th>Modules</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>`;

    } catch {
      content.innerHTML = '<div class="empty-state"><p>Failed to load leaderboard.</p></div>';
    }
  }

  document.addEventListener('DOMContentLoaded', load);
})();
