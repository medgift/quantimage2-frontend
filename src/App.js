import React, { useState, useContext } from 'react';
import './App.css';
import {
  BrowserRouter as Router,
  Switch,
  Route,
  Redirect
} from 'react-router-dom';
import Home from './Home';
import Login from './Login';
import { login } from './services/AuthService';
import registerFontAwesomeIcons from './registerFontAwesomeIcons';
import UserContext from './context/UserContext';
import Profile from './Profile';

// Register the FontAwesome Icons
registerFontAwesomeIcons();

function App(props) {
  const { location } = props;

  const { user: currentUser } = useContext(UserContext);

  let handleLogin = async ({ email, password }) => {
    console.log(`Authenticating as ${email} : ${password}`);

    try {
      const loggedInUser = await login(email, password);
    } catch (err) {
      console.log('throwing', err);
      throw new Error(err);
    }
  };

  return (
    <div className="App">
      <Router>
        <Switch>
          <Route
            exact
            path="/"
            render={props =>
              currentUser ? (
                <Home {...props} />
              ) : (
                <Redirect
                  to={{
                    pathname: '/login',
                    state: { from: props.location }
                  }}
                />
              )
            }
          />
          <Route path="/profile" component={Profile} />
          <Route
            path="/login"
            render={props => <Login {...props} onSubmit={handleLogin} />}
          />
        </Switch>
      </Router>
    </div>
  );
}

export default App;
