[![Build Status](http://img.shields.io/travis/pavelkomarov/exportify.svg?style=flat)](https://travis-ci.org/pavelkomarov/exportify)

This is a hard fork of [the original Exportify repo](https://github.com/watsonbox/exportify). I've simplified the code, gotten rid of the old tests, set up automatic deployment to github pages, fixed a parsing bug, and enhanced the set of features.

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
- Album Name
- Duration (ms)
- Popularity
- Release Date
- Artist Name(s)
- Added By
- Added At
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
