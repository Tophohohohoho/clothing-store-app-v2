export const getAddressOptions = (addresses = [], field) => {
    const values = addresses
        .map((address) => String(address?.[field] || '').trim())
        .filter(Boolean);

    return [...new Set(values)].sort((a, b) => a.localeCompare(b, 'th'));
};
