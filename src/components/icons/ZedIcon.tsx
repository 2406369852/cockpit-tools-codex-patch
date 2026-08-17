import type { CSSProperties } from 'react';
import zedIcon from '../../assets/icons/zed.png';

type ZedIconProps = {
  className?: string;
  size?: number;
  style?: CSSProperties;
};

export function ZedIcon({
  className = 'nav-item-icon',
  size,
  style,
}: ZedIconProps) {
  const mergedStyle: CSSProperties | undefined =
    typeof size === 'number'
      ? {
          width: size,
          height: size,
          ...style,
        }
      : style;

  return (
    <img
      src={zedIcon}
      className={className}
      style={mergedStyle}
      alt=""
      aria-hidden="true"
      draggable={false}
    />
  );
}
