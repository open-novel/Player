/*
These codes are licensed under CC0.
http://creativecommons.org/publicdomain/zero/1.0
*/

import * as $ from './ヘルパー.js'
import * as Scenario from './シナリオ.js'
import * as Renderer from './レンダラー.js'
import * as Sound from './サウンド.js'
import * as DB from './データベース.js'



let nowLayer, settings, trigger, others, stateList = [ ]


export async function init ( _settings = settings ) {

	settings = _settings
	Object.values( cache ).forEach( map => { if ( map.clear ) map.clear( ) } )
	let oldLayer = nowLayer
	let layer = nowLayer = await Renderer.initRanderer( settings )
	if ( oldLayer ) oldLayer.fire( 'dispose' )
	trigger = new Trigger
	layer.on( 'menu' ).then( ( ) => showMenu( layer ) )
	setMenuVisible( false, layer )
	await Sound.initSound( settings )

}


export async function play ( settings, state, _others = others ) {

	others = _others
	let { title } = settings
	others.title = title

	let text = await DB.getFile( [ title, 'シナリオ', settings[ '開始シナリオ' ] || title ].join( '/' ) )

	let scenario = await Scenario.parse( text )

	await init( settings )

	if ( ! state ) state = { scenario, title }

	do {
		await Promise.race( [ Scenario.play( nowLayer, state, others ), nowLayer.on( 'dispose' ) ] )
	} while ( state = stateList.shift( ) )

}




export let { target: initAction, register: nextInit } = new $.AwaitRegister( init )




const frame = new $.Awaiter
;( ( ) => {
	loop( )
	function loop ( ) {
		Renderer.drawCanvas( )
		requestAnimationFrame( loop )
		frame.fire( 'update' )
	}
} ) ( )


const action = new $.Awaiter
export function onAction ( type ) {

	$.log( type )
	action.fire( type, true )
}


export async function onPoint ( { type, button, x, y } ) {

	if ( button == 'middle' ) return
	if ( button == 'right' ) {
		if ( type == 'up' ) nowLayer.fire( 'menu' )
		return
	}
	Renderer.onPoint( { type, x, y } )
}


class Trigger {

	constructor ( ) { this.layer = nowLayer }
	step ( ) { return this.stepOr( ) }
	stepOr ( ...awaiters ) {
		if ( isOldLayer( this.layer ) ) return $.neverRun( )
		return Promise.race(
			[ this.layer.on( 'click' ), action.on( 'next' ), ...awaiters ] )
	}
	stepOrFrameupdate ( ) { return this.stepOr( frame.on( 'update' ) ) }
	stepOrTimeout ( ms ) { return this.stepOr( $.timeout( ms ) ) }

}


export function setMenuVisible ( flag, layer = nowLayer ) {

	layer.menuSubBox.removeChildren( )
	if ( flag ) layer.menuBox.show( )
	else layer.menuBox.hide( )

}

export async function showSaveLoad ( { layer, title, isLoad = false, settings, others } ) {
	let page = 1
	let visibleTileNo = 12, getTileNo = 24, totalPageNo = ( ( getTileNo / visibleTileNo ) | 0 ) + ( isLoad ? 1 : 0 )
	while ( page > 0 ) {

		let start = ( page - 1 ) * visibleTileNo
		let choices = await $.getSaveChoices ( { title, start: ( isLoad && page == totalPageNo ) ? 1000 : start, num: visibleTileNo, isLoad } )

		let backLabel = page > 1 ? `ページ ${ page - 1 }` : '戻る'
		let currentLabel = `ページ ${ page }`
		let nextLabel = page < totalPageNo ? `ページ ${ page + 1 }` : ''

		if ( isLoad && page == totalPageNo ) currentLabel = 'オート'
		if ( isLoad && page == totalPageNo - 1 ) nextLabel = 'オート'

		let index = await sysChoices( choices, { backLabel, currentLabel, nextLabel } )
		if ( index === null ) page --
		else if ( index == $.Token.next ) page ++
		else {
			if ( isLoad ) {
				let state = await DB.loadState( title, index )
				return play( settings, state, others )

			}
			else {
				return DB.saveState( title, index, Scenario.getState( layer )  )

			}
		}
	}
	return false
}


async function showMenu ( layer ) {

	let title = settings.title
	if ( ! title ) return //closeMenu( )

	setMenuVisible( true, layer )

	layer.on( 'menu' ).then( ( ) => closeMenu( layer ) )

	let choices = [ 'セーブ', 'ロード', '終了する' ].map( label => ( { label } ) )

	let type = await sysChoices( choices, { rowLen: 4, backLabel: '戻る' } )

	let page = 1

	let visibleTileNo = 12, getTileNo = 24


	switch ( type ) {

		case null:
		break;
		case 'セーブ': {

			await showSaveLoad( { title, layer } )

		} break
		case 'ロード': {

			let loaded = await showSaveLoad( { title, settings, isLoad: true } )
			if ( loaded === false ) return

		} break
		case '終了する': {

			stateList.length = 0
			return init( )

		} break
		default: $.error( 'UnEx' )
	}

	layer.fire( 'menu' )

}



async function closeMenu ( layer ) {

	setMenuVisible( false, layer )

	layer.on( 'menu' ).then( ( ) => showMenu( layer ) )
}



export function isOldLayer ( layer ) {
	return layer != nowLayer
}


export function sysMessage ( text, speed = 1000000 ) {
	return showMessage ( nowLayer, '', text, speed )
}


export async function showMessage ( layer, name, text, speed ) {

	layer.nameArea.clear( ), layer.messageArea.clear( )

	if ( name.length == 0 && text.length == 0 ) {
		layer.conversationBox.hide( )
		return
	}
	layer.conversationBox.show( )



	for ( let deco of decoText( name ) ) layer.nameArea.add( deco )

	let decoList = decoText( text )

	//$.log( decoList )

	let len = decoList.length
	let index = 0



	let time = new $.Time

	loop: while ( true ) {

		let interrupt = await trigger.stepOrFrameupdate( )

		let to = interrupt ? len : speed * time.get( ) / 1000 | 0

		for ( ; index < to && index < len; index ++ ) {
			let deco = decoList[ index ], wait = deco.wait || 0
			if ( wait ) {
				index ++
				time.pause( )
				await trigger.stepOrTimeout( wait / speed * 1000 )
				time.resume( )
				continue loop
			}
			layer.messageArea.add( deco )
		}

		if ( to >= len ) break
	}

	await trigger.step( )

}


function decoText ( text ) {

	let decoList = [ ]

	let mag = 1, bold = false, color = undefined, row = 0

	for ( let unit of ( text.match( /\\\w(\[[\w.]+\])?|./g ) || [ ] ) ) {
		let magic = unit.match( /\\(\w)\[?([\w.]+)?\]?/ )
		if ( magic ) {
			let [ , type, val ] = magic
			switch ( type ) {
						case 'w': decoList.push( { wait: val || Infinity } )
				break;	case 'n': row ++
				break;	case 'b': bold = true
				break;	case 'B': bold = false
				break;	case 'c': color = val
				break;	case 's': mag = val
				break;	default : $.warn( `"${ type }" このメタ文字は未実装です`　)
			}
		} else {
			decoList.push( { text: unit, mag, bold, color, row } )
		}

	}

	return decoList

}


const cache = {
	file: new Map,
	blob: new WeakMap,
}

async function getFile ( path ) {
	let blob = cache.file.get( path )
	if ( ! blob ) {
		blob = await DB.getFile( path )
		cache.file.set( path, blob )
	}
	return blob
}

async function getImage ( blob ) {
	let img = new Image
	let url = cache.blob.get( blob )
	if ( ! url ) {
		url = URL.createObjectURL( blob )
		cache.blob.set( blob, url )
	}
	img.src = url
	await img.decode( )
	return img
}



class ProgressTimer extends $.Awaiter {

	constructor ( ms = 0 ) {
		super( )
		this.enabled = !! ( ms >= 0 )
		this.started = false
		if ( ms > 0 ) this.start( ms )
	}

	async start ( ms ) {
		this.started = true
		if ( ! this.enabled ) return $.error( '完了したタイマーの再利用がありました' )
		let time = new $.Time
		while ( true ) {
			let interrupt = await trigger.stepOrFrameupdate( )
			let prog = interrupt ? 1 : time.get( ) / ms
			if ( prog > 1 ) prog = 1
			this.fire( 'step', prog )
			if ( prog == 1 ) break
		}
		this.started = false
		this.enabled = false
	}
}


let effects = {
	portraits: new ProgressTimer( -1 ),
	background: new ProgressTimer( -1 ),
}

export async function runEffect ( layer, type, sec ) {

	$.log( 'EF', type, sec )
	let ms = sec * 1000

	if ( type == 'フラッシュ' ) return

	if ( type == '準備' ) {
		for ( let [ key, eff ] of Object.entries( effects ) ) {
			$.log( eff )
			effects[ key ] = new ProgressTimer
		}
		return
	} else {
		await Promise.all( Object.values( effects ).map( eff => {
			eff.fire( 'type', type )
			return eff.start( ms )
		} ) )
	}

}


export function sysBGImage ( path ) {
	return showBGImage ( nowLayer, path, [ 0, 0, 1 ] )
}


export function showBGImage ( layer, path, [ x, y, h ] ) {
	let kind = 'background'
	let p = showImage( layer.backgroundGroup, path, { x, y, w: 1, h }, kind )
	if ( effects[ kind ].started ) return p
}


export function removeBGImages ( layer ) {
	let kind = 'background'
	let p = removeImages( layer.backgroundGroup, kind )
	if ( effects[ kind ].started ) return p
}


export function showPortrait ( layer, path, [ x, y, h ] ) {
	let kind = 'portraits'
	let p = showImage( layer.portraitGroup, path, { x, y, h }, kind )
	if ( effects[ kind ].started ) return p
}


export function removePortraits ( layer ) {
	let kind = 'portraits'
	let p = removeImages( layer.portraitGroup, kind )
	if ( effects[ kind ].started ) return p
}



async function showImage ( targetGroup, path, pos, kind ) {

	let eff = effects[ kind ]
	if ( ! eff.enabled ) {
		eff = new ProgressTimer( 150 )
		effects[ kind ] = eff
		eff.fire( 'type', 'フェード' )
	}

	$.log( 'show???', eff.enabled )
	let type = await eff.on( 'type', true )

	let blob = await getFile( path )
	let img = await getImage( blob )

	$.log( 'show', type, eff, targetGroup.name )

	let { x, y, h, w = 9 / 16 * h * img.naturalWidth / img.naturalHeight } = pos
	pos.w = w

	let image, oldPos

	switch ( type ) {
		case 'フェード': {
			image = new Renderer.ImageNode( { name: 'image', x, y, w, h, o: 0, img } )
			targetGroup.append( image )
		} break
		case 'トランス': {
			image = targetGroup.searchImg( img.src )
			oldPos = Object.assign( { }, image )
		} break
	}

	$.log( { x, y, w, h, pos, oldPos, image } )

	let before = -1
	while ( true ) {

		let prog = eff.started ? await eff.on( 'step', true ) : 1
		$.log( 'show', 'step', prog )
		if ( prog == before ) {
			$.error( 'stepの変化が停止' )
			prog = 1
		}
		before = prog

		switch ( type ) {

			case 'フェード': {
				image.prop( 'o', 1 - ( 1 - prog ) ** 2 )
			} break
			case 'トランス': {
				[ 'x', 'y', 'w', 'h' ].forEach( p => {
					let val = oldPos[ p ] * prog + pos[ p ] * ( 1- prog )
					//$.log( p, val )
					image.prop( p, val )
				} )

			} break

		}
		if ( prog == 1 ) break
	}


}


async function removeImages ( targetGroup, kind ) {

	let children = [ ... targetGroup.children ]

	let eff = effects[ kind ]
	if ( ! eff.enabled ) {
		eff = new ProgressTimer( 150 )
		effects[ kind ] = eff
		eff.fire( 'type', 'フェード' )
	}

	$.log( 'remv???', eff.enabled )
	let type = await eff.on( 'type', true )


	$.log( 'remv', type, eff, targetGroup.name )

	switch ( type ) {
		case 'フェード': {

			//for ( let image of children ) {
			//	image.fadeout = ! image.hasOtherChildren( )
			//}
			let before = -1
			while ( true ) {
				let prog = eff.started ? await eff.on( 'step', true ) : 1
				if ( prog == before ) {
					$.error( 'stepの変化が停止' )
					prog = 1
				}
				before = prog
				for ( let image of children ) { image.prop( 'o', 1 - prog ** 2 ) }
				if ( prog == 1 ) break
			}
			for ( let image of children ) { image.remove( ) }
		} break
	}

}


export async function sysChoices ( choices, opt ) {
	return showChoices(  Object.assign( { layer: nowLayer, choices }, opt ) )
}

export async function scenarioChoices ( layer, choices ) {
	return showChoices( { layer, choices, inputBox: layer.inputSubBox } )
}

export async function showChoices ( { layer, choices, inputBox = layer.menuSubBox, rowLen = 4,
	backLabel = '', currentLabel = '', nextLabel = '' } ) {

	let m = .05

	let nextClicks = [ ]

	let len = choices.length
	let colLen = 1 + ( ( len - 1 ) / rowLen | 0 )
	let w = ( ( 1 - m / 2 ) - m / 2 * colLen ) / colLen
	let h = ( ( 1 - m ) - m * rowLen ) / rowLen

	for ( let i = 0; i < len; i++ ) {
		let cho = choices[ i ]
		let { label, value = label, disabled = false } =
			( typeof cho == 'object' ) ? cho : { label: cho }
		let row = i % rowLen, col = i / rowLen | 0
		let [ x, y ] = [ m / 2 + ( w + m / 2 ) * col, m + ( h + m ) * row ]

		let choiceBox = new Renderer.RectangleNode( {
			name: 'choiceBox',
			x, y, w, h, listenerMode: 'opaque', fill: 'rgba( 100, 100, 255, .8 )',
			sound: ! disabled
		} )
		inputBox.append( choiceBox )
		if ( disabled ) choiceBox.fill = 'rgba( 200, 200, 255, .5 )'

		let textArea = new Renderer.TextNode( {
			name: 'choiceText',
			size: .7, y: .05, pos: 'center', fill: 'rgba( 255, 255, 255, .9 )'
		} )
		choiceBox.append( textArea )
		if ( disabled ) textArea.fill = 'rgba( 255, 255, 255, .5 )'

		if ( ! disabled ) nextClicks.push( choiceBox.on( 'click' ).then( ( ) => value ) )
		textArea.set( label )
	}

	let { backBotton, nextBotton } = layer

	layer.backLabel.clear( )
	layer.currentLabel.clear( )
	layer.nextLabel.clear( )

	if ( backLabel ) {
		layer.backLabel.set( backLabel )
		backBotton.show( )
		nextClicks.push( backBotton.on( 'click' ).then( ( ) => null ) )
	}

	if ( currentLabel ) {
		layer.currentLabel.set( currentLabel )
	}

	if ( nextLabel ) {
		layer.nextLabel.set( nextLabel )
		nextBotton.show( )
		nextClicks.push( nextBotton.on( 'click' ).then( ( ) => $.Token.next ) )
	}

	inputBox.show( )
	let val = await Promise.race( nextClicks )
	inputBox.removeChildren( )
	inputBox.hide( )
	backBotton.hide( )
	nextBotton.hide( )
	return val

}



export { playBGM, stopBGM, setMainVolume } from './サウンド.js'
