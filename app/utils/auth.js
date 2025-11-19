// Auth page logic for Simple Tab Plus

// Apply system theme to auth page
function applySystemThemeToAuth() {
  try {
    const prefersDark =
      window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
  } catch (_) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
}

function watchSystemThemeChanges() {
  if (!window.matchMedia) return;
  const mql = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = (e) => {
    document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
  };
  if (mql.addEventListener) {
    mql.addEventListener('change', handler);
  } else if (mql.addListener) {
    mql.addListener(handler);
  }
}

let currentMode = 'signin';

function getModeFromHash() {
  const hash = (window.location.hash || '').toLowerCase();

  // Explicit modes controlled by our own links
  if (!hash || hash === '#' || hash === '#signin') return 'signin';
  if (hash.startsWith('#signup')) return 'signup';

  // For Supabase redirects like
  //   #access_token=...&type=signup
  // we still want the page in sign-in mode so users can log in
  // after verifying their email.
  return 'signin';
}

function applyMode(mode) {
  const title = document.getElementById('auth-title');
  const sub = document.getElementById('auth-sub');
  const pwd = document.getElementById('password');
  const submit = document.getElementById('submit-btn');

  currentMode = mode === 'signup' ? 'signup' : 'signin';

  if (currentMode === 'signup') {
    title.textContent = 'Create your account';
    sub.innerHTML = 'Already have an account? <a href="#" id="toggle-link">Sign in</a>';
    pwd.setAttribute('autocomplete', 'new-password');
    submit.textContent = "LET'S GO";
  } else {
    title.textContent = 'Welcome back!';
    sub.innerHTML = 'New to Simple Tab Plus? <a href="#" id="toggle-link">Sign up</a>';
    pwd.setAttribute('autocomplete', 'current-password');
    submit.textContent = "LET'S GO";
  }

  setupModeToggle();
}

function setupModeToggle() {
  const toggleLink = document.getElementById('toggle-link');
  if (!toggleLink) return;

  toggleLink.addEventListener('click', (e) => {
    e.preventDefault();
    const nextMode = currentMode === 'signup' ? 'signin' : 'signup';
    applyMode(nextMode);
    clearAuthHashFromUrl();
  });
}

function showNotification(message, type = 'success') {
  try {
    const existing = document.querySelector('.notification');
    if (existing) {
      existing.remove();
    }

    const container = document.createElement('div');
    container.className = 'notification ' + type;
    container.textContent = message;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'notification-close';
    closeBtn.setAttribute('aria-label', 'Close notification');
    closeBtn.innerHTML = '&times;';

    closeBtn.addEventListener('click', () => {
      container.classList.add('hide');
      setTimeout(() => container.remove(), 200);
    });

    container.appendChild(closeBtn);
    document.body.appendChild(container);

    setTimeout(() => {
      if (!container.classList.contains('hide')) {
        container.classList.add('hide');
        setTimeout(() => container.remove(), 200);
      }
    }, 5000);
  } catch (e) {
    console.error('Failed to show notification', e);
  }
}

function parseHashParams() {
  const raw = window.location.hash || '';
  if (!raw || raw === '#' || raw === '#signin' || raw === '#signup') return {};
  const fragment = raw.startsWith('#') ? raw.slice(1) : raw;
  const params = {};
  fragment.split('&').forEach((part) => {
    if (!part) return;
    const [key, value] = part.split('=');
    if (!key) return;
    params[decodeURIComponent(key)] = value ? decodeURIComponent(value) : '';
  });
  return params;
}

function clearAuthHashFromUrl() {
  if (!window.location.hash) return;
  try {
    const url = new URL(window.location.href);
    url.hash = '';
    window.history.replaceState(null, '', url.toString());
  } catch (_) {
    try {
      window.location.hash = '';
    } catch (_) {
      // Ignore if we can't change the hash for some reason
    }
  }
}

function handleSupabaseRedirectToast() {
  try {
    const params = parseHashParams();
    if (!params || Object.keys(params).length === 0) return;

    // Successful signup email verification
    if (params.access_token && params.type === 'signup') {
      showNotification(
        'Your email has been verified. You can now sign in with Simple Tab Plus.',
        'success'
      );
      applyMode('signin');
      clearAuthHashFromUrl();
      return;
    }

    // Error case from Supabase (if provided)
    if (params.error_description || params.error) {
      const msg =
        params.error_description || params.error ||
        'Email verification failed. Please try again or request a new link.';
      showNotification(msg, 'error');
      applyMode('signin');
      clearAuthHashFromUrl();
    }
  } catch (e) {
    console.error('Failed to handle Supabase redirect params', e);
  }
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
  // Apply system theme based on device setting
  applySystemThemeToAuth();
  watchSystemThemeChanges();

  // If already signed in, go to app immediately
  const sessionResp = await ensureAuthOrRedirect();
  if (sessionResp?.data?.session?.user) {
    redirectToApp();
    return;
  }

  // Setup mode UI (default to sign-in if no explicit mode)
  const initialMode = getModeFromHash();
  applyMode(initialMode);

  // Handle Supabase email verification callbacks (if present)
  handleSupabaseRedirectToast();

  // Clean up simple mode hashes from the URL so the address bar stays tidy
  if (window.location.hash === '#signin' || window.location.hash === '#signup') {
    clearAuthHashFromUrl();
  }

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

    const mode = currentMode;
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

      if (chrome.runtime.lastError) {
        console.error('Auth message failed:', chrome.runtime.lastError);
        showNotification('Something went wrong. Please try again.', 'error');
        return;
      }

      if (resp?.error) {
        const prefix = mode === 'signup' ? 'Sign up' : 'Sign in';
        showNotification(prefix + ' failed: ' + resp.error, 'error');
        return;
      }

      if (mode === 'signup') {
        // New flow: sign users in immediately after successful signup
        // The background script's authRegister handler has already called Supabase signUp.
        // As long as email confirmations are disabled in Supabase, a session exists now.
        redirectToApp();
        return;
      }

      // Sign-in success: go straight into the app
      redirectToApp();
    });
  });
});

