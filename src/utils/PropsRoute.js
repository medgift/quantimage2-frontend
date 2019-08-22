import React from 'react';
import { Route } from 'react-router-dom';

export const PropsRoute = ({ component: Component, ...rest }) => {
  return (
    <Route
      {...rest}
      render={props => {
        return <Component {...rest} {...props} />;
      }}
    />
  );
};
