import { useState, useEffect, useRef } from 'react';
import { FileText, Download, Trash2, Plus, Loader2, AlertTriangle, CheckCircle2, XCircle, FolderOpen } from 'lucide-react';
import { cashierAPI } from '../../../utils/api';

// ─── Helpers ────────────────────────────────────────────────────────────────

function generateMonthOptions() {
  const options = [];
  const now = new Date();
  // Mulai dari Januari 2024 sampai bulan sekarang
  const start = new Date(2024, 0, 1);
  const current = new Date(now.getFullYear(), now.getMonth(), 1);

  const d = new Date(start);
  while (d <= current) {
    const bulan = String(d.getMonth() + 1).padStart(2, '0');
    const tahun = String(d.getFullYear());
    const label = d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    options.push({ value: `${tahun}-${bulan}`, label, bulan, tahun });
    d.setMonth(d.getMonth() + 1);
  }

  // Default: bulan sebelumnya (karena bulan berjalan belum selesai)
  options.reverse();
  return options;
}

function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast.visible) return;
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [toast.visible]);

  if (!toast.visible) return null;

  const isSuccess = toast.type === 'success';
  const isError   = toast.type === 'error';

  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-start gap-3 px-5 py-4 rounded-2xl shadow-2xl border max-w-sm transition-all
      ${isSuccess ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : ''}
      ${isError   ? 'bg-red-50 border-red-200 text-red-800' : ''}
      ${!isSuccess && !isError ? 'bg-white border-slate-200 text-slate-800' : ''}
    `}>
      {isSuccess && <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />}
      {isError   && <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />}
      <p className="text-sm font-semibold leading-snug">{toast.message}</p>
    </div>
  );
}

// ─── Modal Loading Generate ──────────────────────────────────────────────────

function ModalLoading({ visible, bulanLabel, format, onClose }) {
  if (!visible) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-800">
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
            <span className="text-sm font-black text-white uppercase tracking-widest">Memproses Laporan</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <XCircle className="w-5 h-5" />
          </button>
        </div>
        {/* Body */}
        <div className="p-6">
          <div className="bg-slate-50 rounded-xl p-5 border border-slate-100 text-center space-y-3">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto" />
            <p className="text-sm font-semibold text-slate-700">
              Sedang membuat laporan {bulanLabel} dalam format {format === 'excel' ? 'Excel' : 'PDF'}...
            </p>
            <p className="text-xs text-slate-500">Mohon tunggu, proses ini membutuhkan beberapa detik.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Modal Konfirmasi Hapus ──────────────────────────────────────────────────

function ModalHapus({ laporan, onConfirm, onCancel, loading }) {
  if (!laporan) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-amber-600">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-white" />
            <span className="text-sm font-black text-white uppercase tracking-widest">Hapus Laporan</span>
          </div>
          <button onClick={onCancel} className="text-amber-200 hover:text-white transition-colors">
            <XCircle className="w-5 h-5" />
          </button>
        </div>
        {/* Body */}
        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-700 font-medium">Yakin akan menghapus file laporan ini?</p>

          {/* Detail file */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-1.5 text-sm">
            <div className="flex gap-2"><span className="text-slate-500 w-28 flex-shrink-0">Nama File</span><span className="font-semibold text-slate-800">: {laporan.nama_file}</span></div>
            <div className="flex gap-2"><span className="text-slate-500 w-28 flex-shrink-0">Bulan</span><span className="font-semibold text-slate-800">: {laporan.bulan_label}</span></div>
            <div className="flex gap-2"><span className="text-slate-500 w-28 flex-shrink-0">Format</span><span className="font-semibold text-slate-800">: {laporan.format_label}</span></div>
            <div className="flex gap-2"><span className="text-slate-500 w-28 flex-shrink-0">Ukuran</span><span className="font-semibold text-slate-800">: {laporan.ukuran}</span></div>
            <div className="flex gap-2"><span className="text-slate-500 w-28 flex-shrink-0">Dibuat</span><span className="font-semibold text-slate-800">: {laporan.tanggal_generate}</span></div>
          </div>

          {/* Peringatan */}
          <div className="bg-amber-50 rounded-xl p-3 border border-amber-100 space-y-1">
            <div className="flex items-center gap-1.5 text-amber-700 font-bold text-xs uppercase tracking-wide">
              <AlertTriangle className="w-3.5 h-3.5" /> Peringatan
            </div>
            <ul className="text-xs text-amber-700 space-y-0.5 pl-1">
              <li>• File yang dihapus tidak dapat dikembalikan</li>
              <li>• Anda bisa membuat ulang laporan kapan saja</li>
            </ul>
          </div>

          {/* Tombol */}
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={onCancel}
              disabled={loading}
              className="px-6 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold text-sm hover:bg-slate-200 transition-all disabled:opacity-50"
            >
              Batal
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-red-500 text-white font-bold text-sm hover:bg-red-600 transition-all disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Ya, Hapus
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function LaporanBulananTab() {
  const monthOptions = generateMonthOptions();

  const [selectedMonth, setSelectedMonth] = useState(monthOptions[1]?.value || monthOptions[0]?.value || '');
  const [format, setFormat]               = useState('excel');
  const [generating, setGenerating]       = useState(false);
  const [arsip, setArsip]                 = useState([]);
  const [loadingArsip, setLoadingArsip]   = useState(true);
  const [hapusTarget, setHapusTarget]     = useState(null);
  const [hapusLoading, setHapusLoading]   = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [toast, setToast]                 = useState({ visible: false, message: '', type: 'success' });

  const notify = (message, type = 'success') => setToast({ visible: true, message, type });
  const dismissToast = () => setToast(prev => ({ ...prev, visible: false }));

  // Load arsip
  const loadArsip = async () => {
    try {
      setLoadingArsip(true);
      const res = await cashierAPI.getMonthlyReports();
      setArsip(res.data.data || []);
    } catch {
      // silent
    } finally {
      setLoadingArsip(false);
    }
  };

  useEffect(() => { loadArsip(); }, []);

  // Generate laporan
  const handleGenerate = async () => {
    if (!selectedMonth) {
      notify('Pilih bulan/tahun untuk laporan.', 'error');
      return;
    }

    const opt = monthOptions.find(o => o.value === selectedMonth);
    if (!opt) return;

    setGenerating(true);
    try {
      const res = await cashierAPI.generateMonthlyReport({
        bulan: opt.bulan,
        tahun: opt.tahun,
        format,
      });

      // Trigger download
      const blob = new Blob([res.data], {
        type: format === 'excel'
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'application/pdf',
      });
      const url  = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href  = url;

      // Ambil nama file dari header jika ada
      const contentDisposition = res.headers?.['content-disposition'] || '';
      const match = contentDisposition.match(/filename="?([^"]+)"?/);
      link.download = match ? match[1] : `Laporan_Bulanan_${opt.label}.${format === 'excel' ? 'xlsx' : 'pdf'}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      notify('Laporan berhasil digenerate. File telah diunduh secara otomatis. Laporan tersimpan di arsip.');
      await loadArsip();
    } catch (err) {
      const msg = err?.response?.data?.message || '';
      if (msg.includes('Tidak ada data')) {
        notify('Tidak ada data transaksi untuk bulan tersebut.', 'error');
      } else {
        notify('Gagal membuat laporan. Coba lagi.', 'error');
      }
    } finally {
      setGenerating(false);
    }
  };

  // Download dari arsip
  const handleDownload = async (laporan) => {
    setDownloadingId(laporan.id);
    try {
      const res = await cashierAPI.downloadMonthlyReport(laporan.id);
      const blob = new Blob([res.data], {
        type: laporan.format === 'excel'
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'application/pdf',
      });
      const url  = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href  = url;
      link.download = laporan.nama_file;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      notify('File berhasil diunduh.');
    } catch {
      notify('File tidak ditemukan di server.', 'error');
    } finally {
      setDownloadingId(null);
    }
  };

  // Hapus laporan
  const handleHapusConfirm = async () => {
    if (!hapusTarget) return;
    setHapusLoading(true);
    try {
      await cashierAPI.deleteMonthlyReport(hapusTarget.id);
      notify('Laporan berhasil dihapus.');
      setHapusTarget(null);
      await loadArsip();
    } catch {
      notify('File tidak ditemukan di server.', 'error');
    } finally {
      setHapusLoading(false);
    }
  };

  const selectedOpt = monthOptions.find(o => o.value === selectedMonth);

  return (
    <div className="space-y-6 pb-20 animate-fadeIn">
      <Toast toast={toast} onClose={dismissToast} />

      <ModalLoading
        visible={generating}
        bulanLabel={selectedOpt?.label || ''}
        format={format}
        onClose={() => {}}
      />

      <ModalHapus
        laporan={hapusTarget}
        onConfirm={handleHapusConfirm}
        onCancel={() => setHapusTarget(null)}
        loading={hapusLoading}
      />

      {/* ── Card Generate Laporan Baru ── */}
      <div
        className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100"
        style={{ marginBottom: 20 }}
      >
        {/* Card Header */}
        <div className="flex items-center gap-2 mb-4">
          <div className="w-5 h-5 rounded bg-blue-500 flex items-center justify-center flex-shrink-0">
            <Plus className="w-3 h-3 text-white" />
          </div>
          <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest">Generate Laporan Baru</h2>
        </div>

        <div className="space-y-4">
          {/* Pilih Bulan/Tahun */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Pilih Bulan/Tahun
            </label>
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              disabled={generating}
              className="block rounded-lg border border-[#D1D5DB] text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50"
              style={{ width: 250, padding: '8px 12px', borderRadius: 6 }}
            >
              {monthOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Format Laporan */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Format Laporan</label>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="format"
                  value="excel"
                  checked={format === 'excel'}
                  onChange={() => setFormat('excel')}
                  disabled={generating}
                  className="w-4 h-4 accent-blue-500"
                />
                <span className="text-sm text-slate-700 font-medium">Excel (.xlsx)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="format"
                  value="pdf"
                  checked={format === 'pdf'}
                  onChange={() => setFormat('pdf')}
                  disabled={generating}
                  className="w-4 h-4 accent-blue-500"
                />
                <span className="text-sm text-slate-700 font-medium">PDF (.pdf)</span>
              </label>
            </div>
          </div>

          {/* Tombol Generate */}
          <button
            onClick={handleGenerate}
            disabled={generating || !selectedMonth}
            className="flex items-center gap-2 text-white font-bold text-sm rounded-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: generating ? '#9CA3AF' : '#10B981',
              padding: '10px 24px',
              borderRadius: 8,
              marginTop: 16,
              border: 'none',
              cursor: generating ? 'not-allowed' : 'pointer',
            }}
            onMouseEnter={e => { if (!generating) e.currentTarget.style.background = '#059669'; }}
            onMouseLeave={e => { if (!generating) e.currentTarget.style.background = '#10B981'; }}
          >
            {generating
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Memproses...</>
              : <><FileText className="w-4 h-4" /> Generate Laporan</>
            }
          </button>
        </div>
      </div>

      {/* ── Card Arsip Laporan Sebelumnya ── */}
      <div
        className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100"
      >
        {/* Card Header */}
        <div className="flex items-center gap-2 mb-4">
          <div className="w-5 h-5 rounded bg-amber-500 flex items-center justify-center flex-shrink-0">
            <FolderOpen className="w-3 h-3 text-white" />
          </div>
          <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest">Arsip Laporan Sebelumnya</h2>
        </div>

        {loadingArsip ? (
          <div className="flex items-center justify-center py-10 gap-2 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Memuat arsip...</span>
          </div>
        ) : arsip.length === 0 ? (
          <div className="text-center py-10" style={{ color: '#6B7280', padding: 40 }}>
            <FolderOpen className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Belum ada laporan yang digenerate.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                  {['No', 'Nama File', 'Bulan/Tahun', 'Format', 'Tanggal Generate', 'Ukuran', 'Aksi'].map(h => (
                    <th
                      key={h}
                      style={{
                        padding: 12,
                        textAlign: 'left',
                        fontSize: 14,
                        fontWeight: 'bold',
                        color: '#1F2937',
                        borderBottom: '1px solid #E5E7EB',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {arsip.map((lap, idx) => (
                  <ArsipRow
                    key={lap.id}
                    lap={lap}
                    idx={idx}
                    onDownload={handleDownload}
                    onHapus={setHapusTarget}
                    downloadingId={downloadingId}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Arsip Row ───────────────────────────────────────────────────────────────

function ArsipRow({ lap, idx, onDownload, onHapus, downloadingId }) {
  const [hovered, setHovered] = useState(false);
  const isDownloading = downloadingId === lap.id;

  return (
    <tr
      style={{
        borderBottom: '1px solid #E5E7EB',
        background: hovered ? '#F9FAFB' : 'white',
        transition: 'background 0.15s',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <td style={{ padding: 12, fontSize: 13, color: '#6B7280' }}>{idx + 1}</td>
      <td style={{ padding: 12, fontSize: 13, color: '#1F2937', fontWeight: 600, maxWidth: 220 }}>
        <span className="truncate block" title={lap.nama_file}>{lap.nama_file}</span>
      </td>
      <td style={{ padding: 12, fontSize: 13, color: '#374151', whiteSpace: 'nowrap' }}>{lap.bulan_label}</td>
      <td style={{ padding: 12, fontSize: 13 }}>
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold
          ${lap.format === 'excel' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {lap.format_label}
        </span>
      </td>
      <td style={{ padding: 12, fontSize: 13, color: '#6B7280', whiteSpace: 'nowrap' }}>{lap.tanggal_generate}</td>
      <td style={{ padding: 12, fontSize: 13, color: '#6B7280', whiteSpace: 'nowrap' }}>{lap.ukuran}</td>
      <td style={{ padding: 12 }}>
        <div className="flex items-center gap-2">
          {/* Tombol Download */}
          <button
            onClick={() => onDownload(lap)}
            disabled={isDownloading}
            title="Download file laporan"
            className="flex items-center justify-center w-8 h-8 rounded-lg transition-all disabled:opacity-50"
            style={{ background: '#3B82F6', color: 'white', border: 'none', cursor: 'pointer' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#2563EB'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#3B82F6'; }}
          >
            {isDownloading
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Download className="w-3.5 h-3.5" />
            }
          </button>
          {/* Tombol Hapus */}
          <button
            onClick={() => onHapus(lap)}
            title="Hapus file dari server"
            className="flex items-center justify-center w-8 h-8 rounded-lg transition-all"
            style={{ background: '#EF4444', color: 'white', border: 'none', cursor: 'pointer' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#DC2626'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#EF4444'; }}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}
