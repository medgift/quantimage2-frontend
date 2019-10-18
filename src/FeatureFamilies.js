import React, { useState, useEffect } from 'react';
import Backend from './services/backend';
import { Spinner } from 'reactstrap';
import { Link } from 'react-router-dom';
import { useKeycloak } from 'react-keycloak';

function FeatureFamilies({ history, match, kheopsError }) {
  const [keycloak] = useKeycloak();

  const [featureFamilies, setFeatureFamilies] = useState([]);
  const [dataFetched, setDataFetched] = useState(false);

  useEffect(() => {
    async function getFeatureFamilies() {
      const featureFamilies = await Backend.features(keycloak.token);

      setFeatureFamilies(featureFamilies);

      setDataFetched(true);
    }

    getFeatureFamilies();
  }, []);

  return (
    <div>
      <h1>Feature Families</h1>
      {dataFetched ? (
        <div>
          {featureFamilies.length ? (
            <div>feature families</div>
          ) : (
            <h3>
              You haven't defined any Feature Families yet.{' '}
              <Link to="/feature-families/create">Create one now</Link>.
            </h3>
          )}
        </div>
      ) : (
        <Spinner />
      )}
    </div>
  );
}

export default FeatureFamilies;
