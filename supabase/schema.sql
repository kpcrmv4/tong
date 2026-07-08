-- =====================================================================
--  JJK POS / ERP — Supabase schema
--  ระบบ POS จีรกิตติ์ ไม้แบบพลาสติก อุตรดิตถ์
--
--  วิธีใช้: เปิด Supabase Dashboard > SQL Editor > วางไฟล์นี้ทั้งหมด > Run
--
--  หมายเหตุสำคัญ:
--  * ชื่อคอลัมน์ต้องตรงกับ object ที่โค้ด upsert (src/db.ts) เป๊ะ
--    ตัวเลขใช้ double precision เพื่อให้ PostgREST ส่งค่ากลับเป็น number
--    (ถ้าใช้ numeric จะกลับมาเป็น string ทำให้การคำนวณฝั่ง client พัง)
--  * วันที่/เวลาเก็บเป็น text เพราะแอปเก็บเป็น ISO string และอ่านกลับตรง ๆ
--  * Realtime ของแอปนี้ใช้ "Broadcast" (pub/sub) ไม่ต้องเปิด replication
--    หรือเพิ่มตารางเข้า publication supabase_realtime แต่อย่างใด
--  * RLS ด้านล่างเปิดแบบ "อนุญาตทุกคน (anon)" เพื่อให้ใช้งานได้ทันที
--    ⚠️ เหมาะกับระบบภายในเท่านั้น — production ควรผูก Supabase Auth
--    แล้วรัดนโยบายให้เข้มขึ้น
-- =====================================================================

-- ---------- products (คลังสินค้า) : PK item_id ----------
create table if not exists public.products (
  item_id             text primary key,
  sku                 text,
  item_name           text,
  category            text,
  use_type            text,
  unit                text,
  price_rent          double precision default 0,
  price_sale          double precision default 0,
  low_stock_threshold double precision default 10,
  item_status         text default 'Active',
  note                text default '',
  created_at          text,
  updated_at          text,
  rental_mode         text,
  stock               double precision default 0,
  qty_total           double precision default 0,
  qty_available       double precision default 0,
  qty_rented          double precision default 0,
  qty_damaged         double precision default 0,
  qty_lost            double precision default 0
);

-- ---------- customers (ลูกค้า) : PK customer_id ----------
create table if not exists public.customers (
  customer_id          text primary key,
  customer_name        text,
  customer_type        text,
  phone                text,
  address              text,
  delivery_location    text,
  tax_id               text,
  credit_limit         double precision default 0,
  total_debt           double precision default 0,
  customer_status      text default 'Active',
  note                 text default '',
  created_at           text,
  updated_at           text,
  id_card_no           text,
  registered_address   text,
  current_worksite     text,
  id_card_area         text,
  id_card_province     text,
  id_card_image_name   text,
  id_card_image_url    text,
  id_card_read_status  text,
  pdpa_consent         boolean default false,
  customer_signature   text
);

-- ---------- receipts (ใบเสร็จ/บิล) : PK receipt_id ----------
create table if not exists public.receipts (
  receipt_id        text primary key,
  receipt_no        text,
  receipt_date      text,
  receipt_title     text,
  doc_type          text,
  customer_id       text,
  customer_name     text,
  phone             text,
  address           text,
  delivery_location text,
  rent_date         text,
  due_date          text,
  rental_days       double precision default 1,
  subtotal          double precision default 0,
  discount          double precision default 0,
  delivery_fee      double precision default 0,
  vat               double precision default 0,
  vat_rate          double precision default 0,
  vat_mode          text,
  deposit           double precision default 0,
  grand_total       double precision default 0,
  paid_cash         double precision default 0,
  paid_transfer     double precision default 0,
  paid_amount       double precision default 0,
  debt_amount       double precision default 0,
  change_amount     double precision default 0,
  payment_status    text,
  return_status     text,
  penalty_amount    double precision default 0,
  return_date       text,
  client_txn_id     text,
  items_json        text,
  calculation_json  text,
  note              text default '',
  created_at        text,
  updated_at        text
);

-- ---------- returns (การคืนสินค้า) : PK return_id ----------
create table if not exists public.returns (
  return_id      text primary key,
  receipt_id     text,
  receipt_no     text,
  return_date    text,
  customer_id    text,
  customer_name  text,
  items_json     text,
  penalty_amount double precision default 0,
  refund_deposit double precision default 0,
  paid_amount    double precision default 0,
  debt_after     double precision default 0,
  return_status  text,
  note           text default '',
  client_txn_id  text,
  created_at     text
);

-- ---------- expenses (ค่าใช้จ่าย) : PK expense_id ----------
create table if not exists public.expenses (
  expense_id     text primary key,
  expense_date   text,
  description    text,
  category       text,
  amount         double precision default 0,
  payment_method text,
  ref_no         text,
  expense_status text default 'Active',
  note           text default '',
  created_at     text,
  updated_at     text,
  cancelled_at   text,
  cancelled_by   text
);

-- ---------- appointments (นัดหมาย) : PK appointment_id ----------
create table if not exists public.appointments (
  appointment_id     text primary key,
  title              text,
  appointment_title  text,
  detail             text,
  appointment_date   text,
  customer_id        text,
  customer_name      text,
  phone              text,
  location           text,
  products_detail    text,
  appointment_status text default 'To Deliver',
  created_at         text,
  updated_at         text,
  cancelled_at       text,
  done_at            text
);

-- ---------- notes (โน้ต) : PK note_id ----------
create table if not exists public.notes (
  note_id     text primary key,
  note_text   text,
  note_status text default 'Active',
  created_at  text,
  updated_at  text
);

-- ---------- audit_logs (บันทึกการใช้งาน) : PK log_id ----------
-- "user" และ "timestamp" เป็นคำสงวน ต้องครอบด้วยเครื่องหมายคำพูด
create table if not exists public.audit_logs (
  log_id       text primary key,
  "timestamp"  text,
  "user"       text,
  action       text,
  target_type  text,
  target_id    text,
  old_value    text,
  new_value    text,
  note         text
);

-- ---------- users (พนักงาน/ผู้ใช้) : PK user_id ----------
create table if not exists public.users (
  user_id       text primary key,
  username      text unique,
  password_hash text,
  display_name  text,
  role          text,
  user_status   text default 'Pending',
  created_at    text,
  last_login    text
);

-- ---------- "appData" (key-value: settings/pin ฯลฯ) : PK id ----------
-- ชื่อตารางเป็น camelCase ตามที่โค้ดเรียก supabase.from('appData')
-- จึงต้องครอบด้วยเครื่องหมายคำพูดเสมอ
create table if not exists public."appData" (
  id      text primary key,
  payload jsonb
);

-- =====================================================================
--  Row Level Security (RLS)
--  ⚠️ เปิดแบบอนุญาตทุกคนเพื่อให้ anon key ใช้งานได้ทันที (ระบบภายใน)
--  production: เปลี่ยนเป็นผูก Supabase Auth แล้วรัดนโยบายให้เข้มขึ้น
-- =====================================================================
do $$
declare
  t text;
  tables text[] := array[
    'products','customers','receipts','returns','expenses',
    'appointments','notes','audit_logs','users','appData'
  ];
begin
  foreach t in array tables loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists jjk_all_access on public.%I;', t);
    execute format(
      'create policy jjk_all_access on public.%I for all to anon, authenticated using (true) with check (true);',
      t
    );
  end loop;
end $$;

-- เสร็จแล้ว 🎉  แอปจะซิงค์ขึ้น/ลง Supabase อัตโนมัติ และกระจายข้ามเครื่อง
-- แบบเรียลไทม์ผ่าน Broadcast channel 'jjk-db-sync'
