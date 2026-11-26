import React from 'react';
import { motion } from 'framer-motion';
import {
  FileText, 
  Calendar,
  ShieldCheck,
  Sparkles,
  Info,
  Eye,
  
  Bell,
  Clock
} from 'lucide-react';
import { calendarAPI } from '../../../../utils/api';
import { fetchAcademicCalendarPreviewUrl, revokeObjectUrl } from '../../../../utils/calendarPreview';

const CalendarTAViewer = () => {
  const [viewType, setViewType] = React.useState('document'); 
  const [calendar, setCalendar] = React.useState(null);
  const [events, setEvents] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const previewUrlRef = React.useRef('');

  const replaceCalendarPreview = React.useCallback((nextCalendar) => {
    setCalendar((currentCalendar) => {
      if (currentCalendar?.fileUrl && currentCalendar.fileUrl !== nextCalendar?.fileUrl) {
        revokeObjectUrl(currentCalendar.fileUrl);
      }

      return nextCalendar;
    });
  }, []);

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [calRes, evRes] = await Promise.all([
          calendarAPI.getCalendar(),
          calendarAPI.getEvents()
        ]);

        if (calRes.data) {
          let previewUrl = null;

          if (calRes.data.file_path) {
            try {
              previewUrl = await fetchAcademicCalendarPreviewUrl();
            } catch (error) {
              console.error('Failed to fetch academic calendar preview:', error);
            }
          }

          replaceCalendarPreview({
            ta: calRes.data.title || 'T/A 2026/2027',
            fileName: calRes.data.original_filename,
            fileUrl: previewUrl,
            uploadDate: calRes.data.upload_date,
            size: calRes.data.file_size,
            isPublished: calRes.data.is_published
          });
        } else {
          replaceCalendarPreview(null);
        }

        if (evRes.data) {
          setEvents(evRes.data);
        }
      } catch (error) {
        console.error('Failed to fetch academic data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [replaceCalendarPreview]);

  React.useEffect(() => {
    previewUrlRef.current = calendar?.fileUrl || '';
  }, [calendar?.fileUrl]);

  React.useEffect(() => () => {
    revokeObjectUrl(previewUrlRef.current);
  }, []);

  const handleOpenPDF = () => {
    if (calendar?.fileUrl) {
      window.open(calendar.fileUrl, '_blank', 'noopener,noreferrer');
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-20 text-center">
        <div className="h-20 w-20 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-6">
          
        </div>
        <h3 className="text-xl font-black text-slate-400 uppercase tracking-widest">Sinkronisasi Data...</h3>
      </div>
    );
  }

  if (!calendar || !calendar.isPublished) {
    return (
      <div className="max-w-4xl mx-auto py-20 text-center">
        <div className="h-20 w-20 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-6">
          <Calendar className="h-10 w-10 text-slate-300" />
        </div>
        <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Kalender Belum Tersedia</h3>
        <p className="text-sm text-slate-500 mt-2 max-w-sm mx-auto font-medium leading-relaxed">Super Admin belum mengunggah PDF kalender terbaru atau dokumen belum dipublikasikan ke seluruh dashboard.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-indigo-700 border border-indigo-100">
            <Calendar className="h-3 w-3" />
            Agenda Resmi {calendar.ta}
          </div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tight leading-tight">Kalender Akademik</h2>
          <p className="text-sm font-medium text-slate-500">Pratinjau dokumen SK Tahun Ajaran dan Agenda KBM berjalan.</p>
        </div>
      </div>

      {/* Main Preview Field - Always Show PDF */}
      <div className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-blue-500 rounded-[2.5rem] blur opacity-20 group-hover:opacity-30 transition duration-1000 group-hover:duration-200" />
        
        <div className="relative bg-white rounded-[2.5rem] border border-white p-8 md:p-12 shadow-2xl overflow-hidden">
          <div className="flex flex-col items-center text-center max-w-2xl mx-auto">
            <div className="relative mb-8">
              <div className="absolute inset-0 bg-indigo-100 rounded-[2rem] rotate-6 scale-95 opacity-50 shadow-inner" />
              <div className="relative h-24 w-24 rounded-[2rem] bg-indigo-600 text-white flex items-center justify-center shadow-2xl">
                <FileText className="h-12 w-12" />
              </div>
              <div className="absolute -right-2 -bottom-2 h-8 w-8 rounded-full bg-emerald-500 border-4 border-white flex items-center justify-center">
                <ShieldCheck className="h-4 w-4 text-white" />
              </div>
            </div>

            <h3 className="text-2xl font-black text-slate-900 mb-2 truncate max-w-full">{calendar.fileName}</h3>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">SK Dokumen Resmi Terverifikasi ({calendar.size})</p>
            
            <p className="text-sm font-medium text-slate-500 mb-10 leading-relaxed italic">
              Dokumen kalender akademik dalam format PDF ini berisi rincian hari efektif, libur nasional, dan agenda strategis sekolah selama periode {calendar.ta}.
            </p>

            <div className="flex items-center w-full">
              <button
                type="button"
                onClick={handleOpenPDF}
                disabled={!calendar.fileUrl}
                className="flex-1 w-full flex items-center justify-center gap-3 rounded-2xl bg-indigo-600 px-8 py-5 text-sm font-black text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all hover:-translate-y-1 active:scale-95 disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none disabled:hover:translate-y-0"
              >
                <Eye className="h-4 w-4" /> Buka Dokumen
              </button>
            </div>
            {!calendar.fileUrl && (
              <p className="mt-4 text-[11px] font-bold text-amber-600">Preview PDF sedang belum tersedia, tetapi metadata kalender sudah tersimpan.</p>
            )}
          </div>
        </div>
      </div>

      {/* Manual Events Section - Below PDF */}
      {events.length > 0 && (
        <div className="space-y-6 animate-fadeIn">
          <div className="flex items-center gap-3 border-l-4 border-indigo-600 pl-4 py-1">
             <div className="space-y-1">
                <h3 className="text-xl font-black text-slate-900 tracking-tight">Agenda Terbaru dari Admin Akademik :</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Agenda Perencanaan Manual Terintegrasi</p>
             </div>
          </div>

          <div className="grid gap-4">
            {events.map((event) => (
              <motion.div 
                key={event.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="group relative bg-white rounded-3xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-all hover:border-indigo-100 flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="flex items-center gap-5">
                  <div className="h-12 w-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                    {event.type === 'holiday' ? <Sparkles className="h-6 w-6" /> : <Bell className="h-6 w-6" />}
                  </div>
                  <div>
                    <h4 className="text-base font-black text-slate-800 leading-tight mb-1">{event.title}</h4>
                    <div className="flex items-center gap-2">
                       <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${
                        event.type === 'academic' ? 'bg-blue-50 text-blue-600' : 
                        event.type === 'holiday' ? 'bg-amber-50 text-amber-600' : 
                        'bg-slate-50 text-slate-600'
                      }`}>
                        {event.type}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100 ml-auto md:ml-0">
                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-xs font-black text-indigo-600 whitespace-nowrap">{event.event_date}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Info Panel */}
      <div className="flex items-center gap-3 px-5 py-4 bg-amber-50/80 rounded-2xl border border-amber-100 shadow-sm w-fit">
        <Info className="h-4 w-4 text-amber-600 shrink-0" />
        <p className="text-xs font-black text-amber-700 uppercase tracking-tight leading-tight">
          <span className="opacity-60 mr-2 border-r border-amber-200 pr-2">Update Sistem</span>
          Penjadwalan Resmi Tahun Ajaran 2026/2027
        </p>
      </div>
    </div>
  );
};

export default CalendarTAViewer;
