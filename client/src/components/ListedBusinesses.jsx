// src/components/ListedBusinesses.jsx
import React, { useState, useEffect } from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Typography,
    CircularProgress,
    Button,
    Box,
    Chip,
} from '@mui/material';
import { useAuth } from './FirebaseAuth';
import { fetchUserListings } from '../services/api';

const ListedBusinesses = () => {
    const [businesses, setBusinesses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const { currentUser } = useAuth();

    useEffect(() => {
        const loadBusinesses = async () => {
            if (currentUser) {
                try {
                    const userListings = await fetchUserListings(currentUser.uid); // Correct function call
                    if (userListings && userListings.listings) {
                        const listings = userListings.listings;
                        // No need to call fetchPaymentDetailsByOrderId here
                        setBusinesses(listings);
                    } else {
                        setBusinesses([]);
                    }
                } catch (err) {
                    console.error('Error fetching businesses:', err);
                    setError('Failed to load businesses. Please try again later.');
                } finally {
                    setLoading(false);
                }
            }
        };

        loadBusinesses();
    }, [currentUser]);

    if (loading) {
        return <CircularProgress />;
    }

    if (error) {
        return <Typography color="error">{error}</Typography>;
    }

    return (
        <Box sx={{ width: '100%', overflowX: 'auto' }}>
            <Typography variant="h4" component="h1" gutterBottom>
                Listed Businesses
            </Typography>
            <TableContainer component={Paper}>
                <Table sx={{ minWidth: 650 }} aria-label="listed businesses table">
                    <TableHead>
                        <TableRow>
                            <TableCell>Business Name</TableCell>
                            <TableCell>Category</TableCell>
                            <TableCell>Contact Person</TableCell>
                            <TableCell>Phone</TableCell>
                            <TableCell>Payment Status</TableCell>
                            <TableCell>Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {businesses.map((business) => (
                            <TableRow key={business.id}>
                                <TableCell component="th" scope="row">
                                    {business.businessName}
                                </TableCell>
                                <TableCell>{business.mainCategory}</TableCell>
                                <TableCell>{business.contactPerson}</TableCell>
                                <TableCell>{business.phoneNumber}</TableCell>
                                <TableCell>
                                    <Chip
                                        label={business.paymentStatus}
                                        color={business.paymentStatus === 'paid' ? 'success' : 'warning'}
                                    />
                                </TableCell>
                                <TableCell>
                                    <Button variant="outlined" size="small" onClick={() => {/* Handle edit */}}>
                                        Edit
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
};

export default ListedBusinesses;
