//This is an exact copy of the file with the same now in the nodejs
//one of these days, we'll figure out how to share the code.
module.exports = function (getShowData) {


    /*** Input: list of programs
     * output: sorted list of programs */
    function sortShows(programs) {
        let shows = {}
        let movies = [] //not exactly accurate name
        let newProgs = []
        let progs = programs
        for (let i = 0, l = progs.length; i < l; i++) {
            let showData = getShowData( progs[i] );
            if ( showData.showId === 'movie.' || ! showData.hasShow ) {
                movies.push(progs[i]);
            } else {
                if (typeof shows[showData.showId] === 'undefined') {
                    shows[showData.showId] = [];
                }
                shows[showData.showId].push(progs[i]);
            }
        }
        let keys = Object.keys(shows)
        for (let i = 0, l = keys.length; i < l; i++) {
            shows[keys[i]].sort((a, b) => {
                let aData = getShowData(a);
                let bData = getShowData(b);
                return aData.order - bData.order;
            })
            newProgs = newProgs.concat(shows[keys[i]])
        }
        return newProgs.concat(movies);
    }

    function shuffle(array, lo, hi ) {
        if (typeof(lo) === 'undefined') {
            lo = 0;
            hi = array.length;
        }
        let currentIndex = hi, temporaryValue, randomIndex
        while (lo !== currentIndex) {
            randomIndex = lo + Math.floor(Math.random() * (currentIndex -lo) );
            currentIndex -= 1
            temporaryValue = array[currentIndex]
            array[currentIndex] = array[randomIndex]
            array[randomIndex] = temporaryValue
        }
        return array
    }


    let removeDuplicates = (progs) => {
        let tmpProgs = {}
        for (let i = 0, l = progs.length; i < l; i++) {
            if ( progs[i].type ==='redirect' ) {
                tmpProgs['_redirect ' + progs[i].channel + ' _ '+ progs[i].duration ] = progs[i];
            } else {
                let data = getShowData(progs[i]);
                if (data.hasShow) {
                    let key = data.showId + "|" + data.order;
                    tmpProgs[key] = progs[i];
                }
            }
        }
        let newProgs = [];
        let keys = Object.keys(tmpProgs);
        for (let i = 0, l = keys.length; i < l; i++) {
            newProgs.push(tmpProgs[keys[i]])
        }
        return newProgs;
    }

    let removeSpecials = (progs) => {
        let tmpProgs = []
        for (let i = 0, l = progs.length; i < l; i++) {
            if (
                (typeof(progs[i].customShowId) !== 'undefined')
                ||
                (progs[i].season !== 0)
            ) {
                tmpProgs.push(progs[i]);
            }
        }
        return tmpProgs;
    }

    let getProgramDisplayTitle = (x) => {
        let s = x.type === 'episode' ? x.showTitle + ' - S' + x.season.toString().padStart(2, '0') + 'E' + x.episode.toString().padStart(2, '0') : x.title
        if (typeof(x.customShowId) !== 'undefined') {
            s = x.customShowName + " X" + (x.customOrder+1).toString().padStart(2,'0') + " (" + s + ")";
        }
        return s;
    }

    let sortByDate = (programs) => {
        programs.sort( (a,b) => {
            let aHas = ( typeof(a.date) !== 'undefined' );
            let bHas = ( typeof(b.date) !== 'undefined' );
            if (!aHas && !bHas) {
                return 0;
            } else if (! aHas) {
                return 1;
            } else if (! bHas) {
                return -1;
            }
            if (a.date < b.date ) {
                return -1;
            } else if (a.date > b.date) {
                return 1;
            } else {
                let aHasSeason = ( typeof(a.season) !== 'undefined' );
                let bHasSeason = ( typeof(b.season) !== 'undefined' );
                if (! aHasSeason && ! bHasSeason) {
                    return 0;
                } else if (! aHasSeason) {
                    return 1;
                } else if (! bHasSeason) {
                    return -1;
                }
                if (a.season < b.season) {
                    return -1;
                } else if (a.season > b.season) {
                    return 1;
                } else if (a.episode < b.episode) {
                    return -1;
                } else if (a.episode > b.episode) {
                    return 1;
                } else {
                    return 0;
                }
            }
        });
        return programs;
    }

    let programSquareStyle = (program) => {
        let background ="";
        if  ( (program.isOffline) && (program.type !== 'redirect') ) {
            background = "rgb(255, 255, 255)";
        } else {
            let r = 0, g = 0, b = 0, r2=0, g2=0,b2=0;
            let angle = 45;
            let w = 3;
            if (program.type === 'redirect') {
                angle = 0;
                w = 4 + (program.channel % 10);
                let c = (program.channel * 100019);
                //r = 255, g = 0, b = 0;
                //r2 = 0, g2 = 0, b2 = 255;

                r = ( (c & 3) * 77 );
                g = ( ( (c >> 1) & 3) * 77 );
                b = ( ( (c >> 2) & 3) * 77 );
                r2 = ( ( (c >> 5) & 3) * 37 );
                g2 = ( ( (c >> 3) & 3) * 37 );
                b2 = ( ( (c >> 4) & 3) * 37 );
            } else if ( typeof(program.customShowId) !== 'undefined') {
                let h = Math.abs( getHashCode(program.customShowId, false));
                let h2 = Math.abs( getHashCode(program.customShowId, true));
                r = h % 256;
                g = (h / 256) % 256;
                b = (h / (256*256) ) % 256;
                r2 = (h2 / (256*256) ) % 256;
                g2 = (h2 / (256*256) ) % 256;
                b2 = (h2 / (256*256) ) % 256;
                angle = (360 - 90 + h % 180) % 360;
                if ( angle >= 350 || angle < 10 ) {
                    angle += 53;
                }
               
            } else if (program.type === 'episode') {
                let h = Math.abs( getHashCode(program.showTitle, false));
                let h2 = Math.abs( getHashCode(program.showTitle, true));
                r = h % 256;
                g = (h / 256) % 256;
                b = (h / (256*256) ) % 256;
                r2 = (h2 / (256*256) ) % 256;
                g2 = (h2 / (256*256) ) % 256;
                b2 = (h2 / (256*256) ) % 256;
                angle = (360 - 90 + h % 180) % 360;
                if ( angle >= 350 || angle < 10 ) {
                    angle += 53;
                }
            } else if (program.type === 'track') {
                r = 10, g = 10, b = 10;
                r2 = 245, g2 = 245, b2 = 245;
                angle = 315;
                w = 2;
            } else {
                r = 10, g = 10, b = 10;
                r2 = 245, g2 = 245, b2 = 245;
                angle = 45;
                w = 6;
            }
            let rgb1 = "rgb("+ r + "," + g + "," + b +")";
            let rgb2 = "rgb("+ r2 + "," + g2 + "," + b2 +")"
            angle += 90;
            background = "repeating-linear-gradient( " + angle + "deg, " + rgb1 + ", " + rgb1 + " " + w + "px, " + rgb2 + " " + w + "px, " + rgb2 + " " + (w*2) + "px)";

        }
        let f = interpolate;
        let w = 15.0;
        let t = 4*60*60*1000;
        //let d = Math.log( Math.min(t, program.duration) ) / Math.log(2);
        //let a = (d * Math.log(2) ) / Math.log(t);
        let a = ( f(program.duration) *w) / f(t);
        a = Math.min( w, Math.max(0.3, a) );
        b = w - a + 0.01;

        return {
            'width': `${a}%`,
            'height': '1.3em',
            'margin-right': `${b}%`,
            'background': background,
            'border': '1px solid black',
            'margin-top': "0.01em",
            'margin-bottom': '1px',
        };
    }
    let getHashCode = (s, rev) => {
        var hash = 0;
        if (s.length == 0) return hash;
        let inc = 1, st = 0, e = s.length;
        if (rev) {
            inc = -1, st = e - 1, e = -1;
        }
        for (var i = st; i != e; i+= inc) {
            hash = s.charCodeAt(i) + ((hash << 5) - hash);
            hash = hash & hash; // Convert to 32bit integer
        }
        return hash;
    }

    let interpolate = ( () => {
        let h = 60*60*1000;
        let ix = [0, 1*h, 2*h, 4*h, 8*h, 24*h];
        let iy = [0, 1.0, 1.25, 1.5, 1.75, 2.0];
        let n = ix.length;

        return (x) => {
            for (let i = 0; i < n-1; i++) {
                if( (ix[i] <= x) && ( (x < ix[i+1]) || i==n-2 ) ) {
                    return iy[i] + (iy[i+1] - iy[i]) * ( (x - ix[i]) / (ix[i+1] - ix[i]) );
                }
            }
        }

    } )();


    return {
        sortShows: sortShows,
        shuffle: shuffle,
        removeDuplicates: removeDuplicates,
        removeSpecials: removeSpecials,
        sortByDate: sortByDate,
        getProgramDisplayTitle: getProgramDisplayTitle,
        programSquareStyle: programSquareStyle,
    }

}