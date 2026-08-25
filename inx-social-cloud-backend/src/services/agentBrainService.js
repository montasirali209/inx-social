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
  let strategy = {};
  try { strategy = JSON.parse(plan.strategyJson || '{}'); } catch (_) {}
  const targetNames = (Array.isArray(strategy.pageTargets) ? strategy.pageTargets : []).map(page => String(page.name || '').trim()).filter(Boolean);
  const referenceNames = (Array.isArray(strategy.referenceAssets) ? strategy.referenceAssets : []).map(asset => `${asset.kind}: ${asset.originalName || 'uploaded image'}`);
  const memoryBlock = approvedMemories.length
    ? ['Approved reusable playbooks:', ...approvedMemories.map((item, index) => `${index + 1}. ${item.title}: ${item.content}`)]
    : ['Approved reusable playbooks: none.'];
  const researchTask = (plan.tasks || []).find(item => item.type === 'WEB_RESEARCH' && item.status === 'COMPLETED');
  let research = null;
  try { research = JSON.parse(researchTask?.outputJson || 'null'); } catch (_) {}
  const researchBlock = research?.content
    ? ['Current mission research:', research.content, ...(research.sources || []).map(source => `Source: ${source.title} — ${source.url}`)]
    : ['Current mission research: unavailable. Do not imply that live web research was completed.'];
  const structuredRequirement = task.type === 'COPY_GENERATION' ? [
    `Return JSON only with a top-level "posts" array containing exactly ${Math.max(1, Math.min(100, Number(strategy.assetCount || 1)))} distinct posts.`,
    'Every post must contain: title, caption, altText, hashtags (array of short strings without #), visualBrief, and objective.',
    'Make each hook, angle and visual brief meaningfully different. Captions must be ready to publish and may include a concise call to action.',
    'Do not wrap the JSON in Markdown fences.'
  ] : task.type === 'SCHEDULE' ? [
    'Explain the recommended posting windows in the Page audience timezone. Separate evidence-backed findings from general best-practice assumptions.'
  ] : [];
  return [
    'You are the INX Social organic-content strategist.',
    'Return practical work only. Never invent business facts, performance results, permissions or customer testimonials.',
    'Do not create paid advertising campaigns or recommend spend unless the user explicitly asks for advice.',
    `Campaign instruction: ${plan.prompt}`,
    `Platforms: ${JSON.parse(plan.platformsJson || '[]').join(', ')}`,
    `Connected Facebook Page targets: ${targetNames.length ? targetNames.join(', ') : 'none selected'}`,
    `Supplied brand/reference images: ${referenceNames.length ? referenceNames.join(', ') : 'none supplied'}`,
    `Current task: ${task.title}`,
    `Task requirement: ${task.description}`,
    ...memoryBlock,
    ...researchBlock,
    ...structuredRequirement,
    'Use approved playbooks as guidance, not as facts about this business.',
    'Do not reveal hidden chain-of-thought.',
    task.type === 'COPY_GENERATION' ? 'Return the requested machine-readable JSON only.' : 'Write a concise, production-useful result with clear headings or a compact numbered list. Do not reveal hidden chain-of-thought.'
  ].join('\n');
}

function preflightFallback(input = {}) {
  const prompt = String(input.prompt || '').trim();
  const vague = prompt.length < 24 || /^(make|create|write|post|help)(?:\s+(?:me\s+)?)?(?:a\s+)?(?:post|content|something)?[.!]?$/i.test(prompt);
  let inferredContentOutput = 'IMAGE';
  if (/\b(text|caption|copy)\s+only\b|\bno\s+(?:media|image|video)\b/i.test(prompt)) inferredContentOutput = 'TEXT';
  else if (/\bcarousel\b/i.test(prompt)) inferredContentOutput = 'CAROUSEL';
  else if (/\b(reel|shorts?)\b/i.test(prompt)) inferredContentOutput = 'REEL';
  else if (/\b(video|animation)\b/i.test(prompt)) inferredContentOutput = 'VIDEO';
  return {
    needsClarification: vague,
    understanding: vague ? 'The goal or desired customer outcome is not clear enough yet.' : `Create an organic ${inferredContentOutput.toLowerCase()} campaign from the supplied instruction.`,
    question: vague ? 'What is the main outcome you want from this post?' : '',
    options: vague ? ['Build awareness', 'Generate enquiries', 'Promote a specific offer'] : [],
    inferredContentOutput,
    generationPreference: /quality|detailed|premium/i.test(prompt) ? 'QUALITY' : 'FAST',
    researchFocus: 'Current audience interests, trustworthy facts, social search language and engagement opportunities.'
  };
}

function parsePreflight(value, input) {
  try {
    const start = String(value || '').indexOf('{');
    const end = String(value || '').lastIndexOf('}');
    const parsed = JSON.parse(String(value || '').slice(start, end + 1));
    const fallback = preflightFallback(input);
    const output = ['TEXT', 'IMAGE', 'CAROUSEL', 'VIDEO', 'REEL'].includes(String(parsed.inferredContentOutput).toUpperCase()) ? String(parsed.inferredContentOutput).toUpperCase() : fallback.inferredContentOutput;
    return {
      needsClarification: Boolean(parsed.needsClarification),
      understanding: String(parsed.understanding || fallback.understanding).slice(0, 500),
      question: String(parsed.question || '').slice(0, 300),
      options: (Array.isArray(parsed.options) ? parsed.options : []).map(item => String(item).slice(0, 100)).filter(Boolean).slice(0, 3),
      inferredContentOutput: output,
      generationPreference: String(parsed.generationPreference).toUpperCase() === 'QUALITY' ? 'QUALITY' : 'FAST',
      researchFocus: String(parsed.researchFocus || fallback.researchFocus).slice(0, 500)
    };
  } catch (_) { return preflightFallback(input); }
}

async function analyseMission(input = {}, dependencies = {}) {
  const fallback = preflightFallback(input);
  if (!env.ollama.baseUrl) return fallback;
  const http = dependencies.http || axios;
  try {
    const response = await http.post(`${env.ollama.baseUrl}/api/chat`, {
      model: env.ollama.model,
      stream: false,
      format: 'json',
      messages: [
        { role: 'system', content: 'Analyse a social-content instruction. Return JSON only with needsClarification boolean, understanding string, question string, options array (maximum 3), inferredContentOutput (TEXT, IMAGE, CAROUSEL, VIDEO or REEL), generationPreference (FAST or QUALITY), and researchFocus string. Ask only when a material business goal, offer, audience or required fact is genuinely missing. Infer the media format when reasonable.' },
        { role: 'user', content: `Instruction: ${String(input.prompt || '').slice(0, 4000)}\nPlatforms: ${(input.platforms || []).join(', ') || 'facebook'}` }
      ],
      options: { temperature: 0.15 }
    }, { timeout: Math.min(env.ollama.timeoutMs, 60000), headers: ollamaHeaders() });
    return parsePreflight(response.data?.message?.content, input);
  } catch (_) { return fallback; }
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

module.exports = { status, generateTaskOutput, taskInstruction, analyseMission, preflightFallback, parsePreflight, ollamaUnavailable, paidFallbackReady, ollamaHeaders };
