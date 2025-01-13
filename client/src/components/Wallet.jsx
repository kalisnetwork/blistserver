import React from 'react';
import { Typography, Box, Container, Grid } from '@mui/material';
import { FaWallet } from 'react-icons/fa';

const Wallet = () => {
    return (
        <Container maxWidth="md">
            <Box mt={4} display="flex" flexDirection="column" alignItems="center">
                <Typography variant="h4" component="h1" gutterBottom>
                    <FaWallet style={{ marginRight: 8 }} />
                    Wallet
                </Typography>
                <Grid container spacing={2}>
                    <Grid item xs={12}>
                        <Typography>
                            This is a sample page to display wallet details.
                        </Typography>
                    </Grid>
                </Grid>
            </Box>
        </Container>
    );
};

export default Wallet;