/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Receipt, SystemSettings } from '../types';
import { exportA4ToImage } from './a4ExportService';

const A4_PAGE_PX = { width: 794, height: 1123, padding: 19, contentWidth: 756, contentHeight: 1085 };
const A5_PAGE_PX = { width: 559, height: 794 };
const A5_FROM_A4_SCALE = Math.min(A5_PAGE_PX.width / A4_PAGE_PX.width, A5_PAGE_PX.height / A4_PAGE_PX.height);

export function getReceiptRowLimit(paperSize: 'A4' | 'A5'): number {
  return 18; // Both A4 and A5 use the exact same 18-row layout, A5 is just scaled down CSS
}

export function formatThaiDate(dateStr: string): string {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const months = [
      'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
      'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
    ];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear() + 543}`;
  } catch (e) {
    return dateStr;
  }
}

function formatReceiptSlashDate(dateStr?: string): string {
  if (!dateStr) return '';

  const d = new Date(`${dateStr}T00:00:00`);
  if (isNaN(d.getTime())) return '';

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear() + 543;

  return `${day}/${month}/${year}`;
}

function isScaffoldReceiptItem(item: any): boolean {
  const category = String(item.category || item.item_category || '').trim();

  return [
    'นั่งร้าน',
    'ขาปรับ',
    'นั่งร้าน/อุปกรณ์',
    'นั่งร้านและอุปกรณ์',
  ].includes(category);
}

export function getItemDisplayName(item: any): string {
  const name =
    item.receipt_name ||
    item.item_name ||
    item.name ||
    item.sku ||
    'ไม้แบบอุปกรณ์พลาสติก';

  if (!isScaffoldReceiptItem(item)) return name;

  const start = formatReceiptSlashDate(item.start_date);
  const end = formatReceiptSlashDate(item.due_date);
  if (!start || !end) return name;

  return `${name} | ${start}ถึง${end}`;
}

export function getRentalPeriodText(item: any): string {
  if (item.rental_mode === 'round') {
    return `${item.rounds || 1} รอบ`;
  }
  return `${item.rent_days || 1} วัน`;
}

export function calculateRentalLineTotal(item: any): number {
  const price = Number(item.price) || 0;
  const qty = Number(item.qty) || 0;

  if (item.line_mode === 'sale') {
    return price * qty;
  }

  if (item.rental_mode === 'round') {
    const rounds = Number(item.rounds) || 1;
    return price * qty * rounds;
  }

  const rentDays = Number(item.rent_days || item.rentDays) || 1;
  return price * qty * rentDays;
}

export function normalizeCategory(categoryStr: string): string {
  if (!categoryStr) return 'ทั่วไป';
  return categoryStr.trim();
}

function getBankQrUrl(settings: any, rc?: any): string {
  const qrCandidates = [
    settings?.BANK_QR_URL,
    settings?.BANK_QR_IMAGE,
    settings?.BANK_QR,
    settings?.PAYMENT_QR_URL,
    settings?.PROMPTPAY_QR_URL,
    settings?.QR_URL,
    settings?.bank_qr_url,
    settings?.bankQrUrl,
    settings?.bankQr,
    settings?.payment_qr_url,
    settings?.paymentQrUrl,
    settings?.promptpay_qr_url,
    settings?.promptpayQrUrl,
    settings?.qr_url,
    settings?.qrUrl,
    rc?.BANK_QR_URL,
    rc?.bank_qr_url,
    rc?.bankQrUrl,
    rc?.payment_qr_url,
    rc?.paymentQrUrl,
    rc?.qr_url,
    rc?.qrUrl,
  ];

  for (const candidate of qrCandidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  return '';
}

function escapeHtmlAttr(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
export function getReceiptPrintHtml(rc: any, isA4: boolean, settings: any, copyType?: string): string {
  let parsedItems: any[] = [];

  if (rc.items_json) {
    try {
      parsedItems =
        typeof rc.items_json === 'string'
          ? JSON.parse(rc.items_json)
          : rc.items_json;
    } catch (e) {
      console.error(e);
    }
  }

  if (rc.discount) {
    parsedItems.push({
      item_name: 'ส่วนลด',
      qty: 1,
      unit: '',
      price: -Number(rc.discount),
      line_mode: 'sale'
    });
  }

  if (rc.deposit) {
    parsedItems.push({
      item_name: 'ค่ามัดจำ',
      qty: 1,
      unit: '',
      price: Number(rc.deposit),
      line_mode: 'sale'
    });
  }

  if (rc.delivery_fee) {
    parsedItems.push({
      item_name: 'ค่าขนส่ง',
      qty: 1,
      unit: '',
      price: Number(rc.delivery_fee),
      line_mode: 'sale'
    });
  }

  const vatText = rc.vat_mode === 'NONE'
    ? 'ได้รับยกเว้นภาษีมูลค่าเพิ่ม'
    : rc.vat_mode === 'INCLUDE'
      ? `รวมภาษีมูลค่าเพิ่ม VAT ${rc.vat_rate || settings.VAT_RATE}% แล้ว`
      : `ยังไม่รวมภาษีมูลค่าเพิ่ม VAT ${rc.vat_rate || settings.VAT_RATE}%`;

  const copyTypeBadge = copyType === 'customer'
    ? '<div style="font-size: 11px; font-weight: 800; color: var(--receipt-accent); text-align: center; margin-bottom: 2px;">[ ฉบับคู่สัญญา / Customer Copy ]</div>'
    : copyType === 'merchant'
      ? '<div style="font-size: 11px; font-weight: 800; color: var(--receipt-accent); text-align: center; margin-bottom: 2px;">[ ฉบับตรวจสอบ / Merchant Copy ]</div>'
      : '';

  const docNo = rc.receipt_no || '-';
  const dateStr = formatThaiDate(rc.receipt_date || rc.created_at);
  const returnStr = formatThaiDate(rc.due_date);
  const bankQrUrl = escapeHtmlAttr(getBankQrUrl(settings, rc));

  let rawTitle = rc.receipt_title;
  if (!rawTitle) {
    if (rc.doc_type === 'quotation') rawTitle = 'ใบเสนอราคา';
    else if (rc.doc_type === 'invoice') rawTitle = 'ใบแจ้งหนี้ / ใบส่งสินค้า';
    else if (rc.doc_type === 'delivery') rawTitle = 'ใบส่งสินค้า';
    else if (rc.doc_type === 'receipt') rawTitle = 'ใบเสร็จรับเงิน';
    else rawTitle = 'บิลเงินสด';
  }

  const itemsPerPage = getReceiptRowLimit(isA4 ? 'A4' : 'A5');
  const totalPages = Math.max(1, Math.ceil(parsedItems.length / itemsPerPage));

  let htmlPages = '';

  for (let page = 0; page < totalPages; page++) {
    const isLastPage = page === totalPages - 1;
    const startIndex = page * itemsPerPage;

    let pageBadgeHTML = '';
    if (totalPages > 1) {
      pageBadgeHTML = `<div style="font-size: 11px; font-weight: 600; color: var(--receipt-text); text-align: center; margin-bottom: 2px;">(หน้า ${page + 1}/${totalPages})</div>`;
    }

    const rows: string[] = [];
    for (let i = 0; i < itemsPerPage; i++) {
      const itemIndex = startIndex + i;
      if (itemIndex < parsedItems.length) {
        const item = parsedItems[itemIndex];
        const name = getItemDisplayName(item);
        const qty = item.qty || '0';
        const unit = item.unit || 'ชิ้น';
        const price = Number(item.price) || 0;
        const period = getRentalPeriodText(item);
        const rowTotal = calculateRentalLineTotal(item);

        rows.push(`
        <tr style="height: 25px; box-sizing: border-box;">
          <td style="text-align: center; border-right: 1px solid var(--receipt-border); border-bottom: 1px solid var(--receipt-header); font-size: 16px;">${itemIndex + 1}</td>
          <td style="text-align: left; padding: 0 8px; border-right: 1px solid var(--receipt-border); border-bottom: 1px solid var(--receipt-header); font-size: 16px;">${name}</td>
          <td style="text-align: center; border-right: 1px solid var(--receipt-border); border-bottom: 1px solid var(--receipt-header); font-size: 16px;">${qty}</td>
          <td style="text-align: center; border-right: 1px solid var(--receipt-border); border-bottom: 1px solid var(--receipt-header); font-size: 16px;">${unit}</td>
          <td style="text-align: right; padding-right: 6px; border-right: 1px solid var(--receipt-border); border-bottom: 1px solid var(--receipt-header); font-size: 16px; font-family: monospace;">${price ? price.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '-'}</td>
          <td style="text-align: center; border-right: 1px solid var(--receipt-border); border-bottom: 1px solid var(--receipt-header); font-size: 16px;">${period}</td>
          <td style="text-align: right; padding-right: 12px; border-bottom: 1px solid var(--receipt-header); font-size: 16px; font-family: monospace;">${rowTotal ? rowTotal.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '-'}</td>
        </tr>
            `);
      } else {
        rows.push(`
        <tr style="height: 25px; box-sizing: border-box;">
          <td style="text-align: center; border-right: 1px solid var(--receipt-border); border-bottom: 1px solid var(--receipt-header);">&nbsp;</td>
          <td style="text-align: left; border-right: 1px solid var(--receipt-border); border-bottom: 1px solid var(--receipt-header);"></td>
          <td style="text-align: center; border-right: 1px solid var(--receipt-border); border-bottom: 1px solid var(--receipt-header);"></td>
          <td style="text-align: center; border-right: 1px solid var(--receipt-border); border-bottom: 1px solid var(--receipt-header);"></td>
          <td style="text-align: right; border-right: 1px solid var(--receipt-border); border-bottom: 1px solid var(--receipt-header);"></td>
          <td style="text-align: center; border-right: 1px solid var(--receipt-border); border-bottom: 1px solid var(--receipt-header);"></td>
          <td style="text-align: right; border-bottom: 1px solid var(--receipt-header);"></td>
        </tr>
            `);
      }
    }

    const footerVisibility = isLastPage ? 'visible' : 'hidden';
    const pageStart = isA4
      ? `<div class="a4-page receipt-source-page" style="width: ${A4_PAGE_PX.width}px; height: ${A4_PAGE_PX.height}px; padding: ${A4_PAGE_PX.padding}px; box-sizing: border-box; position: relative; margin: 0 auto; page-break-after: always; background: var(--doc-card); -webkit-print-color-adjust: exact; print-color-adjust: exact;">`
      : `<div class="a5-scaled-page" style="width: ${A5_PAGE_PX.width}px; height: ${A5_PAGE_PX.height}px; padding: 0; box-sizing: border-box; position: relative; margin: 0 auto; page-break-after: always; background: var(--doc-card); overflow: hidden; -webkit-print-color-adjust: exact; print-color-adjust: exact;"><div class="a5-a4-scale-frame" style="width: ${A4_PAGE_PX.width}px; height: ${A4_PAGE_PX.height}px; transform: scale(${A5_FROM_A4_SCALE}); transform-origin: top left; position: absolute; left: 0; top: 0;"><div class="a4-page receipt-source-page" style="width: ${A4_PAGE_PX.width}px; height: ${A4_PAGE_PX.height}px; padding: ${A4_PAGE_PX.padding}px; box-sizing: border-box; position: relative; margin: 0; page-break-after: always; background: var(--doc-card); -webkit-print-color-adjust: exact; print-color-adjust: exact;">`;
    const pageEnd = isA4 ? `</div>` : `</div></div></div>`;

    htmlPages += `
    ${pageStart}
      
      <!-- Real Receipt Content Area -->
      <div class="receipt-real" style="background: var(--doc-card); width: ${A4_PAGE_PX.contentWidth}px; max-width: ${A4_PAGE_PX.contentWidth}px; height: ${A4_PAGE_PX.contentHeight}px; box-sizing: border-box; margin: 0 auto; display: flex; flex-direction: column; color: var(--receipt-text); font-family: 'Sarabun', Tahoma, sans-serif; line-height: 1.15; font-size: 13px;">
        
        <!-- ส่วนหัวกระดาษ (Header Section) -->
        <div style="display: flex; justify-content: space-between; align-items: stretch; width: 100%; margin-top: 2px; margin-bottom: 3.5px; gap: 3.5px;">
            
          <!-- ชื่อร้านและข้อมูลติดต่อ -->
          <div style="flex: 1; border: 1.5px solid var(--receipt-border); border-radius: 6px; background: var(--receipt-bg); padding: 1px 10px 3px 10px; display: flex; flex-direction: column; align-items: center; justify-content: center; box-sizing: border-box; text-align: center; gap: 8px; overflow: hidden;">
            <h1 style="font-size: 30px; font-weight: 900; margin: 1px 0 0 0; line-height: 1.1; font-family: 'Prompt', 'Sarabun', sans-serif; color: var(--receipt-border); letter-spacing: -0.5px; max-width: 100%; white-space: nowrap; overflow: visible; text-overflow: clip;">
              ${settings.SHOP_NAME || 'จีรกิตติ์ ไม้แบบพลาสติก อุตรดิตถ์'}
            </h1>
            <div style="font-size: 16px; font-weight: 600; color: var(--receipt-text); font-family: 'Sarabun', sans-serif; line-height: 1.3;">
              ที่อยู่: ${settings.SHOP_ADDRESS || '98/12 หมู่ 3 ต.ท่าเสา อ.เมือง จ.อุตรดิตถ์ 53000'}
            </div>
            <div style="font-size: 16px; font-weight: 700; color: var(--receipt-text); display: flex; flex-wrap: wrap; justify-content: center; gap: 15px; line-height: 1.35;">
              <span style="display: flex; align-items: center; gap: 4px;"><span style="color: var(--receipt-accent);">📞</span> ${settings.SHOP_TELEPHONE || '093-170-3949'}</span>
              ${settings.SHOP_TELEPHONE_SECONDARY ? `<span style="display: flex; align-items: center; gap: 4px;"><span style="color: var(--receipt-accent);">📞</span> ${settings.SHOP_TELEPHONE_SECONDARY}</span>` : `<span style="display: flex; align-items: center; gap: 4px;"><span style="color: var(--receipt-accent);">📞</span> 093-282-8517</span>`}
              <span style="display: flex; align-items: center; gap: 4px;">
                <span style="background: var(--receipt-accent); color: var(--ui-on-primary); border-radius: 4px; padding: 1px 4px; font-size: 11px; font-weight: 800; line-height: 1;">ID</span> 
                <span style="font-family: monospace; font-weight: bold;">${settings.LINE_ID || 'Tong_01.'}</span>
              </span>
            </div>
          </div>

          <!-- ขวา: บิลเงินสดและวันที่ -->
          <div style="width: 230px; flex-shrink: 0;">
            <div style="height: 100%; border: 1.5px solid var(--receipt-border); border-radius: 6px; background: var(--receipt-bg); padding: 3.5px 8px; box-sizing: border-box; color: var(--receipt-text); display: flex; flex-direction: column; justify-content: space-between;">
              <div>
                <h2 style="font-size: 26px; font-weight: 800; margin: 0 3px 4px; text-align: center; line-height: 1.1; font-family: 'Prompt', 'Sarabun', sans-serif; color: var(--receipt-border);">${rawTitle}</h2>
                ${pageBadgeHTML}
                ${copyTypeBadge}
              </div>
              <div style="font-size: 16px; font-weight: bold; line-height: 1.4;">
                <!-- เลขที่ -->
                <div style="display: flex; align-items: baseline; margin-top: 2px; width: 100%;">
                  <span style="white-space: nowrap; color: var(--receipt-text);">เลขที่ : </span> 
                  <span style="flex: 1; text-align: left; padding-left: 8px; color: var(--receipt-border); font-family: monospace; font-weight: bold; border-bottom: 1.5px dotted var(--receipt-border);">${docNo}</span>
                </div>
                <!-- วันที่ -->
                <div style="display: flex; align-items: baseline; margin-top: 6px; width: 100%;">
                  <span style="white-space: nowrap; color: var(--receipt-text);">วันที่ : </span> 
                  <span style="flex: 1; text-align: left; padding-left: 8px; color: var(--receipt-border); font-weight: bold; border-bottom: 1.5px dotted var(--receipt-border);">${dateStr}</span>
                </div>
                <!-- กำหนดคืน -->
                <div style="display: flex; align-items: baseline; margin-top: 6px; color: var(--receipt-accent); width: 100%;">
                  <span style="white-space: nowrap;">กำหนดคืน : </span> 
                  <span style="flex: 1; text-align: left; padding-left: 8px; font-weight: bold; border-bottom: 1.5px dotted var(--receipt-accent);">${returnStr}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- กล่องบริการ -->
        <div style="border: 1.5px solid var(--receipt-border); border-radius: 6px; background: var(--receipt-bg); padding: 6px 8px; margin-bottom: 3.5px; font-size: 14px; line-height: 1.4; color: var(--receipt-text); font-weight: 600; text-align: left;">
          <span style="font-weight: 800; color: var(--receipt-border);">บริการให้เช่า :</span> ไม้แบบพลาสติก (แบบเสา, แบบเสาตอม่อ, แบบเสารั้ว, แบบคาน และนั่งร้าน)<br/>
          <span style="font-weight: 800; color: var(--receipt-border);">การบริการ :</span> - จัดส่งถึงที่ - แกะระยะแบบ(ฟรี) - รูปภาพแปลนระยะไม้แบบ(ฟรี)
        </div>

        <!-- ส่วนที่อยู่ลูกค้า -->
        <div class="customer-box"
             style="border: 1.5px solid var(--receipt-border); border-radius: 6px; font-size: 17px; display: flex; flex-direction: column; padding: 8px; background: var(--receipt-bg); color: var(--receipt-text); margin-bottom: 3.5px;">
          
          <div style="display: flex; width: 100%; gap: 15px;">
            <!-- Column 1: ชื่อลูกค้า, ที่อยู่ -->
            <div style="flex: 1; display: flex; flex-direction: column; gap: 6px;">
              <div style="display: flex; align-items: baseline; width: 100%;">
                <span style="color: var(--receipt-text); font-weight: bold; margin-right: 8px; white-space: nowrap;">ชื่อลูกค้า:</span>
                <span style="flex: 1; text-align: left; color: var(--receipt-border); font-weight: bold; border-bottom: 1.5px dotted var(--receipt-border);">${rc.customer_name || '&nbsp;'}</span>
              </div>
              <div style="display: flex; align-items: baseline; width: 100%;">
                <span style="color: var(--receipt-text); font-weight: bold; margin-right: 8px; white-space: nowrap;">ที่อยู่:</span>
                <span style="flex: 1; text-align: left; color: var(--receipt-border); font-weight: bold; border-bottom: 1.5px dotted var(--receipt-border);">${rc.address || '&nbsp;'}</span>
              </div>
            </div>

            <!-- Column 2: เบอร์โทร, สถานที่จัดส่ง -->
            <div style="flex: 1; display: flex; flex-direction: column; gap: 6px;">
              <div style="display: flex; align-items: baseline; width: 100%;">
                <span style="color: var(--receipt-text); font-weight: bold; margin-right: 8px; white-space: nowrap;">เบอร์โทร:</span>
                <span style="flex: 1; text-align: left; padding-left: 8px; color: var(--receipt-border); font-weight: bold; border-bottom: 1.5px dotted var(--receipt-border);">${rc.phone || '&nbsp;'}</span>
              </div>
              <div style="display: flex; align-items: baseline; width: 100%;">
                <span style="color: var(--receipt-text); font-weight: bold; margin-right: 8px; white-space: nowrap;">สถานที่จัดส่ง:</span>
                <span style="flex: 1; text-align: left; padding-left: 8px; color: var(--receipt-border); font-weight: bold; border-bottom: 1.5px dotted var(--receipt-border);">${rc.delivery_location || rc.address || '&nbsp;'}</span>
              </div>
            </div>
          </div>

        </div>

        <!-- ตารางรายการสินค้า -->
        <div style="border: 1.5px solid var(--receipt-border); border-radius: 6px; overflow: hidden; background: var(--receipt-bg); margin-bottom: 3.5px;">
          <table style="width: 100%; border-collapse: collapse; table-layout: fixed;">
            <thead>
              <tr style="background: var(--receipt-header); text-align: center; color: var(--receipt-text); height: 26px;">
                <th style="width: 47px; border-right: 1px solid var(--receipt-border); border-bottom: 1.5px solid var(--receipt-border); font-weight: bold; font-size: 17px;">ลำดับ</th>
                <th style="width: 319px; border-right: 1px solid var(--receipt-border); border-bottom: 1.5px solid var(--receipt-border); font-weight: bold; font-size: 17px;">รายการ (ขนาด/ระยะเวลาเช่า)</th>
                <th style="width: 57px; border-right: 1px solid var(--receipt-border); border-bottom: 1.5px solid var(--receipt-border); font-weight: bold; font-size: 17px;">จำนวน</th>
                <th style="width: 57px; border-right: 1px solid var(--receipt-border); border-bottom: 1.5px solid var(--receipt-border); font-weight: bold; font-size: 17px;">หน่วย</th>
                <th style="width: 79px; border-right: 1px solid var(--receipt-border); border-bottom: 1.5px solid var(--receipt-border); font-weight: bold; font-size: 17px;">ราคา</th>
                <th style="width: 65px; border-right: 1px solid var(--receipt-border); border-bottom: 1.5px solid var(--receipt-border); font-weight: bold; font-size: 17px;">การเช่า</th>
                <th style="width: 94px; border-bottom: 1.5px solid var(--receipt-border); font-weight: bold; font-size: 17px;">จำนวนเงิน</th>
              </tr>
            </thead>
            <tbody style="background: var(--receipt-bg); color: var(--receipt-text);">
              ${rows.join('')}
            </tbody>
          </table>
        </div>

        <!-- ส่วนท้าย ตัดการแสดงผลถ้าไม่ใช่หน้าสุดท้าย -->
        <div style="visibility: ${footerVisibility}; display: flex; flex-direction: column; flex-shrink: 0; gap: 3.5px; margin-top: 0px;">
          
          <!-- ระดับบน: บัญชีธนาคาร และ สรุปยอด -->
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 3.5px;">
            <!-- ซ้าย: กล่องข้อมูลบัญชีธนาคาร -->
            <div style="flex: 1 1 0; min-width: 0; box-sizing: border-box;">
              <div style="border: 1.5px solid var(--receipt-border); border-radius: 6px; display: inline-flex; align-items: flex-start; justify-content: space-between; background: var(--receipt-bg); box-sizing: border-box; padding: 4px 6px; gap: 6px; max-width: 100%; overflow: hidden;">
                <div style="font-size: 15.5px; font-weight: bold; line-height: 1.22; color: var(--receipt-text); flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: flex-start; padding: 0; overflow: hidden;">
                  <div style="display: flex; justify-content: flex-start; gap: 5px; align-items: baseline; margin: 0;"><span style="width: 82px; min-width: 82px; flex-shrink: 0; white-space: nowrap;">ธนาคาร :</span><span style="color: var(--receipt-accent); font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${settings.BANK_NAME || 'ออมสิน (GSB)'}</span></div>
                  <div style="display: flex; justify-content: flex-start; gap: 5px; align-items: baseline; margin: 0;"><span style="width: 82px; min-width: 82px; flex-shrink: 0; white-space: nowrap;">เลขบัญชี :</span><span style="font-size: 15.5px; font-weight: 800; font-family: monospace; letter-spacing: 0.4px; color: var(--receipt-border); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${settings.BANK_ACCOUNT_NO || '020-4754-01020'}</span></div>
                  <div style="display: flex; justify-content: flex-start; gap: 5px; align-items: baseline; margin: 0;"><span style="width: 82px; min-width: 82px; flex-shrink: 0; white-space: nowrap;">ชื่อบัญชี :</span><span style="font-weight: 800; color: var(--receipt-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${settings.BANK_ACCOUNT_OWNER || 'ภัทราภร ทองสำนัก'}</span></div>
                  <div style="font-weight: 800; color: var(--receipt-accent); font-size: 14.5px; margin-top: 3px; text-align: center; white-space: nowrap;">ขอบคุณที่ใช้บริการครับ 🙏</div>
                </div>
                ${bankQrUrl
                  ? `<div style="border: 2px solid var(--receipt-border); padding: 2px; border-radius: 0; background: var(--doc-card); display: flex; justify-content: center; align-items: center; flex-shrink: 0; width: 76px; height: 76px; box-sizing: border-box;"><img src="${bankQrUrl}" crossorigin="anonymous" loading="eager" decoding="sync" style="width: 100%; height: 100%; max-width: 68px; max-height: 68px; object-fit: contain; display: block; margin: auto;" alt="Bank QR"/></div>`
                  : `<div style="border: 2px solid var(--receipt-border); padding: 4px 6px; border-radius: 0; background: var(--doc-card); display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; box-sizing: border-box; color: var(--receipt-border); font-size: 10px; line-height: 1.15; font-weight: 800; text-align: center; white-space: nowrap; margin-top: 2px;">ยังไม่ได้ตั้งค่า QR</div>`}
              </div>
            </div>

            <!-- ขวา: กล่องรวมยอด -->
            <div style="width: 332.5px; box-sizing: border-box; display: flex; justify-content: flex-end;">
              <div style="border: 1.5px solid var(--receipt-border); border-radius: 6px; background: var(--receipt-bg); padding: 5px 8px; text-align: right; font-size: 16px; color: var(--doc-text); display: inline-flex; flex-direction: column; justify-content: flex-start; box-sizing: border-box; line-height: 1.18; overflow: hidden; min-width: 100%;">
                <div style="display: flex; justify-content: space-between; align-items: baseline; gap: 10px; font-weight: bold; margin-bottom: 1px; color: var(--doc-soft);">
                  <span style="white-space: nowrap;">มูลค่ายอดอุปกรณ์รวม:</span>
                  <span style="font-family: monospace; min-width: 84px; text-align: right; white-space: nowrap;">${(rc.subtotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: baseline; gap: 10px; font-weight: bold; color: var(--doc-soft); margin-bottom: 2px;">
                  <span style="white-space: nowrap;">ภาษีมูลค่าเพิ่ม:</span>
                  <span style="font-family: monospace; min-width: 84px; text-align: right; white-space: nowrap;">+ ${(rc.vat || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: baseline; gap: 10px; font-weight: 900; font-size: 24px; border-top: 1.5px dotted var(--receipt-border); padding-top: 3px; margin-top: 1px; color: var(--receipt-border);">
                  <span style="white-space: nowrap;">ยอดรวมสุทธิ:</span>
                  <span style="font-family: monospace; min-width: 96px; text-align: right; white-space: nowrap;">${(rc.grand_total || rc.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- ระดับกลาง: กล่องเงื่อนไข 5 ข้อ -->
          <div style="width: 100%; box-sizing: border-box;">
            <div style="border: 1.5px solid var(--receipt-border); border-radius: 6px; background: var(--receipt-bg); padding: 4px 8px; font-size: 13px; line-height: 1.35; color: var(--receipt-text); box-sizing: border-box;">
              <div style="font-weight: 650; display: flex; gap: 15px;">
                <div style="flex: 1; display: flex; flex-direction: column; justify-content: space-evenly;">
                  <div style="font-weight: bold; font-size: 13px; color: var(--receipt-accent); display: flex; align-items: center; gap: 4px;">
                    <span style="font-size: 12px;">⚠️</span> ข้อตกลงที่สำคัญ
                  </div>
                  <span>1. ห้ามดัดแปลง ตัดต่อ หรือเปลี่ยนตำแหน่งชิ้นส่วนไม้แบบโดยไม่ได้รับอนุญาต</span>
                  <span>2. หากอุปกรณ์สูญหายหรือเสียหาย ผู้เช่าต้องชดใช้ซ่อมแซมตามราคาทุนจริง</span>
                </div>
                <div style="flex: 1; display: flex; flex-direction: column; justify-content: space-evenly;">
                  <span>3. โปรดหลีกเลี่ยงการตอกตะปูและกระทบโดยตรงเพื่อบำรุงรักษาวัสดุ</span>
                  <span>4. โปรดตรวจสอบความสมบูรณ์ของสินค้าและอุปกรณ์ ณ วันส่งมอบ</span>
                  <span>5. โปรดส่งคืนไม้แบบตามกำหนดเวลาเพื่อหลีกเลี่ยงอัตราค่าปรับ</span>
                </div>
              </div>
            </div>
          </div>

          <!-- ระดับล่าง: ลายเซ็น -->
          <div style="width: 100%; height: 88.5px; border: 1.5px solid var(--receipt-border); border-radius: 6px; background: var(--receipt-bg); padding: 8px; display: flex; justify-content: space-evenly; box-sizing: border-box; margin-top: 0;">
            <div style="width: 250px; display: flex; flex-direction: column; justify-content: flex-end; text-align: center;">
              <div style="width: 117.5px; height: 40px; margin: 0 auto 5px auto; display: flex; align-items: flex-end; justify-content: center; color: var(--doc-soft); font-size: 13.5px; padding-bottom: 2px;">
                ${rc.customer_signature ? `<img src="${rc.customer_signature}" style="max-height: 40px; max-width: 100px; object-fit: contain;" />` : ''}
              </div>
              <div style="border-bottom: 1.2px dashed var(--receipt-text); margin-bottom: 6px;"></div>
              <p style="margin: 0; color: var(--receipt-text); font-weight: bold; font-size: 13.5px;">ผู้รับสินค้า / ผู้จ่ายเงิน</p>
            </div>
            
            <div style="width: 250px; display: flex; flex-direction: column; justify-content: flex-end; text-align: center;">
              <div style="margin-bottom: 2px; font-weight: bold; font-size: 13.5px; color: var(--receipt-text);">${settings.BANK_ACCOUNT_OWNER || 'ภัทราภร ทองสำนัก'}</div>
              <div style="border-bottom: 1.2px dashed var(--receipt-text); margin-bottom: 6px;"></div>
              <p style="margin: 0; color: var(--receipt-text); font-weight: bold; font-size: 13.5px;">ผู้รับเงิน / ผู้ส่งมอบสินค้า</p>
            </div>
          </div>

        </div>

      </div>
    ${pageEnd}
    `;
  }

  return htmlPages;
}

export function getReceiptIframeHtml(rc: any, isA4: boolean, settings: any, copyType?: string, isPreview: boolean = false): string {
  let innerHtml = getReceiptPrintHtml(rc, isA4, settings, copyType);
  if (isPreview) {
    innerHtml = innerHtml.replace(/class="a4-page receipt-source-page"/g, 'class="a4-page receipt-source-page a4-preview-boundary"');
  }
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8"/>
        <style>
        :root {
  --doc-card: #ffffff;
  --doc-border: #991b1b;
  --doc-text: #450a0a;
  --doc-soft: #7f1d1d;

  --receipt-bg: #fef2f2;
  --receipt-text: #450a0a;
  --receipt-border: #991b1b;
  --receipt-header: #fca5a5;
  --receipt-accent: #991b1b;

  --ui-on-primary: #ffffff;
  --ui-shadow-soft: 0 12px 32px rgba(0, 0, 0, 0.14);
}
          * {
            box-sizing: border-box;
          }
          html, body {
            margin: 0;
            padding: ${isPreview ? '0' : '20px 0'};
            min-height: 100%;
            background-color: ${isPreview ? 'transparent' : 'var(--doc-border)'};
            font-family: 'Sarabun', 'Prompt', sans-serif;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            ${isPreview ? 'overflow: hidden;' : ''}
          }
          body {
            display: flex;
            flex-direction: column;
            justify-content: flex-start;
            align-items: center;
            gap: ${isPreview ? '0' : '20px'};
          }
          .a4-preview-boundary {
            background-color: var(--doc-border);
            box-shadow: var(--ui-shadow-soft);
          }
          @media print {
            body { padding: 0; margin: 0; }
            .a4-preview-boundary { background-color: transparent !important; border: none !important; box-shadow: none !important; }
          }
        </style>
      </head>
      <body>
        ${innerHtml}
      </body>
    </html>
  `;
}



export function printReceipt(rc: any, paperSize: 'A4' | 'A5', settings: any): void {
  const generatedHtml = getReceiptPrintHtml(rc, paperSize === 'A4', settings);

  // Create or reuse an invisible iframe for printing to bypass popup blockers
  let iframe = document.getElementById('print-iframe') as HTMLIFrameElement;
  if (!iframe) {
    iframe = document.createElement('iframe');
    iframe.id = 'print-iframe';
    iframe.style.position = 'absolute';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);
  }

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    alert('Cannot create print window. Please try again.');
    return;
  }

  doc.open();
  doc.write(`
    <html>
      <head>
        <title>บิลสัญญาเช่า - ${rc.receipt_no}</title>
        <meta charset="utf-8"/>
        <style>
        :root {
  --doc-card: #ffffff;
  --doc-border: #991b1b;
  --doc-text: #450a0a;
  --doc-soft: #7f1d1d;

  --receipt-bg: #fef2f2;
  --receipt-text: #450a0a;
  --receipt-border: #991b1b;
  --receipt-header: #fca5a5;
  --receipt-accent: #991b1b;

  --ui-on-primary: #ffffff;
}
          body { 
            font-family: 'Sarabun', 'Prompt', sans-serif; 
            margin: 0; 
            padding: 20px; 
            background: var(--doc-card); 
          }
          @media print {
            body { padding: 0; margin: 0; }
            @page { 
              size: ${paperSize === 'A4' ? 'A4' : 'A5 portrait'}; 
              margin: 0 !important; 
            }
          }
        </style>
      </head>
      <body>
        <div class="receipt-paper ${paperSize === 'A4' ? 'receipt-a4' : 'receipt-portrait'}">
          ${generatedHtml}
        </div>
        <script>
          // Wait slightly for fonts and images to be completely safe
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 500);
          }
        </script>
      </body>
    </html>
  `);
  doc.close();
}

export async function downloadReceiptPdf(rc: any, paperSize: 'A4' | 'A5', settings: any): Promise<void> {
  printReceipt(rc, paperSize, settings);
}


export async function downloadReceiptImage(rc: any, paperSize: 'A4' | 'A5', settings: any): Promise<void> {
  const isA5 = paperSize === 'A5';
  const container = document.createElement('div');
  Object.assign(container.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: isA5 ? '148mm' : '210mm',
    height: isA5 ? '210mm' : '297mm',
    overflow: 'hidden',
    backgroundColor: 'var(--doc-card)',
    pointerEvents: 'none',
    zIndex: '-1'
  });

  // A5 ใช้ต้นฉบับ A4 แล้วย่อทั้งหน้า เพื่อไม่ให้ QR/ท้ายบิลถูกตัดบนมือถือหรือ iPad
  container.style.setProperty('--receipt-accent', '#991b1b');
  container.style.setProperty('--ui-on-primary', '#ffffff');

  container.innerHTML = getReceiptPrintHtml(rc, paperSize === 'A4', settings);
  document.body.appendChild(container);

  try {
    const d = new Date();
    const dateStr = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
    const prefix = `INVOICE-${paperSize}-${dateStr}`;

    await exportA4ToImage({
      element: container,
      prefix,
      isLandscape: false,
      paperSize
    });
  } catch (err) {
    console.error('Save to Image failed:', err);
    alert('Cannot create bill image. Please try again.');
  } finally {
    document.body.removeChild(container);
  }
}
