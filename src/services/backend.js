import { pythonBackendBaseURL } from './config';

import { request } from './common';

const baseEndpoint = `${pythonBackendBaseURL}`;

const endpoints = {
  extract: `${baseEndpoint}/extract`,
  features: `${baseEndpoint}/features`,
  featureFamilies: `${baseEndpoint}/feature-families`
};

class Backend {
  async extract(token, study_uid, feature_name, feature_config) {
    try {
      const url = `${endpoints.extract}/${study_uid}/${feature_name}`;
      return await request(url, {
        method: 'POST',
        data: { feature_config: feature_config },
        token: token
      });
    } catch (err) {
      throw err; // Just throw it for now
    }
  }

  async featureFamilies(token) {
    try {
      const url = `${endpoints.featureFamilies}`;
      return await request(url, { token: token });
    } catch (err) {
      throw err; // Just throw it for now
    }
  }

  async featureFamily(token, featureFamilyID) {
    try {
      const url = `${endpoints.featureFamilies}/${featureFamilyID}`;
      return await request(url, { token: token });
    } catch (err) {
      throw err; // Just throw it for now
    }
  }

  async features(token, studyUID) {
    try {
      const url = studyUID
        ? `${endpoints.features}/${studyUID}`
        : endpoints.features;
      return await request(url, { token: token });
    } catch (err) {
      throw err; // Just throw it for now
    }
  }

  async createFeatureFamily(token, formData) {
    try {
      const url = endpoints.featureFamilies;

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

  async updateFeatureFamily(token, featureFamilyID, formData) {
    try {
      const url = `${endpoints.featureFamilies}/${featureFamilyID}`;

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
