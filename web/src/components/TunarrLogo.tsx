import type { SVGProps } from 'react';
import { useIsDarkMode } from '../hooks/useTunarrTheme.ts';

export default function TunarrLogo(props: SVGProps<SVGElement>) {
  const darkMode = useIsDarkMode();
  const currentColor = darkMode ? '#616161' : '#231A12';

  return (
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 250 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={props.style}
    >
      <line
        x1="105.181"
        y1="24.7785"
        x2="119.181"
        y2="49.7785"
        stroke={currentColor}
        strokeWidth="5"
      />
      <line
        x1="140.16"
        y1="23.404"
        x2="124.069"
        y2="47.1122"
        stroke={currentColor}
        strokeWidth="5"
      />
      <path
        d="M19 55C19 49.4772 23.4772 45 29 45H221C226.523 45 231 49.4772 231 55V173C231 178.523 226.523 183 221 183H29C23.4772 183 19 178.523 19 173V55Z"
        fill={currentColor}
      />
      <path
        d="M19 54.7872C19 49.3819 23.6076 45 29.2913 45H220.709C226.392 45 231 49.3819 231 54.7872V173.213C231 178.618 226.392 183 220.709 183H29.2913C23.6076 183 19 178.618 19 173.213V54.7872Z"
        fill={currentColor}
      />
      <circle cx="103" cy="22" r="7" fill={currentColor} />
      <circle cx="142" cy="19" r="7" fill={currentColor} />
      <path
        d="M39 79C39 73.4772 43.4772 69 49 69H74.5191V162H49C43.4772 162 39 157.523 39 152V79Z"
        fill="#DD3C2C"
      />
      <path
        d="M144.481 69H170C175.523 69 180 73.4772 180 79V152C180 157.523 175.523 162 170 162H144.481V69Z"
        fill="#E98E1D"
      />
      <rect x="110.038" y="69" width="35.5191" height="93" fill="#68AAE5" />
      <rect x="74.5191" y="69" width="35.5191" height="93" fill="#8DCA23" />
      <circle cx="207" cy="87" r="8" fill="white" />
      <circle cx="207" cy="143" r="8" fill="white" />
      <circle cx="207" cy="115" r="8" fill="white" />
    </svg>
  );
}
