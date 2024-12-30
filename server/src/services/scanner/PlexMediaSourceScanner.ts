import { MediaSourceDB } from '@/db/mediaSourceDB.ts';
import { ProgramDB } from '@/db/ProgramDB.ts';
import { ProgramType } from '@/db/schema/Program.ts';
import { MediaSourceApiFactory } from '@/external/MediaSourceApiFactory.ts';
import { PlexMediaCanonicalizer } from '@/services/PlexMediaCanonicalizers.ts';
import { MediaSourceScanner } from '@/services/scanner/MediaSourceScanner.ts';

export class PlexMediaSourceScanner extends MediaSourceScanner {
  private canonicalizer = new PlexMediaCanonicalizer();

  constructor(
    private mediaSourceDB: MediaSourceDB,
    private programDB: ProgramDB,
  ) {
    super();
  }

  async scan(mediaSourceId: string, libraryId: string): Promise<void> {
    const mediaSource = await this.mediaSourceDB.getById(mediaSourceId);
    if (!mediaSource) {
      throw new Error(`Media source ${mediaSourceId} not found.`);
    }

    const apiClient = MediaSourceApiFactory().get(mediaSource);

    const existingMovies = await this.programDB.getProgramsForMediaSource(
      mediaSourceId,
      ProgramType.Movie,
    );
    console.log(existingMovies.length);
    const movieIterator = apiClient.getMovieLibraryContents(libraryId);
    let i = 0;
    while (i < 5) {
      const { value, done } = await movieIterator.next();
      if (done) {
        break;
      }
      console.log(this.canonicalizer.getCanonicalId(value));
      i++;
    }
  }

  
}
