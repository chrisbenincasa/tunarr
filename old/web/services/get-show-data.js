//This is an exact copy of the file with the same now in the nodejs
//one of these days, we'll figure out how to share the code.
module.exports = function () {

    let movieTitleOrder = {};
    let movieTitleOrderNumber = 0;

    return (program) => {
        if ( typeof(program.customShowId) !== 'undefined' ) {
            return {
                hasShow : true,
                showId : "custom." + program.customShowId,
                showDisplayName : program.customShowName,
                order : program.customOrder,
            }
        } else if (program.isOffline && program.type === 'redirect') {
            return {
                hasShow : true,
                showId : "redirect." + program.channel,
                order : program.duration,
                showDisplayName : `Redirect to channel ${program.channel}`,
                channel: program.channel,
            }
        } else if (program.isOffline) {
            return {
                hasShow : false
            }
        } else if (program.type === 'movie') {
            let key = program.serverKey + "|" + program.key;
            if (typeof(movieTitleOrder[key]) === 'undefined') {
                movieTitleOrder[key] = movieTitleOrderNumber++;
            }
            return {
                hasShow : true,
                showId : "movie.",
                showDisplayName : "Movies",
                order : movieTitleOrder[key],
            }
        } else if ( (program.type === 'episode') || (program.type === 'track') ) {
            let s = 0;
            let e = 0;
            if ( typeof(program.season) !== 'undefined') {
                s = program.season;
            }
            if ( typeof(program.episode) !== 'undefined') {
                e = program.episode;
            }
            let prefix = "tv.";
            if (program.type === 'track') {
                prefix = "audio.";
            }
            return {
                hasShow: true,
                showId : prefix + program.showTitle,
                showDisplayName : program.showTitle,
                order : s * 1000000 + e,
            }
        } else {
            return {
                hasShow : false,
            }
        }
    }

}