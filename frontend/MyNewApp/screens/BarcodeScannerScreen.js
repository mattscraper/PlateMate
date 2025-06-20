import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Vibration,
  Platform,
  StatusBar,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

const BarcodeScannerScreen = ({ navigation }) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Set header style when screen is focused
  useFocusEffect(
    React.useCallback(() => {
      navigation.setOptions({
        headerStyle: {
          backgroundColor: '#000',
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 0,
        },
        headerTintColor: '#fff',
        headerTitle: () => null, // No title component
        headerBackTitleVisible: false, // Hide "Back" text on iOS
      });
    }, [navigation])
  );
  
  // Animation values
  const scanLineAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Start scan line animation
    const scanAnimation = () => {
      Animated.sequence([
        Animated.timing(scanLineAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(scanLineAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]).start(() => {
        if (!scanned) {
          scanAnimation();
        }
      });
    };

    if (!scanned) {
      scanAnimation();
    }

    return () => scanLineAnim.stopAnimation();
  }, [scanned]);

  const handleBarCodeScanned = async (scanningResult) => {
    if (scanned || isProcessing) return;
    
    setScanned(true);
    setIsProcessing(true);

    // Haptic feedback
    if (Platform.OS === 'ios') {
      Vibration.vibrate([0, 100]);
    } else {
      Vibration.vibrate(100);
    }

    // Success animation
    Animated.parallel([
      Animated.timing(pulseAnim, {
        toValue: 1.2,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0.3,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    // Navigate to product detail after brief delay
    setTimeout(() => {
      navigation.navigate('ProductDetail', { barcode: scanningResult.data });
      setIsProcessing(false);
      setScanned(false);
    }, 800);
  };

  if (!permission) {
    return (
      <View style={styles.permissionContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />
        <View style={styles.permissionContent}>
          <View style={styles.permissionContent}>
            <Ionicons name="camera" size={64} color="#008b8b" />
            <Text style={styles.permissionText}>Loading camera permissions...</Text>
          </View>
        </View>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />
        <View style={styles.permissionContent}>
          <View style={styles.permissionContent}>
            <Ionicons name="camera-outline" size={64} color="#008b8b" />
            <Text style={styles.permissionTitle}>Camera Access Required</Text>
            <Text style={styles.permissionText}>
              We need camera access to scan product barcodes
            </Text>
            <TouchableOpacity
              style={styles.permissionButton}
              onPress={requestPermission}
            >
              <Ionicons name="camera" size={20} color="white" />
              <Text style={styles.permissionButtonText}>Grant Camera Access</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  const scanLineTranslateY = scanLineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 200], // Scan area height minus scan line height
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="black" />
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ["qr", "ean13", "ean8", "code128", "code39", "upc_a", "upc_e"],
        }}
      />
      
      <View style={styles.cameraOverlay}>
        <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
          {/* Header */}
          <View style={styles.cameraHeader}>
            <TouchableOpacity
              style={styles.cameraBackButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color="white" />
            </TouchableOpacity>
            <Text style={styles.cameraHeaderText}>Scan Product Barcode</Text>
            <View style={styles.headerSpacer} />
          </View>
          
          {/* Instructions */}
          <View style={styles.instructionsContainer}>
            <Text style={styles.instructionsText}>
              Position the barcode within the frame
            </Text>
          </View>
          
          {/* Scan Area */}
          <Animated.View style={[styles.scanArea, { transform: [{ scale: pulseAnim }] }]}>
            {/* Corner brackets */}
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
            
            {/* Animated scan line */}
            {!scanned && (
              <Animated.View
                style={[
                  styles.scanLine,
                  {
                    transform: [{ translateY: scanLineTranslateY }],
                  },
                ]}
              />
            )}
            
            {/* Success indicator */}
            {scanned && (
              <View style={styles.successIndicator}>
                <Ionicons name="checkmark-circle" size={48} color="#10B981" />
              </View>
            )}
          </Animated.View>
          
          {/* Bottom content */}
          <View style={styles.bottomContent}>
            {isProcessing ? (
              <View style={styles.processingContainer}>
                <View style={styles.processingIndicator}>
                  <Ionicons name="checkmark" size={20} color="white" />
                </View>
                <Text style={styles.processingText}>Barcode detected! Loading product...</Text>
              </View>
            ) : (
              <View style={styles.tipContainer}>
                <Ionicons name="information-circle-outline" size={20} color="rgba(255, 255, 255, 0.8)" />
                <Text style={styles.tipText}>
                  Make sure the barcode is well-lit and in focus
                </Text>
              </View>
            )}
            
            <TouchableOpacity
              style={styles.manualSearchButton}
              onPress={() => navigation.navigate('ProductSearch')}
            >
              <Ionicons name="search" size={20} color="#008b8b" />
              <Text style={styles.manualSearchText}>Search Manually Instead</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  
  cameraOverlay: {
    flex: 1,
  },

  // Permission States
  permissionContainer: {
    flex: 1,
    backgroundColor: "#f8f9fa",
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  permissionContent: {
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 32,
    borderRadius: 20,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#2c3e50',
    marginTop: 16,
    marginBottom: 8,
  },
  permissionText: {
    fontSize: 16,
    color: '#7f8c8d',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  permissionButton: {
    backgroundColor: '#008b8b',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  permissionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },

  // Main Scanner UI
  overlay: {
    flex: 1,
    justifyContent: 'space-between',
  },
  
  // Camera Header
  cameraHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
  },
  cameraBackButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraHeaderText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },

  // Instructions
  instructionsContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  instructionsText: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.9,
  },

  // Scan Area
  scanArea: {
    width: 280,
    height: 200,
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  
  // Corner brackets
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: '#008b8b',
    borderWidth: 3,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderBottomWidth: 0,
    borderRightWidth: 0,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderBottomWidth: 0,
    borderLeftWidth: 0,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderTopWidth: 0,
    borderRightWidth: 0,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderTopWidth: 0,
    borderLeftWidth: 0,
  },

  // Scan line animation
  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#008b8b',
    opacity: 0.8,
    shadowColor: '#008b8b',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },

  // Success indicator
  successIndicator: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Bottom content
  bottomContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    alignItems: 'center',
  },
  
  // Processing state
  processingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.9)',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 20,
  },
  processingIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  processingText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },

  // Tip container
  tipContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  tipText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },

  // Manual search button
  manualSearchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  manualSearchText: {
    color: '#008b8b',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
});

export default BarcodeScannerScreen;
