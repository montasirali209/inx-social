(() => {
  const hash = new URLSearchParams(location.hash.slice(1));
  const query = new URLSearchParams(location.search);
  const message = {
    type: 'inx-facebook-token',
    accessToken: hash.get('access_token') || '',
    state: hash.get('state') || query.get('state') || '',
    error: hash.get('error_description') || query.get('error_description') || ''
  };
  if (!message.accessToken && !message.error) message.error = 'Facebook did not return an access token.';
  if (window.opener) {
    window.opener.postMessage(message, location.origin);
    document.querySelector('h1').textContent = message.error ? 'Facebook connection failed' : 'Facebook connected';
    document.querySelector('p').textContent = message.error || 'Return to INX Social. This window will close.';
    if (!message.error) setTimeout(() => window.close(), 800);
  } else {
    document.querySelector('h1').textContent = 'Return to INX Social';
    document.querySelector('p').textContent = 'This connection window must be opened from Cloud Studio.';
  }
})();
