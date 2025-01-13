import axios from 'axios';

const api = axios.create({
    baseURL: 'http://localhost:5000/api/payments',
    headers: {
        'Content-Type': 'application/json',
    }
});

export const createNewListing = async (data) => {
    try {
        const response = await api.post('/listings', data, {
            headers: {
                'Content-Type': 'multipart/form-data',
            }
        });
        return response.data;
    } catch (error) {
        console.error("Failed to create new Listing", error.response.data);
        throw error.response.data;
    }
};

export const fetchUserDetails = async (userId) => {
    try {
        const response = await api.get(`/users/${userId}`);
        return response.data;
    } catch (error) {
        console.error("Failed to fetch user details", error.response.data);
        throw error.response.data;
    }
};

// Update this function to use the correct endpoint `/user-listings`
export const fetchUserListings = async (userId) => {
    try {
        const response = await api.get(`/user-listings/${userId}`);
        return response.data;
    } catch (error) {
        console.error("Failed to fetch user listings", error.response.data);
        throw error.response.data;
    }
};

export const fetchPaymentDetailsByOrderId = async (orderId) => {
    try {
        const response = await api.get(`/payment-details/${orderId}`);
        return response.data;
    } catch (error) {
        console.error("Failed to fetch payment details", error.response.data);
        throw error.response.data;
    }
};

export const createUser = async (data) => {
    try {
        const response = await api.post('/users', data);
        return response.data;
    } catch (error) {
        console.error("Failed to create user", error.response.data);
        throw error.response.data;
    }
};
