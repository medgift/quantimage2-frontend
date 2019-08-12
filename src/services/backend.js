import { pythonBackendBaseURL } from './config';

import { request } from './common';

const baseEndpoint = `${pythonBackendBaseURL}`;

const endpoints = {
  extract: `${baseEndpoint}/extract`,
  features: `${baseEndpoint}/features`,
  featureTypes: `${baseEndpoint}/features/types`
};

class Backend {
  async extract(study_uid, feature_name) {
    try {
      const url = `${endpoints.extract}/${study_uid}/${feature_name}`;
      return await request(url, { authenticated: false, userID: true });
    } catch (err) {
      throw err; // Just throw it for now
    }
  }

  async featureTypes() {
    try {
      const url = `${endpoints.featureTypes}`;
      return await request(url, { authenticated: false, userID: true });
    } catch (err) {
      throw err; // Just throw it for now
    }
  }

  async features(studyUID) {
    try {
      const url = studyUID
        ? `${endpoints.features}/${studyUID}`
        : endpoints.features;
      return await request(url, { authenticated: false, userID: true });
    } catch (err) {
      throw err; // Just throw it for now
    }
  }
}

export default new Backend();
