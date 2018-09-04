/*
These codes are licensed under CC0.
http://creativecommons.org/publicdomain/zero/1.0
*/

export let TEST = { mode: '' }

//const metaurl = import.meta.url  // eslint-disable-line-parsing
//const baseurl = new URL( '../', metaurl ).href  // eslint-disable-line
const baseurl = new URL( '/Player/', location.href ).href

import * as DB from './データベース.js'


let logEnabled
checkLogEnabled( )

function checkLogEnabled( ) {
	logEnabled = !! localStorage.logEnabled
	setTimeout( checkLogEnabled, 1000 )
}

const NOP = ( ) => { }
window.logBuffer = [ ]
export const log	= ( ...args ) => logEnabled && console.log( ...args )
export const info	= ( ...args ) => logEnabled && console.info( ...args )
export const warn	= ( ...args ) => logEnabled && console.warn( ...args )
export const error = ( ...args ) => logEnabled ? console.error( ...args ) : window.logBuffer.push( args )
export const hint = console.error.bind( console )

export const Token = [ 'back', 'next', 'cancel' ].reduce( ( obj, key ) => { obj[ key ] = Symbol( ); return obj }, { } )


export const neverDone = new Promise( NOP )

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


export function neverRun ( ) {
	return new Deferred( ).promise
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
