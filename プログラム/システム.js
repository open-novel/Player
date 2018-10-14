/*
These codes are licensed under CC0.
http://creativecommons.org/publicdomain/zero/1.0
*/

import * as $ from './ヘルパー.js'
import * as Action from './アクション.js'
import * as DB from './データベース.js'


const Archive = $.importWorker( `アーカイブ` )

async function init ( { ctx, mode, installEvent, option } ) {
	await play( { ctx, mode, installEvent, option } )
}


async function play ( { ctx, mode, installEvent, option } ) {


	//let settings = await $.fetchFile( 'json', './プログラム/設定.json' )
	let settings = { }
	settings.ctx = ctx
	//Object.assign( setting, systemSetting )
	$.log( settings )

	await DB.init( )
	await Action.initAction( settings )

	let sound = 'off'
	if ( mode != 'install' ) {

	let text = 'openノベルプレイヤー v1.0γ_052  patch1  18/10/14\\n' +
		( option.pwa ? '【 PWA Mode 】\\n' : '' )


		WHILE: while ( true ) {

			Action.sysMessage( text, Infinity )

			let list = [
				{ label: '🔊　サウンドONで開始する ', value: 'on' },
				{ label: '🔇　サウンドOFFで開始する', value: 'off' },
			]
			if ( ! option.pwa ) list.push(
				{ label: '⏬　アプリとして登録する　', value: 'install' }
			)

			let select = await Action.sysChoices( list, { rowLen: 3, menuEnebled: false } )
			if ( select == 'install' ) {
			let result = await Promise.race( [ installEvent.promise, $.timeout( 1 ) ] )
			if ( result ) {
				let res = result.prompt( )
				let choice = ( await result.userChoice ).outcome
				$.log( choice )
				if ( choice == 'accepted' ) {
					Action.sysMessage( '登録が完了しました' )
				} else {
					Action.sysMessage( '登録が拒否されました' )
				}
				await Action.sysChoices( [ ], { backLabel: '戻る' } )
				
			} else {
				Action.sysMessage(
					'ブラウザに認められなかったため登録できませんでした\\n' +
					'（既に登録済みの可能性もあります）' )
				await Action.sysChoices( [ ], { backLabel: '戻る' } )
			}
				continue WHILE
			}
			sound = select
			break WHILE
		}
	}



	if ( sound == 'on' ) Action.setMainVolume( 1 )
	else Action.setMainVolume( 0 )

	while ( true ) {

		let res = await playSystemOpening( mode ).catch( e => $.error( e ) || 'error' )
		if ( mode == 'install' ) return

		await Action.initAction( settings )
		
		if ( res == 'error' ) Action.sysMessage( '問題が発生しました' )
		else Action.sysMessage( '再生が終了しました' )
		await Action.sysChoices( [ ], { backLabel: '作品選択へ' } )

	}
}


async function playSystemOpening ( mode ) {

	//await Action.sysBGImage( './画像/背景.png' )
	// インストール済み作品リストをロード
	if ( mode == 'install' )  Action.sysMessage( 'インストール先を選んで下さい' )
	else Action.sysMessage( '開始する作品を選んで下さい' )

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


	let cho = await Action.sysChoices( titleList, { menuType: 'open' } )

	if ( cho == $.Token.close ) {
		await showSysMenu( )
		return playSystemOpening( mode )
	}

	let { settings, index } = cho

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
		if ( success == $.Token.success ) Action.sysMessage( 'インストールが完了しました' )
		else Action.sysMessage( 'インストールできませんでした' )
		await Action.sysChoices( [ ], { backLabel: 'リセットする' } )
		location.hash = ''
		location.reload( )
		await $.neverDone

	}
	// シナリオ開始メニュー表示

	let menuList = [ '初めから', '続きから', '途中から', 'インストール' ].map( label => ( { label } ) )

	if ( ! title ) {
		$.disableChoiceList( [ '初めから', '続きから', '途中から' ], menuList )
	}

	WHILE: while ( true ) {

		Action.sysMessage( `作品名：『 ${ title || '--------' } 』\\n開始メニュー` )
		let sel = await Action.sysChoices( menuList, { backLabel: '戻る' } )
		$.log( sel )

		SWITCH: switch ( sel ) {

			case $.Token.back:
			case $.Token.close:
				break WHILE

			case '初めから':
				return Action.play( settings, null, others )

			case '続きから': {

				let state = await Action.showSaveLoad( { title, isLoad: true, settings, others } )
				if ( state === $.Token.back ) break SWITCH
				if ( state === $.Token.close ) break WHILE
				$.assert( typeof state == 'object' )
				return Action.play( settings, state, others )
				//return playSystemOpening( mode )

			} break
			case '途中から': {

				let jump = await Action.showMarkLoad( { settings } )
				//let jump = prompt( '開始先を次の形式で入力してください\nシナリオ名#マーク名', '#' )
				if ( jump == $.Token.back ) break SWITCH
				if ( jump == $.Token.close ) break WHILE
				$.assert( typeof jump == 'string' )
				others.jump = jump.split( '#' )
				return Action.play( settings, null, others )

			} break
			case 'インストール': {

				let success = await installScenario( index )
				$.assert( $.isToken( success ) )
				if ( success == $.Token.back ) break SWITCH
				if ( success == $.Token.close ) break WHILE
				if ( success == $.Token.success ) {
					Action.sysMessage( 'インストールが完了しました' )
					await Action.sysChoices( [ ], { backLabel: '作品選択へ' } )
				}
				if ( success == $.Token.failure ) {
					Action.sysMessage( 'インストールできませんでした' )
					await Action.sysChoices( [ ], { backLabel: '作品選択へ' } )
				}
				return playSystemOpening( mode )

			} break

			default: throw 'UnEx'
		}

	}

	return playSystemOpening( mode )

}


async function showSysMenu ( ) {


	WHILE: while ( true ) {

		Action.sysMessage( 'システムメニュー' )

		
		let sel = await Action.sysChoices(
			[ 'データ保存状況', '実験機能' ], { backLabel: '戻る', color: 'green' }
		)

		$.log( sel )

		SWITCH: switch ( sel ) {

			case $.Token.back:
			case $.Token.close:
				break WHILE

			case 'データ保存状況': WHILE2: while ( true ) {

				let { usage, quota } = await navigator.storage.estimate( )
				let  persisted = await navigator.storage.persisted( )
				let ratio = ( 100 * usage / quota ).toFixed( )
				usage = ( usage / 1024 / 1024 / 1024 ).toFixed( 1 )
				quota = ( quota / 1024 / 1024 / 1024 ).toFixed( 1 )


				Action.sysMessage(
					`データ保存状況：　${ quota }GB割当済　${ usage }GB使用済　使用率${ ratio }％\\n`+
					`ブラウザ判断での突然の消去の可能性：　${ persisted ? '無し' : '有り' }`
					, Infinity
				)

				let choices =  persisted ? [ ] : [ 'データの永続的な保存をリクエストする' ]
				let sel = await Action.sysChoices( choices, { backLabel: '戻る', color: 'green' } )
				if ( sel == $.Token.back ) break SWITCH
				if ( sel == $.Token.close ) break WHILE
				if ( sel == 'データの永続的な保存をリクエストする' ) {
					let success = await navigator.storage.persist( )
					if ( success ) {
						Action.sysMessage(
							'次回起動時からデータが永続的に保存されるようになりました\\n' +
							'（自然と消えることが無いだけでユーザー操作では削除できます）\\n' +
							'変更を反映させるためにプレイヤーをリセットしてください'
						) 
						await Action.sysChoices( [ ], { backLabel: 'リセットする', color: 'green' } )
						location.reload( )
						await $.neverDone
					} else {
						Action.sysMessage(
							'データの永続的な保存が認められませんでした\\n' +
							'（プレイヤーをアプリとして登録すると認められる可能性があります）'
						) 
						let sel = await Action.sysChoices( [
							//'PWAとして登録する', '❔　PWAとは'
						], { backLabel: '戻る', color: 'green' } )
						if ( sel == $.Token.back ) continue WHILE2
						if ( sel == $.Token.close ) break WHILE
					}

				}

			} break
			case '実験機能': WHILE2: while ( true ) {

				Action.sysMessage(
					'クリックで各機能の有効無効を切り替えられます'
				)

				let VR = $.Settings.VR

				let sel = await Action.sysChoices( [

					async function * ( ) {
						if ( ! navigator.getVRDisplays ) return yield { label: `VR　(サポートされていません)`, disabled: true }
						yield { label: `VR　(デバイスの状態を確認中……)`, disabled: true }
						let disp = ( await navigator.getVRDisplays( ) )[ 0 ]
						VR.display = disp
						$.log( disp )
						if ( ! disp ) return yield { label: `VR　(デバイスが見つかりません)`, disabled: true }
						//if ( ! disp.isConnected ) return yield { label: `VR　(「${disp.displayName}」を接続してください)`, disabled: true }
						//if ( ! disp.isPresenting ) return yield { label: `VR　(現在ON：表示中)`, value: 'VR' }
						if ( VR.failureNum ) return yield { label: `VR　(現在OFF:失敗${ VR.failureNum }回)`, value: 'VR' }	
						return yield { label: `VR　(現在OFF)`, value: 'VR' }						
					}

				], { backLabel: '戻る', color: 'green' } )

				if ( sel == $.Token.back ) break WHILE2
				if ( sel == $.Token.close ) break WHILE


				if  ( sel == 'VR' ) {
					let res = await $.trying( Action.presentVR( VR.enabled = ! VR.enabled ) )
					if ( res == $.Token.failure ) {
						VR.failureNum = ( VR.failureNum || 0 ) + 1
						VR.enabled = false
					} else {
						VR.failure = false						
					}
				}
			}

			break
			default: throw 'UnEx'

		}

	}

	//return showSysMenu( )


}



async function installScenario ( index, sel ) {


	if ( ! sel ) {
		Action.sysMessage( 'インストール方法を選んで下さい', 100 )

		let menuList = [ 'フォルダから', 'Zipファイルから', 'Webから' ].map( label => ( { label } ) )

		sel = await Action.sysChoices( menuList, { backLabel: '戻る' } )
	}
	$.log( sel )



	let files, origin = 'unknown/'

	switch ( sel ) {

		case $.Token.back:
		case $.Token.close:
			return sel

		case 'フォルダから': {

			Action.sysMessage( 'フォルダを選んで下さい' )
			files = await fileSelect( { folder: true } )
			if ( files == $.Token.back ) return installScenario( index )
			if ( $.isToken( files ) ) return files
			origin = 'local/'

		} break
		case 'Zipファイルから': {

			Action.sysMessage( 'Zipファイルを選んで下さい' )
			files = await fileSelect( )
			if ( files == $.Token.back ) return installScenario( index )
			if ( $.isToken( files ) ) return files
			files = await unpackFile( files[ 0 ] )
			origin = 'local/'

		} break
		case 'Webから': {

			Action.sysMessage( 'openノベルプレイヤー向けに作品を公開しているサイトで'
			+'\\n作品のリンクをクリックするとここへインストールできます' )

			await Action.sysChoices( [ ], { backLabel: '戻る' } )
			return $.Token.back


		} break
		case 'リンクから': {

			Action.sysMessage( 'ダウンロード中……' )
			let data = await player.on( 'install', true )
			if ( ! data ) return $.Token.failure
			if ( data.url ) origin = new URL( data.url ).origin + '/'
			switch ( data.type ) {
				case 'install-folder': {
					if ( ! data.title ) return $.Token.failure
					files = await collectScenarioFiles( data ).catch( e => {
						$.hint( '取得できないファイルがありました' )
						$.error( e )
						return $.Token.failure
					} )
				} break
				case 'install-packed': {
					if ( ! data.file ) return $.Token.failure
					files = await unpackFile( data.file )
				} break
				default: {
					return $.Token.failure
				}
			}

		} break
		default : throw 'UnEx'
	}

	if ( ! files ) return $.Token.failure


	async function unpackFile ( zip ) {
		if ( ! zip ) return $.Token.failure
		let data = ( await Archive.unpackFile( zip ) ).data
		if ( ! data ) return $.Token.failure
		return data.map( f => new File( [ f.data ], f.name, { type: f.type } ) )
	}


	async function collectScenarioFiles ( { port, title } ) {

		port.start( )

		title = decodeURIComponent( title )

		let cacheMap = new Map

		let doneCount = 0, fetchCount = 0

		const extensions = {
			text: [ 'txt' ],
			image: [ 'webp', 'png', 'jpg', 'svg', 'gif' ],
			audio: [ 'webm', 'mp3', 'wav', 'ogg', 'flac' ],
		}

		function getFile( path, type ) {

			if ( cacheMap.has( path ) ) return null

			let showCount = ( ) => Action.sysMessage( 'ダウンロード中……\\n' + `${ doneCount }/${ fetchCount }`, Infinity )

			++fetchCount; showCount( )

			let exts = extensions[ type ].concat( extensions[ type ].map( e => e.toUpperCase( ) ) )

			let done = false

			return new Promise( ( ok, ng ) => {

				port.addEventListener( 'message', ( { data } ) => {
					if ( data.path != path ) return
					//$.log( '<---', data.path )
					if ( ! data.file ) {
						$.hint( `【 ${ path } 】のダウンロードに失敗しました\n確認した拡張子：${ exts }`)
						ng ( )
						return
					}
					cacheMap.set( path, data.file )
					ok( data.file )
				} )
				//$.log( '--->', path )
				port.postMessage( { path, extensions: exts } )
				$.timeout( 10000 ).then(  ( ) => {
					if ( done ) return
					$.hint(`【 ${ path } 】のダウンロードがタイムアウトしました\n制限時間：10秒`)
					ng( )
				} )

			} ).then( f => { ++doneCount; showCount( ); return f } ).finally( ( ) => { done = true } )

		}

		let startScenario ='シナリオ/' + title
		let file = await getFile( '設定', 'text' ).catch( ( ) => null )
		if ( file ) {
			cacheMap.set( '設定.txt', file )
			let settings = $.parseSetting( await new Response( file ).text( ) )
			startScenario = 'シナリオ/' + settings[ '開始シナリオ' ]
		} else {
			$.hint( '設定ファイル省略モードでインストールを続行します' )
		}

		async function getScenario( path ) {
			let file = await getFile( path, 'text' )
			if ( ! file ) return null
			let list = Action.getFileList( await new Response( file ).text( ) )
			$.log( 'list', list )
			return Promise.all( list.map( ( { type, path } ) => {
				return type == 'scenario' ? getScenario( path ) : getFile( path, type )
			} ) )
		}

		await getScenario( startScenario )

		port.close( )

		return [ ...cacheMap ].map( ( [ name, f ] ) => new File( [ f ], title + '/' + name, { type: f.type }  ) )

	}


	async function fileSelect ( { folder = false } = { } ) {
		let input = document.createElement( 'input' )
		input.type = 'file'
		input.webkitdirectory = folder
		input.onchange = ( ) => player.fire( 'file', input.files )
		input.click( )

		let files = await (new Action.Trigger).stepOr(
			player.on( 'file' ), Action.sysChoices( [ ], { backLabel: '戻る' } )
		)
		if ( $.isToken( files ) ) return files
		if ( files ) return Array.from( files )
		else return $.Token.failure
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
	} ) ) title = files[ 0 ].name.match(/([^/.]+)\.?.*$/)[ 1 ] + '/'

	let data = files.map( file => {
		if ( file.name.includes( '設定.' ) ) { settingFile = file }
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

	data.forEach( d => { d[ 1 ] = origin + d[ 1 ] } )

	let setting = settingFile ?  $.parseSetting( await new Response( settingFile ).text( ) ) : { }
	setting.title = title
	setting.origin = origin
	setting.marks = ( await Promise.all(
		data.filter( ( [ file, path ] ) => {
			return /[^/]+\/シナリオ\/.+/.test( path )
		} ).map( async ( [ file, path ] ) => {
			let name = path.match( /[^/]+$/ )[ 0 ]
			return {
				name, marks: Action.getMarkList( await new Response( file ).text( ), name )
			}
		} )
	) )

	$.log( 'marks', setting.marks )

	await DB.saveFiles( data )

	DB.saveTitle( index, setting )

	//let firstScnario = scenarioSetting[ '開始シナリオ' ][ 0 ]

	//$.log( firstScnario )

	return $.Token.success

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
