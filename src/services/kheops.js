import { kheopsBaseURL } from './config';

import { request } from './common';

const baseEndpoint = `${kheopsBaseURL}/api`;

const endpoints = {
  albums: `${baseEndpoint}/albums`,
  studies: `${baseEndpoint}/studies`
};

class Kheops {
  async albums() {
    try {
      const url = endpoints.albums;
      return await request(url);
    } catch (err) {
      throw err; // Just throw it for now
    }
  }

  async studies(albumID) {
    try {
      const url = albumID
        ? `${endpoints.studies}?album=${albumID}`
        : endpoints.studies;
      return await request(url);
    } catch (err) {
      throw err; // Just throw it for now
    }
  }

  async studyMetadata(studyUID) {
    try {
      const url = `${endpoints.studies}/${studyUID}/metadata`;
      return await request(url);
    } catch (err) {
      throw err; // Just throw it for now
    }
  }
}

export default new Kheops();
