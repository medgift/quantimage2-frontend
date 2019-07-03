import React from 'react';

const UserContext = React.createContext([
  undefined, // Initial value
  () => {} // Mutator
]);

export default UserContext;
