const axios = require('axios');
const prisma = require('../db/prisma');
const { decryptToken, encryptToken } = require('../utils/tokenCrypto');

const REFRESH_EARLY_MS = 5 * 60 * 1000;

function reconnectError(message = 'Reconnect YouTube to restore analytics access.') {
  return Object.assign(new Error(message), {
    status: 409,
    publicMessage: message,
    code: 'YOUTUBE_RECONNECT_REQUIRED'
  });
}

async function refreshConnection(connection) {
  if (!connection?.encryptedRefreshToken) throw reconnectError();
  const clientId = String(process.env.GOOGLE_CLIENT_ID || '').trim();
  const clientSecret = String(process.env.GOOGLE_CLIENT_SECRET || '').trim();
  if (!clientId || !clientSecret) throw reconnectError('YouTube analytics authentication is not configured on the server.');

  const refreshToken = decryptToken(connection.encryptedRefreshToken);
  try {
    const response = await axios.post('https://oauth2.googleapis.com/token', new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    }).toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 20000
    });
    const token = response.data || {};
    if (!token.access_token) throw new Error('Google did not return an access token.');
    const expiresIn = Math.max(60, Number(token.expires_in || 3600));
    const update = {
      encryptedAccessToken: encryptToken(token.access_token),
      tokenExpiresAt: new Date(Date.now() + expiresIn * 1000),
      lastSyncedAt: new Date(),
      lastError: null
    };
    if (token.refresh_token) update.encryptedRefreshToken = encryptToken(token.refresh_token);
    await prisma.socialConnection.update({ where: { id: connection.id }, data: update });
    return token.access_token;
  } catch (error) {
    const providerMessage = error.response?.data?.error_description || error.response?.data?.error || error.message;
    await prisma.socialConnection.update({
      where: { id: connection.id },
      data: { lastError: `YouTube authentication needs attention: ${providerMessage}` }
    }).catch(() => {});
    throw reconnectError();
  }
}

async function ensureFreshYouTubeToken(userId, profileId) {
  const profile = await prisma.socialProfile.findFirst({
    where: { id: profileId, userId, platform: 'youtube', status: 'ACTIVE' },
    include: { connection: true }
  });
  const connection = profile?.connection;
  if (!profile || !connection || connection.status !== 'ACTIVE') throw reconnectError('The selected YouTube channel is no longer connected.');
  if (!connection.encryptedAccessToken) throw reconnectError();

  const expiresAt = connection.tokenExpiresAt ? new Date(connection.tokenExpiresAt).getTime() : 0;
  if (!expiresAt || expiresAt <= Date.now() + REFRESH_EARLY_MS) return refreshConnection(connection);
  return decryptToken(connection.encryptedAccessToken);
}

async function forceRefreshYouTubeToken(userId, profileId) {
  const profile = await prisma.socialProfile.findFirst({
    where: { id: profileId, userId, platform: 'youtube', status: 'ACTIVE' },
    include: { connection: true }
  });
  if (!profile?.connection || profile.connection.status !== 'ACTIVE') throw reconnectError('The selected YouTube channel is no longer connected.');
  return refreshConnection(profile.connection);
}

module.exports = { ensureFreshYouTubeToken, forceRefreshYouTubeToken };
