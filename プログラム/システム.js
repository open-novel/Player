/*
These codes are licensed under CC0.
http://creativecommons.org/publicdomain/zero/1.0
*/

import * as $ from './ヘルパー.js'
import * as Action from './アクション.js'
import * as DB from './データベース.js'


const Archive = $.importWorker( `アーカイブ` )

async function init ( { ctx, mode } ) {
	await play( ctx, mode )
}


async function play ( ctx, mode ) {

	if ( mode == 'VR' ) {
		mode = ''
		$.TEST.mode = 'VR'
		let btn = document.createElement( 'button' )
		btn.innerText = 'into VR'
		document.body.appendChild( btn )
		btn.onclick = async ( ) => {
			let disp = await navigator.getVRDisplays( )[ 0 ]
			disp.requestPresent( [ { source: ctx.canvas } ] )
		}
	}

	//let settings = await $.fetchFile( 'json', './プログラム/設定.json' )
	let settings = { }
	settings.ctx = ctx
	//Object.assign( setting, systemSetting )
	$.log( settings )

	await DB.init( )
	await Action.initAction( settings )

	let sound = 'off'
	if ( mode != 'install' ) {
		Action.sysMessage( 'openノベルプレイヤー v1.0β_077   18/07/23' +
			( $.TEST.mode ? `  *${ $.TEST.mode } test mode*` : '' )  )

		Action.setMenuVisible( true )
		let list = [ { label: '🔊', value: 'on' }, { label: '🔇', value: 'off' } ]
		sound = await Action.sysChoices( list, { rowLen: 1 } )
	}

	if ( sound == 'on' ) Action.setMainVolume( 1 )
	else Action.setMainVolume( 0 )
	Action.setMenuVisible( false )

	while ( true ) {

		let res = await playSystemOpening( mode ).catch( e => $.error( e ) || 'error' )
		if ( mode == 'install' ) return

		await Action.initAction( settings )
		Action.setMenuVisible( false )
		if ( res == 'error' ) await Action.sysMessage( '問題が発生しました', 50 )
		else await Action.sysMessage( '再生が終了しました', 50 )


	}
}


async function playSystemOpening ( mode ) {

	//await Action.sysBGImage( './画像/背景.png' )
	Action.setMenuVisible( true )
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
		let success = await installScenario( index, 'リンクから' )
		if ( success ) await Action.sysMessage( 'インストールが完了しました', 100 )
		else await Action.sysMessage( 'インストールできませんでした', 100 )
		window.close( )

	}
	// シナリオ開始メニュー表示
	Action.sysMessage( '開始メニュー', 100 )

	let menuList = [ '初めから', '続きから', '途中から', 'インストール' ].map( label => ( { label } ) )

	if ( ! title ) {
		$.disableChoiceList( [ '初めから', '続きから', '途中から' ], menuList )
	}

	let sel = await Action.sysChoices( menuList, { backLabel: '戻る' } )

	$.log( sel )

	switch ( sel ) {

		case null: {

			return playSystemOpening( mode )

		} break
		case '初めから': {

			return Action.play( settings, null, others )

		} break
		case '続きから': {

			await Action.showSaveLoad( { title, isLoad: true, settings, others } )
			return playSystemOpening( mode )

		} break
		case '途中から': {

			let jump = prompt( '開始先を次の形式で入力してください\nシナリオ名#マーク名', '#' )
			if ( jump === null ) return playSystemOpening( mode )
			others.jump = jump.split( '#' )
			return Action.play( settings, null, others )

		} break
		case 'インストール': {

			let success = await installScenario( index )
			if ( success === null ) return playSystemOpening( mode )
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

		let menuList = [ 'フォルダから', 'Zipファイルから', 'Webから' ].map( label => ( { label } ) )

		sel = await Action.sysChoices( menuList, { backLabel: '戻る' } )
	}
	$.log( sel )

	Action.setMenuVisible( false )

	let files

	switch ( sel ) {

		case null: {

			return null

		} break
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

			await Action.sysMessage( 'openノベルプレイヤー向けに作品を公開しているサイトで'
			+'\\n作品のリンクをクリックするとここへインストールできます' )

		} break
		case 'リンクから': {

			Action.sysMessage( 'ダウンロード中……' )
			let data = await player.on( 'install', true )
			if ( ! data || ! data.file ) return null
			files = await unpackFile( data.file )

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
		let trigger = new Action.Trigger
		let files = await trigger.stepOr( player.on( 'file' ) )
		if ( typeof files == 'object' ) return Array.from( files )
		else return null
	}

	Action.sysMessage( 'インストールしています……' )

	//window.files = files

	let settingFile
	let dataMap = new Map

	let data = files.map( file => {
		if ( file.name.includes( '設定.txt' ) ) { settingFile = file }
		let relpath = file.webkitRelativePath || file.name
		let [ ,path, cut ] = relpath.match( /([^.]+)(.*)$/ )
		if ( ( ! dataMap.has( path ) ) || ( dataMap.get( path ).cut.length > cut.length ) ) {
			dataMap.set( path, { file, cut } )
		}
		return [ file, path ]
	} ).filter( ( [ file, path ] ) => {
		//let flag = [ 'text', 'image', 'audio' ].includes( file.type.split( '/' )[ 0 ] )
		let flag = dataMap.get( path ).file == file
		if ( ! flag ) $.warn( `保存されないファイルがあります` )
		return flag
	} )

	let title = ( files[ 0 ].webkitRelativePath || files[ 0 ].name ).match( /[^/]+/ )[ 0 ]

	let setting = settingFile ?  $.parseSetting( await new Response( settingFile ).text( ) ) : { }
	setting.title = title

	await DB.saveFiles( data )

	DB.saveTitle( index, setting )

	//let firstScnario = scenarioSetting[ '開始シナリオ' ][ 0 ]

	//$.log( firstScnario )

	return true

}



export let { target: initPlayer, register: nextInit } = new $.AwaitRegister( init )


export function onPointerEvent ( { type, button, x, y } ) {

	//$.log( { x, y } )
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
