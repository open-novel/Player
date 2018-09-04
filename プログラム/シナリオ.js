/*
These codes are licensed under CC0.
http://creativecommons.org/publicdomain/zero/1.0
*/

import * as $ from './ヘルパー.js'
import * as Action from './アクション.js'
import * as DB from './データベース.js'


let stateMap = new WeakMap

export function getState ( layer ) {
	return stateMap.get( layer )
}


export async function play ( layer, state, others ) {

	stateMap.set( layer, state )

	let { scenario, act = scenario[ 0 ], scenarioStack = [ ], title: basePath, varMap = new Map } = state
	let { saveGlobalVarMap, globalVarMap = new Map, jump = null } = others
	Object.assign( state, { act, scenarioStack, varMap } )

	for ( let [ url, pos ] of state.portraits || [ ] ) Action.showPortrait( layer, url, pos )
	for ( let [ url, pos ] of state.BGImages  || [ ] ) Action.showBGImage( layer, url, pos )
	if ( state.BGM ) Action.playBGM( state.BGM )

	let nowAct
	while ( act || scenarioStack.length ) {
		if ( act ) await playAct( act, scenario, jump ).catch( e => {
			let { type, meta } = nowAct
			$.hint( `エラーが発生しました\n${
				meta.fileName }　　行${
					meta.lineNo ? meta.lineNo : '不明' }　　【${
						type }】` )
			throw e
		} )
		jump = null
		;( { act, scenario } = scenarioStack.pop( ) || { } )
	}




	async function playAct( act, scenario, jump ) {

		$.log( 'ACT', scenario )
		state.scenario = scenario

		if ( jump ) {
			let [ title, mark ] = jump
			let scenarioOrTitle = title || scenario
			$.log( 'JMP', title, mark, scenario )
			return playScnario( scenarioOrTitle, mark || undefined )
		}

		function textEval ( text ) {

			if ( typeof text != 'string' ) return text
			// $.log( 'E', text )
			function $Get( key ) {
				let map = varMap
				if ( key[ 0 ] == '$' ) {
					key = key.slice( 1 )
					map = globalVarMap
				}
				if ( ! map.has( key ) ) {
					$.log( `変数名【${ key }】が見つかりません` )
					map.set( key, 0 )
					return 0
				} else return map.get( key )
			}
			return eval( text )
		}

		async function $Set( key, value ) {
			if ( key[ 0 ] == '$' ) {
				key = key.slice( 1 )
				globalVarMap.set( key, value )
				await saveGlobalVarMap( globalVarMap )
			} else varMap.set( key, value )
		}


		async function playScnario( scenario_act_title, jumpMark = '$root' ) {

			$.log( scenarioStack )

			let act, newScenario = scenario

			if ( typeof scenario_act_title != 'object' ) {
				let title = scenario_act_title
				let text = await DB.getFile( [ basePath, 'シナリオ', title ].join( '/' ) )
				newScenario = await parse( text, title )
			} else if( Array.isArray( scenario_act_title ) ) newScenario = scenario_act_title
			else act = scenario_act_title

			if ( ! act ) act = newScenario.find( act => act.type == 'マーク' && textEval( act.prop ) == jumpMark )
			if ( ! act ) { $.log( 'mark not found', jumpMark, newScenario ); return; }



			await playAct( act, newScenario )

		}


		function pushScenarioStack ( returnAct ) {
			if ( returnAct ) scenarioStack.push( { act: returnAct, scenario } )
		}


		do {

			if ( Action.isOldLayer( layer ) ) return

			nowAct = act

			let { type, prop } = act

			switch ( type ) {

				case '会話': {

					state.act = act
					//stateMap.set( layer, state )

					let [ name, text ] = prop.map( textEval )

					await Action.showMessage( layer, name, text, 20 )

					//await $.timeout( 500 )

				} break
				case '立絵': {

					Action.removePortraits( layer )
					state.portraits = [ ]

					await Promise.all( prop.map( p => {

						let [ pos, name ] = p.map( textEval )

						if ( ! name ) return
						pos = pos.normalize('NFKC')


						if ( pos == '左' ) pos = [ 0, 0, 1 ]
						else if ( pos == '右' ) pos = [ -0, 0, 1 ]
						else if ( pos ) {
							pos = pos.match( /-?\d+(?=%|％)/g )
							if ( pos.length == 1 ) pos[ 1 ] = 0
							if ( pos.length == 2 ) pos[ 2 ] = 1
							pos = pos.map( d => d / 100 )
						} else throw `立ち絵『${ name }』の位置指定が不正です。`

						//$.log(pos)

						let path = [ basePath, '立ち絵', name ].join( '/' )

						state.portraits.push( [ path, pos ] )
						return Action.showPortrait( layer, path, pos )

					} ) )

					/*Promise.race( [
						$.timeout( 3000 ).then( ()=>'timeover!' ),
						Promise.all(p).then( ()=>'resolved!' )
					] ).then(s=>{$.log(s);$.log(prop)})*/


				} break
				case '背景': {

					Action.removeBGImages( layer )
					state.BGImages = [ ]

					await Promise.all( prop.map( p => {

						let [ pos, name ] = p.map( textEval )

						if ( ! name ) [ name, pos ] = [ pos, name ]
						if ( ! name ) return
						pos = pos.normalize('NFKC')

						if ( pos ) {
							pos = pos.match( /-?\d+(?=%|％)/g )
							if ( pos.length == 1 ) pos[ 1 ] = 0
							if ( pos.length == 2 ) pos[ 2 ] = 1
							pos = pos.map( d => d / 100 )
						} else pos = [ 0, 0, 1 ]

						let path = [ basePath, '背景', name ].join( '/' )

						state.BGImages.push( [ path, pos ] )
						return Action.showBGImage( layer, path, pos )

					} ) )

				} break
				case '選択': {

					let newAct = await Action.scenarioChoices( layer, prop.map(
						c => ( { label: textEval( c[ 0 ] ), value: textEval( c[ 1 ] ) } )
					) )
					$.log( type, newAct )
					pushScenarioStack( act.next )
					return playScnario( newAct )

				} break
				case '分岐': {

					for ( let p of prop ) {
						let [ con, newAct ] = p.map( textEval )
						$.log( type, con, newAct )
						if ( ! con && con !== '' ) continue
						pushScenarioStack( act.next )
						return playScnario( newAct )
					}

				} break
				case '繰返': {

					$.log( type, prop )

					for ( let p of prop ) {
						let [ con, newAct ] = p.map( textEval )
						$.log( type, con, newAct )
						if ( ! con && con !== '' ) continue
						pushScenarioStack( act )
						return playScnario( newAct )
					}

				} break
				case 'ジャンプ': {

					let [ title, mark　] = prop.map( textEval )

					let scenarioOrTitle = title || scenario
					$.log( 'JMP', title, mark, scenario )
					pushScenarioStack( act.next )
					return playScnario( scenarioOrTitle, mark || undefined )

				} break
				case '変数': {

					await Promise.all( prop.map( async p => {
						let [ key, value ] = p.map( textEval )
						await $Set( key, value )
					} ) )


				} break
				case '入力': {

					await Promise.all( prop.map( async p => {
						let [ key, value ] = p.map( textEval )
						value = prompt( '', value ) || value
						await $Set( key, value )
					} ) )


				} break
				case 'BGM': {

					let name = textEval( prop )

					if ( ! name ) Action.stopBGM( )
					else {
						let path = [ basePath, 'BGM', name ].join( '/' )

						state.BGM = path
						await Action.playBGM( path )
					}

				} break
				case '効果': {

					let [ type, value ] = prop[ 0 ].map( textEval )

					value = value.normalize( 'NFKC' )
					value = + ( value.match( /[\d.]+/ ) || [ 0 ] ) [ 0 ]

					await Action.runEffect( layer, type, value )

				} break
				case 'スクリプト': {

					switch ( textEval( prop ) ) {

						case '終わる': case　'おわる': {

							layer = null

						} break
						default : {

							$.warn( `"${ type }" この「スクリプト」アクションのタイプは未実装です` )

						}

					}


				} break
				case 'マーク': {

					let mark = textEval( prop )
					$.log( 'マーク', mark )
					state.mark = mark

					DB.saveState( state.title, 1001, getState( layer ) )

				} break
				default : {
					$.warn( `"${ type }" このアクションの「実行」は未実装です` )
				}

			}

		} while ( act = act.next )

	}

}



export function parse ( text, fileName ) {


	return thirdParse( secondParse( firstParse( text, 1 ) ) )



	// 文の取り出しと、第一級アクションとその配下のグルーピング
	function firstParse ( text, baseNo ) {

		let stateList = text.replace( /\r/g, '' ).split( '\n' )
		let actList = [ ], propTarget = null

		function addAct ( type, lineNo ) {
			let act = { type: type.replace( '・', '' ).trim( ), children: [ ],
			meta: { fileName, lineNo: lineNo + baseNo } }
			propTarget = act.children
			actList.push( act )
		}

		for ( let i = 0; i < stateList.length; i ++ ) {
			let sta = stateList[ i ]
			if ( sta.trim( ).length == 0 ) continue
			if ( sta[ 0 ] == '・' ) {
				addAct( sta, i )
			} else {
				if ( sta.slice( 0, 2 ) == '//' ) continue
				else if ( sta[ 0 ].match( /#|＃/ ) ) {
					addAct( 'マーク', i )
					sta = sta.slice( 1 )
				} else if ( sta[ 0 ] != '\t' ) {
					addAct( '会話', i )
				}
				propTarget.push( sta )
			}

		}

		//$.log( actList )
		return actList
	}



	// アクション種に応じた配下の処理と、一次元配列への展開
	function secondParse ( actList ) {

		let actRoot = { type: 'マーク', prop: '$root', meta: { fileName, lineNo: 0 } }
		let progList = [ actRoot ]
		let prev = actRoot


		function addAct ( type, prop, { meta, separate = false, subjump = false } = { } ) {

			let act = { type, prop, meta }
			//if ( type == '分岐' ) debugger
			if ( subjump ) {

				// [k,v]を[[k,v],[k,v],...]パターンと同様に扱えるように加工
				if ( separate ) prop = [ prop ]

				for ( let p of prop ) {
					let subList = secondParse( firstParse( p[ 1 ], meta.lineNo ) )
					// もし要素がコマンド郡でなく、リンクなら飛ばす
					if ( subList.length == 2 && subList[ 1 ].type == '会話' &&
						subList[ 1 ].prop[ 1 ] == '' ) continue
					progList = progList.concat( subList.slice( 1 ) )
					p[ 1 ] = subList[ 0 ].next
				}

			}

			let index = progList.push( act )
			prev.next = act
			prev = act
		}


		function subParse ( { type, children, meta, separate = false, subjump = false } = { } ) {

			let tabs = '\t'.repeat( ( children[ 0 ].match( /^\t+/ ) || [ '' ] ) [ 0 ].length )
			children = children.map( child => child.replace( tabs, '' ) )

			let key = '', value = '', prop = [ ]
			children.push( '' )
			while ( children.length ) {
				let child = children.shift( )
				if ( child[ 0 ] != '\t' ) {
					if ( key ) {
						// \t以外から始まったときで初回以外（バッファを見て判断）
						if ( separate ) addAct( type, [ key, value ], { meta, separate, subjump } )
						// 細かく分離する
						else prop.push( [ key, value ] )
						// 配列に貯める
					}
					value = ''
					key = child.replace( '・', '' ).replace( /\s+$/, '' )
				} else {
					if ( value ) {
						if ( subjump ) value += '\n'
						else value += '\\w\\n'  // 『会話』用
					}
					value += child.replace( '\t', '' ).replace( /\s+$/, '' )
				}
			}
			if ( ! separate ) addAct( type, prop, { meta, separate, subjump } )


		}


		for ( let act of actList ) {
			let { type, children, meta } = act

			if ( children.length == 0 ) {
				$.warn( `"${ type }" 子要素が空なので無視されました` )
				continue
			}

			switch ( type ) {
						case 'パラメータ': type = '変数'
				break; case '立ち絵': type = '立絵'
				break; case 'ＢＧＭ': type = 'BGM'
				break; case '選択肢': type = '選択'
				break; case '繰り返し': case '繰返し': type = '繰返'
				break; case 'エフェクト': type = '効果'
			}

			switch ( type ) {

				case 'コメント': /* 何もしない */
				break
				case '立絵': case '背景': case '変数': case '入力': case '効果':
					subParse( { type, children, meta } )
				break
				case '会話':
					subParse( { type, children, meta, separate: true } )
				break
				case '選択': case '分岐': case '繰返':
					//if ( type == '分岐' ) debugger
					subParse( { type, children, meta, subjump: true } )
				break
				default :
					addAct( type, children[ 0 ].trim( ), { meta } )

			}

		}

		return progList
	}



	//実行時に最小限の処理で済むよう式などをできるだけパースする
	function thirdParse ( progList ) {
		//$.log( 'PL', Object.assign( { }, progList ) )


		function parseText ( text ) {

			if ( typeof text != 'string' ) return text

			text = text.trim( )

			if ( ! text || text == '無し' || text == 'なし' ) text = ''

			text = text.replace( /\\{(.*?)}/g, ( _, t ) => `'+(${ subParseText( t, true ) })+'` )

			// $.log( `'${ text }'` )

			return `'${ text.replace( /\\/g, '\\\\' ) }'`
		}


		function subParseText ( str, subuse = false ) {

			//console.log( '式→', str )

			if ( ! subuse ) if ( ! str || str == '無し' || str == 'なし' ) return `''`

			let res = '', prev = '', mode = 'any'

			for ( let c of str ) {

				if ( /\s/.test( c ) ) continue

				let now = ''

				if ( mode == 'str' ) switch ( c ) {

					        case '”': case '’': case '"': case'\'':
						if ( prev == '\\' ) now = c
						else mode = 'any'; now = '"'
					break; case '\\':
						if ( prev == '\\' ) now = '\\'
					break; default:
						now = c

				} else switch ( c ) {

					       case '＋': case '+':							now = '+'
					break; case '－':　case '―': case '-':				now = '-'
					break; case '×': case '✕': case '＊': case '*':		now = '*'
					break; case '÷': case '／': case '/':				now = '/'
					break; case '％': case '%':							now = '%'
					break; case '＝': case '=':
						if ( prev != '==' )
							if ( /[=!><]/.test( prev ) )				now = '='
							else										now = '=='
					break; case '≠':									now = '!='
					break; case '≧':									now = '>='
					break; case '≦':									now = '<='
					break; case '＞':									now = '>'
					break; case '＜':									now = '<'
					break; case '＆': case '&':
						if ( prev != '&&' )								now = '&&'
					break; case '｜': case '|':
						if ( prev != '||' )								now = '||'
					break; case '？': case '?':							now = '?'
					break; case '：': case ':':							now = ':'
					break; case '（': case '(':
						if ( !prev || /[+\-*/%=><&|?:(]/.test( prev ) )	now = '('
						else throw `"${ str }" 式が正しくありません（括弧の開始位置）`
					break; case '）': case ')':							now = ')'
					break; case '”': case '’': case '"': case'\'':
						mode = 'str'; now = '"'
					break; case '`':
						throw `"${ c }" この文字は式中で記号として使うことはできません`
					break; default:
						if ( mode == 'any' ) {
							let n = c.normalize('NFKC') // 数値の判定
							if ( n.match( /\d/ ) ) { now = n }
							else if ( c == 'ー' ) { now = '-' } // 変数名中以外の「ー」はマイナス
							else { mode = 'var'; now = '$Get(`' + ( c == '＄' ? '$' : c ) }
						}
						else {
							if ( c == 'ー' && ! /[ァ-ヴ]/.test( prev ) ) { now = '-' } // カタカナに続かない「ー」はマイナス
							else { mode = 'var'; now = c }
						}

				}

				prev = now

				if ( mode == 'var_op' ) { mode = 'any'; now = '`)' + now }
				if ( mode == 'var' ) mode = 'var_op'


				res += now

			}


			if ( mode == 'var_op' ) res += '`)'


			//console.log( '→式', res )


			return res
		}


		for ( let act of progList ) {
			let { type, prop } = act

			switch ( type ) {

				case '会話': {

					prop = prop.map( parseText )

				} break
				case '立絵': case '背景': case '選択': case '効果': {

					prop = prop.map( p => p.map( parseText ) )

				} break
				case '分岐': case '繰返': {

					prop = prop.map( p => [ subParseText( p[ 0 ] ), parseText( p[ 1 ] ) ] )

				} break
				case '変数': case '入力': {

					prop = prop.map( p => {
						p = p[ 0 ].split(/[:：]/)
						return [ parseText( p[ 0 ].replace(/^＄/, '$' ) ), subParseText( p[ 1 ] ) ]
					} )

				} break
				case 'ジャンプ': {

					prop = prop.split( /[#＃]/ ).map( parseText )


				} break
				case 'マーク': case 'BGM': case 'スクリプト': {

					prop = parseText( prop )

				} break
				default : {

					$.warn( `"${ type }" このアクションの「パース」は未実装です` )

				}

			}

			act.prop = prop

		}


		$.log( 'PL', progList )

		return progList
	}

}


export function getFileList ( text ) {

	let fileList = [ ]
	let progList = parse( text, '???' )

	function textEval ( text ) {
		return eval( text )
	}

	for ( let act of progList ) {
		let { type, prop } = act

		switch ( type ) {

			case '立絵': {

				prop.forEach( p => {
					let name = textEval( p[ 1 ] )
					if ( ! name ) debugger
					fileList.push( { type: 'image', path: '立ち絵/' + name } )
				} )

			} break
			case '背景': {

				prop.forEach( p => {
					let name = textEval( p[ 1 ] ) || textEval( p[ 0 ] )
					fileList.push( { type: 'image', path: '背景/' + name } )
				} )

			} break
			case 'BGM': {

				let name = textEval( prop )
				fileList.push( { type: 'audio', path: 'BGM/' + name } )

			} break
			case 'ジャンプ': {

				let title = textEval( prop[ 0 ] )
				if ( title ) fileList.push( { type: 'scenario', path: 'シナリオ/' + title } )

			} break

		}
	}

	return fileList
}
