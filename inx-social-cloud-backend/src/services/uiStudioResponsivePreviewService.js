'use strict';

const crypto = require('node:crypto');
const prisma = require('../db/prisma');
const uiStudioAnalysis = require('./uiStudioAnalysisService');
const previewBuild = require('./uiStudioPreviewBuildService');

const VIEWPORTS = Object.freeze({
  DESKTOP: { width: 1440, height: 900 },
  TABLET: { width: 834, height: 1112 },
  MOBILE: { width: 390, height: 844 }
});

const CACHE_TTL_MS = 15 * 60 * 1000;
const MAX_CACHE_ITEMS = 24;
const cache = new Map();

function publicError(message, status = 400, code = 'UI_STUDIO_RESPONSIVE_PREVIEW_ERROR') {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.publicMessage = message;
  return error;
}

function safeParse(value, fallback = null) {
  if (value == null) return fallback;
  if (typeof value === 'object') return value;
  try { return JSON.parse(String(value)); } catch (_) { return fallback; }
}

function normalizeViewport(value) {
  const viewport = String(value || '').trim().toUpperCase();
  if (!VIEWPORTS[viewport]) throw publicError('Unsupported responsive preview size.', 422, 'UI_STUDIO_RESPONSIVE_PREVIEW_VIEWPORT');
  return viewport;
}

function cacheGet(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  cache.delete(key);
  cache.set(key, entry);
  return entry;
}

function cacheSet(key, value) {
  cache.set(key, { ...value, createdAt: Date.now() });
  while (cache.size > MAX_CACHE_ITEMS) {
    cache.delete(cache.keys().next().value);
  }
}


function editorBridgeMarkup(viewport) {
  const safeViewport = JSON.stringify(String(viewport || 'DESKTOP'));
  return '<style id="ui-studio-editor-style">' +
    'html,body{overflow:auto!important;scrollbar-gutter:stable}' +
    'body.ui-studio-editor-selecting *{cursor:default!important}' +
    '#ui-studio-editor-hover,#ui-studio-editor-selected{position:fixed;pointer-events:none;display:none;box-sizing:border-box;z-index:2147483646}' +
    '#ui-studio-editor-hover{border:1px dashed #14b8a6;background:rgba(20,184,166,.035)}' +
    '#ui-studio-editor-selected{border:2px solid #14b8a6;background:rgba(20,184,166,.025);box-shadow:0 0 0 1px rgba(255,255,255,.9) inset}' +
    '#ui-studio-editor-label{position:fixed;display:none;pointer-events:none;z-index:2147483647;padding:3px 6px;border-radius:5px;background:#0f766e;color:#fff;font:600 10px/1.2 system-ui,sans-serif;white-space:nowrap}' +
    '</style>' +
    '<script>(function(){' +
      '"use strict";' +
      'var MODE="SELECT";var selected=null;var originals=new Map();' +
      'var hover=document.createElement("div");hover.id="ui-studio-editor-hover";' +
      'var outline=document.createElement("div");outline.id="ui-studio-editor-selected";' +
      'var label=document.createElement("div");label.id="ui-studio-editor-label";' +
      'function mount(){if(!hover.isConnected)document.body.appendChild(hover);if(!outline.isConnected)document.body.appendChild(outline);if(!label.isConnected)document.body.appendChild(label);}' +
      'function post(type,payload){try{parent.postMessage(Object.assign({type:type,viewport:' + safeViewport + '},payload||{}),"*");}catch(_){}}' +
      'function escIdent(value){return String(value||"").replace(/([^a-zA-Z0-9_-])/g,"\\\\$1");}' +
      'function pathFor(el){var parts=[];var node=el;while(node&&node.nodeType===1&&node!==document.documentElement){var part=node.tagName.toLowerCase();if(node.id&&/^[A-Za-z][A-Za-z0-9_-]*$/.test(node.id)){part+="#"+escIdent(node.id);parts.unshift(part);break;}var p=node.parentElement;if(p){var same=Array.prototype.filter.call(p.children,function(x){return x.tagName===node.tagName;});if(same.length>1)part+=":nth-of-type("+(same.indexOf(node)+1)+")";}parts.unshift(part);node=p;}return parts.join(" > ");}' +
      'function find(path){try{return document.querySelector(path);}catch(_){return null;}}' +
      'function interactiveTarget(target){if(!(target instanceof Element))return null;return target.closest("button,a,[role=button],input,textarea,select")||target.closest("h1,h2,h3,h4,h5,h6,p,span,label,li,img,video,section,article,div");}' +
      'function editableText(el){if(!el||["IMG","VIDEO","INPUT","TEXTAREA","SELECT"].includes(el.tagName))return false;return el.children.length===0;}' +
      'function textOf(el){if(!el||["IMG","VIDEO"].includes(el.tagName))return "";return String(el.innerText||el.textContent||"").trim().slice(0,1200);}' +
      'function describe(el){var s=getComputedStyle(el);var r=el.getBoundingClientRect();var path=pathFor(el);return {nodeId:path,nodePath:path,tagName:el.tagName.toLowerCase(),role:el.getAttribute("role")||"",text:textOf(el),editableText:editableText(el),href:el.tagName==="A"?(el.getAttribute("href")||""):"",styles:{color:s.color,backgroundColor:s.backgroundColor,fontSize:s.fontSize,fontWeight:s.fontWeight,lineHeight:s.lineHeight,borderRadius:s.borderRadius,padding:s.padding,textAlign:s.textAlign},rect:{x:r.x,y:r.y,width:r.width,height:r.height},className:typeof el.className==="string"?el.className.slice(0,500):""};}' +
      'function draw(box,el,withLabel){if(!el){box.style.display="none";if(withLabel)label.style.display="none";return;}var r=el.getBoundingClientRect();box.style.display="block";box.style.left=r.left+"px";box.style.top=r.top+"px";box.style.width=r.width+"px";box.style.height=r.height+"px";if(withLabel){label.textContent=(el.tagName||"").toLowerCase();label.style.display="block";label.style.left=Math.max(2,r.left)+"px";label.style.top=Math.max(2,r.top-18)+"px";}}' +
      'function select(el){selected=el;draw(outline,selected,true);post("ui-studio-editor-selected",{element:describe(el)});}' +
      'function remember(el,path){if(originals.has(path))return;originals.set(path,{text:textOf(el),style:el.getAttribute("style"),href:el.getAttribute("href")});}' +
      'function setText(el,value){var wanted=String(value==null?"":value);var textNode=null;for(var i=0;i<el.childNodes.length;i++){if(el.childNodes[i].nodeType===Node.TEXT_NODE&&String(el.childNodes[i].nodeValue||"").trim()){textNode=el.childNodes[i];break;}}if(textNode){textNode.nodeValue=wanted;}else if(el.children.length===0){el.textContent=wanted;}else{var walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);var n=walker.nextNode();if(n)n.nodeValue=wanted;}}' +
      'function applyOne(edit){if(!edit||!edit.nodePath)return;var el=find(edit.nodePath);if(!el)return;remember(el,edit.nodePath);var changes=edit.changes||edit;if(Object.prototype.hasOwnProperty.call(changes,"text"))setText(el,changes.text);if(Object.prototype.hasOwnProperty.call(changes,"href")&&el.tagName==="A")el.setAttribute("href",String(changes.href||"#"));var styles=changes.styles||{};["color","backgroundColor","fontSize","fontWeight","lineHeight","borderRadius","padding","textAlign"].forEach(function(k){if(Object.prototype.hasOwnProperty.call(styles,k))el.style[k]=String(styles[k]||"");});if(selected===el)select(el);}' +
      'function resetOne(path){var el=find(path);var original=originals.get(path);if(!el||!original)return;if(original.style==null)el.removeAttribute("style");else el.setAttribute("style",original.style);if(el.tagName==="A"){if(original.href==null)el.removeAttribute("href");else el.setAttribute("href",original.href);}setText(el,original.text);originals.delete(path);if(selected===el)select(el);}' +
      'document.addEventListener("mousemove",function(e){if(MODE!=="SELECT")return;var el=interactiveTarget(e.target);if(el&&el!==hover&&el!==outline&&el!==label)draw(hover,el,false);},true);' +
      'document.addEventListener("mouseleave",function(){draw(hover,null,false);},true);' +
      'document.addEventListener("click",function(e){if(MODE!=="SELECT")return;var el=interactiveTarget(e.target);if(!el)return;e.preventDefault();e.stopPropagation();select(el);},true);' +
      'document.addEventListener("dblclick",function(e){if(MODE!=="SELECT")return;var el=interactiveTarget(e.target);if(!el||!editableText(el))return;e.preventDefault();e.stopPropagation();select(el);el.setAttribute("contenteditable","true");el.focus();try{document.execCommand("selectAll",false,null);}catch(_){}} ,true);' +
      'document.addEventListener("input",function(e){if(MODE!=="SELECT")return;var el=e.target;if(!(el instanceof Element)||el.getAttribute("contenteditable")!=="true")return;var path=pathFor(el);post("ui-studio-editor-inline-edit",{element:describe(el),edit:{nodeId:path,nodePath:path,text:textOf(el)}});draw(outline,el,true);},true);' +
      'document.addEventListener("blur",function(e){var el=e.target;if(el instanceof Element&&el.getAttribute("contenteditable")==="true")el.removeAttribute("contenteditable");},true);' +
      'window.addEventListener("scroll",function(){draw(hover,null,false);if(selected)draw(outline,selected,true);},true);' +
      'window.addEventListener("resize",function(){if(selected)draw(outline,selected,true);});' +
      'window.addEventListener("message",function(e){var d=e.data||{};if(d.type==="ui-studio-editor-mode"){MODE=d.mode==="PAN"?"PAN":(d.mode==="INTERACT"?"INTERACT":"SELECT");document.body.classList.toggle("ui-studio-editor-selecting",MODE==="SELECT");draw(hover,null,false);if(MODE!=="SELECT"){draw(outline,null,true);}else if(selected){draw(outline,selected,true);}return;}if(d.type==="ui-studio-editor-update"){applyOne(d.edit);return;}if(d.type==="ui-studio-editor-batch"){(d.edits||[]).forEach(applyOne);return;}if(d.type==="ui-studio-editor-reset"){resetOne(d.nodePath);return;}if(d.type==="ui-studio-editor-clear-selection"){selected=null;draw(outline,null,true);return;}});' +
      'function ready(){mount();document.body.classList.add("ui-studio-editor-selecting");post("ui-studio-editor-ready",{documentHeight:Math.max(document.documentElement.scrollHeight,document.body.scrollHeight),documentWidth:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)});}' +
      'if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){setTimeout(ready,80);});else setTimeout(ready,80);' +
    '})();</script>';
}

function injectEditorBridge(html, viewport) {
  const markup = editorBridgeMarkup(viewport);
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, markup + '</body>');
  return html + markup;
}

async function previewContent(projectId, viewportValue) {
  const id = String(projectId || '').trim();
  const viewport = normalizeViewport(viewportValue);

  const project = await prisma.uiDesignProject.findUnique({
    where: { id },
    include: {
      references: { orderBy: { createdAt: 'desc' }, take: 100 },
      analyses: { orderBy: { createdAt: 'desc' }, take: 20 },
      generations: { orderBy: { createdAt: 'desc' }, take: 20 }
    }
  });
  if (!project) throw publicError('UI Studio project was not found.', 404, 'UI_STUDIO_PROJECT_NOT_FOUND');

  const references = uiStudioAnalysis.latestReferences(project.references || []);
  const fingerprint = uiStudioAnalysis.fingerprintReferences(references);
  const analysis = (project.analyses || []).find(item =>
    item.status === 'COMPLETED' &&
    item.sourceFingerprint === fingerprint &&
    item.analysisJson
  );
  if (!analysis) {
    throw publicError('Design analysis is not ready yet.', 409, 'UI_STUDIO_RESPONSIVE_PREVIEW_ANALYSIS_REQUIRED');
  }

  const generation = (project.generations || []).find(item =>
    ['READY','READY_WITH_WARNINGS'].includes(item.status) &&
    item.sourceFingerprint === fingerprint &&
    item.sourceAnalysisId === analysis.id &&
    item.generationJson
  );
  if (!generation) {
    const running = (project.generations || []).find(item =>
      item.status === 'RUNNING' &&
      item.sourceFingerprint === fingerprint &&
      item.sourceAnalysisId === analysis.id
    );
    if (running) throw publicError('Responsive preview is still being prepared.', 409, 'UI_STUDIO_RESPONSIVE_PREVIEW_RUNNING');
    throw publicError('Responsive preview has not been generated yet.', 409, 'UI_STUDIO_RESPONSIVE_PREVIEW_GENERATION_REQUIRED');
  }

  const dims = VIEWPORTS[viewport];
  const cacheKey = [generation.id, generation.updatedAt?.toISOString?.() || String(generation.updatedAt), viewport].join(':');
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const result = safeParse(generation.generationJson, null);
  if (!result) throw publicError('Responsive preview source is missing.', 422, 'UI_STUDIO_RESPONSIVE_PREVIEW_SOURCE_MISSING');

  const baseHtml = await previewBuild.buildPreviewHtml(result, project, dims.width, dims.height, {});
  const html = injectEditorBridge(baseHtml, viewport);
  const data = Buffer.from(html, 'utf8');
  const etag = '"' + crypto.createHash('sha256').update(data).digest('hex') + '"';
  const response = {
    data,
    etag,
    width: dims.width,
    height: dims.height,
    viewport,
    generationId: generation.id
  };
  cacheSet(cacheKey, response);
  return response;
}

module.exports = {
  VIEWPORTS,
  editorBridgeMarkup,
  injectEditorBridge,
  previewContent
};
