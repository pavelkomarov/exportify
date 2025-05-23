// A collection of functions to create and send API queries
const utils = {
	// Send a request to the Spotify server to let it know we want a session. This is literally accomplished by navigating
	// to a web address, which accomplishes a GET, with correct query params in tow. There the user may have to enter their
	// Spotify credentials, after which they are redirected. Which client app wants access, which information exactly it wants
	// access to (https://developer.spotify.com/documentation/web-api/concepts/scopes), where to redirect, etc. constitute the
	// params. Since we now have to do https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow, this
	// accomplishes only the first phase. Essentially we generate a random secret then hash and encode it and send the hashed
	// side (the "challenge") to the authorization server in the original GET. The server responds with a code, which we send
	// back along with the secret (the "verifier") in a POST form, which proves the original request came from the same origin.
	// The auth code is finally sent in the response body to that latter request, instead of as a plaintext url param.
	// https://developer.spotify.com/documentation/web-api/concepts/authorization
	async authorize() { // This is bound to the login button in the HTML and gets called when the login button is clicked.
		let alphanumeric = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
		let code_verifier = crypto.getRandomValues(new Uint8Array(64)).reduce((acc, x) => acc + alphanumeric[x % alphanumeric.length], "")
		let hashed = await crypto.subtle.digest('SHA-256', (new TextEncoder()).encode(code_verifier)) // some crypto methods are async
		let code_challenge = btoa(String.fromCharCode(...new Uint8Array(hashed))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')

		localStorage.setItem('code_verifier', code_verifier) // save the random string secret
		location = "https://accounts.spotify.com/authorize?client_id=d99b082b01d74d61a100c9a0e056380b" +
			"&redirect_uri=" + encodeURIComponent(location.origin + location.pathname) +
			"&scope=playlist-read-private%20playlist-read-collaborative%20user-library-read" + // access to particular scopes of info defined here
			"&response_type=code&code_challenge_method=S256&code_challenge=" + code_challenge
	},

	// Make an asynchronous call to the server. Promises are *weird*. Careful here! You have to call .json() on the
	// Promise returned by the fetch to get a second Promise that has the actual data in it!
	// https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch
	// https://eloquentjavascript.net/11_async.html
	async apiCall(url, delay=0) {
		await new Promise(r => setTimeout(r, delay)) // JavaScript equivalent of sleep(delay), to stay under rate limits ;)
		let response = await fetch(url, { headers: { 'Authorization': 'Bearer ' + localStorage.getItem('access_token')} })
		if (response.ok) { return response.json() }
		else if (response.status == 401) { location = location.href.split('#')[0] } // Return to home page after auth token expiry
		else if (response.status == 429) {
			if (!error.innerHTML.includes("fa-bolt")) { error.innerHTML += '<p><i class="fa fa-bolt" style="font-size: 50px; margin-bottom: 20px">\
				</i></p><p>Exportify has encountered <a target="_blank" href="https://developer.spotify.com/documentation/web-api/concepts/rate-limits">\
				rate limiting</a> while querying endpoint ' + url.split('?')[0] + '!<br/>Don\'t worry: Automatic backoff is implemented, and your data is \
				still downloading. But <a href="https://github.com/pavelkomarov/exportify/issues">I would be interested to hear about this.</a></p><br/>' }
			return utils.apiCall(url, response.headers.get('Retry-After')*1000)
		} // API Rate-limiting encountered (hopefully never happens with delays)
		else { error.innerHTML = "The server returned an HTTP " + response.status + " response. " } // the caller will fail
	},

	// Logging out of Spotify is much like logging in: You have to navigate to a certain url. But unlike logging in, there is
	// no way to redirect back to my home page. So open the logout page in a new tab, then redirect to the homepage after a
	// second, which is almost always long enough for the logout request to go through.
	logout() {
		localStorage.clear() // otherwise when the page is reloaded it still just finds and uses the access_token
		let logout = open("https://www.spotify.com/logout")
		setTimeout(() => {logout.close(); location = location.origin}, 1000)
	}
}

// The table of this user's playlists, to be displayed mid-page in the playlistsContainer
class PlaylistTable extends React.Component {
	// By default the constructor passes properties to super.
	constructor(props) { super(props) } //render() gets called at the end of constructor execution

	// A constructor can't be async, but we need to asynchronously load data when the object is made.
	// Solve this with a separate function that initializes object data. Call it from render().
	// https://stackoverflow.com/questions/43431550/how-can-i-invoke-asynchronous-code-within-a-constructor
	async init() {
		let user = await utils.apiCall("https://api.spotify.com/v1/me")
		let library = await utils.apiCall("https://api.spotify.com/v1/me/tracks?offset=0&limit=1")

		// fake a playlist-like structure for the liked songs, so it plays well with the rest of the code
		let liked_songs = {name: "Liked Songs", external_urls: {spotify: "https://open.spotify.com/collection/tracks"},
			images:[{url: "liked_songs.jpeg"}], owner: {id: user.id, external_urls: {spotify: user.external_urls.spotify}},
			tracks: {total: library.total, href: "https://api.spotify.com/v1/me/tracks"}}
		let playlists = [[liked_songs]] // double list so .flat() flattens everything right later

		// Compose a list of all the user's playlists by querying the playlists endpoint. Their total number of playlists
		// needs to be garnered from a response, so await the first response, then send a volley of requests to get the rest.
		// https://developer.spotify.com/documentation/web-api/reference/get-list-users-playlists
		let response = await utils.apiCall("https://api.spotify.com/v1/me/playlists?limit=50&offset=0")
		playlists.push(response.items)
		let requests = []
		for (let offset = 50; offset < response.total; offset += 50) {
			requests.push(utils.apiCall("https://api.spotify.com/v1/me/playlists?limit=50&offset=" + offset, 2*offset-100))
		}
		await Promise.all(requests).then(responses => responses.map(response => playlists.push(response.items)))

		//add info to this Component's state. Use setState() so render() gets called again.
		this.setState({ playlists: playlists.flat() }) // flatten list of lists into just a list
		subtitle.textContent = this.state.playlists.length + ' playlists\n' // directly reference an HTML element by id
	}

	// Make the table sortable
	sortRows(column) {
		// Change arrow icons appropriately
		let allSorts = Array.from(document.querySelectorAll('[id^="sortBy"]')) // querySelectorAll returns NodeList, not Array https://eloquentjavascript.net/14_dom.html#h-5ooQzToxht https://developer.mozilla.org/en-US/docs/Web/API/NodeList
		let arrow = allSorts.find(el => el.id == "sortBy"+column) // find the one just clicked
		allSorts.forEach(el => { if (el != arrow) {el.className = "fa fa-fw fa-sort"; el.style.color = '#C0C0C0'} }) // change the other two back to the greyed-out double-arrow
		if (arrow.className.endsWith("fa-sort") || arrow.className.endsWith("fa-sort-asc")) { arrow.className = "fa fa-fw fa-sort-desc" } //if the icon is fa-sort or asc, change to desc
		else if (arrow.className.endsWith("fa-sort-desc")) { arrow.className = "fa fa-fw fa-sort-asc" } //if descending, change to ascending
		arrow.style.color = "#000000" // darken
		
		// rearrange table rows
		function field(p) { // get the keyed column contents
			if (column == "Name") { return p.name } else if (column == "Owner") { return p.owner.id } }
		this.setState({ playlists: this.state.playlists.sort((a, b) => // make sure to use setState() so React reacts! Calling render() doesn't cut the mustard.	
			arrow.className.endsWith("desc") ? // figure out whether we're ascending or descending
				column == "Tracks" ? a.tracks.total - b.tracks.total : field(a).localeCompare(field(b)) : // for numeric column, just use the difference to get a + or - number
				column == "Tracks" ? b.tracks.total - a.tracks.total : field(b).localeCompare(field(a))) }) // for string columns, use something fancier to handle capitals and such
	}

	// createElement is a legacy API https://react.dev/reference/react/createElement, but I like it better than JSX at the moment
	// https://stackoverflow.com/questions/78433001/why-is-createelement-a-part-of-the-legacy-api
	render() {
		if (this.state?.playlists.length > 0) {
			return React.createElement("div", { id: "playlists" },
				React.createElement("table", { className: "table table-hover" },
					// table header
					React.createElement("thead", null, // have to explicitly pass null because the children come as *args _after_ the second argument
						React.createElement("tr", null,
							React.createElement("th", { style: { width: "30px" }}),
							React.createElement("th", null, "Name",
								React.createElement("i", { className: "fa fa-fw fa-sort", style: { color: '#C0C0C0' }, id: "sortByName", onClick: () => this.sortRows("Name")} )),
							React.createElement("th", null, "Owner",
								React.createElement("i", { className: "fa fa-fw fa-sort", style: { color: '#C0C0C0' }, id: "sortByOwner", onClick: () => this.sortRows("Owner")} )),
							React.createElement("th", {style: {minWidth: "100px"}}, "Tracks",
								React.createElement("i", { className: "fa fa-fw fa-sort", style: { color: '#C0C0C0' }, id: "sortByTracks", onClick: () => this.sortRows("Tracks")} )),
							React.createElement("th", { className: "text-right"},
								React.createElement("button", { className: "btn btn-default btn-xs", type: "submit", id: "exportAll",
									onClick: () => PlaylistExporter.exportAll(this.state.playlists) },
									React.createElement("i", { className: "fa fa-file-archive-o"}), " Export All")))),
					//table body
					React.createElement("tbody", null,
						this.state.playlists.map((playlist, i) =>
							React.createElement("tr", null, // tr = table row
								React.createElement("td", null, // td = table data
									React.createElement("img", { src: playlist.images?.length > 0 ? playlist.images[0].url : "https://placehold.co/30?text=blank", style: { width: "30px", height: "30px" }})),
								React.createElement("td", null, React.createElement("a", { href: playlist.external_urls.spotify }, playlist.name)),
								React.createElement("td", null, React.createElement("a", { href: playlist.owner.external_urls.spotify }, playlist.owner.id)),
								React.createElement("td", null, playlist.tracks.total),
								React.createElement("td", { className: "text-right" },
									React.createElement("button", { className: "btn btn-default btn-xs btn-success", id: "export" + i, onClick: () => PlaylistExporter.export(this.state.playlists[i], i) },
										React.createElement("i", { className: "fa fa-download" }) /* download icon */, " Export")))))))
		} else {
			this.init()
			return React.createElement("div", { className: "spinner"})
		}
	}
}

// Handles exporting playlists as CSV files
let PlaylistExporter = {
	// Take the access token string and playlist object, generate a csv from it, and when that data is resolved and
	// returned, save to a file.
	async export(playlist, row) {
		document.getElementById("export"+row).innerHTML = '<i class="fa fa-circle-o-notch fa-spin"></i> Exporting' // spinner on button
		try {
			let csv = await this.csvData(playlist)
			saveAs(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }), this.fileName(playlist) + ".csv")
		} catch (e) {
			error.innerHTML += "Couldn't export " + playlist.name + ". Encountered <tt>" + e + "</tt><br/>" + e.stack +
					'<br/>Please <a href="https://github.com/pavelkomarov/exportify/issues">let us know</a>.'
		} finally { // change back the export button's text
			document.getElementById("export"+row).innerHTML = '<i class="fa fa-download"></i> Export'
		}
	},

	// Handles exporting all playlist data as a zip file
	async exportAll(playlists) {
		exportAll.innerHTML = '<i class="fa fa-circle-o-notch fa-spin"></i> Exporting' // spinner on button
		error.innerHTML = ""
		let zip = new JSZip()

		for (let playlist of playlists) {
			try {
				let csv = await this.csvData(playlist)
				let fileName = this.fileName(playlist)
				while (zip.file(fileName + ".csv")) { fileName += "_" } // Add underscores if the file already exists so playlists with duplicate names don't overwrite each other.
				zip.file(fileName + ".csv", csv)
			} catch (e) { // Surface all errors
				error.innerHTML += "Couldn't export " + playlist.name + " with id " + playlist.id + ". Encountered <tt>" + e +
					"</tt><br>" + e.stack + '<br>Please <a href="https://github.com/pavelkomarov/exportify/issues">let us know</a>. ' +
					"The others are still being zipped.<br/>"
			}
		}
		exportAll.innerHTML= '<i class="fa fa-file-archive-o"></i> Export All' // change back button text
		saveAs(zip.generate({ type: "blob" }), "spotify_playlists.zip")
	},

	// take the playlist object and return an acceptable filename
	fileName(playlist) {
		return playlist.name.replace(/[^a-z0-9\- ]/gi, '').replace(/ /gi, '_').toLowerCase() // /.../gi is a Perl-style modifier, g for global, meaning all matches replaced, i for case-insensitive
	},

	// This is where the magic happens. The access token gives us permission to query this info from Spotify, and the
	// playlist object gives us all the information we need to start asking for songs.
	async csvData(playlist) {
		let increment = playlist.name == "Liked Songs" ? 50 : 100 // Can max call for only 50 tracks at a time vs 100 for playlists

		// Make asynchronous API calls for 100 songs at a time, and put the results (all Promises) in a list.
		let requests = []
		for (let offset = 0; offset < playlist.tracks.total; offset += increment) {
			requests.push(utils.apiCall(playlist.tracks.href + '?offset=' + offset + '&limit=' + increment, (offset/increment)*100)) // I'm spacing requests by 100ms regardless of increment.
		}
		// "returns a single Promise that resolves when all of the promises passed as an iterable have resolved"
		// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/all
		let artist_ids = new Set()
		let album_ids = new Set()
		let data_promise = Promise.all(requests).then(responses => { // Gather all the data from the responses in a table.
			return responses.map(response => { // apply to all responses
				return response.items.map(song => { // apply to all songs in each response
					// Safety check! If there are artists/album listed and they have non-null identifier, add them to the sets
					song.track?.artists?.forEach(a => { if (a && a.id) { artist_ids.add(a.id) } })
					if (song.track?.album && song.track.album.id) { album_ids.add(song.track.album.id) }
					// Multiple, comma-separated artists can throw off csv, so surround with "". Same for track and album names,
					// which may contain commas and even quotation marks! Treat with care. Null checking with question marks!
					return ['"'+song.track?.artists?.map(artist => { return artist?.id }).join(',')+'"', song.track?.album?.id, song.track?.uri,
						'"'+song.track?.name?.replace(/[",]/g,'')+'"', '"'+song.track?.album?.name?.replace(/[",]/g,'')+'"',
						'"'+song.track?.artists?.map(artist => { return artist?.name?.replace(/[",]/g,'') }).join(',')+'"',
						song.track?.album?.release_date, song.track?.duration_ms, song.track?.popularity, song.track?.explicit, song.added_by?.id, song.added_at]
				})
			})
		})

		// Make queries on all the artists, because this json is where genre information lives. Unfortunately this
		// means a second wave of traffic, 50 artists at a time the maximum allowed.
		let genre_promise = data_promise.then(() => {
			artist_ids = Array.from(artist_ids) // Make groups of 50 artists, to all be queried together
			let artist_chunks = []; while (artist_ids.length) { artist_chunks.push(artist_ids.splice(0, 50)) }
			let artists_promises = artist_chunks.map((chunk_ids, i) => utils.apiCall(
				'https://api.spotify.com/v1/artists?ids='+chunk_ids.join(','), 100*i)) // volley of traffic, requests staggered by 100ms
			return Promise.all(artists_promises).then(responses => {
				let artist_genres = {} // build a dictionary, rather than a table
				responses.forEach(response => response.artists.forEach(
					artist => { if (artist) {artist_genres[artist.id] = artist.genres.join(',')} } )) // these are the artists who had ids before, but it's still possible they aren't in the genre database
				return artist_genres
			})
		})

		// Fetch album details, another wave of traffic, 20 albums at a time max. Happens after genre_promise has finished, to build in delay.
		let album_promise = Promise.all([data_promise, genre_promise]).then(() => {
			album_ids = Array.from(album_ids) // chunk set of ids into 20s
			let album_chunks = []; while (album_ids.length) { album_chunks.push(album_ids.splice(0, 20)) }
			let album_promises = album_chunks.map((chunk_ids, i) => utils.apiCall(
				'https://api.spotify.com/v1/albums?ids=' + chunk_ids.join(','), 120*i))
			return Promise.all(album_promises).then(responses => {
				let record_labels = {} // analogous to genres
				responses.forEach(response => response.albums.forEach(
					album => { if (album) { record_labels[album.id] = album.label } } ))
				return record_labels
			})
		})

		// Make queries for song audio features, 100 songs at a time.
		let features_promise = Promise.all([data_promise, genre_promise, album_promise]).then(values => {
			let data = values[0]
			let songs_promises = data.map((chunk, i) => { // remember data is an array of arrays, each subarray 100 tracks
				let ids = chunk.map(song => song[2]?.split(':')[2]).join(',') // the id lives in the third position, at the end of spotify:track:id
				return utils.apiCall('https://api.spotify.com/v1/audio-features?ids='+ids, 100*i)
			})
			return Promise.all(songs_promises).then(responses => {
				return responses.map(response => { // for each response
					return response?.audio_features?.map(feats => {
						return [feats?.danceability, feats?.energy, feats?.key, feats?.loudness, feats?.mode,
							feats?.speechiness, feats?.acousticness, feats?.instrumentalness, feats?.liveness, feats?.valence,
							feats?.tempo, feats?.time_signature] // Safety-checking question marks
					})
				})
			})
		})

		// join the tables, label the columns, and put all data in a single csv string
		return Promise.all([data_promise, genre_promise, album_promise, features_promise]).then(values => {
			let [data, artist_genres, record_labels, features] = values
			data = data.flat() // get rid of the batch dimension (only 100 songs per call)
			data.forEach(row => {
				// add genres
				let artist_ids = row.shift()?.slice(1, -1).split(',') // strip the quotes from artist ids, and toss; user doesn't need to see ids
				let deduplicated_genres = new Set(artist_ids?.map(a => artist_genres[a]).join(",").split(",")) // in case multiple artists
				row.push('"'+Array.from(deduplicated_genres).filter(x => x != "").join(",")+'"') // remove empty strings
				// add album details
				let album_id = row.shift()
				row.push('"'+record_labels[album_id]+'"')
			})
			// add features
			features = features.flat() // get rid of the batch dimension (only 100 songs per call)
			data.forEach((row, i) => features[i]?.forEach(feat => row.push(feat)))
			// make a string
			let csv = "Track URI,Track Name,Album Name,Artist Name(s),Release Date,Duration (ms),Popularity,Explicit,Added By,Added At,Genres,Record Label,Danceability,Energy,Key,Loudness,Mode,Speechiness,Acousticness,Instrumentalness,Liveness,Valence,Tempo,Time Signature\n"
			data.forEach(row => { csv += row.join(",") + "\n" })
			return csv
		})
	}
}

// runs when the page loads
onload = async () => {
	let code = new URLSearchParams(location.search).get('code') // try to snag a code out of the url, in case this is after authorize()
	if (code) {
		history.replaceState({}, '', '/') // get rid of the ugly code string from the browser bar

		let response = await fetch("https://accounts.spotify.com/api/token", { method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded'},
			body: new URLSearchParams({client_id: "d99b082b01d74d61a100c9a0e056380b", grant_type: 'authorization_code', code: code, redirect_uri: location.origin + location.pathname,
				code_verifier: localStorage.getItem('code_verifier')}) }) // POST to get the access token, then fish it out of the response body
		localStorage.setItem('access_token', (await response.json()).access_token) // https://stackoverflow.com/questions/59555534/why-is-json-asynchronous
		localStorage.setItem('access_token_timestamp', Date.now())
	}
	if (localStorage.getItem('access_token') && Date.now() - localStorage.getItem('access_token_timestamp') < 3600000) {
		loginButton.style.display = 'none' // When logged in, make the login button invisible
		logoutContainer.innerHTML = '<button id="logoutButton" class="btn btn-sm" onclick="utils.logout()">Log Out</button>' // Add a logout button by modifying the HTML
		ReactDOM.render(React.createElement(PlaylistTable), playlistsContainer) // Create table and put it in the playlistsContainer	
	}
}
