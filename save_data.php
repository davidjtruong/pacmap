<?php

$db = mysql_connect("vergil.u.washington.edu:42889", "pacmap", "pacmap");
mysql_select_db("pacmap");

if ($_SERVER["REQUEST_METHOD"] == "GET") {
	
} elseif ($_SERVER["REQUEST_METHOD"] == "POST") {
	$panoID = $_REQUEST["panoID"];
	$lat = (double)$_REQUEST["lat"];
	$lng = (double)$_REQUEST["lng"];
	$links = $_REQUEST["links"];
	
	mysql_query("INSERT INTO gsvdata (panoID, lat, lng, links) VALUES ('{$panoID}', {$lat}, {$lng}, '{$links}')
					ON DUPLICATE KEY UPDATE panoID=VALUES(panoID), lat=VALUES(lat), lng=VALUES(lng), links=VALUES(links) ;") or die("bad");
}

mysql_close($db);

?>
