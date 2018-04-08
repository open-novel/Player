/*
These codes are licensed under CC0.
http://creativecommons.org/publicdomain/zero/1.0
*/

import * as $ from './ヘルパー.js'
import * as DB from './データベース.js'


let ctx, out, bgm
ctx = new AudioContext
out = ctx.destination

async function init ( ) {

	//if ( ctx ) ctx.close( )
	if ( bgm ) stopBGM( )
	bgm = new Audio
	bgm.loop = true
	ctx.createMediaElementSource( bgm ).connect( out )

}

export let { target: initSound, register: nextInit } = new $.AwaitRegister( init )


const sysEffectMap = new Map

export async function playSysEffect ( name ) {

	$.log( 'SysEffect', name )
	// TODO cache
	let ary = sysEffectMap.get( name )
	if ( ! ary ) {
		ary = [ ]
		sysEffectMap.set( name, ary )
		await addBuffer( )
	}

	async function addBuffer ( ) {
		let ab = await ( await fetch( `効果音/${ name }` ) ).arrayBuffer( )
		let source = ctx. createBufferSource( )
		source.buffer = await ctx.decodeAudioData( ab )
		ary.push( source )
	}


	let source = ary.shift( )
	if ( ! source ) return $.warn( `サウンドソースバッファ「${ name }」を使い切りました` )
	source.connect( out )
	source.start( )

	for ( let i = ary.length; i < 5; i ++ ) addBuffer( )

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
