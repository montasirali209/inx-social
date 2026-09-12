const axios = require('axios');

// GPT-5.6 Luna/Terra currently accept only the model-default temperature.
// Keep the compatibility guard at the service boundary so source analysis and
// conversational routing cannot fail when callers supply tuning values.
axios.interceptors.request.use((config) => {
  const url = String(config?.url || '');
  const data = config?.data;
  if (!/\/chat\/completions(?:\?|$)/i.test(url) || !data || typeof data !== 'object' || Array.isArray(data)) return config;
  const model = String(data.model || '');
  if (/^gpt-5\.6-(?:luna|terra)(?:$|[-:])/i.test(model) && Object.prototype.hasOwnProperty.call(data, 'temperature')) {
    const nextData = { ...data };
    delete nextData.temperature;
    config.data = nextData;
  }
  return config;
});

const studio = require('./aiPostStudioServiceV2');
const references = require('./aiStudioReferenceService');

module.exports = { ...studio, saveReference: references.saveReference };
