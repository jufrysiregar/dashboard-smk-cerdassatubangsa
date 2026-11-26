import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { Loader2, AlertTriangle } from 'lucide-react';
import api from '../../../utils/api';

// Worker pdfjs lewat asset URL standar Vite (?url) → bersih di `vite dev` maupun `vite build`.
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

// Validasi 5 byte pertama header PDF ("%PDF-").
const isPdfBytes = (buf) => {
    if (!buf || buf.byteLength < 5) return false;
    const head = new Uint8Array(buf.slice(0, 5));
    return head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46 && head[4] === 0x2d;
};

// Ekstrak pesan error terbaca dari axios error (body arraybuffer → decode JSON manual bila bisa).
const errDetailOf = (e) => {
    try {
        if (e?.response?.data instanceof ArrayBuffer && e.response.data.byteLength > 0) {
            const json = JSON.parse(new TextDecoder('utf-8').decode(e.response.data));
            if (json?.message) return `HTTP ${e.response.status} — ${json.message}`;
        }
        if (e?.response?.status) return `HTTP ${e.response.status} — ${e.message}`;
    } catch { /* body bukan JSON — jatuh ke pesan mentah */ }
    return e?.message || String(e);
};

// Penampil lembar soal PDF kustom: halaman selalu sebaris, RATSA (flush) tepat di bawah
// header — tanpa toolbar internal. Kontrol zoom & jumlah halaman dikendalikan parent
// (dirender di header hijau workspace) lewat props `scale` + `onNumPagesChange`.
// Byte PDF diambil lewat endpoint API (axios + Authorization, responseType arraybuffer)
// sehingga bebas CORS & bebas masalah symlink /storage di Windows.
const PdfViewer = ({ apiUrl, fallbackUrl, scale = 1, onNumPagesChange }) => {
    const [numPages, setNumPages] = useState(0);
    const [status, setStatus] = useState('loading'); // loading | ready | error
    const [errDetail, setErrDetail] = useState('');
    const docRef = useRef(null);
    const canvasRefs = useRef({});

    const pages = useMemo(() => Array.from({ length: numPages }, (_, k) => k + 1), [numPages]);

    // Muat dokumen tiap sumber berganti.
    useEffect(() => {
        let alive = true;
        let doc = null;
        let loadingTask = null;
        const target = apiUrl || fallbackUrl;
        if (!target) {
            setErrDetail('URL lembar soal tidak tersedia.');
            setStatus('error');
            return undefined;
        }
        setStatus('loading'); setErrDetail(''); setNumPages(0);
        onNumPagesChange?.(0);

        // pdfjs v6: `destroy()` bisa tidak tersedia di beberapa objek proxy → selalu
        // cek tipe + tangkap rejection supaya cleanup unmount tidak meruntuhkan React tree.
        const destroySafely = (obj) => {
            if (obj && typeof obj.destroy === 'function') {
                try {
                    const r = obj.destroy();
                    if (r && typeof r.catch === 'function') r.catch(() => { /* noop */ });
                } catch { /* noop */ }
            }
        };

        const load = async () => {
            let buf;
            if (apiUrl) {
                // Melalui endpoint API: same-origin baseURL + header Authorization bawaan aplikasi.
                const res = await api.get(apiUrl, { responseType: 'arraybuffer' });
                buf = res.data;
            } else {
                // Fallback URL file langsung — origin dibuang agar same-origin (proxy Vite / satu host).
                const direct = String(fallbackUrl).replace(/^(?:https?:)?\/\/[^/]+/i, '');
                const r = await fetch(direct, { credentials: 'include' });
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                buf = await r.arrayBuffer();
            }
            if (!isPdfBytes(buf)) {
                throw new Error('Respons bukan file PDF valid (header "%PDF-" tidak ditemukan).');
            }
            loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buf) });
            return loadingTask.promise;
        };

        load()
            .then((d) => {
                if (!alive) { destroySafely(d); destroySafely(loadingTask); return; }
                doc = d; docRef.current = d;
                setNumPages(d.numPages);
                onNumPagesChange?.(d.numPages);
                setStatus('ready');
            })
            .catch((e) => {
                if (!alive) return;
                setErrDetail(errDetailOf(e));
                setStatus('error');
            });

        return () => {
            alive = false;
            destroySafely(doc);
            destroySafely(loadingTask);
            docRef.current = null;
        };
    }, [apiUrl, fallbackUrl, onNumPagesChange]);

    // Render semua canvas tiap skala/pagecount berubah (batal bila digantikan).
    const safeScale = Math.min(3, Math.max(0.5, scale || 1));
    useEffect(() => {
        if (status !== 'ready' || !docRef.current) return undefined;
        let cancelled = false;
        const doc = docRef.current;
        const dpr = window.devicePixelRatio || 1;
        (async () => {
            for (let i = 1; i <= doc.numPages; i++) {
                const canvas = canvasRefs.current[i];
                if (!canvas) continue;
                const page = await doc.getPage(i);
                const viewport = page.getViewport({ scale: safeScale });
                canvas.width = Math.floor(viewport.width * dpr);
                canvas.height = Math.floor(viewport.height * dpr);
                canvas.style.width = `${Math.floor(viewport.width)}px`;
                canvas.style.height = `${Math.floor(viewport.height)}px`;
                const ctx = canvas.getContext('2d');
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                await page.render({ canvasContext: ctx, viewport }).promise;
                if (cancelled) return;
            }
        })().catch((e) => { if (!cancelled) { setErrDetail(errDetailOf(e)); setStatus('error'); } });
        return () => { cancelled = true; };
    }, [status, safeScale, pages]);

    return (
        <div className="flex min-h-0 flex-1 flex-col bg-white">
            <div className="min-h-0 flex-1 overflow-auto">
                {status === 'loading' && (
                    <div className="flex h-full items-center justify-center gap-2 py-10 text-sm font-bold text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /> Memuat lembar soal…</div>
                )}
                {status === 'error' && (
                    <div className="flex h-full flex-col items-center justify-center gap-2 px-6 py-10 text-center">
                        <AlertTriangle className="h-7 w-7 text-rose-600" />
                        <p className="text-sm font-bold text-rose-600">Lembar soal tidak dapat dimuat.</p>
                        {errDetail && <p className="max-w-md break-words text-[11px] font-semibold text-slate-400">{errDetail}</p>}
                    </div>
                )}
                {status === 'ready' && (
                    <div className="flex min-w-fit flex-col items-center justify-start">
                        {pages.map((pageNum) => (
                            <canvas
                                key={pageNum}
                                ref={(el) => { if (el) canvasRefs.current[pageNum] = el; else delete canvasRefs.current[pageNum]; }}
                                className="block bg-white"
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default PdfViewer;
