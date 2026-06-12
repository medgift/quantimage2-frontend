export async function request(
  url,
  { method = 'GET', data = null, token = null, multipart = false } = {}
) {
  try {
    let response = await rawRequest(url, { method, data, token, multipart });

    if (!response.ok) {
      // The body may not be JSON (e.g. a server HTML error page); don't let
      // JSON.parse('<!doctype...') mask the real status with a cryptic
      // "Unexpected token '<'" error.
      let message = null;
      try {
        const body = await response.json();
        message = body.error || body.message;
      } catch (e) {
        message = null;
      }
      throw new Error(
        message || `Request failed (${response.status} ${response.statusText})`
      );
    } else {
      try {
        let body = await response.json();
        return body;
      } catch (e) {
        console.error(e);
        return null;
      }
    }
  } catch (err) {
    throw err; // Just throw it for now
  }
}

export async function rawRequest(
  url,
  {
    method = 'GET',
    data = null,
    token = null,
    multipart = false,
    headers = new Headers({
      Accept: 'application/json'
    })
  } = {}
) {
  try {
    let options = {
      headers: headers,
      method: method
    };

    // Authentication
    if (token) {
      headers.append('Authorization', getTokenAuthorization(token));
    }

    // Add body
    if ((method === 'POST' || method === 'PATCH' || method === 'PUT') && data) {
      if (multipart) {
        options.body = data;
      } else {
        headers.append('Content-Type', 'application/json');
        options.body = JSON.stringify(data);
      }
    }

    const response = await fetch(url, options);

    return response;
  } catch (err) {
    throw err; // Just throw it for now
  }
}

export async function downloadFile(url, token, data = null) {
  try {
    let headers = new Headers({});
    headers.append('Authorization', getTokenAuthorization(token));

    let options = { headers: headers };

    if (data != null){
      options["body"] = JSON.stringify(data);
      options["method"] = "POST";
    }

    let response = await fetch(url, options);

    let fileContent = await response.blob();

    let contentDisposition = response.headers.get('Content-Disposition');
    let filename = contentDisposition.split('=')[1];

    return { filename: filename, content: fileContent };
  } catch (err) {
    throw err; // Just throw it for now
  }
}

function getTokenAuthorization(token) {
  return 'Bearer ' + token;
}
