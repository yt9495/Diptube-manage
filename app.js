// ══════════════════════════════════════════════
//  Dip Tube Inventory Management System
//  Firebase v9 — No Login Required
// ══════════════════════════════════════════════

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const app = initializeApp(window.FIREBASE_CONFIG);
const db  = getFirestore(app);

const DEFAULT_ITEMS = [
  { id: "code12", name: "HF (Hydrofluoric Acid)",    code: "Code 12", type: "key",    unit: "ea", stock: 0, safety: 5 },
  { id: "code6",  name: "HCl (Hydrochloric Acid)",   code: "Code 6",  type: "key",    unit: "ea", stock: 0, safety: 5 },
  { id: "code17", name: "KOH (Potassium hydroxide)",  code: "Code 17", type: "key",    unit: "ea", stock: 0, safety: 5 },
  { id: "code7",  name: "H₂O₂ (Hydrogen Peroxide)",  code: "Code 7",  type: "key",    unit: "ea", stock: 0, safety: 5 },
  { id: "code1",  name: "HNO₃ (Nitric Acid)",        code: "Code 1",  type: "key",    unit: "ea", stock: 0, safety: 5 },
  { id: "code2",  name: "H₂SO₄ (Sulfuric Acid)",     code: "Code 2",  type: "key",    unit: "ea", stock: 0, safety: 5 },
];

let inventoryItems = [];
let transactions   = [];

// ── Start ──
async function startApp() {
  document.getElementById("app").classList.remove("hidden");
  await ensureDefaultItems();
  startListeners();
  switchView("dashboard");
}
startApp();

async function ensureDefaultItems() {
  const snap = await getDocs(collection(db, "inventory"));
  if (snap.empty) {
    for (const item of DEFAULT_ITEMS) {
      await setDoc(doc(db, "inventory", item.id), {
        name: item.name, code: item.code, type: item.type,
        unit: item.unit, stock: item.stock, safety: item.safety,
        updatedAt: serverTimestamp()
      });
    }
  }
}

// ── Listeners ──
function startListeners() {
  onSnapshot(collection(db, "inventory"), (snap) => {
    inventoryItems = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    inventoryItems.sort((a, b) => {
      if (a.type === b.type) return a.name.localeCompare(b.name);
      return a.type === "key" ? -1 : 1;
    });
    renderDashboard();
    renderInventory();
    renderSettings();
    populateSelects();
  });

  // date 단일 정렬 — 복합 인덱스 불필요
  const txRef = query(collection(db, "transactions"), orderBy("date", "desc"));
  onSnapshot(txRef, (snap) => {
    transactions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderHistory();
  });
}

// ── Navigation ──
document.querySelectorAll(".nav-item").forEach(btn => {
  btn.addEventListener("click", () => {
    switchView(btn.dataset.view);
    document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
  });
});

function switchView(name) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.getElementById("view-" + name).classList.add("active");
}

// ── Dashboard ──
function renderDashboard() {
  document.getElementById("last-updated").textContent =
    "Updated: " + new Date().toLocaleString("ko-KR");

  const total  = inventoryItems.length;
  const danger = inventoryItems.filter(i => i.stock === 0).length;
  const warn   = inventoryItems.filter(i => i.stock > 0 && i.stock <= i.safety).length;
  const ok     = total - danger - warn;

  document.getElementById("stats-grid").innerHTML = `
    <div class="stat-card"><div class="stat-label">Total Items</div><div class="stat-value">${total}</div></div>
    <div class="stat-card ok"><div class="stat-label">정상</div><div class="stat-value">${ok}</div></div>
    <div class="stat-card warning"><div class="stat-label">재고 부족</div><div class="stat-value">${warn}</div></div>
    <div class="stat-card danger"><div class="stat-label">재고 없음</div><div class="stat-value">${danger}</div></div>
  `;

  const alertItems = inventoryItems.filter(i => i.stock <= i.safety);
  const banner = document.getElementById("alert-banner");
  if (alertItems.length > 0) {
    banner.classList.remove("hidden");
    banner.innerHTML = `<strong>⚠ 안전 재고 경고 (${alertItems.length}개 항목)</strong><br/>` +
      alertItems.map(i =>
        `• ${i.name} (${i.code}): 현재 <b>${i.stock} ${i.unit}</b> — 안전재고: ${i.safety} ${i.unit}` +
        (i.stock === 0 ? " &nbsp;<span style='color:var(--red-text);font-weight:600'>[재고 없음]</span>" : "")
      ).join("<br/>");
  } else {
    banner.classList.add("hidden");
  }

  document.getElementById("dashboard-tbody").innerHTML =
    inventoryItems.map((item, idx) => `<tr>
      <td>${idx + 1}</td>
      <td class="chemical-name">${item.name}</td>
      <td><span class="code-badge">${item.code}</span></td>
      <td><span class="stock-value ${stockClass(item)}">${item.stock} ${item.unit}</span></td>
      <td>${item.safety} ${item.unit}</td>
      <td>${statusBadge(getStatus(item))}</td>
      <td style="font-size:12px;color:var(--text3);font-family:var(--font-mono)">${fmtTs(item.updatedAt)}</td>
    </tr>`).join("") || emptyRow(7);
}

// ── Inventory ──
function renderInventory() {
  document.getElementById("inventory-tbody").innerHTML =
    inventoryItems.map((item, idx) => `<tr>
      <td>${idx + 1}</td>
      <td class="chemical-name">${item.name}</td>
      <td><span class="code-badge">${item.code}</span></td>
      <td><span class="type-badge type-${item.type}">${item.type === "key" ? "Key Code" : "Non-Key"}</span></td>
      <td><span class="stock-value ${stockClass(item)}">${item.stock} ${item.unit}</span></td>
      <td>${item.safety} ${item.unit}</td>
      <td>${item.unit}</td>
      <td>${statusBadge(getStatus(item))}</td>
      <td>
        <div class="action-btns">
          <button class="btn-ghost btn-sm" onclick="editItem('${item.id}')">Edit</button>
          <button class="btn-danger" onclick="deleteItem('${item.id}', '${item.name.replace(/'/g,"\\'")}')">Del</button>
        </div>
      </td>
    </tr>`).join("") || emptyRow(9);
}

// ── History ──
function renderHistory(filtered) {
  const data = filtered || transactions;
  document.getElementById("history-tbody").innerHTML =
    data.map(tx => {
      const item = inventoryItems.find(i => i.id === tx.itemId);
      const name = item ? item.name : (tx.itemName || tx.itemId);
      const typeLabel = tx.type === "in" ? "📥 입고" : tx.type === "out" ? "📤 사용" : "✏ 수정";
      const typeCls   = tx.type === "in" ? "tx-in" : tx.type === "out" ? "tx-out" : "tx-set";
      const qty = tx.type === "out" ? `-${tx.qty}` : tx.type === "in" ? `+${tx.qty}` : `=${tx.qty}`;
      return `<tr>
        <td style="font-family:var(--font-mono);font-size:12px">${tx.date || "—"}</td>
        <td class="chemical-name">${name}</td>
        <td class="${typeCls}">${typeLabel}</td>
        <td style="font-family:var(--font-mono)">${qty} ${tx.unit || ""}</td>
        <td style="font-family:var(--font-mono)">${tx.stockAfter ?? "—"} ${tx.unit || ""}</td>
        <td style="color:var(--text2)">${tx.memo || "—"}</td>
        <td style="font-size:12px;color:var(--text3)">${tx.operator || "—"}</td>
      </tr>`;
    }).join("") || emptyRow(7);
}

// ── Settings ──
function renderSettings() {
  document.getElementById("safety-settings-list").innerHTML =
    inventoryItems.map(item => `
      <div class="safety-item">
        <div class="safety-name">${item.name} <span class="code">${item.code}</span></div>
        <input type="number" min="0" data-id="${item.id}" value="${item.safety}" />
        <span style="font-size:12px;color:var(--text2)">${item.unit}</span>
      </div>`).join("");

  document.getElementById("override-item").innerHTML =
    inventoryItems.map(i => `<option value="${i.id}">${i.name} (${i.code})</option>`).join("");

  document.getElementById("config-display").innerHTML =
    Object.entries(window.FIREBASE_CONFIG)
      .map(([k, v]) => `<div><span style="color:var(--blue-text)">${k}</span>: "${v}"</div>`)
      .join("");
}

// ── Selects ──
function populateSelects() {
  ["tx-item", "filter-item"].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const prev = el.value;
    const base = id === "filter-item" ? '<option value="">All Items</option>' : "";
    el.innerHTML = base + inventoryItems.map(i =>
      `<option value="${i.id}">${i.name} (${i.code})</option>`).join("");
    if (prev) el.value = prev;
  });
}

// ── Transactions ──
document.getElementById("tx-date").value = new Date().toISOString().split("T")[0];

document.getElementById("btn-submit-tx").addEventListener("click", async () => {
  const itemId   = document.getElementById("tx-item").value;
  const type     = document.getElementById("tx-type").value;
  const qty      = parseInt(document.getElementById("tx-qty").value);
  const memo     = document.getElementById("tx-memo").value.trim();
  const date     = document.getElementById("tx-date").value;
  const operator = document.getElementById("tx-operator").value.trim() || "—";

  if (!itemId || !qty || qty < 1 || !date) { alert("날짜, 항목, 수량을 모두 입력하세요."); return; }

  const item = inventoryItems.find(i => i.id === itemId);
  if (!item) return;

  let newStock = item.stock;
  if (type === "in")       newStock += qty;
  else if (type === "out") newStock = Math.max(0, newStock - qty);

  try {
    await updateDoc(doc(db, "inventory", itemId), { stock: newStock, updatedAt: serverTimestamp() });
    await addDoc(collection(db, "transactions"), {
      itemId, itemName: item.name, type, qty,
      stockAfter: newStock, unit: item.unit,
      memo, date, operator, createdAt: serverTimestamp()
    });
    document.getElementById("tx-qty").value  = "";
    document.getElementById("tx-memo").value = "";
    alert(`✓ 완료\n${item.name}: ${type === "in" ? "+" : "-"}${qty} → 재고 ${newStock} ${item.unit}`);
  } catch (e) { alert("오류: " + e.message); }
});

// ── Safety Levels ──
document.getElementById("btn-save-safety").addEventListener("click", async () => {
  const inputs = document.querySelectorAll("#safety-settings-list input[data-id]");
  await Promise.all([...inputs].map(inp => {
    const val = parseInt(inp.value);
    if (!isNaN(val) && val >= 0)
      return updateDoc(doc(db, "inventory", inp.dataset.id), { safety: val });
  }));
  alert("✓ 안전 재고 레벨이 저장되었습니다.");
});

// ── Override Stock ──
document.getElementById("btn-override").addEventListener("click", async () => {
  const itemId   = document.getElementById("override-item").value;
  const qty      = parseInt(document.getElementById("override-qty").value);
  const reason   = document.getElementById("override-reason").value.trim();
  const operator = document.getElementById("override-operator").value.trim() || "—";
  if (!itemId || isNaN(qty) || qty < 0) { alert("항목과 수량을 입력하세요."); return; }
  const item = inventoryItems.find(i => i.id === itemId);
  if (!item) return;
  if (!confirm(`${item.name}의 재고를 ${qty} ${item.unit}으로 수정하시겠습니까?`)) return;
  try {
    await updateDoc(doc(db, "inventory", itemId), { stock: qty, updatedAt: serverTimestamp() });
    await addDoc(collection(db, "transactions"), {
      itemId, itemName: item.name, type: "set", qty,
      stockAfter: qty, unit: item.unit,
      memo: reason || "수동 재고 수정",
      date: new Date().toISOString().split("T")[0],
      operator, createdAt: serverTimestamp()
    });
    document.getElementById("override-qty").value    = "";
    document.getElementById("override-reason").value = "";
    alert("✓ 재고가 수정되었습니다.");
  } catch (e) { alert("오류: " + e.message); }
});

// ── Modal ──
document.getElementById("btn-add-item").addEventListener("click", () => openModal(null));
document.getElementById("modal-close").addEventListener("click", () => closeModal());
document.getElementById("modal-overlay").addEventListener("click", (e) => {
  if (e.target === document.getElementById("modal-overlay")) closeModal();
});

function openModal(item) {
  const isEdit = !!item;
  document.getElementById("modal-title").textContent = isEdit ? "Edit Item" : "Add New Item";
  document.getElementById("modal-body").innerHTML = `
    <div class="form-group">
      <label>Chemical Name</label>
      <input id="m-name" type="text" value="${isEdit ? item.name : ""}" placeholder="e.g. HF (Hydrofluoric Acid)" />
    </div>
    <div class="form-group">
      <label>Model / Key Code</label>
      <input id="m-code" type="text" value="${isEdit ? item.code : ""}" placeholder="e.g. Code 12" />
    </div>
    <div class="form-group">
      <label>Type</label>
      <select id="m-type">
        <option value="key"    ${isEdit && item.type === "key"    ? "selected" : ""}>Key Code</option>
        <option value="nonkey" ${isEdit && item.type === "nonkey" ? "selected" : ""}>Non-Key Code</option>
      </select>
    </div>
    <div class="form-group">
      <label>Unit</label>
      <input id="m-unit" type="text" value="${isEdit ? item.unit : "ea"}" placeholder="ea / bottle / L" />
    </div>
    <div class="form-group">
      <label>Initial Stock</label>
      <input id="m-stock" type="number" min="0" value="${isEdit ? item.stock : 0}" />
    </div>
    <div class="form-group">
      <label>Safety Level</label>
      <input id="m-safety" type="number" min="0" value="${isEdit ? item.safety : 5}" />
    </div>
    <div class="modal-actions">
      <button class="btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn-primary" onclick="saveItem('${isEdit ? item.id : ""}')">Save</button>
    </div>
  `;
  document.getElementById("modal-overlay").classList.remove("hidden");
}

function closeModal() {
  document.getElementById("modal-overlay").classList.add("hidden");
}

function editItem(id) {
  const item = inventoryItems.find(i => i.id === id);
  if (item) openModal(item);
}

async function saveItem(id) {
  const name   = document.getElementById("m-name").value.trim();
  const code   = document.getElementById("m-code").value.trim();
  const type   = document.getElementById("m-type").value;
  const unit   = document.getElementById("m-unit").value.trim() || "ea";
  const stock  = parseInt(document.getElementById("m-stock").value) || 0;
  const safety = parseInt(document.getElementById("m-safety").value) || 0;
  if (!name || !code) { alert("이름과 코드를 입력하세요."); return; }
  const data = { name, code, type, unit, stock, safety, updatedAt: serverTimestamp() };
  try {
    if (id) { await updateDoc(doc(db, "inventory", id), data); }
    else    { await setDoc(doc(db, "inventory", "item_" + Date.now()), data); }
    closeModal();
  } catch (e) { alert("오류: " + e.message); }
}

async function deleteItem(id, name) {
  if (!confirm(`"${name}" 항목을 삭제하시겠습니까?`)) return;
  try { await deleteDoc(doc(db, "inventory", id)); }
  catch (e) { alert("오류: " + e.message); }
}

// ── 전역 등록 (onclick 핸들러용) ──
window.editItem   = editItem;
window.saveItem   = saveItem;
window.closeModal = closeModal;
window.deleteItem = deleteItem;

// ── History Filter ──
document.getElementById("btn-filter").addEventListener("click", () => {
  const itemId = document.getElementById("filter-item").value;
  const type   = document.getElementById("filter-type").value;
  const from   = document.getElementById("filter-from").value;
  const to     = document.getElementById("filter-to").value;
  let data = [...transactions];
  if (itemId) data = data.filter(t => t.itemId === itemId);
  if (type)   data = data.filter(t => t.type === type);
  if (from)   data = data.filter(t => t.date >= from);
  if (to)     data = data.filter(t => t.date <= to);
  renderHistory(data);
});

document.getElementById("btn-reset-filter").addEventListener("click", () => {
  ["filter-item","filter-type","filter-from","filter-to"].forEach(id => {
    document.getElementById(id).value = "";
  });
  renderHistory();
});

// ── Helpers ──
function getStatus(item) {
  if (item.stock === 0)                return "out";
  if (item.stock <= item.safety)       return "low";
  if (item.stock <= item.safety * 1.5) return "warn";
  return "ok";
}
function statusBadge(status) {
  const m = { out:["status-danger","재고 없음"], low:["status-danger","안전재고 미달"], warn:["status-warning","재고 부족"], ok:["status-ok","정상"] };
  const [cls, label] = m[status] || ["status-info", status];
  return `<span class="status-badge ${cls}">${label}</span>`;
}
function stockClass(item) {
  if (item.stock === 0)                return "stock-low";
  if (item.stock <= item.safety)       return "stock-low";
  if (item.stock <= item.safety * 1.5) return "stock-warn";
  return "stock-ok";
}
function emptyRow(cols) {
  return `<tr class="empty-row"><td colspan="${cols}">데이터 없음</td></tr>`;
}
function fmtTs(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("ko-KR") + " " + d.toLocaleTimeString("ko-KR", { hour:"2-digit", minute:"2-digit" });
}
