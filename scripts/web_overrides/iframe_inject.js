function passAndPrevent(event) {
	var e = parent.document.querySelector('iframe[src="' + document.location.pathname + '"]').parentNode.dispatchEvent(event);
	event.preventDefault();
}

document.ontouchstart = passAndPrevent;
document.ontouchend = passAndPrevent;
document.ontouchcancel = passAndPrevent;
document.ontouchleave = passAndPrevent;
document.ontouchmove = passAndPrevent;