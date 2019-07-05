import { serverBaseURL } from './config';

const baseEndpoint = `${serverBaseURL}/auth`;

const endpoints = {
  login: `${baseEndpoint}/login`
};

class Auth {
  authenticated = false;

  async login(email, password) {
    try {
      // TODO - Remove this fake auth check
      let responseType = 'error';
      if (email === 'the1shadow@gmail.com' && password === 'test') {
        responseType = 'success';
      }

      const options = {
        data: {
          email: email,
          password: password
        },
        headers: new Headers({ 'x-mock-response-name': responseType })
      };
      const response = await fetch(endpoints.login, options);

      if (!response.ok) {
        const error = (await response.json()).error;
        throw new Error(error);
      } else {
        this.authenticated = true;
        return response.json();
      }
    } catch (err) {
      throw err; // Just throw it for now
    }
  }

  logout(cb) {
    this.authenticated = false;
    cb();
  }

  isAuthenticated() {
    return this.authenticated;
  }
}

export default new Auth();
