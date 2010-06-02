// ==UserScript==
// @name           MediaWiki History Sparkline
// @namespace      http://zak.greant.com/greasy
// @description    Display a sparkline (aka tiny graph) of recent changes to the current MediaWiki page
// @include        *
// @require        http://code.jquery.com/jquery-1.3.min.js
// @require        http://omnipotent.net/jquery.sparkline/1.5.1/jquery.sparkline.min.js
// @license        Simplified BSD License (see end of file)
// ==/UserScript==

// todo: add popup sparkline key and help info to graph display
// todo: display other graphs - eg. top contributors
// todo: add windowshade feature
// todo: make sparklines draggable
// todo: allow configuration of the number of history records to be fetched

// only run the script for MediaWiki article pages
if( /^MediaWiki/.test(document.getElementsByName('generator')[0].content) && 'view' == unsafeWindow.wgAction && unsafeWindow.wgArticleId ){

	// fetch history page, grab data, then show sparklines for current wikipedia/mediawiki page
	GM_xmlhttpRequest({
		method: 'GET',
		url: makeHistoryPageURL( window.location.href, 100 ),
		onload: function(response) {
			if(response.status == 200) {
				makeSparklines( getHistoryLog(response.responseText) );
			}
		}
	});
}

// make URL for current articles history page
function makeHistoryPageURL( pageURL, limit ){
	var historyURL = '/w/index.php?action=history&limit=' + limit + '&title=';
	var re = RegExp('(https?://[^/]+)/.+/([^/]+)');
	if( ! re.test(pageURL) ){
		throw ('Could not find history URL for page ' + pageURL);
	}
	return pageURL.replace(re, '$1' + historyURL + '$2');
}

// fetch and parse history entries from HTML
function getHistoryLog( html ){
	var history = [];	// array to store parsed history entries
	var dom = (new DOMParser()).parseFromString( html, 'application/xml' );
	var pagehistory = dom.getElementById('pagehistory').getElementsByTagName('li');	// grab individual history entries

	if( ! pagehistory ){
		GM_log( html );
		throw 'History could not be retrieved.';
	}

	// walk over history entries, grabbing fields
	for( var i = 0; i < pagehistory.length; ++i ){
		var item = pagehistory[i];
		
		var user = item.getElementsByClassName('mw-userlink')[0] ? item.getElementsByClassName('mw-userlink')[0].title : '';	// fetch user handle & discard node
		var comment = item.getElementsByClassName('comment')[0] ? item.getElementsByClassName('comment')[0].textContent : '';	// fetch comment & discard node
		var bytes = item.getElementsByClassName('history-size')[0] ? parseInt( item.getElementsByClassName('history-size')[0].textContent.replace(/[^0-9]/g, '') ) : 0; // fetch comment & discard node

		// walk through anchors and grab anchor that contains the date information
		var anchors = item.getElementsByTagName('a');
		for( var ii = 0; ii < anchors.length; ++ii ){
			if( ! /^[0-9]{2}:[0-9]{2}, /.test(anchors[ii].textContent) ){ continue; }	// skip over anything that isn't a time and date

			var datetime = anchors[ii].textContent.split(', ');		// clean time and date info
			datetime = Date.parse(datetime[1] + ' ' + datetime[0]);	// convert human-readable date into number of milliseconds since the epoch
			break;
		}

		history.push({ bytes: bytes, comment: comment, datetime: datetime, user: user});
	}

	return history;
}

// process data and generate sparklines
function makeSparklines( history ){
	var data = {};			// store sparkline data
	var day = 86400000;
	var now = Date.now();


	// periods to make sparklines for. order of array elements matters
	var periods = [
		{label:'3years', length:day*365.25*36, segments:36, title:"last 3 years"},
		{label:'month', length:day*30, segments:30, title:"last month"},
		{label:'day', length:day, segments:24, title:"last 24 hours"},
	];

	for( i in periods ){
		var period = periods[i];

		var bytesChanged = [];
		var changeCount = [];
		var counter = 0;

		for( var n = 0; n < period.segments; ++n ){
			var bytesPerSegment = 0;
			var changesPerSegment = 0;

			if( counter == history.length ){
				bytesPerSegment = null;
				changesPerSegment = null;
			}

			while( counter < history.length && history[counter].datetime > (now - (period.length / period.segments) * n) ){
				bytesPerSegment += history[counter].bytes;
				++changesPerSegment;
				++counter;
			}

			bytesChanged.unshift( bytesPerSegment );
			changeCount.unshift( changesPerSegment );
		}
		data[period.label] = [bytesChanged, changeCount];
	}

	var sparkline = document.createElement('div');

	for( p in periods ){
		var period = periods[p];
		sparkline.innerHTML += '<div style="color: #AAA; font-size:7pt; background: #FFF; padding:0.25em; position:relative; float:left; z-index:100; text-align:center;">'
								+ '<span id="sparkline_' + period.label + '" style="border-bottom:thin solid #CCF;position:absolute;"></span>'
								+ '<span id="sparkline_changes_' + period.label + '" style=""></span><br />'
								+ '<span style="">' + period.title + '</span>'
							+ '</div>';
	}

	var elapsedTime = Math.floor((now - history[history.length-1].datetime) / day);
	sparkline.innerHTML += '<span style="color: #AAA; font-size:7pt; background: #FFF; top:0.75em; padding:1em; position:relative; z-index:100;"> ' 
						+ history.length + ' changes in the last ' + (1 == elapsedTime ? 'day' : elapsedTime +  ' days') + '</span>';
	
	document.body.insertBefore( sparkline, document.body.firstChild );

	for( p in periods ){
		var period = periods[p];
		$('#sparkline_changes_' + period.label).sparkline( data[period.label][1], {type:'bar', barColor:'#ccf', barSpacing:0, barWidth: 3, height:'1.3em'} );
		$('#sparkline_' + period.label).sparkline( data[period.label][0], {composite: true, fillColor: false, height:'1.3em', lineColor:'blue'} );
	}
}

/*
	Simplified BSD License

	Copyright (c) 2010, MediaWiki Foundation
	All rights reserved.

	Redistribution and use in source and binary forms, with or without
	modification, are permitted provided that the following conditions are met:

		* Redistributions of source code must retain the above copyright
		  notice, this list of conditions and the following disclaimer.

		* Redistributions in binary form must reproduce the above copyright
		  notice, this list of conditions and the following disclaimer in the
		  documentation and/or other materials provided with the distribution.

	THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
	AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
	IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
	ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
	LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
	CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
	SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
	INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
	CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
	ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
	POSSIBILITY OF SUCH DAMAGE.
*/
