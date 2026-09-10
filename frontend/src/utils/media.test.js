describe('resolveMediaUrl', () => {
    const originalApiUrl = process.env.REACT_APP_API_URL;

    afterEach(() => {
        jest.resetModules();
        process.env.REACT_APP_API_URL = originalApiUrl;
    });

    const loadResolveMediaUrl = () => require('./media').resolveMediaUrl;

    test('returns empty string for blank values', () => {
        const resolveMediaUrl = loadResolveMediaUrl();

        expect(resolveMediaUrl('')).toBe('');
        expect(resolveMediaUrl(null)).toBe('');
        expect(resolveMediaUrl('   ')).toBe('');
    });

    test('preserves already absolute and browser-local URLs', () => {
        const resolveMediaUrl = loadResolveMediaUrl();

        expect(resolveMediaUrl('https://example.com/image.png')).toBe('https://example.com/image.png');
        expect(resolveMediaUrl('//cdn.example.com/image.png')).toBe('//cdn.example.com/image.png');
        expect(resolveMediaUrl('data:image/png;base64,abc')).toBe('data:image/png;base64,abc');
        expect(resolveMediaUrl('blob:http://localhost/id')).toBe('blob:http://localhost/id');
    });

    test('prefixes relative upload paths with the configured API base URL', () => {
        process.env.REACT_APP_API_URL = 'https://shop.example.test';
        const resolveMediaUrl = loadResolveMediaUrl();

        expect(resolveMediaUrl('/uploads/products/shirt.png')).toBe('https://shop.example.test/uploads/products/shirt.png');
        expect(resolveMediaUrl('uploads/products/shirt.png')).toBe('https://shop.example.test/uploads/products/shirt.png');
    });
});
