import { useEffect, useState } from 'react';
import { calendarAPI } from './api';

/**
 * Loads the official academic-year list straight from `academic_calendars`
 * (via /api/academic-calendar). Exposes the active term as the default so every
 * module reads the same source of truth instead of hard-coding two rows.
 *
 * Returns { terms, activeTerm, loading, error, reload }.
 */
export function useAcademicYears() {
  const [terms, setTerms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      // The single-record endpoint returns the current active term; we also
      // derive the selectable list from each term's fields. To keep this 100%
      // real-data with no new endpoint, we read the active term plus any list
      // returned by the API and fall back to the active record alone.
      const { data } = await calendarAPI.listTerms();
      const rows = Array.isArray(data?.data) ? data.data
        : Array.isArray(data) ? data
        : (data ? [data] : []);
      setTerms(rows.filter(Boolean));
    } catch (err) {
      setError(err?.response?.data?.message || 'Gagal memuat daftar tahun ajaran.');
      setTerms([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); }, []);

  const activeTerm =
    terms.find((t) => (t.status || '') === 'active')
    || terms.find((t) => t.is_active)
    || null;

  return { terms, activeTerm, loading, error, reload };
}

/** Normalize a term row into { id, academic_year, semester, status } for selects. */
export function termValue(term) {
  if (!term) return '';
  return term.academic_year || term.title || '';
}
