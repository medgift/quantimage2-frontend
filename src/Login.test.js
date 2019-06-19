import { render, fireEvent } from '@testing-library/react';
import Login from './Login';
import React from 'react';
import faker from 'faker';

beforeEach(() => {});

it('renders correctly', () => {
  // Set up mocks etc.
  const onSubmit = jest.fn();

  // Render
  const { debug, getByLabelText, getByText, queryByText } = render(<Login />);

  // Appearance is ok
  const usernameInput = getByLabelText(/email address/i);
  const passwordInput = getByLabelText(/password/i);
  const signInButton = getByText(/^sign in/i);

  // Initial values are ok
  expect(usernameInput.value).toBe('');
  expect(passwordInput.value).toBe('');

  // No error message is shown
  const errorMessage = queryByText(/the given credentials were incorrect/i);
  expect(errorMessage).toBe(null);
});

it('submits the values when clicking on the sign in button', () => {
  // Set up mocks etc.
  const handleSubmit = jest.fn();

  // Render
  const { debug, getByLabelText, getByText } = render(
    <Login onSubmit={handleSubmit} />
  );

  // Appearance is ok
  const usernameInput = getByLabelText(/email address/i);
  const passwordInput = getByLabelText(/password/i);
  const signInButton = getByText(/^sign in/i);

  // Behavior is ok
  const email = faker.internet.email();
  const password = faker.internet.password();

  // Input email address & Password
  fireEvent.change(usernameInput, { target: { value: email } });
  fireEvent.change(passwordInput, { target: { value: password } });

  // Check that it was correctly re-rendered
  expect(usernameInput.value).toBe(email);
  expect(passwordInput.value).toBe(password);

  // Signing in calls the right method with the right parameters
  signInButton.click();

  expect(handleSubmit).toHaveBeenCalledTimes(1);
  expect(handleSubmit).toHaveBeenCalledWith({
    email: email,
    password: password
  });
});

it('shows an error when the credentials are wrong', () => {});
