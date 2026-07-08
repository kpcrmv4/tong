import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  MapPin,
  PlusCircle,
  Search,
  User,
  X,
} from "lucide-react";
import { Customer } from "../types";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { Input } from "./ui/Input";

export interface POSCustomerPanelProps {
  docType: string;
  setDocType: (val: any) => void;
  customDeliveryLocation: string;
  setCustomDeliveryLocation: (val: string) => void;
  customers: Customer[];
  selectedCustomerId: string;
  setSelectedCustomerId: (val: string) => void;
  rentDate: string;
  setRentDate: (val: string) => void;
  dueDate: string;
  setDueDate: (val: string) => void;
  customerPhone: string;
  setCustomerPhone: (val: string) => void;
  setCalendarStep: (step: any) => void;
}

const DOCUMENT_TYPES = [
  { value: "receipt", label: "ใบเสร็จรับเงิน (Receipt)" },
  { value: "invoice", label: "ใบแจ้งหนี้ (Invoice)" },
  { value: "delivery", label: "ใบส่งของ (Delivery Order)" },
  { value: "quotation", label: "ใบเสนอราคา (Quotation)" },
  { value: "delivery_receipt", label: "ใบส่งของ / ใบเสร็จรับเงิน" },
  { value: "debt_notice", label: "ใบแจ้งเตือนเงินค้างชำระ" },
];

const THAI_MONTHS_FULL = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
];

const THAI_WEEKDAYS = [
  "อาทิตย์",
  "จันทร์",
  "อังคาร",
  "พุธ",
  "พฤหัสบดี",
  "ศุกร์",
  "เสาร์",
];

const toDateValue = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const getSafeDate = (value: string) => {
  const d = value ? new Date(`${value}T00:00:00`) : new Date();
  if (Number.isNaN(d.getTime())) return new Date();
  return d;
};

const formatShortThaiDate = (value: string) => {
  const d = getSafeDate(value);
  return `${d.getDate()} ${THAI_MONTHS_FULL[d.getMonth()]} ${d.getFullYear() + 543}`;
};

const buildCalendarDays = (visibleMonth: Date) => {
  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const first = new Date(year, month, 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const d = new Date(start);
    d.setDate(start.getDate() + index);
    return {
      value: toDateValue(d),
      day: d.getDate(),
      inMonth: d.getMonth() === month,
    };
  });
};

export default function POSCustomerPanel({
  docType,
  setDocType,
  customDeliveryLocation,
  setCustomDeliveryLocation,
  customers,
  selectedCustomerId,
  setSelectedCustomerId,
  rentDate,
  setRentDate,
  dueDate,
  setDueDate,
  customerPhone,
  setCustomerPhone,
  setCalendarStep,
}: POSCustomerPanelProps) {
  const [isDocTypeOpen, setIsDocTypeOpen] = useState(false);
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const [isCustomerSelectorOpen, setIsCustomerSelectorOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMode, setCalendarMode] = useState<"rent" | "due">("rent");
  const [draftCalendarDate, setDraftCalendarDate] = useState(() =>
    toDateValue(new Date()),
  );
  const [visibleMonth, setVisibleMonth] = useState(() =>
    getSafeDate(toDateValue(new Date())),
  );
  const [calendarConfirmTap, setCalendarConfirmTap] = useState(0);

  const docTypeDropdownRef = useRef<HTMLDivElement | null>(null);
  const customerDropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;

      if (
        docTypeDropdownRef.current &&
        !docTypeDropdownRef.current.contains(target)
      ) {
        setIsDocTypeOpen(false);
      }

      if (
        customerDropdownRef.current &&
        !customerDropdownRef.current.contains(target)
      ) {
        setIsCustomerDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

  const selectedDocLabel =
    DOCUMENT_TYPES.find((d) => d.value === docType)?.label ||
    "เลือกประเภทเอกสารบิล";

  const selectedCustomerName =
    customers.find((c) => c.customer_id === selectedCustomerId)
      ?.customer_name || selectedCustomerId;

  const filteredCustomers = useMemo(() => {
    const query = selectedCustomerId.toLowerCase();
    return customers
      .filter(
        (c) =>
          String(c.customer_name || "")
            .toLowerCase()
            .includes(query) ||
          String(c.customer_id || "")
            .toLowerCase()
            .includes(query),
      )
      .slice(0, 8);
  }, [customers, selectedCustomerId]);

  const calendarDays = useMemo(
    () => buildCalendarDays(visibleMonth),
    [visibleMonth],
  );
  const todayValue = toDateValue(new Date());

  const openSharedCustomerModal = () => {
    setIsCustomerDropdownOpen(false);
    setIsCustomerSelectorOpen(false);

    if (
      typeof window !== "undefined" &&
      (window as any).openSharedCustomerModal
    ) {
      (window as any).openSharedCustomerModal(null);
      return;
    }

    window.dispatchEvent(new CustomEvent("jrk:open-shared-customer-modal"));
  };

  const selectCustomer = (customer: Customer) => {
    setSelectedCustomerId(customer.customer_id);
    setCustomerPhone(customer.phone || "");
    setIsCustomerDropdownOpen(false);
    setIsCustomerSelectorOpen(false);
  };

  const handleRentDateChange = (value: string) => {
    setCalendarStep(1);
    setRentDate(value);
  };

  const handleDueDateChange = (value: string) => {
    setCalendarStep(2);
    setDueDate(value);
  };

  const jumpToPOSProducts = () => {
    window.requestAnimationFrame(() => {
      const target =
        document.getElementById("pos-product-grid-start") ||
        document.querySelector('[aria-label="เลือกสินค้า POS"]');
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const commitCalendarDate = (value: string) => {
    if (calendarMode === "rent") {
      handleRentDateChange(value);
      const currentDue =
        dueDate &&
        new Date(`${dueDate}T00:00:00`).getTime() >=
          new Date(`${value}T00:00:00`).getTime()
          ? dueDate
          : value;
      setDueDate(currentDue);
      setDraftCalendarDate(currentDue);
      setCalendarMode("due");
      setCalendarConfirmTap(0);
      return;
    }

    handleDueDateChange(value);
    setCalendarOpen(false);
    setCalendarConfirmTap(0);
    jumpToPOSProducts();
  };

  const handleCalendarDayClick = (value: string) => {
    setDraftCalendarDate(value);

    if (calendarConfirmTap === 0) {
      setCalendarConfirmTap(1);
      return;
    }

    commitCalendarDate(value);
  };

  const openDateCalendar = () => {
    const base = calendarMode === "rent" ? rentDate : dueDate;
    const safe = base || toDateValue(new Date());
    setDraftCalendarDate(safe);
    setVisibleMonth(getSafeDate(safe));
    setCalendarConfirmTap(0);
    setCalendarOpen(true);
  };

  const changeMonth = (amount: number) => {
    setVisibleMonth((current) => {
      const next = new Date(current);
      next.setMonth(current.getMonth() + amount);
      return next;
    });
  };

  return (
    <section
      className="min-w-0 space-y-3 border-t border-[var(--ui-border)] pt-3"
      aria-label="ลูกค้าและเอกสาร POS"
    >
      <div className="grid min-w-0 grid-cols-1 gap-3 border-b border-[var(--ui-border)] pb-3 md:grid-cols-2">
        <div ref={docTypeDropdownRef} className="relative min-w-0">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setIsDocTypeOpen((open) => !open)}
            className="h-10 w-full justify-between px-3 text-left"
            aria-haspopup="listbox"
            aria-expanded={isDocTypeOpen}
          >
            <span className="min-w-0 truncate">{selectedDocLabel}</span>
          </Button>

          {isDocTypeOpen && (
            <Card
              elevated
              className="absolute left-0 right-0 top-11 z-50 max-h-72 overflow-y-auto rounded-xl shadow-xl"
            >
              {DOCUMENT_TYPES.map((doc) => (
                <Button
                  type="button"
                  key={doc.value}
                  className={`w-full min-w-0 border-b border-[var(--ui-border)] px-3 py-2 text-left text-xs font-bold last:border-0 hover:bg-[var(--app-bg)] ${
                    docType === doc.value
                      ? "bg-[var(--ui-primary)] text-[var(--ui-on-primary)]"
                      : "text-[var(--text-main)]"
                  }`}
                  onClick={() => {
                    setDocType(doc.value);
                    setIsDocTypeOpen(false);
                  }}
                >
                  <span className="block break-words">{doc.label}</span>
                </Button>
              ))}
            </Card>
          )}
        </div>

        <Input
          icon={<MapPin size={14} />}
          type="text"
          placeholder="สถานที่จัดส่ง / หน้างาน"
          value={customDeliveryLocation}
          onChange={(e) => setCustomDeliveryLocation(e.target.value)}
          className="h-10 text-xs"
        />
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-3 border-b border-[var(--ui-border)] pb-3 md:grid-cols-2">
        <div ref={customerDropdownRef} className="relative min-w-0">
          <Input
            icon={<User size={14} />}
            type="text"
            placeholder="ชื่อลูกค้า (พิมพ์เพื่อเลือกจากฐานข้อมูล)"
            value={selectedCustomerName}
            onChange={(e) => {
              setSelectedCustomerId(e.target.value);
              setIsCustomerDropdownOpen(true);
            }}
            onFocus={() => setIsCustomerDropdownOpen(true)}
            className="h-10 text-xs"
          />

          {isCustomerDropdownOpen && (
            <Card
              elevated
              className="absolute left-0 right-0 top-11 z-50 max-h-64 overflow-y-auto rounded-xl shadow-xl"
            >
              {filteredCustomers.length > 0 ? (
                filteredCustomers.map((c) => (
                  <Button
                    type="button"
                    key={c.customer_id}
                    className="w-full flex-col items-start gap-1 border-b border-[var(--ui-border)] px-3 py-2 text-left text-xs last:border-0"
                    onClick={() => selectCustomer(c)}
                  >
                    <span className="font-black text-[var(--text-main)]">
                      {c.customer_name}
                    </span>
                    <span className="text-[var(--text-soft)]">
                      {c.phone || "-"}
                    </span>
                  </Button>
                ))
              ) : (
                <div className="px-3 py-2 text-xs text-[var(--text-soft)]">
                  ไม่มีรายชื่อ (จะบันทึกเป็นชื่อใหม่)
                </div>
              )}
            </Card>
          )}
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setIsCustomerSelectorOpen(true)}
            title="รายชื่อลูกค้าเดิม"
            className="h-10 px-2"
          >
            <Search size={14} className="shrink-0" />
            <span className="truncate">ลูกค้าเดิม</span>
          </Button>

          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={openSharedCustomerModal}
            title="สร้างลูกค้าใหม่"
            className="h-10 px-2"
          >
            <PlusCircle size={14} className="shrink-0" />
            <span className="truncate">ลูกค้าใหม่</span>
          </Button>
        </div>
      </div>

      <div className="grid w-full min-w-0 grid-cols-1 gap-3 md:grid-cols-2">
        <Button
          type="button"
          variant="secondary"
          size="md"
          onClick={openDateCalendar}
          className="h-10 w-full justify-start px-3 text-left"
          aria-label={`วันปล่อย ${formatShortThaiDate(rentDate)} วันคืน ${formatShortThaiDate(dueDate)}`}
        >
          <Calendar size={14} className="shrink-0" />
          <span className="min-w-0 truncate">
            เลือกวันที่: เริ่ม {formatShortThaiDate(rentDate)} → คืน{" "}
            {formatShortThaiDate(dueDate)}
          </span>
        </Button>

        <Input
          type="text"
          placeholder="เบอร์โทรติดต่อ..."
          maxLength={12}
          value={customerPhone}
          onChange={(e) => setCustomerPhone(e.target.value)}
          className="h-10 text-xs"
          aria-label="เบอร์โทรติดต่อ"
        />
      </div>

      {calendarOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-[var(--text-main)]/50 p-4 backdrop-blur-md">
          <Card className="w-full max-w-md space-y-4 rounded-3xl p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-[var(--text-soft)]">
                  {calendarMode === "rent"
                    ? "ขั้นตอนที่ 1/2"
                    : "ขั้นตอนที่ 2/2"}{" "}
                  · แตะวันเดิมซ้ำเพื่อยืนยัน
                </p>
                <h3 className="text-base font-black text-[var(--text-main)]">
                  {calendarMode === "rent"
                    ? "เลือกวันปล่อยสินค้า"
                    : "เลือกวันกำหนดคืนสินค้า"}
                </h3>
                <p className="mt-1 text-[11px] font-bold text-[var(--text-soft)]">
                  แตะครั้งที่ 1 = เลือกวัน · แตะครั้งที่ 2 = ตกลงอัตโนมัติ
                </p>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setCalendarOpen(false)}
                className="shrink-0"
              >
                ปิด
              </Button>
            </div>

            <div className="rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => changeMonth(-1)}
                  aria-label="เดือนก่อนหน้า"
                >
                  <ChevronLeft size={16} />
                </Button>

                <div className="text-center text-sm font-black text-[var(--text-main)]">
                  {THAI_MONTHS_FULL[visibleMonth.getMonth()]}{" "}
                  {visibleMonth.getFullYear() + 543}
                </div>

                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => changeMonth(1)}
                  aria-label="เดือนถัดไป"
                >
                  <ChevronRight size={16} />
                </Button>
              </div>

              <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-black text-[var(--text-soft)]">
                {THAI_WEEKDAYS.map((day) => (
                  <span key={day}>{day}</span>
                ))}
              </div>

              <div className="mt-2 grid grid-cols-7 gap-1">
                {calendarDays.map((day) => {
                  const isSelected = draftCalendarDate === day.value;
                  const isToday = todayValue === day.value;
                  const isDisabledDue =
                    calendarMode === "due" &&
                    rentDate &&
                    new Date(`${day.value}T00:00:00`).getTime() <
                      new Date(`${rentDate}T00:00:00`).getTime();

                  return (
                    <Button
                      key={day.value}
                      type="button"
                      disabled={isDisabledDue}
                      onClick={() => handleCalendarDayClick(day.value)}
                      className={`aspect-square rounded-xl border text-sm font-black transition-all ${
                        isSelected
                          ? "border-[var(--ui-primary)] bg-[var(--ui-primary)] text-[var(--ui-on-primary)] shadow-md"
                          : isToday
                            ? "border-[var(--ui-primary)] bg-[var(--app-bg)] text-[var(--text-main)]"
                            : "border-[var(--ui-border)] bg-[var(--ui-surface)] text-[var(--text-main)] hover:border-[var(--ui-primary)] hover:bg-[var(--app-bg)]"
                      } ${!day.inMonth ? "opacity-45" : ""} ${isDisabledDue ? "cursor-not-allowed opacity-25" : ""}`}
                    >
                      {day.day}
                    </Button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-dashed border-[var(--ui-primary)]/50 bg-[var(--app-bg)] px-3 py-2 text-center text-xs font-extrabold text-[var(--text-main)]">
              วันที่เลือก: {formatShortThaiDate(draftCalendarDate)} ·{" "}
              {calendarConfirmTap === 1
                ? "แตะวันเดิมอีกครั้งเพื่อยืนยัน"
                : "แตะวันที่ในปฏิทินเพื่อเลือก"}
            </div>
          </Card>
        </div>
      )}

      {isCustomerSelectorOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--text-main)]/50 p-4 backdrop-blur-md">
          <Card className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl shadow-2xl">
            <div className="flex items-center justify-between gap-3 bg-[var(--ui-primary)] px-4 py-4 text-[var(--ui-on-primary)] sm:px-6">
              <h3 className="min-w-0 truncate text-sm font-extrabold tracking-wide">
                เลือกรายชื่อลูกค้า
              </h3>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsCustomerSelectorOpen(false)}
                className="shrink-0 text-[var(--ui-on-primary)] hover:bg-[var(--ui-on-primary)]/10"
              >
                <X size={16} />
                ปิด
              </Button>
            </div>

            <div className="grid min-w-0 grid-cols-1 gap-3 overflow-y-auto p-4 sm:grid-cols-2 lg:grid-cols-3">
              {customers.length > 0 ? (
                customers.map((c) => (
                  <Button
                    type="button"
                    key={c.customer_id}
                    variant="secondary"
                    size="sm"
                    onClick={() => selectCustomer(c)}
                    className="min-h-20 flex-col items-start justify-start gap-1 rounded-2xl p-3 text-left"
                  >
                    <span className="font-black text-[var(--text-main)]">
                      {c.customer_name}
                    </span>
                    <span className="text-[11px] text-[var(--text-soft)]">
                      {c.phone || "-"}
                    </span>
                    <span className="text-[10px] text-[var(--text-soft)]">
                      {c.customer_id}
                    </span>
                  </Button>
                ))
              ) : (
                <div className="col-span-full py-10 text-center text-sm font-bold text-[var(--text-soft)]">
                  ยังไม่มีรายชื่อลูกค้า
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </section>
  );
}
