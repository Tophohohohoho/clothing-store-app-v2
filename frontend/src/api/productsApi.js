import apiClient from './client';

export const getProducts = (search = '', includeInactive = false) => apiClient.get('/api/products', {
    params: {
        ...(search ? { search } : {}),
        ...(includeInactive ? { include_inactive: 1 } : {}),
    },
});

export const getCategories = (includeInactive = false) => apiClient.get('/api/categories', {
    params: includeInactive ? { include_inactive: 1 } : {},
});

export const createCategory = (categoryName) => apiClient.post('/api/admin/categories', {
    category_name: categoryName,
});

export const updateCategory = (categoryId, payload) => apiClient.put(`/api/admin/categories/${categoryId}`, payload);

export const deleteCategory = (categoryId) => apiClient.delete(`/api/admin/categories/${categoryId}`);

export const uploadProductImage = (payload) => apiClient.post('/api/products/upload-image', payload);

export const createProduct = (payload) => apiClient.post('/api/products', payload);

export const editProduct = (payload) => apiClient.post('/api/admin/products/edit', payload);

export const deleteProduct = (id) => apiClient.post('/api/admin/products/delete', { id });

export const updateProductStatus = (id, productStatus) => apiClient.post('/api/admin/products/status', {
    id,
    product_status: productStatus,
});

export const updateStock = (payload) => apiClient.post('/api/products/update-stock', payload);
