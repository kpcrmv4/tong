/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Form } from './ui/Form';
import { JirakitDB } from '../db';
import { SystemSettings, Receipt } from '../types';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { Textarea } from './ui/Textarea';
import { 
  Save, DollarSign, 
  Wrench, 
  BookOpen, 
  AlertCircle, 
  ExternalLink,
  ChevronRight,
  User,
  HardDrive,
  FileUp,
  Palette
} from 'lucide-react';

interface SettingsProps {
  refreshCount: number;
  triggerRefresh: () => void;
}

export default function Settings({ refreshCount, triggerRefresh }: SettingsProps) {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form Fields
  const [shopName, setShopName] = useState('');
  const [shopAddr, setShopAddr] = useState('');
  const [shopPhone, setShopPhone] = useState('');
  const [taxId, setTaxId] = useState('');
  const [vatRate, setVatRate] = useState(7);
  const [penaltyRate, setPenaltyRate] = useState(1.5);
  const [bankQr, setBankQr] = useState('');
  const [warningText, setWarningText] = useState('');
  const [footnote, setFootnote] = useState('');
  const [gasAppUrl, setGasAppUrl] = useState('');
  const [lineToken, setLineToken] = useState('');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [geminiModel, setGeminiModel] = useState('');
  const [alertsOverdueDays, setAlertsOverdueDays] = useState(3);
  const [alertsLowStockGlobal, setAlertsLowStockGlobal] = useState(10);
  const [lineId, setLineId] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankAccountNo, setBankAccountNo] = useState('');
  const [bankAccountOwner, setBankAccountOwner] = useState('');
  const [shopPhoneSecondary, setShopPhoneSecondary] = useState('');
  const [vatMode, setVatMode] = useState<'NONE' | 'INCLUDE' | 'EXCLUDE'>('EXCLUDE');
  const [receiptPaperSize, setReceiptPaperSize] = useState<'A4' | 'A5'>('A4');
  const [shopPin, setShopPin] = useState('');
  const [themePreset, setThemePreset] = useState('Cold Purple Pastel');
  const [pinModal, setPinModal] = useState<{ isOpen: boolean; action: (() => void) | null; input: string }>({ isOpen: false, action: null, input: '' });
  const [syncing, setSyncing] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const settingsMenus = [
    { id: 'shop', title: 'ข้อมูลร้าน', icon: '🏪', description: 'ชื่อร้าน ที่อยู่ เบอร์โทร Line ID เลขภาษี' },
    { id: 'receipt', title: 'ใบเสร็จ / การพิมพ์', icon: '🧾', description: 'A4/A5 ข้อความท้ายบิล QR Code สีใบเสร็จ' },
    { id: 'finance', title: 'ภาษี / การเงิน', icon: '💰', description: 'VAT ส่วนลด มัดจำ ค่าส่ง การปัดเศษ' },
    { id: 'rental', title: 'ค่าเช่า / คืนสินค้า', icon: '🔁', description: 'รอบเช่า ค่าปรับ เงื่อนไขคืน ของเสีย ของหาย' },
    { id: 'stock', title: 'สินค้า / สต็อก', icon: '📦', description: 'หมวดสินค้า หน่วยนับ สต็อกขั้นต่ำ แจ้งเตือน' },
    { id: 'customer', title: 'ลูกค้า / PDPA', icon: '👤', description: 'ข้อมูลลูกค้า ลายเซ็น บัตรประชาชน การยินยอม' },
    { id: 'documentTemplate', title: 'เอกสาร / เทมเพลต', icon: '📄', description: 'ตั้งค่าเทมเพลต หัวเอกสาร ท้ายเอกสาร' },
    { id: 'contractTemplate', title: 'สัญญาเช่า', icon: '📝', description: 'เลขที่สัญญา เงื่อนไขเริ่มต้น ข้อความมาตรฐาน' },
    { id: 'ai', title: 'AI / OCR (Gemini)', icon: '🤖', description: 'ตั้งค่า Gemini API Key และชื่อโมเดลสำหรับอ่านบัตร (OCR)' },
    { id: 'backup', title: 'สำรองข้อมูล', icon: '💾', description: 'Backup Restore Export Import' },
    { id: 'system', title: 'ระบบ / ความปลอดภัย', icon: '⚙️', description: 'ธีม สิทธิ์ผู้ใช้ รหัสผ่าน Offline Mode' },
  ];

  const THEME_PRESETS: Record<string, any> = {
    'Cold Purple Pastel': {
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
    },
    'Cold Purple Soft Panel': {
      THEME_BG_MAIN: 'var(--color-cold-purple-100)',
      THEME_BG_CARD: 'var(--ui-surface)',
      THEME_PRIMARY: 'var(--color-cold-purple-600)',
      THEME_SECONDARY: 'var(--color-cold-purple-200)',
      THEME_TEXT: 'var(--color-cold-purple-950)',
      THEME_BORDER: 'var(--color-cold-purple-300)',
      THEME_SUCCESS: 'var(--color-cold-purple-600)',
      THEME_DANGER: 'var(--color-cold-purple-800)',
      THEME_ON_PRIMARY: 'var(--ui-on-primary)',
      THEME_MUTED: 'var(--color-cold-purple-700)'
    },
    'Cold Purple Deep Focus': {
      THEME_BG_MAIN: 'var(--color-cold-purple-50)',
      THEME_BG_CARD: 'var(--ui-surface)',
      THEME_PRIMARY: 'var(--color-cold-purple-800)',
      THEME_SECONDARY: 'var(--color-cold-purple-200)',
      THEME_TEXT: 'var(--color-cold-purple-950)',
      THEME_BORDER: 'var(--color-cold-purple-400)',
      THEME_SUCCESS: 'var(--color-cold-purple-600)',
      THEME_DANGER: 'var(--color-cold-purple-900)',
      THEME_ON_PRIMARY: 'var(--ui-on-primary)',
      THEME_MUTED: 'var(--color-cold-purple-700)'
    }
  };

  useEffect(() => {
    const s = JirakitDB.getSettings();
    setSettings(s);
    setShopName(s.SHOP_NAME);
    setShopAddr(s.SHOP_ADDRESS);
    setShopPhone(s.SHOP_TELEPHONE);
    setTaxId(s.TAX_ID);
    setVatRate(s.VAT_RATE);
    setPenaltyRate(s.PENALTY_RATE);
    setBankQr(s.BANK_QR_URL);
    setWarningText(s.RECEIPT_WARNING);
    setFootnote(s.RECEIPT_FOOTNOTE);
    setGasAppUrl(s.GAS_WEBAPP_URL || '');
    setLineToken(s.LINE_TOKEN || '');
    setGeminiApiKey(s.GEMINI_API_KEY || '');
    setGeminiModel(s.GEMINI_MODEL || '');
    setAlertsOverdueDays(s.ALERTS_OVERDUE_DAYS ?? 3);
    setAlertsLowStockGlobal(s.ALERTS_LOW_STOCK_GLOBAL ?? 10);
    setLineId(s.LINE_ID || '');
    setBankName(s.BANK_NAME || '');
    setBankAccountNo(s.BANK_ACCOUNT_NO || '');
    setBankAccountOwner(s.BANK_ACCOUNT_OWNER || '');
    setShopPhoneSecondary(s.SHOP_TELEPHONE_SECONDARY || '');
    setVatMode(s.VAT_MODE || 'EXCLUDE');
    setReceiptPaperSize(s.RECEIPT_PAPER_SIZE || 'A4');
    setShopPin(s.SHOP_PIN || '');
    setThemePreset(s.THEME_PRESET || 'Cold Purple Pastel');
  }, [refreshCount]);

  const requirePin = (action: () => void) => {
    const currentPin = JirakitDB.getSettings().SHOP_PIN;
    if (!currentPin || currentPin.trim() === '') {
      action();
    } else {
      setPinModal({ isOpen: true, action, input: '' });
    }
  };

  const triggerManualSync = async () => {
    setSyncing(true);
    try {
      const result = await JirakitDB.syncWithCloud(gasAppUrl);
      if (result.success) {
        alert('🎉 ยืนยันการซิงค์ข้อมูล! บันทึกข้อมูลขึ้น Cloud สำเร็จแล้ว');
      } else {
        alert('โ Connection failed: ' + (result.error || 'Check your network'));
      }
    } catch (err: any) {
      alert(`โ Error: ${err.message || err}`);
    } finally {
      setSyncing(false);
    }
  };

  const triggerRestoreFromCloud = async () => {
    requirePin(() => {
      setTimeout(async () => {
        if (!confirm('การดึงข้อมูลจาก Cloud จะเป็นการเขียนทับข้อมูลในเครื่องนี้ ยืนยันการดาวน์โหลด?')) return;
        setSyncing(true);
        try {
          const success = await JirakitDB.loadFromCloud();
          if (success) {
            alert('🎉 ดาวน์โหลดข้อมูลสำเร็จ กรุณารีเฟรชหน้าเว็บ หรือกด F5');
            window.location.reload();
          } else {
            alert('โ ๏ธ ไม่พบข้อมูลบน Supabase หรือยังไม่เคยซิงค์ขึ้นคลาวด์ (กรุณากด "ซิงค์ข้อมูลขึ้น Supabase" ก่อน)');
          }
        } catch (err: any) {
          alert(`โ Error: ${err.message || err}`);
        } finally {
          setSyncing(false);
        }
      }, 50);
    });
  };

  const handleExportBackup = () => {
    try {
      const data = JirakitDB.getBackupData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `jirakit-pos-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      alert('💾 ดาวน์โหลดไฟล์สำรองข้อมูล (JSON) สำเร็จแล้ว!');
    } catch(e: any) {
      alert('โ Error creating backup file: ' + e.message);
    }
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    requirePin(() => {
      setTimeout(() => {
        if (!confirm('การนำเข้าไฟล์ข้อมูลจะ "เขียนทับ" ข้อมูลเดิมทั้งหมด ยืนยันการดำเนินการ?')) {
           if (fileInputRef.current) fileInputRef.current.value = '';
           return;
        }

        const reader = new FileReader();
        reader.onload = async (event) => {
          try {
            const text = event.target?.result as string;
            const payload = JSON.parse(text);
            const success = JirakitDB.restoreBackupData(payload);
            if (success) {
               alert('📂 นำเข้าข้อมูลสำเร็จ! ระบบจะทำการรีเฟรช');
               window.location.reload();
            } else {
               alert('โ Cannot import data. The file might not be supported.');
            }
          } catch (err) {
            alert('โ Invalid file: ' + err);
          }
          if (fileInputRef.current) fileInputRef.current.value = '';
        };
        reader.readAsText(file);
      }, 50);
    });
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;

    JirakitDB.saveSettings({
      SHOP_NAME: shopName,
      SHOP_ADDRESS: shopAddr,
      SHOP_TELEPHONE: shopPhone,
      TAX_ID: taxId,
      VAT_RATE: Number(vatRate),
      PENALTY_RATE: Number(penaltyRate),
      BANK_QR_URL: bankQr,
      RECEIPT_WARNING: warningText,
      RECEIPT_FOOTNOTE: footnote,
      VAT_MODE: vatMode,
      RECEIPT_PAPER_SIZE: receiptPaperSize,
      GAS_WEBAPP_URL: gasAppUrl,
      LINE_TOKEN: lineToken,
      GEMINI_API_KEY: geminiApiKey.trim(),
      GEMINI_MODEL: geminiModel.trim(),
      LINE_NOTIFY_ENABLED: false,
      ALERTS_OVERDUE_DAYS: Number(alertsOverdueDays),
      ALERTS_LOW_STOCK_GLOBAL: Number(alertsLowStockGlobal),
      LINE_ID: lineId,
      BANK_NAME: bankName,
      BANK_ACCOUNT_NO: bankAccountNo,
      BANK_ACCOUNT_OWNER: bankAccountOwner,
      SHOP_TELEPHONE_SECONDARY: shopPhoneSecondary,
      SHOP_PIN: shopPin,
      THEME_PRESET: themePreset,
      ...THEME_PRESETS[themePreset]
    });
    alert('บันทึกค่าระบบ ERP จีรกิตติ์ ไม้แบบสำเร็จเรียบร้อย!');
    triggerRefresh();
  };

  return (
    <div className="space-y-6 h-[calc(100vh-6rem)] flex flex-col max-w-full mx-auto w-full">
      <div className="flex-1 flex flex-col overflow-hidden min-w-0 p-4 sm:p-6">
        
        {/* Header Title */}
        <div className="shrink-0 mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-lg sm:text-xl font-black text-[var(--ui-on-primary)] uppercase tracking-tight flex items-center gap-2">
              <Wrench className="stroke-[var(--ui-primary)]" size={22} />
              ตั้งค่าระบบ POS & ERP จีรกิตติ์ ไม้แบบ
            </h2>
            <p className="text-[10px] sm:text-xs text-[var(--text-soft)] mt-1 uppercase tracking-wider">
              {activeCategory ? 'รายละเอียดการตั้งค่า' : 'เลือกหมวดหมู่ที่ต้องการตั้งค่า'}
            </p>
          </div>
          {activeCategory && (
            <Button 
              type="button"
              onClick={() => setActiveCategory(null)}
              className="flex items-center gap-2 px-4 py-2 border border-[var(--ui-border)] bg-[var(--ui-surface)] hover:bg-[var(--border)] rounded-xl text-[var(--text-main)] font-bold transition-all min-h-[44px] w-full sm:w-auto justify-center"
            >
              ⬅ ย้อนกลับ
            </Button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-6">
          {!activeCategory ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-4">
              {settingsMenus.map(menu => (
                <Button
                  key={menu.id}
                  type="button"
                  onClick={() => setActiveCategory(menu.id)}
                  className="flex flex-col items-start p-4 sm:p-5 border border-[var(--ui-border)] bg-[var(--ui-surface)] hover:bg-[var(--border)] hover:border-[var(--ui-primary)] rounded-xl transition-all min-h-[44px] cursor-pointer group text-left h-full"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-2xl sm:text-3xl group-hover:scale-110 transition-transform">{menu.icon}</span>
                    <span className="text-sm font-black text-[var(--text-main)] group-hover:text-[var(--ui-primary)] transition-colors">{menu.title}</span>
                  </div>
                  <span className="text-[10px] sm:text-xs text-[var(--text-soft)] leading-relaxed">{menu.description}</span>
                </Button>
              ))}
            </div>
          ) : (
            <Form id="settings-form" onSubmit={handleSaveSettings} className="space-y-6 text-xs font-bold text-[var(--text-soft)]">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-6">

            {activeCategory === 'shop' && (
              <>
                {/* Store Information */}
            <div className="lg:col-span-2 p-5 border border-[var(--ui-border)] rounded-xl ai-panel space-y-4">
              <h3 className="text-sm font-black text-[var(--text-main)] flex items-center gap-1.5 pb-2.5 border-b border-[var(--ui-border)]">
                <Wrench className="stroke-[var(--ui-primary)]" size={15} /> ข้อมูลร้านค้าหลักและทะเบียนสากล
              </h3>

              <div className="space-y-3">
                <div>
                  <label className="block text-[var(--text-soft)] mb-1.5 uppercase tracking-wide">ชื่อร้านปล่อยเช่าหลัก *</label>
                  <Input
                    type="text"
                    required
                    className="w-full ai-panel border border-[var(--ui-border)] rounded-lg px-3.5 min-h-[44px] text-[var(--text-main)]"
                    value={shopName}
                    onChange={e => setShopName(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-[var(--text-soft)] mb-1.5 uppercase tracking-wide">ที่อยู่วางจัดตั้งร้านดั้งเดิม *</label>
                  <Textarea
                    required
                    className="w-full ai-panel border border-[var(--ui-border)] rounded-lg p-3 h-20 text-[var(--text-main)] resize-none"
                    value={shopAddr}
                    onChange={e => setShopAddr(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[var(--text-soft)] mb-1.5 uppercase tracking-wide">เบอร์ติดต่อกรณีด่วน</label>
                    <Input
                      type="text"
                      className="w-full ai-panel border border-[var(--ui-border)] rounded-lg px-3.5 min-h-[44px] text-[var(--text-main)]"
                      value={shopPhone}
                      onChange={e => setShopPhone(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[var(--text-soft)] mb-1.5 uppercase tracking-wide">เลขจดทะเบียนพาณิชย์/ภาษี</label>
                    <Input
                      type="text"
                      className="w-full ai-panel border border-[var(--ui-border)] rounded-lg px-3.5 min-h-[44px] text-[var(--text-main)]"
                      value={taxId}
                      onChange={e => setTaxId(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
              </>
            )}

            {activeCategory === 'finance' && (
              <>
                {/* Financial Multipliers */}
            <div className="p-5 border border-[var(--ui-border)] rounded-xl ai-panel space-y-4">
              <h3 className="text-sm font-black text-[var(--text-main)] flex items-center gap-1.5 pb-2.5 border-b border-[var(--ui-border)]">
                <AlertCircle className="stroke-[var(--ui-primary)]" size={15} /> พารามิเตอร์คํานวณดอกเบี้ยหนี้สิน
              </h3>

              <div className="space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[var(--text-soft)] mb-1.5 uppercase tracking-wide">อัตราภาษีมูลค่าเพิ่ม (%) *</label>
                    <Input
                      type="number"
                      required
                      className="w-full ai-panel border border-[var(--ui-border)] rounded-lg px-3.5 min-h-[44px] text-right font-black text-[var(--text-main)]"
                      value={vatRate}
                      onChange={e => setVatRate(Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="block text-[var(--text-soft)] mb-1.5 uppercase tracking-wide">ค่าปรับเลยกำหนดต่อวัน (%) *</label>
                    <Input
                      type="number"
                      step="0.1"
                      required
                      className="w-full ai-panel border border-[var(--ui-border)] rounded-lg px-3.5 min-h-[44px] text-right font-black text-[var(--ui-warning)]"
                      value={penaltyRate}
                      onChange={e => setPenaltyRate(Number(e.target.value))}
                    />
                  </div>
                </div>
                <div className="text-[10px] text-[var(--text-soft)] italic font-medium -mt-1.5">
                  * โดยทั่วไปคิดเทียบเป็น 1.5% ของมูลค่าสินค้าที่เช่าต่อชิ้น เพื่อความสมเหตุสมผลเชิงพาณิชย์
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
                  <div>
                    <label className="block text-[var(--text-soft)] mb-1.5 uppercase tracking-wide text-[10px]">วันแจ้งเตือนสัญญา (เกินกำหนดวัน)</label>
                    <Input
                      type="number"
                      required
                      className="w-full ai-panel border border-[var(--ui-border)] rounded-lg px-3.5 min-h-[44px] text-right font-black text-[var(--ui-primary)]"
                      value={alertsOverdueDays}
                      onChange={e => setAlertsOverdueDays(Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="block text-[var(--text-soft)] mb-1.5 uppercase tracking-wide text-[10px]">เกณฑ์แจ้งเตือนสต็อกต่ำลด (ชิ้น)</label>
                    <Input
                      type="number"
                      required
                      className="w-full ai-panel border border-[var(--ui-border)] rounded-lg px-3.5 min-h-[44px] text-right font-black text-[var(--ui-warning)]"
                      value={alertsLowStockGlobal}
                      onChange={e => setAlertsLowStockGlobal(Number(e.target.value))}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[var(--text-soft)] mb-1.5 uppercase tracking-wide flex justify-between items-center">
                    <span>รูปภาพ QR ธนาคารสำหรับใบเสร็จ</span>
                    <label className="cursor-pointer text-[var(--text-main)] hover:text-[var(--text-main)] transition-colors ai-panel px-2 py-0.5 rounded-lg text-[10px] font-bold flex items-center gap-1">
                      <Input type="file" accept="image/*" className="hidden" onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          if (file.size > 2 * 1024 * 1024) {
                            alert('Image size must not exceed 2MB to prevent system slowdown.');
                            return;
                          }
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            if (event.target?.result) {
                              setBankQr(event.target.result as string);
                            }
                          };
                          reader.readAsDataURL(file);
                        }
                      }} />
                      <i className="fa-solid fa-upload"></i> อัปโหลดรูปภาพ
                    </label>
                  </label>
                  <div className="flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-xl border border-[var(--ui-border)] bg-[var(--app-bg)] p-3 text-center">
                    {bankQr ? (
                      <>
                        <img src={bankQr} alt="QR ธนาคาร" className="h-24 w-24 object-contain rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)] p-1" />
                        <Button type="button" variant="danger" size="sm" onClick={() => setBankQr('')}>ลบรูป QR ธนาคาร</Button>
                      </>
                    ) : (
                      <p className="text-xs font-black text-[var(--text-soft)]">ยังไม่ได้แนบรูป QR ธนาคาร — ให้กด “อัปโหลดรูปภาพ” เท่านั้น ไม่ใช้ลิงก์ภายนอก</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
                {/* Bank & Document Identity Fields */}
            <div className="lg:col-span-2 p-5 border border-[var(--ui-border)] rounded-xl ai-panel space-y-4">
              <h3 className="text-sm font-black text-[var(--text-main)] flex items-center gap-1.5 pb-2.5 border-b border-[var(--ui-border)]">
                <DollarSign className="stroke-[var(--ui-primary)]" size={15} /> ข้อมูลการเงิน บัญชีธนาคาร และ LINE ID สำหรับใบเสร็จ (Receipt Identity)
              </h3>

              <div className="space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[var(--text-soft)] mb-1.5 uppercase tracking-wide">LINE ID ร้าน</label>
                    <Input
                      type="text"
                      className="w-full ai-panel border border-[var(--ui-border)] rounded-lg px-3.5 min-h-[44px] text-[var(--text-main)]"
                      value={lineId}
                      onChange={e => setLineId(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[var(--text-soft)] mb-1.5 uppercase tracking-wide">เบอร์ติดต่อกรณีด่วน (เบอร์สำรอง) *</label>
                    <Input
                      type="text"
                      className="w-full ai-panel border border-[var(--ui-border)] rounded-lg px-3.5 min-h-[44px] text-[var(--text-main)]"
                      value={shopPhoneSecondary}
                      onChange={e => setShopPhoneSecondary(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[var(--text-soft)] mb-1.5 uppercase tracking-wide">ชื่อธนาคารและประเภท</label>
                  <Input
                    type="text"
                    className="w-full ai-panel border border-[var(--ui-border)] rounded-lg px-3.5 min-h-[44px] text-[var(--text-main)]"
                    placeholder="เช่น GSB (ธนาคารออมสิน)"
                    value={bankName}
                    onChange={e => setBankName(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[var(--ui-primary)] mb-1.5 uppercase tracking-wide">เลขที่บัญชีธนาคาร</label>
                    <Input
                      type="text"
                      className="w-full ai-panel border border-[var(--ui-border)] rounded-lg px-3.5 min-h-[44px] text-[var(--text-main)] font-mono"
                      placeholder="xxx-xxxx-xxxxx"
                      value={bankAccountNo}
                      onChange={e => setBankAccountNo(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[var(--ui-primary)] mb-1.5 uppercase tracking-wide">ชื่อเจ้าของบัญชีธนาคาร</label>
                    <Input
                      type="text"
                      className="w-full ai-panel border border-[var(--ui-border)] rounded-lg px-3.5 min-h-[44px] text-[var(--text-main)]"
                      value={bankAccountOwner}
                      onChange={e => setBankAccountOwner(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
              </>
            )}

            {activeCategory === 'receipt' && (
              <>
                {/* Receipt Settings */}
            <div className="lg:col-span-2 p-5 border border-[var(--ui-border)] rounded-xl ai-panel space-y-4">
              <h3 className="text-sm font-black text-[var(--text-main)] flex items-center gap-1.5 pb-2.5 border-b border-[var(--ui-border)]">
                <BookOpen className="stroke-[var(--ui-primary)]" size={15} /> ตั้งค่าใบเสร็จรับเงินและการพิมพ์
              </h3>

              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[var(--text-soft)] mb-1.5 uppercase tracking-wide">รูปแบบการคำนวณภาษีมูลค่าเพิ่ม (VAT Mode)</label>
                    <Select
                      className="w-full ai-panel border border-[var(--ui-border)] rounded-lg px-3.5 min-h-[44px] text-[var(--text-main)]"
                      value={vatMode}
                      onChange={e => setVatMode(e.target.value as any)}
                    >
                      <option value="NONE">ไม่มี VAT</option>
                      <option value="EXCLUDE">ราคายังไม่รวม VAT (Exclude)</option>
                      <option value="INCLUDE">ราคารวม VAT แล้ว (Include)</option>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-[var(--text-soft)] mb-1.5 uppercase tracking-wide">ขนาดกระดาษใบเสร็จเริ่มต้น</label>
                    <Select
                      className="w-full ai-panel border border-[var(--ui-border)] rounded-lg px-3.5 min-h-[44px] text-[var(--text-main)]"
                      value={receiptPaperSize}
                      onChange={e => setReceiptPaperSize(e.target.value as any)}
                    >
                      <option value="A4">A4 (กระดาษปกติ)</option>
                      <option value="A5">A5 (ครึ่งหน้ากระดาษ)</option>
                    </Select>
                  </div>
                </div>

                <div>
                  <label className="block text-[var(--text-soft)] mb-1.5 uppercase tracking-wide">ข้อความหมายเหตุท้ายใบเสร็จ (Footnote)</label>
                  <Textarea
                    className="w-full ai-panel border border-[var(--ui-border)] rounded-lg p-3 h-20 text-[var(--text-main)] resize-none"
                    value={footnote}
                    onChange={e => setFootnote(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-[var(--text-soft)] mb-1.5 uppercase tracking-wide">ข้อความคำเตือนท้ายใบเสร็จ (Warning)</label>
                  <Textarea
                    className="w-full ai-panel border border-[var(--ui-border)] rounded-lg p-3 h-20 text-[var(--ui-danger)] resize-none"
                    value={warningText}
                    onChange={e => setWarningText(e.target.value)}
                  />
                </div>
              </div>
            </div>
              </>
            )}

            {activeCategory === 'ai' && (
              <>
                {/* AI / OCR (Gemini) */}
            <div className="lg:col-span-2 p-5 border border-[var(--ui-border)] rounded-xl ai-panel space-y-4">
              <h3 className="text-sm font-black text-[var(--text-main)] flex items-center gap-1.5 pb-2.5 border-b border-[var(--ui-border)]">
                <span className="text-base">🤖</span> ตั้งค่า AI / อ่านบัตร (Google Gemini)
              </h3>

              <div className="space-y-3.5">
                <div>
                  <label className="block text-[var(--text-soft)] mb-1.5 uppercase tracking-wide">Gemini API Key</label>
                  <Input
                    type="password"
                    autoComplete="off"
                    className="w-full ai-panel border border-[var(--ui-border)] rounded-lg px-3.5 min-h-[44px] text-[var(--ui-primary)] font-mono text-xs"
                    placeholder="AIza... (สร้างได้ที่ Google AI Studio)"
                    value={geminiApiKey}
                    onChange={e => setGeminiApiKey(e.target.value)}
                  />
                  <p className="mt-1.5 text-[10px] text-[var(--text-soft)]">ใช้สำหรับสแกนบัตรประชาชน/เอกสาร (OCR) หากเว้นว่าง ระบบจะใช้ค่า GEMINI_API_KEY ฝั่งเซิร์ฟเวอร์แทน</p>
                </div>

                <div>
                  <label className="block text-[var(--text-soft)] mb-1.5 uppercase tracking-wide">ชื่อโมเดล (Model)</label>
                  <Input
                    type="text"
                    className="w-full ai-panel border border-[var(--ui-border)] rounded-lg px-3.5 min-h-[44px] text-[var(--text-main)] font-mono text-xs"
                    placeholder="gemini-3.5-flash"
                    value={geminiModel}
                    onChange={e => setGeminiModel(e.target.value)}
                  />
                  <p className="mt-1.5 text-[10px] text-[var(--text-soft)]">เว้นว่างเพื่อใช้ค่าเริ่มต้น (gemini-3.5-flash) แนะนำ: gemini-3.5-flash หรือ gemini-flash-latest</p>
                </div>
              </div>
            </div>
              </>
            )}

            {activeCategory === 'backup' && (
              <>
                {/* Cloud Sync & Notifications */}
            <div className="lg:col-span-2 p-5 border border-[var(--ui-border)] rounded-xl ai-panel space-y-4">
              <h3 className="text-sm font-black text-[var(--text-main)] flex items-center gap-1.5 pb-2.5 border-b border-[var(--ui-border)]">
                <ExternalLink className="stroke-[var(--ui-primary)]" size={15} /> ระบบเชื่อมโยงฐานข้อมูลคลาวด์ (Supabase) และแจ้งเตือน (LINE)
              </h3>

              <div className="space-y-3.5">
                <div className="p-3 border border-[var(--ui-border)] rounded-xl ai-panel">
                  <p className="text-[11px] text-[var(--text-main)] font-bold mb-1">ฐานข้อมูลคลาวด์: Supabase</p>
                  <p className="text-[10px] text-[var(--text-soft)] leading-relaxed">
                    ระบบซิงค์ข้อมูลขึ้น Supabase อัตโนมัติทุกครั้งที่บันทึก และอัปเดตข้ามเครื่องแบบเรียลไทม์ (Broadcast)
                    ตั้งค่าการเชื่อมต่อผ่าน VITE_SUPABASE_URL และ VITE_SUPABASE_ANON_KEY (ไฟล์ .env)
                  </p>
                </div>

                <div>
                  <label className="block text-[var(--text-soft)] mb-1.5 uppercase tracking-wide">LINE Messaging API (Step 3 - ยังไม่เปิดใช้งาน)</label>
                  <Input
                    type="password"
                    className="w-full ai-panel border border-[var(--ui-border)] rounded-lg px-3.5 min-h-[44px] text-[var(--text-soft)] font-mono text-xs opacity-70"
                    placeholder="จะตั้งค่าผ่าน LINE Official Account / Messaging API ใน Step 3"
                    value={lineToken}
                    onChange={e => setLineToken(e.target.value)}
                    disabled
                  />
                  <p className="mt-1.5 text-[10px] text-[var(--ui-warning)] font-bold">ยังไม่เปิดใช้งาน: LINE Notify เดิมถูกปิดใน Step 1 เพื่อไม่ให้เข้าใจว่าส่งแจ้งเตือนได้จริง</p>
                </div>

                <div className="flex items-center gap-3 mt-4 p-3 border border-[var(--ui-border)] rounded-xl ai-panel opacity-70">
                  <div 
                    className="w-10 h-5 rounded-full flex items-center p-0.5 cursor-not-allowed transition-colors bg-[var(--ui-border)]"
                  >
                    <div className="bg-[var(--ui-surface)] w-4 h-4 rounded-full shadow-sm transform transition-transform translate-x-0"></div>
                  </div>
                  <div>
                    <label className="text-sm font-bold text-[var(--text-main)] select-none">
                      แจ้งเตือน LINE ยังไม่เปิดใช้งาน
                    </label>
                    <p className="text-[10px] text-[var(--text-soft)]">Step 3 จะทำผ่าน LINE Official Account / Messaging API เท่านั้น</p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 mt-4">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="flex-1 opacity-60 cursor-not-allowed"
                    disabled
                  >
                    ยังไม่เปิดใช้งาน - แจ้งหนี้ทาง LINE
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="flex-1 opacity-60 cursor-not-allowed"
                    disabled
                  >
                    ยังไม่เปิดใช้งาน - แจ้งคืนบิลทาง LINE
                  </Button>
                </div>
              </div>
            </div>
              </>
            )}

            {activeCategory === 'system' && (
              <>
                {/* Theme Selection */}
            <div className="lg:col-span-2 p-5 border border-[var(--ui-border)] rounded-xl ai-panel space-y-4">
              <h3 className="text-sm font-black text-[var(--text-main)] flex items-center gap-1.5 pb-2.5 border-b border-[var(--ui-border)]">
                <Palette className="stroke-[var(--ui-primary)]" size={15} /> ตั้งค่าธีมสี (Theme Presets)
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Object.keys(THEME_PRESETS).map(presetName => (
                  <Button
                    key={presetName}
                    type="button"
                    onClick={() => setThemePreset(presetName)}
                    className={`flex flex-col p-4 rounded-xl border-2 transition-all cursor-pointer ${themePreset === presetName ? 'border-[var(--ui-primary)] bg-[var(--ui-primary)]/10 shadow-md' : 'border-[var(--ui-border)] hover:bg-[var(--border)]/10'}`}
                  >
                    <span className="font-bold text-[var(--text-main)] text-left mb-2">{presetName}</span>
                    <div className="flex gap-2">
                      <div className="w-6 h-6 rounded-full border shadow-xs" style={{ backgroundColor: THEME_PRESETS[presetName].THEME_BG_MAIN }}></div>
                      <div className="w-6 h-6 rounded-full border shadow-xs" style={{ backgroundColor: THEME_PRESETS[presetName].THEME_PRIMARY }}></div>
                      <div className="w-6 h-6 rounded-full border shadow-xs" style={{ backgroundColor: THEME_PRESETS[presetName].THEME_SECONDARY }}></div>
                    </div>
                  </Button>
                ))}
              </div>
            </div>
                {/* Security Settings */}
            <div className="lg:col-span-2 p-5 border border-[var(--ui-border)] rounded-xl ai-panel space-y-4">
              <h3 className="text-sm font-black text-[var(--ui-danger)] flex items-center gap-1.5 pb-2.5 border-b border-[var(--ui-border)]">
                <AlertCircle className="stroke-[var(--ui-danger)]" size={15} /> ความปลอดภัยและพนักงาน
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-[var(--text-soft)] mb-1.5 uppercase tracking-wide flex items-center gap-2">
                    รหัส PIN ร้าน (6 หลัก)
                    {(!shopPin || shopPin.trim() === '') && (
                      <span className="text-[var(--ui-danger)] text-[10px] bg-[var(--ui-surface)] px-2 py-0.5 rounded-full border border-[var(--ui-danger)]/30">⚠️ ยังไม่ได้ตั้งรหัส PIN</span>
                    )}
                  </label>
                  <Input
                    type="password"
                    maxLength={6}
                    placeholder="ใส่ตัวเลข 6 หลักเพื่อปกป้องระบบ..."
                    className="w-full max-w-sm ai-panel border border-[var(--ui-border)] rounded-lg px-3.5 min-h-[44px] text-[var(--text-main)] font-mono tracking-widest"
                    value={shopPin}
                    onChange={e => setShopPin(e.target.value.replace(/\D/g, ''))}
                  />
                  <p className="mt-1.5 text-[10px] text-[var(--text-soft)]">รหัสนี้จะถูกใช้ยืนยันตัวตนก่อนการกู้คืนข้อมูล (Restore) หากปล่อยว่างไว้ระบบจะไม่ถามรหัส PIN</p>
                </div>
              </div>
            </div>
              </>
            )}

            {activeCategory === 'rental' && (
              <div className="lg:col-span-2 p-10 border border-[var(--ui-border)] rounded-xl ai-panel text-center flex flex-col items-center justify-center min-h-[300px]">
                <div className="text-4xl mb-4">🔁</div>
                <h3 className="text-xl font-black text-[var(--text-main)] mb-2">ค่าเช่า / คืนสินค้า</h3>
                <p className="text-[var(--text-soft)]">เตรียมรองรับการตั้งค่ารอบเช่า ค่าปรับ เงื่อนไขคืน ของเสีย ของหาย ในอนาคต</p>
              </div>
            )}

            {activeCategory === 'stock' && (
              <div className="lg:col-span-2 p-10 border border-[var(--ui-border)] rounded-xl ai-panel text-center flex flex-col items-center justify-center min-h-[300px]">
                <div className="text-4xl mb-4">📦</div>
                <h3 className="text-xl font-black text-[var(--text-main)] mb-2">สินค้า / สต็อก</h3>
                <p className="text-[var(--text-soft)]">เตรียมรองรับการตั้งค่าหมวดสินค้า หน่วยนับ และตัวแจ้งเตือนคลังสินค้า ในอนาคต</p>
              </div>
            )}

            {activeCategory === 'customer' && (
              <div className="lg:col-span-2 p-10 border border-[var(--ui-border)] rounded-xl ai-panel text-center flex flex-col items-center justify-center min-h-[300px]">
                <div className="text-4xl mb-4">👤</div>
                <h3 className="text-xl font-black text-[var(--text-main)] mb-2">ลูกค้า / PDPA</h3>
                <p className="text-[var(--text-soft)]">เตรียมรองรับการจัดการฟอร์มขอยินยอมเก็บข้อมูลส่วนบุคคล และการแนบเอกสารยืนยันตัวตน ในอนาคต</p>
              </div>
            )}

            {activeCategory === 'documentTemplate' && (
              <div className="lg:col-span-2 p-10 border border-[var(--ui-border)] rounded-xl ai-panel text-center flex flex-col items-center justify-center min-h-[300px]">
                <div className="text-4xl mb-4">📄</div>
                <h3 className="text-xl font-black text-[var(--text-main)] mb-2">เอกสาร / เทมเพลต</h3>
                <p className="text-[var(--text-soft)]">เตรียมรองรับการตั้งค่าค่าเริ่มต้นของหัว-ท้ายเอกสารและรูปแบบฟอร์ม CMS ในอนาคต</p>
              </div>
            )}

            {activeCategory === 'contractTemplate' && (
              <div className="lg:col-span-2 p-10 border border-[var(--ui-border)] rounded-xl ai-panel text-center flex flex-col items-center justify-center min-h-[300px]">
                <div className="text-4xl mb-4">📝</div>
                <h3 className="text-xl font-black text-[var(--text-main)] mb-2">สัญญาเช่า</h3>
                <p className="text-[var(--text-soft)]">เตรียมรองรับระบบตั้งค่าเงื่อนไขเริ่มต้นและข้อความมาตรฐานของสัญญาจดเช่า ในอนาคต</p>
              </div>
            )}

              </div>

              <div className="flex justify-start ai-panel p-4 rounded-xl border border-[var(--ui-border)]">
            <Button
              type="submit"
              className="py-3 px-8 primary-gradient-bg hover:bg-[var(--ui-warning)] text-[var(--text-main)] font-black rounded-lg text-xs tracking-wider uppercase shadow-md flex items-center gap-2 cursor-pointer transition-all hover:scale-[1.01]"
            >
              <Save size={16} /> บันทึกการตั้งค่าหมวดนี้
            </Button>
          </div>
        </Form>
          )}
        </div>
      </div>

      {pinModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--text-main)]/60 backdrop-blur-sm">
          <div className="bg-[var(--text-main)] border border-[var(--ui-border)] rounded-2xl p-6 shadow-2xl w-[95vw] sm:w-[90vw] md:max-w-sm max-h-[90dvh] overflow-y-auto">
            <h3 className="text-[var(--text-main)] text-lg font-bold mb-4 text-center">🔒 ยืนยันรหัส PIN ร้าน</h3>
            <Input
              type="password"
              autoFocus
              maxLength={6}
              className="w-full bg-[var(--ui-surface)] border border-[var(--ui-border)] rounded-xl h-14 text-center text-2xl tracking-[0.5em] text-[var(--text-main)] min-h-[44px]"
              value={pinModal.input}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '');
                setPinModal(prev => ({ ...prev, input: val }));
                if (val.length === 6) {
                  const currentPin = JirakitDB.getSettings().SHOP_PIN;
                  if (val === currentPin) {
                    setPinModal({ isOpen: false, action: null, input: '' });
                    if (pinModal.action) pinModal.action();
                  } else {
                    alert('โ Invalid PIN!');
                    setPinModal(prev => ({ ...prev, input: '' }));
                  }
                }
              }}
            />
            <p className="text-[var(--text-soft)] text-xs text-center mt-3">กรุณาระบุตัวเลข 6 หลักเพื่อดำเนินการต่อ</p>
            <Button
              className="mt-4 w-full py-2 bg-transparent text-[var(--ui-danger)] font-bold rounded-lg border border-[var(--ui-danger)] hover:bg-[var(--ui-danger)] hover:text-[var(--text-main)] transition-colors min-h-[44px]"
              onClick={() => {
                setPinModal({ isOpen: false, action: null, input: '' });
              }}
            >
              ยกเลิก
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

