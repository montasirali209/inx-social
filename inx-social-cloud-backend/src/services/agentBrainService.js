const axios = require('axios');
const env = require('../config/env');
const modelRouting = require('./aiModelRoutingService');

function status() {
  return {
    provider: 'ollama',
    configured: Boolean(env.ollama.baseUrl),
    model: env.ollama.model,
    mode: env.ollama.baseUrl ? 'OLLAMA' : 'NOT_CONFIGURED',
    paidFallback: {
      enabled: env.aiFallback.enabled,
      configured: Boolean(env.aiFallback.baseUrl && env.aiFallback.apiKey && env.aiFallback.model),
      model: env.aiFallback.model || null,
      maxCallsPerMission: env.aiFallback.maxCallsPerMission
    }
  };
}

function taskInstruction(plan, task, approvedMemories = []) {
  const memoryBlock = approvedMemories.length
    ? ['Approved reusable playbooks:', ...approvedMemories.map((item, index) => `${index + 1}. ${item.title}: ${item.content}`)]
    : ['Approved reusable playbooks: none.'];
  return [
    'You are the INX Social organic-content strategist.',
    'Return practical work only. Never invent business facts, performance results, permissions or customer testimonials.',
    'Do not create paid advertising campaigns or recommend spend unless the user explicitly asks for advice.',
    `Campaign instruction: ${plan.prompt}`,
    `Platforms: ${JSON.parse(plan.platformsJson || '[]').join(', ')}`,
    `Current task: ${task.title}`,
    `Task requirement: ${task.description}`,
    ...memoryBlock,
    'Use approved playbooks as guidance, not as facts about this business.',
    'Write a concise, production-useful result with clear headings or a compact numbered list. Do not reveal hidden chain-of-thought.'
  ].join('\n');
}

function ollamaUnavailable(error) {
  const statusCode = Number(error?.response?.status || 0);
  return !error?.response || ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN'].includes(error?.code) || statusCode === 408 || statusCode === 429 || statusCode >= 500;
}

function paidFallbackReady() {
  return env.aiFallback.enabled && Boolean(env.aiFallback.baseUrl && env.aiFallback.apiKey && env.aiFallback.model);
}

function ollamaHeaders() {
  const headers = {};
  if (env.ollama.apiKey) headers.Authorization = `Bearer ${env.ollama.apiKey}`;
  if (env.ollama.cloudflareAccessClientId) headers['CF-Access-Client-Id'] = env.ollama.cloudflareAccessClientId;
  if (env.ollama.cloudflareAccessClientSecret) headers['CF-Access-Client-Secret'] = env.ollama.cloudflareAccessClientSecret;
  return headers;
}

async function paidFallback(plan, task, http, model, approvedMemories = []) {
  const response = await http.post(`${env.aiFallback.baseUrl}/chat/completions`, {
    model,
    messages: [
      { role: 'system', content: 'You create truthful, brand-safe organic social content and operational plans.' },
      { role: 'user', content: taskInstruction(plan, task, approvedMemories) }
    ],
    temperature: 0.55
  }, { timeout: env.ollama.timeoutMs, headers: { Authorization: `Bearer ${env.aiFallback.apiKey}` } });
  const content = String(response.data?.choices?.[0]?.message?.content || '').trim();
  if (!content) throw new Error('The paid fallback returned an empty response.');
  return { provider: 'paid-fallback', model, content };
}

async function generateTaskOutput(plan, task, dependencies = {}) {
  const http = dependencies.http || axios;
  const route = dependencies.route || await modelRouting.routeForTask(task);
  const approvedMemories = dependencies.approvedMemories || [];
  const ollamaModel = route.ollamaModel || env.ollama.model;
  let ollamaError = null;
  if (env.ollama.baseUrl) {
    try {
      const response = await http.post(`${env.ollama.baseUrl}/api/chat`, {
        model: ollamaModel,
        stream: false,
        messages: [
          { role: 'system', content: 'You create truthful, brand-safe organic social content and operational plans.' },
          { role: 'user', content: taskInstruction(plan, task, approvedMemories) }
        ],
        options: { temperature: 0.55 }
      }, { timeout: env.ollama.timeoutMs, headers: ollamaHeaders() });
      const content = String(response.data?.message?.content || '').trim();
      if (!content) throw new Error('Ollama returned an empty response.');
      return { provider: 'ollama', model: ollamaModel, content };
    } catch (error) {
      ollamaError = error;
      if (!ollamaUnavailable(error)) throw error;
    }
  } else {
    ollamaError = Object.assign(new Error('Ollama is not configured. Set OLLAMA_BASE_URL and OLLAMA_MODEL to start the Social Agent brain.'), { code: 'OLLAMA_NOT_CONFIGURED' });
  }
  if (dependencies.allowPaidFallback && route.fallbackEnabled && paidFallbackReady()) return paidFallback(plan, task, http, route.fallbackModel || env.aiFallback.model, approvedMemories);
  throw ollamaError;
}

module.exports = { status, generateTaskOutput, taskInstruction, ollamaUnavailable, paidFallbackReady, ollamaHeaders };
