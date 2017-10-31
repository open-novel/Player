/*
These codes are licensed under CC0.
http://creativecommons.org/publicdomain/zero/1.0
*/

import * as $ from './ヘルパー.js'
import * as Action from './アクション.js'


let stateMap = new WeakMap

export function getState ( layer ) {
	return stateMap.get( layer )
}


export async function play ( layer, state ) {

	let { scenario, act = scenario[ 0 ], actStack = [ ], baseURL, varMap = new Map } = state
	Object.assign( state, { act, actStack, varMap } )


	for ( let [ url, pos ] of state.portraits || [ ] ) Action.showPortrait( layer, url, pos )
	for ( let [ url, pos ] of state.BGImages  || [ ] ) Action.showBGImage( layer, url, pos )
	if ( state.BGM ) Action.playBGM( state.BGM )

	do {
		if ( act ) await playAct( act, scenario )
		act = actStack.pop( )
	} while ( act || actStack.length )




	async function playAct( act, scenario ) {


		function textEval ( text ) {

			if ( typeof text != 'string' ) return text
			// $.log( 'E', text )
			function $Get( key ) {
				if ( ! varMap.has( key ) ) {
					varMap.set( key, 0 ) 
					return 0
				} else return varMap.get( key )
			}
			return eval( text )
		}


		async function playScnario( scenario_act_title, jumpMark = '$root' ) {

			$.log( actStack )

			let act, newScenario = scenario

			if ( typeof scenario_act_title != 'object' ) {
				let title = scenario_act_title
				let text = await $.fetchFile( 'text', `${ baseURL }/シナリオ/${ title }.txt` )
				newScenario = await parse( text )
			} else if( Array.isArray( scenario_act_title ) ) newScenario = scenario_act_title
			else act = scenario_act_title

			if ( ! act ) act = newScenario.find( act => act.type == 'マーク' && textEval( act.prop ) == jumpMark )
			if ( ! act ) { $.log( newScenario ) ;throw `"${ jumpMark }" 指定されたマークが見つかりません` }



			await playAct( act, newScenario )

		}

		do {

			if ( Action.isOldLayer( layer ) ) return 

			let { type, prop } = act

			switch ( type ) {

				case '会話': {

					state.act = act
					stateMap.set( layer, state )

					let [ name, text ] = prop.map( textEval )

					await Action.showMessage( layer, name, text, 20 )

					//await $.timeout( 500 )

				} break
				case '立絵': {

					Action.removePortraits( layer )
					state.portraits = [ ] 

					/*await*/ Promise.all( prop.map( p => {

						let [ pos, name ] = p.map( textEval )

						if ( ! name ) return
						pos = pos.normalize('NFKC')


						if ( pos == '左' ) pos = [ 0, 0, 1 ]
						else if ( pos == '右' ) pos = [ -0, 0, 1 ]
						else if ( pos ) { 
							pos = pos.match( /-?\d+(?=%|％)/g )
							if ( pos.length == 1 ) pos[ 1 ] = 0
							if ( pos.length == 2 ) pos[ 2 ] = 100
							pos = pos.map( d => d / 100 )
						} else throw `立ち絵『${ name }』の位置指定が不正です。`

						let url = `${ baseURL }/立ち絵/${ name }.png`

						state.portraits.push( [ url, pos ] ) 
						return Action.showPortrait( layer, url, pos )

					} ) )


				} break
				case '背景': {

					Action.removeBGImages( layer )
					state.BGImages = [ ] 

					/*await*/ Promise.all( prop.map( p => {

						let [ pos, name ] = p.map( textEval )

						if ( ! name ) [ name, pos ] = [ pos, name ]
						if ( ! name ) return
						pos = pos.normalize('NFKC')

						if ( pos ) { 
							pos = pos.match( /-?\d+(?=%|％)/g )
							if ( pos.length == 1 ) pos[ 1 ] = 0
							if ( pos.length == 2 ) pos[ 2 ] = 100
							pos = pos.map( d => d / 100 )
						} else pos = [ 0, 0, 100 ]

						let url = `${ baseURL }/背景/${ name }.jpg`

						state.BGImages.push( [ url, pos ] ) 
						return Action.showBGImage( layer, url, pos )

					} ) )

				} break
				case '選択': {

					let newAct = await Action.showChoices( layer, prop.map( c => c.map( textEval ) ) )
					$.log( type, newAct )
					actStack.push( act.next )
					return playScnario( newAct )

				} break
				case '分岐': {

					for ( let p of prop ) {
						let [ con, newAct ] = p.map( textEval )
						$.log( type, con, newAct )
						if ( ! con && con !== '' ) continue 
						actStack.push( act.next )
						return playScnario( newAct )
					}

				} break
				case '繰返': {

					$.log( type, prop )

					for ( let p of prop ) {
						let [ con, newAct ] = p.map( textEval )
						$.log( type, con, newAct )
						if ( ! con && con !== '' ) continue 
						actStack.push( act )
						return playScnario( newAct )
					}

				} break
				case 'ジャンプ': {

					let [ title, mark　] = prop.map( textEval )

					let scenarioOrTitle = title || scenario
					$.log( 'JMP', title, mark, scenario )
					actStack.push( act.next )
					return　playScnario( scenarioOrTitle, mark || undefined )

				} break
				case '変数': {

					prop = prop.forEach( p => {
						let [ key, value ] = p.map( textEval )
						varMap.set( key, value )
					} )


				} break
				case '入力': {

					prop = prop.forEach( p => {
						let [ key, value ] = p.map( textEval )
						value = prompt( '', value ) || value
						varMap.set( key, value )
					} )


				} break
				case 'BGM': {

					let name = textEval( prop )

					if ( ! name ) Action.stopBGM( )
					else {
						let url = `${ baseURL }/BGM/${ name }.ogg`

						state.BGM = url
						await Action.playBGM( url )
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

				} break
				default : {
					$.warn( `"${ type }" このアクションの「実行」は未実装です` )
				}

			}

		} while ( act = act.next )

	}

}



export function parse ( text ) {


	return thirdParse( secondParse( firstParse( text ) ) )



	// 文の取り出しと、第一級アクションとその配下のグルーピング
	function firstParse ( text ) {

		let stateList = text.replace( /\r/g, '' ).split( '\n' )
		let actList = [ ], propTarget = null

		function addAct ( type ) {
			let act = { type: type.replace( '・', '' ).trim( ), children: [ ] }
			propTarget = act.children
			actList.push( act )
		}

		for ( let sta of stateList ) {
			if ( sta.trim( ).length == 0 ) continue
			if ( sta[ 0 ] == '・' ) {
				addAct( sta )
			} else {
				if ( sta.slice( 0, 2 ) == '//' ) continue
				else if ( sta[ 0 ].match( /#|＃/ ) ) {
					addAct( 'マーク' )			
					sta = sta.slice( 1 )
				} else if ( sta[ 0 ] != '\t' ) {
					addAct( '会話' )
				}
				propTarget.push( sta )
			}

		}

		//$.log( actList )
		return actList
	}



	// アクション種に応じた配下の処理と、一次元配列への展開
	function secondParse ( actList ) { 

		let actRoot = { type: 'マーク', prop: '$root' }
		let progList = [ actRoot ]
		let prev = actRoot


		function addAct ( type, prop, { separate = false, subjump = false } = { } ) {

			let act = { type, prop } 

			if ( subjump ) {

				// [k,v]を[[k,v],[k,v],...]パターンと同様に扱えるように加工
				if ( separate ) prop = [ prop ]

				for ( let p of prop ) {
					let subList = secondParse( firstParse( p[ 1 ] ) )
					// もし要素がコマンド郡でなく、リンクなら飛ばす
					if ( subList.length == 2 && subList[ 1 ].type == '会話' &&
						subList[ 1 ].prop[ 1 ] == '' ) continue
					progList = progList.concat( subList.slice( 1 ) )
					p[ 1 ] = subList[ 1 ] 
				}

			} 

			let index = progList.push( act )
			prev.next = act
			prev = act
		}


		function subParse ( type, children, { separate = false, subjump = false } = { } ) {

			let tabs = '\t'.repeat( ( children[ 0 ].match( /^\t+/ ) || [ '' ] ) [ 0 ].length )
			children = children.map( child => child.replace( tabs, '' ) )

			let key = '', value = '', prop = [ ]
			children.push( '' )
			while ( children.length ) {
				let child = children.shift( )
				if ( child[ 0 ] != '\t' ) {
					if ( key ) {
						// \t以外から始まったときで初回以外（バッファを見て判断）
						if ( separate ) addAct( type, [ key, value ], { separate, subjump } )
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
			if ( ! separate ) addAct( type, prop, { separate, subjump } )


		}


		for ( let act of actList ) {
			let { type, children } = act

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
					subParse( type, children )
				break
				case '会話':
					subParse( type, children, { separate: true } )
				break
				case '選択':　case '分岐': case '繰返':
					subParse( type, children, { subjump: true } )
				break
				default :
					addAct( type, children[ 0 ].trim( ) )

			}

		}

		return progList 
	}



	//実行時に最小限の処理で済むよう式などをできるだけパースする
	function thirdParse ( progList ) {
		//$.log( 'PL', progList )


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



