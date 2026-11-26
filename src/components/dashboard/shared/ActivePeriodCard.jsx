import React, { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

// Identik dengan kartu "Periode Aktif" di Kasir (CashierDashboardKeuangan dkk),
// hanya aksen merah -> hijau lime agar senada hero Pusat Jurusan.
const DAYS_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const MONTHS_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

export default function ActivePeriodCard({ tahunAjaran, semester }) {
  const [clock, setClock] = useState({ time: '', day: '', date: '' });

  useEffect(() => {
    const tick = () => {
      const wib = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
      const hh = String(wib.getHours()).padStart(2, '0');
      const mm = String(wib.getMinutes()).padStart(2, '0');
      const ss = String(wib.getSeconds()).padStart(2, '0');
      setClock({
        time: `${hh}:${mm}:${ss}`,
        day: DAYS_ID[wib.getDay()],
        date: `${wib.getDate()} ${MONTHS_ID[wib.getMonth()]} ${wib.getFullYear()}`,
      });
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="rounded-2xl border border-green-100 bg-white/80 px-4 py-3 shadow-sm lg:shrink-0">
      <p className="text-[11px] font-black uppercase tracking-widest text-green-500">Periode Aktif</p>
      <p className="mt-1 text-[15px] font-black text-slate-900">T.A. {tahunAjaran || '—'}</p>
      <p className="mt-0.5 text-[12px] font-medium text-slate-500">
        Semester {semester || '—'}{clock.date ? ` · ${clock.day}, ${clock.date}` : ''}
      </p>
      <p className="mt-1 flex items-center gap-1.5 text-[12px] font-bold text-slate-600">
        <Clock className="h-4 w-4 text-green-500" />
        <span className="tabular-nums">{clock.time || '00:00:00'}</span>
        <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">WIB</span>
      </p>
    </div>
  );
}
