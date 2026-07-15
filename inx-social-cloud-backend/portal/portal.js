const API = '/api';
const token = () => localStorage.getItem('inxToken');

async function req(path, options = {}) {
  const response = await fetch(API + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token() ? { Authorization: 'Bearer ' + token() } : {}),
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || 'Request failed');
    error.status = response.status;
    error.code = data.code;
    throw error;
  }
  return data;
}

function logout() {
  localStorage.removeItem('inxToken');
  location.href = 'login.html';
}

function notice(message, type = 'success') {
  const el = document.querySelector('#notice');
  el.textContent = message;
  el.className = `notice ${type}`;
}

function showError(message) {
  const el = document.querySelector('#error');
  el.textContent = message;
  el.className = 'notice error';
}

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatLimit(value) {
  return value === null || value === undefined ? 'Unlimited' : String(value);
}

async function refreshDashboard() {
  document.querySelector('#error').className = 'notice error hidden';
  await loadDashboard(false);
}

async function loadDashboard(showQueryNotice = true) {
  if (!token()) return logout();
  const params = new URLSearchParams(location.search);
  if (showQueryNotice && params.get('checkout') === 'cancelled') notice('Checkout was cancelled. No payment was taken.', 'warning');

  try {
    const data = await req('/portal/dashboard');
    const license = data.license;
    document.querySelector('#welcome').textContent = `Welcome, ${data.user.name || data.user.email}`;
    document.querySelector('#email').textContent = `${data.user.email} · ${data.user.emailVerifiedAt ? 'Verified email' : 'Email verification pending'}`;
    document.querySelector('#plan').textContent = license.plan;
    document.querySelector('#status').textContent = license.subscriptionStatus;
    document.querySelector('#pages').textContent = `${data.pages.filter(p => p.status === 'ACTIVE').length} / ${license.limits.pages}`;
    document.querySelector('#devices').textContent = `${data.devices.filter(d => d.status === 'ACTIVE').length} / ${license.limits.devices}`;
    document.querySelector('#batchLimit').textContent = formatLimit(license.limits.batchPosts);
    document.querySelector('#limitPages').textContent = license.limits.pages;
    document.querySelector('#limitBatch').textContent = formatLimit(license.limits.batchPosts);
    document.querySelector('#limitDevices').textContent = license.limits.devices;
    document.querySelector('#version').textContent = data.release.version;
    document.querySelector('#periodEnd').textContent = formatDate(data.billing.currentPeriodEnd || license.trialEndsAt);
    document.querySelector('#provider').textContent = data.billing.provider ? data.billing.provider.toUpperCase() : 'INX Social trial';

    const manage = document.querySelector('#manageBillingBtn');
    manage.classList.toggle('hidden', !data.billing.canManage);

    if (data.billing.cancelAtPeriodEnd) {
      document.querySelector('#billingTitle').textContent = `${license.plan} cancellation scheduled`;
      document.querySelector('#billingSummary').textContent = `Your paid access remains available until ${formatDate(data.billing.currentPeriodEnd)}.`;
    } else if (data.billing.provider === 'stripe') {
      document.querySelector('#billingTitle').textContent = `${license.plan} subscription`;
      document.querySelector('#billingSummary').textContent = `Your Stripe subscription is ${String(license.subscriptionStatus).toLowerCase()}.`;
    } else if (license.subscriptionStatus === 'TRIALING') {
      document.querySelector('#billingTitle').textContent = '5-day free trial';
      document.querySelector('#billingSummary').textContent = `Your trial is active until ${formatDate(license.trialEndsAt)}. Choose Starter or Pro before it ends.`;
    } else {
      document.querySelector('#billingSummary').textContent = 'Choose a paid plan to continue using INX Social.';
    }
  } catch (error) {
    if (error.status === 401 || error.status === 403 && /token|auth/i.test(error.message)) return logout();
    showError(error.message);
  }

  try {
    const planData = await req('/portal/plans');
    document.querySelector('#plansGrid').innerHTML = planData.plans.map(plan => `
      <article class="plan-card ${plan.id === 'PRO' ? 'pro' : ''}">
        ${plan.id === 'PRO' ? '<span class="recommended">MOST FLEXIBLE</span>' : ''}
        <span class="plan-name">${plan.name}</span>
        <div class="price"><sup>£</sup>${plan.price}<small>/month</small></div>
        <ul>${plan.features.map(feature => `<li>${feature}</li>`).join('')}</ul>
        <button class="button ${plan.id === 'PRO' ? 'primary' : 'dark'}" ${planData.checkoutEnabled && planData.webhookEnabled ? '' : 'disabled'} onclick="startCheckout('${plan.id}', this)">
          ${planData.checkoutEnabled && planData.webhookEnabled ? `Choose ${plan.name}` : 'Stripe setup incomplete'}
        </button>
      </article>
    `).join('');
  } catch (error) {
    showError(error.message);
  }
}

async function startCheckout(plan, button) {
  try {
    button.disabled = true;
    button.textContent = 'Opening secure checkout…';
    const data = await req('/billing/checkout', { method: 'POST', body: JSON.stringify({ plan }) });
    location.href = data.url;
  } catch (error) {
    alert(error.message);
    button.disabled = false;
    button.textContent = `Choose ${plan === 'PRO' ? 'Pro' : 'Starter'}`;
  }
}

async function manageBilling() {
  try {
    const data = await req('/billing/portal', { method: 'POST', body: '{}' });
    location.href = data.url;
  } catch (error) {
    alert(error.message);
  }
}

async function downloadApp() {
  try {
    const data = await req('/portal/download');
    location.href = data.url;
  } catch (error) {
    alert(error.message);
  }
}
