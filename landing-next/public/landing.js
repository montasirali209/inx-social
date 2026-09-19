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
  return String(value || 'IN')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0])
    .join('')
    .toUpperCase() || 'IN';
}

function resolveAuthenticatedAppHref(anchor) {
  const raw = anchor.getAttribute('href') || '';
  if (!raw.startsWith('/portal/')) return raw;

  try {
    const url = new URL(raw, window.location.origin);
    const returnTo = url.searchParams.get('return');
    if (returnTo && returnTo.startsWith('/app/')) return returnTo;
  } catch {}

  return '/app/';
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

  document.querySelectorAll('a.app-entry').forEach(anchor => {
    anchor.href = resolveAuthenticatedAppHref(anchor);
  });

  const memberCopy = document.querySelector('.member-pricing-copy');
  const guestCopy = document.querySelector('.guest-pricing-copy');
  if (guestCopy) guestCopy.hidden = true;
  if (memberCopy) {
    memberCopy.hidden = false;
    memberCopy.textContent = administrator
      ? 'Administrator access is separate from customer billing. You can review subscription options without changing administrator privileges.'
      : 'You are signed in. Manage your current subscription or review the available plans below.';
  }

  return administrator;
}

function updatePlanButtons(currentPlan, administrator) {
  document.querySelectorAll('[data-plan-card]').forEach(card => card.classList.remove('current-plan'));

  document.querySelectorAll('.plan-card .plan-action').forEach(button => {
    const targetPlan = String(button.dataset.plan || '').toLowerCase();
    if (!targetPlan) return;

    if (administrator) {
      button.href = '/app/billing';
      return;
    }

    if (!currentPlan) return;

    button.href = '/app/billing';
    if (targetPlan === currentPlan) {
      button.textContent = 'Current plan · Manage';
      document.querySelector('[data-plan-card="' + targetPlan + '"]')?.classList.add('current-plan');
    }
  });
}

async function restoreLandingSession() {
  const token = sessionToken();
  if (!token) return;

  try {
    const response = await fetch('/api/auth/me', {
      headers: { Authorization: 'Bearer ' + token }
    });
    if (!response.ok) throw new Error('Session unavailable');

    const payload = await response.json();
    const administrator = showAuthenticatedNavigation(payload.user);

    if (administrator) {
      updatePlanButtons(null, true);
      return;
    }

    try {
      const billingResponse = await fetch('/api/billing/overview', {
        headers: { Authorization: 'Bearer ' + token }
      });
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

function setupRevealAnimations() {
  const items = [...document.querySelectorAll('.reveal')];
  if (!items.length) return;

  if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    items.forEach(item => item.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    }
  }, { threshold: 0.08, rootMargin: '0px 0px -6% 0px' });

  items.forEach(item => observer.observe(item));

  setTimeout(() => {
    items.forEach(item => item.classList.add('is-visible'));
  }, 1800);
}

function setupDashboardMotion() {
  const card = document.querySelector('.product-window');
  if (!card || window.matchMedia('(prefers-reduced-motion: reduce)').matches || !window.matchMedia('(pointer:fine)').matches) return;

  card.addEventListener('pointermove', event => {
    const rect = card.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - .5;
    const y = (event.clientY - rect.top) / rect.height - .5;
    card.style.transform = `perspective(1200px) rotateY(${(-2.3 + x * 3).toFixed(2)}deg) rotateX(${(1 - y * 2).toFixed(2)}deg) translateY(-2px)`;
  });

  card.addEventListener('pointerleave', () => {
    card.style.transform = 'perspective(1200px) rotateY(-2.3deg) rotateX(1deg)';
  });
}

document.querySelectorAll('.faq-item button').forEach(button => {
  button.addEventListener('click', () => {
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
  });
});

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

landingAccount?.querySelectorAll('a, button').forEach(action => {
  action.addEventListener('click', () => { landingAccount.open = false; });
});

window.addEventListener('scroll', () => {
  header?.classList.toggle('scrolled', window.scrollY > 18);
}, { passive: true });

menu?.addEventListener('click', () => {
  const open = nav?.classList.toggle('open');
  menu.setAttribute('aria-expanded', String(Boolean(open)));
});

document.querySelectorAll('#mainNav a').forEach(link => {
  link.addEventListener('click', () => {
    nav?.classList.remove('open');
    menu?.setAttribute('aria-expanded', 'false');
  });
});

setupRevealAnimations();
setupDashboardMotion();
void restoreLandingSession();

const year = document.getElementById('year');
if (year) year.textContent = new Date().getFullYear();
