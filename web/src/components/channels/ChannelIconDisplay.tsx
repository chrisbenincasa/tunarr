import type { ChannelIcon } from '@tunarr/types';
import TunarrLogo from '../TunarrLogo.tsx';

type Props = {
  icon: ChannelIcon | undefined;
  style?: React.CSSProperties;
  imgStyle?: React.CSSProperties;
};

export function ChannelIconDisplay({ icon, style, imgStyle }: Props) {
  if (icon?.path) {
    return <img style={imgStyle ?? style} src={icon.path} alt="" />;
  }
  if (!icon || icon.useDefaultIconFallback !== false) {
    return <TunarrLogo style={style} />;
  }
  return null;
}
