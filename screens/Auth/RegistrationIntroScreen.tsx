import React, { useEffect } from 'react';

/** @deprecated Split into per-question screens. Redirects for safety. */
const RegistrationIntroScreen = ({ navigation }: { navigation: any }) => {
  useEffect(() => {
    navigation.replace('RegistrationAge');
  }, [navigation]);
  return null;
};

export default RegistrationIntroScreen;
