/**
 * Specialized View for displaying fixed-page EPUBs on mobile devices
 * @param {object} options:
 * 		prerender: specify how many pages should be prerendered. default: 1
 */
Readium.Views.FixedPaginationViewMobile = Readium.Views.FixedPaginationView.extend({

	options : {
		prerender : 2
	},

	scale : 1,

	viewType : 'center',

	renderedPages : [],

	// computed rect, which is centered in the view with preserved proportions,
	// depending on two_up and page aspect ratio
	centerRect: {},

	initialize: function() {
		Readium.Views.PaginationViewBase.prototype.initialize.call(this);
		this.page_template = _.template( $('#fixed-page-template-mobile').html() );
		this.empty_template = _.template( $('#empty-fixed-page-template').html() );
		this.model.on("first_render_ready", this.render, this);
		this.model.on("change:two_up", this.setUpMode, this);
		this.bindHammer();
	},

	bindHammer : function() {
		var that = this;
		var startOffset;
		var startTimestamp;
		var startDimensions;

		this.$el
			.hammer()
			.on('tap doubletap', function(e){
				// maybe a bug of hammer, but we stop these events here, becuase
				// they are triggered twice on the #layer1 el
				e.preventDefault();
				e.stopPropagation();
			})
			/**
			 * Save timestamp to detect swipe (drag duration < 300ms)
			 * Save offset to append offset later as scrolling
			 */
			.on('dragstart', function(e) {
				startTimestamp = e.timeStamp;
				startOffset = that.$('#page-wrap').offset();
			})
		/**
		 * check if we have a swipe. if yes, change page accordingly
		 * also, undo scrolling
		 */
			.on('swipe', function(e) {
				if (e.direction === 'left') that.model.nextPage();
				if (e.direction === 'right') that.model.prevPage();

				if (e.direction === 'right' || e.direction === 'left') {
					that.$('#page-wrap').css({
						'top' : startOffset.top,
						'left' : startOffset.left
					});

					e.preventDefault();
					e.stopPropagation();
				}
			})
		/**
		 * scroll the book according to the drag
		 * only after 200ms to avoid dragin while swipe
		 */
			.on('drag', function(e) {
				//if (e.timeStamp - 200 > startTimestamp) {
					that.transform({
						'top' : startOffset.top + e.distanceY,
						'left' : startOffset.left + e.distanceX
					})
				//}
			})
			.on('dragend', function(e) {
				e.preventDefault();
				e.stopPropagation();
			})
		/**
		 * save the dimensions of #page-wrap for scaling
		 */
			.on('transformstart', function(e) {
				var pageWrap = that.$('#page-wrap');

				startDimensions = {
					height: pageWrap.height(),
					width: pageWrap.width(),
					left: pageWrap.offset().left,
					top: pageWrap.offset().top
				}
			})
		/**
		 * only scaling. it scales the #page-wrap and cares for the content
		 */
			.on('transform', function(e) {
				var twoUpMultiplicator = that.model.get("two_up") ? 2 : 1;
				var metaWidth = that.model.get('meta_width') || that.model.get('content_width');
				var scaleCenterOffsetLeft = e.position.x - startDimensions.left;
				var scaleCenterOffsetTop = e.position.y - startDimensions.top;

				$('#page-wrap').css({
					height : startDimensions.height * e.scale,
					width: startDimensions.width * e.scale,
					left: startDimensions.left - (e.scale * scaleCenterOffsetLeft) + scaleCenterOffsetLeft,
					top: startDimensions.top - (e.scale * scaleCenterOffsetTop) + scaleCenterOffsetTop
				});

				that.scale = ((startDimensions.width * e.scale) / twoUpMultiplicator) / metaWidth;

				$('.fixed-page-wrap iframe').each(function(i){
					that.applyScale(this, that.scale);
				});

				that.fixScaleUp(10);
			});
	},

	updateCenterRect: function() {
		var twoUpMultiplicator = this.model.get("two_up") ? 2 : 1;
		var metaWidth = this.model.get('meta_width') || this.model.get('content_width');
		var metaHeight = this.model.get('meta_height') || this.model.get('content_height');
		var elRatio = (this.el.offsetWidth / twoUpMultiplicator) / this.el.offsetHeight;
		var ratio = metaWidth / metaHeight;
		var preserveRatioWidth = this.el.offsetHeight * ratio;
		var preserveRatioHeight = this.el.offsetWidth / ratio;

		if (elRatio > ratio) {
			this.centerRect = {
				top: 0,
				left: (this.el.offsetWidth - preserveRatioWidth * twoUpMultiplicator) / 2,
				height: this.el.offsetHeight,
				width: preserveRatioWidth * twoUpMultiplicator
			}
		} else {
			this.centerRect = {
				top: (this.el.offsetHeight - preserveRatioHeight / twoUpMultiplicator) / 2,
				left: 0,
				height: preserveRatioHeight / twoUpMultiplicator,
				width: this.el.offsetWidth
			}
		}

		return this.centerRect
	},

	/**
	 * currently unused. should replace onTransform, onDrag, centerPage and zoomPage
	 * @param params
	 */
	transform: function(params) {
		var $pageWrap = this.$('#page-wrap');

		var defaults = {
			height: 0, //this.$el.width(),
			width: 0, //this.$el.height(),
			top: 0,
			left: 0,
			scale: 1,
			scaleCenterLeft: 0,
			scaleCenterTop: 0
		}

		// stoppers
		if (params.width < this.centerRect.width) return
		if (params.height < this.centerRect.height) return
		if (params.left + $pageWrap.width() < this.centerRect.width + this.centerRect.left) {
			var overscroll = (this.centerRect.width + this.centerRect.left) - (params.left + $pageWrap.width())
			$('#overscroll-right').width( overscroll )
			return
		};
		if (params.left > this.centerRect.left) {
			var overscroll = params.left - this.centerRect.left;
			$('#overscroll-left').width( overscroll );
			return
		};
		if (params.top + $pageWrap.height() < this.centerRect.height + this.centerRect.top) return
		if (params.top > this.centerRect.top) return

		if (params.left) $pageWrap.css('left', params.left);
		if (params.top) $pageWrap.css('top', params.top);
	},

	centerPage: function() {
		var that = this;

		var twoUpMultiplicator = this.model.get("two_up") ? 2 : 1;
		var metaWidth = this.model.get('meta_width') || this.model.get('content_width');

		$('#page-wrap').css(this.centerRect);

		var oldScale = this.scale;
		var scale = this.scale = $('#page-wrap').width() / twoUpMultiplicator / metaWidth;

		$('.fixed-page-wrap iframe').each(function(i){
			that.applyScale(this, scale);
		});

		if (oldScale < scale) this.fixScaleUp(301);

		this.viewType = 'center';
	},

	/**
	 * zooms the page view, so that a single page is showed in the biggest possible size;
	 * nearly 100% of the containing container (el).
	 * @param even zoom to the odd or even page
	 */
	zoomPage: function(even) {
		var that = this;

		var twoUpMultiplicator = this.model.get("two_up") ? 2 : 1;
		var pageWrapRatio = $('#page-wrap').width() / $('#page-wrap').height();
		var zoomedWidth = this.$el.width() * twoUpMultiplicator;
		var metaWidth = this.model.get('meta_width') || this.model.get('content_width');
		var scale = this.scale = this.$el.width() / metaWidth;

		$('#page-wrap')
			.width(zoomedWidth)
			.height(zoomedWidth / pageWrapRatio)
			.css('left', even ? 0 : -zoomedWidth / 2)
			.css('top', 0);

		$('.fixed-page-wrap iframe').each(function(i){
			that.applyScale(this, scale);
		});

		this.fixScaleUp(301);

		this.viewType = 'zoom';
	},

	/**
	 * Scrolls the pages
	 * @param x amount in vertical direction
	 * @param y amount in horizontal direction
	 */
	scroll: function(x, y) {
		var x = x || 0,
				y = y || 0,
				offset = this.$('#page-wrap').offset();

		this.$('#page-wrap').css({
			'top' : offset.top + x,
			'left' : offset.left + y
		});
	},
	/**
	 * stupid workaround according to: http://stackoverflow.com/questions/3485365/how-can-i-force-webkit-to-redraw-repaint-to-propagate-style-changes
	 * on ipad orientationChange from portrait to landscape and also on chrome if we make
	 * the browser window bigger, for some reasons (bug in webkit?) the scaling does not work fine.
	 */
	fixScaleUp: function(timeout) {
		this.scaleUpFixTimeout = window.setTimeout(function(){
			$('.fixed-page-wrap:visible iframe').each(function(i){
				this.contentDocument.body.style.display='none';
				this.contentDocument.body.offsetHeight;
				this.contentDocument.body.style.display='block';
			});
		}, timeout || 0);
	},

	applyScale: function(iframe, scale) {
		var doScale = _book.get('scale') === undefined ? true : _book.get('scale'); // default is true

		if (doScale) {
			iframe.contentDocument.body.style.webkitTransform='scale(' + scale + ')';
			iframe.contentDocument.body.style.webkitTransformOrigin='0 0';
		}
	},

	injectHelperJS: function(iframe) {
		var doc = iframe.contentDocument;
		var script = doc.createElement("script");
		script.type = "text/javascript";
		script.src = "/lib/readium/scripts/web_overrides/iframe_inject.js";
		doc.getElementsByTagName("head")[0].appendChild(script);
	},

	render: function() {
		// add all the pages
		var that = this;
		var windowHeight = $(window).height();
		var windowWidth = $(window).width();

		this.sections = this.model.getAllSections();

		$('body').addClass('apple-fixed-layout');
		this.updateCenterRect();
		this.setUpMode();

		$(window).on('resize', function(e){
			var $this = $(this);

			that.updateCenterRect();

			// fix for ipad/iphone bug: http://stackoverflow.com/questions/8898412/iphone-ipad-triggering-unexpected-resize-events
			if ( $this.height() != windowHeight || $this.width() != windowWidth) {
				windowWidth = $this.width();
				windowHeight = $this.height();

				that.applyViewType();
			}
		});

		$(window).on('orientationchange', this.fixScaleUp);

		for(var i = 0; i < this.sections.length; i++) {
			this.sections[i].page_num = i + 1;
		}

		this.model.changPageNumber(this.sections.length);
		return this;
	},

	setUpMode: function() {
		// call super
		Readium.Views.PaginationViewBase.prototype.setUpMode.call(this);
		var two_up = this.model.get("two_up");
		var height = this.model.get("meta_height");
		var width = this.model.get("meta_width");
		if(two_up) {
			var content = this.empty_template({page_num: 0, height: height, width: width});
			//this.$('#container').prepend(content);
		} else {
			$('#page-0').remove();
		}
		this.applyViewType();
	},

	applyViewType: function(viewType) {
		var viewType = viewType || this.viewType;

		if (viewType === 'center') {
			this.centerPage();
		} else if (viewType === 'zoom') {
			this.zoomPage();
		}
	},

	toggleViewType: function() {
		if (this.viewType === 'center') {
			this.zoomPage();
		} else if (this.viewType === 'zoom') {
			this.centerPage();
		}
	},

	/**
	 * renders a given page, if it is not already rendered
	 * @param pageNumber
	 */
	renderPage: function(pageNumber) {
		if (1 > pageNumber || pageNumber > this.sections.length) return

		var that = this;

		if (this.renderedPages.indexOf(pageNumber) === -1) {
			var renderedPage = this.page_template( this.sections[pageNumber -1] );
			var $page = $(renderedPage).appendTo( this.$('#container') );

			$('.content-sandbox', $page).on("load", function(e) {
				that.applyBindings( $(e.srcElement).contents() );
				that.injectHelperJS(this);
				that.applyScale(this, that.scale);
			});

			this.renderedPages.push(pageNumber);
		}
	},

	changePage: function() {

		var that = this;
		var currentPage = this.model.get("current_page");
		var two_up = this.model.get("two_up");

		var renderStart = _.first(currentPage) - this.options.prerender;
		var renderStop = _.last(currentPage) + this.options.prerender;

		for (var p = renderStart; p <= renderStop; p++) {
			this.renderPage(p);
		}

		this.$(".fixed-page-wrap").each(function(index) {
			$(this).toggle(that.isPageVisible(index + 1, currentPage));
		});
	},

	events: {
		'click #page-wrap a': function(e) {
			this.linkClickHandler(e)
		}
	}
});
