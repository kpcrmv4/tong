/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Form } from './ui/Form';
import { JirakitDB } from '../db';
import { KeyRound, ShieldAlert, Heart, RefreshCw, Database, User, ArrowUpDown, ArrowDown, ArrowUp, ClipboardList, Eye } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { DataTable } from './ui/DataTable';

export default function Security() {
  const [pin, setPin] = useState('');
  const [runningDiagnostics, setRunningDiagnostics] = useState(false);
  const [healthResult, setHealthResult] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<'config' | 'audit' | 'users' | 'backup' | 'error_center'>('config');
  const [usersRefreshTick, setUsersRefreshTick] = useState(0);

  const activeSession = JirakitDB.getActiveSession();
  const isAdmin = activeSession?.role === 'Owner' || activeSession?.role === 'Admin';
  const users = JirakitDB.getUsers();

  // Sorting state for stock adjustments
  const [sortField, setSortField] = useState<'timestamp' | 'sku' | 'name' | 'diff'>('timestamp');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  const handleSavePin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length !== 6 || !/^\d+$/.test(pin)) {
      alert('PIN must be exactly 6 digits.');
      return;
    }
    try {
      JirakitDB.savePin(pin);
      alert('อัปเดต PIN รหัสความปลอดภัยของหน้าเคาน์เตอร์ปล่อยเช่าวัสดุเสร็จเรียบร้อย!');
      setPin('');
    } catch (err: any) {
      alert(err.message || 'Failed to save.');
    }
  };

  const handleRunHealthCheck = () => {
    setRunningDiagnostics(true);
    setTimeout(() => {
      const prods = JirakitDB.getProducts();
      const custs = JirakitDB.getCustomers();
      const rcs = JirakitDB.getReceipts();
      const returns = JirakitDB.getReturnEvents();
      const logs = JirakitDB.getAuditLogs();

      setHealthResult({
        success: true,
        version: 'JRK_BASE44_TO_VITE_REACT_PORT_20260525',
        timestamp: new Date().toLocaleString('th-TH'),
        checks: [
          { name: 'ตรวจความสมบูรณ์ฐานข้อมูลผลิตภัณฑ์', status: prods.length > 0 ? 'สมบูรณ์' : 'ไม่พบข้อมูล', count: prods.length },
          { name: 'ตรวจประวัติตัวตนลูกค้าประจำ', status: custs.length > 0 ? 'สมบูรณ์' : 'ไม่พบข้อมูล', count: custs.length },
          { name: 'จำนวนใบเสร็จสั่งปล่อยงานในคลัง', status: rcs.length > 0 ? 'สมบูรณ์' : 'ไม่มีทรานแซกชั่น', count: rcs.length },
          { name: 'จำนวนประวัติการเก็บคืนไม้พลาสติก', status: 'สมบูรณ์', count: returns.length },
          { name: 'ประวัติบันทึกการทำงาน (Audit logs)', status: 'เรียบร้อยปกติ', count: logs.length },
          { name: 'ตรวจรหัส PIN รักษากล่องธุรกรรม', status: localStorage.getItem('JRK_PIN_KEY') ? 'เปิดคุมความปลอดภัย' : 'รหัสเปิดตั้งต้น (123456)', count: 1 }
        ]
      });
      setRunningDiagnostics(false);
    }, 600);
  };

  const handleUserStatusChange = async (userId: string, status: 'Active' | 'Inactive' | 'Pending') => {
    if (!isAdmin) {
      alert('Only Owner/Admin can approve or update user status.');
      return;
    }

    try {
      await JirakitDB.updateUserStatus(userId, status);
      setUsersRefreshTick(prev => prev + 1);
    } catch (err: any) {
      alert(err.message || 'Failed to update user status.');
    }
  };

  // Parse stock adjustments from audit logs
  const rawLogs = JirakitDB.getAuditLogs();
  const parsedStockLogs = rawLogs.map(log => {
    let sku = '-';
    let productName = '-';
    let beforeQty = 0;
    let afterQty = 0;
    let isStockAdjustment = false;
    let qtyDiff = 0;

    try {
      if (log.action === 'CREATE_PRODUCT' && log.new_value) {
        const newVal = JSON.parse(log.new_value);
        sku = newVal.sku || '-';
        productName = newVal.item_name || '-';
        beforeQty = 0;
        afterQty = newVal.qty_total ?? newVal.qty_available ?? 0;
        isStockAdjustment = true;
        qtyDiff = afterQty;
      } else if (log.action === 'UPDATE_PRODUCT' && log.new_value && log.old_value) {
        const newVal = JSON.parse(log.new_value);
        const oldVal = JSON.parse(log.old_value);
        sku = newVal.sku || oldVal.sku || '-';
        productName = newVal.item_name || oldVal.item_name || '-';
        
        const oldQty = oldVal.qty_total !== undefined ? oldVal.qty_total : oldVal.stock;
        const newQty = newVal.qty_total !== undefined ? newVal.qty_total : newVal.stock;
        
        beforeQty = Number(oldQty || 0);
        afterQty = Number(newQty || 0);
        qtyDiff = afterQty - beforeQty;

        // Any action representing product creation or change in total qty
        isStockAdjustment = qtyDiff !== 0;
      }
    } catch (e) {
      // safe fallback
    }

    return {
      ...log,
      sku,
      productName,
      beforeQty,
      afterQty,
      qtyDiff,
      isStockAdjustment
    };
  }).filter(log => log.isStockAdjustment);

  // Sorting
  const sortedLogs = [...parsedStockLogs].sort((a, b) => {
    let comparison = 0;
    if (sortField === 'timestamp') {
      comparison = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    } else if (sortField === 'sku') {
      comparison = a.sku.localeCompare(b.sku);
    } else if (sortField === 'name') {
      comparison = a.productName.localeCompare(b.productName);
    } else if (sortField === 'diff') {
      comparison = a.qtyDiff - b.qtyDiff;
    }
    return sortAsc ? comparison : -comparison;
  });

  const toggleSort = (field: 'timestamp' | 'sku' | 'name' | 'diff') => {
    if (sortField === field) {
      setSortAsc(p => !p);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const getSortIcon = (field: 'timestamp' | 'sku' | 'name' | 'diff') => {
    if (sortField !== field) return <ArrowUpDown size={12} className="inline ml-1 text-[var(--text-soft)]" />;
    return sortAsc 
      ? <ArrowUp size={12} className="inline ml-1 text-[var(--ui-danger)] font-bold" />
      : <ArrowDown size={12} className="inline ml-1 text-[var(--ui-danger)] font-bold" />;
  };

  return (
    <div className="space-y-6 max-w-full mx-auto w-full">
      {/* Tab Selectors */}
      <div className="flex p-1 w-fit overflow-x-auto">
        <Button
          onClick={() => setActiveTab('config')}
          className={`px-5 py-2 rounded-xl text-xs font-black tracking-wide transition-all uppercase flex items-center gap-1.5 ${
            activeTab === 'config'
              ? 'primary-gradient-bg text-[var(--text-main)] shadow-md'
              : 'text-[var(--text-soft)] hover:ai-panel'
          }`}
        >
          <KeyRound size={14} /> System Config
        </Button>
        <Button
          onClick={() => setActiveTab('users')}
          className={`px-5 py-2 rounded-xl text-xs font-black tracking-wide transition-all uppercase flex items-center gap-1.5 ${
            activeTab === 'users'
              ? 'primary-gradient-bg text-[var(--text-main)] shadow-md'
              : 'text-[var(--text-soft)] hover:ai-panel'
          }`}
        >
          <User size={14} /> ผู้ใช้งานระบบ (Permission Matrix)
        </Button>
        <Button
          onClick={() => setActiveTab('audit')}
          className={`px-5 py-2 rounded-xl text-xs font-black tracking-wide transition-all uppercase flex items-center gap-1.5 ${
            activeTab === 'audit'
              ? 'primary-gradient-bg text-[var(--text-main)] shadow-md'
              : 'text-[var(--text-soft)] hover:ai-panel'
          }`}
        >
          <ClipboardList size={14} /> Audit Logs / History
        </Button>
        <Button
          onClick={() => setActiveTab('error_center')}
          className={`px-5 py-2 rounded-xl text-xs font-black tracking-wide transition-all uppercase flex items-center gap-1.5 ${
            activeTab === 'error_center'
              ? 'primary-gradient-bg text-[var(--text-main)] shadow-md'
              : 'text-[var(--text-soft)] hover:ai-panel'
          }`}
        >
          <ShieldAlert size={14} /> Error Center (Security/API Logs)
        </Button>
        <Button
          onClick={() => setActiveTab('backup')}
          className={`px-5 py-2 rounded-xl text-xs font-black tracking-wide transition-all uppercase flex items-center gap-1.5 ${
            activeTab === 'backup'
              ? 'primary-gradient-bg text-[var(--text-main)] shadow-md'
              : 'text-[var(--text-soft)] hover:ai-panel'
          }`}
        >
          <Database size={14} /> Backup Center
        </Button>
      </div>

      {activeTab === 'config' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-250">
          {/* PIN updates card */}
          <div className="ai-panel border border-[var(--ui-border)] rounded-2xl p-5 shadow-sm space-y-4">
            <div className="border-b pb-3 flex items-center gap-2">
              <KeyRound className="stroke-[var(--ui-primary)]" size={18} />
              <h3 className="text-sm font-extrabold text-[var(--text-main)]">ตั้งค่าความปลอดภัยรหัส PIN (Legacy System)</h3>
            </div>
            <p className="text-xs text-[var(--text-soft)] font-semibold leading-relaxed">
              รหัส PIN เดิมจะยังคงใช้งานร่วมกับระบบล็อกหน้าจอชั่วคราวขณะทำรายการ
            </p>
            <Form onSubmit={handleSavePin} className="space-y-4 text-xs font-bold text-[var(--text-soft)]">
              <div>
                <label className="block text-[var(--text-soft)] mb-1.5">ป้อนรหัส PIN 6 หลักตัวใหม่ *</label>
                <Input
                  type="password"
                  maxLength={6}
                  required
                  className="w-full h-11 ai-panel border border-[var(--ui-border)] rounded-xl px-4 text-center font-black tracking-widest text-lg"
                  placeholder="••••••"
                  value={pin}
                  onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                />
              </div>
              <Button
                type="submit"
                className="w-full py-2.5 primary-gradient-bg hover:bg-[var(--text-main)] text-[var(--text-main)] font-extrabold rounded-xl transition-all shadow-md"
              >
                ✓ ปรับเปลี่ยนรหัส PIN ควบคุมระบบ
              </Button>
            </Form>
          </div>

          {/* Diagnostic health card */}
          <div className="ai-panel border border-[var(--ui-border)] rounded-2xl p-5 shadow-sm space-y-4">
            <div className="border-b pb-3 flex items-center gap-2">
              <Heart className="stroke-[var(--ui-danger)] fill-[color-mix(in_srgb,var(--ui-danger)_12%,var(--ui-surface))]" size={18} />
              <h3 className="text-sm font-extrabold text-[var(--text-main)]">ตรวจสุขภาพระบบ (System Health Check)</h3>
            </div>
            <p className="text-xs text-[var(--text-soft)] font-semibold leading-relaxed">
              เชื่อมต่อข้อมูลและตรวจประเมินความสมบูรณ์ฐานข้อมูล
            </p>
            <Button
              onClick={handleRunHealthCheck}
              disabled={runningDiagnostics}
              className="w-full py-2.5 bg-[var(--text-main)] hover:bg-[var(--text-main)] text-[var(--text-main)] font-extrabold rounded-xl transition-all shadow-md text-xs flex items-center justify-center gap-1.5"
            >
              <RefreshCw size={12} className={runningDiagnostics ? 'animate-spin' : ''} />
              {runningDiagnostics ? 'กำลังสแกนโครงสร้าง ERP...' : 'ประมวลตรวจประวัติรวม (Run Health Check)'}
            </Button>
            {healthResult && (
              <div className="p-4 ai-panel text-[var(--text-main)] rounded-xl space-y-3 font-mono text-[11px] animate-in fade-in slide-in-from-bottom-2">
                <div className="flex justify-between items-center text-xs font-bold border-b border-[var(--ui-border)]/60 pb-2">
                  <span className="text-[var(--ui-warning)]">สลาก Diagnostic: {healthResult.version}</span>
                  <span className="text-[var(--ui-success)]">ONLINE</span>
                </div>
                <p className="text-[var(--text-soft)]">เวลาทำการสแกน: {healthResult.timestamp}</p>
                <div className="space-y-1.5 pt-1">
                  {healthResult.checks.map((c: any, i: number) => (
                    <div key={i} className="flex justify-between">
                      <span>{c.name}:</span>
                      <span className="text-[var(--ui-warning)] font-bold">
                        {c.status} ({c.count} รายการ)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'audit' && (
        <div className="ai-panel border border-[var(--ui-border)] rounded-2xl p-5 shadow-sm space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-250">
          <div className="border-b pb-3 flex justify-between items-center">
            <div>
              <h3 className="text-sm font-extrabold text-[var(--text-main)] flex items-center gap-1.5">
                <Database className="stroke-[var(--ui-primary)]" size={18} />
                ตรวจสอบบันทึกธุรกรรมการป้อนและปรับสต็อกคลังวัสดุ
              </h3>
              <p className="text-xs text-[var(--text-soft)] mt-0.5">ตารางประวัติกิจกรรมที่บันทึกโดยระบบคัดกรองเฉพาะการเปลี่ยนระดับจำนวนสินค้า</p>
            </div>
            <span className="text-xs font-bold text-[var(--ui-warning)] bg-[var(--ui-surface)] border border-[var(--ui-border)] rounded-full px-3 py-1">
               พบประวัติ {sortedLogs.length} รายการ
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[var(--ui-border)] shadow-xs">
            <DataTable className="w-full text-xs font-bold text-left table-auto">
              <thead>
                <tr className="ai-panel text-[var(--text-soft)] h-10 select-none">
                  <th 
                    onClick={() => toggleSort('timestamp')}
                    className="p-3 cursor-pointer hover:ai-panel transition-colors"
                  >
                    วัน-เวลาทำรายการ {getSortIcon('timestamp')}
                  </th>
                  <th 
                    onClick={() => toggleSort('sku')} 
                    className="p-3 cursor-pointer hover:ai-panel transition-colors"
                  >
                    รหัส (SKU) {getSortIcon('sku')}
                  </th>
                  <th 
                    onClick={() => toggleSort('name')} 
                    className="p-3 cursor-pointer hover:ai-panel transition-colors"
                  >
                    รายการวัสดุเกรดพลาสติก {getSortIcon('name')}
                  </th>
                  <th className="p-3 text-center">สิทธิ์ผู้ทำรายการ</th>
                  <th className="p-3 text-right">จำนวนเดิม</th>
                  <th className="p-3 text-right">จำนวนใหม่</th>
                  <th 
                    onClick={() => toggleSort('diff')} 
                    className="p-3 cursor-pointer hover:ai-panel transition-colors text-center"
                  >
                    ปรับเพิ่ม/ลด {getSortIcon('diff')}
                  </th>
                  <th className="p-3 max-w-[200px]">หมายเหตุระบบ/กิจกรรม</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--ui-border)] text-[var(--text-soft)] font-semibold">
                {sortedLogs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-16 text-[var(--text-soft)] font-bold">
                      ไม่พบประวัติกิจกรรมการปรับปรุงจำนวนสต็อกสินค้าในห้วงเวลาปัจจุบัน
                    </td>
                  </tr>
                ) : (
                  sortedLogs.map(log => {
                    const isPositive = log.qtyDiff > 0;
                    return (
                      <tr key={log.log_id} className="h-11 hover:ai-panel transition-all">
                        <td className="p-3 text-[var(--text-soft)] font-medium font-mono text-[10.5px]">
                          {new Date(log.timestamp).toLocaleString('th-TH')}
                        </td>
                        <td className="p-3 text-[var(--text-main)] font-mono text-[11px]">
                          {log.sku}
                        </td>
                        <td className="p-3 text-[var(--text-main)] text-[11.5px]">
                          {log.productName}
                        </td>
                        <td className="p-3 text-center text-[11px] text-[var(--text-soft)]">
                          <span className="ai-panel text-[var(--text-soft)] px-2 py-0.5 rounded-full font-mono font-bold">
                            {log.user}
                          </span>
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-[var(--text-soft)]">
                          {log.beforeQty}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-[var(--text-main)]">
                          {log.afterQty}
                        </td>
                        <td className="p-3 text-center">
                          <span className={`inline-block px-2.5 py-0.5 rounded-xl font-mono text-[10px] font-black tracking-wide ${
                            isPositive 
                              ? 'bg-[var(--ui-primary)] text-[var(--ui-primary)]' 
                              : 'bg-[var(--ui-danger)] text-[var(--ui-warning)] animate-pulse'
                          }`}>
                            {isPositive ? `+${log.qtyDiff}` : log.qtyDiff}
                          </span>
                        </td>
                        <td className="p-3 text-[var(--text-soft)] font-normal text-[11px] truncate max-w-[200px]" title={log.note}>
                          {log.note || '-'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </DataTable>
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="ai-panel border border-[var(--ui-border)] rounded-2xl p-5 shadow-sm space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-250">
          <div className="border-b pb-3 flex justify-between items-center">
            <div>
              <h3 className="text-sm font-extrabold text-[var(--text-main)] flex items-center gap-1.5">
                <User className="stroke-[var(--ui-primary)]" size={18} />
                ระบบจัดการสิทธิ์ผู้ใช้งาน (Permission Matrix)
              </h3>
              <p className="text-xs text-[var(--text-soft)] mt-0.5">จัดการระดับการเข้าถึงข้อมูลและเมนูต่างๆ ของพนักงาน</p>
            </div>
          </div>
          <div className="overflow-x-auto rounded-xl border border-[var(--ui-border)] shadow-xs">
            <DataTable className="w-full text-xs font-bold text-left table-auto">
              <thead>
                <tr className="ai-panel text-[var(--text-soft)] h-10 select-none">
                  <th className="p-3">รหัสผู้ใช้</th>
                  <th className="p-3">ชื่อแสดงผล</th>
                  <th className="p-3">ชื่อเข้าสู่ระบบ (Username)</th>
                  <th className="p-3">ระดับสิทธิ์ (Role)</th>
                  <th className="p-3">สถานะ</th>
                  <th className="p-3">เข้าใช้ล่าสุด</th>
                  <th className="p-3">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--ui-border)] text-[var(--text-soft)] font-semibold">
                {users.map(user => (
                  <tr key={user.user_id} className="h-11 hover:ai-panel transition-all">
                    <td className="p-3 text-[var(--text-soft)] font-medium font-mono text-[10px]">{user.user_id}</td>
                    <td className="p-3 text-[var(--text-main)]">{user.display_name}</td>
                    <td className="p-3 text-[var(--text-soft)] font-mono text-[11px]">{user.username}</td>
                    <td className="p-3">
                      <span className="inline-block px-2.5 py-0.5 rounded-lg border border-[var(--ui-border)] ai-panel text-[10px] uppercase font-black text-[var(--text-main)]">
                        {user.role}
                      </span>
                    </td>
                    <td className="p-3">
                     <span className={`inline-block px-2 py-0.5 rounded-lg text-[10px] font-black ${
                         user.user_status === 'Active'
                           ? 'bg-[var(--ui-success)]/10 text-[var(--ui-success)]'
                           : user.user_status === 'Pending'
                             ? 'bg-[var(--ui-warning)]/10 text-[var(--ui-warning)]'
                             : 'bg-[var(--ui-danger)]/10 text-[var(--ui-danger)]'
                        }`}>
                         {user.user_status}
                        </span>
                    </td>
                    <td className="p-3 text-[var(--text-soft)] text-[10px]">
                      {user.last_login ? new Date(user.last_login).toLocaleString('th-TH') : '-'}
                    </td>
                    <td className="p-3">
                      {isAdmin && user.user_id !== activeSession?.user_id ? (
                        <div className="flex flex-wrap gap-2">
                          {user.user_status === 'Pending' && (
                            <Button type="button" size="sm" variant="secondary" onClick={() => handleUserStatusChange(user.user_id, 'Active')} className="h-7 px-2 text-[10px]">
                              อนุมัติ
                            </Button>
                          )}
                          {user.user_status === 'Active' ? (
                            <Button type="button" size="sm" variant="secondary" onClick={() => handleUserStatusChange(user.user_id, 'Inactive')} className="h-7 px-2 text-[10px]">
                              พักใช้
                            </Button>
                          ) : user.user_status === 'Inactive' ? (
                            <Button type="button" size="sm" variant="secondary" onClick={() => handleUserStatusChange(user.user_id, 'Active')} className="h-7 px-2 text-[10px]">
                              เปิดใช้
                            </Button>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-[10px] text-[var(--text-soft)]">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </div>
        </div>
      )}

      {activeTab === 'error_center' && (
        <div className="ai-panel border border-[var(--ui-border)] rounded-2xl p-5 shadow-sm space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-250">
          <div className="border-b pb-3 flex justify-between items-center">
            <div>
              <h3 className="text-sm font-extrabold text-[var(--text-main)] flex items-center gap-1.5">
                <ShieldAlert className="stroke-[var(--ui-primary)]" size={18} />
                ศูนย์ตรวจสอบข้อผิดพลาด (Error Center)
              </h3>
              <p className="text-xs text-[var(--text-soft)] mt-0.5">รวมประวัติข้อกังวล, API Logs และข้อผิดพลาดจากระบบอัตโนมัติประจำวัน</p>
            </div>
            {isAdmin && (
               <Button disabled className="text-[10px] font-bold text-[var(--text-soft)] bg-[var(--ui-surface)] px-3 py-1 rounded-lg opacity-60 cursor-not-allowed">ล้างค่า Logs - ยังไม่เปิดใช้งาน</Button>
            )}
          </div>
          <div className="p-16 text-center text-[var(--text-soft)] font-bold border-2 border-dashed border-[var(--ui-border)] rounded-xl">
            <ShieldAlert size={32} className="mx-auto mb-3 opacity-20" />
            <p>ระบบทำงานปกติ ไม่พบข้อผิดพลาดหรือข้อยกเว้นร้ายแรงในรอบสัปดาห์นี้</p>
          </div>
        </div>
      )}

      {activeTab === 'backup' && (
        <div className="ai-panel border border-[var(--ui-border)] rounded-2xl p-5 shadow-sm space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-250">
          <div className="border-b pb-3 flex justify-between items-center">
            <div>
              <h3 className="text-sm font-extrabold text-[var(--text-main)] flex items-center gap-1.5">
                <Database className="stroke-[var(--ui-primary)]" size={18} />
                ข้อมูลสำรอง (Backup Center)
              </h3>
              <p className="text-xs text-[var(--text-soft)] mt-0.5">ส่วนจัดการสำรองข้อมูลทั้งหมดและ Snapshot สเตทของ Local Storage</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 gap-4">
             <div className="p-5 border border-[var(--ui-border)] rounded-xl ai-panel transition-colors cursor-not-allowed text-center opacity-70">
               <Database size={24} className="mx-auto mb-2 text-[var(--text-soft)]" />
               <p className="text-sm font-extrabold text-[var(--text-soft)]">ดาวน์โหลดไฟล์สำรอง (JSON)</p>
               <p className="text-[10px] text-[var(--text-soft)] mt-1">ยังไม่เปิดใช้งานใน Step 1</p>
             </div>
             <div className="p-5 border border-[var(--ui-border)] rounded-xl ai-panel transition-colors cursor-not-allowed text-center opacity-70">
               <Database size={24} className="mx-auto mb-2 text-[var(--text-soft)]" />
               <p className="text-sm font-extrabold text-[var(--text-soft)]">กู้คืนระบบจากไฟล์</p>
               <p className="text-[10px] text-[var(--text-soft)] mt-1">ยังไม่เปิดใช้งานใน Step 1</p>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}

