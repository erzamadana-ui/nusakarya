// NUSAKARYA — QA end-to-end RLS & fungsi, sebagai pengguna login (anon key + password auth).
//
// CATATAN JARINGAN: skrip ini melakukan panggilan HTTP asli ke Supabase Auth/PostgREST/Storage
// (bukan lewat MCP). Di lingkungan sandbox agent (cloud container maupun perangkat lokal yang
// terhubung lewat Cowork), host <project>.supabase.co diblokir oleh kebijakan egress organisasi
// (proxy membalas 403 pada CONNECT) sehingga skrip ini TIDAK BISA dijalankan dari sana — lihat
// docs/LAPORAN-QA-RLS.md bagian "Keterbatasan lingkungan". Jalankan skrip ini dari mesin/CI yang
// punya akses internet normal ke *.supabase.co.
//
// Jalankan: node qa-rls.mjs
import { createClient } from '@supabase/supabase-js';
import { setGlobalDispatcher, ProxyAgent, Agent } from 'undici';

// Lingkungan ini merutekan semua HTTPS keluar lewat proxy agen (lihat $HTTPS_PROXY).
// fetch bawaan Node tidak otomatis memakai env var proxy, jadi kita pasang dispatcher secara eksplisit.
const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy;
if (proxyUrl) {
  setGlobalDispatcher(new ProxyAgent(proxyUrl));
} else {
  setGlobalDispatcher(new Agent());
}

const URL = 'https://idlhsxamdkipnmyvewbp.supabase.co';
const ANON = 'sb_publishable_-9Cai7RVFQ4UmQjTgjNS8w_Q84U-vc8';
const PASSWORD = 'Nusakarya#2026';
const COMPANY_ID = 'df65cb87-478b-4203-89e3-625bcacaab32';
const RANDOM_COMPANY = '11111111-1111-1111-1111-111111111111';
const ISOLASI_COMPANY_ID = '99999999-9999-9999-9999-999999999999';

const ACCOUNTS = [
  ['admin@nusakarya.id', 'super_admin'],
  ['direktur@nusakarya.id', 'direktur'],
  ['komisaris@nusakarya.id', 'komisaris'],
  ['hr@nusakarya.id', 'manager_hr'],
  ['commerce@nusakarya.id', 'manager_commerce'],
  ['procurement@nusakarya.id', 'manager_procurement'],
  ['finance@nusakarya.id', 'manager_finance'],
  ['inventory@nusakarya.id', 'manager_inventory'],
  ['operations@nusakarya.id', 'manager_operations'],
  ['deployment@nusakarya.id', 'manager_deployment'],
  ['dispatcher@nusakarya.id', 'dispatcher'],
  ['teknisi@nusakarya.id', 'teknisi'],
  ['mitra@nusakarya.id', 'mitra'],
];

// module -> table uji baca
const MODULE_TABLES = [
  ['HR', 'employees'],
  ['PAYROLL', 'payroll_runs'],
  ['PRODUCTIVITY', 'productivity_entries'],
  ['PROCUREMENT', 'purchase_orders'],
  ['COMMERCE', 'contracts'],
  ['FINANCE', 'job_costs'],
  ['INVENTORY', 'stock_balances'],
  ['ASSET', 'assets'],
  ['OPERATIONS', 'tickets'],
  ['DEPLOYMENT', 'projects'],
  ['CORE', 'branches'],
];

// role_module_access can_read matrix (dari DB, per 16 Sep 2026)
const RMA = {
  super_admin: { HR: 1, PAYROLL: 1, PRODUCTIVITY: 1, PROCUREMENT: 1, COMMERCE: 1, FINANCE: 1, INVENTORY: 1, ASSET: 1, OPERATIONS: 1, DEPLOYMENT: 1, CORE: 1 },
  direktur: { HR: 1, PAYROLL: 1, PRODUCTIVITY: 1, PROCUREMENT: 1, COMMERCE: 1, FINANCE: 1, INVENTORY: 1, ASSET: 1, OPERATIONS: 1, DEPLOYMENT: 1, CORE: 1 },
  komisaris: { HR: 1, PAYROLL: 1, PRODUCTIVITY: 1, PROCUREMENT: 1, COMMERCE: 1, FINANCE: 1, INVENTORY: 1, ASSET: 1, OPERATIONS: 1, DEPLOYMENT: 1, CORE: 1 },
  manager_hr: { HR: 1, PAYROLL: 1, PRODUCTIVITY: 1, PROCUREMENT: 1, COMMERCE: 1, FINANCE: 1, INVENTORY: 1, ASSET: 1, OPERATIONS: 1, DEPLOYMENT: 1, CORE: 1 },
  manager_commerce: { HR: 1, PAYROLL: 1, PRODUCTIVITY: 1, PROCUREMENT: 1, COMMERCE: 1, FINANCE: 1, INVENTORY: 1, ASSET: 1, OPERATIONS: 1, DEPLOYMENT: 1, CORE: 1 },
  manager_procurement: { HR: 1, PAYROLL: 1, PRODUCTIVITY: 1, PROCUREMENT: 1, COMMERCE: 1, FINANCE: 1, INVENTORY: 1, ASSET: 1, OPERATIONS: 1, DEPLOYMENT: 1, CORE: 1 },
  manager_finance: { HR: 1, PAYROLL: 1, PRODUCTIVITY: 1, PROCUREMENT: 1, COMMERCE: 1, FINANCE: 1, INVENTORY: 1, ASSET: 1, OPERATIONS: 1, DEPLOYMENT: 1, CORE: 1 },
  manager_inventory: { HR: 1, PAYROLL: 1, PRODUCTIVITY: 1, PROCUREMENT: 1, COMMERCE: 1, FINANCE: 1, INVENTORY: 1, ASSET: 1, OPERATIONS: 1, DEPLOYMENT: 1, CORE: 1 },
  manager_operations: { HR: 1, PAYROLL: 1, PRODUCTIVITY: 1, PROCUREMENT: 1, COMMERCE: 1, FINANCE: 1, INVENTORY: 1, ASSET: 1, OPERATIONS: 1, DEPLOYMENT: 1, CORE: 1 },
  manager_deployment: { HR: 1, PAYROLL: 1, PRODUCTIVITY: 1, PROCUREMENT: 1, COMMERCE: 1, FINANCE: 1, INVENTORY: 1, ASSET: 1, OPERATIONS: 1, DEPLOYMENT: 1, CORE: 1 },
  dispatcher: { HR: 1, PAYROLL: 1, PRODUCTIVITY: 1, PROCUREMENT: 1, COMMERCE: 1, FINANCE: 1, INVENTORY: 1, ASSET: 1, OPERATIONS: 1, DEPLOYMENT: 1, CORE: 1 },
  teknisi: { HR: 1, PAYROLL: 0, PRODUCTIVITY: 1, PROCUREMENT: 0, COMMERCE: 0, FINANCE: 0, INVENTORY: 1, ASSET: 0, OPERATIONS: 1, DEPLOYMENT: 0, CORE: 1 },
  mitra: { HR: 0, PAYROLL: 0, PRODUCTIVITY: 0, PROCUREMENT: 0, COMMERCE: 1, FINANCE: 1, INVENTORY: 0, ASSET: 0, OPERATIONS: 0, DEPLOYMENT: 0, CORE: 1 },
};

const results = { login: [], profileAccess: [], moduleRead: [], write: [], tenant: [], storage: [], rpc: [], dashboard: [] };
const PASS = 'PASS', FAIL = 'FAIL', SKIP = 'SKIP';

function log(section, row) {
  results[section].push(row);
  const status = row.status;
  const mark = status === PASS ? '✅' : status === SKIP ? '⏭️ ' : '❌';
  console.log(`[${section}] ${mark} ${row.label} :: ${row.detail || ''}`);
}

async function signIn(email) {
  const client = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  return { client, data, error };
}

async function main() {
  const clients = {}; // email -> {client, role}

  // 1) Uji login
  for (const [email, role] of ACCOUNTS) {
    const { client, data, error } = await signIn(email);
    if (error || !data?.user) {
      log('login', { label: email, status: FAIL, detail: error?.message || 'no user' });
      continue;
    }
    log('login', { label: email, status: PASS, detail: `user_id=${data.user.id}` });
    clients[email] = { client, role, userId: data.user.id };
  }

  // 2) Uji profil & hak akses
  for (const [email, role] of ACCOUNTS) {
    const c = clients[email];
    if (!c) { log('profileAccess', { label: email, status: SKIP, detail: 'login gagal' }); continue; }
    const { data: prof, error: perr } = await c.client.from('profiles').select('id, role, company_id').eq('id', c.userId);
    const { data: rma, error: rerr } = await c.client.from('role_module_access').select('module_code, can_read, can_write').eq('role', role);
    const profOk = !perr && prof && prof.length === 1;
    const rmaOk = !rerr && rma && rma.length > 0;
    log('profileAccess', {
      label: email,
      status: profOk && rmaOk ? PASS : FAIL,
      detail: `profiles=${profOk ? 'OK(' + prof.length + ')' : 'KOSONG/ERR:' + (perr?.message || '')}; role_module_access=${rmaOk ? 'OK(' + rma.length + ' baris)' : 'KOSONG/ERR:' + (rerr?.message || '')}`,
    });
  }

  // 3) Uji baca per modul
  for (const [email, role] of ACCOUNTS) {
    const c = clients[email];
    if (!c) continue;
    for (const [mod, table] of MODULE_TABLES) {
      const expected = RMA[role]?.[mod] ? 'ALLOW' : 'DENY';
      const { data, error } = await c.client.from(table).select('id').limit(1);
      let actual;
      if (error) actual = 'DENIED_ERR';
      else if (!data || data.length === 0) actual = 'EMPTY';
      else actual = 'ALLOW';
      // treat EMPTY as ambiguous but we compare against ALLOW/DENY expectation
      let status;
      if (expected === 'ALLOW') {
        status = actual === 'ALLOW' ? PASS : FAIL;
      } else {
        status = (actual === 'DENIED_ERR' || actual === 'EMPTY') ? PASS : FAIL;
      }
      log('moduleRead', {
        label: `${email} -> ${table} (${mod})`,
        status,
        detail: `expected=${expected} actual=${actual}${error ? ' err=' + error.message : ''}`,
      });
    }
  }

  // 4) Uji tulis
  async function tryInsertDelete(email, table, row, expectAllow, label) {
    const c = clients[email];
    if (!c) { log('write', { label, status: SKIP, detail: 'login gagal' }); return; }
    const { data, error } = await c.client.from(table).insert(row).select('id');
    const allowed = !error && data && data.length > 0;
    const status = allowed === expectAllow ? PASS : FAIL;
    log('write', { label, status, detail: `expected=${expectAllow ? 'ALLOW' : 'DENY'} actual=${allowed ? 'ALLOW' : 'DENY'}${error ? ' err=' + error.message : ''}` });
    if (allowed) {
      const id = data[0].id;
      const { error: delErr } = await c.client.from(table).delete().eq('id', id);
      if (delErr) console.log(`   (cleanup gagal hapus ${table}#${id}: ${delErr.message})`);
    }
  }

  // ambil beberapa id referensi yang dibutuhkan utk FK
  const svc = clients['admin@nusakarya.id'].client; // super_admin, dipakai hanya utk baca referensi (bukan service role)
  const { data: anyEmployee } = await svc.from('employees').select('id').limit(1);
  const { data: anyBranch } = await svc.from('branches').select('id').limit(1);
  const { data: teknisiProfile } = await svc.from('profiles').select('id, employee_id').eq('email', 'teknisi@nusakarya.id').limit(1);
  const { data: anyPeriod } = await svc.from('payroll_periods').select('id').limit(1);
  const { data: anyVendor } = await svc.from('vendors').select('id').limit(1);
  const { data: anyPO } = await svc.from('purchase_orders').select('id').limit(1);
  const { data: anyWarehouse } = await svc.from('warehouses').select('id').limit(1);
  const { data: anyItem } = await svc.from('item_catalog').select('id').limit(1);
  const { data: anyTicket } = await svc.from('tickets').select('id').limit(1);
  const { data: anyProject } = await svc.from('projects').select('id').limit(1);
  const { data: anyAPInvoice } = await svc.from('vendor_invoices').select('id, total').limit(1);
  const { data: anyContract } = await svc.from('contracts').select('id').limit(1);
  const { data: anyCustomer } = await svc.from('customers').select('id').limit(1);

  const empId = anyEmployee?.[0]?.id;
  const branchId = anyBranch?.[0]?.id;
  const teknisiEmpId = teknisiProfile?.[0]?.employee_id;
  const periodId = anyPeriod?.[0]?.id;
  const vendorId = anyVendor?.[0]?.id;
  const warehouseId = anyWarehouse?.[0]?.id;
  const itemId = anyItem?.[0]?.id;
  const ticketId = anyTicket?.[0]?.id;
  const projectId = anyProject?.[0]?.id;
  const invId = anyAPInvoice?.[0]?.id;
  const invTotal = anyAPInvoice?.[0]?.total || 100000;
  const customerId = anyCustomer?.[0]?.id;

  // hr@ -> leave_requests (BOLEH), purchase_orders (DITOLAK)
  await tryInsertDelete('hr@nusakarya.id', 'leave_requests', {
    company_id: COMPANY_ID, employee_id: empId, leave_type: 'cuti_tahunan',
    start_date: '2026-12-01', end_date: '2026-12-01', status: 'pending', reason: 'QA test',
  }, true, 'hr@ -> leave_requests (harus BOLEH)');
  await tryInsertDelete('hr@nusakarya.id', 'purchase_orders', {
    company_id: COMPANY_ID, vendor_id: vendorId, po_no: 'QA-TEST-PO', status: 'draft',
  }, false, 'hr@ -> purchase_orders (harus DITOLAK)');

  // procurement@ -> purchase_requests (BOLEH), payroll_runs (DITOLAK)
  await tryInsertDelete('procurement@nusakarya.id', 'purchase_requests', {
    company_id: COMPANY_ID, pr_no: 'QA-TEST-PR', status: 'draft',
  }, true, 'procurement@ -> purchase_requests (harus BOLEH)');
  await tryInsertDelete('procurement@nusakarya.id', 'payroll_runs', {
    company_id: COMPANY_ID, period_id: periodId, employee_id: empId, status: 'draft',
  }, false, 'procurement@ -> payroll_runs (harus DITOLAK)');

  // finance@ -> ap_payments (BOLEH), cash_flows (BOLEH), employees (DITOLAK)
  await tryInsertDelete('finance@nusakarya.id', 'ap_payments', {
    company_id: COMPANY_ID, payment_no: 'QA-TEST-PAY', vendor_id: vendorId, invoice_id: invId, amount: 1000, payment_date: '2026-09-16', method: 'transfer',
  }, true, 'finance@ -> ap_payments (harus BOLEH, baru diperbaiki)');
  await tryInsertDelete('finance@nusakarya.id', 'cash_flows', {
    company_id: COMPANY_ID, flow_date: '2026-09-16', direction: 'in', category: 'QA-TEST', amount: 1000, description: 'QA test',
  }, true, 'finance@ -> cash_flows (harus BOLEH, baru diperbaiki)');
  await tryInsertDelete('finance@nusakarya.id', 'employees', {
    company_id: COMPANY_ID, nip: 'QA-TEST-NIP', full_name: 'QA Test Employee',
  }, false, 'finance@ -> employees (harus DITOLAK)');

  // inventory@ -> stock_movements (BOLEH)
  await tryInsertDelete('inventory@nusakarya.id', 'stock_movements', {
    company_id: COMPANY_ID, move_no: 'QA-TEST-MOV', move_type: 'ADJUST', item_id: itemId, qty: 1, to_warehouse_id: warehouseId,
  }, true, 'inventory@ -> stock_movements (harus BOLEH)');

  // operations@ -> tickets (BOLEH)
  await tryInsertDelete('operations@nusakarya.id', 'tickets', {
    company_id: COMPANY_ID, ticket_no: 'QA-TEST-TIX', status: 'open', severity: 'rendah', description: 'QA test ticket',
  }, true, 'operations@ -> tickets (harus BOLEH)');

  // deployment@ -> progress_reports (BOLEH)
  await tryInsertDelete('deployment@nusakarya.id', 'progress_reports', {
    company_id: COMPANY_ID, project_id: projectId, report_date: '2026-09-16', progress_pct: 1, notes: 'QA test',
  }, true, 'deployment@ -> progress_reports (harus BOLEH)');

  // komisaris@ -> semua INSERT harus DITOLAK (read-only) — min 4 tabel
  await tryInsertDelete('komisaris@nusakarya.id', 'leave_requests', {
    company_id: COMPANY_ID, employee_id: empId, leave_type: 'cuti_tahunan', start_date: '2026-12-01', end_date: '2026-12-01', status: 'pending', reason: 'QA test',
  }, false, 'komisaris@ -> leave_requests (harus DITOLAK)');
  await tryInsertDelete('komisaris@nusakarya.id', 'tickets', {
    company_id: COMPANY_ID, ticket_no: 'QA-TEST-TIX-2', status: 'open', severity: 'rendah',
  }, false, 'komisaris@ -> tickets (harus DITOLAK)');
  await tryInsertDelete('komisaris@nusakarya.id', 'purchase_requests', {
    company_id: COMPANY_ID, pr_no: 'QA-TEST-PR-2', status: 'draft',
  }, false, 'komisaris@ -> purchase_requests (harus DITOLAK)');
  await tryInsertDelete('komisaris@nusakarya.id', 'branches', {
    company_id: COMPANY_ID, code: 'QA-TEST-BR', name: 'QA Test Branch',
  }, false, 'komisaris@ -> branches (harus DITOLAK)');

  // teknisi@ -> attendances utk dirinya (BOLEH), contracts (DITOLAK)
  await tryInsertDelete('teknisi@nusakarya.id', 'attendances', {
    company_id: COMPANY_ID, employee_id: teknisiEmpId, work_date: '2030-01-01', check_in_at: '2030-01-01T08:00:00+07:00', status: 'hadir',
  }, true, 'teknisi@ -> attendances (dirinya sendiri, harus BOLEH)');
  await tryInsertDelete('teknisi@nusakarya.id', 'contracts', {
    company_id: COMPANY_ID, contract_no: 'QA-TEST-CTR', contract_name: 'QA Test Contract', customer_id: customerId, status: 'draft',
  }, false, 'teknisi@ -> contracts (harus DITOLAK)');

  // 5) Uji isolasi tenant
  console.log('\n--- Setup perusahaan kedua untuk uji isolasi tenant ---');
  // dilakukan lewat mcp Supabase execute_sql di luar skrip ini (lihat laporan);
  // skrip hanya memverifikasi bahwa akun yang login TIDAK bisa melihatnya.
  for (const email of ['admin@nusakarya.id', 'hr@nusakarya.id', 'komisaris@nusakarya.id']) {
    const c = clients[email];
    if (!c) continue;
    for (const table of ['employees', 'branches', 'companies']) {
      const { data, error } = await c.client.from(table).select('id').eq('company_id', ISOLASI_COMPANY_ID).limit(5);
      let idData = data;
      if (table === 'companies') {
        const r = await c.client.from('companies').select('id').eq('id', ISOLASI_COMPANY_ID).limit(5);
        idData = r.data;
      }
      const leaked = !error && idData && idData.length > 0;
      log('tenant', {
        label: `${email} melihat ${table} milik perusahaan lain?`,
        status: leaked ? FAIL : PASS,
        detail: leaked ? `BOCOR: ${idData.length} baris terlihat` : 'tidak terlihat (benar)',
      });
    }
  }

  // 6) Uji storage
  const teknisi = clients['teknisi@nusakarya.id'];
  if (teknisi) {
    const content = new Blob([`QA test file ${new Date().toISOString()}`], { type: 'text/plain' });
    const okPath = `${COMPANY_ID}/qa/test.txt`;
    const badPath = `00000000-0000-0000-0000-000000000000/qa/test.txt`;

    const up1 = await teknisi.client.storage.from('files').upload(okPath, content, { upsert: true });
    log('storage', { label: `teknisi@ upload ke path miliknya sendiri`, status: up1.error ? FAIL : PASS, detail: up1.error ? up1.error.message : 'OK' });

    if (!up1.error) {
      const signed = await teknisi.client.storage.from('files').createSignedUrl(okPath, 60);
      log('storage', { label: 'teknisi@ signed URL utk file miliknya', status: signed.error ? FAIL : PASS, detail: signed.error ? signed.error.message : signed.data.signedUrl });

      const del = await teknisi.client.storage.from('files').remove([okPath]);
      const delOk = !del.error && del.data && del.data.length > 0;
      log('storage', { label: 'teknisi@ hapus file uji miliknya', status: delOk ? PASS : SKIP, detail: delOk ? 'OK' : `tidak bisa hapus (role tidak diizinkan): ${del.error?.message || 'no rows removed'}` });
    }

    const up2 = await teknisi.client.storage.from('files').upload(badPath, content, { upsert: true });
    log('storage', { label: 'teknisi@ upload ke path company_id ACAK (harus DITOLAK)', status: up2.error ? PASS : FAIL, detail: up2.error ? up2.error.message : 'BOCOR: upload berhasil!' });
    if (!up2.error) {
      await teknisi.client.storage.from('files').remove([badPath]).catch(() => {});
    }
  } else {
    log('storage', { label: 'teknisi@ storage test', status: SKIP, detail: 'login gagal' });
  }

  // 7) Uji fungsi next_doc_no
  const proc = clients['procurement@nusakarya.id'];
  if (proc) {
    const okCall = await proc.client.rpc('next_doc_no', { p_company: COMPANY_ID, p_prefix: 'QA' });
    log('rpc', { label: 'procurement@ next_doc_no(company sendiri)', status: (!okCall.error && okCall.data) ? PASS : FAIL, detail: okCall.error ? okCall.error.message : okCall.data });

    const badCall = await proc.client.rpc('next_doc_no', { p_company: RANDOM_COMPANY, p_prefix: 'QA' });
    // fungsi security definer tapi harus tervalidasi terhadap company milik user -- cek apakah ditolak
    const rejected = !!badCall.error;
    log('rpc', { label: 'procurement@ next_doc_no(company ACAK, harus ditolak/gagal)', status: rejected ? PASS : FAIL, detail: badCall.error ? badCall.error.message : `TIDAK DITOLAK: hasil=${badCall.data}` });
  } else {
    log('rpc', { label: 'procurement@ next_doc_no', status: SKIP, detail: 'login gagal' });
  }

  // 8) Uji view dashboard
  const DASHBOARDS = [
    ['hr@nusakarya.id', 'v_dashboard_hr'],
    ['commerce@nusakarya.id', 'v_dashboard_commerce'],
    ['procurement@nusakarya.id', 'v_dashboard_procurement'],
    ['finance@nusakarya.id', 'v_dashboard_finance'],
    ['inventory@nusakarya.id', 'v_dashboard_inventory'],
    ['operations@nusakarya.id', 'v_dashboard_operations'],
    ['deployment@nusakarya.id', 'v_dashboard_deployment'],
    ['direktur@nusakarya.id', 'v_executive_summary'],
  ];
  for (const [email, view] of DASHBOARDS) {
    const c = clients[email];
    if (!c) { log('dashboard', { label: `${email} -> ${view}`, status: SKIP, detail: 'login gagal' }); continue; }
    const { data, error } = await c.client.from(view).select('*').limit(5);
    const ok = !error && data && data.length > 0;
    log('dashboard', { label: `${email} -> ${view}`, status: ok ? PASS : FAIL, detail: error ? error.message : `${data?.length || 0} baris` });
  }

  // ringkasan
  console.log('\n=================== RINGKASAN ===================');
  for (const section of Object.keys(results)) {
    const rows = results[section];
    const pass = rows.filter(r => r.status === PASS).length;
    const fail = rows.filter(r => r.status === FAIL).length;
    const skip = rows.filter(r => r.status === SKIP).length;
    console.log(`${section}: ${pass} PASS, ${fail} FAIL, ${skip} SKIP (total ${rows.length})`);
  }
  const allFails = Object.entries(results).flatMap(([sec, rows]) => rows.filter(r => r.status === FAIL).map(r => ({ sec, ...r })));
  if (allFails.length) {
    console.log('\n--- DAFTAR KEGAGALAN ---');
    for (const f of allFails) console.log(`[${f.sec}] ${f.label} :: ${f.detail}`);
  }

  // keluarkan JSON supaya bisa diparse programatis kalau perlu
  console.log('\n__QA_JSON_START__');
  console.log(JSON.stringify(results, null, 2));
  console.log('__QA_JSON_END__');
}

main().catch(e => {
  console.error('FATAL', e);
  process.exit(1);
});
