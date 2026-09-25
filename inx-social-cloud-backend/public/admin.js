const state={user:null,users:[],selectedUser:null,recentUsers:[],administrators:[],searchConsole:null,ugcAvatars:[],timer:null};
const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const initials=value=>String(value||'IN').trim().split(/\s+/).slice(0,2).map(part=>part[0]).join('').toUpperCase();
const fmtDate=value=>value?new Date(value).toLocaleString():'—';
const relative=value=>{if(!value)return'—';const seconds=Math.max(0,Math.floor((Date.now()-new Date(value).getTime())/1000));if(seconds<60)return'Just now';if(seconds<3600)return`${Math.floor(seconds/60)}m ago`;if(seconds<86400)return`${Math.floor(seconds/3600)}h ago`;return`${Math.floor(seconds/86400)}d ago`};
const planOf=user=>user.effectivePlan||user.commercialAccess?.effectivePlan||user.subscriptions?.[0]?.plan||'TRIAL';
const badge=value=>`<span class="badge ${esc(value)}">${esc(String(value).replaceAll('_',' '))}</span>`;
function toast(message){const element=$('toast');element.textContent=message;element.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>element.classList.remove('show'),4000)}
function clearSession(){clearInterval(state.timer);state.user=null;state.users=[];state.administrators=[];$('notificationPanel')?.classList.add('hidden');setLoggedIn(false)}
async function signOut(){try{await fetch('/api/admin-auth/logout',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'}})}catch{}finally{clearSession()}}
async function api(path,options={}){const headers={'Content-Type':'application/json',...(options.headers||{})};const response=await fetch(path,{...options,headers,credentials:'same-origin'});const data=await response.json().catch(()=>({}));if(response.status===401){clearSession();throw new Error(data.error||'Your administrator session has ended.')}if(!response.ok)throw new Error(data.error||`Request failed: ${response.status}`);return data}
function setLoggedIn(on){$('loginView').classList.toggle('hidden',on);$('dashboardView').classList.toggle('hidden',!on);if(on){const name=state.user?.name||'INXSocial Admin';$('adminName').textContent=name;$('adminEmail').textContent=`${state.user?.email||''}${state.user?.role?` · ${state.user.role.replace('_',' ')}`:''}`;$('adminInitials').textContent=initials(name)}}
const pageMeta={overview:['Overview','Monitor new customers and service activity.'],users:['Customers','Provision customer accounts and control live entitlements.'],aiAccess:['AI & Automation','Manage AI Studio policy, Social Agent allowances and generation infrastructure.'],searchConsole:['Search Console','Monitor Google Search visibility, queries, landing pages and SEO opportunities.'],settings:['System Settings','Review and update allowlisted live configuration.'],security:['Admin & Security','Manage administrator access, credentials and audit activity.']};
async function openPage(page){document.querySelectorAll('.nav').forEach(button=>button.classList.toggle('active',button.dataset.page===page));document.querySelectorAll('.page').forEach(section=>section.classList.toggle('hidden',section.id!==`${page}Page`));$('pageTitle').textContent=pageMeta[page][0];$('pageSubtitle').textContent=pageMeta[page][1];if(page==='overview')await loadOverview();if(page==='users')await loadUsers();if(page==='aiAccess')await loadAiAccess();if(page==='searchConsole')await loadSearchConsole();if(page==='settings')await loadSettings();if(page==='security')await loadSecurity()}
document.querySelectorAll('.nav').forEach(button=>button.addEventListener('click',()=>void openPage(button.dataset.page)));
document.querySelectorAll('[data-open-page]').forEach(button=>button.addEventListener('click',()=>void openPage(button.dataset.openPage)));
$('loginForm').addEventListener('submit',async event=>{event.preventDefault();$('loginError').textContent='';try{const data=await api('/api/admin-auth/login',{method:'POST',body:JSON.stringify({email:$('email').value.trim(),password:$('password').value})});state.user=data.user;setLoggedIn(true);$('password').value='';await postAuthLanding();state.timer=setInterval(()=>loadOverview(true).catch(()=>{}),15000)}catch(error){$('loginError').textContent=error.message}});
$('logoutBtn').addEventListener('click',()=>void signOut());

function renderRecent(users){const html=users.map(user=>`<div class="activity-item"><span class="avatar">${esc(initials(user.name||user.email))}</span><div><b>${esc(user.name||'New customer')}</b><small>${esc(user.email)} · ${esc(planOf(user))} · ${user.emailVerifiedAt?'Verified':'Verification pending'}</small></div><time>${relative(user.createdAt)}</time></div>`).join('');$('recentUsers').innerHTML=html||'<p>No customer registrations yet.</p>';$('notificationList').innerHTML=html||'<p>No recent registrations.</p>'}
async function loadOverview(silent=false){const {overview}=await api('/api/admin/overview');state.recentUsers=overview.recentUsers||[];const items=[['Customers',overview.users],['Joined today',overview.joinedToday,true],['Active subscriptions',overview.activeSubscriptions],['Active connections',overview.connectedPages],['Trial accounts',overview.trials],['Unverified',overview.unverifiedUsers,true],['Publishing jobs',overview.scheduleJobs],['Failed jobs',overview.failedJobs,true]];$('statsGrid').innerHTML=items.map(([label,value,attention])=>`<div class="stat ${attention&&value?'attention':''}"><b>${value}</b><span>${label}</span></div>`).join('');renderRecent(state.recentUsers);$('healthList').innerHTML=`<div class="health-item ${overview.failedJobs?'warn':''}"><div><b>Publishing failures</b><small>Jobs currently requiring review</small></div><strong>${overview.failedJobs}</strong></div><div class="health-item ${overview.suspendedUsers?'warn':''}"><div><b>Suspended accounts</b><small>Customer access currently blocked</small></div><strong>${overview.suspendedUsers}</strong></div><div class="health-item ${overview.unverifiedUsers?'warn':''}"><div><b>Pending verification</b><small>Registrations not activated</small></div><strong>${overview.unverifiedUsers}</strong></div>`;const count=overview.joinedToday||0;['notificationCount','userAlertBadge'].forEach(id=>{$(id).textContent=count;$(id).hidden=!count});if(!silent&&count)toast(`${count} customer${count===1?'':'s'} joined today`)}
$('refreshOverviewBtn').addEventListener('click',()=>loadOverview().catch(error=>toast(error.message)));

function filteredUsers(){const filter=$('userFilter').value;return state.users.filter(user=>!filter||user.status===filter)}
function renderUsers(){const users=filteredUsers();$('usersTable').innerHTML=users.map(user=>`<tr><td><b>${esc(user.name||'No name')}</b><small>${esc(user.email)}</small></td><td>${badge(user.emailVerifiedAt?'VERIFIED':'PENDING_VERIFICATION')} ${badge(user.status)}</td><td>${badge(planOf(user))}<small>${user.manualPlanOverride?'Administrator override active':user.trialEndsAt?`Ends ${fmtDate(user.trialEndsAt)}`:'Billing policy'}</small></td><td>${badge(user.aiStudioAccess||'DEFAULT')}<small>${user.aiStudioAccess==='DEFAULT'?'Global Social Agent policy':'Social Agent override'}</small></td><td>${fmtDate(user.createdAt)}</td><td>${user.connectedPages?.length||0} pages · ${user.devices?.length||0} devices</td><td><button class="secondary" data-manage-user="${esc(user.id)}">Manage</button></td></tr>`).join('')||'<tr><td colspan="7">No customers match this filter.</td></tr>';document.querySelectorAll('[data-manage-user]').forEach(button=>button.addEventListener('click',()=>void openUser(button.dataset.manageUser)))}
async function loadUsers(){const query=$('userSearch').value.trim();const data=await api('/api/admin/users'+(query?`?q=${encodeURIComponent(query)}`:''));state.users=(data.users||[]).filter(user=>user.role==='USER');renderUsers()}
$('refreshUsersBtn').addEventListener('click',()=>loadUsers().catch(error=>toast(error.message)));$('userFilter').addEventListener('change',renderUsers);$('userSearch').addEventListener('input',()=>{clearTimeout(loadUsers.timer);loadUsers.timer=setTimeout(()=>loadUsers().catch(error=>toast(error.message)),250)});

function commercialSummary(user){
  const access=user.commercialAccess||{};
  const override=access.manualOverride;
  const billing=access.underlyingBilling;
  const credits=access.credits;
  return `<div class="entitlement-summary"><div><span>Effective plan</span><b>${esc(access.effectivePlan||planOf(user))}</b><small>${override?'Administrator override':'Normal billing entitlement'}</small></div><div><span>Underlying billing</span><b>${billing?esc(billing.plan||'—'):'None'}</b><small>${billing?`${esc(billing.provider||'unknown')} · ${esc(billing.status||'—')}`:'No underlying subscription'}</small></div><div><span>Manual override</span><b>${override?esc(override.plan):'None'}</b><small>${override?(override.permanent?'No expiry':`Ends ${fmtDate(override.expiresAt)}`):'Stripe/Trial rules apply'}</small></div><div><span>AI credits</span><b>${credits?Number(credits.remaining||0).toLocaleString():'—'}</b><small>${credits?`${Number(credits.monthlyRemaining||0).toLocaleString()} monthly + ${Number(credits.topupRemaining||0).toLocaleString()} manual/top-up`:'Wallet unavailable until access is active'}</small></div></div>`;
}

function renderUserModal(user){
  const access=user.commercialAccess||{};
  const override=access.manualOverride;
  $('modalTitle').textContent=`${user.name||'User'} — ${user.email}`;
  $('modalBody').innerHTML=`<div class="detail-card commercial-card"><b>Commercial entitlement</b><small>Manual overrides take priority over payment status without changing or cancelling the customer's Stripe subscription.</small>${commercialSummary(user)}</div>
  <div class="form-grid"><label>Account status<select id="editStatus"><option>TRIAL</option><option>ACTIVE</option><option>SUSPENDED</option><option>CANCELLED</option></select></label><label>Extend trial (days)<input id="editTrialDays" type="number" min="0" max="365" placeholder="No change"></label><label>Social Agent policy<select id="editAiAccess"><option value="DEFAULT">Use global policy</option><option value="ALLOW">Force allow</option><option value="DENY">Force block</option></select></label></div>
  <div class="detail-card"><b>Manual plan override</b><small>Use this for complimentary access, support cases, testing or partner accounts. Stripe remains untouched underneath.</small><div class="form-grid"><label>Plan<select id="overridePlan"><option value="TRIAL">Trial</option><option value="CREATOR">Creator</option><option value="PRO">Pro</option><option value="BUSINESS">Business</option><option value="AGENCY">Agency</option></select></label><label>Duration<input id="overrideDays" type="number" min="1" max="3650" placeholder="Blank = no expiry"></label><label>Reason<input id="overrideReason" maxlength="500" placeholder="Optional audit note"></label></div><div class="admin-actions entitlement-actions"><button class="primary" type="button" id="applyPlanOverride">Apply plan override</button><button class="secondary" type="button" id="revokePlanOverride" ${override?'':'disabled'}>Return to normal billing</button></div></div>
  <div class="detail-card"><b>AI credit override</b><small>Add complimentary credits, remove credits, set the exact currently available balance, or reset the monthly plan allowance. Every change is audit logged.</small><div class="form-grid"><label>Action<select id="creditAction"><option value="ADD">Add credits</option><option value="REMOVE">Remove credits</option><option value="SET">Set available credits</option><option value="RESET_PLAN">Reset monthly plan allowance</option></select></label><label>Credits<input id="creditAmount" type="number" min="0" max="1000000" value="100"></label><label>Reason<input id="creditReason" maxlength="500" placeholder="Optional audit note"></label></div><button class="primary" type="button" id="applyCreditOverride">Apply credit adjustment</button></div>
  <div class="detail-card"><b>Connected pages</b>${(user.connectedPages||[]).map(page=>`<small>${esc(page.facebookPageName)} — ${esc(page.status)}</small>`).join('')||'<small>No connected pages.</small>'}</div><div class="detail-card"><b>Recent jobs</b>${(user.scheduleJobs||[]).slice(0,5).map(job=>`<small>${esc(job.contentType)} — ${esc(job.status)} — ${fmtDate(job.scheduledAt)}</small>`).join('')||'<small>No publishing jobs.</small>'}</div>`;
  $('editStatus').value=user.status;$('editAiAccess').value=user.aiStudioAccess||'DEFAULT';$('overridePlan').value=override?.plan||access.effectivePlan||'CREATOR';
  $('creditAction').addEventListener('change',()=>{$('creditAmount').disabled=$('creditAction').value==='RESET_PLAN'});
  $('applyPlanOverride').addEventListener('click',()=>void applyPlanOverride());
  $('revokePlanOverride').addEventListener('click',()=>void revokePlanOverride());
  $('applyCreditOverride').addEventListener('click',()=>void adjustCredits());
}

async function refreshSelectedUser(){
  const {user}=await api(`/api/admin/users/${encodeURIComponent(state.selectedUser.id)}`);
  state.selectedUser=user;renderUserModal(user);await loadUsers();
}

async function openUser(id){const {user}=await api(`/api/admin/users/${encodeURIComponent(id)}`);if(user.role!=='USER')throw new Error('Administrator accounts are managed from Admin & Security.');state.selectedUser=user;renderUserModal(user);$('userDialog').showModal()}

async function applyPlanOverride(){try{const days=$('overrideDays').value.trim();await api(`/api/admin/users/${encodeURIComponent(state.selectedUser.id)}/commercial-plan`,{method:'PATCH',body:JSON.stringify({action:'APPLY',plan:$('overridePlan').value,durationDays:days?Number(days):null,reason:$('overrideReason').value.trim()})});toast('Manual plan override applied');await refreshSelectedUser();await loadOverview(true)}catch(error){toast(error.message)}}
async function revokePlanOverride(){try{await api(`/api/admin/users/${encodeURIComponent(state.selectedUser.id)}/commercial-plan`,{method:'PATCH',body:JSON.stringify({action:'REVOKE',reason:$('overrideReason').value.trim()})});toast('Manual override revoked; normal billing restored');await refreshSelectedUser();await loadOverview(true)}catch(error){toast(error.message)}}
async function adjustCredits(){try{const action=$('creditAction').value;const credits=action==='RESET_PLAN'?0:Number($('creditAmount').value||0);await api(`/api/admin/users/${encodeURIComponent(state.selectedUser.id)}/credits`,{method:'POST',body:JSON.stringify({action,credits,reason:$('creditReason').value.trim()})});toast('AI credit balance updated');await refreshSelectedUser()}catch(error){toast(error.message)}}

$('saveAccessBtn').addEventListener('click',async()=>{try{const body={status:$('editStatus').value,aiStudioAccess:$('editAiAccess').value};const days=$('editTrialDays').value;if(days)body.trialDays=Number(days);await api(`/api/admin/users/${encodeURIComponent(state.selectedUser.id)}/access`,{method:'PATCH',body:JSON.stringify(body)});$('userDialog').close();toast('Customer account access updated');await Promise.all([loadUsers(),loadOverview(true)])}catch(error){toast(error.message)}});

$('createUserBtn').addEventListener('click',()=>{$('createUserForm').reset();$('createTrialDays').value='7';$('trialDaysLabel').hidden=false;$('createUserDialog').showModal()});document.querySelectorAll('[data-close-create]').forEach(button=>button.addEventListener('click',()=>$('createUserDialog').close()));$('createPlan').addEventListener('change',()=>{$('trialDaysLabel').hidden=$('createPlan').value!=='TRIAL'});$('createUserForm').addEventListener('submit',async event=>{event.preventDefault();try{const body={name:$('createName').value.trim(),email:$('createEmail').value.trim(),plan:$('createPlan').value,trialDays:Number($('createTrialDays').value||7)};const result=await api('/api/admin/users',{method:'POST',body:JSON.stringify(body)});$('createUserDialog').close();$('temporaryPassword').textContent=result.temporaryPassword;$('credentialDialog').showModal();await Promise.all([loadUsers(),loadOverview(true)])}catch(error){toast(error.message)}});$('copyPasswordBtn').addEventListener('click',async()=>{await navigator.clipboard.writeText($('temporaryPassword').textContent);toast('Temporary password copied')});$('closeCredentialBtn').addEventListener('click',()=>$('credentialDialog').close());

function aiStatusCard(label,active,detail){
  return `<article class="ai-status-card ${active?'ok':'warn'}"><span>${esc(label)}</span><div class="ai-status-value"><i></i><b>${active?'Ready':'Attention'}</b></div><small>${esc(detail)}</small></article>`;
}
function renderAiOperations(data){
  const policy=data.policy||{};
  const providers=data.providers||{};
  const credits=data.credits||{};
  const topups=data.topups||{};

  $('studioEnabled').checked=Boolean(policy.enabled);
  $('studioTrialEnabled').checked=Boolean(policy.trialEnabled);
  $('studioPaidEnabled').checked=Boolean(policy.paidEnabled);
  $('studioAdminEnabled').checked=Boolean(policy.administratorEnabled);

  const superAdmin=state.user?.role==='SUPER_ADMIN';
  ['studioEnabled','studioTrialEnabled','studioPaidEnabled','studioAdminEnabled','saveStudioPolicyBtn'].forEach(id=>{$(id).disabled=!superAdmin});
  $('studioPolicyPermission').textContent=superAdmin?'Super Admin changes are audit logged.':'Read only — Super Admin is required to change global generation access.';

  $('aiOpsStatusGrid').innerHTML=[
    aiStatusCard('AI Content Studio',Boolean(policy.enabled),policy.enabled?'Generation policy enabled':'Global generation is paused'),
    aiStatusCard('Runware',Boolean(providers.runware?.configured),providers.runware?.detail||'Provider status unavailable'),
    aiStatusCard('Stock Video Creator',Boolean(providers.openMontage?.configured),providers.openMontage?.detail||'Worker status unavailable'),
    aiStatusCard('Credit system',Object.values(credits).some(Number.isFinite),topups.configured?`Plan wallet active · ${topups.packs.length} top-up packs`:'Plan wallet active · top-ups unavailable')
  ].join('');

  const order=['TRIAL','CREATOR','PRO','BUSINESS','AGENCY'];
  $('aiCreditPlanGrid').innerHTML=order.map(plan=>`<div class="credit-plan"><span>${plan==='TRIAL'?'Trial':plan[0]+plan.slice(1).toLowerCase()}</span><b>${Number(credits[plan]||0).toLocaleString()}</b><small>${plan==='TRIAL'?'one-time Trial credits':'credits / billing period'}</small></div>`).join('');
  $('aiCreditTopupStatus').innerHTML=`<span class="status-dot ${topups.configured?'ok':''}"></span><div><b>Credit top-ups ${topups.configured?'configured':'not fully configured'}</b><small>${topups.packs?.length?`Available packs: ${topups.packs.map(value=>Number(value).toLocaleString()).join(', ')} credits`:'No live packs detected'}</small></div>`;

  const providerCards=[
    ['Runware',providers.runware?.configured,providers.runware?.detail,[
      ['Image',providers.runware?.models?.image],
      ['Premium image',providers.runware?.models?.premiumImage],
      ['Economy video',providers.runware?.models?.economyVideo],
      ['Video',providers.runware?.models?.video],
      ['Long video',providers.runware?.models?.longVideo],
      ['UGC router',providers.runware?.models?.ugcRouterMode],
      ['UGC Standard',providers.runware?.models?.ugcStandard],
      ['UGC Premium creator',providers.runware?.models?.ugcOmniHuman],
      ['UGC Premium dynamic',providers.runware?.models?.ugcSeedance],
      ['UGC dynamic fallback',providers.runware?.models?.ugcKlingOmni],
      ['UGC compatibility premium',providers.runware?.models?.ugcPremiumCompatibility],
      ['UGC lip sync',providers.runware?.models?.ugcLipSync],
      ['UGC voice',providers.runware?.models?.ugcTts]
    ]],
    ['Stock Video Creator',providers.openMontage?.configured,providers.openMontage?.detail,[
      ['Pexels',providers.openMontage?.sources?.pexels?'Configured':'Not configured'],
      ['Pixabay',providers.openMontage?.sources?.pixabay?'Configured':'Not configured']
    ]],
    ['OpenAI support routes',providers.openai?.configured,providers.openai?.detail,[
      ['Image/support model',providers.openai?.models?.image],
      ['Caption enhancement',providers.openai?.models?.postEnhancement]
    ]]
  ];
  $('aiProviderGrid').innerHTML=providerCards.map(([name,configured,detail,rows])=>`<article class="provider-card"><div class="provider-head"><div><span class="status-dot ${configured?'ok':''}"></span><b>${esc(name)}</b></div><span class="provider-state ${configured?'ok':'warn'}">${configured?'Configured':'Attention'}</span></div><p>${esc(detail||'')}</p><div class="provider-routes">${rows.filter(([,value])=>value).map(([label,value])=>`<div><span>${esc(label)}</span><code>${esc(value)}</code></div>`).join('')}</div></article>`).join('');

  $('aiRoutingSummary').innerHTML='<div><b>Routing guardrail</b><span>Low-level model routing stays backend-managed. This screen exposes active configured model names without exposing API secrets.</span></div><div><b>Cost guardrail</b><span>AI generation uses the shared credit wallet and model-weighted video charging configured in the production backend.</span></div>';
}

function ugcBreakdown(title,values={}){
  const entries=Object.entries(values).sort((a,b)=>Number(b[1])-Number(a[1]));
  const total=entries.reduce((sum,[,value])=>sum+Number(value||0),0);
  return `<section><b>${esc(title)}</b>${entries.length?entries.map(([label,value])=>`<div class="ugc-admin-breakdown-row"><span>${esc(String(label).replaceAll('_',' '))}</span><i><em style="width:${total?Math.max(4,Math.round(Number(value)*100/total)):0}%"></em></i><strong>${Number(value).toLocaleString()}</strong></div>`).join(''):'<small>No data yet.</small>'}</section>`;
}
function renderUgcAnalytics(data){
  const analytics=data.analytics||{};
  const totals=analytics.totals||{};
  const kpis=[
    ['Studio opens',totals.studioOpens||0,`${Number(totals.uniqueStudioUsers||0).toLocaleString()} unique users`],
    ['Started',totals.campaignsStarted||0,'UGC generation starts'],
    ['Completed',totals.campaignsCompleted||0,`${Number(totals.campaignsFailed||0).toLocaleString()} failed renders`],
    ['Credits used',totals.creditsUsed||0,`${Number(totals.generationRows||0).toLocaleString()} generation records`],
    ['Provider cost',`${Number(totals.providerCostUsd||0).toFixed(2)}`,'Recorded Runware cost']
  ];
  $('ugcAnalyticsKpis').innerHTML=kpis.map(([label,value,detail])=>`<article><span>${esc(label)}</span><b>${typeof value==='number'?Number(value).toLocaleString():esc(value)}</b><small>${esc(detail)}</small></article>`).join('');
  const funnel=analytics.funnel||[];
  const max=Math.max(1,...funnel.map(item=>Number(item.users||0)));
  $('ugcAnalyticsFunnel').innerHTML=funnel.length?funnel.map(item=>`<div class="ugc-admin-funnel-row"><div><b>${esc(item.label)}</b><small>${Number(item.users||0).toLocaleString()} users · ${Number(item.events||0).toLocaleString()} events</small></div><div class="ugc-admin-funnel-track"><i style="width:${Math.max(item.users?5:0,Math.round(Number(item.users||0)*100/max))}%"></i></div><strong>${Number(item.fromStudio||0).toFixed(1)}%</strong></div>`).join(''):'<p class="muted">UGC funnel events will appear after customer activity.</p>';
  const breakdowns=analytics.breakdowns||{};
  $('ugcAnalyticsBreakdowns').innerHTML=[
    ugcBreakdown('Quality',breakdowns.quality),
    ugcBreakdown('Duration',breakdowns.duration),
    ugcBreakdown('Ad style',breakdowns.campaignType),
    ugcBreakdown('Source',breakdowns.sourceType)
  ].join('');
  $('ugcAnalyticsUpdated').textContent=analytics.generatedAt?`Updated ${relative(analytics.generatedAt)}`:'—';
}

function renderUgcOperations(data){
  const operations=data.operations||{};
  const queue=operations.queue||{};
  const economics=operations.economics30d||{};
  const health=String(operations.health||'UNKNOWN').toUpperCase();
  const chip=$('ugcOpsStatus');
  chip.textContent=health.replaceAll('_',' ');
  chip.className=`status-chip ${health==='HEALTHY'?'gsc-connected':health==='DEGRADED'?'gsc-error':''}`;
  const kpis=[
    ['Queued',queue.queued||0,'Waiting for the UGC worker'],
    ['Rendering',queue.rendering||0,'Active UGC variations'],
    ['Stale',queue.stale||0,`${Math.round(Number(operations.staleThresholdMs||0)/60000)} minute threshold`],
    ['30d credits',economics.creditsUsed||0,`${Number(economics.reservedCredits||0).toLocaleString()} currently recorded reserved`],
    ['30d provider cost',Number(economics.providerCostUsd||0).toFixed(2),`${Number(economics.generationRows||0).toLocaleString()} generation records`]
  ];
  $('ugcOpsKpis').innerHTML=kpis.map(([label,value,detail])=>`<article><span>${esc(label)}</span><b>${typeof value==='number'?Number(value).toLocaleString():esc(value)}</b><small>${esc(detail)}</small></article>`).join('');
  const stale=queue.staleItems||[];
  $('ugcOpsQueue').innerHTML=[
    `<div class="ugc-ops-row"><div><b>Oldest active update</b><small>${queue.oldestActiveUpdatedAt?esc(fmtDate(queue.oldestActiveUpdatedAt)):'No active renders'}</small></div><strong>${Number(queue.queued||0)+Number(queue.rendering||0)} active</strong></div>`,
    `<div class="ugc-ops-row"><div><b>Failed outputs visible</b><small>Recoverable failures remain explicit instead of disappearing from the queue.</small></div><strong>${Number(queue.failedVisible||0).toLocaleString()}</strong></div>`,
    ...(stale.length?stale.map(item=>`<div class="ugc-ops-row warning"><div><b>Stale ${esc(item.status)}</b><small>${esc(item.campaignId)} · ${item.updatedAt?esc(relative(item.updatedAt)):'unknown age'}</small></div><strong>${esc(item.adId.slice(0,8))}</strong></div>`):[`<div class="ugc-ops-row ok"><div><b>No stale UGC work</b><small>Queue/recovery timing is inside the Phase 8 threshold.</small></div><strong>Healthy</strong></div>`])
  ].join('');
  const issues=operations.recentAuditIssues||[];
  $('ugcOpsIssues').innerHTML=issues.length?issues.map(item=>`<div class="ugc-ops-row ${item.status==='FAIL'?'warning':''}"><div><b>${esc(item.status)} · ${esc(item.campaignStatus||'UNKNOWN')}</b><small>${esc(String(item.recommendedAction||'').replaceAll('_',' '))} · ${Number(item.summary?.publishableAds||0)}/${Number(item.summary?.variationCount||0)} publishable</small></div><strong>${esc(String(item.campaignId||'').slice(0,8))}</strong></div>`).join(''):`<div class="ugc-ops-row ok"><div><b>No recent invariant failures</b><small>Recent terminal campaigns agree across engine, render, credits, QC and Media Library state.</small></div><strong>Pass</strong></div>`;
  $('ugcOpsUpdated').textContent=operations.generatedAt?`Updated ${relative(operations.generatedAt)}`:'—';
}

function renderUgcAvatarLibrary(data){
  const avatars=data.avatars||[];
  const summary=data.summary||{};
  state.ugcAvatars=avatars;
  $('ugcAvatarSummary').innerHTML=`<b>${Number(summary.total||avatars.length).toLocaleString()}</b><span>system creators</span><small>${Number(summary.adminUploaded||0).toLocaleString()} admin uploaded · ${Number(summary.women||0).toLocaleString()} women · ${Number(summary.men||0).toLocaleString()} men</small>`;
  $('ugcAvatarLibrary').innerHTML=avatars.length?avatars.map(avatar=>`<article class="ugc-avatar-card">
    <div class="ugc-avatar-photo">
      ${avatar.imageUrl?`<img data-ugc-avatar-image loading="lazy" src="${esc(avatar.imageUrl)}" alt="">`:''}
      <div class="ugc-avatar-photo-fallback" ${avatar.imageUrl?'hidden':''}>${esc(initials(avatar.name))}</div>
      <span class="ugc-avatar-source ${avatar.managedByAdmin?'admin':''}">${avatar.managedByAdmin?'Admin upload':'Built in'}</span>
    </div>
    <div class="ugc-avatar-card-body">
      <div><b>${esc(avatar.name)}</b><span>${esc(avatar.presentation||'Unspecified')} · ${esc(avatar.ageBand||'Adult')}</span></div>
      <small>${esc(avatar.category||'Lifestyle')} · ${esc(avatar.locale||'en-GB')}</small>
      <div class="ugc-avatar-voice"><span>Voice</span><strong>${esc(avatar.voice||'Automatic')}</strong></div>
      ${avatar.accent?`<small>Accent: ${esc(avatar.accent)}</small>`:''}
    </div>
  </article>`).join(''):'<div class="ugc-avatar-library-empty">No active UGC creators found.</div>';
  document.querySelectorAll('[data-ugc-avatar-image]').forEach(image=>image.addEventListener('error',()=>{
    image.hidden=true;
    const fallback=image.nextElementSibling;
    if(fallback)fallback.hidden=false;
  }));
}

async function loadUgcAvatars(){
  const data=await api('/api/admin/ugc-avatars');
  renderUgcAvatarLibrary(data);
  return data;
}

function ugcAvatarMime(file){
  if(['image/png','image/jpeg','image/webp'].includes(file.type))return file.type;
  const name=String(file.name||'').toLowerCase();
  if(name.endsWith('.png'))return'image/png';
  if(name.endsWith('.webp'))return'image/webp';
  if(name.endsWith('.jpg')||name.endsWith('.jpeg'))return'image/jpeg';
  return'application/octet-stream';
}

async function uploadAdminUgcAvatar(file,meta){
  const headers={
    'Content-Type':ugcAvatarMime(file),
    'X-File-Name':encodeURIComponent(file.name||'creator'),
    'X-Creator-Presentation':encodeURIComponent(meta.presentation),
    'X-Creator-Category':encodeURIComponent(meta.category),
    'X-Creator-Age-Band':encodeURIComponent(meta.ageBand),
    'X-Creator-Locale':encodeURIComponent(meta.locale),
    'X-Creator-Accent':encodeURIComponent(meta.accent||''),
    'X-Creator-Featured':meta.featured?'true':'false'
  };
  const response=await fetch('/api/admin/ugc-avatars/upload',{method:'POST',credentials:'same-origin',headers,body:file});
  const data=await response.json().catch(()=>({}));
  if(response.status===401){clearSession();throw new Error(data.error||'Your administrator session has ended.')}
  if(!response.ok)throw new Error(data.error||`Upload failed: ${response.status}`);
  return data.avatar;
}

$('ugcAvatarFiles').addEventListener('change',()=>{
  const files=[...$('ugcAvatarFiles').files];
  $('ugcAvatarFileLabel').textContent=files.length?`${files.length} image${files.length===1?'':'s'} selected`:'No images selected';
});

$('refreshUgcAvatarsBtn').addEventListener('click',()=>loadUgcAvatars().then(()=>toast('UGC creator library refreshed')).catch(error=>toast(error.message)));

$('ugcAvatarUploadForm').addEventListener('submit',async event=>{
  event.preventDefault();
  const files=[...$('ugcAvatarFiles').files];
  if(!files.length){toast('Choose at least one creator image.');return}
  if(files.length>25){toast('Upload up to 25 creator images in one batch.');return}
  const invalid=files.find(file=>!['image/png','image/jpeg','image/webp'].includes(ugcAvatarMime(file))||file.size>12*1024*1024);
  if(invalid){toast(`${invalid.name} must be PNG, JPEG or WebP and 12 MB or smaller.`);return}
  const meta={
    presentation:$('ugcAvatarPresentation').value,
    category:$('ugcAvatarCategory').value,
    ageBand:$('ugcAvatarAgeBand').value,
    locale:$('ugcAvatarLocale').value,
    accent:$('ugcAvatarAccent').value.trim(),
    featured:$('ugcAvatarFeatured').checked
  };
  const button=$('ugcAvatarUploadBtn');
  const progress=$('ugcAvatarProgress');
  const bar=progress.querySelector('i');
  button.disabled=true;
  progress.hidden=false;
  bar.style.width='0%';
  let completed=0;
  const failures=[];
  try{
    for(const file of files){
      $('ugcAvatarUploadStatus').textContent=`Uploading ${completed+1} of ${files.length}: ${file.name}`;
      try{await uploadAdminUgcAvatar(file,meta)}
      catch(error){failures.push(`${file.name}: ${error.message}`)}
      completed+=1;
      bar.style.width=`${Math.round(completed*100/files.length)}%`;
    }
    await loadUgcAvatars();
    $('ugcAvatarFiles').value='';
    $('ugcAvatarFileLabel').textContent='No images selected';
    if(failures.length){
      $('ugcAvatarUploadStatus').textContent=`${files.length-failures.length} uploaded · ${failures.length} failed.`;
      toast(failures[0]);
    }else{
      $('ugcAvatarUploadStatus').textContent=`${files.length} creator${files.length===1?'':'s'} uploaded and live in UGC Studio.`;
      toast('UGC creators added to the customer picker');
    }
  }finally{
    button.disabled=false;
    window.setTimeout(()=>{progress.hidden=true;bar.style.width='0%'},900);
  }
});

async function loadAiAccess(){
  const days=Number($('ugcAnalyticsDays')?.value||30);
  const [studio,agent,ugc,ugcOps,ugcAvatars]=await Promise.all([
    api('/api/admin/ai-studio-policy'),
    api('/api/admin/agent-access'),
    api(`/api/admin/ugc-analytics?days=${days}`),
    api('/api/admin/ugc-operations?limit=20'),
    api('/api/admin/ugc-avatars')
  ]);
  renderAiOperations(studio);
  renderUgcAnalytics(ugc);
  renderUgcOperations(ugcOps);
  renderUgcAvatarLibrary(ugcAvatars);
  const policy=agent.policy||{};
  $('agentAvailability').value=policy.availability==='PLUS_ONLY'?'PAID_PLANS':policy.availability;
  const limits=policy.planLimits||{};
  $('agentLimitTrial').value=limits.TRIAL??1;
  $('agentLimitCreator').value=limits.CREATOR??25;
  $('agentLimitPro').value=limits.PRO??100;
  $('agentLimitBusiness').value=limits.BUSINESS??250;
  $('agentLimitAgency').value=limits.AGENCY??500;
}

$('ugcAnalyticsDays').addEventListener('change',()=>loadAiAccess().catch(error=>toast(error.message)));

$('aiStudioPolicyForm').addEventListener('submit',async event=>{
  event.preventDefault();
  try{
    await api('/api/admin/ai-studio-policy',{method:'PUT',body:JSON.stringify({
      enabled:$('studioEnabled').checked,
      trialEnabled:$('studioTrialEnabled').checked,
      paidEnabled:$('studioPaidEnabled').checked,
      administratorEnabled:$('studioAdminEnabled').checked
    })});
    toast('AI Content Studio policy updated');
    await loadAiAccess();
  }catch(error){toast(error.message)}
});

$('agentAccessForm').addEventListener('submit',async event=>{
  event.preventDefault();
  try{
    await api('/api/admin/agent-access',{method:'PUT',body:JSON.stringify({
      availability:$('agentAvailability').value,
      planLimits:{
        TRIAL:Number($('agentLimitTrial').value),
        CREATOR:Number($('agentLimitCreator').value),
        PRO:Number($('agentLimitPro').value),
        BUSINESS:Number($('agentLimitBusiness').value),
        AGENCY:Number($('agentLimitAgency').value)
      }
    })});
    toast('Social Agent policy updated');
    await loadAiAccess();
  }catch(error){toast(error.message)}
});


const formatNumber=value=>Number(value||0).toLocaleString(undefined,{maximumFractionDigits:0});
const formatPct=value=>`${(Number(value||0)*100).toFixed(2)}%`;
const formatPosition=value=>Number(value||0)>0?Number(value).toFixed(1):'—';
function gscDelta(value,suffix='%'){const number=Number(value||0);const direction=number>0?'up':number<0?'down':'flat';const sign=number>0?'+':'';return `<small class="gsc-delta ${direction}">${sign}${number.toFixed(1)}${suffix}</small>`}
function setGscLoading(on){$('gscRefreshBtn').disabled=on;$('gscRefreshBtn').textContent=on?'Refreshing…':'↻ Refresh Search Console data'}
function renderGscStatus(data){
  state.searchConsole=data;
  const superAdmin=state.user?.role==='SUPER_ADMIN';
  const connected=Boolean(data.connected);
  const configured=Boolean(data.configured);
  $('gscStatusChip').textContent=!configured?'OAuth setup required':connected?(data.status==='ERROR'?'Connection attention':'Connected'):'Not connected';
  $('gscStatusChip').className=`status-chip ${connected&&data.status!=='ERROR'?'gsc-connected':data.status==='ERROR'?'gsc-error':''}`;
  $('gscCallbackUri').textContent=data.callbackUrl||'—';
  $('gscConnectBtn').hidden=!superAdmin;
  $('gscConnectBtn').textContent=connected?'Reconnect Google':'Connect Google Search Console';
  $('gscConnectBtn').disabled=!configured||!superAdmin;
  $('gscDisconnectBtn').hidden=!connected||!superAdmin;

  const select=$('gscPropertySelect');
  const sites=data.sites||[];
  select.innerHTML=sites.length
    ? sites.map(site=>`<option value="${esc(site.siteUrl)}" ${site.siteUrl===data.selectedSiteUrl?'selected':''}>${esc(site.siteUrl)} · ${esc(site.permissionLevel)}</option>`).join('')
    : '<option value="">No Search Console properties found</option>';
  select.disabled=!connected||!sites.length||!superAdmin;

  if(!configured){
    $('gscConnectionMessage').textContent='Google OAuth credentials are not configured on the backend. Add a Google OAuth web client before connecting.';
  }else if(data.lastError){
    $('gscConnectionMessage').textContent=data.lastError;
  }else if(connected){
    $('gscConnectionMessage').textContent=`Connected directly to Google. ${sites.length} Search Console propert${sites.length===1?'y':'ies'} available.`;
  }else{
    $('gscConnectionMessage').textContent='Ready to connect directly to Google Search Console with read-only access.';
  }
  $('gscSyncMeta').textContent=data.lastSyncedAt?`Last Google sync ${fmtDate(data.lastSyncedAt)}`:'Connect a property to load live search performance.';
}
function renderGscTrend(rows){
  const data=rows||[];
  if(!data.length){$('gscTrendChart').innerHTML='<div class="gsc-empty">No daily Search Console data for this period.</div>';return}
  const max=Math.max(...data.map(row=>Number(row.impressions||0)),1);
  $('gscTrendChart').innerHTML=data.map(row=>{
    const height=Math.max(3,Math.round((Number(row.impressions||0)/max)*100));
    const clicks=Number(row.clicks||0);
    return `<div class="gsc-bar-col" title="${esc(row.date)} · ${formatNumber(row.impressions)} impressions · ${formatNumber(clicks)} clicks"><i style="height:${height}%"></i><span>${esc(String(row.date||'').slice(5))}</span></div>`;
  }).join('');
}
function gscRows(rows,key){
  return (rows||[]).slice(0,20).map(row=>`<tr><td><b>${esc(row[key]||'—')}</b></td><td>${formatNumber(row.clicks)}</td><td>${formatNumber(row.impressions)}</td><td>${formatPct(row.ctr)}</td><td>${formatPosition(row.position)}</td></tr>`).join('')||'<tr><td colspan="5">No data for this period.</td></tr>';
}
function renderGscBreakdown(target,rows,key){
  const data=(rows||[]).slice(0,10);
  if(!data.length){$(target).innerHTML='<div class="gsc-empty">No data.</div>';return}
  const max=Math.max(...data.map(row=>Number(row.impressions||0)),1);
  $(target).innerHTML=data.map(row=>`<div class="gsc-breakdown-row"><div><b>${esc(row[key]||'Unknown')}</b><small>${formatNumber(row.clicks)} clicks · ${formatPct(row.ctr)} CTR</small></div><div class="gsc-mini-track"><i style="width:${Math.max(2,(Number(row.impressions||0)/max)*100)}%"></i></div><strong>${formatNumber(row.impressions)}</strong></div>`).join('');
}
function renderGscPerformance(data){
  const s=data.summary||{},c=data.comparison||{};
  $('gscMetrics').innerHTML=[
    ['Clicks',formatNumber(s.clicks),gscDelta(c.clicksPercent),'Google Search visits'],
    ['Impressions',formatNumber(s.impressions),gscDelta(c.impressionsPercent),'Search result appearances'],
    ['CTR',formatPct(s.ctr),gscDelta(c.ctrPoints,' pp'),'Click-through rate'],
    ['Average position',formatPosition(s.position),gscDelta(c.positionChange),'Positive = ranking improved']
  ].map(([label,value,delta,note])=>`<article class="gsc-metric"><span>${label}</span><div><b>${value}</b>${delta}</div><small>${note}</small></article>`).join('');
  $('gscRangeLabel').textContent=`${data.range?.startDate||''} → ${data.range?.endDate||''}`;
  renderGscTrend(data.daily);
  $('gscQueriesTable').innerHTML=gscRows(data.topQueries,'query');
  $('gscPagesTable').innerHTML=gscRows(data.topPages,'page');
  renderGscBreakdown('gscCountries',data.countries,'country');
  renderGscBreakdown('gscDevices',data.devices,'device');
  const opp=data.opportunities||[];
  $('gscOpportunities').innerHTML=opp.length?opp.map(row=>`<div class="gsc-opportunity"><div><b>${esc(row.query)}</b><small>${formatNumber(row.impressions)} impressions · ${formatPct(row.ctr)} CTR</small></div><span>Pos. ${formatPosition(row.position)}</span></div>`).join(''):'<div class="gsc-empty">No high-impression ranking opportunities detected in this period.</div>';
  $('gscSyncMeta').textContent=`${esc(data.siteUrl)} · ${data.periodDays} day report · refreshed just now`;
}
async function loadGscPerformance(){
  if(!state.searchConsole?.connected||!state.searchConsole?.selectedSiteUrl)return;
  setGscLoading(true);
  try{
    const data=await api(`/api/admin/search-console/performance?days=${encodeURIComponent($('gscPeriod').value)}`);
    renderGscPerformance(data);
  }catch(error){
    $('gscSyncMeta').textContent=error.message;
    toast(error.message);
  }finally{setGscLoading(false)}
}
async function loadSearchConsole(){
  try{
    const data=await api('/api/admin/search-console/status');
    renderGscStatus(data);
    if(data.connected&&data.selectedSiteUrl)await loadGscPerformance();
  }catch(error){
    $('gscConnectionMessage').textContent=error.message;
    toast(error.message);
  }
}
$('gscConnectBtn').addEventListener('click',async()=>{
  try{
    const data=await api('/api/admin/search-console/oauth/start',{method:'POST',body:'{}'});
    window.location.assign(data.authorizationUrl);
  }catch(error){toast(error.message)}
});
$('gscDisconnectBtn').addEventListener('click',async()=>{
  if(!window.confirm('Disconnect Google Search Console from INXSocial?'))return;
  try{
    await api('/api/admin/search-console',{method:'DELETE'});
    toast('Google Search Console disconnected');
    state.searchConsole=null;
    await loadSearchConsole();
  }catch(error){toast(error.message)}
});
$('gscPropertySelect').addEventListener('change',async event=>{
  if(!event.target.value)return;
  try{
    await api('/api/admin/search-console/site',{method:'POST',body:JSON.stringify({siteUrl:event.target.value})});
    toast('Search Console property updated');
    await loadSearchConsole();
  }catch(error){toast(error.message)}
});
$('gscPeriod').addEventListener('change',()=>loadGscPerformance().catch(error=>toast(error.message)));
$('gscRefreshBtn').addEventListener('click',()=>loadSearchConsole().catch(error=>toast(error.message)));

async function postAuthLanding(){
  const params=new URLSearchParams(window.location.search);
  const gsc=params.get('gsc');
  if(gsc){
    await openPage('searchConsole');
    if(gsc==='connected')toast('Google Search Console connected');
    if(gsc==='error')toast(params.get('message')||'Google Search Console connection failed');
    history.replaceState({},'',window.location.pathname);
    return;
  }
  await loadOverview();
}

function settingControl(setting,canEdit){const disabled=canEdit?'':'disabled';const value=esc(setting.value);if(setting.type==='boolean')return`<select id="setting-${esc(setting.key)}" ${disabled}><option value="false" ${setting.value==='false'?'selected':''}>Disabled</option><option value="true" ${setting.value==='true'?'selected':''}>Enabled</option></select>`;if(setting.type==='number')return`<input id="setting-${esc(setting.key)}" type="number" min="1" max="30" value="${value}" ${disabled}>`;return`<input id="setting-${esc(setting.key)}" value="${value}" ${disabled}>`}
async function loadSettings(){const data=await api('/api/admin/security/settings');const canEdit=Boolean(data.canEdit);$('settingsPermission').textContent=canEdit?'Super administrator changes are audit logged.':'Read only — a super administrator is required to change system settings.';$('systemSettingsList').innerHTML=(data.settings||[]).map(setting=>`<article class="system-setting-card"><div><span class="kicker">${esc(setting.key)}</span><h3>${esc(setting.label)}</h3><p>${esc(setting.description)}</p>${setting.updatedAt?`<small>Last updated ${esc(fmtDate(setting.updatedAt))}</small>`:''}</div><div class="system-setting-action">${settingControl(setting,canEdit)}<button class="primary" data-save-setting="${esc(setting.key)}" ${canEdit?'':'disabled'}>Save</button></div></article>`).join('')||'<p>No safe system settings are available.</p>';document.querySelectorAll('[data-save-setting]').forEach(button=>button.addEventListener('click',()=>void saveSystemSetting(button.dataset.saveSetting)))}
async function saveSystemSetting(key){try{const input=$(`setting-${key}`);await api(`/api/admin/security/settings/${encodeURIComponent(key)}`,{method:'PUT',body:JSON.stringify({value:input.value})});toast('System setting updated');await loadSettings()}catch(error){toast(error.message)}}

function renderSecuritySummary(){const superAdmin=state.user?.role==='SUPER_ADMIN';$('securitySummary').innerHTML=`<div class="security-metric"><span>Session storage</span><b>HttpOnly cookie</b><small>JavaScript cannot read the administrator credential.</small></div><div class="security-metric"><span>Session lifetime</span><b>8 hours</b><small>Separate from customer bearer sessions.</small></div><div class="security-metric"><span>Login throttle</span><b>8 failures / 15 min</b><small>Successful sign-ins do not consume the failure budget.</small></div><div class="security-metric"><span>Your role</span><b>${esc((state.user?.role||'ADMIN').replace('_',' '))}</b><small>${superAdmin?'Full administrator governance.':'Operational administrator access.'}</small></div>`}
function renderAdministrators(admins,currentAdminId){$('administratorsTable').innerHTML=admins.map(admin=>{const self=admin.id===currentAdminId;return`<tr><td><b>${esc(admin.name||'Administrator')}</b><small>${esc(admin.email)}</small></td><td><select data-admin-role="${esc(admin.id)}" ${self?'disabled':''}><option value="ADMIN" ${admin.role==='ADMIN'?'selected':''}>Admin</option><option value="SUPER_ADMIN" ${admin.role==='SUPER_ADMIN'?'selected':''}>Super Admin</option></select></td><td><select data-admin-status="${esc(admin.id)}" ${self?'disabled':''}><option value="ACTIVE" ${admin.status==='ACTIVE'?'selected':''}>Active</option><option value="SUSPENDED" ${admin.status==='SUSPENDED'?'selected':''}>Suspended</option></select></td><td>${admin.lastLoginAt?fmtDate(admin.lastLoginAt):'No recorded admin login'}</td><td class="admin-actions">${self?'<span class="badge VERIFIED">Current session</span>':`<button class="secondary compact" data-save-admin="${esc(admin.id)}">Save</button>`}<button class="secondary compact" data-resend-admin="${esc(admin.id)}">Send setup link</button></td></tr>`}).join('')||'<tr><td colspan="5">No administrator accounts found.</td></tr>';document.querySelectorAll('[data-save-admin]').forEach(button=>button.addEventListener('click',()=>void saveAdministrator(button.dataset.saveAdmin)));document.querySelectorAll('[data-resend-admin]').forEach(button=>button.addEventListener('click',()=>void resendAdminSetup(button.dataset.resendAdmin)))}
async function loadAdministrators(){const data=await api('/api/admin/security/administrators');state.administrators=data.administrators||[];renderAdministrators(state.administrators,data.currentAdminId)}
async function saveAdministrator(id){try{const role=document.querySelector(`[data-admin-role="${id}"]`).value;const status=document.querySelector(`[data-admin-status="${id}"]`).value;await api(`/api/admin/security/administrators/${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify({role,status})});toast('Administrator access updated');await loadAdministrators()}catch(error){toast(error.message)}}
async function resendAdminSetup(id){try{const data=await api(`/api/admin/security/administrators/${encodeURIComponent(id)}/setup-link`,{method:'POST',body:'{}'});toast(data.setupEmailSent?'Setup link sent':'Setup link created; email provider is in development mode')}catch(error){toast(error.message)}}
function renderAudit(logs){$('auditList').innerHTML=logs.map(log=>`<div class="audit-row"><div><b>${esc(log.action.replaceAll('_',' '))}</b><small>${esc(log.user?.email||'System')} · ${esc(log.entity||'Security event')}${log.ip?` · ${esc(log.ip)}`:''}</small></div><time>${esc(fmtDate(log.createdAt))}</time></div>`).join('')||'<p>No audit events recorded.</p>'}
async function loadAudit(){const data=await api('/api/admin/security/audit?limit=100');renderAudit(data.logs||[])}
async function loadSecurity(){renderSecuritySummary();const isSuper=state.user?.role==='SUPER_ADMIN';$('superAdminArea').hidden=!isSuper;$('standardAdminNote').hidden=isSuper;if(isSuper){await Promise.all([loadAdministrators(),loadAudit()])}}

$('changePasswordForm').addEventListener('submit',async event=>{event.preventDefault();const current=$('currentAdminPassword').value;const next=$('newAdminPassword').value;const confirm=$('confirmAdminPassword').value;if(next!==confirm){toast('New password and confirmation do not match');return}try{await api('/api/admin/security/change-password',{method:'POST',body:JSON.stringify({currentPassword:current,newPassword:next})});event.target.reset();toast('Administrator password updated')}catch(error){toast(error.message)}});
$('inviteAdminBtn').addEventListener('click',()=>{$('inviteAdminForm').reset();$('inviteAdminDialog').showModal()});document.querySelectorAll('[data-close-admin-invite]').forEach(button=>button.addEventListener('click',()=>$('inviteAdminDialog').close()));$('inviteAdminForm').addEventListener('submit',async event=>{event.preventDefault();try{const data=await api('/api/admin/security/administrators',{method:'POST',body:JSON.stringify({name:$('inviteAdminName').value.trim(),email:$('inviteAdminEmail').value.trim()})});$('inviteAdminDialog').close();toast(data.setupEmailSent?'Administrator created and setup link sent':'Administrator created; email provider did not send the setup link');await Promise.all([loadAdministrators(),loadAudit()])}catch(error){toast(error.message)}});
$('refreshAuditBtn').addEventListener('click',()=>loadAudit().catch(error=>toast(error.message)));

$('notificationBtn').addEventListener('click',event=>{event.stopPropagation();$('notificationPanel').classList.toggle('hidden')});$('closeNotifications').addEventListener('click',()=>$('notificationPanel').classList.add('hidden'));document.addEventListener('pointerdown',event=>{if(!$('notificationPanel').classList.contains('hidden')&&!$('notificationPanel').contains(event.target)&&!$('notificationBtn').contains(event.target))$('notificationPanel').classList.add('hidden')});document.addEventListener('keydown',event=>{if(event.key==='Escape')$('notificationPanel').classList.add('hidden')});
(async function boot(){try{const data=await api('/api/admin-auth/me');state.user=data.user;setLoggedIn(true);await postAuthLanding();state.timer=setInterval(()=>loadOverview(true).catch(()=>{}),15000)}catch{clearSession()}})();
