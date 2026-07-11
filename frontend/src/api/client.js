import axios from 'axios';

const AUTH_STORAGE_KEY = 'clothingStoreUser';
const AUTH_TOKEN_KEY = 'clothingStoreToken';

const readStoredToken = (storage) => {
    const savedUser = storage.getItem(AUTH_STORAGE_KEY);
    const savedToken = storage.getItem(AUTH_TOKEN_KEY);
    if (!savedUser || !savedToken) {
        storage.removeItem(AUTH_STORAGE_KEY);
        storage.removeItem(AUTH_TOKEN_KEY);
        return '';
    }

    try {
        return JSON.parse(savedToken) || '';
    } catch (err) {
        storage.removeItem(AUTH_STORAGE_KEY);
        storage.removeItem(AUTH_TOKEN_KEY);
        return '';
    }
};

const getStoredToken = () => readStoredToken(localStorage) || readStoredToken(sessionStorage);

const apiClient = axios.create({
    baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000',
});

apiClient.interceptors.request.use((config) => {
    const token = getStoredToken();
    if (token) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export default apiClient;
