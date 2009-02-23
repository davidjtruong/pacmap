
function placeGhosts() {
	var sw = map.getBounds().getSouthWest();
	var ne = map.getBounds().getNorthEast();
	var loc1 = new GLatLng(Math.abs(sw.lat() - ne.lat()) / 4 + sw.lat(), Math.abs(sw.lng() - ne.lng()) / 4 + sw.lng());
	GSviewClient.getNearestPanoramaLatLng(loc1, function (pos) {
		blue = new GMarker(pos, {icon:blueIc});
		map.addOverlay(blue);
	});
	var loc2 = new GLatLng(Math.abs(sw.lat() - ne.lat()) * 3 / 4 + sw.lat(), Math.abs(sw.lng() - ne.lng()) * 3 / 4 + sw.lng());
	GSviewClient.getNearestPanoramaLatLng(loc2, function (pos) {
		orange = new GMarker(pos, {icon:orangeIc});
		map.addOverlay(orange);
	});
	var loc3 = new GLatLng(Math.abs(sw.lat() - ne.lat()) / 4 + sw.lat(), Math.abs(sw.lng() - ne.lng()) * 3 / 4 + sw.lng());
	GSviewClient.getNearestPanoramaLatLng(loc3, function (pos) {
		console.log(pos);
		red = new GMarker(pos, {icon:redIc});
		map.addOverlay(red);
	});
	var loc4 = new GLatLng(Math.abs(sw.lat() - ne.lat()) * 3 / 4 + sw.lat(), Math.abs(sw.lng() - ne.lng()) / 4 + sw.lng());
	GSviewClient.getNearestPanoramaLatLng(loc4, function (pos) {
		pink = new GMarker(pos, {icon:pinkIc});
		map.addOverlay(pink);
	});
	//console.log(blueGhost);
	//console.log(red);
	//console.log(orange);
	//console.log(pink);
}

// draws a dot at a GLatLng
function drawDot(loc) {
    var result = new GMarker(loc, {
            icon: iDotSmall,
            clickable: false
    });
	map.addOverlay(result);
	return result;
}

// removes a specified dot
function removeDot(dot) {
	map.removeOverlay(dot);
}

var divs = 7;

// place dots for a new game
function placeDots(sw, ne, callback) {
	var dLat = Math.abs(ne.lat() - sw.lat()) / divs;
	var dLng = Math.abs(ne.lng() - sw.lng()) / divs;
	var totalDots = 0;
	function getDot(i, j) {
		var loc = new GLatLng(sw.lat() + i * dLat, sw.lng() + j * dLng);
		//alert("loc: " + loc);
		GSviewClient.getNearestPanoramaLatLng(loc, function (pos) {
			if (pos) {
				//console.log(pos);
				//alert("pos: " + pos);
				var dot = drawDot(pos);
				dots[totalDots] = dot;
				totalDots++;
			}
			setTimeout(function () {
				if (j == divs) {
					if (i < divs) {
						getDot(i + 1, 0, callback);
					} else {
					    setTimeout(callback, 0);
					}
				} else {
					getDot(i, j + 1, callback);
				}
			}, 0);
		});
		
		/*geocoder.getLocations((loc), 
			function (response) {
				if (response.Placemark) {
					var dot = drawDot(new GLatLng(response.Placemark[0].Point.coordinates[1], response.Placemark[0].Point.coordinates[0]));
					dots[totalDots] = dot;
					totalDots++;
				}
				setTimeout(function () {
					if (j == divs) {
						if (i < divs) {
							getDot(i + 1, 0);
						}
					} else {
						getDot(i, j + 1);
					}
				}, 10);
		});*/
	}
	getDot(0, 0, callback);
}

// finds adjacent dots to eat
function findCloseDots() {
	var pacLoc = cPacGSVData.location.latlng;
	for (var i = 0; i < dots.length; i++) {
	    var dot = dots[i];
		if (dot) {
			if (dot.getLatLng().distanceFrom(pacLoc) < 10) {
				map.removeOverlay(dot);
				dots.splice(i, 1);
				return true;
			}
		}
	}
	return false;
}

// erase all dots
function resetDots() {
	for (var i = 0; i < dots.length; i++) {
		if (dots[i]) {
			map.removeOverlay(dots[i]);
		}
	}
	dots = [];
}
