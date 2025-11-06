import type { ComponentProperties as _GlobalComponentProperties_ } from '../glass-easel-miniprogram-typescript/sample-template-backend-config.d.ts'
import type component from './index'
import type _component_view from './../../components/view/view'
import type _component_image from './../../components/image/image'

type _Component_<P, W, M> = { propertyValues: P, dataWithProperties: W, methods: M }
type _ComponentFieldTypes_<T> = (T & Record<string, never>)['_$fieldTypes']
interface UnknownElement { _$fieldTypes: { propertyValues: Record<string, never>, dataWithProperties: Record<string, never>, methods: Record<string, never> } }

type _Properties_<T> = _ComponentFieldTypes_<T> extends _Component_<infer P, any, any>
? P
: { [k: string]: any }

declare const data: _ComponentFieldTypes_<typeof component> extends _Component_<any, infer W, any>
? W
: { [k: string]: any }

declare const methods: _ComponentFieldTypes_<typeof component> extends _Component_<any, any, infer M>
? M
: { [k: string]: any }

declare const tags: _GlobalComponentProperties_ & {
'view': _Properties_<typeof _component_view>;
'image': _Properties_<typeof _component_image>;
[other: string]: unknown }
export default {}

type _ForIndex_<T> = T extends any[] ? number : T extends { [key: string | symbol]: any } ? string | symbol : number;
type _ForItem_<T> = T extends (infer T)[] ? T : T extends { [key: string | symbol]: infer V } ? V : any;
type _ForKey_<T, N extends string> = N extends "*this" ? _ForItem_<T> : _ForItem_<T> extends { [k: string]: any } ? _ForItem_<T>[N] : unknown;
{const _tag_=tags['view'];{const _tag_=tags['image'];var _string_or_number_:string|number=_tag_.src;var _class_:string="logo";}}{const _tag_=tags['view'];var _class_:string="hello";var _event_:Function=methods.helloTap;}{const _tag_=tags['view'];_tag_.hidden=!data.showAgain;var _class_:string="hello";}