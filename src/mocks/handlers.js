// localStorage mock router. `handle(method, path, ctx)` returns the response BODY
// (what the app sees as `res.data`). Return `{ __error: { status, body } }` to reject.
// Unmatched GET -> { data: [] }; unmatched mutation -> ok stub. Blob requests -> Blob.

import { KEYS, read, write, nextId, nowIso } from './db';

const g = (k) => read(KEYS[k], []);
const s = (k, v) => write(KEYS[k], v);

const DEMO_OTP = '123456';
const isoInMinutes = (m) => new Date(Date.now() + m * 60000).toISOString();

// ---- auth / session helpers -------------------------------------------------
function currentUser(ctx) {
  const token = ctx.token || '';
  const m = /demo-token-(\d+)/.exec(token);
  if (!m) return null;
  return g('users').find((u) => String(u.id) === m[1]) || null;
}

function userRow(u) {
  // Shape consumed by DashboardPage / users list / profile.
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone || '0812-0000-0000',
    school_id: u.school_id,
    username: u.username,
    access_role: u.access_role,
    role: u.role || u.access_role,
    role_name: u.role_name,
    position_status: u.position_status || null,
    contract_end_date: u.contract_end_date || null,
    employment_status: u.position_status || 'tetap',
    is_active: u.is_active !== false,
    is_offboarded: false,
    class_name: u.class_name || null,
    nisn_nip: u.nisn_nip || u.nisn || null,
    nisn: u.nisn || null,
    nis: u.nis || u.nisn || null,
    joined_at: u.joined_at || null,
    is_current_user: false,
    magang: u.magang || null,
    honorer: u.honorer || null,
    kelas_id: u.kelas_id || null,
    jurusan: u.jurusan || null,
    isHomeroomTeacher: Boolean(u.isHomeroomTeacher),
  };
}

function students() {
  return g('users').filter((u) => u.access_role === 'murid');
}
function teachers() {
  return g('users').filter((u) => u.access_role === 'guru');
}
function findUser(id) {
  return g('users').find((u) => String(u.id) === String(id));
}

const money = (n) => Number(n) || 0;
const sum = (rows, key) => rows.reduce((a, r) => a + money(r[key]), 0);

// =========================================================================
// ROUTES
// =========================================================================
const routes = [];
const on = (method, pattern, fn) => {
  const keys = [];
  const re = new RegExp(
    '^' +
      pattern
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replace(/:([\w]+)/g, (_, k) => {
          keys.push(k);
          return '([^/]+)';
        }) +
      '$',
  );
  routes.push({ method: String(method).toLowerCase(), re, keys, fn });
};

// ------------------------------ AUTH ---------------------------------------
on('POST', '/auth/login', (_ctx, body) => {
  const sid = String(body?.schoolId || body?.school_id || '').trim().toLowerCase();
  const pw = String(body?.password || '');
  const user = g('users').find(
    (u) =>
      sid &&
      (String(u.school_id).toLowerCase() === sid ||
        String(u.username).toLowerCase() === sid ||
        String(u.email).toLowerCase() === sid),
  );
  if (!user || user.password !== pw) {
    return { __error: { status: 401, body: { message: 'ID atau password salah. Coba kredensial dari kartu Login Cepat.' } } };
  }
  return { token: `demo-token-${user.id}`, user: userRow(user), system_status: null };
});
on('POST', '/auth/logout', () => ({ message: 'Logged out' }));
on('POST', '/auth/register', () => ({ message: 'Pendaftaran demo tidak tersedia. Gunakan Login Cepat.', success: false }));

on('POST', '/auth/forgot-password/verify-user', (_ctx, body) => {
  const sid = String(body?.schoolId || '').trim().toLowerCase();
  const user = g('users').find(
    (u) => String(u.school_id).toLowerCase() === sid || String(u.username).toLowerCase() === sid,
  );
  if (!user) return { __error: { status: 422, body: { message: 'ID pengguna tidak ditemukan di sistem.' } } };
  return { email: user.email };
});
on('POST', '/auth/forgot-password/send-otp', (_ctx, body) => {
  const sid = String(body?.schoolId || '').trim().toLowerCase();
  const user = g('users').find(
    (u) => String(u.school_id).toLowerCase() === sid || String(u.username).toLowerCase() === sid,
  );
  if (!user) return { __error: { status: 422, body: { message: 'ID pengguna tidak ditemukan.' } } };
  s('resetOtp', { [user.school_id]: DEMO_OTP });
  return { email: user.email, message: `OTP terkirim ke ${user.email}. (Mode demo — gunakan kode ${DEMO_OTP})` };
});
on('POST', '/auth/forgot-password/verify-otp', (_ctx, body) => {
  if (String(body?.otp) !== DEMO_OTP) {
    return { __error: { status: 422, body: { message: 'Kode OTP salah. Kode demo adalah 123456.' } } };
  }
  return { message: 'OTP terverifikasi. Silakan buat password baru.', resetToken: String(body?.schoolId || '') };
});
on('POST', '/auth/forgot-password/reset', (_ctx, body) => {
  const sid = String(body?.schoolId || '').trim().toLowerCase();
  const users = g('users');
  const user = users.find(
    (u) => String(u.school_id).toLowerCase() === sid || String(u.username).toLowerCase() === sid,
  );
  if (!user) return { __error: { status: 422, body: { message: 'Akun tidak ditemukan.' } } };
  user.password = String(body?.newPassword || user.password);
  s('users', users);
  return { message: 'Password berhasil diperbarui.' };
});

// ------------------------------ USER PROFILE -------------------------------
on('GET', '/user/profile', (ctx) => {
  const u = currentUser(ctx);
  return { user: u ? userRow(u) : null };
});
on('POST', '/user/profile', (ctx, body) => {
  const users = g('users');
  const u = currentUser(ctx);
  if (u) {
    const idx = users.findIndex((x) => String(x.id) === String(u.id));
    users[idx] = { ...users[idx], ...(body || {}) };
    s('users', users);
    return { user: userRow(users[idx]), message: 'Profil diperbarui' };
  }
  return { user: null, message: 'Profil diperbarui' };
});
on('PUT', '/user/password', () => ({ message: 'Password diperbarui' }));
on('POST', '/user/session-heartbeat', () => ({ ok: true }));
on('POST', '/user/acknowledge-promotion', () => ({ ok: true }));
on('GET', '/user/sessions', () => ({ data: [] }));
on('DELETE', '/user/sessions/:id', () => ({ ok: true }));
on('POST', '/user/sessions/logout-others', () => ({ ok: true }));
on('DELETE', '/user/profile/avatar', () => ({ ok: true }));

// ------------------------------ OPERATOR -----------------------------------
on('GET', '/operator/stats', () => {
  const users = g('users');
  const roles = {};
  users.forEach((u) => {
    roles[u.access_role] = (roles[u.access_role] || 0) + 1;
  });
  return {
    data: {
      total_users: users.length,
      students: students().length,
      teachers: teachers().length,
      roles: {
        operator: roles.operator || 0,
        admin_akademik: roles.admin_akademik || 0,
        pusat_jurusan: roles.pusat_jurusan || 0,
        kepala_sekolah: roles.kepala_sekolah || 0,
        wakil_sekolah: roles.wakil_sekolah || 0,
        guru: roles.guru || 0,
        cashier: roles.cashier || 0,
        murid: roles.murid || 0,
      },
      security_summary: { last_24h_events: g('activityLog').length },
    },
  };
});
on('GET', '/operator/users', (ctx) => {
  let rows = g('users').map(userRow);
  const q = (ctx.query?.search || ctx.query?.q || '').toLowerCase();
  if (q) rows = rows.filter((r) => `${r.name} ${r.school_id} ${r.email}`.toLowerCase().includes(q));
  return { data: rows };
});
on('GET', '/operator/master-data', () => {
  const kelas = g('classes').map((c) => ({
    id: c.id, nama: c.nama, name: c.name, tingkat: c.tingkat, jurusan: c.jurusan, kapasitas: c.kapasitas,
    homeroom_teacher_id: c.homeroom_teacher_id, homeroom_teacher_name: c.homeroom_teacher_name,
    semester: c.semester, tahun_ajaran: c.tahun_ajaran, academic_year: c.academic_year,
    student_ids: c.student_ids, created_at: null, updated_at: null,
  }));
  return {
    data: {
      jurusans: g('jurusans'),
      kelas,
      mapel: g('subjects').map((m) => ({ id: m.id, nama: m.nama, kode: m.kode, kelompok: m.kelompok, jam_per_minggu: m.jam_per_minggu, jurusan: null, created_at: null, updated_at: null })),
      teacher_assignments: g('teacherSubjects'),
      teachers: teachers().map((t) => ({ id: t.id, name: t.name, full_name: t.name, school_id: t.school_id, nisn_nip: t.nisn_nip, jurusan: null, mapel: [t.subject_name] })),
      current_academic_year: ACADEMIC_YEAR_LIVE(),
    },
  };
});
function ACADEMIC_YEAR_LIVE() {
  const sp = g('schoolProfile');
  return (sp && sp.academic_year) || '2026/2027';
}
on('GET', '/operator/akademik-summary', () => {
  const classes = g('classes');
  const studs = students();
  const jurusans = g('jurusans');
  const sebaran = jurusans.map((j) => ({
    jurusan: j.code,
    X: studs.filter((x) => x.jurusan === j.code && classes.find((c) => c.id === x.kelas_id)?.tingkat === 'X').length,
    XI: studs.filter((x) => x.jurusan === j.code && classes.find((c) => c.id === x.kelas_id)?.tingkat === 'XI').length,
    XII: studs.filter((x) => x.jurusan === j.code && classes.find((c) => c.id === x.kelas_id)?.tingkat === 'XII').length,
  }));
  const beban = teachers().slice(0, 6).map((t) => ({ guru: t.name, jam: 18 + (t.id % 6) }));
  return {
    data: {
      kpi: {
        total_siswa: studs.length, siswa_l: Math.round(studs.length * 0.55), siswa_p: Math.round(studs.length * 0.45),
        total_kelas: classes.length, kelas_wali: classes.filter((c) => c.homeroom_teacher_id).length,
        sesi_kbm: g('teacherSubjects').length, aset_baik: 120, aset_dipinjam: 8,
      },
      periode: { semester: 'Ganjil', tahun_ajaran: '2026/2027' },
      sebaran_siswa: sebaran,
      donut: { kbm: [{ name: 'Terisi', value: 82 }, { name: 'Kosong', value: 18 }], aset: [{ name: 'Baik', value: 93 }, { name: 'Rusak', value: 7 }], kunci: [{ name: 'Aktif', value: 40 }, { name: 'Non-aktif', value: 5 }] },
      beban_guru: beban,
      kesiapan: { persen_wali: 85, persen_jadwal: 78, belum_lengkap: [{ id: 7, name: 'XII MM 1', kurang: ['Wali Kelas', 'Jadwal'] }] },
    },
  };
});
on('GET', '/operator/activity-log', () => ({ data: g('activityLog') }));
on('DELETE', '/operator/activity-log', () => {
  s('activityLog', []);
  return { ok: true };
});
on('GET', '/operator/security/online-users', () => {
  const rows = g('users').slice(0, 6).map(userRow).map((r, i) => ({ ...r, is_current_user: i === 0, active_session_count: i === 0 ? 1 : 0, session_started_at: nowIso(), last_active_at: nowIso() }));
  return { data: rows };
});
on('GET', '/operator/security/backups', () => ({
  data: [{ id: 1, fileName: 'backup-global-2026-11.json', targetLabel: 'Global', createdAtLabel: 'Hari ini 07:00' }],
}));
on('GET', '/operator/backup/history', () => ({
  data: [{ id: 1, user_name: 'Super Admin Operator', user_role: 'operator', user_school_id: 'superadmin@164990', user_id: 9324, backup_type: 'global', role_target: null, created_at: nowIso(), created_at_label: 'Hari ini 07:00' }],
}));
on('GET', '/operator/system/settings', () => ({
  data: { sleep_server: { active: false }, maintenance: { active: false }, cleaning: { active: false } },
}));
on('GET', '/operator/exam-settings', () => ({ data: { idle_enabled: false, idle_minutes: 0, tabdetect_enabled: true, tab_tolerance: 3, manual_reentry_enabled: true, offline_local_enabled: true, session_recovery_enabled: true } }));
on('GET', '/operator/exam-attempts', () => ({ data: [], pagination: { last_page: 1, total: 0 } }));
on('GET', '/operator/grades/options', () => ({ data: { classes: g('classes').map((c) => ({ id: c.id, name: c.nama })) } }));

// operator user mutations
on('POST', '/operator/users', (_ctx, body) => {
  const users = g('users');
  const nu = { id: nextId(users), is_active: true, position_status: 'tetap', ...body, password: body?.password || 'Demo123_', role: body?.access_role || 'murid', role_name: body?.access_role || 'Murid' };
  users.push(nu);
  s('users', users);
  return { data: userRow(nu), message: 'Pengguna ditambahkan' };
});
on('PUT', '/operator/users/:id', (_ctx, body, params) => {
  const users = g('users');
  const idx = users.findIndex((u) => String(u.id) === params.id);
  if (idx >= 0) {
    users[idx] = { ...users[idx], ...body };
    s('users', users);
    return { data: userRow(users[idx]), message: 'Pengguna diperbarui' };
  }
  return { data: null, message: 'Pengguna tidak ditemukan' };
});
on('DELETE', '/operator/users/:id', (_ctx, _b, params) => {
  s('users', g('users').filter((u) => String(u.id) !== params.id));
  return { message: 'Pengguna dihapus' };
});
on('PATCH', '/operator/users/:id/toggle-status', (_ctx, _b, params) => {
  const users = g('users');
  const u = users.find((x) => String(x.id) === params.id);
  if (u) u.is_active = !u.is_active;
  s('users', users);
  return { data: u ? { is_active: u.is_active } : {} };
});
on('POST', '/operator/users/:id/offboard', (_ctx, body, params) => {
  const users = g('users');
  const u = users.find((x) => String(x.id) === params.id);
  if (u) { u.is_offboarded = true; u.offboard_reason = body?.offboard_reason; }
  s('users', users);
  return { message: 'Ok' };
});
on('POST', '/operator/users/:id/reactivate', (_ctx, _b, params) => {
  const users = g('users');
  const u = users.find((x) => String(x.id) === params.id);
  if (u) u.is_offboarded = false;
  s('users', users);
  return { message: 'Ok' };
});
on('POST', '/operator/users/:id/impersonate', (_ctx, _b, params) => {
  const target = findUser(params.id);
  return { success: true, impersonation_token: `demo-token-${params.id}`, target_user: target ? userRow(target) : null, expires_at: isoInMinutes(60) };
});
on('DELETE', '/operator/impersonate', () => ({ message: 'Ok' }));
on('GET', '/operator/users/generate-code', () => ({ success: true, code: 'CODE-' + Math.floor(1000 + Math.random() * 9000) }));
on('POST', '/operator/announcements', (_ctx, body) => {
  const rows = g('announcements');
  const n = { id: nextId(rows), is_read: false, author: { name: 'Super Admin Operator' }, created_at: nowIso(), published_at: nowIso(), ...body };
  rows.unshift(n);
  s('announcements', rows);
  return { data: n, message: 'Pengumuman dibuat' };
});
on('DELETE', '/operator/announcements/:id', (_ctx, _b, params) => {
  s('announcements', g('announcements').filter((a) => String(a.id) !== params.id));
  return { message: 'Dihapus' };
});

// ------------------------------ INFORMATION CENTER -------------------------
on('GET', '/information-center', (ctx) => {
  const rows = g('announcements');
  const per = Number(ctx.query?.per_page) || rows.length;
  return { data: rows.slice(0, per) };
});
on('GET', '/information-center/unread-count', () => ({ data: { count: g('announcements').filter((a) => !a.is_read).length } }));
on('POST', '/information-center/:id/read', (_ctx, _b, params) => {
  const rows = g('announcements');
  const r = rows.find((x) => String(x.id) === params.id);
  if (r) r.is_read = true;
  s('announcements', rows);
  return { ok: true };
});

// ------------------------------ ACADEMIC CALENDAR --------------------------
on('GET', '/academic-calendar', () => ({ data: { title: 'Kalender Akademik 2026/2027', published: true, terms: [] } }));
on('GET', '/academic-calendar/list', () => ({ data: [] }));
on('GET', '/academic-calendar/events', () => ({ data: g('calendarEvents') }));
on('POST', '/academic-calendar/events', (_ctx, body) => {
  const rows = g('calendarEvents');
  const e = { id: nextId(rows), is_published: true, created_at: nowIso(), ...body };
  rows.push(e);
  s('calendarEvents', rows);
  return { data: e };
});
on('DELETE', '/academic-calendar/events/:id', (_ctx, _b, params) => {
  s('calendarEvents', g('calendarEvents').filter((e) => String(e.id) !== params.id));
  return { ok: true };
});

// ------------------------------ SCHOOL PROFILE -----------------------------
on('GET', '/school-profile', () => ({ data: g('schoolProfile') || {} }));
on('PUT', '/school-profile', (_ctx, body) => {
  s('schoolProfile', { ...(g('schoolProfile') || {}), ...(body || {}) });
  return { data: g('schoolProfile'), message: 'Profil disimpan' };
});

// ------------------------------ MANAGEMENT (EXECUTIVE) ---------------------
on('GET', '/management/stats', () => {
  const studs = students();
  const teachersRows = teachers();
  const classes = g('classes');
  const payments = g('payments');
  const billings = g('billings');
  const totalDue = billings.filter((b) => b.status !== 'lunas').reduce((a, b) => a + money(b.remaining_amount), 0);
  const paidCount = billings.filter((b) => b.status === 'lunas').length;
  const monthlyIncome = payments.filter((p) => p.status === 'approved').reduce((a, p) => a + money(p.amount), 0);
  return {
    data: {
      counts: { students: studs.length, teachers: teachersRows.length, classes: classes.length },
      graduation_rate: 96.4,
      grade_trends: [{ semester: 'Genap 24/25', nilai: 80 }, { semester: 'Ganjil 25/26', nilai: 83 }, { semester: 'Genap 25/26', nilai: 85 }, { semester: 'Ganjil 26/27', nilai: 87 }],
      attendance: { teacher_rate: 97, student_rate: 94 },
      financial: { monthly_income: monthlyIncome, payment_rate: Math.round((paidCount / Math.max(billings.length, 1)) * 100) },
      workflow: { open_bill_count: billings.filter((b) => b.status === 'belum_bayar').length, approval_queue: g('verifications').map((v) => ({ id: v.id, transaction_code: 'TRX-' + v.id, title: 'Verifikasi ' + v.student_name, category: 'SPP', amount: v.amount })) },
      executive: {
        overview: {
          populasi: { siswa_aktif: studs.length, guru_aktif: teachersRows.length, rombel: classes.length },
          kbm: { kelengkapan_jurnal_pct: 82, rapor_published: 64, rata_nilai: 86 },
          keuangan: { pemasukan_bulan: monthlyIncome, tunggakan_spp: totalDue, approval_pending: g('verifications').length },
          evaluasi_audit: { pkg_pending: 3 }, period: 'Ganjil 2026/2027',
          health_indicators: [{ label: 'Kehadiran Siswa', value: 94, status: 'baik' }, { label: 'Kelengkapan Jurnal', value: 82, status: 'baik' }, { label: 'Rasio Pembayaran', value: 88, status: 'baik' }],
          cashflow_trend: [0, 1, 2, 3, 4, 5].map((i) => ({ label: monthLabel(i), pemasukan: 40000000 + i * 1500000, pengeluaran: 28000000 + i * 900000 })),
          priority_actions: [{ title: 'Finalisasi rapor XII', level: 'tinggi' }, { title: 'Tindak lanjuti tunggakan SPP', level: 'sedang' }],
          principal_name: 'Muhtadin',
          period_comparison: [{ label: 'Siswa', current: studs.length, previous: studs.length - 4, format: 'number' }, { label: 'Rata Nilai', current: 86, previous: 84, format: 'number' }],
          attendance: { monthly: [{ label: 'Bulan', persen: 94 }], daily: [], weekly: [] },
        },
        academics: {
          score_by_class: classes.map((c) => ({ class_name: c.nama, department_name: c.jurusan, homeroom_teacher: c.homeroom_teacher_name || '-', average_score: 82 + (c.id % 6), status: 'baik', subject_count: 10 })),
          subject_overview: g('subjects').slice(0, 6).map((m) => ({ subject: m.nama, average: 80 + (m.id % 10) })),
          top_students: studs.slice(0, 5).map((s2, i) => ({ name: s2.name, class_name: s2.class_name, average: 95 - i })),
          attention_students: studs.slice(5, 8).map((s2) => ({ student_id: s2.id, student_name: s2.name, school_id: s2.school_id, class_name: s2.class_name, status: 'perlu_perhatian', average_score: 62 })),
          exam_schedule: g('examSessions').map((e) => ({ id: e.id, type: 'CBT', subject: e.mapel, title: e.nama, start_at: e.end_time, deadline_at: e.end_time })),
          teacher_presence: teachersRows.map((t) => ({ teacher_id: t.id, teacher_name: t.name, school_id: t.school_id, attendance_rate: 96, class_count: 3, subject_count: 2, teaching_sessions: 24 })),
          performance_trend: [0, 1, 2, 3].map((i) => ({ label: 'W' + (i + 1), average_score: 82 + i })),
        },
        student_affairs: { demographics: [{ label: 'L', value: Math.round(studs.length * 0.55) }, { label: 'P', value: Math.round(studs.length * 0.45) }], achievements: g('achievements').map((a) => ({ name: a.nama_prestasi, tingkat: a.tingkat, tahun: a.tahun })) },
        staffing: {
          headcount: { teachers: teachersRows.length, staff: 6, honorer: g('users').filter((u) => u.access_role === 'honorer').length, magang: g('users').filter((u) => u.access_role === 'magang').length },
          attendance_trend: [0, 1, 2, 3].map((i) => ({ label: 'W' + (i + 1), present: 96, teaching: 92 })),
          teaching_performance: teachersRows.map((t) => ({ teacher_id: t.id, teacher_name: t.name, school_id: t.school_id, average_score: 88, latest_assessment: 'Baik' })),
          attendance_list: teachersRows.map((t) => ({ user_id: t.id, name: t.name, role: 'guru', status: 'hadir', check_in_at: '07:05', total_minutes: 420 })),
        },
        finance: {
          spp_summary: { paid: paidCount, pending: billings.filter((b) => b.status === 'belum_bayar').length, verification: g('verifications').length, overdue: billings.filter((b) => b.status === 'ditolak').length },
          cashflow: [0, 1, 2, 3, 4, 5].map((i) => ({ month: monthLabel(i), income: 40000000 + i * 1500000, expense: 28000000 + i * 900000 })),
          arrears_students: studs.slice(0, 6).map((s2) => ({ student_id: s2.id, student_name: s2.name, school_id: s2.school_id, bill_count: 2, total_due: 700000, latest_due_date: dayOffsetLive(-5) })),
        },
        facilities: {
          summary: { inventory_total: 135, good: 120, requires_attention: 15, issues_open: 2 },
          inventory_list: g('fasilitas')?.inventories?.slice(0, 6) || [],
          condition_breakdown: [{ label: 'Baik', value: 120 }, { label: 'Rusak', value: 15 }],
          maintenance_schedule: [{ title: 'Servis AC', location: 'Lab RPL', status: 'terjadwal', scheduled_for: dayOffsetLive(7) }],
          damage_reports: [{ id: 1, item_name: 'PC Desktop #12', location: 'Lab RPL 1', type: 'rusak', status: 'diproses', quantity: 1 }],
        },
        analytics: {
          comparison_cards: [{ label: 'Pemasukan', current: monthlyIncome, previous: monthlyIncome - 5000000, format: 'currency' }, { label: 'Rata Nilai', current: 86, previous: 84, format: 'number' }],
          long_term_trend: [0, 1, 2, 3, 4, 5].map((i) => ({ label: monthLabel(i), balance: 12000000 + i * 2000000, average_score: 82 + i, teacher_presence: 95 })),
        },
        meta: { data_coverage: { student_attendance: true } },
        shared_announcements: g('announcements').slice(0, 3),
        vice_principal: {
          scope_summaries: { kurikulum: { headline: 'Kurikulum', stats: [{ label: 'Kelas Siap KBM', value: 6 }] } },
          sections: {
            wakasek_overview: {}, wakasek_academics: {}, wakasek_attendance: {}, wakasek_exams: {}, wakasek_graduation: {},
            wakasek_class_management: {
              classes: classes.map((c) => ({ id: c.id, name: c.nama, department_name: c.jurusan, grade_level: c.tingkat, academic_year: c.tahun_ajaran, homeroom_teacher_id: c.homeroom_teacher_id, homeroom_teacher_name: c.homeroom_teacher_name, homeroom_teacher_nip: '', active_students: (c.student_ids || []).length, capacity: c.kapasitas, mapel_count: 10, guru_count: 6, schedule_count: g('teacherSubjects').filter((a) => a.kelas_id === c.id).length, ready_for_kbm: Boolean(c.homeroom_teacher_id) })),
              teacher_candidates: teachersRows.map((t) => ({ id: t.id, name: t.name })), unassigned_students: [], academic_options: { tahun_ajaran: ['2026/2027'], tingkat: ['X', 'XI', 'XII'] }, period: { tahun_ajaran: '2026/2027', semester: 'Ganjil' },
            },
          },
        },
        teacher_performance: {
          teachers: teachersRows.map((t) => ({ id: t.id, name: t.name, role_label: 'Guru', beban_ajar: { mapel_count: 2 }, jurnal_terisi: 80, pkg: { tahun_ajaran: '2026/2027', semester: 'Ganjil' } })),
          academic_options: [{ academic_year: '2026/2027', semester: 'Ganjil' }], period: { tahun_ajaran: '2026/2027', semester: 'Ganjil' },
        },
        user_audit: g('users').map(userRow),
        graduation_report: { summary: { total: studs.filter((s2) => s2.jurusan).length, lulus: 20 }, rows: [] },
        kbm_monitoring: { rows: g('teacherSubjects').slice(0, 8).map((a) => ({ kelas: a.kelas_nama, mapel: a.mata_pelajaran, guru: a.guru_nama, status: 'berjalan' })) },
        alumni_archive: { kpis: [{ label: 'Total Alumni', value: 320 }], chart: [], riwayat: [], recent: [], period: '2020-2026', angkatan_options: ['2024', '2025', '2026'], academic_options: [] },
      },
    },
  };
});
function monthLabel(i) {
  const d = new Date();
  d.setMonth(d.getMonth() - (5 - i));
  return d.toLocaleDateString('id-ID', { month: 'short' });
}
function dayOffsetLive(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
on('GET', '/management/teachers', () => ({ data: teachers().map(userRow) }));
on('GET', '/management/financials', () => ({ data: [] }));
on('POST', '/management/announcements', (_ctx, body) => {
  const rows = g('announcements');
  const n = { id: nextId(rows), is_read: false, author: { name: 'Kepala Sekolah' }, created_at: nowIso(), published_at: nowIso(), ...body };
  rows.unshift(n);
  s('announcements', rows);
  return { data: n, message: 'Pengumuman dibuat' };
});
on('POST', '/management/assign-homeroom', (_ctx, body) => ({ message: 'Wali kelas ditugaskan', data: body }));
on('POST', '/management/teacher-performance', () => ({ message: 'Penilaian tersimpan' }));

// ------------------------------ TEACHER ------------------------------------
on('GET', '/teacher/dashboard-kpi', () => {
  const subs = g('submissions');
  const tasks = g('tasks');
  const need = subs.filter((x) => x.state === 'selesai' && x.nilai_esai == null && x.nilai_cbt == null).length;
  return {
    data: {
      kelas: { sesi_hari_ini: 3, rombel: 3 },
      tugas: { perlu_koreksi: need + 1 },
      materi: { berkas: g('materials').length, bank_soal_aktif: g('bankSoal').length },
      rapor: { total_pairs: 30, saved_pairs: 22, persen: 73 },
      wali_kelas: { ada: true, kelas: 'X RPL 1' },
      tasks: tasks.length,
    },
  };
});
on('GET', '/teacher/stats', () => ({ data: {} }));
on('GET', '/teacher/assignments', () => ({ data: g('tasks') }));
on('GET', '/teacher/classes', (ctx) => {
  const u = currentUser(ctx);
  const homeroomId = u?.homeroom_class_id;
  let list = g('classes');
  const own = g('teacherSubjects').filter((a) => String(a.guru_id) === String(u?.id)).map((a) => a.kelas_id);
  const ids = new Set([...(homeroomId ? [homeroomId] : []), ...own]);
  if (ids.size) list = list.filter((c) => ids.has(c.id));
  return { data: list.map((c) => ({ id: c.id, name: c.nama, subjects: g('subjects').slice(0, 6).map((m) => ({ id: m.id, name: m.nama })) })) };
});
on('GET', '/teacher/grades/options', () => ({ data: { active_calendars: [{ academic_year: '2026/2027', semester: 'Ganjil' }] } }));
on('GET', '/teacher/grades/subjects', (ctx) => {
  const kid = Number(ctx.query?.kelas_id);
  return { data: g('subjects').map((m) => ({ id: m.id, nama_mapel: m.nama, name: m.nama, nama: m.nama })) };
});
on('GET', '/teacher/grades/students', (ctx) => {
  const kid = Number(ctx.query?.kelas_id) || (g('classes')[0] || {}).id || 1;
  const rows = students().filter((x) => x.kelas_id === kid).map((x, i) => ({ id: x.id, name: x.name, nisn: x.nisn, nis: x.nisn, avatar_path: null, harian: 80 + (i % 15), uts: 78 + (i % 18), uas: 82 + (i % 12), akhir: 80 + (i % 14) }));
  return { data: rows, bobot: { tugas_uh: 40, pts: 30, pas: 30 }, bobot_label: 'Tugas 40%, PTS 30%, PAS 30%', kkm: 75, locked: false };
});
on('GET', '/teacher/grades/task-average', (ctx) => {
  const kid = Number(ctx.query?.kelas_id) || (g('classes')[0] || {}).id || 1;
  return { data: students().filter((x) => x.kelas_id === kid).map((x, i) => ({ siswa_id: x.id, rata: 80 + (i % 15) })) };
});
on('POST', '/teacher/grades', () => ({ message: 'Nilai tersimpan' }));
on('GET', '/teacher/my-schedule', (ctx) => {
  const u = currentUser(ctx);
  return { data: g('teacherSubjects').filter((a) => String(a.guru_id) === String(u?.id) || true).slice(0, 6).map((a) => ({ jadwal_id: a.id, jam_mulai: '07:30', jam_selesai: '09:00', jam_ke: '1-2', kelas_id: a.kelas_id, kelas_nama: a.kelas_nama, mapel_id: a.subject_id, mapel_nama: a.mata_pelajaran, hari: a.hari, jumlah_siswa: students().filter((x) => x.kelas_id === a.kelas_id).length, is_substitute_assignment: false, guru_asli: a.guru_nama })) };
});
on('GET', '/teacher/attendance/recap', () => ({ data: g('journals').map((j) => ({ id: j.id, tanggal: j.tanggal, jam_ke: j.jam_ke, status: 'hadir', nama_kelas: j.class_name, nama_mapel: j.subject_name, nama_siswa: '', nis: '', keterangan: '' })) }));
on('GET', '/teacher/attendance/teacher-recap', () => ({ data: g('teacherAttendance').map((t) => ({ kelas_id: 1, mapel_id: 4, kelas_nama: 'X RPL 1', mapel_nama: 'Informatika', pertemuan: 6, persentase: 96, hadir: 6, terlambat: 0, sakit: 0, izin: 0, alpha: 0 })) }));
on('GET', '/teacher/attendance/students', (ctx) => {
  const kid = Number(ctx.query?.kelas_id) || 1;
  const rows = students().filter((x) => x.kelas_id === kid).map((x) => ({ id: x.id, name: x.name, nis: x.nisn, avatar_path: null, status: 'hadir', keterangan: '' }));
  return { data: rows, is_already_submitted: false };
});
on('POST', '/teacher/attendance', () => ({ message: 'Presensi tersimpan' }));
on('POST', '/teacher/kbm/session', () => ({ message: 'Sesi KBM tersimpan' }));
on('GET', '/teacher/journals', () => ({ data: { data: g('journals'), total: g('journals').length, current_page: 1, last_page: 1 } }));
on('GET', '/teacher/question-bank', () => ({ data: g('bankSoal') }));

on('GET', '/teacher/tugas/filters', () => ({ data: { kelas: g('classes').map((c) => ({ id: c.id, nama_kelas: c.nama, name: c.nama, subjects: g('subjects').slice(0, 6).map((m) => ({ id: m.id, nama_mapel: m.nama, name: m.nama })) })), mapel: g('subjects').map((m) => ({ id: m.id, nama_mapel: m.nama, name: m.nama, nama: m.nama })) } }));
on('GET', '/teacher/tugas', () => {
  const data = g('tasks').map((t) => ({
    id: t.id, judul: t.judul, title: t.title, display_status: t.display_status, status: t.display_status,
    terkumpul: g('submissions').filter((x) => x.task_id === t.id).length, submissions_count: g('submissions').filter((x) => x.task_id === t.id).length,
    total_siswa: students().filter((x) => x.kelas_id === t.school_class_id).length, student_count: students().filter((x) => x.kelas_id === t.school_class_id).length,
    kelas: { nama_kelas: t.kelas_nama, name: t.kelas_nama }, mapel: { nama_mapel: t.mapel_nama, name: t.mapel_nama },
    deadline_at: t.deadline_at, starts_at: t.starts_at, duration_minutes: t.duration_minutes, bobot: t.bobot, deskripsi: t.deskripsi,
    school_class_id: t.school_class_id, subject_id: t.subject_id, mode_soal: t.mode_soal, acak_soal: t.acak_soal, tampilkan_nilai: t.tampilkan_nilai,
    izinkan_ketik: t.izinkan_ketik, izinkan_upload_foto: t.izinkan_upload_foto, token_akses: t.token_akses,
  }));
  return { data: { data, current_page: 1, total: data.length, last_page: 1 } };
});
on('POST', '/teacher/tugas', (_ctx, body) => {
  const tasks = g('tasks');
  const fd = body || {};
  const t = { id: nextId(tasks), judul: fd.judul || 'Tugas Baru', title: fd.judul || 'Tugas Baru', school_class_id: Number(fd.school_class_id) || 1, subject_id: Number(fd.subject_id) || 1, kelas_nama: (g('classes').find((c) => c.id === Number(fd.school_class_id)) || {}).nama, mapel_nama: (g('subjects').find((m) => m.id === Number(fd.subject_id)) || {}).nama, deadline_at: fd.deadline, starts_at: fd.starts_at, duration_minutes: Number(fd.duration_minutes) || 0, bobot: Number(fd.bobot) || 0, deskripsi: fd.deskripsi, mode_soal: fd.mode_soal || null, tampilkan_nilai: fd.tampilkan_nilai === '1' || fd.tampilkan_nilai === true, izinkan_ketik: fd.izinkan_ketik !== '0', izinkan_upload_foto: fd.izinkan_upload_foto === '1', token_akses: fd.token_akses || 'TK' + Math.floor(1000 + Math.random() * 9000), display_status: 'Aktif', questions: [], total_poin: 100 };
  tasks.push(t);
  s('tasks', tasks);
  return { data: t, message: 'Tugas dibuat' };
});
on('POST', '/teacher/tugas/:id', (_ctx, body, params) => {
  const tasks = g('tasks');
  const t = tasks.find((x) => String(x.id) === params.id);
  if (t) Object.assign(t, { judul: body?.judul || t.judul, deadline_at: body?.deadline || t.deadline_at, bobot: body?.bobot != null ? Number(body.bobot) : t.bobot, deskripsi: body?.deskripsi ?? t.deskripsi });
  s('tasks', tasks);
  return { data: t, message: 'Tugas diperbarui' };
});
on('DELETE', '/teacher/tugas/:id', (_ctx, _b, params) => {
  s('tasks', g('tasks').filter((t) => String(t.id) !== params.id));
  return { message: 'Tugas dihapus' };
});
on('POST', '/teacher/tugas/preview-token', () => ({ data: { token_akses: 'PREVIEW' + Math.floor(1000 + Math.random() * 9000) } }));
on('POST', '/teacher/tugas/:id/regenerate-token', (_ctx, _b, params) => {
  const tasks = g('tasks');
  const t = tasks.find((x) => String(x.id) === params.id);
  const tok = 'TK' + Math.floor(100000 + Math.random() * 900000);
  if (t) { t.token_akses = tok; s('tasks', tasks); }
  return { data: { token_akses: tok } };
});
on('GET', '/teacher/tugas/:id/monitor', (_ctx, _b, params) => {
  const taskId = Number(params.id);
  const task = g('tasks').find((t) => t.id === taskId);
  const subs = g('submissions').filter((x) => x.task_id === taskId);
  const classStudents = students().filter((x) => task && x.kelas_id === task.school_class_id);
  const peserta = classStudents.map((x) => {
    const sub = subs.find((y) => y.siswa_id === x.id);
    if (sub) {
      return { siswa_id: x.id, submission_id: sub.id, name: sub.name, nisn: sub.nisn, avatar_path: null, state: 'selesai', nilai_esai: sub.nilai_esai, nilai_cbt: sub.nilai_cbt, feedback: sub.feedback, poin_diperoleh: sub.poin_diperoleh, total_poin: sub.total_poin, jawaban_teks: sub.jawaban_teks, submitted_at: sub.submitted_at };
    }
    return { siswa_id: x.id, submission_id: null, name: x.name, nisn: x.nisn, avatar_path: null, state: 'belum_masuk', nilai_esai: null, nilai_cbt: null, feedback: null, poin_diperoleh: null, total_poin: 100 };
  });
  const statistik = {
    belum_masuk: peserta.filter((p) => p.state === 'belum_masuk').length,
    sedang_mengerjakan: peserta.filter((p) => p.state === 'sedang').length,
    selesai: peserta.filter((p) => p.state === 'selesai').length,
  };
  return { data: { sesi: task ? { id: task.id, judul: task.judul, kelas: task.kelas_nama, mapel: task.mapel_nama, mode_soal: task.mode_soal, bobot: task.bobot, starts_at: task.starts_at, deadline_at: task.deadline_at, duration_minutes: task.duration_minutes, token_akses: task.token_akses, deskripsi: task.deskripsi, acak_soal: task.acak_soal, tampilkan_nilai: task.tampilkan_nilai, izinkan_ketik: task.izinkan_ketik, izinkan_upload_foto: task.izinkan_upload_foto } : {}, peserta, statistik } };
});
on('POST', '/teacher/tugas/:id/submissions/:sid/grade', (_ctx, body, params) => {
  const subs = g('submissions');
  const sub = subs.find((x) => String(x.id) === params.sid);
  if (sub) {
    sub.nilai_cbt = Number(body?.nilai);
    sub.nilai_esai = Number(body?.nilai);
    sub.feedback = body?.feedback;
    sub.poin_diperoleh = Number(body?.nilai);
    s('submissions', subs);
    return { message: 'Nilai tersimpan', data: sub };
  }
  return { message: 'Submission tidak ditemukan' };
});
on('GET', '/teacher/materials', () => ({ data: { data: g('materials'), current_page: 1, last_page: 1, total: g('materials').length } }));
on('POST', '/teacher/materials', (_ctx, body) => {
  const rows = g('materials');
  const m = { id: nextId(rows), judul: body?.judul || body?.title || 'Materi', kategori: body?.kategori || 'Materi', kelas_id: Number(body?.kelas_id) || 1, mapel_id: Number(body?.mapel_id) || 1, created_at: nowIso(), file_name: 'materi.pdf', file_type: 'pdf', file_size: '1 MB' };
  rows.unshift(m);
  s('materials', rows);
  return { data: m, message: 'Materi disimpan' };
});
on('DELETE', '/teacher/materials/:id', (_ctx, _b, params) => {
  s('materials', g('materials').filter((m) => String(m.id) !== params.id));
  return { message: 'Dihapus' };
});
on('GET', '/teacher/homeroom', () => ({ data: { kelas: 'X RPL 1', students: students().filter((x) => x.kelas_id === 1).map(userRow), prestasi: g('achievements'), bk: [] } }));
on('GET', '/teacher/schedules', () => ({ data: g('teacherSubjects') }));

// ------------------------------ STUDENT ------------------------------------
function studentGrades(kelasId) {
  const subjects = g('subjects').slice(0, 6);
  return subjects.map((m, i) => {
    const harian = 80 + ((i * 3) % 18);
    const uts = 76 + ((i * 5) % 20);
    const uas = 82 + ((i * 2) % 16);
    const average = Math.round((harian + uts + uas) / 3);
    return { subject: m.nama, daily: harian, uts, uas, average, grade: average >= 90 ? 'A' : average >= 80 ? 'B' : average >= 70 ? 'C' : 'D', status: average >= 75 ? 'tuntas' : 'belum' };
  });
}
on('GET', '/student/dashboard', (ctx) => {
  const u = currentUser(ctx) || students()[0] || {};
  const studs = students().filter((x) => x.kelas_id === u.kelas_id);
  const grades = studentGrades(u.kelas_id);
  const avg = Math.round(grades.reduce((a, x) => a + x.average, 0) / grades.length);
  const billings = g('billings').filter((b) => b.student_id === u.id);
  const pending = billings.filter((b) => b.status !== 'lunas');
  const totalDue = pending.reduce((a, b) => a + money(b.remaining_amount), 0);
  const tasks = g('tasks').filter((t) => t.school_class_id === u.kelas_id);
  const subs = g('submissions');
  const uploadTasks = tasks.map((t) => {
    const mine = subs.find((x) => x.task_id === t.id && x.siswa_id === u.id);
    const status = mine ? (mine.nilai_esai != null || mine.nilai_cbt != null ? 'dinilai' : 'dikumpul') : 'belum_dikumpulkan';
    return {
      id: t.id, subject: t.mapel_nama, title: t.judul, class_name: t.kelas_nama, description: t.deskripsi,
      status, deadline_at: t.deadline_at, teacher: t.created_by, mode_soal: t.mode_soal, duration_minutes: t.duration_minutes,
      questions: t.questions || [], total_poin: t.total_poin, tampilkan_nilai: t.tampilkan_nilai,
      score: mine ? (mine.nilai_cbt ?? mine.nilai_esai) : null, feedback: mine?.feedback || null, submitted_at: mine?.submitted_at || null,
      poin_diperoleh: mine?.poin_diperoleh ?? null,
      soal_pdf_api_url: t.soal_pdf_api_url || '', pdf_url: t.pdf_url || null,
      izinkan_ketik: t.izinkan_ketik, izinkan_upload_foto: t.izinkan_upload_foto, ends_at: t.deadline_at,
    };
  });
  const att = g('attendance').filter((a) => a.siswa_id === u.id);
  const monthly = { present: att.filter((a) => a.status === 'hadir').length, permission: att.filter((a) => a.status === 'izin').length, sick: att.filter((a) => a.status === 'sakit').length, absent: att.filter((a) => a.status === 'alpha').length };
  return {
    data: {
      profile: { name: u.name, nisn: u.nisn, gender: u.gender || 'L', ttl: u.ttl || '-', jurusan: u.jurusan || 'RPL', class_name: u.class_name, homeroom_teacher: (g('classes').find((c) => c.id === u.kelas_id) || {}).homeroom_teacher_name || 'Budi Santoso', avatar_initials: (u.name || 'A').slice(0, 1) },
      report: { grades, summary: { average: avg, has_grades: true, grade: avg >= 90 ? 'A' : 'B', rapor_published: true, rank: 3, total_students: Math.max(studs.length, 1) } },
      attendance: { monthly: [monthly], summary: { weekly_percentage: 96, weekly_total: studs.length } },
      schedule: { today: { sessions: [{ time: '07:30 - 09:00', subject: 'Informatika', teacher: 'Budi Santoso', room: 'Lab RPL 1' }, { time: '09:15 - 10:45', subject: 'Basis Data', teacher: 'Rina Melati', room: 'R. X RPL 1' }] }, days: [{ day: 'Senin', classes: [{ subject: 'Informatika' }, { subject: 'Basis Data' }] }] },
      evaluations: { upload_tasks: uploadTasks, summary: { completed: uploadTasks.filter((t) => t.status === 'dinilai' || t.status === 'dikumpul').length, total: uploadTasks.length, percentage: Math.round((uploadTasks.filter((t) => t.status !== 'belum_dikumpulkan').length / Math.max(uploadTasks.length, 1)) * 100) } },
      billing: { summary: { pending_count: pending.length, total_due: totalDue, verification_count: billings.filter((b) => b.status === 'proses_verifikasi').length, verification_amount: billings.filter((b) => b.status === 'proses_verifikasi').reduce((a, b) => a + money(b.amount), 0), lunas_count: billings.filter((b) => b.status === 'lunas').length, paid_total: billings.filter((b) => b.status === 'lunas').reduce((a, b) => a + money(b.paid_amount), 0), progress_percentage: Math.round((billings.filter((b) => b.status === 'lunas').length / Math.max(billings.length, 1)) * 100) }, items: billings.map((b) => ({ title: b.title, bill_code: b.bill_code, category: b.category, amount: b.amount, paid_amount: b.paid_amount, remaining_amount: b.remaining_amount, due_date: b.due_date, status: b.status, can_upload_confirmation: b.status === 'belum_bayar' || b.status === 'ditolak' })) },
      academic_period: { academic_year: '2026/2027', semester: 'Ganjil' },
    },
  };
});
on('GET', '/student/exam-sessions', (ctx) => {
  const u = currentUser(ctx) || {};
  const rows = g('examSessions').filter((e) => !e.kelas_id || e.kelas_id === u.kelas_id);
  return { data: rows.map((e) => ({ id: e.id, nama: e.nama, mapel: e.mapel, target: e.target, end_time: e.end_time, paket_soal_id: e.paket_soal_id, show_score: e.show_score, jenis: e.jenis })) };
});
on('GET', '/student/exam-settings', () => ({ data: { idle_enabled: false, idle_minutes: 0, tabdetect_enabled: true, tab_tolerance: 3, manual_reentry_enabled: true, offline_local_enabled: true, session_recovery_enabled: true } }));
on('POST', '/student/exam/start', (ctx, body) => {
  const examId = Number(body?.exam_id);
  const sess = g('examSessions').find((e) => e.id === examId);
  if (!sess) return { __error: { status: 422, body: { message: 'Sesi ujian tidak ditemukan.' } } };
  if (String(body?.token).toUpperCase() !== String(sess.token).toUpperCase()) {
    return { __error: { status: 422, body: { message: 'Token salah. Gunakan token ' + sess.token } } };
  }
  const attempts = g('attempts');
  let attempt = attempts.find((a) => a.exam_id === examId && a.siswa_id === (currentUser(ctx)?.id));
  if (!attempt) {
    attempt = { id: nextId(attempts), exam_id: examId, siswa_id: currentUser(ctx)?.id, answers: {}, ends_at: isoInMinutes(sess.duration_minutes || 60), tab_switches: 0, status: 'running', started_at: nowIso() };
    attempts.push(attempt);
    s('attempts', attempts);
  }
  const questions = g('questions').filter((q) => q.paket_soal_id === sess.paket_soal_id);
  return { data: { questions, attempt, settings: { idle_enabled: false, tabdetect_enabled: true, tab_tolerance: 3 } } };
});
on('POST', '/student/exam-attempt/:id/autosave', (ctx, body, params) => {
  const attempts = g('attempts');
  const a = attempts.find((x) => x.exam_id === Number(params.id) && x.siswa_id === currentUser(ctx)?.id);
  if (a) { a.answers = { ...a.answers, ...(body?.answers || {}) }; s('attempts', attempts); }
  return { data: { server_answers: a ? a.answers : (body?.answers || {}) } };
});
on('POST', '/student/exam-attempt/:id/tab-switch', (ctx, _b, params) => {
  const attempts = g('attempts');
  const a = attempts.find((x) => x.exam_id === Number(params.id) && x.siswa_id === currentUser(ctx)?.id);
  if (a) { a.tab_switches = (a.tab_switches || 0) + 1; s('attempts', attempts); }
  return { data: { tab_switches: a ? a.tab_switches : 1, locked: false } };
});
on('POST', '/student/exam-attempt/:id/lock', (ctx, body, params) => {
  const attempts = g('attempts');
  const a = attempts.find((x) => x.exam_id === Number(params.id) && x.siswa_id === currentUser(ctx)?.id);
  if (a) { a.status = 'locked'; a.lock_reason = body?.reason; s('attempts', attempts); }
  return { data: { locked: true } };
});
on('POST', '/student/submissions/quiz', (ctx, body) => {
  const paketId = Number(body?.paket_soal_id);
  const answers = body?.answers || {};
  const questions = g('questions').filter((q) => q.paket_soal_id === paketId);
  let correct = 0;
  const review = questions.map((q) => {
    const chosen = answers[q.id];
    const benar = chosen === q.kunci;
    if (benar) correct += 1;
    return { id: q.id, benar, kunci: q.kunci, jawaban_siswa: chosen || null };
  });
  const score = questions.length ? Math.round((correct / questions.length) * 100) : 0;
  const attempts = g('attempts');
  const a = attempts.find((x) => x.exam_id === Number(body?.exam_session_id) && x.siswa_id === currentUser(ctx)?.id);
  if (a) { a.status = 'submitted'; a.score = score; s('attempts', attempts); }
  return { data: { score, correct_answers: correct, total_questions: questions.length, review, message: `Nilai kamu ${score}` } };
});

// check-token: official exam (session.token) OR teacher quiz (task.token_akses)
on('POST', '/student/exams/check-token', (ctx, body) => {
  const tok = String(body?.token || '').trim().toUpperCase();
  const sess = g('examSessions').find((e) => String(e.token).toUpperCase() === tok);
  if (sess) {
    return { status: 'ready', message: 'Token valid. Silakan mulai ujian.', data: { mode: 'official', mode_soal: 'cbt_docx', exam_code: sess.token, id: sess.id, nama: sess.nama, mapel: sess.mapel, target: sess.target, jenis: sess.jenis, duration_minutes: sess.duration_minutes, resume: false } };
  }
  const task = g('tasks').find((t) => String(t.token_akses).toUpperCase() === tok);
  if (task) {
    return { status: 'ready', message: 'Token valid.', data: { mode: 'teacher_quiz', mode_soal: task.mode_soal, exam_code: task.token_akses, id: task.id, nama: task.judul, mapel: task.mapel_nama, target: task.kelas_nama, questions: task.questions || [], ends_at: task.deadline_at, remaining_seconds: (task.duration_minutes || 30) * 60, saved_answers: {}, soal_pdf_api_url: task.soal_pdf_api_url || '', pdf_url: task.pdf_url || null, izin_ketik: task.izinkan_ketik, izin_upload_foto: task.izinkan_upload_foto, duration_minutes: task.duration_minutes, tampilkan_nilai: task.tampilkan_nilai } };
  }
  return { status: 'invalid', message: 'Token tidak dikenali. Coba ' + (g('examSessions')[0]?.token || 'CBT123') };
});
on('POST', '/student/exams/verify-token', (_ctx, body) => ({ status: 'ready', message: 'OK', data: {} }));

on('POST', '/student/tugas/:id/start', (ctx, _b, params) => {
  const task = g('tasks').find((t) => t.id === Number(params.id));
  return { data: { ends_at: task?.deadline_at || isoInMinutes(30), remaining_seconds: (task?.duration_minutes || 30) * 60, saved_answers: {} } };
});
on('POST', '/student/tugas/:id/save-progress', () => ({ message: 'Tersimpan' }));
on('POST', '/student/tugas/:id/submit-cbt', (ctx, body, params) => {
  const taskId = Number(params.id);
  const task = g('tasks').find((t) => t.id === taskId);
  const answers = body?.answers || {};
  const questions = task?.questions || [];
  let correct = 0;
  const questions_review = questions.map((q) => {
    const chosen = answers[q.id];
    const benar = chosen === q.kunci;
    if (benar) correct += 1;
    return { question_id: q.id, no: q.no, text: q.text, options: q.options, option_images: q.option_images, image_url: q.image_url, benar, kunci_jawaban: q.kunci, jawaban_murid: chosen || null };
  });
  const nilai = questions.length ? Math.round((correct / questions.length) * 100) : 0;
  const u = currentUser(ctx);
  const subs = g('submissions');
  let sub = subs.find((x) => x.task_id === taskId && x.siswa_id === u?.id);
  if (!sub) { sub = { id: nextId(subs), task_id: taskId, siswa_id: u?.id, name: u?.name, nisn: u?.nisn, state: 'selesai', submitted_at: nowIso() }; subs.push(sub); }
  Object.assign(sub, { nilai_cbt: nilai, poin_diperoleh: nilai, total_poin: 100, state: 'selesai' });
  s('submissions', subs);
  const peers = subs.filter((x) => x.task_id === taskId && x.nilai_cbt != null).sort((a, b) => b.nilai_cbt - a.nilai_cbt);
  const rank = peers.findIndex((x) => x.siswa_id === u?.id) + 1;
  const leaderboard = peers.map((p, i) => ({ rank: i + 1, nama: p.name, skor: p.nilai_cbt, poin: p.nilai_cbt, trophy_tier: p.nilai_cbt >= 90 ? 'gold' : p.nilai_cbt >= 75 ? 'silver' : 'bronze', is_current_user: p.siswa_id === u?.id }));
  return { data: { nilai, correct_answers: correct, total_questions: questions.length, questions_review, leaderboard, tampilkan_nilai: task?.tampilkan_nilai !== false, rank: rank || 1, total_peserta: peers.length || 1, trophy_tier: nilai >= 90 ? 'gold' : nilai >= 75 ? 'silver' : 'bronze', poin_diperoleh: nilai, jenis: 'cbt', mapel: task?.mapel_nama } };
});
on('POST', '/student/tugas/:id/submit-essay', (ctx, body, params) => {
  const taskId = Number(params.id);
  const u = currentUser(ctx);
  const subs = g('submissions');
  const existing = subs.find((x) => x.task_id === taskId && x.siswa_id === u?.id);
  const jawaban = typeof body?.jawaban === 'string' ? body.jawaban : '';
  if (existing) { existing.jawaban_teks = jawaban; existing.state = 'selesai'; existing.nilai_esai = null; existing.submitted_at = nowIso(); }
  else subs.push({ id: nextId(subs), task_id: taskId, siswa_id: u?.id, name: u?.name, nisn: u?.nisn, state: 'selesai', nilai_esai: null, jawaban_teks: jawaban, total_poin: 100, submitted_at: nowIso() });
  s('submissions', subs);
  return { data: { poin_diperoleh: null, message: 'Jawaban diterima guru dan menunggu penilaian.' } };
});
on('POST', '/student/tasks/:id/submit', () => ({ message: 'Tugas dikumpulkan' }));
on('POST', '/student/payments/confirm', () => ({ message: 'Konfirmasi pembayaran terkirim' }));
on('POST', '/student/exam-reviews', () => ({ message: 'Terima kasih atas ulasannya' }));
on('GET', '/student/materials', () => ({ data: g('materials') }));
on('GET', '/student/attendance', () => ({ data: { monthly: [], summary: {} } }));
on('GET', '/student/rapor', (ctx) => { const cu = currentUser(ctx); return { data: { grades: studentGrades(cu?.kelas_id), published: true } }; });
on('GET', '/student/pkl', () => ({ data: g('magang').slice(0, 1) }));

// ------------------------------ CASHIER ------------------------------------
function billingStatusBucket(b) { return b.status; }
on('GET', '/cashier/dashboard', () => {
  const billings = g('billings');
  const payments = g('payments');
  const verifs = g('verifications');
  const today = dayOffsetLive(0);
  const todayIncome = payments.filter((p) => p.transaction_date === today && p.status === 'approved').reduce((a, p) => a + money(p.amount), 0) || 1750000;
  const totalDue = billings.filter((b) => b.status !== 'lunas').reduce((a, b) => a + money(b.remaining_amount), 0);
  const dueStudents = new Set(billings.filter((b) => b.status !== 'lunas').map((b) => b.student_id)).size;
  const paidCount = billings.filter((b) => b.status === 'lunas').length;
  const rasio = Math.round((paidCount / Math.max(billings.length, 1)) * 100);
  const methods = [['cash', 'Tunai'], ['qris', 'QRIS'], ['transfer', 'Transfer'], ['beasiswa', 'Beasiswa']];
  const composition = methods.map(([m, label]) => {
    const amount = payments.filter((p) => p.payment_method === m).reduce((a, p) => a + money(p.amount), 0);
    return { method: m, label, amount };
  });
  const compTotal = composition.reduce((a, c) => a + c.amount, 0) || 1;
  composition.forEach((c) => { c.percent = Math.round((c.amount / compTotal) * 100); });
  return {
    data: {
      summary: { today_income: todayIncome, today_expense: 650000, pending_verifications: verifs.length, current_balance: 12500000, today_income_petugas: todayIncome, today_transactions_petugas: payments.filter((p) => p.transaction_date === today).length || 4, total_tunggakan_aktif: totalDue, tunggakan_siswa_aktif: dueStudents },
      recap: { petty_cash_balance: 1750000 },
      identity: { tahun_ajaran: '2026/2027', semester: 'Ganjil', petugas: 'Ahmad JKK' },
      monthly_trend: [0, 1, 2, 3, 4, 5].map((i) => ({ label: monthLabel(i), income: 38000000 + i * 1500000, expense: 26000000 + i * 800000 })),
      payment_composition: composition,
      recent_transactions: payments.slice(0, 8).map((p) => ({ id: p.id, receipt_code: p.receipt_code, transaction_code: p.transaction_code, title: p.title, payment_method: p.payment_method, channel: p.channel, amount: p.amount, transaction_date: p.transaction_date, petugas: p.petugas, student: { name: p.student_name, school_id: p.student_id }, billing: { title: p.title } })),
      payment_kpi: { transaksi_hari_ini: 4, penerimaan_tunai: todayIncome, tunai_count: 2, non_tunai: todayIncome, non_tunai_count: 2, antrean_verifikasi: verifs.length },
      billing_kpi: { total_tagihan_terbit: billings.length, total_tunggakan_aktif: totalDue, total_subsidi_beasiswa: 0, rasio_pelunasan: rasio },
      cash_funds_kpi: { saldo_kas_kecil: 1750000, pengeluaran_kas_kecil_bulan: 650000, penerimaan_dana_non_siswa: 6500000, belanja_program: 3200000 },
    },
  };
});
on('GET', '/cashier/history', () => {
  const records = g('payments').map((p) => ({ id: p.id, receipt_code: p.receipt_code, transaction_code: p.transaction_code, transaction_date: p.transaction_date, amount: p.amount, payment_method: p.payment_method, channel: p.channel, status: p.status, petugas: p.petugas, title: p.title, category: p.category, receipt_total: p.amount, cash_received: p.cash_received, change_amount: p.change_amount, student: { name: p.student_name, nisn_nip: p.student_id, school_id: p.student_id }, billing: { title: p.title, bill_code: 'SPP' } }));
  return { data: { records, pagination: { last_page: 1 }, summary: { petugas: [{ nama: 'Ahmad JKK', jumlah_transaksi: records.length }] } } };
});
on('GET', '/cashier/students', (ctx) => {
  const q = (ctx.query?.q || '').toLowerCase();
  let rows = students().map((x) => ({ id: x.id, name: x.name, nisn_nip: x.nisn, school_id: x.school_id, class_name: x.class_name }));
  if (q) rows = rows.filter((r) => `${r.name} ${r.nisn_nip} ${r.class_name}`.toLowerCase().includes(q));
  return { data: rows.slice(0, Number(ctx.query?.per_page) || 50) };
});
on('GET', '/cashier/students/:id', (_ctx, _b, params) => {
  const sid = Number(params.id);
  const u = findUser(sid);
  const bills = g('billings').filter((b) => b.student_id === sid).map((b) => ({ id: b.id, title: b.title, bill_code: b.bill_code, status: b.status, remaining_amount: b.remaining_amount, base_amount: b.base_amount, discount_amount: b.discount_amount, subsidy_type: b.subsidy_type, discount_note: b.discount_note }));
  return { data: { student: { id: sid, name: u?.name, nisn_nip: u?.nisn, school_id: u?.school_id, class_name: u?.class_name }, bills } };
});
on('GET', '/cashier/billing-options', () => ({ data: { kelas: g('classes').map((c) => ({ id: c.id, name: c.nama })), grades: ['X', 'XI', 'XII'], jurusans: g('jurusans').map((j) => ({ id: j.id, name: j.name, code: j.code })), subsidy_types: ['Tidak', 'Beasiswa', 'Diskon'], categories: ['SPP', 'Seragam', 'Kegiatan', 'Ujian'] } }));
on('GET', '/cashier/billings', (ctx) => {
  let rows = g('billings').map((b) => {
    const u = findUser(b.student_id);
    return { id: b.id, student_id: b.student_id, title: b.title, bill_code: b.bill_code, base_amount: b.base_amount, discount_amount: b.discount_amount, subsidy_type: b.subsidy_type, discount_note: b.discount_note, amount: b.amount, paid_amount: b.paid_amount, remaining_amount: b.remaining_amount, status: b.status, student: { id: b.student_id, name: u?.name, nisn_nip: u?.nisn, school_id: u?.school_id, class_name: u?.class_name } };
  });
  const st = ctx.query?.status;
  if (st) rows = rows.filter((r) => r.status === st);
  const cn = ctx.query?.class_name;
  if (cn) rows = rows.filter((r) => r.student.class_name === cn);
  return { data: rows.slice(0, Number(ctx.query?.per_page) || 20), pagination: { last_page: 1, total: rows.length } };
});
on('GET', '/cashier/arrears', () => {
  const billings = g('billings');
  const map = {};
  billings.filter((b) => b.status !== 'lunas').forEach((b) => {
    map[b.student_id] = map[b.student_id] || { total: 0, count: 0 };
    map[b.student_id].total += money(b.remaining_amount);
    map[b.student_id].count += 1;
  });
  const studs = Object.keys(map).map((id) => {
    const u = findUser(id);
    return { id: Number(id), nisn: u?.nisn, name: u?.name, class_name: u?.class_name, total_tagihan: (u ? billings.filter((b) => b.student_id === Number(id)).reduce((a, b) => a + money(b.amount), 0) : 0), total_bayar: (u ? billings.filter((b) => b.student_id === Number(id) && b.status === 'lunas').reduce((a, b) => a + money(b.paid_amount), 0) : 0), tunggakan: map[id].total, jatuh_tempo_terdekat: dayOffsetLive(-3) };
  });
  return { data: { summary: { total_tunggakan: studs.reduce((a, x) => a + x.tunggakan, 0), jumlah_siswa: studs.length }, students: studs }, pagination: { last_page: 1 } };
});
on('GET', '/cashier/petty-cash', () => ({ data: { balance: 1750000, transactions: g('pettyCash') }, pagination: { last_page: 1 } }));
on('POST', '/cashier/petty-cash', (_ctx, body) => {
  const rows = g('pettyCash');
  const e = { id: nextId(rows), transaction_code: 'KK-' + nextId(rows), transaction_date: body?.transaction_date || dayOffsetLive(0), description: body?.description, type: body?.type, amount: money(body?.amount), balance_after: 1750000, petugas: 'Ahmad JKK', notes: body?.notes };
  rows.unshift(e);
  s('pettyCash', rows);
  return { data: e, message: 'Tersimpan' };
});
on('PUT', '/cashier/petty-cash/:id', (_ctx, body, params) => {
  const rows = g('pettyCash');
  const e = rows.find((x) => String(x.id) === params.id);
  if (e) Object.assign(e, { description: body?.description ?? e.description, amount: body?.amount != null ? money(body.amount) : e.amount, transaction_date: body?.transaction_date ?? e.transaction_date, notes: body?.notes ?? e.notes });
  s('pettyCash', rows);
  return { data: e, message: 'Diperbarui' };
});
on('DELETE', '/cashier/petty-cash/:id', (_ctx, _b, params) => {
  s('pettyCash', g('pettyCash').filter((x) => String(x.id) !== params.id));
  return { message: 'Dihapus' };
});
on('GET', '/cashier/cash-book', () => {
  const entries = g('cashBook');
  const income = entries.filter((e) => e.type === 'income').reduce((a, e) => a + money(e.amount), 0);
  const expense = entries.filter((e) => e.type === 'expense').reduce((a, e) => a + money(e.amount), 0);
  return { data: { entries, ringkasan: { total_pemasukan: income, total_pengeluaran: expense, saldo_kumulatif: income - expense, saldo_periode: income - expense, saldo_awal: 5000000 }, kategori_pilihan: { pemasukan_non_siswa: ['Sumbangan', 'Kantin', 'BOS'], pengeluaran_program: ['Belanja Program', 'Operasional'] }, pemasukan_per_kategori: [{ category: 'Sumbangan', total: 5000000, jumlah: 1 }], pengeluaran_per_kategori: [{ category: 'Belanja Program', total: 3200000, jumlah: 1 }] }, pagination: { last_page: 1, total: entries.length } };
});
on('POST', '/cashier/cash-book', (_ctx, body) => {
  const rows = g('cashBook');
  const e = { id: nextId(rows), transaction_date: body?.transaction_date || dayOffsetLive(0), description: body?.description, category: body?.category, type: body?.type, amount: money(body?.amount), source: body?.source || 'Manual', petugas: 'Ahmad JKK' };
  rows.unshift(e);
  s('cashBook', rows);
  return { data: e, message: 'Tersimpan' };
});
on('PUT', '/cashier/cash-book/:id', (_ctx, body, params) => {
  const rows = g('cashBook');
  const e = rows.find((x) => String(x.id) === params.id);
  if (e) Object.assign(e, { description: body?.description ?? e.description, amount: body?.amount != null ? money(body.amount) : e.amount });
  s('cashBook', rows);
  return { data: e };
});
on('DELETE', '/cashier/cash-book/:id', (_ctx, _b, params) => {
  s('cashBook', g('cashBook').filter((x) => String(x.id) !== params.id));
  return { message: 'Dihapus' };
});
on('GET', '/cashier/verifications', () => ({ data: g('verifications').map((v) => { const u = findUser(v.student_id); return { id: v.id, submitted_at: v.submitted_at, amount: v.amount, payment_method: v.payment_method, status: v.status, proof_url: v.proof_url, proof_name: v.proof_name, student_note: v.student_note, student: { name: v.student_name || u?.name, nisn_nip: u?.nisn, school_id: u?.school_id, class_name: u?.class_name } }; }), pagination: { last_page: 1 } }));
on('POST', '/cashier/verifications/:sid/approve', (_ctx, body, params) => {
  const rows = g('verifications');
  const v = rows.find((x) => String(x.id) === params.sid);
  if (v) v.status = 'lunas';
  s('verifications', rows);
  return { message: 'Pembayaran disetujui' };
});
on('POST', '/cashier/verifications/:sid/reject', (_ctx, body, params) => {
  const rows = g('verifications');
  const v = rows.find((x) => String(x.id) === params.sid);
  if (v) v.status = 'ditolak';
  s('verifications', rows);
  return { message: 'Verifikasi ditolak' };
});
on('POST', '/cashier/billings', (_ctx, body) => {
  const billings = g('billings');
  const targets = body?.student_ids ? [].concat(body.student_ids) : students().filter((x) => x.class_name === body?.target_value).map((x) => x.id);
  let created = 0;
  targets.forEach((sid) => {
    const idNum = Number(sid);
    if (!Number.isNaN(idNum)) {
      const amount = money(body?.amount) || 350000;
      billings.push({ id: nextId(billings), student_id: idNum, title: body?.title || 'Tagihan', bill_code: 'BILL-' + nextId(billings), category: body?.category || 'SPP', base_amount: amount, amount, discount_amount: money(body?.discount_amount), subsidy_type: body?.subsidy_type, discount_note: body?.discount_note, paid_amount: 0, remaining_amount: amount, due_date: body?.due_date, status: 'belum_bayar', created_at: nowIso() });
      created += 1;
    }
  });
  s('billings', billings);
  return { data: { created_count: created, skipped_count: 0, skipped: [], batch_code: 'BATCH-' + Date.now() }, message: `${created} tagihan dibuat` };
});
on('PUT', '/cashier/billings/:id', (_ctx, body, params) => {
  const rows = g('billings');
  const b = rows.find((x) => String(x.id) === params.id);
  if (b) Object.assign(b, { title: body?.title ?? b.title, due_date: body?.due_date ?? b.due_date, subsidy_type: body?.subsidy_type ?? b.subsidy_type, discount_note: body?.discount_note ?? b.discount_note, amount: body?.amount != null ? money(body.amount) : b.amount });
  s('billings', rows);
  return { data: b, message: 'Tagihan diperbarui' };
});
on('DELETE', '/cashier/billings/:id', (_ctx, _b, params) => {
  s('billings', g('billings').filter((x) => String(x.id) !== params.id));
  return { message: 'Tagihan dihapus' };
});
on('POST', '/cashier/payments/pos', (ctx, body) => {
  const sid = Number(body?.student_id);
  const billIds = [].concat(body?.billing_ids || []).map(Number);
  const billings = g('billings');
  const items = [];
  let total = 0;
  billIds.forEach((bid) => {
    const b = billings.find((x) => Number(x.id) === bid);
    if (b) { b.status = 'lunas'; b.paid_amount = b.amount; b.remaining_amount = 0; items.push({ id: b.id, title: b.title, bill_code: b.bill_code, amount: b.amount, category: b.category }); total += money(b.amount); }
  });
  s('billings', billings);
  const payments = g('payments');
  const u = findUser(sid);
  const receipt = { id: nextId(payments), receipt_code: 'RCT-' + Date.now().toString().slice(-6), transaction_code: 'TRX-' + Date.now().toString().slice(-6), payment_method: body?.payment_method, payment_date: body?.payment_date || dayOffsetLive(0), total_amount: total, cash_received: money(body?.cash_received) || total, change_amount: Math.max((money(body?.cash_received) || total) - total, 0), recorded_by_name: 'Ahmad JKK', student: { name: u?.name, school_id: u?.school_id }, items };
  payments.unshift({ id: receipt.id, receipt_code: receipt.receipt_code, transaction_code: receipt.transaction_code, student_id: sid, student_name: u?.name, class_name: u?.class_name, title: items[0]?.title || 'Pembayaran', category: 'SPP', amount: total, payment_method: body?.payment_method, channel: body?.payment_method, transaction_date: receipt.payment_date, status: 'approved', petugas: 'Ahmad JKK', cash_received: receipt.cash_received, change_amount: receipt.change_amount });
  s('payments', payments);
  const verifs = g('verifications').filter((v) => !(v.student_id === sid));
  s('verifications', verifs);
  return { data: receipt, message: 'Pembayaran berhasil' };
});
on('POST', '/cashier/arrears/send-reminder', () => ({ message: 'Pengingat dikirim' }));
on('POST', '/cashier/transactions/:id/void', (_ctx, _b, params) => {
  const payments = g('payments');
  const p = payments.find((x) => String(x.id) === params.id);
  if (p) p.status = 'void';
  s('payments', payments);
  return { message: 'Transaksi dibatalkan' };
});
on('GET', '/cashier/reports', () => ({ data: { per_petugas: [{ petugas_id: 4001, nama: 'Ahmad JKK', jumlah_transaksi: g('payments').length, pemasukan_tunai: 7000000, pemasukan_non_tunai: 7000000, pemasukan: 14000000, pengeluaran: 6500000 }] } }));
on('GET', '/cashier/monthly-reports', () => ({ data: [{ id: 1, bulan_label: 'Oktober 2026', format: 'excel', format_label: 'Excel', nama_file: 'laporan-okt.xlsx', ukuran: '120 KB', tanggal_generate: dayOffsetLive(-10), dibuat_oleh: 'Ahmad JKK' }] }));
on('GET', '/cashier/classes', () => ({ data: g('classes').map((c) => ({ id: c.id, name: c.nama })) }));

// ------------------------------ PUSAT JURUSAN ------------------------------
on('GET', '/pusat-jurusan/jurusans', () => g('jurusans'));
on('GET', '/pusat-jurusan/my-jurusan', (ctx) => { const u = currentUser(ctx); return { data: { jurusan_id: u?.jurusan_id || 1 } }; });
on('GET', '/pusat-jurusan/dashboard-summary/:id', () => ({
  jurusan: { name: 'Rekayasa Perangkat Lunak' },
  kpi: { total_siswa: students().filter((x) => x.jurusan === 'RPL').length, siswa_per_tingkat: { X: 18, XI: 8, XII: 7 }, jadwal_c_aktif: g('teacherSubjects').filter((a) => a.kelas_id <= 4).length, plotting_persen: 85, avg_praktek: 86, avg_ukk: 84, siap_ukk_xii: 6, tiket_aktif: 2 },
  sarana: { total: 35, baik: 32 },
  grouped_chart: [{ tingkat: 'X', kehadiran: 94, nilai_praktek: 85 }, { tingkat: 'XI', kehadiran: 92, nilai_praktek: 87 }, { tingkat: 'XII', kehadiran: 90, nilai_praktek: 88 }],
  pkl_donut: [{ name: 'Aktif', value: 5 }, { name: 'Selesai', value: 2 }],
  kondisi_donut: [{ name: 'Baik', value: 32 }, { name: 'Rusak', value: 3 }],
  periode: { tahun_ajaran: '2026/2027', semester: 'Ganjil' },
}));
on('GET', '/pusat-jurusan/stats/:id', () => ({ stats: { total_siswa: students().filter((x) => x.jurusan === 'RPL').length, kelas: 4, mapel: 10, guru: teachers().length } }));
on('GET', '/pusat-jurusan/magang/:jurusan', () => g('magang'));
on('GET', '/pusat-jurusan/magang/:jurusan/summary', () => { const m = g('magang'); return { total: m.length, aktif: m.filter((x) => x.status === 'aktif').length, selesai: m.filter((x) => x.status === 'selesai').length, belum: m.filter((x) => x.status === 'belum').length, belum_final: m.filter((x) => !x.status_final).length, sertifikat_terbit: 0, laporan_pending: m.filter((x) => !x.laporan_terverifikasi).length }; });
on('GET', '/pusat-jurusan/achievements/:jurusan', () => g('achievements'));
on('GET', '/pusat-jurusan/achievements/:jurusan/summary', () => { const a = g('achievements'); return { total: a.length, lomba: a.filter((x) => x.jenis_prestasi === 'lomba').length, sertifikasi: a.filter((x) => x.jenis_prestasi === 'sertifikasi').length, juara_kelas: 0, lainnya: 0 }; });
on('GET', '/pusat-jurusan/students/:jurusan', () => students().filter((x) => x.jurusan === 'RPL').map((x) => ({ id: x.id, name: x.name, class_name: x.class_name })));
on('GET', '/pusat-jurusan/magang/:jurusan/guru', () => ({ data: teachers().map((t) => ({ id: t.id, name: t.name, nisn_nip: t.nisn_nip })) }));
on('GET', '/pusat-jurusan/plotting/:jurusan/kelas', () => ({ data: g('classes').filter((c) => c.jurusan === 'RPL').map((c) => ({ id: c.id, nama: c.nama, name: c.nama, tingkat: c.tingkat })) }));
on('GET', '/pusat-jurusan/fasilitas', () => ({ data: g('fasilitas') }));
on('POST', '/pusat-jurusan/magang/:jurusan', (_ctx, body) => ({ data: body, message: 'Data magang disimpan' }));
on('PUT', '/pusat-jurusan/magang/:jurusan/:id', (_ctx, body) => ({ data: body, message: 'Diperbarui' }));
on('DELETE', '/pusat-jurusan/magang/:jurusan/:id', () => ({ message: 'Dihapus' }));
on('POST', '/pusat-jurusan/achievements/:jurusan', (_ctx, body) => ({ data: body, message: 'Prestasi ditambahkan' }));
on('DELETE', '/pusat-jurusan/achievements/:jurusan/:id', () => ({ message: 'Dihapus' }));

// ------------------------------ STAFF WORK (raw fetch) ---------------------
on('GET', '/staff-work/dashboard', (ctx) => {
  const u = currentUser(ctx) || {};
  const tasks = g('staffTasks');
  const reports = g('staffReports');
  return { success: true, data: { stats: { disetujui: reports.filter((r) => r.status_verifikasi === 'disetujui').length, ditolak: reports.filter((r) => r.status_verifikasi === 'ditolak').length, menunggu: reports.filter((r) => r.status_verifikasi === 'menunggu').length, total: reports.length }, pending_tasks: tasks.new, recent_notifications: reports.map((r) => ({ judul: r.judul, status_verifikasi: r.status_verifikasi })), user: { days_left: 120, contract_end: u.contract_end_date } } };
});
on('GET', '/staff-work/reports', () => ({ success: true, data: g('staffReports') }));
on('GET', '/staff-work/tasks', () => ({ success: true, data: g('staffTasks') }));
on('POST', '/staff-work/reports', (_ctx, body) => {
  const rows = g('staffReports');
  rows.unshift({ id: nextId(rows), tanggal_kegiatan: body?.tanggal_kegiatan || dayOffsetLive(0), judul: body?.judul || 'Laporan', deskripsi: body?.deskripsi || '', status_verifikasi: 'menunggu', lampirans: JSON.stringify([]), catatan_pembimbing: null });
  s('staffReports', rows);
  return { success: true, message: 'Laporan dikirim' };
});
on('GET', '/staff/dashboard', (ctx) => ({ data: { user: currentUser(ctx) } }));
on('POST', '/staff/presence/check-in', () => ({ message: 'Check-in' }));
on('POST', '/staff/presence/check-out', () => ({ message: 'Check-out' }));
on('POST', '/staff/logs', () => ({ message: 'Tercatat' }));

// ------------------------------ MISC / SECONDARY ---------------------------
on('GET', '/pesan-user/inbox', (ctx) => ({ data: g('messages').inbox || [] }));
on('GET', '/pesan-user/sent', () => ({ data: g('messages').sent || [] }));
on('GET', '/pesan-user/unread-count', () => ({ data: { count: (g('messages').inbox || []).filter((m) => !m.read).length } }));
on('GET', '/alumni', () => ({ data: [] }));
on('GET', '/alumni/check-reminder', () => ({ has_reminder: false }));
on('GET', '/operator/sarana', () => ({ data: { rooms: g('fasilitas').rooms, inventories: g('fasilitas').inventories } }));
on('GET', '/operator/fasilitas', () => ({ data: g('fasilitas') }));
on('GET', '/operator/school-activities', () => ({ data: [] }));
on('GET', '/admin/kbm/logs', () => ({ data: [] }));
on('GET', '/admin/curriculum/documents', () => ({ data: [] }));
on('GET', '/admin/time-slots', () => ({ data: [] }));
on('GET', '/admin/classes/:id/students', (_ctx, _b, params) => ({ data: students().filter((x) => x.kelas_id === Number(params.id)) }));
on('GET', '/operator/grades/matrix', () => ({ data: { tahun_ajaran: '2026/2027', rows: [], filter_options: { tahun_ajaran_list: ['2026/2027'], tingkat: ['X', 'XI', 'XII'], jurusans: g('jurusans'), classes: g('classes').map((c) => ({ id: c.id, name: c.nama })) } } }));
on('GET', '/operator/grades/recap', () => ({ data: { class: { name: '' }, subject: { name: '' }, students: [] } }));
on('GET', '/admin/staff-presences', () => ({ data: g('teacherAttendance').map((t, i) => ({ user_id: t.teacher_id, status: t.status, id: i + 1, check_in_at: t.jam_masuk, check_out_at: t.jam_keluar })) }));
on('GET', '/admin/monitoring-kbm', () => ({ data: g('teacherSubjects').slice(0, 8).map((a) => ({ jadwal_id: a.id, guru_id: a.guru_id, guru_nama: a.guru_nama, kelas_nama: a.kelas_nama, mapel_nama: a.mata_pelajaran, jam_ke: a.jam, status_kbm: 'berjalan' })) }));
on('GET', '/admin/teacher-presences', () => ({ data: g('teacherAttendance') }));
on('GET', '/admin/presensi/monitoring', () => ({ data: g('classes').slice(0, 6).map((c) => ({ jadwal_id: c.id, tanggal: dayOffsetLive(-1), waktu: '07:30', kelas_nama: c.nama, mapel_nama: 'Informatika', guru_nama: 'Budi Santoso', jumlah_siswa: students().filter((x) => x.kelas_id === c.id).length, total_siswa: students().filter((x) => x.kelas_id === c.id).length, status_presensi: 'sudah' })) }));
on('GET', '/admin/presensi', () => ({ data: [] }));
on('GET', '/admin/presensi/dashboard', () => ({ data: {} }));
on('GET', '/admin/absensi-mengajar', () => ({ data: [] }));
on('GET', '/admin/jadwal-guru', () => ({ data: g('teacherSubjects') }));
on('GET', '/exams/bank', (ctx) => ({ data: g('bankSoal') }));

// =============================================================================
export function handle(method, path, ctx) {
  const m = String(method || 'get').toLowerCase();
  for (const r of routes) {
    if (r.method !== m) continue;
    const mt = r.re.exec(path);
    if (mt) {
      const params = {};
      r.keys.forEach((k, i) => { params[k] = decodeURIComponent(mt[i + 1]); });
      return r.fn(ctx, ctx.body, params);
    }
  }
  // generic fallback
  if (m === 'get') return { data: [] };
  return { message: 'Aksi demo berhasil', success: true, data: {} };
}
