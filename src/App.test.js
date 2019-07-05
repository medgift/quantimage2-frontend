import React from 'react';
import { renderWithRouter } from './test-utils';
import faker from 'faker';
import App from './App';
import auth from './services/auth';
import UserContext from './context/UserContext';

const reactRouter = require('react-router-dom');

it('renders without crashing', () => {
  renderWithRouter(<App />);
});

it('redirects to the login page when not logged in', async () => {
  const { getByText, history } = renderWithRouter(<App />);

  // We should see the "sign in" button
  getByText(/^sign in/i);

  // The location should be /login
  expect(history.location.pathname).toBe('/login');
});

it('shows the welcome page when authenticated', async () => {
  // Mock user
  const firstName = faker.name.firstName();
  const lastName = faker.name.lastName();
  const email = faker.internet.email(firstName, lastName);
  const name = `${firstName} ${lastName}`;
  const user = { email: email, name: name };

  // Assume that we are authenticated
  auth.isAuthenticated = jest.fn(() => true);

  // Render with user to be show the Homepage
  const { getByTestId, history } = renderWithRouter(
    <UserContext.Provider value={{ user: user }}>
      <App />
    </UserContext.Provider>
  );

  // We should see the intro text
  getByTestId('intro-text');

  // The location should be /
  expect(history.location.pathname).toBe('/');
});
