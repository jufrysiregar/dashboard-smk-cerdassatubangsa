import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  BookOpen,
  Calendar,
  Edit2,
  Eye,
  Image as ImageIcon,
  MoreVertical,
  
  Trash2,
  Upload,
  User,
} from 'lucide-react';
import { examAPI } from '../../utils/api';
import QuestionPreviewModal from './QuestionPreviewModal';

const formatDateTime = (value) => {
  if (!value) {
    return '-';
  }

  return new Date(value).toLocaleString('id-ID');
};

const PaketSoalLibrary = ({
  title,
  subtitle,
  packages = [],
  loading = false,
  role = 'guru',
  onOpenUpload,
  onRefresh,
  onEdit,
  onDelete,
  uploadButtonLabel = 'Upload Paket Soal',
}) => {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(null);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);



  const accent = role === 'operator' || role === 'admin_akademik'
    ? {
        chip: 'bg-indigo-50 text-indigo-600',
        button: 'bg-indigo-600 hover:bg-indigo-700',
        outline: 'border-indigo-200 text-indigo-600 hover:bg-indigo-50',
      }
    : {
        chip: 'bg-emerald-50 text-emerald-600',
        button: 'bg-emerald-600 hover:bg-emerald-700',
        outline: 'border-emerald-200 text-emerald-600 hover:bg-emerald-50',
      };

  const handlePreview = async (paket) => {
    setPreviewOpen(true);
    setPreviewLoading(true);
    setPreviewError(null);
    setSelectedPackage(null);

    try {
      const response = await examAPI.getPaketSoal(paket.id);
      setSelectedPackage(response.data.data);
    } catch (error) {
      setPreviewError(error.response?.data?.message || 'Preview paket soal tidak dapat dibuka.');
    } finally {
      setPreviewLoading(false);
    }
  };

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="text-2xl font-black text-slate-800">{title}</h3>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-slate-500">{subtitle}</p>
          </div>

          <div className="flex flex-wrap gap-3">
            {onOpenUpload && (
              <button
                type="button"
                onClick={onOpenUpload}
                className={`inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-black text-white shadow-xl transition-all ${accent.button}`}
              >
                <Upload className="h-4 w-4" /> {uploadButtonLabel}
              </button>
            )}
          </div>
        </div>



        {loading ? (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3].map((item) => (
              <div key={item} className="animate-pulse rounded-[1.75rem] border border-slate-100 bg-slate-50 p-5">
                <div className="flex justify-between mb-4">
                  <div className="h-4 w-28 rounded-full bg-slate-200" />
                  <div className="h-4 w-4 rounded-full bg-slate-200" />
                </div>
                <div className="mb-3 h-8 rounded-2xl bg-slate-200" />
                <div className="mb-2 h-3 rounded-full bg-slate-200" />
                <div className="mb-2 h-3 w-3/4 rounded-full bg-slate-200" />
                <div className="mt-6 h-11 rounded-2xl bg-slate-200" />
              </div>
            ))}
          </div>
        ) : packages.length === 0 ? (
          <div className="rounded-[2rem] border-2 border-dashed border-slate-200 bg-slate-50 px-6 py-14 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white text-slate-300 shadow-sm">
              <BookOpen className="h-8 w-8" />
            </div>
            <h4 className="mt-5 text-xl font-black text-slate-800">Paket Soal Masih Kosong</h4>
            <p className="mx-auto mt-2 max-w-xl text-sm font-medium leading-relaxed text-slate-500">
              Simpan paket soal latihan dari dokumen Word. Paket ini menjadi koleksi pribadi Anda dan dapat dipilih operator saat menyusun sesi ujian.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
            {packages.map((paket) => (
              <motion.div
                key={paket.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="group relative flex h-full flex-col rounded-[1.75rem] border border-slate-100 bg-white p-5 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${paket.question_format === 'esai' ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-700'}`}>
                      {paket.question_format === 'esai' ? 'Esai (PDF)' : `Pilihan Ganda · ${paket.soals_count || 0}`}
                    </span>
                    <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${accent.chip}`}>
                      {paket.type_label}
                    </div>
                    <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${
                      paket.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {paket.is_active ? 'Aktif' : 'Draft'}
                    </span>
                  </div>

                  <div className="relative">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuId(openMenuId === paket.id ? null : paket.id);
                      }}
                      className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-50 hover:text-slate-900"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>

                    <AnimatePresence>
                      {openMenuId === paket.id && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95, y: -10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: -10 }}
                          className="absolute right-0 top-12 z-10 w-48 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-2xl"
                        >
                          <div className="py-1">
                            {onEdit && (
                              <button
                                type="button"
                                onClick={() => {
                                  onEdit(paket);
                                  setOpenMenuId(null);
                                }}
                                className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-xs font-bold text-slate-700 hover:bg-slate-50"
                              >
                                <Edit2 className="h-3.5 w-3.5" /> Edit Metadata
                              </button>
                            )}
                            {onDelete && (
                              <button
                                type="button"
                                onClick={() => {
                                  setDeleteTarget(paket);
                                  setOpenMenuId(null);
                                }}
                                className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-xs font-bold text-rose-600 hover:bg-rose-50"
                              >
                                <Trash2 className="h-3.5 w-3.5" /> Hapus Paket
                              </button>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                <h4 className="mt-4 line-clamp-2 text-lg font-black leading-tight text-slate-900">{paket.title}</h4>
                <p className="mt-2 min-h-[44px] text-sm font-medium leading-relaxed text-slate-500">
                  {paket.description || 'Paket soal ini siap dipreview, diedit, atau dihapus sesuai kebutuhan guru.'}
                </p>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Jumlah Soal</p>
                    <p className="mt-1 text-2xl font-black text-slate-800">{paket.soals_count || 0}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Gambar Cocok</p>
                    <p className="mt-1 text-2xl font-black text-emerald-600">{paket.matched_image_count || 0}</p>
                  </div>
                </div>

                <div className="mt-4 space-y-2 rounded-[1.25rem] border border-slate-100 bg-slate-50 p-4">
                  {paket.subject && (
                    <div className="text-xs font-bold text-slate-500">
                      Mata pelajaran: <span className="text-slate-700">{paket.subject}</span>
                    </div>
                  )}
                  {paket.class_name && (
                    <div className="text-xs font-bold text-slate-500">
                      Kelas: <span className="text-slate-700">{paket.class_name}</span>
                    </div>
                  )}
                  {paket.exam_code && (
                    <div className="text-xs font-bold text-slate-500">
                      Kode ujian: <span className="text-slate-700">{paket.exam_code}</span>
                    </div>
                  )}
                  {paket.question_format && (
                    <div className="text-xs font-bold text-slate-500">
                      Format: <span className="text-slate-700">{paket.question_format === 'esai' ? 'Esai' : 'Pilihan ganda'}</span>
                    </div>
                  )}
                  {paket.delivery_mode && (
                    <div className="text-xs font-bold text-slate-500">
                      Mode: <span className="text-slate-700">{paket.delivery_mode === 'deadline' ? 'Tenggat pengumpulan' : 'Mulai saat murid klik mulai'}</span>
                    </div>
                  )}
                  {paket.delivery_mode === 'realtime' && paket.duration_minutes && (
                    <div className="text-xs font-bold text-slate-500">
                      Durasi: <span className="text-slate-700">{paket.duration_minutes} menit</span>
                    </div>
                  )}
                  {paket.delivery_mode === 'deadline' && paket.deadline_at && (
                    <div className="text-xs font-bold text-slate-500">
                      Tenggat: <span className="text-slate-700">{formatDateTime(paket.deadline_at)}</span>
                    </div>
                  )}
                  <div className="text-xs font-bold text-slate-500">
                    Nilai: <span className="text-slate-700">{paket.show_score ? 'Tampil langsung' : 'Disembunyikan'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                    <User className="h-3.5 w-3.5" /> {paket.created_by || 'Tanpa nama pembuat'}
                  </div>
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                    <Calendar className="h-3.5 w-3.5" /> {formatDateTime(paket.created_at)}
                  </div>
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                    <ImageIcon className="h-3.5 w-3.5" /> {paket.missing_image_count || 0} gambar belum ditemukan
                  </div>
                </div>

                {Boolean(paket.missing_image_count) && (
                  <div className="mt-4 rounded-[1.25rem] border border-amber-200 bg-amber-50 p-4">
                    <div className="flex items-start gap-3">
                      <div className="rounded-full bg-white p-2 text-amber-500 shadow-sm">
                        <AlertCircle className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-amber-700">Ada gambar yang belum terhubung.</p>
                        <p className="mt-1 text-xs font-medium leading-relaxed text-amber-600">
                          Pastikan nama file di ZIP sama persis dengan kolom "Nama File Gambar" pada Excel.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-5 flex gap-3">
                  <button
                    type="button"
                    onClick={() => handlePreview(paket)}
                    className="flex-1 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white transition-all hover:bg-black"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Eye className="h-4 w-4" /> Preview Soal
                    </span>
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )
      }
    </div>

    <QuestionPreviewModal
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        paket={selectedPackage}
        loading={previewLoading}
        error={previewError}
        role={role}
        onPackageChanged={async (packageId) => {
          if (typeof packageId === 'number') {
            setPreviewLoading(true);
            setPreviewError(null);

            try {
              const response = await examAPI.getPaketSoal(packageId);
              setSelectedPackage(response.data.data);
            } catch (error) {
              setPreviewError(error.response?.data?.message || 'Paket soal gagal dimuat ulang.');
            } finally {
              setPreviewLoading(false);
            }
          }

          if (onRefresh) {
            await onRefresh();
          }
        }}
        onPackageDeleted={async () => {
          setPreviewOpen(false);
          setSelectedPackage(null);

          if (onRefresh) {
            await onRefresh();
          }
        }}
      />
      <AnimatePresence>
        {deleteTarget && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 text-rose-600"><Trash2 className="h-5 w-5" /></div>
              <h3 className="mt-4 text-lg font-black text-slate-900">Hapus paket soal?</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">Paket <strong>{deleteTarget.title}</strong> dan seluruh soal di dalamnya akan dihapus dari database.</p>
              <div className="mt-6 flex justify-end gap-3">
                <button type="button" onClick={() => setDeleteTarget(null)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50">Batal</button>
                <button type="button" onClick={() => { const target = deleteTarget; setDeleteTarget(null); onDelete?.(target.id); }} className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-rose-700">Hapus paket</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default PaketSoalLibrary;
