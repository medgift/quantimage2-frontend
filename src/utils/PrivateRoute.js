import React, { useContext } from 'react';
import { Redirect, Route } from 'react-router-dom';
import UserContext from '../context/UserContext';

export const PrivateRoute = ({ component: Component, ...rest }) => {
  const { isAdmin } = useContext(UserContext);

  if (isAdmin) {
    return (
      <Route
        {...rest}
        render={props => {
          return <Component {...rest} {...props} />;
        }}
      />
    );
  } else {
    return <Redirect to="/"></Redirect>;
  }
};
