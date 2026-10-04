/* Sign in · student sign-up with email OTP · forgot password */
(function () {
  const { $, $$, api, icon, esc, showFormError, busy, formData, toast } = P;
  let role = 'STUDENT';
  // What the OTP screen is currently verifying
  const otpState = { purpose: null, email: '', timer: null };

  if (location.protocol === 'file:') {
    document.body.innerHTML = '<div style="padding:40px;font-family:sans-serif"><h2>Start the server first</h2><p>Run <code>npm start</code> in the project folder, then open <b>http://localhost:3000</b>.</p></div>';
    return;
  }

  // ---------- password show / hide
  $$('.pw-toggle').forEach((b) => {
    const input = b.previousElementSibling;
    const draw = () => { b.innerHTML = icon(input.type === 'password' ? 'eye' : 'eyeOff'); };
    b.onclick = () => { input.type = input.type === 'password' ? 'text' : 'password'; draw(); input.focus(); };
    draw();
  });

  if (P.qs('expired')) $('#banner').innerHTML = `<div class="banner warn" style="margin-bottom:20px">${icon('clock')}<span>Your session ended. Please sign in again.</span></div>`;

  // ---------- role switch
  $$('.role-switch button').forEach((b) => b.onclick = () => {
    role = b.dataset.role;
    $$('.role-switch button').forEach((x) => x.classList.toggle('active', x === b));
    $('#register-link').classList.toggle('hidden', role === 'TPO');
    $('.form-error', $('#login-form')).classList.remove('show');
  });

  // ---------- views
  const VIEWS = ['login', 'register', 'forgot', 'otp'];
  function show(view) {
    VIEWS.forEach((v) => $(`#view-${v}`).classList.toggle('hidden', v !== view));
    const first = $(`#view-${view} input:not([type=hidden])`);
    if (first) setTimeout(() => first.focus(), 0);
  }
  function route() {
    const h = location.hash.replace('#', '');
    if (h === 'otp' && !otpState.purpose) return show('login');
    show(VIEWS.includes(h) ? h : 'login');
  }
  window.addEventListener('hashchange', route);
  route();

  // ---------- sign in
  $('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const data = formData(form);
    if (!data.email || !data.password) return showFormError(form, new Error('Enter your email and password.'));
    await busy($('button[type=submit]', form), async () => {
      try {
        const r = await api('/api/auth/login', { method: 'POST', body: { ...data, role } });
        const next = P.qs('next');
        location.href = next && next.startsWith(r.role === 'TPO' ? '/tpo/' : '/student/') ? next : r.redirect;
      } catch (err) { showFormError(form, err); }
    });
  });

  // ---------- register step 1
  api('/api/meta').then((m) => {
    $('#r-branch').innerHTML = '<option value="">Select your branch</option>' +
      Object.entries(m.branches).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('');
    if (m.allowedDomain) {
      $('#r-email').placeholder = `name@${m.allowedDomain}`;
      $('#domain-hint').textContent = `Use your college email ending in @${m.allowedDomain} — the code is sent there.`;
    }
  });

  let pendingRegister = null;
  $('#register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const d = formData(form);
    if (!d.name || !d.email || !d.roll_no || !d.branch) return showFormError(form, new Error('Please fill in every field.'));
    if ((d.password || '').length < 8 || !/\d/.test(d.password) || !/[A-Za-z]/.test(d.password)) {
      return showFormError(form, new Error('Password must be at least 8 characters and include a letter and a number.'));
    }
    $('.form-error', form).classList.remove('show');
    await busy($('button[type=submit]', form), async () => {
      try {
        const r = await api('/api/auth/register/start', { method: 'POST', body: d });
        pendingRegister = d;
        openOtp('REGISTER', r.email, r.resendIn, r.emailSent);
      } catch (err) { showFormError(form, err); }
    });
  });

  // ---------- forgot step 1
  $('#forgot-link').addEventListener('click', () => { $('#f-email').value = $('#email').value; });
  $('#forgot-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const email = $('#f-email').value.trim();
    if (!email) return showFormError(form, new Error('Enter your email.'));
    await busy($('button[type=submit]', form), async () => {
      try {
        const r = await api('/api/auth/forgot/start', { method: 'POST', body: { email } });
        openOtp('RESET', r.email, r.resendIn, r.emailSent);
      } catch (err) { showFormError(form, err); }
    });
  });

  // ---------- OTP screen
  function openOtp(purpose, email, resendIn, emailSent) {
    Object.assign(otpState, { purpose, email });
    const reg = purpose === 'REGISTER';
    $('#otp-email').textContent = email;
    $('#otp-step').textContent = reg ? 'Step 2 of 2 · Verify email' : 'Reset password';
    $('#otp-title').textContent = reg ? 'Check your inbox' : 'Enter the code';
    $('#otp-submit').textContent = reg ? 'Verify & create account' : 'Set new password';
    $('#otp-pw-field').classList.toggle('hidden', reg);
    $('#otp-dev').classList.toggle('hidden', emailSent !== false);
    $('#otp-code').value = ''; $('#otp-pw').value = '';
    $('.form-error', $('#otp-form')).classList.remove('show');
    startResendTimer(resendIn || 45);
    location.hash = 'otp';
    show('otp');
  }

  function startResendTimer(seconds) {
    const btn = $('#otp-resend');
    clearInterval(otpState.timer);
    let left = seconds;
    const tick = () => {
      btn.disabled = left > 0;
      btn.textContent = left > 0 ? `Resend code in ${left}s` : 'Resend code';
      left -= 1;
      if (left < -1) clearInterval(otpState.timer);
    };
    tick(); otpState.timer = setInterval(tick, 1000);
  }

  // Only digits, auto-submit when 6 are typed (register flow).
  $('#otp-code').addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6);
    if (e.target.value.length === 6 && otpState.purpose === 'REGISTER') $('#otp-form').requestSubmit();
  });

  $('#otp-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const code = $('#otp-code').value;
    if (code.length !== 6) return showFormError(form, new Error('Enter the 6-digit code from the email.'));
    const btn = $('#otp-submit');
    if (btn.disabled) return;
    await busy(btn, async () => {
      try {
        if (otpState.purpose === 'REGISTER') {
          const r = await api('/api/auth/register/verify', { method: 'POST', body: { email: otpState.email, code } });
          location.href = r.redirect;
        } else {
          const password = $('#otp-pw').value;
          if (password.length < 8 || !/\d/.test(password) || !/[A-Za-z]/.test(password)) throw new Error('New password must be at least 8 characters and include a letter and a number.');
          const r = await api('/api/auth/forgot/verify', { method: 'POST', body: { email: otpState.email, code, password } });
          toast('Password updated — you are signed in');
          setTimeout(() => { location.href = r.redirect; }, 600);
        }
      } catch (err) { showFormError(form, err); }
    });
  });

  $('#otp-resend').addEventListener('click', async () => {
    const btn = $('#otp-resend');
    try {
      const r = await api('/api/auth/otp/resend', { method: 'POST', body: { email: otpState.email, purpose: otpState.purpose } });
      toast(r.emailSent === false ? 'New code created — see the server window' : 'A new code is on its way');
      $('#otp-dev').classList.toggle('hidden', r.emailSent !== false);
      startResendTimer(r.resendIn);
    } catch (err) { P.fail(err); btn.disabled = false; }
  });

  $('#otp-back').addEventListener('click', (e) => {
    e.preventDefault();
    location.hash = otpState.purpose === 'REGISTER' ? 'register' : 'forgot';
    if (otpState.purpose === 'REGISTER' && pendingRegister) $('#r-email').focus();
  });

  // ---------- live numbers (only shown once there is real data)
  api('/api/public/summary').then((s) => {
    if (!s.live && !s.offers) return;
    $('#summary').classList.remove('hidden');
    $('[data-k=offers]').textContent = s.offers;
    $('[data-k=highest]').textContent = s.highest ? `₹${s.highest}L` : '—';
    $('[data-k=live]').textContent = s.live;
  }).catch(() => {});
})();
