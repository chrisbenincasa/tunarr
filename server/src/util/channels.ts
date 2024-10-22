/**
 * Generates a short but unique ID for this channel
 * in addition to the number. This helps differentiate channels
 * for some players whose guides can get confused.
 */
export function getChannelId(channelNum: number): string {
  let num = channelNum;
  let id = 0;
  while (num !== 0) {
    id += (num % 10) + 48;
    num = Math.floor(num / 10);
  }

  return `C${channelNum}.${id}.tunarr.com`;
}
