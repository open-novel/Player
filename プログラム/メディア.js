/*
These codes are licensed under CC0.
http://creativecommons.org/publicdomain/zero/1.0
*/

import * as $ from './ヘルパー.js'
import * as DB from './データベース.js'


let ctx, out, bgmSource, gain, mainVolume = 0
export let activeBGV = null
if ( ! window.AudioContext ) window.AudioContext = window.webkitAudioContext
init( )

async function init ( ) {

	if ( ctx ) ctx.close( )
	ctx = new AudioContext
	out = ctx.createGain( )
	setMainVolume( mainVolume )
	out.connect( ctx.destination )

	stopBGM( )
	stopBGV( )

}

export let { target: initMedia, register: nextInit } = new $.AwaitRegister( init )


export function setMainVolume ( value ) {
	out.gain.value = mainVolume = value
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
		source.buffer = await new Promise( ok =>
			ctx.decodeAudioData( ab.slice( 0 ), ok )
		)
		source.connect( out )
		source.onended = ( ) => source.disconnect( )
		ary.push( source )
	}


	let source = ary.shift( )
	if ( ! source ) return $.warn( `サウンドソースバッファ「${ name }」を使い切りました` )

	if ( mainVolume != 0 ) source.start( )

	for ( let i = ary.length; i < 5; i ++ ) addBuffer( )

}



export async function playBGM ( path ) {
	stopBGM( )
	bgmSource = await play( path, true )
}

export async function playSE ( path ) {
	await play( path, false )
}

async function play ( path, loop ) {

	// TODO cache
	let blob = await DB.getFile( path )
	let fr = new FileReader
	let promise = new Promise( ( ok, ng ) => {
		fr.onload = ( ) => ok( fr.result ), fr.onerror = ng
	} )
	fr.readAsArrayBuffer( blob )
	let ab = await promise
	let source = ctx.createBufferSource( )
	source.loop = loop
	source.buffer = await new Promise( ok =>
		ctx.decodeAudioData( ab, ok )
	)
	source.connect( out )
	if ( mainVolume != 0 ) source.start( )
	return source

}


export function stopBGM ( ) {

	if ( bgmSource ) bgmSource.disconnect( )

}



export async function playBGV ( path ) {

	stopBGV( )
	let video = document.createElement( 'video' )
	activeBGV = video
	// TODO cache
	let blob = await DB.getFile( path )
	if ( activeBGV != video ) return
	let url = URL.createObjectURL( blob )
	video.src = url
	video.volume = mainVolume
	activeBGV.play( )
	await new Promise( ok => {
		activeBGV.addEventListener( 'ended', ok )
	} )

}


export function stopBGV ( ) {

	if ( activeBGV ) activeBGV.pause( )
	activeBGV = null

}


