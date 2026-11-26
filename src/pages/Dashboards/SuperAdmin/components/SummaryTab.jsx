import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Users, ShieldCheck, Activity, Monitor, Zap, Megaphone, CalendarDays,
  ArrowUpRight, ChevronDown, History, Clock, FileText, X,
  Database, Lock, Eye, User, Inbox, Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { operatorAPI } from '../../../../utils/api';
import { toast } from 'react-hot-toast';

/* ─────────────────────────────────────────────────────────────
   Helper (semua angka bersumber dari data nyata — tanpa dummy)
   ───────────────────────────────────────────────────────────── */
const parseDate = (value) => {
  if (!value) return null;
  const direct = new Date(value);
  if (!Number.isNaN(direct.getTime())) return direct;
  const alt = new Date(String(value).split(',')[0]);
  return Number.isNaN(alt.getTime()) ? null : alt;
};

const stripHtml = (html) => String(html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

const modeFlag = (v) => String(v) === '1' || v === true || v === 1;

const ROLE_ROWS = [
  { key: 'operator', label: 'Super Admin - Operator', tone: 'bg-red-500' },
  { key: 'admin_akademik', label: 'Admin Akademik - Operator', tone: 'bg-orange-500' },
  { key: 'pusat_jurusan', label: 'Pusat Jurusan', tone: 'bg-cyan-500' },
  { key: 'kepala_sekolah', label: 'Kepala Sekolah', tone: 'bg-blue-600' },
  { key: 'wakil_sekolah', label: 'Wakil Kepala Sekolah', tone: 'bg-teal-600' },
  { key: 'guru', label: 'Guru', tone: 'bg-emerald-500' },
  { key: 'cashier', label: 'Kasir', tone: 'bg-amber-500' },
  { key: 'murid', label: 'Murid', tone: 'bg-sky-500' },
];

/* ── Kartu statistik (klik → menu terkait) ── */
const StatCard = ({ tone, icon: Icon, label, value, valueClass = '', sub, onClick, alert = false }) => {
  const tones = {
    blue: { tile: 'bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white', hover: 'hover:border-blue-300 hover:shadow-blue-500/10', accent: 'text-blue-500' },
    violet: { tile: 'bg-violet-50 text-violet-600 group-hover:bg-violet-600 group-hover:text-white', hover: 'hover:border-violet-300 hover:shadow-violet-500/10', accent: 'text-violet-500' },
    emerald: { tile: 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white', hover: 'hover:border-emerald-300 hover:shadow-emerald-500/10', accent: 'text-emerald-500' },
    amber: { tile: 'bg-amber-50 text-amber-600 group-hover:bg-amber-500 group-hover:text-white', hover: 'hover:border-amber-300 hover:shadow-amber-500/10', accent: 'text-amber-500' },
    rose: { tile: 'bg-rose-50 text-rose-600 group-hover:bg-rose-600 group-hover:text-white', hover: 'hover:border-rose-300 hover:shadow-rose-500/10', accent: 'text-rose-500' },
  };
  const t = tones[tone] || tones.blue;
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      {...(onClick ? { type: 'button', onClick } : {})}
      className={`group relative flex w-full flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-6 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${t.hover} ${alert ? 'ring-2 ring-rose-400/60' : ''}`}
    >
      <div className="mb-5 flex items-start justify-between">
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl transition-colors duration-300 ${t.tile}`}>
          <Icon size={22} />
        </div>
        {onClick && (
          <ArrowUpRight size={16} className="text-slate-300 transition-all duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-slate-600" />
        )}
      </div>
      <div className={`text-3xl font-black tracking-tight text-slate-900 ${valueClass}`}>{value}</div>
      <div className="mt-1 text-[11px] font-bold uppercase tracking-widest text-slate-400">{label}</div>
      {sub && <div className="mt-3 border-t border-slate-100 pt-3 text-xs font-semibold text-slate-500">{sub}</div>}
    </Comp>
  );
};

const SummaryTab = ({
  summaryData,
  allUsers = [],
  activityLogs = [],
  announcements = [],
  onlineUsers = [],
  backups = [],
  calendarEvents = [],
  systemSettings = null,
  loading,
  onSync,
  onNavigate,
}) => {
  /* ── Metrik nyata: pengguna ── */
  const totalUsers = summaryData?.total_users ?? allUsers.length;
  const muridCount = summaryData?.students
    ?? allUsers.filter((u) => (u.access_role || u.role || '').toLowerCase() === 'murid').length;
  const staffGuruCount = Math.max(totalUsers - muridCount, 0);

  /* ── Metrik nyata: sesi login aktif (query akurat endpoint keamanan) ── */
  const activeSessionUsers = onlineUsers.length;
  const totalSessionTokens = onlineUsers.reduce((sum, u) => sum + (Number(u.active_session_count) || 1), 0);

  /* ── Live activity logs — seed dari prop, di-refresh otomatis setiap 5 detik ── */
  const [liveLogs, setLiveLogs] = useState(() =>
    [...activityLogs].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
  );
  useEffect(() => {
    setLiveLogs(
      [...activityLogs].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    );
  }, [activityLogs]);
  useEffect(() => {
    const interval = window.setInterval(async () => {
      try {
        const response = await operatorAPI.getActivityLog();
        const data = response.data?.data || [];
        setLiveLogs([...data].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)));
      } catch {
        // silent fail — jangan ganggu UI
      }
    }, 5000);
    return () => window.clearInterval(interval);
  }, []);

  /* ── Metrik nyata: audit log 24 jam ── */
  const audit24h = useMemo(() => {
    const fromStats = summaryData?.security_summary?.last_24h_events;
    if (fromStats !== undefined && fromStats !== null) return fromStats;
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    return liveLogs.filter((l) => {
      const d = parseDate(l.created_at);
      return d && d.getTime() >= cutoff;
    }).length;
  }, [summaryData, liveLogs]);

  /* ── Metrik nyata: mode sistem (Darurat & Pencadangan) ── */
  const sleepOn = systemSettings ? modeFlag(systemSettings.sleep_server?.active) : null;
  const maintenanceOn = systemSettings ? modeFlag(systemSettings.maintenance?.active) : null;
  const cleaningOn = systemSettings ? modeFlag(systemSettings.cleaning?.active) : null;
  const anyModeOn = Boolean(sleepOn || maintenanceOn || cleaningOn);
  const activeModeNames = [
    sleepOn ? 'Mode Tidur' : null,
    maintenanceOn ? 'Maintenance' : null,
    cleaningOn ? 'Server Cleaning' : null,
  ].filter(Boolean);

  /* ── Distribusi jabatan nyata (dari agregasi backend) ── */
  const rolesMap = summaryData?.roles || {};
  const roleRows = ROLE_ROWS.map((r) => ({ ...r, count: Number(rolesMap[r.key]) || 0 }));
  const knownKeys = ROLE_ROWS.map((r) => r.key);
  // 'magang_honor' bukan jabatan fungsional resmi → tidak ditampilkan terpisah
  // dan tidak digabung ke "Akun tanpa jabatan tetap".
  const otherRolesCount = Object.entries(rolesMap)
    .filter(([key]) => !knownKeys.includes(key) && key !== 'magang_honor')
    .reduce((sum, [, v]) => sum + (Number(v) || 0), 0);
  if (otherRolesCount > 0) {
    roleRows.push({ key: '_other', label: 'Akun tanpa jabatan tetap', tone: 'bg-slate-400', count: otherRolesCount });
  }

  /* ── Kabar Terbaru (pola seragam Pusat Jurusan): switcher AGENDA / INFORMASI ── */
  const [newsTab, setNewsTab] = useState('informasi');
  const [selectedNews, setSelectedNews] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ show: false, id: null });

  const announcementItems = useMemo(() => announcements.map((item) => ({
    kind: 'pengumuman',
    id: item.id,
    title: item.title,
    date: item.created_at,
    meta: item.author_role || item.author?.name || 'Otoritas Sekolah',
    summary: stripHtml(item.content).slice(0, 130),
    priority: item.priority,
    raw: item,
  })), [announcements]);

  const agendaItems = useMemo(() => {
    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    return (Array.isArray(calendarEvents) ? calendarEvents : [])
      .map((ev) => ({ ev, d: parseDate(ev.event_date) }))
      .filter(({ ev, d }) => ev.is_published !== false && d
        && (d >= startToday || (d >= startMonth && d <= endMonth)))
      .sort((a, b) => a.d - b.d)
      .slice(0, 8)
      .map(({ ev, d }) => ({
        kind: 'agenda',
        id: ev.id,
        title: ev.title,
        date: ev.event_date,
        meta: ev.catatan || ev.type || 'Agenda Akademik',
        summary: '',
        isUpcoming: d >= startToday,
        raw: ev,
      }));
  }, [calendarEvents]);

  const isSameLocalDay = (dateStr) => {
    if (!dateStr) return false;
    const dt = new Date(dateStr); const now = new Date();
    return dt.getFullYear() === now.getFullYear() && dt.getMonth() === now.getMonth() && dt.getDate() === now.getDate();
  };
  const hasNewAgenda = agendaItems.length > 0 && isSameLocalDay(agendaItems[0].raw?.created_at);
  const hasNewInfo = announcementItems.length > 0 && announcementItems[0].raw?.is_read === false;

  const handleDeleteNews = (id) => setConfirmModal({ show: true, id });
  const executeDeleteNews = async (id) => {
    setIsDeleting(true);
    setConfirmModal({ show: false, id: null });
    try {
      await operatorAPI.deleteAnnouncement(id);
      toast.success('Informasi berhasil dihapus');
      setSelectedNews(null);
      if (onSync) onSync();
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Gagal menghapus informasi');
    } finally {
      setIsDeleting(false);
    }
  };

  /* ── Log aktivitas bawah ── */
  const filteredLogs = liveLogs;
  const [showAllLogs, setShowAllLogs] = useState(false);
  const initialLogLimit = 15;
  const displayedLogs = showAllLogs ? filteredLogs : filteredLogs.slice(0, initialLogLimit);

  return (
    <div className="space-y-6 pb-16">

      {/* ── 4 KARTU STATISTIK REAL (klik → menu terkait) ── */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          tone="blue"
          icon={Users}
          label="Total Pengguna Terdaftar"
          value={totalUsers}
          sub={
            <span>
              Akun Staf/Guru <span className="font-black text-slate-700">{staffGuruCount}</span>
              {' · '}Murid <span className="font-black text-slate-700">{muridCount}</span>
            </span>
          }
          onClick={() => onNavigate?.('users')}
        />
        <StatCard
          tone="violet"
          icon={Monitor}
          label="Sesi Login Aktif"
          value={activeSessionUsers}
          sub={
            <span>
              Akun dengan token aktif
              {totalSessionTokens !== activeSessionUsers ? (
                <> · <span className="font-black text-slate-700">{totalSessionTokens}</span> total sesi</>
              ) : (
                <> · semuanya <span className="font-black text-slate-700">1</span> sesi</>
              )}
            </span>
          }
          onClick={() => onNavigate?.('security')}
        />
        <StatCard
          tone="emerald"
          icon={Activity}
          label="Audit Log 24 Jam"
          value={audit24h}
          sub={<span>Aktivitas tercatat 24 jam terakhir</span>}
          onClick={() => onNavigate?.('security')}
        />
        <StatCard
          tone={systemSettings == null ? 'amber' : anyModeOn ? 'rose' : 'emerald'}
          icon={systemSettings == null ? Clock : anyModeOn ? Zap : ShieldCheck}
          label="Status & Mode Sistem"
          alert={anyModeOn}
          value={
            systemSettings == null
              ? <span className="text-slate-400">…</span>
              : anyModeOn
                ? <span className="text-rose-600">MODE AKTIF</span>
                : <span className="text-emerald-600">NORMAL</span>
          }
          sub={
            systemSettings == null
              ? <span>Memuat status sistem…</span>
              : anyModeOn
                ? (
                  <span className="flex flex-wrap gap-1.5">
                    {activeModeNames.map((name) => (
                      <span key={name} className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-rose-600 ring-1 ring-rose-200">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />
                        {name}
                      </span>
                    ))}
                  </span>
                )
                : <span>Semua mode darurat OFF</span>
          }
          onClick={() => onNavigate?.('emergency_db')}
        />
      </div>

      {/* ── TENGAH: 2 KOLOM (7/12 Kabar Terbaru · 5/12 Ringkasan Otoritas) ── */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">

        {/* KOLOM KIRI — Kabar Terbaru (pola 100% seragam Dashboard Guru) */}
        <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm xl:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center rounded-2xl bg-gradient-to-br from-pink-500 to-rose-600 p-3 text-white shadow-sm">
                <Megaphone className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">Kabar Terbaru</h3>
            </div>
            <div className="flex items-center gap-1.5">
              {['agenda', 'informasi'].map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setNewsTab(tab)}
                  className={`relative inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-xs font-bold uppercase tracking-wider transition-all ${
                    newsTab === tab
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                  }`}
                >
                  {tab}
                  {(tab === 'agenda' ? hasNewAgenda : hasNewInfo) && (
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {newsTab === 'agenda' ? (
            <div className="flex-1 p-5">
              {agendaItems.length > 0 ? (
                <div className="space-y-1">
                  {agendaItems.map((ag) => {
                    const d = parseDate(ag.date);
                    return (
                      <div key={ag.id} className="group flex items-center">
                        <span className="mr-3 font-black text-amber-500">•</span>
                        <div className="flex flex-grow items-center justify-between border-b border-slate-100 py-3 pr-1">
                          <p className="text-sm font-bold tracking-wide text-slate-700">
                            {ag.title}
                            <span className="ml-3 font-medium text-slate-400">
                              {d ? d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'}
                            </span>
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-6 text-center">
                  <CalendarDays className="mx-auto mb-2 h-8 w-8 text-slate-200" />
                  <p className="text-sm font-semibold text-slate-400">Belum ada agenda</p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 space-y-3 p-4">
              {announcementItems.length > 0 ? announcementItems.slice(0, 6).map((item) => {
                const ann = item.raw;
                const isUnread = ann.is_read === false;
                const d = parseDate(ann.published_at || ann.created_at);
                const dateLabel = d ? new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(d) : '-';
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedNews(ann)}
                    className={`group flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md ${isUnread ? 'border-rose-100 bg-rose-50/30' : 'border-slate-100 bg-white'}`}
                  >
                    {isUnread ? (
                      <span className="relative mt-1.5 flex h-2.5 w-2.5 shrink-0">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
                      </span>
                    ) : (
                      <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-slate-200" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className={`truncate text-sm font-black transition-colors group-hover:text-blue-600 ${isUnread ? 'text-slate-900' : 'text-slate-700'}`}>{item.title}</p>
                        {isUnread && <span className="shrink-0 rounded-full bg-rose-500 px-1.5 py-0.5 text-[8px] font-black uppercase text-white">Baru</span>}
                      </div>
                      {item.summary && <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">{item.summary}</p>}
                      <div className="mt-2 flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                        <User className="h-3 w-3" />
                        <span>{ann.author?.name || item.meta || 'Admin'}</span>
                        <span>-</span>
                        <span>{dateLabel}</span>
                      </div>
                    </div>
                    <Eye className="mt-1 h-4 w-4 shrink-0 text-slate-300 transition-all group-hover:scale-110 group-hover:text-blue-600" />
                  </button>
                );
              }) : (
                <div className="py-6 text-center">
                  <Inbox className="mx-auto mb-2 h-8 w-8 text-slate-200" />
                  <p className="text-sm font-semibold text-slate-400">Belum ada informasi</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* KOLOM KANAN — Ringkasan Otoritas & Sistem */}
        <div className="flex flex-col gap-5 xl:col-span-5">

          {/* Distribusi akun per jabatan */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20">
                <Users size={18} />
              </div>
              <div>
                <h3 className="text-base font-black tracking-tight text-slate-900">Distribusi Akun</h3>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Jumlah nyata per jabatan</p>
              </div>
            </div>
            <div className="space-y-3.5">
              {roleRows.map((row) => {
                const pct = totalUsers > 0 ? Math.round((row.count / totalUsers) * 100) : 0;
                return (
                <div key={row.key}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-600">{row.label}</span>
                    <span className="font-black tabular-nums text-slate-900">{row.count} ({pct}%)</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${totalUsers > 0 ? (row.count / totalUsers) * 100 : 0}%` }}
                      transition={{ duration: 0.7, ease: 'easeOut' }}
                      className={`h-full rounded-full ${row.count > 0 ? 'min-w-[6px] ' : ''}${row.tone}`}
                    />
                  </div>
                </div>
                );
              })}
            </div>
          </div>

          {/* Mode darurat + pencadangan */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-md transition-colors ${
                anyModeOn ? 'bg-gradient-to-br from-rose-500 to-red-600 shadow-rose-500/25' : 'bg-gradient-to-br from-slate-700 to-slate-900 shadow-slate-500/20'
              }`}>
                <Lock size={18} />
              </div>
              <div>
                <h3 className="text-base font-black tracking-tight text-slate-900">Status Sistem</h3>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Mode darurat & cadangan</p>
              </div>
            </div>

            <div className="space-y-2.5">
              {[
                { label: 'Mode Tidur (Sleep)', on: sleepOn, onTone: 'text-amber-600 bg-amber-50 ring-amber-200', dot: 'bg-amber-500' },
                { label: 'Maintenance Mode', on: maintenanceOn, onTone: 'text-rose-600 bg-rose-50 ring-rose-200', dot: 'bg-rose-500' },
                { label: 'Server Cleaning', on: cleaningOn, onTone: 'text-orange-600 bg-orange-50 ring-orange-200', dot: 'bg-orange-500' },
              ].map((m) => (
                <div key={m.label} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-2.5">
                  <span className="text-xs font-bold text-slate-600">{m.label}</span>
                  {m.on === null ? (
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Memuat…</span>
                  ) : (
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ring-1 ${
                      m.on ? `${m.onTone}` : 'bg-slate-100 text-slate-400 ring-slate-200'
                    }`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${m.on ? `${m.dot} animate-pulse` : 'bg-slate-300'}`} />
                      {m.on ? 'Aktif' : 'OFF'}
                    </span>
                  )}
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => onNavigate?.('security')}
              className="group mt-4 flex w-full items-center justify-between rounded-xl border border-slate-100 bg-white px-4 py-3.5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md"
            >
              <span className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                  <Database size={16} />
                </span>
                <span>
                  <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400">Riwayat Pencadangan</span>
                  <span className="block text-sm font-black text-slate-900">
                    {backups.length} arsip snapshot
                    {backups[0]?.createdAtLabel && (
                      <span className="ml-2 text-[10px] font-bold normal-case tracking-normal text-slate-400">
                        terakhir: {backups[0].createdAtLabel}
                      </span>
                    )}
                  </span>
                </span>
              </span>
              <ArrowUpRight size={16} className="text-slate-300 transition-all duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-indigo-600" />
            </button>
          </div>
        </div>
      </div>

      {/* ── BAWAH: Log Aktivitas Sistem (timeline real, dirapikan rounded-2xl) ── */}
      <div className="flex flex-col rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white shadow-md shadow-teal-500/20">
              <History size={18} />
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight text-slate-900">Log Aktivitas Sistem</h3>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Live Security Monitoring</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {loading && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-slate-400 ring-1 ring-slate-200">
                <Sparkles size={10} className="animate-spin" /> Sinkron…
              </span>
            )}
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
          </div>
        </div>

        <div className="relative flex-1 p-5 lg:p-6">
          <div className="relative mt-1">
            {displayedLogs.length > 0 && (
              <div className="absolute bottom-3 left-[19px] top-3 w-px bg-gradient-to-b from-indigo-200 via-slate-200 to-transparent" />
            )}

            <AnimatePresence mode="popLayout">
              {displayedLogs.length > 0 ? displayedLogs.map((log, i) => (
                <motion.div
                  layout
                  key={log.id || i}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ delay: Math.min(i * 0.03, 0.4), type: 'spring', stiffness: 220, damping: 24 }}
                  className="group/log relative rounded-xl py-3 pl-14 pr-3 transition-colors duration-200 hover:bg-slate-50/70"
                >
                  <div className="absolute left-3 top-1/2 flex -translate-y-1/2 items-center justify-center">
                    <div className={`z-10 h-2.5 w-2.5 rounded-full border-2 border-white transition-transform duration-200 group-hover/log:scale-125 ${
                      (log.type === 'auth' || log.type === 'security') ? 'bg-teal-400' : 'bg-indigo-400'
                    }`} />
                  </div>
                  <div className="flex min-w-0 items-center gap-4">
                    <div className={`shrink-0 transition-transform duration-300 group-hover/log:scale-110 ${
                      (log.type === 'auth' || log.type === 'security') ? 'text-teal-400' : 'text-indigo-400'
                    }`}>
                      {log.type === 'auth' ? <ShieldCheck size={18} /> : <Zap size={18} />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium leading-relaxed text-slate-600 transition-colors group-hover/log:text-slate-900">
                        <span className={`mr-2 font-black uppercase tracking-tight ${
                          (log.type === 'auth' || log.type === 'security') ? 'text-teal-600' : 'text-indigo-600'
                        }`}>{log.user_name || log.admin_name || 'System'}</span>
                        {log.description || log.action}
                      </p>
                      <div className="mt-1.5 flex items-center gap-3">
                        <span className={`rounded-md border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${
                          (log.type === 'auth' || log.type === 'security')
                            ? 'border-teal-100 bg-teal-50 text-teal-600'
                            : 'border-slate-100 bg-slate-50 text-slate-500'
                        }`}>{log.user_role || log.type || 'SYSTEM'}</span>
                        <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-slate-400 transition-colors group-hover/log:text-indigo-500">
                          <Clock size={11} /> {log.time_human || log.created_at}
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )) : (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 text-slate-300 ring-1 ring-slate-100">
                    <History size={26} />
                  </div>
                  <h4 className="text-sm font-black uppercase tracking-wide text-slate-700">Sistem Tenang</h4>
                  <p className="mt-1 text-[11px] font-bold uppercase tracking-widest text-slate-400">Belum Ada Aktivitas Terdeteksi</p>
                </div>
              )}
            </AnimatePresence>
          </div>

          {filteredLogs.length > initialLogLimit && (
            <div className="relative z-10 mt-6 flex justify-center">
              <button
                type="button"
                onClick={() => setShowAllLogs(!showAllLogs)}
                className="group flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-6 py-3 text-[10px] font-black uppercase tracking-widest text-slate-600 transition-all duration-200 hover:-translate-y-0.5 hover:border-transparent hover:bg-indigo-600 hover:text-white hover:shadow-lg hover:shadow-indigo-500/20"
              >
                {showAllLogs ? (
                  <>Sembunyikan Sebagian <ChevronDown size={15} className="rotate-180 transition-transform duration-300" /></>
                ) : (
                  <>Muat Lebih Banyak <ChevronDown size={15} className="transition-transform duration-300 group-hover:translate-y-0.5" /></>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── DETAIL VIEW PENGUMUMAN ── */}
      {selectedNews && createPortal(
        <AnimatePresence>
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedNews(null)}
              className="absolute inset-0 bg-slate-900/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            >
              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                <div className="mb-6 flex items-center justify-between">
                  <span className="rounded-full bg-blue-600 px-3.5 py-1.5 text-[10px] font-black uppercase tracking-widest text-white">
                    {selectedNews.category || 'Informasi'}
                  </span>
                  <button onClick={() => setSelectedNews(null)} className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100">
                    <X size={22} />
                  </button>
                </div>

                <h2 className="mb-5 text-2xl font-black leading-tight text-slate-900">{selectedNews.title}</h2>

                <div
                  className="prose prose-slate mb-7 max-w-none text-sm leading-relaxed text-slate-600"
                  dangerouslySetInnerHTML={{ __html: selectedNews.content }}
                />

                {(selectedNews.images && selectedNews.images.length > 0) || selectedNews.image_url || selectedNews.image_path ? (
                  <div className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {(selectedNews.images && selectedNews.images.length > 0) ? (
                      selectedNews.images.map((img, i) => (
                        <div key={i} className="aspect-video overflow-hidden rounded-xl border border-slate-100 bg-slate-50 shadow-sm">
                          <img src={img.url || img} alt="" className="h-full w-full object-cover" />
                        </div>
                      ))
                    ) : (selectedNews.image_url || selectedNews.image_path) ? (
                      <div className="col-span-full aspect-video overflow-hidden rounded-xl border border-slate-100 bg-slate-50 shadow-sm">
                        <img src={selectedNews.image_url || `http://localhost:8000/storage/${selectedNews.image_path}`} alt="" className="h-full w-full object-cover" />
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {selectedNews.attachment && (
                  <div className="mb-7 flex items-center justify-between rounded-xl border border-blue-100 bg-blue-50/50 p-5 transition-all hover:bg-blue-50">
                    <div className="flex items-center gap-3.5">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-100">
                        <FileText size={18} />
                      </div>
                      <div className="flex flex-col">
                        <span className="mb-0.5 text-[10px] font-black uppercase tracking-widest text-blue-600/60">Lampiran Dokumen</span>
                        <span className="max-w-[200px] truncate text-sm font-bold text-slate-700">{selectedNews.attachment.name || 'Dokumen Terlampir'}</span>
                      </div>
                    </div>
                    <a
                      href={selectedNews.attachment.url || `http://localhost:8000/storage/${selectedNews.attachment.path}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg border border-blue-100 bg-white px-4 py-2 text-[10px] font-black uppercase tracking-widest text-blue-600 shadow-sm transition-all hover:bg-blue-600 hover:text-white"
                    >
                      Buka File
                    </a>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 p-6">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Dipublikasikan Oleh</span>
                  <span className="text-xs font-bold uppercase tracking-tight text-slate-600">
                    {selectedNews.author_role || selectedNews.author?.name || selectedNews.author || 'Admin Sekolah'}
                  </span>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setSelectedNews(null)}
                    className="rounded-xl border border-slate-200 bg-white px-6 py-2.5 text-xs font-black uppercase tracking-widest text-slate-600 transition-all hover:bg-slate-200"
                  >
                    Tutup
                  </button>
                  <button
                    onClick={() => handleDeleteNews(selectedNews.id)}
                    disabled={isDeleting}
                    className="rounded-xl bg-rose-600 px-6 py-2.5 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-rose-100 transition-all hover:bg-rose-700 disabled:opacity-50"
                  >
                    {isDeleting ? 'Menghapus...' : 'Hapus Informasi'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        </AnimatePresence>,
        document.body
      )}

      {/* ── KONFIRMASI HAPUS INFORMASI ── */}
      <AnimatePresence>
        {confirmModal.show && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmModal({ show: false, id: null })}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md rounded-2xl border border-slate-100 bg-white p-8 shadow-2xl"
            >
              <div className="absolute left-0 top-0 h-1.5 w-full rounded-t-2xl bg-rose-500" />
              <div className="flex flex-col items-center text-center">
                <div className="mb-6 rounded-xl bg-rose-50 p-4 text-rose-500">
                  <X size={30} />
                </div>
                <h3 className="mb-3 text-xl font-black text-slate-900">Hapus Informasi?</h3>
                <p className="mb-7 leading-relaxed text-slate-500">
                  Apakah Anda yakin ingin menghapus informasi ini secara permanen? Tindakan ini tidak dapat dibatalkan.
                </p>
                <div className="flex w-full gap-3">
                  <button
                    onClick={() => setConfirmModal({ show: false, id: null })}
                    className="flex-1 rounded-xl bg-slate-100 px-6 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-600 transition-all hover:bg-slate-200"
                  >
                    Batal
                  </button>
                  <button
                    onClick={() => executeDeleteNews(confirmModal.id)}
                    className="flex-1 rounded-xl bg-rose-600 px-6 py-3.5 text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-rose-200 transition-all hover:bg-rose-700"
                  >
                    Yakin, Hapus
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SummaryTab;
