import React, { useState, useEffect } from 'react';
import Backend from './services/backend';
import { Spinner } from 'reactstrap';
import { Link } from 'react-router-dom';
import FeaturesModal from './FeaturesModal';
import { useKeycloak } from 'react-keycloak';

function Features({ history, match, kheopsError }) {
  const [keycloak] = useKeycloak();
  const [tasks, setTasks] = useState(null);
  const [currentFeature] = useState(null);
  const [modal, setModal] = useState(false);

  useEffect(() => {
    async function getTasks() {
      const tasks = await Backend.tasks(keycloak.token);

      /*const features_by_name = features.reduce((collector, feature) => {
        if (!collector[feature.feature_family.name])
          collector[feature.feature_family.name] = [];
        collector[feature.feature_family.name].push(feature);
        return collector;
      }, {});*/

      setTasks(tasks);
    }

    getTasks();
  }, [keycloak.token]);

  /*let handleViewFeaturesClick = feature => {
    setCurrentFeature(feature);
    toggleModal();
  };

  let handleDownloadFeaturesClick = feature => {
    downloadFeature(feature);
  };*/

  let toggleModal = () => {
    setModal(!modal);
  };

  return (
    <>
      <h1>Feature Collection</h1>
      <div>
        {tasks ? (
          tasks.length > 0 ? (
            JSON.stringify(tasks)
          ) : (
            /*Object.keys(features).length > 0 ? (
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
                              color="secondary"
                              title="Download Features"
                              onClick={() =>
                                handleDownloadFeaturesClick(feature)
                              }
                            >
                              <FontAwesomeIcon icon="download"></FontAwesomeIcon>
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
            ))*/
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
