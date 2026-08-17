import { CSSProperties } from 'react';
import antigravityIdeIcon from '../../assets/icons/antigravity-ide-app.png';

type AntigravityIdeIconProps = {
  className?: string;
  style?: CSSProperties;
};

export function AntigravityIdeIcon({ className = 'nav-item-icon', style }: AntigravityIdeIconProps) {
  return <img src={antigravityIdeIcon} className={className} style={style} alt="" aria-hidden="true" />;
}
