(() => {
  const stepEmail  = document.getElementById('step-email');
  const stepCode   = document.getElementById('step-code');
  const emailInput = document.getElementById('email-input');
  const codeInput  = document.getElementById('code-input');
  const sendBtn    = document.getElementById('send-btn');
  const verifyBtn  = document.getElementById('verify-btn');
  const msg        = document.getElementById('login-msg');
  const sentTo     = document.getElementById('sent-to');
  const restart    = document.getElementById('restart-link');
  const resend     = document.getElementById('resend-link');

  let email = '';

  /* Only same-origin relative paths, so ?next= can't be used to bounce a
     signed-in user off to another site. */
  function safeNext() {
    const raw = new URLSearchParams(location.search).get('next') || '/';
    return /^\/(?!\/)/.test(raw) ? raw : '/';
  }

  function show(text, kind) {
    msg.textContent = text;
    msg.className = 'login-msg ' + kind;
  }

  function clear() {
    msg.textContent = '';
    msg.className = 'login-msg';
  }

  async function post(url, body) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    let data = {};
    try { data = await res.json(); } catch (_) {}
    return { ok: res.ok, data };
  }

  async function requestCode(address, btn, label) {
    btn.disabled = true;
    btn.textContent = 'Sending…';
    clear();

    const { ok, data } = await post('/api/auth/email/request', { email: address });

    btn.disabled = false;
    btn.textContent = label;

    if (!ok) {
      show(data.error || 'Something went wrong. Try again.', 'error');
      return false;
    }
    return true;
  }

  stepEmail.addEventListener('submit', async (e) => {
    e.preventDefault();
    const address = emailInput.value.trim().toLowerCase();
    if (!address) return;

    if (!await requestCode(address, sendBtn, 'Send code')) return;

    email = address;
    sentTo.textContent = email;
    stepEmail.style.display = 'none';
    stepCode.style.display = '';
    show('Code sent. Check your inbox — it may take a few seconds.', 'info');
    codeInput.focus();
  });

  stepCode.addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = codeInput.value.replace(/\D/g, '');
    if (code.length !== 6) {
      show('Enter the 6-digit code.', 'error');
      return;
    }

    verifyBtn.disabled = true;
    verifyBtn.textContent = 'Verifying…';
    clear();

    const { ok, data } = await post('/api/auth/email/verify', { email, code });

    if (!ok) {
      verifyBtn.disabled = false;
      verifyBtn.textContent = 'Verify';
      show(data.error || 'Something went wrong. Try again.', 'error');
      codeInput.select();
      return;
    }

    verifyBtn.textContent = 'Signed in';
    location.href = safeNext();
  });

  // Strip anything non-numeric as it's typed, and submit as soon as 6 land —
  // matters most for the autocomplete="one-time-code" paste on mobile.
  codeInput.addEventListener('input', () => {
    const cleaned = codeInput.value.replace(/\D/g, '').slice(0, 6);
    if (cleaned !== codeInput.value) codeInput.value = cleaned;
    if (cleaned.length === 6) stepCode.requestSubmit();
  });

  restart.addEventListener('click', () => {
    email = '';
    codeInput.value = '';
    stepCode.style.display = 'none';
    stepEmail.style.display = '';
    clear();
    emailInput.focus();
  });

  resend.addEventListener('click', async () => {
    if (!email) return;
    if (await requestCode(email, verifyBtn, 'Verify')) {
      codeInput.value = '';
      show('New code sent. The previous one no longer works.', 'info');
      codeInput.focus();
    }
  });

  // Already signed in? Nothing to do here.
  if (window.Auth) {
    Auth.onReady((user) => {
      if (user) location.href = safeNext();
    });
  }
})();
