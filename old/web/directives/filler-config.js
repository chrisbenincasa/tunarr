module.exports = function ($timeout) {
    return {
        restrict: 'E',
        templateUrl: 'templates/filler-config.html',
        replace: true,
        scope: {
            linker: "=linker",
            onDone: "=onDone"
        },
        link: function (scope, element, attrs) {
            scope.showTools = false;
            scope.showPlexLibrary = false;
            scope.content = [];
            scope.visible = false;
            scope.error = undefined;

            function refreshContentIndexes() {
                for (let i = 0; i < scope.content.length; i++) {
                    scope.content[i].$index = i;
                }
            }

            scope.contentSplice = (a,b) => {
                scope.content.splice(a,b)
                refreshContentIndexes();
            }

            scope.dropFunction = (dropIndex, program) => {
                let y = program.$index;
                let z = dropIndex + scope.currentStartIndex - 1;
                scope.content.splice(y, 1);
                if (z >= y) {
                    z--;
                }
                scope.content.splice(z, 0, program );
                refreshContentIndexes();
                $timeout();
                return false;
            }
            scope.setUpWatcher = function setupWatchers() {
                this.$watch('vsRepeat.startIndex', function(val) {
                    scope.currentStartIndex = val;
                });
            };

            scope.movedFunction = (index) => {
                console.log("movedFunction(" + index + ")");
            }



            scope.linker( (filler) => {
                if ( typeof(filler) === 'undefined') {
                    scope.name = "";
                    scope.content = [];
                    scope.id = undefined;
                    scope.title = "Create Filler List";
                } else {
                    scope.name = filler.name;
                    scope.content = filler.content;
                    scope.id = filler.id;
                    scope.title = "Edit Filler List";
                }
                refreshContentIndexes();
                scope.visible = true;
            } );

            scope.finished = (cancelled) => {
                if (cancelled) {
                    scope.visible = false;
                    return scope.onDone();
                }
                if ( (typeof(scope.name) === 'undefined') || (scope.name.length == 0) ) {
                    scope.error = "Please enter a name";
                }
                if ( scope.content.length == 0) {
                    scope.error = "Please add at least one clip.";
                }
                if (typeof(scope.error) !== 'undefined') {
                    $timeout( () => {
                        scope.error = undefined;
                    }, 30000);
                    return;
                }
                scope.visible = false;
                scope.onDone( {
                    name: scope.name,
                    content: scope.content.map( (c) => {
                        delete c.$index
                        return c;
                    } ),
                    id: scope.id,
                } );
            }
            scope.showList = () => {
                return ! scope.showPlexLibrary;
            }
            scope.sortFillers = () => {
                scope.content.sort( (a,b) => { return a.duration - b.duration } );
                refreshContentIndexes();
            }
            scope.fillerRemoveAllFiller = () => {
                scope.content = [];
                refreshContentIndexes();
            }
            scope.fillerRemoveDuplicates = () => {
                function getKey(p) {
                    return p.serverKey + "|" + p.plexFile;
                }
                let seen = {};
                let newFiller = [];
                for (let i = 0; i < scope.content.length; i++) {
                    let p = scope.content[i];
                    let k = getKey(p);
                    if ( typeof(seen[k]) === 'undefined') {
                        seen[k] = true;
                        newFiller.push(p);
                    }
                }
                scope.content = newFiller;
                refreshContentIndexes();
            }
            scope.importPrograms = (selectedPrograms) => {
                for (let i = 0, l = selectedPrograms.length; i < l; i++) {
                    selectedPrograms[i].commercials = []
                }
                scope.content = scope.content.concat(selectedPrograms);
                refreshContentIndexes();
                scope.showPlexLibrary = false;
            }


            scope.durationString = (duration) => {
                var date = new Date(0);
                date.setSeconds( Math.floor(duration / 1000) ); // specify value for SECONDS here
                return date.toISOString().substr(11, 8);
            }

            let interpolate = ( () => {
                let h = 60*60*1000 / 6;
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

            scope.programSquareStyle = (program, dash) => {
                let background = "rgb(255, 255, 255)";
                let ems = Math.pow( Math.min(60*60*1000, program.duration), 0.7 );
                ems = ems / Math.pow(1*60*1000., 0.7);
                ems = Math.max( 0.25 , ems);
                let top = Math.max(0.0, (1.75 - ems) / 2.0) ;
                if (top == 0.0) {
                    top = "1px";
                }
                let solidOrDash = (dash? 'dashed' : 'solid');
                let f = interpolate;
                let w = 5.0;
                let t = 4*60*60*1000;
                let a = ( f(program.duration) *w) / f(t);
                a = Math.min( w, Math.max(0.3, a) );
                b = w - a + 0.01;

                return {
                    'width': `${a}%`,
                    'height': '1.3em',
                    'margin-right': `${b}%`,
                    'background': background,
                    'border': `1px ${solidOrDash} black`,
                    'margin-top': top,
                    'margin-bottom': '1px',
                };
            }

        }
    };
}
