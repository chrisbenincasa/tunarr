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
