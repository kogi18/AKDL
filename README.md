SPE [Scatter Plot Explorer]

Structure:

	spe/
		csv/
			spe.css 	[main CSS file]

		data/			[contains the benchmark files]
			*.data		[raw data files]
			*.csv		[label files]
			*.fv		[feature vector files]
			*.list		[list of files in folder to use - default file is filename.list

		js/
			d3.min.js	[the D3 engine that builds the base for SPE]
			spe.js		[the engine of SPE]
			spe-dbscan-worker.js	[javascript worker for DBSCAN]

		index.html		[the HTML base, where all is run]

Installation

	Copy the files to the document folder of your local server and run the server.
	The application does AJAX requests so it needs a server side.
	For the data information, just copy the files into the data folder according to the specifications.
	The file names need to be included in the used list - see data instructions.

Data / benchmark folder instructions
	
	SPE recognizes only .data, .csv, .fv and .list file formats.
	There is no problem with additional files in folder,
	however SPE will recognize and use only files listed in the selected .list file
	and which are of said formats, others will be ignored.

	There can be multiple .list files but only the one specified in the HTML file body id will be used.
	If filelist is not specified, the default value ALL.list will be used, which can be simpl
	generated with ls > ALL.list

spe.js

	The main engine of ESP is the javascript.
	Simply include it to your html file and follow the index.html structure.
	Also need to include d3.js, since it works as a bridge between data and the HTML DOM.
	Function details are included as notes in code.

	3 Objects build ESP:
		ESP - the engine
		Measurements - holder of individual measurements build by combining *.data, *.csv and *.fv files.
		Cluster - holder of either measurement indices or clusters of indicies.

spe-dbscan-worker.js

	Subset copy of spe.js functions to create a javascript worker for animation/information during DBSCAN.

Clustering

	Data is clustering implements the DBSCAN algorithm with euclidian distances on feature type vectors.
	The input parameters epsiolon and min search region size can be set in ESP object.
	Beware that epsilon is a < type border and not <= and minimum region includes the starting measurement.

Sorting types

	1.From Center

		Center of cluster is the lowest value in array, while others are positioned by the distance from center.
		Center is found as the element with the minimum sum of all distances.
	
	2.From Farthest

		Here on the other hand we use the maximum sum of all distances to find the farthest element from center
		and position the rest as with center version.
	
	3.Between Outliers

		Using the farthest element we find its farthest companion.
		Basically we have 2 outliers if we shrink the cluster size by 2, hence the name.
		Farthest element is set at lowest position, while its outlier companion is set at highest position.
		The remaining elements are sorted using the triangle of distances between:
			1.farthest
			2.element
			3.companion outlier
		We project the sides of the triangle to the distance between outliers and
		use the part starting from farthest to element projection as a guideline for sorting.

Visualization types

	1.Scatter plot
	2.Matrix of scatter plots
	3.Inline scatter plot

Cluster filtering

	1.Clusters: Using only the cluster information.
	2.Metadata: Using meta information, clusters are filtered by metadata