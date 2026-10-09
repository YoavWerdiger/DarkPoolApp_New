import React from 'react';
import { Image } from 'react-native';

// וי כחול «משתמש מאומת» (icons8 64 חתוך לחותם עצמו, 47×47 — בלי השוליים השקופים שהקטינו אותו)
const VERIFIED = require('../../../assets/badges/verified.png');

type Props = {
  size?: number;
};

/** וי כחול «משתמש מאומת» */
export function VerifiedBadge({ size = 16 }: Props) {
  return (
    <Image
      source={VERIFIED}
      style={{ width: size, height: size }}
      resizeMode="contain"
      accessibilityLabel="משתמש מאומת"
    />
  );
}

export default VerifiedBadge;
