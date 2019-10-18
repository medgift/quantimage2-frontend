import React from 'react';

const UserContext = React.createContext({
  user: null,
  isAdmin: null
});

export default UserContext;
