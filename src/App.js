import React, { useEffect, useState } from 'react';
import './App.css';
import { Switch, Route, withRouter } from 'react-router-dom';
import Home from './Home';
import NoMatch from './NoMatch';
import { PropsRoute } from './utils/PropsRoute';
import registerFontAwesomeIcons from './registerFontAwesomeIcons';
import Profile from './Profile';
import Footer from './Footer';
import Header from './Header';
import Features from './Features';
import Study from './Study';
import Kheops from './services/kheops';
import { useKeycloak } from 'react-keycloak';

// Register the FontAwesome Icons
registerFontAwesomeIcons();

function App({ setUser }) {
  const [albums, setAlbums] = useState([]);
  const [studies, setStudies] = useState({});
  const [dataFetched, setDataFetched] = useState(false);
  const [kheopsError, setKheopsError] = useState(false);

  const [keycloak, initialized] = useKeycloak();

  useEffect(() => {
    if (keycloak && initialized) {
      keycloak.loadUserProfile().success(profile => {
        setUser(profile);
      });
    }
  }, [keycloak, initialized, setUser]);

  // Get albums / studies
  useEffect(() => {
    async function getAlbums() {
      try {
        let albums = await Kheops.albums(keycloak.token);
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
          const albumStudies = await Kheops.studies(
            keycloak.token,
            album.album_id
          );
          studies[album.album_id] = albumStudies;
        })
      );

      setStudies(studies);

      setDataFetched(true);
    }

    if (keycloak && initialized) {
      getAlbums();
    }
  }, [keycloak, initialized, setUser]);

  // Handle logout
  const handleLogout = async () => {
    keycloak.logout();
  };

  return (
    <>
      {initialized ? (
        <div className="App">
          <Header onLogout={handleLogout} />
          <main className="App-content">
            <Switch>
              <PropsRoute
                exact
                path="/"
                component={Home}
                dataFetched={dataFetched}
                kheopsError={kheopsError}
                albums={albums}
                studies={studies}
              />
              <PropsRoute
                path="/features"
                component={Features}
                kheopsError={kheopsError}
              />
              <PropsRoute
                path="/study/:studyUID"
                component={Study}
                kheopsError={kheopsError}
              />
              <PropsRoute path="/profile" component={Profile} />
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
