import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Alert,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

const BarcodeScannerScreen = ({ navigation }) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [flashEnabled, setFlashEnabled] = useState(false);

  // Auto-request permission when component mounts
  useEffect(() => {
    if (!permission?.granted && permission?.canAskAgain !== false) {
      console.log('Auto-requesting camera permission...');
      requestPermission();
    }
  }, [permission]);

  // Debug permission status
  useEffect(() => {
    console.log('Camera permission status:', permission);
    console.log('Can ask again:', permission?.canAskAgain);
    console.log('Granted:', permission?.granted);
  }, [permission]);

  const handleBarCodeScanned = ({ type, data }) => {
    setScanned(true);
    console.log('Barcode scanned:', { type, data });
    // Navigate to product detail with the scanned barcode
    navigation.navigate('ProductDetail', { barcode: data });
  };

  if (!permission) {
    // Camera permissions are still loading
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Loading camera permissions...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    // Camera permissions are not granted yet
    return (
      <View style={styles.container}>
        <Ionicons name="camera-outline" size={64} color="white" style={{ marginBottom: 20 }} />
        <Text style={styles.text}>Camera access required</Text>
        <Text style={styles.subText}>
          We need camera access to scan barcodes for food products
        </Text>
        <TouchableOpacity
          style={styles.permissionButton}
          onPress={async () => {
            console.log('Manual permission request...');
            const result = await requestPermission();
            console.log('Permission result:', result);
          }}
        >
          <Text style={styles.buttonText}>Grant Camera Permission</Text>
        </TouchableOpacity>
        
        {permission?.canAskAgain === false && (
          <TouchableOpacity
            style={[styles.permissionButton, { backgroundColor: '#666', marginTop: 10 }]}
            onPress={() => {
              Alert.alert(
                'Camera Permission Required',
                'Please enable camera access in your device Settings → Privacy & Security → Camera → PlateMate',
                [{ text: 'OK' }]
              );
            }}
          >
            <Text style={styles.buttonText}>Open Settings</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        enableTorch={flashEnabled}
        barcodeScannerSettings={{
          barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39'],
        }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      />
      
      <View style={styles.overlay}>
        <View style={styles.scanArea}>
          <View style={styles.scanFrame} />
        </View>
        
        <View style={styles.instructions}>
          <Text style={styles.instructionText}>
            Position the barcode within the frame
          </Text>
        </View>
        
        <View style={styles.controls}>
          <TouchableOpacity
            style={styles.controlButton}
            onPress={() => setFlashEnabled(!flashEnabled)}
          >
            <Ionicons
              name={flashEnabled ? "flash" : "flash-off"}
              size={24}
              color="white"
            />
          </TouchableOpacity>
          
          {scanned && (
            <TouchableOpacity
              style={styles.controlButton}
              onPress={() => setScanned(false)}
            >
              <Ionicons name="refresh" size={24} color="white" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 50,
  },
  scanArea: {
    width: width * 0.8,
    height: width * 0.8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFrame: {
    width: '100%',
    height: '100%',
    borderWidth: 2,
    borderColor: 'white',
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  instructions: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  instructionText: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingHorizontal: 50,
  },
  controlButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 15,
    borderRadius: 25,
  },
  text: {
    fontSize: 18,
    textAlign: 'center',
    color: 'white',
    marginBottom: 10,
  },
  subText: {
    fontSize: 14,
    textAlign: 'center',
    color: '#ccc',
    marginBottom: 30,
    paddingHorizontal: 40,
    lineHeight: 20,
  },
  permissionButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 10,
    marginTop: 20,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default BarcodeScannerScreen;
