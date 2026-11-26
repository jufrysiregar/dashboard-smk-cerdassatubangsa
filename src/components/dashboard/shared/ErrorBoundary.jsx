import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

/**
 * ErrorBoundary — mencegah layar putih polos saat ada error runtime React.
 * Menampilkan panel error jelas + tombol muat ulang. Pasang di sekitar modul
 * yang rawan (mis. workspace Kasir) agar kegagalan satu modul tidak mematikan
 * seluruh aplikasi.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Jejak ke konsol agar mudah didiagnosa.
    console.error('[ErrorBoundary]', error, info?.componentStack);
  }

  handleReload = () => {
    this.setState({ error: null });
    if (typeof window !== 'undefined') window.location.reload();
  };

  render() {
    if (this.state.error) {
      const message = this.state.error?.message || 'Terjadi kesalahan tak terduga.';
      return (
        <div className="flex min-h-[60vh] items-center justify-center p-6">
          <div className="max-w-lg w-full rounded-3xl border border-rose-200 bg-white p-8 text-center shadow-xl">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
              <AlertTriangle className="h-7 w-7" />
            </div>
            <h2 className="text-lg font-black tracking-tight text-slate-900">Halaman gagal dimuat</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Terjadi galat pada modul ini. Data kamu tetap aman di server. Coba muat ulang, atau
              keluar lalu masuk kembali.
            </p>
            <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-left font-mono text-[11px] text-rose-600 break-words">
              {message}
            </p>
            <button
              type="button"
              onClick={this.handleReload}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 px-5 py-2.5 text-sm font-black text-white shadow-md transition hover:opacity-95"
            >
              <RotateCcw className="h-4 w-4" /> Muat Ulang
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
