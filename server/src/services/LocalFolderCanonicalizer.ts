import { sortBy } from 'lodash-es';
import crypto from 'node:crypto';
import type { Dirent, Stats } from 'node:fs';
import type { Canonicalizer } from './Canonicalizer.ts';

type DirentAndStats = {
  dirent: Dirent;
  stats: Stats;
};

export type FolderAndContents = {
  folder: Dirent;
  contents: DirentAndStats[];
};

export class LocalFolderCanonicalizer
  implements Canonicalizer<FolderAndContents>
{
  getCanonicalId(t: FolderAndContents): string {
    const sha = crypto.createHash('sha1');
    for (const { dirent, stats } of sortBy(
      t.contents,
      ({ dirent: name }) => name,
    )) {
      sha.update(dirent.name);
      sha.update(stats.mtimeMs.toString());
    }
    return sha.digest('hex');
  }
}
