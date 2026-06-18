import apiClient from './client';

export const checkoutOrder = (payload) => apiClient.post('/api/orders/checkout', payload);

export const getOrderHistory = (username) => apiClient.get(`/api/orders/history/${encodeURIComponent(username)}`);

export const uploadReceipt = (orderId, payload) => apiClient.put(`/api/orders/${orderId}/receipt`, payload);

export const cancelOrder = (orderId, payload) => apiClient.put(`/api/orders/${orderId}/cancel`, payload);
