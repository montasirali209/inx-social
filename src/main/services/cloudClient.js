const axios = require('axios');
const os = require('os');
const crypto = require('crypto');

const DEFAULT_API_URL = 'https://api.social.inaxx.co.uk';

class CloudClient {
  constructor(baseUrl, token = '') {
    this.baseUrl = String(baseUrl || DEFAULT_API_URL).replace(/\/+$/, '');
    this.token = token || '';
    this.http = axios.create({ baseURL: this.baseUrl, timeout: 30000 });
  }

  headers() {
    return this.token ? { Authorization: `Bearer ${this.token}` } : {};
  }

  async register(payload) { return (await this.http.post('/api/auth/register', payload)).data; }
  async login(payload) { return (await this.http.post('/api/auth/login', payload)).data; }
  async me() { return (await this.http.get('/api/auth/me', { headers: this.headers() })).data; }
  async licenseStatus() { return (await this.http.get('/api/license/status', { headers: this.headers() })).data; }
  async activateDevice(payload) { return (await this.http.post('/api/license/device/activate', payload, { headers: this.headers() })).data; }

  async listMetaAccounts() {
    try {
      return (await this.http.get('/api/pages/accounts', { headers: this.headers() })).data;
    } catch (error) {
      if (error?.response?.status !== 404) throw error;
      return { accounts: [], legacyMode: true };
    }
  }

  async listPages() {
    return (await this.http.get('/api/pages', { headers: this.headers() })).data;
  }

  async getWorkspace() {
    return (await this.http.get('/api/pages/workspace', { headers: this.headers() })).data;
  }

  async discoverMetaAccount(accessToken) {
    return (await this.http.post('/api/pages/accounts/discover', { accessToken }, { headers: this.headers() })).data;
  }

  async connectMetaAccount(payload) {
    try {
      return (await this.http.post('/api/pages/accounts/connect', payload, { headers: this.headers() })).data;
    } catch (error) {
      if (error?.response?.status !== 404 || !payload?.facebookPageId) throw error;
      return (await this.http.post('/api/pages/connect', payload, { headers: this.headers() })).data;
    }
  }

  async connectPage(payload) {
    return (await this.http.post('/api/pages/connect', payload, { headers: this.headers() })).data;
  }

  async syncMetaAccount(accountId, payload = {}) {
    return (await this.http.post(`/api/pages/accounts/${accountId}/sync`, payload, { headers: this.headers() })).data;
  }

  async disconnectMetaAccount(accountId) {
    return (await this.http.delete(`/api/pages/accounts/${accountId}`, { headers: this.headers() })).data;
  }

  async selectPage(pageId) {
    try {
      return (await this.http.post(`/api/pages/${pageId}/select`, {}, { headers: this.headers() })).data;
    } catch (error) {
      if (error?.response?.status !== 404) throw error;
      return { success: true, legacyMode: true };
    }
  }

  async revokePage(pageId) {
    try {
      return (await this.http.delete(`/api/pages/${pageId}`, { headers: this.headers() })).data;
    } catch (error) {
      if (error?.response?.status !== 404) throw error;
      return (await this.http.post(`/api/pages/${pageId}/revoke`, {}, { headers: this.headers() })).data;
    }
  }
}

function buildDeviceIdentity() {
  const raw = [os.hostname(), os.platform(), os.arch(), os.userInfo().username].join('|');
  return {
    deviceId: crypto.createHash('sha256').update(raw).digest('hex'),
    deviceName: `${os.hostname()} (${os.platform()} ${os.arch()})`
  };
}

function cloudErrorMessage(error) {
  const data = error && error.response && error.response.data;
  const status = error && error.response && error.response.status;
  const serverMessage = data && (data.error || data.message || data.detail);
  if (serverMessage) return status ? `${serverMessage} (HTTP ${status})` : serverMessage;
  if (error && error.code === 'ECONNABORTED') return 'The INX Social cloud request timed out. Check the API service and try again.';
  if (error && error.code === 'ECONNREFUSED') return 'The INX Social cloud API is not running or cannot be reached.';
  if (error && error.message === 'Network Error') return 'The INX Social cloud API could not be reached. Check your internet connection and API address.';
  return error.message || 'Cloud connection failed';
}

module.exports = { CloudClient, buildDeviceIdentity, cloudErrorMessage, DEFAULT_API_URL };
