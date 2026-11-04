'use strict';
const $=id=>document.getElementById(id), C=Core;
let token='',expires=0,busy=false,data={Foods:[],Diary:[],Weight:[],Settings:[]};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>crypto.randomUUID();
const settings=()=>Object.fromEntries(data.Settings.map(r=>[r.key,r.value]));
const status=s=>$('status').textContent=s;
const num=n=>Number(n||0).toFixed(0);
async function api(path='',method='GET',body){
 if(!token||Date.now()>=expires)throw Error('Google connection expired. Click Connect Google and try again.');
 const r=await fetch('https://sheets.googleapis.com/v4/spreadsheets/'+encodeURIComponent(CONFIG.spreadsheetId)+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 const j=await r.json();if(!r.ok)throw Error(j.error?.message||'Google request failed');return j;
}
async function run(fn){if(busy)return;busy=true;document.querySelectorAll('button').forEach(b=>b.disabled=true);try{await fn();}catch(e){status(e.message+' Your form has been kept. Refresh before retrying an uncertain save.');}finally{busy=false;document.querySelectorAll('button').forEach(b=>b.disabled=false);}}
async function initialise(){
 const meta=await api('?fields=sheets.properties');const titles=meta.sheets.map(s=>s.properties.title);
 const missing=Object.keys(C.schema).filter(t=>!titles.includes(t));
 if(missing.length)await api(':batchUpdate','POST',{requests:missing.map(title=>({addSheet:{properties:{title}}}))});
 const writes=[];
 for(const [name,headers] of Object.entries(C.schema)){
  const r=await api('/values/'+encodeURIComponent(name+'!1:1'));
  const current=r.values?.[0]||[];
  if(!current.length)writes.push({range:name+'!A1',values:[headers]});
  else if(JSON.stringify(current)!==JSON.stringify(headers))throw Error(name+' headers differ from the app schema. Use a new empty spreadsheet or restore the exact headers in README.');
 }
 if(writes.length)await api('/values:batchUpdate','POST',{valueInputOption:'RAW',data:writes});
 await load();
}
async function load(){
 const names=Object.keys(C.schema);const r=await api('/values:batchGet?'+names.map(n=>'ranges='+encodeURIComponent(n+'!A:Z')).join('&'));
 names.forEach((name,i)=>{data[name]=(r.valueRanges[i].values||[]).slice(1).map((row,index)=>Object.assign(Object.fromEntries(C.schema[name].map((key,j)=>[key,row[j]??''])),{_row:index+2})).filter(row=>row[C.schema[name][0]]);});
 render();status('Connected · records loaded from your private spreadsheet.');
}
const cells=(name,obj)=>C.schema[name].map(k=>obj[k]??'');
async function append(name,rows){if(rows.length)await api('/values/'+encodeURIComponent(name+'!A:Z')+':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS','POST',{values:rows.map(r=>cells(name,r))});}
async function write(name,obj){
 // Resolve IDs again immediately before updating; avoid row numbers from an old UI snapshot.
 await load();const key=C.schema[name][0];const old=data[name].find(r=>r[key]===obj[key]);
 if(old)await api('/values/'+encodeURIComponent(name+'!A'+old._row)+'?valueInputOption=RAW','PUT',{values:[cells(name,obj)]});else await append(name,[obj]);
 await load();status('Saved to Google Sheets.');
}
async function remove(name,id){await load();const row=data[name].find(r=>r.id===id);if(!row)throw Error('Entry already removed.');await api('/values/'+encodeURIComponent(name+'!A'+row._row+':Z'+row._row)+':clear','POST',{});await load();status('Entry removed.');}
function render(){
 const s=settings(),target=Number(s.daily_kcal_target||0),rows=data.Diary.filter(r=>r.date===$('date').value),t=C.totals(rows);
 $('summary').innerHTML=[['Eaten',num(t.kcal)+' kcal'],[target&&t.kcal>target?'Over target':'Remaining',target?num(Math.abs(target-t.kcal))+' kcal':'Set a target'],['Protein',num(t.protein_g)+' g'],['Carbs / fat',num(t.carbs_g)+' / '+num(t.fat_g)+' g']].map(([a,b])=>`<div class="card"><span>${a}</span><strong>${b}</strong></div>`).join('');
 $('progress').value=target?Math.min(100,t.kcal/target*100):0;
 $('diary').innerHTML=rows.length?rows.map(r=>`<article class="entry"><div><strong>${esc(r.food_name)}</strong><p>${esc(r.meal)} · ${esc(r.quantity)} ${esc(r.unit)} · ${num(r.kcal)} kcal</p><small>${r.unit==='quick'?'Macros unknown':`P ${num(r.protein_g)} · C ${num(r.carbs_g)} · F ${num(r.fat_g)} g`}</small></div><div class="actions"><button data-action="editDiary" data-id="${esc(r.id)}">Edit</button><button data-action="deleteDiary" data-id="${esc(r.id)}" class="secondary">Delete</button></div></article>`).join(''):'<p>No food logged for this date.</p>';
 renderOptions();
 $('foodList').innerHTML=data.Foods.map(f=>`<article class="entry"><div><strong>${f.favourite==='true'?'★ ':''}${esc(f.name)}</strong><p>${esc(f.brand)} · ${num(f.kcal)} kcal / ${esc(f.basis)}</p></div><div class="actions"><button data-action="editFood" data-id="${esc(f.id)}">Edit</button><button data-action="deleteFood" data-id="${esc(f.id)}" class="secondary">Delete</button></div></article>`).join('')||'<p>Add your first food using a nutrition label.</p>';
 const weights=[...data.Weight].sort((a,b)=>a.date.localeCompare(b.date));const latest=weights.at(-1),avg=latest?C.average(weights,latest.date):null;
 $('weightSummary').textContent=latest?`Latest: ${latest.weight_kg} kg (${latest.date}) · 7-day average: ${avg.toFixed(2)} kg${s.target_weight_kg?' · Target: '+s.target_weight_kg+' kg':''}`:'No weights recorded yet.';
 $('weights').innerHTML=[...weights].reverse().map(r=>`<article class="entry"><div><strong>${esc(r.weight_kg)} kg</strong><p>${esc(r.date)} · ${esc(r.notes)}</p></div><div class="actions"><button data-action="editWeight" data-id="${esc(r.id)}">Edit</button><button data-action="deleteWeight" data-id="${esc(r.id)}" class="secondary">Delete</button></div></article>`).join('');
 chart(weights);
 for(const k of ['daily_kcal_target','target_weight_kg','timezone'])$('settingsForm').elements[k].value=s[k]||(k==='timezone'?'Australia/Sydney':'');
}
function renderOptions(){const previous=$('foodSelect').value,q=$('search').value.toLowerCase();const foods=data.Foods.filter(f=>(f.name+' '+f.brand).toLowerCase().includes(q)).sort((a,b)=>Number(b.favourite==='true')-Number(a.favourite==='true')||a.name.localeCompare(b.name));$('foodSelect').innerHTML=foods.map(f=>`<option value="${esc(f.id)}">${f.favourite==='true'?'★ ':''}${esc(f.name)}${f.brand?' — '+esc(f.brand):''}</option>`).join('');if(foods.some(f=>f.id===previous))$('foodSelect').value=previous;estimate();}
function estimate(){const f=data.Foods.find(r=>r.id===$('foodSelect').value);$('unit').textContent=f?(f.basis==='100g'?'(grams)':'(servings)'):'';$('estimate').textContent=f?num(C.nutrition(f,$('logForm').elements.amount.value).kcal)+' kcal':'';}
function chart(rows){const svg=$('chart');if(!rows.length){svg.innerHTML='<text x="30" y="110" fill="#566c64">Log a weight to see your trend.</text>';return;}const vals=rows.map(r=>Number(r.weight_kg)),lo=Math.min(...vals)-.5,hi=Math.max(...vals)+.5,start=Date.parse(rows[0].date),end=Date.parse(rows.at(-1).date);const points=rows.map((r,i)=>[40+(end===start?.5:(Date.parse(r.date)-start)/(end-start))*520,180-(vals[i]-lo)/(hi-lo)*145]);svg.innerHTML=`<text x="12" y="20" fill="#566c64">${hi.toFixed(1)} kg</text><polyline points="${points.map(p=>p.join(',')).join(' ')}" fill="none" stroke="#155e50" stroke-width="3"/>`+points.map((p,i)=>`<circle cx="${p[0]}" cy="${p[1]}" r="4" fill="#155e50"><title>${esc(rows[i].date)}: ${vals[i]} kg</title></circle>`).join('')+`<text x="30" y="210" fill="#566c64">${esc(rows[0].date)}</text><text x="460" y="210" fill="#566c64">${esc(rows.at(-1).date)}</text>`;}
$('connect').onclick=()=>run(async()=>{
 if(CONFIG.clientId.startsWith('PASTE')||CONFIG.spreadsheetId.startsWith('PASTE'))throw Error('Edit config.js first. Follow README.md in the download.');
 if(!window.google?.accounts?.oauth2)throw Error('Google sign-in has not loaded. Check your connection or content blocker.');
 const response=await new Promise((resolve,reject)=>google.accounts.oauth2.initTokenClient({client_id:CONFIG.clientId,scope:'https://www.googleapis.com/auth/spreadsheets',callback:r=>r.error?reject(Error(r.error)):resolve(r),error_callback:e=>reject(Error(e.type||'Sign-in cancelled'))}).requestAccessToken({prompt:''}));
 token=response.access_token;expires=Date.now()+Number(response.expires_in)*1000-30000;await initialise();
});
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{document.querySelectorAll('main>section').forEach(s=>s.hidden=s.id!==b.dataset.tab);document.querySelectorAll('[data-tab]').forEach(n=>n.setAttribute('aria-current',n===b?'page':'false'));});
$('date').value=C.day();$('weightDate').value=C.day();$('date').onchange=render;$('search').oninput=renderOptions;$('foodSelect').onchange=estimate;$('logForm').elements.amount.oninput=estimate;
function form(id,fn){$(id).onsubmit=e=>{e.preventDefault();const values=Object.fromEntries(new FormData(e.target));run(()=>fn(values));};}
let pendingLog=null;
async function saveLog(row){
 const signature=JSON.stringify({...row,id:undefined,created_at:undefined});if(!pendingLog||pendingLog.signature!==signature)pendingLog={signature,row:{...row,id:uid(),created_at:new Date().toISOString()}};
 await write('Diary',pendingLog.row);pendingLog=null;
}
form('logForm',async v=>{const f=data.Foods.find(r=>r.id===v.food);if(!f)throw Error('Add a food in the Foods tab first.');await saveLog({date:$('date').value,meal:v.meal,food_id:f.id,food_name:f.name,quantity:Number(v.amount),unit:f.basis==='100g'?'g':'servings',...C.nutrition(f,v.amount)});});
form('quickForm',async v=>{await saveLog({date:$('date').value,meal:v.meal,food_name:v.name,quantity:1,unit:'quick',kcal:Number(v.kcal)});$('quickForm').reset();});
form('foodForm',async v=>{await write('Foods',{...v,id:v.id||uid(),favourite:String($('foodForm').elements.favourite.checked)});$('foodForm').reset();});
$('cancelFood').onclick=()=>$('foodForm').reset();
form('weightForm',async v=>{await load();const old=data.Weight.find(r=>r.date===v.date);await write('Weight',{...v,id:old?.id||uid(),created_at:old?.created_at||new Date().toISOString()});});
form('settingsForm',async v=>{C.day(v.timezone);await api('/values/Settings!A2:B4?valueInputOption=RAW','PUT',{values:Object.entries(v)});await load();status('Settings saved.');});
$('refresh').onclick=()=>run(load);
$('copy').onclick=()=>run(async()=>{await load();const target=$('date').value,source=C.previous(target),rows=data.Diary.filter(r=>r.date===source);if(!rows.length)throw Error('No entries on '+source);if(!confirm(`Copy ${rows.length} entries from ${source} to ${target}? This adds to existing entries.`))return;await append('Diary',rows.map(r=>({...r,id:uid(),date:target,created_at:new Date().toISOString()})));await load();status('Previous day copied.');});
document.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(!b||busy)return;const {action,id}=b.dataset;
 if(action.startsWith('delete')){const name={deleteDiary:'Diary',deleteFood:'Foods',deleteWeight:'Weight'}[action];if(confirm('Delete this entry?'))run(()=>remove(name,id));}
 if(action==='editFood'){const f=data.Foods.find(r=>r.id===id);for(const k of C.schema.Foods){const el=$('foodForm').elements[k];if(el)el.type==='checkbox'?el.checked=f[k]==='true':el.value=f[k];}$('foodForm').scrollIntoView({behavior:'smooth'});}
 if(action==='editWeight'){const r=data.Weight.find(r=>r.id===id);for(const k of ['date','weight_kg','notes'])$('weightForm').elements[k].value=r[k];$('weightForm').scrollIntoView({behavior:'smooth'});}
 if(action==='editDiary'){const r=data.Diary.find(r=>r.id===id);const amount=prompt(r.unit==='quick'?'New calories':'New amount ('+r.unit+')',r.unit==='quick'?r.kcal:r.quantity);if(amount===null)return;const n=Number(amount);if(!Number.isFinite(n)||n<=0){status('Enter a positive number.');return;}const updated={...r};if(r.unit==='quick')updated.kcal=n;else{const ratio=n/Number(r.quantity);updated.quantity=n;C.nutrients.forEach(k=>updated[k]=Number(r[k]||0)*ratio);}run(()=>write('Diary',updated));}
});
$('export').onclick=()=>run(async()=>{await load();const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='daily-plate-backup-'+C.day()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
$('disconnect').onclick=()=>{if(token&&window.google)google.accounts.oauth2.revoke(token,()=>{});token='';expires=0;data={Foods:[],Diary:[],Weight:[],Settings:[]};render();status('Disconnected. Data remains in your spreadsheet.');};
render();document.querySelector('[data-tab="today"]').setAttribute('aria-current','page');
