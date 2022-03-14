import { pythonBackendBaseURL } from './config';

import { downloadFile, rawRequest, request } from './common';
import { parseFeatureDetailsResponse } from '../utils/multipart-parser';

const baseEndpoint = `${pythonBackendBaseURL}`;

const endpoints = {
  analyze: `${baseEndpoint}/analyze`,
  extract: `${baseEndpoint}/extract`,
  extractions: `${baseEndpoint}/extractions`,
  collections: `${baseEndpoint}/feature-collections`,
  presets: `${baseEndpoint}/feature-presets`,
  models: `${baseEndpoint}/models`,
  labelCategories: `${baseEndpoint}/label-categories`,
  labels: `${baseEndpoint}/labels`,
  tasks: `${baseEndpoint}/tasks`,
  charts: `${baseEndpoint}/charts`,
  annotations: `${baseEndpoint}/annotations`,
  navigation: `${baseEndpoint}/navigation`,
  albums: `${baseEndpoint}/albums`
};

class Backend {
  async lasagna(token, albumId, collectionId) {
    try {
      const url = collectionId
        ? `${endpoints.charts}/${albumId}/${collectionId}/lasagna`
        : `${endpoints.charts}/${albumId}/lasagna`;
      return await request(url, { token: token }); // Add token management
    } catch (err) {
      throw err; // Just throw it for now
    }
  }

  async extractions(token, albumID) {
    try {
      const url = albumID
        ? `${endpoints.extractions}/album/${albumID}`
        : endpoints.extractions;
      return await request(url, { token: token });
    } catch (err) {
      throw err; // Just throw it for now
    }
  }

  async extraction(token, extractionID) {
    try {
      const url = `${endpoints.extractions}/${extractionID}`;
      return await request(url, { token: token });
    } catch (err) {
      throw err; // Just throw it for now
    }
  }

  async updateExtraction(token, extractionID, fields) {
    try {
      const url = `${endpoints.extractions}/${extractionID}`;

      return await request(url, {
        method: 'PATCH',
        data: fields,
        token: token
      });
    } catch (err) {
      throw err; // Just throw it for now
    }
  }

  async extractionFeatureDetails(token, extractionID) {
    try {
      const url = `${endpoints.extractions}/${extractionID}/feature-details`;

      let response = await rawRequest(url, {
        token: token,
        headers: new Headers({ Accept: 'multipart/form-data' })
      });

      let {
        featuresTabular,
        featuresChart
      } = await parseFeatureDetailsResponse(response);

      return { featuresTabular, featuresChart };
    } catch (err) {
      throw err; // Just throw it for now
    }
  }

  async extractionCollectionFeatureDetails(token, extractionID, collectionID) {
    try {
      const url = `${endpoints.extractions}/${extractionID}/collections/${collectionID}/feature-details`;

      let response = await rawRequest(url, {
        token: token,
        headers: new Headers({ Accept: 'multipart/form-data' })
      });

      let {
        featuresTabular,
        featuresChart
      } = await parseFeatureDetailsResponse(response);

      return { featuresTabular, featuresChart };
    } catch (err) {
      throw err; // Just throw it for now
    }
  }

  async saveLabelCategory(token, albumID, labelType, name) {
    try {
      const url = `${endpoints.labelCategories}/${albumID}`;

      const data = { label_type: labelType, name };

      return await request(url, {
        token: token,
        data: data,
        method: 'POST'
      });
    } catch (err) {
      throw err; // Just throw it for now
    }
  }

  async editLabelCategory(token, labelCategoryID, name) {
    try {
      const url = `${endpoints.labels}/${labelCategoryID}`;

      const data = { name };

      return await request(url, {
        token: token,
        data: data,
        method: 'PATCH'
      });
    } catch (err) {
      throw err; // Just throw it for now
    }
  }

  async deleteLabelCategory(token, labelCategoryID) {
    try {
      const url = `${endpoints.labels}/${labelCategoryID}`;

      return await request(url, {
        token: token,
        method: 'DELETE'
      });
    } catch (err) {
      throw err; // Just throw it for now
    }
  }

  async labelCategories(token, albumID) {
    try {
      const url = `${endpoints.labelCategories}/${albumID}`;

      return await request(url, {
        token: token
      });
    } catch (err) {
      throw err; // Just throw it for now
    }
  }

  async saveLabels(token, labelCollectionID, labelMap) {
    try {
      const url = `${endpoints.labels}/${labelCollectionID}`;

      return await request(url, {
        method: 'POST',
        data: labelMap,
        token: token
      });
    } catch (err) {
      throw err; // Just throw it for now
    }
  }

  async saveTrainingTestPatients(
    token,
    extractionID,
    collectionID,
    trainingPatients,
    testPatients
  ) {
    try {
      let url = collectionID
        ? `${endpoints.collections}/${collectionID}`
        : `${endpoints.extractions}/${extractionID}`;

      return await request(url, {
        method: 'PATCH',
        data: {
          training_patients: trainingPatients,
          test_patients: testPatients
        },
        token: token
      });
    } catch (err) {
      throw err; // Just throw it for now
    }
  }

  async models(token, albumID) {
    try {
      let url;
      if (albumID) url = `${endpoints.models}/${albumID}`;
      else url = `${endpoints.models}`;

      return await request(url, { token: token });
    } catch (err) {
      throw err; // Just throw it for now
    }
  }

  async deleteModel(token, modelID) {
    try {
      let url = `${endpoints.models}/${modelID}`;
      return await request(url, { method: 'DELETE', token: token });
    } catch (err) {
      throw err; // Just throw it for now
    }
  }

  async downloadExtraction(token, extractionID) {
    let url = `${endpoints.extractions}/${extractionID}/download`;

    return downloadFile(url, token);
  }

  async downloadCollection(token, collectionID) {
    let url = `${endpoints.collections}/${collectionID}/download`;

    return downloadFile(url, token);
  }

  downloadExtractionURL(extractionID, patientID, studyDate, userID) {
    try {
      let url = `${endpoints.extractions}/${extractionID}/download`;
      if (userID) url += `?userID=${userID}`;
      return url;
      //return await request(url, { token: token });
    } catch (err) {
      throw err; // Just throw it for now
    }
  }

  downloadCollectionURL(collectionID, patientID, studyDate, userID) {
    try {
      let url = `${endpoints.collections}/${collectionID}/download`;
      if (userID) url += `?userID=${userID}`;
      return url;
      //return await request(url, { token: token });
    } catch (err) {
      throw err; // Just throw it for now
    }
  }

  async extract(token, album_id, featureExtractionConfig, rois) {
    try {
      const url = `${endpoints.extract}/album/${album_id}`;
      return await request(url, {
        method: 'POST',
        data: { config: featureExtractionConfig, rois: rois },
        token: token
      });
    } catch (err) {
      throw err; // Just throw it for now
    }
  }

  async trainModel(
    token,
    extractionID,
    collection,
    labelCategoryID,
    studies,
    album,
    labels,
    dataSplittingType,
    trainingPatients,
    testPatients,
    usedModalities,
    usedROIs
  ) {
    try {
      const url = `${endpoints.models}/${album.album_id}`;
      return await request(url, {
        method: 'POST',
        data: {
          'extraction-id': extractionID,
          'collection-id': collection,
          'label-category-id': labelCategoryID,
          studies: studies,
          album: album,
          labels: labels,
          'data-splitting-type': dataSplittingType,
          'training-patients': trainingPatients,
          'test-patients': testPatients,
          modalities: usedModalities,
          rois: usedROIs
        },
        token: token
      });
    } catch (err) {
      throw err; // Just throw it for now
    }
  }

  async presets(token) {
    try {
      const url = `${endpoints.presets}`;
      return await request(url, { token: token });
    } catch (err) {
      throw err; // Just throw it for now
    }
  }

  async preset(token, featurePresetID) {
    try {
      const url = `${endpoints.presets}/${featurePresetID}`;
      return await request(url, { token: token });
    } catch (err) {
      throw err; // Just throw it for now
    }
  }

  async tasks(token, studyUID) {
    try {
      const url = studyUID ? `${endpoints.tasks}/${studyUID}` : endpoints.tasks;
      return await request(url, { token: token });
    } catch (err) {
      throw err; // Just throw it for now
    }
  }

  async createPreset(token, formData) {
    try {
      const url = endpoints.presets;

      return await request(url, {
        method: 'POST',
        data: formData,
        token: token,
        multipart: true
      });
    } catch (err) {
      throw err; // Just throw it for now
    }
  }

  async updatePreset(token, featurePresetID, formData) {
    try {
      const url = `${endpoints.presets}/${featurePresetID}`;

      return await request(url, {
        method: 'PATCH',
        data: formData,
        token: token,
        multipart: true
      });
    } catch (err) {
      throw err;
    }
  }

  async saveCollectionNew(
    token,
    featureExtractionID,
    name,
    featureIDs,
    patients
  ) {
    try {
      const url = `${endpoints.collections}/new`;

      return await request(url, {
        method: 'POST',
        data: {
          featureExtractionID: featureExtractionID,
          name: name,
          featureIDs: featureIDs,
          patientIDs: patients.filter(p => p.selected).map(p => p.name)
        },
        token: token
      });
    } catch (err) {
      throw err; // Just throw it for now
    }
  }

  async saveCollection(
    token,
    featureExtractionID,
    name,
    modalities,
    rois,
    patients,
    features
  ) {
    try {
      const url = `${endpoints.collections}`;

      return await request(url, {
        method: 'POST',
        data: {
          featureExtractionID: featureExtractionID,
          name: name,
          modalities: modalities,
          rois: rois,
          patients: patients,
          features: features
        },
        token: token
      });
    } catch (err) {
      throw err; // Just throw it for now
    }
  }

  async updateCollection(token, featureCollectionID, fields) {
    try {
      const url = `${endpoints.collections}/${featureCollectionID}`;

      return await request(url, {
        method: 'PATCH',
        data: fields,
        token: token
      });
    } catch (err) {
      throw err; // Just throw it for now
    }
  }

  async deleteCollection(token, featureCollectionID) {
    try {
      const url = `${endpoints.collections}/${featureCollectionID}`;
      return await request(url, { method: 'DELETE', token: token });
    } catch (err) {
      throw err; // Just throw it for now
    }
  }

  async collectionsByExtraction(token, featureExtractionID) {
    try {
      const url = `${endpoints.collections}/extraction/${featureExtractionID}`;

      return await request(url, {
        token: token
      });
    } catch (err) {
      throw err; // Just throw it for now
    }
  }

  async collectionDetails(token, collectionID) {
    try {
      const url = `${endpoints.collections}/${collectionID}`;

      return await request(url, { token: token });
    } catch (err) {
      throw err;
    }
  }

  async annotations(token, albumID) {
    try {
      const url = `${endpoints.annotations}/${albumID}`;

      return await request(url, { token: token });
    } catch (err) {
      throw err;
    }
  }

  async createAnnotation(token, albumID, annotation) {
    try {
      const url = `${endpoints.annotations}/${albumID}`;

      return await request(url, {
        token: token,
        method: 'POST',
        data: annotation
      });
    } catch (err) {
      throw err;
    }
  }

  async updateAnnotation(token, annotation) {
    try {
      const url = `${endpoints.annotations}/${annotation.id}`;

      return await request(url, {
        token: token,
        method: 'PATCH',
        data: annotation
      });
    } catch (err) {
      throw err;
    }
  }

  async saveNavigation(token, path) {
    try {
      const url = endpoints.navigation;

      return await request(url, {
        token: token,
        method: 'POST',
        data: { path: path }
      });
    } catch (err) {
      throw err;
    }
  }

  async albumROIs(token, albumID, force) {
    try {
      let url = `${endpoints.albums}/${albumID}`;

      if (force) url += '/force';

      return await request(url, { token: token, method: 'GET' });
    } catch (err) {
      throw err;
    }
  }

  async getCurrentOutcome(token, albumID) {
    try {
      let url = `${endpoints.albums}/${albumID}/current-outcome`;

      return await request(url, { token: token });
    } catch (err) {
      throw err;
    }
  }

  async saveCurrentOutcome(token, albumID, labelCategoryID) {
    try {
      let url = `${endpoints.albums}/${albumID}/current-outcome`;

      if (labelCategoryID) url += `/${labelCategoryID}`;

      return await request(url, { token: token, method: 'PATCH' });
    } catch (err) {
      throw err;
    }
  }
}

export default new Backend();
