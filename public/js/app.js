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
  'admin': ['dashboard', 'staff-dashboard', 'pos', 'finance', 'branch-inventory', 'hq-audit', 'branch-audit', 'goods-receipt', 'purchase-orders', 'receipt-verification', 'transfers', 'release-stock', 'master-settings', 'branches', 'employees', 'roles-permissions'],
  'hq_stock_staff': ['dashboard', 'staff-dashboard', 'pos', 'finance', 'branch-inventory', 'hq-audit', 'branch-audit', 'goods-receipt', 'purchase-orders', 'receipt-verification', 'transfers', 'release-stock', 'master-settings'],
  'branch_staff': ['dashboard', 'staff-dashboard', 'pos', 'finance', 'branch-inventory', 'branch-audit', 'goods-receipt', 'purchase-orders', 'receipt-verification', 'transfers'],
  'technical_staff': ['dashboard', 'staff-dashboard', 'pos', 'branch-inventory', 'branch-audit', 'goods-receipt', 'purchase-orders'],
  'purchase_staff': ['dashboard', 'staff-dashboard', 'finance', 'branch-inventory', 'goods-receipt', 'purchase-orders', 'receipt-verification', 'master-settings']
};


const ALL_SYSTEM_MENUS = [
  'dashboard', 'staff-dashboard', 'pos', 'finance', 'branch-inventory', 'hq-audit', 'branch-audit',
  'goods-receipt', 'purchase-orders', 'receipt-verification', 'transfers', 'release-stock',
  'master-settings', 'branches', 'employees', 'roles-permissions', 'edit-branch-inventory', 'system-logs', 'sales-history', 'void-sale'
];

function getUserAllowedMenus(userRole) {
  const role = userRole || (state.user ? state.user.role : 'admin');
  if (role === 'admin' || (state.user && state.user.role === 'admin')) {
    return ALL_SYSTEM_MENUS;
  }
  if (state.user && Array.isArray(state.user.allowedMenus) && state.user.allowedMenus.length > 0) {
    return state.user.allowedMenus;
  }
  return ROLE_ALLOWED_VIEWS[role] || ALL_SYSTEM_MENUS;
}

// Thai Role Mapping Helper
// Role Name Resolver Helper (Code -> Name)
function formatRoleName(roleKey, rolesList = []) {
  if (!roleKey) return '-';
  
  const cache = (rolesList && rolesList.length > 0) ? rolesList : (window.masterRolesCache || []);
  const found = cache.find(r => r.code === roleKey || String(r._id) === String(roleKey));
  if (found && found.name) {
    return found.name;
  }

  const defaultRoles = {
    'admin': 'ผู้ดูแลระบบสูงสุด (Admin)',
    'hq_stock_staff': 'พนักงานคลังสินค้าส่วนกลาง (HQ Stock)',
    'branch_staff': 'พนักงานประจำสาขา (Branch Staff)',
    'purchase_staff': 'พนักงานฝ่ายจัดซื้อ (Purchasing Staff)',
    'technical_staff': 'ช่างเทคนิค (Technical Staff)'
  };

  return defaultRoles[roleKey] || roleKey;
}

function formatRoleThai(roleKey) {
  return formatRoleName(roleKey);
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

function logout() {
  state.token = null;
  state.user = null;
  localStorage.removeItem('silmin_token');
  localStorage.removeItem('silmin_user');
  const mainView = document.getElementById('main-view');
  const authView = document.getElementById('auth-view');
  if (mainView) mainView.style.display = 'none';
  if (authView) authView.style.display = 'flex';
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
    if (res.status === 401) {
      logout();
      showToast('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่', 'error');
      throw new Error('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่');
    }
    const result = await res.json();
    if (!res.ok) {
      if (result.message && (result.message.includes('เซสชันหมดอายุ') || result.message.includes('หมดอายุ') || result.message.includes('jwt expired') || result.message.includes('token'))) {
        logout();
      }
      throw new Error(result.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์');
    }
    return result;
  } catch (err) {
    if (err.message && (err.message.includes('เซสชันหมดอายุ') || err.message.includes('หมดอายุ') || err.message.includes('jwt expired') || err.message.includes('token'))) {
      logout();
    }
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
  const modalCard = document.querySelector('#app-modal .modal-card');
  if (modalCard) {
    modalCard.style.maxWidth = '';
    modalCard.style.width = '';
  }
}

function showCustomConfirm(title, message, onConfirm, onCancel = null, type = 'confirm') {
  let iconHtml = '<i class="fa-solid fa-circle-question" style="color:#0284c7;"></i>';
  let confirmBtnStyle = 'background:#0284c7; border:none;';
  
  if (type === 'warning' || type === 'danger') {
    iconHtml = '<i class="fa-solid fa-triangle-exclamation" style="color:#e11d48;"></i>';
    confirmBtnStyle = 'background:#e11d48; border:none;';
  }
  
  const bodyHtml = `
    <div style="padding:1.5rem 1rem; color:var(--text-main); font-family:'Sarabun'; text-align:center;">
      <div style="font-size:3.5rem; margin-bottom:1.2rem;">
        ${iconHtml}
      </div>
      <p style="font-size:0.95rem; line-height:1.6; white-space:pre-line; color:var(--text-main); font-weight:500; margin:0 auto; max-width:400px;">${message}</p>
    </div>
  `;
  const footerHtml = `
    <button class="btn btn-secondary" onclick="closeModal(); if(window.onCustomConfirmCancel) window.onCustomConfirmCancel();" style="font-weight:700; padding:0.55rem 1.4rem; font-size:0.85rem;">ยกเลิก</button>
    <button class="btn btn-primary" id="custom-confirm-btn" onclick="closeModal(); if(window.onCustomConfirmApprove) window.onCustomConfirmApprove();" style="padding:0.55rem 1.6rem; font-weight:700; font-size:0.85rem; ${confirmBtnStyle}">ตกลง</button>
  `;
  
  window.onCustomConfirmApprove = onConfirm;
  window.onCustomConfirmCancel = onCancel;
  
  openModal(title, bodyHtml, footerHtml);
  
  const modalCard = document.querySelector('#app-modal .modal-card');
  if (modalCard) {
    modalCard.style.maxWidth = '480px';
    modalCard.style.width = '90%';
  }
}

document.getElementById('modal-close').addEventListener('click', closeModal);

async function loadMasterOptions() {
  if (!state.token) return;
  try {
    const [masterRes, branchRes, roleRes] = await Promise.all([
      apiRequest('/master/options'),
      apiRequest('/branches'),
      apiRequest('/roles').catch(() => null)
    ]);
    if (masterRes && masterRes.success) {
      state.masterOptions = masterRes.options || { brands: [], models: [], capacities: [], colors: [], categories: [] };
      if (branchRes && branchRes.success) {
        state.masterOptions.branches = branchRes.branches || [];
      }
    }
    if (roleRes && roleRes.success) {
      window.masterRolesCache = roleRes.roles || [];
      const currentRoleEl = document.getElementById('current-user-role');
      if (currentRoleEl && state.user) {
        currentRoleEl.innerText = state.user.roleName || formatRoleThai(state.user.role);
      }
    }
  } catch (err) {
    console.error('Failed to load master options', err);
  }
}

// Apply Role-Based Sidebar Navigation Visibility
async function updateReceiptVerificationBadge() {
  try {
    if (!state.token) return;

    const res = await apiRequest('/stock/receipts');
    const receipts = res.receipts || [];
    const pendingCount = receipts.filter(r => r.status === 'pending_pricing').length;

    const navLink = document.querySelector('.sidebar-menu a[data-view="receipt-verification"]');
    if (navLink) {
      let badge = navLink.querySelector('.menu-notification-badge');
      if (pendingCount > 0) {
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'menu-notification-badge';
          badge.style.display = 'inline-flex';
          badge.style.alignItems = 'center';
          badge.style.justifyContent = 'center';
          badge.style.background = '#ef4444';
          badge.style.color = '#ffffff';
          badge.style.fontSize = '0.72rem';
          badge.style.fontWeight = '800';
          badge.style.borderRadius = '20px';
          badge.style.minWidth = '18px';
          badge.style.height = '18px';
          badge.style.padding = '0 6px';
          badge.style.marginLeft = '8px';
          badge.style.verticalAlign = 'middle';
          badge.style.lineHeight = '1';
          navLink.appendChild(badge);
        }
        badge.innerText = pendingCount;
      } else {
        if (badge) badge.remove();
      }
    }
  } catch (err) {
    console.error('Error updating receipt verification badge:', err);
  }
}

async function updateGoodsReceiptBadge() {
  try {
    if (!state.token || !state.user) return;

    const poRes = await apiRequest('/purchase-orders');
    if (!poRes.success) return;

    let pendingOrders = (poRes.orders || []).filter(o => o.status === 'pending_imei');

    const isHqUser = !state.user.branch || state.user.branch.code === 'BR-HQ01' || (state.user.branch.name && state.user.branch.name.includes('สำนักงานใหญ่'));
    const isAdminOrHq = ['admin', 'hq_stock_staff', 'purchase_staff'].includes(state.user.role) || isHqUser;

    if (!isAdminOrHq && state.user.branch) {
      const userBranchId = String(state.user.branch._id || state.user.branch);
      pendingOrders = pendingOrders.filter(o => {
        const oBranchId = o.branch ? String(o.branch._id || o.branch) : '';
        return oBranchId === userBranchId;
      });
    }

    const pendingCount = pendingOrders.length;

    const navLink = document.querySelector('.sidebar-menu a[data-view="goods-receipt"]');
    if (navLink) {
      let badge = navLink.querySelector('.menu-notification-badge');
      if (pendingCount > 0) {
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'menu-notification-badge';
          badge.style.display = 'inline-flex';
          badge.style.alignItems = 'center';
          badge.style.justifyContent = 'center';
          badge.style.background = '#ef4444';
          badge.style.color = '#ffffff';
          badge.style.fontSize = '0.72rem';
          badge.style.fontWeight = '800';
          badge.style.borderRadius = '20px';
          badge.style.minWidth = '18px';
          badge.style.height = '18px';
          badge.style.padding = '0 6px';
          badge.style.marginLeft = '8px';
          badge.style.verticalAlign = 'middle';
          badge.style.lineHeight = '1';
          navLink.appendChild(badge);
        }
        badge.innerText = pendingCount;
      } else {
        if (badge) badge.remove();
      }
    }
  } catch (err) {
    console.error('Error updating goods receipt badge:', err);
  }
}

function updateSidebarMenuByRole(userRole) {
  const allowedViews = getUserAllowedMenus(userRole);
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
  updateReceiptVerificationBadge();
  updateGoodsReceiptBadge();
}

// Client Router & View Switcher
function showPageLoading() {
  const overlay = document.getElementById('page-loading-overlay');
  if (overlay) overlay.classList.add('active');
}

function hidePageLoading() {
  const overlay = document.getElementById('page-loading-overlay');
  if (overlay) overlay.classList.remove('active');
}

async function navigateTo(viewName) {
  closeModal();
  const userRole = state.user ? (state.user ? state.user.role : 'admin') : 'branch_staff';
  const allowedViews = getUserAllowedMenus(userRole);

  if (!allowedViews.includes(viewName)) {
    showToast('ตำแหน่งของคุณไม่มีสิทธิ์เข้าถึงเมนูนี้', 'error');
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

  showPageLoading();

  try {
    switch (viewName) {
      case 'dashboard':
        heading.innerText = 'แดชบอร์ดผู้บริหาร';
        subheading.innerText = 'สรุปยอดขาย ประสิทธิภาพรายสาขา มูลค่าสต็อกสินค้าคงคลัง และสถานะการนับสต็อกประจำวันเรียลไทม์';
        await renderDashboardView();
        break;
      case 'staff-dashboard':
        heading.innerText = 'แดชบอร์ดสำหรับพนักงาน';
        subheading.innerText = 'สรุปข้อมูลพื้นฐานทั่วไป รายการขายประจำวัน สถานะสต็อกสินค้า และการส่งตรวจนับคลังประจำวัน';
        await renderStaffDashboardView();
        break;
      case 'pos':
        heading.innerText = 'ขายสินค้าหน้าร้าน & ออกใบเสร็จ';
        subheading.innerText = 'ระบบขายสินค้า ตัดสต็อก ตัด IMEI อัตโนมัติ พร้อมออกใบเสร็จรับเงินอย่างย่อ';
        await renderPosView();
        break;
      case 'finance':
        heading.innerText = 'รายงานการเงิน & กำไรจากการขาย';
        subheading.innerText = 'สรุปยอดขาย ต้นทุน กำไรสุทธิ ทั้งแบบสด/โอน และแบบจัดไฟแนนซ์ (พร้อมระบบบันทึกวันที่รับเงินไฟแนนซ์)';
        await renderFinanceView();
        break;
      case 'branch-inventory':
        heading.innerText = 'สินค้าในสาขา';
        subheading.innerText = 'รายการสินค้าคงคลังที่มีอยู่จริงในสาขาของคุณ';
        await renderBranchInventoryView();
        break;
      case 'release-stock':
        heading.innerText = 'จ่ายออกสินค้าค้างสต็อก';
        subheading.innerText = 'บันทึกการจ่ายออกสินค้าค้างสต็อกหรือชำรุดเพื่อเคลียร์คลังและคืนวงเงินเครดิตสาขา';
        await renderReleaseStockView();
        break;
      case 'hq-audit':
        heading.innerText = 'แดชบอร์ดตรวจสอบสต็อก';
        subheading.innerText = 'ตรวจสอบและอนุมัติการนับสต็อกประจำวันของสาขาทั้งหมดพร้อมระบบแจ้งเตือนสี';
        await renderHqAuditView();
        break;
      case 'branch-audit':
        heading.innerText = 'นับสต็อกประจำวัน';
        subheading.innerText = 'สแกน IMEI/ซีเรียล หรือระบุจำนวนนับจริงเพื่อคำนวณ ยอดที่ขาด/เกิน';
        await renderBranchAuditView();
        break;
      case 'goods-receipt':
        heading.innerText = 'รับสินค้าเข้าสต็อก';
        subheading.innerText = 'บันทึกรายการนำเข้าสินค้าโดยระบุตัวเลือกยี่ห้อ รุ่น ความจุ สี และ IMEI ประจำเครื่อง';
        await renderGoodsReceiptView();
        break;
      case 'purchase-orders':
        heading.innerText = 'สั่งซื้อสินค้าลงสาขา';
        subheading.innerText = 'สั่งซื้อสินค้าจากส่วนกลางลงสาขา หักเงินจากวงเงินสาขาอัตโนมัติ';
        await renderBranchPurchaseOrdersView();
        break;
      case 'receipt-verification':
        heading.innerText = 'ตรวจสอบรายการรับสินค้าเข้าสต็อก';
        subheading.innerText = 'ตรวจสอบรายการรับสินค้าจากหน้าร้าน กำหนดราคาทุนและราคาขาย พร้อมกดยืนยันเข้าสต็อก';
        await renderReceiptVerificationView();
        break;
      case 'transfers':
        heading.innerText = 'โอนย้ายสินค้าระหว่างสาขา';
        subheading.innerText = 'สร้างรายการโอนย้ายสินค้าและพิมพ์ ใบโอนย้ายสินค้าระหว่างสาขา';
        await renderTransfersView();
        break;
      case 'master-settings':
        heading.innerText = 'ตั้งค่าตัวเลือก Master Data';
        subheading.innerText = 'เพิ่มและจัดการ ยี่ห้อ, ชื่อรุ่น, ความจุ, สีสินค้า และ หมวดหมู่สินค้า เพื่อใช้งานทั่วทั้งระบบโดยไม่ต้องแก้โค้ด';
        await renderMasterSettingsView();
        break;
      case 'branches':
        heading.innerText = 'จัดการสาขา';
        subheading.innerText = 'เพิ่ม แก้ไข และเปิด/ปิดการใช้งานสาขาในระบบ';
        await renderBranchManagementView();
        break;
      case 'employees':
        heading.innerText = 'จัดการพนักงาน';
        subheading.innerText = 'จัดการพนักงาน กำหนดสิทธิ์ และมอบหมายสาขาประจำ';
        await renderEmployeeManagementView();
        break;
      case 'roles-permissions':
        heading.innerText = 'จัดการสิทธิ์และตำแหน่งงาน';
        subheading.innerText = 'สร้างตำแหน่งงานใหม่ กำหนดและปรับปรุงสิทธิ์การเข้าถึงเมนูต่าง ๆ ในระบบ';
        await renderRolesPermissionsView();
        break;
      case 'system-logs':
        heading.innerText = 'ประวัติกิจกรรมระบบ';
        subheading.innerText = 'ประวัติการดำเนินกิจกรรมที่สำคัญทั้งหมดในระบบ เช่น การขายสินค้า การโอนย้าย และการแก้ไขข้อมูลสินค้า';
        await renderSystemLogsView();
        break;
      case 'sales-history':
        heading.innerText = 'ประวัติการขายสินค้า';
        subheading.innerText = 'ประวัติการขายสินค้าและออกใบเสร็จย้อนหลังแยกตามสาขา';
        await renderSalesHistoryView();
        break;
    }
  } finally {
    hidePageLoading();
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

      showToast(`ยินดีต้อนรับคุณ ${res.user.fullName || res.user.username} (สิทธิ์: ${res.user.roleName || formatRoleThai(res.user.role)})`);
      initAppSession();
    }
  } catch (err) {
    // Handled
  }
});

document.getElementById('logout-btn').addEventListener('click', () => {
  logout();
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
  document.getElementById('current-user-role').innerText = state.user.roleName || formatRoleThai((state.user ? state.user.role : 'admin'));
  document.getElementById('current-user-avatar').innerText = (state.user.fullName || state.user.username).charAt(0).toUpperCase();

  const branchName = state.user.branch ? state.user.branch.name : 'ส่วนกลาง (สำนักงานใหญ่)';
  document.getElementById('current-branch-name').innerText = branchName;

  updateSidebarMenuByRole((state.user ? state.user.role : 'admin'));

  document.querySelectorAll('.nav-link').forEach(link => {
    link.onclick = (e) => {
      e.preventDefault();
      const targetView = link.getAttribute('data-view');
      navigateTo(targetView);
    };
  });

  loadMasterOptions();

  // Refresh receipt and goods receipt badges every 30 seconds
  if (window.receiptBadgeInterval) clearInterval(window.receiptBadgeInterval);
  window.receiptBadgeInterval = setInterval(() => {
    updateReceiptVerificationBadge();
    updateGoodsReceiptBadge();
  }, 30000);
  updateReceiptVerificationBadge();
  updateGoodsReceiptBadge();

  const allowedViews = ROLE_ALLOWED_VIEWS[(state.user ? state.user.role : 'admin')] || ['dashboard'];
  navigateTo(allowedViews[0]);
}

/* ==========================================================================
   VIEW 1.5: STAFF DASHBOARD
   ========================================================================== */
async function renderStaffDashboardView() {
  const container = document.getElementById('content-container');
  container.innerHTML = `
    <div style="padding: 3rem; text-align: center; color: var(--text-muted);">
      <i class="fa-solid fa-spinner fa-spin" style="font-size:2.5rem; color:var(--accent-primary); margin-bottom:1rem;"></i>
      <br><span style="font-size:1.1rem; font-weight:600; color:var(--text-main);">กำลังโหลดแดชบอร์ดพนักงาน...</span>
    </div>
  `;

  try {
    const res = await apiRequest('/pos/staff-dashboard');
    const stats = res.stats || {};
    const recentSales = stats.recentSales || [];
    const stockSummary = stats.stockSummary || [];

    let auditStatusBadge = `<span class="badge badge-yellow"><i class="fa-solid fa-clock"></i> ยังไม่ได้ส่งตรวจสต็อก</span>`;
    if (stats.auditSubmitted) {
      if (stats.auditStatus === 'approved') {
        auditStatusBadge = `<span class="badge badge-green"><i class="fa-solid fa-circle-check"></i> ตรวจสต็อกผ่านแล้ว (Approved)</span>`;
      } else if (stats.auditStatus === 'rejected') {
        auditStatusBadge = `<span class="badge badge-red"><i class="fa-solid fa-circle-xmark"></i> ตรวจสต็อกไม่ผ่าน (Rejected)</span>`;
      } else {
        auditStatusBadge = `<span class="badge badge-blue"><i class="fa-solid fa-paper-plane"></i> ส่งตรวจแล้ว รอการอนุมัติ</span>`;
      }
    }

    container.innerHTML = `
      <!-- KPI Stats -->
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:1.2rem; margin-bottom:1.8rem;">
        <div class="card" style="position:relative; overflow:hidden;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.6rem;">
            <span style="color: var(--text-muted); font-size: 0.85rem; font-weight:700;">ยอดขายวันนี้ (Revenue)</span>
            <i class="fa-solid fa-money-bill-trend-up" style="color: var(--accent-primary); font-size:1.4rem;"></i>
          </div>
          <div style="font-size: 1.8rem; font-weight:800; color:var(--text-main);">฿${(stats.todayRevenue || 0).toLocaleString()}</div>
          <p style="font-size: 0.78rem; color: var(--text-muted); margin-top:0.4rem;">
            รวมรายการที่ทำเสร็จสิ้นวันนี้
          </p>
        </div>

        <div class="card" style="position:relative; overflow:hidden;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.6rem;">
            <span style="color: var(--text-muted); font-size: 0.85rem; font-weight:700;">บิลสำเร็จวันนี้ (Bills)</span>
            <i class="fa-solid fa-receipt" style="color: var(--accent-gold); font-size:1.4rem;"></i>
          </div>
          <div style="font-size: 1.8rem; font-weight:800; color:var(--text-main);">${stats.todaySalesCount || 0} <span style="font-size:1rem; font-weight:500; color:var(--text-muted);">บิล</span></div>
          <p style="font-size: 0.78rem; color: var(--text-muted); margin-top:0.4rem;">
            จำนวนรายการ POS สำเร็จ
          </p>
        </div>

        <div class="card" style="position:relative; overflow:hidden;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.6rem;">
            <span style="color: var(--text-muted); font-size: 0.85rem; font-weight:700;">สต็อกสินค้าพร้อมขาย (In Stock)</span>
            <i class="fa-solid fa-boxes-stacked" style="color: #10b981; font-size:1.4rem;"></i>
          </div>
          <div style="font-size: 1.8rem; font-weight:800; color:var(--text-main);">${stats.inStockCount || 0} <span style="font-size:1rem; font-weight:500; color:var(--text-muted);">เครื่อง</span></div>
          <p style="font-size: 0.78rem; color: var(--text-muted); margin-top:0.4rem;">
            สินค้าคงเหลือในคลังสาขาปัจจุบัน
          </p>
        </div>

        <div class="card" style="position:relative; overflow:hidden;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.6rem;">
            <span style="color: var(--text-muted); font-size: 0.85rem; font-weight:700;">การนับสต็อกวันนี้ (Audit)</span>
            <i class="fa-solid fa-clipboard-list" style="color: #e11d48; font-size:1.4rem;"></i>
          </div>
          <div style="margin-top:0.3rem;">${auditStatusBadge}</div>
          <p style="font-size: 0.78rem; color: var(--text-muted); margin-top:0.6rem;">
            ต้องสแกนส่งรายงานตรวจสต็อกทุกวัน
          </p>
        </div>
      </div>

      <!-- Branch Cards Section -->
      <h3 style="font-size:1.1rem; font-weight:800; color:var(--text-main); margin:1.8rem 0 0.8rem 0; display:flex; align-items:center; gap:0.5rem;">
        <i class="fa-solid fa-store" style="color:var(--accent-primary);"></i> สรุปข้อมูลสินค้าและยอดขายรายสาขา
      </h3>
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap:1.2rem; margin-bottom:1.8rem;">
        ${(stats.branchCards || []).map(card => {
          return `
            <div class="card" style="background: linear-gradient(135deg, #ffffff, #faf8f5); border: 1px solid var(--border-color); padding: 1.4rem; border-radius:12px; display:flex; flex-direction:column; gap:1rem;">
              <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border-color); padding-bottom:0.6rem;">
                <h4 style="font-size:1.05rem; font-weight:800; color:var(--text-main); margin:0; display:flex; align-items:center; gap:0.4rem;">
                  <i class="fa-solid fa-store" style="color:var(--accent-gold);"></i> ${card.branchName}
                </h4>
                <span style="font-size:0.75rem; font-weight:700; background:rgba(0,0,0,0.04); color:var(--text-muted); padding:0.15rem 0.5rem; border-radius:4px;">
                  รหัส: ${card.branchCode}
                </span>
              </div>
              
              <div style="display:flex; flex-direction:column; gap:0.6rem;">
                <!-- Total Stock Today -->
                <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.88rem;">
                  <span style="color:var(--text-muted); display:flex; align-items:center; gap:0.4rem;">
                    <i class="fa-solid fa-layer-group" style="width:16px; color:#0891b2;"></i> สินค้าทั้งหมดของวันนี้:
                  </span>
                  <strong style="color:var(--text-main);">${card.totalStockToday.toLocaleString()} เครื่อง</strong>
                </div>

                <!-- Stock -->
                <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.88rem;">
                  <span style="color:var(--text-muted); display:flex; align-items:center; gap:0.4rem;">
                    <i class="fa-solid fa-boxes-stacked" style="width:16px; color:#10b981;"></i> สินค้าคงเหลือขณะนี้:
                  </span>
                  <strong style="color:var(--text-main);">${card.totalStockCount.toLocaleString()} เครื่อง</strong>
                </div>

                <!-- Today Sales Qty -->
                <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.88rem;">
                  <span style="color:var(--text-muted); display:flex; align-items:center; gap:0.4rem;">
                    <i class="fa-solid fa-cart-shopping" style="width:16px; color:#e11d48;"></i> วันนี้ขายได้แล้ว:
                  </span>
                  <strong style="color:var(--text-main);">${card.todaySalesQty.toLocaleString()} เครื่อง</strong>
                </div>

                <!-- Today Revenue -->
                <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.88rem;">
                  <span style="color:var(--text-muted); display:flex; align-items:center; gap:0.4rem;">
                    <i class="fa-solid fa-wallet" style="width:16px; color:var(--accent-primary);"></i> ยอดขายวันนี้:
                  </span>
                  <strong style="color:var(--accent-gold); font-size:1rem;">฿${card.todaySalesAmount.toLocaleString()}</strong>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>

      <!-- Main Layout Panels -->
      <div style="display:grid; grid-template-columns: 1.5fr 1fr; gap:1.5rem; align-items:start;" class="grid-1_5-1">
        <!-- Recent Sales Section -->
        <div class="card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.2rem; border-bottom:1px solid var(--border-color); padding-bottom:0.8rem;">
            <h3 style="font-size:1.1rem; font-weight:800; color:var(--text-main); display:flex; align-items:center; gap:0.5rem; margin:0;">
              <i class="fa-solid fa-clock-rotate-left" style="color:var(--accent-primary);"></i> รายการขายล่าสุดของสาขาวันนี้
            </h3>
            <button class="btn btn-secondary btn-sm" onclick="navigateTo('sales-history')" style="font-size:0.78rem; padding:0.3rem 0.6rem;">
              ดูประวัติทั้งหมด <i class="fa-solid fa-arrow-right"></i>
            </button>
          </div>

          <div class="table-container" style="border:none; margin:0;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>เลขที่ใบเสร็จ / เวลา</th>
                  <th>ผู้ขาย</th>
                  <th>การชำระเงิน</th>
                  <th>ยอดขายสุทธิ</th>
                </tr>
              </thead>
              <tbody>
                ${recentSales.length === 0 ? `<tr><td colspan="4" style="text-align:center; color:var(--text-muted); padding:2rem;">ยังไม่มีรายการขายเกิดขึ้นในวันนี้</td></tr>` : ''}
                ${recentSales.map(s => {
                  const timeStr = new Date(s.createdAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
                  let payBadge = '';
                  if (s.paymentMethod === 'cash') payBadge = '<span class="badge badge-green">เงินสด</span>';
                  else if (s.paymentMethod === 'transfer') payBadge = '<span class="badge badge-blue">โอนเงิน</span>';
                  else if (s.paymentMethod === 'credit_card') payBadge = '<span class="badge badge-gray">บัตรเครดิต</span>';
                  else payBadge = `<span class="badge badge-gold">ไฟแนนซ์</span>`;

                  return `
                    <tr>
                      <td>
                        <strong>${s.receiptNumber}</strong><br>
                        <span style="font-size:0.75rem; color:var(--text-muted);">เวลา: ${timeStr} น.</span>
                      </td>
                      <td><span style="font-size:0.85rem;">${s.soldBy ? s.soldBy.fullName || s.soldBy.username : '-'}</span></td>
                      <td>${payBadge}</td>
                      <td><strong style="color:var(--accent-gold);">฿${(s.grandTotal || 0).toLocaleString()}</strong></td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Top Stock Items Section -->
        <div class="card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.2rem; border-bottom:1px solid var(--border-color); padding-bottom:0.8rem;">
            <h3 style="font-size:1.1rem; font-weight:800; color:var(--text-main); display:flex; align-items:center; gap:0.5rem; margin:0;">
              <i class="fa-solid fa-boxes-packing" style="color:var(--accent-gold);"></i> สินค้าคงคลังแยกตามรุ่น
            </h3>
            <button class="btn btn-secondary btn-sm" onclick="navigateTo('branch-inventory')" style="font-size:0.78rem; padding:0.3rem 0.6rem;">
              ดูสต็อกทั้งหมด
            </button>
          </div>

          <div style="display:flex; flex-direction:column; gap:0.6rem;">
            ${stockSummary.length === 0 ? `<div style="text-align:center; color:var(--text-muted); padding:2rem; font-size:0.85rem;">ไม่มีสินค้าคงคลังในสาขาขณะนี้</div>` : ''}
            ${stockSummary.map((item, idx) => {
              const colors = ['rgba(8,145,178,0.08)', 'rgba(217,119,6,0.08)', 'rgba(5,150,105,0.08)', 'rgba(225,29,72,0.08)'];
              const textColors = ['#0891b2', '#d97706', '#059669', '#e11d48'];
              const colIdx = idx % colors.length;

              return `
                <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.02); border:1px solid var(--border-color); padding:0.6rem 0.8rem; border-radius:8px;">
                  <div style="display:flex; align-items:center; gap:0.6rem; max-width:80%;">
                    <div style="width:24px; height:24px; border-radius:50%; background:${colors[colIdx]}; color:${textColors[colIdx]}; display:flex; align-items:center; justify-content:center; font-size:0.75rem; font-weight:800; flex-shrink:0;">
                      ${idx + 1}
                    </div>
                    <span style="font-size:0.83rem; font-weight:700; color:var(--text-main); word-break:break-all;">${item.productName}</span>
                  </div>
                  <strong style="color:${textColors[colIdx]}; font-size:0.9rem; flex-shrink:0;">${item.count} เครื่อง</strong>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div style="color:#ef4444; padding:2rem;">เกิดข้อผิดพลาดในการโหลดแดชบอร์ดพนักงาน: ${err.message}</div>`;
  }
}

/* ==========================================================================
   VIEW 1: DASHBOARD OVERVIEW
   ========================================================================== */
async function renderDashboardView() {
  const container = document.getElementById('content-container');

  // Destroy previous chart instance BEFORE replacing DOM to prevent flicker
  if (window._execBranchChart) {
    window._execBranchChart.destroy();
    window._execBranchChart = null;
  }

  container.innerHTML = `<div style="padding: 3rem; text-align: center; color: var(--text-muted);"><i class="fa-solid fa-spinner fa-spin" style="font-size:2.5rem; color:var(--accent-primary);"></i><br><br><span style="font-size:1.1rem; font-weight:600;">กำลังโหลดแดชบอร์ดผู้บริหาร</span></div>`;

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
          <h3 style="font-size:1.25rem; font-weight:800; color:var(--text-main); display:flex; align-items:center; gap:0.5rem;">
            <i class="fa-solid fa-chart-line" style="color:var(--accent-primary);"></i> ภาพรวมแดชบอร์ดผู้บริหาร
          </h3>
        </div>

        <div>
          <button class="btn btn-primary" onclick="openExecutiveReportModal()" style="padding:0.6rem 1.2rem; font-weight:700; display:flex; align-items:center; gap:0.5rem; box-shadow:0 4px 14px rgba(79,70,229,0.25);">
            <i class="fa-solid fa-file-invoice-dollar"></i> ดูรายงานสรุปผู้บริหาร
          </button>
        </div>
      </div>

      <!-- Executive KPI Cards Grid -->
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
        
        <!-- KPI 1: Today Revenue -->
        <div class="card" style="background: linear-gradient(135deg, rgba(16,185,129,0.08), rgba(16,185,129,0.02)); border: 1px solid rgba(16,185,129,0.3);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">
            <span style="color:var(--text-muted); font-size:0.85rem; font-weight:600;">ยอดขายรวมวันนี้</span>
            <i class="fa-solid fa-sack-dollar" style="color:#059669; font-size:1.5rem;"></i>
          </div>
          <div style="font-size:2.2rem; font-weight:800; color:#059669;">฿${todayRevenue.toLocaleString()}</div>
          <div style="font-size:0.78rem; color:var(--text-muted); margin-top:0.3rem;">
            สด/โอน: <strong style="color:var(--text-main);">฿${todayCashRevenue.toLocaleString()}</strong> | ไฟแนนซ์: <strong style="color:#d97706;">฿${todayFinanceRevenue.toLocaleString()}</strong>
          </div>
        </div>

        <!-- KPI 2: Today Bills -->
        <div class="card" style="background: linear-gradient(135deg, rgba(8,145,178,0.08), rgba(8,145,178,0.02)); border: 1px solid rgba(8,145,178,0.3);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">
            <span style="color:var(--text-muted); font-size:0.85rem; font-weight:600;">บิลขายวันนี้</span>
            <i class="fa-solid fa-receipt" style="color:#0891b2; font-size:1.5rem;"></i>
          </div>
          <div style="font-size:2.2rem; font-weight:800; color:#0891b2;">${todayBills} <span style="font-size:0.95rem; color:var(--text-muted);">บิล</span></div>
          <div style="font-size:0.78rem; color:var(--text-muted); margin-top:0.3rem;">
            ประมาณการกำไร: <strong style="color:#059669;">฿${todayProfit.toLocaleString()}</strong>
          </div>
        </div>

        <!-- KPI 3: Total Stock Value -->
        <div class="card" style="background: linear-gradient(135deg, rgba(99,102,241,0.08), rgba(99,102,241,0.02)); border: 1px solid rgba(99,102,241,0.25);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">
            <span style="color:var(--text-muted); font-size:0.85rem; font-weight:600;">มูลค่าสต็อกสินค้าคงเหลือ</span>
            <i class="fa-solid fa-boxes-stacked" style="color:var(--accent-primary); font-size:1.5rem;"></i>
          </div>
          <div style="font-size:2.2rem; font-weight:800; color:var(--text-main);">฿${totalStockValue.toLocaleString()}</div>
          <div style="font-size:0.78rem; color:var(--text-muted); margin-top:0.3rem;">
            สินค้าคงคลัง: <strong style="color:var(--accent-primary);">${totalStockItems.toLocaleString()}</strong> เครื่อง (5 สาขา)
          </div>
        </div>

        <!-- KPI 4: Daily Audit Status -->
        <div class="card" style="background: linear-gradient(135deg, rgba(217,119,6,0.08), rgba(217,119,6,0.02)); border: 1px solid rgba(217,119,6,0.25);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">
            <span style="color:var(--text-muted); font-size:0.85rem; font-weight:600;">สถานะนับสต็อกประจำวัน</span>
            <i class="fa-solid fa-clipboard-check" style="color:#d97706; font-size:1.5rem;"></i>
          </div>
          <div style="font-size:2.2rem; font-weight:800; color:${pendingAuditsCount > 0 ? '#d97706' : '#059669'};">
            ${submittedCount} / 5 <span style="font-size:0.95rem; color:var(--text-muted);">สาขาส่งแล้ว</span>
          </div>
          <div style="font-size:0.78rem; color:var(--text-muted); margin-top:0.3rem;">
            ${pendingAuditsCount} สาขารอตรวจสอบจากส่วนกลาง
          </div>
        </div>
      </div>

      <!-- Charts & Widgets Middle Grid -->
      <div class="grid-1_5-1" style="gap:1.2rem; margin-bottom:1.5rem; align-items:stretch;">
        
        <!-- Interactive Chart: Revenue & Stock Value per Branch -->
        <div class="card" style="display:flex; flex-direction:column;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
            <h3 style="font-size:1.05rem; font-weight:700; display:flex; align-items:center; gap:0.5rem;">
              <i class="fa-solid fa-chart-column" style="color:var(--accent-primary);"></i> เปรียบเทียบยอดขาย & มูลค่าสต็อก
            </h3>
            <span style="font-size:0.78rem; color:var(--text-muted);"><i class="fa-solid fa-circle" style="color:#059669;"></i> ข้อมูลประจำวันวันนี้</span>
          </div>
          <div style="position:relative; flex:1; min-height:260px;">
            <canvas id="executive-branch-chart"></canvas>
          </div>
        </div>

        <!-- Right Side Widgets: Top Selling & Low Stock Alerts -->
        <div style="display:flex; flex-direction:column; gap:1.2rem;">
          
          <!-- Top Selling Products Widget -->
          <div class="card" style="flex:1;">
            <h4 style="font-size:0.95rem; font-weight:700; margin-bottom:0.8rem; color:var(--accent-primary); display:flex; align-items:center; gap:0.4rem;">
              <i class="fa-solid fa-fire" style="color:#ea580c;"></i> สินค้าขายดีประจำวัน Top 5
            </h4>
            <div style="font-size:0.82rem;">
              ${topSellingProducts.length === 0 ? '<div style="color:var(--text-muted); font-style:italic; padding:1rem 0; text-align:center;">ยังไม่มีรายการขายในวันนี้</div>' : ''}
              ${topSellingProducts.map((p, idx) => `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:0.4rem 0; border-bottom:1px solid var(--border-color);">
                  <div>
                    <strong style="color:var(--text-main);">${idx + 1}. ${p.productName}</strong>
                  </div>
                  <div style="text-align:right;">
                    <span class="badge badge-green" style="font-size:0.75rem;">${p.quantity} เครื่อง</span>
                    <div style="font-weight:700; color:#059669; font-size:0.8rem; margin-top:0.1rem;">฿${p.revenue.toLocaleString()}</div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Low Stock Alerts Widget -->
          <div class="card" style="flex:1;">
            <h4 style="font-size:0.95rem; font-weight:700; margin-bottom:0.8rem; color:#e11d48; display:flex; align-items:center; gap:0.4rem;">
              <i class="fa-solid fa-triangle-exclamation"></i> แจ้งเตือนสินค้าสต็อกต่ำ (เหลือ ≤ 2)
            </h4>
            <div style="font-size:0.8rem; max-height:140px; overflow-y:auto;">
              ${lowStockAlerts.length === 0 ? '<div style="color:#059669; font-style:italic; padding:0.5rem 0;">ไม่มีสินค้าสต็อกต่ำในขณะนี้ ทุกสาขามีสต็อกเพียงพอ</div>' : ''}
              ${lowStockAlerts.map(item => `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:0.4rem 0.6rem; background:rgba(225,29,72,0.05); border-radius:6px; margin-bottom:0.4rem; border:1px solid rgba(225,29,72,0.15);">
                  <div>
                    <strong style="color:var(--text-main);">${item.productName}</strong>
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
          <i class="fa-solid fa-store" style="color:var(--accent-primary);"></i> สถานะการนับสต็อกประจำวัน (${todayStr})
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
                  <div class="stat-val" style="color: ${b.totalVariance === 0 ? '#059669' : '#e11d48'};">${b.totalVariance}</div>
                  <div class="stat-lbl">ยอดที่ขาด/เกิน</div>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    // Render Chart.js Chart (no setTimeout — render immediately to avoid blank flash)
    requestAnimationFrame(() => {
      const ctx = document.getElementById('executive-branch-chart');
      if (ctx && window.Chart) {
        const labels = branchPerformance.map(b => b.name.replace('บานาน่า ', ''));
        const revenues = branchPerformance.map(b => b.revenue);
        const stockValues = branchPerformance.map(b => b.stockValue);

        window._execBranchChart = new window.Chart(ctx, {
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
            animation: false,
            plugins: {
              legend: {
                labels: { color: '#475569', font: { family: 'Prompt', size: 12 } }
              }
            },
            scales: {
              x: {
                ticks: { color: '#64748b', font: { family: 'Prompt' } },
                grid: { color: 'rgba(0, 0, 0, 0.05)' }
              },
              y: {
                ticks: { color: '#64748b', font: { family: 'Prompt' } },
                grid: { color: 'rgba(0, 0, 0, 0.05)' }
              }
            }
          }
        });
      }
    });

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

  const modalTitle = `📊 สรุปรายงานผู้บริหาร`;

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
        <div style="background:rgba(0,0,0,0.03); border:1px solid var(--border-color); padding:0.8rem 1rem; border-radius:8px; margin-bottom:1.2rem;">
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
          <div style="background:rgba(99,102,241,0.06); border:1px solid var(--border-glow); padding:0.8rem 1rem; border-radius:8px; margin-bottom:1.2rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
            <div>
              <h4 style="font-size:1.05rem; font-weight:800; color:var(--text-main); margin-bottom:0.15rem;">
                <i class="fa-solid fa-file-invoice-dollar" style="color:var(--accent-primary);"></i> รายงานสรุปผลการดำเนินงานผู้บริหาร
              </h4>
              <div style="font-size:0.83rem; color:var(--text-muted);">
                ประจำช่วงวันที่: <strong style="color:#d97706;">${startVal}</strong> ถึง <strong style="color:#d97706;">${endVal}</strong>
              </div>
            </div>
            <div style="text-align:right; font-size:0.75rem; color:var(--text-muted);">
              อัปเดตล่าสุด: ${new Date().toLocaleTimeString('th-TH')}
            </div>
          </div>

          <!-- 4 KPI Cards -->
          <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap:0.8rem; margin-bottom:1.5rem;">
            
            <div style="background:rgba(16,185,129,0.08); border:1px solid rgba(16,185,129,0.3); padding:0.8rem; border-radius:8px;">
              <div style="font-size:0.78rem; color:var(--text-muted);">ยอดขายรวมสุทธิ</div>
              <div style="font-size:1.55rem; font-weight:800; color:#059669; margin:0.2rem 0;">฿${totalRev.toLocaleString()}</div>
              <div style="font-size:0.72rem; color:var(--text-muted);">สด/โอน: ฿${cashRev.toLocaleString()} | ไฟแนนซ์: ฿${finRev.toLocaleString()}</div>
            </div>

            <div style="background:rgba(8,145,178,0.08); border:1px solid rgba(8,145,178,0.3); padding:0.8rem; border-radius:8px;">
              <div style="font-size:0.78rem; color:var(--text-muted);">กำไรขั้นต้นรวม</div>
              <div style="font-size:1.55rem; font-weight:800; color:#0891b2; margin:0.2rem 0;">฿${totalProf.toLocaleString()}</div>
              <div style="font-size:0.72rem; color:var(--text-muted);">อัตรากำไร : <strong style="color:#059669;">${margin.toFixed(1)}%</strong></div>
            </div>

            <div style="background:rgba(217,119,6,0.08); border:1px solid rgba(217,119,6,0.25); padding:0.8rem; border-radius:8px;">
              <div style="font-size:0.78rem; color:var(--text-muted);">จำนวนรายการขาย</div>
              <div style="font-size:1.55rem; font-weight:800; color:#d97706; margin:0.2rem 0;">${totalBills} <span style="font-size:0.8rem;">บิล</span></div>
              <div style="font-size:0.72rem; color:var(--text-muted);">ยอดเฉลี่ยต่อบิล : ฿${Math.round(aov).toLocaleString()}</div>
            </div>

            <div style="background:rgba(99,102,241,0.08); border:1px solid rgba(99,102,241,0.25); padding:0.8rem; border-radius:8px;">
              <div style="font-size:0.78rem; color:var(--text-muted);">สัดส่วนช่องทางชำระเงิน</div>
              <div style="font-size:1.1rem; font-weight:800; color:var(--text-main); margin:0.3rem 0;">
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
                ${branchPerf.length === 0 ? `<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:2rem;">ไม่พบข้อมูลผลการดำเนินงานรายสาขาในช่วงเวลานี้</td></tr>` : ''}
                ${branchPerf.map(b => {
                  const proportion = totalRev > 0 ? Math.round((b.revenue / totalRev) * 100) : 0;
                  return `
                    <tr>
                      <td>
                        <strong style="color:#38bdf8;">[${b.code || '-'}]</strong> <strong>${b.name || '-'}</strong>
                      </td>
                      <td style="text-align:center;">${b.bills || 0} บิล</td>
                      <td style="text-align:right; font-weight:700; color:#34d399;">฿${(b.revenue || 0).toLocaleString()}</td>
                      <td style="text-align:right; color:var(--text-muted);">฿${(b.cost || 0).toLocaleString()}</td>
                      <td style="text-align:right; font-weight:700; color:#38bdf8;">฿${(b.profit || 0).toLocaleString()}</td>
                      <td style="text-align:center;">
                        <div style="display:flex; align-items:center; gap:0.5rem; justify-content:center;">
                          <div style="flex-grow:1; background:rgba(0,0,0,0.08); height:6px; border-radius:3px; max-width:80px; text-align:left;">
                            <div style="width:${proportion}%; background:var(--accent-primary); height:100%; border-radius:3px;"></div>
                          </div>
                          <span style="font-weight:700; min-width:30px;">${proportion}%</span>
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
async function renderBranchInventoryView(selectedBranchId = null, selectedStatus = 'in_stock') {
  const container = document.getElementById('content-container');
  container.innerHTML = `<div style="padding: 2rem; text-align: center; color: var(--text-muted);"><i class="fa-solid fa-spinner fa-spin" style="font-size:2rem;"></i> กำลังโหลดคลังสินค้าสาขา...</div>`;

  try {
    const isHqUser = !state.user.branch || state.user.branch.code === 'BR-HQ01' || (state.user.branch.name && state.user.branch.name.includes('สำนักงานใหญ่'));
    const isAdminOrHq = ['admin', 'hq_stock_staff'].includes((state.user ? state.user.role : 'admin')) || isHqUser;

    let branchIdParam = selectedBranchId;
    if (isAdminOrHq && branchIdParam === null) {
      branchIdParam = 'all';
    }

    const queryParam = branchIdParam ? `?branchId=${branchIdParam}` : '';
    const res = await apiRequest(`/stock/my-branch${queryParam}`);
    
    // Filter stock list based on selected status
    const activeStockList = (res.stock || []).filter(st => {
      if (selectedStatus === 'all') return true;
      return st.status === selectedStatus;
    });
    
    state.branchStockCache = res.stock || [];
    const currentBranch = res.branch || { _id: 'all', name: 'ทุกสาขา' };

    let statusLabel = 'พร้อมขาย';
    if (selectedStatus === 'sold') statusLabel = 'ขายแล้ว';
    else if (selectedStatus === 'in_transit') statusLabel = 'ระหว่างโอนย้าย';
    else if (selectedStatus === 'transferred') statusLabel = 'โอนย้ายสำเร็จ';
    else if (selectedStatus === 'missing') statusLabel = 'สูญหาย';
    else if (selectedStatus === 'released') statusLabel = 'จ่ายออกสินค้า';
    else if (selectedStatus === 'all') statusLabel = 'ทุกสถานะ';

    const canEdit = getUserAllowedMenus().includes('edit-branch-inventory');

    container.innerHTML = `
      <div class="card" style="margin-bottom:1.5rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem;">
        <div>
          <h3 style="font-size:1.2rem; font-weight:700; display:flex; align-items:center; gap:0.5rem;">
            <i class="fa-solid fa-boxes-packing" style="color:var(--accent-primary);"></i> รายการสินค้าในคลัง: ${currentBranch.name}
          </h3>
          <p style="font-size:0.85rem; color:var(--text-muted);">แสดงเครื่องสินค้า${statusLabel} (รวมทั้งสิ้น ${activeStockList.length} เครื่อง)</p>
        </div>

        <div style="display:flex; align-items:center; gap:0.8rem; flex-wrap:wrap;">
          <button class="btn btn-success btn-sm" onclick="exportBranchInventoryToExcel()" style="font-weight:700;"><i class="fa-solid fa-file-excel"></i> Export Excel</button>
          
          <div style="display:flex; align-items:center; gap:0.5rem;">
            <label style="font-size:0.85rem; font-weight:600; color:var(--text-muted);">สถานะ:</label>
            <select id="bi-status-select" class="form-select" style="width:auto; font-size:0.82rem; padding:0.25rem 0.5rem;" onchange="renderBranchInventoryView(document.getElementById('bi-branch-select') ? document.getElementById('bi-branch-select').value : null, this.value)">
              <option value="in_stock" ${selectedStatus === 'in_stock' ? 'selected' : ''}>พร้อมขาย</option>
              <option value="sold" ${selectedStatus === 'sold' ? 'selected' : ''}>ขายแล้ว</option>
              <option value="in_transit" ${selectedStatus === 'in_transit' ? 'selected' : ''}>ระหว่างโอนย้าย</option>
              <option value="transferred" ${selectedStatus === 'transferred' ? 'selected' : ''}>โอนย้ายสำเร็จ</option>
              <option value="missing" ${selectedStatus === 'missing' ? 'selected' : ''}>สูญหาย</option>
              <option value="released" ${selectedStatus === 'released' ? 'selected' : ''}>จ่ายออกแล้ว</option>
              <option value="all" ${selectedStatus === 'all' ? 'selected' : ''}>ทุกสถานะ</option>
            </select>
          </div>

          ${isAdminOrHq ? `
            <div style="display:flex; align-items:center; gap:0.5rem;">
              <label style="font-size:0.85rem; font-weight:600; color:var(--text-muted);">เปลี่ยนสาขา:</label>
              <select id="bi-branch-select" class="form-select" style="width:auto; font-size:0.82rem; padding:0.25rem 0.5rem;" onchange="renderBranchInventoryView(this.value, document.getElementById('bi-status-select').value)">
                <option value="all" ${currentBranch._id === 'all' ? 'selected' : ''}>ทุกสาขา (ทั้งหมด)</option>
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
              ${currentBranch._id === 'all' ? '<th>สาขา</th>' : ''}
              <th>ราคาขาย</th>
              <th style="text-align:center;">สถานะสต็อก</th>
              ${canEdit ? `<th style="text-align:center;">การจัดการ</th>` : ''}
            </tr>
          </thead>
          <tbody>
            ${activeStockList.length === 0 ? `<tr><td colspan="${currentBranch._id === 'all' ? (canEdit ? 9 : 8) : (canEdit ? 8 : 7)}" style="text-align:center; color:var(--text-muted); padding:2rem;">ไม่พบรายการสินค้าในคลังสาขานี้</td></tr>` : ''}
            ${activeStockList.map((st, idx) => {
              const p = st.product || {};
              const imeiStr = st.imei;
              const prodName = st.productName || p.name || `${st.brand || ''} ${st.model || ''}`;
              const brandStr = st.brand || p.brand || '-';
              const modelStr = st.model || p.model || '';
              const specStr = [st.capacity || p.capacity, st.color || p.color].filter(Boolean).join(' ') || (p.variation || '-');
              const priceNum = st.selling_price || p.selling_price || 0;

              // Render beautiful localized badges
              let badgeHtml = '';
              if (st.status === 'in_stock') {
                badgeHtml = `<span class="badge badge-green"><i class="fa-solid fa-circle-check"></i> พร้อมขาย</span>`;
              } else if (st.status === 'sold') {
                badgeHtml = `<span class="badge badge-gray"><i class="fa-solid fa-circle-dollar-to-slot"></i> ขายแล้ว</span>`;
              } else if (st.status === 'in_transit') {
                badgeHtml = `<span class="badge badge-yellow"><i class="fa-solid fa-truck-ramp-box"></i> ระหว่างโอนย้าย</span>`;
              } else if (st.status === 'transferred') {
                badgeHtml = `<span class="badge badge-gray"><i class="fa-solid fa-circle-check"></i> โอนย้ายสำเร็จ</span>`;
              } else if (st.status === 'missing') {
                badgeHtml = `<span class="badge badge-red"><i class="fa-solid fa-circle-xmark"></i> สูญหาย</span>`;
              } else if (st.status === 'released') {
                badgeHtml = `<span class="badge badge-yellow" style="background:#f59e0b; color:#fff; border:none;"><i class="fa-solid fa-circle-minus"></i> จ่ายออกแล้ว</span>`;
              } else {
                badgeHtml = `<span class="badge badge-gray">${st.status}</span>`;
              }

              return `
                <tr class="bi-row" data-search="${(imeiStr + ' ' + prodName + ' ' + brandStr + ' ' + modelStr + ' ' + specStr).toLowerCase()}">
                  <td style="text-align:center; color:var(--text-muted); font-size:0.8rem;">${idx + 1}</td>
                  <td><strong style="color:#fbbf24; font-family:monospace; font-size:0.95rem;">${imeiStr}</strong></td>
                  <td><strong>${prodName}</strong></td>
                  <td><span class="badge badge-gray">${brandStr}</span> ${modelStr}</td>
                  <td>${specStr}</td>
                  ${currentBranch._id === 'all' ? `<td><span class="badge badge-gray" style="font-weight:700;">${st.branch ? st.branch.name : '-'}</span></td>` : ''}
                  <td><strong style="color:#34d399;">฿${priceNum.toLocaleString()}</strong></td>
                  <td style="text-align:center;">
                    ${badgeHtml}
                  </td>
                  ${canEdit ? `
                    <td style="text-align:center; white-space:nowrap;">
                      <button class="btn btn-secondary btn-sm" onclick="openEditStockModal('${st._id}')">
                        <i class="fa-solid fa-pen-to-square"></i> แก้ไข
                      </button>
                    </td>
                  ` : ''}
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
    const isHqUser = !state.user.branch || state.user.branch.code === 'BR-HQ01' || (state.user.branch.name && state.user.branch.name.includes('สำนักงานใหญ่'));
    const isAdminOrHq = ['admin', 'hq_stock_staff'].includes((state.user ? state.user.role : 'admin')) || isHqUser;

    let branchIdParam = selectedBranchId;
    if (isAdminOrHq && branchIdParam === null) {
      branchIdParam = 'all';
    }

    const queryParam = branchIdParam ? `?branchId=${branchIdParam}` : '';
    const res = await apiRequest(`/stock/my-branch${queryParam}`);
    const stockList = (res.stock || []).filter(st => st.status === 'in_stock');
    const currentBranch = res.branch || { _id: 'all', name: 'ทุกสาขา' };

    container.innerHTML = `
      <div class="grid-1_3-1" style="gap:1.2rem; align-items:start;">
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
                    <option value="all" ${currentBranch._id === 'all' ? 'selected' : ''}>ทุกสาขา (ทั้งหมด)</option>
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
                          <strong>${productName}</strong>
                          ${currentBranch._id === 'all' && st.branch ? `<br><span style="font-size:0.72rem; color:var(--accent-primary); background:rgba(99,102,241,0.08); padding:1px 6px; border-radius:3px;">📍 ${st.branch.name || 'ไม่ระบุสาขา'}</span>` : ''}
                        </td>
                        <td><strong style="color:#fbbf24; font-family:monospace; font-size:0.92rem;">${imei}</strong></td>
                        <td><strong style="color:#34d399;">฿${sellingPrice.toLocaleString()}</strong></td>
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
            <div style="background:rgba(0,0,0,0.03); border:1px solid var(--border-color); padding:0.8rem; border-radius:6px; margin-bottom:1rem;">
              <div style="font-weight:700; font-size:0.85rem; margin-bottom:0.5rem; color:var(--accent-secondary);">
                <i class="fa-solid fa-user-tag"></i> ข้อมูลลูกค้า (สำหรับออกใบเสร็จ) <span style="color:#f87171; font-weight:800;">* จำเป็น</span>
              </div>
              <div class="grid-2col" style="gap:0.6rem;">
                <input type="text" id="pos-cust-name" class="form-control" style="font-size:0.82rem;" placeholder="ชื่อลูกค้า (จำเป็น)" required>
                <input type="text" id="pos-cust-phone" class="form-control" style="font-size:0.82rem;" placeholder="เบอร์โทรศัพท์ (จำเป็น)" required>
              </div>
            </div>

            <!-- Cart Items List -->
            <div id="pos-cart-items-container" style="max-height:220px; overflow-y:auto; margin-bottom:1rem; border:1px solid var(--border-color); border-radius:6px; padding:0.5rem;">
              <!-- Rendered Cart Items -->
            </div>

            <!-- Totals & Payment Calculations -->
            <div style="background:rgba(0,0,0,0.035); border:1px solid var(--border-color); padding:1rem; border-radius:8px; margin-bottom:1rem;">
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
                <option value="finance">ผ่อน / จัดไฟแนนซ์ (Financing)</option>
              </select>
            </div>

            <div id="pos-cash-container" class="grid-2col" style="gap:0.6rem; margin-bottom:1rem;">
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
    standardPrice: Number(unitPrice),
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
      <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.02); border:1px solid var(--border-color); padding:0.5rem; border-radius:6px; margin-bottom:0.4rem; font-size:0.83rem; gap:0.5rem;">
        <div style="flex:1; min-width:0;">
          <strong style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; display:block;">${item.productName}</strong>
          <span style="font-size:0.75rem; color:var(--text-muted);">IMEI: ${item.imei || '-'}</span>
        </div>
        <div style="text-align:right; display:flex; align-items:center; gap:0.3rem;">
          <span style="color:#059669; font-weight:700;">฿</span>
          <input type="number" class="form-control" style="width:90px; padding:0.2rem 0.4rem; text-align:right; font-size:0.82rem; font-weight:700; color:#059669; margin:0; background:#ffffff;" value="${item.unitPrice}" oninput="updateCartItemPrice(${idx}, this.value)" min="0">
        </div>
        <button class="btn btn-danger btn-sm" style="padding:0.15rem 0.4rem;" onclick="removeFromPosCart(${idx})">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
    `).join('');
  }

  updatePosCartTotals();
}

function updateCartItemPrice(index, val) {
  const price = Number(val) || 0;
  if (state.posCart && state.posCart[index]) {
    state.posCart[index].unitPrice = price;
    state.posCart[index].totalPrice = price;
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

  const custName = document.getElementById('pos-cust-name') ? document.getElementById('pos-cust-name').value.trim() : '';
  const custPhone = document.getElementById('pos-cust-phone') ? document.getElementById('pos-cust-phone').value.trim() : '';

  if (!custName) {
    showToast('กรุณากรอกชื่อลูกค้าสำหรับออกใบเสร็จ', 'error');
    return;
  }

  if (!custPhone) {
    showToast('กรุณากรอกเบอร์โทรศัพท์ลูกค้าสำหรับออกใบเสร็จ', 'error');
    return;
  }

  // Customer details already validated above
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
      openSelectReceiptTypeModal(res.sale);
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
        <div style="display:flex; justify-content:space-between; margin-top:0.6rem; font-size:0.78rem; color:#444;">
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

/* Helper function to convert number to Thai Baht text */
function thaiBahtText(num) {
  if (isNaN(num) || num === null || num === undefined) return '';
  num = parseFloat(num);
  if (num === 0) return 'ศูนย์บาทถ้วน';

  const digitWords = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
  const unitWords = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน'];

  let [baht, satang] = num.toFixed(2).split('.');
  let bahtText = '';

  const convertGroup = (groupStr) => {
    let text = '';
    const len = groupStr.length;
    for (let i = 0; i < len; i++) {
      const digit = parseInt(groupStr[i]);
      const pos = len - i - 1;
      if (digit !== 0) {
        if (pos === 0 && digit === 1 && len > 1) {
          text += 'เอ็ด';
        } else if (pos === 1 && digit === 1) {
          text += 'สิบ';
        } else if (pos === 1 && digit === 2) {
          text += 'ยี่สิบ';
        } else {
          text += digitWords[digit] + unitWords[pos];
        }
      }
    }
    return text;
  };

  let bahtVal = parseInt(baht);
  if (bahtVal === 0) {
    bahtText = 'ศูนย์';
  } else {
    let bahtGroups = [];
    while (baht.length > 6) {
      bahtGroups.unshift(baht.slice(-6));
      baht = baht.slice(0, -6);
    }
    bahtGroups.unshift(baht);

    bahtText = bahtGroups.map((g, idx) => {
      let gText = convertGroup(g);
      if (gText && idx < bahtGroups.length - 1) {
        gText += 'ล้าน';
      }
      return gText;
    }).join('');
  }

  let text = bahtText + 'บาท';

  let satangVal = parseInt(satang);
  if (satangVal === 0) {
    text += 'ถ้วน';
  } else {
    text += convertGroup(satang) + 'สตางค์';
  }

  return text;
}

function openSelectReceiptTypeModal(sale) {
  window.currentReceiptSale = sale;
  const bodyHtml = `
    <div style="background:rgba(0,0,0,0.25); padding:1rem; border-radius:6px; margin-bottom:1.2rem; border:1px solid rgba(255,255,255,0.1);">
      <div style="font-weight:800; font-size:1.05rem; color:#38bdf8; display:flex; align-items:center; gap:0.4rem;">
        <i class="fa-solid fa-circle-check" style="color:#34d399;"></i> บันทึกการขายสำเร็จ: ${sale.receiptNumber}
      </div>
      <div style="font-size:0.82rem; color:var(--text-muted); margin-top:0.3rem;">
        กรุณาเลือกรูปแบบเอกสารที่ต้องการพิมพ์ออกเครื่องพิมพ์หรือดาวน์โหลด
      </div>
    </div>

    <form id="select-receipt-type-form">
      <div class="form-group">
        <label style="font-weight:700; margin-bottom:0.5rem; display:block;">รูปแบบเอกสาร:</label>
        
        <div style="background:#ffffff; border:1px solid var(--border-color); padding:0.8rem 1rem; border-radius:6px; margin-bottom:0.6rem; display:flex; align-items:center; gap:0.8rem; cursor:pointer;" onclick="document.getElementById('r-type-abbreviated').checked = true">
          <input type="radio" id="r-type-abbreviated" name="receiptType" value="abbreviated" checked style="transform:scale(1.2);">
          <div>
            <strong style="color:var(--text-main); font-size:0.9rem;">ใบเสร็จรับเงิน / ใบกำกับภาษีอย่างย่อ</strong>
            <div style="font-size:0.75rem; color:var(--text-muted);">พิมพ์ใบเสร็จย่อหน้ากว้าง 58-80mm สำหรับลูกค้าทั่วไป (ไม่แสดงคำนวณ VAT)</div>
          </div>
        </div>

        <div style="background:#ffffff; border:1px solid var(--border-color); padding:0.8rem 1rem; border-radius:6px; display:flex; align-items:center; gap:0.8rem; cursor:pointer;" onclick="document.getElementById('r-type-full').checked = true">
          <input type="radio" id="r-type-full" name="receiptType" value="full" style="transform:scale(1.2);">
          <div>
            <strong style="color:var(--accent-primary); font-size:0.9rem;">ใบกำกับภาษีเต็มรูปแบบ (Full Tax Invoice)</strong>
            <div style="font-size:0.75rem; color:var(--text-muted);">พิมพ์เอกสารขนาด A4 แสดงข้อมูลผู้เสียภาษีของลูกค้าและการแยกภาษีมูลค่าเพิ่ม 7%</div>
          </div>
        </div>
      </div>
    </form>
  `;

  const footerHtml = `
    <button class="btn btn-secondary" onclick="closeModal()">ปิด</button>
    <button class="btn btn-success" onclick="handleSelectReceiptType()"><i class="fa-solid fa-arrow-right"></i> ดำเนินการต่อ</button>
  `;

  openModal(`เลือกรูปแบบเอกสารการขาย`, bodyHtml, footerHtml);
}

function handleSelectReceiptType() {
  const sale = window.currentReceiptSale;
  if (!sale) return;

  const isFull = document.getElementById('r-type-full') ? document.getElementById('r-type-full').checked : false;
  if (isFull) {
    openFullTaxInvoiceDetailsModal(sale);
  } else {
    openReceiptVoucherModal(sale);
  }
}

function openFullTaxInvoiceDetailsModal(sale) {
  const customer = sale.customer || {};
  
  const bodyHtml = `
    <div style="background:rgba(0,0,0,0.25); padding:1rem; border-radius:6px; margin-bottom:1.2rem; border:1px solid rgba(255,255,255,0.1);">
      <div style="font-weight:700; font-size:0.95rem; color:#38bdf8;">
        <i class="fa-solid fa-file-invoice"></i> กรอกข้อมูลผู้เสียภาษี (สำหรับใบกำกับภาษีเต็มรูปแบบ)
      </div>
      <div style="font-size:0.78rem; color:var(--text-muted); margin-top:0.2rem;">
        ระบุข้อมูลชื่อ ที่อยู่ และเลขผู้เสียภาษีให้ถูกต้องเพื่อพิมพ์เอกสารขนาด A4
      </div>
    </div>

    <form id="full-tax-details-form" onsubmit="event.preventDefault(); submitFullTaxInvoice();">
      <div class="form-group">
        <label for="tax-name">ชื่อผู้ซื้อสินค้า / ชื่อบริษัท <span style="color:#ef4444;">*</span></label>
        <input type="text" id="tax-name" class="form-control" value="${customer.name || ''}" placeholder="เช่น นายสมชาย ดีมาก หรือ บริษัท กขค จำกัด" required autofocus>
      </div>

      <div class="grid-2_5-1" style="gap:0.8rem;">
        <div class="form-group">
          <label for="tax-id">เลขประจำตัวผู้เสียภาษี (13 หลัก) <span style="color:#ef4444;">*</span></label>
          <input type="text" id="tax-id" class="form-control" maxlength="13" placeholder="ระบุเลขประจำตัวผู้เสียภาษี 13 หลัก" required>
        </div>
        <div class="form-group">
          <label for="tax-branch">สาขา <span style="color:#ef4444;">*</span></label>
          <input type="text" id="tax-branch" class="form-control" value="สำนักงานใหญ่" placeholder="เช่น สำนักงานใหญ่ หรือ 00001" required>
        </div>
      </div>

      <div class="form-group">
        <label for="tax-address">ที่อยู่ตามใบกำกับภาษี <span style="color:#ef4444;">*</span></label>
        <textarea id="tax-address" class="form-control" rows="3" placeholder="ระบุเลขที่ ถนน ตำบล อำเภอ จังหวัด รหัสไปรษณีย์..." required></textarea>
      </div>

      <div class="form-group">
        <label for="tax-phone">เบอร์โทรศัพท์ (ถ้ามี)</label>
        <input type="text" id="tax-phone" class="form-control" value="${customer.phone || ''}" placeholder="ระบุเบอร์โทรศัพท์">
      </div>
    </form>
  `;

  const footerHtml = `
    <button class="btn btn-secondary" onclick="openSelectReceiptTypeModal(window.currentReceiptSale)">ย้อนกลับ</button>
    <button class="btn btn-success" onclick="submitFullTaxInvoice()"><i class="fa-solid fa-print"></i> ออกใบกำกับภาษีเต็มรูปแบบ</button>
  `;

  openModal(`กรอกข้อมูลใบกำกับภาษีเต็มรูปแบบ`, bodyHtml, footerHtml);
}

function submitFullTaxInvoice() {
  const sale = window.currentReceiptSale;
  if (!sale) return;

  const taxName = document.getElementById('tax-name').value.trim();
  const taxId = document.getElementById('tax-id').value.trim();
  const taxBranch = document.getElementById('tax-branch').value.trim();
  const taxAddress = document.getElementById('tax-address').value.trim();
  const taxPhone = document.getElementById('tax-phone').value.trim();

  if (!taxName || !taxId || !taxBranch || !taxAddress) {
    showToast('กรุณากรอกข้อมูลที่จำเป็น (*) ให้ครบถ้วน', 'error');
    return;
  }

  if (taxId.length !== 13 || isNaN(taxId)) {
    showToast('เลขประจำตัวผู้เสียภาษีต้องเป็นตัวเลข 13 หลักเท่านั้น', 'error');
    return;
  }

  const taxDetails = {
    name: taxName,
    taxId,
    branch: taxBranch,
    address: taxAddress,
    phone: taxPhone
  };

  openFullTaxInvoiceModal(sale, taxDetails);
}

function openFullTaxInvoiceModal(sale, tax) {
  const branch = sale.branch || {};
  const seller = sale.soldBy || {};
  const items = sale.items || [];
  
  const subtotal = sale.grandTotal || 0;
  const taxableVal = subtotal / 1.07;
  const vatVal = subtotal - taxableVal;
  const thaiText = thaiBahtText(subtotal);

  const bodyHtml = `
    <div id="printable-full-invoice" class="printable-area" style="background:#fff; color:#000; padding:2rem; font-family:'Sarabun','Prompt',sans-serif; max-width:800px; margin:0 auto; box-shadow:0 0 10px rgba(0,0,0,0.15); border:1px solid #ddd; line-height:1.4;">
      <!-- Title Section -->
      <div style="display:flex; justify-content:space-between; align-items:start; border-bottom:2px solid #000; padding-bottom:1rem; margin-bottom:1.2rem;">
        <div>
          <div style="display:flex; align-items:center; gap:0.6rem; margin-bottom:0.4rem;">
            <img src="/image/icon_silminbanana.png" alt="Silmin Banana Logo" style="height:50px; width:50px; object-fit:contain;">
            <div>
              <h1 style="font-size:1.6rem; font-weight:900; margin:0; color:#000;">SILMIN BANANA</h1>
              <span style="font-size:0.72rem; color:#444;">ซิลมีน บานาน่า (สาขาที่: ${branch.code || 'BR-HQ01'})</span>
            </div>
          </div>
          <div style="font-size:0.8rem; color:#333;">
            ที่อยู่: ${branch.address || '883 ถ.สิโรรส ต.สะเตง อ.เมือง จ.ยะลา 95000'}<br>
            โทรศัพท์: ${branch.phone || ''} | เลขประจำตัวผู้เสียภาษีอากร: <strong>1930400058472</strong>
          </div>
        </div>
        <div style="text-align:right;">
          <h2 style="font-size:1.3rem; font-weight:800; margin:0; color:#000; letter-spacing:0.5px;">ใบกำกับภาษี / ใบเสร็จรับเงิน</h2>
          <span style="font-size:0.8rem; font-weight:700; color:#333;">(TAX INVOICE / RECEIPT)</span>
          <div style="margin-top:0.6rem; font-size:0.82rem; text-align:left; border:1px solid #000; padding:0.4rem; border-radius:4px; background:#fafafa;">
            <div><strong>เลขที่เอกสาร:</strong> ${sale.receiptNumber}</div>
            <div><strong>วันที่:</strong> ${new Date(sale.createdAt || Date.now()).toLocaleDateString('th-TH')}</div>
            <div><strong>พนักงานขาย:</strong> ${seller.fullName || seller.username || 'Staff'}</div>
          </div>
        </div>
      </div>

      <!-- Customer Details Section -->
      <div style="display:grid; grid-template-columns: 1.5fr 1fr; gap:1.5rem; margin-bottom:1.5rem; border:1px solid #000; border-radius:6px; padding:0.8rem; background:#fff; font-size:0.85rem;">
        <div>
          <div style="font-weight:800; border-bottom:1px solid #eee; padding-bottom:0.2rem; margin-bottom:0.4rem; color:#000; font-size:0.9rem;">
            ข้อมูลผู้ซื้อสินค้า / Customer Details
          </div>
          <div><strong>ชื่อผู้เสียภาษี:</strong> ${tax.name}</div>
          <div style="margin-top:0.25rem;"><strong>ที่อยู่:</strong> ${tax.address}</div>
          <div style="margin-top:0.25rem;"><strong>เบอร์โทรศัพท์:</strong> ${tax.phone || '-'}</div>
        </div>
        <div style="border-left:1px solid #eee; padding-left:1rem;">
          <div style="font-weight:800; border-bottom:1px solid #eee; padding-bottom:0.2rem; margin-bottom:0.4rem; color:#000; font-size:0.9rem;">
            รายละเอียดทางภาษี
          </div>
          <div><strong>เลขประจำตัวผู้เสียภาษี:</strong> <span style="font-family:monospace; font-weight:700; font-size:0.95rem;">${tax.taxId}</span></div>
          <div style="margin-top:0.3rem;"><strong>สาขาผู้เสียภาษี:</strong> ${tax.branch}</div>
        </div>
      </div>

      <!-- Items Table -->
      <table style="width:100%; border-collapse:collapse; font-size:0.85rem; margin-bottom:1.2rem; color:#000;">
        <thead>
          <tr style="background:#f1f5f9; border:1px solid #000; text-align:left;">
            <th style="padding:8px; border-right:1px solid #ddd; width:45px; text-align:center;">ลำดับ</th>
            <th style="padding:8px; border-right:1px solid #ddd;">ชื่อรายการสินค้า / สเปกเครื่อง (Product Description)</th>
            <th style="padding:8px; border-right:1px solid #ddd; width:55px; text-align:center;">จำนวน</th>
            <th style="padding:8px; border-right:1px solid #ddd; width:110px; text-align:right;">ราคาต่อหน่วย</th>
            <th style="padding:8px; width:110px; text-align:right;">จำนวนเงิน (บาท)</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((i, idx) => `
            <tr style="border-bottom:1px solid #ddd; border-left:1px solid #000; border-right:1px solid #000;">
              <td style="padding:8px; border-right:1px solid #ddd; text-align:center;">${idx + 1}</td>
              <td style="padding:8px; border-right:1px solid #ddd;">
                <strong style="color:#000;">${i.productName}</strong><br>
                <span style="font-size:0.75rem; color:#444;">หมายเลขเครื่อง (IMEI): ${i.imei}</span>
              </td>
              <td style="padding:8px; border-right:1px solid #ddd; text-align:center; vertical-align:top;">${i.quantity}</td>
              <td style="padding:8px; border-right:1px solid #ddd; text-align:right; vertical-align:top;">฿${i.unitPrice.toLocaleString()}</td>
              <td style="padding:8px; text-align:right; vertical-align:top; font-weight:700;">฿${i.totalPrice.toLocaleString()}</td>
            </tr>
          `).join('')}
          <!-- Empty spacers to keep invoice structured -->
          ${items.length < 3 ? Array.from({ length: 3 - items.length }).map((_, sIdx) => `
            <tr style="border-bottom:1px solid #ddd; border-left:1px solid #000; border-right:1px solid #000; height:35px;">
              <td style="border-right:1px solid #ddd;"></td>
              <td style="border-right:1px solid #ddd;"></td>
              <td style="border-right:1px solid #ddd;"></td>
              <td style="border-right:1px solid #ddd;"></td>
              <td></td>
            </tr>
          `).join('') : ''}
        </tbody>
      </table>

      <!-- Grand Calculations Grid -->
      <div style="display:grid; grid-template-columns: 1.5fr 1fr; gap:1rem; font-size:0.85rem; color:#000; margin-bottom:1.5rem;">
        <div style="border:1px solid #000; padding:0.8rem; border-radius:6px; display:flex; align-items:center; justify-content:center; background:#fafafa;">
          <div style="text-align:center;">
            <div style="font-size:0.75rem; color:#555; margin-bottom:0.2rem;">จำนวนเงินตัวอักษร / Total Baht Text</div>
            <strong style="font-size:0.95rem; color:#000;">(${thaiText})</strong>
          </div>
        </div>

        <div style="border:1px solid #000; border-radius:6px; padding:0.6rem 0.8rem; background:#fff; font-size:0.82rem;">
          <div style="display:flex; justify-content:space-between; margin-bottom:0.3rem;">
            <span>ยอดรวมก่อนหักส่วนลด:</span>
            <span>฿${(sale.subtotal || 0).toLocaleString()}</span>
          </div>
          ${sale.discountTotal > 0 ? `
            <div style="display:flex; justify-content:space-between; margin-bottom:0.3rem; color:#dc2626;">
              <span>ส่วนลดพิเศษ:</span>
              <span>-฿${sale.discountTotal.toLocaleString()}</span>
            </div>
          ` : ''}
          <div style="display:flex; justify-content:space-between; margin-bottom:0.3rem; border-top:1px dotted #ccc; padding-top:0.3rem;">
            <span>มูลค่าก่อนภาษี (7% VAT Excluded):</span>
            <span>฿${taxableVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div style="display:flex; justify-content:space-between; margin-bottom:0.3rem;">
            <span>ภาษีมูลค่าเพิ่ม (VAT 7%):</span>
            <span>฿${vatVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div style="display:flex; justify-content:space-between; font-size:1.05rem; font-weight:800; border-top:1px solid #000; padding-top:0.4rem; margin-top:0.2rem;">
            <span>ยอดชำระสุทธิ (Grand Total):</span>
            <span>฿${subtotal.toLocaleString()}</span>
          </div>
        </div>
      </div>

      <!-- Payment details & Warranty notice -->
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1.5rem; font-size:0.75rem; border-top:1px solid #ccc; padding-top:0.8rem; color:#555;">
        <div>
          <strong>เงื่อนไขการชำระเงินและการรับประกัน:</strong>
          <ul style="margin:0.2rem 0 0 1rem; padding:0; line-height:1.3;">
            <li>ชำระเงินเรียบร้อยแล้วโดยวิธี: <strong>${sale.paymentMethod === 'cash' ? 'เงินสด (Cash)' : sale.paymentMethod === 'transfer' ? 'โอนเงิน / QR' : sale.paymentMethod === 'credit_card' ? 'บัตรเครดิต' : 'จัดไฟแนนซ์ (' + (sale.financeDetails ? sale.financeDetails.companyName : 'ไฟแนนซ์') + ')'}</strong></li>
            <li>สินค้าไอทีและสมาร์ทโฟน มีการรับประกันตามเงื่อนไขอย่างเป็นทางการของบริษัท</li>
          </ul>
        </div>
        <div style="text-align:right; font-size:0.75rem;">
          เจ้าหน้าที่ผู้ดำเนินการ: ____________________________<br>
          <span style="font-size:0.7rem; color:var(--text-muted); display:block; margin-top:0.2rem;">(${seller.fullName || seller.username || 'ผู้ดำเนินการขาย'})</span>
        </div>
      </div>
    </div>
  `;

  const footerHtml = `
    <button class="btn btn-secondary" onclick="openFullTaxInvoiceDetailsModal(window.currentReceiptSale)">ย้อนกลับ</button>
    <button class="btn btn-primary" onclick="window.print()"><i class="fa-solid fa-print"></i> พิมพ์ใบกำกับภาษี</button>
  `;

  openModal(`ใบกำกับภาษีเต็มรูปแบบ: ${sale.receiptNumber}`, bodyHtml, footerHtml);
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
    const expenses = res.expenses || [];
    state.salesCache = sales;
    state.expensesCache = expenses;

    const isAdminOrHq = ['admin', 'hq_stock_staff', 'purchase_staff'].includes((state.user ? state.user.role : 'admin'));

    container.innerHTML = `
      <!-- Summary Cards -->
      <div class="grid-cards" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:1rem; margin-bottom:1.5rem;">
        <div class="card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">
            <span style="color: var(--text-muted); font-size: 0.82rem; font-weight:600;">ยอดขายรวม (Revenue)</span>
            <i class="fa-solid fa-cart-shopping" style="color: var(--accent-primary); font-size:1.3rem;"></i>
          </div>
          <div style="font-size: 1.6rem; font-weight:800; color:var(--text-main);">฿${(summary.totalRevenue || 0).toLocaleString()}</div>
          <p style="font-size: 0.78rem; color: var(--text-muted); margin-top:0.2rem;">
            จำนวนบิลสำเร็จ: ${summary.totalSalesCount || 0} บิล
          </p>
        </div>

        <div class="card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">
            <span style="color: var(--text-muted); font-size: 0.82rem; font-weight:600;">กำไรขั้นต้น (Gross Profit)</span>
            <i class="fa-solid fa-coins" style="color: var(--accent-gold); font-size:1.3rem;"></i>
          </div>
          <div style="font-size: 1.6rem; font-weight:800; color:#d97706;">฿${(summary.totalProfit || 0).toLocaleString()}</div>
          <p style="font-size: 0.78rem; color: var(--text-muted); margin-top:0.2rem;">
            ทุนรวมสินค้า: ฿${(summary.totalCost || 0).toLocaleString()}
          </p>
        </div>

        <div class="card" style="border: 1px solid ${(summary.totalExpenses || 0) > 0 ? '#e11d48' : 'var(--border-color)'};">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">
            <span style="color: var(--text-muted); font-size: 0.82rem; font-weight:600;">รายจ่ายรวม (Expenses)</span>
            <i class="fa-solid fa-receipt" style="color: #e11d48; font-size:1.3rem;"></i>
          </div>
          <div style="font-size: 1.6rem; font-weight:800; color:#e11d48;">฿${(summary.totalExpenses || 0).toLocaleString()}</div>
          <p style="font-size: 0.78rem; color: var(--text-muted); margin-top:0.2rem;">
            รายจ่ายดำเนินงานทั่วไป
          </p>
        </div>

        <div class="card" style="border: 1px solid #10b981; background: rgba(16, 185, 129, 0.04);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">
            <span style="color: var(--text-muted); font-size: 0.82rem; font-weight:600;">กำไรสุทธิ (Net Profit)</span>
            <i class="fa-solid fa-hand-holding-dollar" style="color: #059669; font-size:1.3rem;"></i>
          </div>
          <div style="font-size: 1.6rem; font-weight:800; color:#059669;">฿${(summary.netProfit || 0).toLocaleString()}</div>
          <p style="font-size: 0.78rem; color: var(--text-muted); margin-top:0.2rem;">
            กำไรหลังหักราคาทุนและรายจ่าย
          </p>
        </div>

        <div class="card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">
            <span style="color: var(--text-muted); font-size: 0.82rem; font-weight:600;">กำไรที่รอรับจากไฟแนนซ์</span>
            <i class="fa-solid fa-clock-rotate-left" style="color: #d97706; font-size:1.3rem;"></i>
          </div>
          <div style="font-size: 1.6rem; font-weight:800; color:#d97706;">฿${(summary.pendingFinanceAmount || 0).toLocaleString()}</div>
          <p style="font-size: 0.78rem; color: var(--text-muted); margin-top:0.2rem;">
            ${summary.pendingFinanceCount || 0} รายการไฟแนนซ์รอโอนเงิน
          </p>
        </div>

        <div class="card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">
            <span style="color: var(--text-muted); font-size: 0.82rem; font-weight:600;">กำไรขายสด / โอน / บัตร</span>
            <i class="fa-solid fa-money-bill-wave" style="color: var(--accent-primary); font-size:1.3rem;"></i>
          </div>
          <div style="font-size: 1.6rem; font-weight:800; color:var(--text-main);">฿${(summary.cashProfit || 0).toLocaleString()}</div>
          <p style="font-size: 0.78rem; color: var(--text-muted); margin-top:0.2rem;">
            ยอดขายสดรวม: ฿${(summary.cashRevenue || 0).toLocaleString()}
          </p>
        </div>
      </div>

      <!-- Filter Controls -->
      <div id="fin-filter-panel" class="card" style="margin-bottom:1.5rem;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem;">
          <h3 style="font-size:1.1rem; font-weight:700; display:flex; align-items:center; gap:0.5rem;">
            <i class="fa-solid fa-filter" style="color:var(--accent-primary);"></i> กรองข้อมูลรายงานการเงิน
          </h3>
          
          <div style="display:flex; flex-wrap:wrap; align-items:center; gap:0.8rem;">
            <div>
              <label style="font-size:0.78rem; font-weight:600; color:var(--text-muted);">สาขา:</label>
              <select id="fin-branch-filter" class="form-select" style="width:auto; padding:0.3rem 0.6rem; font-size:0.82rem;">
                <option value="">-- ทุกสาขา --</option>
                ${state.masterOptions.branches ? state.masterOptions.branches.map(b => `<option value="${b._id}" ${filterParams.branchId === b._id ? 'selected' : ''}>${b.name}</option>`).join('') : ''}
              </select>
            </div>

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

            <div style="display:flex; align-items:center; gap:0.4rem;">
              <label style="font-size:0.78rem; font-weight:600; color:var(--text-muted);">เริ่มวันที่:</label>
              <input type="date" id="fin-start-date" class="form-control" value="${filterParams.startDate || ''}" style="width:auto; padding:0.3rem 0.6rem; font-size:0.82rem;">
            </div>

            <div style="display:flex; align-items:center; gap:0.4rem;">
              <label style="font-size:0.78rem; font-weight:600; color:var(--text-muted);">ถึงวันที่:</label>
              <input type="date" id="fin-end-date" class="form-control" value="${filterParams.endDate || ''}" style="width:auto; padding:0.3rem 0.6rem; font-size:0.82rem;">
            </div>

            <div style="display:flex; align-items:center; gap:0.4rem;">
              <input type="text" id="fin-search-input" class="form-control" placeholder="ค้นหาบิล, ลูกค้า, IMEI..." style="width:180px; padding:0.3rem 0.6rem; font-size:0.82rem;" onkeyup="filterFinanceTable()">
            </div>

            <button class="btn btn-primary btn-sm" onclick="applyFinanceFilters()">
              <i class="fa-solid fa-magnifying-glass"></i> ค้นหา
            </button>
            <button class="btn btn-secondary btn-sm" onclick="openPrintFinanceReportModal()" style="font-size:0.82rem; padding:0.3rem 0.6rem; font-weight:700;">
              <i class="fa-solid fa-print"></i> พิมพ์รายงาน
            </button>
            
            ${(filterParams.branchId || filterParams.paymentMethod || filterParams.payoutStatus || filterParams.startDate || filterParams.endDate) ? `
              <button class="btn btn-secondary btn-sm" onclick="renderFinanceView({})" style="font-size:0.82rem; padding:0.3rem 0.6rem; font-weight:700;">
                <i class="fa-solid fa-rotate-left"></i> ล้างตัวกรอง
              </button>
            ` : ''}
          </div>
        </div>
      </div>

      <!-- Tab Selection -->
      <div style="display:flex; gap:0.5rem; margin-bottom:1.2rem; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:0.6rem;">
        <button id="fin-tab-sales" class="btn btn-primary btn-sm" onclick="switchFinanceTab('sales')" style="font-weight:700; border-radius:4px 4px 0 0; padding:0.5rem 1.2rem;">
          <i class="fa-solid fa-cash-register"></i> รายการขายสินค้า & กำไร
        </button>
        <button id="fin-tab-expenses" class="btn btn-secondary btn-sm" onclick="switchFinanceTab('expenses')" style="font-weight:700; border-radius:4px 4px 0 0; padding:0.5rem 1.2rem;">
          <i class="fa-solid fa-receipt"></i> บันทึกรายจ่ายดำเนินงาน
        </button>
      </div>

      <!-- Sales Tab Panel -->
      <div id="fin-sales-panel">
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
                <th style="text-align:center;">การคืนเงินทุนสาขา</th>
                <th style="text-align:center;">ดำเนินการ</th>
              </tr>
            </thead>
            <tbody>
              ${sales.length === 0 ? `<tr><td colspan="10" style="text-align:center; color:var(--text-muted); padding:2rem;">ไม่พบรายการขายในเงื่อนไขที่เลือก</td></tr>` : ''}
              ${sales.map((s, idx) => {
                const itemsStr = (s.items || []).map(i => {
                  const std = i.standardPrice || i.unitPrice || 0;
                  const act = i.unitPrice || 0;
                  return `
                    <strong>• ${i.productName}</strong> <span style="font-family:monospace; color:#fbbf24; font-size:0.78rem;">(${i.imei})</span><br>
                    <span style="font-size:0.75rem; color:var(--text-muted);">
                      ราคาแนะนำ: ฿${std.toLocaleString()} | ขายจริง: <strong style="color:#34d399;">฿${act.toLocaleString()}</strong>
                    </span>
                  `;
                }).join('<div style="margin: 0.35rem 0; border-top:1px dashed rgba(255,255,255,0.08);"></div>');
                const isFinance = s.paymentMethod === 'finance';
                const finDetails = s.financeDetails || {};
                const isVoided = s.status === 'voided';
                const isPending = isFinance && finDetails.payoutStatus === 'pending_payout';

                let costTotal = s.totalCost || 0;
                const isReturnedCost = s.costReturnedStatus === 'returned' && s.actualCostReturned !== undefined && s.actualCostReturned !== 0;
                if (isReturnedCost) {
                  costTotal = s.actualCostReturned;
                } else if (!costTotal && s.items) {
                  costTotal = s.items.reduce((sum, item) => sum + ((item.costPrice || 0) * (item.quantity || 1)), 0);
                }
                const profitTotal = isReturnedCost ? (s.grandTotal - costTotal) : (s.totalProfit !== undefined ? s.totalProfit : (s.grandTotal - costTotal));

                return `
                  <tr class="fin-row" data-search="${(s.receiptNumber + ' ' + (s.branch ? s.branch.name : '') + ' ' + (s.customer ? s.customer.name : '') + ' ' + (s.items ? s.items.map(item => item.productName + ' ' + item.imei).join(' ') : '') + ' ' + (s.soldBy ? s.soldBy.fullName || s.soldBy.username : '')).toLowerCase()}" style="${isVoided ? 'opacity: 0.6; background: rgba(239, 68, 68, 0.05);' : ''}">
                    <td>
                      <strong>${s.receiptNumber}</strong>
                      ${isVoided ? '<br><span class="badge badge-red" style="font-size:0.68rem; padding:0.1rem 0.3rem;"><i class="fa-solid fa-ban"></i> ยกเลิกบิลแล้ว (Voided)</span>' : ''}<br>
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
                    <td>
                      ฿${costTotal.toLocaleString()}
                      ${s.costReturnedStatus === 'returned' && s.actualCostReturned !== undefined && s.actualCostReturned !== 0 && s.actualCostReturned !== s.totalCost ? `
                        <br><span style="font-size:0.72rem; color:var(--text-muted); text-decoration:line-through; display:block; margin-top:0.1rem;">เดิม: ฿${(s.totalCost || 0).toLocaleString()}</span>
                      ` : ''}
                    </td>
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
                    <td style="text-align:center; vertical-align:middle;">
                      ${isFinance ? `
                        <span style="color:var(--text-muted); font-size:0.8rem;">- (คืนวงเงินอัตโนมัติ) -</span>
                      ` : `
                        ${(s.costReturnedStatus || 'pending') === 'pending' ? `
                          <span class="badge badge-yellow" style="margin-bottom:0.3rem;"><i class="fa-solid fa-clock"></i> รอโอนทุนคืน (฿${costTotal.toLocaleString()})</span><br>
                          <button class="btn btn-success btn-sm" style="padding:0.25rem 0.6rem; font-size:0.78rem;" onclick="openRecordCostReturnModal('${s._id}', '${s.receiptNumber}', ${costTotal})">
                            <i class="fa-solid fa-check"></i> บันทึกโอนทุนคืน
                          </button>
                        ` : `
                          <span class="badge badge-green"><i class="fa-solid fa-circle-check"></i> โอนทุนคืนแล้ว (฿${(s.actualCostReturned || s.totalCost || 0).toLocaleString()})</span><br>
                          <span style="font-size:0.75rem; color:var(--text-muted); display:block; margin-top:0.15rem; line-height:1.35;">
                            วันที่คืน: ${s.costReturnedDate ? new Date(s.costReturnedDate).toLocaleDateString('th-TH') : '-'}<br>
                            ${s.actualCostReturned !== undefined && s.actualCostReturned !== 0 && s.actualCostReturned !== costTotal ? `
                              <span style="color:#fbbf24; font-weight:700;">ส่วนต่างทุน: ฿${(s.actualCostReturned - costTotal).toLocaleString()}</span>
                            ` : ''}
                          </span>
                        `}
                      `}
                    </td>
                    <td style="text-align:center; vertical-align:middle;">
                      <button class="btn btn-primary btn-sm" style="padding:0.25rem 0.5rem; font-size:0.78rem; font-weight:700;" onclick="reprintReceiptVoucher(${idx})">
                        <i class="fa-solid fa-print"></i> พิมพ์
                      </button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Expenses Tab Panel -->
      <div id="fin-expenses-panel" style="display:none;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; flex-wrap:wrap; gap:0.5rem;">
          <div style="font-weight:700; font-size:1.05rem; color:var(--text-main);">
            <i class="fa-solid fa-list-check" style="color:var(--accent-primary);"></i> ตารางรายการรายจ่ายระบบ
          </div>
          <button class="btn btn-danger btn-sm" style="font-weight:700;" onclick="openAddExpenseModal()">
            <i class="fa-solid fa-plus-circle"></i> + บันทึกรายจ่ายใหม่
          </button>
        </div>

        <!-- Dynamic Detailed Expense Filters -->
        <div style="background:rgba(0,0,0,0.025); padding:1rem; border-radius:6px; border:1px solid var(--border-color); margin-bottom:1.5rem;">
          <div style="display:flex; flex-wrap:wrap; align-items:center; gap:0.8rem; margin-bottom:0.8rem;">
            <div>
              <label style="font-size:0.75rem; color:var(--text-muted); font-weight:600;">สาขา:</label>
              <select id="exp-branch-filter" class="form-select" style="width:auto; font-size:0.78rem; padding:0.2rem 0.4rem; height:auto; min-height:auto;">
                <option value="" ${!filterParams.branchId ? 'selected' : ''}>-- ทุกสาขา --</option>
                <option value="hq" ${filterParams.branchId === 'hq' ? 'selected' : ''}>ส่วนกลาง (สำนักงานใหญ่)</option>
                ${(state.masterOptions.branches || []).map(b => `<option value="${b._id}" ${filterParams.branchId === b._id ? 'selected' : ''}>${b.name}</option>`).join('')}
              </select>
            </div>

            <div>
              <label style="font-size:0.75rem; color:var(--text-muted); font-weight:600;">หมวดหมู่:</label>
              <select id="exp-category-filter" class="form-select" style="width:auto; font-size:0.78rem; padding:0.2rem 0.4rem; height:auto; min-height:auto;" onchange="filterExpenseTable()">
                <option value="">-- ทั้งหมด --</option>
                <option value="Rent">ค่าเช่าสถานที่</option>
                <option value="Utilities">ค่าน้ำ/ค่าไฟ/อินเทอร์เน็ต</option>
                <option value="Salary">เงินเดือน/ค่าจ้างพนักงาน</option>
                <option value="Marketing">ค่าโฆษณา/การตลาด</option>
                <option value="Repair/Maintenance">ค่าซ่อมแซม/บำรุงรักษา</option>
                <option value="Other">อื่นๆ</option>
                ${[...new Set(expenses.map(e => e.category))].filter(c => !['Rent', 'Utilities', 'Salary', 'Marketing', 'Repair/Maintenance', 'Other'].includes(c)).map(c => `<option value="${c}">${c}</option>`).join('')}
              </select>
            </div>

            <div>
              <label style="font-size:0.75rem; color:var(--text-muted); font-weight:600;">ผู้บันทึก:</label>
              <select id="exp-recorded-by-filter" class="form-select" style="width:auto; font-size:0.78rem; padding:0.2rem 0.4rem; height:auto; min-height:auto;" onchange="filterExpenseTable()">
                <option value="">-- ทั้งหมด --</option>
                ${(() => {
                  const uniqueRecoders = [];
                  const recoderIds = new Set();
                  expenses.forEach(e => {
                    if (e.recordedBy) {
                      const id = e.recordedBy._id || e.recordedBy;
                      if (!recoderIds.has(id)) {
                        recoderIds.add(id);
                        uniqueRecoders.push(e.recordedBy);
                      }
                    }
                  });
                  return uniqueRecoders.map(u => `<option value="${u._id || u}">${u.fullName || u.username}</option>`).join('');
                })()}
              </select>
            </div>

            <div style="display:flex; align-items:center; gap:0.3rem;">
              <label style="font-size:0.75rem; color:var(--text-muted); font-weight:600;">เริ่มวันที่:</label>
              <input type="date" id="exp-start-date" class="form-control" value="${filterParams.startDate || ''}" style="width:auto; font-size:0.78rem; padding:0.2rem 0.4rem; height:auto; min-height:auto;">
            </div>

            <div style="display:flex; align-items:center; gap:0.3rem;">
              <label style="font-size:0.75rem; color:var(--text-muted); font-weight:600;">ถึงวันที่:</label>
              <input type="date" id="exp-end-date" class="form-control" value="${filterParams.endDate || ''}" style="width:auto; font-size:0.78rem; padding:0.2rem 0.4rem; height:auto; min-height:auto;">
            </div>
          </div>

          <div style="display:flex; flex-wrap:wrap; align-items:center; gap:0.8rem;">
            <div style="display:flex; align-items:center; gap:0.3rem;">
              <label style="font-size:0.75rem; color:var(--text-muted); font-weight:600;">จำนวนเงินต่ำสุด:</label>
              <input type="number" id="exp-min-amount" class="form-control" placeholder="Min" style="width:100px; font-size:0.78rem; padding:0.2rem 0.4rem; height:auto; min-height:auto;" onkeyup="filterExpenseTable()" onchange="filterExpenseTable()">
            </div>

            <div style="display:flex; align-items:center; gap:0.3rem;">
              <label style="font-size:0.75rem; color:var(--text-muted); font-weight:600;">จำนวนเงินสูงสุด:</label>
              <input type="number" id="exp-max-amount" class="form-control" placeholder="Max" style="width:100px; font-size:0.78rem; padding:0.2rem 0.4rem; height:auto; min-height:auto;" onkeyup="filterExpenseTable()" onchange="filterExpenseTable()">
            </div>

            <div style="display:flex; align-items:center; gap:0.3rem;">
              <label style="font-size:0.75rem; color:var(--text-muted); font-weight:600;">ค้นหาคำสำคัญ:</label>
              <input type="text" id="exp-search-input" class="form-control" placeholder="ค้นหาเลขที่, ชื่อรายการ, หมายเหตุ..." style="width:240px; font-size:0.78rem; padding:0.2rem 0.4rem; height:auto; min-height:auto;" onkeyup="filterExpenseTable()">
            </div>

            <button class="btn btn-primary btn-sm" onclick="applyExpenseFilters()" style="padding:0.35rem 0.8rem; font-size:0.78rem; font-weight:700;">
              <i class="fa-solid fa-magnifying-glass"></i> ค้นหาตามสาขา/วันที่
            </button>
            
            ${(filterParams.branchId || filterParams.startDate || filterParams.endDate) ? `
              <button class="btn btn-secondary btn-sm" onclick="renderFinanceView({})" style="padding:0.35rem 0.8rem; font-size:0.78rem; font-weight:700;">
                <i class="fa-solid fa-rotate-left"></i> ล้างตัวกรอง
              </button>
            ` : ''}
          </div>
        </div>

        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>เลขที่รายจ่าย / วันที่</th>
                <th>ชื่อรายการ</th>
                <th>สาขา</th>
                <th>หมวดหมู่</th>
                <th>จำนวนเงิน (บาท)</th>
                <th>ผู้บันทึก</th>
                <th>หมายเหตุ / รายละเอียด</th>
                <th style="text-align:center;">จัดการ</th>
              </tr>
            </thead>
            <tbody id="expenses-tbody">
              ${expenses.length === 0 ? `<tr><td colspan="8" style="text-align:center; color:var(--text-muted); padding:2rem;">ยังไม่มีรายการบันทึกรายจ่ายใดๆ</td></tr>` : ''}
              ${expenses.map(exp => {
                const dateStr = new Date(exp.expenseDate).toLocaleDateString('th-TH');
                const isoDate = new Date(exp.expenseDate).toISOString().split('T')[0];
                const searchStr = (exp.expenseNumber + ' ' + (exp.title || '') + ' ' + (exp.branch ? exp.branch.name : 'ส่วนกลาง') + ' ' + exp.category + ' ' + (exp.recordedBy ? exp.recordedBy.fullName || exp.recordedBy.username : '') + ' ' + (exp.note || '')).toLowerCase();
                const defaultCategories = {
                  'Rent': 'ค่าเช่าสถานที่',
                  'Utilities': 'ค่าน้ำ/ค่าไฟ/อินเทอร์เน็ต',
                  'Salary': 'เงินเดือน/ค่าจ้างพนักงาน',
                  'Marketing': 'ค่าโฆษณา/การตลาด',
                  'Repair/Maintenance': 'ค่าซ่อมแซม/บำรุงรักษา',
                  'Other': 'อื่นๆ'
                };
                const categoryThai = defaultCategories[exp.category] || exp.category;
                const recUserId = exp.recordedBy ? exp.recordedBy._id || exp.recordedBy : '';

                return `
                  <tr class="exp-row" data-search="${searchStr}" data-category="${exp.category}" data-date="${isoDate}" data-recorded-by="${recUserId}" data-amount="${exp.amount || 0}">
                    <td>
                      <strong style="color:#e11d48;">${exp.expenseNumber}</strong><br>
                      <span style="font-size:0.78rem; color:var(--text-muted);">${dateStr}</span>
                    </td>
                    <td><strong style="color:var(--text-main);">${exp.title || '-'}</strong></td>
                    <td><strong>${exp.branch ? exp.branch.name : 'ส่วนกลาง (สำนักงานใหญ่)'}</strong></td>
                    <td><span class="badge badge-gray">${categoryThai}</span></td>
                    <td><strong style="color:#e11d48; font-size:0.95rem;">฿${(exp.amount || 0).toLocaleString()}</strong></td>
                    <td><span style="font-size:0.83rem;">${exp.recordedBy ? exp.recordedBy.fullName || exp.recordedBy.username : 'พนักงาน'}</span></td>
                    <td style="font-size:0.83rem; max-width:250px; word-break:break-word;">${exp.note || '-'}</td>
                    <td style="text-align:center; white-space:nowrap;">
                      <button class="btn btn-warning btn-sm" style="padding:0.25rem 0.5rem; font-size:0.75rem; font-weight:700; margin-right:0.25rem;" onclick="openEditExpenseModal('${exp._id}')">
                        <i class="fa-solid fa-pen-to-square"></i> แก้ไข
                      </button>
                      <button class="btn btn-danger btn-sm" style="padding:0.25rem 0.5rem; font-size:0.75rem; font-weight:700;" onclick="deleteExpenseAction('${exp._id}')">
                        <i class="fa-solid fa-trash-can"></i> ลบ
                      </button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    // Restore active tab state
    if (state.activeFinanceTab === 'expenses') {
      switchFinanceTab('expenses');
    }
  } catch (err) {
    container.innerHTML = `<div style="color:#ef4444; padding:2rem;">เกิดข้อผิดพลาดในการโหลดรายงานการเงิน: ${err.message}</div>`;
  }
}

function applyFinanceFilters() {
  const branchSelect = document.getElementById('fin-branch-filter');
  const paymentSelect = document.getElementById('fin-payment-filter');
  const payoutSelect = document.getElementById('fin-payout-filter');
  const startDateInput = document.getElementById('fin-start-date');
  const endDateInput = document.getElementById('fin-end-date');

  const filterParams = {};
  if (branchSelect && branchSelect.value) filterParams.branchId = branchSelect.value;
  if (paymentSelect && paymentSelect.value) filterParams.paymentMethod = paymentSelect.value;
  if (payoutSelect && payoutSelect.value) filterParams.payoutStatus = payoutSelect.value;
  if (startDateInput && startDateInput.value) filterParams.startDate = startDateInput.value;
  if (endDateInput && endDateInput.value) filterParams.endDate = endDateInput.value;

  renderFinanceView(filterParams);
}

function filterFinanceTable() {
  const query = document.getElementById('fin-search-input').value.toLowerCase().trim();
  document.querySelectorAll('.fin-row').forEach(row => {
    const searchData = row.getAttribute('data-search') || '';
    if (searchData.includes(query)) {
      row.style.display = '';
    } else {
      row.style.display = 'none';
    }
  });
}

function switchFinanceTab(tabName) {
  const salesPanel = document.getElementById('fin-sales-panel');
  const expensesPanel = document.getElementById('fin-expenses-panel');
  const salesTab = document.getElementById('fin-tab-sales');
  const expensesTab = document.getElementById('fin-tab-expenses');
  const filterPanel = document.getElementById('fin-filter-panel');

  if (tabName === 'sales') {
    if (salesPanel) salesPanel.style.display = 'block';
    if (expensesPanel) expensesPanel.style.display = 'none';
    if (salesTab) salesTab.className = 'btn btn-primary btn-sm';
    if (expensesTab) expensesTab.className = 'btn btn-secondary btn-sm';
    if (filterPanel) filterPanel.style.display = 'block';
  } else {
    if (salesPanel) salesPanel.style.display = 'none';
    if (expensesPanel) expensesPanel.style.display = 'block';
    if (salesTab) salesTab.className = 'btn btn-secondary btn-sm';
    if (expensesTab) expensesTab.className = 'btn btn-primary btn-sm';
    if (filterPanel) filterPanel.style.display = 'none';
  }
  state.activeFinanceTab = tabName;
}

function toggleCustomExpenseCategory() {
  const catSelect = document.getElementById('exp-category');
  const customGroup = document.getElementById('exp-custom-category-group');
  const customInput = document.getElementById('exp-custom-category');
  if (catSelect && catSelect.value === 'NEW_CATEGORY') {
    if (customGroup) customGroup.style.display = 'block';
    if (customInput) customInput.setAttribute('required', 'true');
  } else {
    if (customGroup) customGroup.style.display = 'none';
    if (customInput) {
      customInput.removeAttribute('required');
      customInput.value = '';
    }
  }
}

function openAddExpenseModal() {
  const isHqUser = !state.user.branch || state.user.branch.code === 'BR-HQ01' || (state.user.branch.name && state.user.branch.name.includes('สำนักงานใหญ่'));
  const isAdminOrHq = ['admin', 'hq_stock_staff', 'purchase_staff'].includes((state.user ? state.user.role : 'admin')) || isHqUser;
  const branches = state.masterOptions.branches || [];

  const expenses = state.expensesCache || [];
  const uniqueCategories = [...new Set(expenses.map(e => e.category))];
  const defaultCats = {
    'Rent': 'ค่าเช่าสถานที่',
    'Utilities': 'ค่าน้ำ/ค่าไฟ/อินเทอร์เน็ต',
    'Salary': 'เงินเดือน/ค่าจ้างพนักงาน',
    'Marketing': 'ค่าโฆษณา/การตลาด',
    'Repair/Maintenance': 'ค่าซ่อมแซม/บำรุงรักษา',
    'Other': 'อื่นๆ'
  };

  const bodyHtml = `
    <form id="add-expense-form" onsubmit="event.preventDefault(); submitAddExpense();">
      <div class="form-group" style="margin-bottom:1rem;">
        <label for="exp-title">ชื่อรายการรายจ่าย <span style="color:#ef4444;">*</span></label>
        <input type="text" id="exp-title" class="form-control" placeholder="เช่น ค่าอินเทอร์เน็ตเดือน 8, ซื้อหลอดไฟใหม่..." required style="width:100%;">
      </div>

      ${isAdminOrHq ? `
        <div class="form-group" style="margin-bottom:1rem;">
          <label for="exp-branch">สาขาที่รับผิดชอบรายจ่าย <span style="color:#ef4444;">*</span></label>
          <select id="exp-branch" class="form-select" required style="width:100%;">
            <option value="hq">ส่วนกลาง (สำนักงานใหญ่)</option>
            ${branches.map(b => `<option value="${b._id}">${b.name}</option>`).join('')}
          </select>
        </div>
      ` : ''}

      <div class="form-group" style="margin-bottom:1rem;">
        <label for="exp-category">หมวดหมู่รายจ่าย <span style="color:#ef4444;">*</span></label>
        <select id="exp-category" class="form-select" required style="width:100%;" onchange="toggleCustomExpenseCategory()">
          <option value="Rent">ค่าเช่าสถานที่</option>
          <option value="Utilities">ค่าน้ำ/ค่าไฟ/อินเทอร์เน็ต</option>
          <option value="Salary">เงินเดือน/ค่าจ้างพนักงาน</option>
          <option value="Marketing">ค่าโฆษณา/การตลาด</option>
          <option value="Repair/Maintenance">ค่าซ่อมแซม/บำรุงรักษา</option>
          <option value="Other">อื่นๆ</option>
          ${uniqueCategories.filter(c => !Object.keys(defaultCats).includes(c)).map(c => `<option value="${c}">${c}</option>`).join('')}
          <option value="NEW_CATEGORY" style="color:var(--accent-secondary); font-weight:700;">+ เพิ่มหมวดหมู่ใหม่...</option>
        </select>
        <div id="exp-custom-category-group" style="display:none; margin-top:0.5rem;">
          <input type="text" id="exp-custom-category" class="form-control" placeholder="พิมพ์ชื่อหมวดหมู่ใหม่..." style="width:100%;">
        </div>
      </div>

      <div class="form-group" style="margin-bottom:1rem;">
        <label for="exp-amount">จำนวนเงิน (บาท) <span style="color:#ef4444;">*</span></label>
        <input type="number" id="exp-amount" class="form-control" placeholder="ระบุจำนวนเงินที่จ่าย..." min="1" step="any" required style="width:100%;">
      </div>

      <div class="form-group" style="margin-bottom:1rem;">
        <label for="exp-date">วันที่ทำรายการ</label>
        <input type="date" id="exp-date" class="form-control" value="${new Date().toISOString().split('T')[0]}" style="width:100%;">
      </div>

      <div class="form-group" style="margin-bottom:1rem;">
        <label for="exp-note">หมายเหตุ / รายละเอียดเพิ่มเติม</label>
        <textarea id="exp-note" class="form-control" rows="3" placeholder="ระบุรายละเอียดรายจ่ายเพื่อการตรวจสอบ..." style="width:100%;"></textarea>
      </div>
    </form>
  `;

  const footerHtml = `
    <button type="button" class="btn btn-secondary" onclick="closeModal()">ยกเลิก</button>
    <button type="submit" form="add-expense-form" class="btn btn-primary">
      <i class="fa-solid fa-save"></i> บันทึกรายจ่าย
    </button>
  `;

  openModal('บันทึกรายจ่ายใหม่', bodyHtml, footerHtml);
}

async function submitAddExpense() {
  const branchEl = document.getElementById('exp-branch');
  const branchId = branchEl ? branchEl.value : '';
  const title = document.getElementById('exp-title').value.trim();
  const amount = document.getElementById('exp-amount').value;
  const expenseDate = document.getElementById('exp-date').value;
  const note = document.getElementById('exp-note').value.trim();

  let category = document.getElementById('exp-category').value;
  if (category === 'NEW_CATEGORY') {
    category = document.getElementById('exp-custom-category').value.trim();
    if (!category) {
      showToast('กรุณาระบุชื่อหมวดหมู่รายจ่ายใหม่', 'error');
      return;
    }
  }

  try {
    const res = await apiRequest('/expenses', 'POST', {
      branchId,
      title,
      category,
      amount,
      note,
      expenseDate
    });

    if (res.success) {
      showToast('บันทึกรายจ่ายเรียบร้อยแล้ว');
      closeModal();
      const activeBranchFilter = document.getElementById('fin-branch-filter') ? document.getElementById('fin-branch-filter').value : '';
      const activeStartDate = document.getElementById('fin-start-date') ? document.getElementById('fin-start-date').value : '';
      const activeEndDate = document.getElementById('fin-end-date') ? document.getElementById('fin-end-date').value : '';
      renderFinanceView({
        branchId: activeBranchFilter,
        startDate: activeStartDate,
        endDate: activeEndDate
      });
    }
  } catch (err) {
    // Handled by apiRequest
  }
}

function openEditExpenseModal(expenseId) {
  const expense = (state.expensesCache || []).find(e => e._id === expenseId);
  if (!expense) {
    showToast('ไม่พบข้อมูลรายจ่าย', 'error');
    return;
  }

  const isHqUser = !state.user.branch || state.user.branch.code === 'BR-HQ01' || (state.user.branch.name && state.user.branch.name.includes('สำนักงานใหญ่'));
  const isAdminOrHq = ['admin', 'hq_stock_staff', 'purchase_staff'].includes((state.user ? state.user.role : 'admin')) || isHqUser;
  const branches = state.masterOptions.branches || [];

  const expenses = state.expensesCache || [];
  const uniqueCategories = [...new Set(expenses.map(e => e.category))];
  const defaultCats = {
    'Rent': 'ค่าเช่าสถานที่',
    'Utilities': 'ค่าน้ำ/ค่าไฟ/อินเทอร์เน็ต',
    'Salary': 'เงินเดือน/ค่าจ้างพนักงาน',
    'Marketing': 'ค่าโฆษณา/การตลาด',
    'Repair/Maintenance': 'ค่าซ่อมแซม/บำรุงรักษา',
    'Other': 'อื่นๆ'
  };

  const isoDate = new Date(expense.expenseDate).toISOString().split('T')[0];
  const expenseBranchId = expense.branch ? (expense.branch._id || expense.branch) : '';

  const bodyHtml = `
    <form id="edit-expense-form" onsubmit="event.preventDefault(); submitEditExpense('${expenseId}');">
      <div class="form-group" style="margin-bottom:1rem;">
        <label for="exp-title">ชื่อรายการรายจ่าย <span style="color:#ef4444;">*</span></label>
        <input type="text" id="exp-title" class="form-control" placeholder="เช่น ค่าอินเทอร์เน็ตสาขาเดือน 8, ซื้อหลอดไฟใหม่..." value="${expense.title || ''}" required style="width:100%;">
      </div>

      ${isAdminOrHq ? `
        <div class="form-group" style="margin-bottom:1rem;">
          <label for="exp-branch">สาขาที่รับผิดชอบรายจ่าย <span style="color:#ef4444;">*</span></label>
          <select id="exp-branch" class="form-select" required style="width:100%;">
            <option value="hq" ${expenseBranchId === '' ? 'selected' : ''}>ส่วนกลาง (สำนักงานใหญ่)</option>
            ${branches.map(b => `<option value="${b._id}" ${String(b._id) === String(expenseBranchId) ? 'selected' : ''}>${b.name}</option>`).join('')}
          </select>
        </div>
      ` : ''}

      <div class="form-group" style="margin-bottom:1rem;">
        <label for="exp-category">หมวดหมู่รายจ่าย <span style="color:#ef4444;">*</span></label>
        <select id="exp-category" class="form-select" required style="width:100%;" onchange="toggleCustomExpenseCategory()">
          <option value="Rent" ${expense.category === 'Rent' ? 'selected' : ''}>ค่าเช่าสถานที่</option>
          <option value="Utilities" ${expense.category === 'Utilities' ? 'selected' : ''}>ค่าน้ำ/ค่าไฟ/อินเทอร์เน็ต</option>
          <option value="Salary" ${expense.category === 'Salary' ? 'selected' : ''}>เงินเดือน/ค่าจ้างพนักงาน</option>
          <option value="Marketing" ${expense.category === 'Marketing' ? 'selected' : ''}>ค่าโฆษณา/การตลาด</option>
          <option value="Repair/Maintenance" ${expense.category === 'Repair/Maintenance' ? 'selected' : ''}>ค่าซ่อมแซม/บำรุงรักษา</option>
          <option value="Other" ${expense.category === 'Other' ? 'selected' : ''}>อื่นๆ</option>
          ${uniqueCategories.filter(c => !Object.keys(defaultCats).includes(c)).map(c => `<option value="${c}" ${expense.category === c ? 'selected' : ''}>${c}</option>`).join('')}
          <option value="NEW_CATEGORY" style="color:var(--accent-secondary); font-weight:700;">+ เพิ่มหมวดหมู่ใหม่...</option>
        </select>
        <div id="exp-custom-category-group" style="display:none; margin-top:0.5rem;">
          <input type="text" id="exp-custom-category" class="form-control" placeholder="พิมพ์ชื่อหมวดหมู่ใหม่..." style="width:100%;">
        </div>
      </div>

      <div class="form-group" style="margin-bottom:1rem;">
        <label for="exp-amount">จำนวนเงิน (บาท) <span style="color:#ef4444;">*</span></label>
        <input type="number" id="exp-amount" class="form-control" placeholder="ระบุจำนวนเงินที่จ่าย..." min="1" step="any" value="${expense.amount || ''}" required style="width:100%;">
      </div>

      <div class="form-group" style="margin-bottom:1rem;">
        <label for="exp-date">วันที่ทำรายการ</label>
        <input type="date" id="exp-date" class="form-control" value="${isoDate}" style="width:100%;">
      </div>

      <div class="form-group" style="margin-bottom:1rem;">
        <label for="exp-note">หมายเหตุ / รายละเอียดเพิ่มเติม</label>
        <textarea id="exp-note" class="form-control" rows="3" placeholder="ระบุรายละเอียดรายจ่ายเพื่อการตรวจสอบ..." style="width:100%;">${expense.note || ''}</textarea>
      </div>
    </form>
  `;

  const footerHtml = `
    <button type="button" class="btn btn-secondary" onclick="closeModal()">ยกเลิก</button>
    <button type="submit" form="edit-expense-form" class="btn btn-primary">
      <i class="fa-solid fa-save"></i> บันทึกการแก้ไข
    </button>
  `;

  openModal('แก้ไขรายการรายจ่าย', bodyHtml, footerHtml);
}

async function submitEditExpense(expenseId) {
  const branchEl = document.getElementById('exp-branch');
  const branchId = branchEl ? branchEl.value : '';
  const title = document.getElementById('exp-title').value.trim();
  const amount = document.getElementById('exp-amount').value;
  const expenseDate = document.getElementById('exp-date').value;
  const note = document.getElementById('exp-note').value.trim();

  let category = document.getElementById('exp-category').value;
  if (category === 'NEW_CATEGORY') {
    category = document.getElementById('exp-custom-category').value.trim();
    if (!category) {
      showToast('กรุณาระบุชื่อหมวดหมู่รายจ่ายใหม่', 'error');
      return;
    }
  }

  try {
    const res = await apiRequest(`/expenses/${expenseId}`, 'PUT', {
      branchId,
      title,
      category,
      amount,
      note,
      expenseDate
    });

    if (res.success) {
      showToast('แก้ไขข้อมูลรายจ่ายเรียบร้อยแล้ว');
      closeModal();
      const activeBranchFilter = document.getElementById('fin-branch-filter') ? document.getElementById('fin-branch-filter').value : '';
      const activeStartDate = document.getElementById('fin-start-date') ? document.getElementById('fin-start-date').value : '';
      const activeEndDate = document.getElementById('fin-end-date') ? document.getElementById('fin-end-date').value : '';
      renderFinanceView({
        branchId: activeBranchFilter,
        startDate: activeStartDate,
        endDate: activeEndDate
      });
    }
  } catch (err) {
    // Handled by apiRequest
  }
}

async function deleteExpenseAction(id) {
  if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการลบรายการรายจ่ายนี้? (การลบรายการนี้จะไม่สามารถกู้คืนได้)')) {
    return;
  }

  try {
    const res = await apiRequest(`/expenses/${id}`, 'DELETE');
    if (res.success) {
      showToast('ลบรายการรายจ่ายเรียบร้อยแล้ว');
      const activeBranchFilter = document.getElementById('fin-branch-filter') ? document.getElementById('fin-branch-filter').value : '';
      const activeStartDate = document.getElementById('fin-start-date') ? document.getElementById('fin-start-date').value : '';
      const activeEndDate = document.getElementById('fin-end-date') ? document.getElementById('fin-end-date').value : '';
      renderFinanceView({
        branchId: activeBranchFilter,
        startDate: activeStartDate,
        endDate: activeEndDate
      });
    }
  } catch (err) {
    // Handled by apiRequest
  }
}

function applyExpenseFilters() {
  const branchSelect = document.getElementById('exp-branch-filter');
  const branchId = branchSelect ? branchSelect.value : '';
  const startDate = document.getElementById('exp-start-date') ? document.getElementById('exp-start-date').value : '';
  const endDate = document.getElementById('exp-end-date') ? document.getElementById('exp-end-date').value : '';

  renderFinanceView({
    branchId,
    startDate,
    endDate
  });
}

function filterExpenseTable() {
  const query = document.getElementById('exp-search-input') ? document.getElementById('exp-search-input').value.toLowerCase().trim() : '';
  const categoryFilter = document.getElementById('exp-category-filter') ? document.getElementById('exp-category-filter').value : '';
  const recordedByFilter = document.getElementById('exp-recorded-by-filter') ? document.getElementById('exp-recorded-by-filter').value : '';
  const minAmount = document.getElementById('exp-min-amount') && document.getElementById('exp-min-amount').value ? Number(document.getElementById('exp-min-amount').value) : null;
  const maxAmount = document.getElementById('exp-max-amount') && document.getElementById('exp-max-amount').value ? Number(document.getElementById('exp-max-amount').value) : null;

  document.querySelectorAll('.exp-row').forEach(row => {
    const searchData = row.getAttribute('data-search') || '';
    const rowCategory = row.getAttribute('data-category') || '';
    const rowRecordedBy = row.getAttribute('data-recorded-by') || '';
    const rowAmount = Number(row.getAttribute('data-amount') || '0');
    
    let matchSearch = searchData.includes(query);
    let matchCategory = !categoryFilter || rowCategory === categoryFilter;
    let matchRecordedBy = !recordedByFilter || rowRecordedBy === recordedByFilter;
    let matchMinAmount = minAmount === null || rowAmount >= minAmount;
    let matchMaxAmount = maxAmount === null || rowAmount <= maxAmount;

    if (matchSearch && matchCategory && matchRecordedBy && matchMinAmount && matchMaxAmount) {
      row.style.display = '';
    } else {
      row.style.display = 'none';
    }
  });
}

function openRecordFinancePayoutModal(saleId, receiptNumber, amount, companyName) {
  const bodyHtml = `
    <div style="background:rgba(0,0,0,0.03); border:1px solid var(--border-color); padding:1rem; border-radius:6px; margin-bottom:1.2rem;">
      <div style="display:flex; justify-content:space-between; margin-bottom:0.4rem; font-size:0.88rem;">
        <span>เลขที่ใบเสร็จ: <strong>${receiptNumber}</strong></span>
        <span>บริษัทไฟแนนซ์: <strong style="color:var(--accent-gold);">${companyName || 'จัดไฟแนนซ์'}</strong></span>
      </div>
      <div style="display:flex; justify-content:space-between; font-size:1.1rem; font-weight:800; color:#059669;">
        <span>ยอดเงินกำไรที่รอรับจากไฟแนนซ์:</span>
        <span>฿${Number(amount).toLocaleString()}</span>
      </div>
    </div>

    <form id="record-payout-form" onsubmit="event.preventDefault(); submitFinancePayoutReceived('${saleId}');">
      <div class="form-group">
        <label for="fp-received-date" style="color:#d97706; font-weight:700;">
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

        <form id="add-master-form" class="grid-form-row" style="gap:1rem; align-items:end;">
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
              <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.02); border:1px solid var(--border-color); padding:0.4rem 0.7rem; border-radius:6px; font-size:0.85rem;">
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
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.8rem; border-bottom:1px solid var(--border-color); padding-bottom:0.4rem;">
            <h4 style="font-weight:700; font-size:0.95rem; color:#d97706;">
              <i class="fa-solid fa-mobile-screen-button"></i> ชื่อรุ่น (Model)
            </h4>
            <span class="badge badge-gray">${models.length} รายการ</span>
          </div>

          <div style="display:flex; flex-direction:column; gap:0.4rem; max-height:260px; overflow-y:auto; padding-right:0.2rem;">
            ${models.length === 0 ? `<div style="color:var(--text-muted); font-size:0.85rem;">ยังไม่มีรายการ</div>` : ''}
            ${models.map(m => `
              <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.02); border:1px solid var(--border-color); padding:0.4rem 0.7rem; border-radius:6px; font-size:0.85rem;">
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
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.8rem; border-bottom:1px solid var(--border-color); padding-bottom:0.4rem;">
            <h4 style="font-weight:700; font-size:0.95rem; color:#059669;">
              <i class="fa-solid fa-hard-drive"></i> ความจุ (Capacity)
            </h4>
            <span class="badge badge-gray">${capacities.length} รายการ</span>
          </div>

          <div style="display:flex; flex-direction:column; gap:0.4rem; max-height:260px; overflow-y:auto; padding-right:0.2rem;">
            ${capacities.length === 0 ? `<div style="color:var(--text-muted); font-size:0.85rem;">ยังไม่มีรายการความจุ</div>` : ''}
            ${capacities.map(cp => `
              <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.02); border:1px solid var(--border-color); padding:0.4rem 0.7rem; border-radius:6px; font-size:0.85rem;">
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
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.8rem; border-bottom:1px solid var(--border-color); padding-bottom:0.4rem;">
            <h4 style="font-weight:700; font-size:0.95rem; color:#7c3aed;">
              <i class="fa-solid fa-droplet"></i> สีสินค้า (Color)
            </h4>
            <span class="badge badge-gray">${colors.length} รายการ</span>
          </div>

          <div style="display:flex; flex-direction:column; gap:0.4rem; max-height:260px; overflow-y:auto; padding-right:0.2rem;">
            ${colors.length === 0 ? `<div style="color:var(--text-muted); font-size:0.85rem;">ยังไม่มีรายการสี</div>` : ''}
            ${colors.map(cl => `
              <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.02); border:1px solid var(--border-color); padding:0.4rem 0.7rem; border-radius:6px; font-size:0.85rem;">
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
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.8rem; border-bottom:1px solid var(--border-color); padding-bottom:0.4rem;">
            <h4 style="font-weight:700; font-size:0.95rem; color:#db2777;">
              <i class="fa-solid fa-tags"></i> หมวดหมู่สินค้า (Category)
            </h4>
            <span class="badge badge-gray">${categories.length} รายการ</span>
          </div>

          <div style="display:flex; flex-direction:column; gap:0.4rem; max-height:260px; overflow-y:auto; padding-right:0.2rem;">
            ${categories.length === 0 ? `<div style="color:var(--text-muted); font-size:0.85rem;">ยังไม่มีรายการหมวดหมู่</div>` : ''}
            ${categories.map(c => `
              <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.02); border:1px solid var(--border-color); padding:0.4rem 0.7rem; border-radius:6px; font-size:0.85rem;">
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
        <p style="font-size:0.85rem; color:var(--text-muted);">ตรวจสอบรายการนับสต็อกประจำวันจากพนักงานหน้าร้าน พร้อมการกรองสาขาและสถานะแบบเรียลไทม์</p>
      </div>
      <div style="display:flex; align-items:center; gap:0.8rem; flex-wrap:wrap;">
        <label style="font-size:0.85rem; font-weight:600; color:var(--text-muted);">เลือกวันที่:</label>
        <input type="date" id="hq-audit-date-picker" class="form-control" style="width:auto;" value="${todayStr}">
        <button class="btn btn-primary btn-sm" id="load-hq-audit-btn"><i class="fa-solid fa-rotate"></i> รีเฟรช</button>
        <button class="btn btn-secondary btn-sm" id="toggle-hq-summary-btn" onclick="toggleHqAuditSummaryTable()"><i class="fa-solid fa-eye"></i> แสดงตารางสรุปสาขา</button>
        <button class="btn btn-success btn-sm" onclick="exportBranchAuditToExcel()"><i class="fa-solid fa-file-excel"></i> Export Excel</button>
      </div>
    </div>

    <!-- Filters Toolbar -->
    <div class="card" style="margin-bottom: 1.5rem; display:flex; align-items:center; gap:1.2rem; flex-wrap:wrap; padding: 0.8rem 1.2rem;">
      <div style="display:flex; align-items:center; gap:0.5rem;">
        <label style="font-size:0.82rem; font-weight:700; color:var(--text-muted);"><i class="fa-solid fa-store"></i> กรองสาขา:</label>
        <select id="hq-audit-branch-filter" class="form-select" style="width:auto; font-size:0.82rem; padding:0.25rem 0.5rem; height:auto; min-height:auto;" onchange="filterHqAuditGrid()">
          <option value="all">-- ทุกสาขา --</option>
        </select>
      </div>
      <div style="display:flex; align-items:center; gap:0.5rem;">
        <label style="font-size:0.82rem; font-weight:700; color:var(--text-muted);"><i class="fa-solid fa-circle-check"></i> กรองสถานะ:</label>
        <select id="hq-audit-status-filter" class="form-select" style="width:auto; font-size:0.82rem; padding:0.25rem 0.5rem; height:auto; min-height:auto;" onchange="filterHqAuditGrid()">
          <option value="all">-- ทุกสถานะ --</option>
          <option value="Verified">ตรวจสอบแล้ว (Verified)</option>
          <option value="Pending Verification">รอการตรวจสอบ (Pending)</option>
          <option value="Rejected">ข้อมูลไม่ตรง/ปฏิเสธ (Rejected)</option>
          <option value="Not Submitted">ยังไม่ได้ส่งรายงาน (Not Submitted)</option>
        </select>
      </div>
    </div>

    <!-- Single card containing all branches summary table -->
    <div class="card" id="hq-audit-summary-card" style="margin-bottom: 1.5rem; padding: 0; overflow:hidden; display: none;">
      <div class="table-container" style="border:none; margin:0;">
        <table class="data-table">
          <thead>
            <tr>
              <th>สาขา</th>
              <th>สถานะการตรวจ</th>
              <th style="text-align:center;">จำนวนสินค้า</th>
              <th style="text-align:center;">จำนวนนับจริง</th>
              <th style="text-align:center;">ยอดที่ขาด/เกิน</th>
              <th>ผู้ส่งรายงาน</th>
              <th>ผู้อนุมัติ (ส่วนกลาง)</th>
              <th style="text-align:center;">การจัดการ</th>
            </tr>
          </thead>
          <tbody id="hq-audit-grid-container">
            <tr>
              <td colspan="8" style="text-align:center; color:var(--text-muted); padding:2rem;">
                <i class="fa-solid fa-spinner fa-spin" style="font-size:1.5rem; margin-right:0.4rem;"></i> กำลังโหลดข้อมูล...
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Inline Detailed Inspection Table Container -->
    <div id="hq-audit-detail-container">
      <div class="card" style="text-align: center; padding: 2.5rem 1.5rem; color: var(--text-muted);">
        <i class="fa-solid fa-hand-pointer" style="font-size: 2.5rem; margin-bottom: 0.8rem; display: block; color: var(--accent-gold);"></i>
        <h4 style="font-weight:700; color:var(--text-main); margin-bottom:0.4rem;">เลือกสาขาเพื่อดูตารางรายละเอียดสต็อก</h4>
        <p style="font-size:0.88rem;">กรุณากดปุ่ม <strong>"ตรวจสอบ"</strong> ในตารางด้านบน เพื่อแสดงตารางรายละเอียดรายเครื่องที่นี่</p>
      </div>
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
    window.latestHqAuditBranches = branches;

    // Build a unified items list for window.hqAuditInspectionState
    const allItems = [];
    branches.forEach(b => {
      const branchItems = (b.items || []).filter(item => (item.expectedCount > 0 || item.actualCount > 0));
      branchItems.forEach(item => {
        item.branchId = b.branch.id;
        item.branchName = b.branch.name;
        item.auditId = b.auditId;
        allItems.push(item);
      });
    });

    window.hqAuditInspectionState = {
      auditId: 'all',
      branchId: 'all',
      items: allItems,
      viewedPhotos: (window.hqAuditInspectionState && window.hqAuditInspectionState.viewedPhotos) || new Set(),
      verifiedImeis: new Set(),
      failedImeis: new Set(),
      resubmitImeis: new Set(),
      requiredPhotoImeis: new Set(),
      allScannedImeis: new Set()
    };

    allItems.forEach(item => {
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

    // Populate branch filter options if not already populated
    const branchFilter = document.getElementById('hq-audit-branch-filter');
    if (branchFilter && branchFilter.options.length <= 1) {
      const branchesList = res.summary.branches.map(b => b.branch);
      branchFilter.innerHTML = `<option value="all">-- ทุกสาขา --</option>` +
        branchesList.map(b => `<option value="${b.id}">${b.name}</option>`).join('');
    }

    // Now filter and render
    filterHqAuditGrid();
  } catch (err) {
    if (gridContainer) {
      gridContainer.innerHTML = `<tr><td colspan="8" style="text-align:center; color:#ef4444; padding:2rem;">เกิดข้อผิดพลาดในการโหลดแดชบอร์ดส่วนกลาง: ${err.message}</td></tr>`;
    }
  }
}

function filterHqAuditGrid() {
  const branchFilter = document.getElementById('hq-audit-branch-filter') ? document.getElementById('hq-audit-branch-filter').value : 'all';
  const statusFilter = document.getElementById('hq-audit-status-filter') ? document.getElementById('hq-audit-status-filter').value : 'all';

  const gridContainer = document.getElementById('hq-audit-grid-container');
  if (!gridContainer || !window.latestHqAuditBranches) return;

  const filtered = window.latestHqAuditBranches.filter(b => {
    const matchBranch = (branchFilter === 'all' || b.branch.id === branchFilter);
    const matchStatus = (statusFilter === 'all' || b.rawStatus === statusFilter);
    return matchBranch && matchStatus;
  });

  if (filtered.length === 0) {
    gridContainer.innerHTML = `<tr><td colspan="8" style="text-align:center; color:var(--text-muted); padding:2rem;">ไม่พบข้อมูลสาขาที่ตรงกับเงื่อนไขการกรอง</td></tr>`;
    renderHqAuditDetails();
    return;
  }

  gridContainer.innerHTML = filtered.map(b => {
    const isSelected = (branchFilter !== 'all' && b.branch.id === branchFilter);
    
    let badgeClass = 'badge-gray';
    let iconClass = 'fa-minus';
    if (b.colorCode === 'green') {
      badgeClass = 'badge-green';
      iconClass = 'fa-circle-check';
    } else if (b.colorCode === 'red') {
      badgeClass = 'badge-red';
      iconClass = 'fa-circle-exclamation';
    } else if (b.colorCode === 'yellow') {
      badgeClass = 'badge-yellow';
      iconClass = 'fa-clock';
    }

    return `
      <tr class="hq-audit-row" style="${isSelected ? 'background:rgba(99,102,241,0.05); font-weight:700;' : ''}">
        <td>
          <strong style="color:var(--text-main);">${b.branch.name}</strong><br>
          <span style="font-size:0.75rem; color:var(--text-muted);">เบอร์โทร: ${b.branch.phone}</span>
        </td>
        <td>
          <span class="badge ${badgeClass}" style="font-size:0.8rem; font-weight:700;">
            <i class="fa-solid ${iconClass}"></i> ${b.status}
          </span>
        </td>
        <td style="text-align:center;"><strong>${b.totalExpected}</strong></td>
        <td style="text-align:center;"><strong>${b.totalActual}</strong></td>
        <td style="text-align:center; font-weight:800; color:${b.totalVariance === 0 ? '#059669' : '#e11d48'};">
          ${b.totalVariance}
        </td>
        <td><span style="font-size:0.85rem;">${b.submittedBy || '-'}</span></td>
        <td><span style="font-size:0.85rem;">${b.hqVerifiedBy || '-'}</span></td>
        <td style="text-align:center; white-space:nowrap;">
          <button class="btn ${isSelected ? 'btn-primary' : 'btn-secondary'} btn-sm" style="font-weight:700; padding:0.25rem 0.6rem;" onclick="inspectBranchAudit('${b.branch.id}')">
            <i class="fa-solid ${isSelected ? 'fa-eye' : 'fa-magnifying-glass'}"></i> ${isSelected ? 'แสดงอยู่' : 'ตรวจสอบ'}
          </button>
        </td>
      </tr>
    `;
  }).join('');

  renderHqAuditDetails();
}

function filterAuditDetailTable(query) {
  const q = (query || '').toLowerCase().trim();
  const rows = document.querySelectorAll('#hq-audit-detail-table .audit-row-item');
  rows.forEach(r => {
    const text = r.getAttribute('data-search') || '';
    r.style.display = text.includes(q) ? '' : 'none';
  });
}

function inspectBranchAudit(branchId) {
  const branchFilter = document.getElementById('hq-audit-branch-filter');
  if (branchFilter) {
    if (branchFilter.value === branchId) {
      branchFilter.value = 'all';
    } else {
      branchFilter.value = branchId;
    }
    filterHqAuditGrid();
  }
}

function renderHqAuditDetails() {
  const detailContainer = document.getElementById('hq-audit-detail-container');
  if (!detailContainer || !window.latestHqAuditBranches) return;

  const branchFilter = document.getElementById('hq-audit-branch-filter') ? document.getElementById('hq-audit-branch-filter').value : 'all';
  const statusFilter = document.getElementById('hq-audit-status-filter') ? document.getElementById('hq-audit-status-filter').value : 'all';

  // Filter branches first
  const activeBranches = window.latestHqAuditBranches.filter(b => {
    const matchBranch = (branchFilter === 'all' || b.branch.id === branchFilter);
    const matchStatus = (statusFilter === 'all' || b.rawStatus === statusFilter);
    return matchBranch && matchStatus;
  });

  // Extract all unit rows from active branches
  const unitRows = [];

  activeBranches.forEach(b => {
    const items = (b.items || []).filter(item => (item.expectedCount > 0 || item.actualCount > 0));
    
    items.forEach(item => {
      const pName = item.productName || 'สินค้าไม่ระบุชื่อ';
      const expectedImeis = item.expectedImeis || [];
      const scannedImeis = item.scannedImeis || [];
      const imeiImages = item.imeiImages || [];

      const scannedSet = new Set(scannedImeis);
      const expectedSet = new Set(expectedImeis);

      if (expectedImeis.length > 0) {
        expectedImeis.forEach(imei => {
          const isScanned = scannedSet.has(imei);
          const imgObj = imeiImages.find(img => img.imei === imei);
          
          const issueObj = (item.imeiIssues || []).find(iss => iss.imei === imei && iss.hasIssue);
          const hasIssue = !!issueObj;
          const issueRemark = issueObj ? issueObj.remark : '';
          const reportedByName = issueObj ? (issueObj.reportedByName || '') : '';

          unitRows.push({
            branchId: b.branch.id,
            branchName: b.branch.name,
            productName: pName,
            expectedCount: 1,
            actualCount: isScanned ? 1 : 0,
            isScanned,
            isUnexpected: false,
            imei,
            imgObj,
            hasIssue,
            issueRemark,
            reportedByName
          });
        });
      } else {
        const expCount = item.expectedCount || 0;
        const actCount = item.actualCount || 0;
        const scannedImeiList = [...scannedImeis];

        for (let i = 0; i < Math.max(expCount, 1); i++) {
          const isScanned = i < actCount;
          const imei = scannedImeiList[i] || '-';
          const imgObj = imeiImages.find(img => img.imei === imei);
          unitRows.push({
            branchId: b.branch.id,
            branchName: b.branch.name,
            productName: pName,
            expectedCount: i < expCount ? 1 : 0,
            actualCount: isScanned ? 1 : 0,
            isScanned,
            isUnexpected: false,
            imei,
            imgObj
          });
        }
      }

      scannedImeis.forEach(imei => {
        if (expectedImeis.length > 0 && !expectedSet.has(imei)) {
          const imgObj = imeiImages.find(img => img.imei === imei);
          unitRows.push({
            branchId: b.branch.id,
            branchName: b.branch.name,
            productName: pName,
            expectedCount: 0,
            actualCount: 1,
            isScanned: true,
            isUnexpected: true,
            imei,
            imgObj
          });
        }
      });
    });
  });

  // Calculate totals for active branches
  const totalExpected = activeBranches.reduce((sum, b) => sum + (b.totalExpected || 0), 0);
  const totalActual = activeBranches.reduce((sum, b) => sum + (b.totalActual || 0), 0);
  const totalVariance = totalExpected - totalActual;

  // Calculate specific verification stats
  let totalToVerify = 0;
  let totalPassed = 0;
  let totalFailed = 0;
  let totalResubmit = 0;
  let totalPendingVerify = 0;

  unitRows.forEach(row => {
    if (row.isScanned && row.imei !== '-') {
      totalToVerify++;
      const imei = row.imei;
      const isPassed = window.hqAuditInspectionState.verifiedImeis.has(imei);
      const isFailed = window.hqAuditInspectionState.failedImeis.has(imei);
      const isResubmit = window.hqAuditInspectionState.resubmitImeis.has(imei);

      if (isPassed) {
        totalPassed++;
      } else if (isFailed) {
        totalFailed++;
      } else if (isResubmit) {
        totalResubmit++;
      } else {
        totalPendingVerify++;
      }
    }
  });

  detailContainer.innerHTML = `
    <div class="card" style="border: 1px solid var(--border-color); background: var(--bg-card); scroll-margin-top: 2rem;">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem; margin-bottom:1.2rem; padding-bottom:1rem; border-bottom:1px solid var(--border-color);">
        <div>
          <div style="display:flex; align-items:center; gap:0.8rem; flex-wrap:wrap;">
            <h3 style="font-size:1.2rem; font-weight:700; color:var(--text-main); margin:0;">
              <i class="fa-solid fa-clipboard-list" style="color:var(--accent-gold); margin-right:0.4rem;"></i>
              รายละเอียดสต็อกรายเครื่อง (${branchFilter === 'all' ? 'ทุกสาขา' : activeBranches[0] ? activeBranches[0].branch.name : '-'})
            </h3>
          </div>
          <div style="display:flex; gap:1.5rem; margin-top:0.5rem; font-size:0.88rem; color:var(--text-main); flex-wrap:wrap;">
            <div>จำนวนสินค้าทั้งหมด: <strong style="color:var(--accent-primary);">${totalExpected}</strong> ชิ้น</div>
            <div>นับได้จริง: <strong style="color:#059669;">${totalActual}</strong> ชิ้น</div>
            <div>ยอดขาด/เกิน: <strong style="color:${totalVariance === 0 ? '#059669' : '#e11d48'};">${totalVariance === 0 ? 'ตรง (0)' : totalVariance}</strong></div>
          </div>
          <div style="display:flex; gap:1.2rem; margin-top:0.6rem; font-size:0.82rem; color:var(--text-muted); flex-wrap:wrap; padding-top:0.4rem; border-top:1px dashed var(--border-color);">
            <div>สแกนส่งตรวจทั้งหมด: <strong style="color:var(--text-main);">${totalToVerify}</strong> เครื่อง</div>
            <div><i class="fa-solid fa-circle-check" style="color:#059669;"></i> ผ่าน: <strong style="color:#059669;">${totalPassed}</strong> เครื่อง</div>
            <div><i class="fa-solid fa-circle-xmark" style="color:#e11d48;"></i> ไม่ผ่าน: <strong style="color:#e11d48;">${totalFailed}</strong> เครื่อง</div>
            <div><i class="fa-solid fa-rotate-left" style="color:#d97706;"></i> ให้ส่งตรวจใหม่: <strong style="color:#d97706;">${totalResubmit}</strong> เครื่อง</div>
            <div><i class="fa-solid fa-clock" style="color:#64748b;"></i> ยังไม่ได้ตรวจ: <strong style="color:var(--text-main);">${totalPendingVerify}</strong> เครื่อง</div>
          </div>
        </div>

        <div style="display:flex; align-items:center; gap:0.8rem;">
          <input type="text" id="audit-table-search-input" class="form-control form-control-sm" placeholder="🔍 ค้นหาชื่อสินค้า หรือ IMEI..." style="width:240px; font-size:0.82rem; background:#ffffff;" onkeyup="filterAuditDetailTable(this.value)">
        </div>
      </div>

      <div class="table-container" style="margin-bottom:0.5rem; max-height:550px; overflow-y:auto; border:1px solid var(--border-color); background:#ffffff;">
        <table class="data-table" id="hq-audit-detail-table">
          <thead>
            <tr>
              <th>สาขา</th>
              <th>ชื่อสินค้า</th>
              <th>หมายเลข IMEI</th>
              <th>ผลการตรวจสอบรูปถ่าย & ลงความเห็น</th>
            </tr>
          </thead>
          <tbody>
            ${unitRows.length === 0 ? `<tr><td colspan="4" style="text-align:center; color:var(--text-muted); padding:2rem;">ไม่พบรายการสินค้า</td></tr>` : ''}
            ${unitRows.map(row => {
              const imei = row.imei;
              const isPassed = window.hqAuditInspectionState.verifiedImeis.has(imei);
              const isFailed = window.hqAuditInspectionState.failedImeis.has(imei);
              const isResubmit = window.hqAuditInspectionState.resubmitImeis.has(imei);

              return `
                <tr class="audit-row-item" data-search="${(row.productName + ' ' + imei + ' ' + row.branchName).toLowerCase()}">
                  <td>
                    <span class="badge badge-gray" style="font-weight:700;">${row.branchName}</span>
                  </td>
                  <td>
                    <strong style="color:var(--accent-primary);">${row.productName}</strong>
                    ${row.hasIssue ? `<div style="font-size:0.75rem; color:#d97706; font-weight:700; margin-top:0.2rem;"><i class="fa-solid fa-comment-dots"></i> หมายเหตุ: ${row.issueRemark} <span style="color:var(--text-muted); font-weight:normal; margin-left:0.3rem;">(แจ้งโดย: ${row.reportedByName || 'พนักงานสาขา'})</span></div>` : ''}
                  </td>
                  <td style="font-size:0.9rem;">
                    ${row.isScanned && imei !== '-' ? `
                      <span style="font-family:monospace; font-weight:700; color:#d97706; font-size:0.95rem;">${imei}</span>
                      ${row.isUnexpected ? '<span style="color:#d97706; font-size:0.75rem; margin-left:0.4rem;">(สแกนเกิน)</span>' : ''}
                    ` : imei !== '-' && imei !== 'ไม่มี IMEI' ? `
                      <span style="font-family:monospace; font-weight:700; color:#e11d48; font-size:0.92rem;">${imei}</span>
                      ${row.hasIssue ? `
                        <span class="badge badge-yellow" style="background:#f59e0b; color:#fff; font-size:0.72rem; padding:0.15rem 0.35rem; margin-left:0.4rem; border:none;"><i class="fa-solid fa-triangle-exclamation"></i> แจ้งปัญหา</span>
                      ` : `
                        <span style="color:#e11d48; font-style:italic; font-size:0.8rem; margin-left:0.3rem;">(รอฝ่ายขายตรวจ)</span>
                      `}
                    ` : '<span style="color:var(--text-muted); font-style:italic;">รอฝ่ายขายตรวจ</span>'}
                  </td>
                  <td style="font-size:0.85rem;">
                    ${(row.isScanned || row.hasIssue) && imei !== '-' ? `
                      <div style="display:flex; align-items:center; justify-content:space-between; gap:0.6rem; flex-wrap:wrap;">
                        <div>
                          ${isPassed ? '<span class="badge badge-green" style="font-size:0.75rem;"><i class="fa-solid fa-circle-check"></i> ผ่าน</span>' :
                            isFailed ? '<span class="badge badge-red" style="font-size:0.75rem;"><i class="fa-solid fa-circle-xmark"></i> ไม่ผ่าน</span>' :
                            isResubmit ? '<span class="badge badge-yellow" style="font-size:0.75rem;"><i class="fa-solid fa-rotate-left"></i> ให้ส่งตรวจใหม่</span>' :
                            '<span class="badge badge-gray" style="font-size:0.75rem;"> ยังไม่ได้ตรวจ</span>'}
                        </div>

                        <button class="btn btn-sm btn-primary" onclick="openImeiInspectionModal('${imei}', '${row.branchId}')" style="font-size:0.75rem; padding:0.3rem 0.65rem;">
                          <i class="fa-solid fa-magnifying-glass"></i> ตรวจสอบรูป & ลงความเห็น
                        </button>
                      </div>
                    ` : '<span style="color:var(--text-muted); font-style:italic;">-</span>'}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function toggleHqAuditSummaryTable() {
  const card = document.getElementById('hq-audit-summary-card');
  const btn = document.getElementById('toggle-hq-summary-btn');
  if (card && btn) {
    const isHidden = card.style.display === 'none';
    if (isHidden) {
      card.style.display = 'block';
      btn.innerHTML = '<i class="fa-solid fa-eye-slash"></i> ซ่อนตารางสรุปสาขา';
      btn.className = 'btn btn-secondary btn-sm';
    } else {
      card.style.display = 'none';
      btn.innerHTML = '<i class="fa-solid fa-eye"></i> แสดงตารางสรุปสาขา';
      btn.className = 'btn btn-primary btn-sm';
    }
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
    else imgObj = imgObj.url || imgObj.imageUrl || imgObj.webViewLink || imgObj.webContentLink || '';
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

function openImeiInspectionModal(imei, branchId) {
  if (window.hqAuditInspectionState) {
    window.hqAuditInspectionState.viewedPhotos.add(imei);
  }

  // Storing specific branchId for decisions to prevent "all" casting error
  window.currentInspectedBranchId = branchId;
  window.currentInspectedAuditId = branchId;

  let productName = 'สินค้าในสต็อก';
  let imgObj = null;
  let hasIssue = false;
  let issueRemark = '';
  let reportedByName = '';

  if (window.hqAuditInspectionState && window.hqAuditInspectionState.items) {
    const matchedItem = window.hqAuditInspectionState.items.find(i => (i.scannedImeis && i.scannedImeis.includes(imei)) || (i.expectedImeis && i.expectedImeis.includes(imei)));
    if (matchedItem) {
      productName = matchedItem.productName;
      imgObj = (matchedItem.imeiImages || []).find(img => img.imei === imei);
      
      const issueObj = (matchedItem.imeiIssues || []).find(iss => iss.imei === imei && iss.hasIssue);
      if (issueObj) {
        hasIssue = true;
        issueRemark = issueObj.remark || '';
        reportedByName = issueObj.reportedByName || '';
      }
    }
  }

  const imgUrl = resolveDriveImageUrl(imgObj);

  let fileId = '';
  if (imgObj && imgObj.fileId) {
    fileId = imgObj.fileId;
  } else if (imgUrl) {
    // Parse Google Drive ID using robust split parsing (prevents slash escaping syntax errors)
    const urlStr = String(imgUrl);
    const parts = urlStr.split('/');
    const diIndex = parts.indexOf('drive-image');
    if (diIndex !== -1 && parts[diIndex + 1]) {
      fileId = parts[diIndex + 1].split('?')[0];
    } else {
      const dIndex = parts.indexOf('d');
      if (dIndex !== -1 && parts[dIndex + 1]) {
        fileId = parts[dIndex + 1].split('?')[0];
      } else {
        const queryParams = urlStr.split('?')[1];
        if (queryParams) {
          const idParam = queryParams.split('&').find(p => p.startsWith('id='));
          if (idParam) {
            fileId = idParam.split('=')[1];
          }
        }
      }
    }
  }

  const targetDriveUrl = fileId ? `https://drive.google.com/file/d/${fileId}/view` : (imgObj ? imgObj.webViewLink || imgUrl : imgUrl);

  const bodyHtml = `
    <div style="background:rgba(0,0,0,0.03); border:1px solid var(--border-color); padding:1rem; border-radius:6px; margin-bottom:1.2rem; text-align:center;">
      <div style="font-weight:800; font-size:1.15rem; color:var(--accent-primary); margin-bottom:0.2rem;">
        <i class="fa-solid fa-barcode"></i> หมายเลข IMEI / ซีเรียล: <span style="color:#d97706; font-family:monospace;">${imei}</span>
      </div>
      <div style="font-size:0.88rem; color:var(--text-main);">
        สินค้า: <strong>${productName || 'สินค้าในสต็อก'}</strong> (IMEI: ${imei})
      </div>
    </div>

    ${hasIssue ? `
      <div style="background:rgba(217,119,6,0.08); border:1.5px solid #d97706; padding:0.9rem; border-radius:8px; margin-bottom:1.2rem; display:flex; gap:0.6rem; align-items:flex-start; text-align:left; font-family:'Sarabun';">
        <div style="font-size:1.4rem; color:#d97706; margin-top:0.15rem;"><i class="fa-solid fa-triangle-exclamation"></i></div>
        <div>
          <strong style="color:#d97706; font-size:0.92rem; display:block;">แจ้งปัญหาจากพนักงานหน้าร้าน:</strong>
          <span style="font-size:0.88rem; color:var(--text-main); line-height:1.5; margin-top:0.2rem; display:block;">${issueRemark || 'ไม่ได้ระบุหมายเหตุ'}</span>
          <span style="font-size:0.78rem; color:var(--text-muted); display:block; margin-top:0.4rem; font-weight:700;"><i class="fa-solid fa-user"></i> ผู้แจ้ง: ${reportedByName || 'พนักงานสาขา'}</span>
        </div>
      </div>
    ` : ''}

    <!-- Center Photo Display -->
    <div style="text-align:center; background:rgba(0,0,0,0.015); padding:1.2rem; border-radius:8px; margin-bottom:1.5rem; border:1px solid var(--border-color); display:flex; justify-content:center; align-items:center; min-height:240px;">
      ${imgUrl ? `
        <div style="width:100%; text-align:center;">
          <div style="position:relative; display:inline-block; cursor:pointer;" onclick="window.open('${targetDriveUrl.replace(/'/g, "\\'")}', '_blank')" title="แตะเพื่อเปิดดูลิงก์รูปภาพเต็มใน Google Drive (แท็บใหม่)">
            <img src="${imgUrl}" style="max-height:360px; max-width:100%; border-radius:8px; border:2px solid var(--accent-gold); box-shadow:0 6px 20px rgba(0,0,0,0.15); transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'" onerror="this.onerror=null; ${fileId ? `this.src='https://drive.google.com/thumbnail?id=${fileId}&sz=w1000';` : `document.getElementById('no-img-text-${imei}').style.display='block';`}">
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
    <div style="font-weight:800; font-size:0.95rem; color:var(--text-main); margin-bottom:0.8rem; text-align:center;">
      เลือกลงความเห็นผลการตรวจสอบสำหรับเครื่องนี้:
    </div>

    <div class="grid-3col" style="gap:0.8rem;">
      <button class="btn btn-warning" style="padding:0.8rem 0.4rem; font-size:0.85rem; font-weight:700; color:#000;" onclick="setItemDecision('${imei}', 'resubmit')">
        <i class="fa-solid fa-rotate-left"></i>  ให้ตรวจสอบใหม่
      </button>
      <button class="btn btn-danger" style="padding:0.8rem 0.4rem; font-size:0.85rem; font-weight:700;" onclick="setItemDecision('${imei}', 'failed')">
        <i class="fa-solid fa-circle-xmark"></i> ข้อมูลไม่ผ่าน
      </button>
      <button class="btn btn-success" style="padding:0.8rem 0.4rem; font-size:0.85rem; font-weight:700;" onclick="setItemDecision('${imei}', 'passed')">
        <i class="fa-solid fa-circle-check"></i> ยืนยันว่าถูกต้อง
      </button>
    </div>
  `;

  openModal(`ตรวจสอบสินค้า & รูปถ่าย IMEI: ${imei}`, bodyHtml, `<button class="btn btn-secondary" onclick="closeModal()">ย้อนกลับ</button>`);
}

async function setItemDecision(imei, decision) {
  if (!window.hqAuditInspectionState) return;

  const todayStr = document.getElementById('hq-audit-date-picker') ? document.getElementById('hq-audit-date-picker').value : new Date().toISOString().split('T')[0];
  
  let branchId = window.currentInspectedBranchId;
  if (!branchId || branchId === 'all') {
    branchId = window.hqAuditInspectionState.branchId;
  }
  
  // Fallback to match item in collection
  if (!branchId || branchId === 'all') {
    if (window.hqAuditInspectionState.items) {
      const matched = window.hqAuditInspectionState.items.find(i => 
        (i.scannedImeis && i.scannedImeis.includes(imei)) || 
        (i.expectedImeis && i.expectedImeis.includes(imei))
      );
      if (matched && matched.branchId) {
        branchId = matched.branchId;
      }
    }
  }

  if (!branchId || branchId === 'all') {
    showToast('ไม่สามารถระบุสาขาสำหรับสินค้าชิ้นนี้ได้', 'error');
    return;
  }

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

  closeModal();
  filterHqAuditGrid();
}

/* ==========================================================================
   VIEW 3: BRANCH DAILY STOCK CHECK
   ========================================================================== */
async function renderBranchAuditView() {
  const container = document.getElementById('content-container');
  container.innerHTML = `<div style="padding: 2rem; text-align: center; color: var(--text-muted);"><i class="fa-solid fa-spinner fa-spin" style="font-size:2rem;"></i> กำลังดึงรายการสินค้าคงคลังสาขา...</div>`;

  try {
    await loadMasterOptions();

    const isHqUser = !state.user.branch || state.user.branch.code === 'BR-HQ01' || (state.user.branch.name && state.user.branch.name.includes('สำนักงานใหญ่'));

    if (isHqUser && !state.selectedBranchAuditId) {
      state.selectedBranchAuditId = 'all';
    }

    const selectedBranchId = isHqUser ? state.selectedBranchAuditId : (state.user.branch ? state.user.branch._id : (state.masterOptions.branches && state.masterOptions.branches[0] ? state.masterOptions.branches[0]._id : null));

    const res = await apiRequest(`/audit/expected?branchId=${selectedBranchId}`);
    state.expectedStockCache = (res.items || []).filter(item => item.expectedCount > 0);

    const todayStr = new Date().toISOString().split('T')[0];

    let branchSelectorHtml = '';
    if (isHqUser) {
      const branches = state.masterOptions.branches || [];
      branchSelectorHtml = `
        <div style="display:flex; align-items:center; gap:0.5rem;">
          <label style="font-size:0.85rem; font-weight:600; color:var(--text-muted); white-space:nowrap;"><i class="fa-solid fa-store"></i> สาขา:</label>
          <select id="branch-audit-selector" class="form-select" style="width:auto; font-weight:700; color:var(--accent-primary); background:#ffffff; border:1.5px solid var(--border-color);" onchange="changeBranchAuditSelector()">
            <option value="all" ${selectedBranchId === 'all' ? 'selected' : ''}>ทุกสาขา (ทั้งหมด)</option>
            ${branches.map(b => `<option value="${b._id}" ${selectedBranchId === b._id ? 'selected' : ''}>${b.name}</option>`).join('')}
          </select>
        </div>
      `;
    }

    container.innerHTML = `
      <div class="card" style="margin-bottom: 1.5rem;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem;">
          <div>
            <h3 style="font-size:1.1rem; font-weight:700;">แบบฟอร์ม นับสต็อกประจำวัน</h3>
            <p style="font-size:0.85rem; color:var(--text-muted);">สแกนบาร์โค้ด IMEI/ซีเรียล หรือพิมพ์เพื่อตรวจนับสินค้า ระบบจะคำนวณ ยอดที่ขาด/เกิน ให้อัตโนมัติ</p>
          </div>
          <div style="display:flex; align-items:center; gap:0.8rem; flex-wrap:wrap;">
            ${branchSelectorHtml}
          </div>
        </div>

        <div style="margin-top: 1.2rem; background: rgba(99,102,241,0.06); border:1px solid var(--border-glow); padding:1rem; border-radius:var(--radius-md); display:flex; gap:1rem; align-items:center; flex-wrap:wrap;">
          ${selectedBranchId === 'all' ? `
            <div style="font-size:0.9rem; font-weight:700; color:#d97706; display:flex; align-items:center; gap:0.5rem; width:100%;">
              <i class="fa-solid fa-circle-info" style="font-size:1.1rem;"></i> 
              <span>กำลังเปิดดูสต็อกทุกสาขารวมกัน (โหมดอ่านอย่างเดียว) หากต้องการตรวจนับ/สแกนสินค้า กรุณาเลือกสาขาที่เจาะจงด้านบน</span>
            </div>
          ` : `
            <div style="flex:1; min-width:260px;">
              <label style="font-size:0.78rem; font-weight:700; color:var(--accent-secondary);">ช่องสแกนบาร์โค้ดรวดเร็ว (สแกน IMEI/ซีเรียลที่นี่)</label>
              <div style="display:flex; gap:0.5rem; margin-top:0.3rem;">
                <input type="text" id="barcode-scanner-input" class="form-control" placeholder="สแกน หรือ พิมพ์หมายเลข IMEI/ซีเรียล..." style="margin:0;" autofocus>
                <button class="btn btn-primary" id="btn-submit-scan-imei" style="padding:0 1.2rem; font-weight:700; font-size:0.85rem; white-space:nowrap; display:flex; align-items:center; gap:0.4rem;">
                  <i class="fa-solid fa-barcode"></i> ตรวจนับ
                </button>
              </div>
            </div>
          `}
        </div>
      </div>

      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>ชื่อสินค้า</th>
              ${selectedBranchId === 'all' ? '<th>สาขา</th>' : ''}
              <th>หมายเลข IMEI</th>
              <th>จำนวนสินค้า</th>
              <th>จำนวนนับได้จริง</th>
              <th>ยอดที่ขาด/เกิน</th>
              <th style="text-align:center;">รูปภาพที่แนบ</th>
            </tr>
          </thead>
          <tbody id="branch-audit-table-body">
            ${state.expectedStockCache.length === 0 ? `<tr><td colspan="${selectedBranchId === 'all' ? 7 : 6}" style="text-align:center; color:var(--text-muted);">ไม่พบรายการสินค้าในสต็อกสาขานี้</td></tr>` : ''}
            ${state.expectedStockCache.map((item, idx) => {
              const scannedImeis = item.scannedImeis || [];
              const actual = scannedImeis.length;
              const diff = actual - item.expectedCount;
              const isScanned = item.isScanned || actual > 0;
              const photoBtn = item.photoUrl ? `
                <button class="btn btn-secondary btn-sm" onclick="viewAuditPhoto('${item.photoUrl}')">
                  <i class="fa-solid fa-image"></i>
                </button>
              ` : `<span style="color:var(--text-muted); font-size:0.8rem;">- ไม่มีรูปภาพ -</span>`;

              return `
                <tr id="audit-row-${idx}">
                  <td>
                    <strong style="color:var(--accent-primary);">${item.productName}</strong>
                    ${item.hasIssue ? `<div style="font-size:0.75rem; color:#ef4444; font-weight:700; margin-top:0.25rem;"><i class="fa-solid fa-triangle-exclamation"></i> แจ้งปัญหา: ${item.issueRemark}</div>` : ''}
                  </td>
                  ${selectedBranchId === 'all' ? `<td><span class="badge badge-gray" style="font-weight:700;">${item.branchName || '-'}</span></td>` : ''}
                  <td>
                    <strong style="color:#d97706; font-family:monospace; font-size:0.95rem; display:block; margin-bottom:0.2rem;">${item.imei}</strong>
                    ${(!isScanned && selectedBranchId !== 'all') ? `
                      ${item.hasIssue ? `
                        <button class="btn btn-secondary btn-sm" style="font-size:0.7rem; padding:0.15rem 0.35rem; font-weight:700;" onclick="openReportIssueModal('${item.imei}', ${idx})">
                          <i class="fa-solid fa-pen"></i> แก้ไขหมายเหตุ
                        </button>
                      ` : `
                        <button class="btn btn-warning btn-sm" style="font-size:0.7rem; padding:0.15rem 0.35rem; font-weight:700; background:#d97706; border:none; color:#fff;" onclick="openReportIssueModal('${item.imei}', ${idx})">
                          <i class="fa-solid fa-triangle-exclamation"></i> แจ้งปัญหา
                        </button>
                      `}
                    ` : ''}
                  </td>
                  <td><strong class="expected-val" id="expected-${idx}">${item.expectedCount}</strong></td>
                  <td style="text-align:center; vertical-align:middle;">
                    <span id="actual-val-${idx}" style="font-size:1.25rem; font-weight:800; color:var(--text-main);">${actual}</span>
                  </td>
                  <td id="variance-status-${idx}">
                    ${(diff === 0 || item.hasIssue) ? `<span class="badge badge-green">สำเร็จ</span>` :
                      diff < 0 ? `<span class="badge badge-yellow">รอดำเนินการ</span>` :
                      `<span class="badge badge-red">ยอดเกิน</span>`}
                  </td>
                  <td id="photo-cell-${idx}" style="text-align:center; vertical-align:middle;">
                    ${photoBtn}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;

    const scannerInput = document.getElementById('barcode-scanner-input');
    const scanBtn = document.getElementById('btn-submit-scan-imei');

    const runScan = () => {
      if (scannerInput) {
        const scannedVal = scannerInput.value.trim();
        if (scannedVal) {
          processScannedSerial(scannedVal);
          scannerInput.value = '';
          setTimeout(() => scannerInput.focus(), 10);
        }
      }
    };

    if (scannerInput) {
      setTimeout(() => scannerInput.focus(), 100);
      scannerInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          runScan();
        }
      });
    }

    if (scanBtn) {
      scanBtn.onclick = (e) => {
        e.preventDefault();
        runScan();
      };
    }
  } catch (err) {
    container.innerHTML = `<div style="color:#ef4444; padding:2rem;">เกิดข้อผิดพลาดในการโหลดรายการสต็อก: ${err.message}</div>`;
  }
}

function changeBranchAuditSelector() {
  const selector = document.getElementById('branch-audit-selector');
  if (selector) {
    state.selectedBranchAuditId = selector.value;
    renderBranchAuditView();
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

  if (diff === 0 || item.hasIssue) {
    statusTd.innerHTML = `<span class="badge badge-green">สำเร็จ</span>`;
  } else if (diff < 0) {
    statusTd.innerHTML = `<span class="badge badge-yellow">รอดำเนินการ</span>`;
  } else {
    statusTd.innerHTML = `<span class="badge badge-red">ยอดเกิน</span>`;
  }

  // Update photo cell dynamically
  const photoCell = document.getElementById(`photo-cell-${idx}`);
  if (photoCell) {
    photoCell.innerHTML = item.photoUrl ? `
      <button class="btn btn-secondary btn-sm" onclick="viewAuditPhoto('${item.photoUrl}')">
        <i class="fa-solid fa-image"></i> ดูรูปภาพ
      </button>
    ` : `<span style="color:var(--text-muted); font-size:0.8rem;">- ไม่มีรูปภาพ -</span>`;
  }
}

function openReportIssueModal(imei, idx) {
  const item = state.expectedStockCache[idx];
  const auditDate = document.getElementById('branch-audit-date') ? document.getElementById('branch-audit-date').value : new Date().toISOString().split('T')[0];
  const currentRemark = item.issueRemark || '';

  const bodyHtml = `
    <div style="background:rgba(217,119,6,0.06); border:1px solid rgba(217,119,6,0.2); padding:1rem; border-radius:8px; margin-bottom:1.2rem;">
      <div style="font-weight:800; font-size:1.05rem; color:#d97706; margin-bottom:0.3rem;">
        <i class="fa-solid fa-triangle-exclamation"></i> แจ้งปัญหาไม่สามารถตรวจนับเครื่องได้
      </div>
      <div style="font-size:0.9rem; font-weight:700; color:var(--text-main); margin-top:0.4rem;">
        สินค้า: ${item ? item.productName : 'สินค้าคงคลัง'}
      </div>
      <div style="font-size:0.83rem; font-family:monospace; color:var(--text-muted); margin-top:0.2rem;">
        IMEI: ${imei}
      </div>
    </div>

    <form id="report-issue-form" onsubmit="event.preventDefault(); submitReportIssue('${imei}', ${idx});">
      <div class="form-group">
        <label for="issue-remark-input" style="font-size:0.85rem; font-weight:700; color:var(--text-main);">
          กรุณากรอกหมายเหตุ / รายละเอียดของปัญหา <span style="color:#ef4444;">*</span>
        </label>
        <textarea id="issue-remark-input" class="form-control" rows="4" placeholder="ระบุเหตุผล เช่น เครื่องเปิดไม่ติด, ส่งซ่อมบอร์ด, ลูกค้ายืมเครื่องทดสอบ, ป้ายบาร์โค้ดขาด ฯลฯ" required style="font-size:0.88rem; margin-top:0.4rem; font-family:'Sarabun'; color:var(--text-main); background:#fff;">${currentRemark}</textarea>
      </div>
    </form>
  `;

  const footerHtml = `
    <button class="btn btn-secondary" onclick="closeModal()">ยกเลิก</button>
    <button class="btn btn-warning" onclick="submitReportIssue('${imei}', ${idx})" style="background:#d97706; border:none; color:#fff; font-weight:700;">
      <i class="fa-solid fa-paper-plane"></i> ยืนยันแจ้งปัญหา
    </button>
  `;

  openModal(`แจ้งปัญหาสินค้า IMEI: ${imei}`, bodyHtml, footerHtml);
  
  setTimeout(() => {
    const txtArea = document.getElementById('issue-remark-input');
    if (txtArea) {
      txtArea.focus();
      txtArea.select();
    }
  }, 150);
}

async function submitReportIssue(imei, idx) {
  const remarkInput = document.getElementById('issue-remark-input');
  if (!remarkInput || !remarkInput.value.trim()) {
    showToast('กรุณากรอกหมายเหตุ/รายละเอียดของปัญหาก่อนกดยืนยัน', 'error');
    return;
  }

  const remark = remarkInput.value.trim();
  const auditDate = document.getElementById('branch-audit-date') ? document.getElementById('branch-audit-date').value : new Date().toISOString().split('T')[0];
  
  const isHqUser = !state.user.branch || state.user.branch.code === 'BR-HQ01' || (state.user.branch.name && state.user.branch.name.includes('สำนักงานใหญ่'));
  const branchId = isHqUser ? state.selectedBranchAuditId : (state.user.branch ? state.user.branch._id : null);

  if (!branchId || branchId === 'all') {
    showToast('กรุณาเลือกสาขาที่ต้องการดำเนินการ', 'error');
    return;
  }

  try {
    const res = await apiRequest('/audit/report-issue', 'POST', {
      auditDate,
      branchId,
      imei,
      remark
    });

    if (res.success) {
      showToast(res.message || 'บันทึกรายงานแจ้งปัญหาเรียบร้อยแล้ว');
      
      // Update local state cache
      const item = state.expectedStockCache[idx];
      if (item) {
        item.hasIssue = true;
        item.issueRemark = remark;
        
        // Add to imeiIssues inside expectedStockCache
        item.imeiIssues = item.imeiIssues || [];
        const existingIdx = item.imeiIssues.findIndex(i => i.imei === imei);
        if (existingIdx >= 0) {
          item.imeiIssues[existingIdx].hasIssue = true;
          item.imeiIssues[existingIdx].remark = remark;
        } else {
          item.imeiIssues.push({ imei, hasIssue: true, remark });
        }
      }

      closeModal();
      
      // Update UI row dynamically
      updateRowVariance(idx);
      
      // Submit form silently to sync all audit items with backend
      await submitBranchAuditFormSilent();
      
      // Re-fetch or refresh current view to guarantee sync
      renderBranchAuditView();
    }
  } catch (err) {
    // Handled
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
    <div style="background:rgba(0,0,0,0.03); border:1px solid var(--border-color); padding:1rem; border-radius:6px; margin-bottom:1.2rem;">
      <div style="font-weight:800; font-size:1.1rem; color:var(--accent-primary); margin-bottom:0.3rem;">
        <i class="fa-solid fa-barcode"></i> IMEI : <span style="color:#d97706;">${serial}</span>
      </div>
      <div style="font-size:0.9rem; font-weight:700; color:var(--text-main);">
        สินค้า: ${item ? item.productName : 'สินค้าในสต็อก'} (IMEI: ${serial})
      </div>
      <div style="font-size:0.78rem; color:var(--text-muted); margin-top:0.4rem; line-height:1.4;">
        <strong style="color:var(--accent-primary);">เช็คสต็อกประจำวันที่ ${auditDate}</strong>
      </div>
    </div>

    <form id="upload-imei-form" style="text-align:center; padding:0.5rem 0;">
      <div class="form-group" style="margin-bottom:0;">
        <!-- Hidden raw file input -->
        <input type="file" id="imei-photo-file" accept="image/*" capture="environment" onchange="previewImeiPhoto(this)" required style="display:none;">
        
        <!-- Premium Camera Upload Trigger Card -->
        <label for="imei-photo-file" style="display:flex; flex-direction:column; align-items:center; justify-content:center; gap:0.8rem; padding:2rem 1.5rem; border:2px dashed rgba(99,102,241,0.4); border-radius:12px; background:rgba(99,102,241,0.03); cursor:pointer; transition:all 0.25s ease; max-width:340px; margin:0 auto;" 
               onmouseover="this.style.borderColor='#6366f1'; this.style.background='rgba(99,102,241,0.08)'; this.style.boxShadow='0 0 20px rgba(99,102,241,0.25)';"
               onmouseout="this.style.borderColor='rgba(99,102,241,0.4)'; this.style.background='rgba(99,102,241,0.03)'; this.style.boxShadow='none';">
          <div style="width:54px; height:54px; border-radius:50%; background:linear-gradient(135deg, #6366f1, #06b6d4); display:flex; align-items:center; justify-content:center; color:#fff; box-shadow:0 4px 15px rgba(99,102,241,0.4);">
            <i class="fa-solid fa-camera" style="font-size:1.5rem;"></i>
          </div>
          <div style="font-size:1rem; font-weight:800; color:var(--text-main); margin-top:0.2rem;">เปิดกล้องถ่ายภาพ / เลือกรูปภาพ</div>
          <div style="font-size:0.75rem; color:var(--text-muted); line-height:1.4;">แตะเพื่อแนบรูปถ่ายตัวเครื่องหรือป้าย IMEI</div>
        </label>
      </div>

      <div id="imei-photo-preview-container" style="display:none; text-align:center; margin-top:1.5rem; background:rgba(0,0,0,0.025); padding:0.8rem; border-radius:8px; border:1px dashed var(--border-color);">
        <div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:0.5rem; font-weight:600;">— ตัวอย่างรูปถ่ายที่เลือก —</div>
        <img id="imei-photo-preview" src="" style="max-height:240px; max-width:100%; border-radius:6px; border:2px solid #059669; box-shadow:0 4px 15px rgba(0,0,0,0.15);">
      </div>
    </form>
  `;

  const footerHtml = `
    <button class="btn btn-success" id="btn-upload-drive-confirm" onclick="submitImeiPhotoAndConfirm('${serial}', ${matchedIdx})">
      บันทึก
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

// Client-side image compression using HTML5 Canvas
function compressImage(file, maxWidth, maxHeight, quality) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Calculate new dimensions maintaining aspect ratio
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob((blob) => {
          if (blob) {
            const compressedFile = new File([blob], file.name, {
              type: file.type || 'image/jpeg',
              lastModified: Date.now()
            });
            resolve(compressedFile);
          } else {
            reject(new Error('Canvas toBlob failed'));
          }
        }, file.type || 'image/jpeg', quality);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
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
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> กำลังบีบอัดรูปภาพ...`;
  }

  const rawFile = fileInput.files[0];
  let uploadFile = rawFile;

  if (rawFile.type && rawFile.type.startsWith('image/')) {
    try {
      uploadFile = await compressImage(rawFile, 1000, 1000, 0.75);
    } catch (compressErr) {
      console.warn('Image compression failed, using raw image:', compressErr);
    }
  }

  if (btn) {
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> กำลังอัปโหลดลง Google Drive...`;
  }

  const auditDate = document.getElementById('branch-audit-date') ? document.getElementById('branch-audit-date').value : new Date().toISOString().split('T')[0];

  const formData = new FormData();
  formData.append('image', uploadFile);
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

    // Save photoUrl to item cache so it renders immediately
    item.photoUrl = res.fileId ? `/api/audit/drive-image/${res.fileId}` : res.url;

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
  
  const isHqUser = !state.user.branch || state.user.branch.code === 'BR-HQ01' || (state.user.branch.name && state.user.branch.name.includes('สำนักงานใหญ่'));
  const userBranchId = isHqUser && state.selectedBranchAuditId && state.selectedBranchAuditId !== 'all'
    ? state.selectedBranchAuditId
    : (state.user.branch ? state.user.branch._id : (state.masterOptions.branches && state.masterOptions.branches[0] ? state.masterOptions.branches[0]._id : null));

  const scannedItems = state.expectedStockCache.map((item) => {
    const scannedImeis = item.scannedImeis || [];
    const actualCount = scannedImeis.length;
    const imeiImages = item.imeiImages || [];
    const imeiIssues = item.imeiIssues || [];

    return {
      product: item.product,
      productName: item.productName,
      actualCount,
      scannedImeis,
      imeiImages,
      imeiIssues
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
async function renderBranchPurchaseOrdersView(selectedBranchId = null, shouldScroll = false) {
  const container = document.getElementById('content-container');
  container.innerHTML = `<div style="padding: 2rem; text-align: center; color: var(--text-muted);"><i class="fa-solid fa-spinner fa-spin" style="font-size:2rem;"></i> กำลังโหลดรายการสั่งซื้อสินค้าลงสาขาและแดชบอร์ดฝ่ายจัดซื้อ...</div>`;

  try {
    await loadMasterOptions();
    const isHqOrAdmin = ['admin', 'hq_stock_staff', 'purchase_staff'].includes(state.user ? (state.user ? state.user.role : 'admin') : '');
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
      ${branches.length > 0 ? `
        <!-- Branch Purchasing Overview Cards Grid -->
        <div style="margin-bottom:2rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; flex-wrap:wrap; gap:0.5rem;">
            <div>
              <h3 style="font-size:1.15rem; font-weight:800; color:var(--text-main); display:flex; align-items:center; gap:0.5rem;">
                <i class="fa-solid fa-store" style="color:var(--accent-gold);"></i> ข้อมูลสรุปรายสาขาสำหรับฝ่ายจัดซื้อ
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
                <div class="card" style="background:#ffffff; border:${isSelected ? '2px solid var(--accent-gold)' : '1px solid var(--border-color)'}; border-radius:10px; padding:1.2rem; display:flex; flex-direction:column; justify-content:space-between; box-shadow:${isSelected ? '0 0 15px rgba(251,191,36,0.1)' : 'none'};">
                  <div>
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.8rem;">
                      <div>
                        <strong style="font-size:1.1rem; color:var(--text-main); font-weight:800; display:block;">${b.name}</strong>
                        <span style="font-size:0.78rem; color:var(--text-muted); font-family:monospace;">รหัสสาขา: ${b.code || '-'}</span>
                      </div>
                      <span class="badge badge-${bRem > 0 ? 'green' : 'red'}" style="font-size:0.75rem;">
                        <i class="fa-solid fa-${bRem > 0 ? 'circle-check' : 'ban'}"></i> ${bRem > 0 ? 'พร้อมสั่งซื้อ' : 'วงเงินเต็ม'}
                      </span>
                    </div>

                    <!-- Credit Limit Bar -->
                    <div style="background:rgba(0,0,0,0.035); border-radius:8px; padding:0.8rem; margin-bottom:1rem; border:1px solid var(--border-color);">
                      <div style="display:flex; justify-content:space-between; font-size:0.78rem; margin-bottom:0.3rem;">
                        <span style="color:var(--text-muted);">ใช้วงเงินไปแล้ว:</span>
                        <strong style="color:${bPct >= 90 ? '#e11d48' : '#059669'};">${bPct}%</strong>
                      </div>
                      <div style="width:100%; background:rgba(0,0,0,0.08); height:8px; border-radius:4px; overflow:hidden; margin-bottom:0.6rem;">
                        <div style="width:${bPct}%; background:${bPct >= 90 ? '#e11d48' : bPct >= 70 ? '#d97706' : '#10b981'}; height:100%; border-radius:4px;"></div>
                      </div>
                      <div class="grid-3col" style="gap:0.4rem; font-size:0.75rem; text-align:center;">
                        <div>
                          <div style="color:var(--text-muted); font-size:0.7rem;">วงเงินอนุมัติ</div>
                          <div style="font-weight:700; color:var(--accent-primary);">฿${bLimit.toLocaleString()}</div>
                        </div>
                        <div>
                          <div style="color:var(--text-muted); font-size:0.7rem;">ใช้ไปแล้ว</div>
                          <div style="font-weight:700; color:#d97706;">฿${bUsed.toLocaleString()}</div>
                        </div>
                        <div>
                          <div style="color:var(--text-muted); font-size:0.7rem;">สั่งซื้อได้อีก</div>
                          <div style="font-weight:700; color:#059669;">฿${bRem.toLocaleString()}</div>
                        </div>
                      </div>
                    </div>

                    <!-- Key Purchasing & Inventory Metrics -->
                    <div class="grid-2col" style="gap:0.6rem; margin-bottom:1rem; font-size:0.8rem;">
                      <div style="background:rgba(0,0,0,0.02); padding:0.6rem; border-radius:6px; border:1px solid var(--border-color);">
                        <div style="color:var(--text-muted); font-size:0.73rem;">📦 สต็อกพร้อมขายในสาขา</div>
                        <div style="display:flex; align-items:center; gap:0.4rem; margin-top:0.2rem;">
                          <strong style="font-size:1.15rem; color:${inStockCount < 5 ? '#e11d48' : 'var(--accent-secondary)'};">${inStockCount} เครื่อง</strong>
                        </div>
                      </div>

                      <div style="background:rgba(0,0,0,0.02); padding:0.6rem; border-radius:6px; border:1px solid var(--border-color);">
                        <div style="color:var(--text-muted); font-size:0.73rem;">🟡 รอสาขาเติม IMEI</div>
                        <div style="margin-top:0.2rem;">
                          <strong style="font-size:1.15rem; color:${pendingCount > 0 ? '#d97706' : 'var(--text-dim)'};">${pendingCount} ใบ</strong>
                        </div>
                      </div>

                      <div style="background:rgba(0,0,0,0.02); padding:0.6rem; border-radius:6px; border:1px solid var(--border-color);">
                        <div style="color:var(--text-muted); font-size:0.73rem;">🟢 รับเข้าสต็อกแล้ว</div>
                        <div style="margin-top:0.2rem;">
                          <strong style="font-size:1.1rem; color:#059669;">${receivedCount} ใบ</strong>
                        </div>
                      </div>

                      <div style="background:rgba(0,0,0,0.02); padding:0.6rem; border-radius:6px; border:1px solid var(--border-color);">
                        <div style="color:var(--text-muted); font-size:0.73rem;">💰 ยอดสั่งซื้อสะสม</div>
                        <div style="margin-top:0.2rem;">
                          <strong style="font-size:0.92rem; color:#059669;">฿${totalOrderVal.toLocaleString()}</strong>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Quick Action Buttons -->
                  <div style="display:flex; gap:0.5rem; margin-top:0.5rem;">
                    <button class="btn btn-primary btn-sm" style="flex:1; font-size:0.8rem; font-weight:700;" onclick="openCreatePurchaseOrderModal('${b._id}')">
                      <i class="fa-solid fa-cart-plus"></i> + สั่งซื้อลงสาขานี้
                    </button>
                    <button class="btn btn-secondary btn-sm" style="font-size:0.8rem; font-weight:700;" onclick="renderBranchPurchaseOrdersView('${b._id}', true)">
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
      <div id="po-list-section" class="card" style="margin-bottom:1.5rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem;">
        <div>
          <h3 style="font-size:1.15rem; font-weight:700; display:flex; align-items:center; gap:0.5rem;">
            <i class="fa-solid fa-cart-flatbed" style="color:var(--accent-primary);"></i> รายการใบสั่งซื้อสินค้าลงสาขา (${displayedOrders.length} รายการ)
          </h3>
          <p style="font-size:0.82rem; color:var(--text-muted);">ประวัติและสถานะใบสั่งซื้อสินค้าลงสาขาแบบละเอียด</p>
        </div>

        <div style="display:flex; align-items:center; gap:0.8rem; flex-wrap:wrap;">
          <button class="btn btn-primary" onclick="openCreatePurchaseOrderModal(${selectedBranchId ? `'${selectedBranchId}'` : ''})"><i class="fa-solid fa-plus"></i> สั่งซื้อสินค้าลงสาขาใหม่</button>
          
          <div style="display:flex; align-items:center; gap:0.3rem;">
            <label style="font-size:0.75rem; color:var(--text-muted); font-weight:600;">เริ่มวันที่:</label>
            <input type="date" id="po-start-date" class="form-control" style="width:auto; font-size:0.78rem; padding:0.2rem 0.4rem;" onchange="filterPoTable()">
          </div>
          <div style="display:flex; align-items:center; gap:0.3rem;">
            <label style="font-size:0.75rem; color:var(--text-muted); font-weight:600;">ถึงวันที่:</label>
            <input type="date" id="po-end-date" class="form-control" style="width:auto; font-size:0.78rem; padding:0.2rem 0.4rem;" onchange="filterPoTable()">
          </div>
          <input type="text" id="po-search-input" class="form-control" placeholder="ค้นหาเลขที่สั่งซื้อ, สินค้า, ผู้สั่ง..." style="width:190px; font-size:0.78rem; padding:0.2rem 0.4rem;" onkeyup="filterPoTable()">

          ${branches.length > 0 ? `
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
              const dateObj = new Date(order.createdAt);
              const isoDate = dateObj.toISOString().split('T')[0];
              const itemsNamesStr = itemsList.map(it => it.productName).join(' ');

              let statusBadge = '<span class="badge badge-green"><i class="fa-solid fa-circle-check"></i> รับเข้าสต็อกแล้ว</span>';
              if (isPending) {
                statusBadge = '<span class="badge badge-yellow"><i class="fa-solid fa-clock"></i> รอสาขาเติม IMEI</span>';
              } else if (order.status === 'cancelled') {
                statusBadge = '<span class="badge badge-red"><i class="fa-solid fa-ban"></i> ยกเลิก</span>';
              }

              return `
                <tr class="po-row" data-search="${(order.orderNumber + ' ' + (order.branchName || '') + ' ' + itemsNamesStr + ' ' + (order.orderedByName || '')).toLowerCase()}" data-date="${isoDate}">
                  <td>
                    <strong style="color:var(--accent-secondary); font-size:0.92rem;">${order.orderNumber}</strong><br>
                    <span style="font-size:0.78rem; color:var(--text-muted);">${dateObj.toLocaleString('th-TH')}</span>
                  </td>
                  <td><strong>${order.branchName || 'สาขา'}</strong></td>
                  <td>
                    ${itemsList.map(it => `<div style="font-size:0.83rem;">• <strong>${it.productName}</strong> x${it.quantity} (฿${(it.unitPrice || 0).toLocaleString()}/ชิ้น)</div>`).join('')}
                  </td>
                  <td><strong style="color:var(--accent-primary);">${totalQty} เครื่อง</strong></td>
                  <td><strong style="color:#059669; font-size:0.95rem;">฿${(order.totalAmount || 0).toLocaleString()}</strong></td>
                  <td><span style="font-size:0.83rem;">${order.orderedByName || 'พนักงาน'}</span></td>
                  <td style="text-align:center;">
                    ${statusBadge}<br>
                    ${isPending ? `
                      <div style="display:flex; flex-direction:column; gap:0.3rem; margin-top:0.4rem; align-items:center;">
                        <button class="btn btn-success btn-sm" style="padding:0.25rem 0.6rem; font-size:0.78rem; width:100%; font-weight:700;" onclick="openFillImeiAndReceiveModal('${order._id}')">
                          <i class="fa-solid fa-barcode"></i> สแกน IMEI รับสินค้าเข้าสต็อกสาขา
                        </button>
                        <div style="display:flex; gap:0.3rem; width:100%;">
                          <button class="btn btn-warning btn-sm" style="padding:0.25rem 0.4rem; font-size:0.75rem; flex:1; font-weight:700;" onclick="openEditPurchaseOrderModal('${order._id}')">
                            <i class="fa-solid fa-pen-to-square"></i> แก้ไข
                          </button>
                          <button class="btn btn-danger btn-sm" style="padding:0.25rem 0.4rem; font-size:0.75rem; flex:1; font-weight:700;" onclick="cancelPurchaseOrderAction('${order._id}')">
                            <i class="fa-solid fa-ban"></i> ยกเลิก
                          </button>
                        </div>
                        ${isHqOrAdmin ? `
                          <button class="btn btn-sm" style="padding:0.25rem 0.4rem; font-size:0.73rem; width:100%; font-weight:700; background:#0891b2; color:#fff; border:none; margin-top:0.2rem;" onclick="markPurchaseOrderAsReceived('${order._id}', '${order.orderNumber}')">
                            <i class="fa-solid fa-circle-check"></i> ปิดใบสั่งซื้อ (รับเข้าสต็อกแล้ว)
                          </button>
                        ` : ''}
                      </div>
                    ` : ''}
                    <button class="btn btn-secondary btn-sm" style="padding:0.25rem 0.5rem; font-size:0.75rem; margin-top:0.3rem; font-weight:700; width:100%;" onclick="printPurchaseOrderDoc('${order._id}')">
                      <i class="fa-solid fa-print"></i> พิมพ์ใบสั่งซื้อ
                    </button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;

    if (shouldScroll) {
      setTimeout(() => {
        const el = document.getElementById('po-list-section');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    }
  } catch (err) {
    container.innerHTML = `<div style="color:#ef4444; padding:2rem;">เกิดข้อผิดพลาดในการโหลดใบสั่งซื้อ: ${err.message}</div>`;
  }
}

function filterPoTable() {
  const query = document.getElementById('po-search-input') ? document.getElementById('po-search-input').value.toLowerCase().trim() : '';
  const startDate = document.getElementById('po-start-date') ? document.getElementById('po-start-date').value : '';
  const endDate = document.getElementById('po-end-date') ? document.getElementById('po-end-date').value : '';

  document.querySelectorAll('.po-row').forEach(row => {
    const searchData = row.getAttribute('data-search') || '';
    const rowDate = row.getAttribute('data-date') || '';
    
    let matchSearch = searchData.includes(query);
    let matchDate = true;

    if (startDate && rowDate < startDate) matchDate = false;
    if (endDate && rowDate > endDate) matchDate = false;

    if (matchSearch && matchDate) {
      row.style.display = '';
    } else {
      row.style.display = 'none';
    }
  });
}

function openCreatePurchaseOrderModal(preselectedBranchId = null) {
  const branches = state.masterOptions.branches || [];
  const bodyHtml = `
    <form id="create-po-form" onsubmit="event.preventDefault(); submitCreatePurchaseOrder();">
      <div class="form-group" style="margin-bottom:1.2rem; background:rgba(0,0,0,0.025); border:1px solid var(--border-color); padding:1rem; border-radius:8px;">
        <label for="po-branch" style="font-weight:700; color:var(--text-main); font-size:0.95rem;">
          <i class="fa-solid fa-store" style="color:var(--accent-primary);"></i> เลือกสาขาที่สั่งซื้อสินค้าลง <span style="color:#ef4444;">*</span>
        </label>
        <select id="po-branch" class="form-select" style="margin-top:0.4rem; font-weight:700; background:#ffffff;" onchange="updatePoBranchCreditPreview(this.value)" required>
          ${branches.map(b => `<option value="${b._id}" ${preselectedBranchId && String(b._id) === String(preselectedBranchId) ? 'selected' : ''}>${b.name} (วงเงินคงเหลือ: ฿${Math.max(0, (b.creditLimit || 0) - (b.usedCredit || 0)).toLocaleString()})</option>`).join('')}
        </select>
        <div id="po-credit-preview" style="font-size:0.83rem; margin-top:0.5rem;"></div>
      </div>

      <div style="font-weight:800; font-size:0.98rem; margin-bottom:0.8rem; color:var(--accent-primary); display:flex; justify-content:space-between; align-items:center;">
        <span><i class="fa-solid fa-boxes-packing"></i> ระบุรายการสินค้าที่สั่งซื้อลงสาขา</span>
        <button type="button" class="btn btn-success btn-sm" onclick="addPoItemRow()" style="font-weight:700;">
          <i class="fa-solid fa-plus"></i> + เพิ่มรายการสินค้า
        </button>
      </div>

      <div id="po-items-container" style="display:flex; flex-direction:column; gap:1rem; max-height:360px; overflow-y:auto; margin-bottom:1.2rem; padding-right:0.4rem;">
        <!-- Dynamic PO Item Rows -->
      </div>

      <div id="po-total-card" style="background:rgba(0,0,0,0.03); border:1px solid var(--border-color); padding:1rem 1.2rem; border-radius:8px; display:flex; justify-content:space-between; align-items:center;">
        <div>
          <div style="font-size:0.82rem; color:var(--text-muted);">ราคารวมทั้งใบสั่งซื้อ</div>
          <div style="font-size:0.78rem; color:var(--text-dim);">(จะถูกหักจากวงเงินคงเหลือของสาขา)</div>
        </div>
        <div style="text-align:right;">
          <strong id="po-total-amount" style="font-size:1.4rem; color:#059669;">฿0</strong>
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
      <div style="background:rgba(0,0,0,0.025); padding:0.6rem 0.8rem; border-radius:6px; display:flex; gap:1.2rem; align-items:center; border:1px solid var(--border-color);">
        <div><span style="color:var(--text-muted);">วงเงินอนุมัติ:</span> <strong>฿${(b.creditLimit || 0).toLocaleString()}</strong></div>
        <div><span style="color:var(--text-muted);">ใช้ไปแล้ว:</span> <span style="color:#d97706; font-weight:700;">฿${(b.usedCredit || 0).toLocaleString()}</span></div>
        <div><span style="color:var(--text-muted);">วงเงินคงเหลือสั่งซื้อได้:</span> <strong style="color:#059669; font-size:0.95rem;">฿${rem.toLocaleString()}</strong></div>
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
      <div class="po-item-card" style="background:rgba(0,0,0,0.015); border:1px solid var(--border-color); padding:1rem; border-radius:8px; position:relative;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.8rem; gap:0.5rem; flex-wrap:wrap;">
          <div style="font-weight:700; color:var(--accent-primary); font-size:0.9rem; display:flex; align-items:center; gap:0.4rem;">
            <span class="badge badge-gold" style="font-size:0.75rem;">รายการที่ ${idx + 1}</span>
            <span style="color:${fullName ? '#059669' : '#e11d48'}; font-size:0.95rem; font-weight:800;">${fullName || '⚠️ ยังไม่ได้เลือกข้อมูลสินค้า'}</span>
          </div>
          ${(window.poItemsState || []).length > 1 ? `
            <button type="button" class="btn btn-danger btn-sm" onclick="removePoItemRow(${idx})" style="padding:0.2rem 0.6rem; font-size:0.75rem;">
              <i class="fa-solid fa-trash"></i> ลบรายการนี้
            </button>
          ` : ''}
        </div>

        <!-- Specs Grid (Mandatory Selection) -->
        <div class="grid-4col" style="gap:0.6rem; margin-bottom:0.8rem;">
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
        <div class="grid-3col" style="gap:0.6rem; background:rgba(0,0,0,0.025); padding:0.65rem; border-radius:6px; align-items:center; border:1px solid var(--border-color);">
          <div>
            <label style="font-size:0.75rem; color:var(--text-muted); font-weight:700;">จำนวน (เครื่อง) <span style="color:#ef4444;">*</span></label>
            <input type="number" class="form-control po-qty-input" data-idx="${idx}" style="font-size:0.88rem; font-weight:700; color:var(--accent-primary); background:#ffffff;" min="1" value="${item.quantity}" oninput="onPoNumericInput(${idx})">
          </div>
          <div>
            <label style="font-size:0.75rem; color:var(--text-muted); font-weight:700;">ราคาสั่งซื้อ/ชิ้น (บาท) <span style="color:#ef4444;">*</span></label>
            <input type="number" class="form-control po-price-input" data-idx="${idx}" style="font-size:0.88rem; font-weight:700; color:#059669; background:#ffffff;" min="0" placeholder="ระบุราคาสั่งซื้อ" value="${item.unitPrice || ''}" oninput="onPoNumericInput(${idx})">
          </div>
          <div style="text-align:right;">
            <div style="font-size:0.72rem; color:var(--text-muted);">รวมรายการนี้</div>
            <strong id="po-row-subtotal-${idx}" style="font-size:1.05rem; color:#d97706;">฿${rowSubtotal.toLocaleString()}</strong>
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
  showCustomConfirm(
    'ยืนยันยกเลิกใบสั่งซื้อ',
    'คุณยืนยันที่จะ "ยกเลิก" ใบสั่งซื้อนี้ใช่หรือไม่?\n\n* ระบบจะทำการ คืนวงเงินสั่งซื้อ ให้กับสาขาโดยอัตโนมัติ *',
    async () => {
      try {
        const res = await apiRequest(`/purchase-orders/${orderId}/cancel`, 'POST');
        if (res.success) {
          showToast(res.message);
          renderBranchPurchaseOrdersView();
        }
      } catch (err) {
        // Handled
      }
    },
    null,
    'warning'
  );
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
            <input type="text" class="form-control po-imei-input" data-item-idx="${itemIdx}" data-sub-idx="${i}" placeholder="สแกนหมายเลข IMEI 15 หลัก เครื่องที่ ${i + 1}" required style="font-family:monospace; font-size:0.85rem; font-weight:700;" onkeydown="handlePoImeiInputKeyDown(event, this)">
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

    setTimeout(() => {
      const firstInput = document.querySelector('.po-imei-input');
      if (firstInput) {
        firstInput.focus();
        firstInput.select();
      }
    }, 150);

  } catch (err) {
    openModal('เกิดข้อผิดพลาด', `<p style="color:#ef4444;">${err.message}</p>`);
  }
}

function handlePoImeiInputKeyDown(event, input) {
  if (event.key === 'Enter') {
    event.preventDefault();
    
    const currentVal = input.value.trim();
    if (!currentVal) return;

    const inputs = Array.from(document.querySelectorAll('.po-imei-input'));
    const currentIdx = inputs.indexOf(input);

    // Check if duplicate exists in any other inputs
    let duplicateIdx = -1;
    for (let i = 0; i < inputs.length; i++) {
      if (i !== currentIdx && inputs[i].value.trim() === currentVal) {
        duplicateIdx = i;
        break;
      }
    }

    if (duplicateIdx !== -1) {
      const duplicateInput = inputs[duplicateIdx];
      const itemIdx = parseInt(duplicateInput.getAttribute('data-item-idx'), 10);
      const subIdx = parseInt(duplicateInput.getAttribute('data-sub-idx'), 10);
      const productName = window.currentFillingPo && window.currentFillingPo.items[itemIdx]
        ? window.currentFillingPo.items[itemIdx].productName
        : '';
      
      showToast(`⚠️ หมายเลข IMEI ซ้ำกับ ${productName} เครื่องที่ ${subIdx + 1}`, 'error');
      input.focus();
      input.select();
      return;
    }

    if (currentIdx !== -1 && currentIdx < inputs.length - 1) {
      const nextInput = inputs[currentIdx + 1];
      nextInput.focus();
      nextInput.select();
    } else {
      const orderId = window.currentFillingPo ? window.currentFillingPo._id : null;
      if (orderId) {
        submitFillImeiAndReceive(orderId);
      }
    }
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

async function markPurchaseOrderAsReceived(orderId, orderNumber) {
  showCustomConfirm(
    'ยืนยันปิดใบสั่งซื้อ',
    `ยืนยันปิดใบสั่งซื้อ ${orderNumber}?\n\nการดำเนินการนี้จะเปลี่ยนสถานะเป็น "รับเข้าสต็อกแล้ว"\nใช้สำหรับกรณีที่สาขาได้รับสินค้าเข้าสต็อกผ่านช่องทางอื่นแล้ว`,
    async () => {
      try {
        const res = await apiRequest(`/purchase-orders/${orderId}/mark-received`, 'POST');
        if (res.success) {
          showToast(res.message || 'ปิดใบสั่งซื้อเรียบร้อยแล้ว');
          renderBranchPurchaseOrdersView();
        }
      } catch (err) {
        // Handled by apiRequest
      }
    },
    null,
    'confirm'
  );
}

async function printPurchaseOrderDoc(orderId) {
  openModal('กำลังโหลดเอกสารใบสั่งซื้อ...', '<div style="padding:2rem; text-align:center;"><i class="fa-solid fa-spinner fa-spin fa-2x"></i></div>');

  try {
    const res = await apiRequest(`/purchase-orders/${orderId}`);
    const order = res.order;
    if (!order) {
      showToast('ไม่พบข้อมูลใบสั่งซื้อ', 'error');
      return;
    }

    const branches = state.masterOptions.branches || [];
    const branch = branches.find(b => String(b._id) === String(order.branch ? (order.branch._id || order.branch) : '')) || order.branch || {};
    const itemsList = order.items || [];
    const totalQty = itemsList.reduce((sum, it) => sum + (it.quantity || 0), 0);
    const orderDate = new Date(order.createdAt);

    let statusLabel = 'รอสาขาเติม IMEI';
    let statusColor = '#b45309';
    if (order.status === 'received') { statusLabel = 'รับเข้าสต็อกแล้ว'; statusColor = '#15803d'; }
    else if (order.status === 'cancelled') { statusLabel = 'ยกเลิก'; statusColor = '#b91c1c'; }

    const bodyHtml = `
      <div id="printable-voucher" class="printable-area" style="background:#fff; color:#000; padding:2.2rem; border:1px solid #ccc; border-radius:8px; font-family:'Sarabun','Prompt',sans-serif; max-width:800px; margin:0 auto 3rem auto; box-shadow:0 0 10px rgba(0,0,0,0.05); display:flex; flex-direction:column; min-height:auto; justify-content:flex-start; box-sizing:border-box;">
        <div>
          <!-- Header -->
          <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:3px double #000; padding-bottom:1.2rem; margin-bottom:1.5rem;">
            <div style="display:flex; gap:1.2rem; align-items:center;">
              <img src="/image/icon_silminbanana.png" style="height:70px; width:auto; object-fit:contain;" alt="Logo">
              <div>
                <h2 style="font-size:1.35rem; font-weight:800; color:#000; margin:0; line-height:1.2;">ซิลมีน บานาน่า</h2>
                <p style="font-size:0.82rem; color:#444; margin:0.3rem 0 0 0; line-height:1.4;">
                  สำนักงานใหญ่: 883 ถ.สิโรรส ต.สะเตง อ.เมือง จ.ยะลา 95000<br>
                  เลขประจำตัวผู้เสียภาษี: 1930400058472
                </p>
              </div>
            </div>
            <div style="text-align:right;">
              <span style="display:inline-block; border:2px solid #000; padding:0.5rem 1rem; font-weight:800; font-size:1.1rem; background:#f0f9ff; margin-bottom:0.5rem; border-radius:4px;">
                ใบสั่งซื้อสินค้า
              </span>
              <div style="font-size:0.85rem; color:#333; line-height:1.6;">
                <div><strong>เลขที่ใบสั่งซื้อ:</strong> ${order.orderNumber}</div>
                <div><strong>วันที่สั่งซื้อ:</strong> ${orderDate.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
              </div>
            </div>
          </div>

          <!-- Branch & Orderer Info -->
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:1.5rem; margin-bottom:1.5rem;">
            <div style="border:1px solid #ccc; padding:0.9rem; border-radius:6px; background:#fafafa;">
              <div style="font-weight:800; font-size:0.9rem; border-bottom:1px solid #eee; padding-bottom:0.3rem; margin-bottom:0.5rem; color:#0284c7;">
                <i class="fa-solid fa-building"></i> ผู้สั่งซื้อ (สำนักงานใหญ่)
              </div>
              <table style="width:100%; font-size:0.82rem; border-collapse:collapse; line-height:1.5; color:#000;">
                <tr><td style="width:75px; color:#555;">ผู้สั่งซื้อ:</td><td><strong>${order.orderedByName || '-'}</strong></td></tr>
                <tr><td style="color:#555;">วันเวลา:</td><td>${orderDate.toLocaleString('th-TH')}</td></tr>
                <tr><td style="color:#555;">หมายเหตุ:</td><td>${order.note || '-'}</td></tr>
              </table>
            </div>

            <div style="border:1px solid #ccc; padding:0.9rem; border-radius:6px; background:#fafafa;">
              <div style="font-weight:800; font-size:0.9rem; border-bottom:1px solid #eee; padding-bottom:0.3rem; margin-bottom:0.5rem; color:#16a34a;">
                <i class="fa-solid fa-store"></i> สาขาปลายทาง (ผู้รับสินค้า)
              </div>
              <table style="width:100%; font-size:0.82rem; border-collapse:collapse; line-height:1.5; color:#000;">
                <tr><td style="width:75px; color:#555;">สาขา:</td><td><strong>${branch.name || order.branchName || '-'}</strong></td></tr>
                <tr><td style="color:#555;">ที่อยู่:</td><td>${branch.address || '-'}</td></tr>
                <tr><td style="color:#555;">เบอร์โทร:</td><td>${branch.phone || '-'}</td></tr>
                ${order.status === 'received' ? `<tr><td style="color:#555;">ผู้รับสินค้า:</td><td><strong>${order.receivedByName || '-'}</strong></td></tr>` : ''}
              </table>
            </div>
          </div>

          <!-- Items Table -->
          <table style="width:100%; border-collapse:collapse; font-size:0.85rem; margin-bottom:1.5rem;">
            <thead>
              <tr style="background:#e5e7eb; color:#000; border-top:1px solid #000; border-bottom:1px solid #000;">
                <th style="padding:10px 8px; text-align:center; border-bottom:1px solid #000; width:45px;">ลำดับ</th>
                <th style="padding:10px 8px; text-align:left; border-bottom:1px solid #000;">รายการสินค้า</th>
                <th style="padding:10px 8px; text-align:center; border-bottom:1px solid #000; width:65px;">จำนวน</th>
                <th style="padding:10px 8px; text-align:right; border-bottom:1px solid #000; width:110px;">ราคา/ชิ้น (฿)</th>
                <th style="padding:10px 8px; text-align:right; border-bottom:1px solid #000; width:110px;">รวม (฿)</th>
              </tr>
            </thead>
            <tbody>
              ${itemsList.map((item, idx) => {
                const imeiList = (item.imeis && item.imeis.length > 0) ? item.imeis : [];
                return `
                  <tr style="color:#000; border-bottom:1px solid #eee;">
                    <td style="padding:10px 8px; text-align:center; color:#555;">${idx + 1}</td>
                    <td style="padding:10px 8px;">
                      <strong>${item.productName || '-'}</strong>
                      ${imeiList.length > 0 ? `<div style="font-size:0.78rem; color:#555; margin-top:0.3rem; font-family:monospace;">IMEI: ${imeiList.join(', ')}</div>` : ''}
                    </td>
                    <td style="padding:10px 8px; text-align:center;">${item.quantity}</td>
                    <td style="padding:10px 8px; text-align:right;">฿${(item.unitPrice || 0).toLocaleString()}</td>
                    <td style="padding:10px 8px; text-align:right; font-weight:700;">฿${(item.totalPrice || (item.quantity * item.unitPrice) || 0).toLocaleString()}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
            <tfoot>
              <tr style="background:#f0fdf4; font-weight:700; border-top:1px solid #000; color:#000;">
                <td colspan="2" style="padding:10px 8px; text-align:right;">จำนวนรวมทั้งสิ้น:</td>
                <td style="padding:10px 8px; text-align:center; font-weight:800;">${totalQty} เครื่อง</td>
                <td style="padding:10px 8px; text-align:right;"></td>
                <td style="padding:10px 8px; text-align:right; font-weight:800; font-size:1.05rem; color:#15803d;">฿${(order.totalAmount || 0).toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>

          <!-- Credit Summary -->
          ${branch.creditLimit ? `
            <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:6px; padding:0.7rem 1rem; font-size:0.82rem; margin-bottom:1.5rem; color:#1e3a5f;">
              <strong>สรุปวงเงินเครดิตสาขา:</strong>
              วงเงินอนุมัติ ฿${(branch.creditLimit || 0).toLocaleString()} |
              ใช้ไปแล้ว ฿${(branch.usedCredit || 0).toLocaleString()} |
              คงเหลือ ฿${Math.max(0, (branch.creditLimit || 0) - (branch.usedCredit || 0)).toLocaleString()}
            </div>
          ` : ''}
        </div>

        <!-- Signature Section -->
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:2.5rem; text-align:center; font-size:0.85rem; color:#000; margin-top:3rem; padding-top:1.5rem; border-top:1px dashed #ccc;">
          <div style="border:1px solid #ccc; padding:1.5rem 1rem; border-radius:6px; background:#fafafa; display:flex; flex-direction:column; align-items:center; justify-content:center;">
            <div style="font-weight:700; margin-bottom:2rem;">ผู้สั่งซื้อ / ผู้อนุมัติ</div>
            <div style="width:200px; border-bottom:1px dashed #000; margin-bottom:0.5rem;"></div>
            <div>( ${order.orderedByName || '____________________________________'} )</div>
            <div style="font-size:0.78rem; color:#555; margin-top:0.4rem;">วันที่ ${orderDate.toLocaleDateString('th-TH')}</div>
          </div>

          <div style="border:1px solid #ccc; padding:1.5rem 1rem; border-radius:6px; background:#fafafa; display:flex; flex-direction:column; align-items:center; justify-content:center;">
            <div style="font-weight:700; margin-bottom:2rem;">ผู้รับสินค้า (สาขาปลายทาง)</div>
            <div style="width:200px; border-bottom:1px dashed #000; margin-bottom:0.5rem;"></div>
            <div>( ${order.status === 'received' && order.receivedByName ? order.receivedByName : '____________________________________'} )</div>
            <div style="font-size:0.78rem; color:#555; margin-top:0.4rem;">วันที่ ${order.receivedAt ? new Date(order.receivedAt).toLocaleDateString('th-TH') : '_____ / _____ / ________'}</div>
          </div>
        </div>
      </div>
    `;

    const footerHtml = `
      <button class="btn btn-secondary" onclick="closeModal()">ปิดหน้าต่าง</button>
      <button class="btn btn-primary" onclick="window.print()"><i class="fa-solid fa-print"></i> พิมพ์ใบสั่งซื้อสินค้า</button>
    `;

    openModal(`เอกสาร: ${order.orderNumber}`, bodyHtml, footerHtml);
  } catch (err) {
    openModal('เกิดข้อผิดพลาด', `<p style="color:#ef4444;">${err.message}</p>`);
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

    const isHqUser = !state.user.branch || state.user.branch.code === 'BR-HQ01' || (state.user.branch.name && state.user.branch.name.includes('สำนักงานใหญ่'));
    const isAdminOrHq = ['admin', 'hq_stock_staff', 'purchase_staff'].includes((state.user ? state.user.role : 'admin')) || isHqUser;

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
        // Filter to own branch only for non-HQ/non-Admin staff
        if (!isAdminOrHq && state.user && state.user.branch) {
          const userBranchId = String(state.user.branch._id || state.user.branch);
          pendingPoOrders = pendingPoOrders.filter(o => {
            const oBranchId = o.branch ? String(o.branch._id || o.branch) : '';
            return oBranchId === userBranchId;
          });
        }
      }
      updateGoodsReceiptBadge();
    } catch (poErr) {
      console.warn('Unable to load purchase orders for goods-receipt view:', poErr);
    }

    // Build pending PO quick-receive section HTML
    let pendingPoSectionHtml = '';
    if (pendingPoOrders.length > 0) {
      const poRows = pendingPoOrders.map(order => {
        const totalQty = (order.items || []).reduce((sum, it) => sum + (it.quantity || 0), 0);
        const itemNames = (order.items || []).map(it => it.productName).join(', ');
        const dateObj = new Date(order.createdAt);
        const dateStr = dateObj.toLocaleDateString('th-TH');
        const isoDate = dateObj.toISOString().split('T')[0];
        const branchId = order.branch ? (order.branch._id || order.branch) : '';
        return `
          <tr class="gr-pending-po-row" data-search="${(order.orderNumber + ' ' + (order.branchName || '') + ' ' + itemNames).toLowerCase()}" data-date="${isoDate}" data-branch-id="${branchId}">
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
        <div class="card gr-pending-po-card" style="width: 100%; margin:0 auto 1.5rem auto;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.8rem; flex-wrap:wrap; gap:0.5rem;">
            <div style="display:flex; align-items:center; gap:0.6rem;">
              <i class="fa-solid fa-bell" style="color:#fbbf24; font-size:1.1rem;"></i>
              <h4 style="font-size:1.05rem; font-weight:800; color:#fbbf24; margin:0;">ใบสั่งซื้อที่รอเติม IMEI & รับเข้าสต็อก</h4>
              <span id="gr-pending-po-count-badge" class="badge badge-yellow" style="font-size:0.82rem;">${pendingPoOrders.length} ใบ</span>
            </div>
            
            <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
              ${isAdminOrHq ? `
                <div style="display:flex; align-items:center; gap:0.3rem;">
                  <label style="font-size:0.75rem; color:var(--text-muted); font-weight:600;">สาขา:</label>
                  <select id="gr-po-branch-filter" class="form-select" style="width:auto; font-size:0.78rem; padding:0.2rem 0.4rem; height:auto; min-height:auto;" onchange="filterGrPendingPoTable()">
                    <option value="">-- ทุกสาขา --</option>
                    ${state.masterOptions.branches ? state.masterOptions.branches.map(b => `<option value="${b._id}">${b.name}</option>`).join('') : ''}
                  </select>
                </div>
              ` : ''}
              <div style="display:flex; align-items:center; gap:0.3rem;">
                <label style="font-size:0.75rem; color:var(--text-muted);">เริ่มวันที่:</label>
                <input type="date" id="gr-po-start-date" class="form-control" style="width:auto; font-size:0.78rem; padding:0.2rem 0.4rem;" onchange="filterGrPendingPoTable()">
              </div>
              <div style="display:flex; align-items:center; gap:0.3rem;">
                <label style="font-size:0.75rem; color:var(--text-muted);">ถึงวันที่:</label>
                <input type="date" id="gr-po-end-date" class="form-control" style="width:auto; font-size:0.78rem; padding:0.2rem 0.4rem;" onchange="filterGrPendingPoTable()">
              </div>
              <input type="text" id="gr-po-search-input" class="form-control" placeholder="ค้นหาเลขที่สั่งซื้อ, สาขา..." style="width:180px; font-size:0.78rem; padding:0.2rem 0.4rem;" onkeyup="filterGrPendingPoTable()">
            </div>
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
      
      <!-- History & Editing Section -->
      <div class="card gr-history-card" style="width: 100%; margin: 0 auto;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; flex-wrap:wrap; gap:0.8rem; border-bottom:1px solid rgba(255,255,255,0.06); padding-bottom:0.8rem;">
          <div>
            <h4 style="font-size:1.1rem; font-weight:700; display:flex; align-items:center; gap:0.5rem;">
              <i class="fa-solid fa-clock-rotate-left" style="color:var(--accent-gold);"></i> ประวัติรายการรับสินค้าเข้าสต็อก
            </h4>
            <p style="font-size:0.82rem; color:var(--text-muted); margin-top:0.2rem;">
              รายการที่ขึ้นสถานะ <span class="badge badge-yellow" style="font-size:0.7rem;">🟡 รอตั้งราคา / ยืนยัน</span> สามารถกดแก้ไขข้อมูล/IMEI ได้ ก่อนที่ฝ่ายจัดซื้อจะยืนยันเข้าสต็อกจริง
            </p>
          </div>
          <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
            <button id="toggle-gr-form-btn" class="btn btn-warning btn-sm" onclick="toggleGrManualForm()" style="font-weight:700;"><i class="fa-solid fa-plus"></i> เพิ่มสินค้านอกใบสั่งซื้อ</button>
            <button class="btn btn-success btn-sm" onclick="exportGoodsReceiptHistoryToExcel()"><i class="fa-solid fa-file-excel"></i> Export Excel</button>
            <button class="btn btn-secondary btn-sm" onclick="renderGoodsReceiptView()"><i class="fa-solid fa-rotate"></i> รีเฟรชประวัติ</button>
          </div>
        </div>
        
        <!-- History Filters Toolbar -->
        <div style="display:flex; justify-content:flex-end; align-items:center; gap:0.8rem; flex-wrap:wrap; margin-bottom:1rem; background:rgba(255,255,255,0.02); padding:0.6rem; border-radius:6px; border:1px solid rgba(255,255,255,0.05);">
          ${isAdminOrHq ? `
            <div style="display:flex; align-items:center; gap:0.3rem;">
              <label style="font-size:0.75rem; color:var(--text-muted); font-weight:600;">สาขา:</label>
              <select id="gr-hist-branch-filter" class="form-select" style="width:auto; font-size:0.78rem; padding:0.2rem 0.4rem; height:auto; min-height:auto;" onchange="filterGrReceiptHistoryTable()">
                <option value="">-- ทุกสาขา --</option>
                ${state.masterOptions.branches ? state.masterOptions.branches.map(b => `<option value="${b._id}">${b.name}</option>`).join('') : ''}
              </select>
            </div>
          ` : ''}
          <div style="display:flex; align-items:center; gap:0.3rem;">
            <label style="font-size:0.75rem; color:var(--text-muted); font-weight:600;">เริ่มวันที่:</label>
            <input type="date" id="gr-hist-start-date" class="form-control" style="width:auto; font-size:0.78rem; padding:0.2rem 0.4rem;" onchange="filterGrReceiptHistoryTable()">
          </div>
          <div style="display:flex; align-items:center; gap:0.3rem;">
            <label style="font-size:0.75rem; color:var(--text-muted); font-weight:600;">ถึงวันที่:</label>
            <input type="date" id="gr-hist-end-date" class="form-control" style="width:auto; font-size:0.78rem; padding:0.2rem 0.4rem;" onchange="filterGrReceiptHistoryTable()">
          </div>
          <input type="text" id="gr-hist-search-input" class="form-control" placeholder="ค้นหาเลขที่ใบรับ, สาขา, สินค้า, IMEI..." style="width:240px; font-size:0.78rem; padding:0.2rem 0.4rem;" onkeyup="filterGrReceiptHistoryTable()">
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
                const dateObj = new Date(r.createdAt);
                const dateStr = dateObj.toLocaleString('th-TH');
                const isoDate = dateObj.toISOString().split('T')[0];
                const branchId = r.branch ? (r.branch._id || r.branch) : '';

                return `
                  <tr class="receipt-history-row gr-table-row" data-search="${(r.receiptNumber + ' ' + (r.branch ? r.branch.name : '') + ' ' + (r.receivedBy ? (r.receivedBy.fullName || r.receivedBy.username) : '') + ' ' + p.name + ' ' + (p.brand || '') + ' ' + (p.model || '') + ' ' + ((r.imeiSerials && r.imeiSerials[0]) || '')).toLowerCase()}" data-date="${isoDate}" data-branch-id="${branchId}">
                    <td>
                      <strong style="color:var(--accent-primary);">${r.receiptNumber}</strong><br>
                      <span style="font-size:0.78rem; color:var(--text-muted);">${dateStr}</span>
                    </td>
                    <td>
                      <strong>${r.branch ? r.branch.name : '-'}</strong><br>
                      <span style="font-size:0.78rem; color:var(--text-muted);">ผู้บันทึก: ${r.receivedBy ? (r.receivedBy.fullName || r.receivedBy.username) : '-'}</span>
                    </td>
                    <td>
                      <strong style="color:var(--text-main);">${p.name || '-'}</strong><br>
                      <span style="font-size:0.78rem; color:var(--text-muted);">${p.brand || ''} | ${p.model || ''} (${p.category || ''})</span>
                    </td>
                    <td>
                      <span style="font-family:monospace; font-weight:700; color:#d97706;">${(r.imeiSerials && r.imeiSerials[0]) || '-'}</span>
                    </td>
                    <td>
                      ${isPending ? '<span class="badge badge-gr-pending"><i class="fa-solid fa-clock"></i> รอตั้งราคา / ยืนยัน</span>' :
                        isConfirmed ? '<span class="badge badge-gr-confirmed"><i class="fa-solid fa-check-double"></i> ยืนยันเข้าสต็อกจริงแล้ว</span>' :
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

      <div id="gr-manual-form-container" style="display:none; margin-top:1.5rem;">
        <!-- Entry Card -->
        <div class="card gr-manual-form-card" style="max-width: 950px; margin: 0 auto 1.5rem auto;">
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

            <div class="grid-2col" style="gap:1rem;">
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

            <div class="grid-2col" style="gap:1rem;">
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

            <div class="grid-2col" style="gap:1rem;">
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
                <input type="text" id="gr-single-imei" class="form-control gr-imei-input-box" placeholder="📥 สแกนบาร์โค้ด หรือพิมพ์หมายเลข IMEI 15 หลัก แล้วกด Enter..." onkeypress="if(event.key==='Enter'){ event.preventDefault(); addStagedGoodsReceiptItem(); }">
                <button type="button" class="btn btn-warning" onclick="addStagedGoodsReceiptItem()" style="white-space:nowrap; font-weight:700; box-shadow: 0 4px 10px rgba(245, 158, 11, 0.3);">
                  <i class="fa-solid fa-cart-plus"></i> + เพิ่มเข้ารายการคละ
                </button>
              </div>
            </div>
          </div>

          <!-- Staged Items Table -->
          <div style="margin-bottom:1.5rem;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.6rem;">
              <div style="font-weight:700; color:var(--text-main); font-size:1rem; display:flex; align-items:center; gap:0.4rem;">
                <i class="fa-solid fa-list-check" style="color:var(--accent-gold);"></i> ตารางรายการสินค้าคละที่เตรียมรับเข้า
                <span id="staged-count-badge" class="badge badge-gold" style="font-size:0.8rem;">${(window.stagedGoodsReceiptItems || []).length} เครื่อง</span>
              </div>
              ${(window.stagedGoodsReceiptItems || []).length > 0 ? `
                <button type="button" class="btn btn-sm btn-danger" onclick="clearAllStagedGoodsReceiptItems()">
                  <i class="fa-solid fa-trash-can"></i> ล้างรายการทั้งหมด
                </button>
              ` : ''}
            </div>

            <div class="table-container" style="background:rgba(0,0,0,0.025); border-radius:6px;">
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
            <button type="button" class="btn btn-secondary" onclick="toggleGrManualForm()">ยกเลิก</button>
            <button type="button" id="submit-batch-gr-btn" class="btn btn-primary" onclick="submitBatchGoodsReceipt()" style="padding:0.65rem 1.4rem; font-size:0.95rem; font-weight:700;" ${(window.stagedGoodsReceiptItems || []).length === 0 ? 'disabled' : ''}>
              <i class="fa-solid fa-paper-plane"></i> บันทึกรับสินค้าเข้าสต็อกทั้งหมด (${(window.stagedGoodsReceiptItems || []).length} รายการ)
            </button>
          </div>
        </div>
      </div>
    `;

    renderStagedItemsTable();
  } catch (err) {
    container.innerHTML = `<div style="color:#ef4444;">${err.message}</div>`;
  }
}

function filterGrPendingPoTable() {
  const query = document.getElementById('gr-po-search-input') ? document.getElementById('gr-po-search-input').value.toLowerCase().trim() : '';
  const startDate = document.getElementById('gr-po-start-date') ? document.getElementById('gr-po-start-date').value : '';
  const endDate = document.getElementById('gr-po-end-date') ? document.getElementById('gr-po-end-date').value : '';
  const branchFilter = document.getElementById('gr-po-branch-filter') ? document.getElementById('gr-po-branch-filter').value : '';

  let visibleCount = 0;
  document.querySelectorAll('.gr-pending-po-row').forEach(row => {
    const searchData = row.getAttribute('data-search') || '';
    const rowDate = row.getAttribute('data-date') || '';
    const rowBranchId = row.getAttribute('data-branch-id') || '';
    
    let matchSearch = searchData.includes(query);
    let matchDate = true;
    let matchBranch = true;

    if (startDate && rowDate < startDate) matchDate = false;
    if (endDate && rowDate > endDate) matchDate = false;
    if (branchFilter && rowBranchId !== branchFilter) matchBranch = false;

    if (matchSearch && matchDate && matchBranch) {
      row.style.display = '';
      visibleCount++;
    } else {
      row.style.display = 'none';
    }
  });

  const badge = document.getElementById('gr-pending-po-count-badge');
  if (badge) {
    badge.innerText = `${visibleCount} ใบ`;
  }
}

function filterGrReceiptHistoryTable() {
  const query = document.getElementById('gr-hist-search-input') ? document.getElementById('gr-hist-search-input').value.toLowerCase().trim() : '';
  const startDate = document.getElementById('gr-hist-start-date') ? document.getElementById('gr-hist-start-date').value : '';
  const endDate = document.getElementById('gr-hist-end-date') ? document.getElementById('gr-hist-end-date').value : '';
  const branchFilter = document.getElementById('gr-hist-branch-filter') ? document.getElementById('gr-hist-branch-filter').value : '';

  document.querySelectorAll('.receipt-history-row').forEach(row => {
    const searchData = row.getAttribute('data-search') || '';
    const rowDate = row.getAttribute('data-date') || '';
    const rowBranchId = row.getAttribute('data-branch-id') || '';
    
    let matchSearch = searchData.includes(query);
    let matchDate = true;
    let matchBranch = true;

    if (startDate && rowDate < startDate) matchDate = false;
    if (endDate && rowDate > endDate) matchDate = false;
    if (branchFilter && rowBranchId !== branchFilter) matchBranch = false;

    if (matchSearch && matchDate && matchBranch) {
      row.style.display = '';
    } else {
      row.style.display = 'none';
    }
  });
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
      <div class="grid-2col" style="gap:0.8rem;">
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

      <div class="grid-2col" style="gap:0.8rem;">
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

function toggleGrManualForm() {
  const formContainer = document.getElementById('gr-manual-form-container');
  const btn = document.getElementById('toggle-gr-form-btn');
  if (formContainer) {
    if (formContainer.style.display === 'none') {
      formContainer.style.display = 'block';
      formContainer.scrollIntoView({ behavior: 'smooth' });
      if (btn) btn.innerHTML = '<i class="fa-solid fa-minus"></i> ซ่อนแบบฟอร์มแมนนวล';
    } else {
      formContainer.style.display = 'none';
      if (btn) btn.innerHTML = '<i class="fa-solid fa-plus"></i> คีย์รับเข้าแมนนวล (คละรุ่น)';
    }
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
      <div class="grid-2col" style="gap:0.8rem;">
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

      <div class="grid-2col" style="gap:0.8rem;">
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
    <div style="margin-bottom:1rem; background:rgba(217,119,6,0.06); border:1px solid rgba(217,119,6,0.25); padding:0.8rem 1rem; border-radius:6px;">
      <div style="font-weight:700; color:#d97706; font-size:1.05rem; display:flex; align-items:center; gap:0.5rem; margin-bottom:0.3rem;">
        <i class="fa-solid fa-triangle-exclamation"></i> ยืนยันการรับสินค้าเข้าสต็อก (${items.length} รายการ)
      </div>
      <div style="font-size:0.85rem; color:var(--text-muted);">
        สาขาที่รับเข้า: <strong style="color:var(--text-main);">${branchName}</strong> | จำนวนสินค้ารวม: <strong style="color:var(--accent-primary);">${items.length} เครื่อง</strong>
      </div>
    </div>

    <p style="font-size:0.85rem; margin-bottom:0.8rem;">กรุณาตรวจสอบรายชื่อและหมายเลข IMEI สินค้าทั้งหมดที่จะรับเข้าสต็อกก่อนยืนยัน:</p>

    <div class="table-container" style="max-height: 320px; overflow-y: auto; background:rgba(0,0,0,0.025); border-radius:6px; margin-bottom:1rem;">
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
    const res = await apiRequest(`/stock/receipts`);
    const receipts = res.receipts || [];
    state.pendingReceiptsCache = receipts;
    updateReceiptVerificationBadge();

    const isHqOrPurchasing = true;

    const pendingCount = receipts.filter(r => r.status === 'pending_pricing').length;

    container.innerHTML = `
      <div class="card" style="margin-bottom:1.5rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem;">
        <div>
          <h3 style="font-size:1.1rem; font-weight:700;">ตรวจสอบรายการรับสินค้าเข้าสต็อก</h3>
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
          <button class="btn btn-secondary btn-sm" onclick="document.getElementById('rcpt-verify-status-filter').value=''; filterRcptVerifyTable();">รายการทั้งหมด</button>
          <button class="btn btn-secondary btn-sm" onclick="document.getElementById('rcpt-verify-status-filter').value='pending_pricing'; filterRcptVerifyTable();">
            <i class="fa-solid fa-clock"></i> รอตั้งราคา (${pendingCount})
          </button>
          <button class="btn btn-secondary btn-sm" onclick="document.getElementById('rcpt-verify-status-filter').value='confirmed'; filterRcptVerifyTable();">
            <i class="fa-solid fa-check-double"></i> ยืนยันแล้ว
          </button>
        </div>
      </div>

      <!-- Verification Filters Toolbar -->
      <div style="display:flex; justify-content:flex-end; align-items:center; gap:0.8rem; flex-wrap:wrap; margin-bottom:1rem; background:rgba(255,255,255,0.02); padding:0.6rem; border-radius:6px; border:1px solid rgba(255,255,255,0.05);">
        <div style="display:flex; align-items:center; gap:0.3rem;">
          <label style="font-size:0.75rem; color:var(--text-muted); font-weight:600;">สถานะ:</label>
          <select id="rcpt-verify-status-filter" class="form-select" style="width:auto; font-size:0.78rem; padding:0.2rem 0.4rem; height:auto; min-height:auto;" onchange="filterRcptVerifyTable()">
            <option value="">-- ทั้งหมด --</option>
            <option value="pending_pricing" ${filterStatus === 'pending_pricing' ? 'selected' : ''}>รอตั้งราคา</option>
            <option value="confirmed" ${filterStatus === 'confirmed' ? 'selected' : ''}>ยืนยันแล้ว</option>
            <option value="rejected" ${filterStatus === 'rejected' ? 'selected' : ''}>ถูกปฏิเสธ</option>
          </select>
        </div>
        <div style="display:flex; align-items:center; gap:0.3rem;">
          <label style="font-size:0.75rem; color:var(--text-muted); font-weight:600;">สาขา:</label>
          <select id="rcpt-verify-branch-filter" class="form-select" style="width:auto; font-size:0.78rem; padding:0.2rem 0.4rem; height:auto; min-height:auto;" onchange="filterRcptVerifyTable()">
            <option value="">-- ทุกสาขา --</option>
            ${state.masterOptions && state.masterOptions.branches ? state.masterOptions.branches.map(b => `<option value="${b._id}">${b.name}</option>`).join('') : ''}
          </select>
        </div>
        <div style="display:flex; align-items:center; gap:0.3rem;">
          <label style="font-size:0.75rem; color:var(--text-muted); font-weight:600;">เริ่มวันที่:</label>
          <input type="date" id="rcpt-verify-start-date" class="form-control" style="width:auto; font-size:0.78rem; padding:0.2rem 0.4rem;" onchange="filterRcptVerifyTable()">
        </div>
        <div style="display:flex; align-items:center; gap:0.3rem;">
          <label style="font-size:0.75rem; color:var(--text-muted); font-weight:600;">ถึงวันที่:</label>
          <input type="date" id="rcpt-verify-end-date" class="form-control" style="width:auto; font-size:0.78rem; padding:0.2rem 0.4rem;" onchange="filterRcptVerifyTable()">
        </div>
        <input type="text" id="rcpt-verify-search-input" class="form-control" placeholder="ค้นหาเลขที่ใบรับ, สินค้า, IMEI, ผู้รับ..." style="width:240px; font-size:0.78rem; padding:0.2rem 0.4rem;" onkeyup="filterRcptVerifyTable()">
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
              const dateObj = new Date(r.createdAt);
              const isoDate = dateObj.toISOString().split('T')[0];
              const branchId = r.branch ? (r.branch._id || r.branch) : '';
              const searchStr = (r.receiptNumber + ' ' + (r.branch ? r.branch.name : '') + ' ' + (r.receivedBy ? (r.receivedBy.fullName || r.receivedBy.username) : '') + ' ' + p.name + ' ' + ((r.imeiSerials && r.imeiSerials[0]) || '')).toLowerCase();

              return `
                <tr class="rcpt-verify-row" data-search="${searchStr}" data-date="${isoDate}" data-branch-id="${branchId}" data-status="${r.status}">
                  ${isHqOrPurchasing ? `
                    <td style="text-align:center;">
                      ${isPending ? `<input type="checkbox" class="rcpt-checkbox" value="${r._id}">` : ''}
                    </td>
                  ` : ''}
                  <td>
                    <strong>${r.receiptNumber}</strong><br>
                    <span style="font-size:0.78rem; color:var(--text-muted);">${dateObj.toLocaleString('th-TH')}</span>
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
                      <span class="badge badge-yellow" style="margin-bottom:0.3rem;"><i class="fa-solid fa-clock"></i> รอตั้งราคา</span><br>
                      ${isHqOrPurchasing ? `
                        <button class="btn btn-success btn-sm" style="padding:0.25rem 0.6rem; font-size:0.78rem; margin-top:0.3rem; margin-right:0.25rem;" onclick="openConfirmReceiptModal('${r._id}', '${r.receiptNumber}', '${(p.name || '').replace(/'/g, "\\'")}', ${r.purchase_price || 0}, ${r.selling_price || 0})">
                          <i class="fa-solid fa-check"></i> ใส่ราคา
                        </button>
                      ` : ''}
                      <button class="btn btn-info btn-sm no-print" style="padding:0.25rem 0.6rem; font-size:0.78rem; margin-top:0.3rem;" onclick="viewGoodsReceiptDetails('${r._id}')">
                        <i class="fa-solid fa-circle-info"></i> รายละเอียด
                      </button>
                    ` : `
                      <span class="badge badge-green" style="margin-bottom:0.3rem;"><i class="fa-solid fa-circle-check"></i> ยืนยันเข้าสต็อกแล้ว</span><br>
                      <span style="font-size:0.75rem; color:var(--text-muted); display:block; margin-bottom:0.3rem;">
                        อนุมัติโดย: ${r.confirmedBy ? r.confirmedBy.fullName || r.confirmedBy.username : '-'}
                      </span>
                      <div style="display:flex; justify-content:center; gap:0.25rem; flex-wrap:wrap; margin-top:0.3rem;">
                        <button class="btn btn-secondary btn-sm no-print" style="padding:0.25rem 0.6rem; font-size:0.78rem;" onclick="printGoodsReceiptSlip('${r._id}')">
                          <i class="fa-solid fa-print"></i> พิมพ์ใบนำเข้า
                        </button>
                        <button class="btn btn-info btn-sm no-print" style="padding:0.25rem 0.6rem; font-size:0.78rem;" onclick="viewGoodsReceiptDetails('${r._id}')">
                          <i class="fa-solid fa-circle-info"></i> รายละเอียด
                        </button>
                      </div>
                    `}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;

    // Apply initial filter if any is selected
    filterRcptVerifyTable();
  } catch (err) {
    container.innerHTML = `<div style="color:#ef4444; padding:2rem;">เกิดข้อผิดพลาดในการโหลดตรวจสอบรายการรับสินค้า: ${err.message}</div>`;
  }
}

function filterRcptVerifyTable() {
  const query = document.getElementById('rcpt-verify-search-input') ? document.getElementById('rcpt-verify-search-input').value.toLowerCase().trim() : '';
  const startDate = document.getElementById('rcpt-verify-start-date') ? document.getElementById('rcpt-verify-start-date').value : '';
  const endDate = document.getElementById('rcpt-verify-end-date') ? document.getElementById('rcpt-verify-end-date').value : '';
  const branchFilter = document.getElementById('rcpt-verify-branch-filter') ? document.getElementById('rcpt-verify-branch-filter').value : '';
  const statusFilter = document.getElementById('rcpt-verify-status-filter') ? document.getElementById('rcpt-verify-status-filter').value : '';

  document.querySelectorAll('.rcpt-verify-row').forEach(row => {
    const searchData = row.getAttribute('data-search') || '';
    const rowDate = row.getAttribute('data-date') || '';
    const rowBranchId = row.getAttribute('data-branch-id') || '';
    const rowStatus = row.getAttribute('data-status') || '';
    
    let matchSearch = searchData.includes(query);
    let matchDate = true;
    let matchBranch = true;
    let matchStatus = true;

    if (startDate && rowDate < startDate) matchDate = false;
    if (endDate && rowDate > endDate) matchDate = false;
    if (branchFilter && rowBranchId !== branchFilter) matchBranch = false;
    if (statusFilter && rowStatus !== statusFilter) matchStatus = false;

    if (matchSearch && matchDate && matchBranch && matchStatus) {
      row.style.display = '';
    } else {
      row.style.display = 'none';
    }
  });
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

  // Find the selected receipt objects
  const cache = state.pendingReceiptsCache || [];
  const selectedReceipts = cache.filter(r => selectedIds.includes(r._id));

  // Group by productInfo name
  const groupsMap = new Map();
  selectedReceipts.forEach(r => {
    const pInfo = r.productInfo || {};
    const key = pInfo.name || 'สินค้าไม่ระบุชื่อ';
    if (!groupsMap.has(key)) {
      groupsMap.set(key, {
        name: key,
        productInfo: pInfo,
        receiptIds: [],
        purchase_price: 0,
        selling_price: 0
      });
    }
    const grp = groupsMap.get(key);
    grp.receiptIds.push(r._id);
    if (r.purchase_price && r.purchase_price > 0 && !grp.purchase_price) {
      grp.purchase_price = r.purchase_price;
    }
    if (r.selling_price && r.selling_price > 0 && !grp.selling_price) {
      grp.selling_price = r.selling_price;
    }
  });

  const groups = Array.from(groupsMap.values());
  window.currentBatchGroups = groups;

  let bodyHtml = `
    <div style="background:rgba(0,0,0,0.25); padding:1rem; border-radius:6px; margin-bottom:1.2rem; border:1px solid rgba(255,255,255,0.1);">
      <div style="font-weight:800; font-size:1rem; color:#38bdf8;">
        คุณเลือกสินค้าทั้งหมด: <span style="color:#34d399;">${selectedIds.length} รายการ (เครื่อง)</span>
      </div>
      <div style="font-size:0.8rem; color:var(--text-muted); margin-top:0.2rem;">
        ระบบจัดกลุ่มสินค้าที่เหมือนกันให้โดยอัตโนมัติ (${groups.length} กลุ่ม) กรุณาระบุราคาทุนและราคาขายของแต่ละกลุ่มสินค้า
      </div>
    </div>

    <form id="confirm-batch-form">
  `;

  groups.forEach((group, gIdx) => {
    const pPriceVal = group.purchase_price > 0 ? group.purchase_price : '';
    const sPriceVal = group.selling_price > 0 ? group.selling_price : '';
    const safeKey = `group-${gIdx}`;
    group.key = safeKey; // Assign unique key to group object

    bodyHtml += `
      <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); padding:1rem; border-radius:8px; margin-bottom:1rem;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.6rem;">
          <strong style="color:#38bdf8; font-size:0.95rem;">${group.name}</strong>
          <span class="badge badge-gold" style="font-size:0.78rem; font-weight:700;">${group.receiptIds.length} เครื่อง</span>
        </div>
        
        <div class="grid-2col" style="gap:1rem;">
          <div class="form-group" style="margin-bottom:0;">
            <label style="font-size:0.78rem; color:var(--text-muted);">ราคาทุน (บาท)</label>
            <input type="number" id="crb-pprice-${safeKey}" class="form-control" min="0" value="${pPriceVal}" placeholder="0" required ${gIdx === 0 ? 'autofocus' : ''}>
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label style="font-size:0.78rem; color:var(--text-muted);">ราคาขาย (บาท)</label>
            <input type="number" id="crb-sprice-${safeKey}" class="form-control" min="0" value="${sPriceVal}" placeholder="0" required>
          </div>
        </div>
      </div>
    `;
  });

  bodyHtml += `
      <div class="form-group" style="margin-top:1rem;">
        <label for="crb-remarks">หมายเหตุการอนุมัติกลุ่ม (ถ้ามี)</label>
        <textarea id="crb-remarks" class="form-control" rows="2" placeholder="ระบุหมายเหตุหรือข้อสังเกต..."></textarea>
      </div>
    </form>
  `;

  const footerHtml = `
    <button class="btn btn-secondary" onclick="closeModal()">ยกเลิก</button>
    <button class="btn btn-success" onclick="submitBatchConfirmReceipt()"><i class="fa-solid fa-check-double"></i> ยืนยันตั้งราคาทั้งหมด ${groups.length} กลุ่ม</button>
  `;

  openModal(`อนุมัติและตั้งราคาแบบเลือกกลุ่ม (${groups.length} กลุ่ม)`, bodyHtml, footerHtml);
}

async function submitBatchConfirmReceipt() {
  const groups = window.currentBatchGroups;
  if (!groups || groups.length === 0) return;

  const remarks = document.getElementById('crb-remarks') ? document.getElementById('crb-remarks').value : '';

  const items = [];
  for (const group of groups) {
    const pPrice = document.getElementById(`crb-pprice-${group.key}`).value;
    const sPrice = document.getElementById(`crb-sprice-${group.key}`).value;

    if (pPrice === '' || sPrice === '') {
      showToast('กรุณาระบุราคาทุนและราคาขายให้ครบถ้วนทุกกลุ่มสินค้า', 'error');
      return;
    }

    items.push({
      receiptIds: group.receiptIds,
      purchase_price: Number(pPrice),
      selling_price: Number(sPrice)
    });
  }

  try {
    const res = await apiRequest('/stock/receipts/confirm-batch', 'PUT', {
      items,
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

function handleModalPoChange(receiptId) {
  const poSelect = document.getElementById('cr-po-select');
  if (!poSelect) return;
  const poId = poSelect.value;
  
  const pPriceInput = document.getElementById('cr-pprice');
  if (!poId) {
    // Reset or keep empty if desired
    return;
  }

  const receipt = (state.pendingReceiptsCache || []).find(r => r._id === receiptId);
  if (!receipt) return;
  const { brand, model, capacity, color } = receipt.productInfo;

  const pendingPos = window.currentModalPendingPos || [];
  const selectedPo = pendingPos.find(po => po._id === poId);
  if (!selectedPo) return;

  const matchedItem = (selectedPo.items || []).find(item => 
    (item.brand || '').trim().toLowerCase() === (brand || '').trim().toLowerCase() && 
    (item.model || '').trim().toLowerCase() === (model || '').trim().toLowerCase() && 
    (item.capacity || '').trim().toLowerCase() === (capacity || '').trim().toLowerCase() && 
    (item.color || '').trim().toLowerCase() === (color || '').trim().toLowerCase() &&
    (item.imeis || []).length < (item.quantity || 0)
  );

  if (matchedItem) {
    if (pPriceInput) {
      pPriceInput.value = matchedItem.unitPrice;
      showToast(`จับคู่สำเร็จ: โหลดราคาทุน ฿${matchedItem.unitPrice.toLocaleString()} จากใบสั่งซื้อแล้ว`, 'success');
    }
  } else {
    showToast(`ไม่พบสเปกค้างรับของรุ่นนี้ในใบสั่งซื้อที่เลือก`, 'warning');
  }
}

async function openConfirmReceiptModal(receiptId, receiptNumber, productName, purchasePrice, sellingPrice) {
  const pPriceVal = (purchasePrice && purchasePrice > 0) ? purchasePrice : '';
  const sPriceVal = (sellingPrice && sellingPrice > 0) ? sellingPrice : '';

  const receipt = (state.pendingReceiptsCache || []).find(r => r._id === receiptId);
  const branchId = receipt && receipt.branch ? (receipt.branch._id || receipt.branch) : '';

  let poOptionsHtml = '<option value="">-- ไม่เชื่อมโยง (เพิ่มนอกใบสั่งซื้อทั่วไป) --</option>';
  let pendingPos = [];

  if (branchId) {
    try {
      const poRes = await apiRequest(`/purchase-orders?branchId=${branchId}&status=pending_imei`);
      if (poRes.success) {
        pendingPos = poRes.orders || [];
        window.currentModalPendingPos = pendingPos;
        pendingPos.forEach(po => {
          poOptionsHtml += `<option value="${po._id}">${po.orderNumber} (ยอดรวม ฿${(po.totalAmount || 0).toLocaleString()})</option>`;
        });
      }
    } catch (err) {
      console.warn('Unable to load pending POs for matching:', err);
    }
  }

  const bodyHtml = `
    <div style="background:rgba(0,0,0,0.03); border:1px solid var(--border-color); padding:1rem; border-radius:6px; margin-bottom:1.2rem;">
      <div style="font-weight:700; font-size:0.9rem; color:var(--accent-primary); margin-bottom:0.3rem;">
        เลขที่ใบรับสินค้า: ${receiptNumber}
      </div>
      <div style="font-size:1rem; font-weight:800; color:var(--text-main);">
        ${productName}
      </div>
    </div>

    <form id="confirm-receipt-form">
      ${pendingPos.length > 0 ? `
        <div class="form-group" style="margin-bottom:1.2rem;">
          <label for="cr-po-select" style="font-weight:700; color:var(--accent-gold); display:block; margin-bottom:0.3rem;">
            <i class="fa-solid fa-link"></i> เชื่อมโยงใบสั่งซื้อค้างส่ง (Optional)
          </label>
          <select id="cr-po-select" class="form-select" onchange="handleModalPoChange('${receiptId}')">
            ${poOptionsHtml}
          </select>
          <small class="form-text text-muted" style="font-size:0.75rem; display:block; margin-top:0.25rem;">
            ระบุใบสั่งซื้อเพื่อนำ IMEI ไปผูกและปิดใบสั่งซื้ออัติโนมัติ พร้อมอ้างอิงราคาทุนตามใบสั่งซื้อ
          </small>
        </div>
      ` : ''}

      <div class="grid-2col" style="gap:1rem;">
        <div class="form-group">
          <label for="cr-pprice">กำหนดราคาทุน (บาท)</label>
          <input type="number" id="cr-pprice" class="form-control" min="0" value="${pPriceVal}" placeholder="0" required autofocus>
        </div>
        <div class="form-group">
          <label for="cr-sprice">กำหนดราคาขาย (บาท)</label>
          <input type="number" id="cr-sprice" class="form-control" min="0" value="${sPriceVal}" placeholder="0" required>
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

  const poSelect = document.getElementById('cr-po-select');
  const purchaseOrderId = poSelect ? poSelect.value : '';

  if (purchase_price === '' || selling_price === '') {
    showToast('กรุณาระบุทั้งราคาทุนและราคาขาย', 'error');
    return;
  }

  try {
    const res = await apiRequest(`/stock/receipts/${receiptId}/confirm`, 'PUT', {
      purchase_price: Number(purchase_price),
      selling_price: Number(selling_price),
      remarks,
      purchaseOrderId: purchaseOrderId || undefined
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

function thaiBahtText(num) {
  if (num === null || num === undefined || isNaN(num)) return '';
  num = Number(num).toFixed(2);
  const parts = num.split('.');
  const intPart = parts[0];
  const decPart = parts[1];
  
  const digits = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
  const units = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน'];
  
  function convert(part) {
    let result = '';
    const len = part.length;
    for (let i = 0; i < len; i++) {
      const digit = Number(part.charAt(i));
      const pos = len - i - 1;
      if (digit !== 0) {
        let digitWord = digits[digit];
        if (pos % 6 === 1 && digit === 1) {
          digitWord = '';
        } else if (pos % 6 === 1 && digit === 2) {
          digitWord = 'ยี่';
        } else if (pos % 6 === 0 && digit === 1 && i > 0) {
          const prevDigit = Number(part.charAt(i - 1));
          if (prevDigit !== 0 || len === 1) {
            digitWord = 'เอ็ด';
          }
        }
        
        result += digitWord + units[pos % 6];
      }
      if (pos > 0 && pos % 6 === 0 && i < len - 1) {
        result += 'ล้าน';
      }
    }
    return result;
  }

  let text = '';
  const intVal = Number(intPart);
  if (intVal === 0) {
    text += 'ศูนย์บาท';
  } else {
    text += convert(intPart) + 'บาท';
  }

  const decVal = Number(decPart);
  if (decVal === 0) {
    text += 'ถ้วน';
  } else {
    text += convert(decPart) + 'สตางค์';
  }
  return text;
}

async function printGoodsReceiptSlip(receiptId) {
  const receipt = (state.pendingReceiptsCache || []).find(r => r._id === receiptId);
  if (!receipt) {
    showToast('ไม่พบข้อมูลรายการรับสินค้านี้', 'error');
    return;
  }

  // Check if this receipt is linked to a PO
  const poId = receipt.purchaseOrder;
  let poNumber = null;
  if (receipt.remarks && receipt.remarks.includes('ใบสั่งซื้อเลขที่:')) {
    const parts = receipt.remarks.split('ใบสั่งซื้อเลขที่:');
    if (parts[1]) {
      const match = parts[1].match(/BPO-\d+-\d+/);
      if (match) poNumber = match[0];
      else poNumber = parts[1].replace(/[)]/g, '').trim();
    }
  }
  if (!poNumber && receipt.receiptNumber && receipt.receiptNumber.includes('GR-BPO-')) {
    const match = receipt.receiptNumber.match(/BPO-\d+-\d+/);
    if (match) poNumber = match[0];
  }

  if (poId || poNumber) {
    showToast('กำลังดึงข้อมูลใบสั่งซื้อ...', 'info');
    try {
      let order = null;
      if (poId) {
        const poRes = await apiRequest(`/purchase-orders/${poId}`);
        if (poRes.success && poRes.order) {
          order = poRes.order;
        }
      } else if (poNumber) {
        const poRes = await apiRequest(`/purchase-orders?orderNumber=${poNumber}`);
        if (poRes.success && poRes.orders && poRes.orders.length > 0) {
          order = poRes.orders[0];
        }
      }

      if (order) {
        const branchName = order.branch ? order.branch.name : 'ไม่ระบุ';
        const orderedBy = order.orderedByName || (order.orderedBy ? order.orderedBy.fullName || order.orderedBy.username : 'ไม่ระบุ');
        const receivedBy = order.receivedByName || (order.receivedBy ? order.receivedBy.fullName || order.receivedBy.username : 'ไม่ระบุ');
        const orderedDate = order.createdAt ? new Date(order.createdAt).toLocaleString('th-TH') : '-';
        const receivedDate = order.receivedAt ? new Date(order.receivedAt).toLocaleString('th-TH') : '-';
        const approvedBy = receipt.confirmedBy ? (receipt.confirmedBy.fullName || receipt.confirmedBy.username) : 'ไม่ระบุ';
        const scannedBy = receipt.receivedBy ? (receipt.receivedBy.fullName || receipt.receivedBy.username) : 'ไม่ระบุ';

        const printWindow = window.open('', '_blank', 'width=800,height=600');
        
        let itemRowsHtml = '';
        let globalIndex = 1;
        order.items.forEach((item) => {
          const imeis = item.imeis || [];
          const pPrice = item.unitPrice ? '฿' + item.unitPrice.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '-';
          
          if (imeis.length === 0) {
            itemRowsHtml += `
              <tr>
                <td style="text-align: center;">${globalIndex++}</td>
                <td>
                  <strong style="color:#0f172a;">${item.productName}</strong>
                </td>
                <td style="text-align: center;">
                  <span style="font-weight:700; border:1px solid #94a3b8; padding:2px 6px; border-radius:3px; font-size:11px; background:#f1f5f9;">1 เครื่อง</span>
                </td>
                <td style="font-family:monospace; font-size:0.82rem; text-align: center; color:#ef4444; font-weight:700;">
                  ยังไม่ได้รับเครื่อง (No IMEI)
                </td>
                <td style="text-align: right; font-weight:600;">${pPrice}</td>
                <td style="text-align: right; font-weight:600;">${pPrice}</td>
              </tr>
            `;
          } else {
            imeis.forEach((imei) => {
              itemRowsHtml += `
                <tr>
                  <td style="text-align: center;">${globalIndex++}</td>
                  <td>
                    <strong style="color:#0f172a;">${item.productName}</strong>
                  </td>
                  <td style="text-align: center;">
                    <span style="font-weight:700; border:1px solid #94a3b8; padding:2px 6px; border-radius:3px; font-size:11px; background:#f1f5f9;">1 เครื่อง</span>
                  </td>
                  <td style="font-family:monospace; font-size:0.82rem; text-align: center; color:#334155;">
                    ${imei}
                  </td>
                  <td style="text-align: right; font-weight:600;">${pPrice}</td>
                  <td style="text-align: right; font-weight:600;">${pPrice}</td>
                </tr>
              `;
            });
          }
        });

        printWindow.document.write(`
          <html>
            <head>
              <title>ใบรับรองการนำเข้าสินค้าเข้าสต็อก (ใบสั่งซื้อ ${order.orderNumber})</title>
              <style>
                @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700;800&display=swap');
                body {
                  font-family: 'Sarabun', sans-serif;
                  color: #0f172a;
                  background: #fff;
                  padding: 20px;
                  font-size: 13px;
                  line-height: 1.5;
                }
                .info-row {
                  display: flex;
                  justify-content: space-between;
                  margin-bottom: 4px;
                  font-size: 12px;
                }
                .info-label {
                  font-weight: 600;
                  color: #475569;
                }
                .info-value {
                  font-weight: 700;
                  color: #0f172a;
                }
                .product-table {
                  width: 100%;
                  border-collapse: collapse;
                  margin-top: 20px;
                  margin-bottom: 20px;
                }
                .product-table th, .product-table td {
                  border: 1px solid #cbd5e1;
                  padding: 10px;
                  text-align: left;
                }
                .product-table th {
                  background-color: #1e293b;
                  color: #ffffff;
                  font-weight: 700;
                  font-size: 12px;
                }
                .signatures-container {
                  margin-top: 40px;
                  display: grid;
                  grid-template-columns: 1fr 1fr;
                  gap: 30px;
                  text-align: center;
                  align-items: center;
                }
                .signature-box {
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                }
                .signature-line {
                  width: 85%;
                  border-bottom: 1px solid #475569;
                  margin-top: 35px;
                  margin-bottom: 6px;
                }
                .company-stamp {
                  width: 90px;
                  height: 90px;
                  border: 1px dashed #94a3b8;
                  border-radius: 50%;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  font-size: 9px;
                  color: #94a3b8;
                  margin: 0 auto;
                }
                @media print {
                  body {
                    padding: 0;
                  }
                  .no-print {
                    display: none;
                  }
                }
              </style>
            </head>
            <body>
              <!-- Company Header Letterhead -->
              <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:3px double #1e293b; padding-bottom:12px; margin-bottom:20px;">
                <div>
                  <h2 style="margin:0; font-size:22px; font-weight:800; color:#1e293b; letter-spacing:0.5px;">ซิลมีน บานาน่า</h2>
                  <span style="font-size:11px; color:#475569; display:block; margin-top:2px;">สำนักงานใหญ่: 883 ถ.สิโรรส ต.สะเตง อ.เมือง จ.ยะลา 95000</span>
                </div>
                <div style="text-align:right;">
                  <span style="font-size:13px; font-weight:700; color:#64748b; display:block; margin-top:4px;">ใบรับรองการนำเข้าสินค้าเข้าสต็อกสาขา</span>
                </div>
              </div>

              <!-- Info Grid Section -->
              <div style="display:grid; grid-template-columns: 1.1fr 0.9fr; gap:20px; margin-bottom:20px;">
                <div style="border:1px solid #cbd5e1; border-radius:6px; padding:12px; background:#f8fafc;">
                  <h4 style="margin:0 0 8px 0; font-size:13px; font-weight:800; color:#1e293b; border-bottom:1px solid #e2e8f0; padding-bottom:4px;">ข้อมูลคลังสินค้าปลายทาง (Destination Stock)</h4>
                  <div class="info-row"><span class="info-label">สาขาปลายทาง:</span> <span class="info-value" style="color:#0f172a;">${branchName}</span></div>
                  <div class="info-row"><span class="info-label">ผู้ส่งคำสั่งนำเข้า:</span> <span class="info-value">${orderedBy}</span></div>
                  <div class="info-row"><span class="info-label">ผู้รับมอบสินค้าเข้าคลังสาขา:</span> <span class="info-value">${scannedBy}</span></div>
                  <div class="info-row"><span class="info-label">หมายเหตุคัดย่อ:</span> <span class="info-value" style="color:#475569; font-weight:normal;">${order.note || '-'}</span></div>
                </div>
                <div style="border:1px solid #cbd5e1; border-radius:6px; padding:12px; background:#f8fafc;">
                  <h4 style="margin:0 0 8px 0; font-size:13px; font-weight:800; color:#1e293b; border-bottom:1px solid #e2e8f0; padding-bottom:4px;">รายละเอียดเอกสาร (Document Reference)</h4>
                  <div class="info-row"><span class="info-label">เลขที่ใบสั่งซื้อ (PO Number):</span> <span class="info-value" style="font-family:monospace; font-weight:800; color:#0f172a;">${order.orderNumber}</span></div>
                  <div class="info-row"><span class="info-label">วันที่ส่งคำสั่งสั่งซื้อ:</span> <span class="info-value">${orderedDate}</span></div>
                  <div class="info-row"><span class="info-label">วันที่ตรวจอนุมัติเข้าสต็อก:</span> <span class="info-value">${receivedDate}</span></div>
                  <div class="info-row"><span class="info-label">สถานะคลังสินค้า:</span> <span class="info-value" style="color:#16a34a; font-weight:800;"><i class="fa-solid fa-circle-check"></i> นำเข้าสต็อกเรียบร้อยแล้ว</span></div>
                </div>
              </div>

              <!-- Product List Table -->
              <table class="product-table">
                <thead>
                  <tr>
                    <th style="width: 40px; text-align: center;">ลำดับ</th>
                    <th>สินค้า</th>
                    <th style="width: 80px; text-align: center;">จำนวน</th>
                    <th>หมายเลข IMEI</th>
                    <th style="width: 110px; text-align: right;">ราคาต่อหน่วย</th>
                    <th style="width: 110px; text-align: right;">ราคารวม</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemRowsHtml}
                </tbody>
              </table>

              <!-- Totals Box Section -->
              <div style="display:flex; justify-content:space-between; align-items:stretch; margin-top:20px; margin-bottom:40px; gap:20px;">
                <div style="flex:1; border:1px solid #cbd5e1; border-radius:6px; padding:12px; display:flex; align-items:center; background:#f8fafc;">
                  <div>
                    <span style="font-size:11px; color:#64748b; font-weight:600; display:block; margin-bottom:4px;">ตัวอักษรยอดเงินรวมสุทธิ (Total in Thai Baht)</span>
                    <strong style="font-size:13px; color:#1e293b;">( ${thaiBahtText(order.totalAmount)} )</strong>
                  </div>
                </div>
                <div style="width:280px; border:1px solid #cbd5e1; border-radius:6px; padding:12px; background:#f8fafc; display:flex; flex-direction:column; gap:4px;">
                  <div style="display:flex; justify-content:space-between; font-size:12px; color:#475569;">
                    <span>ยอดรวมก่อนภาษี (Sub Total):</span>
                    <span>฿${(order.totalAmount / 1.07).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                  </div>
                  <div style="display:flex; justify-content:space-between; font-size:12px; color:#475569; border-bottom:1px dashed #cbd5e1; padding-bottom:4px; margin-bottom:4px;">
                    <span>ภาษีมูลค่าเพิ่ม 7% (VAT 7%):</span>
                    <span>฿${(order.totalAmount - (order.totalAmount / 1.07)).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                  </div>
                  <div style="display:flex; justify-content:space-between; font-size:13px; font-weight:800; color:#1e293b;">
                    <span>ยอดรวมเงินสุทธิ (Net Total):</span>
                    <span style="font-size:16px; color:#0f172a;">฿${(order.totalAmount || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                  </div>
                </div>
              </div>

              <!-- Signatures Box Section -->
              <div class="signatures-container">
                <div class="signature-box">
                  <span class="info-label">พนักงานผู้รับของสาขา / ผู้สแกน</span>
                  <div class="signature-line"></div>
                  <span>( ${scannedBy} )</span>
                  <span style="font-size: 11px; color: #475569; margin-top: 4px;">ผู้รับมอบสินค้าเข้าคลังสาขา</span>
                </div>
                
                <div class="signature-box">
                  <span class="info-label">ผู้อนุมัตินำเข้าคลัง / ผู้ตั้งราคา</span>
                  <div class="signature-line"></div>
                  <span>( ${approvedBy} )</span>
                  <span style="font-size: 11px; color: #475569; margin-top: 4px;">เจ้าหน้าที่อนุมัติส่วนกลาง</span>
                </div>
              </div>
            </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
        }, 250);
      }
    } catch (poErr) {
      showToast('ไม่สามารถดึงข้อมูลใบสั่งซื้อสำหรับพิมพ์ได้: ' + poErr.message, 'error');
    }
    return;
  }

  // Fallback: If no PO is linked, print as single item receipt
  let poNumberText = 'ไม่มี (นำเข้านอกใบสั่งซื้อ)';
  if (receipt.remarks && receipt.remarks.includes('ใบสั่งซื้อเลขที่:')) {
    const parts = receipt.remarks.split('ใบสั่งซื้อเลขที่:');
    if (parts[1]) {
      const match = parts[1].match(/BPO-\d+-\d+/);
      if (match) poNumberText = match[0];
      else poNumberText = parts[1].replace(/[)]/g, '').trim();
    }
  }

  const p = receipt.productInfo || {};
  const branchName = receipt.branch ? receipt.branch.name : 'ไม่ระบุ';
  const scannedBy = receipt.receivedBy ? (receipt.receivedBy.fullName || receipt.receivedBy.username) : 'ไม่ระบุ';
  const approvedBy = receipt.confirmedBy ? (receipt.confirmedBy.fullName || receipt.confirmedBy.username) : 'ไม่ระบุ';
  const scannedDate = receipt.createdAt ? new Date(receipt.createdAt).toLocaleString('th-TH') : '-';
  const approvedDate = receipt.confirmedAt ? new Date(receipt.confirmedAt).toLocaleString('th-TH') : '-';
  const purchasePrice = receipt.purchase_price ? '฿' + receipt.purchase_price.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '-';
  const sellingPrice = receipt.selling_price ? '฿' + receipt.selling_price.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '-';
  const imei = (receipt.imeiSerials && receipt.imeiSerials[0]) || '-';

  const printWindow = window.open('', '_blank', 'width=800,height=600');
  printWindow.document.write(`
    <html>
      <head>
        <title>ใบนำเข้าสินค้าเข้าสต็อก - ${receipt.receiptNumber}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700;800&display=swap');
          body {
            font-family: 'Sarabun', sans-serif;
            color: #0f172a;
            background: #fff;
            padding: 20px;
            font-size: 13px;
            line-height: 1.5;
          }
          .info-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 4px;
            font-size: 12px;
          }
          .info-label {
            font-weight: 600;
            color: #475569;
          }
          .info-value {
            font-weight: 700;
            color: #0f172a;
          }
          .product-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
            margin-bottom: 20px;
          }
          .product-table th, .product-table td {
            border: 1px solid #cbd5e1;
            padding: 10px;
            text-align: left;
          }
          .product-table th {
            background-color: #1e293b;
            color: #ffffff;
            font-weight: 700;
            font-size: 12px;
          }
          .signatures-container {
            margin-top: 40px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
            text-align: center;
            align-items: center;
          }
          .signature-box {
            display: flex;
            flex-direction: column;
            align-items: center;
          }
          .signature-line {
            width: 85%;
            border-bottom: 1px solid #475569;
            margin-top: 35px;
            margin-bottom: 6px;
          }
          .company-stamp {
            width: 90px;
            height: 90px;
            border: 1px dashed #94a3b8;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 9px;
            color: #94a3b8;
            margin: 0 auto;
          }
          @media print {
            body {
              padding: 0;
            }
            .no-print {
              display: none;
            }
          }
        </style>
      </head>
      <body>
        <!-- Company Header Letterhead -->
        <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:3px double #1e293b; padding-bottom:12px; margin-bottom:20px;">
          <div>
            <h2 style="margin:0; font-size:22px; font-weight:800; color:#1e293b; letter-spacing:0.5px;">บริษัท ซิลมีน บานาน่า จำกัด</h2>
            <span style="font-size:11px; color:#475569; display:block; margin-top:2px;">สำนักงานใหญ่: 123/45 ถนนราชดำเนิน แขวงบวรนิเวศ เขตพระนคร กรุงเทพฯ 10200</span>
            <span style="font-size:11px; color:#475569; display:block;">โทร: 02-123-4567 | อีเมล: contact@silminbanana.com | เลขประจำตัวผู้เสียภาษี: 0105569000123</span>
          </div>
          <div style="text-align:right;">
            <h1 style="margin:0; font-size:22px; font-weight:800; color:#1e293b;">GOODS IMPORT SLIP</h1>
            <span style="font-size:13px; font-weight:700; color:#64748b; display:block; margin-top:4px;">ใบรับรองการนำเข้าสินค้าเข้าสต็อกสาขา</span>
          </div>
        </div>

        <div style="display:grid; grid-template-columns: 1.1fr 0.9fr; gap:20px; margin-bottom:20px;">
          <div style="border:1px solid #cbd5e1; border-radius:6px; padding:12px; background:#f8fafc;">
            <h4 style="margin:0 0 8px 0; font-size:13px; font-weight:800; color:#1e293b; border-bottom:1px solid #e2e8f0; padding-bottom:4px;">ข้อมูลคลังสินค้าปลายทาง (Destination Stock)</h4>
            <div class="info-row"><span class="info-label">สาขาปลายทาง:</span> <span class="info-value" style="color:#0f172a;">${branchName}</span></div>
            <div class="info-row"><span class="info-label">ผู้ส่งคำสั่งนำเข้า:</span> <span class="info-value">${scannedBy}</span></div>
            <div class="info-row"><span class="info-label">ผู้รับมอบสินค้าเข้าคลังสาขา:</span> <span class="info-value">${approvedBy}</span></div>
            <div class="info-row"><span class="info-label">หมายเหตุอนุมัติ:</span> <span class="info-value" style="color:#475569; font-weight:normal;">${receipt.remarks || '-'}</span></div>
          </div>
          <div style="border:1px solid #cbd5e1; border-radius:6px; padding:12px; background:#f8fafc;">
            <h4 style="margin:0 0 8px 0; font-size:13px; font-weight:800; color:#1e293b; border-bottom:1px solid #e2e8f0; padding-bottom:4px;">รายละเอียดเอกสาร (Document Reference)</h4>
            <div class="info-row"><span class="info-label">เลขที่ใบรับสินค้า:</span> <span class="info-value" style="font-family:monospace; font-weight:800; color:#0f172a;">${receipt.receiptNumber}</span></div>
            <div class="info-row"><span class="info-label">วันที่ส่งรายการสแกน:</span> <span class="info-value">${scannedDate}</span></div>
            <div class="info-row"><span class="info-label">วันที่ตรวจอนุมัติเข้าสต็อก:</span> <span class="info-value">${approvedDate}</span></div>
            <div class="info-row"><span class="info-label">อ้างอิงใบสั่งซื้อ:</span> <span class="info-value" style="font-weight:700;">${poNumberText}</span></div>
          </div>
        </div>

        <table class="product-table">
          <thead>
            <tr>
              <th style="width: 50px; text-align: center;">ลำดับ</th>
              <th>รายละเอียดสเปกอุปกรณ์ (Item Details)</th>
              <th style="width: 80px; text-align: center;">จำนวน</th>
              <th>หมายเลข IMEI ของเครื่องที่นำเข้า</th>
              <th style="width: 110px; text-align: right;">ราคาทุน</th>
              <th style="width: 110px; text-align: right;">ราคาขาย</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="text-align: center;">1</td>
              <td>
                <strong style="color:#0f172a;">${p.name}</strong>
              </td>
              <td style="text-align: center;">
                <span style="font-weight:700; border:1px solid #94a3b8; padding:2px 6px; border-radius:3px; font-size:11px; background:#f1f5f9;">1 เครื่อง</span>
              </td>
              <td style="font-family:monospace; font-size:0.82rem; text-align: center; color:#334155;">${imei}</td>
              <td style="text-align: right; font-weight:600;">${purchasePrice}</td>
              <td style="text-align: right; font-weight:600;">${sellingPrice}</td>
            </tr>
          </tbody>
        </table>

        <!-- Totals Box Section for Single Slip -->
        <div style="display:flex; justify-content:space-between; align-items:stretch; margin-top:20px; margin-bottom:40px; gap:20px;">
          <div style="flex:1; border:1px solid #cbd5e1; border-radius:6px; padding:12px; display:flex; align-items:center; background:#f8fafc;">
            <div>
              <span style="font-size:11px; color:#64748b; font-weight:600; display:block; margin-bottom:4px;">ตัวอักษรยอดเงินรวมทุน (Total Cost in Thai Baht)</span>
              <strong style="font-size:13px; color:#1e293b;">( ${thaiBahtText(receipt.purchase_price || 0)} )</strong>
            </div>
          </div>
          <div style="width:280px; border:1px solid #cbd5e1; border-radius:6px; padding:12px; background:#f8fafc; display:flex; flex-direction:column; gap:4px;">
            <div style="display:flex; justify-content:space-between; font-size:13px; font-weight:800; color:#1e293b;">
              <span>ยอดรวมเงินทุนสุทธิ (Net Cost):</span>
              <span style="font-size:16px; color:#0f172a;">${purchasePrice}</span>
            </div>
          </div>
        </div>

        <div class="signatures-container">
          <div class="signature-box">
            <span class="info-label">พนักงานผู้นำเข้า / ผู้ส่งมอบ</span>
            <div class="signature-line"></div>
            <span>( ${scannedBy} )</span>
            <span style="font-size: 11px; color: #475569; margin-top: 4px;">ผู้สแกนรับเข้าสต็อกหน้าร้าน</span>
          </div>



          <div class="signature-box">
            <span class="info-label">ผู้อนุมัตินำเข้าคลัง / ผู้ตั้งราคา</span>
            <div class="signature-line"></div>
            <span>( ${approvedBy} )</span>
            <span style="font-size: 11px; color: #475569; margin-top: 4px;">เจ้าหน้าที่อนุมัติส่วนกลาง</span>
          </div>
        </div>

        <div style="margin-top: 40px; text-align: center; font-size: 11px; color: #64748b;" class="no-print">
          พิมพ์จากระบบ Silmin Banana Stock Management System เมื่อวันที่ ${new Date().toLocaleString('th-TH')}
        </div>
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 250);
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
            ${transfers.map(t => {
              const userBranchId = state.user && state.user.branch ? String(state.user.branch._id || state.user.branch) : '';
              const toBranchId = String(t.toBranch ? (t.toBranch._id || t.toBranch) : '');
              const fromBranchId = String(t.fromBranch ? (t.fromBranch._id || t.fromBranch) : '');
              
              const isToBranch = toBranchId === userBranchId;
              const isFromBranch = fromBranchId === userBranchId;
              const isAdmin = state.user && (state.user ? state.user.role : 'admin') === 'admin';

              return `
                <tr class="transfer-history-row">
                  <td><strong>${t.transferNumber}</strong></td>
                  <td>${t.fromBranch ? t.fromBranch.name : 'ไม่ระบุ'}</td>
                  <td>${t.toBranch ? t.toBranch.name : 'ไม่ระบุ'}</td>
                  <td>${t.items ? t.items.reduce((acc, i) => acc + i.quantity, 0) : 0} ชิ้น</td>
                  <td>
                    <span class="badge badge-${t.status === 'completed' ? 'green' : t.status === 'rejected' ? 'red' : t.status === 'in_transit' ? 'yellow' : 'gray'}">
                      ${t.status === 'completed' ? 'โอนย้ายสำเร็จ' : t.status === 'rejected' ? 'ปฏิเสธ/ยกเลิก' : t.status === 'in_transit' ? 'อยู่ระหว่างจัดส่ง (รอปลายทางกดรับ)' : t.status}
                    </span>
                  </td>
                  <td>${new Date(t.createdAt).toLocaleDateString('th-TH')}</td>
                  <td>
                    <button class="btn btn-secondary btn-sm" onclick="printTransferDoc('${t._id}')">
                      <i class="fa-solid fa-print"></i> พิมพ์เอกสาร
                    </button>
                    ${t.status === 'in_transit' && (isAdmin || isToBranch) ? `
                      <button class="btn btn-success btn-sm" onclick="updateTransferState('${t._id}', 'completed')">
                        <i class="fa-solid fa-check"></i> ยืนยันรับสินค้า
                      </button>
                      <button class="btn btn-danger btn-sm" onclick="updateTransferState('${t._id}', 'rejected')">
                        <i class="fa-solid fa-ban"></i> ปฏิเสธรับสินค้า
                      </button>
                    ` : ''}
                    ${t.status === 'in_transit' && (isAdmin || isFromBranch) ? `
                      <button class="btn btn-danger btn-sm" onclick="updateTransferState('${t._id}', 'rejected')">
                        <i class="fa-solid fa-xmark"></i> ยกเลิกส่ง
                      </button>
                    ` : ''}
                  </td>
                </tr>
              `;
            }).join('')}
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
      <div id="printable-voucher" class="printable-area" style="background:#fff; color:#000; padding:2.2rem; border:1px solid #ccc; border-radius:8px; font-family:'Sarabun','Prompt',sans-serif; max-width:800px; margin:0 auto 3rem auto; box-shadow:0 0 10px rgba(0,0,0,0.05); display:flex; flex-direction:column; min-height:auto; justify-content:flex-start; box-sizing:border-box;">
        
        <!-- Top & Middle Content Area -->
        <div>
          <!-- Header Section with Logo & Company Info -->
          <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:3px double #000; padding-bottom:1.2rem; margin-bottom:1.5rem;">
            <div style="display:flex; gap:1.2rem; align-items:center;">
              <img src="/image/icon_silminbanana.png" style="height:70px; width:auto; object-fit:contain;" alt="Logo">
              <div>
                <h2 style="font-size:1.35rem; font-weight:800; color:#000; margin:0; line-height:1.2;">ซิลมีน บานาน่า</h2>
                <p style="font-size:0.82rem; color:#444; margin:0.3rem 0 0 0; line-height:1.4;">
                  สำนักงานใหญ่: 883 ถ.สิโรรส ต.สะเตง อ.เมือง จ.ยะลา 95000<br>
                  เลขประจำตัวผู้เสียภาษี: 1930400058472
                </p>
              </div>
            </div>
            <div style="text-align:right;">
              <span style="display:inline-block; border:1px solid #000; padding:0.4rem 0.8rem; font-weight:800; font-size:1.05rem; background:#f8fafc; margin-bottom:0.4rem; border-radius:4px;">
                ใบโอนย้ายสินค้าระหว่างสาขา
              </span>
              <div style="font-size:0.85rem; color:#333; line-height:1.5;">
                <div><strong>เลขที่เอกสาร:</strong> ${doc.transferNumber}</div>
                <div><strong>วันที่ออกเอกสาร:</strong> ${new Date(doc.date).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
                <div><strong>สถานะ:</strong> <span style="font-weight:700;">${doc.status === 'completed' ? 'โอนย้ายสำเร็จ' : doc.status === 'rejected' ? 'ปฏิเสธ/ยกเลิก' : 'อยู่ระหว่างจัดส่ง'}</span></div>
              </div>
            </div>
          </div>

          <!-- Branches Details Grid -->
          <div class="grid-2col" style="gap:1.5rem; margin-bottom:1.5rem;">
            <div style="border:1px solid #ccc; padding:0.9rem; border-radius:6px; background:#fafafa;">
              <div style="font-weight:800; font-size:0.9rem; border-bottom:1px solid #eee; padding-bottom:0.3rem; margin-bottom:0.5rem; color:#0284c7;">
                <i class="fa-solid fa-arrow-up-from-bracket"></i> สาขาต้นทาง (ผู้จัดส่ง)
              </div>
              <table style="width:100%; font-size:0.82rem; border-collapse:collapse; line-height:1.5; color:#000;">
                <tr><td style="width:75px; color:#555;">สาขา:</td><td><strong>${doc.fromBranch ? doc.fromBranch.name : 'ไม่ระบุ'} (${doc.fromBranch ? doc.fromBranch.code : '-'})</strong></td></tr>
                <tr><td style="color:#555; valign:top;">ที่อยู่:</td><td>${doc.fromBranch ? doc.fromBranch.address || '-' : '-'}</td></tr>
                <tr><td style="color:#555;">เบอร์โทร:</td><td>${doc.fromBranch ? doc.fromBranch.phone || '-' : '-'}</td></tr>
                <tr><td style="color:#555;">ผู้จัดส่ง:</td><td>${doc.requestedBy || '-'}</td></tr>
              </table>
            </div>
            
            <div style="border:1px solid #ccc; padding:0.9rem; border-radius:6px; background:#fafafa;">
              <div style="font-weight:800; font-size:0.9rem; border-bottom:1px solid #eee; padding-bottom:0.3rem; margin-bottom:0.5rem; color:#16a34a;">
                <i class="fa-solid fa-arrow-down-to-bracket"></i> สาขาปลายทาง (ผู้รับ)
              </div>
              <table style="width:100%; font-size:0.82rem; border-collapse:collapse; line-height:1.5; color:#000;">
                <tr><td style="width:75px; color:#555;">สาขา:</td><td><strong>${doc.toBranch ? doc.toBranch.name : 'ไม่ระบุ'} (${doc.toBranch ? doc.toBranch.code : '-'})</strong></td></tr>
                <tr><td style="color:#555; valign:top;">ที่อยู่:</td><td>${doc.toBranch ? doc.toBranch.address || '-' : '-'}</td></tr>
                <tr><td style="color:#555;">เบอร์โทร:</td><td>${doc.toBranch ? doc.toBranch.phone || '-' : '-'}</td></tr>
                <tr><td style="color:#555;">ผู้รับมอบ:</td><td>${doc.approvedBy || '-'}</td></tr>
              </table>
            </div>
          </div>

          <!-- Items Table -->
          <table style="width:100%; border-collapse:collapse; font-size:0.85rem; margin-bottom:1.5rem;">
            <thead>
              <tr style="background:#e5e7eb; color:#000; border-top:1px solid #000; border-bottom:1px solid #000;">
                <th style="padding:10px 8px; text-align:center; border-bottom:1px solid #000; width:50px;">ลำดับ</th>
                <th style="padding:10px 8px; text-align:left; border-bottom:1px solid #000;">รายการสินค้า</th>
                <th style="padding:10px 8px; text-align:left; border-bottom:1px solid #000;">หมายเลข IMEI / ซีเรียล</th>
                <th style="padding:10px 8px; text-align:right; border-bottom:1px solid #000; width:80px;">จำนวน (ชิ้น)</th>
              </tr>
            </thead>
            <tbody>
              ${doc.items.map((item, idx) => {
                const imeiText = (item.imei_serials && item.imei_serials.length > 0) ? item.imei_serials.join(', ') : (item.imei || '-');
                return `
                  <tr style="color:#000; border-bottom:1px solid #eee;">
                    <td style="padding:10px 8px; text-align:center; color:#555;">${idx + 1}</td>
                    <td style="padding:10px 8px;"><strong>${item.productName || (item.product ? item.product.name : 'สินค้าทั่วไป')}</strong></td>
                    <td style="padding:10px 8px; font-family:monospace; font-weight:700; color:#000; font-size:0.92rem;">${imeiText}</td>
                    <td style="padding:10px 8px; text-align:right;"><strong>${item.quantity}</strong></td>
                  </tr>
                `;
              }).join('')}
            </tbody>
            <tfoot>
              <tr style="background:#f9fafb; font-weight:800; border-bottom:2px solid #000; color:#000;">
                <td colspan="3" style="padding:10px 8px; text-align:right;">จำนวนรวมทั้งสิ้น:</td>
                <td style="padding:10px 8px; text-align:right;">${doc.items.reduce((acc, i) => acc + i.quantity, 0)} ชิ้น</td>
              </tr>
            </tfoot>
          </table>

          <!-- Remarks Section -->
          ${doc.remarks ? `
            <div style="background:#fffbeb; border:1px solid #fef3c7; border-radius:6px; padding:0.8rem; font-size:0.82rem; margin-bottom:2rem; color:#78350f;">
              <strong>หมายเหตุการโอนย้าย:</strong> ${doc.remarks}
            </div>
          ` : ''}
        </div>

        <!-- Signature Section (Always Pushed to Bottom of Page) -->
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:2.5rem; text-align:center; font-size:0.85rem; color:#000; margin-top:3rem; padding-top:1.5rem; border-top:1px dashed #ccc;">
          <div style="border:1px solid #ccc; padding:1.5rem 1rem; border-radius:6px; background:#fafafa; display:flex; flex-direction:column; align-items:center; justify-content:center;">
            <div style="font-weight:700; margin-bottom:2rem;">ผู้จัดส่งสินค้า (สาขาต้นทาง)</div>
            <div style="width:200px; border-bottom:1px dashed #000; margin-bottom:0.5rem;"></div>
            <div>( ${doc.requestedBy || '____________________________________'} )</div>
            <div style="font-size:0.78rem; color:#555; margin-top:0.4rem;">วันที่ _____ / _____ / ________</div>
          </div>
          
          <div style="border:1px solid #ccc; padding:1.5rem 1rem; border-radius:6px; background:#fafafa; display:flex; flex-direction:column; align-items:center; justify-content:center;">
            <div style="font-weight:700; margin-bottom:2rem;">ผู้รับสินค้า</div>
            <div style="width:200px; border-bottom:1px dashed #000; margin-bottom:0.5rem;"></div>
            <div>( ${doc.status === 'completed' && doc.approvedBy ? doc.approvedBy : '____________________________________'} )</div>
            <div style="font-size:0.78rem; color:#555; margin-top:0.4rem;">วันที่ _____ / _____ / ________</div>
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

    const canAddProduct = ['admin', 'hq_stock_staff', 'purchase_staff'].includes((state.user ? state.user.role : 'admin'));

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
      <div class="grid-2col" style="gap:1rem;">
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

      <div class="grid-2col" style="gap:1rem;">
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

      <div class="grid-2col" style="gap:1rem;">
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
        <div class="grid-2col" style="gap:1rem;">
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

        <div class="grid-2col" style="gap:1rem;">
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

        <div class="grid-2col" style="gap:1rem;">
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

    const isAdmin = (state.user ? state.user.role : 'admin') === 'admin';

    container.innerHTML = `
      <div class="card" style="margin-bottom:1.5rem; display:flex; justify-content:space-between; align-items:center;">
        <div>
          <h3 style="font-size:1.1rem; font-weight:700;">จัดการข้อมูลสาขา</h3>
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
              <th>รหัสสาขา</th>
              <th>ชื่อสาขา</th>
              <th>ที่ตั้ง / เบอร์ติดต่อ</th>
              <th>สถานะ</th>
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
    const [usersRes, branchRes, rolesRes] = await Promise.all([
      apiRequest('/users'),
      apiRequest('/branches'),
      apiRequest('/roles')
    ]);

    const users = usersRes.users || [];
    const branches = branchRes.branches || [];
    const roles = rolesRes.roles || [];
    window.masterRolesCache = roles;

    const isAdmin = state.user && (state.user ? state.user.role : 'admin') === 'admin';

    container.innerHTML = `
      <div class="card" style="margin-bottom:1.5rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem;">
        <div>
          <h3 style="font-size:1.15rem; font-weight:800; display:flex; align-items:center; gap:0.5rem; color:var(--text-main);">
            <i class="fa-solid fa-users-gear" style="color:var(--accent-primary);"></i> จัดการพนักงาน (${users.length} คน)
          </h3>
          <p style="font-size:0.82rem; color:var(--text-muted);">รายชื่อพนักงาน กำหนดตำแหน่งสิทธิ์การมองเห็นเมนู และเลือกสาขาประจำ</p>
        </div>
        ${isAdmin ? `
          <button class="btn btn-primary" id="add-new-emp-btn" style="font-weight:700;"><i class="fa-solid fa-user-plus"></i> + เพิ่มพนักงานใหม่</button>
        ` : ''}
      </div>

      <!-- Employee Filters Toolbar -->
      <div style="display:flex; justify-content:flex-end; align-items:center; gap:0.8rem; flex-wrap:wrap; margin-bottom:1rem; background:rgba(0,0,0,0.025); padding:0.6rem; border-radius:6px; border:1px solid var(--border-color);">
        <div style="display:flex; align-items:center; gap:0.3rem;">
          <label style="font-size:0.75rem; color:var(--text-muted); font-weight:600;">สาขาประจำ:</label>
          <select id="emp-branch-filter" class="form-select" style="width:auto; font-size:0.78rem; padding:0.2rem 0.4rem; height:auto; min-height:auto;" onchange="filterEmployeeTable()">
            <option value="">-- ทุกสาขา --</option>
            <option value="hq">ส่วนกลาง (สำนักงานใหญ่)</option>
            ${branches.map(b => `<option value="${b._id}">${b.name}</option>`).join('')}
          </select>
        </div>
        <div style="display:flex; align-items:center; gap:0.3rem;">
          <label style="font-size:0.75rem; color:var(--text-muted); font-weight:600;">ตำแหน่ง:</label>
          <select id="emp-role-filter" class="form-select" style="width:auto; font-size:0.78rem; padding:0.2rem 0.4rem; height:auto; min-height:auto;" onchange="filterEmployeeTable()">
            <option value="">-- ทุกตำแหน่ง --</option>
            ${roles.map(r => `<option value="${r.code}">${r.name}</option>`).join('')}
          </select>
        </div>
        <input type="text" id="emp-search-input" class="form-control" placeholder="ค้นหาชื่อ, รหัสพนักงาน, อีเมล..." style="width:240px; font-size:0.78rem; padding:0.2rem 0.4rem;" onkeyup="filterEmployeeTable()">
      </div>

      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>รหัสพนักงาน</th>
              <th>ชื่อ-นามสกุล / อีเมล</th>
              <th>ตำแหน่งงาน (Role)</th>
              <th>สาขาประจำ</th>
              <th>สถานะ</th>
              ${isAdmin ? `<th style="text-align:center;">การจัดการ</th>` : ''}
            </tr>
          </thead>
          <tbody>
            ${users.length === 0 ? `<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:2rem;">ไม่พบข้อมูลพนักงานในระบบ</td></tr>` : ''}
            ${users.map(u => {
              const userBranchId = u.branch ? (u.branch._id || u.branch) : 'hq';
              const searchStr = (u.fullName + ' ' + u.username + ' ' + (u.empId || '') + ' ' + u.email + ' ' + (u.branch ? u.branch.name : 'ส่วนกลาง')).toLowerCase();
              return `
                <tr class="emp-row" data-search="${searchStr}" data-branch-id="${userBranchId}" data-role="${u.role}">
                  <td><strong style="color:var(--accent-secondary); font-family:monospace;">${u.empId || 'EMP-' + u._id.slice(-4)}</strong></td>
                  <td>
                    <strong style="color:var(--text-main);">${u.fullName || u.username}</strong><br>
                    <span style="font-size:0.78rem; color:var(--text-muted);">${u.email}</span>
                  </td>
                  <td>
                    <span class="badge badge-purple" style="font-size:0.8rem; font-weight:700;">
                      <i class="fa-solid fa-user-shield"></i> ${formatRoleName(u.role, roles)}
                    </span>
                  </td>
                  <td><strong>${u.branch ? u.branch.name : 'ส่วนกลาง (สำนักงานใหญ่)'}</strong></td>
                  <td>
                    <span class="badge badge-${u.isActive ? 'green' : 'red'}">
                      ${u.isActive ? 'ปกติ' : 'ถูกระงับ'}
                    </span>
                  </td>
                  ${isAdmin ? `
                    <td style="text-align:center;">
                      <button class="btn btn-warning btn-sm" style="font-weight:700; font-size:0.78rem; padding:0.25rem 0.6rem;" onclick="openEditEmpModal('${u._id}', '${u.fullName || u.username}', '${u.role}', '${u.branch ? u.branch._id : ''}', ${u.isActive})">
                        <i class="fa-solid fa-pen-to-square"></i> แก้ไข
                      </button>
                    </td>
                  ` : ''}
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;

    if (isAdmin) {
      const addBtn = document.getElementById('add-new-emp-btn');
      if (addBtn) {
        addBtn.onclick = () => openAddEmpModal(branches, roles);
      }
    }
  } catch (err) {
    container.innerHTML = `<div style="color:#ef4444; padding:2rem;">เกิดข้อผิดพลาดในการโหลดข้อมูลพนักงาน: ${err.message}</div>`;
  }
}

function filterEmployeeTable() {
  const query = document.getElementById('emp-search-input') ? document.getElementById('emp-search-input').value.toLowerCase().trim() : '';
  const branchFilter = document.getElementById('emp-branch-filter') ? document.getElementById('emp-branch-filter').value : '';
  const roleFilter = document.getElementById('emp-role-filter') ? document.getElementById('emp-role-filter').value : '';

  document.querySelectorAll('.emp-row').forEach(row => {
    const searchData = row.getAttribute('data-search') || '';
    const rowBranchId = row.getAttribute('data-branch-id') || '';
    const rowRole = row.getAttribute('data-role') || '';
    
    let matchSearch = searchData.includes(query);
    let matchBranch = true;
    let matchRole = true;

    if (branchFilter && rowBranchId !== branchFilter) matchBranch = false;
    if (roleFilter && rowRole !== roleFilter) matchRole = false;

    if (matchSearch && matchBranch && matchRole) {
      row.style.display = '';
    } else {
      row.style.display = 'none';
    }
  });
}

async function openAddEmpModal(branchesList = [], rolesList = []) {
  const branches = branchesList.length > 0 ? branchesList : (state.masterOptions.branches || []);
  let roles = rolesList;

  if (!roles || roles.length === 0) {
    if (window.masterRolesCache && window.masterRolesCache.length > 0) {
      roles = window.masterRolesCache;
    } else {
      try {
        const res = await apiRequest('/roles');
        roles = res.roles || [];
        window.masterRolesCache = roles;
      } catch (e) {}
    }
  }

  const defaultOptions = [
    { code: 'admin', name: 'ผู้ดูแลระบบสูงสุด (Admin)' },
    { code: 'branch_staff', name: 'พนักงานประจำสาขา (Branch Staff)' },
    { code: 'technical_staff', name: 'ช่างเทคนิค (Technical Staff)' },
    { code: 'purchase_staff', name: 'พนักงานฝ่ายจัดซื้อ (Purchasing Staff)' },
    { code: 'hq_stock_staff', name: 'พนักงานคลังสินค้าส่วนกลาง (HQ Stock)' }
  ];

  const roleOptions = (roles && roles.length > 0) ? roles : defaultOptions;

  const bodyHtml = `
    <form id="new-emp-form" onsubmit="event.preventDefault(); submitAddEmp();">
      <div class="grid-2col" style="gap:1rem;">
        <div class="form-group">
          <label for="me-empid" style="font-weight:700;">รหัสพนักงาน (Emp ID)</label>
          <input type="text" id="me-empid" class="form-control" placeholder="เช่น EMP-0010">
        </div>
        <div class="form-group">
          <label for="me-fullname" style="font-weight:700;">ชื่อ-นามสกุล (Full Name) <span style="color:#ef4444;">*</span></label>
          <input type="text" id="me-fullname" class="form-control" placeholder="เช่น นายประเสริฐ สินค้าดี" required style="font-weight:700;">
        </div>
      </div>

      <div class="grid-2col" style="gap:1rem;">
        <div class="form-group">
          <label for="me-username" style="font-weight:700;">ชื่อผู้ใช้งาน (Username สำหรับล็อกอิน) <span style="color:#ef4444;">*</span></label>
          <input type="text" id="me-username" class="form-control" placeholder="เช่น prasert.s" required style="font-weight:700;">
        </div>
        <div class="form-group">
          <label for="me-email" style="font-weight:700;">อีเมล (Email) <span style="color:#ef4444;">*</span></label>
          <input type="email" id="me-email" class="form-control" placeholder="prasert@pos.com" required style="font-weight:700;">
        </div>
      </div>

      <div class="form-group">
        <label for="me-password" style="font-weight:700;">รหัสผ่าน (Password) <span style="color:#ef4444;">*</span></label>
        <input type="password" id="me-password" class="form-control" placeholder="••••••••" required style="font-weight:700;">
      </div>

      <div class="form-group">
        <label for="me-role" style="font-weight:700; color:var(--accent-primary);">
          <i class="fa-solid fa-user-shield"></i> เลือกตำแหน่งงาน (อ้างอิงจากระบบจัดการสิทธิ์และตำแหน่ง) <span style="color:#ef4444;">*</span>
        </label>
        <select id="me-role" class="form-select" required style="font-weight:700; border:1px solid var(--accent-primary);">
          ${roleOptions.map(r => `<option value="${r.code}">${r.name}</option>`).join('')}
        </select>
      </div>

      <div class="form-group">
        <label for="me-branch" style="font-weight:700;">สาขาประจำ (Assigned Branch)</label>
        <select id="me-branch" class="form-select" style="font-weight:700;">
          <option value="">ส่วนกลาง (สำนักงานใหญ่)</option>
          ${branches.map(b => `<option value="${b._id}">${b.name} (${b.code || ''})</option>`).join('')}
        </select>
      </div>
    </form>
  `;

  const footerHtml = `
    <button class="btn btn-secondary" onclick="closeModal()">ยกเลิก</button>
    <button class="btn btn-primary" onclick="submitAddEmp()" style="font-weight:700;"><i class="fa-solid fa-user-check"></i> ยืนยันเพิ่มพนักงานใหม่</button>
  `;

  openModal('➕ เพิ่มพนักงานใหม่ (Add New Employee)', bodyHtml, footerHtml);
}

async function submitAddEmp() {
  const empIdEl = document.getElementById('me-empid');
  const fullNameEl = document.getElementById('me-fullname');
  const usernameEl = document.getElementById('me-username');
  const emailEl = document.getElementById('me-email');
  const passwordEl = document.getElementById('me-password');
  const roleEl = document.getElementById('me-role');
  const branchEl = document.getElementById('me-branch');

  const empId = empIdEl ? empIdEl.value.trim() : '';
  const fullName = fullNameEl ? fullNameEl.value.trim() : '';
  const username = usernameEl ? usernameEl.value.trim() : '';
  const email = emailEl ? emailEl.value.trim() : '';
  const password = passwordEl ? passwordEl.value : '';
  const role = roleEl ? roleEl.value : '';
  const branchId = branchEl ? branchEl.value : '';

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
      branchId: branchId || null
    });

    if (res.success) {
      showToast(res.message || 'เพิ่มพนักงานสำเร็จ');
      closeModal();
      renderEmployeeManagementView();
    }
  } catch (err) {
    // Handled in apiRequest
  }
}

async function openEditEmpModal(id, fullName, role, branchId, isActive) {
  const branches = state.masterOptions.branches || [];

  let roles = window.masterRolesCache || [];
  if (!roles || roles.length === 0) {
    try {
      const res = await apiRequest('/roles');
      roles = res.roles || [];
      window.masterRolesCache = roles;
    } catch (e) {}
  }

  const defaultOptions = [
    { code: 'admin', name: 'ผู้ดูแลระบบสูงสุด (Admin)' },
    { code: 'branch_staff', name: 'พนักงานประจำสาขา (Branch Staff)' },
    { code: 'technical_staff', name: 'ช่างเทคนิค (Technical Staff)' },
    { code: 'purchase_staff', name: 'พนักงานฝ่ายจัดซื้อ (Purchasing Staff)' },
    { code: 'hq_stock_staff', name: 'พนักงานคลังสินค้าส่วนกลาง (HQ Stock)' }
  ];

  const roleOptions = (roles && roles.length > 0) ? roles : defaultOptions;

  const bodyHtml = `
    <form id="edit-emp-form" onsubmit="event.preventDefault(); submitEditEmp('${id}');">
      <div class="form-group">
        <label for="ee-fullname" style="font-weight:700;">ชื่อ-นามสกุล (Full Name) <span style="color:#ef4444;">*</span></label>
        <input type="text" id="ee-fullname" class="form-control" value="${fullName}" required style="font-weight:700;">
      </div>

      <div class="form-group">
        <label for="ee-role" style="font-weight:700; color:var(--accent-primary);">
          <i class="fa-solid fa-user-shield"></i> เลือกตำแหน่งงาน (อ้างอิงจากระบบจัดการสิทธิ์และตำแหน่ง) <span style="color:#ef4444;">*</span>
        </label>
        <select id="ee-role" class="form-select" required style="font-weight:700; border:1px solid var(--accent-primary);">
          ${roleOptions.map(r => `<option value="${r.code}" ${role === r.code ? 'selected' : ''}>${r.name}</option>`).join('')}
        </select>
      </div>

      <div class="form-group">
        <label for="ee-branch" style="font-weight:700;">สาขาประจำ (Assigned Branch)</label>
        <select id="ee-branch" class="form-select" style="font-weight:700;">
          <option value="">ส่วนกลาง (สำนักงานใหญ่)</option>
          ${branches.map(b => `<option value="${b._id}" ${String(b._id) === String(branchId) ? 'selected' : ''}>${b.name} (${b.code || ''})</option>`).join('')}
        </select>
      </div>

      <div class="form-group">
        <label for="ee-status" style="font-weight:700;">สถานะพนักงาน</label>
        <select id="ee-status" class="form-select" style="font-weight:700;">
          <option value="true" ${isActive ? 'selected' : ''}>ปกติ (Active)</option>
          <option value="false" ${!isActive ? 'selected' : ''}>ระงับการใช้งาน (Suspended)</option>
        </select>
      </div>

      <div class="form-group">
        <label for="ee-password" style="font-weight:700;">เปลี่ยนรหัสผ่านใหม่ (ระบุเฉพาะเมื่อต้องการเปลี่ยน)</label>
        <input type="password" id="ee-password" class="form-control" placeholder="ปล่อยว่างไว้หากไม่ต้องการเปลี่ยนรหัสผ่าน">
      </div>
    </form>
  `;

  const footerHtml = `
    <button class="btn btn-secondary" onclick="closeModal()">ยกเลิก</button>
    <button class="btn btn-primary" onclick="submitEditEmp('${id}')" style="font-weight:700;"><i class="fa-solid fa-save"></i> บันทึกการแก้ไข</button>
  `;

  openModal('✏️ แก้ไขข้อมูลพนักงาน', bodyHtml, footerHtml);
}

async function submitEditEmp(id) {
  const fullNameEl = document.getElementById('ee-fullname');
  const roleEl = document.getElementById('ee-role');
  const branchEl = document.getElementById('ee-branch');
  const statusEl = document.getElementById('ee-status');
  const passwordEl = document.getElementById('ee-password');

  const fullName = fullNameEl ? fullNameEl.value.trim() : '';
  const role = roleEl ? roleEl.value : '';
  const branchId = branchEl ? branchEl.value : '';
  const isActive = statusEl ? (statusEl.value === 'true') : true;
  const password = passwordEl ? passwordEl.value.trim() : '';

  if (!fullName || !role) {
    showToast('กรุณากรอกชื่อ-นามสกุล และเลือกตำแหน่งงาน', 'error');
    return;
  }

  try {
    const res = await apiRequest(`/users/${id}`, 'PUT', {
      fullName,
      role,
      branchId: branchId || null,
      isActive,
      ...(password ? { password } : {})
    });

    if (res.success) {
      showToast(res.message || 'อัปเดตข้อมูลพนักงานสำเร็จ');
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
  if (!window.latestHqAuditBranches || window.latestHqAuditBranches.length === 0) {
    showToast('ไม่มีข้อมูลสาขาสำหรับส่งออก', 'warning');
    return;
  }
  const rows = window.latestHqAuditBranches.map(b => {
    return {
      'ชื่อสาขา': b.branch.name,
      'สถานะการตรวจ': b.status,
      'จำนวนสินค้าในคลัง': b.totalExpected,
      'จำนวนนับได้จริง': b.totalActual,
      'ยอดที่ขาด/เกิน': b.totalVariance,
      'ผู้ส่งรายงาน': b.submittedBy || '-',
      'ผู้อนุมัติ (ส่วนกลาง)': b.hqVerifiedBy || '-'
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
  const isSalesActive = document.getElementById('fin-sales-panel') && document.getElementById('fin-sales-panel').style.display !== 'none';
  const reportContainer = document.getElementById('printable-finance-report');
  
  if (!reportContainer) {
    showToast('กรุณารอโหลดตารางตัวอย่างรายงานในหน้าต่าง POP-UP ก่อนกดส่งออก', 'warning');
    return;
  }

  if (isSalesActive) {
    const rows = Array.from(reportContainer.querySelectorAll('table tbody tr')).filter(tr => {
      const tds = tr.querySelectorAll('td');
      // Must be detailed sales rows (excluding items counter row or summary row)
      return tds.length === 15 && !tr.innerText.includes('items');
    }).map(tr => {
      const tds = tr.querySelectorAll('td');
      return {
        'เลขที่': tds[0] ? tds[0].innerText.trim() : '',
        'วันที่': tds[1] ? tds[1].innerText.trim() : '',
        'เอกสาร': tds[2] ? tds[2].innerText.trim() : '',
        'ลูกค้า': tds[3] ? tds[3].innerText.trim() : '',
        'โทร': tds[4] ? tds[4].innerText.trim() : '',
        'วิธีการชำระ': tds[5] ? tds[5].innerText.trim() : '',
        'รหัสสินค้า/บริการ': tds[6] ? tds[6].innerText.trim() : '',
        'ชื่อสินค้า/บริการ': tds[7] ? tds[7].innerText.trim() : '',
        'จำนวน': tds[8] ? tds[8].innerText.trim() : '',
        'ราคา': tds[9] ? tds[9].innerText.trim() : '',
        'ส่วนลด': tds[10] ? tds[10].innerText.trim() : '',
        'รวมเงิน': tds[11] ? tds[11].innerText.trim() : '',
        'ต้นทุน': tds[12] ? tds[12].innerText.trim() : '',
        'กำไร/ขาดทุน': tds[13] ? tds[13].innerText.trim() : '',
        'สุทธิ': tds[14] ? tds[14].innerText.trim() : ''
      };
    });

    if (rows.length === 0) {
      showToast('ไม่พบข้อมูลรายการขายในตารางสำหรับส่งออก Excel', 'warning');
      return;
    }

    exportToExcel(rows, 'Financial_Sales_Report', 'รายงานสรุปการขายและกำไร');
  } else {
    // Expenses
    const rows = Array.from(reportContainer.querySelectorAll('table tbody tr')).filter(tr => {
      const tds = tr.querySelectorAll('td');
      // Must be detailed expenses rows (excluding the grand total row)
      return tds.length === 7 && !tr.innerText.includes('รวมยอดจ่ายทั้งสิ้น');
    }).map(tr => {
      const tds = tr.querySelectorAll('td');
      return {
        'เลขที่รายจ่าย / วันที่': tds[0] ? tds[0].innerText.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim() : '',
        'ชื่อรายการ': tds[1] ? tds[1].innerText.trim() : '',
        'สาขา': tds[2] ? tds[2].innerText.trim() : '',
        'หมวดหมู่': tds[3] ? tds[3].innerText.trim() : '',
        'จำนวนเงิน': tds[4] ? tds[4].innerText.replace('฿', '').replace(/,/g, '').trim() : '',
        'ผู้บันทึก': tds[5] ? tds[5].innerText.trim() : '',
        'หมายเหตุ': tds[6] ? tds[6].innerText.trim() : ''
      };
    });

    if (rows.length === 0) {
      showToast('ไม่พบข้อมูลบันทึกรายจ่ายในตารางสำหรับส่งออก Excel', 'warning');
      return;
    }

    exportToExcel(rows, 'Financial_Expenses_Report', 'รายงานบันทึกรายจ่ายดำเนินงาน');
  }
}

// 7. Export Product Master Catalog
function openPrintFinanceReportModal() {
  const isSalesActive = document.getElementById('fin-sales-panel') && document.getElementById('fin-sales-panel').style.display !== 'none';
  const isAdminOrHq = ['admin', 'hq_stock_staff', 'purchase_staff'].includes((state.user ? state.user.role : 'admin'));
  
  // Set modal card width to large for printing preview screen
  const modalCard = document.querySelector('#app-modal .modal-card');
  if (modalCard) {
    modalCard.style.maxWidth = '95vw';
    modalCard.style.width = '1450px';
  }

  // Get active values from main screen to initialize selectors
  const branchSelect = document.getElementById('fin-branch-filter');
  const startDateInput = document.getElementById('fin-start-date');
  const endDateInput = document.getElementById('fin-end-date');
  
  const selectedBranchId = branchSelect ? branchSelect.value : '';
  const selectedStartDate = startDateInput ? startDateInput.value : '';
  const selectedEndDate = endDateInput ? endDateInput.value : '';

  let branchOptionsHtml = '<option value="">-- ทุกสาขา --</option>';
  if (state.masterOptions.branches) {
    branchOptionsHtml += state.masterOptions.branches.map(b => {
      return `<option value="${b._id}" ${selectedBranchId === b._id ? 'selected' : ''}>${b.name}</option>`;
    }).join('');
  }

  const bodyHtml = `
    <!-- Print Settings Bar (Hidden in Print) -->
    <div class="no-print" style="display:flex; flex-wrap:wrap; gap:1rem; align-items:center; background:#f8f9fa; border:1px solid #ddd; padding:12px; border-radius:6px; margin-bottom:1.5rem; color:#000; font-family:'Sarabun';">
      <div style="font-weight:700; font-size:0.9rem; color:#000;">
        <i class="fa-solid fa-sliders" style="margin-right:0.3rem;"></i> ปรับเงื่อนไขรายงานก่อนพิมพ์:
      </div>
      
      <div style="display:flex; align-items:center; gap:0.4rem;">
        <label style="font-size:0.8rem; font-weight:600; color:#000;">สาขา:</label>
        <select id="print-branch-filter" class="form-select" style="padding:0.25rem 0.5rem; font-size:0.8rem; width:auto; color:#000; border:1px solid #ccc; background:#fff; height:auto; min-height:auto;" onchange="updatePrintFinanceReportPreview()">
          ${branchOptionsHtml}
        </select>
      </div>

      <div style="display:flex; align-items:center; gap:0.4rem;">
        <label style="font-size:0.8rem; font-weight:600; color:#000;">เริ่มวันที่:</label>
        <input type="date" id="print-start-date" class="form-control" style="padding:0.2rem 0.4rem; font-size:0.8rem; width:auto; border:1px solid #ccc; color:#000; background:#fff; height:auto; min-height:auto;" value="${selectedStartDate}" onchange="updatePrintFinanceReportPreview()">
      </div>

      <div style="display:flex; align-items:center; gap:0.4rem;">
        <label style="font-size:0.8rem; font-weight:600; color:#000;">ถึงวันที่:</label>
        <input type="date" id="print-end-date" class="form-control" style="padding:0.2rem 0.4rem; font-size:0.8rem; width:auto; border:1px solid #ccc; color:#000; background:#fff; height:auto; min-height:auto;" value="${selectedEndDate}" onchange="updatePrintFinanceReportPreview()">
      </div>
      
      <div style="margin-left:auto; display:flex; gap:0.5rem;">
        <button class="btn btn-success btn-sm" onclick="exportFinanceReportToExcel()" style="font-size:0.8rem; font-weight:700; height:auto; padding:0.35rem 0.8rem; border:none; display:flex; align-items:center; gap:0.3rem;">
          <i class="fa-solid fa-file-excel"></i> Export Excel
        </button>
      </div>
    </div>

    <!-- Print Stylesheet -->
    <style>
      @media print {
        .no-print {
          display: none !important;
        }
        @page {
          size: landscape;
          margin: 0.4cm;
        }
        #printable-finance-report {
          width: 100% !important;
        }
        .table-responsive-print {
          overflow: visible !important;
        }
      }
    </style>

    <!-- Preview Container (Target for updatePrintFinanceReportPreview) -->
    <div id="printable-finance-report-container">
      <div style="text-align:center; padding:3rem; color:#000; font-family:'Sarabun';">
        <i class="fa-solid fa-spinner fa-spin" style="font-size:2rem; margin-bottom:0.8rem;"></i>
        <div>กำลังเตรียมข้อมูลรายงาน...</div>
      </div>
    </div>
  `;

  const footerHtml = `
    <button class="btn btn-secondary" onclick="closeModal()">ปิดหน้าต่าง</button>
    <button class="btn btn-success" onclick="exportFinanceReportToExcel()"><i class="fa-solid fa-file-excel"></i> Export Excel</button>
    <button class="btn btn-primary" onclick="window.print()"><i class="fa-solid fa-print"></i> เริ่มสั่งพิมพ์รายงาน</button>
  `;

  openModal('พิมพ์รายงานสรุปผลการดำเนินงาน', bodyHtml, footerHtml);
  
  // Call preview function right after opening modal to draw the initial table!
  setTimeout(() => {
    updatePrintFinanceReportPreview();
  }, 100);
}

async function updatePrintFinanceReportPreview() {
  const isSalesActive = document.getElementById('fin-sales-panel') && document.getElementById('fin-sales-panel').style.display !== 'none';
  
  // Show loading indicator inside the print preview area
  const previewArea = document.getElementById('printable-finance-report-container');
  if (previewArea) {
    previewArea.innerHTML = `
      <div style="text-align:center; padding:3rem; color:#000; font-family:'Sarabun';">
        <i class="fa-solid fa-spinner fa-spin" style="font-size:2rem; margin-bottom:0.8rem;"></i>
        <div>กำลังดึงข้อมูลรายงานใหม่ตามเงื่อนไขที่เลือก...</div>
      </div>
    `;
  }

  // Get active print values
  const branchSelect = document.getElementById('print-branch-filter');
  const startDateInput = document.getElementById('print-start-date');
  const endDateInput = document.getElementById('print-end-date');
  const searchInput = document.getElementById('fin-search-input'); // main keyword filter
  
  const branchId = branchSelect ? branchSelect.value : '';
  const startDate = startDateInput ? startDateInput.value : '';
  const endDate = endDateInput ? endDateInput.value : '';
  const keyword = searchInput && searchInput.value ? searchInput.value : '';

  const branchName = branchSelect && branchSelect.selectedIndex >= 0 ? branchSelect.options[branchSelect.selectedIndex].text : 'ทุกสาขา';
  const paymentSelect = document.getElementById('fin-payment-filter');
  const paymentMethod = paymentSelect && paymentSelect.value ? paymentSelect.options[paymentSelect.selectedIndex].text : 'ทุกช่องทาง';

  const filterParams = {};
  if (branchId) filterParams.branchId = branchId;
  if (startDate) filterParams.startDate = startDate;
  if (endDate) filterParams.endDate = endDate;
  
  // Keep paymentMethod and payoutStatus from main page filters for query completeness
  const paymentSelectVal = paymentSelect ? paymentSelect.value : '';
  if (paymentSelectVal) filterParams.paymentMethod = paymentSelectVal;
  const payoutSelect = document.getElementById('fin-payout-filter');
  const payoutSelectVal = payoutSelect ? payoutSelect.value : '';
  if (payoutSelectVal) filterParams.payoutStatus = payoutSelectVal;

  try {
    const queryParams = new URLSearchParams(filterParams).toString();
    const res = await apiRequest(`/pos/finance-report?${queryParams}`);
    const sales = res.sales || [];
    const expenses = res.expenses || [];
    
    // Cache the new data back to state caches to keep things in sync
    state.salesCache = sales;
    state.expensesCache = expenses;

    // Filter by keyword client-side if needed
    const query = keyword.toLowerCase().trim();
    
    let filteredSales = sales;
    if (query) {
      filteredSales = sales.filter(s => {
        const searchStr = (
          s.receiptNumber + ' ' + 
          (s.branch ? s.branch.name : '') + ' ' + 
          (s.customer ? s.customer.name : '') + ' ' + 
          (s.items ? s.items.map(item => item.productName + ' ' + item.imei).join(' ') : '') + ' ' + 
          (s.soldBy ? s.soldBy.fullName || s.soldBy.username : '')
        ).toLowerCase();
        return searchStr.includes(query);
      });
    }

    const dateRangeStr = (startDate ? `วันที่เริ่ม: ${startDate}` : '') + (endDate ? ` ถึงวันที่: ${endDate}` : '');

    let printRowsHtml = '';
    let headerHtml = '';

    if (isSalesActive) {
      headerHtml = `
        <div style="font-family:'Sarabun'; margin-bottom:0.8rem; color:#000;">
          <h1 style="font-size:1.25rem; font-weight:700; margin:0; font-family:'Sarabun'; text-align:left;">รายงานรายละเอียดการขาย</h1>
          <div style="font-size:0.75rem; margin-top:0.2rem; color:#333;">
            สาขา: ${branchName} | ช่องทางชำระเงิน: ${paymentMethod} | ${dateRangeStr ? dateRangeStr : 'ข้อมูลทั้งหมด'} ${query ? ` | คัดกรอง: "${query}"` : ''}
          </div>
        </div>
      `;

      let grandTotalQty = 0;
      let grandTotalDiscount = 0;
      let grandTotalAmount = 0;
      let grandTotalCost = 0;
      let grandTotalProfit = 0;
      let grandTotalNet = 0;

      let tableRows = [];
      let itemsCount = 0;

      filteredSales.forEach(s => {
        const isVoided = s.status === 'voided';
        const receiptNumber = s.receiptNumber || '';
        const docNumber = receiptNumber.replace('SC-', 'RC-');
        
        const dateObj = new Date(s.createdAt);
        const dateStr = dateObj.getFullYear() + '-' + String(dateObj.getMonth() + 1).padStart(2, '0') + '-' + String(dateObj.getDate()).padStart(2, '0');
        
        const customerName = s.customer ? s.customer.name : 'ทั่วไป';
        const customerPhone = s.customer ? s.customer.phone || '-' : '-';
        
        let paymentStr = '-';
        if (s.paymentMethod === 'cash') {
          paymentStr = 'เงินสด';
        } else if (s.paymentMethod === 'transfer') {
          paymentStr = 'โอนเงิน';
        } else if (s.paymentMethod === 'credit_card') {
          paymentStr = 'บัตรเครดิต';
        } else if (s.paymentMethod === 'finance') {
          const finCompany = (s.financeDetails && s.financeDetails.companyName) ? ` (${s.financeDetails.companyName})` : '';
          paymentStr = `ซื้อสดไฟแนนซ์${finCompany}`;
        }

        (s.items || []).forEach((i, itemIdx) => {
          itemsCount++;
          const qty = i.quantity || 1;
          const price = i.unitPrice || 0;
          const discount = (itemIdx === 0 && s.discountTotal) ? s.discountTotal : 0;
          const subtotal = (qty * price) - discount;
          const isReturnedCost = s.costReturnedStatus === 'returned' && s.actualCostReturned !== undefined && s.actualCostReturned !== 0;
          let cost = (i.costPrice || 0) * qty;
          let oldCostStr = '';

          if (isReturnedCost) {
            const originalCost = s.totalCost || 0;
            const newCost = s.actualCostReturned;
            if (originalCost && newCost && originalCost !== newCost) {
              const itemOriginalCost = (i.costPrice || 0) * qty;
              const itemNewCost = originalCost > 0 ? (itemOriginalCost / originalCost) * newCost : newCost;
              cost = itemNewCost;
              oldCostStr = `<br><span style="font-size:0.6rem; color:#777; text-decoration:line-through; display:block; margin-top:1px; line-height:1.1;">เดิม: ${itemOriginalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>`;
            }
          }
          const profit = subtotal - cost;
          const net = subtotal;

          grandTotalQty += qty;
          grandTotalDiscount += discount;
          grandTotalAmount += subtotal;
          grandTotalCost += cost;
          grandTotalProfit += profit;
          grandTotalNet += net;

          tableRows.push(`
            <tr style="color:#000; ${isVoided ? 'text-decoration:line-through; opacity:0.5;' : ''}">
              <td style="padding:4px 6px; border:1px solid #111; font-size:0.68rem; text-align:left; font-family:'Sarabun';">${receiptNumber}</td>
              <td style="padding:4px 6px; border:1px solid #111; font-size:0.68rem; text-align:center; font-family:'Sarabun';">${dateStr}</td>
              <td style="padding:4px 6px; border:1px solid #111; font-size:0.68rem; text-align:left; font-family:'Sarabun';">${docNumber}</td>
              <td style="padding:4px 6px; border:1px solid #111; font-size:0.68rem; text-align:left; font-family:'Sarabun';">${customerName}</td>
              <td style="padding:4px 6px; border:1px solid #111; font-size:0.68rem; text-align:center; font-family:'Sarabun';">${customerPhone}</td>
              <td style="padding:4px 6px; border:1px solid #111; font-size:0.68rem; text-align:center; font-family:'Sarabun';">${paymentStr}</td>
              <td style="padding:4px 6px; border:1px solid #111; font-size:0.68rem; text-align:left; font-family:'Sarabun';">${i.imei || '-'}</td>
              <td style="padding:4px 6px; border:1px solid #111; font-size:0.68rem; text-align:left; font-family:'Sarabun';">${i.productName || '-'}</td>
              <td style="padding:4px 6px; border:1px solid #111; font-size:0.68rem; text-align:center; font-family:'Sarabun';">${qty.toFixed(2)}</td>
              <td style="padding:4px 6px; border:1px solid #111; font-size:0.68rem; text-align:right; font-family:'Sarabun';">${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              <td style="padding:4px 6px; border:1px solid #111; font-size:0.68rem; text-align:right; font-family:'Sarabun';">${discount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              <td style="padding:4px 6px; border:1px solid #111; font-size:0.68rem; text-align:right; font-family:'Sarabun';">${subtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              <td style="padding:4px 6px; border:1px solid #111; font-size:0.68rem; text-align:right; font-family:'Sarabun';">${cost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${oldCostStr}</td>
              <td style="padding:4px 6px; border:1px solid #111; font-size:0.68rem; text-align:right; font-family:'Sarabun';">${profit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              <td style="padding:4px 6px; border:1px solid #111; font-size:0.68rem; text-align:right; font-family:'Sarabun';">${net.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            </tr>
          `);
        });
      });

      printRowsHtml = `
        <tr style="color:#000; font-weight:700;">
          <td colspan="15" style="padding:4px 6px; border:1px solid #111; font-size:0.68rem; text-align:left; background:#fff;">(${itemsCount} items)</td>
        </tr>
        ${tableRows.length === 0 ? `<tr><td colspan="15" style="text-align:center; padding:2rem; border:1px solid #111; font-size:0.75rem; color:#000;">ไม่พบข้อมูลรายการขาย</td></tr>` : tableRows.join('')}
        <tr style="color:#000; font-weight:700; background:#fff; border-top:1.5px solid #111; border-bottom:2px double #111;">
          <td colspan="8" style="padding:4px 6px; border:1px solid #111; font-size:0.68rem; text-align:left;"></td>
          <td style="padding:4px 6px; border:1px solid #111; font-size:0.68rem; text-align:center;">${grandTotalQty.toFixed(2)}</td>
          <td style="padding:4px 6px; border:1px solid #111; font-size:0.68rem; text-align:right;"></td>
          <td style="padding:4px 6px; border:1px solid #111; font-size:0.68rem; text-align:right;">${grandTotalDiscount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          <td style="padding:4px 6px; border:1px solid #111; font-size:0.68rem; text-align:right;">${grandTotalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          <td style="padding:4px 6px; border:1px solid #111; font-size:0.68rem; text-align:right;">${grandTotalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          <td style="padding:4px 6px; border:1px solid #111; font-size:0.68rem; text-align:right;">${grandTotalProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          <td style="padding:4px 6px; border:1px solid #111; font-size:0.68rem; text-align:right;">${grandTotalNet.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        </tr>
      `;

      previewArea.innerHTML = `
        <div id="printable-finance-report" style="background:#fff; color:#000; padding:0.5rem; font-family:'Sarabun',sans-serif; line-height:1.2; box-sizing:border-box; width:100%;">
          ${headerHtml}
          
          <div class="table-responsive-print" style="width:100%; overflow-x:auto;">
            <table style="width:100%; border-collapse:collapse; border:1px solid #111; font-family:'Sarabun';">
              <thead>
                <tr style="background:#fff; color:#000; font-weight:700; border-bottom:1px solid #111;">
                  <th style="padding:4px 6px; border:1px solid #111; text-align:left; font-size:0.7rem; width:8%;">เลขที่</th>
                  <th style="padding:4px 6px; border:1px solid #111; text-align:center; font-size:0.7rem; width:7%;">วันที่</th>
                  <th style="padding:4px 6px; border:1px solid #111; text-align:left; font-size:0.7rem; width:8%;">เอกสาร</th>
                  <th style="padding:4px 6px; border:1px solid #111; text-align:left; font-size:0.7rem; width:9%;">ลูกค้า</th>
                  <th style="padding:4px 6px; border:1px solid #111; text-align:center; font-size:0.7rem; width:7%;">โทร</th>
                  <th style="padding:4px 6px; border:1px solid #111; text-align:center; font-size:0.7rem; width:8%;">วิธีการชำระ</th>
                  <th style="padding:4px 6px; border:1px solid #111; text-align:left; font-size:0.7rem; width:10%;">รหัสสินค้า/บริการ</th>
                  <th style="padding:4px 6px; border:1px solid #111; text-align:left; font-size:0.7rem; width:12%;">ชื่อสินค้า/บริการ</th>
                  <th style="padding:4px 6px; border:1px solid #111; text-align:center; font-size:0.7rem; width:4%;">จำนวน</th>
                  <th style="padding:4px 6px; border:1px solid #111; text-align:right; font-size:0.7rem; width:5%;">ราคา</th>
                  <th style="padding:4px 6px; border:1px solid #111; text-align:right; font-size:0.7rem; width:4%;">ส่วนลด</th>
                  <th style="padding:4px 6px; border:1px solid #111; text-align:right; font-size:0.7rem; width:6%;">รวมเงิน</th>
                  <th style="padding:4px 6px; border:1px solid #111; text-align:right; font-size:0.7rem; width:5%;">ต้นทุน</th>
                  <th style="padding:4px 6px; border:1px solid #111; text-align:right; font-size:0.7rem; width:6%;">กำไร/ขาดทุน</th>
                  <th style="padding:4px 6px; border:1px solid #111; text-align:right; font-size:0.7rem; width:6%;">สุทธิ</th>
                </tr>
              </thead>
              <tbody>
                ${printRowsHtml}
              </tbody>
            </table>
          </div>
        </div>
      `;
    } else {
      // Expenses
      headerHtml = `
        <div style="font-family:'Sarabun'; margin-bottom:0.8rem; color:#000;">
          <h1 style="font-size:1.25rem; font-weight:700; margin:0; font-family:'Sarabun'; text-align:left;">รายงานสรุปรายการบันทึกรายจ่ายดำเนินงาน</h1>
          <div style="font-size:0.75rem; margin-top:0.2rem; color:#333;">
            สาขา: ${branchName} | ${dateRangeStr ? dateRangeStr : 'ข้อมูลทั้งหมด'} ${query ? ` | คัดกรอง: "${query}"` : ''}
          </div>
        </div>
      `;

      let grandTotalExpenses = 0;
      
      const categoryFilter = document.getElementById('exp-category-filter') ? document.getElementById('exp-category-filter').value : '';
      const recordedByFilter = document.getElementById('exp-recorded-by-filter') ? document.getElementById('exp-recorded-by-filter').value : '';
      const minAmount = document.getElementById('exp-min-amount') && document.getElementById('exp-min-amount').value ? Number(document.getElementById('exp-min-amount').value) : null;
      const maxAmount = document.getElementById('exp-max-amount') && document.getElementById('exp-max-amount').value ? Number(document.getElementById('exp-max-amount').value) : null;

      let filteredExpenses = expenses;
      filteredExpenses = expenses.filter(exp => {
        const searchStr = (exp.expenseNumber + ' ' + (exp.title || '') + ' ' + (exp.branch ? exp.branch.name : 'ส่วนกลาง') + ' ' + exp.category + ' ' + (exp.recordedBy ? exp.recordedBy.fullName || exp.recordedBy.username : '') + ' ' + (exp.note || '')).toLowerCase();
        const rowCategory = exp.category || '';
        const rowRecordedBy = exp.recordedBy ? (exp.recordedBy._id || exp.recordedBy) : '';
        const rowAmount = exp.amount || 0;
        
        let matchSearch = !query || searchStr.includes(query);
        let matchCategory = !categoryFilter || rowCategory === categoryFilter;
        let matchRecordedBy = !recordedByFilter || rowRecordedBy === recordedByFilter;
        let matchMinAmount = minAmount === null || rowAmount >= minAmount;
        let matchMaxAmount = maxAmount === null || rowAmount <= maxAmount;

        return matchSearch && matchCategory && matchRecordedBy && matchMinAmount && matchMaxAmount;
      });

      if (filteredExpenses.length === 0) {
        printRowsHtml = `<tr><td colspan="7" style="text-align:center; padding:2rem; border:1px solid #000; font-size:0.75rem; color:#000;">ไม่พบข้อมูลบันทึกรายจ่าย</td></tr>`;
      } else {
        printRowsHtml = filteredExpenses.map(exp => {
          const dateValStr = new Date(exp.expenseDate).toLocaleDateString('th-TH');
          const categoryThai = exp.category || 'อื่นๆ';
          const recName = exp.recordedBy ? exp.recordedBy.fullName || exp.recordedBy.username : 'พนักงาน';
          grandTotalExpenses += exp.amount || 0;
          
          return `
            <tr style="color:#000; border-bottom:1px solid #000;">
              <td style="padding:6px; border:1px solid #000; font-size:0.75rem; vertical-align:top;"><strong>${exp.expenseNumber}</strong><br>${dateValStr}</td>
              <td style="padding:6px; border:1px solid #000; font-size:0.75rem; vertical-align:top;">${exp.title || '-'}</td>
              <td style="padding:6px; border:1px solid #000; font-size:0.75rem; vertical-align:top;">${exp.branch ? exp.branch.name : 'ส่วนกลาง (สำนักงานใหญ่)'}</td>
              <td style="padding:6px; border:1px solid #000; font-size:0.75rem; text-align:center; vertical-align:top;">${categoryThai}</td>
              <td style="padding:6px; border:1px solid #000; font-size:0.75rem; text-align:right; font-weight:700; vertical-align:top;">${(exp.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              <td style="padding:6px; border:1px solid #000; font-size:0.75rem; vertical-align:top;">${recName}</td>
              <td style="padding:6px; border:1px solid #000; font-size:0.75rem; vertical-align:top;">${exp.note || '-'}</td>
            </tr>
          `;
        }).join('');

        printRowsHtml += `
          <tr style="color:#000; font-weight:700; background:#fff; border-top:1.5px solid #000; border-bottom:2px double #000;">
            <td colspan="4" style="padding:6px; border:1px solid #000; font-size:0.75rem; text-align:left;">รวมยอดจ่ายทั้งสิ้น</td>
            <td style="padding:6px; border:1px solid #000; font-size:0.75rem; text-align:right;">${grandTotalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            <td colspan="2" style="padding:6px; border:1px solid #000; font-size:0.75rem; text-align:left;"></td>
          </tr>
        `;
      }

      previewArea.innerHTML = `
        <div id="printable-finance-report" style="background:#fff; color:#000; padding:1.5rem; font-family:'Sarabun',sans-serif; line-height:1.4; box-sizing:border-box; width:100%;">
          ${headerHtml}
          
          <div class="table-responsive-print" style="width:100%; overflow-x:auto;">
            <table style="width:100%; border-collapse:collapse; border:1px solid #000; font-family:'Sarabun';">
              <thead>
                <tr style="background:#fff; color:#000; font-weight:700; border-bottom:1.5px solid #000;">
                  <th style="padding:10px; border:1px solid #000; text-align:left; font-size:0.8rem; width:15%;">เลขที่รายจ่าย / วันที่</th>
                  <th style="padding:10px; border:1px solid #000; text-align:left; font-size:0.8rem; width:20%;">ชื่อรายการ</th>
                  <th style="padding:10px; border:1px solid #000; text-align:left; font-size:0.8rem; width:15%;">สาขา</th>
                  <th style="padding:10px; border:1px solid #000; text-align:center; font-size:0.8rem; width:15%;">หมวดหมู่</th>
                  <th style="padding:10px; border:1px solid #000; text-align:right; font-size:0.8rem; width:12%;">จำนวนเงิน</th>
                  <th style="padding:10px; border:1px solid #000; text-align:left; font-size:0.8rem; width:13%;">ผู้บันทึก</th>
                  <th style="padding:10px; border:1px solid #000; text-align:left; font-size:0.8rem; width:20%;">หมายเหตุ</th>
                </tr>
              </thead>
              <tbody>
                ${printRowsHtml}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }
  } catch (err) {
    if (previewArea) {
      previewArea.innerHTML = `<div style="color:#ef4444; padding:2rem; font-family:'Sarabun';">เกิดข้อผิดพลาดในการโหลดรายงานการเงิน: ${err.message}</div>`;
    }
  }
}


function openPrintFinanceReportModal() {
  const isSalesActive = document.getElementById('fin-sales-panel') && document.getElementById('fin-sales-panel').style.display !== 'none';
  const isAdminOrHq = ['admin', 'hq_stock_staff', 'purchase_staff'].includes((state.user ? state.user.role : 'admin'));
  
  // Set modal card width to large for printing preview screen
  const modalCard = document.querySelector('#app-modal .modal-card');
  if (modalCard) {
    modalCard.style.maxWidth = '95vw';
    modalCard.style.width = '1450px';
  }

  // Get active values from main screen to initialize selectors
  const branchSelect = document.getElementById('fin-branch-filter');
  const startDateInput = document.getElementById('fin-start-date');
  const endDateInput = document.getElementById('fin-end-date');
  
  const selectedBranchId = branchSelect ? branchSelect.value : '';
  const selectedStartDate = startDateInput ? startDateInput.value : '';
  const selectedEndDate = endDateInput ? endDateInput.value : '';

  let branchOptionsHtml = '<option value="">-- ทุกสาขา --</option>';
  if (state.masterOptions.branches) {
    branchOptionsHtml += state.masterOptions.branches.map(b => {
      return `<option value="${b._id}" ${selectedBranchId === b._id ? 'selected' : ''}>${b.name}</option>`;
    }).join('');
  }

  const bodyHtml = `
    <!-- Print Settings Bar (Hidden in Print) -->
    <div class="no-print" style="display:flex; flex-wrap:wrap; gap:1rem; align-items:center; background:#f8f9fa; border:1px solid #ddd; padding:12px; border-radius:6px; margin-bottom:1.5rem; color:#000; font-family:'Sarabun';">
      <div style="font-weight:700; font-size:0.9rem; color:#000;">
        <i class="fa-solid fa-sliders" style="margin-right:0.3rem;"></i> ปรับเงื่อนไขรายงานก่อนพิมพ์:
      </div>
      
      <div style="display:flex; align-items:center; gap:0.4rem;">
        <label style="font-size:0.8rem; font-weight:600; color:#000;">สาขา:</label>
        <select id="print-branch-filter" class="form-select" style="padding:0.25rem 0.5rem; font-size:0.8rem; width:auto; color:#000; border:1px solid #ccc; background:#fff; height:auto; min-height:auto;" onchange="updatePrintFinanceReportPreview()">
          ${branchOptionsHtml}
        </select>
      </div>

      <div style="display:flex; align-items:center; gap:0.4rem;">
        <label style="font-size:0.8rem; font-weight:600; color:#000;">เริ่มวันที่:</label>
        <input type="date" id="print-start-date" class="form-control" style="padding:0.2rem 0.4rem; font-size:0.8rem; width:auto; border:1px solid #ccc; color:#000; background:#fff; height:auto; min-height:auto;" value="${selectedStartDate}" onchange="updatePrintFinanceReportPreview()">
      </div>

      <div style="display:flex; align-items:center; gap:0.4rem;">
        <label style="font-size:0.8rem; font-weight:600; color:#000;">ถึงวันที่:</label>
        <input type="date" id="print-end-date" class="form-control" style="padding:0.2rem 0.4rem; font-size:0.8rem; width:auto; border:1px solid #ccc; color:#000; background:#fff; height:auto; min-height:auto;" value="${selectedEndDate}" onchange="updatePrintFinanceReportPreview()">
      </div>
    </div>

    <!-- Print Stylesheet -->
    <style>
      @media print {
        .no-print {
          display: none !important;
        }
        @page {
          size: landscape;
          margin: 0.4cm;
        }
        #printable-finance-report {
          width: 100% !important;
        }
        .table-responsive-print {
          overflow: visible !important;
        }
      }
    </style>

    <!-- Preview Container (Target for updatePrintFinanceReportPreview) -->
    <div id="printable-finance-report-container">
      <div style="text-align:center; padding:3rem; color:#000; font-family:'Sarabun';">
        <i class="fa-solid fa-spinner fa-spin" style="font-size:2rem; margin-bottom:0.8rem;"></i>
        <div>กำลังเตรียมข้อมูลรายงาน...</div>
      </div>
    </div>
  `;

  const footerHtml = `
    <button class="btn btn-secondary" onclick="closeModal()">ปิดหน้าต่าง</button>
        <button class="btn btn-success" onclick="exportFinanceReportToExcel()"><i class="fa-solid fa-file-excel"></i> Export Excel</button>
<button class="btn btn-primary" onclick="window.print()"><i class="fa-solid fa-print"></i> เริ่มสั่งพิมพ์รายงาน</button>
  `;

  openModal('พิมพ์รายงานสรุปผลการดำเนินงาน', bodyHtml, footerHtml);
  
  // Call preview function right after opening modal to draw the initial table!
  setTimeout(() => {
    updatePrintFinanceReportPreview();
  }, 100);
}

async function updatePrintFinanceReportPreview() {
  const isSalesActive = document.getElementById('fin-sales-panel') && document.getElementById('fin-sales-panel').style.display !== 'none';
  
  // Show loading indicator inside the print preview area
  const previewArea = document.getElementById('printable-finance-report-container');
  if (previewArea) {
    previewArea.innerHTML = `
      <div style="text-align:center; padding:3rem; color:#000; font-family:'Sarabun';">
        <i class="fa-solid fa-spinner fa-spin" style="font-size:2rem; margin-bottom:0.8rem;"></i>
        <div>กำลังดึงข้อมูลรายงานใหม่ตามเงื่อนไขที่เลือก...</div>
      </div>
    `;
  }

  // Get active print values
  const branchSelect = document.getElementById('print-branch-filter');
  const startDateInput = document.getElementById('print-start-date');
  const endDateInput = document.getElementById('print-end-date');
  const searchInput = document.getElementById('fin-search-input'); // main keyword filter
  
  const branchId = branchSelect ? branchSelect.value : '';
  const startDate = startDateInput ? startDateInput.value : '';
  const endDate = endDateInput ? endDateInput.value : '';
  const keyword = searchInput && searchInput.value ? searchInput.value : '';

  const branchName = branchSelect && branchSelect.selectedIndex >= 0 ? branchSelect.options[branchSelect.selectedIndex].text : 'ทุกสาขา';
  const paymentSelect = document.getElementById('fin-payment-filter');
  const paymentMethod = paymentSelect && paymentSelect.value ? paymentSelect.options[paymentSelect.selectedIndex].text : 'ทุกช่องทาง';

  const filterParams = {};
  if (branchId) filterParams.branchId = branchId;
  if (startDate) filterParams.startDate = startDate;
  if (endDate) filterParams.endDate = endDate;
  
  // Keep paymentMethod and payoutStatus from main page filters for query completeness
  const paymentSelectVal = paymentSelect ? paymentSelect.value : '';
  if (paymentSelectVal) filterParams.paymentMethod = paymentSelectVal;
  const payoutSelect = document.getElementById('fin-payout-filter');
  const payoutSelectVal = payoutSelect ? payoutSelect.value : '';
  if (payoutSelectVal) filterParams.payoutStatus = payoutSelectVal;

  try {
    const queryParams = new URLSearchParams(filterParams).toString();
    const res = await apiRequest(`/pos/finance-report?${queryParams}`);
    const sales = res.sales || [];
    const expenses = res.expenses || [];
    
    // Cache the new data back to state caches to keep things in sync
    state.salesCache = sales;
    state.expensesCache = expenses;

    // Filter by keyword client-side if needed
    const query = keyword.toLowerCase().trim();
    
    let filteredSales = sales;
    if (query) {
      filteredSales = sales.filter(s => {
        const searchStr = (
          s.receiptNumber + ' ' + 
          (s.branch ? s.branch.name : '') + ' ' + 
          (s.customer ? s.customer.name : '') + ' ' + 
          (s.items ? s.items.map(item => item.productName + ' ' + item.imei).join(' ') : '') + ' ' + 
          (s.soldBy ? s.soldBy.fullName || s.soldBy.username : '')
        ).toLowerCase();
        return searchStr.includes(query);
      });
    }

    const dateRangeStr = (startDate ? `วันที่เริ่ม: ${startDate}` : '') + (endDate ? ` ถึงวันที่: ${endDate}` : '');

    let printRowsHtml = '';
    let headerHtml = '';

    if (isSalesActive) {
      headerHtml = `
        <div style="font-family:'Sarabun'; margin-bottom:0.8rem; color:#000;">
          <h1 style="font-size:1.25rem; font-weight:700; margin:0; font-family:'Sarabun'; text-align:left;">รายงานรายละเอียดการขาย</h1>
          <div style="font-size:0.75rem; margin-top:0.2rem; color:#333;">
            สาขา: ${branchName} | ช่องทางชำระเงิน: ${paymentMethod} | ${dateRangeStr ? dateRangeStr : 'ข้อมูลทั้งหมด'} ${query ? ` | คัดกรอง: "${query}"` : ''}
          </div>
        </div>
      `;

      let grandTotalQty = 0;
      let grandTotalDiscount = 0;
      let grandTotalAmount = 0;
      let grandTotalCost = 0;
      let grandTotalProfit = 0;
      let grandTotalNet = 0;

      let tableRows = [];
      let itemsCount = 0;

      filteredSales.forEach(s => {
        const isVoided = s.status === 'voided';
        const receiptNumber = s.receiptNumber || '';
        const docNumber = receiptNumber.replace('SC-', 'RC-');
        
        const dateObj = new Date(s.createdAt);
        const dateStr = dateObj.getFullYear() + '-' + String(dateObj.getMonth() + 1).padStart(2, '0') + '-' + String(dateObj.getDate()).padStart(2, '0');
        
        const customerName = s.customer ? s.customer.name : 'ทั่วไป';
        const customerPhone = s.customer ? s.customer.phone || '-' : '-';
        
        let paymentStr = '-';
        if (s.paymentMethod === 'cash') {
          paymentStr = 'เงินสด';
        } else if (s.paymentMethod === 'transfer') {
          paymentStr = 'โอนเงิน';
        } else if (s.paymentMethod === 'credit_card') {
          paymentStr = 'บัตรเครดิต';
        } else if (s.paymentMethod === 'finance') {
          const finCompany = (s.financeDetails && s.financeDetails.companyName) ? ` (${s.financeDetails.companyName})` : '';
          paymentStr = `ซื้อสดไฟแนนซ์${finCompany}`;
        }

        (s.items || []).forEach((i, itemIdx) => {
          itemsCount++;
          const qty = i.quantity || 1;
          const price = i.unitPrice || 0;
          const discount = (itemIdx === 0 && s.discountTotal) ? s.discountTotal : 0;
          const subtotal = (qty * price) - discount;
          const isReturnedCost = s.costReturnedStatus === 'returned' && s.actualCostReturned !== undefined && s.actualCostReturned !== 0;
          let cost = (i.costPrice || 0) * qty;
          let oldCostStr = '';

          if (isReturnedCost) {
            const originalCost = s.totalCost || 0;
            const newCost = s.actualCostReturned;
            if (originalCost && newCost && originalCost !== newCost) {
              const itemOriginalCost = (i.costPrice || 0) * qty;
              const itemNewCost = originalCost > 0 ? (itemOriginalCost / originalCost) * newCost : newCost;
              cost = itemNewCost;
              oldCostStr = `<br><span style="font-size:0.6rem; color:#777; text-decoration:line-through; display:block; margin-top:1px; line-height:1.1;">เดิม: ${itemOriginalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>`;
            }
          }
          const profit = subtotal - cost;
          const net = subtotal;

          grandTotalQty += qty;
          grandTotalDiscount += discount;
          grandTotalAmount += subtotal;
          grandTotalCost += cost;
          grandTotalProfit += profit;
          grandTotalNet += net;

          tableRows.push(`
            <tr style="color:#000; ${isVoided ? 'text-decoration:line-through; opacity:0.5;' : ''}">
              <td style="padding:4px 6px; border:1px solid #111; font-size:0.68rem; text-align:left; font-family:'Sarabun';">${receiptNumber}</td>
              <td style="padding:4px 6px; border:1px solid #111; font-size:0.68rem; text-align:center; font-family:'Sarabun';">${dateStr}</td>
              <td style="padding:4px 6px; border:1px solid #111; font-size:0.68rem; text-align:left; font-family:'Sarabun';">${docNumber}</td>
              <td style="padding:4px 6px; border:1px solid #111; font-size:0.68rem; text-align:left; font-family:'Sarabun';">${customerName}</td>
              <td style="padding:4px 6px; border:1px solid #111; font-size:0.68rem; text-align:center; font-family:'Sarabun';">${customerPhone}</td>
              <td style="padding:4px 6px; border:1px solid #111; font-size:0.68rem; text-align:center; font-family:'Sarabun';">${paymentStr}</td>
              <td style="padding:4px 6px; border:1px solid #111; font-size:0.68rem; text-align:left; font-family:'Sarabun';">${i.imei || '-'}</td>
              <td style="padding:4px 6px; border:1px solid #111; font-size:0.68rem; text-align:left; font-family:'Sarabun';">${i.productName || '-'}</td>
              <td style="padding:4px 6px; border:1px solid #111; font-size:0.68rem; text-align:center; font-family:'Sarabun';">${qty.toFixed(2)}</td>
              <td style="padding:4px 6px; border:1px solid #111; font-size:0.68rem; text-align:right; font-family:'Sarabun';">${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              <td style="padding:4px 6px; border:1px solid #111; font-size:0.68rem; text-align:right; font-family:'Sarabun';">${discount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              <td style="padding:4px 6px; border:1px solid #111; font-size:0.68rem; text-align:right; font-family:'Sarabun';">${subtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              <td style="padding:4px 6px; border:1px solid #111; font-size:0.68rem; text-align:right; font-family:'Sarabun';">${cost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${oldCostStr}</td>
              <td style="padding:4px 6px; border:1px solid #111; font-size:0.68rem; text-align:right; font-family:'Sarabun';">${profit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              <td style="padding:4px 6px; border:1px solid #111; font-size:0.68rem; text-align:right; font-family:'Sarabun';">${net.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            </tr>
          `);
        });
      });

      printRowsHtml = `
        <tr style="color:#000; font-weight:700;">
          <td colspan="15" style="padding:4px 6px; border:1px solid #111; font-size:0.68rem; text-align:left; background:#fff;">(${itemsCount} items)</td>
        </tr>
        ${tableRows.length === 0 ? `<tr><td colspan="15" style="text-align:center; padding:2rem; border:1px solid #111; font-size:0.75rem; color:#000;">ไม่พบข้อมูลรายการขาย</td></tr>` : tableRows.join('')}
        <tr style="color:#000; font-weight:700; background:#fff; border-top:1.5px solid #111; border-bottom:2px double #111;">
          <td colspan="8" style="padding:4px 6px; border:1px solid #111; font-size:0.68rem; text-align:left;"></td>
          <td style="padding:4px 6px; border:1px solid #111; font-size:0.68rem; text-align:center;">${grandTotalQty.toFixed(2)}</td>
          <td style="padding:4px 6px; border:1px solid #111; font-size:0.68rem; text-align:right;"></td>
          <td style="padding:4px 6px; border:1px solid #111; font-size:0.68rem; text-align:right;">${grandTotalDiscount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          <td style="padding:4px 6px; border:1px solid #111; font-size:0.68rem; text-align:right;">${grandTotalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          <td style="padding:4px 6px; border:1px solid #111; font-size:0.68rem; text-align:right;">${grandTotalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          <td style="padding:4px 6px; border:1px solid #111; font-size:0.68rem; text-align:right;">${grandTotalProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          <td style="padding:4px 6px; border:1px solid #111; font-size:0.68rem; text-align:right;">${grandTotalNet.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        </tr>
      `;

      previewArea.innerHTML = `
        <div id="printable-finance-report" style="background:#fff; color:#000; padding:0.5rem; font-family:'Sarabun',sans-serif; line-height:1.2; box-sizing:border-box; width:100%;">
          ${headerHtml}
          
          <div class="table-responsive-print" style="width:100%; overflow-x:auto;">
            <table style="width:100%; border-collapse:collapse; border:1px solid #111; font-family:'Sarabun';">
              <thead>
                <tr style="background:#fff; color:#000; font-weight:700; border-bottom:1px solid #111;">
                  <th style="padding:4px 6px; border:1px solid #111; text-align:left; font-size:0.7rem; width:8%;">เลขที่</th>
                  <th style="padding:4px 6px; border:1px solid #111; text-align:center; font-size:0.7rem; width:7%;">วันที่</th>
                  <th style="padding:4px 6px; border:1px solid #111; text-align:left; font-size:0.7rem; width:8%;">เอกสาร</th>
                  <th style="padding:4px 6px; border:1px solid #111; text-align:left; font-size:0.7rem; width:9%;">ลูกค้า</th>
                  <th style="padding:4px 6px; border:1px solid #111; text-align:center; font-size:0.7rem; width:7%;">โทร</th>
                  <th style="padding:4px 6px; border:1px solid #111; text-align:center; font-size:0.7rem; width:8%;">วิธีการชำระ</th>
                  <th style="padding:4px 6px; border:1px solid #111; text-align:left; font-size:0.7rem; width:10%;">รหัสสินค้า/บริการ</th>
                  <th style="padding:4px 6px; border:1px solid #111; text-align:left; font-size:0.7rem; width:12%;">ชื่อสินค้า/บริการ</th>
                  <th style="padding:4px 6px; border:1px solid #111; text-align:center; font-size:0.7rem; width:4%;">จำนวน</th>
                  <th style="padding:4px 6px; border:1px solid #111; text-align:right; font-size:0.7rem; width:5%;">ราคา</th>
                  <th style="padding:4px 6px; border:1px solid #111; text-align:right; font-size:0.7rem; width:4%;">ส่วนลด</th>
                  <th style="padding:4px 6px; border:1px solid #111; text-align:right; font-size:0.7rem; width:6%;">รวมเงิน</th>
                  <th style="padding:4px 6px; border:1px solid #111; text-align:right; font-size:0.7rem; width:5%;">ต้นทุน</th>
                  <th style="padding:4px 6px; border:1px solid #111; text-align:right; font-size:0.7rem; width:6%;">กำไร/ขาดทุน</th>
                  <th style="padding:4px 6px; border:1px solid #111; text-align:right; font-size:0.7rem; width:6%;">สุทธิ</th>
                </tr>
              </thead>
              <tbody>
                ${printRowsHtml}
              </tbody>
            </table>
          </div>
        </div>
      `;
    } else {
      // Expenses
      headerHtml = `
        <div style="font-family:'Sarabun'; margin-bottom:0.8rem; color:#000;">
          <h1 style="font-size:1.25rem; font-weight:700; margin:0; font-family:'Sarabun'; text-align:left;">รายงานสรุปรายการบันทึกรายจ่ายดำเนินงาน</h1>
          <div style="font-size:0.75rem; margin-top:0.2rem; color:#333;">
            สาขา: ${branchName} | ${dateRangeStr ? dateRangeStr : 'ข้อมูลทั้งหมด'} ${query ? ` | คัดกรอง: "${query}"` : ''}
          </div>
        </div>
      `;

      let grandTotalExpenses = 0;
      
      const categoryFilter = document.getElementById('exp-category-filter') ? document.getElementById('exp-category-filter').value : '';
      const recordedByFilter = document.getElementById('exp-recorded-by-filter') ? document.getElementById('exp-recorded-by-filter').value : '';
      const minAmount = document.getElementById('exp-min-amount') && document.getElementById('exp-min-amount').value ? Number(document.getElementById('exp-min-amount').value) : null;
      const maxAmount = document.getElementById('exp-max-amount') && document.getElementById('exp-max-amount').value ? Number(document.getElementById('exp-max-amount').value) : null;

      let filteredExpenses = expenses;
      filteredExpenses = expenses.filter(exp => {
        const searchStr = (exp.expenseNumber + ' ' + (exp.title || '') + ' ' + (exp.branch ? exp.branch.name : 'ส่วนกลาง') + ' ' + exp.category + ' ' + (exp.recordedBy ? exp.recordedBy.fullName || exp.recordedBy.username : '') + ' ' + (exp.note || '')).toLowerCase();
        const rowCategory = exp.category || '';
        const rowRecordedBy = exp.recordedBy ? (exp.recordedBy._id || exp.recordedBy) : '';
        const rowAmount = exp.amount || 0;
        
        let matchSearch = !query || searchStr.includes(query);
        let matchCategory = !categoryFilter || rowCategory === categoryFilter;
        let matchRecordedBy = !recordedByFilter || rowRecordedBy === recordedByFilter;
        let matchMinAmount = minAmount === null || rowAmount >= minAmount;
        let matchMaxAmount = maxAmount === null || rowAmount <= maxAmount;

        return matchSearch && matchCategory && matchRecordedBy && matchMinAmount && matchMaxAmount;
      });

      if (filteredExpenses.length === 0) {
        printRowsHtml = `<tr><td colspan="7" style="text-align:center; padding:2rem; border:1px solid #000; font-size:0.75rem; color:#000;">ไม่พบข้อมูลบันทึกรายจ่าย</td></tr>`;
      } else {
        printRowsHtml = filteredExpenses.map(exp => {
          const dateValStr = new Date(exp.expenseDate).toLocaleDateString('th-TH');
          const categoryThai = exp.category || 'อื่นๆ';
          const recName = exp.recordedBy ? exp.recordedBy.fullName || exp.recordedBy.username : 'พนักงาน';
          grandTotalExpenses += exp.amount || 0;
          
          return `
            <tr style="color:#000; border-bottom:1px solid #000;">
              <td style="padding:6px; border:1px solid #000; font-size:0.75rem; vertical-align:top;"><strong>${exp.expenseNumber}</strong><br>${dateValStr}</td>
              <td style="padding:6px; border:1px solid #000; font-size:0.75rem; vertical-align:top;">${exp.title || '-'}</td>
              <td style="padding:6px; border:1px solid #000; font-size:0.75rem; vertical-align:top;">${exp.branch ? exp.branch.name : 'ส่วนกลาง (สำนักงานใหญ่)'}</td>
              <td style="padding:6px; border:1px solid #000; font-size:0.75rem; text-align:center; vertical-align:top;">${categoryThai}</td>
              <td style="padding:6px; border:1px solid #000; font-size:0.75rem; text-align:right; font-weight:700; vertical-align:top;">${(exp.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              <td style="padding:6px; border:1px solid #000; font-size:0.75rem; vertical-align:top;">${recName}</td>
              <td style="padding:6px; border:1px solid #000; font-size:0.75rem; vertical-align:top;">${exp.note || '-'}</td>
            </tr>
          `;
        }).join('');

        printRowsHtml += `
          <tr style="color:#000; font-weight:700; background:#fff; border-top:1.5px solid #000; border-bottom:2px double #000;">
            <td colspan="4" style="padding:6px; border:1px solid #000; font-size:0.75rem; text-align:left;">รวมยอดจ่ายทั้งสิ้น</td>
            <td style="padding:6px; border:1px solid #000; font-size:0.75rem; text-align:right;">${grandTotalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            <td colspan="2" style="padding:6px; border:1px solid #000; font-size:0.75rem; text-align:left;"></td>
          </tr>
        `;
      }

      previewArea.innerHTML = `
        <div id="printable-finance-report" style="background:#fff; color:#000; padding:1.5rem; font-family:'Sarabun',sans-serif; line-height:1.4; box-sizing:border-box; width:100%;">
          ${headerHtml}
          
          <div class="table-responsive-print" style="width:100%; overflow-x:auto;">
            <table style="width:100%; border-collapse:collapse; border:1px solid #000; font-family:'Sarabun';">
              <thead>
                <tr style="background:#fff; color:#000; font-weight:700; border-bottom:1.5px solid #000;">
                  <th style="padding:10px; border:1px solid #000; text-align:left; font-size:0.8rem; width:15%;">เลขที่รายจ่าย / วันที่</th>
                  <th style="padding:10px; border:1px solid #000; text-align:left; font-size:0.8rem; width:20%;">ชื่อรายการ</th>
                  <th style="padding:10px; border:1px solid #000; text-align:left; font-size:0.8rem; width:15%;">สาขา</th>
                  <th style="padding:10px; border:1px solid #000; text-align:center; font-size:0.8rem; width:15%;">หมวดหมู่</th>
                  <th style="padding:10px; border:1px solid #000; text-align:right; font-size:0.8rem; width:12%;">จำนวนเงิน</th>
                  <th style="padding:10px; border:1px solid #000; text-align:left; font-size:0.8rem; width:13%;">ผู้บันทึก</th>
                  <th style="padding:10px; border:1px solid #000; text-align:left; font-size:0.8rem; width:20%;">หมายเหตุ</th>
                </tr>
              </thead>
              <tbody>
                ${printRowsHtml}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }
  } catch (err) {
    if (previewArea) {
      previewArea.innerHTML = `<div style="color:#ef4444; padding:2rem; font-family:'Sarabun';">เกิดข้อผิดพลาดในการโหลดรายงานการเงิน: ${err.message}</div>`;
    }
  }
}


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


// Global Navigation Click Delegation
document.addEventListener('click', (e) => {
  const navLink = e.target.closest('.nav-link');
  if (navLink) {
    e.preventDefault();
    const targetView = navLink.getAttribute('data-view');
    if (targetView) {
      navigateTo(targetView);
    }
  }
});


/* ==========================================================================
   VIEW: ROLES & PERMISSIONS MANAGEMENT (จัดการสิทธิ์และตำแหน่ง - Beautiful UI)
   ========================================================================== */
async function renderRolesPermissionsView() {
  const container = document.getElementById('content-container');
  container.innerHTML = `
    <div style="padding: 3rem; text-align: center; color: var(--text-muted);">
      <i class="fa-solid fa-circle-notch fa-spin" style="font-size:2.5rem; color:var(--accent-primary); margin-bottom:1rem;"></i>
      <br><span style="font-size:1.05rem; font-weight:600; color:var(--text-main);">กำลังโหลดข้อมูลตำแหน่งและสิทธิ์การใช้งาน...</span>
    </div>
  `;

  try {
    const res = await apiRequest('/roles');
    const roles = res.roles || [];
    const systemMenus = res.systemMenus || [];

    const totalRoles = roles.length;
    const systemRoles = roles.filter(r => r.isSystemDefault).length;
    const customRoles = roles.filter(r => !r.isSystemDefault).length;

    container.innerHTML = `
      <!-- Top Overview Stat Cards -->
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:1rem; margin-bottom:1.5rem;">
        <div class="card" style="background:#ffffff; border:1px solid var(--border-color); padding:1.2rem; border-radius:12px; display:flex; align-items:center; gap:1rem;">
          <div style="width:48px; height:48px; border-radius:10px; background:rgba(8,145,178,0.1); color:#0891b2; display:flex; align-items:center; justify-content:center; font-size:1.4rem;">
            <i class="fa-solid fa-user-shield"></i>
          </div>
          <div>
            <span style="font-size:0.8rem; color:var(--text-muted); font-weight:600; display:block;">ตำแหน่งทั้งหมด</span>
            <strong style="font-size:1.6rem; color:var(--text-main); font-weight:800;">${totalRoles} <span style="font-size:0.85rem; font-weight:500; color:var(--text-muted);">ตำแหน่ง</span></strong>
          </div>
        </div>

        <div class="card" style="background:#ffffff; border:1px solid var(--border-color); padding:1.2rem; border-radius:12px; display:flex; align-items:center; gap:1rem;">
          <div style="width:48px; height:48px; border-radius:10px; background:rgba(124,58,237,0.1); color:#7c3aed; display:flex; align-items:center; justify-content:center; font-size:1.4rem;">
            <i class="fa-solid fa-lock"></i>
          </div>
          <div>
            <span style="font-size:0.8rem; color:var(--text-muted); font-weight:600; display:block;">ตำแหน่งหลักของระบบ</span>
            <strong style="font-size:1.6rem; color:var(--text-main); font-weight:800;">${systemRoles} <span style="font-size:0.85rem; font-weight:500; color:var(--text-muted);">ตำแหน่ง</span></strong>
          </div>
        </div>

        <div class="card" style="background:#ffffff; border:1px solid var(--border-color); padding:1.2rem; border-radius:12px; display:flex; align-items:center; gap:1rem;">
          <div style="width:48px; height:48px; border-radius:10px; background:rgba(16,185,129,0.1); color:#059669; display:flex; align-items:center; justify-content:center; font-size:1.4rem;">
            <i class="fa-solid fa-user-gear"></i>
          </div>
          <div>
            <span style="font-size:0.8rem; color:var(--text-muted); font-weight:600; display:block;">ตำแหน่งกำหนดขึ้นเอง</span>
            <strong style="font-size:1.6rem; color:var(--text-main); font-weight:800;">${customRoles} <span style="font-size:0.85rem; font-weight:500; color:var(--text-muted);">ตำแหน่ง</span></strong>
          </div>
        </div>
      </div>

      <!-- Action Bar Header -->
      <div class="card" style="margin-bottom:1.5rem; background:#ffffff; border:1px solid var(--border-color); border-radius:12px; padding:1.2rem 1.5rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem;">
        <div>
          <h3 style="font-size:1.2rem; font-weight:800; color:var(--text-main); display:flex; align-items:center; gap:0.6rem; margin:0 0 0.2rem 0;">
            <i class="fa-solid fa-sliders" style="color:var(--accent-gold);"></i> จัดการสิทธิ์การมองเห็นเมนู
          </h3>
          <p style="font-size:0.85rem; color:var(--text-muted); margin:0;">
            ติ๊กเลือกเปิดหรือปิดเมนูที่คุณต้องการให้แต่ละตำแหน่งมองเห็น เมนูที่ถูกปิดจะถูกซ่อนจากพนักงานในตำแหน่งนั้นทันที
          </p>
        </div>

        <div>
          <button class="btn btn-primary" onclick="openCreateRoleModal()" style="font-weight:700; padding:0.6rem 1.2rem; border-radius:8px; display:inline-flex; align-items:center; gap:0.5rem; box-shadow:0 4px 12px rgba(79,70,229,0.25);">
            <i class="fa-solid fa-plus-circle" style="font-size:1rem;"></i> + สร้างตำแหน่งใหม่
          </button>
        </div>
      </div>

      <!-- Roles Grid -->
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap:1.2rem;">
        ${roles.map(r => {
          const allowedCount = (r.allowedMenus || []).length;
          const totalMenus = systemMenus.length;
          const pct = Math.round((allowedCount / totalMenus) * 100);

          return `
            <div class="card" style="background:#ffffff; border:1px solid var(--border-color); border-radius:14px; padding:1.4rem; display:flex; flex-direction:column; justify-content:space-between; transition:all 0.25s ease;">
              <div>
                <!-- Role Header -->
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.8rem;">
                  <div>
                    <h4 style="font-size:1.15rem; color:var(--text-main); font-weight:800; margin:0 0 0.2rem 0; display:flex; align-items:center; gap:0.5rem;">
                      ${r.name}
                    </h4>
                    <span style="font-size:0.75rem; color:var(--text-muted); font-family:monospace; background:rgba(0,0,0,0.03); padding:0.15rem 0.5rem; border-radius:4px; border:1px solid var(--border-color);">
                      รหัส: ${r.code}
                    </span>
                  </div>

                  ${r.isSystemDefault ? `
                    <span style="font-size:0.75rem; font-weight:700; background:rgba(124,58,237,0.08); color:#7c3aed; border:1px solid rgba(124,58,237,0.25); padding:0.25rem 0.6rem; border-radius:20px; display:inline-flex; align-items:center; gap:0.3rem;">
                      <i class="fa-solid fa-lock" style="font-size:0.7rem;"></i> หลักของระบบ
                    </span>
                  ` : `
                    <span style="font-size:0.75rem; font-weight:700; background:rgba(16,185,129,0.08); color:#059669; border:1px solid rgba(16,185,129,0.25); padding:0.25rem 0.6rem; border-radius:20px; display:inline-flex; align-items:center; gap:0.3rem;">
                      <i class="fa-solid fa-user-gear" style="font-size:0.7rem;"></i> กำหนดขึ้นเอง
                    </span>
                  `}
                </div>

                <p style="font-size:0.83rem; color:var(--text-muted); margin-bottom:1rem; min-height:36px; line-height:1.4;">
                  ${r.description || 'ไม่มีคำอธิบายเพิ่มเติม'}
                </p>

                <!-- Permission Progress & Summary Box -->
                <div style="background:rgba(0,0,0,0.02); border:1px solid var(--border-color); padding:1rem; border-radius:10px; margin-bottom:1.2rem;">
                  <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.82rem; margin-bottom:0.6rem; font-weight:700;">
                    <span style="color:var(--text-muted); display:flex; align-items:center; gap:0.4rem;">
                      <i class="fa-solid fa-eye" style="color:var(--accent-primary);"></i> สิทธิ์การเห็นเมนู:
                    </span>
                    <span style="color:${pct === 100 ? '#059669' : (pct > 0 ? 'var(--accent-primary)' : '#e11d48')};">
                      ${allowedCount} จาก ${totalMenus} เมนู (${pct}%)
                    </span>
                  </div>

                  <!-- Progress Bar -->
                  <div style="height:6px; background:rgba(0,0,0,0.08); border-radius:3px; overflow:hidden; margin-bottom:0.8rem;">
                    <div style="height:100%; width:${pct}%; background:linear-gradient(90deg, var(--accent-primary), #10b981); border-radius:3px; transition:width 0.3s ease;"></div>
                  </div>

                  <!-- Menu Pill List -->
                  <div style="display:flex; flex-wrap:wrap; gap:0.35rem; max-height:110px; overflow-y:auto; padding-right:0.2rem;">
                    ${systemMenus.map(m => {
                      const isPermitted = (r.allowedMenus || []).includes(m.key);
                      return `
                        <span style="font-size:0.74rem; font-weight:600; padding:0.22rem 0.55rem; border-radius:6px; display:inline-flex; align-items:center; gap:0.35rem; ${isPermitted ? 'background:rgba(16,185,129,0.08); color:#059669; border:1px solid rgba(16,185,129,0.25);' : 'background:rgba(0,0,0,0.02); color:var(--text-dim); border:1px solid var(--border-color); text-decoration:line-through;'}">
                          <i class="fa-solid ${m.icon}" style="font-size:0.7rem; ${isPermitted ? 'color:#059669;' : 'color:var(--text-dim);'}"></i> ${m.name}
                        </span>
                      `;
                    }).join('')}
                  </div>
                </div>
              </div>

              <!-- Action Buttons -->
              <div style="display:flex; gap:0.6rem; margin-top:0.4rem;">
                <button class="btn btn-warning" style="flex:1; font-weight:700; font-size:0.85rem; padding:0.55rem 0.8rem; border-radius:8px; display:inline-flex; align-items:center; justify-content:center; gap:0.4rem;" onclick="openEditRoleModal('${r._id}')">
                  <i class="fa-solid fa-pen-to-square"></i> กำหนดสิทธิ์เมนู
                </button>
                ${!r.isSystemDefault ? `
                  <button class="btn btn-danger" style="font-weight:700; font-size:0.85rem; padding:0.55rem 0.9rem; border-radius:8px;" onclick="deleteRoleAction('${r._id}')" title="ลบตำแหน่งนี้">
                    <i class="fa-solid fa-trash"></i>
                  </button>
                ` : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div style="color:#ef4444; padding:2rem; text-align:center;">เกิดข้อผิดพลาดในการโหลดตำแหน่ง: ${err.message}</div>`;
  }
}

async function openCreateRoleModal() {
  openModal('กำลังโหลด...', '<div style="padding:2rem; text-align:center;"><i class="fa-solid fa-spinner fa-spin fa-2x"></i></div>');

  try {
    const res = await apiRequest('/roles');
    const systemMenus = res.systemMenus || [];

    const bodyHtml = `
      <form id="create-role-form" onsubmit="event.preventDefault(); submitCreateRole();">
        <div class="form-group" style="margin-bottom:1.1rem;">
          <label style="font-weight:700; color:var(--text-main); display:block; margin-bottom:0.4rem;">ชื่อตำแหน่งงาน <span style="color:#ef4444;">*</span></label>
          <input type="text" id="role-name" class="form-control" placeholder="เช่น ผู้จัดการสาขา, พนักงานฝ่ายขาย, ฝ่ายจัดซื้อ" required style="font-weight:700; padding:0.65rem 0.9rem; border-radius:8px; background:#ffffff;">
        </div>

        <div class="form-group" style="margin-bottom:1.2rem;">
          <label style="font-weight:700; color:var(--text-main); display:block; margin-bottom:0.4rem;">คำอธิบายตำแหน่ง</label>
          <input type="text" id="role-desc" class="form-control" placeholder="ระบุขอบเขตความรับผิดชอบของตำแหน่งนี้" style="padding:0.65rem 0.9rem; border-radius:8px; background:#ffffff;">
        </div>

        <div style="background:rgba(0,0,0,0.03); border:1px solid var(--border-color); border-radius:10px; padding:1rem; margin-bottom:1rem;">
          <div style="font-weight:800; color:var(--accent-primary); font-size:0.92rem; margin-bottom:0.8rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
            <span style="display:flex; align-items:center; gap:0.4rem;"><i class="fa-solid fa-list-check"></i> เลือกเมนูที่อนุญาตให้ตำแหน่งนี้มองเห็น</span>
            <div style="display:flex; gap:0.4rem;">
              <button type="button" class="btn btn-secondary btn-sm" style="font-size:0.75rem; padding:0.25rem 0.6rem; border-radius:6px; font-weight:700;" onclick="toggleAllMenuCheckboxes(true)">
                <i class="fa-solid fa-check-double"></i> เลือกทั้งหมด
              </button>
              <button type="button" class="btn btn-secondary btn-sm" style="font-size:0.75rem; padding:0.25rem 0.6rem; border-radius:6px; font-weight:700;" onclick="toggleAllMenuCheckboxes(false)">
                <i class="fa-solid fa-ban"></i> ล้างทั้งหมด
              </button>
            </div>
          </div>

          <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:0.6rem; max-height:300px; overflow-y:auto; padding-right:0.3rem;">
            ${systemMenus.map(m => `
              <label style="display:flex; align-items:center; gap:0.6rem; background:#ffffff; padding:0.6rem 0.8rem; border-radius:8px; border:1px solid var(--border-color); cursor:pointer; font-size:0.84rem; font-weight:600; color:var(--text-main); transition:all 0.15s ease;">
                <input type="checkbox" class="role-menu-checkbox" value="${m.key}" checked style="accent-color:var(--accent-primary); width:17px; height:17px; cursor:pointer;">
                <span style="display:flex; align-items:center; gap:0.4rem;">
                  <i class="fa-solid ${m.icon}" style="color:var(--accent-primary); font-size:0.9rem;"></i> ${m.name}
                </span>
              </label>
            `).join('')}
          </div>
        </div>
      </form>
    `;

    const footerHtml = `
      <button class="btn btn-secondary" onclick="closeModal()" style="font-weight:600; padding:0.55rem 1.2rem; border-radius:8px;">ยกเลิก</button>
      <button class="btn btn-primary" onclick="submitCreateRole()" style="font-weight:700; padding:0.55rem 1.4rem; border-radius:8px;"><i class="fa-solid fa-save"></i> บันทึกตำแหน่งใหม่</button>
    `;

    openModal('➕ สร้างตำแหน่งงานใหม่ และกำหนดสิทธิ์เมนู', bodyHtml, footerHtml);
  } catch (err) {
    openModal('เกิดข้อผิดพลาด', `<p style="color:#ef4444;">${err.message}</p>`);
  }
}

function toggleAllMenuCheckboxes(selectState) {
  document.querySelectorAll('.role-menu-checkbox').forEach(cb => {
    cb.checked = selectState;
  });
}

async function submitCreateRole() {
  const name = document.getElementById('role-name').value;
  const description = document.getElementById('role-desc').value;
  const allowedMenus = Array.from(document.querySelectorAll('.role-menu-checkbox:checked')).map(cb => cb.value);

  if (!name || !name.trim()) {
    showToast('กรุณากรอกชื่อตำแหน่งงาน', 'error');
    return;
  }

  try {
    const res = await apiRequest('/roles', 'POST', { name, description, allowedMenus });
    if (res.success) {
      showToast(res.message);
      closeModal();
      renderRolesPermissionsView();
    }
  } catch (e) {}
}

async function openEditRoleModal(roleId) {
  openModal('กำลังโหลด...', '<div style="padding:2rem; text-align:center;"><i class="fa-solid fa-spinner fa-spin fa-2x"></i></div>');

  try {
    const res = await apiRequest('/roles');
    const roles = res.roles || [];
    const systemMenus = res.systemMenus || [];
    const role = roles.find(r => String(r._id) === String(roleId));

    if (!role) {
      showToast('ไม่พบข้อมูลตำแหน่ง', 'error');
      closeModal();
      return;
    }

    const currentMenus = role.allowedMenus || [];

    const bodyHtml = `
      <form id="edit-role-form" onsubmit="event.preventDefault(); submitEditRole('${role._id}');">
        <div class="form-group" style="margin-bottom:1.1rem;">
          <label style="font-weight:700; color:var(--text-main); display:block; margin-bottom:0.4rem;">ชื่อตำแหน่งงาน <span style="color:#ef4444;">*</span></label>
          <input type="text" id="edit-role-name" class="form-control" value="${role.name}" required style="font-weight:700; padding:0.65rem 0.9rem; border-radius:8px; background:#ffffff;">
        </div>

        <div class="form-group" style="margin-bottom:1.2rem;">
          <label style="font-weight:700; color:var(--text-main); display:block; margin-bottom:0.4rem;">คำอธิบายตำแหน่ง</label>
          <input type="text" id="edit-role-desc" class="form-control" value="${role.description || ''}" style="padding:0.65rem 0.9rem; border-radius:8px; background:#ffffff;">
        </div>

        <div style="background:rgba(0,0,0,0.03); border:1px solid var(--border-color); border-radius:10px; padding:1rem; margin-bottom:1rem;">
          <div style="font-weight:800; color:var(--accent-primary); font-size:0.92rem; margin-bottom:0.8rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
            <span style="display:flex; align-items:center; gap:0.4rem;"><i class="fa-solid fa-list-check"></i> ติ๊กเลือกเมนูที่อนุญาตให้ตำแหน่งนี้มองเห็น</span>
            <div style="display:flex; gap:0.4rem;">
              <button type="button" class="btn btn-secondary btn-sm" style="font-size:0.75rem; padding:0.25rem 0.6rem; border-radius:6px; font-weight:700;" onclick="toggleAllMenuCheckboxes(true)">
                <i class="fa-solid fa-check-double"></i> เลือกทั้งหมด
              </button>
              <button type="button" class="btn btn-secondary btn-sm" style="font-size:0.75rem; padding:0.25rem 0.6rem; border-radius:6px; font-weight:700;" onclick="toggleAllMenuCheckboxes(false)">
                <i class="fa-solid fa-ban"></i> ล้างทั้งหมด
              </button>
            </div>
          </div>

          <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:0.6rem; max-height:300px; overflow-y:auto; padding-right:0.3rem;">
            ${systemMenus.map(m => {
              const isChecked = currentMenus.includes(m.key);
              return `
                <label style="display:flex; align-items:center; gap:0.6rem; background:#ffffff; padding:0.6rem 0.8rem; border-radius:8px; border:1px solid var(--border-color); cursor:pointer; font-size:0.84rem; font-weight:600; color:var(--text-main); transition:all 0.15s ease;">
                  <input type="checkbox" class="role-menu-checkbox" value="${m.key}" ${isChecked ? 'checked' : ''} style="accent-color:var(--accent-primary); width:17px; height:17px; cursor:pointer;">
                  <span style="display:flex; align-items:center; gap:0.4rem;">
                    <i class="fa-solid ${m.icon}" style="color:var(--accent-primary); font-size:0.9rem;"></i> ${m.name}
                  </span>
                </label>
              `;
            }).join('')}
          </div>
        </div>
      </form>
    `;

    const footerHtml = `
      <button class="btn btn-secondary" onclick="closeModal()" style="font-weight:600; padding:0.55rem 1.2rem; border-radius:8px;">ยกเลิก</button>
      <button class="btn btn-primary" onclick="submitEditRole('${role._id}')" style="font-weight:700; padding:0.55rem 1.4rem; border-radius:8px;"><i class="fa-solid fa-save"></i> บันทึกการแก้ไขสิทธิ์</button>
    `;

    openModal(`✏️ กำหนดสิทธิ์ตำแหน่ง: ${role.name}`, bodyHtml, footerHtml);
  } catch (err) {
    openModal('เกิดข้อผิดพลาด', `<p style="color:#ef4444;">${err.message}</p>`);
  }
}

async function submitEditRole(roleId) {
  const name = document.getElementById('edit-role-name').value;
  const description = document.getElementById('edit-role-desc').value;
  const allowedMenus = Array.from(document.querySelectorAll('.role-menu-checkbox:checked')).map(cb => cb.value);

  if (!name || !name.trim()) {
    showToast('กรุณากรอกชื่อตำแหน่งงาน', 'error');
    return;
  }

  try {
    const res = await apiRequest(`/roles/${roleId}`, 'PUT', { name, description, allowedMenus });
    if (res.success) {
      showToast(res.message);
      closeModal();

      if (state.user) {
        const meRes = await apiRequest('/auth/me');
        if (meRes.success) {
          state.user = meRes.user;
          localStorage.setItem('silmin_user', JSON.stringify(meRes.user));
          updateSidebarMenuByRole((state.user ? state.user.role : 'admin'));
        }
      }

      renderRolesPermissionsView();
    }
  } catch (e) {}
}

async function deleteRoleAction(roleId) {
  if (!confirm('คุณต้องการลบตำแหน่งนี้ใช่หรือไม่?')) return;

  try {
    const res = await apiRequest(`/roles/${roleId}`, 'DELETE');
    if (res.success) {
      showToast(res.message);
      renderRolesPermissionsView();
    }
  } catch (e) {}
}


// Global Event Delegation for Sidebar Navigation
document.addEventListener('click', (e) => {
  const navLink = e.target.closest('.nav-link');
  if (navLink) {
    const targetView = navLink.getAttribute('data-view');
    if (targetView) {
      e.preventDefault();
      navigateTo(targetView);
    }
  }
});

async function openEditStockModal(stockId) {
  const stock = (state.branchStockCache || []).find(st => String(st._id) === String(stockId));
  if (!stock) {
    showToast('ไม่พบข้อมูลสินค้า', 'error');
    return;
  }

  const p = stock.product || {};
  const imei = stock.imei || '';
  const productName = stock.productName || p.name || '';
  const brand = stock.brand || p.brand || '';
  const model = stock.model || p.model || '';
  const capacity = stock.capacity || p.capacity || '';
  const color = stock.color || p.color || '';
  const category = stock.category || p.category || '';
  const purchasePrice = stock.purchase_price || p.purchase_price || 0;
  const sellingPrice = stock.selling_price || p.selling_price || 0;
  const status = stock.status || 'in_stock';

  const bodyHtml = `
    <form id="edit-stock-form" onsubmit="event.preventDefault(); submitEditStock('${stock._id}');">
      <div class="grid-2col" style="gap:1rem; text-align:left;">
        <div class="form-group">
          <label style="font-weight:700; color:var(--text-main); display:block; margin-bottom:0.4rem;">หมายเลข IMEI</label>
          <input type="text" id="es-imei" class="form-control" value="${imei}" required style="padding:0.5rem; border-radius:6px; background:#ffffff;">
        </div>
        <div class="form-group">
          <label style="font-weight:700; color:var(--text-main); display:block; margin-bottom:0.4rem;">ชื่อสินค้า</label>
          <input type="text" id="es-name" class="form-control" value="${productName}" required style="padding:0.5rem; border-radius:6px; background:#ffffff;">
        </div>
        <div class="form-group">
          <label style="font-weight:700; color:var(--text-main); display:block; margin-bottom:0.4rem;">ยี่ห้อ (Brand)</label>
          <input type="text" id="es-brand" class="form-control" value="${brand}" required style="padding:0.5rem; border-radius:6px; background:#ffffff;">
        </div>
        <div class="form-group">
          <label style="font-weight:700; color:var(--text-main); display:block; margin-bottom:0.4rem;">รุ่น (Model)</label>
          <input type="text" id="es-model" class="form-control" value="${model}" required style="padding:0.5rem; border-radius:6px; background:#ffffff;">
        </div>
        <div class="form-group">
          <label style="font-weight:700; color:var(--text-main); display:block; margin-bottom:0.4rem;">ความจุ (Capacity)</label>
          <input type="text" id="es-capacity" class="form-control" value="${capacity}" style="padding:0.5rem; border-radius:6px; background:#ffffff;">
        </div>
        <div class="form-group">
          <label style="font-weight:700; color:var(--text-main); display:block; margin-bottom:0.4rem;">สี (Color)</label>
          <input type="text" id="es-color" class="form-control" value="${color}" style="padding:0.5rem; border-radius:6px; background:#ffffff;">
        </div>
        <div class="form-group">
          <label style="font-weight:700; color:var(--text-main); display:block; margin-bottom:0.4rem;">หมวดหมู่</label>
          <input type="text" id="es-category" class="form-control" value="${category}" style="padding:0.5rem; border-radius:6px; background:#ffffff;">
        </div>
        <div class="form-group">
          <label style="font-weight:700; color:var(--text-main); display:block; margin-bottom:0.4rem;">สถานะสต็อก</label>
          <select id="es-status" class="form-select" style="padding:0.5rem; border-radius:6px; background:#ffffff;">
            <option value="in_stock" ${status === 'in_stock' ? 'selected' : ''}>พร้อมขาย (in_stock)</option>
            <option value="transferred" ${status === 'transferred' ? 'selected' : ''}>โอนย้ายแล้ว (transferred)</option>
            <option value="sold" ${status === 'sold' ? 'selected' : ''}>ขายแล้ว (sold)</option>
            <option value="missing" ${status === 'missing' ? 'selected' : ''}>สูญหาย (missing)</option>
            <option value="in_transit" ${status === 'in_transit' ? 'selected' : ''}>อยู่ระหว่างจัดส่ง (in_transit)</option>
          </select>
        </div>
        <div class="form-group">
          <label style="font-weight:700; color:var(--text-main); display:block; margin-bottom:0.4rem;">ราคาทุน</label>
          <input type="number" id="es-purchase-price" class="form-control" min="0" value="${purchasePrice}" required style="padding:0.5rem; border-radius:6px; background:#ffffff;">
        </div>
        <div class="form-group">
          <label style="font-weight:700; color:var(--text-main); display:block; margin-bottom:0.4rem;">ราคาขาย</label>
          <input type="number" id="es-selling-price" class="form-control" min="0" value="${sellingPrice}" required style="padding:0.5rem; border-radius:6px; background:#ffffff;">
        </div>
      </div>
    </form>
  `;

  const footerHtml = `
    <button class="btn btn-secondary" onclick="closeModal()">ยกเลิก</button>
    <button class="btn btn-primary" onclick="submitEditStock('${stock._id}')"><i class="fa-solid fa-save"></i> บันทึกการแก้ไข</button>
  `;

  openModal('✏️ แก้ไขข้อมูลสินค้าในสต็อกสาขา', bodyHtml, footerHtml);
}

async function submitEditStock(stockId) {
  const imei = document.getElementById('es-imei').value.trim();
  const productName = document.getElementById('es-name').value.trim();
  const brand = document.getElementById('es-brand').value.trim();
  const model = document.getElementById('es-model').value.trim();
  const capacity = document.getElementById('es-capacity').value.trim();
  const color = document.getElementById('es-color').value.trim();
  const category = document.getElementById('es-category').value.trim();
  const status = document.getElementById('es-status').value;
  const purchase_price = parseFloat(document.getElementById('es-purchase-price').value) || 0;
  const selling_price = parseFloat(document.getElementById('es-selling-price').value) || 0;

  if (!imei || !productName || !brand || !model) {
    showToast('กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน', 'error');
    return;
  }

  try {
    const res = await apiRequest(`/stock/${stockId}`, 'PUT', {
      imei,
      productName,
      brand,
      model,
      capacity,
      color,
      category,
      status,
      purchase_price,
      selling_price
    });

    if (res.success) {
      showToast(res.message);
      closeModal();
      const selectEl = document.getElementById('bi-branch-select');
      const currentBranchId = selectEl ? selectEl.value : null;
      renderBranchInventoryView(currentBranchId);
    }
  } catch (err) {
    // Handled
  }
}
function openSingleReleaseStockModal(imei, productName) {
  const bodyHtml = `
    <div style="background:rgba(217,119,6,0.06); border:1px solid rgba(217,119,6,0.2); padding:1rem; border-radius:8px; margin-bottom:1.2rem; text-align:left;">
      <div style="font-weight:800; font-size:1.05rem; color:#d97706; margin-bottom:0.3rem;">
        <i class="fa-solid fa-triangle-exclamation"></i> ยืนยันการจ่ายออกสินค้าค้างสต็อก
      </div>
      <div style="font-size:0.9rem; font-weight:700; color:var(--text-main); margin-top:0.4rem;">
        สินค้า: ${productName}
      </div>
      <div style="font-size:0.83rem; font-family:monospace; color:var(--text-muted); margin-top:0.2rem;">
        IMEI: ${imei}
      </div>
      <div style="font-size:0.82rem; color:#ef4444; font-weight:700; margin-top:0.4rem;">
        * การจ่ายออกสินค้าจะปรับสถานะสินค้าเครื่องนี้เป็น "จ่ายออกแล้ว" และคืนวงเงินเครดิตสาขาตามราคาทุนจริง
      </div>
    </div>

    <form id="release-single-form" onsubmit="event.preventDefault(); submitReleaseStock(['${imei}']);">
      <div class="form-group">
        <label for="release-remark-input" style="font-size:0.85rem; font-weight:700; color:var(--text-main);">
          ระบุเหตุผล / หมายเหตุการจ่ายออก <span style="color:#ef4444;">*</span>
        </label>
        <input type="text" id="release-remark-input" class="form-control" placeholder="ระบุเหตุผล เช่น สินค้าค้างสต็อกครบกำหนดส่งคืนคลัง, เครื่องชำรุดเคลมเปลี่ยนเครื่อง" required style="font-size:0.88rem; margin-top:0.4rem; color:var(--text-main); background:#fff;">
      </div>
    </form>
  `;

  const footerHtml = `
    <button class="btn btn-secondary" onclick="closeModal()">ยกเลิก</button>
    <button class="btn btn-warning" onclick="submitReleaseStock(['${imei}'])" style="background:#d97706; border:none; color:#fff; font-weight:700;">
      <i class="fa-solid fa-circle-minus"></i> ยืนยันจ่ายออกสินค้า
    </button>
  `;

  openModal(`จ่ายออกสินค้า IMEI: ${imei}`, bodyHtml, footerHtml);
  
  setTimeout(() => {
    const input = document.getElementById('release-remark-input');
    if (input) input.focus();
  }, 150);
}

function openBatchReleaseStockModal() {
  const bodyHtml = `
    <div style="background:rgba(217,119,6,0.06); border:1px solid rgba(217,119,6,0.2); padding:1rem; border-radius:8px; margin-bottom:1.2rem; text-align:left;">
      <div style="font-weight:800; font-size:1.05rem; color:#d97706; margin-bottom:0.3rem;">
        <i class="fa-solid fa-triangle-exclamation"></i> จ่ายออกสินค้าค้างสต็อกแบบกลุ่ม
      </div>
      <div style="font-size:0.82rem; color:var(--text-muted); line-height:1.5;">
        กรอกหรือวางหมายเลข IMEI ของสินค้าที่ค้างสต็อกและถึงกำหนดจ่ายออก (แยกแต่ละ IMEI ด้วยการขึ้นบรรทัดใหม่ หรือคั่นด้วยเครื่องหมายจุลภาค ,)
      </div>
      <div style="font-size:0.82rem; color:#ef4444; font-weight:700; margin-top:0.4rem;">
        * การดำเนินการนี้จะคืนวงเงินเครดิตกลับไปยังสาขาตามราคาทุนจริงของเครื่องที่ตรวจพบในคลังสาขานั้นๆ
      </div>
    </div>

    <form id="release-batch-form" onsubmit="event.preventDefault(); submitBatchReleaseStock();">
      <div class="form-group" style="margin-bottom:1rem;">
        <label for="release-imeis-input" style="font-size:0.85rem; font-weight:700; color:var(--text-main);">
          หมายเลข IMEI สินค้า <span style="color:#ef4444;">*</span>
        </label>
        <textarea id="release-imeis-input" class="form-control" rows="6" placeholder="กรอก IMEI หนึ่งตัวต่อบรรทัด เช่น:&#10;358912345678901&#10;358912345678902" required style="font-size:0.88rem; font-family:monospace; margin-top:0.4rem; color:var(--text-main); background:#fff;"></textarea>
      </div>
      <div class="form-group">
        <label for="release-remark-input" style="font-size:0.85rem; font-weight:700; color:var(--text-main);">
          ระบุเหตุผล / หมายเหตุการจ่ายออก <span style="color:#ef4444;">*</span>
        </label>
        <input type="text" id="release-remark-input" class="form-control" placeholder="ระบุเหตุผล เช่น สินค้าค้างสต็อกครบกำหนดส่งคืนคลัง" required style="font-size:0.88rem; margin-top:0.4rem; color:var(--text-main); background:#fff;">
      </div>
    </form>
  `;

  const footerHtml = `
    <button class="btn btn-secondary" onclick="closeModal()">ยกเลิก</button>
    <button class="btn btn-warning" onclick="submitBatchReleaseStock()" style="background:#d97706; border:none; color:#fff; font-weight:700;">
      <i class="fa-solid fa-circle-minus"></i> ยืนยันจ่ายออกทั้งหมด
    </button>
  `;

  openModal(`จ่ายออกสินค้าค้างสต็อก (แบบกลุ่ม)`, bodyHtml, footerHtml);
  
  setTimeout(() => {
    const input = document.getElementById('release-imeis-input');
    if (input) input.focus();
  }, 150);
}

async function submitBatchReleaseStock() {
  const imeisInput = document.getElementById('release-imeis-input');
  if (!imeisInput || !imeisInput.value.trim()) {
    showToast('กรุณากรอกหมายเลข IMEI อย่างน้อย 1 รายการ', 'error');
    return;
  }

  const text = imeisInput.value.trim();
  const imeis = text.split(/[\n,]/).map(im => im.trim()).filter(Boolean);

  if (imeis.length === 0) {
    showToast('ไม่พบหมายเลข IMEI ที่ถูกต้อง', 'error');
    return;
  }

  await submitReleaseStock(imeis);
}

async function submitReleaseStock(imeis) {
  const remarkInput = document.getElementById('release-remark-input');
  const remarks = remarkInput ? remarkInput.value.trim() : '';

  if (!remarks) {
    showToast('กรุณากรอกหมายเหตุหรือเหตุผลการจ่ายออกสินค้า', 'error');
    return;
  }

  try {
    showPageLoading();
    const res = await apiRequest('/stock/release', 'POST', {
      imeis,
      remarks
    });

    hidePageLoading();

    if (res.success) {
      showToast(res.message);
      closeModal();
      
      const selectEl = document.getElementById('bi-branch-select');
      const currentBranchId = selectEl ? selectEl.value : null;
      const statusEl = document.getElementById('bi-status-select');
      const currentStatus = statusEl ? statusEl.value : 'in_stock';
      
      renderBranchInventoryView(currentBranchId, currentStatus);
    }
  } catch (err) {
    hidePageLoading();
  }
}


async function renderSystemLogsView() {
  const container = document.getElementById('content-container');
  container.innerHTML = `<div style="padding: 2rem; text-align: center; color: var(--text-muted);"><i class="fa-solid fa-spinner fa-spin" style="font-size:2rem;"></i> กำลังโหลดประวัติระบบ...</div>`;

  try {
    const res = await apiRequest('/audit/logs');
    const logs = res.logs || [];

    // Extract unique actions for filtering options
    const uniqueActions = [...new Set(logs.map(l => l.action))];

    container.innerHTML = `
      <div class="card" style="margin-bottom:1.5rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem;">
        <div>
          <h3 style="font-size:1.15rem; font-weight:700;"><i class="fa-solid fa-clock-rotate-left" style="color:var(--accent-gold);"></i> ประวัติกิจกรรมระบบ</h3>
          <p style="font-size:0.83rem; color:var(--text-muted);">ระบบบันทึกความเคลื่อนไหว กิจกรรมการแก้ไข ข้อมูลทางการเงิน และประวัติการจัดส่งเรียลไทม์</p>
        </div>
      </div>

      <!-- Logs Filters Toolbar -->
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:0.8rem; margin-bottom:1.5rem; background:rgba(255,255,255,0.02); padding:0.8rem; border-radius:8px; border:1px solid rgba(255,255,255,0.05);">
        <div style="display:flex; flex-direction:column; gap:0.25rem;">
          <label style="font-size:0.75rem; color:var(--text-muted); font-weight:600;">ประเภทกิจกรรม:</label>
          <select id="sl-action-filter" class="form-select" style="font-size:0.82rem;" onchange="filterSystemLogsTable()">
            <option value="all">-- แสดงทุกกิจกรรม --</option>
            ${uniqueActions.map(act => `<option value="${act}">${act}</option>`).join('')}
          </select>
        </div>
        
        <div style="display:flex; flex-direction:column; gap:0.25rem;">
          <label style="font-size:0.75rem; color:var(--text-muted); font-weight:600;">ระดับสิทธิ์ผู้ทำ:</label>
          <select id="sl-role-filter" class="form-select" style="font-size:0.82rem;" onchange="filterSystemLogsTable()">
            <option value="">-- ทุกระดับสิทธิ์ --</option>
            <option value="Admin">ผู้ดูแลระบบ (Admin)</option>
            <option value="Branch Staff">พนักงานประจำสาขา</option>
            <option value="Technical Staff">ช่างเทคนิค</option>
            <option value="Purchasing Staff">พนักงานฝ่ายจัดซื้อ</option>
            <option value="HQ Stock">พนักงานคลังสินค้าส่วนกลาง</option>
          </select>
        </div>

        <div style="display:flex; flex-direction:column; gap:0.25rem;">
          <label style="font-size:0.75rem; color:var(--text-muted); font-weight:600;">เริ่มวันที่:</label>
          <input type="date" id="sl-start-date" class="form-control" style="font-size:0.82rem; padding:0.25rem 0.5rem;" onchange="filterSystemLogsTable()">
        </div>

        <div style="display:flex; flex-direction:column; gap:0.25rem;">
          <label style="font-size:0.75rem; color:var(--text-muted); font-weight:600;">ถึงวันที่:</label>
          <input type="date" id="sl-end-date" class="form-control" style="font-size:0.82rem; padding:0.25rem 0.5rem;" onchange="filterSystemLogsTable()">
        </div>

        <div style="display:flex; flex-direction:column; gap:0.25rem; grid-column: 1 / -1;">
          <label style="font-size:0.75rem; color:var(--text-muted); font-weight:600;">ค้นหาข้อมูลคำสำคัญ:</label>
          <input type="text" id="sl-search-input" class="form-control" placeholder="ค้นหาชื่อผู้ดำเนินการ, สิทธิ์, กิจกรรม, รหัสเป้าหมาย หรือรายละเอียดกิจกรรมทั้งหมด..." style="font-size:0.82rem; padding:0.35rem 0.6rem;" onkeyup="filterSystemLogsTable()">
        </div>
      </div>

      <div class="table-container">
        <table class="data-table" id="sl-table">
          <thead>
            <tr>
              <th style="width:180px;">วันเวลาที่ทำรายการ</th>
              <th style="width:150px;">ผู้ดำเนินการ / สิทธิ์</th>
              <th style="width:180px;">กิจกรรม (Action)</th>
              <th>เป้าหมาย</th>
              <th>รายละเอียดกิจกรรม</th>
            </tr>
          </thead>
          <tbody>
            ${logs.length === 0 ? `<tr><td colspan="5" style="text-align:center; color:var(--text-muted); padding:2rem;">ไม่พบประวัติกิจกรรมใดๆ ในระบบ</td></tr>` : ''}
            ${logs.map(l => {
              const dateObj = new Date(l.createdAt);
              const dt = dateObj.toLocaleString('th-TH');
              const isoDate = dateObj.toISOString().split('T')[0];
              const usrStr = `<strong>${l.username}</strong><br><span style="font-size:0.75rem; color:var(--text-muted);">${l.userRole}</span>`;
              const actionBadge = `<span class="badge" style="background:${getLogActionBg(l.action)}; color:#fff; font-weight:700;">${l.action}</span>`;
              const entityStr = `<strong>${l.entity || '-'}</strong><br><span style="font-size:0.72rem; color:var(--text-muted); font-family:monospace;">ID: ${l.entityId || '-'}</span>`;
              const detailsHtml = formatLogDetails(l);
              
              // Extract plain text details for search matching
              const detailsText = detailsHtml.replace(/<[^>]*>/g, ' ');
              const searchStr = (l.username + ' ' + l.userRole + ' ' + l.action + ' ' + (l.entity || '') + ' ' + (l.entityId || '') + ' ' + detailsText).toLowerCase();

              return `
                <tr class="sl-row" data-action="${l.action}" data-role="${l.userRole || ''}" data-search="${searchStr}" data-date="${isoDate}">
                  <td style="font-size:0.82rem; color:var(--text-muted);">${dt}</td>
                  <td>${usrStr}</td>
                  <td>${actionBadge}</td>
                  <td>${entityStr}</td>
                  <td>${detailsHtml}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div style="color:#ef4444; padding:2rem; text-align:center;">เกิดข้อผิดพลาดในการโหลดประวัติระบบ: ${err.message}</div>`;
  }
}

function getLogActionBg(action) {
  switch (action) {
    case 'EDIT_BRANCH_STOCK': return '#d97706'; // Gold
    case 'CREATE_TRANSFER': return '#2563eb'; // Blue
    case 'TRANSFER_STATUS_COMPLETED': return '#16a34a'; // Green
    case 'TRANSFER_STATUS_REJECTED': return '#dc2626'; // Red
    case 'SUBMIT_GOODS_RECEIPT': return '#6366f1'; // Indigo
    case 'CONFIRM_GOODS_RECEIPT': return '#0d9488'; // Teal
    case 'CREATE_ROLE': return '#7c3aed'; // Purple
    default: return '#4b5563'; // Gray
  }
}

function formatLogDetails(log) {
  const d = log.details || {};
  let html = '';
  if (log.action === 'EDIT_BRANCH_STOCK') {
    html += `<div><strong>สาขา:</strong> ${d.branch || '-'}</div>`;
    html += `<div><strong>สินค้า:</strong> ${d.productName || '-'} (IMEI: <code>${d.imei || '-'}</code>)</div>`;
    if (d.changes && d.changes.new) {
      html += `<div style="margin-top:0.4rem; font-size:0.78rem; background:rgba(0,0,0,0.2); padding:0.4rem 0.6rem; border-radius:6px; border:1px solid rgba(255,255,255,0.05);">`;
      html += `<div style="font-weight:700; color:var(--accent-gold); margin-bottom:0.2rem;"><i class="fa-solid fa-pen"></i> ฟิลด์ที่แก้ไข:</div>`;
      for (const field of Object.keys(d.changes.new)) {
        const oldV = d.changes.old ? d.changes.old[field] : '-';
        const newV = d.changes.new[field];
        html += `<div>• <strong style="color:var(--text-muted);">${field}:</strong> <span style="text-decoration:line-through; color:#ef4444;">${oldV}</span> <i class="fa-solid fa-arrow-right" style="font-size:0.7rem; color:var(--text-muted);"></i> <span style="color:#34d399; font-weight:700;">${newV}</span></div>`;
      }
      html += `</div>`;
    }
  } else {
    html += `<div style="font-size:0.8rem; line-height:1.4;">`;
    for (const [k, v] of Object.entries(d)) {
      if (typeof v === 'object' && v !== null) {
        html += `<div><strong>${k}:</strong> <pre style="margin:0; font-size:0.74rem; background:rgba(0,0,0,0.2); padding:0.2rem; border-radius:4px; font-family:monospace; color:#38bdf8;">${JSON.stringify(v, null, 2)}</pre></div>`;
      } else {
        html += `<div><strong>${k}:</strong> ${v}</div>`;
      }
    }
    html += `</div>`;
  }
  return html;
}

function filterSystemLogsTable() {
  const filterVal = document.getElementById('sl-action-filter').value;
  const roleFilterVal = document.getElementById('sl-role-filter').value;
  const startDate = document.getElementById('sl-start-date').value;
  const endDate = document.getElementById('sl-end-date').value;
  const searchVal = document.getElementById('sl-search-input').value.toLowerCase().trim();

  document.querySelectorAll('.sl-row').forEach(row => {
    const act = row.getAttribute('data-action') || '';
    const role = row.getAttribute('data-role') || '';
    const searchData = row.getAttribute('data-search') || '';
    const rowDate = row.getAttribute('data-date') || '';

    let matchesFilter = (filterVal === 'all' || act === filterVal);
    let matchesRole = (!roleFilterVal || role.toLowerCase() === roleFilterVal.toLowerCase());
    let matchesDate = true;
    let matchesSearch = (!searchVal || searchData.includes(searchVal));

    if (startDate && rowDate < startDate) matchesDate = false;
    if (endDate && rowDate > endDate) matchesDate = false;

    if (matchesFilter && matchesRole && matchesDate && matchesSearch) {
      row.style.display = '';
    } else {
      row.style.display = 'none';
    }
  });
}

function viewAuditPhoto(url) {
  if (!url) {
    showToast('ไม่พบรูปภาพประกอบ', 'error');
    return;
  }
  const bodyHtml = `
    <div style="text-align:center;">
      <img src="${url}" style="max-width:100%; max-height:500px; border-radius:8px; border:2px solid var(--accent-primary); box-shadow:0 4px 15px rgba(0,0,0,0.3);">
    </div>
  `;
  const footerHtml = `<button class="btn btn-secondary" onclick="closeModal()">ปิดหน้าต่าง</button>`;
  openModal('🖼️ รูปถ่ายตัวเครื่อง / ป้าย IMEI สินค้า', bodyHtml, footerHtml);
}

function openRecordCostReturnModal(saleId, receiptNumber, costAmount) {
  const bodyHtml = `
    <div style="background:rgba(0,0,0,0.03); border:1px solid var(--border-color); padding:1rem; border-radius:6px; margin-bottom:1.2rem; text-align:left;">
      <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem; font-size:0.88rem;">
        <span>เลขที่ใบเสร็จ: <strong>${receiptNumber}</strong></span>
        <span>ต้นทุนเดิมระบบ: ฿${Number(costAmount).toLocaleString()}</span>
      </div>
      <div style="display:flex; flex-direction:column; gap:0.4rem;">
        <label for="cr-actual-cost" style="font-weight:700; color:#d97706; font-size:0.92rem;">
          ยอดเงินต้นทุนที่โอนคืนจริง (Actual Cost Returned):
        </label>
        <div style="position:relative; display:flex; align-items:center;">
          <span style="position:absolute; left:10px; font-weight:800; color:#d97706;">฿</span>
          <input type="number" id="cr-actual-cost" class="form-control" value="${costAmount}" style="padding-left:1.8rem; font-weight:800; font-size:1.15rem; color:#d97706; background:#ffffff; border:1.5px solid var(--border-color);" required min="0" step="0.01">
        </div>
      </div>
    </div>

    <form id="record-cost-return-form" onsubmit="event.preventDefault(); submitCostReturn('${saleId}');">
      <div class="form-group" style="text-align:left;">
        <label for="cr-date" style="color:#059669; font-weight:700;">
          <i class="fa-solid fa-calendar-days"></i> เลือกวันที่ โอนเงินต้นทุนคืนบริษัทจริง (จำเป็นต้องเลือก)
        </label>
        <input type="date" id="cr-date" class="form-control" value="" required onclick="if(this.showPicker) this.showPicker();" style="cursor:pointer; font-weight:700; padding:0.5rem; border-radius:6px;">
        <span style="font-size:0.75rem; color:var(--text-muted); display:block; margin-top:0.3rem;">* เมื่อกดบันทึก ระบบจะคืนวงเงินของสาขาคุณเท่ากับยอดต้นทุนที่โอนคืนจริงนี้ทันที</span>
      </div>

      <div class="form-group" style="text-align:left;">
        <label for="cr-remarks">หมายเหตุ / เลขอ้างอิงสลิปโอนเงิน (ถ้ามี)</label>
        <textarea id="cr-remarks" class="form-control" rows="2" placeholder="เช่น โอนคืนทุนเครื่อง iPhone 11 เข้าบัญชีส่วนกลางแล้ว" style="padding:0.5rem; border-radius:6px;"></textarea>
      </div>
    </form>
  `;

  const footerHtml = `
    <button class="btn btn-secondary" onclick="closeModal()">ยกเลิก</button>
    <button class="btn btn-success" onclick="submitCostReturn('${saleId}')"><i class="fa-solid fa-check-double"></i> ยืนยันบันทึกโอนทุนคืน</button>
  `;

  openModal(`บันทึกโอนเงินทุนคืนบริษัท: ${receiptNumber}`, bodyHtml, footerHtml);
}

async function submitCostReturn(saleId) {
  const dateInput = document.getElementById('cr-date');
  const payoutReceivedDate = dateInput ? dateInput.value.trim() : '';
  const remarks = document.getElementById('cr-remarks') ? document.getElementById('cr-remarks').value : '';
  const actualCostInput = document.getElementById('cr-actual-cost');
  const actualCostReturned = actualCostInput ? Number(actualCostInput.value) : 0;

  if (!payoutReceivedDate) {
    showToast('กรุณาระบุและเลือกวันที่โอนเงินคืนบริษัทจริงก่อนกดบันทึก', 'error');
    if (dateInput) {
      dateInput.focus();
      if (dateInput.showPicker) dateInput.showPicker();
    }
    return;
  }

  if (isNaN(actualCostReturned) || actualCostReturned < 0) {
    showToast('กรุณาระบุยอดเงินต้นทุนโอนจริงที่ถูกต้อง', 'error');
    if (actualCostInput) actualCostInput.focus();
    return;
  }

  try {
    const res = await apiRequest(`/pos/return-cost/${saleId}`, 'PUT', {
      payoutReceivedDate,
      remarks,
      actualCostReturned
    });

    if (res.success) {
      showToast(res.message);
      closeModal();
      renderFinanceView(); // Reload finance view to show updated status
    }
  } catch (err) {
    // Handled
  }
}


async function renderSalesHistoryView(selectedBranchId = null, filterStatus = '', startDate = '', endDate = '') {
  const container = document.getElementById('content-container');
  container.innerHTML = `<div style="padding: 2rem; text-align: center; color: var(--text-muted);"><i class="fa-solid fa-spinner fa-spin" style="font-size:2rem;"></i> กำลังโหลดประวัติการขายสินค้า...</div>`;

  try {
    const isHqUser = !state.user.branch || state.user.branch.code === 'BR-HQ01' || (state.user.branch.name && state.user.branch.name.includes('สำนักงานใหญ่'));
    const isAdminOrHq = ['admin', 'hq_stock_staff'].includes((state.user ? state.user.role : 'admin')) || isHqUser;
    const hasVoidPermission = (state.user && state.user.role === 'admin') || (state.user && Array.isArray(state.user.allowedMenus) && state.user.allowedMenus.includes('void-sale'));

    let branchIdParam = selectedBranchId;
    if (isAdminOrHq && branchIdParam === null) {
      branchIdParam = 'all';
    }

    const queryParams = new URLSearchParams();
    if (branchIdParam && branchIdParam !== 'all') {
      queryParams.append('branchId', branchIdParam);
    }
    if (filterStatus) {
      queryParams.append('status', filterStatus);
    }
    if (startDate) {
      queryParams.append('startDate', startDate);
    }
    if (endDate) {
      queryParams.append('endDate', endDate);
    }

    const res = await apiRequest(`/pos/history?${queryParams.toString()}`);
    const sales = res.sales || [];
    state.salesCache = sales;

    const currentBranchName = branchIdParam === 'all' ? 'ทุกสาขา' : 
      (state.masterOptions.branches && state.masterOptions.branches.find(b => b._id === branchIdParam) ? state.masterOptions.branches.find(b => b._id === branchIdParam).name : 'สาขาของคุณ');

    container.innerHTML = `
      <!-- Filter Bar -->
      <div class="card" style="margin-bottom:1.5rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem;">
        <div>
          <h3 style="font-size:1.2rem; font-weight:700; display:flex; align-items:center; gap:0.5rem;">
            <i class="fa-solid fa-clock-rotate-left" style="color:var(--accent-primary);"></i> ประวัติการขายสินค้า: ${currentBranchName}
          </h3>
          <p style="font-size:0.85rem; color:var(--text-muted);">รายการประวัติบิลขายและใบเสร็จรับเงินทั้งหมด (รวม ${sales.length} รายการ)</p>
        </div>

        <div style="display:flex; align-items:center; gap:0.8rem; flex-wrap:wrap;">
          ${isAdminOrHq ? `
            <div style="display:flex; align-items:center; gap:0.4rem;">
              <label style="font-size:0.82rem; font-weight:600; color:var(--text-muted);">เลือกสาขา:</label>
              <select id="sh-branch-select" class="form-select" style="width:auto; font-size:0.82rem; padding:0.25rem 0.5rem;" onchange="renderSalesHistoryView(this.value, document.getElementById('sh-status-select').value, document.getElementById('sh-start-date').value, document.getElementById('sh-end-date').value)">
                <option value="all" ${branchIdParam === 'all' ? 'selected' : ''}>ทุกสาขา (ทั้งหมด)</option>
                ${state.masterOptions.branches ? state.masterOptions.branches.map(b => `<option value="${b._id}" ${branchIdParam === b._id ? 'selected' : ''}>${b.name}</option>`).join('') : ''}
              </select>
            </div>
          ` : ''}
          <div style="display:flex; align-items:center; gap:0.4rem;">
            <label style="font-size:0.82rem; font-weight:600; color:var(--text-muted);">สถานะบิล:</label>
            <select id="sh-status-select" class="form-select" style="width:auto; font-size:0.82rem; padding:0.25rem 0.5rem;" onchange="renderSalesHistoryView('${branchIdParam || ''}', this.value, document.getElementById('sh-start-date').value, document.getElementById('sh-end-date').value)">
              <option value="" ${filterStatus === '' ? 'selected' : ''}>-- ทุกสถานะ --</option>
              <option value="completed" ${filterStatus === 'completed' ? 'selected' : ''}>ทำรายการสำเร็จ</option>
              <option value="voided" ${filterStatus === 'voided' ? 'selected' : ''}>ยกเลิกบิลแล้ว</option>
            </select>
          </div>
          <div style="display:flex; align-items:center; gap:0.4rem;">
            <label style="font-size:0.82rem; font-weight:600; color:var(--text-muted);">เริ่มวันที่:</label>
            <input type="date" id="sh-start-date" class="form-control" value="${startDate}" style="width:auto; font-size:0.82rem; padding:0.25rem 0.5rem;" onchange="renderSalesHistoryView('${branchIdParam || ''}', document.getElementById('sh-status-select').value, this.value, document.getElementById('sh-end-date').value)">
          </div>
          <div style="display:flex; align-items:center; gap:0.4rem;">
            <label style="font-size:0.82rem; font-weight:600; color:var(--text-muted);">ถึงวันที่:</label>
            <input type="date" id="sh-end-date" class="form-control" value="${endDate}" style="width:auto; font-size:0.82rem; padding:0.25rem 0.5rem;" onchange="renderSalesHistoryView('${branchIdParam || ''}', document.getElementById('sh-status-select').value, document.getElementById('sh-start-date').value, this.value)">
          </div>
          ${(startDate || endDate) ? `
            <button class="btn btn-secondary btn-sm" onclick="renderSalesHistoryView('${branchIdParam || ''}', document.getElementById('sh-status-select').value, '', '')" style="font-size:0.82rem; padding:0.25rem 0.5rem; font-weight:700;">
              <i class="fa-solid fa-rotate-left"></i> ล้างวันที่
            </button>
          ` : ''}
          <input type="text" id="sh-search-input" class="form-control" placeholder="ค้นหาเลขที่บิล, ชื่อลูกค้า, IMEI..." style="width:200px; font-size:0.82rem; padding:0.25rem 0.5rem;" onkeyup="filterSalesHistoryTable()">
        </div>
      </div>

      <!-- Data Table -->
      <div class="table-container">
        <table class="data-table" id="sh-table">
          <thead>
            <tr>
              <th style="width:50px; text-align:center;">#</th>
              <th>เลขที่ใบเสร็จ</th>
              <th>วันที่ / เวลา</th>
              ${branchIdParam === 'all' ? '<th>สาขา</th>' : ''}
              <th>ลูกค้า</th>
              <th>ยอดเงินสุทธิ</th>
              <th>ชำระโดย</th>
              <th>ผู้ขาย</th>
              <th style="text-align:center;">สถานะ</th>
              <th style="text-align:center;">ดำเนินการ</th>
            </tr>
          </thead>
          <tbody>
            ${sales.length === 0 ? `<tr><td colspan="${branchIdParam === 'all' ? 10 : 9}" style="text-align:center; color:var(--text-muted); padding:2rem;">ไม่พบข้อมูลประวัติการขายสินค้า</td></tr>` : ''}
            ${sales.map((sale, idx) => {
              const customer = sale.customer || {};
              const seller = sale.soldBy || {};
              const branch = sale.branch || {};
              const formattedDate = new Date(sale.createdAt).toLocaleDateString('th-TH') + ' ' + new Date(sale.createdAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.';

              let payMethodText = '-';
              if (sale.paymentMethod === 'cash') payMethodText = 'เงินสด';
              else if (sale.paymentMethod === 'transfer') payMethodText = 'โอนเงิน';
              else if (sale.paymentMethod === 'credit_card') payMethodText = 'บัตรเครดิต';
              else if (sale.paymentMethod === 'finance') payMethodText = `จัดไฟแนนซ์ (${sale.financeDetails ? sale.financeDetails.companyName : ''})`;

              return `
                <tr class="sh-row" data-search="${(sale.receiptNumber + ' ' + (customer.name || '') + ' ' + (customer.phone || '') + ' ' + (sale.items ? sale.items.map(item => item.imei).join(' ') : '')).toLowerCase()}">
                  <td style="text-align:center; color:var(--text-muted); font-size:0.8rem;">${idx + 1}</td>
                  <td><strong style="color:var(--accent-primary); font-family:monospace;">${sale.receiptNumber}</strong></td>
                  <td><span style="font-size:0.82rem;">${formattedDate}</span></td>
                  ${branchIdParam === 'all' ? `<td><span class="badge badge-gray" style="font-weight:700;">${branch.name || '-'}</span></td>` : ''}
                  <td>
                    <strong>${customer.name || 'ลูกค้าทั่วไป'}</strong>
                    ${customer.phone && customer.phone !== '-' ? `<br><span style="font-size:0.75rem; color:var(--text-muted);"><i class="fa-solid fa-phone"></i> ${customer.phone}</span>` : ''}
                    <div style="margin-top:0.4rem; font-size:0.76rem; border-top:1px dashed var(--border-color); padding-top:0.3rem; line-height:1.4;">
                      ${(sale.items || []).map(item => `
                        <div style="margin-bottom:0.25rem;">
                          <strong style="color:var(--text-main);">• ${item.productName}</strong> <span style="font-family:monospace; color:var(--accent-gold); font-weight:700;">(${item.imei})</span><br>
                          <span style="color:var(--text-muted);">ราคาแนะนำ: ฿${(item.standardPrice || item.unitPrice).toLocaleString()} | ขายจริง: <strong style="color:#059669;">฿${item.unitPrice.toLocaleString()}</strong></span>
                        </div>
                      `).join('')}
                    </div>
                  </td>
                  <td><strong style="color:#059669;">฿${(sale.grandTotal || 0).toLocaleString()}</strong></td>
                  <td><span style="font-size:0.82rem;">${payMethodText}</span></td>
                  <td><span style="font-size:0.82rem;">${seller.fullName || seller.username || 'Staff'}</span></td>
                  <td style="text-align:center;">
                    <span class="badge badge-${sale.status === 'completed' ? 'green' : 'red'}">
                      ${sale.status === 'completed' ? 'สำเร็จ' : 'ยกเลิกบิล'}
                    </span>
                  </td>
                  <td style="text-align:center; white-space:nowrap;">
                    <button class="btn btn-secondary btn-sm" onclick="reprintReceiptVoucher(${idx})">
                      <i class="fa-solid fa-print"></i> พิมพ์บิล
                    </button>
                    ${sale.status === 'completed' && hasVoidPermission ? `
                      <button class="btn btn-danger btn-sm" style="margin-left: 0.35rem;" onclick="voidSaleAction('${sale._id}', '${sale.receiptNumber}')">
                        <i class="fa-solid fa-ban"></i> ยกเลิกบิล
                      </button>
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
    container.innerHTML = `<div style="color:#ef4444; padding:2rem;">เกิดข้อผิดพลาดในการโหลดประวัติการขายสินค้า: ${err.message}</div>`;
  }
}

function voidSaleAction(saleId, receiptNumber) {
  window.currentVoidBranchFilter = document.getElementById('sh-branch-select') ? document.getElementById('sh-branch-select').value : null;
  window.currentVoidStatusFilter = document.getElementById('sh-status-select') ? document.getElementById('sh-status-select').value : '';
  window.currentVoidStartDateFilter = document.getElementById('sh-start-date') ? document.getElementById('sh-start-date').value : '';
  window.currentVoidEndDateFilter = document.getElementById('sh-end-date') ? document.getElementById('sh-end-date').value : '';

  const bodyHtml = `
    <div style="text-align:center; padding:0.5rem 0;">
      <i class="fa-solid fa-triangle-exclamation" style="font-size:3.2rem; color:#d97706; margin-bottom:0.8rem; display:block;"></i>
      <h4 style="font-size:1.1rem; font-weight:800; color:var(--text-main); margin-bottom:0.6rem;">คุณแน่ใจหรือไม่ที่จะยกเลิกบิลขายนี้?</h4>
      <div style="font-size:1.15rem; font-weight:800; color:var(--accent-primary); font-family:monospace; background:rgba(0,0,0,0.025); border:1px solid var(--border-color); padding:0.5rem; border-radius:6px; margin:0.8rem auto; max-width:320px; letter-spacing:0.5px;">
        ${receiptNumber}
      </div>
      <p style="font-size:0.82rem; color:var(--text-muted); line-height:1.5; margin:0;">
        เมื่อทำรายการสำเร็จ สถานะบิลจะถูกเปลี่ยนเป็น "ยกเลิกบิล"<br>
        และระบบจะทำการ<strong style="color:#e11d48;">คืนสินค้าทั้งหมดในบิลเข้าคลังสต็อกของแต่ละสาขา</strong>ให้โดยอัตโนมัติ
      </p>
      <div style="background:rgba(225,29,72,0.05); border:1px solid rgba(225,29,72,0.2); color:#e11d48; padding:0.6rem 0.8rem; border-radius:6px; font-size:0.78rem; font-weight:600; margin-top:1rem; line-height:1.4;">
        ⚠️ คำเตือน: รายการที่ยกเลิกแล้วจะไม่สามารถกู้คืนหรือแก้ไขสถานะได้อีก!
      </div>
    </div>
  `;

  const footerHtml = `
    <button class="btn btn-secondary" onclick="closeModal()">ย้อนกลับ</button>
    <button class="btn btn-danger" onclick="submitVoidSale('${saleId}', '${receiptNumber}')"><i class="fa-solid fa-ban"></i> ยืนยันการยกเลิกบิล</button>
  `;

  openModal(`ยืนยันการยกเลิกบิลขาย`, bodyHtml, footerHtml);
}

async function submitVoidSale(saleId, receiptNumber) {
  try {
    const res = await apiRequest(`/pos/void/${saleId}`, 'PUT');
    if (res.success) {
      showToast(res.message);
      closeModal();
      renderSalesHistoryView(window.currentVoidBranchFilter, window.currentVoidStatusFilter, window.currentVoidStartDateFilter, window.currentVoidEndDateFilter);
    }
  } catch (err) {
    // Handled
  }
}

function filterSalesHistoryTable() {
  const query = document.getElementById('sh-search-input').value.toLowerCase().trim();
  document.querySelectorAll('.sh-row').forEach(row => {
    const searchData = row.getAttribute('data-search') || '';
    if (searchData.includes(query)) {
      row.style.display = '';
    } else {
      row.style.display = 'none';
    }
  });
}


function reprintReceiptVoucher(index) {
  const sale = (state.salesCache || [])[index];
  if (sale) {
    openSelectReceiptTypeModal(sale);
  } else {
    showToast('ไม่พบข้อมูลบิลขายนี้ในระบบแคช กรุณารีเฟรชหน้าเว็บ', 'error');
  }
}


async function renderReleaseStockView(selectedBranchId = null, startDate = '', endDate = '') {
  const container = document.getElementById('content-container');
  container.innerHTML = `<div style="padding: 2rem; text-align: center; color: var(--text-muted);"><i class="fa-solid fa-spinner fa-spin" style="font-size:2rem;"></i> กำลังโหลดระบบจ่ายออกสินค้า...</div>`;

  try {
    // Ensure master options for branches are loaded
    if (!state.masterOptions || !state.masterOptions.branches) {
      const initRes = await apiRequest('/pos/init-options');
      if (initRes.success) {
        state.masterOptions = state.masterOptions || {};
        state.masterOptions.branches = initRes.branches || [];
      }
    }

    const isHqUser = !state.user.branch || state.user.branch.code === 'BR-HQ01' || (state.user.branch.name && state.user.branch.name.includes('สำนักงานใหญ่'));
    const isAdminOrHq = ['admin', 'hq_stock_staff'].includes((state.user ? state.user.role : 'admin')) || isHqUser;

    let branchIdParam = selectedBranchId;
    if (isAdminOrHq && branchIdParam === null) {
      branchIdParam = 'all';
    }

    const queryParams = new URLSearchParams();
    if (branchIdParam && branchIdParam !== 'all') {
      queryParams.append('branchId', branchIdParam);
    }
    if (startDate) {
      queryParams.append('startDate', startDate);
    }
    if (endDate) {
      queryParams.append('endDate', endDate);
    }

    const res = await apiRequest(`/stock/release/history?${queryParams.toString()}`);
    const history = res.history || [];

    const totalRefunded = history.reduce((sum, item) => sum + (item.purchase_price || 0), 0);

    container.innerHTML = `
      <!-- Summary Info Cards -->
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap:1.2rem; margin-bottom:1.5rem; text-align:left;">
        <div class="card" style="display:flex; align-items:center; gap:1rem; padding:1.2rem;">
          <div style="background:rgba(217,119,6,0.1); color:#d97706; padding:0.8rem; border-radius:10px; font-size:1.5rem; width:50px; height:50px; display:flex; justify-content:center; align-items:center;">
            <i class="fa-solid fa-circle-minus"></i>
          </div>
          <div>
            <div style="font-size:0.85rem; color:var(--text-muted); font-weight:700;">จำนวนที่จ่ายออกสะสม</div>
            <div style="font-size:1.6rem; font-weight:800; color:var(--text-main); margin-top:0.2rem;">${history.length} เครื่อง</div>
          </div>
        </div>

        <div class="card" style="display:flex; align-items:center; gap:1rem; padding:1.2rem;">
          <div style="background:rgba(16,185,129,0.1); color:#10b981; padding:0.8rem; border-radius:10px; font-size:1.5rem; width:50px; height:50px; display:flex; justify-content:center; align-items:center;">
            <i class="fa-solid fa-hand-holding-dollar"></i>
          </div>
          <div>
            <div style="font-size:0.85rem; color:var(--text-muted); font-weight:700;">คืนเครดิตกลับสาขาแล้ว</div>
            <div style="font-size:1.6rem; font-weight:800; color:#10b981; margin-top:0.2rem;">฿${totalRefunded.toLocaleString()}</div>
          </div>
        </div>
      </div>

      <!-- Action Panel Columns -->
      <div class="grid-2col" style="gap:1.5rem; margin-bottom:1.5rem; align-items:stretch;">
        <!-- Single Release Form Card -->
        <div class="card" style="text-align:left; display:flex; flex-direction:column; justify-content:space-between;">
          <div>
            <h3 style="font-size:1.1rem; font-weight:800; color:var(--accent-primary); margin-bottom:0.4rem; display:flex; align-items:center; gap:0.5rem;">
              <i class="fa-solid fa-barcode"></i> จ่ายออกสินค้ารายเครื่อง
            </h3>
            <p style="font-size:0.82rem; color:var(--text-muted); margin-bottom:1.2rem;">สแกนหรือกรอกหมายเลข IMEI เพื่อทำรายการจ่ายออกเดี่ยว</p>
            
            <form id="release-single-dashboard-form" onsubmit="event.preventDefault(); handleDashboardSingleRelease();">
              <div class="form-group" style="margin-bottom:1rem;">
                <label style="font-size:0.85rem; font-weight:700; color:var(--text-main);">หมายเลข IMEI <span style="color:#ef4444;">*</span></label>
                <input type="text" id="db-release-imei" class="form-control" placeholder="พิมพ์หรือยิงสแกน IMEI..." required style="margin-top:0.4rem; padding:0.55rem; background:#fff;">
              </div>
              <div class="form-group" style="margin-bottom:1rem;">
                <label style="font-size:0.85rem; font-weight:700; color:var(--text-main);">หมายเหตุการจ่ายออก <span style="color:#ef4444;">*</span></label>
                <input type="text" id="db-release-single-remark" class="form-control" placeholder="ระบุเหตุผล เช่น ค้างสต็อกเกิน 90 วัน, ตกรุ่นส่งคืนคลัง" required style="margin-top:0.4rem; padding:0.55rem; background:#fff;">
              </div>
              <button class="btn btn-warning" type="submit" style="width:100%; background:#d97706; border:none; color:#fff; font-weight:700; padding:0.6rem;">
                <i class="fa-solid fa-circle-minus"></i> ยืนยันจ่ายออกเครื่องเดี่ยว
              </button>
            </form>
          </div>
        </div>

        <!-- Batch Release Form Card -->
        <div class="card" style="text-align:left;">
          <h3 style="font-size:1.1rem; font-weight:800; color:var(--accent-primary); margin-bottom:0.4rem; display:flex; align-items:center; gap:0.5rem;">
            <i class="fa-solid fa-layer-group"></i> จ่ายออกสินค้าแบบกลุ่ม
          </h3>
          <p style="font-size:0.82rem; color:var(--text-muted); margin-bottom:1.2rem;">เพิ่มช่องกรอกหมายเลข IMEI เพื่อทำรายการจ่ายออกแบบล็อต</p>
          
          <form id="release-batch-dashboard-form" onsubmit="event.preventDefault(); handleDashboardBatchRelease();">
            <div class="form-group" style="margin-bottom:1rem;">
              <label style="font-size:0.85rem; font-weight:700; color:var(--text-main); display:block; margin-bottom:0.4rem;">หมายเลข IMEI สินค้า <span style="color:#ef4444;">*</span></label>
              <div id="batch-imei-fields-container" style="display:flex; flex-direction:column; gap:0.5rem; max-height:240px; overflow-y:auto; padding-right:5px; margin-bottom:0.6rem;">
                <div class="batch-imei-row" style="display:flex; gap:0.5rem; align-items:center;">
                  <input type="text" class="form-control db-release-batch-imei-input" placeholder="พิมพ์หรือยิงสแกน IMEI..." required onkeydown="handleBatchImeiKeydown(event, this)" style="padding:0.55rem; background:#fff; font-family:monospace; flex:1;">
                  <button type="button" class="btn btn-secondary btn-sm" onclick="removeBatchImeiField(this)" style="padding:0.55rem 0.8rem; background:var(--border-color); border:none; color:var(--text-muted); cursor:pointer;"><i class="fa-solid fa-xmark"></i></button>
                </div>
              </div>
              <button type="button" class="btn btn-secondary btn-sm" onclick="addBatchImeiField()" style="font-size:0.8rem; padding:0.35rem 0.7rem; display:inline-flex; align-items:center; gap:0.3rem; font-weight:700; background:#f3f4f6; color:#4b5563; border:1px solid #d1d5db; border-radius:6px; cursor:pointer;">
                <i class="fa-solid fa-plus"></i> เพิ่มช่อง IMEI
              </button>
            </div>
            <div class="form-group" style="margin-bottom:1rem;">
              <label style="font-size:0.85rem; font-weight:700; color:var(--text-main);">หมายเหตุการจ่ายออก <span style="color:#ef4444;">*</span></label>
              <input type="text" id="db-release-batch-remark" class="form-control" placeholder="ระบุเหตุผล เช่น สินค้าค้างสต็อกครบกำหนดล็อตใหญ่" required style="margin-top:0.4rem; padding:0.55rem; background:#fff;">
            </div>
            <button class="btn btn-warning" type="submit" style="width:100%; background:#d97706; border:none; color:#fff; font-weight:700; padding:0.6rem;">
              <i class="fa-solid fa-circle-minus"></i> ยืนยันจ่ายออกสินค้าเป็นกลุ่ม
            </button>
          </form>
        </div>
      </div>

      <!-- History Table Card -->
      <div class="card" style="padding:0; overflow:hidden; text-align:left;">
        <div style="padding:1.2rem; border-bottom:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem;">
          <div>
            <h3 style="font-size:1.1rem; font-weight:800;"><i class="fa-solid fa-clock-rotate-left"></i> ประวัติการจ่ายออกและคืนวงเงินเครดิต</h3>
            <p style="font-size:0.8rem; color:var(--text-muted); margin-top:0.2rem;">รายการสินค้าค้างสต็อกที่ถูกจ่ายออกเพื่อหักลบวงเงินและเคลียร์คลัง</p>
          </div>
          <div style="display:flex; align-items:center; gap:0.8rem; flex-wrap:wrap;">
            <!-- Branch Select (Only Admin/HQ) -->
            ${isAdminOrHq ? `
              <div style="display:flex; align-items:center; gap:0.4rem;">
                <label style="font-size:0.82rem; font-weight:600; color:var(--text-muted);">สาขา:</label>
                <select id="release-branch-select" class="form-select" style="width:auto; font-size:0.82rem; padding:0.25rem 0.5rem;" onchange="filterReleaseStockHistory()">
                  <option value="all" ${branchIdParam === 'all' ? 'selected' : ''}>ทุกสาขา</option>
                  ${state.masterOptions.branches ? state.masterOptions.branches.map(b => `<option value="${b._id}" ${branchIdParam === b._id ? 'selected' : ''}>${b.name}</option>`).join('') : ''}
                </select>
              </div>
            ` : ''}
            
            <!-- Date Filters -->
            <div style="display:flex; align-items:center; gap:0.4rem;">
              <label style="font-size:0.82rem; font-weight:600; color:var(--text-muted);">ช่วงวันที่:</label>
              <input type="date" id="release-start-date" class="form-control" value="${startDate}" style="width:auto; font-size:0.82rem; padding:0.25rem 0.5rem;" onchange="filterReleaseStockHistory()">
              <span style="font-size:0.82rem; color:var(--text-muted);">ถึง</span>
              <input type="date" id="release-end-date" class="form-control" value="${endDate}" style="width:auto; font-size:0.82rem; padding:0.25rem 0.5rem;" onchange="filterReleaseStockHistory()">
            </div>

            <button class="btn btn-secondary btn-sm" onclick="printReleasedStockReport()" style="font-weight:700; font-size:0.8rem; padding:0.35rem 0.7rem;"><i class="fa-solid fa-print"></i> พิมพ์รายงาน</button>
            <input type="text" id="release-history-search" class="form-control" placeholder="ค้นหา IMEI, ชื่อสินค้า..." style="width:180px; font-size:0.82rem; padding:0.3rem 0.6rem;" onkeyup="filterReleaseHistoryTable()">
          </div>
        </div>

        <div id="released-history-print-section">
          <div class="table-container" style="border:none; margin:0;">
            <table class="data-table">
              <thead>
                <tr>
                  <th style="width:50px; text-align:center;">#</th>
                  <th>วันที่ทำรายการ</th>
                  <th>สาขาเดิม</th>
                  <th>หมายเลข IMEI</th>
                  <th>รายการสินค้า</th>
                  <th style="text-align:right;">ทุนที่ได้คืน (เครดิต)</th>
                  <th>เหตุผล/หมายเหตุ</th>
                  <th>ผู้ดำเนินการ</th>
                  ${isAdminOrHq ? `<th class="no-print" style="text-align:center;">การจัดการ</th>` : ''}
                </tr>
              </thead>
              <tbody id="release-history-tbody">
                ${history.length === 0 ? `
                  <tr>
                    <td colspan="${isAdminOrHq ? 9 : 8}" style="text-align:center; color:var(--text-muted); padding:3rem;">
                      <i class="fa-solid fa-clipboard-question" style="font-size:2rem; margin-bottom:0.5rem; display:block;"></i> ไม่พบประวัติการจ่ายออกสินค้าที่ตรงกับเงื่อนไขการค้นหา
                    </td>
                  </tr>
                ` : ''}
                ${history.map((h, idx) => {
                  const dateStr = new Date(h.createdAt).toLocaleDateString('th-TH', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  });
                  return `
                    <tr class="release-history-row" data-search="${(h.imei + ' ' + h.productName + ' ' + h.branchName + ' ' + h.remarks + ' ' + h.username).toLowerCase()}">
                      <td style="text-align:center; color:var(--text-muted); font-size:0.8rem;">${idx + 1}</td>
                      <td style="white-space:nowrap; font-size:0.83rem;">${dateStr}</td>
                      <td><span class="badge badge-gray" style="font-weight:700;">${h.branchName || '-'}</span></td>
                      <td><strong style="color:#d97706; font-family:monospace; font-size:0.92rem;">${h.imei}</strong></td>
                      <td><strong>${h.productName}</strong></td>
                      <td style="text-align:right;"><strong style="color:#10b981;">฿${(h.purchase_price || 0).toLocaleString()}</strong></td>
                      <td style="font-size:0.85rem;">${h.remarks || '-'}</td>
                      <td><span class="badge badge-gray">${h.username}</span></td>
                      ${isAdminOrHq ? `
                        <td class="no-print" style="text-align:center;">
                          <button class="btn btn-red btn-sm" onclick="revertReleasedStock('${h.id}', '${h.imei}')" style="background:#ef4444; color:#fff; border:none; padding:0.25rem 0.5rem; font-size:0.75rem; border-radius:4px; cursor:pointer;">
                            <i class="fa-solid fa-rotate-left"></i> ยกเลิกจ่ายออก
                          </button>
                        </td>
                      ` : ''}
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

  } catch (err) {
    container.innerHTML = `<div style="color:#ef4444; padding:2rem;">เกิดข้อผิดพลาดในการโหลดประวัติจ่ายออกสินค้า: ${err.message}</div>`;
  }
}
function filterReleaseHistoryTable() {
  const query = document.getElementById('release-history-search').value.toLowerCase().trim();
  document.querySelectorAll('.release-history-row').forEach(row => {
    const searchData = row.getAttribute('data-search') || '';
    if (searchData.includes(query)) {
      row.style.display = '';
    } else {
      row.style.display = 'none';
    }
  });
}

async function handleDashboardSingleRelease() {
  const imeiEl = document.getElementById('db-release-imei');
  const remarkEl = document.getElementById('db-release-single-remark');

  const imei = imeiEl ? imeiEl.value.trim() : '';
  const remarks = remarkEl ? remarkEl.value.trim() : '';

  if (!imei || !remarks) {
    showToast('กรุณากรอก IMEI และหมายเหตุให้ครบถ้วน', 'error');
    return;
  }

  await submitReleaseStock([imei]);
}

async function handleDashboardBatchRelease() {
  const inputs = document.querySelectorAll('.db-release-batch-imei-input');
  const remarkEl = document.getElementById('db-release-batch-remark');
  const remarks = remarkEl ? remarkEl.value.trim() : '';

  const imeis = [];
  inputs.forEach(input => {
    const val = input.value.trim();
    if (val) imeis.push(val);
  });

  if (imeis.length === 0) {
    showToast('กรุณากรอกหมายเลข IMEI อย่างน้อย 1 รายการ', 'error');
    return;
  }

  if (!remarks) {
    showToast('กรุณากรอกหมายเหตุการจ่ายออกสินค้า', 'error');
    return;
  }

  await submitReleaseStock(imeis);
}

async function submitReleaseStock(imeis) {
  const remarkSingleInput = document.getElementById('release-remark-input');
  const dbSingleRemarkInput = document.getElementById('db-release-single-remark');
  const dbBatchRemarkInput = document.getElementById('db-release-batch-remark');

  let remarks = '';
  if (remarkSingleInput && remarkSingleInput.value.trim()) {
    remarks = remarkSingleInput.value.trim();
  } else if (dbSingleRemarkInput && dbSingleRemarkInput.value.trim()) {
    remarks = dbSingleRemarkInput.value.trim();
  } else if (dbBatchRemarkInput && dbBatchRemarkInput.value.trim()) {
    remarks = dbBatchRemarkInput.value.trim();
  }

  if (!remarks) {
    showToast('กรุณากรอกหมายเหตุหรือเหตุผลการจ่ายออกสินค้า', 'error');
    return;
  }

  try {
    showPageLoading();
    const verifyRes = await apiRequest('/stock/query-imeis', 'POST', { imeis });
    hidePageLoading();

    if (!verifyRes.success || !verifyRes.items || verifyRes.items.length === 0) {
      showToast('ไม่พบหมายเลข IMEI ที่พร้อมขายตามระบุในคลังสินค้า', 'error');
      return;
    }

    const items = verifyRes.items;
    const totalCost = items.reduce((sum, item) => sum + (item.purchase_price || 0), 0);
    const missingCount = imeis.length - items.length;

    const previewBodyHtml = `
      <div style="background:rgba(217,119,6,0.06); border:1px solid rgba(217,119,6,0.2); padding:1rem; border-radius:8px; margin-bottom:1.2rem; text-align:left;">
        <div style="font-weight:800; font-size:1.05rem; color:#d97706; margin-bottom:0.3rem;">
          <i class="fa-solid fa-triangle-exclamation"></i> ตรวจสอบข้อมูลสินค้าก่อนยืนยันจ่ายออก
        </div>
        <div style="font-size:0.83rem; color:var(--text-muted);">
          พบรายการสินค้าพร้อมขายตรงตามระบบจำนวน Host ${items.length} เครื่อง ยอดรวมคืนเครดิต <strong>฿${totalCost.toLocaleString()}</strong>
        </div>
      </div>

      <div class="table-container" style="max-height: 220px; overflow-y: auto; margin-bottom: 1.2rem; border: 1px solid var(--border-color); border-radius: 6px; text-align:left;">
        <table class="data-table" style="font-size:0.82rem; margin:0; width:100%;">
          <thead>
            <tr>
              <th>หมายเลข IMEI</th>
              <th>รายการสินค้า</th>
              <th>สาขาเดิม</th>
              <th style="text-align:right;">ราคาทุนคืน</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(item => `
              <tr>
                <td><strong style="font-family:monospace; color:#d97706;">${item.imei}</strong></td>
                <td><strong>${item.productName}</strong></td>
                <td><span class="badge badge-gray">${item.branchName}</span></td>
                <td style="text-align:right;"><strong style="color:#10b981;">฿${item.purchase_price.toLocaleString()}</strong></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      ${missingCount > 0 ? `
        <div style="background:rgba(239,68,68,0.06); border:1px solid rgba(239,68,68,0.2); padding:0.8rem; border-radius:8px; margin-bottom:1.2rem; font-size:0.82rem; color:#ef4444; text-align:left; line-height:1.4;">
          <i class="fa-solid fa-circle-exclamation"></i> <strong>คำเตือน:</strong> ไม่พบข้อมูลสินค้าพร้อมขายในระบบจำนวน ${missingCount} เครื่อง (รายการเหล่านี้จะไม่ถูกดำเนินการจ่ายออก)
        </div>
      ` : ''}

      <div style="text-align:left; font-size:0.88rem; color:var(--text-main); margin-bottom:0.5rem;">
        หมายเหตุการจ่ายออก: <strong style="color:#d97706;">${remarks}</strong>
      </div>
    `;

    const previewFooterHtml = `
      <button class="btn btn-secondary" onclick="closeModal()">ยกเลิก</button>
      <button class="btn btn-warning" id="btn-execute-release" style="background:#d97706; border:none; color:#fff; font-weight:700;">
        <i class="fa-solid fa-circle-minus"></i> ยืนยันทำรายการจ่ายออก
      </button>
    `;

    openModal('📊 ยืนยันรายการจ่ายออกสินค้า', previewBodyHtml, previewFooterHtml);

    document.getElementById('btn-execute-release').addEventListener('click', async () => {
      try {
        closeModal();
        showPageLoading();
        
        const verifiedImeis = items.map(it => it.imei);
        const res = await apiRequest('/stock/release', 'POST', {
          imeis: verifiedImeis,
          remarks
        });

        hidePageLoading();

        if (res.success) {
          showToast(res.message);
          
          const dbSingleImei = document.getElementById('db-release-imei');
          if (dbSingleImei) dbSingleImei.value = '';
          const dbSingleRemark = document.getElementById('db-release-single-remark');
          if (dbSingleRemark) dbSingleRemark.value = '';

          const dbBatchImeisContainer = document.getElementById('batch-imei-fields-container');
          if (dbBatchImeisContainer) {
            dbBatchImeisContainer.innerHTML = `
              <div class="batch-imei-row" style="display:flex; gap:0.5rem; align-items:center;">
                <input type="text" class="form-control db-release-batch-imei-input" placeholder="พิมพ์หรือยิงสแกน IMEI..." required onkeydown="handleBatchImeiKeydown(event, this)" style="padding:0.55rem; background:#fff; font-family:monospace; flex:1;">
                <button type="button" class="btn btn-secondary btn-sm" onclick="removeBatchImeiField(this)" style="padding:0.55rem 0.8rem; background:var(--border-color); border:none; color:var(--text-muted); cursor:pointer;"><i class="fa-solid fa-xmark"></i></button>
              </div>
            `;
          }
          const dbBatchRemark = document.getElementById('db-release-batch-remark');
          if (dbBatchRemark) dbBatchRemark.value = '';

          renderReleaseStockView();
        }
      } catch (err) {
        hidePageLoading();
      }
    });

  } catch (err) {
    hidePageLoading();
  }
}

function addBatchImeiField() {
  const container = document.getElementById('batch-imei-fields-container');
  if (!container) return;
  const div = document.createElement('div');
  div.className = 'batch-imei-row';
  div.style.display = 'flex';
  div.style.gap = '0.5rem';
  div.style.alignItems = 'center';
  div.innerHTML = `
    <input type="text" class="form-control db-release-batch-imei-input" placeholder="พิมพ์หรือยิงสแกน IMEI..." required onkeydown="handleBatchImeiKeydown(event, this)" style="padding:0.55rem; background:#fff; font-family:monospace; flex:1;">
    <button type="button" class="btn btn-secondary btn-sm" onclick="removeBatchImeiField(this)" style="padding:0.55rem 0.8rem; background:var(--border-color); border:none; color:var(--text-muted); cursor:pointer;"><i class="fa-solid fa-xmark"></i></button>
  `;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  
  const inputs = div.getElementsByTagName('input');
  if (inputs.length > 0) inputs[0].focus();
}

function removeBatchImeiField(button) {
  const container = document.getElementById('batch-imei-fields-container');
  if (!container) return;
  const row = button.closest('.batch-imei-row');
  
  const rows = container.querySelectorAll('.batch-imei-row');
  if (rows.length <= 1) {
    const input = row.querySelector('input');
    if (input) input.value = '';
    showToast('ต้องมีช่องกรอกหมายเลข IMEI อย่างน้อย 1 ช่อง', 'warning');
    return;
  }
  
  row.remove();
}

function handleBatchImeiKeydown(event, input) {
  if (event.key === 'Enter') {
    event.preventDefault();
    if (input.value.trim() !== '') {
      addBatchImeiField();
    } else {
      showToast('กรุณากรอกเลข IMEI ก่อนเพิ่มช่องใหม่', 'warning');
    }
  }
}

function revertReleasedStock(stockId, imei) {
  showCustomConfirm(
    'ยืนยันยกเลิกการจ่ายออก',
    `คุณแน่ใจหรือไม่ว่าต้องการยกเลิกการจ่ายออกของเครื่อง IMEI: ${imei}? การยกเลิกจะคืนสินค้ากลับเข้าสต็อกพร้อมขาย และหักวงเงินเครดิตสาขาต้นทางกลับตามเดิม`,
    async () => {
      try {
        showPageLoading();
        const res = await apiRequest(`/stock/release/${stockId}/cancel`, 'POST');
        hidePageLoading();
        if (res.success) {
          showToast(res.message);
          renderReleaseStockView();
        }
      } catch (err) {
        hidePageLoading();
      }
    },
    null,
    'danger'
  );
}

function printReleasedStockReport() {
  const printContent = document.getElementById('released-history-print-section');
  if (!printContent) return;

  const win = window.open('', '_blank');
  win.document.write(`
    <html>
      <head>
        <title>รายงานสรุปรายการสินค้าจ่ายออกค้างสต็อก</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;600;700;800&display=swap" rel="stylesheet">
        <style>
          @page { size: landscape; }
          body { font-family: 'Sarabun', sans-serif; padding: 25px; color: #1f2937; line-height: 1.5; }
          h2 { margin-bottom: 5px; font-weight: 800; font-size: 1.45rem; color: #1e3a8a; }
          p { font-size: 0.85rem; color: #4b5563; margin-top: 0; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 0.82rem; }
          th { background-color: #f3f4f6; color: #374151; font-weight: 700; border: 1px solid #d1d5db; padding: 10px; text-align: left; }
          td { border: 1px solid #e5e7eb; padding: 10px; color: #4b5563; }
          strong { color: #111827; }
          .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; font-weight: bold; background: #e5e7eb; color: #374151; }
          .text-right { text-align: right; }
          .no-print { display: none !important; }
          .footer { margin-top: 40px; border-top: 1px solid #e5e7eb; padding-top: 15px; font-size: 0.78rem; text-align: right; color: #9ca3af; }
        </style>
      </head>
      <body>
        <h2>รายงานสรุปรายการสินค้าจ่ายออกค้างสต็อก</h2>
        <p>พิมพ์รายงานเมื่อวันที่: ${new Date().toLocaleDateString('th-TH')} ${new Date().toLocaleTimeString('th-TH')}</p>
        
        ${printContent.innerHTML}
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() { window.close(); }, 500);
          };
        </script>
      </body>
    </html>
  `);
  win.document.close();
}

function filterReleaseStockHistory() {
  const branchEl = document.getElementById('release-branch-select');
  const startEl = document.getElementById('release-start-date');
  const endEl = document.getElementById('release-end-date');

  const branchId = branchEl ? branchEl.value : 'all';
  const startDate = startEl ? startEl.value : '';
  const endDate = endEl ? endEl.value : '';

  renderReleaseStockView(branchId, startDate, endDate);
}

function viewGoodsReceiptDetails(receiptId) {
  const receipt = (state.pendingReceiptsCache || []).find(r => r._id === receiptId);
  if (!receipt) {
    showToast('ไม่พบข้อมูลรายการรับสินค้านี้', 'error');
    return;
  }

  const p = receipt.productInfo || {};
  const branchName = receipt.branch ? receipt.branch.name : 'สาขาทั่วไป';
  const receivedBy = receipt.receivedBy ? (receipt.receivedBy.fullName || receipt.receivedBy.username) : '-';
  const confirmedBy = receipt.confirmedBy ? (receipt.confirmedBy.fullName || receipt.confirmedBy.username) : '-';
  
  const createdDate = receipt.createdAt ? new Date(receipt.createdAt).toLocaleString('th-TH') : '-';
  const confirmedDate = receipt.confirmedAt ? new Date(receipt.confirmedAt).toLocaleString('th-TH') : '-';

  // Extract PO Number if present in remarks or receipt number
  let poNumber = 'ไม่มี (นำเข้านอกใบสั่งซื้อ)';
  if (receipt.remarks && receipt.remarks.includes('ใบสั่งซื้อเลขที่:')) {
    const parts = receipt.remarks.split('ใบสั่งซื้อเลขที่:');
    if (parts[1]) {
      const match = parts[1].match(/BPO-\d+-\d+/);
      poNumber = match ? match[0] : parts[1].replace(/[)]/g, '').trim();
    }
  }
  if (poNumber === 'ไม่มี (นำเข้านอกใบสั่งซื้อ)' && receipt.receiptNumber && receipt.receiptNumber.includes('GR-BPO-')) {
    const match = receipt.receiptNumber.match(/BPO-\d+-\d+/);
    if (match) poNumber = match[0];
  }

  // Set status badge
  let statusBadge = '';
  if (receipt.status === 'pending_pricing') {
    statusBadge = `<span class="badge badge-yellow"><i class="fa-solid fa-clock"></i> รอตั้งราคาคลัง</span>`;
  } else if (receipt.status === 'confirmed') {
    statusBadge = `<span class="badge badge-green"><i class="fa-solid fa-circle-check"></i> ยืนยันเข้าสต็อกแล้ว</span>`;
  } else if (receipt.status === 'rejected') {
    statusBadge = `<span class="badge badge-red"><i class="fa-solid fa-circle-xmark"></i> ถูกปฏิเสธ</span>`;
  }

  const bodyHtml = `
    <div style="display:flex; flex-direction:column; gap:1.2rem; font-size:0.88rem; color:var(--text-main);">
      <!-- Status & Reference -->
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; background:rgba(255,255,255,0.02); padding:1rem; border-radius:6px; border:1px solid var(--border-color);">
        <div>
          <span style="color:var(--text-muted); display:block; font-size:0.75rem; font-weight:600;">เลขที่ใบรับสินค้า</span>
          <strong style="font-size:0.95rem; color:var(--accent-primary); font-family:monospace;">${receipt.receiptNumber}</strong>
        </div>
        <div>
          <span style="color:var(--text-muted); display:block; font-size:0.75rem; font-weight:600;">สถานะรายการ</span>
          <div style="margin-top:0.2rem;">${statusBadge}</div>
        </div>
      </div>

      <!-- Product Spec Details -->
      <div style="border:1px solid var(--border-color); border-radius:6px; overflow:hidden;">
        <div style="background:rgba(255,255,255,0.04); padding:0.6rem 1rem; font-weight:700; border-bottom:1px solid var(--border-color); display:flex; align-items:center; gap:0.4rem;">
          <i class="fa-solid fa-mobile-screen" style="color:var(--accent-gold);"></i> รายละเอียดสินค้า (Product Specs)
        </div>
        <div style="padding:1rem; display:grid; grid-template-columns:1fr 1fr; gap:0.8rem 1.5rem;">
          <div><span style="color:var(--text-muted);">ชื่อรุ่นทางการ:</span> <strong>${p.name || '-'}</strong></div>
          <div><span style="color:var(--text-muted);">หมวดหมู่:</span> <strong>${p.category || '-'}</strong></div>
          <div><span style="color:var(--text-muted);">ยี่ห้อ:</span> <strong>${p.brand || '-'}</strong></div>
          <div><span style="color:var(--text-muted);">รุ่น:</span> <strong>${p.model || '-'}</strong></div>
          <div><span style="color:var(--text-muted);">ความจุ:</span> <strong>${p.capacity || '-'}</strong></div>
          <div><span style="color:var(--text-muted);">สี:</span> <strong>${p.color || '-'}</strong></div>
        </div>
      </div>

      <!-- IMEI & Pricing Details -->
      <div style="border:1px solid var(--border-color); border-radius:6px; overflow:hidden;">
        <div style="background:rgba(255,255,255,0.04); padding:0.6rem 1rem; font-weight:700; border-bottom:1px solid var(--border-color); display:flex; align-items:center; gap:0.4rem;">
          <i class="fa-solid fa-barcode" style="color:var(--accent-gold);"></i> ข้อมูลประจำตัวเครื่อง & ราคา
        </div>
        <div style="padding:1rem; display:grid; grid-template-columns:1fr 1fr; gap:0.8rem 1.5rem;">
          <div style="grid-column: span 2;">
            <span style="color:var(--text-muted);">หมายเลข IMEI:</span>
            <strong style="color:#38bdf8; font-family:monospace; font-size:1.05rem; letter-spacing:0.5px; display:block; margin-top:0.2rem;">
              ${(receipt.imeiSerials || []).join(', ') || '-'}
            </strong>
          </div>
          <div>
            <span style="color:var(--text-muted);">กำหนดราคาทุน:</span>
            <strong style="font-size:1rem; color:var(--text-main);">
              ${receipt.purchase_price ? '฿' + receipt.purchase_price.toLocaleString() : '<span style="color:var(--accent-gold);">ยังไม่ได้กำหนด</span>'}
            </strong>
          </div>
          <div>
            <span style="color:var(--text-muted);">กำหนดราคาขาย:</span>
            <strong style="font-size:1rem; color:#34d399;">
              ${receipt.selling_price ? '฿' + receipt.selling_price.toLocaleString() : '<span style="color:var(--accent-gold);">ยังไม่ได้กำหนด</span>'}
            </strong>
          </div>
        </div>
      </div>

      <!-- Tracking & Log info -->
      <div style="border:1px solid var(--border-color); border-radius:6px; overflow:hidden;">
        <div style="background:rgba(255,255,255,0.04); padding:0.6rem 1rem; font-weight:700; border-bottom:1px solid var(--border-color); display:flex; align-items:center; gap:0.4rem;">
          <i class="fa-solid fa-user-gear" style="color:var(--accent-gold);"></i> ประวัติการทำรายการ (Audits)
        </div>
        <div style="padding:1rem; display:grid; grid-template-columns:1fr 1fr; gap:0.8rem 1.5rem;">
          <div><span style="color:var(--text-muted);">คลังปลายทาง:</span> <strong>${branchName}</strong></div>
          <div><span style="color:var(--text-muted);">ใบสั่งซื้ออ้างอิง:</span> <strong style="color:var(--accent-gold); font-family:monospace;">${poNumber}</strong></div>
          
          <div><span style="color:var(--text-muted);">ผู้สแกนรับของ:</span> <strong>${receivedBy}</strong></div>
          <div><span style="color:var(--text-muted);">วันเวลาสแกนรับ:</span> <strong>${createdDate}</strong></div>
          
          <div><span style="color:var(--text-muted);">ผู้อนุมัติราคา/เข้าคลัง:</span> <strong>${confirmedBy}</strong></div>
          <div><span style="color:var(--text-muted);">วันเวลาอนุมัติ:</span> <strong>${confirmedDate}</strong></div>

          <div style="grid-column: span 2; border-top:1px solid rgba(255,255,255,0.05); padding-top:0.6rem;">
            <span style="color:var(--text-muted); display:block; margin-bottom:0.2rem;">หมายเหตุการทำรายการ:</span>
            <div style="background:rgba(0,0,0,0.15); padding:0.6rem; border-radius:4px; border:1px solid rgba(255,255,255,0.02); font-style:italic;">
              ${receipt.remarks ? receipt.remarks : '<span style="color:var(--text-muted);">ไม่มีหมายเหตุ</span>'}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  const footerHtml = `
    <button class="btn btn-secondary" onclick="closeModal()">ปิดหน้าต่าง</button>
  `;

  openModal(`รายละเอียดใบรับสินค้า: ${receipt.receiptNumber}`, bodyHtml, footerHtml);
}
