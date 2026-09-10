import { getAddressOptions } from './addressOptions';

describe('getAddressOptions', () => {
    test('returns trimmed, unique, sorted values for a requested address field', () => {
        const addresses = [
            { province: 'เลย' },
            { province: ' กรุงเทพฯ ' },
            { province: 'เลย' },
            { province: '' },
            {},
            null,
        ];

        expect(getAddressOptions(addresses, 'province')).toEqual(['กรุงเทพฯ', 'เลย']);
    });
});
