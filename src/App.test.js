import React from 'react';
import { makeUser, renderWithRouter } from './test-utils';
import { fireEvent } from '@testing-library/react';
import App from './App';

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

  // We should see the home page header
  getByTestId('welcome-page-header');

  // The location should be /
  expect(history.location.pathname).toBe('/');
});

it('shows the profile page when clicked', async () => {
  // Mock user
  const user = makeUser();

  // Assume that we are authenticated
  jest.spyOn(auth, 'isAuthenticated').mockImplementation(() => true);

  // Render with user to be show the Homepage
  const { getByText, history } = renderWithRouter(
    <UserContext.Provider value={{ user: user, setUser: () => {} }}>
      <App />
    </UserContext.Provider>
  );

  // We should see the navbar with the profile link
  const profileLink = getByText(/^Profile/);

  // Click on login
  fireEvent.click(profileLink);

  // We should see the profile page
  getByText(/this is your user profile/i);

  // The location should be /profile
  expect(history.location.pathname).toBe('/profile');
});

it('shows 404 page when a non-matching route is given', () => {
  const { getByText } = renderWithRouter(<App />, { route: '/doesnotmatch' });
  getByText(/404 not found/i);
});
