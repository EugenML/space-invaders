// Auth + leaderboard UI
(function () {
  const authModal     = document.getElementById('authModal');
  const authUsername  = document.getElementById('authUsername');
  const authPassword  = document.getElementById('authPassword');
  const authError     = document.getElementById('authError');
  const authSubmit    = document.getElementById('authSubmit');
  const authClose     = document.getElementById('authClose');
  const tabLogin      = document.getElementById('tabLogin');
  const tabRegister   = document.getElementById('tabRegister');
  const userStatus    = document.getElementById('userStatus');
  const authToggleBtn = document.getElementById('authToggleBtn');
  const logoutBtn     = document.getElementById('logoutBtn');
  const lbModal       = document.getElementById('lbModal');
  const lbBody        = document.getElementById('lbBody');
  const leaderboardBtn= document.getElementById('leaderboardBtn');
  const lbClose       = document.getElementById('lbClose');

  let mode = 'login'; // or 'register'

  // --- Session state ---
  let session = null;
  try { session = JSON.parse(localStorage.getItem('si_session')); } catch {}

  function updateHUD() {
    if (session) {
      userStatus.textContent = `PLAYER: ${session.username}`;
      authToggleBtn.classList.add('hidden');
      logoutBtn.classList.remove('hidden');
    } else {
      userStatus.textContent = 'NOT LOGGED IN';
      authToggleBtn.classList.remove('hidden');
      logoutBtn.classList.add('hidden');
    }
  }
  updateHUD();

  // --- Tab switching ---
  tabLogin.addEventListener('click', () => {
    mode = 'login';
    tabLogin.classList.add('active');
    tabRegister.classList.remove('active');
    authSubmit.textContent = 'LOGIN';
    authError.textContent = '';
  });
  tabRegister.addEventListener('click', () => {
    mode = 'register';
    tabRegister.classList.add('active');
    tabLogin.classList.remove('active');
    authSubmit.textContent = 'REGISTER';
    authError.textContent = '';
  });

  // --- Open/close ---
  authToggleBtn.addEventListener('click', () => {
    authModal.classList.remove('hidden');
    authUsername.focus();
  });
  authClose.addEventListener('click', () => authModal.classList.add('hidden'));
  authModal.addEventListener('click', e => { if (e.target === authModal) authModal.classList.add('hidden'); });

  // --- Submit ---
  authSubmit.addEventListener('click', doAuth);
  [authUsername, authPassword].forEach(el =>
    el.addEventListener('keydown', e => { if (e.key === 'Enter') doAuth(); })
  );

  async function doAuth() {
    authError.textContent = '';
    const username = authUsername.value.trim();
    const password = authPassword.value;
    if (!username || !password) { authError.textContent = 'Fill in both fields.'; return; }

    authSubmit.disabled = true;
    authSubmit.textContent = '...';

    try {
      const endpoint = mode === 'login' ? '/api/login' : '/api/register';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        authError.textContent = data.error || 'Something went wrong.';
        return;
      }

      session = { token: data.token, username: data.username };
      localStorage.setItem('si_session', JSON.stringify(session));
      authModal.classList.add('hidden');
      authUsername.value = '';
      authPassword.value = '';
      updateHUD();
    } catch {
      authError.textContent = 'Could not reach server.';
    } finally {
      authSubmit.disabled = false;
      authSubmit.textContent = mode === 'login' ? 'LOGIN' : 'REGISTER';
    }
  }

  // --- Logout ---
  logoutBtn.addEventListener('click', () => {
    session = null;
    localStorage.removeItem('si_session');
    updateHUD();
  });

  // --- Save score (called by game.js) ---
  window.saveScore = async function (score, level) {
    if (!session) return;
    try {
      await fetch('/api/save-score', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.token}`,
        },
        body: JSON.stringify({ score, level }),
      });
    } catch {}
  };

  // --- Leaderboard ---
  leaderboardBtn.addEventListener('click', async () => {
    lbModal.classList.remove('hidden');
    lbBody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#33ff3366">LOADING...</td></tr>';
    try {
      const res = await fetch('/api/leaderboard');
      const data = await res.json();
      lbBody.innerHTML = data.map((row, i) =>
        `<tr><td>${i + 1}</td><td>${row.Username}</td><td>${row.HighScore}</td></tr>`
      ).join('') || '<tr><td colspan="3" style="text-align:center">No scores yet.</td></tr>';
    } catch {
      lbBody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#ff4444">Error loading.</td></tr>';
    }
  });

  lbClose.addEventListener('click', () => lbModal.classList.add('hidden'));
  lbModal.addEventListener('click', e => { if (e.target === lbModal) lbModal.classList.add('hidden'); });
})();
