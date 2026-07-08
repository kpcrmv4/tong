import React, { useState, useEffect } from "react";
import { Form } from "./ui/Form";
import { JirakitDB } from "../db";
import { Appointment, Customer } from "../types";
import {
  Calendar,
  MapPin,
  Phone,
  Package,
  Check,
  Trash2,
  Edit3,
  Plus,
  Clock,
} from "lucide-react";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Select } from "./ui/Select";
import { Textarea } from "./ui/Textarea";

const BUDDHIST_HOLY_DAYS: Record<string, { label: string; detail?: string }> = {
  "2026-07-01": { label: "777", detail: "777." },
  "2026-07-09": { label: "888", detail: "888." },
  "2026-07-17": { label: "999", detail: "999." },
  "2026-07-24": { label: "000", detail: "000." },
};

const getLocalDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const WANPRA_ICON_SRC =
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#fde047"/>
          <stop offset="45%" stop-color="#f59e0b"/>
          <stop offset="100%" stop-color="#ea580c"/>
        </linearGradient>
      </defs>
      <path
        d="M32 4c-6 0-9 5-9 10v9c0 4 3 8 9 8s9-4 9-8v-9c0-5-3-10-9-10z"
        fill="none"
        stroke="url(#g)"
        stroke-width="5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        d="M17 40V29c0-6 5-10 11-10h8c6 0 11 4 11 10v11"
        fill="none"
        stroke="url(#g)"
        stroke-width="5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        d="M19 40c8 0 17-6 20-18"
        fill="none"
        stroke="url(#g)"
        stroke-width="5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        d="M6 48h52v7H6z"
        fill="none"
        stroke="url(#g)"
        stroke-width="5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        d="M8 48c3 0 3-4 6-4s3 4 6 4 3-4 6-4 3 4 6 4 3-4 6-4 3 4 6 4 3-4 6-4 3 4 6 4"
        fill="none"
        stroke="url(#g)"
        stroke-width="5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  `);

export default function Appointments({
  triggerRefresh,
  refreshCount,
}: {
  triggerRefresh: () => void;
  refreshCount: number;
}) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  const [activeTab, setActiveTab] = useState<
    "Calendar" | "To Deliver" | "To Collect" | "Completed"
  >("Calendar");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [productsDetail, setProductsDetail] = useState("");
  const [status, setStatus] = useState<
    "To Deliver" | "To Collect" | "Completed"
  >("To Deliver");

  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    loadData();
  }, [refreshCount]);

  const loadData = () => {
    const apps = JirakitDB.getAppointments().filter(
      (x) =>
        x.appointment_status !== "Cancelled" &&
        x.appointment_status !== "Active" &&
        x.appointment_status !== "Done",
    );

    const oldApps = JirakitDB.getAppointments()
      .filter((x) => x.appointment_status === "Active")
      .map((x) => ({ ...x, appointment_status: "To Deliver" as any }));

    setAppointments([...apps, ...oldApps]);
    setCustomers(
      JirakitDB.getCustomers().filter((c) => c.customer_status === "Active"),
    );
  };

  const sortByDateAsc = (a: Appointment, b: Appointment) =>
    new Date(a.appointment_date).getTime() -
    new Date(b.appointment_date).getTime();

  const sortByDateDesc = (a: Appointment, b: Appointment) =>
    new Date(b.appointment_date).getTime() -
    new Date(a.appointment_date).getTime();

  const toDeliver = appointments
    .filter(
      (x) =>
        x.appointment_status === "To Deliver" ||
        x.appointment_status === ("Active" as any),
    )
    .sort(sortByDateAsc);

  const toCollect = appointments
    .filter((x) => x.appointment_status === "To Collect")
    .sort(sortByDateAsc);

  const completed = appointments
    .filter(
      (x) =>
        x.appointment_status === "Completed" ||
        x.appointment_status === ("Done" as any),
    )
    .sort(sortByDateDesc);

  const handleOpenModal = (app?: Appointment, defaultDate?: string) => {
    if (app) {
      setEditingId(app.appointment_id);
      setTitle(app.title || "");
      setDate(app.appointment_date || new Date().toISOString().slice(0, 10));
      setCustomerName(app.customer_name || "");
      setPhone(app.phone || "");
      setLocation(app.location || "");
      setProductsDetail(app.products_detail || "");
      setStatus(app.appointment_status as any);
    } else {
      setEditingId(null);
      setTitle("");
      setDate(defaultDate || new Date().toISOString().slice(0, 10));
      setCustomerName("");
      setPhone("");
      setLocation("");
      setProductsDetail("");
      setStatus(
        activeTab === "Completed" || activeTab === "Calendar"
          ? "To Deliver"
          : activeTab,
      );
    }

    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !date) {
      alert("Please enter the appointment title and date.");
      return;
    }

    JirakitDB.saveAppointment({
      appointment_id: editingId || "",
      title,
      appointment_date: date,
      customer_name: customerName,
      phone,
      location,
      products_detail: productsDetail,
      appointment_status: status as any,
    });

    setIsModalOpen(false);
    triggerRefresh();
  };

  const handleDelete = (id: string) => {
    if (confirm("5555555555555+")) {
      JirakitDB.deleteAppointment(id);
      triggerRefresh();
    }
  };

  const handleAdvanceState = (app: Appointment) => {
    if (
      app.appointment_status === "To Deliver" ||
      app.appointment_status === ("Active" as any)
    ) {
      JirakitDB.updateAppointmentStatus(app.appointment_id, "To Collect");
    } else if (app.appointment_status === "To Collect") {
      JirakitDB.updateAppointmentStatus(app.appointment_id, "Completed");
    }

    triggerRefresh();
  };

  const renderCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days: React.ReactNode[] = [];

    for (let i = 0; i < firstDay; i++) {
      days.push(
        <div
          key={`empty-${i}`}
          className="h-24 border border-[var(--ui-border)] ai-panel rounded-[16px]"
        />,
      );
    }

    for (let i = 1; i <= daysInMonth; i++) {
      const dStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
      const dayApps = appointments.filter((a) => a.appointment_date === dStr);
      const isToday = dStr === getLocalDateKey(new Date());
      const holyDay = BUDDHIST_HOLY_DAYS[dStr];

      days.push(
        <div
          key={`day-${i}`}
          onClick={() => handleOpenModal(undefined, dStr)}
          style={{
            borderRadius: "16px",
            ...(isToday
              ? {
                  backgroundColor:
                    "color-mix(in srgb, var(--ui-primary) 10%, var(--ui-card))",
                  borderColor: "var(--ui-primary)",
                  boxShadow:
                    "0 0 0 2px color-mix(in srgb, var(--ui-primary) 18%, transparent)",
                }
              : {}),
          }}
          className={`h-28 border p-2 cursor-pointer transition-all hover:border-[var(--ui-text)] hover:shadow-md flex flex-col ${
            isToday ? "ai-panel" : "ai-panel border-[var(--ui-border)]"
          }`}
        >
          <div className="flex items-center justify-between gap-1 font-black">
            <div className="w-7 h-7 shrink-0 flex items-center justify-center">
              {holyDay && (
                <img
                  src={WANPRA_ICON_SRC}
                  alt="ด6"
                  title={holyDay.detail || "8...."}
                  className="w-6 h-6 object-contain"
                />
              )}
            </div>

            <div className="flex items-center gap-1">
              {isToday && (
                <span
                  className="text-[10px] font-black px-2 py-0.5 rounded-full"
                  style={{
                    color: "var(--ui-primary)",
                    backgroundColor:
                      "color-mix(in srgb, var(--ui-primary) 16%, transparent)",
                  }}
                >
                  วันนี้
                </span>
              )}

              <span
                className={
                  isToday
                    ? "text-[var(--ui-primary)]"
                    : "text-[var(--text-soft)]"
                }
              >
                {i}
              </span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1 mt-1">
            {dayApps.slice(0, 3).map((a) => (
              <div
                key={a.appointment_id}
                className={`text-[10px] p-1 rounded-[16px] truncate text-[var(--text-main)] ${
                  a.appointment_status === "To Deliver" ||
                  a.appointment_status === ("Active" as any)
                    ? "primary-gradient-bg"
                    : a.appointment_status === "To Collect"
                      ? "bg-[var(--ui-warning)] text-[var(--ui-on-primary)]"
                      : "bg-[var(--ui-success)] text-[var(--ui-on-primary)]"
                }`}
              >
                ****456 {a.title}
              </div>
            ))}

            {dayApps.length > 3 && (
              <div className="text-[10px] text-[var(--text-soft)] font-bold text-center">
                +{dayApps.length - 3} ด1
              </div>
            )}
          </div>
        </div>,
      );
    }

    return (
      <div className="ai-panel p-6 rounded-[16px] shadow-sm border border-[var(--ui-border)]">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-[var(--text-main)]">
            ตารางนัดหมาย
          </h3>

          <div className="flex gap-2 items-center">
            <button
              type="button"
              onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
              className="border-0 bg-transparent px-2 text-xl font-black text-[var(--text-main)] shadow-none outline-none hover:text-[var(--ui-primary)]"
              aria-label="เดือนก่อนหน้า"
            >
              {"<<"}
            </button>

            <span className="font-bold text-lg">
              {currentDate.toLocaleDateString("th-TH", {
                month: "long",
                year: "numeric",
              })}
            </span>

            <button
              type="button"
              onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
              className="border-0 bg-transparent px-2 text-xl font-black text-[var(--text-main)] shadow-none outline-none hover:text-[var(--ui-primary)]"
              aria-label="เดือนถัดไป"
            >
              {">>"}
            </button>

            <Button
              onClick={() => setCurrentDate(new Date())}
              className="ml-2 text-xs font-bold text-[var(--text-main)] hover:underline rounded-[16px]"
            >
              วันนี้
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-2 mb-2 text-center font-bold text-sm text-[var(--text-soft)]">
          <div>อาทิตย์</div>
          <div>จันทร์</div>
          <div>อังคาร</div>
          <div>พุธ</div>
          <div>พฤหัสบดี</div>
          <div>ศุกร์</div>
          <div>เสาร์</div>
        </div>

        <div className="grid grid-cols-7 gap-2">{days}</div>
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-full mx-auto w-full animate-in fade-in zoom-in-95 duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-[var(--text-main)] flex items-center gap-2">
            <Calendar size={30} />
            ตารางนัดหมาย
          </h2>
        </div>

        <Button
          onClick={() => handleOpenModal()}
          className="outer-cont text-[var(--text-main)] px-5 py-2.5 rounded-[16px] font-black shadow-md flex items-center gap-2 transition-transform active:scale-95"
        >
          <Plus size={18} /> เพิ่มนัดหมายใหม่
        </Button>
      </div>

      {/* Top Tabs */}
      <div className="grid grid-cols-4 gap-2 shrink-0 mb-6 w-full min-w-0 overflow-hidden">
        {[
          {
            id: "Calendar",
            label: "ปฏิทินนัดหมาย",
            count: null,
          },
          {
            id: "To Deliver",
            label: "งานที่ต้องส่ง",
            count: toDeliver.length,
          },
          {
            id: "To Collect",
            label: "งานที่ต้องทำ",
            count: toCollect.length,
          },
          {
            id: "Completed",
            label: "งานที่ทำเสร็จแล้ว",
            count: completed.length,
          },
        ].map((tab) => (
          <Button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`min-w-0 h-14 px-4 rounded-[16px] border border-[var(--ui-border)] transition-colors cursor-pointer flex items-center justify-between gap-2 overflow-hidden ${
              activeTab === tab.id
                ? "ai-panel text-[var(--text-main)] shadow-[inset_0_2px_0_0_var(--ui-primary)]"
                : "bg-transparent text-[var(--text-soft)] hover:text-[var(--text-main)] hover:ai-panel"
            }`}
          >
            <span className="min-w-0 truncate text-sm font-extrabold">
              {tab.label}
            </span>

            {tab.count !== null && (
              <span
                className={`shrink-0 w-7 h-7 rounded-full text-xs font-black flex items-center justify-center ${
                  activeTab === tab.id
                    ? "bg-[var(--ui-primary)] text-[var(--ui-on-primary)]"
                    : "bg-[var(--ui-card)] border border-[var(--ui-border)] text-[var(--text-soft)]"
                }`}
              >
                {tab.count}
              </span>
            )}
          </Button>
        ))}
      </div>

      {/* Content Area */}
      {activeTab === "Calendar" && renderCalendar()}

      {activeTab === "To Deliver" && (
        <div className="ai-panel border border-[var(--ui-border)] rounded-[16px] p-6 shadow-sm flex flex-col min-h-[500px]">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-black text-xl text-[var(--text-main)]">มาส</h3>
            <span className="primary-gradient-bg/20 text-[var(--text-main)] px-4 py-1.5 rounded-full text-sm font-bold">
              {toDeliver.length} นานนนนน
            </span>
          </div>

          <div className="space-y-4">
            {toDeliver.length === 0 ? (
              <p className="text-center text-[var(--text-soft)] py-20 font-bold text-lg">
                พระ
              </p>
            ) : (
              toDeliver.map((app) => (
                <div
                  key={app.appointment_id}
                  className="border-l-4 border-[var(--ui-text)] ai-panel rounded-[16px] shadow-sm border-t border-r border-b border-[var(--ui-border)] p-5 flex flex-col md:flex-row justify-between gap-4 group hover:bg-[var(--ui-surface)] transition-colors"
                >
                  <div className="space-y-2 flex-1">
                    <h4 className="font-black text-lg text-[var(--text-main)]">
                      {app.title}
                    </h4>

                    <div className="flex flex-wrap gap-4 text-xs font-semibold text-[var(--text-soft)]">
                      <span className="flex items-center gap-1">
                        <Clock size={14} className="text-[var(--ui-warning)]" />
                        {new Date(app.appointment_date).toLocaleDateString(
                          "th-TH",
                        )}
                      </span>

                      <span className="flex items-center gap-1">
                        <Phone size={14} className="text-[var(--ui-primary)]" />
                        {app.customer_name} {app.phone && `(${app.phone})`}
                      </span>
                    </div>

                    {app.location && (
                      <div className="text-xs text-[var(--text-soft)] flex items-start gap-1">
                        <MapPin
                          size={14}
                          className="text-[var(--ui-warning)] shrink-0 mt-0.5"
                        />
                        <span>{app.location}</span>
                      </div>
                    )}

                    {app.products_detail && (
                      <div className="text-xs text-[var(--text-soft)] flex items-start gap-1">
                        <Package
                          size={14}
                          className="text-[var(--ui-primary)] shrink-0 mt-0.5"
                        />
                        <span>{app.products_detail}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex md:flex-col justify-end gap-2 shrink-0 md:w-32">
                    <Button
                      onClick={() => handleAdvanceState(app)}
                      className="flex-1 outer-cont text-[var(--text-main)] px-4 py-2 rounded-[16px] font-bold text-xs flex items-center justify-center gap-1 shadow-sm"
                    >
                      <Check size={14} /> เออออออออดอดอ
                    </Button>

                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleOpenModal(app)}
                        className="flex-1 ai-panel border border-[var(--ui-border)] hover:bg-[var(--ui-text)] hover:text-[var(--text-main)] text-[var(--text-soft)] py-2 rounded-[16px] transition-colors flex justify-center"
                      >
                        <Edit3 size={16} />
                      </Button>

                      <Button
                        onClick={() => handleDelete(app.appointment_id)}
                        className="flex-1 bg-[color-mix(in_srgb,var(--ui-danger)_10%,transparent)] border border-[var(--ui-danger)] hover:bg-[color-mix(in_srgb,var(--ui-danger)_12%,var(--ui-surface))] hover:text-[var(--text-main)] text-[var(--ui-danger)] py-2 rounded-[16px] transition-colors flex justify-center"
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === "To Collect" && (
        <div className="ai-panel border border-[var(--ui-border)] rounded-[16px] p-6 shadow-sm flex flex-col min-h-[500px]">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-black text-xl text-[var(--text-main)]">
              ไปปปป
            </h3>
            <span className="bg-[var(--ui-warning)] text-[var(--ui-on-primary)] border border-transparent px-4 py-1.5 rounded-full text-sm font-bold">
              {toCollect.length} 45454545
            </span>
          </div>

          <div className="space-y-4">
            {toCollect.length === 0 ? (
              <p className="text-center text-[var(--text-soft)] py-20 font-bold text-lg">
                พพพพพพพพพพพพพพพพพพพพ
              </p>
            ) : (
              toCollect.map((app) => (
                <div
                  key={app.appointment_id}
                  className="border-l-4 border-[var(--ui-warning)] ai-panel rounded-[16px] shadow-sm border-t border-r border-b border-[var(--ui-border)] p-5 flex flex-col md:flex-row justify-between gap-4 group hover:bg-[var(--ui-surface)] transition-colors"
                >
                  <div className="space-y-2 flex-1">
                    <h4 className="font-black text-lg text-[var(--text-main)]">
                      {app.title}
                    </h4>

                    <div className="flex flex-wrap gap-4 text-xs font-semibold text-[var(--text-soft)]">
                      <span className="flex items-center gap-1">
                        <Clock size={14} className="text-[var(--ui-warning)]" />
                        {new Date(app.appointment_date).toLocaleDateString(
                          "th-TH",
                        )}
                      </span>

                      <span className="flex items-center gap-1">
                        <Phone size={14} className="text-[var(--ui-primary)]" />
                        {app.customer_name} {app.phone && `(${app.phone})`}
                      </span>
                    </div>

                    {app.location && (
                      <div className="text-xs text-[var(--text-soft)] flex items-start gap-1">
                        <MapPin
                          size={14}
                          className="text-[var(--ui-warning)] shrink-0 mt-0.5"
                        />
                        <span>{app.location}</span>
                      </div>
                    )}

                    {app.products_detail && (
                      <div className="text-xs text-[var(--text-soft)] flex items-start gap-1">
                        <Package
                          size={14}
                          className="text-[var(--ui-primary)] shrink-0 mt-0.5"
                        />
                        <span>{app.products_detail}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex md:flex-col justify-end gap-2 shrink-0 md:w-32">
                    <Button
                      onClick={() => handleAdvanceState(app)}
                      className="flex-1 ag-btn-primary px-4 py-2 rounded-[16px] font-bold text-xs flex items-center justify-center gap-1 shadow-sm"
                    >
                      <Package size={14} /> แปปปป
                    </Button>

                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleOpenModal(app)}
                        className="flex-1 ai-panel border border-[var(--ui-border)] hover:bg-[var(--ui-surface)] text-[var(--text-soft)] py-2 rounded-[16px] transition-colors flex justify-center"
                      >
                        <Edit3 size={16} />
                      </Button>

                      <Button
                        onClick={() => handleDelete(app.appointment_id)}
                        className="flex-1 bg-[color-mix(in_srgb,var(--ui-danger)_10%,transparent)] border border-[var(--ui-danger)] hover:bg-[color-mix(in_srgb,var(--ui-danger)_12%,var(--ui-surface))] hover:text-[var(--text-main)] text-[var(--ui-danger)] py-2 rounded-[16px] transition-colors flex justify-center"
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === "Completed" && (
        <div className="ai-panel border border-[var(--ui-border)] rounded-[16px] p-6 shadow-sm flex flex-col min-h-[500px]">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-black text-xl text-[var(--ui-primary)]">
              เก็บ
            </h3>
            <span className="bg-[var(--ui-primary)]/20 text-[var(--ui-primary)] px-4 py-1.5 rounded-full text-sm font-bold">
              {completed.length} ไปกะ
            </span>
          </div>

          <div className="space-y-4">
            {completed.length === 0 ? (
              <p className="text-center text-[var(--text-soft)] py-20 font-bold text-lg">
                บ่ไป
              </p>
            ) : (
              completed.map((app) => (
                <div
                  key={app.appointment_id}
                  className="border-l-4 border-[var(--ui-primary)] ai-panel rounded-[16px] shadow-sm border-t border-r border-b border-[var(--ui-border)] p-5 flex flex-col md:flex-row justify-between gap-4 group hover:bg-[var(--ui-surface)] transition-colors opacity-80"
                >
                  <div className="space-y-2 flex-1">
                    <h4 className="font-black text-lg text-[var(--ui-primary)] line-through decoration-[var(--ui-primary)]/30">
                      <Check size={18} className="inline mr-1" />
                      {app.title}
                    </h4>

                    <div className="flex flex-wrap gap-4 text-xs font-semibold text-[var(--text-soft)]">
                      <span className="flex items-center gap-1">
                        <Clock size={14} className="text-[var(--text-soft)]" />
                        {new Date(app.appointment_date).toLocaleDateString(
                          "th-TH",
                        )}
                      </span>

                      <span className="flex items-center gap-1">
                        <Phone size={14} className="text-[var(--text-soft)]" />
                        {app.customer_name} {app.phone && `(${app.phone})`}
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 shrink-0">
                    <div className="flex gap-2 items-start h-full">
                      <Button
                        onClick={() => handleOpenModal(app)}
                        className="ai-panel border border-[var(--ui-border)] hover:bg-[var(--ui-primary)] hover:text-[var(--ui-on-primary)] text-[var(--text-soft)] px-4 py-2 rounded-[16px] transition-colors flex justify-center"
                      >
                        <Edit3 size={16} />
                      </Button>

                      <Button
                        onClick={() => handleDelete(app.appointment_id)}
                        className="bg-[color-mix(in_srgb,var(--ui-danger)_10%,transparent)] border border-[var(--ui-danger)] hover:bg-[color-mix(in_srgb,var(--ui-danger)_12%,var(--ui-surface))] hover:text-[var(--text-main)] text-[var(--ui-danger)] px-4 py-2 rounded-[16px] transition-colors flex justify-center"
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--text-main)]/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="ai-panel rounded-[16px] w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="ai-panel p-5 flex justify-between items-center border-b border-[var(--ui-border)]">
              <h3 className="text-xl font-black text-[var(--text-main)] flex items-center gap-2">
                {editingId ? "แก้ไขการนัดหมาย" : "เพิ่มการนัดหมาย"}
              </h3>

              <Button
                onClick={() => setIsModalOpen(false)}
                className="text-[var(--text-soft)] hover:text-[var(--text-main)] text-2xl font-black px-2 cursor-pointer leading-none rounded-[16px]"
              >
                &times;
              </Button>
            </div>

            <Form
              onSubmit={handleSave}
              className="p-6 overflow-y-auto space-y-5"
            >
              <div>
                <label className="block text-sm font-bold text-[var(--text-main)] mb-1">
                  หัวข้อนัดหมาย / นัดส่งด่วน *
                </label>

                <Input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full border border-[var(--ui-border)] rounded-[16px] px-4 py-3"
                  placeholder="เช่น จัดส่งนั่งร้าน 40 ชุด โครงการสร้างตึก"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-bold text-[var(--text-main)] mb-1">
                    วันที่ต้องการ *
                  </label>

                  <Input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full border border-[var(--ui-border)] rounded-[16px] px-4 py-3"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-[var(--text-main)] mb-1">
                    ลูกค้าเกี่ยวข้อง
                  </label>

                  <div className="relative">
                    <Input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full border border-[var(--ui-border)] rounded-[16px] px-4 py-3"
                      placeholder="เช่น บจก. ก่อสร้างมั่นคง"
                      list="customer-list-apt"
                    />

                    <datalist id="customer-list-apt">
                      {customers.map((c) => (
                        <option key={c.customer_id} value={c.customer_name}>
                          {c.phone}
                        </option>
                      ))}
                    </datalist>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-bold text-[var(--text-main)] mb-1">
                    เบอร์ติดต่อ
                  </label>

                  <Input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full border border-[var(--ui-border)] rounded-[16px] px-4 py-3"
                    placeholder="เช่น 081-234-5678"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-[var(--text-main)] mb-1">
                    สถานะงาน
                  </label>

                  <Select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full border border-[var(--ui-border)] rounded-[16px] px-4 py-3 font-bold"
                  >
                    <option value="To Deliver">งานที่ต้องส่ง</option>
                    <option value="To Collect">งานที่ต้องเก็บ</option>
                    <option value="Completed">เสร็จสมบูรณ์</option>
                  </Select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-[var(--text-main)] mb-1">
                  สินค้าที่ต้องจัดการ / จำนวน
                </label>

                <Input
                  type="text"
                  value={productsDetail}
                  onChange={(e) => setProductsDetail(e.target.value)}
                  className="w-full border border-[var(--ui-border)] rounded-[16px] px-4 py-3"
                  placeholder="เช่น แบบคาน 10 แผ่น, ข้อเสือ 50 ตัว"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-[var(--text-main)] mb-1">
                  คำอธิบายหรือพิกัดจัดส่ง
                </label>

                <Textarea
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full border border-[var(--ui-border)] rounded-[16px] px-4 py-3"
                  placeholder="เช่น หน้างานตรงข้ามปั๊มปตท. ท่าเสา เลือกรุ่นสีก่อสร้าง"
                  rows={3}
                />
              </div>

              <div className="pt-4 border-t border-[var(--ui-border)] flex gap-3">
                <Button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-3 rounded-[16px] font-bold ai-panel hover:bg-[var(--ui-text)] text-[var(--text-soft)] transition-colors"
                >
                  ยกเลิก
                </Button>

                <Button
                  type="submit"
                  className="flex-1 outer-cont text-[var(--text-main)] px-6 py-3 rounded-[16px] font-black flex justify-center items-center gap-2 shadow-md transition-colors"
                >
                  ✓ บันทึกกำหนดการนัดหมาย
                </Button>
              </div>
            </Form>
          </div>
        </div>
      )}
    </div>
  );
}
