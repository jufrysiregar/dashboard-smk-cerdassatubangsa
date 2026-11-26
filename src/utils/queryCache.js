import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Cache query ringan — pengganti TanStack Query tanpa dependency baru.
 *
 * Kenapa perlu:
 * - Dashboard me-render isi tab secara kondisional, jadi setiap pindah menu
 *   komponennya di-unmount dan datanya hilang. Tanpa cache, user yang bolak
 *   balik menu menembak ulang API dari nol.
 * - Dev server PHP hanya melayani satu request sekaligus, sehingga request
 *   dobel/polling yang menumpuk membuat semua menu terasa macet.
 *
 * Yang disediakan:
 * - Penyimpanan hasil API di memori (Map) yang bertahan walau komponen
 *   di-unmount, lengkap dengan TTL (stale time).
 * - Dedupe: beberapa pemanggil dengan key sama hanya memicu SATU request.
 * - Hook `useCachedQuery` dengan polling yang otomatis berhenti saat tab
 *   browser tidak aktif (document.hidden).
 */

const cache = new Map(); // key -> { data, updatedAt }
const inFlight = new Map(); // key -> Promise

export const getQueryData = (key) => cache.get(key)?.data;

export const isQueryFresh = (key, ttl = 0) => {
  const entry = cache.get(key);
  if (!entry) return false;
  return Date.now() - entry.updatedAt < ttl;
};

export const setQueryData = (key, data) => {
  if (!key) return data;
  cache.set(key, { data, updatedAt: Date.now() });
  return data;
};

export const invalidateQuery = (key) => {
  cache.delete(key);
  inFlight.delete(key);
};

/** Hapus semua cache yang key-nya berawalan `prefix`. */
export const invalidateQueries = (prefix = '') => {
  Array.from(cache.keys())
    .filter((key) => key.startsWith(prefix))
    .forEach((key) => invalidateQuery(key));
};

/**
 * Jalankan fetcher untuk `key` dengan dedupe. Hasil otomatis masuk cache.
 * Dipakai juga oleh kode non-component (mis. setelah aksi hapus data).
 */
export const fetchQuery = (key, fetcher) => {
  if (!key) return Promise.resolve().then(fetcher);
  if (inFlight.has(key)) return inFlight.get(key);

  const promise = Promise.resolve()
    .then(fetcher)
    .then((data) => setQueryData(key, data))
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, promise);
  return promise;
};

/**
 * Hook data dengan cache.
 *
 * @param {string}   key       Kunci cache unik, mis. 'security:online-users'.
 * @param {Function} fetcher   Fungsi async pengambil data (harus mengembalikan data siap pakai).
 * @param {object}   options
 *   - ttl            Lama data dianggap segar (ms). Default 30 detik.
 *   - refreshInterval  Interval polling (ms). 0 = tidak polling.
 *   - enabled        Set false untuk menahan request.
 *   - initialData    Data awal (mis. dari props induk) yang langsung dipakai
 *                    dan disimpan ke cache tanpa request tambahan.
 *   - onError        Callback error supaya komponen bisa menampilkan toast.
 */
export function useCachedQuery(key, fetcher, options = {}) {
  const {
    ttl = 30000,
    refreshInterval = 0,
    silentPolling = false,
    enabled = true,
    initialData,
    onError,
  } = options;

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const initialDataRef = useRef(initialData);
  initialDataRef.current = initialData;

  const [data, setDataState] = useState(() => getQueryData(key));
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState(null);

  const keyRef = useRef(key);
  keyRef.current = key;
  const dataRef = useRef(data);
  dataRef.current = data;

  const run = useCallback(async ({ silent = false } = {}) => {
    const activeKey = keyRef.current;
    if (!silent) setIsFetching(true);
    try {
      const result = await fetchQuery(activeKey, () => fetcherRef.current());
      if (keyRef.current === activeKey) {
        setDataState(result);
        setError(null);
      }
      return result;
    } catch (err) {
      if (keyRef.current === activeKey) setError(err);
      if (!silent) onErrorRef.current?.(err, activeKey);
      throw err;
    } finally {
      if (!silent) setIsFetching(false);
    }
  }, []);

  // Sinkronkan saat key berganti: pakai cache bila ada, refetch bila basi.
  useEffect(() => {
    if (!enabled || !key) return undefined;

    if (getQueryData(key) === undefined && initialDataRef.current !== undefined) {
      setDataState(setQueryData(key, initialDataRef.current));
      return undefined;
    }

    const cached = getQueryData(key);
    setDataState(cached);
    if (cached === undefined || !isQueryFresh(key, ttl)) {
      run().catch(() => {});
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);

  // Polling: lewati saat tab browser tidak aktif agar request tidak menumpuk.
  useEffect(() => {
    if (!enabled || !refreshInterval || !key) return undefined;

    const timer = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      run({ silent: silentPolling }).catch(() => {});
    }, refreshInterval);

    return () => window.clearInterval(timer);
  }, [key, enabled, refreshInterval, silentPolling, run]);

  /** Update data lokal + cache (dipakai untuk optimistic update). */
  const setData = useCallback((updater) => {
    const next = typeof updater === 'function' ? updater(dataRef.current) : updater;
    dataRef.current = next;
    setQueryData(keyRef.current, next);
    setDataState(next);
    return next;
  }, []);

  return {
    data,
    error,
    isFetching,
    // `loading` hanya true saat benar-benar belum ada data sama sekali,
    // sehingga tabel tidak berkedip kosong saat polling berjalan.
    loading: isFetching && data === undefined,
    refetch: run,
    setData,
  };
}
