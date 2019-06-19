import React, { useState } from 'react';
import './App.css';
import { BrowserRouter as Router, Route, Redirect } from 'react-router-dom';
import Home from './Home';
import Login from './Login';
import registerFontAwesomeIcons from './registerFontAwesomeIcons';

// Register the FontAwesome Icons
registerFontAwesomeIcons();

function App(props) {
  let [user, setUser] = useState(null);

  let handleSubmit = ({ email, password }) => {
    console.log(
      `Going to authenticate with email : ${email} and password: ${password}`
    );
  };

  return (
    <Router>
      {(!user || !user.isLogged) && (
        <Redirect
          to={{
            pathname: '/login',
            state: { from: props.location }
          }}
        />
      )}
      {user && user.isLogged && (
        <Redirect
          to={{
            pathname: '/home',
            state: { from: props.location }
          }}
        />
      )}
      <Route path="/home" component={Home} />
      <Route
        path="/login"
        render={props => <Login {...props} onSubmit={handleSubmit} />}
      />
    </Router>
  );
}

export default App;
