/*
These codes are licensed under CC0.
http://creativecommons.org/publicdomain/zero/1.0
*/

import * as $ from './ヘルパー.js'
import * as Action from './アクション.js'
import * as DB from './データベース.js'


async function init ( { ctx } ) {
	await play( ctx )
}


async function play ( ctx ) {

	//let settings = await $.fetchFile( 'json', './プログラム/設定.json' )
	let settings = { }
	settings.ctx = ctx
	//Object.assign( setting, systemSetting )
	$.log( settings )

	await DB.init( )
	await Action.initAction( settings )

	await Action.sysMessage( 'openノベルプレイヤー v1.0α' )

	while ( true ) {

		let res = await playSystemOpening( settings ).catch( e => $.error( e ) || 'error' )
		await Action.initAction( settings )

		if ( res == 'error' ) await Action.sysMessage( '問題が発生しました', 50 )
		else await Action.sysMessage( '再生が終了しました', 50 )


	}
}


async function playSystemOpening ( ctx ) {

	//await Action.sysBGImage( './画像/背景.png' )

	// インストール済み作品リストをロード

	Action.sysMessage( '開始する作品を選んで下さい', 50 )

	//let titleList = $.parseSetting(
	//	await $.fetchFile( 'text', '../作品/設定.txt' )
	//) [ '作品' ]

	let titleList = await DB.getTitleList( )

	$.log( titleList )

	titleList = [ ...Array( 12 ).keys( ) ].map( i => {
		let index = i + 1, settings = titleList[ index ] || { }, { title } = settings
		return {
			label: title ? title : '--------', value: { settings, index }
		}
	} )


	let { settings, index } = await Action.sysChoices( titleList )
	let { title } = settings

	$.log( index, settings )


	// シナリオ開始メニュー表示
	Action.sysMessage( '開始メニュー', 100 )

	let menuList = [ '初めから', '続きから', '途中から', 'インストール' ].map( label => ( { label } ) )

	if ( ! title ) {
		$.disableChoiceList( [ '初めから', '続きから', '途中から' ], menuList )
	} else {
		$.disableChoiceList( [ '途中から' ], menuList )
	}

	let sel = await Action.sysChoices( menuList )

	$.log( sel )

	switch ( sel ) {

		case '初めから': {

			return Action.play( settings )

		} break
		case '続きから': {

			let stateList = await DB.getStateList( title )
			let choices = await $.getSaveChoices( title, 12 )
			let index = await Action.sysChoices( choices )
			let state = await DB.loadState( settings.title, index )
			return Action.play( settings, state )

		}　break
		case 'インストール': {

			await installScenario( index )
			await Action.sysMessage( 'インストールが完了しました', 100 )
			return playSystemOpening( ctx )

		} break

		default: throw 'UnEx'
	}

} 



async function installScenario ( index ) {

	Action.sysMessage( 'インストール方法を選んで下さい', 100 )

	let menuList = [ 'Webから', 'フォルダから' ].map( label => ( { label } ) )
	$.disableChoiceList( [ 'Webから' ], menuList )

	let sel = await Action.sysChoices( menuList )
	$.log( sel )

	let files

	switch ( sel ) {

		case 'フォルダから': {

			Action.sysMessage( 'フォルダを選んで下さい' )
			let input = document.createElement( 'input' )
			input.type = 'file'
			input.webkitdirectory = true
			input.onchange = ( ) => { if ( input.files ) player.fire( 'file', input.files ) }

			input.click( )
			files = Array.from( await player.on( 'file' ) )

	} break
		default : throw 'UnEx'
	} 

	Action.sysMessage( 'インストールしています……' )

	//window.files = files

	let settingFile
	let data = files.map( file => {
		if ( file.name == '設定.txt' ) {	settingFile = file }
		let relpath = file.webkitRelativePath.match( /(.+)\./ )[ 1 ]
		return [ file, relpath ]
	} )

	let title = settingFile.webkitRelativePath.match( /[^/]+/ )[ 0 ]

	let setting = $.parseSetting( await new Response( settingFile ).text( ) )
	setting.title = title

	await DB.saveFiles( data )

	DB.saveTitle( index, setting )

	//let firstScnario = scenarioSetting[ '開始シナリオ' ][ 0 ]
	
	//$.log( firstScnario )

}



export let { target: initPlayer, register: nextInit } = new $.AwaitRegister( init )


export function onPointerEvent ( { type, button, x, y } ) {

	player.fire( 'pointer' )
	Action.onPoint( { type, button, x, y } )
}

export function onKeyEvent ( { type } ) {

	Action.onAction( type )
}

export function onDrop( file ) {
	
	player.fire( 'drop', file )

}

let player = new $.Awaiter

