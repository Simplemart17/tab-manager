// Auth page logic for Simple Tab Plus

function getModeFromHash() {
  const hash = window.location.hash || '#signin';
  return hash.toLowerCase().includes('signup') ? 'signup' : 'signin';
}

function applyMode(mode) {
  const title = document.getElementById('auth-title');
  const sub = document.getElementById('auth-sub');
  const pwd = document.getElementById('password');
  const submit = document.getElementById('submit-btn');

  if (mode === 'signup') {
    title.textContent = 'Create your account';
    sub.innerHTML = 'Already have an account? <a href="#signin" id="toggle-link">Sign in</a>';
    pwd.setAttribute('autocomplete', 'new-password');
    submit.textContent = "LET'S GO";
  } else {
    title.textContent = 'Welcome back!';
    sub.innerHTML = 'New to Simple Tab Plus? <a href="#signup" id="toggle-link">Sign up</a>';
    pwd.setAttribute('autocomplete', 'current-password');
    submit.textContent = "LET'S GO";
  }
}

function onHashChange() {
  applyMode(getModeFromHash());
}

async function ensureAuthOrRedirect() {
  return await new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'authGetSession' }, (resp) => resolve(resp));
  });
}

function redirectToApp() {
  window.location.href = chrome.runtime.getURL('app/pages/newtab.html');
}

// Initialize
window.addEventListener('DOMContentLoaded', async () => {
  // If already signed in, go to app immediately
  const sessionResp = await ensureAuthOrRedirect();
  if (sessionResp?.data?.session?.user) {
    redirectToApp();
    return;
  }

  // Setup mode UI
  applyMode(getModeFromHash());
  window.addEventListener('hashchange', onHashChange);

  // Form handling
  const form = document.getElementById('auth-form');
  const emailEl = document.getElementById('email');
  const pwdEl = document.getElementById('password');
  const togglePwdBtn = document.getElementById('toggle-password');
  const submitBtn = document.getElementById('submit-btn');

  if (togglePwdBtn && pwdEl) {
    togglePwdBtn.addEventListener('click', () => {
      const showing = pwdEl.getAttribute('type') === 'text';
      pwdEl.setAttribute('type', showing ? 'password' : 'text');
      togglePwdBtn.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
    });
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = emailEl.value.trim();
    const password = pwdEl.value;
    if (!email || !password) return;

    const mode = getModeFromHash();
    const action = mode === 'signup' ? 'authRegister' : 'authLogin';

    // Loading indicator on the button
    const originalText = submitBtn.textContent;
    submitBtn.classList.add('loading');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Please wait…';

    chrome.runtime.sendMessage({ action, email, password }, (resp) => {
      submitBtn.classList.remove('loading');
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;

      if (resp?.error) {
        alert((mode === 'signup' ? 'Sign up' : 'Sign in') + ' failed: ' + resp.error);
        return;
      }
      redirectToApp();
    });
  });
});

