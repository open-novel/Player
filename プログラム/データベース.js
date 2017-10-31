/*
These codes are licensed under CC0.
http://creativecommons.org/publicdomain/zero/1.0
*/

import * as $ from './ヘルパー.js'


let DB = null

export async function init ( ) {

	const VERSION = 4

	let upgrade = ( db, { oldVersion: ver } ) => {

		function createObjectStore ( type, key ) {
			let os = db.createObjectStore( type, key ? { keyPath: key } : undefined )
		}

		if ( ver <= 5 ) {
			createObjectStore( 'State', [ 'title', 'index' ] )
			createObjectStore( 'File' )
			createObjectStore( 'TitleList', 'index' )
		}

	}

	DB = await on( indexedDB.open( 'Open-Novel-Player', VERSION ), { onupgradeneeded: upgrade } )

}



function on ( req, option ) {
	
	let ok
	if ( option ) {
		req[ Object.keys( option )[ 0 ] ] = e => {
			Object.values( option )[ 0 ]( req.result, e )
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



export async function getStateList ( title ) {
	
	let type = 'State'
	let os = DB.transaction( [ type ], 'readonly' ).objectStore( type )
	let { promise, resolve } = new $.Deferred, list = [ ]
	os.openCursor( IDBKeyRange.bound( [ title, 0 ], [ title, 1000 ] ) )
	.onsuccess = ( { target: { result: cursor } } ) => {
		if ( ! cursor ) return resolve( )
		list[ cursor.key[ 1 ] ] = cursor.value
		cursor.continue( )
	}
	await promise
	$.log( list )
	return list

}

export async function saveState ( title, index, data ) {

	let type = 'State'
	$.log( `Save${ type }`, title, index, data )
	data = Object.assign( { title, index }, data )
	let os = DB.transaction( [ type ], 'readwrite' ).objectStore( type )
	await on( os.put( data ) )

}

export async function loadState ( title, index ) {
	
	let type = 'State'
	let os = DB.transaction( [ type ], 'readonly' ).objectStore( type )
	let data = await on( os.get( [ title, index ] ) )
	$.log( `Load${ type }`, title, index, data )
	return data

}


export async function saveFiles ( data ) {

	let type = 'File'
	$.log( `Save${ type }`, data )
	let ts = DB.transaction( [ type ], 'readwrite' )
	let os = ts.objectStore( type )
	for ( let [ file, path ] of data ) {
		os.put( file, path )
	}
	await on( ts )
}

export async function loadFile ( path ) {
	
	let type = 'File'
	let os = DB.transaction( [ type ], 'readonly' ).objectStore( type )
	let data = await on( os.get( path ) )
	$.log( `Load${ type }`, path, data )
	return data
}



//const　cacheMap = new Map

export async function getFile ( path ) {
	//let file = cacheMap.get( url ) 
	//if ( file ) return file
	$.log( path )
	let file = await loadFile( path )
	let data = await new Response( file )[ file.type == 'text/plain' ? 'text': 'blob' ]( )
	//cacheMap.set( url, file )
	return data
}



export async function getTitleList ( ) {
	
	let type = 'TitleList'
	let os = DB.transaction( [ type ], 'readonly' ).objectStore( type )
	let { promise, resolve } = new $.Deferred, list = [ ]
	os.openCursor( ).onsuccess = ( { target: { result: cursor } } ) => {
		if ( ! cursor ) return resolve( )
		list[ cursor.key ] = cursor.value
		cursor.continue( )
	}
	await promise
	return list

}


export async function saveTitle ( index, data ) {
	
	let type = 'TitleList'
	data = Object.assign( { index }, data )
	let os = DB.transaction( [ type ], 'readwrite' ).objectStore( type )
	await on( os.put( data ) )

}

export async function loadTitle ( index ) {
	
	let type = 'TitleList'
	let os = DB.transaction( [ type ], 'readonly' ).objectStore( type )
	return on( os.get( index ) )

}



