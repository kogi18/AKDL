Structure:
	spe/
		csv/
!!!			TODO.css 	[main CSS file]

		data/			[contains the benchmark files]
			*.data		[raw data files]
			*.csv		[label files]
			*.fv		[feature vector files]
			*.list		[list of files in folder to use - default file is filename.list

		js/
			d3.min.js	[the D3 engine that builds the base for SPE]
			spe.js		[the engine of SPE]

		index.html		[the HTML base, where all is run]

Data / benchmark folder instructions
	
	SPE recognizes only .data, .csv, .fv and .list file formats. There is no problem with additional files in folder, however SPE will recognize and use only files listed in the selected .list file and which are of said formats, others will be ignored.

	There can be multiple .list files but only the one specified in the loadData(filelist) call will be used. If filelist is not specified, the default value ALL.list will be used, which can be simply genrated with ls > ALL.list.