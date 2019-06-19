import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import './Login.css';

function Login() {
  return (
    <div className="Login">
      <form className="form-signin">
        <div className="rounded-background bg-primary text-white">
          <FontAwesomeIcon icon="microscope" size="5x" />
        </div>
        <h1 className="m-2">IMAGINE</h1>
        <hr />
        <h3 className="h3 m-2">Please sign in</h3>
        <label htmlFor="inputEmail" className="sr-only">
          Email address
        </label>
        <input
          type="email"
          id="inputEmail"
          className="form-control"
          placeholder="Email address"
          required
          autoFocus
        />
        <label htmlFor="inputPassword" className="sr-only">
          Password
        </label>
        <input
          type="password"
          id="inputPassword"
          className="form-control"
          placeholder="Password"
          required
        />
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
