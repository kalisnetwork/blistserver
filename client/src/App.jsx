// src/App.jsx
import React from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import theme from './theme';
import Layout from './components/Layout';
import LoginForm from './components/LoginForm';
import ListingForm from './components/ListingForm';
import BankDetails from './components/BankDetails';
import Wallet from './components/Wallet';
import { AuthProvider } from './components/FirebaseAuth';
import ProtectedRoute from './components/ProtectedRoute';
import ListedBusinesses from './components/ListedBusinesses';

const App = () => {
  return (
    <ThemeProvider theme={theme}>
        <AuthProvider>
      <BrowserRouter>
        <Routes>
              <Route path="/login" element={<LoginForm />} />
              <Route
                   path="/"
                   element={
                       <ProtectedRoute>
                           <Layout>
                                <ListingForm />
                            </Layout>
                       </ProtectedRoute>
                   }
              />
            
            <Route
                path="/listed-businesses"
                element={
                      <ProtectedRoute>
                          <Layout>
                            <ListedBusinesses />
                          </Layout>
                      </ProtectedRoute>
                }
          />
        </Routes>
      </BrowserRouter>
        </AuthProvider>
    </ThemeProvider>
  );
};

export default App;