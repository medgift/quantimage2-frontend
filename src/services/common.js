export async function request(
  url,
  { method = 'GET', data = null, token = null } = {}
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
    if ((method === 'POST' || method === 'PATH' || method === 'PUT') && data) {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      let body = await response.json();
      const error = body.error || body.message;
      throw new Error(error);
    } else {
      return response.json();
    }
  } catch (err) {
    throw err; // Just throw it for now
  }
}

function getTokenAuthorization(token) {
  return 'Bearer ' + token;
}
