import React, { useState } from 'react';
import './App.css';
import { library } from '@fortawesome/fontawesome-svg-core';
import { faMicroscope } from '@fortawesome/free-solid-svg-icons';
import { BrowserRouter as Router, Route, Redirect } from 'react-router-dom';
import Home from './Home';
import Login from './Login';

// Add icons to the library
library.add(faMicroscope);

function App(props) {
  let [user, setUser] = useState(null);

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
      <Route path="/login" component={Login} />
    </Router>
  );
}

export default App;
