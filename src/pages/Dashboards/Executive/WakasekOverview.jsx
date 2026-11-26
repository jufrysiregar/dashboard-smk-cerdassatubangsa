import React, { useState, useEffect } from 'react';
import { Users, UserCheck, BookOpen, Calendar, BarChart2, AlertTriangle, CheckCircle2, Megaphone, ArrowRight } from 'lucide-react';
import { managementAPI, informationCenterAPI } from '../../../utils/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const WakasekOverview = ({ setActivePanel }) => {
  const [stats, setStats] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);

  // Mock data untuk ujian mendatang
  const ujianMendatang = [
    { tanggal: '20/05/26', jenis: 'UTS Genap', kelas: 'X IPA 1', mapel: 'Matematika', status: 'Siap' },
    { tanggal: '22/05/26', jenis: 'UTS Genap', kelas: 'X IPA 2', mapel: 'Fisika', status: 'Belum Siap' },
  ];

  // Mock data kehadiran per kelas
  const kehadiranPerKelas = [
    { kelas: 'X IPA 1', persentase: 92 },
    { kelas: 'X IPA 2', persentase: 88 },
    { kelas: 'XI IPA 1', persentase: 95 },
    { kelas: 'XI IPA 2', persentase: 90 },
    { kelas: 'XII IPA 1', persentase: 87 },
  ];

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, annRes] = await Promise.all([
          managementAPI.getStats(),
          informationCenterAPI.getInfos({ per_page: 3 }),
        ]);
        setStats(statsRes?.data?.data);
        setAnnouncements(annRes?.data?.data || []);
      } catch (e) {
        console.error('Gagal memuat overview wakasek', e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const counts = stats?.counts || {};
  const attendance = stats?.attendance || {};

  const summaryCards = [
    {
      label: 'Total Siswa',
      value: counts.students || 450,
      icon: Users,
      color: 'bg-blue-50 text-blue-600',
      accent: 'from-blue-500 to-cyan-500',
    },
    {
      label: 'Total Guru',
      value: counts.teachers || 34,
      icon: UserCheck,
      color: 'bg-emerald-50 text-emerald-600',
      accent: 'from-emerald-500 to-teal-500',
    },
    {
      label: 'Total Kelas',
      value: counts.classes || 12,
      icon: BookOpen,
      color: 'bg-amber-50 text-amber-600',
      accent: 'from-amber-500 to-orange-500',
    },
    {
      label: 'Kehadiran Hari Ini',
      value: `${attendance.student_rate || 94}%`,
      icon: BarChart2,
      color: 'bg-purple-50 text-purple-600',
      accent: 'from-purple-500 to-pink-500',
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto" />
          <p className="text-sm font-bold text-slate-500">Memuat Dashboard Wakasek...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* BARIS 1: Kartu Ringkasan (4 kartu) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm overflow-hidden relative">
              <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${card.accent}`} />
              <div className="flex items-center gap-3 mb-3 mt-1">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${card.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <p className="text-xs font-black text-slate-500 uppercase tracking-wider">{card.label}</p>
              </div>
              <p className="text-3xl font-black text-slate-900">{card.value}</p>
            </div>
          );
        })}
      </div>

      {/* BARIS 2: Grafik Kehadiran Siswa per Kelas (Bar Chart) */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <BarChart2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900">📊 Persentase Kehadiran Siswa per Kelas (Bulan Ini)</h3>
          </div>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={kehadiranPerKelas} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="kelas"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#64748b', fontSize: 12 }}
                dy={8}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#64748b', fontSize: 12 }}
                domain={[70, 100]}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                formatter={(value) => [`${value}%`, 'Kehadiran']}
                contentStyle={{ borderRadius: '0.75rem', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <Bar dataKey="persentase" fill="#2563eb" radius={[8, 8, 0, 0]} name="Kehadiran (%)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* BARIS 3: Tabel Ujian Mendatang (Preview) */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
            <h3 className="text-base font-black text-slate-900">Ujian Mendatang</h3>
          </div>
          <button
            onClick={() => setActivePanel('wakasek_exams')}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-xl text-xs font-black uppercase tracking-wider transition-colors"
          >
            Atur Ujian <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-wider">Tanggal</th>
                <th className="px-6 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-wider">Jenis Ujian</th>
                <th className="px-6 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-wider">Kelas</th>
                <th className="px-6 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-wider">Mapel</th>
                <th className="px-6 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-wider">Status Persiapan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ujianMendatang.map((row, idx) => (
                <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                  <td className="px-6 py-4 text-sm font-bold text-slate-900">{row.tanggal}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{row.jenis}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{row.kelas}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{row.mapel}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black ${
                      row.status === 'Siap'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-pink-100 text-pink-700'
                    }`}>
                      {row.status === 'Siap'
                        ? <CheckCircle2 className="w-3.5 h-3.5" />
                        : <AlertTriangle className="w-3.5 h-3.5" />
                      }
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* BARIS 4: Pengumuman Terbaru (Preview Pusat Informasi) */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Megaphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">Pengumuman Terbaru</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Preview dari Pusat Informasi</p>
            </div>
          </div>
          <button
            onClick={() => setActivePanel('news')}
            className="flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 text-slate-600 hover:bg-slate-900 hover:text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all"
          >
            Lihat Semua
          </button>
        </div>
        <div className="p-6">
          {announcements.length > 0 ? (
            <div className="space-y-3">
              {announcements.slice(0, 3).map((info) => (
                <div
                  key={info.id}
                  onClick={() => setActivePanel('news')}
                  className="p-4 rounded-xl border border-slate-100 bg-slate-50 hover:bg-white hover:shadow-md cursor-pointer transition-all"
                >
                  <h4 className="text-sm font-black text-slate-900">{info.title}</h4>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                    {info.content?.replace(/<[^>]*>?/gm, '')}
                  </p>
                  <p className="text-xs text-slate-400 mt-2">
                    {info.created_at ? new Date(info.created_at).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-10 text-center rounded-2xl border-2 border-dashed border-slate-100">
              <Megaphone className="w-8 h-8 text-slate-200 mx-auto mb-3" />
              <p className="text-sm font-black text-slate-300 uppercase tracking-widest">Belum ada pengumuman</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WakasekOverview;
