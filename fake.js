const crypto = require('crypto')
const tradleUtils = require('@tradle/engine').utils
const { isInlinedProperty } = require('@tradle/validate-resource').utils
const { setVirtual } = require('./utils')
const TYPE = '_t'
const SIG = '_s'

module.exports = fakeResource

function fakeResource ({ models, model, signed }) {
  const type = model.id
  const data = {}
  if (type) data[TYPE] = type

  const props = model.required || Object.keys(model.properties)
  props.forEach(propertyName => {
    if (propertyName.charAt(0) === '_' || propertyName === 'from' || propertyName === 'to') return

    data[propertyName] = fakeValue({
      models,
      model,
      propertyName
    })
  })

  if (signed) {
    if (!data[SIG]) {
      data[SIG] = randomString(100)
    }

    const link = data._link || tradleUtils.hexLink(data)
    setVirtual(data, {
      _link: data._link || link,
      _permalink: data._permalink || link,
      _author: data._author || randomString()
    })
  }

  return data
}

function newFakeData ({ models, model }) {
  model = typeof model === 'string'
    ? models[model]
    : model

  if (!model) throw new Error('model not found')

  const type = model.id
  const data = {}
  if (type) data[TYPE] = type

  const props = model.required || Object.keys(model.properties)
  props.forEach(propertyName => {
    if (propertyName.charAt(0) === '_' || propertyName === 'from' || propertyName === 'to') return

    data[propertyName] = fakeValue({ models, model, propertyName })
  })

  return data
}

function fakeValue ({ models, model, propertyName }) {
  const prop = model.properties[propertyName]
  const ref = prop.ref || (prop.items && prop.items.ref)
  const range = models[ref]
  const { type } = prop
  const inlined = isInlinedProperty({ models, property: prop })
  switch (type) {
    case 'string':
      return randomString()
    case 'number':
      return Math.random() * 100 | 0
    case 'date':
      return Date.now()
    case 'enum':
      return firstValue(randomElement(prop.oneOf))
    case 'object':
      if (range && range.subClassOf === 'tradle.Enum') {
        if (range.enum) {
          let val = randomElement(range.enum)
          return {
            id: `${ref}_${val.id}`,
            title: val.title
          }
        }
      }

      if (!ref) return {}

      if (inlined) {
        return fakeResource({ models, model: range, signed: !range.inlined })
      }

      return fakeResourceStub({
        models,
        model: range
      })
    case 'boolean':
      return Math.random() < 0.5
    case 'array':
      if (!ref) return []

      if (inlined) {
        return [
          fakeResource({ models, model: range, signed: range.inlined })
        ]
      }

      return [
        fakeResourceStub({
          models,
          model: models[ref]
        })
      ]
      // const resource = fakeValue({ models, model })
      // let value
      // if (ref && !prop.inlined) {
      //   value = buildId({ model, resource })
      // } else {
      //   value = resource
      // }

      // return [value]
    default:
      throw new Error(`unknown property type: ${type} for property ${propertyName}`)
  }
}

function fakeResourceStub ({ models, model }) {
  const modelId = model.id
  if (modelId === 'tradle.Money') {
    return {
      // [TYPE]: 'tradle.Money',
      "value": "6000",
      "currency": "€"
    }
  }

  if (modelId === 'tradle.Phone') {
    return {
      // [TYPE]: 'tradle.Phone',
      phoneType: fakeResourceStub({
        models,
        model: models['tradle.PhoneTypes']
      }),
      number: '3456789'
    }
  }

  const _link = randomString()
  return {
    _t: modelId,
    _link,
    _permalink: _link,
    _displayName: `${modelId} fake title`
  }
}

function randomString () {
  return crypto.randomBytes(32).toString('hex')
}

function randomElement (arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function firstValue (obj) {
  for (let key in obj) {
    return obj[key]
  }
}
