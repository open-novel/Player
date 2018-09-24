/*
These codes are licensed under CC0.
http://creativecommons.org/publicdomain/zero/1.0
*/

import * as $ from './ヘルパー.js'
import * as Sound from './サウンド.js'

let ctx = null
let DPCanvas = null

let [ W, H ] = [ 1, 1 ]

let layerRoot = null, colorProfile = null

let HRCanvas =window.OffscreenCanvas ?
	new OffscreenCanvas( W, H, { alpha: false } ) : document.createElement( 'canvas' )

let HRCtx = HRCanvas.getContext( '2d', { alpha: false } )
HRCtx.translate( 0.5, 0.5 )

async function init ( opt ) {

	ctx = opt.ctx || ctx
	DPCanvas = ctx.canvas
	return await initLayer( )
}

export function toBlob( hiquality ) {
	return new Promise( ok => DPCanvas.toBlob( ok,
		hiquality ? 'image/webp' : undefined,
		hiquality ? 1 : undefined
	) )
}

export let { target: initRanderer, register: nextInit } = new $.AwaitRegister( init )


async function anime ( elem, type1, duration = 100 ) {

	if ( ! [ 'show', 'hide' ].includes( type1 ) ) return $.error( 'UnEx' )

	let type2 = type1 == 'show' ? 'hide' : 'show'

	if ( elem.animeType == type1 ) return

	if ( elem.animeType == type2 ) {
		elem.animeType = 'stop'
		while ( elem.animeType == 'stop' ) {
			await layerRoot.on( 'update' )
		}
	}

	elem.animeType = type1
	let time = new $.Time( duration )
	let base = elem.o

	while ( elem.animeType == type1 ) {
		let prog = time.progress( )
		//$.log( type1, prog )
		let o = type1 == 'show' ? base + ( 1 - base ) * prog : base - base * prog
		elem.prop( 'o', o )
		if ( prog == 1 ) break
		await layerRoot.on( 'update' )

	}

	if ( elem.animeType != type2 ) elem.animeType = 'none'

}


class Node {

	constructor ( opt ) {

		const def = { name: 'undefined', x: 0, y: 0, w: 1, h: 1, o: 1,
			fill: '', stroke: '', shadow: true, listenerMode: '', children: new Set,
			awaiter: new $.Awaiter, sound: false, animeType: 'none' }

		Object.assign( this, def, opt )

		$.normalizePos( this )

		if ( this.sound ) {
			setSound( { node: this, type: 'enter', name: 'フォーカス.ogg' } )
			setSound( { node: this, type: 'click', name: 'クリック.ogg' } )
			async function setSound ( { node, type, name } ) {
				await node.on( type )
				Sound.playSysEffect( name )
				setSound ( { node, type, name } )
			}
		}

		this.forcused = false
		this.pushed = false

	}

	prop ( key, val ) {
		this[ key ] = val
		layerRoot.dirty = true
	}

	draw ( ) { }


	drawHR ( { x, y, w, h }, style ) {

		//$.warn( 'drawHRデフォルト動作が呼ばれました' )
		HRCtx.fillStyle = style
		HRCtx.fillRect( x, y, w, h )

	}

	append ( node ) {

		node.parent = this
		this.children.add( node )

		let that = this
		do {
			that[ node.name ] = that[ node.name ] === undefined ?
				node : /*$.info( `"${ node.name }"　同名のノードが同時に定義されています` ) ||*/ null
			that = that.parent
		} while ( that )

		layerRoot.dirty = true

	}

	removeChildren ( ) {

		for ( let node of this.children ) { node.remove( ) }

	}

	remove ( ) {

		let that = this.parent
		while ( that ) {
			that[ this.name ] = undefined
			that.children.delete( this )
			that = that.parent
		}
		this.parent = null

		layerRoot.dirty = true

	}

	reborn( ) {

		let parent = this.parent
		this.remove( )
		let node = new this.constructor( Object.assign( { }, this ) )
		parent.append( node )
		return node

	}

	fire ( type ) {

		//$.log( 'fire', type )
		if ( type == 'click' && this.event ) layerRoot.fire( this.event )
		this.awaiter.fire( type, true )

	}

	on ( type ) {

		return this.awaiter.on( type )

	}


	show ( duration ) {

		return anime( this, 'show', duration )

	}

	hide ( duration ) {

		return anime( this, 'hide', duration )

	}

	searchImg ( src ) {

		for ( let node of this.children ) {
			if ( node.img.src == src ) return node
		}
		return null

	}

	hasOtherChildren ( targets ) {

		for ( let node of this.children ) {
			if ( ! targets.includes( node ) ) return true
		}
		return false
	}

}


export class GroupNode extends Node {

}


export class RectangleNode extends Node {

	draw ( { x, y, w, h, c } ) {

		let { name, color, fill, shadow, forcused, pushed, listenerMode } = this
		if ( ! fill && c ) fill = c

		let offset = H * .01

		if ( fill ) {
			if ( pushed ) {
				ctx.filter = 'brightness(50%)'
				x += offset / 2, y += offset / 2
			} else {
				if ( shadow ) setShadow( { offset, alpha: .5 } )
				if ( forcused && listenerMode == 'opaque' ) ctx.filter = 'brightness(150%)'
			}

			ctx.fillStyle = fill

			//ctx.fillRect( x, y, w, h )

			const r = 10
			ctx.beginPath( )
			ctx.moveTo( x, y )
			ctx.arcTo( x + w, y, x + w, y + h, r )
			ctx.arcTo( x + w, y + h, x, y + h, r )
			ctx.arcTo( x, y + h, x, y, r )
			ctx.arcTo( x, y, x + w, y, r )
			ctx.fill( )


		}

	}

	drawHR ( { x, y, w, h }, style ) {

		let { pushed } = this

		let offset = H * .01

		if ( pushed ) {
			x += offset / 2, y += offset / 2
		}

		HRCtx.fillStyle = style
		HRCtx.fillRect( x|0, y|0, w|0, h|0 )

	}

}


export class PolygonNode extends Node {

	draw ( { x, y, w, h, c } ) {

		let { fill, shadow, path, forcused, pushed, listenerMode } = this
		if ( ! fill && c ) fill = c

		let offset = H * .01

		if ( fill ) {
			if ( pushed ) {
				ctx.filter = 'brightness(50%)'
				x += offset / 2, y += offset / 2
			} else {
				if ( shadow ) setShadow( { offset, alpha: .5 } )
				if ( forcused && listenerMode == 'opaque' ) ctx.filter = 'brightness(150%)'
			}

			const r = 10
			ctx.beginPath( )
			//for ( let [ l, t ] of path ) ctx.lineTo( x + w * l, y + h * t )
			ctx.moveTo( x + w * path[ path.length-1 ][ 0 ], y + h * path[ path.length-1 ][ 1 ] )
			for ( let i = 0; i < path.length - 1; i++ ) ctx.arcTo( x + w * path[ i ][ 0 ], y + h * path[ i ][ 1 ], x + w * path[ i+1 ][ 0 ], y + h * path[ i+1 ][ 1 ], r )
			ctx.arcTo( x + w * path[ path.length-1 ][ 0 ], y + h * path[ path.length-1 ][ 1 ], x + w * path[ 0 ][ 0 ], y + h * path[ 0 ][ 1 ], r )
			ctx.fillStyle = fill
			ctx.fill( )

		}


	}

	drawHR ( { x, y, w, h }, style ) {

		let { pushed } = this
		let offset = H * .01

		if ( pushed ) {
			x += offset / 2, y += offset / 2
		}

		HRCtx.beginPath( )
		for ( let [ l, t ] of this.path ) HRCtx.lineTo( x + w * l |0, y + h * t |0 )
		HRCtx.fillStyle = style
		HRCtx.fill( )

	}

}


export class TextNode extends Node {

	constructor ( opt ) {
		const def = { size: 0, text: '', pos: 'start', rotate: 0 }
		opt = Object.assign( def, opt )
		super ( opt )
	}

	set ( text ) { this.prop( 'text', text ) }

	clear ( ) { this.prop( 'text', '' ) }

	draw ( { x, y, w, h, c } ) {
		let { fill, shadow, text, size, pos, rotate } = this
		if ( ! fill && c ) fill = c

		ctx.font = `${ h * size }px "Hiragino Kaku Gothic ProN", Meiryo`
		//ctx.textBaseline = 'top'
		ctx.textAlign = pos

		//let b = h * size * .075
		let b = ( h *  size )  * .025 + 2.5

		if ( rotate ) {
			ctx.translate( x, y )
			x = 0, y = 0
			ctx.rotate( rotate * Math.PI / 180 )
		}

		if ( pos == 'center' ) x += w / 2

		if ( fill ) {
			if( shadow ) setShadow( { offset: b } )
			ctx.fillStyle = fill
			ctx.fillText( text, x, y + h * size, w - b )

		}

	}

}


export class DecoTextNode extends Node {

	constructor ( opt ) {
		const def = { size: 0, decoList: [ ], }
		opt = Object.assign( def, opt )
		super ( opt )
	}

	add ( deco ) { this.decoList.push( deco ); layerRoot.dirty = true }

	clear ( ) { this.decoList.length = 0; layerRoot.dirty = true }

	draw ( { x, y, w, h } ) {

		let preRow = 0, xBuf = 0

		for ( let { text, mag = 1, bold = false, color: fill = this.fill, row = 0 } of this.decoList ) {
			if ( preRow != row ) xBuf = 0
			preRow = row
			let size = this.size * mag
			ctx.font = `${ bold ? 'bold' : '' } ${ h * size }px "Hiragino Kaku Gothic ProN", Meiryo`
			//ctx.textBaseline = 'top'

			let b = ( h *  size )  * .025 + 2.5

			setShadow( { offset: b } )
			ctx.fillStyle = fill
			ctx.fillText( text, x + xBuf, y + ( row * h * size * 1.4 ) + h * size / 2 )
			let metrics = ctx.measureText( text )
			xBuf += metrics.width


		}


	}

}


export class ImageNode extends Node {

	constructor ( opt ) {
		const def = { img: null }
		opt = Object.assign( def, opt )
		super ( opt )
		//$.log( { x:this.x, y:this.y, w:this.w, h:this.h } )
	}

	draw ( { ctx, x, y, w, h } ) {
		let { img, fill } = this
		if ( img ) ctx.drawImage( img, x, y, w, h )
		else if ( fill ) {
			ctx.fillStyle = fill
			ctx.fillRect( x, y, w, h )
		}

	}

}



function initLayer ( ) {

	if ( layerRoot ) {
		$.log( 'レイヤールートが更新されました' )
		layerRoot.isDestroyed = true
	}

	layerRoot = new GroupNode( { type: 'Group', name: 'root', listenerMode: 'opaque' } )
	;( function generateNode ( obj, parent ) {

		let type = obj.type, children = obj.children
		delete obj.type, delete obj.children

		if ( ! type ) return $.warn( 'タイプが不明です。' )

		let node = new type( obj )

		if ( parent ) parent.append( node )

		if ( children ) {
			for ( let child of children ) {
				generateNode( child, node )
			}
		}

		return node

	} )( {
		type: GroupNode, name: 'rootSub',
		children: [
			{
				type: ImageNode, name: 'backgroundColor',
				fill: 'rgba( 0, 0, 0, 1 )'
			},
			{
				type: GroupNode, name: 'backgroundGroup',
			},
			{
				type: GroupNode, name: 'portraitGroup', operation: 'separateblend',
			},
			{
				type: RectangleNode, name: 'conversationBox',
				y: .75, h: .25, shadow: false, fill: 'rgba( 0, 0, 100, .5 )',
				children: [
					{
						type: DecoTextNode, name: 'nameArea',
						x: .05, w: .1, y: .2, size: .175, fill: 'rgba( 255, 255, 200, .9 )'
					},
					{
						type: DecoTextNode, name: 'messageArea',
						x: .2, w: .75, y: .2, size: .175, fill: 'rgba( 255, 255, 200, .9 )'
					},
				]
			},
			{
				type: GroupNode, name: 'inputBox',
				//fill: 'rgba( 255, 255, 255, 0 )',
				children: [
					{
						type: RectangleNode, name: 'inputSubBox', listenerMode: 'block',
						o: 0, x: .1, y: .04, w: .8, h: .65,
					}
				]
			},
			{
				type: GroupNode, name: 'menuBox', listenerMode: 'block',
				//fill: 'rgba( 255, 255, 255, 0 )',
				children: [
					{
						type: RectangleNode, name: 'menuSubBox',
						o: 0, x: .1, y: .04, w: .8, h: .65,
					},
				]
			},
			{
				type: GroupNode, name: 'buttonGroup',
				children: [
					{
						type: PolygonNode, name: 'backButton', listenerMode: 'opaque',
						x: 0, y: .03, w: .1, h: .65, o: 0,
						path: [ [ .9, .2 ], [ .1, .5 ], [ .9, .8 ] ], sound: true
					},
					{
						type: PolygonNode, name: 'nextButton', listenerMode: 'opaque',
						x: -0, y: .03, w: .1, h: .65, o: 0,
						path: [ [ .1, .2 ], [ .9, .5 ], [ .1, .8 ] ], sound: true
					},
					{
						type: TextNode, name: 'backLabel',
						x: 0, y: 0.55, w: .1, h: .3,
						pos: 'center', size: .15
					},
					{
						type: TextNode, name: 'currentLabel',
						x: 0.45, y: 0.68, w: .1, h: .3,
						pos: 'center', size: .15
					},
					{
						type: TextNode, name: 'nextLabel',
						x: -0, y: 0.55, w: .1, h: .3,
						pos: 'center', size: .15
					},
				]
			},
			{
				type: GroupNode, name: 'iconGroup',
				children: [
					{
						type: PolygonNode, name: 'menuButton', listenerMode: 'opaque',
						fill: 'rgba( 255, 200, 200, .25 )', event: 'menu',
						path: [ [ .005, .80 ], [ .005, .99 ], [ .133, .99 ] ], sound: true
					},
					{
						type: GroupNode, name: 'menuLabels',
						children: [
							{
								type: TextNode, name: 'open', o: 1,
								y: .785, w: .175, fill: 'rgba( 255, 255, 255, .5 )', text: 'open menu',
								pos: 'center', size: .037, rotate: 40
							},
							{
								type: TextNode, name: 'close', o: 0,
								y: .785, w: .175, fill: 'rgba( 255, 255, 255, .5 )', text: 'close menu',
								pos: 'center', size: .037, rotate: 40
							},
							{
								type: TextNode, name: 'top', o: 0,
								y: .86, w: .1, fill: 'rgba( 255, 255, 255, .5 )', text: '🔝\uFE0E',
								pos: 'center', size: .125
							},
						]
					}
				]
			}
		]
	}, layerRoot )

	$.log( layerRoot )

	colorProfile = {
		blue: {
			$subBox: 'rgba( 75, 75, 100, .5 )',
			inputSubBox: '$subBox',
			menuSubBox: '$subBox',
			$button: 'rgba( 100, 100, 255, .8 )',
			backButton: '$button',
			nextButton: '$button',
			$label: 'rgba( 100, 100, 255, .8 )',
			backLabel: '$label',
			currentLabel: '$label',
			nextLabel: '$label',
			choiceBox: 'rgba( 100, 100, 255, .8 )',
			choiceText: 'rgba( 255, 255, 255, .9 )'
		},
		green: {
			$subBox: 'rgba( 75, 100, 85, .5 )',
			inputSubBox: '$subBox',
			menuSubBox: '$subBox',
			$button: 'rgba( 75, 200, 100, .8 )',
			backButton: '$button',
			nextButton: '$button',
			$label: 'rgba( 75, 200, 100, .8 )',
			backLabel: '$label',
			currentLabel: '$label',
			nextLabel: '$label',
			choiceBox: 'rgba( 75, 200, 100, .8 )',
			choiceText: 'rgba( 255, 200, 255, .9 )'
		}
	}


	return layerRoot
}


let oldTime = performance.now( )
export function drawCanvas ( newTime ) {

	if ( ! ctx ) return

	layerRoot.fire( 'update' )

	if ( layerRoot.dirty || ( newTime - oldTime ) >= 100 ) {

		oldTime = newTime

		refreshCanvasSize( )

		//ctx.fillColor = 'rgba( 0, 0, 0, 1 )'
		ctx.clearRect( 0, 0, W, H )

		if ( $.TEST.mode != 'VR' ) {
			draw( layerRoot, { ctx, x: 0, y: 0, w: W, h: H, o: 1 } )
		} else {
			ctx.save( )
			ctx.scale( 0.5, 1 )
			draw( layerRoot, { ctx, x: 0, y: 0, w: W, h: H, o: 1 } )
			ctx.translate( W, 0 )
			draw( layerRoot, { ctx, x: 0, y: 0, w: W, h: H, o: 1 } )
			ctx.restore( )
		}

		layerRoot.dirty = false

	}

	function draw ( node, base ) {

		if ( node.o == 0 ) return

		let ctx = base.ctx

		let color = node.color || base.color
		let c = ( colorProfile[ color ] && colorProfile[ color ][ node.name ] ) || ''
		if ( c[ 0 ] == '$' ) c = colorProfile[ color ][ c ] || ''
		//if ( c ) $.log( c )
		//if ( colorProfile[ color ] ) $.log( node.name )

		let prop = {
			ctx,
			x: base.x + node.x * base.w,
			y: base.y + node.y * base.h,
			w: base.w * node.w,
			h: base.h * node.h,
			o: base.o * node.o,
			color, c,
		}

		//$.log( node.name, prop )

		ctx.globalAlpha = prop.o

		ctx.save( )
		node.draw( prop )
		ctx.restore( )

		let separateblend = false //node.operation == 'separateblend'

		if ( ! separateblend ) for ( let childnode of node.children ) draw( childnode, prop )
		else {


			let canvas = //new OffscreenCanvas( W, H )
				document.createElement( 'canvas' )
			canvas.width = W, canvas.height = H
			prop.ctx = canvas.getContext( '2d' )

			for ( let childnode of node.children ) draw( childnode, prop )

			let data = prop.ctx.getImageData( 0, 0, W, H ).data

			for ( let i = 0; i < data.length; i +=4 ) {
				let a = data[ i + 3 ] / 255
				if ( a > 0.5 ) a =  1 - ( 1 - a ) ** 4
				data[ i + 3 ] = a * 255
			}

			prop.ctx.putImageData( new ImageData( data, W ), 0, 0 )

			base.ctx.drawImage( canvas , 0, 0 )


			/*
			let separates = [ ]
			for ( let childnode of node.children ) {
				let canvas = //new OffscreenCanvas( W, H )
					document.createElement( 'canvas' )
				canvas.width = W, canvas.height = H
				prop.ctx = canvas.getContext( '2d' )
				separates.push( prop.ctx )
				draw( childnode, prop )
			}

			let buf = new Float64Array( W * H * 4 )

			for ( let ctx of separates ) {
				let data = ctx.getImageData( 0, 0, W, H ).data
				for ( let i = 0; i < data.length; i +=4 ) {
					let r = data[ i ], g = data[ i + 1 ], b = data[ i + 2 ], a = data[ i + 3 ] / 255
					buf[ i ] += r * a, buf[ i + 1 ] += g * a, buf[ i + 2 ] += b * a, buf[ i + 3 ] += a
				}
			}

			for ( let i = 0; i < buf.length; i +=4 ) {
				let r = buf[ i ], g = buf[ i + 1 ], b = buf[ i + 2 ], a = buf[ i + 3 ]
				if ( a > 1 ) { buf[ i ] /= a, buf[ i + 1 ] /= a, buf[ i + 2 ] /= a, buf[ i + 3 ] = 255 }
				else buf[ i + 3 ] *= 255
			}

			let image = new ImageData( new Uint8ClampedArray( buf ), W )

			let canvas2 = //new OffscreenCanvas( W, H )
				document.createElement( 'canvas' )
			canvas2.width = W, canvas2.height = H
			let ctx2 = canvas2.getContext( '2d' )
			ctx2.putImageData( image, 0, 0 )

			ctx.drawImage( canvas2 , 0, 0 )
			*/

		}

	}

}


let pointers = { }, timers = new WeakMap
export function onPoint ( { type, x, y } ) {

	if ( ! ctx ) return

	layerRoot.dirty = true
	//$.log( 'event', type, x, y )

	let list = drawHRCanvas( )

	let d = HRCtx.getImageData( 0, 0, W, H ).data
	let i = ( x + y * W ) * 4
	let id = d[ i ] * 256**2 + d[ i + 1 ] * 256 + d[ i + 2 ]

	let node = list[ id ]
	if ( ! node ) return

	//$.log( type, id, node )
	let newPointer = new Set
	let pointer = pointers[ type == 'move' ? 'move' : 'click' ] || new Set

	W: do {

		if ( ! node.listenerMode ) continue
		if ( node.listenerMode == 'block' ) break

		newPointer.add( node )

		switch ( type ) {
			case 'move': {
				if( pointer.delete( node ) ) break
				node.fire( 'enter' )
				node.forcused = true

			} break
			case 'down': {
				node.fire( 'down' )
				if ( node.forcused ) {
					node.pushed = true
					$.log( node )
				}
				timers.set( node, new $.Time )
			} break
			case 'up': {
				node.fire( 'up' )
				node.pushed = false
				if( pointer.delete( node ) ) {
					let time = timers.get( node ).get( )
					if ( time < 500 ) node.fire( 'click' )
					else { layerRoot.fire( 'menu' ); break W }
				}
			} break
			default : {
				$.error( '期待されていない値' )
			}
		}

		if ( node.listenerMode == 'opaque' ) break

	} while ( node = node.parent )

	switch ( type ) {
		case 'move': {
			for ( let node of pointer ) {
				node.fire( 'leave' )
				node.pushed = false
				node.forcused = false
			}
		} break
		case 'up': {
			for ( let node of pointer ) {
				node.fire( 'up' )
				node.pushed = false
			}
		} break
	}

	pointers[ type == 'move' ? 'move' : 'click' ] = newPointer

}

function refreshCanvasSize( ) {

	let wrapper = DPCanvas.parentElement
	let { width, height } = DPCanvas.getBoundingClientRect( )
	if ( W != width ) {
		//if ( width * 9 > height * 16 ) width = height * 16 / 9 | 0
		DPCanvas.width = HRCanvas.width = W = width | 0
		DPCanvas.height = HRCanvas.height = H = W * 9 / 16 + .5 | 0
		//wrapper.style.width = `${ W }px`
		wrapper.style.height = `${ H }px`
	}

}
function drawHRCanvas( ) {

	refreshCanvasSize( )

	HRCtx.clearRect( 0, 0, W, H )

	let listenerModeList = [ ]

	drawHR( layerRoot, { x: 0, y: 0, w: W, h: H }, 0 )

	function drawHR ( node, base, id ) {

		let prop = {
			x: base.x + node.x * base.w,
			y: base.y + node.y * base.h,
			w: base.w * node.w,
			h: base.h * node.h,
		}

		if (  ! node.o ) return id
		if ( node.listenerMode ) {

			listenerModeList[ ++id ] = node
			//HRCtx.save( )
			node.drawHR( prop, `rgb(${ id/256**2|0 }, ${ (id/256|0)%256 }, ${ id%256 })` )
			//HRCtx.restore( )
			//$.log( 'draw', id, node, listenerModeList )
		}

		for ( let childnode of node.children ) { id = drawHR( childnode, prop, id ) }

		return id
	}

	return listenerModeList

}


function setShadow ( { offset, alpha = .9, blur = 5 } ) {
	ctx.shadowOffsetX = ctx.shadowOffsetY = offset
	ctx.shadowColor = `rgba( 0, 0, 0, ${ alpha } )`
	ctx.shadowBlur = blur
	//ctx.globalCompositeOperation = 'source-atop'
}
