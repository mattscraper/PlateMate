// services/PurchaseService.js
import Purchases from 'react-native-purchases';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { authService } from './auth';

class PurchaseService {
  static isConfigured = false;

  // Initialize RevenueCat with current Firebase user
  static async configure() {
    if (this.isConfigured) return;
    
    try {
      // Get current Firebase user ID to link with RevenueCat
      const currentUser = auth.currentUser;
      const appUserId = currentUser?.uid || null;
      
      await Purchases.configure({
        apiKey: 'appl_fwRWQRdSViPvwzChtARGpDVvLEs', // Replace with your actual key
        appUserID: appUserId, // Link RevenueCat to your Firebase user
      });
      
      this.isConfigured = true;
      console.log('RevenueCat configured successfully with Firebase user:', appUserId);
    } catch (error) {
      console.error('Error configuring RevenueCat:', error);
    }
  }

  // Update premium status in Firestore using your existing structure
  static async updatePremiumStatus(hasActivePremium, subscriptionDetails = null) {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        console.log('No authenticated user to update');
        return false;
      }

      const userRef = doc(db, 'users', currentUser.uid);
      
      // Prepare update data matching your existing structure
      const updateData = {
        isPremium: hasActivePremium,
        premiumUpdatedAt: new Date().toISOString(),
      };

      // Add subscription details if provided
      if (subscriptionDetails && hasActivePremium) {
        updateData.subscriptionInfo = {
          productId: subscriptionDetails.productIdentifier,
          expirationDate: subscriptionDetails.expirationDate,
          purchaseDate: subscriptionDetails.purchaseDate,
          originalAppUserId: subscriptionDetails.originalAppUserId,
          platform: 'ios',
          provider: 'revenuecat'
        };
      } else if (!hasActivePremium) {
        // Clear subscription info when premium is lost
        updateData.subscriptionInfo = null;
      }

      await updateDoc(userRef, updateData);
      console.log('✅ Firestore premium status updated:', hasActivePremium);
      return true;
      
    } catch (error) {
      console.error('❌ Error updating Firestore premium status:', error);
      return false;
    }
  }

  // Get available subscription offerings
  static async getOfferings() {
    try {
      const offerings = await Purchases.getOfferings();
      
      if (offerings.current !== null) {
        return offerings.current.availablePackages;
      } else {
        console.log('No offerings available');
        return [];
      }
    } catch (error) {
      console.error('Error fetching offerings:', error);
      return [];
    }
  }

  // Purchase a subscription package
  static async purchasePackage(packageToPurchase) {
    try {
      const { customerInfo, productIdentifier } = await Purchases.purchasePackage(packageToPurchase);
      
      if (customerInfo.entitlements.active['premium']) {
        // Extract subscription details
        const premiumEntitlement = customerInfo.entitlements.active['premium'];
        const subscriptionDetails = {
          productIdentifier,
          expirationDate: premiumEntitlement.expirationDate,
          purchaseDate: premiumEntitlement.latestPurchaseDate,
          originalAppUserId: customerInfo.originalAppUserId,
        };

        // Update Firestore with premium status
        const updateSuccess = await this.updatePremiumStatus(true, subscriptionDetails);
        
        if (updateSuccess) {
          console.log('✅ Purchase successful and Firestore updated!', productIdentifier);
          return {
            success: true,
            customerInfo,
            productIdentifier
          };
        } else {
          // Purchase succeeded but Firestore update failed
          console.warn('⚠️ Purchase succeeded but Firestore update failed');
          return {
            success: true,
            customerInfo,
            productIdentifier,
            warning: 'Purchase completed but user data sync failed'
          };
        }
      } else {
        return {
          success: false,
          error: 'Purchase completed but premium access not granted'
        };
      }
    } catch (error) {
      if (error.code === 'PURCHASE_CANCELLED') {
        return {
          success: false,
          cancelled: true,
          error: 'Purchase cancelled by user'
        };
      } else {
        console.error('Purchase error:', error);
        return {
          success: false,
          error: error.message
        };
      }
    }
  }

  // Check current subscription status and sync with Firestore
  static async checkSubscriptionStatus() {
    try {
      const customerInfo = await Purchases.getCustomerInfo();
      
      // Check if user has active premium entitlement
      const hasActivePremium = customerInfo.entitlements.active['premium'] !== undefined;
      
      // Extract subscription details if premium is active
      let subscriptionDetails = null;
      if (hasActivePremium) {
        const premiumEntitlement = customerInfo.entitlements.active['premium'];
        subscriptionDetails = {
          productIdentifier: premiumEntitlement.productIdentifier,
          expirationDate: premiumEntitlement.expirationDate,
          purchaseDate: premiumEntitlement.latestPurchaseDate,
          originalAppUserId: customerInfo.originalAppUserId,
        };
      }

      // Update Firestore with current status
      await this.updatePremiumStatus(hasActivePremium, subscriptionDetails);
      
      return {
        hasActivePremium,
        customerInfo,
        activeSubscriptions: Object.keys(customerInfo.entitlements.active)
      };
    } catch (error) {
      console.error('Error checking subscription status:', error);
      
      // Fallback to checking Firestore using your existing auth service
      try {
        const firestorePremium = await authService.checkPremiumStatus();
        return {
          hasActivePremium: firestorePremium,
          error: error.message,
          fallbackUsed: true
        };
      } catch (fallbackError) {
        console.error('Fallback check also failed:', fallbackError);
        return {
          hasActivePremium: false,
          error: error.message
        };
      }
    }
  }

  // Restore purchases and sync with Firestore
  static async restorePurchases() {
    try {
      const customerInfo = await Purchases.restorePurchases();
      
      const hasActivePremium = customerInfo.entitlements.active['premium'] !== undefined;
      
      // Extract subscription details if premium is active
      let subscriptionDetails = null;
      if (hasActivePremium) {
        const premiumEntitlement = customerInfo.entitlements.active['premium'];
        subscriptionDetails = {
          productIdentifier: premiumEntitlement.productIdentifier,
          expirationDate: premiumEntitlement.expirationDate,
          purchaseDate: premiumEntitlement.latestPurchaseDate,
          originalAppUserId: customerInfo.originalAppUserId,
        };
      }

      // Update Firestore with restored status
      const updateSuccess = await this.updatePremiumStatus(hasActivePremium, subscriptionDetails);
      
      return {
        success: true,
        hasActivePremium,
        customerInfo,
        firestoreUpdated: updateSuccess
      };
    } catch (error) {
      console.error('Error restoring purchases:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get customer info (useful for debugging)
  static async getCustomerInfo() {
    try {
      const customerInfo = await Purchases.getCustomerInfo();
      return customerInfo;
    } catch (error) {
      console.error('Error getting customer info:', error);
      return null;
    }
  }

  // Check premium status from Firestore (fallback method using your existing auth service)
  static async checkFirestorePremiumStatus() {
    try {
      return await authService.checkPremiumStatus();
    } catch (error) {
      console.error('Error checking Firestore premium status:', error);
      return false;
    }
  }

  // Force sync RevenueCat status with Firestore (useful for debugging)
  static async forceSyncWithFirestore() {
    try {
      console.log('🔄 Force syncing RevenueCat with Firestore...');
      const status = await this.checkSubscriptionStatus();
      return status;
    } catch (error) {
      console.error('Error during force sync:', error);
      return { hasActivePremium: false, error: error.message };
    }
  }
}

export default PurchaseService;
