import React from "react";
import { ShoppingCart } from "lucide-react";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";

export interface POSPaymentSummaryProps {
  discountOn: boolean;
  setDiscountOn: (val: boolean) => void;
  discountVal: number;
  setDiscountVal: (val: number) => void;
  depositOn: boolean;
  setDepositOn: (val: boolean) => void;
  depositVal: number;
  setDepositVal: (val: number) => void;
  deliveryOn: boolean;
  setDeliveryOn: (val: boolean) => void;
  deliveryVal: number;
  setDeliveryVal: (val: number) => void;
  vatOn: boolean;
  setVatOn: (val: boolean) => void;
  currentCalcs: any;
  handleProcessPayment: () => void;
  cart: any[];
}

interface ToggleRowProps {
  label: string;
  checked: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
}

interface MoneyUnderlineInputProps {
  value: number;
  onChange: (value: number) => void;
  ariaLabel: string;
}

const MoneyUnderlineInput = ({
  value,
  onChange,
  ariaLabel,
}: MoneyUnderlineInputProps) => (
  <div className="flex h-8 w-[72px] min-w-[72px] max-w-[72px] items-end overflow-visible border-b-2 border-[var(--text-main)]">
    <input
      type="number"
      inputMode="decimal"
      placeholder="0"
      value={value || ""}
      onChange={(e) => onChange(Number(e.target.value))}
      aria-label={ariaLabel}
      className="h-5 w-full min-w-0 max-w-full translate-y-[4px] appearance-none border-0 !border-0 bg-transparent !bg-transparent p-0 !p-0 text-right text-sm font-black leading-5 text-[var(--text-main)] outline-none !outline-none shadow-none !shadow-none ring-0 !ring-0 focus:border-0 focus:!border-0 focus:outline-none focus:!outline-none focus:ring-0 focus:!ring-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
    />
  </div>
);

const ToggleRow = ({ label, checked, onToggle, children }: ToggleRowProps) => (
  <div className="flex h-11 min-w-0 items-center justify-between gap-2 px-1">
    <span className="min-w-0 flex-1 truncate text-xs font-semibold text-[var(--text-main)]">
      {label}
    </span>

    <div className="flex h-9 shrink-0 items-center justify-end gap-2">
      {children}

      <button
        type="button"
        onClick={onToggle}
        className={`relative box-border flex h-6 w-11 min-w-[44px] max-w-[44px] shrink-0 cursor-pointer items-center justify-start rounded-full border-2 border-transparent px-[2px] transition-colors duration-200 ease-in-out ${
          checked ? "bg-[var(--ui-primary)]" : "bg-[var(--ui-border)]"
        }`}
        aria-pressed={checked}
      >
        <span
          className={`pointer-events-none block h-5 w-5 shrink-0 rounded-full bg-[var(--ui-surface)] shadow-sm transition-transform duration-200 ease-in-out ${
            checked ? "translate-x-[18px]" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  </div>
);

export default function POSPaymentSummary({
  discountOn,
  setDiscountOn,
  discountVal,
  setDiscountVal,
  depositOn,
  setDepositOn,
  depositVal,
  setDepositVal,
  deliveryOn,
  setDeliveryOn,
  deliveryVal,
  setDeliveryVal,
  vatOn,
  setVatOn,
  currentCalcs,
  handleProcessPayment,
  cart,
}: POSPaymentSummaryProps) {
  return (
    <section
      className="space-y-3 border-t border-[var(--ui-border)] pt-3 text-xs font-bold text-[var(--text-main)]"
      aria-label="สรุปยอดและชำระเงิน"
    >
      <Card className="space-y-1 border-0 bg-transparent p-0 shadow-none">
        <ToggleRow
          label="เปิดส่วนลด"
          checked={discountOn}
          onToggle={() => {
            const next = !discountOn;
            setDiscountOn(next);
            if (!next) setDiscountVal(0);
          }}
        >
          {discountOn && (
            <MoneyUnderlineInput
              value={discountVal}
              onChange={setDiscountVal}
              ariaLabel="ยอดส่วนลด"
            />
          )}
        </ToggleRow>

        <ToggleRow
          label="หักเงินมัดจำ"
          checked={depositOn}
          onToggle={() => {
            const next = !depositOn;
            setDepositOn(next);
            if (!next) setDepositVal(0);
          }}
        >
          {depositOn && (
            <MoneyUnderlineInput
              value={depositVal}
              onChange={setDepositVal}
              ariaLabel="ยอดเงินมัดจำ"
            />
          )}
        </ToggleRow>

        <ToggleRow
          label="ค่าขนส่งเพิ่มเติม"
          checked={deliveryOn}
          onToggle={() => {
            const next = !deliveryOn;
            setDeliveryOn(next);
            if (!next) setDeliveryVal(0);
          }}
        >
          {deliveryOn && (
            <MoneyUnderlineInput
              value={deliveryVal}
              onChange={setDeliveryVal}
              ariaLabel="ค่าขนส่งเพิ่มเติม"
            />
          )}
        </ToggleRow>

        <ToggleRow
          label="เปิดใช้งานภาษี VAT 7%"
          checked={vatOn}
          onToggle={() => setVatOn(!vatOn)}
        />
      </Card>

      <Card className="space-y-2 p-4 text-xs font-bold">
        <div className="flex justify-between gap-3 text-[var(--text-main)]">
          <span className="break-words">มูลค่ายอดค้าอุปกรณ์รวม:</span>
          <span className="shrink-0">
            {currentCalcs.subtotal.toLocaleString(undefined, {
              minimumFractionDigits: 2,
            })}
          </span>
        </div>

        {discountOn && (
          <div className="flex justify-between gap-3 text-[var(--ui-danger)]">
            <span>ส่วนลด:</span>
            <span className="shrink-0">
              -{" "}
              {currentCalcs.discount.toLocaleString(undefined, {
                minimumFractionDigits: 2,
              })}
            </span>
          </div>
        )}

        {depositOn && (
          <div className="flex justify-between gap-3 text-[var(--ui-primary)]">
            <span>มัดจำสินค้า:</span>
            <span className="shrink-0">
              +{" "}
              {currentCalcs.deposit.toLocaleString(undefined, {
                minimumFractionDigits: 2,
              })}
            </span>
          </div>
        )}

        {deliveryOn && (
          <div className="flex justify-between gap-3 text-[var(--text-main)]">
            <span>ค่าขนส่ง:</span>
            <span className="shrink-0">
              +{" "}
              {currentCalcs.delivery.toLocaleString(undefined, {
                minimumFractionDigits: 2,
              })}
            </span>
          </div>
        )}

        {vatOn && (
          <div className="flex justify-between gap-3 text-[var(--text-main)]">
            <span>ภาษีมูลค่าเพิ่ม (VAT 7%):</span>
            <span className="shrink-0">
              +{" "}
              {currentCalcs.vat.toLocaleString(undefined, {
                minimumFractionDigits: 2,
              })}
            </span>
          </div>
        )}

        <div className="flex justify-between gap-3 border-t border-dashed border-[var(--ui-border)] pt-2 text-base font-black text-[var(--text-main)]">
          <span>ยอดรวมสุทธิ:</span>
          <span className="shrink-0">
            {currentCalcs.grand.toLocaleString(undefined, {
              minimumFractionDigits: 2,
            })}
          </span>
        </div>
      </Card>

      <Button
        type="button"
        onClick={handleProcessPayment}
        disabled={cart.length === 0}
        variant={cart.length > 0 ? "primary" : "secondary"}
        size="lg"
        className="w-full rounded-xl text-center"
      >
        <ShoppingCart size={16} className="shrink-0" />
        <span className="break-words">
          {cart.length > 0
            ? "พิมพ์บิลใบส่งของ / ชำระเงินสด"
            : "กรุณาเลือกสินค้าลงตะกร้าก่อนพิมพ์"}
        </span>
      </Button>
    </section>
  );
}
