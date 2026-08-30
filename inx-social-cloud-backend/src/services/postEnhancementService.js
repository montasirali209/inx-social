const axios = require('axios');
const env = require('../config/env');

const instructions = {
  rewrite: 'Rewrite the caption for clarity, flow and impact while preserving every factual claim, link, mention and intended meaning.',
  shorten: 'Shorten the caption by roughly one third. Keep the important facts, links, mentions and call to action.',
  expand: 'Expand the caption with useful structure and context, but do not invent facts, offers, claims, dates or links.',
  hashtags: 'Keep the caption and add two to five focused, relevant hashtags. Avoid generic hashtag spam.',
  cta: 'Improve the caption with one natural, specific call to action. Preserve all facts, links and mentions.'
};

function publicError(message, status = 503) {
  const error = new Error(message);
  error.status = status;
  error.publicMessage = message;
  return error;
}

function cleanCaption(value) {
  return String(value || '')
    .trim()
    .replace(/^```(?:text|markdown)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim()
    .slice(0, 5000);
}

async function enhanceCaption(input, dependencies = {}) {
  const http = dependencies.http || axios;
  const config = dependencies.config || env.postEnhancement;
  if (!config?.enabled) throw publicError('AI caption enhancement is currently disabled.');
  if (!config.baseUrl || !config.apiKey || !config.model) {
    throw publicError('AI caption enhancement is not configured. Add an OpenAI API key and model in the production environment.');
  }

  const actionInstruction = instructions[input.action];
  if (!actionInstruction) throw publicError('Choose a supported caption enhancement.', 400);
  const response = await http.post(`${String(config.baseUrl).replace(/\/$/, '')}/chat/completions`, {
    model: config.model,
    messages: [
      {
        role: 'system',
        content: 'You are INX Social\'s professional social-media copy editor. Return only the finished caption. Never add commentary, markdown fences or invented facts. Preserve the original language unless asked otherwise.'
      },
      {
        role: 'user',
        content: `Tone: ${input.tone}.\nTask: ${actionInstruction}\n\nOriginal caption:\n${input.caption}`
      }
    ],
    temperature: 0.35,
    max_tokens: 1200
  }, {
    timeout: config.timeoutMs,
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json'
    }
  });

  const caption = cleanCaption(response?.data?.choices?.[0]?.message?.content);
  if (!caption) throw publicError('The AI provider returned an empty caption. Please try again.', 502);
  return { caption, action: input.action, tone: input.tone };
}

module.exports = { enhanceCaption, cleanCaption };
