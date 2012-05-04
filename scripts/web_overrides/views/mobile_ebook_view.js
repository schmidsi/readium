Readium.Views.FixedPaginationViewMobile = Readium.Views.FixedPaginationView.extend({
	/* Specialized View for displaying fixed-page EPUBs on mobile devices */
	scale : 1,

	viewType : 'center',

	initialize: function() {
		// call the super ctor
		this.page_template = _.template( $('#fixed-page-template-mobile').html() );
		this.empty_template = _.template( $('#empty-fixed-page-template').html() );
		Readium.Views.PaginationViewBase.prototype.initialize.call(this);
		this.model.on("first_render_ready", this.render, this);
		this.model.on("change:two_up", this.setUpMode, this);
	},

	centerPage: function() {
		var that = this;

		var twoUpMultiplicator = this.model.get("two_up") ? 2 : 1;
		var metaWidth = this.model.get('meta_width') || this.model.get('content_width');
		var metaHeight = this.model.get('meta_height') || this.model.get('content_height');
		var elRatio = (this.el.offsetWidth / twoUpMultiplicator) / this.el.offsetHeight;
		var ratio = metaWidth / metaHeight;
		var preserveRatioWidth = this.el.offsetHeight * ratio;
		var preserveRatioHeight = this.el.offsetWidth / ratio;

		if (elRatio > ratio) {
			$('#page-wrap').width(preserveRatioWidth * twoUpMultiplicator)
				.css('left', (this.el.offsetWidth - preserveRatioWidth * twoUpMultiplicator) / 2)
				.css('top', 0).css('height', '100%');
		} else {
			$('#page-wrap').height(preserveRatioHeight / twoUpMultiplicator)
				.css('top', (this.el.offsetHeight - preserveRatioHeight / twoUpMultiplicator) / 2)
				.css('left', 0).css('width', '100%');
		}

		var oldScale = this.scale;
		var scale = this.scale = preserveRatioWidth / metaWidth;

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
			//console.log(this, scale, this.contentDocument.body.style);
		});

		this.fixScaleUp(301);

		this.viewType = 'zoom';
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
		script.src = "/static/lib/readium/scripts/web_overrides/iframe_inject.js";
		doc.getElementsByTagName("head")[0].appendChild(script);
	},

	render: function() {
		// add all the pages
		var that = this;
		var sections = this.model.getAllSections();
		$('body').addClass('apple-fixed-layout');
		this.setUpMode();

		$(window).on('resize', function(){
			that.applyViewType();
		});

		$(window).on('orientationchange', this.fixScaleUp);

		//this.$el.width(this.model.get("meta_width") * 2);
		//this.$el.height(this.model.get("meta_height"));

		for(var i = 0; i < sections.length; i++) {
			sections[i].page_num = i + 1;
			this.$('#container').append(this.page_template(sections[i]));
		}

		this.$('.content-sandbox').on("load", function(e) {
			// not sure why, on("load", this.applyBindings, this) was not working
			that.applyBindings( $(e.srcElement).contents() );
			that.injectHelperJS(this);
			that.applyScale(this, that.scale);
		});

		this.model.changPageNumber(i);
		setTimeout(function() {
			//$('#page-wrap').zoomAndScale(); //<= this was a little buggy last I checked but it is a super cool feature
		}, 10)
		return this.renderPages();
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

	renderPages: function() {

		// lost myself in the complexity here but this seems right
		this.changePage();
		this.model.goToFirstPage();
		return this;
	},

	changePage: function() {
		var that = this;
		var currentPage = this.model.get("current_page");
		var two_up = this.model.get("two_up");
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
