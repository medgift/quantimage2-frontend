import { useKeycloak } from 'react-keycloak';
import React, { useEffect, useState } from 'react';
import Backend from './services/backend';
import { downloadFeatureSet } from './utils/feature-utils';
import { Button, ListGroup, ListGroupItem, Spinner } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Link } from 'react-router-dom';
import FeaturesModal from './FeaturesModal';

function FeaturesOverview() {
  const [keycloak] = useKeycloak();
  const [tasks, setTasks] = useState(null);
  const [currentFeature] = useState(null);
  const [modal, setModal] = useState(false);

  useEffect(() => {
    async function getTasks() {
      const tasks = await Backend.tasks(keycloak.token);
      setTasks(tasks);
    }

    getTasks();
  }, [keycloak.token]);

  let handleDownloadFeaturesClick = (features) => {
    downloadFeatureSet(keycloak.token, features);
  };

  let toggleModal = () => {
    setModal(!modal);
  };

  let getFeaturesByFamily = (tasks) => {
    let featuresByFamily = tasks.reduce((acc, task) => {
      if (!acc[task.feature_family.name]) acc[task.feature_family.name] = [];
      acc[task.feature_family.name].push(task);
      return acc;
    }, {});

    let elements = Object.keys(featuresByFamily).map((featureName) => (
      <div key={featureName}>
        <h2>{featureName}</h2>
        <ListGroup>
          <ListGroupItem
            key={featureName}
            className="d-flex flex-row justify-content-between align-items-center"
          >
            <div>{featuresByFamily[featureName].length} features available</div>
            <div>
              <Button
                color="secondary"
                title="Download Features"
                onClick={() =>
                  handleDownloadFeaturesClick(featuresByFamily[featureName])
                }
              >
                <FontAwesomeIcon icon="download"></FontAwesomeIcon> Download all{' '}
                {featureName} features
              </Button>
            </div>
          </ListGroupItem>
        </ListGroup>
        <br />
      </div>
    ));

    return elements;
  };

  return (
    <>
      <h1>Feature Collection</h1>
      <div>
        {tasks ? (
          tasks.length > 0 ? (
            getFeaturesByFamily(tasks)
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

export default FeaturesOverview;
