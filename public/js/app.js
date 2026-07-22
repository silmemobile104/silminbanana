/* ==========================================================================
   Silmin Banana Multi-Branch POS & Audit System - Frontend SPA
   ========================================================================== */

// Global App State
const state = {
  token: localStorage.getItem('silmin_token') || null,
  user: JSON.parse(localStorage.getItem('silmin_user')) || null,
  currentView: 'dashboard',
  masterOptions: { brands: [], models: [], capacities: [], colors: [], categories: [] },
  expectedStockCache: [],
  posCart: [] // Items in current POS checkout cart
};

// Role Access Matrix - Authorized Menus per Role
const ROLE_ALLOWED_VIEWS = {
  'admin': ['dashboard', 'pos', 'branch-inventory', 'hq-audit', 'branch-audit', 'goods-receipt', 'transfers', 'products', 'master-settings', 'branches', 'employees'],
  'hq_stock_staff': ['dashboard', 'pos', 'branch-inventory', 'hq-audit', 'branch-audit', 'goods-receipt', 'transfers', 'products', 'master-settings'],
  'branch_staff': ['dashboard', 'pos', 'branch-inventory', 'branch-audit', 'goods-receipt', 'transfers'],
  'technical_staff': ['dashboard', 'pos', 'branch-inventory', 'branch-audit', 'products'],
  'purchase_staff': ['dashboard', 'branch-inventory', 'goods-receipt', 'products', 'master-settings']
};

// Thai Role Mapping Helper
function formatRoleThai(roleKey) {
  const roles = {
    'admin': 'ผู้ดูแลระบบ (Admin)',
    'branch_staff': 'พนักงานฝ่ายขาย (Sales)',
    'technical_staff': 'พนักงานฝ่ายเทคนิค (Technician)',
    'purchase_staff': 'ฝ่ายจัดซื้อ (Purchasing)',
    'hq_stock_staff': 'พนักงานฝ่ายสต็อก (Stock/HQ)'
  };
  return roles[roleKey] || roleKey;
}

// Auto SKU Code Generator Helper
function generateAutoSKU(brand = '', model = '', capacity = '') {
  let bCode = brand ? brand.substring(0, 3).toUpperCase() : 'SKU';
  let mCode = model ? model.replace(/[^a-zA-Z0-9]/g, '').substring(0, 5).toUpperCase() : '';
  let cCode = capacity ? capacity.replace(/\s+/g, '').toUpperCase() : '';
  
  if (!mCode) {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    return `SKU-${bCode}-${randomNum}`;
  }
  
  return `${bCode}-${mCode}${cCode ? '-' + cCode : ''}`;
}

// Auto Full Product Name Generator Helper
function generateAutoName(brand = '', model = '', capacity = '', color = '') {
  const parts = [brand, model, capacity, color].map(p => (p || '').trim()).filter(p => p.length > 0);
  return parts.join(' ');
}

// Global Toast Notification Helper
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <i class="fa-solid ${type === 'success' ? 'fa-circle-check' : 'fa-triangle-exclamation'}" style="color: ${type === 'success' ? '#10b981' : '#ef4444'}"></i>
    <span>${message}</span>
  `;
  container.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 4000);
}

// API Request Client
async function apiRequest(endpoint, method = 'GET', data = null, isFormData = false) {
  const headers = {};
  if (state.token) {
    headers['Authorization'] = `Bearer ${state.token}`;
  }

  const config = { method, headers };

  if (data) {
    if (isFormData) {
      config.body = data;
    } else {
      headers['Content-Type'] = 'application/json';
      config.body = JSON.stringify(data);
    }
  }

  try {
    const res = await fetch(`/api${endpoint}`, config);
    const result = await res.json();
    if (!res.ok) {
      throw new Error(result.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์');
    }
    return result;
  } catch (err) {
    showToast(err.message, 'error');
    throw err;
  }
}

function fillLogin(username, password) {
  const usernameInput = document.getElementById('login-username');
  if (usernameInput) usernameInput.value = username;
  document.getElementById('login-password').value = password;
}

// Modal Helpers
function openModal(title, bodyHtml, footerHtml = '') {
  document.getElementById('modal-title').innerText = title;
  document.getElementById('modal-body').innerHTML = bodyHtml;
  document.getElementById('modal-footer').innerHTML = footerHtml;
  document.getElementById('app-modal').classList.add('active');
}

function closeModal() {
  document.getElementById('app-modal').classList.remove('active');
}

document.getElementById('modal-close').addEventListener('click', closeModal);

async function loadMasterOptions() {
  if (!state.token) return;
  try {
    const [masterRes, branchRes] = await Promise.all([
      apiRequest('/master/options'),
      apiRequest('/branches')
    ]);
    if (masterRes && masterRes.success) {
      state.masterOptions = masterRes.options || { brands: [], models: [], capacities: [], colors: [], categories: [] };
      if (branchRes && branchRes.success) {
        state.masterOptions.branches = branchRes.branches || [];
      }
    }
  } catch (err) {
    console.error('Failed to load master options', err);
  }
}

// Apply Role-Based Sidebar Navigation Visibility
function updateSidebarMenuByRole(userRole) {
  const allowedViews = ROLE_ALLOWED_VIEWS[userRole] || ['dashboard'];

  document.querySelectorAll('.sidebar-menu li').forEach(li => {
    const navLink = li.querySelector('.nav-link');
    if (navLink) {
      const viewName = navLink.getAttribute('data-view');
      if (allowedViews.includes(viewName)) {
        li.style.display = 'block';
      } else {
        li.style.display = 'none';
      }
    }
  });
}

// Client Router & View Switcher
function navigateTo(viewName) {
  const userRole = state.user ? state.user.role : 'branch_staff';
  const allowedViews = ROLE_ALLOWED_VIEWS[userRole] || ['dashboard'];

  if (!allowedViews.includes(viewName)) {
    showToast(`ตำแหน่ง ${formatRoleThai(userRole)} ไม่มีสิทธิ์เข้าถึงเมนูนี้`, 'error');
    viewName = allowedViews[0] || 'dashboard';
  }

  state.currentView = viewName;
  
  document.querySelectorAll('.nav-link').forEach(link => {
    if (link.getAttribute('data-view') === viewName) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });

  const heading = document.getElementById('page-heading');
  const subheading = document.getElementById('page-subheading');

  switch (viewName) {
    case 'dashboard':
      heading.innerText = 'แผงควบคุมภาพรวมระบบคลังสินค้า';
      subheading.innerText = 'สรุปยอดสินค้าคงคลังและสถานะการนับสต็อกประจำวันของทั้ง 5 สาขา';
      renderDashboardView();
      break;
    case 'pos':
      heading.innerText = 'ขายสินค้าหน้าร้าน & ออกใบเสร็จ (POS Sales Checkout)';
      subheading.innerText = 'ระบบขายสินค้า ตัดสต็อก ตัด IMEI อัตโนมัติ พร้อมออกใบเสร็จรับเงินอย่างย่อ';
      renderPosView();
      break;
    case 'branch-inventory':
      heading.innerText = 'สินค้าในสาขา (Branch Inventory)';
      subheading.innerText = 'รายการสินค้าคงคลังที่มีอยู่จริงในสาขาของคุณ';
      renderBranchInventoryView();
      break;
    case 'hq-audit':
      heading.innerText = 'แดชบอร์ดตรวจสอบสต็อก (ส่วนกลาง HQ)';
      subheading.innerText = 'ตรวจสอบและอนุมัติการนับสต็อกประจำวันของสาขาทั้งหมดพร้อมระบบแจ้งเตือนสี';
      renderHqAuditView();
      break;
    case 'branch-audit':
      heading.innerText = 'นับสต็อกประจำวัน (Branch Daily Stock Check)';
      subheading.innerText = 'สแกน IMEI/ซีเรียล หรือระบุจำนวนนับจริงเพื่อคำนวณ ยอดที่ขาด/เกิน';
      renderBranchAuditView();
      break;
    case 'goods-receipt':
      heading.innerText = 'รับสินค้าเข้าสต็อก (Goods Receipt)';
      subheading.innerText = 'บันทึกนำเข้าสินค้าเข้าคลังสาขา พร้อมช่องป้อน IMEI แยกตามจำนวนสินค้า';
      renderGoodsReceiptView();
      break;
    case 'transfers':
      heading.innerText = 'โอนย้ายสินค้าระหว่างสาขา';
      subheading.innerText = 'สร้างรายการโอนย้ายสินค้าและพิมพ์ ใบโอนย้ายสินค้าระหว่างสาขา';
      renderTransfersView();
      break;
    case 'products':
      heading.innerText = 'ข้อมูลหลักสินค้า (Product Master Catalog)';
      subheading.innerText = 'จัดการรหัส SKU และชื่อสินค้าแบบเต็มอัตโนมัติ โดยเลือกจาก Master Data ที่กำหนด';
      renderProductMasterView();
      break;
    case 'master-settings':
      heading.innerText = 'ตั้งค่าตัวเลือก Master Data (System Master Options)';
      subheading.innerText = 'เพิ่มและจัดการ ยี่ห้อ, ชื่อรุ่น, ความจุ, สีสินค้า และ หมวดหมู่สินค้า เพื่อใช้งานทั่วทั้งระบบโดยไม่ต้องแก้โค้ด';
      renderMasterSettingsView();
      break;
    case 'branches':
      heading.innerText = 'จัดการสาขา (Branch Management)';
      subheading.innerText = 'เพิ่ม แก้ไข และเปิด/ปิดการใช้งานสาขาในระบบ';
      renderBranchManagementView();
      break;
    case 'employees':
      heading.innerText = 'จัดการพนักงาน (Employee Management)';
      subheading.innerText = 'จัดการพนักงาน กำหนดสิทธิ์ และมอบหมายสาขาประจำ';
      renderEmployeeManagementView();
      break;
  }
}

// Authentication Handlers
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const usernameInput = document.getElementById('login-username');
  const username = usernameInput ? usernameInput.value : '';
  const password = document.getElementById('login-password').value;

  try {
    const res = await apiRequest('/auth/login', 'POST', { username, password });
    if (res.success) {
      state.token = res.token;
      state.user = res.user;
      localStorage.setItem('silmin_token', res.token);
      localStorage.setItem('silmin_user', JSON.stringify(res.user));

      showToast(`ยินดีต้อนรับคุณ ${res.user.fullName || res.user.username} (สิทธิ์: ${formatRoleThai(res.user.role)})`);
      initAppSession();
    }
  } catch (err) {
    // Handled
  }
});

document.getElementById('logout-btn').addEventListener('click', () => {
  state.token = null;
  state.user = null;
  localStorage.removeItem('silmin_token');
  localStorage.removeItem('silmin_user');
  document.getElementById('main-view').style.display = 'none';
  document.getElementById('auth-view').style.display = 'flex';
  showToast('ออกจากระบบเรียบร้อยแล้ว');
});

function initAppSession() {
  if (!state.token || !state.user) {
    document.getElementById('main-view').style.display = 'none';
    document.getElementById('auth-view').style.display = 'flex';
    return;
  }

  document.getElementById('auth-view').style.display = 'none';
  document.getElementById('main-view').style.display = 'flex';

  document.getElementById('current-user-name').innerText = state.user.fullName || state.user.username;
  document.getElementById('current-user-role').innerText = formatRoleThai(state.user.role);
  document.getElementById('current-user-avatar').innerText = (state.user.fullName || state.user.username).charAt(0).toUpperCase();

  const branchName = state.user.branch ? state.user.branch.name : 'ส่วนกลาง (สำนักงานใหญ่)';
  document.getElementById('current-branch-name').innerText = branchName;

  updateSidebarMenuByRole(state.user.role);

  document.querySelectorAll('.nav-link').forEach(link => {
    link.onclick = (e) => {
      e.preventDefault();
      const targetView = link.getAttribute('data-view');
      navigateTo(targetView);
    };
  });

  loadMasterOptions();

  const allowedViews = ROLE_ALLOWED_VIEWS[state.user.role] || ['dashboard'];
  navigateTo(allowedViews[0]);
}

/* ==========================================================================
   VIEW 1: DASHBOARD OVERVIEW
   ========================================================================== */
async function renderDashboardView() {
  const container = document.getElementById('content-container');
  container.innerHTML = `<div style="padding: 2rem; text-align: center; color: var(--text-muted);"><i class="fa-solid fa-spinner fa-spin" style="font-size:2rem;"></i> กำลังโหลดภาพรวมระบบ...</div>`;

  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const [stockRes, auditRes] = await Promise.all([
      apiRequest('/stock/all'),
      apiRequest(`/audit/dashboard?date=${todayStr}`)
    ]);

    const totalProductsInStock = stockRes.stock ? stockRes.stock.reduce((sum, item) => sum + item.quantity, 0) : 0;
    const branchesSummary = auditRes.summary ? auditRes.summary.branches : [];
    const pendingAuditsCount = auditRes.summary ? auditRes.summary.pendingCount : 0;

    const userRole = state.user ? state.user.role : 'branch_staff';
    const allowedViews = ROLE_ALLOWED_VIEWS[userRole] || ['dashboard'];

    container.innerHTML = `
      <div class="grid-cards">
        <div class="card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
            <span style="color: var(--text-muted); font-size: 0.85rem; font-weight:600;">สินค้าคงเหลือรวมทั้งระบบ</span>
            <i class="fa-solid fa-boxes-stacked" style="color: var(--accent-primary); font-size:1.4rem;"></i>
          </div>
          <div style="font-size: 2.2rem; font-weight:800;">${totalProductsInStock.toLocaleString()} <span style="font-size:0.9rem; color:var(--text-muted);">ชิ้น</span></div>
          <p style="font-size: 0.8rem; color: var(--text-muted); margin-top:0.3rem;">ครอบคลุมทั้ง 5 สาขาที่เปิดใช้งาน</p>
        </div>

        <div class="card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
            <span style="color: var(--text-muted); font-size: 0.85rem; font-weight:600;">สถานะนับสต็อกวันนี้ (ส่วนกลาง)</span>
            <i class="fa-solid fa-clipboard-check" style="color: var(--accent-gold); font-size:1.4rem;"></i>
          </div>
          <div style="font-size: 2.2rem; font-weight:800; color: ${pendingAuditsCount > 0 ? '#fbbf24' : '#34d399'};">
            ${auditRes.summary ? auditRes.summary.submittedCount : 0} / 5 <span style="font-size:0.9rem; color:var(--text-muted);">สาขาส่งแล้ว</span>
          </div>
          <p style="font-size: 0.8rem; color: var(--text-muted); margin-top:0.3rem;">${pendingAuditsCount} สาขารอการตรวจสอบจากส่วนกลาง</p>
        </div>

        <div class="card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
            <span style="color: var(--text-muted); font-size: 0.85rem; font-weight:600;">ปุ่มเมนูด่วน (ตามสิทธิ์การใช้งาน)</span>
            <i class="fa-solid fa-bolt" style="color: var(--accent-secondary); font-size:1.4rem;"></i>
          </div>
          <div style="display:flex; gap:0.5rem; margin-top:0.8rem; flex-wrap:wrap;">
            ${allowedViews.includes('pos') ? `<button class="btn btn-primary btn-sm" onclick="navigateTo('pos')"><i class="fa-solid fa-cash-register"></i> ขายสินค้า (POS)</button>` : ''}
            ${allowedViews.includes('branch-inventory') ? `<button class="btn btn-secondary btn-sm" onclick="navigateTo('branch-inventory')"><i class="fa-solid fa-boxes-packing"></i> สินค้าในสาขา</button>` : ''}
            ${allowedViews.includes('master-settings') ? `<button class="btn btn-secondary btn-sm" onclick="navigateTo('master-settings')"><i class="fa-solid fa-sliders"></i> ตั้งค่า Master Data</button>` : ''}
          </div>
        </div>
      </div>

      <div class="card" style="margin-top: 1.5rem;">
        <h3 style="font-size: 1.1rem; font-weight:700; margin-bottom: 1rem; display:flex; align-items:center; gap:0.5rem;">
          <i class="fa-solid fa-store" style="color:var(--accent-primary);"></i> สถานะการนับสต็อกประจำวันเรียลไทม์ 5 สาขา (${todayStr})
        </h3>
        
        <div class="audit-grid">
          ${branchesSummary.map(b => `
            <div class="audit-card status-${b.colorCode}">
              <div class="audit-header">
                <div>
                  <div class="branch-name">${b.branch.name}</div>
                  <div class="branch-code">${b.branch.code} • เบอร์โทร: ${b.branch.phone}</div>
                </div>
                <span class="badge badge-${b.colorCode}">${b.status}</span>
              </div>

              <div class="audit-stats">
                <div class="stat-item">
                  <div class="stat-val">${b.totalExpected}</div>
                  <div class="stat-lbl">คาดการณ์</div>
                </div>
                <div class="stat-item">
                  <div class="stat-val">${b.totalActual}</div>
                  <div class="stat-lbl">นับได้จริง</div>
                </div>
                <div class="stat-item">
                  <div class="stat-val" style="color: ${b.totalVariance === 0 ? '#34d399' : '#f87171'};">${b.totalVariance}</div>
                  <div class="stat-lbl">ยอดที่ขาด/เกิน</div>
                </div>
              </div>

              <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.8rem; color:var(--text-muted);">
                <span>ผู้ส่งรายงาน: <strong>${b.submittedBy || 'ยังไม่มีข้อมูล'}</strong></span>
                ${b.auditId ? `<button class="btn btn-secondary btn-sm" onclick="inspectBranchAudit('${b.auditId}')"><i class="fa-solid fa-eye"></i> ตรวจสอบ</button>` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div style="color:#ef4444; padding:2rem;">เกิดข้อผิดพลาดในการโหลดภาพรวมระบบ: ${err.message}</div>`;
  }
}

/* ==========================================================================
   VIEW 1.5: BRANCH INVENTORY VIEW
   ========================================================================== */
async function renderBranchInventoryView(selectedBranchId = null) {
  const container = document.getElementById('content-container');
  container.innerHTML = `<div style="padding: 2rem; text-align: center; color: var(--text-muted);"><i class="fa-solid fa-spinner fa-spin" style="font-size:2rem;"></i> กำลังโหลดรายการสินค้าประจำสาขา...</div>`;

  try {
    const queryParam = selectedBranchId ? `?branchId=${selectedBranchId}` : '';
    const res = await apiRequest(`/stock/my-branch${queryParam}`);
    const stockList = res.stock || [];
    const currentBranch = res.branch || { name: 'สาขาประจำของคุณ' };

    const isAdminOrHq = ['admin', 'hq_stock_staff'].includes(state.user.role);

    container.innerHTML = `
      <div class="card" style="margin-bottom:1.5rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem;">
        <div>
          <h3 style="font-size:1.2rem; font-weight:700; display:flex; align-items:center; gap:0.5rem;">
            <i class="fa-solid fa-boxes-packing" style="color:var(--accent-primary);"></i> รายการสินค้าในคลัง: ${currentBranch.name}
          </h3>
          <p style="font-size:0.85rem; color:var(--text-muted);">แสดงรายการสินค้าที่มีอยู่จริง พร้อมจำนวนและหมายเลขซีเรียล/IMEI ในสาขานี้เท่านั้น</p>
        </div>

        <div style="display:flex; align-items:center; gap:1rem;">
          ${isAdminOrHq ? `
            <div style="display:flex; align-items:center; gap:0.5rem;">
              <label style="font-size:0.85rem; font-weight:600; color:var(--text-muted);">เปลี่ยนสาขา:</label>
              <select id="bi-branch-select" class="form-select" style="width:auto;" onchange="renderBranchInventoryView(this.value)">
                ${state.masterOptions.branches ? state.masterOptions.branches.map(b => `<option value="${b._id}" ${currentBranch._id === b._id ? 'selected' : ''}>${b.name}</option>`).join('') : ''}
              </select>
            </div>
          ` : ''}
          <input type="text" id="bi-search-input" class="form-control" placeholder="ค้นหา SKU, ชื่อสินค้า หรือ IMEI..." style="width:240px;" onkeyup="filterBranchInventoryTable()">
        </div>
      </div>

      <div class="table-container">
        <table class="data-table" id="bi-table">
          <thead>
            <tr>
              <th style="width:60px; text-align:center;">ไอคอน</th>
              <th>รหัส SKU</th>
              <th>รายการสินค้า</th>
              <th>ยี่ห้อ / ชื่อรุ่น</th>
              <th>ความจุ / สีสินค้า</th>
              <th>ราคาขาย</th>
              <th>จำนวนคงเหลือ</th>
              <th>รายการหมายเลขซีเรียล / IMEI ที่มีในสต็อก</th>
            </tr>
          </thead>
          <tbody>
            ${stockList.length === 0 ? `<tr><td colspan="8" style="text-align:center; color:var(--text-muted); padding:2rem;">ไม่พบรายการสินค้าคงเหลือในคลังสาขานี้</td></tr>` : ''}
            ${stockList.map(st => {
              const p = st.product || {};
              const activeImeis = st.imei_serials
                ? st.imei_serials.filter(i => i.status === 'in_stock').map(i => i.imei)
                : [];

              return `
                <tr class="bi-row" data-search="${(st.sku + ' ' + (p.name || '') + ' ' + (p.brand || '') + ' ' + (p.model || '') + ' ' + activeImeis.join(' ')).toLowerCase()}">
                  <td style="text-align:center; font-size:1.4rem; color:var(--accent-primary);">
                    <i class="fa-solid fa-mobile-screen-button"></i>
                  </td>
                  <td><strong>${st.sku}</strong></td>
                  <td><strong>${p.name || st.sku}</strong></td>
                  <td><span class="badge badge-gray">${p.brand || '-'}</span> ${p.model || ''}</td>
                  <td>${p.variation || (p.capacity + ' ' + p.color) || '-'}</td>
                  <td><strong style="color:#34d399;">฿${(p.selling_price || 0).toLocaleString()}</strong></td>
                  <td>
                    <span class="badge badge-${st.quantity > 0 ? 'green' : 'red'}" style="font-size:0.9rem;">
                      ${st.quantity > 0 ? 'มีสินค้า ' + st.quantity + ' ชิ้น' : 'สินค้าหมด'}
                    </span>
                  </td>
                  <td style="font-size:0.82rem;">
                    ${activeImeis.length > 0 ? `
                      <details>
                        <summary style="cursor:pointer; color:var(--accent-secondary); font-weight:600;">
                          ดู IMEI ทั้งหมด (${activeImeis.length} เครื่อง)
                        </summary>
                        <div style="margin-top:0.4rem; max-height:100px; overflow-y:auto; background:rgba(0,0,0,0.3); padding:0.5rem; border-radius:6px;">
                          ${activeImeis.map(i => `<div style="font-family:monospace; color:#38bdf8;">• ${i}</div>`).join('')}
                        </div>
                      </details>
                    ` : '<span style="color:var(--text-muted);">-</span>'}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div style="color:#ef4444; padding:2rem;">เกิดข้อผิดพลาดในการโหลดคลังสินค้าสาขา: ${err.message}</div>`;
  }
}

function filterBranchInventoryTable() {
  const query = document.getElementById('bi-search-input').value.toLowerCase().trim();
  document.querySelectorAll('.bi-row').forEach(row => {
    const searchData = row.getAttribute('data-search') || '';
    if (searchData.includes(query)) {
      row.style.display = '';
    } else {
      row.style.display = 'none';
    }
  });
}

/* ==========================================================================
   VIEW 1.2: POS SALES CHECKOUT & RECEIPT (เมนูสำหรับกดขายพร้อมออกใบเสร็จ)
   ========================================================================== */
async function renderPosView(selectedBranchId = null) {
  const container = document.getElementById('content-container');
  container.innerHTML = `<div style="padding: 2rem; text-align: center; color: var(--text-muted);"><i class="fa-solid fa-spinner fa-spin" style="font-size:2rem;"></i> กำลังโหลดระบบขายสินค้า POS...</div>`;

  try {
    const queryParam = selectedBranchId ? `?branchId=${selectedBranchId}` : '';
    const res = await apiRequest(`/stock/my-branch${queryParam}`);
    const stockList = res.stock || [];
    const currentBranch = res.branch || { name: 'สาขาประจำของคุณ' };

    const isAdminOrHq = ['admin', 'hq_stock_staff'].includes(state.user.role);

    container.innerHTML = `
      <div style="display:grid; grid-template-columns: 1.3fr 1fr; gap:1.2rem; align-items:start;">
        <!-- Left Side: Product Selection & Barcode Scanner -->
        <div>
          <div class="card" style="margin-bottom:1rem;">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.8rem; margin-bottom:1rem;">
              <div>
                <h3 style="font-size:1.15rem; font-weight:700; display:flex; align-items:center; gap:0.5rem;">
                  <i class="fa-solid fa-cash-register" style="color:var(--accent-primary);"></i> รายการสินค้าในสต็อก: ${currentBranch.name}
                </h3>
                <p style="font-size:0.8rem; color:var(--text-muted);">เลือกสินค้า และเลือกหมายเลข IMEI เพื่อเพิ่มลงตะกร้าขาย</p>
              </div>

              ${isAdminOrHq ? `
                <div style="display:flex; align-items:center; gap:0.4rem;">
                  <label style="font-size:0.8rem; font-weight:600; color:var(--text-muted);">เปลี่ยนสาขา:</label>
                  <select class="form-select" style="width:auto; padding:0.3rem 0.6rem; font-size:0.82rem;" onchange="renderPosView(this.value)">
                    ${state.masterOptions.branches ? state.masterOptions.branches.map(b => `<option value="${b._id}" ${currentBranch._id === b._id ? 'selected' : ''}>${b.name}</option>`).join('') : ''}
                  </select>
                </div>
              ` : ''}
            </div>

            <!-- Barcode / IMEI Fast Scanner -->
            <div style="background:rgba(99,102,241,0.1); border:1px solid rgba(99,102,241,0.25); padding:0.8rem; border-radius:6px; margin-bottom:1rem;">
              <label style="font-size:0.8rem; font-weight:700; color:var(--accent-secondary);">
                <i class="fa-solid fa-barcode"></i> ยิงสแกน IMEI / บาร์โค้ด สินค้าเพื่อเพิ่มลงตะกร้ารวดเร็ว
              </label>
              <input type="text" id="pos-barcode-input" class="form-control" placeholder="สแกน หรือ พิมพ์หมายเลข IMEI/ซีเรียล แล้วกด Enter..." style="margin-top:0.4rem;" autofocus>
            </div>

            <input type="text" id="pos-search-input" class="form-control" placeholder="ค้นหาชื่อสินค้า, SKU, ยี่ห้อ หรือ รุ่น..." onkeyup="filterPosCatalogTable()" style="margin-bottom:1rem;">

            <!-- Stock Product Table -->
            <div class="table-container" style="max-height:450px; overflow-y:auto;">
              <table class="data-table" id="pos-catalog-table">
                <thead>
                  <tr>
                    <th style="width:50px; text-align:center;">ไอคอน</th>
                    <th>รายการสินค้า / SKU</th>
                    <th>ราคาขาย</th>
                    <th>สต็อก</th>
                    <th>เลือก IMEI เครื่องที่ขาย</th>
                    <th style="text-align:center;">ดำเนินการ</th>
                  </tr>
                </thead>
                <tbody>
                  ${stockList.length === 0 ? `<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:2rem;">ไม่พบสินค้าพร้อมขายในสาขานี้</td></tr>` : ''}
                  ${stockList.map((st, idx) => {
                    const p = st.product || {};
                    const activeImeis = st.imei_serials
                      ? st.imei_serials.filter(i => i.status === 'in_stock').map(i => i.imei)
                      : [];

                    const inStock = st.quantity > 0;

                    return `
                      <tr class="pos-item-row" data-search="${(st.sku + ' ' + (p.name || '') + ' ' + (p.brand || '') + ' ' + (p.model || '') + ' ' + activeImeis.join(' ')).toLowerCase()}">
                        <td style="text-align:center; font-size:1.3rem; color:var(--accent-primary);">
                          <i class="fa-solid fa-mobile-screen-button"></i>
                        </td>
                        <td>
                          <strong>${p.name || st.sku}</strong><br>
                          <span style="font-size:0.75rem; color:var(--text-muted);">SKU: ${st.sku}</span>
                        </td>
                        <td><strong style="color:#34d399;">฿${(p.selling_price || 0).toLocaleString()}</strong></td>
                        <td>
                          <span class="badge badge-${inStock ? 'green' : 'red'}">
                            ${st.quantity} เครื่อง
                          </span>
                        </td>
                        <td>
                          ${activeImeis.length > 0 ? `
                            <select id="pos-imei-select-${idx}" class="form-select" style="padding:0.3rem 0.5rem; font-size:0.8rem;">
                              ${activeImeis.map(i => `<option value="${i}">${i}</option>`).join('')}
                            </select>
                          ` : `<span style="font-size:0.8rem; color:var(--text-muted);">- ไม่ระบุ IMEI -</span>`}
                        </td>
                        <td style="text-align:center;">
                          <button class="btn btn-primary btn-sm" ${!inStock ? 'disabled' : ''} onclick="addToPosCart('${st.product ? st.product._id : ''}', '${st.sku}', '${(p.name || st.sku).replace(/'/g, "\\'")}', ${p.selling_price || 0}, ${idx})">
                            <i class="fa-solid fa-cart-plus"></i> เพิ่ม
                          </button>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Right Side: POS Shopping Cart & Checkout Panel -->
        <div>
          <div class="card" style="position:sticky; top:1rem;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:0.6rem;">
              <h3 style="font-size:1.15rem; font-weight:700; display:flex; align-items:center; gap:0.5rem; color:#34d399;">
                <i class="fa-solid fa-shopping-cart"></i> ตะกร้าสินค้าชำระเงิน
              </h3>
              <button class="btn btn-danger btn-sm" onclick="clearPosCart()"><i class="fa-solid fa-trash"></i> ล้างตะกร้า</button>
            </div>

            <!-- Customer Info Form -->
            <div style="background:rgba(0,0,0,0.25); padding:0.8rem; border-radius:6px; margin-bottom:1rem;">
              <div style="font-weight:700; font-size:0.85rem; margin-bottom:0.5rem; color:var(--accent-secondary);">
                <i class="fa-solid fa-user-tag"></i> ข้อมูลลูกค้า (สำหรับออกใบเสร็จ)
              </div>
              <div style="display:grid; grid-template-columns: 1fr 1fr; gap:0.6rem;">
                <input type="text" id="pos-cust-name" class="form-control" style="font-size:0.82rem;" placeholder="ชื่อลูกค้า (เช่น ลูกค้าทั่วไป)" value="ลูกค้าทั่วไป">
                <input type="text" id="pos-cust-phone" class="form-control" style="font-size:0.82rem;" placeholder="เบอร์โทรศัพท์ (ถ้ามี)">
              </div>
            </div>

            <!-- Cart Items List -->
            <div id="pos-cart-items-container" style="max-height:220px; overflow-y:auto; margin-bottom:1rem; border:1px solid rgba(255,255,255,0.1); border-radius:6px; padding:0.5rem;">
              <!-- Rendered Cart Items -->
            </div>

            <!-- Totals & Payment Calculations -->
            <div style="background:rgba(0,0,0,0.3); padding:1rem; border-radius:8px; margin-bottom:1rem;">
              <div style="display:flex; justify-content:space-between; margin-bottom:0.4rem; font-size:0.9rem;">
                <span>ยอดรวมสินค้า (Subtotal):</span>
                <strong id="pos-subtotal-val">฿0</strong>
              </div>

              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem; font-size:0.85rem;">
                <span>ส่วนลดพิเศษ (Discount):</span>
                <input type="number" id="pos-discount-input" class="form-control" style="width:110px; padding:0.25rem 0.5rem; text-align:right;" min="0" value="0" oninput="updatePosCartTotals()">
              </div>

              <div style="display:flex; justify-content:space-between; margin-top:0.8rem; padding-top:0.6rem; border-top:1px solid rgba(255,255,255,0.15); font-size:1.2rem; font-weight:800; color:#34d399;">
                <span>ยอดรวมสุทธิ (Grand Total):</span>
                <span id="pos-grandtotal-val">฿0</span>
              </div>
            </div>

            <!-- Payment Method & Received Amount -->
            <div class="form-group" style="margin-bottom:0.8rem;">
              <label for="pos-payment-method" style="font-size:0.85rem; font-weight:600;">ช่องทางการชำระเงิน</label>
              <select id="pos-payment-method" class="form-select" onchange="toggleCashReceivedField(this.value)">
                <option value="cash">เงินสด (Cash)</option>
                <option value="transfer">โอนเงิน / สแกน QR Code (Bank Transfer)</option>
                <option value="credit_card">บัตรเครดิต (Credit Card)</option>
              </select>
            </div>

            <div id="pos-cash-container" style="display:grid; grid-template-columns: 1fr 1fr; gap:0.6rem; margin-bottom:1rem;">
              <div>
                <label style="font-size:0.8rem; font-weight:600; color:var(--text-muted);">รับเงินมา (บาท)</label>
                <input type="number" id="pos-received-input" class="form-control" placeholder="0" min="0" oninput="updatePosCartTotals()">
              </div>
              <div>
                <label style="font-size:0.8rem; font-weight:600; color:var(--text-muted);">เงินทอน (บาท)</label>
                <div id="pos-change-val" style="font-size:1.2rem; font-weight:800; color:#fbbf24; padding-top:0.4rem;">฿0</div>
              </div>
            </div>

            <!-- Submit Checkout & Print Receipt Button -->
            <button class="btn btn-success" style="width:100%; padding:0.8rem; font-size:1.05rem; font-weight:800;" onclick="submitPosCheckout('${currentBranch._id}')">
              <i class="fa-solid fa-receipt"></i> ชำระเงิน & ออกใบเสร็จรับเงิน
            </button>
          </div>
        </div>
      </div>
    `;

    // Render initial Cart
    renderPosCartUI();

    // Barcode scanner input event
    const barcodeInput = document.getElementById('pos-barcode-input');
    if (barcodeInput) {
      barcodeInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const scannedVal = barcodeInput.value.trim();
          if (scannedVal) {
            processPosScannedImei(scannedVal, stockList);
            barcodeInput.value = '';
          }
        }
      });
    }

  } catch (err) {
    container.innerHTML = `<div style="color:#ef4444; padding:2rem;">เกิดข้อผิดพลาดในการโหลดระบบ POS: ${err.message}</div>`;
  }
}

function filterPosCatalogTable() {
  const query = document.getElementById('pos-search-input').value.toLowerCase().trim();
  document.querySelectorAll('.pos-item-row').forEach(row => {
    const searchData = row.getAttribute('data-search') || '';
    if (searchData.includes(query)) {
      row.style.display = '';
    } else {
      row.style.display = 'none';
    }
  });
}

function processPosScannedImei(scannedImei, stockList) {
  let foundItem = null;
  let matchedImei = '';

  stockList.forEach(st => {
    if (st.imei_serials) {
      const match = st.imei_serials.find(i => i.imei === scannedImei && i.status === 'in_stock');
      if (match) {
        foundItem = st;
        matchedImei = match.imei;
      }
    }
  });

  if (foundItem) {
    addToPosCart(
      foundItem.product ? foundItem.product._id : '',
      foundItem.sku,
      foundItem.product ? foundItem.product.name : foundItem.sku,
      foundItem.product ? foundItem.product.selling_price : 0,
      null,
      matchedImei
    );
    showToast(`สแกนแมตช์สำเร็จ: เพิ่ม IMEI ${matchedImei} ลงตะกร้าเรียบร้อยแล้ว`);
  } else {
    showToast(`ไม่พบหมายเลข IMEI ${scannedImei} ที่พร้อมขายในคลังสาขานี้`, 'error');
  }
}

function addToPosCart(productId, sku, productName, unitPrice, selectIdx = null, customImei = null) {
  let imei = customImei;
  if (!imei && selectIdx !== null) {
    const selectEl = document.getElementById(`pos-imei-select-${selectIdx}`);
    if (selectEl) imei = selectEl.value;
  }

  // Check if item with same SKU & IMEI already in cart
  const existing = state.posCart.find(item => item.sku === sku && item.imei === imei);
  if (existing) {
    showToast(`รายการสินค้า IMEI ${imei || sku} อยู่ในตะกร้าเรียบร้อยแล้ว`, 'error');
    return;
  }

  state.posCart.push({
    productId,
    sku,
    productName,
    imei: imei || '',
    unitPrice: Number(unitPrice),
    quantity: 1,
    discount: 0,
    totalPrice: Number(unitPrice)
  });

  showToast(`เพิ่ม "${productName}" ลงตะกร้าสำเร็จ`);
  renderPosCartUI();
}

function removeFromPosCart(index) {
  state.posCart.splice(index, 1);
  renderPosCartUI();
}

function clearPosCart() {
  state.posCart = [];
  renderPosCartUI();
}

function renderPosCartUI() {
  const container = document.getElementById('pos-cart-items-container');
  if (!container) return;

  if (state.posCart.length === 0) {
    container.innerHTML = `<div style="text-align:center; color:var(--text-muted); padding:1.5rem; font-size:0.85rem;">ยังไม่มีรายการสินค้าในตะกร้า</div>`;
  } else {
    container.innerHTML = state.posCart.map((item, idx) => `
      <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.2); padding:0.5rem; border-radius:6px; margin-bottom:0.4rem; font-size:0.83rem;">
        <div style="flex:1;">
          <strong>${item.productName}</strong><br>
          <span style="font-size:0.75rem; color:var(--text-muted);">SKU: ${item.sku} ${item.imei ? '• IMEI: ' + item.imei : ''}</span>
        </div>
        <div style="text-align:right; margin-right:0.6rem;">
          <strong style="color:#34d399;">฿${item.unitPrice.toLocaleString()}</strong>
        </div>
        <button class="btn btn-danger btn-sm" style="padding:0.15rem 0.4rem;" onclick="removeFromPosCart(${idx})">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
    `).join('');
  }

  updatePosCartTotals();
}

function toggleCashReceivedField(paymentVal) {
  const cashContainer = document.getElementById('pos-cash-container');
  if (cashContainer) {
    if (paymentVal === 'cash') {
      cashContainer.style.display = 'grid';
    } else {
      cashContainer.style.display = 'none';
    }
  }
}

function updatePosCartTotals() {
  const subtotal = state.posCart.reduce((sum, i) => sum + i.totalPrice, 0);
  const discountInput = document.getElementById('pos-discount-input');
  const discount = discountInput ? (Number(discountInput.value) || 0) : 0;

  const grandTotal = Math.max(0, subtotal - discount);

  const subtotalEl = document.getElementById('pos-subtotal-val');
  const grandTotalEl = document.getElementById('pos-grandtotal-val');

  if (subtotalEl) subtotalEl.innerText = `฿${subtotal.toLocaleString()}`;
  if (grandTotalEl) grandTotalEl.innerText = `฿${grandTotal.toLocaleString()}`;

  const receivedInput = document.getElementById('pos-received-input');
  const changeEl = document.getElementById('pos-change-val');

  if (receivedInput && changeEl) {
    const received = Number(receivedInput.value) || 0;
    const change = Math.max(0, received - grandTotal);
    changeEl.innerText = `฿${change.toLocaleString()}`;
  }
}

async function submitPosCheckout(branchId) {
  if (state.posCart.length === 0) {
    showToast('กรุณาเลือกสินค้าลงตะกร้าอย่างน้อย 1 รายการก่อนกดชำระเงิน', 'error');
    return;
  }

  const custName = document.getElementById('pos-cust-name') ? document.getElementById('pos-cust-name').value : 'ลูกค้าทั่วไป';
  const custPhone = document.getElementById('pos-cust-phone') ? document.getElementById('pos-cust-phone').value : '';
  const discountTotal = document.getElementById('pos-discount-input') ? Number(document.getElementById('pos-discount-input').value) || 0 : 0;
  const paymentMethod = document.getElementById('pos-payment-method') ? document.getElementById('pos-payment-method').value : 'cash';
  const receivedAmount = document.getElementById('pos-received-input') ? Number(document.getElementById('pos-received-input').value) || 0 : 0;

  const subtotal = state.posCart.reduce((sum, i) => sum + i.totalPrice, 0);
  const grandTotal = Math.max(0, subtotal - discountTotal);

  if (paymentMethod === 'cash' && receivedAmount < grandTotal) {
    showToast(`จำนวนเงินสดที่รับมา (฿${receivedAmount}) น้อยกว่ายอดที่ต้องชำระ (฿${grandTotal})`, 'error');
    return;
  }

  try {
    const res = await apiRequest('/pos/checkout', 'POST', {
      branchId,
      customer: { name: custName, phone: custPhone },
      items: state.posCart,
      paymentMethod,
      receivedAmount: paymentMethod === 'cash' ? receivedAmount : grandTotal,
      discountTotal
    });

    if (res.success && res.sale) {
      showToast(res.message);
      state.posCart = [];
      openReceiptVoucherModal(res.sale);
      renderPosView(branchId);
    }
  } catch (err) {
    // Handled
  }
}

/* ==========================================================================
   PRINTABLE RECEIPT VOUCHER MODAL (ใบเสร็จรับเงินอย่างย่อ)
   ========================================================================== */
function openReceiptVoucherModal(sale) {
  const branch = sale.branch || {};
  const seller = sale.soldBy || {};
  const items = sale.items || [];
  const customer = sale.customer || {};

  const bodyHtml = `
    <div id="printable-receipt" class="printable-area" style="background:#fff; color:#000; padding:1.5rem; border-radius:8px; font-family:'Sarabun','Prompt',sans-serif; max-width:480px; margin:0 auto; box-shadow:0 0 10px rgba(0,0,0,0.15);">
      <!-- Receipt Header -->
      <div style="text-align:center; border-bottom:1px dashed #000; padding-bottom:0.8rem; margin-bottom:0.8rem;">
        <img src="/image/icon_silminbanana.png" alt="Silmin Banana Logo" style="height:46px; width:46px; object-fit:contain; margin-bottom:0.3rem;"><br>
        <h2 style="font-size:1.4rem; font-weight:800; margin:0; color:#000;">SILMIN BANANA POS</h2>
        <div style="font-size:0.85rem; font-weight:700; color:#333; margin-top:0.2rem;">${branch.name || 'สาขาใหญ่ สีลม'}</div>
        <div style="font-size:0.75rem; color:#555;">ที่อยู่: ${branch.address || '101 อาคารสีลมทาวเวอร์ ถนนสีลม กรุงเทพฯ'}</div>
        <div style="font-size:0.75rem; color:#555;">เบอร์โทรศัพท์: ${branch.phone || '02-111-2222'}</div>
        <div style="font-size:0.85rem; font-weight:800; color:#000; margin-top:0.5rem; text-decoration:underline;">
          ใบเสร็จรับเงิน / ใบกำกับภาษีอย่างย่อ
        </div>
      </div>

      <!-- Receipt Meta Info -->
      <div style="font-size:0.8rem; line-height:1.4; margin-bottom:0.8rem; border-bottom:1px dashed #000; padding-bottom:0.6rem; color:#000;">
        <div style="display:flex; justify-content:space-between;">
          <span><strong>เลขที่ใบเสร็จ:</strong> ${sale.receiptNumber}</span>
          <span><strong>วันที่:</strong> ${new Date(sale.createdAt || Date.now()).toLocaleDateString('th-TH')}</span>
        </div>
        <div style="display:flex; justify-content:space-between; margin-top:0.2rem;">
          <span><strong>พนักงานขาย:</strong> ${seller.fullName || seller.username || 'Staff'}</span>
          <span><strong>เวลา:</strong> ${new Date(sale.createdAt || Date.now()).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.</span>
        </div>
        <div style="margin-top:0.2rem;">
          <strong>ลูกค้า:</strong> ${customer.name || 'ลูกค้าทั่วไป'} ${customer.phone ? '(' + customer.phone + ')' : ''}
        </div>
      </div>

      <!-- Receipt Items Table -->
      <table style="width:100%; border-collapse:collapse; font-size:0.8rem; margin-bottom:0.8rem; color:#000;">
        <thead>
          <tr style="border-bottom:1px solid #000; text-align:left;">
            <th style="padding:4px 0;">รายการสินค้า</th>
            <th style="padding:4px 0; text-align:center;">จำนวน</th>
            <th style="padding:4px 0; text-align:right;">ราคา</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(i => `
            <tr style="border-bottom:1px dashed #eee;">
              <td style="padding:5px 0;">
                <strong style="color:#000;">${i.productName}</strong><br>
                <span style="font-size:0.72rem; color:#555;">SKU: ${i.sku} ${i.imei ? ' | IMEI: ' + i.imei : ''}</span>
              </td>
              <td style="padding:5px 0; text-align:center; vertical-align:top;">${i.quantity}</td>
              <td style="padding:5px 0; text-align:right; vertical-align:top;">฿${i.totalPrice.toLocaleString()}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <!-- Totals & Payment Details -->
      <div style="border-top:1px dashed #000; padding-top:0.6rem; font-size:0.82rem; color:#000;">
        <div style="display:flex; justify-content:space-between; margin-bottom:0.2rem;">
          <span>ยอดรวมสินค้า (Subtotal):</span>
          <span>฿${(sale.subtotal || 0).toLocaleString()}</span>
        </div>
        ${sale.discountTotal > 0 ? `
          <div style="display:flex; justify-content:space-between; margin-bottom:0.2rem; color:#dc2626;">
            <span>ส่วนลดพิเศษ (Discount):</span>
            <span>-฿${sale.discountTotal.toLocaleString()}</span>
          </div>
        ` : ''}
        <div style="display:flex; justify-content:space-between; font-size:1.05rem; font-weight:800; margin-top:0.4rem; padding-top:0.4rem; border-top:1px solid #000;">
          <span>ยอดชำระสุทธิ (Total):</span>
          <span>฿${(sale.grandTotal || 0).toLocaleString()}</span>
        </div>
        <div style="display:flex; justify-content:space-between; margin-top:0.4rem; font-size:0.78rem; color:#444;">
          <span>ชำระโดย: <strong>${sale.paymentMethod === 'cash' ? 'เงินสด (Cash)' : sale.paymentMethod === 'transfer' ? 'โอนเงิน / QR' : 'บัตรเครดิต'}</strong></span>
          <span>รับเงิน: ฿${(sale.receivedAmount || 0).toLocaleString()} | เงินทอน: ฿${(sale.changeAmount || 0).toLocaleString()}</span>
        </div>
      </div>

      <!-- Receipt Footer -->
      <div style="text-align:center; margin-top:1.2rem; padding-top:0.6rem; border-top:1px dashed #000; font-size:0.75rem; color:#444;">
        <div>*** ขอบคุณที่ใช้บริการ SILMIN BANANA POS ***</div>
        <div style="margin-top:0.2rem;">สินค้าซื้อแล้วมีรับประกันตามเงื่อนไขบริษัท</div>
      </div>
    </div>
  `;

  const footerHtml = `
    <button class="btn btn-secondary" onclick="closeModal()">ปิดหน้าต่าง</button>
    <button class="btn btn-primary" onclick="window.print()"><i class="fa-solid fa-print"></i> พิมพ์ใบเสร็จรับเงิน</button>
  `;

  openModal(`ใบเสร็จรับเงิน: ${sale.receiptNumber}`, bodyHtml, footerHtml);
}

/* ==========================================================================
   VIEW 1.8: SYSTEM MASTER SETTINGS VIEW
   ========================================================================== */
async function renderMasterSettingsView() {
  const container = document.getElementById('content-container');
  container.innerHTML = `<div style="padding: 2rem; text-align: center; color: var(--text-muted);"><i class="fa-solid fa-spinner fa-spin" style="font-size:2rem;"></i> กำลังโหลดตัวเลือก Master Data...</div>`;

  try {
    await loadMasterOptions();
    const { brands = [], models = [], capacities = [], colors = [], variations = [], categories = [] } = state.masterOptions;

    container.innerHTML = `
      <div class="card" style="margin-bottom:1.5rem;">
        <h3 style="font-size:1.15rem; font-weight:700; margin-bottom:0.5rem; display:flex; align-items:center; gap:0.5rem;">
          <i class="fa-solid fa-plus-circle" style="color:var(--accent-primary);"></i> เพิ่มตัวเลือก Master Data ใหม่
        </h3>
        <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:1.2rem;">
          เมื่อเพิ่มแล้ว ตัวเลือกจะประกอบเป็น <strong>ชื่อสินค้าแบบเต็ม</strong> และ <strong>รหัส SKU อัตโนมัติ</strong> ให้ทันที
        </p>

        <form id="add-master-form" style="display:grid; grid-template-columns: 1.2fr 2fr 1fr auto; gap:1rem; align-items:end;">
          <div class="form-group" style="margin-bottom:0;">
            <label for="mo-type">เลือกประเภทตัวเลือก</label>
            <select id="mo-type" class="form-select" onchange="toggleMasterParentField(this.value)" required>
              <option value="brand">ยี่ห้อ (Brand)</option>
              <option value="model">ชื่อรุ่น (Model)</option>
              <option value="capacity">ความจุ (Capacity)</option>
              <option value="color">สีสินค้า (Color)</option>
              <option value="category">หมวดหมู่สินค้า (Category)</option>
            </select>
          </div>

          <div class="form-group" style="margin-bottom:0;">
            <label for="mo-value">ข้อความตัวเลือก (เช่น 256GB, ไทเทเนียมธรรมชาติ)</label>
            <input type="text" id="mo-value" class="form-control" placeholder="พิมพ์ข้อความตัวเลือก..." required>
          </div>

          <div class="form-group" id="mo-parent-container" style="margin-bottom:0; display:none;">
            <label for="mo-parent">ยี่ห้อสังกัด (Parent Brand)</label>
            <select id="mo-parent" class="form-select">
              <option value="">-- ไม่ระบุ --</option>
              ${brands.map(b => `<option value="${b.value}">${b.value}</option>`).join('')}
            </select>
          </div>

          <button type="submit" class="btn btn-primary" style="height:42px;">
            <i class="fa-solid fa-plus"></i> เพิ่มตัวเลือก Master
          </button>
        </form>
      </div>

      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap:1.2rem;">
        <!-- 1. BRANDS -->
        <div class="card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.8rem; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:0.4rem;">
            <h4 style="font-weight:700; font-size:0.95rem; color:#38bdf8;">
              <i class="fa-solid fa-copyright"></i> ยี่ห้อ (Brand)
            </h4>
            <span class="badge badge-gray">${brands.length} รายการ</span>
          </div>

          <div style="display:flex; flex-direction:column; gap:0.4rem; max-height:260px; overflow-y:auto; padding-right:0.2rem;">
            ${brands.length === 0 ? `<div style="color:var(--text-muted); font-size:0.85rem;">ยังไม่มีรายการ</div>` : ''}
            ${brands.map(b => `
              <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.2); padding:0.4rem 0.7rem; border-radius:6px; font-size:0.85rem;">
                <span><strong>${b.value}</strong></span>
                <button class="btn btn-danger btn-sm" style="padding:0.15rem 0.4rem;" onclick="deleteMasterOptionItem('${b._id}', '${b.value}')">
                  <i class="fa-solid fa-trash-can"></i>
                </button>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- 2. MODELS -->
        <div class="card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.8rem; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:0.4rem;">
            <h4 style="font-weight:700; font-size:0.95rem; color:#fbbf24;">
              <i class="fa-solid fa-mobile-screen-button"></i> ชื่อรุ่น (Model)
            </h4>
            <span class="badge badge-gray">${models.length} รายการ</span>
          </div>

          <div style="display:flex; flex-direction:column; gap:0.4rem; max-height:260px; overflow-y:auto; padding-right:0.2rem;">
            ${models.length === 0 ? `<div style="color:var(--text-muted); font-size:0.85rem;">ยังไม่มีรายการ</div>` : ''}
            ${models.map(m => `
              <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.2); padding:0.4rem 0.7rem; border-radius:6px; font-size:0.85rem;">
                <div>
                  <strong>${m.value}</strong>
                  ${m.parent ? `<br><span style="font-size:0.75rem; color:var(--text-muted);">${m.parent}</span>` : ''}
                </div>
                <button class="btn btn-danger btn-sm" style="padding:0.15rem 0.4rem;" onclick="deleteMasterOptionItem('${m._id}', '${m.value}')">
                  <i class="fa-solid fa-trash-can"></i>
                </button>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- 3. CAPACITIES -->
        <div class="card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.8rem; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:0.4rem;">
            <h4 style="font-weight:700; font-size:0.95rem; color:#a7f3d0;">
              <i class="fa-solid fa-hard-drive"></i> ความจุ (Capacity)
            </h4>
            <span class="badge badge-gray">${capacities.length} รายการ</span>
          </div>

          <div style="display:flex; flex-direction:column; gap:0.4rem; max-height:260px; overflow-y:auto; padding-right:0.2rem;">
            ${capacities.length === 0 ? `<div style="color:var(--text-muted); font-size:0.85rem;">ยังไม่มีรายการความจุ</div>` : ''}
            ${capacities.map(cp => `
              <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.2); padding:0.4rem 0.7rem; border-radius:6px; font-size:0.85rem;">
                <span><strong>${cp.value}</strong></span>
                <button class="btn btn-danger btn-sm" style="padding:0.15rem 0.4rem;" onclick="deleteMasterOptionItem('${cp._id}', '${cp.value}')">
                  <i class="fa-solid fa-trash-can"></i>
                </button>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- 4. COLORS -->
        <div class="card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.8rem; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:0.4rem;">
            <h4 style="font-weight:700; font-size:0.95rem; color:#c084fc;">
              <i class="fa-solid fa-droplet"></i> สีสินค้า (Color)
            </h4>
            <span class="badge badge-gray">${colors.length} รายการ</span>
          </div>

          <div style="display:flex; flex-direction:column; gap:0.4rem; max-height:260px; overflow-y:auto; padding-right:0.2rem;">
            ${colors.length === 0 ? `<div style="color:var(--text-muted); font-size:0.85rem;">ยังไม่มีรายการสี</div>` : ''}
            ${colors.map(cl => `
              <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.2); padding:0.4rem 0.7rem; border-radius:6px; font-size:0.85rem;">
                <span><strong>${cl.value}</strong></span>
                <button class="btn btn-danger btn-sm" style="padding:0.15rem 0.4rem;" onclick="deleteMasterOptionItem('${cl._id}', '${cl.value}')">
                  <i class="fa-solid fa-trash-can"></i>
                </button>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- 5. CATEGORIES -->
        <div class="card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.8rem; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:0.4rem;">
            <h4 style="font-weight:700; font-size:0.95rem; color:#f472b6;">
              <i class="fa-solid fa-tags"></i> หมวดหมู่สินค้า (Category)
            </h4>
            <span class="badge badge-gray">${categories.length} รายการ</span>
          </div>

          <div style="display:flex; flex-direction:column; gap:0.4rem; max-height:260px; overflow-y:auto; padding-right:0.2rem;">
            ${categories.length === 0 ? `<div style="color:var(--text-muted); font-size:0.85rem;">ยังไม่มีรายการหมวดหมู่</div>` : ''}
            ${categories.map(c => `
              <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.2); padding:0.4rem 0.7rem; border-radius:6px; font-size:0.85rem;">
                <span><strong>${c.value}</strong></span>
                <button class="btn btn-danger btn-sm" style="padding:0.15rem 0.4rem;" onclick="deleteMasterOptionItem('${c._id}', '${c.value}')">
                  <i class="fa-solid fa-trash-can"></i>
                </button>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    document.getElementById('add-master-form').addEventListener('submit', submitAddMasterOption);
  } catch (err) {
    container.innerHTML = `<div style="color:#ef4444; padding:2rem;">เกิดข้อผิดพลาดในการโหลดตั้งค่า Master: ${err.message}</div>`;
  }
}

function toggleMasterParentField(typeVal) {
  const parentContainer = document.getElementById('mo-parent-container');
  if (parentContainer) {
    if (typeVal === 'model') {
      parentContainer.style.display = 'block';
    } else {
      parentContainer.style.display = 'none';
    }
  }
}

async function submitAddMasterOption(e) {
  e.preventDefault();
  const type = document.getElementById('mo-type').value;
  const value = document.getElementById('mo-value').value.trim();
  const parent = document.getElementById('mo-parent') ? document.getElementById('mo-parent').value : null;

  try {
    const res = await apiRequest('/master/options', 'POST', { type, value, parent });
    if (res.success) {
      showToast(res.message);
      await loadMasterOptions();
      renderMasterSettingsView();
    }
  } catch (err) {
    // Handled
  }
}

async function deleteMasterOptionItem(id, valueName) {
  if (!confirm(`คุณต้องการลบตัวเลือก Master "${valueName}" ออกจากระบบถาวรใช่หรือไม่?`)) return;

  try {
    const res = await apiRequest(`/master/options/${id}`, 'DELETE');
    if (res.success) {
      showToast(res.message);
      await loadMasterOptions();
      renderMasterSettingsView();
    }
  } catch (err) {
    // Handled
  }
}

/* ==========================================================================
   VIEW 2: HQ AUDIT DASHBOARD
   ========================================================================== */
async function renderHqAuditView() {
  const container = document.getElementById('content-container');
  const todayStr = new Date().toISOString().split('T')[0];

  container.innerHTML = `
    <div class="card" style="margin-bottom: 1.5rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem;">
      <div>
        <h3 style="font-size:1.1rem; font-weight:700;">แดชบอร์ดตรวจสอบสต็อก 5 สาขา (ส่วนกลาง)</h3>
        <p style="font-size:0.85rem; color:var(--text-muted);">ตรวจสอบรายการนับสต็อกประจำวันจากพนักงานหน้าร้าน พร้อมการแจ้งเตือนด้วยแถบสี</p>
      </div>
      <div style="display:flex; align-items:center; gap:0.8rem;">
        <label style="font-size:0.85rem; font-weight:600; color:var(--text-muted);">เลือกวันที่:</label>
        <input type="date" id="hq-audit-date-picker" class="form-control" style="width:auto;" value="${todayStr}">
        <button class="btn btn-primary btn-sm" id="load-hq-audit-btn"><i class="fa-solid fa-rotate"></i> รีเฟรช</button>
      </div>
    </div>

    <div id="hq-audit-grid-container" class="audit-grid">
      <div style="padding: 2rem; text-align: center; color: var(--text-muted); grid-column: 1/-1;"><i class="fa-solid fa-spinner fa-spin" style="font-size:2rem;"></i> กำลังโหลดข้อมูลสต็อก 5 สาขา...</div>
    </div>
  `;

  document.getElementById('load-hq-audit-btn').addEventListener('click', () => {
    const selectedDate = document.getElementById('hq-audit-date-picker').value;
    loadHqAuditGrid(selectedDate);
  });

  loadHqAuditGrid(todayStr);
}

async function loadHqAuditGrid(dateStr) {
  const gridContainer = document.getElementById('hq-audit-grid-container');
  try {
    const res = await apiRequest(`/audit/dashboard?date=${dateStr}`);
    if (!res.success) return;

    const branches = res.summary.branches;

    gridContainer.innerHTML = branches.map(b => `
      <div class="audit-card status-${b.colorCode}">
        <div class="audit-header">
          <div>
            <div class="branch-name">${b.branch.name}</div>
            <div class="branch-code">รหัสสาขา: ${b.branch.code}</div>
          </div>
          <span class="badge badge-${b.colorCode}">
            <i class="fa-solid ${b.colorCode === 'green' ? 'fa-circle-check' : b.colorCode === 'red' ? 'fa-circle-exclamation' : b.colorCode === 'yellow' ? 'fa-clock' : 'fa-minus'}"></i>
            ${b.status}
          </span>
        </div>

        <div class="audit-stats">
          <div class="stat-item">
            <div class="stat-val">${b.totalExpected}</div>
            <div class="stat-lbl">คาดการณ์</div>
          </div>
          <div class="stat-item">
            <div class="stat-val">${b.totalActual}</div>
            <div class="stat-lbl">นับได้จริง</div>
          </div>
          <div class="stat-item">
            <div class="stat-val" style="color: ${b.totalVariance === 0 ? '#34d399' : '#f87171'};">${b.totalVariance}</div>
            <div class="stat-lbl">ยอดที่ขาด/เกิน</div>
          </div>
        </div>

        <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom: 0.8rem;">
          <div>ผู้ส่งรายงาน: <strong>${b.submittedBy || 'ยังไม่ได้ส่งรายงาน'}</strong></div>
          ${b.hqVerifiedBy ? `<div>ผู้อนุมัติ (ส่วนกลาง): <strong>${b.hqVerifiedBy}</strong></div>` : ''}
          ${b.hqComments ? `<div style="color:#fbbf24; margin-top:0.3rem;"><em>หมายเหตุ HQ: "${b.hqComments}"</em></div>` : ''}
        </div>

        <div style="display:flex; gap:0.5rem;">
          ${b.auditId ? `
            <button class="btn btn-secondary btn-sm" style="flex:1;" onclick="inspectBranchAudit('${b.auditId}')">
              <i class="fa-solid fa-magnifying-glass"></i> ตรวจสอบรายละเอียด
            </button>
          ` : `
            <span style="font-size:0.8rem; color:var(--text-muted); font-style:italic;">รอพนักงานหน้าร้านส่งผลการนับ</span>
          `}
        </div>
      </div>
    `).join('');
  } catch (err) {
    gridContainer.innerHTML = `<div style="color:#ef4444; grid-column: 1/-1;">เกิดข้อผิดพลาดในการโหลดแดชบอร์ดส่วนกลาง: ${err.message}</div>`;
  }
}

async function inspectBranchAudit(auditId) {
  openModal('กำลังโหลดรายละเอียดการนับสต็อก...', '<div style="padding:2rem; text-align:center;"><i class="fa-solid fa-spinner fa-spin fa-2x"></i></div>');

  try {
    const todayStr = document.getElementById('hq-audit-date-picker') ? document.getElementById('hq-audit-date-picker').value : new Date().toISOString().split('T')[0];
    const res = await apiRequest(`/audit/dashboard?date=${todayStr}`);
    const branchItem = res.summary.branches.find(b => b.auditId === auditId);

    if (!branchItem) {
      openModal('เกิดข้อผิดพลาด', '<p style="color:#ef4444;">ไม่พบข้อมูลการนับสต็อก</p>');
      return;
    }

    const items = branchItem.items;

    const bodyHtml = `
      <div style="margin-bottom: 1rem;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
          <h4 style="font-size:1.15rem; font-weight:700;">${branchItem.branch.name} (${branchItem.branch.code})</h4>
          <span class="badge badge-${branchItem.colorCode}">${branchItem.status}</span>
        </div>
        <p style="font-size:0.85rem; color:var(--text-muted);">
          ผู้ส่งรายงาน: <strong>${branchItem.submittedBy || 'ไม่ระบุ'}</strong> | วันที่ตรวจนับ: <strong>${branchItem.auditDate}</strong>
        </p>
      </div>

      <div class="table-container" style="margin-bottom:1.2rem;">
        <table class="data-table">
          <thead>
            <tr>
              <th>รหัส SKU / ชื่อสินค้า</th>
              <th>จำนวนคาดการณ์</th>
              <th>จำนวนนับจริง</th>
              <th>ยอดที่ขาด/เกิน</th>
              <th>รายละเอียดส่วนต่าง IMEI/ซีเรียล</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(item => `
              <tr>
                <td>
                  <strong>${item.sku}</strong><br>
                  <span style="font-size:0.8rem; color:var(--text-muted);">${item.productName}</span>
                </td>
                <td><strong>${item.expectedCount}</strong></td>
                <td><strong>${item.actualCount}</strong></td>
                <td style="color: ${item.variance === 0 ? '#34d399' : '#f87171'}; font-weight:700;">
                  ${item.variance > 0 ? '+' + item.variance : item.variance}
                </td>
                <td style="font-size:0.8rem;">
                  ${item.missingImeis && item.missingImeis.length > 0 ? `<div style="color:#f87171;">IMEI ที่สูญหาย/ขาด: ${item.missingImeis.join(', ')}</div>` : ''}
                  ${item.unexpectedImeis && item.unexpectedImeis.length > 0 ? `<div style="color:#fbbf24;">IMEI แปลกปลอม/เกิน: ${item.unexpectedImeis.join(', ')}</div>` : ''}
                  ${(!item.missingImeis || item.missingImeis.length === 0) && (!item.unexpectedImeis || item.unexpectedImeis.length === 0) ? `<span style="color:#34d399;"><i class="fa-solid fa-check"></i> จำนวนตรงถูกต้อง</span>` : ''}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div class="form-group">
        <label for="hq-audit-comments">ข้อคิดเห็น / เหตุผลการอนุมัติหรือปฏิเสธ (HQ Auditor):</label>
        <textarea id="hq-audit-comments" class="form-control" rows="3" placeholder="ระบุเหตุผลหรือข้อสังเกตเพิ่มเติม...">${branchItem.hqComments || ''}</textarea>
      </div>
    `;

    const isHqOrAdmin = ['admin', 'hq_stock_staff'].includes(state.user.role);

    const footerHtml = `
      <button class="btn btn-secondary" onclick="closeModal()">ปิดหน้าต่าง</button>
      ${isHqOrAdmin ? `
        <button class="btn btn-danger" onclick="submitHqAuditAction('${auditId}', 'Reject')"><i class="fa-solid fa-xmark"></i> ปฏิเสธการตรวจสอบ (ข้อมูลไม่ตรง)</button>
        <button class="btn btn-success" onclick="submitHqAuditAction('${auditId}', 'Verify')"><i class="fa-solid fa-check"></i> อนุมัติการตรวจสอบถูกต้อง</button>
      ` : ''}
    `;

    openModal(`ตรวจสอบการนับสต็อก - ${branchItem.branch.name}`, bodyHtml, footerHtml);
  } catch (err) {
    openModal('เกิดข้อผิดพลาด', `<p style="color:#ef4444;">${err.message}</p>`);
  }
}

async function submitHqAuditAction(auditId, action) {
  const comments = document.getElementById('hq-audit-comments').value;
  try {
    const res = await apiRequest(`/audit/verify/${auditId}`, 'POST', { action, comments });
    if (res.success) {
      showToast(action === 'Verify' ? 'อนุมัติการตรวจสอบสต็อกเรียบร้อยแล้ว' : 'ปฏิเสธการตรวจสอบสต็อกเรียบร้อยแล้ว');
      closeModal();
      renderHqAuditView();
    }
  } catch (err) {
    // Handled
  }
}

/* ==========================================================================
   VIEW 3: BRANCH DAILY STOCK CHECK
   ========================================================================== */
async function renderBranchAuditView() {
  const container = document.getElementById('content-container');
  container.innerHTML = `<div style="padding: 2rem; text-align: center; color: var(--text-muted);"><i class="fa-solid fa-spinner fa-spin" style="font-size:2rem;"></i> กำลังดึงรายการสินค้าคงคลังสาขา...</div>`;

  const userBranchId = state.user.branch ? state.user.branch._id : (state.masterOptions.branches && state.masterOptions.branches[0] ? state.masterOptions.branches[0]._id : null);
  
  try {
    const res = await apiRequest(`/audit/expected?branchId=${userBranchId}`);
    state.expectedStockCache = res.items || [];

    const todayStr = new Date().toISOString().split('T')[0];

    container.innerHTML = `
      <div class="card" style="margin-bottom: 1.5rem;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem;">
          <div>
            <h3 style="font-size:1.1rem; font-weight:700;">แบบฟอร์ม นับสต็อกประจำวัน (Branch Daily Stock Check)</h3>
            <p style="font-size:0.85rem; color:var(--text-muted);">สแกนบาร์โค้ด IMEI หรือระบุจำนวนนับจริง ระบบจะคำนวณ ยอดที่ขาด/เกิน ให้อัตโนมัติ</p>
          </div>
          <div style="display:flex; align-items:center; gap:0.8rem;">
            <label style="font-size:0.85rem; font-weight:600; color:var(--text-muted);">วันที่ตรวจนับ:</label>
            <input type="date" id="branch-audit-date" class="form-control" style="width:auto;" value="${todayStr}">
          </div>
        </div>

        <div style="margin-top: 1.2rem; background: rgba(99,102,241,0.1); border:1px solid rgba(99,102,241,0.2); padding:1rem; border-radius:var(--radius-md); display:flex; gap:1rem; align-items:center; flex-wrap:wrap;">
          <div style="flex:1; min-width:260px;">
            <label style="font-size:0.78rem; font-weight:700; color:var(--accent-secondary);">ช่องสแกนบาร์โค้ดรวดเร็ว (สแกน IMEI/ซีเรียลที่นี่)</label>
            <input type="text" id="barcode-scanner-input" class="form-control" placeholder="สแกน หรือ พิมพ์หมายเลข IMEI/ซีเรียล แล้วกด Enter..." style="margin-top:0.3rem;">
          </div>
          <div style="font-size:0.85rem; color:var(--text-muted);">
            <i class="fa-solid fa-circle-info" style="color:var(--accent-primary);"></i> ซีเรียลที่สแกนจะถูกแมตช์เข้า SKU และเพิ่มจำนวนนับจริงให้อัตโนมัติ
          </div>
        </div>
      </div>

      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>รหัส SKU / ชื่อสินค้า</th>
              <th>จำนวนคาดการณ์</th>
              <th>จำนวนนับได้จริง</th>
              <th>ยอดที่ขาด/เกิน</th>
              <th>รายการหมายเลขซีเรียล/IMEI ที่นับได้</th>
            </tr>
          </thead>
          <tbody id="branch-audit-table-body">
            ${state.expectedStockCache.length === 0 ? `<tr><td colspan="5" style="text-align:center; color:var(--text-muted);">ไม่พบรายการสินค้าในสต็อกสาขานี้</td></tr>` : ''}
            ${state.expectedStockCache.map((item, idx) => `
              <tr id="audit-row-${idx}">
                <td>
                  <strong>${item.sku}</strong><br>
                  <span style="font-size:0.8rem; color:var(--text-muted);">${item.productName}</span>
                </td>
                <td><strong class="expected-val" id="expected-${idx}">${item.expectedCount}</strong></td>
                <td style="width: 140px;">
                  <input type="number" min="0" class="form-control actual-input" id="actual-input-${idx}" value="${item.expectedCount}" onchange="updateRowVariance(${idx})">
                </td>
                <td id="variance-status-${idx}">
                  <span class="badge badge-green">ยอดตรงพอดี (0)</span>
                </td>
                <td>
                  <input type="text" class="form-control serials-input" id="serials-input-${idx}" placeholder="ใส่ IMEI แยกด้วยเครื่องหมายจุลภาค (,)" value="${(item.expectedImeis || []).join(', ')}" onchange="updateRowVariance(${idx})">
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div style="margin-top: 1.5rem; display:flex; justify-content:flex-end;">
        <button class="btn btn-success" id="submit-branch-audit-btn" style="padding:0.8rem 2rem;">
          <i class="fa-solid fa-paper-plane"></i> ยืนยันและส่งรายงานการนับสต็อกให้ส่วนกลาง
        </button>
      </div>
    `;

    const scannerInput = document.getElementById('barcode-scanner-input');
    if (scannerInput) {
      scannerInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const scannedVal = scannerInput.value.trim();
          if (scannedVal) {
            processScannedSerial(scannedVal);
            scannerInput.value = '';
          }
        }
      });
    }

    document.getElementById('submit-branch-audit-btn').addEventListener('click', submitBranchAuditForm);
  } catch (err) {
    container.innerHTML = `<div style="color:#ef4444; padding:2rem;">เกิดข้อผิดพลาดในการโหลดรายการสต็อก: ${err.message}</div>`;
  }
}

function updateRowVariance(idx) {
  const expected = parseInt(document.getElementById(`expected-${idx}`).innerText) || 0;
  const actualInput = document.getElementById(`actual-input-${idx}`);
  const actual = parseInt(actualInput.value) || 0;
  const statusTd = document.getElementById(`variance-status-${idx}`);

  const diff = actual - expected;

  if (diff === 0) {
    statusTd.innerHTML = `<span class="badge badge-green">ยอดตรงพอดี (0)</span>`;
  } else {
    statusTd.innerHTML = `<span class="badge badge-red">${diff > 0 ? 'เกิน +' + diff : 'ขาด ' + diff} ชิ้น</span>`;
  }
}

function processScannedSerial(serial) {
  let matchedIdx = -1;

  state.expectedStockCache.forEach((item, idx) => {
    if (item.expectedImeis && item.expectedImeis.includes(serial)) {
      matchedIdx = idx;
    }
  });

  if (matchedIdx !== -1) {
    const serialsInput = document.getElementById(`serials-input-${matchedIdx}`);
    let currentSerials = serialsInput.value.split(',').map(s => s.trim()).filter(s => s);
    if (!currentSerials.includes(serial)) {
      currentSerials.push(serial);
      serialsInput.value = currentSerials.join(', ');
      
      const actualInput = document.getElementById(`actual-input-${matchedIdx}`);
      actualInput.value = currentSerials.length;
      updateRowVariance(matchedIdx);
      showToast(`สแกนสำเร็จ: IMEI ${serial} แมตช์กับรหัส ${state.expectedStockCache[matchedIdx].sku}`);
    } else {
      showToast(`หมายเลข IMEI ${serial} ถูกสแกนไปแล้วในแถวนี้`, 'error');
    }
  } else {
    showToast(`ไม่พบหมายเลข IMEI ${serial} ในรายการคาดการณ์ กรุณาตรวจสอบหรือพิมพ์ระบุเอง`, 'error');
  }
}

async function submitBranchAuditForm() {
  const auditDate = document.getElementById('branch-audit-date').value;
  const userBranchId = state.user.branch ? state.user.branch._id : (state.masterOptions.branches && state.masterOptions.branches[0] ? state.masterOptions.branches[0]._id : null);

  const scannedItems = state.expectedStockCache.map((item, idx) => {
    const actualCount = parseInt(document.getElementById(`actual-input-${idx}`).value) || 0;
    const serialsRaw = document.getElementById(`serials-input-${idx}`).value;
    const scannedImeis = serialsRaw.split(',').map(s => s.trim()).filter(s => s);

    return {
      sku: item.sku,
      actualCount,
      scannedImeis
    };
  });

  try {
    const res = await apiRequest('/audit/submit', 'POST', {
      auditDate,
      branchId: userBranchId,
      scannedItems
    });

    if (res.success) {
      showToast('ส่งรายงานการนับสต็อกประจำวันสำเร็จ! สถานะเปลี่ยนเป็น: รอการตรวจสอบจากส่วนกลาง');
      navigateTo('hq-audit');
    }
  } catch (err) {
    // Handled
  }
}

/* ==========================================================================
   VIEW 4: GOODS RECEIPT
   ========================================================================== */
async function renderGoodsReceiptView() {
  const container = document.getElementById('content-container');
  container.innerHTML = `<div style="padding: 2rem; text-align: center; color: var(--text-muted);"><i class="fa-solid fa-spinner fa-spin" style="font-size:2rem;"></i> กำลังโหลดรายการสินค้า...</div>`;

  try {
    const productsRes = await apiRequest('/products');
    const products = productsRes.products || [];

    const branches = state.masterOptions.branches || [];

    container.innerHTML = `
      <div class="card" style="max-width: 750px; margin: 0 auto;">
        <h3 style="font-size:1.2rem; font-weight:700; margin-bottom: 0.5rem; display:flex; align-items:center; gap:0.5rem;">
          <i class="fa-solid fa-truck-ramp-box" style="color:var(--accent-primary);"></i> แบบฟอร์ม รับสินค้าเข้าสต็อก (Goods Receipt)
        </h3>
        <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom: 1.5rem;">
          ระบุสาขา เลือกสินค้า Master SKU และใส่หมายเลข IMEI ในช่องแยกตามจำนวนสินค้าที่รับเข้า
        </p>

        <form id="goods-receipt-form">
          <div class="form-group">
            <label for="gr-branch">สาขาที่รับสินค้าเข้าสต็อก</label>
            <select id="gr-branch" class="form-select" required>
              ${branches.map(b => `<option value="${b._id}">${b.name} (${b.code})</option>`).join('')}
            </select>
          </div>

          <div class="form-group">
            <label for="gr-product">เลือกสินค้า (จาก Master SKU ที่กำหนด)</label>
            <select id="gr-product" class="form-select" required>
              <option value="">-- เลือกรายการสินค้า Master --</option>
              ${products.map(p => `<option value="${p._id}">${p.sku} - ${p.name} [${p.brand} ${p.model}]</option>`).join('')}
            </select>
          </div>

          <div class="form-group">
            <label for="gr-quantity">จำนวนสินค้าที่รับเข้า (ชิ้น)</label>
            <input type="number" id="gr-quantity" class="form-control" min="1" max="100" value="1" oninput="generateImeiInputs()" onchange="generateImeiInputs()" required>
          </div>

          <div class="form-group">
            <label style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">
              <span>หมายเลขซีเรียล / IMEI (สร้างช่องป้อนแยกตามจำนวนสินค้าที่รับเข้า)</span>
              <span id="gr-imei-count-badge" class="badge badge-gold">1 เครื่อง</span>
            </label>

            <div id="gr-imei-inputs-container" style="display:flex; flex-direction:column; gap:0.6rem; margin-top:0.6rem; max-height:320px; overflow-y:auto; padding-right:0.3rem;">
              <!-- Dynamic individual IMEI TextBoxes -->
            </div>
          </div>

          <div style="margin-top: 1.5rem; display:flex; justify-content:flex-end; gap:0.8rem;">
            <button type="button" class="btn btn-secondary" onclick="navigateTo('dashboard')">ยกเลิก</button>
            <button type="submit" class="btn btn-primary"><i class="fa-solid fa-circle-check"></i> ยืนยันบันทึกรับสินค้าเข้าสต็อก</button>
          </div>
        </form>
      </div>
    `;

    generateImeiInputs();

    document.getElementById('goods-receipt-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const branchId = document.getElementById('gr-branch').value;
      const productId = document.getElementById('gr-product').value;
      const quantity = parseInt(document.getElementById('gr-quantity').value);

      const imeiInputs = document.querySelectorAll('.gr-imei-input');
      const imeiSerials = Array.from(imeiInputs).map(input => input.value.trim()).filter(v => v);

      if (imeiSerials.length === 0) {
        showToast('กรุณาระบุหมายเลข IMEI/ซีเรียลอย่างน้อย 1 เครื่อง', 'error');
        return;
      }

      try {
        const res = await apiRequest('/stock/receive', 'POST', {
          branchId,
          productId,
          quantity,
          imeiSerials
        });

        if (res.success) {
          showToast(res.message);
          navigateTo('dashboard');
        }
      } catch (err) {
        // Handled
      }
    });
  } catch (err) {
    container.innerHTML = `<div style="color:#ef4444;">${err.message}</div>`;
  }
}

function generateImeiInputs() {
  const qtyInput = document.getElementById('gr-quantity');
  const container = document.getElementById('gr-imei-inputs-container');
  const badge = document.getElementById('gr-imei-count-badge');

  if (!qtyInput || !container) return;

  let qty = parseInt(qtyInput.value) || 1;
  if (qty < 1) qty = 1;
  if (qty > 100) qty = 100;

  if (badge) badge.innerText = `${qty} เครื่อง`;

  const existingValues = Array.from(document.querySelectorAll('.gr-imei-input')).map(inp => inp.value);

  let html = '';
  for (let i = 0; i < qty; i++) {
    const val = existingValues[i] || '';
    html += `
      <div style="display:flex; align-items:center; gap:0.6rem;">
        <span style="font-size:0.85rem; font-weight:700; color:var(--text-muted); width:80px; flex-shrink:0;">เครื่องที่ ${i + 1}:</span>
        <input type="text" class="form-control gr-imei-input" placeholder="สแกนบาร์โค้ด หรือ พิมพ์หมายเลข IMEI เครื่องที่ ${i + 1}" value="${val}" required onkeydown="handleImeiInputKeydown(event, ${i})">
      </div>
    `;
  }

  container.innerHTML = html;
}

function handleImeiInputKeydown(event, currentIndex) {
  if (event.key === 'Enter') {
    event.preventDefault();
    const inputs = document.querySelectorAll('.gr-imei-input');
    if (inputs[currentIndex + 1]) {
      inputs[currentIndex + 1].focus();
    }
  }
}

/* ==========================================================================
   VIEW 5: INTER-BRANCH TRANSFERS
   ========================================================================== */
async function renderTransfersView() {
  const container = document.getElementById('content-container');
  container.innerHTML = `<div style="padding: 2rem; text-align: center; color: var(--text-muted);"><i class="fa-solid fa-spinner fa-spin" style="font-size:2rem;"></i> กำลังโหลดรายการโอนย้ายสินค้า...</div>`;

  try {
    const res = await apiRequest('/stock/transfers');
    const transfers = res.transfers || [];

    container.innerHTML = `
      <div class="card" style="margin-bottom:1.5rem; display:flex; justify-content:space-between; align-items:center;">
        <div>
          <h3 style="font-size:1.1rem; font-weight:700;">จัดการโอนย้ายสินค้าระหว่างสาขา</h3>
          <p style="font-size:0.85rem; color:var(--text-muted);">ส่งคำขอโอนย้ายสินค้า และพิมพ์เอกสาร "ใบโอนย้ายสินค้าระหว่างสาขา"</p>
        </div>
        <button class="btn btn-primary btn-sm" id="create-transfer-btn"><i class="fa-solid fa-plus"></i> สร้างคำขอโอนย้ายใหม่</button>
      </div>

      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>เลขที่ใบโอนย้าย</th>
              <th>สาขาต้นทาง</th>
              <th>สาขาปลายทาง</th>
              <th>จำนวนสินค้ารวม</th>
              <th>สถานะ</th>
              <th>วันที่สร้าง</th>
              <th>การจัดการ</th>
            </tr>
          </thead>
          <tbody>
            ${transfers.length === 0 ? `<tr><td colspan="7" style="text-align:center; color:var(--text-muted);">ไม่พบรายการโอนย้ายสินค้า</td></tr>` : ''}
            ${transfers.map(t => `
              <tr>
                <td><strong>${t.transferNumber}</strong></td>
                <td>${t.fromBranch ? t.fromBranch.name : 'ไม่ระบุ'}</td>
                <td>${t.toBranch ? t.toBranch.name : 'ไม่ระบุ'}</td>
                <td>${t.items ? t.items.reduce((acc, i) => acc + i.quantity, 0) : 0} ชิ้น</td>
                <td>
                  <span class="badge badge-${t.status === 'completed' ? 'green' : t.status === 'rejected' ? 'red' : 'yellow'}">
                    ${t.status === 'completed' ? 'โอนย้ายสำเร็จ' : t.status === 'rejected' ? 'ยกเลิก/ปฏิเสธ' : 'รออนุมัติโอนย้าย'}
                  </span>
                </td>
                <td>${new Date(t.createdAt).toLocaleDateString('th-TH')}</td>
                <td>
                  <button class="btn btn-secondary btn-sm" onclick="printTransferDoc('${t._id}')">
                    <i class="fa-solid fa-print"></i> พิมพ์เอกสาร
                  </button>
                  ${t.status === 'pending' && ['admin', 'hq_stock_staff'].includes(state.user.role) ? `
                    <button class="btn btn-success btn-sm" onclick="updateTransferState('${t._id}', 'completed')"><i class="fa-solid fa-check"></i> ยืนยันโอนสำเร็จ</button>
                  ` : ''}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    document.getElementById('create-transfer-btn').addEventListener('click', openCreateTransferModal);
  } catch (err) {
    container.innerHTML = `<div style="color:#ef4444;">${err.message}</div>`;
  }
}

async function openCreateTransferModal() {
  const branches = state.masterOptions.branches || [];

  const bodyHtml = `
    <form id="new-transfer-form">
      <div class="form-group">
        <label for="tr-from">สาขาต้นทาง (ผู้ส่ง)</label>
        <select id="tr-from" class="form-select" required>
          ${branches.map(b => `<option value="${b._id}">${b.name} (${b.code})</option>`).join('')}
        </select>
      </div>

      <div class="form-group">
        <label for="tr-to">สาขาปลายทาง (ผู้รับ)</label>
        <select id="tr-to" class="form-select" required>
          ${branches.map((b, i) => `<option value="${b._id}" ${i === 1 ? 'selected' : ''}>${b.name} (${b.code})</option>`).join('')}
        </select>
      </div>

      <div class="form-group">
        <label for="tr-sku">รหัสสินค้า SKU</label>
        <input type="text" id="tr-sku" class="form-control" placeholder="เช่น APL-IP15P-256NT" required>
      </div>

      <div class="form-group">
        <label for="tr-qty">จำนวนโอนย้าย (ชิ้น)</label>
        <input type="number" id="tr-qty" class="form-control" min="1" value="1" required>
      </div>

      <div class="form-group">
        <label for="tr-remarks">หมายเหตุ / เหตุผลการโอนย้าย</label>
        <textarea id="tr-remarks" class="form-control" rows="2" placeholder="เช่น โอนย้ายเพื่อกระจายสต็อกสินค้าโปรโมชัน"></textarea>
      </div>
    </form>
  `;

  const footerHtml = `
    <button class="btn btn-secondary" onclick="closeModal()">ยกเลิก</button>
    <button class="btn btn-primary" onclick="submitTransferRequest()"><i class="fa-solid fa-paper-plane"></i> ยืนยันสร้างเอกสารโอนย้าย</button>
  `;

  openModal('สร้างเอกสารโอนย้ายสินค้าระหว่างสาขาใหม่', bodyHtml, footerHtml);
}

async function submitTransferRequest() {
  const fromBranchId = document.getElementById('tr-from').value;
  const toBranchId = document.getElementById('tr-to').value;
  const sku = document.getElementById('tr-sku').value.trim();
  const quantity = parseInt(document.getElementById('tr-qty').value);
  const remarks = document.getElementById('tr-remarks').value;

  try {
    const res = await apiRequest('/stock/transfers', 'POST', {
      fromBranchId,
      toBranchId,
      items: [{ sku, quantity }],
      remarks
    });

    if (res.success) {
      showToast(`สร้างเอกสารใบโอนย้ายเลขที่ ${res.transfer.transferNumber} สำเร็จ`);
      closeModal();
      renderTransfersView();
    }
  } catch (err) {
    // Handled
  }
}

async function updateTransferState(id, status) {
  try {
    const res = await apiRequest(`/stock/transfers/${id}/status`, 'PUT', { status });
    if (res.success) {
      showToast('อัปเดตสถานะการโอนย้ายสินค้าเรียบร้อยแล้ว');
      renderTransfersView();
    }
  } catch (err) {
    // Handled
  }
}

async function printTransferDoc(transferId) {
  openModal('กำลังโหลดเอกสารใบโอนย้าย...', '<div style="padding:2rem; text-align:center;"><i class="fa-solid fa-spinner fa-spin fa-2x"></i></div>');

  try {
    const res = await apiRequest(`/stock/transfers/${transferId}/document`);
    const doc = res.document;

    const bodyHtml = `
      <div id="printable-voucher" class="printable-area" style="background:#fff; color:#000; padding:1.8rem; border-radius:8px; font-family:'Sarabun','Prompt',sans-serif;">
        <div style="display:flex; justify-content:space-between; border-bottom:2px solid #000; padding-bottom:1rem; margin-bottom:1rem;">
          <div>
            <h2 style="font-size:1.5rem; font-weight:800; color:#000; margin-bottom:0.2rem;">SILMIN BANANA POS</h2>
            <p style="font-size:0.95rem; font-weight:700; color:#333;">${doc.documentTitle || 'ใบโอนย้ายสินค้าระหว่างสาขา'}</p>
          </div>
          <div style="text-align:right;">
            <h3 style="font-size:1.1rem; font-weight:700; color:#000;">เลขที่เอกสาร: ${doc.transferNumber}</h3>
            <p style="font-size:0.85rem; color:#555;">วันที่ออกเอกสาร: ${new Date(doc.date).toLocaleDateString('th-TH')}</p>
          </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom:1.2rem; font-size:0.85rem;">
          <div style="background:#f3f4f6; padding:0.8rem; border-radius:6px; border:1px solid #ddd;">
            <strong style="color:#000;">สาขาต้นทาง (ผู้จัดส่ง):</strong><br>
            ${doc.fromBranch ? doc.fromBranch.name : 'ไม่ระบุ'}<br>
            ที่อยู่: ${doc.fromBranch ? doc.fromBranch.address : '-'}<br>
            เบอร์โทรศัพท์: ${doc.fromBranch ? doc.fromBranch.phone : '-'}
          </div>
          <div style="background:#f3f4f6; padding:0.8rem; border-radius:6px; border:1px solid #ddd;">
            <strong style="color:#000;">สาขาปลายทาง (ผู้รับ):</strong><br>
            ${doc.toBranch ? doc.toBranch.name : 'ไม่ระบุ'}<br>
            ที่อยู่: ${doc.toBranch ? doc.toBranch.address : '-'}<br>
            เบอร์โทรศัพท์: ${doc.toBranch ? doc.toBranch.phone : '-'}
          </div>
        </div>

        <table style="width:100%; border-collapse:collapse; font-size:0.85rem; margin-bottom:1.2rem;">
          <thead>
            <tr style="background:#e5e7eb; color:#000;">
              <th style="padding:8px; border:1px solid #ccc; text-align:left;">รหัสสินค้า (SKU)</th>
              <th style="padding:8px; border:1px solid #ccc; text-align:left;">รายการสินค้า</th>
              <th style="padding:8px; border:1px solid #ccc; text-align:right;">จำนวนโอน (ชิ้น)</th>
            </tr>
          </thead>
          <tbody>
            ${doc.items.map(item => `
              <tr style="color:#000;">
                <td style="padding:8px; border:1px solid #ccc;"><strong>${item.sku}</strong></td>
                <td style="padding:8px; border:1px solid #ccc;">${item.productName || (item.product ? item.product.name : 'สินค้าทั่วไป')}</td>
                <td style="padding:8px; border:1px solid #ccc; text-align:right;"><strong>${item.quantity}</strong></td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        ${doc.remarks ? `<div style="font-size:0.85rem; margin-bottom:1.5rem; color:#333;"><strong>หมายเหตุ:</strong> ${doc.remarks}</div>` : ''}

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:2rem; margin-top:2.5rem; padding-top:1rem; border-top:1px dashed #aaa; font-size:0.85rem; text-align:center; color:#000;">
          <div>
            <br>____________________________________<br>
            <strong>ลงชื่อผู้จัดส่งสินค้า (สาขาต้นทาง)</strong><br>
            วันที่ _____ / _____ / ________
          </div>
          <div>
            <br>____________________________________<br>
            <strong>ลงชื่อผู้รับสินค้า (สาขาปลายทาง)</strong><br>
            วันที่ _____ / _____ / ________
          </div>
        </div>
      </div>
    `;

    const footerHtml = `
      <button class="btn btn-secondary" onclick="closeModal()">ปิดหน้าต่าง</button>
      <button class="btn btn-primary" onclick="window.print()"><i class="fa-solid fa-print"></i> พิมพ์ใบโอนย้ายสินค้า</button>
    `;

    openModal(`เอกสาร: ${doc.transferNumber}`, bodyHtml, footerHtml);
  } catch (err) {
    openModal('เกิดข้อผิดพลาด', `<p style="color:#ef4444;">${err.message}</p>`);
  }
}

/* ==========================================================================
   VIEW 6: PRODUCT MASTER CATALOG (AUTO SKU & AUTO FULL PRODUCT NAME)
   ========================================================================== */
async function renderProductMasterView() {
  const container = document.getElementById('content-container');
  container.innerHTML = `<div style="padding: 2rem; text-align: center; color: var(--text-muted);"><i class="fa-solid fa-spinner fa-spin" style="font-size:2rem;"></i> กำลังโหลดข้อมูลหลักสินค้า...</div>`;

  try {
    const res = await apiRequest('/products');
    const products = res.products || [];

    const canAddProduct = ['admin', 'hq_stock_staff', 'purchase_staff'].includes(state.user.role);

    container.innerHTML = `
      <div class="card" style="margin-bottom:1.5rem; display:flex; justify-content:space-between; align-items:center;">
        <div>
          <h3 style="font-size:1.1rem; font-weight:700;">ข้อมูลหลักสินค้า (Product Master Catalog)</h3>
          <p style="font-size:0.85rem; color:var(--text-muted);">ระบบจะประกอบ <strong>ชื่อสินค้าแบบเต็ม</strong> และ <strong>รหัส SKU</strong> ให้อัตโนมัติจากตัวเลือก Master Data</p>
        </div>
        ${canAddProduct ? `
          <button class="btn btn-primary btn-sm" id="create-product-btn"><i class="fa-solid fa-plus"></i> เพิ่ม Master SKU ใหม่</button>
        ` : ''}
      </div>

      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th style="width:60px; text-align:center;">ไอคอน</th>
              <th>รหัส SKU (อัตโนมัติ)</th>
              <th>ชื่อสินค้าแบบเต็ม (อัตโนมัติ)</th>
              <th>ยี่ห้อ / ชื่อรุ่น</th>
              <th>ความจุ / สีสินค้า</th>
              <th>หมวดหมู่</th>
              <th>ราคาทุน</th>
              <th>ราคาขาย</th>
            </tr>
          </thead>
          <tbody>
            ${products.length === 0 ? `<tr><td colspan="8" style="text-align:center; color:var(--text-muted);">ยังไม่มีการลงทะเบียนสินค้าในระบบ</td></tr>` : ''}
            ${products.map(p => `
              <tr>
                <td style="text-align:center; font-size:1.4rem; color:var(--accent-primary);">
                  <i class="fa-solid fa-mobile-screen-button"></i>
                </td>
                <td><strong>${p.sku}</strong></td>
                <td><strong>${p.name}</strong></td>
                <td><span class="badge badge-gray">${p.brand}</span> ${p.model}</td>
                <td>${p.capacity ? `<span class="badge badge-gold">${p.capacity}</span> ` : ''}${p.color || p.variation}</td>
                <td>${p.category}</td>
                <td>฿${p.purchase_price.toLocaleString()}</td>
                <td><strong style="color:#34d399;">฿${p.selling_price.toLocaleString()}</strong></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    if (canAddProduct) {
      document.getElementById('create-product-btn').addEventListener('click', openCreateProductModal);
    }
  } catch (err) {
    container.innerHTML = `<div style="color:#ef4444;">${err.message}</div>`;
  }
}

function openCreateProductModal() {
  const brands = state.masterOptions.brands || [];
  const models = state.masterOptions.models || [];
  const capacities = state.masterOptions.capacities || [];
  const colors = state.masterOptions.colors || [];
  const categories = state.masterOptions.categories || [];

  const initialBrand = brands[0] ? brands[0].value : '';
  const initialModel = models[0] ? models[0].value : '';
  const initialCapacity = capacities[0] ? capacities[0].value : '';
  const initialColor = colors[0] ? colors[0].value : '';

  const initialSKU = generateAutoSKU(initialBrand, initialModel, initialCapacity);
  const initialName = generateAutoName(initialBrand, initialModel, initialCapacity, initialColor);

  const bodyHtml = `
    <form id="new-product-form">
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;">
        <div class="form-group">
          <label for="prod-brand">ยี่ห้อ (เลือกจาก Master List)</label>
          <select id="prod-brand" class="form-select" onchange="recalculateAutoFields()" required>
            <option value="">-- เลือกยี่ห้อ --</option>
            ${brands.map(b => `<option value="${b.value}">${b.value}</option>`).join('')}
          </select>
        </div>

        <div class="form-group">
          <label for="prod-model">ชื่อรุ่น (เลือกจาก Master List)</label>
          <select id="prod-model" class="form-select" onchange="recalculateAutoFields()" required>
            <option value="">-- เลือกชื่อรุ่น --</option>
            ${models.map(m => `<option value="${m.value}">${m.value}</option>`).join('')}
          </select>
        </div>
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;">
        <div class="form-group">
          <label for="prod-capacity">ความจุ (เลือกจาก Master List)</label>
          <select id="prod-capacity" class="form-select" onchange="recalculateAutoFields()" required>
            <option value="">-- เลือกความจุ --</option>
            ${capacities.map(c => `<option value="${c.value}">${c.value}</option>`).join('')}
          </select>
        </div>

        <div class="form-group">
          <label for="prod-color">สีสินค้า (เลือกจาก Master List)</label>
          <select id="prod-color" class="form-select" onchange="recalculateAutoFields()" required>
            <option value="">-- เลือกสีสินค้า --</option>
            ${colors.map(cl => `<option value="${cl.value}">${cl.value}</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="form-group">
        <label for="prod-category">หมวดหมู่สินค้า (เลือกจาก Master List)</label>
        <select id="prod-category" class="form-select" required>
          <option value="">-- เลือกหมวดหมู่ --</option>
          ${categories.map(c => `<option value="${c.value}">${c.value}</option>`).join('')}
        </select>
      </div>

      <div class="form-group">
        <label for="prod-name">ชื่อสินค้าแบบเต็ม (ประกอบให้อัตโนมัติ)</label>
        <input type="text" id="prod-name" class="form-control" value="${initialName}" style="font-weight:700; color:#34d399; background:rgba(0,0,0,0.3);" placeholder="ระบบสร้างจาก ยี่ห้อ + ชื่อรุ่น + ความจุ + สี..." required readonly>
        <span style="font-size:0.75rem; color:var(--text-muted);">ระบบประกอบชื่อสินค้าแบบเต็มให้อัตโนมัติจากตัวเลือกด้านบน</span>
      </div>

      <div class="form-group">
        <label for="prod-sku">รหัสสินค้า SKU (รันให้อัตโนมัติ)</label>
        <div style="display:flex; gap:0.5rem;">
          <input type="text" id="prod-sku" class="form-control" value="${initialSKU}" style="font-weight:700; color:#38bdf8; background:rgba(0,0,0,0.3);" required readonly>
          <button type="button" class="btn btn-secondary btn-sm" onclick="recalculateAutoFields()" title="สร้างรหัส SKU และชื่อสินค้าใหม่">
            <i class="fa-solid fa-rotate"></i>
          </button>
        </div>
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;">
        <div class="form-group">
          <label for="prod-pprice">ราคาทุน (บาท)</label>
          <input type="number" id="prod-pprice" class="form-control" min="0" placeholder="0" required>
        </div>
        <div class="form-group">
          <label for="prod-sprice">ราคาขาย (บาท)</label>
          <input type="number" id="prod-sprice" class="form-control" min="0" placeholder="0" required>
        </div>
      </div>
    </form>
  `;

  const footerHtml = `
    <button class="btn btn-secondary" onclick="closeModal()">ยกเลิก</button>
    <button class="btn btn-primary" onclick="submitCreateProduct()"><i class="fa-solid fa-plus"></i> บันทึก Master Product</button>
  `;

  openModal('เพิ่มรหัสสินค้า Master SKU ใหม่ (สร้างชื่อสินค้าอัตโนมัติ)', bodyHtml, footerHtml);
}

function recalculateAutoFields() {
  const brandEl = document.getElementById('prod-brand');
  const modelEl = document.getElementById('prod-model');
  const capacityEl = document.getElementById('prod-capacity');
  const colorEl = document.getElementById('prod-color');

  const brand = brandEl ? brandEl.value : '';
  const model = modelEl ? modelEl.value : '';
  const capacity = capacityEl ? capacityEl.value : '';
  const color = colorEl ? colorEl.value : '';

  const skuInput = document.getElementById('prod-sku');
  const nameInput = document.getElementById('prod-name');

  if (skuInput) {
    skuInput.value = generateAutoSKU(brand, model, capacity);
  }

  if (nameInput) {
    nameInput.value = generateAutoName(brand, model, capacity, color);
  }
}

async function submitCreateProduct() {
  const brand = document.getElementById('prod-brand').value;
  const model = document.getElementById('prod-model').value;
  const capacity = document.getElementById('prod-capacity').value;
  const color = document.getElementById('prod-color').value;
  const category = document.getElementById('prod-category').value;
  const purchase_price = document.getElementById('prod-pprice').value;
  const selling_price = document.getElementById('prod-sprice').value;

  const skuInput = document.getElementById('prod-sku');
  const nameInput = document.getElementById('prod-name');

  const sku = skuInput && skuInput.value ? skuInput.value : generateAutoSKU(brand, model, capacity);
  const name = nameInput && nameInput.value ? nameInput.value : generateAutoName(brand, model, capacity, color);

  if (!brand || !model || !category || !purchase_price || !selling_price) {
    showToast('กรุณาเลือก ยี่ห้อ, ชื่อรุ่น, หมวดหมู่ และระบุราคาให้ครบถ้วน', 'error');
    return;
  }

  try {
    const res = await apiRequest('/products', 'POST', {
      sku,
      name,
      brand,
      model,
      capacity,
      color,
      variation: `${capacity} - ${color}`,
      category,
      purchase_price,
      selling_price
    });

    if (res.success) {
      showToast(`บันทึกรหัสสินค้า Master SKU ${res.product.sku} เรียบร้อยแล้ว`);
      closeModal();
      renderProductMasterView();
    }
  } catch (err) {
    // Handled
  }
}

/* ==========================================================================
   VIEW 7: BRANCH MANAGEMENT
   ========================================================================== */
async function renderBranchManagementView() {
  const container = document.getElementById('content-container');
  container.innerHTML = `<div style="padding: 2rem; text-align: center; color: var(--text-muted);"><i class="fa-solid fa-spinner fa-spin" style="font-size:2rem;"></i> กำลังโหลดรายการสาขา...</div>`;

  try {
    const res = await apiRequest('/branches');
    const branches = res.branches || [];

    const isAdmin = state.user.role === 'admin';

    container.innerHTML = `
      <div class="card" style="margin-bottom:1.5rem; display:flex; justify-content:space-between; align-items:center;">
        <div>
          <h3 style="font-size:1.1rem; font-weight:700;">จัดการข้อมูลสาขา (Branch Management)</h3>
          <p style="font-size:0.85rem; color:var(--text-muted);">รายการสาขาทั้งหมดในระบบ และการเปิด/ปิดใช้งานสาขา</p>
        </div>
        ${isAdmin ? `
          <button class="btn btn-primary btn-sm" id="add-new-branch-btn"><i class="fa-solid fa-plus"></i> เพิ่มสาขาใหม่</button>
        ` : ''}
      </div>

      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>รหัสสาขา (Branch Code)</th>
              <th>ชื่อสาขา (Branch Name)</th>
              <th>ที่ตั้ง / เบอร์ติดต่อ (Location / Contact)</th>
              <th>สถานะ (Status)</th>
              ${isAdmin ? `<th>การจัดการ</th>` : ''}
            </tr>
          </thead>
          <tbody>
            ${branches.length === 0 ? `<tr><td colspan="5" style="text-align:center; color:var(--text-muted);">ไม่พบข้อมูลสาขาในระบบ</td></tr>` : ''}
            ${branches.map(b => `
              <tr>
                <td><strong>${b.code || b.branchCode}</strong></td>
                <td><strong>${b.name || b.branchName}</strong></td>
                <td>${b.address || ''} ${b.phone ? '• Tel: ' + b.phone : ''}</td>
                <td>
                  <span class="badge badge-${b.isActive ? 'green' : 'red'}">
                    ${b.isActive ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                  </span>
                </td>
                ${isAdmin ? `
                  <td>
                    <button class="btn btn-secondary btn-sm" onclick="openEditBranchModal('${b._id}', '${b.name}', '${b.address}', '${b.phone}', ${b.isActive})">
                      <i class="fa-solid fa-pen-to-square"></i> แก้ไข
                    </button>
                  </td>
                ` : ''}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    if (isAdmin) {
      document.getElementById('add-new-branch-btn').addEventListener('click', openAddBranchModal);
    }
  } catch (err) {
    container.innerHTML = `<div style="color:#ef4444;">${err.message}</div>`;
  }
}

function openAddBranchModal() {
  const bodyHtml = `
    <form id="new-branch-form">
      <div class="form-group">
        <label for="mb-code">รหัสสาขา (Branch Code)</label>
        <input type="text" id="mb-code" class="form-control" placeholder="เช่น BR-N006" required>
      </div>

      <div class="form-group">
        <label for="mb-name">ชื่อสาขา (Branch Name)</label>
        <input type="text" id="mb-name" class="form-control" placeholder="เช่น สาขาภาคตะวันออกเฉียงเหนือ (ขอนแก่น)" required>
      </div>

      <div class="form-group">
        <label for="mb-address">ที่ตั้งสาขา (Location / Address)</label>
        <textarea id="mb-address" class="form-control" rows="2" placeholder="ระบุที่อยู่สาขา..."></textarea>
      </div>

      <div class="form-group">
        <label for="mb-phone">เบอร์โทรศัพท์ติดต่อ (Contact Phone)</label>
        <input type="text" id="mb-phone" class="form-control" placeholder="เช่น 043-111-222">
      </div>
    </form>
  `;

  const footerHtml = `
    <button class="btn btn-secondary" onclick="closeModal()">ยกเลิก</button>
    <button class="btn btn-primary" onclick="submitAddBranch()"><i class="fa-solid fa-check"></i> บันทึกเพิ่มสาขาใหม่</button>
  `;

  openModal('เพิ่มสาขาใหม่ (Add New Branch)', bodyHtml, footerHtml);
}

async function submitAddBranch() {
  const branchCode = document.getElementById('mb-code').value.trim();
  const branchName = document.getElementById('mb-name').value.trim();
  const address = document.getElementById('mb-address').value.trim();
  const phone = document.getElementById('mb-phone').value.trim();

  if (!branchCode || !branchName) {
    showToast('กรุณากรอกรหัสสาขาและชื่อสาขาให้ครบถ้วน', 'error');
    return;
  }

  try {
    const res = await apiRequest('/branches', 'POST', {
      branchCode,
      branchName,
      address,
      phone
    });

    if (res.success) {
      showToast('เพิ่มสาขาใหม่สำเร็จ');
      closeModal();
      renderBranchManagementView();
    }
  } catch (err) {
    // Handled
  }
}

function openEditBranchModal(id, name, address, phone, isActive) {
  const bodyHtml = `
    <form id="edit-branch-form">
      <div class="form-group">
        <label for="eb-name">ชื่อสาขา (Branch Name)</label>
        <input type="text" id="eb-name" class="form-control" value="${name}" required>
      </div>

      <div class="form-group">
        <label for="eb-address">ที่ตั้งสาขา (Address)</label>
        <textarea id="eb-address" class="form-control" rows="2">${address || ''}</textarea>
      </div>

      <div class="form-group">
        <label for="eb-phone">เบอร์โทรศัพท์ติดต่อ (Phone)</label>
        <input type="text" id="eb-phone" class="form-control" value="${phone || ''}">
      </div>

      <div class="form-group">
        <label for="eb-status">สถานะการใช้งานสาขา</label>
        <select id="eb-status" class="form-select">
          <option value="true" ${isActive ? 'selected' : ''}>เปิดใช้งาน (Active)</option>
          <option value="false" ${!isActive ? 'selected' : ''}>ปิดใช้งาน (Inactive)</option>
        </select>
      </div>
    </form>
  `;

  const footerHtml = `
    <button class="btn btn-secondary" onclick="closeModal()">ยกเลิก</button>
    <button class="btn btn-primary" onclick="submitEditBranch('${id}')"><i class="fa-solid fa-save"></i> บันทึกการแก้ไข</button>
  `;

  openModal('แก้ไขข้อมูลสาขา', bodyHtml, footerHtml);
}

async function submitEditBranch(id) {
  const branchName = document.getElementById('eb-name').value.trim();
  const address = document.getElementById('eb-address').value.trim();
  const phone = document.getElementById('eb-phone').value.trim();
  const isActive = document.getElementById('eb-status').value === 'true';

  try {
    const res = await apiRequest(`/branches/${id}`, 'PUT', {
      branchName,
      address,
      phone,
      isActive
    });

    if (res.success) {
      showToast('อัปเดตข้อมูลสาขาสำเร็จ');
      closeModal();
      renderBranchManagementView();
    }
  } catch (err) {
    // Handled
  }
}

/* ==========================================================================
   VIEW 8: EMPLOYEE MANAGEMENT
   ========================================================================== */
async function renderEmployeeManagementView() {
  const container = document.getElementById('content-container');
  container.innerHTML = `<div style="padding: 2rem; text-align: center; color: var(--text-muted);"><i class="fa-solid fa-spinner fa-spin" style="font-size:2rem;"></i> กำลังโหลดรายชื่อพนักงาน...</div>`;

  try {
    const [usersRes, branchRes] = await Promise.all([
      apiRequest('/users'),
      apiRequest('/branches')
    ]);

    const users = usersRes.users || [];
    const branches = branchRes.branches || [];

    const isAdmin = state.user.role === 'admin';

    container.innerHTML = `
      <div class="card" style="margin-bottom:1.5rem; display:flex; justify-content:space-between; align-items:center;">
        <div>
          <h3 style="font-size:1.1rem; font-weight:700;">จัดการพนักงาน (Employee Management)</h3>
          <p style="font-size:0.85rem; color:var(--text-muted);">รายชื่อพนักงาน กำหนดสิทธิ์ตามตำแหน่ง และมอบหมายสาขาประจำ</p>
        </div>
        ${isAdmin ? `
          <button class="btn btn-primary btn-sm" id="add-new-emp-btn"><i class="fa-solid fa-user-plus"></i> เพิ่มพนักงานใหม่</button>
        ` : ''}
      </div>

      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>รหัสพนักงาน (Emp ID)</th>
              <th>ชื่อ-นามสกุล (Name)</th>
              <th>แผนก/ตำแหน่ง (Role)</th>
              <th>สาขาประจำ (Assigned Branch)</th>
              <th>สถานะ (Status)</th>
              ${isAdmin ? `<th>การจัดการ</th>` : ''}
            </tr>
          </thead>
          <tbody>
            ${users.length === 0 ? `<tr><td colspan="6" style="text-align:center; color:var(--text-muted);">ไม่พบข้อมูลพนักงานในระบบ</td></tr>` : ''}
            ${users.map(u => `
              <tr>
                <td><strong>${u.empId || 'EMP-' + u._id.slice(-4)}</strong></td>
                <td>
                  <strong>${u.fullName || u.username}</strong><br>
                  <span style="font-size:0.8rem; color:var(--text-muted);">${u.email}</span>
                </td>
                <td><span class="badge badge-gray">${formatRoleThai(u.role)}</span></td>
                <td>${u.branch ? u.branch.name : 'ส่วนกลาง (สำนักงานใหญ่)'}</td>
                <td>
                  <span class="badge badge-${u.isActive ? 'green' : 'red'}">
                    ${u.isActive ? 'ปกติ' : 'ถูกระงับ'}
                  </span>
                </td>
                ${isAdmin ? `
                  <td>
                    <button class="btn btn-secondary btn-sm" onclick="openEditEmpModal('${u._id}', '${u.fullName || u.username}', '${u.role}', '${u.branch ? u.branch._id : ''}', ${u.isActive})">
                      <i class="fa-solid fa-pen-to-square"></i> แก้ไข
                    </button>
                  </td>
                ` : ''}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    if (isAdmin) {
      document.getElementById('add-new-emp-btn').addEventListener('click', () => openAddEmpModal(branches));
    }
  } catch (err) {
    container.innerHTML = `<div style="color:#ef4444;">${err.message}</div>`;
  }
}

function openAddEmpModal(branches) {
  const bodyHtml = `
    <form id="new-emp-form">
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;">
        <div class="form-group">
          <label for="me-empid">รหัสพนักงาน (Emp ID)</label>
          <input type="text" id="me-empid" class="form-control" placeholder="เช่น EMP-0010">
        </div>
        <div class="form-group">
          <label for="me-fullname">ชื่อ-นามสกุล (Full Name)</label>
          <input type="text" id="me-fullname" class="form-control" placeholder="เช่น นายประเสริฐ สินค้าดี" required>
        </div>
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;">
        <div class="form-group">
          <label for="me-username">ชื่อผู้ใช้งาน (Username สำหรับล็อกอิน)</label>
          <input type="text" id="me-username" class="form-control" placeholder="เช่น prasert.s" required>
        </div>
        <div class="form-group">
          <label for="me-email">อีเมล (Email)</label>
          <input type="email" id="me-email" class="form-control" placeholder="prasert@pos.com" required>
        </div>
      </div>

      <div class="form-group">
        <label for="me-password">รหัสผ่าน (Password)</label>
        <input type="password" id="me-password" class="form-control" placeholder="••••••••" required>
      </div>

      <div class="form-group">
        <label for="me-role">แผนก/ตำแหน่ง (Role)</label>
        <select id="me-role" class="form-select" required>
          <option value="admin">ผู้ดูแลระบบ (Admin)</option>
          <option value="branch_staff" selected>พนักงานฝ่ายขาย (Sales)</option>
          <option value="technical_staff">พนักงานฝ่ายเทคนิค (Technician)</option>
          <option value="purchase_staff">ฝ่ายจัดซื้อ (Purchasing)</option>
          <option value="hq_stock_staff">พนักงานฝ่ายสต็อก (Stock/HQ)</option>
        </select>
      </div>

      <div class="form-group">
        <label for="me-branch">สาขาประจำ (Assigned Branch)</label>
        <select id="me-branch" class="form-select">
          <option value="">ส่วนกลาง (สำนักงานใหญ่)</option>
          ${branches.map(b => `<option value="${b._id}">${b.name} (${b.code})</option>`).join('')}
        </select>
      </div>
    </form>
  `;

  const footerHtml = `
    <button class="btn btn-secondary" onclick="closeModal()">ยกเลิก</button>
    <button class="btn btn-primary" onclick="submitAddEmp()"><i class="fa-solid fa-user-check"></i> ยืนยันเพิ่มพนักงานใหม่</button>
  `;

  openModal('เพิ่มพนักงานใหม่ (Add New Employee)', bodyHtml, footerHtml);
}

async function submitAddEmp() {
  const empId = document.getElementById('me-empid').value.trim();
  const fullName = document.getElementById('me-fullname').value.trim();
  const username = document.getElementById('me-username').value.trim();
  const email = document.getElementById('me-email').value.trim();
  const password = document.getElementById('me-password').value;
  const role = document.getElementById('me-role').value;
  const branchId = document.getElementById('me-branch').value;

  if (!fullName || !username || !email || !password || !role) {
    showToast('กรุณากรอกข้อมูลพนักงานให้ครบถ้วน', 'error');
    return;
  }

  try {
    const res = await apiRequest('/users', 'POST', {
      empId,
      fullName,
      username,
      email,
      password,
      role,
      branchId
    });

    if (res.success) {
      showToast('เพิ่มพนักงานสำเร็จ');
      closeModal();
      renderEmployeeManagementView();
    }
  } catch (err) {
    // Handled
  }
}

function openEditEmpModal(id, fullName, role, branchId, isActive) {
  const branches = state.masterOptions.branches || [];

  const bodyHtml = `
    <form id="edit-emp-form">
      <div class="form-group">
        <label for="ee-fullname">ชื่อ-นามสกุล (Full Name)</label>
        <input type="text" id="ee-fullname" class="form-control" value="${fullName}" required>
      </div>

      <div class="form-group">
        <label for="ee-role">แผนก/ตำแหน่ง (Role)</label>
        <select id="ee-role" class="form-select" required>
          <option value="admin" ${role === 'admin' ? 'selected' : ''}>ผู้ดูแลระบบ (Admin)</option>
          <option value="branch_staff" ${role === 'branch_staff' ? 'selected' : ''}>พนักงานฝ่ายขาย (Sales)</option>
          <option value="technical_staff" ${role === 'technical_staff' ? 'selected' : ''}>พนักงานฝ่ายเทคนิค (Technician)</option>
          <option value="purchase_staff" ${role === 'purchase_staff' ? 'selected' : ''}>ฝ่ายจัดซื้อ (Purchasing)</option>
          <option value="hq_stock_staff" ${role === 'hq_stock_staff' ? 'selected' : ''}>พนักงานฝ่ายสต็อก (Stock/HQ)</option>
        </select>
      </div>

      <div class="form-group">
        <label for="ee-branch">สาขาประจำ (Assigned Branch)</label>
        <select id="ee-branch" class="form-select">
          <option value="">ส่วนกลาง (สำนักงานใหญ่)</option>
          ${branches.map(b => `<option value="${b._id}" ${b._id === branchId ? 'selected' : ''}>${b.name} (${b.code})</option>`).join('')}
        </select>
      </div>

      <div class="form-group">
        <label for="ee-status">สถานะพนักงาน</label>
        <select id="ee-status" class="form-select">
          <option value="true" ${isActive ? 'selected' : ''}>ปกติ (Active)</option>
          <option value="false" ${!isActive ? 'selected' : ''}>ระงับการใช้งาน (Suspended)</option>
        </select>
      </div>

      <div class="form-group">
        <label for="ee-password">เปลี่ยนรหัสผ่านใหม่ (หากต้องการเปลี่ยน)</label>
        <input type="password" id="ee-password" class="form-control" placeholder="เว้นว่างไว้หากไม่ต้องการเปลี่ยน">
      </div>
    </form>
  `;

  const footerHtml = `
    <button class="btn btn-secondary" onclick="closeModal()">ยกเลิก</button>
    <button class="btn btn-primary" onclick="submitEditEmp('${id}')"><i class="fa-solid fa-save"></i> บันทึกการปรับปรุง</button>
  `;

  openModal('แก้ไขข้อมูลและสิทธิ์พนักงาน', bodyHtml, footerHtml);
}

async function submitEditEmp(id) {
  const fullName = document.getElementById('ee-fullname').value.trim();
  const role = document.getElementById('ee-role').value;
  const branchId = document.getElementById('ee-branch').value;
  const isActive = document.getElementById('ee-status').value === 'true';
  const password = document.getElementById('ee-password').value;

  try {
    const res = await apiRequest(`/users/${id}`, 'PUT', {
      fullName,
      role,
      branchId,
      isActive,
      ...(password ? { password } : {})
    });

    if (res.success) {
      showToast('อัปเดตข้อมูลพนักงานสำเร็จ');
      closeModal();
      renderEmployeeManagementView();
    }
  } catch (err) {
    // Handled
  }
}

// Global Initialization
document.addEventListener('DOMContentLoaded', () => {
  initAppSession();
});
