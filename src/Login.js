import React, { useState, useContext } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import './Login.css';
import UserContext from './context/UserContext';
import { Redirect } from 'react-router-dom';

function Login({ onSubmit, location, history }) {
  // Set up state
  const [redirectToReferrer, setRedirectToReferrer] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);

  const [formValid, setFormValid] = useState(true);
  const [formPending, setFormPending] = useState(false);

  // Get the context
  const { user } = useContext(UserContext);

  // Handle form changes
  const handleFormChange = (mutator, value, e) => {
    mutator(value);
    const form = e.target.form;
    setFormValid(form.checkValidity());
  };

  // Handle form submissions
  const handleLoginSubmit = async e => {
    // Prevent actual form submission from happening
    e.preventDefault();

    setFormPending(true);

    // Extract values from form elements
    const { email, password } = e.target.elements;

    // Call the onSubmit function with the right parameters
    try {
      await onSubmit({
        email: email.value,
        password: password.value
      });

      setRedirectToReferrer(true);
    } catch (err) {
      setError(err.message);
    }

    setFormPending(false);
  };

  let { from } = location.state || { from: { pathname: '/' } };

  if (redirectToReferrer) return <Redirect to={from} />;

  return (
    <div className="Login">
      <div className="rounded-background bg-primary text-white">
        <FontAwesomeIcon icon="microscope" size="5x" />
      </div>
      <h1 className="m-2">IMAGINE</h1>
      <hr />
      {!user ? (
        <form className="form-signin" onSubmit={handleLoginSubmit}>
          <h3 className="h3 m-2">Please sign in</h3>
          <label htmlFor="email" className="sr-only">
            Email address
          </label>
          <input
            type="email"
            id="email"
            className="form-control"
            placeholder="Email address"
            value={email}
            onChange={e => handleFormChange(setEmail, e.target.value, e)}
            required
            autoFocus
          />
          <label htmlFor="password" className="sr-only">
            Password
          </label>
          <input
            type="password"
            id="password"
            className="form-control"
            placeholder="Password"
            value={password}
            onChange={e => handleFormChange(setPassword, e.target.value, e)}
            required
          />
          {error && (
            <div data-testid="auth-error" className="text-danger small">
              {error}
            </div>
          )}
          <hr />
          <button
            disabled={!formValid || formPending}
            className="btn btn-lg btn-primary btn-block"
            type="submit"
          >
            Sign in
            {formPending && (
              <FontAwesomeIcon className="ml-2" icon="sync" spin={true} />
            )}
          </button>
        </form>
      ) : (
        <div data-testid="user-name">
          <p>You are currently signed in, {user.name}!</p>
        </div>
      )}
      <p className="m-2 text-muted">&copy; 2019</p>
    </div>
  );
}

export default Login;
