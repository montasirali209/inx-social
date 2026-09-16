const header = document.getElementById('siteHeader');
const menu = document.getElementById('menuButton');
const nav = document.getElementById('mainNav');
const landingAccount = document.getElementById('landingAccount');
const landingAccountName = document.getElementById('landingAccountName');
const landingAccountInitials = document.getElementById('landingAccountInitials');
const landingAccountRole = document.getElementById('landingAccountRole');
const landingSignIn = document.getElementById('landingSignIn');
const landingSignOut = document.getElementById('landingSignOut');

function renderWorkspaceFeatureRail() {
  const currentRail = document.querySelector('.platform-rail');
  if (!currentRail || document.querySelector('.workspace-rail-wrap')) return;
  const wrapper = document.createElement('div');
  wrapper.className = 'shell workspace-rail-wrap';
  wrapper.setAttribute('data-animate', '');
  wrapper.setAttribute('aria-label', 'INXSocial all-in-one social media management workspace');
  wrapper.innerHTML = `
    <div class="workspace-rail">
      <div class="workspace-rail-intro">
        <img src="/assets/inx-social-logo.png" alt="INXSocial">
        <span><strong>All-in-one<em>workspace</em></strong><small>Plan. Create. Publish. Grow.</small></span>
      </div>
      <a class="workspace-feature connect" href="/social-media-scheduler.html" aria-label="Connect and manage social accounts">
        <div class="workspace-feature-head"><div class="workspace-platforms" aria-label="Facebook, Instagram, LinkedIn and YouTube">
          <span class="workspace-platform facebook" title="Facebook"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.7 22v-8.1h2.72l.41-3.16H13.7V8.72c0-.91.25-1.54 1.57-1.54h1.68V4.36c-.29-.04-1.29-.13-2.45-.13-2.42 0-4.08 1.48-4.08 4.2v2.31H7.68v3.16h2.74V22h3.28Z" fill="currentColor"/></svg></span>
          <span class="workspace-platform instagram" title="Instagram"><svg fill="none" viewBox="0 0 24 24" aria-hidden="true"><rect height="15.5" rx="4.5" stroke="currentColor" stroke-width="2.1" width="15.5" x="4.25" y="4.25"/><circle cx="12" cy="12" r="3.65" stroke="currentColor" stroke-width="2.1"/><circle cx="17.45" cy="6.75" fill="currentColor" r="1.05"/></svg></span>
          <span class="workspace-platform linkedin" title="LinkedIn"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.4 8.1H3.2V20h3.2V8.1ZM4.8 3A1.85 1.85 0 1 0 4.8 6.7 1.85 1.85 0 0 0 4.8 3Zm8.05 5.1H9.78V20h3.2v-5.88c0-1.55.3-3.05 2.22-3.05 1.9 0 1.92 1.78 1.92 3.15V20h3.2v-6.51c0-3.2-.69-5.67-4.43-5.67-1.8 0-3 .99-3.49 1.92h-.04V8.1Z" fill="currentColor"/></svg></span>
          <span class="workspace-platform youtube" title="YouTube"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21.2 7.2a2.72 2.72 0 0 0-1.92-1.93C17.59 4.8 12 4.8 12 4.8s-5.59 0-7.28.47A2.72 2.72 0 0 0 2.8 7.2 28.4 28.4 0 0 0 2.33 12c0 1.62.15 3.22.47 4.8a2.72 2.72 0 0 0 1.92 1.93c1.69.47 7.28.47 7.28.47s5.59 0 7.28-.47a2.72 2.72 0 0 0 1.92-1.93c.32-1.58.47-3.18.47-4.8s-.15-3.22-.47-4.8Z" fill="white"/><path d="M10.06 15.08V8.92L15.4 12l-5.34 3.08Z" fill="#ff0000"/></svg></span>
        </div></div>
        <strong>Connect Accounts</strong><small>Facebook, Instagram, LinkedIn &amp; YouTube</small><span class="workspace-feature-arrow">→</span>
      </a>
      <a class="workspace-feature schedule" href="/social-media-scheduler.html">
        <div class="workspace-feature-head"><span class="workspace-feature-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18M8 15h8M12 12v6"/></svg></span></div>
        <strong>Schedule &amp; Publish</strong><small>Plan posts and publish at the right time.</small><span class="workspace-feature-arrow">→</span>
      </a>
      <a class="workspace-feature bulk" href="/bulk-social-media-scheduler.html">
        <div class="workspace-feature-head"><span class="workspace-feature-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 8 4-8 4-8-4 8-4Z"/><path d="m4 12 8 4 8-4M4 17l8 4 8-4"/></svg></span></div>
        <strong>Bulk Scheduler</strong><small>Upload, queue and schedule campaigns at scale.</small><span class="workspace-feature-arrow">→</span>
      </a>
      <a class="workspace-feature ai" href="/ai-social-media-tools.html">
        <div class="workspace-feature-head"><span class="workspace-feature-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 4 5 5L9 20H4v-5L15 4Z"/><path d="m13 6 5 5M5 4v3M3.5 5.5h3M19 15v4M17 17h4"/></svg></span></div>
        <strong>AI Content Studio</strong><small>Create images, carousels, UGC &amp; video.</small><span class="workspace-feature-arrow">→</span>
      </a>
      <a class="workspace-feature calendar" href="/social-media-content-calendar.html">
        <div class="workspace-feature-head"><span class="workspace-feature-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18M7 14h3M14 14h3M7 18h3"/></svg></span></div>
        <strong>Content Calendar</strong><small>See drafts, scheduled and published content.</small><span class="workspace-feature-arrow">→</span>
      </a>
      <a class="workspace-feature analytics" href="/social-media-analytics.html">
        <div class="workspace-feature-head"><span class="workspace-feature-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 20V10M12 20V4M19 20v-7"/></svg></span></div>
        <strong>Analytics</strong><small>Track performance and learn what works.</small><span class="workspace-feature-arrow">→</span>
      </a>
      <div class="workspace-feature clipping" aria-label="AI Video Clipping coming soon">
        <div class="workspace-feature-head"><span class="workspace-feature-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m10 9 5 3-5 3V9Z"/></svg></span><span class="workspace-soon">Soon</span></div>
        <strong>Video Clipping</strong><small>Turn longer videos into reusable social clips.</small>
      </div>
    </div>`;
  currentRail.replaceWith(wrapper);
}
renderWorkspaceFeatureRail();

const sessionToken = () => localStorage.getItem('inxToken') || localStorage.getItem('inx-social-cloud-token');
function clearLandingSession() { localStorage.removeItem('inxToken'); localStorage.removeItem('inx-social-cloud-token'); }
function initials(value) { return String(value || 'IN').trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'IN'; }

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
    if (administrator) button.textContent = 'Open Billing & Plans';
    else if (targetPlan === currentPlan) {
      button.textContent = 'Current plan · Manage';
      document.querySelector('[data-plan-card="' + targetPlan + '"]')?.classList.add('current-plan');
    } else if (currentPlan === 'trial' && (targetPlan === 'pro' || targetPlan === 'plus')) button.textContent = 'Upgrade to ' + (targetPlan === 'pro' ? 'Pro' : 'Plus');
    else if (currentPlan === 'pro' && targetPlan === 'plus') button.textContent = 'Upgrade to Plus';
    else button.textContent = 'Review plan';
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
    } catch { updatePlanButtons(null, false); }
  } catch { clearLandingSession(); }
}

landingSignOut?.addEventListener('click', () => { clearLandingSession(); location.reload(); });
document.addEventListener('pointerdown', event => {
  if (landingAccount?.open && !landingAccount.contains(event.target)) landingAccount.open = false;
  if (nav?.classList.contains('open') && !nav.contains(event.target) && !menu?.contains(event.target)) {
    nav.classList.remove('open'); menu?.setAttribute('aria-expanded', 'false');
  }
});
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  if (landingAccount?.open) { landingAccount.open = false; landingAccount.querySelector('summary')?.focus(); }
  if (nav?.classList.contains('open')) { nav.classList.remove('open'); menu?.setAttribute('aria-expanded', 'false'); menu?.focus(); }
});
landingAccount?.querySelectorAll('a, button').forEach(action => action.addEventListener('click', () => { landingAccount.open = false; }));
void restoreLandingSession();
window.addEventListener('scroll', () => header?.classList.toggle('scrolled', window.scrollY > 18), { passive: true });
menu?.addEventListener('click', () => { const open = nav?.classList.toggle('open'); menu.setAttribute('aria-expanded', String(Boolean(open))); });
document.querySelectorAll('#mainNav a').forEach(link => link.addEventListener('click', () => { nav?.classList.remove('open'); menu?.setAttribute('aria-expanded', 'false'); }));
document.querySelectorAll('.faq-item button').forEach(button => button.addEventListener('click', () => {
  const item = button.closest('.faq-item'); const wasOpen = item?.classList.contains('open');
  document.querySelectorAll('.faq-item.open').forEach(openItem => { openItem.classList.remove('open'); openItem.querySelector('button')?.setAttribute('aria-expanded', 'false'); });
  if (!wasOpen) { item?.classList.add('open'); button.setAttribute('aria-expanded', 'true'); }
}));
const animated = [...document.querySelectorAll('[data-animate]')];
if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  animated.forEach(element => element.classList.add('will-animate'));
  const observer = new IntersectionObserver(entries => entries.forEach(entry => {
    if (entry.isIntersecting) { entry.target.classList.add('is-visible'); entry.target.classList.remove('will-animate'); observer.unobserve(entry.target); }
  }), { threshold: 0.08, rootMargin: '0px 0px -4% 0px' });
  animated.forEach(element => observer.observe(element));
  setTimeout(() => animated.forEach(element => { element.classList.add('is-visible'); element.classList.remove('will-animate'); }), 1400);
}
const year = document.getElementById('year'); if (year) year.textContent = new Date().getFullYear();