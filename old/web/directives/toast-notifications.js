module.exports = function ($timeout) {
    return {
        restrict: 'E',
        templateUrl: 'templates/toast-notifications.html',
        replace: true,
        scope: {
        },
        link: function (scope, element, attrs) {

            const FADE_IN_START = 100;
            const FADE_IN_END = 1000;
            const FADE_OUT_START = 10000;
            const TOTAL_DURATION = 11000;


            scope.toasts = [];

            let eventSource = null;

            let timerHandle = null;
            let refreshHandle = null;


            let setResetTimer = () => {
                if (timerHandle != null) {
                    clearTimeout( timerHandle );
                }
                timerHandle = setTimeout( () => {
                    scope.setup();
                } , 10000);
            };

            let updateAfter = (wait) => {
                if (refreshHandle != null) {
                    $timeout.cancel( refreshHandle );
                }
                refreshHandle = $timeout( ()=> updater(), wait );
            };

            let updater = () => {
                let wait = 10000;
                let updatedToasts = [];
                try {
                    let t = (new Date()).getTime();
                    for (let i = 0; i < scope.toasts.length; i++) {
                        let toast = scope.toasts[i];
                        let diff = t - toast.time;
                        if (diff < TOTAL_DURATION) {
                            if (diff < FADE_IN_START) {
                                toast.clazz = { "about-to-fade-in" : true }
                                wait = Math.min( wait, FADE_IN_START - diff );
                            } else if (diff < FADE_IN_END) {
                                toast.clazz = { "fade-in" : true }
                                wait = Math.min( wait, FADE_IN_END - diff );
                            } else if (diff < FADE_OUT_START) {
                                toast.clazz = {}
                                wait = Math.min( wait, FADE_OUT_START - diff );
                            } else {
                                toast.clazz = { "fade-out" : true }
                                wait = Math.min( wait, TOTAL_DURATION - diff );
                            }
                            toast.clazz[toast.deco] = true;
                            updatedToasts.push(toast);
                        }
                    }
                } catch (err) {
                    console.error("error", err);
                }
                scope.toasts = updatedToasts;
                updateAfter(wait);
            };

            let addToast = (toast) => {
                toast.time = (new Date()).getTime();
                toast.clazz= { "about-to-fade-in": true };
                toast.clazz[toast.deco] = true;
                scope.toasts.push(toast);
                $timeout( () => updateAfter(0) );
            };

            let getDeco = (data) => {
                return "bg-" + data.level;
            }

            scope.setup = () => {
                if (eventSource != null) {
                    eventSource.close();
                    eventSource = null;
                }
                setResetTimer();

                eventSource = new EventSource("api/events");

                eventSource.addEventListener("heartbeat", () => {
                    setResetTimer();
                } );

                let normalEvent = (title) => {
                    return (event) => {
                        let data = JSON.parse(event.data);
                        addToast ( {
                            title : title,
                            text : data.message,
                            deco: getDeco(data)
                        } )
                    };
                };

                eventSource.addEventListener('settings-update',  normalEvent("Settings Update") );
                eventSource.addEventListener('xmltv',  normalEvent("TV Guide") );
                eventSource.addEventListener('lifecycle',  normalEvent("Server") );
            };

            scope.destroy = (index) => {
                scope.toasts.splice(index,1);
            }

            scope.setup();
        }
    };
}
