module.exports = function (plex, dizquetv, $timeout, commonProgramTools) {
    return {
        restrict: 'E',
        templateUrl: 'templates/plex-library.html',
        replace: true,
        scope: {
            onFinish: "=onFinish",
            height: "=height",
            visible: "=visible",
            limit: "=limit",
        },
        link: function (scope, element, attrs) {
            scope.errors=[];
            if ( typeof(scope.limit) == 'undefined') {
                scope.limit = 1000000000;
            }
            scope.customShows = [];
            scope.origins = [];
            scope.currentOrigin = undefined;
            scope.pending = 0;
            scope.allowedIndexes = [];
            for (let i = -10; i <= -1; i++) {
                scope.allowedIndexes.push(i);
            }
            scope.selection = []
            scope.wait = (t) => {
                return new Promise((resolve, reject) => {
                    $timeout(resolve,t);
                });
            }
            scope.selectOrigin = function (origin) {
                if ( origin.type === 'plex' ) {
                    scope.plexServer = origin.server;
                    updateLibrary(scope.plexServer);
                } else {
                    scope.plexServer = undefined;
                    updateCustomShows();
                }
            }
            scope._onFinish = (s) => {
                if (s.length > scope.limit) {
                    if (scope.limit == 1) {
                        scope.error = "Please select only one clip.";
                    } else {
                        scope.error = `Please select at most ${scope.limit} clips.`;
                    }
                } else {
                    scope.onFinish(s)
                    scope.selection = []
                    scope.visible = false
                }
            }
            scope.selectItem = async (item, single) => {
                        await scope.wait(0);
                        scope.pending += 1;
                        try {
                            delete item.server;
                            item.serverKey = scope.plexServer.name;
                            scope.selection.push(JSON.parse(angular.toJson(item)))
                        } catch (err) {
                            let msg = "Unable to add item: " + item.key + " " + item.title;
                            scope.errors.push(msg);
                            console.error(msg, err);
                        } finally {
                            scope.pending -= 1;
                        }
                        if (single) {
                            scope.$apply()
                        }
            }
            scope.selectLibrary = async (library) => {
              await scope.fillNestedIfNecessary(library);
              let p = library.nested.length;
              scope.pending += library.nested.length;
              try {
                for (let i = 0; i < library.nested.length; i++) {
                    //await scope.selectItem( library.nested[i] );
                    if (library.nested[i].type !== 'collection' && library.nested[i].type !== 'genre') {
                        await scope.selectShow( library.nested[i] );
                    }
                    scope.pending -= 1;
                    p -= 1;
                }
              } finally {
                scope.pending -= p;
                scope.$apply()
              }
            }

            dizquetv.getPlexServers().then((servers) => {
                if (servers.length === 0) {
                    scope.noServers = true
                    return
                }
                scope.origins = servers.map( (s) => {
                    return {
                        "type" : "plex",
                        "name" : `Plex - ${s.name}`,
                        "server": s,
                    }
                } );
                scope.currentOrigin = scope.origins[0];
                scope.plexServer = scope.currentOrigin.server;
                scope.origins.push( {
                    "type": "dizquetv",
                    "name" : "dizqueTV - Custom Shows",
                } );
                updateLibrary(scope.plexServer)
            })

            let updateLibrary = async(server) => {
                let lib = await plex.getLibrary(server);
                let play = await plex.getPlaylists(server);

                play.forEach( p => {
                    p.type = "playlist";
                } );
                        scope.$apply(() => {
                            scope.libraries = lib
                            if (play.length > 0)
                                scope.libraries.push({ title: "Playlists", key: "", icon: "", nested: play })
                        })

            }
            scope.fillNestedIfNecessary = async (x, isLibrary) => {
                if (typeof(x.nested) === 'undefined') {
                    x.nested = await plex.getNested(scope.plexServer, x, isLibrary, scope.errors);
                    if (x.type === "collection" && x.collectionType === "show") {
                        let nested = x.nested;
                        x.nested = [];
                        for (let i = 0; i < nested.length; i++) {
                            let subNested = await plex.getNested(scope.plexServer, nested[i], false, scope.errors);
                            for (let j = 0; j < subNested.length; j++) {
                                subNested[j].title = nested[i].title + " - " + subNested[j].title;
                                x.nested.push( subNested[j] );
                            }
                        }
                    }
                }
            }
            scope.getNested = (list, isLibrary) => {
                $timeout(async () => {
                    await scope.fillNestedIfNecessary(list, isLibrary);
                    list.collapse = !list.collapse
                    scope.$apply()
                }, 0)
            }
            
            scope.selectSeason = (season) => {
                return new Promise((resolve, reject) => {
                    $timeout(async () => {
                        await scope.fillNestedIfNecessary(season);
                        let p = season.nested.length;
                        scope.pending += p;
                        try {
                            for (let i = 0, l = season.nested.length; i < l; i++) {
                                await scope.selectItem(season.nested[i], false)
                                scope.pending -= 1;
                                p -= 1;
                            }
                            resolve();
                        } catch (e) {
                            reject(e);
                        } finally {
                            scope.pending -= p;
                            scope.$apply()
                        }
                    }, 0)
                })
            }
            scope.selectShow = (show) => {
                return new Promise((resolve, reject) => {
                    $timeout(async () => {
                        await scope.fillNestedIfNecessary(show);
                        let p = show.nested.length;
                        scope.pending += p;
                        try {
                            for (let i = 0, l = show.nested.length; i < l; i++) {
                                await scope.selectSeason(show.nested[i])
                                scope.pending -= 1;
                                p -= 1;
                            }
                            resolve();
                        } catch (e) {
                            reject(e);
                        } finally {
                            scope.pending -= p;
                            scope.$apply()
                        }
                    }, 0)
                })
            }
            scope.selectPlaylist = async (playlist) => {
                return new Promise((resolve, reject) => {
                    $timeout(async () => {
                        await scope.fillNestedIfNecessary(playlist);
                        for (let i = 0, l = playlist.nested.length; i < l; i++)
                            await scope.selectItem(playlist.nested[i], false)
                        scope.$apply()
                        resolve()
                    }, 0)
                })
            }
            scope.createShowIdentifier = (season, ep) => {
                return 'S' + (season.toString().padStart(2, '0')) + 'E' + (ep.toString().padStart(2, '0'))
            }
            scope.addCustomShow = async(show) => {
                scope.pending++;
                try {
                    show = await dizquetv.getShow(show.id);
                    for (let i = 0; i < show.content.length; i++) {
                        let item = JSON.parse(angular.toJson( show.content[i] ));
                        item.customShowId = show.id;
                        item.customShowName = show.name;
                        item.customOrder = i;
                        scope.selection.push(item);
                    }
                    scope.$apply();
                } finally {
                    scope.pending--;
                }

            }

            scope.getProgramDisplayTitle = (x) => {
                return commonProgramTools.getProgramDisplayTitle(x);
            }

            let updateCustomShows = async() => {
                scope.customShows = await dizquetv.getAllShowsInfo();
                scope.$apply();
            }

            scope.displayTitle = (show) => {
                let r = "";
                if (show.type === 'episode') {
                    r += show.showTitle + " - ";
                    if ( typeof(show.season) !== 'undefined' ) {
                        r += "S" + show.season.toString().padStart(2,'0');
                    }
                    if ( typeof(show.episode) !== 'undefined' ) {
                        r += "E" + show.episode.toString().padStart(2,'0');
                    }
                }
                if (r != "") {
                    r = r + " - ";
                }
                r += show.title;
                if (
                    (show.type !== 'episode')
                    &&
                    (typeof(show.year) !== 'undefined')
                ) {
                    r += " (" + JSON.stringify(show.year) + ")";
                }
                return r;
            }
        }
    };
}