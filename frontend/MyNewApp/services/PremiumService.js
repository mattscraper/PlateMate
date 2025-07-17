// PremiumService.js - Fixed Version with Proper Status Management
import { doc, getDoc, updateDoc, onSnapshot } from "firebase/firestore";
import { db, auth } from "../firebaseConfig";
import PurchaseService from "./PurchaseService";

class PremiumService {
  static instance = null;
  static listeners = new Set();
  static currentStatus = false;
  static isInitialized = false;
  static unsubscribeCustomerDoc = null;
  static unsubscribeUserDoc = null;
  static currentUserId = null;

  // Singleton pattern
  static getInstance() {
    if (!this.instance) {
      this.instance = new PremiumService();
    }
    return this.instance;
  }

  // Initialize the service with real-time listening
  static async initialize(user) {
    if (!user) {
      console.log('🚫 PremiumService: No user provided for initialization');
      this.cleanup();
      return false;
    }

    try {
      console.log('🚀 PremiumService: Initializing for user:', user.uid);
      this.currentUserId = user.uid;
      
      // Set up real-time listeners for both customer and user documents
      this.setupUserDocumentListener(user.uid);
      this.setupCustomerDocumentListener(user.uid);
      
      // Initial status check with multiple sources
      const initialStatus = await this.checkPremiumStatus(user);
      this.currentStatus = initialStatus;
      this.isInitialized = true;
      
      console.log('✅ PremiumService: Initialized with status:', initialStatus);
      this.notifyListeners(initialStatus);
      
      return initialStatus;
    } catch (error) {
      console.error('❌ PremiumService: Initialization failed:', error);
      this.isInitialized = true; // Still mark as initialized to prevent infinite loops
      return false;
    }
  }

  // Set up real-time listener for user document changes (primary source)
  static setupUserDocumentListener(userId) {
    // Clean up existing listener
    if (this.unsubscribeUserDoc) {
      this.unsubscribeUserDoc();
    }

    const userDocRef = doc(db, "users", userId);
    
    this.unsubscribeUserDoc = onSnapshot(
      userDocRef,
      (doc) => {
        console.log('📡 PremiumService: User document updated');
        if (doc.exists()) {
          const userData = doc.data();
          const isPremium = userData.isPremium || false;
          
          console.log('📡 PremiumService: User doc premium status:', isPremium);
          
          // Update status if changed
          if (isPremium !== this.currentStatus) {
            console.log(`🔄 PremiumService: Status changed from ${this.currentStatus} to ${isPremium} (from user doc)`);
            this.updateStatus(isPremium);
          }
        } else {
          console.log('📡 PremiumService: User document does not exist');
          this.updateStatus(false);
        }
      },
      (error) => {
        console.error('❌ PremiumService: User document listener error:', error);
      }
    );
  }

  // Set up real-time listener for customer document changes (secondary source)
  static setupCustomerDocumentListener(userId) {
    // Clean up existing listener
    if (this.unsubscribeCustomerDoc) {
      this.unsubscribeCustomerDoc();
    }

    const customerDocRef = doc(db, "customers", userId);
    
    this.unsubscribeCustomerDoc = onSnapshot(
      customerDocRef,
      (doc) => {
        console.log('📡 PremiumService: Customer document updated');
        if (doc.exists()) {
          this.handleCustomerDocumentChange(doc.data(), userId);
        } else {
          console.log('📡 PremiumService: Customer document does not exist');
          // Don't immediately set to false - user doc is primary source
        }
      },
      (error) => {
        console.error('❌ PremiumService: Customer document listener error:', error);
      }
    );
  }

  // Handle customer document changes and sync to user document
  static async handleCustomerDocumentChange(customerData, userId) {
    try {
      console.log('🔄 PremiumService: Processing customer document change');
      
      let isPremiumFromCustomer = false;

      // Check subscriptions
      if (customerData.subscriptions) {
        const subscriptions = Object.values(customerData.subscriptions);
        const activeSubscriptions = subscriptions.filter(sub =>
          sub.status === 'active' ||
          sub.status === 'trialing' ||
          sub.status === 'past_due'
        );
        
        if (activeSubscriptions.length > 0) {
          console.log('✅ PremiumService: Active subscription found in customer doc');
          isPremiumFromCustomer = true;
        }
      }

      // Check entitlements if no active subscription
      if (!isPremiumFromCustomer && customerData.entitlements) {
        const premiumEntitlements = ['premium', 'pro'];
        
        for (const entKey of premiumEntitlements) {
          const entitlement = customerData.entitlements[entKey];
          if (entitlement) {
            const expiresDate = new Date(entitlement.expires_date);
            if (expiresDate > new Date()) {
              console.log(`✅ PremiumService: Active ${entKey} entitlement found in customer doc`);
              isPremiumFromCustomer = true;
              break;
            }
          }
        }
      }

      // Sync to users collection if customer doc shows premium but user doc doesn't
      const userDoc = await getDoc(doc(db, "users", userId));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const currentUserPremium = userData.isPremium || false;
        
        if (isPremiumFromCustomer && !currentUserPremium) {
          console.log('🔄 PremiumService: Syncing premium status from customer to user doc');
          await this.syncToUsersCollection(userId, true);
        } else if (!isPremiumFromCustomer && currentUserPremium) {
          console.log('🔄 PremiumService: Syncing premium removal from customer to user doc');
          await this.syncToUsersCollection(userId, false);
        }
      }

    } catch (error) {
      console.error('❌ PremiumService: Error handling customer document change:', error);
    }
  }

  // Core premium status check with multiple sources
  static async checkPremiumStatus(user = null) {
    try {
      const currentUser = user || auth.currentUser;
      if (!currentUser) {
        console.log('❌ PremiumService: No user for premium check');
        return false;
      }

      console.log('🔍 PremiumService: Checking premium status for:', currentUser.uid);

      // Method 1: Check user document first (most reliable for our app)
      try {
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const userPremium = userData.isPremium || false;
          
          console.log('🔍 PremiumService: User document premium status:', userPremium);
          
          if (userPremium) {
            return true;
          }
        }
      } catch (userDocError) {
        console.log('⚠️ PremiumService: User document check failed:', userDocError.message);
      }

      // Method 2: Check custom claims (for RevenueCat extension)
      try {
        const idTokenResult = await currentUser.getIdTokenResult(true);
        const claims = idTokenResult.claims;
        
        console.log('🔍 PremiumService: Checking custom claims:', claims);
        
        // Check RevenueCat entitlements in claims
        if (claims.revenueCatEntitlements) {
          const entitlements = Array.isArray(claims.revenueCatEntitlements)
            ? claims.revenueCatEntitlements
            : [claims.revenueCatEntitlements];
            
          const hasPremium = entitlements.some(ent =>
            typeof ent === 'string' && (ent.includes('premium') || ent.includes('pro'))
          );
          
          if (hasPremium) {
            console.log('✅ PremiumService: Premium found in custom claims');
            // Sync to user document
            await this.syncToUsersCollection(currentUser.uid, true);
            return true;
          }
        }

        // Check other premium indicators
        if (claims.stripeRole === 'premium' || claims.stripeRole === 'pro' ||
            claims.premium === true || claims.isPremium === true) {
          console.log('✅ PremiumService: Premium found in other claims');
          // Sync to user document
          await this.syncToUsersCollection(currentUser.uid, true);
          return true;
        }
      } catch (claimsError) {
        console.log('⚠️ PremiumService: Custom claims check failed:', claimsError.message);
      }

      // Method 3: Check customer document
      try {
        const customerDoc = await getDoc(doc(db, "customers", currentUser.uid));
        if (customerDoc.exists()) {
          const customerData = customerDoc.data();
          
          // Check active subscriptions
          if (customerData.subscriptions) {
            const subscriptions = Object.values(customerData.subscriptions);
            const activeSubscriptions = subscriptions.filter(sub =>
              sub.status === 'active' || sub.status === 'trialing' || sub.status === 'past_due'
            );
            
            if (activeSubscriptions.length > 0) {
              console.log('✅ PremiumService: Active subscription found in customer doc');
              // Sync to user document
              await this.syncToUsersCollection(currentUser.uid, true);
              return true;
            }
          }

          // Check active entitlements
          if (customerData.entitlements) {
            const premiumEntitlements = ['premium', 'pro'];
            for (const entKey of premiumEntitlements) {
              const entitlement = customerData.entitlements[entKey];
              if (entitlement) {
                const expiresDate = new Date(entitlement.expires_date);
                if (expiresDate > new Date()) {
                  console.log('✅ PremiumService: Active entitlement found in customer doc');
                  // Sync to user document
                  await this.syncToUsersCollection(currentUser.uid, true);
                  return true;
                }
              }
            }
          }
        }
      } catch (firestoreError) {
        console.log('⚠️ PremiumService: Customer document check failed:', firestoreError.message);
      }

      console.log('❌ PremiumService: No premium status found');
      return false;

    } catch (error) {
      console.error('❌ PremiumService: Premium status check error:', error);
      return false;
    }
  }

  // Update status and notify listeners
  static updateStatus(newStatus) {
    const oldStatus = this.currentStatus;
    this.currentStatus = newStatus;
    
    if (oldStatus !== newStatus) {
      console.log(`📢 PremiumService: Broadcasting status change: ${oldStatus} -> ${newStatus}`);
      this.notifyListeners(newStatus);
    }
  }

  // Sync premium status to users collection (primary source of truth)
  static async syncToUsersCollection(userId, isPremium) {
    try {
      console.log(`🔄 PremiumService: Syncing ${isPremium} to users collection for ${userId}`);
      
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, {
        isPremium: isPremium,
        premiumStatusUpdated: new Date().toISOString(),
        'usage.lastActive': new Date().toISOString()
      });
      
      console.log('✅ PremiumService: Successfully synced to users collection');
      return true;
    } catch (error) {
      console.error('❌ PremiumService: Failed to sync to users collection:', error);
      return false;
    }
  }

  // Subscribe to premium status changes
  static subscribe(callback) {
    console.log('📧 PremiumService: Adding listener');
    this.listeners.add(callback);
    
    // Immediately call with current status if initialized
    if (this.isInitialized) {
      callback(this.currentStatus);
    }

    // Return unsubscribe function
    return () => {
      console.log('📧 PremiumService: Removing listener');
      this.listeners.delete(callback);
    };
  }

  // Notify all listeners
  static notifyListeners(status) {
    console.log(`📢 PremiumService: Notifying ${this.listeners.size} listeners with status:`, status);
    this.listeners.forEach(callback => {
      try {
        callback(status);
      } catch (error) {
        console.error('❌ PremiumService: Listener callback error:', error);
      }
    });
  }

  // Get current status synchronously
  static getCurrentStatus() {
    return this.currentStatus;
  }

  // Force refresh premium status
  static async forceRefresh() {
    try {
      console.log('🔄 PremiumService: Force refreshing premium status');
      
      const user = auth.currentUser;
      if (!user) {
        this.updateStatus(false);
        return false;
      }

      // Force refresh user token first
      await user.getIdToken(true);
      
      // Check status from all sources
      const newStatus = await this.checkPremiumStatus(user);
      this.updateStatus(newStatus);
      
      return newStatus;
    } catch (error) {
      console.error('❌ PremiumService: Force refresh failed:', error);
      return false;
    }
  }

  // Handle purchase completion with immediate Firestore update
  static async handlePurchaseSuccess(purchaseInfo) {
    try {
      console.log('💳 PremiumService: Handling purchase success');
      
      const user = auth.currentUser;
      if (!user) {
        console.error('❌ PremiumService: No user for purchase success handling');
        return;
      }

      // Immediately update user document
      const synced = await this.syncToUsersCollection(user.uid, true);
      if (synced) {
        // Optimistically update status
        this.updateStatus(true);
      }
      
      // Schedule a delayed refresh for backend processing
      setTimeout(async () => {
        try {
          await this.forceRefresh();
        } catch (error) {
          console.warn('⚠️ PremiumService: Delayed refresh failed:', error);
        }
      }, 3000);
      
    } catch (error) {
      console.error('❌ PremiumService: Error handling purchase success:', error);
    }
  }

  // Cleanup
  static cleanup() {
    console.log('🧹 PremiumService: Cleaning up');
    
    if (this.unsubscribeCustomerDoc) {
      this.unsubscribeCustomerDoc();
      this.unsubscribeCustomerDoc = null;
    }
    
    if (this.unsubscribeUserDoc) {
      this.unsubscribeUserDoc();
      this.unsubscribeUserDoc = null;
    }
    
    this.listeners.clear();
    this.currentStatus = false;
    this.isInitialized = false;
    this.currentUserId = null;
  }

  // Debug method
  static async getDebugInfo() {
    try {
      const user = auth.currentUser;
      if (!user) return { error: 'No user' };

      const [userDoc, customerDoc, idTokenResult] = await Promise.all([
        getDoc(doc(db, "users", user.uid)),
        getDoc(doc(db, "customers", user.uid)),
        user.getIdTokenResult(true)
      ]);

      return {
        user: { uid: user.uid, email: user.email },
        userDocument: userDoc.exists() ? userDoc.data() : null,
        customerDocument: customerDoc.exists() ? customerDoc.data() : null,
        customClaims: idTokenResult.claims,
        currentStatus: this.currentStatus,
        isInitialized: this.isInitialized,
        listenerCount: this.listeners.size,
        currentUserId: this.currentUserId
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  // Manual premium activation (for testing/admin use)
  static async activatePremiumManually(userId = null) {
    try {
      const user = auth.currentUser;
      const targetUserId = userId || (user ? user.uid : null);
      
      if (!targetUserId) {
        throw new Error('No user ID provided');
      }

      console.log('🧪 PremiumService: Manually activating premium for:', targetUserId);
      
      const synced = await this.syncToUsersCollection(targetUserId, true);
      if (synced && targetUserId === this.currentUserId) {
        this.updateStatus(true);
      }
      
      return synced;
    } catch (error) {
      console.error('❌ PremiumService: Manual activation failed:', error);
      return false;
    }
  }
}

export default PremiumService;
