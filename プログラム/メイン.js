/*
These codes are licensed under CC0.
http://creativecommons.org/publicdomain/zero/1.0
*/

import * as $ from './ヘルパー.js'
import * as Player from './システム.js'

window.addEventListener( 'DOMContentLoaded', main )

async function main( ) {


	//Canvas要素の配置と準備

	const wrapper = document.querySelector( '#ONPWrapper' )

	const player = document.createElement( 'div' )

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
	wrapper.appendChild( player )

	const canvas = document.createElement( 'canvas' )
	Object.assign( canvas, {
		width: 960,
		height: 540,
	} )
	Object.assign( canvas.style, {
		width: '100%',
		height: '100%',
	} )


	Array.from( wrapper.childNodes, node => node.remove( ) )
	player.appendChild( canvas )

	let ctx = canvas.getContext( '2d' )

	let captureEventTypes = [ 'down', 'up', 'move' ]

	for ( let type of captureEventTypes ) {
		canvas.addEventListener( `pointer${ type }`, e => {
			e.preventDefault( ), e.stopPropagation( )
			if ( e.button > 3 ) return
			let button = [ 'left' ,'middle', 'right' ] [ e.button ]
			Player.onPointerEvent( { type, button, x: e.layerX, y: e.layerY } )
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
		Player.onMessage( e.data )
	} )

	if ( window.opener ) {
		window.opener.postMessage( 'ready' )
	}


	const onp = Player.initPlayer( { ctx, mode: location.hash.slice( 1 ) } )
	onp.then( ( ) => window.close( ), ( ) => window.close( ) )


}

window.addEventListener( 'beforeinstallprompt', e => {
	window.installEvent = e
	e.prompt( )
} )

navigator.serviceWorker.register( '/Player/サービス.js', { scope: '/Player/' } ).then( reg => reg.update( ) )
