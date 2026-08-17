import { CSSProperties } from 'react';
import workbuddyIcon from '../../assets/icons/workbuddy.png';

type WorkbuddyIconProps = {
  className?: string;
  style?: CSSProperties;
};

export function WorkbuddyIcon({ className = 'nav-item-icon', style }: WorkbuddyIconProps) {
  return (
    <img
      className={className}
      style={style}
      src={workbuddyIcon}
      alt=""
      aria-hidden="true"
      draggable={false}
    />
  );
}
