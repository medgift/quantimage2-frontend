export async function request(
  url,
  { method = 'GET', data = null, token = null, multipart = false } = {}
) {
  try {
    let headers = new Headers();
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
        headers.append('Accept', 'application/json');
      } else {
        options.body = JSON.stringify(data);
      }
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      let body = await response.json();
      const error = body.error || body.message;
      throw new Error(error);
    } else {
      try {
        let body = await response.json();
        return body;
      } catch (e) {
        return null;
      }
    }
  } catch (err) {
    throw err; // Just throw it for now
  }
}

function getTokenAuthorization(token) {
  return 'Bearer ' + token;
}
