import React from 'react';
import faker from 'faker';

const UserContext = React.createContext({
  user: {
    name: faker.name.findName(),
    email: faker.internet.email()
  }
});

export default UserContext;
