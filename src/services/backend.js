import { pythonBackendBaseURL } from './config';

import { request } from './common';

const baseEndpoint = `${pythonBackendBaseURL}`;

const endpoints = {
  extract: `${baseEndpoint}/extract`,
  features: `${baseEndpoint}/features`,
  featureTypes: `${baseEndpoint}/features/types`
};

class Backend {
  async extract(studyUID) {
    try {
      const url = `${endpoints.extract}/${studyUID}`;
      return await request(url);
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
      const url = `${endpoints.features}/${studyUID}`;
      return await request(url, { authenticated: false, userID: true });
    } catch (err) {
      throw err; // Just throw it for now
    }
  }
}

export default new Backend();
