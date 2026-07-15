const token = localStorage.getItem('inxToken');
const params = new URLSearchParams(location.search);
const sessionId = params.get('session_id');
let attempts = 0;

async function check() {
  if (!token) return location.href = 'login.html';
  if (!sessionId) return fail('Checkout session ID is missing.');
  attempts += 1;
  try {
    const response = await fetch(`/api/billing/checkout/${encodeURIComponent(sessionId)}`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Unable to check subscription');
    document.querySelector('#activationBar').style.width = `${Math.min(92, attempts * 12)}%`;
    document.querySelector('#activationStatus').textContent = `Stripe payment: ${data.paymentStatus || 'processing'} · INX Social plan: ${data.subscriptionStatus || 'waiting for webhook'}`;
    if (data.activated) {
      document.querySelector('#activationBar').style.width = '100%';
      document.querySelector('#paymentTitle').textContent = `Welcome to INX Social ${data.plan}`;
      document.querySelector('#paymentMessage').textContent = 'Your subscription is active and the new licence limits are ready in the customer portal and desktop app.';
      document.querySelector('#activationStatus').textContent = data.currentPeriodEnd ? `Current billing period ends ${new Date(data.currentPeriodEnd).toLocaleDateString('en-GB')}.` : 'Subscription activated.';
      document.querySelector('#continueButton').style.display = 'inline-flex';
      return;
    }
    if (attempts < 12) return setTimeout(check, 1800);
    document.querySelector('#paymentTitle').textContent = 'Payment received — activation is still processing';
    document.querySelector('#paymentMessage').textContent = 'Open the customer portal and use Refresh. If the plan does not update, confirm the Stripe CLI/webhook listener is running.';
    document.querySelector('#continueButton').style.display = 'inline-flex';
  } catch (error) { fail(error.message); }
}

function fail(message) {
  document.querySelector('#paymentTitle').textContent = 'We could not confirm the subscription';
  document.querySelector('#paymentMessage').textContent = message;
  document.querySelector('#activationStatus').textContent = 'No plan was activated from this page.';
  document.querySelector('#continueButton').style.display = 'inline-flex';
}
check();
