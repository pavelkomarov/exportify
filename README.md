[![Build Status](http://img.shields.io/travis/pavelkomarov/exportify.svg?style=flat)](https://travis-ci.org/pavelkomarov/exportify)

This is a hard fork of [the original Exportify repo](https://github.com/watsonbox/exportify). Watsonbox hasn't updated the code in any meaningful way in four years. Issues are left open; pull requests are left unmerged; the tests are dependent on deprecated frameworks and broken; he's serving through rawgit which is about to go dark for good. In using the service to download some of my own playlists for analysis, I discovered a bug where table rows aren't always the same width (requiring manual edits before you could, say, read the csv as a DataFrame), and I was dismayed the table contains no release year nor genre information. The purpose of this fork is to address these problems. I've set up Travis to deploy the app on a real website (for now just a subdomain of my personal site, since the [exportify.com](exportify.com) domain is taken), registered for my own client id with Spotify, and cleaned up the code as much as I can. Old JavaScript is the worst, but it has been a valuable learning experience.

If you have any problems, open an issue

<a href="https://pavelkomarov.com/exportify/app"><img src="screenshot.png"/></a>

Export your Spotify playlists using the Web API by clicking on the link below:

[https://pavelkomarov.com/exportify/app](https://pavelkomarov.com/exportify/app)

As many users have noted, there is no way to export/archive playlists from the Spotify client for safekeeping. This application provides a simple interface for doing that using the Spotify Web API.

No data will be saved - the entire application runs in the browser.

## Usage

Click 'Get Started', grant Exportify read-only access to your playlists, then click the 'Export' button to export a playlist.

Click 'Export All' to save a zip file containing a CSV file for each playlist in your account. This may take a while when many playlists exist and/or they are large.

### Re-importing Playlists

Once playlists are saved, it's also pretty straightforward to re-import them into Spotify. Open up the CSV file in Excel, for example, select and copy the `spotify:track:xxx` URIs, then simply create a playlist in Spotify and paste them in.

### Export Format

Track data is exported in [CSV](http://en.wikipedia.org/wiki/Comma-separated_values) format with the following fields:

- Spotify URI
- Track Name
- Artist Name
- Album Name
- Disc Number
- Track Number
- Track Duration (ms)
- Added By
- Added At
- Year
- Genres

## Development

Developers wishing to make changes to Exportify should use a local web server. For example, using Python (in the Exportify repo dir):

```bash
python -m SimpleHTTPServer
```

Then open [http://localhost:8000/app](http://localhost:8000/app).

## Contributing

1. Fork it ( https://github.com/watsonbox/exportify/fork )
2. Create your feature branch (`git checkout -b my-new-feature`)
3. Commit your changes (`git commit -am 'Add some feature'`)
4. Push to the branch (`git push origin my-new-feature`)
5. Create a new Pull Request
