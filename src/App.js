import React, { useEffect, useState } from 'react';
import './App.css';
import { Routes, Route, useLocation } from 'react-router-dom'; // Changed imports
import Home from './Home';
import NoMatch from './NoMatch';
// Remove PropsRoute import - not needed anymore
import registerFontAwesomeIcons from './registerFontAwesomeIcons';
import Profile from './Profile';
import Footer from './Footer';
import Header from './Header';
import Features from './Features';
import Study from './Study';
import Kheops from './services/kheops';
import { useKeycloak } from '@react-keycloak/web';
import {
  KEYCLOAK_ADMIN_ROLE,
  KEYCLOAK_RESOURCE_ACCESS,
} from './config/constants';
import FeaturePresets from './FeaturePresets';
import FeaturePresetCreate from './FeaturePresetCreate';
import { ProtectedRoute } from './utils/ProtectedRoute'; // Renamed from PrivateRoute
import Dashboard from './Dashboard';
import Backend from './services/backend';
import ModelOverview from './ModelOverview';

// Register the FontAwesome Icons
registerFontAwesomeIcons();

function App({ setUser, setIsAdmin }) {
  const [albums, setAlbums] = useState([]);
  const [dataFetched, setDataFetched] = useState(false);
  const [kheopsError, setKheopsError] = useState(false);

  const { keycloak, initialized } = useKeycloak();
  const location = useLocation();

  // Log location changes
  useEffect(() => {
    if (initialized && keycloak.token && location) {
      Backend.saveNavigation(keycloak.token, location.pathname);
    }
  }, [initialized, location, keycloak.token]);

  // Manage admin status
  useEffect(() => {
    if (keycloak && initialized) {
      keycloak.loadUserProfile().then((profile) => {
        setUser(profile);
      });
      let isAdmin =
        Object.keys(keycloak.tokenParsed[KEYCLOAK_RESOURCE_ACCESS]).includes(
          process.env.REACT_APP_KEYCLOAK_FRONTEND_CLIENT_ID
        ) &&
        keycloak.tokenParsed[KEYCLOAK_RESOURCE_ACCESS][
          process.env.REACT_APP_KEYCLOAK_FRONTEND_CLIENT_ID
        ].roles.includes(KEYCLOAK_ADMIN_ROLE);
      setIsAdmin(isAdmin);
    }
  }, [keycloak, initialized, setUser, setIsAdmin]);

  // Get albums / studies
  useEffect(() => {
    async function getAlbums() {
      try {
        let albums = await Kheops.albums(keycloak.token);
        albums = albums.sort((a1, a2) => a1.name.localeCompare(a2.name));
        setAlbums(albums);
        setDataFetched(true);
      } catch (err) {
        setKheopsError(true);
      }
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
            <Routes>
              <Route path="/" element={<Home />} />
              <Route 
                path="/dashboard" 
                element={
                  <Dashboard 
                    dataFetched={dataFetched}
                    kheopsError={kheopsError}
                    albums={albums}
                  />
                } 
              />
              <Route
                path="/features/:albumID/:tab"
                element={<Features kheopsError={kheopsError} />}
              />
              <Route
                path="/features/:albumID/collection/:collectionID/:tab"
                element={<Features kheopsError={kheopsError} />}
              />
              <Route
                path="/models/:albumID"
                element={
                  <ModelOverview 
                    albums={albums}
                    kheopsError={kheopsError}
                  />
                }
              />
              <Route
                path="/study/:studyUID"
                element={<Study kheopsError={kheopsError} />}
              />
              <Route path="/profile" element={<Profile />} />
              <Route
                path="/feature-presets"
                element={
                  <ProtectedRoute>
                    <FeaturePresets />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/feature-presets/create"
                element={
                  <ProtectedRoute>
                    <FeaturePresetCreate />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/feature-presets/edit/:featurePresetID"
                element={
                  <ProtectedRoute>
                    <FeaturePresetCreate />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<NoMatch />} />
            </Routes>
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

export default App;