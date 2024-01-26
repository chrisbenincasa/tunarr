module.exports = function (dizquetv, $timeout) {
    return {
        restrict: 'E',
        templateUrl: 'templates/plex-server-edit.html',
        replace: true,
        scope: {
            state: "=state",
            _onFinish: "=onFinish",
        },
        link: function (scope, element, attrs) {
            scope.state.modified = false;
            scope.loading = { show: false };
            scope.setModified = () => {
                scope.state.modified = true;
            }
            scope.onSave = async () => {
                try {
                    scope.loading = { show: true };
                    await dizquetv.updatePlexServer(scope.state.server);
                    scope.state.modified = false;
                    scope.state.success = "The server was updated.";
                    scope.state.changesSaved = true;
                    scope.state.error = "";
                } catch (err) {
                    scope.state.error = "There was an error updating the server";
                    scope.state.success = "";
                    console.error(scope.state.error, err);
                } finally {
                    scope.loading = { show: false };
                }
                $timeout( () => { scope.$apply() } , 0 );
            }

            scope.onDelete = async () => {
                try {
                    let channelReport = await dizquetv.removePlexServer(scope.state.server.name);
                    scope.state.channelReport = channelReport;
                    channelReport.sort( (a,b) => {
                        if (a.destroyedPrograms != b.destroyedPrograms) {
                            return (b.destroyedPrograms - a.destroyedPrograms);
                        } else {
                            return (a.channelNumber - b.channelNumber);
                        }
                    });
                    scope.state.success = "The server was deleted.";
                    scope.state.error = "";
                    scope.state.modified = false;
                    scope.state.changesSaved = true;
                } catch (err) {
                    scope.state.error = "There was an error deleting the server.";
                    scope.state.success = "";
                }
                $timeout( () => { scope.$apply() } , 0 );
            }

            scope.onShowDelete = async () => {
                scope.state.showDelete = true;
                scope.deleteTime = (new Date()).getTime();
                $timeout( () => {
                    if (scope.deleteTime + 29000 < (new Date()).getTime() ) {
                        scope.state.showDelete = false;
                        scope.$apply();
                    }
                }, 30000);
                
            }

            scope.onFinish = () => {
                scope.state.visible = false;
                if (scope.state.changesSaved) {
                    scope._onFinish();
                }
            }
        }
    };
}
