module.exports = function ($timeout, dizquetv) {
    return {
        restrict: 'E',
        templateUrl: 'templates/flex-config.html',
        replace: true,
        scope: {
            title: "@offlineTitle",
            program: "=program",
            visible: "=visible",
            onDone: "=onDone"
        },
        link: function (scope, element, attrs) {
            let updateNext = true;
            scope.$watch('program', () => {
                try {
                    if  ( (typeof(scope.program) === 'undefined') || (scope.program == null) ) {
                        updateNext = true;
                        return;
                    } else if (! updateNext) {
                        return;
                    }
                    updateNext = false;
                    scope.error = null;
                } catch (err) {
                    console.error(err);
                }
            })

            scope.finished = (prog) => {
                scope.error = null;
                if (isNaN(prog.durationSeconds) || prog.durationSeconds < 0 ) {
                    scope.error = { duration: 'Duration must be a positive integer' }
                }
                if (scope.error != null) {
                    $timeout(() => {
                        scope.error = null
                    }, 30000)
                    return
                }
                scope.onDone(JSON.parse(angular.toJson(prog)))
                scope.program = null
            }

        }
    };
}
