import React, { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import UserContext from '../context/UserContext';
import { useKeycloak } from '@react-keycloak/web';

export const ProtectedRoute = ({ children }) => {
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

  if (isAdmin) {
    return children;
  } else {
    return <Navigate to="/" replace />;
  }
};
