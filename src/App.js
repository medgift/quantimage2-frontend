import React, { useContext, useEffect, useState } from 'react';
import './App.css';
import { Switch, Route, withRouter } from 'react-router-dom';
import Home from './Home';
import Login from './Login';
import NoMatch from './NoMatch';
import auth from './services/auth';
import { ProtectedRoute } from './utils/ProtectedRoute';
import registerFontAwesomeIcons from './registerFontAwesomeIcons';
import UserContext from './context/UserContext';
import Profile from './Profile';
import Footer from './Footer';
import Header from './Header';

// Register the FontAwesome Icons
registerFontAwesomeIcons();

function App(props) {
  const { setUser } = useContext(UserContext);
  const [settled, setSettled] = useState(false);

  // Check authentication
  useEffect(() => {
    const authenticated = auth.isAuthenticated();
    if (authenticated) setUser(auth.getUser());
    setSettled(true);
  }, [settled, setUser]);

  // Handle login
  const handleLogin = async ({ email, password }) => {
    console.log(`Authenticating as ${email} : ${password}`);

    try {
      const loggedInUser = await auth.login(email, password);
      setUser(loggedInUser);
      return loggedInUser;
    } catch (err) {
      console.log('throwing', err);
      throw new Error(err);
    }
  };

  // Handle logout
  const handleLogout = async () => {
    await auth.logout();
    setUser(null);
  };

  return (
    <>
      {settled ? (
        <div className="App">
          <Header />
          <main className="App-content">
            <Switch>
              <ProtectedRoute exact path="/" component={Home} />
              <ProtectedRoute path="/profile" component={Profile} />
              <Route
                path="/login"
                render={props => <Login onSubmit={handleLogin} />}
              />
              <Route component={NoMatch} />
            </Switch>
          </main>
          <Footer onLogout={handleLogout} />
        </div>
      ) : (
        <div className="App">
          <div className="Main">
            <div className="text-center d-block">Loading...</div>
          </div>
        </div>
      )}
    </>
  );
}

export default withRouter(App);
