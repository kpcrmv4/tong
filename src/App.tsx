/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { JirakitDB } from './db';
import { getBuildVersion } from './utils/versionControl';
const Dashboard = React.lazy(() => import('./components/Dashboard'));
const Appointments = React.lazy(() => import('./components/Appointments'));
const POS = React.lazy(() => import('./components/POS'));
const Returns = React.lazy(() => import('./components/Returns'));
const Bills = React.lazy(() => import('./components/Bills'));
const Customers = React.lazy(() => import('./components/Customers'));
const Products = React.lazy(() => import('./components/Products'));
const Analytics = React.lazy(() => import('./components/Analytics'));
const Accounting = React.lazy(() => import('./components/Accounting'));
const Settings = React.lazy(() => import('./components/Settings'));
const Security = React.lazy(() => import('./components/Security'));
const DocumentCMS = React.lazy(() => import('./components/documents/DocumentCMS'));
const Contracts = React.lazy(() => import('./components/Contracts'));
import { A4PageContainer } from './components/A4PageContainer';
import { A4ImageExportButton } from './components/A4ImageExportButton';

import {
  Home,
  ShoppingCart,
  RefreshCw,
  FileText,
  Users,
  Package,
  TrendingUp,
  Wallet,
  Settings as SettingsIcon,
  Lock,
  Menu,
  X,
  Bell,
  HardDrive,
  ArrowLeft,
  AlertTriangle,
  FileCheck,
  Shield,
  KeyRound,
  Calendar,
  FileSignature
} from 'lucide-react';

type MenuID = 'dashboard' | 'appointments' | 'pos' | 'returns' | 'bills' | 'customers' | 'products' | 'analytics' | 'accounting' | 'documents' | 'contracts' | 'settings' | 'security';

import CustomerSharedModal from './components/CustomerSharedModal';
import { Button } from './components/ui/Button';
import { Card } from './components/ui/Card';
import { Input } from './components/ui/Input';
import { Select } from './components/ui/Select';
import { DataTable } from './components/ui/DataTable';

const SESSION_DURATION_MS = 20 * 60 * 60 * 1000;
const MAX_INACTIVITY_MS = 5 * 60 * 1000;

export default function App() {
  const [currentMenu, setCurrentMenu] = useState < MenuID > ('dashboard');

  // ให้ Sidebar เริ่มต้นเป็นยุบเสมอ
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Custom Global State for the Shared Customer Modal
  const [sharedCustomerModalOpen, setSharedCustomerModalOpen] = useState(false);
  const [sharedCustomerModalData, setSharedCustomerModalData] = useState < any > (null);

  useEffect(() => {
    (window as any).openSharedCustomerModal = (customerData: any = null) => {
      setSharedCustomerModalData(customerData);
      setSharedCustomerModalOpen(true);
    };
  }, []);


  type AuthMode = 'loading' | 'login' | 'register' | 'pin' | 'authenticated';

  const [authMode, setAuthMode] = useState < AuthMode > ('loading');
  const [userNameEntry, setUserNameEntry] = useState('');
  const [passwordEntry, setPasswordEntry] = useState('');
  const [displayNameEntry, setDisplayNameEntry] = useState('');
  const [roleEntry, setRoleEntry] = useState('Staff');

  const [pinEntry, setPinEntry] = useState('');
  const [loginError, setLoginError] = useState('');
  const [authNotice, setAuthNotice] = useState('');
  const [wrongPinAttempts, setWrongPinAttempts] = useState(0);
  const [isInitializing, setIsInitializing] = useState(true);

  const isSessionExpired = (lastLoginTimeMs: number) => {
    return Date.now() - lastLoginTimeMs >= SESSION_DURATION_MS;
  };

  const evalAuthState = useCallback(() => {
    const session = JirakitDB.getActiveSession();
    if (!session) {
      setAuthMode('login');
      return;
    }

    if (session.user_status !== 'Active') {
      JirakitDB.logout();
      setAuthMode('login');
      return;
    }

    // Login sessions are valid for 20 hours, then the user must login again.
    const lastLoginTime = new Date(session.last_login || session.created_at).getTime();
    if (isSessionExpired(lastLoginTime)) {
      JirakitDB.logout();
      setAuthMode('login');
      return;
    }

    // Check inactivity PIN lock
    const lastActive = localStorage.getItem('lastActiveTime');
    if (!lastActive || Date.now() - parseInt(lastActive) > MAX_INACTIVITY_MS) {
      setAuthMode('pin');
    } else {
      setAuthMode('authenticated');
    }
  }, []);

  useEffect(() => {
    evalAuthState();
  }, [evalAuthState]);

  useEffect(() => {
    let unsubscribe: () => void = () => { };

    const initApp = async () => {
      try {
        await JirakitDB.loadFromCloud();
      } catch (err) {
        console.warn("Auto-load from Firebase failed on startup", err);
      } finally {
        setIsInitializing(false);
      }

      unsubscribe = JirakitDB.setupCloudListener(() => {
        setRefreshCount(prev => prev + 1);
      });
    };
    initApp();

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const updateActivity = () => {
      if (authMode === 'authenticated') {
        localStorage.setItem('lastActiveTime', Date.now().toString());
      }
    };

    const checkInactivity = () => {
      if (authMode === 'authenticated') {
        const lastActive = localStorage.getItem('lastActiveTime');
        if (lastActive && Date.now() - parseInt(lastActive) > MAX_INACTIVITY_MS) {
          setAuthMode('pin');
        }

        const session = JirakitDB.getActiveSession();
        if (session) {
          const lastLoginTime = new Date(session.last_login || session.created_at).getTime();
          if (isSessionExpired(lastLoginTime)) {
            JirakitDB.logout();
            setAuthMode('login');
          }
        }
      }
    };

    window.addEventListener('mousemove', updateActivity);
    window.addEventListener('keydown', updateActivity);
    window.addEventListener('touchstart', updateActivity);
    window.addEventListener('click', updateActivity);

    const interval = setInterval(checkInactivity, 60000);
    return () => {
      window.removeEventListener('mousemove', updateActivity);
      window.removeEventListener('keydown', updateActivity);
      window.removeEventListener('touchstart', updateActivity);
      window.removeEventListener('click', updateActivity);
      clearInterval(interval);
    };
  }, [authMode]);

  const [refreshCount, setRefreshCount] = useState(0);
  const [timeStr, setTimeStr] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [unreadAlertsCount, setUnreadAlertsCount] = useState(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  // Apply Cold Purple Pastel foundation tokens.
  // UI colors are intentionally centralized here so old saved Settings cannot re-lock individual screens.
  useEffect(() => {
    const root = document.documentElement;
    const tokens: Record<string, string> = {
      '--ui-bg': 'var(--color-cold-purple-50)',
      '--app-bg': 'var(--color-cold-purple-50)',
      '--ui-panel': 'var(--color-cold-purple-100)',
      '--ui-panel-soft': 'var(--color-cold-purple-50)',
      '--ui-primary': 'var(--color-cold-purple-700)',
      '--ui-primary-hover': 'var(--color-cold-purple-800)',
      '--ui-primary-soft': 'var(--color-cold-purple-200)',
      '--ui-secondary': 'var(--color-cold-purple-100)',
      '--ui-secondary-hover': 'var(--color-cold-purple-200)',
      '--ui-accent': 'var(--color-cold-purple-600)',
      '--ui-selected': 'var(--color-cold-purple-700)',
      '--ui-border': 'var(--color-cold-purple-300)',
      '--ui-border-strong': 'var(--color-cold-purple-500)',
      '--ui-text': 'var(--color-cold-purple-950)',
      '--ui-structure': 'var(--color-cold-purple-950)',
      '--ui-muted': 'var(--color-cold-purple-700)',
      '--text-main': 'var(--color-cold-purple-950)',
      '--text-soft': 'var(--color-cold-purple-700)',
      '--text-muted': 'var(--color-cold-purple-700)',
      '--border': 'var(--color-cold-purple-300)',
      '--ui-success': 'var(--color-cold-purple-600)',
      '--ui-warning': 'var(--color-cold-purple-500)',
      '--ui-danger': 'var(--color-cold-purple-800)',
      '--ui-error': 'var(--color-cold-purple-800)',
    };
    Object.entries(tokens).forEach(([key, value]) => root.style.setProperty(key, value));
  }, [refreshCount]);


  // Unified Date Range state persisted across Dashboard and Bills tabs
  const [applyDateFilter, setApplyDateFilter] = useState(true);
  const [sharedStartDate, setSharedStartDate] = useState < string > (() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 2); // default range: 2 months back
    return d.toISOString().slice(0, 10);
  });
  const [sharedEndDate, setSharedEndDate] = useState < string > (() => {
    return new Date().toISOString().slice(0, 10);
  });

  // Check if we have public payment URL query ?pay=
  const [payReceiptId, setPayReceiptId] = useState < string | null > (null);

  // Check if we have public contract URL query ?contract_id= or ?ctr=
  const [viewContractId, setViewContractId] = useState < string | null > (null);
  const [showFullDocPreview, setShowFullDocPreview] = useState(false);

  const triggerRefresh = () => {
    setRefreshCount(prev => prev + 1);
  };

  useEffect(() => {
    // Sync clock updates matching the real live UTC/Thai hour
    const updateTime = () => {
      const d = new Date();
      setTimeStr(d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setDateStr(d.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);

    // Periodic Version check
    const checkVersion = async () => {
      try {
        const response = await fetch('/version.json?cache_bust=' + Date.now(), { cache: 'no-store' });
        if (!response.ok) return;
        const data = await response.json();
        if (!data?.version) return;
        const currentVersion = localStorage.getItem('appVersion');

        if (currentVersion && currentVersion !== data.version) {
          console.log('New version detected: ' + data.version + '. Force reloading.');
          localStorage.setItem('appVersion', data.version);
          window.location.reload();
        } else if (!currentVersion) {
          localStorage.setItem('appVersion', data.version);
        }
      } catch (err) {
        console.warn('Version check skipped', err);
      }
    };

    // Check initially, then every 60 seconds
    checkVersion();
    const versionInterval = setInterval(checkVersion, 60000);

    // Hydrate parameters
    const params = new URLSearchParams(window.location.search);

    const payId = params.get('pay');
    if (payId) {
      setPayReceiptId(payId);
    }

    const ctrId = params.get('contract_id') || params.get('ctr') || params.get('contract');
    if (ctrId) {
      setViewContractId(ctrId);
    }

    return () => {
      clearInterval(interval);
      clearInterval(versionInterval);
    };
  }, []);

  useEffect(() => {
    // Simple count of alerts
    const prods = JirakitDB.getProducts();
    const rcs = JirakitDB.getReceipts();
    const apps = JirakitDB.getAppointments().filter(x => x.appointment_status === 'To Deliver' || x.appointment_status === ('Active' as any));

    let lowStock = prods.filter(p => p.qty_available <= p.low_stock_threshold && p.item_status === 'Active').length;
    let unpaid = rcs.filter(r => r.debt_amount > 0).length;
    let appointmentsDue = apps.filter(a => {
      const ms = new Date(a.appointment_date).getTime() - new Date().getTime();
      return Math.floor(ms / (1000 * 60 * 60 * 24)) <= 3;
    }).length;

    setUnreadAlertsCount(lowStock + unpaid + appointmentsDue);
  }, [refreshCount, currentMenu]);

  // Menus configuration
  const activeUser = JirakitDB.getActiveSession();
  const isOwnerOrAdmin = activeUser?.role === 'Owner' || activeUser?.role === 'Admin';
  const isAdminOrManager = isOwnerOrAdmin || activeUser?.role === 'Manager';
  const isAccounting = activeUser?.role === 'Accounting';
  const isViewer = activeUser?.role === 'Viewer';

  const ALL_MENUS: { id: MenuID; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'หน้าแรก', icon: <Home size={18} /> },
    { id: 'appointments', label: 'นัดหมาย', icon: <Calendar size={18} /> },
    { id: 'pos', label: 'ขาย/เช่า POS', icon: <ShoppingCart size={18} /> },
    { id: 'returns', label: 'คืนอุปกรณ์', icon: <RefreshCw size={18} /> },
    { id: 'bills', label: 'ประวัติบิล', icon: <FileText size={18} /> },
    { id: 'contracts', label: 'สัญญาเช่า', icon: <FileSignature size={18} /> },
    { id: 'documents', label: 'จัดการเอกสาร', icon: <FileText size={18} /> },
    { id: 'customers', label: 'ข้อมูลลูกค้า', icon: <Users size={18} /> },
    { id: 'products', label: 'จัดการสินค้า', icon: <Package size={18} /> },
    { id: 'analytics', label: 'วิเคราะห์รายได้', icon: <TrendingUp size={18} /> },
    { id: 'accounting', label: 'บัญชี & สเตทเม้นท์', icon: <Wallet size={18} /> },
    { id: 'settings', label: 'ตั้งค่าระบบ', icon: <SettingsIcon size={18} /> },
    { id: 'security', label: 'ความปลอดภัยระบบ & การสำรองข้อมูล', icon: <Shield size={18} /> }
  ];

  const MENUS = ALL_MENUS.filter(menu => {
    if (isOwnerOrAdmin) return true;
    if (isAdminOrManager) return menu.id !== 'security';
    if (isAccounting) return !['settings', 'security'].includes(menu.id);
    if (isViewer) return ['dashboard', 'appointments', 'bills', 'contracts', 'documents', 'customers', 'products'].includes(menu.id);
    return !['analytics', 'accounting', 'settings', 'security'].includes(menu.id);
  });

  useEffect(() => {
    if (authMode === 'authenticated' && !MENUS.some(menu => menu.id === currentMenu)) {
      setCurrentMenu('dashboard');
    }
  }, [authMode, currentMenu, MENUS]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await JirakitDB.login(userNameEntry, passwordEntry);
      setUserNameEntry('');
      setPasswordEntry('');
      setLoginError('');
      setAuthNotice('');
      setAuthMode('authenticated');
      localStorage.setItem('lastActiveTime', Date.now().toString());
    } catch (err: any) {
      setLoginError(err.message || 'Login failed');
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await JirakitDB.register(userNameEntry, passwordEntry, displayNameEntry, roleEntry);
      setUserNameEntry('');
      setPasswordEntry('');
      setDisplayNameEntry('');
      setLoginError('');
      setAuthNotice('สมัครสมาชิกแล้ว สถานะเริ่มต้นคือ Pending กรุณารอ Owner/Admin อนุมัติก่อนเข้าใช้งานเต็มระบบ');
      setAuthMode('login');
    } catch (err: any) {
      setLoginError(err.message || 'Registration failed');
    }
  };

  const handlePinSubmit = async (pin: string) => {
    if (JirakitDB.verifyPin(pin)) {
      setAuthMode('authenticated');
      setPinEntry('');
      setLoginError('');
      setAuthNotice('');
      setWrongPinAttempts(0);
      localStorage.setItem('lastActiveTime', Date.now().toString());
      triggerRefresh();
    } else {
      setLoginError('PIN ไม่ถูกต้อง');
      setPinEntry('');
      const attempts = wrongPinAttempts + 1;
      setWrongPinAttempts(attempts);

      if (attempts >= 3) {
        const activeUser = JirakitDB.getActiveSession();
        JirakitDB.addAuditLog('PIN_FAILED', 'SECURITY', activeUser?.user_id || '-', '', `${attempts}`, `กรอก PIN ผิด ${attempts} ครั้ง`);
        setLoginError('กรอก PIN ผิดเกิน 3 ครั้ง ระบบบันทึกเหตุการณ์ไว้แล้ว (LINE แจ้งเตือนจริงจะทำใน Step 3)');
      }
    }
  };

  const handleLogout = () => {
    JirakitDB.logout();
    setAuthMode('login');
    setCurrentMenu('dashboard');
  };

  // Add auto-submit for PIN when 6 digits are reached
  useEffect(() => {
    if (authMode === 'pin' && pinEntry.length === 6) {
      handlePinSubmit(pinEntry);
    }
  }, [pinEntry, authMode]);

  if (isInitializing || authMode === 'loading') {
    return (
      <div className="min-h-screen ai-panel flex flex-col items-center justify-center font-sans tracking-wide">
        <div className="w-12 h-12 border-4 border-[var(--ui-text)] border-t-transparent flex items-center justify-center rounded-full animate-spin mb-4 shadow-xl"></div>
        <p className="text-[var(--text-main)] font-bold text-sm">กำลังอัปเดตข้อมูลล่าสุดจากคลาวด์...</p>
      </div>
    );
  }

  if (payReceiptId) {
    const rc = JirakitDB.getReceipts().find(r => r.receipt_id === payReceiptId);
    const shopSettings = JirakitDB.getSettings();

    return (
      <div className="min-h-screen ai-panel text-[var(--text-main)] flex items-center justify-center p-4 sm:p-6 font-sans antialiased">
        <div className="w-full max-w-2xl bg-[var(--app-bg)] rounded-3xl border border-[var(--ui-border)] shadow-2xl overflow-hidden flex flex-col">
          {/* Header Portal banner */}
          <div className="bg-[var(--ui-primary)] text-[var(--ui-on-primary)] px-6 py-5 border-b border-[var(--ui-border)] flex items-center justify-between">
            <div className="flex items-center gap-3 text-left">
              <div className="w-10 h-10 rounded-xl ai-panel text-[var(--text-main)] flex items-center justify-center font-black text-2xl">J</div>
              <div>
                <h1 className="text-sm font-black tracking-tight text-[var(--text-main)] uppercase">{shopSettings.SHOP_NAME}</h1>
                <p className="text-[10px] text-[var(--text-soft)] font-bold mt-0.5 uppercase tracking-wider">ลิงก์ดูบิลแบบอ่านอย่างเดียว</p>
              </div>
            </div>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                const cleanUrl = window.location.origin + window.location.pathname;
                window.history.replaceState({}, document.title, cleanUrl);
                setPayReceiptId(null);
              }}
            >
              <ArrowLeft size={12} /> ปิดหน้าดูบิล
            </Button>
          </div>

          {!rc ? (
            <div className="p-12 text-center space-y-4">
              <AlertTriangle className="text-[var(--ui-danger)] mx-auto" size={40} />
              <p className="text-md font-bold text-[var(--text-main)]">ไม่พบรหัสใบเสร็จนี้ในฐานระบบจัดเก็บ</p>
              <p className="text-xs text-[var(--text-soft)]">กรุณาตรวจสอบลิงก์การชำระเงินที่ทางคลังวัสดุแชร์ให้อีกครั้ง</p>
            </div>
          ) : (
            <div className="p-6 space-y-6">
              {/* Receipt short info card */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 ai-panel border border-[var(--ui-border)] p-4 rounded-2xl text-xs font-semibold text-[var(--text-main)] text-left">
                <div className="space-y-1">
                  <p className="text-[var(--text-soft)] text-[10px]">บิลคลังอ้างอิง</p>
                  <p className="text-sm font-black text-[var(--text-main)]">{rc.receipt_no}</p>
                  <p className="text-[10px] text-[var(--text-soft)] font-bold mt-1">ประเภทเอกสาร: {rc.receipt_title}</p>
                </div>
                <div className="space-y-1 sm:text-right">
                  <p className="text-[var(--text-soft)] text-[10px]">ชื่อผู้ดำเนินการสัญญา</p>
                  <p className="text-sm font-black text-[var(--text-main)]">{rc.customer_name}</p>
                  <p className="text-[10px] text-[var(--text-soft)] mt-1">วันที่ปล่อยไม้แบบ: {rc.rent_date || '-'}</p>
                </div>
              </div>

              {/* Amount unpaid callout */}
              <div className="border border-[var(--ui-border)] ai-panel rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-left">
                <div className="space-y-1">
                  <p className="text-xs font-extrabold text-[var(--text-main)] uppercase tracking-widest flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full primary-gradient-bg shrink-0"></span> ยอดรอเรียกเก็บค้างจ่าย (Debt Amount)
                  </p>
                  <p className="text-[11px] text-[var(--text-soft)] leading-normal font-medium">เพื่อปิดสัญญาเช่าและรับเครดิตเพิ่มในการสั่งปล่อยของค่ายปกติ</p>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-2xl font-black text-[var(--text-main)] font-mono">{rc.debt_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-stretch">
                <div className="border border-[var(--ui-border)] bg-[var(--app-bg)] p-5 rounded-2xl flex flex-col justify-between text-[var(--text-main)] text-center space-y-4">
                  <div className="space-y-1">
                    <p className="text-xs font-black text-[var(--text-main)]">ช่องทางชำระเงิน</p>
                    <p className="text-[10px] text-[var(--text-soft)] font-medium">หน้านี้เป็นลิงก์ดูบิลสาธารณะแบบอ่านอย่างเดียว</p>
                  </div>

                  <div className="border border-[var(--ui-border)] p-2 ai-panel rounded-2xl w-[160px] h-[160px] mx-auto flex items-center justify-center">
                    {shopSettings.BANK_QR_URL ? (
                      <img
                        src={shopSettings.BANK_QR_URL}
                        alt="Payment QR"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <p className="text-xs font-bold text-[var(--text-soft)] leading-relaxed px-3">
                        ยังไม่ได้ตั้งค่าช่องทางชำระเงิน
                      </p>
                    )}
                  </div>

                  {shopSettings.BANK_QR_URL && (
                    <div className="text-xs space-y-1">
                      <p className="font-extrabold text-[var(--text-main)]">{shopSettings.BANK_NAME || '-'}: <span className="font-mono text-[var(--text-main)]">{shopSettings.BANK_ACCOUNT_NO || '-'}</span></p>
                      <p className="font-bold text-[var(--text-soft)]">ชื่อบัญชี: {shopSettings.BANK_ACCOUNT_OWNER || '-'}</p>
                    </div>
                  )}
                </div>

                <div className="flex flex-col justify-between gap-4 text-left border border-[var(--ui-border)] ai-panel rounded-2xl p-5">
                  <div className="space-y-3 text-xs font-semibold">
                    <p className="text-[var(--text-soft)] text-[10px] uppercase tracking-widest font-black">สถานะลิงก์สาธารณะ</p>
                    <p className="text-[var(--text-main)] font-bold leading-relaxed">
                      ผู้เปิดลิงก์นี้ดูข้อมูลบิลได้เท่านั้น ไม่สามารถแก้ไข ลบ อัปโหลดสลิป หรือเปลี่ยนสถานะยอดเงินจากหน้านี้
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="rounded-xl border border-[var(--ui-border)] p-3">
                      <p className="text-[var(--text-soft)] text-[10px]">ยอดรวมบิล</p>
                      <p className="font-black font-mono">{Number(rc.grand_total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                    </div>
                    <div className="rounded-xl border border-[var(--ui-border)] p-3">
                      <p className="text-[var(--text-soft)] text-[10px]">ยอดค้างชำระ</p>
                      <p className="font-black font-mono">{Number(rc.debt_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Footer warning */}
          <div className="ai-panel px-6 py-4 border-t border-[var(--ui-border)] text-center text-[10px] text-[var(--text-soft)] font-extrabold uppercase tracking-wide">
            {shopSettings.SHOP_ADDRESS} • โทร {shopSettings.SHOP_TELEPHONE}
          </div>
        </div>
      </div>
    );
  }

  if (viewContractId) {
    const parseJsonValue = <T,>(value: unknown, fallback: T): T => {
      if (!value) return fallback;
      if (typeof value !== 'string') return value as T;
      try {
        return JSON.parse(value) as T;
      } catch (e) {
        return fallback;
      }
    };

    const cachedHistory = localStorage.getItem('JRK_SAVED_CONTRACTS');
    let contractsTemp: any[] = [];
    if (cachedHistory) {
      try {
        contractsTemp = JSON.parse(cachedHistory);
      } catch (e) { }
    }
    const legacyContract = contractsTemp.find(c => c.contract_id === viewContractId || c.contract_no === viewContractId);
    const modernDoc = JirakitDB.getContractDocuments().find(c => c.id === viewContractId || c.contract_no === viewContractId);
    const modernContract = modernDoc ? (() => {
      const customerSnap = parseJsonValue < any > (modernDoc.customer_snapshot_json, {});
      const receiptSnap = parseJsonValue < any > (modernDoc.receipt_snapshot_json, {});
      const signatureSnap = parseJsonValue < any > (modernDoc.signature_snapshot_json, {});
      const selectedItems = parseJsonValue < any[] > (modernDoc.selected_items_snapshot_json, []);
      const receiptItems = parseJsonValue < any[] > (receiptSnap.items_json, []);
      const pages = JirakitDB.getContractPagesByContractId(modernDoc.id).sort((a, b) => a.page_order - b.page_order);
      const htmlFromPages = pages.length
        ? pages.map(page => page.content_html).join('<div style="page-break-after: always;"></div>')
        : parseJsonValue < any[] > (modernDoc.contract_pages_json, []).map((page: any) => page.html || page.content_html || '').join('<div style="page-break-after: always;"></div>');
      const rawItems = receiptItems.length ? receiptItems : selectedItems;
      const rentalItems = rawItems.map(item => ({
        ...item,
        item_name: item.item_name || item.receipt_name || item.name || item.sku || 'รายการเช่า',
        qty: Number(item.qty || item.quantity || 0)
      }));

      return {
        contract_id: modernDoc.id,
        contract_no: modernDoc.contract_no,
        contract_date: (modernDoc.created_at || '').slice(0, 10),
        receipt_no: receiptSnap.receipt_no || '',
        customer_name: customerSnap.customer_name || receiptSnap.customer_name || '-',
        id_card_no: customerSnap.id_card_no || customerSnap.tax_id || '',
        phone: customerSnap.phone || receiptSnap.phone || '',
        address: customerSnap.current_worksite || customerSnap.delivery_location || customerSnap.address || receiptSnap.delivery_location || receiptSnap.address || '',
        rental_items: rentalItems,
        has_deposit: Number(receiptSnap.deposit || 0) > 0,
        deposit_amount: Number(receiptSnap.deposit || 0),
        customer_signature_base64: customerSnap.customer_signature || signatureSnap.customer_signature || signatureSnap.signature || '',
        contract_html_edited: htmlFromPages,
        status: modernDoc.status === 'draft' ? 'Draft' : modernDoc.status === 'archived' ? 'Printed' : 'Signed'
      };
    })() : null;
    const contract = modernContract || legacyContract;
    const shopSettings = JirakitDB.getSettings();

    const generatePublicContractHtml = (rc: any) => {
      return `
        <div style="font-family: 'Sarabun', sans-serif; padding: 20px; line-height: 1.6; color: var(--doc-text); max-width: 100%;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h2 style="font-size: 20px; font-weight: 800; margin: 0; color: var(--doc-text);">${shopSettings.SHOP_NAME || 'จีรกิตติ์ ไม้แบบพลาสติก'}</h2>
            <p style="font-size: 11.5px; color: var(--doc-soft); margin: 4px 0 0 0;">โทร: ${shopSettings.SHOP_TELEPHONE} • ${shopSettings.SHOP_ADDRESS}</p>
            <div style="width: 100px; height: 1.5px; background-color: var(--doc-border); margin: 10px auto;"></div>
            <h3 style="font-size: 15px; font-weight: 750; margin: 0; text-decoration: underline; letter-spacing: 0.5px;">หนังสือยืนยันตรวจรับสัญญาเช่าวัสดุอุปกรณ์พลาสติก</h3>
          </div>

          <div style="display: flex; justify-content: space-between; font-size: 11.5px; border-bottom: 1px dashed var(--doc-border); padding-bottom: 10px; margin-bottom: 14px;">
            <div>
              <strong>เลขที่หนังสือสัญญา:</strong> <span style="font-family: monospace; font-weight: bold; color: var(--doc-primary);">${rc.contract_no}</span><br/>
              <strong>วันที่ลงบันทึก:</strong> ${rc.contract_date}<br/>
              <strong>อ้างอิงใบปล่อยของPOS:</strong> ${rc.receipt_no || 'ไม่มีเลขอ้างอิง'}
            </div>
            <div style="text-align: right;">
              <strong>ประเภทระบบ:</strong> สัญญาเช่าตามรูปแบบคลัง<br/>
              <strong>ผู้ควบคุมสิทธิ:</strong> จีรกิตติ์คริปโต POS/ERP
            </div>
          </div>

          <p style="font-size: 11.5px; text-indent: 20px; margin: 0 0 12px 0; text-align: justify;">
            ข้อตกลงและหนังสือยินยอมตามระเบียบนี้ทำขึ้นระหว่าง **คลังผู้ให้เช่า จีรกิตติ์ ไม้แบบพลาสติก** (เรียกว่าผู้ให้เช่า) ฝ่ายหนึ่ง และ
            ผู้ขอเช่าใช้สิทธิ **<span style="background-color: var(--doc-bg); padding: 2px 4px; border-radius: 4px; font-weight: bold; color: var(--doc-text);">${rc.customer_name || '..........................................................'}</span>**
            เลขประจําตัวประชาชน **<span style="background-color: var(--doc-bg); padding: 2px 4px; border-radius: 4px; font-weight: bold; color: var(--doc-text);">${rc.id_card_no || '...........................................'}</span>**
            เบอร์โทรติดต่อ **<span style="font-weight: 600;">${rc.phone || '...........................................'}</span>**
            ที่อยู่หน้างานตึกก่อสร้างตามระเบียบเอกสาร **<span>${rc.address || '......................................................................................................................................................'}</span>**
            (เรียกว่าผู้เช่าสัญญา) อีกฝ่ายหนึ่ง โดยสองฝ่ายตกลงตระเตรียมระเบียบปล่อยรับวัสดุดังต่อไปนี้
          </p>

          <h4 style="font-size: 12px; font-weight: 700; margin: 12px 0 6px 0; color: var(--doc-text);">1. รายการไม้แบบและวัสดุก่อสร้างที่เช่าใช้งาน</h4>
          <div className="w-full overflow-x-auto">
<${'table'} style="width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 11.5px;">
            <thead>
              <tr style="background-color: var(--ui-on-primary); border-top: 1px solid var(--doc-border); border-bottom: 1px solid var(--doc-border);">
                <th style="padding: 8px; text-align: center; border: 1px solid var(--doc-border); width: 10%;">ลำดับ</th>
                <th style="padding: 8px; text-align: left; border: 1px solid var(--doc-border); width: 65%;">รายการอุปกรณ์ (Specification)</th>
                <th style="padding: 8px; text-align: center; border: 1px solid var(--doc-border); width: 25%;">จำนวนรวม (หน่วย)</th>
              </tr>
            </thead>
            <tbody>
              ${rc.rental_items ? rc.rental_items?.map((item: any, idx: number) => `
                <tr>
                  <td style="padding: 8px; text-align: center; border: 1px solid var(--doc-border);">${idx + 1}</td>
                  <td style="padding: 8px; border: 1px solid var(--doc-border); font-weight: bold;">${item.item_name}</td>
                  <td style="padding: 8px; text-align: center; border: 1px solid var(--doc-border); font-weight: bold; color: var(--doc-danger);">${item.qty} ชิ้น</td>
                </tr>
              `).join('') : ''}
            </tbody>
          </${'table'}>
</div>

          <h4 style="font-size: 12px; font-weight: 700; margin: 12px 0 6px 0; color: var(--doc-text);">2. ข้อตกลง มัดจำประกันภัย และการดูแลรักษาสิ่งของเสียหาย</h4>
          <ul style="font-size: 11.5px; margin: 0 0 16px 0; padding-left: 16px; line-height: 1.6;">
            ${rc.has_deposit ? `<li>ในวันทำสัญญานี้ ผู้เช่าได้จ่ายเงินสดมัดจำค้ำประกันพัสดุเป็นยอดมูลค่า <strong>${rc.deposit_amount.toLocaleString()} บาท</strong> เพื่อความค้ำชูเสี่ยงความพังทลายของไม้แบบพลาสติกและเหล็ก</li>` : '<li>ไม่มีเงินมัดจำสำหรับสัญญานี้ (ปรับเปลี่ยนเป็นระบบประเมินเครดิต term รายเดือนพิเศษ)</li>'}
            <li>ผู้เช่าตกลงและยืนยันว่าจะรักษาดูแลไม้แบบพลาสติก นั่งร้าน และสินค้ามิให้เปรอะสีน้ำมัน หรือเคาะด้วยค้อนเหล็กกล้าจนแตกร้าว</li>
            <li>กรณีมีของสูญหาย แตกบิดเปรี้ยว หรือชำรุดเสียหายเกินเยียวยา ผู้เช่าสัญญาตกลงยินยอมชดใช้มูลค่าตามตารางประเมินราคาซ่อมแซมหน้าร้านของจีรกิตติ์ อุปกรณ์</li>
            <li>หากผู้เช่าส่งของคืนล่าช้ากว่ากำหนดในบิล POS ตกลงเสียค่าเบี้ยปรับรายวันล่าช้า 1.5% ต่อวันตามสัดส่วนราคากลางที่เขียนไว้ข้างหลังต้น</li>
          </ul>

          <div style="margin-top: 24px; display: flex; justify-content: space-between; font-size: 11.5px;">
            <div style="width: 45%; text-align: center;">
              <p style="margin-bottom: 30px;">ลงชื่อ ............................................................ ผู้ให้เช่า<br/>( ตัวแทนเจ้าหน้าที่พนักงานคลัง )</p>
            </div>
            <div style="width: 45%; text-align: center; position: relative;">
              <div style="height: 30px; margin-bottom: 5px; display: flex; align-items: center; justify-content: center;">
                ${rc.customer_signature_base64 ? `<img src="${rc.customer_signature_base64}" alt="Customer Signature" style="max-height: 30px; object-fit: contain;" />` : `<span style="color: var(--doc-soft); font-style: italic; font-size: 11px;">(ยังไม่ได้ยืนยันลายเซ็น)</span>`}
              </div>
              <p>ลงชื่อ ............................................................ ผู้เช่า/ผู้กู้เงินเช่า<br/>
                <strong>( ${rc.customer_name || '..........................................................'} )</strong>
              </p>
            </div>
          </div>
        </div>
      `;
    };

    return (
      <div className="min-h-screen ai-panel text-[var(--text-main)] flex items-center justify-center p-4 sm:p-6 font-sans antialiased">
        <div className="w-full max-w-3xl bg-[var(--app-bg)] rounded-3xl border border-[var(--ui-border)] shadow-2xl overflow-hidden flex flex-col">
          {/* Header Portal banner */}
          <div className="bg-[var(--ui-primary)] text-[var(--ui-on-primary)] px-6 py-5 border-b border-[var(--ui-border)] flex items-center justify-between animate-none">
            <div className="flex items-center gap-3 text-left">
              <div className="w-10 h-10 rounded-xl ai-panel text-[var(--text-main)] flex items-center justify-center font-black text-2xl">J</div>
              <div>
                <h1 className="text-sm font-black tracking-tight text-[var(--text-main)] uppercase">{shopSettings.SHOP_NAME}</h1>
                <p className="text-[10px] text-[var(--text-soft)] font-black mt-0.5 uppercase tracking-wider">ระบบตรวจสอบและและดูสัญญาเช่าออนไลน์ (Digital Verification)</p>
              </div>
            </div>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                const cleanUrl = window.location.origin + window.location.pathname;
                window.history.replaceState({}, document.title, cleanUrl);
                setViewContractId(null);
              }}
            >
              <ArrowLeft size={12} /> ปิดหน้านี้
            </Button>
          </div>

          {!contract ? (
            <div className="p-12 text-center space-y-4">
              <AlertTriangle className="text-[var(--ui-danger)] mx-auto" size={40} />
              <p className="text-md font-bold text-[var(--text-main)]">ไม่พบรหัสสัญญาเช่านี้ในสารระบบจัดเก็บ</p>
              <p className="text-xs text-[var(--text-soft)] font-semibold">ขออภัย สัญญาเช่าอาจได้รับเปลี่ยนเลขที่ สิ้นสุดความคุ้มครอง หรือยังไม่ได้บันทึกเสร็จสิ้น</p>
            </div>
          ) : (
            <div className="p-6 space-y-6 text-left">
              {/* Short status card */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ai-panel border border-[var(--ui-border)] p-4.5 rounded-2xl">
                <div>
                  <p className="text-[10px] uppercase font-black tracking-wider text-[var(--text-soft)]">เลขอ้างอิงสัญญาคลัง (Contract No.)</p>
                  <p className="text-lg font-black text-[var(--text-main)] font-mono">{contract.contract_no}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-[var(--text-soft)]">สถานะตามสิทธิกฎหมาย:</span>
                  {contract.status === 'Draft' ? (
                    <span className="bg-[var(--ui-danger)]/10 text-[var(--ui-danger)] border border-[var(--ui-danger)]/30 px-3 py-1 rounded-full text-xs font-black">ฉบับร่าง (Draft - รอลายเซ็น)</span>
                  ) : contract.status === 'Signed' ? (
                    <span className="bg-[var(--ui-primary)] text-[var(--text-main)] border border-[var(--ui-primary)]/50 px-3 py-1 rounded-full text-xs font-black">เปิดสิทธิใช้การ (Signed)</span>
                  ) : (
                    <span className="bg-[var(--ui-primary)] text-[var(--text-main)] border border-[var(--ui-border)] px-3 py-1 rounded-full text-xs font-black">พิมพ์หนังสือสัญญาแล้ว (Printed)</span>
                  )}
                </div>
              </div>

              {/* Dynamic contract print view or static fields */}
              <div className="border border-[var(--ui-border)] rounded-2xl p-5 ai-panel space-y-5 shadow-sm">
                <h3 className="text-xs font-black uppercase tracking-wider text-[var(--text-main)] border-b border-dashed border-[var(--ui-border)] pb-2 flex items-center gap-2">
                  <FileCheck size={16} /> ข้อมูลประวัติและคู่สัญญากู้เช่าวัสดุ
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 gap-4 text-xs font-bold">
                  <div>
                    <span className="text-[var(--text-soft)] block text-[10px] uppercase font-black">ชื่อกู้ยอมรับสัญญา:</span>
                    <span className="text-sm text-[var(--text-main)] font-black">{contract.customer_name}</span>
                  </div>
                  <div>
                    <span className="text-[var(--text-soft)] block text-[10px] uppercase font-black">ทะเบียนบัตรประชาชน:</span>
                    <span className="text-sm text-[var(--text-main)] font-mono font-black">{contract.id_card_no || 'ไม่ระบุ'}</span>
                  </div>
                  <div>
                    <span className="text-[var(--text-soft)] block text-[10px] uppercase font-black">เบอร์ติดต่อโครงการ:</span>
                    <span className="text-sm text-[var(--text-main)] font-mono font-black">{contract.phone || 'ไม่ระบุ'}</span>
                  </div>
                  <div>
                    <span className="text-[var(--text-soft)] block text-[10px] uppercase font-black">ลงวันที่ร่างสัญญาเช่า:</span>
                    <span className="text-sm text-[var(--text-main)] font-mono font-black">{contract.contract_date}</span>
                  </div>
                  <div className="md:col-span-2">
                    <span className="text-[var(--text-soft)] block text-[10px] uppercase font-black">สถานที่ทำงานจัดส่งพิทักษ์:</span>
                    <span className="text-xs text-[var(--text-main)] font-semibold leading-relaxed block ai-panel p-3 rounded-xl border border-[var(--ui-border)] mt-1">{contract.address || 'ไม่ระบุสถานที่'}</span>
                  </div>
                </div>

                <div className="mt-6">
                  <h4 className="text-xs font-black text-[var(--text-main)] mb-3 flex items-center gap-1.5 uppercase tracking-wide">
                    <Package size={14} /> ตารางจัดเตรียมพัสดุและไม้แบบในสัญญา (Checklist)
                  </h4>
                  <div className="border border-[var(--ui-border)] rounded-xl overflow-hidden shadow-xs">
                    <div className="w-full overflow-x-auto">
                      <DataTable className="w-full text-xs text-left font-bold text-[var(--text-soft)]">
                        <thead className="ai-panel">
                          <tr className="h-9 border-b border-[var(--ui-border)] text-[var(--text-soft)] font-black text-[10px] tracking-wider uppercase">
                            <th className="p-3 text-center w-12">ลำดับ</th>
                            <th className="p-3">รายการอุปกรณ์สินค้าประกอบแบบ</th>
                            <th className="p-3 text-center w-36">จำนวนเช่า (ชิ้น/หน่วย)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--ui-border)]/60">
                          {contract.rental_items && contract.rental_items?.map((rit: any, idx: number) => (
                            <tr key={idx} className="h-10 hover:ai-panel">
                              <td className="p-3 text-center text-[var(--text-soft)] font-mono font-medium">{idx + 1}</td>
                              <td className="p-3 text-[var(--text-main)] font-extrabold">{rit.item_name}</td>
                              <td className="p-3 text-center font-black font-mono text-[var(--ui-danger)] bg-[var(--ui-surface)]">{rit.qty} ชิ้น</td>
                            </tr>
                          ))}
                        </tbody>
                      </DataTable>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 gap-4 mt-6 pt-4 border-t border-dashed border-[var(--ui-border)]">
                  {/* Deposit Info */}
                  <div className="ai-panel p-4.5 rounded-2xl border border-[var(--ui-border)] flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] uppercase text-[var(--text-soft)] font-black tracking-widest block">เงินสดมัดจำค้ำสัญญารวม</span>
                      <p className="text-[11px] font-semibold text-[var(--text-main)] mt-1 opacity-80">มีผลคุ้มครองค่าใช้จ่ายวัสดุพังทลายเสียหาย</p>
                    </div>
                    <p className="text-2xl font-mono font-black text-[var(--text-main)] mt-3">
                      {contract.has_deposit ? `${contract.deposit_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : 'ได้รับยกเว้นมัดจำวงเงิน'}
                    </p>
                  </div>

                  {/* Customer Signature Verification */}
                  <div className="border border-[var(--ui-border)] ai-panel p-4.5 rounded-2xl flex flex-col items-center justify-center text-center">
                    <span className="text-[10px] uppercase text-[var(--text-soft)] font-black tracking-widest mb-2.5">ตรวจสอบลายมือชื่อคู่สัญญา</span>
                    {contract.customer_signature_base64 ? (
                      <div className="ai-panel border border-[var(--ui-border)] p-1.5 rounded-xl h-14 w-full flex items-center justify-center shadow-inner">
                        <img src={contract.customer_signature_base64} alt="Digital Signature Audit" className="max-h-full object-contain" />
                      </div>
                    ) : (
                      <p className="text-xs text-[var(--text-soft)] italic font-black">ยังไม่ได้บันทึกรับสิทธิลายมือชื่อรับประทานคู่สัญญา</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Full Legal Document Formatted Preview Section */}
              <div className="ai-panel border border-[var(--ui-border)] rounded-2xl overflow-hidden shadow-xs">
                <Button
                  type="button"
                  variant="ghost"
                  size="md"
                  onClick={() => setShowFullDocPreview(!showFullDocPreview)}
                  className="w-full justify-between py-4 h-auto"
                >
                  <span className="flex items-center gap-2">
                    <FileText size={16} className="text-[var(--ui-primary)]" />
                    <span>📄 {showFullDocPreview ? 'ซ่อนเอกสารสัญญาฉบับเต็ม' : 'แสดงตัวอย่างหนังสือสัญญาเช่าฉบับเต็ม (A4 Document Preview)'}</span>
                  </span>
                  <span className="text-[10px] ai-panel px-2.5 py-1 rounded-lg text-[var(--text-main)] font-black uppercase">
                    {showFullDocPreview ? 'ปิดพรีวิว' : 'เปิดพรีวิว'}
                  </span>
                </Button>

                {showFullDocPreview && (
                  <div className="p-4 sm:p-6 bg-[var(--ui-surface)] border-t border-[var(--ui-border)] max-h-[600px] overflow-y-auto no-scrollbar relative flex flex-col items-center">
                    <div className="w-full flex justify-end max-w-4xl mx-auto mb-4">
                      <A4ImageExportButton targetId="public-contract-document" prefix="CONTRACT" />
                    </div>
                    <A4PageContainer id="public-contract-document" isLandscape={false} scaleToFit={true}>
                      <div dangerouslySetInnerHTML={{ __html: contract.contract_html_edited || generatePublicContractHtml(contract) }} />
                    </A4PageContainer>
                  </div>
                )}
              </div>

              {/* Terms of Lease */}
              <div className="bg-[var(--ui-surface)] border border-[var(--ui-border)] p-4.5 rounded-2xl text-[11px] font-medium text-[var(--text-main)] space-y-2 leading-relaxed text-left">
                <p className="font-extrabold text-[var(--text-main)] flex items-center gap-1">
                  📄 ระเบียบสัญญากลางและระเบียบปฏิบัติ:
                </p>
                <ol className="list-decimal pl-4 space-y-1 font-semibold text-[var(--text-main)]">
                  <li>โปรดดูแลรักษาสินค้าและล้างน้ำทำความสะอาดแบบพลาสติกและนั่งร้านเหล็กก่อนส่งมอบคืน</li>
                  <li>ห้ามเคาะด้วยแกนเหล็ก งัด บินเบี้ยว หรือสับด้วยค้อน แข็งกระด้างจนผิวเสียหาย</li>
                  <li>กรณีส่งล่าช้าอาจมีผลกับการเรียกเก็บยอดหนี้สะสม และได้รับการจำกัดเบี้ยปรับ {shopSettings.PENALTY_RATE}% ต่อวันตามเกณฑ์</li>
                </ol>
              </div>

              {/* Print option */}
              <div className="flex gap-3 justify-end">
                <Button
                  type="button"
                  onClick={() => {
                    const iframe = document.createElement('iframe');
                    iframe.style.position = 'absolute';
                    iframe.style.width = '0';
                    iframe.style.height = '0';
                    iframe.style.border = 'none';
                    document.body.appendChild(iframe);

                    const printWindow = iframe.contentWindow;
                    if (!printWindow) {
                      alert('Popup blocked. Please allow the system to open a new tab for printing.');
                      document.body.removeChild(iframe);
                      return;
                    }
                    const targetHtml = contract.contract_html_edited || `
                      <div style="font-family: 'Sarabun', sans-serif; padding: 20px; color: var(--doc-text); max-width: 100%;">
                        <div style="text-align: center; margin-bottom: 24px;">
                          <h2 style="font-size: 22px; font-weight: 800; margin: 0; color: var(--doc-text);">${shopSettings.SHOP_NAME}</h2>
                          <p style="font-size: 13px; color: var(--doc-soft); margin: 4px 0 0 0;">โทร: ${shopSettings.SHOP_TELEPHONE} • ${shopSettings.SHOP_ADDRESS}</p>
                          <div style="width: 150px; height: 1.5px; background-color: var(--doc-border); margin: 12px auto;"></div>
                          <h3 style="font-size: 18px; font-weight: 700; border-bottom: 1px solid var(--doc-border); padding-bottom: 8px;">ใบสัญญาเช่าพัสดุก่อสร้างพลาสติกและเหล็กแบบรับรอง</h3>
                        </div>
                        <div style="font-size: 13px; line-height: 1.8;">
                          <strong>เลขที่สัญญาเช่า:</strong> ${contract.contract_no}<br/>
                          <strong>ผู้เช่า:</strong> ${contract.customer_name}<br/>
                          <strong>รหัสบัตรประชาชน:</strong> ${contract.id_card_no}<br/>
                          <strong>เบอร์โทรติดต่อ:</strong> ${contract.phone}<br/>
                          <strong>ที่อยู่หน้างาน:</strong> ${contract.address}<br/>
                          <strong>วันที่เริ่มทำสัญญา:</strong> ${contract.contract_date}<br/>
                          <br/>
                          <strong>ยอดประกันมัดจำ:</strong> ${contract.has_deposit ? contract.deposit_amount + ' บาท' : 'ไม่มีเงินมัดจำ'}<br/>
                          <br/>
                          <strong>รายการพัสดุ:</strong>
                          <ul style="padding-left: 20px;">
                            ${contract.rental_items ? contract.rental_items?.map((it: any) => `<li>${it.item_name} — <strong>${it.qty}</strong> ชิ้น</li>`).join('') : ''}
                          </ul>
                        </div>
                      </div>
                    `;
                    printWindow.document.open();
                    printWindow.document.write(`
                      <html>
                        <head>
                          <title>สัญญาเช่าอิเล็กทรอนิกส์ - ${contract.contract_no}</title>
                          <meta charset="utf-8"/>
                          <style>
                            body { font-family: 'Sarabun', sans-serif; padding: 40px; color: var(--doc-text); background: var(--doc-card); }
                          </style>
                        </head>
                        <body>
                          <div style="width: 100%; max-width: 800px; margin: 0 auto;">
                            ${targetHtml}
                          </div>
                          <script>
                            window.onload = function() {
                              window.print();
                              setTimeout(function() {
                                window.frameElement.remove();
                              }, 1000);
                            }
                          </script>
                        </body>
                      </html>
                    `);
                    printWindow.document.close();
                  }}
                  className="px-6 py-3.5 bg-[var(--ui-primary)] text-[var(--ui-on-primary)] rounded-2xl text-xs font-black shadow-lg hover:opacity-90 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <FileText size={14} /> ดาวน์โหลด PDF / ตรวจกระดาษสั่งพิมพ์
                </Button>
              </div>
            </div>
          )}

          {/* Footer warning */}
          <div className="ai-panel px-6 py-4 border-t border-[var(--ui-border)] text-center text-[10px] text-[var(--text-soft)] font-extrabold uppercase tracking-wide">
            {shopSettings.SHOP_ADDRESS} • โทร {shopSettings.SHOP_TELEPHONE}
          </div>
        </div>
      </div>
    );
  }

  const handleNavigate = (menu: MenuID) => {
    setCurrentMenu(menu);
    setSidebarOpen(false);
    setNotificationsOpen(false);
  };

  const shopSettings = JirakitDB.getSettings();

  const notificationItems = (() => {
    const settingsAlerts: { title: string; detail: string; tone: 'danger' | 'warning' | 'primary' }[] = [];
    try {
      const lowProducts = JirakitDB.getProducts().filter(p => p.qty_available <= p.low_stock_threshold && p.item_status === 'Active').slice(0, 5);
      lowProducts.forEach(p => settingsAlerts.push({ title: 'สต็อกต่ำ', detail: `${p.item_name} เหลือ ${p.qty_available} ${p.unit}`, tone: 'warning' }));
      const unpaid = JirakitDB.getReceipts().filter(r => r.debt_amount > 0).slice(0, 5);
      unpaid.forEach(r => settingsAlerts.push({ title: 'ยอดค้างชำระ', detail: `${r.receipt_no} / ${r.customer_name} ค้าง ${Number(r.debt_amount || 0).toLocaleString()} บาท`, tone: 'danger' }));
      const dueApps = JirakitDB.getAppointments().filter(a => a.appointment_status === 'To Deliver' || a.appointment_status === ('Active' as any)).slice(0, 5);
      dueApps.forEach(a => settingsAlerts.push({ title: 'นัดหมายใกล้ถึง', detail: `${a.appointment_title || a.customer_name || 'รายการนัดหมาย'} วันที่ ${a.appointment_date}`, tone: 'primary' }));
    } catch (e) {
      settingsAlerts.push({ title: 'แจ้งเตือนระบบ', detail: 'ยังไม่สามารถอ่านรายการแจ้งเตือนได้', tone: 'warning' });
    }
    return settingsAlerts.slice(0, 10);
  })();

  if (authMode === 'login' || authMode === 'register') {
    return (
      <div className="min-h-screen ai-panel flex items-center justify-center p-4 antialiased text-[var(--text-main)]">
        <div className="w-full max-w-sm ai-panel rounded-3xl border border-[var(--ui-border)] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300">
          <div className="primary-gradient-bg px-6 py-10 flex flex-col items-center">
            <h1 className="text-xl font-black text-[var(--text-main)] text-center">{shopSettings.SHOP_NAME || 'จีรกิตติ์ ไม้แบบพลาสติก'}</h1>
            <p className="text-xs text-[var(--text-soft)] font-bold mt-1 tracking-widest uppercase">{authMode === 'login' ? 'เข้าสู่ระบบ (LOGIN)' : 'สมัครสมาชิก (REGISTER)'}</p>
          </div>

          <div className="mx-8 mt-6 rounded-xl border border-[var(--ui-warning)]/40 bg-[var(--ui-warning)]/10 p-3 text-[11px] font-bold text-[var(--text-muted)] leading-relaxed">
            DEV MODE: ระหว่างพัฒนาใช้ admin/admin123 ได้เท่านั้นในบัญชีทดสอบจริง การสมัครใหม่จะเป็น Pending และต้องรอ Owner/Admin อนุมัติ
          </div>
          {authNotice && (
            <div className="mx-8 mt-3 rounded-xl border border-[var(--ui-success)]/40 bg-[var(--ui-success)]/10 p-3 text-xs font-bold text-[var(--ui-success)] leading-relaxed text-center">
              {authNotice}
            </div>
          )}

          {authMode === 'login' ? (
            <form onSubmit={handleLoginSubmit} className="p-8 space-y-4 text-left">
              <div>
                <label className="block text-[11px] font-black text-[var(--text-soft)] uppercase tracking-widest mb-1.5">ชื่อผู้ใช้งาน</label>
                <Input
                  type="text"
                  value={userNameEntry}
                  onChange={e => setUserNameEntry(e.target.value)}
                  className="w-full h-12 px-4 bg-[var(--app-bg)] border border-[var(--ui-border)] rounded-xl text-sm font-bold transition-all"
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-[11px] font-black text-[var(--text-soft)] uppercase tracking-widest mb-1.5">รหัสผ่าน</label>
                <Input
                  type="password"
                  value={passwordEntry}
                  onChange={e => setPasswordEntry(e.target.value)}
                  className="w-full h-12 px-4 bg-[var(--app-bg)] border border-[var(--ui-border)] rounded-xl text-sm font-bold transition-all"
                  required
                />
              </div>
              {loginError && <p className="text-[var(--ui-danger)] text-xs font-bold text-center">โ {loginError}</p>}
              <Button
                type="submit"
                className="w-full py-4 mt-2 outer-cont text-[var(--text-main)]  rounded-xl font-black text-sm uppercase tracking-wider transition-all shadow-md active:opacity-80 disabled:opacity-50"
              >
                เข้าสู่ระบบ
              </Button>
              <div className="text-center pt-2">
                <Button type="button" onClick={() => { setAuthMode('register'); setLoginError(''); setAuthNotice(''); setPasswordEntry(''); }} className="text-xs text-[var(--ui-primary)] font-bold hover:underline">สมัครสมาชิกใหม่</Button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleRegisterSubmit} className="p-8 space-y-4 text-left">
              <div>
                <label className="block text-[11px] font-black text-[var(--text-soft)] uppercase tracking-widest mb-1.5">ชื่อผู้ใช้งาน (Username)</label>
                <Input
                  type="text"
                  value={userNameEntry}
                  onChange={e => setUserNameEntry(e.target.value)}
                  className="w-full h-11 px-3 bg-[var(--app-bg)] border border-[var(--ui-border)] rounded-lg text-sm font-bold"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-black text-[var(--text-soft)] uppercase tracking-widest mb-1.5">รหัสผ่าน (Password)</label>
                <Input
                  type="password"
                  value={passwordEntry}
                  onChange={e => setPasswordEntry(e.target.value)}
                  className="w-full h-11 px-3 bg-[var(--app-bg)] border border-[var(--ui-border)] rounded-lg text-sm font-bold"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-black text-[var(--text-soft)] uppercase tracking-widest mb-1.5">ชื่อ-สกุล (Display Name)</label>
                <Input
                  type="text"
                  value={displayNameEntry}
                  onChange={e => setDisplayNameEntry(e.target.value)}
                  className="w-full h-11 px-3 bg-[var(--app-bg)] border border-[var(--ui-border)] rounded-lg text-sm font-bold"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-black text-[var(--text-soft)] uppercase tracking-widest mb-1.5">สิทธิ์การใช้งาน (Role)</label>
                <Select value={roleEntry} onChange={e => setRoleEntry(e.target.value)} className="w-full h-11 px-3 border border-[var(--ui-border)] rounded-lg text-sm">
                  <option value="Staff">พนักงานขาย (Staff)</option>
                  <option value="Viewer">ดูข้อมูลอย่างเดียว (Viewer)</option>
                  <option value="User">ผู้ใช้งานทั่วไป (User)</option>
                  <option value="Accounting">บัญชี (Accounting)</option>
                  <option value="Manager">ผู้จัดการ (Manager)</option>
                </Select>
              </div>
              {loginError && <p className="text-[var(--ui-danger)] text-xs font-bold text-center">โ {loginError}</p>}
              <Button
                type="submit"
                className="w-full py-3 mt-2 bg-[var(--ui-primary)] text-[var(--ui-on-primary)] rounded-xl font-black text-sm transition-all shadow-md active:opacity-80"
              >
                ยืนยันการสมัคร
              </Button>
              <div className="text-center pt-2">
                <Button type="button" onClick={() => { setAuthMode('login'); setLoginError(''); setAuthNotice(''); setPasswordEntry(''); }} className="text-xs text-[var(--ui-primary)] font-bold hover:underline">กลับไปหน้าเข้าสู่ระบบ</Button>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }

  if (authMode === 'pin') {
    return (
      <div className="min-h-screen ai-panel flex items-center justify-center p-4 antialiased text-[var(--text-main)]">
        <div className="w-full max-w-sm ai-panel rounded-3xl border border-[var(--ui-border)] shadow-2xl overflow-hidden text-center animate-in fade-in zoom-in-95 duration-300">
          <div className="primary-gradient-bg px-6 py-10 flex flex-col items-center">
            <div className="relative w-20 h-20 mb-4">
              <img
                src="/icons/jirakit-icon-192.png"
                alt="Logo"
                className="w-20 h-20 ai-panel rounded-2xl flex items-center justify-center shadow-lg object-contain p-1"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                  if (fallback) fallback.style.display = 'flex';
                }}
              />
              <div
                className="absolute inset-0 ai-panel shadow-lg rounded-2xl hidden items-center justify-center"
                style={{ display: 'none' }}
              >
                <Shield className="text-[var(--text-main)]" size={36} />
              </div>
            </div>
            <h1 className="text-xl font-black text-[var(--text-main)]">{shopSettings.SHOP_NAME || 'จีรกิตติ์ ไม้แบบพลาสติก'}</h1>
            <p className="text-xs text-[var(--text-soft)] font-bold mt-1 tracking-widest uppercase">Secured POS & ERP System</p>
          </div>
          <div className="mx-8 mt-6 rounded-xl border border-[var(--ui-warning)]/40 bg-[var(--ui-warning)]/10 p-3 text-[11px] font-bold text-[var(--text-muted)] leading-relaxed">
            DEV MODE: PIN สำรอง 123456 ใช้ได้เฉพาะช่วงพัฒนา หากไม่มีการใช้งานเกิน 5 นาที ระบบจะล็อกด้วย PIN
          </div>
          <form onSubmit={(e) => {
            e.preventDefault();
            handlePinSubmit(pinEntry);
          }} className="p-8 space-y-4">
            <div className="space-y-4 text-left">
              <div>
                <label className="block text-[11px] font-black text-[var(--text-soft)] uppercase tracking-widest mb-1.5">
                  รหัส PIN 6 หลัก (PIN Code)
                </label>
                <Input
                  type="password"
                  value={pinEntry}
                  onChange={e => setPinEntry(e.target.value)}
                  placeholder="••••••"
                  maxLength={6}
                  pattern="[0-9]*"
                  inputMode="numeric"
                  className={`w-full h-12 px-4 bg-[var(--app-bg)] border ${loginError ? 'border-[var(--ui-border)]' : 'border-[var(--ui-border)]'} rounded-xl text-center tracking-[0.5em] text-xl font-black transition-all`}
                  autoFocus
                />
              </div>
              {loginError && <p className="text-[var(--ui-danger)] text-xs font-bold animate-pulse text-center">โ {loginError}</p>}
            </div>
            <Button
              type="submit"
              className="w-full py-4 mt-2 outer-cont text-[var(--text-main)]  rounded-xl font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-md active:opacity-80"
              disabled={pinEntry.length < 4}
            >
              <KeyRound size={16} /> ยืนยัน PIN เข้าสู่ระบบ
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 h-dvh overflow-hidden bg-[var(--app-bg)] text-[var(--text-main)] font-sans antialiased flex flex-col xl:flex-row">

      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-[var(--text-main)]/50 z-40 xl:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside className={`
  fixed inset-y-0 left-0 z-50 h-dvh w-64 flex-col justify-between border-r border-[var(--ui-border)] p-5 shrink-0 ai-panel shadow-2xl overflow-y-auto no-scrollbar transform transition-transform duration-300
  ${sidebarOpen ? 'translate-x-0 flex' : '-translate-x-full hidden'}
`}>
        <div>
          {/* Brand header */}
          <div className="flex items-center gap-3 mb-8">
            <div className="relative w-11 h-11">
              <img
                src="/icons/jirakit-icon-192.png"
                alt="Logo"
                className="w-11 h-11 rounded-xl shadow-lg shadow-[var(--ui-text)]/10 object-contain ai-panel"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                  if (fallback) fallback.style.display = 'flex';
                }}
              />
              <div
                className="absolute inset-0 rounded-xl bg-[var(--ui-primary)] text-[var(--ui-on-primary)] text-[var(--text-main)] hidden items-center justify-center font-black text-2xl shadow-lg shadow-[var(--ui-text)]/10"
                style={{ display: 'none' }}
              >
                J
              </div>
            </div>
            <div>
              <h1 className="text-sm font-black tracking-tight text-[var(--text-main)] uppercase">จีรกิตติ์ ไม้แบบ</h1>
              <p className="text-[10px] text-[var(--text-soft)] font-black mt-0.5 uppercase tracking-wider">POS & ERP SYSTEM</p>
            </div>
          </div>

          {/* Menus List */}
          <nav className="space-y-1.5">
            {MENUS.map(m => {
              const active = currentMenu === m.id;
              return (
                <Button
                  key={m.id}
                  onClick={() => handleNavigate(m.id)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-xs font-extrabold uppercase transition-all tracking-wide ${active
                    ? 'bg-[var(--ui-primary)] text-[var(--ui-on-primary)] shadow-md font-black border-l-4 border-[var(--ui-primary)]'
                    : 'text-[var(--text-soft)] hover:ai-panel hover:text-[var(--text-main)]'
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={active ? 'text-[var(--text-main)] font-black' : 'text-[var(--text-soft)]'}>
                      {m.icon}
                    </span>
                    <span>{m.label}</span>
                  </div>

                  {m.id === 'dashboard' && unreadAlertsCount > 0 && (
                    <span className={`text-[9.5px] font-black w-5 h-5 flex items-center justify-center rounded-full ${active ? 'bg-[var(--app-bg)] text-[var(--text-main)]' : 'bg-[var(--ui-danger)] text-[var(--ui-on-primary)]'
                      }`}>
                      {unreadAlertsCount}
                    </span>
                  )}
                </Button>
              );
            })}
          </nav>
        </div>

        {/* Footer info lock indicator */}
        <div className="border-t border-[var(--ui-border)] pt-4 mt-6">
          <div className="flex items-center gap-2.5 text-[10px] text-[var(--text-soft)] font-bold mb-3">
            <HardDrive size={13} className="text-[var(--text-main)]" />
            <div>
              <p className="font-extrabold text-[var(--text-main)]">คลังอุตรดิตถ์: เชื่อมต่อปกติ</p>
              <p className="text-[9px] text-[var(--text-soft)] font-mono mt-0.5 tracking-wider">LOCAL PERSIST SYSTEM</p>
            </div>
          </div>

          <div className="flex items-center justify-between ai-panel rounded-lg p-2 border border-[var(--ui-border)]">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full ai-panel flex items-center justify-center text-[var(--text-main)]">
                <Users size={12} />
              </div>
              <div className="text-left">
                <p className="text-[10px] font-black text-[var(--text-main)]">{JirakitDB.getActiveSession()?.display_name}</p>
                <p className="text-[9px] font-bold text-[var(--text-soft)]">{JirakitDB.getActiveSession()?.role}</p>
              </div>
            </div>
            <Button
              onClick={handleLogout}
              title="ออกจากระบบ"
              className="p-1.5 rounded-lg ai-panel text-[var(--ui-danger)] hover:ai-panel transition-colors"
            >
              <Lock size={12} />
            </Button>
          </div>
        </div>
      </aside>



      {/* Content wrapper */}
      <div className="flex-1 flex min-h-0 flex-col min-w-0">

        {/* Top Header */}
        <header className="shrink-0 bg-[var(--app-bg)]/95 backdrop-blur-md border-b border-[var(--ui-border)] px-6 py-4 flex justify-between items-center z-30 shadow-sm">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="เปิดเมนู"
              className="shrink-0 w-12 h-12 p-0 bg-transparent border-0 shadow-none rounded-none flex items-center justify-center hover:bg-transparent"
            >
              <span className="flex flex-col gap-[6px]">
                <span className="block w-8 h-[4px] bg-[var(--text-main)] rounded-full" />
                <span className="block w-8 h-[4px] bg-[var(--text-main)] rounded-full" />
                <span className="block w-8 h-[4px] bg-[var(--text-main)] rounded-full" />
              </span>
            </button>

            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-extrabold text-[var(--text-main)] tracking-tight flex items-center gap-2 truncate">
                จีรกิตติ์ ไม้แบบพลาสติก อุตรดิตถ์
              </h2>

              <p className="text-[10px] text-[var(--text-soft)] font-extrabold tracking-wider mt-0.5 truncate">
                JJK_PSU_MUEANGSAMNAK
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 shrink-0 ml-auto">
            <div className="text-right sm:block shrink-0 whitespace-nowrap">
              <p className="text-xs font-black text-[var(--text-main)] tracking-wider">
                {dateStr || '--'}
              </p>
              <p className="text-[10px] font-black text-[var(--text-main)] mt-0.5 font-mono tracking-widest">
                {timeStr || '--'}
              </p>
            </div>

            {/* Notifications dropdown */}
            <div className="relative">
              <Button
                type="button"
                variant="icon"
                size="sm"
                onClick={() => setNotificationsOpen((open) => !open)}
                className="h-10 w-10 p-0"
                aria-haspopup="menu"
                aria-expanded={notificationsOpen}
                aria-label="เปิดแจ้งเตือนระบบ"
              >
                <Bell size={16} />
                {unreadAlertsCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--ui-danger)] text-[9px] font-black text-[var(--ui-on-primary)] animate-pulse">
                    {unreadAlertsCount}
                  </span>
                )}
              </Button>

              {notificationsOpen && (
                <Card elevated className="absolute right-0 top-12 z-50 w-[min(92vw,360px)] overflow-hidden rounded-2xl shadow-2xl">
                  <div className="flex items-center justify-between gap-3 border-b border-[var(--ui-border)] px-4 py-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wider text-[var(--text-soft)]">Notification Center</p>
                      <h3 className="text-sm font-black text-[var(--text-main)]">แจ้งเตือนระบบ</h3>
                    </div>
                    <Button type="button" variant="secondary" size="sm" onClick={() => handleNavigate('dashboard')}>ดูหน้าแรก</Button>
                  </div>
                  <div className="max-h-80 overflow-y-auto p-2">
                    {notificationItems.length === 0 ? (
                      <div className="p-5 text-center text-xs font-bold text-[var(--text-soft)]">ยังไม่มีรายการแจ้งเตือน</div>
                    ) : notificationItems.map((item, idx) => (
                      <div key={`${item.title}-${idx}`} className="rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-3 text-left">
                        <p className="text-xs font-black text-[var(--text-main)]">{item.title}</p>
                        <p className="mt-1 text-[11px] font-bold leading-relaxed text-[var(--text-soft)]">{item.detail}</p>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          </div>
        </header>

        {/* Dynamic content scrollable area */}
        <main className="flex-1 min-h-0 min-w-0 p-4 sm:p-6 overflow-y-auto max-w-7xl w-full mx-auto jirakit-central-ui">
          <React.Suspense fallback={<div className="flex h-full w-full items-center justify-center p-12"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--ui-primary)]"></div></div>}>
            {currentMenu === 'dashboard' && (
              <Dashboard
                onNavigate={handleNavigate}
                triggerRefresh={triggerRefresh}
                refreshCount={refreshCount}
              />
            )}

            {currentMenu === 'appointments' && (
              <Appointments
                triggerRefresh={triggerRefresh}
                refreshCount={refreshCount}
              />
            )}

            {currentMenu === 'pos' && (
              <POS
                onNavigate={handleNavigate}
                triggerRefresh={triggerRefresh}
                refreshCount={refreshCount}
              />
            )}

            {currentMenu === 'returns' && (
              <Returns
                onNavigate={handleNavigate}
                triggerRefresh={triggerRefresh}
                refreshCount={refreshCount}
              />
            )}

            {currentMenu === 'bills' && (
              <Bills
                refreshCount={refreshCount}
                applyDateFilter={applyDateFilter}
                setApplyDateFilter={setApplyDateFilter}
                startDate={sharedStartDate}
                setStartDate={setSharedStartDate}
                endDate={sharedEndDate}
                setEndDate={setSharedEndDate}
              />
            )}

            {currentMenu === 'customers' && (
              <Customers
                refreshCount={refreshCount}
                triggerRefresh={triggerRefresh}
              />
            )}

            {currentMenu === 'products' && (
              <Products
                refreshCount={refreshCount}
                triggerRefresh={triggerRefresh}
              />
            )}

            {currentMenu === 'analytics' && (
              <Analytics />
            )}

            {currentMenu === 'accounting' && (
              <Accounting />
            )}

            {currentMenu === 'documents' && (
              <DocumentCMS />
            )}

            {currentMenu === 'contracts' && (
              <Contracts />
            )}

            {currentMenu === 'settings' && (
              <Settings
                refreshCount={refreshCount}
                triggerRefresh={triggerRefresh}
              />
            )}

            {currentMenu === 'security' && (
              <Security />
            )}
          </React.Suspense>
        </main>
      </div>

      <CustomerSharedModal
        isOpen={sharedCustomerModalOpen}
        onClose={() => setSharedCustomerModalOpen(false)}
        presetCustomer={sharedCustomerModalData}
        onSaved={triggerRefresh}
      />
    </div>
  );
}

