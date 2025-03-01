// figure out a way to implement the auth and connect to backend using token refresh

import * as SecureStore from "expo-secure-store";
import axios from "axios";
import * as Device from "expo-device";

// this url needs to be updated during production
export const APIURL = "http://172.20.10.2::5000";

//figure out if we are using apples device verification!

export const authService = {
  async getToken() {
    try {
      return await SecureStore.getItemAsync("auth_token");
    } catch (error) {
      console.error("Error getting token:", error);
      return null;
    }
  },

  async login(email) {
    try {
      // we will need to change this once we get our apple api routes
      const deviceId = `${Device.modelName}-${Device.deviceName}-${Device.deviceYearClass}`;

      const response = await axios.post(
        `${APIURL}/api/auth/login`,
        {
          email: email,
        },
        {
          headers: {
            "X-Device-ID": deviceId,
          },
        }
      );

      const { access_token, user } = response.data;
      await this.saveToken(access_token);

      return user;
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    }
  },
  // do we need tokens or do we use keychain?
  async saveToken(token) {
    try {
      await SecureStore.setItemAsync("auth_token", token);
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    } catch (error) {
      console.error("Error saving token:", error);
    }
  },

  async logout() {
    try {
      await SecureStore.deleteItemAsync("auth_token");
      delete axios.defaults.headers.common["Authorization"];
    } catch (error) {
      console.error("Error during logout:", error);
    }
  },
  // if we use tokens do we need a refresh function?
  async initialize() {
    const token = await this.getToken();
    if (token) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      return true;
    }
    return false;
  },
};
