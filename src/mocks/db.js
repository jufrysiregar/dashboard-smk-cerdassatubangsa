// Tiny localStorage persistence layer for the standalone demo.
// Every demo collection lives under a single namespace prefix so a reset is trivial.

export const PREFIX = 'demo:';

export const KEYS = {
  version: 'version',
  users: 'users',
  jurusans: 'jurusans',
  classes: 'classes',
  subjects: 'subjects',
  teacherSubjects: 'teacherSubjects',
  attendance: 'attendance',
  teacherAttendance: 'teacherAttendance',
  billings: 'billings',
  payments: 'payments',
  verifications: 'verifications',
  pettyCash: 'pettyCash',
  cashBook: 'cashBook',
  examSessions: 'examSessions',
  paketSoal: 'paketSoal',
  questions: 'questions',
  attempts: 'attempts',
  tasks: 'tasks',
  submissions: 'submissions',
  bankSoal: 'bankSoal',
  materials: 'materials',
  journals: 'journals',
  achievements: 'achievements',
  announcements: 'announcements',
  activityLog: 'activityLog',
  notifications: 'notifications',
  magang: 'magang',
  fasilitas: 'fasilitas',
  staffReports: 'staffReports',
  staffTasks: 'staffTasks',
  messages: 'messages',
  calendarEvents: 'calendarEvents',
  settings: 'settings',
  schoolProfile: 'schoolProfile',
  resetOtp: 'resetOtp',
};

export function read(key, fallback = null) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function write(key, value) {
  localStorage.setItem(PREFIX + key, JSON.stringify(value));
}

export function remove(key) {
  localStorage.removeItem(PREFIX + key);
}

export function wipeAll() {
  const doomed = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const k = localStorage.key(i);
    if (k && k.startsWith(PREFIX)) doomed.push(k);
  }
  doomed.forEach((k) => localStorage.removeItem(k));
}

export function nextId(rows) {
  return (rows || []).reduce((max, row) => Math.max(max, Number(row.id) || 0), 0) + 1;
}

export function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function nowIso() {
  return new Date().toISOString();
}

// Days offset from today as an ISO date (YYYY-MM-DD), used for realistic demo dates.
export function dayOffset(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function monthAgoLabel(count) {
  const d = new Date();
  d.setMonth(d.getMonth() - count);
  return d.toLocaleDateString('id-ID', { month: 'short' });
}
