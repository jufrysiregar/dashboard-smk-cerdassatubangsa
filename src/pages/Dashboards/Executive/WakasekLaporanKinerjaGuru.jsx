import React, { useState, useMemo } from 'react';
import { Filter, Eye, Download, X, MessageSquare, AlertCircle } from 'lucide-react';
import SectionLoading from '../../../components/dashboard/shared/SectionLoading';

const EmptyState = ({ message }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <AlertCircle className="w-10 h-10 text-slate-200 mb-3" />
    <p className="text-sm font-bold text-slate-400">{message}</p>
  </div>
);

const WakasekLaporanKinerjaGuru = ({ stats: parentStats }) => {
  const [filters, setFilters] = useState({ mapel: 'all' });
  const [catatanModal, setCatatanModal] = useState(null);
  const [catatanInput, setCatatanInput] = useState('');
  const [catatanMap, setCatatanMap] = useState({});
  const [detailModal, setDetailModal] = useState(null);

  const loading = !parentStats;

  const data = useMemo(() => {
    if (!parentStats) return [];
    const exec = parentStats?.executive || {};
    const teacherPerf = exec?.staffing?.teaching_performance || [];
    const teacherPresence = exec?.academics?.teacher_presence || [];

    if (teacherPerf.length > 0) {
      return teacherPerf.map(t => ({
        id: t.teacher_id || t.teacher_name,
        nama: t.teacher_name,
        mapel: t.subject || '-',
        rataRata: t.average_score ?? null,
        kehadiran: t.attendance_rate ? `${parseFloat(t.attendance_rate).toFixed(1)}%` : '-',
        tugas: t.teaching_sessions || '-',
        latestAssessment: t.latest_assessment || null,
      }));
    }
    return teacherPresence.map(t => ({
      id: t.teacher_id || t.teacher_name,
      nama: t.teacher_name,
      mapel: '-',
      rataRata: null,
      kehadiran: t.attendance_rate ? `${parseFloat(t.attendance_rate).toFixed(1)}%` : '-',
      tugas: t.teaching_sessions || '-',
      latestAssessment: null,
    }));
  }, [parentStats]);

  const mapelOptions = useMemo(() => [...new Set(data.map(d => d.mapel).filter(m => m && m !== '-'))], [data]);
  const filteredData = useMemo(() => data.filter(d => filters.mapel === 'all' || d.mapel === filters.mapel), [data, filters]);

  const handleSimpanCatatan = () => {
    if (!catatanInput.trim()) return;
    setCatatanMap(prev => ({ ...prev, [catatanModal.id]: catatanInput.trim() }));
    setCatatanInput('');
    setCatatanModal(null);
  };

  const handleEkspor = () => {
    if (!filteredData.length) return;
    const rows = filteredData.map(r => ({
      NamaGuru: r.nama, Mapel: r.mapel,
      RataRataNilai: r.rataRata ?? 'N/A', Kehadiran: r.kehadiran,
      JumlahTugas: r.tugas, CatatanWakasek: catatanMap[r.id] || '-',
    }));
    const headers = Object.keys(rows[0]);
    const csv = [headers.join(','), ...rows.map(r => headers.map(h => `"${r[h] ?? ''}"`).join(','))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `laporan-kinerja-guru-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <SectionLoading loading={true} label="Memuat data kinerja guru..." />;

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex flex-wrap gap-3">
          {mapelOptions.length > 0 && (
            <label className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl">
              <Filter className="w-4 h-4 text-slate-500" />
              <select value={filters.mapel} onChange={e => setFilters({ ...filters, mapel: e.target.value })} className="bg-transparent outline-none text-sm font-bold text-slate-700">
                <option value="all">Semua Mapel</option>
                {mapelOptions.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </label>
          )}
        </div>
        <button onClick={handleEkspor} disabled={!filteredData.length} className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-200 disabled:text-slate-400 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-colors shadow-sm">
          <Download className="w-4 h-4" /> Ekspor Data
        </button>
      </div>

      {/* Tabel */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {filteredData.length === 0 ? (
          <EmptyState message="Belum ada data kinerja guru saat ini. Data akan muncul setelah guru melakukan presensi dan penilaian performa tersedia." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-slate-100">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-black text-slate-600 uppercase tracking-wider">Nama Guru</th>
                  <th className="px-6 py-4 text-left text-xs font-black text-slate-600 uppercase tracking-wider">Mapel</th>
                  <th className="px-6 py-4 text-left text-xs font-black text-slate-600 uppercase tracking-wider">Rata-rata Nilai</th>
                  <th className="px-6 py-4 text-left text-xs font-black text-slate-600 uppercase tracking-wider">Kehadiran</th>
                  <th className="px-6 py-4 text-left text-xs font-black text-slate-600 uppercase tracking-wider">Jumlah Tugas</th>
                  <th className="px-6 py-4 text-left text-xs font-black text-slate-600 uppercase tracking-wider">Catatan Wakasek</th>
                  <th className="px-6 py-4 text-left text-xs font-black text-slate-600 uppercase tracking-wider">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredData.map((row, idx) => (
                  <tr key={row.id || idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    <td className="px-6 py-4 text-sm font-bold text-slate-900">{row.nama}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{row.mapel}</td>
                    <td className="px-6 py-4 text-sm font-bold text-slate-900">
                      {row.rataRata != null ? row.rataRata : <span className="text-slate-400 font-normal italic">N/A</span>}
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-slate-900">{row.kehadiran}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{row.tugas}</td>
                    <td className="px-6 py-4 text-sm text-slate-600 max-w-xs truncate">
                      {catatanMap[row.id] || <span className="italic text-slate-300">-</span>}
                    </td>
                    <td className="px-6 py-4 flex flex-wrap gap-2">
                      <button onClick={() => { setCatatanModal(row); setCatatanInput(catatanMap[row.id] || ''); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-xs font-bold transition-colors shadow-sm">
                        <MessageSquare className="w-3.5 h-3.5" /> Beri Catatan
                      </button>
                      <button onClick={() => setDetailModal(row)} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg text-xs font-bold transition-colors shadow-sm">
                        <Eye className="w-3.5 h-3.5" /> Detail
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Detail */}
      {detailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-900">Detail Kinerja — {detailModal.nama}</h3>
              <button onClick={() => setDetailModal(null)} className="p-2 hover:bg-slate-100 rounded-xl"><X className="w-5 h-5 text-slate-500" /></button>
            </div>
            <div className="p-6 space-y-3">
              {[
                { label: 'Mata Pelajaran', value: detailModal.mapel },
                { label: 'Rata-rata Nilai Siswa', value: detailModal.rataRata ?? 'Belum ada data' },
                { label: 'Kehadiran', value: detailModal.kehadiran },
                { label: 'Jumlah Sesi Mengajar', value: detailModal.tugas },
                { label: 'Penilaian Terakhir', value: detailModal.latestAssessment ? new Date(detailModal.latestAssessment).toLocaleDateString('id-ID') : '-' },
                { label: 'Catatan Wakasek', value: catatanMap[detailModal.id] || '-' },
              ].map(item => (
                <div key={item.label} className="bg-slate-50 rounded-xl p-3">
                  <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-1">{item.label}</p>
                  <p className="text-sm font-bold text-slate-900">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal Catatan */}
      {catatanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-900">Catatan untuk {catatanModal.nama}</h3>
              <button onClick={() => setCatatanModal(null)} className="p-2 hover:bg-slate-100 rounded-xl"><X className="w-5 h-5 text-slate-500" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-blue-50 p-3 rounded-xl border border-blue-100">
                <p className="text-xs text-blue-800 font-medium">Catatan ini akan tersimpan dan dapat dilihat oleh Kepala Sekolah serta guru yang bersangkutan.</p>
              </div>
              <textarea value={catatanInput} onChange={e => setCatatanInput(e.target.value)} rows={4} placeholder='"Perbaiki metode mengajar", "Bagus, tingkatkan lagi"' className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none" />
              <div className="flex justify-end">
                <button onClick={handleSimpanCatatan} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-colors">Simpan Catatan</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WakasekLaporanKinerjaGuru;
