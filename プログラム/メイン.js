/*
These codes are licensed under CC0.
http://creativecommons.org/publicdomain/zero/1.0
*/

import * as $ from './ヘルパー.js'
import * as Player from './システム.js'


export async function main( { installEvent = new $.Deferred } = { } ) {

	//Canvas要素の配置と準備
	const wrapper = document.querySelector( '#ONPWrapper' )

	let option = JSON.parse( wrapper.dataset.onp || '{ }' )

	const player = document.createElement( 'div' )

	const canvas = document.createElement( 'canvas' )
	Object.assign( canvas, {
		width: 960,
		height: 540,
	} )

	wrapper.innerHTML = ''

	wrapper.appendChild( player )
	player.appendChild( canvas )

	if ( true || option.pwa ) {

		Object.assign( document.documentElement.style, {
			overflow: 'hidden',
		} )
		Object.assign( document.body.style, {
			backgroundColor: 'black',
			margin: '0',
			textAlign: 'center',
			width: '100vw',
			height: '100vh',
			overflow: 'hidden',
		} )
		Object.assign( player.style, {
			width: '100%',
			height: '100%',
			overflow: 'hidden',
		} )
		Object.assign( canvas.style, {
			display: 'inline-block',
			margin: 'auto',
			height: '56.25vw',
			width: '177.7778vh',
			maxHeight: '100vh',
			maxWidth: '100vw',
		} )

	} else {

		Object.assign( player.style, {
			maxWidth: 'calc( 100% - 10px )',
			width: '960px',
			height: '540px',
			margin: '5px auto',
			padding: '5px',
			borderRadius: '10px 10px 0px 10px',
			boxShadow: '0px 0px 10px 1px blue inset',
			overflow: 'hidden',
			resize: 'horizontal',
		} )
		Object.assign( canvas.style, {
			width: '100%',
			height: '100%',
		} )

	}


	let ctx = canvas.getContext( '2d' )


	for ( let type of [ 'down', 'up', 'move' ] ) {
		canvas.addEventListener( `pointer${ type }`, e => {
			e.preventDefault( ), e.stopImmediatePropagation( )
			if ( e.button > 3 ) return
			let button = [ 'left' ,'middle', 'right' ] [ e.button ]
			Player.onPointerEvent( { type, button, x: e.offsetX, y: e.offsetY } )
		}, true )
	}

	for ( let type of [ 'start', 'end', 'move' ] ) {
		canvas.addEventListener( `touch${ type }`, e => {
			e.preventDefault( ), e.stopImmediatePropagation( )
			if ( type == 'start' ) type = 'down'
			if ( type == 'end'   ) type = 'up'
			let x = e.layerX || e.touches[ 0 ].clientX, y = e.layerY || e.touches[ 0 ].clientY
			Player.onPointerEvent( { type, button: 'left', x, y } )
		}, true )
	}




	canvas.addEventListener( 'contextmenu', e => e.preventDefault( ) )


	canvas.addEventListener( 'wheel', e => {
		e.preventDefault( )
		let type = e.deltaY >= 0 ? 'next' : 'back'
		Player.onKeyEvent( { type } )
	} )

	canvas.addEventListener( 'dragover', e => e.preventDefault( ) )
	canvas.addEventListener( 'drop', e => {
		e.preventDefault( )
		let files = e.dataTransfer.files
		if ( files && files[ 0 ] ) Player.onDrop( files[ 0 ] )
	} )

	window.addEventListener( 'keydown', e => {
		switch ( e.key ) {
			case 'Enter':
			case ' ':
				Player.onKeyEvent( { type: 'next' } )
		}
	} )

	window.addEventListener( 'message', e => {
		Player.onMessage( Object.assign( { port: e.ports[ 0 ] }, e.data ) )
	} )

	if ( window.opener ) {
		window.opener.postMessage( { type: 'ready' }, '*' )
	}


	Player.initPlayer( { ctx, mode: location.hash.slice( 1 ), installEvent, option, params: new URLSearchParams( location.search ) } )


}
