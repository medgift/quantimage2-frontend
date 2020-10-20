import { kheopsBaseURL } from './config';

import { request } from './common';

const baseEndpoint = `${kheopsBaseURL}/api`;

const endpoints = {
  albums: `${baseEndpoint}/albums`,
  studies: `${baseEndpoint}/studies`,
};

class Kheops {
  async albums(token) {
    try {
      const url = endpoints.albums;
      return await request(url, { token: token });
    } catch (err) {
      throw err; // Just throw it for now
    }
  }

  async album(token, albumID) {
    try {
      const url = `${endpoints.albums}/${albumID}`;
      return await request(url, { token: token });
    } catch (err) {
      throw err; // Just throw it for now
    }
  }

  async studies(token, albumID) {
    try {
      const url = albumID
        ? `${endpoints.studies}?album=${albumID}`
        : endpoints.studies;
      return await request(url, { token: token });
    } catch (err) {
      throw err; // Just throw it for now
    }
  }

  async study(token, studyUID) {
    try {
      const url = `${endpoints.studies}/?StudyInstanceUID=${studyUID}`;
      let response = await request(url, { token: token });
      return response[0];
    } catch (err) {
      throw err; // Just throw it for now
    }
  }

  async series(token, studyUID) {
    try {
      const url = `${endpoints.studies}/${studyUID}/series`; //?album=${albumID} //&includefield=00080021&includefield=00080031
      return await request(url, { token: token });
    } catch (err) {
      throw err;
    }
  }

  async studyMetadata(token, studyUID) {
    try {
      const url = `${endpoints.studies}/${studyUID}/metadata`;
      return await request(url, { token: token });
    } catch (err) {
      throw err; // Just throw it for now
    }
  }
}

export default new Kheops();
