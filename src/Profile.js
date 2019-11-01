import React, { useContext } from 'react';
import UserContext from './context/UserContext';

function Profile() {
  const user = useContext(UserContext);

  return (
    user &&
    user.user && (
      <section id="profile">
        <h2>Profile</h2>
        <p>This is your user profile</p>
        <p aria-label="name">
          {user.user.firstName} {user.user.lastName}
        </p>
        <p aria-label="email">
          <a href={`mailto:${user.user.email}`}>{user.user.email}</a>
        </p>
      </section>
    )
  );
}

export default Profile;
