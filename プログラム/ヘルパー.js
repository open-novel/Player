/*
These codes are licensed under CC0.
http://creativecommons.org/publicdomain/zero/1.0
*/

//const metaurl = import.meta.url  // eslint-disable-line-parsing
//const baseurl = new URL( '../', metaurl ).href  // eslint-disable-line

export let channel = localStorage.playerChannel || ''
if ( location.hostname.match( /localhost|\d+\.\d+\.\d+/ ) ) channel = 'Loc'
let base = channel == 'Dev' ? '/Player_Dev/' : channel.includes( 'Loc' ) ? '/' : '/Player/'
export const baseurl = new URL( base, location.href ).href

import * as DB from './データベース.js'


let logEnabled
checkLogEnabled( )

function checkLogEnabled( ) {
	logEnabled = !! localStorage.logEnabled
	setTimeout( checkLogEnabled, 1000 )
}

const NOP = ( ) => { }

export const log	= logEnabled ? console.log  .bind( console ) : NOP
export const info	= logEnabled ? console.info .bind( console ) : NOP
export const warn	= logEnabled ? console.warn .bind( console ) : NOP
export const error = logEnabled ? console.error.bind( console ) : NOP
export const hint	= console.info.bind( console )
export const assert = console.assert.bind( console )

log( baseurl )
export let Settings = { VR: { enabled: false } }


export const Token = [
	'back', 'next', 'close', 'success', 'failure'
].reduce( ( obj, key ) => { obj[ key ] = Symbol( key ); return obj }, Object.create( null ) )

export function isToken ( val ) { return !! Object.values( Token ).includes( val ) }


export function clone ( obj ) { return JSON.parse( JSON.stringify( obj ) ) }


export const neverDone = new Promise( NOP )


export const trying = promise => promise.then( ( ) => Token.success, err => {
	error( err ); return Token.failure } )


export async function fetchFile ( name, type = 'blob' ) {
	return ( await fetch( new URL( name, baseurl ) ) )[ type ]( )
}



export function Deferred ( ) {
	let resolve, reject
	let promise = new Promise( ( ok, ng ) => { resolve = ok, reject = ng } )
	return { promise, resolve, reject }
}

export function timeout ( ms ) {

	let { promise, resolve } = new Deferred
	if ( ms != Infinity ) setTimeout( resolve, ms )
	return promise
}

export function normalizePos ( obj ) {
	for ( let [ key, look ] of [ [ 'x', 'w' ], [ 'y', 'h' ] ] ) {
		let val = obj[ key ]
		if ( ! Number.isFinite( val ) ) continue
		if ( 1 / val < 0 ) {
			obj[ key ] = val = 1 - obj[ look ] + val
			if ( val < 0 || Object.is( val, -0 ) || 1 < val )
				warn( `"${ val }" 不正な範囲の数値です` )
		}
	}
}


const fileCache = new Map
const blobCache = new WeakMap


export async function getFile ( path ) {
	let blob = fileCache.get( path )
	if ( ! blob ) {
		blob = await DB.getFile( path )
		fileCache.set( path, blob )
	}
	return blob
}

export function getImage ( blob ) {
	return new Promise( ( ok, ng ) => {
		let img = new Image
		let url = blobCache.get( blob )
		if ( ! url ) {
			url = URL.createObjectURL( blob )
			blobCache.set( blob, url )
		}
		img.onload = ( ) => {
			if ( img.decode ) img.decode( ).then( ( ) => ok( img ), ng )
			else ok( img )
		}
		img.onerror = ng
		img.style.width = '0px'
		img.style.height = '0px'
		img.src = url
	} )
}


export function download ( blob, title ) {
	let link = document.createElement( 'a' )
	link.href = URL.createObjectURL( blob )
	link.download = 'ONP'
	+ decodeURIComponent( `_【${ title }】_` )
	+ ( new Date ).toISOString( ).replace( /\.\d+Z$|[^\d]|/g, '' )
	document.body.append( link )
	link.click( )
	link.remove( )
	URL.revokeObjectURL( link.href )
}


export function AwaitRegister ( fn ) {

	let registrants = new Set

	return {

		target ( ...args ) {
			let v = fn( ...args )
			for ( let reg of registrants ) { reg( v ) }
			registrants.clear( )
			return v
		},

		register ( ) {
			let { promise, resolve } = new Deferred
			registrants.add( resolve )
			return promise
		}
	}

}


export function disableChoiceList ( disables, choiceList ) {
	for ( let choice of choiceList ) {
		if ( disables.includes( choice.label ) ) choice.disabled = true
	}
}


export async function getSaveChoices ( { title, start, num, isLoad = false } ) {

	let stateList = await DB.getStateList( title )
	let choices = [ ...Array( num ).keys( ) ].map( i => {
		let index = i + start + 1, state = stateList[ index ]
		log( index )
		let mark = state ? state.mark || '???' : '--------'
		if ( mark == '$root' ) mark = '(冒頭)'
		let disabled = ( isLoad && ! state ) || ( ! isLoad && index > 20 )
		return { label: mark, value: index, disabled }
	} )
	return choices

}


export function parseSetting ( text ) {

	let setting = { }
	let key = ''

	for ( let chunk of text.split( '\n' ) ) {
		chunk = chunk.trim( )
		if ( !chunk ) continue
		if ( chunk.match( /^・/ ) ) {
			key = chunk.replace( '・', '' )
			setting[ key ] = [ ]
		} else {
			setting[ key ].push( chunk )
		}
	}

	log( setting )
	return setting
}

export class Awaiter {

	fire ( key, value ) {

		if ( ! this[ key ] ) {
			this[ key ] = { lateValue: value }
			return
		}
		if ( this[ key ].lateValue ) {
			this[ key ].lateValue = value
		}
		if ( this[ key ].promise ) {
			this[ key ].resolve( value )
			delete this[ key ].promise
		}

	}

	on ( key, late = false ) {

		let { promise, resolve, lateValue } = this[ key ] || { }
		if ( ! promise ) {
			( { promise, resolve } = new Deferred )
			this[ key ] = { promise, resolve }
		}
		if ( late && lateValue !== undefined ) {
			//delete this[ key ].lateValue
			resolve( lateValue )
			log( 'late', key, lateValue )
		}
		return promise

	}


}



export class Time {

	constructor ( duration = 0 ) {
		this.origin = performance.now( ) - 0.01
		this.pauseStart = 0
		this.duration = duration
	}

	get ( ) {
		return performance.now( ) - this.origin
	}

	progress ( ) {
		let p = this.get( ) / this.duration
		return p < 0 ? 0 : p > 1 ? 1 : Number.isNaN( p ) ? 1 : p
	}

	pause ( ) {
		this.pauseStart = performance.now( )
	}

	resume ( ) {
		this.origin += performance.now( ) - this.pauseStart
	}

}


export function importWorker ( name ) {

	let w = new Worker( new URL( `プログラム/${ name }.js`, baseurl ) )

	return new Proxy( { }, {
		get ( tar, key ) {
			return async ( ...args ) => {
				w.postMessage( { fn: key, args },
					args.reduce( ( a, v ) => {
						if ( v instanceof ArrayBuffer ) a.push( v )
						else if ( ArrayBuffer.isView( v ) ) a.push( v.buffer )
						return a
					}, [ ] ) )
				return new Promise ( ( ok, ng ) => {
					w.onmessage = ok, w.onerror = ng
				} )
			}
		}
	} )

}
