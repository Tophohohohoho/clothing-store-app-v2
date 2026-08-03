const toValidDate = (value) => {
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
};

export const formatThaiDate = (value, fallback = '-') => {
    const date = toValidDate(value);
    if (!date) return fallback;
    return date.toLocaleDateString('th-TH', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
};

export const formatThaiDateTime = (value, fallback = '-') => {
    const date = toValidDate(value);
    if (!date) return fallback;
    return date.toLocaleString('th-TH', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

export const formatThaiShortDateTime = (value, fallback = '-') => {
    const date = toValidDate(value);
    if (!date) return fallback;
    return date.toLocaleString('th-TH', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
};
