import React, { useEffect, useState } from 'react';
import './App.css';
import { Routes, Route, useLocation } from 'react-router-dom';
import Home from './Home';
import NoMatch from './NoMatch';
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
import { ProtectedRoute } from './utils/ProtectedRoute';
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
    if (keycloak && initialized && keycloak.authenticated) {
      keycloak.loadUserProfile().then((profile) => {
        setUser(profile);
      });
      const isAdmin =
        Object.keys(keycloak.tokenParsed[KEYCLOAK_RESOURCE_ACCESS]).includes(
          process.env.REACT_APP_KEYCLOAK_FRONTEND_CLIENT_ID
        ) &&
        keycloak.tokenParsed[KEYCLOAK_RESOURCE_ACCESS][
          process.env.REACT_APP_KEYCLOAK_FRONTEND_CLIENT_ID
        ].roles.includes(KEYCLOAK_ADMIN_ROLE);
      setIsAdmin(isAdmin);
    } else {
      setUser(null);
      setIsAdmin(false);
    }
  }, [keycloak, initialized, setUser, setIsAdmin]);

  // Get albums / studies only when authenticated
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
    if (keycloak && initialized && keycloak.authenticated) {
      getAlbums();
    }
  }, [keycloak, initialized]);

  // Handle logout
  const handleLogout = async () => {
    keycloak.logout({ redirectUri: window.location.origin + '/' });
  };

  return (
    <>
      {initialized ? (
        <div className="App">
          {keycloak.authenticated && <Header onLogout={handleLogout} />}
          <main className="App-content">
            <Routes>
              <Route path="/" element={<Home />} />
              
              {/* Protected routes - wrap ALL authenticated pages */}
              <Route 
                path="/dashboard" 
                element={
                  <ProtectedRoute>
                    <Dashboard 
                      dataFetched={dataFetched}
                      kheopsError={kheopsError}
                      albums={albums}
                    />
                  </ProtectedRoute>
                } 
              />
              <Route
                path="/features/:albumID/:tab"
                element={
                  <ProtectedRoute>
                    <Features kheopsError={kheopsError} />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/features/:albumID/collection/:collectionID/:tab"
                element={
                  <ProtectedRoute>
                    <Features kheopsError={kheopsError} />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/models/:albumID"
                element={
                  <ProtectedRoute>
                    <ModelOverview 
                      albums={albums}
                      kheopsError={kheopsError}
                    />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/study/:studyUID"
                element={
                  <ProtectedRoute>
                    <Study kheopsError={kheopsError} />
                  </ProtectedRoute>
                }
              />
              <Route 
                path="/profile" 
                element={
                  <ProtectedRoute>
                    <Profile />
                  </ProtectedRoute>
                } 
              />
              
              {/* Admin-only routes */}
              <Route
                path="/feature-presets"
                element={
                  <ProtectedRoute adminOnly={true}>
                    <FeaturePresets />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/feature-presets/create"
                element={
                  <ProtectedRoute adminOnly={true}>
                    <FeaturePresetCreate />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/feature-presets/edit/:featurePresetID"
                element={
                  <ProtectedRoute adminOnly={true}>
                    <FeaturePresetCreate />
                  </ProtectedRoute>
                }
              />
              
              <Route path="*" element={<NoMatch />} />
            </Routes>
          </main>
          {keycloak.authenticated && <Footer />}
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