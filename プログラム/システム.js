/*
These codes are licensed under CC0.
http://creativecommons.org/publicdomain/zero/1.0
*/

import * as $ from './ヘルパー.js'
import * as Action from './アクション.js'
import * as DB from './データベース.js'


const Archive = $.importWorker( `アーカイブ` )

const extensions = {
	text: [ 'txt' ],
	image: [ 'webp', 'png', 'jpg', 'svg', 'gif' ],
	audio: [ 'webm', 'mp3', 'wav', 'ogg', 'flac' ],
}

async function init ( { ctx, mode, installEvent, option } ) {
	await play( { ctx, mode, installEvent, option } )
}

let installEvent = null, option = { }
async function play ( { ctx, mode, installEvent: event, option: opt } ) {

	installEvent = event
	option = opt


	//let settings = await $.fetchFile( 'json', './プログラム/設定.json' )
	let settings = $.parseSetting( await $.fetchFile( './プログラム/設定.txt', 'text' ) )
	settings.ctx = ctx
	//Object.assign( setting, systemSetting )
	$.log( settings )

	await DB.init( )
	await Action.initAction( settings )

	let sound = 'off'
	if ( mode != 'install' ) {

		let text =
			`openノベルプレイヤー` +
			( $.Settings.TesterMode ? '　★テスターモード★' : '' ) + `\\n \\n` +
			`${ settings[ 'バージョン' ][ 0 ] }${ $.channel.includes( 'Dev' ) ? '(開発版)' : '' }  ${ settings[ '更新年月日' ][ 0 ] } \\n`


		WHILE: while ( true ) {

			Action.sysMessage( text, Infinity )

			let list = [
				{ label: '🔊 音声ありで始める 🔊', value: 'on' },
				{ label: '🔇 ミュートで始める 🔇', value: 'off' },
				{ label: '🔰　チュートリアル　🔰', value: 'tutorial', disabled: true }
			]

			let promise = Action.sysChoices( list, { rowLen: 3, menuEnebled: false } )
			Action.hideIcons( )
			let select = await promise
			sound = select
			break WHILE
		}



		if ( sound == 'on' ) Action.setMainVolume( 1 )
		else Action.setMainVolume( 0 )

	}

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

	let noImage = await $.getImage( await $.fetchFile( './画像/画像なし.svg' ) )
		.catch(
			async ( ) => $.getImage( await $.fetchFile( './画像/画像なし.png' ) )
		)

	let cho = await Action.sysPageChoices( async function * ( index ) {
		index += 1

		let settings = titleList[ index ] || { }, { title, origin } = settings
		yield {
			label: title ? title : '--------',
			value: { settings, index },
			bgimage: false
		}

		let file = title ? await $.getFile( `${ origin }${ title }/背景/サムネイル` ).catch( e => null ) : null
		let image = file ? await $.getImage( file ) : noImage
		yield {
			label: title ? title : '--------',
			value: { settings, index },
			bgimage: image
		}
	}, { maxPages: 5, rowLen: 2, menuType: 'open' } )


	if ( cho == $.Token.back ) {
		location.reload( )
		await $.neverDone
	}

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
		await Action.sysChoices( [ ], { backLabel: 'トップへ' } )
		location.hash = ''
		location.reload( )
		await $.neverDone

	}
	// シナリオ開始メニュー表示

	let menuList = [ '初めから', '続きから', '途中から', 'インストール' ].map( label => ( { label } ) )

	WHILE: while ( true ) {

		let sel = 'インストール'
		if ( title ) {
			Action.sysMessage( `作品名：『 ${ title || '------' } 』\\n開始メニュー` )
			sel = await Action.sysChoices( menuList, { backLabel: '戻る' } )
		}
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
				if ( success == $.Token.back ) if ( title ) { break SWITCH } else { break WHILE }
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

		Action.sysMessage( '各種設定を行ったり関連Webサイトに跳ぶことができます' )


		let sel = await Action.sysChoices(
			[

				'受信チャンネル設定',
				'プレイヤーを登録する',
				'データ保存状況確認',
				{
					label: '🔧　実験機能　🔨',
					value: '実験機能'
				},

				{ label: '🔗ホームページ', value: '公式サイトリンク' },
				{ label: '🔗作品一覧　　', value: '作品一覧リンク' },
				{ label: '🔗操作方法Wiki', value: '操作方法リンク' },
				{ label: '🔗open2chスレ', value: '制作スレリンク' },

			], { backLabel: '戻る', color: 'green', rowLen: 4 }
		)

		$.log( sel )

		SWITCH: switch ( sel ) {

			case $.Token.back:
			case $.Token.close:
				break WHILE

			case '公式サイトリンク': window.open( 'https://open-novel.github.io/source/' )
			break
			case '作品一覧リンク': window.open( 'https://github.com/open-novel/open-novel.github.io/wiki/作品リンク集/' )
			break
			case '操作方法リンク': window.open( 'https://github.com/open-novel/open-novel.github.io/wiki/' )
			break
			case '制作スレリンク': window.open( 'http://hayabusa.open2ch.net/test/read.cgi/news4vip/1537182605/l50' )
			break

			case '受信チャンネル設定': {
				Action.sysMessage(
					'プレイヤーの受信チャンネルを選択してください\\n' +
					'安定版：　通常はこちらを選択してください\\n' +
					'開発版：　安定版より数週間早く新機能を試せますが不安定です\\n'
				)
				let isStable = ! $.channel
				let sel = await Action.sysChoices(
					[
						{ label: '安定版' + ( isStable ? '（📡受信中）' : '　　　　　　' ), value: '安定版', disabled: isStable },
						{ label: '開発版' + ( isStable ? '　　　　　　' : '（📡受信中）' ), value: '開発版', disabled: !isStable }
					], { backLabel: '戻る', color: 'green' }
				)

				if ( sel == $.Token.back ) break SWITCH
				if ( sel == $.Token.close ) break WHILE
				localStorage.playerChannel = ( sel == '安定版' ) ? '' : 'Dev'

				Action.sysMessage(
					'次回起動時から【' + sel + '】を受信するよう設定しました\\n' +
					'変更を反映させるためにプレイヤーをリセットしてください'
				)
				await Action.sysChoices( [ ], { backLabel: 'リセットする', color: 'green' } )
				location.reload( )
				await $.neverDone

			} break
			case 'プレイヤーを登録する': {
				let result = await Promise.race( [ installEvent.promise, $.timeout( 1 ) ] )
				installEvent = null
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
			} break
			case 'データ保存状況確認': WHILE2: while ( true ) {

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
					'クリックで各機能を設定できます'
				)

				let { VR, TesterMode } = $.Settings

				let sel = await Action.sysChoices( [

					{
						label: `テスターモード　（現在${ TesterMode ? 'ON ' : 'OFF' }）`,
						value: 'テスターモード'
					},

					async function * ( ) {
						if ( ! navigator.getVRDisplays ) return yield { label: `VR　(非対応環境です)`, disabled: true }
						yield { label: `VR　(デバイスの状態を確認中……)`, disabled: true }
						let disp = ( await navigator.getVRDisplays( ) )[ 0 ]
						VR.display = disp
						$.log( disp )
						if ( ! disp ) return yield { label: `VR　(デバイスが見つかりません)`, disabled: true }
						//if ( ! disp.isConnected ) return yield { label: `VR　(「${disp.displayName}」を接続してください)`, disabled: true }
						//if ( ! disp.isPresenting ) return yield { label: `VR　(現在ON：表示中)`, value: 'VR' }
						if ( VR.failureNum ) return yield { label: `VR　(現在OFF:失敗${ VR.failureNum }回)`, value: 'VR' }
						return yield { label: `VR　(現在OFF)`, value: 'VR' }
					},
					// {
					// 	label: self.PaymentRequest ? '投げ銭（寄付金）イメージテスト' : '投げ銭テスト　（非対応環境です）',
					// 	value: '投げ銭',
					// 	disabled: ! self.PaymentRequest
					// }

				], { backLabel: '戻る', color: 'green' } )

				if ( sel == $.Token.back ) break WHILE2
				if ( sel == $.Token.close ) break WHILE

				switch ( sel ) {
					case 'テスターモード': {
						Action.sysMessage(
							'テスターモードが有効だと以下の効果があります\\n' +
							'・詳細なログをコンソールに表示\\n' +
							'・アクセス解析を無効'
						)
						let choiceList = [ { label: 'ONにする' }, { label: 'OFFにする' } ]
						$.disableChoiceList( [ ( TesterMode ? 'ON' : 'OFF' ) + 'にする'  ], choiceList )
						let sel = await Action.sysChoices( choiceList, { backLabel: '戻る' } )
						if ( sel == $.Token.back ) continue WHILE2
						if ( sel == $.Token.close ) break WHILE
						TesterMode = ! TesterMode
						localStorage.TesterMode = TesterMode ? 'Yes' : ''
						Action.sysMessage(
							'次回起動時からテスターモードが【' + ( TesterMode ? 'ON' : 'OFF' ) + '】になるよう設定しました\\n' +
							'変更を反映させるためにプレイヤーをリセットしてください'
						)
						await Action.sysChoices( [ ], { backLabel: 'リセットする', color: 'green' } )
						location.reload( )
						await $.neverDone
					} break
					case 'VR': {
						let res = await $.trying( Action.presentVR( VR.enabled = ! VR.enabled ) )
						if ( res == $.Token.failure ) {
							VR.failureNum = ( VR.failureNum || 0 ) + 1
							VR.enabled = false
						} else {
							VR.failure = false
						}
					} break
					case '投げ銭': {
						let methods = [{
							supportedMethods: [ 'basic-card' ],
							data: {
								supportedNetworks: [ 'visa', 'mastercard', 'jcb' ],
								supportedTypes: ['credit', 'debit']
							}
						}]

						let details = {
							displayItems: [{
								label: 'クリエイターに寄付する',
								amount: { currency: 'JPN', value: '100' }
							}],
							total: {
								label: 'Total',
								amount: { currency: 'JPN', value: '100' }
							}
						}

						Action.sysMessage(
							'テストのため実際に課金されることはありません\\n' +
							'支払い情報・その他個人情報などがこのツールを通して\\n' +
							'保存・送信されることはありません\\n'
						)


						let req = new PaymentRequest( methods, details )
						let res = await req.show( ).catch( ( ) => null )

						if ( ! res ) Action.sysMessage( '支払いがキャンセルされました' )
						else {

							for ( let i = 0; i <= 15; i ++ ) {
								Action.sysMessage(
									'支払い処理中' + '.'.repeat( i ) + '\\n' +
									' \\n' +
									'（テストのため実際には課金処理は行われていません）'
									, Infinity
								)
								await $.timeout( 200 )
							}
							await res.complete( )
							Action.sysMessage(
								'支払いが完了しました\\n' +
								' \\n' +
								'（テストのため実際には課金処理は行われていません）'
							)

						}

						console.log( res )

						let sel = await Action.sysChoices( [ ], { backLabel: '戻る' } )
						if ( sel == $.Token.back ) continue WHILE2
						if ( sel == $.Token.close ) break WHILE


					} break

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

		let menuList = [ '作品リストから', 'フォルダから', 'Zipファイルから' ].map( label => ( { label } ) )

		sel = await Action.sysChoices( menuList, { backLabel: '戻る' } )
	}
	$.log( sel )



	let files, origin = 'unknown/'

	switch ( sel ) {

		case $.Token.back:
		case $.Token.close:
			return sel

		case '作品リストから': {

			//Action.sysMessage( '作品を公開しているWebサイトで'
			//+'\\n作品リンクをクリックするとインストールできます' )
			//window.open( 'https://github.com/open-novel/open-novel.github.io/wiki/作品リンク集' )

			let res = await installByScenarioList( )
			if ( res == $.Token.back ) return installScenario( index )
			if ( res == $.Token.close ) return $.Token.close
			if ( $.isToken( res ) ) return res
			return $.Token.success

		} break
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
		case 'リンクから': {

			Action.sysMessage( 'ダウンロード中……' )
			let data = await Promise.race( [
				player.on( 'install', true ), player.on( 'install-folder', true ), player.on( 'install-packed', true )
			] )
			if ( ! data ) return $.Token.failure
			if ( data.url ) origin = new URL( data.url ).origin + '/'
			switch ( data.type ) {
				case 'install-folder': {
					if ( ! data.title ) return $.Token.failure
					files = await collectScenarioFiles( data ).catch( e => {
						$.hint( '取得できないファイルがありました' )
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

	$.log( files )
	if ( ! files ) return $.Token.failure
	if ( $.isToken( files ) ) return files

	async function installByScenarioList ( ) {

		let iframe, p

		Action.sysMessage( '提供サイトリストを取得中……' )

		p = player.on( 'install-sites' )
		iframe = document.createElement( 'iframe' )
		iframe.src = 'https://open-novel.github.io/list.html'
		iframe.style.opacity = '0'
		document.body.append( iframe )

		let data = await Promise.race( [ $.timeout( 10000 ), p ] )
		if ( ! data || ! data.sites || ! data.sites.length  ) {
			Action.sysMessage( 'リストを取得できませんでした' )
			return await Action.sysChoices( [ ], { backLabel: '戻る' } )
		}

		let linkList = data.sites.map( a => ( { label: a[ 0 ], value: a[ 1 ] } ) )

		// let linkList = [ { label: '旧作品集', value: 'https://open-novel.github.io/Products/' } ]
		let port
		WHILE: while ( true ) {

			Action.sysMessage( '作品集を選んでください' )
			let siteURL = await Action.sysPageChoices( async function * ( index ) {
				yield linkList[ index ] || { label: '------', disabled: true }
			}, { maxPages: Math.ceil( linkList.length / 6 ) } )
			if ( $.isToken( siteURL ) ) return siteURL
			$.log( linkList )

			Action.sysMessage( '作品リストを取得中……' )

			iframe.remove( )
			p = player.on( 'install-list' )
			iframe = document.createElement( 'iframe' )
			iframe.src = siteURL
			iframe.style.opacity = '0'
			document.body.append( iframe )

			let data = await Promise.race( [ $.timeout( 10000 ), p ] )
			if ( ! data || ! data.list || ! data.list.length ) {
				Action.sysMessage(
					'サイトから正常な応答がありませんでした\\n'+
					' \\n'+
					'（サイト上の連携スクリプトが古い可能性があります）'
				)
				let sel = await Action.sysChoices( [ 'webサイトを開く' ], { backLabel: '戻る' } )
				if ( sel == $.Token.close ) return sel
				if ( sel == 'Webサイトを開く' ) window.open( siteURL )
				continue WHILE
			}

			Action.sysMessage( 'インストールする作品を選んでください' )

			let titleList = data.list.filter( o => !! o.title )
			let noImage = await $.getImage( await $.fetchFile( './画像/画像なし.svg' ) )

			let cacheMap = new Map

			port = data.port

			let sel = await Action.sysPageChoices( async function * ( index ) {

				let title = ( titleList[ index ] || { } ).title

				yield {
					label: title ? title : '------',
					value: index,
					bgimage: true,
					disabled: ! title
				}

				if ( ! title ) return
				data.port.postMessage( { type: 'getFile', index, path: '背景/サムネイル', extensions: extensions[ 'image' ]  } )

				let image
				if ( cacheMap.has( index ) ) image = cacheMap.get( index )
				else {
					let file = await new Promise ( ok => {
						data.port.addEventListener( 'message', evt => {
							if ( evt.data.index != index ) return
							ok( evt.data.file )
						} )
						data.port.start( )
					} )
					image = file ? await $.getImage( file ) : noImage
					cacheMap.set( index, image )
				}

				yield {
					label: title,
					value: index,
					bgimage: image
				}
			},  { maxPages: Math.ceil( titleList.length / 6 ), rowLen: 2 } )

			//sel = await Action.sysChoices( titleList, { backLabel: '戻る' } )
			if ( sel == $.Token.back ) continue WHILE
			data.port.postMessage( { type: 'select', index: sel } )
			break


		}

		if ( $.isToken( sel ) ) return sel

		return installScenario( index, 'リンクから' )

	}


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

		let doneCount = 0, fetchCount = 0, failure = false

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
				port.postMessage( { type: 'getFile', path, extensions: exts } )
				$.timeout( 10000 ).then(  ( ) => {
					if ( done ) return
					$.hint(`【 ${ path } 】のダウンロードがタイムアウトしました\n制限時間：10秒`)
					ng( )
				} )

			} ).then( f => { ++doneCount; showCount( ); return f }, ( ) => { failure = true } ).finally( ( ) => { done = true } )

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

		await getFile( '背景/サムネイル', 'image' ).catch( ( ) => null )

		doneCount = fetchCount = 2
		failure = false

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

		return failure ? $.Token.failure :
			[ ...cacheMap ].map( ( [ name, f ] ) => new File( [ f ], title + '/' + name, { type: f.type }  ) )

	}


	async function fileSelect ( { folder = false } = { } ) {
		let input = document.createElement( 'input' )
		input.type = 'file'
		input.webkitdirectory = folder
		let { promise, resolve } = new $.Deferred
		input.onchange = ( ) => resolve( input.files )
		input.click( )

		let files = await Promise.race( [
			promise, Action.sysChoices( [ ], { backLabel: '戻る' } )
		] )
		if ( $.isToken( files ) ) return files
		if ( files ) return Array.from( files )
		else return $.Token.failure
	}



	//////

	if ( ! files.every ) return $.Token.failure

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

	//$.log( type, button, x, y )
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

	if ( ! data.type ) $.warn( 'postMessageされたデータのtypeがありません' )
	player.fire( data.type, data )

}
