/*
These codes are licensed under CC0.
http://creativecommons.org/publicdomain/zero/1.0
*/

import * as $ from './ヘルパー.js'
import * as Sound from './サウンド.js'

let ctx = null

let [ W, H ] = [ 1, 1 ]

let layerRoot = null

let HRCanvas = //new OffscreenCanvas( W, H, { alpha: false } )
	document.createElement( 'canvas' )

let HRCtx = HRCanvas.getContext( '2d', { alpha: false } )

async function init ( opt ) {

	ctx = opt.ctx || ctx
	return await initLayer( )
}


export let { target: initRanderer, register: nextInit } = new $.AwaitRegister( init )



class Node {

	constructor ( opt ) {

		const def = { name: 'undefined', x: 0, y: 0, w: 1, h: 1, o: 1,
			fill: '', stroke: '', shadow: true, listenerMode: '', children: new Set,
			awaiter: new $.Awaiter, sound: false }

		Object.assign( this, def, opt )

		for ( let [ key, look ] of [ [ 'x', 'w' ], [ 'y', 'h' ] ] ) {
			let val = this[ key ]
			if ( ! Number.isFinite( val ) ) continue
			if ( 1 / val < 0 ) {
				this[ key ] = val = 1 - this[ look ] + val
				if ( val < 0 || Object.is( val, -0 ) || 1 < val )
					$.warn( `"${ val }" 不正な範囲の数値です` )
			}
		}

		if ( this.sound ) {
			setSound( { node: this, type: 'enter', name: 'フォーカス.ogg' } )
			setSound( { node: this, type: 'click', name: 'クリック.ogg' } )
			async function setSound ( { node, type, name } ) {
				await node.on( type )
				Sound.playSysEffect( name )
				setSound ( { node, type, name } )
			}
		}

		let on, off
		off = ( ) => { this.forcused = false; this.on( 'enter' ).then( on ) }
		on = ( ) => { this.forcused = true;  this.on( 'leave' ).then( off ) }
		off( )

	}

	prop ( key, val ) {
		this[ key ] = val
		layerRoot.dirty = true
	}

	draw ( ) { }


	drawHR ( { x, y, w, h }, style ) {

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

	fire ( type ) {

		//$.log( 'fire', type )
		if ( type == 'click' && this.event ) layerRoot.fire( this.event )
		this.awaiter.fire( type, true )

	}

	on ( type ) {

		return this.awaiter.on( type )

	}


	show ( ) { this.prop( 'o', 1 ) }

	hide ( ) { this.prop( 'o', 0 ) }

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

	draw ( { x, y, w, h } ) {

		let { fill, shadow, forcused, pushed, listenerMode } = this

		let offset = H * .01

		if ( fill ) {
			if ( pushed ) {
				ctx.filter = 'brightness(50%)'
				x += offset, y += offset
			} else {
				if ( shadow ) setShadow( { offset, alpha: .5 } )
				if ( forcused && listenerMode == 'opaque' ) ctx.filter = 'brightness(150%)'
			}
			ctx.fillStyle = fill
			ctx.fillRect( x, y, w, h )

		}

	}

}


export class PolygonNode extends Node {

	draw ( { x, y, w, h } ) {

		let { fill, shadow, path, forcused, pushed, listenerMode } = this

		let offset = H * .01

		if ( fill ) {
			if ( pushed ) {
				ctx.filter = 'brightness(50%)'
				x += offset, y += offset
			} else {
				if ( shadow ) setShadow( { offset, alpha: .5 } )
				if ( forcused && listenerMode == 'opaque' ) ctx.filter = 'brightness(150%)'
			}
			ctx.beginPath( )
			for ( let [ l, t ] of path ) ctx.lineTo( x + w * l, y + h * t )
			ctx.fillStyle = fill
			ctx.fill( )

		}


	}

	drawHR ( { x, y, w, h }, style ) {

		HRCtx.fillStyle = style
		HRCtx.beginPath( )
		for ( let [ l, t ] of this.path ) HRCtx.lineTo( x + w * l, y + h * t )
		HRCtx.fill( )

	}

}


export class TextNode extends Node {

	constructor ( opt ) {
		const def = { size: 0, text: '', pos: 'start', rotate: 0 }
		opt = Object.assign( def, opt )
		super ( opt )
	}

	set( text ) { this.prop( 'text', text ) }

	draw ( { x, y, w, h } ) {
		let { fill, shadow, text, size, pos, rotate } = this

		ctx.font = `${ h * size }px "Hiragino Kaku Gothic ProN", Meiryo`
		ctx.textBaseline = 'top'
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
			ctx.fillText( text, x, y, w - b )

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

		for ( let { text, mag = 1, bold = false, color = this.fill, row = 0 } of this.decoList ) {
			if ( preRow != row ) xBuf = 0
			preRow = row
			let size = this.size * mag
			ctx.font = `${ bold ? 'bold' : '' } ${ h * size }px "Hiragino Kaku Gothic ProN", Meiryo`
			ctx.textBaseline = 'top'

			let b = ( h *  size )  * .025 + 2.5

			setShadow( { offset: b } )
			ctx.fillStyle = color
			ctx.fillText( text, x + xBuf, y + ( row * h * size * 1.4 ) )
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

	draw ( { x, y, w, h } ) {
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
				type: GroupNode, name: 'portraitGroup'
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
					{
						type: GroupNode, name: 'iconGroup',
						children: [
							{
								type: PolygonNode, name: 'menuBotton', listenerMode: 'opaque',
								fill: 'rgba( 255, 200, 200, .25 )', event: 'menu',
								path: [ [ .005, .25 ], [ .005, .96 ], [ .145, .96 ] ], sound: true
							},
							{
								type: TextNode, name: 'openMenuText',
								y: .2, w: .165, fill: 'rgba( 255, 255, 255, .5 )', text: 'open menu',
								pos: 'center', size: .15, rotate: 35
							}
						]
					}
				]
			},
			{
				type: RectangleNode, name: 'inputBox',
				fill: 'rgba( 255, 255, 255, 0 )',
				children: [
					{
						type: RectangleNode, name: 'inputSubBox', listenerMode: 'block',
						o: 0, x: .1, y: .05, w: .8, h: .65, fill: 'rgba( 75, 75, 100, .5 )'
					}
				]
			},
			{
				type: RectangleNode, name: 'menuBox', listenerMode: 'block',
				o: 0, fill: 'rgba( 255, 255, 255, 0 )',
				children: [
					{
						type: RectangleNode, name: 'menuSubBox',
						o: 0, x: .1, y: .05, w: .8, h: .65, fill: 'rgba( 75, 75, 100, .5 )'
					},
					{
						type: PolygonNode, name: 'backBotton', listenerMode: 'opaque',
						x: 0, y: .05, w: .1, h: .65, o: 0, fill: 'rgba( 100, 100, 255, .8 )',
						path: [ [ .9, .2 ], [ .1, .5 ], [ .9, .8 ] ], sound: true
					},
				]
			},
		]
	}, layerRoot )

	$.log( layerRoot )

	return layerRoot
}


export function drawCanvas ( ) {

	if ( ! ctx ) return

	if ( layerRoot.dirty ) {

		let rect = ctx.canvas.getBoundingClientRect( )
		ctx.canvas.width = W = rect.width
		ctx.canvas.height = H = rect.height

		ctx.fillColor = 'rgba( 0, 0, 0, 1 )'
		ctx.fillRect( 0, 0, W, H )
		draw( layerRoot, { x: 0, y: 0, w: W, h: H, o: 1 } )
		layerRoot.dirty = false

	}

	function draw ( node, base ) {

		if ( node.o == 0 ) return

		let prop = {
			x: base.x + node.x * base.w,
			y: base.y + node.y * base.h,
			w: base.w * node.w,
			h: base.h * node.h,
			o: base.o * node.o,
		}

		//$.log( node.name, prop )

		ctx.globalAlpha = prop.o

		ctx.save( )
		node.draw( prop )
		ctx.restore( )
		for ( let childnode of node.children ) { draw( childnode, prop ) }
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
				if( ! pointer.delete( node ) ) node.fire( 'enter' )
			} break
			case 'down': {
				node.fire( 'down' )
				timers.set( node, new $.Time )
			} break
			case 'up': {
				node.fire( 'up' )
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
			for ( let p of pointer ) p.fire( 'leave' )
		} break
		case 'up': {
			for ( let p of pointer ) p.fire( 'up' )
		} break
	}

	pointers[ type == 'move' ? 'move' : 'click' ] = newPointer

}


function drawHRCanvas( ) {

	let rect = ctx.canvas.getBoundingClientRect( )
	HRCanvas.width = W = rect.width
	HRCanvas.height = H = rect.height

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
			ctx.save( )
			node.drawHR( prop, `rgb(${ id/256**2|0 }, ${ (id/256|0)%256 }, ${ id%256 })` )
			ctx.restore( )
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
