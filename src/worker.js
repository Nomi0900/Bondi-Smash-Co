// Bondi Smash Co. Worker: public API + admin API + KV database
// Secrets (Cloudflare dashboard mein set karein, kabhi chat/code mein nahin):
//   ADMIN_PASSWORD (zaroori), TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID (optional), DISCORD_WEBHOOK_URL (optional)
const J=(d,s=200,h={})=>new Response(JSON.stringify(d),{status:s,headers:{'content-type':'application/json','cache-control':'no-store',...h}});
const DEF_SETTINGS={name:'Bondi Smash Co.',phone:'+61 400 000 000',whatsapp:'61400000000',address:'123 Example St, Sydney NSW 2000',hours:'Mon-Sun: 11:00 AM - 11:00 PM',deliveryFee:5,minOrder:0,currency:'$',payment:'Pay cash on pickup/delivery, or bank transfer. [PAYMENT INSTRUCTIONS YAHAN LIKHEIN]',instagram:'',facebook:'',tiktok:'',orderingOpen:true};
const m=(id,name,desc,price,cat)=>({id,name,desc,price,cat,img:'',soldOut:false,hidden:false});
const DEF_MENU=[m('hsp','Halal Snack Pack','Chips, shawarma meat, chilli, garlic and BBQ sauce',16,'Burgers & Boxes'),m('smash','Classic Smash Burger','Double beef, cheese, pickles, special sauce',14.5,'Burgers & Boxes'),m('crispy','Crispy Chicken Burger','Golden fillet, lettuce, mayo, pickles',13.5,'Burgers & Boxes'),m('nash','Nashville Hot Chicken','Crispy chicken in fiery hot oil, pickles',15,'Burgers & Boxes'),m('fries','Loaded Fries','Cheese sauce, jalapeno, crispy chicken bits',12,'Sides'),m('wings','Wings (6 pcs)','Buffalo, honey-chilli or lemon pepper',11,'Sides'),m('tenders','Chicken Tenders','3 crispy tenders with two dips',10,'Sides'),m('wrap','Shawarma Wrap','Chicken, pickled turnip, garlic sauce',12,'Burgers & Boxes'),m('shake','Thick Shake','Oreo, Biscoff or Mango',8,'Drinks'),m('combo','Burger Combo','Burger + fries + drink',19,'Combos'),m('family','Family Box','Burgers, wings, tenders, fries, sauces',59,'Combos')];
const hex=b=>[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');
async function sign(env,msg){const k=await crypto.subtle.importKey('raw',new TextEncoder().encode('bsc:'+env.ADMIN_PASSWORD),{name:'HMAC',hash:'SHA-256'},false,['sign']);return hex(await crypto.subtle.sign('HMAC',k,new TextEncoder().encode(msg)))}
const same=(a,b)=>{a=String(a);b=String(b);let r=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)r|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return r===0};
async function isAdmin(req,env){if(!env.ADMIN_PASSWORD)return false;const t=(req.headers.get('authorization')||'').replace('Bearer ','');const [exp,sig]=t.split('.');if(!exp||!sig||Date.now()>+exp)return false;return same(sig,await sign(env,exp))}
const get=async(env,k,d)=>{const v=await env.KV.get(k,'json');return v??d};
const clip=(s,n)=>String(s??'').trim().slice(0,n);
const rid=()=>Math.random().toString(36).slice(2,6).toUpperCase();
async function notify(env,text){const t=[];
  if(env.TELEGRAM_BOT_TOKEN&&env.TELEGRAM_CHAT_ID)t.push(fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({chat_id:env.TELEGRAM_CHAT_ID,text})}));
  if(env.DISCORD_WEBHOOK_URL)t.push(fetch(env.DISCORD_WEBHOOK_URL,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({content:text.slice(0,1900)})}));
  await Promise.allSettled(t)}
async function list(env,prefix,max){const ks=[];let cursor;do{const r=await env.KV.list({prefix,cursor});ks.push(...r.keys);cursor=r.list_complete?null:r.cursor}while(cursor);
  const pick=ks.slice(-max);return (await Promise.all(pick.map(k=>env.KV.get(k.name,'json')))).filter(Boolean).reverse()}
const csvCell=v=>{v=String(v??'');if(/^[=+\-@]/.test(v))v="'"+v;return '"'+v.replace(/"/g,'""')+'"'};
const toCSV=(h,rows)=>'\ufeff'+[h.map(csvCell).join(',')].concat(rows.map(r=>r.map(csvCell).join(','))).join('\r\n');

export default {async fetch(req,env,ctx){
 const url=new URL(req.url),p=url.pathname,M=req.method;
 try{
 if(p.startsWith('/img/')){const r=await env.KV.getWithMetadata('img:'+p.slice(5),'arrayBuffer');if(!r.value)return new Response('Not found',{status:404});
   return new Response(r.value,{headers:{'content-type':r.metadata?.type||'image/jpeg','cache-control':'public, max-age=31536000, immutable'}})}
 if(!p.startsWith('/api/'))return env.ASSETS.fetch(req);
 if(!env.KV)return J({error:'KV binding missing'},500);
 if(p==='/api/public'&&M==='GET'){
   let menu=await env.KV.get('menu','json');if(!menu){menu=DEF_MENU;await env.KV.put('menu',JSON.stringify(menu))}
   const settings={...DEF_SETTINGS,...await get(env,'settings',{})};
   const reviews=(await list(env,'review:',200)).filter(r=>r.approved).slice(0,30).map(r=>({name:r.name,rating:r.rating,text:r.text}));
   return J({settings,menu:menu.filter(i=>!i.hidden),reviews})}
 if(p==='/api/order'&&M==='POST'){
   const b=await req.json(),S={...DEF_SETTINGS,...await get(env,'settings',{})},menu=await get(env,'menu',DEF_MENU);
   if(!S.orderingOpen)return J({error:'Ordering abhi band hai.'},400);
   const name=clip(b.name,60),phone=clip(b.phone,25),type=b.type==='delivery'?'delivery':'pickup',address=clip(b.address,200),notes=clip(b.notes,300);
   if(!name||!/^[0-9+\-\s()]{7,25}$/.test(phone))return J({error:'Naam aur sahi phone number likhein.'},400);
   if(type==='delivery'&&address.length<5)return J({error:'Delivery ke liye address likhein.'},400);
   if(!Array.isArray(b.items)||!b.items.length||b.items.length>30)return J({error:'Cart khali hai.'},400);
   const items=[];let sub=0;
   for(const it of b.items){const mi=menu.find(x=>x.id===it.id&&!x.hidden),q=Math.floor(+it.qty);
     if(!mi||!(q>=1&&q<=50))return J({error:'Cart mein ghalat item.'},400);
     if(mi.soldOut)return J({error:mi.name+' sold out hai.'},400);
     items.push({name:mi.name,qty:q,price:mi.price});sub+=mi.price*q}
   if(sub<(+S.minOrder||0))return J({error:'Minimum order '+S.currency+S.minOrder+' hai.'},400);
   const fee=type==='delivery'?+S.deliveryFee||0:0,id='BSC-'+rid(),key='order:'+Date.now()+'-'+id;
   const o={key,id,createdAt:new Date().toISOString(),status:'new',name,phone,type,address:type==='delivery'?address:'',notes,items,subtotal:sub,fee,total:+(sub+fee).toFixed(2)};
   await env.KV.put(key,JSON.stringify(o));
   ctx.waitUntil(notify(env,`NEW ORDER ${id}\n${name} | ${phone}\n${type.toUpperCase()}${o.address?': '+o.address:''}\n${items.map(i=>i.qty+'x '+i.name).join('\n')}\nTotal: ${S.currency}${o.total}${notes?'\nNote: '+notes:''}`));
   return J({ok:true,id,total:o.total})}
 if(p==='/api/review'&&M==='POST'){const b=await req.json(),name=clip(b.name,40),text=clip(b.text,400),rating=Math.min(5,Math.max(1,Math.floor(+b.rating||5)));
   if(!name||text.length<5)return J({error:'Naam aur review likhein.'},400);
   const key='review:'+Date.now()+'-'+rid();await env.KV.put(key,JSON.stringify({key,name,rating,text,approved:false,createdAt:new Date().toISOString()}));
   ctx.waitUntil(notify(env,`New review (approval pending) from ${name}: ${rating}/5 - ${text}`));return J({ok:true})}
 if(p==='/api/admin/login'&&M==='POST'){
   if(!env.ADMIN_PASSWORD)return J({error:'ADMIN_PASSWORD secret Cloudflare mein set nahin hai.'},500);
   const b=await req.json();await new Promise(r=>setTimeout(r,400));
   if(!same(b.password||'',env.ADMIN_PASSWORD))return J({error:'Ghalat password.'},401);
   const exp=String(Date.now()+12*3600e3);return J({token:exp+'.'+await sign(env,exp)})}
 if(p.startsWith('/api/admin/')){
   if(!await isAdmin(req,env))return J({error:'unauthorized'},401);
   if(p==='/api/admin/data'&&M==='GET'){return J({orders:await list(env,'order:',300),menu:await get(env,'menu',DEF_MENU),reviews:await list(env,'review:',200),settings:{...DEF_SETTINGS,...await get(env,'settings',{})}})}
   if(p==='/api/admin/order'&&M==='PATCH'){const b=await req.json(),o=await env.KV.get(b.key,'json');
     if(!o||!b.key.startsWith('order:')||!['new','preparing','ready','done','cancelled'].includes(b.status))return J({error:'bad'},400);
     o.status=b.status;await env.KV.put(b.key,JSON.stringify(o));return J({ok:true})}
   if(p==='/api/admin/menu'&&M==='PUT'){const a=await req.json();if(!Array.isArray(a)||a.length>200)return J({error:'bad'},400);
     const clean=a.map((i,n)=>({id:clip(i.id,40)||'i'+Date.now()+n,name:clip(i.name,60),desc:clip(i.desc,160),price:Math.max(0,+(+i.price).toFixed(2)||0),cat:clip(i.cat,30)||'Menu',img:/^\/img\/[a-z0-9]+$/.test(i.img||'')?i.img:'',soldOut:!!i.soldOut,hidden:!!i.hidden}));
     await env.KV.put('menu',JSON.stringify(clean));return J({ok:true,menu:clean})}
   if(p==='/api/admin/upload'&&M==='POST'){const ct=req.headers.get('content-type')||'';if(!/^image\/(jpeg|webp|png)$/.test(ct))return J({error:'Sirf jpeg/webp/png.'},400);
     const buf=await req.arrayBuffer();if(buf.byteLength>3e6||buf.byteLength<100)return J({error:'Image size 3MB se kam honi chahiye.'},400);
     const id=Date.now().toString(36)+rid().toLowerCase();await env.KV.put('img:'+id,buf,{metadata:{type:ct}});return J({url:'/img/'+id})}
   if(p==='/api/admin/settings'&&M==='PUT'){const b=await req.json(),s={};
     for(const k of Object.keys(DEF_SETTINGS)){const d=DEF_SETTINGS[k];s[k]=typeof d==='number'?(+b[k]||0):typeof d==='boolean'?!!b[k]:clip(b[k],400)}
     await env.KV.put('settings',JSON.stringify(s));return J({ok:true,settings:s})}
   if(p==='/api/admin/review'&&M==='PATCH'){const b=await req.json();if(!String(b.key).startsWith('review:'))return J({error:'bad'},400);
     if(b.delete){await env.KV.delete(b.key);return J({ok:true})}
     const r=await env.KV.get(b.key,'json');if(!r)return J({error:'bad'},400);r.approved=!!b.approved;await env.KV.put(b.key,JSON.stringify(r));return J({ok:true})}
   if(p==='/api/admin/csv'&&M==='GET'){const t=url.searchParams.get('type');let body;
     if(t==='reviews')body=toCSV(['Date','Name','Rating','Review','Approved'],(await list(env,'review:',1000)).map(r=>[r.createdAt,r.name,r.rating,r.text,r.approved?'yes':'no']));
     else body=toCSV(['Order ID','Date','Status','Name','Phone','Type','Address','Items','Subtotal','Delivery fee','Total','Notes'],(await list(env,'order:',5000)).map(o=>[o.id,o.createdAt,o.status,o.name,o.phone,o.type,o.address,o.items.map(i=>i.qty+'x '+i.name).join('; '),o.subtotal,o.fee,o.total,o.notes]));
     return new Response(body,{headers:{'content-type':'text/csv; charset=utf-8','content-disposition':`attachment; filename="${t==='reviews'?'reviews':'orders'}.csv"`}})}
 }
 return J({error:'not found'},404);
 }catch(e){return J({error:'Server error'},500)}
}};
