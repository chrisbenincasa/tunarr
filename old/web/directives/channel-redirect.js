module.exports = function ($timeout, dizquetv) {
    return {
        restrict: 'E',
        templateUrl: 'templates/channel-redirect.html',
        replace: true,
        scope: {
            formTitle: "=formTitle",
            visible: "=visible",
            program: "=program",
            _onDone: "=onDone"
        },
        link: function (scope, element, attrs) {
            scope.error = "";
            scope.options = [];
            scope.loading = true;

            scope.$watch('program', () => {
                if (typeof(scope.program) === 'undefined') {
                    return;
                }
                if ( isNaN(scope.program.duration) ) {
                    scope.program.duration = 15000;
                }
                scope.durationSeconds = Math.ceil( scope.program.duration / 1000.0 );;
            })

            scope.refreshChannels = async() => {
                let channelNumbers = await dizquetv.getChannelNumbers();
                try {
                    await Promise.all( channelNumbers.map( async(x) => {
                        let desc = await dizquetv.getChannelDescription(x);
                        let option = {
                            id: x,
                            description: `${x} - ${desc.name}`,
                        };
                        let i = 0;
                        while (i < scope.options.length) {
                            if (scope.options[i].id == x) {
                                scope.options[i] = option;
                                break;
                            }
                            i++;
                        }
                        if (i == scope.options.length) {
                            scope.options.push(option);
                        }
                        scope.$apply();
                    }) );
                } catch (err) {
                    console.error(err);
                }
                scope.options.sort( (a,b) => a.id - b.id );
                scope.loading = false;
                $timeout( () => scope.$apply(), 0);
            };
            scope.refreshChannels();

            scope.onCancel = () => {
                scope.visible = false;
            }

            scope.onDone = () => {
                scope.error = "";
                if (typeof(scope.program.channel) === 'undefined') {
                    scope.error = "Please select a channel.";
                }
                if ( isNaN(scope.program.channel) ) {
                    scope.error = "Channel must be a number.";
                }
                if ( isNaN(scope.durationSeconds) ) {
                    scope.error = "Duration must be a number.";
                }
                if ( scope.error != "" ) {
                    $timeout( () => scope.error = "", 60000);
                    return;
                }
                scope.program.duration = scope.durationSeconds * 1000;
                scope._onDone( scope.program );
                scope.visible = false;

            };
        
        }
    };
}
