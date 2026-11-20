/* ============================================================
   MOAS · Finance tab
   Ledger of ministry funds: income and expenses.
   - Amounts are stored as whole centavos (integers), never decimals.
   - Entries are never deleted. A wrong entry is VOIDED (with a reason) and stays on record.
   - Every add / edit / void / restore is written to the "history" collection in the same batch.
   Loaded by app.js:  const FIN = initFinance({...helpers});
   ============================================================ */
import{collection,onSnapshot,doc,writeBatch,serverTimestamp,query,where,getDocs}from"https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* ---------- Settings: edit here ---------- */
const CUR="PHP";                       /* ISO currency code */
const LOCALE="en-PH";
const SYM="₱";                         /* shown in the amount field label */
const CATS={
  income:["Opening Balance","Donations / Offerings","Fundraising","Member Contributions","Parish Support","Other Income"],
  expense:["Uniforms / Vestments","Supplies / Materials","Food / Refreshments","Transportation","Formation / Retreat / Seminar","Events / Activities","Awards / Gifts","Equipment / Repairs","Other Expense"]
};
const OPEN="Opening Balance";            /* starting fund: part of the balance, not counted as income */
const C_INC="#2a9d6e",C_EXP="#7a5fc4";   /* chart colors (checked for color-blind separation) */
const MONTHS=Array.from({length:12},(_,i)=>new Date(2000,i,1).toLocaleDateString("en",{month:"long"}));

const fmt=new Intl.NumberFormat(LOCALE,{style:"currency",currency:CUR});
const money=c=>fmt.format((c||0)/100);
const signed=t=>(t.type==="income"?"+":"−")+money(t.amount);
/* "1,234.5" -> 123450 (whole centavos). Returns 0 when the text is not a valid positive amount. */
function parseAmt(v){
  const s=String(v).replace(/[,\s₱]/g,"");
  if(!/^\d{1,9}(\.\d{1,2})?$/.test(s))return 0;
  const[a,b=""]=s.split(".");
  const c=parseInt(a,10)*100+parseInt((b+"00").slice(0,2),10);
  return Number.isSafeInteger(c)&&c>0?c:0;
}
const isOpen=t=>t.type==="income"&&t.category===OPEN;
const ms=t=>t&&t.toMillis?t.toMillis():0;
const norm=x=>({...x,
  type:x.type==="expense"?"expense":"income",
  amount:Number.isSafeInteger(x.amount)&&x.amount>0?x.amount:0,
  date:/^\d{4}-\d{2}-\d{2}$/.test(x.date||"")?x.date:"",
  category:String(x.category??""),payee:String(x.payee??""),description:String(x.description??""),ref:String(x.ref??""),
  isVoid:x.status==="void"});
const byNewest=(a,b)=>b.date.localeCompare(a.date)||ms(b.createdAt)-ms(a.createdAt);

export function initFinance(X){
  const{db,auth,$,ic,esc,busy,busyEnd,toast,ask,showErr,errInfo,reauth,withTimeout,logH,hrow,pager,slice,pgClick,pg,fmtS,fmtL,today,phead,printDoc,redraw,isActive}=X;
  let all=[],err=false,loaded=false;
  const now=new Date();
  const fs={y:String(now.getFullYear()),m:"",cat:"expense",v:"ov"};   /* period, category-chart toggle, sub-tab */
  const fl={q:"",t:"all"};                                          /* ledger search and type filter */

  /* ---------- Calculations ---------- */
  const live=()=>all.filter(t=>!t.isVoid);
  /* sum: income / expenses for reports (the Opening Balance is left out).  bal: true fund balance (everything counts). */
  const sum=(l,type)=>l.filter(t=>t.type===type&&!isOpen(t)).reduce((s,t)=>s+t.amount,0);
  const bal=l=>l.reduce((s,t)=>s+(t.type==="income"?t.amount:-t.amount),0);
  const net=l=>sum(l,"income")-sum(l,"expense");
  const prefix=()=>fs.y==="all"?"":fs.y+(fs.m?"-"+fs.m:"");
  const inPeriod=t=>!prefix()||t.date.startsWith(prefix());
  const periodLabel=()=>fs.y==="all"?"All time":fs.m?`${MONTHS[+fs.m-1]} ${fs.y}`:`Year ${fs.y}`;
  const byCat=(l,type)=>{const m=new Map();l.filter(t=>t.type===type&&!isOpen(t)).forEach(t=>{const k=t.category||"Uncategorized";m.set(k,(m.get(k)||0)+t.amount)});return[...m.entries()].sort((a,b)=>b[1]-a[1])};

  /* ---------- Live data ---------- */
  function start(){
    return onSnapshot(collection(db,"finance"),
      s=>{err=false;loaded=true;all=s.docs.map(d=>norm({id:d.id,...d.data()})).sort(byNewest);if(isActive())draw()},
      ()=>{err=true;loaded=true;all=[];if(isActive())draw()});
  }
  const reset=()=>{all=[];err=false;loaded=false;fl.q="";fl.t="all";fs.v="ov";fs.m="";fs.y=String(new Date().getFullYear());fs.cat="expense"};

  /* ---------- Page shell ---------- */
  function shell(){
    $("#v").innerHTML=`<div class="ph2"><div class="ptl"><span class="eb">Ministry Funds</span><h2>Finance</h2><p>Record where the ministry's money comes from and where it goes.</p></div>
    <div class="acts"><button id="fex" class="ib" aria-label="Reports and export">${ic("expo",18)}<span>Reports</span></button><button id="fadd" class="pri addb" aria-label="Add transaction">${ic("plus",18)}<span>Add Transaction</span></button></div></div>
    <div class="fper"><label>Year<select id="fy"></select></label><label>Month<select id="fm"></select></label></div>
    <div class="chs fseg" id="fsg" role="tablist" aria-label="Finance sections"></div><div id="fbody"></div>`;
    $("#fadd").onclick=()=>openForm(null);
    $("#fex").onclick=openExport;
    $("#fy").onchange=e=>{fs.y=e.target.value;if(fs.y==="all")fs.m="";pg.f=1;draw()};
    $("#fm").onchange=e=>{fs.m=e.target.value;pg.f=1;draw()};
    $("#fsg").onclick=e=>{const b=e.target.closest("[data-sv]");if(b){fs.v=b.dataset.sv;pg.f=1;draw()}};
    $("#fbody").onclick=e=>{
      const r=e.target.closest("[data-fid]");if(r){openTx(r.dataset.fid);return}
      const c=e.target.closest("[data-fc]");if(c){fs.cat=c.dataset.fc;draw();return}
      const t=e.target.closest("[data-ft]");if(t){fl.t=t.dataset.ft;pg.f=1;draw();return}
      if(e.target.closest("#fall")){fs.v="lg";pg.f=1;draw();return}
      if(e.target.closest("#fnew")){openForm(null)}
    };
    $("#fbody").addEventListener("input",e=>{if(e.target.id==="fq"){fl.q=e.target.value;pg.f=1;drawLedger()}});
  }

  const stat=(v,l,i,c)=>`<div class="stat fst"><span class="ic ${c}">${ic(i,22)}</span><div><b>${v}</b><span>${l}</span></div></div>`;
  const dbk=d=>{if(!d)return'<span class="db"></span>';const x=new Date(d+"T00:00:00");return`<span class="db"><b>${x.getDate()}</b><small>${x.toLocaleDateString("en",{month:"short"})}</small></span>`};
  const row=t=>`<button class="li fr${t.isVoid?" vd":""}" data-fid="${esc(t.id)}">${dbk(t.date)}<span class="lt"><b>${esc(t.description||"(no description)")}</b><small>${esc([t.category,t.payee,t.ref&&"Ref "+t.ref].filter(Boolean).join(" · "))}</small></span>
    <span class="fam"><b class="${t.type}">${signed(t)}</b>${t.isVoid?'<span class="pill r">Void</span>':`<span class="pill ${t.type==="income"?"g":"n"}">${t.type==="income"?"Income":"Expense"}</span>`}</span></button>`;

  function syncControls(){
    const yrs=[...new Set([String(new Date().getFullYear()),...all.map(t=>t.date.slice(0,4)).filter(Boolean)])].sort().reverse();
    const yo=yrs.map(y=>`<option value="${y}"${fs.y===y?" selected":""}>${y}</option>`).join("")+`<option value="all"${fs.y==="all"?" selected":""}>All Years</option>`;
    const mo=`<option value="">Whole Year</option>`+MONTHS.map((n,i)=>{const v=String(i+1).padStart(2,"0");return`<option value="${v}"${fs.m===v?" selected":""}>${n}</option>`}).join("");
    if($("#fy").dataset.s!==yo){$("#fy").innerHTML=yo;$("#fy").dataset.s=yo}
    if($("#fm").dataset.s!==mo){$("#fm").innerHTML=mo;$("#fm").dataset.s=mo}
    $("#fy").value=fs.y;$("#fm").value=fs.m;$("#fm").disabled=fs.y==="all";
    $("#fsg").innerHTML=[["ov","Overview"],["lg","Ledger"]].map(([k,l])=>`<button type="button" role="tab" aria-selected="${fs.v===k}" class="ch${fs.v===k?" on":""}" data-sv="${k}">${l}</button>`).join("");
  }

  function draw(){
    if(!$("#fbody"))return;
    syncControls();
    if(!loaded){$("#fbody").innerHTML='<div class="box"><div class="skl" style="width:55%"></div><div class="skl"></div><div class="skl" style="width:80%"></div></div>';return}
    if(err){$("#fbody").innerHTML='<div class="box"><p class="none">This account cannot open the finance records. In Firebase, allow only your admin accounts to read and write the “finance” collection in the Firestore rules.</p></div>';return}
    fs.v==="lg"?drawLedger(!$("#flist")):drawOverview();
  }

  /* ---------- Overview: balance cards, charts, recent ---------- */
  function monthlyChart(){
    const L=live(),y=fs.y,keys=[];
    if(y==="all"){const d=new Date();for(let i=11;i>=0;i--){const x=new Date(d.getFullYear(),d.getMonth()-i,1);keys.push(x.getFullYear()+"-"+String(x.getMonth()+1).padStart(2,"0"))}}
    else for(let i=1;i<=12;i++)keys.push(y+"-"+String(i).padStart(2,"0"));
    const data=keys.map(k=>{const l=L.filter(t=>t.date.startsWith(k));return{k,i:sum(l,"income"),e:sum(l,"expense")}});
    const mx=Math.max(1,...data.flatMap(d=>[d.i,d.e]));
    const lab=k=>new Date(k+"-01T00:00:00").toLocaleDateString("en",{month:"short"});
    const cols=data.map(d=>`<div class="fcol" title="${esc(lab(d.k)+" "+d.k.slice(0,4)+": income "+money(d.i)+", expenses "+money(d.e))}"><span class="fbr"><i class="fi" style="height:${d.i?Math.max(d.i/mx*100,2):0}%"></i><i class="fe" style="height:${d.e?Math.max(d.e/mx*100,2):0}%"></i></span><small>${lab(d.k).slice(0,3)}</small></div>`).join("");
    const any=data.some(d=>d.i||d.e);
    return`<div class="lg"><span><i class="dt" style="background:${C_INC}"></i>Income</span><span><i class="dt" style="background:${C_EXP}"></i>Expenses</span></div>`
      +(any?`<div class="fch" role="img" aria-label="Monthly income and expenses. Highest month: ${money(mx)}. The Ledger tab lists every entry."><span class="fmx">${money(mx)}</span>${cols}</div>`:'<p class="none">No entries in this range yet.</p>');
  }
  function catChart(){
    const l=live().filter(inPeriod),type=fs.cat,rows=byCat(l,type),tot=rows.reduce((s,r)=>s+r[1],0),mx=Math.max(1,...rows.map(r=>r[1]));
    const tg=`<div class="chs" style="margin-bottom:.5rem">${["expense","income"].map(k=>`<button type="button" class="ch${type===k?" on":""}" data-fc="${k}" aria-pressed="${type===k}">${k==="expense"?"Expenses":"Income"}</button>`).join("")}</div>`;
    return tg+(rows.length?rows.map(([c,a])=>`<div class="fcat"><div class="gl"><span>${esc(c)}</span><b>${money(a)} <em>${Math.round(a/tot*100)}%</em></b></div><div class="gt ${type==="income"?"inc":"exp"}"><i style="width:${Math.max(a/mx*100,2)}%"></i></div></div>`).join(""):`<p class="none">No ${type==="income"?"income":"expenses"} recorded for ${esc(periodLabel().toLowerCase())}.</p>`);
  }
  function drawOverview(){
    const L=live(),P=L.filter(inPeriod),bl=bal(L);
    const empty=!all.length;
    $("#fbody").innerHTML=(empty?`<div class="box" style="text-align:center;padding:1.6rem 1rem"><span class="ic p" style="margin:0 auto .6rem;width:44px;height:44px">${ic("wallet",22)}</span><h3 style="justify-content:center">No records yet</h3><p class="cps">Start by recording the current balance of the fund as <b>Income</b> with the category <b>Opening Balance</b>. After that, add every offering and expense as it happens.</p><button class="pri" id="fnew" style="margin-top:.4rem">${ic("plus",18)}Add First Transaction</button></div>`:"")
    +`<div class="stats fstats">${stat(money(bl),"Current balance (all time)","wallet","p")}${stat(money(sum(P,"income")),"Income · "+esc(periodLabel()),"down","g")}${stat(money(sum(P,"expense")),"Expenses · "+esc(periodLabel()),"up","r")}${stat(money(net(P)),"Net · "+esc(periodLabel()),"doc","y")}</div>
    <div class="cols"><div class="box"><h3><span class="ic g">${ic("cal",16)}</span>Income vs Expenses</h3>${monthlyChart()}</div>
    <div class="box"><h3><span class="ic p">${ic("note",16)}</span>By Category · ${esc(periodLabel())}</h3>${catChart()}</div></div>
    <div class="box" style="margin-top:.75rem"><h3><span class="ic y">${ic("clock",16)}</span>Recent Transactions</h3>${all.length?`<div class="bl">${all.slice(0,5).map(row).join("")}</div>${all.length>5?`<button class="more" id="fall">${ic("expand",16)} View Full Ledger (${all.length})</button>`:""}`:'<p class="none">Nothing recorded yet.</p>'}</div>`;
  }

  /* ---------- Ledger ---------- */
  function drawLedger(full){
    if(full||!$("#flist")){
      $("#fbody").innerHTML=`<div class="tools"><div class="srch">${ic("search",18)}<input id="fq" type="search" placeholder="Search description, payee, category, reference" value="${esc(fl.q)}"></div></div>
      <div class="chs" id="ftc" style="margin-bottom:.7rem"></div><div class="box"><div id="flist"></div></div><div id="pgf"></div>`;
      $("#pgf").onclick=pgClick("f",()=>drawLedger());
    }
    const P=all.filter(inPeriod),q=fl.q.trim().toLowerCase();
    const cnt={all:P.length,income:P.filter(t=>!t.isVoid&&t.type==="income").length,expense:P.filter(t=>!t.isVoid&&t.type==="expense").length,void:P.filter(t=>t.isVoid).length};
    $("#ftc").innerHTML=[["all","All"],["income","Income"],["expense","Expenses"],["void","Voided"]].map(([k,l])=>`<button type="button" class="ch${fl.t===k?" on":""}" data-ft="${k}">${l} (${cnt[k]})</button>`).join("");
    const l=P.filter(t=>(fl.t==="all"||(fl.t==="void"?t.isVoid:!t.isVoid&&t.type===fl.t))&&(!q||`${t.description} ${t.payee} ${t.category} ${t.ref}`.toLowerCase().includes(q)));
    const L=l.filter(t=>!t.isVoid);
    $("#pgf").innerHTML=pager("f",l.length);
    $("#flist").innerHTML=(l.length?`<p class="cps" style="margin:0 0 .3rem">${l.length} entr${l.length===1?"y":"ies"} · ${esc(periodLabel())} · Income <b>${money(sum(L,"income"))}</b> · Expenses <b>${money(sum(L,"expense"))}</b></p><div class="bl">${slice("f",l).map(row).join("")}</div>`:`<p class="none">${all.length?"No entries match this period, search or filter.":"No transactions yet. Select Add Transaction to start."}</p>`);
  }

  /* ---------- Transaction details + audit trail ---------- */
  function openTx(id){
    const t=all.find(x=>x.id===id);if(!t)return;
    const f=(l,x,i)=>`<div class="f"><small>${i?`<span class="ri">${ic(i,14)}</span>`:""}${l}</small>${x?esc(x):'<span class="na">Not Provided</span>'}</div>`;
    $("#dlg").innerHTML=`<div class="fm"><div class="dh"><h2>${esc(t.description||"Transaction")}</h2><small class="hint">${t.type==="income"?"Income":"Expense"}${t.isVoid?" · VOID":""}</small></div>
    <div class="bd"><div class="fbig ${t.type}${t.isVoid?" vd":""}">${signed(t)}</div>${t.isVoid?`<p class="nt2" role="status"><b>Voided.</b> ${esc(t.voidReason||"No reason recorded")}${t.voidedBy?`<br><small>by ${esc(t.voidedBy)}</small>`:""}<br><small>This entry is not counted in any total.</small></p>`:""}
    ${f("Date",fmtL(t.date),"cal")}${f("Category",t.category,"note")}${f(t.type==="income"?"Received from":"Paid to",t.payee,"user")}${f("Receipt / Reference no.",t.ref,"doc")}${f("Recorded by",t.createdBy,"shield")}
    <div class="sh2" style="margin-top:.9rem">Audit Trail</div><div id="fau"><p class="cps">Loading…</p></div></div>
    <div class="foot">${t.isVoid?`<button type="button" class="lft" id="frs">Restore Entry</button>`:`<button type="button" class="del" id="fvd">${ic("trash",18)}Void</button>`}<button type="button" id="cx">Close</button>${t.isVoid?"":`<button type="button" class="pri" id="fed">${ic("edit",18)}Edit</button>`}</div></div>`;
    $("#cx").onclick=()=>$("#dlg").close();
    if(t.isVoid)$("#frs").onclick=()=>restoreTx(t);
    else{$("#fed").onclick=()=>openForm(t.id);$("#fvd").onclick=()=>openVoid(t.id)}
    if(!$("#dlg").open)$("#dlg").showModal();
    /* The full trail is read straight from the history log, so it is complete even for old entries. */
    getDocs(query(collection(db,"history"),where("refId","==",id))).then(s=>{
      const el=$("#fau");if(!el||!$("#dlg").open)return;
      const l=s.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.at&&b.at.toMillis?b.at.toMillis():Infinity)-(a.at&&a.at.toMillis?a.at.toMillis():Infinity));
      el.innerHTML=l.length?l.map(hrow).join(""):'<p class="cps">No changes recorded.</p>'}).catch(()=>{const el=$("#fau");if(el)el.innerHTML='<p class="cps">The audit trail could not be loaded. It is also listed in the History tab.</p>'});
  }

  /* ---------- Add / edit ---------- */
  const LBL={type:"Type",date:"Date",amount:"Amount",category:"Category",payee:"Received from / Paid to",description:"Description",ref:"Reference no."};
  const show=(k,v)=>k==="amount"?money(v):k==="type"?(v==="income"?"Income":"Expense"):String(v??"");
  function diffF(o,n){return Object.keys(LBL).filter(k=>String(o[k]??"")!==String(n[k]??"")).map(k=>({f:LBL[k],from:show(k,o[k]),to:show(k,n[k])}))}

  function openForm(id){
    const t=id?all.find(x=>x.id===id):null;if(id&&!t)return;
    const o=t||{type:"expense",date:today,amount:0,category:"",payee:"",description:"",ref:""};
    $("#dlg").innerHTML=`<form id="ff" novalidate><div class="dh"><h2>${id?"Edit Transaction":"New Transaction"}</h2></div>
    <div class="bd"><div class="grid">
    <div class="w"><div class="seg" role="radiogroup" aria-label="Transaction type"><label><input type="radio" name="type" value="income"${o.type==="income"?" checked":""}><span>${ic("down",16)}Income</span></label><label><input type="radio" name="type" value="expense"${o.type==="expense"?" checked":""}><span>${ic("up",16)}Expense</span></label></div></div>
    <label>Date<input name="date" type="date" required max="${today}" value="${esc(o.date)}"></label>
    <label>Amount (${SYM})<input name="amount" required inputmode="decimal" autocomplete="off" placeholder="0.00" value="${o.amount?(o.amount/100).toFixed(2):""}"></label>
    <label class="w">Category<select name="category" required></select></label>
    <label class="w">Description<input name="description" required maxlength="120" placeholder="For example, Sunday offering or Cassock cleaning" value="${esc(o.description)}"></label>
    <label id="lpy">Received from<input name="payee" maxlength="80" value="${esc(o.payee)}"></label>
    <label>Receipt / Reference no. (optional)<input name="ref" maxlength="40" value="${esc(o.ref)}"></label>
    </div><p class="err" id="fe" role="alert"></p></div>
    <div class="foot"><button type="button" id="cx">Cancel</button><button class="pri" id="fs">Save Transaction</button></div></form>`;
    const f=$("#ff"),el=f.elements;
    const type=()=>el.type.value;
    const fillCat=()=>{const cur=el.category.value||o.category,list=CATS[type()],opt=cur&&!list.includes(cur)&&(!t||t.type===type())?[...list,cur]:list;
      el.category.innerHTML=`<option value="">Select a category</option>`+opt.map(c=>`<option value="${esc(c)}"${c===cur?" selected":""}>${esc(c)}</option>`).join("");
      $("#lpy").firstChild.textContent=type()==="income"?"Received from (optional)":"Paid to (optional)"};
    f.addEventListener("change",e=>{if(e.target.name==="type"){el.category.value="";fillCat()}});
    fillCat();
    $("#cx").onclick=()=>id?openTx(id):$("#dlg").close();
    f.onsubmit=async e=>{e.preventDefault();const er=$("#fe");er.textContent="";
      const d={type:type(),date:el.date.value,amount:parseAmt(el.amount.value),category:el.category.value,payee:el.payee.value.trim(),description:el.description.value.trim(),ref:el.ref.value.trim()};
      if(!d.description){er.textContent="Please enter a description.";el.description.focus();return}
      if(!/^\d{4}-\d{2}-\d{2}$/.test(d.date)||d.date>today){er.textContent="Please choose a valid date that is not in the future.";el.date.focus();return}
      if(!d.amount){er.textContent="Enter an amount greater than zero, with up to two decimals (for example 1500.50).";el.amount.focus();return}
      if(!d.category){er.textContent="Please choose a category.";el.category.focus();return}
      const ch=id?diffF(t,d):[];
      if(id&&!ch.length){$("#dlg").close();toast("No changes to save.");return}
      /* Changing the money itself is a sensitive edit, so the password is asked again. */
      if(id&&ch.some(c=>c.f==="Amount"||c.f==="Type"||c.f==="Date")&&!await reauth())return;
      busy(id?"Saving changes…":"Recording transaction…");
      try{const b=writeBatch(db),ref=id?doc(db,"finance",id):doc(collection(db,"finance"));
        if(id)b.update(ref,d);
        else b.set(ref,{...d,status:"active",createdAt:serverTimestamp(),createdBy:auth.currentUser?.email||"unknown"});
        logH(b,id?"Edited":"Added","transaction",ref.id,d.description,id?ch:[{f:"Amount",from:"",to:signed(d)},{f:"Category",from:"",to:d.category},{f:"Date",from:"",to:d.date}]);
        await withTimeout(b.commit(),20000);busyEnd();$("#dlg").close();toast(id?"Changes saved.":"Transaction recorded.")}
      catch(x){busyEnd();console.error("Finance save failed:",x.code,x.message);showErr(errInfo(x,"save this transaction"))}};
    if(!$("#dlg").open)$("#dlg").showModal();
    el.amount.focus();
  }

  /* ---------- Void / restore (nothing is ever deleted) ---------- */
  function openVoid(id){
    const t=all.find(x=>x.id===id);if(!t)return;
    $("#dlg").innerHTML=`<form id="fv"><div class="dh"><h2>Void This Entry?</h2><small class="hint">${esc(t.description)} · ${signed(t)}</small></div>
    <div class="bd"><p class="cps" style="margin-top:0">The entry stays on record, marked <b>VOID</b>, and is left out of every balance and report total. This is the right way to correct a mistake or a duplicate.</p>
    <label class="w cps" style="display:block">Why is it being voided? (required)<textarea name="reason" required maxlength="200" placeholder="For example, duplicate entry or wrong amount"></textarea></label><p class="err" id="fe" role="alert"></p></div>
    <div class="foot"><button type="button" id="cx">Back</button><button class="dg">Void Entry</button></div></form>`;
    $("#cx").onclick=()=>openTx(id);
    $("#fv").onsubmit=async e=>{e.preventDefault();const reason=e.target.elements.reason.value.trim();
      if(reason.length<3){$("#fe").textContent="Please give a short reason.";return}
      if(!await reauth())return;
      busy("Voiding entry…");
      try{const b=writeBatch(db);
        b.update(doc(db,"finance",id),{status:"void",voidReason:reason,voidedBy:auth.currentUser?.email||"unknown",voidedAt:serverTimestamp()});
        logH(b,"Voided","transaction",id,t.description,[{f:"Amount",from:signed(t),to:"voided"},{f:"Reason",from:"",to:reason}]);
        await withTimeout(b.commit(),20000);busyEnd();$("#dlg").close();toast("Entry voided.")}
      catch(x){busyEnd();console.error("Finance void failed:",x.code,x.message);showErr(errInfo(x,"void this entry"))}};
    if(!$("#dlg").open)$("#dlg").showModal();
  }
  async function restoreTx(t){
    const ok=await ask({icon:"alert",title:"Restore This Entry?",ok:"Restore",body:`<p><b>${esc(t.description)}</b> (${signed(t)}) will count in balances and reports again.</p>`});
    if(!ok||!await reauth())return;
    busy("Restoring entry…");
    try{const b=writeBatch(db);
      b.update(doc(db,"finance",t.id),{status:"active",voidReason:"",voidedBy:"",voidedAt:null});
      logH(b,"Restored","transaction",t.id,t.description,[{f:"Amount",from:"voided",to:signed(t)}]);
      await withTimeout(b.commit(),20000);busyEnd();$("#dlg").close();toast("Entry restored.")}
    catch(x){busyEnd();console.error("Finance restore failed:",x.code,x.message);showErr(errInfo(x,"restore this entry"))}
  }

  /* ---------- Reports and export ---------- */
  function openExport(){
    if(!all.length){toast("There are no transactions to export yet.");return}
    const yrs=[...new Set([String(new Date().getFullYear()),...all.map(t=>t.date.slice(0,4)).filter(Boolean)])].sort().reverse();
    $("#dlg").innerHTML=`<form id="fx"><div class="dh"><h2>Finance Reports</h2><small class="hint">The monthly report is made for the parish priest and the council. The CSV opens in Excel or Google Sheets.</small></div>
    <div class="bd"><div class="grid">
    <label class="w">What do you want?<select name="type"><option value="pdf">Financial Report (PDF)</option><option value="csv">All Transaction Details (CSV)</option></select></label>
    <label>Year<select name="y">${yrs.map(y=>`<option value="${y}"${y===fs.y?" selected":""}>${y}</option>`).join("")}<option value="all"${fs.y==="all"?" selected":""}>All Years</option></select></label>
    <label>Month<select name="m"><option value="">Whole Year</option>${MONTHS.map((n,i)=>{const v=String(i+1).padStart(2,"0");return`<option value="${v}"${fs.m===v?" selected":""}>${n}</option>`}).join("")}</select></label>
    <label class="w a">Prepared by<input name="by" placeholder="Your name and position (optional)"></label>
    </div></div><div class="foot"><button type="button" id="cx">Cancel</button><button class="pri">${ic("expo",18)}Export</button></div></form>`;
    const f=$("#fx"),e=f.elements;
    const sync=()=>{f.querySelectorAll(".a").forEach(x=>x.hidden=e.type.value!=="pdf");if(e.y.value==="all")e.m.value="";e.m.disabled=e.y.value==="all"};
    e.type.onchange=sync;e.y.onchange=sync;sync();
    $("#cx").onclick=()=>$("#dlg").close();
    f.onsubmit=async ev=>{ev.preventDefault();
      const y=e.y.value,m=y==="all"?"":e.m.value,pre=y==="all"?"":y+(m?"-"+m:"");
      const inR=all.filter(t=>!pre||t.date.startsWith(pre));
      if(!inR.length){toast("No transactions in this period.");return}
      if(!await reauth())return;
      $("#dlg").close();
      const lab=y==="all"?"All Years":m?`${MONTHS[+m-1]} ${y}`:`Year ${y}`;
      e.type.value==="csv"?exportCsv(inR,lab):printReport(y,m,lab,e.by.value.trim())};
    $("#dlg").showModal();
  }

  function exportCsv(l,lab){
    /* Text cells starting with = + - @ are prefixed so a spreadsheet never runs them as a formula. Amounts are plain numbers. */
    const q=v=>{v=String(v??"");if(/^[=+\-@\t\r]/.test(v))v="'"+v;return`"${v.replace(/"/g,'""')}"`};
    const n=c=>c?(c/100).toFixed(2):"";
    const at=t=>t.createdAt&&t.createdAt.toDate?t.createdAt.toDate().toISOString().slice(0,16).replace("T"," "):"";
    const H=["Date","Type","Category","Received from / Paid to","Description","Reference no.","Income","Expense","Status","Void reason","Recorded by","Recorded at"];
    const rows=[H.map(q).join(",")].concat([...l].sort((a,b)=>a.date.localeCompare(b.date)||ms(a.createdAt)-ms(b.createdAt)).map(t=>[
      q(t.date),q(t.type==="income"?"Income":"Expense"),q(t.category),q(t.payee),q(t.description),q(t.ref),
      t.type==="income"?n(t.amount):"",t.type==="expense"?n(t.amount):"",q(t.isVoid?"Void":"Active"),q(t.voidReason),q(t.createdBy),q(at(t))].join(",")));
    const a=document.createElement("a");
    a.href=URL.createObjectURL(new Blob(["﻿"+rows.join("\r\n")],{type:"text/csv"}));
    a.download="moas-finance-"+lab.toLowerCase().replace(/[^a-z0-9]+/g,"-")+".csv";a.click();
  }

  function printReport(y,m,lab,by){
    const pre=y==="all"?"":y+(m?"-"+m:""),start=y==="all"?"":`${y}-${m||"01"}-01`;
    const L=live(),inR=t=>!pre||t.date.startsWith(pre);
    const open=bal(L.filter(t=>start?t.date<start||isOpen(t)&&inR(t):isOpen(t)));
    const rows=L.filter(t=>inR(t)&&!isOpen(t)).sort((a,b)=>a.date.localeCompare(b.date)||ms(a.createdAt)-ms(b.createdAt));
    const inc=sum(rows,"income"),exp=sum(rows,"expense"),close=open+inc-exp;
    const voided=all.filter(t=>t.isVoid&&inR(t)).sort((a,b)=>a.date.localeCompare(b.date));
    let run=open;
    const td=(v,c)=>`<td${c?` class="${c}"`:""}>${v}</td>`;
    const ledger=rows.map(t=>{run+=t.type==="income"?t.amount:-t.amount;return`<tr>${td(esc(fmtS(t.date)),"nw")}${td(esc(t.ref))}${td(esc(t.description)+(t.payee?`<br><small>${esc(t.payee)}</small>`:""))}${td(esc(t.category))}${td(t.type==="income"?money(t.amount):"","mny")}${td(t.type==="expense"?money(t.amount):"","mny")}${td(money(run),"mny")}</tr>`}).join("");
    const catTbl=(type)=>{const r=byCat(rows,type),tot=type==="income"?inc:exp;
      return r.length?`<table class="pdt rt"><thead><tr><th>Category</th><th class="mny">Amount</th><th class="num">Share</th></tr></thead><tbody>${r.map(([c,a])=>`<tr>${td(esc(c))}${td(money(a),"mny")}${td(Math.round(a/tot*100)+"%","num")}</tr>`).join("")}<tr class="tot">${td("Total")}${td(money(tot),"mny")}${td("")}</tr></tbody></table>`:"<p>None recorded.</p>"};
    const html=`<div class="rp">${phead("Financial Report")}
    <p class="pm">Period: <b>${esc(lab)}</b> · Generated ${fmtL(today)} · Amounts in ${CUR}</p>
    <div class="kp"><div><b class="kpm">${money(open)}</b><span>${start?"Opening balance":"Starting balance"}</span></div><div><b class="kpm">${money(inc)}</b><span>Total income</span></div><div><b class="kpm">${money(exp)}</b><span>Total expenses</span></div><div><b class="kpm">${money(close)}</b><span>Closing balance</span></div></div>
    <p>During this period the ministry received <b>${money(inc)}</b> and spent <b>${money(exp)}</b>, a ${inc-exp>=0?"net gain":"net decrease"} of <b>${money(Math.abs(inc-exp))}</b>. The fund balance at the end of the period is <b>${money(close)}</b>.</p>
    <h3>Income by Category</h3>${catTbl("income")}
    <h3>Expenses by Category</h3>${catTbl("expense")}
    <h3>Transaction Ledger</h3>
    ${rows.length||open?`<table class="pdt rt"><thead><tr><th>Date</th><th>Ref.</th><th>Description</th><th>Category</th><th class="mny">Income</th><th class="mny">Expense</th><th class="mny">Balance</th></tr></thead><tbody>${start?`<tr class="tot">${td("")}${td("")}${td("<b>Opening balance</b>")}${td("")}${td("")}${td("")}${td(money(open),"mny")}</tr>`:""}${ledger}<tr class="tot">${td("")}${td("")}${td("Totals")}${td("")}${td(money(inc),"mny")}${td(money(exp),"mny")}${td(money(close),"mny")}</tr></tbody></table>`:"<p>No transactions in this period.</p>"}
    ${voided.length?`<h3>Voided Entries (not counted above)</h3><table class="pdt rt"><thead><tr><th>Date</th><th>Description</th><th class="mny">Amount</th><th>Reason</th></tr></thead><tbody>${voided.map(t=>`<tr>${td(esc(fmtS(t.date)),"nw")}${td(esc(t.description))}${td(signed(t),"mny")}${td(esc(t.voidReason))}</tr>`).join("")}</tbody></table>`:""}
    <div class="sgn"><div>Prepared by:<br><b>${esc(by)||"&nbsp;"}</b></div><div>Checked by:<br><b>&nbsp;</b></div><div>Noted by (Parish Priest):<br><b>&nbsp;</b></div></div>
    <p class="rnote">Confidential. Every change to these records is kept in the ministry's audit history.</p></div>`;
    printDoc(html,0);
  }

  return{start,reset,shell,draw};
}