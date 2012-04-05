// test if the CSS regions support is enabled
// http://dev.w3.org/csswg/css3-regions/

Modernizr.addTest( "cssregions",function(){
	// ugly hack because current Chrome (20.0.1091.0 canary) returns a false positive
	if ($.browser.webkit && $.browser.version === '536.6') {
		return false
	}
  return Modernizr.testAllProps("flow-into");
});