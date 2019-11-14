import React from 'react';
import DicomFields from './dicom/fields';
import moment from 'moment';
import './Home.css';
import { Alert, ListGroup, ListGroupItem, Spinner } from 'reactstrap';
import { Link } from 'react-router-dom';
import { DICOM_DATE_FORMAT } from './config/constants';
import { Badge } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

function Home({ albums, studies, dataFetched, kheopsError }) {
  return (
    <div>
      <header className="App-header">
        <h1 data-testid="welcome-page-header">QuantImage v2</h1>
      </header>
      <section id="extract-features">
        <h2>Extract features</h2>
        <p>
          This page allows you to extract features from studies that were added
          to your albums in the Kheops platform.
        </p>
        <p>
          <a
            href={`${process.env.REACT_APP_KHEOPS_URL}/albums`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <FontAwesomeIcon icon="external-link-alt"></FontAwesomeIcon> Manage
            Studies in Kheops
          </a>
        </p>
        <h2>Your albums/studies</h2>
        <div>
          {kheopsError ? (
            <Alert color="danger">Error fetching data from Kheops</Alert>
          ) : !dataFetched ? (
            <Spinner />
          ) : albums.length > 0 && Object.keys(studies).length > 0 ? (
            <ListGroup className="albums">
              {albums.map(album => (
                <ListGroupItem key={album.album_id}>
                  {album.name}
                  {studies[album.album_id] && (
                    <ListGroup>
                      {studies[album.album_id].map(study => (
                        <ListGroupItem
                          key={
                            study[DicomFields.STUDY_UID][DicomFields.VALUE][0]
                          }
                          className="d-flex justify-content-between align-items-center"
                        >
                          <Link
                            to={`/study/${
                              study[DicomFields.STUDY_UID][DicomFields.VALUE][0]
                            }`}
                            className="btn btn-link"
                            href="#"
                            title={
                              study[DicomFields.STUDY_UID][DicomFields.VALUE][0]
                            }
                          >
                            {
                              study[DicomFields.PATIENT_NAME][
                                DicomFields.VALUE
                              ][0][DicomFields.ALPHABETIC]
                            }{' '}
                            (
                            {moment(
                              study[DicomFields.DATE][DicomFields.VALUE][0],
                              DicomFields.DATE_FORMAT
                            ).format(DICOM_DATE_FORMAT)}
                            )
                          </Link>
                          <div>
                            {(() => {
                              let modalities = [];

                              // Determine if the modality types field is already an array or needs to be split
                              let modalityArray = !study[
                                DicomFields.MODALITIES
                              ][DicomFields.VALUE][0].includes(',')
                                ? study[DicomFields.MODALITIES][
                                    DicomFields.VALUE
                                  ]
                                : study[DicomFields.MODALITIES][
                                    DicomFields.VALUE
                                  ][0].split(',');

                              for (let modality of modalityArray) {
                                modalities.push(
                                  <Badge
                                    color="primary"
                                    className="mr-1"
                                    key={modality}
                                  >
                                    {modality}
                                  </Badge>
                                );
                              }
                              return modalities;
                            })()}
                          </div>
                        </ListGroupItem>
                      ))}
                    </ListGroup>
                  )}
                </ListGroupItem>
              ))}
            </ListGroup>
          ) : (
            <span>No albums found.</span>
          )}
        </div>
      </section>
    </div>
  );
}

export default Home;
