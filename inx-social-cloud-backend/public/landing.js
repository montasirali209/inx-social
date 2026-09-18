const header = document.getElementById('siteHeader');
const menu = document.getElementById('menuButton');
const nav = document.getElementById('mainNav');
const landingAccount = document.getElementById('landingAccount');
const landingAccountName = document.getElementById('landingAccountName');
const landingAccountInitials = document.getElementById('landingAccountInitials');
const landingAccountRole = document.getElementById('landingAccountRole');
const landingSignIn = document.getElementById('landingSignIn');
const landingSignOut = document.getElementById('landingSignOut');

const sessionToken = () => localStorage.getItem('inxToken') || localStorage.getItem('inx-social-cloud-token');
function clearLandingSession() {
  localStorage.removeItem('inxToken');
  localStorage.removeItem('inx-social-cloud-token');
}
function initials(value) {
  return String(value || 'IN').trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'IN';
}

function showAuthenticatedNavigation(user) {
  const displayName = user?.name || user?.businessName || user?.email || 'INXSocial account';
  const administrator = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
  if (landingAccountName) landingAccountName.textContent = displayName;
  if (landingAccountInitials) landingAccountInitials.textContent = initials(displayName);
  if (landingAccountRole) landingAccountRole.textContent = administrator ? 'Admin signed in' : 'Account signed in';
  if (landingAccount) landingAccount.hidden = false;
  if (landingSignIn) landingSignIn.hidden = true;
  document.body.classList.add('session-authenticated');
  document.body.classList.toggle('admin-session', administrator);
  document.querySelectorAll('.guest-only').forEach(element => { element.hidden = true; });
  document.querySelectorAll('.member-only').forEach(element => { element.hidden = false; });
  document.querySelectorAll('a.app-entry').forEach(element => {
    const href = element.getAttribute('href') || '';
    if (href.startsWith('/portal/')) element.href = '/app/';
  });
  const memberCopy = document.querySelector('.member-pricing-copy');
  const guestCopy = document.querySelector('.guest-pricing-copy');
  if (guestCopy) guestCopy.hidden = true;
  if (memberCopy) {
    memberCopy.hidden = false;
    memberCopy.textContent = administrator
      ? 'Administrator access is separate from customer billing. Review subscription options below without changing administrator privileges.'
      : 'You are signed in. Review the plans below and manage your subscription securely inside INXSocial.';
  }
  return administrator;
}

function updatePlanButtons(currentPlan, administrator) {
  document.querySelectorAll('[data-plan-card]').forEach(card => card.classList.remove('current-plan'));
  document.querySelectorAll('.member-only.plan-action').forEach(button => {
    const targetPlan = button.dataset.plan;
    button.href = '/app/billing';
    if (administrator) {
      button.textContent = 'Review subscription options';
      return;
    }
    if (targetPlan === currentPlan) {
      button.textContent = 'Current plan · Manage';
      document.querySelector('[data-plan-card="' + targetPlan + '"]')?.classList.add('current-plan');
      return;
    }
    const ranks = { trial: 0, creator: 1, pro: 2, business: 3, agency: 4 };
    const labels = { trial: 'Trial', creator: 'Creator', pro: 'Pro', business: 'Business', agency: 'Agency' };
    button.textContent = (ranks[targetPlan] ?? 0) > (ranks[currentPlan] ?? 0)
      ? 'Upgrade to ' + (labels[targetPlan] || 'plan')
      : 'Review subscription';
  });
}

async function restoreLandingSession() {
  const token = sessionToken();
  if (!token) return;
  try {
    const response = await fetch('/api/auth/me', { headers: { Authorization: 'Bearer ' + token } });
    if (!response.ok) throw new Error('Session unavailable');
    const payload = await response.json();
    const administrator = showAuthenticatedNavigation(payload.user);
    if (administrator) return updatePlanButtons(null, true);
    try {
      const billingResponse = await fetch('/api/billing/overview', { headers: { Authorization: 'Bearer ' + token } });
      if (!billingResponse.ok) throw new Error('Billing unavailable');
      const billing = await billingResponse.json();
      updatePlanButtons(String(billing?.subscription?.planId || '').toLowerCase(), false);
    } catch {
      updatePlanButtons(null, false);
    }
  } catch {
    clearLandingSession();
  }
}

function activateTour(name) {
  document.querySelectorAll('[data-tour-target]').forEach(button => {
    const active = button.dataset.tourTarget === name;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
  });
  document.querySelectorAll('[data-tour-panel]').forEach(panel => {
    const active = panel.dataset.tourPanel === name;
    panel.classList.toggle('active', active);
    panel.hidden = !active;
  });
}
document.querySelectorAll('[data-tour-target]').forEach(button => button.addEventListener('click', () => activateTour(button.dataset.tourTarget)));

function setupTilt(element) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !window.matchMedia('(pointer:fine)').matches) return;
  element.addEventListener('pointermove', event => {
    const rect = element.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
    element.style.setProperty('--ry', ((x - .5) * 7).toFixed(2) + 'deg');
    element.style.setProperty('--rx', ((.5 - y) * 6).toFixed(2) + 'deg');
    element.style.setProperty('--mx', (x * 100).toFixed(1) + '%');
    element.style.setProperty('--my', (y * 100).toFixed(1) + '%');
  });
  element.addEventListener('pointerleave', () => {
    element.style.setProperty('--ry', '0deg');
    element.style.setProperty('--rx', '0deg');
    element.style.setProperty('--mx', '50%');
    element.style.setProperty('--my', '50%');
  });
}
document.querySelectorAll('[data-tilt]').forEach(setupTilt);

document.querySelectorAll('.faq-item button').forEach(button => button.addEventListener('click', () => {
  const item = button.closest('.faq-item');
  const wasOpen = item?.classList.contains('open');
  document.querySelectorAll('.faq-item.open').forEach(openItem => {
    openItem.classList.remove('open');
    openItem.querySelector('button')?.setAttribute('aria-expanded', 'false');
  });
  if (!wasOpen) {
    item?.classList.add('open');
    button.setAttribute('aria-expanded', 'true');
  }
}));

const animated = [...document.querySelectorAll('[data-animate]')];
if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  animated.forEach(element => element.classList.add('will-animate'));
  const observer = new IntersectionObserver(entries => entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add('is-visible');
    entry.target.classList.remove('will-animate');
    observer.unobserve(entry.target);
  }), { threshold: 0.08, rootMargin: '0px 0px -6% 0px' });
  animated.forEach(element => observer.observe(element));
  setTimeout(() => animated.forEach(element => {
    element.classList.add('is-visible');
    element.classList.remove('will-animate');
  }), 1600);
}

landingSignOut?.addEventListener('click', () => {
  clearLandingSession();
  location.reload();
});
document.addEventListener('pointerdown', event => {
  if (landingAccount?.open && !landingAccount.contains(event.target)) landingAccount.open = false;
  if (nav?.classList.contains('open') && !nav.contains(event.target) && !menu?.contains(event.target)) {
    nav.classList.remove('open');
    menu?.setAttribute('aria-expanded', 'false');
  }
});
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  if (landingAccount?.open) {
    landingAccount.open = false;
    landingAccount.querySelector('summary')?.focus();
  }
  if (nav?.classList.contains('open')) {
    nav.classList.remove('open');
    menu?.setAttribute('aria-expanded', 'false');
    menu?.focus();
  }
});
landingAccount?.querySelectorAll('a, button').forEach(action => action.addEventListener('click', () => { landingAccount.open = false; }));
window.addEventListener('scroll', () => header?.classList.toggle('scrolled', window.scrollY > 18), { passive: true });
menu?.addEventListener('click', () => {
  const open = nav?.classList.toggle('open');
  menu.setAttribute('aria-expanded', String(Boolean(open)));
});
document.querySelectorAll('#mainNav a').forEach(link => link.addEventListener('click', () => {
  nav?.classList.remove('open');
  menu?.setAttribute('aria-expanded', 'false');
}));

void restoreLandingSession();
const year = document.getElementById('year');
if (year) year.textContent = new Date().getFullYear();
