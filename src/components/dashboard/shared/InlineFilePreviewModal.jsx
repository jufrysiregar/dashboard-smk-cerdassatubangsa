import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import mammoth from 'mammoth/mammoth.browser';
import { Loader2, Download, FileWarning, FileText } from 'lucide-react';
import ModalCloseControl from './ModalCloseControl';
import useEscapeKey from '../../../utils/useEscapeKey';
import useBodyScrollLock from '../../../utils/useBodyScrollLock';
import api from '../../../utils/api';

// Pratinjau in-page (TANPA tab browser baru). Mendukung dua mode:
//  - File-only: file saja → .jpg/.png <img>, .pdf <iframe>, .docx mammoth, lainnya info + Unduh.
//  - Terpadu (guru): `answerHtml` terisi → panel "Jawaban Tertulis" (HTML) + panel "Lampiran File" di bawahnya.
// Byte file selalu diambil lewat `api` (endpoint streaming terautentikasi,
// `file.apiPath`) — bebas CORS & bebas URL /storage yang ngaco saat APP_URL vhost.
// Bila `apiPath` kosong, fallback fetch URL biasa (mis. same-origin produksi).
// img/pdf/unduh memakai BLOB URL hasil fetch → auth header ikut, tanpa request kedua.
const IMAGE_EXT = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'];

const MIME_BY_EXT = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp',
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

const InlineFilePreviewModal = ({ open, onClose, file }) => {
    // Fallback URL lama — origin dibuang agar sempat kena proxy saat dev.
    const url = String(file?.url || '').replace(/^(?:https?:)?\/\/[^/]+/i, '');
    const apiPath = file?.apiPath || '';
    const name = file?.name || 'file';
    const answerHtml = file?.answerHtml; // undefined = bukan mode terpadu esai
    const ext = useMemo(() => (file?.ext || (name.split('.').pop() || '')).toLowerCase(), [file]);

    const [state, setState] = useState('idle'); // idle|loading|ready|error
    const [html, setHtml] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [blobUrl, setBlobUrl] = useState('');
    const blobRef = useRef(null);

    useBodyScrollLock(open);
    useEscapeKey(open, onClose);

    const revokeBlob = () => {
        if (blobRef.current) { try { URL.revokeObjectURL(blobRef.current); } catch { /* noop */ } blobRef.current = null; }
    };

    // Ambil byte sekali per file: docx → mammoth; lainnya → blob URL (img/iframe/unduh).
    useEffect(() => {
        if (!open || !(apiPath || url)) { setHtml(''); setBlobUrl(''); revokeBlob(); return undefined; }
        let alive = true;
        setState('loading'); setErrorMsg(''); setHtml(''); setBlobUrl(''); revokeBlob();

        const getBytes = async () => {
            if (apiPath) {
                const res = await api.get(apiPath, { responseType: 'arraybuffer' });
                return res.data;
            }
            const r = await fetch(url);
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            return r.arrayBuffer();
        };

        getBytes()
            .then(async (buf) => {
                if (!alive) return;
                if (!buf || buf.byteLength === 0) throw new Error('File kosong (0 byte).');
                if (ext === 'docx') {
                    const res = await mammoth.convertToHtml({ arrayBuffer: buf });
                    if (alive) { setHtml(res?.value || '<p><em>Dokumen kosong.</em></p>'); setState('ready'); }
                    return;
                }
                const type = MIME_BY_EXT[ext] || 'application/octet-stream';
                const objUrl = URL.createObjectURL(new Blob([buf], { type }));
                if (!alive) { URL.revokeObjectURL(objUrl); return; }
                blobRef.current = objUrl;
                setBlobUrl(objUrl);
                setState('ready');
            })
            .catch((err) => { if (alive) { setErrorMsg(err?.message || 'Gagal memuat file.'); setState('error'); } });

        return () => { alive = false; revokeBlob(); };
    }, [open, apiPath, url, ext]);

    if (!open) return null;
    if (!(apiPath || url) && answerHtml === undefined) return null;

    const hasAnswerPanel = answerHtml !== undefined && answerHtml !== null;
    const answerPlain = String(answerHtml || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
    const isImage = IMAGE_EXT.includes(ext);
    const isPdf = ext === 'pdf';
    const isDoc = ext === 'doc';
    const title = (apiPath || url) ? name : 'Jawaban Esai';
    // Sumber render/unduh: blob hasil fetch (autentik) → fallback URL mentah selama loading/error.
    const srcUrl = blobUrl || (apiPath ? '' : url);
    const downloadHref = srcUrl || url;

    return createPortal(
        <div
            className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
            onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
        >
            <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
                {/* Header: judul + Unduh (bila ada file) + X */}
                <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
                    <div className="flex min-w-0 items-center gap-2">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600"><FileText size={16} /></span>
                        <p className="min-w-0 truncate text-sm font-black text-slate-800" title={title}>{title}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                        {(apiPath || url) && (
                            <a href={downloadHref || undefined} download={name}
                                className={`inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-black uppercase tracking-wider text-slate-600 transition hover:bg-slate-50 ${!downloadHref ? 'pointer-events-none opacity-50' : ''}`}>
                                <Download size={14} /> Unduh File
                            </a>
                        )}
                        <ModalCloseControl onClose={onClose} />
                    </div>
                </div>

                {/* Body */}
                <div className="min-h-0 flex-1 overflow-auto bg-slate-50">
                    {/* Panel 1 — Jawaban Tertulis (mode terpadu guru) */}
                    {hasAnswerPanel && (
                        <section className="p-6">
                            <h4 className="mb-2 text-[11px] font-black uppercase tracking-widest text-slate-400">Jawaban Tertulis</h4>
                            {answerPlain ? (
                                <div className="essay-render mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 text-sm leading-relaxed text-slate-800 shadow-sm"
                                    dangerouslySetInnerHTML={{ __html: String(answerHtml) }} />
                            ) : (
                                <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm font-semibold italic text-slate-400">Murid tidak mengisi jawaban ketik.</p>
                            )}
                        </section>
                    )}

                    {/* Panel 2 — Lampiran File */}
                    {(apiPath || url) && (
                        <section className={hasAnswerPanel ? 'px-6 pb-6' : ''}>
                            {hasAnswerPanel && <h4 className="mb-2 text-[11px] font-black uppercase tracking-widest text-slate-400">Lampiran File</h4>}

                            {state === 'loading' && (
                                <div className="flex items-center justify-center gap-2 py-20 text-sm font-bold text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /> Memuat lampiran…</div>
                            )}

                            {state === 'error' && (
                                <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
                                    <FileWarning className="h-8 w-8 text-amber-500" />
                                    <p className="text-sm font-bold text-amber-700">Lampiran gagal dimuat{errorMsg ? ` (${errorMsg})` : ''}. Gunakan tombol Unduh File.</p>
                                    <a href={url || undefined} download={name} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-black uppercase tracking-wider text-white hover:bg-emerald-700"><Download size={14} /> Unduh</a>
                                </div>
                            )}

                            {state === 'ready' && isImage && srcUrl && (
                                <div className="flex items-center justify-center p-2">
                                    <img src={srcUrl} alt={name} className="max-h-[60vh] w-auto max-w-full rounded-xl border border-slate-200 bg-white object-contain shadow-sm" />
                                </div>
                            )}

                            {state === 'ready' && isPdf && srcUrl && (
                                <iframe title={name} src={srcUrl} className="h-[70vh] min-h-[420px] w-full rounded-xl border border-slate-200 bg-white" />
                            )}

                            {state === 'ready' && ext === 'docx' && (
                                <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 text-sm leading-relaxed text-slate-800 shadow-sm docx-preview" dangerouslySetInnerHTML={{ __html: html }} />
                            )}

                            {state === 'ready' && (isDoc || (!isImage && !isPdf && ext !== 'docx')) && (
                                <div className="flex items-center justify-center p-2">
                                    <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                                        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400"><FileWarning className="h-7 w-7" /></span>
                                        <p className="text-sm font-black text-slate-700">Pratinjau {ext ? `.${ext}` : 'file'} tidak didukung browser</p>
                                        <p className="text-xs font-medium leading-relaxed text-slate-500">Format {isDoc ? '.doc (Word versi lama/biner)' : 'ini'} tidak bisa ditampilkan langsung di halaman. Silakan unduh untuk membukanya di aplikasi.</p>
                                        <a href={downloadHref || undefined} download={name} className="mt-1 inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-black uppercase tracking-wider text-white shadow-lg shadow-emerald-500/25 hover:bg-emerald-700"><Download size={15} /> Unduh File</a>
                                    </div>
                                </div>
                            )}
                        </section>
                    )}
                </div>
            </div>
        </div>,
        document.body,
    );
};

export default InlineFilePreviewModal;
