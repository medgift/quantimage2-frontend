import { pythonBackendBaseURL } from './config';

import { request } from './common';

const baseEndpoint = `${pythonBackendBaseURL}`;

const endpoints = {
  analyze: `${baseEndpoint}/analyze`,
  extract: `${baseEndpoint}/extract`,
  extractions: `${baseEndpoint}/extractions`,
  families: `${baseEndpoint}/feature-families`,
  tasks: `${baseEndpoint}/tasks`
};

class Backend {
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

  downloadExtractionURL(extractionID, patientID, studyDate, userID) {
    try {
      let url = `${endpoints.extractions}/${extractionID}/download`;
      if (patientID && studyDate)
        url += `?patientID=${patientID}&studyDate=${studyDate}`;
      else if (userID) url += `?userID=${userID}`;
      return url;
      //return await request(url, { token: token });
    } catch (err) {
      throw err; // Just throw it for now
    }
  }

  async extract(token, album_id, feature_families_map, study_uid) {
    try {
      const url = album_id
        ? `${endpoints.extract}/album/${album_id}`
        : `${endpoints.extract}/study/${study_uid}`;
      return await request(url, {
        method: 'POST',
        data: feature_families_map,
        token: token
      });
    } catch (err) {
      throw err; // Just throw it for now
    }
  }

  async analyze(token, featureFiles) {
    try {
      const url = `${endpoints.analyze}`;
      return await request(url, {
        method: 'POST',
        data: featureFiles,
        token: token
      });
    } catch (err) {
      throw err; // Just throw it for now
    }
  }

  async families(token) {
    try {
      const url = `${endpoints.families}`;
      return await request(url, { token: token });
    } catch (err) {
      throw err; // Just throw it for now
    }
  }

  async family(token, featureFamilyID) {
    try {
      const url = `${endpoints.families}/${featureFamilyID}`;
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

  async createFamily(token, formData) {
    try {
      const url = endpoints.families;

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

  async updateFamily(token, featureFamilyID, formData) {
    try {
      const url = `${endpoints.families}/${featureFamilyID}`;

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
}

export default new Backend();
