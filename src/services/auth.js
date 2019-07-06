import { serverBaseURL } from './config';
import ls from 'local-storage';

const baseEndpoint = `${serverBaseURL}/auth`;

const endpoints = {
  login: `${baseEndpoint}/login`
};

class Auth {
  authenticated = false;

  constructor() {
    const storedUser = ls('user');
    this.authenticated = Boolean(storedUser);
  }

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
        const user = await response.json();
        ls('user', user);
        this.authenticated = true;
        return user;
      }
    } catch (err) {
      throw err; // Just throw it for now
    }
  }

  async logout() {
    ls.remove('user');
    this.authenticated = false;
  }

  isAuthenticated() {
    return this.authenticated;
  }

  getUser() {
    return ls('user');
  }
}

export default new Auth();
