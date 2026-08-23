import React, { useEffect } from 'react';

/** @deprecated Split into Name → Phone → Email → Password. Redirects for safety. */
const RegistrationDetailsScreen = ({ navigation }: { navigation: any }) => {
  useEffect(() => {
    navigation.replace('RegistrationName');
  }, [navigation]);
  return null;
};

export default RegistrationDetailsScreen;
