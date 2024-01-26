module.exports = function (angular) {
    /*
 * angular-lazy-load
 *
 * Copyright(c) 2014 Paweł Wszoła <wszola.p@gmail.com>
 * MIT Licensed
 *
 */

/**
 * @author Paweł Wszoła (wszola.p@gmail.com)
 *
 */

angular.module('angularLazyImg', []);

angular.module('angularLazyImg').factory('LazyImgMagic', [
  '$window', '$rootScope', 'lazyImgConfig', 'lazyImgHelpers',
  function($window, $rootScope, lazyImgConfig, lazyImgHelpers){
    'use strict';

    var winDimensions, $win, images, isListening, options;
    var checkImagesT, saveWinOffsetT, containers;

    images = [];
    isListening = false;
    options = lazyImgConfig.getOptions();
    $win = angular.element($window);
    winDimensions = lazyImgHelpers.getWinDimensions();
    saveWinOffsetT = lazyImgHelpers.throttle(function(){
      winDimensions = lazyImgHelpers.getWinDimensions();
    }, 60);
    options.container = options.containers || options.container;
    containers = options.container ? [].concat(options.container) : [$win];

    function checkImages(){
      for(var i = images.length - 1; i >= 0; i--){
        var image = images[i];
        if(image && lazyImgHelpers.isElementInView(image.$elem[0], options.offset, winDimensions)){
          loadImage(image);
          images.splice(i, 1);
        }
      }
      if(!images.length){ stopListening(); }
    }

    checkImagesT = lazyImgHelpers.throttle(checkImages, 30);

    function listen(param){
      containers.forEach(function (container) {
        container[param]('scroll', checkImagesT);
        container[param]('touchmove', checkImagesT);
      });
      $win[param]('resize', checkImagesT);
      $win[param]('resize', saveWinOffsetT);
    }

    function startListening(){
      isListening = true;
      setTimeout(function(){
        checkImages();
        listen('on');
      }, 1);
    }

    function stopListening(){
      isListening = false;
      listen('off');
    }

    function removeImage(image){
      var index = images.indexOf(image);
      if(index !== -1) {
        images.splice(index, 1);
      }
    }

    function loadImage(photo){
      var img = new Image();
      img.onerror = function(){
        if(options.errorClass){
          photo.$elem.addClass(options.errorClass);
        }
        if(photo.errorSrc){
          setPhotoSrc(photo.$elem, photo.errorSrc);
        }
        $rootScope.$apply(function () {
          $rootScope.$emit('lazyImg:error', photo);
          options.onError(photo);
        });
      };
      img.onload = function(){
        setPhotoSrc(photo.$elem, photo.src);
        if(options.successClass){
          photo.$elem.addClass(options.successClass);
        }
        $rootScope.$apply(function () {
          $rootScope.$emit('lazyImg:success', photo);
          options.onSuccess(photo);
        });
      };
      img.src = photo.src;
    }

    function setPhotoSrc($elem, src){
      if ($elem[0].nodeName.toLowerCase() === 'img') {
        $elem[0].src = src;
      } else {
        $elem.css('background-image', 'url("' + src + '")');
      }
    }

    // PHOTO
    function Photo($elem){
      this.$elem = $elem;
    }

    Photo.prototype.setSource = function(source){
      this.src = source;
      images.unshift(this);
      startListening();
    };

    Photo.prototype.setErrorSource = function(errorSource){
      this.errorSrc = errorSource;
    };

    Photo.prototype.removeImage = function(){
      removeImage(this);
      if(!images.length){ stopListening(); }
    };

    Photo.prototype.checkImages = checkImages;

    Photo.addContainer = function (container) {
      stopListening();
      containers.push(container);
      startListening();
    };

    Photo.removeContainer = function (container) {
      stopListening();
      containers.splice(containers.indexOf(container), 1);
      startListening();
    };

    return Photo;
  }
]);

angular.module('angularLazyImg').provider('lazyImgConfig', function() {
  'use strict';

  this.options = {
    offset       : 100,
    errorClass   : null,
    successClass : null,
    onError      : function(){},
    onSuccess    : function(){}
  };

  this.$get = function() {
    var options = this.options;
    return {
      getOptions: function() {
        return options;
      }
    };
  };

  this.setOptions = function(options) {
    angular.extend(this.options, options);
  };
});

angular.module('angularLazyImg').factory('lazyImgHelpers', [
  '$window', function($window){
    'use strict';

    function getWinDimensions(){
      return {
        height: $window.innerHeight,
        width: $window.innerWidth
      };
    }

    function isElementInView(elem, offset, winDimensions) {
      var rect = elem.getBoundingClientRect();
      return (
        // check if any part of element is in view extented by an offset
       (rect.left <= winDimensions.width + offset) &&
       (rect.right >= 0 - offset) &&
       (rect.top <= winDimensions.height + offset) &&
       (rect.bottom >= 0 - offset)
      );
    }

    // http://remysharp.com/2010/07/21/throttling-function-calls/
    function throttle(fn, threshhold, scope) {
      var last, deferTimer;
      return function () {
        var context = scope || this;
        var now = +new Date(),
            args = arguments;
        if (last && now < last + threshhold) {
          clearTimeout(deferTimer);
          deferTimer = setTimeout(function () {
            last = now;
            fn.apply(context, args);
          }, threshhold);
        } else {
          last = now;
          fn.apply(context, args);
        }
      };
    }

    return {
      isElementInView: isElementInView,
      getWinDimensions: getWinDimensions,
      throttle: throttle
    };
  }
]);

angular.module('angularLazyImg')
  .directive('lazyImg', [
    '$rootScope', '$log', 'LazyImgMagic', function ($rootScope, $log, LazyImgMagic) {
      'use strict';

      function link(scope, element, attributes) {
        scope.lazyImage = new LazyImgMagic(element);
        scope.lazyImage.setErrorSource(attributes.lazyImgError);
        var deregister = attributes.$observe('lazyImg', function (newSource) {
          if (newSource) {
            deregister();
            scope.lazyImage.setSource(newSource);
          }
        });

        var eventsDeregister = $rootScope.$on('lazyImg:refresh', function () {
          scope.lazyImage.checkImages();
        });

        scope.$on('$destroy', function () {
          scope.lazyImage.removeImage();
          eventsDeregister();
        });
      }

      return {
        link: link,
        restrict: 'A'
      };
    }
  ])
  .directive('lazyImgContainer', [
    'LazyImgMagic', function (LazyImgMagic) {
      'use strict';

      function link(scope, element) {
        LazyImgMagic.addContainer(element);
        scope.$on('$destroy', function () {
          LazyImgMagic.removeContainer(element);
        });
      }

      return {
        link: link,
        restrict: 'A'
      };
    }
  ]);
}