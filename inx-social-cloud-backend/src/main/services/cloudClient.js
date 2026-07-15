const axios = require('axios');
const os = require('os');
const crypto = require('crypto');

class CloudClient {
  constructor(baseUrl, token = '') {
    this.baseUrl = String(baseUrl || 'http://localhost:5050').replace(/\/+$/, '');
    this.token = token || '';
    this.http = axios.create({ baseURL: this.baseUrl, timeout: 15000 });
  }

  headers() {
    return this.token ? { Authorization: `Bearer ${this.token}` } : {};
  }

  async register(payload) {
    return (await this.http.post('/api/auth/register', payload)).data;
  }

  async verifyEmail(payload) { return (await this.http.post('/api/auth/verify-email', payload)).data; }

  async resendVerification(payload) { return (await this.http.post('/api/auth/resend-verification', payload)).data; }

  async login(payload) {
    return (await this.http.post('/api/auth/login', payload)).data;
  }

  async me() {
    return (await this.http.get('/api/auth/me', { headers: this.headers() })).data;
  }

  async licenseStatus() {
    return (await this.http.get('/api/license/status', { headers: this.headers() })).data;
  }

  async activateDevice(payload) {
    return (await this.http.post('/api/license/device/activate', payload, { headers: this.headers() })).data;
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
  return (data && (data.error || data.message)) || error.message || 'Cloud connection failed';
}

module.exports = { CloudClient, buildDeviceIdentity, cloudErrorMessage };
