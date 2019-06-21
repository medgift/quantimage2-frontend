import React, { useState } from 'react';
import './App.css';
import {
  BrowserRouter as Router,
  Switch,
  Route,
  Redirect
} from 'react-router-dom';
import Home from './Home';
import Login from './Login';
import registerFontAwesomeIcons from './registerFontAwesomeIcons';
import { login } from './services/auth';

// Register the FontAwesome Icons
registerFontAwesomeIcons();

function App(props) {
  let [user, setUser] = useState(null);

  let handleSubmit = async ({ email, password }) => {
    console.log(
      `Going to authenticate with email : ${email} and password: ${password}`
    );

    try {
      const user = await login(email, password);
      setUser(user);
    } catch (err) {
      console.log('throwing', err);
      throw new Error(err);
    }
  };

  return (
    <Router>
      {!user && (
        <Redirect
          to={{
            pathname: '/login',
            state: { from: props.location }
          }}
        />
      )}
      <Switch>
        <Route exact path="/" component={Home} />
        <Route
          path="/login"
          render={props => (
            <Login {...props} user={user} onSubmit={handleSubmit} />
          )}
        />
      </Switch>
    </Router>
  );
}

export default App;
