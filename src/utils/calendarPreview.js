import { calendarAPI } from './api';

export const revokeObjectUrl = (url) => {
  if (typeof url === 'string' && url.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
};

export const fetchAcademicCalendarPreviewUrl = async () => {
  const response = await calendarAPI.previewCalendar();
  const contentType = response.headers?.['content-type'] || 'application/pdf';

  if (!contentType.includes('pdf') && !contentType.includes('octet-stream')) {
    throw new Error('Preview kalender tidak mengembalikan file PDF yang valid.');
  }

  const blob = response.data instanceof Blob
    ? response.data
    : new Blob([response.data], { type: contentType });

  return URL.createObjectURL(blob);
};
