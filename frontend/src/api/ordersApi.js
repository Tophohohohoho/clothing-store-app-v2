import apiClient from './client';

export const checkoutOrder = (payload) => apiClient.post('/api/orders/checkout', payload);

export const checkoutPosOrder = (payload) => apiClient.post('/api/admin/pos/checkout', payload);

export const getOrderHistory = () => apiClient.get('/api/orders/history');

export const uploadReceipt = (orderId, payload) => apiClient.put(`/api/orders/${orderId}/receipt`, payload);

export const cancelReceipt = (orderId, payload) => apiClient.put(`/api/orders/${orderId}/receipt/cancel`, payload);

export const cancelOrder = (orderId, payload) => apiClient.put(`/api/orders/${orderId}/cancel`, payload);
