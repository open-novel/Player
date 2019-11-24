/*
These codes are licensed under CC0.
http://creativecommons.org/publicdomain/zero/1.0
*/

import * as $ from './ヘルパー.js'


let DB = null

export async function init ( ) {

	const VERSION = 5

	let upgrade = ( db, { oldVersion: ver } ) => {

		function createObjectStore ( type, key ) {
			let os = db.createObjectStore( type, key ? { keyPath: key } : undefined )
		}

		if ( ver <= 3 ) {
			createObjectStore( 'State', [ 'title', 'index' ] )
			createObjectStore( 'File' )
			createObjectStore( 'TitleList', 'index' )
		}
		if ( ver <= 4 ) {
			createObjectStore( 'Setting' )
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
		req.onerror = ( ) => ng( req.error )
		req.onabort = ( ) => ng( 'aborted' )
	} )

}



export async function getSetting ( key ) {

	let type = 'Setting'
	let os = DB.transaction( [ type ], 'readonly' ).objectStore( type )
	return await on( os.get( key ) )

}

export async function setSetting ( key, val ) {

	let type = 'Setting'
	let os = DB.transaction( [ type ], 'readwrite' ).objectStore( type )
	return await on( os.put( val, key ) )

}


export async function getStateList ( title ) {

	let type = 'State'
	let os = DB.transaction( [ type ], 'readonly' ).objectStore( type )
	let { promise, resolve } = new $.Deferred, list = [ ]
	os.openCursor( IDBKeyRange.bound( [ title, 0 ], [ title, 10000 ] ) )
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
	data = Object.assign( data, { title, index } )
	let os = DB.transaction( [ type ], 'readwrite' ).objectStore( type )
	$.log( `Save${ type }`, title, index, data )
	await on( os.put( data ) )


}

export async function loadState ( title, index ) {

	let type = 'State'
	let os = DB.transaction( [ type ], 'readonly' ).objectStore( type )
	let data = await on( os.get( [ title, index ] ) )
	$.log( `Load${ type }`, title, index, data )
	return data

}


export async function deleteState ( title, index ) {

	let type = 'State'
	let os = DB.transaction( [ type ], 'readwrite' ).objectStore( type )
	await on( os.delete( [ title, index ] ) )
	$.log( `Delete${ type }`, title, index )

}


export async function saveFiles ( data ) {

	let type = 'File'
	$.log( `Save${ type }`, data )
	let ts = DB.transaction( [ type ], 'readwrite' )
	let os = ts.objectStore( type )
	for ( let [ file, path ] of data ) {
		os.put( file, path )
	}
	await on( ts ).catch( async ( ) => {
		// fallback for iphone
		data = await Promise.all( data.map( async ( [ file, path ] ) => {
			let ab = await new Response( file ).arrayBuffer( )
			return [ { buffer: ab, type: file.type, name: file.name }, path ]
		} ) )
		let ts = DB.transaction( [ type ], 'readwrite' )
		let os = ts.objectStore( type )
		for ( let [ file, path ] of data ) {
			os.put( file, path )
		}
		return ts
	} )
}

export async function gcFiles ( ) {

	let list = await getTitleList( )
	list = list.map( obj => obj.origin + obj.title +'/' )
	$.log( list )

	let type = 'File'
	let os = DB.transaction( [ type ], 'readwrite' ).objectStore( type )
	let { promise, resolve } = new $.Deferred, count = 0
	os.openCursor( ).onsuccess = ( { target: { result: cursor } } ) => {
		if ( ! cursor ) return resolve( )
		let key = cursor.key
		if ( ! list.some( path => key.startsWith( path ) ) ) {
			cursor.delete( )
			++count
			$.log( 'DELETE!!', key )
		}
		cursor.continue( )
	}
	await promise

	return count

}


export async function loadFile ( path ) {

	let type = 'File'
	let os = DB.transaction( [ type ], 'readonly' ).objectStore( type )
	let data = await on( os.get( path ) )
	$.log( `Load${ type }`, path, data )
	if ( data && data.buffer ) {
		data = new File( [ data.buffer ], data.name, { type: data.type } )
	}
	return data
}


//const　cacheMap = new Map

export async function getFile ( path ) {
	//let file = cacheMap.get( url )
	//if ( file ) return file
	$.log( path )
	let file = await loadFile( path )
	if ( ! file ) return null
	let data = await new Response( file )[ file.type.includes( 'text/' ) ? 'text': 'blob' ]( )
	//cacheMap.set( url, file )
	return data
}


export async function getAllFiles ( prefix ) {

	let type = 'File',  list = [ ]
	let os = DB.transaction( [ type ], 'readonly' ).objectStore( type )
	let { promise, resolve } = new $.Deferred
	os.openCursor( ).onsuccess = ( { target: { result: cursor } } ) => {
		if ( ! cursor ) return resolve( )
		let key = cursor.key
		if ( key.startsWith( prefix ) ) {
			list.push( cursor.value )
		}
		cursor.continue( )
	}
	await promise

	return list

}


export async function getTitleList ( ) {

	let type = 'TitleList'
	let os = DB.transaction( [ type ], 'readonly' ).objectStore( type )
	let { promise, resolve } = new $.Deferred, list = { }
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

export async function deleteTitle ( index ) {

	let type = 'TitleList'
	let os = DB.transaction( [ type ], 'readwrite' ).objectStore( type )
	return on( os.delete( index ) )

}
