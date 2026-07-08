import React, { useState, useEffect } from 'react';
import { Form } from './ui/Form';
import { UserPlus, Search, CheckCircle } from 'lucide-react';
import { JirakitDB } from '../db';
import { Customer } from '../types';
import { formatThaiPhone, formatThaiIDCard } from '../utils/formatters';
import { THAI_ADDRESS_DATA } from '../utils/thaiAddressData';
import { SIMULATED_CARDS } from '../mocks/simulatedCards';
import SignaturePad from './SignaturePad';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';

interface CustomerSharedModalProps {
  isOpen: boolean;
  onClose: () => void;
  presetCustomer: Partial<Customer> | null;
  onSaved: () => void;
}

export default function CustomerSharedModal({ isOpen, onClose, presetCustomer, onSaved }: CustomerSharedModalProps) {
  const [presetIndexCounter, setPresetIndexCounter] = useState(0);

  // Form Fields
  const [cName, setCName] = useState('');
  const [cPhone, setCPhone] = useState('');
  const [cAddress, setCAddress] = useState('');
  const [cWorksite, setCWorksite] = useState('');
  const [cIdNo, setCIdNo] = useState('');
  const [cProvince, setCProvince] = useState('อุตรดิตถ์');
  const [cArea, setCArea] = useState('');
  const [cPdpa, setCPdpa] = useState(true);
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

  useEffect(() => {
    if (isOpen) {
       if (presetCustomer) {
         setCName(presetCustomer.customer_name || '');
         setCPhone(presetCustomer.phone || '');
         setCIdNo(presetCustomer.id_card_no || '');
         setCWorksite(presetCustomer.current_worksite || presetCustomer.delivery_location || '');
         setCPdpa(presetCustomer.pdpa_consent ?? true);
         setCSignature(presetCustomer.customer_signature || '');
         if (presetCustomer.id_card_image_url) setIdCardFile(presetCustomer.id_card_image_url);
         
         const addr = presetCustomer.address || presetCustomer.registered_address || '';
         setCAddress(addr);
         parseThaiAddressSetup(addr);
       } else {
         // reset
         setCName(''); setCPhone(''); setCIdNo(''); setCWorksite(''); setCSignature('');
         setCPdpa(true); setIdCardFile(''); setCAddress('');
         setCAddressNo(''); setCMoo(''); setCSubdistrict(''); setCAmphoe(''); setCPostalCode(''); setCProvince('อุตรดิตถ์');
       }
    }
  }, [isOpen, presetCustomer]);

  const parseThaiAddressSetup = (str: string) => {
    let addressNo = '', moo = '', subdistrict = '', amphoe = '', province = 'อุตรดิตถ์', postalCode = '';
    if (!str) return;

    const zipMatch = str.match(/(\d{5})$/);
    if (zipMatch) {
      postalCode = zipMatch[1];
      str = str.substring(0, zipMatch.index).trim();
    }
    const provMatch = str.match(/(?:จ\.|จังหวัด)\s*([^\s]+)/);
    if (provMatch) {
      province = provMatch[1].replace(/,+/g, '').trim();
      str = str.replace(provMatch[0], '').trim();
    }
    const ampMatch = str.match(/(?:อ\.|อำเภอ|เขต)\s*([^\s]+)/);
    if (ampMatch) {
      amphoe = ampMatch[1].replace(/,+/g, '').trim();
      str = str.replace(ampMatch[0], '').trim();
    }
    const subMatch = str.match(/(?:ต\.|ตำบล|แขวง)\s*([^\s]+)/);
    if (subMatch) {
      subdistrict = subMatch[1].replace(/,+/g, '').trim();
      str = str.replace(subMatch[0], '').trim();
    }
    const mooMatch = str.match(/(?:หมู่ที่|หมู่|ม\.)\s*(\d+)/);
    if (mooMatch) {
      moo = mooMatch[1];
      str = str.replace(mooMatch[0], '').trim();
    }
    const noMatch = str.match(/(?:บ้านเลขที่|เลขที่)?\s*([\d\/]+)/);
    if (noMatch) {
      addressNo = noMatch[1];
      str = str.replace(noMatch[0], '').trim();
    }
    setCAddressNo(addressNo); setCMoo(moo); setCSubdistrict(subdistrict); setCAmphoe(amphoe); setCProvince(province); setCPostalCode(postalCode);
  };

  useEffect(() => {
      const parts = [];
      if (cAddressNo) parts.push(`บ้านเลขที่ ${cAddressNo}`);
      if (cMoo) parts.push(`หมู่ที่ ${cMoo}`);
      if (cSubdistrict) parts.push(`ต.${cSubdistrict}`);
      if (cAmphoe) parts.push(`อ.${cAmphoe}`);
      if (cProvince) parts.push(`จ.${cProvince}`);
      if (cPostalCode) parts.push(cPostalCode);
      setCAddress(parts.join(' '));
  }, [cAddressNo, cMoo, cSubdistrict, cAmphoe, cProvince, cPostalCode]);

  const startCardReaderSimulation = (type: 'smart_card' | 'ocr', presetIndex: number) => {
    setReaderType(type);
    setReaderConnecting(true);
    setReaderProgress(0);
    const messages = type === 'smart_card' 
      ? ['รอการเชื่อมต่อ Smart Card Reader (USB)...', '📡 ดึงพิกัด ข้อมูลลายเซ็น และถอดรหัสรหัสผ่านกรมการปกครอง...', '✓ ซิงค์ฐานข้อมูลสำเร็จเรียบร้อย!']
      : ['📷 กำลังปรับความคมชัดกล้องถ่ายภาพ...', '🔍 ตรวจพบมุมขอบบัตรประชาชน ประมวลผล OCR...', '✓ อ่านข้อความและวิเคราะห์รอยลายเซ็นลุล่วงแล้ว!'];
    
    setReaderStatusText(messages[0]);
    setTimeout(() => { setReaderStatusText(messages[1]); setReaderProgress(40); }, 500);
    setTimeout(() => {
      setReaderProgress(80);
      const preset = SIMULATED_CARDS[presetIndex];
      setCName(preset.name); setCPhone(preset.phone); setCIdNo(preset.idNo); setCWorksite(preset.worksite);
      parseThaiAddressSetup(preset.addressNo); setCPdpa(preset.pdpaConsent);
      if (type === 'ocr' || type === 'smart_card') setIdCardFile(preset.idCardSvg);
    }, 1100);
    setTimeout(() => { setReaderStatusText(messages[2]); setReaderProgress(100); }, 1500);
    setTimeout(() => { setReaderConnecting(false); }, 2200);
  };

  const handleIdCardUploadFake = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const base64Img = reader.result as string;
      setIdCardFile(base64Img);
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
           parseThaiAddressSetup(d.address || ''); 
           setReaderStatusText(`✅ ดึงข้อมูลสำเร็จ (${d.document_type || 'ไม่ทราบประเภทเอกสาร'})`);
           setReaderProgress(100);
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

    const payload: Partial<Customer> = {
      customer_name: cName, phone: cPhone, address: cAddress, registered_address: cAddress,
      delivery_location: cWorksite, current_worksite: cWorksite, id_card_no: cIdNo,
      pdpa_consent: cPdpa, customer_signature: cSignature, id_card_image_url: idCardFile,
    };

    if (presetCustomer && presetCustomer.customer_id) {
      payload.customer_id = presetCustomer.customer_id;
    }

    try {
      await JirakitDB.saveCustomer(payload);
      alert('บันทึกข้อมูลและเซ็นยินยอม PDPA เสร็จสิ้น!');
      onSaved();
      onClose();
    } catch (err: any) {
      alert(`Cannot save: ${err?.message || err}`);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] bg-[var(--text-main)]/45 backdrop-blur-sm flex items-center justify-center p-3 md:p-5 animate-in fade-in duration-200">
      <div className="ai-panel rounded-3xl w-full max-h-[90dvh] max-w-4xl flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="bg-[var(--ui-secondary)] px-6 py-4 text-[var(--ui-on-primary)] flex justify-between items-center z-10 shrink-0">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <UserPlus size={20} />
            {presetCustomer?.customer_id ? `อัปเดตข้อมูลลูกค้า #${presetCustomer.customer_id}` : 'ลงทะเบียนลูกค้าประจำใหม่ (Full-Screen Platform)'}
          </h3>
          <div className="flex items-center gap-2">
             <Button type="button" onClick={() => document.getElementById('sharedCustomerFakeScanner')?.click()} className="px-3 py-2 bg-[var(--ui-primary)] hover:opacity-90 text-[var(--ui-on-primary)] rounded-xl text-xs font-black uppercase flex items-center gap-1 shadow-sm transition-all hidden md:flex">
               📸 ปุ่มถ่ายรูปใบหน้าบัตร
             </Button>
             <Button type="button" onClick={() => { const nextIdx = presetIndexCounter % SIMULATED_CARDS.length; setPresetIndexCounter(p => p + 1); startCardReaderSimulation('smart_card', nextIdx); }} className="px-3 py-2 ai-panel hover:primary-gradient-bg text-[var(--text-main)] rounded-xl text-xs font-black uppercase flex items-center gap-1 shadow-sm transition-all hidden md:flex">
               💳 ดึงข้อมูล Smart Card
             </Button>
             <Button onClick={onClose} className="text-[var(--text-main)] hover:text-[var(--ui-danger)] font-bold ml-2 leading-none cursor-pointer flex items-center gap-1 ai-panel px-3 py-2 rounded-xl text-xs uppercase" type="button">✖ ปิดหน้าต่าง</Button>
          </div>
        </div>

        <Form onSubmit={handleSave} className="flex-1 overflow-y-auto p-4 md:p-8 space-y-5 text-sm font-semibold text-[var(--text-soft)] ai-panel relative">
          
          {/* Top buttons for mobile view */}
          <div className="flex md:hidden gap-2 mb-4">
             <Button type="button" onClick={() => document.getElementById('sharedCustomerFakeScanner')?.click()} className="flex-1 py-3 bg-[var(--ui-primary)] hover:opacity-90 text-[var(--ui-on-primary)] rounded-xl text-[11px] font-black uppercase flex justify-center items-center gap-1 shadow-sm">
               📸 อ่านบัตร (OCR)
             </Button>
             <Button type="button" onClick={() => { const nextIdx = presetIndexCounter % SIMULATED_CARDS.length; setPresetIndexCounter(p => p + 1); startCardReaderSimulation('smart_card', nextIdx); }} className="flex-1 py-3 ai-panel hover:primary-gradient-bg text-[var(--text-main)] rounded-xl text-[11px] font-black uppercase flex justify-center items-center gap-1 shadow-sm">
               💳 เสียบชิปการ์ด
             </Button>
          </div>

          {readerConnecting && (
            <div className="ai-panel border-2 border-dashed border-[var(--ui-border)] rounded-2xl p-6 text-center space-y-4 shadow-inner mb-4 animate-pulse">
              <div className="flex justify-center items-center">
                <div className="animate-spin rounded-full h-10 w-10 border-4 border-[var(--ui-primary)] border-t-transparent"></div>
              </div>
              <p className="font-extrabold text-[var(--ui-text)] tracking-wide text-base">{readerStatusText}</p>
              <div className="w-full max-w-md mx-auto bg-[var(--ui-surface)] rounded-full h-3 overflow-hidden">
                <div className="primary-gradient-bg h-3 rounded-full transition-all duration-300" style={{ width: `${readerProgress}%` }}></div>
              </div>
            </div>
          )}

          <div>
             <label className="block text-[var(--text-soft)] mb-1.5 font-bold">ชื่อสัญญาลูกค้า (บุคคลหรือนิติบุคคล)</label>
             <Input type="text" className="w-full h-12 border rounded-xl px-4 text-base" placeholder="เช่น บจก. พลังรุ่งเรืองก่อสร้าง (สมจิตต์)" value={cName} onChange={e => setCName(e.target.value)} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 gap-4">
             <div>
               <label className="block text-[var(--text-soft)] mb-1.5 font-bold">เบอร์โทรศัพท์มือถือ</label>
               <Input type="text" maxLength={12} className="w-full h-12 border rounded-xl px-4 text-base" placeholder="เช่น 081-234-5678" value={cPhone} onChange={e => setCPhone(formatThaiPhone(e.target.value))} />
             </div>
             <div>
               <label className="block text-[var(--text-soft)] mb-1.5 font-bold">เลขบัตรประชาชน (13 หลัก)</label>
               <Input type="text" maxLength={17} className="w-full h-12 border rounded-xl px-4 text-base" placeholder="เช่น 1-5399-00281-45-6" value={cIdNo} onChange={e => setCIdNo(formatThaiIDCard(e.target.value))} />
             </div>
          </div>

          <Input type="file" id="sharedCustomerFakeScanner" accept="image/*" className="hidden" onChange={handleIdCardUploadFake} />

          {idCardFile && (
            <div className="space-y-3 border-2 border-[var(--ui-border)] p-4 rounded-2xl ai-panel shadow-sm">
                <span className="text-xs text-[var(--text-soft)] font-extrabold block uppercase tracking-wider">📸 ตรวจพบบัตรประชาชนที่สแกนแล้ว:</span>
                <div className="relative border rounded-2xl overflow-hidden ai-panel shadow-sm w-full md:w-2/3 lg:w-1/2 mx-auto aspect-video flex-shrink-0">
                  {idCardFile.startsWith('data:image/svg') ? (
                    <div className="w-full h-full [&>svg]:w-full [&>svg]:h-full" dangerouslySetInnerHTML={{ __html: decodeURIComponent(idCardFile.split(',')[1] || '') }} />
                  ) : (
                    <img src={idCardFile} alt="Uploaded Card" className="w-full h-full object-contain mx-auto bg-[var(--ui-overlay)]" />
                  )}
                  <Button type="button" onClick={() => setIdCardFile('')} className="absolute bottom-2 right-2 px-3 py-1.5 bg-[var(--ui-danger)]/90 hover:bg-[var(--ui-danger)] border border-[var(--ui-danger)] text-[var(--text-main)] rounded-lg text-xs font-black uppercase transition-colors cursor-pointer">ล้างรูปป้ายทะเบียนบัตร</Button>
                </div>
            </div>
          )}

          <label className="flex items-start gap-3 ai-panel border border-[var(--ui-border)] p-4 rounded-2xl cursor-pointer shadow-sm hover:shadow-md transition-shadow">
             <Input type="checkbox" checked={cPdpa || true} className="mt-1 w-5 h-5 accent-[var(--ui-primary)]" onChange={e => setCPdpa(e.target.checked)} />
             <span className="text-sm text-[var(--text-soft)] font-semibold leading-relaxed">
               ข้าพเจ้ายินยอมลงชื่อและมอบอำนาจให้ผู้จัดเก็บข้อมูลในระบบเครือข่าย พ.ร.บ. คุ้มครองความปลอดภัยข้อมูลส่วนบุคคล (PDPA Consent) ตลอดอายุการดำเนินโครงการเช่าวัสดุก่อสร้าง
             </span>
          </label>

          <div className="border border-[var(--ui-border)] rounded-2xl p-6 ai-panel space-y-4 shadow-sm">
             <span className="text-sm font-black text-[var(--text-soft)] uppercase tracking-wider block border-b pb-2 mb-4">📍 ที่อยู่ตามทะเบียนบ้านลูกค้า</span>
             
             <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 gap-4">
                <div>
                   <label className="block text-[var(--text-soft)] mb-1.5 font-bold">บ้านเลขที่ / ซอย / ถนน</label>
                   <Input type="text" className="w-full h-12 border rounded-xl px-4" placeholder="เช่น 123/4 ซอย 2 ถนนวงแหวน" value={cAddressNo} onChange={e => setCAddressNo(e.target.value)} />
                </div>
                <div>
                   <label className="block text-[var(--text-soft)] mb-1.5 font-bold">หมู่ที่ / หมู่บ้าน</label>
                   <Input type="text" className="w-full h-12 border rounded-xl px-4" placeholder="เช่น หมู่ 3 บ้านปากเกาะ" value={cMoo} onChange={e => setCMoo(e.target.value)} />
                </div>
             </div>

             <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 gap-4">
                <div className="relative">
                   <label className="block text-[var(--text-soft)] mb-1.5 font-bold">ตำบล / แขวง</label>
                   <Input type="text" className="w-full h-12 border rounded-xl px-4" placeholder="พิมพ์ตำบล (ระบบดึงอำเภอ/จังหวัดอัตโนมัติ)" value={subdistrictSearch} onChange={e => { setSubdistrictSearch(e.target.value); setCSubdistrict(e.target.value); setShowSuggestions(true); }} onFocus={() => setShowSuggestions(true)} />
                   {showSuggestions && subdistrictSearch.length > 0 && (
                     <div className="absolute left-0 right-0 top-[70px] ai-panel border border-[var(--ui-border)] rounded-xl shadow-xl z-50 max-h-64 overflow-y-auto divide-y text-xs font-bold">
                       {THAI_ADDRESS_DATA.filter(item => item.subdistrict.includes(subdistrictSearch) || item.district.includes(subdistrictSearch) || item.province.includes(subdistrictSearch) || item.zipcode.includes(subdistrictSearch)).map((item, idx) => (
                          <Button key={idx} type="button" onClick={() => { setCSubdistrict(item.subdistrict); setSubdistrictSearch(item.subdistrict); setCAmphoe(item.district); setCProvince(item.province); setCPostalCode(item.zipcode); setShowSuggestions(false); }} className="w-full text-left px-4 py-3 hover:ai-panel text-[var(--text-soft)] hover:text-[var(--text-main)] transition-colors">
                            ต. {item.subdistrict} → อ. {item.district} → จ. {item.province} ({item.zipcode})
                          </Button>
                       ))}
                       <Button type="button" onClick={() => setShowSuggestions(false)} className="w-full text-center py-3 ai-panel hover:bg-[var(--ui-surface)] font-extrabold text-[var(--text-soft)]">ปิด</Button>
                     </div>
                   )}
                </div>
                <div>
                   <label className="block text-[var(--text-soft)] mb-1.5 font-bold">อำเภอ / เขต</label>
                   <Input type="text" className="w-full h-12 border rounded-xl px-4" placeholder="เช่น เมืองอุตรดิตถ์" value={cAmphoe} onChange={e => setCAmphoe(e.target.value)} />
                </div>
             </div>

             <div className="grid grid-cols-2 md:grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                   <label className="block text-[var(--text-soft)] mb-1.5 font-bold">จังหวัด</label>
                   <Select className="w-full h-12 border rounded-xl px-4 ai-panel text-[var(--text-main)]" value={cProvince} onChange={e => setCProvince(e.target.value)}>
                      {['อุตรดิตถ์', 'พิษณุโลก', 'สุโขทัย', 'แพร่', 'น่าน', 'พะเยา', 'เชียงใหม่', 'กรุงเทพมหานคร'].map(prov => ( <option key={prov} value={prov}>{prov}</option> ))}
                   </Select>
                </div>
                <div>
                   <label className="block text-[var(--text-soft)] mb-1.5 font-bold">รหัสไปรษณีย์</label>
                   <Input type="text" maxLength={5} className="w-full h-12 border rounded-xl px-4" placeholder="53000" value={cPostalCode} onChange={e => setCPostalCode(e.target.value.replace(/\D/g, ''))} />
                </div>
             </div>
          </div>

          <div>
             <label className="block text-[var(--text-soft)] mb-1.5 font-extrabold">หน้างานสำหรับการจัดส่งกองวัสดุ / พิกัดโครงการก่อสร้าง (ถ้ามี)</label>
             <Input type="text" className="w-full h-12 border rounded-xl px-4" placeholder="เช่น ซอย 2 ข้างวัดท่าเสา" value={cWorksite} onChange={e => setCWorksite(e.target.value)} />
          </div>

          <div className="ai-panel rounded-2xl p-2 border border-[var(--ui-border)]">
             <SignaturePad label="ลายเซ็นลูกค้ายินยอม PDPA / ตัวอย่างลายมือชื่อ (สัมผัสจอหรือลากเมาส์)" placeholder="" value={cSignature} onChange={setCSignature} />
          </div>

          <div className="flex gap-3 pt-6 border-t border-[var(--ui-border)] pb-20 md:pb-6">
             <Button type="button" onClick={onClose} className="w-1/3 py-4 bg-[var(--ui-text)] hover:bg-[var(--ui-text)] border border-[var(--ui-border)] text-[var(--text-soft)] font-extrabold rounded-2xl text-sm transition-colors uppercase tracking-wider cursor-pointer">
               ยกเลิก
             </Button>
             <Button type="submit" className="w-2/3 flex-1 py-4 outer-cont text-[var(--text-main)]  font-black rounded-2xl shadow-lg flex items-center justify-center gap-2 text-sm uppercase tracking-wider transition-colors cursor-pointer">
               <CheckCircle size={18} /> อนุมัติบันทึกข้อมูลเข้าฐาน
             </Button>
          </div>
        </Form>
      </div>
    </div>
  );
}
