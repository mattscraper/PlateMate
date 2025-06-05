import * as InAppPurchases from 'expo-in-app-purchases';
import { Platform, Alert } from 'react-native';
import SubscriptionService from './SubscriptionService';

class SubscriptionManager {
  constructor() {
    this.products = [];
    this.isInitialized = false;
    
    // Replace with your actual Product IDs from App Store Connect
    this.SUBSCRIPTION_SKUS = [
      'com.platemate.recipemealplanner.monthly_subscript',
      //'com.platemate.recipemealplanner.yearly_premium',
    ];
  }

  async initialize() {
    try {
      if (Platform.OS !== 'ios') {
        console.log('Subscriptions only available on iOS');
        return false;
      }

      await InAppPurchases.connectAsync();
      console.log('✅ Subscription system connected');
      
      InAppPurchases.setPurchaseListener(this.handleSubscriptionUpdate.bind(this));
      await this.loadSubscriptions();
      
      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize subscriptions:', error);
      return false;
    }
  }

  async loadSubscriptions() {
    try {
      const products = await InAppPurchases.getProductsAsync(this.SUBSCRIPTION_SKUS);
      
      if (products.results && products.results.length > 0) {
        this.products = products.results.filter(product =>
          product.type === InAppPurchases.IAPItemType.SUBSCRIPTION
        );
        console.log('✅ Subscriptions loaded:', this.products.length);
        return this.products;
      } else {
        console.warn('⚠️ No subscription products found');
        return [];
      }
    } catch (error) {
      console.error('❌ Failed to load subscriptions:', error);
      return [];
    }
  }

  getSubscriptionProducts() {
    return this.products;
  }

  async purchaseSubscription(productId) {
    try {
      if (!this.isInitialized) {
        throw new Error('Subscription system not initialized');
      }

      console.log(`🛒 Starting subscription purchase: ${productId}`);
      const result = await InAppPurchases.purchaseItemAsync(productId);
      return result;
    } catch (error) {
      console.error('❌ Subscription purchase failed:', error);
      throw error;
    }
  }

  handleSubscriptionUpdate(result) {
    const { responseCode, results } = result;
    
    if (responseCode === InAppPurchases.IAPResponseCode.OK) {
      results?.forEach(subscription => {
        this.processSubscription(subscription);
      });
    } else if (responseCode === InAppPurchases.IAPResponseCode.USER_CANCELED) {
      console.log('👤 User canceled subscription');
    } else {
      console.error('❌ Subscription error:', responseCode);
    }
  }

  async processSubscription(subscription) {
    try {
      // For now, just validate locally and mark as premium
      // Later this will call your Cloud Function
      console.log('🎉 Processing subscription:', subscription);
      
      // Simple validation for demo
      await this.activatePremiumSubscription(subscription);
      await InAppPurchases.finishTransactionAsync(subscription, true);
      
      return { success: true, subscription };
    } catch (error) {
      console.error('❌ Failed to process subscription:', error);
      await InAppPurchases.finishTransactionAsync(subscription, false);
      return { success: false, error: error.message };
    }
  }

  async activatePremiumSubscription(subscription) {
    try {
      // For now, just use the demo upgrade
      // Later this will be replaced with Cloud Function call
      await subscriptionService.upgradeToPremiumDemo();
      console.log('✅ Premium subscription activated');
    } catch (error) {
      console.error('❌ Failed to activate subscription:', error);
      throw error;
    }
  }

  async restoreSubscriptions() {
    try {
      const result = await InAppPurchases.getPurchaseHistoryAsync();
      
      if (result.responseCode === InAppPurchases.IAPResponseCode.OK) {
        const subscriptions = result.results?.filter(purchase =>
          this.SUBSCRIPTION_SKUS.includes(purchase.productId)
        ) || [];
        
        if (subscriptions.length > 0) {
          const latestSubscription = subscriptions.sort((a, b) =>
            b.transactionDate - a.transactionDate
          )[0];
          
          const processResult = await this.processSubscription(latestSubscription);
          return processResult;
        }
      }
      
      return { success: false, error: 'No subscriptions found' };
    } catch (error) {
      console.error('❌ Failed to restore subscriptions:', error);
      return { success: false, error: error.message };
    }
  }

  async disconnect() {
    try {
      await InAppPurchases.disconnectAsync();
    } catch (error) {
      console.error('❌ Failed to disconnect:', error);
    }
  }
}

export default new SubscriptionManager();
