module.exports = function (plex, dizquetv, $timeout) {
  return {
    restrict: 'E',
    templateUrl: 'templates/plex-settings.html',
    replace: true,
    scope: {},
    link: function (scope, element, attrs) {
      scope.requestId = 0;
      scope._serverToEdit = null;
      scope._serverEditorState = {
        visible: false,
      };
      scope.serversPending = true;
      scope.channelReport = null;
      scope.serverError = '';
      scope.refreshServerList = async () => {
        scope.serversPending = true;
        let servers = await dizquetv.getPlexServers();
        scope.serversPending = false;
        scope.servers = servers;
        if (servers) {
          for (let i = 0; i < scope.servers.length; i++) {
            scope.servers[i].uiStatus = 0;
            scope.servers[i].backendStatus = 0;
            let t = new Date().getTime();
            scope.servers[i].uiPending = t;
            scope.servers[i].backendPending = t;
            scope.refreshUIStatus(t, i);
            scope.refreshBackendStatus(t, i);
          }
        }
        setTimeout(() => {
          scope.$apply();
        }, 31000);
        scope.$apply();
      };
      scope.refreshServerList();

      scope.editPlexServer = (server) => {
        scope._serverEditorState = {
          visible: true,
          server: {
            name: server.name,
            uri: server.uri,
            arGuide: server.arGuide,
            arChannels: server.arChannels,
            accessToken: server.accessToken,
          },
        };
      };

      scope.serverEditFinished = () => {
        scope.refreshServerList();
      };

      scope.isAnyUIBad = () => {
        let t = new Date().getTime();
        if (scope.servers) {
          for (let i = 0; i < scope.servers.length; i++) {
            let s = scope.servers[i];
            if (
              s.uiStatus == -1 ||
              (s.uiStatus == 0 && s.uiPending + 30000 < t)
            ) {
              return true;
            }
          }
        }
        return false;
      };

      scope.isAnyBackendBad = () => {
        let t = new Date().getTime();
        if (scope.servers) {
          for (let i = 0; i < scope.servers.length; i++) {
            let s = scope.servers[i];
            if (
              s.backendStatus == -1 ||
              (s.backendStatus == 0 && s.backendPending + 30000 < t)
            ) {
              return true;
            }
          }
        }
        return false;
      };

      scope.refreshUIStatus = async (t, i) => {
        let s = await plex.check(scope.servers[i]);
        if (scope.servers[i].uiPending == t) {
          // avoid updating for a previous instance of the row
          scope.servers[i].uiStatus = s;
        }
        scope.$apply();
      };

      scope.refreshBackendStatus = async (t, i) => {
        let s = await dizquetv.checkExistingPlexServer(scope.servers[i].name);
        if (scope.servers[i].backendPending == t) {
          // avoid updating for a previous instance of the row
          scope.servers[i].backendStatus = s.status;
        }
        scope.$apply();
      };

      scope.findGoodConnection = async (server, connections) => {
        return await Promise.any(
          connections.map(async (connection) => {
            let hypothethical = {
              name: server.name,
              accessToken: server.accessToken,
              uri: connection.uri,
            };

            let q = await Promise.race([
              new Promise((resolve, reject) =>
                $timeout(() => {
                  resolve(-1);
                }, 60000),
              ),
              (async () => {
                let s1 = await plex.check(hypothethical);
                let s2 = (await dizquetv.checkNewPlexServer(hypothethical))
                  .status;
                if (s1 == 1 && s2 == 1) {
                  return 1;
                } else {
                  return -1;
                }
              })(),
            ]);
            if (q === 1) {
              return hypothethical;
            } else {
              throw Error('Not proper status');
            }
          }),
        );
      };

      scope.getLocalConnections = (connections) => {
        let r = [];
        for (let i = 0; i < connections.length; i++) {
          if (connections[i].local === true) {
            r.push(connections[i]);
          }
        }
        return r;
      };

      scope.getRemoteConnections = (connections) => {
        let r = [];
        for (let i = 0; i < connections.length; i++) {
          if (connections[i].local !== true) {
            r.push(connections[i]);
          }
        }
        return r;
      };

      scope.shouldDisableSubtitles = () => {
        return (
          scope.settings &&
          (scope.settings.forceDirectPlay ||
            scope.settings.streamPath === 'direct')
        );
      };

      scope.addPlexServer = async () => {
        scope.isProcessing = true;
        scope.serversPending = true;
        scope.serverError = '';
        let result = await plex.login();
        scope.addingServer =
          'Looking for servers in the Plex account, please wait...';
        await Promise.all(
          result.servers.map(async (server) => {
            try {
              let connections = scope.getLocalConnections(server.connections);
              let connection = null;
              try {
                connection = await scope.findGoodConnection(
                  server,
                  connections,
                );
              } catch (err) {
                connection = null;
              }
              if (connection == null) {
                connections = scope.getRemoteConnections(server.connections);
                try {
                  connection = await scope.findGoodConnection(
                    server,
                    connections,
                  );
                } catch (err) {
                  connection = null;
                }
              }
              if (connection == null) {
                //pick a random one, really.
                connections = scope.getLocalConnections(server.connections);
                if (connections.length > 0) {
                  connection = connections[0];
                } else {
                  connection = server.connections[0];
                }
                connection = {
                  name: server.name,
                  uri: connection.uri,
                  accessToken: server.accessToken,
                };
              }
              connection.arGuide = false;
              connection.arChannels = false; // should not be enabled unless dizqueTV tuner already added to plex
              await dizquetv.addPlexServer(connection);
            } catch (err) {
              scope.serverError =
                'Could not add Plex server: There was an error.';
              console.error('error adding server', err);
            }
          }),
        );
        scope.addingServer = '';
        scope.isProcessing = false;
        scope.refreshServerList();
      };
      scope.$watch('settings', (value) => {
        if (!value) return;
        scope.maxPlayableResString = `${scope.settings.maxPlayableResolution.widthPx}x${scope.settings.maxPlayableResolution.heightPx}`;
        scope.maxTranscodeResString = `${scope.settings.maxTranscodeResolution.widthPx}x${scope.settings.maxTranscodeResolution.heightPx}`;
      });
      scope.$watch('maxPlayableResString', (value) => {
        if (!value) return;
        if (!scope.settings) return;
        const [w, h] = value.split('x', 2);
        scope.settings.maxPlayableResolution = {
          widthPx: w,
          heightPx: h,
        };
      });
      scope.$watch('maxTranscodeResString', (value) => {
        if (!value) return;
        if (!scope.settings) return;
        const [w, h] = value.split('x', 2);
        scope.settings.maxTranscodeResolution = {
          widthPx: w,
          heightPx: h,
        };
      });
      dizquetv.getPlexSettings().then((settings) => {
        scope.settings = settings;
      });
      scope.updateSettings = (settings) => {
        dizquetv.updatePlexSettings(settings).then((_settings) => {
          scope.settings = _settings;
        });
      };
      scope.resetSettings = (settings) => {
        dizquetv.resetPlexSettings(settings).then((_settings) => {
          scope.settings = _settings;
        });
      };
      scope.pathOptions = [
        { id: 'plex', description: 'Plex' },
        { id: 'direct', description: 'Direct' },
      ];
      scope.hideIfNotPlexPath = () => {
        return scope.settings && scope.settings.streamPath != 'plex';
      };
      scope.hideIfNotDirectPath = () => {
        return scope.settings && scope.settings.streamPath != 'direct';
      };
      scope.maxAudioChannelsOptions = [
        { id: 1, description: '1.0' },
        { id: 2, description: '2.0' },
        { id: 3, description: '2.1' },
        { id: 4, description: '4.0' },
        { id: 5, description: '5.0' },
        { id: 6, description: '5.1' },
        { id: 7, description: '6.1' },
        { id: 8, description: '7.1' },
      ];
      scope.resolutionOptions = [
        { id: '420x420', description: '420x420' },
        { id: '576x320', description: '576x320' },
        { id: '720x480', description: '720x480' },
        { id: '1024x768', description: '1024x768' },
        { id: '1280x720', description: '1280x720' },
        { id: '1920x1080', description: '1920x1080' },
        { id: '3840x2160', description: '3840x2160' },
      ];
      scope.streamProtocols = [
        { id: 'http', description: 'HTTP' },
        { id: 'hls', description: 'HLS' },
      ];
      scope.audioBoostOptions = [
        { id: 100, description: 'None' },
        { id: 120, description: 'Small' },
        { id: 140, description: 'Medium' },
        { id: 160, description: 'Large' },
        { id: 180, description: 'Huge' },
      ];
    },
  };
};
