const axios = require('axios');
const env = require('../config/env');

function status() {
  return { enabled: env.webResearch.enabled, configured: Boolean(env.webResearch.enabled && env.webResearch.apiKey) };
}

function extractResponse(data) {
  const messages = (data?.output || []).filter(item => item.type === 'message');
  const parts = messages.flatMap(item => Array.isArray(item.content) ? item.content : []);
  const content = parts.map(item => item.text || '').filter(Boolean).join('\n').trim();
  const seen = new Set();
  const sources = [];
  for (const part of parts) {
    for (const annotation of part.annotations || []) {
      const citation = annotation.url_citation || annotation;
      const url = String(citation.url || '').trim();
      if (!/^https?:\/\//i.test(url) || seen.has(url)) continue;
      seen.add(url);
      sources.push({ title: String(citation.title || 'Research source').slice(0, 200), url });
      if (sources.length >= env.webResearch.maxSources) break;
    }
  }
  return { content, summary: content.slice(0, 600), sources };
}

async function researchMission(plan, dependencies = {}) {
  if (!status().configured) throw Object.assign(new Error('Mission research is not configured.'), { code: 'WEB_RESEARCH_NOT_CONFIGURED' });
  const http = dependencies.http || axios;
  const response = await http.post(`${env.webResearch.baseUrl}/responses`, {
    model: env.webResearch.model,
    tools: [{ type: 'web_search' }],
    tool_choice: 'auto',
    input: [
      { role: 'system', content: [{ type: 'input_text', text: 'Research current public information for an organic social mission. Use trustworthy sources. Never invent facts, private data, performance results or customer claims. Return concise findings, engagement opportunities, useful search phrases, and cautions.' }] },
      { role: 'user', content: [{ type: 'input_text', text: `Mission: ${plan.prompt}\nPlatforms: ${JSON.parse(plan.platformsJson || '[]').join(', ')}\nFocus on current audience needs, competitors or alternatives, social SEO language, hashtags only when genuinely relevant, and factual claims that can be sourced.` }] }
    ]
  }, { timeout: env.webResearch.timeoutMs, headers: { Authorization: `Bearer ${env.webResearch.apiKey}`, 'Content-Type': 'application/json' } });
  const result = extractResponse(response.data);
  if (!result.content) throw new Error('Mission research returned no usable findings.');
  return result;
}

module.exports = { status, extractResponse, researchMission };
