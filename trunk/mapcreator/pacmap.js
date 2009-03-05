function Pacmap(map) {

}

var map;
var svOverlay;
var svClient;
var nodeGraph = []; // hash of panoId's to svData objects

var fetchButton;
var infop;

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
var pacmanStartNode;
var pacmanStartLinkI;

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
                            pacmanStartNode = svData;
                            pacmanStartLinkI = 0;
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

function cycleStartDirection() {
    if (pacmanStartNode) {
        pacmanStartLinkI++;
        if (pacmanStartLinkI == pacmanStartNode.links.length) {
            pacmanStartLinkI = 0;
        }
        pacmanMarker.setImage(getPacImageFromYaw(
                pacmanStartNode.links[pacmanStartLinkI].yaw));
    }
}

var MAX_CONCUR_FETCHES = 5;

var fetchDisplayTimer;
var toBeFetched; // queue of panoId's to be fetched
var currentlyFetching; // hash of panoId's currently being fetched
var stopFetching;

function fetchDisplay() {
    infop.textContent = currentlyFetching.length;
}

function startFetcher() {
    if (pacmanStartNode !== undefined) {
        stopFetching = false;
        fetchButton.textContent = "Stop Fetching Nodes";
        fetchButton.onclick = stopFetcher;
        toBeFetched = [];
        currentlyFetching = {length: 1};
        fetchDisplayTimer = setInterval(fetchDisplay, 200);
        fetchedCallback(pacmanStartNode);   
    }
}

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
            map.addOverlay(new GMarker(svData.location.latlng, {
                clickable: false
            }));
            var links = svData.links;
            for (var i = 0; i < links.length; i++) {
                var linkPanoId = links[i].panoId;
                if (nodeGraph[linkPanoId] === undefined
                 && currentlyFetching[linkPanoId] === undefined
                 && toBeFetched[linkPanoId] === undefined) {
                    toBeFetched.push(linkPanoId);
                    toBeFetched[linkPanoId] = null;
                }
            }
        }
        if (stopFetching) {
            return;
        }
        var toFetch = MAX_CONCUR_FETCHES - currentlyFetching.length;
        for (var i = 0; i < toFetch && toBeFetched.length > 0; i++) {
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
