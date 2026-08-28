const prisma = require('../db/prisma');
const { decryptToken } = require('../utils/tokenCrypto');
const media = require('./agentMediaService');
const metaPublisher = require('./cloudMetaPublisher');

const POST_ASSET_SELECT = { id: true, kind: true, source: true, status: true, originalName: true, mimeType: true, byteSize: true, customerPrompt: true, exactOverlayText: true, generationChoice: true, qualityScore: true, qualityIssuesJson: true, createdAt: true };
const CAMPAIGN_INCLUDE = {
  posts: {
    orderBy: { sequence: 'asc' },
    include: {
      connectedPage: { select: { id: true, facebookPageId: true, facebookPageName: true, facebookPagePicture: true, status: true } },
      asset: { select: POST_ASSET_SELECT },
      scheduleJob: { select: { id: true, status: true, scheduledAt: true, metaPostId: true, errorMessage: true } }
    }
  }
};

function parseJson(value, fallback) {
  try { return JSON.parse(value); } catch (_) { return fallback; }
}

function text(value, maximum = 63206) {
  return String(value || '').trim().slice(0, maximum);
}

function extractStructuredPosts(value) {
  const raw = String(value || '').trim();
  if (!raw) return [];
  try {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    const parsed = JSON.parse(raw.slice(start, end + 1));
    return Array.isArray(parsed.posts) ? parsed.posts : [];
  } catch (_) { return []; }
}

function normalizePost(input, index, fallbackCaption) {
  const hashtags = (Array.isArray(input?.hashtags) ? input.hashtags : [])
    .map(value => text(value, 60).replace(/^#+/, '').replace(/\s+/g, ''))
    .filter(Boolean)
    .slice(0, 30);
  const body = text(input?.caption || fallbackCaption || '');
  return {
    title: text(input?.title || `Post ${index + 1}`, 160),
    caption: [body, hashtags.length ? hashtags.map(item => `#${item}`).join(' ') : ''].filter(Boolean).join('\n\n'),
    altText: text(input?.altText, 1000) || null,
    hashtagsJson: JSON.stringify(hashtags),
    visualBrief: text(input?.visualBrief || input?.objective || body, 2000) || null
  };
}

function localParts(date, timezone) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  }).formatToParts(date);
  return Object.fromEntries(parts.filter(part => part.type !== 'literal').map(part => [part.type, Number(part.value)]));
}

function zonedDateToUtc({ year, month, day, hour, minute }, timezone) {
  const wanted = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  let guess = wanted;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const actual = localParts(new Date(guess), timezone);
    const represented = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second || 0, 0);
    guess += wanted - represented;
  }
  return new Date(guess);
}

function normalizedSlots(settings = {}) {
  const values = Array.isArray(settings.dailySlots) ? settings.dailySlots : [];
  const valid = values.map(value => String(value || '').trim()).filter(value => /^([01]\d|2[0-3]):[0-5]\d$/.test(value));
  return valid.length ? [...new Set(valid)].sort() : ['09:30', '13:00', '18:30'];
}

function researchSuggestedTimes(researchOutput = {}) {
  const source = [researchOutput.summary, researchOutput.content, ...(Array.isArray(researchOutput.recommendations) ? researchOutput.recommendations : [])].filter(Boolean).join(' ');
  const matches = source.matchAll(/\b(?:at|around|between|from|window|time|posting|publish(?:ing)?)?\s*(\d{1,2})(?::([0-5]\d))?\s*(a\.?m\.?|p\.?m\.?)(?!\w)|\b(?:at|around|between|from|window|time|posting|publish(?:ing)?)?\s*([01]\d|2[0-3]):([0-5]\d)\b/gi);
  const times = [];
  for (const match of matches) {
    let hour;
    let minute;
    if (match[4] !== undefined) {
      hour = Number(match[4]);
      minute = Number(match[5]);
    } else {
      hour = Number(match[1]);
      minute = Number(match[2] || 0);
      const suffix = String(match[3] || '').toLowerCase().replaceAll('.', '');
      if (hour < 1 || hour > 12) continue;
      if (suffix === 'pm' && hour !== 12) hour += 12;
      if (suffix === 'am' && hour === 12) hour = 0;
    }
    const value = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    if (!times.includes(value)) times.push(value);
    if (times.length >= 6) break;
  }
  return times;
}

function recommendedSlots({ count, timezone, times, occupied = new Set(), now = new Date() }) {
  const output = [];
  const minimum = new Date(now.getTime() + 60 * 60 * 1000);
  const maximum = new Date(now.getTime() + 74 * 24 * 60 * 60 * 1000);
  const today = localParts(now, timezone);
  for (let dayOffset = 0; dayOffset < 75 && output.length < count; dayOffset += 1) {
    const calendar = new Date(Date.UTC(today.year, today.month - 1, today.day + dayOffset));
    for (const slot of times) {
      const [hour, minute] = slot.split(':').map(Number);
      const candidate = zonedDateToUtc({ year: calendar.getUTCFullYear(), month: calendar.getUTCMonth() + 1, day: calendar.getUTCDate(), hour, minute }, timezone);
      const key = candidate.toISOString().slice(0, 16);
      if (candidate <= minimum || candidate > maximum || occupied.has(key)) continue;
      occupied.add(key);
      output.push(candidate);
      if (output.length >= count) break;
    }
  }
  if (output.length < count) throw new Error('INX Social could not find enough safe publishing slots in the next 74 days.');
  return output;
}

function publicAsset(asset) {
  if (!asset) return null;
  const qualityIssues = parseJson(asset.qualityIssuesJson, []);
  return {
    id: asset.id,
    kind: asset.kind,
    source: asset.source,
    status: asset.status,
    originalName: asset.originalName,
    mimeType: asset.mimeType,
    byteSize: asset.byteSize,
    customerPrompt: asset.customerPrompt || null,
    exactOverlayText: asset.exactOverlayText || null,
    generationChoice: asset.generationChoice || null,
    qualityReview: asset.qualityScore !== null && asset.qualityScore !== undefined ? { approved: asset.status === 'READY', score: asset.qualityScore, issues: Array.isArray(qualityIssues) ? qualityIssues : [] } : null,
    createdAt: asset.createdAt,
    contentUrl: asset.status === 'READY' ? `/api/agent/assets/${encodeURIComponent(asset.id)}/content` : null
  };
}

function publicCampaign(campaign) {
  if (!campaign) return null;
  const posts = (campaign.posts || []).map(post => ({
    id: post.id,
    sequence: post.sequence,
    status: post.status,
    platform: post.platform,
    format: post.format,
    title: post.title,
    caption: post.caption,
    altText: post.altText,
    hashtags: parseJson(post.hashtagsJson, []),
    visualBrief: post.visualBrief,
    scheduledAt: post.scheduledAt,
    scheduleReason: post.scheduleReason,
    approvedAt: post.approvedAt,
    metaPostId: post.metaPostId,
    lastError: post.lastError,
    page: post.connectedPage ? {
      id: post.connectedPage.id,
      facebookPageId: post.connectedPage.facebookPageId,
      name: post.connectedPage.facebookPageName,
      picture: post.connectedPage.facebookPagePicture,
      status: post.connectedPage.status
    } : null,
    asset: publicAsset(post.asset),
    scheduleJob: post.scheduleJob || null
  }));
  return {
    id: campaign.id,
    planId: campaign.planId,
    name: campaign.name,
    status: campaign.status,
    timezone: campaign.timezone,
    targetPageIds: parseJson(campaign.targetPageIdsJson, []),
    researchSummary: campaign.researchSummary,
    approvedAt: campaign.approvedAt,
    scheduledAt: campaign.scheduledAt,
    createdAt: campaign.createdAt,
    updatedAt: campaign.updatedAt,
    counts: {
      total: posts.length,
      approved: posts.filter(post => ['APPROVED', 'SCHEDULING', 'SCHEDULED'].includes(post.status)).length,
      scheduled: posts.filter(post => post.status === 'SCHEDULED').length,
      needsAttention: posts.filter(post => ['READY_FOR_REVIEW', 'CHANGES_REQUESTED', 'SCHEDULE_FAILED', 'WAITING_MEDIA'].includes(post.status)).length
    },
    posts
  };
}

async function findOwned(userId, campaignId) {
  const campaign = await prisma.agentCampaign.findFirst({ where: { id: campaignId, userId }, include: CAMPAIGN_INCLUDE });
  if (!campaign) throw Object.assign(new Error('Campaign review not found.'), { status: 404 });
  return campaign;
}

async function prepareReview(planId) {
  const existing = await prisma.agentCampaign.findUnique({ where: { planId }, include: CAMPAIGN_INCLUDE });
  if (existing) return existing;
  const plan = await prisma.agentPlan.findUnique({
    where: { id: planId },
    include: { tasks: { orderBy: { sequence: 'asc' } }, assets: { where: { source: { in: ['OLLAMA_IMAGE', 'OPENAI_IMAGE'] }, status: { in: ['READY', 'REJECTED'] } }, orderBy: { createdAt: 'asc' }, select: POST_ASSET_SELECT } }
  });
  if (!plan) throw new Error('Agent plan not found while preparing campaign review.');
  const strategy = parseJson(plan.strategyJson, {});
  const count = Math.max(1, Math.min(100, Number(strategy.assetCount || 1)));
  const targets = Array.isArray(strategy.pageTargets) ? strategy.pageTargets.filter(page => page.id) : [];
  const copyTask = plan.tasks.find(task => task.type === 'COPY_GENERATION');
  const copyOutput = parseJson(copyTask?.outputJson, {});
  const structured = extractStructuredPosts(copyOutput.content);
  const fallbackSections = text(copyOutput.content).split(/\n(?=\s*\d+[.)]\s+)/).map(value => value.trim()).filter(Boolean);
  const researchOutput = parseJson(plan.tasks.find(task => task.type === 'WEB_RESEARCH')?.outputJson, {});
  const mediaTaskOutput = parseJson(plan.tasks.find(task => task.type === 'IMAGE_GENERATION')?.outputJson, {});
  const mediaWaitingMessage = text(mediaTaskOutput.message, 1000) || null;
  const preference = await prisma.cloudPreference.findUnique({ where: { userId: plan.userId } });
  const settings = parseJson(preference?.settingsJson, {});
  const timezone = text(settings.timezone, 100) || 'Europe/London';
  const occupiedRows = await prisma.scheduleJob.findMany({ where: { userId: plan.userId, scheduledAt: { gt: new Date() }, status: { in: ['SCHEDULED', 'PROCESSING', 'PENDING'] } }, select: { scheduledAt: true } });
  const occupied = new Set(occupiedRows.map(item => item.scheduledAt?.toISOString().slice(0, 16)).filter(Boolean));
  const savedTimes = Array.isArray(settings.dailySlots) && settings.dailySlots.length ? normalizedSlots(settings) : [];
  const researchedTimes = researchSuggestedTimes(researchOutput);
  const slotSource = savedTimes.length ? 'SAVED' : researchedTimes.length ? 'RESEARCHED' : 'GENERAL';
  const slots = recommendedSlots({ count, timezone, times: savedTimes.length ? savedTimes : researchedTimes.length ? researchedTimes : normalizedSlots(settings), occupied });
  const contentOutput = String(strategy.contentOutput || 'IMAGE').toUpperCase();
  const researchAvailable = Boolean(researchOutput.content || researchOutput.summary);
  const readyAssets = plan.assets.filter(asset => asset.status === 'READY');
  const rejectedAssets = plan.assets.filter(asset => asset.status === 'REJECTED');
  const posts = Array.from({ length: count }, (_, index) => {
    const normalized = normalizePost(structured[index], index, fallbackSections[index] || fallbackSections[0] || plan.prompt);
    const asset = readyAssets[index] || null;
    const rejected = !asset ? rejectedAssets[index] || rejectedAssets[rejectedAssets.length - 1] || null : null;
    const rejectedIssues = parseJson(rejected?.qualityIssuesJson, []);
    const needsMedia = contentOutput !== 'TEXT' && !asset;
    return {
      sequence: index + 1,
      connectedPageId: targets.length ? targets[index % targets.length].id : null,
      assetId: asset?.id || null,
      status: needsMedia ? 'WAITING_MEDIA' : 'READY_FOR_REVIEW',
      lastError: needsMedia ? (rejected
        ? text(Array.isArray(rejectedIssues) && rejectedIssues.length ? rejectedIssues.join('; ') : 'The generated image did not pass visual review. Describe the image you want and create a replacement.', 1000)
        : mediaWaitingMessage) : null,
      platform: 'facebook',
      format: contentOutput,
      ...normalized,
      scheduledAt: slots[index],
      scheduleReason: `${slotSource === 'SAVED' ? 'Saved publishing preference' : slotSource === 'RESEARCHED' ? 'Current research-supported publishing window' : 'General organic testing window'} in ${timezone}; future lead time and occupied slots checked.`
    };
  });
  const targetNames = targets.map(page => page.name).filter(Boolean);
  return prisma.agentCampaign.create({
    data: {
      userId: plan.userId,
      planId: plan.id,
      name: text(`${targetNames.join(', ') || 'Social campaign'} — ${plan.prompt}`, 160),
      status: 'READY_FOR_REVIEW',
      targetPageIdsJson: JSON.stringify(targets.map(page => page.id)),
      timezone,
      researchSummary: text(researchOutput.summary || researchOutput.content, 4000) || null,
      posts: { create: posts }
    },
    include: CAMPAIGN_INCLUDE
  });
}

function assertEditable(post) {
  if (['SCHEDULING', 'SCHEDULED', 'PUBLISHED'].includes(post.status)) throw Object.assign(new Error('This post is already being published and can no longer be edited here.'), { status: 409 });
}

async function updatePost(userId, campaignId, postId, input = {}) {
  const campaign = await findOwned(userId, campaignId);
  const post = campaign.posts.find(item => item.id === postId);
  if (!post) throw Object.assign(new Error('Campaign post not found.'), { status: 404 });
  assertEditable(post);
  const data = { status: 'READY_FOR_REVIEW', approvedAt: null, lastError: null };
  if (input.title !== undefined) data.title = text(input.title, 160) || null;
  if (input.caption !== undefined) {
    data.caption = text(input.caption);
    if (!data.caption) throw Object.assign(new Error('A post caption cannot be empty.'), { status: 400 });
  }
  if (input.altText !== undefined) data.altText = text(input.altText, 1000) || null;
  if (input.visualBrief !== undefined) data.visualBrief = text(input.visualBrief, 2000) || null;
  if (input.scheduledAt !== undefined) {
    const scheduledAt = new Date(input.scheduledAt);
    if (!Number.isFinite(scheduledAt.getTime()) || scheduledAt.getTime() < Date.now() + 10 * 60 * 1000 || scheduledAt.getTime() > Date.now() + 75 * 24 * 60 * 60 * 1000) {
      throw Object.assign(new Error('Choose a publishing time from 10 minutes to 75 days in the future.'), { status: 400 });
    }
    data.scheduledAt = scheduledAt;
    data.scheduleReason = 'Customer-adjusted publishing time.';
  }
  if (input.assetId !== undefined) {
    const asset = await prisma.agentAsset.findFirst({ where: { id: String(input.assetId), userId, planId: campaign.planId, status: 'READY' }, select: { id: true } });
    if (!asset) throw Object.assign(new Error('Choose a generated image from this campaign.'), { status: 400 });
    data.assetId = asset.id;
  }
  await prisma.agentCampaignPost.update({ where: { id: post.id }, data });
  await prisma.agentCampaign.update({ where: { id: campaign.id }, data: { status: 'READY_FOR_REVIEW', approvedAt: null } });
  return findOwned(userId, campaign.id);
}

async function approvePost(userId, campaignId, postId) {
  const campaign = await findOwned(userId, campaignId);
  const post = campaign.posts.find(item => item.id === postId);
  if (!post) throw Object.assign(new Error('Campaign post not found.'), { status: 404 });
  assertEditable(post);
  if (post.status === 'WAITING_MEDIA') throw Object.assign(new Error('Generate an image that passes the visual quality review before approving this post.'), { status: 409 });
  if (!post.caption || !post.scheduledAt || !post.connectedPage) throw Object.assign(new Error('Caption, Page and publishing time are required before approval.'), { status: 409 });
  const scheduledAt = new Date(post.scheduledAt).getTime();
  if (!Number.isFinite(scheduledAt) || scheduledAt < Date.now() + 10 * 60 * 1000 || scheduledAt > Date.now() + 75 * 24 * 60 * 60 * 1000) throw Object.assign(new Error('Choose a publishing time from 10 minutes to 75 days in the future.'), { status: 409 });
  if (post.format !== 'TEXT' && (!post.asset || post.asset.status !== 'READY' || post.asset.qualityScore === null || post.asset.qualityScore === undefined)) throw Object.assign(new Error('Regenerate this image under the current visual quality gate before approving it.'), { status: 409 });
  await prisma.agentCampaignPost.update({ where: { id: post.id }, data: { status: 'APPROVED', approvedAt: new Date(), lastError: null } });
  return findOwned(userId, campaign.id);
}

async function approveAll(userId, campaignId) {
  const campaign = await findOwned(userId, campaignId);
  const eligible = campaign.posts.filter(post => !['WAITING_MEDIA', 'SCHEDULING', 'SCHEDULED', 'PUBLISHED'].includes(post.status) && post.caption && post.scheduledAt && post.connectedPage && (post.format === 'TEXT' || (post.asset?.status === 'READY' && post.asset.qualityScore !== null && post.asset.qualityScore !== undefined)));
  if (!eligible.length) throw Object.assign(new Error('No review-ready posts are available to approve.'), { status: 409 });
  const now = new Date();
  await prisma.agentCampaignPost.updateMany({ where: { id: { in: eligible.map(post => post.id) } }, data: { status: 'APPROVED', approvedAt: now, lastError: null } });
  const refreshed = await findOwned(userId, campaign.id);
  const allApproved = refreshed.posts.every(post => ['APPROVED', 'SCHEDULED', 'PUBLISHED'].includes(post.status));
  await prisma.agentCampaign.update({ where: { id: campaign.id }, data: { status: allApproved ? 'APPROVED' : 'PARTIALLY_APPROVED', approvedAt: allApproved ? now : null } });
  return findOwned(userId, campaign.id);
}

async function regeneratePostImage(userId, campaignId, postId, input = {}, dependencies = {}) {
  const campaign = await findOwned(userId, campaignId);
  const post = campaign.posts.find(item => item.id === postId);
  if (!post) throw Object.assign(new Error('Campaign post not found.'), { status: 404 });
  assertEditable(post);
  const customerPrompt = String(input.customerPrompt || '').trim();
  const overlayText = String(input.overlayText || '').trim();
  const generationChoice = String(input.generationChoice || 'IMAGE_QUALITY').toUpperCase();
  if (customerPrompt.length > 1200) throw Object.assign(new Error('Keep image instructions within 1,200 characters.'), { status: 400 });
  if (overlayText.length > 120) throw Object.assign(new Error('Keep exact image text within 120 characters.'), { status: 400 });
  if (!['IMAGE_FAST', 'IMAGE_QUALITY', 'IMAGE_PREMIUM'].includes(generationChoice)) throw Object.assign(new Error('Choose Fast, Quality or Premium image generation.'), { status: 400 });
  const plan = await prisma.agentPlan.findFirst({ where: { id: campaign.planId, userId } });
  if (!plan) throw Object.assign(new Error('Campaign mission not found.'), { status: 404 });
  const asset = await media.regenerateCampaignImage(plan, post, { customerPrompt, overlayText, generationChoice }, dependencies);
  const ready = asset.status === 'READY' && asset.qualityReview?.approved;
  const issues = (asset.qualityReview?.issues || []).join('; ') || asset.qualityReview?.warning || 'The generated image did not pass visual review.';
  await prisma.agentCampaignPost.update({
    where: { id: post.id },
    data: ready
      ? { assetId: asset.id, format: 'IMAGE', status: 'READY_FOR_REVIEW', approvedAt: null, lastError: null }
      : { format: 'IMAGE', status: 'WAITING_MEDIA', approvedAt: null, lastError: text(issues, 1000) }
  });
  await prisma.agentCampaign.update({ where: { id: campaign.id }, data: { status: 'READY_FOR_REVIEW', approvedAt: null } });
  return { campaign: await findOwned(userId, campaign.id), ready, qualityReview: asset.qualityReview };
}

async function scheduleCampaign(userId, campaignId, dependencies = {}) {
  const publisher = dependencies.publisher || metaPublisher;
  let campaign = await findOwned(userId, campaignId);
  const candidates = campaign.posts.filter(post => ['APPROVED', 'SCHEDULE_FAILED'].includes(post.status));
  if (!candidates.length) throw Object.assign(new Error('Approve at least one campaign post before scheduling.'), { status: 409 });
  const results = [];
  for (const post of candidates) {
    let job = null;
    try {
      if (!post.connectedPage?.encryptedAccessToken && !post.connectedPage?.id) throw new Error('The selected Facebook Page is no longer connected.');
      const page = await prisma.connectedPage.findFirst({ where: { id: post.connectedPage.id, userId, status: 'ACTIVE' } });
      if (!page?.encryptedAccessToken) throw new Error('The selected Facebook Page needs to be reconnected before scheduling.');
      if (['VIDEO', 'REEL'].includes(post.format)) throw new Error('Campaign video publishing is not connected yet; keep this post in review or use the Reel Scheduler.');
      if (post.format !== 'TEXT' && (!post.asset || post.asset.status !== 'READY' || post.asset.qualityScore === null || post.asset.qualityScore === undefined)) {
        throw Object.assign(new Error('Regenerate this image under the current visual quality gate before scheduling it.'), { code: 'MEDIA_REVIEW_REQUIRED' });
      }
      job = await prisma.scheduleJob.upsert({
        where: { userId_clientRequestId: { userId, clientRequestId: `agent-campaign:${post.id}` } },
        create: {
          userId,
          connectedPageId: page.id,
          status: 'PROCESSING',
          origin: 'AGENT_CAMPAIGN',
          uploadStatus: 'NOT_REQUIRED',
          publishMode: 'SCHEDULED',
          clientRequestId: `agent-campaign:${post.id}`,
          contentType: post.asset ? 'IMAGE' : 'TEXT',
          title: post.title,
          caption: post.caption,
          localFileName: post.asset?.originalName || null,
          scheduledAt: post.scheduledAt,
          attemptCount: 1,
          claimedAt: new Date()
        },
        update: { status: 'PROCESSING', errorMessage: null, attemptCount: { increment: 1 }, claimedAt: new Date(), scheduledAt: post.scheduledAt, caption: post.caption }
      });
      await prisma.agentCampaignPost.update({ where: { id: post.id }, data: { status: 'SCHEDULING', scheduleJobId: job.id, lastError: null } });
      const asset = post.assetId ? await prisma.agentAsset.findFirst({ where: { id: post.assetId, userId, status: 'READY' }, select: { data: true, mimeType: true, originalName: true } }) : null;
      const published = await publisher.publishOrganicPost({
        pageId: page.facebookPageId,
        pageAccessToken: decryptToken(page.encryptedAccessToken),
        caption: post.caption,
        scheduledAt: post.scheduledAt,
        asset
      });
      await prisma.scheduleJob.update({ where: { id: job.id }, data: { status: 'SCHEDULED', completedAt: new Date(), metaPostId: published.postId, rawMetaResponse: JSON.stringify(published.response || {}) } });
      await prisma.agentCampaignPost.update({ where: { id: post.id }, data: { status: 'SCHEDULED', metaPostId: published.postId, lastError: null } });
      results.push({ postId: post.id, ok: true, metaPostId: published.postId });
    } catch (error) {
      const message = text(error.publicMessage || error.message || 'Facebook scheduling failed.', 1000);
      if (job) await prisma.scheduleJob.update({ where: { id: job.id }, data: { status: 'FAILED', errorMessage: message } }).catch(() => {});
      await prisma.agentCampaignPost.update({ where: { id: post.id }, data: { status: error.code === 'MEDIA_REVIEW_REQUIRED' ? 'WAITING_MEDIA' : 'SCHEDULE_FAILED', lastError: message, scheduleJobId: job?.id || post.scheduleJobId || null } });
      results.push({ postId: post.id, ok: false, error: message });
    }
  }
  campaign = await findOwned(userId, campaignId);
  const scheduled = campaign.posts.filter(post => post.status === 'SCHEDULED').length;
  const failed = results.filter(result => !result.ok).length;
  const status = scheduled === campaign.posts.length ? 'SCHEDULED' : scheduled ? 'PARTIALLY_SCHEDULED' : 'SCHEDULE_FAILED';
  await prisma.agentCampaign.update({ where: { id: campaign.id }, data: { status, scheduledAt: scheduled ? new Date() : null } });
  if (status === 'SCHEDULED') {
    const completedAt = new Date();
    await prisma.agentTask.updateMany({
      where: { planId: campaign.planId, type: 'PUBLISH' },
      data: { status: 'COMPLETED', completedAt, outputJson: JSON.stringify({ message: `${scheduled} post${scheduled === 1 ? '' : 's'} scheduled successfully and saved in Completed Missions.`, campaignId }) }
    });
    await prisma.agentTask.updateMany({
      where: { planId: campaign.planId, type: 'ANALYTICS' },
      data: { status: 'COMPLETED', completedAt, outputJson: JSON.stringify({ message: 'Post-publication analytics monitoring is registered. New evidence can produce a reviewed learning recommendation when platform data becomes available.' }) }
    });
    await prisma.agentPlan.update({ where: { id: campaign.planId }, data: { status: 'COMPLETED', completedAt, lastError: null } });
    await prisma.agentEvent.create({ data: { userId, planId: campaign.planId, taskId: null, type: 'MISSION_DELIVERED', status: 'SUCCESS', title: 'Mission saved to Completed Missions', message: `${scheduled} approved post${scheduled === 1 ? ' is' : 's are'} scheduled and the complete campaign remains available for reopening.` } });
  }
  return { campaign: await findOwned(userId, campaign.id), results, scheduled, failed };
}

module.exports = {
  CAMPAIGN_INCLUDE,
  publicCampaign,
  extractStructuredPosts,
  normalizedSlots,
  researchSuggestedTimes,
  recommendedSlots,
  prepareReview,
  findOwned,
  updatePost,
  approvePost,
  approveAll,
  regeneratePostImage,
  scheduleCampaign
};
