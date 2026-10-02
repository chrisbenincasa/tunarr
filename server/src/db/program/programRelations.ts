/**
 * The relations a program row needs loaded before
 * {@link ApiProgramConverters.convertProgram} can materialize it into an API
 * program.
 *
 * Every query that feeds the converter loads this, and nothing hand-rolls its
 * own subset. Subsets are how the same program ends up with genres on one
 * endpoint and without them on another: a relation added for one caller (the
 * XMLTV writer wanting genres and credits, say) silently changes every response
 * built from that query, while responses built from a different query keep the
 * old shape. The save-a-lineup response and a reload of the same lineup drifted
 * exactly that way.
 *
 * `versions` and `subtitles` are deliberately absent. The converter never reads
 * them, and they carry the media stream, file and chapter rows — by far the
 * heaviest thing hanging off a program. Endpoints that do need them (stream
 * details, the program detail page) spread this object and add them.
 */
export const MaterializedProgramRelations = {
  externalIds: true,
  artwork: true,
  credits: {
    with: {
      artwork: true,
    },
  },
  genres: {
    with: {
      genre: true,
    },
  },
  studios: {
    with: {
      studio: true,
    },
  },
  tags: {
    with: {
      tag: true,
    },
  },
  // The parent groupings are converted by convertProgramGrouping, which reads
  // the same metadata off them that convertProgram reads off the program.
  show: {
    with: {
      externalIds: true,
      artwork: true,
      credits: {
        with: {
          artwork: true,
        },
      },
      genres: {
        with: {
          genre: true,
        },
      },
      tags: {
        with: {
          tag: true,
        },
      },
    },
  },
  season: {
    with: {
      externalIds: true,
      artwork: true,
      credits: {
        with: {
          artwork: true,
        },
      },
      genres: {
        with: {
          genre: true,
        },
      },
      tags: {
        with: {
          tag: true,
        },
      },
    },
  },
  album: {
    with: {
      externalIds: true,
      artwork: true,
      credits: {
        with: {
          artwork: true,
        },
      },
      genres: {
        with: {
          genre: true,
        },
      },
      tags: {
        with: {
          tag: true,
        },
      },
    },
  },
  artist: {
    with: {
      externalIds: true,
      artwork: true,
      credits: {
        with: {
          artwork: true,
        },
      },
      genres: {
        with: {
          genre: true,
        },
      },
      tags: {
        with: {
          tag: true,
        },
      },
    },
  },
} as const;

/**
 * The stream-level relations. Only endpoints that report on a program's files
 * or streams need these; they are separated so that lineup and guide queries,
 * which materialize thousands of programs at once, do not pay for them.
 */
export const ProgramStreamRelations = {
  subtitles: true,
  versions: {
    with: {
      mediaStreams: true,
      mediaFiles: true,
      chapters: true,
    },
  },
} as const;

type GuideCredits = true | { with: { artwork: true } };

const guideProgramRelations = <CreditsT extends GuideCredits>(
  credits: CreditsT,
) =>
  ({
    artwork: true,
    credits,
    genres: { with: { genre: true } },
    tags: { with: { tag: true } },
    season: { with: { externalIds: true } },
    album: { with: { externalIds: true, artwork: true } },
  }) as const;

const guideShowRelations = <CreditsT extends GuideCredits>(credits: CreditsT) =>
  ({
    externalIds: true,
    artwork: true,
    credits,
    genres: { with: { genre: true } },
    tags: { with: { tag: true } },
  }) as const;

/**
 * The relations the XMLTV writer reads off a program. The hourly guide rebuild
 * loads every program in the EPG window at once, so this leaves out what the
 * writer never touches: studios, versions, subtitles and the artist. The
 * writer never reads grouping external ids either, but
 * `ProgramGroupingOrmWithRelations` requires them.
 *
 * The show is absent on purpose. Loading it here would copy the show's cast
 * into every episode row, so it loads once per show with
 * {@link GuideShowRelations} instead.
 */
export const GuideProgramRelations = guideProgramRelations(true);

/** {@link GuideProgramRelations} plus credit headshots, for XMLTV credit images. */
export const GuideProgramRelationsWithCreditArtwork = guideProgramRelations({
  with: { artwork: true },
});

/**
 * The relations the XMLTV writer reads off an episode's show. Show credits
 * stay because the writer falls back to them when an episode has none.
 */
export const GuideShowRelations = guideShowRelations(true);

/** {@link GuideShowRelations} plus credit headshots, for XMLTV credit images. */
export const GuideShowRelationsWithCreditArtwork = guideShowRelations({
  with: { artwork: true },
});

/**
 * The relations a program needs to start streaming. Stream code reads media
 * versions, subtitles and external ids, and nothing else. Every stream start
 * and program transition loads this, so parent groupings and their cast stay
 * out.
 */
export const StreamProgramRelations = {
  externalIds: true,
  ...ProgramStreamRelations,
} as const;

/**
 * The relations a program needs when it is added to or listed in a lineup.
 *
 * Deliberately narrower than {@link MaterializedProgramRelations}. Lineup
 * paths load thousands of programs at once, and the full set copies every
 * parent's cast, genres and artwork into each episode. A 6k-episode add from
 * the program picker grew to hundreds of megabytes in the browser with it.
 */
export const LineupProgramRelations = {
  externalIds: true,
  show: { with: { externalIds: true } },
  season: { with: { externalIds: true } },
  album: { with: { externalIds: true } },
  artist: { with: { externalIds: true } },
} as const;
