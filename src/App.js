import React, { useContext, useState } from 'react';
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

// Register the FontAwesome Icons
registerFontAwesomeIcons();

function App(props) {
  const [currentUser, setCurrentUser] = useState(null);

  let handleLogin = async ({ email, password }) => {
    console.log(
      `Going to authenticate with email : ${email} and password: ${password}`
    );

    try {
      const user = await login(email, password);
      setCurrentUser(user);

      // Redirect to main page after login
      props.history.push('/');
    } catch (err) {
      console.log('throwing', err);
      throw new Error(err);
    }
  };

  return (
    <UserContext.Provider value={[currentUser, setCurrentUser]}>
      <Router>
        {!currentUser && (
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
            exact
            path="/login"
            render={props => <Login {...props} onSubmit={handleLogin} />}
          />
        </Switch>
      </Router>
    </UserContext.Provider>
  );
}

export default App;
