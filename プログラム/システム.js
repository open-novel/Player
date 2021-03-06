/*
These codes are licensed under CC0.
http://creativecommons.org/publicdomain/zero/1.0
*/

import * as $ from './ヘルパー.js'
import * as Action from './アクション.js'
import * as DB from './データベース.js'

const Archive = $.importWorker( `ZIP` )

const open2chURL = 'http://hayabusa.open2ch.net/test/read.cgi/news4vip/1537182605/l10'

const extensions = {
	text: [ 'txt' ],
	image: [ 'png', 'webp', 'jpg', 'svg', 'gif' ],
	audio: [ 'mp3', 'webm', 'wav', 'ogg', 'm4a', 'flac' ],
	video: [ 'mp4', 'webm', 'wav' ],
}



async function init ( { ctx, mode, installEvent, option } ) {
	await play( { ctx, mode, installEvent, option } )
}

let installEvent = null, option = { }
async function play ( { ctx, mode, installEvent: event, option: opt, params = new URLSearchParams( location.search ) } ) {

	installEvent = event
	option = opt
	option.params = params


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
			( localStorage.TesterMode ? '　★テスターモード★' : '' ) + `\\n \\n` +
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

		if ( res == 'error' ) {
			Action.sysMessage( '問題が発生しました' )
			await Action.sysChoices( [ ], { backLabel: '作品選択へ' } )
		}
	}
}


async function playSystemOpening ( mode ) {

	//await Action.sysBGImage( './画像/背景.png' )
	// インストール済み作品リストをロード
	if ( mode == 'install' )  Action.sysMessage( 'インストール先を選んで下さい' )
	if ( mode == '' ) Action.sysMessage( '開始する作品を選んで下さい' )

	//let titleList = $.parseSetting(
	//	await $.fetchFile( 'text', '../作品/設定.txt' )
	//) [ '作品' ]

	if ( mode == 'direct' ) {

		Action.sysMessage( '作品をダウンロードしています' )
		let success = await installScenario( 0, 'URLから' )
		if ( success != $.Token.success ) {
			Action.sysMessage( 'ダウンロードできませんでした' )
			await $.neverDone
		}
	}


	let titleList = await DB.getTitleList( )

	$.log( titleList )


	let cho
	let altBack = ( localStorage.LocalSync && window.chooseFileSystemEntries ) ? 'ローカル' : undefined
	if ( mode == 'direct' ) {

		cho = { settings: titleList[ 0 ], index: 0 }

	} else {

		let noImage = await $.getImage( await $.fetchFile( './画像/画像なし.svg' ) )
			.catch(
				async ( ) => $.getImage( await $.fetchFile( './画像/画像なし.png' ) )
			)

		cho = await Action.sysPageChoices( async function * ( index ) {
			index += 1

			let settings = titleList[ index ] || { }, { title, origin } = settings
			/*
			yield {
				label: title ? title : '--------',
				value: { settings, index },
				bgimage: false
			}
			*/

			let file = ! title ? null : (
				await $.getFile( `${ origin }${ title }/その他/サムネイル` ).catch( e => null )  ||
				await $.getFile( `${ origin }${ title }/背景/サムネイル` ).catch( e => null )
			)

			let image = file ? await $.getImage( file ) : noImage
			yield {
				label: title ? title : '--------',
				value: { settings, index },
				bgimage: image
			}
		}, { maxPages: 5, rowLen: 2, menuType: 'open', altBack } )


		if ( cho == $.Token.back ) {

			if ( ! altBack ) {
				location.reload( )
				await $.neverDone
			}

			let handle = await window.chooseFileSystemEntries( { type: 'openDirectory' } )
			let status = await handle.requestPermission( { writable: true } )
			$.log( status )
			let folderList = [ ]
			for await ( let h of handle.getEntries( ) ) {
				if ( h.isDirectory ) folderList.push( h )
			}

			cho = await Action.sysPageChoices( async function * ( index ) {


				let folder = folderList[ index ] || { }
				let title = folder.name

				yield {
					label: title ? title : '--------',
					value: folder,
				}
			}, { maxPages: 5, rowLen: 2, menuType: 'open', altBack: 'プレイヤー' } )

			$.log( cho )

			Action.sysMessage( '実装中です\\nまだ機能しません' )
			await Action.sysChoices( [ ], { backLabel: 'トップへ' } )
			return playSystemOpening( mode )

		}

		if ( cho == $.Token.close ) {
			await showSysMenu( )
			return playSystemOpening( mode )
		}

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

	let menuList = [
		'初めから', '続きから', '途中から',
		'削除する', '保存する', '投稿する',
		'更新する', '上書する',
	]
	$.disableChoiceList( [ '上書する', '更新する', ], menuList )
	//if ( settings.origin != 'local/' ) $.disableChoiceList( [ '投稿する', ], menuList )

	console.log( menuList )

	WHILE: while ( true ) {

		let sel = '上書する'
		if ( mode == 'direct' ) sel = '初めから'
		else if ( title ) {
			Action.sysMessage( `作品名：『 ${ title || '------' } 』\\n開始メニュー` )
			//sel = await Action.sysChoices( menuList, { backLabel: '戻る', rowLen: 3 } )
			sel = await Action.sysPageChoices( async function * ( index ) {
				yield ( menuList[ index ] || { disabled: true } )
			}, { maxPages: 2, colLen: 2 } )
		}
		$.log( sel )

		SWITCH: switch ( sel ) {

			case $.Token.back:
			case $.Token.close:
				break WHILE

			case '初めから': {
				return Action.play( settings, null, others )
			} break
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
			case '上書する': {

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
			case '削除する': {

				Action.sysMessage( '本当に削除しますか？' )
				let sel = await Action.sysChoices( [ ], { backLabel: '戻る', nextLabel: '削除' } )
				if ( sel === $.Token.back ) break SWITCH
				if ( sel === $.Token.close ) break WHILE

				Action.sysMessage( '削除しています……' )
				await DB.deleteTitle( index )
				let count = await DB.gcFiles( )
				Action.sysMessage( `${ count }個のファイルを削除しました` )


				await Action.sysChoices( [ ], { backLabel: '作品選択へ' } )
				return playSystemOpening( mode )

			} break
			case '保存する': {

				Action.sysMessage( 'ZIPファイル作成中……' )
				let zip = await makeZIP()

				$.download( zip, zip.name )
				Action.sysMessage( '作品をZIPファイルにしました' )

				let sel = await Action.sysChoices( [ ], { backLabel: '戻る' } )
				if ( sel === $.Token.back ) break SWITCH
				if ( sel === $.Token.close ) break WHILE

			} break
			case '投稿する': {

				let sel
				let ok = await fetch( 'https://open-novel.work' ).then( res => res.ok, ( ) => false  )

				if ( ! ok ) {
					Action.sysMessage( 'サーバーの準備ができていません\\nしばらく経ってからやり直してください' )
					sel = await Action.sysChoices( [ ], { backLabel: '戻る' } )
					if ( sel === $.Token.back ) break SWITCH
					if ( sel === $.Token.close ) break WHILE
				}

				Action.sysMessage(
					`作品データをプレイヤー作者に送信して、\\n` +
					`公開するための審査を受けることができます。\\n` +
					`作品投稿要項に同意して投稿しますか？`
				)

				while ( true ) {
					sel = await Action.sysChoices( [ '作品投稿要項を見る' ], { backLabel: '同意しない', nextLabel: '同意する' } )
					if ( sel == '作品投稿要項を見る' ) window.open( 'https://github.com/open-novel/open-novel.github.io/wiki/作品投稿要綱' )
					if ( sel === $.Token.next ) break
					if ( sel === $.Token.back ) break SWITCH
					if ( sel === $.Token.close ) break WHILE
				}


				Action.sysMessage( 'ZIPファイル作成中……' )
				let zip = await makeZIP( )

				Action.sysMessage( '投稿中……' )
				let res = await ( await fetch(
					'https://scenario.open-novel.work',
					{
						method: 'POST',
						mode: 'cors',
						headers: { 'content-type': 'application/zip' },
						body: zip
					}
				) ).json( )

				if ( res.completed ) {

					if ( navigator.clipboard ) navigator.clipboard.writeText( `(ID: ${ res.data.id } )` )
					Action.sysMessage(
						`作品審査を受け付ました　（ID: ${ res.data.id } ）\\n`
						+ 'open2ch掲示板で上記IDと作品紹介文を投稿してください\\n'
						+ '（IDは対応環境ではクリップボードにコピーされています）'
					)

				} else {
					Action.sysMessage( '投稿が失敗しました\\n理由：' + res.data )
				}

				sel = await Action.sysChoices( [ 'open2chスレを開く' ], { backLabel: '戻る' } )
				if ( sel === $.Token.back ) break SWITCH
				if ( sel === $.Token.close ) break WHILE
				window.open( open2chURL )

			} break
			default: {
				await Action.sysMessage( 'この機能は未実装です' )
			}
		}


		async function makeZIP ( ) {
			let prefix = settings.origin + title + '/'

			let files = await DB.getAllFiles( prefix )
			//let files = [ new File( [ ], 't1', { type: 'text/plain' } ) ]
			let abs = await Promise.all( files.map( file => new Response( file ).arrayBuffer( ) ) )
			let data = abs.map( ( ab, i ) => ( { buf: ab, name: files[ i ].name, type: files[ i ].type } ) )

			let zip = await Archive.packFile( data, abs )
			return new File( [ zip ], title + '.zip', { type: 'application/zip' } )
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
			case '制作スレリンク': window.open( open2chURL )
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
					await Action.sysChoices( [ ], { backLabel: '戻る', color: 'green' } )
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

				let { VR } = $.Settings
				let { TesterMode, LocalSync } = localStorage
				let chooseFile = window.chooseFileSystemEntries

				let sel = await Action.sysChoices( [

					{
						label: `テスターモード　（${ TesterMode ? '現在ON ' : '現在OFF' }）`,
						value: 'テスターモード'
					},

					{
						label: `ローカル同期　　（${ ! chooseFile ? '非対応' : LocalSync ? '現在ON ' : '現在OFF' }）`,
						value: 'ローカル同期', disabled: ! chooseFile
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

						let choiceList = [ 'ONにする', 'OFFにする' ]
						$.disableChoiceList( [ ( TesterMode ? 'ON' : 'OFF' ) + 'にする'  ], choiceList )
						let sel = await Action.sysChoices( choiceList, { backLabel: '戻る', color: 'green' } )
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
					case 'ローカル同期': {

						Action.sysMessage(
							'ローカルファイルに読み書きする権限を与えることで\\n' +
							'自分の端末にある作品を１つ１つ登録しなくても\\n' +
							'指定したフォルダ内の作品を表示・編集することができます'
						)

						let choiceList = [ 'ONにする', 'OFFにする' ]
						$.disableChoiceList( [ ( LocalSync ? 'ON' : 'OFF' ) + 'にする'  ], choiceList )
						let sel = await Action.sysChoices( choiceList, { backLabel: '戻る', color: 'green' } )
						if ( sel == $.Token.back ) continue WHILE2
						if ( sel == $.Token.close ) break WHILE
						LocalSync = ! LocalSync
						localStorage.LocalSync = LocalSync ? 'Yes' : ''
						Action.sysMessage(
							'次回起動時からローカル同期が【' + ( LocalSync ? 'ON' : 'OFF' ) + '】になるよう設定しました\\n' +
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
		Action.sysMessage( '作品のインストール方法を選んで下さい', 100 )

		let menuList = [ '作品リストから', 'フォルダから', 'Zipファイルから', 'GitHubから' ].map( label => ( { label } ) )

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
		case 'URLから':
		case 'GitHubから': {

			files = await installByURL( )
			if ( files == $.Token.back ) return installScenario( index )
			if ( files == $.Token.close ) return $.Token.close
			if ( $.isToken( files ) ) return files

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



	async function installByURL ( { user = '' } = { } ) {

		let _base = option.params.get( 'base' ) || 'https://raw.githubusercontent.com/open-novel/Products/master/サンプル'
		let _title = option.params.get( 'title' )


		if ( ! _title ) {

			let api = 'https://api.github.com'

			let rate = await $.fetchJSON( `${ api }/rate_limit` )
			let { remaining, reset } = rate.resources.core
			let resetmin = Math.ceil( ( reset - Date.now( ) / 1000 ) / 60 )

			if ( remaining == 0 ) {
				await Action.sysMessage(
					'通信回数制限のため現在この機能は利用できません\n' +
					`（リセット：約${ resetmin }分後）`
				)
				return $.Token.failure
			}
			$.log(
				`残り${ remaining }回の通信でこの機能は制限されます　` +
				`（リセット：約${ resetmin }分後）`
			)

			if ( ! user ) {
				await Action.sysMessage( 'ユーザー名を入力してください' )
				user = ( window.prompt( 'ユーザー名を入力してください', '' ) || '' ).trim( )
			}

			if ( ! /^[-\w]+$/.test( user ) ) {
				await Action.sysMessage( 'ユーザー名が不正です' )
				return $.Token.failure
			}
			let repoList = await $.fetchJSON( `${ api }/users/${ user }/repos` )
			if ( ! repoList ) {
				await Action.sysMessage( 'ユーザーが存在しません' )
				return $.Token.failure
			}
			if ( ! repoList.length ) {
				await Action.sysMessage( 'リポジトリが存在しません' )
				return $.Token.failure
			}

			Action.sysMessage( 'リポジトリを選んでください' )
			let repo = await Action.sysPageChoices( async function * ( index ) {
				let repo = repoList[ index ]
				yield repo ? { label: repo.name, value: repo } : { disabled: true }
			}, { maxPages: Math.ceil( repoList.length / 6 ), colLen: 2 } )

			let folderList = await $.fetchJSON( `${ api }/repos/${ user }/${ repo.name }/contents` )

			//TODO: zipに対応
			folderList = (
				await Promise.all( folderList.map( async data => {
					if ( data.type != 'dir' ) return null
					let subs = await $.fetchJSON( `${ data.url }` )
					if ( ! subs.find( data => data.type == 'dir' && data.name == 'シナリオ' ) )
						return null
					return data
				} ) )
			).filter( data => !! data )

			if ( ! folderList.length ) {
				await Action.sysMessage( 'リポジトリ直下に作品フォルダが存在しません' )
				return installByURL( { user } )
			}
			Action.sysMessage( 'インストールする作品を選んでください' )
			let folder = await Action.sysPageChoices( async function * ( index ) {
				let folder = folderList[ index ]
				yield folder ? { label: folder.name, value: folder } : { disabled: true }
			}, { maxPages: Math.ceil( folderList.length / 9 ) } )

			$.log( folder )




			_base = `https://raw.githubusercontent.com/${ user }/${ repo.name }/master`
			_title = folder.name

		}

		let channel = new MessageChannel

		channel.port1.addEventListener( 'message', async ( { data } ) => {
			if ( data.type != 'getFile' ) return
			let obj = await getFile( data, `${ _base }/${ _title }/` )
			channel.port1.postMessage( { type: 'install-file', version: Infinity, ...obj } )
		})
		channel.port1.start( )

		async function getFile ( data, url ) {

			let path = data.path.trim( )
			let exts = data.extensions

			if( path.match( /(^\/)|(\.\/)|(\/$)|[:]/ ) ) return

			let file = null
			async function fetchFile( ext ) {
				let file = null
				try {
					let res = await fetch( new URL( path, url ).href + '.' + ext )
					if ( res.ok ) file = await res.blob( )
				} catch ( e ) { }
				return file
			}

			for ( let ext of exts ) {
				file = await fetchFile( ext )
				if ( file ) break
			}

			return { path, file }
		}


		return collectScenarioFiles ( { port: channel.port2, title: _title } ).catch( e => {
				$.hint( '取得できないファイルがありました' )
				return $.Token.failure
			} )


	}



	async function installByScenarioList ( ) {

		let iframe, p

		Action.sysMessage( '提供サイトリストを取得中……' )

		/*
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
		*/

		let api = 'https://raw.githubusercontent.com/wiki/open-novel/open-novel.github.io/作品リンク集.md'
		let text = await $.fetchFile( api, 'text' )
		let linkList = text.match(/^\*\s*\[.+?\]\(.+?\)/mg)
			.map( t => t.match( /\[(.+?)\]\((.+?)\)/ ) )
			.map( a => ( { label: a[ 1 ], value: a[ 2 ] } ) )


		WHILE: while ( true ) {

			Action.sysMessage( '作品集を選んでください' )
			let siteURL = await Action.sysPageChoices( async function * ( index ) {
				yield linkList[ index ] || { label: '------', disabled: true }
			}, { maxPages: Math.ceil( linkList.length / 6 ) } )
			if ( $.isToken( siteURL ) ) return siteURL
			$.log( linkList )

			Action.sysMessage( '作品リストを取得中……' )

			//iframe.remove( )
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
				let sel = await Action.sysChoices( [ 'Webサイトを開く' ], { backLabel: '戻る' } )
				if ( sel == $.Token.close ) return sel
				if ( sel == 'Webサイトを開く' ) window.open( siteURL )
				continue WHILE
			}

			Action.sysMessage( 'インストールする作品を選んでください' )

			let titleList = data.list.filter( o => !! o.title )
			let noImage = await $.getImage( await $.fetchFile( './画像/画像なし.svg' ) )

			let cacheMap = new Map


			let sel = await Action.sysPageChoices( async function * ( index ) {

				let title = ( titleList[ index ] || { } ).title

				yield {
					label: title ? title : '------',
					value: index,
					bgimage: true,
					disabled: ! title
				}

				if ( ! title ) return
				;[ '背景/サムネイル', 'その他/サムネイル' ].forEach( path =>
					data.port.postMessage( { type: 'getFile', index, path, extensions: extensions[ 'image' ]  } )
				)

				let image
				if ( cacheMap.has( index ) ) image = cacheMap.get( index )
				else {
					let file = await new Promise ( ok => {
						data.port.addEventListener( 'message', evt => {
							if ( evt.data.index != index ) return
							cacheMap.set( index, image )
							ok( evt.data.file )
						} )
						data.port.start( )
					} )
					image = file ? await $.getImage( file ) : noImage

				}

				yield {
					label: title,
					value: index,
					bgimage: image
				}
			},  { maxPages: Math.ceil( titleList.length / 6 ), rowLen: 2 } )

			//sel = await Action.sysChoices( titleList, { backLabel: '戻る' } )
			if ( sel == $.Token.back ) continue WHILE
			if ( $.isToken( sel ) ) return sel
			data.port.postMessage( { type: 'select', index: sel } )
			break


		}

		if ( $.isToken( sel ) ) return sel

		return installScenario( index, 'リンクから' )

	}


	async function unpackFile ( zip ) {
		if ( ! zip ) return $.Token.failure
		let data = ( await Archive.unpackFile( zip, [ zip ] ) )
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

			let exts = extensions[ type ]//.concat( extensions[ type ].map( e => e.toUpperCase( ) ) )

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
				$.timeout( 30000 ).then(  ( ) => {
					if ( done ) return
					$.hint(`【 ${ path } 】のダウンロードがタイムアウトしました\n制限時間：30秒`)
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

		await Promise.all( [ '背景/サムネイル', 'その他/サムネイル', 'その他/投げ銭' ].map( path =>
			getFile( path, 'image' ).catch( ( ) => null )
		) )

		doneCount = fetchCount
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
