if( !window.Readium ) {
	window.Readium = {
		Models: {},
		Collections: {},
		Views: {},
		Routers: {},
		Utils: {}
	};
}

Readium.Views.PaginationViewBase = Backbone.View.extend({

	el: "#readium-book-view-el",
	renderToLastPage: false,

	initialize: function(options) {
		this.model.on("change:current_page", this.changePage, this);
		this.model.on("change:font_size", this.setFontSize, this);
		this.bindingTemplate = _.template( $('#binding-template').html() );
		
		// TODO: should I break layers here or pass through?
		this.model.packageDocument.on("increased:spine_position", function() {
			this.renderToLastPage = false;
		}, this);
		this.model.packageDocument.on("decreased:spine_position", function() {
			this.renderToLastPage = true;
		}, this);		
	},

	linkClickHandler: function(e) {
		e.preventDefault();

		var href = e.srcElement.attributes["href"].value;
		if(href.match(/^http(s)?:/)) {
			chrome.tabs.create({"url": href});
		} else {
			this.model.goToHref(href);
		}
	},

	getBindings: function() {
		var packDoc = this.model.packageDocument;
		var bindings = packDoc.get('bindings');
		return bindings.map(function(binding) {
			binding.selector = 'object[type="' + binding.media_type + '"]';
			binding.url = packDoc.getManifestItemById(binding.handler).get('href');
			binding.url = packDoc.resolveUri(binding.url);
			return binding;
		})
	},

	applyBindings: function(dom) {
		var that = this;
		var bindings = this.getBindings();
		var i = 0;
		for(var i = 0; i < bindings.length; i++) {
			$(bindings[i].selector, dom).each(function() {
				var params = [];
				var $el = $(this);
				var data = $el.attr('data');
				var url;
				params.push("src=" + that.model.packageDocument.resolveUri(data));
				params.push('type=' + bindings[i].media_type);
				url = bindings[i].url + "?" + params.join('&');
				var content = $(that.bindingTemplate({}));
				// must set src attr separately
				content.attr('src', url);
				$el.html(content);
			});
		}
	},

	addStyleSheets: function(bookDom) {
		var link; var href; var $link; var links;
		
		// first remove anything we already put up there
		$('.readium-dynamic-sh').remove();

		// TODO USE jQUERY for this (bug reported and fixed in master)
		$($("link", bookDom).get().reverse()).each(function(){
			link = this;
			if(typeof link.rel === "string" && link.rel.toUpperCase() === "STYLESHEET") {
				$link = $(link);
				$link.addClass('readium-dynamic-sh');
				$('head').prepend($link);
			}
		});
	},

	setUpMode: function() {
		var two_up = this.model.get("two_up");
		this.$el.toggleClass("two-up", two_up);
		this.$('#spine-divider').toggle(two_up);
	},

	// this doesn't seem to be working...
	events: {

		"click #page-margin": function(e) {
			this.trigger("toggle_ui");
		},
		

		"click #readium-content-container a": function(e) {
			this.linkClickHandler(e);
		}
	},

	isPageVisible: function(pageNum, currentPages) {
		
		return currentPages.indexOf(pageNum) !== -1;
		
	},

	changePage: function() {
		var that = this;
		var currentPage = this.model.get("current_page");
		var two_up = this.model.get("two_up")
		this.$(".page-wrap").each(function(index) {
			if(!two_up) { 
				index += 1;
			}
			$(this).toggleClass("hidden-page", !that.isPageVisible(index, currentPage));
		});
	},

	appendContent: function(content) {
		alert('not implemented yet')
	},
	
	replaceContent: function(content) {
		// TODO: put this where it belongs
		this.$('#readium-content-container').
			css('visibility', 'hidden').
			html(content + "<div id='content-end'></div>");
		_contentEnd = $('#content-end');
	},

	toggleTwoUp: function() {
		
		//this.render();
	},

	setFontSize: function() {
		var size = this.model.get("font_size") / 10;
		$('#readium-content-container').css("font-size", size + "em");
		this.renderPages();
	},

        injectMathJax: function (iframe) {
          var doc = iframe.contentDocument;
          var script = doc.createElement("script");
          script.type = "text/javascript";
          script.src = MathJax.Hub.config.root+"/MathJax.js?config=readium-iframe";
          doc.getElementsByTagName("head")[0].appendChild(script);
        }
	
});


Readium.Views.ScrollingPaginationView = Readium.Views.PaginationViewBase.extend({

	initialize: function() {
		// call the super ctor
		Readium.Views.PaginationViewBase.prototype.initialize.call(this);
		this.page_template = _.template( $('#scrolling-page-template').html() );
		this.model.on("change:current_section_url", this.render, this);
	},

	render: function() {
		var that = this;
		var uri = this.model.get("current_section_url");
		this.$('#container').html( this.page_template({uri: uri}) );
		this.$('.content-sandbox').on("load", function(e) {
			// not sure why, on("load", this.applyBindings, this) was not working
			that.applyBindings( $(e.srcElement).contents() );
            that.injectMathJax(e.srcElement);
            that.injectLinkHandler(e.srcElement);
		});
		return this;
	},

	injectLinkHandler: function (iframe) {
        var doc = iframe.contentDocument;
		$("a", doc).click(this.linkClickHandler);
	}

});

Readium.Views.ReflowablePaginationView = Readium.Views.PaginationViewBase.extend({

	initialize: function() {
		// call the super ctor
		Readium.Views.PaginationViewBase.prototype.initialize.call(this);

		this.page_template = _.template( $('#reflowing-page-template').html() );
		
		this.model.on("repagination_event", this.renderPages, this);
		this.model.on("change:current_content", this.render, this);
		this.model.on("change:two_up", this.renderPages, this);

	},

	render: function() {
		var htmlText = this.model.get("current_content");
		var parser = new window.DOMParser();
		var dom = parser.parseFromString( htmlText, 'text/xml' );
		this.addStyleSheets( dom );
		this.applyBindings( dom );
		this.replaceContent( dom.body.innerHTML );
		// need to add one page for calculation to work (TODO: this can be fixed)
		this.$('#container').html( this.page_template({page_num: 1, empty: false}) );
		
		// we need to let the stylesheets be parsed (TODO use an event?)
		var that = this;
		MathJax.Hub.Queue(
            ["Delay",MathJax.Callback,8], // delay to let CSS parse
            ["Typeset",MathJax.Hub],      // typeset any mathematics
        	function() {
				that.renderPages();
				that.toggleTwoUp();
				if(that.renderToLastPage) {
					that.model.goToLastPage();
				}
				else {
					that.model.goToFirstPage();
				}
        	}
		);
		
		return this;
	},

	guessPageNumber: function() {
		
		var quotient;
		quotient = $('#readium-content-container').height() / $('.page').first().height();
		if(quotient < 1) {
			return 1;
		}
		return Math.ceil(quotient);
	},

	needsMorePages: function() {
		// this should be part of the regions API but last I checked it wasn't there yet
		// for now we just check if content bottom is lower than page bottom
		var getBotHelper = function( $elem ) {
			return $elem.outerHeight(true) + $elem.offset().top;
		};
		
		var pageEnd = getBotHelper( this.$('.page').last() );
		var contEnd = getBotHelper( $('#content-end') );
		return pageEnd < contEnd;
		return false;
	},

	renderPages: function() {
		var i; var html; var num;
		var two_up = this.model.get("two_up");
		num = this.guessPageNumber();
		html = "";

		this.setUpMode();
		
		
		// start with an empty page in two up mode
		if(two_up) {
			html += this.page_template({page_num: 0, empty: true})
		}

		// added the guessed number of pages
		for( i = 1; i <= num; i++) {
			html += this.page_template({page_num: i, empty: false});
		}
		this.$('#container').html( html );

		// now touch it up
		while( this.needsMorePages() ) {
			this.$('#container').append( this.page_template({page_num: i, empty: false}) )
			i += 1;
		}
		
		if(two_up && num % 2 === 0) {
			num += 1;
			this.$('#container').append( this.page_template({page_num: i, empty: false}) );
		}

		
		this.model.changPageNumber(num);
		this.$('#readium-content-container').
			css('visibility', 'visible');

		// css-regions polyfill
		if (!Modernizr.cssregions) {
			$("#readium-content-container").regions(".page");
		}

		// dunno that I should be calling this explicitly
		this.changePage();
	},

	

	// decide if should open in two up based on viewport
	// width
	/*
	var shouldOpenInTwoUp = function() {
		var width = document.documentElement.clientWidth;
		var height = document.documentElement.clientHeight;
		return width > 300 && width / height > 1.3;
	}
*/
});

Readium.Views.FixedPaginationView = Readium.Views.PaginationViewBase.extend({

	initialize: function() {
		// call the super ctor
		this.page_template = _.template( $('#fixed-page-template').html() );
		this.empty_template = _.template( $('#empty-fixed-page-template').html() );
		Readium.Views.PaginationViewBase.prototype.initialize.call(this);
		this.model.on("first_render_ready", this.render, this);
		this.model.on("change:two_up", this.setUpMode, this);
	},

	render: function() {
		// add all the pages
		var sections = this.model.getAllSections();
		$('body').addClass('apple-fixed-layout');
		this.setUpMode();
		this.$el.width(this.model.get("meta_width") * 2);
		this.$el.height(this.model.get("meta_height"));
		
		for(var i = 0; i < sections.length; i++) {
			sections[i].page_num = i + 1;
			this.$('#container').append(this.page_template(sections[i]));
		}
		var that = this;
		this.$('.content-sandbox').on("load", function(e) {
			// not sure why, on("load", this.applyBindings, this) was not working
			that.applyBindings( $(e.srcElement).contents() );
		});
		this.model.changPageNumber(i);
		setTimeout(function() {
			$('#page-wrap').zoomAndScale(); //<= this was a little buggy last I checked but it is a super cool feature
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
		return this;
	},

	changePage: function() {
		var that = this;
		var currentPage = this.model.get("current_page");
		var two_up = this.model.get("two_up")
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
			
		