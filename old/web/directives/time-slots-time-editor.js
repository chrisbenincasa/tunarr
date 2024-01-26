module.exports = function ($timeout) {
    return {
        restrict: 'E',
        templateUrl: 'templates/time-slots-time-editor.html',
        replace: true,
        scope: {
            title: "@dialogTitle",
            slot: "=slot",
            visible: "=visible",
            onDone: "=onDone"
        },
        link: function (scope, element, attrs) {
            let updateNext = true;
            scope.w = 0;
            scope.h = 0;
            scope.m = 0;
            scope.s = 0;
            scope.weekDayOptions = [
                { id: 0, description : "Thursday" } ,
                { id: 1, description : "Friday" } ,
                { id: 2, description : "Saturday" } ,
                { id: 3, description : "Sunday" } ,
                { id: 4, description : "Monday" } ,
                { id: 5, description : "Tuesday" } ,
                { id: 6, description : "Wednesday" } ,
            ];

            scope.hourOptions = [];
            for (let i = 0; i < 24; i++) {
                scope.hourOptions.push( {
                    id: i,
                    description: pad(i),
                } );
            }
            scope.minuteOptions = [];
            let mods = [ 15, 5, 1 ];
            mods.forEach( x => {
                for (let i = 0; i < 60; i+= x) {
                    scope.minuteOptions.push( {
                        id: i,
                        description: pad(i),
                    } );
                }
            } );

            function pad(x) {
                let s = "" + x;
                if (s.length < 2) {
                    s = "0" + s;
                }
                return s;
            }

            scope.$watch('slot', () => {
                try {
                    if  ( (typeof(scope.slot) === 'undefined') || (scope.slot == null) ) {
                        updateNext = true;
                        return;
                    } else if (! updateNext) {
                        return;
                    }
                    updateNext = false;
                    scope.error = null;
                    t = Math.floor( scope.slot.time % (24 * 60 * 60 * 1000) / 1000 );
                    let s = t % 60;
                    let m = ( (t - s) / 60 ) % 60;
                    let h = (t - m*60 - s) / 3600;
                    let w = Math.floor( scope.slot.time / (24 * 60 * 60 * 1000) ) % 7;
                    scope.slot.h = h;
                    scope.slot.m = m;
                    scope.slot.s = s;
                    scope.slot.w = w;
                } catch (err) {
                    console.error(err);
                }
            })

            scope.finished = (slot) => {
                scope.error = null;
                if (isNaN(slot.h) || slot.h < 0 || slot.h > 23 ) {
                    scope.error = { t: 'Invalid hour of the day' }
                }
                if (isNaN(slot.m) || slot.m < 0 || slot.m > 59 ) {
                    scope.error = { t: 'Invalid minutes' }
                }
                if (isNaN(slot.s) || slot.s < 0 || slot.s > 59 ) {
                    scope.error = { t: 'Invalid seconds' }
                }
                if (isNaN(slot.w) || slot.w < 0 || slot.w > 6 ) {
                    scope.error = { t: 'Invalid day' }
                }

                if (scope.error != null) {
                    $timeout(() => {
                        scope.error = null
                    }, 30000)
                    return
                }
                slot.time = slot.w*24*60*60*1000 + slot.h*60*60*1000 + slot.m*60*1000+ slot.s*1000;
                scope.onDone(JSON.parse(angular.toJson(slot)))
                scope.slot = null
            }

        }
    };
}
