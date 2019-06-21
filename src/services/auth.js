import { serverBaseURL } from './config';

const baseEndpoint = `${serverBaseURL}/auth`;

const endpoints = {
  login: `${baseEndpoint}/login`
};

export async function login(email, password) {
  try {
    const options = {
      data: {
        email: email,
        password: password
      },
      headers: new Headers({ 'x-mock-response-name': 'success' })
    };
    const response = await fetch(endpoints.login, options);

    if (!response.ok) {
      const error = (await response.json()).error;
      throw new Error(error);
    } else {
      let responseBody = await response.json();
      return { ...responseBody, isLogged: true };
    }
  } catch (err) {
    throw err; // Just throw it for now
  }
}
