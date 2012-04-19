Readium.Models.EbookBase = Backbone.Model.extend({

	initialize: function() {
		var that = this;
		var url = this.get("package_doc_path");
		this.packageDocument = new Readium.Models.PackageDocument({
			url: url
		});
		this.packageDocument.on("change:spine_position", this.spinePositionChangedHandler, this);
		this.packageDocument.on("change:spine", function() {
			// TODO: restore location here
			that.packageDocument.set({spine_position: 0}, {silent: true});
			//that.packageDocument.trigger("change:spine_position");
			that.set("has_toc", (!!that.packageDocument.getTocItem() ) );
		});
		this.packageDocument.fetch({dataType: "xml"});
		this.on("change:num_pages", this.adjustCurrentPage, this);
	},

	defaults: {
		"font_size": 10,
    	"current_page": [1],
    	"num_pages": 0,
    	"two_up": false,
    	"full_screen": false,
    	"toolbar_visible": true,
    	"toc_visible": false
  	},

	toggleTwoUp: function() {
		var twoUp = this.get("two_up");
		var displayed = this.get("current_page");
		var newPages = [];
		if(twoUp) {
			if (displayed[0] === 0) {
				newPages[0] = 1;
			} else {
				newPages[0] = displayed[0];
			}
		}
		else if(displayed[0] % 2 === 0) {
			newPages[0] = displayed[0];
			newPages[1] = displayed[0] + 1;
		}
		else {
			newPages[0] = displayed[0] - 1;
			newPages[1] = displayed[0];
		}
		this.set({two_up: !twoUp, current_page: newPages});
	},

	toggleFullScreen: function() {
		var fullScreen = this.get("full_screen");
		this.set({full_screen: !fullScreen});
	},

	increaseFont: function() {
		var size = this.get("font_size");
		this.set({font_size: size + 1})
	},

	decreaseFont: function() {
		var size = this.get("font_size");
		this.set({font_size: size - 1})
	},

	toggleToc: function() {
		var vis = this.get("toc_visible");
		this.set("toc_visible", !vis);
	},
	
	prevPage: function() {

		var curr_pg = this.get("current_page");
		var lastPage = curr_pg[0] - 1;

		if(curr_pg[0] <= 1) {
			this.packageDocument.goToPrevSection();
		}
		else if(!this.get("two_up")){
			this.set("current_page", [lastPage]);
		}
		else {
			this.set("current_page", [lastPage - 1, lastPage]);
		}
	},
	
	nextPage: function() {
		var curr_pg = this.get("current_page");
		var firstPage =curr_pg[curr_pg.length-1] + 1;
		if (curr_pg[curr_pg.length-1] >= this.get("num_pages") ) {
			this.packageDocument.goToNextSection();
		}
		else if(!this.get("two_up")){
			return this.set("current_page", [firstPage]);
		}
		else {
			return this.set("current_page", [firstPage, firstPage+1]);
		}
	},
	
	goToFirstPage: function() {
		if( this.get("two_up") ) {
			this.set("current_page", [0,1])
		}
		else {
			this.set("current_page", [1]);
		} 
	},

	goToLastPage: function() {
		var page = this.get("num_pages");

		if( this.get("two_up") ) {
			this.set("current_page", [page-1, page])
		}
		else {
			this.set("current_page", [page])
		}
	},

	savePosition: function() {
		Readium.Utils.setCookie(_properties.key, _packageDocument.getPosition(), 365);
	},

	// TODO: do move this into package doc class (no sense it being here)
	resolvePath: function(path) {
		var suffix;
		var pack_doc_path = this.packageDocument.file_path;
		if(path.indexOf("../") === 0) {
			suffix = path.substr(3);
		}
		else {
			suffix = path;
		}
		var ind = pack_doc_path.lastIndexOf("/")
		return pack_doc_path.substr(0, ind) + "/" + suffix;
	},

	adjustCurrentPage: function() {
		var cp = this.get("current_page");
		var num = this.get("num_pages");
		var two_up = this.get("two_up")
		if(cp[cp.length - 1] > num) {
			this.goToLastPage();
		}
	},	
	
	goToNextSection: function() {
		// Is this check even necessary?
		// I think package doc validations takes care of it
		if(this.packageDocument.hasNextSection() ) {
			this.packageDocument.goToNextSection();	
		}
	},
	
	goToPrevSection: function() {
		// Is this check even necessary?
		// I think package doc validations takes care of it
		if(this.packageDocument.hasPrevSection() ) {
			this.packageDocument.goToPrevSection();		
		}
	},
	
	getSectionText: function(successCallback, failureCallback) {
		var path = this.packageDocument.currentSection();
		Readium.FileSystemApi(function(fs) {
			fs.readTextFile(resolvePath(path), successCallback, failureCallback);
		});
	},

	/* NOT USED?
	getAllSectionUris: function() {
		var temp = this.packageDocument.get("spine");
		for(var i = 0; i < temp.length; i++) {
			temp[i] = resolveUrl(temp[i]);
		}
		return temp;
	},
	*/

	goToHref: function(href) {
		this.packageDocument.goToHref(href);
	},

	changPageNumber: function(num) {
		var cp = this.get("current_page");
		var np = [];
		var diff = num - cp[cp.length - 1];
		if( diff > 0 ) {
			diff = 0;
		}
		for(var i = 0; i < cp.length; i++) {
			np[i] = cp[i] + diff;	
		}
		this.set({num_pages: num, current_page: np});
	},

	spinePositionChangedHandler: function() {
		var that = this;
		var sect = this.packageDocument.currentSection();
		var path = sect.get("href");
		var url = this.packageDocument.resolveUri(path);;
		path = this.resolvePath(path);
		this.set("current_section_url", url);
		$.ajax({
			url: path,
			accept: "xml",
			cache: true,
			success: function(res) {
				that.set("current_content", res);
			},
			error: function(err) {
				alert("Error: unable to fetch spine item");
				window.router.navigate("/", {silent: true});
			}
		});
		
	},

	getToc: function() {
		var item = this.packageDocument.getTocItem();
		if(!item) {
			return null;
		}
		else {
			var that = this;
			return Readium.Models.Toc.getToc(item, {
				file_path: that.resolvePath(item.get("href")),
				book: that
			});
		}
	},

	goToPage: function(page) {
		if(this.get("two_up")) {
			if(page % 2 === 0) {
				this.set("current_page", [page, page + 1]);	
			}
			else {
				this.set("current_page", [page - 1, page]);
			}
		}
		else {
			this.set("current_page", [page])
		}
	}
	
});


Readium.Models.ReflowableEbook = Readium.Models.EbookBase.extend({

	isFixedLayout: false,

	initialize: function() {
		// call the super ctor
		
		Readium.Models.EbookBase.prototype.initialize.call(this);

	},

	CreatePaginator: function() {
		// TODO do this properly later:

		var optionString = localStorage["READIUM_OPTIONS"];
    	var options = (optionString && JSON.parse(optionString) ) || {"singleton": {}};
    	if( options["singleton"]["paginate_everything"] ) {
    		return new Readium.Views.ReflowablePaginationView({model: this});	
    	} else {
    		return new Readium.Views.ScrollingPaginationView({model: this});		
    	}
		
	}

	

});

Readium.Models.AppleFixedEbook = Readium.Models.EbookBase.extend({

	isFixedLayout: true,

	defaults: {
		"font_size": 10,
    	"current_page":  [0, 1],
    	"num_pages": 0,
    	"two_up": false,
    	"full_screen": false,
    	"toolbar_visible": true
  	},

	initialize: function() {
		// call the super ctor
		Readium.Models.EbookBase.prototype.initialize.call(this);
		this.on("change:current_content", this.parseMetaTags, this);
	},

	CreatePaginator: function() {
		return new Readium.Views.FixedPaginationViewMobile({model: this});
	},

	buildSectionJSON: function(manifest_item) {
		var section = {};
		section.width = this.get("meta_width");
		section.height = this.get("meta_height");
		section.uri = this.packageDocument.resolveUri(manifest_item.get('href'));

		return section;
	},

	getAllSections: function() {
		var spine = this.packageDocument.getResolvedSpine();
		var sections = [];
		for(var i = 0; i < spine.length; i++) {
			sections.push(this.buildSectionJSON( spine[i] ));
		}
		return sections;
	},


	parseViewportTag: function(viewportTag) {
		// this is going to be ugly
		var str = viewportTag.getAttribute('content');
		str = str.replace(/\s/g, '');
		var valuePairs = str.split(',');
		var values = {};
		var pair;
		for(var i = 0; i < valuePairs.length; i++) {
			pair = valuePairs[i].split('=');
			if(pair.length === 2) {
				values[ pair[0] ] = pair[1];
			}
		}
		values['width'] = parseFloat(values['width']);
		values['height'] = parseFloat(values['height']);
		return values;
	},

	parseMetaTags: function() {
		var dom = this.get("current_content");
		if(typeof dom === "string") {
			var parser = new window.DOMParser();
			var dom = parser.parseFromString(dom, 'text/xml');	
		}
		
		var tag = $("meta[name]='viewport'", dom)[0];
		if(tag) {
			var pageSize = this.parseViewportTag(tag);
			this.set({meta_width: pageSize.width, meta_height: pageSize.height});
		}
		this.packageDocument.off("change:spine_position");
		this.off("current_content")
		this.trigger("first_render_ready")
	},

	spinePositionChangedHandler: function() {
		Readium.Models.EbookBase.prototype.spinePositionChangedHandler.call(this);
		this.goToPage(this.packageDocument.get("spine_position"));
		
	}

});
