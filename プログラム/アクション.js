/*
These codes are licensed under CC0.
http://creativecommons.org/publicdomain/zero/1.0
*/

import * as $ from './ヘルパー.js'
import * as Scenario from './シナリオ.js'
import * as Renderer from './レンダラー.js'
import * as Sound from './サウンド.js'
import * as DB from './データベース.js'



let layer, settings


export async function init ( _settings ) {

	settings = _settings
	layer = await Renderer.initRanderer( settings )
	layer.on( 'menu' ).then( showMenu )
	await Sound.initSound( settings )

}


export async function play ( settings ) {

	let { title } = settings

	let scenarioSetting =  $.parseSetting(
		await $.fetchFile( 'text', `../作品/${ title }/設定.txt` )
	)
	
	let text = await $.fetchFile( 'text', `../作品/${ title }/シナリオ/${ scenarioSetting[ '開始シナリオ' ] }.txt` )

	let scenario = await Scenario.parse( text, `../作品/${ title }` )

	await init( settings )
	let state = { scenario, baseURL: `../作品/${ title }` } 
	await Scenario.play( state )

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
		if ( type == 'up' ) layer.fire( 'menu' )
		return
	}
	Renderer.onPoint( { type, x, y } )
}


const trigger =　new class Trigger {
	
	step ( ) { return this.stepOr( ) }
	stepOr ( ...awaiters ) {
		return Promise.race( 
			[ layer.on( 'click' ), action.on( 'next' ), ...awaiters ] )
	}
	stepOrFrameupdate ( ) { return this.stepOr( frame.on( 'update' ) ) }
	stepOrTimeout ( ms ) { return this.stepOr( $.timeout( ms ) ) }
}



async function showMenu ( ) {
	
	let { menuBox, menuSubBox: subBox } = layer
	menuBox.show( )

	layer.on( 'menu' ).then( closeMenu )

	let choices = [ 'セーブ', 'ロード', 'ダミー' ]
	switch ( await showChoices( choices, subBox ) ) {

		case 'セーブ': {
			let index = await showSaveData( )
			await DB.saveState( settings.title, index, Scenario.getState( ) )

		} break
		case 'ロード': {
			let index = await showSaveData( )
			Scenario.setState( await DB.loadState( settings.title, index ) )
		} break
		default: $.error( 'UnEx' )
	}

	async function showSaveData ( ) {

		let choices = [ ...Array( 12 ).keys( ) ].map( i => {
			return [ 'No.' + i, i ]
		} )
		return await showChoices( choices, subBox )

	}



}


async function closeMenu ( ) {
	
	layer.menuBox.hide( )

	layer.on( 'menu' ).then( showMenu )
}


export async function showMessage ( name, text, speed ) {
		

	layer.nameArea.clear( ), layer.messageArea.clear( )


	for ( let deco of decoText( name ) ) { layer.nameArea.add( deco ) }

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

	for ( let unit of ( text.match( /\\\w(\[\w+\])?|./g ) || [ ] ) ) {
		let magic = unit.match( /\\(\w)\[?(\w+)?\]?/ )
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


const　cacheMap = new WeakMap

async function getImage ( blob ) {
	let img = new Image
	let { promise, resolve } = new $.Deferred
	img.onload = resolve
	let url = cacheMap.get( blob )
	if ( ! url ) {
		url = URL.createObjectURL( blob )
		cacheMap.set( blob, url )
	}
	img.src = url
	await promise
	return img
}



class ProgressTimer　extends $.Awaiter {

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

export async function runEffect ( type, sec ) {

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



export async function showBGImage ( url ) {

	let blob = await $.fetchFile( 'blob', url )
	let img = await getImage( blob )
	layer.backgroundImage.img = img

}


export async function removeBGImage ( ) {
	layer.backgroundImage.img = null
}


export async function showPortraits ( url, [ x, y, h ] ) {
	
	let eff = effect.enabled ? effect : new ProgressTimer( 150 )
	let type = effect.enabled ? await eff.on( 'type' ) : 'フェード'

	
	let blob = await $.fetchFile( 'blob', url )
	let img = await getImage( blob )
	let w = 9 / 16 * h * img.naturalWidth / img.naturalHeight
	//$.log( { x, y, w, h, img } )
	let portrait = new Renderer.ImageNode( { name: 'portrait', x, y, w, h, o: 0, img } )

	let old = { }

	switch ( type ) {
		case 'フェード': {
			layer.portraitGroup.append( portrait )
		} break
		case 'トランス': {
			old.port = layer.portraitGroup.searchImg( portrait )
			old.data = Object.assign( { }, old.port )
				//$.log( 'show', type, old )
		} break
	}

	while ( true ) {
		let prog = await eff.on( 'step' )
		switch ( type ) {

			case 'フェード': {
				portrait.o = prog
			} break
			case 'トランス': {
				[ 'x', 'y', 'w', 'h' ].forEach( p => {
					old.port[ p ] = old.data[ p ] * ( 1 - prog ) + portrait[ p ] * prog
				} )

			} break

		}
		if ( prog == 1 ) break
	}
	

}


export async function removePortraits ( ) {
	
	let children = [ ... layer.portraitGroup.children ]

	let eff = effect.enabled ? effect : new ProgressTimer( 150 )
	let type = effect.enabled ? await eff.on( 'type' ) : 'フェード'

	//$.log( 'remv', type, effect )

	while ( true ) {
		let prog = await eff.on( 'step' )
		switch ( type ) {

			case 'フェード': {
				for ( let portrait of children ) { portrait.o = 1 - prog }
			} break
			case 'トランス': {
				//

			} break

		}
		if ( prog == 1 ) break
	}

	
	for ( let portrait of children ) { portrait.remove( ) }
}


export async function showChoices ( choices, inputBox = layer.inputBox ) {
	
	let m = .05

	let nextClicks = [ ]

	let len = choices.length
	let colLen = 1 + ( ( len - 1 ) / 3 | 0 )
	let w = ( ( 1 - m ) - m * colLen ) / colLen
	let h = ( ( 1 - m ) - m * 3 ) / 3

	for ( let i = 0; i < len; i++ ) {
		let [ key, val ] = Array.isArray( choices[ i ] ) ? choices[ i ] : [ choices[ i ], choices[ i ] ]
		let row = i % 3, col = i / 3 | 0
		let [ x, y ] = [ m + ( w + m ) * col, m + ( h + m ) * row ]

		let choiceBox = new Renderer.RectangleNode( { name: 'choiceBox', 
			x, y, w, h, pos: 'center', region: 'opaque', fill: 'rgba( 100, 100, 255, .8 )' } ) 
		inputBox.append( choiceBox )

		let textArea = new Renderer.TextNode( { name: 'textArea',
			size: .7, y: .05, pos: 'center', fill: 'rgba( 255, 255, 255, .9 )' } )
		choiceBox.append( textArea )
		nextClicks.push( choiceBox.on( 'click' ).then( _ => val ) )
		textArea.set( key )
	}

	inputBox.show( )
	let val = await Promise.race( nextClicks )
	inputBox.removeChildren( )
	inputBox.hide( )
	return val

}

export { playBGM, stopBGM } from './サウンド.js'


