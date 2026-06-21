import api from './api';

const authService = {
  /**
   * Register a new user.
   * @param {{ username: string, email: string, password: string }} data
   */
  async register(data) {
    const res = await api.post('/auth/register', data);
    return res.data.data;   // { user, accessToken, refreshToken }
  },

  /**
   * Login with email + password.
   * @param {{ email: string, password: string }} data
   */
  async login(data) {
    const res = await api.post('/auth/login', data);
    return res.data.data;
  },

  /** Fetch the authenticated user's profile. */
  async getProfile() {
    const res = await api.get('/auth/profile');
    return res.data.data.user;
  },

  /** Update username / avatar. */
  async updateProfile(data) {
    const res = await api.put('/auth/profile', data);
    return res.data.data.user;
  },

  /** Permanently delete the account. Requires password confirmation. */
  async deleteAccount(password) {
    const res = await api.delete('/auth/account', { data: { password } });
    return res.data;
  },
};

export default authService;
