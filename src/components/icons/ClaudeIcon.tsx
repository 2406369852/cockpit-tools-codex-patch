import type { CSSProperties, ImgHTMLAttributes } from 'react';
import claudeIcon from '../../assets/icons/claude.png';

interface ClaudeIconProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt'> {
  size?: number;
  style?: CSSProperties;
}

export function ClaudeIcon({ size = 20, style, ...props }: ClaudeIconProps) {
  return (
    <img
      src={claudeIcon}
      alt=""
      width={size}
      height={size}
      style={{
        width: size,
        height: size,
        display: 'inline-block',
        objectFit: 'contain',
        ...style,
      }}
      aria-hidden="true"
      draggable={false}
      {...props}
    />
  );
}
