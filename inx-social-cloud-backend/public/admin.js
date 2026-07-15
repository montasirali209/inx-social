const API = '';
const state = { token: localStorage.getItem('pp_admin_token') || '', user: null, selectedUser: null };
const $ = (id) => document.getElementById(id);

function toast(msg){ const el=$('toast'); el.textContent=msg; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),3500); }
async function api(path, opts={}){
  const headers = { 'Content-Type':'application/json', ...(opts.headers||{}) };
  if(state.token) headers.Authorization = `Bearer ${state.token}`;
  const res = await fetch(API+path, { ...opts, headers });
  const data = await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}
function setLoggedIn(on){ $('loginView').classList.toggle('hidden', on); $('dashboardView').classList.toggle('hidden', !on); }

$('loginForm').addEventListener('submit', async (e)=>{
  e.preventDefault(); $('loginError').textContent='';
  try{
    const data = await api('/api/auth/login',{ method:'POST', body:JSON.stringify({ email:$('email').value.trim(), password:$('password').value }) });
    state.token=data.token; state.user=data.user; localStorage.setItem('pp_admin_token', state.token);
    $('adminEmail').textContent=data.user.email; setLoggedIn(true); await loadOverview();
  }catch(err){ $('loginError').textContent=err.message; }
});
$('logoutBtn').addEventListener('click',()=>{ localStorage.removeItem('pp_admin_token'); state.token=''; setLoggedIn(false); });

document.querySelectorAll('.nav').forEach(btn=>btn.addEventListener('click', async ()=>{
  document.querySelectorAll('.nav').forEach(b=>b.classList.remove('active')); btn.classList.add('active');
  document.querySelectorAll('.page').forEach(p=>p.classList.add('hidden'));
  const page=btn.dataset.page; $(`${page}Page`).classList.remove('hidden'); $('pageTitle').textContent=btn.textContent;
  if(page==='overview') await loadOverview(); if(page==='users') await loadUsers(); if(page==='settings') await loadSettings();
}));

async function loadOverview(){
  const { overview } = await api('/api/admin/overview');
  const items = [
    ['Users', overview.users], ['Unverified', overview.unverifiedUsers], ['Trials', overview.trials], ['Active subs', overview.activeSubscriptions], ['Connected pages', overview.connectedPages],
    ['Jobs', overview.scheduleJobs], ['Failed jobs', overview.failedJobs], ['Active users', overview.activeUsers], ['Suspended', overview.suspendedUsers]
  ];
  $('statsGrid').innerHTML = items.map(([k,v])=>`<div class="stat"><b>${v}</b><span>${k}</span></div>`).join('');
}

function fmtDate(v){ return v ? new Date(v).toLocaleString() : '—'; }
function planOf(u){ return u.subscriptions?.[0]?.plan || 'TRIAL'; }
function statusBadge(s){ return `<span class="badge ${s}">${s}</span>`; }
async function loadUsers(){
  const q=$('userSearch').value.trim(); const { users } = await api('/api/admin/users' + (q?`?q=${encodeURIComponent(q)}`:''));
  $('usersTable').innerHTML = users.map(u=>`<tr>
    <td><strong>${u.name||'No name'}</strong><br><small>${u.email}</small></td>
    <td>${statusBadge(u.emailVerifiedAt ? 'VERIFIED' : 'UNVERIFIED')}<br>${statusBadge(u.status)}</td><td>${fmtDate(u.trialEndsAt)}</td><td>${planOf(u)}</td>
    <td>${u.connectedPages?.length||0}</td><td>${u.devices?.length||0}</td>
    <td><button class="secondary" onclick="openUser('${u.id}')">Manage</button></td>
  </tr>`).join('') || '<tr><td colspan="7">No users found.</td></tr>';
}
$('refreshUsersBtn').addEventListener('click',loadUsers); $('userSearch').addEventListener('keydown',(e)=>{ if(e.key==='Enter') loadUsers(); });

window.openUser = async function(id){
  const { user } = await api(`/api/admin/users/${id}`); state.selectedUser=user;
  $('modalTitle').textContent = `${user.name || 'User'} — ${user.email}`;
  $('modalBody').innerHTML = `<div class="modal-grid">
    <label>Status<select id="editStatus"><option>TRIAL</option><option>ACTIVE</option><option>SUSPENDED</option><option>CANCELLED</option></select></label>
    <label>Role<select id="editRole"><option>USER</option><option>ADMIN</option><option>SUPER_ADMIN</option></select></label>
    <label>Extend trial days<input id="editTrialDays" type="number" min="0" placeholder="e.g. 5" /></label>
    <label>Manual plan<select id="editPlan"><option value="">No change</option><option>STARTER</option><option>PRO</option><option>LIFETIME</option></select></label>
  </div>
  <div class="detail-card"><strong>Connected pages</strong>${(user.connectedPages||[]).map(p=>`<small>${p.facebookPageName} — ${p.status}</small>`).join('') || '<small>No pages connected.</small>'}</div>
  <div class="detail-card"><strong>Recent jobs</strong>${(user.scheduleJobs||[]).map(j=>`<small>${j.contentType} — ${j.status} — ${fmtDate(j.scheduledAt)}</small>`).join('') || '<small>No jobs yet.</small>'}</div>`;
  $('editStatus').value=user.status; $('editRole').value=user.role;
  $('userDialog').showModal();
}
$('saveAccessBtn').addEventListener('click', async ()=>{
  const body={ status:$('editStatus').value, role:$('editRole').value };
  const days=$('editTrialDays').value; if(days) body.trialDays=Number(days);
  const plan=$('editPlan').value; if(plan){ body.plan=plan; body.subscriptionStatus='MANUAL'; body.status='ACTIVE'; }
  await api(`/api/admin/users/${state.selectedUser.id}/access`, { method:'PATCH', body:JSON.stringify(body) });
  $('userDialog').close(); toast('User access updated'); await loadUsers(); await loadOverview();
});

async function loadSettings(){
  const { settings } = await api('/api/admin/settings');
  $('settingsList').innerHTML = settings.map(s=>`<div class="setting-item"><strong>${s.key}</strong><span>${s.value}</span><small>${s.description||''}</small></div>`).join('') || '<p>No settings yet.</p>';
}
$('settingForm').addEventListener('submit', async(e)=>{
  e.preventDefault();
  await api('/api/admin/settings',{ method:'PUT', body:JSON.stringify({ key:$('settingKey').value.trim(), value:$('settingValue').value, description:$('settingDescription').value }) });
  $('settingForm').reset(); toast('Setting saved'); await loadSettings();
});

(async function boot(){
  if(!state.token) return setLoggedIn(false);
  try{ const data=await api('/api/license/status'); state.user=data.user; $('adminEmail').textContent=data.user.email; setLoggedIn(true); await loadOverview(); }
  catch{ localStorage.removeItem('pp_admin_token'); setLoggedIn(false); }
})();
