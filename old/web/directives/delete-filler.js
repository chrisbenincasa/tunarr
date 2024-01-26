module.exports = function ($timeout) {
    return {
        restrict: 'E',
        templateUrl: 'templates/delete-filler.html',
        replace: true,
        scope: {
            linker: "=linker",
            onExit: "=onExit"
        },
        link: function (scope, element, attrs) {
            scope.name = '';
            scope.channels = [];
            scope.visible = false;

            scope.linker( (filler) => {
                scope.name = filler.name;
                scope.id = filler.id;
                scope.channels = filler.channels;
                scope.visible = true;
            } );

            scope.finished = (cancelled) => {
                scope.visible = false;
                if (! cancelled) {
                    scope.onExit(  scope.id );
                } else {
                    scope.onExit();
                }
            }
        }
    };
}
