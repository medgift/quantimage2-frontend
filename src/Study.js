import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import Kheops from './services/kheops';
import Backend from './services/backend';
import { Spinner } from 'reactstrap';
import moment from 'moment';
import DicomFields from './dicom/fields';
import { DATE_FORMAT } from './config/constants';

import './Study.css';

function Study({ match }) {
  let {
    params: { studyUID }
  } = match;

  let [studyMetadata, setStudyMetadata] = useState(null);
  let [studyFeatures, setStudyFeatures] = useState(null);

  let series = useMemo(() => parseMetadata(studyMetadata), [studyMetadata]);

  let extractFeatures = async studyUID => {
    const features = await Backend.extract(studyUID);
    console.log(features);
    return features;
  };

  useEffect(() => {
    async function getStudyMetadata() {
      const studyMetadata = await Kheops.studyMetadata(studyUID);
      setStudyMetadata(studyMetadata);
    }

    async function getStudyFeatures() {
      const studyFeatures = await Backend.features(studyUID);
      setStudyFeatures(studyFeatures);
    }

    getStudyMetadata();
    getStudyFeatures();
  }, []);

  return (
    <section id="study">
      <h2>Study Details</h2>
      {studyMetadata ? (
        <>
          <table className="w-auto table table-sm table-borderless table-light">
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
          </table>
        </>
      ) : (
        <div>
          <Spinner />
        </div>
      )}
      <h2>Features</h2>
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
