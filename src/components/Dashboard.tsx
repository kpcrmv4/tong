/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { JirakitDB } from "../db";
import { getBuildVersion } from "../utils/versionControl";
import {
  Receipt,
  AlertNotification,
  BillItemRef,
  Expense,
  Product,
} from "../types";
import {
  Bell,
  Calendar,
  FileText,
  Plus,
  Check,
  AlertTriangle,
  TrendingUp,
  Coins,
  DollarSign,
  ArrowUpRight,
  ShoppingCart,
  Clipboard,
  X,
  Download,
  PackageOpen,
} from "lucide-react";
import AIDashboardCharts from "./ui/AIDashboardCharts";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Select } from "./ui/Select";
import { Textarea } from "./ui/Textarea";
import { DataTable } from "./ui/DataTable";

interface DashboardProps {
  onNavigate: (menu: string) => void;
  triggerRefresh: () => void;
  refreshCount: number;
}

export default function Dashboard({
  onNavigate,
  refreshCount,
}: DashboardProps) {
  const [receipts, setReceipts] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);

  useEffect(() => {
    let mounted = true;

    const loadAIData = async () => {
      try {
        const rcs = await JirakitDB.getReceipts();
        const prods = await JirakitDB.getProducts();

        const safeReceipts = Array.isArray(rcs) ? rcs : [];
        const safeProducts = Array.isArray(prods) ? prods : [];

        const stockAlerts = safeProducts
          .filter(
            (p: any) =>
              p.item_status === "Active" &&
              Number(p.qty_available || 0) <=
                Number(p.low_stock_threshold ?? 10),
          )
          .map((p: any) => ({
            id: "stock-" + p.item_id,
            title: "สต็อกต่ำ: " + p.item_name,
            detail: "คงเหลือ " + p.qty_available + " " + (p.unit || ""),
            severity: "สูง",
            target_menu: "products",
            target_id: p.item_id,
          }));

        if (!mounted) return;

        setReceipts(safeReceipts.slice(-80).reverse());
        setProducts(safeProducts);
        setAlerts(stockAlerts);
      } catch (error) {
        console.error("AI Dashboard load failed", error);
      }
    };

    loadAIData();

    return () => {
      mounted = false;
    };
  }, [refreshCount]);

  return (
    <div className="space-y-6 w-full">
      <div className="ai-panel border border-[var(--ui-border)] rounded-[var(--ui-radius-card)] p-[var(--ui-card-pad)] shadow-sm">
        <h2 className="text-xl font-black tracking-tight uppercase flex items-center gap-[var(--ui-gap-button)] text-[var(--text-main)]">
          <TrendingUp size={24} className="text-[var(--ui-primary)]" />
          JJK MUEANGSAMNAK DASHBOARD
        </h2>
      </div>

      <AIDashboardCharts
        receipts={receipts}
        products={products}
        alerts={alerts}
        onNavigate={onNavigate}
      />
    </div>
  );
}
