import React, { useState, useEffect } from 'react';
import Backend from './services/backend';
import {
  Spinner,
  ListGroup,
  ListGroupItem,
  Button,
  ButtonGroup
} from 'reactstrap';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import FeaturesModal from './FeaturesModal';
import { useKeycloak } from 'react-keycloak';

function Features({ history, match, kheopsError }) {
  const [keycloak, initialized] = useKeycloak();
  const [features, setFeatures] = useState(null);
  const [currentFeature, setCurrentFeature] = useState(null);
  const [modal, setModal] = useState(false);

  useEffect(() => {
    async function getFeatures() {
      const features = await Backend.features(keycloak.token);

      const features_by_name = features.reduce((collector, feature) => {
        if (!collector[feature.name]) collector[feature.name] = [];
        collector[feature.name].push(feature);
        return collector;
      }, {});

      setFeatures(features_by_name);
    }

    getFeatures();
  }, []);

  let handleViewFeaturesClick = feature => {
    setCurrentFeature(feature);
    toggleModal();
  };

  let toggleModal = () => {
    setModal(!modal);
  };

  return (
    <>
      <h1>Feature Collection</h1>
      <div>
        {features ? (
          Object.keys(features).length > 0 ? (
            Object.keys(features).map(featureName => (
              <div key={featureName}>
                <h2>{featureName}</h2>
                <ListGroup>
                  {features[featureName]
                    .sort((f1, f2) =>
                      f1.updated_at.localeCompare(f2.updated_at)
                    )
                    .map(feature => (
                      <ListGroupItem
                        key={feature.id}
                        className="d-flex flex-row justify-content-between align-items-center"
                      >
                        <div className="text-left">
                          <span>Computed on : {feature.updated_at}</span>
                          <div className="text-muted">
                            <span>Study UID : {feature.study_uid}</span>
                          </div>
                        </div>
                        <div>
                          <ButtonGroup>
                            <Button
                              color="info"
                              onClick={() => {
                                handleViewFeaturesClick(feature);
                              }}
                              title="View Features"
                            >
                              <FontAwesomeIcon icon="search"></FontAwesomeIcon>
                            </Button>
                            <Button
                              color="primary"
                              onClick={() =>
                                history.push(`/study/${feature.study_uid}`)
                              }
                              title="Go to Study"
                            >
                              <FontAwesomeIcon icon="book-medical"></FontAwesomeIcon>
                            </Button>
                          </ButtonGroup>
                        </div>
                      </ListGroupItem>
                    ))}
                </ListGroup>
              </div>
            ))
          ) : (
            <h3>
              You haven't computed any Features yet.
              <br />
              Get started by exploring your studies <Link to="/">here</Link>.
            </h3>
          )
        ) : (
          <Spinner />
        )}
        {currentFeature && (
          <FeaturesModal
            isOpen={modal}
            toggle={toggleModal}
            feature={currentFeature}
          />
        )}
      </div>
    </>
  );
}

export default Features;
