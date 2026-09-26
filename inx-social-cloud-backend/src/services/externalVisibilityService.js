const axios = require('axios');
const prisma = require('../db/prisma');

const PERPLEXITY_SETTING_KEY = 'growth_intelligence_perplexity_visibility_v1';
const CLAUDE_SETTING_KEY = 'growth_intelligence_claude_visibility_v1';

const KNOWN_COMPETITORS = [
  'Buffer', 'Hootsuite', 'Later', 'Sprout Social', 'Metricool', 'SocialBee',
  'Publer', 'Vista Social', 'Planable', 'Agorapulse', 'Loomly', 'Sendible'
];

function providerStatus() {
  return {
    perplexity: {
      label: 'Perplexity Sonar',
      configured: Boolean(process.env.PERPLEXITY_API_KEY),
      model: String(process.env.PERPLEXITY_VISIBILITY_MODEL || 'sonar').trim(),
      note: 'Direct Sonar web-grounded probe. Ready when PERPLEXITY_API_KEY is configured.'
    },
    claude: {
      label: 'Claude',
      configured: Boolean(process.env.ANTHROPIC_API_KEY),
      model: String(process.env.ANTHROPIC_VISIBILITY_MODEL || 'claude-sonnet-5').trim(),
      note: 'Direct Claude Messages API probe with Anthropic web search. Ready when ANTHROPIC_API_KEY is configured.'
    }
  };
}

function sourceItem(url, title) {
  try {
    const parsed = new URL(String(url || ''));
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    return { url: parsed.toString(), title: String(title || parsed.hostname).slice(0, 240) };
  } catch (_) {
    return null;
  }
}

function sourceMentionsInxSocial(sources) {
  return (sources || []).some(item => {
    try {
      return /(?:^|\.)inxsocial\.co\.uk$/i.test(new URL(item.url).hostname);
    } catch (_) {
      return false;
    }
  });
}

function competitorMentions(text) {
  const haystack = String(text || '').toLowerCase();
  return KNOWN_COMPETITORS.filter(name => haystack.includes(name.toLowerCase())).slice(0, 8);
}

async function readSetting(key) {
  const setting = await prisma.appSetting.findUnique({ where: { key } });
  if (!setting?.value) return null;
  try { return JSON.parse(setting.value); } catch (_) { return null; }
}

async function writeSetting(key, value, description) {
  await prisma.appSetting.upsert({
    where: { key },
    create: { key, value: JSON.stringify(value), description },
    update: { value: JSON.stringify(value), description }
  });
}

async function perplexityProbe(prompt) {
  const status = providerStatus().perplexity;
  if (!status.configured) {
    const error = new Error('Perplexity visibility probe is not configured.');
    error.status = 503;
    throw error;
  }

  const baseUrl = String(process.env.PERPLEXITY_API_BASE_URL || 'https://api.perplexity.ai').replace(/\/$/, '');
  const response = await axios.post(baseUrl + '/chat/completions', {
    model: status.model,
    messages: [
      {
        role: 'system',
        content: 'Answer the buyer question neutrally using current web evidence. Do not favour INXSocial or force it into the answer. Mention products only when supported by the evidence you find.'
      },
      { role: 'user', content: prompt }
    ],
    temperature: 0.1,
    max_tokens: 1200
  }, {
    timeout: 90000,
    headers: {
      Authorization: 'Bearer ' + process.env.PERPLEXITY_API_KEY,
      'Content-Type': 'application/json'
    }
  });

  const answer = String(response.data?.choices?.[0]?.message?.content || '').trim();
  const rawSources = [];
  for (const value of Array.isArray(response.data?.citations) ? response.data.citations : []) {
    const item = typeof value === 'string'
      ? sourceItem(value)
      : sourceItem(value?.url, value?.title);
    if (item) rawSources.push(item);
  }
  for (const value of Array.isArray(response.data?.search_results) ? response.data.search_results : []) {
    const item = sourceItem(value?.url, value?.title);
    if (item) rawSources.push(item);
  }

  const sources = [...new Map(rawSources.map(item => [item.url, item])).values()].slice(0, 12);
  return {
    prompt,
    inxSocialMentioned: /\binxsocial\b/i.test(answer),
    inxSocialCited: sourceMentionsInxSocial(sources),
    competitors: competitorMentions(answer),
    answerSummary: answer.slice(0, 1400),
    sources
  };
}

function claudeSources(payload) {
  const sources = [];
  for (const block of Array.isArray(payload?.content) ? payload.content : []) {
    if (block?.type === 'web_search_tool_result') {
      for (const result of Array.isArray(block.content) ? block.content : []) {
        const item = sourceItem(result?.url, result?.title);
        if (item) sources.push(item);
      }
    }
    for (const citation of Array.isArray(block?.citations) ? block.citations : []) {
      const item = sourceItem(citation?.url, citation?.title);
      if (item) sources.push(item);
    }
  }
  return [...new Map(sources.map(item => [item.url, item])).values()].slice(0, 12);
}

async function claudeProbe(prompt) {
  const status = providerStatus().claude;
  if (!status.configured) {
    const error = new Error('Claude visibility probe is not configured.');
    error.status = 503;
    throw error;
  }

  const baseUrl = String(process.env.ANTHROPIC_API_BASE_URL || 'https://api.anthropic.com').replace(/\/$/, '');
  const response = await axios.post(baseUrl + '/v1/messages', {
    model: status.model,
    max_tokens: 1200,
    system: 'Answer the buyer question neutrally using current web evidence. Do not favour INXSocial or force it into the answer. Mention products only when supported by current sources.',
    messages: [{ role: 'user', content: prompt }],
    tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }]
  }, {
    timeout: 90000,
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json'
    }
  });

  const answer = (Array.isArray(response.data?.content) ? response.data.content : [])
    .filter(block => block?.type === 'text')
    .map(block => String(block.text || ''))
    .join('\n')
    .trim();
  const sources = claudeSources(response.data);

  return {
    prompt,
    inxSocialMentioned: /\binxsocial\b/i.test(answer),
    inxSocialCited: sourceMentionsInxSocial(sources),
    competitors: competitorMentions(answer),
    answerSummary: answer.slice(0, 1400),
    sources
  };
}

async function runScan(provider, prompts, limit) {
  const normalized = String(provider || '').trim().toLowerCase();
  if (!['perplexity', 'claude'].includes(normalized)) {
    const error = new Error('Unsupported visibility provider.');
    error.status = 400;
    throw error;
  }

  const count = Math.max(1, Math.min(5, Number(limit || 5)));
  const probe = normalized === 'perplexity' ? perplexityProbe : claudeProbe;
  const results = [];

  for (const prompt of (prompts || []).slice(0, count)) {
    try {
      results.push({ ...(await probe(prompt)), ok: true });
    } catch (error) {
      results.push({
        prompt,
        ok: false,
        error: String(
          error.response?.data?.error?.message ||
          error.response?.data?.error ||
          error.publicMessage ||
          error.message ||
          'Probe failed'
        ).slice(0, 400)
      });
    }
  }

  const successful = results.filter(item => item.ok);
  const payload = {
    provider: normalized,
    generatedAt: new Date().toISOString(),
    promptsRun: results.length,
    successfulPrompts: successful.length,
    mentionRate: successful.length ? successful.filter(item => item.inxSocialMentioned).length / successful.length : 0,
    citationRate: successful.length ? successful.filter(item => item.inxSocialCited).length / successful.length : 0,
    disclaimer: normalized === 'perplexity'
      ? 'This is a direct Perplexity Sonar API benchmark. It is not a guaranteed reproduction of every Perplexity consumer-product answer.'
      : 'This is a direct Claude API benchmark using Anthropic web search. It is not a guaranteed reproduction of every claude.ai consumer-product answer.',
    results
  };

  await writeSetting(
    normalized === 'perplexity' ? PERPLEXITY_SETTING_KEY : CLAUDE_SETTING_KEY,
    payload,
    'Latest ' + normalized + ' visibility probe results for INXSocial.'
  );
  return payload;
}

async function latest() {
  const [perplexityVisibility, claudeVisibility] = await Promise.all([
    readSetting(PERPLEXITY_SETTING_KEY),
    readSetting(CLAUDE_SETTING_KEY)
  ]);
  return { perplexityVisibility, claudeVisibility };
}

module.exports = {
  PERPLEXITY_SETTING_KEY,
  CLAUDE_SETTING_KEY,
  providerStatus,
  runScan,
  latest,
  claudeSources
};
