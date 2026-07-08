/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { JirakitDB } from '../db';
import { Receipt, Product } from '../types';
import { RefreshCw, Search, Calendar, AlertTriangle, AlertCircle, CheckCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { DataTable } from './ui/DataTable';

interface ReturnsProps {
  onNavigate: (menu: string) => void;
  triggerRefresh: () => void;
  refreshCount: number;
}

const THAI_MONTHS_FULL = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

const THAI_WEEKDAYS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

const toDateValue = (date: Date) => {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const getSafeDate = (value: string) => {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

const formatThaiDisplayDate = (value: string) => {
  const date = getSafeDate(value);
  return date.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' });
};

const buildCalendarDays = (visibleMonth: Date) => {
  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const startDay = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: Array<{ value: string; day: number; inMonth: boolean }> = [];

  for (let i = 0; i < startDay; i += 1) {
    const d = new Date(year, month, i - startDay + 1);
    days.push({ value: toDateValue(d), day: d.getDate(), inMonth: false });
  }

  for (let d = 1; d <= daysInMonth; d += 1) {
    const date = new Date(year, month, d);
    days.push({ value: toDateValue(date), day: d, inMonth: true });
  }

  while (days.length % 7 !== 0) {
    const last = getSafeDate(days[days.length - 1].value);
    const next = new Date(last);
    next.setDate(last.getDate() + 1);
    days.push({ value: toDateValue(next), day: next.getDate(), inMonth: false });
  }

  return days;
};

export default function Returns({ onNavigate, triggerRefresh, refreshCount }: ReturnsProps) {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'renting' | 'overdue'>('renting');
  const [returnCalendarOpen, setReturnCalendarOpen] = useState(false);
  const [draftReturnDate, setDraftReturnDate] = useState(new Date().toISOString().slice(0, 10));
  const [visibleCalendarMonth, setVisibleCalendarMonth] = useState(() => getSafeDate(new Date().toISOString().slice(0, 10)));

  // Return Wizard States
  const [wizardReceipt, setWizardReceipt] = useState<Receipt | null>(null);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [returnDate, setReturnDate] = useState(new Date().toISOString().slice(0, 10));
  
  // Array tracking what is being returned: { line_id, qty_returned_now }
  const [returnItems, setReturnItems] = useState<any[]>([]);
  
  // Financial inputs collected during process
  const [collectedPayment, setCollectedPayment] = useState(0);
  const [note, setNote] = useState('');

  useEffect(() => {
    setReceipts(JirakitDB.getReceipts());
  }, [refreshCount]);

  // Filters
  const rentedReceipts = receipts.filter(r => {
    // only view receipts that have rent items
    const items = JSON.parse(r.items_json || '[]');
    const hasRent = items.some((i: any) => i.line_mode === 'rent');
    if (!hasRent) return false;

    const matchesSearch = r.receipt_no.toLowerCase().includes(searchQuery.toLowerCase()) || r.customer_name.toLowerCase().includes(searchQuery.toLowerCase());
    
    const isOverdue = new Date(r.due_date) < new Date() && (r.return_status === 'กำลังเช่า' || r.return_status === 'คืนบางส่วน');
    const matchesFilter = 
      filterMode === 'all' || 
      (filterMode === 'renting' && (r.return_status === 'กำลังเช่า' || r.return_status === 'คืนบางส่วน')) ||
      (filterMode === 'overdue' && isOverdue);

    return matchesSearch && matchesFilter;
  });

  const handleOpenWizard = (r: Receipt) => {
    setWizardReceipt(r);
    setWizardStep(1);
    const today = new Date().toISOString().slice(0, 10);
    setReturnDate(today);
    setDraftReturnDate(today);
    setVisibleCalendarMonth(getSafeDate(today));
    setReturnCalendarOpen(false);
    setCollectedPayment(r.debt_amount); // default to remaining debt
    setNote('');

    const items = JSON.parse(r.items_json || '[]');
    const tracked = items
      .filter((i: any) => i.line_mode === 'rent')
      .map((i: any) => ({
        line_id: i.line_id,
        receipt_name: i.receipt_name,
        qty_rented: i.qty,
        qty_returned_already: i.qty_returned || 0,
        qty_open: i.qty - (i.qty_returned || 0),
        qty_now_return: i.qty - (i.qty_returned || 0), // Default to returning everything left
        price: i.price,
        rent_days: i.rent_days || 1,
        unit: i.unit
      }));
    setReturnItems(tracked);
  };

  const handleQtyChange = (idx: number, amount: number) => {
    const next = [...returnItems];
    const item = next[idx];
    item.qty_now_return = Math.max(0, Math.min(item.qty_open, item.qty_now_return + amount));
    setReturnItems(next);
  };

  const handleToggleSelectAll = () => {
    const isAllSelected = returnItems.length > 0 && returnItems.every(i => i.qty_now_return === i.qty_open);
    const next = returnItems.map(i => ({
      ...i,
      qty_now_return: isAllSelected ? 0 : i.qty_open
    }));
    setReturnItems(next);
  };

  const calendarDays = useMemo(() => buildCalendarDays(visibleCalendarMonth), [visibleCalendarMonth]);
  const todayValue = toDateValue(new Date());

  const openReturnCalendar = () => {
    const safeValue = returnDate || toDateValue(new Date());
    setDraftReturnDate(safeValue);
    setVisibleCalendarMonth(getSafeDate(safeValue));
    setReturnCalendarOpen(true);
  };

  const changeCalendarMonth = (amount: number) => {
    setVisibleCalendarMonth(current => new Date(current.getFullYear(), current.getMonth() + amount, 1));
  };

  const commitReturnDate = () => {
    setReturnDate(draftReturnDate);
    setReturnCalendarOpen(false);
  };

  const calculateReturnWizardFinance = () => {
    if (!wizardReceipt) return { daysLate: 0, penalty: 0, priorDebt: 0, totalDue: 0, remainingDebt: 0, selectedRentingValue: 0 };

    const selectedReturnRows = returnItems.filter(i => i.qty_now_return > 0);
    const selectedRentingValue = selectedReturnRows.reduce((sum, item) => sum + (item.price * item.qty_now_return * item.rent_days), 0);

    const due = new Date(wizardReceipt.due_date);
    const ret = new Date(returnDate);
    let daysLate = 0;
    if (ret > due) {
      daysLate = Math.max(0, Math.ceil((ret.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)));
    }

    const ratePct = JirakitDB.getSettings().PENALTY_RATE / 100; // e.g. 1.5% -> 0.015
    const penalty = daysLate > 0 ? selectedRentingValue * daysLate * ratePct : 0;
    const priorDebt = wizardReceipt.debt_amount;
    const refundableDeposit = wizardReceipt.deposit || 0;
    const totalDue = priorDebt + penalty - refundableDeposit;
    const remainingDebt = Math.max(0, totalDue - collectedPayment);

    return {
      daysLate,
      penalty,
      priorDebt,
      refundableDeposit,
      totalDue,
      remainingDebt,
      selectedRentingValue
    };
  };

  const currentWizardFinance = calculateReturnWizardFinance();

  const handleNextStep1 = () => {
    if (!returnItems.some(i => i.qty_now_return > 0)) {
      alert('Please select at least 1 item to return to the warehouse.');
      return;
    }
    // Update default collected receipt total after penalty
    const { totalDue } = calculateReturnWizardFinance();
    setCollectedPayment(totalDue);
    setWizardStep(2);
  };

  const handleConfirmReturn = async () => {
    if (!wizardReceipt) return;

    const payload = {
      receipt_id: wizardReceipt.receipt_id,
      items: returnItems
        .filter(i => i.qty_now_return > 0)
        .map(i => ({
          line_id: i.line_id,
          qty: i.qty_now_return
        })),
      penalty_amount: currentWizardFinance.penalty,
      paid_amount: collectedPayment,
      refund_deposit: 0,
      return_date: returnDate,
      payment_method: 'เงินสด',
      note
    };

    try {
      await JirakitDB.processReturn(payload);
      alert('บันทึกการส่งคืนคลังและอัปเดตบัญชี/สต็อกวัสดุสําเร็จเรียบร้อย!');
      setWizardReceipt(null);
      triggerRefresh();
    } catch (err: any) {
      alert(`Cannot process the return: ${err?.message || err}`);
    }
  };

  return (
    <div className="space-y-6 max-w-full mx-auto w-full">
      {/* Return Table List View */}
      <div>
        <h2 className="text-3xl font-black text-[var(--text-main)] flex items-center gap-2">
          <RefreshCw size={30} />
          คืน อุปกรณ์
        </h2>
      </div>

      {/* Search + Filter Buttons */}
      <div className="flex w-full flex-nowrap items-center gap-3 overflow-x-auto">
        <div className="relative min-w-[260px] flex-1">
          <Search className="absolute left-3 top-3 text-[var(--text-main)]" size={16} />
          <Input
            type="text"
            className="w-full ai-panel border border-[var(--ui-border)] rounded-xl pl-10 pr-4 py-2 text-sm"
            placeholder="ค้นหาตามเลขที่บิลเอกสาร หรือ ชื่อลูกค้า..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="jrk-tabs-clean flex shrink-0 flex-nowrap items-center gap-2">
          {(['all', 'renting', 'overdue'] as const).map(tab => {
            const tabLabels = {
              all: 'ทั้งหมด',
              renting: 'กำลังเช่า',
              overdue: 'เลยกำหนดคืน'
            };

            return (
              <Button
                type="button"
                key={tab}
                variant={filterMode === tab ? 'primary' : 'toolbar'}
                size="sm"
                onClick={() => setFilterMode(tab)}
                className="shrink-0 rounded-full px-4 whitespace-nowrap"
                aria-pressed={filterMode === tab}
              >
                {tabLabels[tab]}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Database Table */}
      <DataTable wrapperClassName="rounded-2xl shadow-none" className="min-w-[760px] w-full table-fixed text-center text-xs font-bold">
        <colgroup>
          <col className="w-[20%]" />
          <col className="w-[28%]" />
          <col className="w-[14%]" />
          <col className="w-[14%]" />
          <col className="w-[11%]" />
          <col className="w-[13%]" />
        </colgroup>
        <thead>
          <tr className="text-[var(--text-main)] h-10">
            <th className="p-3 text-center">เลขที่เอกสาร</th>
            <th className="p-3 text-center">พาร์ตเนอร์ / ลูกค้า</th>
            <th className="p-3 text-center">กำหนดคืน</th>
            <th className="p-3 text-center">ยอดคงค้าง</th>
            <th className="p-3 text-center">สถานะรวม</th>
            <th className="p-3 text-center">รับของคืน</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--ui-border)] text-[var(--text-main)]">
          {rentedReceipts.length === 0 ? (
            <tr>
              <td colSpan={6} className="text-center py-12 text-[var(--text-soft)]">
                <p className="font-semibold text-sm">ไม่พบบิลการเช่าอุปกรณ์ตามการคัดกรอง</p>
              </td>
            </tr>
          ) : (
            (Array.isArray(rentedReceipts) ? rentedReceipts : []).map(r => (
              <tr key={r.receipt_id} className="h-14 transition-colors hover:bg-[var(--ui-hover)]">
                <td className="p-3 text-center font-extrabold break-words">{r.receipt_no}</td>
                <td className="p-3 text-center break-words">{r.customer_name}</td>
                <td className="p-3 text-center">{r.due_date}</td>
                <td className="p-3 text-center font-black">{r.debt_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td className="p-3 text-center">
                  <span className="ds-status-badge mx-auto px-2.5 py-0.5 text-[10px]">
                    {r.return_status || 'กำลังเช่า'}
                  </span>
                </td>
                <td className="p-3 text-center">
                  <Button type="button" onClick={() => handleOpenWizard(r)} variant="toolbar" size="sm" className="mx-auto rounded-full px-3">
                    <RefreshCw size={12} /> ดำเนินการคืน
                  </Button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </DataTable>

      {/* Return Wizard Modal Form */}
      {wizardReceipt && (
        <div className="fixed inset-0 bg-[var(--ui-overlay)] flex items-center justify-center z-50 p-4">
          <div className="jrk-one-frame rounded-3xl max-w-2xl w-full flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200 overflow-hidden">
            {/* Wizard Header */}
            <div className="bg-[var(--ui-surface)] text-[var(--text-main)] px-6 py-4 flex justify-between items-center border-b border-[var(--ui-border)]">
              <div>
                <h3 className="text-md font-bold">บันทึกส่งของคืนคลัง บิล #: {wizardReceipt.receipt_no}</h3>
                <p className="text-[11px] text-[var(--text-soft)] mt-1">ลูกค้า: {wizardReceipt.customer_name}</p>
              </div>
              <Button type="button" variant="icon" size="sm" onClick={() => setWizardReceipt(null)} className="h-9 w-9 p-0 text-xl">×</Button>
            </div>

            {/* Steps state bar */}
            <div className="bg-[var(--ui-surface)] border-b border-[var(--ui-border)] p-4 flex justify-around items-center text-xs font-bold">
              <span className={`flex items-center gap-2 ${wizardStep === 1 ? 'text-[var(--text-main)]' : 'text-[var(--text-soft)]'}`}>
                <span className={`w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-black ${
                  wizardStep >= 1 ? 'jrk-pill-active text-[var(--ui-on-primary)]' : 'jrk-pill-soft text-[var(--text-main)]'
                }`}>1</span>
                เลือกจำนวนที่ส่งคืน
              </span>
              <span className="w-12 h-px bg-[var(--ui-border)]"></span>
              <span className={`flex items-center gap-2 ${wizardStep === 2 ? 'text-[var(--text-main)]' : 'text-[var(--text-soft)]'}`}>
                <span className={`w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-black ${
                  wizardStep >= 2 ? 'jrk-pill-active text-[var(--ui-on-primary)]' : 'jrk-pill-soft text-[var(--text-main)]'
                }`}>2</span>
                ตรวจค่าปรับ/ชำระเงิน
              </span>
              <span className="w-12 h-px bg-[var(--ui-border)]"></span>
              <span className={`flex items-center gap-2 ${wizardStep === 3 ? 'text-[var(--text-main)]' : 'text-[var(--text-soft)]'}`}>
                <span className={`w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-black ${
                  wizardStep >= 3 ? 'jrk-pill-active text-[var(--ui-on-primary)]' : 'jrk-pill-soft text-[var(--text-main)]'
                }`}>3</span>
                ยืนยันปิดรายงาน
              </span>
            </div>

            {/* Wizard Body content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {wizardStep === 1 && (
                <div className="space-y-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <label className="text-xs font-bold text-[var(--text-soft)]">ระบุวันที่รับคืนเข้าคลัง</label>
                    <div className="flex w-full max-w-md items-center gap-2 sm:w-auto">
                      <div className="flex min-h-11 flex-1 items-center rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)] px-4 text-sm font-black text-[var(--text-main)]">
                        {formatThaiDisplayDate(returnDate)}
                      </div>
                      <Button type="button" variant="toolbar" size="md" onClick={openReturnCalendar} className="h-11 shrink-0 rounded-xl px-4">
                        <Calendar size={15} /> ปฏิทิน
                      </Button>
                    </div>
                  </div>

                  {returnCalendarOpen && (
                    <div className="jrk-one-frame rounded-2xl p-4">
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <Button type="button" variant="toolbar" size="sm" onClick={() => changeCalendarMonth(-1)} aria-label="เดือนก่อนหน้า">
                          <ChevronLeft size={16} />
                        </Button>
                        <div className="text-center text-sm font-black text-[var(--text-main)]">
                          {THAI_MONTHS_FULL[visibleCalendarMonth.getMonth()]} {visibleCalendarMonth.getFullYear() + 543}
                        </div>
                        <Button type="button" variant="toolbar" size="sm" onClick={() => changeCalendarMonth(1)} aria-label="เดือนถัดไป">
                          <ChevronRight size={16} />
                        </Button>
                      </div>

                      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-black text-[var(--text-soft)]">
                        {THAI_WEEKDAYS.map(day => <span key={day}>{day}</span>)}
                      </div>

                      <div className="mt-2 grid grid-cols-7 gap-1">
                        {calendarDays.map(day => {
                          const isSelected = draftReturnDate === day.value;
                          const isToday = todayValue === day.value;
                          return (
                            <Button
                              key={day.value}
                              type="button"
                              variant={isSelected ? 'primary' : 'toolbar'}
                              size="sm"
                              onClick={() => {
                                setDraftReturnDate(day.value);
                                setVisibleCalendarMonth(getSafeDate(day.value));
                              }}
                              className={`aspect-square h-10 min-h-0 rounded-xl p-0 text-sm ${!day.inMonth ? 'opacity-45' : ''} ${isToday && !isSelected ? 'border-[var(--ui-primary)]' : ''}`}
                            >
                              {day.day}
                            </Button>
                          );
                        })}
                      </div>

                      <div className="mt-4 flex items-center justify-between gap-2 rounded-xl bg-[var(--ui-panel-soft)] px-3 py-2 text-xs font-extrabold text-[var(--text-main)]">
                        <span>วันที่เลือก: {formatThaiDisplayDate(draftReturnDate)}</span>
                        <div className="flex gap-2">
                          <Button type="button" variant="ghost" size="sm" onClick={() => setReturnCalendarOpen(false)}>ปิด</Button>
                          <Button type="button" variant="primary" size="sm" onClick={commitReturnDate}>ใช้วันที่นี้</Button>
                        </div>
                      </div>
                    </div>
                  )}

                  <DataTable wrapperClassName="rounded-2xl shadow-none" className="min-w-[640px] w-full table-fixed text-center text-xs font-bold">
                    <colgroup>
                      <col className="w-[38%]" />
                      <col className="w-[16%]" />
                      <col className="w-[16%]" />
                      <col className="w-[30%]" />
                    </colgroup>
                    <thead>
                      <tr className="text-[var(--text-main)] h-10">
                        <th className="p-2 text-center">แบบรายละเอียด</th>
                        <th className="p-2 text-center">ปล่อยเช่า</th>
                        <th className="p-2 text-center">คืนแล้ว</th>
                        <th className="p-2 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <span>จำนวนคืนรอบนี้</span>
                            <Button type="button" variant="primary" size="sm" onClick={handleToggleSelectAll} className="h-8 rounded-full px-3 text-[10px]">
                              {returnItems.length > 0 && returnItems.every(i => i.qty_now_return === i.qty_open) ? 'ล้างทั้งหมด' : 'เลือกทั้งหมด'}
                            </Button>
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--ui-border)] text-[var(--text-main)]">
                      {(Array.isArray(returnItems) ? returnItems : []).map((item, idx) => (
                        <tr key={item.line_id} className="h-14">
                          <td className="p-2 text-center break-words font-extrabold">{item.receipt_name}</td>
                          <td className="p-2 text-center">{item.qty_rented}</td>
                          <td className="p-2 text-center">{item.qty_returned_already}</td>
                          <td className="p-2 text-center">
                            <div className="mx-auto flex w-full max-w-[11rem] items-center justify-center gap-2">
                              <Button type="button" variant="toolbar" size="sm" onClick={() => handleQtyChange(idx, -1)} className="h-9 w-9 rounded-xl p-0 text-base">-</Button>
                              <span className="min-w-10 text-center text-base font-black text-[var(--text-main)]">{item.qty_now_return}</span>
                              <Button type="button" variant="toolbar" size="sm" onClick={() => handleQtyChange(idx, 1)} className="h-9 w-9 rounded-xl p-0 text-base">+</Button>
                              <span className="min-w-8 text-center text-[11px] font-bold text-[var(--text-soft)]">/{item.qty_open}</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </DataTable>

                  <div className="flex gap-3 pt-4 border-t">
                    <Button type="button" variant="secondary" onClick={() => setWizardReceipt(null)} className="flex-1">
                      ยกเลิก
                    </Button>
                    <Button type="button" variant="primary" onClick={handleNextStep1} className="flex-1">
                      ถัดไป: สรุปค่าปรับและเงินค้าง ›
                    </Button>
                  </div>
                </div>
              )}

              {wizardStep === 2 && (
                <div className="space-y-4">
                  {/* Highlight alert if late */}
                  {currentWizardFinance.daysLate > 0 ? (
                    <div className="jrk-alert-line p-4 rounded-xl flex items-start gap-2.5">
                      <AlertTriangle className="text-[var(--ui-warning)] shrink-0 mt-0.5" size={16} />
                      <div className="text-xs">
                        <p className="font-extrabold">ตรวจพบการเช่าวัสดุเลยเวลาเกินกำหนด!</p>
                        <p className="text-[11px] text-[var(--ui-warning)] mt-0.5">
                          จำนวนที่เลยกำหนดส่งคืน: <span className="font-bold text-[var(--ui-warning)]">{currentWizardFinance.daysLate} วัน</span> 
                          (เนื่องจากถึงกำหนดตั้งแต่วันที่ {wizardReceipt.due_date}) อัตราเบี้ยปรับคิดตามค่าปรับระบบ {JirakitDB.getSettings().PENALTY_RATE}% ต่อวัน
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="jrk-alert-line p-4 rounded-xl flex items-start gap-2.5">
                      <AlertCircle className="text-[var(--ui-primary)] shrink-0 mt-0.5" size={16} />
                      <div className="text-xs">
                        <p className="font-extrabold">นำอุปกรณ์คืนคลังตรงตามกำหนดวันเช่า</p>
                        <p className="text-[11px] text-[var(--ui-success)] mt-0.5">ไม่มีค่าใช้จ่ายเบี้ยปรับล่าช้าเพิ่มเติมจากการประเมินผลการคืน</p>
                      </div>
                    </div>
                  )}

                  {/* Financial calculation rows */}
                  <div className="jrk-one-frame p-5 rounded-2xl text-xs font-bold space-y-3">
                    <h4 className="text-sm font-black text-[var(--text-main)] border-b border-[var(--ui-border)] pb-2">รายละเอียดทางบัญชี</h4>
                    <div className="flex justify-between text-[var(--text-soft)]">
                      <span>ยอดค้างชำระของบิลหลักเดิม:</span>
                      <span>{currentWizardFinance.priorDebt.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    {currentWizardFinance.daysLate > 0 && (
                      <div className="flex justify-between text-[var(--ui-warning)]">
                        <span>ค่าปรับเลยกำหนดสูงสุด ({currentWizardFinance.daysLate} วัน):</span>
                        <span>+ {currentWizardFinance.penalty.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    {currentWizardFinance.refundableDeposit > 0 && (
                      <div className="flex justify-between text-[var(--ui-primary)]">
                        <span>หักมัดจำสินค้า:</span>
                        <span>- {currentWizardFinance.refundableDeposit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-base font-black text-[var(--text-main)] pt-2 border-t border-dashed border-[var(--ui-border)]">
                      <span>รวมยอดเก็บเงิน (ถ้าติดลบคือต้องคืนลูกค้า):</span>
                      <span>{currentWizardFinance.totalDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>

                  {/* Payment Collected input field */}
                  <div>
                    <label className="block text-xs font-extrabold text-[var(--text-main)] mb-1.5">รับยอดชำระเพิ่มเติมรอบนี้ ()</label>
                    <Input
                      type="number"
                      className="w-full h-11 ai-panel border border-[var(--ui-border)] rounded-xl px-4 py-2 text-right font-black text-[var(--text-main)] text-base"
                      value={collectedPayment || ''}
                      onChange={e => setCollectedPayment(Number(e.target.value))}
                    />
                    <p className="text-[10px] text-[var(--text-soft)] mt-1">มียอดหนี้ค้างชําระต่อในระบบหลังจากตัดชำระนี้: {currentWizardFinance.remainingDebt.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[var(--text-soft)] mb-1">หมายเหตุงานคืน</label>
                    <Input
                      type="text"
                      className="w-full ai-panel border border-[var(--ui-border)] rounded-xl px-3 py-2 text-xs"
                      placeholder="เช่น คืนแบบงอ 2 แผ่น, ตะปูงอ 1 ชุด..."
                      value={note}
                      onChange={e => setNote(e.target.value)}
                    />
                  </div>

                  <div className="flex gap-3 pt-4 border-t">
                    <Button type="button" variant="secondary" onClick={() => setWizardStep(1)}>
                      ย้อนกลับ
                    </Button>
                    <Button type="button" variant="primary" onClick={() => setWizardStep(3)} className="flex-1">
                      ถัดไป: ยืนยันตรวจสอบขั้นสุดท้าย ›
                    </Button>
                  </div>
                </div>
              )}

              {wizardStep === 3 && (
                <div className="space-y-4">
                  <div className="ai-panel text-[var(--text-main)] rounded-2xl p-5 text-xs font-bold space-y-4">
                    <h3 className="text-sm font-black text-center text-[var(--ui-warning)]">ยืนยันข้อมูลจัดเก็บเข้าสารบบคลัง</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-b border-[var(--ui-border)]/60 pb-4">
                      <div>
                        <span className="text-[var(--text-soft)] block text-[10px]">ลูกค้า</span>
                        <span className="text-sm">{wizardReceipt.customer_name}</span>
                      </div>
                      <div>
                        <span className="text-[var(--text-soft)] block text-[10px]">วันที่ทําการคืนคลัง</span>
                        <span className="text-sm">{returnDate}</span>
                      </div>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span>จำนวนวัสดุอุปกรณ์ที่นำส่งคืน:</span>
                        <span className="text-[var(--ui-warning)]">{returnItems.reduce((sum, item) => sum + item.qty_now_return, 0)} ชิ้น</span>
                      </div>
                      {currentWizardFinance.penalty > 0 && (
                        <div className="flex justify-between">
                          <span>ค่าปรับประเมินล่าช้า:</span>
                          <span className="text-[var(--ui-warning)]">{currentWizardFinance.penalty.toLocaleString()}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span>รับเงินสดรับชำระเพิ่มหน้าเคาน์เตอร์:</span>
                        <span className="text-[var(--ui-primary)]">{collectedPayment.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between border-t border-[var(--ui-border)]/60 pt-2 font-black text-sm">
                        <span>ยอดภาระหนี้สินหลงเหลือ (ถ้ามี):</span>
                        <span>{currentWizardFinance.remainingDebt.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  <p className="text-[10px] text-[var(--text-soft)] text-center">* สต็อกอุปกรณ์จะบวกคืนคลังพร้อมใช้อัตโนมัติทันทีกดเสร็จสิ้น</p>

                  <div className="flex gap-3 pt-4 border-t">
                    <Button type="button" variant="secondary" onClick={() => setWizardStep(2)}>
                      ย้อนกลับ
                    </Button>
                    <Button type="button" variant="primary" onClick={handleConfirmReturn} className="flex-1">
                      <CheckCircle size={14} /> ✓ ยืนยันบันทึกคืนและอัปเดตระบบ
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
