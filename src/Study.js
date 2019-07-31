import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import Kheops from './services/kheops';
import Backend from './services/backend';
import { Alert, Button, ListGroupItem, Spinner, Table } from 'reactstrap';
import moment from 'moment';
import DicomFields from './dicom/fields';
import { DATE_FORMAT, FEATURE_TYPES } from './config/constants';

import './Study.css';
import ButtonGroup from 'reactstrap/es/ButtonGroup';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import ListGroup from 'reactstrap/es/ListGroup';

function Study({ match, kheopsError }) {
  let {
    params: { studyUID }
  } = match;

  let [studyMetadata, setStudyMetadata] = useState(null);
  let [features, setFeatures] = useState(null);

  let series = useMemo(() => parseMetadata(studyMetadata), [studyMetadata]);

  let extractFeatures = async studyUID => {
    const features = await Backend.extract(studyUID);
    console.log(features);
    return features;
  };

  useEffect(() => {
    async function getFeatures() {
      const featureTypes = await Backend.featureTypes();
      const studyFeatures = await Backend.features(studyUID);

      let features = [];

      for (let featureType of featureTypes) {
        let studyFeature = studyFeatures.find(
          studyFeature => studyFeature.name === featureType
        );

        if (studyFeature) {
          features.push(studyFeature);
        } else {
          features.push({
            name: featureType,
            updated_at: null,
            status: FEATURE_TYPES.NOT_COMPUTED,
            payload: null
          });
        }
      }

      setFeatures(features);
    }

    async function getStudyMetadata() {
      const studyMetadata = await Kheops.studyMetadata(studyUID);
      setStudyMetadata(studyMetadata);
    }

    getFeatures();
    getStudyMetadata();
  }, []);

  return (
    <section id="study">
      <h2>Study Details</h2>
      {kheopsError ? (
        <Alert color="danger">Error fetching data from Kheops</Alert>
      ) : !studyMetadata ? (
        <Spinner />
      ) : (
        <>
          <Table borderless size="sm" className="w-auto table-light">
            <tbody>
              <tr>
                <th scope="row">Patient</th>
                <td>
                  {
                    studyMetadata[0][DicomFields.PATIENT_NAME][
                      DicomFields.VALUE
                    ][0][DicomFields.ALPHABETIC]
                  }
                </td>
              </tr>
              <tr>
                <th scope="row">Date</th>
                <td>
                  {moment(
                    studyMetadata[0][DicomFields.DATE][DicomFields.VALUE][0],
                    DicomFields.DATE_FORMAT
                  ).format(DATE_FORMAT)}
                </td>
              </tr>
              {Object.keys(series)
                .sort()
                .map((dataset, index) => (
                  <tr key={index}>
                    <th scope="row">{dataset}</th>
                    <td>
                      {series[dataset].length}{' '}
                      {series[dataset].length > 1 ? 'images' : 'image'}
                    </td>
                  </tr>
                ))}
            </tbody>
          </Table>
        </>
      )}
      <h2>Features</h2>
      <ListGroup>
        {features &&
          features.map(feature => (
            <ListGroupItem
              key={feature.name}
              className="d-flex justify-content-between align-items-center"
            >
              <div
                className={`mr-2${
                  feature.status === FEATURE_TYPES.IN_PROGRESS
                    ? ' text-muted'
                    : ''
                }`}
              >
                {feature.name}{' '}
                <small>
                  {feature.status === FEATURE_TYPES.NOT_COMPUTED && (
                    <>(never computed)</>
                  )}
                  {feature.status === FEATURE_TYPES.IN_PROGRESS && (
                    <>(in progress...)</>
                  )}
                  {feature.status === FEATURE_TYPES.COMPLETE && (
                    <>(computed on {feature.updated_at})</>
                  )}
                </small>
              </div>
              <ButtonGroup>
                {(() => {
                  switch (feature.status) {
                    case FEATURE_TYPES.NOT_COMPUTED:
                      return (
                        <Button color="success">
                          <FontAwesomeIcon
                            icon="cog"
                            title="Compute Features"
                          ></FontAwesomeIcon>
                        </Button>
                      );
                    case FEATURE_TYPES.IN_PROGRESS:
                      return (
                        <Button color="secondary" disabled>
                          <FontAwesomeIcon
                            icon="sync"
                            spin
                            title="Computation in Progress"
                          ></FontAwesomeIcon>
                        </Button>
                      );
                    case FEATURE_TYPES.COMPLETE:
                      return (
                        <Button color="primary">
                          <FontAwesomeIcon
                            icon="redo"
                            title="Recompute Features"
                          ></FontAwesomeIcon>
                        </Button>
                      );
                    default:
                      return null;
                  }
                })()}
                <Button
                  color="info"
                  disabled={feature.status === FEATURE_TYPES.IN_PROGRESS}
                >
                  <FontAwesomeIcon
                    icon="search"
                    title="View Features"
                  ></FontAwesomeIcon>
                </Button>
              </ButtonGroup>
            </ListGroupItem>
          ))}
      </ListGroup>
      <Link to="/">Back to Home</Link>
    </section>
  );
}

export default Study;

function parseMetadata(metadata) {
  if (metadata) {
    let series = {};
    for (let entry of metadata) {
      let modality = entry[DicomFields.MODALITY][DicomFields.VALUE][0];
      if (!series[modality]) series[modality] = [];

      series[modality].push(entry);
    }
    return series;
  } else {
    return null;
  }
}
