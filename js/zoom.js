(function (window, document) {
    "use strict";
    /*global window, document*/
    var ZOOMHANDLERS = [
            'clickHandler',
            'zoom',
            'scrollHandler',
            'keyHandler',
            'touchStart',
            'touchMove'
        ],
        onload,
        dispose;

    /**
     * The zoom object
     */
    function Zoom(img) {
        this.fullHeight = null;
        this.fullWidth = null;
        this.overlay = null;
        this.targetImageWrap = null;

        this.targetImage = img;
    }

    Zoom.OFFSET = 80;
    Zoom.MAXWIDTH = 2560;
    Zoom.MAXHEIGHT = 4096;

    Zoom.prototype.zoomImage = function () {
        var img = document.createElement('img');
        img.onload = function () {
            this.fullHeight = Number(img.height);
            this.fullWidth = Number(img.width);
            this.zoomOriginal();
        }.bind(this);
        img.src = this.targetImage.src;
    };

    Zoom.prototype.zoomOriginal = function () {
        this.targetImageWrap = document.createElement('div');
        this.targetImageWrap.className = 'zoom-img-wrap';

        this.targetImage.parentNode.insertBefore(this.targetImageWrap, this.targetImage);
        this.targetImageWrap.appendChild(this.targetImage);

        this.targetImage.classList.add('zoom-img');
        this.targetImage.setAttribute('data-action', 'zoom-out');

        this.overlay = document.createElement('div');
        this.overlay.className = 'zoom-overlay';

        document.body.appendChild(this.overlay);

        this.calculateZoom();
        this.triggerAnimation();
    };

    Zoom.prototype.calculateZoom = function () {
        this.targetImage.offsetWidth; // repaint before animating

        var originalFullImageWidth = this.fullWidth,
            originalFullImageHeight = this.fullHeight,

            maxScaleFactor = originalFullImageWidth / this.targetImage.width,

            viewportHeight = (window.innerHeight - Zoom.OFFSET),
            viewportWidth = (window.innerWidth - Zoom.OFFSET),

            imageAspectRatio = originalFullImageWidth / originalFullImageHeight,
            viewportAspectRatio = viewportWidth / viewportHeight;

        if (originalFullImageWidth < viewportWidth && originalFullImageHeight < viewportHeight) {
            this.imgScaleFactor = maxScaleFactor;

        } else if (imageAspectRatio < viewportAspectRatio) {
            this.imgScaleFactor = (viewportHeight / originalFullImageHeight) * maxScaleFactor;

        } else {
            this.imgScaleFactor = (viewportWidth / originalFullImageWidth) * maxScaleFactor;
        }
    };

    Zoom.prototype.triggerAnimation = function () {
        this.targetImage.offsetWidth; // repaint before animating

        var clientRect = this.targetImage.getBoundingClientRect(),
            scrollTop = window.pageYOffset,
            imageOffset = {
                top: scrollTop + clientRect.top,
                left: window.pageXOffset + clientRect.left
            },

            viewportY = scrollTop + (window.innerHeight / 2),
            viewportX = (window.innerWidth / 2),

            imageCenterY = imageOffset.top + (this.targetImage.height / 2),
            imageCenterX = imageOffset.left + (this.targetImage.width / 2);

        this.translateY = viewportY - imageCenterY;
        this.translateX = viewportX - imageCenterX;

        this.targetImage.style.transform = 'scale(' + this.imgScaleFactor + ')';
        this.targetImageWrap.style.transform = 'translate(' + this.translateX + 'px, ' + this.translateY + 'px) translateZ(0)';

        document.body.classList.add('zoom-overlay-open');
    };

    Zoom.prototype.close = function () {
        var classList = document.body.classList;
        classList.remove('zoom-overlay-open');
        classList.add('zoom-overlay-transitioning');

        // we use setStyle here so that the correct vender prefix for transform is used
        this.targetImage.style.transform = '';
        this.targetImageWrap.style.transform = '';

        dispose = function () {
            this.dispose();
            this.targetImage.removeEventListener('transitionend', dispose, false);
        }.bind(this);

        this.targetImage.addEventListener('transitionend', dispose, false);
    };

    Zoom.prototype.dispose = function () {
        if (this.targetImageWrap && this.targetImageWrap.parentNode) {
            this.targetImage.classList.remove('zoom-img');
            this.targetImage.setAttribute('data-action', 'zoom');

            this.targetImageWrap.parentNode.replaceChild(this.targetImage, this.targetImageWrap);
            this.overlay.parentNode.removeChild(this.overlay);

            document.body.classList.remove('zoom-overlay-transitioning');
        }
    };

    /**
     * The zoom service
     */
    function ZoomService() {
        this.activeZoom = null;
        this.initialScrollPosition = null;
        this.initialTouchPosition = null;

        ZOOMHANDLERS.forEach(function (method) {
            this[method] = this[method].bind(this);
        }, this);
    }

    ZoomService.prototype.listen = function () {
        document.body.addEventListener('click', this.zoom, false);
    };

    ZoomService.prototype.zoom = function (e) {
        var target = e.target;

        if (!target || target.tagName !== 'IMG' || target.getAttribute('data-action') !== 'zoom') {
            return;
        }

        if (document.body.classList.contains('zoom-overlay-open')) {
            return;
        }

        if (e.metaKey || e.ctrlKey) {
            return window.open(e.target.src, 'blank');
        }

        if (target.width >= (window.innerWidth - Zoom.OFFSET)) {
            return;
        }

        this.activeZoomClose(true);

        this.activeZoom = new Zoom(target);
        this.activeZoom.zoomImage();

        // _todo(fat): probably worth throttling this
        window.addEventListener('scroll', this.scrollHandler, false);

        document.addEventListener('keyup', this.keyHandler, false);
        document.addEventListener('touchstart', this.touchStart, false);

        // we use a capturing phase here to prevent unintended js events
        // sadly no useCapture in jquery api (http://bugs.jquery.com/ticket/14953)
        document.addEventListener('click', this.clickHandler, true);

        e.stopPropagation();
    };

    ZoomService.prototype.activeZoomClose = function (forceDispose) {
        if (!this.activeZoom) {
            return;
        }

        if (forceDispose) {
            this.activeZoom.dispose();
        } else {
            this.activeZoom.close();
        }

        window.removeEventListener('scroll', this.scrollHandler, false);
        document.removeEventListener('keyup', this.keyHandler, false);
        document.removeEventListener('touchstart', this.touchStart, false);

        document.removeEventListener('click', this.clickHandler, true);

        this.activeZoom = null;
    };

    ZoomService.prototype.scrollHandler = function () {
        if (this.initialScrollPosition === null) {
            this.initialScrollPosition = window.scrollY;
        }

        var deltaY = this.initialScrollPosition - window.scrollY;
        if (Math.abs(deltaY) >= 40) {
            this.activeZoomClose();
        }
    };

    ZoomService.prototype.keyHandler = function (e) {
        if (e.keyCode === 27) {
            this.activeZoomClose();
        }
    };

    ZoomService.prototype.clickHandler = function (e) {
        e.stopPropagation();
        e.preventDefault();
        this.activeZoomClose();
    };

    ZoomService.prototype.touchStart = function (e) {
        this.initialTouchPosition = e.touches[0].pageY;
        e.target.addEventListener('touchmove', this.touchMove, false);
    };

    ZoomService.prototype.touchMove = function (e) {
        if (Math.abs(e.touches[0].pageY - this.initialTouchPosition) > 10) {
            this.activeZoomClose();
            e.target.removeEventListener('touchmove', this.touchMove, false);
        }
    };

    // wait for dom ready (incase script included before body)
    onload = function () {
        document.removeEventListener('DOMContentLoaded', onload, false);
        new ZoomService().listen();
    };
    document.addEventListener('DOMContentLoaded', onload, false);

}(window, document));
