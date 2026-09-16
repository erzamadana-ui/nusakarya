-- =====================================================================
-- 0004_inventory.sql — Warehouses, Stock, Serials, Assets
-- =====================================================================

create table warehouses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  code text not null,
  name text not null,
  warehouse_type text check (warehouse_type in ('pusat','branch','mobile','teknisi','konsinyasi')),
  branch_id uuid references branches(id),
  address text,
  lat numeric,
  lng numeric,
  pic_id uuid references auth.users(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique(company_id, code)
);
create index idx_warehouses_company on warehouses(company_id);
create index idx_warehouses_branch on warehouses(branch_id);
create trigger trg_warehouses_updated_at before update on warehouses
  for each row execute function set_updated_at();

-- backfill FKs deferred from 0003 (warehouse_id columns had no FK yet)
alter table purchase_orders add constraint fk_po_warehouse foreign key (warehouse_id) references warehouses(id);
alter table goods_receipts add constraint fk_gr_warehouse foreign key (warehouse_id) references warehouses(id);
create index idx_po_warehouse on purchase_orders(warehouse_id);
create index idx_gr_warehouse on goods_receipts(warehouse_id);

create table stock_balances (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  warehouse_id uuid not null references warehouses(id) on delete cascade,
  item_id uuid not null references item_catalog(id) on delete cascade,
  qty numeric not null default 0,
  qty_reserved numeric not null default 0,
  avg_price numeric default 0,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique(company_id, warehouse_id, item_id)
);
create index idx_stockbal_company on stock_balances(company_id);
create index idx_stockbal_warehouse on stock_balances(warehouse_id);
create index idx_stockbal_item on stock_balances(item_id);
create trigger trg_stockbal_updated_at before update on stock_balances
  for each row execute function set_updated_at();

create table stock_movements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  move_no text not null,
  move_date date not null default current_date,
  move_type text not null check (move_type in ('GR','ISSUE','RETURN','TRANSFER','ADJUST','OPNAME','INSTALL','SCRAP')),
  item_id uuid not null references item_catalog(id),
  qty numeric not null default 0,
  uom text,
  from_warehouse_id uuid references warehouses(id),
  to_warehouse_id uuid references warehouses(id),
  to_employee_id uuid references employees(id),
  ref_type text,
  ref_id uuid,
  work_order_id uuid,
  price numeric default 0,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique(company_id, move_no)
);
create index idx_stockmove_company on stock_movements(company_id);
create index idx_stockmove_item on stock_movements(item_id);
create index idx_stockmove_from_wh on stock_movements(from_warehouse_id);
create index idx_stockmove_to_wh on stock_movements(to_warehouse_id);
create index idx_stockmove_wo on stock_movements(work_order_id);
create trigger trg_stockmove_updated_at before update on stock_movements
  for each row execute function set_updated_at();

create table serials (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  item_id uuid not null references item_catalog(id),
  serial_no text not null,
  mac_address text,
  status text not null default 'in_stock' check (status in ('in_stock','issued','installed','returned','damaged','lost','scrapped')),
  warehouse_id uuid references warehouses(id),
  holder_employee_id uuid references employees(id),
  customer_ref text,
  work_order_id uuid,
  install_date date,
  warranty_until date,
  principal text,
  is_consignment boolean default false,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique(company_id, item_id, serial_no)
);
create index idx_serials_company on serials(company_id);
create index idx_serials_item on serials(item_id);
create index idx_serials_warehouse on serials(warehouse_id);
create index idx_serials_holder on serials(holder_employee_id);
create index idx_serials_wo on serials(work_order_id);
create trigger trg_serials_updated_at before update on serials
  for each row execute function set_updated_at();

create table serial_movements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  serial_id uuid not null references serials(id) on delete cascade,
  move_type text not null,
  from_status text,
  to_status text,
  from_warehouse_id uuid references warehouses(id),
  to_warehouse_id uuid references warehouses(id),
  to_employee_id uuid references employees(id),
  ref_type text,
  ref_id uuid,
  moved_at timestamptz not null default now(),
  moved_by uuid references auth.users(id),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
create index idx_serialmove_company on serial_movements(company_id);
create index idx_serialmove_serial on serial_movements(serial_id);
create trigger trg_serialmove_updated_at before update on serial_movements
  for each row execute function set_updated_at();

create table material_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  mr_no text not null,
  request_date date not null default current_date,
  requester_id uuid references auth.users(id),
  warehouse_id uuid references warehouses(id),
  work_order_id uuid,
  project_id uuid,
  purpose text,
  status text not null default 'draft' check (status in ('draft','diajukan','disetujui','dikeluarkan','ditolak','selesai')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique(company_id, mr_no)
);
create index idx_mr_company on material_requests(company_id);
create index idx_mr_warehouse on material_requests(warehouse_id);
create index idx_mr_wo on material_requests(work_order_id);
create trigger trg_mr_updated_at before update on material_requests
  for each row execute function set_updated_at();

create table material_request_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  mr_id uuid not null references material_requests(id) on delete cascade,
  item_id uuid not null references item_catalog(id),
  qty_request numeric not null default 0,
  qty_approved numeric default 0,
  qty_issued numeric default 0,
  uom text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
create index idx_mritems_company on material_request_items(company_id);
create index idx_mritems_mr on material_request_items(mr_id);
create index idx_mritems_item on material_request_items(item_id);
create trigger trg_mritems_updated_at before update on material_request_items
  for each row execute function set_updated_at();

create table material_usages (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  work_order_id uuid,
  project_id uuid,
  boq_item_id uuid,
  item_id uuid not null references item_catalog(id),
  qty_plan numeric default 0,
  qty_actual numeric default 0,
  variance numeric default 0,
  variance_percent numeric default 0,
  is_over_tolerance boolean default false,
  note text,
  reported_by uuid references auth.users(id),
  reported_at timestamptz default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
create index idx_matusage_company on material_usages(company_id);
create index idx_matusage_wo on material_usages(work_order_id);
create index idx_matusage_project on material_usages(project_id);
create index idx_matusage_item on material_usages(item_id);
create trigger trg_matusage_updated_at before update on material_usages
  for each row execute function set_updated_at();

create table stock_opnames (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  opname_no text not null,
  opname_date date not null default current_date,
  warehouse_id uuid not null references warehouses(id),
  status text not null default 'draft' check (status in ('draft','berjalan','selesai','disetujui')),
  pic_id uuid references auth.users(id),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique(company_id, opname_no)
);
create index idx_opname_company on stock_opnames(company_id);
create index idx_opname_warehouse on stock_opnames(warehouse_id);
create trigger trg_opname_updated_at before update on stock_opnames
  for each row execute function set_updated_at();

create table stock_opname_lines (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  opname_id uuid not null references stock_opnames(id) on delete cascade,
  item_id uuid not null references item_catalog(id),
  qty_system numeric default 0,
  qty_physical numeric default 0,
  variance numeric default 0,
  variance_value numeric default 0,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
create index idx_opnamelines_company on stock_opname_lines(company_id);
create index idx_opnamelines_opname on stock_opname_lines(opname_id);
create index idx_opnamelines_item on stock_opname_lines(item_id);
create trigger trg_opnamelines_updated_at before update on stock_opname_lines
  for each row execute function set_updated_at();

create table assets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  asset_no text not null,
  item_id uuid references item_catalog(id),
  asset_name text not null,
  asset_category text check (asset_category in ('kendaraan','alat_ukur','tools','it','furniture','bangunan','lain')),
  brand text,
  model text,
  serial_no text,
  purchase_date date,
  purchase_price numeric default 0,
  useful_life_months int,
  depreciation_method text,
  book_value numeric default 0,
  condition text check (condition in ('baik','rusak_ringan','rusak_berat','hilang')),
  status text not null default 'tersedia' check (status in ('tersedia','dipakai','perbaikan','dilelang','dihapus')),
  warehouse_id uuid references warehouses(id),
  branch_id uuid references branches(id),
  holder_employee_id uuid references employees(id),
  photo_url text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique(company_id, asset_no)
);
create index idx_assets_company on assets(company_id);
create index idx_assets_warehouse on assets(warehouse_id);
create index idx_assets_branch on assets(branch_id);
create index idx_assets_holder on assets(holder_employee_id);
create trigger trg_assets_updated_at before update on assets
  for each row execute function set_updated_at();

create table asset_assignments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  asset_id uuid not null references assets(id) on delete cascade,
  employee_id uuid not null references employees(id),
  assigned_at timestamptz not null default now(),
  returned_at timestamptz,
  condition_out text,
  condition_in text,
  note text,
  ba_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
create index idx_assetassign_company on asset_assignments(company_id);
create index idx_assetassign_asset on asset_assignments(asset_id);
create index idx_assetassign_employee on asset_assignments(employee_id);
create trigger trg_assetassign_updated_at before update on asset_assignments
  for each row execute function set_updated_at();

create table asset_maintenances (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  asset_id uuid not null references assets(id) on delete cascade,
  maintenance_date date not null default current_date,
  maintenance_type text,
  vendor_id uuid references vendors(id),
  cost numeric default 0,
  description text,
  next_due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
create index idx_assetmaint_company on asset_maintenances(company_id);
create index idx_assetmaint_asset on asset_maintenances(asset_id);
create trigger trg_assetmaint_updated_at before update on asset_maintenances
  for each row execute function set_updated_at();
