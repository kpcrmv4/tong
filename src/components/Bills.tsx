/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import QRCode from 'react-qr-code';
import { JirakitDB } from '../db';
import { Receipt } from '../types';
import { Search, Printer, FileText, CheckCircle, Clock, Share2, Link, X, Download, Calendar, Eye } from 'lucide-react';
import { jsPDF } from 'jspdf';
import * as htmlToImage from 'html-to-image';
import { printReceipt, downloadReceiptPdf, downloadReceiptImage, getReceiptPrintHtml, getReceiptIframeHtml } from '../utils/receiptHelper';
import { A4PageContainer } from './A4PageContainer';
import { A4ImageExportButton } from './A4ImageExportButton';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { DataTable } from './ui/DataTable';

interface BillsProps {
  refreshCount: number;
  applyDateFilter: boolean;
  setApplyDateFilter: (val: boolean) => void;
  startDate: string;
  setStartDate: (val: string) => void;
  endDate: string;
  setEndDate: (val: string) => void;
}

export default function Bills({ 
  refreshCount, 
  applyDateFilter, 
  setApplyDateFilter, 
  startDate, 
  setStartDate, 
  endDate, 
  setEndDate 
}: BillsProps) {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
  const [sharingReceipt, setSharingReceipt] = useState<Receipt | null>(null);

  // Document Preview Feature States
  const [previewReceipt, setPreviewReceipt] = useState<Receipt | null>(null);
  const [previewIsA4, setPreviewIsA4] = useState<boolean>(true);
  const [isSavingPreviewImage, setIsSavingPreviewImage] = useState(false);
  const [isSavingPreviewPdf, setIsSavingPreviewPdf] = useState(false);
  const [isPrintingPreview, setIsPrintingPreview] = useState(false);
  const [previewActionMessage, setPreviewActionMessage] = useState('');

  const getPreviewMode = (): 'A4' | 'A5' => (previewIsA4 ? 'A4' : 'A5');
  const isPreviewActionBusy = isSavingPreviewImage || isSavingPreviewPdf || isPrintingPreview;

  // Dynamic reprint feature states
  const [reprintModalOpen, setReprintModalOpen] = useState(false);
  const [reprintReceiptId, setReprintReceiptId] = useState<string>('');
  const [reprintPaperSize, setReprintPaperSize] = useState<'A4' | 'A5'>(() => {
    return JirakitDB.getSettings().RECEIPT_PAPER_SIZE || 'A4';
  });
  const [reprintSearchQuery, setReprintSearchQuery] = useState('');

  const [inlinePreviewScaleBills, setInlinePreviewScaleBills] = useState(1);
  const inlinePreviewContainerBillsRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reprintModalOpen) {
      setReprintPaperSize(JirakitDB.getSettings().RECEIPT_PAPER_SIZE || 'A4');
    }
  }, [reprintModalOpen]);

  useEffect(() => {
    if (!inlinePreviewContainerBillsRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const cw = entry.contentRect.width;
        const tw = reprintPaperSize === 'A4' ? 794 : 560;
        setInlinePreviewScaleBills(cw < tw ? cw / tw : 1);
      }
    });
    observer.observe(inlinePreviewContainerBillsRef.current);
    return () => observer.disconnect();
  }, [reprintPaperSize, reprintModalOpen, reprintReceiptId]);

  const [modalPreviewScaleBills, setModalPreviewScaleBills] = useState(1);
  const modalPreviewContainerBillsRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!modalPreviewContainerBillsRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const cw = entry.contentRect.width;
        const tw = previewIsA4 ? 794 : 560;
        setModalPreviewScaleBills(cw < tw ? cw / tw : 1);
      }
    });
    observer.observe(modalPreviewContainerBillsRef.current);
    return () => observer.disconnect();
  }, [previewIsA4, previewReceipt]);

  useEffect(() => {
    // Show newest first
    setReceipts(JirakitDB.getReceipts().slice().reverse());
  }, [refreshCount]);

  const filteredBills = receipts.filter(r => {
    const query = searchQuery.toLowerCase();
    
    // Apply shared date filter conditions matching receipt dates
    const docDateStr = (r.created_at || r.receipt_date || '').slice(0, 10);
    const inDateRange = !applyDateFilter || (startDate <= docDateStr && docDateStr <= endDate);
    if (!inDateRange) return false;

    return r.receipt_no.toLowerCase().includes(query) ||
           r.customer_name.toLowerCase().includes(query) ||
           (r.phone && r.phone.includes(query));
  });

  const handleDownloadPDF = async (r: Receipt, paperMode?: 'A4' | 'A5') => {
    try {
      const shopSettings = JirakitDB.getSettings();
      const mode = paperMode || (shopSettings.RECEIPT_PAPER_SIZE === 'A4' ? 'A4' : 'A5');
      await downloadReceiptPdf(r, mode, shopSettings);
    } catch (err) {
      console.error('Error generating PDF:', err);
      alert('Error creating PDF file. Please try again.');
    }
  };

  const handleSavePreviewImage = async () => {
    if (!previewReceipt) return;

    const mode = getPreviewMode();

    try {
      setIsSavingPreviewImage(true);
      setPreviewActionMessage(`กำลังบันทึกภาพบิล ${mode}...`);

      const shopSettings = JirakitDB.getSettings();

      await downloadReceiptImage(previewReceipt, mode, shopSettings);

      setPreviewActionMessage(`บันทึกภาพบิล ${mode} สำเร็จ`);
    } catch (err) {
      console.error('Error saving receipt image:', err);
      setPreviewActionMessage('บันทึกภาพบิลไม่สำเร็จ กรุณาลองใหม่');
      alert('Error saving bill image. Please try again.');
    } finally {
      setIsSavingPreviewImage(false);
      setTimeout(() => setPreviewActionMessage(''), 2200);
    }
  };

  const handleSavePreviewPdf = async () => {
    if (!previewReceipt) return;

    const mode = getPreviewMode();

    try {
      setIsSavingPreviewPdf(true);
      setPreviewActionMessage(`กำลังบันทึก PDF ${mode}...`);

      const shopSettings = JirakitDB.getSettings();

      await downloadReceiptPdf(previewReceipt, mode, shopSettings);

      setPreviewActionMessage(`บันทึก PDF ${mode} สำเร็จ`);
    } catch (err) {
      console.error('Error saving receipt PDF:', err);
      setPreviewActionMessage('บันทึก PDF ไม่สำเร็จ กรุณาลองใหม่');
      alert('Error saving PDF file. Please try again.');
    } finally {
      setIsSavingPreviewPdf(false);
      setTimeout(() => setPreviewActionMessage(''), 2200);
    }
  };

  const handlePrintPreviewReceipt = async () => {
    if (!previewReceipt) return;

    const mode = getPreviewMode();

    try {
      setIsPrintingPreview(true);
      setPreviewActionMessage(`กำลังเปิดหน้าพิมพ์ ${mode}...`);

      const shopSettings = JirakitDB.getSettings();

      await new Promise(resolve => setTimeout(resolve, 250));
      printReceipt(previewReceipt, mode, shopSettings);

      setPreviewActionMessage(`ส่งคำสั่งพิมพ์ ${mode} แล้ว`);
    } catch (err) {
      console.error('Error printing receipt:', err);
      setPreviewActionMessage('พิมพ์ใบเสร็จไม่สำเร็จ กรุณาลองใหม่');
      alert('Error printing receipt. Please try again.');
    } finally {
      setTimeout(() => {
        setIsPrintingPreview(false);
        setPreviewActionMessage('');
      }, 1200);
    }
  };

  const handleExportBillsToPDF = async () => {
    if (filteredBills.length === 0) {
      alert('No bills found for document export in this time period or search term.');
      return;
    }

    try {
      const shopSettings = JirakitDB.getSettings();
      
      const totalGrand = filteredBills.reduce((sum, r) => sum + r.grand_total, 0);
      const totalPaid = filteredBills.reduce((sum, r) => sum + r.paid_amount, 0);
      const totalDebt = filteredBills.reduce((sum, r) => sum + r.debt_amount, 0);

      const tempDiv = document.createElement('div');
      tempDiv.style.position = 'fixed';
      tempDiv.style.left = '-10000px';
      tempDiv.style.top = '-10000px';
      tempDiv.style.zIndex = '-9999';
      tempDiv.style.opacity = '0';
      tempDiv.style.pointerEvents = 'none';
      tempDiv.style.width = '1000px';
      tempDiv.style.backgroundColor = 'var(--doc-card)';

      const tableRowsHtml = filteredBills.map((r, idx) => {
        const dateStr = new Date(r.created_at || r.receipt_date || '').toLocaleDateString('th-TH');
        const hasDebt = r.debt_amount > 0;
        
        return `
          <tr style="border-bottom: 1px solid var(--doc-border); font-size: 13px; height: 48px;">
            <td style="padding: 10px 15px; text-align: center; color: var(--doc-soft); font-weight: bold;">${idx + 1}</td>
            <td style="padding: 10px; font-weight: 800; color: var(--doc-text);">
              <div style="font-size: 14px; text-transform: uppercase;">${r.receipt_no}</div>
              <div style="font-size: 10px; color: var(--doc-soft); margin-top: 2px;">ประเภท: ${r.doc_type || 'บิลขาย'}</div>
            </td>
            <td style="padding: 10px; color: var(--doc-soft); font-size: 13px;">${dateStr}</td>
            <td style="padding: 10px; color: var(--doc-text); font-weight: 750;">
              <div>${r.customer_name}</div>
              ${r.phone ? `<div style="font-size: 10px; color: var(--doc-soft); font-family: monospace; font-weight: normal; margin-top: 2px;">โทร: ${r.phone}</div>` : ''}
            </td>
            <td style="padding: 10px; text-align: right; font-weight: bold; font-size: 14px; color: var(--doc-text);">
              ${r.grand_total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </td>
            <td style="padding: 10px; text-align: right; font-weight: bold; font-size: 14px; color: var(--doc-success);">
              ${r.paid_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </td>
            <td style="padding: 10px 15px; text-align: right; font-weight: 800; font-size: 14px; color: ${hasDebt ? 'var(--doc-danger)' : 'var(--doc-soft)'};">
              ${r.debt_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </td>
          </tr>
        `;
      }).join('');

      const filterDescription = applyDateFilter 
        ? `ช่วงวันที่ ${startDate} ถึง ${endDate}` 
        : 'ทั้งหมด (ทุกช่วงเวลานำส่ง)';

      const searchDescription = searchQuery 
        ? `ระบุคำค้นหา: "${searchQuery}"` 
        : 'ไม่ได้ระบุคำค้นหาเพิ่มเติม';

      tempDiv.innerHTML = `
        <div style="padding: 50px 60px; font-family: 'Sarabun', 'Inter', system-ui, sans-serif; background-color: var(--doc-card); color: var(--doc-text); line-height: 1.5; -webkit-print-color-adjust: exact; print-color-adjust: exact; width: 1000px; box-sizing: border-box;">
          
          <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid var(--doc-danger); padding-bottom: 30px; margin-bottom: 35px;">
            <div style="text-align: left;">
              <h1 style="font-size: 28px; font-weight: 800; color: var(--doc-danger); margin: 0 0 8px 0; letter-spacing: -0.5px;">รายงานสรุปประวัติการออกบิลและยอดค้างชำระ</h1>
              <p style="font-size: 15px; font-weight: 700; color: var(--doc-soft); margin: 0 0 6px 0;">ผู้ประกอบการ: ${shopSettings.SHOP_NAME || 'จิรกิตติ์ แบบเหล็กพลาสติก'}</p>
              <p style="font-size: 12px; color: var(--doc-soft); margin: 0 0 4px 0;">ที่อยู่ติดต่อ: ${shopSettings.SHOP_ADDRESS || '-'}</p>
              <p style="font-size: 12px; color: var(--doc-soft); margin: 0;">โทร: ${shopSettings.SHOP_TELEPHONE || '-'}</p>
            </div>
            
            <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end;">
              <div style="background-color: var(--doc-danger); color: var(--ui-on-primary); border-radius: 12px; padding: 10px 20px; font-size: 15px; font-weight: bold; box-shadow: var(--ui-shadow-soft);">
                บิลทั้งหมด: ${filteredBills.length} รายการ
              </div>
              <p style="font-size: 11px; color: var(--doc-soft); font-weight: 700; margin-top: 10px; margin-bottom: 0;">วันที่ประมวลผลคำสั่ง: ${new Date().toLocaleString('th-TH')}</p>
            </div>
          </div>

          <div style="background-color: var(--doc-bg); border: 1.5px dashed var(--doc-border); border-radius: 12px; padding: 16px 20px; margin-bottom: 35px; display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
            <div style="text-align: left;">
              <span style="font-size: 11px; font-weight: bold; text-transform: uppercase; color: var(--doc-soft); display: block; margin-bottom: 4px;">ขอบเขตตามการคัดเลือกตัวกรองเวลา (Date Filter)</span>
              <span style="font-size: 13px; font-weight: 750; color: var(--doc-soft);">${filterDescription}</span>
            </div>
            <div style="text-align: left;">
              <span style="font-size: 11px; font-weight: bold; text-transform: uppercase; color: var(--doc-soft); display: block; margin-bottom: 4px;">ขอบเขตตามรหัสบิลหรือชื่อสินค้า (Search Terms)</span>
              <span style="font-size: 13px; font-weight: 750; color: var(--doc-soft);">${searchDescription}</span>
            </div>
          </div>

          <div className="w-full overflow-x-auto">
<${'table'} style="width: 100%; border-collapse: collapse; margin-bottom: 40px; text-align: left;">
            <thead>
              <tr style="background-color: var(--doc-danger); color: var(--doc-card); height: 45px;">
                <th style="padding: 10px 15px; border-top-left-radius: 10px; border-bottom-left-radius: 10px; text-align: center; font-size: 13px; font-weight: bold; width: 60px;">ลำดับ</th>
                <th style="padding: 10px; font-size: 13px; font-weight: bold;">เลขที่ใบเสร็จ / บิล</th>
                <th style="padding: 10px; font-size: 13px; font-weight: bold; width: 110px;">วันที่ออกบิล</th>
                <th style="padding: 10px; font-size: 13px; font-weight: bold;">ชื่อข้อมูลคู่สัญญาลูกค้าคู่ค้า</th>
                <th style="padding: 10px; text-align: right; font-size: 13px; font-weight: bold; width: 140px;">ยอดรวมสุทธิ</th>
                <th style="padding: 10px; text-align: right; font-size: 13px; font-weight: bold; width: 140px;">ยอดรับเงินชำระ</th>
                <th style="padding: 10px 15px; text-align: right; font-size: 13px; font-weight: bold; border-top-right-radius: 10px; border-bottom-right-radius: 10px; width: 140px;">ยอดค้างจ่าย</th>
              </tr>
            </thead>
            <tbody>
              ${tableRowsHtml}
            </tbody>
          </${'table'}>
</div></div>

          <div style="display: flex; justify-content: flex-end; margin-bottom: 40px;">
            <div style="width: 450px; background-color: var(--doc-bg); border: 1px solid var(--doc-border); border-radius: 16px; padding: 22px; box-shadow: var(--ui-shadow-soft);">
              <h3 style="font-size: 14px; font-weight: 800; color: var(--doc-text); border-bottom: 1px solid var(--doc-border); padding-bottom: 12px; margin: 0 0 14px 0; text-transform: uppercase;">สรุปมูลค่ารวมรอบรายงานนี้</h3>
              
              <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: bold; color: var(--doc-soft); margin-bottom: 10px;">
                <span>ยอดเงินบิลรวมทั้งหมด:</span>
                <span style="color: var(--doc-text); font-size: 15px;">${totalGrand.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              
              <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: bold; color: var(--doc-soft); margin-bottom: 10px;">
                <span>ยอดเงินชำระแล้วเสร็จรวม:</span>
                <span style="color: var(--doc-success); font-size: 15px;">${totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              
              <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: 850; color: var(--doc-danger); border-top: 1px dashed var(--doc-border); padding-top: 14px; margin-top: 4px;">
                <span>ยอดค้างรวมที่ต้องติดตามเก็บ:</span>
                <span style="font-size: 17px;">${totalDebt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--doc-border); padding-top: 25px; margin-top: 50px; font-size: 11px; color: var(--doc-soft); font-weight: bold;">
            <div>รายงานออกโดยระบบ Jirakit ERP & POS (iPad Cloud-Native Workbench)</div>
            <div>ลงนามผู้ตรวจสอบ: ___________________________</div>
          </div>

        </div>
      `;

      document.body.appendChild(tempDiv);
      await document.fonts.ready;
      await new Promise(resolve => setTimeout(resolve, 50));

      const tmpCanvas = await htmlToImage.toCanvas(tempDiv, {
        pixelRatio: 2.0,
        backgroundColor: 'var(--doc-card)'
      });

      document.body.removeChild(tempDiv);

      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      const imgWidth = 210;
      const imgHeight = (tmpCanvas.height * imgWidth) / tmpCanvas.width;
      const imgData = tmpCanvas.toDataURL('image/jpeg', 0.95);

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= 297;

      while (heightLeft > 0) {
        position -= 297;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
        heightLeft -= 297;
      }

      const safeDateStr = new Date().toISOString().slice(0, 10);
      pdf.save(`Bills_Report_Summary_${safeDateStr}.pdf`);
    } catch (err: any) {
      console.error('Failed to export bills report to pdf:', err);
      alert(`Incompatibility issue in document conversion: ${err?.message || err}`);
    }
  };

  const handlePrint = (r: Receipt) => {
    const shopSettings = JirakitDB.getSettings();
    const mode: 'A4' | 'A5' = shopSettings.RECEIPT_PAPER_SIZE === 'A4' ? 'A4' : 'A5';
    printReceipt(r, mode, shopSettings);
  };

  return (
    <div className="space-y-6 max-w-full mx-auto w-full">
      <div>
        <h2 className="text-3xl font-black text-[var(--text-main)] flex items-center gap-[var(--ui-gap-button)]">
          <FileText size={30} />
          ประวัติ บิลเอกสาร
        </h2>
      </div>

      {/* Search + Date Filter Row */}
      <div className="flex w-full flex-nowrap items-center justify-start gap-[var(--ui-gap-button)] overflow-visible text-[var(--text-main)]">
        <div className="relative w-[235px] shrink-0">
          <Input
            type="text"
            className="w-full h-[var(--ui-control-h)] ai-panel border border-[var(--ui-border)] rounded-[var(--ui-radius-card)] pl-3 pr-3 text-left text-[length:var(--ui-font-button)] placeholder:text-left"
            placeholder="ค้นหา เลขที่ใบเสร็จ,ชื่อลูกค้า"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <span className="text-[length:var(--ui-font-label)] uppercase font-black text-[var(--text-main)] leading-tight">
            เริ่ม<br />ต้น:
          </span>
          <Input
            type="date"
            className="w-[200px] h-[var(--ui-control-h)] ai-panel border border-[var(--ui-border)] rounded-[var(--ui-radius-card)] px-4 text-[length:var(--ui-font-button)] font-mono font-bold text-[var(--text-main)] outline-none appearance-none cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
            value={startDate}
            onClick={e => (e.currentTarget as HTMLInputElement & { showPicker?: () => void }).showPicker?.()}
            onChange={e => setStartDate(e.target.value)}
          />
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <span className="text-[length:var(--ui-font-label)] uppercase font-black text-[var(--text-main)] leading-tight">
            สิ้น<br />สุด:
          </span>
          <Input
            type="date"
            className="w-[200px] h-[var(--ui-control-h)] ai-panel border border-[var(--ui-border)] rounded-[var(--ui-radius-card)] px-4 text-[length:var(--ui-font-button)] font-mono font-bold text-[var(--text-main)] outline-none appearance-none cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
            value={endDate}
            onClick={e => (e.currentTarget as HTMLInputElement & { showPicker?: () => void }).showPicker?.()}
            onChange={e => setEndDate(e.target.value)}
          />
        </div>

        <Button
          onClick={() => setApplyDateFilter(!applyDateFilter)}
          className={`shrink-0 px-4 h-[var(--ui-control-h)] text-[length:var(--ui-font-button)] font-black rounded-[var(--ui-radius-card)] tracking-wide transition-all flex items-center whitespace-nowrap ${
            applyDateFilter
              ? 'bg-[var(--ui-primary)] hover:bg-[var(--ui-primary)] text-[var(--ui-on-primary)] shadow-xs'
              : 'ai-panel hover:bg-[var(--ui-text)] text-[var(--text-main)] border border-[var(--ui-border)]'
          }`}
        >
          {applyDateFilter ? '✕ เคลียร์การกรองเวลา' : '📅 กรองเวลานัด'}
        </Button>
      </div>

      {/* Export + Reprint Buttons */}
      <div className="flex w-full flex-wrap items-center justify-start gap-[var(--ui-gap-button)]">
        <Button
          type="button"
          onClick={handleExportBillsToPDF}
          className="px-4 py-2 min-h-[var(--ui-button-h)] bg-[var(--ui-primary)] hover:opacity-90 text-[var(--ui-on-primary)] font-extrabold text-[length:var(--ui-font-label)] rounded-[var(--ui-radius-card)] shadow-md flex items-center justify-center gap-[var(--ui-gap-button)] transition-all hover:scale-[1.02]"
        >
          <FileText size={14} className="stroke-[var(--ui-on-primary)]" />
          <span>📥 ส่งออกรายการบิลมีผลกรอง (PDF LIST)</span>
        </Button>

        <Button
          type="button"
          onClick={() => {
            setReprintModalOpen(true);
            if (receipts.length > 0) {
              setReprintReceiptId(receipts[0].receipt_id);
            }
          }}
          className="px-4 py-2 min-h-[var(--ui-button-h)] bg-[var(--ui-secondary)] hover:opacity-90 text-[var(--ui-on-primary)] font-extrabold text-[length:var(--ui-font-label)] rounded-[var(--ui-radius-card)] shadow-md flex items-center justify-center gap-[var(--ui-gap-button)] transition-all hover:scale-[1.02]"
        >
          <Printer size={14} className="stroke-[var(--ui-on-primary)]" />
          <span>📑 พิมพ์บิลย้อนหลัง (Reprint Historic Bill)</span>
        </Button>
      </div>

        {/* List of bills */}
<DataTable className="min-w-[720px] w-full text-[length:var(--ui-font-label)] text-left">
  <thead>
    <tr className="text-[var(--text-main)] h-[var(--ui-control-h)] font-black border-b border-[var(--ui-border)]">
      <th className="px-4 py-2">เลขที่บิล / ประเภท</th>
      <th className="px-4 py-2">ชื่อลูกค้า</th>
      <th className="px-4 py-2">วันที่ออกบิล</th>
      <th className="px-4 py-2 text-right">ยอดสุทธิรวม</th>
      <th className="px-4 py-2 text-right">ชำระแล้ว</th>
      <th className="px-4 py-2 text-right">ยอดค้าง</th>
      <th className="px-4 py-2 text-center">จัดการ</th>
    </tr>
  </thead>

  <tbody className="divide-y divide-[var(--ui-border)] font-semibold text-[var(--text-main)]">
    {filteredBills.length === 0 ? (
      <tr>
        <td
          colSpan={7}
          className="px-4 py-12 text-center text-[var(--text-main)] font-bold"
        >
          ยังไม่มีข้อมูลเอกสารบิลบันทึกในคลัง
        </td>
      </tr>
    ) : (
      (Array.isArray(filteredBills) ? filteredBills : []).map(r => {
        const hasDebt = r.debt_amount > 0;

        return (
          <tr key={r.receipt_id} className="transition-colors h-14">
            <td className="px-4 py-2">
              <div className="font-extrabold text-[var(--text-main)]">{r.receipt_no}</div>
              <div className="text-[length:var(--ui-font-label)] text-[var(--text-main)] uppercase mt-0.5">{r.doc_type}</div>
            </td>

            <td className="px-4 py-2 font-extrabold text-[var(--text-main)]">
              {r.customer_name}
            </td>

            <td className="px-4 py-2 text-[var(--text-main)]">
              {new Date(r.created_at).toLocaleDateString('th-TH')}
            </td>

            <td className="px-4 py-2 text-right font-black text-[var(--text-main)]">
              {r.grand_total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </td>

            <td className="px-4 py-2 text-right font-bold text-[var(--ui-primary)]">
              {r.paid_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </td>

            <td className={`px-4 py-2 text-right font-black ${hasDebt ? 'text-[var(--ui-primary)]' : 'text-[var(--text-main)]'}`}>
              {r.debt_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </td>

            <td className="px-4 py-2">
              <div className="flex gap-[var(--ui-gap-button)] justify-end">
                <Button
                  onClick={() => setSelectedReceipt(r)}
                  className="p-2 rounded-lg text-[var(--text-main)] tooltip"
                  title="ดูรายการของ"
                >
                  <FileText size={14} />
                </Button>

                <Button
                  onClick={() => {
                    setPreviewReceipt(r);
                    setPreviewActionMessage('');
                    const shopSettings = JirakitDB.getSettings();
                    setPreviewIsA4(shopSettings.RECEIPT_PAPER_SIZE === 'A4');
                  }}
                  className="p-2 rounded-lg text-[var(--text-main)] tooltip"
                  title="พรีวิวบิล"
                >
                  <Eye size={14} />
                </Button>

                {hasDebt && (
                  <Button
                    onClick={() => setSharingReceipt(r)}
                    className="p-2 rounded-lg text-[var(--text-main)] tooltip"
                    title="แชร์ลิงก์ดูบิลแบบอ่านอย่างเดียว"
                  >
                    <Share2 size={14} />
                  </Button>
                )}

                <Button
                  onClick={() => handlePrint(r)}
                  className="p-2 rounded-lg text-[var(--text-main)] tooltip"
                  title="พิมพ์บิล"
                >
                  <Printer size={14} />
                </Button>

                <Button
                  onClick={() => handleDownloadPDF(r)}
                  className="p-2 rounded-lg text-[var(--text-main)] tooltip"
                  title="ดาวน์โหลด PDF"
                >
                  <Download size={14} />
                </Button>
              </div>
            </td>
          </tr>
        );
      })
    )}
  </tbody>
</DataTable>

      {/* Bill detail overlay viewer */}
      {selectedReceipt && (
        <div className="fixed inset-0 bg-[var(--text-main)]/50 backdrop-blur-xs flex items-center justify-center z-50 p-[var(--ui-card-pad)]">
          <div className="ai-panel border rounded-[var(--ui-radius-card)] p-[var(--ui-card-pad)] w-[95vw] sm:w-[90vw] md:max-w-3xl lg:max-w-5xl max-h-[90dvh] overflow-y-auto mx-auto shadow-2xl relative animate-in zoom-in-95 duration-150">
            <h3 className="text-base font-extrabold text-[var(--text-main)] flex items-center gap-[var(--ui-gap-button)] pb-2 border-b border-[var(--ui-border)]">
              <FileText className="stroke-[var(--ui-primary)]" size={18} />
              รายการย่อย บิล: {selectedReceipt.receipt_no}
            </h3>

            <div className="space-y-4 mt-4">
              <div className="flex flex-wrap gap-x-6 gap-y-2 text-[length:var(--ui-font-label)] font-semibold text-[var(--text-main)] justify-between">
                {selectedReceipt.customer_name && selectedReceipt.customer_name !== '-' && <p>ผู้ชำระเงิน: <span className="text-[var(--text-main)] font-bold">{selectedReceipt.customer_name}</span></p>}
                {selectedReceipt.phone && selectedReceipt.phone !== '-' && <p>เบอร์โทร: {selectedReceipt.phone}</p>}
                {selectedReceipt.rent_date && selectedReceipt.rent_date !== '-' && <p>เริ่มเช่า: {selectedReceipt.rent_date}</p>}
                {selectedReceipt.due_date && selectedReceipt.due_date !== '-' && <p>วันส่งคืน: {selectedReceipt.due_date}</p>}
              </div>

              <div className="max-h-[220px] overflow-y-auto rounded-[var(--ui-radius-card)] border border-[var(--ui-border)] shadow-xs">
                <div className="w-full overflow-x-auto rounded-[var(--ui-radius-card)] border">
                  <DataTable className="min-w-[720px] w-full text-[length:var(--ui-font-label)] font-bold text-left table-auto">
                  <thead>
                    <tr className="ai-panel text-[var(--text-main)] h-9">
                      <th className="p-2">รายการวัสดุ</th>
                      <th className="p-2 text-right">จำนวน</th>
                      <th className="p-2 text-right">เช่า/รอบ</th>
                      <th className="p-2 text-right">รวมเงิน ()</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--ui-border)] text-[var(--text-main)]">
                    {(Array.isArray(JSON.parse(selectedReceipt.items_json || '[]')) ? JSON.parse(selectedReceipt.items_json || '[]') : []).map((it: any, idx: number) => (
                      <tr key={idx} className="h-9">
                        <td className="p-2 text-[var(--text-main)]">{it.receipt_name}</td>
                        <td className="p-2 text-right">{it.qty} {it.unit}</td>
                        <td className="p-2 text-right">{it.price}</td>
                        <td className="p-2 text-right text-[var(--text-main)] font-black">{it.line_total.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                  </DataTable>
                </div>
              </div>

              <div className="ai-panel p-[var(--ui-card-pad)] rounded-[var(--ui-radius-card)] border border-[var(--ui-border)] text-[length:var(--ui-font-label)] font-bold space-y-2">
                <div className="flex justify-between text-[var(--text-main)]">
                  <span>มูลค่าสินค้าในบิล:</span>
                  <span>{selectedReceipt.subtotal.toLocaleString()}</span>
                </div>
                {selectedReceipt.discount > 0 && (
                  <div className="flex justify-between text-[var(--text-main)]">
                    <span>ส่วนลด:</span>
                    <span>- {selectedReceipt.discount.toLocaleString()}</span>
                  </div>
                )}
                {selectedReceipt.deposit > 0 && (
                  <div className="flex justify-between text-[var(--ui-primary)]">
                    <span>จ่ายมัดจำไว้:</span>
                    <span>- {selectedReceipt.deposit.toLocaleString()}</span>
                  </div>
                )}
                {selectedReceipt.delivery_fee > 0 && (
                  <div className="flex justify-between">
                    <span>ค่าขนส่งรวม:</span>
                    <span>+ {selectedReceipt.delivery_fee.toLocaleString()}</span>
                  </div>
                )}
                {selectedReceipt.vat > 0 && (
                  <div className="flex justify-between">
                    <span>ภาษี VAT 7%:</span>
                    <span>+ {selectedReceipt.vat.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-[var(--ui-primary)] font-black border-t border-dashed border-[var(--ui-border)] pt-2 text-[length:var(--ui-font-button)]">
                  <span>ยอดสุทธิเรียกเก็บ:</span>
                  <span>{selectedReceipt.grand_total.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-[var(--ui-gap-button)] mt-6">
              <Button
                onClick={() => setSelectedReceipt(null)}
                className="flex-1 py-2.5 ai-panel text-[var(--text-main)] font-bold rounded-[var(--ui-radius-card)] text-[length:var(--ui-font-label)]"
              >
                ปิดหน้าต่างรายละเอียด
              </Button>
              <Button
                onClick={() => {
                  handlePrint(selectedReceipt);
                  setSelectedReceipt(null);
                }}
                className="flex-1 py-2.5 ai-panel hover:bg-[var(--text-main)] text-[var(--text-main)] font-bold rounded-[var(--ui-radius-card)] text-[length:var(--ui-font-label)] flex items-center justify-center gap-1 shadow-sm"
              >
                <Printer size={13} /> สั่งพิมพ์ใบเก็บหน้างาน
              </Button>
              <Button
                onClick={() => {
                  handleDownloadPDF(selectedReceipt);
                  setSelectedReceipt(null);
                }}
                className="flex-1 py-2.5 outer-cont text-[var(--text-main)]  font-bold rounded-[var(--ui-radius-card)] text-[length:var(--ui-font-label)] flex items-center justify-center gap-1 shadow-sm"
              >
                <Download size={13} /> ดาวน์โหลดเอกสาร PDF
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Share Read-only Bill Link Dialog Component */}
      {sharingReceipt && (
        <div className="fixed inset-0 bg-[var(--text-main)]/50 backdrop-blur-xs flex items-center justify-center z-50 p-[var(--ui-card-pad)]">
          <div className="ai-panel rounded-[var(--ui-radius-modal)] max-w-md w-full p-[var(--ui-card-pad)] shadow-2xl relative animate-in zoom-in-95 duration-200">
            <Button 
              onClick={() => setSharingReceipt(null)} 
              className="absolute right-4 top-[var(--ui-card-pad)] text-[var(--text-main)] hover:text-[var(--text-main)] font-bold"
            >
              <X size={18} />
            </Button>
            
            <div className="text-center space-y-3">
              <div className="w-12 h-[var(--ui-control-h)] bg-[var(--ui-surface)] rounded-full flex items-center justify-center mx-auto text-[var(--ui-primary)] border border-[var(--ui-primary)] mb-2">
                <Share2 size={24} />
              </div>
              <h3 className="text-md font-extrabold text-[var(--text-main)]">แชร์ลิงก์ดูบิลแบบอ่านอย่างเดียว</h3>
              <p className="text-[length:var(--ui-font-label)] text-[var(--text-main)] font-semibold leading-relaxed">
                ส่ง URL ข้างล่างนี้ให้ลูกค้าดูรายละเอียดบิลยอดคงเหลือ {sharingReceipt.receipt_no} โดยไม่สามารถแก้ไข ลบ หรืออัปโหลดสลิปได้
              </p>
            </div>

            <div className="space-y-4 mt-6">
              <div>
                <label className="block text-[length:var(--ui-font-label)] font-bold text-[var(--text-main)] mb-1">ลิงก์ดูบิลสำหรับแชร์:</label>
                <div className="flex gap-[var(--ui-gap-button)]">
                  <Input 
                    type="text" 
                    readOnly 
                    value={`${window.location.origin}?pay=${sharingReceipt.receipt_id}`} 
                    className="flex-1 ai-panel border rounded-[var(--ui-radius-card)] px-3 py-2 text-[length:var(--ui-font-label)] font-mono font-bold outline-none border-[var(--ui-border)] select-all text-[length:var(--ui-font-label)]"
                  />
                  <Button 
                    onClick={() => {
                      const payUrl = `${window.location.origin}?pay=${sharingReceipt.receipt_id}`;
                      navigator.clipboard.writeText(payUrl);
                      alert('คัดลอกลิงก์ดูบิลลงคลิปบอร์ดแล้ว!');
                    }}
                    className="px-4 py-2 min-h-[var(--ui-button-h)] bg-[var(--ui-primary)] text-[var(--text-main)] font-extrabold text-[length:var(--ui-font-label)] rounded-[var(--ui-radius-card)] shadow-md"
                  >
                    คัดลอก
                  </Button>
                </div>
              </div>

              <div className="border border-dashed border-[var(--ui-border)] p-[var(--ui-card-pad-sm)] rounded-[var(--ui-radius-card)] ai-panel flex items-center gap-[var(--ui-gap-button)]">
                <div className="border p-1 ai-panel rounded-lg">
                  <QRCode 
                    value={`${window.location.origin}?pay=${sharingReceipt.receipt_id}`}
                    size={64}
                    style={{ width: "100%", height: "100%" }}
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-[length:var(--ui-font-label)] font-bold text-[var(--text-main)]">QR สแกนเปิดหน้าดูบิล</p>
                  <p className="text-[length:var(--ui-font-label)] text-[var(--text-main)] leading-normal font-medium">ลูกค้าสามารถใช้วิธีนำกล้องสแกน QR Code นี้เพื่อเปิดหน้าตรวจสอบภาระหนี้สินได้โดยตรง</p>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-[var(--ui-border)] flex justify-end gap-[var(--ui-gap-button)]">
              <Button 
                onClick={() => setSharingReceipt(null)}
                className="w-full py-2.5 ai-panel hover:bg-[var(--text-main)] text-[var(--text-main)] rounded-[var(--ui-radius-card)] text-[length:var(--ui-font-label)] font-extrabold"
              >
                ปิดหน้าแชร์
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Reprint Historic Bill Workbench Modal */}
      {reprintModalOpen && (
        <div className="fixed inset-0 bg-[var(--text-main)]/60 backdrop-blur-sm flex items-center justify-center z-50 p-[var(--ui-card-pad)]">
          <div className="ai-panel rounded-[var(--ui-radius-modal)] max-w-5xl w-full h-[85vh] shadow-2xl flex flex-col overflow-hidden border border-[var(--ui-border)] text-[length:var(--ui-font-label)] font-semibold text-[var(--text-main)]">
            {/* Header */}
            <div className="bg-[var(--text-main)] text-[var(--text-main)] p-5 flex justify-between items-center shrink-0">
              <div className="space-y-0.5 text-left">
                <h3 className="text-md font-extrabold flex items-center gap-[var(--ui-gap-button)]">
                  <Printer size={18} className="stroke-[var(--ui-primary)] fill-none" />
                  เครื่องมือถอดประวัติพิมพ์ซ้ำใบเสร็จ (Dynamic Historic Reprint Workbench)
                </h3>
                <p className="text-[length:var(--ui-font-label)] text-[var(--text-main)] font-medium font-sans">สืบค้นบิล ใบเสร็จใบส่งสินค้าที่บันทึกไว้ในฐานคลัง และถอดแปลนสร้าง Layout หน้าเอกสารใหม่ทั้งหมดทันที บายพาสไฟล์ PDF เดิม!</p>
              </div>
              <Button 
                type="button"
                onClick={() => setReprintModalOpen(false)} 
                className="text-[var(--text-main)] hover:text-[var(--text-main)] p-1 rounded-full hover:ai-panel transition-colors"
              >
                <X size={20} />
              </Button>
            </div>

            {/* Workbench workspace split container */}
            <div className="flex-1 min-h-0 flex flex-col md:flex-row">
              
              {/* Left side: Bill selection feed */}
              <div className="w-full md:w-80 border-r border-[var(--ui-border)] p-[var(--ui-card-pad)] flex flex-col min-h-0 ai-panel shrink-0 select-none">
                <div className="space-y-2 mb-3">
                  <label className="block text-[length:var(--ui-font-label)] font-black uppercase text-[var(--text-main)] tracking-wider">สืบค้นบิลประวัติศาสตร์</label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 text-[var(--text-main)]" size={14} />
                    <Input 
                      type="text"
                      placeholder="เลขบิล, ชื่อลูกค้า..."
                      className="w-full ai-panel border border-[var(--ui-border)] rounded-[var(--ui-radius-card)] pl-8 pr-3 py-2 text-[length:var(--ui-font-label)] outline-none"
                      value={reprintSearchQuery}
                      onChange={e => setReprintSearchQuery(e.target.value)}
                    />
                  </div>
                </div>

                {/* Scrollable feed list */}
                <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-left min-h-0">
                  {(receipts.filter(r => r.receipt_no.toLowerCase().includes(reprintSearchQuery.toLowerCase()) || r.customer_name.toLowerCase().includes(reprintSearchQuery.toLowerCase()))).map(r => {
                    const isActive = r.receipt_id === reprintReceiptId;
                    return (
                      <Button
                        type="button"
                        key={r.receipt_id}
                        onClick={() => setReprintReceiptId(r.receipt_id)}
                        className={`w-full p-[var(--ui-card-pad-sm)] rounded-[var(--ui-radius-card)] border text-left transition-all ${
                          isActive 
                            ? 'ai-panel border-[var(--ui-border)] text-[var(--text-main)] font-extrabold ring-1 ring-[var(--ui-danger)]/30 shadow-xs' 
                            : 'ai-panel border-[var(--ui-border)] hover:border-[var(--ui-border)] text-[var(--text-main)]'
                        }`}
                      >
                        <div className="flex justify-between items-center text-[length:var(--ui-font-label)] font-mono mb-1">
                          <span className={isActive ? 'text-[var(--text-main)]' : 'text-[var(--text-main)]'}>{r.receipt_no}</span>
                          <span className="text-[var(--text-main)]">{(r.receipt_date || r.created_at || '').slice(0, 10)}</span>
                        </div>
                        <div className="text-[length:var(--ui-font-label)] truncate font-bold text-[var(--text-main)]">{r.customer_name}</div>
                        <div className="flex justify-between items-baseline text-[length:var(--ui-font-label)] font-normal mt-1 text-[var(--text-main)]">
                          <span>ยอดเรียกเก็บ:</span>
                          <span className="font-extrabold text-[var(--text-main)]">{r.grand_total.toLocaleString()}</span>
                        </div>
                      </Button>
                    );
                  })}
                  {receipts.filter(r => r.receipt_no.toLowerCase().includes(reprintSearchQuery.toLowerCase()) || r.customer_name.toLowerCase().includes(reprintSearchQuery.toLowerCase())).length === 0 && (
                    <div className="text-center py-10 text-[var(--text-main)] font-bold border border-dashed rounded-[var(--ui-radius-card)]">
                      ไม่พบบิลตามค้นหา
                    </div>
                  )}
                </div>
              </div>

              {/* Right side: Live Dynamic Document Layout Generator Preview */}
              <div className="flex-1 min-h-0 p-[var(--ui-card-pad)] flex flex-col bg-[var(--ui-surface)]">
                {
                  (receipts.find(r => r.receipt_id === reprintReceiptId) || receipts[0]) ? (
                    <div className="flex-1 flex flex-col min-h-0 space-y-3">
                      <div className="mb-3.5 w-full ai-panel p-[var(--ui-card-pad-sm)] rounded-[var(--ui-radius-card)] border border-[var(--ui-border)] select-none shadow-sm shrink-0">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[var(--ui-gap-button)]">
                          <Button
                            type="button"
                            onClick={() => {
                              setReprintPaperSize('A4');
                              const shopSettings = JirakitDB.getSettings();
                              JirakitDB.saveSettings({
                                ...shopSettings,
                                RECEIPT_PAPER_SIZE: 'A4'
                              });
                            }}
                            className={`min-h-[var(--ui-button-h)] px-3 py-2 rounded-lg font-bold transition-all cursor-pointer flex items-center justify-center border-2 border-transparent ${
                              reprintPaperSize === 'A4' 
                                ? 'bg-[var(--ui-primary)] text-[var(--text-main)] shadow-md border-[var(--ui-danger)]' 
                                : 'ai-panel text-[var(--text-main)] hover:ai-panel border-[var(--ui-border)] shadow-sm'
                            }`}
                          >
                            บิลขนาด A4
                          </Button>
                          <Button
                            type="button"
                            onClick={() => {
                              setReprintPaperSize('A5');
                              const shopSettings = JirakitDB.getSettings();
                              JirakitDB.saveSettings({
                                ...shopSettings,
                                RECEIPT_PAPER_SIZE: 'A5'
                              });
                            }}
                            className={`min-h-[var(--ui-button-h)] px-3 py-2 rounded-lg font-bold transition-all cursor-pointer flex items-center justify-center border-2 border-transparent ${
                              reprintPaperSize === 'A5' 
                                ? 'bg-[var(--ui-primary)] text-[var(--text-main)] shadow-md border-[var(--ui-danger)]' 
                                : 'ai-panel text-[var(--text-main)] hover:ai-panel border-[var(--ui-border)] shadow-sm'
                            }`}
                          >
                            บิลย่อส่วน A5
                          </Button>
                          <div className="sm:col-span-2">
                            <A4ImageExportButton 
                              targetId="bill-reprint-document" 
                              prefix="RECEIPT" 
                              isLandscape={false}
                              className="w-full h-full"
                            />
                          </div>
                        </div>
                      </div>

                      <div 
                        ref={inlinePreviewContainerBillsRef}
                        className="flex-1 ai-panel rounded-[var(--ui-radius-card)] overflow-y-auto overflow-x-hidden shadow-inner relative flex justify-center items-start shrink-0 p-0"
                        style={{ minHeight: '400px' }}
                      >
                        <A4PageContainer id="bill-reprint-document" isLandscape={false} scaleToFit={true} paperSize={reprintPaperSize}>
                          <iframe
                            title="bill-reprint-document"
                            style={{ width: '100%', height: '100%', border: 'none', background: 'transparent' }}
                            srcDoc={getReceiptIframeHtml((receipts.find(r => r.receipt_id === reprintReceiptId) || receipts[0]), reprintPaperSize === 'A4', JirakitDB.getSettings(), undefined, true)}
                          />
                        </A4PageContainer>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 ai-panel border border-dashed rounded-[var(--ui-radius-card)] flex flex-col justify-center items-center p-10 text-center">
                      <Printer size={48} className="text-[var(--text-main)] mb-3" />
                      <p className="text-[var(--text-main)] text-[length:var(--ui-font-button)] font-bold">กรุณาเลือกหรือค้นหาเลขที่บิลที่คุณต้องการถอดและพิมพ์ซ้ำ</p>
                    </div>
                  )
                }
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Dynamic Receipt Preview Modal */}
      {previewReceipt && (
        <div className="fixed inset-0 bg-[var(--text-main)]/60 backdrop-blur-sm z-50 flex items-center justify-center p-[var(--ui-card-pad)]">
          <div className="ai-panel border border-[var(--ui-border)] rounded-[var(--ui-radius-card)] w-full max-w-4xl h-[90vh] flex flex-col shadow-2xl relative text-left overflow-hidden">
              
              {/* Modal Top Bar header */}
              <div className="bg-[var(--text-main)] text-[var(--text-main)] p-5 shrink-0 flex justify-between items-center">
                <div className="space-y-1">
                  <h3 className="text-md font-extrabold flex items-center gap-[var(--ui-gap-button)]">
                    <Eye size={18} className="stroke-[var(--ui-warning)] font-black" />
                    พรีวิวตรวจสอบบิลจริงก่อนพิมพ์: {previewReceipt.receipt_no}
                  </h3>
                  <p className="text-[length:var(--ui-font-label)] text-[var(--text-main)] font-semibold select-none">
                    เรนเดอร์เอกสารโครงสร้าง ‘receiptHelper’ และข้อมูลการเช่าหลักของระบบเพื่อยืนยันค่า
                  </p>
                </div>
                <Button
                  type="button"
                  className="text-[var(--text-main)] hover:text-[var(--ui-danger)] p-1 rounded-full hover:ai-panel transition-colors"
                  onClick={() => setPreviewReceipt(null)}
                >
                  <X size={20} />
                </Button>
              </div>

              {/* Dynamic Toolbar Configuration */}
              <div className="ai-panel border-b border-[var(--ui-border)] px-4 sm:px-6 py-3 shrink-0 select-none text-[length:var(--ui-font-label)] font-bold text-[var(--text-main)]">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[var(--ui-gap-button)]">
                  <Button
                    type="button"
                    disabled={isPreviewActionBusy}
                    onClick={() => {
                      setPreviewIsA4(true);
                      setPreviewActionMessage('เลือกขนาดบิล A4 แล้ว');
                      const shopSettings = JirakitDB.getSettings();
                      JirakitDB.saveSettings({
                        ...shopSettings,
                        RECEIPT_PAPER_SIZE: 'A4'
                      });
                    }}
                    className={`min-h-[var(--ui-button-h)] px-3 py-2 rounded-lg font-bold transition-all cursor-pointer flex items-center justify-center border-2 border-transparent ${
                      previewIsA4 
                        ? 'bg-[var(--ui-primary)] text-[var(--text-main)] shadow-md border-[var(--ui-danger)]' 
                        : 'ai-panel text-[var(--text-main)] hover:ai-panel border-[var(--ui-border)] shadow-sm'
                    } ${isPreviewActionBusy ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    บิลขนาด A4
                  </Button>

                  <Button
                    type="button"
                    disabled={isPreviewActionBusy}
                    onClick={() => {
                      setPreviewIsA4(false);
                      setPreviewActionMessage('เลือกบิลย่อส่วน A5 แล้ว');
                      const shopSettings = JirakitDB.getSettings();
                      JirakitDB.saveSettings({
                        ...shopSettings,
                        RECEIPT_PAPER_SIZE: 'A5'
                      });
                    }}
                    className={`min-h-[var(--ui-button-h)] px-3 py-2 rounded-lg font-bold transition-all cursor-pointer flex items-center justify-center border-2 border-transparent ${
                      !previewIsA4 
                        ? 'bg-[var(--ui-primary)] text-[var(--text-main)] shadow-md border-[var(--ui-danger)]' 
                        : 'ai-panel text-[var(--text-main)] hover:ai-panel border-[var(--ui-border)] shadow-sm'
                    } ${isPreviewActionBusy ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    บิลย่อส่วน A5
                  </Button>

                  <div className="sm:col-span-2">
                    <A4ImageExportButton 
                        targetId="preview-modal-document" 
                        prefix="PREVIEW-BILL" 
                        isLandscape={false} 
                        className="w-full h-full"
                    />
                  </div>
                </div>
              </div>

              {/* Sandbox iframe representation */}
              <div 
                ref={modalPreviewContainerBillsRef}
                className="flex-1 ai-panel p-0 relative overflow-y-auto overflow-x-hidden flex justify-center items-start border-t border-[var(--ui-border)]"
              >
                  <A4PageContainer id="preview-modal-document" isLandscape={false} scaleToFit={true} paperSize={previewIsA4 ? 'A4' : 'A5'}>
                       <iframe
                       title="preview-modal-document"
                       style={{ width: '100%', height: '100%', border: 'none', background: 'transparent' }}
                       srcDoc={getReceiptIframeHtml(previewReceipt, previewIsA4, JirakitDB.getSettings(), undefined, true)}
                     />
                  </A4PageContainer>
              </div>

              {/* Close Bottom Control */}
              <div className="bg-[var(--ui-surface)] px-6 py-3.5 border-t border-[var(--ui-border)] shrink-0 flex justify-end gap-[var(--ui-gap-button)].5">
                <Button
                  type="button"
                  onClick={() => setPreviewReceipt(null)}
                  className="px-4 py-2 min-h-[var(--ui-button-h)] ai-panel hover:ai-panel text-[var(--text-main)] text-[length:var(--ui-font-label)] font-bold border border-[var(--ui-border)] rounded-[var(--ui-radius-card)] transition-colors"
                >
                  ปิดหน้าต่างการพรีวิว
                </Button>
              </div>

            </div>
          </div>
      )}
    </div>
  );
}
