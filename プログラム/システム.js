/*
These codes are licensed under CC0.
http://creativecommons.org/publicdomain/zero/1.0
*/

import * as $ from './ヘルパー.js'
import * as Action from './アクション.js'
import * as DB from './データベース.js'


const Archive = $.importWorker( `アーカイブ` )

async function init ( { ctx, mode, installEvent } ) {
	await play( ctx, mode, installEvent )
}


async function play ( ctx, mode, installEvent ) {

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
	let text = 'openノベルプレイヤー v1.0β_118   18/09/02' +
		( $.TEST.mode ? `  *${ $.TEST.mode } test mode*` : '' )

		WHILE: while ( true ) {

			Action.sysMessage( text )
			Action.setMenuVisible( true )

			let list = [
				{ label: '🔊　サウンドONで開始する ', value: 'on' },
				{ label: '🔇　サウンドOFFで開始する', value: 'off' },
				{ label: '⏬　アプリとして登録する　', value: 'install' }
			]
			let select = await Action.sysChoices( list, { rowLen: 3 } )
			if ( select == 'install' ) {
				let result = await Promise.race( [ installEvent.promise, $.timeout( 1 ) ] )
				if ( result ) result.prompt( )
				else {
					Action.sysMessage(
						'ブラウザの準備が整っていなかったため'
						+'\\nインストールできませんでした' )
					await $.timeout( 3000 )
				}
				continue WHILE
			}
			sound = select
			break WHILE
		}
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
		location.hash = ''
		location.reload( )
		await $.neverDone( )

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

			let state = await Action.showSaveLoad( { title, isLoad: true, settings, others } )
			if ( state === $.Token.cancel ) return playSystemOpening( mode )
			return Action.play( settings, state, others )
			//return playSystemOpening( mode )

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
			if ( ! data ) return null
			switch ( data.type ) {
				case 'install-folder': {
					if ( ! data.title ) return null
					files = await collectScenarioFiles( data )
				} break
				case 'install-packed': {
					if ( ! data.file ) return null
					files = await unpackFile( data.file )
				} break
				default: {
					return null
				}
			}

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


	async function collectScenarioFiles ( { port, title } ) {

		let fileMap = new Map
		let cacheMap = new Map

		let doneCount = 0, fetchCount = 0

		function getFile( path ) {

			++fetchCount

			Action.sysMessage( 'ダウンロード中……\\n' + `${ doneCount }/${ fetchCount }` )

			if ( cacheMap.has( path ) ) return null

			return new Promise( ( ok, ng ) => {
				port.addEventListener( 'message', ( { data } ) => {
					$.log( path )
					if ( data.path != path ) return
					++doneCount
					Action.sysMessage( 'ダウンロード中……\\n' + `${ doneCount }/${ fetchCount }` )
					if ( ! data.file ) ng ( )
					cacheMap.set( path, data.file )
					ok( data.file )
				} )
				port.postMessage( { path } )
			} )
		}

		let startScenario ='シナリオ/' + title
		let file = await getFile( '設定.txt' )
		if ( file ) {
			startScenario = 'シナリオ/' + ( await new Response( file ).json( ) ) [ '開始シナリオ' ]
		}

		async function getScenario( path ) {
			let file = await getFile( path )
			if ( ! file ) return null
			let list = Action.getFileList( await new Response( file ).text( ) )
			$.log( 'list', list )
			return Promise.all( list.map( ( { type, path } ) => {
				return type == 'scenario' ? getScenario( path ) : getFile( path )
			} ) )
		}

		await getScenario( startScenario ).catch( e => {
			$.hint( '取得できないファイルがありました' )
			return e
		} )

		return [ ...cacheMap ].map( ( [ name, f ] ) => new File( [ f.data ], title + '' + name, { type: f.type }  ) )

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



	let title = ''
	if ( files.every( ( file ) => {
		let relpath = file.webkitRelativePath || file.name
		let [ ,path, cut ] = relpath.match( /([^.]+)(.*)$/ )
		path = path.replace( /:/g, '/' )
		return path.match( /^シナリオ\// )
	} ) ) title = files[ 0 ].name.match(/([^/.]+)\..+$/)[ 1 ] + '/'

	let data = files.map( file => {
		if ( file.name.includes( '設定.txt' ) ) { settingFile = file }
		let relpath = file.webkitRelativePath || file.name
		let [ ,path, cut ] = relpath.match( /([^.]+)(.*)$/ )
		path = title + path.replace( /:/g, '/' )
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

	title = data[ 0 ][ 1 ].match( /^[^/]+/ )[ 0 ]

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
