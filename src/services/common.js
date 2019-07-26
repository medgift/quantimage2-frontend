import auth from './auth';

export async function request(
  url,
  { method = 'GET', data = null, authenticated = true, userID = false } = {}
) {
  try {
    let options = {};

    // Authentication
    if (authenticated) {
      options = {
        headers: new Headers(getAuthorization()),
        method: method
      };

      // TODO - This will be replaced with a real session/user backend
      if (userID && auth.getUser()) {
        options.headers.append('X-User-ID', auth.getUser().id);
      }
    }

    // Add body
    if ((method === 'POST' || method === 'PATH' || method === 'PUT') && data) {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);

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

function getAuthorization() {
  return { Authorization: 'Bearer ' + process.env.REACT_APP_KHEOPS_TOKEN };
}
