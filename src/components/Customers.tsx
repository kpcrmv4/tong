/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Form } from './ui/Form';
import { JirakitDB } from '../db';
import { Customer } from '../types';
import { Search, UserPlus, Phone, ShieldCheck, MapPin, Eye, FileText, CheckCircle, TrendingUp, AlertTriangle, CreditCard, X } from 'lucide-react';
import SignaturePad from './SignaturePad';

interface CustomersProps {
  refreshCount: number;
  triggerRefresh: () => void;
}

import { SIMULATED_CARDS } from '../mocks/simulatedCards';
import { formatThaiPhone, formatThaiIDCard } from '../utils/formatters';
import { THAI_ADDRESS_DATA, ThaiAddressPreset } from '../utils/thaiAddressData';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { DataTable } from './ui/DataTable';

export default function Customers({ refreshCount, triggerRefresh }: CustomersProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [presetIndexCounter, setPresetIndexCounter] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [selectedProfileCustomer, setSelectedProfileCustomer] = useState<Customer | null>(null);
  const [previewIdCardUrl, setPreviewIdCardUrl] = useState<string>('');
  const [previewIdCardName, setPreviewIdCardName] = useState<string>('');

  // Form Fields
  const [cName, setCName] = useState('');
  const [cPhone, setCPhone] = useState('');
  const [cAddress, setCAddress] = useState('');
  const [cWorksite, setCWorksite] = useState('');
  const [cIdNo, setCIdNo] = useState('');
  const [cProvince, setCProvince] = useState('อุตรดิตถ์');
  const [cArea, setCArea] = useState('');
  const [cPdpa, setCPdpa] = useState(false);
  const [cSignature, setCSignature] = useState('');

  // Detailed address fields splits for Thai addressing autocompletion
  const [cAddressNo, setCAddressNo] = useState('');
  const [cMoo, setCMoo] = useState('');
  const [cSubdistrict, setCSubdistrict] = useState('');
  const [cAmphoe, setCAmphoe] = useState('');
  const [cPostalCode, setCPostalCode] = useState('');
  
  // Suggestion list displays
  const [subdistrictSearch, setSubdistrictSearch] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Simulated Hardware connection flows (Smart Card Connection / OCR scan)
  const [readerType, setReaderType] = useState<'smart_card' | 'ocr' | null>(null);
  const [readerConnecting, setReaderConnecting] = useState(false);
  const [readerProgress, setReaderProgress] = useState(0);
  const [readerStatusText, setReaderStatusText] = useState('');

  // ID card image mock state
  const [idCardFile, setIdCardFile] = useState<string>('');
  const [loadingImg, setLoadingImg] = useState(false);

  useEffect(() => {
    setCustomers(JirakitDB.getCustomers().filter(c => c.customer_status === 'Active'));
  }, [refreshCount]);

  // Handle automatic composition of combined raw text cAddress whenever children change
  useEffect(() => {
    if (editingCustomer) {
      const parts = [];
      if (cAddressNo) parts.push(`บ้านเลขที่ ${cAddressNo}`);
      if (cMoo) parts.push(`หมู่ที่ ${cMoo}`);
      if (cSubdistrict) parts.push(`ต.${cSubdistrict}`);
      if (cAmphoe) parts.push(`อ.${cAmphoe}`);
      if (cProvince) parts.push(`จ.${cProvince}`);
      if (cPostalCode) parts.push(cPostalCode);
      
      const combined = parts.join(' ');
      setCAddress(combined);
      setCArea(cAmphoe ? `อ.${cAmphoe}` : '');
    }
  }, [cAddressNo, cMoo, cSubdistrict, cAmphoe, cProvince, cPostalCode, editingCustomer]);

  const filtered = customers.filter(c => {
    const q = searchQuery.toLowerCase();
    return c.customer_name.toLowerCase().includes(q) ||
           c.phone.includes(q) ||
           (c.id_card_no && c.id_card_no.includes(q));
  });

  // Smart Parser for existing database records to split inputs correctly
  const parseThaiAddress = (str: string) => {
    const res = {
      addressNo: '',
      moo: '',
      subdistrict: '',
      amphoe: '',
      province: 'อุตรดิตถ์',
      postalCode: ''
    };
    if (!str) return res;

    // Extract raw zipcode (5 digits at the end preferably)
    const zipMatch = str.match(/(\d{5})$/);
    if (zipMatch) {
      res.postalCode = zipMatch[1];
      str = str.substring(0, zipMatch.index).trim();
    }

    // Extract Province prefix
    const provMatch = str.match(/(?:จ\.|จังหวัด)\s*([^\s]+)/);
    if (provMatch) {
      res.province = provMatch[1].replace(/,+/g, '').trim();
      str = str.replace(provMatch[0], '').trim();
    }

    // Extract District prefix
    const ampMatch = str.match(/(?:อ\.|อำเภอ|เขต)\s*([^\s]+)/);
    if (ampMatch) {
      res.amphoe = ampMatch[1].replace(/,+/g, '').trim();
      str = str.replace(ampMatch[0], '').trim();
    }

    // Extract Sub-district prefix
    const subMatch = str.match(/(?:ต\.|ตำบล|แขวง)\s*([^\s]+)/);
    if (subMatch) {
      res.subdistrict = subMatch[1].replace(/,+/g, '').trim();
      str = str.replace(subMatch[0], '').trim();
    }

    // Extract Moo prefix
    const mooMatch = str.match(/(?:ม\.|หมู่ที่|หมู่)\s*(\d+)/);
    if (mooMatch) {
      res.moo = mooMatch[1].trim();
      str = str.replace(mooMatch[0], '').trim();
    }

    // Rest is house addressNo details
    res.addressNo = str.replace(/^(?:บ้านเลขที่)\s*/, '').replace(/^[,\s\t]+|[,\s\t]+$/g, '').trim();
    return res;
  };

  const handleOpenForm = (c?: Customer) => {
    if (typeof window !== 'undefined' && (window as any).openSharedCustomerModal) {
      (window as any).openSharedCustomerModal(c || null);
    }
  };

  // Run mock scanner / Smart Card physical insertion sequence
  const startCardReaderSimulation = (type: 'smart_card' | 'ocr', presetIndex: number) => {
    setReaderType(type);
    setReaderConnecting(true);
    setReaderProgress(0);
    
    const messages = type === 'smart_card' 
      ? [
          '🔋 กำลังเชื่อมต่อเครื่องอ่านชิป Smart card (ผ่านช่องสัญญาณ RF/NFC USB)...',
          '⚡ จ่ายกำลังไฟเข้าสมาร์ทการ์ดทองเหลืองสำเร็จ...',
          '📡 ดึงพิกัด ข้อมูลลายเซ็น และถอดรหัสรหัสผ่านกรมการปกครอง...',
          '✓ ซิงค์ฐานข้อมูลและเก็บภาพถ่ายความละเอียดสูงสำเร็จเรียบร้อย!'
        ]
      : [
          '📷 กำลังปรับความคมชัดกล้องถ่ายภาพความละเอียดสูง...',
          '🔍 ตรวจพบมุมขอบบัตรประชาชน และทำการประมวลผล OCR ท้องถิ่น...',
          '🤖 เทคโนโลยีวิเคราะห์รูปทรงใบหน้า และดึงลายลักษณ์อักษรสำเร็จ...',
          '✓ อ่านข้อความและวิเคราะห์รอยลายเซ็นลุล่วงแล้ว!'
        ];
    
    setReaderStatusText(messages[0]);

    let step = 0;
    const interval = setInterval(() => {
      step += 1;
      setReaderProgress(step * 25);
      if (step < 4) {
        setReaderStatusText(messages[step]);
      } else {
        clearInterval(interval);
        setTimeout(() => {
          // Fill form elements
          const preset = SIMULATED_CARDS[presetIndex];
          setCName(preset.name);
          setCPhone(formatThaiPhone(preset.phone));
          setCIdNo(formatThaiIDCard(preset.idNo));
          setCAddressNo(preset.addressNo);
          setCMoo(preset.moo);
          setCSubdistrict(preset.subdistrict);
          setCAmphoe(preset.amphoe);
          setCProvince(preset.province);
          setCPostalCode(preset.postalCode);
          setSubdistrictSearch(preset.subdistrict);
          setCWorksite(preset.worksite);
          setCPdpa(true);
          setCSignature(preset.signatureUrl);
          
          // Generate a data URL of the SVG visual ID card to display
          const svgBase64 = `data:image/svg+xml;utf8,${encodeURIComponent(preset.idCardSvg)}`;
          setIdCardFile(svgBase64);

          setReaderConnecting(false);
          setReaderType(null);
        }, 400);
      }
    }, 450);
  };

  const handleIdCardUploadFake = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoadingImg(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64Img = reader.result as string;
      setIdCardFile(base64Img);
      setLoadingImg(false);

      setReaderConnecting(true);
      setReaderStatusText('กำลังเชื่อมต่อ Enterprise OCR Platform...');
      setReaderProgress(30);

      try {
        const res = await JirakitDB.processOCR(base64Img, file.type || 'image/jpeg');
        setReaderProgress(80);
        if (res.success && res.data && res.data.success) {
           const d = res.data.data;
           setCName(d.company_name || d.full_name_th || d.full_name_en || '');
           setCIdNo(d.id_number || d.driver_license_number || d.tax_id || '');
           setCPhone(d.phone || '');
           
           setCAddress(d.address || ''); 
           setCAddressNo(d.address || '');
           
           setReaderStatusText(`✅ ดึงข้อมูลสำเร็จ (${d.document_type || 'ไม่ทราบประเภทเอกสาร'})`);
           setReaderProgress(100);
           
           if (res.data.duplicate) {
             alert('โ ๏ธ The OCR system detected this card as an "Existing Customer".\nData has been populated for you to update without saving automatically. (Edit the data before clicking "Save", or close if no update is needed)');
             // Try linking directly to the duplicate
             const allCus = JirakitDB.getCustomers();
             const targetId = (d.id_number || d.tax_id || '').replace(/\D/g, '');
             const targetPhone = (d.phone || '').replace(/\D/g, '');
             const existingMatch = allCus.find(c => {
               const cid = c.id_card_no ? c.id_card_no.replace(/\D/g, '') : '';
               const cphone = c.phone ? c.phone.replace(/\D/g, '') : '';
               const ctax = c.tax_id ? c.tax_id.replace(/\D/g, '') : '';
               return (targetId.length > 5 && (cid === targetId || ctax === targetId)) || 
                      (targetPhone.length > 7 && cphone === targetPhone);
             });
             if (existingMatch && !editingCustomer?.customer_id) {
                 setEditingCustomer(existingMatch); // Switch form to EDIT mode!
             }
           }

           // hide after success
           setTimeout(() => setReaderConnecting(false), 2000);
        } else {
           alert('OCR failed: ' + (res.data?.error || res.error || 'No data found'));
           setReaderConnecting(false);
        }
      } catch (err: any) {
        alert('Error OCR: ' + err.message);
        setReaderConnecting(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (idCardFile && !cPdpa) {
      alert('For ID card scanning, the customer must consent to the PDPA terms.');
      return;
    }

    // 1. Duplicate Check before creating new customer
    let targetCustomerId = editingCustomer?.customer_id;
    if (!targetCustomerId) {
       const allCustomers = JirakitDB.getCustomers();
       const idClean = cIdNo.replace(/\D/g, '');
       const phoneClean = cPhone.replace(/\D/g, '');
       const foundDuplicate = allCustomers.find(c => {
         const cid = c.id_card_no ? c.id_card_no.replace(/\D/g, '') : '';
         const cphone = c.phone ? c.phone.replace(/\D/g, '') : '';
         const ctax = c.tax_id ? c.tax_id.replace(/\D/g, '') : '';
         return (idClean && idClean.length > 5 && (cid === idClean || ctax === idClean)) || 
                (phoneClean && phoneClean.length > 7 && cphone === phoneClean);
       });
       
       if (foundDuplicate) {
          alert(`โ ๏ธ Found existing customer "${foundDuplicate.customer_name}" in the database.\nThe system has displayed this data for you to update instead of creating a duplicate user.`);
          handleOpenForm(foundDuplicate); // populate form with the duplicate
          JirakitDB.sendLineNotify(`⚠️ พบการสร้างข้อมูลซ้ำในระบบ ERP (Duplicate Customer)\nชื่อที่พยายามพิมพ์: ${cName}\nพบระเบียนเดิม: ${foundDuplicate.customer_name}`);
          return; // Stop saving, let user review the loaded form
       }
    }

    const payload: Partial<Customer> = {
      customer_name: cName,
      phone: cPhone,
      address: cAddress,
      registered_address: cAddress,
      delivery_location: cWorksite,
      current_worksite: cWorksite,
      id_card_no: cIdNo,
      id_card_province: cProvince,
      id_card_area: cArea,
      pdpa_consent: cPdpa,
      customer_signature: cSignature,
      id_card_image_url: idCardFile,
      id_card_image_name: idCardFile ? (editingCustomer?.id_card_image_name || `IDCARD_${cName}.png`) : '',
      id_card_read_status: idCardFile ? 'ตรวจสอบข้อมูลบัตรและพิกัดแล้วโดยผู้ส่งมอบเครื่องมือ' : ''
    };

    if (targetCustomerId) {
      payload.customer_id = targetCustomerId;
    }

    try {
      const isNew = !targetCustomerId;
      const saved = await JirakitDB.saveCustomer(payload);
      alert('บันทึกข้อมูลและเซ็นยินยอม PDPA เสร็จสิ้น!');
      setEditingCustomer(null);
      setCustomers(JirakitDB.getCustomers().filter(c => c.customer_status === 'Active'));
      triggerRefresh();
      
      // Notify Line OA
      if (isNew) {
         JirakitDB.sendLineNotify(`📋 เพิ่มลูกค้าใหม่สำเร็จ\nชื่อ: ${saved.customer_name}\nสาขา/พิกัด: ${saved.delivery_location || '-'}\nเบอร์: ${saved.phone || '-'}`);
      }
      
      // Async Sync to Cloud (GAS push)
      JirakitDB.syncWithCloud().catch(err => {
         JirakitDB.sendLineNotify(`โ Saving to Google Sheets failed (Apps Script / Network Error):\n${err}`);
      });
      
    } catch (err: any) {
      alert(`Cannot save: ${err?.message || err}`);
      JirakitDB.sendLineNotify(`❌ พบข้อผิดพลาดขณะบันทึกลูกค้า:\n${err?.message || err}`);
    }
  };

  return (
    <div className="space-y-6 max-w-full mx-auto w-full">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-[var(--ui-gap-button)]">
          <div>
            <h2 className="text-xl font-extrabold text-[var(--text-main)]">รายชื่อลูกค้าและสัญญาเช่ากู้ยืม</h2>
            <p className="text-[length:var(--ui-font-label)] text-[var(--text-soft)] mt-1">จัดเก็บพิกัดหน้างาน ดึงลายเซ็นลูกค้า และเซฟภาพบัตรประชาชน</p>
          </div>
          <Button
            onClick={() => handleOpenForm()}
            className="h-[var(--ui-button-h)] bg-[var(--ui-primary)] hover:opacity-90 text-[var(--ui-on-primary)] font-extrabold px-5 rounded-[var(--ui-radius-card)] text-[length:var(--ui-font-label)] transition-colors flex items-center gap-[var(--ui-gap-button)] shadow-sm"
          >
            <UserPlus size={14} /> เพิ่มรายชื่อลูกค้าประจำ
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-[var(--ui-card-pad-sm)] text-[var(--text-main)]" size={16} />
          <Input
            type="text"
            className="w-full ai-panel border border-[var(--ui-border)] rounded-[var(--ui-radius-card)] pl-10 pr-4 py-2 text-[length:var(--ui-font-button)]"
            placeholder="ค้นหาลูกค้าตาม ชื่อ เบอร์โทร เลขประจําตัวผู้เสียภาษี หรือเลขบัตร..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Customer Table view */}
        <div className="ai-panel border rounded-[var(--ui-radius-card)] shadow-sm overflow-x-auto">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-[var(--text-soft)] font-bold border border-dashed border-[var(--ui-border)] m-4 rounded-[var(--ui-radius-card)]">
              <p>ไม่พบข้อมูลลูกค้า</p>
            </div>
          ) : (
            <div className="w-full overflow-x-auto rounded-[var(--ui-radius-card)] border">
              <div className="w-full overflow-x-auto">
                <DataTable className="min-w-[720px] w-full text-[length:var(--ui-font-label)] text-left">
                  <thead>
                    <tr className="ai-panel text-[var(--text-soft)] h-[var(--ui-control-h)] font-black border-b border-[var(--ui-border)]">
                      <th className="px-4 py-2">รหัสลูกค้า</th>
                      <th className="px-4 py-2">ชื่อลูกค้า</th>
                      <th className="px-4 py-2">เบอร์โทร</th>
                      <th className="px-4 py-2">ที่อยู่ / พิกัดส่งของ</th>
                      <th className="px-4 py-2">เอกสารและ PDPA</th>
                      <th className="px-4 py-2 text-center">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--ui-border)] font-semibold ai-panel text-[var(--text-soft)]">
                    {filtered.map(c => (
                      <tr key={c.customer_id} className="hover:ai-panel transition-colors h-14">
                        <td className="px-4 py-2">
                          <span className="text-[length:var(--ui-font-label)] text-[var(--text-soft)] ai-panel px-2 py-0.5 rounded-lg font-mono uppercase border border-[var(--ui-border)]">{c.customer_id}</span>
                        </td>
                        <td className="px-4 py-2 font-extrabold text-[var(--text-main)]">{c.customer_name}</td>
                        <td className="px-4 py-2 text-[var(--text-soft)]">
                          <div className="flex items-center gap-[var(--ui-gap-button)]">
                            <Phone className="text-[var(--text-main)]" size={13} /> {c.phone || '-'}
                          </div>
                        </td>
                        <td className="px-4 py-2">
                          <div className="text-[var(--text-soft)] font-medium line-clamp-1 flex items-center gap-1" title={c.address || c.registered_address || '-'}>
                            <MapPin className="text-[var(--text-soft)] shrink-0" size={12} /> {c.address || c.registered_address || '-'}
                          </div>
                          <div className="text-[length:var(--ui-font-label)] text-[var(--text-soft)] mt-1">
                            📍 ทยอยส่ง/หน้างาน: <span className="font-extrabold text-[var(--text-main)]">{c.current_worksite || c.delivery_location || 'ไม่ระบุพิกัด'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex flex-col gap-[var(--ui-gap-button)] items-start">
                            {c.pdpa_consent ? (
                              <span className="flex items-center gap-1 text-[var(--ui-primary)] font-bold text-[9px] bg-[var(--ui-surface)] px-2 py-0.5 rounded-full border border-[var(--ui-primary)] whitespace-nowrap">
                                <ShieldCheck size={10} /> PDPA
                              </span>
                            ) : (
                              <span className="text-[var(--ui-danger)] font-bold text-[9px] bg-[var(--ui-danger)]/10 px-2 py-0.5 rounded-full border border-[var(--ui-danger)]/20 whitespace-nowrap">
                                ⚠ ยังไม่คุ้มครอง
                              </span>
                            )}
                            {c.id_card_image_url && (
                              <span className="flex items-center gap-1 text-[var(--text-main)] font-bold text-[9px] bg-[var(--ui-surface)] px-2 py-0.5 rounded-full border border-[var(--ui-border)] whitespace-nowrap">
                                <FileText size={10} /> สแกนบัตรไว้
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex gap-[var(--ui-gap-button)] justify-center">
                            <Button
                              onClick={() => handleOpenForm(c)}
                              className="p-1.5 bg-[var(--ui-primary)] text-[var(--ui-on-primary)] rounded-lg hover:opacity-90 tooltip"
                              title="แก้ไขข้อมูล"
                            >
                              <FileText size={14} />
                            </Button>
                            <Button
                              onClick={() => setSelectedProfileCustomer(c)}
                              className="p-1.5 bg-[var(--ui-surface)] border border-[var(--ui-border)] text-[var(--ui-warning)] rounded-lg hover:bg-[var(--ui-warning)] tooltip"
                              title="ดูประวัติหนี้สิน & เครดิต"
                            >
                              <TrendingUp size={14} />
                            </Button>
                            {c.id_card_image_url && (
                              <Button
                                type="button"
                                onClick={() => {
                                  setPreviewIdCardUrl(c.id_card_image_url);
                                  setPreviewIdCardName(c.customer_name);
                                }}
                                className="p-1.5 ai-panel border border-[var(--ui-border)] text-[var(--text-soft)] rounded-lg hover:ai-panel tooltip"
                                title="ดูบัตรประชาชน"
                              >
                                <Eye size={14} />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </DataTable>
              </div>
            </div>
          )}
        </div>

      {/* Editor Drawer Popup Form */}
      {editingCustomer !== null && (
        <div className="fixed inset-0 bg-[var(--ui-surface)]/50 backdrop-blur-xs flex items-center justify-center z-50 p-[var(--ui-card-pad)]">
          <div className="ai-panel rounded-[var(--ui-radius-modal)] w-[95vw] sm:w-[90vw] md:max-w-3xl lg:max-w-5xl max-h-[90dvh] overflow-y-auto mx-auto max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-[var(--ui-primary)] px-6 py-4 text-[var(--ui-on-primary)] flex flex-col sm:flex-row justify-between sm:items-center gap-[var(--ui-gap-button)]">
              <div>
                <h3 className="text-md font-bold flex items-center gap-[var(--ui-gap-button)]">
                  <UserPlus size={16} />
                  {editingCustomer.customer_id ? `อัปเดตข้อมูลลูกค้า #${editingCustomer.customer_id}` : 'ลงทะเบียนลูกค้าประจำใหม่'}
                </h3>
              </div>
              <div className="flex items-center gap-[var(--ui-gap-button)] self-end sm:self-auto">
                <Button
                  type="button"
                  onClick={() => {
                    document.getElementById('customerFakeScanner')?.click();
                  }}
                  className="px-2.5 py-1.5 bg-[var(--ui-surface)]/20 hover:bg-[var(--ui-surface)]/30 text-[var(--text-main)] rounded-lg text-[length:var(--ui-font-label)] font-black uppercase flex items-center gap-1 transition-all shadow-sm cursor-pointer"
                  title="ถ่ายรูปวิเคราะห์ดึงข้อมูลอัตโนมัติ (Enterprise)"
                >
                  📸 ปุ่มถ่ายรูป
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    const nextIdx = presetIndexCounter % SIMULATED_CARDS.length;
                    setPresetIndexCounter(prev => prev + 1);
                    startCardReaderSimulation('smart_card', nextIdx);
                  }}
                  className="px-2.5 py-1.5 bg-[var(--ui-surface)]/20 hover:bg-[var(--ui-surface)]/30 text-[var(--text-main)] rounded-lg text-[length:var(--ui-font-label)] font-black uppercase flex items-center gap-1 transition-all shadow-sm cursor-pointer"
                  title="เสียบชิปการ์ดอัจฉริยะอัตโนมัติ"
                >
                  💳 (Smart Card) ปุ่มเสียบการ์ด
                </Button>
                <Button onClick={() => setEditingCustomer(null)} className="text-[var(--text-main)] hover:text-[var(--ui-danger)] text-2xl font-bold ml-2 leading-none" type="button">×</Button>
              </div>
            </div>

            <Form onSubmit={handleSave} className="flex-1 overflow-y-auto p-[var(--ui-card-pad)] space-y-4 text-[length:var(--ui-font-label)] font-semibold text-[var(--text-soft)]">
              {readerConnecting && (
                <div className="ai-panel border-2 border-dashed border-[var(--ui-primary)] rounded-[var(--ui-radius-card)] p-[var(--ui-card-pad)] text-center space-y-3 shadow-inner my-2 animate-pulse">
                  <div className="flex justify-center items-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-4 border-[var(--ui-primary)] border-t-transparent"></div>
                  </div>
                  <p className="text-[length:var(--ui-font-label)] font-extrabold text-[var(--ui-primary)] tracking-wide">{readerStatusText}</p>
                  <div className="w-full bg-[var(--ui-surface)] rounded-full h-2.5 overflow-hidden">
                    <div className="primary-gradient-bg h-2.5 rounded-full transition-all duration-300" style={{ width: `${readerProgress}%` }}></div>
                  </div>
                  <span className="text-[length:var(--ui-font-label)] text-[var(--text-soft)] font-mono">ความคืบหน้าระบบประมวลผล {readerProgress}%</span>
                </div>
              )}

              <div>
                <label className="block text-[var(--text-soft)] mb-1 font-bold">ชื่อสัญญาลูกค้า (บุคคลหรือนิติบุคคล)</label>
                <Input
                  type="text"
                  className="w-full h-[var(--ui-control-h)] border rounded-lg px-3"
                  placeholder="เช่น บจก. พลังรุ่งเรืองก่อสร้าง (สมจิตต์)"
                  value={cName}
                  onChange={e => setCName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-[var(--ui-gap-button)]">
                <div>
                  <label className="block text-[var(--text-soft)] mb-1 font-bold">เบอร์โทรศัพท์มือถือ</label>
                  <Input
                    type="text"
                    maxLength={12}
                    className="w-full h-[var(--ui-control-h)] border rounded-lg px-3"
                    placeholder="เช่น 081-234-5678"
                    value={cPhone}
                    onChange={e => setCPhone(formatThaiPhone(e.target.value))}
                  />
                </div>
                <div>
                  <label className="block text-[var(--text-soft)] mb-1 font-bold">เลขบัตรประชาชน (13 หลัก)</label>
                  <Input
                    type="text"
                    maxLength={17}
                    className="w-full h-[var(--ui-control-h)] border rounded-lg px-3"
                    placeholder="เช่น 1-5399-00281-45-6"
                    value={cIdNo}
                    onChange={e => setCIdNo(formatThaiIDCard(e.target.value))}
                  />
                </div>
              </div>

              <Input
                type="file"
                id="customerFakeScanner"
                accept="image/*"
                className="hidden"
                onChange={handleIdCardUploadFake}
              />

              {idCardFile && (
                <div className="space-y-2 border border-[var(--ui-border)] p-[var(--ui-card-pad-sm)] min-h-[var(--ui-button-h)] rounded-[var(--ui-radius-card)] ai-panel">
                  <span className="text-[length:var(--ui-font-label)] text-[var(--text-soft)] font-extrabold block uppercase tracking-wider">
                    📸 ภาพถ่ายหน้าบัตรจากเซนเซอร์วิเคราะห์ด่วนล่าสุด:
                  </span>
                  <div className="relative border rounded-[var(--ui-radius-card)] overflow-hidden ai-panel shadow-sm max-w-sm mx-auto">
                    {idCardFile.startsWith('data:image/svg+xml') ? (
                      <div 
                        className="w-full max-h-[170px]"
                        dangerouslySetInnerHTML={{ __html: decodeURIComponent(idCardFile.split(',')[1] || '') }}
                      />
                    ) : (
                      <img src={idCardFile} alt="Uploaded Card Preview" className="w-full max-h-[160px] object-contain mx-auto ai-panel" />
                    )}
                    
                    <Button
                      type="button"
                      onClick={() => setIdCardFile('')}
                      className="absolute bottom-1 right-1 px-2 py-0.5 bg-[var(--ui-danger)]/90 hover:bg-[var(--ui-danger)] border border-[var(--ui-danger)] text-[var(--text-main)] rounded-lg text-[9px] font-black uppercase transition-colors cursor-pointer"
                    >
                      ล้างรูปป้ายทะเบียนบัตร
                    </Button>
                  </div>
                </div>
              )}

              <label className="flex items-start gap-[var(--ui-gap-button)] ai-panel border border-[var(--ui-border)] p-[var(--ui-card-pad-sm)] min-h-[var(--ui-button-h)] rounded-[var(--ui-radius-card)] cursor-pointer">
                <Input
                  type="checkbox"
                  checked={cPdpa || true}
                  className="mt-0.5 accent-[var(--ui-primary)]"
                  onChange={e => setCPdpa(e.target.checked)}
                />
                <span className="text-[length:var(--ui-font-label)] text-[var(--text-soft)] font-semibold leading-relaxed">
                   ข้าพเจ้ายินยอมลงชื่อและมอบอำนาจให้ผู้จัดเก็บข้อมูลในระบบเครือข่าย พ.ร.บ. คุ้มครองความปลอดภัยข้อมูลส่วนบุคคล (PDPA Consent) ตลอดอายุการดำเนินโครงการเช่าวัสดุก่อสร้าง
                </span>
              </label>

              {/* INTEGRATED THAI ADDRESS HIERARCHICAL autocomplete & SEGMENTATION */}
              <div className="border border-[var(--ui-border)] rounded-[var(--ui-radius-card)] p-[var(--ui-card-pad)] ai-panel space-y-3 shadow-2xs">
                <span className="text-[length:var(--ui-font-label)] font-black text-[var(--text-soft)] uppercase tracking-wider block border-b pb-1">
                  📍 ที่อยู่ทะเบียนบ้านลูกค้า (รายละเอียดแยกส่วน คัดกรองอัตโนมัติ)
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-[var(--ui-gap-button)].5">
                  <div>
                    <label className="block text-[var(--text-soft)] mb-1 font-bold">บ้านเลขที่ / ซอย / ถนน</label>
                    <Input
                      type="text"
                      className="w-full h-[var(--ui-control-h)] border rounded-lg px-3"
                      placeholder="เช่น 123/4 ซอย 2 ถนนวงแหวน"
                      value={cAddressNo}
                      onChange={e => setCAddressNo(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[var(--text-soft)] mb-1 font-bold">หมู่ที่ / หมู่บ้าน</label>
                    <Input
                      type="text"
                      className="w-full h-[var(--ui-control-h)] border rounded-lg px-3"
                      placeholder="เช่น หมู่ 3 บ้านปากเกาะ"
                      value={cMoo}
                      onChange={e => setCMoo(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-[var(--ui-gap-button)].5">
                  <div className="relative">
                    <label className="block text-[var(--text-soft)] mb-1 font-bold">ตำบล / แขวง (พิมพ์ค้นหาได้)</label>
                    <Input
                      type="text"
                      className="w-full h-[var(--ui-control-h)] border rounded-lg px-3"
                      placeholder="พิมพ์เพื่อเริ่มค้นหาตำบล..."
                      value={subdistrictSearch}
                      onChange={e => {
                        setSubdistrictSearch(e.target.value);
                        setCSubdistrict(e.target.value);
                        setShowSuggestions(true);
                      }}
                      onFocus={() => setShowSuggestions(true)}
                    />
                    
                    {/* AUTOCOMPLETE DROPDOWN */}
                    {showSuggestions && (
                      <div className="absolute left-0 right-0 top-16 ai-panel border border-[var(--ui-border)] rounded-[var(--ui-radius-card)] shadow-xl z-50 max-h-[180px] overflow-y-auto divide-y text-[length:var(--ui-font-label)] font-bold">
                        {THAI_ADDRESS_DATA.filter(item => {
                          const query = subdistrictSearch.toLowerCase().trim();
                          if (!query) return item.province === cProvince;
                          return item.subdistrict.includes(query) || 
                                 item.district.includes(query) || 
                                 item.province.includes(query) || 
                                 item.zipcode.includes(query);
                        }).length === 0 ? (
                          <div className="p-[var(--ui-card-pad-sm)] text-[var(--text-soft)] text-center">
                            ไม่พบข้อมูลในสารบบ (สามารถพิมพ์รอดักเองได้)
                          </div>
                        ) : (
                          THAI_ADDRESS_DATA.filter(item => {
                            const query = subdistrictSearch.toLowerCase().trim();
                            if (!query) return item.province === cProvince;
                            return item.subdistrict.includes(query) || 
                                   item.district.includes(query) || 
                                   item.province.includes(query) || 
                                   item.zipcode.includes(query);
                          }).map((item, idx) => (
                            <Button
                              key={idx}
                              type="button"
                              onClick={() => {
                                setCSubdistrict(item.subdistrict);
                                setSubdistrictSearch(item.subdistrict);
                                setCAmphoe(item.district);
                                setCProvince(item.province);
                                setCPostalCode(item.zipcode);
                                setShowSuggestions(false);
                              }}
                              className="w-full text-left px-3.5 py-2.5 hover:ai-panel text-[var(--text-soft)] hover:text-[var(--text-main)] transition-colors block shrink-0"
                            >
                              ต. {item.subdistrict} → อ. {item.district} → จ. {item.province} ({item.zipcode})
                            </Button>
                          ))
                        )}
                        <Button
                          type="button"
                          onClick={() => setShowSuggestions(false)}
                          className="w-full text-center py-2.5 ai-panel hover:bg-[var(--ui-surface)] font-extrabold text-[var(--text-soft)] border-t"
                        >
                          ปิดหน้าต่างตัวช่วยพิมพ์ [X]
                        </Button>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-[var(--text-soft)] mb-1 font-bold">อำเภอ / เขต</label>
                    <Input
                      type="text"
                      className="w-full h-[var(--ui-control-h)] border rounded-lg px-3"
                      placeholder="เช่น เมืองอุตรดิตถ์"
                      value={cAmphoe}
                      onChange={e => setCAmphoe(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-[var(--ui-gap-button)].5">
                  <div>
                    <label className="block text-[var(--text-soft)] mb-1 font-bold">จังหวัด</label>
                    <Select 
                      className="w-full h-[var(--ui-control-h)] border rounded-lg px-3 ai-panel text-[var(--text-main)]"
                      value={cProvince}
                      onChange={e => setCProvince(e.target.value)}
                    >
                      {['อุตรดิตถ์', 'พิษณุโลก', 'สุโขทัย', 'แพร่', 'น่าน', 'พะเยา', 'เชียงใหม่', 'กรุงเทพมหานคร'].map(prov => (
                        <option key={prov} value={prov}>{prov}</option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <label className="block text-[var(--text-soft)] mb-1 font-bold">รหัสไปรษณีย์</label>
                    <Input
                      type="text"
                      maxLength={5}
                      className="w-full h-[var(--ui-control-h)] border rounded-lg px-3"
                      placeholder="เช่น 53000"
                      value={cPostalCode}
                      onChange={e => setCPostalCode(e.target.value.replace(/\D/g, ''))}
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <label className="block text-[var(--text-soft)] mb-1 text-[length:var(--ui-font-label)] font-bold uppercase">ที่อยู่รวมจัดส่งด่วนตามกฎหมาย (คำนวณอัตโนมัติ):</label>
                  <p className="ai-panel border rounded-[var(--ui-radius-card)] p-[var(--ui-card-pad-sm)] text-[var(--text-soft)] text-[length:var(--ui-font-label)] leading-relaxed font-black min-h-[var(--ui-button-h)]">
                    {cAddress ? cAddress : 'กรุณากรอกข้อมูลส่วนสำคัญเพื่อเริ่มประมวลผลปลายทาง...'}
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-[var(--text-soft)] mb-1 font-extrabold">หน้างานสำหรับการจัดส่งกองวัสดุ / พิกัดโครงการก่อสร้าง</label>
                <Input
                  type="text"
                  className="w-full h-[var(--ui-control-h)] border rounded-lg px-3"
                  placeholder="เช่น ซอย 2 ข้างวัดท่าเสา ข้างตึกอบจ.อุตรดิตถ์"
                  value={cWorksite}
                  onChange={e => setCWorksite(e.target.value)}
                />
              </div>

              <div>
                <SignaturePad
                  label="ลายเซ็นกำกับสัญญากู้ยืมผู้เช่า (ลงชื่อบนจอสัมผัสหรือเมาส์)"
                  placeholder="ลงชื่อเช็นตรงนี้เพื่อยินยอมการรับวัตถุก่อสร้าง หรือคลิกปุ่มเสียบการ์ดด้านบนเพื่อตรวจจับลายมือจำลอง..."
                  value={cSignature}
                  onChange={setCSignature}
                />
              </div>

              <div className="flex gap-[var(--ui-gap-button)].5 pt-4.5 border-t">
                <Button
                  type="button"
                  onClick={() => setEditingCustomer(null)}
                  className="w-1/3 py-2.5 bg-[var(--ui-surface)] hover:bg-[var(--ui-text)] border text-[var(--text-soft)] font-extrabold rounded-[var(--ui-radius-card)] text-[length:var(--ui-font-label)] cursor-pointer transition-colors"
                >
                  ย้อนกลับ
                </Button>
                <Button
                  type="submit"
                  className="flex-1 py-2.5 outer-cont flex justify-center text-[length:var(--ui-font-label)] font-black shadow-md cursor-pointer"
                >
                  <CheckCircle size={14} /> ✓ มอบอำนาจเซฟรายชื่อ
                </Button>
              </div>
            </Form>
          </div>
        </div>
      )}
      {/* Customer Profile & 6-Month Rental Debt History Modality */}
      {selectedProfileCustomer !== null && (() => {
        const c = selectedProfileCustomer;
        const receipts = JirakitDB.getReceipts().filter(r => r.customer_id === c.customer_id);
        const unpaidReceipts = receipts.filter(r => r.debt_amount > 0);
        const totalUnpaidDebt = unpaidReceipts.reduce((sum, r) => sum + (r.debt_amount || 0), 0);

        const lastFivePayments = (() => {
          const list: { date: string; receipt_no: string; amount_paid: number; type: string }[] = [];
          
          receipts.forEach(r => {
            if (r.paid_amount > 0) {
              list.push({
                date: r.created_at || r.rent_date || '',
                receipt_no: r.receipt_no,
                amount_paid: r.paid_amount,
                type: 'บิลเช่า/ขายวัสดุ'
              });
            }
          });

          const returns = JirakitDB.getReturnEvents().filter(ret => ret.customer_id === c.customer_id);
          returns.forEach(ret => {
            if (ret.paid_amount > 0) {
              list.push({
                date: ret.created_at || ret.return_date || '',
                receipt_no: ret.receipt_no,
                amount_paid: ret.paid_amount,
                type: 'ชำระคืนคลัง/ปรับ'
              });
            }
          });

          list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          return list.slice(0, 5);
        })();
        
        // Assess Credit Risk
        let riskRating = '';
        let riskColor = '';
        let riskBg = '';
        let riskDesc = '';
        if (totalUnpaidDebt === 0) {
          riskRating = 'เสี่ยงต่ำมาก (Low Risk)';
          riskColor = 'text-[var(--ui-primary)] bg-[var(--ui-surface)] border-[var(--ui-primary)]';
          riskBg = 'bg-[var(--ui-primary)]';
          riskDesc = 'ไม่มียอดค้างชำระ ประวัติการส่งเงินดีเยี่ยม อุปกรณ์เช่าได้รับการดูแลดี';
        } else if (totalUnpaidDebt <= 8000) {
          riskRating = 'เสี่ยงต่ำ (Low Risk)';
          riskColor = 'text-[var(--ui-primary)] bg-[color-mix(in_srgb,var(--ui-primary)_10%,var(--ui-surface))] border-[var(--ui-primary)]';
          riskBg = 'bg-[var(--ui-primary)]';
          riskDesc = 'มียอดค้างชำระเล็กน้อย ชำระคืนสม่ำเสมอตามกรอบรอบสัญญาเช่า';
        } else if (totalUnpaidDebt <= 30000) {
          riskRating = 'เสี่ยงปานกลาง (Medium Risk)';
          riskColor = 'text-[var(--ui-danger)] bg-[var(--ui-danger)]/10 border-[var(--ui-danger)]/20';
          riskBg = 'bg-[var(--ui-warning)]';
          riskDesc = 'ยอดหนี้ค้างเริ่มพุ่งสูง ระดับความเสี่ยงปกติในการกู้ยืม แต่ควรติดตามสัญญาเช่าใกล้ชิด';
        } else {
          riskRating = 'เสี่ยงสูง (High Risk)';
          riskColor = 'text-[var(--ui-warning)] bg-[var(--ui-surface)] border-[var(--ui-border)] animate-pulse';
          riskBg = 'bg-[var(--ui-danger)]';
          riskDesc = 'ยอดค้างชำระเกินเพดานควบคุมระวังการผิดสัญญาส่งมอบ แนะนำจำกัดการเปิดบิลเช่ารอบใหม่ชั่วคราว';
        }

        // 6-Month Rental Debt History Calculation
        const historyData = (() => {
          const months: { label: string; debt: number }[] = [];
          const now = new Date();
          for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const year = d.getFullYear();
            const month = d.getMonth();
            
            const thaiMonthsShort = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
            const label = `${thaiMonthsShort[month]} ${String((year + 543) % 100).padStart(2, '0')}`;
            
            const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59);
            const totalDebtAtMonthEnd = receipts
              .filter(r => {
                const rcDate = new Date(r.created_at || r.rent_date);
                return rcDate <= endOfMonth;
              })
              .reduce((sum, r) => sum + (r.debt_amount || 0), 0);
              
            months.push({ label, debt: totalDebtAtMonthEnd });
          }
          return months;
        })();

        const maxDebt = Math.max(...historyData.map(h => h.debt), 1000);
        
        // Coordinates for SVG Areas
        const svgPoints = historyData.map((h, idx) => {
          const x = 50 + idx * 80; // 50, 130, 210, 290, 370, 450
          const y = 180 - (h.debt / maxDebt) * 130; // Scale debt to Y [50, 180]
          return { x, y, debt: h.debt, label: h.label };
        });

        // Generate SVG Path
        let pathString = '';
        if (svgPoints.length > 0) {
          pathString = `M ${svgPoints[0].x} ${svgPoints[0].y} ` + 
            svgPoints.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ');
        }
        const areaPathString = pathString ? `${pathString} L ${svgPoints[svgPoints.length - 1].x} 180 L ${svgPoints[0].x} 180 Z` : '';

        return (
          <div className="fixed inset-0 bg-[var(--ui-surface)]/60 backdrop-blur-xs flex items-center justify-center z-50 p-[var(--ui-card-pad)]">
            <div className="ai-panel rounded-[var(--ui-radius-modal)] max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
              
              {/* Header */}
              <div className="bg-[var(--ui-primary)] px-6 py-4 text-[var(--ui-on-primary)] flex justify-between items-center">
                <div className="flex items-center gap-[var(--ui-gap-button)]">
                  <TrendingUp size={18} />
                  <div>
                    <h3 className="text-md font-bold">ข้อมูลวิเคราะห์เครดิต & หนี้สิน</h3>
                    <p className="text-[length:var(--ui-font-label)] text-[var(--ui-danger)] font-bold mt-0.5">ลูกค้าพิกัดสัญญาก่อสร้าง: {c.customer_name}</p>
                  </div>
                </div>
                <Button onClick={() => setSelectedProfileCustomer(null)} className="text-[var(--text-main)] hover:text-[var(--ui-danger)] p-1">
                  <X size={20} />
                </Button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-[var(--ui-card-pad)] space-y-6 text-[length:var(--ui-font-label)] text-[var(--text-soft)]">
                
                {/* Credit Risk Assessment Panel */}
                <div className={`p-[var(--ui-card-pad)] rounded-[var(--ui-radius-card)] border flex flex-col sm:flex-row justify-between gap-[var(--ui-gap-button)] items-start sm:items-center ${riskColor}`}>
                  <div className="space-y-1">
                    <div className="flex items-center gap-[var(--ui-gap-button)] font-extrabold text-[length:var(--ui-font-button)] uppercase">
                      <AlertTriangle size={15} />
                      <span>ระดับความเสี่ยงทางการเงิน:</span>
                      <span className="font-extrabold">{riskRating}</span>
                    </div>
                    <p className="text-[length:var(--ui-font-label)] font-medium leading-relaxed max-w-md">{riskDesc}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[length:var(--ui-font-label)] text-[var(--text-soft)] font-bold font-sans">ยอดหนี้ค้างชำระปัจจุบันรวม</p>
                    <p className="text-lg font-black text-[var(--text-main)] mt-1">{totalUnpaidDebt.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                  </div>
                </div>

                {/* 6-Month Debt Trend SVG Area Chart Component */}
                <div className="ai-panel border border-[var(--ui-border)] rounded-[var(--ui-radius-card)] p-[var(--ui-card-pad)]">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="font-extrabold text-[var(--text-main)] flex items-center gap-1">
                      <CreditCard size={13} className="text-[var(--text-main)]" />
                      ประวัติภาระหนี้สินสะสมย้อนหลัง 6 เดือน
                    </h4>
                    <span className="text-[length:var(--ui-font-label)] ai-panel border px-2 py-0.5 rounded-lg font-mono font-bold text-[var(--text-soft)]">
                      หน่วย: บาท ()
                    </span>
                  </div>

                  <div className="w-full overflow-x-auto">
                    <svg width="100%" height="220" viewBox="0 0 500 220" className="mx-auto select-none min-w-[460px]">
                      <defs>
                        <linearGradient id="debtGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--ui-danger)" stopOpacity="0.4" />
                          <stop offset="100%" stopColor="var(--ui-danger)" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>

                      {/* Horizontal Grid lines */}
                      {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
                        const yVal = 50 + ratio * 130;
                        const labelVal = maxDebt * (1 - ratio);
                        return (
                          <g key={i}>
                            <line 
                              x1="45" 
                              y1={yVal} 
                              x2="465" 
                              y2={yVal} 
                              stroke="var(--ui-border)" 
                              strokeDasharray="3 3" 
                            />
                            <text 
                              x="8" 
                              y={yVal + 3} 
                              className="fill-[var(--text-soft)] font-mono text-[9px] font-bold"
                            >
                              {Math.round(labelVal).toLocaleString()}
                            </text>
                          </g>
                        );
                      })}

                      {/* Area Fill */}
                      {areaPathString && (
                        <path d={areaPathString} fill="url(#debtGrad)" />
                      )}

                      {/* Line Path */}
                      {pathString && (
                        <path 
                          d={pathString} 
                          fill="none" 
                          stroke="var(--ui-danger)" 
                          strokeWidth="2.5" 
                          strokeLinecap="round" 
                        />
                      )}

                      {/* Data Points / Circle Nodes */}
                      {svgPoints.map((pt, i) => (
                        <g key={i} className="group cursor-pointer">
                          <circle 
                            cx={pt.x} 
                            cy={pt.y} 
                            r="5" 
                            className="fill-[var(--ui-on-primary)] stroke-[var(--ui-danger)] stroke-2 hover:r-7 transition-all"
                          />
                          {/* Point Value tooltip or indicator */}
                          <text 
                            x={pt.x} 
                            y={pt.y - 10} 
                            textAnchor="middle" 
                            className="fill-[var(--ui-danger)] font-bold text-[9px] font-mono"
                          >
                            {Math.round(pt.debt).toLocaleString()}
                          </text>
                          {/* X labels */}
                          <text 
                            x={pt.x} 
                            y="202" 
                            textAnchor="middle" 
                            className="fill-[var(--text-soft)] font-extrabold text-[length:var(--ui-font-label)]"
                          >
                            {pt.label}
                          </text>
                        </g>
                      ))}

                      {/* X and Y Axis lines */}
                      <line x1="45" y1="180" x2="465" y2="180" stroke="var(--text-soft)" strokeWidth="1.5" />
                      <line x1="45" y1="50" x2="45" y2="180" stroke="var(--text-soft)" strokeWidth="1.5" />
                    </svg>
                  </div>
                </div>

                {/* Last 5 Payments Section */}
                <div className="space-y-3">
                  <h4 className="font-extrabold text-[var(--text-main)] flex items-center gap-1">
                    <span className="text-[var(--text-main)]">💰</span>
                    ประวัติการชำระเงิน 5 รายการล่าสุด
                  </h4>
                  {lastFivePayments.length === 0 ? (
                    <div className="text-center py-6 ai-panel text-[var(--text-soft)] rounded-[var(--ui-radius-card)] border border-[var(--ui-border)]">
                      <p className="font-bold font-sans text-[length:var(--ui-font-label)]">ไม่พบประวัติธุรกรรมการรับชำระเงินของลูกค้ารายนี้</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-[var(--ui-radius-card)] border border-[var(--ui-border)] shadow-xs">
                      <div className="w-full overflow-x-auto rounded-[var(--ui-radius-card)] border"><div className="w-full overflow-x-auto">
<DataTable className="min-w-[720px] w-full text-[length:var(--ui-font-label)] font-bold text-left table-auto">
                        <thead>
                          <tr className="ai-panel text-[var(--text-soft)] h-8">
                            <th className="p-2 pl-3">วัน-เวลา ทำรายการ</th>
                            <th className="p-2 text-center">ช่องทางบิล</th>
                            <th className="p-2 text-center">อ้างอิงบิล</th>
                            <th className="p-2 text-right pr-3">จำนวนเงินที่ชำระ ()</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--ui-border)] text-[var(--text-soft)] font-medium">
                          {lastFivePayments.map((p, idx) => (
                            <tr key={idx} className="h-9 hover:ai-panel transition-colors">
                              <td className="p-2 pl-3 font-mono text-[10.5px]">
                                {p.date ? new Date(p.date).toLocaleString('th-TH').slice(0, 16) : '-'}
                              </td>
                              <td className="p-2 text-center text-[length:var(--ui-font-label)]">
                                <span className="bg-[var(--ui-surface)] text-[var(--ui-primary)] px-2 py-0.5 rounded-full border border-[var(--ui-primary)] font-bold">
                                  {p.type}
                                </span>
                              </td>
                              <td className="p-2 text-center font-mono text-[var(--text-main)] text-[10.5px]">
                                {p.receipt_no}
                              </td>
                              <td className="p-2 text-right pr-3 font-mono font-black text-[var(--ui-primary)] text-[length:var(--ui-font-label)]">
                                {p.amount_paid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </DataTable>
</div></div>
                    </div>
                  )}
                </div>

                {/* Unpaid Receipts List Details */}
                <div className="space-y-3">
                  <h4 className="font-extrabold text-[var(--text-main)] flex items-center gap-1">
                    <FileText size={13} className="text-[var(--text-main)]" />
                    รายการบิลคงค้างเดิมที่แนะนำติดตามเก็บเงิน ({unpaidReceipts.length} บิล)
                  </h4>
                  {unpaidReceipts.length === 0 ? (
                    <div className="text-center py-6 bg-[var(--ui-surface)] text-[var(--ui-primary)] rounded-[var(--ui-radius-card)] border border-[var(--ui-primary)]">
                      <p className="font-bold font-sans">ไม่มีประเด็นบิลค้างส่ง! คืนคลังครบและปิดหนี้หมดจด</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                      {unpaidReceipts.map(r => (
                        <div key={r.receipt_id} className="ai-panel border border-[var(--ui-border)] p-[var(--ui-card-pad-sm)] min-h-[var(--ui-button-h)] rounded-[var(--ui-radius-card)] flex justify-between items-center">
                          <div>
                            <p className="font-bold text-[var(--text-main)] font-sans">{r.receipt_no} ({r.doc_type === 'receipt' ? 'บิลเสร็จทั่วไป' : r.doc_type === 'invoice' ? 'ใบส่งงวด' : 'ใบแจ้งเก็บหนี้'})</p>
                            <p className="text-[length:var(--ui-font-label)] text-[var(--text-soft)] mt-1">ปล่อยคืน: {r.rent_date} • กำหนดส่งคืนคลัง: {r.due_date || '-'}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[length:var(--ui-font-label)] text-[var(--text-soft)] font-extrabold">ยอดคงค้างหนี้</p>
                            <p className="font-black text-[var(--ui-warning)] text-[length:var(--ui-font-button)] mt-0.5">{r.debt_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>

              {/* Footer */}
              <div className="ai-panel border-t px-6 py-4 flex justify-end">
                <Button
                  type="button"
                  onClick={() => setSelectedProfileCustomer(null)}
                  className="px-5 py-2.5 bg-[var(--text-main)] text-[var(--text-main)] font-extrabold rounded-[var(--ui-radius-card)] transition-all"
                >
                  ปิดหน้ารายละเอียดลูกค้า
                </Button>
              </div>

            </div>
          </div>
        );
      })()}

      {/* ID CARD IN-APP PREVIEW MODAL */}
      {previewIdCardUrl && (
        <div className="fixed inset-0 bg-[var(--ui-surface)]/60 backdrop-blur-md flex items-center justify-center z-[80] p-[var(--ui-card-pad)] animate-in fade-in duration-200">
          <div className="ai-panel rounded-[var(--ui-radius-modal)] w-[95vw] sm:w-[90vw] md:max-w-3xl lg:max-w-5xl max-h-[90dvh] overflow-y-auto mx-auto flex flex-col shadow-2xl overflow-hidden max-h-[90vh]">
            <div className="bg-[var(--ui-warning)] px-6 py-4 text-[var(--text-main)] flex justify-between items-center shrink-0">
              <div className="text-left">
                <h3 className="text-[length:var(--ui-font-button)] font-black flex items-center gap-[var(--ui-gap-button)] font-sans">
                  <CreditCard size={15} /> พรีวิวสแกนหลักฐานบัตรประชาชน
                </h3>
                <p className="text-[length:var(--ui-font-label)] text-[var(--ui-warning)] mt-0.5">คู่สัญญา: {previewIdCardName}</p>
              </div>
              <Button 
                onClick={() => setPreviewIdCardUrl('')} 
                className="text-[var(--text-main)] hover:text-[var(--ui-warning)] text-2xl font-bold font-mono transition-colors"
                aria-label="Close"
              >
                ×
              </Button>
            </div>
            <div className="p-[var(--ui-card-pad)] bg-[var(--ui-surface)] overflow-y-auto flex items-center justify-center min-h-[220px]">
              <div className="w-full max-w-[460px] aspect-[85.6/54] rounded-[var(--ui-radius-card)] overflow-hidden shadow-lg border border-[var(--ui-border)] ai-panel">
                {previewIdCardUrl.startsWith('data:image/svg+xml') ? (
                  <div 
                    className="w-full h-full" 
                    dangerouslySetInnerHTML={{ __html: decodeURIComponent(previewIdCardUrl.split(',')[1] || '') }}
                  />
                ) : (
                  <img src={previewIdCardUrl} alt="ID Card Scan" className="w-full h-full object-contain" />
                )}
              </div>
            </div>
            <div className="ai-panel border-t px-6 py-4 flex justify-end gap-[var(--ui-gap-button)] shrink-0">
              <Button
                type="button"
                onClick={() => setPreviewIdCardUrl('')}
                className="px-5 py-2 hover:bg-[var(--ui-text)] text-[var(--text-soft)] bg-[var(--ui-surface)] font-bold rounded-[var(--ui-radius-card)] text-[length:var(--ui-font-label)] transition-all cursor-pointer"
              >
                ปิดหน้าพรีวิวบัตร
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
