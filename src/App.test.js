import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';
import { render } from '@testing-library/react';
import faker from 'faker';
import renderWithRouter from './test-utils';
import UserContext from './context/UserContext';

it('renders without crashing', () => {
  render(<App />);
});

it('redirects to the login page when not logged in', () => {
  const { getByText } = render(<App />);
  getByText(/please sign in/i);
});

it('shows the welcome page when authenticated', () => {
  // Mock user
  const email = faker.internet.email();
  const name = faker.name.findName();
  const user = { email: email, name: name };
  const setCurrentUser = () => {};

  const { getByText } = renderWithRouter(
    <UserContext.Provider value={[user, setCurrentUser]}>
      <App />
    </UserContext.Provider>
  );

  getByText(/the imagine project is part of/i);
});
