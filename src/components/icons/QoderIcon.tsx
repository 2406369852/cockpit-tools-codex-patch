import { CSSProperties } from 'react';
import qoderIcon from '../../assets/icons/qoder.png';

type QoderIconProps = {
  className?: string;
  style?: CSSProperties;
};

export function QoderIcon({ className = 'nav-item-icon', style }: QoderIconProps) {
  return (
    <img
      className={className}
      style={style}
      src={qoderIcon}
      alt=""
      aria-hidden="true"
      draggable={false}
    />
  );
}
