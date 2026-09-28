'use strict';

const axios = require('axios');
const prisma = require('../db/prisma');
const env = require('../config/env');
const uiStudioAnalysis = require('./uiStudioAnalysisService');
const webResearch = require('./webResearchService');

const AGENT_VERSION = 'ui-agent-v1';
const ACTIONS = ['NONE','UPLOAD_REFERENCE','ANALYSE','BUILD_PREVIEW','RUN_MATCH','APPROVE','GENERATE_CODE','EXPORT_BUNDLE'];

function publicError(message, status, code) {
  const error = new Error(message);
  error.status = status || 400;
  error.code = code || 'UI_STUDIO_AGENT_ERROR';
  error.publicMessage = message;
  return error;
}

function ready() {
  const config = env.uiStudioCodegen || {};
  return Boolean(config.apiKey && config.baseUrl && config.model);
}

function safeParse(value, fallback) {
  if (value == null) return fallback;
  if (typeof value === 'object') return value;
  try { return JSON.parse(String(value)); } catch (_) { return fallback; }
}

function serializeMessage(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.projectId,
    role: row.role,
    content: row.content,
    action: safeParse(row.actionJson, null),
    createdAt: row.createdAt
  };
}

function projectStage(project) {
  const analysis = project.analyses && project.analyses[0];
  const generation = project.generations && project.generations[0];
  if (!project.references || !project.references.length) return 'DESIGN';
  if (!analysis || analysis.status !== 'COMPLETED') return 'UNDERSTAND';
  if (!generation || !['READY','READY_WITH_WARNINGS'].includes(generation.status)) return 'PREVIEW';
  if (!project.bestGenerationId) return 'MATCH';
  if (!project.acceptedGenerationId) return 'APPROVE';
  if (!project.productionGenerationId || !project.productionGeneratedAt) return 'GENERATE';
  return 'DELIVER';
}

function projectContext(project) {
  const references = uiStudioAnalysis.latestReferences(project.references || []);
  const analysis = project.analyses && project.analyses[0];
  const analysisResult = safeParse(analysis && analysis.analysisJson, {});
  const generation = project.generations && project.generations[0];
  return {
    id: project.id,
    name: project.name,
    currentStage: projectStage(project),
    previewFramework: project.framework,
    previewStyling: project.styling,
    frameworkTargets: safeParse(project.frameworkTargetsJson, [project.framework]),
    stylingTargets: safeParse(project.stylingTargetsJson, [project.styling]),
    referenceViewports: references.map(function(item) { return item.viewport; }),
    analysisStatus: analysis ? analysis.status : null,
    analysisSummary: String((analysisResult && analysisResult.summary) || '').slice(0, 1600),
    generationStatus: generation ? generation.status : null,
    aggregateScore: generation && generation.aggregateScore != null ? generation.aggregateScore : project.bestAggregateScore,
    viewportScores: safeParse(generation && generation.viewportScoresJson, {}),
    bestGenerationId: project.bestGenerationId || null,
    acceptedGenerationId: project.acceptedGenerationId || null,
    productionGenerationId: project.productionGenerationId || null,
    productionGeneratedAt: project.productionGeneratedAt || null,
    recentDeliveries: (project.deliveries || []).map(function(item) {
      return { id: item.id, status: item.status, targetMode: item.targetMode, createdAt: item.createdAt };
    })
  };
}

function responseSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['message','recommendedAction'],
    properties: {
      message: { type: 'string' },
      recommendedAction: {
        type: 'object',
        additionalProperties: false,
        required: ['type','label','reason'],
        properties: {
          type: { type: 'string', enum: ACTIONS },
          label: { type: 'string' },
          reason: { type: 'string' }
        }
      }
    }
  };
}

async function loadProject(projectId) {
  const project = await prisma.uiDesignProject.findUnique({
    where: { id: String(projectId || '').trim() },
    include: {
      references: { orderBy: { createdAt: 'desc' }, take: 100 },
      analyses: { orderBy: { createdAt: 'desc' }, take: 1 },
      generations: { orderBy: { createdAt: 'desc' }, take: 1 },
      deliveries: { orderBy: { createdAt: 'desc' }, take: 8 }
    }
  });
  if (!project) throw publicError('UI Studio project was not found.', 404, 'UI_STUDIO_PROJECT_NOT_FOUND');
  return project;
}

async function listMessages(projectId) {
  await loadProject(projectId);
  const rows = await prisma.uiDesignAgentMessage.findMany({
    where: { projectId: String(projectId || '').trim() },
    orderBy: { createdAt: 'asc' },
    take: 80
  });
  return rows.map(serializeMessage);
}

async function ask(projectId, textValue, createdByUserId) {
  if (!ready()) throw publicError('UI Studio AI Agent is not configured.', 503, 'UI_STUDIO_AGENT_NOT_CONFIGURED');
  const content = String(textValue || '').trim();
  if (!content) throw publicError('Write a message for the UI Studio Agent.', 400, 'UI_STUDIO_AGENT_EMPTY');
  if (content.length > 6000) throw publicError('Agent messages must be 6,000 characters or shorter.', 413, 'UI_STUDIO_AGENT_TOO_LONG');

  const project = await loadProject(projectId);
  const previous = await prisma.uiDesignAgentMessage.findMany({
    where: { projectId: project.id },
    orderBy: { createdAt: 'desc' },
    take: 16
  });
  previous.reverse();

  const userRow = await prisma.uiDesignAgentMessage.create({
    data: {
      projectId: project.id,
      role: 'USER',
      content,
      createdByUserId: createdByUserId ? String(createdByUserId) : null
    }
  });

  const history = previous.map(function(item) {
    return {
      role: item.role === 'ASSISTANT' ? 'assistant' : 'user',
      content: [{ type: 'input_text', text: item.content }]
    };
  });
  history.push({ role: 'user', content: [{ type: 'input_text', text: content }] });

  const config = env.uiStudioCodegen;
  const payload = {
    model: config.model,
    instructions: [
      'You are UI Studio Agent, a concise senior design-to-code copilot embedded in a visual reconstruction workspace.',
      'Use the supplied project state as ground truth. Never claim that an action ran when it did not.',
      'The visible workflow is Design, Understand, Preview, Match & Refine, Approve, Generate, Deliver.',
      'Preview code may exist internally before approval, but call it an internal preview build. Production code is only considered generated after approval.',
      'Never expose internal Phase 2, Phase 3, Phase 4, Phase 5 or Phase 6 terminology unless the user explicitly asks about engineering internals.',
      'Recommend at most one action from the allowed action enum. Do not execute it.',
      'Do not recommend repository deployment unless production code is ready.',
      'Be direct and specific to the current project.'
    ].join(' '),
    input: [
      {
        role: 'developer',
        content: [{ type: 'input_text', text: 'CURRENT PROJECT STATE\\n' + JSON.stringify(projectContext(project)) }]
      }
    ].concat(history),
    text: {
      format: {
        type: 'json_schema',
        name: 'ui_studio_agent_reply',
        strict: true,
        schema: responseSchema()
      }
    },
    max_output_tokens: 1800
  };
  if (/^gpt-5(?:\\.|-)/i.test(String(payload.model || ''))) payload.reasoning = { effort: 'medium' };

  let response;
  try {
    response = await axios.post(config.baseUrl + '/responses', payload, {
      timeout: Math.min(Number(config.timeoutMs || 300000), 180000),
      headers: {
        Authorization: 'Bearer ' + config.apiKey,
        'Content-Type': 'application/json'
      }
    });
  } catch (caught) {
    await prisma.uiDesignAgentMessage.delete({ where: { id: userRow.id } }).catch(function() {});
    const detail = String(
      caught && caught.response && caught.response.data && caught.response.data.error
        ? caught.response.data.error.message
        : (caught && caught.message) || ''
    ).slice(0, 500);
    console.error('[ui-studio-agent] request failed', { detail });
    throw publicError('UI Studio Agent could not respond right now.', 502, 'UI_STUDIO_AGENT_PROVIDER_FAILED');
  }

  const raw = String(webResearch.extractResponseText(response.data) || '').trim()
    .replace(/^...(?:json)?\\s*/i, function(value) { return value.startsWith('...') ? '' : value; });
  let parsed;
  try { parsed = JSON.parse(raw.replace(/^\\x60\\x60\\x60(?:json)?\\s*/i, '').replace(/\\s*\\x60\\x60\\x60$/i, '')); }
  catch (_) { parsed = null; }

  if (!parsed || !parsed.message) {
    await prisma.uiDesignAgentMessage.delete({ where: { id: userRow.id } }).catch(function() {});
    throw publicError('UI Studio Agent returned an invalid response.', 502, 'UI_STUDIO_AGENT_PARSE_FAILED');
  }

  const requested = parsed.recommendedAction || {};
  const actionType = ACTIONS.includes(requested.type) ? requested.type : 'NONE';
  const action = {
    type: actionType,
    label: String(requested.label || '').slice(0, 120),
    reason: String(requested.reason || '').slice(0, 600)
  };
  const assistantRow = await prisma.uiDesignAgentMessage.create({
    data: {
      projectId: project.id,
      role: 'ASSISTANT',
      content: String(parsed.message).slice(0, 8000),
      actionJson: JSON.stringify(action)
    }
  });

  return {
    user: serializeMessage(userRow),
    assistant: serializeMessage(assistantRow),
    version: AGENT_VERSION
  };
}

module.exports = {
  AGENT_VERSION,
  ACTIONS,
  ready,
  projectStage,
  projectContext,
  listMessages,
  ask
};
