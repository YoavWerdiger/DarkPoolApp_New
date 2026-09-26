import { useMemo } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { createDesignTokensForTheme } from './designTokensStatic';

export const useDesignTokens = () => {
  const { isDarkMode } = useTheme();
  return useMemo(() => createDesignTokensForTheme(isDarkMode), [isDarkMode]);
};
