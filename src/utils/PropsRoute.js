import React from 'react';
import { Route } from 'react-router-dom';
import { useKeycloak } from 'react-keycloak';

export const PropsRoute = ({ component: Component, ...rest }) => {
  const [keycloak, initialized] = useKeycloak();

  return (
    <Route
      {...rest}
      render={props => {
        return <Component {...rest} {...props} />;
      }}
    />
  );
};
