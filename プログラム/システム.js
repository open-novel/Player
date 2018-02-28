/*
These codes are licensed under CC0.
http://creativecommons.org/publicdomain/zero/1.0
*/

import * as $ from './ヘルパー.js'
import * as Action from './アクション.js'
import * as DB from './データベース.js'

const script_baseurl = document.querySelector( 'script[type="module"]' ).src.match( /.+\// )
const Archive = $.importWorker( `${ script_baseurl }アーカイブ.js` )


async function init ( { ctx, mode } ) {
	await play( ctx, mode )
}


async function play ( ctx, mode ) {

	//let settings = await $.fetchFile( 'json', './プログラム/設定.json' )
	let settings = { }
	settings.ctx = ctx
	//Object.assign( setting, systemSetting )
	$.log( settings )

	await DB.init( )
	await Action.initAction( settings )

	await Action.sysMessage( 'openノベルプレイヤー v1.0β   18/02/28' )

	while ( true ) {

		let res = await playSystemOpening( mode ).catch( e => $.error( e ) || 'error' )
		if ( mode == 'install' ) return

		await Action.initAction( settings )
		if ( res == 'error' ) await Action.sysMessage( '問題が発生しました', 50 )
		else await Action.sysMessage( '再生が終了しました', 50 )


	}
}


async function playSystemOpening ( mode ) {

	//await Action.sysBGImage( './画像/背景.png' )

	// インストール済み作品リストをロード
	if ( mode == 'install' )  Action.sysMessage( 'インストール先を選んで下さい', 50 )
	else Action.sysMessage( '開始する作品を選んで下さい', 50 )

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

	let others = {
		globalVarMap: settings.globalVarMap,
		saveGlobalVarMap: async map => {
			settings.globalVarMap = map
			await DB.saveTitle( index, settings )
		}
	}


	if ( mode == 'install' ) {
		let success = await installScenario( index, 'Webから' )
		if ( success ) await Action.sysMessage( 'インストールが完了しました', 100 )
		else await Action.sysMessage( 'インストールできませんでした', 100 )
		return

	}
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

			return Action.play( settings, null, others )

		} break
		case '続きから': {

			let stateList = await DB.getStateList( title )
			let choices = await $.getSaveChoices( title, 12, { isLoad: true } )
			let index = await Action.sysChoices( choices )
			let state = await DB.loadState( settings.title, index )
			return Action.play( settings, state, others )

		}　break
		case 'インストール': {

			let success = await installScenario( index )
			if ( success ) await Action.sysMessage( 'インストールが完了しました', 100 )
			else await Action.sysMessage( 'インストールできませんでした', 100 )
			return playSystemOpening( mode )

		} break

		default: throw 'UnEx'
	}

}



async function installScenario ( index, sel ) {


	if ( ! sel ) {
		Action.sysMessage( 'インストール方法を選んで下さい', 100 )

		let menuList = [ 'フォルダから', 'Zipファイルから' ].map( label => ( { label } ) )
		$.disableChoiceList( [ 'Webから' ], menuList )

		sel = await Action.sysChoices( menuList )
	}
	$.log( sel )

	let files

	switch ( sel ) {

		case 'フォルダから': {

			Action.sysMessage( 'フォルダを選んで下さい' )
			files = await fileSelect( { folder: true } )

		} break
		case 'Zipファイルから': {

			Action.sysMessage( 'Zipファイルを選んで下さい' )
			files = await fileSelect( )
			if ( ! files ) return false
			files = await unpackFile( files[ 0 ] )

		} break
		case 'Webから': {

			Action.sysMessage( 'ダウンロード中……' )
			files = ( await player.on( 'install', true ) ).file
			files = await unpackFile( files )

		} break
		default : throw 'UnEx'
	}

	if ( ! files ) return false


	async function unpackFile ( zip ) {
		if ( ! zip ) return null
		let data = ( await Archive.unpackFile( zip ) ).data
		if ( ! data ) return null
		return data.map( f => new File( [ f.data ], f.name, { type: f.type } ) )
	}


	async function fileSelect ( { folder = false } = { } ) {
		let input = document.createElement( 'input' )
		input.type = 'file'
		input.webkitdirectory = folder
		input.onchange = ( ) => player.fire( 'file', input.files )
		input.click( )
		let files = await Promise.race( [ player.on( 'file' ), player.on( 'pointer' ) ] )
		if ( files ) files = Array.from( files )
		return files
	}

	Action.sysMessage( 'インストールしています……' )

	//window.files = files

	let settingFile
	let data = files.map( file => {
		if ( file.name.includes( '設定.txt' ) ) { settingFile = file }
		let relpath = file.webkitRelativePath || file.name
		let path = relpath.match( /(.+)\./ )[ 1 ]
		return [ file, path ]
	} )

	let title = ( settingFile.webkitRelativePath || settingFile.name ).match( /[^/]+/ )[ 0 ]

	let setting = $.parseSetting( await new Response( settingFile ).text( ) )
	setting.title = title

	await DB.saveFiles( data )

	DB.saveTitle( index, setting )

	//let firstScnario = scenarioSetting[ '開始シナリオ' ][ 0 ]

	//$.log( firstScnario )

	return true

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


export async function onMessage ( data ) {

	player.fire( 'install', data )

}
