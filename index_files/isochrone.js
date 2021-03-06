	// Inspired by: http://sandropaganotti.com/generate-an-isochrone-map-using-google-maps-api/
	// Rewritten for Google Maps API v3 - Ilia Karmanov 
	
	// ToDo:
	
	// Able to edit polygons even after more polygons have been drawn
	// Ability to stop execution
	// Ability to clear all markers and lines polygons
	// Ability to export polygons 
	
	// Refine search algorithm so that less manual-tuning required
	// Add new search methods - (Search around perimeter & traffic-light 10 points along all rays by _
	// <5mins, <10mins, <15mins, <20mins)
	// Improve website layout
	
	// Number of points
	var num_points = 8;
	
	var default_int = 0;
    var inc_x = 0;
    var inc_y = 0;
	var x     = 0;
    var y     = 0;

	// Stuck
	var stuck = 0;
	var stuck_old = 0;
	
	var map = null;
    var geocoder = null;
	var directionsDisplay = new google.maps.DirectionsRenderer();
	var directionsService = new google.maps.DirectionsService();
	
	var global_count = 0;
	var points    = [];
	var polygon = new google.maps.Polygon;
	
	var start_marker = new google.maps.Marker;
	var marker = new google.maps.Marker;
	var startDrag;
	
	var desired_mins = 0;
    var m     = 0;
    var intval = null;
    var slice  = (2*Math.PI)/num_points; 
    var start_s = 0;
    var found     = 0;
	
	// Save previous results
	var prev_dest_lat = 0;
	var prev_dest_lng = 0;
	var old_dist = 0;
	var old_time = 0;
	var no_route = 0;
	var start_lat = 0;
	var start_lng = 0;

	var curr_address;
	var cut_string_i = 0;
	
    function initialize() {	
		// Initialize around City, London
		var my_lat = 51.518175;
		var my_lng = -0.129064;
		var mapOptions = {
			center: new google.maps.LatLng(my_lat, my_lng),
			zoom: 12
		};
		map = new google.maps.Map(document.getElementById('map-canvas'),
		mapOptions);
    }
		
	function split_string(address,minutes){
		// Split multiple locations by separator (//)
		curr_address = address.split("//");
		// Initialise with first value
		drawisochrone(curr_address[0],minutes);
	}
	
	function drawisochrone(address,minutes){	
		// Initialise new polygon and array holder
		global_count++;
		window['points_' + global_count] = [];
		window['polygon_' + global_count] = new google.maps.Polygon;
		
		points = window['points_' + global_count];
		polygon = window['polygon_' + global_count];
		
		// Initialise geocoder and directions
		geocoder = new google.maps.Geocoder();	
		directionsDisplay.setMap(map);	
		geocoder.geocode( { 'address': address}, function(point, status) {
		if (status == google.maps.GeocoderStatus.OK) {
			var source_lat = point[0].geometry.location.lat()
			var source_lng = point[0].geometry.location.lng()
			
			// Sensitivity (increment)
			// 3000 after trial-and-error parameter testing
			default_int = minutes/3000;
			inc_x = default_int;
			inc_y = default_int;
			x     = default_int;
			y     = default_int;
			
			map.setCenter(point[0].geometry.location);
			intval = setInterval( "crawldirections(" + source_lat + "," + 
			source_lng + "," + minutes +")", 1000);
		} else {
			alert("Geocode was not successful for the following reason: " + status);
			// Continue with remaining
			if (cut_string_i < curr_address.length-1) {
				// Not finished with all addresses
				cut_string_i++;
				drawisochrone(curr_address[cut_string_i],minutes);
			} else {
				cut_string_i = 0;
				curr_address = [];
				document.getElementById("gen_button").value="Generate New";
			}
		}		
		});	
	}
	
    function crawldirections(px,py,mins){
		desired_mins = mins
        var point      = new google.maps.Point(px,py);
        var destpoint  = new google.maps.Point(px + x,py + y);  
		var start = new google.maps.LatLng(point.x,point.y);
		var end = new google.maps.LatLng(destpoint.x,destpoint.y);
			
		// After initial push; follow directions service rather than ray 
		if (m > 3) {
		end = new google.maps.LatLng(prev_dest_lat + (inc_x * Math.sin(start_s)),
			prev_dest_lng + (inc_y * Math.cos(start_s)));
		console.log("Switching to direction route: " + prev_dest_lat + (inc_x * Math.sin(start_s)) + ", " +
			prev_dest_lng + (inc_y * Math.cos(start_s)))
		}
		
		if (stuck > stuck_old) {
		// Push out if stuck
		end = new google.maps.LatLng(prev_dest_lat + ((default_int*3) * Math.sin(start_s)),
			prev_dest_lng + ((default_int*3) * Math.cos(start_s)));
		}
		
		var request = {
			origin: start,
			destination: end,
			travelMode: google.maps.TravelMode.DRIVING
		};
		
        x = x + (inc_x * Math.sin(start_s));
        y = y + (inc_y * Math.cos(start_s));
        m = m + 1;
		
		directionsService.route(request,function(response, status) {
		if (status == google.maps.DirectionsStatus.OK) {
			console.log("Route OK. Try: " + m)
			no_route = 0

			// Display directions on screen
			directionsDisplay.setOptions({ preserveViewport: true })
			directionsDisplay.setDirections(response)
			
			var curr_time = (response.routes[0].legs[0].duration.value/60).toFixed(1)
			var curr_dist = (response.routes[0].legs[0].distance.value/1000/1.609344).toFixed(1)
			var end_dir_lat = response.routes[0].legs[0].end_location.lat()
			var end_dir_lng = response.routes[0].legs[0].end_location.lng()
			var start_lat = response.routes[0].legs[0].start_location.lat()
			var start_lng = response.routes[0].legs[0].start_location.lng()
			console.log("Current min: " + curr_time + ", prev min: " + old_time + ", target: " + mins)	
			
			// Straddle the point
			if (old_time <= mins && curr_time > mins){
                found     = 1;
            }else{
				// Dynamically adjust speed
				if (curr_time < (0.75*mins)) {
					inc_x = (default_int*2);
					inc_y = (default_int*2);
				} else {
					inc_x = default_int;
					inc_y = default_int;
				}
				// Set current end coordinates as previous
				// If stuck, push forward:
				if ((curr_time == old_time) && (curr_dist == old_dist)) {	
					console.log("Stuck, pushing forward")
					stuck_old = stuck
					stuck = stuck + 1
				}
				// Set current end coordinates as previous
				prev_dest_lat = end_dir_lat
				prev_dest_lng = end_dir_lng
				// Set current distance and time as previous
				old_dist = curr_dist
				old_time = curr_time
            }

			if (found == 1 || stuck > 3){
				console.log(start_s)
				// Use point that is closer to the target
				if ((mins - old_time) > (curr_time - mins)) {
					// Use new if closer
					prev_dest_lat = end_dir_lat
					prev_dest_lng = end_dir_lng
					old_time = curr_time
					old_dist = curr_dist				
				}
				
				// Place marker
				console.log("Found! " + old_time + ". Placing marker")
				
				// Icon depending on match type
				if (old_time-mins>1) {
					var marker = createMarker(prev_dest_lat, prev_dest_lng, map, old_time, old_dist, "High");
				} else if (mins-old_time>1) {
					var marker = createMarker(prev_dest_lat, prev_dest_lng, map, old_time, old_dist, "Low");
				} else {
					var marker = createMarker(prev_dest_lat, prev_dest_lng, map, old_time, old_dist, "Good");
				}

				if (stuck > 3 ) {
					// Push out a bit further
					start_s = start_s + (2*slice)
				} else {
					// Next slice
					start_s = start_s + slice;
				}
				// Reset variables		
				inc_x = default_int;
				inc_y = default_int;
				stuck_old = 0;
				stuck = 0;
                x = inc_x;
                y = inc_y;
                m = 0;
                found = 0;
                curr_time = 0;
				old_dist = 0;
				old_time = 0;
				prev_dest_lng = 0;
				prev_dest_lat = 0;
				end_dir_lat = 0;
				end_dir_lng = 0;
				console.log("Done!")
            }                 
        }else{
			console.log("Google lock-out, retry ...")
			//Retry
			prev_dest_lat = prev_dest_lat;
			prev_dest_lng = prev_dest_lng;
			no_route = no_route + 1;
			
			if (no_route > 5) {
				console.log("No route. Skipping.")
				// Next slice
				start_s = start_s + slice;
				// Reset variables	
				inc_x = default_int;
				inc_y = default_int;
				stuck_old = 0;
				stuck = 0;
				x = inc_x;
				y = inc_y;
				m = 0;
				found = 0;
				curr_time = 0;
				old_dist = 0;
				old_time = 0;
				prev_dest_lng = 0;
				prev_dest_lat = 0;
				end_dir_lat = 0;
				end_dir_lng = 0;
			}
		}

		});
		
		// Finished all slices
		if(start_s > (2*Math.PI)-slice){
			console.log("End. Creating Polygon.")
			start_s = 0;

		start_marker = new google.maps.Marker({
			// Use point that directions service was using for accuracy
			id: global_count,
			position: new google.maps.LatLng(start_lat,
				start_lng),
			map: map,
			icon: 'http://maps.google.com/mapfiles/ms/icons/green-dot.png',
			title: 'Start: ' + curr_address[cut_string_i] + ' (' + cut_string_i + ')'
		});	
		
		// Polygon
		polygon.setMap(null);
		polygon = new google.maps.Polygon({
			id: global_count,
            paths: points,
            strokeColor: '#0040FF',
            fillColor: '#00BFFF',
            fillOpacity: 0.2
		});
		polygon.setMap(map);			
		
		// Clear directions
		directionsDisplay.setMap();
		clearInterval(intval);
				
		if (cut_string_i < curr_address.length-1) {
			// Not finished with all addresses in array
			cut_string_i++;
			drawisochrone(curr_address[cut_string_i],desired_mins);
		} else {
			// Finished with all
			cut_string_i = 0;
			curr_address = [];
			document.getElementById("gen_button").value="Generate New";
		}
				
		}
    }
	
	function createMarker(prev_dest_lat, prev_dest_lng, map, old_time, old_dist, match_type) {
	// Create markers with listeners for drag-start + drag-end
		// Custom icon depending on match
		var using_icon = ""
		if (match_type == "Good") {
			using_icon = 'https://rawgit.com/iliauk/Drive-time-Radius/master/measle_green.png'
		} else if (match_type == "Low") {
			using_icon = 'https://rawgit.com/iliauk/Drive-time-Radius/master/measle_blue.png'
		} else {
			using_icon = 'https://rawgit.com/iliauk/Drive-time-Radius/master/measle_red.png'
		}
		
		var marker = new google.maps.Marker({
			id: global_count,
			position: new google.maps.LatLng(prev_dest_lat,prev_dest_lng),
			map: map,
			// Add id 
			draggable: true,
			icon: using_icon,
			title: 'Minutes: ' + old_time + 
					' Miles: ' + old_dist
			});
		
		// Add if point doesn't already exist
		var temp_exist = 0
		for (var i = 0; i < points.length; i++) {
			//console.log(points[i]);
			if (points[i] == new google.maps.LatLng(prev_dest_lat,prev_dest_lng) || 
				points[i].equals(new google.maps.LatLng(prev_dest_lat,prev_dest_lng))) {
			console.log('Already exists')
			var poly_colour = '#00BFFF'
			// Blue
			temp_exist = 1
			}
		}
		
		if (temp_exist == 0) {
			console.log('New point')
			points.push(new google.maps.LatLng(prev_dest_lat,prev_dest_lng));
			var poly_colour = '#FFCC00'
			// Yellow
		}
		
		// Polygon
		polygon.setMap(null);
		polygon = new google.maps.Polygon({
			id: global_count,
            paths: points,
            strokeColor: '#0040FF',
			fillColor: poly_colour,
            fillOpacity: 0.2
		});
		polygon.setMap(map);
		
		// Add listener for drag-start
		google.maps.event.addListener(marker, 'dragstart',function(){
			startDrag = this.getPosition();
		});
		
		// Add listener for drag-end
		google.maps.event.addListener(marker, 'dragend', function() {
			// Initialise directions
			directionsDisplay.setMap();
			directionsDisplay.setMap(map);
			
			var request = { 
				origin: start_marker.getPosition(), 
				destination: this.getPosition(), 
				travelMode: google.maps.TravelMode.DRIVING
			}; 

			// Clear old marker
			marker.setMap(null);		
		
			// Create new
			directionsService.route(request,function(response, status) {
				if (status == google.maps.DirectionsStatus.OK) {

					// Display directions on screen
					directionsDisplay.setOptions({ preserveViewport: true })
					directionsDisplay.setDirections(response)
					
					// Icon depending on match type
					if (((response.routes[0].legs[0].duration.value/60) - desired_mins)>1) {
						var match_type = "High"
					} else if ((desired_mins-(response.routes[0].legs[0].duration.value/60))>1){
						var match_type = "Low"
					} else {
						var match_type = "Good"
					}
					
					for (var i = 0; i < points.length; i++) {
						//console.log(points[i])
						if (points[i] == startDrag || points[i].equals(startDrag)) {
							console.log('altering')
							points[i] = new google.maps.LatLng(
								response.routes[0].legs[0].end_location.lat(),
								response.routes[0].legs[0].end_location.lng()
							);
						} else {
						console.log('nothing to alter')
						//console.log(startDrag)
						}
					}
					
					var marker = createMarker(
							response.routes[0].legs[0].end_location.lat(),
							response.routes[0].legs[0].end_location.lng(),
							map,
							(response.routes[0].legs[0].duration.value/60).toFixed(1),
							(response.routes[0].legs[0].distance.value/1000/1.609344).toFixed(1),
							match_type
					);	
				
				}
			});
			
		});
	}