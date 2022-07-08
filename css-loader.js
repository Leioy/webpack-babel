const transform = (code) =>
  (code = `
const str = ${JSON.stringify(code)}
if(document){
  const style = document.createElement('style')
  style.innerHTML = str
  document.head.appendChild(style)
}
export default str
`)

module.exports = transform
