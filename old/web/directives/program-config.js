module.exports = function ($timeout) {
    return {
        restrict: 'E',
        templateUrl: 'templates/program-config.html',
        replace: true,
        scope: {
            program: "=program",
            visible: "=visible",
            onDone: "=onDone"
        },
        link: function (scope, element, attrs) {
            scope.finished = (prog) => {
                if (prog.title === "")
                    scope.error = { title: 'You must set a program title.' }
                else if (prog.type === "episode" && prog.showTitle == "")
                    scope.error = { showTitle: 'You must set a show title when the program type is an episode.' }
                else if (prog.type === "episode" && (prog.season == null))
                    scope.error = { season: 'You must set a season number when the program type is an episode.' }
                else if (prog.type === "episode" && prog.season <= 0)
                    scope.error = { season: 'Season number musat be greater than 0' }
                else if (prog.type === "episode" && (prog.episode == null))
                    scope.error = { episode: 'You must set a episode number when the program type is an episode.' }
                else if (prog.type === "episode" && prog.episode <= 0)
                    scope.error = { episode: 'Episode number musat be greater than 0' }

                if (scope.error != null) {
                    $timeout(() => {
                        scope.error = null
                    }, 3500)
                    return
                }

                scope.onDone(JSON.parse(angular.toJson(prog)))
                scope.program = null
            }
        }
    };
}
