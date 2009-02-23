// requires jquery
var updown = false;
var rightdown = false;
var leftdown = false;
var downdown = false;
var gametimer = null;
var keycodediv, keytextarea;
var cPacMarker;
var cPacGSVData, cPacGSVLink;
var cPacYawImg;
var linklookuplock = false;
var pacImgSwitchCount;
var concurReq;
var score;

// finds the diffence between two yaw angles (note: always less than 180)
function yawDiff(yaw1, yaw2) {
    return Math.min(Math.abs(yaw1 - yaw2), Math.abs(yaw2 - yaw1));
}

function setPacImageFromYaw(yaw) {
    if (yaw < 22.5) {
        cPacYawImg = 'pacman_img/pacman-open-n.png';
        return;
    }
    if (yaw < 67.5) {
        cPacYawImg = 'pacman_img/pacman-open-ne.png';
        return;
    }
    if (yaw < 112.5) {
        cPacYawImg = 'pacman_img/pacman-open-e.png';
        return;
    }
    if (yaw < 157.5) {
        cPacYawImg = 'pacman_img/pacman-open-se.png';
        return;
    }
    if (yaw < 202.5) {
        cPacYawImg = 'pacman_img/pacman-open-s.png';
        return;
    }
    if (yaw < 247.5) {
        cPacYawImg = 'pacman_img/pacman-open-sw.png';
        return;
    }
    if (yaw < 292.5) {
        cPacYawImg = 'pacman_img/pacman-open-w.png';
        return;
    }
    if (yaw < 337.5) {
        cPacYawImg = 'pacman_img/pacman-open-nw.png';
        return;
    }
    cPacYawImg = 'pacman_img/pacman-open-n.png';
}

var isUpdatingNode = false;
function movePacman() {
    var gsvData = cachedNodes[cPacGSVLink.panoId];
    var cPacYaw = cPacGSVLink.yaw;
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
        if (buttonPressed && minYawDiff > 55) {
            cPacYaw = cPacGSVLink.yaw;
            buttonPressed = false;
        } else {
            break;
        }
    }
    cPacGSVData = gsvData;
    cPacGSVLink = gsvData.links[minYawI];
    if (cachedNodes[cPacGSVLink.panoId] === undefined) {
        edgeNodes.unshift(gsvData);
    }
    setPacImageFromYaw(cPacGSVLink.yaw);
    cPacMarker.setLatLng(gsvData.location.latlng);
    expandCachedNodes(moveCallback);
    if (findCloseDots()) {
        score += 10;
        $("#score").text(score);
    }
            
}

function moveCallback() {
    isUpdatingNode = false;
}

function onBlueGDirLoad() {
    console.log(GDirBlue);
}

var ghostGetDirCount;
var pacMoveCount;
var pacIsClosed = false;
function gameUpdate() {
    if (pacIsClosed) {
        cPacMarker.setImage(cPacYawImg);
    } else {
        cPacMarker.setImage("pacman_img/pacman-closed.png");
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
    if (++ghostGetDirCount >= 20) {
        GDirBlue.loadFromWaypoints([blue.getLatLng(), cPacMarker.getLatLng()]);
    }
}

// returns all the id for the links to this node that aren't already in
// cached nodes.
function getLinkIds(node) {
    var resultIds = []
    for (var i = 0; i < node.links.length; i++) {
        var linkId = node.links[i].panoId;
        if (cachedNodes[linkId] === undefined) {
            resultIds.push(linkId);
        }
    }
    return resultIds;
}

function expandCachedNodes(callback) {
    if (edgeNodes.length == 0) {
        return;
    }
    var initNode = edgeNodes.shift();
    var idsToAdd = getLinkIds(initNode);
    var callbacksYetReturned = idsToAdd.length;
    if (idsToAdd.length == 0) {
        setTimeout(callback, 0);
        return;
    }
    for (var i = 0; i < idsToAdd.length; i++) {
        var idToAdd = idsToAdd[i];
        GSviewClient.getPanoramaById(idToAdd, function(gsvData) {
            cachedNodes[gsvData.location.panoId] = gsvData;
            totalCachedNodes++;
            edgeNodes.push(gsvData);
            map.addOverlay(new GPolyline(
                    [initNode.location.latlng, gsvData.location.latlng]
            ));
            if (--callbacksYetReturned == 0) {
                setTimeout(callback, 0);
            }
        });
    }
}

function afterdots() {
    PacGSVData = startNode;
    cPacGSVLink = startNode.links[0];
    setPacImageFromYaw(cPacGSVLink.yaw);
    cPacMarker = new GMarker(startNode.location.latlng, {
            icon: iPacN,
            clickable: false
    });
    map.addOverlay(cPacMarker);
    //cPacMarker.setImage(cPacYawImg);
    isUpdatingNode = false;
    gametimer = setInterval(gameUpdate, 150);
}

function actualGameStart() {
    score = 0;
    $("#running").text("Placing Dots...");
    var bounds = map.getBounds();
    placeGhosts();
    placeDots(bounds.getSouthWest(), bounds.getNorthEast(), afterdots);
}

var totalCachedNodes;
var cachedNodes, edgeNodes;
var precachelock = false;
var stillPrecaching = false;
var startNode;

function expandToDepth() {
    if (!stillPrecaching) {
        actualGameStart();
    } else {
        expandCachedNodes(expandToDepth);
    }
}

function gameStart() {
    // id -> node
    cachedNodes = {};
    totalCachedNodes = 0;
    // array of nodes
    edgeNodes = [];
    pacImgSwitchCount = 0;
    pacMoveCount = 0;
    concurReq = 0;
    ghostGetDirCount = 20;
    map.clearOverlays();
    var mapCenter = map.getCenter();
	var mapBounds = map.getBounds();
    GSviewClient.getNearestPanorama(mapCenter, function(gsvData) {
        if (!gsvData.location) {
            alert("No Street View Data for this location.");
	        return;
        }
	    var nearestGSVLoc = gsvData.location.latlng;
	    if (!mapBounds.containsLatLng(nearestGSVLoc)) {
	        alert("No Street View Data for this location.");
	        return;
	    }
	    $("#running").text("Precaching Map...");
	    stillPrecaching = true;
	    cachedNodes[gsvData.location.panoId] = gsvData;
	    edgeNodes.push(gsvData);
	    startNode = gsvData;
	    totalCachedNodes = 1;
	    expandToDepth();
	    /*cPacGSVData = gsvData;
	    cPacGSVLink = gsvData.links[0];
	    setPacImageFromYaw(cPacGSVLink.yaw);
	    map.clearOverlays();
	    cPacMarker = new GMarker(nearestGSVLoc, {
	            icon: iPacN,
	            clickable: false
        });
        //cPacMarker.setImage(cPacYawImg);
	    map.addOverlay(cPacMarker);
	    
	    while (totalCachedNodes < 10) {
	        precacheNodes();
        }
	    //while (totalCachedNodes < 5) {}
	    //precacheNodes();
	    //console.log(cachedNodes);
	    setTimeout(function(){
	        clearTimeout(pctimer);
	        $("#running").text("Running");
	        gametimer = setInterval(gameUpdate, 200);
	    }, 5000);*/
	}); 
}

function keyDownHandler(e) {
    var ew = e.which;
    if (ew == 38) {
        updown = true;
        return false;
    } else if (ew == 39) {
        rightdown = true;
        return false;
    } else if (ew == 40) {
        downdown = true;
        return false;
    } else if (ew == 37) {
        leftdown = true;
        return false;
    } else if (ew == 32) {
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
        return false;
    }            
}

function keyUpHandler(e) {
    var ew = e.which;
    if (ew == 38) {
        updown = false;
        return false;
    } else if (ew == 39) {
        rightdown = false;
        return false;
    } else if (ew == 40) {
        downdown = false;
        return false;
    } else if (ew == 37) {
        leftdown = false;
        return false;
    }
}

$(document).ready(function(){
    //console.log($("body"));
    keycodediv = $("#keycode");
    $("#running").text("Stopped");
    keytextarea = $("#keypc");
    keytextarea.keydown(keyDownHandler);
    keytextarea.keyup(keyUpHandler);
    keytextarea.focus();
});
