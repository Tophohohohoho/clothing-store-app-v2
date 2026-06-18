import apiClient from './client';

export const login = (credentials) => apiClient.post('/api/login', credentials);

export const register = (payload) => apiClient.post('/api/register', payload);

export const updateProfile = (userId, payload) => apiClient.put(`/api/users/${userId}/profile`, payload);

export const getAddresses = (userId) => apiClient.get(`/api/users/${userId}/addresses`);

export const createAddress = (userId, payload) => apiClient.post(`/api/users/${userId}/addresses`, payload);

export const updateAddress = (userId, addressId, payload) => apiClient.put(`/api/users/${userId}/addresses/${addressId}`, payload);

export const setDefaultAddress = (userId, addressId) => apiClient.post(`/api/users/${userId}/addresses/${addressId}/default`);
