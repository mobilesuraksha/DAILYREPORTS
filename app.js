import { initializeApp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js";
import { getFirestore, collection, addDoc, doc, setDoc, deleteDoc, onSnapshot, updateDoc, writeBatch } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyCn_9Z8oEnK03gtfC_EC-z4cONx5lMddes",
    authDomain: "ramkishan-a2c11.firebaseapp.com",
    projectId: "ramkishan-a2c11",
    storageBucket: "ramkishan-a2c11.firebasestorage.app",
    messagingSenderId: "512484078712",
    appId: "1:512484078712:web:d8f3470bd22dd37f63e98d"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let globalOrders = [];
let globalLedger = [];
let isFirstLoad = true;
const today = new Date().toISOString().split('T')[0];
const genId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

// --- HELPER FUNCTIONS ---
window.addDays = (dateStr, days) => { if(!dateStr) return ''; const d = new Date(dateStr); d.setDate(d.getDate() + days); return d.toISOString().split('T')[0]; };
window.formatDate = (d) => { if(!d) return ''; const [y, m, day] = d.split('-'); return `${day}-${m}-${y}`; };
window.formatMoney = (a) => '₹' + parseFloat(a).toFixed(2);
window.formatAMPM = (t) => { if(!t) return ''; let [h, m] = t.split(':'); h = parseInt(h); const amp = h>=12?'PM':'AM'; h=h%12; h=h?h:12; return `${h}:${m} ${amp}`; };

// --- AUTH ---
window.appLogin = async () => {
    const email = document.getElementById('loginEmail').value;
    const pass = document.getElementById('loginPass').value;
    const msg = document.getElementById('loginMsg');
    
    // Master Password Bypass
    if(email === "admin" && pass === "1234") {
        document.getElementById('loginOverlay').style.display = 'none';
        document.getElementById('mainApp').style.display = 'block';
        startDataSync(); return;
    }

    msg.textContent = "Logging in...";
    try { await signInWithEmailAndPassword(auth, email, pass); } catch (error) { msg.textContent = "Error: " + error.message; }
};
window.appLogout = () => { signOut(auth).then(() => location.reload()); };

onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('loginOverlay').style.display = 'none';
        document.getElementById('mainApp').style.display = 'block';
        startDataSync();
    } else {
        document.getElementById('loginOverlay').style.display = 'flex';
        document.getElementById('mainApp').style.display = 'none';
    }
});

function startDataSync() {
    onSnapshot(collection(db, "orders"), (snapshot) => {
        globalOrders = snapshot.docs.map(doc => doc.data());
        updateSuggestions(); populateLedgerSelect(); refreshCurrentTab(); updateStats();
        if(isFirstLoad) { checkDueNotifications(true); isFirstLoad = false; } else { checkDueNotifications(false); }
    });
    onSnapshot(collection(db, "ledger"), (snapshot) => {
        globalLedger = snapshot.docs.map(doc => doc.data());
        populateLedgerSelect(); refreshCurrentTab(); updateStats();
    });
}
function updateSuggestions() {
    const uOrders = [...new Set(globalOrders.map(o => o.no))], uCust = [...new Set(globalOrders.map(o => o.cust))];
    document.getElementById('orderNoList').innerHTML = uOrders.map(o => `<option value="${o}">`).join('');
    document.getElementById('custList').innerHTML = uCust.map(c => `<option value="${c}">`).join('');
}
function updateStats() {
    document.getElementById('statOrders').innerText = globalOrders.length;
    document.getElementById('statLedger').innerText = globalLedger.length;
}

// --- TABS & INIT ---
window.switchTab = (tabId) => {
    document.querySelectorAll('.tab-content').forEach(t => { t.style.display='none'; t.classList.remove('active-print'); });
    document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
    document.getElementById(tabId).style.display = 'block';
    document.getElementById(tabId).classList.add('active-print');
    const btn = document.querySelector(`.tab-button[data-tab="${tabId}"]`);
    if(btn) btn.classList.add('active');
    refreshCurrentTab();
}

window.openTab = (tabId, btn) => window.switchTab(tabId); // For HTML onclick compatibility

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.tab-button').forEach(btn => btn.onclick = (e) => window.switchTab(e.target.getAttribute('data-tab')));
    document.querySelectorAll('.payment-select').forEach(sel => { sel.innerHTML = ["Cash", "UPI", "Counter Pay", "Bank Transfer", "Card", "Cheque", "Other"].map(m => `<option value="${m}">${m}</option>`).join(''); });
    document.querySelectorAll('input[type="date"]').forEach(i => { if(!i.id.includes('search') && !i.id.includes('dueDetail') && !i.id.includes('split') && !i.id.includes('master')) i.value = today; });
    document.getElementById('monthInput').value = new Date().toISOString().slice(0, 7);
    updateCashierDropdown(); window.addBoxGroup();
    
    // Bind Events
    document.getElementById('btnLogin').onclick = window.appLogin;
    document.getElementById('btnLogout').onclick = window.appLogout;
    document.getElementById('btnAddBoxGroup').onclick = () => window.addBoxGroup();
    document.getElementById('discount').oninput = window.calculateGrandTotal;
    document.getElementById('advancePaid').oninput = window.calculateGrandTotal;
    document.getElementById('prodDateFilter').onchange = window.renderProduction;
    document.getElementById('prodSearchFilter').oninput = window.renderProduction;
    document.getElementById('prodSignInput').oninput = () => window.updateSign('prodSignInput','prodSignDisplay');
    document.getElementById('btnPrintProd').onclick = () => window.checkSignAndPrint('prodSignInput');
    document.getElementById('packDateFilter').onchange = window.renderPacking;
    document.getElementById('packSearchFilter').oninput = window.renderPacking;
    document.getElementById('packSignInput').oninput = () => window.updateSign('packSignInput','packSignDisplay');
    document.getElementById('btnPrintPack').onclick = () => window.checkSignAndPrint('packSignInput');
    document.getElementById('summaryDateFilter').onchange = window.renderSummary;
    document.getElementById('sumSignInput').oninput = () => window.updateSign('sumSignInput','sumSignDisplay');
    document.getElementById('btnPrintSummary').onclick = () => window.checkSignAndPrint('sumSignInput');
    document.getElementById('monthInput').onchange = window.renderMonthReports;
    document.getElementById('incSource').onchange = window.updateCashierDropdown;
    document.getElementById('btnAddIncome').onclick = window.openIncomeModal;
    document.getElementById('incSaveBtn').onclick = window.saveOtherIncome;
    document.getElementById('dueDetailDate').onchange = window.renderDuePayments;
    document.getElementById('dueSearchInput').oninput = window.renderDuePayments;
    document.getElementById('btnRefreshDue').onclick = window.renderDuePayments;
    document.getElementById('searchFromDate').onchange = window.renderAllOrders;
    document.getElementById('searchToDate').onchange = window.renderAllOrders;
    document.getElementById('searchOrder').oninput = window.renderAllOrders;
    document.getElementById('ledgerCustomerSelect').onchange = window.renderLedger;
    document.getElementById('btnAddExpense').onclick = window.addExpense;
    document.getElementById('btnExport').onclick = window.exportData;
    document.getElementById('btnImport').onclick = window.checkPassAndImport;
    document.getElementById('importFile').onchange = (e) => window.importData(e.target);
    document.getElementById('btnReset').onclick = window.dangerResetSystem;
    document.getElementById('btnSavePayment').onclick = window.savePayment;
    document.getElementById('btnUpdatePayment').onclick = window.saveEditedPayment;
    document.getElementById('splitSearchInput').oninput = window.renderSplitManager;
    document.getElementById('masterDateFilter').onchange = window.renderMasterSummary;
    document.getElementById('masterSearch').oninput = window.renderMasterSummary;
    document.getElementById('btnBulkDelivered').onclick = window.markAllPastDelivered;
    document.getElementById('btnNotif').onclick = () => window.checkDueNotifications(true);
});

function refreshCurrentTab() {
    const active = document.querySelector('.tab-content[style*="block"]');
    if(!active) return;
    const id = active.id;
    if(id==='productionTab') window.renderProduction();
    if(id==='packingTab') window.renderPacking();
    if(id==='splitTab') window.renderSplitManager();
    if(id==='masterSummaryTab') window.renderMasterSummary();
    if(id==='todaySummary') window.renderSummary();
    if(id==='monthReport') window.renderMonthReports();
    if(id==='duePayments') window.renderDuePayments();
    if(id==='allOrders') window.renderAllOrders();
    if(id==='ledgerTab') window.renderLedger();
    if(id==='expensesTab') window.renderExpenses();
}

// --- ORDER LOGIC ---
window.addBoxGroup = (data={}) => {
    const div = document.createElement('div'); div.className = 'box-group-container';
    div.innerHTML = `<div class="box-group-header"><div class="box-group-title">Box Config</div><button type="button" class="btn btn-sm btn-danger del-grp">Remove</button></div><div class="form-row" style="background:#e1f5fe; padding:10px; border-radius:6px;"><div class="form-group" style="flex:2"><label>Box Name</label><input type="text" class="group-name" value="${data.groupName||''}" placeholder="Mix Box"></div><div class="form-group"><label style="color:#d35400;">TOTAL BOXES</label><input type="number" class="group-qty" value="${data.groupQty||1}" min="1"></div></div><div class="item-list-container"><div class="items-wrapper"></div><button type="button" class="btn btn-sm btn-warning add-itm">+ Item</button></div>`;
    document.getElementById('boxContainer').appendChild(div);
    div.querySelector('.del-grp').onclick = function(){ this.closest('.box-group-container').remove(); window.calculateGrandTotal(); };
    div.querySelector('.add-itm').onclick = function(){ window.addItemToGroup(this); };
    div.querySelector('.group-qty').oninput = window.calculateGrandTotal;
    if(data.items) data.items.forEach(i => window.addItemToGroup(null, div.querySelector('.items-wrapper'), i)); else window.addItemToGroup(div.querySelector('.add-itm'));
}
window.addItemToGroup = (btn, wrapper, data={}) => {
    const w = wrapper || btn.previousElementSibling; const row = document.createElement('div'); row.className='item-row';
    row.innerHTML = `<div style="flex:3"><label>Item</label><input type="text" class="item-name" value="${data.name||''}"></div><div style="flex:1"><label>Qty</label><input type="number" class="item-qty" value="${data.qty||1}"></div><div style="flex:1"><label>Rate</label><input type="number" class="item-rate" value="${data.rate||0}"></div><div style="flex:2"><label>Note</label><input type="text" class="item-remark" value="${data.remark||''}"></div><button type="button" class="btn btn-sm btn-danger del-itm">X</button>`;
    w.appendChild(row);
    row.querySelector('.del-itm').onclick = function(){ this.parentElement.remove(); window.calculateGrandTotal(); };
    row.querySelectorAll('input').forEach(i => i.oninput = window.calculateGrandTotal);
}
window.calculateGrandTotal = () => {
    let st = 0; document.querySelectorAll('.box-group-container').forEach(g => {
        const q = parseFloat(g.querySelector('.group-qty').value)||0; let c=0;
        g.querySelectorAll('.item-row').forEach(r => c += (parseFloat(r.querySelector('.item-qty').value)||0)*(parseFloat(r.querySelector('.item-rate').value)||0));
        st += (c*q);
    });
    const disc = parseFloat(document.getElementById('discount').value)||0; const net = st-disc;
    document.getElementById('subTotal').value = st.toFixed(2); document.getElementById('totalAmount').value = net.toFixed(2);
    document.getElementById('balanceShow').value = (net - (parseFloat(document.getElementById('advancePaid').value)||0)).toFixed(2);
}
document.getElementById('orderForm').addEventListener('submit', async(e) => {
    e.preventDefault();
    const no = document.getElementById('orderNo').value.trim(), cust = document.getElementById('customerName').value.trim();
    const exist = globalOrders.find(o => o.no === no && o.cust.toLowerCase() === cust.toLowerCase());
    const isEdit = document.getElementById('orderId').value !== "";
    let merge = false;
    if(exist && !isEdit) { if(confirm(`Order #${no} exists. Merge items?`)) merge = true; else return alert("Use a different Order No or Edit the existing one."); }
    
    const bgs = [];
    document.querySelectorAll('.box-group-container').forEach(g => {
        const items = [];
        g.querySelectorAll('.item-row').forEach(r => items.push({ name: r.querySelector('.item-name').value, qty: r.querySelector('.item-qty').value, rate: r.querySelector('.item-rate').value, remark: r.querySelector('.item-remark').value }));
        bgs.push({ groupName: g.querySelector('.group-name').value, groupQty: g.querySelector('.group-qty').value, items: items, status: 'Pending' });
    });
    if(bgs.length===0) return alert("Add boxes");
    
    const id = document.getElementById('orderId').value || genId();
    const tot = parseFloat(document.getElementById('totalAmount').value)||0;
    const date = document.getElementById('orderDate').value;
    
    try {
        if(merge) {
            const newBgs = [...exist.boxGroups, ...bgs];
            const newTot = parseFloat(exist.total) + tot;
            await updateDoc(doc(db, "orders", exist.id), { boxGroups: newBgs, total: newTot });
            const lid = genId();
            await setDoc(doc(db, "ledger", lid), { id: lid, type: 'DEBIT', orderId: exist.id, cust: exist.cust, date: date, amount: tot, desc: `Order #${no} (Merged)`, itemSnapshot: bgs });
            alert("Merged!");
        } else {
            const ord = { id: id, no: no, date: date, delDate: document.getElementById('deliveryDate').value, delTime: document.getElementById('deliveryTime').value, cust: cust, mobile: document.getElementById('mobile').value, type: document.getElementById('orderType').value, note: document.getElementById('orderRemark').value, boxGroups: bgs, subTotal: parseFloat(document.getElementById('subTotal').value), discount: parseFloat(document.getElementById('discount').value), total: tot };
            if(isEdit) {
                await updateDoc(doc(db, "orders", id), ord);
                // Also update ledger debit entry
                const l = globalLedger.find(x => x.orderId === id && x.type === 'DEBIT');
                if(l) await updateDoc(doc(db, "ledger", l.id), { amount: tot, cust: cust, date: date, itemSnapshot: bgs });
                alert("Updated!");
            } else {
                await setDoc(doc(db, "orders", id), ord);
                const lid = genId();
                await setDoc(doc(db, "ledger", lid), { id: lid, type: 'DEBIT', orderId: id, cust: cust, date: date, amount: tot, desc: `Order #${no}`, itemSnapshot: bgs });
                alert("Saved!");
            }
        }
        const adv = parseFloat(document.getElementById('advancePaid').value);
        if(adv > 0) {
            const pid = genId();
            await setDoc(doc(db, "ledger", pid), { id: pid, type: 'CREDIT', orderId: merge?exist.id:id, cust: cust, date: document.getElementById('advanceDate').value, amount: adv, mode: document.getElementById('paymentMode').value, desc: 'Advance' });
        }
        document.getElementById('orderForm').reset(); document.getElementById('boxContainer').innerHTML=''; document.getElementById('orderId').value=''; window.addBoxGroup(); window.switchTab('addOrder');
    } catch(err) { alert(err.message); }
});

// --- RENDER FUNCTIONS ---
window.renderProduction = () => {
    const d = document.getElementById('prodDateFilter').value; const target = window.addDays(d, 2);
    document.getElementById('printDateProd').innerHTML = `Prod Date: <b>${window.formatDate(d)}</b> (Target: <b>${window.formatDate(target)}</b>)`;
    const q = document.getElementById('prodSearchFilter').value.toLowerCase();
    const tb = document.querySelector('#productionTable tbody'); tb.innerHTML='';
    const summary = {};
    globalOrders.forEach(o => {
        o.boxGroups.forEach(bg => {
            if(bg.status==='Cancelled'||bg.status==='Delivered') return;
            if((bg.groupDelDate||o.delDate) === target) {
                const fac = parseFloat(bg.groupQty)||0;
                bg.items.forEach(i => {
                    if(q && !i.name.toLowerCase().includes(q)) return;
                    if(!summary[i.name]) summary[i.name] = { qty:0, rem: new Set(), date: target };
                    summary[i.name].qty += (fac * (parseFloat(i.qty)||0));
                    if(i.remark) summary[i.name].rem.add(i.remark);
                });
            }
        });
    });
    if(Object.keys(summary).length===0) tb.innerHTML='<tr><td colspan="4">No orders.</td></tr>';
    for(const [n,v] of Object.entries(summary)) tb.innerHTML+=`<tr><td>${n}</td><td style="font-weight:bold;color:#d35400">${v.qty.toFixed(2)}</td><td>${window.formatDate(v.date)}</td><td>${Array.from(v.rem).join(', ')}</td></tr>`;
}

window.renderPacking = () => {
    const d = document.getElementById('packDateFilter').value; const target = window.addDays(d, 1);
    document.getElementById('printDatePack').innerHTML = `Packing Date: <b>${window.formatDate(d)}</b> (Target: <b>${window.formatDate(target)}</b>)`;
    const q = document.getElementById('packSearchFilter').value.toLowerCase();
    const tb = document.querySelector('#packingTable tbody'); tb.innerHTML='';
    let has = false;
    globalOrders.sort((a,b)=>(a.delTime||'').localeCompare(b.delTime||'')).forEach(o => {
        if(q && !o.cust.toLowerCase().includes(q)) return;
        let h = '';
        o.boxGroups.forEach(bg => {
            if(bg.status==='Cancelled'||bg.status==='Delivered') return;
            if((bg.groupDelDate||o.delDate) === target) {
                has = true; const tm = bg.groupDelTime ? ` (@ ${window.formatAMPM(bg.groupDelTime)})` : '';
                h += `<div style="border-bottom:1px dashed #eee"><b>${bg.groupQty} x ${bg.groupName}</b>${tm}<br><small>${bg.items.map(i=>`${i.name}(${i.qty})`).join(', ')}</small></div>`;
            }
        });
        if(h) tb.innerHTML+=`<tr><td>${window.formatAMPM(o.delTime)}</td><td>${o.cust}<br>${o.mobile}</td><td>${h}</td><td>${window.formatDate(target)}</td><td>${o.note||''}</td></tr>`;
    });
    if(!has) tb.innerHTML='<tr><td colspan="5">No packing tasks.</td></tr>';
}

window.renderAllOrders = () => {
    const q = document.getElementById('searchOrder').value.toLowerCase();
    const from = document.getElementById('searchFromDate').value;
    const to = document.getElementById('searchToDate').value;
    const tb = document.querySelector('#allOrdersTable tbody'); tb.innerHTML='';
    
    const list = globalOrders.filter(o => {
        if(from && o.date < from) return false;
        if(to && o.date > to) return false;
        if(q && !o.cust.toLowerCase().includes(q) && !o.no.includes(q)) return false;
        return true;
    }).sort((a,b)=>new Date(b.date)-new Date(a.date));

    list.forEach(o => {
        tb.innerHTML+=`<tr><td>${window.formatDate(o.date)}</td><td>${o.no}</td><td>${o.cust}</td><td>${o.boxGroups.length} Groups</td><td>${window.formatMoney(o.total)}</td><td class="filter-controls-screen"><button class="btn btn-sm btn-primary" onclick="window.editOrder('${o.id}')">Edit</button> <button class="btn btn-sm btn-danger" onclick="window.deleteOrder('${o.id}')">Del</button></td></tr>`;
    });
}

window.editOrder = (id) => {
    const o = globalOrders.find(x => x.id === id);
    if(!o) return;
    document.getElementById('orderId').value = o.id;
    document.getElementById('orderNo').value = o.no;
    document.getElementById('orderDate').value = o.date;
    document.getElementById('deliveryDate').value = o.delDate;
    document.getElementById('deliveryTime').value = o.delTime;
    document.getElementById('customerName').value = o.cust;
    document.getElementById('mobile').value = o.mobile;
    document.getElementById('orderType').value = o.type;
    document.getElementById('orderRemark').value = o.note;
    document.getElementById('boxContainer').innerHTML = '';
    if(o.boxGroups) o.boxGroups.forEach(bg => window.addBoxGroup(bg));
    document.getElementById('discount').value = o.discount;
    window.calculateGrandTotal();
    window.switchTab('addOrder');
}

// --- MASTER & NOTIFICATIONS ---
window.checkDueNotifications = (auto) => {
    const l = document.getElementById('notifList'); l.innerHTML=''; let c=0, pd=0;
    globalOrders.forEach(o => {
        o.boxGroups.forEach((bg, idx) => {
            const d = bg.groupDelDate || o.delDate;
            if(bg.status!=='Delivered' && bg.status!=='Cancelled' && d <= today) {
                c++; if(d < today) pd++;
                l.innerHTML+=`<div class="notif-item"><div class="notif-header"><span style="color:red">Due: ${window.formatDate(d)}</span><span>#${o.no}</span></div><div>${o.cust} - ${bg.groupQty}x ${bg.groupName}</div><div class="notif-actions"><button class="btn btn-sm btn-success" onclick="window.upSt('${o.id}',${idx},'Delivered')">Delivered</button><button class="btn btn-sm btn-primary" onclick="window.mvDt('${o.id}',${idx},'${d}')">Next Day</button><button class="btn btn-sm btn-danger" onclick="window.upSt('${o.id}',${idx},'Cancelled')">Cancel</button></div></div>`;
            }
        });
    });
    document.getElementById('bellDot').style.display = c>0?'block':'none';
    document.getElementById('bulkActionContainer').style.display = pd>0?'block':'none';
    if(c===0) l.innerHTML='<p style="text-align:center">No pending tasks.</p>';
    if(auto && c>0) document.getElementById('notificationModal').style.display='block';
}

window.upSt = async(oid, idx, st) => { if(confirm(st+"?")) { const o=globalOrders.find(x=>x.id===oid); const b=[...o.boxGroups]; b[idx].status=st; await updateDoc(doc(db,"orders",oid),{boxGroups:b}); window.checkDueNotifications(false); refreshCurrentTab(); }};
window.mvDt = async(oid, idx, d) => { const o=globalOrders.find(x=>x.id===oid); const b=[...o.boxGroups]; b[idx].groupDelDate=window.addDays(d,1); await updateDoc(doc(db,"orders",oid),{boxGroups:b}); window.checkDueNotifications(false); refreshCurrentTab(); };
window.markAllPastDelivered = async() => {
    if(!confirm("Mark ALL overdue as Delivered?")) return;
    const batch = []; let c=0;
    globalOrders.forEach(o => {
        let mod=false; const nb = o.boxGroups.map(bg => {
            const d = bg.groupDelDate || o.delDate;
            if(bg.status!=='Delivered' && bg.status!=='Cancelled' && d < today) { mod=true; c++; return {...bg, status:'Delivered'}; }
            return bg;
        });
        if(mod) batch.push(updateDoc(doc(db,"orders",o.id), {boxGroups:nb}));
    });
    await Promise.all(batch); alert(`Updated ${c} orders.`); window.checkDueNotifications(true);
}

window.renderMasterSummary = () => {
    const d = document.getElementById('masterDateFilter').value; const q = document.getElementById('masterSearch').value.toLowerCase();
    const tb = document.querySelector('#masterTable tbody'); tb.innerHTML='';
    document.getElementById('printDateMaster').innerText = d ? "Schedule: "+window.formatDate(d) : "Master Schedule";
    let ev = [];
    globalOrders.forEach(o => { o.boxGroups.forEach((bg, idx) => { ev.push({ oid:o.id, idx:idx, d: bg.groupDelDate||o.delDate, t: bg.groupDelTime||o.delTime, no:o.no, c:o.cust, m:o.mobile, g:bg.groupName, q:bg.groupQty, i:bg.items, s:bg.status||'Pending' }); }); });
    ev.filter(e => (!d || e.d===d) && (!q || e.c.toLowerCase().includes(q) || e.no.includes(q))).sort((a,b) => (a.s==='Pending' && b.s!=='Pending') ? -1 : a.d.localeCompare(b.d)).forEach(e => {
        let act = ''; let st = '';
        if(e.s==='Delivered') { act='<b style="color:green">Delivered</b>'; st='background:#e8f5e9'; }
        else if(e.s==='Cancelled') { act='<b style="color:red">Cancelled</b>'; st='background:#ffebee; color:#999'; }
        else act = `<button class="btn btn-sm btn-success" onclick="window.upSt('${e.oid}',${e.idx},'Delivered')">✓</button> <button class="btn btn-sm btn-danger" onclick="window.upSt('${e.oid}',${e.idx},'Cancelled')">X</button>`;
        tb.innerHTML += `<tr style="${st}"><td><b>${window.formatDate(e.d)}</b><br>${window.formatAMPM(e.t)}</td><td>#${e.no}</td><td>${e.c}<br>${e.m}</td><td><b>${e.q} x ${e.g}</b><br><small>${e.i.map(x=>x.name).join(',')}</small></td><td>${act}</td></tr>`;
    });
}
window.renderSplitManager = () => {
    const q = document.getElementById('splitSearchInput').value.toLowerCase();
    const c = document.getElementById('splitResultsContainer'); c.innerHTML='';
    if(q.length<2) return;
    const matches = globalOrders.filter(o=>o.cust.toLowerCase().includes(q)||o.no.includes(q));
    if(matches.length===0) { c.innerHTML='<p>No orders.</p>'; return; }
    matches.forEach(o => {
        let tq=0, pq=0, dq=0; o.boxGroups.forEach(bg=>{ const q=parseFloat(bg.groupQty)||0; tq+=q; if(bg.status==='Delivered' || (bg.status!=='Cancelled' && (bg.groupDelDate||o.delDate)<today)) dq+=q; else if(bg.status!=='Cancelled') pq+=q; });
        let h = `<table style="width:100%;font-size:12px;border-collapse:collapse"><thead style="background:#f0f0f0"><tr><th>Box</th><th>Date (Edit)</th><th>Split Qty</th><th>New Date</th><th>Action</th></tr></thead><tbody>`;
        o.boxGroups.forEach((bg,idx)=>{
            const ed = bg.groupDelDate||o.delDate; const et=bg.groupDelTime||''; const dis=(bg.status==='Delivered'||bg.status==='Cancelled')?'disabled':'';
            h+=`<tr><td style="border-bottom:1px solid #eee"><b>${bg.groupName}</b> (${bg.status})<br>Qty: ${bg.groupQty}</td><td style="border-bottom:1px solid #eee"><input type="date" id="d-u-${o.id}-${idx}" value="${ed}" style="width:90px" ${dis}><input type="time" id="t-u-${o.id}-${idx}" value="${et}" style="width:70px" ${dis}><button class="btn btn-sm btn-primary" onclick="window.updateSplitDate('${o.id}',${idx},'d-u-${o.id}-${idx}','t-u-${o.id}-${idx}')" ${dis}>Upd</button></td><td style="border-bottom:1px solid #eee"><input type="number" id="q-s-${o.id}-${idx}" style="width:50px" ${dis}></td><td style="border-bottom:1px solid #eee"><input type="date" id="d-s-${o.id}-${idx}" style="width:90px" ${dis}><input type="time" id="t-s-${o.id}-${idx}" style="width:70px" ${dis}></td><td style="border-bottom:1px solid #eee"><button class="btn btn-sm btn-warning" onclick="window.splitOrderGroup('${o.id}',${idx},'q-s-${o.id}-${idx}','d-s-${o.id}-${idx}','t-s-${o.id}-${idx}')" ${dis}>Split</button></td></tr>`;
        });
        h+='</tbody></table>';
        const card = document.createElement('div'); card.className='admin-card'; card.style.textAlign='left'; card.innerHTML = `<div style="display:flex;justify-content:space-between"><h3>${o.cust} <small>#${o.no}</small></h3><div><span class="stat-badge">Total:${tq}</span> <span class="stat-badge" style="color:green">Done:${dq}</span> <span class="stat-badge" style="color:red">Pending:${pq}</span></div></div>${h}`; c.appendChild(card);
    });
}
window.updateSplitDate = async (oid, idx, dId, tId) => {
    const d = document.getElementById(dId).value; const t = document.getElementById(tId).value;
    if(!d) return alert("Select Date");
    const order = globalOrders.find(o=>o.id===oid);
    const bgs = [...order.boxGroups]; bgs[idx].groupDelDate = d; bgs[idx].groupDelTime = t;
    await updateDoc(doc(db, "orders", oid), {boxGroups: bgs}); alert("Updated"); window.renderSplitManager();
}
window.splitOrderGroup = async (oid, idx, qId, dId, tId) => {
    const qty = parseFloat(document.getElementById(qId).value); const d = document.getElementById(dId).value; const t = document.getElementById(tId).value;
    if(!qty || !d) return alert("Enter Qty and Date");
    const order = globalOrders.find(o=>o.id===oid); const bgs = [...order.boxGroups];
    if(qty > parseFloat(bgs[idx].groupQty)) return alert("Invalid Qty");
    if(qty == parseFloat(bgs[idx].groupQty)) { bgs[idx].groupDelDate = d; bgs[idx].groupDelTime = t; }
    else { bgs[idx].groupQty -= qty; bgs.push({ groupName: bgs[idx].groupName, groupQty: qty, groupDelDate: d, groupDelTime: t, items: [...bgs[idx].items], status: 'Pending' }); }
    await updateDoc(doc(db, "orders", oid), {boxGroups: bgs}); alert("Split Done"); window.renderSplitManager();
}

// --- UTILS (UI & Standard) ---
window.updateSign = (src, dest) => document.getElementById(dest).innerText = document.getElementById(src).value;
window.checkSignAndPrint = (id) => { if(!document.getElementById(id).value) return alert("Sign required"); window.print(); };
window.updateCashierDropdown = () => {
    const s = document.getElementById('incSource').value;
    document.getElementById('incCashier').innerHTML = (s==='Showroom'?['Lokendra','Vikash','Arpit','Extra']:['Nipul','Dubey','Arpit','Extra']).map(n=>`<option>${n}</option>`).join('');
}
window.renderSummary = () => { 
    const date = document.getElementById('summaryDateFilter').value; document.getElementById('printDateSum').textContent = "Summary Date: " + window.formatDate(date); let totalInc = 0, totalExp = 0, modeCounts = {}, totalSweetsCash = 0; const cashierData = {'Lokendra':{cash:0,online:0,expense:0}, 'Vikash':{cash:0,online:0,expense:0}, 'Nipul':{cash:0,online:0,expense:0}, 'Dubey':{cash:0,online:0,expense:0}, 'Arpit':{cash:0,online:0,expense:0}};
    globalLedger.forEach(l => { if(l.date === date) { const amt = parseFloat(l.amount)||0; const m = (l.mode||'').trim(); const isCash = m.toLowerCase() === 'cash'; if(l.type === 'CREDIT') { totalInc+=amt; modeCounts[m]=(modeCounts[m]||0)+amt; if(isCash) totalSweetsCash+=amt; } else if(l.type === 'EXTRA_INCOME') { totalInc+=amt; if(l.cashier && cashierData[l.cashier]) { isCash ? cashierData[l.cashier].cash+=amt : cashierData[l.cashier].online+=amt; } } else if(l.type === 'EXPENSE') { totalExp+=amt; if(l.cashier && cashierData[l.cashier]) cashierData[l.cashier].expense+=amt; } } });
    let totalUdhaar = 0; globalOrders.filter(o => o.delDate === date).forEach(o => { const paid = globalLedger.filter(l => (l.type === 'CREDIT' || l.type === 'DISCOUNT') && l.orderId === o.id).reduce((s,l)=>s+parseFloat(l.amount||0),0); if(o.total-paid > 0) totalUdhaar+=(o.total-paid); });
    let boxes = `<div class="summary-card" style="border-left-color:#4caf50; background:#e8f5e9;"><h4>Sweets Cash</h4><div class="value">${window.formatMoney(totalSweetsCash)}</div></div><div class="summary-card" style="border-left-color:#f44336; background:#ffebee;"><h4>Expenses</h4><div class="value" style="color:#c62828;">- ${window.formatMoney(totalExp)}</div></div><div class="summary-card" style="border-left-color:#2196f3; background:#e3f2fd;"><h4>NET CASH</h4><div class="value" style="color:#1565c0;">${window.formatMoney(totalSweetsCash - totalExp)}</div></div>`;
    for(const [m,v] of Object.entries(modeCounts)) if(v>0) boxes += `<div class="summary-card"><h4>${m}</h4><div class="value">${window.formatMoney(v)}</div></div>`;
    if(totalUdhaar>0) boxes += `<div class="summary-card" style="border-left-color:#9c27b0; background:#f3e5f5;"><h4>Pending Due</h4><div class="value">${window.formatMoney(totalUdhaar)}</div></div>`;
    document.getElementById('summaryDashboard').innerHTML = boxes;
    const tbody = document.querySelector('#summaryTable tbody'); tbody.innerHTML = '';
    globalOrders.filter(o => o.delDate === date).forEach(o => { const paid = globalLedger.filter(l => (l.type === 'CREDIT' || l.type === 'DISCOUNT') && l.orderId === o.id).reduce((s,l)=>s+parseFloat(l.amount),0); const boxStr = o.boxGroups.map(bg => `<b>${bg.groupQty} x ${bg.groupName}</b>`).join('<br>'); tbody.innerHTML += `<tr><td>${o.no}</td><td>${window.formatDate(o.delDate)}</td><td>${o.cust}</td><td>${boxStr}</td><td>${window.formatMoney(o.total)}</td><td>${window.formatMoney(paid)}</td><td style="color:${(o.total-paid)>0?'red':'green'}">${window.formatMoney(o.total-paid)}</td></tr>`; });
    const cashTbody = document.querySelector('#cashierSummaryTable tbody'); cashTbody.innerHTML = '';
    for(const [n,d] of Object.entries(cashierData)) if(d.cash>0||d.online>0||d.expense>0) cashTbody.innerHTML += `<tr><td>${n}</td><td style="text-align:right; color:green;">${window.formatMoney(d.cash)}</td><td style="text-align:right; color:blue;">${window.formatMoney(d.online)}</td><td style="text-align:right; color:red;">${window.formatMoney(d.expense)}</td><td style="text-align:right; font-weight:bold;">${window.formatMoney(d.cash-d.expense)}</td></tr>`;
    const expTbody = document.querySelector('#summaryExpenseTable tbody'); expTbody.innerHTML = ''; globalLedger.filter(l => l.type === 'EXPENSE' && l.date === date).forEach(ex => expTbody.innerHTML += `<tr><td>${ex.desc}</td><td>${ex.mode}</td><td style="font-weight:bold; color:#c0392b;">${window.formatMoney(ex.amount)}</td></tr>`);
}
window.renderMonthReports = () => { 
    const m = document.getElementById('monthInput').value; if(!m) return; document.getElementById('printDateMonth').innerText = "Report: " + m;
    let grand = {orders:0,sweets:0,rest:0,show:0,exp:0}; const daily = {};
    globalOrders.forEach(o => { if(o.date.startsWith(m)) { if(!daily[o.date]) daily[o.date]={sales:0,orders:0}; daily[o.date].sales+=parseFloat(o.total); daily[o.date].orders++; }});
    globalLedger.forEach(l => { if(l.date.startsWith(m)) { if(!daily[l.date]) daily[l.date]={sales:0,sweets:0,rest:0,show:0,exp:0}; const amt=parseFloat(l.amount); if(l.type==='CREDIT') daily[l.date].sweets = (daily[l.date].sweets||0)+amt; else if(l.type==='EXTRA_INCOME') { if(l.source==='Restaurant') daily[l.date].rest = (daily[l.date].rest||0)+amt; else daily[l.date].show = (daily[l.date].show||0)+amt; } else if(l.type==='EXPENSE') daily[l.date].exp = (daily[l.date].exp||0)+amt; }});
    const tbody = document.getElementById('monthTableBody'); tbody.innerHTML = '';
    Object.keys(daily).sort().forEach(d => { const r = daily[d]; const tot = (r.sweets||0)+(r.rest||0)+(r.show||0); const net = tot-(r.exp||0); grand.orders+=(r.orders||0); grand.sweets+=(r.sweets||0); grand.rest+=(r.rest||0); grand.show+=(r.show||0); grand.exp+=(r.exp||0); tbody.innerHTML += `<tr><td>${window.formatDate(d)}</td><td>${r.orders||0}</td><td style="text-align:right">${window.formatMoney(r.sweets||0)}</td><td style="text-align:right">${window.formatMoney(r.rest||0)}</td><td style="text-align:right">--</td><td style="text-align:right">${window.formatMoney(r.show||0)}</td><td style="text-align:right">--</td><td style="text-align:right; font-weight:bold; color:green">${window.formatMoney(tot)}</td><td style="text-align:right; color:red">${window.formatMoney(r.exp||0)}</td><td style="text-align:right; font-weight:bold">${window.formatMoney(net)}</td></tr>`; });
    document.getElementById('monthDashboard').innerHTML = `<div class="summary-card"><h4>Sweets</h4><div class="value">${window.formatMoney(grand.sweets)}</div></div><div class="summary-card"><h4>Rest.</h4><div class="value">${window.formatMoney(grand.rest)}</div></div><div class="summary-card"><h4>Showroom</h4><div class="value">${window.formatMoney(grand.show)}</div></div><div class="summary-card" style="border-left-color:green; background:#e8f5e9"><h4>Net Profit</h4><div class="value">${window.formatMoney((grand.sweets+grand.rest+grand.show)-grand.exp)}</div></div>`;
    const etb = document.querySelector('#otherIncomeTable tbody'); etb.innerHTML=''; globalLedger.filter(l => l.type === 'EXTRA_INCOME' && l.date.startsWith(m)).forEach(i => etb.innerHTML+=`<tr><td>${window.formatDate(i.date)}</td><td>${i.source} (${i.cashier})</td><td>${window.formatMoney(i.amount)}</td><td>${i.mode}</td><td><button class="btn btn-sm btn-danger" onclick="window.deleteTransaction('${i.id}')">X</button></td></tr>`);
}
window.renderDuePayments = () => { 
    const q=document.getElementById('dueSearchInput').value.toLowerCase(); const fd=document.getElementById('dueDetailDate').value; const tb=document.querySelector('#dueTable tbody'); tb.innerHTML='';
    globalOrders.forEach(o=>{ if(fd && o.date!==fd) return; const p=globalLedger.filter(l=>(l.type==='CREDIT'||l.type==='DISCOUNT')&&l.orderId===o.id).reduce((s,x)=>s+parseFloat(x.amount),0); const d=o.total-p; if(d>1 && (!q || o.cust.toLowerCase().includes(q) || o.no.includes(q))) tb.innerHTML+=`<tr><td>${window.formatDate(o.date)}</td><td>${o.no}</td><td>${o.cust}</td><td>${window.formatMoney(o.total)}</td><td>${window.formatMoney(p)}</td><td style="color:red;font-weight:bold">${window.formatMoney(d)}</td><td class="filter-controls-screen"><button class="btn btn-sm btn-success" onclick="window.openPay('${o.id}')">Pay</button></td></tr>`; });
}
window.renderLedger = () => { 
    const c = document.getElementById('ledgerCustomerSelect').value; if(!c) { document.getElementById('ledgerContent').style.display='none'; return; }
    document.getElementById('ledgerContent').style.display='block'; document.getElementById('printLedgerCustName').innerText=c;
    const l = globalLedger.filter(x=>x.cust===c).sort((a,b)=>new Date(a.date)-new Date(b.date));
    const tb = document.querySelector('#ledgerTable tbody'); tb.innerHTML=''; let bal=0; let deb=0; let cred=0;
    l.forEach(x=>{ const a=parseFloat(x.amount); if(x.type==='DEBIT'){bal+=a; deb+=a;} else {bal-=a; cred+=a;} tb.innerHTML+=`<tr><td>${window.formatDate(x.date)}</td><td>${x.desc}</td><td style="text-align:right">${x.type==='DEBIT'?window.formatMoney(a):''}</td><td style="text-align:right">${x.type!=='DEBIT'?window.formatMoney(a):''}</td><td style="text-align:right; font-weight:bold">${window.formatMoney(bal)}</td><td class="filter-controls-screen"></td></tr>`; });
    document.getElementById('ledgerTotalDebit').innerText=window.formatMoney(deb); document.getElementById('ledgerTotalCredit').innerText=window.formatMoney(cred); document.getElementById('ledgerBalance').innerText=window.formatMoney(bal);
}
window.populateLedgerSelect = () => { const s = document.getElementById('ledgerCustomerSelect'); const v = s.value; const c = [...new Set([...globalOrders.map(o=>o.cust), ...globalLedger.map(l=>l.cust)])].sort(); s.innerHTML='<option value="">-- Select --</option>'; c.forEach(x=>s.innerHTML+=`<option value="${x}" ${x===v?'selected':''}>${x}</option>`); }
window.exportData = () => { if(prompt("Admin Password")!=="1234") return alert("Wrong Password"); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify({orders:globalOrders, ledger:globalLedger})], {type:'application/json'})); a.download='Backup.json'; a.click(); }
window.checkPassAndImport = () => { if(prompt("Admin Password")!=="1234") return alert("Wrong Password"); document.getElementById('importFile').click(); }
window.importData = (i) => { const f=i.files[0]; const r=new FileReader(); r.onload=async(e)=>{ const d=JSON.parse(e.target.result); const b=writeBatch(db); if(d.orders) d.orders.forEach(o=>b.set(doc(db,"orders",o.id),o)); if(d.ledger) d.ledger.forEach(l=>b.set(doc(db,"ledger",l.id),l)); await b.commit(); alert("Restored!"); }; r.readAsText(f); i.value=''; }
window.dangerResetSystem = async () => { if(prompt("Admin Password")!=="1234" || prompt("Type DELETE")!=="DELETE") return alert("Cancelled"); const p=[]; globalOrders.forEach(o=>p.push(deleteDoc(doc(db,"orders",o.id)))); globalLedger.forEach(l=>p.push(deleteDoc(doc(db,"ledger",l.id)))); await Promise.all(p); alert("Reset Complete"); location.reload(); }
window.deleteOrder = async (id) => { if(prompt("Admin Password")!=="1234") return alert("Access Denied"); if(confirm("Delete Order & Ledger?")) { await deleteDoc(doc(db,"orders",id)); const l=globalLedger.filter(x=>x.orderId===id); l.forEach(x=>deleteDoc(doc(db,"ledger",x.id))); alert("Deleted"); } }
window.deleteTransaction = async (id) => { if(confirm("Delete entry?")) { await deleteDoc(doc(db,"ledger",id)); alert("Deleted"); } }
window.openPay = (id) => { document.getElementById('modalOrderId').value=id; document.getElementById('modalPayDate').value=today; document.getElementById('payModal').style.display='block'; }
window.addExpense = async () => { const id=genId(); await setDoc(doc(db,"ledger",id), {id:id, type:'EXPENSE', date:document.getElementById('expDate').value, amount:parseFloat(document.getElementById('expAmt').value), mode:document.getElementById('expMode').value, desc:document.getElementById('expDetail').value, cashier:document.getElementById('expCashier').value}); alert("Added"); }
window.savePayment = async () => { const id = document.getElementById('modalOrderId').value; const amt = parseFloat(document.getElementById('modalPayAmt').value); const disc = parseFloat(document.getElementById('modalDiscount').value); const mode = document.getElementById('modalPayMode').value; const d = document.getElementById('modalPayDate').value; const o = globalOrders.find(x => x.id === id);
    if(amt > 0) { const pid = genId(); await setDoc(doc(db, "ledger", pid), {id: pid, type:'CREDIT', orderId:id, cust:o.cust, date:d, amount:amt, mode:mode, desc:'Payment'}); }
    if(disc > 0) { const did = genId(); await setDoc(doc(db, "ledger", did), {id: did, type:'DISCOUNT', orderId:id, cust:o.cust, date:d, amount:disc, mode:'Discount', desc:'Discount'}); }
    document.getElementById('payModal').style.display = 'none'; alert("Saved");
}
window.saveEditedPayment = async () => { await updateDoc(doc(db, "ledger", document.getElementById('editPayId').value), { date: document.getElementById('editPayDate').value, amount: parseFloat(document.getElementById('editPayAmt').value), mode: document.getElementById('editPayMode').value }); document.getElementById('editPayModal').style.display = 'none'; alert("Updated"); }
window.saveOtherIncome = async () => { const id = document.getElementById('incId').value || genId(); const d = { id: id, type: 'EXTRA_INCOME', date: document.getElementById('incDate').value, amount: parseFloat(document.getElementById('incAmt').value), source: document.getElementById('incSource').value, cashier: document.getElementById('incCashier').value, mode: document.getElementById('incMode').value, desc: 'Income' }; await setDoc(doc(db, "ledger", id), d); document.getElementById('incomeModal').style.display = 'none'; alert("Saved"); }
window.openIncomeModal = () => { document.getElementById('incId').value=''; document.getElementById('incAmt').value=''; document.getElementById('incomeModal').style.display='block'; }
