Readium.Views.FixedPaginationViewMobile = Readium.Views.FixedPaginationView.extend({
	/* Specialized View for displaying fixed-page EPUBs on mobile devices */
	scale : 1,

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
		var elWidth = this.el.offsetWidth;
		var elHeight = this.el.offsetHeight;
		var metaWidth = this.model.get('meta_width');
		var metaHeight = this.model.get('meta_height');
		var two_up = this.model.get("two_up");

		if (two_up) {
			var ratio = metaWidth * 2 / metaHeight;
		} else {
			var ratio = metaWidth / metaHeight;
		}
		var pageRatio = elWidth / elHeight;

		if (pageRatio > ratio) {
			var preserveRatioWidth = $('#page-wrap').height() * ratio;
			$('#page-wrap').width(preserveRatioWidth)
				.css('left', (elWidth - preserveRatioWidth) / 2)
				.css('top', 0).css('height', '100%');
		} else {
			var preserveRatioHeight = $('#page-wrap').width() / ratio;
			$('#page-wrap').height(preserveRatioHeight)
				.css('top', (elHeight - preserveRatioHeight) / 2)
				.css('left', 0).css('width', '100%');
		}

		var scale = this.scale = $('#page-wrap').width() / this.model.get('meta_width');

		$('.fixed-page-wrap iframe').each(function(i){
			that.applyScale(this, scale);
		});
	},

	applyScale: function(iframe, scale) {
		iframe.contentDocument.body.style.webkitTransform='scale(' + scale + ')';
		iframe.contentDocument.body.style.webkitTransformOrigin='0 0';
	},

	render: function() {
		// add all the pages
		var that = this;
		var sections = this.model.getAllSections();
		$('body').addClass('apple-fixed-layout');
		this.setUpMode();

		this.centerPage();
		$(window).on('resize', function(){
			that.centerPage(that);
		});

		//this.$el.width(this.model.get("meta_width") * 2);
		//this.$el.height(this.model.get("meta_height"));

		for(var i = 0; i < sections.length; i++) {
			sections[i].page_num = i + 1;
			this.$('#container').append(this.page_template(sections[i]));
		}

		this.$('.content-sandbox').on("load", function(e) {
			// not sure why, on("load", this.applyBindings, this) was not working
			that.applyBindings( $(e.srcElement).contents() );
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
