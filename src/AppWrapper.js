import React, { useState } from 'react';
import UserContext from './context/UserContext';
import App from './App';
import { BrowserRouter as Router } from 'react-router-dom';

function AppWrapper(props) {
  const [authenticatedUser, setAuthenticatedUser] = useState(
    props.user ? props.user : null
  );

  return (
    <UserContext.Provider
      value={{ user: authenticatedUser, setUser: setAuthenticatedUser }}
    >
      <App />
    </UserContext.Provider>
  );
}

export default AppWrapper;
