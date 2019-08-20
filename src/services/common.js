export async function request(
  url,
  {
    method = 'GET',
    data = null,
    authenticated: kheops = true,
    token = null
  } = {}
) {
  try {
    let headers = new Headers();
    let options = {
      headers: headers,
      method: method
    };

    // Authentication
    if (kheops) {
      headers.append('Authorization', getKheopsAuthorization());
    } else if (token) {
      headers.append('Authorization', token);
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

function getKheopsAuthorization() {
  return 'Bearer ' + process.env.REACT_APP_KHEOPS_TOKEN;
}
