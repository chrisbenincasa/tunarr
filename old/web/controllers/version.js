module.exports = function ($scope, dizquetv) {
    $scope.version = ""
    $scope.ffmpegVersion = ""
    dizquetv.getVersion().then((version) => {
        $scope.version = version.dizquetv;
        $scope.ffmpegVersion = version.ffmpeg;
        $scope.nodejs = version.nodejs;
    })

    
}