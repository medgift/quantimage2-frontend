import { pythonBackendBaseURL } from './config';

const baseEndpoint = `${pythonBackendBaseURL}`;

const endpoints = {
  extract: `${baseEndpoint}/extract`
};

function getAuthorization() {
  //return { Authorization: 'Bearer ' + process.env.REACT_APP_KHEOPS_TOKEN };
}

class Backend {
  async extract(studyUID) {
    try {
      const options = {
        headers: new Headers(getAuthorization())
      };
      const finalEndpoint = `${endpoints.extract}/${studyUID}`;
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

export default new Backend();
