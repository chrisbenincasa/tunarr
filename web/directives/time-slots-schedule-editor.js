module.exports = function ($timeout, dizquetv, getShowData) {
  const DAY = 24 * 60 * 60 * 1000;
  const WEEK = 7 * DAY;
  const WEEK_DAYS = [
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
  ];

  return {
    restrict: 'E',
    templateUrl: 'templates/time-slots-schedule-editor.html',
    replace: true,
    scope: {
      linker: '=linker',
      onDone: '=onDone',
    },

    link: function (scope, element, attrs) {
      scope.limit = 50000;
      scope.visible = false;
      scope.fake = { time: -1 };
      scope.badTimes = false;
      scope._editedTime = null;
      let showsById;
      let shows;

      function reset() {
        showsById = {};
        shows = [];
        scope.schedule = {
          period: DAY,
          lateness: 0,
          maxDays: 365,
          flexPreference: 'distribute',
          slots: [],
          pad: 1,
          fake: { time: -1 },
        };
      }
      reset();

      function loadBackup(backup) {
        scope.schedule = JSON.parse(JSON.stringify(backup));
        if (typeof scope.schedule.pad == 'undefined') {
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
          if (!found) {
            slots[i].showId = 'flex.';
            slots[i].order = 'shuffle';
          }
        }
        if (typeof scope.schedule.flexPreference === 'undefined') {
          scope.schedule.flexPreference = 'distribute';
        }
        if (typeof scope.schedule.period === 'undefined') {
          scope.schedule.period = DAY;
        }
        scope.schedule.fake = {
          time: -1,
        };
      }

      let getTitle = (index) => {
        let showId = scope.schedule.slots[index].showId;
        for (let i = 0; i < scope.showOptions.length; i++) {
          if (scope.showOptions[i].id == showId) {
            return scope.showOptions[i].description;
          }
        }
        return 'Uknown';
      };
      scope.isWeekly = () => {
        return scope.schedule.period === WEEK;
      };
      scope.periodChanged = () => {
        if (scope.isWeekly()) {
          //From daily to weekly
          let l = scope.schedule.slots.length;
          for (let i = 0; i < l; i++) {
            let t = scope.schedule.slots[i].time;
            scope.schedule.slots[i].time = t % DAY;
            for (let j = 1; j < 7; j++) {
              //clone the slot for every day of the week
              let c = JSON.parse(angular.toJson(scope.schedule.slots[i]));
              c.time += j * DAY;
              scope.schedule.slots.push(c);
            }
          }
        } else {
          //From weekly to daily
          let newSlots = [];
          let seen = {};
          for (let i = 0; i < scope.schedule.slots.length; i++) {
            let slot = scope.schedule.slots[i];
            let t = slot.time % DAY;
            if (seen[t] !== true) {
              seen[t] = true;
              newSlots.push(slot);
            }
          }
          scope.schedule.slots = newSlots;
        }
        scope.refreshSlots();
      };
      scope.editTime = (index) => {
        let t = scope.schedule.slots[index].time;
        scope._editedTime = {
          time: t,
          index: index,
          isWeekly: scope.isWeekly(),
          title: getTitle(index),
        };
      };
      scope.finishedTimeEdit = (slot) => {
        scope.schedule.slots[slot.index].time = slot.time;
        scope.refreshSlots();
      };
      scope.addSlot = () => {
        scope._addedTime = {
          time: 0,
          index: -1,
          isWeekly: scope.isWeekly(),
          title: 'New time slot',
        };
      };
      scope.finishedAddingTime = (slot) => {
        scope.schedule.slots.push({
          time: slot.time,
          showId: 'flex.',
          order: 'next',
        });
        scope.refreshSlots();
      };
      scope.displayTime = (t) => {
        if (scope.isWeekly()) {
          let w = Math.floor(t / DAY);
          let t2 = t % DAY;
          return WEEK_DAYS[w].substring(0, 3) + ' ' + niceLookingTime(t2);
        } else {
          return niceLookingTime(t);
        }
      };
      scope.timeColumnClass = () => {
        let r = {};
        if (scope.isWeekly()) {
          r['col-md-3'] = true;
        } else {
          r['col-md-2'] = true;
        }
        return r;
      };
      scope.programColumnClass = () => {
        let r = {};
        if (scope.isWeekly()) {
          r['col-md-6'] = true;
        } else {
          r['col-md-7'] = true;
        }
        return r;
      };
      scope.periodOptions = [
        { id: DAY, description: 'Daily' },
        { id: WEEK, description: 'Weekly' },
      ];
      scope.latenessOptions = [
        { id: 0, description: 'Do not allow' },
        { id: 5 * 60 * 1000, description: '5 minutes' },
        { id: 10 * 60 * 1000, description: '10 minutes' },
        { id: 15 * 60 * 1000, description: '15 minutes' },
        { id: 1 * 60 * 60 * 1000, description: '1 hour' },
        { id: 2 * 60 * 60 * 1000, description: '2 hours' },
        { id: 3 * 60 * 60 * 1000, description: '3 hours' },
        { id: 4 * 60 * 60 * 1000, description: '4 hours' },
        { id: 8 * 60 * 60 * 1000, description: '8 hours' },
        { id: 24 * 60 * 60 * 1000, description: "I don't care about lateness" },
      ];
      scope.flexOptions = [
        { id: 'distribute', description: 'Between videos' },
        { id: 'end', description: 'End of the slot' },
      ];

      scope.padOptions = [
        { id: 1, description: 'Do not pad' },
        { id: 5 * 60 * 1000, description: '0:00, 0:05, 0:10, ..., 0:55' },
        { id: 10 * 60 * 1000, description: '0:00, 0:10, 0:20, ..., 0:50' },
        { id: 15 * 60 * 1000, description: '0:00, 0:15, 0:30, ..., 0:45' },
        { id: 30 * 60 * 1000, description: '0:00, 0:30' },
        { id: 1 * 60 * 60 * 1000, description: '0:00' },
      ];

      scope.showOptions = [];
      scope.orderOptions = [
        { id: 'next', description: 'Play Next' },
        { id: 'shuffle', description: 'Shuffle' },
      ];

      let doIt = async () => {
        scope.schedule.timeZoneOffset = new Date().getTimezoneOffset();
        console.log(scope.programs, scope.schedule);
        let res = await dizquetv.calculateTimeSlots(
          scope.programs,
          scope.schedule,
        );
        res.schedule = scope.schedule;
        delete res.schedule.fake;
        return res;
      };

      let startDialog = (programs, limit, backup) => {
        scope.limit = limit;
        scope.programs = programs;

        reset();

        programs.forEach((p) => {
          let show = getShow(p);
          if (show != null) {
            if (typeof showsById[show.id] === 'undefined') {
              showsById[show.id] = shows.length;
              shows.push(show);
            } else {
              show = shows[showsById[show.id]];
            }
          }
        });
        scope.showOptions = shows.map((show) => {
          return show;
        });
        scope.showOptions.push({
          id: 'flex.',
          description: 'Flex',
        });
        if (typeof backup !== 'undefined') {
          loadBackup(backup);
        }

        scope.visible = true;
      };

      scope.linker({
        startDialog: startDialog,
      });

      scope.finished = async (cancel) => {
        scope.error = null;
        if (!cancel) {
          try {
            scope.loading = true;
            $timeout();
            scope.onDone(await doIt());
            scope.visible = false;
          } catch (err) {
            console.error('Unable to generate channel lineup', err);
            scope.error = 'There was an error processing the schedule';
            return;
          } finally {
            scope.loading = false;
            $timeout();
          }
        } else {
          scope.visible = false;
        }
      };

      scope.deleteSlot = (index) => {
        scope.schedule.slots.splice(index, 1);
      };

      scope.hasTimeError = (slot) => {
        return typeof slot.timeError !== 'undefined';
      };

      scope.disableCreateLineup = () => {
        if (scope.badTimes) {
          return true;
        }
        if (typeof scope.schedule.maxDays === 'undefined') {
          return true;
        }
        if (scope.schedule.slots.length == 0) {
          return true;
        }
        return false;
      };

      scope.canShowSlot = (slot) => {
        return slot.showId != 'flex.' && !slot.showId.startsWith('redirect.');
      };

      scope.refreshSlots = () => {
        scope.badTimes = false;
        //"Bubble sort ought to be enough for anybody"
        for (let i = 0; i < scope.schedule.slots.length; i++) {
          for (let j = i + 1; j < scope.schedule.slots.length; j++) {
            if (scope.schedule.slots[j].time < scope.schedule.slots[i].time) {
              let x = scope.schedule.slots[i];
              scope.schedule.slots[i] = scope.schedule.slots[j];
              scope.schedule.slots[j] = x;
            }
          }
          if (scope.schedule.slots[i].showId == 'movie.') {
            scope.schedule.slots[i].order = 'shuffle';
          }
        }
        for (let i = 0; i < scope.schedule.slots.length; i++) {
          if (
            (i > 0 &&
              scope.schedule.slots[i].time ==
                scope.schedule.slots[i - 1].time) ||
            (i + 1 < scope.schedule.slots.length &&
              scope.schedule.slots[i].time == scope.schedule.slots[i + 1].time)
          ) {
            scope.badTimes = true;
            scope.schedule.slots[i].timeError = 'Please select a unique time.';
          } else {
            delete scope.schedule.slots[i].timeError;
          }
        }
        $timeout();
      };
    },
  };

  function getShow(program) {
    let d = getShowData(program);
    if (!d.hasShow) {
      return null;
    } else {
      d.description = d.showDisplayName;
      d.id = d.showId;
      return d;
    }
  }
};

function niceLookingTime(t) {
  let d = new Date(t);
  d.setMilliseconds(0);

  return d.toLocaleTimeString([], { timeZone: 'UTC' });
}
