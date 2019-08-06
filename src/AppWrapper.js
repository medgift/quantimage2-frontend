import React, { useState } from 'react';
import UserContext from './context/UserContext';
import SocketContext from './context/SocketContext';
import App from './App';
import io from 'socket.io-client';
import { pythonBackendBaseURL } from './services/config';

// Connect to Socket.IO
const socket = io(pythonBackendBaseURL, {});
socket.on('connect', () => {
  console.log('Successfully connected to Socket.IO server!');
});

function AppWrapper(props) {
  const [authenticatedUser, setAuthenticatedUser] = useState(
    props.user ? props.user : null
  );

  return (
    <SocketContext.Provider value={socket}>
      <UserContext.Provider
        value={{ user: authenticatedUser, setUser: setAuthenticatedUser }}
      >
        <App />
      </UserContext.Provider>
    </SocketContext.Provider>
  );
}

export default AppWrapper;
