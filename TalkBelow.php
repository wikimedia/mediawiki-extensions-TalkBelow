<?php

use MediaWiki\MediaWikiServices;

class TalkBelow {

	/**
	 * @param array $ids
	 */
	public static function onGetDoubleUnderscoreIDs( &$ids ) {
		$ids[] = 'NOTALKBELOW';
	}

	/**
	 * @param OutputPage &$out
	 * @param Skin &$skin
	 */
	public static function onBeforePageDisplay( OutputPage &$out, Skin &$skin ) {
		$out->addModules( 'ext.TalkBelow' );
	}

	/**
	 * @param string &$data
	 * @param Skin &$skin
	 */
	public static function onSkinAfterContent( &$data, Skin $skin ) {

		$context = $skin->getContext();
		$action = Action::getActionName( $context );
		if ( $action !== 'view' ) {
			return;
		}

		$title = $skin->getTitle();
		if ( !$title->exists() ) {
			return;
		}

		if ( $title->isTalkPage() ) {
			return;
		}

		if ( !$title->canHaveTalkPage() ) {
			return;
		}

		$parserOutput = $skin->getWikiPage()->getParserOutput();
		if ( $parserOutput->getPageProperty( 'NOTALKBELOW' ) !== null ) {
			return;
		}

		$talk = $title->getTalkPage();
		if ( $talk->isRedirect() ) {
			$redirectLookup = MediaWikiServices::getInstance()->getRedirectLookup();
			$talk = $redirectLookup->getRedirectTarget( $talk );
		}

		// Some pages, like the village pump, may have their talk page be a redirect to the subject page
		if ( $title->equals( $talk ) ) {
			return;
		}

		// Get the HTML of the talk page
		$talkHtml = '';
		if ( $talk->exists() ) {
			$talkPage = WikiPage::factory( $talk );
			$talkOutput = $talkPage->getParserOutput();
			$talkHtml = $talkOutput->getText( [ 'allowTOC' => false ] );
		}

		// Build the HTML of the discussion section, starting with the section heading and actions
		$view = Html::rawElement( 'a', [ 'href' => $talk->getLinkURL() ], $context->msg( 'view' ) );
		$edit = Html::rawElement( 'a', [ 'href' => $talk->getEditURL() ], $context->msg( 'edit' ) );
		$bracket = Html::rawElement( 'span', [ 'class' => 'mw-editsection-bracket' ], '[' );
		$divider = Html::rawElement( 'span', [ 'class' => 'mw-editsection-divider' ], ' | ' );
		$bracket2 = Html::rawElement( 'span', [ 'class' => 'mw-editsection-bracket' ], ']' );
		$wrapper = Html::rawElement( 'span', [ 'class' => 'mw-editsection' ], $bracket . $view . $divider . $edit . $bracket2 );
		$heading = Html::rawElement( 'h1', [ 'class' => 'talkbelow-heading' ], $context->msg( 'talk' ) . $wrapper );

		// Build the button to add a new topic
		$skin->getOutput()->enableOOUI();
		$addTopicButton = new OOUI\ButtonWidget( [
			'label' => $context->msg( 'skin-action-addsection' ),
			'href' => $talk->getLinkURL( 'action=edit&section=new' ),
		] );
		$addTopicWrapper = Html::rawElement( 'div', [ 'class' => 'talkbelow-add-topic-button' ], $addTopicButton );

		// Put everything together
		$section = Html::rawElement( 'div', [  'id' => 'Talk', 'class' => 'talkbelow-section' ], $heading . $talkHtml . $addTopicWrapper );
		$data = $section;
	}
}
