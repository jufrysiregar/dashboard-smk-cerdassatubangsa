import { motion } from 'framer-motion';
import {
  ArrowDownRight,
  Clock,
  ArrowUpRight,
  BadgeDollarSign,
  Banknote,
  ClipboardCheck,
  GraduationCap,
  Landmark,
  Receipt,
  ShieldCheck,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const formatCurrency = (value) => new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
}).format(Number(value || 0));

const formatWaktu = (value) => {
  if (!value) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(value));
};

const METHOD_LABEL = { cash: 'Tunai', transfer: 'Transfer', qris: 'QRIS', beasiswa: 'Beasiswa', adjustment: 'Beasiswa' };
const methodLabel = (value) => METHOD_LABEL[value] || String(value || '-');

const KPI_GRAD = {
  emerald: 'from-emerald-600 to-teal-500',
  rose: 'from-rose-600 to-pink-600',
  amber: 'from-amber-500 to-orange-600',
  blue: 'from-blue-600 to-indigo-600',
};

const KpiCard = ({ grad, icon: Icon, watermark: WIcon, value, label, sub, footer, onClick, delay = 0 }) => (
  <motion.div
    type="button"
    onClick={onClick}
    initial={{ opacity: 0, y: 18 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, delay }}
    className={`group relative flex flex-col overflow-hidden rounded-2xl bg-gradient-to-br ${grad} p-5 text-left text-white shadow-lg transition-all duration-300 ${onClick ? 'cursor-pointer hover:-translate-y-1 hover:shadow-xl' : 'cursor-default'}`}
  >
    <WIcon className="pointer-events-none absolute -bottom-4 -right-4 h-28 w-28 rotate-12 opacity-15 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6" />
    <div className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-white/20 ring-1 ring-inset ring-white/30 backdrop-blur-sm">
      <Icon className="h-6 w-6" />
    </div>
    <p className="relative mt-3 text-[26px] font-black leading-none tracking-tight">{value}</p>
    <p className="relative mt-1.5 text-[11px] font-black uppercase tracking-widest text-white/85">{label}</p>
    {sub && <p className="relative mt-0.5 text-[11px] font-medium text-white/75">{sub}</p>}
    {footer && <div className="relative mt-3">{footer}</div>}
  </motion.div>
);

export default function CashierDashboardKeuangan({ dashboard, announcements = [], goToGroup, clock, user }) {
  const summary = dashboard?.summary || {};
  const recap = dashboard?.recap || {};
  const identity = dashboard?.identity || {};
  const trend = Array.isArray(dashboard?.monthly_trend) ? dashboard.monthly_trend : [];
  const feed = Array.isArray(dashboard?.recent_transactions) ? dashboard.recent_transactions : [];
  const composition = Array.isArray(dashboard?.payment_composition) ? dashboard.payment_composition : [];
  const hasTrend = trend.some((t) => Number(t.income) > 0 || Number(t.expense) > 0);
  const hasComposition = composition.length > 0 && composition.some((c) => Number(c.amount) > 0);
  const compTotal = composition.reduce((sum, c) => sum + Number(c.amount || 0), 0);
  const DONUT_COLORS = { cash: '#10B981', qris: '#8B5CF6', transfer: '#3B82F6', beasiswa: '#F59E0B' };
  const donutColor = (method, i) => DONUT_COLORS[method] || ['#64748b', '#0EA5E9', '#EC4899', '#14B8A6'][i % 4];
  const roleLabel = { cashier: 'Petugas Kasir', kepala_sekolah: 'Kepala Sekolah', wakil_sekolah: 'Wakil Kepala Sekolah', operator: 'Operator', admin_akademik: 'Admin Akademik' };

  return (
    <div className="space-y-6">
      {/* HERO — gradien terang merah→putih (gaya Portal Guru, aksen merah), tanpa tombol & tanpa filter */}
      <section className="relative overflow-hidden rounded-[2rem] border border-red-100 bg-[radial-gradient(circle_at_top_left,rgba(239,68,68,0.16),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(244,63,94,0.12),transparent_28%),linear-gradient(135deg,#ffffff_0%,#fef2f2_100%)] p-6 shadow-xl xl:p-8">
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-red-700">
              <GraduationCap className="h-3 w-3" /> Portal Cashier &amp; Finance School Center
            </div>
            <h2 className="text-4xl font-black tracking-tight text-slate-950 xl:text-5xl">Dashboard Keuangan &amp; Arus Kas</h2>
          </div>
          <div className="rounded-2xl border border-red-100 bg-white/80 px-4 py-3 shadow-sm lg:shrink-0">
            <p className="text-[11px] font-black uppercase tracking-widest text-red-500">Periode Aktif</p>
            <p className="mt-1 text-[15px] font-black text-slate-900">T.A. {identity.tahun_ajaran || '—'}</p>
            <p className="mt-0.5 text-[12px] font-medium text-slate-500">
              Semester {identity.semester || '—'}{clock?.date ? ` · ${clock.day}, ${clock.date}` : ''}
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-[12px] font-bold text-slate-600">
              <Clock className="h-4 w-4 text-red-500" />
              <span className="tabular-nums">{clock?.time || '00:00:00'}</span>
              <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">WIB</span>
            </p>
          </div>
        </div>
      </section>

      {/* 4 KPI GRADIEN */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          grad={KPI_GRAD.emerald}
          icon={ArrowUpRight}
          watermark={Banknote}
          value={formatCurrency(summary.today_income || 0)}
          label="Pemasukan Hari Ini"
          footer={(
            <div className="flex flex-col gap-1 text-[11px] font-medium text-white/85">
              <span className="flex items-center justify-between rounded-lg bg-white/15 px-2.5 py-1">
                <span>Petugas aktif</span>
                <span className="font-black">{formatCurrency(summary.today_income_petugas || 0)} · {summary.today_transactions_petugas || 0} trx</span>
              </span>
              <span className="flex items-center justify-between rounded-lg bg-white/10 px-2.5 py-1">
                <span>Total sekolah</span>
                <span className="font-black">{formatCurrency(summary.today_income || 0)}</span>
              </span>
            </div>
          )}
        />

        <KpiCard
          grad={KPI_GRAD.rose}
          icon={ArrowDownRight}
          watermark={Receipt}
          value={formatCurrency(summary.total_tunggakan_aktif || 0)}
          label="Total Tunggakan Aktif"
          sub={`${summary.tunggakan_siswa_aktif || 0} siswa belum lunas`}
          onClick={() => goToGroup('billing_arrears', 'arrears')}
          delay={0.075}
        />

        <KpiCard
          grad={KPI_GRAD.amber}
          icon={ClipboardCheck}
          watermark={BadgeDollarSign}
          value={summary.pending_verifications || 0}
          label="Antrean Verifikasi Transfer"
          sub="Bukti bayar siswa menunggu ACC"
          onClick={() => goToGroup('payment_verification', 'verifications')}
          delay={0.15}
        />

        <KpiCard
          grad={KPI_GRAD.blue}
          icon={Landmark}
          watermark={Wallet}
          value={formatCurrency(summary.current_balance || 0)}
          label="Saldo Kas & Dana Sekolah"
          sub={`Kas kecil: ${formatCurrency(recap.petty_cash_balance || 0)}`}
          delay={0.225}
        />
      </div>

      {/* GRAFIK: ARUS KAS (2 kolom) + DONUT KOMPOSISI (1 kolom) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md">
              <TrendingUp className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">Arus Kas Bulanan (6 Bulan)</h3>
          </div>
          {hasTrend ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trend} margin={{ top: 5, right: 10, left: -14, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gIn" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#34d399" /><stop offset="100%" stopColor="#0d9488" /></linearGradient>
                    <linearGradient id="gOut" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fb7185" /><stop offset="100%" stopColor="#e11d48" /></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748b', fontWeight: 700 }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${Math.round(v / 1000)}rb`} />
                  <Tooltip formatter={(v) => formatCurrency(v)} contentStyle={{ borderRadius: 14, border: '1px solid #e2e8f0', fontSize: 12, fontWeight: 700 }} />
                  <Legend wrapperStyle={{ fontSize: 12, fontWeight: 700 }} />
                  <Bar dataKey="income" name="Pemasukan" fill="url(#gIn)" radius={[6, 6, 0, 0]} maxBarSize={26} isAnimationActive={false} />
                  <Bar dataKey="expense" name="Pengeluaran" fill="url(#gOut)" radius={[6, 6, 0, 0]} maxBarSize={26} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-64 flex-col items-center justify-center text-center">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
                <Wallet className="h-6 w-6 text-slate-300" />
              </div>
              <p className="text-sm font-black text-slate-700">Belum ada data transaksi untuk ditampilkan</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">Grafik arus kas muncul setelah ada pemasukan/pengeluaran tercatat.</p>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-1">
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md">
              <BadgeDollarSign className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">Komposisi Pembayaran</h3>
          </div>
          {hasComposition ? (
            <>
              <div className="relative h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={composition}
                      dataKey="amount"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      innerRadius={54}
                      outerRadius={80}
                      paddingAngle={3}
                      isAnimationActive={false}
                    >
                      {composition.map((entry, i) => (
                        <Cell key={i} fill={donutColor(entry.method, i)} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v, name) => [formatCurrency(v), name]}
                      contentStyle={{ borderRadius: 14, border: '1px solid #e2e8f0', fontSize: 12, fontWeight: 700 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-lg font-black text-slate-900">{formatCurrency(compTotal)}</span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Masuk</span>
                </div>
              </div>
              <div className="mt-3 space-y-1.5">
                {composition.map((c, i) => (
                  <div key={c.method} className="flex items-center justify-between gap-2 text-xs">
                    <span className="flex items-center gap-2 font-semibold text-slate-600">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: donutColor(c.method, i) }} />
                      {c.label}
                    </span>
                    <span className="tabular-nums text-slate-500">
                      <span className="font-black text-slate-800">{c.percent}%</span> · {formatCurrency(c.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex h-52 flex-col items-center justify-center text-center">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
                <Wallet className="h-6 w-6 text-slate-300" />
              </div>
              <p className="text-sm font-black text-slate-700">Belum ada data transaksi untuk ditampilkan</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">Komposisi metode bayar muncul setelah ada pembayaran tercatat.</p>
            </div>
          )}
        </div>
      </div>

      {/* LIVE AUDIT FEED — full width */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-teal-500 text-white shadow-md">
                <Receipt className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">Live Audit Feed · 10 Transaksi Terakhir</h3>
            </div>
            <button
              type="button"
              onClick={() => goToGroup('payment_verification', 'history')}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-black uppercase tracking-widest text-slate-500 transition hover:bg-slate-50"
            >
              Buka Riwayat
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-[11px] uppercase tracking-widest text-slate-500">
                  <th className="px-4 py-3 text-left font-bold">Kuitansi</th>
                  <th className="px-4 py-3 text-left font-bold">Siswa / Keterangan</th>
                  <th className="px-4 py-3 text-center font-bold">Metode</th>
                  <th className="px-4 py-3 text-right font-bold">Nominal</th>
                  <th className="px-4 py-3 text-left font-bold">Waktu</th>
                  <th className="px-4 py-3 text-left font-bold">Petugas</th>
                </tr>
              </thead>
              <tbody>
                {feed.length ? feed.slice(0, 10).map((tx) => (
                  <tr key={tx.id} className="border-t border-slate-50 hover:bg-slate-50/60">
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{tx.receipt_code || tx.transaction_code || '-'}</td>
                    <td className="px-4 py-3">
                      <p className="font-bold text-slate-800">{tx.student?.name || tx.title || '-'}</p>
                      {tx.billing?.title && <p className="text-[11px] text-slate-400">{tx.billing.title}</p>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-block rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-slate-600">
                        {methodLabel(tx.payment_method || tx.channel)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-black text-slate-900">{formatCurrency(tx.amount)}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{formatWaktu(tx.transaction_date)}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-600">{tx.petugas || '-'}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-400">
                      <Users className="mx-auto mb-2 h-6 w-6 text-slate-300" />
                      Belum ada transaksi tercatat.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      {/* Kabar singkat (opsional, read-only) */}
      {announcements.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">Informasi Terbaru</h3>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('navigateDashboard', { detail: 'news' }))}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-black uppercase tracking-widest text-slate-500 transition hover:bg-slate-50"
            >
              Pusat Informasi
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {announcements.slice(0, 3).map((info) => (
              <div key={info.id} className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                <p className="truncate text-sm font-black text-slate-900">{info.title}</p>
                <p className="mt-1 line-clamp-2 text-xs text-slate-500">{(info.content || '').replace(/<[^>]*>?/gm, '')}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
