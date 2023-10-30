const MINUTE = 60 * 1000;

module.exports = function ($scope, $timeout, dizquetv) {
  $scope.offset = 0;
  $scope.M = 60 * MINUTE;
  $scope.zoomLevel = 3;
  $scope.T = 190 * MINUTE;
  $scope.before = 15 * MINUTE;
  $scope.enableNext = false;
  $scope.enableBack = false;
  $scope.showNow = false;
  $scope.nowPosition = 0;
  $scope.refreshHandle = null;

  const intl = new Intl.DateTimeFormat('default', {
    hour12: true,
    hour: 'numeric',
    minute: 'numeric',
  });

  let hourMinute = (d) => {
    return intl.format(d);
  };

  $scope.updateBasics = () => {
    $scope.channelNumberWidth = 5;
    $scope.channelIconWidth = 8;
    $scope.channelWidth = $scope.channelNumberWidth + $scope.channelIconWidth;
    //we want 1 minute = 1 colspan
    $scope.colspanPercent = (100 - $scope.channelWidth) / ($scope.T / MINUTE);
    $scope.channelColspan = Math.floor(
      $scope.channelWidth / $scope.colspanPercent,
    );
    $scope.channelNumberColspan = Math.floor(
      $scope.channelNumberWidth / $scope.colspanPercent,
    );
    $scope.channelIconColspan =
      $scope.channelColspan - $scope.channelNumberColspan;
    $scope.totalSpan = Math.floor($scope.T / MINUTE);
    $scope.colspanPercent = (100 - $scope.channelWidth) / ($scope.T / MINUTE);
    $scope.channelColspan = Math.floor(
      $scope.channelWidth / $scope.colspanPercent,
    );
    $scope.channelNumberColspan = Math.floor(
      $scope.channelNumberWidth / $scope.colspanPercent,
    );
    $scope.channelIconColspan =
      $scope.channelColspan - $scope.channelNumberColspan;
  };
  $scope.updateBasics();

  $scope.channelNumberWidth = 5;
  $scope.channelIconWidth = 8;
  $scope.channelWidth = $scope.channelNumberWidth + $scope.channelIconWidth;
  //we want 1 minute = 1 colspan

  $scope.applyLater = () => {
    $timeout(() => $scope.$apply(), 0);
  };

  $scope.channelNumbers = [];
  $scope.channels = {};
  $scope.lastUpdate = -1;

  $scope.updateJustNow = () => {
    $scope.t1 = new Date().getTime();
    if ($scope.t0 <= $scope.t1 && $scope.t1 < $scope.t0 + $scope.T) {
      let n = ($scope.t1 - $scope.t0) / MINUTE;
      $scope.nowPosition = ($scope.channelColspan + n) * $scope.colspanPercent;
      if ($scope.nowPosition >= 50 && $scope.offset >= 0) {
        $scope.offset = 0;
        $scope.adjustZoom();
      }
      $scope.showNow = true;
    } else {
      $scope.showNow = false;
    }
  };

  $scope.nowTimer = () => {
    $scope.updateJustNow();
    $timeout(() => $scope.nowTimer(), 10000);
  };
  $timeout(() => $scope.nowTimer(), 10000);

  $scope.refreshManaged = async (skipStatus) => {
    $scope.t1 = new Date().getTime();
    $scope.t1 = $scope.t1 - ($scope.t1 % MINUTE);
    $scope.t0 = $scope.t1 - $scope.before + $scope.offset;
    $scope.title = 'TV Guide';
    $scope.times = [];

    $scope.updateJustNow();
    let pending = 0;
    let addDuration = (d) => {
      let m = (pending + d) % MINUTE;
      let r = pending + d - m;
      pending = m;
      return Math.floor(r / MINUTE);
    };
    let deleteIfZero = () => {
      if (
        $scope.times.length > 0 &&
        $scope.times[$scope.times.length - 1].duration < 1
      ) {
        $scope.times = $scope.times.slice(0, $scope.times.length - 1);
      }
    };

    let rem = $scope.T;
    let t = $scope.t0;
    if (t % $scope.M != 0) {
      let dif = $scope.M - (t % $scope.M);
      $scope.times.push({
        duration: addDuration(dif),
      });
      deleteIfZero();
      t += dif;
      rem -= dif;
    }
    while (rem > 0) {
      let d = Math.min(rem, $scope.M);
      $scope.times.push({
        duration: addDuration(d),
        label: hourMinute(new Date(t)),
      });
      t += d;
      rem -= d;
    }

    if (skipStatus !== true) {
      $scope.channelNumbers = [0];
      $scope.channels = {};
      $scope.channels[0] = {
        loading: true,
      };
      $scope.applyLater();
      console.log('getting status...');
      let status = await dizquetv.getGuideStatus();
      $scope.lastUpdate = new Date(status.lastUpdate).getTime();
      console.log('got status: ' + JSON.stringify(status));
      $scope.channelNumbers = status.channelNumbers;
      $scope.channels = {};
    }

    for (let i = 0; i < $scope.channelNumbers.length; i++) {
      if (typeof $scope.channels[$scope.channelNumbers[i]] === 'undefined') {
        $scope.channels[$scope.channelNumbers[i]] = {};
      }
      $scope.channels[$scope.channelNumbers[i]].loading = true;
    }
    $scope.applyLater();
    $scope.enableBack = false;
    $scope.enableNext = false;
    await Promise.all($scope.channelNumbers.map($scope.loadChannel));
    setupTimer();
  };

  let cancelTimerIfExists = () => {
    if ($scope.refreshHandle != null) {
      $timeout.cancel($scope.refreshHandle);
    }
  };

  $scope.$on('$locationChangeStart', () => {
    console.log('$locationChangeStart');
    cancelTimerIfExists();
  });

  let setupTimer = () => {
    cancelTimerIfExists();
    $scope.refreshHandle = $timeout(() => $scope.checkUpdates(), 60000);
  };

  $scope.adjustZoom = async () => {
    switch ($scope.zoomLevel) {
      case 1:
        $scope.T = 50 * MINUTE;
        $scope.M = 10 * MINUTE;
        $scope.before = 5 * MINUTE;
        break;
      case 2:
        $scope.T = 100 * MINUTE;
        $scope.M = 15 * MINUTE;
        $scope.before = 10 * MINUTE;
        break;
      case 3:
        $scope.T = 190 * MINUTE;
        $scope.M = 30 * MINUTE;
        $scope.before = 15 * MINUTE;
        break;
      case 4:
        $scope.T = 270 * MINUTE;
        $scope.M = 60 * MINUTE;
        $scope.before = 15 * MINUTE;
        break;
      case 5:
        $scope.T = 380 * MINUTE;
        $scope.M = 90 * MINUTE;
        $scope.before = 15 * MINUTE;
        break;
    }

    $scope.updateBasics();
    await $scope.refresh(true);
  };

  $scope.zoomOut = async () => {
    $scope.zoomLevel = Math.min(5, $scope.zoomLevel + 1);
    await $scope.adjustZoom();
  };
  $scope.zoomIn = async () => {
    $scope.zoomLevel = Math.max(1, $scope.zoomLevel - 1);
    await $scope.adjustZoom();
  };
  $scope.zoomOutEnabled = () => {
    return $scope.zoomLevel < 5;
  };
  $scope.zoomInEnabled = () => {
    return $scope.zoomLevel > 1;
  };

  $scope.next = async () => {
    $scope.offset += ($scope.M * 7) / 8;
    await $scope.adjustZoom();
  };
  $scope.back = async () => {
    $scope.offset -= ($scope.M * 7) / 8;
    await $scope.adjustZoom();
  };
  $scope.backEnabled = () => {
    return $scope.enableBack;
  };
  $scope.nextEnabled = () => {
    return $scope.enableNext;
  };

  $scope.loadChannel = async (number) => {
    console.log(`number=${number}`);
    let d0 = new Date($scope.t0);
    let d1 = new Date($scope.t0 + $scope.T);
    let lineup = await dizquetv.getChannelLineup(number, d0, d1);
    let ch = {
      icon: lineup.icon,
      number: lineup.number,
      name: lineup.name,
      altTitle: `${lineup.number} - ${lineup.name}`,
      programs: [],
    };

    let pending = 0;
    let totalAdded = 0;
    let addDuration = (d) => {
      totalAdded += d;
      let m = (pending + d) % MINUTE;
      let r = pending + d - m;
      pending = m;
      return Math.floor(r / MINUTE);
    };

    let deleteIfZero = () => {
      if (
        ch.programs.length > 0 &&
        ch.programs[ch.programs.length - 1].duration < 1
      ) {
        ch.programs = ch.programs.slice(0, ch.programs.length - 1);
      }
    };

    for (let i = 0; i < lineup.programs.length; i++) {
      let program = lineup.programs[i];
      let ad = new Date(program.start);
      let bd = new Date(program.stop);
      let a = ad.getTime();
      let b = bd.getTime();
      let hasStart = true;
      let hasStop = true;
      if (a < $scope.t0) {
        //cut-off
        a = $scope.t0;
        hasStart = false;
        $scope.enableBack = true;
      } else if (a > $scope.t0 && i == 0) {
        ch.programs.push({
          duration: addDuration(a - $scope.t0),
          showTitle: '',
          start: false,
          end: true,
        });
        deleteIfZero();
      }
      if (b > $scope.t0 + $scope.T) {
        b = $scope.t0 + $scope.T;
        hasStop = false;
        $scope.enableNext = true;
      }
      let subTitle = undefined;
      let episodeTitle = undefined;
      let altTitle = hourMinute(ad) + '-' + hourMinute(bd);
      if (typeof program.title !== 'undefined') {
        altTitle = altTitle + ' · ' + program.title;
      }

      if (typeof program.sub !== 'undefined') {
        ps = '' + program.sub.season;
        if (ps.length < 2) {
          ps = '0' + ps;
        }
        pe = '' + program.sub.episode;
        if (pe.length < 2) {
          pe = '0' + pe;
        }
        subTitle = `S${ps} · E${pe}`;
        altTitle = altTitle + ' ' + subTitle;
        episodeTitle = program.sub.title;
      } else if (typeof program.date === 'undefined') {
        subTitle = '.';
      } else {
        subTitle = program.date.slice(0, 4);
      }
      ch.programs.push({
        duration: addDuration(b - a),
        altTitle: altTitle,
        showTitle: program.title,
        subTitle: subTitle,
        episodeTitle: episodeTitle,
        start: hasStart,
        end: hasStop,
      });
      deleteIfZero();
    }
    if (totalAdded < $scope.T) {
      ch.programs.push({
        duration: addDuration($scope.T - totalAdded),
        showTitle: '',
        start: false,
        end: true,
      });
      deleteIfZero();
    }
    $scope.channels[number] = ch;
    $scope.applyLater();
  };

  $scope.refresh = async (skipStatus) => {
    try {
      await $scope.refreshManaged(skipStatus);
    } catch (err) {
      console.error('Refresh failed?', err);
    }
  };

  $scope.adjustZoom();
  $scope.refresh();

  $scope.checkUpdates = async () => {
    try {
      console.log('get status ' + new Date());
      let status = await dizquetv.getGuideStatus();
      let t = new Date(status.lastUpdate).getTime();
      if (t > $scope.lastUpdate) {
        $scope.refreshManaged();
      } else {
        setupTimer();
      }
    } catch (err) {
      console.error(err);
    }
  };
};
