import React, { useState, useEffect } from 'react';
import Backend from './services/backend';
import { ListGroup, ListGroupItem, Spinner } from 'reactstrap';
import { Link } from 'react-router-dom';
import { useKeycloak } from 'react-keycloak';

function FeaturePresets({ history, match, kheopsError }) {
  const [keycloak] = useKeycloak();

  const [featurePresets, setFeaturePresets] = useState([]);
  const [dataFetched, setDataFetched] = useState(false);

  useEffect(() => {
    async function getFeaturePresets() {
      const featurePresets = await Backend.presets(keycloak.token);

      setFeaturePresets(featurePresets);

      setDataFetched(true);
    }

    getFeaturePresets();
  }, [keycloak.token]);

  return (
    <div>
      <h1>Feature Presets</h1>
      {dataFetched ? (
        <div>
          {featurePresets.length ? (
            <div>
              <ListGroup>
                {featurePresets.map((preset) => (
                  <ListGroupItem key={preset.id}>
                    <Link to={`/feature-presets/edit/${preset.id}`}>
                      {preset.name}
                    </Link>
                  </ListGroupItem>
                ))}
              </ListGroup>
              <div className="m-2">
                <Link to="/feature-presets/create">
                  Create a new Feature Preset
                </Link>
              </div>
            </div>
          ) : (
            <h3>
              You haven't defined any Feature Presets yet.{' '}
              <Link to="/feature-presets/create">Create one now</Link>.
            </h3>
          )}
        </div>
      ) : (
        <Spinner />
      )}
    </div>
  );
}

export default FeaturePresets;
