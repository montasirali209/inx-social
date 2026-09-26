'use strict';

const crypto = require('node:crypto');
const axios = require('axios');
const prisma = require('../db/prisma');
const env = require('../config/env');
const webResearch = require('./webResearchService');
const emailService = require('./emailService');

const STATE_KEY = 'growth_authority_autopilot_state_v1';
const TYPES = ['REDDIT','QUORA','COMMUNITY','RESOURCE_PAGE','COMPARISON','BROKEN_LINK','DIRECTORY','PARTNER','JOURNALIST_REQUEST','PUBLICATION','UNLINKED_MENTION','COMPETITOR_BACKLINK','AI_CITATION_SOURCE'];
const TERMINAL = new Set(['DISMISSED','LINK_ACQUIRED','MENTION_ACQUIRED','AI_CITED']);
const AUTO_EMAIL_LIMIT = 2;

const nowIso = () => new Date().toISOString();
const safeJson = (v,f=null) => { try { return v ? JSON.parse(v) : f; } catch (_) { return f; } };
const clamp = (v,f,min,max) => Number.isFinite(Number(v)) ? Math.max(min,Math.min(max,Number(v))) : f;
const safeUrl = v => { try { const u=new URL(String(v||'').trim()); return ['http:','https:'].includes(u.protocol)?u.toString():''; } catch(_){ return ''; } };
const domainOf = v => { try { return new URL(String(v||'')).hostname.toLowerCase().replace(/^www\./,''); } catch(_){ return ''; } };
const own = v => domainOf(v)==='inxsocial.co.uk' || domainOf(v).endsWith('.inxsocial.co.uk');
const idFor = (type,url) => crypto.createHash('sha256').update(type+'|'+url.toLowerCase().replace(/\/$/,'')).digest('hex').slice(0,20);

function providerStatus(){
  return {
    liveResearch:Boolean(env.webResearch?.apiKey&&env.webResearch?.baseUrl&&env.webResearch?.model),
    writer:Boolean(env.contentWriter?.apiKey&&env.contentWriter?.baseUrl&&env.contentWriter?.model),
    writerModel:env.contentWriter?.model||null,
    email:emailService.isConfigured(),
    communityPosting:false,
    note:'Community posting remains approval-gated because no compliant Reddit/Quora publishing connector is configured.'
  };
}

function summarize(items=[]){
  return {
    total:items.filter(x=>!TERMINAL.has(x.status)).length,
    communities:items.filter(x=>['REDDIT','QUORA','COMMUNITY'].includes(x.type)&&x.status!=='DISMISSED').length,
    backlinkProspects:items.filter(x=>['RESOURCE_PAGE','COMPARISON','BROKEN_LINK','DIRECTORY','PARTNER','PUBLICATION','COMPETITOR_BACKLINK','AI_CITATION_SOURCE'].includes(x.type)&&x.status!=='DISMISSED').length,
    outreachDrafts:items.filter(x=>x.draft?.communityReply||x.draft?.outreachBody).length,
    approved:items.filter(x=>x.status==='APPROVED').length,
    sent:items.filter(x=>['SENT','FOLLOWED_UP'].includes(x.status)).length,
    posted:items.filter(x=>x.status==='POSTED').length,
    acquiredLinks:items.filter(x=>x.status==='LINK_ACQUIRED').length,
    mentions:items.filter(x=>x.status==='MENTION_ACQUIRED').length,
    aiCitations:items.filter(x=>x.status==='AI_CITED').length,
    dismissed:items.filter(x=>x.status==='DISMISSED').length
  };
}

function blankState(){
  return {phase:4,generatedAt:null,lastRunStartedAt:null,lastRunFinishedAt:null,lastError:null,warnings:[],provider:providerStatus(),prospects:[],stats:summarize([])};
}

async function readState(){
  const row=await prisma.appSetting.findUnique({where:{key:STATE_KEY}});
  const saved=safeJson(row?.value,null);
  return saved?{...blankState(),...saved,provider:providerStatus(),prospects:Array.isArray(saved.prospects)?saved.prospects:[],stats:{...summarize([]),...(saved.stats||{})}}:blankState();
}

async function writeState(state){
  const value={...blankState(),...state,provider:providerStatus(),prospects:(state.prospects||[]).slice(0,250)};
  value.stats=summarize(value.prospects);
  await prisma.appSetting.upsert({
    where:{key:STATE_KEY},
    create:{key:STATE_KEY,value:JSON.stringify(value),description:'INXSocial Phase 4 Authority + Community Autopilot state.'},
    update:{value:JSON.stringify(value),description:'INXSocial Phase 4 Authority + Community Autopilot state.'}
  });
  return value;
}

function discoverySchema(){
  return {type:'object',additionalProperties:false,required:['prospects'],properties:{prospects:{type:'array',maxItems:18,items:{
    type:'object',additionalProperties:false,
    required:['title','url','type','score','reason','relevantPage','contactKind','contactValue','contactSourceUrl','communityRulesNote'],
    properties:{
      title:{type:'string'},url:{type:'string'},type:{type:'string',enum:TYPES},score:{type:'integer',minimum:0,maximum:100},
      reason:{type:'string'},relevantPage:{type:'string'},contactKind:{type:'string',enum:['EMAIL','URL','NONE']},
      contactValue:{type:'string'},contactSourceUrl:{type:'string'},communityRulesNote:{type:'string'}
    }
  }}}};
}

function normalizeCandidate(x){
  const url=safeUrl(x?.url); const type=TYPES.includes(String(x?.type||'').toUpperCase())?String(x.type).toUpperCase():'COMMUNITY';
  if(!url||own(url))return null;
  let relevantPage=safeUrl(x?.relevantPage); if(!relevantPage||!own(relevantPage)) relevantPage='https://www.inxsocial.co.uk';
  let kind=['EMAIL','URL','NONE'].includes(String(x?.contactKind||'').toUpperCase())?String(x.contactKind).toUpperCase():'NONE';
  let value=String(x?.contactValue||'').trim().slice(0,320);
  if(kind==='URL') value=safeUrl(value);
  if(kind==='EMAIL'&&!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) value='';
  if(!value) kind='NONE';
  return {
    id:idFor(type,url),title:String(x?.title||domainOf(url)).replace(/\s+/g,' ').trim().slice(0,240),url,domain:domainOf(url),type,
    score:Math.round(clamp(x?.score,50,0,100)),reason:String(x?.reason||'').replace(/\s+/g,' ').trim().slice(0,700),relevantPage,
    contact:{kind,value,sourceUrl:safeUrl(x?.contactSourceUrl)},communityRulesNote:String(x?.communityRulesNote||'').replace(/\s+/g,' ').trim().slice(0,500),
    validation:null,draft:null,status:'QUALIFIED',discoveredAt:nowIso(),lastSeenAt:nowIso(),approvedAt:null,executedAt:null,nextFollowUpAt:null,
    outcomeNote:null,metrics:{votes:0,replies:0,clicks:0,mentions:0},publishedUrl:null
  };
}

function mergeProspects(oldItems,newItems){
  const map=new Map((oldItems||[]).map(x=>[x.id,x]));
  for(const item of newItems||[]){
    const old=map.get(item.id);
    map.set(item.id,old?{...item,...old,score:Math.max(old.score||0,item.score||0),reason:item.reason||old.reason,lastSeenAt:nowIso(),contact:old.contact?.value?old.contact:item.contact}:item);
  }
  return [...map.values()].sort((a,b)=>(TERMINAL.has(a.status)?1:0)-(TERMINAL.has(b.status)?1:0)||(b.score||0)-(a.score||0)).slice(0,250);
}

async function discoverProspects(http=axios){
  if(!providerStatus().liveResearch) throw new Error('Live web research is not configured for Phase 4 authority discovery.');
  const request={
    model:env.webResearch.model,
    instructions:'Use live web search. Return only verifiable current public opportunities. Never invent URLs, contact details, community rules, mentions, or backlink claims. Prefer legitimate relevance over volume.',
    input:[
      'Find current authority opportunities for INXSocial, an AI social media management, scheduling, campaign-generation and UGC-ad platform.',
      'Cover recent Reddit/Quora/community questions, competitor backlink sources, resource/comparison pages, unlinked INXSocial mentions, broken-link replacements, directories, partners, journalist requests, relevant publications, and sites repeatedly cited by AI/search answers for social-media-management topics.',
      'For communities prefer active problem-solving/buyer-intent threads and note obvious promotion/link rules. For outreach only return an email when current public evidence explicitly shows it; otherwise use a contact page URL or NONE.',
      'relevantPage must be an existing https://www.inxsocial.co.uk URL. Score 0-100 for realistic usefulness and authority value.'
    ].join(' '),
    tools:[{type:'web_search',external_web_access:true,user_location:{type:'approximate',country:env.webResearch.country||'GB',timezone:'Europe/London'}}],
    tool_choice:'required',include:['web_search_call.action.sources'],
    text:{format:{type:'json_schema',name:'inx_phase4_authority_discovery',strict:true,schema:discoverySchema()}}
  };
  if(/^gpt-5(?:\.|-)/i.test(env.webResearch.model)) request.reasoning={effort:'medium'};
  const response=await http.post(env.webResearch.baseUrl.replace(/\/$/,'')+'/responses',request,{timeout:120000,headers:{Authorization:'Bearer '+env.webResearch.apiKey,'Content-Type':'application/json'}});
  const parsed=safeJson(webResearch.extractResponseText(response.data),{prospects:[]});
  const sources=webResearch.extractResponseSources(response.data).map(x=>safeUrl(x.url)).filter(Boolean);
  const sourceDomains=new Set(sources.map(domainOf));
  return (parsed.prospects||[]).map(normalizeCandidate).filter(Boolean).filter(x=>sources.includes(x.url)||sourceDomains.has(x.domain)).slice(0,18);
}

async function validateProspect(item,http=axios){
  try{
    const r=await http.get(item.url,{timeout:9000,maxRedirects:5,maxContentLength:300000,headers:{'User-Agent':'INXSocial-AuthorityResearch/1.0'},validateStatus:()=>true});
    const body=typeof r.data==='string'?r.data.slice(0,250000):'';
    return {checkedAt:nowIso(),status:r.status,reachable:r.status>=200&&r.status<400,archived:['REDDIT','QUORA','COMMUNITY'].includes(item.type)&&/\b(archived|locked|comments are locked|thread is locked)\b/i.test(body),duplicateEngagement:['APPROVED','SENT','FOLLOWED_UP','POSTED'].includes(item.status)};
  }catch(e){return {checkedAt:nowIso(),status:0,reachable:false,archived:false,duplicateEngagement:false,note:String(e.message||e).slice(0,240)};}
}

function draftSchema(ids){
  return {type:'object',additionalProperties:false,required:['drafts'],properties:{drafts:{type:'array',maxItems:ids.length,items:{
    type:'object',additionalProperties:false,required:['id','communityReply','outreachSubject','outreachBody','followUpBody','safetyNotes'],
    properties:{id:{type:'string',enum:ids},communityReply:{type:'string'},outreachSubject:{type:'string'},outreachBody:{type:'string'},followUpBody:{type:'string'},safetyNotes:{type:'string'}}
  }}}};
}

async function draftForProspects(items,http=axios){
  const candidates=items.filter(x=>x.score>=65&&x.status==='QUALIFIED'&&!x.draft&&x.validation?.reachable!==false&&!x.validation?.archived).slice(0,6);
  if(!candidates.length||!providerStatus().writer)return [];
  const ids=candidates.map(x=>x.id);
  const request={
    model:env.contentWriter.model,
    instructions:[
      'Draft transparent authority engagement for INXSocial. Never fabricate experience, metrics, endorsements, relationships, discounts or product capabilities.',
      'Community replies must answer the person first, be useful without mentioning INXSocial, avoid marketing language, and include no link unless necessary. If INXSocial is mentioned, transparently disclose the affiliation. If rules discourage self-promotion, write a purely helpful reply with no product mention.',
      'Outreach email must be short, page-specific, respectful and non-manipulative with one optional ask. Do not imply an existing relationship, use fake urgency or request paid links. Also write one brief follow-up usable once after five days.',
      'Return empty outreach fields for community-only prospects and empty communityReply for outreach-only prospects.'
    ].join(' '),
    input:JSON.stringify(candidates.map(x=>({id:x.id,title:x.title,url:x.url,type:x.type,reason:x.reason,relevantPage:x.relevantPage,communityRulesNote:x.communityRulesNote,contact:x.contact}))),
    text:{format:{type:'json_schema',name:'inx_phase4_authority_drafts',strict:true,schema:draftSchema(ids)}}
  };
  if(/^gpt-5(?:\.|-)/i.test(env.contentWriter.model)) request.reasoning={effort:env.contentWriter.reasoningEffort||'high'};
  const response=await http.post(env.contentWriter.baseUrl.replace(/\/$/,'')+'/responses',request,{timeout:120000,headers:{Authorization:'Bearer '+env.contentWriter.apiKey,'Content-Type':'application/json'}});
  const parsed=safeJson(webResearch.extractResponseText(response.data),{drafts:[]});
  return (parsed.drafts||[]).filter(x=>ids.includes(x.id)).map(x=>({
    id:x.id,communityReply:String(x.communityReply||'').trim().slice(0,3000),outreachSubject:String(x.outreachSubject||'').trim().slice(0,180),
    outreachBody:String(x.outreachBody||'').trim().slice(0,5000),followUpBody:String(x.followUpBody||'').trim().slice(0,3500),
    safetyNotes:String(x.safetyNotes||'').trim().slice(0,700),generatedAt:nowIso(),writerModel:env.contentWriter.model
  }));
}

async function executeApprovedEmails(items,enabled){
  if(!enabled)return {items,sent:0,followedUp:0};
  let sent=0,followedUp=0; const out=[];
  for(const x of items){
    if(sent+followedUp>=AUTO_EMAIL_LIMIT){out.push(x);continue;}
    try{
      if(x.status==='SENT'&&x.nextFollowUpAt&&new Date(x.nextFollowUpAt).getTime()<=Date.now()&&x.contact?.kind==='EMAIL'&&x.draft?.followUpBody&&emailService.isConfigured()){
        await emailService.sendAuthorityOutreach({to:x.contact.value,subject:'Re: '+String(x.draft.outreachSubject||'INXSocial').slice(0,170),body:x.draft.followUpBody});
        followedUp++;out.push({...x,status:'FOLLOWED_UP',executedAt:nowIso(),nextFollowUpAt:null,outcomeNote:'One approved follow-up was sent automatically after five days.'});continue;
      }
      if(x.status==='APPROVED'&&x.contact?.kind==='EMAIL'&&x.contact?.value&&x.draft?.outreachSubject&&x.draft?.outreachBody&&emailService.isConfigured()){
        await emailService.sendAuthorityOutreach({to:x.contact.value,subject:x.draft.outreachSubject,body:x.draft.outreachBody});
        sent++;out.push({...x,status:'SENT',executedAt:nowIso(),nextFollowUpAt:new Date(Date.now()+5*24*60*60*1000).toISOString(),outcomeNote:'Approved outreach sent through the configured INXSocial email provider.'});continue;
      }
    }catch(e){out.push({...x,outcomeNote:'Approved outreach send failed: '+String(e.message||e).slice(0,300)});continue;}
    out.push(x);
  }
  return {items:out,sent,followedUp};
}

async function audit(action,meta){
  try{await prisma.auditLog.create({data:{userId:null,action,entity:'GrowthAuthorityAutopilot',entityId:'primary',metadata:JSON.stringify(meta||{})}});}catch(e){console.warn('[growth-authority] audit log failed',{error:e?.message});}
}

async function run(options={}){
  const state=await readState(),warnings=[]; let found=[];
  try{found=await discoverProspects(options.http||axios);}catch(e){warnings.push('Discovery: '+String(e.message||e).slice(0,500));}
  let prospects=mergeProspects(state.prospects,found);
  for(const target of prospects.filter(x=>!TERMINAL.has(x.status)).slice(0,10)){
    const i=prospects.findIndex(x=>x.id===target.id); if(i>=0) prospects[i]={...prospects[i],validation:await validateProspect(prospects[i],options.http||axios)};
  }
  try{const drafts=await draftForProspects(prospects,options.http||axios),map=new Map(drafts.map(x=>[x.id,x]));prospects=prospects.map(x=>map.has(x.id)?{...x,draft:map.get(x.id)}:x);}catch(e){warnings.push('Drafting: '+String(e.message||e).slice(0,500));}
  const execution=await executeApprovedEmails(prospects,options.autoEmail===true); prospects=execution.items;
  const saved=await writeState({...state,generatedAt:nowIso(),lastRunStartedAt:nowIso(),lastRunFinishedAt:nowIso(),lastError:null,warnings,prospects});
  await audit('GROWTH_PHASE4_AUTHORITY_CYCLE',{discovered:found.length,total:saved.stats.total,drafts:saved.stats.outreachDrafts,emailsSent:execution.sent,followUpsSent:execution.followedUp,warnings:warnings.length});
  return saved;
}

const metricValue=v=>Math.max(0,Math.round(clamp(v,0,0,100000000)));
async function updateProspect(id,action,input={}){
  const state=await readState(),i=state.prospects.findIndex(x=>x.id===id);
  if(i<0)throw Object.assign(new Error('Authority prospect not found.'),{status:404});
  let x={...state.prospects[i]},at=nowIso();
  if(action==='approve'){if(!x.draft?.communityReply&&!x.draft?.outreachBody)throw Object.assign(new Error('This prospect has no reviewed draft to approve.'),{status:409});x.status='APPROVED';x.approvedAt=at;}
  else if(action==='dismiss')x.status='DISMISSED';
  else if(action==='posted'){x.status='POSTED';x.executedAt=at;x.publishedUrl=safeUrl(input.publishedUrl)||x.url;}
  else if(action==='sent'){x.status='SENT';x.executedAt=at;}
  else if(action==='link_acquired'){x.status='LINK_ACQUIRED';x.publishedUrl=safeUrl(input.publishedUrl)||x.url;}
  else if(action==='mention_acquired'){x.status='MENTION_ACQUIRED';x.publishedUrl=safeUrl(input.publishedUrl)||x.url;}
  else if(action==='ai_cited'){x.status='AI_CITED';x.publishedUrl=safeUrl(input.publishedUrl)||x.url;}
  else if(action==='no_response')x.status='NO_RESPONSE';
  else if(action!=='metrics')throw Object.assign(new Error('Unsupported authority prospect action.'),{status:400});
  if(input.metrics)x.metrics={votes:metricValue(input.metrics.votes),replies:metricValue(input.metrics.replies),clicks:metricValue(input.metrics.clicks),mentions:metricValue(input.metrics.mentions)};
  if(input.note)x.outcomeNote=String(input.note).slice(0,700);
  state.prospects[i]=x; const saved=await writeState({...state,generatedAt:at});
  await audit('GROWTH_PHASE4_PROSPECT_'+action.toUpperCase(),{prospectId:id,type:x.type,domain:x.domain,status:x.status});
  return saved;
}

module.exports={STATE_KEY,TYPES,providerStatus,status:readState,run,updateProspect,discoverProspects,validateProspect,draftForProspects,mergeProspects,normalizeCandidate,summarize};
