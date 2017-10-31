/*
These codes are licensed under CC0.
http://creativecommons.org/publicdomain/zero/1.0
*/

import * as $ from './ヘルパー.js'
import * as Action from './アクション.js'
import * as DB from './データベース.js'

let settings = null


async function init ( { ctx } ) {

	settings = await $.fetchFile( 'json', './プログラム/設定.json' )
	settings.ctx = ctx
	//Object.assign( setting, systemSetting )
	$.log( settings )

	await DB.init( )
	await Action.initAction( settings )

	await play( )


}


async function play ( ) {

	await Action.sysMessage( 'openノベルプレイヤー v1.0α', 1000 )

	while ( true ) {

		let res = await playSystemOpening( ).catch( e => $.error( e ) || 'error' )
		await Action.initAction( settings )

		if ( res == 'error' ) await Action.sysMessage( '問題が発生しました', 50 )
		else await  Action.sysMessage( '再生が終了しました', 50 )


	}
}


async function playSystemOpening ( ) {

	await Action.sysBGImage( './画像/背景.png' )

	Action.sysMessage( '開始する作品を選んで下さい', 50 )

	let titleList = $.parseSetting(
		await $.fetchFile( 'text', '../作品/設定.txt' )
	) [ '作品' ]

	let title = await Action.sysChoices( titleList.map( title => [ title, title ] ) )

	await Action.play( Object.assign( settings, { title } ) )

} 


export let { target: initPlayer, register: nextInit } = new $.AwaitRegister( init )


export function onPointerEvent ( { type, button, x, y } ) {

	Action.onPoint( { type, button, x, y } )
}

export function onKeyEvent ( { type } ) {

	Action.onAction( type )
}


