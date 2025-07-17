// Simple Working PurchaseService - Back to Basics
import Purchases from 'react-native-purchases';

class PurchaseService {
  static isConfigured = false;
  static isAvailable = false;

  // Check if RevenueCat is available
  static checkAvailability() {
    try {
      if (Purchases && typeof Purchases.configure === 'function') {
        this.isAvailable = true;
        console.log('✅ RevenueCat SDK is available');
        return true;
      } else {
        console.log('❌ RevenueCat SDK not properly imported');
        return false;
      }
    } catch (error) {
      console.log('❌ RevenueCat SDK not installed:', error.message);
      return false;
    }
  }

  // Configure RevenueCat - call this ONCE when app starts
  static async configure(apiKey, appUserID = null) {
    if (this.isConfigured) {
      console.log('✅ RevenueCat already configured');
      return true;
    }

    if (!this.checkAvailability()) {
      return false;
    }

    try {
      console.log('🔧 Configuring RevenueCat...');
      
      await Purchases.configure({
        apiKey: 'appl_fwRWQRdSViPvwzChtARGpDVvLEs',
        appUserID: appUserID, // Use Firebase UID
      });

      this.isConfigured = true;
      console.log('✅ RevenueCat configured successfully');
      return true;
    } catch (error) {
      console.error('❌ RevenueCat configuration failed:', error);
      return false;
    }
  }

  // Get available packages/products
  static async getOfferings() {
    if (!this.isConfigured) {
      console.log('❌ RevenueCat not configured');
      return [];
    }

    try {
      console.log('📦 Fetching offerings...');
      const offerings = await Purchases.getOfferings();
      
      if (offerings.current && offerings.current.availablePackages.length > 0) {
        console.log('✅ Found', offerings.current.availablePackages.length, 'packages');
        return offerings.current.availablePackages;
      } else {
        console.log('⚠️ No current offering, checking all offerings...');
        const allOfferings = Object.values(offerings.all);
        if (allOfferings.length > 0) {
          return allOfferings[0].availablePackages || [];
        }
        return [];
      }
    } catch (error) {
      console.error('❌ Failed to get offerings:', error);
      return [];
    }
  }

  // Purchase a package
  static async purchasePackage(packageToPurchase) {
    if (!this.isConfigured) {
      return {
        success: false,
        error: 'RevenueCat not configured'
      };
    }

    try {
      console.log('💳 Starting purchase:', packageToPurchase.identifier);
      
      const purchaseResult = await Purchases.purchasePackage(packageToPurchase);
      
      console.log('💳 Purchase completed:', {
        productIdentifier: purchaseResult.productIdentifier,
        activeEntitlements: Object.keys(purchaseResult.customerInfo.entitlements.active)
      });

      // Check if user now has premium access
      const hasPremium = purchaseResult.customerInfo.entitlements.active['premium'] !== undefined;
      
      return {
        success: true,
        hasPremium: hasPremium,
        customerInfo: purchaseResult.customerInfo,
        productIdentifier: purchaseResult.productIdentifier
      };
    } catch (error) {
      console.error('❌ Purchase failed:', error);
      
      // Handle user cancellation
      if (error.code === 'PURCHASE_CANCELLED' || error.message.includes('cancelled')) {
        return {
          success: false,
          cancelled: true,
          error: 'Purchase cancelled by user'
        };
      }
      
      return {
        success: false,
        error: error.message || 'Purchase failed'
      };
    }
  }

  // Restore purchases
  static async restorePurchases() {
    if (!this.isConfigured) {
      return {
        success: false,
        error: 'RevenueCat not configured'
      };
    }

    try {
      console.log('🔄 Restoring purchases...');
      
      const customerInfo = await Purchases.restorePurchases();
      const hasPremium = customerInfo.entitlements.active['premium'] !== undefined;
      
      console.log('🔄 Restore completed:', {
        hasPremium: hasPremium,
        activeEntitlements: Object.keys(customerInfo.entitlements.active)
      });
      
      return {
        success: true,
        hasPremium: hasPremium,
        customerInfo: customerInfo
      };
    } catch (error) {
      console.error('❌ Restore failed:', error);
      return {
        success: false,
        error: error.message || 'Restore failed'
      };
    }
  }

  // Get customer info
  static async getCustomerInfo() {
    if (!this.isConfigured) {
      return null;
    }

    try {
      const customerInfo = await Purchases.getCustomerInfo();
      return customerInfo;
    } catch (error) {
      console.error('❌ Failed to get customer info:', error);
      return null;
    }
  }

  // Check if user has premium
  static async checkPremiumStatus() {
    try {
      const customerInfo = await this.getCustomerInfo();
      if (!customerInfo) return false;
      
      const hasPremium = customerInfo.entitlements.active['premium'] !== undefined;
      console.log('💎 Premium status check:', hasPremium);
      return hasPremium;
    } catch (error) {
      console.error('❌ Premium status check failed:', error);
      return false;
    }
  }

  // Reset configuration (for logout)
  static reset() {
    this.isConfigured = false;
    console.log('🔄 RevenueCat configuration reset');
  }
}

export default PurchaseService;
