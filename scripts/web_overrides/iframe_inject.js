function passAndPrevent(event) {
	parent.document.dispatchEvent(event);
	event.preventDefault();
}

document.ontouchstart = passAndPrevent;
document.ontouchend = passAndPrevent;
document.ontouchcancel = passAndPrevent;
document.ontouchleave = passAndPrevent;
document.ontouchmove = passAndPrevent;