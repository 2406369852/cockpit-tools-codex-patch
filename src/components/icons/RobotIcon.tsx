import { CSSProperties } from 'react';
import antigravityIcon from '../../assets/icons/antigravity.svg';

type RobotIconProps = {
  className?: string;
  style?: CSSProperties;
};

export function RobotIcon({ className = 'nav-item-icon', style }: RobotIconProps) {
  return (
    <img
      src={antigravityIcon}
      className={className}
      style={style}
      alt=""
      aria-hidden="true"
    />
  );
}
