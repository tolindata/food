(function(root){
function value(v){return v!==null&&v!==''&&v!==undefined&&Number.isFinite(Number(v))&&Number(v)>=0?Number(v):null;}
function normalise(p){
 const n=p.nutriments||{};if(!p.code||!p.product_name||p.nutrition_data_per==='100ml')return null;
 const energy=value(n['energy-kcal_100g'])??(value(n.energy_100g)!==null&&n.energy_unit==='kJ'?Number(n.energy_100g)/4.184:null);
 if(energy===null)return null;
 const macros={protein_g:value(n.proteins_100g),carbs_g:value(n.carbohydrates_100g),fat_g:value(n.fat_100g)};
 const grams=value(p.serving_quantity);const serving=grams>0&&/g\b/i.test(p.serving_size||'')?grams:null;
 return {id:'off-'+p.code,name:p.product_name,brand:p.brands||'',basis:'100g',kcal:energy,...macros,servingGrams:serving,servingLabel:p.serving_size||'',source:'Open Food Facts · community supplied',url:'https://world.openfoodfacts.org/product/'+encodeURIComponent(p.code),checked:'Live database result'};
}
const restaurant=[{id:'sh-grilled-red-prawn',name:'Grilled Red Prawn Nigiri',brand:'Sushi Hub',basis:'serving',kcal:294/4.184,protein_g:4.1,carbs_g:10.2,fat_g:1.4,servingLabel:'1 listed menu portion',source:'Sushi Hub official menu · saved reference',url:'https://www.sushihub.com.au/our-products/',checked:'Checked 4 Nov 2026 · confirm the menu portion matches what you ate'}];
function matches(food,q){const words=q.toLowerCase().replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter(Boolean);const text=(food.name+' '+food.brand).toLowerCase();return words.every(w=>text.includes(w));}
function portion(food,amount,unit){let factor=Number(amount);if(food.basis==='100g')factor*=unit==='servings'?food.servingGrams/100:.01;return Object.fromEntries(['kcal','protein_g','carbs_g','fat_g'].map(k=>[k,food[k]===null?null:food[k]*factor]));}
const api={normalise,restaurant,matches,portion};if(typeof module!=='undefined')module.exports=api;else root.Online=api;
})(globalThis);
