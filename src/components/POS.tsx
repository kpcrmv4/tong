/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { JirakitDB } from "../db";
import { Product, Customer } from "../types";
import {
  AlertCircle,
  CheckCircle,
  Package,
  Printer,
  ShoppingCart,
} from "lucide-react";
import POSProductGrid from "./POSProductGrid";
import POSCartPanel from "./POSCartPanel";
import POSCustomerPanel from "./POSCustomerPanel";
import POSPaymentSummary from "./POSPaymentSummary";
import {
  getReceiptPrintHtml,
  getReceiptIframeHtml,
  printReceipt,
  calculateRentalLineTotal,
} from "../utils/receiptHelper";
import { A4PageContainer } from "./A4PageContainer";
import { A4ImageExportButton } from "./A4ImageExportButton";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { Input } from "./ui/Input";

interface POSProps {
  onNavigate: (menu: string) => void;
  triggerRefresh: () => void;
  refreshCount: number;
}

const fixReceiptBankBoxHtml = (html: string): string => {
  return html
    .replace(
      /width: 319px; border-right: 1px solid var\(--receipt-border\); border-bottom: 1\.5px solid var\(--receipt-border\); font-weight: bold; font-size: 17px;">รายการ \(ขนาด\/ระยะเวลาเช่า\)/g,
      'width: 379px; border-right: 1px solid var(--receipt-border); border-bottom: 1.5px solid var(--receipt-border); font-weight: bold; font-size: 17px;">รายการ (ขนาด/ระยะเวลาเช่า)',
    )
    .replace(
      /width: 79px; border-right: 1px solid var\(--receipt-border\); border-bottom: 1\.5px solid var\(--receipt-border\); font-weight: bold; font-size: 17px;">ราคา/g,
      'width: 57px; border-right: 1px solid var(--receipt-border); border-bottom: 1.5px solid var(--receipt-border); font-weight: bold; font-size: 17px;">ราคา',
    );
};

export default function POS({
  onNavigate,
  triggerRefresh,
  refreshCount,
}: POSProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [cart, setCart] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ทั้งหมด");

  // Order Fields
  const [docType, setDocType] = useState<any>("receipt");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [rentDate, setRentDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [, setCalendarStep] = useState<1 | 2>(1);
  const [note, setNote] = useState("");
  const [customDeliveryLocation, setCustomDeliveryLocation] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  // Cart Option States
  const [discountOn, setDiscountOn] = useState(false);
  const [discountVal, setDiscountVal] = useState(0);
  const [depositOn, setDepositOn] = useState(false);
  const [depositVal, setDepositVal] = useState(0);
  const [deliveryOn, setDeliveryOn] = useState(false);
  const [deliveryVal, setDeliveryVal] = useState(0);
  const [vatOn, setVatOn] = useState(false);

  // Modal selector helpers
  const [qtyModalProduct, setQtyModalProduct] = useState<Product | null>(null);
  const [qtyVal, setQtyVal] = useState(1);
  const [roundsVal, setRoundsVal] = useState(1);
  const [qtyStartDate, setQtyStartDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [qtyEndDate, setQtyEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });
  const [qtyLineMode, setQtyLineMode] = useState<"rent" | "sale">("rent");
  const [modalRentalMode, setModalRentalMode] = useState<"day" | "round">(
    "day",
  );
  const [scaffoldPriceOverride, setScaffoldPriceOverride] = useState(0);
  // ราคาชั่วคราวสำหรับบิลนี้เท่านั้น — ไม่แก้ product master
  const [modalPriceInput, setModalPriceInput] = useState("");
  const [lastQtyButton, setLastQtyButton] = useState<number | null>(null);

  // Payment states
  const [isPaying, setIsPaying] = useState(false);
  const [cashOn, setCashOn] = useState(false);
  const [cashAmount, setCashAmount] = useState(0);
  const [transferOn, setTransferOn] = useState(false);
  const [transferAmount, setTransferAmount] = useState(0);
  const [debtOn, setDebtOn] = useState(false);
  const [activePaper, setActivePaper] = useState<"A4" | "A5">(() => {
    return JirakitDB.getSettings().RECEIPT_PAPER_SIZE || "A4";
  });
  const [copyType] = useState<"original" | "carbon">("original");

  const [, setInlinePreviewScale] = useState(1);
  const inlinePreviewContainerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isPaying) {
      setActivePaper(JirakitDB.getSettings().RECEIPT_PAPER_SIZE || "A4");
    }
  }, [isPaying]);

  useEffect(() => {
    if (!inlinePreviewContainerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const containerWidth = entry.contentRect.width;
        // The print html for A4 targets ~794px. For A5, ~560px.
        const targetWidth = activePaper === "A4" ? 794 : 560;
        setInlinePreviewScale(containerWidth / targetWidth);
      }
    });
    observer.observe(inlinePreviewContainerRef.current);
    return () => observer.disconnect();
  }, [activePaper, isPaying]);

  const [savedPreviewImage, setSavedPreviewImage] = useState<string | null>(
    null,
  );

  useEffect(() => {
    setProducts(
      JirakitDB.getProducts().filter(
        (p) => (p.item_status || "Active") === "Active",
      ),
    );
    const custs = JirakitDB.getCustomers().filter(
      (c) => c.customer_status === "Active",
    );
    setCustomers(custs);
  }, [refreshCount]);

  useEffect(() => {
    const cust = customers.find(
      (c) =>
        c.customer_id === selectedCustomerId ||
        c.customer_name === selectedCustomerId,
    );
    if (cust) {
      if (cust.delivery_location || cust.current_worksite)
        setCustomDeliveryLocation(
          cust.delivery_location || cust.current_worksite || "",
        );
      if (cust.phone) setCustomerPhone(cust.phone);
    }
  }, [selectedCustomerId, customers]);

  // Categories Calculation
  const categories = [
    "ทั้งหมด",
    "แบบคาน",
    "แบบเสา",
    "แบบข้าง",
    "แบบฟุตติ้ง",
    "นั่งร้าน/อุปกรณ์",
  ];

  // Filtering products
  const filteredProducts = products.filter((p) => {
    const normalizedSearch = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !normalizedSearch ||
      (p.item_name || "").toLowerCase().includes(normalizedSearch) ||
      (p.sku || "").toLowerCase().includes(normalizedSearch) ||
      (p.category || "").toLowerCase().includes(normalizedSearch);

    let matchesCat = false;
    if (selectedCategory === "ทั้งหมด") {
      matchesCat = true;
    } else if (selectedCategory === "นั่งร้าน/อุปกรณ์") {
      matchesCat =
        p.category === "นั่งร้าน" ||
        p.category === "ขาปรับ" ||
        p.category === "นั่งร้าน/อุปกรณ์" ||
        p.category === "นั่งร้านและอุปกรณ์";
    } else {
      matchesCat = p.category === selectedCategory;
    }

    return (
      matchesSearch && matchesCat && (p.item_status || "Active") === "Active"
    );
  });

  const cartCalculations = () => {
    const lines = cart.map((i) => {
      const line_total = calculateRentalLineTotal(i);
      return {
        ...i,
        line_total,
      };
    });

    const subtotal = lines.reduce((sum, item) => sum + item.line_total, 0);
    const discount = discountOn
      ? Math.min(Number(discountVal || 0), subtotal)
      : 0;
    const deposit = depositOn ? Number(depositVal || 0) : 0;
    const delivery = deliveryOn ? Number(deliveryVal || 0) : 0;
    const base = Math.max(0, subtotal + delivery - discount);
    const vat = vatOn ? base * 0.07 : 0;
    const grand = Math.max(0, base + vat + deposit);

    return {
      subtotal,
      discount,
      deposit,
      delivery,
      vat,
      grand,
      lines,
    };
  };

  const currentCalcs = cartCalculations();

  const handleOpenQtyModal = (p: Product) => {
    const ruleLocked =
      p.category === "แบบคาน" ||
      p.category === "แบบเสา" ||
      p.category === "แบบข้าง";

    setQtyModalProduct(p);
    setQtyVal(1);
    const initialMode = ruleLocked
      ? "rent"
      : p.use_type === "sale"
        ? "sale"
        : "rent";
    setQtyLineMode(initialMode);

    // Initialize rental mode based on product default or standard logic
    const initialRentalMode = p.rental_mode || "day";
    setModalRentalMode(initialRentalMode);

    const start = rentDate
      ? new Date(rentDate).getTime()
      : new Date().getTime();
    const end = dueDate
      ? new Date(dueDate).getTime()
      : new Date().getTime() + 30 * 24 * 60 * 60 * 1000;
    const defaultRounds = Math.max(
      1,
      Math.ceil((end - start) / (1000 * 60 * 60 * 24)),
    );
    setRoundsVal(
      initialMode === "rent"
        ? initialRentalMode === "day"
          ? defaultRounds
          : 1
        : 1,
    );

    // ตั้งราคาเริ่มต้น — ดึงจาก product จริง ตาม mode
    const defaultPrice =
      initialMode === "sale"
        ? Number(
            (p as any).price_sale ?? (p as any).base_price ?? p.price_rent ?? 0,
          ) || 0
        : Number(
            (p as any).price_rent ??
              (p as any).rental_price ??
              p.price_sale ??
              0,
          ) || 0;
    setModalPriceInput("");
    setLastQtyButton(null);
    setScaffoldPriceOverride(
      Number(
        (p as any).price_rent ?? (p as any).rental_price ?? p.price_sale ?? 10,
      ) || 10,
    );
    setQtyStartDate(rentDate || new Date().toISOString().slice(0, 10));
    setQtyEndDate(
      dueDate ||
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10),
    );
  };

  const syncDatesFromDays = (days: number, customStart?: string) => {
    const activeStart = customStart || qtyStartDate;
    setRoundsVal(days);
    const startD = new Date(activeStart);
    startD.setDate(startD.getDate() + days);
    setQtyEndDate(startD.toISOString().slice(0, 10));
  };

  const syncDaysFromDates = (start: string, end: string) => {
    setQtyStartDate(start);
    setQtyEndDate(end);
    const s = new Date(start);
    const e = new Date(end);
    const diffMs = e.getTime() - s.getTime();
    const diffDays = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    setRoundsVal(diffDays);
  };

  const handleConfirmQtyModal = () => {
    if (!qtyModalProduct) return;
    const p = qtyModalProduct;
    const isScafGroup =
      p.category === "นั่งร้าน" ||
      p.category === "ขาปรับ" ||
      p.category === "นั่งร้าน/อุปกรณ์" ||
      p.category === "นั่งร้านและอุปกรณ์";

    // ใช้ราคาชั่วคราวใน Modal เฉพาะเมื่อผู้ใช้กรอกจริง — ถ้าว่างให้ใช้ราคาเดิมของสินค้า
    const defaultUnitPrice =
      qtyLineMode === "rent"
        ? Number(
            (p as any).price_rent ??
              (p as any).rental_price ??
              p.price_sale ??
              0,
          ) || 0
        : Number(
            (p as any).price_sale ?? (p as any).base_price ?? p.price_rent ?? 0,
          ) || 0;
    const typedPrice =
      modalPriceInput.trim() === "" ? NaN : Number(modalPriceInput);
    const unitPrice =
      Number.isFinite(typedPrice) && typedPrice >= 0
        ? typedPrice
        : defaultUnitPrice;

    // VALIDATION
    const quantity = Number(qtyVal);
    const price = Number(unitPrice);

    if (isNaN(quantity) || quantity <= 0) {
      alert("กรุณาระบุจำนวนมากกว่า 0");
      return;
    }

    const availableQty = Number(
      (p as any).qty_available ?? (p as any).stock ?? (p as any).qty_total ?? 0,
    );
    if (
      Number.isFinite(availableQty) &&
      availableQty > 0 &&
      quantity > availableQty
    ) {
      alert(`จำนวนที่เลือกเกินสต็อกที่มี (${availableQty} ${p.unit})`);
      return;
    }

    if (isNaN(price) || price < 0) {
      alert("ราคาต่อหน่วยต้องไม่ต่ำกว่า 0");
      return;
    }

    let itemRentalMode: "day" | "round" = "day";
    let rentDays = 1;
    let rounds = 1;

    if (qtyLineMode === "rent") {
      itemRentalMode = modalRentalMode;
      // If it is scaffolding, we override/force Day mode as required
      if (isScafGroup) {
        itemRentalMode = "day";
      }

      if (itemRentalMode === "day") {
        rentDays = roundsVal;
        if (isNaN(rentDays) || rentDays <= 0) {
          alert("จำนวนวันเช่าต้องมากกว่า 0");
          return;
        }
      } else if (itemRentalMode === "round") {
        rounds = roundsVal;
        if (isNaN(rounds) || rounds <= 0) {
          alert("จำนวนรอบเช่าต้องมากกว่า 0");
          return;
        }
      }
    }

    const tempItem = {
      category: p.category,
      price: price,
      qty: quantity,
      line_mode: qtyLineMode,
      rental_mode: itemRentalMode,
      rent_days: rentDays,
      rounds: rounds,
    };

    const calculatedTotal = calculateRentalLineTotal(tempItem);

    if (isNaN(calculatedTotal)) {
      alert("เกิดข้อผิดพลาดในการคำนวณราคา กรุณาตรวจสอบข้อมูล");
      return;
    }

    const newItem = {
      item_id: p.item_id,
      sku: p.sku,
      receipt_name: p.item_name,
      category: p.category, // store real product category!
      size: p.item_name.match(/[\d.]+/)?.[0] || "",
      unit: p.unit,
      line_mode: qtyLineMode,
      rental_mode: qtyLineMode === "rent" ? itemRentalMode : ("round" as const),
      qty: quantity,
      price: price,
      rent_days: rentDays,
      rounds: rounds,
      start_date: qtyStartDate,
      due_date: qtyEndDate,
      qty_returned: 0,
      line_total: calculatedTotal,
    };

    setCart([...cart, newItem]);
    setQtyModalProduct(null);
  };

  const handleRemoveCartItem = (idx: number) => {
    const next = [...cart];
    next.splice(idx, 1);
    setCart(next);
  };

  const [validationError, setValidationError] = useState("");

  const handleProcessPayment = () => {
    const errors: string[] = [];
    if (cart.length === 0)
      errors.push("• เลือกสินค้าในตะกร้าอย่างน้อย 1 รายการ");

    if (errors.length > 0) {
      setValidationError(errors.join("\n"));
      return;
    }

    // Autofill defaults if empty to prevent empty or broken receipts
    const effectiveDocType = docType || "receipt";
    if (!docType) setDocType("receipt");
    if (!selectedCustomerId) setSelectedCustomerId("ลูกค้าทั่วไป");
    if (!customerPhone) setCustomerPhone("-");
    if (!customDeliveryLocation || !customDeliveryLocation.trim())
      setCustomDeliveryLocation("-");

    const todayStr = new Date().toISOString().split("T")[0];
    if (!rentDate) setRentDate(todayStr);
    if (!dueDate) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setDueDate(tomorrow.toISOString().split("T")[0]);
    }

    // Pre-populate cash and transfer amounts with totals
    setCashAmount(currentCalcs.grand);
    setTransferAmount(0);
    setCashOn(true);
    setTransferOn(false);
    setDebtOn(false);
    setIsPaying(true);
  };

  const buildLiveReceiptPreviewPayload = () => {
    const customer = customers.find(
      (c) =>
        c.customer_id === selectedCustomerId ||
        c.customer_name === selectedCustomerId,
    );

    const total = currentCalcs.grand;
    const paidCash = cashOn ? cashAmount : 0;
    const paidTransfer = transferOn ? transferAmount : 0;
    const actualPaid = Math.min(total, paidCash + paidTransfer);
    const debt = debtOn ? Math.max(0, total - actualPaid) : 0;

    return {
      doc_type: docType || "receipt",
      receipt_no: "-",
      created_at: new Date(),
      receipt_date: new Date().toISOString(),
      customer_name: customer
        ? customer.customer_name
        : selectedCustomerId || "",
      phone: customer ? customer.phone || "" : "",
      address: customer
        ? customer.address || customer.registered_address || ""
        : "",
      delivery_location: customDeliveryLocation || "",
      rent_date: rentDate,
      due_date: dueDate,
      items: currentCalcs.lines,
      items_json: JSON.stringify(currentCalcs.lines),
      subtotal: currentCalcs.subtotal,
      discount: currentCalcs.discount,
      delivery_fee: currentCalcs.delivery,
      deposit: currentCalcs.deposit,
      vat: currentCalcs.vat,
      vat_rate: vatOn ? 7 : 0,
      vat_mode: vatOn ? "EXCLUDE" : "NONE",
      grand_total: currentCalcs.grand,
      paid_amount: actualPaid,
      debt_amount: debt,
      note,
    };
  };

  const handleConfirmOrder = () => {
    let customer = customers.find(
      (c) =>
        c.customer_id === selectedCustomerId ||
        c.customer_name === selectedCustomerId,
    );
    if (!customer) {
      if (selectedCustomerId) {
        customer = {
          customer_id: "CASH_GENERAL",
          customer_name: selectedCustomerId,
          phone: customerPhone,
          address: "",
        } as any;
      } else {
        customer = {
          customer_id: "CUSTOM_" + new Date().getTime(),
          customer_name: selectedCustomerId,
          phone: customerPhone,
          address: "",
        } as any;
      }
    }

    const total = currentCalcs.grand;
    const paidCash = cashOn ? cashAmount : 0;
    const paidTransfer = transferOn ? transferAmount : 0;
    const actualPaid = Math.min(total, paidCash + paidTransfer);
    const debt = debtOn ? Math.max(0, total - actualPaid) : 0;
    const change = Math.max(0, paidCash + paidTransfer - total);

    const receiptPayload = {
      doc_type: docType,
      receipt_title: {
        receipt: "ใบเสร็จรับเงิน",
        invoice: "ใบแจ้งหนี้ / ใบเสร็จรับเงิน",
        delivery: "ใบส่งของ",
        quotation: "ใบเสนอราคา",
        delivery_receipt: "ใบส่งของ / ใบเสร็จรับเงิน",
        debt_notice: "ใบแจ้งภาระหนี้สิน",
      }[docType],
      customer_id: customer.customer_id,
      customer_name: customer.customer_name,
      phone: customer.phone,
      address: customer.address || customer.registered_address,
      delivery_location: customDeliveryLocation || "",
      rent_date: rentDate,
      due_date: dueDate,
      subtotal: currentCalcs.subtotal,
      discount: currentCalcs.discount,
      delivery_fee: currentCalcs.delivery,
      deposit: currentCalcs.deposit,
      vat: currentCalcs.vat,
      vat_rate: vatOn ? 7 : 0,
      vat_mode: vatOn ? "EXCLUDE" : "NONE",
      grand_total: total,
      paid_cash: paidCash - (change > 0 ? change : 0),
      paid_transfer: paidTransfer,
      paid_amount: actualPaid,
      debt_amount: debt,
      change_amount: change,
      payment_status:
        debt <= 0 ? "ชำระครบ" : actualPaid > 0 ? "ชำระบางส่วน" : "ยังไม่ชำระ",
      note,
      items: currentCalcs.lines,
      items_json: JSON.stringify(currentCalcs.lines),
      created_at: new Date(),
      receipt_date: new Date().toISOString(),
      client_txn_id: `TXN-${Date.now()}`,
    } as any;

    receiptPayload.receipt_no = JirakitDB.createReceiptNo(docType);
    let docTitle = "บิลเงินสด";
    if (docType === "quotation") docTitle = "ใบเสนอราคา";
    else if (docType === "invoice") docTitle = "ใบแจ้งหนี้";
    else if (docType === "delivery") docTitle = "ใบส่งสินค้า";
    else if (docType === "receipt") docTitle = "ใบเสร็จรับเงิน";
    receiptPayload.receipt_title = docTitle;

    const executeSave = async () => {
      try {
        await JirakitDB.saveReceipt(receiptPayload);
        // Show success modal directly without generating heavy images
        setSavedPreviewImage("SUCCESS_NO_IMAGE");
      } catch (err: any) {
        alert(`ไม่สามารถบันทึกบิลได้: ${err?.message || err}`);
      }
    };

    executeSave();
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 text-[var(--text-main)]">
      <style>{`
        @keyframes blinkRedCard {
          0%, 100% {
            background-color: var(--ui-surface);
            border-color: var(--ui-border);
            box-shadow: var(--ui-shadow-soft);
          }
          50% {
            background-color: color-mix(in srgb, var(--ui-danger) 8%, var(--ui-surface));
            border-color: var(--ui-danger);
            box-shadow: 0 4px 15px color-mix(in srgb, var(--ui-danger) 25%, transparent);
          }
        }
        .blink-red-card-active {
          animation: blinkRedCard 1.2s infinite ease-in-out !important;
          border-width: 2px !important;
        }
      `}</style>
      <div className="grid min-w-0 grid-cols-1 items-center gap-[var(--ui-gap-button)]">
        <div className="min-w-0">
          <h2 className="flex items-center gap-[var(--ui-gap-button)] text-[32px] font-extrabold leading-none text-[var(--text-main)]">
            <Package size={34} strokeWidth={2.5} className="shrink-0" />
            รายการสินค้า
          </h2>
        </div>
        <div className="flex min-w-0 items-center justify-start"></div>
      </div>
      <div className="grid min-w-0 grid-cols-1 gap-[var(--ui-gap-button)] pos-layout">
        <section className="min-w-0 space-y-4">
          <POSProductGrid
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            categories={categories}
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
            filteredProducts={filteredProducts}
            handleOpenQtyModal={handleOpenQtyModal}
          />
        </section>
        {/* Right Side: checkout flow. Cart is first, then document/customer/payment. */}
        <aside className="pos-checkout-sidebar min-w-0">
          <Card
            elevated
            className="space-y-4 p-[var(--ui-card-pad)] sm:p-[var(--ui-card-pad)]"
          >
            <POSCartPanel
              cart={cart}
              setCart={setCart}
              products={products}
              handleRemoveCartItem={handleRemoveCartItem}
            />

            <POSCustomerPanel
              docType={docType}
              setDocType={setDocType}
              customDeliveryLocation={customDeliveryLocation}
              setCustomDeliveryLocation={setCustomDeliveryLocation}
              customers={customers}
              selectedCustomerId={selectedCustomerId}
              setSelectedCustomerId={setSelectedCustomerId}
              rentDate={rentDate}
              setRentDate={setRentDate}
              dueDate={dueDate}
              setDueDate={setDueDate}
              customerPhone={customerPhone}
              setCustomerPhone={setCustomerPhone}
              setCalendarStep={setCalendarStep}
            />

            <POSPaymentSummary
              discountOn={discountOn}
              setDiscountOn={setDiscountOn}
              discountVal={discountVal}
              setDiscountVal={setDiscountVal}
              depositOn={depositOn}
              setDepositOn={setDepositOn}
              depositVal={depositVal}
              setDepositVal={setDepositVal}
              deliveryOn={deliveryOn}
              setDeliveryOn={setDeliveryOn}
              deliveryVal={deliveryVal}
              setDeliveryVal={setDeliveryVal}
              vatOn={vatOn}
              setVatOn={setVatOn}
              currentCalcs={currentCalcs}
              handleProcessPayment={handleProcessPayment}
              cart={cart}
            />
          </Card>
        </aside>
      </div>{" "}
      {/* Closes grid container */}
      {qtyModalProduct && (
        <div className="fixed inset-0 bg-[var(--text-main)]/50 backdrop-blur-sm flex items-center justify-center z-50 p-[var(--ui-card-pad)]">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[var(--ui-radius-modal)] border border-[var(--ui-border)] bg-[var(--ui-surface)] p-[var(--ui-card-pad)] shadow-2xl animate-in zoom-in-95 duration-200 sm:p-[var(--ui-card-pad)]">
            <Button
              type="button"
              variant="icon"
              size="sm"
              onClick={() => setQtyModalProduct(null)}
              className="absolute right-4 top-4 h-[var(--ui-icon-hit)] w-[var(--ui-icon-hit)] p-0 text-xl"
              aria-label="ปิดหน้าต่างเลือกจำนวนสินค้า"
            >
              ×
            </Button>
            <div className="pr-8 pb-3 border-b border-[var(--ui-border)]">
              <div className="flex justify-between items-center mt-1 flex-wrap gap-[var(--ui-gap-button)]">
                <h3 className="text-[27px] font-black text-[var(--text-main)]">
                  {qtyModalProduct.item_name}
                </h3>
                <span className="text-[27px] font-black text-[var(--ui-primary)]">
                  จำนวนที่เลือก {qtyVal} {qtyModalProduct.unit}
                </span>
              </div>
            </div>

            <div className="space-y-4 mt-4">
              {/* Rental vs Buyout Row Mode selector */}
              {qtyModalProduct.use_type === "both" && (
                <div className="flex gap-[var(--ui-gap-button)] p-1 ai-panel border border-[var(--ui-border)] rounded-[var(--ui-radius-card)]">
                  <Button
                    type="button"
                    variant={qtyLineMode === "rent" ? "primary" : "ghost"}
                    size="sm"
                    onClick={() => {
                      setQtyLineMode("rent");
                      setRoundsVal(1);
                      // อัปเดตราคา default เมื่อเปลี่ยน mode
                      setModalPriceInput("");
                    }}
                    className="flex-1 whitespace-normal text-center"
                  >
                    บริการเช่าใช้งาน (Rental)
                  </Button>
                  <Button
                    type="button"
                    variant={qtyLineMode === "sale" ? "primary" : "ghost"}
                    size="sm"
                    onClick={() => {
                      setQtyLineMode("sale");
                      // อัปเดตราคา default เมื่อเปลี่ยน mode
                      setModalPriceInput("");
                    }}
                    className="flex-1 whitespace-normal text-center"
                  >
                    ขายขาดทันที (Outright Buyout)
                  </Button>
                </div>
              )}

              {/* ช่องราคาและจำนวน รวมกันแถวเดียว */}
              {(() => {
                const isScafGroup =
                  qtyModalProduct.category === "นั่งร้าน" ||
                  qtyModalProduct.category === "ขาปรับ" ||
                  qtyModalProduct.category === "นั่งร้าน/อุปกรณ์" ||
                  qtyModalProduct.category === "นั่งร้านและอุปกรณ์";

                const origPrice =
                  qtyLineMode === "sale"
                    ? Number(
                        (qtyModalProduct as any).price_sale ??
                          (qtyModalProduct as any).base_price ??
                          qtyModalProduct.price_rent ??
                          0,
                      ) || 0
                    : Number(
                        (qtyModalProduct as any).price_rent ??
                          (qtyModalProduct as any).rental_price ??
                          qtyModalProduct.price_sale ??
                          0,
                      ) || 0;

                const typedPrice =
                  modalPriceInput.trim() === "" ? NaN : Number(modalPriceInput);
                const effectivePrice =
                  Number.isFinite(typedPrice) && typedPrice >= 0
                    ? typedPrice
                    : origPrice;
                const effectiveQty = qtyVal || 1;
                const currentRentalMode =
                  qtyLineMode === "rent"
                    ? isScafGroup
                      ? "day"
                      : modalRentalMode
                    : "sale";
                const effectiveRentDays =
                  qtyLineMode === "rent" && currentRentalMode === "day"
                    ? roundsVal || 1
                    : 1;

                const tempItem = {
                  category: qtyModalProduct.category,
                  price: effectivePrice,
                  qty: effectiveQty,
                  line_mode: qtyLineMode,
                  rental_mode: currentRentalMode,
                  rent_days: effectiveRentDays,
                  rounds: 1,
                };

                const previewTotal = calculateRentalLineTotal(tempItem);
                const dayLabel =
                  isScafGroup && qtyLineMode === "rent" ? "/วัน" : "";

                return (
                  <div className="space-y-4">
                    {/* Date row for Scaffolding rent mode */}
                    {qtyLineMode === "rent" && isScafGroup && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-[var(--ui-gap-button)] p-[var(--ui-card-pad-sm)] ai-panel border border-[var(--ui-border)] rounded-[var(--ui-radius-card)]">
                        <div>
                          <label className="block text-[10px] font-bold text-[var(--text-main)] mb-1">
                            วันปล่อยสินค้า
                          </label>
                          <Input
                            type="date"
                            className="w-full ai-panel border border-[var(--ui-border)] rounded-[var(--ui-radius-card)] p-2.5 text-[length:var(--ui-font-label)] font-bold outline-none"
                            value={qtyStartDate}
                            onChange={(e) =>
                              syncDaysFromDates(e.target.value, qtyEndDate)
                            }
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-[var(--text-main)] mb-1">
                            วันคืนสินค้า
                          </label>
                          <Input
                            type="date"
                            className="w-full ai-panel border border-[var(--ui-border)] rounded-[var(--ui-radius-card)] p-2.5 text-[length:var(--ui-font-label)] font-bold outline-none"
                            value={qtyEndDate}
                            onChange={(e) =>
                              syncDaysFromDates(qtyStartDate, e.target.value)
                            }
                          />
                        </div>
                        <div className="sm:col-span-2 text-right">
                          <span className="text-[length:var(--ui-font-label)] font-bold text-[var(--text-main)]">
                            จำนวนวันเช่า:{" "}
                            <span className="text-[var(--ui-primary)] font-black">
                              {roundsVal} วัน
                            </span>
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Inputs row: Price | Qty (50/50 split on desktop) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-[var(--ui-gap-button)] p-[var(--ui-card-pad-sm)].5 ai-panel border border-[var(--ui-primary)]/40 rounded-[var(--ui-radius-card)]">
                      {/* Price Input */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[length:var(--ui-font-label)] font-black text-[var(--text-main)] uppercase tracking-wide">
                            {isScafGroup && qtyLineMode === "rent"
                              ? "ราคาใช้จริงต่อวัน"
                              : "ราคาต่อหน่วย"}
                          </span>
                          <span className="text-[10px] text-[var(--text-main)] font-semibold">
                            ราคาเดิม:{" "}
                            {origPrice.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                            })}
                          </span>
                        </div>
                        <div className="flex items-center gap-[var(--ui-gap-button)]">
                          <Input
                            id="modal-price-override-input"
                            type="text"
                            inputMode="decimal"
                            className="flex-1 ai-panel border-2 border-[var(--ui-primary)]/60 rounded-[var(--ui-radius-card)] px-3 py-2.5 text-lg font-black text-[var(--text-main)] outline-none bg-[var(--ui-surface)] w-full"
                            value={modalPriceInput}
                            placeholder="ระบุราคา.."
                            onChange={(e) => {
                              const raw = e.target.value;
                              if (/^\d*(\.\d{0,2})?$/.test(raw)) {
                                setModalPriceInput(raw);
                              }
                            }}
                          />
                          <span className="text-[length:var(--ui-font-button)] font-bold text-[var(--text-main)] whitespace-nowrap">
                            บาท{dayLabel}
                          </span>
                        </div>
                      </div>

                      {/* Qty Input */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-[length:var(--ui-font-label)] font-black text-[var(--text-main)] uppercase tracking-wide">
                            พิมพ์จำนวนเอง
                          </label>
                          <span className="text-[10px] font-bold text-[var(--text-main)]">
                            คลัง: {qtyModalProduct.qty_available}{" "}
                            {qtyModalProduct.unit}
                          </span>
                        </div>
                        <div className="flex items-center gap-[var(--ui-gap-button)]">
                          <Input
                            type="text"
                            inputMode="numeric"
                            className="flex-1 ai-panel border-2 border-[var(--ui-border)] rounded-[var(--ui-radius-card)] px-3 py-2.5 text-lg font-black text-[var(--text-main)] outline-none bg-[var(--ui-surface)] w-full"
                            value={qtyVal || ""}
                            onChange={(e) => {
                              const maxQty = Math.max(
                                1,
                                Number(
                                  (qtyModalProduct as any).qty_available ??
                                    (qtyModalProduct as any).stock ??
                                    50,
                                ) || 50,
                              );
                              const raw = e.target.value;
                              if (/^\d*$/.test(raw)) {
                                const nextQty = raw === "" ? 0 : Number(raw);
                                setQtyVal(Math.min(nextQty, maxQty));
                                setLastQtyButton(null);
                              }
                            }}
                            placeholder="ระบุจำนวน..."
                          />
                          <span className="text-[length:var(--ui-font-button)] font-bold text-[var(--text-main)] whitespace-nowrap">
                            {qtyModalProduct.unit}
                          </span>
                        </div>
                      </div>

                      {/* Live total preview */}
                      <div className="sm:col-span-2 pt-3 mt-1 border-t border-[var(--ui-border)]">
                        <p className="text-[10px] text-[var(--text-main)] font-semibold leading-relaxed mb-2">
                          ⚡ ราคาใช้ในบิลนี้เท่านั้น — ไม่แก้ราคาสินค้าถาวร
                        </p>
                        <div className="flex justify-between items-center">
                          <span className="text-[length:var(--ui-font-label)] font-bold text-[var(--text-main)]">
                            {isScafGroup && qtyLineMode === "rent"
                              ? `${effectivePrice.toLocaleString(undefined, { minimumFractionDigits: 2 })} × ${effectiveQty} ${qtyModalProduct.unit} × ${effectiveRentDays} วัน`
                              : `${effectivePrice.toLocaleString(undefined, { minimumFractionDigits: 2 })} × ${effectiveQty} ${qtyModalProduct.unit}`}
                          </span>
                          <span className="text-base font-black text-[var(--ui-primary)]">
                            {previewTotal.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}{" "}
                            บาท
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Quantity 1-50 Grid buttons */}
              <div className="mt-2">
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-[length:var(--ui-font-label)] font-black text-[var(--text-main)]">
                    เลือกจำนวน (1 - 50 {qtyModalProduct.unit})
                  </label>
                </div>

                <div className="grid grid-cols-5 sm:grid-cols-10 gap-[var(--ui-gap-button)] p-2.5 ai-panel border border-[var(--ui-border)] rounded-[var(--ui-radius-card)]">
                  {Array.from(
                    {
                      length: Math.min(
                        50,
                        Math.max(
                          1,
                          Number(
                            (qtyModalProduct as any).qty_available ??
                              (qtyModalProduct as any).stock ??
                              50,
                          ) || 50,
                        ),
                      ),
                    },
                    (_, i) => i + 1,
                  ).map((num) => {
                    return (
                      <Button
                        key={num}
                        type="button"
                        variant={qtyVal === num ? "primary" : "secondary"}
                        size="sm"
                        onClick={() => {
                          if (qtyVal === num && lastQtyButton === num) {
                            handleConfirmQtyModal();
                          } else {
                            setQtyVal(num);
                            setLastQtyButton(num);
                          }
                        }}
                        className={`h-[var(--ui-button-h)] p-0 text-[length:var(--ui-font-button)] ${qtyVal === num ? "ring-2 ring-[var(--ui-danger)]" : ""}`}
                      >
                        {num}
                      </Button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex gap-[var(--ui-gap-button)] mt-6">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setQtyModalProduct(null)}
                className="flex-1"
              >
                ยกเลิก
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={handleConfirmQtyModal}
                className="flex-1"
              >
                เพิ่มลงตะกร้าวัสดุ
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* Payment Side-by-Side Modal */}
      {isPaying && (
        <div className="fixed inset-0 bg-[var(--text-main)]/55 backdrop-blur-sm flex items-stretch justify-stretch z-50 p-0 md:p-2">
          <div className="ai-panel !border-0 !ring-0 w-[100dvw] h-[100dvh] md:w-[calc(100dvw-16px)] md:h-[calc(100dvh-16px)] max-w-none max-h-none md:rounded-[var(--ui-radius-card)] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="border-b border-[var(--ui-border)] px-4 sm:px-6 py-3 flex justify-between items-center no-print shrink-0">
              <div>
                <h3 className="text-lg font-extrabold text-[var(--text-main)]">
                  ตรวจสอบชำระเงินและพรีวิวบิล
                </h3>
              </div>
              <Button
                type="button"
                variant="icon"
                size="sm"
                onClick={() => setIsPaying(false)}
                className="h-[var(--ui-icon-hit)] w-[var(--ui-icon-hit)] p-0 text-xl"
                aria-label="ปิดหน้าต่างชำระเงิน"
              >
                ×
              </Button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-[var(--ui-card-pad-sm)] sm:p-[var(--ui-card-pad)] flex flex-col xl:flex-row gap-[var(--ui-gap-button)] sm:gap-[var(--ui-gap-button)] bg-[var(--app-bg)]">
              {/* Receipt Visual Paper (PNG Render) */}
              <div className="w-full xl:flex-[2.4] min-w-0 min-h-0 flex flex-col items-center">
                {/* Dynamic Toolbar Configuration */}
                <div className="mb-3.5 w-full select-none shrink-0">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-[var(--ui-gap-button)]">
                    <Button
                      type="button"
                      variant="secondary"
                      size="lg"
                      onClick={() => {
                        setSavedPreviewImage(null);
                        setCart([]);
                        setIsPaying(false);
                      }}
                      className="w-full whitespace-normal text-center"
                    >
                      ย้อนกลับ
                    </Button>
                    <Button
                      type="button"
                      variant={activePaper === "A4" ? "primary" : "secondary"}
                      size="lg"
                      onClick={() => {
                        setActivePaper("A4");
                        const shopSettings = JirakitDB.getSettings();
                        JirakitDB.saveSettings({
                          ...shopSettings,
                          RECEIPT_PAPER_SIZE: "A4",
                        });
                      }}
                      className={`w-full whitespace-normal text-center ${activePaper === "A4" ? "ring-2 ring-[var(--ui-danger)]" : ""}`}
                    >
                      บิลขนาด A4
                    </Button>

                    <Button
                      type="button"
                      variant={activePaper === "A5" ? "primary" : "secondary"}
                      size="lg"
                      onClick={() => {
                        setActivePaper("A5");
                        const shopSettings = JirakitDB.getSettings();
                        JirakitDB.saveSettings({
                          ...shopSettings,
                          RECEIPT_PAPER_SIZE: "A5",
                        });
                      }}
                      className={`w-full whitespace-normal text-center ${activePaper === "A5" ? "ring-2 ring-[var(--ui-danger)]" : ""}`}
                    >
                      บิลย่อส่วน A5
                    </Button>

                    <div className="sm:col-span-2 lg:col-span-2">
                      <A4ImageExportButton
                        targetId="live-receipt-preview"
                        prefix="RECEIPT"
                        isLandscape={false}
                        className="w-full h-full"
                      />
                    </div>
                  </div>
                </div>

                <div
                  ref={inlinePreviewContainerRef}
                  className="w-full h-full min-h-0 overflow-auto pointer-events-auto relative p-2"
                  style={{ scrollbarGutter: "stable both-edges" }}
                >
                  <div
                    className="mx-auto w-fit min-w-max"
                    style={{
                      minWidth: activePaper === "A4" ? "820px" : "590px",
                    }}
                  >
                    <A4PageContainer
                      id="live-receipt-preview"
                      paperSize={activePaper}
                      isLandscape={false}
                      scaleToFit={true}
                      className="!bg-transparent !shadow-none !border-0 !ring-0"
                    >
                      <iframe
                        title="live-receipt-preview"
                        style={{
                          width: "100%",
                          height: "100%",
                          border: "none",
                          background: "transparent",
                        }}
                        srcDoc={(() => {
                          const payload = buildLiveReceiptPreviewPayload();
                          const shopSettings = JirakitDB.getSettings();
                          return fixReceiptBankBoxHtml(
                            getReceiptIframeHtml(
                              payload,
                              activePaper === "A4",
                              {
                                ...shopSettings,
                                RECEIPT_PAPER_SIZE: activePaper,
                              },
                              copyType,
                              true,
                            ),
                          );
                        })()}
                      />
                    </A4PageContainer>
                  </div>
                </div>
              </div>

              {/* Payment Settings Controller Inputs */}
              <div className="w-full xl:w-[360px] shrink-0 ai-panel border border-[var(--ui-border)] rounded-[var(--ui-radius-card)] p-[var(--ui-card-pad)] space-y-4 shadow-sm">
                <h4 className="font-extrabold text-[length:var(--ui-font-button)] text-[var(--text-main)] sticky top-0 ai-panel backdrop-blur py-1 z-10">
                  ตั้งค่าบัญชีรับเงิน
                </h4>

                <div className="space-y-4">
                  {/* Cash Receipt option */}
                  <div className="ai-panel p-[var(--ui-card-pad)] border rounded-[var(--ui-radius-card)] space-y-3 shadow-xs">
                    <label className="flex items-center gap-[var(--ui-gap-button)] cursor-pointer">
                      <Input
                        type="checkbox"
                        checked={cashOn}
                        onChange={(e) => {
                          setCashOn(e.target.checked);
                          if (e.target.checked)
                            setCashAmount(
                              currentCalcs.grand -
                                (transferOn ? transferAmount : 0),
                            );
                          else setCashAmount(0);
                        }}
                      />
                      <span className="text-[length:var(--ui-font-label)] font-extrabold text-[var(--text-main)]">
                        ชำระด้วยเงินสด
                      </span>
                    </label>
                    {cashOn && (
                      <Input
                        type="number"
                        className="h-[var(--ui-control-h)] text-right font-extrabold"
                        value={cashAmount || ""}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setCashAmount(val);
                        }}
                      />
                    )}
                  </div>

                  {/* Transfer Receipt option */}
                  <div className="ai-panel p-[var(--ui-card-pad)] border rounded-[var(--ui-radius-card)] space-y-3 shadow-xs">
                    <label className="flex items-center gap-[var(--ui-gap-button)] cursor-pointer">
                      <Input
                        type="checkbox"
                        checked={transferOn}
                        onChange={(e) => {
                          setTransferOn(e.target.checked);
                          if (e.target.checked)
                            setTransferAmount(
                              currentCalcs.grand - (cashOn ? cashAmount : 0),
                            );
                          else setTransferAmount(0);
                        }}
                      />
                      <span className="text-[length:var(--ui-font-label)] font-extrabold text-[var(--text-main)]">
                        โอนเงินด้วยระบบคิวอาร์ (PromptPay)
                      </span>
                    </label>
                    {transferOn && (
                      <>
                        <Input
                          type="number"
                          className="h-[var(--ui-control-h)] text-right font-extrabold"
                          value={transferAmount || ""}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setTransferAmount(val);
                          }}
                        />
                        <div className="flex flex-col items-center p-[var(--ui-card-pad-sm)] ai-panel rounded-lg border">
                          {JirakitDB.getSettings().BANK_QR_URL ? (
                            <img
                              src={JirakitDB.getSettings().BANK_QR_URL}
                              alt="Promptpay"
                              className="w-32 h-32 object-contain"
                            />
                          ) : (
                            <div className="flex h-32 w-32 items-center justify-center rounded-[var(--ui-radius-card)] border border-dashed border-[var(--ui-border)] p-2 text-center text-[10px] font-black text-[var(--text-soft)]">
                              ยังไม่ได้แนบรูป QR ธนาคาร
                            </div>
                          )}
                          <p className="text-[10px] text-[var(--text-main)] mt-2">
                            สแกนจ่ายเงิน {transferAmount.toLocaleString()}
                          </p>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Debt Unpaid options */}
                  <div className="ai-panel p-[var(--ui-card-pad)] border rounded-[var(--ui-radius-card)] flex items-center justify-between shadow-xs">
                    <label className="flex items-center gap-[var(--ui-gap-button)] cursor-pointer">
                      <Input
                        type="checkbox"
                        checked={debtOn}
                        onChange={(e) => setDebtOn(e.target.checked)}
                      />
                      <span className="text-[length:var(--ui-font-label)] font-extrabold text-[var(--text-main)]">
                        เปิดยอดค้างชำระ (อนุญาตให้ติดหนี้)
                      </span>
                    </label>
                  </div>

                  <div className="p-[var(--ui-card-pad-sm)] ai-panel border border-[var(--ui-border)] rounded-[var(--ui-radius-card)] space-y-1.5 text-[length:var(--ui-font-label)] font-semibold text-[var(--text-main)]">
                    <div className="flex justify-between">
                      <span>ยอดที่ต้องจ่าย:</span>
                      <span>{currentCalcs.grand.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>ยอดจ่ายรวม:</span>
                      <span>
                        {(
                          (cashOn ? cashAmount : 0) +
                          (transferOn ? transferAmount : 0)
                        ).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between text-[var(--text-main)] font-black">
                      <span>ยอดค้างลงทะเบียนหนี้สิน:</span>
                      <span>
                        {Math.max(
                          0,
                          currentCalcs.grand -
                            (cashOn ? cashAmount : 0) -
                            (transferOn ? transferAmount : 0),
                        ).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between text-[var(--ui-primary)] font-black">
                      <span>เงินทอนลูกค้า:</span>
                      <span>
                        {Math.max(
                          0,
                          (cashOn ? cashAmount : 0) +
                            (transferOn ? transferAmount : 0) -
                            currentCalcs.grand,
                        ).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[length:var(--ui-font-label)] font-bold text-[var(--text-main)] mb-1">
                      หมายเหตุเอกสารท้ายบิล
                    </label>
                    <Input
                      type="text"
                      className="text-[length:var(--ui-font-label)]"
                      placeholder="เช่น ขนส่งเสร็จแล้ว ตรวจนับครบชิ้น"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                  </div>

                  <Button
                    type="button"
                    variant="primary"
                    size="lg"
                    onClick={handleConfirmOrder}
                    className="w-full uppercase"
                  >
                    <CheckCircle size={15} /> บันทึกปิดบิลและตัดคลังทันที
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {savedPreviewImage && (
        <div className="fixed inset-0 bg-[var(--text-main)]/80 backdrop-blur-sm flex items-center justify-center z-[200] p-[var(--ui-card-pad)] flex-col gap-[var(--ui-gap-button)]">
          <div className="w-full max-w-sm flex justify-center flex-col gap-[var(--ui-gap-button)] relative animate-in zoom-in-95 duration-300">
            <div className="ai-panel rounded-[var(--ui-radius-card)] overflow-hidden shadow-2xl relative p-[var(--ui-card-pad)] text-center space-y-4">
              <div className="w-16 h-16 bg-[var(--ui-primary)] rounded-full flex items-center justify-center mx-auto text-[var(--ui-on-primary)] mb-2">
                <CheckCircle size={32} />
              </div>
              <h3 className="text-[var(--text-main)] text-xl font-bold">
                บันทึกบิลสำเร็จ!
              </h3>
              <p className="text-[var(--text-main)] text-[length:var(--ui-font-button)]">
                ข้อมูลถูกจัดเก็บและตัดสต็อกสินค้าเรียบร้อย
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-[var(--ui-gap-button)]">
              <Button
                type="button"
                variant="secondary"
                size="lg"
                onClick={() => {
                  setSavedPreviewImage(null);
                  setCart([]);
                  setIsPaying(false);
                  triggerRefresh();

                  // Auto print right after closing this modal optionally
                  const shopSettings = JirakitDB.getSettings();
                  const receipts = JirakitDB.getReceipts();
                  if (receipts.length > 0) {
                    printReceipt(receipts[0], activePaper, {
                      ...shopSettings,
                      RECEIPT_PAPER_SIZE: activePaper,
                    });
                  }
                }}
                className="w-full flex-col leading-tight"
              >
                <Printer size={16} />
                ปริ้นใบเสร็จทันที
              </Button>

              <Button
                type="button"
                variant="primary"
                size="lg"
                onClick={() => {
                  setSavedPreviewImage(null);
                  setCart([]);
                  setIsPaying(false);
                  triggerRefresh();
                  onNavigate("bills");
                }}
                className="w-full flex-col leading-tight"
              >
                <CheckCircle size={16} />
                ไปหน้าจัดการบิล
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* Validation Error Modal */}
      {validationError && (
        <div className="fixed inset-0 bg-[var(--text-main)]/50 backdrop-blur-xs flex items-center justify-center z-[100] p-[var(--ui-card-pad)] animate-in fade-in duration-200">
          <div className="ai-panel rounded-[var(--ui-radius-modal)] max-w-sm w-full p-[var(--ui-card-pad)] shadow-2xl relative animate-in zoom-in-95 duration-200 text-center">
            <div className="w-16 h-16 ai-panel text-[var(--ui-danger)] rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle size={32} />
            </div>
            <h3 className="text-xl font-black text-[var(--text-main)] mb-2">
              ข้อมูลไม่ครบถ้วน!
            </h3>
            <p className="text-[var(--text-main)] text-[13px] mb-6 whitespace-pre-line text-left ai-panel p-[var(--ui-card-pad-sm)] rounded-lg border border-[var(--ui-border)]">
              {validationError}
            </p>
            <Button
              type="button"
              variant="primary"
              size="lg"
              onClick={() => setValidationError("")}
              className="w-full"
            >
              ตกลง
            </Button>
          </div>
        </div>
      )}
      {/* ตัวเรนเดอร์ HTML ใบเสร็จลับสำหรับแปลงเป็นภาพ PNG */}
      <div
        id="live-receipt-hidden-renderer"
        style={{
          position: "absolute",
          left: "-9999px",
          top: "0px",
          width: "794px",
          background: "var(--ui-surface)",
          boxSizing: "border-box",
        }}
        dangerouslySetInnerHTML={{
          __html: (() => {
            const previewReceiptPayload = buildLiveReceiptPreviewPayload();
            const shopSettings = JirakitDB.getSettings();
            return fixReceiptBankBoxHtml(
              getReceiptPrintHtml(
                previewReceiptPayload,
                activePaper === "A4",
                {
                  ...shopSettings,
                  RECEIPT_PAPER_SIZE: activePaper,
                },
                copyType,
              ),
            );
          })(),
        }}
      />
    </div>
  );
}
