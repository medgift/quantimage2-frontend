import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import './Login.css';

function Login({ user, onSubmit }) {
  // Set up state
  let [email, setEmail] = useState('');
  let [password, setPassword] = useState('');
  let [error, setError] = useState(null);

  // Handle form submissions
  let handleSubmit = async e => {
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
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="Login">
      <form className="form-signin" onSubmit={handleSubmit}>
        <div className="rounded-background bg-primary text-white">
          <FontAwesomeIcon icon="microscope" size="5x" />
        </div>
        <h1 className="m-2">IMAGINE</h1>
        <hr />
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
        {user && (
          <div data-testid="user-name" className="text-success small">
            Welcome, {user.name}!
          </div>
        )}
        <hr />
        <button className="btn btn-lg btn-primary btn-block" type="submit">
          Sign in
        </button>
        <p className="m-2 text-muted">&copy; 2019</p>
      </form>
    </div>
  );
}

export default Login;
