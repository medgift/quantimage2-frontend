// this is a handy function that I would utilize for any component
// that relies on the router being in context
import { render } from '@testing-library/react';
import { createMemoryHistory } from 'history';
import { Router } from 'react-router-dom';
import React from 'react';
import faker from 'faker';

export function renderWithRouter(
  ui,
  {
    route = '/',
    history = createMemoryHistory({ initialEntries: [route] })
  } = {}
) {
  return {
    ...render(<Router history={history}>{ui}</Router>),
    // adding `history` to the returned utilities to allow us
    // to reference it in our tests (just try to avoid using
    // this to test implementation details).
    history
  };
}

export function makeUser(
  firstName = faker.name.firstName(),
  lastName = faker.name.lastName()
) {
  const email = faker.internet.email(firstName, lastName);
  const name = `${firstName} ${lastName}`;
  const user = { email: email, name: name };

  return user;
}
