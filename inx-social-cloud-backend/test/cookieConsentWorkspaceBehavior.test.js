const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');

test('cookie settings is available in the footer without floating over the site', () => {
  const consent = fs.readFileSync(path.join(root, 'public/analytics-consent.js'), 'utf8');
  const settings = fs.readFileSync(path.join(root, 'frontend/src/components/settings/SettingsPage.tsx'), 'utf8');
  const landing = fs.readFileSync(path.join(root, '../landing-next/public/landing-body.html'), 'utf8');
  const privacy = fs.readFileSync(path.join(root, 'public/privacy.html'), 'utf8');

  assert.doesNotMatch(consent, /inxsocial-cookie-settings/);
  assert.match(consent, /location\.hash === '#cookie-settings'/);
  assert.match(landing, /href="\/privacy\.html#cookie-settings"/);
  assert.match(privacy, /href="#cookie-settings"/);
  assert.match(settings, /Cookie preferences/);
  assert.match(settings, /inxCookieSettings/);
});

test('cookie consent banner remains phone-safe and accessible before a choice', () => {
  const consent = fs.readFileSync(path.join(root, 'public/analytics-consent.js'), 'utf8');
  assert.match(consent, /max-height:calc\(100dvh - 20px\)/);
  assert.match(consent, /env\(safe-area-inset-bottom\)/);
  assert.match(consent, /aria-label', 'Analytics cookie choice'/);
});

test('accepting or rejecting analytics hides the prompt on later visits', () => {
  const source = fs.readFileSync(path.join(root, 'public/analytics-consent.js'), 'utf8');

  for (const value of ['accepted', 'rejected']) {
    const storage = new Map();
    let cookie = '';
    function visit() {
      const elements = new Map();
      const events = new Map();
      const document = {
        readyState: 'complete', title: 'INXSocial',
        get cookie() { return cookie; }, set cookie(value) { cookie = value; },
        getElementById: id => elements.get(id) || null,
        querySelector: () => null,
        createElement: () => {
          const element = {
            dataset: {}, setAttribute() {},
            remove() { elements.delete(this.id); },
            querySelectorAll() {
              if (!this.buttons) this.buttons = ['rejected', 'accepted'].map(choice => ({
                dataset: { consent: choice },
                addEventListener(type, callback) { this.click = callback; }
              }));
              return this.buttons;
            }
          };
          return element;
        },
        head: { appendChild(element) { if (element.id) elements.set(element.id, element); } },
        body: { appendChild(element) { if (element.id) elements.set(element.id, element); } }
      };
      const location = { pathname: '/', search: '', hash: '', href: 'https://www.inxsocial.co.uk/' };
      const history = { state: null, pushState() {}, replaceState() {} };
      vm.runInNewContext(source, {
        document, location, history, Date, URLSearchParams, queueMicrotask,
        localStorage: { getItem: key => storage.get(key) || null, setItem: (key, choice) => storage.set(key, choice) },
        window: {}, addEventListener: (name, callback) => events.set(name, callback)
      });
      return { elements, events };
    }

    const first = visit();
    const banner = first.elements.get('inxsocial-analytics-consent');
    assert.ok(banner, 'first visit needs a consent choice');
    const buttons = banner.querySelectorAll('[data-consent]');
    buttons.find(button => button.dataset.consent === value).click();
    assert.equal(first.elements.has('inxsocial-analytics-consent'), false);
    assert.equal(first.elements.has('inxsocial-cookie-settings'), false);
    assert.equal(storage.get('inxsocial_analytics_consent_v1'), value);

    const later = visit();
    assert.equal(later.elements.has('inxsocial-analytics-consent'), false, `${value} should persist`);
    assert.equal(later.elements.has('inxsocial-cookie-settings'), false);
    storage.clear();
    assert.equal(visit().elements.has('inxsocial-analytics-consent'), false, `${value} should survive unavailable local storage`);
  }
});
