module.exports = function ($scope, $location) {
    $scope.selected = $location.hash()
    if ($scope.selected === '')
        $scope.selected = 'xmltv'
}