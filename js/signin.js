/* ============================================================
   freshcart — signin.js
   Handles: creating real accounts (saved in localStorage), checking the
   email + password on Sign In, demo auto-fill, feedback alerts, and logout.
   Each account gets its own cart, wishlist, delivery place and orders —
   store.js builds the per-account storage keys from the signed-in email.
   ============================================================ */

// same key store.js uses for "who is signed in" (store.js is loaded first on this page)
const USER_SESSION_KEY = (window.FC && window.FC.KEYS && window.FC.KEYS.user) || 'freshcart-user-v2';

// Predefined demo accounts for easy testing
const DEMO_ACCOUNTS = {
  customer: {
    name: 'Alex Morgan',
    email: 'user@freshcart.com',
    password: 'password123',
    role: 'Customer Account'
  },
  grower: {
    name: 'Sun Valley Organic Farm',
    email: 'farmer@freshcart.com',
    password: 'growerpass123',
    role: 'Local Grower / Partner'
  }
};

/* ---------- Registered accounts ----------
   Every account created with "Create Account" is saved in Local Storage under
   'freshcart-users' as  { name, email, role, passHash, createdAt }.
   The email (lower-case) is the account's unique id. store.js uses it to give
   each account its own cart, wishlist, delivery place and orders.
   (Demo project: on a real site the accounts + password check live on a server.) */

const USERS_KEY = 'freshcart-users';

const normEmail = (email) => String(email).trim().toLowerCase();

function getUsers() {
  try { return JSON.parse(localStorage.getItem(USERS_KEY)) || []; } catch (e) { return []; }
}

function saveUsers(list) {
  localStorage.setItem(USERS_KEY, JSON.stringify(list));
}

function findUser(email) {
  const key = normEmail(email);
  return getUsers().find((u) => u.email === key) || null;
}

function isDemoEmail(email) {
  const key = normEmail(email);
  return Object.values(DEMO_ACCOUNTS).some((a) => a.email === key);
}

// We never keep the plain password: only a SHA-256 hash of  email + password.
async function hashPassword(email, password) {
  const text = normEmail(email) + ':' + password;
  if (window.crypto && window.crypto.subtle) {
    const buf = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  // very old browsers / insecure pages without SubtleCrypto: simple fallback hash
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return 'x' + (h >>> 0).toString(16);
}

// Returns { user } on success or { error } with a message to show.
async function checkCredentials(email, password) {
  const demo = Object.values(DEMO_ACCOUNTS).find((a) => a.email === email);
  if (demo) {
    return demo.password === password
      ? { user: { name: demo.name, email: demo.email, role: demo.role } }
      : { error: 'Incorrect password.' };
  }

  const account = findUser(email);
  if (!account) return { error: 'No account found for this email. Please create one first.' };
  if (account.passHash !== await hashPassword(email, password)) return { error: 'Incorrect password.' };
  return { user: { name: account.name, email: account.email, role: account.role } };
}

function getActiveUser() {
  const raw = localStorage.getItem(USER_SESSION_KEY);
  if (raw) {
    try { return JSON.parse(raw); } catch (e) { localStorage.removeItem(USER_SESSION_KEY); }
  }
  return null;
}

function setActiveUser(user) {
  localStorage.setItem(USER_SESSION_KEY, JSON.stringify(user));
  // Dispatch custom event so navbar updates instantly
  window.dispatchEvent(new Event('freshcart-auth-change'));
}

function removeActiveUser() {
  localStorage.removeItem(USER_SESSION_KEY);
  window.dispatchEvent(new Event('freshcart-auth-change'));
}

function showAlert(message, type = 'error') {
  const alertBox = document.getElementById('alert-box');
  if (!alertBox) return;

  alertBox.classList.remove('hidden', 'bg-red-50', 'text-red-700', 'border-red-200', 'bg-emerald-50', 'text-emerald-700', 'border-emerald-200', 'border');

  if (type === 'error') {
    alertBox.classList.add('bg-red-50', 'text-red-700', 'border', 'border-red-200');
  } else {
    alertBox.classList.add('bg-emerald-50', 'text-emerald-700', 'border', 'border-emerald-200');
  }

  alertBox.textContent = message;
}

function hideAlert() {
  const alertBox = document.getElementById('alert-box');
  if (alertBox) alertBox.classList.add('hidden');
}

function initAuthUI() {
  const user = getActiveUser();
  const loggedInView = document.getElementById('logged-in-view');
  const authFormView = document.getElementById('auth-form-view');

  if (!loggedInView || !authFormView) return;

  if (user) {
    loggedInView.classList.remove('hidden');
    authFormView.classList.add('hidden');

    document.getElementById('user-display-name').textContent = user.name || 'Valued User';
    document.getElementById('user-display-email').textContent = user.email || '';
    document.getElementById('user-display-role').textContent = user.role || 'Customer Account';
  } else {
    loggedInView.classList.add('hidden');
    authFormView.classList.remove('hidden');
  }
}

function initTabs() {
  const tabSignin = document.getElementById('tab-signin');
  const tabSignup = document.getElementById('tab-signup');
  const formSignin = document.getElementById('form-signin');
  const formSignup = document.getElementById('form-signup');

  if (!tabSignin || !tabSignup || !formSignin || !formSignup) return;

  const switchToSignin = () => {
    hideAlert();
    tabSignin.className = 'flex-1 rounded-lg py-2 font-body text-xs font-semibold transition text-forest bg-white shadow-sm';
    tabSignup.className = 'flex-1 rounded-lg py-2 font-body text-xs font-semibold transition text-slate-500 hover:text-forest';
    formSignin.classList.remove('hidden');
    formSignup.classList.add('hidden');
  };

  const switchToSignup = () => {
    hideAlert();
    tabSignup.className = 'flex-1 rounded-lg py-2 font-body text-xs font-semibold transition text-forest bg-white shadow-sm';
    tabSignin.className = 'flex-1 rounded-lg py-2 font-body text-xs font-semibold transition text-slate-500 hover:text-forest';
    formSignup.classList.remove('hidden');
    formSignin.classList.add('hidden');
  };

  tabSignin.addEventListener('click', switchToSignin);
  tabSignup.addEventListener('click', switchToSignup);
}

function initPasswordToggles() {
  const toggleSigninPass = document.getElementById('toggle-signin-password');
  const signinPassInput = document.getElementById('signin-password');
  if (toggleSigninPass && signinPassInput) {
    toggleSigninPass.addEventListener('click', () => {
      const isPassword = signinPassInput.type === 'password';
      signinPassInput.type = isPassword ? 'text' : 'password';
      toggleSigninPass.textContent = isPassword ? 'Hide' : 'Show';
    });
  }

  const toggleSignupPass = document.getElementById('toggle-signup-password');
  const signupPassInput = document.getElementById('signup-password');
  if (toggleSignupPass && signupPassInput) {
    toggleSignupPass.addEventListener('click', () => {
      const isPassword = signupPassInput.type === 'password';
      signupPassInput.type = isPassword ? 'text' : 'password';
      toggleSignupPass.textContent = isPassword ? 'Hide' : 'Show';
    });
  }
}

function initDemoButtons() {
  const btnUser = document.getElementById('btn-demo-user');
  const btnGrower = document.getElementById('btn-demo-grower');

  if (btnUser) {
    btnUser.addEventListener('click', () => {
      document.getElementById('tab-signin').click();
      document.getElementById('signin-email').value = DEMO_ACCOUNTS.customer.email;
      document.getElementById('signin-password').value = DEMO_ACCOUNTS.customer.password;
      showAlert('Demo customer credentials filled! Click "Sign In" to proceed.', 'success');
    });
  }

  if (btnGrower) {
    btnGrower.addEventListener('click', () => {
      document.getElementById('tab-signin').click();
      document.getElementById('signin-email').value = DEMO_ACCOUNTS.grower.email;
      document.getElementById('signin-password').value = DEMO_ACCOUNTS.grower.password;
      showAlert('Demo grower credentials filled! Click "Sign In" to proceed.', 'success');
    });
  }
}

function initForms() {
  const formSignin = document.getElementById('form-signin');
  const formSignup = document.getElementById('form-signup');
  const btnSignout = document.getElementById('btn-signout');

  if (formSignin) {
    formSignin.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideAlert();

      const email = normEmail(document.getElementById('signin-email').value);
      const password = document.getElementById('signin-password').value;

      if (!email || !password) {
        showAlert('Please fill in both email and password.');
        return;
      }

      // Submit animation
      const btnSubmit = document.getElementById('btn-submit-signin');
      btnSubmit.disabled = true;
      btnSubmit.innerHTML = '<span>Signing in…</span>';

      // Look the account up and check the password
      const result = await checkCredentials(email, password);

      setTimeout(() => {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = '<span>Sign In</span>';

        if (!result.user) {
          showAlert(result.error);
          return;
        }

        setActiveUser(result.user);
        formSignin.reset();
        showAlert(`Welcome back, ${result.user.name}!`, 'success');
        initAuthUI();
      }, 500);
    });
  }

  if (formSignup) {
    formSignup.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideAlert();

      const name = document.getElementById('signup-name').value.trim();
      const email = normEmail(document.getElementById('signup-email').value);
      const password = document.getElementById('signup-password').value;

      if (!name || !email || !password) {
        showAlert('Please complete all required fields.');
        return;
      }

      if (password.length < 6) {
        showAlert('Password must be at least 6 characters long.');
        return;
      }

      // one account per email
      if (isDemoEmail(email) || findUser(email)) {
        showAlert('An account with this email already exists. Please sign in instead.');
        return;
      }

      const btnSubmit = document.getElementById('btn-submit-signup');
      btnSubmit.disabled = true;
      btnSubmit.innerHTML = '<span>Creating Account…</span>';

      // Save the new account (password stored only as a hash)
      const account = {
        name: name,
        email: email,
        role: 'Customer Account',
        passHash: await hashPassword(email, password),
        createdAt: new Date().toISOString()
      };
      const users = getUsers();
      users.push(account);
      saveUsers(users);

      const newUser = { name: account.name, email: account.email, role: account.role };

      setTimeout(() => {
        setActiveUser(newUser);            // sign the new user straight in
        formSignup.reset();
        showAlert(`Account created! Welcome to freshcart, ${newUser.name}.`, 'success');
        initAuthUI();
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = '<span>Create Account</span>';
      }, 500);
    });
  }

  if (btnSignout) {
    btnSignout.addEventListener('click', () => {
      removeActiveUser();
      initAuthUI();
      showAlert('You have signed out successfully.', 'success');
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initAuthUI();
  initTabs();
  initPasswordToggles();
  initDemoButtons();
  initForms();
});
