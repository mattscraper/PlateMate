import {
  collection,
  doc,
  setDoc,
  getDoc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  updateDoc,
  serverTimestamp
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { auth, db, functions } from "../firebaseConfig";

class SubscriptionService {
  constructor() {
    // These will call your Cloud Functions
    this.validateReceiptFunction = httpsCallable(functions, 'validateAppleReceipt');
    this.restoreSubscriptionFunction = httpsCallable(functions, 'restoreSubscription');
  }

  // Demo upgrade for testing
  async upgradeToPremiumDemo() {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated');

      // Update user document
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        email: user.email,
        is_premium: true,
        updated_at: serverTimestamp()
      }, { merge: true });

      console.log('✅ Demo upgrade successful');
      return { success: true };
    } catch (error) {
      console.error('❌ Demo upgrade failed:', error);
      throw error;
    }
  }

  // Validate iOS subscription receipt
  async validateSubscription(receiptData, productId, transactionId) {
    try {
      const result = await this.validateReceiptFunction({
        receipt: receiptData,
        product_id: productId,
        transaction_id: transactionId
      });

      return result.data;
    } catch (error) {
      console.error('❌ Subscription validation failed:', error);
      throw error;
    }
  }

  // Restore subscription
  async restoreSubscription(receiptData) {
    try {
      const result = await this.restoreSubscriptionFunction({
        receipt: receiptData
      });

      return result.data;
    } catch (error) {
      console.error('❌ Subscription restore failed:', error);
      throw error;
    }
  }

  // Get current subscription status
  async getSubscriptionStatus() {
    try {
      const user = auth.currentUser;
      if (!user) return { is_premium: false, subscription: null };

      // Check user document
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const userData = userDoc.data();

      return {
        is_premium: userData?.is_premium || false,
        subscription: null // You can expand this later
      };
    } catch (error) {
      console.error('❌ Error getting subscription status:', error);
      return { is_premium: false, subscription: null };
    }
  }
}

export default new SubscriptionService();

