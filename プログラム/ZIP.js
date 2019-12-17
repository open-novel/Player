/*
These codes are licensed under CC0.
http://creativecommons.org/publicdomain/zero/1.0
*/

'use strict'

const $ = { log ( ...args ) { return console.log( ...args ) } }
//const $ = { log ( ) { } }

const Ext2MIME = {
	'aac': 'audio/aac',
	'avi': 'video/x-msvideo',
	'bmp': 'image/bmp',
	'gif': 'image/gif',
	'ico': 'image/x-icon',
	'jpeg': 'image/jpeg',
	'jpg': 'image/jpeg',
	'json': 'application/json',
	'mid': 'audio/midi',
	'midi': 'audio/midi',
	'mp3': 'audio/mpeg',
	'mp4': 'video.mp4',
	'mpeg': 'video/mpeg',
	'mpg': 'video/mpeg',
	'oga': 'audio/ogg',
	'ogv': 'video/ogg',
	'png': 'image/png',
	'svg': 'image/svg+xml',
	'tif': 'image/tiff',
	'tiff': 'image/tiff',
	'text': 'text/plain',
	'txt': 'text/plain',
	'wav': 'audio/wav',
	'weba': 'audio/webm',
	'webm': 'video/webm',
	'webp': 'image/webp',
	'woff': 'font/woff',
	'woff2': 'font/woff2',
	'zip': 'application/zip',
	'3gp': 'video/3gpp',
	'3g2': 'video/3gpp2',
}

const MIME2Ext = Object.entries( Ext2MIME ).reduce(
	( obj, [ key, val] ) => Object.assign( obj, { [ val ]: key } ), { }
)


self.addEventListener( 'message', async e => {

	let fn = { packFile, unpackFile }[ e.data.fn ]
	if ( ! fn ) throw 'UnEx'

	let [ res, trans ] = await fn( e.data.arg )

	self.postMessage( res, trans )

} )



async function packFile( data ) {

	const crc_table = initCRC( )
	let parts

	let blobs = pack( data )
	let zip = await await new Response( new Blob( blobs ) ).arrayBuffer( )

	return [ zip, [ zip ] ]


	function initCRC ( ) {

		const crc_table = new Uint32Array( 256 )
		for ( let n = 0; n < 256; n++ ) {
			let c = n
			for ( let k = 0; k < 8; k++ ) {
				if ( c & 1 ) {
					c = 0xedb88320 ^ ( c >>> 1 )
				} else {
					c = c >>> 1
				}
			}
			crc_table[ n ] = c
		}
		return crc_table

	}


	function crc32( buf ) {
		//return 0
		let c = 0xffffffff
		buf = new Uint8Array( buf )
		for ( let n = 0; n < buf.length; n++ ) {
			c = crc_table[ ( c ^ buf[ n ] ) & 0xff ] ^ ( c >>> 8 )
		}
		return c ^ 0xffffffff
	}


	function num ( len, val ) {
		let ta = new Uint8Array( len )
		for (  let i = 0; i < len; i++ ) {
			ta[ i ] = val & 0xFF
			val = val >> 8
		}
		parts.push( ta )
	}


	function basic ( buf ) {

		num( 2, 10 )  // need version
		num( 2, 0b0000100000000000 )  // purpose
		num( 2, 0 )  // compression
		num( 2, 0 )  // TODO time
		num( 2, 0 )  // TODO date
		num( 4, crc32( buf ) )  // crc
		num( 4, buf.byteLength )  // size
		num( 4, buf.byteLength )  // size

	}


	function pack ( data ) {

		let blobs = [ ]

		data = data.map( ( { buf, name, type } ) => {
			return {
				buf, type,
				name: new TextEncoder( ).encode( name + '.' + ( MIME2Ext[ type ] || 'unknown' )  )
			}
		} )

		data.forEach( ( { buf, name } ) => {

			parts = [ ]
			num( 4, 0x04034b50 )   // signature
			basic( buf )
			num( 2, name.byteLength )  // filename len
			num( 2, 0 )  // extra len
			parts.push( name )
			num( 0, 0 )  // extra
			parts.push( buf )
			blobs.push( new Blob( parts ) )

		} )


		let offset = 0, censize = 0
		data.forEach( ( { buf, name }, i ) => {

			parts = [ ]
			num( 4, 0x02014b50 )   // signature
			num( 1, 10 )
			num( 1, 0 )  // made by UNIX
			basic( buf )
			num( 2, name.byteLength )  // filename len
			num( 2, 0 )  // extra len
			num( 2, 0 )  // comment len
			num( 2, 0 )  // disk num
			num( 2, 0 )  // attributes
			num( 4, 0 )  // attributes
			num( 4, offset )
			parts.push( name )
			num( 0, 0 )  // extra
			num( 0, 0 )  // comment
			blobs.push( new Blob( parts ) )

			offset += blobs[ i ].size
			censize += blobs[ blobs.length - 1 ].size

		} )


		parts = [ ]
		num( 4, 0x06054b50  )   // signature
		num( 2, 0 )  // disk num
		num( 2, 0 )
		num( 2, blobs.length / 2 )  // total num
		num( 2, blobs.length / 2 )  // total num
		num( 4, censize )
		num( 4, offset )
		num( 2, 0 )  // comment len
		num( 0, 0 )  // comment
		blobs.push( new Blob( parts ) )

		return blobs

	}


}




async function unpackFile( zip ) {


	const FixedHuffmanTable = ( ( ) => {

		const repeat = {
			ex: new Uint16Array( 29 ),
			len: new Uint16Array( 29 )
		}

		const distance = {
			ex: new Uint16Array( 30 ),
			dis: new Uint16Array( 30 )
		}

		let len = 3
		for ( let i of Array( 29 ).keys( ) ) {
			let ex = ( i / 4 | 0 ) - 1
			if ( ex == -1 ) ex = 0
			if ( ex == 6 ) ex = 0
			repeat.ex[ i ] = ex
			repeat.len[ i ] = len
			len += 1 << ex
		}
		repeat.len[ 28 ] = 258

		let dis = 1
		for ( let i of Array( 30 ).keys( ) ) {
			let ex = ( i / 2 | 0 ) - 1
			if ( ex == -1 ) ex = 0
			distance.ex[ i ] = ex
			distance.dis[ i ] = dis
			dis += 1 << ex
		}

		return { repeat, distance }

	} ) ( )

	$.log( FixedHuffmanTable )

	let buffer

	if ( zip instanceof ArrayBuffer ) buffer = zip
	else {
		const fr = new FileReader
		let promise = new Promise( ok => { fr.onload = ( ) => ok( fr.result ) } )
		fr.readAsArrayBuffer( zip )
		buffer = await promise
	}

	const view = new DataView( buffer )

	let cbit = view.getUint8( 0 )

	let pointer = 0

	let offset = 0


	let files = [ ]

	console.time( 'unpack' )
	readAreas( files )
	console.timeEnd( 'unpack' )


	files = files.reduce( ( a, f ) => {
		if ( f.data.length != 0 ) a.push( f )
		return a
	}, [ ] )

	return [ files, files.map( f => f.data.buffer ) ]




	function bit16 ( len ) {
		let n = view.getUint16( pointer, true )
		n = ( ( n << offset ) & 0xFFFF ) >>> ( 16 - len )
		offset += len
		if ( offset == 16 ) {
			offset = 0
			pointer += 2
			cbit = view.getUint8( pointer )
		}
		return n
	}

	function bitD ( len ) {
		//let n = view.getUint8( pointer ) | ( view.getUint8( pointer + 1 ) << 8 )
		//let m = 0, m2 = 0
		//for ( let i = 0; i < len ; i ++ ) {
		//	m = ( m << 1 ) | ( ( n >>> ( i + offset ) ) & 0b1 )
		//}
		let m = 0
		for ( let i = 0; i < len; i ++ ) { m = ( m << 1 ) | bit1( ) }
		//if ( m != m2 ) throw 'UnEx'
		if ( offset >= 8 ) throw ''

		return m
	}

	function bitU ( len ) {
		//let n = view.getUint8( pointer ) | ( view.getUint8( pointer + 1 ) << 8 )
		//let m = 0, m2 = 0
		//for ( let i = 0; i < len ; i ++ ) {
		//	m = m | ( ( ( n >>> ( i + offset ) ) & 0b1 ) << i )
		//}
		let m = 0
		for ( let i = 0; i < len; i ++ ) { m = m | ( bit1( ) << i ) }
		//if ( m != m2 ) throw 'UnEx'
		if ( offset >= 8 ) throw ''

		return m
	}

	function bit1 ( ) {
		if ( offset >= 8 ) throw 'UnEx'
		let m =	( cbit >>> offset ) & 0b1
		offset ++
		if ( offset >= 8 ) {
			offset -= 8
			pointer ++
			cbit = view.getUint8( pointer )
		}
		return m
	}


	function byte ( len ) {
		if ( offset > 0 ) throw 'UnEx'
		return bitU( len * 8 )
		/*
		let n
		     if ( len == 1 ) n = view.getUint8 ( pointer, true )
		else if ( len == 2 ) n = view.getUint16( pointer, true )
		else if ( len == 4 ) n = view.getUint32( pointer, true )
		//else if ( len == 8 ) n = view.getUint32( pointer, true ) * 4294967296
		//						+ view.getUint32( pointer + 4, true )
		else n = 0
		pointer += len
		return n
		*/
	}

	function strByte ( size, type = 'sjis' ) {

		let dec = new TextDecoder( type, { fatal: true } )
		let buf = buffer.slice( pointer, pointer + size )
		let str

		try {
			str = dec.decode( buf )
		} catch ( e ) {
			if ( type == 'utf8' ) throw 'ファイル名の解析に失敗しました'
			return strByte( size, 'utf8' )
		}

		pointer += size
		cbit = view.getUint8( pointer )
		return str
	}


	function slice ( size ) {
		if ( offset > 0 ) throw 'UnEx'
		let buf = buffer.slice( pointer, pointer += size )
		cbit = view.getUint8( pointer )
		return buf
	}


	function readAreas ( files ) {

		//if ( files.length == 2 ) return

		let signature = byte( 4 )

		// $.log( signature.toString( 16 ) )

		switch ( signature ) {

			case 0x04034B50: { // file header
				let file = { }
				files.push( file )
				readLocalFileHeader( file )

				/*
				let blob = new Blob( [ file.data ], { type: 'image/jpeg' } )
				file.blob = blob
				let url = URL.createObjectURL( file.blob )
				let img = new Image
				img.src = url
				document.body.appendChild( img )
				*/

			} break
			case 0x02014B50: { // directory header
				return
			} break
			case 0x06054B50: { // end record
				return
			} break
			case 0x08074B50: { // file_descriptor
				byte( 12 )
			} break
			default : {
				throw 'UnEx'
			}

		}


		readAreas( files )

	}


	function readLocalFileHeader ( file ) {

		file.version = byte( 2 )

		byte( 2 )

		file.deflate = byte( 2 ) == 8

		let time = `${ bit16( 5 ) }:${ bit16( 6 ) }:${ bit16( 5 ) * 2 }`
		let date = `${ bit16( 7 ) + 1980 }/${ bit16( 4 ) }/${ bit16( 5 ) }`

		let crc32 = byte( 4 )

		file.compressedSize = byte( 4 )
		file.originalSize = byte( 4 )

		let nameLength = byte( 2 )

		let extrasLength = byte( 2 )  // extra field length

		file.name = strByte( nameLength )

		readExtraField( file, extrasLength )

		readFileData( file )

	}


	function readExtraField ( file, length ) {

		if ( length <= 0 ) return

		let extra = { }

		extra.id = byte( 2 )					// header id

		let type = {
			0x0001: '* Zip64 information',
			0x5455: '* timestamp',
			0x7875: '* Unix UIDs/GIDs',
		}[ extra.id ]

		file[ type || `* ${ extra.id }` ] = extra

		extra.size = byte( 2 )					// data size

		byte( extra.size )

		readExtraField( file, length - 2 - 2 - extra.size )

	}


	function readFileData ( file ) {


		if ( ! file.deflate ) {

			file.data = new Uint8Array( slice( file.originalSize ) )

		} else {

			//let p = pointer

			file.data = new Uint8Array( file.originalSize )

			readDeflate( file.data )

			//pointer = p + file.compressedSize

		}

		let ext = ( file.name.match( /\.([^.]+)$/ ) || [ ,'' ] )[ 1 ]
		file.type = Ext2MIME[ ext ] || ''
		//file.data = new File( [ data ], file.name, { type } )


	}


	function readDeflate ( buf, p = 0 ) {

		let final = !! bit1( )

		let type = bitU( 2 )

		//try{
		switch ( type ) {
			case 0: {
				//if ( offset > 3 ) {
				//	pointer ++
				//	offset = 3
				//}
				bitU( ( 8 - offset ) % 8 )
				let size = byte( 2 )
				//deflate.sizeNot = byte( 2 )
				//deflate.sizeSafe = deflate.size == ~ deflate.sizeNot & 0xFFFF
				if ( size != ( ~ byte( 2 ) & 0xFFFF ) ) throw 'UnEx'

				for ( let i = 0; i < size; i++, p++ ) {
					buf[ p ] = byte( 1 )
				}

			} break
			case 1: {
				p = readFixedHuffman( buf, p )

			} break
			case 2: {
				p = readDynamicHuffman( buf, p )

			} break
			case 3: {
				throw 'UnEx'
				//return
			} break
		}
		//}catch(e){
		//	$.log( file, deflate )
		//	throw e
		//}
		//$.log( file, deflate )


		if ( final ) {
			if ( offset > 0 ) {
				pointer ++
				offset = 0
				cbit = view.getUint8( pointer )
			}
		} else return readDeflate ( buf, p )

	}


	function readDynamicHuffman ( buf, p ) {

		const DBG = false

		//if ( DBG ) $.log( buf )
		// function $chkbits ( n ) {
		// 	let a = [ ]
		// 	for( let i = 0; i < n; i ++ ) a.push( bit1( ) )
		// 	if ( DBG ) $.log( 'chkbits' ); if ( DBG ) $.log( a )
		// 	return
		// }

		let buflen = buf.byteLength

		//let pure = new Uint16Array( buf.length ), z = 0, lim = 10

		//setTimeout( ( ) => if ( DBG ) $.log( pure.slice( 0, lim ), buf.slice( 0, lim ), FixedHuffmanTable ), 0 )

		let baseRepTLen = bitU( 5 ) + 257
		let baseDisTLen = bitU( 5 ) + 1
		let baseTofTlen = bitU( 4 ) + 4
		let baseTofTmax = 0, TofTlen = 1
		let baseTofT = new Uint8Array( 19 )

		if ( DBG ) $.log( baseRepTLen, baseDisTLen, baseTofTlen )

		for ( let i = 0; i < baseTofTlen; i ++ ) {
			let j = [ 16 ,17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15 ][ i ]
			let s = bitU( 3 )
			baseTofT[ j ] = s
			//if ( DBG ) $.log ( j, s )
			if ( s > baseTofTmax ) {
				baseTofTmax = s
				TofTlen = ( 2 << s ) - 2
			}
		}

		let X = (a,b,z)=>{
			let m = new Map
			for (let [k,v]of a.entries()) {
				let n=k+2, b=(Math.log2(n))|0, i=n-(1 << b)
				if(v!=z)m.set(('0'.repeat(16)+i.toString(2)).slice(-b),v)
			}
			return m
		}

		let [ TofT, lower ] = decodeBase( TofTlen, baseTofT, 7 )

		if ( DBG ) $.log( baseTofT, TofT, X( TofT, baseTofT, 255 ) )
		//return $chkbits( 100 )

		let repT = createBase( baseRepTLen, TofT, lower, baseTofTmax )

		let disT = createBase( baseDisTLen, TofT, lower, baseTofTmax )


		//$chkbits(100)

		//return


		W: while ( true ) {

			if ( p % 1000000 == 0 ) if ( DBG ) $.log( p / 1000000 + 'MB', buflen )

			if ( p > buflen ) throw 'UnEx'

			//if ( p >= lim ) return if ( DBG ) $.log( pure.slice( 0, lim ), buf.slice( 0, lim ) )

			//for ( let i = 0; i < 20; i ++ ) if ( DBG ) $.log( bit1( ) )
			//offset -= 20; while ( offset < 0 ) { offset += 8 ; pointer -- }
			//let tmp = [ ]
			let n = 65535
			for ( let j = 1, b = 0; j <= 15; j ++ ) {
				b = bit1( ) | ( b << 1 )
				//b = b | ( bit1( ) << ( j - 1 ) )
				//if ( j < lower ) continue
				n = repT[ b + ( 1 << j ) - 2 ]
				//tmp.push(b.toString(2))

				if ( n !== 65535 ) break
			}
			if ( n === undefined ) throw 'wtf!'
			if ( n == 65535 ) throw 'wtf'
			//if ( DBG ) $.log('rep',tmp)
			/*
			if ( n <= 0b0010111 ) {
				m = n + 256
			} else {
				n = ( n << 1 ) | bit1( )
				if ( 0b00110000 <= n && n <= 0b10111111 ) {
					m = n - 0b00110000
				} else if ( 0b11000000 <= n && n <= 0b11000111 ) {
					m = n - 0b11000000 + 280
				} else {
					n = ( n << 1 ) | bit1( )
					m = n - 0b110010000 + 144
				}
			}
			*/

			//pure[ z ++ ] = n
			let m = n
			//if ( DBG ) $.log(m)
			if ( m <= 255 ) {
				buf[ p ] = m
				p ++
			} else if ( m == 256 ) {
				break W
			} else {

				let len = FixedHuffmanTable.repeat.len[ m - 257 ]
					+ bitU( FixedHuffmanTable.repeat.ex[ m - 257 ] )

				//let tmp = []
				let c = 65535
				for ( let j = 1, b = 0; j <= 15; j ++ ) {
					b = bit1( ) | ( b << 1 )
					//b = b | ( bit1( ) << ( j - 1 ) )
					//if ( j < lower ) continue
					c = disT[ b + ( 1 << j ) - 2 ]
					//tmp.push(b.toString(2))
					if ( c !== 65535 ) break
				}
				if ( c == 65535 ) throw 'wtf'
				if ( c === undefined ) throw 'wtf!'
					//if ( DBG ) $.log('dis',tmp)

				let dis = FixedHuffmanTable.distance.dis[ c ]
					+ bitU( FixedHuffmanTable.distance.ex[ c ] )

				//if ( DBG ) $.log( c, `dis:${dis}`, `len:${len}` )

				for ( let q = p, i = 0; i < len; i ++ ) {

					buf[ p ] = buf[ q - dis + ( i % dis ) ]
					p ++
				}

			}
			//if ( DBG ) $.log( new TextDecoder( ).decode( buf ) )



		}

		return p



		function decodeBase ( len, base, upper ) {
			let baseLen = base.length, lower = 0
			let table = new ( upper <= 7 ? Uint8Array : Uint16Array )( len ).fill( -1 )
			for ( let i = 1, t = 0; i <= upper; i ++ ) {
				for ( let j = 0; j < baseLen; j ++ ) {
					let s = base[ j ]
					//if ( i == 4 && max == 7 && s == i ) if ( DBG ) $.log( t.toString(2) )
					if ( s == i ) {
						//if ( DBG ) $.log( t.toString( 2 ), s, t )
						//if ( t != 0 && t < ( 1 << ( i - 1 ) ) ) if ( DBG ) $.log( 'min!' )
						if ( table[ t + ( 1 << i ) - 2 ] === undefined ) if ( DBG ) $.log( 'over!', len, t, ( 1 << i ) - 2 )
						table[ t + ( 1 << i ) - 2 ] = j
						t ++
						if ( lower == 0 ) lower = i
					}
				}
				t = t << 1
				//if ( t != 0 && t < ( 1 << i ) ) t = 1 << i
			}
			return [ table, lower ]
		}


		function createBase ( len, base, lower, upper ) {
			let table = new Uint8Array( len ), max = 0
			for ( let i = 0; i < len; i ++ ) {
				let b = 0, c = 255, j
				for ( j = 1; j <= upper; j ++ ) {
					b = bit1( ) | ( b << 1 )
					//tmp.push( [('0'.repeat(upper)+b.toString(2)).slice(-j),b] )
					//b = b | ( bit1( ) << ( j - 1 ) )
					if ( j < lower ) continue
					c = base[ b + ( 1 << j ) - 2 ]
					if ( c === undefined ) throw 'wtf!'
					if ( c != 255 ) break
				}
				if ( c == 255 ) throw `o'f' b:${b} j:${j} i:${i}`
				//if ( DBG ) $.log(c)
				if ( c >= 16 ) {
					let ex = 0, before = 0
					if      ( c == 16 ) ex = bitU( 2 ) + 3, before = table[ i - 1 ]
					else if ( c == 17 ) ex = bitU( 3 ) + 3
					else if ( c == 18 ) ex = bitU( 7 ) + 11
					//if ( DBG ) $.log( c, ex )
					for ( let j = 0; j < ex; j ++ ) {
						table[ i ++ ] = before
					}
					i --
				} else {
					table[ i ] = c
					if ( c > max ) max = c
				}
			}

			//if ( DBG ) $.log('max',max,(2<<max)-2)

			let newT = decodeBase( ( 2 << max ) - 2, table, 15 ) [ 0 ]

			if ( DBG ) $.log( table, newT, X( newT, table, 65535 ) )

			return newT
		}

	}


	function readFixedHuffman ( buf, p ) {

		//$.log( buf )

		let buflen = buf.byteLength

		//let pure = new Uint16Array( buf.length ), z = 0, lim = 10

		//setTimeout( ( ) => $.log( pure.slice( 0, lim ), buf.slice( 0, lim ), FixedHuffmanTable ), 0 )

		W: while ( true ) {

			if ( p % 1000000 == 0 ) $.log( p / 1000000 + 'MB', buflen )

			if ( p >= buflen ) {
				if ( bitD( 7 ) == 0 ) break W
				throw 'UnEx'
			}

			//if ( p >= lim ) return $.log( pure.slice( 0, lim ), buf.slice( 0, lim ) )

			let m = 0
			//for ( let i = 0; i < 20; i ++ ) $.log( bit1( ) )
			//offset -= 20; while ( offset < 0 ) { offset += 8 ; pointer -- }
			let n = bitD( 7 )


			if ( n <= 0b0010111 ) {
				m = n + 256
			} else {
				n = ( n << 1 ) | bit1( )
				if ( 0b00110000 <= n && n <= 0b10111111 ) {
					m = n - 0b00110000
				} else if ( 0b11000000 <= n && n <= 0b11000111 ) {
					m = n - 0b11000000 + 280
				} else {
					n = ( n << 1 ) | bit1( )
					m = n - 0b110010000 + 144
				}
			}

			//pure[ z ++ ] = n

			if ( m <= 255 ) {
				buf[ p ] = m
				p ++
			} else if ( m == 256 ) {
				break W
			} else {

				let len = FixedHuffmanTable.repeat.len[ m - 257 ]
					+ bitU( FixedHuffmanTable.repeat.ex[ m - 257 ] )

				let c = bitD( 5 )
				let dis = FixedHuffmanTable.distance.dis[ c ]
					+ bitU( FixedHuffmanTable.distance.ex[ c ] )

				//$.log( c, dis, len )

				for ( let q = p, i = 0; i < len; i ++ ) {

					buf[ p ] = buf[ q - dis + ( i % dis ) ]
					p ++
				}

			}

		}

		return p

	}

}
