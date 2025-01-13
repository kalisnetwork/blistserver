import React from 'react';
import { Typography, Box, Container, Grid } from '@mui/material';
import { FaPiggyBank, FaInfoCircle } from 'react-icons/fa';

const BankDetails = () => {
    return (
        <Container maxWidth="md">
            <Box mt={4} display="flex" flexDirection="column" alignItems="center">
                <Typography variant="h4" component="h1" gutterBottom>
                    <FaPiggyBank style={{ marginRight: 8 }} />
                    Bank Details
                </Typography>
                <Grid container spacing={2}>
                    <Grid item xs={12}>
                        <Box display="flex" alignItems="center">
                            <FaInfoCircle style={{ marginRight: 8 }} />
                            <Typography>
                                This is a sample page to display bank details.
                            </Typography>
                        </Box>
                    </Grid>
                </Grid>
            </Box>
        </Container>
    );
};

export default BankDetails;