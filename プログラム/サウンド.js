/*
These codes are licensed under CC0.
http://creativecommons.org/publicdomain/zero/1.0
*/

import * as $ from './ヘルパー.js'
import * as DB from './データベース.js'


let ctx, out, bgmSource, gain
ctx = new AudioContext
out = ctx.createGain( )
setMainVolume( 0 )
out.connect( ctx.destination )

async function init ( ) {

	//if ( ctx ) ctx.close( )
	stopBGM( )

}

export let { target: initSound, register: nextInit } = new $.AwaitRegister( init )


export function setMainVolume ( value ) {
	out.gain.value = value
}

const sysEffectMap = new Map

const bufferCache = new Map

export async function playSysEffect ( name ) {

	//$.log( 'SysEffect', name )
	// TODO cache
	ctx.resume( )

	let ary = sysEffectMap.get( name )
	if ( ! ary ) {
		ary = [ ]
		sysEffectMap.set( name, ary )
		await addBuffer( )
	}

	async function addBuffer ( ) {
		let ab = bufferCache.get( name )
		if ( ! ab ) {
			ab = await $.fetchFile( `効果音/${ name }`, 'arrayBuffer' )
			bufferCache.set( name, ab )
		}
		let source = ctx.createBufferSource( )
		source.buffer = await ctx.decodeAudioData( ab.slice( ) )
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
	let blob = await DB.getFile( path )
	let fr = new FileReader
	let promise = new Promise( ( ok, ng ) => {
		fr.onload = ( ) => ok( fr.result ), fr.onerror = ng
	} )
	fr.readAsArrayBuffer( blob )
	let ab = await promise
	let source = ctx.createBufferSource( )
	source.loop = true
	source.buffer = await ctx.decodeAudioData( ab )
	source.connect( out )

	stopBGM( )
	bgmSource = source
	bgmSource.start( )

}


export function stopBGM ( ) {

	if ( bgmSource ) bgmSource.disconnect( )

}
