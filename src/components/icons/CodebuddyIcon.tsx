import { CSSProperties } from 'react';
import codebuddyIcon from '../../assets/icons/codebuddy.png';

type CodebuddyIconProps = {
  className?: string;
  style?: CSSProperties;
};

export function CodebuddyIcon({ className = 'nav-item-icon', style }: CodebuddyIconProps) {
  return (
    <img
      className={className}
      style={style}
      src={codebuddyIcon}
      alt=""
      aria-hidden="true"
      draggable={false}
    />
  );
}
