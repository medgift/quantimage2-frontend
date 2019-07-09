import React, { useContext } from 'react';
import UserContext from './context/UserContext';

function Profile() {
  const { user, setUser } = useContext(UserContext);

  return (
    <section id="profile">
      <h2>Profile</h2>
      <p>This is your user profile</p>
      <p aria-label="name">{user.name}</p>
      <p aria-label="email">
        <a href={`mailto:${user.email}`}>{user.email}</a>
      </p>
    </section>
  );
}

export default Profile;
