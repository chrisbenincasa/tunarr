
module.exports = function ($timeout, dizquetv, getShowData) {
    const MINUTE = 60*1000;
    const HOUR = 60*MINUTE;
    const DAY = 24*HOUR;
    const WEEK = 7 * DAY;
    
    return {
        restrict: 'E',
        templateUrl: 'templates/random-slots-schedule-editor.html',
        replace: true,
        scope: {
            linker: "=linker",
            onDone: "=onDone"
        },
        
        link: function (scope, element, attrs) {
            scope.limit = 50000;
            scope.visible = false;

            scope.badTimes = false;
            scope._editedTime = null;
            let showsById;
            let shows;


            function reset() {
                showsById = {};
                shows = [];
                scope.schedule = {
                    maxDays: 365,
                    flexPreference : "distribute",
                    padStyle: "slot",
                    randomDistribution: "uniform",
                    slots : [],
                    pad: 1,
                }
            }
            reset();

            function loadBackup(backup) {
                scope.schedule = JSON.parse( JSON.stringify(backup) );
                if (typeof(scope.schedule.pad) == 'undefined') {
                    scope.schedule.pad = 1;
                }
                let slots = scope.schedule.slots;
                for (let i = 0; i < slots.length; i++) {
                    let found = false;
                    for (let j = 0; j < scope.showOptions.length; j++) {
                        if (slots[i].showId == scope.showOptions[j].id) {
                            found = true;
                        }
                    }
                    if (! found) {
                        slots[i].showId  = "flex.";
                        slots[i].order = "shuffle";
                    }
                }
                if (typeof(scope.schedule.flexPreference) === 'undefined') {
                    scope.schedule.flexPreference = "distribute";
                }
                if (typeof(scope.schedule.padStyle) === 'undefined') {
                    scope.schedule.padStyle = "slot";
                }
                if (typeof(scope.schedule.randomDistribution) === 'undefined') {
                    scope.schedule.randomDistribution = "uniform";
                }

                scope.refreshSlots();

            }

            getTitle = (index) => {
                let showId = scope.schedule.slots[index].showId;
                for (let i = 0; i < scope.showOptions.length; i++) {
                    if (scope.showOptions[i].id == showId) {
                        return scope.showOptions[i].description;
                    }
                }
                return "Unknown";
            }
            scope.isWeekly = () => {
                return (scope.schedule.period === WEEK);
            };
            scope.addSlot = () => {
                scope.schedule.slots.push(
                    {
                        duration: 30 * MINUTE,
                        showId: "flex.",
                        order: "next",
                        cooldown : 0,
                    }
                );
            }
            scope.timeColumnClass = () => {
                return { "col-md-1": true};
            }
            scope.programColumnClass = () => {
                return { "col-md-6": true};
            };
            scope.durationOptions = [
                { id: 5 * MINUTE , description: "5 Minutes" },
                { id: 10 * MINUTE , description: "10 Minutes" },
                { id: 15 * MINUTE , description: "15 Minutes" },
                { id: 20 * MINUTE , description: "20 Minutes" },
                { id: 25 * MINUTE , description: "25 Minutes" },
                { id: 30 * MINUTE , description: "30 Minutes" },
                { id: 45 * MINUTE , description: "45 Minutes" },
                { id: 1 * HOUR , description: "1 Hour" },
                { id: 90 * MINUTE , description: "90 Minutes" },
                { id: 100 * MINUTE , description: "100 Minutes" },
                { id: 2 * HOUR , description: "2 Hours" },
                { id: 3 * HOUR , description: "3 Hours" },
                { id: 4 * HOUR , description: "4 Hours" },
                { id: 5 * HOUR , description: "5 Hours" },
                { id: 6 * HOUR , description: "6 Hours" },
                { id: 8 * HOUR , description: "8 Hours" },
                { id: 10* HOUR , description: "10 Hours" },
                { id: 12* HOUR , description: "12 Hours" },
                { id: 1 * DAY , description: "1 Day" },
            ];
            scope.cooldownOptions = [
                { id: 0 , description: "No cooldown" },
                { id: 1 * MINUTE , description: "1 Minute" },
                { id: 5 * MINUTE , description: "5 Minutes" },
                { id: 10 * MINUTE , description: "10 Minutes" },
                { id: 15 * MINUTE , description: "15 Minutes" },
                { id: 20 * MINUTE , description: "20 Minutes" },
                { id: 25 * MINUTE , description: "25 Minutes" },
                { id: 30 * MINUTE , description: "30 Minutes" },
                { id: 45 * MINUTE , description: "45 Minutes" },
                { id: 1 * HOUR , description: "1 Hour" },
                { id: 90 * MINUTE , description: "90 Minutes" },
                { id: 100 * MINUTE , description: "100 Minutes" },
                { id: 2 * HOUR , description: "2 Hours" },
                { id: 3 * HOUR , description: "3 Hours" },
                { id: 4 * HOUR , description: "4 Hours" },
                { id: 5 * HOUR , description: "5 Hours" },
                { id: 6 * HOUR , description: "6 Hours" },
                { id: 8 * HOUR , description: "8 Hours" },
                { id: 10* HOUR , description: "10 Hours" },
                { id: 12* HOUR , description: "12 Hours" },
                { id: 1 * DAY , description: "1 Day" },
                { id: 1 * DAY , description: "2 Days" },
                { id: 3 * DAY + 12 * HOUR , description: "3.5 Days" },
                { id: 7 * DAY , description: "1 Week" },
            ];

            scope.flexOptions = [
                { id: "distribute", description: "Between videos" },
                { id: "end", description: "End of the slot" },
            ]

            scope.distributionOptions = [
                { id: "uniform", description: "Uniform" },
                { id: "weighted", description: "Weighted" },
            ]


            scope.padOptions = [
                {id: 1, description: "Do not pad" },
                {id: 1*MINUTE, description: "0:00, 0:01, 0:02, ..., 0:59" },
                {id: 5*MINUTE, description: "0:00, 0:05, 0:10, ..., 0:55" },
                {id: 10*60*1000, description: "0:00, 0:10, 0:20, ..., 0:50" },
                {id: 15*60*1000, description: "0:00, 0:15, 0:30, ..., 0:45" },
                {id: 30*60*1000, description: "0:00, 0:30" },
                {id: 1*60*60*1000, description: "0:00" },
            ];
            scope.padStyleOptions = [
                {id: "episode" , description: "Pad Episodes" },
                {id: "slot" , description: "Pad Slots" },
            ];

            scope.showOptions = [];
            scope.orderOptions = [
                { id: "next", description: "Play Next" },
                { id: "shuffle", description: "Shuffle" },
            ];

            let doIt = async() => {
                let res = await dizquetv.calculateRandomSlots(scope.programs, scope.schedule  );
                for (let i = 0; i < scope.schedule.slots.length; i++) {
                    delete scope.schedule.slots[i].weightPercentage;
                }
                res.schedule = scope.schedule;
                return res;
            }



            
            let startDialog = (programs, limit, backup) => {
                scope.limit = limit;
                scope.programs = programs;

                reset();
                


                programs.forEach( (p) => {
                    let show = getShow(p);
                    if (show != null) {
                        if (typeof(showsById[show.id]) === 'undefined') {
                            showsById[show.id] = shows.length;
                            shows.push( show );
                        } else {
                            show = shows[ showsById[show.id] ];
                        }
                    }
                } );
                scope.showOptions = shows.map( (show) => { return show } );
                scope.showOptions.push( {
                    id: "flex.",
                    description: "Flex",
                } );
                if (typeof(backup) !== 'undefined') {
                    loadBackup(backup);
                }

                scope.visible = true;
            }


            scope.linker( {
                startDialog: startDialog,
            } );

            scope.finished = async (cancel) => {
                scope.error = null;
                if (!cancel) {
                    try {
                        scope.loading = true;
                        $timeout();
                        scope.onDone( await doIt() );
                        scope.visible = false;
                    } catch(err) {
                        console.error("Unable to generate channel lineup", err);
                        scope.error  = "There was an error processing the schedule";
                        return;
                    } finally {
                        scope.loading = false;
                        $timeout();
                    }
                } else {
                    scope.visible = false;
                }
            }

            scope.deleteSlot = (index) => {
                scope.schedule.slots.splice(index, 1);
            }

            scope.hasTimeError = (slot) => {
                return typeof(slot.timeError) !== 'undefined';
            }

            scope.disableCreateLineup = () => {
                if (scope.badTimes) {
                    return true;
                }
                if (typeof(scope.schedule.maxDays) === 'undefined') {
                    return true;
                }
                if (scope.schedule.slots.length == 0) {
                    return true;
                }
                return false;
            }

            scope.canShowSlot = (slot) => {
                return (slot.showId != 'flex.') && !(slot.showId.startsWith('redirect.'));
            }

            scope.refreshSlots = () => {
                let sum = 0;
                for (let i = 0; i < scope.schedule.slots.length; i++) {
                    sum += scope.schedule.slots[i].weight;
                }
                for (let i = 0; i < scope.schedule.slots.length; i++) {
                    if (scope.schedule.slots[i].showId == 'movie.') {
                        scope.schedule.slots[i].order = "shuffle";
                    }
                    if ( isNaN(scope.schedule.slots[i].cooldown) ) {
                        scope.schedule.slots[i].cooldown = 0;
                    }
                    scope.schedule.slots[i].weightPercentage
                        = (100 * scope.schedule.slots[i].weight / sum).toFixed(2) + "%";
                }
                $timeout();
            }

            scope.randomDistributionChanged = () => {
                if (scope.schedule.randomDistribution === 'uniform') {
                    for (let i = 0; i < scope.schedule.slots.length; i++) {
                        scope.schedule.slots[i].weight = 1;
                    }
                } else {
                    for (let i = 0; i < scope.schedule.slots.length; i++) {
                        scope.schedule.slots[i].weight = 300;
                    }
                }
                scope.refreshSlots();
            }



        }
    };

    function getShow(program) {

        let d = getShowData(program);
        if (! d.hasShow) {
            return null;
        } else {
            d.description = d.showDisplayName;
            d.id = d.showId;
            return d;
        }
    }

}