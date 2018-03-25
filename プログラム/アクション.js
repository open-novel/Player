/*
These codes are licensed under CC0.
http://creativecommons.org/publicdomain/zero/1.0
*/

import * as $ from './ヘルパー.js'
import * as Scenario from './シナリオ.js'
import * as Renderer from './レンダラー.js'
import * as Sound from './サウンド.js'
import * as DB from './データベース.js'



let nowLayer, settings, trigger, stateList = [ ]


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


export async function play ( settings, state, others ) {

	let { title } = settings

	let text = await DB.getFile( [ title, 'シナリオ', settings[ '開始シナリオ' ] ].join( '/' ) )

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


async function showMenu ( layer ) {

	let title = settings.title
	if ( ! title ) return //closeMenu( )

	setMenuVisible( true, layer )

	layer.on( 'menu' ).then( ( ) => closeMenu( layer ) )

	let choices = [ 'セーブ', 'ロード', '終了する' ].map( label => ( { label } ) )

	SWITCH: switch ( await sysChoices( choices, { rowLen: 4, cancelable: true } ) ) {

		case null: {

			break SWITCH

		} break
		case 'セーブ': {

			let choices = await $.getSaveChoices( title, 20 )
			let index = await sysChoices( choices, { cancelable: true } )
			if ( index === null ) break SWITCH
			await DB.saveState( title, index, Scenario.getState( layer )  )

		} break
		case 'ロード': {

			let choices = await $.getSaveChoices( title, 20, { isLoad: true } )
			let index = await sysChoices( choices, { cancelable: true } )
			if ( index === null ) break SWITCH
			let state = await DB.loadState( title, index )
			stateList.push( state )
			return init( )

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
		if ( ms > 0 ) this.start( ms )
	}

	async start ( ms ) {
		if ( ! this.enabled ) return $.error( '完了したタイマーの再利用がありました' )
		let time = new $.Time
		while ( true ) {
			let interrupt = await trigger.stepOrFrameupdate( )
			let prog = interrupt ? 1 : time.get( ) / ms
			if ( prog > 1 ) prog = 1
			this.fire( 'step', prog )
			if ( prog == 1 ) break
		}
		this.enabled = false
	}
}


let effect = new ProgressTimer( -1 )

export async function runEffect ( layer, type, sec ) {

	$.log( 'EF', type, sec )
	let ms = sec * 1000

	if ( type == 'フラッシュ' ) return

	if ( type == '準備' ) {
		effect = new ProgressTimer
		return
	} else {
		effect.fire( 'type', type )
		await effect.start( ms )
	}

}


export function sysBGImage ( path ) {
	return showBGImage ( nowLayer, path, [ 0, 0, 1 ] )
}


export function showBGImage ( layer, path, [ x, y, h ] ) {
	return showImage( layer.backgroundGroup, path, { x, y, w: 1, h } )
}


export function removeBGImages ( layer ) {
	return removeImages( layer.backgroundGroup )
}


export function showPortrait ( layer, path, [ x, y, h ] ) {
	return showImage( layer.portraitGroup, path, { x, y, h } )
}


export function removePortraits ( layer ) {
	return removeImages( layer.portraitGroup )
}



async function showImage ( targetGroup, path, pos ) {

	let blob = await getFile( path )
	let img = await getImage( blob )

	let eff = effect.enabled ? effect : new ProgressTimer( 150 )
	$.log( 'show???', effect.enabled )
	let type = effect.enabled ? await eff.on( 'type', true ) : 'フェード'

	$.log( 'show', type, effect, targetGroup.name )

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

	while ( true ) {
		let prog = await eff.on( 'step' )
		$.log( 'step', prog )
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


async function removeImages ( targetGroup ) {

	let children = [ ... targetGroup.children ]

	let eff = effect.enabled ? effect : new ProgressTimer( 150 )
	let type = effect.enabled ? await eff.on( 'type', true ) : 'フェード'

	$.log( 'remv', type, effect, targetGroup.name )

	switch ( type ) {
		case 'フェード': {

			//for ( let image of children ) {
			//	image.fadeout = ! image.hasOtherChildren( )
			//}
			while ( true ) {
				let prog = await eff.on( 'step' )
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

export async function showChoices ( { layer, choices, inputBox = layer.menuSubBox, rowLen = 4, cancelable = false } ) {

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
			x, y, w, h, listenerMode: 'opaque', fill: 'rgba( 100, 100, 255, .8 )'
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

	let backBotton = layer.backBotton
	if ( cancelable ) {

		backBotton.show( )
		nextClicks.push( backBotton.on( 'click' ).then( ( ) => null ) )

	}

	inputBox.show( )
	let val = await Promise.race( nextClicks )
	inputBox.removeChildren( )
	inputBox.hide( )
	backBotton.hide( )
	return val

}



export { playBGM, stopBGM } from './サウンド.js'
