module.exports = function ($scope, $timeout, dizquetv) {
    $scope.fillers = []
    $scope.showFillerConfig = false
    $scope.selectedFiller = null
    $scope.selectedFillerIndex = -1

    $scope.refreshFiller = async () => {
        $scope.fillers = [ { id: '?', pending: true} ]
        $timeout();
        let fillers = await dizquetv.getAllFillersInfo();
        $scope.fillers = fillers;
        $timeout();
    }
    $scope.refreshFiller();

    
    
    let feedToFillerConfig = () => {};
    let feedToDeleteFiller = feedToFillerConfig;

    $scope.registerFillerConfig = (feed) => {
        feedToFillerConfig = feed;
    }

    $scope.registerDeleteFiller = (feed) => {
        feedToDeleteFiller = feed;
    }

    $scope.queryChannel = async (index, channel) => {
        let ch = await dizquetv.getChannelDescription(channel.number);
        ch.pending = false;
        $scope.fillers[index] = ch;
        $scope.$apply();
    }

    $scope.onFillerConfigDone = async (filler) => {
        if ($scope.selectedChannelIndex != -1) {
            $scope.fillers[ $scope.selectedChannelIndex ].pending = false;
        }
        if (typeof filler !== 'undefined') {
            // not canceled
            if ($scope.selectedChannelIndex == -1) { // add new channel
                await dizquetv.createFiller(filler);
            } else {
                $scope.fillers[ $scope.selectedChannelIndex ].pending = true;
                await dizquetv.updateFiller(filler.id, filler);
            }
            await $scope.refreshFiller();
        }
    }
    $scope.selectFiller = async (index) => {
        try {
            if ( (index != -1) && $scope.fillers[index].pending) {
                return;
            }
            $scope.selectedChannelIndex = index;
            if (index === -1) {
                feedToFillerConfig();
            } else {
                $scope.fillers[index].pending = true;
                let f = await dizquetv.getFiller($scope.fillers[index].id);
                feedToFillerConfig(f);
                $timeout();
            }
        } catch( err ) {
            console.error("Could not fetch filler.", err);
        }
    }

    $scope.deleteFiller = async (index) => {
        try {
            if ( $scope.fillers[index].pending) {
                return;
            }
            $scope.deleteFillerIndex = index;
            $scope.fillers[index].pending = true;
            let id = $scope.fillers[index].id;
            let channels = await dizquetv.getChannelsUsingFiller(id);
            feedToDeleteFiller( {
                id: id,
                name: $scope.fillers[index].name,
                channels : channels,
            } );
            $timeout();

        } catch (err) {
            console.error("Could not start delete filler dialog.", err);
        }

    }

    $scope.onFillerDelete = async( id ) => {
        try {
            $scope.fillers[ $scope.deleteFillerIndex ].pending = false;
            $timeout();
            if (typeof(id) !== 'undefined') {
                $scope.fillers[ $scope.deleteFillerIndex ].pending = true;
                await dizquetv.deleteFiller(id);
                $timeout();
                await $scope.refreshFiller();
                $timeout();
            }
        } catch (err) {
            console.error("Error attempting to delete filler", err);
        }
    }
}