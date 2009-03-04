<?php

$db = mysql_connect("vergil.u.washington.edu:42889", "pacmap", "pacmap");
mysql_select_db("pacmap");

if ($_SERVER["REQUEST_METHOD"] == "GET") {
	$north = $_REQUEST["ne"][0];
	$east = $_REQUEST["ne"][1];
	$south = $_REQUEST["sw"][0];
	$west = $_REQUEST["sw"][1];
	
	$table = mysql_query("SELECT * FROM gsvdata WHERE lat <= {$north} AND 
						  lat >= {$south} AND lng <= {$east} AND lng >= {$west};") or die("bad2");
	$result = array();
	while ($row = mysql_fetch_array($table)) {
		$result[$row["panoID"]] = array($row["panoID"], (double)$row["lat"], (double)$row["lng"], explode(" ", trim($row["links"])));
	}
	#var_dump($result);
	echo json_encode($result);
} elseif ($_SERVER["REQUEST_METHOD"] == "POST") {
	$node_tree = json_decode(stripslashes($_REQUEST["node_tree"]));
	
	foreach($node_tree as $node) {
		$panoID = $node->location->panoId;
		$lat = (double)$node->location->lat;
		$lng = (double)$node->location->lng;
		#$yaw = (double)$node->links[0]->yaw;
		$links = "";
		foreach($node->links as $link) {
			$links .= " " . $link->panoId;
		}
		mysql_query("INSERT INTO gsvdata (panoID, lat, lng, links) VALUES ('{$panoID}', {$lat}, {$lng}, '{$links}')
					 ON DUPLICATE KEY UPDATE panoID=VALUES(panoID), lat=VALUES(lat), lng=VALUES(lng), links=VALUES(links) ;") or die("bad");
	}
}

mysql_close($db);

?>
