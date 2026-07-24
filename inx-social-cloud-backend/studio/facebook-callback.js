(() => {
  const hash = new URLSearchParams(location.hash.slice(1));
  const query = new URLSearchParams(location.search);
  const message = {
    type: 'inx-facebook-token',
    accessToken: hash.get('access_token') || '',
    state: hash.get('state') || query.get('state') || '',
    error: hash.get('error_description')
      || query.get('error_description')
      || query.get('error_message')
      || query.get('error')
      || ''
  };
  if (!message.accessToken && !message.error) {
    message.error = 'Facebook did not return an access token.';
  }

  if (message.state) {
    try {
      localStorage.setItem(
        `inx-facebook-oauth-result:${message.state}`,
        JSON.stringify(message)
      );
    } catch (_) {}
  }

  if (window.opener) {
    try { window.opener.postMessage(message, location.origin); } catch (_) {}
  }

  const title = document.querySelector('h1');
  const detail = document.querySelector('p');
  title.textContent = message.error ? 'Facebook connection failed' : 'Facebook connected';
  detail.textContent = message.error || 'Return to INX Social. This window will close.';
  setTimeout(() => {
    try { window.close(); } catch (_) {}
  }, message.error ? 1800 : 800);
})();
