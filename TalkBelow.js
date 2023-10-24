window.TalkBelow = {

	/**
	 * Will hold the wikitext of the relevant talk page
	 */
	talkWikitext: '',

	/**
	 * Initialization script
	 */
	init: function () {

		// Only init when there's a talk section
		var section = document.getElementById( 'talkbelow-section' );
		if ( !section ) {
			return;
		}

		// Add the form to add new topics
		TalkBelow.addNewTopicForm();

		// Select only paragraphs and replies
		$( 'p, dd', section ).each( TalkBelow.addReplyButton );
	},

	/**
	 * Add a reply button
	 */
	addReplyButton: function () {
		var $comment = $( this );

		// Skip paragraphs followed by other paragraphs
		// so that only the last one shows the reply button
		// in multi-paragraph comments
		if ( $comment.next().is( 'p' ) ) {
			return;
		}

		// Make the reply button
		var replyButton = new OO.ui.ButtonInputWidget( {
			flags: 'progressive',
			framed: false,
			label: mw.msg( 'talkbelow-reply' ),
			classes: [ 'talkbelow-button' ]
		} );
		replyButton.$element.css( 'margin', '-8px 0' );
		replyButton.on( 'click', TalkBelow.onReplyButtonClick, [ replyButton ] );

		// Add to the DOM
		var $replies = $comment.children( 'dl' );
		if ( $replies.length ) {
			$replies.before( ' ', replyButton.$element );
		} else {
			$comment.append( ' ', replyButton.$element );
		}
	},

	/**
	 * Handle a click on a reply button
	 *
	 * @param {Object} replyButton
	 */
	onReplyButtonClick: function ( replyButton ) {

		// Disable the button to prevent further clicks
		replyButton.setDisabled( true );

		// If talkWikitext was already loaded by a previous click, just add the reply form
		if ( TalkBelow.talkWikitext ) {
			TalkBelow.addReplyForm( replyButton );
			return;
		}

		// Else get the talk wikitext and then add the reply form
		TalkBelow.getTalkWikitext().done( function () {
			TalkBelow.addReplyForm( replyButton );
		} );
	},

	/**
	 * Add a reply form
	 *
	 * @param {Object} replyButton
	 */
	addReplyForm: function ( replyButton ) {

		// In most cases, the relevant wikitext is that of the comment we're replying to
		var $replyButton = replyButton.$element;
		var $comment = $replyButton.closest( 'p, dd' );
		var relevantWikitext = TalkBelow.getRelevantWikitext( $comment );

		// But if the comment already has replies
		// then the relevant wikitext is that of the last reply
		// because we need to add the new reply below the last one
		var $replies = $comment.is( 'p' ) ? $comment.next( 'dl' ) : $comment.children( 'dl' );
		if ( $replies.length ) {
			var $lastReply = $replies.children( 'dd' ).last();
			relevantWikitext = TalkBelow.getRelevantWikitext( $lastReply );
		}

		// If no relevant wikitext is found, fallback to regular edit
		if ( !relevantWikitext ) {
			var $section = TalkBelow.getSection( $comment );
			var sectionNumber = $section ? 1 + $section.prevAll( 'h1, h2, h3, h4, h5, h6' ).length : 0;
			var page = mw.config.get( 'wgPageName' );
			var talk = new mw.Title( page ).getTalkPage();
			var editUrl = mw.util.getUrl( talk.getPrefixedText(), { action: 'edit', section: sectionNumber } );
			window.location.href = editUrl;
			return;
		}

		// Make the reply form
		var replyInput = new OO.ui.MultilineTextInputWidget( { name: 'reply', autosize: true, autofocus: true } );
		var replyLayout = new OO.ui.HorizontalLayout( { items: [ replyInput ] } );
		var publishButton = new OO.ui.ButtonInputWidget( { flags: [ 'primary', 'progressive' ], label: mw.msg( 'talkbelow-publish' ) } );
		var cancelButton = new OO.ui.ButtonInputWidget( { flags: 'destructive', framed: false, label: mw.msg( 'talkbelow-cancel' ) } );
		var buttonsLayout = new OO.ui.HorizontalLayout( { items: [ publishButton, cancelButton ] } );
		var form = new OO.ui.FormLayout( { items: [ replyLayout, buttonsLayout ] } );
		var $formWrapper = $( '<dd>' ).html( form.$element );

		// Make the font-family monospace to suggest that [[wikitext]] is allowed
		replyInput.$element.css( 'font-family', 'monospace' );

		// Add to the DOM
		if ( $replies.length ) {
			$replies.append( $formWrapper );
		} else {
			$replies = $( '<dl>' );
			$replies.append( $formWrapper );
			$comment.append( $replies );
		}

		// Focus the field because autofocus doesn't always work
		$formWrapper.find( 'textarea[name="reply"]' ).trigger( 'focus' );

		// Handle a submission
		publishButton.on( 'click', TalkBelow.onSubmitReply, [ $comment, $formWrapper, relevantWikitext, publishButton, cancelButton, replyButton ] );

		// Handle a cancel
		cancelButton.on( 'click', function () {
			$formWrapper.remove();
			if ( $replies.children().length === 0 ) {
				$replies.remove();
			}
			replyButton.setDisabled( false );
		} );
	},

	/**
	 * Handle a reply form submission
	 *
	 * @param {Object} $comment
	 * @param {Object} $formWrapper
	 * @param {string} relevantWikitext
	 * @param {Object} publishButton
	 * @param {Object} cancelButton
	 * @param {Object} replyButton
	 */
	onSubmitReply: function ( $comment, $formWrapper, relevantWikitext, publishButton, cancelButton, replyButton ) {

		// Check that the user wrote something
		var $reply = $formWrapper.find( 'textarea[name="reply"]' );
		var reply = $reply.val();
		if ( !reply ) {
			$reply.trigger( 'focus' );
			return;
		}

		// Disable the buttons
		// to prevent further clicks and to signal the user that something's happening
		publishButton.setDisabled( true );
		cancelButton.setDisabled( true );

		// Calculate the appropriate number of colons
		var depth = $comment.parents( 'dl' ).length + 1;
		var colons = '';
		for ( var i = 0; i < depth; i++ ) {
			colons += ':';
		}

		// Remove line breaks
		reply = reply.trim();
		reply = reply.replace( /\n+/g, ' ' );

		// Build the final wikitext of the reply
		var replyWikitext = '\n' + colons + reply + ' ~~~~';

		// Submit the reply
		TalkBelow.talkWikitext = TalkBelow.talkWikitext.replace( relevantWikitext, relevantWikitext + replyWikitext );
		var page = mw.config.get( 'wgPageName' );
		var talk = new mw.Title( page ).getTalkPage();
		var params = {
			action: 'edit',
			title: talk.getPrefixedText(),
			text: TalkBelow.talkWikitext,
			summary: mw.msg( 'talkbelow-summary' ),
			tags: mw.config.get( 'wgTalkBelowChangeTag' )
		};
		new mw.Api().postWithEditToken( params ).fail( TalkBelow.onError ).done( function () {
			TalkBelow.onSubmitReplySuccess( replyWikitext, replyButton, $formWrapper );
		} );
	},

	/**
	 * Handle a successful reply
	 *
	 * @param {string} replyWikitext
	 * @param {Object} replyButton
	 * @param {Object} $formWrapper
	 */
	onSubmitReplySuccess: function ( replyWikitext, replyButton, $formWrapper ) {
		var page = mw.config.get( 'wgPageName' );
		var talk = new mw.Title( page ).getTalkPage();
		var params = {
			action: 'parse',
			title: talk.getPrefixedText(),
			text: replyWikitext,
			formatversion: 2,
			pst: true,
			prop: 'text',
			disablelimitreport: true
		};
		new mw.Api().get( params ).fail( TalkBelow.onError ).done( function ( data ) {
			var text = data.parse.text;
			var $html = $( text );
			var $reply = $html.find( 'dd' ).last();
			$formWrapper.replaceWith( $reply );
			replyButton.setDisabled( false );
			TalkBelow.addReplyButton.call( $reply );
		} );
	},

	/**
	 * Add the new topic form
	 */
	addNewTopicForm: function () {

		// Build the form
		var titleInput = new OO.ui.TextInputWidget( { name: 'title', placeholder: mw.msg( 'talkbelow-title' ) } );
		var commentInput = new OO.ui.MultilineTextInputWidget( { name: 'comment', autosize: true, placeholder: mw.msg( 'talkbelow-comment' ) } );
		var publishButton = new OO.ui.ButtonInputWidget( { flags: [ 'primary', 'progressive' ], label: mw.msg( 'talkbelow-publish' ) } );
		var titleLayout = new OO.ui.HorizontalLayout( { items: [ titleInput ] } );
		var commentLayout = new OO.ui.HorizontalLayout( { items: [ commentInput ] } );
		var publishLayout = new OO.ui.HorizontalLayout( { items: [ publishButton ] } );
		var formLayout = new OO.ui.FormLayout( { items: [ titleLayout, commentLayout, publishLayout ] } );
		var $title = $( '<h2>' ).text( mw.msg( 'talkbelow-new-topic' ) );
		var $form = $( '<div>' ).attr( 'id', 'talkbelow-new-topic-form' ).append( $title, formLayout.$element );

		// Make the font-family monospace to suggest that [[wikitext]] is allowed
		commentInput.$element.css( 'font-family', 'monospace' );

		// Replace the "Add topic" button for the form
		var addTopicButton = document.getElementById( 'talkbelow-add-topic-button' );
		var $addTopicButton = $( addTopicButton );
		$addTopicButton.replaceWith( $form );

		// Handle submissions
		publishButton.on( 'click', TalkBelow.onSubmitNewTopic, [ publishButton ] );
	},

	/**
	 * @param {Object} publishButton
	 */
	onSubmitNewTopic: function ( publishButton ) {

		// Get the data from the form
		var $form = publishButton.$element.closest( '#talkbelow-new-topic-form' );
		var $title = $form.find( 'input[name="title"]' );
		var $comment = $form.find( 'textarea[name="comment"]' );
		var title = $title.val();
		var comment = $comment.val();

		// Do some basic validation
		if ( !title ) {
			$title.trigger( 'focus' );
			return;
		}
		if ( !comment ) {
			$comment.trigger( 'focus' );
			return;
		}

		// Disable the Publish button
		// to prevent further clicks and to signal the user that something is happening
		publishButton.setDisabled( true );

		// Submit the new topic
		var page = mw.config.get( 'wgPageName' );
		var talk = new mw.Title( page ).getTalkPage();
		var text = comment + ' ~~~~'; // Append the signature
		var params = {
			action: 'edit',
			title: talk.getPrefixedText(),
			section: 'new',
			sectiontitle: title,
			text: text,
			tags: mw.config.get( 'wgTalkBelowChangeTag' )
		};
		new mw.Api().postWithEditToken( params ).fail( TalkBelow.onError ).done( function () {
			TalkBelow.onSubmitNewTopicSuccess( talk, title, text, $form );
		} );
	},

	/**
	 * Handle a successful new topic submission
	 *
	 * @param {string} talk Talk page where the new topic was posted
	 * @param {string} title Title of the new topic
	 * @param {string} text Text of the new topic
	 * @param {Object} $form New topic form
	 */
	onSubmitNewTopicSuccess: function ( talk, title, text, $form ) {
		var params = {
			action: 'parse',
			title: talk.getPrefixedText(),
			section: 'new',
			sectiontitle: title,
			text: text,
			formatversion: 2,
			prop: 'text',
			pst: true,
			disablelimitreport: true
		};
		new mw.Api().get( params ).fail( TalkBelow.onError ).done( function ( data ) {
			// Remove the outer <div>
			var div = data.parse.text;
			var topic = $( div ).html();
			var $topic = $( topic );

			// Replace the form with the new topic
			$form.replaceWith( $topic );
			$topic.find( 'p' ).each( TalkBelow.addReplyButton );
		} );
	},

	/**
	 * Handle an API error
	 *
	 * @param {string} error
	 * @param {Object} data
	 */
	onError: function ( error, data ) {
		if ( 'error' in data && 'info' in data.error ) {
			error = data.error.info;
		}
		mw.notify( mw.msg( 'talkbelow-error', error ) );
	},

	/**
	 * Helper method to get the wikitext of the relevant talk page
	 *
	 * @return {Object} Promise
	 */
	getTalkWikitext: function () {
		var page = mw.config.get( 'wgPageName' );
		var talk = new mw.Title( page ).getTalkPage();
		var params = {
			page: talk.getPrefixedText(),
			action: 'parse',
			prop: 'wikitext',
			formatversion: 2
		};
		return new mw.Api().get( params ).done( function ( data ) {
			TalkBelow.talkWikitext = data.parse.wikitext;
		} );
	},

	/**
	 * Helper method to get the relevant wikitext that corresponds to a given comment or reply
	 *
	 * This is actually the heart of the tool
	 * It's a heuristic method to try to find the relevant wikitext
	 * that corresponds to the comment being replied to
	 * Since wikitext and HTML are different markups
	 * the only place where they are the same is in plain text fragments
	 * so we find the longest plain text fragment in the HTML
	 * then we search for that same fragment in the wikitext
	 * and return the entire line of wikitext containing that fragment
	 * or null if anything goes wrong
	 *
	 * @param {Object} $comment jQuery object representing the DOM element being edited
	 * @return {string|null} Wikitext of the comment being edited, or null if it can't be found
	 */
	getRelevantWikitext: function ( $comment ) {
		// The longest text node has the most chances of being unique
		var text = TalkBelow.getLongestText( $comment );

		// Some comments may not have text nodes at all
		if ( !text ) {
			return;
		}

		// Match all lines that contain the text
		text = text.replace( /\u00a0/g, ' ' ); // Replace nbsp sometimes added by the browser
		text = text.replace( /[.*+?^${}()|[\]\\]/g, '\\$&' ); // Escape special characters
		/* eslint-disable */
		var regexp = new RegExp( '.*' + text + '.*', 'g' );
		/* eslint-enable */
		var matches = TalkBelow.talkWikitext.match( regexp );

		// This may happen if the comments comes from a template
		if ( !matches ) {
			return;
		}

		// This may happen if the longest text is very short and repeats somewhere else
		if ( matches.length > 1 ) {
			return;
		}

		// We got our relevant wikitext line
		return matches[ 0 ];
	},

	/**
	 * Helper method to get the text of the longest text node
	 *
	 * @param {Object} $comment
	 * @return {string} Text of the longest text node
	 */
	getLongestText: function ( $comment ) {
		var text = '';
		var $textNodes = $comment.contents().filter( function () {
			return this.nodeType === 3; // Text node
		} );
		$textNodes.each( function () {
			var nodeText = $( this ).text().trim();
			if ( nodeText.length > text.length ) {
				text = nodeText;
			}
		} );
		return text;
	},

	/**
	 * Helper method to build a helpful edit summary
	 *
	 * @param {string} summary
	 * @param {Object} $comment
	 * @param {string} wikitext
	 * @return {string} Edit summary
	 */
	makeSummary: function ( summary, $comment, wikitext ) {
		if ( !summary ) {
			var page = mw.config.get( 'talkbelow-page', 'mw:TalkBelow' );
			summary = wikitext ? mw.msg( 'talkbelow-summary-edit', page ) : mw.msg( 'talkbelow-summary-delete', page );
		}
		var $section = TalkBelow.getSection( $comment );
		if ( $section ) {
			var section = $section.find( '.mw-headline' ).attr( 'id' ).replace( '/_/g', ' ' );
			summary = '/* ' + section + ' */ ' + summary;
		}
		summary += ' #talkbelow'; // For https://hashtags.wmcloud.org
		return summary;
	},

	/**
	 * Helper method to find the closest section
	 * by traversing back and up the DOM tree
	 *
	 * @param {Object} $element Starting element
	 * @return {Object} Closest section
	 */
	getSection: function ( $element ) {
		if ( $element.attr( 'id' ) === 'mw-content-text' ) {
			return;
		}
		if ( $element.is( 'h1, h2, h3, h4, h5, h6' ) ) {
			return $element;
		}
		var $previous = $element.prevAll( 'h1, h2, h3, h4, h5, h6' ).first();
		if ( $previous.length ) {
			return $previous;
		}
		var $parent = $element.parent();
		return TalkBelow.getSection( $parent );
	}
};

mw.loader.using( [
	'oojs-ui-core',
	'oojs-ui-widgets'
], TalkBelow.init );
