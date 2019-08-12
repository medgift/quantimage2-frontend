import React, { useContext, useEffect, useState } from 'react';
import './App.css';
import { Switch, Route, withRouter } from 'react-router-dom';
import Home from './Home';
import Login from './Login';
import NoMatch from './NoMatch';
import auth from './services/auth';
import { ProtectedRoute } from './utils/ProtectedRoute';
import registerFontAwesomeIcons from './registerFontAwesomeIcons';
import UserContext from './context/UserContext';
import Profile from './Profile';
import Footer from './Footer';
import Header from './Header';
import Features from './Features';
import Study from './Study';
import Kheops from './services/kheops';

// Register the FontAwesome Icons
registerFontAwesomeIcons();

function App(props) {
  const { setUser } = useContext(UserContext);
  const [settled, setSettled] = useState(false);

  const [albums, setAlbums] = useState([]);
  const [studies, setStudies] = useState({});
  const [dataFetched, setDataFetched] = useState(false);
  const [kheopsError, setKheopsError] = useState(false);

  // Check authentication
  useEffect(() => {
    const authenticated = auth.isAuthenticated();
    if (authenticated) setUser(auth.getUser());
    setSettled(true);
  }, [setUser]);

  // Get albums / studies
  useEffect(() => {
    async function getAlbums() {
      try {
        let albums = await Kheops.albums();
        albums = albums.sort((a1, a2) => a1.name.localeCompare(a2.name));
        setAlbums(albums);
        getStudies(albums);
      } catch (err) {
        setKheopsError(true);
      }
    }

    async function getStudies(albums) {
      const studies = {};
      await Promise.all(
        albums.map(async album => {
          const albumStudies = await Kheops.studies(album.album_id);
          studies[album.album_id] = albumStudies;
        })
      );

      setStudies(studies);

      setDataFetched(true);
    }

    getAlbums();
  }, []);

  // Handle login
  const handleLogin = async ({ email, password }) => {
    console.log(`Authenticating as ${email} : ${password}`);

    try {
      const loggedInUser = await auth.login(email, password);
      setUser(loggedInUser);
      return loggedInUser;
    } catch (err) {
      console.log('throwing', err);
      throw new Error(err);
    }
  };

  // Handle logout
  const handleLogout = async () => {
    await auth.logout();
    setUser(null);
  };

  return (
    <>
      {settled ? (
        <div className="App">
          <Header onLogout={handleLogout} />
          <main className="App-content">
            <Switch>
              <ProtectedRoute
                exact
                path="/"
                component={Home}
                dataFetched={dataFetched}
                kheopsError={kheopsError}
                albums={albums}
                studies={studies}
              />
              <ProtectedRoute
                path="/features"
                component={Features}
                kheopsError={kheopsError}
              />
              <ProtectedRoute
                path="/study/:studyUID"
                component={Study}
                kheopsError={kheopsError}
              />
              <ProtectedRoute path="/profile" component={Profile} />
              <Route
                path="/login"
                render={props => <Login onSubmit={handleLogin} />}
              />
              <Route component={NoMatch} />
            </Switch>
          </main>
          <Footer />
        </div>
      ) : (
        <div className="App">
          <div className="Main">
            <div className="text-center d-block">Loading...</div>
          </div>
        </div>
      )}
    </>
  );
}

export default withRouter(App);
