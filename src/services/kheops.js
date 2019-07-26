import { kheopsBaseURL } from './config';

const baseEndpoint = `${kheopsBaseURL}/api`;

const endpoints = {
  albums: `${baseEndpoint}/albums`,
  studies: `${baseEndpoint}/studies`
};

function getAuthorization() {
  return { Authorization: 'Bearer ' + process.env.REACT_APP_KHEOPS_TOKEN };
}

class Kheops {
  async albums() {
    try {
      const options = {
        headers: new Headers(getAuthorization())
      };
      const response = await fetch(endpoints.albums, options);

      if (!response.ok) {
        const error = (await response.json()).error;
        throw new Error(error);
      } else {
        return response.json();
      }
    } catch (err) {
      throw err; // Just throw it for now
    }
  }

  async studies(albumID) {
    try {
      const options = {
        headers: new Headers(getAuthorization())
      };
      const finalEndpoint = albumID
        ? `${endpoints.studies}?album=${albumID}`
        : endpoints.studies;
      const response = await fetch(finalEndpoint, options);

      if (!response.ok) {
        const error = (await response.json()).error;
        throw new Error(error);
      } else {
        return response.json();
      }
    } catch (err) {
      throw err; // Just throw it for now
    }
  }

  async studyMetadata(studyUID) {
    try {
      const options = {
        headers: new Headers(getAuthorization())
      };
      const finalEndpoint = studyUID
        ? `${endpoints.studies}/${studyUID}/metadata`
        : endpoints.studies;
      const response = await fetch(finalEndpoint, options);

      if (!response.ok) {
        const error = (await response.json()).error;
        throw new Error(error);
      } else {
        return response.json();
      }
    } catch (err) {
      throw err; // Just throw it for now
    }
  }
}

export default new Kheops();
