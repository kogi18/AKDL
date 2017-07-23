// Scatter Plot Explorer [SPE]
// spe.js
// Rok Kogovšek, 2017
// Class SPE
// Implements the core engine.
var SPE = (function () {
	// ---
	// Description: Constructor.
	// ---
	function SPE() {
		// main list to be used at start to find files
		this.filelist = d3.select("body").attr("id");
		if(this.filelist == undefined || this.filelist == ""){
			this.filelist = "ALL.list";	//Default value
		}
		// arrays with all relevant filenames
		this.label_files = [];
		this.raw_files = [];
		this.fv_files = [];
		this.lists = [];
		// indicies for selected files to be used in calculations
		this.selected_label = 0;
		this.selected_raw = 0;
		this.selected_fv = 0;
		// default value -1 for checking
		this.selected_list = -1;
		// arrays with parsed data from data files
		this.labels = [];
		this.raw = [];
		this.fv = [];
		// counters
		this.file_count = 0;
		this.sp_file_count = 0;
		this.measurement_count = 0;
		// how many files were loaded already
		this.label_load = 0;
		this.raw_load = 0;
		this.fv_load = 0;
		// measurements array
		this.measurements = [];
		// clustering engine - DBSCAN
		this.eps = 0;
		this.min_region_size = 5;
		this.clusters = [];
		this.cluster_of_clusters = null;
		this.marked_as_noise = [];
		// useful constants
		this.string_line_seperator = "\n" + Array(40).join("-") + "\n";
		this.matrix_sp_width = 100;//300;
		this.matrix_sp_heigh = 100;//300;
		// tests done with min cluster size 5
		this.tested_eps = {
			"corr.fv": "0.0015",	// 44 clusters of AVG size 560 and 0.1% marked as noise
			"dft.fv": "0.0002",		// 45 clusters of AVG size 546 and 0.4% marked as noise
			"ehd.fv": "0.0008",		// 43 clusters of AVG size 570 and 0.7% marked as noise
			"kde.fv": "0.00000002",	// 43 clusters of AVG size 569 and 0.7% marked as noise
			"l2.fv": "0.015",		// 44 clusters of AVG size 599 and 0.3% marked as noise
			"paa.fv": "0.04",		// 32 clusters of AVG size 766 and 0.7% marked as noise
			"rf.fv": "0.000025",	// 45 clusters of AVG size 534 and 1.0% marked as noise
			"sax.fv": "1",			//  1 clusters of AVG size ALL and 0.0% marked as noise
			"spline.fv": "0.00001"	// 42 clusters of AVG size 310 and 0.3% marked as noise
		};
	}

	// ---
	// Description: Generate string describing the data files
	// ---
	SPE.prototype.toString = function () {
		return [ "In " + this.filelist + " " + this.file_count + " legit files were listed [" + this.sp_file_count +" scatter plot files].",
					"Listed label files [" + this.label_files.length + "]: \n\t" + this.label_files,
					"Listed raw data files [" + this.raw_files.length + "]: \n\t" + this.raw_files,
					"Listed feature vector files [" + this.fv_files.length + "]: \n\t" + this.fv_files,
					"Listed lists [" + this.lists.length + "]: \n\t" + this.lists,
				""].join(this.string_line_seperator);
	}

	// ---
	// Description: Generate string describing the data files
	// ---
	SPE.prototype.loadString = function () {
		return ["",
			"Loaded " +  (this.label_load + this.raw_load + this.fv_load) + "/" + this.sp_file_count + " scatter plot files.",
			"Loaded label files [" + this.label_load + "/" + this.label_files.length + "]"+
			"\nLoaded raw data files [" + this.raw_load + "/" + this.raw_files.length + "]"+
			"\nLoaded feature vector files [" + this.fv_load + "/" + this.fv_files.length + "]",
			""].join(this.string_line_seperator);
	}

	// ---
	// Description: Load the default list and all benchmark data - if memory alllows
	// ---
	SPE.prototype.preloadData = function () {
		var self = this;
		self.generateLoaderMessage("Validating file formats");
		d3.text("data/" + self.filelist, function(dirlist){
			// check text from list for valid files
			d3.dsvFormat(".").parseRows(dirlist, function(row, i){
				self.file_count++;
				var format = row[row.length-1].toLowerCase();
				switch(format){
					case "csv":
						self.label_files.push(row.join("."));
						break;
					case "data":
						self.raw_files.push(row.join("."));
						break;
					case "fv":
						self.fv_files.push(row.join("."));
						break;
					case "list":
						self.lists.push(row.join("."));
						// check if list is same as filelist
						if(self.lists[self.lists.length - 1] == self.filelist){
							self.selected_list = self.lists.length - 1;
						}
						break;
					default:
						self.file_count--; // correct counter
						console.log("Unknown ." + format + " for file " + row.join("."));
				}
			});
			// check if filelist was found in list - else add it to the end of the list
			if(self.selected_list < 0){
				self.lists.push(self.filelist);
			}
			// sort all arrays
			self.label_files = self.label_files.sort();
			self.raw_files = self.raw_files.sort();
			self.fv_files = self.fv_files.sort();
			self.lists = self.lists.sort();
			// find filelist location
			self.selected_list = self.lists.findIndex(function(d){ return d == self.filelist;})

			// record scatterr plot file count
			self.sp_file_count = self.label_files.length + self.raw_files.length + self.fv_files.length;
			console.log("" + self);
			self.generateLoaderMessage("Loading data");
			
			// retrieve data from labels
			self.readFileArray(self.label_files, 0, self.parseLabelRow, self.labels, function(){self.label_load++; self.afterPreloadData();});
			// retrieve raw data
			self.readFileArray(self.raw_files, 0, self.parseRawDataRow, self.raw, function(){self.raw_load++; self.afterPreloadData();});
			// retrieve feature vectors - too big to load in browser cache all
			self.readFileArray(self.fv_files, 0, self.parseFeatureVectorRow, self.fv, function(){self.fv_load++; self.afterPreloadData();});
		}).on("error", function(){ alert("Starting file list " + self.filelist + " does not exist in data folder!")});
	}

	// ---
	// Description: The sequence run after all needed data is loaded
	// ---
	SPE.prototype.afterPreloadData = function () {
		// show progress
		// console.log(this.loadString());
		this.generateLoaderMessage(this.loadString());
		if(this.label_load + this.raw_load + this.fv_load  == this.sp_file_count){
			console.log("Finished load");
			this.selectDataGUI();
		}
	}

	// ---
	// Description: Send Ajax request for all filenames in array to retrieve their data
	// ---
	SPE.prototype.readFileArray = function (fileArray, i, rowFunction, outputArray, finishCounter) {
		if(i < fileArray.length){
			var filename = fileArray[i].split(".")[0];
			d3.request("data/" + fileArray[i])
				.mimeType("text/csv")
				.response(function(xhr) {
					return d3.dsvFormat(" ").parseRows(xhr.responseText, function(row, i){
						var parsed = rowFunction(row, i);
						// save also source file name - without the extension
						parsed.src_filename = filename;
						return parsed;
					});
				}).get(function(data){ // callback uses the i index to correctly sort the results
					outputArray[i] = data;
					finishCounter();
				}).on("error", function(){ console.log("File " + fileArray[i] + " does not exist in data folder!"); finishCounter()})
			// request next
			this.readFileArray(fileArray, i+1, rowFunction, outputArray, finishCounter);
		}
	}

	// ---
	// Description: Parsers for all benchmark types
	// ---
	SPE.prototype.parseLabelRow =	function (row, i){
		var axis = row[1].split("!");
		return {
			id 			: row[0],
			x_axis		: axis[0],
			y_axis		: axis[1],
			timestamp	: row[2],
			latitude	: parseFloat(row[3]),
			longitude	: parseFloat(row[4]),
			doi			: row[5]
		};
	}
	SPE.prototype.parseRawDataRow =	function (row, i){
		var raw_data = { id: row[0], pairs: []};
		for(var pair=1; pair < row.length; pair++){
			var stringValues = row[pair].split(";");
			raw_data.pairs[pair-1] = [parseFloat(stringValues[0]), parseFloat(stringValues[1])]

		}
		return raw_data;
	}
	SPE.prototype.parseFeatureVectorRow =	function (row, i){
		var fv = { id : row[0] , features : []};
		for(var f=1; f<row.length; f++){
			fv.features[f-1] = parseFloat(row[f]);
		}
		return fv;
	}

	// ---
	// Description: Generate a form with 3 dropdowns to select the files to be used
	// ---
	SPE.prototype.selectDataGUI = function(){
		var self = this;
		// failsafe to remove all objects
		this.clearGeneratedElements();
		// generate dropdowns
		d3.select("#select-data-files").selectAll("select")
			.data([this.label_files, this.raw_files, this.fv_files])
			.enter().append("select")
						.attr("id", function(d,i){ return "file" + i})
						.selectAll("option").data(function(d){return d})
							.enter().append("option").text(function(d){return d}).attr("value", function(d,i){ return i});
		// add min cluster size input
		d3.select("#select-data-files").append("input").attr("id","min-region-size-val").attr("type","text").attr("value", self.min_region_size);
		// add eps input
		d3.select("#select-data-files").append("input").attr("id","eps-val").attr("type","text").attr("value", self.eps);
		// add event button
		d3.select("#select-data-files").append("button").text("GENERATE").on("click", function(){
			self.selected_label = d3.select("#file0").node().value;
			self.selected_raw = d3.select("#file1").node().value;
			self.selected_fv = d3.select("#file2").node().value;
			self.min_region_size = parseInt(d3.select("#min-region-size-val").node().value);
			self.eps = parseFloat(d3.select("#eps-val").node().value);
			self.measurement_count = self.raw[self.selected_raw].length;
			d3.select("#select-data-files").selectAll("select").remove();
			d3.select("#select-data-files").selectAll("input").remove();
			d3.select("#select-data-files").selectAll("button").remove();
			self.generateLoaderMessage("Calculating");
			self.combineData();	// call the creation of the measurements objects
		});

		// set dropdown selected values
		d3.select("#file0").selectAll("option").property("selected", function(d,i){ if(i == self.selected_label) {return true;} return false;});
		d3.select("#file1").selectAll("option").property("selected", function(d,i){ if(i == self.selected_raw) {return true;} return false;});
		d3.select("#file2").selectAll("option").property("selected", function(d,i){ if(i == self.selected_fv) {return true;} return false;});	
		if(self.eps == 0 && self.tested_eps[self.fv_files[self.selected_fv]]){
			d3.select("#eps-val").attr("value", self.tested_eps[self.fv_files[self.selected_fv]]);
		}
		// on select event
		d3.select("#file2").on("change", function(){
			var fv_read =  d3.select("#file2").node().value;
			if(self.tested_eps[self.fv_files[fv_read]]){
				d3.select("#eps-val").attr("value", self.tested_eps[self.fv_files[fv_read]]);
			}
		});
	}
	

	// ---
	// Description: A failsafe that selects all elements we may generate and removes them - for unforseen situations fix
	// ---
	SPE.prototype.clearGeneratedElements = function(){
		// Terminate loader
		d3.select("#loader").selectAll("div").remove();
		// Clean all SVGs
		d3.select("#canvas").selectAll("svg").remove();

		console.log("TO DO function for clearing");
	}

	// ---
	// Description: Dynamic animated loader message - type of animation defined in CSS
	// ---
	SPE.prototype.generateLoaderMessage = function(msg){
		d3.select("#loader").selectAll("div").data(msg.split("\n"))
			.text(function(d){return d;})
			.enter().append("div").text(function(d){return d;})
			.exit().remove();
		console.log("TO DO function for loader");
	}

	// ---
	// Description: Fill measurements object
	// ---
	SPE.prototype.combineData = function(){
		// first empty array - needed if new selection done
		this.measurements = [];
		var labelArray = this.labels[this.selected_label];
		var rawArray = this.raw[this.selected_raw];
		var fvArray = this.fv[this.selected_fv];
		for(var m=0; m < this.measurement_count; m++){
			this.measurements[m] = new Measurement(labelArray[m], rawArray[m], fvArray[m]);
		}
		this.generateLoaderMessage("Measurements prepared");
		var testMat = [];
		for(var m=0; m < 10; m++){
			testMat[m] = this.measurements[m];
		}
		// for loading message
		this.generateLoaderMessage("DBSCAN");
		var self = this;
		setTimeout(function(){
			console.log("Trying with EPS["+self.eps+"] and minRegionSize["+self.min_region_size+"]");
			self.dbscan();
			var avgSize = 0;
			for(var c=0; c < self.clusters.length; c++){
				avgSize += self.clusters[c].size;
			}
			avgSize = avgSize / self.clusters.length;
			// report clustering
			self.generateLoaderMessage(self.measurements[m].fv_type + " has EPS["+self.eps+"] and "+ self.clusters.length + "clusters with AVG size " + avgSize);
			// restart clustering button
			d3.select("#select-data-files").append("button").text("RESTART").on("click", function(){
				d3.select("#select-data-files").selectAll("button").remove();
				d3.select("#select-data-files").selectAll("select").remove();
				self.selectDataGUI();
			});
			// sorting gui
			d3.select("#select-data-files").append("select").attr("id","overview-sort")
				.selectAll("option").data(["From Center", "From Farthest", "Between Outliers"])
					.enter().append("option")
						.text(function(d){return d;}).attr("value",function(d){return d.split(" ").join("");});
			d3.select("#select-data-files").append("button").text("SORT").on("click", function(){
				d3.select("#canvas").selectAll("svg").remove();
				console.log(d3.select("#overview-sort").node().value);
				self.sortClusters(self, d3.select("#overview-sort").node().value);
				self.plotRepresentativeMatrix();
			});
			self.sortClusters(self, "fromCenter");
			self.plotRepresentativeMatrix();
		}, 1);
	}

	// ---
	// Description: DBSCAN distance function
	// ---
	SPE.prototype.measurementDistance = function(m1, m2){
		var squaredSum = 0;
		var a = this.measurements[m1];
		var b = this.measurements[m2];
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
	
	// ---
	// Description: DBSCAN function for finding neighbours
	// ---
	SPE.prototype.regionQuery = function(index){
		var region = [index];
		for(var i=0; i < this.measurement_count; i++){
			// if different index and distance smaller than epsilon
			if(i != index && this.eps > this.measurementDistance(index, i)){
				region.push(i);
			}
		}
		return region;
	}
	
	// ---
	// Description: DBSCAN distance function
	// ---
	SPE.prototype.dbscan = function(){
		//empty values before starting
		this.clusters = [];
		this.cluster_of_clusters = null;
		this.marked_as_noise = [];
		var self = this;
		var distFun = function(a,b){return self.measurementDistance(a,b)};
		for(var m=0; m < this.measurement_count; m++){
			// only chack if not yet visited
			if(!this.measurements[m].dbscan_visited){
				this.measurements[m].dbscan_visited = true;
				var region = this.regionQuery(m);
				if(region.length < this.min_region_size){
					this.marked_as_noise.push(m);
				}
				else{
					console.log("Region size " + region.length + " [from all " + this.measurement_count +"]");
					var cluster = new Cluster(this.clusters.length);
					this.expandCluster(cluster, region);
					// find center element == representative
					cluster.findCenterMember(distFun);
					// find farthest element from ceneter and the element farthest from farthest
					cluster.findFarthestMember(distFun);
					this.clusters.push(cluster);
					console.log("Added " + cluster.id + " cluster with " + cluster.size + " elements and center member " + cluster.center_index);
				}
			}
		}
		this.prepareCenterCluster();
		console.log("Noise marked count = " + this.marked_as_noise.length);
		// doublecheck noise points
		for(var n=this.marked_as_noise.length -1; n>=0; n--){
			if(this.measurements[this.marked_as_noise[n]].dbscan_cluster >= 0){
				// the point was added to a cluster later on
				this.marked_as_noise.splice(n,1);
			}
		}
		console.log("Actual marked count = " + this.marked_as_noise.length + "["+ (this.marked_as_noise.length*100/this.measurement_count)+"%]");
	}

	// ---
	// Description: DBSCAN cluster expansion
	// ---
	SPE.prototype.expandCluster = function(cluster, region){
		var found_new_regions = [];
		for(var i=0; i < region.length; i++){
			var index = region[i];
			if(!this.measurements[index].dbscan_visited){
				this.measurements[index].dbscan_visited = true;
				var new_region = this.regionQuery(index);
				if(new_region.length >= this.min_region_size){
					found_new_regions.push(new_region);
				}
			}
			if(this.measurements[index].dbscan_cluster < 0){
				cluster.addMember(index);
				this.measurements[index].dbscan_cluster = cluster.id;
			}
		}
		for(var i=0; i< found_new_regions.length; i++){
			this.expandCluster(cluster, found_new_regions[i]);
		}
	}

	// ---
	// Description: sort clusters based on center cluster
	// ---
	SPE.prototype.prepareCenterCluster = function(){
		var self = this;
		var clusterDistFunc = function(c1,c2){
			// use the fv of cluster center scatter plots
			// the one of centers with smallest sum of distances between centers marks the center cluster
			return self.measurementDistance(c1.center_index, c2.center_index);
		};
		self.cluster_of_clusters = new Cluster("Cluster of Clusters");
		// prepare cluster object
		// this exception stores the actual clusters and not indicies
		for(var c=0; c<this.clusters.length; c++){
			self.cluster_of_clusters.addMember(self.clusters[c]);
		}

		// find center cluster
		self.cluster_of_clusters.findCenterMember(clusterDistFunc);
		// find farthest cluster
		self.cluster_of_clusters.findFarthestMember(clusterDistFunc);

		console.log("Center " + self.measurements[self.cluster_of_clusters.center_index.center_index].doi,
					"Farthest " + self.measurements[self.cluster_of_clusters.farthest_from_center_index.center_index].doi,
					"Outlier " + self.measurements[self.cluster_of_clusters.farthest_from_farthest_index.center_index].doi);
	}

	// ---
	// Description: sort clusters based on center cluster
	//				center cluster is lowest value, and by the distance from it the other are sorted
	// ---
	SPE.prototype.sortClusters = function(self, sorter){
		var sorterFunc;
		switch(sorter.toLowerCase()){
			case "fromcenter":
				sorterFunc = function(a,b){return self.fromCenterClusterSorter(a,b);};
				break;
			case "fromfarthest":
				sorterFunc = function(a,b){return self.fromFarthestClusterSorter(a,b);};
				break;
			case "betweenoutliers":
				sorterFunc = function(a,b){return self.betweenOutliersClusterSorter(a,b);};
				break;
			default:
				throw "Unknown sorter string: " + sorter;
		}
		this.clusters.sort(sorterFunc);
	}

	SPE.prototype.fromCenterClusterSorter = function(c1, c2){
		if(c1.id == c2.id){
			return 0;
		}
		if(c1.id == this.cluster_of_clusters.center_index.id){
			return -1;
		}
		if(c2.id == this.cluster_of_clusters.center_index.id){
			return 1;
		}
		// if none is cluster center calculate the distances
		var center2c1 = this.measurementDistance(c1.center_index, this.cluster_of_clusters.center_index.center_index);
		var center2c2 = this.measurementDistance(c2.center_index, this.cluster_of_clusters.center_index.center_index);
		// since float is unstable - use ifs
		if(center2c1 < center2c2){
			return -1;
		}
		if(center2c1 > center2c2){
			return 1;
		}
		return 0;
	}

	SPE.prototype.fromFarthestClusterSorter = function(c1, c2){
		if(c1.id == c2.id){
			return 0;
		}
		if(c1.id == this.cluster_of_clusters.farthest_from_center_index.id){
			return -1;
		}
		if(c2.id == this.cluster_of_clusters.farthest_from_center_index.id){
			return 1;
		}
		// if none is farthestr cluster calculate the distances
		var farthest2c1 = this.measurementDistance(c1.center_index, this.cluster_of_clusters.farthest_from_center_index.center_index);
		var farthest2c2 = this.measurementDistance(c2.center_index, this.cluster_of_clusters.farthest_from_center_index.center_index);
		// since float is unstable - use ifs
		if(farthest2c1 < farthest2c2){
			return -1;
		}
		if(farthest2c1 > farthest2c2){
			return 1;
		}
		return 0;
	}

	// betweenOutliersClusterSorter:
	// we use the progress between farthest from center till the farthest member from it
	// we form a triangle like this:
	//						     cluster
	//							   /|\
	//							  / | \
	//						  f	 /	|h \ s
	//							/	|	\
	//	[Low]farthestFromCenter	-------- farthestFromFarthest [High]
	//						  m = g | e
	//	e = m - g
	//	f^2 = h^2 + g^2
	//	h^2 = s^2 - e^2
	//	f^2 = s^2 - e^2 + g^2
	//	f^2 = s^2 - (m - g)^2 + g^2
	//	f^2 - s^2 = -m^2 + 2mg - g^2 + g^2
	//	2mg = f^2 - s^2 + m^2 = Constant
	//	g = C / 2m
	//
	//	sort by g
		SPE.prototype.betweenOutliersClusterSorter = function(c1, c2){
		if(c1.id == c2.id){
			return 0;
		}
		if(c1.id == this.cluster_of_clusters.farthest_from_center_index.id){
			return -1;
		}
		if(c2.id == this.cluster_of_clusters.farthest_from_center_index.id){
			return 1;
		}
		if(c1.id == this.cluster_of_clusters.farthest_from_farthest_index.id){
			return 1;
		}
		if(c2.id == this.cluster_of_clusters.farthest_from_farthest_index.id){
			return -1;
		}
		// calculate g for both cluster c1 and c2
		// start with distances
		// f
		var f1 = this.measurementDistance(c1.center_index, this.cluster_of_clusters.farthest_from_center_index.center_index);
		var f2 = this.measurementDistance(c2.center_index, this.cluster_of_clusters.farthest_from_center_index.center_index);
		// s
		var s1 = this.measurementDistance(c1.center_index, this.cluster_of_clusters.farthest_from_farthest_index.center_index);
		var s2 = this.measurementDistance(c2.center_index, this.cluster_of_clusters.farthest_from_farthest_index.center_index);
		// m - is constant
		var m = this.cluster_of_clusters.outlier_distance;
		var mSquared = Math.pow(m, 2);
		var m2 = 2 * m;
		// constant C
		var g1 = (mSquared + Math.pow(f1, 2) - Math.pow(s1, 2)) / m2;
		var g2 = (mSquared + Math.pow(f2, 2) - Math.pow(s2, 2)) / m2;

		// since float is unstable - use ifs
		if(g1 < g2){
			return -1;
		}
		if(g1 > g2){
			return 1;
		}
		return 0;
	}



	// ---
	// Description: Using the measurement plots the scatter plot as selector child
	// ---
	SPE.prototype.plotScatterPlot = function(selector, measurement, width, height, showDetails){
		// since we want all points inside the canvas, we need a padding
		var padding = d3.min([0.075 * width, 0.075 * height]);
		// set the scale functons to map the points to given canvas
		var scaleX = d3.scaleLinear().domain([measurement.minX, measurement.maxX]).range([padding, width - padding]);

		// svg draws from top left corner - therefore reverse range
		var scaleY = d3.scaleLinear().domain([measurement.minY, measurement.maxY]).range([height - padding, padding]);
		// the actual SVG parts
		var svg = selector.append("svg")
			.attr("id", measurement.doi)
			.attr("width", width)
			.attr("height",height);
		var plotGroup =	svg.selectAll("g").data(measurement.pairs)
			.enter().append("g").attr("class", "pointGroup").attr("id", function(d,i){
				return measurement.doi + "["+i+"]";
			});
		// order of appending tells the order of rendering
		plotGroup.append("circle")
				.attr("cx", function(pair){return scaleX(measurement.getX(pair));})
				.attr("cy", function(pair){return scaleY(measurement.getY(pair));})
				// on hover event we want to heva text display on top of points
				// we neeed to reorder the elements
				.on("mouseover", function() {
					var parentID = this.parentNode.id;
					svg.sort(function (a, b) {			// select the parent and sort the path's
					if (a.id != parentID) return -1;	// a is not the hovered element, send "a" to the back
					else return 1;						// a is the hovered element, bring "a" to the front
				})});
		if(showDetails){
			plotGroup.append("text")
					.text(function(pair){return pair.join(",")})
					.attr("x", function(pair){return scaleX(measurement.getX(pair));})
					.attr("y", function(pair){return scaleY(measurement.getY(pair));});				
			// define axis
			svg.append("g").attr("class", "axis")
					.attr("transform", "translate(0," + (height - padding) + ")")
					.call(d3.axisBottom(scaleX).ticks(5));
			svg.append("g").attr("class", "axis")
				.attr("transform", "translate(" + padding + ",0)")
				.call(d3.axisLeft(scaleY).ticks(5));
			svg.append("text")
				.attr("class", "axisName")
				.attr("x", width*0.5)
				.attr("y",height - padding*0.25)
				.text(measurement.x_axis);
			svg.append("text")
				.attr("class", "axisName")
				.attr("x", -height*0.5)
				.attr("y", padding*0.25)
				.attr("transform", "rotate(270)")
				.text(measurement.y_axis);
			svg.append("text")
				.attr("class", "axisName")
				.attr("x", width*0.5 - measurement.doi.length)
				.attr("y", padding*0.25)
				.text(measurement.doi);
		}
	}

	// ---
	// Description: Using the measurement plots the scatter plot as selector child
	// ---
	SPE.prototype.plotScatterPlotMatrix = function(selector, measurements, width, height, maxCols, maxRows, showDetails){
		var margin = 10; // 2x 1px border + 2x 0.2em margin in CSS
		var cols = d3.min([measurements.length, maxCols]);
		var rows = d3.min([Math.ceil(measurements.length / cols), maxRows]);
		var sp_width = Math.floor((width - margin * (cols + 1)) / cols);
		var sp_height = Math.floor((height - margin * (rows + 1)) / rows);
		//console.log(sp_width, sp_height, margin)
		for(var m=0; m < measurements.length; m++){
			this.plotScatterPlot(selector, measurements[m], sp_width, sp_height, showDetails);
		}
	}

	// ---
	// Description: use this.cluster centers to plot a matrix  of scatter plot represantatives
	// ---
	SPE.prototype.plotRepresentativeMatrix = function(){
		var represantatives = [];
		for(var c=0; c<this.clusters.length; c++){
			represantatives.push(this.measurements[this.clusters[c].center_index]);
		}

		var margin = 8;
		var width = window.innerWidth-2*margin;
		var height = window.innerHeight-2*margin;
		var max_cols = Math.floor(width / this.matrix_sp_width);
		var max_rows = Math.floor(height / this.matrix_sp_heigh);
		console.log("maxCols " + max_cols + " maxRows " + max_rows)

		this.plotScatterPlotMatrix(d3.select("#canvas"), represantatives, width, height, max_cols, max_rows)
	}

	return SPE;
})();

// the helper object that stores the values used in clustering and visualization
var Measurement = (function () {
	// ---
	// Description: Constructor.
	// ---
	function Measurement(label, raw_data, feature_vector) {
		// failsafe check if IDs match
		if(label.id == raw_data.id && raw_data.id == feature_vector.id){
			this.id = label.id;								// measurement ID
			this.pairs = raw_data.pairs;					// 2D array of (x,y) values
			this.getX = function(pair){	return pair[0];}	// x coordinate getter for 2D array element
			this.getY = function(pair){	return pair[1];}	// y coordinate getter for 2D array element
			this.minX = d3.min(this.pairs, this.getX);		// minimum x in 2D array
			this.maxX = d3.max(this.pairs, this.getX);		// maximum x in 2D array
			this.minY = d3.min(this.pairs, this.getY);		// minimum y in 2D array
			this.maxY = d3.max(this.pairs, this.getY);		// maximum y in 2D array
			this.x_axis = label.x_axis.split("_").join(" ");						// x axis type - string, e.q. degrees
			this.y_axis = label.y_axis.split("_").join(" ");						// y axis type - string, e.q. pressure
			this.timestamp = label.timestamp;				// the date and time of the measurement
			this.latitude = label.latitude;					// location latitude
			this.longitude = label.longitude;				// location longitude
			this.doi = label.doi;							// DOI [Digital Object Identifier] of measurement
			this.fv_type = feature_vector.src_filename;		// name of the feature vector
			this.fv = feature_vector.features;				// actual feature vector
			this.feature_count = this.fv.length;			// numeber of features in vector
			// additional data for clustering and testing output
			this.dbscan_visited = false;
			this.dbscan_cluster = -1;
			this.label_src = label.src_filename;
			this.raw_src = raw_data.src_filename;
		}
		else{
			throw "ID match failure: [" +  label.id + ", " + raw_data.id + ", " +  feature_vector.id + "]";
		}
	}

	// ---
	// Description: Generate string describing the data files
	// ---
	Measurement.prototype.toString = function () {
		return this.pairs.length + " measurements of " + this.x_axis + " X " + this.y_axis +
				"\n DOI=[" + this.doi +"]" +
				"\n X_range=[" + this.minX + ", " + this.maxX + "]" +
				"\n Y_range=[" + this.minY + ", " + this.maxY + "]" +
				"\n GPS=[" + this.longitude + ", " + this.latitude + "] TIMESTAMP=[" + this.timestamp +"]" +
				"\n FeatureType=" + this.fv_type + "[" + this.fv.length + " features]" +
				"\n Sources: " + [this.label_src + ".csv", this.raw_src + ".data", this.fv_type + ".fv"].join(",") + " at ID=" + this.id;
	}

	return Measurement;
})();


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
		this.outlier_distance = -1;
	}

	// ---
	// Description: Add Measurement to cluster.
	// ---
	Cluster.prototype.addMember = function(index){
		this.member_indicies.push(index);
		this.size++;
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
		this.outlier_distance = maxValue;
	}
	return Cluster;
})();


// ---
// Description: Starts the SPE engine + enables loading information to visible before launch. Used as onload function.
// ---
function startSPE() {
	// initialize object
	var spe = new SPE();
	// as a start load the text instead of animation while loading
	spe.generateLoaderMessage("Scatter Plot Explorer");
	// timeout allows the repaint to catch a break between preload and init
	setTimeout(function(){
		spe.preloadData();
	}, 1);
}

// ---
// Description: Given a new filelist, it restarts the SPE engine with it. Should be used as a onClick function, etc.
// ---
function restartSPE(filelist){
	alert("TO DO: kill previous startSPE execution");
	// change the holder with filelist information
	d3.select("body").attr("id", filelist);
	// restart engine
	startSPE();
}

//SET UP LOAD ON START
window.onload = startSPE;