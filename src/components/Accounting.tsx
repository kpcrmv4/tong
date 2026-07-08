/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Form } from './ui/Form';
import { JirakitDB } from '../db';
import { Expense, Receipt } from '../types';
import { Landmark, TrendingUp, TrendingDown, ClipboardCheck, Search, Download, Trash, Printer, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { DataTable } from './ui/DataTable';

export default function Accounting() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth());
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());

  // Expense form state
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [exDesc, setExDesc] = useState('');
  const [exAmt, setExAmt] = useState(0);
  const [exDate, setExDate] = useState(new Date().toISOString().slice(0, 10));
  const [exCat, setExCat] = useState('ค่าแรงหน่วยงาน');
  const [exNote, setExNote] = useState('');

  useEffect(() => {
    setExpenses(JirakitDB.getExpenses());
    setReceipts(JirakitDB.getReceipts());
  }, []);

  // Filter bills & expenses matching selected month/year
  const filteredReceipts = receipts.filter(r => {
    const d = new Date(r.created_at);
    return d.getMonth() === filterMonth && d.getFullYear() === filterYear;
  });

  const filteredExpenses = expenses.filter(e => {
    const d = new Date(e.expense_date);
    return d.getMonth() === filterMonth && d.getFullYear() === filterYear;
  });

  // LEDGER Compilation: Union of income (bills) and outcomes (expenses) sorted by date
  const ledger: any[] = [];
  
  filteredReceipts.forEach(r => {
    ledger.push({
      date: r.created_at,
      ref: r.receipt_no,
      desc: `[รายรับ] รับค่าเช่า/ค่าสินค้าจากคุณคุฯ ${r.customer_name}`,
      income: r.paid_amount,
      outcome: 0,
      type: 'INCOME'
    });
  });

  filteredExpenses.forEach(e => {
    ledger.push({
      date: e.expense_date,
      ref: e.expense_id,
      desc: `[รายจ่าย: ${e.category}] ${e.description}`,
      income: 0,
      outcome: e.amount,
      type: 'EXPENSE',
      raw_id: e.expense_id
    });
  });

  // Sort by date ascending to compute running cumulative sum
  ledger.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let runningSum = 0;
  const finalLedger = ledger.map(item => {
    runningSum += (item.income - item.outcome);
    return {
      ...item,
      running_sum: runningSum
    };
  });

  const totalIncome = filteredReceipts.reduce((sum, r) => sum + r.paid_amount, 0);
  const totalOutcome = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  const netEarnings = totalIncome - totalOutcome;

  const handleCreateExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!exDesc.trim() || exAmt <= 0) return;

    JirakitDB.saveExpense({
      description: exDesc,
      amount: exAmt,
      expense_date: exDate,
      category: exCat,
      note: exNote
    });

    setExDesc('');
    setExAmt(0);
    setExNote('');
    setExpenses(JirakitDB.getExpenses());
    setIsAddingExpense(false);
  };

  const handleCancelExpense = (id: string) => {
    if (!confirm('ยืนยันยกเลิกและคืนสต็อกรายจ่ายแถวนี้ใช่หรือไม่?')) return;
    JirakitDB.cancelExpense(id, 'ผู้ควบคุมยกเลิกจากจุดบริการหน้าเคาน์เตอร์');
    setExpenses(JirakitDB.getExpenses());
  };

  const handleDownloadCSV = () => {
    const headers = ['วันที่สลิป', 'เลขอ้างอิง', 'รายการบัญชี', 'นำเข้ากระแส ()', 'ส่งออกรายจ่าย ()', 'ดุลคงเหลือสะสม ()'];
    const rows = finalLedger.map(item => [
      new Date(item.date).toLocaleDateString('th-TH'),
      item.ref,
      item.desc,
      item.income,
      item.outcome,
      item.running_sum
    ]);

    const csvContent = "\uFEFF" + [headers, ...rows].map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `JRK_LEDGER_REPORT_${filterYear}_${filterMonth + 1}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportXLSX = () => {
    // Generate official title headers and columns
    const title = [
      ["รายงานบัญชีแยกประเภทและบัญชีรับพึงประเมินภาษีประจำเดือน (Official Monthly Ledger & Tax Report)"],
      ["ร้านจีรกิตติ์ ไม้แบบพลาสติก (สำนักงานใหญ่ อ.เมือง จ.อุตรดิตถ์)"],
      [`แผ่นรายงานประจำเดือน: ${thMonths[filterMonth]} พ.ศ. ${filterYear + 543}`],
      ["ผู้พิมพ์รายงาน: ผู้จัดการคลังสินค้าด้านการเงินและภาษีปละปลายทาง"],
      [],
      [
        'ชุดวันที่เดินสเตทเม้นท์', 
        'เลขอ้างอิงเอกสาร', 
        'รายละเอียดรายการสลิป', 
        'สัญญารับ/จ่าย', 
        'ยอดรายรับเข้า ()', 
        'ยอดจ่ายสุทธิออก ()', 
        'ยอดดุลคงเหลือสะสมสุทธิ ()',
        'ฐานรายรับประเมินก่อนภาษี (Tax Base - 7% EX)', 
        'ภาษีมูลค่าเพิ่ม (VAT 7%)', 
        'หัก ณ ที่จ่าย 3% (WHT)',
        'ยอดรับเงินรวมหลังคำนวณภาษี (Net After Taxes)'
      ]
    ];

    const rows = finalLedger.map(item => {
      const isIncome = item.type === 'INCOME';
      const incomeAmt = item.income || 0;
      const outcomeAmt = item.outcome || 0;
      
      // Detailed tax calculations for income entries
      const baseBeforeTax = isIncome ? Number((incomeAmt / 1.07).toFixed(2)) : 0;
      const vatVal = isIncome ? Number((incomeAmt - baseBeforeTax).toFixed(2)) : 0;
      const whtVal = isIncome ? Number((baseBeforeTax * 0.03).toFixed(2)) : 0;
      const netAfterTax = isIncome ? Number((incomeAmt - whtVal).toFixed(2)) : 0;

      return [
        new Date(item.date).toLocaleDateString('th-TH'),
        item.ref,
        item.desc,
        isIncome ? 'รายรับ (Income)' : 'รายจ่าย (Outcome)',
        incomeAmt || 0,
        outcomeAmt || 0,
        item.running_sum,
        baseBeforeTax || 0,
        vatVal || 0,
        whtVal || 0,
        netAfterTax || 0
      ];
    });

    // Sum totals for tax calculations
    const totalInc = finalLedger.reduce((sum, item) => sum + (item.income || 0), 0);
    const totalOut = finalLedger.reduce((sum, item) => sum + (item.outcome || 0), 0);
    const totalBal = totalInc - totalOut;
    const totalBase = finalLedger.reduce((sum, item) => sum + (item.type === 'INCOME' ? Number((item.income / 1.07).toFixed(2)) : 0), 0);
    const totalVAT = finalLedger.reduce((sum, item) => sum + (item.type === 'INCOME' ? Number((item.income - (item.income / 1.07)).toFixed(2)) : 0), 0);
    const totalWHT = finalLedger.reduce((sum, item) => sum + (item.type === 'INCOME' ? Number(((item.income / 1.07) * 0.03).toFixed(2)) : 0), 0);
    const totalNet = finalLedger.reduce((sum, item) => sum + (item.type === 'INCOME' ? Number((item.income - ((item.income / 1.07) * 0.03)).toFixed(2)) : 0), 0);

    const footerRow = [
      'รวมสะสมยอดสุทธิทั้งสิ้น (Total Summaries)',
      '',
      '',
      '',
      totalInc,
      totalOut,
      totalBal,
      Number(totalBase.toFixed(2)),
      Number(totalVAT.toFixed(2)),
      Number(totalWHT.toFixed(2)),
      Number(totalNet.toFixed(2))
    ];

    const finalData = [...title, ...rows, [], footerRow];

    // Create a worksheet and write workbook
    const ws = XLSX.utils.aoa_to_sheet(finalData);
    
    // Auto-fit or set manual optimal column widths for better design
    ws['!cols'] = [
      { wch: 14 }, // Date
      { wch: 18 }, // Reference
      { wch: 45 }, // Description
      { wch: 18 }, // Flow type
      { wch: 16 }, // In
      { wch: 16 }, // Out
      { wch: 18 }, // Balance Sum
      { wch: 22 }, // Base before VAT
      { wch: 18 }, // VAT 7%
      { wch: 18 }, // WHT 3%
      { wch: 24 }  // Net After Tax
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Statement-Tax-Ledger");
    XLSX.writeFile(wb, `JRK_OFFICIAL_TAX_LEDGER_${filterYear}_${filterMonth + 1}.xlsx`);
  };

  const thMonths = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];

  return (
    <div className="space-y-6 max-w-full mx-auto w-full">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-[var(--ui-gap-button)]">
          <div>
            <h2 className="text-xl font-extrabold text-[var(--text-main)]">สมุดบัญชีรายวันและสเตทเม้นท์</h2>
            <p className="text-[length:var(--ui-font-label)] text-[var(--text-soft)] mt-1">คัดกรองรายรับ-จ่าย ตรวจรายงานรายรับสะสม และบันทึกค่าแรง</p>
          </div>

          <div className="jrk-control-row md:max-w-[72%]">
            <Select
              wrapperClassName="jrk-select-compact jrk-select-month"
              className="h-[var(--ui-control-h)] text-[length:var(--ui-font-label)]"
              value={filterMonth}
              onChange={e => setFilterMonth(Number(e.target.value))}
            >
              {thMonths.map((m, idx) => (
                <option key={idx} value={idx}>{m}</option>
              ))}
            </Select>

            <Select
              wrapperClassName="jrk-select-compact jrk-select-year"
              className="h-[var(--ui-control-h)] text-[length:var(--ui-font-label)]"
              value={filterYear}
              onChange={e => setFilterYear(Number(e.target.value))}
            >
              {[2025, 2026, 2027].map(y => (
                <option key={y} value={y}>พ.ศ. {y + 543}</option>
              ))}
            </Select>

            <Button type="button" onClick={handleDownloadCSV} variant="secondary" size="sm" className="h-[var(--ui-control-h)] shrink-0" title="ดาวน์โหลดรายงานสมุดบัญชีรายวันและสเตท์เม้นต์ในรูปแบบไฟล์ CSV">
              <Download size={14} /> นำออกเป็น CSV
            </Button>

            <Button type="button" onClick={handleExportXLSX} variant="secondary" size="sm" className="h-[var(--ui-control-h)] shrink-0" title="ดาวน์โหลดรายงานแยกประเภทรายวันแบบละเอียด พร้อมคอลัมน์การคิดภาษีอากรและมูลค่าเพิ่มในรูปแบบไฟล์ XLSX (Excel)">
              <FileSpreadsheet size={14} />
              <span>นำเข้าใบเสร็จเสียภาษี (Excel XLSX)</span>
            </Button>

            <Button type="button" onClick={() => setIsAddingExpense(!isAddingExpense)} variant="primary" size="sm" className="h-[var(--ui-control-h)] shrink-0">
              + บันทึกรายจ่ายรวม
            </Button>
          </div>
        </div>

        {isAddingExpense && (
          <Form onSubmit={handleCreateExpense} className="ai-panel border border-[var(--ui-border)] p-[var(--ui-card-pad)] rounded-[var(--ui-radius-card)] grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 gap-[var(--ui-gap-button)] text-[length:var(--ui-font-label)] font-bold text-[var(--text-soft)] animate-in fade-in slide-in-from-top-1">
            <div>
              <label className="block text-[var(--text-soft)] mb-1">รายการสําแดงรายจ่าย *</label>
              <Input
                type="text"
                required
                className="w-full h-[var(--ui-control-h)] border rounded-[var(--ui-radius-card)] px-3 ai-panel"
                placeholder="เช่น จ่ายค่าน้ํามันรถพ่วงส่งของให้คุณสมศักดิ์"
                value={exDesc}
                onChange={e => setExDesc(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[var(--text-soft)] mb-1">จำนวนเงินชำระมูลค่า () *</label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                required
                className="w-full h-[var(--ui-control-h)] border rounded-[var(--ui-radius-card)] px-3 ai-panel text-right"
                value={exAmt || ''}
                placeholder="0.00"
                onChange={e => setExAmt(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="block text-[var(--text-soft)] mb-1">วันที่ชำระเสร็จสิ้น</label>
              <Input
                type="date"
                className="w-full h-[var(--ui-control-h)] border rounded-[var(--ui-radius-card)] px-3 ai-panel"
                value={exDate}
                onChange={e => setExDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[var(--text-soft)] mb-1">ประเภทหมวดหมู่หลักสากล</label>
              <Select
                className="w-full h-[var(--ui-control-h)] border rounded-[var(--ui-radius-card)] px-2 ai-panel text-[var(--text-main)]"
                value={exCat}
                onChange={e => setExCat(e.target.value)}
              >
                <option>ค่าแรงหน่วยงาน / จ้างคนยกเหล็ก</option>
                <option>ค่าน้ํามันและเบี้ยเลี้ยงขนส่ง</option>
                <option>อะไหล่ซ่อมบำรุงวัสดุชำรุด</option>
                <option>ค่าภาษียื่นส่ง / สาธารณูปโภค</option>
                <option>ค่าใช้จ่ายจิปาถะทั่วไป</option>
              </Select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-[var(--text-soft)] mb-1">ข้อยึดประเมินช่วยจําเพิ่มเติม</label>
              <Input
                type="text"
                className="w-full h-[var(--ui-control-h)] border rounded-[var(--ui-radius-card)] px-3 ai-panel"
                placeholder="ระบุเบอร์หรือผู้เบิกรหัสใบส่งน้ำมัน..."
                value={exNote}
                onChange={e => setExNote(e.target.value)}
              />
            </div>
            <div className="md:col-span-2 flex justify-end gap-[var(--ui-gap-button)] pt-2">
              <Button type="button" variant="secondary" onClick={() => setIsAddingExpense(false)}>
                ละทิ้ง
              </Button>
              <Button type="submit" variant="primary">
                ✓ ลงบันทึกประมวลผล
              </Button>
            </div>
          </Form>
        )}

        {/* Aggregate Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-[var(--ui-gap-button)]">
          <div className="jrk-one-frame rounded-[var(--ui-radius-card)] p-[var(--ui-card-pad)] flex items-center gap-[var(--ui-gap-button)]">
            <div className="jrk-card-icon w-10 h-[var(--ui-control-h)] rounded-[var(--ui-radius-card)] flex items-center justify-center font-bold">
              <TrendingUp size={20} />
            </div>
            <div>
              <p className="text-[length:var(--ui-font-label)] text-[var(--text-soft)] font-extrabold uppercase uppercase-wider">รวมผลรายรับ (Income)</p>
              <h3 className="text-xl font-black text-[var(--ui-primary)]">
                {totalIncome.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </h3>
            </div>
          </div>

          <div className="jrk-one-frame rounded-[var(--ui-radius-card)] p-[var(--ui-card-pad)] flex items-center gap-[var(--ui-gap-button)]">
            <div className="jrk-card-icon w-10 h-[var(--ui-control-h)] rounded-[var(--ui-radius-card)] flex items-center justify-center font-bold">
              <TrendingDown size={20} />
            </div>
            <div>
              <p className="text-[length:var(--ui-font-label)] text-[var(--text-soft)] font-extrabold uppercase uppercase-wider">รวมผลรายจ่าย (Outcome)</p>
              <h3 className="text-xl font-black text-[var(--ui-primary)]">
                {totalOutcome.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </h3>
            </div>
          </div>

          <div className="jrk-one-frame rounded-[var(--ui-radius-card)] p-[var(--ui-card-pad)] flex items-center gap-[var(--ui-gap-button)]">
            <div className="jrk-card-icon w-10 h-[var(--ui-control-h)] rounded-[var(--ui-radius-card)] flex items-center justify-center font-bold">
              <Landmark size={20} />
            </div>
            <div>
              <p className="text-[length:var(--ui-font-label)] text-[var(--text-soft)] font-extrabold uppercase uppercase-wider">ยอดดุลสุทธิ (Net Profit)</p>
              <h3 className={`text-xl font-black ${netEarnings >= 0 ? 'text-[var(--ui-primary)]' : 'text-[var(--ui-primary)]'}`}>
                {netEarnings.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </h3>
            </div>
          </div>
        </div>

        {/* Ledger table */}
        <DataTable wrapperClassName="rounded-[var(--ui-radius-card)]" className="w-full text-[length:var(--ui-font-label)] font-bold text-center table-auto">
            <thead>
              <tr className="ai-panel text-[var(--text-soft)] h-[var(--ui-control-h)]">
                <th className="p-[var(--ui-card-pad-sm)] text-center">วัน / เวลา</th>
                <th className="p-[var(--ui-card-pad-sm)] text-center font-mono">เลขอ้างอิง</th>
                <th className="p-[var(--ui-card-pad-sm)] text-center">รายละเอียดเงินสดหมุนเวียน</th>
                <th className="p-[var(--ui-card-pad-sm)] text-center">นำเข้า (In)</th>
                <th className="p-[var(--ui-card-pad-sm)] text-center">ส่งออก (Out)</th>
                <th className="p-[var(--ui-card-pad-sm)] text-center">ดุลสะสม (Balance)</th>
                <th className="p-[var(--ui-card-pad-sm)] text-center">คําสั่ง</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--ui-border)] text-[var(--text-soft)]">
              {finalLedger.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-[var(--text-soft)]">
                    ไม่พลายพบรายการเดินยอดสเตทเม้นท์ในเดือนและปีที่กําหนด
                  </td>
                </tr>
              ) : (
                finalLedger.map((row, idx) => {
                  const isExp = row.type === 'EXPENSE';
                  return (
                    <tr key={idx} className="h-[var(--ui-button-h)] hover:ai-panel transition-colors">
                      <td className="p-[var(--ui-card-pad-sm)] text-center">{new Date(row.date).toLocaleDateString('th-TH')}</td>
                      <td className="p-[var(--ui-card-pad-sm)] text-center font-mono font-bold text-[var(--text-main)]">{row.ref.slice(-12)}</td>
                      <td className="p-[var(--ui-card-pad-sm)] text-center font-medium text-[var(--text-main)]">{row.desc}</td>
                      <td className="p-[var(--ui-card-pad-sm)] text-center text-[var(--ui-primary)]">
                        {row.income > 0 ? `${row.income.toLocaleString()}` : '—'}
                      </td>
                      <td className="p-[var(--ui-card-pad-sm)] text-center text-[var(--ui-primary)]">
                        {row.outcome > 0 ? `${row.outcome.toLocaleString()}` : '—'}
                      </td>
                      <td className="p-[var(--ui-card-pad-sm)] text-center text-[var(--text-main)] font-extrabold">
                        {row.running_sum.toLocaleString()}
                      </td>
                      <td className="p-[var(--ui-card-pad-sm)] text-center">
                        {isExp ? (
                          <Button
                            onClick={() => handleCancelExpense(row.raw_id)}
                            className="p-1 text-[var(--ui-primary)] hover:bg-[var(--ui-surface)] rounded"
                            title="ลบรายจ่ายนี้"
                          >
                            <Trash size={12} />
                          </Button>
                        ) : '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
        </DataTable>
      </div>
  );
}
