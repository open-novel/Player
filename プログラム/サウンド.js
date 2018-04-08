/*
These codes are licensed under CC0.
http://creativecommons.org/publicdomain/zero/1.0
*/

import * as $ from './ヘルパー.js'
import * as DB from './データベース.js'


let ctx, out, bgm

async function init ( opt ) {

	if ( ctx ) ctx.close( )
	if ( bgm ) stopBGM( )
	ctx = new AudioContext
	out = ctx.destination
	bgm = new Audio
	bgm.loop = true
	ctx.createMediaElementSource( bgm ).connect( out )

}

export let { target: initSound, register: nextInit } = new $.AwaitRegister( init )



export async function playSysEffect ( name ) {

	$.log( 'SysEffect', name )
	// TODO cache
	let ab = await ( await fetch( `効果音/${ name }` ) ).arrayBuffer( )
	let source = ctx. createBufferSource( )
	source.buffer = await ctx.decodeAudioData( ab )
	source.connect( out )
	source.start( )

}



export async function playBGM ( path ) {

	// TODO cache
	bgm.src = URL.createObjectURL( await DB.getFile( path ) )
	// TODO
	await bgm.play( ).catch( e => true )

}


export function stopBGM ( ) {

	bgm.pause( )

}
