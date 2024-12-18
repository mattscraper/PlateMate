import * as SecureStore from "expo-secure-store";
import axios from "axios";
import * as Device from "expo-device";

export const APIURL = "http://192.168.0.14"; // Update with your API URL

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

  async initialize() {
    const token = await this.getToken();
    if (token) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      return true;
    }
    return false;
  },
};
