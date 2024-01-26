const angular = require('angular')
require('angular-router-browserify')(angular)
require('./ext/lazyload')(angular)
require('./ext/dragdrop')
require('./ext/angularjs-scroll-glue')
require('angular-vs-repeat');

var app = angular.module('myApp', ['ngRoute', 'vs-repeat', 'angularLazyImg', 'dndLists', 'luegg.directives'])

app.service('plex',             require('./services/plex'))
app.service('dizquetv',         require('./services/dizquetv'))
app.service('resolutionOptions', require('./services/resolution-options'))
app.service('getShowData', require('./services/get-show-data'))
app.service('commonProgramTools', require('./services/common-program-tools'))

app.directive('plexSettings',   require('./directives/plex-settings'))
app.directive('ffmpegSettings', require('./directives/ffmpeg-settings'))
app.directive('xmltvSettings',  require('./directives/xmltv-settings'))
app.directive('hdhrSettings',   require('./directives/hdhr-settings'))
app.directive('plexLibrary',    require('./directives/plex-library'))
app.directive('programConfig',  require('./directives/program-config'))
app.directive('flexConfig',  require('./directives/flex-config'))
app.directive('timeSlotsTimeEditor',  require('./directives/time-slots-time-editor'))
app.directive('toastNotifications',  require('./directives/toast-notifications'))
app.directive('fillerConfig',  require('./directives/filler-config'))
app.directive('showConfig',  require('./directives/show-config'))
app.directive('deleteFiller',  require('./directives/delete-filler'))
app.directive('frequencyTweak',  require('./directives/frequency-tweak'))
app.directive('removeShows',  require('./directives/remove-shows'))
app.directive('channelRedirect',  require('./directives/channel-redirect'))
app.directive('plexServerEdit',  require('./directives/plex-server-edit'))
app.directive('channelConfig',  require('./directives/channel-config'))
app.directive('timeSlotsScheduleEditor',  require('./directives/time-slots-schedule-editor'))
app.directive('randomSlotsScheduleEditor',  require('./directives/random-slots-schedule-editor'))

app.controller('settingsCtrl',  require('./controllers/settings'))
app.controller('channelsCtrl',  require('./controllers/channels'))
app.controller('versionCtrl',  require('./controllers/version'))
app.controller('libraryCtrl',  require('./controllers/library'))
app.controller('guideCtrl',  require('./controllers/guide'))
app.controller('playerCtrl',  require('./controllers/player'))
app.controller('fillerCtrl',  require('./controllers/filler'))
app.controller('customShowsCtrl',  require('./controllers/custom-shows'))

app.config(function ($routeProvider) {
    $routeProvider
    .when("/settings", {
        templateUrl: "views/settings.html",
        controller: 'settingsCtrl'
    })
    .when("/channels", {
        templateUrl: "views/channels.html",
        controller: 'channelsCtrl'
    })
    .when("/filler", {
        templateUrl: "views/filler.html",
        controller: 'fillerCtrl'
    })
    .when("/custom-shows", {
        templateUrl: "views/custom-shows.html",
        controller: 'customShowsCtrl'
    })
    .when("/library", {
        templateUrl: "views/library.html",
        controller: 'libraryCtrl'
    })
    .when("/guide", {
        templateUrl: "views/guide.html",
        controller: 'guideCtrl'
    })
    .when("/player", {
        templateUrl: "views/player.html",
        controller: 'playerCtrl'
    })
    .when("/version", {
        templateUrl: "views/version.html",
        controller: 'versionCtrl'
    })
    .otherwise({
        redirectTo: "guide"
    })
})