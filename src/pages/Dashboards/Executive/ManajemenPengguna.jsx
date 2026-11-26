import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';
import {
  ShieldCheck, Clock, Users, UserCheck, UserX, ShieldAlert,
  FileSpreadsheet, Printer, Eye, Filter, BarChart3, ClipboardList, Search, BadgeCheck,
} from 'lucide-react';
import SectionLoading from '../../../components/dashboard/shared/SectionLoading';
import ModalCloseControl from '../../../components/dashboard/shared/ModalCloseControl';
import RaporPdfPreview from '../../../components/dashboard/shared/RaporPdfPreview';
import useEscapeKey from '../../../utils/useEscapeKey';
import useBodyScrollLock from '../../../utils/useBodyScrollLock';
import { previewAuditHakAksesPDF } from '../../../utils/auditHakAksesPdf';

const GROUP_STYLE = {
  pimpinan: 'bg-violet-50 text-violet-700',
  guru: 'bg-sky-50 text-sky-700',
  murid: 'bg-emerald-50 text-emerald-700',
  staf: 'bg-amber-50 text-amber-700',
};

function KpiCard({ label, value, sub, icon: Icon, accent }) {
  return (
    <div className={`relative overflow-hidden rounded-3xl border ${accent.border} bg-gradient-to-br ${accent.grad} p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg`}>
      <div className="relative z-10 flex items-center gap-3 mb-3">
        <div className={`w-12 h-12 ${accent.chip} rounded-2xl flex items-center justify-center`}>
          <Icon className={`w-6 h-6 ${accent.text}`} />
        </div>
        <p className="text-xs font-black uppercase tracking-wider text-slate-500">{label}</p>
      </div>
      <p className="relative z-10 text-3xl font-black text-slate-900">{value}</p>
      {sub ? <p className="relative z-10 mt-1 text-xs font-semibold text-slate-500">{sub}</p> : null}
      <Icon className={`pointer-events-none absolute -bottom-4 -right-4 h-24 w-24 ${accent.text} opacity-[0.07]`} />
    </div>
  );
}

const Donut = ({ segments, size = 150, thickness = 20 }) => {
  const total = segments.reduce((s, x) => s + (x.value || 0), 0);
  const r = size / 2 - thickness / 2;
  const C = 2 * Math.PI * r;
  let offset = 0;
  const cx = size / 2, cy = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0 animate-draw-in">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#eef2f7" strokeWidth={thickness} />
      {total > 0 && segments.filter((s) => s.value > 0).map((s, i) => {
        const len = (s.value / total) * C;
        const el = (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={s.color} strokeWidth={thickness}
            strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-offset}
            transform={`rotate(-90 ${cx} ${cy})`} />
        );
        offset += len;
        return el;
      })}
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fontSize="24" fontWeight="900" fill="#0f172a">{total}</text>
    </svg>
  );
};

const ManajemenPengguna = ({ stats: parentStats, clock, accessRole }) => {
  const audit = parentStats?.executive?.user_audit;
  const kpis = audit?.kpis || {};
  const distribution = audit?.role_distribution || [];
  const sorotan = audit?.sorotan || [];
  const users = useMemo(() => audit?.users || [], [audit]);
  const hasLastLogin = audit?.meta?.has_last_login === true;

  const [filters, setFilters] = useState({ roleGroup: 'all', status: 'all', search: '' });
  const [detailTarget, setDetailTarget] = useState(null);
  const [pdfPreview, setPdfPreview] = useState(null);
  const detailOpen = !!detailTarget;
  useEscapeKey(detailOpen, () => setDetailTarget(null));
  useBodyScrollLock(detailOpen);

  const filtered = useMemo(() => users.filter((u) => {
    if (filters.roleGroup !== 'all' && u.role_group !== filters.roleGroup) return false;
    if (filters.status === 'aktif' && !u.is_active) return false;
    if (filters.status === 'nonaktif' && u.is_active) return false;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      if (!((u.name || '').toLowerCase().includes(q)
        || (u.email || '').toLowerCase().includes(q)
        || String(u.identity || '').toLowerCase().includes(q))) return false;
    }
    return true;
  }), [users, filters]);

  const loading = !parentStats;

  const handleExportExcel = () => {
    const data = filtered.map((u, i) => ({
      No: i + 1,
      Nama: u.name || '-',
      Email: u.email || '-',
      'NIP/NISN': u.identity || 'Belum Diisi',
      'Hak Akses': u.role_label || '-',
      Kelompok: u.role_group_label || '-',
      Status: u.is_active ? 'Aktif' : 'Nonaktif',
      'Perlu Audit': u.needs_audit ? 'Ya' : 'Tidak',
      'Terakhir Aktif': u.last_login || '-',
      Terdaftar: u.created_at || '-',
    }));
    const ws = XLSX.utils.json_to_sheet(data.length ? data : [{ No: '-', Nama: 'Belum ada akun yang cocok dengan filter' }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Audit Akun');
    XLSX.writeFile(wb, `Log_Audit_Akun_${new Date().toLocaleDateString('id-ID')}.xlsx`);
  };

  const handlePrintPDF = async () => {
    try {
      const res = await previewAuditHakAksesPDF({ rows: filtered, kpis });
      if (res) setPdfPreview(res);
    } catch { /* toast ditangani util */ }
  };

  if (loading) return <SectionLoading loading={true} label="Memuat audit akun & hak akses..." />;

  const clockObj = clock || { time: '', day: '', date: '' };
  const distTotal = distribution.reduce((s, x) => s + (x.value || 0), 0);

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* ── Hero Banner (identik Menu ke-2 s.d. ke-6) ── */}
      <div className="overflow-hidden rounded-[2rem] border border-amber-100 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.18),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(245,158,11,0.13),transparent_28%),linear-gradient(135deg,#ffffff_0%,#fffbeb_100%)] p-6 lg:p-8 shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="space-y-2 flex-1">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-amber-700">
              <ShieldCheck className="h-3 w-3" /> {accessRole === 'wakil_sekolah' ? 'Portal Vice Principal Authority' : 'Portal Principal Authority'}
            </div>
            <h1 className="text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">Audit Akun &amp; Hak Akses</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Peninjauan menyeluruh akun pengguna aktif, distribusi hak akses per peran, serta kepatuhan kelengkapan identitas sistem.
            </p>
          </div>
          <div className="flex flex-col items-end gap-1 px-4 py-2 rounded-2xl bg-white/80 border border-amber-100 shadow-sm shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black text-slate-700 uppercase tracking-widest">{clockObj.day},</span>
              <span className="text-xs font-bold text-slate-500">{clockObj.date}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-400" />
              <span className="text-lg font-black tracking-widest text-slate-700 tabular-nums">{clockObj.time}</span>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">WIB</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Banner Read-Only ── */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl px-5 py-4 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <p className="text-sm font-bold text-blue-800">
          Mode Audit Read-Only. Kepala Sekolah hanya meninjau akun &amp; hak akses. Tambah/ubah/hapus akun, reset password, dan perubahan role dilakukan lewat modul Operator/Admin.
        </p>
      </div>

      {/* ── 4 KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 stagger-grid">
        <KpiCard label="Total Akun Sistem" value={String(kpis.total_akun ?? 0)} sub="seluruh pengguna terdaftar" icon={Users} accent={{ grad: 'from-sky-50/90 via-white to-sky-50/50', border: 'border-sky-200/70', chip: 'bg-sky-100', text: 'text-sky-600' }} />
        <KpiCard label="Akun Aktif & Terverifikasi" value={`${kpis.akun_aktif ?? 0}/${kpis.total_akun ?? 0}`} sub="aktif dibanding total" icon={UserCheck} accent={{ grad: 'from-emerald-50/90 via-white to-emerald-50/50', border: 'border-emerald-200/70', chip: 'bg-emerald-100', text: 'text-emerald-600' }} />
        <KpiCard label="Akun Nonaktif / Ditangguhkan" value={String(kpis.akun_nonaktif ?? 0)} sub="is_active = false" icon={UserX} accent={{ grad: 'from-amber-50/90 via-white to-amber-50/50', border: 'border-amber-200/70', chip: 'bg-amber-100', text: 'text-amber-600' }} />
        <KpiCard label="Perlu Audit Identitas" value={String(kpis.perlu_audit ?? 0)} sub="NIP/NISN kosong / akses belum sinkron" icon={ShieldAlert} accent={{ grad: 'from-rose-50/90 via-white to-rose-50/50', border: 'border-rose-200/70', chip: 'bg-rose-100', text: 'text-rose-600' }} />
      </div>

      {/* ── Panel Ringkasan Visual 2 Kolom ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="h-5 w-5 text-sky-600" />
            <h3 className="text-base font-black text-slate-900">Distribusi Akun per Hak Akses</h3>
          </div>
          <p className="text-xs text-slate-500 mb-5">Komposisi pengguna per kelompok peran — riil dari database.</p>
          {distTotal === 0 ? (
            <EmptyViz text="Belum ada akun" note="Distribusi muncul setelah pengguna terdaftar." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center">
              <div className="flex flex-col items-center gap-3">
                <Donut segments={distribution} />
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] font-bold text-slate-600">
                  {distribution.map((d) => (
                    <span key={d.key} className="flex items-center gap-1.5">
                      <i className="w-3 h-3 rounded-full inline-block" style={{ background: d.color }} /> {d.label} {d.value}
                    </span>
                  ))}
                </div>
              </div>
              <div className="space-y-2.5">
                {distribution.map((d) => (
                  <StatBar key={d.key} label={d.label} value={d.value} max={Math.max(...distribution.map((x) => x.value), 1)} color={d.color} />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <ShieldAlert className="h-5 w-5 text-rose-600" />
            <h3 className="text-base font-black text-slate-900">Sorotan Kepatuhan &amp; Keamanan Akun</h3>
          </div>
          <p className="text-xs text-slate-500 mb-5">Akun aktif dengan identitas belum lengkap / nonaktif terbaru.</p>
          {sorotan.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center">
                <BadgeCheck className="w-8 h-8 text-emerald-500" />
              </div>
              <p className="text-sm font-black text-emerald-600 uppercase tracking-wider">Bersih</p>
              <p className="text-xs text-slate-500 max-w-xs">Seluruh akun aktif telah memenuhi kelengkapan identitas sistem.</p>
            </div>
          ) : (
            <ul className="space-y-2.5">
              {sorotan.map((s, i) => (
                <li key={`${s.id}-${i}`} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-slate-900 truncate">{s.name}</p>
                    <p className="text-xs text-slate-500 truncate">{s.email || '-'} · {s.role_group_label}</p>
                  </div>
                  <span className="shrink-0 inline-flex px-2.5 py-1 rounded-lg text-xs font-black bg-rose-50 text-rose-700">{s.issue}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ── Filter + Ekspor ── */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
          <div className="flex flex-nowrap items-center gap-3 overflow-x-auto">
            <FilterSelect label="Peran" value={filters.roleGroup} onChange={(v) => setFilters((f) => ({ ...f, roleGroup: v }))}
              options={[{ v: 'pimpinan', l: 'Kepala Sekolah & Wakasek' }, { v: 'guru', l: 'Tenaga Didik' }, { v: 'murid', l: 'Murid' }, { v: 'staf', l: 'Operator & Kasir' }]}
              allLabel="Semua Peran" />
            <FilterSelect label="Status" value={filters.status} onChange={(v) => setFilters((f) => ({ ...f, status: v }))}
              options={[{ v: 'aktif', l: 'Aktif' }, { v: 'nonaktif', l: 'Nonaktif' }]} allLabel="Semua" />
            <label className="flex shrink-0 items-center gap-2 rounded-xl bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-600 border border-slate-200">
              <Search className="h-4 w-4" />
              <input value={filters.search} onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))} placeholder="Cari nama / email / NIP..." className="bg-transparent outline-none w-52" />
            </label>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-3">
            <button onClick={handleExportExcel} className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-black text-white whitespace-nowrap hover:bg-emerald-700 transition-colors">
              <FileSpreadsheet className="h-4 w-4" /> Ekspor Log Audit Akun (.xlsx)
            </button>
            <button onClick={handlePrintPDF} className="flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-black text-white whitespace-nowrap hover:bg-rose-700 transition-colors">
              <Printer className="h-4 w-4" /> Cetak Laporan Audit Hak Akses (PDF)
            </button>
          </div>
        </div>
      </div>

      {/* ── Tabel Audit ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Pengguna', 'Identitas', 'Hak Akses', 'Status Akun', hasLastLogin ? 'Terakhir Aktif / Terdaftar' : 'Terdaftar', 'Aksi'].map((h) => (
                  <th key={h} className="px-5 py-4 text-left text-xs font-black uppercase tracking-wider text-slate-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length > 0 ? filtered.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-4">
                    <p className="text-sm font-black text-slate-900">{u.name || '-'}</p>
                    <p className="text-xs text-slate-500">{u.email || '-'}</p>
                  </td>
                  <td className="px-5 py-4">
                    {u.identity ? (
                      <span className="text-sm font-bold text-slate-700 tabular-nums">{u.identity}</span>
                    ) : (
                      <span className="inline-flex px-2.5 py-1 rounded-lg text-xs font-black bg-rose-50 text-rose-700">Belum Diisi</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-black ${GROUP_STYLE[u.role_group] || 'bg-slate-100 text-slate-600'}`}>{u.role_label}</span>
                    <p className="text-[11px] text-slate-400 mt-1">{u.jabatan || u.class_name || u.access_role || '-'}</p>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-black ${u.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {u.is_active ? <UserCheck className="h-3.5 w-3.5" /> : <UserX className="h-3.5 w-3.5" />}
                      {u.is_active ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-600">{u.last_login || u.created_at || '-'}</td>
                  <td className="px-5 py-4">
                    <button onClick={() => setDetailTarget(u)} className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg text-xs font-black uppercase tracking-wider hover:bg-blue-600 hover:text-white transition-colors">
                      <Eye className="h-4 w-4" /> Detail Audit
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
                        <Users className="w-8 h-8 text-slate-400" />
                      </div>
                      <p className="text-sm font-black text-slate-400 uppercase tracking-wider">Tidak ada akun</p>
                      <p className="text-xs text-slate-500">Sesuaikan filter peran/status atau kata kunci pencarian.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {detailOpen && detailTarget ? <DetailModal user={detailTarget} hasLastLogin={hasLastLogin} onClose={() => setDetailTarget(null)} /> : null}

      <RaporPdfPreview state={pdfPreview} onClose={() => { if (pdfPreview?.url) URL.revokeObjectURL(pdfPreview.url); setPdfPreview(null); }} title="Pratinjau Laporan Audit Hak Akses (PDF)" downloadLabel="Unduh Laporan" />
    </div>
  );
};

const EmptyViz = ({ text, note }) => (
  <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
      <ClipboardList className="w-8 h-8 text-slate-400" />
    </div>
    <p className="text-sm font-black text-slate-400 uppercase tracking-wider">{text}</p>
    <p className="text-xs text-slate-500 max-w-xs">{note}</p>
  </div>
);

const StatBar = ({ label, value, max, color }) => {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-36 text-xs font-black text-slate-600 truncate">{label}</span>
      <div className="h-3 flex-1 rounded-full bg-slate-100 overflow-hidden">
        <div className="animate-grow-x h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="w-6 text-right text-sm font-black text-slate-900">{value}</span>
    </div>
  );
};

const FilterSelect = ({ label, value, onChange, options, allLabel }) => (
  <label className="flex shrink-0 items-center gap-2 rounded-xl bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-600 border border-slate-200">
    <Filter className="h-4 w-4" />
    <select value={value} onChange={(e) => onChange(e.target.value)} className="bg-transparent outline-none max-w-[14rem]">
      <option value="all">{allLabel}</option>
      {options.map((o) => (<option key={o.v} value={o.v}>{o.l}</option>))}
    </select>
  </label>
);

const DetailModal = ({ user, hasLastLogin, onClose }) => {
  const fields = [
    { label: 'Nama Lengkap', value: user.name || '-' },
    { label: 'E-mail', value: user.email || '-' },
    { label: 'NIP / NISN / NUPTK', value: user.identity || 'Belum Diisi' },
    { label: 'Hak Akses (access_role)', value: user.access_role || 'Belum tersinkron' },
    { label: 'Peran', value: user.role_label || '-' },
    { label: 'Kelompok', value: user.role_group_label || '-' },
    { label: 'Jabatan', value: user.jabatan || '-' },
    { label: 'Kelas', value: user.class_name || '-' },
    { label: 'Status Kepegawaian', value: user.position_status || '-' },
    { label: 'Status Akun', value: user.is_active ? 'Aktif' : 'Nonaktif' },
    { label: 'E-mail Terverifikasi', value: user.verified ? 'Ya' : 'Belum' },
    { label: hasLastLogin ? 'Terakhir Aktif' : 'Terdaftar', value: (hasLastLogin ? user.last_login : null) || user.created_at || '-' },
  ];
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-[2rem] bg-white shadow-2xl overflow-hidden animate-scale-in max-h-[92vh] flex flex-col">
        <div className="flex items-start justify-between gap-4 bg-gradient-to-br from-amber-500 to-orange-600 px-7 py-6">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-amber-100">Detail Audit Akun</p>
            <h3 className="text-2xl font-black text-white">{user.name || 'Akun'}</h3>
            <p className="mt-1 text-sm text-amber-50">{user.role_label} · {user.is_active ? 'Aktif' : 'Nonaktif'}</p>
          </div>
          <ModalCloseControl onClose={onClose} tone="onDark" />
        </div>
        <div className="px-7 py-6 overflow-y-auto">
          {user.needs_audit ? (
            <div className="mb-4 flex items-start gap-2 rounded-xl bg-rose-50 border border-rose-200 px-4 py-3">
              <ShieldAlert className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
              <p className="text-sm font-bold text-rose-700">Temuan audit: {user.identity_empty ? 'NIP/NISN belum diisi' : ''}{user.identity_empty && user.access_unsynced ? ' & ' : ''}{user.access_unsynced ? 'hak akses belum tersinkron' : ''}.</p>
            </div>
          ) : (
            <div className="mb-4 flex items-start gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3">
              <BadgeCheck className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
              <p className="text-sm font-bold text-emerald-700">Identitas &amp; hak akses akun ini lengkap.</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            {fields.map((f) => (
              <div key={f.label} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">{f.label}</p>
                <p className="text-sm font-bold text-slate-900 break-words">{f.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default ManajemenPengguna;
