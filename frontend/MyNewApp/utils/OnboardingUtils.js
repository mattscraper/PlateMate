=// OnboardingUtils.js - Utility functions for onboarding management
import AsyncStorage from '@react-native-async-storage/async-storage';

export const OnboardingUtils = {
  // Reset onboarding status (useful for testing)
  async resetOnboarding() {
    try {
      await AsyncStorage.removeItem('hasSeenOnboarding');
      await AsyncStorage.removeItem('onboardingVersion');
      console.log('✅ Onboarding status reset');
      return true;
    } catch (error) {
      console.error('Error resetting onboarding:', error);
      return false;
    }
  },

  // Check if user has completed onboarding
  async hasCompletedOnboarding() {
    try {
      const hasSeenOnboarding = await AsyncStorage.getItem('hasSeenOnboarding');
      return hasSeenOnboarding === 'true';
    } catch (error) {
      console.error('Error checking onboarding status:', error);
      return false;
    }
  },

  // Get onboarding version
  async getOnboardingVersion() {
    try {
      return await AsyncStorage.getItem('onboardingVersion');
    } catch (error) {
      console.error('Error getting onboarding version:', error);
      return null;
    }
  },

  // Force show onboarding (for updates or re-engagement)
  async forceShowOnboarding() {
    try {
      await AsyncStorage.removeItem('hasSeenOnboarding');
      console.log('✅ Onboarding will be shown on next app start');
      return true;
    } catch (error) {
      console.error('Error forcing onboarding:', error);
      return false;
    }
  },

  // Set onboarding version (when updating questionnaire)
  async setOnboardingVersion(version) {
    try {
      await AsyncStorage.setItem('onboardingVersion', version);
      console.log(`✅ Onboarding version set to ${version}`);
      return true;
    } catch (error) {
      console.error('Error setting onboarding version:', error);
      return false;
    }
  }
};

// Add this to your LandingScreen or any admin/debug screen for testing
export const addOnboardingDebugButton = (navigation) => {
  // This can be used in development to reset onboarding
  return {
    resetOnboarding: async () => {
      await OnboardingUtils.resetOnboarding();
      // Restart app or navigate to refresh state
      navigation.reset({
        index: 0,
        routes: [{ name: 'LandingPage' }],
      });
    }
  };
};
