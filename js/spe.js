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
		this.dbscan_worker = undefined;
		this.eps = 0;
		this.min_region_size = 5;
		this.selected_cluster_measurment_indices = [];
		this.clusters = [];
		this.cluster_of_clusters = null;
		this.marked_as_noise = [];
		this.selected_sorting = "fromcenter";
		// useful constants
		this.string_line_seperator = "\n" + Array(40).join("-") + "\n";
		this.matrix_sp_min_width = 300;
		this.matrix_sp_min_height = 250;
		// may depened on browser slider - I use chrome 
		this.canvas_window_subtraction_width = 64;
		// menu = 57px height + 20px margin + 1px border = 78px
		// canvas = margin 1em + 2 x  1px border = 18px
		this.canvas_window_subtraction_height = 96;
		this.canvas_window_subtraction_sort_form = 124;
		this.body_structure = ["loader", "form", "canvas"];
		this.menu_options = [
								[
									"Scatter Plot Explorer", null
								],[
									"List",	[], "menu-list"
								],[
									"Generate",	[
														["Measurements", "menu-data-select"]
													],
									"menu-restart"
								],[
									"Overview",		[
														["Matrix", "menu-matrix-overview"],
														["In-line", "menu-inline-overview"]
													],
									"menu-overview"
								],[
									"Cluster",		[
														["Matrix", "menu-matrix-cluster" ],
														["In-line", "menu-inline-cluster" ]
													],
									"menu-cluster"
								],[
									"Scatter Plot", [], "menu-sp"
								]
		];
		this.logo_sp = [[35, 307], [34, 307], [22, 307], [135, 244], [51, 265], [74, 244], [57, 254], [282, 43], [49, 275], [125, 233], [71, 233], [23, 307], [165, 233], [60, 254], [67, 233], [44, 286], [281, 65], [43, 286], [41, 286], [24, 307], [28, 286], [30, 297], [77, 233], [110, 233], [33, 297], [32, 307], [65, 254], [62, 265], [46, 275], [274, 212], [282, 75], [101, 233], [281, 54], [189, 244], [27, 297], [58, 265], [240, 233], [29, 297], [75, 233], [281, 128], [280, 170], [83, 223], [69, 244], [61, 254], [30, 307], [47, 265], [53, 265], [48, 275], [55, 254], [281, 43], [46, 286], [39, 297], [81, 233], [89, 244], [281, 33], [25, 297], [36, 307], [23, 297], [68, 244], [278, 191], [56, 265], [54, 275], [34, 297], [59, 254], [37, 297], [281, 22], [79, 244], [38, 297], [64, 254], [31, 307], [45, 286], [68, 254], [36, 297], [281, 117], [50, 275], [94, 233], [148, 254], [73, 233], [26, 307], [282, 65], [63, 265], [40, 297], [76, 244], [267, 233], [42, 286], [66, 244], [25, 307], [27, 318]];
		this.logo_mg = "<path fill='none' stroke='#000' stroke-width='36' stroke-linecap='round' d='m280,278a153,153 0 1,0-2,2l170,170m-91-117 110,110-26,26-110-110'/>"
		this.logo_dim = 490;
		this.reloadSPE = null; //function holder	
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
	// Description: Function for setting all propeties of object to null
	// ---
	SPE.prototype.makeMeNull = function(){
		for (var key in this) {
			if (this.hasOwnProperty(key)) {
				//Now, object[key] is the current value
				if (this[key]){
					delete this[key];
				}
			}
		}
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
			// fill menu list option
			d3.select("#menu-list").selectAll("li").data(self.lists)
				.enter().append("li").classed("menu-option", true)
					.text(function(file){ return file.split(".")[0]})
					.on("click", function(file) {
						var reload = self.reloadSPE;
						self.makeMeNull();
						reload(file);
			});

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
			this.hideLoading(true);
			this.hideMenu(false);
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
	// Description: Generate basic div structure in body
	// ---
	SPE.prototype.generateBodyStructure = function(){
		// as a start remove all inside body
		d3.selectAll("body > *").remove();
		// append badic div structure
		d3.select("body").selectAll("div").data(this.body_structure)
			.enter().append("div")
				.attr("id", function(d){ return d;})
				.classed("hidden", true);
		this.generateMenu();
		this.hideMenuItem("menu-overview",true);
		this.hideMenuItem("menu-cluster",true);
		this.hideMenuItem("menu-sp",true);
		d3.selectAll("nav").classed("hidden", true);
		this.generateLoaderStructure();
	}

	// ---
	// Description: Switch selector visibility
	// ---
	SPE.prototype.hideElement = function(selector, hide){
		selector.classed("hidden", hide);
	}

	// ---
	// Description: Wrapper for simple menu hiding
	// ---
	SPE.prototype.hideMenu = function(hide){
		this.hideElement(d3.selectAll("nav"), hide);
	}

	// ---
	// Description: Wrapper for simple menu item hiding
	// ---
	SPE.prototype.hideMenuItem = function(menuItemID, hide){
		var parent = d3.select("#" + menuItemID).node().parentNode;
		if(hide){
			parent.className = "hidden";
		}
		else{
			parent.className = "menu-option";
		}
	}

	// ---
	// Description: Wrapper for simple loading animation hiding
	// ---
	SPE.prototype.hideLoading = function(hide){
		this.hideElement(d3.selectAll("#loader"), hide);
	}
	// ---
	// Description: Wrapper for simple form hiding
	// ---
	SPE.prototype.hideForm = function(hide){
		this.hideElement(d3.selectAll("#form"), hide);
	}
	// ---
	// Description: Wrapper for simple plot hiding
	// ---
	SPE.prototype.hideCanvas = function(hide){
		this.hideElement(d3.selectAll("#canvas"), hide);
	}
	// ---
	// Description: Generate navigation menu
	// ---
	SPE.prototype.generateMenu = function(){
		// as a start remove previous menu if exists
		d3.selectAll("nav").remove();
		// create nav as first child of body
		var menu = d3.select("body").insert("nav",":first-child").append("ul");
		menu.selectAll("li").data(this.menu_options)
			.enter().append("li").classed("menu-option", function(d){ return d[1] != null;})
				.html(function(menuItem){
					var submenu = "";
					if(menuItem[1] != null){
						// generate submenu
						submenu += "<ul id='"+ menuItem[2] +"'>";
						if(menuItem[1].length > 0){
							for(var sub=0; sub < menuItem[1].length; sub++){
								submenu += "<li id='" + menuItem[1][sub][1]+ "' class='menu-option'>"+menuItem[1][sub][0]+"</li>";
							}
						}
						submenu += "</ul>";
					}
					return menuItem[0] + submenu;
		});

		// draw logo
		// need scales since using actual SP data
		var scaleX = d3.scaleLinear().domain([0, 305]).range([0, this.logo_dim]);
		var scaleY = d3.scaleLinear().domain([0, 341]).range([0, this.logo_dim]);
		var logo = menu.insert("svg",":first-child").attr("width", this.logo_dim + 250).attr("height", this.logo_dim + 110);
		// generate logo
		logo.append("g").attr("id","logo-sp").selectAll("circle").data(this.logo_sp)
			.enter().append("circle")
				.attr("cx", function(d){ return scaleX(d[0]);})
				.attr("cy", function(d){ return scaleY(d[1]);});
		logo.append("g").attr("id","logo-magnifying-glass").html(this.logo_mg);
		// add functions
		this.generateMenuFunctions();
	}

	// ---
	// Description: Bind navigation menu functions
	// ---
	SPE.prototype.generateMenuFunctions = function(){
		var self = this;
		d3.select("#menu-data-select").on("click", function(){
			self.measurements = [];
			self.clusters = [];
			self.hideMenuItem("menu-overview",true);
			self.hideMenuItem("menu-cluster",true);
			self.hideMenuItem("menu-sp",true);
			self.clearGeneratedElements();
			self.selectDataGUI();
		});
		d3.select("#menu-matrix-overview").on("click", function(){
			self.selected_cluster_measurment_indices = [];
			self.hideMenuItem("menu-cluster",true);
			self.hideMenuItem("menu-sp",true);
			self.clearGeneratedElements();
			self.plotRepresentativeMatrix();

		});
		d3.select("#menu-inline-overview").on("click", function(){
			self.selected_cluster_measurment_indices = [];
			self.hideMenuItem("menu-cluster",true);
			self.hideMenuItem("menu-sp",true);
			self.clearGeneratedElements();
			self.plotRepresentativeInline();
		});
		d3.select("#menu-matrix-cluster").on("click", function(){
			self.hideMenuItem("menu-sp",true);
			self.clearGeneratedElements();
			self.plotClusterAsMatrix(self.cluster_of_clusters.getMember(self.selected_cluster_id));
		});
		d3.select("#menu-inline-cluster").on("click", function(){
			self.hideMenuItem("menu-sp",true);
			self.clearGeneratedElements();
			self.plotClusterAsInlineScatterPlot(self.cluster_of_clusters.getMember(self.selected_cluster_id));
		});
	}

	// ---
	// Description: Generate a form with 3 dropdowns to select the files to be used
	// ---
	SPE.prototype.selectDataGUI = function(){
		var self = this;
		// failsafe to remove all objects
		this.clearGeneratedElements();
		// generate dropdowns
		var formDivs = d3.select("#form").selectAll("div")
			.data([["Meta Data", this.label_files, "selected-label-option"],
					["Raw Data",this.raw_files, "selected-raw-option"],
					["Feature Vector",this.fv_files, "selected-fv-option"],
					["Minimal region size", this.min_region_size, "min-region-size-val"],
					["Epsilon border", this.eps, "eps-val"]]).enter().append("div");
		formDivs.append("label")
			.text(function(d){ return d[0];});
		// select only those with array an create selects
		formDivs.filter(function(d){ return Array.isArray(d[1])})
			.append("select")
				.attr("id", function(d){ return d[2];})
					.selectAll("option")
						.data(function(d){ return d[1];})
							.enter().append("option")
								.text(function(d){return d;})
								.attr("value", function(d,i){ return i})
								// redundant but works for selected option - problem is the double data binding
								.property("selected", function(d){ return d == self.label_files[self.selected_label] || d == self.raw_files[self.selected_raw] || d == self.fv_files[self.selected_fv];});
		// select text inputs
		formDivs.filter(function(d){ return !Array.isArray(d[1])})
			.append("input")
				.attr("type","text")
				.attr("id", function(d){ return d[2];})
				.attr("value", function(d){ return d[1];});

		// add event button
		d3.select("#form").append("div").classed("button",true)
			.append("button").text("DBSCAN").on("click", function(){
			self.selected_label = d3.select("#selected-label-option").node().value;
			self.selected_raw = d3.select("#selected-raw-option").node().value;
			self.selected_fv = d3.select("#selected-fv-option").node().value;
			self.min_region_size = parseInt(d3.select("#min-region-size-val").node().value);
			self.eps = parseFloat(d3.select("#eps-val").node().value);
			self.measurement_count = self.raw[self.selected_raw].length;
			d3.select("#form").selectAll("div").remove();
			self.hideForm(true);
			self.hideMenu(true);
			self.hideLoading(false);
			self.generateLoaderMessage("Preparing Measurements");
			self.combineData();	// call the creation of the measurements objects
		});

		// STARTING VALUE IS 0 - in this case try to load tested values
		if(self.eps == 0 && self.tested_eps[self.fv_files[self.selected_fv]]){
			d3.select("#eps-val").attr("value", self.tested_eps[self.fv_files[self.selected_fv]]);
		}
		// on select event try using tested values
		d3.select("#selected-fv-option").on("change", function(){
			var fv_read =  d3.select("#selected-fv-option").node().value;
			if(self.tested_eps[self.fv_files[fv_read]]){
				d3.select("#eps-val").attr("value", self.tested_eps[self.fv_files[fv_read]]);
			}
		});

		// undhide
		self.hideForm(false);
	}
	

	// ---
	// Description: A failsafe that selects all elements we may generate and removes them - for unforseen situations fix
	// ---
	SPE.prototype.clearGeneratedElements = function(){
		// Terminate loader
		d3.select("#loader-msg").selectAll("div").remove();
		this.generateLoaderMessage("Scatter Plot Explorer");
		this.hideLoading(true);
		// Clean form
		d3.select("#form").selectAll("div").remove();
		this.hideForm(true);
		// Clean all SVGs
		d3.select("#canvas").attr("style", null).selectAll("svg").remove();
		this.hideCanvas(true);

		console.log("TO DO function for clearing");
	}


	// ---
	// Description: Generate loader structure
	// ---
	SPE.prototype.generateLoaderStructure = function(){
		// need scales since using actual SP data
		var scaleX = d3.scaleLinear().domain([0, 305]).range([0, this.logo_dim]);
		var scaleY = d3.scaleLinear().domain([0, 341]).range([0, this.logo_dim]);
		var logo = d3.select("#loader").append("div").attr("id","loader-SVG")
			.append("svg").attr("width", this.logo_dim + 410).attr("height", this.logo_dim + 400);
		// generate logo
		logo.append("g").attr("id","loader-logo-sp").selectAll("circle").data(this.logo_sp)
			.enter().append("circle")
				.attr("cx", function(d){ return scaleX(d[0]);})
				.attr("cy", function(d){ return scaleY(d[1]);});
		logo.append("g").attr("id","loader-logo-magnifying-glass").html(this.logo_mg);
		d3.select("#loader").append("div").attr("id", "loader-msg")
	}

	// ---
	// Description: Dynamic animated loader message - type of animation defined in CSS
	// ---
	SPE.prototype.generateLoaderMessage = function(msg){
		d3.select("#loader-msg").selectAll("div").data(msg.split("\n"))
			.text(function(d){return d;})
			.enter().append("div").text(function(d){return d;})
			.exit().remove();
		// force redraw by hiding and showing msg element
		d3.select("#loader-msg").classed("hidden",true).classed("hidden",false);
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
		// for loading message
		this.generateLoaderMessage("DBSCAN\nEpsilon: "+this.eps+"\nMinimal Region Size: "+this.min_region_size);
		var self = this;
		setTimeout(function(){
			self.rundWorkerForDBSCAN();
			//self.dbscan();
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
					this.generateLoaderMessage("DBSCAN\nMeasurement " + m + "/" + this.measurement_count+ "\nInitial region size: " + region.length);
					console.log("Region size " + region.length + " [from all " + this.measurement_count +"]");
					var cluster = new Cluster(this.clusters.length);
					this.expandCluster(cluster, region);
					// find center element == representative
					cluster.findCenterMember(distFun);
					// find farthest element from ceneter and the element farthest from farthest
					cluster.findFarthestMember(distFun);
					this.clusters.push(cluster);
					this.generateLoaderMessage("DBSCAN\nCreated cluster " + cluster.id + "\nHolds " + cluster.size + " measurements");
					console.log("Added " + cluster.id + " cluster with " + cluster.size + " elements and center member " + cluster.center_index);
				}
			}
		}
		this.postDBSCAN();
	}


	// ---
	// Description: DBSCAN distance function
	// ---
	SPE.prototype.postDBSCAN = function(){
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

		var avgSize = 0;
		for(var c=0; c < this.clusters.length; c++){
			avgSize += this.clusters[c].size;
		}
		avgSize = avgSize / this.clusters.length;
		// report clustering
		console.log(this.measurements[0].fv_type + " has EPS["+this.eps+"] and "+ this.clusters.length + "clusters with AVG size " + avgSize);
		this.hideLoading(true);
		this.hideMenu(false);
		this.hideMenuItem("menu-overview", false);
		this.plotRepresentativeMatrix();
	}

	// ---
	// Description: DBSCAN worker execution
	// ---
	SPE.prototype.rundWorkerForDBSCAN = function(){
		this.clusters = [];
		this.cluster_of_clusters = null;
		this.marked_as_noise = [];
		var self = this;
		this.dbscan_worker = new Worker('js/spe-dbscan-worker.js');
		//setup reciever
		this.dbscan_worker.addEventListener('message', function(e) {
			var data = e.data;
			switch (data.cmd) {
				case 'console':
					console.log(data.console);
					break;
				case 'msg':
					self.generateLoaderMessage(data.msg);
					break;
				case 'test':
					console.log(data.test);
					// send inputs
					self.dbscan_worker.postMessage({'cmd': "inputs", 'msg': {'eps' : self.eps, 'min_region_size' : self.min_region_size, 'm' : JSON.stringify(self.measurements)}});
					break;
				case 'inputs':
					console.log(data.inputs);
					// start dbscan
					self.dbscan_worker.postMessage({'cmd': "start"});
					break;
				case 'noise':
					self.marked_as_noise = data.noise;
					//console.log(this.marked_as_noise);
					// noise is last element to recieve - shutdown worker
					self.dbscan_worker.postMessage({'cmd': "stop"});
					self.dbscan_worker.terminate();
	    			self.dbscan_worker = undefined;
	    			// continue work
	    			self.postDBSCAN();
					break;
				case 'cluster':
					var cluster = new Cluster(0);
					cluster.fromJSON(data.cluster);
					for(var m=0; m < cluster.size; m++){
						self.measurements[cluster.getMember(m)].dbscan_cluster = cluster.id;
					}
					self.clusters.push(cluster);
					break;
				default:
					console.log('Unknown command: ' + data.cmd);
			};
		}, false);

		// check if working
		this.dbscan_worker.postMessage({'cmd': "test", 'msg': "Are you working?"});
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
	SPE.prototype.sort = function(self, type, sorter, cluster){
		var sorterFunc;
		type = type.toLowerCase();
		switch(type + sorter.toLowerCase()){
			case "measurementfromcenter":
				sorterFunc = function(a,b){
					return self.fromCenterSorter(
								a,
								b,
								cluster.center_index
				);};
				break;
			case "measurementfromfarthest":
				sorterFunc = function(a,b){
					return self.fromFarthestSorter(
								a,
								b,
								cluster.farthest_from_center_index
				);};
				break;
			case "measurementbetweenoutliers":
				sorterFunc = function(a,b){
					return self.betweenOutliersSorter(
								a,
								b,
								cluster.farthest_from_center_index,
								cluster.farthest_from_farthest_index
				);};
				break;
			case "clusterfromcenter":
				sorterFunc = function(c1,c2){
					return self.fromCenterSorter(
								c1.center_index,
								c2.center_index,
								self.cluster_of_clusters.center_index.center_index
				);};
				break;
			case "clusterfromfarthest":
				sorterFunc = function(c1,c2){
					return self.fromFarthestSorter(
								c1.center_index,
								c2.center_index,
								self.cluster_of_clusters.farthest_from_center_index.center_index
				);};
				break;
			case "clusterbetweenoutliers":
				sorterFunc = function(c1,c2){return self.betweenOutliersSorter(
								c1.center_index,
								c2.center_index,
								self.cluster_of_clusters.farthest_from_center_index.center_index,
								self.cluster_of_clusters.farthest_from_farthest_index.center_index
				);};
				break;
			default:
				throw "Unknown sorter string [" + sorter + "] for type [" + type + "]";
		}
		if(type == "cluster"){
			self.clusters.sort(sorterFunc);
		}
		else if(type == "measurement"){
			self.selected_cluster_measurment_indices.sort(sorterFunc);
		}
		else{
			throw "Unknown type: " + type;
		}
	}

	SPE.prototype.fromCenterSorter = function(c1, c2, center){
		if(c1 == c2){
			return 0;
		}
		if(c1 == center){
			return -1;
		}
		if(c2 == center){
			return 1;
		}
		// if none is cluster center calculate the distances
		var center2c1 = this.measurementDistance(c1, center);
		var center2c2 = this.measurementDistance(c2, center);
		// since float is unstable - use ifs
		if(center2c1 < center2c2){
			return -1;
		}
		if(center2c1 > center2c2){
			return 1;
		}
		return 0;
	}

	SPE.prototype.fromFarthestSorter = function(c1, c2, farthest){
		if(c1 == c2){
			return 0;
		}
		if(c1 == farthest){
			return -1;
		}
		if(c2 == farthest){
			return 1;
		}
		// if none is farthestr cluster calculate the distances
		var farthest2c1 = this.measurementDistance(c1, farthest);
		var farthest2c2 = this.measurementDistance(c2, farthest);
		// since float is unstable - use ifs
		if(farthest2c1 < farthest2c2){
			return -1;
		}
		if(farthest2c1 > farthest2c2){
			return 1;
		}
		return 0;
	}

	// betweenOutliersSorter:
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
	SPE.prototype.betweenOutliersSorter = function(c1, c2, outlier1, outlier2){
		if(c1 == c2){
			return 0;
		}
		if(c1 == outlier1){
			return -1;
		}
		if(c2 == outlier1){
			return 1;
		}
		if(c1 == outlier2){
			return 1;
		}
		if(c2 == outlier2){
			return -1;
		}
		// calculate g for both cluster c1 and c2
		// start with distances
		// f
		var f1 = this.measurementDistance(c1, outlier1);
		var f2 = this.measurementDistance(c2, outlier1);
		// s
		var s1 = this.measurementDistance(c1, outlier2);
		var s2 = this.measurementDistance(c2, outlier2);
		// m - is constant
		var m = this.measurementDistance(outlier1, outlier2);
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
	// Description: Generate a form with a dropdown of possible sorts
	// ---
	SPE.prototype.selectSortGUI = function(type, cluster){
		var self = this;
		d3.select("#form").append("div").append("select").attr("id","overview-sort")
			.selectAll("option").data(["From Center", "From Farthest", "Between Outliers"])
				.enter().append("option")
					.text(function(d){return d;})
					.attr("value",function(d){return d.split(" ").join("");})
					.property("selected", function(d){return d.split(" ").join("") == self.selected_sorting;});
		d3.select("#form").append("div").classed("button",true).append("button").text("SORT").on("click", function(){
			self.selected_sorting = d3.select("#overview-sort").node().value
			self.sort(self, type, self.selected_sorting, cluster);
			self.hideForm(true);
			d3.select("#canvas").selectAll("svg").remove();
			d3.select("#form").selectAll("div").remove();
			type = type.toLowerCase();
			if(type == "cluster"){
				self.plotRepresentativeMatrix();
			}
			else if(type == "measurement"){
				self.plotClusterAsMatrix(cluster);
			}
			else{
				throw "Unknown type: " + type;
			}
		});
		self.sort(self, type, self.selected_sorting, cluster);
		// unhide form
		self.hideForm(false);
	}

	// ---
	// Description: Using the measurement plots the scatter plot as selector child
	// ---
	SPE.prototype.plotScatterPlot = function(selector, measurement, width, height, showDetails, msgObject, onClickFun){
		// since we want all points inside the canvas, we need a padding
		var padding = d3.min([0.1 * width, 0.1 * height]);
		// set the scale functons to map the points to given canvas
		var scaleX = d3.scaleLinear().domain([measurement.minX, measurement.maxX]).range([padding, width - padding]);

		// svg draws from top left corner - therefore reverse range
		var scaleY = d3.scaleLinear().domain([measurement.minY, measurement.maxY]).range([height - padding, padding]);
		// the actual SVG parts
		var svg = selector.append("svg")
			.attr("id", "Cluster:"+ measurement.dbscan_cluster + " " + measurement.doi)
			.attr("width", width)
			.attr("height",height);
		// append bg + text to display
		svg.append("rect").attr("width", width).attr("height",height)
			.append("title").text("" + msgObject);
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
					var cx = this.cx.baseVal.value, cy = this.cy.baseVal.value;
					svg.selectAll("g").sort(function (a, b) {
					if (a[0] == cx && a[1] == cy) return 1;		// a is the hovered element, send "a" to the back
					else return -1;								// a is not the hovered element, bring "a" to the front
				})});
		if(showDetails){
			svg.classed("detail", true);
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
		// check if function
		if(this.checkFunctionType(onClickFun)){
			// call function with measure as parameter - may be ignored
			svg.on("click", function(){ var element = this; onClickFun(element, measurement);});
		}
	}

	// ---
	// Description: Using the measurement plots the scatter plot as selector child
	// ---
	SPE.prototype.plotScatterPlotMatrix = function(selector, measurement_indices, width, height, showDetails, msgFun, onClickFun){
		var border = 3.2; // == 0.2em right/bottom border of svg
		var max_cols = Math.floor(width / (this.matrix_sp_min_width + border));
		var max_rows = Math.floor(height / (this.matrix_sp_min_height + border));
		// as a guideline we want more rows than cols
		// also there can only be 1 more rows than cols
		if(max_rows > max_cols + 1){
			max_rows = max_cols + 1;
		}
		// start with 1,1 dimansion matrix and grow it following hte guidelines
		var cols = 1, rows = 1;
		while(cols * rows < measurement_indices.length && (cols < max_cols || rows < max_rows)){
			if(cols + 1 > rows && rows < max_rows || cols == max_cols){
				rows++;
			}
			else if(cols < max_cols){
				cols++;
			}
		}

		var sp_width = width / cols - border;
		var sp_height = Math.floor(height / rows - border);
		console.log("Rows " + rows + "/" + max_rows + " Cols " + cols + "/" + max_cols);
		console.log("Width " + width + "=>" + sp_width + "\nHeight " + height + "=>" + sp_height)
		console.log(measurement_indices.length)

		// fix  selector/canvas height
		selector.style("height", height + "px");
		// check if there is slider
		if(cols * rows >= measurement_indices.length){
			width += 13;
			sp_width = width / cols - border;
					console.log("Width " + width + "=>" + sp_width + "\nHeight " + height + "=>" + sp_height)

		}

		for(var m=0; m < measurement_indices.length; m++){
			this.plotScatterPlot(selector, this.measurements[measurement_indices[m]], sp_width, sp_height, showDetails, msgFun(this.measurements[measurement_indices[m]]), onClickFun);
		}
	}

	// ---
	// Description: helper to check if function is really a function
	// ---
	SPE.prototype.checkFunctionType = function(functionToCheck){
		var getType = {};
		return functionToCheck && getType.toString.call(functionToCheck) === '[object Function]';	
	}

	// ---
	// Description: calculate current canvas size
	// ---
	SPE.prototype.calculateCanvasDim = function(){
		return [window.innerWidth - this.canvas_window_subtraction_width, window.innerHeight - this.canvas_window_subtraction_height];
	}

	// ---
	// Description: use this.cluster centers to plot a matrix  of scatter plot represantatives
	// ---
	SPE.prototype.plotRepresentativeMatrix = function(){
		this.hideCanvas(false);
		// enable form for inside cluster sor_indicesting - sorts also automatically
		this.selectSortGUI("cluster");
		var represantatives = [];
		for(var c=0; c<this.clusters.length; c++){
			represantatives.push(this.clusters[c].center_index);
		}
		// start plotting
		var canvasDim = this.calculateCanvasDim();
		var self = this;
		this.plotScatterPlotMatrix(d3.select("#canvas"),
									represantatives,
									canvasDim[0],
									canvasDim[1] - this.canvas_window_subtraction_sort_form,
									false,
									function(m){ return self.cluster_of_clusters.getMember(m.dbscan_cluster);},
									function(element, m){
										// cluster id is also cluster index in cluster of clusters, while cluster list is sorted
										self.selected_cluster_id = parseInt(element.id.split(" ")[0].split(":")[1]);
										self.clearGeneratedElements();
										self.hideCanvas(false);
										self.plotClusterAsMatrix(self.cluster_of_clusters.getMember(self.selected_cluster_id));
		});
	}


	// ---
	// Description: use this.cluster centers to plot a matrix of inline scatter plots
	// ---
	SPE.prototype.plotRepresentativeInline = function(){
		alert("TO DO");
	}

	// ---
	// Description: use given cluster to plot a matrix of cluster scatter plots
	// ---
	SPE.prototype.plotClusterAsMatrix = function(cluster){
		this.hideCanvas(false);
		this.hideMenuItem("menu-cluster",false);
		// enable form for inside cluster sorting - sorts also automatically
		this.selectSortGUI("measurement", cluster);
		this.selected_cluster_measurment_indices = [];
		for(var m=0; m<cluster.size; m++){
			this.selected_cluster_measurment_indices.push(cluster.getMember(m));
		}
		// start plotting
		var canvasDim = this.calculateCanvasDim();
		var self = this;
		this.plotScatterPlotMatrix(d3.select("#canvas"),
									this.selected_cluster_measurment_indices,
									canvasDim[0],
									canvasDim[1] - this.canvas_window_subtraction_sort_form,
									false,
									function(m){
										var center = self.measurements[cluster.center_index];
										var farthest = self.measurements[cluster.farthest_from_center_index];
										var farthestfarthest = self.measurements[cluster.farthest_from_farthest_index];
										var m_type = ""; // just 1 of many
										if(center.doi == m.doi){
											m_type += "Center Measurement ";	//center index
										}
										if(farthest.doi == m.doi){
											m_type += "Farthest From Center Measurement ";	//Farthest index
										}
										if(farthestfarthest.doi == m.doi){
											m_type += "Farthest From Farthest Measurement ";	//Farthest index
										}
										return m_type + "\n" + m;
									},
									function(element, m){
										self.clearGeneratedElements();
										self.hideCanvas(false);
										self.hideMenuItem("menu-sp",false);
										// correct canvas size
										d3.select("#canvas").style("height", "100%");
										// +13 because we hide scrollbar
										self.plotScatterPlot(d3.select("#canvas"), m, canvasDim[0] + 13, canvasDim[1], true, m, null);
		});
	}

	// ---
	// Description: use given cluster to plot a inline scatter plot for cluster
	// ---
	SPE.prototype.plotClusterAsInlineScatterPlot = function(cluster){
		alert("TO DO");
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
				"\n GPS=[" + this.longitude + ", " + this.latitude + "]" +
				"\n TIMESTAMP=[" + this.timestamp +"]" +
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
	}

	// ---
	// Description: Add Measurement index to cluster.
	// ---
	Cluster.prototype.addMember = function(index){
		this.member_indicies.push(index);
		this.size++;
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
	// Description: Generate string describing the cluster
	// ---
	Cluster.prototype.toString = function () {
		return "Cluster " + this.id + " has " + this.size + " measurements";
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
	}

	return Cluster;
})();


// ---
// Description: Starts the SPE engine + enables loading information to visible before launch. Used as onload function.
// ---
function startSPE() {
	// initialize object
	var spe = new SPE();
	spe.reloadSPE = restartSPE;
	// initialize hidden html structure
	spe.generateBodyStructure();
	// enable loading animation
	spe.hideLoading(false);
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
	// change the holder with filelist information
	d3.select("body").attr("id", filelist);
	// restart engine
	startSPE();
}

//SET UP LOAD ON START
window.onload = startSPE;