module.exports = function ($timeout) {
    return {
        restrict: 'E',
        templateUrl: 'templates/frequency-tweak.html',
        replace: true,
        scope: {
            programs: "=programs",
            visible: "=visible",
            onDone: "=onDone",
            modified: "=modified",
            message: "=message",
        },
        link: function (scope, element, attrs) {
            scope.setModified = () => {
                scope.modified = true;
            }
            scope.finished = (programs) => {
                let p = programs;
                scope.programs = null;
                scope.onDone(p);
            }
        }
    };
}
