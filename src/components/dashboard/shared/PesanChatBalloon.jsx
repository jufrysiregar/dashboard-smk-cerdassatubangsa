import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Paperclip, Send, ShieldCheck, X, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { BASE_URL, pesanUserAPI } from '../../../utils/api';
import { getAccessRoleLabel } from '../../../utils/userMeta';

/**
 * Balon pesan khusus halaman "Pesan Pribadi".
 *
 * - Dibuka lewat klik baris percakapan, langsung menampilkan pesan terbaru.
 * - Isi percakapan bersifat tampilan saja (tidak bisa diklik).
 * - Ada kolom balasan gaya chatting dan tombol X bulat di bawah untuk menutup balon.
 * - Catatan pemantauan sekolah ditampilkan di footer balon.
 */

const formatClock = (value) => {
  if (!value) return '';
  const date = new Date(String(value).replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
};

const initialsOf = (name) => {
  const parts = String(name || '?').trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part.charAt(0).toUpperCase()).join('') || '?';
};

const PesanChatBalloon = ({ open, contact, onClose, onOpenAttachment, onLoaded, onReplied }) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [hasNewBelow, setHasNewBelow] = useState(false);
  const [attachment, setAttachment] = useState(null);
  const bodyRef = useRef(null);
  const inputRef = useRef(null);
  const fileRef = useRef(null);
  // Untuk polling: id pesan terakhir yang tampil + apakah gulir sedang di dasar.
  const lastIdRef = useRef(null);
  const atBottomRef = useRef(true);
  // Menyimpan kunci percakapan yang sudah digulir, agar tidak menggulir ulang
  // setiap kali daftar pesan bertambah (mis. setelah membalas).
  const scrolledKeyRef = useRef('');

  // Disimpan di ref agar identitas callback dari parent tidak memicu fetch berulang.
  const onLoadedRef = useRef(onLoaded);
  useEffect(() => {
    onLoadedRef.current = onLoaded;
  }, [onLoaded]);

  const onRepliedRef = useRef(onReplied);
  useEffect(() => {
    onRepliedRef.current = onReplied;
  }, [onReplied]);

  const loadThread = useCallback(async (contactId) => {
    if (!contactId) return;
    setLoading(true);
    setErrorText('');
    try {
      const response = await pesanUserAPI.getConversation(contactId);
      const list = response.data?.data || [];
      setMessages(list);
      lastIdRef.current = list.length ? list[list.length - 1].id : null;
      atBottomRef.current = true;
      // Membuka percakapan menandai pesan masuk sebagai dibaca di server.
      onLoadedRef.current?.();
    } catch (error) {
      setErrorText(error.response?.data?.message || 'Pesan gagal dimuat.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open || !contact?.id) return;
    setMessages([]);
    setDraft('');
    setErrorText('');
    scrolledKeyRef.current = '';
    lastIdRef.current = null;
    atBottomRef.current = true;
    setHasNewBelow(false);
    setAttachment(null);
    loadThread(contact.id);
  }, [open, contact?.id, loadThread]);

  // Gulir ke pesan terbaru sekali per pembukaan percakapan.
  useEffect(() => {
    if (!open || loading) return;
    const key = String(contact?.id || '-');
    if (scrolledKeyRef.current === key) return;
    scrolledKeyRef.current = key;

    const box = bodyRef.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [messages, loading, open, contact?.id]);

  useEffect(() => {
    if (!open) return undefined;
    const handleKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  const autoGrow = () => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 112)}px`;
  };

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      const box = bodyRef.current;
      if (box) box.scrollTop = box.scrollHeight;
    });
  }, []);

  // Menerapkan hasil polling: hanya menggulir bila ada pesan baru dan posisi
  // sedang di dasar (atau pesan baru itu milik kita). Data identik diabaikan
  // supaya tidak memicu re-render tiap 3 detik.
  const applyList = useCallback((list) => {
    const prevLastId = lastIdRef.current;
    const nextLast = list.length ? list[list.length - 1] : null;
    const changed = String(prevLastId ?? '') !== String(nextLast?.id ?? '');
    lastIdRef.current = nextLast?.id ?? null;

    setMessages((prev) => {
      const sameLength = prev.length === list.length;
      const sameLast = String(prev[prev.length - 1]?.id ?? '') === String(nextLast?.id ?? '');
      if (sameLength && sameLast) return prev;
      return list;
    });

    if (!changed || prevLastId == null || !nextLast) return;
    if (atBottomRef.current || nextLast.is_mine) {
      scrollToBottom();
      setHasNewBelow(false);
    } else if (!nextLast.is_mine) {
      // Pengguna sedang membaca pesan lama: beri tombol "pesan baru" di dasar.
      setHasNewBelow(true);
    }
    // Pesan masuk baru sudah ditandai dibaca oleh server saat GET.
    if (!nextLast.is_mine) onLoadedRef.current?.();
  }, [scrollToBottom]);

  // Polling percakapan: pesan baru muncul sendiri tanpa perlu menutup balon.
  useEffect(() => {
    if (!open || !contact?.id) return undefined;
    let stopped = false;

    const tick = async () => {
      if (document.visibilityState === 'hidden') return;
      try {
        const response = await pesanUserAPI.getConversation(contact.id);
        if (!stopped) applyList(response.data?.data || []);
      } catch (error) {
        // Diamkan; percobaan berikutnya akan mencoba lagi.
      }
    };

    const timer = setInterval(tick, 3000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);

    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [open, contact?.id, applyList]);

  // Sisipkan berkas: aturan sama dengan Tulis Pesan (PDF/JPG, maks 5MB).
  const handlePickAttachment = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const validTypes = ['application/pdf', 'image/jpeg', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      toast.error('Hanya berkas PDF dan JPG yang diperbolehkan');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Maksimal ukuran berkas adalah 5MB');
      return;
    }
    setAttachment(file);
  };

  const handleReply = async (event) => {
    event?.preventDefault?.();
    const text = draft.trim();
    if ((!text && !attachment) || sending || !contact?.id) return;

    setSending(true);
    try {
      const formData = new FormData();
      formData.append('penerima_id', contact.id);
      if (text) formData.append('isi', text);
      if (attachment) formData.append('lampiran', attachment);

      const response = await pesanUserAPI.reply(formData);
      const created = response.data?.data;
      if (created) {
        const appended = { ...created, is_mine: true };
        setMessages((prev) => [...prev, appended]);
        lastIdRef.current = appended.id;
      }
      setDraft('');
      setAttachment(null);
      const el = inputRef.current;
      if (el) el.style.height = 'auto';
      setHasNewBelow(false);
      scrollToBottom();
      onRepliedRef.current?.();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Balasan gagal dikirim.');
    } finally {
      setSending(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[130] flex items-end justify-center p-3 sm:justify-end sm:p-5">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-md"
          />
          <div className="relative flex w-full max-w-[480px] flex-col items-end gap-4">
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            className="flex h-[640px] max-h-[calc(100vh-8rem)] w-full max-w-[480px] flex-col overflow-hidden rounded-[28px] border border-white/60 bg-white shadow-[0_30px_70px_-25px_rgba(15,23,42,0.5)]"
          >
            <div className="flex shrink-0 items-center gap-3.5 border-b border-slate-100 px-6 py-5">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-50 text-[13px] font-black text-blue-700">
                {contact?.avatar_path ? (
                  <img
                    src={`${BASE_URL}/storage/${contact.avatar_path}`}
                    alt={contact?.name || 'Foto profil'}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  initialsOf(contact?.name)
                )}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[15px] font-black text-slate-800">{contact?.name || 'Pengguna'}</p>
                <p className="truncate text-[11.5px] font-semibold text-slate-400">{getAccessRoleLabel(contact || {})}</p>
              </div>
            </div>

            <div
              ref={bodyRef}
              onScroll={() => {
                const box = bodyRef.current;
                if (!box) return;
                atBottomRef.current = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
                if (atBottomRef.current) setHasNewBelow(false);
              }}
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-slate-50/60 px-5 py-5"
            >
              {loading ? (
                <div className="flex h-full items-center justify-center text-slate-400">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : errorText ? (
                <p className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-center text-[12px] font-bold text-red-600">{errorText}</p>
              ) : messages.length === 0 ? (
                <p className="mt-6 text-center text-[12px] font-semibold text-slate-400">Belum ada pesan pada percakapan ini.</p>
              ) : (
                messages.map((message) => {
                  return (
                    <div
                      key={message.id}
                      className={`mb-2.5 flex ${message.is_mine ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-[13.5px] font-semibold leading-relaxed shadow-sm ${message.is_mine
                          ? 'rounded-br-md bg-indigo-600 text-white'
                          : 'rounded-bl-md border border-emerald-200 bg-emerald-50 text-emerald-900'
                          }`}
                      >
                        {message.isi ? (
                          <p className="whitespace-pre-wrap break-words">{message.isi}</p>
                        ) : null}
                        {message.attachment_path && (
                          <button
                            type="button"
                            onClick={() => onOpenAttachment?.({
                              url: `${BASE_URL}/storage/${message.attachment_path}`,
                              name: message.attachment_name || 'Lampiran',
                            })}
                            className={`mt-1.5 inline-flex items-center gap-1.5 text-[11.5px] font-bold underline ${message.is_mine ? 'text-indigo-100' : 'text-emerald-700'}`}
                          >
                            <Paperclip className="h-3.5 w-3.5" />
                            {message.attachment_name || 'Lihat lampiran'}
                          </button>
                        )}
                        <p className={`mt-1 text-right text-[10.5px] font-semibold ${message.is_mine ? 'text-indigo-100/80' : 'text-emerald-600/80'}`}>
                          {formatClock(message.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}

              {hasNewBelow && (
                <div className="pointer-events-none sticky bottom-0 flex justify-center pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setHasNewBelow(false);
                      scrollToBottom();
                    }}
                    className="pointer-events-auto inline-flex items-center gap-1 rounded-full bg-slate-900 px-3.5 py-1.5 text-[10.5px] font-bold text-white shadow-lg transition-all hover:bg-slate-800 active:scale-95"
                  >
                    Pesan baru
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Kolom balasan gaya chatting */}
            <form onSubmit={handleReply} className="shrink-0 border-t border-slate-100 bg-white px-5 py-4">
              {attachment && (
                <div className="mb-2.5 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <Paperclip className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-slate-600">{attachment.name}</span>
                  <button
                    type="button"
                    onClick={() => setAttachment(null)}
                    title="Batalkan lampiran"
                    className="rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              <div className="flex items-end gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg"
                  onChange={handlePickAttachment}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  title="Sisipkan berkas (PDF/JPG, maks 5MB)"
                  className={`flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full border transition-all active:scale-95 ${attachment
                    ? 'border-indigo-200 bg-indigo-50 text-indigo-600'
                    : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                    }`}
                >
                  <Paperclip className="h-[18px] w-[18px]" />
                </button>
                <textarea
                  ref={inputRef}
                  rows={1}
                  value={draft}
                  onChange={(event) => {
                    setDraft(event.target.value);
                    autoGrow();
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      handleReply(event);
                    }
                  }}
                  placeholder="Tulis balasan..."
                  className="max-h-28 min-h-[46px] flex-1 resize-none overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[13px] font-semibold text-slate-700 outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/15"
                />
                <button
                  type="submit"
                  disabled={(!draft.trim() && !attachment) || sending}
                  title="Kirim balasan"
                  className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/25 transition-all hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
                >
                  {sending ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : <Send className="h-[18px] w-[18px]" />}
                </button>
              </div>
            </form>

            {/* Footer: catatan pemantauan sekolah */}
            <div className="shrink-0 border-t border-slate-100 bg-white px-6 pb-5 pt-4">
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                <p className="text-[11px] font-semibold leading-relaxed text-slate-400">
                  Percakapan ini dipantau oleh sistem sekolah. Mohon gunakan bahasa yang sopan dan isi pesan seputar
                  lingkungan pendidikan. Percakapan yang tidak pantas akan ditindaklanjuti oleh Divisi Konseling.
                </p>
              </div>
            </div>
          </motion.div>

          {/* Tombol tutup bulat merah, rata kanan di bawah kartu balon (di luar kartu). */}
          <motion.button
            type="button"
            onClick={onClose}
            title="Tutup balon chat"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ delay: 0.05 }}
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-red-600 text-white shadow-[0_10px_25px_-8px_rgba(220,38,38,0.7)] ring-1 ring-white/20 transition-all hover:scale-105 hover:bg-red-500 active:scale-95"
          >
            <X className="h-6 w-6" strokeWidth={2.5} />
          </motion.button>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default PesanChatBalloon;
