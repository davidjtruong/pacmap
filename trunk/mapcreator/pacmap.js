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
        console.log('new GLatLng(' + map.getCenter().lat() + ', ' + map.getCenter().lng() + '), ' + map.getZoom());
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
        var MAX_CONCUR_FETCHES = 10;
        function getNextEdgeColor() {
            var r = Math.round(Math.random() * 0xbb);
            var g = Math.round(Math.random() * 0xbb);
            var b = Math.round(Math.random() * 0xbb);
            var hexstr = '000000' + (r << 16 | g << 8 | b).toString(16);
            return '#' + hexstr.substring(hexstr.length - 6);
        }
        
        /**
         * Creates a new edge with one node
         * @param {GStreetviewData} node
         */
        function Edge(node) {
            this.nodes = [node];
            this.line = null;
        }
        /**
         * Adds a node to the end of an edge.  Updates the array and polyline of the edge.
         * If this is the second node added to the edge, add it to the map
         * @param {GStreetviewData} node
         */
        Edge.prototype.push = function(node) {
            this.nodes.push(node);
            if (this.nodes.length === 2) {
                this.line = new GPolyline([this.nodes[0].latlng, this.nodes[1].latlng], getNextEdgeColor());
                map.addOverlay(this.line);
            } else {
                this.line.insertVertex(this.line.getVertexCount(), node.latlng);
            }
        }
        
        /**
         * Adds a node to the beginning of an edge.  Updates the array and polyline of the edge.
         * If this is the second node added to the edge, add it to the map
         * @param {GStreetviewData} node
         */
        Edge.prototype.unshift = function(node) {
            this.nodes.unshift(node);
            if (this.nodes.length === 2) {
                this.line = new GPolyline([this.nodes[0].latlng, this.nodes[1].latlng], getNextEdgeColor());
                map.addOverlay(this.line);
            } else {
                this.line.insertVertex(0, node.latlng);
            }
        }
        
        /**
         * @param {GStreetviewData} node
         * @return {Boolean} true if node is the first node on the edge, false otherwise
         */
        Edge.prototype.isFirst = function(node) {
            return (this.nodes[0] === node);
        }
        
        /**
         * @param {GStreetviewData} node
         * @return {Boolean} true if node is the first node on the edge, false otherwise
         */
        Edge.prototype.isLast = function(node) {
            return (this.nodes[this.nodes.length - 1] === node);
        }
        
        Edge.prototype.toString = function() {
            return 'Edge';
        }
        
        /**
         * Merges two edges by appending the shorter one the longer and removing
         * all references to the shorter edge.
         * @param {Edge} other
         * @param {int} frontOrBack
         * @param {GStreetviewData} linkNode
         * @return {Edge} the winning Edge
         */
        Edge.prototype.merge = function(other, frontOrBack, linkNode) {
            var winningEdge, losingEdge;
            if (this.nodes.length >= other.nodes.length) {
                winningEdge = this;
                losingEdge = other;
                if (frontOrBack === 2) { // need to add other's nodes to end of this one 
                    if (other.isLast(linkNode)) {
                        other.nodes.reverse();
                    } else if (!other.isFirst(linkNode)) {
                        console.log('other node is not first or last!');
                        return;
                    }
                    this.nodes = this.nodes.concat(other.nodes);
                } else if (frontOrBack === 1) { // we need to add other's nodes to the front of this one
                    if (other.isFirst(linkNode)) {
                        other.nodes.reverse();
                    } else if (!other.isLast(linkNode)) {
                        console.log('other node is not first or last!');
                        return;
                    }
                    this.nodes = other.nodes.concat(this.nodes);
                } else {
                    console.log('frontOrBack assertion fail during merge!');
                    return;
                }
            } else {
                winningEdge = other;
                losingEdge = this;
                if (other.isLast(linkNode)) { // need to add this's nodes to the end of the last one
                    if (frontOrBack === 2) {
                        this.nodes.reverse();
                    } else if (frontOrBack !== 1) {
                        console.log('frontOrBack !== 1');
                        return;
                    }
                    other.nodes = other.nodes.concat(this.nodes);
                } else if (other.isFirst(linkNode)) { // we need to add this's nodes to the front of this one
                    if (frontOrBack === 1) {
                        other.nodes.reverse();
                    } else if (frontOrBack !== 2) {
                        console.log('frontOrBack !== 2');
                        return;
                    }
                    other.nodes = this.nodes.concat(other.nodes);
                } else {
                    console.log('winning linknode is neither front nor back!');
                    return;
                }
            }
            map.removeOverlay(other.line);
            map.removeOverlay(this.line);
            winningEdge.line = new GPolyline($.map(winningEdge.nodes, function(node) {
                return node.latlng;
            }), getNextEdgeColor());
            map.addOverlay(winningEdge.line);
            for (var i = 0; i < losingEdge.nodes.length; i++) {
                var node = losingEdge.nodes[i];
                if (node.isEdge) {
                    node.edge = winningEdge;
                }
            }
            return winningEdge;
        }
        
        /**
         * Fetches up to MAX_CONCUR_FETCHES and curries the callback of getPanoramaById.
         */
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
                svClient.getPanoramaById(panoId, (function(fetchCurryParams) {
                    // hack for loop variable closure
                    return function(panoData) {
                        fetchedCallback(panoData, fetchCurryParams.parentNode, fetchCurryParams.addToEdge, fetchCurryParams.frontOrBack);
                    };
                })(fetchCurryParams));
            }
            if (currentlyFetching.length === 0 && toBeFetched.length === 0) {
                console.log(['done fetching, off map nodes:', offMapNodes]);
            }
        }
        
        /**
         *
         * @param {GStreetviewData} panoData
         * @param {GStreetviewData} parentNode the node that fetched this one, null if this is the first node
         * @param {Edge} addToEdge edge we should add this to
         * @param {int} frontOrBack 1 = front, 2 = back
         */
        function fetchedCallback(panoData, parentNode, addToEdge, frontOrBack) {
            if (panoData.code == 200) {
                var panoId = panoData.location.panoId;
                panoData.panoId = panoId; // copy panoId for faster access?
                var panoDataLatLng = panoData.location.latlng;
                panoData.latlng = panoDataLatLng;
                delete currentlyFetching[panoId];
                currentlyFetching.length--;
                nodeGraph[panoId] = panoData;
                if (frontOrBack === 2) { // adding to the end of the edge
                    addToEdge.push(panoData);
                } else if (frontOrBack === 1) { // adding to the front of the edge
                    addToEdge.unshift(panoData);
                } else if (frontOrBack === 4) { // the first node was an edge node, whoever returns first becomes the back
                    if (addToEdge.nodes.length === 1) { // we are the back (last index) of polyline
                        addToEdge.push(panoData);
                        frontOrBack = 2;
                    } else { // add to the front (first index of polyline)
                        addToEdge.unshift(panoData);
                        frontOrBack = 1;
                    }
                }
                var links = panoData.links;
                panoData.isEdge = (links.length === 2);
                if (panoData.isEdge) {
                    if (parentNode === null) { // this is the first node fetched
                        addToEdge = new Edge(panoData);
                        frontOrBack = 4; // the next nodes fetched have to add on both sides
                        console.log(['first node:', panoData, addToEdge])
                    }
                    panoData.edge = addToEdge;
                }
                panoData.isVertex = (links.length !== 2);
                if (mapBounds.containsLatLng(panoDataLatLng)) {
                    for (var i = 0; i < links.length; i++) {
                        var linkPanoId = links[i].panoId;
                        var linkNode = nodeGraph[linkPanoId];
                        if (linkNode === undefined &&
                        currentlyFetching[linkPanoId] === undefined &&
                        toBeFetched[linkPanoId] === undefined) {
                            var newFetch = {
                                'panoId': linkPanoId,
                                'parentNode': panoData
                            };
                            if (panoData.isVertex) {
                                newFetch.addToEdge = new Edge(panoData);
                                newFetch.frontOrBack = 2;
                            } else { // this is an edge
                                newFetch.addToEdge = addToEdge;
                                newFetch.frontOrBack = frontOrBack;
                            }
                            toBeFetched.push(newFetch);
                            toBeFetched[linkPanoId] = null;
                        } else if (linkNode !== undefined && linkPanoId !== parentNode.panoId) {
                            // this node is already fetched
                            if (panoData.isVertex) {
                                if (linkNode.isVertex) { // vertex to vertex = new line
                                    // TODO: add Edge here instead of just drawing
                                    /*console.log('vertex -> vertex');
                                    var m = new GMarker(panoDataLatLng);
                                    m.bindInfoWindowHtml('vertex -> vertex');
                                    map.addOverlay(m);*/
                                    map.addOverlay(new GPolyline([panoDataLatLng, linkNode.latlng], getNextEdgeColor()));
                                } else { // vertex to edge = edge draws line
                                    var linkEdge = linkNode.edge;
                                    /*console.log('vertex -> edge');
                                    var m = new GMarker(panoDataLatLng);
                                    m.bindInfoWindowHtml('vertex -> edge');
                                    map.addOverlay(m);*/
                                    if (linkEdge.isLast(linkNode)) {
                                        // linkNode is last vertex in edge, add to end
                                        linkEdge.push(panoData);
                                    } else if (linkEdge.isFirst(linkNode)) {
                                        // linkNode is the first vertex in the edge, add to beginning
                                        linkEdge.unshift(panoData);
                                    } else {
                                        console.log(['Error:not first or last vertex?', linkNode, linkEdge]);
                                    }
                                }
                            } else {
                                if (linkNode.isVertex) { // edge to vertex = continue line
                                    /*console.log('edge -> vertex');
                                    var m = new GMarker(panoDataLatLng);
                                    m.bindInfoWindowHtml('edge -> vertex');
                                    map.addOverlay(m);*/
                                    if (frontOrBack === 2) {
                                        addToEdge.push(linkNode);
                                    } else if (frontOrBack === 1) {
                                        addToEdge.unshift(linkNode);
                                    }
                                } else { // edge to edge
                                    /*console.log('edge -> edge');
                                    var m = new GMarker(panoDataLatLng);
                                    m.bindInfoWindowHtml('edge -> edge');
                                    map.addOverlay(m);*/
                                    // add the shorter edge to the longer edge and get rid of it
                                    addToEdge.merge(linkNode.edge, frontOrBack, linkNode);
                                }
                            }
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
                console.log(['panoData.code != 200:', panoData]);
            }
        }
        currentlyFetching[pacmanNode.location.panoId] = null;
        fetchedCallback(pacmanNode, null, undefined, undefined);
    });
}

// when the DOM is ready
$(function() {
    if (GBrowserIsCompatible()) {
        var map = new GMap2(document.getElementById("map"));
        map.setCenter(new GLatLng(37.43753769421951, -122.14468717575073), 17);
        map.setUIToDefault();
        map.enableContinuousZoom();
        map.enablePinchToZoom();
        map.enableGoogleBar();
        svOverlay = new GStreetviewOverlay();
        map.addOverlay(svOverlay);
        new PacmapCreator(map);
    }
});
