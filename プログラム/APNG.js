/*
These codes are licensed under CC0.
http://creativecommons.org/publicdomain/zero/1.0
*/

'use strict'

// const $ = { log ( ...args ) { return console.log( ...args ) } }
const $ = { log ( ) { } }



self.addEventListener( 'message', async e => {

	let fn = { splitPNG }[ e.data.fn ]
	if ( ! fn ) throw 'UnEx'

	let [ res, trans ] = await fn( ...e.data.args )

	self.postMessage( res, trans )

} )


/*
;( async function ( ) {

	let ab = await ( await fetch( 'apng.png' ) ).arrayBuffer( )
	let chunks = splitFile( ab )
	
	console.log( chunks )
	let reader = new FileReader
	reader.onload = ( ) => console.log( reader.result )
	reader.readAsDataURL( chunks[ 0 ].data[ 0 ] )


} )( );
*/


async function splitPNG( buf ) {


	let res = join( split( buf ) )
	let trans = res.flatMap( data => data.data )


	console.log( split( res[ 0 ].data[ 0 ] ) )

	return [ res, trans ]

	/*
	return new Promise ( ok => {

		let reader = new FileReader
		reader.onload = ( ) => {
			res.base64 = reader.result
			ok( [ res, trans ] )
		}
		reader.readAsDataURL( new Blob( [ res[ 0 ].data[ 0 ] ], { type: 'image/png' } ) )
	} )
	*/


}




 
let magic = 0xEDB88320
const CRC32Table = new Uint32Array( 256 )
for ( let i = 0; i < 256; i++ ) {
	let v = i
	for ( let j = 0; j < 8; j++ ) {
		let b = v & 1
		v >>>= 1
		if ( b ) v ^= magic
	}
	CRC32Table[i] = v
}



function join( chunks ) {


	function getCRC32( ary ) {

		let crc32 = 0xFFFFFFFF
		for ( let a of ary) for ( let i = 0; i < a.length; i++ )
			crc32 = CRC32Table[(crc32 ^ a[i]) & 0xff] ^ (crc32 >>> 8)

		return Uint32BigAry( [ ~crc32 ] )

	}


	chunks.forEach( ch => {
		
		ch.data = ch.data.map( data => {

			let signature = new Uint8Array( [ 137, 80, 78, 71, 13, 10, 26, 10 ] )

			let IHDR = [
				new Uint8Array( [ 73, 72, 68, 82 ] ),
				Uint32BigAry( [ ch.width, ch.height ] ),
				new Uint8Array( chunks.etc ),
			]
			IHDR = [ Uint32BigAry( [ 13 ] ), ...IHDR, getCRC32( IHDR ) ]



			let IDAT = [
				new Uint8Array( [ 73, 68, 65, 84 ] ),
				new Uint8Array( data ),
			]
			IDAT = [ Uint32BigAry( [ data.byteLength ] ), ...IDAT, getCRC32( IDAT ) ]


			let IEND = [
				Uint32BigAry( [ 0 ] ),
				new Uint8Array( [ 73, 69, 78, 68 ] ),
				Uint32BigAry( [ 2923585666 ] ),
			]

			let fragments = [ signature, ...IHDR, ...IDAT, ...IEND ]
			//console.log( fragments )
			let len = fragments.reduce( ( n, a ) => n + a.byteLength, 0 )

			let buf = new Uint8Array( len )
			let p = 0
			for ( let ary of fragments ) {
				buf.set( ary, p )
				p += ary.byteLength
			}
			return buf.buffer


		} )
		return ch
	} )

	//delete chunks.etc
	//delete chunks.chunks

	return chunks


	function Uint32BigAry ( ary ) {
		let view = new DataView( new ArrayBuffer( 4 * ary.length ) )
		for ( let i = 0; i < ary.length; i++ ) view.setUint32( 4 * i, ary[ i ] )
		return new Uint8Array( view.buffer )
	}


}



function split( buf ) {


	let view = new DataView( buf )

	function equalBytes ( ary ) {

		for ( let i = 0; i < ary.length; i ++ ) {
			if ( view.getUint8( i ) !=  ary[ i ] ) return false
		}
		return true

	}

	function read8 ( ) {
		let num = view.getUint8( p )
		p += 1
		return num
	}
	function read16 ( ) {
		let num = view.getUint16( p )
		p += 2
		return num
	}
	function read32 ( ) {
		let num = view.getUint32( p )
		p += 4
		return num
	}
	function readT ( len ) {
		let dec = new TextDecoder
		return dec.decode( buf.slice( p, p += len ) )
	}




	let p = 0

	let isPNG = equalBytes( [ 137, 80, 78, 71, 13, 10, 26, 10 ] )

	if ( ! isPNG ) return null

	p = 8

	let chunks = [ ]
	while ( p < buf.byteLength ) {

		let length	= read32( )
		let type	= readT( 4 )
		let data	= readChunk( type, length )
		let crc		= read32( )

		//if ( isTest ) debugger

		if ( type == 'IHDR' ) chunks.crc = crc
		if ( type == 'IHDR' || type == 'acTL' )
			Object.assign( chunks, data )
		if ( type == 'fcTL' )
			chunks[ chunks.length ] = data
		if ( type == 'IDAT' || type == 'fdAT' ) {
			if ( ! chunks[ chunks.length - 1 ] )
				chunks[ chunks.length ]　= { }
			if ( ! chunks[ chunks.length - 1 ].data ) 
				chunks[ chunks.length - 1 ].data = [ ]
			chunks[ chunks.length - 1 ].data.push( data.data )
			
		}
		
		//console.log( type, crc )
	}


	return chunks


	



	function readChunk ( type, len ) {

		let fn = {

			IHDR () {
				let width	= read32( )
				let height	= read32( )
				let etc		= buf.slice( p, p += 5 )
				return { width, height, etc }
			},
			acTL () {
				let chunks	= read32( )
				let plays_n	= read32( )
				let plays	= plays_n || Infinity
				return { chunks, plays }
			},
			fcTL () {
				let sequence= read32( )
				let width	= read32( )
				let height	= read32( )
				let x		= read32( )
				let y		= read32( )
				let delay_n	= read16( ) 
				let delay_d	= read16( )
				let delay	= delay_n / ( delay_d || 100 )
				let dispose_op = read8( )
				let dispose = [ 'NONE', 'BACKGROUND', 'PREVIOUS' ][ dispose_op ]
				let blend_op  = read8( )
				let blend = [ 'SOURCE', 'OVER' ][ blend_op ]
				return { width, height, x, y, delay, dispose, blend }
			},
			IDAT () {
				let data = buf.slice( p, p += len )
				return { data }
			},
			fdAT () {
				let sequence = read32( )
				let data = buf.slice( p, p += len - 4 )
				return { data }
			},
			IEND () {
				return { }
			},
			tEXt () {
				return { text: readT( len ) }
			},


		}[ type ]

		if ( fn ) return fn( ) 
		else return { length: len, buffer: buf.slice( p, p += len ) }


	}




}


