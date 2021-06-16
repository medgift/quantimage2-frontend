import { pythonBackendBaseURL } from './config';

import { request } from './common';

const baseEndpoint = `${pythonBackendBaseURL}`;

const endpoints = {
  analyze: `${baseEndpoint}/analyze`,
  extract: `${baseEndpoint}/extract`,
  extractions: `${baseEndpoint}/extractions`,
  collections: `${baseEndpoint}/feature-collections`,
  presets: `${baseEndpoint}/feature-presets`,
  models: `${baseEndpoint}/models`,
  labels: `${baseEndpoint}/labels`,
  tasks: `${baseEndpoint}/tasks`,
  charts: `${baseEndpoint}/charts`,
  annotations: `${baseEndpoint}/annotations`,
  navigation: `${baseEndpoint}/navigation`,
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

  async extractions(token, albumID, studyUID) {
    try {
      const url = albumID
        ? `${endpoints.extractions}/album/${albumID}`
        : studyUID
        ? `${endpoints.extractions}/study/${studyUID}`
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

  async extractionFeatureDetails(token, extractionID) {
    try {
      const url = `${endpoints.extractions}/${extractionID}/feature-details`;

      let response = await request(url, { token: token });

      return response;
    } catch (err) {
      throw err; // Just throw it for now
    }
  }

  async extractionCollectionFeatureDetails(token, extractionID, collectionID) {
    try {
      const url = `${endpoints.extractions}/${extractionID}/collections/${collectionID}/feature-details`;
      return await request(url, { token: token });
    } catch (err) {
      throw err; // Just throw it for now
    }
  }

  async extractionDataPoints(token, extractionID) {
    try {
      const url = `${endpoints.extractions}/${extractionID}/data-points`;
      return await request(url, { token: token });
    } catch (err) {
      throw err; // Just throw it for now
    }
  }

  async extractionCollectionDataPoints(token, extractionID, collectionID) {
    try {
      const url = `${endpoints.extractions}/${extractionID}/collections/${collectionID}/data-points`;
      return await request(url, { token: token });
    } catch (err) {
      throw err; // Just throw it for now
    }
  }

  async labels(token, albumID, labelType) {
    try {
      const url = `${endpoints.labels}/${albumID}/${labelType}`;

      return await request(url, {
        token: token,
      });
    } catch (err) {
      throw err; // Just throw it for now
    }
  }

  async saveLabels(token, albumID, labelType, labelMap) {
    try {
      const url = `${endpoints.labels}/${albumID}/${labelType}`;

      return await request(url, {
        method: 'POST',
        data: labelMap,
        token: token,
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

  downloadExtractionURL(extractionID, patientID, studyDate, studyUID, userID) {
    try {
      let url = `${endpoints.extractions}/${extractionID}/download`;
      if (patientID && studyDate && studyUID)
        url += `?patientID=${patientID}&studyDate=${studyDate}&studyUID=${studyUID}`;
      else if (userID) url += `?userID=${userID}`;
      return url;
      //return await request(url, { token: token });
    } catch (err) {
      throw err; // Just throw it for now
    }
  }

  downloadCollectionURL(collectionID, patientID, studyDate, studyUID, userID) {
    try {
      let url = `${endpoints.collections}/${collectionID}/download`;
      if (patientID && studyDate && studyUID)
        url += `?patientID=${patientID}&studyDate=${studyDate}&studyUID=${studyUID}`;
      else if (userID) url += `?userID=${userID}`;
      return url;
      //return await request(url, { token: token });
    } catch (err) {
      throw err; // Just throw it for now
    }
  }

  async extract(token, album_id, featureExtractionConfig) {
    try {
      const url = `${endpoints.extract}/album/${album_id}`;
      return await request(url, {
        method: 'POST',
        data: featureExtractionConfig,
        token: token,
      });
    } catch (err) {
      throw err; // Just throw it for now
    }
  }

  async trainModel(
    token,
    extractionID,
    collection,
    studies,
    album,
    labels,
    modelType,
    algorithmType,
    dataNormalization,
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
          studies: studies,
          album: album,
          labels: labels,
          'model-type': modelType,
          'algorithm-type': algorithmType,
          'data-normalization': dataNormalization,
          modalities: usedModalities,
          rois: usedROIs,
        },
        token: token,
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
        multipart: true,
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
        multipart: true,
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
          patients: patients.filter((p) => p.selected).map((p) => p.name),
        },
        token: token,
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
          features: features,
        },
        token: token,
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
        token: token,
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
        token: token,
      });
    } catch (err) {
      throw err; // Just throw it for now
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
        data: annotation,
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
        data: annotation,
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
        data: { path: path },
      });
    } catch (err) {
      throw err;
    }
  }
}

export default new Backend();
