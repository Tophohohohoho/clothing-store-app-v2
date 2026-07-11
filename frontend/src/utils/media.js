const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export const resolveMediaUrl = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (/^(?:https?:)?\/\//i.test(raw) || raw.startsWith('data:') || raw.startsWith('blob:')) return raw;
    return `${API_BASE_URL}${raw.startsWith('/') ? raw : `/${raw}`}`;
};
