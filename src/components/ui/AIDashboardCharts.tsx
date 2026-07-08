import React, { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Boxes,
  Search,
  TrendingUp,
} from "lucide-react";
import { AlertNotification, Product, Receipt } from "../../types";
import { Button } from "./Button";
import { Card } from "./Card";
import { Input } from "./Input";

interface AIDashboardChartsProps {
  receipts: Receipt[];
  products: Product[];
  alerts: AlertNotification[];
  onNavigate?: (menu: string) => void;
}

const formatMoney = (value: number) =>
  value.toLocaleString("th-TH", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

const toDateKey = (value?: string) => {
  if (!value) return "";
  return value.slice(0, 10);
};

const makeLast7Days = () => {
  const days: { key: string; label: string }[] = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push({
      key: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString("th-TH", { day: "numeric", month: "short" }),
    });
  }
  return days;
};

export default function AIDashboardCharts({
  receipts,
  products,
  alerts,
  onNavigate,
}: AIDashboardChartsProps) {
  const [keyword, setKeyword] = useState("");

  const trendData = useMemo(() => {
    return makeLast7Days().map((day) => {
      const total = receipts
        .filter((r) => toDateKey(r.receipt_date || r.created_at) === day.key)
        .reduce((sum, r) => sum + (r.paid_amount || 0), 0);
      return { name: day.label, value: total };
    });
  }, [receipts]);

  const categoryData = useMemo(() => {
    const byCategory = products.reduce<Record<string, number>>((acc, p) => {
      const category = p.category || "ไม่ระบุ";
      acc[category] = (acc[category] || 0) + (p.qty_available || 0);
      return acc;
    }, {});

    return Object.entries(byCategory)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [products]);

  const stockHealthData = useMemo(() => {
    const activeProducts = products.filter((p) => p.item_status === "Active");
    const low = activeProducts.filter(
      (p) => (p.qty_available || 0) <= (p.low_stock_threshold || 10),
    ).length;
    const ready = Math.max(0, activeProducts.length - low);
    return [
      { name: "พร้อมใช้งาน", value: ready },
      { name: "ต้องเติมสต็อก", value: low },
    ];
  }, [products]);

  const filteredCriticalProducts = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return products
      .filter((p) => p.item_status === "Active")
      .filter((p) => (p.qty_available || 0) <= (p.low_stock_threshold || 10))
      .filter(
        (p) => !q || `${p.item_name} ${p.category}`.toLowerCase().includes(q),
      )
      .sort((a, b) => (a.qty_available || 0) - (b.qty_available || 0))
      .slice(0, 6);
  }, [products, keyword]);

  const totalPaid = receipts.reduce((sum, r) => sum + (r.paid_amount || 0), 0);
  const totalDebt = receipts.reduce((sum, r) => sum + (r.debt_amount || 0), 0);
  const urgentAlerts = alerts.filter((a) => a.alert_status === "Open").length;
  const activeProducts = products.filter(
    (p) => p.item_status === "Active",
  ).length;

  return (
    <section className="space-y-4" aria-label="AI dashboard charts">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="text-left">
          <h3 className="mt-1 text-lg font-black text-[var(--text-main)]">
            สรุปวิเคราะห์ยอดขาย สต็อก และแจ้งเตือน
          </h3>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => onNavigate?.("analytics")}
          >
            <BarChart3 size={14} /> ไปหน้าวิเคราะห์รายได้
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => onNavigate?.("products")}
          >
            <Boxes size={14} /> จัดการสินค้า
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <Card elevated className="p-4">
          <p className="text-xs font-black text-[var(--text-soft)]">
            เงินรับรวม
          </p>
          <p className="mt-1 text-2xl font-black text-[var(--text-main)]">
            {formatMoney(totalPaid)} บาท
          </p>
        </Card>
        <Card elevated className="p-4">
          <p className="text-xs font-black text-[var(--text-soft)]">
            หนี้ค้างรวม
          </p>
          <p className="mt-1 text-2xl font-black text-[var(--ui-danger)]">
            {formatMoney(totalDebt)} บาท
          </p>
        </Card>
        <Card elevated className="p-4">
          <p className="text-xs font-black text-[var(--text-soft)]">
            สินค้าใช้งาน
          </p>
          <p className="mt-1 text-2xl font-black text-[var(--text-main)]">
            {activeProducts} รายการ
          </p>
        </Card>
        <Card elevated className="p-4">
          <p className="text-xs font-black text-[var(--text-soft)]">
            แจ้งเตือนเปิดอยู่
          </p>
          <p className="mt-1 text-2xl font-black text-[var(--ui-warning)]">
            {urgentAlerts} รายการ
          </p>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card elevated className="p-4 xl:col-span-2">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="text-left">
              <h4 className="text-sm font-black text-[var(--text-main)]">
                แนวโน้มรับชำระ 7 วันล่าสุด
              </h4>
            </div>
            <TrendingUp size={18} className="text-[var(--text-soft)]" />
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={trendData}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient
                    id="jrkAiPaidGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor="var(--ui-primary)"
                      stopOpacity={0.3}
                    />
                    <stop
                      offset="95%"
                      stopColor="var(--ui-primary)"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="var(--ui-border)"
                  opacity={0.25}
                />
                <XAxis
                  dataKey="name"
                  tick={{ fill: "var(--text-soft)", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "var(--text-soft)", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: "var(--ui-surface)",
                    borderColor: "var(--ui-border)",
                    borderRadius: "10px",
                    color: "var(--text-main)",
                  }}
                  formatter={(value: number) => [
                    `${formatMoney(value)} บาท`,
                    "ยอดรับชำระ",
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="var(--ui-primary)"
                  strokeWidth={3}
                  fill="url(#jrkAiPaidGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card elevated className="p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="text-left">
              <h4 className="text-sm font-black text-[var(--text-main)]">
                สถานะคลังสินค้า
              </h4>
            </div>
            <Activity size={18} className="text-[var(--text-soft)]" />
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stockHealthData}
                  innerRadius={52}
                  outerRadius={88}
                  paddingAngle={4}
                  dataKey="value"
                  nameKey="name"
                >
                  {stockHealthData.map((entry, index) => (
                    <Cell
                      key={entry.name}
                      fill={
                        index === 0 ? "var(--ui-primary)" : "var(--ui-warning)"
                      }
                    />
                  ))}
                </Pie>
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: "var(--ui-surface)",
                    borderColor: "var(--ui-border)",
                    borderRadius: "10px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card elevated className="p-4 xl:col-span-2">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="text-left">
              <h4 className="text-sm font-black text-[var(--text-main)]">
                สต็อกคงเหลือตามหมวดสินค้า
              </h4>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={categoryData}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="var(--ui-border)"
                  opacity={0.25}
                />
                <XAxis
                  dataKey="name"
                  tick={{ fill: "var(--text-soft)", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "var(--text-soft)", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: "var(--ui-surface)",
                    borderColor: "var(--ui-border)",
                    borderRadius: "10px",
                  }}
                />
                <Bar
                  dataKey="value"
                  fill="var(--ui-primary)"
                  radius={[8, 8, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card elevated className="p-4">
          <div className="mb-3 text-left">
            <h4 className="flex items-center gap-2 text-sm font-black text-[var(--text-main)]">
              <AlertTriangle size={16} className="text-[var(--ui-warning)]" />{" "}
              สินค้าที่ควรติดตาม
            </h4>
          </div>
          <Input
            icon={<Search size={14} />}
            placeholder="ค้นหาชื่อสินค้า / หมวดหมู่"
            onChange={(e) => setKeyword(e.target.value)}
          />
          <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
            {filteredCriticalProducts.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[var(--ui-border)] p-4 text-center text-xs font-bold text-[var(--text-soft)]">
                ไม่พบสินค้าสต็อกต่ำตามคำค้นหา
              </div>
            ) : (
              filteredCriticalProducts.map((p) => (
                <div
                  key={p.item_id}
                  className="rounded-lg border border-[var(--ui-border)] bg-[var(--app-bg)] p-3 text-left"
                >
                  <p className="text-xs font-black text-[var(--text-main)]">
                    {p.item_name}
                  </p>
                  <div className="mt-1 flex items-center justify-between gap-2 text-[10px] font-bold text-[var(--text-soft)]">
                    <span>{p.category || "ไม่ระบุหมวด”"}</span>
                    <span className="rounded-md bg-[var(--ui-warning)]/15 px-2 py-1 text-[var(--ui-warning)]">
                      เหลือ {p.qty_available} {p.unit}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </section>
  );
}
