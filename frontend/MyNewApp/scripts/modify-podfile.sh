#!/bin/bash

# Check if Podfile exists
if [ -f ios/Podfile ]; then
  echo "Modifying Podfile to add use_modular_headers!"
  
  # Check if use_modular_headers! already exists
  if ! grep -q "use_modular_headers!" ios/Podfile; then
    # Add use_modular_headers! after the platform :ios line
    sed -i.bak 's/platform :ios.*/&\nuse_modular_headers!/' ios/Podfile
    echo "Added use_modular_headers! to Podfile"
  else
    echo "use_modular_headers! already exists in Podfile"
  fi
else
  echo "Podfile not found at ios/Podfile"
fi
