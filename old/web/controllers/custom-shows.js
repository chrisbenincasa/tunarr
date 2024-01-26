module.exports = function ($scope, $timeout, dizquetv) {
    $scope.showss = []
    $scope.showShowConfig = false
    $scope.selectedShow = null
    $scope.selectedShowIndex = -1

    $scope.refreshShow = async () => {
        $scope.shows = [ { id: '?', pending: true} ]
        $timeout();
        let shows = await dizquetv.getAllShowsInfo();
        $scope.shows = shows;
        $timeout();
    }
    $scope.refreshShow();

    
    
    let feedToShowConfig = () => {};
    let feedToDeleteShow = feedToShowConfig;

    $scope.registerShowConfig = (feed) => {
        feedToShowConfig = feed;
    }

    $scope.registerDeleteShow = (feed) => {
        feedToDeleteShow = feed;
    }

    $scope.queryChannel = async (index, channel) => {
        let ch = await dizquetv.getChannelDescription(channel.number);
        ch.pending = false;
        $scope.shows[index] = ch;
        $scope.$apply();
    }

    $scope.onShowConfigDone = async (show) => {
        if ($scope.selectedChannelIndex != -1) {
            $scope.shows[ $scope.selectedChannelIndex ].pending = false;
        }
        if (typeof show !== 'undefined') {
            // not canceled
            if ($scope.selectedChannelIndex == -1) { // add new channel
                await dizquetv.createShow(show);
            } else {
                $scope.shows[ $scope.selectedChannelIndex ].pending = true;
                await dizquetv.updateShow(show.id, show);
            }
            await $scope.refreshShow();
        }
    }
    $scope.selectShow = async (index) => {
        try {
            if ( (index != -1) && $scope.shows[index].pending) {
                return;
            }
            $scope.selectedChannelIndex = index;
            if (index === -1) {
                feedToShowConfig();
            } else {
                $scope.shows[index].pending = true;
                let f = await dizquetv.getShow($scope.shows[index].id);
                feedToShowConfig(f);
                $timeout();
            }
        } catch( err ) {
            console.error("Could not fetch show.", err);
        }
    }

    $scope.deleteShow = async (index) => {
        try {
            if ( $scope.shows[index].pending) {
                return;
            }
            let show = $scope.shows[index];
            if (confirm("Are you sure to delete show: " + show.name + "? This will NOT delete the show's programs from channels that are using.")) {
                show.pending = true;
                await dizquetv.deleteShow(show.id);
                $timeout();
                await $scope.refreshShow();
                $timeout();
            }

        } catch (err) {
            console.error("Could not delete show.", err);
        }

    }

}