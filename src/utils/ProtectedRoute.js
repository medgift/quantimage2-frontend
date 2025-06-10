import React, { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import UserContext from '../context/UserContext';

export const ProtectedRoute = ({ children }) => {
  const { isAdmin } = useContext(UserContext);

  if (isAdmin) {
    return children;
  } else {
    return <Navigate to="/" replace />;
  }
};