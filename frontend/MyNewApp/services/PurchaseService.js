// Fixed PurchaseService.js
import Purchases from 'react-native-purchases';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';

class PurchaseService {
  static isConfigured = false;


  static async configure() {
    if (this.isConfigured) {
      return;
    }
    
    try {
      // Get current Firebase user ID to link with RevenueCat
      const currentUser = auth.currentUser;
      const appUserId = currentUser?.uid || null;
      
      console.log('🔧 Configuring RevenueCat with user:', appUserId);
      
      await Purchases.configure({
        apiKey: 'appl_fwRWQRdSViPvwzChtARGpDVvLEs', // Replace with your actual key
        appUserID: appUserId, // Link RevenueCat to your Firebase user
      });
      
      this.isConfigured = true;
      console.log('✅ RevenueCat configured successfully');
      
    } catch (error) {
      console.error('❌ Error configuring RevenueCat:', error);
      throw error;
    }
  }

  // Fixed offerings fetch
  static async getOfferings() {
    try {
      await this.configure(); // Ensure configured first
      
      console.log('📦 Fetching offerings...');
      const offerings = await Purchases.getOfferings();
      
      console.log('🛍️ Raw offerings:', offerings);
      
      if (offerings.current !== null && offerings.current.availablePackages.length > 0) {
        console.log('✅ Found packages:', offerings.current.availablePackages.length);
        return offerings.current.availablePackages;
      } else {
        console.warn('⚠️ No current offering found');
        
        // Check if there are any offerings at all
        const allOfferings = Object.values(offerings.all);
        if (allOfferings.length > 0) {
          console.log('📋 Using first available offering');
          return allOfferings[0].availablePackages || [];
        }
        
        console.error('❌ No offerings available at all');
        return [];
      }
    } catch (error) {
      console.error('❌ Error fetching offerings:', error);
      return [];
    }
  }

  // Update premium status in Firestore
  static async updatePremiumStatus(hasActivePremium, subscriptionDetails = null) {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        console.log('No authenticated user to update');
        return false;
      }

      const userRef = doc(db, 'users', currentUser.uid);
      
      const updateData = {
        isPremium: hasActivePremium,
        premiumUpdatedAt: new Date().toISOString(),
      };

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

  // Purchase a subscription package
  static async purchasePackage(packageToPurchase) {
    try {
      console.log('🛒 Starting purchase for package:', packageToPurchase.identifier);
      
      const { customerInfo, productIdentifier } = await Purchases.purchasePackage(packageToPurchase);
      
      console.log('💰 Purchase response:', { productIdentifier });
      console.log('👤 Customer info:', customerInfo);
      
      if (customerInfo.entitlements.active['premium']) {
        const premiumEntitlement = customerInfo.entitlements.active['premium'];
        const subscriptionDetails = {
          productIdentifier,
          expirationDate: premiumEntitlement.expirationDate,
          purchaseDate: premiumEntitlement.latestPurchaseDate,
          originalAppUserId: customerInfo.originalAppUserId,
        };

        const updateSuccess = await this.updatePremiumStatus(true, subscriptionDetails);
        
        console.log('✅ Purchase successful!', productIdentifier);
        return {
          success: true,
          customerInfo,
          productIdentifier,
          firestoreUpdated: updateSuccess
        };
      } else {
        console.error('❌ Purchase completed but no premium entitlement found');
        return {
          success: false,
          error: 'Purchase completed but premium access not granted'
        };
      }
    } catch (error) {
      console.error('❌ Purchase error:', error);
      
      if (error.code === 'PURCHASE_CANCELLED') {
        return {
          success: false,
          cancelled: true,
          error: 'Purchase cancelled by user'
        };
      } else {
        return {
          success: false,
          error: error.message
        };
      }
    }
  }

  // Check current subscription status
  static async checkSubscriptionStatus() {
    try {
      await this.configure();
      
      console.log('🔍 Checking subscription status...');
      const customerInfo = await Purchases.getCustomerInfo();
      
      console.log('👤 Customer entitlements:', customerInfo.entitlements);
      
      const hasActivePremium = customerInfo.entitlements.active['premium'] !== undefined;
      
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
      
      console.log('✅ Subscription status:', hasActivePremium);
      
      return {
        hasActivePremium,
        customerInfo,
        activeSubscriptions: Object.keys(customerInfo.entitlements.active)
      };
    } catch (error) {
      console.error('❌ Error checking subscription status:', error);
      
      // Fallback to Firestore
      try {
        const currentUser = auth.currentUser;
        if (!currentUser) {
          return { hasActivePremium: false, error: 'No user' };
        }
        
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        const firestorePremium = userDoc.exists() ? userDoc.data().isPremium || false : false;
        
        console.log('📋 Using Firestore fallback:', firestorePremium);
        
        return {
          hasActivePremium: firestorePremium,
          fallbackUsed: true,
          error: error.message
        };
      } catch (fallbackError) {
        console.error('❌ Firestore fallback also failed:', fallbackError);
        return {
          hasActivePremium: false,
          error: fallbackError.message
        };
      }
    }
  }

  // Restore purchases
  static async restorePurchases() {
    try {
      await this.configure();
      
      console.log('🔄 Restoring purchases...');
      const customerInfo = await Purchases.restorePurchases();
      
      const hasActivePremium = customerInfo.entitlements.active['premium'] !== undefined;
      
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

      const updateSuccess = await this.updatePremiumStatus(hasActivePremium, subscriptionDetails);
      
      console.log('✅ Purchases restored:', hasActivePremium);
      
      return {
        success: true,
        hasActivePremium,
        customerInfo,
        firestoreUpdated: updateSuccess
      };
    } catch (error) {
      console.error('❌ Error restoring purchases:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get customer info
  static async getCustomerInfo() {
    try {
      await this.configure();
      const customerInfo = await Purchases.getCustomerInfo();
      console.log('👤 Customer info retrieved successfully');
      return customerInfo;
    } catch (error) {
      console.error('❌ Error getting customer info:', error);
      return null;
    }
  }

  // Debug method to check everything
  static async debugStatus() {
    try {
      console.log('🐛 Starting debug...');
      
      // Check configuration
      console.log('Config status:', this.isConfigured);
      
      // Try to configure
      await this.configure();
      
      // Check offerings
      const offerings = await this.getOfferings();
      console.log('Available packages:', offerings.length);
      
      // Check customer info
      const customerInfo = await this.getCustomerInfo();
      console.log('Customer ID:', customerInfo?.originalAppUserId);
      
      // Check subscription status
      const status = await this.checkSubscriptionStatus();
      
      return {
        configured: this.isConfigured,
        packagesAvailable: offerings.length,
        customerInfo: customerInfo?.originalAppUserId,
        premiumStatus: status.hasActivePremium,
        activeEntitlements: status.activeSubscriptions
      };
    } catch (error) {
      console.error('❌ Debug failed:', error);
      return { error: error.message };
    }
  }
}

export default PurchaseService;
