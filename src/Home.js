import React from 'react';
import DicomFields from './dicom/fields';
import moment from 'moment';
import './Home.css';
import { Spinner } from 'reactstrap';
import { Link } from 'react-router-dom';
import { DATE_FORMAT } from './config/constants';

function Home({ albums, studies, dataFetched }) {
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
          {!dataFetched ? (
            <Spinner />
          ) : albums.length > 0 && Object.keys(studies).length > 0 ? (
            <ul className="albums">
              {albums.map(album => (
                <li key={album.album_id}>
                  {album.name}
                  {studies[album.album_id] && (
                    <ul>
                      {studies[album.album_id].map(study => (
                        <li
                          key={
                            study[DicomFields.STUDY_UID][DicomFields.VALUE][0]
                          }
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
                            ,{' '}
                            {
                              study[DicomFields.MODALITIES][
                                DicomFields.VALUE
                              ][0]
                            }
                            )
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <span>No albums found.</span>
          )}
        </div>
      </section>
    </div>
  );
}

export default Home;
