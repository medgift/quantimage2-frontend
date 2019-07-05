import React, { useContext } from 'react';
import './App.css';
import { Switch, Route, Redirect } from 'react-router-dom';
import Home from './Home';
import Login from './Login';
import NoMatch from './NoMatch';
import auth from './services/auth';
import { ProtectedRoute } from './utils/ProtectedRoute';
import registerFontAwesomeIcons from './registerFontAwesomeIcons';
import UserContext from './context/UserContext';
import Profile from './Profile';

// Register the FontAwesome Icons
registerFontAwesomeIcons();

function App(props) {
  const { user: currentUser, setUser } = useContext(UserContext);

  let handleLogin = async ({ email, password }) => {
    console.log(`Authenticating as ${email} : ${password}`);

    try {
      const loggedInUser = await auth.login(email, password);
      setUser(loggedInUser);
    } catch (err) {
      console.log('throwing', err);
      throw new Error(err);
    }
  };

  return (
    <div className="App">
      <Switch>
        <ProtectedRoute exact path="/" component={Home} />
        <Route path="/profile" component={Profile} />
        <Route
          path="/login"
          render={props => <Login {...props} onSubmit={handleLogin} />}
        />
        <Route component={NoMatch} />
      </Switch>
    </div>
  );
}

export default App;
