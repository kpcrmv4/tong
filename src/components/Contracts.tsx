import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Edit3,
  Eye,
  FileDown,
  FileSignature,
  FileText,
  Image as ImageIcon,
  Layers,
  ListChecks,
  Printer,
  Save,
  Search,
  Trash2,
  XCircle,
} from 'lucide-react';
import { JirakitDB } from '../db';
import { ContractDocument, ContractPage, Customer, DocumentTemplate, Receipt } from '../types';
import { Button } from './ui/Button';
import { DataTable } from './ui/DataTable';
import { Input } from './ui/Input';
import {
  exportA4PagesToImages,
  exportA4PagesToPdf,
  exportA4ToImage,
  exportA4ToPdf,
  printA4Element,
  printA4Elements,
} from '../utils/a4ExportService';

type ContractTab = 'list' | 'create' | 'preview' | 'combine';

type RenderPage = {
  title: string;
  type: string;
  html: string;
};

type SelectedCreatePage = {
  id: string;
  title: string;
  type: string;
  htmlTemplate: string;
};

type CustomerSuggestionMode = 'create' | 'combine';

const normalize = (value?: string | number | null) => String(value || '').trim().toLowerCase();
const safeJsonParse = <T,>(value: string | undefined, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const thaiDate = (value?: string) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return date.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
};

const customerDisplayName = (customer?: Partial<Customer> | null) => customer?.customer_name?.trim() || 'ไม่ระบุชื่อลูกค้า';

const getCustomerSearchText = (customer?: Partial<Customer> | null) => [
  customer?.customer_name,
  customer?.phone,
  customer?.address,
  customer?.delivery_location,
  customer?.current_worksite,
  customer?.id_card_no,
].filter(Boolean).join(' ');

const getMissingCustomerFields = (customer?: Partial<Customer> | null) => {
  const missing: string[] = [];
  if (!customer?.customer_name?.trim()) missing.push('รายชื่อ');
  if (!customer?.phone?.trim()) missing.push('เบอร์โทร');
  if (!(customer?.address || customer?.registered_address)?.trim()) missing.push('ที่อยู่');
  if (!(customer?.delivery_location || customer?.current_worksite)?.trim()) missing.push('สถานที่จัดส่ง/ไซต์งาน');
  if (!customer?.id_card_no?.trim()) missing.push('เลขบัตรประชาชน');
  if (!customer?.id_card_image_url?.trim()) missing.push('รูปบัตรประชาชน');
  if (!customer?.customer_signature?.trim()) missing.push('ลายเซ็นลูกค้า');
  return missing;
};

const plainA4Style = `
  <style>
    .jrk-a4-doc{font-family:Sarabun,Arial,sans-serif;color:#111827;line-height:1.55;font-size:14px;}
    .jrk-a4-doc h1{font-size:22px;text-align:center;margin:0 0 18px;font-weight:900;}
    .jrk-a4-doc h2{font-size:16px;margin:18px 0 8px;font-weight:900;}
    .jrk-a4-doc p{margin:6px 0;}
    .jrk-a4-doc .row{display:grid;grid-template-columns:140px 1fr;gap:10px;margin:8px 0;}
    .jrk-a4-doc .line{border-bottom:1px dotted #6b7280;min-height:24px;padding:0 6px;}
    .jrk-a4-doc table{width:100%;border-collapse:collapse;margin-top:14px;font-size:13px;}
    .jrk-a4-doc th,.jrk-a4-doc td{border:1px solid #9ca3af;padding:7px;vertical-align:top;}
    .jrk-a4-doc th{background:#f3f4f6;font-weight:900;text-align:center;}
    .jrk-a4-doc .sign-grid{display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-top:34px;}
    .jrk-a4-doc .sign-box{text-align:center;min-height:90px;}
    .jrk-a4-doc .small{font-size:12px;color:#4b5563;}
  </style>
`;

export default function Contracts() {
  const [activeTab, setActiveTab] = useState < ContractTab > ('list');
  const [customers, setCustomers] = useState < Customer[] > ([]);
  const [receipts, setReceipts] = useState < Receipt[] > ([]);
  const [templates, setTemplates] = useState < DocumentTemplate[] > ([]);
  const [contractDocs, setContractDocs] = useState < ContractDocument[] > ([]);

  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedReceiptId, setSelectedReceiptId] = useState('');
  const [selectedLostItems, setSelectedLostItems] = useState < string[] > ([]);
  const [currentCustomerSnapshot, setCurrentCustomerSnapshot] = useState < Customer | null > (null);
  const [currentReceiptSnapshot, setCurrentReceiptSnapshot] = useState < Receipt | null > (null);
  const [savedContractId, setSavedContractId] = useState < string | null > (null);
  const [editingContractId, setEditingContractId] = useState < string | null > (null);

  const [listSearch, setListSearch] = useState('');
  const [createCustomerSearch, setCreateCustomerSearch] = useState('');
  const [previewSearch, setPreviewSearch] = useState('');
  const [previewSelectedCustomerId, setPreviewSelectedCustomerId] = useState('');
  const [combineCustomerSearch, setCombineCustomerSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(0);
  const [touchStartX, setTouchStartX] = useState < number | null > (null);
  const [selectedCreatePages, setSelectedCreatePages] = useState < SelectedCreatePage[] > ([]);
  const [templateMenuOpen, setTemplateMenuOpen] = useState(false);
  const [orderPanelOpen, setOrderPanelOpen] = useState(false);
  const [combineReceiptModalOpen, setCombineReceiptModalOpen] = useState(false);
  const [receiptPreviewSnapshot, setReceiptPreviewSnapshot] = useState < Receipt | null > (null);
  const [receiptPreviewCloseCount, setReceiptPreviewCloseCount] = useState(0);

  const activeSession = JirakitDB.getActiveSession();
  const isOwner = activeSession?.role === 'Owner';

  const loadData = () => {
    setCustomers(JirakitDB.getCustomers());
    setReceipts(JirakitDB.getReceipts());
    setTemplates(JirakitDB.getDocumentTemplates());
    setContractDocs(
      JirakitDB.getContractDocuments().sort(
        (a, b) => new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime(),
      ),
    );
  };

  useEffect(() => {
    loadData();
  }, []);

  const findCustomer = (customerId: string) => customers.find(c => c.customer_id === customerId) || null;

  const getSnapshotCustomer = (doc: ContractDocument) => {
    const fromSnapshot = safeJsonParse < Partial < Customer >> (doc.customer_snapshot_json, {});
    const fromMaster = findCustomer(doc.customer_id);
    return { ...(fromMaster || {}), ...fromSnapshot } as Customer;
  };

  const filteredCustomers = (term: string) => {
    const q = normalize(term);
    return customers
      .filter(c => c.customer_status !== 'Deleted')
      .filter(c => !q || normalize(getCustomerSearchText(c)).includes(q))
      .slice(0, 10);
  };

  const latestReceiptDate = (receipt: Receipt) => receipt.receipt_date || receipt.created_at || receipt.updated_at || '';

  const receiptsForSelectedCustomer = useMemo(() => {
    return receipts
      .filter(r => !selectedCustomerId || r.customer_id === selectedCustomerId)
      .sort((a, b) => new Date(latestReceiptDate(b)).getTime() - new Date(latestReceiptDate(a)).getTime());
  }, [receipts, selectedCustomerId]);

  const combineReceiptRows = useMemo(() => receiptsForSelectedCustomer.slice(0, 15), [receiptsForSelectedCustomer]);

  const selectCustomer = (customer: Customer, mode: CustomerSuggestionMode) => {
    const snapshot = JSON.parse(JSON.stringify(customer)) as Customer;
    setSelectedCustomerId(customer.customer_id);
    setCurrentCustomerSnapshot(snapshot);
    setCurrentPage(0);
    if (mode === 'create') setCreateCustomerSearch(customer.customer_name || '');
    if (mode === 'combine') setCombineCustomerSearch(customer.customer_name || '');

    if (mode === 'combine') {
      setSelectedReceiptId('');
      setCurrentReceiptSnapshot(null);
      setSelectedLostItems([]);
      setCombineReceiptModalOpen(false);
      setReceiptPreviewSnapshot(null);
      setReceiptPreviewCloseCount(0);
    }

    if (mode === 'create') {
      setSelectedReceiptId('');
      setCurrentReceiptSnapshot(null);
    }
  };

  const handleReceiptChange = (receiptId: string) => {
    setSelectedReceiptId(receiptId);
    const receipt = receipts.find(r => r.receipt_id === receiptId);
    setCurrentReceiptSnapshot(receipt ? (JSON.parse(JSON.stringify(receipt)) as Receipt) : null);
    setSelectedLostItems([]);
    setCurrentPage(0);
  };

  const toggleLostItem = (itemKey: string) => {
    setSelectedLostItems(prev => (prev.includes(itemKey) ? prev.filter(i => i !== itemKey) : [...prev, itemKey]));
  };

  const replaceVariables = (html: string, customerData: Partial<Customer> | null) => {
    if (!html) return '';
    let processed = html;
    processed = processed.replace(/\{\{CUSTOMER_NAME\}\}/g, customerData?.customer_name || '...................');
    processed = processed.replace(/\{\{CUSTOMER_PHONE\}\}/g, customerData?.phone || '...................');
    processed = processed.replace(/\{\{CUSTOMER_ADDRESS\}\}/g, customerData?.address || customerData?.registered_address || '...................');
    processed = processed.replace(/\{\{CUSTOMER_ID_CARD\}\}/g, customerData?.id_card_no || '...................');
    processed = processed.replace(/\{\{DELIVERY_LOCATION\}\}/g, customerData?.delivery_location || customerData?.current_worksite || '...................');

    const sigHtml = customerData?.customer_signature
      ? `<img src="${customerData.customer_signature}" style="max-height:70px;object-fit:contain;margin:0 auto;display:block;" />`
      : '..................................';
    processed = processed.replace(/\{\{CUSTOMER_SIGNATURE\}\}/g, sigHtml);

    const idCardHtml = customerData?.id_card_image_url
      ? `<div style="text-align:center;"><img src="${customerData.id_card_image_url}" style="max-width:100%;max-height:360px;object-fit:contain;" /><br/><br/><b>สำเนาถูกต้อง</b><br/>${sigHtml}</div>`
      : '<div style="border:1px dashed #9ca3af;padding:34px;text-align:center;color:#4b5563;">ยังไม่มีรูปบัตรประชาชนในระบบ</div>';
    processed = processed.replace(/\{\{ID_CARD_PAGE\}\}/g, idCardHtml);
    processed = processed.replace(/\{\{SHOP_NAME\}\}/g, 'จีรกิตติ์ ไม้แบบพลาสติก');
    processed = processed.replace(/\{\{SIGN_DATE\}\}/g, new Date().toLocaleDateString('th-TH'));
    return processed;
  };

  const buildDefaultPageHtml = (applyTo: string, customerData: Partial<Customer> | null) => {
    const name = customerData?.customer_name || '........................................';
    const phone = customerData?.phone || '........................................';
    const address = customerData?.address || customerData?.registered_address || '........................................';
    const worksite = customerData?.delivery_location || customerData?.current_worksite || '........................................';
    const idNo = customerData?.id_card_no || '........................................';
    const sign = customerData?.customer_signature
      ? `<img src="${customerData.customer_signature}" style="max-height:68px;object-fit:contain;margin:0 auto;display:block;" />`
      : '<div style="height:52px"></div>';

    if (applyTo === 'หน้าบัตรประชาชน') {
      return `${plainA4Style}<div class="jrk-a4-doc"><h1>สำเนาบัตรประชาชน</h1>${customerData?.id_card_image_url
        ? `<div style="text-align:center"><img src="${customerData.id_card_image_url}" style="max-width:100%;max-height:420px;object-fit:contain" /></div>`
        : '<div style="height:320px;border:1px dashed #9ca3af;display:flex;align-items:center;justify-content:center;color:#6b7280;">ยังไม่มีรูปบัตรประชาชนในระบบ</div>'}
        <div class="sign-grid"><div></div><div class="sign-box">${sign}<p>ลงชื่อ ${name}</p><p class="small">สำเนาถูกต้อง</p></div></div></div>`;
    }

    if (applyTo === 'แบบฟอร์มยืนยันลายเซ็น') {
      return `${plainA4Style}<div class="jrk-a4-doc"><h1>แบบฟอร์มยืนยันลายเซ็น</h1><p>ข้าพเจ้า ${name} ยืนยันว่าลายเซ็นด้านล่างเป็นลายเซ็นที่ใช้สำหรับเอกสารสัญญาเช่าและเอกสารที่เกี่ยวข้อง</p><div class="sign-grid"><div></div><div class="sign-box">${sign}<p>ลงชื่อผู้เช่า</p><p class="small">วันที่ ${new Date().toLocaleDateString('th-TH')}</p></div></div></div>`;
    }

    if (applyTo === 'แบบฟอร์มรับทราบสัญญา') {
      return `${plainA4Style}<div class="jrk-a4-doc"><h1>แบบฟอร์มรับทราบเงื่อนไขสัญญา</h1><p>ผู้เช่าได้รับทราบเงื่อนไขการเช่า การคืนสินค้า ความเสียหาย สูญหาย และค่าใช้จ่ายที่เกิดขึ้นตามจริงครบถ้วนแล้ว</p><table><tbody><tr><th>หัวข้อ</th><th>สถานะรับทราบ</th></tr><tr><td>การรับสินค้าและการคืนสินค้า</td><td>รับทราบ</td></tr><tr><td>ความเสียหาย / สูญหาย / ผิดสัญญา</td><td>รับทราบ</td></tr><tr><td>ยอดค้างชำระและค่าปรับ</td><td>รับทราบ</td></tr></tbody></table><div class="sign-grid"><div></div><div class="sign-box">${sign}<p>ลงชื่อผู้เช่า</p></div></div></div>`;
    }

    return `${plainA4Style}<div class="jrk-a4-doc"><h1>สัญญาเช่า</h1>
      <div class="row"><b>ชื่อลูกค้า</b><div class="line">${name}</div></div>
      <div class="row"><b>เบอร์โทร</b><div class="line">${phone}</div></div>
      <div class="row"><b>เลขบัตร</b><div class="line">${idNo}</div></div>
      <div class="row"><b>ที่อยู่</b><div class="line">${address}</div></div>
      <div class="row"><b>สถานที่จัดส่ง</b><div class="line">${worksite}</div></div>
      <h2>ข้อตกลงการเช่า</h2>
      <p>ผู้เช่าตกลงเช่าอุปกรณ์/สินค้า ตามรายการที่ระบุในระบบ และยอมรับเงื่อนไขการชำระเงิน การดูแลสินค้า การคืนสินค้า และความรับผิดชอบต่อสินค้าเสียหายหรือสูญหาย</p>
      <table><tbody><tr><th>รายการ</th><th>รายละเอียด</th></tr><tr><td>วันที่ทำสัญญา</td><td>${new Date().toLocaleDateString('th-TH')}</td></tr><tr><td>ผู้ให้เช่า</td><td>จีรกิตติ์ ไม้แบบพลาสติก</td></tr><tr><td>ผู้เช่า</td><td>${name}</td></tr></tbody></table>
      <div class="sign-grid"><div class="sign-box"><div style="height:52px"></div><p>ลงชื่อผู้ให้เช่า</p></div><div class="sign-box">${sign}<p>ลงชื่อผู้เช่า</p></div></div>
    </div>`;
  };

  const getTemplateId = (template: DocumentTemplate, index = 0) => String(
    (template as any).id ||
    (template as any).template_id ||
    (template as any).document_template_id ||
    `${template.apply_to || 'template'}-${index}`,
  );

  const getTemplateTitle = (template: DocumentTemplate) => String(
    (template as any).template_name ||
    (template as any).name ||
    (template as any).title ||
    template.apply_to ||
    'เอกสาร',
  );

  const getTemplateRawHtml = (template: DocumentTemplate) => {
    const title = getTemplateTitle(template);
    const applyTo = template.apply_to || title;
    return template.content_html || buildDefaultPageHtml(applyTo, null);
  };

  const availableCreateTemplates = useMemo(() => (
    templates
      .filter(t => Boolean((t.content_html || t.apply_to || getTemplateTitle(t)).trim()))
      .map((template, index) => ({ template, index }))
  ), [templates]);

  const handleAddTemplateToCreate = (template: DocumentTemplate) => {
    const title = getTemplateTitle(template);
    const nextIndex = selectedCreatePages.length;

    setSelectedCreatePages(prev => [
      ...prev,
      {
        id: `${getTemplateId(template, nextIndex)}-${Date.now()}-${nextIndex}`,
        title,
        type: template.apply_to || 'custom_document',
        htmlTemplate: getTemplateRawHtml(template),
      },
    ]);
    setCurrentPage(nextIndex);
    setTemplateMenuOpen(false);
    setOrderPanelOpen(false);
  };

  const handleRemoveCurrentCreatePage = () => {
    if (selectedCreatePages.length === 0) {
      alert('No document pages to delete.');
      return;
    }

    const activeCreatePage = selectedCreatePages[currentPage] || selectedCreatePages[0];
    if (!window.confirm(`ลบหน้าเอกสาร "${activeCreatePage.title}" ออกจากชุดนี้ใช่ไหม?`)) return;

    const nextPages = selectedCreatePages.filter((_, index) => index !== currentPage);
    setSelectedCreatePages(nextPages);
    setCurrentPage(Math.max(0, Math.min(currentPage, nextPages.length - 1)));
  };

  const handleMoveCreatePage = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= selectedCreatePages.length) return;

    const nextPages = [...selectedCreatePages];
    [nextPages[index], nextPages[targetIndex]] = [nextPages[targetIndex], nextPages[index]];
    setSelectedCreatePages(nextPages);
    setCurrentPage(targetIndex);
  };

  const generatePagesHtml = (custSnap: Customer | null, rectSnap: Receipt | null, lostItems: string[]): RenderPage[] => {
    const customerData = custSnap || null;
    let receiptHtml = '';

    if (rectSnap) {
      const parsedItems = safeJsonParse < any[] > (rectSnap.items_json, (rectSnap as any).rental_items || []);
      const rows = parsedItems.map((item: any, idx: number) => {
        const itemKey = `${item.item_id || item.line_id || idx}_${idx}`;
        const isLost = lostItems.includes(itemKey);
        return `<tr><td>${idx + 1}</td><td>${item.item_name || item.receipt_name || '-'}</td><td style="text-align:center">${item.qty || 0}</td><td style="text-align:center">${isLost ? '<b>สูญหาย/ผิดสัญญา</b>' : 'ปกติ'}</td></tr>`;
      }).join('');

      const itemsTableHtml = `${plainA4Style}<div class="jrk-a4-doc"><h1>ใบเสร็จอ้างอิง ${rectSnap.receipt_no || ''}</h1><table><thead><tr><th>ลำดับ</th><th>รายการสินค้า</th><th>จำนวน</th><th>สถานะ</th></tr></thead><tbody>${rows || '<tr><td colspan="4" style="text-align:center">ไม่มีรายการสินค้า</td></tr>'}</tbody></table><p style="text-align:right;font-weight:900;margin-top:18px">ยอดรวม: ${(rectSnap.grand_total || rectSnap.debt_amount || 0).toLocaleString('th-TH')} บาท</p></div>`;

      const receiptTpl = templates.find(t => t.apply_to === 'ใบเสร็จรับเงิน' && t.is_default) || templates.find(t => t.apply_to === 'ใบเสร็จรับเงิน');
      if (receiptTpl?.content_html) {
        receiptHtml = replaceVariables(receiptTpl.content_html, customerData)
          .replace(/\{\{RECEIPT_NO\}\}/g, rectSnap.receipt_no || '')
          .replace(/\{\{RECEIPT_DATE\}\}/g, rectSnap.receipt_date || rectSnap.rent_date || '')
          .replace(/\{\{ITEMS_TABLE\}\}/g, itemsTableHtml)
          .replace(/\{\{GRAND_TOTAL\}\}/g, String(rectSnap.grand_total || rectSnap.debt_amount || 0));
      } else {
        receiptHtml = itemsTableHtml;
      }
    }

    const pages: RenderPage[] = templates
      .filter(t => Boolean((t.content_html || t.apply_to || getTemplateTitle(t)).trim()))
      .filter(t => t.apply_to !== 'ใบเสร็จรับเงิน')
      .map((template, index) => {
        const title = getTemplateTitle(template);
        const applyTo = template.apply_to || title;
        const html = template.content_html
          ? replaceVariables(template.content_html, customerData)
          : buildDefaultPageHtml(applyTo, customerData);

        return {
          title,
          type: applyTo || `template_${index + 1}`,
          html,
        };
      });

    if (rectSnap) pages.push({ title: 'ใบเสร็จรับเงิน', type: 'receipt', html: receiptHtml });
    return pages;
  };

  const createRenderPages = useMemo < RenderPage[] > (() => selectedCreatePages.map((page, index) => ({
    title: page.title || `เอกสาร ${index + 1}`,
    type: page.type || `custom_document_${index + 1}`,
    html: replaceVariables(page.htmlTemplate, currentCustomerSnapshot),
  })), [selectedCreatePages, currentCustomerSnapshot]);

  const parsedReceiptItems = useMemo(() => {
    if (!currentReceiptSnapshot) return [] as any[];
    return safeJsonParse < any[] > (currentReceiptSnapshot.items_json, (currentReceiptSnapshot as any).rental_items || []);
  }, [currentReceiptSnapshot]);

  const handleSaveContract = (isCombine: boolean) => {
    if (!selectedCustomerId) {
      alert('Please select a customer before saving.');
      return;
    }

    const pages = isCombine
      ? generatePagesHtml(currentCustomerSnapshot, currentReceiptSnapshot, selectedLostItems)
      : createRenderPages;

    if (pages.length === 0) {
      alert('Please add a document before saving the contract.');
      return;
    }

    const docData: Partial<ContractDocument> = {
      contract_name: isCombine ? 'ชุดเอกสารสัญญาเช่าพร้อมบิล' : 'สัญญาเช่ามาตรฐาน',
      customer_id: currentCustomerSnapshot?.customer_id || '',
      customer_snapshot_json: JSON.stringify(currentCustomerSnapshot),
      receipt_id: isCombine && currentReceiptSnapshot ? currentReceiptSnapshot.receipt_id : '',
      receipt_snapshot_json: isCombine && currentReceiptSnapshot ? JSON.stringify(currentReceiptSnapshot) : '{}',
      selected_items_snapshot_json: isCombine ? JSON.stringify(selectedLostItems) : '[]',
      id_card_snapshot_json: '{}',
      signature_snapshot_json: '{}',
      acknowledgement_snapshot_json: '{}',
      status: 'created',
    };

    const savedDoc = editingContractId
      ? JirakitDB.updateContractDocument(editingContractId, docData)
      : JirakitDB.createContractDocument(docData);

    const pageRecords: Partial<ContractPage>[] = pages.map((p, idx) => ({
      contract_id: savedDoc.id,
      page_type: p.type,
      page_title: p.title,
      page_order: idx,
      content_html: p.html,
      source_snapshot_json: JSON.stringify({ type: p.type }),
    }));

    if (editingContractId && typeof (JirakitDB as any).replaceContractPages === 'function') {
      (JirakitDB as any).replaceContractPages(savedDoc.id, pageRecords);
    } else {
      JirakitDB.saveContractPages(pageRecords);
    }

    setSavedContractId(savedDoc.id);
    setEditingContractId(null);
    setActiveTab('preview');
    setCurrentPage(0);
    loadData();
    alert(editingContractId ? 'แก้ไขสัญญาเรียบร้อยแล้ว' : 'บันทึกสัญญาเรียบร้อยแล้ว');
  };

  const getSavedPages = (docId: string | null, includeReceipt: boolean) => {
    if (!docId) return [] as RenderPage[];
    const doc = JirakitDB.getContractDocument(docId);
    if (!doc) return [] as RenderPage[];
    const savedPages = JirakitDB.getContractPagesByContractId(docId).map(p => ({
      title: p.page_title,
      type: p.page_type,
      html: p.content_html,
    }));
    const pages = savedPages.length > 0
      ? savedPages
      : generatePagesHtml(
        safeJsonParse < Customer | null > (doc.customer_snapshot_json, null),
        safeJsonParse < Receipt | null > (doc.receipt_snapshot_json, null),
        safeJsonParse < string[] > (doc.selected_items_snapshot_json, []),
      );
    return includeReceipt ? pages : pages.filter(p => p.type !== 'receipt' && !p.title.includes('ใบเสร็จ'));
  };

  const getReceiptOnlyPages = (customerData: Customer | null, receiptData: Receipt | null) => {
    if (!receiptData) return [] as RenderPage[];
    return generatePagesHtml(customerData, receiptData, selectedLostItems)
      .filter(page => page.type === 'receipt' || page.title.includes('ใบเสร็จ'));
  };

  const pagesToRender = useMemo(() => {
    if (activeTab === 'create') return createRenderPages;
    if (activeTab === 'preview') {
      if (savedContractId) return getSavedPages(savedContractId, false);
      if (previewSelectedCustomerId) {
        return contractDocs
          .filter(doc => doc.customer_id === previewSelectedCustomerId)
          .flatMap(doc => getSavedPages(doc.id, false));
      }
      return [] as RenderPage[];
    }
    if (activeTab === 'combine') {
      const savedPages = selectedCustomerId
        ? contractDocs
          .filter(doc => doc.customer_id === selectedCustomerId)
          .flatMap(doc => getSavedPages(doc.id, false))
        : [];
      const receiptPages = currentReceiptSnapshot
        ? getReceiptOnlyPages(currentCustomerSnapshot, currentReceiptSnapshot)
        : [];
      return [...savedPages, ...receiptPages];
    }
    return [] as RenderPage[];
  }, [activeTab, createRenderPages, currentCustomerSnapshot, currentReceiptSnapshot, selectedLostItems, savedContractId, previewSelectedCustomerId, selectedCustomerId, templates, contractDocs]);
  useEffect(() => {
    if (currentPage >= pagesToRender.length) setCurrentPage(Math.max(0, pagesToRender.length - 1));
  }, [pagesToRender.length, currentPage]);

  const contractRows = useMemo(() => {
    const q = normalize(listSearch);
    return contractDocs
      .map(doc => {
        const customer = getSnapshotCustomer(doc);
        const pages = JirakitDB.getContractPagesByContractId(doc.id);
        return {
          doc,
          customer,
          pages,
          name: customerDisplayName(customer),
          missing: getMissingCustomerFields(customer),
          search: `${doc.contract_no} ${doc.contract_name} ${getCustomerSearchText(customer)}`,
        };
      })
      .filter(row => !q || normalize(row.search).includes(q));
  }, [contractDocs, customers, listSearch]);

  const previewContractOptions = useMemo(() => {
    const q = normalize(previewSearch);
    return contractDocs
      .map(doc => ({ doc, customer: getSnapshotCustomer(doc) }))
      .filter(row => !q || normalize(`${row.doc.contract_no} ${getCustomerSearchText(row.customer)}`).includes(q))
      .slice(0, 10);
  }, [contractDocs, customers, previewSearch]);

  const previewCustomerOptions = useMemo(() => {
    const q = normalize(previewSearch);
    if (!q) return [];
    return customers
      .filter(c => c.customer_status !== 'Deleted')
      .filter(c => normalize(getCustomerSearchText(c)).includes(q))
      .slice(0, 10);
  }, [customers, previewSearch]);

  const selectPreviewCustomer = (customer: Customer) => {
    setPreviewSelectedCustomerId(customer.customer_id);
    setPreviewSearch(customer.customer_name || '');
    setSavedContractId(null);
    setActiveTab('preview');
    setCurrentPage(0);
  };

  const viewDocument = (doc: ContractDocument) => {
    const customer = getSnapshotCustomer(doc);
    setPreviewSelectedCustomerId(customer.customer_id || doc.customer_id || '');
    setSavedContractId(doc.id);
    setPreviewSearch(customerDisplayName(customer));
    setActiveTab('preview');
    setCurrentPage(0);
  };

  const closePreviewDocument = () => {
    setSavedContractId(null);
    setPreviewSelectedCustomerId('');
    setCurrentPage(0);
  };

  const editDocument = (doc: ContractDocument) => {
    if (!isOwner) {
      alert('Only the system owner can edit this.');
      return;
    }
    const customer = getSnapshotCustomer(doc);
    const savedPages = JirakitDB.getContractPagesByContractId(doc.id)
      .sort((a, b) => ((a as any).page_order || 0) - ((b as any).page_order || 0));

    setEditingContractId(doc.id);
    setSelectedCustomerId(doc.customer_id);
    setCurrentCustomerSnapshot(customer);
    setCreateCustomerSearch(customerDisplayName(customer));
    setSelectedCreatePages(savedPages.map((page, index) => ({
      id: `${(page as any).id || page.page_type || 'saved'}-${index}`,
      title: page.page_title || `เอกสาร ${index + 1}`,
      type: page.page_type || `saved_document_${index + 1}`,
      htmlTemplate: page.content_html || '',
    })));
    setTemplateMenuOpen(false);
    setOrderPanelOpen(false);
    setActiveTab('create');
    setCurrentPage(0);
  };

  const deleteDocument = (doc: ContractDocument) => {
    if (!isOwner) {
      alert('Only the system owner can delete this.');
      return;
    }
    if (!window.confirm(`ยืนยันลบสัญญา ${doc.contract_no || ''} ใช่ไหม?`)) return;
    JirakitDB.deleteContractDocument(doc.id);
    if (savedContractId === doc.id) setSavedContractId(null);
    loadData();
  };

  const buildCurrentContractExportElement = () => {
    const page = pagesToRender[currentPage];
    if (!page) return null;

    const element = document.createElement('div');
    Object.assign(element.style, {
      position: 'fixed',
      top: '0',
      left: '-10000px',
      width: '210mm',
      minHeight: '297mm',
      overflow: 'hidden',
      backgroundColor: '#ffffff',
      color: '#111827',
      padding: '32px',
      boxSizing: 'border-box',
      fontFamily: 'Sarabun, system-ui, sans-serif',
      pointerEvents: 'none',
      zIndex: '-1',
    });
    element.innerHTML = page.html || '<div style="padding:40px;text-align:center;">ไม่มีเนื้อหาเอกสาร</div>';
    document.body.appendChild(element);

    const safeTitle = (page.title || 'CONTRACT').replace(/[^a-zA-Z0-9ก-๙_-]+/g, '-');
    return { element, prefix: `CONTRACT-${safeTitle}`, cleanup: () => element.remove() };
  };

  const handlePrintCurrentContractPage = () => {
    const prepared = buildCurrentContractExportElement();
    if (!prepared) { alert('No document pages to print.'); return; }
    printA4Element(prepared.element, false, 'A4');
    window.setTimeout(prepared.cleanup, 1500);
  };

  const handleExportCurrentContractImage = async () => {
    const prepared = buildCurrentContractExportElement();
    if (!prepared) { alert('No document pages to save as image.'); return; }
    try {
      await exportA4ToImage({ element: prepared.element, prefix: prepared.prefix, paperSize: 'A4' });
    } finally {
      prepared.cleanup();
    }
  };

  const handleExportCurrentContractPdf = async () => {
    const prepared = buildCurrentContractExportElement();
    if (!prepared) { alert('No document pages to create PDF.'); return; }
    try {
      await exportA4ToPdf({ element: prepared.element, prefix: prepared.prefix, paperSize: 'A4' });
    } finally {
      prepared.cleanup();
    }
  };

  const buildContractExportElementFromPage = (page: RenderPage) => {
    const element = document.createElement('div');
    Object.assign(element.style, {
      position: 'fixed',
      top: '0',
      left: '-10000px',
      width: '210mm',
      minHeight: '297mm',
      overflow: 'hidden',
      backgroundColor: '#ffffff',
      color: '#111827',
      padding: '32px',
      boxSizing: 'border-box',
      fontFamily: 'Sarabun, system-ui, sans-serif',
      pointerEvents: 'none',
      zIndex: '-1',
    });
    element.innerHTML = page.html || '<div style="padding:40px;text-align:center;">ไม่มีเนื้อหาเอกสาร</div>';
    document.body.appendChild(element);
    return element;
  };

  const buildVisiblePagesExportElements = () => {
    if (pagesToRender.length === 0) return null;

    const elements = pagesToRender.map(page => buildContractExportElementFromPage(page));
    const customerName = currentCustomerSnapshot?.customer_name?.trim();
    const prefix = customerName || 'รวมเอกสาร';

    return {
      elements,
      prefix,
      cleanup: () => elements.forEach(element => element.remove()),
    };
  };

  const handleExportVisiblePagesPdf = async () => {
    const prepared = buildVisiblePagesExportElements();
    if (!prepared) { alert('No document to save as PDF.'); return; }

    try {
      await exportA4PagesToPdf({ elements: prepared.elements, prefix: prepared.prefix, paperSize: 'A4' });
    } finally {
      prepared.cleanup();
    }
  };

  const handleExportVisiblePagesImages = async () => {
    const prepared = buildVisiblePagesExportElements();
    if (!prepared) { alert('No document to save as image.'); return; }

    try {
      await exportA4PagesToImages({ elements: prepared.elements, prefix: prepared.prefix, paperSize: 'A4' });
    } finally {
      prepared.cleanup();
    }
  };

  const handlePrintVisiblePages = () => {
    const prepared = buildVisiblePagesExportElements();
    if (!prepared) { alert('No document to print.'); return; }

    printA4Elements(prepared.elements, false, 'A4');
    window.setTimeout(prepared.cleanup, 1500);
  };

  const handleClearCombineData = () => {
    setSelectedCustomerId('');
    setSelectedReceiptId('');
    setSelectedLostItems([]);
    setCurrentCustomerSnapshot(null);
    setCurrentReceiptSnapshot(null);
    setCombineCustomerSearch('');
    setCurrentPage(0);
    setCombineReceiptModalOpen(false);
    setReceiptPreviewSnapshot(null);
    setReceiptPreviewCloseCount(0);
  };

  const handleSelectCombineReceipt = (receiptId: string) => {
    handleReceiptChange(receiptId);
    setCombineReceiptModalOpen(false);
  };

  const handleOpenReceiptPreview = (receipt: Receipt) => {
    setReceiptPreviewSnapshot(JSON.parse(JSON.stringify(receipt)) as Receipt);
    setReceiptPreviewCloseCount(0);
  };

  const handleReceiptPreviewCloseClick = () => {
    setReceiptPreviewCloseCount(prev => {
      if (prev >= 1) {
        setReceiptPreviewSnapshot(null);
        return 0;
      }
      return prev + 1;
    });
  };

  const CustomerSearchBox = ({
    mode,
    value,
    onValueChange,
    label,
    inputClassName = '',
  }: {
    mode: CustomerSuggestionMode;
    value: string;
    onValueChange: (value: string) => void;
    label?: string;
    inputClassName?: string;
  }) => {
    const suggestions = filteredCustomers(value);
    return (
      <div className="relative min-w-0">
        <Input
          {...(label ? { label } : {})}
          value={value}
          onChange={e => onValueChange(e.target.value)}
          icon={<Search size={16} />}
          placeholder="ชื่อ,เบอร์โทร,เลขบัตร"
          className={inputClassName}
        />
        {value.trim() && suggestions.length > 0 && (
          <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-[var(--ui-radius-card)] bg-[var(--ui-surface)] shadow-xl ring-1 ring-[var(--ui-border)]">
            {suggestions.map(customer => (
              <Button variant="ghost"
                key={customer.customer_id}
                type="button"
                onClick={() => selectCustomer(customer, mode)}
                className="flex w-full flex-col items-start justify-start rounded-none border-0 px-4 py-3 text-left text-[length:var(--ui-font-button)] font-bold text-[var(--text-main)] shadow-none hover:bg-[var(--app-bg)]"
              >
                <span className="block">{customer.customer_name || 'ไม่ระบุชื่อ'}</span>
                <span className="block text-[length:var(--ui-font-label)] text-[var(--text-soft)]">{customer.phone || '-'} / {customer.delivery_location || customer.current_worksite || customer.address || '-'}</span>
              </Button>
            ))}
          </div>
        )}
      </div>
    );
  };

  const ContractExportButtons = ({ disabled = false }: { disabled?: boolean }) => (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={disabled}
        onClick={handleExportCurrentContractPdf}
        className="h-[var(--ui-control-h)] shrink-0 rounded-[var(--ui-radius-card)] px-2 text-[length:var(--ui-font-label)] font-extrabold whitespace-nowrap"
      >
        <FileDown size={13} /> PDF
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={disabled}
        onClick={handlePrintCurrentContractPage}
        className="h-[var(--ui-control-h)] shrink-0 rounded-[var(--ui-radius-card)] px-2 text-[length:var(--ui-font-label)] font-extrabold whitespace-nowrap"
      >
        <Printer size={13} /> พิมพ์
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={disabled}
        onClick={handleExportCurrentContractImage}
        className="h-[var(--ui-control-h)] shrink-0 rounded-[var(--ui-radius-card)] px-2 text-[length:var(--ui-font-label)] font-extrabold whitespace-nowrap"
      >
        <ImageIcon size={13} /> ภาพ
      </Button>
    </>
  );

  const PageViewer = ({
    pages,
    emptyText,
    showActions = true,
    standbyA4 = false,
    paperOffsetClass = '',
  }: {
    pages: RenderPage[];
    emptyText: string;
    showActions?: boolean;
    standbyA4?: boolean;
    paperOffsetClass?: string;
  }) => {
    if (pages.length === 0) {
      if (standbyA4) {
        return (
          <div className={`relative flex min-h-0 flex-1 items-start justify-center overflow-auto bg-transparent p-0 ${paperOffsetClass}`}>
            <div className="h-[297mm] w-[210mm] shrink-0 overflow-hidden bg-white p-[12mm] text-[#111827]">
              <div className="h-full w-full text-[length:var(--ui-font-button)]" style={{ fontFamily: 'Sarabun, sans-serif' }}>
                <h1 className="mb-6 text-center text-2xl font-black">รายการเอกสาร</h1>
                <ol className="space-y-3 pl-6 text-base font-bold text-[#111827]">
                  <li>{emptyText}</li>
                  <li>เลือกเอกสารจากปุ่มเพิ่มเอกสาร</li>
                  <li>เอกสารที่เลือกจะแสดงบนกระดาษ A4 หน้านี้</li>
                  <li>ยังไม่มีการล็อคหน้าเอกสารไว้ล่วงหน้า</li>
                </ol>
              </div>
            </div>
          </div>
        );
      }

      return (
        <div className="flex min-h-[360px] items-center justify-center rounded-[var(--ui-radius-card)] bg-[var(--ui-surface)] p-[var(--ui-card-pad)] text-center">
          <div>
            <AlertTriangle size={42} className="mx-auto mb-3 text-[var(--ui-warning)]" />
            <h2 className="text-lg font-black text-[var(--text-main)]">{emptyText}</h2>
            <p className="mt-1 text-[length:var(--ui-font-button)] font-bold text-[var(--text-soft)]">ค้นหา/เลือกลูกค้า หรือบันทึกเอกสารก่อนดูตัวอย่าง</p>
          </div>
        </div>
      );
    }

    const goPrev = () => setCurrentPage(p => Math.max(0, p - 1));
    const goNext = () => setCurrentPage(p => Math.min(pages.length - 1, p + 1));
    const activePage = pages[currentPage] || pages[0];
    const handleA4Click = (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const isRightSide = clickX > rect.width / 2;

      if (isRightSide) {
        goNext();
      } else {
        goPrev();
      }
    };

    return (
      <div className="flex h-full min-h-0 flex-col gap-[var(--ui-gap-button)]">
        {showActions && (
          <ContractExportButtons disabled={pages.length === 0} />
        )}

        <div
          className={`relative flex min-h-0 flex-1 items-start justify-center overflow-auto bg-transparent p-0 ${paperOffsetClass}`}
          onTouchStart={e => setTouchStartX(e.touches[0]?.clientX ?? null)}
          onTouchEnd={e => {
            if (touchStartX == null) return;
            const diff = touchStartX - (e.changedTouches[0]?.clientX ?? touchStartX);
            if (diff > 40) goNext();
            if (diff < -40) goPrev();
            setTouchStartX(null);
          }}
        >
          <div
            className="h-[297mm] w-[210mm] shrink-0 cursor-pointer select-none overflow-hidden bg-white p-[12mm] text-[#111827]"
            onClick={handleA4Click}
            onTouchStart={e => setTouchStartX(e.touches[0]?.clientX ?? null)}
            onTouchEnd={e => {
              if (touchStartX == null) return;
              const diff = touchStartX - (e.changedTouches[0]?.clientX ?? touchStartX);

              if (diff > 40) goNext();
              if (diff < -40) goPrev();

              setTouchStartX(null);
            }}
          >
            <div
              className="h-full w-full overflow-hidden text-[length:var(--ui-font-button)]"
              style={{ fontFamily: 'Sarabun, sans-serif' }}
              dangerouslySetInnerHTML={{ __html: activePage.html || '' }}
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-2rem)] w-full max-w-full flex-col overflow-hidden text-[var(--text-main)]">
      <div className="shrink-0">
        <h2 className="text-3xl font-black text-[var(--text-main)] flex items-center gap-[var(--ui-gap-button)]">
          <FileSignature size={30} className="shrink-0" />
          สัญญาเช่า / เอกสารสัญญา
        </h2>
      </div>

      {/* Contract Tabs */}
      <div className="mt-4 grid w-full max-w-full shrink-0 grid-cols-4 gap-[var(--ui-gap-button)]">
        <Button
          type="button"
          variant={activeTab === 'list' ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => {
            setActiveTab('list');
            setCurrentPage(0);
          }}
          className="h-[var(--ui-button-h)] w-full rounded-full px-3 text-[length:var(--ui-font-button)] font-extrabold whitespace-nowrap"
        >
          <ListChecks size={16} /> รายชื่อสัญญา
        </Button>
        <Button
          type="button"
          variant={activeTab === 'create' ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => {
            setActiveTab('create');
            setCurrentPage(0);
          }}
          className="h-[var(--ui-button-h)] w-full rounded-full px-3 text-[length:var(--ui-font-button)] font-extrabold whitespace-nowrap"
        >
          <FileSignature size={16} /> ทำสัญญา
        </Button>
        <Button
          type="button"
          variant={activeTab === 'preview' ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => {
            setActiveTab('preview');
            setCurrentPage(0);
          }}
          className="h-[var(--ui-button-h)] w-full rounded-full px-3 text-[length:var(--ui-font-button)] font-extrabold whitespace-nowrap"
        >
          <FileText size={16} /> ดูเอกสารตัวอย่าง
        </Button>
        <Button
          type="button"
          variant={activeTab === 'combine' ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => {
            setActiveTab('combine');
            setCurrentPage(0);
          }}
          className="h-[var(--ui-button-h)] w-full rounded-full px-3 text-[length:var(--ui-font-button)] font-extrabold whitespace-nowrap"
        >
          <Layers size={16} /> รวมเอกสาร
        </Button>
      </div>

      <div className="mt-5 min-h-0 flex-1 overflow-hidden bg-transparent p-0">
        {activeTab === 'list' && (
          <section className="flex h-full min-h-0 flex-col gap-[var(--ui-gap-button)]">
            {/* Search + New Contract Button: shown only in the list tab */}
            <div className="flex w-full max-w-full shrink-0 items-center justify-start gap-[var(--ui-gap-button)] overflow-visible">
              <div className="relative w-[273px] shrink-0">
                <Input
                  value={listSearch}
                  onChange={e => setListSearch(e.target.value)}
                  icon={<Search size={16} />}
                  placeholder="ค้นหา ชื่อลูกค้า,เบอร์โทร,เลขสัญญา"
                  className="h-[var(--ui-button-h)] w-full text-[length:var(--ui-font-button)] placeholder:text-[length:var(--ui-font-button)]"
                />
              </div>

              <Button
                type="button"
                variant="primary"
                onClick={() => {
                  setActiveTab('create');
                  setEditingContractId(null);
                  setSelectedCreatePages([]);
                  setCreateCustomerSearch('');
                  setSelectedCustomerId('');
                  setCurrentCustomerSnapshot(null);
                  setCurrentReceiptSnapshot(null);
                  setCurrentPage(0);
                }}
                className="h-[var(--ui-button-h)] w-[220px] shrink-0 rounded-[var(--ui-radius-card)] px-4 font-extrabold whitespace-nowrap"
              >
                <FileSignature size={16} /> ทำสัญญาใหม่
              </Button>
            </div>

            <div className="min-h-0 flex-1 overflow-auto bg-[var(--ui-surface)] border border-[var(--ui-border)] rounded-[26px] shadow-none">
              <DataTable wrapperClassName="h-full border-0 bg-transparent shadow-none" className="w-full table-fixed border-collapse text-[length:var(--ui-font-button)]">
                <colgroup>
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '25%' }} />
                  <col style={{ width: '40%' }} />
                  <col style={{ width: '25%' }} />
                </colgroup>

                <thead className="sticky top-0 z-10 bg-[var(--ui-surface)]">
                  <tr className="text-[length:var(--ui-font-label)] font-black uppercase tracking-wider text-[var(--text-main)] border-b border-[var(--ui-border)]">
                    <th className="px-4 py-3" style={{ textAlign: 'center' }}>
                      <div className="flex w-full items-center justify-center text-center">
                        ลำดับ
                      </div>
                    </th>

                    <th className="px-4 py-3" style={{ textAlign: 'center' }}>
                      <div className="flex w-full items-center justify-center text-center">
                        รายชื่อ
                      </div>
                    </th>

                    <th className="px-4 py-3" style={{ textAlign: 'center' }}>
                      <div className="flex w-full items-center justify-center text-center">
                        ข้อมูล
                      </div>
                    </th>

                    <th className="px-4 py-3" style={{ textAlign: 'center' }}>
                      <div className="flex w-full items-center justify-center text-center">
                        จัดการ
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--ui-border)] text-[var(--text-main)]">
                  {contractRows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-12 text-center text-[length:var(--ui-font-button)] font-bold text-[var(--text-soft)]">
                        ยังไม่มีรายชื่อสัญญา หรือไม่พบข้อมูลตามคำค้นหา
                      </td>
                    </tr>
                  ) : contractRows.map((row, index) => (
                    <tr key={row.doc.id} className="align-top hover:bg-[var(--app-bg)]">
                      <td className="px-4 py-4 font-black">{index + 1}</td>
                      <td className="px-4 py-4">
                        <div className="font-black text-[var(--text-main)]">{row.name}</div>
                        <div className="mt-1 text-[length:var(--ui-font-label)] font-bold text-[var(--text-soft)]">{row.doc.contract_no} ยท {thaiDate(row.doc.created_at)}</div>
                        <div className="mt-1 text-[length:var(--ui-font-label)] font-bold text-[var(--text-soft)]">{row.customer?.phone || '-'}</div>
                      </td>
                      <td className="px-4 py-4">
                        {row.missing.length === 0 ? (
                          <div className="inline-flex items-center gap-[var(--ui-gap-button)] rounded-[var(--ui-radius-card)] bg-[color-mix(in_srgb,var(--ui-success)_12%,var(--ui-surface))] px-3 py-2 font-black text-[var(--text-main)]">
                            <CheckCircle2 size={16} className="text-[var(--ui-success)]" /> ข้อมูลครบ
                          </div>
                        ) : (
                          <div className="space-y-1 rounded-[var(--ui-radius-card)] bg-[color-mix(in_srgb,var(--ui-danger)_8%,var(--ui-surface))] px-3 py-2 font-bold text-[var(--text-main)]">
                            <div className="flex items-center gap-[var(--ui-gap-button)] font-black"><XCircle size={16} className="text-[var(--ui-danger)]" /> ข้อมูลไม่ครบ</div>
                            {row.missing.map(item => <div key={item} className="pl-6 text-[length:var(--ui-font-label)]">- {item}</div>)}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap justify-center gap-[var(--ui-gap-button)]">
                          <Button type="button" variant="secondary" size="sm" onClick={() => viewDocument(row.doc)}><Eye size={14} /> ดู</Button>
                          <Button type="button" variant="secondary" size="sm" onClick={() => editDocument(row.doc)} disabled={!isOwner}><Edit3 size={14} /> แก้ไข</Button>
                          <Button type="button" variant="danger" size="sm" onClick={() => deleteDocument(row.doc)} disabled={!isOwner}><Trash2 size={14} /> ลบ</Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            </div>
          </section>
        )}

        {activeTab === 'create' && (
          <section className="contents">
            <div className="space-y-3 overflow-visible bg-transparent p-0">
              <div className="flex w-full max-w-full shrink-0 flex-nowrap items-center gap-[var(--ui-gap-button)] overflow-visible">
                <div className="relative w-[260px] shrink-0">
                  <CustomerSearchBox
                    mode="create"
                    value={createCustomerSearch}
                    onValueChange={setCreateCustomerSearch}
                    inputClassName="h-[var(--ui-control-h)] w-full text-[length:var(--ui-font-button)] placeholder:text-[length:var(--ui-font-button)]"
                  />
                </div>

                <div className="relative min-w-0 flex-1">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setTemplateMenuOpen(prev => !prev);
                      setOrderPanelOpen(false);
                    }}
                    className="h-[var(--ui-control-h)] w-full rounded-[var(--ui-radius-card)] px-2 text-[length:var(--ui-font-label)] font-extrabold whitespace-nowrap"
                  >
                    <FileText size={13} /> เพิ่มเอกสาร
                  </Button>
                  {templateMenuOpen && (
                    <div className="absolute left-0 z-30 mt-1 max-h-72 w-[320px] overflow-auto rounded-[var(--ui-radius-card)] bg-[var(--ui-surface)] shadow-xl ring-1 ring-[var(--ui-border)]">
                      {availableCreateTemplates.length === 0 ? (
                        <div className="px-4 py-3 text-[length:var(--ui-font-button)] font-bold text-[var(--text-soft)]">ยังไม่มีเอกสารในระบบ</div>
                      ) : availableCreateTemplates.map(({ template, index }) => (
                        <Button variant="ghost"
                          key={getTemplateId(template, index)}
                          type="button"
                          onClick={() => handleAddTemplateToCreate(template)}
                          className="flex w-full flex-col items-start justify-start rounded-none border-0 px-4 py-3 text-left text-[length:var(--ui-font-button)] font-bold text-[var(--text-main)] shadow-none hover:bg-[var(--app-bg)]"
                        >
                          <span className="block">{getTemplateTitle(template)}</span>
                          <span className="block text-[length:var(--ui-font-label)] text-[var(--text-soft)]">{template.apply_to || 'เอกสารทั่วไป'}</span>
                        </Button>
                      ))}
                    </div>
                  )}
                </div>

                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  onClick={handleRemoveCurrentCreatePage}
                  disabled={selectedCreatePages.length === 0}
                  className="h-[var(--ui-control-h)] min-w-0 flex-1 rounded-[var(--ui-radius-card)] px-2 text-[length:var(--ui-font-label)] font-extrabold whitespace-nowrap"
                >
                  <Trash2 size={13} /> ลบ
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setOrderPanelOpen(prev => !prev);
                    setTemplateMenuOpen(false);
                  }}
                  disabled={selectedCreatePages.length === 0}
                  className="h-[var(--ui-control-h)] min-w-0 flex-1 rounded-[var(--ui-radius-card)] px-2 text-[length:var(--ui-font-label)] font-extrabold whitespace-nowrap"
                >
                  <Layers size={13} /> จัดลำดับเอกสาร
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => handleSaveContract(false)}
                  disabled={!currentCustomerSnapshot || selectedCreatePages.length === 0}
                  className="h-[var(--ui-control-h)] w-[112px] shrink-0 rounded-[var(--ui-radius-card)] px-2 text-[length:var(--ui-font-label)] font-extrabold whitespace-nowrap"
                >
                  <Save size={13} /> {editingContractId ? 'บันทึกแก้ไข' : 'บันทึก'}
                </Button>
              </div>

              <div className="w-full max-w-full rounded-[var(--ui-radius-card)] bg-transparent p-0 text-[length:var(--ui-font-label)] font-bold text-[var(--text-soft)]">
                <span className="font-black text-[var(--text-main)]">รายการเอกสาร:</span>{' '}
                {selectedCreatePages.length === 0 ? (
                  <span>ยังไม่มีเอกสารที่เลือก</span>
                ) : (
                  <span>{selectedCreatePages.map((page, index) => `${index + 1}. ${page.title}`).join(' / ')}</span>
                )}
              </div>

              {orderPanelOpen && (
                <div className="w-full max-w-full rounded-[var(--ui-radius-card)] bg-[var(--ui-surface)] p-[var(--ui-card-pad-sm)] shadow-none ring-1 ring-[var(--ui-border)]">
                  <div className="mb-2 text-[length:var(--ui-font-button)] font-black text-[var(--text-main)]">จัดลำดับหน้าเอกสาร</div>
                  <div className="space-y-2">
                    {selectedCreatePages.map((page, index) => (
                      <div key={page.id} className="flex items-center gap-[var(--ui-gap-button)] rounded-[var(--ui-radius-card)] bg-[var(--app-bg)] px-3 py-2 text-[length:var(--ui-font-button)] font-bold text-[var(--text-main)]">
                        <span className="w-8 shrink-0 text-center font-black">{index + 1}</span>
                        <span className="min-w-0 flex-1 truncate">{page.title}</span>
                        <Button type="button" variant="secondary" size="sm" onClick={() => handleMoveCreatePage(index, -1)} disabled={index === 0} className="h-8 px-3 text-[length:var(--ui-font-label)]">ขึ้น</Button>
                        <Button type="button" variant="secondary" size="sm" onClick={() => handleMoveCreatePage(index, 1)} disabled={index === selectedCreatePages.length - 1} className="h-8 px-3 text-[length:var(--ui-font-label)]">ลง</Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {currentCustomerSnapshot && (
                <div className="w-full bg-transparent p-0 text-[length:var(--ui-font-button)] font-bold leading-relaxed">
                  <div className="font-black text-[var(--text-main)]">{currentCustomerSnapshot.customer_name}</div>
                  <div className="text-[var(--text-soft)]">{currentCustomerSnapshot.phone || '-'}</div>
                  <div className="text-[var(--text-soft)]">{currentCustomerSnapshot.address || currentCustomerSnapshot.registered_address || '-'}</div>
                  <div className="text-[var(--text-soft)]">ไซต์งาน: {currentCustomerSnapshot.delivery_location || currentCustomerSnapshot.current_worksite || '-'}</div>
                </div>
              )}

              {editingContractId && <p className="text-[length:var(--ui-font-label)] font-bold text-[var(--ui-warning)]">กำลังแก้ไขสัญญาเดิม กดบันทึกเพื่อแทนที่เอกสารชุดนี้</p>}
            </div>

            <PageViewer
              pages={pagesToRender}
              emptyText="สแตนบายรอเอกสารที่เลือกมาแสดง"
              showActions={false}
              standbyA4
              paperOffsetClass="pt-4"
            />
          </section>
        )}

        {activeTab === 'preview' && (
          <section className="flex h-full min-h-0 flex-col gap-[var(--ui-gap-button)] overflow-visible">
            <div className="flex w-full max-w-full shrink-0 items-start gap-[var(--ui-gap-button)] overflow-visible">
              <div className="relative w-[360px] shrink-0">
                <Input
                  value={previewSearch}
                  onChange={e => {
                    setPreviewSearch(e.target.value);
                    setSavedContractId(null);
                    setPreviewSelectedCustomerId('');
                    setCurrentPage(0);
                  }}
                  icon={<Search size={16} />}
                  placeholder="ค้นหาชื่อลูกค้า"
                  className="h-[var(--ui-button-h)] w-full text-[length:var(--ui-font-button)] placeholder:text-[length:var(--ui-font-button)]"
                />

                {previewSearch.trim() && previewCustomerOptions.length > 0 && (
                  <div className="absolute left-0 z-30 mt-1 max-h-72 w-full overflow-auto rounded-[var(--ui-radius-card)] bg-[var(--ui-surface)] shadow-xl ring-1 ring-[var(--ui-border)]">
                    {previewCustomerOptions.map(customer => (
                      <Button variant="ghost"
                        key={customer.customer_id}
                        type="button"
                        onClick={() => selectPreviewCustomer(customer)}
                        className="flex w-full flex-col items-start justify-start rounded-none border-0 px-4 py-3 text-left text-[length:var(--ui-font-button)] font-bold text-[var(--text-main)] shadow-none hover:bg-[var(--app-bg)]"
                      >
                        <span className="block">{customer.customer_name || 'ไม่ระบุชื่อ'}</span>
                        <span className="block text-[length:var(--ui-font-label)] text-[var(--text-soft)]">{customer.phone || '-'}</span>
                      </Button>
                    ))}
                  </div>
                )}
              </div>

              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={closePreviewDocument}
                className="h-[var(--ui-button-h)] w-auto shrink-0 rounded-[var(--ui-radius-card)] px-4 text-[length:var(--ui-font-button)] font-extrabold whitespace-nowrap"
              >
                ปิดแสดงตัวอย่าง
              </Button>
            </div>

            <PageViewer
              pages={pagesToRender}
              emptyText="สแตนบายรอเอกสารจากลูกค้าที่เลือก"
              standbyA4
              paperOffsetClass="pt-0"
            />
          </section>
        )}

        {activeTab === 'combine' && (
          <section className="flex h-full min-h-0 flex-col gap-[var(--ui-gap-button)] overflow-visible">
            <div className="flex w-full max-w-full shrink-0 flex-nowrap items-center gap-[var(--ui-gap-button)] overflow-visible">
              <div className="relative w-[230px] shrink-0">
                <CustomerSearchBox
                  mode="combine"
                  value={combineCustomerSearch}
                  onValueChange={setCombineCustomerSearch}
                  inputClassName="h-[var(--ui-control-h)] w-full text-[length:var(--ui-font-button)] placeholder:text-[length:var(--ui-font-button)]"
                />
              </div>

              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setCombineReceiptModalOpen(true)}
                disabled={!currentCustomerSnapshot}
                className="h-[var(--ui-control-h)] w-[120px] shrink-0 rounded-[var(--ui-radius-card)] px-2 text-[length:var(--ui-font-label)] font-extrabold whitespace-nowrap"
              >
                <ListChecks size={13} /> เลือกบิลลูกค้า
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleExportVisiblePagesPdf}
                disabled={pagesToRender.length === 0}
                className="h-[var(--ui-control-h)] min-w-0 flex-1 rounded-[var(--ui-radius-card)] px-2 text-[length:var(--ui-font-label)] font-extrabold whitespace-nowrap"
              >
                <FileDown size={13} /> บันทึก PDF
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleExportVisiblePagesImages}
                disabled={pagesToRender.length === 0}
                className="h-[var(--ui-control-h)] min-w-0 flex-1 rounded-[var(--ui-radius-card)] px-2 text-[length:var(--ui-font-label)] font-extrabold whitespace-nowrap"
              >
                <ImageIcon size={13} /> บันทึกภาพ
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handlePrintVisiblePages}
                disabled={pagesToRender.length === 0}
                className="h-[var(--ui-control-h)] min-w-0 flex-1 rounded-[var(--ui-radius-card)] px-2 text-[length:var(--ui-font-label)] font-extrabold whitespace-nowrap"
              >
                <Printer size={13} /> ปริ้นเอกสาร
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={handleClearCombineData}
                className="h-[var(--ui-control-h)] w-[90px] shrink-0 rounded-[var(--ui-radius-card)] px-2 text-[length:var(--ui-font-label)] font-extrabold whitespace-nowrap"
              >
                <XCircle size={13} /> ล้างข้อมูล
              </Button>
            </div>

            <PageViewer
              pages={pagesToRender}
              emptyText="สแตนบายรอลูกค้าและเอกสารรวม"
              showActions={false}
              standbyA4
              paperOffsetClass="pt-0"
            />

            {combineReceiptModalOpen && (
              <div className="fixed inset-0 z-40 flex items-center justify-center bg-[var(--ui-overlay)] p-[var(--ui-card-pad)]">
                <div className="flex max-h-[90dvh] w-full max-w-[820px] flex-col overflow-hidden rounded-[var(--ui-radius-card)] bg-[var(--ui-surface)] shadow-xl ring-1 ring-[var(--ui-border)]">
                  <div className="flex shrink-0 items-center justify-between gap-[var(--ui-gap-button)] border-b border-[var(--ui-border)] px-4 py-3">
                    <div>
                      <h3 className="text-base font-black text-[var(--text-main)]">เลือกบิลลูกค้า</h3>
                      <p className="text-[length:var(--ui-font-label)] font-bold text-[var(--text-soft)]">แสดง 15 บิลล่าสุดของลูกค้าที่เลือก</p>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setCombineReceiptModalOpen(false)}
                      className="h-9 rounded-[var(--ui-radius-card)] px-3 text-[length:var(--ui-font-label)] font-extrabold"
                    >
                      ปิด
                    </Button>
                  </div>

                  <div className="min-h-0 flex-1 overflow-auto p-[var(--ui-card-pad-sm)]">
                    <DataTable wrapperClassName="h-full border-0 bg-transparent shadow-none" className="w-full table-fixed border-collapse text-[length:var(--ui-font-button)]">
                      <colgroup>
                        <col style={{ width: '9%' }} />
                        <col style={{ width: '28%' }} />
                        <col style={{ width: '30%' }} />
                        <col style={{ width: '18%' }} />
                        <col style={{ width: '15%' }} />
                      </colgroup>
                      <thead className="sticky top-0 z-10 bg-[var(--ui-surface)]">
                        <tr className="border-b border-[var(--ui-border)] text-[length:var(--ui-font-label)] font-black text-[var(--text-main)]">
                          <th className="px-2 py-3 text-center">ลำดับ</th>
                          <th className="px-2 py-3 text-center">ชื่อ</th>
                          <th className="px-2 py-3 text-center">สถานที่จัดส่ง</th>
                          <th className="px-2 py-3 text-center">วันที่</th>
                          <th className="px-2 py-3 text-center">จัดการ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--ui-border)]">
                        {combineReceiptRows.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-4 py-10 text-center text-[length:var(--ui-font-button)] font-bold text-[var(--text-soft)]">
                              ยังไม่มีบิลของลูกค้าคนนี้
                            </td>
                          </tr>
                        ) : combineReceiptRows.map((receipt, index) => (
                          <tr key={receipt.receipt_id} className="align-top hover:bg-[var(--app-bg)]">
                            <td className="px-2 py-3 text-center font-black">{index + 1}</td>
                            <td className="px-2 py-3 font-bold text-[var(--text-main)]">
                              <div className="font-black">{receipt.customer_name || currentCustomerSnapshot?.customer_name || '-'}</div>
                              <div className="text-[length:var(--ui-font-label)] text-[var(--text-soft)]">{receipt.receipt_no || '-'}</div>
                            </td>
                            <td className="px-2 py-3 text-[length:var(--ui-font-label)] font-bold text-[var(--text-soft)]">
                              {(receipt as any).delivery_location || (receipt as any).current_worksite || currentCustomerSnapshot?.delivery_location || currentCustomerSnapshot?.current_worksite || '-'}
                            </td>
                            <td className="px-2 py-3 text-center text-[length:var(--ui-font-label)] font-bold text-[var(--text-soft)]">{thaiDate(latestReceiptDate(receipt))}</td>
                            <td className="px-2 py-3">
                              <div className="flex justify-center gap-[var(--ui-gap-button)]">
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => handleOpenReceiptPreview(receipt)}
                                  className="h-9 w-9 rounded-[var(--ui-radius-card)] p-0"
                                >
                                  <Eye size={14} />
                                </Button>
                                <Button
                                  type="button"
                                  variant="primary"
                                  size="sm"
                                  onClick={() => handleSelectCombineReceipt(receipt.receipt_id)}
                                  className="h-9 w-9 rounded-[var(--ui-radius-card)] p-0"
                                >
                                  <CheckCircle2 size={14} />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </DataTable>
                  </div>
                </div>
              </div>
            )}

            {receiptPreviewSnapshot && (() => {
              const previewPage = getReceiptOnlyPages(currentCustomerSnapshot, receiptPreviewSnapshot)[0];

              return (
                <div
                  className="fixed inset-0 z-50 flex cursor-pointer flex-col items-center justify-start overflow-auto bg-[var(--ui-overlay)] p-[var(--ui-card-pad)]"
                  onClick={handleReceiptPreviewCloseClick}
                >
                  <div className="mb-3 rounded-[var(--ui-radius-card)] bg-[var(--ui-surface)] px-4 py-2 text-center text-[length:var(--ui-font-button)] font-black text-[var(--text-main)] shadow-xl ring-1 ring-[var(--ui-border)]">
                    {receiptPreviewCloseCount === 0 ? 'กดตรงไหนก็ได้ 2 ครั้งเพื่อปิดรูปบิล' : 'กดอีกครั้งเพื่อยืนยันและปิดกลับไปรายการบิล'}
                  </div>
                  <div className="h-[297mm] w-[210mm] shrink-0 overflow-hidden bg-white p-[12mm] text-[#111827]">
                    <div
                      className="h-full w-full overflow-hidden text-[length:var(--ui-font-button)]"
                      style={{ fontFamily: 'Sarabun, sans-serif' }}
                      dangerouslySetInnerHTML={{ __html: previewPage?.html || '<div style="padding:40px;text-align:center;">ไม่มีข้อมูลบิล</div>' }}
                    />
                  </div>
                </div>
              );
            })()}
          </section>
        )}
      </div>
    </div>
  );
}


