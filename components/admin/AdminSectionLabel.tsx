import React from 'react';
import { type TextStyle } from 'react-native';
import { SettingsSectionTitle } from '../profile/ProfileSettingsUI';

type Props = {
  children: string;
  style?: TextStyle;
};

export function AdminSectionLabel({ children, style }: Props) {
  return <SettingsSectionTitle title={children} style={style} />;
}
