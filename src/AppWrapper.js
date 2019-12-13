import React, { useState } from 'react';
import SocketContext from './context/SocketContext';
import App from './App';
import io from 'socket.io-client';
import { pythonBackendBaseURL } from './services/config';
import Keycloak from 'keycloak-js';
import { KeycloakProvider } from 'react-keycloak';
import { transitions, positions, Provider as AlertProvider } from 'react-alert';
import AlertTemplate from './components/AlertTemplate';
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

// optional configuration
const options = {
  // you can also just use 'bottom center'
  position: positions.BOTTOM_CENTER,
  timeout: 4000,
  offset: '30px',
  // you can also just use 'scale'
  transition: transitions.FADE
};

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
          <AlertProvider template={AlertTemplate} {...options}>
            <App setUser={setUser} setIsAdmin={setIsAdmin} />
          </AlertProvider>
        </UserContext.Provider>
      </SocketContext.Provider>
    </KeycloakProvider>
  );
}

export default AppWrapper;
