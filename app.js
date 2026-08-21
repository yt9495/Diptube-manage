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
  writeBatch,
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
let shipments      = [];

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

  // 입고 예정 배송 (Packing Slip 단위)
  onSnapshot(collection(db, "shipments"), (snap) => {
    shipments = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    shipments.sort((a, b) => (b.shipDate || "").localeCompare(a.shipDate || ""));
    renderDashboard();
    renderInventory();
    renderShipments();
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
  const openShip = shipments.filter(isOpenShipment).length;

  document.getElementById("stats-grid").innerHTML = `
    <div class="stat-card"><div class="stat-label">Total Items</div><div class="stat-value">${total}</div></div>
    <div class="stat-card ok"><div class="stat-label">정상</div><div class="stat-value">${ok}</div></div>
    <div class="stat-card warning"><div class="stat-label">재고 부족</div><div class="stat-value">${warn}</div></div>
    <div class="stat-card danger"><div class="stat-label">재고 없음</div><div class="stat-value">${danger}</div></div>
    <div class="stat-card info"><div class="stat-label">입고 예정</div><div class="stat-value">${openShip}</div></div>
  `;

  const alertItems = inventoryItems.filter(i => i.stock <= i.safety);
  const banner = document.getElementById("alert-banner");
  if (alertItems.length > 0) {
    banner.classList.remove("hidden");
    banner.innerHTML = `<strong>⚠ 안전 재고 경고 (${alertItems.length}개 항목)</strong><br/>` +
      alertItems.map(i =>
        `• ${i.name} (${i.code}): 현재 <b>${i.stock} ${i.unit}</b> — 안전재고: ${i.safety} ${i.unit}` +
        (i.stock === 0 ? " &nbsp;<span style='color:var(--red-text);font-weight:600'>[재고 없음]</span>" : "") +
        incomingHint(i)
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
      <td>${incomingCell(item)}</td>
      <td><span class="available-qty">${item.stock + incomingQty(item.id)} ${item.unit}</span></td>
      <td>${item.safety} ${item.unit}</td>
      <td>${statusBadge(getStatus(item))}</td>
      <td style="font-size:12px;color:var(--text3);font-family:var(--font-mono)">${fmtTs(item.updatedAt)}</td>
    </tr>`).join("") || emptyRow(9);
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
      <td>${incomingCell(item)}</td>
      <td><span class="available-qty">${item.stock + incomingQty(item.id)} ${item.unit}</span></td>
      <td>${item.safety} ${item.unit}</td>
      <td>${item.unit}</td>
      <td>${statusBadge(getStatus(item))}</td>
      <td>
        <div class="action-btns">
          <button class="btn-ghost btn-sm" onclick="editItem('${item.id}')">Edit</button>
          <button class="btn-danger" onclick="deleteItem('${item.id}', '${item.name.replace(/'/g,"\\'")}')">Del</button>
        </div>
      </td>
    </tr>`).join("") || emptyRow(11);
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

function openModalHTML(title, html, wide) {
  document.getElementById("modal-title").textContent = title;
  document.getElementById("modal-body").innerHTML = html;
  document.querySelector(".modal-box").classList.toggle("wide", !!wide);
  document.getElementById("modal-overlay").classList.remove("hidden");
}

function openModal(item) {
  const isEdit = !!item;
  const html = `
    <div class="form-group">
      <label>Chemical Name</label>
      <input id="m-name" type="text" value="${isEdit ? item.name : ""}" placeholder="e.g. HF (Hydrofluoric Acid)" />
    </div>
    <div class="form-group">
      <label>Model / Key Code</label>
      <input id="m-code" type="text" value="${isEdit ? item.code : ""}" placeholder="e.g. Code 12" />
    </div>
    <div class="form-group">
      <label>Part No. (선택 — PDF 자동매칭용)</label>
      <input id="m-partno" type="text" value="${isEdit ? (item.partNo || "") : ""}" placeholder='e.g. DT-G2"PE-007-1330-SP-001' />
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
  openModalHTML(isEdit ? "Edit Item" : "Add New Item", html);
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
  const partNo = document.getElementById("m-partno").value.trim();
  const unit   = document.getElementById("m-unit").value.trim() || "ea";
  const stock  = parseInt(document.getElementById("m-stock").value) || 0;
  const safety = parseInt(document.getElementById("m-safety").value) || 0;
  if (!name || !code) { alert("이름과 코드를 입력하세요."); return; }
  const data = { name, code, type, partNo, unit, stock, safety, updatedAt: serverTimestamp() };
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

// ══════════════════════════════════════════════
//  INCOMING SHIPMENTS  (입고 예정 관리)
//  A.S. Plastics SOC / Packing Slip PDF 파싱
// ══════════════════════════════════════════════

const PDFJS_URL    = "https://cdn.jsdelivr.net/npm/pdfjs-dist@5.7.284/build/pdf.min.mjs";
const PDFJS_WORKER = "https://cdn.jsdelivr.net/npm/pdfjs-dist@5.7.284/build/pdf.worker.min.mjs";
const TESSERACT_URL = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.esm.min.js";

let pdfjsLib = null;
let parsedDraft = null;   // 리뷰 모달에서 편집 중인 파싱 결과

// ── 상태 헬퍼 ──
function isOpenShipment(s) { return s.status === "pending" || s.status === "partial"; }

function lineRemaining(l) { return Math.max(0, (l.qty || 0) - (l.receivedQty || 0)); }

function incomingQty(itemId) {
  return shipments.filter(isOpenShipment).reduce((sum, s) =>
    sum + (s.lines || []).filter(l => l.itemId === itemId).reduce((a, l) => a + lineRemaining(l), 0), 0);
}

function incomingCell(item) {
  const q = incomingQty(item.id);
  return `<span class="incoming-qty ${q === 0 ? "zero" : ""}">${q > 0 ? "+" : ""}${q} ${item.unit}</span>`;
}

// 안전재고 경고에 붙일 "도착 예정" 문구
function incomingHint(item) {
  const rows = [];
  shipments.filter(isOpenShipment).forEach(s => {
    (s.lines || []).forEach(l => {
      if (l.itemId === item.id && lineRemaining(l) > 0)
        rows.push({ eta: s.etaDate || s.shipDate || "", qty: lineRemaining(l), doc: s.docNo });
    });
  });
  if (!rows.length) return "";
  rows.sort((a, b) => (a.eta || "").localeCompare(b.eta || ""));
  const total = rows.reduce((a, r) => a + r.qty, 0);
  const first = rows[0];
  return ` &nbsp;<span style="color:var(--blue-text);font-weight:600">[입고예정 ${total} ${item.unit}` +
         (first.eta ? ` · 최단 ${first.eta} 도착예정` : "") + `]</span>`;
}

function etaClass(eta) {
  if (!eta) return "";
  const today = new Date().toISOString().split("T")[0];
  if (eta < today) return "overdue";
  const soon = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
  return eta <= soon ? "soon" : "";
}

function shipStatusBadge(s) {
  const m = {
    pending:   ["status-info",    "미도착"],
    partial:   ["status-warning", "부분입고"],
    received:  ["status-ok",      "입고완료"],
    cancelled: ["status-danger",  "취소"]
  };
  const [cls, label] = m[s.status] || ["status-info", s.status || "—"];
  return `<span class="status-badge ${cls}">${label}</span>`;
}

// ── 렌더 ──
function renderShipments() {
  const badge = document.getElementById("nav-incoming-badge");
  const openCount = shipments.filter(isOpenShipment).length;
  if (badge) {
    badge.textContent = openCount;
    badge.classList.toggle("hidden", openCount === 0);
  }

  const statsEl = document.getElementById("incoming-stats");
  if (statsEl) {
    const open = shipments.filter(isOpenShipment);
    const qtySum = open.reduce((a, s) => a + (s.lines || []).reduce((b, l) => b + lineRemaining(l), 0), 0);
    const today = new Date().toISOString().split("T")[0];
    const late = open.filter(s => (s.etaDate || s.shipDate || "9999") < today).length;
    const week = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
    const soon = open.filter(s => { const e = s.etaDate || s.shipDate || ""; return e >= today && e <= week; }).length;
    statsEl.innerHTML = `
      <div class="stat-card"><div class="stat-label">진행중 배송</div><div class="stat-value">${open.length}</div></div>
      <div class="stat-card ok"><div class="stat-label">입고 예정 수량</div><div class="stat-value">${qtySum}</div></div>
      <div class="stat-card warning"><div class="stat-label">7일 내 도착</div><div class="stat-value">${soon}</div></div>
      <div class="stat-card danger"><div class="stat-label">도착 지연</div><div class="stat-value">${late}</div></div>`;
  }

  const filter = document.getElementById("ship-filter-status")?.value ?? "open";
  let data = [...shipments];
  if (filter === "open") data = data.filter(isOpenShipment);
  else if (filter)       data = data.filter(s => s.status === filter);

  document.getElementById("shipment-tbody").innerHTML = data.map(s => {
    const lines = s.lines || [];
    const totQty = lines.reduce((a, l) => a + (l.qty || 0), 0);
    const recQty = lines.reduce((a, l) => a + (l.receivedQty || 0), 0);
    const eta = s.etaDate || "";
    const names = lines.map(l => {
      const it = inventoryItems.find(i => i.id === l.itemId);
      return `${it ? it.name : (l.itemName || "미지정")} <span style="color:var(--text3)">×${l.qty}</span>`;
    }).join("<br/>");
    return `<tr>
      <td style="font-family:var(--font-mono);font-weight:600">${s.docNo || "—"}
        ${s.poNo ? `<div style="font-size:11px;font-weight:400;color:var(--text3)">PO ${s.poNo}</div>` : ""}
        ${s.vendor ? `<div style="font-size:11px;font-weight:400;color:var(--text3);font-family:var(--font-main)">${s.vendor}</div>` : ""}</td>
      <td style="font-family:var(--font-mono);font-size:12px">${s.shipDate || "—"}</td>
      <td>${eta ? `<span class="eta-badge ${etaClass(eta)}">${eta}</span>` : "—"}</td>
      <td style="font-family:var(--font-mono);font-size:11.5px">${s.tracking || "—"}</td>
      <td style="font-size:12.5px;line-height:1.5">${names || "—"}</td>
      <td style="font-family:var(--font-mono)">${recQty} / ${totQty}</td>
      <td>${shipStatusBadge(s)}</td>
      <td>
        <div class="action-btns">
          ${isOpenShipment(s) ? `<button class="btn-primary btn-sm" onclick="openReceiveModal('${s.id}')">입고확정</button>` : ""}
          <button class="btn-ghost btn-sm" onclick="editShipment('${s.id}')">Edit</button>
          <button class="btn-danger" onclick="deleteShipment('${s.id}')">Del</button>
        </div>
      </td>
    </tr>`;
  }).join("") || emptyRow(8);
}

// ══ PDF → 텍스트 ══
async function loadPdfjs() {
  if (pdfjsLib) return pdfjsLib;
  pdfjsLib = await import(PDFJS_URL);
  pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
  return pdfjsLib;
}

// 텍스트 레이어를 좌표 기준으로 줄 단위 복원 (칼럼 사이는 공백 3개)
function itemsToLines(items) {
  const rows = {};
  items.forEach(it => {
    if (!it.str || !it.str.trim()) return;
    const y = Math.round(it.transform[5] / 3) * 3;
    (rows[y] = rows[y] || []).push({ x: it.transform[4], str: it.str, w: it.width || 0 });
  });
  return Object.keys(rows)
    .sort((a, b) => b - a)
    .map(y => {
      const cells = rows[y].sort((a, b) => a.x - b.x);
      let line = "", prevEnd = null;
      cells.forEach(c => {
        if (prevEnd !== null) line += (c.x - prevEnd > 8) ? "   " : (c.x - prevEnd > 1 ? " " : "");
        line += c.str;
        prevEnd = c.x + c.w;
      });
      return line.trim();
    })
    .filter(Boolean);
}

async function extractTextFromPdf(file, onStatus) {
  const pdfjs = await loadPdfjs();
  const buf = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buf }).promise;

  let lines = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    lines = lines.concat(itemsToLines(tc.items));
  }
  const joined = lines.join("\n");

  // 텍스트 레이어가 없거나(스캔/이미지 PDF) 깨진 경우 → OCR
  if (looksLikeGoodText(joined)) return { text: joined, method: "text" };

  onStatus?.("텍스트 레이어가 없어 OCR로 읽는 중… (최초 1회는 30초 정도 걸릴 수 있습니다)");
  const text = await ocrPdf(pdf, onStatus);
  return { text, method: "ocr" };
}

function looksLikeGoodText(t) {
  if (!t || t.replace(/\s/g, "").length < 40) return false;
  // 폰트 인코딩이 깨진 PDF 걸러내기 — 알파벳/숫자 비율이 지나치게 낮으면 실패로 간주
  const alnum = (t.match(/[A-Za-z0-9]/g) || []).length;
  if (alnum / t.replace(/\s/g, "").length < 0.55) return false;
  return /DT-|SHIP\s*DATE|Invoice|Confirmation|CUSTOMER/i.test(t);
}

async function ocrPdf(pdf, onStatus) {
  // tesseract.js ESM 번들은 default export만 제공한다
  const mod = await import(TESSERACT_URL);
  const T = (mod && mod.createWorker) ? mod : (mod?.default || {});
  if (typeof T.createWorker !== "function")
    throw new Error("OCR 모듈(tesseract.js)을 불러오지 못했습니다. 네트워크를 확인하세요.");
  const worker = await T.createWorker("eng");
  let out = "";
  try {
    for (let p = 1; p <= pdf.numPages; p++) {
      onStatus?.(`OCR 처리 중… (${p}/${pdf.numPages} 페이지)`);
      const page = await pdf.getPage(p);
      const viewport = page.getViewport({ scale: 2.2 });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
      const { data } = await worker.recognize(canvas);
      out += data.text + "\n";
    }
  } finally { await worker.terminate(); }
  return out;
}

// ══ A.S. Plastics 문서 파서 (SOC 주문확정서 / Packing Slip 공통) ══
function toISODate(us) {
  const m = String(us || "").match(/(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{2,4})/);
  if (!m) return "";
  let [, mm, dd, yy] = m;
  if (yy.length === 2) yy = "20" + yy;
  return `${yy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
}

function addDays(iso, n) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}

function parseASPDoc(text) {
  const raw   = text.replace(/\r/g, "");
  const lines = raw.split("\n").map(l => l.trim()).filter(Boolean);
  const flat  = lines.join("\n");
  const R = (re) => (flat.match(re) || [])[1] || "";

  const out = {
    docNo: "", docType: "", docDate: "", shipDate: "", etaDate: "",
    tracking: "", poNo: "", customer: "", vendor: "", lines: [], warnings: []
  };

  // 문서 번호 / 종류
  const soc = R(/Confirmation\s+(SOC[-\s]?\d+)/i);
  const inv = R(/Invoice\s*no\.?\s*:?\s*(INV[-\s]?\d+)/i);
  if (soc)      { out.docNo = soc.replace(/\s/g, "-").replace(/--/g, "-"); out.docType = "SOC (주문확정)"; }
  else if (inv) { out.docNo = inv.replace(/\s/g, "-").replace(/--/g, "-"); out.docType = "Packing Slip"; }
  else {
    const any = R(/\b((?:SOC|INV|PO)[-\s]?\d{3,})\b/i);
    out.docNo = any.replace(/\s/g, "-");
  }

  out.vendor = /A\.?S\.?\s*Plastics/i.test(flat) ? "A.S. Plastics Technology, Inc." : "";
  out.docDate = toISODate(R(/\bDATE\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i) || R(/\bDate\s*:\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/));

  // ── 헤더 필드 ──
  // 라벨이 값과 같은 줄에 있는 양식(Packing Slip)과
  // 라벨 행 아래에 값 행이 오는 양식(SOC 주문확정서)을 모두 지원
  const DATE_RE = /\d{1,2}\s*\/\s*\d{1,2}\s*\/\s*\d{2,4}/;

  function labeledDate(labelRe) {
    for (let i = 0; i < lines.length; i++) {
      if (!labelRe.test(lines[i])) continue;
      const after = lines[i].split(labelRe)[1] || "";
      const m1 = after.match(DATE_RE);
      if (m1) return m1[0];
      for (let k = i + 1; k < Math.min(i + 4, lines.length); k++) {
        const m2 = lines[k].match(DATE_RE);
        if (m2) return m2[0];
      }
    }
    return "";
  }

  // 발행일: "SHIP DATE"가 아닌 단독 DATE 라벨
  let docDateRaw = "";
  for (const m of flat.matchAll(/(\w+\s+)?\bDATE\b\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/gi)) {
    if (/ship/i.test(m[1] || "")) continue;
    docDateRaw = m[2]; break;
  }
  out.docDate  = toISODate(docDateRaw);
  out.shipDate = toISODate(labeledDate(/SHIP\s*DATE\s*:?/i));

  // 운송장 — FedEx#209646615 형태
  out.tracking = (flat.match(/\b([A-Za-z]{2,12}\s*#\s*[A-Z0-9-]{5,})/) || [])[1]?.replace(/\s+/g, "") || "";
  if (!out.tracking) {
    const i = lines.findIndex(l => /SHIP\s*VIA/i.test(l));
    if (i >= 0) {
      const after = (lines[i].split(/SHIP\s*VIA\s*:?/i)[1] || "").trim();
      const cand = after || (lines[i + 1] || "");
      out.tracking = (cand.match(/([A-Za-z]*#?[A-Z0-9-]{5,})/) || [])[1] || "";
    }
  }

  // Customer Order (PO) — JAPO-260811AS 형태
  const docNoNorm = (out.docNo || "").replace(/\s/g, "").toUpperCase();
  for (const m of flat.matchAll(/\b([A-Z]{2,6}-\d{5,8}[A-Z]{0,4})\b/g)) {
    const cand = m[1].toUpperCase();
    if (cand === docNoNorm) continue;          // 문서 번호 자신
    if (/^(SOC|INV|PS)-/.test(cand)) continue; // 공급사 문서 번호 체계
    out.poNo = m[1]; break;
  }
  if (!out.poNo) {
    const i = lines.findIndex(l => /CUSTOMER\s*ORDER/i.test(l));
    if (i >= 0) {
      const after = (lines[i].split(/CUSTOMER\s*ORDER\s*:?/i)[1] || "").trim();
      const cand = after || (lines[i + 1] || "");
      out.poNo = (cand.match(/\b([A-Z0-9]{2,}-[A-Z0-9]{3,})\b/) || [])[1] || "";
    }
  }

  // 담당자 — 값 행에서 날짜/운송장/PO를 걷어낸 나머지
  const valIdx = lines.findIndex(l =>
    DATE_RE.test(l) && (out.tracking ? l.includes(out.tracking.replace(/\s/g, "")) : /#/.test(l)));
  if (valIdx >= 0) {
    const leftover = lines[valIdx]
      .replace(DATE_RE, " ")
      .replace(/[A-Za-z]{2,12}\s*#\s*[A-Z0-9-]+/g, " ")
      .replace(out.poNo || "\u0000", " ")
      .trim();
    if (/^[A-Za-z][A-Za-z.\s'-]{2,40}$/.test(leftover)) out.customer = leftover;
  }

  if (!out.shipDate && out.docDate) out.shipDate = out.docDate;
  out.etaDate = out.shipDate ? addDays(out.shipDate, 3) : "";

  // 품목 라인 — DT-로 시작하는 파트넘버가 있는 줄
  const seen = new Set();
  lines.forEach((line, idx) => {
    const pm = line.match(/(DT-[A-Za-z0-9"'”“\-\.\/]+)/);
    if (!pm) return;
    const partNo = pm[1].replace(/[”“]/g, '"').replace(/[.,;]+$/, "");
    const rest = line.slice(line.indexOf(pm[1]) + pm[1].length);

    // 수량: 파트넘버 뒤의 첫 정수 (Code: NNN, 단가/금액 소수점은 제외)
    const cleaned = rest.replace(/Code\s*:?\s*\d+/ig, " ");
    let qty = null;
    const tokens = cleaned.match(/-?[\d,]+(?:\.\d+)?/g) || [];
    for (const t of tokens) {
      if (t.includes(".") || t.includes(",")) continue;   // 단가·금액
      const n = parseInt(t, 10);
      if (!isNaN(n) && n > 0) { qty = n; break; }
    }
    // 같은 줄에 수량이 없으면 (칼럼이 분리된 경우) 다음 몇 줄에서 단독 정수 탐색
    if (qty === null) {
      for (let k = idx + 1; k < Math.min(idx + 4, lines.length); k++) {
        const m2 = lines[k].match(/^\s*(\d{1,5})\s*$/);
        if (m2) { qty = parseInt(m2[1], 10); break; }
      }
    }

    // 케미컬 키 코드: 파트넘버 3번째 구간 (DT-G2"PE-007-1330-SP-001 → 007)
    const segs = partNo.split("-");
    let keyCode = segs[2] && /^\d+$/.test(segs[2]) ? segs[2] : "";
    // 본문에 명시된 값이 있으면 우선
    const block = lines.slice(idx, idx + 12).join(" ");
    const explicit = (block.match(/(?:Chemical\s*Key\s*)?Code\s*:?\s*(\d{1,3})\b/i) || [])[1];
    if (!keyCode && explicit) keyCode = explicit;

    const chemName = (block.match(/Chemical\s*Code\s*Name\s*:?\s*([A-Za-z0-9()]+)/i) || [])[1] || "";
    const length   = segs[3] && /^\d+$/.test(segs[3]) ? segs[3] + "mm" : "";

    const key = partNo + "|" + (qty ?? "");
    if (seen.has(key)) return;
    seen.add(key);

    const matched = matchItem(keyCode, partNo);
    if (!matched) out.warnings.push(`${partNo} — 재고 항목을 찾지 못했습니다 (Key Code ${keyCode || "?"})`);
    if (qty === null) out.warnings.push(`${partNo} — 수량을 읽지 못했습니다`);

    out.lines.push({
      partNo, keyCode, chemName, length,
      qty: qty ?? 0, receivedQty: 0,
      itemId: matched ? matched.id : "",
      itemName: matched ? matched.name : ""
    });
  });

  if (!out.lines.length) out.warnings.push("품목(DT-…)을 찾지 못했습니다. 직접 추가해 주세요.");
  return out;
}

// 파트넘버 → 재고 항목 매칭
function matchItem(keyCode, partNo) {
  const norm = (v) => { const d = String(v || "").replace(/\D/g, ""); return d ? parseInt(d, 10) : null; };
  if (partNo) {
    const exact = inventoryItems.find(i => i.partNo && i.partNo.replace(/\s/g, "") === partNo.replace(/\s/g, ""));
    if (exact) return exact;
  }
  const k = norm(keyCode);
  if (k === null) return null;
  return inventoryItems.find(i => norm(i.code) === k) || null;
}

// ══ PDF 업로드 핸들링 ══
function setPdfStatus(msg, isError) {
  const el = document.getElementById("pdf-status");
  if (!el) return;
  el.textContent = msg || "";
  el.classList.toggle("hidden", !msg);
  el.classList.toggle("error", !!isError);
}

async function handlePdfFiles(files) {
  const list = [...files].filter(f => /\.pdf$/i.test(f.name) || f.type === "application/pdf");
  if (!list.length) { setPdfStatus("PDF 파일만 업로드할 수 있습니다.", true); return; }
  const file = list[0];
  if (list.length > 1) setPdfStatus(`${list.length}개 중 첫 번째 파일(${file.name})부터 처리합니다.`);
  try {
    setPdfStatus(`${file.name} 읽는 중…`);
    const { text, method } = await extractTextFromPdf(file, setPdfStatus);
    const parsed = parseASPDoc(text);
    parsed.sourceFile = file.name;
    parsed.parseMethod = method;
    setPdfStatus(`✓ ${file.name} — ${method === "ocr" ? "OCR" : "텍스트"} 인식 완료. 내용을 확인하고 저장하세요.`);
    openShipmentModal(parsed, null);
  } catch (e) {
    console.error(e);
    setPdfStatus("PDF를 읽지 못했습니다: " + e.message + "\n'직접 입력'으로 등록할 수 있습니다.", true);
  }
}

// ══ 입고예정 등록/수정 모달 ══
function blankShipment() {
  return { docNo: "", docType: "", docDate: "", shipDate: "", etaDate: "",
           tracking: "", poNo: "", customer: "", vendor: "A.S. Plastics Technology, Inc.",
           lines: [], warnings: [] };
}

function lineRowHTML(l, idx) {
  const opts = `<option value="">— 항목 선택 —</option>` + inventoryItems.map(i =>
    `<option value="${i.id}" ${i.id === l.itemId ? "selected" : ""}>${i.name} (${i.code})</option>`).join("");
  return `<tr class="${l.itemId ? "" : "unmatched"}" data-idx="${idx}">
    <td class="src">${l.partNo || "—"}${l.keyCode ? `<br/><span style="color:var(--text3)">Key ${l.keyCode}${l.chemName ? " · " + l.chemName : ""}${l.length ? " · " + l.length : ""}</span>` : ""}</td>
    <td><select class="ln-item">${opts}</select></td>
    <td style="width:90px"><input class="ln-qty" type="number" min="0" value="${l.qty || 0}" /></td>
    <td style="width:34px"><button class="line-row-del" onclick="removeShipLine(${idx})">✕</button></td>
  </tr>`;
}

function shipmentModalHTML(s) {
  const warn = (s.warnings && s.warnings.length)
    ? `<div class="modal-note">⚠ 확인 필요<br/>${s.warnings.map(w => "• " + w).join("<br/>")}</div>` : "";
  const src = s.sourceFile
    ? `<div style="font-size:12px;color:var(--text3);margin-bottom:0.75rem;font-family:var(--font-mono)">
         ${s.sourceFile} · ${s.parseMethod === "ocr" ? "OCR 인식" : "텍스트 추출"}${s.docType ? " · " + s.docType : ""}</div>` : "";
  return `${src}${warn}
    <div class="modal-grid">
      <div class="form-group"><label>문서 번호 (SOC / INV)</label><input id="s-docno" value="${s.docNo || ""}" placeholder="SOC-32364" /></div>
      <div class="form-group"><label>Customer Order (PO)</label><input id="s-pono" value="${s.poNo || ""}" placeholder="JAPO-260811AS" /></div>
      <div class="form-group"><label>공급사</label><input id="s-vendor" value="${s.vendor || ""}" /></div>
      <div class="form-group"><label>운송장 (Ship Via)</label><input id="s-tracking" value="${s.tracking || ""}" placeholder="FedEx#209646615" /></div>
      <div class="form-group"><label>선적일 (Ship Date)</label><input id="s-shipdate" type="date" value="${s.shipDate || ""}" /></div>
      <div class="form-group"><label>도착 예정일 (ETA)</label><input id="s-eta" type="date" value="${s.etaDate || ""}" /></div>
      <div class="form-group"><label>담당자</label><input id="s-operator" value="${s.operator || ""}" placeholder="이름 입력..." /></div>
      <div class="form-group"><label>메모</label><input id="s-memo" value="${s.memo || ""}" placeholder="선택 사항" /></div>
    </div>
    <div style="margin:0.5rem 0 0.4rem;font-size:13px;font-weight:500">품목</div>
    <table class="line-table"><thead><tr>
      <th>Part No. (문서)</th><th>재고 항목</th><th>수량</th><th></th>
    </tr></thead><tbody id="ship-lines">${(s.lines || []).map(lineRowHTML).join("")}</tbody></table>
    <button class="btn-ghost btn-sm" onclick="addShipLine()">+ 품목 줄 추가</button>
    <div class="modal-actions">
      <button class="btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn-primary" onclick="saveShipment('${s.id || ""}')">저장</button>
    </div>`;
}

function openShipmentModal(s, id) {
  parsedDraft = { ...s, id: id || s.id || "" };
  openModalHTML(parsedDraft.id ? "입고 예정 수정" : "입고 예정 등록", shipmentModalHTML(parsedDraft), true);
}

function syncDraftFromDOM() {
  if (!parsedDraft) return;
  const rows = document.querySelectorAll("#ship-lines tr");
  parsedDraft.lines = [...rows].map(tr => {
    const idx = parseInt(tr.dataset.idx, 10);
    const base = parsedDraft.lines[idx] || {};
    return { ...base,
      itemId: tr.querySelector(".ln-item").value,
      qty: parseInt(tr.querySelector(".ln-qty").value, 10) || 0 };
  });
}

function addShipLine() {
  syncDraftFromDOM();
  parsedDraft.lines.push({ partNo: "", keyCode: "", qty: 0, itemId: "", receivedQty: 0 });
  document.getElementById("ship-lines").innerHTML = parsedDraft.lines.map(lineRowHTML).join("");
}

function removeShipLine(idx) {
  syncDraftFromDOM();
  parsedDraft.lines.splice(idx, 1);
  document.getElementById("ship-lines").innerHTML = parsedDraft.lines.map(lineRowHTML).join("");
}

async function saveShipment(id) {
  syncDraftFromDOM();
  const g = (x) => document.getElementById(x).value.trim();
  const docNo = g("s-docno");
  if (!docNo) { alert("문서 번호(SOC/INV)를 입력하세요."); return; }

  const lines = parsedDraft.lines.filter(l => l.itemId && l.qty > 0).map(l => {
    const it = inventoryItems.find(i => i.id === l.itemId);
    return { itemId: l.itemId, itemName: it ? it.name : "", partNo: l.partNo || "",
             keyCode: l.keyCode || "", chemName: l.chemName || "", length: l.length || "",
             qty: l.qty, receivedQty: l.receivedQty || 0 };
  });
  if (!lines.length) { alert("재고 항목과 수량이 지정된 품목이 최소 1개 필요합니다."); return; }

  const data = {
    docNo, docType: parsedDraft.docType || "", poNo: g("s-pono"), vendor: g("s-vendor"),
    tracking: g("s-tracking"), shipDate: g("s-shipdate"), etaDate: g("s-eta"),
    customer: parsedDraft.customer || "", operator: g("s-operator") || "—", memo: g("s-memo"),
    sourceFile: parsedDraft.sourceFile || "", lines,
    status: lines.every(l => l.receivedQty >= l.qty) ? "received"
          : lines.some(l => l.receivedQty > 0) ? "partial" : "pending",
    updatedAt: serverTimestamp()
  };

  try {
    if (id) await updateDoc(doc(db, "shipments", id), data);
    else    await setDoc(doc(db, "shipments", "ship_" + Date.now()), { ...data, createdAt: serverTimestamp() });
    closeModal();
    setPdfStatus("");
    switchViewTo("incoming");
  } catch (e) { alert("오류: " + e.message); }
}

function editShipment(id) {
  const s = shipments.find(x => x.id === id);
  if (s) openShipmentModal(JSON.parse(JSON.stringify(s)), id);
}

async function deleteShipment(id) {
  const s = shipments.find(x => x.id === id);
  if (!confirm(`${s?.docNo || "이 배송"} 건을 삭제하시겠습니까?\n(이미 입고 처리된 재고는 되돌아가지 않습니다)`)) return;
  try { await deleteDoc(doc(db, "shipments", id)); }
  catch (e) { alert("오류: " + e.message); }
}

// ══ 입고 확정 ══
function openReceiveModal(id) {
  const s = shipments.find(x => x.id === id);
  if (!s) return;
  const rows = (s.lines || []).map((l, i) => {
    const it = inventoryItems.find(x => x.id === l.itemId);
    const rem = lineRemaining(l);
    return `<tr data-idx="${i}">
      <td class="chemical-name">${it ? it.name : l.itemName}
        <div class="src">${l.partNo || ""}</div></td>
      <td style="font-family:var(--font-mono)">${l.receivedQty || 0} / ${l.qty}</td>
      <td style="width:110px"><input class="rc-qty" type="number" min="0" max="${rem}" value="${rem}" /></td>
    </tr>`;
  }).join("");
  openModalHTML(`입고 확정 — ${s.docNo}`, `
    <div class="modal-note">입력한 수량만큼 현재고에 반영되고, 입고 내역이 History에 기록됩니다. 일부만 도착했다면 수량을 줄여서 저장하세요.</div>
    <table class="line-table"><thead><tr><th>품목</th><th>기입고 / 예정</th><th>이번 입고 수량</th></tr></thead>
      <tbody id="receive-lines">${rows}</tbody></table>
    <div class="modal-grid">
      <div class="form-group"><label>입고일</label><input id="rc-date" type="date" value="${new Date().toISOString().split("T")[0]}" /></div>
      <div class="form-group"><label>담당자</label><input id="rc-operator" value="${s.operator && s.operator !== "—" ? s.operator : ""}" placeholder="이름 입력..." /></div>
    </div>
    <div class="modal-actions">
      <button class="btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn-primary" onclick="confirmReceive('${id}')">입고 확정</button>
    </div>`, true);
}

async function confirmReceive(id) {
  const s = shipments.find(x => x.id === id);
  if (!s) return;
  const date     = document.getElementById("rc-date").value;
  const operator = document.getElementById("rc-operator").value.trim() || s.operator || "—";
  if (!date) { alert("입고일을 입력하세요."); return; }

  const lines = JSON.parse(JSON.stringify(s.lines || []));
  const receive = [];
  document.querySelectorAll("#receive-lines tr").forEach(tr => {
    const i = parseInt(tr.dataset.idx, 10);
    const q = parseInt(tr.querySelector(".rc-qty").value, 10) || 0;
    const rem = lineRemaining(lines[i]);
    const take = Math.min(Math.max(0, q), rem);
    if (take > 0) receive.push({ i, take });
  });
  if (!receive.length) { alert("입고할 수량을 입력하세요."); return; }

  try {
    const batch = writeBatch(db);
    const summary = [];
    for (const { i, take } of receive) {
      const l = lines[i];
      const item = inventoryItems.find(x => x.id === l.itemId);
      if (!item) continue;
      const newStock = item.stock + take;
      batch.update(doc(db, "inventory", item.id), { stock: newStock, updatedAt: serverTimestamp() });
      batch.set(doc(collection(db, "transactions")), {
        itemId: item.id, itemName: item.name, type: "in", qty: take,
        stockAfter: newStock, unit: item.unit,
        memo: `${s.docNo}${s.poNo ? " / PO " + s.poNo : ""} 입고${l.partNo ? " · " + l.partNo : ""}`,
        date, operator, shipmentId: id, createdAt: serverTimestamp()
      });
      l.receivedQty = (l.receivedQty || 0) + take;
      summary.push(`${item.name}: +${take} → ${newStock} ${item.unit}`);
    }
    const status = lines.every(l => (l.receivedQty || 0) >= l.qty) ? "received"
                 : lines.some(l => (l.receivedQty || 0) > 0) ? "partial" : "pending";
    batch.update(doc(db, "shipments", id), {
      lines, status, receivedAt: serverTimestamp(), updatedAt: serverTimestamp()
    });
    await batch.commit();
    closeModal();
    alert(`✓ 입고 완료 (${s.docNo})\n\n${summary.join("\n")}`);
  } catch (e) { alert("오류: " + e.message); }
}

// ══ 이벤트 연결 ══
function switchViewTo(name) {
  switchView(name);
  document.querySelectorAll(".nav-item").forEach(b =>
    b.classList.toggle("active", b.dataset.view === name));
}

const dz = document.getElementById("pdf-dropzone");
const fileInput = document.getElementById("pdf-file");
if (dz && fileInput) {
  dz.addEventListener("click", () => fileInput.click());
  document.getElementById("btn-pick-pdf").addEventListener("click", (e) => { e.stopPropagation(); fileInput.click(); });
  fileInput.addEventListener("change", (e) => { handlePdfFiles(e.target.files); e.target.value = ""; });
  ["dragenter", "dragover"].forEach(ev => dz.addEventListener(ev, (e) => {
    e.preventDefault(); dz.classList.add("dragover");
  }));
  ["dragleave", "drop"].forEach(ev => dz.addEventListener(ev, (e) => {
    e.preventDefault(); dz.classList.remove("dragover");
  }));
  dz.addEventListener("drop", (e) => { if (e.dataTransfer?.files?.length) handlePdfFiles(e.dataTransfer.files); });
}
document.getElementById("btn-add-shipment")?.addEventListener("click", () => openShipmentModal(blankShipment(), null));
document.getElementById("ship-filter-status")?.addEventListener("change", renderShipments);

window.openReceiveModal = openReceiveModal;
window.confirmReceive   = confirmReceive;
window.saveShipment     = saveShipment;
window.editShipment     = editShipment;
window.deleteShipment   = deleteShipment;
window.addShipLine      = addShipLine;
window.removeShipLine   = removeShipLine;
