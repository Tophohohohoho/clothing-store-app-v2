import apiClient from './client';
import {
    getProducts,
    getCategories,
    createCategory,
    updateProductStatus,
    updateStock,
} from './productsApi';

jest.mock('./client', () => ({
    __esModule: true,
    default: {
        get: jest.fn(),
        post: jest.fn(),
        put: jest.fn(),
        delete: jest.fn(),
    },
}));

describe('productsApi', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('builds product listing params only when filters are provided', () => {
        getProducts();
        expect(apiClient.get).toHaveBeenCalledWith('/api/products', { params: {} });

        getProducts('shirt', true);
        expect(apiClient.get).toHaveBeenLastCalledWith('/api/products', {
            params: { search: 'shirt', include_inactive: 1 },
        });
    });

    test('passes category include-inactive flag only when requested', () => {
        getCategories();
        expect(apiClient.get).toHaveBeenCalledWith('/api/categories', { params: {} });

        getCategories(true);
        expect(apiClient.get).toHaveBeenLastCalledWith('/api/categories', {
            params: { include_inactive: 1 },
        });
    });

    test('maps category and stock status payloads to backend field names', () => {
        createCategory('เครื่องแบบ');
        expect(apiClient.post).toHaveBeenCalledWith('/api/admin/categories', {
            category_name: 'เครื่องแบบ',
        });

        updateProductStatus(12, 'inactive');
        expect(apiClient.post).toHaveBeenLastCalledWith('/api/admin/products/status', {
            id: 12,
            product_status: 'inactive',
        });

        const payload = { id: 12, amount: 3 };
        updateStock(payload);
        expect(apiClient.post).toHaveBeenLastCalledWith('/api/products/update-stock', payload);
    });
});
