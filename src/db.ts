/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  SystemSettings,
  Customer,
  Product,
  Receipt,
  ReturnEvent,
  Expense,
  AlertNotification,
  Appointment,
  NoteItem,
  AuditLog,
  TerminalUser,
  BillItemRef,
  DocumentType,
  DocumentTemplate
, ContractDocument, ContractPage } from './types';
import { supabase } from './lib/supabaseClient';

const db = supabase;

function getPrimaryKey(table: string) {
  switch (table) {
    case 'products': return 'item_id';
    case 'customers': return 'customer_id';
    case 'receipts': return 'receipt_id';
    case 'users': return 'user_id';
    case 'returns': return 'return_id';
    case 'expenses': return 'expense_id';
    case 'appointments': return 'appointment_id';
    case 'notes': return 'note_id';
    case 'appData': return 'id';
    case 'audit_logs': return 'log_id';
    default: return 'id';
  }
}

const doc = (dbRef: any, table: string, id: string) => ({ table, id });

// Map a Supabase table -> the localStorage cache key the app reads from.
const LOCAL_KEYS: Record<string, string> = {
  products: 'JRK_PRODUCTS',
  customers: 'JRK_CUSTOMERS',
  receipts: 'JRK_RECEIPTS',
  returns: 'JRK_RETURNS',
  expenses: 'JRK_EXPENSES',
  appointments: 'JRK_APPOINTMENTS',
  notes: 'JRK_NOTES',
  audit_logs: 'JRK_AUDIT_LOGS',
  users: 'JRK_USERS',
};

// ==========================================
// Realtime via Supabase Broadcast (pub/sub)
// ==========================================
// Whenever this device writes a table we broadcast a lightweight {table}
// event on a shared channel. Other devices listen and re-pull just that
// table. Broadcast needs no database replication / RLS setup (unlike the
// old postgres_changes listeners) and never echoes a write back to its own
// sender (config.broadcast.self = false), so a device never re-fetches its
// own change.
const SYNC_CHANNEL = 'jjk-db-sync';
let broadcastChannel: any = null;
let syncOnUpdate: (() => void) | null = null;

function handleRemoteChange(msg: any) {
  const table = msg?.payload?.table;
  if (!table) return;
  pullTable(table)
    .then(changed => { if (changed && syncOnUpdate) syncOnUpdate(); })
    .catch(err => console.warn('Re-pull after broadcast failed', err));
}

function getBroadcastChannel() {
  if (!supabase) return null;
  if (!broadcastChannel) {
    broadcastChannel = supabase
      .channel(SYNC_CHANNEL, { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'db-change' }, handleRemoteChange);
    broadcastChannel.subscribe();
  }
  return broadcastChannel;
}

function broadcastChange(table: string) {
  const ch = getBroadcastChannel();
  if (!ch) return;
  try {
    ch.send({ type: 'broadcast', event: 'db-change', payload: { table } });
  } catch (err) {
    console.warn('Broadcast failed', err);
  }
}

// Pull one table from Supabase into its localStorage cache.
async function pullTable(table: string): Promise<boolean> {
  if (!supabase) return false;
  if (table === 'appData') return pullSettings();
  const key = LOCAL_KEYS[table];
  if (!key) return false;
  const { data, error } = await supabase.from(table).select('*');
  if (error || !data) return false;
  saveLocal(key, data);
  return true;
}

// Settings live in appData as a single { id:'settings', payload:{...} } row.
async function pullSettings(): Promise<boolean> {
  if (!supabase) return false;
  const { data, error } = await supabase
    .from('appData').select('payload').eq('id', 'settings').maybeSingle();
  if (error || !data || !data.payload) return false;
  saveLocal('JRK_SETTINGS', data.payload);
  return true;
}

const setDoc = async (docRef: {table: string, id: string}, data: any, _opts?: any) => {
  if (!supabase) return;
  const idField = getPrimaryKey(docRef.table);
  try {
    let cleanData = JSON.parse(JSON.stringify(data));
    if (docRef.table === 'appData') {
      cleanData = { id: docRef.id, payload: cleanData };
    }
    const { error } = await supabase.from(docRef.table).upsert(cleanData, { onConflict: idField });
    if (error) { console.error(`Sync error on ${docRef.table}:`, error); return; }
    broadcastChange(docRef.table);
  } catch (err) {
    console.error(`Network error syncing ${docRef.table}`, err);
  }
};

const writeBatch = (_dbRef: any) => {
  const operations: Array<{ table: string; data: any; id: string }> = [];
  return {
    set: (docRef: {table: string, id: string}, data: any, _opts?: any) => {
      operations.push({ table: docRef.table, data, id: docRef.id });
    },
    commit: async () => {
      if (!supabase) return;
      const byTable: Record<string, any[]> = {};
      operations.forEach(op => {
        if (!byTable[op.table]) byTable[op.table] = [];
        let cleanData = JSON.parse(JSON.stringify(op.data));
        if (op.table === 'appData') cleanData = { id: op.id, payload: cleanData };
        byTable[op.table].push(cleanData);
      });
      for (const table of Object.keys(byTable)) {
         const idField = getPrimaryKey(table);
         try {
           const { error } = await supabase.from(table).upsert(byTable[table], { onConflict: idField });
           if (error) { console.error(`Batch sync error on ${table}:`, error); continue; }
           broadcastChange(table);
         } catch (err) {
           console.error(`Batch network error on ${table}`, err);
         }
      }
    }
  };
};

const defaultSettings: SystemSettings = {
  SHOP_NAME: 'จีรกิตติ์ ไม้แบบพลาสติก อุตรดิตถ์',
  SHOP_ADDRESS: '98/12 หมู่ 3 ต.ท่าเสา อ.เมือง จ.อุตรดิตถ์ 53000',
  SHOP_TELEPHONE: '093-170-3949',
  TAX_ID: '0535567000123',
  BANK_QR_URL: '',
  VAT_RATE: 7,
  VAT_MODE: 'EXCLUDE',
  PENALTY_RATE: 1.5,
  RECEIPT_PAPER_SIZE: 'A4',
  RECEIPT_FOOTNOTE: 'ได้รับสินค้าถูกต้องและครบถ้วนแล้ว ของเสียหาย/สูญหายปรับตามอัตราที่กําหนด',
  RECEIPT_WARNING: 'คำเตือน: โปรดรักษาความสะอาดแบบเหล็ก/แบบพลาสติก ห้ามเคาะด้วยแกนเหล็กหรือพ่นสีทับ',
  GAS_WEBAPP_URL: '',
  LINE_TOKEN: '',
  ALERTS_OVERDUE_DAYS: 3,
  ALERTS_LOW_STOCK_GLOBAL: 10,
  LINE_ID: 'Tong_01.',
  BANK_NAME: 'ออมสิน (GSB)',
  BANK_ACCOUNT_NO: '020-4754-01020',
  BANK_ACCOUNT_OWNER: 'จักรี เมืองสำนัก',
  SHOP_TELEPHONE_SECONDARY: '093-282-8517',
  THEME_PRESET: 'Cold Purple Pastel',
  THEME_BG_MAIN: 'var(--color-cold-purple-50)',
  THEME_BG_CARD: 'var(--ui-surface)',
  THEME_PRIMARY: 'var(--color-cold-purple-700)',
  THEME_SECONDARY: 'var(--color-cold-purple-100)',
  THEME_TEXT: 'var(--color-cold-purple-950)',
  THEME_BORDER: 'var(--color-cold-purple-300)',
  THEME_SUCCESS: 'var(--color-cold-purple-600)',
  THEME_DANGER: 'var(--color-cold-purple-800)',
  THEME_ON_PRIMARY: 'var(--ui-on-primary)',
  THEME_MUTED: 'var(--color-cold-purple-700)'
};

const productSeedRows: Array<{ category: string; name: string; unit: string; rent: number; mode: 'day' | 'round' }> = [
  // แบบคาน — คิดเป็นรอบ
  { category: 'แบบคาน', name: 'แบบคาน 40x0.50', unit: 'แผ่น', rent: 10.00, mode: 'round' },
  { category: 'แบบคาน', name: 'แบบคาน 40x0.60', unit: 'แผ่น', rent: 12.00, mode: 'round' },
  { category: 'แบบคาน', name: 'แบบคาน 40x0.75', unit: 'แผ่น', rent: 15.00, mode: 'round' },
  { category: 'แบบคาน', name: 'แบบคาน 40x0.80', unit: 'แผ่น', rent: 16.00, mode: 'round' },
  { category: 'แบบคาน', name: 'แบบคาน 40x1.00', unit: 'แผ่น', rent: 20.00, mode: 'round' },
  { category: 'แบบคาน', name: 'แบบคาน 40x1.20', unit: 'แผ่น', rent: 24.00, mode: 'round' },
  { category: 'แบบคาน', name: 'แบบคาน 40x1.25', unit: 'แผ่น', rent: 25.00, mode: 'round' },
  { category: 'แบบคาน', name: 'แบบคาน 40x1.30', unit: 'แผ่น', rent: 26.00, mode: 'round' },
  { category: 'แบบคาน', name: 'แบบคาน 40x1.50', unit: 'แผ่น', rent: 30.00, mode: 'round' },
  { category: 'แบบคาน', name: 'แบบคาน 40x1.60', unit: 'แผ่น', rent: 32.00, mode: 'round' },
  { category: 'แบบคาน', name: 'แบบคาน 40x1.75', unit: 'แผ่น', rent: 35.00, mode: 'round' },
  { category: 'แบบคาน', name: 'แบบคาน 40x1.80', unit: 'แผ่น', rent: 36.00, mode: 'round' },
  { category: 'แบบคาน', name: 'แบบคาน 40x2.00', unit: 'แผ่น', rent: 40.00, mode: 'round' },
  { category: 'แบบคาน', name: 'แบบคาน 40x2.20', unit: 'แผ่น', rent: 44.00, mode: 'round' },
  { category: 'แบบคาน', name: 'แบบคาน 40x2.25', unit: 'แผ่น', rent: 45.00, mode: 'round' },
  { category: 'แบบคาน', name: 'แบบคาน 40x2.30', unit: 'แผ่น', rent: 46.00, mode: 'round' },
  { category: 'แบบคาน', name: 'แบบคาน 40x2.75', unit: 'แผ่น', rent: 55.00, mode: 'round' },
  { category: 'แบบคาน', name: 'แบบคาน 40x2.80', unit: 'แผ่น', rent: 56.00, mode: 'round' },
  { category: 'แบบคาน', name: 'แบบคาน 40x3.00', unit: 'แผ่น', rent: 60.00, mode: 'round' },
  { category: 'แบบคาน', name: 'แบบคาน 40x3.25', unit: 'แผ่น', rent: 65.00, mode: 'round' },
  { category: 'แบบคาน', name: 'แบบคาน 40x3.30', unit: 'แผ่น', rent: 66.00, mode: 'round' },
  { category: 'แบบคาน', name: 'แบบคาน 40x3.75', unit: 'แผ่น', rent: 75.00, mode: 'round' },

  // แบบข้าง — คิดเป็นรอบ
  { category: 'แบบข้าง', name: 'แบบข้าง 25x3.00', unit: 'แผ่น', rent: 60.00, mode: 'round' },
  { category: 'แบบข้าง', name: 'แบบข้าง 25x2.00', unit: 'แผ่น', rent: 40.00, mode: 'round' },
  { category: 'แบบข้าง', name: 'แบบข้าง 25x1.50', unit: 'แผ่น', rent: 30.00, mode: 'round' },
  { category: 'แบบข้าง', name: 'แบบข้าง 25x1.00', unit: 'แผ่น', rent: 20.00, mode: 'round' },

  // แบบเสา — คิดเป็นรอบ
  { category: 'แบบเสา', name: 'แบบเสา 15x15x2.00', unit: 'ชุด', rent: 80.00, mode: 'round' },
  { category: 'แบบเสา', name: 'แบบเสา 15x15x3.00', unit: 'ชุด', rent: 100.00, mode: 'round' },
  { category: 'แบบเสา', name: 'แบบเสา 20x20x1.00', unit: 'ชุด', rent: 60.00, mode: 'round' },
  { category: 'แบบเสา', name: 'แบบเสา 20x20x1.50', unit: 'ชุด', rent: 80.00, mode: 'round' },
  { category: 'แบบเสา', name: 'แบบเสา 20x20x2.00', unit: 'ชุด', rent: 90.00, mode: 'round' },
  { category: 'แบบเสา', name: 'แบบเสา 20x20x3.00', unit: 'ชุด', rent: 100.00, mode: 'round' },
  { category: 'แบบเสา', name: 'แบบเสา 20x20x3.50', unit: 'ชุด', rent: 150.00, mode: 'round' },
  { category: 'แบบเสา', name: 'แบบเสา 25x25x1.00', unit: 'ชุด', rent: 80.00, mode: 'round' },
  { category: 'แบบเสา', name: 'แบบเสา 25x25x1.50', unit: 'ชุด', rent: 90.00, mode: 'round' },
  { category: 'แบบเสา', name: 'แบบเสา 25x25x2.00', unit: 'ชุด', rent: 100.00, mode: 'round' },
  { category: 'แบบเสา', name: 'แบบเสา 25x25x3.00', unit: 'ชุด', rent: 160.00, mode: 'round' },

  // นั่งร้าน/อุปกรณ์ — คิดเป็นวัน
  { category: 'นั่งร้าน/อุปกรณ์', name: 'ขาปรับ 0.50 ซม.', unit: 'ชุด', rent: 20.00, mode: 'day' },
  { category: 'นั่งร้าน/อุปกรณ์', name: 'ล้อนั่งร้าน(เบรค)6 นิ้ว', unit: 'ชุด', rent: 20.00, mode: 'day' },
  { category: 'นั่งร้าน/อุปกรณ์', name: 'ล้อนั่งร้าน(เบรค)8 นิ้ว', unit: 'ชุด', rent: 20.00, mode: 'day' },
  { category: 'นั่งร้าน/อุปกรณ์', name: 'ครอบนั่งร้าน', unit: 'ตัว', rent: 0.00, mode: 'day' }
];

const defaultProducts: Product[] = productSeedRows.map((row, index) => {
  const id = `PRD-${String(1001 + index).padStart(4, '0')}`;
  const now = new Date().toISOString();
  return {
    item_id: id,
    category: row.category,
    item_name: row.name,
    unit: row.unit,
    price_rent: row.rent,
    price_sale: row.rent > 0 ? row.rent * 5 : 0,
    sku: id,
    item_status: 'Active',
    note: '',
    stock: 100,
    use_type: 'rent',
    rental_mode: row.mode,
    qty_total: 100,
    qty_available: 100,
    qty_rented: 0,
    qty_damaged: 0,
    qty_lost: 0,
    low_stock_threshold: 10,
    created_at: now,
    updated_at: now
  };
});

const defaultCustomers: Customer[] = [
  {
    customer_id: 'CUS-1001',
    customer_name: 'ชื่อลูกค้า',
    customer_type: 'ลูกค้าทั่วไป',
    phone: '',
    address: '',
    delivery_location: 'สถานที่จัดส่ง',
    tax_id: '',
    credit_limit: 0,
    total_debt: 0,
    customer_status: 'Active',
    note: 'ลูกค้าหน้าร้านไม่มีบัญชีสมาชิก',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    id_card_no: '',
    registered_address: '',
    current_worksite: '',
    id_card_area: '',
    id_card_province: '',
    id_card_image_name: '',
    id_card_image_url: '',
    id_card_read_status: '',
    pdpa_consent: false,
    customer_signature: ''
  }
];

function getLocal<T>(key: string, fallback: T): T {
  try {
    const str = localStorage.getItem(key);
    if (!str) return fallback;
    return JSON.parse(str) as T;
  } catch (e) {
    return fallback;
  }
}

function saveLocal<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error('saveLocal failed', e);
  }
}


function toNumber(value: any, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function inferRentalMode(category: string, itemName: string): 'day' | 'round' {
  const text = `${category} ${itemName}`;
  if (text.includes('นั่งร้าน') || text.includes('ขาปรับ') || text.includes('ล้อ') || text.includes('ครอบนั่งร้าน')) return 'day';
  if (text.includes('แบบคาน') || text.includes('แบบเสา') || text.includes('แบบข้าง')) return 'round';
  return 'round';
}

function normalizeProduct(raw: any, index = 0): Product {
  const now = new Date().toISOString();
  const itemName = String(raw?.item_name || raw?.name || `สินค้า ${index + 1}`);
  const category = String(raw?.category || 'แบบคาน');
  const rentPrice = toNumber(raw?.price_rent ?? raw?.rental_price ?? raw?.rent_price, 0);
  const salePrice = toNumber(raw?.price_sale ?? raw?.base_price ?? raw?.sale_price, rentPrice > 0 ? rentPrice * 5 : 0);
  const qtyRented = toNumber(raw?.qty_rented, 0);
  const qtyDamaged = toNumber(raw?.qty_damaged, 0);
  const qtyLost = toNumber(raw?.qty_lost, 0);
  const qtyTotal = toNumber(raw?.qty_total ?? raw?.stock_total ?? raw?.stock ?? raw?.qty_available, 100);
  const qtyAvailable = toNumber(raw?.qty_available ?? raw?.stock, Math.max(0, qtyTotal - qtyRented - qtyDamaged - qtyLost));
  const rentalMode = (raw?.rental_mode === 'day' || raw?.rental_mode === 'round')
    ? raw.rental_mode
    : inferRentalMode(category, itemName);
  const useType = (raw?.use_type === 'sale' || raw?.use_type === 'both' || raw?.use_type === 'rent') ? raw.use_type : 'rent';
  const status = (raw?.item_status === 'Inactive' || raw?.item_status === 'Deleted' || raw?.item_status === 'Active') ? raw.item_status : 'Active';

  return {
    item_id: String(raw?.item_id || `PRD-${String(1001 + index).padStart(4, '0')}`),
    sku: String(raw?.sku || raw?.item_code || raw?.item_id || `SKU-${String(index + 1).padStart(4, '0')}`),
    item_name: itemName,
    category,
    use_type: useType,
    unit: String(raw?.unit || raw?.item_unit || 'ชิ้น'),
    price_rent: rentPrice,
    price_sale: salePrice,
    low_stock_threshold: toNumber(raw?.low_stock_threshold ?? raw?.min_stock_alert, 10),
    item_status: status,
    note: String(raw?.note || ''),
    created_at: String(raw?.created_at || now),
    updated_at: String(raw?.updated_at || now),
    rental_mode: rentalMode,
    stock: qtyAvailable,
    qty_total: qtyTotal,
    qty_available: qtyAvailable,
    qty_rented: qtyRented,
    qty_damaged: qtyDamaged,
    qty_lost: qtyLost
  };
}

function normalizeAndMergeProducts(rawProducts: any[]): Product[] {
  const normalized = rawProducts.map((product, index) => normalizeProduct(product, index));
  const seenKeys = new Set(normalized.map(product => `${product.category}::${product.item_name}`));
  const seenIds = new Set(normalized.map(product => product.item_id));

  defaultProducts.forEach((seedProduct, index) => {
    const key = `${seedProduct.category}::${seedProduct.item_name}`;
    if (!seenKeys.has(key) && !seenIds.has(seedProduct.item_id)) {
      normalized.push(normalizeProduct(seedProduct, rawProducts.length + index));
      seenKeys.add(key);
      seenIds.add(seedProduct.item_id);
    }
  });

  return normalized;
}

export class JirakitDB {
  static getSettings(): SystemSettings {
    const s = getLocal<SystemSettings>('JRK_SETTINGS', defaultSettings) as SystemSettings & Record<string, any>;
    let updated = false;

    // ลบ key QR ไลน์เดิมออกจากข้อมูลเก่า และไม่ใช้ URL ภายนอกเป็น QR ธนาคารอีกต่อไป
    const legacyLineQrKey = ['LINE', 'QR', 'URL'].join('_');
    if (legacyLineQrKey in s) { delete s[legacyLineQrKey]; updated = true; }
    if (s.BANK_QR_URL && /^https?:\/\//i.test(s.BANK_QR_URL)) { s.BANK_QR_URL = ''; updated = true; }
    if (s.LINE_ID === undefined) { s.LINE_ID = defaultSettings.LINE_ID; updated = true; }
    if (s.BANK_NAME === undefined) { s.BANK_NAME = defaultSettings.BANK_NAME; updated = true; }
    if (s.BANK_ACCOUNT_NO === undefined) { s.BANK_ACCOUNT_NO = defaultSettings.BANK_ACCOUNT_NO; updated = true; }
    if (s.BANK_ACCOUNT_OWNER === undefined) { s.BANK_ACCOUNT_OWNER = defaultSettings.BANK_ACCOUNT_OWNER; updated = true; }
    if (s.THEME_ON_PRIMARY === undefined) { s.THEME_ON_PRIMARY = defaultSettings.THEME_ON_PRIMARY; updated = true; }
    if (s.THEME_MUTED === undefined) { s.THEME_MUTED = defaultSettings.THEME_MUTED; updated = true; }
    
    if (updated) {
      saveLocal('JRK_SETTINGS', s);
    }
    return s;
  }

  static async saveSettings(settings: Partial<SystemSettings>): Promise<SystemSettings> {
    const current = this.getSettings();
    const next = { ...current, ...settings } as SystemSettings & Record<string, any>;
    delete next[['LINE', 'QR', 'URL'].join('_')];
    if (next.BANK_QR_URL && /^https?:\/\//i.test(next.BANK_QR_URL)) {
      next.BANK_QR_URL = '';
    }
    
    // Always save locally first (offline-first)
    saveLocal('JRK_SETTINGS', next);
    
    // Also sync to Supabase if connected
    if (db) {
      await setDoc(doc(db, "appData", "settings"), next, { merge: true });
    }
    this.addAuditLog('SAVE_SETTINGS', 'SETTINGS', '-', JSON.stringify(current), JSON.stringify(next), 'แก้ไขการตั้งค่าระบบ');
    return next;
  }

  static getProducts(): Product[] {
    const cached = localStorage.getItem('JRK_PRODUCTS');
    if (!cached) {
      saveLocal('JRK_PRODUCTS', defaultProducts);
      return defaultProducts;
    }
    try {
      const prods = JSON.parse(cached);
      if (!Array.isArray(prods) || prods.length === 0) {
        saveLocal('JRK_PRODUCTS', defaultProducts);
        return defaultProducts;
      }
      const normalizedProducts = normalizeAndMergeProducts(prods);
      saveLocal('JRK_PRODUCTS', normalizedProducts);
      return normalizedProducts;
    } catch (e) {
      saveLocal('JRK_PRODUCTS', defaultProducts);
      return defaultProducts;
    }
  }

  static async saveProduct(p: Partial<Product> & { item_id?: string }): Promise<Product> {
    const products = this.getProducts();
    const now = new Date().toISOString();
    
    const category = p.category || 'แบบคาน';
    const name = p.item_name || '';
    const textDesc = `${category} ${name}`.trim();

    // Edit only when the incoming item_id matches an existing product;
    // otherwise treat it as a new product (create).
    const editIndex = p.item_id ? products.findIndex(x => x.item_id === p.item_id) : -1;

    let use_type: 'rent' | 'sale' | 'both' = p.use_type || 'rent';
    let rental_mode: 'day' | 'round' = p.rental_mode || 'round';
    let note = p.note || '';

    if (textDesc.includes('แบบคาน') || textDesc.includes('แบบเสา')) {
      use_type = 'rent';
      rental_mode = 'round';
    } else if (textDesc.includes('นั่งร้าน') || textDesc.includes('ขาปรับ')) {
      use_type = 'rent';
      rental_mode = 'day';
    } else if (textDesc.includes('ค่าขนส่ง')) {
      use_type = 'sale';
      rental_mode = 'round';
    }

    let finalProduct: Product;

    if (editIndex !== -1) {
      // update
      const index = editIndex;
      const original = products[index];
      
      finalProduct = {
        ...original,
        ...p,
        item_id: original.item_id,
        use_type,
        rental_mode,
        note,
        updated_at: now,
        qty_total: p.qty_total !== undefined ? p.qty_total : original.qty_total,
        qty_available: p.qty_available !== undefined ? p.qty_available : (p.qty_total !== undefined ? p.qty_total - original.qty_rented - original.qty_damaged - original.qty_lost : original.qty_available),
        stock: p.qty_available !== undefined ? p.qty_available : (p.qty_total !== undefined ? p.qty_total - original.qty_rented - original.qty_damaged - original.qty_lost : original.qty_available)
      };
      this.addAuditLog('UPDATE_PRODUCT', 'PRODUCT', finalProduct.item_id, JSON.stringify(original), JSON.stringify(finalProduct), `แก้ไขสินค้า ${finalProduct.item_name}`);
    } else {
      // create
      const nextId = `ITM-10${String(products.length + 1).padStart(2, '0')}`;
      const qty_total = p.qty_total ?? 100;
      finalProduct = {
        item_id: nextId,
        sku: p.sku || `SKU-${Date.now().toString().slice(-6)}`,
        item_name: name,
        category,
        use_type,
        unit: p.unit || 'ชิ้น',
        price_rent: p.price_rent ?? 0,
        price_sale: p.price_sale ?? 0,
        low_stock_threshold: p.low_stock_threshold ?? 10,
        item_status: p.item_status || 'Active',
        note,
        created_at: p.created_at || now,
        updated_at: p.updated_at || now,
        rental_mode,
        qty_total,
        qty_available: qty_total,
        qty_rented: 0,
        qty_damaged: 0,
        qty_lost: 0,
        stock: qty_total
      };
      this.addAuditLog('CREATE_PRODUCT', 'PRODUCT', finalProduct.item_id, '', JSON.stringify(finalProduct), `เพิ่มสินค้าใหม่ ${finalProduct.item_name}`);
    }

    // Persist locally first (offline-first), then sync + broadcast to cloud.
    if (editIndex !== -1) {
      products[editIndex] = finalProduct;
    } else {
      products.push(finalProduct);
    }
    saveLocal('JRK_PRODUCTS', products);

    if (db) {
      await setDoc(doc(db, "products", finalProduct.item_id), finalProduct, { merge: true });
    }
    return finalProduct;
  }

  static getUsers(): TerminalUser[] {
    const cached = localStorage.getItem('JRK_USERS');
    if (!cached) {
      // Default admin user
      const defaultUsers: TerminalUser[] = [{
        user_id: 'USR-0001',
        username: 'admin',
        password_hash: btoa('admin123'), // simple hash for demo purposes without external libraries
        display_name: 'Administrator (DEV)',
        role: 'Admin',
        user_status: 'Active',
        created_at: new Date().toISOString()
      }];
      saveLocal('JRK_USERS', defaultUsers);
      return defaultUsers;
    }
    return JSON.parse(cached) as TerminalUser[];
  }

  static getActiveSession(): TerminalUser | null {
    return getLocal<TerminalUser | null>('JRK_ACTIVE_SESSION', null);
  }

  static async register(username: string, pass: string, display_name: string, role: string): Promise<TerminalUser> {
    const users = this.getUsers();
    const cleanUsername = username.trim();
    const cleanDisplayName = display_name.trim() || cleanUsername;
    if (users.find(u => u.username === cleanUsername)) {
      throw new Error('This username already exists in the system');
    }
    const newUser: TerminalUser = {
      user_id: `USR-${Date.now()}`,
      username: cleanUsername,
      password_hash: btoa(pass), // Basic encoding for demo
      display_name: cleanDisplayName,
      role: role as any,
      user_status: 'Pending',
      created_at: new Date().toISOString()
    };
    users.push(newUser);
    saveLocal('JRK_USERS', users);
    
    if (db) {
      await setDoc(doc(db, "users", newUser.user_id), newUser, { merge: true });
    }
    
    this.addAuditLog('REGISTER_PENDING', 'SYSTEM', newUser.user_id, '', '', `สมัครสมาชิกใหม่รออนุมัติ: ${newUser.display_name} (${newUser.role})`);
    return newUser;
  }

  static async login(username: string, pass: string): Promise<TerminalUser> {
    const users = this.getUsers();
    const user = users.find(u => u.username === username);
    if (!user) throw new Error('User data not found in the system');
    if (user.user_status === 'Pending') throw new Error('Account is pending approval from Owner/Admin');
    if (user.user_status !== 'Active') throw new Error('This user has been suspended');
    
    // Simulate simple password hash validation (Production should use bcrypt via backend)
    if (user.password_hash !== btoa(pass)) {
      throw new Error('Incorrect password');
    }
    
    user.last_login = new Date().toISOString();
    const idx = users.findIndex(u => u.user_id === user.user_id);
    users[idx] = user;
    saveLocal('JRK_USERS', users);

    if (db) {
       await setDoc(doc(db, "users", user.user_id), user, { merge: true });
    }
    
    saveLocal('JRK_ACTIVE_SESSION', user);
    this.addAuditLog('LOGIN', 'SYSTEM', user.user_id, '', '', `เข้าสู่ระบบ: ${user.display_name} (${user.role})`);
    return user;
  }

  static logout(): void {
    const active = this.getActiveSession();
    if (active) {
      this.addAuditLog('LOGOUT', 'SYSTEM', active.user_id, '', '', `ออกจากระบบ: ${active.display_name}`);
    }
    localStorage.removeItem('JRK_ACTIVE_SESSION');
    localStorage.removeItem('lastActiveTime');
  }

  static async updateUserStatus(userId: string, status: TerminalUser['user_status']): Promise<void> {
    const users = this.getUsers();
    const idx = users.findIndex(u => u.user_id === userId);
    if (idx < 0) throw new Error('User to update status not found');

    const previous = users[idx].user_status;
    const updatedUser = { ...users[idx], user_status: status };
    users[idx] = updatedUser;
    saveLocal('JRK_USERS', users);

    const active = this.getActiveSession();
    if (active?.user_id === userId) {
      if (status === 'Active') saveLocal('JRK_ACTIVE_SESSION', updatedUser);
      else this.logout();
    }

    if (db) {
      await setDoc(doc(db, "users", userId), updatedUser, { merge: true });
    }

    this.addAuditLog('UPDATE_USER_STATUS', 'USER', userId, previous, status, `ปรับสถานะผู้ใช้ ${updatedUser.display_name} เป็น ${status}`);
  }

  static getCustomers(): Customer[] {
    const cached = localStorage.getItem('JRK_CUSTOMERS');
    if (!cached) {
      saveLocal('JRK_CUSTOMERS', defaultCustomers);
      return defaultCustomers;
    }
    return JSON.parse(cached) as Customer[];
  }

  static async saveCustomer(c: Partial<Customer> & { customer_id?: string }): Promise<Customer> {
    const customers = this.getCustomers();
    const now = new Date().toISOString();
    
    let finalCustomer: Customer;

    if (c.customer_id) {
      const idx = customers.findIndex(x => x.customer_id === c.customer_id);
      if (idx === -1) throw new Error('Customer data not found');
      const original = customers[idx];
      finalCustomer = {
        ...original,
        ...c,
        customer_id: original.customer_id,
        updated_at: now
      };
      customers[idx] = finalCustomer;
      saveLocal('JRK_CUSTOMERS', customers);
      this.addAuditLog('UPDATE_CUSTOMER', 'CUSTOMER', finalCustomer.customer_id, JSON.stringify(original), JSON.stringify(finalCustomer), `อัปเดตข้อมูลลูกค้า ${finalCustomer.customer_name}`);
    } else {
      const isDuplicate = customers.some(existing => existing.customer_name === c.customer_name && existing.phone === c.phone);
      if (isDuplicate) {
        throw new Error('Cannot save data because this customer and phone number already exist (Duplicate customer detected)');
      }
      const nextId = `CUS-10${String(customers.length + 1).padStart(2, '0')}`;
      finalCustomer = {
        customer_id: nextId,
        customer_name: c.customer_name || 'ลูกค้าใหม่',
        customer_type: c.customer_type || 'ลูกค้าทั่วไป',
        phone: c.phone || '',
        address: c.address || '',
        delivery_location: c.delivery_location || '',
        tax_id: c.tax_id || '',
        credit_limit: c.credit_limit || 0,
        total_debt: c.total_debt || 0,
        customer_status: 'Active',
        note: c.note || '',
        created_at: now,
        updated_at: now,
        id_card_no: c.id_card_no || '',
        registered_address: c.registered_address || c.address || '',
        current_worksite: c.current_worksite || c.delivery_location || '',
        id_card_area: c.id_card_area || '',
        id_card_province: c.id_card_province || '',
        id_card_image_name: c.id_card_image_name || '',
        id_card_image_url: c.id_card_image_url || '',
        id_card_read_status: c.id_card_read_status || '',
        pdpa_consent: c.pdpa_consent ?? false,
        customer_signature: c.customer_signature || ''
      };
      customers.push(finalCustomer);
      saveLocal('JRK_CUSTOMERS', customers);
      this.addAuditLog('CREATE_CUSTOMER', 'CUSTOMER', finalCustomer.customer_id, '', JSON.stringify(finalCustomer), `ลงทะเบียนลูกค้าประจำ ${finalCustomer.customer_name}`);
    }

    if (db) {
       await setDoc(doc(db, "customers", finalCustomer.customer_id), finalCustomer, { merge: true });
    }
    return finalCustomer;
  }

  static getReceipts(): Receipt[] {
    return getLocal<Receipt[]>('JRK_RECEIPTS', []);
  }

  static createReceiptNo(docType: string): string {
    const d = new Date();
    const DD = String(d.getDate()).padStart(2, '0');
    const MM = String(d.getMonth() + 1).padStart(2, '0');
    const YY = String(d.getFullYear() + 543).slice(-2);
    const dateStr = `${DD}${MM}${YY}`;
    const currentReceipts = this.getReceipts();
    const prefix = 'JJK Iv-';
    const countToday = currentReceipts.filter(r => r.receipt_no && r.receipt_no.startsWith(`${prefix}${dateStr}`)).length + 1;
    return `${prefix}${dateStr}-${String(countToday).padStart(3, '0')}`;
  }


  static async saveReceipt(p: any): Promise<Receipt> {
    const receipts = this.getReceipts();
    const now = new Date().toISOString();
    const rid = `RCP-BY-${Date.now()}`;
    const no = p.receipt_no || this.createReceiptNo(p.doc_type || 'receipt');

    // Calculate details and adjust stock
    const products = this.getProducts();
    const changedProductIds = new Set<string>();
    const items: BillItemRef[] = (p.items || []).map((l: any, i: number) => {
      // Deduct from stock
      if (l.item_id) {
        const prodIdx = products.findIndex(x => x.item_id === l.item_id);
        if (prodIdx !== -1) {
          const product = products[prodIdx];
          const qty = Number(l.qty || 1);
          if (l.line_mode === 'rent') {
            product.qty_rented += qty;
            product.qty_available = Math.max(0, product.qty_available - qty);
            product.stock = product.qty_available;
          } else {
            product.qty_total = Math.max(0, product.qty_total - qty);
            product.qty_available = Math.max(0, product.qty_available - qty);
            product.stock = product.qty_available;
          }
          product.updated_at = now;
          changedProductIds.add(product.item_id);

          // Notify LINE Low Stock
          const minStock = product.low_stock_threshold || this.getSettings().ALERTS_LOW_STOCK_GLOBAL;
          if (product.qty_available <= minStock) {
            // TODO: ระบบกันซ้ำ (ควรเก็บ last_alert_date ไว้ในตัวสินค้าเพื่อไม่ให้ส่งซ้ำใน 1 วัน) - ปัจจุบันอนุโลมให้เตือนตามรอบตัดบิล
            this.sendLineNotify(`⚠️ สินค้าใกล้หมด\nสินค้า: ${product.item_name}\nคงเหลือ: ${product.qty_available}\nขั้นต่ำแจ้งเตือน: ${minStock}`);
          }
        }
      }

      return {
        line_id: `LINE-${Date.now()}-${i}-${Math.floor(Math.random() * 1000)}`,
        receipt_id: rid,
        receipt_no: no,
        item_id: l.item_id || '',
        sku: l.sku || '',
        receipt_name: l.receipt_name || l.item_name || '',
        line_mode: l.line_mode || 'rent',
        qty: Number(l.qty || 1),
        qty_returned: 0,
        unit: l.unit || 'ชิ้น',
        price: Number(l.price || 0),
        rent_days: Number(l.rent_days || l.rounds || 1),
        due_date: l.due_date || p.due_date || '',
        line_total: Number(l.line_total || 0),
        return_status: l.line_mode === 'rent' ? 'กำลังเช่า' : 'ไม่มีของเช่า',
        note: l.note || '',
        sort_order: i + 1
      };
    });

    saveLocal('JRK_PRODUCTS', products);

    const hasRent = items.some(i => i.line_mode === 'rent');

    const rec: Receipt = {
      receipt_id: rid,
      receipt_no: no,
      receipt_date: p.receipt_date || now,
      receipt_title: p.receipt_title || 'ใบเสร็จรับเงิน',
      doc_type: p.doc_type || 'receipt',
      customer_id: p.customer_id || '',
      customer_name: p.customer_name || 'ลูกค้าทั่วไป',
      phone: p.phone || '',
      address: p.address || '',
      delivery_location: p.delivery_location || '',
      rent_date: p.rent_date || '',
      due_date: p.due_date || '',
      rental_days: Number(p.rental_days || 1),
      subtotal: Number(p.subtotal || 0),
      discount: Number(p.discount || 0),
      delivery_fee: Number(p.delivery_fee || 0),
      vat: Number(p.vat || 0),
      vat_rate: Number(p.vat_rate || 0),
      vat_mode: p.vat_mode || 'NONE',
      deposit: Number(p.deposit || 0),
      grand_total: Number(p.grand_total || 0),
      paid_cash: Number(p.paid_cash || 0),
      paid_transfer: Number(p.paid_transfer || 0),
      paid_amount: Number(p.paid_amount || 0),
      debt_amount: Number(p.debt_amount || 0),
      change_amount: Number(p.change_amount || 0),
      payment_status: p.payment_status || 'ชำระครบ',
      return_status: hasRent ? 'กำลังเช่า' : 'ไม่มีของเช่า',
      penalty_amount: 0,
      return_date: '',
      client_txn_id: p.client_txn_id || `TXN-${Date.now()}`,
      items_json: JSON.stringify(items),
      calculation_json: JSON.stringify({ ...p, items }),
      note: p.note || '',
      created_at: now,
      updated_at: now
    };

    receipts.push(rec);
    saveLocal('JRK_RECEIPTS', receipts);

    let customerChanged = false;
    const customers = this.getCustomers();
    if (rec.customer_id && rec.customer_id !== 'CUS-1001') {
      const cIdx = customers.findIndex(c => c.customer_id === rec.customer_id);
      if (cIdx !== -1) {
        customers[cIdx].total_debt += rec.debt_amount;
        customers[cIdx].updated_at = now;
        saveLocal('JRK_CUSTOMERS', customers);
        customerChanged = true;
      }
    }

    if (db) {
      const batch = writeBatch(db);
      batch.set(doc(db, "receipts", rec.receipt_id), rec, { merge: true });
      changedProductIds.forEach(id => {
         const px = products.find(x => x.item_id === id);
         if (px) batch.set(doc(db, "products", px.item_id), px, { merge: true });
      });
      if (customerChanged && rec.customer_id) {
         const cx = customers.find(x => x.customer_id === rec.customer_id);
         if (cx) batch.set(doc(db, "customers", cx.customer_id), cx, { merge: true });
      }
      await batch.commit();
    }

    this.addAuditLog('CREATE_RECEIPT', 'RECEIPT', rid, '', JSON.stringify(rec), `ออกบิลเอกสาร ${rec.receipt_no}`);
    this.sendLineNotify(`🧾 อัปเดตบิลใหม่!\nเลขที่: ${rec.receipt_no}\nลูกค้า: ${rec.customer_name}\nยอดรวม: ${rec.grand_total.toLocaleString()} ฿`);

    return rec;
  }

  static async updateReceipt(rec: Receipt): Promise<void> {
    const receipts = this.getReceipts();
    const idx = receipts.findIndex(r => r.receipt_id === rec.receipt_id);
    if (idx !== -1) {
      const oldDebt = receipts[idx].debt_amount || 0;
      const newDebt = rec.debt_amount || 0;
      const diff = newDebt - oldDebt;

      receipts[idx] = rec;
      saveLocal('JRK_RECEIPTS', receipts);

      const customers = this.getCustomers();
      let customerChanged = false;
      if (rec.customer_id && rec.customer_id !== 'CUS-1001') {
        const cIdx = customers.findIndex(c => c.customer_id === rec.customer_id);
        if (cIdx !== -1) {
          customers[cIdx].total_debt = Math.max(0, customers[cIdx].total_debt + diff);
          customers[cIdx].updated_at = new Date().toISOString();
          saveLocal('JRK_CUSTOMERS', customers);
          customerChanged = true;
        }
      }

      if (db) {
         const batch = writeBatch(db);
         batch.set(doc(db, "receipts", rec.receipt_id), rec, { merge: true });
         if (customerChanged && rec.customer_id) {
             const cx = customers.find(x => x.customer_id === rec.customer_id);
             if (cx) batch.set(doc(db, "customers", cx.customer_id), cx, { merge: true });
         }
         await batch.commit();
      }

      this.addAuditLog('UPDATE_RECEIPT', 'RECEIPT', rec.receipt_id, '', JSON.stringify(rec), `อัปเดตบิลเอกสาร ${rec.receipt_no}`);
    }
  }

  static async processReturn(p: {
    receipt_id: string;
    items: { line_id: string; qty: number }[];
    penalty_amount: number;
    paid_amount: number;
    refund_deposit: number;
    return_date: string;
    payment_method: string;
    note?: string;
  }): Promise<ReturnEvent> {
    const receipts = this.getReceipts();
    const rIdx = receipts.findIndex(r => r.receipt_id === p.receipt_id);
    if (rIdx === -1) throw new Error('Rental bill not found');
    const bill = receipts[rIdx];

    const products = this.getProducts();
    const billItems: BillItemRef[] = JSON.parse(bill.items_json || '[]');

    const now = new Date().toISOString();
    const return_id = `RET-${Date.now()}`;

    const changedProductIds = new Set<string>();

    // Loop through return items
    const returnedItems = p.items.map(ret => {
      const lineIdx = billItems.findIndex(l => l.line_id === ret.line_id);
      if (lineIdx === -1) throw new Error('Rental item row not found');
      
      const line = billItems[lineIdx];
      const qtyToReturn = Number(ret.qty);
      const remaining = line.qty - line.qty_returned;
      
      if (qtyToReturn <= 0 || qtyToReturn > remaining) {
        throw new Error(`Invalid return quantity for ${line.receipt_name} (Returned: ${qtyToReturn}, Remaining: ${remaining})`);
      }

      // Add back to product inventory
      if (line.item_id) {
        const pIdx = products.findIndex(pr => pr.item_id === line.item_id);
        if (pIdx !== -1) {
          const product = products[pIdx];
          product.qty_rented = Math.max(0, product.qty_rented - qtyToReturn);
          product.qty_available = Math.min(product.qty_total, product.qty_available + qtyToReturn);
          product.stock = product.qty_available;
          product.updated_at = now;
          changedProductIds.add(product.item_id);
        }
      }

      line.qty_returned += qtyToReturn;
      line.return_status = line.qty_returned >= line.qty ? 'คืนครบแล้ว' : 'คืนบางส่วน';
      
      return {
        ...line,
        return_now: qtyToReturn
      };
    });

    saveLocal('JRK_PRODUCTS', products);

    // Calculate overall return status of the bill
    const rentItems = billItems.filter(l => l.line_mode === 'rent');
    const allDone = rentItems.every(l => l.qty_returned >= l.qty);
    const anyDone = rentItems.some(l => l.qty_returned > 0);
    const return_status = allDone ? 'คืนครบแล้ว' : anyDone ? 'คืนบางส่วน' : 'กำลังเช่า';

    // Update financial balance
    const penalty = Number(p.penalty_amount || 0);
    const additionalPaid = Number(p.paid_amount || 0);
    const refund = Number(p.refund_deposit || 0);

    const oldDebt = bill.debt_amount;
    const finalDebtBeforePayment = Math.max(0, oldDebt + penalty - refund);
    const newDebt = Math.max(0, finalDebtBeforePayment - additionalPaid);

    bill.debt_amount = newDebt;
    bill.paid_amount += additionalPaid;
    bill.return_status = return_status;
    bill.payment_status = newDebt <= 0 ? 'ชำระครบ' : bill.paid_amount > 0 ? 'ชำระบางส่วน' : 'ยังไม่ชำระ';
    bill.penalty_amount += penalty;
    bill.return_date = p.return_date || now;
    bill.items_json = JSON.stringify(billItems);
    bill.updated_at = now;

    receipts[rIdx] = bill;
    saveLocal('JRK_RECEIPTS', receipts);

    // Update customer debt matching
    const customers = this.getCustomers();
    let customerChanged = false;
    if (bill.customer_id && bill.customer_id !== 'CUS-1001') {
      const cIdx = customers.findIndex(c => c.customer_id === bill.customer_id);
      if (cIdx !== -1) {
        customers[cIdx].total_debt = Math.max(0, customers[cIdx].total_debt + penalty - additionalPaid);
        customers[cIdx].updated_at = now;
        saveLocal('JRK_CUSTOMERS', customers);
        customerChanged = true;
      }
    }

    const retEvent: ReturnEvent = {
      return_id,
      receipt_id: p.receipt_id,
      receipt_no: bill.receipt_no,
      return_date: p.return_date || now,
      customer_id: bill.customer_id,
      customer_name: bill.customer_name,
      items_json: JSON.stringify(returnedItems),
      penalty_amount: penalty,
      refund_deposit: refund,
      paid_amount: additionalPaid,
      debt_after: newDebt,
      return_status,
      note: p.note || '',
      client_txn_id: `RET-TXN-${Date.now()}`,
      created_at: now
    };

    const returnEvents = this.getReturnEvents();
    returnEvents.push(retEvent);
    saveLocal('JRK_RETURNS', returnEvents);

    if (db) {
       const batch = writeBatch(db);
       batch.set(doc(db, "returns", retEvent.return_id), retEvent, { merge: true });
       batch.set(doc(db, "receipts", bill.receipt_id), bill, { merge: true });
       changedProductIds.forEach(id => {
          const px = products.find(x => x.item_id === id);
          if (px) batch.set(doc(db, "products", px.item_id), px, { merge: true });
       });
       if (customerChanged && bill.customer_id) {
          const cx = customers.find(x => x.customer_id === bill.customer_id);
          if (cx) batch.set(doc(db, "customers", cx.customer_id), cx, { merge: true });
       }
       await batch.commit();
    }

    this.addAuditLog('PROCESS_RETURN', 'RETURNS', return_id, '', JSON.stringify(retEvent), `บันทึกการส่งคืนคลังสำหรับบิล ${bill.receipt_no}`);
    this.sendLineNotify(`📦 รับคืนสินค้าแล้ว!\nบิลเลขที่: ${bill.receipt_no}\nรับโดย: ${bill.customer_name}\nสถานะ: ${return_status}\nปรับ/ชำระหนี้เพิ่ม: ${additionalPaid.toLocaleString()} ฿`);

    return retEvent;
  }

  static getReturnEvents(): ReturnEvent[] {
    return getLocal<ReturnEvent[]>('JRK_RETURNS', []);
  }

  static getExpenses(): Expense[] {
    return getLocal<Expense[]>('JRK_EXPENSES', []).filter(e => e.expense_status !== 'Cancelled');
  }

  static async saveExpense(e: Partial<Expense>): Promise<Expense> {
    const expenses = getLocal<Expense[]>('JRK_EXPENSES', []);
    const now = new Date().toISOString();
    
    const fresh: Expense = {
      expense_id: e.expense_id || `EXP-${Date.now()}`,
      expense_date: e.expense_date || now.slice(0, 10),
      description: e.description || 'ค่าใช้จ่ายทั่วไป',
      category: e.category || 'ค่าใช้จ่ายอื่นๆ',
      amount: Number(e.amount || 0),
      payment_method: e.payment_method || 'เงินสด',
      ref_no: e.ref_no || '',
      expense_status: 'Active',
      note: e.note || '',
      created_at: now,
      updated_at: now
    };

    expenses.push(fresh);
    saveLocal('JRK_EXPENSES', expenses);
    
    if (db) {
       await setDoc(doc(db, "expenses", fresh.expense_id), fresh, { merge: true });
    }
    
    this.addAuditLog('CREATE_EXPENSE', 'EXPENSE', fresh.expense_id, '', JSON.stringify(fresh), `บันทึกรายจ่าย ${fresh.description}`);
    return fresh;
  }

  static async cancelExpense(id: string, reason: string): Promise<void> {
    const expenses = getLocal<Expense[]>('JRK_EXPENSES', []);
    const idx = expenses.findIndex(x => x.expense_id === id);
    if (idx !== -1) {
      expenses[idx].expense_status = 'Cancelled';
      expenses[idx].note = `${expenses[idx].note} (ยกเลิกเนื่องจาก: ${reason})`.trim();
      expenses[idx].updated_at = new Date().toISOString();
      saveLocal('JRK_EXPENSES', expenses);
      
      if (db) {
         await setDoc(doc(db, "expenses", id), expenses[idx], { merge: true });
      }
      
      this.addAuditLog('CANCEL_EXPENSE', 'EXPENSE', id, '', '', `ยกเลิกค่าใช้จ่ายรหัส ${id}`);
    }
  }

  static getAppointments(): Appointment[] {
    return getLocal<Appointment[]>('JRK_APPOINTMENTS', []).filter(a => a.appointment_status !== 'Cancelled');
  }

  static async saveAppointment(a: Partial<Appointment>): Promise<Appointment> {
    const items = getLocal<Appointment[]>('JRK_APPOINTMENTS', []);
    const now = new Date().toISOString();

    const idx = items.findIndex(x => x.appointment_id === a.appointment_id);
    let finalItem: Appointment;
    if (idx !== -1) {
      finalItem = {
        ...items[idx],
        ...a,
        updated_at: now
      };
      items[idx] = finalItem;
      saveLocal('JRK_APPOINTMENTS', items);
    } else {
      finalItem = {
        appointment_id: a.appointment_id || `APT-${Date.now()}`,
        title: a.title || 'นัดหมายด่วน',
        detail: a.detail || '',
        appointment_date: a.appointment_date || now.slice(0, 10),
        customer_id: a.customer_id || '',
        customer_name: a.customer_name || '',
        phone: a.phone || '',
        location: a.location || '',
        products_detail: a.products_detail || '',
        appointment_status: a.appointment_status || 'To Deliver',
        created_at: now,
        updated_at: now
      };
      items.push(finalItem);
      saveLocal('JRK_APPOINTMENTS', items);
    }
    
    if (db) {
       await setDoc(doc(db, "appointments", finalItem.appointment_id), finalItem, { merge: true });
    }
    return finalItem;
  }

  static async deleteAppointment(id: string): Promise<void> {
    let items = getLocal<Appointment[]>('JRK_APPOINTMENTS', []);
    const idx = items.findIndex(x => x.appointment_id === id);
    if (idx !== -1) {
      items[idx].appointment_status = 'Cancelled';
      items[idx].updated_at = new Date().toISOString();
      saveLocal('JRK_APPOINTMENTS', items);
      if (db) {
          await setDoc(doc(db, "appointments", id), items[idx], { merge: true });
      }
    }
  }

  static async updateAppointmentStatus(id: string, status: 'Active' | 'Done' | 'Cancelled' | 'To Deliver' | 'To Collect' | 'Completed'): Promise<void> {
    const items = getLocal<Appointment[]>('JRK_APPOINTMENTS', []);
    const idx = items.findIndex(x => x.appointment_id === id);
    if (idx !== -1) {
      items[idx].appointment_status = status;
      items[idx].updated_at = new Date().toISOString();
      if (status === 'Done' || status === 'Completed') {
        items[idx].done_at = new Date().toISOString();
      }
      saveLocal('JRK_APPOINTMENTS', items);
      if (db) {
          await setDoc(doc(db, "appointments", id), items[idx], { merge: true });
      }
    }
  }

  static getNotes(): NoteItem[] {
    return getLocal<NoteItem[]>('JRK_NOTES', []).filter(n => n.note_status === 'Active');
  }

  static async saveNote(text: string): Promise<NoteItem> {
    const notes = getLocal<NoteItem[]>('JRK_NOTES', []);
    const now = new Date().toISOString();
    const fresh: NoteItem = {
      note_id: `NOTE-${Date.now()}`,
      note_text: text,
      note_status: 'Active',
      created_at: now,
      updated_at: now
    };
    notes.push(fresh);
    saveLocal('JRK_NOTES', notes);
    if (db) {
       await setDoc(doc(db, "notes", fresh.note_id), fresh, { merge: true });
    }
    return fresh;
  }

  static async deleteNote(id: string): Promise<void> {
    const notes = getLocal<NoteItem[]>('JRK_NOTES', []);
    const idx = notes.findIndex(x => x.note_id === id);
    if (idx !== -1) {
      notes[idx].note_status = 'Deleted';
      notes[idx].updated_at = new Date().toISOString();
      saveLocal('JRK_NOTES', notes);
      if (db) {
         await setDoc(doc(db, "notes", id), notes[idx], { merge: true });
      }
    }
  }

  static getAuditLogs(): AuditLog[] {
    return getLocal<AuditLog[]>('JRK_AUDIT_LOGS', []);
  }

  static addAuditLog(action: string, type: string, id: string, oldVal: string, newVal: string, note: string): void {
    const logs = this.getAuditLogs();
    const l: AuditLog = {
      log_id: `LOG-${Date.now()}`,
      timestamp: new Date().toISOString(),
      user: 'ผู้ใช้ระบบดําเนินการ',
      action,
      target_type: type,
      target_id: id,
      old_value: oldVal,
      new_value: newVal,
      note
    };
    logs.push(l);
    // limit audit logs to last 300 to avoid localStorage crash
    const finalLogs = logs.slice(-300);
    saveLocal('JRK_AUDIT_LOGS', finalLogs);
    
    // Background firestore sync for logs so we don't block
    if (db) {
       setDoc(doc(db, "audit_logs", l.log_id), l, { merge: true }).catch(err => console.warn(err));
    }
  }

  static verifyPin(pin: string): boolean {
    const savedPin = localStorage.getItem('JRK_PIN_KEY') || this.getSettings().SHOP_PIN;
    if (savedPin) return pin === savedPin;
    return pin === '123456'; // Development fallback only until real PIN setup is completed.
  }

  static async savePin(pin: string): Promise<void> {
    if (!pin || !/^\d{6}$/.test(pin)) {
      throw new Error('PIN must be exactly 6 digits');
    }
    localStorage.setItem('JRK_PIN_KEY', pin);
    this.addAuditLog('CHANGE_PIN', 'SECURITY', '-', '', '', 'ผู้ใช้เปลี่ยน PIN บันทึกความปลอดภัย');
    
    // Also store pin to cloud settings if possible so other devices sync it
    if (db) {
      const current = this.getSettings();
      await setDoc(doc(db, "appData", "settings"), { ...current, _pin: pin }, { merge: true });
    }
  }

  // ==========================================
  // LINE Messaging API (push notifications)
  // ==========================================
  // Fire-and-forget push via the /api/line proxy. Configured from the web UI
  // (Settings > LINE): Channel Access Token + target LINE User ID.
  static async sendLineNotify(message: string): Promise<void> {
    try {
      const s = this.getSettings() as SystemSettings & Record<string, any>;
      if (s.LINE_NOTIFY_ENABLED === false) return;
      const token = s.LINE_TOKEN || '';
      const userId = s.LINE_USER_ID || '';
      if (!token || !userId) return; // not configured yet -> skip silently
      await fetch('/api/line', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, token, userId }),
      });
    } catch (err) {
      console.warn('LINE notify failed', err);
    }
  }

  static async testLineNotify(customToken?: string, customUserId?: string): Promise<{success: boolean, error?: string}> {
    const s = this.getSettings() as SystemSettings & Record<string, any>;
    const token = (customToken ?? s.LINE_TOKEN) || '';
    const userId = (customUserId ?? s.LINE_USER_ID) || '';
    if (!token || !userId) {
      return { success: false, error: 'กรุณากรอก Channel Access Token และ LINE User ID ก่อนทดสอบ' };
    }
    try {
      const res = await fetch('/api/line', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: '✅ ทดสอบการแจ้งเตือนจากระบบ POS จีรกิตติ์ ไม้แบบ สำเร็จแล้ว!',
          token,
          userId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.success) return { success: true };
      return { success: false, error: data?.error || `HTTP ${res.status}` };
    } catch (e: any) {
      return { success: false, error: e?.message || 'network error' };
    }
  }

  static getBackupData(): object {
    return {
      customers: this.getCustomers(),
      products: this.getProducts(),
      receipts: this.getReceipts(),
      returns: this.getReturnEvents(),
      expenses: this.getExpenses(),
      logs: this.getAuditLogs()
    };
  }

  static restoreBackupData(payload: any): boolean {
    try {
      if (payload.customers) localStorage.setItem('JRK_CUSTOMERS', JSON.stringify(payload.customers));
      if (payload.products) localStorage.setItem('JRK_PRODUCTS', JSON.stringify(payload.products));
      if (payload.receipts) localStorage.setItem('JRK_RECEIPTS', JSON.stringify(payload.receipts));
      if (payload.returns) localStorage.setItem('JRK_RETURNS', JSON.stringify(payload.returns));
      if (payload.expenses) localStorage.setItem('JRK_EXPENSES', JSON.stringify(payload.expenses));
      if (payload.logs) localStorage.setItem('JRK_AUDIT_LOGS', JSON.stringify(payload.logs));
      return true;
    } catch(e) {
      console.error(e);
      return false;
    }
  }

  private static syncTimeout: any = null;

  static triggerAutoSync() {
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
    }
    this.syncTimeout = setTimeout(() => {
      this.syncWithCloud().catch(err => console.warn("Auto sync failed:", err));
    }, 2000);
  }

  static setupCloudListener(onUpdate: () => void) {
    if (!supabase) return () => {};

    // Register the change callback and make sure the broadcast channel is
    // subscribed so we hear writes from other devices.
    syncOnUpdate = onUpdate;
    getBroadcastChannel();

    // Initial hydrate: pull every table once so this device matches the cloud.
    this.loadFromCloud()
      .then(changed => { if (changed) onUpdate(); })
      .catch(err => console.warn('Initial cloud hydrate failed', err));

    return () => {
      syncOnUpdate = null;
      if (broadcastChannel && supabase) {
        supabase.removeChannel(broadcastChannel);
        broadcastChannel = null;
      }
    };
  }

  // Push every local table up to Supabase (full backup) and broadcast changes.
  static async syncWithCloud(_unused?: string): Promise<{success: boolean, error?: string}> {
    if (!supabase) {
      return { success: false, error: 'ยังไม่ได้ตั้งค่า Supabase (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)' };
    }
    try {
      const batch = writeBatch(supabase);
      this.getProducts().forEach(p => batch.set(doc(supabase, 'products', p.item_id), p, { merge: true }));
      this.getCustomers().forEach(c => batch.set(doc(supabase, 'customers', c.customer_id), c, { merge: true }));
      this.getReceipts().forEach(r => batch.set(doc(supabase, 'receipts', r.receipt_id), r, { merge: true }));
      this.getReturnEvents().forEach(r => batch.set(doc(supabase, 'returns', r.return_id), r, { merge: true }));
      getLocal<Expense[]>('JRK_EXPENSES', []).forEach(e => batch.set(doc(supabase, 'expenses', e.expense_id), e, { merge: true }));
      getLocal<Appointment[]>('JRK_APPOINTMENTS', []).forEach(a => batch.set(doc(supabase, 'appointments', a.appointment_id), a, { merge: true }));
      getLocal<NoteItem[]>('JRK_NOTES', []).forEach(n => batch.set(doc(supabase, 'notes', n.note_id), n, { merge: true }));
      this.getUsers().forEach(u => batch.set(doc(supabase, 'users', u.user_id), u, { merge: true }));
      this.getAuditLogs().forEach(l => batch.set(doc(supabase, 'audit_logs', l.log_id), l, { merge: true }));
      batch.set(doc(supabase, 'appData', 'settings'), this.getSettings(), { merge: true });
      await batch.commit();
      localStorage.setItem('JRK_LAST_SYNC_TS', new Date().toISOString());
      return { success: true };
    } catch (e: any) {
      console.warn('Sync to Supabase failed:', e);
      return { success: false, error: e?.message || 'Sync failed' };
    }
  }

  // Pull every table from Supabase into local storage (hydrate this device).
  static async loadFromCloud(): Promise<boolean> {
    if (!supabase) return false;
    try {
      const tables = Object.keys(LOCAL_KEYS);
      const results = await Promise.all(tables.map(t => pullTable(t)));
      const settingsOk = await pullSettings();
      localStorage.setItem('JRK_LAST_SYNC_TS', new Date().toISOString());
      return results.some(Boolean) || settingsOk;
    } catch (e) {
      console.error('Failed to load from Supabase:', e);
      return false;
    }
  }

  static async processOCR(base64Image: string, mimeType: string): Promise<any> {
    try {
      const s = this.getSettings() as SystemSettings & Record<string, any>;
      const res = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base64Image,
          mimeType,
          // Allow the API key and model to be configured from the web UI
          // (Settings). The server falls back to its own env values if empty.
          apiKey: s.GEMINI_API_KEY || '',
          model: s.GEMINI_MODEL || '',
        })
      });
      const parsed = await res.json();
      return parsed;
    } catch (err: any) {
      console.error("Backend OCR error:", err);
      return { success: false, error: err.message || "Failed to contact OCR service" };
    }
  }

  // ==========================================
  // Document CMS (Template Manager) Methods
  // ==========================================

  static getDocumentTemplates(): DocumentTemplate[] {
    const rawData = getLocal<any[]>('JRK_DOCUMENT_TEMPLATES', []);
    if (!Array.isArray(rawData)) return [];
    
    return rawData.map(t => ({
      ...t,
      template_name: t?.template_name || '',
      apply_to: t?.apply_to || '',
      document_version: t?.document_version || '',
      paper_size: t?.paper_size || 'A4',
      content_html: t?.content_html || ''
    })) as DocumentTemplate[];
  }

  static getDocumentTemplateById(id: string): DocumentTemplate | undefined {
    const templates = this.getDocumentTemplates();
    return templates.find(t => t.id === id);
  }

  static saveDocumentTemplate(data: Partial<DocumentTemplate>): DocumentTemplate {
    const templates = this.getDocumentTemplates();
    const now = new Date().toISOString();
    
    const newTemplate: DocumentTemplate = {
      id: `TPL-${Date.now()}`,
      template_name: data.template_name || 'แม่แบบใหม่',
      apply_to: data.apply_to || 'ใบเสร็จรับเงิน',
      document_version: data.document_version || 'ต้นฉบับ',
      paper_size: data.paper_size || 'A4',
      content_html: data.content_html || '',
      styles_json: data.styles_json || '{}',
      variables_json: data.variables_json || '[]',
      signature_fields_json: data.signature_fields_json || '[]',
      is_default: data.is_default || false,
      status: data.status || 'Active',
      created_at: now,
      updated_at: now,
      ...data
    };

    if (newTemplate.is_default) {
      templates.forEach(t => {
        if (t.apply_to === newTemplate.apply_to && t.document_version === newTemplate.document_version) {
          t.is_default = false;
        }
      });
    }

    templates.push(newTemplate);
    saveLocal('JRK_DOCUMENT_TEMPLATES', templates);
    return newTemplate;
  }

  static updateDocumentTemplate(id: string, data: Partial<DocumentTemplate>): DocumentTemplate {
    const templates = this.getDocumentTemplates();
    const idx = templates.findIndex(t => t.id === id);
    if (idx === -1) throw new Error('Template to edit not found');

    const updatedTemplate = {
      ...templates[idx],
      ...data,
      id: templates[idx].id, // Prevent ID change
      updated_at: new Date().toISOString()
    };

    if (updatedTemplate.is_default) {
      templates.forEach(t => {
        if (t.id !== id && t.apply_to === updatedTemplate.apply_to && t.document_version === updatedTemplate.document_version) {
          t.is_default = false;
        }
      });
    }

    templates[idx] = updatedTemplate;
    saveLocal('JRK_DOCUMENT_TEMPLATES', templates);
    return updatedTemplate;
  }

  static deleteDocumentTemplate(id: string): void {
    const templates = this.getDocumentTemplates();
    const newTemplates = templates.filter(t => t.id !== id);
    saveLocal('JRK_DOCUMENT_TEMPLATES', newTemplates);
  }

  // ==========================================
  // Contract Documents Methods
  // ==========================================

  static getContractDocuments(): ContractDocument[] {
    return getLocal<ContractDocument[]>('JRK_CONTRACT_DOCUMENTS', []);
  }

  static getContractDocument(id: string): ContractDocument | undefined {
    return this.getContractDocuments().find(c => c.id === id);
  }

  static createContractDocument(doc: Partial<ContractDocument>): ContractDocument {
    const docs = this.getContractDocuments();
    const now = new Date().toISOString();
    
    // Generate new contract no if not provided
    let contractNo = doc.contract_no;
    if (!contractNo) {
      const year = new Date().getFullYear();
      const month = String(new Date().getMonth() + 1).padStart(2, '0');
      const seq = String(docs.length + 1).padStart(4, '0');
      contractNo = `CTR-${year}${month}-${seq}`;
    }

    const newDoc: ContractDocument = {
      id: `CTR-${Date.now()}`,
      contract_no: contractNo,
      contract_name: doc.contract_name || 'สัญญาเช่ามาตรฐาน',
      customer_id: doc.customer_id || '',
      customer_snapshot_json: doc.customer_snapshot_json || '{}',
      receipt_id: doc.receipt_id || '',
      receipt_snapshot_json: doc.receipt_snapshot_json || '{}',
      selected_items_snapshot_json: doc.selected_items_snapshot_json || '[]',
      id_card_snapshot_json: doc.id_card_snapshot_json || '{}',
      signature_snapshot_json: doc.signature_snapshot_json || '{}',
      acknowledgement_snapshot_json: doc.acknowledgement_snapshot_json || '{}',
      contract_pages_json: doc.contract_pages_json || '[]',
      status: doc.status || 'created',
      created_at: now,
      updated_at: now
    };

    docs.push(newDoc);
    saveLocal('JRK_CONTRACT_DOCUMENTS', docs);

    // Notify LINE
    try {
      const parsedCustomer = JSON.parse(newDoc.customer_snapshot_json || '{}');
      const customerName = parsedCustomer.customer_name || 'ไม่ระบุ';
      const customerPhone = parsedCustomer.phone || '-';
      
      this.sendLineNotify(`📄 สร้างสัญญาเช่าใหม่\nเลขที่สัญญา: ${newDoc.contract_no}\nลูกค้า: ${customerName}\nเบอร์โทร: ${customerPhone}\nวันที่สร้าง: ${now.split('T')[0]}\nสถานะ: สร้างแล้ว`);
    } catch (e) {
      console.warn('Failed to parse customer for Line notify', e);
    }

    return newDoc;
  }

  static updateContractDocument(id: string, updates: Partial<ContractDocument>): ContractDocument {
    const docs = this.getContractDocuments();
    const idx = docs.findIndex(d => d.id === id);
    if (idx === -1) throw new Error('Contract document not found');

    const updated = {
      ...docs[idx],
      ...updates,
      id, // protect id
      updated_at: new Date().toISOString()
    };
    docs[idx] = updated;
    saveLocal('JRK_CONTRACT_DOCUMENTS', docs);
    return updated;
  }

  static deleteContractDocument(id: string): void {
    const docs = this.getContractDocuments();
    const newDocs = docs.filter(d => d.id !== id);
    saveLocal('JRK_CONTRACT_DOCUMENTS', newDocs);
    const remainingPages = this.getContractPages().filter(p => p.contract_id !== id);
    saveLocal('JRK_CONTRACT_PAGES', remainingPages);
  }

  // ==========================================
  // Contract Pages Methods
  // ==========================================

  static getContractPages(): ContractPage[] {
    return getLocal<ContractPage[]>('JRK_CONTRACT_PAGES', []);
  }

  static getContractPagesByContractId(contractId: string): ContractPage[] {
    return this.getContractPages().filter(p => p.contract_id === contractId).sort((a, b) => a.page_order - b.page_order);
  }

  static saveContractPages(pages: Partial<ContractPage>[]): ContractPage[] {
    const allPages = this.getContractPages();
    const now = new Date().toISOString();
    
    const newPages: ContractPage[] = pages.map((p, idx) => ({
      id: `PG-${Date.now()}-${idx}`,
      contract_id: p.contract_id || '',
      page_type: p.page_type || 'ทั่วไป',
      page_title: p.page_title || `หน้า ${idx + 1}`,
      page_order: p.page_order ?? idx,
      content_html: p.content_html || '',
      styles_json: p.styles_json || '{}',
      source_snapshot_json: p.source_snapshot_json || '{}',
      created_at: now,
      updated_at: now
    }));

    const merged = [...allPages, ...newPages];
    saveLocal('JRK_CONTRACT_PAGES', merged);
    return newPages;
  }

  static replaceContractPages(contractId: string, pages: Partial<ContractPage>[]): ContractPage[] {
    const remainingPages = this.getContractPages().filter(p => p.contract_id !== contractId);
    const now = new Date().toISOString();

    const newPages: ContractPage[] = pages.map((p, idx) => ({
      id: `PG-${Date.now()}-${idx}`,
      contract_id: contractId,
      page_type: p.page_type || 'ทั่วไป',
      page_title: p.page_title || `หน้า ${idx + 1}`,
      page_order: p.page_order ?? idx,
      content_html: p.content_html || '',
      styles_json: p.styles_json || '{}',
      source_snapshot_json: p.source_snapshot_json || '{}',
      created_at: now,
      updated_at: now
    }));

    saveLocal('JRK_CONTRACT_PAGES', [...remainingPages, ...newPages]);
    return newPages;
  }
}
