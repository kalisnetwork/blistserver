import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import theme from './theme';
import Layout from './components/Layout';
import LoginForm from './components/LoginForm';
import ListingForm from './components/ListingForm';
import ListedBusinesses from './components/ListedBusinesses';
import { AuthProvider } from './components/FirebaseAuth';
import ProtectedRoute from './components/ProtectedRoute';

const App = () => {
  return (
    <ThemeProvider theme={theme}>
      <AuthProvider>
        <BrowserRouter basename="/business-listings">
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
