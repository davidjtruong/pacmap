function Pacmap(map) {

}

var map;
var svOverlay;
var svClient;
var nodeGraph = []; // hash of panoId's to svData objects

var fetchButton;
var infop;

// Google maps load function
function load() {
    if (GBrowserIsCompatible()) {
		map = new GMap2(document.getElementById("map"));
		map.setCenter(new GLatLng(37.4419, -122.1419), 16);
		map.addControl(new GLargeMapControl());
		map.addControl(new GScaleControl());
		map.addControl(new GMapTypeControl());
		map.enableScrollWheelZoom();
		map.setMapType(G_NORMAL_MAP);
		svOverlay = new GStreetviewOverlay();
        map.addOverlay(svOverlay);
		svClient = new GStreetviewClient();
		document.getElementById("placePacman").onclick = placePacman;
		document.getElementById("cycleStartDirection").onclick = cycleStartDirection;
		fetchButton = document.getElementById("startFetcher");
		fetchButton.onclick = startFetcher;
		infop = document.getElementById("info");
	}
}

var pacmanMarker;
var pacmanNode;
var pacmanLinkI;

// Drag pacman to a starting location
function placePacman() {    
    var center = map.getCenter();
    if (pacmanMarker !== undefined) {
        pacmanMarker.setLatLng(center);
        pacmanMarker.setImage("img/pacman-open-e_misplaced.png");
        pacmanMarker.enableDragging();
        GEvent.clearListeners(pacmanMarker, "dragstart");
        GEvent.clearListeners(pacmanMarker, "dragend");
    } else {
        var pacMisplacedIcon = new GIcon();
        pacMisplacedIcon.image = "img/pacman-open-e_misplaced.png";
        pacMisplacedIcon.iconSize = new GSize(40, 42);
        pacMisplacedIcon.iconAnchor = new GPoint(20, 21);
        pacMisplacedIcon.infoWindowAnchor = new GPoint(36, 24);
        pacMisplacedIcon.maxHeight = 0;
        pacmanMarker = new GMarker(center, {
            draggable: true,
            bouncy: false,
            icon: pacMisplacedIcon
        });
        map.addOverlay(pacmanMarker);
    }
    function invalidPacmanPlacement(msg) {
        pacmanMarker.setImage("img/pacman-open-e_misplaced.png");
        pacmanMarker.openInfoWindowHtml(msg);
    }
    function checkPacmanPlacement(latlng) {
        svClient.getNearestPanoramaLatLng(latlng, function(svLatLng) {
            if (svLatLng === null) {
                invalidPacmanPlacement("Drag me to a street");
            } else {
                pacmanMarker.setLatLng(svLatLng);
                svClient.getNearestPanorama(svLatLng, function(svData) {
                    if (svData.code == 200) {
                        if (svData.links.length === 0) {
                            invalidPacmanPlacement("I'm stuck!");
                        } else {
                            pacmanMarker.setImage(getPacImageFromYaw(svData.links[0].yaw));
                            pacmanNode = svData;
                            pacmanLinkI = 0;
                            var startId = svData.location.panoId;
                            nodeGraph[startId] = svData;
                        }
                    }
                    
                });
            }
        });
    }
    GEvent.addListener(pacmanMarker, "dragstart", function() {
        map.closeInfoWindow();
    });
    GEvent.addListener(pacmanMarker, "dragend", checkPacmanPlacement);
    checkPacmanPlacement(center);  
}

// Change pacman's starting direction
function cycleStartDirection() {
    if (pacmanNode) {
        pacmanLinkI++;
        if (pacmanLinkI == pacmanNode.links.length) {
            pacmanLinkI = 0;
        }
        pacmanMarker.setImage(getPacImageFromYaw(
                pacmanNode.links[pacmanLinkI].yaw));
    }
}

var MAX_CONCUR_FETCHES = 5;

var fetchDisplayTimer;
var toBeFetched; // queue of panoId's to be fetched
var currentlyFetching; // hash of panoId's currently being fetched
var stopFetching;
var edgeMarkers = [];

function fetchDisplay() {
    infop.textContent = currentlyFetching.length;
}

// start fetching GSV data
function startFetcher() {
    if (pacmanNode !== undefined) {
        stopFetching = false;
        fetchButton.textContent = "Stop Fetching Nodes";
        fetchButton.onclick = stopFetcher;
        toBeFetched = [];
        currentlyFetching = {length: 1};
        fetchDisplayTimer = setInterval(fetchDisplay, 200);
        fetchedCallback(pacmanNode);   
    }
}

// Stop fetching GSV data
function stopFetcher() {
    stopFetching = true;
    fetchDisplay();
    clearTimeout(fetchDisplayTimer);
    fetchButton.textContent = "Start Fetching Nodes";
    fetchButton.onclick = startFetcher;
}

function fetchedCallback(svData) {
    if (svData.code == 200) {
        var panoId = svData.location.panoId;
        currentlyFetching[panoId] = undefined;
        currentlyFetching.length--;
        var svDataLatLng = svData.location.latlng;
        if (map.getBounds().containsLatLng(svDataLatLng)) {
            nodeGraph[panoId] = svData;
            edgeMarkers[panoId] = new GMarker(svData.location.latlng, {
                clickable: false
            })
            map.addOverlay(edgeMarkers[panoId]);
            var links = svData.links;
            for (var i = 0; i < links.length; i++) {
                var linkPanoId = links[i].panoId;
                if (nodeGraph[linkPanoId] === undefined
                 && currentlyFetching[linkPanoId] === undefined
                 && toBeFetched[linkPanoId] === undefined) {
                    toBeFetched.push(linkPanoId);
                    toBeFetched[linkPanoId] = null;
                }/* else {
		       		map.removeOverlay(edgeMarkers[linkPanoId]);
		        	edgeMarkers.slice(linkPanoId, 1);
                }*/
            }
        }
        if (stopFetching) {
            return;
        }
        var toFetch = MAX_CONCUR_FETCHES - currentlyFetching.length;
        for (var j = 0; j < toFetch && toBeFetched.length > 0; j++) {
            var tPanoId = toBeFetched.shift();
            toBeFetched[tPanoId] = undefined;
            currentlyFetching.length++;
            currentlyFetching[tPanoId] = null;
            svClient.getPanoramaById(tPanoId, fetchedCallback);
        }
    } else {
        alert("ACK!!1");
        console.log(svData);
    }
}


// return an image of pacman with the correct orientation
function getPacImageFromYaw(yaw) {
    if (yaw < 22.5) {
        return 'img/pacman-open-n.png';
    }
    if (yaw < 67.5) {
        return 'img/pacman-open-ne.png';
    }
    if (yaw < 112.5) {
        return 'img/pacman-open-e.png';
    }
    if (yaw < 157.5) {
        return 'img/pacman-open-se.png';
    }
    if (yaw < 202.5) {
        return 'img/pacman-open-s.png';
    }
    if (yaw < 247.5) {
        return 'img/pacman-open-sw.png';
    }
    if (yaw < 292.5) {
        return 'img/pacman-open-w.png';
    }
    if (yaw < 337.5) {
        return 'img/pacman-open-nw.png';
    }
    return 'img/pacman-open-n.png';
}

// finds the diffence between two yaw angles (note: always less than 180)
function yawDiff(yaw1, yaw2) {
    return Math.min(Math.abs(yaw1 - yaw2), Math.abs(yaw2 - yaw1));
}

// Keyboard controls
var leftdown = false;
var rightdown = false;
var updown = false;
var downdown = false;

// left
shortcut.add("A", function () {
	leftdown = true;
}, {'type':'keydown', 'keycode':65});

shortcut.add("A", function () {
	leftdown = false;
}, {'type':'keyup', 'keycode':65});

// right
shortcut.add("D", function () {
	rightdown = true;
}, {'type':'keydown', 'keycode':68});

shortcut.add("D", function () {
	rightdown = false;
}, {'type':'keyup', 'keycode':68});

// up
shortcut.add("W", function () {
	updown = true;
}, {'type':'keydown', 'keycode':87});

shortcut.add("W", function () {
	updown = false;
}, {'type':'keyup', 'keycode':87});

// down
shortcut.add("S", function () {
	downdown = true;
}, {'type':'keydown', 'keycode':83});

shortcut.add("S", function () {
	downdown = false;
}, {'type':'keyup', 'keycode':83});
/*
// space
shortcut.add("Space", function () {
	if (!gametimer) {
		if (stillPrecaching) {
		    stillPrecaching = false;
		} else {
		    gameStart();
		} 
	} else {
		$("#running").text("Stopped");
		clearTimeout(gametimer);
		gametimer = null;
	}
});*/

var gametimer;
var isUpdatingNode = false;

function gameStart() {
    /*PacGSVData = startNode;
    cPacGSVLink = startNode.links[0];
    setPacImageFromYaw(cPacGSVLink.yaw);
    cPacMarker = new GMarker(startNode.location.latlng, {
            icon: iPacN,
            clickable: false
    });
    map.addOverlay(cPacMarker);
    //cPacMarker.setImage(cPacYawImg);*/
    isUpdatingNode = false;
    gametimer = setInterval(gameUpdate, 150);
}

var pacMoveCount = 0;
var pacIsClosed = false;

// One frame of the game
function gameUpdate() {
    if (pacIsClosed) {
        pacmanMarker.setImage(getPacImageFromYaw(0,0));
    } else {
        pacmanMarker.setImage("img/pacman-closed.png");
    }
    pacIsClosed = !pacIsClosed;
    if (++pacMoveCount >= 1) {
        pacMoveCount = 0;
        if (isUpdatingNode) {
            return;
        }           
        isUpdatingNode = true;
        movePacman();
    }
    /*if (++ghostGetDirCount >= 20) {
        GDirBlue.loadFromWaypoints([blue.getLatLng(), cPacMarker.getLatLng()]);
    }*/
}

function movePacman() {
    var gsvData = nodeGraph[pacmanNode.links[pacmanLinkI].panoId];
    if (gsvData === undefined)
    	return;
    //console.log(gsvData);
    var cPacYaw = pacmanNode.links[pacmanLinkI].yaw;
    var buttonPressed = true;
    if (updown) {
        if (leftdown) {
            cPacYaw = 315;
        } else if (rightdown) {
            cPacYaw = 45;
        } else {
            cPacYaw = 0;
        }
    } else if (downdown) {
        if (leftdown) {
            cPacYaw = 225;
        } else if (rightdown) {
            cPacYaw = 135;
        } else {
            cPacYaw = 180;
        }
    } else if (leftdown) {
        cPacYaw = 270;
    } else if (rightdown) {
        cPacYaw = 90;
    } else {
        buttonPressed = false;
    }
    
    while (true) {
        // find the link that is in the closest direction as the user wants to go
        minYawDiff = yawDiff(cPacYaw, gsvData.links[0].yaw);
        minYawI = 0;
        for (var i = 1; i < gsvData.links.length; i++) {
            myd = yawDiff(cPacYaw, gsvData.links[i].yaw);
            if (myd < minYawDiff) {
                minYawDiff = myd;
                minYawI = i;
            }
        }
        if (buttonPressed && minYawDiff > 75) {
            cPacYaw = pacmanNode.links[pacmanLinkI].yaw;
            buttonPressed = false;
        } else {
            break;
        }
    }
    pacmanNode = gsvData;
    pacmanLinkI = minYawI;
    if (nodeGraph[pacmanNode.links[pacmanLinkI].panoId] === undefined) {
        toBeFetched.unshift(gsvData);
    }
    getPacImageFromYaw(pacmanLinkI.yaw);
    pacmanMarker.setLatLng(gsvData.location.latlng);
    isUpdatingNode = false;
    //expandCachedNodes(moveCallback);
    /*if (findCloseDots()) {
        score += 10;
        $("#score").text(score);
    }
        */    
}

function moveCallback() {
    isUpdatingNode = false;
}
