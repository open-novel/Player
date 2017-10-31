/*
These codes are licensed under CC0.
http://creativecommons.org/publicdomain/zero/1.0
*/

import * as $ from './ヘルパー.js'


let DB = null

export async function init ( ) {

	const VERSION = 2

	let upgrade = db => {
		let os = db.createObjectStore( 'State', { keyPath: [ 'title', 'index' ] } )

	}

	DB = await on( indexedDB.open( 'Open-Novel-Player', VERSION ), upgrade )

}



function on ( req, upgrade ) {
	
	let ok
	if ( upgrade ) {
		req.onupgradeneeded = ( ) => {
			upgrade( req.result )
			ok( req.result )
		}
	}
	return new Promise( ( _ok, ng ) => {
		ok = _ok
		req.onsuccess = ( ) => ok( req.result )
		req.oncomplete = ( ) => ok( req.result )
		req.onerror = ( ) => ng( req.errorCode )
		req.onabort = ( ) => ng( 'ablort' )
	} )

}


export async function saveState ( title, index, state ) {
	
	$.log( 'SAVE', state )
	let data = Object.assign( { title, index }, state )
	let os = DB.transaction( [ 'State' ], 'readwrite' ).objectStore( 'State' )
	await on( os.put( data ) )

}


export async function loadState ( title, index ) {
	
	let os = DB.transaction( [ 'State' ], 'readonly' ).objectStore( 'State' )
	let state = await on( os.get( [ title, index ] ) )
	$.log( 'LOAD', state )
	return state

}



