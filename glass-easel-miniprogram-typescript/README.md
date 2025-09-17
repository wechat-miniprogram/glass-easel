# glass-easel-miniprogram-typescript

An extra TypeScript checker for mini-program code running in glass-easel.

Refer to the [glass-easel](https://github.com/wechat-miniprogram/glass-easel) project for further details.

## Features

If the component is written in TypeScript, this tool can do some type-checking on expressions inside WXML.

Firstly, the component `.ts` must export the component as default. For example:

```ts
export default Component({
  data: {
    hello: 'world',
  },
})
```

Then in `.wxml` :

```xml
<div>{{ hello }}</div>

<!-- This tool will report type errors like -->
<div>{{ heloo }}</div> <!-- Error: 'heloo' does not exist -->
```

This tool is based on TypeScript (a.k.a. `tsserver` ) for type-checking.

Note that it only report errors in component WXML files. For type errors in TS files, you should run standard TypeScript commands.

## Usage

After install this module, the `miniprogram-typescript-check` tool should be available.

See all options: `npx miniprogram-typescript-check --help`

In most cases, this command is suggested: `npx miniprogram-typescript-check -p [PATH_TO_SRC]`
