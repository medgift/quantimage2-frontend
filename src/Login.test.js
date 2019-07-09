import { render, fireEvent, wait } from '@testing-library/react';
import { makeUser, renderWithRouter } from './test-utils';
import Login from './Login';
import UserContext from './context/UserContext';
import React from 'react';
import faker from 'faker';
import auth from './services/auth';
import App from './App';
import { waitForElement } from '@testing-library/dom';
import AppWrapper from './AppWrapper';

beforeEach(() => {});

afterEach(() => {
  jest.restoreAllMocks();
});

it('submits the values when clicking on the sign in button', () => {
  // Set up mocks etc.
  const handleSubmit = jest.fn();

  // Render
  const {
    getByLabelText,
    getByText,
    getByTestId,
    queryByTestId
  } = renderWithRouter(<Login onSubmit={handleSubmit} />);

  // Appearance is ok
  const usernameInput = getByLabelText(/email address/i);
  const passwordInput = getByLabelText(/password/i);
  const signInButton = getByText(/^sign in/i);

  // No error message is shown
  const errorMessage = queryByTestId('auth-error');
  expect(errorMessage).toBe(null);

  // Behavior is ok
  const email = faker.internet.email();
  const password = faker.internet.password();

  // Input email & password
  fireEvent.change(usernameInput, { target: { value: email } });
  fireEvent.change(passwordInput, { target: { value: password } });

  // Check that it was correctly re-rendered
  expect(usernameInput.value).toBe(email);
  expect(passwordInput.value).toBe(password);

  // Click on the Sign In button
  signInButton.click();

  // Signing in calls the right method with the right parameters
  expect(handleSubmit).toHaveBeenCalledTimes(1);
  expect(handleSubmit).toHaveBeenCalledWith({
    email: email,
    password: password
  });
});

it('shows an error when the credentials are wrong', () => {
  // Set up mocks etc.
  const handleSubmit = jest.fn();

  // Mock that the function returns an error
  handleSubmit.mockImplementationOnce(() => {
    throw new Error('Wrong credentials!');
  });

  // Render
  const { getByText, getByTestId, queryByTestId } = renderWithRouter(<Login />);

  // Appearance is ok
  const signInButton = getByText(/^sign in/i);

  // No error message is shown
  const errorMessage = queryByTestId('auth-error');
  expect(errorMessage).toBe(null);

  // Signing in calls the right method with the right parameters
  signInButton.click();

  // Error message is shown
  getByTestId('auth-error');
});

it('shows the user name correctly when a user is supplied', () => {
  // Mock a user
  let user = {
    email: faker.internet.email(),
    name: faker.name.findName()
  };

  // Render
  const { getByTestId } = renderWithRouter(
    <UserContext.Provider value={{ user: user }}>
      <Login />
    </UserContext.Provider>
  );

  // Check that the message is displayed and contains the user's name
  expect(getByTestId('user-name')).toHaveTextContent(user.name);
});

it('redirects to the referrer after login', async () => {
  // Mock user
  const user = makeUser();
  const password = faker.internet.password();

  // Render the profile without being logged in
  const { getByLabelText, getByText } = renderWithRouter(<AppWrapper />, {
    route: '/profile'
  });

  // Appearance is ok
  const usernameInput = getByLabelText(/email address/i);
  const passwordInput = getByLabelText(/password/i);
  const signInButton = getByText(/^sign in/i);

  // Behavior is ok

  // Input email & password
  fireEvent.change(usernameInput, { target: { value: user.email } });
  fireEvent.change(passwordInput, { target: { value: password } });

  // Mock the authentication
  jest.spyOn(auth, 'isAuthenticated').mockImplementation(() => true);
  jest
    .spyOn(auth, 'login')
    .mockImplementation(async () => Promise.resolve(user));

  // Click on the Sign In button
  signInButton.click();

  // Wait for the fake login to complete
  // Expect to be on the profile page
  await waitForElement(() => getByText(/this is your user profile/i));

  // User name and email should be correct
  expect(getByLabelText('name')).toHaveTextContent(user.name);
  expect(getByLabelText('email')).toHaveTextContent(user.email);
});
