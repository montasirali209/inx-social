
const header = document.getElementById('siteHeader');
const menu = document.getElementById('menuButton');
const nav = document.getElementById('mainNav');
const landingAccount = document.getElementById('landingAccount');
const landingAccountName = document.getElementById('landingAccountName');
const landingAccountInitials = document.getElementById('landingAccountInitials');
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

async function restoreLandingSession() {
  const token = sessionToken();
  if (!token) return;
  try {
    const response = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error('Session unavailable');
    const { user } = await response.json();
    const displayName = user?.name || user?.businessName || user?.email || 'INXSocial account';
    if (landingAccountName) landingAccountName.textContent = displayName;
    if (landingAccountInitials) landingAccountInitials.textContent = initials(displayName);
    if (landingAccount) landingAccount.hidden = false;
    if (landingSignIn) landingSignIn.hidden = true;
    document.querySelectorAll('.guest-only').forEach(element => { element.hidden = true; });
    document.querySelectorAll('.app-entry').forEach(element => {
      element.href = '/app/';
      if (element !== landingSignIn) element.textContent = 'Open INXSocial';
    });
  } catch {
    clearLandingSession();
  }
}

landingSignOut?.addEventListener('click', () => {
  clearLandingSession();
  location.reload();
});

void restoreLandingSession();

window.addEventListener('scroll', () => {
  header?.classList.toggle('scrolled', window.scrollY > 18);
}, { passive: true });

menu?.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  menu.setAttribute('aria-expanded', String(open));
});

document.querySelectorAll('#mainNav a').forEach(link => {
  link.addEventListener('click', () => {
    nav.classList.remove('open');
    menu?.setAttribute('aria-expanded', 'false');
  });
});

document.querySelectorAll('.faq-item button').forEach(button => {
  button.addEventListener('click', () => {
    const item = button.closest('.faq-item');
    const wasOpen = item.classList.contains('open');
    document.querySelectorAll('.faq-item.open').forEach(openItem => openItem.classList.remove('open'));
    if (!wasOpen) item.classList.add('open');
  });
});

// Safe reveal animation: visible by default, and only briefly prepared when JS is active.
const animated = [...document.querySelectorAll('[data-animate]')];
if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  animated.forEach(el => el.classList.add('will-animate'));
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        entry.target.classList.remove('will-animate');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -4% 0px' });
  animated.forEach(el => observer.observe(el));
  // Failsafe: never leave content hidden.
  setTimeout(() => animated.forEach(el => {
    el.classList.add('is-visible');
    el.classList.remove('will-animate');
  }), 1400);
}

const year = document.getElementById('year');
if (year) year.textContent = new Date().getFullYear();
