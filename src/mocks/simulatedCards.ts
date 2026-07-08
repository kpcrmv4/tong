// Thai address hierarchical suggestions dataset
export interface ThaiAddressPreset {
  subdistrict: string;
  district: string;
  province: string;
  zipcode: string;
}

export const THAI_ADDRESS_DATA: ThaiAddressPreset[] = [
  // Uttaradit (อุตรดิตถ์)
  { subdistrict: "ท่าเสา", district: "เมืองอุตรดิตถ์", province: "อุตรดิตถ์", zipcode: "53000" },
  { subdistrict: "ป่าเซ่า", district: "เมืองอุตรดิตถ์", province: "อุตรดิตถ์", zipcode: "53000" },
  { subdistrict: "บ้านเกาะ", district: "เมืองอุตรดิตถ์", province: "อุตรดิตถ์", zipcode: "53000" },
  { subdistrict: "ทุ่งยั้ง", district: "กันทรารมย์", province: "อุตรดิตถ์", zipcode: "53140" },
  { subdistrict: "คุ้งตะเภา", district: "เมืองอุตรดิตถ์", province: "อุตรดิตถ์", zipcode: "53000" },
  { subdistrict: "งิ้วงาม", district: "เมืองอุตรดิตถ์", province: "อุตรดิตถ์", zipcode: "53000" },
  { subdistrict: "ผาจุก", district: "เมืองอุตรดิตถ์", province: "อุตรดิตถ์", zipcode: "53000" },
  { subdistrict: "วังแดง", district: "ตรอน", province: "อุตรดิตถ์", zipcode: "53140" },
  { subdistrict: "หาดสองแคว", district: "ตรอน", province: "อุตรดิตถ์", zipcode: "53140" },
  { subdistrict: "บ้านแก่ง", district: "ตรอน", province: "อุตรดิตถ์", zipcode: "53140" },
  { subdistrict: "ศรีพนมมาศ", district: "ลับแล", province: "อุตรดิตถ์", zipcode: "53130" },
  { subdistrict: "แม่พูล", district: "ลับแล", province: "อุตรดิตถ์", zipcode: "53130" },
  { subdistrict: "ชัยจุมพล", district: "ลับแล", province: "อุตรดิตถ์", zipcode: "53130" },
  { subdistrict: "ไผ่ล้อม", district: "ลับแล", province: "อุตรดิตถ์", zipcode: "53210" },
  { subdistrict: "แสนตอ", district: "น้ำปาด", province: "อุตรดิตถ์", zipcode: "53110" },
  { subdistrict: "บ้านโคก", district: "บ้านโคก", province: "อุตรดิตถ์", zipcode: "53180" },
  { subdistrict: "ฟากท่า", district: "ฟากท่า", province: "อุตรดิตถ์", zipcode: "53160" },
  { subdistrict: "ในเมือง", district: "พิชัย", province: "อุตรดิตถ์", zipcode: "53120" },
  { subdistrict: "พญาแมน", district: "พิชัย", province: "อุตรดิตถ์", zipcode: "53120" },
  { subdistrict: "ท่าปลา", district: "ท่าปลา", province: "อุตรดิตถ์", zipcode: "53150" },
  { subdistrict: "บ่อทอง", district: "ทองแสนขัน", province: "อุตรดิตถ์", zipcode: "53230" },

  // Phitsanulok (พิษณุโลก)
  { subdistrict: "ในเมือง", district: "เมืองพิษณุโลก", province: "พิษณุโลก", zipcode: "65000" },
  { subdistrict: "พลายชุมพล", district: "เมืองพิษณุโลก", province: "พิษณุโลก", zipcode: "65000" },
  { subdistrict: "หัวรอ", district: "เมืองพิษณุโลก", province: "พิษณุโลก", zipcode: "65000" },
  { subdistrict: "อรัญญิก", district: "เมืองพิษณุโลก", province: "พิษณุโลก", zipcode: "65000" },
  { subdistrict: "วังทอง", district: "วังทอง", province: "พิษณุโลก", zipcode: "65130" },
  { subdistrict: "บางระกำ", district: "บางระกำ", province: "พิษณุโลก", zipcode: "65140" },

  // Sukhothai (สุโขทัย)
  { subdistrict: "ธานี", district: "เมืองสุโขทัย", province: "สุโขทัย", zipcode: "64000" },
  { subdistrict: "บ้านกล้วย", district: "เมืองสุโขทัย", province: "สุโขทัย", zipcode: "64000" },
  { subdistrict: "เมืองเก่า", district: "เมืองสุโขทัย", province: "สุโขทัย", zipcode: "64210" },
  { subdistrict: "สวรรคโลก", district: "สวรรคโลก", province: "สุโขทัย", zipcode: "64110" },

  // Phrae (แพร่)
  { subdistrict: "ในเมือง", district: "เมืองแพร่", province: "แพร่", zipcode: "54000" },
  { subdistrict: "ร่องฟอง", district: "เมืองแพร่", province: "แพร่", zipcode: "54000" },
  { subdistrict: "สูงเม่น", district: "สูงเม่น", province: "แพร่", zipcode: "54130" },
  { subdistrict: "เด่นชัย", district: "เด่นชัย", province: "แพร่", zipcode: "54110" },

  // Nan (น่าน)
  { subdistrict: "ในเมือง", district: "เมืองน่าน", province: "น่าน", zipcode: "55000" },
  { subdistrict: "ฝายแก้ว", district: "ภูเพียง", province: "น่าน", zipcode: "55000" },
  { subdistrict: "ปัว", district: "ปัว", province: "น่าน", zipcode: "55120" },

  // Chiang Mai (เชียงใหม่)
  { subdistrict: "ศรีภูมิ", district: "เมืองเชียงใหม่", province: "เชียงใหม่", zipcode: "50200" },
  { subdistrict: "สุเทพ", district: "เมืองเชียงใหม่", province: "เชียงใหม่", zipcode: "50200" },
  { subdistrict: "ช้างคลาน", district: "เมืองเชียงใหม่", province: "เชียงใหม่", zipcode: "50100" },

  // Bangkok (กรุงเทพมหานคร)
  { subdistrict: "พระบรมมหาราชวัง", district: "พระนคร", province: "กรุงเทพมหานคร", zipcode: "10200" },
  { subdistrict: "ดินแดง", district: "ดินแดง", province: "กรุงเทพมหานคร", zipcode: "10400" },
  { subdistrict: "ทุ่งมหาเมฆ", district: "สาทร", province: "กรุงเทพมหานคร", zipcode: "10120" },
];

// Presets for Card Scanning & Smart Card Connection Simulations
export const SIMULATED_CARDS = [
  {
    name: "นายสมจิตต์ พัฒนากร",
    phone: "081-345-6789",
    idNo: "1539900281456",
    addressNo: "112/5 ซอย 3",
    moo: "4",
    subdistrict: "ท่าเสา",
    amphoe: "เมืองอุตรดิตถ์",
    province: "อุตรดิตถ์",
    postalCode: "53000",
    worksite: "โครงการหน้างานปรับหน้าดิน ข้างโรงพยาบาลอุตรดิตถ์",
    pdpaConsent: true,
    cardColor: "from-[var(--ui-primary)] to-[var(--ui-surface)]",
    idCardSvg: `<svg viewBox="0 0 450 280" class="w-full h-full rounded-2xl shadow-xl overflow-hidden border border-[var(--ui-primary)]" style="background:var(--ui-surface);">
      <rect width="100%" height="100%" fill="none" />
      <rect width="100%" height="32" fill="var(--ui-primary)" />
      <text x="12" y="20" fill="var(--ui-on-primary)" font-family="sans-serif" font-size="10" font-weight="extrabold">บัตรประจำตัวประชาชน (Thai National ID Card)</text>
      <rect x="25" y="52" width="34" height="24" rx="3" fill="var(--ui-accent)" stroke="var(--ui-primary)" stroke-width="1.5" />
      <text x="80" y="65" fill="var(--text-main)" font-family="monospace" font-size="14" font-weight="950">1 5399 00281 45 6</text>
      <text x="80" y="85" fill="var(--ui-primary)" font-family="sans-serif" font-size="9" font-weight="bold">ชื่อ: นายสมจิตต์ พัฒนากร</text>
      <text x="80" y="98" fill="var(--text-soft)" font-family="sans-serif" font-size="8">Name: Mr. Somjit Pattanakorn</text>
      <text x="80" y="115" fill="var(--ui-primary)" font-family="sans-serif" font-size="8" font-weight="bold">เกิดวันที่: 12 ต.ค. 2518</text>
      <text x="25" y="150" fill="var(--text-main)" font-family="sans-serif" font-size="8.5" font-weight="bold">ที่อยู่: 112/5 หมู่ที่ 4 ต.ท่าเสา อ.เมืองอุตรดิตถ์ จ.อุตรดิตถ์ 53000</text>
      <text x="25" y="185" fill="var(--ui-success)" font-family="sans-serif" font-size="8" font-weight="black">✓ คุ้มครองความยินยอม PDPA ครบถ้วน</text>
      <rect x="330" y="80" width="85" height="110" rx="4" fill="var(--ui-surface)" stroke="var(--ui-border)" stroke-width="1" />
      <circle cx="372.5" cy="115" r="20" fill="var(--ui-primary)" />
      <path d="M342.5 170 c0 -12 15 -20 30 -20 s30 8 30 20" fill="var(--text-main)" />
    </svg>`,
    signatureUrl: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='100'><path d='M10 50 Q 50 10, 100 50 T 200 50 T 290 30' fill='none' stroke='var(--text-main)' stroke-width='4'/></svg>"
  },
  {
    name: "นางสาวพัชรี สว่างธรรม",
    phone: "089-456-7812",
    idNo: "3530300194881",
    addressNo: "45",
    moo: "3",
    subdistrict: "แม่พูล",
    amphoe: "ลับแล",
    province: "อุตรดิตถ์",
    postalCode: "53130",
    worksite: "โครงการก่อสร้างศูนย์รวมสินค้าเกษตรและโอทอปลับแล",
    pdpaConsent: true,
    cardColor: "from-[var(--ui-primary)] to-[var(--ui-surface)]",
    idCardSvg: `<svg viewBox="0 0 450 280" class="w-full h-full rounded-2xl shadow-xl overflow-hidden border border-[var(--ui-primary)]" style="background:var(--ui-surface);">
      <rect width="100%" height="100%" fill="none" />
      <rect width="100%" height="32" fill="var(--ui-primary)" />
      <text x="12" y="20" fill="var(--ui-on-primary)" font-family="sans-serif" font-size="10" font-weight="extrabold">บัตรประจำตัวประชาชน (Thai National ID Card)</text>
      <rect x="25" y="52" width="34" height="24" rx="3" fill="var(--ui-accent)" stroke="var(--ui-primary)" stroke-width="1.5" />
      <text x="80" y="65" fill="var(--text-main)" font-family="monospace" font-size="14" font-weight="950">3 5303 00194 88 1</text>
      <text x="80" y="85" fill="var(--ui-primary)" font-family="sans-serif" font-size="9" font-weight="bold">ชื่อ: นางสาวพัชรี สว่างธรรม</text>
      <text x="80" y="98" fill="var(--text-soft)" font-family="sans-serif" font-size="8">Name: Miss Patcharee Sawangtham</text>
      <text x="80" y="115" fill="var(--ui-primary)" font-family="sans-serif" font-size="8" font-weight="bold">เกิดวันที่: 24 พ.ย. 2529</text>
      <text x="25" y="150" fill="var(--text-main)" font-family="sans-serif" font-size="8.5" font-weight="bold">ที่อยู่: 45 หมู่ที่ 3 ต.แม่พูล อ.ลับแล จ.อุตรดิตถ์ 53130</text>
      <text x="25" y="185" fill="var(--ui-success)" font-family="sans-serif" font-size="8" font-weight="black">✓ คุ้มครองความยินยอม PDPA ครบถ้วน</text>
      <rect x="330" y="80" width="85" height="110" rx="4" fill="var(--ui-surface)" stroke="var(--ui-border)" stroke-width="1" />
      <circle cx="372.5" cy="115" r="20" fill="var(--ui-primary)" />
      <path d="M342.5 170 c0 -12 15 -20 30 -20 s30 8 30 20" fill="var(--text-main)" />
    </svg>`,
    signatureUrl: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='100'><path d='M20 60 C 50 15, 80 85, 120 40 S 200 80, 280 40' fill='none' stroke='var(--ui-primary)' stroke-width='4.5'/></svg>"
  },
  {
    name: "นายธนาคาร ชุมชนไทย",
    phone: "086-123-4567",
    idNo: "1530400112239",
    addressNo: "88/1",
    moo: "2",
    subdistrict: "บ้านแก่ง",
    amphoe: "ตรอน",
    province: "อุตรดิตถ์",
    postalCode: "53140",
    worksite: "สำนักงานก่อสร้างแคมป์คนงาน ตรอน-อุตรดิตถ์",
    pdpaConsent: true,
    cardColor: "from-[var(--ui-primary)] to-[var(--ui-surface)]",
    idCardSvg: `<svg viewBox="0 0 450 280" class="w-full h-full rounded-2xl shadow-xl overflow-hidden border border-[var(--ui-primary)]" style="background:var(--ui-surface);">
      <rect width="100%" height="100%" fill="none" />
      <rect width="100%" height="32" fill="var(--ui-primary)" />
      <text x="12" y="20" fill="var(--ui-on-primary)" font-family="sans-serif" font-size="10" font-weight="extrabold">บัตรประจำตัวประชาชน (Thai National ID Card)</text>
      <rect x="25" y="52" width="34" height="24" rx="3" fill="var(--ui-accent)" stroke="var(--ui-primary)" stroke-width="1.5" />
      <text x="80" y="65" fill="var(--text-main)" font-family="monospace" font-size="14" font-weight="950">1 5304 00112 23 9</text>
      <text x="80" y="85" fill="var(--ui-primary)" font-family="sans-serif" font-size="9" font-weight="bold">ชื่อ: นายธนาคาร ชุมชนไทย</text>
      <text x="80" y="98" fill="var(--text-soft)" font-family="sans-serif" font-size="8">Name: Mr. Thanakan Chumchontai</text>
      <text x="80" y="115" fill="var(--ui-primary)" font-family="sans-serif" font-size="8" font-weight="bold">เกิดวันที่: 05 มี.ค. 2531</text>
      <text x="25" y="150" fill="var(--text-main)" font-family="sans-serif" font-size="8.5" font-weight="bold">ที่อยู่: 88/1 หมู่ที่ 2 ต.บ้านแก่ง อ.ตรอน จ.อุตรดิตถ์ 53140</text>
      <text x="25" y="185" fill="var(--ui-success)" font-family="sans-serif" font-size="8" font-weight="black">✓ คุ้มครองความยินยอม PDPA ครบถ้วน</text>
      <rect x="330" y="80" width="85" height="110" rx="4" fill="var(--ui-surface)" stroke="var(--ui-border)" stroke-width="1" />
      <circle cx="372.5" cy="115" r="20" fill="var(--ui-primary)" />
      <path d="M342.5 170 c0 -12 15 -20 30 -20 s30 8 30 20" fill="var(--text-main)" />
    </svg>`,
    signatureUrl: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='100'><path d='M10 20 L 80 80 Q 150 10, 200 60 T 290 40' fill='none' stroke='var(--ui-primary)' stroke-width='4'/></svg>"
  }
];

export const formatThaiPhone = (value: string): string => {
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
};

export const formatThaiIDCard = (value: string): string => {
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 1) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 1)}-${digits.slice(1)}`;
  if (digits.length <= 10) return `${digits.slice(0, 1)}-${digits.slice(1, 5)}-${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 1)}-${digits.slice(1, 5)}-${digits.slice(5, 10)}-${digits.slice(10)}`;
  return `${digits.slice(0, 1)}-${digits.slice(1, 5)}-${digits.slice(5, 10)}-${digits.slice(10, 12)}-${digits.slice(12, 13)}`;
};
