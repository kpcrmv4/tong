/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Form } from './ui/Form';
import { JirakitDB } from '../db';
import { Product } from '../types';
import { Search, Plus, AlertCircle, Edit3, Trash2, Settings, X } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';

interface ProductsProps {
  refreshCount: number;
  triggerRefresh: () => void;
}

export default function Products({ refreshCount, triggerRefresh }: ProductsProps) {
  const [products, setProducts] = useState<Product[]>(() => {
    try {
      let list = JirakitDB.getProducts().filter(p => p && p.item_status !== 'Deleted');
      if (list.length === 0) {
        list = JirakitDB.getProducts();
      }
      return list;
    } catch(e) {
      return [];
    }
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ทั้งหมด');
  const [stockFilter, setStockFilter] = useState<'all' | 'instock' | 'lowstock' | 'outstock'>('all');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);

  // Form fields
  const [pName, setPName] = useState('');
  const [pSku, setPSku] = useState('');
  const [pCategory, setPCategory] = useState('แบบคาน');
  const [pUseType, setPUseType] = useState<'rent' | 'sale' | 'both'>('rent');
  const [pRentalMode, setPRentalMode] = useState<'round' | 'day'>('round');
  const [pUnit, setPUnit] = useState('ชิ้น');
  const [pPriceRent, setPPriceRent] = useState(0);
  const [pPriceSale, setPPriceSale] = useState(0);
  const [pQtyAdded, setPQtyAdded] = useState(0);
  const [pStockTotal, setPStockTotal] = useState(100);
  const [pThreshold, setPThreshold] = useState(10);
  const [pStatus, setPStatus] = useState<'Active' | 'Inactive'>('Active');
  const [pTransactionDate, setPTransactionDate] = useState(new Date().toISOString().slice(0, 10));
  const [pNote, setPNote] = useState('');

  useEffect(() => {
    // Show active items by default
    let list = JirakitDB.getProducts().filter(p => p && p.item_status !== 'Deleted');
    if (list.length === 0) {
      // Force fallback if everything was deleted or corrupted
      list = [...JirakitDB.getProducts()]; // try without filter
      if (list.length === 0) {
         list = [{ item_id: 'PRD-1001', category: 'แบบคาน', item_name: 'แบบคาน 40x0.50', unit: 'แผ่น', price_rent: 10.00, price_sale: 50.00, sku: '', item_status: 'Active', note: '', stock: 100, use_type: 'rent', rental_mode: 'day', qty_total: 100, qty_available: 100, qty_rented: 0, qty_damaged: 0, qty_lost: 0, low_stock_threshold: 10, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }];
      }
    }
    setProducts(list);

    // Auto-open restock modal if there's a quick restock request in localStorage
    const itemIdToRestock = localStorage.getItem('JRK_QUICK_RESTOCK_ITEM_ID');
    if (itemIdToRestock) {
      const found = list.find(p => p.item_id === itemIdToRestock);
      if (found) {
        setEditingProduct(found);
        setPName(found.item_name);
        setPSku(found.sku);
        setPCategory(found.category);
        setPRentalMode(found.rental_mode || 'round');
        setPUseType(found.use_type);
        setPUnit(found.unit);
        setPPriceRent(found.price_rent);
        setPPriceSale(found.price_sale);
        setPQtyAdded(0);
        setPStockTotal(found.qty_total);
        setPThreshold(found.low_stock_threshold);
        setPStatus(found.item_status as any);
        setPTransactionDate(found.created_at ? found.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10));
        setPNote(found.note);
      }
      localStorage.removeItem('JRK_QUICK_RESTOCK_ITEM_ID');
    }
  }, [refreshCount]);

  const categories = ['ทั้งหมด', 'แบบคาน', 'แบบเสา', 'แบบข้าง', 'แบบฟุตติ้ง', 'นั่งร้าน/อุปกรณ์'];

  const filtered = products.filter(p => {
    const q = searchQuery.toLowerCase();
    const matchSearch = String(p.item_name || '').toLowerCase().includes(q) || 
                        String(p.sku || '').toLowerCase().includes(q) || 
                        String(p.item_id || '').toLowerCase().includes(q);
    
    let matchCat = false;
    if (selectedCategory === 'ทั้งหมด') {
      matchCat = true;
    } else if (selectedCategory === 'นั่งร้าน/อุปกรณ์') {
      matchCat = p.category === 'นั่งร้าน' || p.category === 'ขาปรับ' || p.category === 'นั่งร้าน/อุปกรณ์' || p.category === 'นั่งร้านและอุปกรณ์';
    } else {
      matchCat = p.category === selectedCategory;
    }

    let matchStock = true;
    if (stockFilter === 'instock') {
      matchStock = p.qty_available > p.low_stock_threshold;
    } else if (stockFilter === 'lowstock') {
      matchStock = p.qty_available > 0 && p.qty_available <= p.low_stock_threshold;
    } else if (stockFilter === 'outstock') {
      matchStock = p.qty_available === 0;
    }
    
    return matchSearch && matchCat && matchStock;
  });

  const handleOpenForm = (p?: Product) => {
    if (p) {
      setEditingProduct(p);
      setPName(p.item_name);
      setPSku(p.sku);
      setPCategory(p.category);
      setPRentalMode(p.rental_mode || 'round');
      setPUseType(p.use_type);
      setPUnit(p.unit);
      setPPriceRent(p.price_rent);
      setPPriceSale(p.price_sale);
      setPQtyAdded(0);
      setPStockTotal(p.qty_total);
      setPThreshold(p.low_stock_threshold);
      setPStatus(p.item_status as any);
      setPTransactionDate(p.created_at ? p.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10));
      setPNote(p.note);
    } else {
      setEditingProduct({} as Product);
      setPName('');
      setPSku('');
      setPCategory('แบบคาน');
      setPRentalMode('round');
      setPUseType('rent');
      setPUnit('ชิ้น');
      setPPriceRent(0);
      setPPriceSale(0);
      setPQtyAdded(0);
      setPStockTotal(100);
      setPThreshold(10);
      setPStatus('Active');
      setPTransactionDate(new Date().toISOString().slice(0, 10));
      setPNote('');
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    const payload: Partial<Product> = {
      item_name: pName,
      sku: pSku || `SKU-${Date.now().toString().slice(-6)}`,
      category: pCategory,
      use_type: pUseType,
      rental_mode: pRentalMode,
      unit: pUnit,
      price_rent: pPriceRent,
      price_sale: Number(pPriceSale) || 0,
      qty_total: Number(pStockTotal) + (Number(pQtyAdded) || 0),
      low_stock_threshold: pThreshold,
      item_status: pStatus as any,
      created_at: pTransactionDate ? new Date(pTransactionDate).toISOString() : new Date().toISOString(),
      note: pNote
    };

    if (editingProduct) {
      payload.item_id = editingProduct.item_id;
    }

    try {
      JirakitDB.saveProduct(payload);
      alert('บันทึกปรับข้อมูลคลังสินค้าสำเร็จเรียบร้อย!');
      setEditingProduct(null);
      setProducts(JirakitDB.getProducts().filter(p => p.item_status !== 'Deleted'));
      triggerRefresh();
    } catch (err: any) {
      alert(`Cannot save product data: ${err?.message || err}`);
    }
  };

  const handleDeleteProduct = (productId: string) => {
    if (window.confirm('คุณแน่ใจหรือไม่ว่าต้องการลบรายการสินค้านี้ออกจากระบบ?')) {
      try {
        JirakitDB.saveProduct({ item_id: productId, item_status: 'Deleted' });
        setProducts(JirakitDB.getProducts().filter(p => p.item_status !== 'Deleted'));
        triggerRefresh();
        alert('ลบข้อมูลสินค้าเรียบร้อยแล้ว!');
      } catch (err: any) {
        alert(`Cannot delete product data: ${err?.message || err}`);
      }
    }
  };

  return (
    <div className="space-y-6 max-w-full mx-auto w-full">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-xl font-black text-[var(--text-main)] uppercase tracking-tight">ระบบฐานข้อมูล & สต็อกวัสดุก่อสร้าง</h2>
            <p className="text-xs text-[var(--text-soft)] mt-1 uppercase tracking-wider">เพิ่มลดยอดคลัง ตกแต่งพารามิเตอร์ราคา และตรวจสต็อกที่เช่าค้างนอกร้าน</p>
          </div>
          <div className="jrk-menu-button-group md:w-auto md:ml-auto">
            <Button type="button" onClick={() => handleOpenForm()} size="md" variant="primary" className="h-11 shrink-0">
              <Plus size={14} /> เพิ่มรหัสสินค้าและบริการ
            </Button>
          </div>
        </div>

        {/* Filter and Search Bars */}
        <div id="product-list-controls" className="flex flex-col gap-4">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3.5 top-3 text-[var(--text-soft)]" size={16} />
              <Input
                type="text"
                className="w-full ai-panel border border-[var(--ui-border)] rounded-lg pl-10 pr-4 py-2.5 text-xs text-[var(--text-main)] placeholder:text-[var(--text-soft)]/70 h-10 font-bold"
                placeholder="สืบค้นวัสดุตาม ชื่อ / SKU / ตัวคีย์..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="jrk-tabs-clean w-full overflow-x-auto md:w-auto md:justify-end">
              {categories.map(cat => (
                <Button
                  key={cat}
                  type="button"
                  variant={selectedCategory === cat ? 'primary' : 'toolbar'}
                  size="sm"
                  onClick={() => setSelectedCategory(cat)}
                  className="shrink-0 rounded-xl px-4"
                  aria-pressed={selectedCategory === cat}
                >
                  {cat}
                </Button>
              ))}
            </div>
          </div>

          <div className="jrk-tabs-clean w-full overflow-x-auto justify-start pb-1">
            {[
              { id: 'all', label: 'ยอดรวม (All)' },
              { id: 'instock', label: 'พร้อมเช่า (In Stock)' },
              { id: 'lowstock', label: 'ใกล้หมดสต็อก (Low Stock)' },
              { id: 'outstock', label: 'หมดสต็อก (Out Of Stock)' }
            ].map(f => (
              <Button
                key={f.id}
                type="button"
                variant={stockFilter === f.id ? 'primary' : 'toolbar'}
                size="sm"
                onClick={() => setStockFilter(f.id as any)}
                className="shrink-0 rounded-xl px-4"
                aria-pressed={stockFilter === f.id}
              >
                {f.label}
              </Button>
            ))}
          </div>        </div>

        {/* Master Stock Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.length === 0 ? (
            <div className="col-span-full text-center py-12 text-[var(--text-soft)] font-bold">
              ไม่พบคู่สัญญาหรือพิกัดอุปกรณ์ตามการค้นหา
            </div>
          ) : 
            filtered.map(p => {
              const isOutOfStock = p.qty_available === 0;
              const isWarningStock = !isOutOfStock && p.qty_available <= p.low_stock_threshold;
              
              const cardClass = isOutOfStock
                ? 'jrk-one-frame' 
                : isWarningStock 
                ? 'jrk-one-frame'
                : 'jrk-one-frame';

              return (
                <div key={p.item_id} className={`border rounded-xl p-4 flex flex-col justify-between transition-all shadow-sm ${cardClass}`}>
                  <div className="flex justify-between items-start mb-3 border-b border-[var(--ui-border)]/30 pb-3">
                    <div>
                      <span className="text-[10px] text-[var(--text-soft)] font-bold block uppercase tracking-wider">{p.category}</span>
                      <span className="text-[var(--text-main)] font-black block text-sm mt-0.5">{p.item_name}</span>
                      <span className="text-[10px] text-[var(--text-soft)] font-mono font-bold mt-0.5 block">{p.item_id} | {p.sku}</span>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      {isOutOfStock ? (
                        <span className="jrk-pill-soft text-[10px] font-black px-2 py-1 rounded-lg">หมดสต็อก</span>
                      ) : isWarningStock ? (
                        <span className="jrk-pill-soft text-[10px] font-black px-2 py-1 rounded-lg">สต็อกต่ำ</span>
                      ) : (
                        <span className="jrk-pill-active text-[10px] font-black px-2 py-1 rounded-lg">พร้อมใช้</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1.5 mb-4 text-[11px]">
                    <div className="flex justify-between border-b border-[var(--ui-border)]/30 pb-1 text-[var(--text-soft)]"><span className="font-bold">ราคาขาย:</span><span className="text-[var(--text-main)] font-mono">{p.price_sale} ฿</span></div>
                    <div className="flex justify-between border-b border-[var(--ui-border)]/30 pb-1 text-[var(--text-soft)]"><span className="font-bold">ราคาเช่า:</span><span className="text-[var(--text-main)] font-mono">{p.price_rent} ฿</span></div>
                    <div className="flex justify-between border-b border-[var(--ui-border)]/30 pb-1 text-[var(--text-soft)]"><span className="font-bold">ประเภท:</span><span className="text-[var(--text-main)]">{p.use_type === 'both' ? 'เช่า/ขาย' : p.use_type === 'rent' ? 'เช่า' : 'ขายขาด'}</span></div>
                    <div className="flex justify-between border-b border-[var(--ui-border)]/30 pb-1 text-[var(--text-soft)]"><span className="font-bold">โหมดเช่า:</span><span className="text-[var(--text-main)]">{p.rental_mode === 'day' ? 'รายวัน' : 'รายรอบ'}</span></div>
                    <div className="flex justify-between border-b border-[var(--ui-border)]/30 pb-1 text-[var(--text-soft)]"><span className="font-bold">จำนวนรวม:</span><span className="text-[var(--text-main)] font-mono">{p.qty_total} {p.unit}</span></div>
                    <div className="flex justify-between border-b border-[var(--ui-border)]/30 pb-1 text-[var(--text-soft)]"><span className="font-bold">พร้อมใช้:</span><span className={`font-mono font-black ${isOutOfStock ? 'text-[var(--ui-danger)]' : isWarningStock ? 'text-[var(--ui-primary)]' : 'text-[var(--ui-primary)]'}`}>{p.qty_available} {p.unit}</span></div>
                    <div className="flex justify-between border-b border-[var(--ui-border)]/30 pb-1 text-[var(--text-soft)]"><span className="font-bold">ถูกเช่า:</span><span className="text-[var(--text-main)] font-mono">{p.qty_rented} {p.unit}</span></div>
                    <div className="flex justify-between border-b border-[var(--ui-border)]/30 pb-1 text-[var(--text-soft)]"><span className="font-bold">เสียหาย:</span><span className="text-[var(--text-main)] font-mono">{p.qty_damaged} {p.unit}</span></div>
                    <div className="flex justify-between border-b border-[var(--ui-border)]/30 pb-1 text-[var(--text-soft)]"><span className="font-bold">สูญหาย:</span><span className="text-[var(--text-main)] font-mono">{p.qty_lost} {p.unit}</span></div>
                    <div className="flex justify-between border-b border-[var(--ui-border)]/30 pb-1 text-[var(--text-soft)]"><span className="font-bold">ขั้นต่ำเตือน:</span><span className="text-[var(--text-main)] font-mono">{p.low_stock_threshold} {p.unit}</span></div>
                  </div>

                  <div className="w-full flex mt-auto">
                    <Button type="button" onClick={() => handleOpenForm(p)} variant="secondary" size="sm" className="w-full">
                      <Settings size={14} /> จัดการข้อมูลสินค้า
                    </Button>
                  </div>
                </div>
              );
            })
          }
        </div>

      {/* Editor Drawer Popup Form Modal */}
      {editingProduct !== null && (
        <div className="fixed inset-0 bg-[var(--ui-overlay)]/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="ai-panel border border-[var(--ui-border)] rounded-xl max-w-lg w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="ai-panel px-6 py-4.5 text-[var(--text-main)] flex justify-between items-center border-b border-[var(--ui-border)]">
              <div>
                <h3 className="text-md font-black uppercase tracking-wide text-[var(--text-main)]">
                  {editingProduct.item_id ? `แก้ไขพารามิเตอร์วัสดุ #${editingProduct.item_id}` : 'สร้างรายการอุปกรณ์ชิ้นใหม่'}
                </h3>
              </div>
              <Button type="button" variant="icon" size="sm" onClick={() => setEditingProduct(null)} className="h-9 w-9 p-0 text-xl">×</Button>
            </div>

            <Form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs font-bold text-[var(--text-soft)]">
              
              {/* Locked Information Warning Display */}
              {(pCategory === 'แบบคาน' || pCategory === 'แบบเสา') && (
                <div className="jrk-alert-line p-4 rounded-lg flex items-start gap-2.5 animate-in fade-in slide-in-from-top-1">
                  <AlertCircle className="text-[var(--text-main)] shrink-0 mt-0.5" size={16} />
                  <p className="text-[10px] leading-relaxed font-bold">
                    <b>แจ้งเตือนกฎวิศวกรรมสต็อก:</b> ผลิตภัณฑ์กลุ่ม "แบบคาน" และ "แบบเสา" ถูกกำหนดให้เป็นแบบ <b>เช่าเหมาจ่าย / คิดมูลค่าเป็นรอบ</b> โดยสารบบ ERP สิทธิ์นี้จะไม่สามารถแก้ไขแบบบิลรายวันได้ตามพิกัดร้านอุตรดิตถ์
                  </p>
                </div>
              )}

              <div>
                <label className="block text-[var(--text-soft)] mb-1.5 uppercase tracking-wide">ชื่อสินค้าหรือรายละเอียดความยาว</label>
                <Input
                  type="text"
                  className="w-full h-10 ai-panel border border-[var(--ui-border)] rounded-lg px-3.5 text-[var(--text-main)] text-xs font-bold"
                  placeholder="เช่น แบบคาน 40x1.00 หรือ ขาปรับ 0.50 ซม."
                  value={pName}
                  onChange={e => setPName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[var(--text-soft)] mb-1.5 uppercase tracking-wide">รหัสสินค้า</label>
                  <Input
                    type="text"
                    className="w-full h-10 ai-panel border border-[var(--ui-border)] rounded-lg px-3.5 text-[var(--text-main)] text-xs font-mono"
                    placeholder="เช่น BEAM-40100-30"
                    value={pSku}
                    onChange={e => setPSku(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[var(--text-soft)] mb-1.5 uppercase tracking-wide">หมวดหมู่สินค้าหลัก</label>
                  <Select
                    className="w-full h-10 ai-panel border border-[var(--ui-border)] rounded-lg px-2 text-[var(--text-main)] font-bold text-xs"
                    value={pCategory}
                    onChange={e => setPCategory(e.target.value)}
                  >
                    {['แบบคาน', 'แบบเสา', 'แบบข้าง', 'แบบฟุตติ้ง', 'นั่งร้าน/อุปกรณ์'].map(cat => (
                      <option key={cat} value={cat} className="ai-panel text-[var(--text-main)] font-bold">{cat}</option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[var(--text-soft)] mb-1.5 uppercase tracking-wide">การคำนวน</label>
                  <Select
                    className="w-full h-10 ai-panel border border-[var(--ui-border)] rounded-lg px-2 text-[var(--text-main)] font-bold text-xs"
                    value={pRentalMode}
                    onChange={e => setPRentalMode(e.target.value as any)}
                  >
                    <option value="round" className="ai-panel text-[var(--text-main)]">-แบบรอบ</option>
                    <option value="day" className="ai-panel text-[var(--text-main)]">-แบบวัน</option>
                  </Select>
                </div>
                <div>
                  <label className="block text-[var(--text-soft)] mb-1.5 uppercase tracking-wide">หน่วยนับอุปกรณ์</label>
                  <Input
                    type="text"
                    className="w-full h-10 ai-panel border border-[var(--ui-border)] rounded-lg px-3.5 text-[var(--text-main)] text-xs font-bold"
                    placeholder="เช่น แผ่น / ชุด / ท่อน / ต้น"
                    value={pUnit}
                    onChange={e => setPUnit(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-[var(--text-soft)] mb-1.5 uppercase tracking-wide">ราคาเช่า / ชิ้น / รอบ ()</label>
                  <Input
                    type="number"
                    className="w-full h-10 ai-panel border border-[var(--ui-border)] rounded-lg px-3.5 text-right font-black text-[var(--text-main)] text-xs"
                    value={pPriceRent || ''}
                    placeholder="0"
                    onChange={e => setPPriceRent(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="block text-[var(--text-soft)] mb-1.5 uppercase tracking-wide">ราคาขายจริง</label>
                  <Input
                    type="number"
                    className="w-full h-10 ai-panel border border-[var(--ui-border)] rounded-lg px-3.5 text-right font-black text-[var(--text-main)] text-xs"
                    value={pPriceSale || ''}
                    placeholder="0"
                    onChange={e => setPPriceSale(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="block text-[var(--text-soft)] mb-1.5 uppercase tracking-wide">จำนวนที่เพิ่ม</label>
                  <Input
                    type="number"
                    className="w-full h-10 ai-panel border border-[var(--ui-border)] rounded-lg px-3.5 text-right font-black text-[var(--text-main)] text-xs"
                    value={pQtyAdded || ''}
                    placeholder="0"
                    onChange={e => setPQtyAdded(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[var(--text-soft)] mb-1.5 uppercase tracking-wide">ปริมาณรวมของคลังในร้าน *</label>
                  <Input
                    type="number"
                    className="w-full h-10 ai-panel border border-[var(--ui-border)] rounded-lg px-3.5 text-right font-black text-[var(--text-main)] text-xs h-10"
                    value={pStockTotal || ''}
                    onChange={e => setPStockTotal(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="block text-[var(--text-soft)] mb-1.5 uppercase tracking-wide">เกณฑ์เตือนสต็อกขั้นต่ำต่ำเตือน *</label>
                  <Input
                    type="number"
                    className="w-full h-10 ai-panel border border-[var(--ui-border)] rounded-lg px-3.5 text-right font-black text-[var(--ui-warning)] text-xs h-10"
                    value={pThreshold || ''}
                    onChange={e => setPThreshold(Number(e.target.value))}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[var(--text-soft)] mb-1.5 uppercase tracking-wide">วันที่ทำรายการ</label>
                <Input
                  type="date"
                  className="w-full h-10 ai-panel border border-[var(--ui-border)] rounded-lg px-2 text-[var(--text-main)] text-xs font-bold"
                  value={pTransactionDate}
                  onChange={e => setPTransactionDate(e.target.value)}
                />
              </div>

              <div className="flex gap-3.5 pt-4.5 border-t border-[var(--ui-border)]">
                <Button type="button" variant="secondary" onClick={() => setEditingProduct(null)} className="w-1/3">
                  ยกเลิก
                </Button>
                <Button type="submit" variant="primary" className="flex-1">
                  ✓ คอนเฟิร์มเพิ่มพารามิเตอร์คลัง
                </Button>
              </div>
            </Form>
          </div>
        </div>
      )}
    </div>
  );
}


