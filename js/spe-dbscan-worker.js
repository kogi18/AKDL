/*
	Extracted code from spe.js
		dbscan and dependency functions
		redundant but simple

	This copy of code should allow sending msgs to the screen and less errors
*/

// the helper object that stores the clusters
var Cluster = (function () {
	// ---
	// Description: Constructor.
	// ---
	function Cluster(id) {
		this.id = id;
		this.member_indicies = [];
		this.size = 0;
		this.center_index = -1;
		this.farthest_from_center_index = -1;
		this.farthest_from_farthest_index = -1;
		this.outer_sorted_index = -1;
		this.outer_cluster_index = -1;

		// unique meta
		// ignore GPS for now
		// meta_order = ["ID", "X-Axis", "Y-Axis", "XY-Axis", "Timestamp", "DOI"];
		this.unique_metas = [];
		for(var mi=0; mi < 6; mi++){
			this.unique_metas.push(new Set());
		}
	}

	// ---
	// Description: Add Measurement index to cluster.
	// ---
	Cluster.prototype.addMember = function(index){
		this.member_indicies.push(index);
		this.size++;
	}

		// ---
	// Description: Add Measurement index to cluster.
	// ---
	Cluster.prototype.addMeta = function(measurementOutput){
		for(var mi=0; mi < 6; mi++){
			this.unique_metas[mi].add(measurementOutput[mi]);
		}
	}

	// ---
	// Description: Get Measurement index from cluster.
	// ---
	Cluster.prototype.getMember = function(index){
		return this.member_indicies[index];
	}

	// ---
	// Description: Using the given distance function find the member that has the smallest sum of distances
	// ---
	Cluster.prototype.findCenterMember = function(distanceFun){
		var minSum = -1;
		// i is the index of the candidate, and j are all others
		for(var i=0; i<this.size; i++){
			var currentSum = 0;
			for(var j=0; j<this.size; j++){
				if(i != j){
					currentSum += distanceFun(this.member_indicies[i], this.member_indicies[j]);
				}
				// if currentSum is already bigger then minSum, candidate is not center
				// break 2nd loop but be sure only when minSum is not initial value
				if(minSum >= 0 && currentSum > minSum){
					break;
				}
			}
			// after 2nd loop just compare if new min found
			if(minSum < 0 || minSum > currentSum){
				minSum = currentSum;
				this.center_index = this.member_indicies[i];
			}
		}
	}

	// ---
	// Description: Using the given distance function find the member farthest away from center
	//					Also finds the farthest member from farthest member from center
	//					(may or not be the center - depends on the cluster members)
	// ---
	Cluster.prototype.findFarthestMember = function(distanceFun){
		var maxValue = -1;
		// i is the index of the candidate, and j are all others
		for(var i=0; i<this.size; i++){
			var currentSum = 0;
			for(var j=0; j<this.size; j++){
				if(i != j){
					currentSum += distanceFun(this.member_indicies[i], this.member_indicies[j]);
				}
			}
			// after 2nd loop just compare if new min found
			if(maxValue < currentSum){
				maxValue = currentSum;
				this.farthest_from_center_index = this.member_indicies[i];
			}
		}
		maxValue = -1;
		// loop once more to find farthest from foun outlier
		for(var i=0; i<this.size; i++){
			if(i != this.farthest_from_center_index){
				var dist = distanceFun(this.member_indicies[i], this.farthest_from_center_index);
				if(maxValue < dist){
					maxValue = dist;
					this.farthest_from_farthest_index = this.member_indicies[i];
				}
			}
		}
	}

	// ---
	// Description: Set starting outer indices -- for cluster of clusters and sorted list
	// ---
	Cluster.prototype.setOuterIndecies = function (index) {
		this.outer_cluster_index = index;
		this.outer_sorted_index = index;
	}	

	// ---
	// Description: Generate string describing the cluster
	// ---
	Cluster.prototype.toString = function () {
		return "Cluster " + this.id + " has " + this.size + " measurements";
	}

	// ---
	// Description: Array of meta arrays instead of sets
	// ---
	Cluster.prototype.metaToArrays = function () {
		var metaOutput = [];
		for(var i=0; i< this.unique_metas.length; i++){
			metaOutput.push(Array.from(this.unique_metas[i]));
		}
		return metaOutput;
	}

	// ---
	// Description: Regenerate meta sets from arrays
	// ---
	Cluster.prototype.metaArraysToSets = function (metaArrays) {
		for(var i=0; i< this.unique_metas.length; i++){
			this.unique_metas[i] = new Set(metaArrays[i]);
		}
	}


	// ---
	// Description: Generate JSON for worker data transfer
	// ---
	Cluster.prototype.toJSON = function () {
		return {
			"id": this.id,
			"members": this.member_indicies,
			"center": this.center_index,
			"far": this.farthest_from_center_index,
			"farfar": this.farthest_from_farthest_index,
			"meta": this.metaToArrays()
		};
	}
	// ---
	// Description: Fill properties from JSON for worker data transfer
	// ---
	Cluster.prototype.fromJSON = function (jsonValues) {
		this.id = jsonValues.id;
		this.member_indicies = jsonValues.members;
		this.size = this.member_indicies.length;
		this.center_index = jsonValues.center;
		this.farthest_from_center_index = jsonValues.far;
		this.farthest_from_farthest_index = jsonValues.farfar;
		this.metaArraysToSets(jsonValues.meta);
	}

	return Cluster;
})();


var measurements = [];
var eps = 0;
var min_region_size = 0;
var clusters = [];
var marked_as_noise = [];
var not_running = true;
var start_time = null;
var total_time = 0;
var line_seperator = "\n" + Array(40).join("-") + "\n";

function outputMeta(m){
	var output = [];
	// save unique values for meta 
	// ["ID", "X-Axis", "Y-Axis", "XY-Axis", "Timestamp", "DOI"];
	// ignore GPS for now
	output.push(m.id +"");
	output.push(m.x_axis);
	output.push(m.y_axis);
	output.push(m.x_axis+"!"+m.y_axis);
	output.push(m.timestamp);
	output.push(m.doi);

	return output;
}

function measurementDistance(m1, m2){
	var squaredSum = 0;
	var a = measurements[m1];
	var b = measurements[m2];
	for(var i=0; i<a.feature_count; i++){
		var diff = Math.abs(a.fv[i] - b.fv[i]);
		if(diff > 0){
			squaredSum = Math.pow(diff, 2);	// euclidian distance
		}
	}
	if(squaredSum > 0){
		return Math.sqrt(squaredSum);
	}
	else{
		return 0;
	}
}

function regionQuery(index){
	var region = [index];

	for(var i=0; i < measurements.length; i++){
		// if different index and distance smaller than epsilon
		if(i != index && eps > measurementDistance(index, i)){
			region.push(i);
		}
	}
	return region;
}

function expandCluster(cluster, region){
	var found_new_regions = [];
	for(var i=0; i < region.length; i++){
		var index = region[i];
		if(!measurements[index].dbscan_visited){
			measurements[index].dbscan_visited = true;
			var new_region = regionQuery(index);
			if(new_region.length >= min_region_size){
				found_new_regions.push(new_region);
			}
		}
		if(measurements[index].dbscan_cluster < 0){
			cluster.addMember(index);
			cluster.addMeta(outputMeta(measurements[index]));
			measurements[index].dbscan_cluster = cluster.id;
		}
	}
	for(var i=0; i< found_new_regions.length; i++){
		expandCluster(cluster, found_new_regions[i]);
	}
}

function dbscan(){
		start_time = performance.now();
	for(var m=0; m < measurements.length; m++){
		postMessage({ 'cmd': "console", "console" : "DBSCAN M = " + m + "/" + measurements.length});
		// only chack if not yet visited
		if(!measurements[m].dbscan_visited){
			measurements[m].dbscan_visited = true;
			var region = regionQuery(m);
			if(region.length < min_region_size){
				marked_as_noise.push(m);
			}
			else{
				var cluster = new Cluster(this.clusters.length);
				expandCluster(cluster, region);
				var time = Math.floor(performance.now() - start_time);
				start_time = performance.now();
				total_time += time;
				postMessage({ 'cmd': "msg", "msg" : "DBSCAN" + line_seperator + "\nMeasurement " + m + "/" + measurements.length+
													"\nInitial region size: " + region.length +
													line_seperator +
													"Created cluster " + cluster.id + "\nHolds " + cluster.size + " measurements" + 
													"\nCalculation time: " + time + "ms" + line_seperator +
													"Elapsed time: " + Math.floor(total_time / 60000) + "min " + Math.floor(total_time % 60000 /1000) + "s " + (total_time % 1000) + "ms"});
				// find center element == representative
				cluster.findCenterMember(measurementDistance);
				// find farthest element from ceneter and the element farthest from farthest
				cluster.findFarthestMember(measurementDistance);
				clusters.push(cluster);
				postMessage({ 'cmd': "cluster", "cluster" : cluster.toJSON()});
				
			}
		}
	}

	postMessage({ 'cmd': "noise", "noise" : marked_as_noise});
}
self.addEventListener('message', function(e) {
	var data = e.data;
	switch (data.cmd) {
		case 'test':
			self.postMessage({ 'cmd': "test", "test" : 'WORKER STARTED: ' + data.msg + "\tYes!"});
			break;
		case 'inputs':
			eps = data.msg.eps;
			min_region_size = data.msg.min_region_size;
			measurements = JSON.parse(data.msg.m);
			self.postMessage({ 'cmd': "inputs", "inputs" : 'WORKER INPUTS OK: ' + eps + " | "+ min_region_size + "| " + measurements.length});
			break;
		case 'start':
			if(not_running){
				not_running = false;
				dbscan();
			}
			break;
		case 'stop':
			self.postMessage({ 'cmd': "console", "console" : 'WORKER STOPPED: ' + data.msg});
			self.close(); // Terminates the worker.
			break;
		default:
			self.postMessage({ 'cmd': "console", "console" : 'Unknown command: ' + data.msg});
	};
}, false);