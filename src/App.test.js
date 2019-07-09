import React from 'react';
import { makeUser, renderWithRouter } from './test-utils';
import faker from 'faker';
import App from './App';
import auth from './services/auth';
import UserContext from './context/UserContext';

const reactRouter = require('react-router-dom');

afterEach(() => {
  jest.restoreAllMocks();
});

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
  const user = makeUser();

  // Assume that we are authenticated
  jest.spyOn(auth, 'isAuthenticated').mockImplementation(() => true);

  // Render with user to be show the Homepage
  const { getByTestId, history, debug } = renderWithRouter(
    <UserContext.Provider value={{ user: user, setUser: () => {} }}>
      <App />
    </UserContext.Provider>
  );

  // We should see the intro text
  getByTestId('intro-text');

  // The location should be /
  expect(history.location.pathname).toBe('/');
});

it('shows 404 page when a non-matching route is given', () => {
  const { getByText } = renderWithRouter(<App />, { route: '/doesnotmatch' });
  getByText(/404 not found/i);
});
