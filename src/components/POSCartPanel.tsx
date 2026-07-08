import React from "react";
import { AlertCircle, ShoppingCart } from "lucide-react";
import { Product } from "../types";
import { Card } from "./ui/Card";

export interface POSCartPanelProps {
  cart: any[];
  setCart: (cart: any[]) => void;
  products: Product[];
  handleRemoveCartItem: (idx: number) => void;
}

export default function POSCartPanel({
  cart,
  setCart,
  products,
  handleRemoveCartItem,
}: POSCartPanelProps) {
  const lowStockItems = cart.flatMap((item) => {
    const prod = products.find((p) => p.item_id === item.item_id);
    if (!prod || prod.qty_available > prod.low_stock_threshold) return [];
    return [
      {
        item_name: prod.item_name,
        qty_available: prod.qty_available,
        threshold: prod.low_stock_threshold,
        requested_qty: item.qty,
      },
    ];
  });

  const removeLastItem = () => {
    if (cart.length === 0) return;
    setCart(cart.slice(0, -1));
  };

  return (
    <section className="space-y-3 min-w-0" aria-label="ตะกร้าสินค้า POS">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <h3 className="flex min-w-0 items-center gap-2 text-sm font-black text-[var(--text-main)]">
          <ShoppingCart
            className="shrink-0 text-[var(--ui-primary)]"
            size={18}
          />
          <span className="truncate">ตะกร้าออกบิล ({cart.length} แถว)</span>
        </h3>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={removeLastItem}
            disabled={cart.length === 0}
            className="border-0 bg-transparent px-1 text-xs font-black text-[var(--ui-danger)] shadow-none outline-none disabled:cursor-not-allowed disabled:opacity-35"
          >
            ลบ
          </button>

          <span className="text-[var(--ui-border)]">|</span>

          <button
            type="button"
            onClick={() => setCart([])}
            disabled={cart.length === 0}
            className="border-0 bg-transparent px-1 text-xs font-black text-[var(--ui-danger)] shadow-none outline-none disabled:cursor-not-allowed disabled:opacity-35"
          >
            ลบทั้งหมด
          </button>
        </div>
      </div>

      <div className="space-y-2 max-h-[42vh] overflow-y-auto rounded-[16px] border border-[var(--ui-border)] p-3">
        {cart.length === 0 ? (
          <Card className="border-dashed p-8 text-center">
            <p className="text-xs font-semibold text-[var(--text-soft)]">
              กรุณาคลิกเลือกวัสดุเพื่อออกใบเสร็จ
            </p>
          </Card>
        ) : (
          cart.map((item, idx) => {
            const prod = products.find((p) => p.item_id === item.item_id);
            const isUnderThreshold = prod
              ? prod.qty_available <= prod.low_stock_threshold
              : false;

            return (
              <div
                key={`${item.item_id}-${idx}`}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 px-1 py-2"
              >
                <div className="min-w-0">
                  <div className="flex min-w-0 items-start gap-2">
                    <h5 className="min-w-0 flex-1 break-words text-xs font-black leading-tight text-[var(--text-main)]">
                      {item.receipt_name}
                    </h5>

                    {isUnderThreshold && (
                      <span className="shrink-0 rounded-lg border border-[var(--ui-warning)] bg-[var(--ui-warning)] px-2 py-0.5 text-[9px] font-extrabold text-[var(--text-main)]">
                        ใกล้หมดคลัง
                      </span>
                    )}
                  </div>

                  <p className="mt-1 truncate text-[10px] font-semibold leading-tight text-[var(--text-soft)]">
                    {item.line_mode === "rent" ? "เช่า" : "ขาย"} • {item.qty}{" "}
                    {item.unit} × {item.price} • {item.rent_days}{" "}
                    {item.rental_mode === "day" ? "วัน" : "รอบ"}
                  </p>
                </div>

                <div className="pt-0 text-right text-xs font-black leading-tight text-[var(--ui-primary)]">
                  {item.line_total.toLocaleString()}
                </div>
              </div>
            );
          })
        )}
      </div>

      {cart.length > 0 && lowStockItems.length > 0 && (
        <Card className="space-y-2 border-[var(--ui-warning)] bg-[var(--ui-warning)]/10 p-3">
          <div className="flex min-w-0 items-center gap-2 text-[11px] font-black uppercase text-[var(--text-main)]">
            <AlertCircle
              size={14}
              className="shrink-0 text-[var(--ui-warning)]"
            />
            <span className="break-words">
              แจ้งเตือนสินค้าสต็อกเหลือน้อยสะสมในตะกร้า
            </span>
          </div>

          <div className="space-y-1.5 max-h-[140px] overflow-y-auto">
            {lowStockItems.map((alertItem, idx) => (
              <div
                key={`${alertItem.item_name}-${idx}`}
                className="rounded-lg border border-[var(--ui-warning)]/40 bg-[var(--ui-surface)] p-2 text-[10px] font-bold text-[var(--text-main)]"
              >
                <p className="break-words font-extrabold">
                  {alertItem.item_name}
                </p>
                <div className="mt-1 flex flex-col gap-1 text-[9px] font-semibold sm:flex-row sm:justify-between">
                  <span>
                    คงเหลือในคลัง:{" "}
                    <strong className="font-mono">
                      {alertItem.qty_available}
                    </strong>{" "}
                    หน่วย
                  </span>
                  <span>เกณฑ์เตือนสต็อกต่ำ: &lt; {alertItem.threshold}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </section>
  );
}
