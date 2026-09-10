const createApiClient = () => {
    let requestInterceptor;
    const client = {
        interceptors: {
            request: {
                use: jest.fn((handler) => {
                    requestInterceptor = handler;
                }),
            },
        },
    };

    jest.doMock('axios', () => ({
        __esModule: true,
        default: {
            create: jest.fn(() => client),
        },
    }));

    const apiClient = require('./client').default;
    return { apiClient, client, getRequestInterceptor: () => requestInterceptor };
};

describe('apiClient auth interceptor', () => {
    beforeEach(() => {
        jest.resetModules();
        localStorage.clear();
        sessionStorage.clear();
        delete process.env.REACT_APP_API_URL;
    });

    test('creates axios client with the default API base URL', () => {
        const { apiClient, client } = createApiClient();
        const axios = require('axios').default;

        expect(apiClient).toBe(client);
        expect(axios.create).toHaveBeenCalledWith({ baseURL: 'http://localhost:5000' });
    });

    test('adds bearer token from local storage when auth data is complete', () => {
        const { getRequestInterceptor } = createApiClient();
        localStorage.setItem('clothingStoreUser', JSON.stringify({ id: 1 }));
        localStorage.setItem('clothingStoreToken', JSON.stringify('local-token'));

        const config = getRequestInterceptor()({ headers: { 'X-Trace': 'abc' } });

        expect(config.headers).toEqual({
            'X-Trace': 'abc',
            Authorization: 'Bearer local-token',
        });
    });

    test('falls back to session storage when local storage has no valid auth token', () => {
        const { getRequestInterceptor } = createApiClient();
        sessionStorage.setItem('clothingStoreUser', JSON.stringify({ id: 2 }));
        sessionStorage.setItem('clothingStoreToken', JSON.stringify('session-token'));

        const config = getRequestInterceptor()({});

        expect(config.headers.Authorization).toBe('Bearer session-token');
    });

    test('clears incomplete or malformed stored auth data and leaves headers untouched', () => {
        const { getRequestInterceptor } = createApiClient();
        localStorage.setItem('clothingStoreUser', JSON.stringify({ id: 1 }));
        localStorage.setItem('clothingStoreToken', '{bad-json');
        sessionStorage.setItem('clothingStoreUser', JSON.stringify({ id: 2 }));

        const config = getRequestInterceptor()({});

        expect(config.headers).toBeUndefined();
        expect(localStorage.getItem('clothingStoreUser')).toBeNull();
        expect(localStorage.getItem('clothingStoreToken')).toBeNull();
        expect(sessionStorage.getItem('clothingStoreUser')).toBeNull();
        expect(sessionStorage.getItem('clothingStoreToken')).toBeNull();
    });
});
