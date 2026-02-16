const localeForLang = (lang) => {
  if (!lang) return 'ar-SY';
  if (lang.startsWith('ar')) return 'ar-SY';
  if (lang.startsWith('en')) return 'en-US';
  return lang;
};

export const formatDateTime = (value, lang = 'ar') => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat(localeForLang(lang), {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

export const formatDate = (value, lang = 'ar') => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat(localeForLang(lang), {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
};

