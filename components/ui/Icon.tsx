import React from 'react';
import { getIcon } from '../../utils/iconMapping';

interface IconProps {
  name: string;
  size?: number;
  color?: string;
  strokeWidth?: number;
  style?: any;
}

export const Icon: React.FC<IconProps> = ({ 
  name, 
  size = 24, 
  color = '#000', 
  strokeWidth = 2, 
  style 
}) => {
  const IconComponent = getIcon(name, size, color, strokeWidth);
  
  if (React.isValidElement(IconComponent)) {
    return React.cloneElement(IconComponent, { style });
  }
  
  return IconComponent;
};

export default Icon;
