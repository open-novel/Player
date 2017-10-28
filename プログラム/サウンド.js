/*
These codes are licensed under CC0.
http://creativecommons.org/publicdomain/zero/1.0
*/

import * as $ from './ヘルパー.js'


let ctx, out, bgm

async function init ( opt ) {

	if ( ctx ) ctx.close( )
	ctx = new AudioContext
	out = ctx.destination
	bgm = new Audio
	bgm.loop = true
	ctx.createMediaElementSource( bgm ).connect( out )

}

export let { target: initSound, register: nextInit } = new $.AwaitRegister( init )





export async function playBGM ( url ) {
	
	bgm.src = url
	await bgm.play( )

}


export function stopBGM ( url ) {
	
	bgm.pause( )

}




