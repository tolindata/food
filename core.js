(function(root){
const nutrients=['kcal','protein_g','carbs_g','fat_g'];
const schema={Foods:['id','name','brand','basis',...nutrients,'favourite'],Diary:['id','date','meal','food_id','food_name','quantity','unit',...nutrients,'created_at'],Weight:['id','date','weight_kg','notes','created_at'],Settings:['key','value']};
function nutrition(food,amount){const factor=Number(amount)/(food.basis==='100g'?100:1);return Object.fromEntries(nutrients.map(k=>[k,food[k]===''||food[k]===null||food[k]===undefined?'':Number(food[k])*factor]));}
function totals(rows){return rows.reduce((a,r)=>{nutrients.forEach(k=>a[k]+=Number(r[k]||0));return a;},Object.fromEntries(nutrients.map(k=>[k,0])));}
function day(zone='Australia/Sydney'){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());return ['year','month','day'].map(k=>parts.find(p=>p.type===k).value).join('-');}
function previous(date){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-1);return d.toISOString().slice(0,10);}
function average(rows,date){const end=Date.parse(date+'T12:00:00Z');const a=rows.filter(r=>{const t=Date.parse(r.date+'T12:00:00Z');return t<=end&&t>end-7*86400000;});return a.length?a.reduce((s,r)=>s+Number(r.weight_kg),0)/a.length:null;}
const api={nutrients,schema,nutrition,totals,day,previous,average};if(typeof module!=='undefined')module.exports=api;else root.Core=api;
})(globalThis);
