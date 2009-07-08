function PacmapCreator(map) {
    var svClient = new GStreetviewClient();
    var pacmanNode;
    var pacmanMarker;
    var pacmanIcon = new GIcon();
    pacmanIcon.shadow = null;
    pacmanIcon.iconSize = new GSize(40, 40);
    pacmanIcon.shadowSize = null;
    pacmanIcon.iconAnchor = new GPoint(20, 20);
    pacmanIcon.maxHeight = 0;
    pacmanIcon.dragCrossImage = '';
    pacmanIcon.dragCrossSize = null;
    pacmanIcon.dragCrossAnchor = null;
    pacmanIcon.image = 'newimg/pacman_misplaced.png';
    var pacmanImgs30 = [];
    var pacmanImgs45 = [];
    (function buildImgStrings() {
        var cardinals = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];
        for (var i = 0; i < cardinals.length; i++) {
            pacmanImgs30[i] = 'newimg/pacman_' + cardinals[i] + '_30.png';
            pacmanImgs45[i] = 'newimg/pacman_' + cardinals[i] + '_45.png';
        }
    })();
    $(document.getElementById('mapSizeSelect')).change(function() {
        var dims = this.value.split("x");
        var mapContainer = map.getContainer();
        mapContainer.style.width = dims[0] + "px";
        mapContainer.style.height = dims[1] + "px";
        map.checkResize();
    });
    $(document.getElementById('lockMapButton')).click(function() {
        map.disableDragging();
        map.disableDoubleClickZoom();
        map.disableContinuousZoom();
        map.disableGoogleBar();
        map.disableScrollWheelZoom();
        map.disablePinchToZoom();
        map.hideControls();
        this.textContent = 'Click to Place Pacman';
        this.disabled = true;
        pacmanMarker = new GMarker(map.getCenter(), {
            'icon': pacmanIcon,
            'title': 'pacman',
            'clickable': false,
            'draggable': false,
            'bouncy': false,
            'autoPan': false,
            'hide': true
        });
        map.addOverlay(pacmanMarker);
        GEvent.addListener(map, 'click', function(overlay, latlng) {
            pacmanMarker.setLatLng(latlng);
            pacmanMarker.setImage('newimg/pacman_misplaced.png');
            pacmanMarker.show();
            svClient.getNearestPanorama(latlng, function(panoData) {
                console.log(panoData);
                if (panoData.code === 200) {
                    pacmanMarker.setLatLng(panoData.location.latlng);
                    pacmanMarker.setImage(pacmanImgs30[Math.round(panoData.links[0].yaw * 8 / 360.0)]);
                    pacmanNode = panoData;
                }
            });
        });
    });
    $(document.getElementById('buildNodeGraphButton')).click(function() {
        var mapBounds = map.getBounds();
        var nodeGraph = {};
        var offMapNodes = [];
        var toBeFetched = [];
        var currentlyFetching = {
            'length': 1
        };
        var edgeLines = {};
        var stopFetching = false;
        var MAX_CONCUR_FETCHES = 5;
        function getNextEdgeColor() {
            var hexstr = '000000' + Math.round(Math.random() * 0xffffff).toString(16);
            return '#' + hexstr.substring(hexstr.length - 6);
        }
        function fetch() {
            if (stopFetching) {
                return;
            }
            var numToFetch = MAX_CONCUR_FETCHES - currentlyFetching.length;
            for (var j = 0; j < numToFetch && toBeFetched.length > 0; j++) {
                var fetchCurryParams = toBeFetched.shift();
                var panoId = fetchCurryParams.panoId;
                delete toBeFetched[panoId];
                currentlyFetching.length++;
                currentlyFetching[panoId] = null;
                svClient.getPanoramaById(panoId, (function() {
                    // hack for loop variable closure
                    return function(panoData) {
                        fetchedCallback(panoData, fetchCurryParams.parentNode, fetchCurryParams.addToLine, fetchCurryParams.frontOrBack);
                    };
                })());
            }
            if (currentlyFetching.length === 0 && toBeFetched.length === 0) {
                alert('done fetching!');
                console.log(offMapNodes);
            }
        }
        /**
         *
         * @param {GStreetviewData} panoData
         * @param {GStreetviewData} parentNode the node that fetched this one, null if this is the first node
         * @param {GPolyline} addToLine can also be GLatLng if there's only one point in the polyline (frontOrBack = 3)
         * @param {int} frontOrBack 1 = front, 2 = back
         */
        function fetchedCallback(panoData, parentNode, addToLine, frontOrBack) {
            if (panoData.code == 200) {
                var panoId = panoData.location.panoId;
                panoData.panoId = panoId; // copy panoId for faster access?
                var panoDataLatLng = panoData.location.latlng;
                panoData.latlng = panoDataLatLng;
                delete currentlyFetching[panoId];
                currentlyFetching.length--;
                nodeGraph[panoId] = panoData;
                if (frontOrBack === 2) { // adding to the end of the polyline
                    addToLine.insertVertex(addToLine.getLength(), panoDataLatLng);
                } else if (frontOrBack === 3) { // addToLine is just a GLatLng, create a new GPolyline
                    addToLine = new GPolyline([addToLine, panoDataLatLng], getNextEdgeColor());
                    map.addOverlay(addToLine);
                    frontOrBack = 2;
                } else if (frontOrBack === 1) { // adding to the front of this polyline (index 0)
                    addToLine.insertVertex(0, panoDataLatLng);
                } else if (frontOrBack === 4) { // the first node was an edge node, whoever returns first becomes the back
                    console.log(['second child:', parentNode, parentNode.polyline]);
                    if (parentNode.polyline === undefined) { // we are the back of polyline
                        addToLine = new GPolyline([addToLine, panoDataLatLng], getNextEdgeColor());
                        parentNode.polyline = addToLine;
                        map.addOverlay(addToLine);
                        frontOrBack = 2;
                    } else { // add to the front
                        addToLine = parentNode.polyline;
                        addToLine.insertVertex(0, panoDataLatLng);
                        frontOrBack = 1;
                    }
                }
                var links = panoData.links;
                panoData.isEdge = (links.length === 2);
                panoData.isVertex = (links.length !== 2);
                if (mapBounds.containsLatLng(panoDataLatLng)) {
                    for (var i = 0; i < links.length; i++) {
                        var linkPanoId = links[i].panoId;
                        if (nodeGraph[linkPanoId] === undefined &&
                        currentlyFetching[linkPanoId] === undefined &&
                        toBeFetched[linkPanoId] === undefined) {
                            var newFetch = {
                                'panoId': linkPanoId,
                                'parentNode': panoData
                            };
                            if (panoData.isVertex) {
                                newFetch.addToLine = panoDataLatLng;
                                newFetch.frontOrBack = 3;
                            } else if (parentNode === null) { // this is the first node and an edge
                                newFetch.addToLine = panoDataLatLng;
                                newFetch.frontOrBack = 4;
                            } else {
                                newFetch.addToLine = addToLine;
                                newFetch.frontOrBack = frontOrBack;
                            }
                            toBeFetched.push(newFetch);
                            toBeFetched[linkPanoId] = null;
                        }
                    }
                } else {
                    offMapNodes[panoId] = panoData;
                    offMapNodes.push(panoData);
                    map.addOverlay(new GMarker(panoDataLatLng, {
                        clickable: false
                    }));
                }
                fetch();
            } else {
                alert("ACK!!1: panoData.code != 200");
                console.log(panoData);
            }
        }
        currentlyFetching[pacmanNode.location.panoId] = null;
        fetchedCallback(pacmanNode, null);
    });
}

// when the DOM is ready
$(function() {
    if (GBrowserIsCompatible()) {
        var map = new GMap2(document.getElementById("map"));
        map.setCenter(new GLatLng(37.4419, -122.1419), 16);
        map.setUIToDefault();
        map.enableContinuousZoom();
        map.enablePinchToZoom();
        map.enableGoogleBar();
        svOverlay = new GStreetviewOverlay();
        map.addOverlay(svOverlay);
        new PacmapCreator(map);
    }
});
