const crypto = require('crypto')
const TYPE = '_t'

module.exports = function fakeResource ({ model }) {
  const type = model.id
  const data = {}
  if (type) data[TYPE] = type

  const props = model.required || Object.keys(model.properties)
  props.forEach(propertyName => {
    if (propertyName.charAt(0) === '_' || propertyName === 'from' || propertyName === 'to') return

    data[propertyName] = fakeValue({ model, propertyName })
  })

  return data
}

function fakeValue ({ model, propertyName }) {
  const prop = model.properties[propertyName]
  const { type } = prop
  switch (type) {
    case 'string':
      return randomString()
    case 'number':
      return Math.random() * 100 | 0
    case 'date':
      return Date.now()
    case 'object':
      if (prop.ref === 'tradle.Money') {
        return {
          "value": "6000",
          "currency": "€"
        }
      } else {
        let link = randomString()
        return {
          id: `${prop.ref}_${link}_${link}`,
          title: ''
        }
      }
    case 'boolean':
      return Math.random() < 0.5
    case 'array':
      return [newFakeData(prop.items.ref || prop.items)]
    default:
      throw new Error(`unknown property type: ${type} for property ${propertyName}`)
  }
}

function randomString () {
  return crypto.randomBytes(32).toString('hex')
}
