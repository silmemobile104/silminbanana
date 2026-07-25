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
  'admin': ['dashboard', 'pos', 'finance', 'branch-inventory', 'hq-audit', 'branch-audit', 'goods-receipt', 'purchase-orders', 'receipt-verification', 'transfers', 'master-settings', 'branches', 'employees'],
  'hq_stock_staff': ['dashboard', 'pos', 'finance', 'branch-inventory', 'hq-audit', 'branch-audit', 'goods-receipt', 'purchase-orders', 'receipt-verification', 'transfers', 'master-settings'],
  'branch_staff': ['dashboard', 'pos', 'finance', 'branch-inventory', 'branch-audit', 'goods-receipt', 'purchase-orders', 'receipt-verification', 'transfers'],
  'technical_staff': ['dashboard', 'pos', 'branch-inventory', 'branch-audit', 'goods-receipt', 'purchase-orders'],
  'purchase_staff': ['dashboard', 'finance', 'branch-inventory', 'goods-receipt', 'purchase-orders', 'receipt-verification', 'master-settings']
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

// Helper to generate auto name
function generateAutoSKU(brand = '', model = '', capacity = '') {
  return '';
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
      heading.innerText = 'แดชบอร์ดผู้บริหาร (Executive Dashboard)';
      subheading.innerText = 'สรุปยอดขาย ประสิทธิภาพรายสาขา มูลค่าสต็อกสินค้าคงคลัง และสถานะการนับสต็อกประจำวันเรียลไทม์';
      renderDashboardView();
      break;
    case 'pos':
      heading.innerText = 'ขายสินค้าหน้าร้าน & ออกใบเสร็จ';
      subheading.innerText = 'ระบบขายสินค้า ตัดสต็อก ตัด IMEI อัตโนมัติ พร้อมออกใบเสร็จรับเงินอย่างย่อ';
      renderPosView();
      break;
    case 'finance':
      heading.innerText = 'รายงานการเงิน & กำไรจากการขาย';
      subheading.innerText = 'สรุปยอดขาย ต้นทุน กำไรสุทธิ ทั้งแบบสด/โอน และแบบจัดไฟแนนซ์ (พร้อมระบบบันทึกวันที่รับเงินไฟแนนซ์)';
      renderFinanceView();
      break;
    case 'branch-inventory':
      heading.innerText = 'สินค้าในสาขา';
      subheading.innerText = 'รายการสินค้าคงคลังที่มีอยู่จริงในสาขาของคุณ';
      renderBranchInventoryView();
      break;
    case 'hq-audit':
      heading.innerText = 'แดชบอร์ดตรวจสอบสต็อก';
      subheading.innerText = 'ตรวจสอบและอนุมัติการนับสต็อกประจำวันของสาขาทั้งหมดพร้อมระบบแจ้งเตือนสี';
      renderHqAuditView();
      break;
    case 'branch-audit':
      heading.innerText = 'นับสต็อกประจำวัน';
      subheading.innerText = 'สแกน IMEI/ซีเรียล หรือระบุจำนวนนับจริงเพื่อคำนวณ ยอดที่ขาด/เกิน';
      renderBranchAuditView();
      break;
    case 'goods-receipt':
      heading.innerText = 'รับสินค้าเข้าสต็อก';
      subheading.innerText = 'บันทึกรายการนำเข้าสินค้าโดยระบุตัวเลือกยี่ห้อ รุ่น ความจุ สี และ IMEI ประจำเครื่อง';
      renderGoodsReceiptView();
      break;
    case 'purchase-orders':
      heading.innerText = 'สั่งซื้อสินค้าลงสาขา';
      subheading.innerText = 'สั่งซื้อสินค้าจากส่วนกลางลงสาขา หักเงินจากวงเงินสาขาอัตโนมัติ';
      renderBranchPurchaseOrdersView();
      break;
    case 'receipt-verification':
      heading.innerText = 'ตรวจสอบรายการรับสินค้าเข้าสต็อก';
      subheading.innerText = 'ตรวจสอบรายการรับสินค้าจากหน้าร้าน กำหนดราคาทุนและราคาขาย พร้อมกดยืนยันเข้าสต็อก';
      renderReceiptVerificationView();
      break;
    case 'transfers':
      heading.innerText = 'โอนย้ายสินค้าระหว่างสาขา';
      subheading.innerText = 'สร้างรายการโอนย้ายสินค้าและพิมพ์ ใบโอนย้ายสินค้าระหว่างสาขา';
      renderTransfersView();
      break;
    case 'master-settings':
      heading.innerText = 'ตั้งค่าตัวเลือก Master Data';
      subheading.innerText = 'เพิ่มและจัดการ ยี่ห้อ, ชื่อรุ่น, ความจุ, สีสินค้า และ หมวดหมู่สินค้า เพื่อใช้งานทั่วทั้งระบบโดยไม่ต้องแก้โค้ด';
      renderMasterSettingsView();
      break;
    case 'branches':
      heading.innerText = 'จัดการสาขา';
      subheading.innerText = 'เพิ่ม แก้ไข และเปิด/ปิดการใช้งานสาขาในระบบ';
      renderBranchManagementView();
      break;
    case 'employees':
      heading.innerText = 'จัดการพนักงาน';
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
  container.innerHTML = `<div style="padding: 3rem; text-align: center; color: var(--text-muted);"><i class="fa-solid fa-spinner fa-spin" style="font-size:2.5rem; color:var(--accent-primary);"></i><br><br><span style="font-size:1.1rem; font-weight:600;">กำลังโหลดแดชบอร์ดผู้บริหาร (Executive Dashboard)...</span></div>`;

  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const [execRes, auditRes] = await Promise.all([
      apiRequest('/pos/executive-dashboard'),
      apiRequest(`/audit/dashboard?date=${todayStr}`)
    ]);

    const stats = execRes.executiveStats || {};
    const branchesSummary = auditRes.summary ? auditRes.summary.branches : [];
    const pendingAuditsCount = auditRes.summary ? auditRes.summary.pendingCount : 0;
    const submittedCount = auditRes.summary ? auditRes.summary.submittedCount : 0;

    const todayRevenue = stats.todayRevenue || 0;
    const todayProfit = stats.todayProfit || 0;
    const todayBills = stats.todayBills || 0;
    const todayCashRevenue = stats.todayCashRevenue || 0;
    const todayFinanceRevenue = stats.todayFinanceRevenue || 0;
    const totalStockItems = stats.totalStockItems || 0;
    const totalStockValue = stats.totalStockValue || 0;
    const branchPerformance = stats.branchPerformance || [];
    const topSellingProducts = stats.topSellingProducts || [];
    const lowStockAlerts = stats.lowStockAlerts || [];

    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem; margin-bottom:1.2rem;">
        <div>
          <h3 style="font-size:1.25rem; font-weight:800; color:#fff; display:flex; align-items:center; gap:0.5rem;">
            <i class="fa-solid fa-chart-line" style="color:var(--accent-primary);"></i> ภาพรวมแดชบอร์ดผู้บริหาร (Executive Dashboard)
          </h3>
          <p style="font-size:0.85rem; color:var(--text-muted);">วิเคราะห์สถิติจำนวนสินค้า ยอดขาย รายได้ และสถานะการนับสต็อกเรียลไทม์</p>
        </div>

        <div>
          <button class="btn btn-primary" onclick="openExecutiveReportModal()" style="padding:0.6rem 1.2rem; font-weight:700; display:flex; align-items:center; gap:0.5rem; box-shadow:0 4px 14px rgba(99,102,241,0.4);">
            <i class="fa-solid fa-file-invoice-dollar"></i> ดูรายงานสรุปผู้บริหาร
          </button>
        </div>
      </div>

      <!-- Executive KPI Cards Grid -->
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
        
        <!-- KPI 1: Today Revenue -->
        <div class="card" style="background: linear-gradient(135deg, rgba(16,185,129,0.18), rgba(16,185,129,0.04)); border: 1px solid rgba(16,185,129,0.35);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">
            <span style="color:var(--text-muted); font-size:0.85rem; font-weight:600;">ยอดขายรวมวันนี้</span>
            <i class="fa-solid fa-sack-dollar" style="color:#34d399; font-size:1.5rem;"></i>
          </div>
          <div style="font-size:2.2rem; font-weight:800; color:#34d399;">฿${todayRevenue.toLocaleString()}</div>
          <div style="font-size:0.78rem; color:var(--text-muted); margin-top:0.3rem;">
            สด/โอน: <strong style="color:#fff;">฿${todayCashRevenue.toLocaleString()}</strong> | ไฟแนนซ์: <strong style="color:#fbbf24;">฿${todayFinanceRevenue.toLocaleString()}</strong>
          </div>
        </div>

        <!-- KPI 2: Today Bills -->
        <div class="card" style="background: linear-gradient(135deg, rgba(56,189,248,0.18), rgba(56,189,248,0.04)); border: 1px solid rgba(56,189,248,0.35);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">
            <span style="color:var(--text-muted); font-size:0.85rem; font-weight:600;">บิลขายวันนี้</span>
            <i class="fa-solid fa-receipt" style="color:#38bdf8; font-size:1.5rem;"></i>
          </div>
          <div style="font-size:2.2rem; font-weight:800; color:#38bdf8;">${todayBills} <span style="font-size:0.95rem; color:var(--text-muted);">บิล</span></div>
          <div style="font-size:0.78rem; color:var(--text-muted); margin-top:0.3rem;">
            ประมาณการกำไร: <strong style="color:#34d399;">฿${todayProfit.toLocaleString()}</strong>
          </div>
        </div>

        <!-- KPI 3: Total Stock Value -->
        <div class="card" style="background: linear-gradient(135deg, rgba(99,102,241,0.18), rgba(99,102,241,0.04)); border: 1px solid rgba(99,102,241,0.35);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">
            <span style="color:var(--text-muted); font-size:0.85rem; font-weight:600;">มูลค่าสต็อกสินค้าคงเหลือ</span>
            <i class="fa-solid fa-boxes-stacked" style="color:#818cf8; font-size:1.5rem;"></i>
          </div>
          <div style="font-size:2.2rem; font-weight:800; color:#fff;">฿${totalStockValue.toLocaleString()}</div>
          <div style="font-size:0.78rem; color:var(--text-muted); margin-top:0.3rem;">
            สินค้าคงคลัง: <strong style="color:#38bdf8;">${totalStockItems.toLocaleString()}</strong> เครื่อง (5 สาขา)
          </div>
        </div>

        <!-- KPI 4: Daily Audit Status -->
        <div class="card" style="background: linear-gradient(135deg, rgba(251,191,36,0.18), rgba(251,191,36,0.04)); border: 1px solid rgba(251,191,36,0.35);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">
            <span style="color:var(--text-muted); font-size:0.85rem; font-weight:600;">สถานะนับสต็อกประจำวัน</span>
            <i class="fa-solid fa-clipboard-check" style="color:#fbbf24; font-size:1.5rem;"></i>
          </div>
          <div style="font-size:2.2rem; font-weight:800; color:${pendingAuditsCount > 0 ? '#fbbf24' : '#34d399'};">
            ${submittedCount} / 5 <span style="font-size:0.95rem; color:var(--text-muted);">สาขาส่งแล้ว</span>
          </div>
          <div style="font-size:0.78rem; color:var(--text-muted); margin-top:0.3rem;">
            ${pendingAuditsCount} สาขารอตรวจสอบจากส่วนกลาง
          </div>
        </div>
      </div>

      <!-- Charts & Widgets Middle Grid -->
      <div style="display:grid; grid-template-columns: 1.5fr 1fr; gap:1.2rem; margin-bottom:1.5rem; align-items:stretch;">
        
        <!-- Interactive Chart: Revenue & Stock Value per Branch -->
        <div class="card" style="display:flex; flex-direction:column;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
            <h3 style="font-size:1.05rem; font-weight:700; display:flex; align-items:center; gap:0.5rem;">
              <i class="fa-solid fa-chart-column" style="color:var(--accent-primary);"></i> เปรียบเทียบยอดขาย & มูลค่าสต็อก 5 สาขา
            </h3>
            <span style="font-size:0.78rem; color:var(--text-muted);"><i class="fa-solid fa-circle" style="color:#34d399;"></i> ข้อมูลประจำวันวันนี้</span>
          </div>
          <div style="position:relative; flex:1; min-height:260px;">
            <canvas id="executive-branch-chart"></canvas>
          </div>
        </div>

        <!-- Right Side Widgets: Top Selling & Low Stock Alerts -->
        <div style="display:flex; flex-direction:column; gap:1.2rem;">
          
          <!-- Top Selling Products Widget -->
          <div class="card" style="flex:1;">
            <h4 style="font-size:0.95rem; font-weight:700; margin-bottom:0.8rem; color:#38bdf8; display:flex; align-items:center; gap:0.4rem;">
              <i class="fa-solid fa-fire" style="color:#f97316;"></i> สินค้าขายดีประจำวัน Top 5
            </h4>
            <div style="font-size:0.82rem;">
              ${topSellingProducts.length === 0 ? '<div style="color:var(--text-muted); font-style:italic; padding:1rem 0; text-align:center;">ยังไม่มีรายการขายในวันนี้</div>' : ''}
              ${topSellingProducts.map((p, idx) => `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:0.4rem 0; border-bottom:1px solid rgba(255,255,255,0.06);">
                  <div>
                    <strong style="color:#fff;">${idx + 1}. ${p.productName}</strong>
                  </div>
                  <div style="text-align:right;">
                    <span class="badge badge-green" style="font-size:0.75rem;">${p.quantity} เครื่อง</span>
                    <div style="font-weight:700; color:#34d399; font-size:0.8rem; margin-top:0.1rem;">฿${p.revenue.toLocaleString()}</div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Low Stock Alerts Widget -->
          <div class="card" style="flex:1;">
            <h4 style="font-size:0.95rem; font-weight:700; margin-bottom:0.8rem; color:#f87171; display:flex; align-items:center; gap:0.4rem;">
              <i class="fa-solid fa-triangle-exclamation"></i> แจ้งเตือนสินค้าสต็อกต่ำ (เหลือ ≤ 2)
            </h4>
            <div style="font-size:0.8rem; max-height:140px; overflow-y:auto;">
              ${lowStockAlerts.length === 0 ? '<div style="color:#34d399; font-style:italic; padding:0.5rem 0;">ไม่มีสินค้าสต็อกต่ำในขณะนี้ ทุกสาขามีสต็อกเพียงพอ</div>' : ''}
              ${lowStockAlerts.map(item => `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:0.4rem 0.6rem; background:rgba(248,113,113,0.08); border-radius:6px; margin-bottom:0.4rem; border:1px solid rgba(248,113,113,0.2);">
                  <div>
                    <strong style="color:#fff;">${item.productName}</strong>
                    <div style="font-size:0.73rem; color:var(--text-muted);">${item.branchName}</div>
                  </div>
                  <span class="badge badge-red" style="font-weight:800; font-size:0.82rem;">เหลือ ${item.quantity} เครื่อง</span>
                </div>
              `).join('')}
            </div>
          </div>

        </div>
      </div>

      <!-- Real-time 5-Branch Operational & Audit Health Grid -->
      <div class="card" style="margin-bottom: 1.5rem;">
        <h3 style="font-size: 1.1rem; font-weight:700; margin-bottom: 1rem; display:flex; align-items:center; gap:0.5rem;">
          <i class="fa-solid fa-store" style="color:var(--accent-primary);"></i> สถานะการนับสต็อกประจำวันเรียลไทม์ 5 สาขา (${todayStr})
        </h3>
        
        <div class="audit-grid">
          ${branchesSummary.map(b => `
            <div class="audit-card status-${b.colorCode}">
              <div class="audit-header">
                <div>
                  <div class="branch-name">${b.branch.name}</div>
                  <div class="branch-code">เบอร์โทร: ${b.branch.phone}</div>
                </div>
                <span class="badge badge-${b.colorCode}">${b.status}</span>
              </div>

              <div class="audit-stats">
                <div class="stat-item">
                  <div class="stat-val">${b.totalExpected}</div>
                  <div class="stat-lbl">จำนวนสินค้า</div>
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

    // Render Chart.js Chart
    setTimeout(() => {
      const ctx = document.getElementById('executive-branch-chart');
      if (ctx && window.Chart) {
        const labels = branchPerformance.map(b => b.name.replace('บานาน่า ', ''));
        const revenues = branchPerformance.map(b => b.revenue);
        const stockValues = branchPerformance.map(b => b.stockValue);

        new window.Chart(ctx, {
          type: 'bar',
          data: {
            labels: labels.length > 0 ? labels : ['เบตง', 'ยะลา', 'ปัตตานี', 'นราธิวาส', 'หาดใหญ่'],
            datasets: [
              {
                label: 'ยอดขายวันนี้ (บาท)',
                data: revenues.length > 0 ? revenues : [0, 0, 0, 0, 0],
                backgroundColor: 'rgba(52, 211, 153, 0.75)',
                borderColor: '#34d399',
                borderWidth: 1,
                borderRadius: 4
              },
              {
                label: 'มูลค่าสต็อกคงเหลือ (บาท)',
                data: stockValues.length > 0 ? stockValues : [0, 0, 0, 0, 0],
                backgroundColor: 'rgba(99, 102, 241, 0.5)',
                borderColor: '#818cf8',
                borderWidth: 1,
                borderRadius: 4
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                labels: { color: '#e2e8f0', font: { family: 'Prompt', size: 12 } }
              }
            },
            scales: {
              x: {
                ticks: { color: '#94a3b8', font: { family: 'Prompt' } },
                grid: { color: 'rgba(255,255,255,0.05)' }
              },
              y: {
                ticks: { color: '#94a3b8', font: { family: 'Prompt' } },
                grid: { color: 'rgba(255,255,255,0.08)' }
              }
            }
          }
        });
      }
    }, 100);

  } catch (err) {
    container.innerHTML = `<div style="color:#ef4444; padding:2rem;">เกิดข้อผิดพลาดในการโหลดแดชบอร์ดผู้บริหาร: ${err.message}</div>`;
  }
}

/* ==========================================================================
   EXECUTIVE HISTORICAL REPORT MODAL (POP-UP)
   ========================================================================== */
async function openExecutiveReportModal(startDate = null, endDate = null) {
  const todayStr = new Date().toISOString().split('T')[0];
  const startVal = startDate || todayStr;
  const endVal = endDate || todayStr;

  const modalTitle = `📊 สรุปรายงานผู้บริหาร (Executive Report)`;

  openModal(modalTitle, `<div style="padding: 3rem; text-align: center; color: var(--text-muted);"><i class="fa-solid fa-spinner fa-spin" style="font-size:2.5rem; color:var(--accent-primary);"></i><br><br><span style="font-size:1.1rem; font-weight:600;">กำลังรวบรวมรายงานสรุปผู้บริหาร (${startVal} ถึง ${endVal})...</span></div>`);

  try {
    const res = await apiRequest(`/pos/executive-report?startDate=${startVal}&endDate=${endVal}`);
    const data = res.summary || {};

    const totalRev = data.totalRevenue || 0;
    const totalProf = data.totalProfit || 0;
    const margin = data.profitMargin || 0;
    const totalBills = data.totalBills || 0;
    const aov = data.averageOrderValue || 0;
    const cashRev = data.cashRevenue || 0;
    const finRev = data.financeRevenue || 0;
    const branchPerf = data.branchPerformance || [];
    const topProducts = data.topProducts || [];

    const bodyHtml = `
      <div style="padding:0.2rem;">
        
        <!-- Filter Controls Bar at top of Modal -->
        <div style="background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.1); padding:0.8rem 1rem; border-radius:8px; margin-bottom:1.2rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.8rem;">
            
            <!-- Quick Presets -->
            <div style="display:flex; align-items:center; gap:0.4rem; flex-wrap:wrap;">
              <span style="font-size:0.8rem; font-weight:700; color:var(--text-muted); margin-right:0.3rem;">เลือกช่วงวัน:</span>
              <button class="btn btn-sm ${startVal === todayStr && endVal === todayStr ? 'btn-primary' : 'btn-secondary'}" onclick="triggerReportPreset('today')">วันนี้</button>
              <button class="btn btn-sm btn-secondary" onclick="triggerReportPreset('7days')">7 วันล่าสุด</button>
              <button class="btn btn-sm btn-secondary" onclick="triggerReportPreset('thisMonth')">เดือนนี้</button>
              <button class="btn btn-sm btn-secondary" onclick="triggerReportPreset('lastMonth')">เดือนที่แล้ว</button>
            </div>

            <!-- Custom Date Range Form -->
            <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
              <input type="date" id="exec-modal-start" class="form-control" style="width:auto; padding:0.25rem 0.5rem; font-size:0.82rem;" value="${startVal}">
              <span style="font-size:0.8rem; color:var(--text-muted);">ถึง</span>
              <input type="date" id="exec-modal-end" class="form-control" style="width:auto; padding:0.25rem 0.5rem; font-size:0.82rem;" value="${endVal}">
              <button class="btn btn-sm btn-primary" onclick="triggerCustomReportModal()"><i class="fa-solid fa-rotate"></i> แสดงรายงาน</button>
            </div>

          </div>
        </div>

        <!-- Report Printable Content -->
        <div id="executive-printable-report">
          
          <!-- Header Sub-Info -->
          <div style="background:rgba(99,102,241,0.1); border:1px solid rgba(99,102,241,0.25); padding:0.8rem 1rem; border-radius:8px; margin-bottom:1.2rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
            <div>
              <h4 style="font-size:1.05rem; font-weight:800; color:#fff; margin-bottom:0.15rem;">
                <i class="fa-solid fa-file-invoice-dollar" style="color:var(--accent-primary);"></i> รายงานสรุปผลการดำเนินงานผู้บริหาร (Executive Performance Report)
              </h4>
              <div style="font-size:0.83rem; color:var(--text-muted);">
                ประจำช่วงวันที่: <strong style="color:#fbbf24;">${startVal}</strong> ถึง <strong style="color:#fbbf24;">${endVal}</strong>
              </div>
            </div>
            <div style="text-align:right; font-size:0.75rem; color:var(--text-muted);">
              อัปเดตล่าสุด: ${new Date().toLocaleTimeString('th-TH')}
            </div>
          </div>

          <!-- 4 KPI Cards -->
          <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap:0.8rem; margin-bottom:1.5rem;">
            
            <div style="background:rgba(16,185,129,0.12); border:1px solid rgba(16,185,129,0.3); padding:0.8rem; border-radius:8px;">
              <div style="font-size:0.78rem; color:var(--text-muted);">ยอดขายรวมสุทธิ (Total Revenue)</div>
              <div style="font-size:1.55rem; font-weight:800; color:#34d399; margin:0.2rem 0;">฿${totalRev.toLocaleString()}</div>
              <div style="font-size:0.72rem; color:var(--text-muted);">สด/โอน: ฿${cashRev.toLocaleString()} | ไฟแนนซ์: ฿${finRev.toLocaleString()}</div>
            </div>

            <div style="background:rgba(56,189,248,0.12); border:1px solid rgba(56,189,248,0.3); padding:0.8rem; border-radius:8px;">
              <div style="font-size:0.78rem; color:var(--text-muted);">กำไรขั้นต้นรวม (Gross Profit)</div>
              <div style="font-size:1.55rem; font-weight:800; color:#38bdf8; margin:0.2rem 0;">฿${totalProf.toLocaleString()}</div>
              <div style="font-size:0.72rem; color:var(--text-muted);">อัตรากำไร (Margin): <strong style="color:#34d399;">${margin.toFixed(1)}%</strong></div>
            </div>

            <div style="background:rgba(251,191,36,0.12); border:1px solid rgba(251,191,36,0.3); padding:0.8rem; border-radius:8px;">
              <div style="font-size:0.78rem; color:var(--text-muted);">จำนวนรายการขาย (Total Bills)</div>
              <div style="font-size:1.55rem; font-weight:800; color:#fbbf24; margin:0.2rem 0;">${totalBills} <span style="font-size:0.8rem;">บิล</span></div>
              <div style="font-size:0.72rem; color:var(--text-muted);">ยอดเฉลี่ยต่อบิล (AOV): ฿${Math.round(aov).toLocaleString()}</div>
            </div>

            <div style="background:rgba(129,140,248,0.12); border:1px solid rgba(129,140,248,0.3); padding:0.8rem; border-radius:8px;">
              <div style="font-size:0.78rem; color:var(--text-muted);">สัดส่วนช่องทางชำระเงิน</div>
              <div style="font-size:1.1rem; font-weight:800; color:#fff; margin:0.3rem 0;">
                สด/โอน: ${totalRev > 0 ? Math.round((cashRev/totalRev)*100) : 0}% | ไฟแนนซ์: ${totalRev > 0 ? Math.round((finRev/totalRev)*100) : 0}%
              </div>
              <div style="font-size:0.72rem; color:var(--text-muted);">ครอบคลุมทั้ง 5 สาขา</div>
            </div>

          </div>

          <!-- Branch Performance Breakdown Table -->
          <h5 style="font-size:0.95rem; font-weight:700; color:#38bdf8; margin-bottom:0.6rem; display:flex; align-items:center; gap:0.4rem;">
            <i class="fa-solid fa-store"></i> 1. สรุปผลงานและยอดขายแยกรายสาขา (5 สาขา)
          </h5>

          <div class="table-container" style="margin-bottom:1.5rem;">
            <table class="data-table" style="font-size:0.83rem;">
              <thead>
                <tr>
                  <th>รหัสสาขา / ชื่อสาขา</th>
                  <th>จำนวนบิลขาย</th>
                  <th>ยอดขายรวม (บาท)</th>
                  <th>ต้นทุนรวม (บาท)</th>
                  <th>กำไรขั้นต้น (บาท)</th>
                  <th>สัดส่วนยอดขาย</th>
                </tr>
              </thead>
              <tbody>
                ${branchPerf.length === 0 ? '<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:1.5rem;">ไม่พบข้อมูลยอดขายรายสาขาในช่วงวันที่เลือก</td></tr>' : ''}
                ${branchPerf.map(b => {
                  const pct = totalRev > 0 ? Math.round((b.revenue / totalRev) * 100) : 0;
                  return `
                    <tr>
                      <td><strong>${b.name}</strong> (${b.code})</td>
                      <td><strong style="font-size:0.95rem;">${b.bills}</strong> บิล</td>
                      <td><strong style="color:#34d399;">฿${b.revenue.toLocaleString()}</strong></td>
                      <td style="color:var(--text-muted);">฿${b.cost.toLocaleString()}</td>
                      <td><strong style="color:#38bdf8;">฿${b.profit.toLocaleString()}</strong></td>
                      <td>
                        <div style="display:flex; align-items:center; gap:0.5rem;">
                          <div style="flex:1; background:rgba(255,255,255,0.1); height:8px; border-radius:4px; overflow:hidden;">
                            <div style="width:${pct}%; background:var(--accent-primary); height:100%;"></div>
                          </div>
                          <span style="font-weight:700; width:35px; text-align:right;">${pct}%</span>
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>

          <!-- Top 10 Best Selling Products Table -->
          <h5 style="font-size:0.95rem; font-weight:700; color:#fbbf24; margin-bottom:0.6rem; display:flex; align-items:center; gap:0.4rem;">
            <i class="fa-solid fa-trophy"></i> 2. Top 10 สินค้าขายดีที่สุด (ประจำช่วงเวลา)
          </h5>

          <div class="table-container">
            <table class="data-table" style="font-size:0.83rem;">
              <thead>
                <tr>
                  <th style="width:50px; text-align:center;">อันดับ</th>
                  <th>ชื่อสินค้า</th>
                  <th>จำนวนที่ขายได้</th>
                  <th>ยอดขายรวม (บาท)</th>
                  <th>กำไรรวม (บาท)</th>
                </tr>
              </thead>
              <tbody>
                ${topProducts.length === 0 ? '<tr><td colspan="5" style="text-align:center; color:var(--text-muted); padding:1.5rem;">ไม่พบรายการขายสินค้าในช่วงวันที่เลือก</td></tr>' : ''}
                ${topProducts.map((p, idx) => `
                  <tr>
                    <td style="text-align:center;"><span class="badge badge-${idx < 3 ? 'gold' : 'gray'}" style="font-weight:800;">${idx + 1}</span></td>
                    <td><strong>${p.productName}</strong></td>
                    <td><strong style="color:#38bdf8; font-size:0.95rem;">${p.quantity} เครื่อง</strong></td>
                    <td><strong style="color:#34d399;">฿${p.revenue.toLocaleString()}</strong></td>
                    <td><strong style="color:#818cf8;">฿${p.profit.toLocaleString()}</strong></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

        </div>
      </div>
    `;

    window.lastExecutiveReportData = data;

    const footerHtml = `
      <button class="btn btn-secondary" onclick="closeModal()">ปิดหน้าต่าง</button>
      <button class="btn btn-success" onclick="exportExecutiveReportToExcel()"><i class="fa-solid fa-file-excel"></i> Export Excel</button>
      <button class="btn btn-primary" onclick="window.print()"><i class="fa-solid fa-print"></i> พิมพ์รายงาน / Export PDF</button>
    `;

    openModal(modalTitle, bodyHtml, footerHtml);
  } catch (err) {
    openModal('เกิดข้อผิดพลาด', `<p style="color:#ef4444;">${err.message}</p>`);
  }
}

function triggerReportPreset(presetKey) {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  let sDate = todayStr;
  let eDate = todayStr;

  if (presetKey === 'today') {
    sDate = todayStr;
    eDate = todayStr;
  } else if (presetKey === '7days') {
    const past7 = new Date();
    past7.setDate(now.getDate() - 6);
    sDate = past7.toISOString().split('T')[0];
    eDate = todayStr;
  } else if (presetKey === 'thisMonth') {
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    sDate = firstDay.toISOString().split('T')[0];
    eDate = todayStr;
  } else if (presetKey === 'lastMonth') {
    const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    sDate = firstDayLastMonth.toISOString().split('T')[0];
    eDate = lastDayLastMonth.toISOString().split('T')[0];
  }

  openExecutiveReportModal(sDate, eDate);
}

function triggerCustomReportModal() {
  const sDate = document.getElementById('exec-modal-start').value;
  const eDate = document.getElementById('exec-modal-end').value;

  if (!sDate || !eDate) {
    showToast('กรุณาระบุวันที่เริ่มต้นและสิ้นสุดให้ถูกต้อง', 'error');
    return;
  }

  openExecutiveReportModal(sDate, eDate);
}

/* ==========================================================================
   VIEW 1.5: BRANCH INVENTORY VIEW
   ========================================================================== */
async function renderBranchInventoryView(selectedBranchId = null) {
  const container = document.getElementById('content-container');
  container.innerHTML = `<div style="padding: 2rem; text-align: center; color: var(--text-muted);"><i class="fa-solid fa-spinner fa-spin" style="font-size:2rem;"></i> กำลังโหลดคลังสินค้าสาขา...</div>`;

  try {
    const queryParam = selectedBranchId ? `?branchId=${selectedBranchId}` : '';
    const res = await apiRequest(`/stock/my-branch${queryParam}`);
    const activeStockList = (res.stock || []).filter(st => st.status === 'in_stock');
    const currentBranch = res.branch || { name: 'สาขาประจำของคุณ' };

    const isAdminOrHq = ['admin', 'hq_stock_staff'].includes(state.user.role);

    container.innerHTML = `
      <div class="card" style="margin-bottom:1.5rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem;">
        <div>
          <h3 style="font-size:1.2rem; font-weight:700; display:flex; align-items:center; gap:0.5rem;">
            <i class="fa-solid fa-boxes-packing" style="color:var(--accent-primary);"></i> รายการสินค้าในคลัง: ${currentBranch.name}
          </h3>
          <p style="font-size:0.85rem; color:var(--text-muted);">แสดงเครื่องสินค้าพร้อมขายรายชิ้น (1 เครื่อง 1 IMEI) ในสาขานี้เท่านั้น (รวมทั้งสิ้น ${activeStockList.length} เครื่อง)</p>
        </div>

        <div style="display:flex; align-items:center; gap:0.8rem; flex-wrap:wrap;">
          <button class="btn btn-success btn-sm" onclick="exportBranchInventoryToExcel()" style="font-weight:700;"><i class="fa-solid fa-file-excel"></i> Export Excel</button>
          ${isAdminOrHq ? `
            <div style="display:flex; align-items:center; gap:0.5rem;">
              <label style="font-size:0.85rem; font-weight:600; color:var(--text-muted);">เปลี่ยนสาขา:</label>
              <select id="bi-branch-select" class="form-select" style="width:auto; font-size:0.82rem; padding:0.25rem 0.5rem;" onchange="renderBranchInventoryView(this.value)">
                ${state.masterOptions.branches ? state.masterOptions.branches.map(b => `<option value="${b._id}" ${currentBranch._id === b._id ? 'selected' : ''}>${b.name}</option>`).join('') : ''}
              </select>
            </div>
          ` : ''}
          <input type="text" id="bi-search-input" class="form-control" placeholder="ค้นหา IMEI, ชื่อสินค้า, สี..." style="width:220px; font-size:0.82rem; padding:0.25rem 0.5rem;" onkeyup="filterBranchInventoryTable()">
        </div>
      </div>

      <div class="table-container">
        <table class="data-table" id="bi-table">
          <thead>
            <tr>
              <th style="width:50px; text-align:center;">#</th>
              <th>หมายเลข IMEI</th>
              <th>รายการสินค้า</th>
              <th>ยี่ห้อ / ชื่อรุ่น</th>
              <th>ความจุ / สีสินค้า</th>
              <th>ราคาขาย</th>
              <th style="text-align:center;">สถานะสต็อก</th>
            </tr>
          </thead>
          <tbody>
            ${activeStockList.length === 0 ? `<tr><td colspan="7" style="text-align:center; color:var(--text-muted); padding:2rem;">ไม่พบรายการสินค้าคงเหลือในคลังสาขานี้</td></tr>` : ''}
            ${activeStockList.map((st, idx) => {
              const p = st.product || {};
              const imeiStr = st.imei;
              const prodName = st.productName || p.name || `${st.brand || ''} ${st.model || ''}`;
              const brandStr = st.brand || p.brand || '-';
              const modelStr = st.model || p.model || '';
              const specStr = [st.capacity || p.capacity, st.color || p.color].filter(Boolean).join(' ') || (p.variation || '-');
              const priceNum = st.selling_price || p.selling_price || 0;

              return `
                <tr class="bi-row" data-search="${(imeiStr + ' ' + prodName + ' ' + brandStr + ' ' + modelStr + ' ' + specStr).toLowerCase()}">
                  <td style="text-align:center; color:var(--text-muted); font-size:0.8rem;">${idx + 1}</td>
                  <td><strong style="color:#fbbf24; font-family:monospace; font-size:0.95rem;">${imeiStr}</strong></td>
                  <td><strong>${prodName}</strong></td>
                  <td><span class="badge badge-gray">${brandStr}</span> ${modelStr}</td>
                  <td>${specStr}</td>
                  <td><strong style="color:#34d399;">฿${priceNum.toLocaleString()}</strong></td>
                  <td style="text-align:center;"><span class="badge badge-green">1 เครื่อง (พร้อมขาย)</span></td>
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
    const stockList = (res.stock || []).filter(st => st.status === 'in_stock');
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
                <p style="font-size:0.8rem; color:var(--text-muted);">เลือกสินค้าตามหมายเลข IMEI เพื่อเพิ่มลงตะกร้าขาย</p>
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
              <input type="text" id="pos-barcode-input" class="form-control" placeholder="สแกน หรือ พิมพ์หมายเลข IMEI แล้วกด Enter..." style="margin-top:0.4rem;" autofocus>
            </div>

            <input type="text" id="pos-search-input" class="form-control" placeholder="ค้นหาชื่อสินค้า, IMEI, ยี่ห้อ หรือ รุ่น..." onkeyup="filterPosCatalogTable()" style="margin-bottom:1rem;">

            <!-- Stock Product Table -->
            <div class="table-container" style="max-height:450px; overflow-y:auto;">
              <table class="data-table" id="pos-catalog-table">
                <thead>
                  <tr>
                    <th style="width:40px; text-align:center;">ไอคอน</th>
                    <th>รายการสินค้า</th>
                    <th>หมายเลข IMEI</th>
                    <th>ราคาขาย</th>
                    <th>สถานะ</th>
                    <th style="text-align:center;">ดำเนินการ</th>
                  </tr>
                </thead>
                <tbody>
                  ${stockList.length === 0 ? `<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:2rem;">ไม่พบสินค้าพร้อมขายในสาขานี้</td></tr>` : ''}
                  ${stockList.map((st, idx) => {
                    const p = st.product || {};
                    const imei = st.imei;
                    const productName = st.productName || p.name || `${st.brand || ''} ${st.model || ''}`.trim() || 'สินค้าสมาร์ทโฟน';
                    const sellingPrice = st.selling_price || p.selling_price || 0;
                    const brandStr = st.brand || p.brand || '-';
                    const specStr = [st.capacity || p.capacity, st.color || p.color].filter(Boolean).join(' ');

                    return `
                      <tr class="pos-item-row" data-search="${(imei + ' ' + productName + ' ' + brandStr + ' ' + specStr).toLowerCase()}">
                        <td style="text-align:center; font-size:1.3rem; color:var(--accent-primary);">
                          <i class="fa-solid fa-mobile-screen-button"></i>
                        </td>
                        <td>
                          <strong>${productName}</strong><br>
                          <span style="font-size:0.75rem; color:var(--text-muted);">${brandStr} ${specStr ? '• ' + specStr : ''}</span>
                        </td>
                        <td><strong style="color:#fbbf24; font-family:monospace; font-size:0.92rem;">${imei}</strong></td>
                        <td><strong style="color:#34d399;">฿${sellingPrice.toLocaleString()}</strong></td>
                        <td>
                          <span class="badge badge-green">
                            <i class="fa-solid fa-circle-check"></i> พร้อมขาย
                          </span>
                        </td>
                        <td style="text-align:center;">
                          <button class="btn btn-primary btn-sm" onclick="addToPosCart('${p._id || ''}', '${productName.replace(/'/g, "\\'")}', ${sellingPrice}, null, '${imei}')">
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
                <option value="finance">ผ่อน / จัดไฟแนนซ์ (Financing)</option>
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

            <div id="pos-finance-container" style="display:none; margin-bottom:1rem; background:rgba(192,132,252,0.1); border:1px solid rgba(192,132,252,0.3); padding:0.8rem; border-radius:6px;">
              <label for="pos-finance-company" style="font-size:0.82rem; font-weight:700; color:#c084fc;">
                <i class="fa-solid fa-file-contract"></i> ชื่อบริษัทไฟแนนซ์ / สถาบันการเงิน (จำเป็น)
              </label>
              <input type="text" id="pos-finance-company" class="form-control" placeholder="เช่น SG Capital, AEON, KB J Capital ฯลฯ" style="margin-top:0.4rem;" value="Banana">
              <span style="font-size:0.75rem; color:var(--text-muted); display:block; margin-top:0.3rem;">* รายการขายจัดไฟแนนซ์จะเข้าสู่สถานะ "รอรับเงินจากไฟแนนซ์" ในเมนูการเงิน</span>
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
  const foundItem = stockList.find(st => st.imei === scannedImei && st.status === 'in_stock');

  if (foundItem) {
    const p = foundItem.product || {};
    const prodName = foundItem.productName || p.name || 'สินค้า';
    const price = foundItem.selling_price || p.selling_price || 0;

    addToPosCart(
      p._id || '',
      prodName,
      price,
      null,
      foundItem.imei
    );
    showToast(`สแกนแมตช์สำเร็จ: เพิ่ม IMEI ${foundItem.imei} ลงตะกร้าเรียบร้อยแล้ว`);
  } else {
    showToast(`ไม่พบหมายเลข IMEI ${scannedImei} ที่พร้อมขายในคลังสาขานี้`, 'error');
  }
}

function addToPosCart(productId, productName, unitPrice, selectIdx = null, customImei = null) {
  let targetImei = customImei;
  if (!targetImei && selectIdx !== null) {
    const selectEl = document.getElementById(`pos-imei-select-${selectIdx}`);
    if (selectEl) targetImei = selectEl.value;
  }

  // Check if item with same IMEI already in cart
  const existing = state.posCart.find(item => item.imei === targetImei);
  if (existing) {
    showToast(`รายการสินค้า IMEI ${targetImei} อยู่ในตะกร้าเรียบร้อยแล้ว`, 'error');
    return;
  }

  state.posCart.push({
    productId,
    productName,
    imei: targetImei || '',
    unitPrice: Number(unitPrice),
    quantity: 1,
    discount: 0,
    totalPrice: Number(unitPrice)
  });

  showToast(`เพิ่ม "${productName}" (IMEI: ${targetImei}) ลงตะกร้าสำเร็จ`);
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
          <span style="font-size:0.75rem; color:var(--text-muted);">IMEI: ${item.imei || '-'}</span>
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
  const financeContainer = document.getElementById('pos-finance-container');

  if (cashContainer) {
    if (paymentVal === 'cash') {
      cashContainer.style.display = 'grid';
    } else {
      cashContainer.style.display = 'none';
    }
  }

  if (financeContainer) {
    if (paymentVal === 'finance') {
      financeContainer.style.display = 'block';
    } else {
      financeContainer.style.display = 'none';
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
  const financeCompanyName = document.getElementById('pos-finance-company') ? document.getElementById('pos-finance-company').value : '';

  const subtotal = state.posCart.reduce((sum, i) => sum + i.totalPrice, 0);
  const grandTotal = Math.max(0, subtotal - discountTotal);

  if (paymentMethod === 'cash' && receivedAmount < grandTotal) {
    showToast(`จำนวนเงินสดที่รับมา (฿${receivedAmount}) น้อยกว่ายอดที่ต้องชำระ (฿${grandTotal})`, 'error');
    return;
  }

  if (paymentMethod === 'finance' && !financeCompanyName.trim()) {
    showToast('กรุณาระบุชื่อบริษัทไฟแนนซ์ / สถาบันการเงินที่จัดไฟแนนซ์', 'error');
    return;
  }

  try {
    const res = await apiRequest('/pos/checkout', 'POST', {
      branchId,
      customer: { name: custName, phone: custPhone },
      items: state.posCart,
      paymentMethod,
      financeCompanyName,
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
                <span style="font-size:0.72rem; color:#555;">IMEI: ${i.imei}</span>
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
          <span>ชำระโดย: <strong>${sale.paymentMethod === 'cash' ? 'เงินสด (Cash)' : sale.paymentMethod === 'transfer' ? 'โอนเงิน / QR' : sale.paymentMethod === 'credit_card' ? 'บัตรเครดิต' : 'จัดไฟแนนซ์ (' + (sale.financeDetails ? sale.financeDetails.companyName : 'ไฟแนนซ์') + ')'}</strong></span>
          <span>${sale.paymentMethod === 'finance' ? 'รอรับเงินไฟแนนซ์' : 'รับเงิน: ฿' + (sale.receivedAmount || 0).toLocaleString() + ' | เงินทอน: ฿' + (sale.changeAmount || 0).toLocaleString()}</span>
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
   VIEW 1.3: SALES PROFIT & FINANCE REPORT VIEW
   ========================================================================== */
async function renderFinanceView(filterParams = {}) {
  const container = document.getElementById('content-container');
  container.innerHTML = `<div style="padding: 2rem; text-align: center; color: var(--text-muted);"><i class="fa-solid fa-spinner fa-spin" style="font-size:2rem;"></i> กำลังโหลดรายงานการเงินและกำไรจากการขาย...</div>`;

  try {
    const queryParams = new URLSearchParams(filterParams).toString();
    const res = await apiRequest(`/pos/finance-report?${queryParams}`);
    const summary = res.summary || {};
    const sales = res.sales || [];

    const isAdminOrHq = ['admin', 'hq_stock_staff', 'purchase_staff'].includes(state.user.role);

    container.innerHTML = `
      <!-- Summary Cards -->
      <div class="grid-cards" style="grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:1rem; margin-bottom:1.5rem;">
        <div class="card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">
            <span style="color: var(--text-muted); font-size: 0.82rem; font-weight:600;">รายได้ & กำไรสุทธิรวม</span>
            <i class="fa-solid fa-coins" style="color: var(--accent-gold); font-size:1.3rem;"></i>
          </div>
          <div style="font-size: 1.8rem; font-weight:800; color:#34d399;">฿${(summary.totalProfit || 0).toLocaleString()}</div>
          <p style="font-size: 0.8rem; color: var(--text-muted); margin-top:0.2rem;">
            ยอดขายรวม: ฿${(summary.totalRevenue || 0).toLocaleString()} (ทุนรวม: ฿${(summary.totalCost || 0).toLocaleString()})
          </p>
        </div>

        <div class="card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">
            <span style="color: var(--text-muted); font-size: 0.82rem; font-weight:600;">กำไรขายสด / โอน / บัตร</span>
            <i class="fa-solid fa-money-bill-wave" style="color: var(--accent-primary); font-size:1.3rem;"></i>
          </div>
          <div style="font-size: 1.8rem; font-weight:800;">฿${(summary.cashProfit || 0).toLocaleString()}</div>
          <p style="font-size: 0.8rem; color: var(--text-muted); margin-top:0.2rem;">
            ยอดขายสดรวม: ฿${(summary.cashRevenue || 0).toLocaleString()}
          </p>
        </div>

        <div class="card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">
            <span style="color: var(--text-muted); font-size: 0.82rem; font-weight:600;">กำไรขายจัดไฟแนนซ์</span>
            <i class="fa-solid fa-file-contract" style="color: #c084fc; font-size:1.3rem;"></i>
          </div>
          <div style="font-size: 1.8rem; font-weight:800; color:#c084fc;">฿${(summary.financeProfit || 0).toLocaleString()}</div>
          <p style="font-size: 0.8rem; color: var(--text-muted); margin-top:0.2rem;">
            ยอดขายไฟแนนซ์รวม: ฿${(summary.financeRevenue || 0).toLocaleString()}
          </p>
        </div>

        <div class="card" style="border: 1px solid ${summary.pendingFinanceCount > 0 ? '#fbbf24' : 'rgba(255,255,255,0.1)'};">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">
            <span style="color: var(--text-muted); font-size: 0.82rem; font-weight:600;">ยอดกำไรที่รอรับจากไฟแนนซ์</span>
            <i class="fa-solid fa-clock-rotate-left" style="color: #fbbf24; font-size:1.3rem;"></i>
          </div>
          <div style="font-size: 1.8rem; font-weight:800; color:#fbbf24;">฿${(summary.pendingFinanceAmount || 0).toLocaleString()}</div>
          <p style="font-size: 0.8rem; color: #fbbf24; margin-top:0.2rem; font-weight:600;">
            ${summary.pendingFinanceCount || 0} รายการรอรับเงินกำไรจากไฟแนนซ์
          </p>
        </div>
      </div>

      <!-- Filter Controls -->
      <div class="card" style="margin-bottom:1.5rem;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem;">
          <h3 style="font-size:1.1rem; font-weight:700; display:flex; align-items:center; gap:0.5rem;">
            <i class="fa-solid fa-filter" style="color:var(--accent-primary);"></i> กรองข้อมูลรายงานการเงิน
          </h3>
          
          <div style="display:flex; flex-wrap:wrap; align-items:center; gap:0.8rem;">
            ${isAdminOrHq ? `
              <div>
                <label style="font-size:0.78rem; font-weight:600; color:var(--text-muted);">สาขา:</label>
                <select id="fin-branch-filter" class="form-select" style="width:auto; padding:0.3rem 0.6rem; font-size:0.82rem;">
                  <option value="">-- ทุกสาขา --</option>
                  ${state.masterOptions.branches ? state.masterOptions.branches.map(b => `<option value="${b._id}" ${filterParams.branchId === b._id ? 'selected' : ''}>${b.name}</option>`).join('') : ''}
                </select>
              </div>
            ` : ''}

            <div>
              <label style="font-size:0.78rem; font-weight:600; color:var(--text-muted);">การชำระเงิน:</label>
              <select id="fin-payment-filter" class="form-select" style="width:auto; padding:0.3rem 0.6rem; font-size:0.82rem;">
                <option value="">-- ทั้งหมด --</option>
                <option value="cash" ${filterParams.paymentMethod === 'cash' ? 'selected' : ''}>เงินสด</option>
                <option value="transfer" ${filterParams.paymentMethod === 'transfer' ? 'selected' : ''}>โอนเงิน</option>
                <option value="credit_card" ${filterParams.paymentMethod === 'credit_card' ? 'selected' : ''}>บัตรเครดิต</option>
                <option value="finance" ${filterParams.paymentMethod === 'finance' ? 'selected' : ''}>จัดไฟแนนซ์</option>
              </select>
            </div>

            <div>
              <label style="font-size:0.78rem; font-weight:600; color:var(--text-muted);">สถานะไฟแนนซ์:</label>
              <select id="fin-payout-filter" class="form-select" style="width:auto; padding:0.3rem 0.6rem; font-size:0.82rem;">
                <option value="">-- ทั้งหมด --</option>
                <option value="pending_payout" ${filterParams.payoutStatus === 'pending_payout' ? 'selected' : ''}>รอรับเงินจากไฟแนนซ์</option>
                <option value="received" ${filterParams.payoutStatus === 'received' ? 'selected' : ''}>รับเงินแล้ว</option>
              </select>
            </div>

            <button class="btn btn-primary btn-sm" onclick="applyFinanceFilters()">
              <i class="fa-solid fa-magnifying-glass"></i> ค้นหา
            </button>
          </div>
        </div>
      </div>

      <!-- Finance Sales Table -->
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>เลขที่ใบเสร็จ / วันเวลา</th>
              <th>สาขา & ลูกค้า</th>
              <th>รายการสินค้า (IMEI)</th>
              <th>ช่องทางชำระเงิน</th>
              <th>ราคาต้นทุน (บาท)</th>
              <th>ราคาขาย (บาท)</th>
              <th>กำไรสุทธิ (บาท)</th>
              <th style="text-align:center;">สถานะรับเงินกำไรไฟแนนซ์</th>
            </tr>
          </thead>
          <tbody>
            ${sales.length === 0 ? `<tr><td colspan="8" style="text-align:center; color:var(--text-muted); padding:2rem;">ไม่พบรายการขายในเงื่อนไขที่เลือก</td></tr>` : ''}
            ${sales.map(s => {
              const itemsStr = (s.items || []).map(i => `${i.productName} (${i.imei})`).join('<br>');
              const isFinance = s.paymentMethod === 'finance';
              const finDetails = s.financeDetails || {};
              const isPending = isFinance && finDetails.payoutStatus === 'pending_payout';

              let costTotal = s.totalCost || 0;
              if (!costTotal && s.items) {
                costTotal = s.items.reduce((sum, item) => sum + ((item.costPrice || 0) * (item.quantity || 1)), 0);
              }
              const profitTotal = s.totalProfit !== undefined ? s.totalProfit : (s.grandTotal - costTotal);

              return `
                <tr>
                  <td>
                    <strong>${s.receiptNumber}</strong><br>
                    <span style="font-size:0.78rem; color:var(--text-muted);">${new Date(s.createdAt).toLocaleString('th-TH')}</span>
                  </td>
                  <td>
                    <strong>${s.branch ? s.branch.name : 'สาขาทั่วไป'}</strong><br>
                    <span style="font-size:0.78rem; color:var(--text-muted);">ลูกค้า: ${s.customer ? s.customer.name : 'ทั่วไป'}</span>
                  </td>
                  <td style="font-size:0.82rem;">${itemsStr}</td>
                  <td>
                    ${s.paymentMethod === 'cash' ? '<span class="badge badge-green">เงินสด</span>' :
                      s.paymentMethod === 'transfer' ? '<span class="badge badge-blue">โอนเงิน</span>' :
                      s.paymentMethod === 'credit_card' ? '<span class="badge badge-gray">บัตรเครดิต</span>' :
                      `<span class="badge badge-gold"><i class="fa-solid fa-file-contract"></i> จัดไฟแนนซ์ (${finDetails.companyName || 'ไฟแนนซ์'})</span>`}
                  </td>
                  <td>฿${costTotal.toLocaleString()}</td>
                  <td>฿${s.grandTotal.toLocaleString()}</td>
                  <td><strong style="color:#34d399; font-size:0.95rem;">฿${profitTotal.toLocaleString()}</strong></td>
                  <td style="text-align:center;">
                    ${isFinance ? `
                      ${isPending ? `
                        <span class="badge badge-yellow" style="margin-bottom:0.3rem;"><i class="fa-solid fa-clock"></i> รอรับเงินกำไรจากไฟแนนซ์</span><br>
                        <button class="btn btn-success btn-sm" style="padding:0.25rem 0.6rem; font-size:0.78rem;" onclick="openRecordFinancePayoutModal('${s._id}', '${s.receiptNumber}', ${profitTotal}, '${(finDetails.companyName || '').replace(/'/g, "\\'")}')">
                          <i class="fa-solid fa-calendar-check"></i> บันทึกรับเงินกำไร (฿${profitTotal.toLocaleString()})
                        </button>
                      ` : `
                        <span class="badge badge-green"><i class="fa-solid fa-circle-check"></i> รับเงินกำไรแล้ว</span><br>
                        <span style="font-size:0.75rem; color:var(--text-muted);">
                          วันที่รับ: ${finDetails.payoutReceivedDate ? new Date(finDetails.payoutReceivedDate).toLocaleDateString('th-TH') : '-'}
                        </span>
                      `}
                    ` : `<span style="color:var(--text-muted); font-size:0.8rem;">- (รับเงินสดแล้ว) -</span>`}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div style="color:#ef4444; padding:2rem;">เกิดข้อผิดพลาดในการโหลดรายงานการเงิน: ${err.message}</div>`;
  }
}

function applyFinanceFilters() {
  const branchSelect = document.getElementById('fin-branch-filter');
  const paymentSelect = document.getElementById('fin-payment-filter');
  const payoutSelect = document.getElementById('fin-payout-filter');

  const filterParams = {};
  if (branchSelect && branchSelect.value) filterParams.branchId = branchSelect.value;
  if (paymentSelect && paymentSelect.value) filterParams.paymentMethod = paymentSelect.value;
  if (payoutSelect && payoutSelect.value) filterParams.payoutStatus = payoutSelect.value;

  renderFinanceView(filterParams);
}

function openRecordFinancePayoutModal(saleId, receiptNumber, amount, companyName) {
  const bodyHtml = `
    <div style="background:rgba(0,0,0,0.2); padding:1rem; border-radius:6px; margin-bottom:1.2rem;">
      <div style="display:flex; justify-content:space-between; margin-bottom:0.4rem; font-size:0.88rem;">
        <span>เลขที่ใบเสร็จ: <strong>${receiptNumber}</strong></span>
        <span>บริษัทไฟแนนซ์: <strong style="color:var(--accent-gold);">${companyName || 'จัดไฟแนนซ์'}</strong></span>
      </div>
      <div style="display:flex; justify-content:space-between; font-size:1.1rem; font-weight:800; color:#34d399;">
        <span>ยอดเงินกำไรที่รอรับจากไฟแนนซ์:</span>
        <span>฿${Number(amount).toLocaleString()}</span>
      </div>
    </div>

    <form id="record-payout-form" onsubmit="event.preventDefault(); submitFinancePayoutReceived('${saleId}');">
      <div class="form-group">
        <label for="fp-received-date" style="color:#fbbf24; font-weight:700;">
          <i class="fa-solid fa-calendar-days"></i> ระบุวันที่ ที่รับเงินจากไฟแนนซ์จริง (จำเป็นต้องเลือก)
        </label>
        <input type="date" id="fp-received-date" class="form-control" value="" required onclick="if(this.showPicker) this.showPicker();" style="cursor:pointer; font-weight:700;">
        <span style="font-size:0.75rem; color:var(--text-muted); display:block; margin-top:0.3rem;">* กดที่ช่องเพื่อแสดงปฏิทินและเลือกวันที่รับเงินจริง</span>
      </div>

      <div class="form-group">
        <label for="fp-remarks">หมายเหตุ / เลขที่โอนเงินจากไฟแนนซ์ (ถ้ามี)</label>
        <textarea id="fp-remarks" class="form-control" rows="2" placeholder="เช่น โอนเงินเข้าบัญชีบริษัทเรียบร้อยแล้ว"></textarea>
      </div>
    </form>
  `;

  const footerHtml = `
    <button class="btn btn-secondary" onclick="closeModal()">ยกเลิก</button>
    <button class="btn btn-success" onclick="submitFinancePayoutReceived('${saleId}')"><i class="fa-solid fa-check-double"></i> ยืนยันบันทึกรับเงินจากไฟแนนซ์</button>
  `;

  openModal(`บันทึกรับเงินจากไฟแนนซ์: ${receiptNumber}`, bodyHtml, footerHtml);
}

async function submitFinancePayoutReceived(saleId) {
  const dateInput = document.getElementById('fp-received-date');
  const payoutReceivedDate = dateInput ? dateInput.value.trim() : '';
  const payoutRemarks = document.getElementById('fp-remarks') ? document.getElementById('fp-remarks').value : '';

  if (!payoutReceivedDate) {
    showToast('กรุณาระบุและเลือกวันที่รับเงินจากไฟแนนซ์จริงก่อนกดบันทึก', 'error');
    if (dateInput) {
      dateInput.focus();
      if (dateInput.showPicker) dateInput.showPicker();
    }
    return;
  }

  try {
    const res = await apiRequest(`/pos/finance-payout/${saleId}`, 'PUT', {
      payoutReceivedDate,
      payoutRemarks
    });

    if (res.success) {
      showToast(res.message);
      closeModal();
      renderFinanceView();
    }
  } catch (err) {
    // Handled
  }
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
          เมื่อเพิ่มแล้ว ตัวเลือกจะประกอบเป็น <strong>ชื่อสินค้าแบบเต็ม</strong> ให้ทันที
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
        <button class="btn btn-success btn-sm" onclick="exportBranchAuditToExcel()"><i class="fa-solid fa-file-excel"></i> Export Excel</button>
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
          </div>
          <span class="badge badge-${b.colorCode}">
            <i class="fa-solid ${b.colorCode === 'green' ? 'fa-circle-check' : b.colorCode === 'red' ? 'fa-circle-exclamation' : b.colorCode === 'yellow' ? 'fa-clock' : 'fa-minus'}"></i>
            ${b.status}
          </span>
        </div>

        <div class="audit-stats">
          <div class="stat-item">
            <div class="stat-val">${b.totalExpected}</div>
            <div class="stat-lbl">จำนวนสินค้า</div>
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
          <button class="btn btn-secondary btn-sm" style="flex:1;" onclick="inspectBranchAudit('${b.branch.id}')">
            <i class="fa-solid fa-magnifying-glass"></i> ตรวจสอบรายละเอียดสต็อก
          </button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    gridContainer.innerHTML = `<div style="color:#ef4444; grid-column: 1/-1;">เกิดข้อผิดพลาดในการโหลดแดชบอร์ดส่วนกลาง: ${err.message}</div>`;
  }
}

async function inspectBranchAudit(targetId) {
  window.currentInspectedAuditId = targetId;
  openModal('กำลังโหลดรายละเอียดการนับสต็อก...', '<div style="padding:2rem; text-align:center;"><i class="fa-solid fa-spinner fa-spin fa-2x"></i></div>');

  try {
    const todayStr = document.getElementById('hq-audit-date-picker') ? document.getElementById('hq-audit-date-picker').value : new Date().toISOString().split('T')[0];
    const res = await apiRequest(`/audit/dashboard?date=${todayStr}`);
    const branchItem = res.summary.branches.find(b => b.auditId === targetId || b.branch.id === targetId);

    if (!branchItem) {
      openModal('เกิดข้อผิดพลาด', '<p style="color:#ef4444;">ไม่พบข้อมูลการนับสต็อก</p>');
      return;
    }

    const items = (branchItem.items || []).filter(item => (item.expectedCount > 0 || item.actualCount > 0));

    if (!window.hqAuditInspectionState || window.hqAuditInspectionState.auditId !== targetId) {
      window.hqAuditInspectionState = {
        auditId: targetId,
        branchId: branchItem.branch.id,
        items,
        viewedPhotos: new Set(),
        verifiedImeis: new Set(),
        failedImeis: new Set(),
        resubmitImeis: new Set(),
        requiredPhotoImeis: new Set(),
        allScannedImeis: new Set()
      };
    } else {
      window.hqAuditInspectionState.items = items;
      window.hqAuditInspectionState.branchId = branchItem.branch.id;
    }

    items.forEach(item => {
      (item.imeiDecisions || []).forEach(d => {
        if (d.decision === 'passed') {
          window.hqAuditInspectionState.verifiedImeis.add(d.imei);
        } else if (d.decision === 'failed') {
          window.hqAuditInspectionState.failedImeis.add(d.imei);
        } else if (d.decision === 'resubmit') {
          window.hqAuditInspectionState.resubmitImeis.add(d.imei);
        }
      });

      (item.scannedImeis || []).forEach(imei => {
        window.hqAuditInspectionState.allScannedImeis.add(imei);
        const imgObj = (item.imeiImages || []).find(img => img.imei === imei);
        if (imgObj && (imgObj.url || imgObj.fileId)) {
          window.hqAuditInspectionState.requiredPhotoImeis.add(imei);
        }
      });
    });

    const bodyHtml = `
      <div style="margin-bottom: 1rem; background:rgba(99,102,241,0.1); border:1px solid rgba(99,102,241,0.3); padding:0.8rem; border-radius:6px;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; margin-bottom:0.3rem;">
          <h4 style="font-size:1.15rem; font-weight:700; color:#fff;">${branchItem.branch.name} (${branchItem.branch.code})</h4>
          <span class="badge badge-${branchItem.colorCode}">${branchItem.status}</span>
        </div>
        <div style="font-size:0.8rem; color:#38bdf8; line-height:1.4;">
          <i class="fa-solid fa-circle-info"></i> กดปุ่ม <strong>"ตรวจสอบรูป & ลงความเห็น"</strong> ในแต่ละเครื่อง เพื่อดูรูปถ่ายจาก Google Drive และเลือกลงความเห็น (ผ่าน / ไม่ผ่าน / ส่งตรวจใหม่)
        </div>
      </div>

      <div class="table-container" style="margin-bottom:1.2rem;">
        <table class="data-table">
          <thead>
            <tr>
              <th>ชื่อสินค้า</th>
              <th>จำนวนสินค้า</th>
              <th>จำนวนนับจริง</th>
              <th>ยอดที่ขาด/เกิน</th>
              <th>รายการ IMEI ที่สแกน & ผลการตรวจสอบรูปถ่าย</th>
            </tr>
          </thead>
          <tbody>
            ${items.length === 0 ? `<tr><td colspan="5" style="text-align:center; color:var(--text-muted); padding:2rem;">ไม่พบรายการสินค้าที่มีคงคลังในสาขานี้</td></tr>` : ''}
            ${items.map(item => {
              const scannedImeis = item.scannedImeis || [];
              const imeiImages = item.imeiImages || [];

              return `
                <tr>
                  <td>
                    <strong style="color:#38bdf8;">${item.productName}</strong><br>
                    <span style="font-size:0.8rem; color:var(--text-muted);">${item.productName}</span>
                  </td>
                  <td><strong style="font-size:1.1rem;">${item.expectedCount}</strong></td>
                  <td><strong style="font-size:1.1rem; color:#38bdf8;">${item.actualCount}</strong></td>
                  <td style="color: ${item.variance === 0 ? '#34d399' : '#f87171'}; font-weight:700;">
                    ${item.variance === 0 ? '<span class="badge badge-green">ตรง (0)</span>' : item.variance > 0 ? `<span class="badge badge-yellow">เกิน +${item.variance}</span>` : `<span class="badge badge-red">ขาด ${item.variance}</span>`}
                  </td>
                  <td style="font-size:0.8rem;">
                    ${scannedImeis.length > 0 ? `
                      <div style="display:flex; flex-direction:column; gap:0.4rem;">
                        ${scannedImeis.map(imei => {
                          const imgObj = imeiImages.find(img => img.imei === imei);
                          const imgUrl = resolveDriveImageUrl(imgObj);
                          const isPassed = window.hqAuditInspectionState.verifiedImeis.has(imei);
                          const isFailed = window.hqAuditInspectionState.failedImeis.has(imei);
                          const isResubmit = window.hqAuditInspectionState.resubmitImeis.has(imei);

                          return `
                            <div style="background:rgba(0,0,0,0.3); border:1px solid ${isPassed ? '#34d399' : isFailed ? '#f87171' : isResubmit ? '#fbbf24' : 'rgba(255,255,255,0.1)'}; padding:0.5rem 0.8rem; border-radius:6px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.6rem;">
                              <div style="display:flex; align-items:center; gap:0.8rem;">
                                <div>
                                  <div style="font-weight:700; color:#fff; font-family:monospace; font-size:0.95rem;">${imei}</div>
                                  <div style="margin-top:0.2rem;">
                                    ${isPassed ? '<span class="badge badge-green"><i class="fa-solid fa-circle-check"></i> ผ่าน (Pass)</span>' :
                                      isFailed ? '<span class="badge badge-red"><i class="fa-solid fa-circle-xmark"></i> ไม่ผ่าน</span>' :
                                      isResubmit ? '<span class="badge badge-yellow"><i class="fa-solid fa-rotate-left"></i> ให้ส่งตรวจใหม่</span>' :
                                      '<span class="badge badge-gray">(ยังไม่ได้ตรวจ)</span>'}
                                  </div>
                                </div>
                              </div>

                              <div>
                                <button class="btn btn-sm btn-primary" onclick="openImeiInspectionModal('${imei}')" style="font-size:0.75rem; padding:0.35rem 0.75rem;">
                                  <i class="fa-solid fa-magnifying-glass"></i> ตรวจสอบรูป & ลงความเห็น
                                </button>
                              </div>
                            </div>
                          `;
                        }).join('')}
                      </div>
                    ` : '<span style="color:var(--text-muted); font-style:italic;">ยังไม่มีรายการสแกน</span>'}

                    ${item.missingImeis && item.missingImeis.length > 0 ? `<div style="color:#f87171; margin-top:0.4rem; font-size:0.78rem;"><strong>IMEI ที่ยังไม่ได้สแกน:</strong> ${item.missingImeis.join(', ')}</div>` : ''}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;

    const isHqUser = ['admin', 'hq_stock_staff'].includes(state.user ? state.user.role : '');
    const auditId = branchItem.auditId;

    const footerHtml = `
      ${isHqUser && auditId ? `
        <button class="btn btn-danger" onclick="submitHqAuditDecision('${auditId}', 'Reject')" style="margin-right:auto;">
          <i class="fa-solid fa-xmark"></i> ปฏิเสธรายงาน (ข้อมูลไม่ตรง)
        </button>
        <button class="btn btn-success" onclick="submitHqAuditDecision('${auditId}', 'Verify')">
          <i class="fa-solid fa-check-double"></i> อนุมัติรายงานการนับสต็อก (Verify)
        </button>
      ` : ''}
      <button class="btn btn-secondary" onclick="closeModal()">ปิดหน้าต่าง</button>
    `;

    openModal(`ตรวจสอบการนับสต็อก - ${branchItem.branch.name}`, bodyHtml, footerHtml);
  } catch (err) {
    openModal('เกิดข้อผิดพลาด', `<p style="color:#ef4444;">${err.message}</p>`);
  }
}

async function submitHqAuditDecision(auditId, action) {
  if (!auditId) {
    showToast('สาขานี้ยังไม่ได้ส่งรายงานการนับสต็อก', 'warning');
    return;
  }

  const comments = prompt(action === 'Verify' ? 'ระบุหมายเหตุการอนุมัติ (ถ้ามี):' : 'ระบุเหตุผลการปฏิเสธ / ข้อมูลไม่ตรง:');
  if (comments === null) return;

  try {
    const res = await apiRequest(`/audit/verify/${auditId}`, 'POST', { action, comments });
    if (res.success) {
      showToast(res.message);
      closeModal();
      const datePicker = document.getElementById('hq-audit-date-picker');
      const dateStr = datePicker ? datePicker.value : new Date().toISOString().split('T')[0];
      loadHqAuditGrid(dateStr);
    }
  } catch (err) {
    // Handled
  }
}

function resolveDriveImageUrl(imgObj) {
  if (!imgObj) return '';
  let fileId = '';
  if (typeof imgObj === 'object') {
    if (imgObj.fileId) fileId = imgObj.fileId;
    else imgObj = imgObj.url || imgObj.webViewLink || imgObj.webContentLink || '';
  }
  if (!fileId && typeof imgObj === 'string') {
    const match = String(imgObj).match(/\/d\/([a-zA-Z0-9_-]+)/) || String(imgObj).match(/id=([a-zA-Z0-9_-]+)/) || String(imgObj).match(/\/drive-image\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      fileId = match[1];
    } else if (imgObj.startsWith('/api/audit/drive-image/')) {
      return imgObj;
    }
  }

  if (fileId) {
    return `/api/audit/drive-image/${fileId}`;
  }
  return String(imgObj || '');
}

function openImeiInspectionModal(imei) {
  if (window.hqAuditInspectionState) {
    window.hqAuditInspectionState.viewedPhotos.add(imei);
  }

  let productName = 'สินค้าในสต็อก';
  let imgObj = null;

  if (window.hqAuditInspectionState && window.hqAuditInspectionState.items) {
    const matchedItem = window.hqAuditInspectionState.items.find(i => i.scannedImeis.includes(imei));
    if (matchedItem) {
      productName = matchedItem.productName;
      imgObj = (matchedItem.imeiImages || []).find(img => img.imei === imei);
    }
  }

  const imgUrl = resolveDriveImageUrl(imgObj);

  let fileId = '';
  if (imgObj && imgObj.fileId) {
    fileId = imgObj.fileId;
  } else if (imgUrl) {
    const match = String(imgUrl).match(/\/drive-image\/([a-zA-Z0-9_-]+)/) || String(imgUrl).match(/\/d\/([a-zA-Z0-9_-]+)/) || String(imgUrl).match(/id=([a-zA-Z0-9_-]+)/);
    if (match && match[1]) fileId = match[1];
  }

  const targetDriveUrl = fileId ? `https://drive.google.com/file/d/${fileId}/view` : (imgObj ? imgObj.webViewLink || imgUrl : imgUrl);

  const bodyHtml = `
    <div style="background:rgba(0,0,0,0.2); padding:1rem; border-radius:6px; margin-bottom:1.2rem; text-align:center;">
      <div style="font-weight:800; font-size:1.15rem; color:#38bdf8; margin-bottom:0.2rem;">
        <i class="fa-solid fa-barcode"></i> หมายเลข IMEI / ซีเรียล: <span style="color:#fbbf24; font-family:monospace;">${imei}</span>
      </div>
      <div style="font-size:0.88rem; color:#fff;">
        สินค้า: <strong>${productName || 'สินค้าในสต็อก'}</strong> (IMEI: ${imei})
      </div>
    </div>

    <!-- Center Photo Display -->
    <div style="text-align:center; background:rgba(0,0,0,0.4); padding:1.2rem; border-radius:8px; margin-bottom:1.5rem; border:1px solid rgba(255,255,255,0.1); display:flex; justify-content:center; align-items:center; min-height:240px;">
      ${imgUrl ? `
        <div style="width:100%; text-align:center;">
          <div style="position:relative; display:inline-block; cursor:pointer;" onclick="window.open('${targetDriveUrl.replace(/'/g, "\\'")}', '_blank')" title="แตะเพื่อเปิดดูลิงก์รูปภาพเต็มใน Google Drive (แท็บใหม่)">
            <img src="${imgUrl}" style="max-height:360px; max-width:100%; border-radius:8px; border:2px solid var(--accent-gold); box-shadow:0 6px 20px rgba(0,0,0,0.6); transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'" onerror="this.onerror=null; ${fileId ? `this.src='https://drive.google.com/thumbnail?id=${fileId}&sz=w1000';` : `document.getElementById('no-img-text-${imei}').style.display='block';`}">
            <div style="position:absolute; bottom:12px; right:12px; background:rgba(0,0,0,0.85); color:#fbbf24; padding:0.3rem 0.7rem; border-radius:6px; font-size:0.78rem; border:1px solid rgba(251,191,36,0.6); pointer-events:none; font-weight:700;">
              <i class="fa-solid fa-up-right-from-square"></i> แตะเพื่อเปิดลิงก์รูปภาพ
            </div>
          </div>
          <div id="no-img-text-${imei}" style="display:none; color:var(--text-muted); padding:1.5rem; font-style:italic;">
            (ไม่สามารถโหลดรูปภาพได้)
          </div>
        </div>
      ` : `
        <div style="color:var(--text-muted); padding:1.5rem; font-style:italic;">
          (รายการนี้ไม่ได้แนบรูปถ่าย)
        </div>
      `}
    </div>

    <!-- 3 Choice Buttons -->
    <div style="font-weight:800; font-size:0.95rem; color:#fff; margin-bottom:0.8rem; text-align:center;">
      เลือกลงความเห็นผลการตรวจสอบสำหรับเครื่องนี้:
    </div>

    <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:0.8rem;">
      <button class="btn btn-success" style="padding:0.8rem 0.4rem; font-size:0.85rem; font-weight:700;" onclick="setItemDecision('${imei}', 'passed')">
        <i class="fa-solid fa-circle-check"></i> 1. ผ่าน (Pass)
      </button>

      <button class="btn btn-danger" style="padding:0.8rem 0.4rem; font-size:0.85rem; font-weight:700;" onclick="setItemDecision('${imei}', 'failed')">
        <i class="fa-solid fa-circle-xmark"></i> 2. ไม่ผ่าน (Fail)
      </button>

      <button class="btn btn-warning" style="padding:0.8rem 0.4rem; font-size:0.85rem; font-weight:700; color:#000;" onclick="setItemDecision('${imei}', 'resubmit')">
        <i class="fa-solid fa-rotate-left"></i> 3. ส่งตรวจใหม่
      </button>
    </div>
  `;

  openModal(`ตรวจสอบสินค้า & รูปถ่าย IMEI: ${imei}`, bodyHtml, `<button class="btn btn-secondary" onclick="inspectBranchAudit('${window.currentInspectedAuditId}')">ย้อนกลับ</button>`);
}

async function setItemDecision(imei, decision) {
  if (!window.hqAuditInspectionState) return;

  const todayStr = document.getElementById('hq-audit-date-picker') ? document.getElementById('hq-audit-date-picker').value : new Date().toISOString().split('T')[0];
  const branchId = window.hqAuditInspectionState.branchId || window.currentInspectedAuditId;

  if (decision === 'passed') {
    window.hqAuditInspectionState.verifiedImeis.add(imei);
    window.hqAuditInspectionState.failedImeis.delete(imei);
    window.hqAuditInspectionState.resubmitImeis.delete(imei);
    showToast(`ลงความเห็น IMEI ${imei}: ผ่าน (Pass) เรียบร้อยแล้ว`);
  } else if (decision === 'failed') {
    window.hqAuditInspectionState.verifiedImeis.delete(imei);
    window.hqAuditInspectionState.failedImeis.add(imei);
    window.hqAuditInspectionState.resubmitImeis.delete(imei);
    showToast(`ลงความเห็น IMEI ${imei}: ไม่ผ่าน (Fail)`, 'error');
  } else if (decision === 'resubmit') {
    window.hqAuditInspectionState.verifiedImeis.delete(imei);
    window.hqAuditInspectionState.failedImeis.delete(imei);
    window.hqAuditInspectionState.resubmitImeis.add(imei);
    showToast(`ลงความเห็น IMEI ${imei}: ให้ส่งตรวจใหม่`, 'warning');
  }

  // Save decision into MongoDB Database
  try {
    await apiRequest('/audit/decision', 'POST', {
      auditDate: todayStr,
      branchId,
      imei,
      decision
    });
  } catch (err) {
    console.warn('Unable to persist decision:', err);
  }

  if (window.currentInspectedAuditId) {
    inspectBranchAudit(window.currentInspectedAuditId);
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
    state.expectedStockCache = (res.items || []).filter(item => item.expectedCount > 0);

    const todayStr = new Date().toISOString().split('T')[0];

    container.innerHTML = `
      <div class="card" style="margin-bottom: 1.5rem;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem;">
          <div>
            <h3 style="font-size:1.1rem; font-weight:700;">แบบฟอร์ม นับสต็อกประจำวัน (Branch Daily Stock Check)</h3>
            <p style="font-size:0.85rem; color:var(--text-muted);">สแกนบาร์โค้ด IMEI/ซีเรียล หรือพิมพ์เพื่อตรวจนับสินค้า ระบบจะคำนวณ ยอดที่ขาด/เกิน ให้อัตโนมัติ</p>
          </div>
          <div style="display:flex; align-items:center; gap:0.8rem;">
            <label style="font-size:0.85rem; font-weight:600; color:var(--text-muted);">วันที่ตรวจนับ:</label>
            <input type="date" id="branch-audit-date" class="form-control" style="width:auto;" value="${todayStr}">
          </div>
        </div>

        <div style="margin-top: 1.2rem; background: rgba(99,102,241,0.1); border:1px solid rgba(99,102,241,0.2); padding:1rem; border-radius:var(--radius-md); display:flex; gap:1rem; align-items:center; flex-wrap:wrap;">
          <div style="flex:1; min-width:260px;">
            <label style="font-size:0.78rem; font-weight:700; color:var(--accent-secondary);">ช่องสแกนบาร์โค้ดรวดเร็ว (สแกน IMEI/ซีเรียลที่นี่)</label>
            <input type="text" id="barcode-scanner-input" class="form-control" placeholder="สแกน หรือ พิมพ์หมายเลข IMEI/ซีเรียล แล้วกด Enter..." style="margin-top:0.3rem;" autofocus>
          </div>
          <div style="font-size:0.85rem; color:var(--text-muted);">
            <i class="fa-solid fa-circle-info" style="color:var(--accent-primary);"></i> สแกนหมายเลข IMEI เพื่อตรวจนับสินค้าคงเหลือในสาขา
          </div>
        </div>
      </div>

      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>ชื่อสินค้า</th>
              <th>จำนวนสินค้า</th>
              <th>จำนวนนับได้จริง</th>
              <th>ยอดที่ขาด/เกิน</th>
            </tr>
          </thead>
          <tbody id="branch-audit-table-body">
            ${state.expectedStockCache.length === 0 ? `<tr><td colspan="4" style="text-align:center; color:var(--text-muted);">ไม่พบรายการสินค้าในสต็อกสาขานี้</td></tr>` : ''}
            ${state.expectedStockCache.map((item, idx) => {
              const scannedImeis = item.scannedImeis || [];
              const actual = scannedImeis.length;
              const diff = actual - item.expectedCount;

              return `
                <tr id="audit-row-${idx}">
                  <td>
                    <strong style="color:#38bdf8;">${item.productName}</strong><br>
                    <span style="font-size:0.8rem; color:var(--text-muted);">${item.productName}</span>
                  </td>
                  <td><strong class="expected-val" id="expected-${idx}">${item.expectedCount}</strong></td>
                  <td style="text-align:center; vertical-align:middle;">
                    <span id="actual-val-${idx}" style="font-size:1.25rem; font-weight:800; color:#38bdf8;">${actual}</span>
                  </td>
                  <td id="variance-status-${idx}">
                    ${diff === 0 ? `<span class="badge badge-green">ยอดตรงพอดี (0)</span>` :
                      diff < 0 ? `<span class="badge badge-red">${actual === 0 ? 'ยังไม่ได้สแกน' : ''} (ขาด -${Math.abs(diff)})</span>` :
                      `<span class="badge badge-yellow">เกิน +${diff}</span>`}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;

    const scannerInput = document.getElementById('barcode-scanner-input');
    if (scannerInput) {
      setTimeout(() => scannerInput.focus(), 100);
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
  } catch (err) {
    container.innerHTML = `<div style="color:#ef4444; padding:2rem;">เกิดข้อผิดพลาดในการโหลดรายการสต็อก: ${err.message}</div>`;
  }
}

function updateRowVariance(idx) {
  const item = state.expectedStockCache[idx];
  if (!item) return;

  const expected = item.expectedCount || 0;
  const scannedImeis = item.scannedImeis || [];
  const actual = scannedImeis.length;

  const actualValEl = document.getElementById(`actual-val-${idx}`);
  if (actualValEl) actualValEl.innerText = actual;

  const statusTd = document.getElementById(`variance-status-${idx}`);
  if (!statusTd) return;

  const diff = actual - expected;

  if (diff === 0) {
    statusTd.innerHTML = `<span class="badge badge-green">ยอดตรงพอดี (0)</span>`;
  } else if (diff < 0) {
    statusTd.innerHTML = `<span class="badge badge-red">ขาด ${Math.abs(diff)} ชิ้น (${diff})</span>`;
  } else {
    statusTd.innerHTML = `<span class="badge badge-yellow">เกิน ${diff} ชิ้น (+${diff})</span>`;
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
    const item = state.expectedStockCache[matchedIdx];
    if (!item.scannedImeis) item.scannedImeis = [];

    if (item.scannedImeis.includes(serial)) {
      showToast(`หมายเลข IMEI/SKU ${serial} ถูกสแกนตรวจนับไปแล้ว`, 'error');
      return;
    }

    openUploadImeiImageModal(serial, matchedIdx);
  } else {
    showToast(`ไม่พบหมายเลข IMEI/SKU ${serial} ในรายการสต็อกสาขานี้`, 'error');
  }
}

function openUploadImeiImageModal(serial, matchedIdx) {
  const item = state.expectedStockCache[matchedIdx];
  const auditDate = document.getElementById('branch-audit-date') ? document.getElementById('branch-audit-date').value : new Date().toISOString().split('T')[0];

  const bodyHtml = `
    <div style="background:rgba(0,0,0,0.2); padding:1rem; border-radius:6px; margin-bottom:1.2rem;">
      <div style="font-weight:800; font-size:1.1rem; color:#38bdf8; margin-bottom:0.3rem;">
        <i class="fa-solid fa-barcode"></i> หมายเลข IMEI / ซีเรียล: <span style="color:#fbbf24;">${serial}</span>
      </div>
      <div style="font-size:0.9rem; font-weight:700; color:#fff;">
        สินค้า: ${item ? item.productName : 'สินค้าในสต็อก'} (IMEI: ${serial})
      </div>
      <div style="font-size:0.78rem; color:var(--text-muted); margin-top:0.4rem; line-height:1.4;">
        <i class="fa-brands fa-google-drive" style="color:#34d399;"></i> รูปถ่ายจะถูกบันทึกลง Google Drive โฟลเดอร์: <br>
        <strong style="color:#38bdf8;">เช็คสต็อกsilminbanana / ${auditDate}</strong>
      </div>
    </div>

    <form id="upload-imei-form">
      <div class="form-group">
        <label for="imei-photo-file" style="font-weight:700; color:#34d399;">
          <i class="fa-solid fa-camera"></i> เลือก / ถ่ายรูปตัวเครื่อง หรือ ป้าย IMEI (จำเป็น)
        </label>
        <input type="file" id="imei-photo-file" class="form-control" accept="image/*" capture="environment" onchange="previewImeiPhoto(this)" required>
      </div>

      <div id="imei-photo-preview-container" style="display:none; text-align:center; margin-top:1rem; background:rgba(0,0,0,0.3); padding:0.5rem; border-radius:6px;">
        <img id="imei-photo-preview" src="" style="max-height:200px; max-width:100%; border-radius:4px; border:2px solid var(--accent-primary);">
      </div>
    </form>
  `;

  const footerHtml = `
    <button class="btn btn-secondary" onclick="confirmScanWithoutPhoto('${serial}', ${matchedIdx})">ข้ามการแนบรูป</button>
    <button class="btn btn-success" id="btn-upload-drive-confirm" onclick="submitImeiPhotoAndConfirm('${serial}', ${matchedIdx})">
      <i class="fa-brands fa-google-drive"></i> อัปโหลดลง Google Drive & ยืนยัน
    </button>
  `;

  openModal(`แนบรูปถ่ายสำหรับ IMEI: ${serial}`, bodyHtml, footerHtml);
}

function previewImeiPhoto(input) {
  const previewContainer = document.getElementById('imei-photo-preview-container');
  const previewImg = document.getElementById('imei-photo-preview');

  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = function(e) {
      previewImg.src = e.target.result;
      previewContainer.style.display = 'block';
    };
    reader.readAsDataURL(input.files[0]);
  } else {
    previewContainer.style.display = 'none';
  }
}

async function submitImeiPhotoAndConfirm(serial, matchedIdx) {
  const fileInput = document.getElementById('imei-photo-file');
  if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
    showToast('กรุณาเลือกหรือถ่ายรูปภาพของ IMEI ก่อนกดอัปโหลด', 'error');
    return;
  }

  const btn = document.getElementById('btn-upload-drive-confirm');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> กำลังอัปโหลดลง Google Drive...`;
  }

  const auditDate = document.getElementById('branch-audit-date') ? document.getElementById('branch-audit-date').value : new Date().toISOString().split('T')[0];

  const formData = new FormData();
  formData.append('image', fileInput.files[0]);
  formData.append('imei', serial);
  formData.append('auditDate', auditDate);

  try {
    const token = state.token || localStorage.getItem('silmin_token');
    const response = await fetch('/api/audit/upload-imei-image', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    const res = await response.json();

    if (!response.ok || !res.success) {
      throw new Error(res.message || 'เกิดข้อผิดพลาดในการอัปโหลดรูปภาพลง Google Drive');
    }

    const item = state.expectedStockCache[matchedIdx];
    if (!item.scannedImeis) item.scannedImeis = [];
    if (!item.imeiImages) item.imeiImages = [];

    if (!item.scannedImeis.includes(serial)) {
      item.scannedImeis.push(serial);
    }

    item.imeiImages.push({
      imei: serial,
      fileId: res.fileId,
      url: res.url
    });

    updateRowVariance(matchedIdx);
    closeModal();
    showToast(`อัปโหลดรูป IMEI ${serial} ลง Google Drive & บันทึกรายงานส่งส่วนกลางสำเร็จ!`);

    await submitBranchAuditFormSilent();

    const scannerInput = document.getElementById('barcode-scanner-input');
    if (scannerInput) {
      scannerInput.value = '';
      setTimeout(() => scannerInput.focus(), 100);
    }
  } catch (err) {
    showToast(`เกิดข้อผิดพลาด: ${err.message}`, 'error');
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i class="fa-brands fa-google-drive"></i> อัปโหลดลง Google Drive & ยืนยัน`;
    }
  }
}

async function confirmScanWithoutPhoto(serial, matchedIdx) {
  const item = state.expectedStockCache[matchedIdx];
  if (!item.scannedImeis) item.scannedImeis = [];

  if (!item.scannedImeis.includes(serial)) {
    item.scannedImeis.push(serial);
  }

  updateRowVariance(matchedIdx);
  closeModal();
  showToast(`นับ IMEI ${serial} เรียบร้อยแล้ว & บันทึกรายงานส่งส่วนกลางสำเร็จ`);

  await submitBranchAuditFormSilent();

  const scannerInput = document.getElementById('barcode-scanner-input');
  if (scannerInput) {
    scannerInput.value = '';
    setTimeout(() => scannerInput.focus(), 100);
  }
}

async function submitBranchAuditFormSilent() {
  const auditDateEl = document.getElementById('branch-audit-date');
  const auditDate = auditDateEl ? auditDateEl.value : new Date().toISOString().split('T')[0];
  const userBranchId = state.user.branch ? state.user.branch._id : (state.masterOptions.branches && state.masterOptions.branches[0] ? state.masterOptions.branches[0]._id : null);

  const scannedItems = state.expectedStockCache.map((item) => {
    const scannedImeis = item.scannedImeis || [];
    const actualCount = scannedImeis.length;
    const imeiImages = item.imeiImages || [];

    return {
      product: item.product,
      productName: item.productName,
      actualCount,
      scannedImeis,
      imeiImages
    };
  });

  try {
    await apiRequest('/audit/submit', 'POST', {
      auditDate,
      branchId: userBranchId,
      scannedItems
    });
  } catch (err) {
    // Silent auto sync
  }
}

/* ==========================================================================
   VIEW: BRANCH PURCHASE ORDERS (สั่งซื้อสินค้าลงสาขา)
   ========================================================================== */
async function renderBranchPurchaseOrdersView(selectedBranchId = null) {
  const container = document.getElementById('content-container');
  container.innerHTML = `<div style="padding: 2rem; text-align: center; color: var(--text-muted);"><i class="fa-solid fa-spinner fa-spin" style="font-size:2rem;"></i> กำลังโหลดรายการสั่งซื้อสินค้าลงสาขาและแดชบอร์ดฝ่ายจัดซื้อ...</div>`;

  try {
    await loadMasterOptions();
    const isHqOrAdmin = ['admin', 'hq_stock_staff', 'purchase_staff'].includes(state.user ? state.user.role : '');
    const branches = state.masterOptions.branches || [];

    let branchId = selectedBranchId;
    if (!branchId && state.user && state.user.branch && !isHqOrAdmin) {
      branchId = state.user.branch._id || state.user.branch;
    }

    // Fetch stock list for inventory count per branch
    let stockList = [];
    try {
      const stockRes = await apiRequest('/stock/all');
      if (stockRes.success) stockList = stockRes.stock || [];
    } catch (e) {
      console.warn('Unable to fetch stock list for branch cards:', e);
    }

    // Fetch all POs for cards calculation
    let allOrders = [];
    try {
      const allRes = await apiRequest('/purchase-orders');
      if (allRes.success) allOrders = allRes.orders || [];
    } catch (e) {
      console.warn('Unable to fetch all POs:', e);
    }

    // Filter displayed table orders
    const displayedOrders = branchId ? allOrders.filter(o => String(o.branch ? (o.branch._id || o.branch) : '') === String(branchId)) : allOrders;

    container.innerHTML = `
      ${isHqOrAdmin && branches.length > 0 ? `
        <!-- Branch Purchasing Overview Cards Grid -->
        <div style="margin-bottom:2rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; flex-wrap:wrap; gap:0.5rem;">
            <div>
              <h3 style="font-size:1.15rem; font-weight:800; color:#fff; display:flex; align-items:center; gap:0.5rem;">
                <i class="fa-solid fa-store" style="color:var(--accent-gold);"></i> ข้อมูลสรุปรายสาขาสำหรับฝ่ายจัดซื้อ (Purchasing Overview)
              </h3>
              <p style="font-size:0.8rem; color:var(--text-muted);">วงเงินคงเหลือ, สต็อกพร้อมขายในสาขา, รายการสั่งซื้อค้างส่ง และปุ่มทางด่วนสั่งซื้อ</p>
            </div>
            ${selectedBranchId ? `
              <button class="btn btn-secondary btn-sm" onclick="renderBranchPurchaseOrdersView(null)">
                <i class="fa-solid fa-rotate-left"></i> แสดงทุกสาขา
              </button>
            ` : ''}
          </div>

          <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap:1.2rem;">
            ${branches.map(b => {
              const bLimit = b.creditLimit || 0;
              const bUsed = b.usedCredit || 0;
              const bRem = Math.max(0, bLimit - bUsed);
              const bPct = bLimit > 0 ? Math.min(100, Math.round((bUsed / bLimit) * 100)) : 0;

              const bOrders = allOrders.filter(o => String(o.branch ? (o.branch._id || o.branch) : '') === String(b._id));
              const pendingCount = bOrders.filter(o => o.status === 'pending_imei').length;
              const receivedCount = bOrders.filter(o => o.status === 'received').length;
              const totalOrderVal = bOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

              const inStockCount = stockList.filter(s => String(s.branch ? (s.branch._id || s.branch) : '') === String(b._id) && s.status === 'in_stock').length;
              const isSelected = selectedBranchId && String(selectedBranchId) === String(b._id);

              return `
                <div class="card" style="background:rgba(255,255,255,0.03); border:${isSelected ? '2px solid var(--accent-gold)' : '1px solid rgba(255,255,255,0.12)'}; border-radius:10px; padding:1.2rem; display:flex; flex-direction:column; justify-content:space-between; box-shadow:${isSelected ? '0 0 15px rgba(251,191,36,0.2)' : 'none'};">
                  <div>
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.8rem;">
                      <div>
                        <strong style="font-size:1.1rem; color:#fff; font-weight:800; display:block;">${b.name}</strong>
                        <span style="font-size:0.78rem; color:var(--text-muted); font-family:monospace;">รหัสสาขา: ${b.code || '-'}</span>
                      </div>
                      <span class="badge badge-${bRem > 0 ? 'green' : 'red'}" style="font-size:0.75rem;">
                        <i class="fa-solid fa-${bRem > 0 ? 'circle-check' : 'ban'}"></i> ${bRem > 0 ? 'พร้อมสั่งซื้อ' : 'วงเงินเต็ม'}
                      </span>
                    </div>

                    <!-- Credit Limit Bar -->
                    <div style="background:rgba(0,0,0,0.3); border-radius:8px; padding:0.8rem; margin-bottom:1rem; border:1px solid rgba(255,255,255,0.06);">
                      <div style="display:flex; justify-content:space-between; font-size:0.78rem; margin-bottom:0.3rem;">
                        <span style="color:var(--text-muted);">ใช้วงเงินไปแล้ว:</span>
                        <strong style="color:${bPct >= 90 ? '#f87171' : '#34d399'};">${bPct}%</strong>
                      </div>
                      <div style="width:100%; background:rgba(255,255,255,0.1); height:8px; border-radius:4px; overflow:hidden; margin-bottom:0.6rem;">
                        <div style="width:${bPct}%; background:${bPct >= 90 ? '#ef4444' : bPct >= 70 ? '#fbbf24' : '#34d399'}; height:100%; border-radius:4px;"></div>
                      </div>
                      <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:0.4rem; font-size:0.75rem; text-align:center;">
                        <div>
                          <div style="color:var(--text-muted); font-size:0.7rem;">วงเงินอนุมัติ</div>
                          <div style="font-weight:700; color:#818cf8;">฿${bLimit.toLocaleString()}</div>
                        </div>
                        <div>
                          <div style="color:var(--text-muted); font-size:0.7rem;">ใช้ไปแล้ว</div>
                          <div style="font-weight:700; color:#fbbf24;">฿${bUsed.toLocaleString()}</div>
                        </div>
                        <div>
                          <div style="color:var(--text-muted); font-size:0.7rem;">สั่งซื้อได้อีก</div>
                          <div style="font-weight:700; color:#34d399;">฿${bRem.toLocaleString()}</div>
                        </div>
                      </div>
                    </div>

                    <!-- Key Purchasing & Inventory Metrics -->
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:0.6rem; margin-bottom:1rem; font-size:0.8rem;">
                      <div style="background:rgba(0,0,0,0.2); padding:0.6rem; border-radius:6px; border:1px solid rgba(255,255,255,0.05);">
                        <div style="color:var(--text-muted); font-size:0.73rem;">📦 สต็อกพร้อมขายในสาขา</div>
                        <div style="display:flex; align-items:center; gap:0.4rem; margin-top:0.2rem;">
                          <strong style="font-size:1.15rem; color:${inStockCount < 5 ? '#f87171' : '#38bdf8'};">${inStockCount} เครื่อง</strong>
                          ${inStockCount < 5 ? '<span class="badge badge-red" style="font-size:0.68rem; padding:0.1rem 0.35rem;">⚠️ สต็อกต่ำ</span>' : ''}
                        </div>
                      </div>

                      <div style="background:rgba(0,0,0,0.2); padding:0.6rem; border-radius:6px; border:1px solid rgba(255,255,255,0.05);">
                        <div style="color:var(--text-muted); font-size:0.73rem;">🟡 รอสาขาเติม IMEI</div>
                        <div style="margin-top:0.2rem;">
                          <strong style="font-size:1.15rem; color:${pendingCount > 0 ? '#fbbf24' : '#a1a1aa'};">${pendingCount} ใบ</strong>
                        </div>
                      </div>

                      <div style="background:rgba(0,0,0,0.2); padding:0.6rem; border-radius:6px; border:1px solid rgba(255,255,255,0.05);">
                        <div style="color:var(--text-muted); font-size:0.73rem;">🟢 รับเข้าสต็อกแล้ว</div>
                        <div style="margin-top:0.2rem;">
                          <strong style="font-size:1.1rem; color:#34d399;">${receivedCount} ใบ</strong>
                        </div>
                      </div>

                      <div style="background:rgba(0,0,0,0.2); padding:0.6rem; border-radius:6px; border:1px solid rgba(255,255,255,0.05);">
                        <div style="color:var(--text-muted); font-size:0.73rem;">💰 ยอดสั่งซื้อสะสม</div>
                        <div style="margin-top:0.2rem;">
                          <strong style="font-size:0.92rem; color:#34d399;">฿${totalOrderVal.toLocaleString()}</strong>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Quick Action Buttons -->
                  <div style="display:flex; gap:0.5rem; margin-top:0.5rem;">
                    <button class="btn btn-primary btn-sm" style="flex:1; font-size:0.8rem; font-weight:700;" onclick="openCreatePurchaseOrderModal('${b._id}')">
                      <i class="fa-solid fa-cart-plus"></i> + สั่งซื้อลงสาขานี้
                    </button>
                    <button class="btn btn-secondary btn-sm" style="font-size:0.8rem; font-weight:700;" onclick="renderBranchPurchaseOrdersView('${b._id}')">
                      <i class="fa-solid fa-list-check"></i> ดูใบสั่งซื้อ
                    </button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      ` : ''}

      <!-- Action Bar & Filter -->
      <div class="card" style="margin-bottom:1.5rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem;">
        <div>
          <h3 style="font-size:1.15rem; font-weight:700; display:flex; align-items:center; gap:0.5rem;">
            <i class="fa-solid fa-cart-flatbed" style="color:var(--accent-primary);"></i> รายการใบสั่งซื้อสินค้าลงสาขา (${displayedOrders.length} รายการ)
          </h3>
          <p style="font-size:0.82rem; color:var(--text-muted);">ประวัติและสถานะใบสั่งซื้อสินค้าลงสาขาแบบละเอียด</p>
        </div>

        <div style="display:flex; align-items:center; gap:0.8rem; flex-wrap:wrap;">
          <button class="btn btn-primary" onclick="openCreatePurchaseOrderModal(${selectedBranchId ? `'${selectedBranchId}'` : ''})"><i class="fa-solid fa-plus"></i> สั่งซื้อสินค้าลงสาขาใหม่</button>
          ${isHqOrAdmin && branches.length > 0 ? `
            <div style="display:flex; align-items:center; gap:0.4rem;">
              <label style="font-size:0.82rem; font-weight:600; color:var(--text-muted);">ตัวกรองสาขา:</label>
              <select class="form-select" style="width:auto; padding:0.25rem 0.5rem; font-size:0.82rem; font-weight:700;" onchange="renderBranchPurchaseOrdersView(this.value || null)">
                <option value="">-- แสดงทุกสาขา --</option>
                ${branches.map(b => `<option value="${b._id}" ${String(selectedBranchId) === String(b._id) ? 'selected' : ''}>${b.name}</option>`).join('')}
              </select>
            </div>
          ` : ''}
        </div>
      </div>

      <!-- PO Data Table -->
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>เลขที่ใบสั่งซื้อ / วันเวลา</th>
              <th>สาขา</th>
              <th>รายการสินค้าสั่งซื้อ</th>
              <th>จำนวนรวม</th>
              <th>มูลค่ารวม (บาท)</th>
              <th>ผู้สั่งซื้อ</th>
              <th style="text-align:center;">สถานะ & ดำเนินการ</th>
            </tr>
          </thead>
          <tbody>
            ${displayedOrders.length === 0 ? `<tr><td colspan="7" style="text-align:center; color:var(--text-muted); padding:2rem;">ยังไม่มีรายการสั่งซื้อสินค้าลงสาขา</td></tr>` : ''}
            ${displayedOrders.map(order => {
              const isPending = order.status === 'pending_imei';
              const itemsList = order.items || [];
              const totalQty = itemsList.reduce((sum, item) => sum + (item.quantity || 0), 0);

              let statusBadge = '<span class="badge badge-green"><i class="fa-solid fa-circle-check"></i> รับเข้าสต็อกแล้ว</span>';
              if (isPending) {
                statusBadge = '<span class="badge badge-yellow"><i class="fa-solid fa-clock"></i> รอสาขาเติม IMEI</span>';
              } else if (order.status === 'cancelled') {
                statusBadge = '<span class="badge badge-red"><i class="fa-solid fa-ban"></i> ยกเลิก</span>';
              }

              return `
                <tr>
                  <td>
                    <strong style="color:var(--accent-secondary); font-size:0.92rem;">${order.orderNumber}</strong><br>
                    <span style="font-size:0.78rem; color:var(--text-muted);">${new Date(order.createdAt).toLocaleString('th-TH')}</span>
                  </td>
                  <td><strong>${order.branchName || 'สาขา'}</strong></td>
                  <td>
                    ${itemsList.map(it => `<div style="font-size:0.83rem;">• <strong>${it.productName}</strong> x${it.quantity} (฿${(it.unitPrice || 0).toLocaleString()}/ชิ้น)</div>`).join('')}
                  </td>
                  <td><strong style="color:#38bdf8;">${totalQty} เครื่อง</strong></td>
                  <td><strong style="color:#34d399; font-size:0.95rem;">฿${(order.totalAmount || 0).toLocaleString()}</strong></td>
                  <td><span style="font-size:0.83rem;">${order.orderedByName || 'พนักงาน'}</span></td>
                  <td style="text-align:center;">
                    ${statusBadge}<br>
                    ${isPending ? `
                      <div style="display:flex; flex-direction:column; gap:0.3rem; margin-top:0.4rem; align-items:center;">
                        <button class="btn btn-success btn-sm" style="padding:0.25rem 0.6rem; font-size:0.78rem; width:100%; font-weight:700;" onclick="openFillImeiAndReceiveModal('${order._id}')">
                          <i class="fa-solid fa-barcode"></i> สแกนเติม IMEI & รับเข้าสต็อก
                        </button>
                        <div style="display:flex; gap:0.3rem; width:100%;">
                          <button class="btn btn-warning btn-sm" style="padding:0.25rem 0.4rem; font-size:0.75rem; flex:1; font-weight:700;" onclick="openEditPurchaseOrderModal('${order._id}')">
                            <i class="fa-solid fa-pen-to-square"></i> แก้ไข
                          </button>
                          <button class="btn btn-danger btn-sm" style="padding:0.25rem 0.4rem; font-size:0.75rem; flex:1; font-weight:700;" onclick="cancelPurchaseOrderAction('${order._id}')">
                            <i class="fa-solid fa-ban"></i> ยกเลิก
                          </button>
                        </div>
                      </div>
                    ` : ''}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div style="color:#ef4444; padding:2rem;">เกิดข้อผิดพลาดในการโหลดใบสั่งซื้อ: ${err.message}</div>`;
  }
}

function openCreatePurchaseOrderModal(preselectedBranchId = null) {
  const branches = state.masterOptions.branches || [];
  const bodyHtml = `
    <form id="create-po-form" onsubmit="event.preventDefault(); submitCreatePurchaseOrder();">
      <div class="form-group" style="margin-bottom:1.2rem; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1); padding:1rem; border-radius:8px;">
        <label for="po-branch" style="font-weight:700; color:#fff; font-size:0.95rem;">
          <i class="fa-solid fa-store" style="color:var(--accent-primary);"></i> เลือกสาขาที่สั่งซื้อสินค้าลง <span style="color:#ef4444;">*</span>
        </label>
        <select id="po-branch" class="form-select" style="margin-top:0.4rem; font-weight:700;" onchange="updatePoBranchCreditPreview(this.value)" required>
          ${branches.map(b => `<option value="${b._id}" ${preselectedBranchId && String(b._id) === String(preselectedBranchId) ? 'selected' : ''}>${b.name} (วงเงินคงเหลือ: ฿${Math.max(0, (b.creditLimit || 0) - (b.usedCredit || 0)).toLocaleString()})</option>`).join('')}
        </select>
        <div id="po-credit-preview" style="font-size:0.83rem; margin-top:0.5rem;"></div>
      </div>

      <div style="font-weight:800; font-size:0.98rem; margin-bottom:0.8rem; color:#38bdf8; display:flex; justify-content:space-between; align-items:center;">
        <span><i class="fa-solid fa-boxes-packing"></i> ระบุรายการสินค้าที่สั่งซื้อลงสาขา</span>
        <button type="button" class="btn btn-success btn-sm" onclick="addPoItemRow()" style="font-weight:700;">
          <i class="fa-solid fa-plus"></i> + เพิ่มรายการสินค้า
        </button>
      </div>

      <div id="po-items-container" style="display:flex; flex-direction:column; gap:1rem; max-height:360px; overflow-y:auto; margin-bottom:1.2rem; padding-right:0.4rem;">
        <!-- Dynamic PO Item Rows -->
      </div>

      <div id="po-total-card" style="background:rgba(0,0,0,0.35); border:1px solid rgba(255,255,255,0.12); padding:1rem 1.2rem; border-radius:8px; display:flex; justify-content:space-between; align-items:center;">
        <div>
          <div style="font-size:0.82rem; color:var(--text-muted);">ราคารวมทั้งใบสั่งซื้อ</div>
          <div style="font-size:0.78rem; color:#a1a1aa;">(จะถูกหักจากวงเงินคงเหลือของสาขา)</div>
        </div>
        <div style="text-align:right;">
          <strong id="po-total-amount" style="font-size:1.4rem; color:#34d399;">฿0</strong>
        </div>
      </div>
    </form>
  `;

  const footerHtml = `
    <button class="btn btn-secondary" onclick="closeModal()">ยกเลิก</button>
    <button class="btn btn-primary" id="po-submit-btn" onclick="submitCreatePurchaseOrder()" style="padding:0.65rem 1.5rem; font-weight:700;">
      <i class="fa-solid fa-check-double"></i> ยืนยันบันทึกสั่งซื้อ & หักวงเงินสาขา
    </button>
  `;

  openModal('📦 สร้างรายการสั่งซื้อสินค้าลงสาขา', bodyHtml, footerHtml);

  window.poItemsState = [];
  addPoItemRow();
  updatePoBranchCreditPreview(document.getElementById('po-branch') ? document.getElementById('po-branch').value : '');
}

function updatePoBranchCreditPreview(branchId) {
  const branches = state.masterOptions.branches || [];
  const b = branches.find(item => String(item._id) === String(branchId));
  const el = document.getElementById('po-credit-preview');
  window.currentSelectedPoBranch = b;

  if (el && b) {
    const rem = Math.max(0, (b.creditLimit || 0) - (b.usedCredit || 0));
    el.innerHTML = `
      <div style="background:rgba(0,0,0,0.25); padding:0.6rem 0.8rem; border-radius:6px; display:flex; gap:1.2rem; align-items:center; border:1px solid rgba(255,255,255,0.08);">
        <div><span style="color:var(--text-muted);">วงเงินอนุมัติ:</span> <strong>฿${(b.creditLimit || 0).toLocaleString()}</strong></div>
        <div><span style="color:var(--text-muted);">ใช้ไปแล้ว:</span> <span style="color:#fbbf24; font-weight:700;">฿${(b.usedCredit || 0).toLocaleString()}</span></div>
        <div><span style="color:var(--text-muted);">วงเงินคงเหลือสั่งซื้อได้:</span> <strong style="color:#34d399; font-size:0.95rem;">฿${rem.toLocaleString()}</strong></div>
      </div>
    `;
  }
  calculatePoTotal();
}

function addPoItemRow() {
  window.poItemsState = window.poItemsState || [];

  window.poItemsState.push({
    brand: '',
    model: '',
    capacity: '',
    color: '',
    quantity: 1,
    unitPrice: 0
  });

  renderPoItemRowsUI();
}

function removePoItemRow(idx) {
  if (window.poItemsState && window.poItemsState.length > 1) {
    window.poItemsState.splice(idx, 1);
    renderPoItemRowsUI();
  } else {
    showToast('ต้องมีรายการสินค้าอย่างน้อย 1 รายการ', 'error');
  }
}

function renderPoItemRowsUI() {
  const container = document.getElementById('po-items-container');
  if (!container) return;

  const { brands = [], models = [], capacities = [], colors = [] } = state.masterOptions;

  container.innerHTML = (window.poItemsState || []).map((item, idx) => {
    const fullName = [item.brand, item.model, item.capacity, item.color].filter(Boolean).join(' ');
    const rowSubtotal = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);

    return `
      <div class="po-item-card" style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.12); padding:1rem; border-radius:8px; position:relative;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.8rem; gap:0.5rem; flex-wrap:wrap;">
          <div style="font-weight:700; color:#38bdf8; font-size:0.9rem; display:flex; align-items:center; gap:0.4rem;">
            <span class="badge badge-gold" style="font-size:0.75rem;">รายการที่ ${idx + 1}</span>
            <span style="color:${fullName ? '#34d399' : '#f87171'}; font-size:0.95rem; font-weight:800;">${fullName || '⚠️ ยังไม่ได้เลือกข้อมูลสินค้า'}</span>
          </div>
          ${(window.poItemsState || []).length > 1 ? `
            <button type="button" class="btn btn-danger btn-sm" onclick="removePoItemRow(${idx})" style="padding:0.2rem 0.6rem; font-size:0.75rem;">
              <i class="fa-solid fa-trash"></i> ลบรายการนี้
            </button>
          ` : ''}
        </div>

        <!-- Specs Grid (Mandatory Selection) -->
        <div style="display:grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap:0.6rem; margin-bottom:0.8rem;">
          <div>
            <label style="font-size:0.75rem; color:var(--text-muted); font-weight:700;">ยี่ห้อ <span style="color:#ef4444;">*</span></label>
            <select class="form-select" style="font-size:0.82rem; padding:0.35rem 0.4rem;" onchange="onPoItemDropdownChange(${idx}, 'brand', this.value)">
              <option value="">-- เลือกยี่ห้อ --</option>
              ${brands.map(b => `<option value="${b.value}" ${b.value === item.brand ? 'selected' : ''}>${b.value}</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="font-size:0.75rem; color:var(--text-muted); font-weight:700;">ชื่อรุ่น <span style="color:#ef4444;">*</span></label>
            <select class="form-select" style="font-size:0.82rem; padding:0.35rem 0.4rem;" onchange="onPoItemDropdownChange(${idx}, 'model', this.value)">
              <option value="">-- เลือกชื่อรุ่น --</option>
              ${models.map(m => `<option value="${m.value}" ${m.value === item.model ? 'selected' : ''}>${m.value}</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="font-size:0.75rem; color:var(--text-muted);">ความจุ</label>
            <select class="form-select" style="font-size:0.82rem; padding:0.35rem 0.4rem;" onchange="onPoItemDropdownChange(${idx}, 'capacity', this.value)">
              <option value="">-- เลือกความจุ --</option>
              ${capacities.map(c => `<option value="${c.value}" ${c.value === item.capacity ? 'selected' : ''}>${c.value}</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="font-size:0.75rem; color:var(--text-muted);">สีสินค้า</label>
            <select class="form-select" style="font-size:0.82rem; padding:0.35rem 0.4rem;" onchange="onPoItemDropdownChange(${idx}, 'color', this.value)">
              <option value="">-- เลือกสีสินค้า --</option>
              ${colors.map(co => `<option value="${co.value}" ${co.value === item.color ? 'selected' : ''}>${co.value}</option>`).join('')}
            </select>
          </div>
        </div>

        <!-- Quantity & Price Inputs -->
        <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:0.6rem; background:rgba(0,0,0,0.15); padding:0.65rem; border-radius:6px; align-items:center;">
          <div>
            <label style="font-size:0.75rem; color:var(--text-muted); font-weight:700;">จำนวน (เครื่อง) <span style="color:#ef4444;">*</span></label>
            <input type="number" class="form-control po-qty-input" data-idx="${idx}" style="font-size:0.88rem; font-weight:700; color:#38bdf8;" min="1" value="${item.quantity}" oninput="onPoNumericInput(${idx})">
          </div>
          <div>
            <label style="font-size:0.75rem; color:var(--text-muted); font-weight:700;">ราคาสั่งซื้อ/ชิ้น (บาท) <span style="color:#ef4444;">*</span></label>
            <input type="number" class="form-control po-price-input" data-idx="${idx}" style="font-size:0.88rem; font-weight:700; color:#34d399;" min="0" placeholder="ระบุราคาสั่งซื้อ" value="${item.unitPrice || ''}" oninput="onPoNumericInput(${idx})">
          </div>
          <div style="text-align:right;">
            <div style="font-size:0.72rem; color:var(--text-muted);">รวมรายการนี้</div>
            <strong id="po-row-subtotal-${idx}" style="font-size:1.05rem; color:#fbbf24;">฿${rowSubtotal.toLocaleString()}</strong>
          </div>
        </div>
      </div>
    `;
  }).join('');

  calculatePoTotal();
}

function onPoItemDropdownChange(idx, field, value) {
  if (!window.poItemsState || !window.poItemsState[idx]) return;
  window.poItemsState[idx][field] = value;
  renderPoItemRowsUI();
}

function onPoNumericInput(idx) {
  if (!window.poItemsState || !window.poItemsState[idx]) return;

  const qtyInp = document.querySelector(`.po-qty-input[data-idx="${idx}"]`);
  const priceInp = document.querySelector(`.po-price-input[data-idx="${idx}"]`);

  const qty = qtyInp ? (Math.max(1, parseInt(qtyInp.value) || 1)) : 1;
  const price = priceInp ? (Math.max(0, parseFloat(priceInp.value) || 0)) : 0;

  window.poItemsState[idx].quantity = qty;
  window.poItemsState[idx].unitPrice = price;

  const rowSubtotalEl = document.getElementById(`po-row-subtotal-${idx}`);
  if (rowSubtotalEl) {
    rowSubtotalEl.innerText = `฿${(qty * price).toLocaleString()}`;
  }

  calculatePoTotal();
}

function calculatePoTotal() {
  const items = window.poItemsState || [];
  const total = items.reduce((sum, item) => sum + ((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0)), 0);

  const totalEl = document.getElementById('po-total-amount');
  if (totalEl) {
    totalEl.innerText = `฿${total.toLocaleString()}`;
  }

  // Check against remaining branch credit
  const branch = window.currentSelectedPoBranch;
  const submitBtn = document.getElementById('po-submit-btn');

  if (branch) {
    const rem = Math.max(0, (branch.creditLimit || 0) - (branch.usedCredit || 0));
    if (total > rem) {
      if (totalEl) totalEl.style.color = '#ef4444';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ยอดซื้อเกินวงเงินสาขา (เกิน ฿${(total - rem).toLocaleString()})`;
        submitBtn.className = 'btn btn-danger';
      }
    } else {
      if (totalEl) totalEl.style.color = '#34d399';
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<i class="fa-solid fa-check-double"></i> ยืนยันบันทึกสั่งซื้อ & หักวงเงินสาขา`;
        submitBtn.className = 'btn btn-primary';
      }
    }
  }

  return total;
}

async function submitCreatePurchaseOrder() {
  const branchId = document.getElementById('po-branch') ? document.getElementById('po-branch').value : null;
  const items = window.poItemsState || [];

  if (!branchId) {
    showToast('กรุณาเลือกสาขาที่สั่งซื้อสินค้าลง', 'error');
    return;
  }

  if (items.length === 0) {
    showToast('กรุณาเพิ่มรายการสินค้าสั่งซื้ออย่างน้อย 1 รายการ', 'error');
    return;
  }

  // Strict validation: every item must have brand, model, and unitPrice > 0
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (!it.brand || !it.model) {
      showToast(`กรุณาเลือก "ยี่ห้อ" และ "ชื่อรุ่น" ให้ครบถ้วนสำหรับรายการที่ ${i + 1}`, 'error');
      return;
    }
    if (!it.unitPrice || Number(it.unitPrice) <= 0) {
      showToast(`กรุณาระบุ "ราคาสั่งซื้อ/ชิ้น" ให้มากกว่า 0 สำหรับรายการที่ ${i + 1}`, 'error');
      return;
    }
  }

  const payloadItems = items.map(item => ({
    brand: item.brand,
    model: item.model,
    capacity: item.capacity,
    color: item.color,
    productName: [item.brand, item.model, item.capacity, item.color].filter(Boolean).join(' '),
    quantity: Number(item.quantity) || 1,
    unitPrice: Number(item.unitPrice) || 0
  }));

  try {
    const res = await apiRequest('/purchase-orders', 'POST', {
      branchId,
      items: payloadItems
    });

    if (res.success) {
      showToast(res.message);
      closeModal();
      renderBranchPurchaseOrdersView(branchId);
    }
  } catch (err) {
    // Handled
  }
}

async function openEditPurchaseOrderModal(orderId) {
  openModal('กำลังโหลดรายละเอียดใบสั่งซื้อ...', '<div style="padding:2rem; text-align:center;"><i class="fa-solid fa-spinner fa-spin fa-2x"></i></div>');

  try {
    const res = await apiRequest(`/purchase-orders/${orderId}`);
    if (!res.success || !res.order) {
      showToast('ไม่พบข้อมูลใบสั่งซื้อ', 'error');
      return;
    }

    const order = res.order;
    if (order.status !== 'pending_imei') {
      showToast('ไม่สามารถแก้ไขได้ เนื่องจากรายการนี้ไม่ได้อยู่ในสถานะรอเติม IMEI', 'error');
      closeModal();
      return;
    }

    window.currentEditingPo = order;
    const branches = state.masterOptions.branches || [];
    window.currentSelectedPoBranch = branches.find(b => String(b._id) === String(order.branch ? (order.branch._id || order.branch) : '')) || order.branch;

    window.poItemsState = (order.items || []).map(it => ({
      brand: it.brand || '',
      model: it.model || '',
      capacity: it.capacity || '',
      color: it.color || '',
      quantity: it.quantity || 1,
      unitPrice: it.unitPrice || 0
    }));

    const bodyHtml = `
      <form id="edit-po-form" onsubmit="event.preventDefault(); submitEditPurchaseOrder('${order._id}');">
        <div style="background:rgba(0,0,0,0.25); border:1px solid rgba(255,255,255,0.1); padding:0.8rem 1rem; border-radius:6px; margin-bottom:1rem;">
          <div style="font-weight:700; color:var(--accent-primary); font-size:0.95rem;">
            แก้ไขใบสั่งซื้อเลขที่: <strong>${order.orderNumber}</strong>
          </div>
          <div style="font-size:0.83rem; color:var(--text-muted); margin-top:0.2rem;">
            สาขา: <strong>${order.branchName}</strong> | ผู้สั่งซื้อ: ${order.orderedByName || '-'}
          </div>
        </div>

        <div style="font-weight:800; font-size:0.98rem; margin-bottom:0.8rem; color:#38bdf8; display:flex; justify-content:space-between; align-items:center;">
          <span><i class="fa-solid fa-boxes-packing"></i> รายการสินค้าที่ต้องการสั่งซื้อ (ระบุสเปกและราคา)</span>
          <button type="button" class="btn btn-success btn-sm" onclick="addPoItemRow()" style="font-weight:700;">
            <i class="fa-solid fa-plus"></i> + เพิ่มรายการสินค้า
          </button>
        </div>

        <div id="po-items-container" style="display:flex; flex-direction:column; gap:1rem; max-height:360px; overflow-y:auto; margin-bottom:1.2rem; padding-right:0.4rem;">
          <!-- Dynamic PO Item Rows -->
        </div>

        <div id="po-total-card" style="background:rgba(0,0,0,0.35); border:1px solid rgba(255,255,255,0.12); padding:1rem 1.2rem; border-radius:8px; display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div style="font-size:0.82rem; color:var(--text-muted);">ราคารวมใหม่ทั้งใบสั่งซื้อ</div>
            <div style="font-size:0.78rem; color:#a1a1aa;">(ส่วนต่างราคาจะถูกปรับกับวงเงินคงเหลือของสาขาโดยอัตโนมัติ)</div>
          </div>
          <div style="text-align:right;">
            <strong id="po-total-amount" style="font-size:1.4rem; color:#34d399;">฿0</strong>
          </div>
        </div>
      </form>
    `;

    const footerHtml = `
      <button class="btn btn-secondary" onclick="closeModal()">ยกเลิก</button>
      <button class="btn btn-primary" id="po-submit-btn" onclick="submitEditPurchaseOrder('${order._id}')" style="padding:0.65rem 1.5rem; font-weight:700;">
        <i class="fa-solid fa-save"></i> บันทึกการแก้ไขใบสั่งซื้อ
      </button>
    `;

    openModal(`✏️ แก้ไขใบสั่งซื้อสินค้า: ${order.orderNumber}`, bodyHtml, footerHtml);
    renderPoItemRowsUI();

  } catch (err) {
    openModal('เกิดข้อผิดพลาด', `<p style="color:#ef4444;">${err.message}</p>`);
  }
}

async function submitEditPurchaseOrder(orderId) {
  const items = window.poItemsState || [];

  if (items.length === 0) {
    showToast('กรุณาเพิ่มรายการสินค้าสั่งซื้ออย่างน้อย 1 รายการ', 'error');
    return;
  }

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (!it.brand || !it.model) {
      showToast(`กรุณาเลือก "ยี่ห้อ" และ "ชื่อรุ่น" ให้ครบถ้วนสำหรับรายการที่ ${i + 1}`, 'error');
      return;
    }
    if (!it.unitPrice || Number(it.unitPrice) <= 0) {
      showToast(`กรุณาระบุ "ราคาสั่งซื้อ/ชิ้น" ให้มากกว่า 0 สำหรับรายการที่ ${i + 1}`, 'error');
      return;
    }
  }

  const payloadItems = items.map(item => ({
    brand: item.brand,
    model: item.model,
    capacity: item.capacity,
    color: item.color,
    productName: [item.brand, item.model, item.capacity, item.color].filter(Boolean).join(' '),
    quantity: Number(item.quantity) || 1,
    unitPrice: Number(item.unitPrice) || 0
  }));

  try {
    const res = await apiRequest(`/purchase-orders/${orderId}`, 'PUT', {
      items: payloadItems
    });

    if (res.success) {
      showToast(res.message);
      closeModal();
      renderBranchPurchaseOrdersView();
    }
  } catch (err) {
    // Handled
  }
}

async function cancelPurchaseOrderAction(orderId) {
  if (!confirm('คุณยืนยันที่จะ "ยกเลิก" ใบสั่งซื้อนี้ใช่หรือไม่?\n\n* ระบบจะทำการ คืนวงเงินสั่งซื้อ ให้กับสาขาโดยอัตโนมัติ *')) {
    return;
  }

  try {
    const res = await apiRequest(`/purchase-orders/${orderId}/cancel`, 'POST');
    if (res.success) {
      showToast(res.message);
      renderBranchPurchaseOrdersView();
    }
  } catch (err) {
    // Handled
  }
}

async function openFillImeiAndReceiveModal(orderId) {
  openModal('📱 สแกนเติม IMEI สินค้าจากใบสั่งซื้อ', `<div style="padding:2rem; text-align:center; color:var(--text-muted);"><i class="fa-solid fa-spinner fa-spin" style="font-size:2rem;"></i> กำลังโหลดรายละเอียดใบสั่งซื้อ...</div>`);

  try {
    const res = await apiRequest(`/purchase-orders/${orderId}`);
    const order = res.order;
    window.currentFillingPo = order;

    let bodyHtml = `
      <div style="background:rgba(0,0,0,0.25); padding:0.8rem 1rem; border-radius:6px; margin-bottom:1rem; border:1px solid rgba(255,255,255,0.1);">
        <div style="font-weight:700; color:var(--accent-primary); font-size:0.9rem;">
          ใบสั่งซื้อเลขที่: <strong>${order.orderNumber}</strong> (${order.branchName})
        </div>
        <div style="font-size:0.82rem; color:var(--text-muted); margin-top:0.2rem;">
          กรุณาสแกนหรือพิมพ์หมายเลข IMEI สำหรับสินค้าทุกชิ้นตามจำนวนที่สั่งซื้อ
        </div>
      </div>

      <form id="fill-imei-form" onsubmit="event.preventDefault(); submitFillImeiAndReceive('${order._id}');">
    `;

    (order.items || []).forEach((item, itemIdx) => {
      bodyHtml += `
        <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1); padding:0.8rem; border-radius:6px; margin-bottom:0.8rem;">
          <div style="font-weight:800; font-size:0.92rem; color:#38bdf8; margin-bottom:0.4rem;">
            ${itemIdx + 1}. ${item.productName}
          </div>
          <div style="font-size:0.8rem; color:#fbbf24; margin-bottom:0.6rem; font-weight:700;">
            จำนวนที่ต้องกรอก: ${item.quantity} เครื่อง
          </div>

          <div style="display:flex; flex-direction:column; gap:0.4rem;">
      `;

      for (let i = 0; i < item.quantity; i++) {
        bodyHtml += `
          <div style="display:flex; align-items:center; gap:0.5rem;">
            <span style="font-size:0.78rem; color:var(--text-muted); width:70px;">เครื่องที่ ${i + 1}:</span>
            <input type="text" class="form-control po-imei-input" data-item-idx="${itemIdx}" data-sub-idx="${i}" placeholder="สแกนหมายเลข IMEI 15 หลัก เครื่องที่ ${i + 1}" required style="font-family:monospace; font-size:0.85rem; font-weight:700;">
          </div>
        `;
      }

      bodyHtml += `</div></div>`;
    });

    bodyHtml += `</form>`;

    const footerHtml = `
      <button class="btn btn-secondary" onclick="closeModal()">ยกเลิก</button>
      <button class="btn btn-success" onclick="submitFillImeiAndReceive('${order._id}')"><i class="fa-solid fa-check"></i> ยืนยันเติม IMEI & รับเข้าสต็อกสาขา</button>
    `;

    openModal(`📱 สแกนเติม IMEI สินค้า: ${order.orderNumber}`, bodyHtml, footerHtml);

  } catch (err) {
    openModal('เกิดข้อผิดพลาด', `<p style="color:#ef4444;">${err.message}</p>`);
  }
}

async function submitFillImeiAndReceive(orderId) {
  const order = window.currentFillingPo;
  if (!order) return;

  const allImeis = [];
  const itemPayloads = [];

  for (let idx = 0; idx < (order.items || []).length; idx++) {
    const inputs = document.querySelectorAll(`.po-imei-input[data-item-idx="${idx}"]`);
    const imeis = Array.from(inputs).map(inp => inp.value.trim()).filter(Boolean);

    if (imeis.length < order.items[idx].quantity) {
      showToast(`กรุณากรอก IMEI ให้ครบทุกเครื่องสำหรับ ${order.items[idx].productName}`, 'error');
      return;
    }

    allImeis.push(...imeis);
    itemPayloads.push({
      itemIndex: idx,
      productId: order.items[idx].product,
      imeis
    });
  }

  const uniqueSet = new Set(allImeis);
  if (uniqueSet.size !== allImeis.length) {
    showToast('พบหมายเลข IMEI ซ้ำกันในรายการที่สแกนกรอก', 'error');
    return;
  }

  try {
    const res = await apiRequest(`/purchase-orders/${orderId}/receive`, 'POST', {
      items: itemPayloads
    });

    if (res.success) {
      showToast('สแกนเติม IMEI เรียบร้อย! ส่งรายการไปยัง "ตรวจสอบรายการรับสินค้าเข้าสต็อก" รอฝ่ายสต็อกกดยืนยันเข้าสต็อกจริง');
      closeModal();
      if (state.currentView === 'goods-receipt') {
        renderGoodsReceiptView();
      } else {
        renderBranchPurchaseOrdersView();
      }
    }
  } catch (err) {
    // Handled
  }
}

/* ==========================================================================
   VIEW 4: GOODS RECEIPT (DIRECT PRODUCT SPEC ENTRY BY STORE STAFF)
   ========================================================================== */
async function renderGoodsReceiptView() {
  const container = document.getElementById('content-container');
  container.innerHTML = `<div style="padding: 2rem; text-align: center; color: var(--text-muted);"><i class="fa-solid fa-spinner fa-spin" style="font-size:2rem;"></i> กำลังโหลดข้อมูลรับสินค้าเข้าสต็อก...</div>`;

  try {
    await loadMasterOptions();
    const { brands = [], models = [], capacities = [], colors = [], categories = [], branches = [] } = state.masterOptions;

    // Fetch past goods receipts
    let receipts = [];
    try {
      const rcptRes = await apiRequest('/stock/receipts');
      if (rcptRes.success) {
        receipts = rcptRes.receipts || [];
      }
    } catch (rcptErr) {
      console.warn('Unable to load receipt history:', rcptErr);
    }
    window.currentGoodsReceipts = receipts;

    let userBranches = branches;
    if (state.user && state.user.branch) {
      const userBranchId = String(state.user.branch._id || state.user.branch);
      const filtered = branches.filter(b => String(b._id) === userBranchId);
      if (filtered.length > 0) {
        userBranches = filtered;
      } else {
        userBranches = [{
          _id: userBranchId,
          name: state.user.branch.name || 'สาขาของฉัน'
        }];
      }
    }

    const initialBrand = brands[0] ? brands[0].value : '';
    const initialModel = models[0] ? models[0].value : '';
    const initialCapacity = capacities[0] ? capacities[0].value : '';
    const initialColor = colors[0] ? colors[0].value : '';

    const initialName = generateAutoName(initialBrand, initialModel, initialCapacity, initialColor);

    // Fetch pending_imei purchase orders for quick IMEI fill
    let pendingPoOrders = [];
    try {
      const poRes = await apiRequest('/purchase-orders');
      if (poRes.success) {
        pendingPoOrders = (poRes.orders || []).filter(o => o.status === 'pending_imei');
        // If branch_staff / technical_staff, filter to own branch only
        if (state.user && state.user.branch && ['branch_staff', 'technical_staff'].includes(state.user.role)) {
          const userBranchId = String(state.user.branch._id || state.user.branch);
          pendingPoOrders = pendingPoOrders.filter(o => {
            const oBranchId = o.branch ? String(o.branch._id || o.branch) : '';
            return oBranchId === userBranchId;
          });
        }
      }
    } catch (poErr) {
      console.warn('Unable to load purchase orders for goods-receipt view:', poErr);
    }

    // Build pending PO quick-receive section HTML
    let pendingPoSectionHtml = '';
    if (pendingPoOrders.length > 0) {
      const poRows = pendingPoOrders.map(order => {
        const totalQty = (order.items || []).reduce((sum, it) => sum + (it.quantity || 0), 0);
        const itemNames = (order.items || []).map(it => it.productName).join(', ');
        const dateStr = new Date(order.createdAt).toLocaleDateString('th-TH');
        return `
          <tr>
            <td>
              <strong style="color:#38bdf8;">${order.orderNumber}</strong><br>
              <span style="font-size:0.78rem; color:var(--text-muted);">${dateStr}</span>
            </td>
            <td><strong>${order.branchName || '-'}</strong></td>
            <td style="font-size:0.82rem; max-width:260px; word-break:break-word;">${itemNames}</td>
            <td style="text-align:center;">
              <span class="badge badge-yellow" style="font-size:0.78rem;">${totalQty} เครื่อง</span>
            </td>
            <td style="text-align:center;">
              <button class="btn btn-success btn-sm" style="white-space:nowrap; font-size:0.8rem; padding:0.35rem 0.85rem; font-weight:700;" onclick="openFillImeiAndReceiveModal('${order._id}')">
                <i class="fa-solid fa-barcode"></i> สแกนเติม IMEI & รับเข้าสต็อก
              </button>
            </td>
          </tr>
        `;
      }).join('');

      pendingPoSectionHtml = `
        <div class="card" style="max-width:950px; margin:0 auto 1.5rem auto; border:1px solid rgba(251,191,36,0.35); background:rgba(251,191,36,0.05);">
          <div style="display:flex; align-items:center; gap:0.6rem; margin-bottom:0.8rem;">
            <i class="fa-solid fa-bell" style="color:#fbbf24; font-size:1.1rem;"></i>
            <h4 style="font-size:1.05rem; font-weight:800; color:#fbbf24; margin:0;">ใบสั่งซื้อที่รอเติม IMEI & รับเข้าสต็อก</h4>
            <span class="badge badge-yellow" style="font-size:0.82rem;">${pendingPoOrders.length} ใบ</span>
          </div>
          <p style="font-size:0.83rem; color:var(--text-muted); margin-bottom:0.8rem;">
            ใบสั่งซื้อเหล่านี้ได้รับการอนุมัติและหักวงเงินแล้ว กรุณากดปุ่ม <strong style="color:#34d399;">สแกนเติม IMEI</strong> เพื่อบันทึกสินค้าเข้าสต็อก
          </p>
          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>เลขที่ใบสั่งซื้อ</th>
                  <th>สาขา</th>
                  <th>รายการสินค้า</th>
                  <th style="text-align:center;">จำนวน</th>
                  <th style="text-align:center;">ดำเนินการ</th>
                </tr>
              </thead>
              <tbody>${poRows}</tbody>
            </table>
          </div>
        </div>
      `;
    }

    container.innerHTML = `
      ${pendingPoSectionHtml}
      <!-- Entry Card -->
      <div class="card" style="max-width: 950px; margin: 0 auto 1.5rem auto;">
        <h3 style="font-size:1.2rem; font-weight:700; margin-bottom: 0.5rem; display:flex; align-items:center; gap:0.5rem;">
          <i class="fa-solid fa-truck-ramp-box" style="color:var(--accent-primary);"></i> แบบฟอร์ม รับสินค้าเข้าสต็อก (คละรุ่น / คละความจุ / คละสี)
        </h3>
        <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom: 1.5rem;">
          เลือกรุ่น สเปกสินค้า และกรอกหมายเลข IMEI แล้วกดปุ่ม <strong>"+ เพิ่มเข้ารายการคละ"</strong> เพื่อคละสินค้าต่างรุ่น/สีในรอบเดียวกันได้ไม่จำกัด
        </p>

        <div class="form-group">
          <label for="gr-branch">สาขาที่รับสินค้าเข้าสต็อก</label>
          <select id="gr-branch" class="form-select" required>
            ${userBranches.map(b => `<option value="${b._id}">${b.name}</option>`).join('')}
          </select>
        </div>

        <!-- Add Item Box -->
        <div style="background:rgba(0,0,0,0.25); border:1px solid rgba(255,255,255,0.1); padding:1.2rem; border-radius:8px; margin-bottom:1.5rem;">
          <div style="font-weight:700; color:#38bdf8; font-size:0.95rem; margin-bottom:0.8rem; display:flex; align-items:center; gap:0.4rem;">
            <i class="fa-solid fa-plus-circle"></i> ระบุข้อมูลสินค้าเครื่องที่จะรับเข้า:
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;">
            <div class="form-group">
              <label for="gr-brand">ยี่ห้อ</label>
              <select id="gr-brand" class="form-select" onchange="recalculateGrAutoFields()">
                <option value="">-- เลือกยี่ห้อ --</option>
                ${brands.map(b => `<option value="${b.value}">${b.value}</option>`).join('')}
              </select>
            </div>

            <div class="form-group">
              <label for="gr-model">ชื่อรุ่น</label>
              <select id="gr-model" class="form-select" onchange="recalculateGrAutoFields()">
                <option value="">-- เลือกชื่อรุ่น --</option>
                ${models.map(m => `<option value="${m.value}">${m.value}</option>`).join('')}
              </select>
            </div>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;">
            <div class="form-group">
              <label for="gr-capacity">ความจุ</label>
              <select id="gr-capacity" class="form-select" onchange="recalculateGrAutoFields()">
                <option value="">-- เลือกความจุ --</option>
                ${capacities.map(c => `<option value="${c.value}">${c.value}</option>`).join('')}
              </select>
            </div>

            <div class="form-group">
              <label for="gr-color">สีสินค้า</label>
              <select id="gr-color" class="form-select" onchange="recalculateGrAutoFields()">
                <option value="">-- เลือกสีสินค้า --</option>
                ${colors.map(cl => `<option value="${cl.value}">${cl.value}</option>`).join('')}
              </select>
            </div>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;">
            <div class="form-group">
              <label for="gr-category">หมวดหมู่สินค้า</label>
              <select id="gr-category" class="form-select">
                <option value="">-- เลือกหมวดหมู่ --</option>
                ${categories.map(c => `<option value="${c.value}">${c.value}</option>`).join('')}
              </select>
            </div>

            <div class="form-group">
              <label for="gr-name">ชื่อสินค้าแบบเต็ม (ประกอบให้อัตโนมัติ)</label>
              <input type="text" id="gr-name" class="form-control" value="${initialName}" style="font-weight:700; color:#34d399; background:rgba(0,0,0,0.3);" readonly>
            </div>
          </div>

          <div class="form-group" style="margin-bottom:0.8rem;">
            <label for="gr-single-imei">หมายเลขซีเรียล / IMEI <span style="color:#ef4444;">*</span></label>
            <div style="display:flex; gap:0.8rem;">
              <input type="text" id="gr-single-imei" class="form-control" placeholder="สแกน หรือ พิมพ์หมายเลข IMEI" style="font-family:monospace; font-weight:700; color:#fbbf24; font-size:1.05rem;" onkeypress="if(event.key==='Enter'){ event.preventDefault(); addStagedGoodsReceiptItem(); }">
              <button type="button" class="btn btn-warning" onclick="addStagedGoodsReceiptItem()" style="white-space:nowrap; font-weight:700;">
                <i class="fa-solid fa-cart-plus"></i> + เพิ่มเข้ารายการคละ
              </button>
            </div>
          </div>
        </div>

        <!-- Staged Items Table -->
        <div style="margin-bottom:1.5rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.6rem;">
            <div style="font-weight:700; color:#fff; font-size:1rem; display:flex; align-items:center; gap:0.4rem;">
              <i class="fa-solid fa-list-check" style="color:var(--accent-gold);"></i> ตารางรายการสินค้าคละที่เตรียมรับเข้า
              <span id="staged-count-badge" class="badge badge-gold" style="font-size:0.8rem;">${(window.stagedGoodsReceiptItems || []).length} เครื่อง</span>
            </div>
            ${(window.stagedGoodsReceiptItems || []).length > 0 ? `
              <button type="button" class="btn btn-sm btn-danger" onclick="clearAllStagedGoodsReceiptItems()">
                <i class="fa-solid fa-trash-can"></i> ล้างรายการทั้งหมด
              </button>
            ` : ''}
          </div>

          <div class="table-container" style="background:rgba(0,0,0,0.2); border-radius:6px;">
            <table class="data-table">
              <thead>
                <tr>
                  <th style="width:40px; text-align:center;">#</th>
                  <th>รายละเอียดสินค้า</th>
                  <th>หมวดหมู่</th>
                  <th>หมายเลข IMEI / ซีเรียล</th>
                  <th style="text-align:center; width:80px;">จัดการ</th>
                </tr>
              </thead>
              <tbody id="staged-items-tbody">
                <!-- Rendered by renderStagedItemsTable() -->
              </tbody>
            </table>
          </div>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:0.8rem;">
          <button type="button" class="btn btn-secondary" onclick="navigateTo('dashboard')">ยกเลิก</button>
          <button type="button" id="submit-batch-gr-btn" class="btn btn-primary" onclick="submitBatchGoodsReceipt()" style="padding:0.65rem 1.4rem; font-size:0.95rem; font-weight:700;" ${(window.stagedGoodsReceiptItems || []).length === 0 ? 'disabled' : ''}>
            <i class="fa-solid fa-paper-plane"></i> บันทึกรับสินค้าเข้าสต็อกทั้งหมด (${(window.stagedGoodsReceiptItems || []).length} รายการ)
          </button>
        </div>
      </div>

      <!-- History & Editing Section -->
      <div class="card" style="max-width: 950px; margin: 0 auto;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; flex-wrap:wrap; gap:0.5rem;">
          <div>
            <h4 style="font-size:1.1rem; font-weight:700; display:flex; align-items:center; gap:0.5rem;">
              <i class="fa-solid fa-clock-rotate-left" style="color:var(--accent-gold);"></i> ประวัติรายการรับสินค้าเข้าสต็อกที่คีย์ไว้
            </h4>
            <p style="font-size:0.82rem; color:var(--text-muted); margin-top:0.2rem;">
              รายการที่ขึ้นสถานะ <span class="badge badge-yellow" style="font-size:0.7rem;">🟡 รอตั้งราคา / ยืนยัน</span> สามารถกดแก้ไขข้อมูล/IMEI ได้ ก่อนที่ฝ่ายจัดซื้อจะยืนยันเข้าสต็อกจริง
            </p>
          </div>
          <div style="display:flex; align-items:center; gap:0.5rem;">
            <button class="btn btn-success btn-sm" onclick="exportGoodsReceiptHistoryToExcel()"><i class="fa-solid fa-file-excel"></i> Export Excel</button>
            <button class="btn btn-secondary btn-sm" onclick="renderGoodsReceiptView()"><i class="fa-solid fa-rotate"></i> รีเฟรชประวัติ</button>
          </div>
        </div>

        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>เลขที่ใบรับ / วันเวลา</th>
                <th>สาขา & ผู้รับสินค้า</th>
                <th>รายละเอียดสินค้า</th>
                <th>หมายเลข IMEI</th>
                <th>สถานะการรับเข้า</th>
                <th style="text-align:center;">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              ${receipts.length === 0 ? `<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:2rem;">ยังไม่มีประวัติการรับสินค้าเข้าสต็อก</td></tr>` : ''}
              ${receipts.map(r => {
                const p = r.productInfo || {};
                const isPending = r.status === 'pending_pricing';
                const isConfirmed = r.status === 'confirmed';
                const dateStr = new Date(r.createdAt).toLocaleString('th-TH');

                return `
                  <tr class="receipt-history-row">
                    <td>
                      <strong style="color:#38bdf8;">${r.receiptNumber}</strong><br>
                      <span style="font-size:0.78rem; color:var(--text-muted);">${dateStr}</span>
                    </td>
                    <td>
                      <strong>${r.branch ? r.branch.name : '-'}</strong><br>
                      <span style="font-size:0.78rem; color:var(--text-muted);">ผู้บันทึก: ${r.receivedBy ? (r.receivedBy.fullName || r.receivedBy.username) : '-'}</span>
                    </td>
                    <td>
                      <strong style="color:#fff;">${p.name || '-'}</strong><br>
                      <span style="font-size:0.78rem; color:var(--text-muted);">${p.brand || ''} | ${p.model || ''} (${p.category || ''})</span>
                    </td>
                    <td>
                      <span style="font-family:monospace; font-weight:700; color:#fbbf24;">${(r.imeiSerials && r.imeiSerials[0]) || '-'}</span>
                    </td>
                    <td>
                      ${isPending ? '<span class="badge badge-yellow"><i class="fa-solid fa-clock"></i> รอตั้งราคา / ยืนยัน</span>' :
                        isConfirmed ? '<span class="badge badge-green"><i class="fa-solid fa-check-double"></i> ยืนยันเข้าสต็อกจริงแล้ว</span>' :
                        '<span class="badge badge-red"><i class="fa-solid fa-xmark"></i> ถูกปฏิเสธ</span>'}
                    </td>
                    <td style="text-align:center;">
                      ${isPending ? `
                        <button class="btn btn-sm btn-warning" onclick="openEditGoodsReceiptModal('${r._id}')" style="font-size:0.75rem; padding:0.35rem 0.75rem;">
                          <i class="fa-solid fa-pen-to-square"></i> แก้ไขรายการ
                        </button>
                      ` : `
                        <span style="font-size:0.78rem; color:var(--text-muted); font-style:italic;">
                          <i class="fa-solid fa-lock"></i> ยืนยันแล้ว (ล็อก)
                        </span>
                      `}
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    renderStagedItemsTable();
  } catch (err) {
    container.innerHTML = `<div style="color:#ef4444;">${err.message}</div>`;
  }
}

function openEditGoodsReceiptModal(receiptId) {
  const receipts = window.currentGoodsReceipts || [];
  const receipt = receipts.find(r => r._id === receiptId);

  if (!receipt) {
    showToast('ไม่พบข้อมูลรายการรับสินค้า', 'error');
    return;
  }

  const { brands = [], models = [], capacities = [], colors = [], categories = [] } = state.masterOptions || {};
  const p = receipt.productInfo || {};
  const currentImei = (receipt.imeiSerials && receipt.imeiSerials[0]) || '';

  const bodyHtml = `
    <div style="background:rgba(0,0,0,0.2); padding:0.8rem; border-radius:6px; margin-bottom:1rem;">
      <div style="font-weight:700; color:#38bdf8; font-size:0.95rem; margin-bottom:0.2rem;">
        เลขที่ใบรับ: <strong>${receipt.receiptNumber}</strong>
      </div>
      <div style="font-size:0.82rem; color:var(--text-muted);">
        สาขา: ${receipt.branch ? receipt.branch.name : '-'} | สถานะ: <span class="badge badge-yellow">รอฝ่ายจัดซื้อตั้งราคา/ยืนยัน</span>
      </div>
    </div>

    <form id="edit-gr-modal-form" onsubmit="event.preventDefault(); submitEditGoodsReceipt('${receipt._id}');">
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.8rem;">
        <div class="form-group">
          <label for="edit-gr-brand">ยี่ห้อ</label>
          <select id="edit-gr-brand" class="form-select" onchange="recalculateEditGrAutoFields()" required>
            ${brands.map(b => `<option value="${b.value}" ${b.value === p.brand ? 'selected' : ''}>${b.value}</option>`).join('')}
          </select>
        </div>

        <div class="form-group">
          <label for="edit-gr-model">ชื่อรุ่น</label>
          <select id="edit-gr-model" class="form-select" onchange="recalculateEditGrAutoFields()" required>
            ${models.map(m => `<option value="${m.value}" ${m.value === p.model ? 'selected' : ''}>${m.value}</option>`).join('')}
          </select>
        </div>
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.8rem;">
        <div class="form-group">
          <label for="edit-gr-capacity">ความจุ</label>
          <select id="edit-gr-capacity" class="form-select" onchange="recalculateEditGrAutoFields()">
            <option value="">-- ไม่ระบุ --</option>
            ${capacities.map(c => `<option value="${c.value}" ${c.value === p.capacity ? 'selected' : ''}>${c.value}</option>`).join('')}
          </select>
        </div>

        <div class="form-group">
          <label for="edit-gr-color">สีสินค้า</label>
          <select id="edit-gr-color" class="form-select" onchange="recalculateEditGrAutoFields()">
            <option value="">-- ไม่ระบุ --</option>
            ${colors.map(cl => `<option value="${cl.value}" ${cl.value === p.color ? 'selected' : ''}>${cl.value}</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="form-group">
        <label for="edit-gr-category">หมวดหมู่สินค้า</label>
        <select id="edit-gr-category" class="form-select" required>
          ${categories.map(c => `<option value="${c.value}" ${c.value === p.category ? 'selected' : ''}>${c.value}</option>`).join('')}
        </select>
      </div>

      <div class="form-group">
        <label for="edit-gr-name">ชื่อสินค้าแบบเต็ม</label>
        <input type="text" id="edit-gr-name" class="form-control" value="${p.name || ''}" style="font-weight:700; color:#34d399; background:rgba(0,0,0,0.3);" readonly>
      </div>

      <div class="form-group">
        <label for="edit-gr-imei">หมายเลขซีเรียล / IMEI</label>
        <input type="text" id="edit-gr-imei" class="form-control" value="${currentImei}" style="font-family:monospace; font-weight:700; color:#fbbf24;" required>
      </div>
    </form>
  `;

  const footerHtml = `
    <button type="button" class="btn btn-danger" onclick="deleteGoodsReceiptItem('${receipt._id}')" style="margin-right:auto;">
      <i class="fa-solid fa-trash"></i> ยกเลิกรายการนี้
    </button>
    <button type="button" class="btn btn-secondary" onclick="closeModal()">ปิดหน้าต่าง</button>
    <button type="button" class="btn btn-primary" onclick="submitEditGoodsReceipt('${receipt._id}')">
      <i class="fa-solid fa-floppy-disk"></i> บันทึกการแก้ไข
    </button>
  `;

  openModal(`แก้ไขรายการรับสินค้า - ${receipt.receiptNumber}`, bodyHtml, footerHtml);
}

function recalculateEditGrAutoFields() {
  const brand = document.getElementById('edit-gr-brand') ? document.getElementById('edit-gr-brand').value : '';
  const model = document.getElementById('edit-gr-model') ? document.getElementById('edit-gr-model').value : '';
  const capacity = document.getElementById('edit-gr-capacity') ? document.getElementById('edit-gr-capacity').value : '';
  const color = document.getElementById('edit-gr-color') ? document.getElementById('edit-gr-color').value : '';

  const nameInput = document.getElementById('edit-gr-name');
  if (nameInput) {
    nameInput.value = generateAutoName(brand, model, capacity, color);
  }
}

async function submitEditGoodsReceipt(receiptId) {
  const brand = document.getElementById('edit-gr-brand').value;
  const model = document.getElementById('edit-gr-model').value;
  const capacity = document.getElementById('edit-gr-capacity').value;
  const color = document.getElementById('edit-gr-color').value;
  const category = document.getElementById('edit-gr-category').value;
  const imei = document.getElementById('edit-gr-imei').value.trim();

  if (!brand || !model || !category || !imei) {
    showToast('กรุณากรอก ยี่ห้อ, ชื่อรุ่น, หมวดหมู่ และหมายเลข IMEI ให้ครบถ้วน', 'error');
    return;
  }

  try {
    const res = await apiRequest(`/stock/receipts/${receiptId}`, 'PUT', {
      brand,
      model,
      capacity,
      color,
      category,
      imei
    });

    if (res.success) {
      showToast(res.message);
      closeModal();
      renderGoodsReceiptView();
    }
  } catch (err) {
    // Handled
  }
}

async function deleteGoodsReceiptItem(receiptId) {
  if (!confirm('คุณต้องการยกเลิก/ลบรายการรับสินค้านี้ออกใช่หรือไม่? (รายการที่ลบจะถูกยกเลิกถาวร)')) return;

  try {
    const res = await apiRequest(`/stock/receipts/${receiptId}`, 'DELETE');
    if (res.success) {
      showToast(res.message);
      closeModal();
      renderGoodsReceiptView();
    }
  } catch (err) {
    // Handled
  }
}

function renderStagedItemsTable() {
  const tbody = document.getElementById('staged-items-tbody');
  const countBadge = document.getElementById('staged-count-badge');
  const submitBtn = document.getElementById('submit-batch-gr-btn');
  const items = window.stagedGoodsReceiptItems || [];

  if (countBadge) countBadge.innerText = `${items.length} เครื่อง`;
  if (submitBtn) {
    submitBtn.disabled = items.length === 0;
    submitBtn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> บันทึกรับสินค้าเข้าสต็อกทั้งหมด (${items.length} รายการ)`;
  }

  if (!tbody) return;

  if (items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-muted); padding:1.5rem; font-style:italic;">ยังไม่มีรายการสินค้าคละในตาราง (กรอกข้อมูลสเปกสินค้าและ IMEI แล้วกด "+ เพิ่มเข้ารายการคละ")</td></tr>`;
    return;
  }

  tbody.innerHTML = items.map((it, idx) => `
    <tr>
      <td style="text-align:center; font-weight:700;">${idx + 1}</td>
      <td>
        <strong style="color:#34d399;">${it.name}</strong><br>
        <span style="font-size:0.78rem; color:var(--text-muted);">${it.brand} | ${it.model} ${it.capacity ? '| ' + it.capacity : ''} ${it.color ? '| ' + it.color : ''}</span>
      </td>
      <td><span class="badge badge-gray" style="font-size:0.7rem;">${it.category}</span></td>
      <td><span style="font-family:monospace; font-weight:700; color:#fbbf24; font-size:0.95rem;">${it.imei}</span></td>
      <td style="text-align:center; white-space:nowrap;">
        <button type="button" class="btn btn-sm btn-warning" onclick="openEditStagedItemModal(${idx})" style="padding:0.25rem 0.5rem; font-size:0.75rem; margin-right:0.3rem;">
          <i class="fa-solid fa-pen"></i> แก้ไข
        </button>
        <button type="button" class="btn btn-sm btn-danger" onclick="removeStagedGoodsReceiptItem(${idx})" style="padding:0.25rem 0.5rem; font-size:0.75rem;">
          <i class="fa-solid fa-xmark"></i> ลบ
        </button>
      </td>
    </tr>
  `).join('');
}

function openEditStagedItemModal(idx) {
  const items = window.stagedGoodsReceiptItems || [];
  const it = items[idx];
  if (!it) return;

  const { brands = [], models = [], capacities = [], colors = [], categories = [] } = state.masterOptions || {};

  const bodyHtml = `
    <form id="edit-staged-item-form" onsubmit="event.preventDefault(); submitEditStagedItem(${idx});">
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.8rem;">
        <div class="form-group">
          <label for="edit-staged-brand">ยี่ห้อ</label>
          <select id="edit-staged-brand" class="form-select" onchange="recalculateEditStagedAutoFields()" required>
            ${brands.map(b => `<option value="${b.value}" ${b.value === it.brand ? 'selected' : ''}>${b.value}</option>`).join('')}
          </select>
        </div>

        <div class="form-group">
          <label for="edit-staged-model">ชื่อรุ่น</label>
          <select id="edit-staged-model" class="form-select" onchange="recalculateEditStagedAutoFields()" required>
            ${models.map(m => `<option value="${m.value}" ${m.value === it.model ? 'selected' : ''}>${m.value}</option>`).join('')}
          </select>
        </div>
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.8rem;">
        <div class="form-group">
          <label for="edit-staged-capacity">ความจุ</label>
          <select id="edit-staged-capacity" class="form-select" onchange="recalculateEditStagedAutoFields()">
            <option value="">-- ไม่ระบุ --</option>
            ${capacities.map(c => `<option value="${c.value}" ${c.value === it.capacity ? 'selected' : ''}>${c.value}</option>`).join('')}
          </select>
        </div>

        <div class="form-group">
          <label for="edit-staged-color">สีสินค้า</label>
          <select id="edit-staged-color" class="form-select" onchange="recalculateEditStagedAutoFields()">
            <option value="">-- ไม่ระบุ --</option>
            ${colors.map(cl => `<option value="${cl.value}" ${cl.value === it.color ? 'selected' : ''}>${cl.value}</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="form-group">
        <label for="edit-staged-category">หมวดหมู่สินค้า</label>
        <select id="edit-staged-category" class="form-select" required>
          ${categories.map(c => `<option value="${c.value}" ${c.value === it.category ? 'selected' : ''}>${c.value}</option>`).join('')}
        </select>
      </div>

      <div class="form-group">
        <label for="edit-staged-name">ชื่อสินค้าแบบเต็ม</label>
        <input type="text" id="edit-staged-name" class="form-control" value="${it.name}" style="font-weight:700; color:#34d399; background:rgba(0,0,0,0.3);" readonly>
      </div>

      <div class="form-group">
        <label for="edit-staged-imei">หมายเลขซีเรียล / IMEI</label>
        <input type="text" id="edit-staged-imei" class="form-control" value="${it.imei}" style="font-family:monospace; font-weight:700; color:#fbbf24;" required>
      </div>
    </form>
  `;

  const footerHtml = `
    <button type="button" class="btn btn-secondary" onclick="closeModal()">ยกเลิก</button>
    <button type="button" class="btn btn-primary" onclick="submitEditStagedItem(${idx})">
      <i class="fa-solid fa-floppy-disk"></i> บันทึกการแก้ไข
    </button>
  `;

  openModal(`แก้ไขรายการในตารางคละ (#${idx + 1})`, bodyHtml, footerHtml);
}

function recalculateEditStagedAutoFields() {
  const brand = document.getElementById('edit-staged-brand') ? document.getElementById('edit-staged-brand').value : '';
  const model = document.getElementById('edit-staged-model') ? document.getElementById('edit-staged-model').value : '';
  const capacity = document.getElementById('edit-staged-capacity') ? document.getElementById('edit-staged-capacity').value : '';
  const color = document.getElementById('edit-staged-color') ? document.getElementById('edit-staged-color').value : '';

  const nameInput = document.getElementById('edit-staged-name');
  if (nameInput) {
    nameInput.value = generateAutoName(brand, model, capacity, color);
  }
}

function submitEditStagedItem(idx) {
  const brand = document.getElementById('edit-staged-brand').value;
  const model = document.getElementById('edit-staged-model').value;
  const capacity = document.getElementById('edit-staged-capacity').value;
  const color = document.getElementById('edit-staged-color').value;
  const category = document.getElementById('edit-staged-category').value;
  const imei = document.getElementById('edit-staged-imei').value.trim();

  if (!brand || !model || !category || !imei) {
    showToast('กรุณากรอกข้อมูลยี่ห้อ, รุ่น, หมวดหมู่ และ IMEI ให้ครบถ้วน', 'error');
    return;
  }

  // Check duplicate IMEI in other staged items
  const existsOther = window.stagedGoodsReceiptItems.some((it, i) => i !== idx && it.imei === imei);
  if (existsOther) {
    showToast(`หมายเลข IMEI/ซีเรียล (${imei}) นี้ซ้ำกับรายการอื่นในตาราง`, 'error');
    return;
  }

  const name = generateAutoName(brand, model, capacity, color);

  window.stagedGoodsReceiptItems[idx] = {
    brand,
    model,
    capacity,
    color,
    category,
    name,
    imei
  };

  closeModal();
  renderStagedItemsTable();
  showToast(`อัปเดตรายการ #${idx + 1} เรียบร้อยแล้ว`, 'success');
}

function addStagedGoodsReceiptItem() {
  const brand = document.getElementById('gr-brand') ? document.getElementById('gr-brand').value : '';
  const model = document.getElementById('gr-model') ? document.getElementById('gr-model').value : '';
  const capacity = document.getElementById('gr-capacity') ? document.getElementById('gr-capacity').value : '';
  const color = document.getElementById('gr-color') ? document.getElementById('gr-color').value : '';
  const category = document.getElementById('gr-category') ? document.getElementById('gr-category').value : '';
  const imeiInput = document.getElementById('gr-single-imei');
  const imei = imeiInput ? imeiInput.value.trim() : '';

  if (!brand || !model || !category) {
    showToast('กรุณาเลือก ยี่ห้อ, ชื่อรุ่น และ หมวดหมู่สินค้าให้เรียบร้อยก่อนกดเพิ่ม', 'error');
    return;
  }

  if (!imei) {
    showToast('กรุณาระบุหมายเลข IMEI / ซีเรียลของเครื่องที่จะรับเข้า', 'error');
    if (imeiInput) imeiInput.focus();
    return;
  }

  window.stagedGoodsReceiptItems = window.stagedGoodsReceiptItems || [];

  const existsInStaged = window.stagedGoodsReceiptItems.some(it => it.imei === imei);
  if (existsInStaged) {
    showToast(`หมายเลข IMEI/ซีเรียล (${imei}) นี้มีอยู่ในรายการคละที่เตรียมรับเข้าแล้ว`, 'error');
    return;
  }

  const name = generateAutoName(brand, model, capacity, color);

  window.stagedGoodsReceiptItems.push({
    brand,
    model,
    capacity,
    color,
    category,
    name,
    imei
  });

  if (imeiInput) {
    imeiInput.value = '';
    imeiInput.focus();
  }

  renderStagedItemsTable();
  showToast(`+ เพิ่ม ${name} (IMEI: ${imei}) เข้ารายการคละเรียบร้อยแล้ว`, 'success');
}

function removeStagedGoodsReceiptItem(idx) {
  window.stagedGoodsReceiptItems = window.stagedGoodsReceiptItems || [];
  if (idx >= 0 && idx < window.stagedGoodsReceiptItems.length) {
    window.stagedGoodsReceiptItems.splice(idx, 1);
    renderStagedItemsTable();
  }
}

function clearAllStagedGoodsReceiptItems() {
  if (!confirm('คุณต้องการล้างรายการสินค้าคละทั้งหมดใช่หรือไม่?')) return;
  window.stagedGoodsReceiptItems = [];
  renderStagedItemsTable();
}

function submitBatchGoodsReceipt() {
  const items = window.stagedGoodsReceiptItems || [];
  const branchSelect = document.getElementById('gr-branch');
  const branchName = branchSelect && branchSelect.options[branchSelect.selectedIndex] ? branchSelect.options[branchSelect.selectedIndex].text : 'สาขาของฉัน';
  const branchId = branchSelect ? branchSelect.value : null;

  if (items.length === 0) {
    showToast('กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการก่อนกดบันทึก', 'error');
    return;
  }

  const bodyHtml = `
    <div style="margin-bottom:1rem; background:rgba(255,193,7,0.1); border:1px solid rgba(255,193,7,0.3); padding:0.8rem 1rem; border-radius:6px;">
      <div style="font-weight:700; color:#fbbf24; font-size:1.05rem; display:flex; align-items:center; gap:0.5rem; margin-bottom:0.3rem;">
        <i class="fa-solid fa-triangle-exclamation"></i> ยืนยันการรับสินค้าเข้าสต็อก (${items.length} รายการ)
      </div>
      <div style="font-size:0.85rem; color:var(--text-muted);">
        สาขาที่รับเข้า: <strong style="color:#fff;">${branchName}</strong> | จำนวนสินค้ารวม: <strong style="color:#38bdf8;">${items.length} เครื่อง</strong>
      </div>
    </div>

    <p style="font-size:0.85rem; margin-bottom:0.8rem;">กรุณาตรวจสอบรายชื่อและหมายเลข IMEI สินค้าทั้งหมดที่จะรับเข้าสต็อกก่อนยืนยัน:</p>

    <div class="table-container" style="max-height: 320px; overflow-y: auto; background:rgba(0,0,0,0.25); border-radius:6px; margin-bottom:1rem;">
      <table class="data-table">
        <thead>
          <tr>
            <th style="width:40px; text-align:center;">#</th>
            <th>ชื่อสินค้า</th>
            <th>หมวดหมู่</th>
            <th>หมายเลข IMEI / ซีเรียล</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((it, idx) => `
            <tr>
              <td style="text-align:center; font-weight:700;">${idx + 1}</td>
              <td>
                <strong style="color:#34d399;">${it.name}</strong><br>
                <span style="font-size:0.75rem; color:var(--text-muted);">${it.brand} | ${it.model}</span>
              </td>
              <td><span class="badge badge-gray" style="font-size:0.7rem;">${it.category}</span></td>
              <td><span style="font-family:monospace; font-weight:700; color:#fbbf24; font-size:0.9rem;">${it.imei}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  const footerHtml = `
    <button type="button" class="btn btn-secondary" onclick="closeModal()">
      <i class="fa-solid fa-arrow-left"></i> ยกเลิก / กลับไปแก้ไข
    </button>
    <button type="button" class="btn btn-primary" onclick="confirmSubmitBatchGoodsReceipt('${branchId}')" style="font-weight:700; background:#059669; border-color:#059669;">
      <i class="fa-solid fa-check-double"></i> ยืนยันบันทึกเข้าสต็อกจริง (${items.length} รายการ)
    </button>
  `;

  openModal(`ตรวจสอบและยืนยันการรับสินค้าเข้าสต็อก (${items.length} รายการ)`, bodyHtml, footerHtml);
}

async function confirmSubmitBatchGoodsReceipt(branchId) {
  const items = window.stagedGoodsReceiptItems || [];

  if (items.length === 0) {
    showToast('ไม่พบรายการสินค้า', 'error');
    closeModal();
    return;
  }

  try {
    const res = await apiRequest('/stock/receive', 'POST', {
      branchId,
      items
    });

    if (res.success) {
      showToast(res.message);
      window.stagedGoodsReceiptItems = [];
      closeModal();
      renderGoodsReceiptView();
    }
  } catch (err) {
    // Handled
  }
}

function recalculateGrAutoFields() {
  const brandEl = document.getElementById('gr-brand');
  const modelEl = document.getElementById('gr-model');
  const capacityEl = document.getElementById('gr-capacity');
  const colorEl = document.getElementById('gr-color');

  const brand = brandEl ? brandEl.value : '';
  const model = modelEl ? modelEl.value : '';
  const capacity = capacityEl ? capacityEl.value : '';
  const color = colorEl ? colorEl.value : '';

  const nameInput = document.getElementById('gr-name');
  if (nameInput) {
    nameInput.value = generateAutoName(brand, model, capacity, color);
  }
}

/* ==========================================================================
   VIEW 4.5: STOCK RECEIPT VERIFICATION & PRICING (สำหรับฝ่ายสต็อก/จัดซื้อ)
   ========================================================================== */
async function renderReceiptVerificationView(filterStatus = 'all') {
  const container = document.getElementById('content-container');
  container.innerHTML = `<div style="padding: 2rem; text-align: center; color: var(--text-muted);"><i class="fa-solid fa-spinner fa-spin" style="font-size:2rem;"></i> กำลังโหลดรายการรับสินค้าเข้าสต็อก...</div>`;

  try {
    const res = await apiRequest(`/stock/receipts?status=${filterStatus}`);
    const receipts = res.receipts || [];

    const isHqOrPurchasing = ['admin', 'hq_stock_staff', 'purchase_staff'].includes(state.user.role);

    const pendingCount = receipts.filter(r => r.status === 'pending_pricing').length;

    container.innerHTML = `
      <div class="card" style="margin-bottom:1.5rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem;">
        <div>
          <h3 style="font-size:1.1rem; font-weight:700;">ตรวจสอบรายการรับสินค้าเข้าสต็อก (Stock Receipt Verification)</h3>
          <p style="font-size:0.85rem; color:var(--text-muted);">
            ฝ่ายสต็อกและจัดซื้อจะเข้ามาตรวจสอบ ใส่ราคาทุนและราคาขาย (1 รายการ ต่อ 1 IMEI) และกดยืนยันเข้าสต็อก
          </p>
        </div>

        <div style="display:flex; gap:0.5rem; flex-wrap:wrap; align-items:center;">
          ${isHqOrPurchasing && pendingCount > 0 ? `
            <button class="btn btn-warning btn-sm" onclick="openBatchConfirmReceiptModal()">
              <i class="fa-solid fa-layer-group"></i> กำหนดราคาแบบเลือกกลุ่ม (${pendingCount} รายการรอ)
            </button>
          ` : ''}
          <button class="btn ${filterStatus === 'all' ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="renderReceiptVerificationView('all')">รายการทั้งหมด</button>
          <button class="btn ${filterStatus === 'pending_pricing' ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="renderReceiptVerificationView('pending_pricing')">
            <i class="fa-solid fa-clock"></i> รอตั้งราคา (${pendingCount})
          </button>
          <button class="btn ${filterStatus === 'confirmed' ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="renderReceiptVerificationView('confirmed')">
            <i class="fa-solid fa-check-double"></i> ยืนยันแล้ว
          </button>
        </div>
      </div>

      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              ${isHqOrPurchasing ? `<th style="width:40px; text-align:center;"><input type="checkbox" id="rcpt-select-all" onchange="toggleSelectAllReceipts(this.checked)"></th>` : ''}
              <th>เลขที่ใบรับ / วันเวลา</th>
              <th>สาขา & ผู้รับสินค้า</th>
              <th>รายละเอียดสินค้า</th>
              <th>หมายเลข IMEI</th>
              <th>ราคาทุน (บาท)</th>
              <th>ราคาขาย (บาท)</th>
              <th style="text-align:center;">สถานะ & การยืนยัน</th>
            </tr>
          </thead>
          <tbody>
            ${receipts.length === 0 ? `<tr><td colspan="${isHqOrPurchasing ? 8 : 7}" style="text-align:center; color:var(--text-muted); padding:2rem;">ไม่พบรายการรับสินค้าเข้าสต็อก</td></tr>` : ''}
            ${receipts.map(r => {
              const p = r.productInfo || {};
              const isPending = r.status === 'pending_pricing';

              return `
                <tr>
                  ${isHqOrPurchasing ? `
                    <td style="text-align:center;">
                      ${isPending ? `<input type="checkbox" class="rcpt-checkbox" value="${r._id}">` : ''}
                    </td>
                  ` : ''}
                  <td>
                    <strong>${r.receiptNumber}</strong><br>
                    <span style="font-size:0.78rem; color:var(--text-muted);">${new Date(r.createdAt).toLocaleString('th-TH')}</span>
                  </td>
                  <td>
                    <strong>${r.branch ? r.branch.name : 'สาขาทั่วไป'}</strong><br>
                    <span style="font-size:0.78rem; color:var(--text-muted);">ผู้รับ: ${r.receivedBy ? r.receivedBy.fullName || r.receivedBy.username : '-'}</span>
                  </td>
                  <td>
                    <strong>${p.name}</strong><br>
                    <span style="font-size:0.78rem; color:var(--text-muted);">หมวดหมู่: ${p.category}</span>
                  </td>
                  <td>
                    <strong style="color:#38bdf8; font-size:0.9rem;">IMEI: ${(r.imeiSerials && r.imeiSerials[0]) || '-'}</strong><br>
                    <span class="badge badge-gold" style="font-size:0.7rem;">1 เครื่อง</span>
                  </td>
                  <td>${r.purchase_price ? '฿' + r.purchase_price.toLocaleString() : '<span style="color:#fbbf24;">ยังไม่ได้ตั้ง</span>'}</td>
                  <td>${r.selling_price ? '<strong style="color:#34d399;">฿' + r.selling_price.toLocaleString() + '</strong>' : '<span style="color:#fbbf24;">ยังไม่ได้ตั้ง</span>'}</td>
                  <td style="text-align:center;">
                    ${isPending ? `
                      <span class="badge badge-yellow" style="margin-bottom:0.3rem;"><i class="fa-solid fa-clock"></i> รอตั้งราคา & ยืนยัน</span><br>
                      ${isHqOrPurchasing ? `
                        <button class="btn btn-success btn-sm" style="padding:0.25rem 0.6rem; font-size:0.78rem; margin-top:0.3rem;" onclick="openConfirmReceiptModal('${r._id}', '${r.receiptNumber}', '${(p.name || '').replace(/'/g, "\\'")}')">
                          <i class="fa-solid fa-check"></i> ใส่ราคา & ยืนยัน
                        </button>
                      ` : ''}
                    ` : `
                      <span class="badge badge-green"><i class="fa-solid fa-circle-check"></i> ยืนยันเข้าสต็อกแล้ว</span><br>
                      <span style="font-size:0.75rem; color:var(--text-muted);">
                        อนุมัติโดย: ${r.confirmedBy ? r.confirmedBy.fullName || r.confirmedBy.username : '-'}
                      </span>
                    `}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div style="color:#ef4444; padding:2rem;">เกิดข้อผิดพลาดในการโหลดตรวจสอบรายการรับสินค้า: ${err.message}</div>`;
  }
}

function toggleSelectAllReceipts(checked) {
  document.querySelectorAll('.rcpt-checkbox').forEach(cb => cb.checked = checked);
}

function openBatchConfirmReceiptModal() {
  const selectedCbs = document.querySelectorAll('.rcpt-checkbox:checked');
  const selectedIds = Array.from(selectedCbs).map(cb => cb.value);

  if (selectedIds.length === 0) {
    showToast('กรุณาติ๊กเลือกรายการสินค้าที่ต้องการกำหนดราคาอย่างน้อย 1 รายการ', 'error');
    return;
  }

  const bodyHtml = `
    <div style="background:rgba(0,0,0,0.2); padding:1rem; border-radius:6px; margin-bottom:1.2rem;">
      <div style="font-weight:800; font-size:1rem; color:#38bdf8;">
        คุณเลือกสินค้าทั้งหมด: <span style="color:#34d399;">${selectedIds.length} รายการ (เครื่อง)</span>
      </div>
      <div style="font-size:0.8rem; color:var(--text-muted); margin-top:0.2rem;">
        ราคาทุนและราคาขายที่ระบุด้านล่างจะถูกนำไปใช้กับรายการสินค้าที่เลือกทั้งหมด
      </div>
    </div>

    <form id="confirm-batch-form">
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;">
        <div class="form-group">
          <label for="crb-pprice">กำหนดราคาทุน (บาท)</label>
          <input type="number" id="crb-pprice" class="form-control" min="0" placeholder="0" required autofocus>
        </div>
        <div class="form-group">
          <label for="crb-sprice">กำหนดราคาขาย (บาท)</label>
          <input type="number" id="crb-sprice" class="form-control" min="0" placeholder="0" required>
        </div>
      </div>

      <div class="form-group">
        <label for="crb-remarks">หมายเหตุการอนุมัติ (ถ้ามี)</label>
        <textarea id="crb-remarks" class="form-control" rows="2" placeholder="ระบุหมายเหตุการกำหนดราคาแบบกลุ่ม..."></textarea>
      </div>
    </form>
  `;

  const footerHtml = `
    <button class="btn btn-secondary" onclick="closeModal()">ยกเลิก</button>
    <button class="btn btn-success" onclick="submitBatchConfirmReceipt([${selectedIds.map(id => `'${id}'`).join(',')}])"><i class="fa-solid fa-check-double"></i> ยืนยันตั้งราคาทั้งหมด ${selectedIds.length} รายการ</button>
  `;

  openModal(`อนุมัติและตั้งราคาแบบเลือกกลุ่ม (${selectedIds.length} รายการ)`, bodyHtml, footerHtml);
}

async function submitBatchConfirmReceipt(receiptIds) {
  const purchase_price = document.getElementById('crb-pprice').value;
  const selling_price = document.getElementById('crb-sprice').value;
  const remarks = document.getElementById('crb-remarks').value;

  if (purchase_price === '' || selling_price === '') {
    showToast('กรุณาระบุทั้งราคาทุนและราคาขาย', 'error');
    return;
  }

  try {
    const res = await apiRequest('/stock/receipts/confirm-batch', 'PUT', {
      receiptIds,
      purchase_price: Number(purchase_price),
      selling_price: Number(selling_price),
      remarks
    });

    if (res.success) {
      showToast(res.message);
      closeModal();
      renderReceiptVerificationView();
    }
  } catch (err) {
    // Handled
  }
}

function openConfirmReceiptModal(receiptId, receiptNumber, productName) {
  const bodyHtml = `
    <div style="background:rgba(0,0,0,0.2); padding:1rem; border-radius:6px; margin-bottom:1.2rem;">
      <div style="font-weight:700; font-size:0.9rem; color:var(--accent-primary); margin-bottom:0.3rem;">
        เลขที่ใบรับสินค้า: ${receiptNumber}
      </div>
      <div style="font-size:1rem; font-weight:800; color:#fff;">
        ${productName}
      </div>
    </div>

    <form id="confirm-receipt-form">
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;">
        <div class="form-group">
          <label for="cr-pprice">กำหนดราคาทุน (บาท)</label>
          <input type="number" id="cr-pprice" class="form-control" min="0" placeholder="0" required autofocus>
        </div>
        <div class="form-group">
          <label for="cr-sprice">กำหนดราคาขาย (บาท)</label>
          <input type="number" id="cr-sprice" class="form-control" min="0" placeholder="0" required>
        </div>
      </div>

      <div class="form-group">
        <label for="cr-remarks">หมายเหตุการอนุมัติ (ถ้ามี)</label>
        <textarea id="cr-remarks" class="form-control" rows="2" placeholder="ระบุหมายเหตุหรือข้อสังเกต..."></textarea>
      </div>
    </form>
  `;

  const footerHtml = `
    <button class="btn btn-secondary" onclick="closeModal()">ยกเลิก</button>
    <button class="btn btn-success" onclick="submitConfirmReceipt('${receiptId}')"><i class="fa-solid fa-check-double"></i> ยืนยันรายการเข้าสต็อก</button>
  `;

  openModal(`ตรวจสอบ & ตั้งราคาสินค้า: ${receiptNumber}`, bodyHtml, footerHtml);
}

async function submitConfirmReceipt(receiptId) {
  const purchase_price = document.getElementById('cr-pprice').value;
  const selling_price = document.getElementById('cr-sprice').value;
  const remarks = document.getElementById('cr-remarks').value;

  if (purchase_price === '' || selling_price === '') {
    showToast('กรุณาระบุทั้งราคาทุนและราคาขาย', 'error');
    return;
  }

  try {
    const res = await apiRequest(`/stock/receipts/${receiptId}/confirm`, 'PUT', {
      purchase_price: Number(purchase_price),
      selling_price: Number(selling_price),
      remarks
    });

    if (res.success) {
      showToast(res.message);
      closeModal();
      renderReceiptVerificationView();
    }
  } catch (err) {
    // Handled
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
        <div style="display:flex; align-items:center; gap:0.5rem;">
          <button class="btn btn-success btn-sm" onclick="exportTransfersHistoryToExcel()"><i class="fa-solid fa-file-excel"></i> Export Excel</button>
          <button class="btn btn-primary btn-sm" id="create-transfer-btn"><i class="fa-solid fa-plus"></i> สร้างคำขอโอนย้ายใหม่</button>
        </div>
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
              <tr class="transfer-history-row">
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
        <label for="tr-imei">หมายเลข IMEI สินค้าที่ต้องการโอน</label>
        <input type="text" id="tr-imei" class="form-control" placeholder="สแกน หรือ พิมพ์หมายเลข IMEI 15 หลัก" required>
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
  const imeiInput = document.getElementById('tr-imei');
  const imei = imeiInput ? imeiInput.value.trim() : '';
  const quantity = parseInt(document.getElementById('tr-qty').value) || 1;
  const remarks = document.getElementById('tr-remarks').value;

  if (!imei) {
    showToast('กรุณาระบุหมายเลข IMEI สินค้าที่ต้องการโอนย้าย', 'error');
    return;
  }

  try {
    const res = await apiRequest('/stock/transfers', 'POST', {
      fromBranchId,
      toBranchId,
      items: [{ imei, quantity }],
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
              <th style="padding:8px; border:1px solid #ccc; text-align:left;">รายการสินค้า</th>
              <th style="padding:8px; border:1px solid #ccc; text-align:left;">หมายเลข IMEI / ซีเรียล</th>
              <th style="padding:8px; border:1px solid #ccc; text-align:right;">จำนวนโอน (ชิ้น)</th>
            </tr>
          </thead>
          <tbody>
            ${doc.items.map(item => {
              const imeiText = (item.imei_serials && item.imei_serials.length > 0) ? item.imei_serials.join(', ') : (item.imei || '-');
              return `
                <tr style="color:#000;">
                  <td style="padding:8px; border:1px solid #ccc;">${item.productName || (item.product ? item.product.name : 'สินค้าทั่วไป')}</td>
                  <td style="padding:8px; border:1px solid #ccc; font-family:monospace; font-weight:700;">${imeiText}</td>
                  <td style="padding:8px; border:1px solid #ccc; text-align:right;"><strong>${item.quantity}</strong></td>
                </tr>
              `;
            }).join('')}
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
   VIEW 6: PRODUCT MASTER CATALOG (AUTO FULL PRODUCT NAME)
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
          <p style="font-size:0.85rem; color:var(--text-muted);">ระบบประกอบ <strong>ชื่อสินค้าแบบเต็ม</strong> ให้อัตโนมัติจากตัวเลือก Master Data (การระบุ IMEI จะสแกนรับเข้าเมื่อมีสินค้าจริง)</p>
        </div>
        <div style="display:flex; align-items:center; gap:0.5rem;">
          <button class="btn btn-success btn-sm" onclick="exportProductsMasterToExcel()"><i class="fa-solid fa-file-excel"></i> Export Excel</button>
          ${canAddProduct ? `
            <button class="btn btn-primary btn-sm" id="create-product-btn"><i class="fa-solid fa-plus"></i> เพิ่ม Master Product ใหม่</button>
          ` : ''}
        </div>
      </div>

      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th style="width:60px; text-align:center;">ไอคอน</th>
              <th>ชื่อสินค้าแบบเต็ม (อัตโนมัติ)</th>
              <th>ยี่ห้อ / ชื่อรุ่น</th>
              <th>ความจุ / สีสินค้า</th>
              <th>หมวดหมู่</th>
              <th>ราคาทุน</th>
              <th>ราคาขาย</th>
              ${canAddProduct ? `<th style="text-align:center;">การจัดการ</th>` : ''}
            </tr>
          </thead>
          <tbody>
            ${products.length === 0 ? `<tr><td colspan="${canAddProduct ? 8 : 7}" style="text-align:center; color:var(--text-muted);">ยังไม่มีการลงทะเบียนสินค้าในระบบ</td></tr>` : ''}
            ${products.map(p => `
              <tr class="product-master-row">
                <td style="text-align:center; font-size:1.4rem; color:var(--accent-primary);">
                  <i class="fa-solid fa-mobile-screen-button"></i>
                </td>
                <td><strong>${p.name}</strong></td>
                <td><span class="badge badge-gray">${p.brand}</span> ${p.model}</td>
                <td>${p.capacity ? `<span class="badge badge-gold">${p.capacity}</span> ` : ''}${p.color || p.variation}</td>
                <td>${p.category}</td>
                <td>฿${(p.purchase_price || 0).toLocaleString()}</td>
                <td><strong style="color:#34d399;">฿${(p.selling_price || 0).toLocaleString()}</strong></td>
                ${canAddProduct ? `
                  <td style="text-align:center;">
                    <button class="btn btn-secondary btn-sm" onclick="openEditProductModal('${p._id}')">
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

  openModal('เพิ่มข้อมูลหลักสินค้า Master Product ใหม่ (สร้างชื่อสินค้าอัตโนมัติ)', bodyHtml, footerHtml);
}

async function openEditProductModal(productId) {
  openModal('กำลังโหลดข้อมูลสินค้า...', '<div style="padding:2rem; text-align:center;"><i class="fa-solid fa-spinner fa-spin fa-2x"></i></div>');

  try {
    const res = await apiRequest(`/products/${productId}`);
    const product = res.product;
    if (!product) return;

    const brands = state.masterOptions.brands || [];
    const models = state.masterOptions.models || [];
    const capacities = state.masterOptions.capacities || [];
    const colors = state.masterOptions.colors || [];
    const categories = state.masterOptions.categories || [];

    const bodyHtml = `
      <form id="edit-product-form">
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;">
          <div class="form-group">
            <label for="prod-brand">ยี่ห้อ (เลือกจาก Master List)</label>
            <select id="prod-brand" class="form-select" onchange="recalculateAutoFields()" required>
              <option value="">-- เลือกยี่ห้อ --</option>
              ${brands.map(b => `<option value="${b.value}" ${product.brand === b.value ? 'selected' : ''}>${b.value}</option>`).join('')}
            </select>
          </div>

          <div class="form-group">
            <label for="prod-model">ชื่อรุ่น (เลือกจาก Master List)</label>
            <select id="prod-model" class="form-select" onchange="recalculateAutoFields()" required>
              <option value="">-- เลือกชื่อรุ่น --</option>
              ${models.map(m => `<option value="${m.value}" ${product.model === m.value ? 'selected' : ''}>${m.value}</option>`).join('')}
            </select>
          </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;">
          <div class="form-group">
            <label for="prod-capacity">ความจุ (เลือกจาก Master List)</label>
            <select id="prod-capacity" class="form-select" onchange="recalculateAutoFields()" required>
              <option value="">-- เลือกความจุ --</option>
              ${capacities.map(c => `<option value="${c.value}" ${product.capacity === c.value ? 'selected' : ''}>${c.value}</option>`).join('')}
            </select>
          </div>

          <div class="form-group">
            <label for="prod-color">สีสินค้า (เลือกจาก Master List)</label>
            <select id="prod-color" class="form-select" onchange="recalculateAutoFields()" required>
              <option value="">-- เลือกสีสินค้า --</option>
              ${colors.map(cl => `<option value="${cl.value}" ${product.color === cl.value ? 'selected' : ''}>${cl.value}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="form-group">
          <label for="prod-category">หมวดหมู่สินค้า (เลือกจาก Master List)</label>
          <select id="prod-category" class="form-select" required>
            <option value="">-- เลือกหมวดหมู่ --</option>
            ${categories.map(c => `<option value="${c.value}" ${product.category === c.value ? 'selected' : ''}>${c.value}</option>`).join('')}
          </select>
        </div>

        <div class="form-group">
          <label for="prod-name">ชื่อสินค้าแบบเต็ม (ประกอบให้อัตโนมัติ)</label>
          <input type="text" id="prod-name" class="form-control" value="${product.name}" style="font-weight:700; color:#34d399; background:rgba(0,0,0,0.3);" placeholder="ระบบสร้างจาก ยี่ห้อ + ชื่อรุ่น + ความจุ + สี..." required>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;">
          <div class="form-group">
            <label for="prod-pprice">ราคาทุน (บาท)</label>
            <input type="number" id="prod-pprice" class="form-control" min="0" value="${product.purchase_price}" required>
          </div>
          <div class="form-group">
            <label for="prod-sprice">ราคาขาย (บาท)</label>
            <input type="number" id="prod-sprice" class="form-control" min="0" value="${product.selling_price}" required>
          </div>
        </div>
      </form>
    `;

    const footerHtml = `
      <button class="btn btn-secondary" onclick="closeModal()">ยกเลิก</button>
      <button class="btn btn-primary" onclick="submitEditProduct('${product._id}')"><i class="fa-solid fa-save"></i> บันทึกการแก้ไข Master Product</button>
    `;

    openModal(`แก้ไขข้อมูลหลักสินค้า: ${product.name}`, bodyHtml, footerHtml);
  } catch (err) {
    openModal('เกิดข้อผิดพลาด', `<p style="color:#ef4444;">${err.message}</p>`);
  }
}

async function submitEditProduct(productId) {
  const brand = document.getElementById('prod-brand').value;
  const model = document.getElementById('prod-model').value;
  const capacity = document.getElementById('prod-capacity').value;
  const color = document.getElementById('prod-color').value;
  const category = document.getElementById('prod-category').value;
  const purchase_price = document.getElementById('prod-pprice').value;
  const selling_price = document.getElementById('prod-sprice').value;
  const nameInput = document.getElementById('prod-name');

  const name = nameInput && nameInput.value ? nameInput.value.trim() : '';

  if (!name || !brand || !model || !category || purchase_price === undefined || selling_price === undefined) {
    showToast('กรุณากรอกข้อมูลให้ครบถ้วนทุกช่อง', 'error');
    return;
  }

  try {
    const res = await apiRequest(`/products/${productId}`, 'PUT', {
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
      showToast(res.message);
      closeModal();
      renderProductMasterView();
    }
  } catch (err) {
    // Handled
  }
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

  const nameInput = document.getElementById('prod-name');

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
  const nameInput = document.getElementById('prod-name');

  const name = nameInput && nameInput.value ? nameInput.value : generateAutoName(brand, model, capacity, color);

  if (!brand || !model || !category || !purchase_price || !selling_price) {
    showToast('กรุณาเลือก ยี่ห้อ, ชื่อรุ่น, หมวดหมู่ และระบุราคาให้ครบถ้วน', 'error');
    return;
  }

  try {
    const res = await apiRequest('/products', 'POST', {
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
      showToast(`บันทึกสินค้า Master Product ${res.product.name} เรียบร้อยแล้ว`);
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

/* ==========================================================================
   GLOBAL EXCEL EXPORT SYSTEM (SHEETJS / XLSX.JS)
   ========================================================================== */
function exportToExcel(dataArray, fileName, sheetName = 'Sheet1') {
  if (!dataArray || dataArray.length === 0) {
    showToast('ไม่พบข้อมูลสำหรับส่งออกไฟล์ Excel', 'warning');
    return;
  }
  if (!window.XLSX) {
    showToast('กำลังโหลดโมดูล Export Excel กรุณาลองใหม่อีกครั้ง', 'error');
    return;
  }

  try {
    const worksheet = XLSX.utils.json_to_sheet(dataArray);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    // Format auto column widths
    const max_width = dataArray.reduce((w, r) => {
      return Object.keys(r).map((k, i) => {
        const val = String(r[k] || '');
        return Math.max(w[i] || 12, val.length + 6);
      });
    }, []);
    worksheet['!cols'] = max_width.map(w => ({ wch: w }));

    const todayStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(workbook, `${fileName}_${todayStr}.xlsx`);
    showToast(`ดาวน์โหลดไฟล์ Excel: ${fileName}_${todayStr}.xlsx เรียบร้อยแล้ว`);
  } catch (err) {
    showToast(`เกิดข้อผิดพลาดในการส่งออก Excel: ${err.message}`, 'error');
  }
}

// 1. Export Executive Report
function exportExecutiveReportToExcel() {
  if (!window.lastExecutiveReportData) {
    showToast('ไม่พบข้อมูลรายงานสำหรับส่งออก Excel', 'warning');
    return;
  }
  const data = window.lastExecutiveReportData;

  const branchRows = (data.branchPerformance || []).map(b => ({
    'รหัสสาขา': b.code,
    'ชื่อสาขา': b.name,
    'จำนวนบิลขาย (บิล)': b.bills,
    'ยอดขายรวม (บาท)': b.revenue,
    'ต้นทุนรวม (บาท)': b.cost,
    'กำไรขั้นต้น (บาท)': b.profit
  }));

  exportToExcel(branchRows, 'Executive_Report_Branches', 'สรุปยอดขายรายสาขา');
}

// 2. Export Branch Inventory
function exportBranchInventoryToExcel() {
  const rows = Array.from(document.querySelectorAll('.bi-row')).map(tr => {
    const tds = tr.querySelectorAll('td');
    return {
      'รหัส SKU': tds[1] ? tds[1].innerText.trim() : '',
      'รายการสินค้า': tds[2] ? tds[2].innerText.trim() : '',
      'ยี่ห้อ / รุ่น': tds[3] ? tds[3].innerText.trim() : '',
      'ความจุ / สี': tds[4] ? tds[4].innerText.trim() : '',
      'ราคาขาย (บาท)': tds[5] ? tds[5].innerText.replace('฿', '').replace(/,/g, '').trim() : '',
      'สถานะสต็อก': tds[6] ? tds[6].innerText.trim() : '',
      'รายการ IMEI ทั้งหมด': tr.getAttribute('data-search') || ''
    };
  });
  exportToExcel(rows, 'Branch_Inventory_Stock', 'สินค้าคงคลังสาขา');
}

// 3. Export Goods Receipt History
function exportGoodsReceiptHistoryToExcel() {
  const rows = Array.from(document.querySelectorAll('.receipt-history-row')).map(tr => {
    const tds = tr.querySelectorAll('td');
    return {
      'วันที่รับสินค้า': tds[0] ? tds[0].innerText.trim() : '',
      'เลขที่ใบรับสินค้า': tds[1] ? tds[1].innerText.trim() : '',
      'สาขา': tds[2] ? tds[2].innerText.trim() : '',
      'รายการสินค้า': tds[3] ? tds[3].innerText.trim() : '',
      'หมายเลข IMEI': tds[4] ? tds[4].innerText.trim() : '',
      'ผู้บันทึก': tds[5] ? tds[5].innerText.trim() : '',
      'สถานะ': tds[6] ? tds[6].innerText.trim() : ''
    };
  });
  exportToExcel(rows, 'Goods_Receipt_History', 'ประวัติรับสินค้าเข้า');
}

// 4. Export Branch Audit Inspection
function exportBranchAuditToExcel() {
  const rows = Array.from(document.querySelectorAll('.audit-grid .audit-card')).map(card => {
    const branchName = card.querySelector('.branch-name') ? card.querySelector('.branch-name').innerText : '';
    const status = card.querySelector('.badge') ? card.querySelector('.badge').innerText : '';
    const stats = card.querySelectorAll('.stat-val');
    return {
      'ชื่อสาขา': branchName,
      'สถานะการตรวจ': status,
      'จำนวนสินค้าในคลัง': stats[0] ? stats[0].innerText : '0',
      'จำนวนนับได้จริง': stats[1] ? stats[1].innerText : '0',
      'ยอดที่ขาด/เกิน': stats[2] ? stats[2].innerText : '0'
    };
  });
  exportToExcel(rows, 'Daily_Stock_Audit_Summary', 'รายงานนับสต็อกประจำวัน');
}

// 5. Export Sales POS History
function exportSalesHistoryToExcel() {
  const rows = Array.from(document.querySelectorAll('.sales-history-row')).map(tr => {
    const tds = tr.querySelectorAll('td');
    return {
      'วันที่-เวลาขาย': tds[0] ? tds[0].innerText.trim() : '',
      'เลขที่ใบเสร็จ': tds[1] ? tds[1].innerText.trim() : '',
      'สาขา': tds[2] ? tds[2].innerText.trim() : '',
      'ชื่อลูกค้า': tds[3] ? tds[3].innerText.trim() : '',
      'รายการสินค้า / IMEI': tds[4] ? tds[4].innerText.trim() : '',
      'ยอดขายรวม (บาท)': tds[5] ? tds[5].innerText.replace('฿', '').replace(/,/g, '').trim() : '',
      'วิธีชำระเงิน': tds[6] ? tds[6].innerText.trim() : '',
      'พนักงานผู้ขาย': tds[7] ? tds[7].innerText.trim() : ''
    };
  });
  exportToExcel(rows, 'Sales_POS_History', 'ประวัติการขายสินค้า');
}

// 6. Export Financial Profit Report
function exportFinanceReportToExcel() {
  const rows = Array.from(document.querySelectorAll('.finance-report-row')).map(tr => {
    const tds = tr.querySelectorAll('td');
    return {
      'วันที่ขาย': tds[0] ? tds[0].innerText.trim() : '',
      'เลขที่ใบเสร็จ': tds[1] ? tds[1].innerText.trim() : '',
      'สาขา': tds[2] ? tds[2].innerText.trim() : '',
      'ชื่อลูกค้า': tds[3] ? tds[3].innerText.trim() : '',
      'ช่องทางชำระเงิน': tds[4] ? tds[4].innerText.trim() : '',
      'ยอดขายรวม (บาท)': tds[5] ? tds[5].innerText.replace('฿', '').replace(/,/g, '').trim() : '',
      'ต้นทุนรวม (บาท)': tds[6] ? tds[6].innerText.replace('฿', '').replace(/,/g, '').trim() : '',
      'กำไรสุทธิ (บาท)': tds[7] ? tds[7].innerText.replace('฿', '').replace(/,/g, '').trim() : '',
      'สถานะการรับเงินไฟแนนซ์': tds[8] ? tds[8].innerText.trim() : ''
    };
  });
  exportToExcel(rows, 'Financial_Profit_Report', 'รายงานการเงินและกำไร');
}

// 7. Export Product Master Catalog
function exportProductsMasterToExcel() {
  const rows = Array.from(document.querySelectorAll('.product-master-row')).map(tr => {
    const tds = tr.querySelectorAll('td');
    return {
      'รหัส SKU': tds[0] ? tds[0].innerText.trim() : '',
      'ชื่อสินค้า': tds[1] ? tds[1].innerText.trim() : '',
      'ยี่ห้อ': tds[2] ? tds[2].innerText.trim() : '',
      'ชื่อรุ่น': tds[3] ? tds[3].innerText.trim() : '',
      'ความจุ': tds[4] ? tds[4].innerText.trim() : '',
      'สีสินค้า': tds[5] ? tds[5].innerText.trim() : '',
      'ราคาซื้อต้นทุน (บาท)': tds[6] ? tds[6].innerText.replace('฿', '').replace(/,/g, '').trim() : '',
      'ราคาขาย (บาท)': tds[7] ? tds[7].innerText.replace('฿', '').replace(/,/g, '').trim() : ''
    };
  });
  exportToExcel(rows, 'Product_Master_Catalog', 'ทะเบียนสินค้าทั้งหมด');
}

// 8. Export Stock Transfer History
function exportTransfersHistoryToExcel() {
  const rows = Array.from(document.querySelectorAll('.transfer-history-row')).map(tr => {
    const tds = tr.querySelectorAll('td');
    return {
      'วันที่ทำรายการ': tds[0] ? tds[0].innerText.trim() : '',
      'เลขที่ใบโอน': tds[1] ? tds[1].innerText.trim() : '',
      'สาขาต้นทาง': tds[2] ? tds[2].innerText.trim() : '',
      'สาขาปลายทาง': tds[3] ? tds[3].innerText.trim() : '',
      'รายการสินค้า / IMEI': tds[4] ? tds[4].innerText.trim() : '',
      'ผู้ร้องขอ': tds[5] ? tds[5].innerText.trim() : '',
      'สถานะการโอน': tds[6] ? tds[6].innerText.trim() : ''
    };
  });
  exportToExcel(rows, 'Stock_Transfer_History', 'ประวัติการโอนย้ายสินค้า');
}

// Global Initialization
document.addEventListener('DOMContentLoaded', () => {
  initAppSession();
});
