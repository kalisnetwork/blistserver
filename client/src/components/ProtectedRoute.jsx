// src/components/ProtectedRoute.jsx
import React from 'react';
import { useAuth } from './FirebaseAuth';
import { Navigate } from 'react-router-dom';


const ProtectedRoute = ({ children, allowAnonymous}) => {
  const { currentUser, loading} = useAuth();


 if (loading) {
    return null;
  }


  if (!currentUser && !allowAnonymous) {
      return <Navigate to="/login" />;
  }

    return children;
};

export default ProtectedRoute;