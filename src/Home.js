import React from 'react';
import DicomFields from './dicom/fields';
import moment from 'moment';
import './Home.css';
import { Alert, ListGroup, ListGroupItem, Spinner } from 'reactstrap';
import { Link } from 'react-router-dom';
import { DATE_FORMAT } from './config/constants';
import Badge from 'reactstrap/es/Badge';

function Home({ albums, studies, dataFetched, kheopsError }) {
  return (
    <div>
      <header className="App-header">
        <h1 data-testid="welcome-page-header">IMAGINE</h1>
      </header>
      <section id="extract-features">
        <h2>Extract features</h2>
        <p>
          This page allows you to extract features from images that were added
          to your collection.
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
                            ).format(DATE_FORMAT)}
                            )
                          </Link>
                          <div>
                            {(() => {
                              let modalities = [];
                              for (let modality of study[
                                DicomFields.MODALITIES
                              ][DicomFields.VALUE][0].split(',')) {
                                modalities.push(
                                  <Badge color="primary" className="mr-1">
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
