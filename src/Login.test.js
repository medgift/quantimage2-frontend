import { render, fireEvent } from '@testing-library/react';
import Login from './Login';
import React from 'react';
import faker from 'faker';

beforeEach(() => {});

it('submits the values when clicking on the sign in button', () => {
  // Set up mocks etc.
  const handleSubmit = jest.fn();

  // Render
  const {
    debug,
    getByLabelText,
    getByText,
    getByTestId,
    queryByTestId
  } = render(<Login onSubmit={handleSubmit} />);

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
  const {
    debug,
    getByLabelText,
    getByText,
    getByTestId,
    queryByTestId
  } = render(<Login onSubmit={handleSubmit} />);

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

  // Signing in calls the right method with the right parameters
  signInButton.click();

  // Error message is shown
  getByTestId('auth-error');
});

it('shows the user name correctly', () => {
  // Mock a user
  let user = {
    email: faker.internet.email(),
    name: faker.name.findName()
  };

  // Render
  const { getByTestId } = render(<Login user={user} />);

  // Check that the message is displayed and contains the user's name
  expect(getByTestId('user-name')).toHaveTextContent(user.name);
});
