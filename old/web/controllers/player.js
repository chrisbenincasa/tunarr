module.exports = function ($scope, dizquetv, $timeout) {

    $scope.loading = true;
    $scope.channelOptions = [
        { id: undefined, description: "Select a channel" },
    ];
    $scope.icons = {};


    $scope.endpointOptions = [
        { id: "video", description: "/video - Channel mpegts" },
        { id: "m3u8", description: "/m3u8 - Playlist of individual videos" },
        { id: "radio", description: "/radio - Audio-only channel mpegts" },
    ];
    $scope.selectedEndpoint = "video";
    $scope.channel = undefined;

    $scope.endpointButtonHref = () => {
        if ( $scope.selectedEndpoint == "video") {
            return `./media-player/${$scope.channel}.m3u`
        } else if ( $scope.selectedEndpoint == "m3u8") {
            return `./media-player/fast/${$scope.channel}.m3u`
        } else if ( $scope.selectedEndpoint == "radio") {
            return `./media-player/radio/${$scope.channel}.m3u`
        }
    }

    $scope.buttonDisabled = () => {
        return typeof($scope.channel) === 'undefined';
    }

    $scope.endpoint = () => {
        if ( typeof($scope.channel) === 'undefined' ) {
            return "--"
        }
        let path = "";
        if ( $scope.selectedEndpoint == "video") {
            path = `/video?channel=${$scope.channel}`
        } else if ( $scope.selectedEndpoint == "m3u8") {
            path = `/m3u8?channel=${$scope.channel}`
        } else if ( $scope.selectedEndpoint == "radio") {
            path=  `/radio?channel=${$scope.channel}`
        }
        return window.location.href.replace("/#!/player", path);
    }

    let loadChannels = async() => {
        let channelNumbers = await dizquetv.getChannelNumbers();
        try {
            await Promise.all( channelNumbers.map( async(x) => {
                let desc = await dizquetv.getChannelDescription(x);
                let option = {
                    id: x,
                    description: `${x} - ${desc.name}`,
                };
                $scope.channelOptions.push( option );
                $scope.icons[x] = desc.icon;
            }) );
            $scope.channelOptions.sort( (a,b) => {
                let za = ( (typeof(a.id) === undefined)?-1:a.id);
                let zb = ( (typeof(b.id) === undefined)?-1:b.id);
                return za - zb;
            } );
            $scope.loading = false;
            $scope.$apply();
        } catch (err) {
            console.error(err);
        }
        $timeout( () => $scope.$apply(), 0);
    }

    loadChannels();
}