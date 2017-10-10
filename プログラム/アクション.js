/*
These codes are licensed under CC0.
http://creativecommons.org/publicdomain/zero/1.0
*/

import * as $ from './ヘルパー.js'
import * as Renderer from './レンダラー.js'
import * as Sound from './サウンド.js'


let layer, setting


export async function init ( opt ) {
	
	setting = opt.setting

	await Renderer.initRanderer( opt )
	await Sound.initSound( opt )

}


export let { target: initAction, register: nextInit } = new $.AwaitRegister( init )


;( async function updatingLayerCache ( ) {
	while ( true ) layer = await Renderer.nextInit( )
} )( )



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



const trigger =　new class Trigger{
	
	step( ) { return this.stepOr( ) }
	stepOr( ...awaiters ) {
		return Promise.race( 
			[ layer.on( 'click' ), action.on( 'next' ), ...awaiters ] )
	}
	stepOrFrameupdate( ) { return this.stepOr( frame.on( 'update' ) ) }
	stepOrTimeout( ms ) { return this.stepOr( $.timeout( ms ) ) }
}



export async function showMessage( name, text, speed ) {
		

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



async function getImage ( blob ) {
	let img = new Image
	let { promise, resolve } = new $.Deferred
	img.onload = resolve
	img.src = URL.createObjectURL( blob )
	await promise
	return img
}



let effect = new $.Awaiter

export async function runEffect ( type, sec ) {

	$.log( 'EF', type, sec )
	let ms = sec * 1000

	sw: switch ( type ) {

		case '準備': {

			effect = new $.Awaiter
			effect.enabled = true
			return

		} break
		case 'フェード': {

			let time = new $.Time
			while ( true ) {
				let interrupt = await trigger.stepOrFrameupdate( )
				let prog = interrupt ? 1 : time.get( ) / ms
				if ( prog > 1 ) prog = 1
				effect.fire( 'fade', prog )
				if ( prog == 1 ) break sw
			}

		}
	}

	effect.enabled = false

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
	
	let blob = await $.fetchFile( 'blob', url )
	let img = await getImage( blob )
	let w = 9 / 16 * h * img.naturalWidth / img.naturalHeight
	//$.log( { x, y, w, h, img } )
	let portrait = new Renderer.ImageNode( { name: 'portrait', x, y, w, h } )
	portrait.img = img
	layer.portraitGroup.append( portrait )

	if ( effect.enabled ) {
		portrait.o = 0
		while ( true ) {
			let prog = await effect.on( 'fade' )
			portrait.o = prog
			if ( prog == 1 ) break
		}
	}
	

}


export async function removePortraits ( ) {
	
	let children = layer.portraitGroup.children

	if ( effect.enabled ) {
		while ( true ) {
			let prog = await effect.on( 'fade' )
			for ( let portrait of children ) { portrait.o = 1 - prog }
			if ( prog == 1 ) break
		}
	}
	
	for ( let portrait of children ) { portrait.remove( ) }
}


export async function showChoices ( choices ) {
	
	let m = .05

	let inputBox = layer.inputBox
	let nextClicks = [ ]

	let len = choices.length
	let colLen = 1 + ( ( len - 1 ) / 3 | 0 )
	let w = ( ( 1 - m ) - m * colLen ) / colLen
	let h = ( ( 1 - m ) - m * 3 ) / 3

	for ( let i = 0; i < len; i++ ) {
		let [ key, val ] = choices[ i ]
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


