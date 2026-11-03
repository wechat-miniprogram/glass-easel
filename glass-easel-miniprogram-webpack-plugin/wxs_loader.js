// The script content is collected by the plugin (through `addWxs`) and
// compiled into the template group. Nothing needs to be exported here.
module.exports = function (src) {
  const { addWxs } = this.query
  addWxs(src)
  return 'module.exports = ""'
}
