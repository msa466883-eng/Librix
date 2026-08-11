// Small auth helper shared by the app.
// Token is kept in memory + localStorage so the login survives a page refresh.

const Auth = {
  getToken() {
    return localStorage.getItem('kutub_token');
  },
  setToken(token) {
    localStorage.setItem('kutub_token', token);
  },
  clearToken() {
    localStorage.removeItem('kutub_token');
  },
  isLoggedIn() {
    return !!this.getToken();
  },
  authHeaders() {
    return { Authorization: `Bearer ${this.getToken()}` };
  },
};
