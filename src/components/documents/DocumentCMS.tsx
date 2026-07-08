import React, { useState, useEffect, useRef } from "react";
import {
  FileText,
  FileSignature,
  Edit,
  Trash2,
  Save,
  Printer,
  Image as ImageIcon,
  Table,
  Search,
  FileDown,
  Eye,
} from "lucide-react";
import { JirakitDB } from "../../db";
import { DocumentTemplate } from "../../types";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import {
  exportA4ToImage,
  exportA4ToPdf,
  printA4Element,
} from "../../utils/a4ExportService";
import { Select } from "../ui/Select";

interface DocumentCMSProps {
  embedded?: boolean;
  initialApplyTo?: string;
  onSaved?: () => void;
}

type DocumentCmsTab = "create" | "list";

export default function DocumentCMS({
  embedded = false,
  initialApplyTo,
  onSaved,
}: DocumentCMSProps) {
  const [activeTab, setActiveTab] = useState<DocumentCmsTab>("create");
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [applyTo, setApplyTo] = useState(initialApplyTo || "ใบเสร็จรับเงิน");
  const [customApplyTo, setCustomApplyTo] = useState("");
  const [documentVersion, setDocumentVersion] = useState("ต้นฉบับ");
  const [paperSize, setPaperSize] = useState<"A4" | "A5">("A4");

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    null,
  );

  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (initialApplyTo) {
      setApplyTo(initialApplyTo);
      if (initialApplyTo === "สัญญาเช่า" || initialApplyTo === "เอกสารสัญญา") {
        setDocumentVersion("สำเนา");
      }
    }
  }, [initialApplyTo]);

  const loadData = () => {
    setTemplates(JirakitDB.getDocumentTemplates());
  };

  const resetForm = () => {
    setEditingId(null);
    setTemplateName("");
    setApplyTo(initialApplyTo || "ใบเสร็จรับเงิน");
    setCustomApplyTo("");
    setDocumentVersion("ต้นฉบับ");
    setPaperSize("A4");
    if (editorRef.current) {
      editorRef.current.innerHTML = "";
    }
  };

  const standardApplyTo = [
    "ใบเสร็จรับเงิน",
    "ใบเสนอราคา",
    "ใบแจ้งหนี้",
    "ใบส่งของ",
    "ใบรับคืนอุปกรณ์",
    "สัญญาเช่า",
    "เอกสารสัญญา",
    "แบบฟอร์มยืนยันลายเซ็น",
    "แบบฟอร์มรับทราบสัญญา",
    "หนังสือรับรอง",
    "หน้าบัตรประชาชน",
    "เอกสารทั่วไป",
  ];

  const applyToOptions = [...standardApplyTo, "ประเภทกำหนดเอง"];

  const handleEdit = (tpl: DocumentTemplate) => {
    setEditingId(tpl.id);
    setTemplateName(tpl.template_name || "");

    const safeApplyTo = tpl.apply_to || "ใบเสร็จรับเงิน";
    if (standardApplyTo.includes(safeApplyTo)) {
      setApplyTo(safeApplyTo);
      setCustomApplyTo("");
    } else {
      setApplyTo("ประเภทกำหนดเอง");
      setCustomApplyTo(safeApplyTo);
    }

    setDocumentVersion(tpl.document_version || "ต้นฉบับ");
    setPaperSize((tpl.paper_size as "A4" | "A5") || "A4");
    setActiveTab("create");

    setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.innerHTML = tpl.content_html || "";
      }
    }, 50);
  };

  const handleDelete = (id: string) => {
    if (confirm("ต้องการลบเอกสารนี้หรือไม่?")) {
      JirakitDB.deleteDocumentTemplate(id);
      loadData();
      if (selectedTemplateId === id) {
        setSelectedTemplateId(null);
      }
    }
  };

  const handlePreviewEditor = () => {
    const html = editorRef.current?.innerHTML || "";
    const existing = document.getElementById("document-cms-preview-overlay");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.id = "document-cms-preview-overlay";
    overlay.style.cssText = [
      "position:fixed",
      "inset:0",
      "z-index:2147483647",
      "background:var(--ui-overlay)",
      "display:flex",
      "align-items:center",
      "justify-content:center",
      "padding:var(--ui-card-pad)",
      "box-sizing:border-box",
    ].join(";");

    overlay.innerHTML = `
      <div style="width:min(960px,100%); max-height:94dvh; overflow:auto; background:var(--ui-surface); color:var(--text-main); border-radius:var(--ui-radius-modal); border:1px solid var(--ui-border); padding:var(--ui-card-pad); font-family:Sarabun,system-ui,sans-serif;">
        <div style="display:flex; align-items:center; justify-content:space-between; gap:var(--ui-gap-button); margin-bottom:var(--ui-card-pad-sm); position:sticky; top:0; background:var(--ui-surface); padding-bottom:var(--ui-gap-button); border-bottom:1px solid var(--ui-border);">
          <div style="font-weight:900;">ตัวอย่างเอกสาร ${paperSize}</div>
          <span role="button" data-close="1" style="display:inline-flex; align-items:center; justify-content:center; border:1px solid var(--ui-border); background:var(--ui-surface); color:var(--text-main); border-radius:var(--ui-radius-control); width:var(--ui-icon-hit); height:var(--ui-icon-hit); font-size:var(--ui-font-button); line-height:1; cursor:pointer;">×</span>
        </div>
        <div style="max-width:100%; overflow:auto; background:var(--app-bg); padding:var(--ui-card-pad-sm); border-radius:var(--ui-radius-card);">
          <div style="width:${paperSize === "A4" ? "210mm" : "148mm"}; min-height:${paperSize === "A4" ? "297mm" : "210mm"}; margin:auto; background:#ffffff; padding:12mm; box-sizing:border-box; color:#111827;">${html}</div>
        </div>
      </div>
    `;

    overlay.addEventListener("click", (event) => {
      const target = event.target as HTMLElement;
      if (target === overlay || target.dataset.close === "1") overlay.remove();
    });

    document.body.appendChild(overlay);
  };

  const handleSaveEditor = () => {
    if (!templateName.trim()) {
      alert("กรุณากรอกชื่อเอกสารก่อนบันทึก");
      return;
    }

    const finalApplyTo = applyTo === "ประเภทกำหนดเอง" ? customApplyTo : applyTo;

    if (applyTo === "ประเภทกำหนดเอง" && !customApplyTo.trim()) {
      alert("กรุณาระบุประเภทเอกสารกำหนดเอง");
      return;
    }

    const html = editorRef.current?.innerHTML || "";

    const data: Partial<DocumentTemplate> = {
      template_name: templateName,
      apply_to: finalApplyTo,
      document_version: documentVersion,
      paper_size: paperSize,
      content_html: html,
    };

    if (editingId) {
      JirakitDB.updateDocumentTemplate(editingId, data);
    } else {
      JirakitDB.saveDocumentTemplate(data);
    }

    loadData();
    onSaved?.();
    alert("บันทึกเอกสารสำเร็จ");
    resetForm();
    setActiveTab("list");
  };

  const insertPlainText = (text: string) => {
    if (!editorRef.current) return;

    editorRef.current.focus();
    const selection = window.getSelection();

    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      range.insertNode(document.createTextNode(text));
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
      return;
    }

    editorRef.current.innerHTML += text;
  };

  const insertHtml = (html: string) => {
    if (!editorRef.current) return;

    editorRef.current.focus();
    const selection = window.getSelection();

    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      const fragment = range.createContextualFragment(html);
      range.insertNode(fragment);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
      return;
    }

    editorRef.current.innerHTML += html;
  };

  const execCmd = (command: string, value: string = "") => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
  };

  const getVariables = () => [
    {
      group: "ข้อมูลร้าน",
      items: [
        { label: "ชื่อร้าน", code: "{{SHOP_NAME}}" },
        { label: "เบอร์โทร", code: "{{SHOP_PHONE}}" },
        { label: "ที่อยู่ร้าน", code: "{{SHOP_ADDRESS}}" },
        { label: "LINE ID", code: "{{LINE_ID}}" },
      ],
    },
    {
      group: "ข้อมูลลูกค้า",
      items: [
        { label: "ชื่อลูกค้า", code: "{{CUSTOMER_NAME}}" },
        { label: "เบอร์โทร", code: "{{CUSTOMER_PHONE}}" },
        { label: "ที่อยู่", code: "{{CUSTOMER_ADDRESS}}" },
        { label: "สถานที่จัดส่ง", code: "{{DELIVERY_LOCATION}}" },
      ],
    },
    {
      group: "ข้อมูลใบเสร็จ",
      items: [
        { label: "เลขที่ใบเสร็จ", code: "{{RECEIPT_NO}}" },
        { label: "วันที่", code: "{{RECEIPT_DATE}}" },
        { label: "ตารางสินค้า", code: "{{ITEMS_TABLE}}" },
        { label: "ยอดรวมสุทธิ", code: "{{GRAND_TOTAL}}" },
        { label: "ยอดเงินตัวอักษร", code: "{{THAI_BAHT_TEXT}}" },
      ],
    },
    {
      group: "ข้อมูลสัญญา",
      items: [
        { label: "เลขที่สัญญา", code: "{{CONTRACT_NO}}" },
        { label: "วันที่สัญญา", code: "{{CONTRACT_DATE}}" },
        { label: "วันเริ่มเช่า", code: "{{RENT_START_DATE}}" },
        { label: "วันสิ้นสุด", code: "{{RENT_END_DATE}}" },
        { label: "ข้อตกลง/เงื่อนไข", code: "{{CONTRACT_TERMS}}" },
      ],
    },
    {
      group: "ลายเซ็น",
      items: [
        { label: "ลายเซ็นลูกค้า", code: "{{CUSTOMER_SIGNATURE}}" },
        { label: "ลายเซ็นพนักงาน", code: "{{STAFF_SIGNATURE}}" },
        { label: "พยาน", code: "{{WITNESS_SIGNATURE}}" },
        { label: "วันที่เซ็น", code: "{{SIGN_DATE}}" },
      ],
    },
  ];

  const filteredTemplates = templates.filter((t) => {
    if (!t) return false;
    const q = (searchQuery || "").toLowerCase();
    const name = (t.template_name || "").toLowerCase();
    const applyToValue = (t.apply_to || "").toLowerCase();
    const version = (t.document_version || "").toLowerCase();
    return name.includes(q) || applyToValue.includes(q) || version.includes(q);
  });

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  const buildTemplateExportElement = (tpl: DocumentTemplate) => {
    const exportPaperSize = (tpl.paper_size === "A5" ? "A5" : "A4") as
      | "A4"
      | "A5";
    const size =
      exportPaperSize === "A5"
        ? { width: "148mm", height: "210mm", padding: "12mm" }
        : { width: "210mm", height: "297mm", padding: "12mm" };

    const element = document.createElement("div");
    Object.assign(element.style, {
      position: "fixed",
      top: "0",
      left: "-10000px",
      width: size.width,
      minHeight: size.height,
      overflow: "hidden",
      backgroundColor: "#ffffff",
      color: "#111827",
      padding: size.padding,
      boxSizing: "border-box",
      fontFamily: "Sarabun, system-ui, sans-serif",
      pointerEvents: "none",
      zIndex: "-1",
    });

    element.innerHTML =
      tpl.content_html ||
      '<div style="padding:40px;text-align:center;">ไม่มีเนื้อหาเอกสาร</div>';
    document.body.appendChild(element);

    return {
      element,
      paperSize: exportPaperSize,
      cleanup: () => element.remove(),
    };
  };

  const getTemplatePrefix = (tpl: DocumentTemplate) =>
    `TEMPLATE-${(tpl.template_name || "DOCUMENT").replace(/[^\u0E00-\u0E7Fa-zA-Z0-9_-]+/g, "-")}`;

  const handlePrintSelectedTemplate = () => {
    if (!selectedTemplate) return;
    const prepared = buildTemplateExportElement(selectedTemplate);
    printA4Element(prepared.element, false, prepared.paperSize);
    window.setTimeout(prepared.cleanup, 1500);
  };

  const handleExportSelectedTemplateImage = async () => {
    if (!selectedTemplate) return;
    const prepared = buildTemplateExportElement(selectedTemplate);

    try {
      await exportA4ToImage({
        element: prepared.element,
        prefix: getTemplatePrefix(selectedTemplate),
        paperSize: prepared.paperSize,
      });
    } finally {
      prepared.cleanup();
    }
  };

  const handleExportSelectedTemplatePdf = async () => {
    if (!selectedTemplate) return;
    const prepared = buildTemplateExportElement(selectedTemplate);

    try {
      await exportA4ToPdf({
        element: prepared.element,
        prefix: getTemplatePrefix(selectedTemplate),
        paperSize: prepared.paperSize,
      });
    } finally {
      prepared.cleanup();
    }
  };

  const tabButtons = (
    <div className="flex shrink-0 flex-wrap items-center gap-[var(--ui-gap-button)]">
      <Button
        type="button"
        onClick={() => setActiveTab("create")}
        variant={activeTab === "create" ? "primary" : "secondary"}
        size="sm"
        className="h-[var(--ui-control-h)] rounded-[var(--ui-radius-card)] px-[var(--ui-card-pad)] text-[length:var(--ui-font-button)] font-extrabold whitespace-nowrap"
      >
        สร้างเอกสาร
      </Button>
      <Button
        type="button"
        onClick={() => {
          setActiveTab("list");
        }}
        variant={activeTab === "list" ? "primary" : "secondary"}
        size="sm"
        className="h-[var(--ui-control-h)] rounded-[var(--ui-radius-card)] px-[var(--ui-card-pad)] text-[length:var(--ui-font-button)] font-extrabold whitespace-nowrap"
      >
        รายการเอกสาร
      </Button>
    </div>
  );

  const pageHeader = (
    <div className="shrink-0 bg-transparent px-0 pb-[var(--ui-card-pad-sm)] pt-0">
      <div className="flex items-center gap-[var(--ui-gap-button)]">
        <FileText size={30} className="shrink-0 text-[var(--ui-primary)]" />
        <h1 className="text-[length:calc(var(--ui-font-body)+14px)] font-black leading-tight text-[var(--text-main)]">
          จัดการเอกสาร
        </h1>
      </div>
    </div>
  );

  return (
    <div
      className={
        embedded
          ? "mx-auto flex min-h-[72dvh] w-full max-w-full flex-col overflow-hidden bg-transparent text-[var(--text-main)]"
          : "mx-auto flex min-h-[calc(100dvh-2rem)] w-full max-w-full flex-col overflow-hidden bg-transparent text-[var(--text-main)]"
      }
    >
      <div className="min-h-0 flex-1 overflow-y-auto bg-transparent">
        {activeTab === "create" && (
          <section className="flex min-h-full min-w-0 flex-col gap-[var(--ui-gap-button)] bg-transparent p-0">
            {pageHeader}

            <div className="flex flex-wrap items-center gap-[var(--ui-gap-button)] bg-transparent p-0">
              {tabButtons}
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-[var(--ui-gap-button)] p-[var(--ui-card-pad-sm)] pb-[var(--ui-card-pad)]">
              <div className="px-[var(--ui-card-pad-sm)] py-[var(--ui-card-pad-sm)] text-[var(--text-main)]">
                <div className="flex flex-wrap items-center justify-between gap-[var(--ui-gap-button)]">
                  <div className="grid min-w-0 flex-1 grid-cols-1 gap-[var(--ui-gap-button)] sm:grid-cols-2">
                    <div>
                      <Input
                        type="text"
                        value={templateName}
                        onChange={(e) => setTemplateName(e.target.value)}
                        className="h-[var(--ui-button-h)] w-full rounded-[var(--ui-radius-control)] border border-[var(--ui-border)] bg-[var(--ui-surface)] px-[var(--ui-card-pad-sm)] text-[length:var(--ui-font-button)] outline-none"
                        placeholder="ค้นหาชื่อเอกสาร"
                      />
                    </div>

                    <div>
                      <Select
                        value={applyTo}
                        onChange={(e) => setApplyTo(e.target.value)}
                        className="h-[var(--ui-button-h)] w-full rounded-[var(--ui-radius-control)] border border-[var(--ui-border)] bg-[var(--ui-surface)] px-[var(--ui-card-pad-sm)] text-[length:var(--ui-font-button)] font-bold text-[var(--text-main)] outline-none"
                      >
                        {applyToOptions.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </Select>
                    </div>

                    {applyTo === "ประเภทกำหนดเอง" && (
                      <div className="sm:col-span-2">
                        <label className="mb-1 block text-[length:var(--ui-font-button)] font-bold text-[var(--ui-on-primary)]">
                          พิมพ์ประเภทเอกสาร
                        </label>
                        <Input
                          type="text"
                          value={customApplyTo}
                          onChange={(e) => setCustomApplyTo(e.target.value)}
                          className="h-[var(--ui-button-h)] w-full rounded-[var(--ui-radius-control)] border border-[var(--ui-border)] bg-[var(--ui-surface)] px-[var(--ui-card-pad-sm)] text-[length:var(--ui-font-button)] outline-none"
                          placeholder="ระบุประเภท..."
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-[var(--ui-gap-button)]">
                    <Button
                      type="button"
                      variant="toolbar"
                      size="sm"
                      onClick={handlePreviewEditor}
                      className="h-[var(--ui-control-h)] rounded-[var(--ui-radius-control)] px-[var(--ui-card-pad-sm)] text-[length:var(--ui-font-button)] font-extrabold whitespace-nowrap"
                    >
                      <Eye size={14} /> แสดงตัวอย่าง
                    </Button>
                    <Button
                      type="button"
                      variant="toolbar"
                      size="sm"
                      onClick={resetForm}
                      className="h-[var(--ui-control-h)] rounded-[var(--ui-radius-control)] px-[var(--ui-card-pad-sm)] text-[length:var(--ui-font-button)] font-extrabold whitespace-nowrap"
                    >
                      ล้างฟอร์ม
                    </Button>
                    <Button
                      type="button"
                      variant="toolbar"
                      size="sm"
                      onClick={handleSaveEditor}
                      className="h-[var(--ui-control-h)] rounded-[var(--ui-radius-control)] px-[var(--ui-card-pad-sm)] text-[length:var(--ui-font-button)] font-extrabold whitespace-nowrap"
                    >
                      <Save size={14} /> บันทึกเอกสาร
                    </Button>
                  </div>
                </div>
              </div>

              <div className="p-[var(--ui-card-pad-sm)]">
                <div className="flex flex-wrap items-center gap-[var(--ui-gap-button)] bg-transparent p-0">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => execCmd("bold")}
                    title="ตัวหนา"
                    className="h-[var(--ui-icon-hit)] min-w-[var(--ui-icon-hit)] rounded-[var(--ui-radius-control)] px-[var(--ui-card-pad-sm)] font-bold"
                  >
                    B
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => execCmd("italic")}
                    title="ตัวเอียง"
                    className="h-[var(--ui-icon-hit)] min-w-[var(--ui-icon-hit)] rounded-[var(--ui-radius-control)] px-[var(--ui-card-pad-sm)] italic"
                  >
                    I
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => execCmd("underline")}
                    title="ขีดเส้นใต้"
                    className="h-[var(--ui-icon-hit)] min-w-[var(--ui-icon-hit)] rounded-[var(--ui-radius-control)] px-[var(--ui-card-pad-sm)] underline"
                  >
                    U
                  </Button>

                  <Select
                    wrapperClassName="w-auto shrink-0"
                    onChange={(e) => execCmd("fontSize", e.target.value)}
                    className="h-[var(--ui-icon-hit)] w-auto min-w-[108px] rounded-[var(--ui-radius-control)] border border-[var(--ui-border)] bg-[var(--ui-surface)] px-[var(--ui-card-pad-sm)] text-[length:var(--ui-font-label)] font-black text-[var(--text-main)] outline-none"
                  >
                    <option value="1">ขนาด 1</option>
                    <option value="2">ขนาด 2</option>
                    <option value="3">ขนาด 3</option>
                    <option value="4">ขนาด 4</option>
                    <option value="5">ขนาด 5</option>
                    <option value="6">ขนาด 6</option>
                    <option value="7">ขนาด 7</option>
                  </Select>

                  <Select
                    wrapperClassName="w-auto shrink-0"
                    onChange={(e) => execCmd("fontName", e.target.value)}
                    className="h-[var(--ui-icon-hit)] w-auto min-w-[180px] rounded-[var(--ui-radius-control)] border border-[var(--ui-border)] bg-[var(--ui-surface)] px-[var(--ui-card-pad-sm)] text-[length:var(--ui-font-label)] font-black text-[var(--text-main)] outline-none"
                  >
                    <option value="Sarabun">Sarabun (ค่าเริ่มต้น)</option>
                    <option value="Arial">Arial</option>
                    <option value="Tahoma">Tahoma</option>
                  </Select>

                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => execCmd("justifyLeft")}
                    className="h-[var(--ui-icon-hit)] rounded-[var(--ui-radius-control)] px-[var(--ui-card-pad-sm)] text-[length:var(--ui-font-label)] font-black"
                  >
                    ชิดซ้าย
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => execCmd("justifyCenter")}
                    className="h-[var(--ui-icon-hit)] rounded-[var(--ui-radius-control)] px-[var(--ui-card-pad-sm)] text-[length:var(--ui-font-label)] font-black"
                  >
                    กึ่งกลาง
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => execCmd("justifyRight")}
                    className="h-[var(--ui-icon-hit)] rounded-[var(--ui-radius-control)] px-[var(--ui-card-pad-sm)] text-[length:var(--ui-font-label)] font-black"
                  >
                    ชิดขวา
                  </Button>

                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      insertHtml(
                        '<div style="width:100%; overflow-x:auto;"><table border="1" style="width:100%; border-collapse:collapse; min-height:50px;"><tr><td style="padding:8px;">ข้อมูล 1</td><td style="padding:8px;">ข้อมูล 2</td></tr></table></div><br/>',
                      )
                    }
                    className="h-[var(--ui-icon-hit)] rounded-[var(--ui-radius-control)] px-[var(--ui-card-pad-sm)] text-[length:var(--ui-font-label)] font-black"
                  >
                    <Table size={14} /> แทรกตาราง
                  </Button>

                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      insertHtml(
                        '<div style="border:1px dashed #9ca3af; background:#ffffff; padding:20px; text-align:center; width:200px; margin:10px auto; color:#6b7280;">พื้นที่รูปภาพ<br/><small>(ระบบจะแสดงภาพอัตโนมัติ)</small></div><br/>',
                      )
                    }
                    className="h-[var(--ui-icon-hit)] rounded-[var(--ui-radius-control)] px-[var(--ui-card-pad-sm)] text-[length:var(--ui-font-label)] font-black"
                  >
                    <ImageIcon size={14} /> แทรกรูปภาพ
                  </Button>

                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      insertHtml(
                        '<div style="border:1px dashed #9ca3af; padding:20px; text-align:center; width:200px; margin:10px auto;">ลายเซ็น..................................<br/>(..................................)</div><br/>',
                      )
                    }
                    className="h-[var(--ui-icon-hit)] rounded-[var(--ui-radius-control)] px-[var(--ui-card-pad-sm)] text-[length:var(--ui-font-label)] font-black"
                  >
                    <FileSignature size={14} /> แทรกช่องลายเซ็น
                  </Button>
                </div>

                <div className="mt-[var(--ui-card-pad-sm)] flex min-w-0 flex-wrap items-center gap-[var(--ui-gap-button)] bg-transparent p-0">
                  {getVariables().map((group) => (
                    <Select
                      key={group.group}
                      wrapperClassName="w-auto shrink-0"
                      value=""
                      onChange={(e) => {
                        if (e.target.value) insertPlainText(e.target.value);
                      }}
                      className="h-[var(--ui-icon-hit)] w-auto min-w-[132px] rounded-[var(--ui-radius-control)] border border-[var(--ui-border)] bg-[var(--ui-surface)] px-[var(--ui-card-pad-sm)] text-[length:var(--ui-font-label)] font-black text-[var(--text-main)] outline-none"
                    >
                      <option value="">{group.group}</option>
                      {group.items.map((v) => (
                        <option key={v.code} value={v.code}>
                          {v.label}
                        </option>
                      ))}
                    </Select>
                  ))}
                </div>
              </div>

              <div className="flex min-h-0 flex-1 justify-center overflow-auto bg-transparent p-0 pb-[var(--ui-card-pad-sm)]">
                <div
                  className={`shrink-0 bg-white text-[#111827] ${paperSize === "A4" ? "h-[297mm] w-[210mm]" : "h-[210mm] w-[148mm]"} overflow-hidden p-[12mm] shadow-lg`}
                >
                  <div
                    ref={editorRef}
                    contentEditable
                    className="h-full min-h-full w-full outline-none"
                    style={{ fontFamily: "Sarabun, sans-serif" }}
                  />
                </div>
              </div>
            </div>
          </section>
        )}

        {activeTab === "list" && (
          <section className="flex min-h-full min-w-0 flex-col gap-[var(--ui-gap-button)] bg-transparent p-0">
            {pageHeader}

            <div className="rounded-[var(--ui-radius-card)] bg-[var(--ui-primary)] px-[var(--ui-card-pad-sm)] py-[var(--ui-card-pad-sm)] text-[var(--ui-on-primary)]">
              <div className="flex flex-wrap items-center justify-between gap-[var(--ui-gap-button)]">
                {tabButtons}

                <div className="flex flex-wrap items-center gap-[var(--ui-gap-button)]">
                  <Button
                    type="button"
                    variant="toolbar"
                    onClick={() =>
                      selectedTemplate && handleEdit(selectedTemplate)
                    }
                    disabled={!selectedTemplate}
                    className="h-[var(--ui-control-h)] rounded-[var(--ui-radius-card)] px-[var(--ui-card-pad-sm)] text-[length:var(--ui-font-button)] font-extrabold whitespace-nowrap"
                  >
                    <Edit size={16} /> แก้ไข
                  </Button>
                  <Button
                    type="button"
                    variant="toolbar"
                    onClick={() =>
                      selectedTemplate && handleDelete(selectedTemplate.id)
                    }
                    disabled={!selectedTemplate}
                    className="h-[var(--ui-control-h)] rounded-[var(--ui-radius-card)] px-[var(--ui-card-pad-sm)] text-[length:var(--ui-font-button)] font-extrabold whitespace-nowrap"
                  >
                    <Trash2 size={16} /> ลบ
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-[var(--ui-gap-button)] sm:grid-cols-[minmax(0,1fr)_260px]">
              <div>
                <label className="mb-1 block text-[length:var(--ui-font-button)] font-bold text-[var(--text-main)]">
                  เลือกรายการเอกสารที่สร้างไว้
                </label>
                <Select
                  value={selectedTemplateId || ""}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="h-[var(--ui-button-h)] w-full rounded-[var(--ui-radius-card)] border border-[var(--ui-border)] bg-[var(--ui-surface)] px-[var(--ui-card-pad-sm)] text-[length:var(--ui-font-button)] font-bold text-[var(--text-main)] outline-none"
                >
                  <option value="">-- เลือกรายการเอกสาร --</option>
                  {filteredTemplates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.template_name} - {t.document_version} ({t.apply_to})
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="mb-1 block text-[length:var(--ui-font-button)] font-bold text-[var(--text-main)]">
                  ค้นหา
                </label>
                <div className="relative">
                  <Search
                    size={16}
                    className="absolute left-3 top-[var(--ui-card-pad-sm)] text-[var(--text-soft)]"
                  />
                  <Input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-[var(--ui-button-h)] w-full rounded-[var(--ui-radius-card)] border border-[var(--ui-border)] bg-[var(--ui-surface)] pl-9 pr-3 text-[length:var(--ui-font-button)] outline-none"
                    placeholder="ชื่อเทมเพลต, ประเภท..."
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-[var(--ui-gap-button)]">
              <Button
                type="button"
                variant="secondary"
                disabled={!selectedTemplate}
                onClick={handlePrintSelectedTemplate}
                className="h-[var(--ui-control-h)] rounded-[var(--ui-radius-card)] px-[var(--ui-card-pad-sm)] text-[length:var(--ui-font-button)] font-extrabold"
              >
                <Printer size={16} /> สั่งพิมพ์
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={!selectedTemplate}
                onClick={handleExportSelectedTemplateImage}
                className="h-[var(--ui-control-h)] rounded-[var(--ui-radius-card)] px-[var(--ui-card-pad-sm)] text-[length:var(--ui-font-button)] font-extrabold"
              >
                <ImageIcon size={16} /> บันทึกภาพ
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={!selectedTemplate}
                onClick={handleExportSelectedTemplatePdf}
                className="h-[var(--ui-control-h)] rounded-[var(--ui-radius-card)] px-[var(--ui-card-pad-sm)] text-[length:var(--ui-font-button)] font-extrabold"
              >
                <FileDown size={16} /> สร้าง PDF
              </Button>
            </div>

            <div className="flex min-h-0 flex-1 justify-center overflow-auto bg-transparent p-0">
              {!selectedTemplate ? (
                <div className="mt-20 text-center text-[var(--text-soft)]">
                  <FileText size={64} className="mx-auto mb-[var(--ui-card-pad)] opacity-50" />
                  <p className="text-[length:var(--ui-font-body)] font-bold">
                    ยังไม่ได้เลือกรายการเอกสาร
                  </p>
                  <p className="text-[length:var(--ui-font-button)]">
                    กรุณาเลือกเอกสารจากดรอปดาวน์ด้านบน
                  </p>
                </div>
              ) : (
                <div
                  className={`shrink-0 bg-white text-[#111827] ${selectedTemplate.paper_size === "A5" ? "h-[210mm] w-[148mm]" : "h-[297mm] w-[210mm]"} overflow-hidden p-[12mm] shadow-lg`}
                >
                  <div
                    dangerouslySetInnerHTML={{
                      __html: selectedTemplate.content_html || "",
                    }}
                    style={{ fontFamily: "Sarabun, sans-serif" }}
                  />
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
