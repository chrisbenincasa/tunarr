module.exports = function (dizquetv, resolutionOptions) {
  return {
    restrict: 'E',
    templateUrl: 'templates/ffmpeg-settings.html',
    replace: true,
    scope: {},
    link: function (scope, element, attrs) {
      //add validations to ffmpeg settings, speciall commas in codec name
      dizquetv.getFfmpegSettings().then((settings) => {
        scope.settings = settings;
        scope.resolutionString = `${scope.settings.targetResolution.widthPx}x${scope.settings.targetResolution.heightPx}`;
      });
      scope.updateSettings = (settings) => {
        dizquetv.updateFfmpegSettings(settings).then((_settings) => {
          scope.settings = _settings;
        });
      };
      scope.resetSettings = (settings) => {
        dizquetv.resetFfmpegSettings(settings).then((_settings) => {
          scope.settings = _settings;
        });
      };
      scope.isTranscodingNotNeeded = () => {
        return (
          typeof scope.settings === 'undefined' ||
          !scope.settings.enableTranscoding
        );
      };
      scope.hideIfNotAutoPlay = () => {
        return scope.settings.enableAutoPlay != true;
      };
      scope.resolutionOptions = resolutionOptions.get();
      scope.$watch('resolutionString', (value) => {
        if (!value) return;
        const [w, h] = value.split('x', 2);
        if (scope.settings) {
          scope.settings.targetResolution = {
            widthPx: w,
            heightPx: h,
          };
        }
      });
      scope.muxDelayOptions = [
        { id: '0', description: '0 Seconds' },
        { id: '1', description: '1 Seconds' },
        { id: '2', description: '2 Seconds' },
        { id: '3', description: '3 Seconds' },
        { id: '4', description: '4 Seconds' },
        { id: '5', description: '5 Seconds' },
        { id: '10', description: '10 Seconds' },
      ];
      scope.errorScreens = [
        { value: 'pic', description: 'images/generic-error-screen.png' },
        { value: 'blank', description: 'Blank Screen' },
        { value: 'static', description: 'Static' },
        { value: 'testsrc', description: 'Test Pattern (color bars + timer)' },
        {
          value: 'text',
          description: 'Detailed error (requires ffmpeg with drawtext)',
        },
        { value: 'kill', description: 'Stop stream, show errors in logs' },
      ];
      scope.errorAudios = [
        { value: 'whitenoise', description: 'White Noise' },
        { value: 'sine', description: 'Beep' },
        { value: 'silent', description: 'No Audio' },
      ];
      scope.fpsOptions = [
        { id: 23.976, description: '23.976 frames per second' },
        { id: 24, description: '24 frames per second' },
        { id: 25, description: '25 frames per second' },
        { id: 29.97, description: '29.97 frames per second' },
        { id: 30, description: '30 frames per second' },
        { id: 50, description: '50 frames per second' },
        { id: 59.94, description: '59.94 frames per second' },
        { id: 60, description: '60 frames per second' },
        { id: 120, description: '120 frames per second' },
      ];
      scope.scalingOptions = [
        { id: 'bicubic', description: 'bicubic (default)' },
        { id: 'fast_bilinear', description: 'fast_bilinear' },
        { id: 'lanczos', description: 'lanczos' },
        { id: 'spline', description: 'spline' },
      ];
      scope.deinterlaceOptions = [
        { value: 'none', description: 'do not deinterlace' },
        { value: 'bwdif=0', description: 'bwdif send frame' },
        { value: 'bwdif=1', description: 'bwdif send field' },
        { value: 'w3fdif', description: 'w3fdif' },
        { value: 'yadif=0', description: 'yadif send frame' },
        { value: 'yadif=1', description: 'yadif send field' },
      ];
    },
  };
};
