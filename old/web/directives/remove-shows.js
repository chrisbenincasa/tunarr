module.exports = function ($timeout) {
    return {
        restrict: 'E',
        templateUrl: 'templates/remove-shows.html',
        replace: true,
        scope: {
            programInfos: "=programInfos",
            visible: "=visible",
            onDone: "=onDone",
            deleted: "=deleted"
        },
        link: function (scope, element, attrs) {
            scope.toggleShowDeletion = (programId) => {
                const deletedIdx = scope.deleted.indexOf(programId);
                if (deletedIdx === -1) {
                    scope.deleted.push(programId);
                } else {
                    scope.deleted.splice(deletedIdx, 1);
                }
            }
            scope.finished = () => {
                const d = scope.deleted;
                scope.programInfos = null;
                scope.deleted = null;
                scope.onDone(d);
            }
        }
    };
}
