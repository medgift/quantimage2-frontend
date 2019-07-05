import React from 'react';
import { render } from '@testing-library/react';
import Home from './Home';
import UserContext from './context/UserContext';

it('renders without crashing', () => {
  render(
    <UserContext.Provider value={{ user: { name: 'Roger' } }}>
      <Home />
    </UserContext.Provider>
  );
});
