import React, { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import UserContext from '../context/UserContext';
import { useKeycloak } from '@react-keycloak/web';

export const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { isAdmin } = useContext(UserContext);
  const { keycloak, initialized } = useKeycloak();

  if (!initialized) {
    return <div>Loading...</div>;
  }

  if (!keycloak.authenticated) {
    // Trigger login and remember the current path
    keycloak.login({
      redirectUri: window.location.origin + window.location.pathname
    });
    return <div>Redirecting to login...</div>;
  }

  // Check admin access only for admin-only routes
  if (adminOnly && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  // User is authenticated (and admin if required), render children
  return children;
};
