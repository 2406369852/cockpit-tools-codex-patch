import type { CSSProperties } from 'react';
import iconUrl from '../../assets/icons/zcode.png';

interface ZcodeIconProps {
  size?: number;
  className?: string;
  style?: CSSProperties;
}

export function ZcodeIcon({ size = 20, className, style }: ZcodeIconProps) {
  return (
    <img
      src={iconUrl}
      alt=""
      aria-hidden="true"
      className={className}
      style={{ width: size, height: size, objectFit: 'contain', ...style }}
    />
  );
}
