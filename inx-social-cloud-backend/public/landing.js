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
  if (landingAccountRole) landingAccountRole.textContent = administrator ? 'Admin logged in' : 'Account logged in';
  if (landingAccount) landingAccount.hidden = false;
  if (landingSignIn) landingSignIn.hidden = true;

  document.body.classList.add('session-authenticated');
  document.body.classList.toggle('admin-session', administrator);
  document.querySelectorAll('.guest-only').forEach(element => { element.hidden = true; });
  document.querySelectorAll('.member-only').forEach(element => { element.hidden = false; });
  document.querySelectorAll('a.app-entry').forEach(element => {
    const href = element.getAttribute('href') || '';
    if (href.startsWith('/portal/')) {
      element.href = '/app/';
      element.innerHTML = element.closest('.faq-intro') ? 'Open your workspace <span>→</span>' : 'Open INXSocial';
    }
  });

  const memberCopy = document.querySelector('.member-pricing-copy');
  const guestCopy = document.querySelector('.guest-pricing-copy');
  if (guestCopy) guestCopy.hidden = true;
  if (memberCopy) {
    memberCopy.hidden = false;
    if (administrator) memberCopy.textContent = 'Administrator session detected. Billing remains separate from administrator access, so your account is not labelled as a Plus subscription.';
  }

  document.querySelectorAll('.authenticated-billing-link').forEach(link => {
    link.href = '/app/billing';
    link.innerHTML = 'View Billing &amp; Plans <span>→</span>';
  });

  return administrator;
}

function updatePlanButtons(currentPlan, administrator) {
  document.querySelectorAll('[data-plan-card]').forEach(card => card.classList.remove('current-plan'));
  document.querySelectorAll('.member-only.plan-action').forEach(button => {
    const targetPlan = button.dataset.plan;
    button.href = '/app/billing';
    if (administrator) {
      button.textContent = 'Open Billing & Plans';
      return;
    }
    if (targetPlan === currentPlan) {
      button.textContent = 'Current plan · Manage';
      document.querySelector('[data-plan-card="' + targetPlan + '"]')?.classList.add('current-plan');
    } else if (currentPlan === 'trial' && (targetPlan === 'pro' || targetPlan === 'plus')) {
      button.textContent = 'Upgrade to ' + (targetPlan === 'pro' ? 'Pro' : 'Plus');
    } else if (currentPlan === 'pro' && targetPlan === 'plus') {
      button.textContent = 'Upgrade to Plus';
    } else if (currentPlan === 'plus' && targetPlan === 'pro') {
      button.textContent = 'Review Pro';
    } else {
      button.textContent = 'Review plan';
    }
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
    if (administrator) {
      updatePlanButtons(null, true);
      return;
    }

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
  if (event.key === 'Escape') {
    if (landingAccount?.open) {
      landingAccount.open = false;
      landingAccount.querySelector('summary')?.focus();
    }
    if (nav?.classList.contains('open')) {
      nav.classList.remove('open');
      menu?.setAttribute('aria-expanded', 'false');
      menu?.focus();
    }
  }
});

landingAccount?.querySelectorAll('a, button').forEach(action => {
  action.addEventListener('click', () => { landingAccount.open = false; });
});

void restoreLandingSession();

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

const animated = [...document.querySelectorAll('[data-animate]')];
if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  animated.forEach(element => element.classList.add('will-animate'));
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        entry.target.classList.remove('will-animate');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -4% 0px' });
  animated.forEach(element => observer.observe(element));
  setTimeout(() => animated.forEach(element => {
    element.classList.add('is-visible');
    element.classList.remove('will-animate');
  }), 1400);
}

const year = document.getElementById('year');
if (year) year.textContent = new Date().getFullYear();
