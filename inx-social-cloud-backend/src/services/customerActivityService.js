const prisma = require('../db/prisma');

const CATEGORIES = Object.freeze([
  'ALL','ACCOUNT','AUTH','BILLING','CREDITS','CONNECTIONS',
  'PUBLISHING','AI','MEDIA','AUTOMATION','EMAIL','ADMIN','ERROR'
]);

function iso(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function clean(value, max = 220) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, max);
}

function safeJson(value) {
  if (!value) return null;
  try { return typeof value === 'string' ? JSON.parse(value) : value; } catch (_) { return null; }
}

function event({ id, at, category, action, title, detail = '', status = 'INFO', metadata = null, source = null }) {
  const timestamp = iso(at);
  if (!timestamp) return null;
  return {
    id: clean(id || category + ':' + action + ':' + timestamp, 240),
    at: timestamp,
    category,
    action: clean(action, 80),
    title: clean(title, 180),
    detail: clean(detail, 500),
    status: clean(status || 'INFO', 40).toUpperCase(),
    source: source ? clean(source, 80) : null,
    metadata: metadata && typeof metadata === 'object' ? metadata : null
  };
}

function publicAuditMetadata(raw) {
  const value = safeJson(raw);
  if (!value || typeof value !== 'object') return null;
  const allowed = [
    'action','credits','reason','resultingBalance','plan','previousPlan','status',
    'aiStudioAccess','trialDays','durationDays','provider','type','count'
  ];
  const out = {};
  for (const key of allowed) {
    if (value[key] == null) continue;
    const current = value[key];
    out[key] = typeof current === 'string' ? clean(current, 240) : current;
  }
  return Object.keys(out).length ? out : null;
}

function generationLabel(type) {
  const value = clean(type || 'AI content', 80).replaceAll('_', ' ').toLowerCase();
  return value.replace(/\b\w/g, letter => letter.toUpperCase());
}

function statusLevel(status) {
  const value = String(status || '').toUpperCase();
  if (/FAIL|ERROR|CANCEL|REJECT|SUSPEND/.test(value)) return 'ERROR';
  if (/COMPLETE|PUBLISH|READY|ACTIVE|SUCCESS|VERIFIED|SENT/.test(value)) return 'SUCCESS';
  if (/QUEU|PROCESS|GENERAT|SCHEDUL|PENDING|TRIAL/.test(value)) return 'WARNING';
  return 'INFO';
}

async function optionalRaw(query, ...params) {
  try { return await prisma.$queryRawUnsafe(query, ...params); } catch (_) { return []; }
}

async function customerActivity(userId, options = {}) {
  const limit = Math.max(20, Math.min(200, Number(options.limit || 100)));
  const category = CATEGORIES.includes(String(options.category || 'ALL').toUpperCase())
    ? String(options.category || 'ALL').toUpperCase()
    : 'ALL';
  const before = options.before ? new Date(options.before) : null;
  const validBefore = before && !Number.isNaN(before.getTime()) ? before : null;
  const createdFilter = validBefore ? { lt: validBefore } : undefined;
  const take = Math.min(120, limit + 30);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, name: true, email: true, status: true, role: true,
      createdAt: true, updatedAt: true, emailVerifiedAt: true, trialEndsAt: true
    }
  });
  if (!user) {
    const error = new Error('User not found');
    error.status = 404;
    throw error;
  }

  const [
    devices, connections, pages, contents, jobs, campaigns, agentEvents,
    assets, subscriptions, emails, audits, generations, creditTransactions
  ] = await Promise.all([
    prisma.device.findMany({
      where: { userId, ...(createdFilter ? { OR: [{ createdAt: createdFilter }, { lastSeenAt: createdFilter }] } : {}) },
      orderBy: { createdAt: 'desc' }, take,
      select: { id:true, deviceName:true, deviceId:true, appVersion:true, status:true, lastSeenAt:true, createdAt:true }
    }),
    prisma.socialConnection.findMany({
      where: { userId, ...(createdFilter ? { createdAt: createdFilter } : {}) },
      orderBy: { createdAt:'desc' }, take,
      select: { id:true, platform:true, displayName:true, accountType:true, status:true, connectedAt:true, lastSyncedAt:true, lastError:true, createdAt:true, updatedAt:true }
    }),
    prisma.connectedPage.findMany({
      where: { userId, ...(createdFilter ? { createdAt: createdFilter } : {}) },
      orderBy: { createdAt:'desc' }, take,
      select: { id:true, facebookPageName:true, status:true, connectedAt:true, lastSyncAt:true, lastError:true, createdAt:true, updatedAt:true }
    }),
    prisma.socialContent.findMany({
      where: { userId, ...(createdFilter ? { createdAt: createdFilter } : {}) },
      orderBy: { createdAt:'desc' }, take,
      select: {
        id:true,title:true,status:true,source:true,createdAt:true,updatedAt:true,
        publications: {
          orderBy: { createdAt:'desc' }, take: 20,
          select: {
            id:true,platform:true,status:true,scheduledAt:true,publishedAt:true,
            lastAttemptAt:true,lastError:true,createdAt:true,updatedAt:true,
            profile:{ select:{ displayName:true, username:true } }
          }
        }
      }
    }),
    prisma.scheduleJob.findMany({
      where: { userId, ...(createdFilter ? { createdAt: createdFilter } : {}) },
      orderBy: { createdAt:'desc' }, take,
      select: { id:true,contentType:true,title:true,status:true,origin:true,publishMode:true,scheduledAt:true,completedAt:true,errorMessage:true,createdAt:true,updatedAt:true }
    }),
    prisma.aiPostCampaign.findMany({
      where: { userId, ...(createdFilter ? { createdAt: createdFilter } : {}) },
      orderBy: { createdAt:'desc' }, take,
      select: { id:true,title:true,goal:true,contentMode:true,postCount:true,imagePostCount:true,status:true,createdAt:true,updatedAt:true }
    }),
    prisma.agentEvent.findMany({
      where: { userId, ...(createdFilter ? { createdAt: createdFilter } : {}) },
      orderBy: { createdAt:'desc' }, take,
      select: { id:true,type:true,status:true,title:true,message:true,createdAt:true }
    }),
    prisma.agentAsset.findMany({
      where: { userId, ...(createdFilter ? { createdAt: createdFilter } : {}) },
      orderBy: { createdAt:'desc' }, take,
      select: { id:true,kind:true,source:true,status:true,originalName:true,mimeType:true,generationChoice:true,qualityScore:true,createdAt:true,archivedAt:true }
    }),
    prisma.subscription.findMany({
      where: { userId, ...(createdFilter ? { createdAt: createdFilter } : {}) },
      orderBy: { createdAt:'desc' }, take,
      select: { id:true,plan:true,status:true,provider:true,currentPeriodStart:true,currentPeriodEnd:true,cancelAtPeriodEnd:true,lastPaymentFailedAt:true,createdAt:true,updatedAt:true }
    }),
    prisma.emailLog.findMany({
      where: { userId, ...(createdFilter ? { createdAt: createdFilter } : {}) },
      orderBy: { createdAt:'desc' }, take,
      select: { id:true,type:true,subject:true,status:true,errorMessage:true,createdAt:true }
    }),
    prisma.auditLog.findMany({
      where: {
        AND: [
          { OR: [{ userId }, { entity: 'User', entityId: userId }] },
          ...(createdFilter ? [{ createdAt: createdFilter }] : [])
        ]
      },
      orderBy: { createdAt:'desc' }, take,
      select: { id:true,userId:true,action:true,entity:true,entityId:true,metadata:true,ip:true,userAgent:true,createdAt:true,user:{select:{id:true,email:true,role:true}} }
    }),
    optionalRaw(
      'SELECT "id","contentType","status","provider","model","reservedCredits","creditsUsed","providerCostUsd","progress","errorCode","errorMessage","completedAt","createdAt","updatedAt" FROM "AiGeneration" WHERE "userId"=$1' + (validBefore ? ' AND "createdAt" < $2' : '') + ' ORDER BY "createdAt" DESC LIMIT ' + take,
      ...(validBefore ? [userId, validBefore] : [userId])
    ),
    optionalRaw(
      'SELECT "id","generationId","type","bucket","amount","balanceMonthly","balanceTopup","reference","metadataJson","createdAt" FROM "AiCreditTransaction" WHERE "userId"=$1' + (validBefore ? ' AND "createdAt" < $2' : '') + ' ORDER BY "createdAt" DESC LIMIT ' + take,
      ...(validBefore ? [userId, validBefore] : [userId])
    )
  ]);

  const events = [];
  const add = value => { if (value) events.push(value); };

  if (!validBefore) {
    add(event({
      id:'account:'+user.id, at:user.createdAt, category:'ACCOUNT', action:'ACCOUNT_CREATED',
      title:'Customer account created', detail:user.email, status:'SUCCESS', source:'User'
    }));
    if (user.emailVerifiedAt) add(event({
      id:'verified:'+user.id, at:user.emailVerifiedAt, category:'ACCOUNT', action:'EMAIL_VERIFIED',
      title:'Email address verified', detail:user.email, status:'SUCCESS', source:'User'
    }));
  }

  for (const row of devices) {
    add(event({
      id:'device:'+row.id, at:row.createdAt, category:'AUTH', action:'DEVICE_REGISTERED',
      title:'Device registered',
      detail:[row.deviceName || 'Device', row.appVersion ? 'App '+row.appVersion : null].filter(Boolean).join(' · '),
      status:row.status, source:'Device', metadata:{ deviceId:clean(row.deviceId,80) }
    }));
    if (row.lastSeenAt && new Date(row.lastSeenAt).getTime() !== new Date(row.createdAt).getTime()) {
      add(event({
        id:'device-seen:'+row.id+':'+iso(row.lastSeenAt), at:row.lastSeenAt, category:'AUTH', action:'DEVICE_ACTIVE',
        title:'Customer device active', detail:row.deviceName || 'Known device', status:'SUCCESS', source:'Device'
      }));
    }
  }

  for (const row of connections) {
    add(event({
      id:'connection:'+row.id, at:row.connectedAt || row.createdAt, category:'CONNECTIONS', action:'SOCIAL_CONNECTED',
      title:(row.platform || 'Social')+' account connected',
      detail:row.displayName || row.accountType || '', status:row.status, source:'SocialConnection'
    }));
    if (row.lastSyncedAt) add(event({
      id:'connection-sync:'+row.id+':'+iso(row.lastSyncedAt), at:row.lastSyncedAt, category:'CONNECTIONS', action:'SOCIAL_SYNCED',
      title:(row.platform || 'Social')+' account synced', detail:row.displayName || '', status:row.lastError?'ERROR':'SUCCESS',
      source:'SocialConnection', metadata:row.lastError?{error:clean(row.lastError,300)}:null
    }));
  }

  for (const row of pages) {
    add(event({
      id:'page:'+row.id, at:row.connectedAt || row.createdAt, category:'CONNECTIONS', action:'PAGE_CONNECTED',
      title:'Facebook page connected', detail:row.facebookPageName, status:row.status, source:'ConnectedPage'
    }));
    if (row.lastSyncAt) add(event({
      id:'page-sync:'+row.id+':'+iso(row.lastSyncAt), at:row.lastSyncAt, category:'CONNECTIONS', action:'PAGE_SYNCED',
      title:'Facebook page synced', detail:row.facebookPageName, status:row.lastError?'ERROR':'SUCCESS',
      source:'ConnectedPage', metadata:row.lastError?{error:clean(row.lastError,300)}:null
    }));
  }

  for (const content of contents) {
    add(event({
      id:'content:'+content.id, at:content.createdAt, category:'PUBLISHING', action:'CONTENT_CREATED',
      title:'Post content created', detail:content.title || content.source || 'Social content',
      status:content.status, source:'SocialContent', metadata:{ source:content.source }
    }));
    for (const pub of content.publications || []) {
      const profile = pub.profile?.displayName || pub.profile?.username || '';
      add(event({
        id:'pub:'+pub.id, at:pub.createdAt, category:'PUBLISHING', action:'PUBLICATION_CREATED',
        title:(pub.platform || 'Social')+' publication prepared', detail:profile, status:pub.status, source:'SocialPublication'
      }));
      if (pub.scheduledAt) add(event({
        id:'pub-scheduled:'+pub.id, at:pub.scheduledAt, category:'PUBLISHING', action:'POST_SCHEDULED',
        title:(pub.platform || 'Social')+' post scheduled', detail:profile, status:'SCHEDULED', source:'SocialPublication'
      }));
      if (pub.publishedAt) add(event({
        id:'pub-published:'+pub.id, at:pub.publishedAt, category:'PUBLISHING', action:'POST_PUBLISHED',
        title:(pub.platform || 'Social')+' post published', detail:profile, status:'SUCCESS', source:'SocialPublication'
      }));
      if (pub.lastError) add(event({
        id:'pub-error:'+pub.id+':'+iso(pub.updatedAt), at:pub.updatedAt, category:'ERROR', action:'PUBLISH_FAILED',
        title:(pub.platform || 'Social')+' publishing error', detail:clean(pub.lastError,500), status:'ERROR', source:'SocialPublication'
      }));
    }
  }

  for (const row of jobs) {
    add(event({
      id:'job:'+row.id, at:row.createdAt, category:'PUBLISHING', action:'PUBLISH_JOB_CREATED',
      title:'Publishing job created', detail:row.title || row.contentType || row.origin, status:row.status, source:'ScheduleJob',
      metadata:{ publishMode:row.publishMode, origin:row.origin }
    }));
    if (row.scheduledAt) add(event({
      id:'job-scheduled:'+row.id, at:row.scheduledAt, category:'PUBLISHING', action:'PUBLISH_JOB_SCHEDULED',
      title:'Publishing job scheduled', detail:row.title || row.contentType || '', status:'SCHEDULED', source:'ScheduleJob'
    }));
    if (row.completedAt) add(event({
      id:'job-complete:'+row.id, at:row.completedAt, category:row.errorMessage?'ERROR':'PUBLISHING',
      action:row.errorMessage?'PUBLISH_JOB_FAILED':'PUBLISH_JOB_COMPLETED',
      title:row.errorMessage?'Publishing job failed':'Publishing job completed',
      detail:row.errorMessage || row.title || row.contentType || '', status:row.errorMessage?'ERROR':'SUCCESS', source:'ScheduleJob'
    }));
  }

  for (const row of campaigns) add(event({
    id:'campaign:'+row.id, at:row.createdAt, category:'AI', action:'AI_CAMPAIGN_CREATED',
    title:'AI campaign created', detail:row.title,
    status:row.status, source:'AiPostCampaign',
    metadata:{ contentMode:row.contentMode, postCount:row.postCount, imagePostCount:row.imagePostCount, goal:clean(row.goal,120) }
  }));

  for (const row of agentEvents) add(event({
    id:'agent:'+row.id, at:row.createdAt, category:'AUTOMATION', action:row.type,
    title:row.title, detail:row.message, status:row.status, source:'AgentEvent'
  }));

  for (const row of assets) add(event({
    id:'asset:'+row.id, at:row.createdAt, category:'MEDIA',
    action:row.source === 'UPLOAD' ? 'MEDIA_UPLOADED' : 'MEDIA_CREATED',
    title:row.source === 'UPLOAD' ? 'Media uploaded' : 'Media generated',
    detail:row.originalName || row.kind || row.mimeType,
    status:row.archivedAt?'ARCHIVED':row.status, source:'AgentAsset',
    metadata:{ kind:row.kind, source:row.source, generationChoice:row.generationChoice, qualityScore:row.qualityScore }
  }));

  for (const row of subscriptions) {
    add(event({
      id:'sub:'+row.id, at:row.createdAt, category:'BILLING', action:'SUBSCRIPTION_CREATED',
      title:(row.plan || 'Plan')+' subscription created',
      detail:[row.provider,row.status].filter(Boolean).join(' · '), status:row.status, source:'Subscription'
    }));
    if (row.lastPaymentFailedAt) add(event({
      id:'sub-failed:'+row.id, at:row.lastPaymentFailedAt, category:'ERROR', action:'PAYMENT_FAILED',
      title:'Subscription payment failed', detail:row.plan || '', status:'ERROR', source:'Subscription'
    }));
    if (row.cancelAtPeriodEnd) add(event({
      id:'sub-cancel:'+row.id, at:row.updatedAt, category:'BILLING', action:'SUBSCRIPTION_CANCEL_SCHEDULED',
      title:'Subscription set to cancel', detail:row.currentPeriodEnd ? 'Ends '+iso(row.currentPeriodEnd) : row.plan, status:'WARNING', source:'Subscription'
    }));
  }

  for (const row of emails) add(event({
    id:'email:'+row.id, at:row.createdAt, category:'EMAIL', action:'EMAIL_'+clean(row.type || 'SENT',60).toUpperCase(),
    title:'Email '+String(row.status || 'queued').toLowerCase(),
    detail:row.subject, status:row.errorMessage?'ERROR':row.status, source:'EmailLog',
    metadata:row.errorMessage?{error:clean(row.errorMessage,300)}:{type:row.type}
  }));

  for (const row of audits) {
    const isAdminTargetAction = row.entity === 'User' && row.entityId === userId && row.userId !== userId;
    add(event({
      id:'audit:'+row.id, at:row.createdAt,
      category:isAdminTargetAction?'ADMIN':(String(row.action||'').includes('LOGIN')?'AUTH':'ACCOUNT'),
      action:row.action,
      title:isAdminTargetAction?'Administrator changed customer account':clean(row.action.replaceAll('_',' ').toLowerCase().replace(/\b\w/g, x=>x.toUpperCase()),180),
      detail:isAdminTargetAction ? ('By '+(row.user?.email || 'administrator')) : '',
      status:statusLevel(row.action), source:'AuditLog',
      metadata:{
        ...(publicAuditMetadata(row.metadata) || {}),
        ...(row.ip && String(row.action||'').includes('LOGIN') ? { ip:clean(row.ip,80) } : {})
      }
    }));
  }

  for (const row of generations) {
    const label = generationLabel(row.contentType);
    add(event({
      id:'generation:'+row.id, at:row.createdAt, category:'AI', action:'AI_GENERATION_STARTED',
      title:label+' generation started',
      detail:[row.provider,row.model].filter(Boolean).join(' · '), status:row.status, source:'AiGeneration',
      metadata:{ reservedCredits:Number(row.reservedCredits||0), progress:Number(row.progress||0) }
    }));
    if (row.completedAt) add(event({
      id:'generation-complete:'+row.id, at:row.completedAt,
      category:String(row.status||'').toUpperCase()==='FAILED'?'ERROR':'AI',
      action:String(row.status||'').toUpperCase()==='FAILED'?'AI_GENERATION_FAILED':'AI_GENERATION_COMPLETED',
      title:label+(String(row.status||'').toUpperCase()==='FAILED'?' generation failed':' generation completed'),
      detail:row.errorMessage || [row.provider,row.model].filter(Boolean).join(' · '),
      status:row.status, source:'AiGeneration',
      metadata:{ creditsUsed:Number(row.creditsUsed||0), providerCostUsd:Number(row.providerCostUsd||0), errorCode:row.errorCode||null }
    }));
  }

  for (const row of creditTransactions) {
    const amount = Number(row.amount || 0);
    add(event({
      id:'credit:'+row.id, at:row.createdAt, category:'CREDITS', action:row.type || 'CREDIT_TRANSACTION',
      title:amount < 0 ? 'AI credits used' : 'AI credits added',
      detail:(amount > 0 ? '+' : '')+amount+' credits · '+clean(row.bucket || '',80),
      status:amount < 0?'INFO':'SUCCESS', source:'AiCreditTransaction',
      metadata:{
        amount,
        balanceMonthly:Number(row.balanceMonthly||0),
        balanceTopup:Number(row.balanceTopup||0),
        generationId:row.generationId || null
      }
    }));
  }

  let filtered = events
    .filter(Boolean)
    .filter(item => !validBefore || new Date(item.at) < validBefore)
    .sort((a,b) => new Date(b.at) - new Date(a.at));

  if (category !== 'ALL') filtered = filtered.filter(item => item.category === category);

  const page = filtered.slice(0, limit);
  const nextCursor = filtered.length > limit && page.length ? page[page.length - 1].at : null;

  const summary = {
    totalVisible: page.length,
    errors: page.filter(item => item.status === 'ERROR' || item.category === 'ERROR').length,
    publishing: page.filter(item => item.category === 'PUBLISHING').length,
    ai: page.filter(item => ['AI','CREDITS','MEDIA','AUTOMATION'].includes(item.category)).length,
    lastActivityAt: page[0]?.at || iso(user.updatedAt) || iso(user.createdAt)
  };

  return {
    user: { id:user.id, name:user.name, email:user.email, status:user.status, createdAt:user.createdAt },
    categories:CATEGORIES,
    filter:{ category, before:validBefore ? validBefore.toISOString() : null, limit },
    summary,
    events:page,
    nextCursor
  };
}

module.exports = { customerActivity, CATEGORIES };
