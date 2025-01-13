// src/components/WithAuth.jsx
import React from 'react';
import { useAuth } from './FirebaseAuth';
import { useNavigate } from 'react-router-dom';
import { CircularProgress } from '@mui/material';

const WithAuth = ({ children, allowAnonymous }) => {
    const { currentUser, loading} = useAuth();
  const navigate = useNavigate();


  if (loading) {
    return <CircularProgress />;
  }

    if (!currentUser && !allowAnonymous) {
       navigate("/login");
    return null;
  }
    return children;
};

export default WithAuth;