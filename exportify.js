rateLimit = '<p><i class="fa fa-bolt" style="font-size: 50px; margin-bottom: 20px"></i></p><p>Exportify has encountered a <a target="_blank" href="https://developer.spotify.com/documentation/web-api/concepts/rate-limits">rate limiting</a> error. The browser is actually caching those packets, so if you rerun the script (wait a minute and click the button again) a few times, it keeps filling in its missing pieces until it succeeds. Open developer tools with <tt>ctrl+shift+E</tt> and watch under the network tab to see this in action. Good luck.</p>';

// A collection of functions to create and send API queries
utils = {
	// Query the spotify server (by just setting the url) to let it know we want a session. This is literally
	// accomplished by navigating to this web address, where we may have to enter Spotify credentials, then
	// being redirected to the original website.
	// https://developer.spotify.com/documentation/web-api/concepts/authorization
	authorize() { // This is bound to the login button in the HTML and gets called when the login button is clicked.
		window.location = "https://accounts.spotify.com/authorize" +
			"?client_id=d99b082b01d74d61a100c9a0e056380b" +
			"&redirect_uri=" + encodeURIComponent([location.protocol, '//', location.host, location.pathname].join('')) +
			"&scope=playlist-read-private%20playlist-read-collaborative" +
			"&response_type=token";
	},

	// Make an asynchronous call to the server. Promises are *weird*. Careful here! You have to call .json() on the
	// promise returned by the fetch to get a second promise that has the actual data in it!
	// https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch
	// https://eloquentjavascript.net/11_async.html
	async apiCall(url, access_token, delay=0) {
		await new Promise(r => setTimeout(r, delay)); // JavaScript equivalent of sleep(delay), to stay under rate limits ;)
		let response = await fetch(url, { headers: { 'Authorization': 'Bearer ' + access_token} });
		if (response.ok) { return response.json(); }
		else if (response.status == 401) { window.location = window.location.href.split('#')[0]; } // Return to home page after auth token expiry
		else if (response.status == 429) { error.innerHTML = rateLimit; } // API Rate-limiting encountered (hopefully never happens with delays)
		else { error.innerHTML = "The server returned an HTTP " + response.status + " response."; } // the caller will fail
	},

	// Logging out of Spotify is much like logging in: You have to navigate to a certain url. But unlike logging in, there is
	// no way to redirect back to my home page. So open the logout page in an invisible iframe, then redirect to the homepage
	// after a second and a half, which is almost always long enough for the logout request to go through.
	logout() {
		playlistsContainer.innerHTML = '<iframe src="https://www.spotify.com/logout/"></iframe>';
		playlistsContainer.style.display = 'none'; // Wipe the screen for a moment to let the user know something is happening
		setTimeout(() => window.location = [location.protocol, '//', location.host, location.pathname].join(''), 1500);
	}
}

// The table of this user's playlists, to be displayed mid-page in the playlistsContainer
class PlaylistTable extends React.Component {
	// By default the constructor passes props to super. If you want some additional stuff, you have to override.
	// https://stackoverflow.com/questions/30668326/what-is-the-difference-between-using-constructor-vs-getinitialstate-in-react-r
	constructor(props) { // props is short for "properties"
		super(props);
		this.state = { playlists: [], nplaylists: 0, nextURL: null, prevURL: null }; // create some useful variables
	}

	// "componentDidMount() is invoked immediately after a component is mounted (inserted into the tree).
	// Initialization that requires DOM nodes [Document Object Model, of the HTTP page] should go here."
	// https://legacy.reactjs.org/docs/react-component.html#componentdidmount
	async componentDidMount() {
		let user = await utils.apiCall("https://api.spotify.com/v1/me", this.props.access_token);
		this.loadPlaylists("https://api.spotify.com/v1/users/" + user.id + "/playlists");
		this.state.userid = user.id;
	}

	// Retrieve the list of user playlists by querying the URL and add them to this Component's state.
	// https://developer.spotify.com/documentation/web-api/reference/get-list-users-playlists
	async loadPlaylists(url) {
		let response = await utils.apiCall(url, this.props.access_token);
		this.setState({ playlists: response.items, nplaylists: response.total, nextURL: response.next,
			prevURL: response.previous });

		playlists.style.display = 'block';
		subtitle.textContent = (response.offset + 1) + '-' + (response.offset + response.items.length) +
			' of ' + response.total + ' playlists\n'; // Give numbers to indicate which chunk of playlists is displayed.
	}

	exportPlaylists() {
		ZipExporter.export(this.props.access_token, this.state.userid, this.state.nplaylists);
	}

	// Make the table sortable
	sortRows(column) {
		// Change arrow icons appropriately
		let allSorts = Array.from(document.querySelectorAll('[id^="sortBy"]')) // querySelectorAll returns NodeList, not Array https://eloquentjavascript.net/14_dom.html#h-5ooQzToxht https://developer.mozilla.org/en-US/docs/Web/API/NodeList
		let arrow = allSorts.find(el => el.id == "sortBy"+column); // find the one just clicked
		allSorts.forEach(el => { if (el != arrow) {el.className = "fa fa-fw fa-sort"; el.style.color = '#C0C0C0'} }); // change the other two back to the greyed-out double-arrow
		if (arrow.className.endsWith("fa-sort") || arrow.className.endsWith("fa-sort-asc")) { arrow.className = "fa fa-fw fa-sort-desc" } //if the icon is fa-sort or asc, change to desc
		else if (arrow.className.endsWith("fa-sort-desc")) { arrow.className = "fa fa-fw fa-sort-asc" } //if desc, change to asc
		arrow.style.color = "#000000"; // darken
		
		// rearrange table rows
		function field(p) { // get the keyed column contents
			if (column == "Name") { return p.name; } else if (column == "Owner") { return p.owner.id; } }
		this.setState({ playlists: this.state.playlists.sort((a, b) => // make sure use setState() so React reacts! Calling render() doesn't cut the mustard.
			arrow.className.endsWith("desc") ? // figure out whether we're ascending or descending
			column == "Tracks" ? a.tracks.total > b.tracks.total : field(a).localeCompare(field(b)) : // for numeric column, just use <, >
			column == "Tracks" ? a.tracks.total < b.tracks.total : field(b).localeCompare(field(a))) }); // for string columns, use something fancier to handle capitals and such
	}

	// createElement is a legacy API https://react.dev/reference/react/createElement, but it's unclear what the
	// recommendation is to modernize https://stackoverflow.com/questions/78433001/why-is-createelement-a-part-of-the-legacy-api
	render() {
		if (this.state.playlists.length > 0) {
			return React.createElement("div", { id: "playlists" },
				React.createElement(Paginator, { nextURL: this.state.nextURL, prevURL: this.state.prevURL, // type is Paginator, {} are props
																		loadPlaylists: this.loadPlaylists.bind(this) }),
				React.createElement("table", { className: "table table-hover" },
					React.createElement("thead", null, // header row
						React.createElement("tr", null,
							React.createElement("th", { style: { width: "30px" }}),
							React.createElement("th", null, "Name",
								React.createElement("i", { className: "fa fa-fw fa-sort", style: { color: '#C0C0C0' }, id: "sortByName", onClick: this.sortRows.bind(this, "Name")} )),
							React.createElement("th", null, "Owner",
								React.createElement("i", { className: "fa fa-fw fa-sort", style: { color: '#C0C0C0' }, id: "sortByOwner", onClick: this.sortRows.bind(this, "Owner")} )),
							React.createElement("th", null, "Tracks",
								React.createElement("i", { className: "fa fa-fw fa-sort", style: { color: '#C0C0C0' }, id: "sortByTracks", onClick: this.sortRows.bind(this, "Tracks")} )),
							React.createElement("th", null, "Public?"),
							React.createElement("th", null, "Collaborative?"),
							React.createElement("th", { className: "text-right"},
								React.createElement("button", { className: "btn btn-default btn-xs", type: "submit", id: "exportAll", onClick: this.exportPlaylists.bind(this) },
									React.createElement("i", { className: "fa fa-file-archive-o"}), " Export All")))),
					React.createElement("tbody", null, this.state.playlists.map((playlist, i) => {
						return React.createElement(PlaylistRow, { playlist: playlist, access_token: this.props.access_token, row: i});
					}))),
				React.createElement(Paginator, { nextURL: this.state.nextURL, prevURL: this.state.prevURL,
															loadPlaylists: this.loadPlaylists.bind(this) }));
		} else {
		  return React.createElement("div", { className: "spinner"});
		}
	}
}


// Separated out for convenience, I guess. The table's render method defines a bunch of these in a loop, which I'm
// guessing implicitly calls this thing's render method.
class PlaylistRow extends React.Component {
 	exportPlaylist() { // this is the function that gets called when an export button is pressed
		PlaylistExporter.export(this.props.access_token, this.props.playlist, this.props.row);
	}

	renderTickCross(dark) { // dark check mark if true, light x if false
		if (dark) {
			return React.createElement("i", { className: "fa fa-lg fa-check-circle-o" });
		} else {
			return React.createElement("i", { className: "fa fa-lg fa-times-circle-o", style: { color: '#ECEBE8' } });
		}
	}

	render() {
		let p = this.props.playlist
		return React.createElement("tr", { key: p.id }, // tr = table row
				React.createElement("td", null, React.createElement("i", { className: "fa fa-music" })), // td = table data
				React.createElement("td", null,
					React.createElement("a", { href: p.external_urls.spotify }, p.name)),
				React.createElement("td", null,
					React.createElement("a", { href: p.owner.external_urls.spotify }, p.owner.id)),
				React.createElement("td", null, p.tracks.total),
				React.createElement("td", null, this.renderTickCross(p.public)),
				React.createElement("td", null, this.renderTickCross(p.collaborative)),
				React.createElement("td", { className: "text-right" },
					React.createElement("button", { className: "btn btn-default btn-xs btn-success", type: "submit",
											id: "export" + this.props.row, onClick: this.exportPlaylist.bind(this) },
						React.createElement("i", { className: "fa fa-download" }) /* download icon */, " Export")));
	}
}

// For those users with a lot more playlists than necessary
class Paginator extends React.Component {
	nextClick(e) {
		e.preventDefault(); // keep React from putting us at # instead of #playlists
		if (this.props.nextURL != null) { this.props.loadPlaylists(this.props.nextURL); }
	}

	prevClick(e) {
		e.preventDefault();
		if (this.props.prevURL != null) { this.props.loadPlaylists(this.props.prevURL); }
	}

	render() {
		if (!this.props.nextURL && !this.props.prevURL) { return React.createElement("div", null, "\xA0"); } // don't display if only one page
		else { return React.createElement("nav", { className: "paginator text-right" },
			React.createElement("ul", { className: "pagination pagination-sm" }, // ul = unordered list
				React.createElement("li", { className: this.props.prevURL == null ? 'disabled' : '' }, // li = list item
					React.createElement("a", { href: "#", "aria-label": "Previous", onClick: this.prevClick.bind(this) }, // a = anchor
						React.createElement("span", { "aria-hidden": "true" }, "\xAB"))), // \xAB is hexadecimal, unicode character like <<
				React.createElement("li", { className: this.props.nextURL == null ? 'disabled' : '' },
					React.createElement("a", { href: "#", "aria-label": "Next", onClick: this.nextClick.bind(this) },
						React.createElement("span", { "aria-hidden": "true" }, "\xBB"))))); // \xBB is hexadecimal, unicode character like >> 
		}
	}
}

// Handles exporting all playlist data as a zip file
let ZipExporter = {
	async export(access_token, userid, nplaylists) {
		exportAll.innerHTML = '<i class="fa fa-circle-o-notch fa-spin"></i> Exporting'; // spinner on button
		error.innerHTML = "";
		let zip = new JSZip();
		
		// Get a list of all the user's playlists
		let playlists = [];
		for (let offset = 0; offset < nplaylists; offset += 50) { // For more than 50, use the nextURL
			let batch = await utils.apiCall("https://api.spotify.com/v1/users/" + userid + "/playlists?limit=50&offset=" +
				offset, access_token, offset*2); // only one query every 100 ms
			playlists.push(batch.items);
		}
		playlists = playlists.flat();
		
		// Now do the real work for each playlist
		for (let playlist of playlists) {
			try {
				let csv = await PlaylistExporter.csvData(access_token, playlist);
				let fileName = PlaylistExporter.fileName(playlist);
				while (zip.file(fileName + ".csv")) { fileName += "_"; } // Add underscores if the file already exists so playlists with duplicate names don't overwrite each other.
				zip.file(fileName + ".csv", csv);
			} catch (e) { // Surface all errors
				error.innerHTML = error.innerHTML.slice(0, -120) + "Couldn't export " + playlist.name + " with id " +
					playlist.id + ". Encountered <tt>" + e + "</tt><br>" + e.stack +
					'<br>Please <a href="https://github.com/pavelkomarov/exportify/issues/10">let us know</a>. ' +
					"The others are still being zipped.";
			}
		}
		exportAll.innerHTML= '<i class="fa fa-file-archive-o"></i> Export All'; // change back button text
		saveAs(zip.generate({ type: "blob" }), "spotify_playlists.zip");
	}
}

// Handles exporting a single playlist as a CSV file
let PlaylistExporter = {
	// Take the access token string and playlist object, generate a csv from it, and when that data is resolved and
	// returned, save to a file.
	async export(access_token, playlist, row) {
		document.getElementById("export"+row).innerHTML = '<i class="fa fa-circle-o-notch fa-spin"></i> Exporting'; // spinner on button
		try {
			let csv = await this.csvData(access_token, playlist);
			saveAs(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }), this.fileName(playlist) + ".csv");
		} catch (e) {
			error.innerHTML = "Couldn't export " + playlist.name + ". Encountered <tt>" + e + "</tt><br>" + e.stack +
					'<br>Please <a href="https://github.com/pavelkomarov/exportify/issues/10">let us know</a>.';
		} finally { // change back the export button's text
			document.getElementById("export"+row).innerHTML = '<i class="fa fa-download"></i> Export';
		}
	},

	// This is where the magic happens. The access token gives us permission to query this info from Spotify, and the
	// playlist object gives us all the information we need to start asking for songs.
	csvData(access_token, playlist) {
		// Make asynchronous API calls for 100 songs at a time, and put the results (all Promises) in a list.
		let requests = [];
		for (let offset = 0; offset < playlist.tracks.total; offset += 100) {
			requests.push(utils.apiCall(playlist.tracks.href.split('?')[0] + '?offset=' + offset + '&limit=100',
					access_token, offset));
		}
		// "returns a single Promise that resolves when all of the promises passed as an iterable have resolved"
		// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/all
		let artist_ids = new Set();
		let data_promise = Promise.all(requests).then(responses => { // Gather all the data from the responses in a table.
			return responses.map(response => { // apply to all responses
				return response.items.map(song => { // apply to all songs in each response
					// Safety check! If there are artists listed and they have non-null identifier, add them to the set
					song.track?.artists?.forEach(a => { if (a && a.id) { artist_ids.add(a.id) } });
					// Multiple, comma-separated artists can throw off csv, so surround with ""
					// Same for track and album names, which may contain commas and even quotation marks! Treat with care.
					// Safety-checking question marks!
					return [song.track?.id, '"'+song.track?.artists?.map(artist => { return artist ? artist.id : null }).join(',')+'"',
						'"'+song.track?.name?.replace(/"/g,'')+'"', '"'+song.track?.album?.name?.replace(/"/g,'')+'"',
						'"'+song.track?.artists?.map(artist => { return artist ? artist.name : null}).join(',')+'"',
						song.track?.album?.release_date, song.track?.duration_ms, song.track?.popularity, song.added_by.uri, song.added_at];
				});
			});
		});

		// Make queries on all the artists, because this json is where genre information lives. Unfortunately this
		// means a second wave of traffic, 50 artists at a time the maximum allowed.
		let genre_promise = data_promise.then(() => {
			artist_ids = Array.from(artist_ids); // Make groups of 50 artists, to all be queried together
			artist_chunks = []; while (artist_ids.length) { artist_chunks.push(artist_ids.splice(0, 50)); };
			let artists_promises = artist_chunks.map((chunk_ids, i) => utils.apiCall(
				'https://api.spotify.com/v1/artists?ids='+chunk_ids.join(','), access_token, 100*i));
			return Promise.all(artists_promises).then(responses => {
				let artist_genres = {}; // build a dictionary, rather than a table
				responses.forEach(response => response.artists.forEach(
					artist => {if (artist) {artist_genres[artist.id] = artist.genres.join(',')}} )); // these are the artists who had ids before, but it's still possible they aren't in the genre database
				return artist_genres;
			});
		});

		// Make queries for song audio features, 100 songs at a time. Happens after genre_promise has finished, to build in delay.
		let features_promise = Promise.all([data_promise, genre_promise]).then(values => {
			data = values[0];
			let songs_promises = data.map((chunk, i) => { // remember data is an array of arrays, each subarray 100 tracks
				ids = chunk.map(song => song[0]).join(','); // the id lives in the first position
				return utils.apiCall('https://api.spotify.com/v1/audio-features?ids='+ids , access_token, 100*i);
			});
			return Promise.all(songs_promises).then(responses => {
				return responses.map(response => { // for each response
					return response.audio_features.map(feats => {
						return [feats?.danceability, feats?.energy, feats?.key, feats?.loudness, feats?.mode,
							feats?.speechiness, feats?.acousticness, feats?.instrumentalness, feats?.liveness, feats?.valence,
							feats?.tempo, feats?.time_signature] // Safety-checking question marks
					});
				});
			});
		});

		// join the tables, label the columns, and put all data in a single csv string
		return Promise.all([data_promise, genre_promise, features_promise]).then(values => {
			[data, artist_genres, features] = values;
			// add genres
			data = data.flat(); // get rid of the batch dimension (only 100 songs per call)
			data.forEach(row => {
				artists = row[1].substring(1, row[1].length-1).split(','); // strip the quotes
				deduplicated_genres = new Set(artists.map(a => artist_genres[a]).join(",").split(",")); // in case multiple artists
				row.push('"'+Array.from(deduplicated_genres).filter(x => x != "").join(",")+'"'); // remove empty strings
			});
			// add features
			features = features.flat(); // get rid of the batch dimension (only 100 songs per call)
			data.forEach((row, i) => features[i]?.forEach(feat => row.push(feat)));
			// add titles https://www.w3schools.com/jsref/jsref_unshift.asp
			data.unshift(["Spotify ID", "Artist IDs", "Track Name", "Album Name", "Artist Name(s)", "Release Date",
				"Duration (ms)", "Popularity", "Added By", "Added At", "Genres", "Danceability", "Energy", "Key", "Loudness",
				"Mode", "Speechiness", "Acousticness", "Instrumentalness", "Liveness", "Valence", "Tempo", "Time Signature"]);
			// make a string
			csv = ''; data.forEach(row => { csv += row.join(",") + "\n" });
			return csv;
		});
	},

	// take the playlist object and return an acceptable filename
	fileName(playlist) {
		return playlist.name.replace(/[^a-z0-9\- ]/gi, '').replace(/[ ]/gi, '_').toLowerCase(); // /.../gi is a Perl-style modifier, g for global, meaning all matches replaced, i for case-insensitive
	}
}

// runs when the page loads
window.onload = () => {
	let [root, hash] = window.location.href.split('#');
	dict = {};
	if (hash) { // If there is any information in the URL, contained after a # and separated by &, parse it out
		let params = hash.split('&');
		for (let i = 0; i < params.length; i++) {
			let [k, v] = params[i].split('=');
			dict[k] = v;
		}
	}

	if (dict.access_token) { // If we were just authorized and got a token, then the url will have &access_token= in it
		loginButton.style.display = 'none'; // When logged in, make the login button invisible
		logoutContainer.innerHTML = '<button id="logoutButton" class="btn btn-sm" onclick="utils.logout()">Log Out</button>'; // Add a logout button by modifying the HTML
		ReactDOM.render(React.createElement(PlaylistTable, { access_token: dict.access_token }), playlistsContainer); // Create table
		window.location = root + "#playlists" // modify URL to something prettier and more informative
	}
}
