var State = {} // a place to keep track of program state. Gets reset every time the script is fully reloaded.

function print(obj) {
  console.log(JSON.stringify(obj, null, 2))
}

// A collection of functions to create and send API queries
window.Utils = {
  // Query the spotify server (by just setting the url) to let it know we want a session. This is literally
  // accomplished by navigating to this web address, where we may have to enter Spotify credentials, then
  // being redirected to the original website.
  // https://developer.spotify.com/documentation/general/guides/authorization-guide/
  authorize() {
    window.location = "https://accounts.spotify.com/authorize" +
      "?client_id=9950ac751e34487dbbe027c4fd7f8e99" +
      "&redirect_uri=" + encodeURIComponent([location.protocol, '//', location.host, location.pathname].join('')) +
      "&scope=playlist-read-private%20playlist-read-collaborative" +
      "&response_type=token";
  },

  // Make an asynchronous call to the server.
  // https://api.jquery.com/jquery.ajax/
  apiCall(url, access_token) {
    return $.ajax({
      url: url,
      headers: {
        'Authorization': 'Bearer ' + access_token
      }
    }).fail(function (jqXHR, textStatus) {
      if (jqXHR.status == 401) {
        // Return to home page after auth token expiry
        window.location = window.location.href.split('#')[0]
      } else if (jqXHR.status == 429) {
        // API Rate-limiting encountered
        $('#rateLimitMessage').show()
      } else {
        // Otherwise report the error so user can raise an issue
        alert(jqXHR.responseText);
      }
    })
  }
}

// The table of this user's playlists, to be displayed mid-page in the playlistsContainer
let PlaylistTable = React.createClass({
  // This is a sort of constructor to be used with new React classes that you're just creating
  // https://stackoverflow.com/questions/30668326/what-is-the-difference-between-using-constructor-vs-getinitialstate-in-react-r
  getInitialState() {
    return {
      playlists: [],
      playlistCount: 0,
      nextURL: null,
      prevURL: null
    };
  },

  loadPlaylists(url) {
    let userId = '';
    let firstPage = typeof url === 'undefined' || url.indexOf('offset=0') > -1;

    window.Utils.apiCall("https://api.spotify.com/v1/me", this.props.access_token).then(function(response) {
      userId = response.id;

      // Show starred playlist if viewing first page
      if (firstPage) {
        return $.when.apply($, [
          window.Utils.apiCall(
            "https://api.spotify.com/v1/users/" + userId + "/starred",
            this.props.access_token
          ),
          window.Utils.apiCall(
            "https://api.spotify.com/v1/users/" + userId + "/playlists",
            this.props.access_token
          )
        ])
      } else {
        return window.Utils.apiCall(url, this.props.access_token);
      }
    }.bind(this)).done(function() {//God, why, JavaScript? Why? These crazy chained constructions
      let response;
      let playlists = [];

      if (arguments[1] === 'success') {
        response = arguments[0];
        playlists = arguments[0].items;
      } else {
        response = arguments[1][0];
        playlists = $.merge([arguments[0][0]], arguments[1][0].items);
      }

      if (this.isMounted()) {
        this.setState({
          playlists: playlists,
          playlistCount: response.total,
          nextURL: response.next,
          prevURL: response.previous
        });

        $('#playlists').fadeIn();
        $('#subtitle').text((response.offset + 1) + '-' + (response.offset + response.items.length) + ' of ' + response.total + ' playlists for ' + userId)
      }
    }.bind(this))
  },

  exportPlaylists() {
    PlaylistsExporter.export(this.props.access_token, this.state.playlistCount);
  },

  componentDidMount() {
    this.loadPlaylists(this.props.url);
  },

  render() {
    if (this.state.playlists.length > 0) {
      return (
        <div id="playlists">
          <Paginator nextURL={this.state.nextURL} prevURL={this.state.prevURL} loadPlaylists={this.loadPlaylists}/>
          <table className="table table-hover">
            <thead>
              <tr>
                <th style={{width: "30px"}}></th>
                <th>Name</th>
                <th style={{width: "150px"}}>Owner</th>
                <th style={{width: "100px"}}>Tracks</th>
                <th style={{width: "120px"}}>Public?</th>
                <th style={{width: "120px"}}>Collaborative?</th>
                <th style={{width: "100px"}} className="text-right">
                <button className="btn btn-default btn-xs" type="submit" onClick={this.exportPlaylists}>
                <span className="fa fa-file-archive-o"></span> Export All</button></th>
              </tr>
            </thead>
            <tbody>
              {this.state.playlists.map(function(playlist, i) {
                return <PlaylistRow playlist={playlist} key={playlist.id} access_token={this.props.access_token}/>;
              }.bind(this))}
            </tbody>
          </table>
          <Paginator nextURL={this.state.nextURL} prevURL={this.state.prevURL} loadPlaylists={this.loadPlaylists}/>
        </div>
      );
    } else {
      return <div className="spinner"></div>
    }
  }
});

let PlaylistRow = React.createClass({
  exportPlaylist: function() {
    PlaylistExporter.export(this.props.access_token, this.props.playlist);
  },

  renderTickCross: function(condition) {
    if (condition) {
      return <i className="fa fa-lg fa-check-circle-o"></i>
    } else {
      return <i className="fa fa-lg fa-times-circle-o" style={{ color: '#ECEBE8' }}></i>
    }
  },

  renderIcon: function(playlist) {
    if (playlist.name == 'Starred') {
      return <i className="glyphicon glyphicon-star" style={{ color: 'gold' }}></i>;
    } else {
      return <i className="fa fa-music"></i>;
    }
  },

  render: function() {
    playlist = this.props.playlist
    if(playlist.uri==null) return (
      <tr key={this.props.key}>
        <td>{this.renderIcon(playlist)}</td>
        <td>{playlist.name}</td>
        <td colSpan="2">This playlist is not supported</td>
        <td>{this.renderTickCross(playlist.public)}</td>
        <td>{this.renderTickCross(playlist.collaborative)}</td>
        <td>&nbsp;</td>
      </tr>
    );
    return (
      <tr key={this.props.key}>
        <td>{this.renderIcon(playlist)}</td>
        <td><a href={playlist.uri}>{playlist.name}</a></td>
        <td><a href={playlist.owner.uri}>{playlist.owner.id}</a></td>
        <td>{playlist.tracks.total}</td>
        <td>{this.renderTickCross(playlist.public)}</td>
        <td>{this.renderTickCross(playlist.collaborative)}</td>
        <td className="text-right"><button className="btn btn-default btn-xs btn-success" type="submit" onClick={this.exportPlaylist}><span className="glyphicon glyphicon-save"></span> Export</button></td>
      </tr>
    );
  }
});

let Paginator = React.createClass({
  nextClick: function(e) {
    e.preventDefault()

    if (this.props.nextURL != null) {
      this.props.loadPlaylists(this.props.nextURL)
    }
  },

  prevClick: function(e) {
    e.preventDefault()

    if (this.props.prevURL != null) {
      this.props.loadPlaylists(this.props.prevURL)
    }
  },

  render: function() {
    if (this.props.nextURL != null || this.props.prevURL != null) {
      return (
        <nav className="paginator text-right">
          <ul className="pagination pagination-sm">
            <li className={this.props.prevURL == null ? 'disabled' : ''}>
              <a href="#" aria-label="Previous" onClick={this.prevClick}>
                <span aria-hidden="true">&laquo;</span>
              </a>
            </li>
            <li className={this.props.nextURL == null ? 'disabled' : ''}>
              <a href="#" aria-label="Next" onClick={this.nextClick}>
                <span aria-hidden="true">&raquo;</span>
              </a>
            </li>
          </ul>
        </nav>
      )
    } else {
      return <div>&nbsp;</div>
    }
  }
});

// Handles exporting all playlist data as a zip file
let PlaylistsExporter = {
  export(access_token, playlistCount) {
    let playlistFileNames = [];

    window.Utils.apiCall("https://api.spotify.com/v1/me", access_token).then(function(response) {
      let limit = 20;
      let userId = response.id;

      // Initialize requests with starred playlist
      let requests = [
        window.Utils.apiCall(
          "https://api.spotify.com/v1/users/" + userId + "/starred",
          access_token
        )
      ];

      // Add other playlists
      for (let offset = 0; offset < playlistCount; offset = offset + limit) {
        let url = "https://api.spotify.com/v1/users/" + userId + "/playlists";
        requests.push(
          window.Utils.apiCall(url + '?offset=' + offset + '&limit=' + limit, access_token)
        )
      }

      $.when.apply($, requests).then(function() {
        let playlists = [];
        let playlistExports = [];

        // Handle either single or multiple responses
        if (typeof arguments[0].href == 'undefined') {
          $(arguments).each(function(i, response) {
            if (typeof response[0].items === 'undefined') {
              // Single playlist
              playlists.push(response[0]);
            } else {
              // Page of playlists
              $.merge(playlists, response[0].items);
            }
          })
        } else {
          playlists = arguments[0].items
        }

        $(playlists).each(function(i, playlist) {
          playlistFileNames.push(PlaylistExporter.fileName(playlist));
          playlistExports.push(PlaylistExporter.csvData(access_token, playlist));
        });

        return $.when.apply($, playlistExports);
      }).then(function() {
        let zip = new JSZip();
        let responses = [];

        $(arguments).each(function(i, response) {
          zip.file(playlistFileNames[i], response)
        });

        let content = zip.generate({ type: "blob" });
        saveAs(content, "spotify_playlists.zip");
      });
    });
  }
}

// Handles exporting a single playlist as a CSV file
let PlaylistExporter = {
  export(access_token, playlist) {
    this.csvData(access_token, playlist).then(function(data) {
      let blob = new Blob(["\uFEFF" + data], { type: "text/csv;charset=utf-8" });
      saveAs(blob, this.fileName(playlist));
    }.bind(this))
  },

  csvData: function(access_token, playlist) {
    let requests = [];
    let limit = 100;

    for (let offset = 0; offset < playlist.tracks.total; offset = offset + limit) {
      requests.push(
        window.Utils.apiCall(playlist.tracks.href.split('?')[0] + '?offset=' + offset + '&limit=' + limit, access_token)
      )
    }

    return $.when.apply($, requests).then(function() {
      let responses = [];

      // Handle either single or multiple responses
      if (typeof arguments[0] != 'undefined') {
        if (typeof arguments[0].href == 'undefined') {
          responses = Array.prototype.slice.call(arguments).map(function(a) { return a[0] });
        } else {
          responses = [arguments[0]];
        }
      }

      let tracks = responses.map(function(response) {
        return response.items.map(function(item) {
          return [
            item.track.uri,
            item.track.name,
            item.track.artists.map(function(artist) { return artist.name }).join(', '),
            item.track.album.name,
            item.track.disc_number,
            item.track.track_number,
            item.track.duration_ms,
            item.added_by == null ? '' : item.added_by.uri,
            item.added_at
          ].map(function(track) { return '"' + track + '"'; })
        });
      });

      //console.log("tracks x:", JSON.stringify(tracks, null, 2));

      // Flatten the array of pages
      tracks = $.map(tracks, function(n) { return n })

      tracks.unshift([
        "Spotify URI",
        "Track Name",
        "Artist Name",
        "Album Name",
        "Disc Number",
        "Track Number",
        "Track Duration (ms)",
        "Added By",
        "Added At",
        //"Release Year",
        //"Genres"
      ]);

      csvContent = '';
      tracks.forEach(function(infoArray, index){
        dataString = infoArray.join(",");
        csvContent += index < tracks.length ? dataString+ "\n" : dataString;
      });

      return csvContent;
    });
  },

  fileName: function(playlist) {
    return playlist.name.replace(/[^a-z0-9\- ]/gi, '').replace(/[ ]/gi, '_').toLowerCase() + ".csv";
  }
}

// This is equivalento to $(document).ready(function() {...}). The function is a callback, called every time the page
// loads anew.
// https://api.jquery.com/ready/
$(function() {
  let [root, hash] = window.location.href.split('#')
  if (hash) {
    let params = hash.split('&');
    for (let i = 0; i < params.length; i++) {
      let [k, v] = params[i].split('=');
      State[k] = v;
    }
  }

  if (!hash) { // if we're on the home page
    $('#loginButton').css('display', 'inline-block')
  } else if (State.access_token) { // if we were just authorized and got a token
    React.render(<PlaylistTable access_token={State.access_token} />, playlistsContainer);
    window.location = root + "#playlists"
  }
});
