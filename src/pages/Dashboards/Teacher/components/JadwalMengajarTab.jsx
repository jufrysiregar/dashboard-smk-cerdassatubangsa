import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar as CalendarIcon, 
  Filter, 
  Printer, 
  Clock, 
  MapPin, 
  BookOpen, 
  CalendarDays,
  CheckCircle2,
  AlertCircle,
  FileText,
  Pin,
  GraduationCap
} from 'lucide-react';
import { teacherAPI } from '../../../../utils/api';
import GlassCard from '../../../../components/dashboard/shared/GlassCard';
import { toast } from 'react-hot-toast';

const JadwalMengajarTab = ({ clock }) => {
  const [viewType, setViewType] = useState('weekly'); // 'weekly' or 'daily'
  const [filter, setFilter] = useState({
    tahun_ajaran: '2025/2026',
    semester: 'genap'
  });
  const [schedules, setSchedules] = useState([]);
  const [summaryToday, setSummaryToday] = useState(null);
  const [loading, setLoading] = useState(false);

  const days = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu'];
  const timeSlots = [
    '07.30 - 08.30',
    '08.30 - 09.30',
    '09.30 - 10.00', // Istirahat
    '10.00 - 11.00',
    '11.00 - 12.00',
    '12.00 - 13.00', // Istirahat
    '13.00 - 14.00',
    '14.00 - 15.00'
  ];

  useEffect(() => {
    fetchSchedules();
  }, [filter.tahun_ajaran, filter.semester]);

  const fetchSchedules = async () => {
    setLoading(true);
    try {
      const response = await teacherAPI.getSchedules(filter);
      setSchedules(response.data.data);
      setSummaryToday(response.data.summary_today);
    } catch (error) {
      toast.error('Gagal memuat jadwal');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const getStatus = (startTime, endTime) => {
    if (!clock.time) return { label: 'Belum', color: 'bg-[#10B981]' };
    
    const now = clock.time; // Format HH:mm
    const start = startTime.substring(0, 5);
    const end = endTime.substring(0, 5);

    if (now < start) return { label: 'Belum', color: 'bg-[#10B981]' };
    if (now >= start && now <= end) return { label: 'Sedang Berlangsung', color: 'bg-[#F59E0B]' };
    return { label: 'Selesai', color: 'bg-[#6B7280]' };
  };

  const renderTodaySummary = () => {
    if (!summaryToday || summaryToday.schedules.length === 0) return null;

    return (
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="mb-8 p-6 bg-[#EFF6FF] border-l-4 border-[#3B82F6] rounded-xl lg:rounded-2xl shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <Pin size={20} className="text-[#3B82F6] rotate-45" />
          <h4 className="text-lg font-black text-[#1E3A8A] uppercase tracking-tight">JADWAL HARI INI ({summaryToday.day})</h4>
        </div>
        <div className="space-y-3">
          {summaryToday.schedules.map((s, idx) => (
            <div key={idx} className="flex items-center gap-2 text-sm font-bold text-slate-700">
              <span className="w-2 h-2 rounded-full bg-blue-400" />
              <span>{s.jam_mulai.substring(0, 5)} - {s.jam_selesai.substring(0, 5)}:</span>
              <span className="text-blue-600">{s.class?.name} - {s.subject?.name} (Ruang {s.room?.name})</span>
            </div>
          ))}
        </div>
        <div className="mt-6 pt-4 border-t border-blue-100 text-xs font-black text-blue-500 uppercase tracking-widest">
          Total jam mengajar hari ini: {summaryToday.total_hours} jam (@ 1 jam = 1 JP)
        </div>
      </motion.div>
    );
  };

  const renderWeeklyMatrix = () => {
    return (
      <div className="overflow-x-auto rounded-[2rem] border border-slate-100">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-[#F9FAFB]">
              <th className="px-6 py-4 text-left text-xs font-black text-[#1F2937] uppercase tracking-widest border-b border-slate-100">Jam</th>
              {days.map(day => (
                <th key={day} className="px-6 py-4 text-center text-xs font-black text-[#1F2937] uppercase tracking-widest border-b border-slate-100">{day}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {timeSlots.map((slot, sIdx) => {
              const isIstirahat = slot.includes('Istirahat');
              return (
                <tr key={sIdx} className={isIstirahat ? 'bg-slate-50/50' : 'hover:bg-slate-50 transition-colors'}>
                  <td className="px-6 py-6 text-sm font-black text-slate-400 whitespace-nowrap">{slot}</td>
                  {days.map(day => {
                    const schedule = schedules.find(s => 
                      s.hari === day && 
                      (s.jam_mulai.substring(0, 5) >= slot.substring(0, 5) && s.jam_mulai.substring(0, 5) < slot.substring(8, 13))
                    );

                    if (isIstirahat) {
                      return <td key={day} className="px-6 py-6 text-center text-[10px] font-black text-slate-300 uppercase tracking-widest bg-[#F9FAFB]">(Istirahat)</td>;
                    }

                    if (!schedule) {
                      return <td key={day} className="px-6 py-6 text-center text-lg font-black text-[#9CA3AF] bg-[#F9FAFB]">-</td>;
                    }

                    return (
                      <td key={day} className="px-6 py-6 text-center bg-white">
                        <div className="space-y-1">
                          <p className="text-sm font-black text-[#1F2937]">{schedule.class?.name}</p>
                          <p className="text-[10px] font-bold text-blue-500 uppercase tracking-tight">{schedule.subject?.name}</p>
                          <p className="text-[10px] font-medium text-slate-400">Ruang {schedule.room?.name}</p>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const renderDailyList = () => {
    const today = strtolower(clock.day) || 'senin';
    const daySchedules = schedules.filter(s => s.hari === today);

    return (
      <div className="overflow-x-auto rounded-[2rem] border border-slate-100">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-[#F9FAFB]">
              <th className="px-6 py-4 text-left text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Waktu</th>
              <th className="px-6 py-4 text-left text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Kelas</th>
              <th className="px-6 py-4 text-left text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Mata Pelajaran</th>
              <th className="px-6 py-4 text-left text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Ruang</th>
              <th className="px-6 py-4 text-center text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {daySchedules.length === 0 ? (
              <tr><td colSpan="5" className="px-6 py-20 text-center text-slate-400 font-bold italic">Tidak ada jadwal untuk hari ini</td></tr>
            ) : daySchedules.map((s, idx) => {
              const status = getStatus(s.jam_mulai, s.jam_selesai);
              return (
                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-5 text-sm font-black text-slate-700">{s.jam_mulai.substring(0, 5)} - {s.jam_selesai.substring(0, 5)}</td>
                  <td className="px-6 py-5 text-sm font-black text-slate-700">{s.class?.name}</td>
                  <td className="px-6 py-5 text-sm font-bold text-slate-500">{s.subject?.name}</td>
                  <td className="px-6 py-5 text-sm font-bold text-slate-500">{s.room?.name}</td>
                  <td className="px-6 py-5 text-center">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-black text-[10px] text-white ${status.color}`}>
                      {status.label === 'Sedang Berlangsung' ? <Clock size={12} className="animate-pulse" /> : <CheckCircle2 size={12} />}
                      {status.label.toUpperCase()}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const strtolower = (str) => str?.toLowerCase();

  return (
    <div className="space-y-6 pb-20 animate-fadeIn">
      {/* Header Section */}
      <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}>
        <div className="overflow-hidden rounded-[2rem] border border-green-100 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.16),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.12),transparent_28%),linear-gradient(135deg,#ffffff_0%,#f0fdf4_100%)] p-6 lg:p-8">
          <div className="flex items-center justify-between gap-4 mb-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-green-700">
              <GraduationCap className="h-3 w-3" /> Portal Teachers Workspace
            </div>
            {clock && (
              <div className="flex flex-col items-end gap-1 px-4 py-2 rounded-2xl bg-white/80 border border-green-100 shadow-sm shrink-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-black text-slate-700 uppercase tracking-widest">{clock.day},</span>
                  <span className="text-xs font-bold text-slate-500">{clock.date}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-green-400" />
                  <span className="text-lg font-black tracking-widest text-slate-700 tabular-nums">{clock.time}</span>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">WIB</span>
                </div>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <h1 className="text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">Area Kerja Guru</h1>
            <p className="mt-2 text-sm italic leading-7 text-slate-600">
              "Mendedikasikan diri untuk mencetak generasi cerdas dan berkarakter. Menanam benih ilmu hari ini untuk memanen masa depan yang lebih cerah."
            </p>
          </div>
        </div>
      </motion.div>

      {/* Filter Card */}
      <GlassCard className="overflow-visible">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
            <Filter size={20} />
          </div>
          <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">🔍 FILTER TAMPILAN</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Tampilan</label>
            <select 
              value={viewType}
              onChange={(e) => setViewType(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
            >
              <option value="weekly">Mingguan</option>
              <option value="daily">Harian</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Tahun Ajaran</label>
            <select 
              value={filter.tahun_ajaran}
              onChange={(e) => setFilter({...filter, tahun_ajaran: e.target.value})}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
            >
              <option value="2025/2026">2025/2026</option>
              <option value="2024/2025">2024/2025</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Semester</label>
            <select 
              value={filter.semester}
              onChange={(e) => setFilter({...filter, semester: e.target.value})}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
            >
              <option value="ganjil">Ganjil</option>
              <option value="genap">Genap</option>
            </select>
          </div>
        </div>

        <div className="mt-8">
          <button 
            onClick={fetchSchedules}
            className="px-8 py-4 bg-[#3B82F6] hover:bg-blue-600 text-white font-black rounded-2xl shadow-lg shadow-blue-500/20 flex items-center justify-center gap-3 transition-all active:scale-95"
          >
            TERAPKAN FILTER
          </button>
        </div>
      </GlassCard>

      {/* Main Content Card */}
      <GlassCard>
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <CalendarIcon size={20} />
            </div>
            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">📅 JADWAL MENGAJAR</h3>
          </div>
          <button 
            onClick={handlePrint}
            className="px-6 py-3 bg-[#3B82F6] hover:bg-blue-600 text-white font-black text-xs rounded-xl shadow-lg shadow-blue-500/20 flex items-center gap-2 transition-all active:scale-95"
          >
            <Printer size={16} /> CETAK PDF
          </button>
        </div>

        {renderTodaySummary()}

        {loading ? (
          <div className="py-20 text-center text-slate-400 font-bold">Memuat jadwal...</div>
        ) : (
          viewType === 'weekly' ? renderWeeklyMatrix() : renderDailyList()
        )}

        <div className="mt-8 p-6 bg-amber-50 rounded-3xl border border-amber-100 flex gap-4">
          <div className="p-2 bg-white rounded-xl text-amber-500 shadow-sm h-fit">
            <AlertCircle size={20} />
          </div>
          <div>
            <p className="text-sm font-black text-amber-800 uppercase tracking-tight">Catatan:</p>
            <p className="mt-1 text-sm font-medium text-amber-700 leading-relaxed">
              Jadwal di atas adalah jadwal resmi yang dikeluarkan oleh Admin Akademik. Jika terdapat ketidaksesuaian, harap segera hubungi bagian Kurikulum.
            </p>
          </div>
        </div>
      </GlassCard>
    </div>
  );
};

export default JadwalMengajarTab;
