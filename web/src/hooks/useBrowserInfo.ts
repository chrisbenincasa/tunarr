import Bowser from 'bowser';

const browser = Bowser.getParser(window.navigator.userAgent);

export const useBrowserInfo = () => {
  return browser;
};
