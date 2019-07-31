import auth from './auth';

export async function request(
  url,
  { method = 'GET', data = null, authenticated = true, userID = false } = {}
) {
  try {
    let headers = new Headers();
    let options = {
      headers: headers,
      method: method
    };

    // Authentication
    if (authenticated) {
      headers.append('Authorization', getAuthorization());
    }

    // TODO - This will be replaced with a real session/user backend
    if (userID && auth.getUser()) {
      headers.append('X-User-ID', getUserID());
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
  return 'Bearer ' + process.env.REACT_APP_KHEOPS_TOKEN;
}

function getUserID() {
  return auth.getUser().id;
}
