const CONTENT_COMMAND = /\b(?:create|write|prepare|generate|make|schedule|publish|post)\b[\s\S]{0,120}\b(?:post|content|caption|image|carousel|reel|video|campaign)s?\b|\b(?:post|schedule|publish)\b[\s\S]{0,80}\b(?:page|facebook|instagram|tiktok|youtube)\b/i;
const DELEGATED_RESEARCH = /\b(?:research|analyse|analyze|competitor|seo|keyword|trend|audience|market|hashtag|best\s+(?:time|day)|website)\b|https?:\/\//i;

function isContentCommand(value) {
  return CONTENT_COMMAND.test(String(value || ''));
}

function isSimpleManagerCommand(value) {
  const prompt = String(value || '').replace(/\s+/g, ' ').trim();
  return prompt.length <= 180 && isContentCommand(prompt);
}

function requiresResearch(value, assetCount = 1) {
  const prompt = String(value || '');
  return assetCount > 1 || isContentCommand(prompt) || DELEGATED_RESEARCH.test(prompt) || prompt.length >= 180;
}

function generationPreference(value) {
  const prompt = String(value || '');
  if (/\b(?:fast|quick|draft)\b/i.test(prompt) && !/\b(?:quality|premium|detailed|launch|first\s+post)\b/i.test(prompt)) return 'FAST';
  return isContentCommand(prompt) || /\b(?:quality|premium|detailed)\b/i.test(prompt) ? 'QUALITY' : 'FAST';
}

function explicitMediaType(value) {
  const prompt = String(value || '');
  if (/\b(text|copy|caption)s?\s+only\b|\bno\s+(?:image|images|media|video|videos)\b/i.test(prompt)) return 'TEXT';
  if (/\bcarousel\b/i.test(prompt)) return 'CAROUSEL';
  if (/\b(reel|reels|short|shorts)\b/i.test(prompt)) return 'REEL';
  if (/\b(video|videos|animation|animated)\b/i.test(prompt)) return 'VIDEO';
  if (/\b(?:create|generate|make|design|include|with|using|need|want)(?:\s+(?:an?|one|the|my|our|branded|professional|premium|quality|related|relevant)){0,5}\s+(?:image|visual|graphic|picture|photo)\b|\b(?:image|visual|graphic|picture|photo)\s+(?:for|with|related|showing|using)\b/i.test(prompt)) return 'IMAGE';
  return '';
}

function hasPublishingDecision(value) {
  const prompt = String(value || '');
  return /\b(?:draft|plan)\s+only\b|\bno\s+publishing\b|\b(?:save|keep)\s+(?:it\s+)?as\s+(?:a\s+)?draft\b|\b(?:use|choose|pick|find|propose|recommend)(?:\s+(?:the|a|an|my|our|best|suitable|researched|recommended|future)){0,6}\s+(?:publishing|posting|schedule)?\s*(?:date|day|time|window|slot)\b|\b(?:today|tomorrow|tonight|this\s+(?:morning|afternoon|evening)|next\s+(?:mon|tues|wednes|thurs|fri|satur|sun)day)\b|\b\d{4}-\d{2}-\d{2}\b|\b(?:[01]?\d|2[0-3]):[0-5]\d\b|\b(?:1[0-2]|0?[1-9])(?::[0-5]\d)?\s*(?:a\.?m\.?|p\.?m\.?)\b/i.test(prompt);
}

function timingClarification(value) {
  const prompt = String(value || '');
  if (!isContentCommand(prompt) || hasPublishingDecision(prompt)) return null;
  return {
    needsClarification: true,
    understanding: 'Create professional social content using the connected Page, current research and brand assets.',
    question: 'When should INX Social prepare this post for publishing?',
    options: ['Use AI-recommended researched time', 'Show the proposed date and time for my approval', 'Save it as a draft'],
    inferredContentOutput: explicitMediaType(prompt) || 'IMAGE',
    generationPreference: generationPreference(prompt),
    researchFocus: researchFocus()
  };
}

function playbookForTask(taskType) {
  const foundation = [
    'SOCIAL MANAGER INTELLIGENCE: Treat the customer instruction as the desired outcome; perform the professional social-media method automatically without asking them to repeat routine requirements.',
    'Ground every decision in the connected Page, supplied assets, verified website or Page facts, current research and approved reusable learning. Never invent services, prices, results, testimonials, statistics or permissions.',
    'Competitor analysis is internal strategy evidence. Never copy wording or design, and do not name or attack competitors in customer-facing content unless the customer explicitly asks and the comparison is supportable.',
    'Optimise for social search naturally: make the subject, audience problem, service benefit and location clear in human language; use a small number of relevant hashtags; never keyword-stuff.',
    'Keep the brand exact. Prefer a selected uploaded logo; otherwise use the connected Page profile picture. Never ask an image model to redraw a logo, trademark, product screenshot or wording.',
    'Media must visibly relate to the actual business, service, product or post idea. Reject generic technology art, fake dashboards, phones, random lettering, irrelevant stock scenes and unsupported before/after claims.',
    'Respect the selected operating mode, connected-platform permissions, occupied publishing slots, customer timezone, approval state and paid-media prohibition.'
  ];
  const specific = {
    BRAND_REVIEW: [
      'Identify the Page name, category, customer offer, likely audience, tone, brand mark, website and any facts still requiring verification. Treat the trusted Page profile image and selected assets as authoritative visual references.'
    ],
    WEB_RESEARCH: [
      'Find and verify the official website or authoritative Page information first. Then research current audience needs, competitor positioning, content opportunities, social-search phrases, suitable hashtags and evidence-backed timing guidance for the target country and platform.'
    ],
    CONTENT_STRATEGY: [
      'Choose a useful customer-facing angle, content purpose, format, hook, call to action and service-relevant visual concept. Avoid producing an internal feature inventory unless it directly helps the audience understand the benefit.'
    ],
    COPY_GENERATION: [
      'Write publish-ready copy with a natural hook, clear topic and audience language, verified value, one appropriate call to action and usually two to five focused hashtags. Keep it human, specific and easy to scan.'
    ],
    IMAGE_GENERATION: [
      'Create only the background visual from the approved service-relevant concept. Exact brand marks and optional wording are composited after generation, then the final image must pass visual inspection.'
    ],
    SCHEDULE: [
      'Recommend a future slot using current audience evidence when available, the customer timezone, saved preferences, platform lead-time rules and occupied-slot checks. Distinguish researched guidance from general testing assumptions.'
    ],
    ANALYTICS: [
      'After publication, compare permitted reach and engagement evidence with the post objective. Propose one bounded improvement and save it only through the reviewed learning workflow.'
    ]
  };
  return [...foundation, ...(specific[String(taskType || '').toUpperCase()] || [])];
}

function researchFocus() {
  return 'Official brand and service facts; current target-audience needs; competitor positioning gaps; social-search phrases and hashtags; platform-appropriate content patterns; evidence-backed publishing windows; risks or unsupported claims to avoid.';
}

module.exports = { isContentCommand, isSimpleManagerCommand, requiresResearch, generationPreference, explicitMediaType, hasPublishingDecision, timingClarification, playbookForTask, researchFocus };
