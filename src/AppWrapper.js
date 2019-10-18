import React, { useState } from 'react';
import SocketContext from './context/SocketContext';
import App from './App';
import io from 'socket.io-client';
import { pythonBackendBaseURL } from './services/config';
import Keycloak from 'keycloak-js';
import { KeycloakProvider } from 'react-keycloak';
import UserContext from './context/UserContext';

// Setup Keycloak instance
const keycloak = new Keycloak({
  url: process.env.REACT_APP_KEYCLOAK_URL,
  clientId: 'imagine-frontend',
  realm: 'IMAGINE'
});

const keycloakProviderInitConfig = {
  onLoad: 'login-required'
};

// Connect to Socket.IO
const socket = io(pythonBackendBaseURL, {});
socket.on('connect', () => {
  console.log('Successfully connected to Socket.IO server!');
});

function AppWrapper(props) {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  return (
    <KeycloakProvider
      keycloak={keycloak}
      initConfig={keycloakProviderInitConfig}
    >
      <SocketContext.Provider value={socket}>
        <UserContext.Provider value={{ user: user, isAdmin: isAdmin }}>
          <App setUser={setUser} setIsAdmin={setIsAdmin} />
        </UserContext.Provider>
      </SocketContext.Provider>
    </KeycloakProvider>
  );
}

export default AppWrapper;
