import React, { useState, useEffect } from 'react';
import Backend from './services/backend';
import { ListGroup, ListGroupItem, Spinner } from 'reactstrap';
import { Link } from 'react-router-dom';
import { useKeycloak } from 'react-keycloak';

function FeatureFamilies({ history, match, kheopsError }) {
  const [keycloak] = useKeycloak();

  const [featureFamilies, setFeatureFamilies] = useState([]);
  const [dataFetched, setDataFetched] = useState(false);

  useEffect(() => {
    async function getFeatureFamilies() {
      const featureFamilies = await Backend.families(keycloak.token);

      setFeatureFamilies(featureFamilies);

      setDataFetched(true);
    }

    getFeatureFamilies();
  }, [keycloak.token]);

  return (
    <div>
      <h1>Feature Families</h1>
      {dataFetched ? (
        <div>
          {featureFamilies.length ? (
            <div>
              <ListGroup>
                {featureFamilies.map(family => (
                  <ListGroupItem key={family.id}>
                    <Link to={`/feature-families/edit/${family.id}`}>
                      {family.name}
                    </Link>
                  </ListGroupItem>
                ))}
              </ListGroup>
              <div className="m-2">
                <Link to="/feature-families/create">
                  Create a new Feature Family
                </Link>
              </div>
            </div>
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
