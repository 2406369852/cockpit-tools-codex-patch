import { CSSProperties } from 'react';
import antigravityIcon from '../../assets/icons/antigravity-app.png';

type AntigravityIconProps = {
  className?: string;
  style?: CSSProperties;
};

export function AntigravityIcon({ className = 'nav-item-icon', style }: AntigravityIconProps) {
  return <img src={antigravityIcon} className={className} style={style} alt="" aria-hidden="true" />;
}
