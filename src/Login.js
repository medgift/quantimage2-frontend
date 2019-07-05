import React, { useState, useContext } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import './Login.css';
import UserContext from './context/UserContext';

function Login({ onSubmit, history }) {
  // Set up state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);

  // Get the context
  const { user } = useContext(UserContext);

  // Handle form submissions
  const handleLoginSubmit = async e => {
    // Prevent actual form submission from happening
    e.preventDefault();

    // Extract values from form elements
    const { email, password } = e.target.elements;

    // Call the onSubmit function with the right parameters
    try {
      await onSubmit({
        email: email.value,
        password: password.value
      });

      history.push('/');
    } catch (err) {
      setError(err.message);
    }
  };

  // Handle logout click
  const handleLogoutClick = async e => {};

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
            onChange={e => setEmail(e.target.value)}
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
            onChange={e => setPassword(e.target.value)}
            required
          />
          {error && (
            <div data-testid="auth-error" className="text-danger small">
              {error}
            </div>
          )}
          <hr />
          <button className="btn btn-lg btn-primary btn-block" type="submit">
            Sign in
          </button>
        </form>
      ) : (
        <div data-testid="user-name">
          <p>You are currently signed in, {user.name}!</p>
          <button
            className="btn btn-lg btn-secondary btn-block"
            type="button"
            onClick={handleLogoutClick}
          >
            Logout
          </button>
        </div>
      )}
      <p className="m-2 text-muted">&copy; 2019</p>
    </div>
  );
}

export default Login;
