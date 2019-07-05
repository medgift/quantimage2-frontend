import React, { useContext } from 'react';
import UserContext from './context/UserContext';

function Home() {
  const { user } = useContext(UserContext);

  return (
    <div>
      <header className="App-header">
        <h1>IMAGINE</h1>
      </header>
      <section id="intro">
        <h2>Intro</h2>
        <p>Hello {user.name}!</p>
        <p data-testid="intro-text">The IMAGINE project is part of...</p>
      </section>
    </div>
  );
}

export default Home;
