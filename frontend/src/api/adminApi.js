import apiClient from './client';

export const getAdminOrders = () => apiClient.get('/api/admin/orders');

export const getOrderDetails = (orderId) => apiClient.get(`/api/admin/orders/${orderId}/details`);

export const addOrderNote = (orderId, note, userId) => apiClient.post(`/api/admin/orders/${orderId}/notes`, {
    note,
    user_id: userId,
});

export const getDashboardStats = (params = {}) => apiClient.get('/api/admin/dashboard', { params });

export const deleteAdminOrder = (orderId, userId) => apiClient.post('/api/admin/orders/delete', {
    order_id: orderId,
    user_id: userId,
});

export const updateOrderStatus = (orderId, status, trackingNo = '', userId = null) => apiClient.put(`/api/orders/${orderId}/status`, {
    status,
    tracking_no: trackingNo,
    user_id: userId,
});

export const getCustomers = (params = {}) => apiClient.get('/api/admin/customers', { params });

export const changeUserRole = (userId, newRole, actorId) => apiClient.post('/api/admin/change-role', {
    user_id: userId,
    new_role: newRole,
    actor_id: actorId,
});

export const deleteUser = (userId, actorId) => apiClient.delete(`/api/admin/users/${userId}`, {
    params: { actor_id: actorId },
});

export const updateUser = (userId, payload) => apiClient.put(`/api/admin/users/${userId}`, payload);

export const getStockLogs = () => apiClient.get('/api/admin/stock-logs');

export const getSystemLogs = () => apiClient.get('/api/admin/system-logs');

export const deleteStockLog = (payload) => apiClient.post('/api/admin/stock-logs/delete', payload);
