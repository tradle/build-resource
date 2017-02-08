// const typeforce = require('typeforce')
const { utils, constants } = require('@tradle/engine')
const {
  TYPE,
  PERMALINK,
  LINK,
  SIG
} = constants

exports = module.exports = validateResource
exports.resource = validateResource
exports.property = validatePropertyValue

function validateResource ({ models, model, resource }) {
  const {
    properties={},
    required=[]
  } = model

  assert(resource[TYPE] === model.id, `expected resource[${TYPE}] to equal ${model.id}`)
  required.forEach(p => {
    assert(p in resource, `expected required property "${p}"`)
  })

  Object.keys(properties).forEach(p => {
    const prop = properties[p]
    if (p in resource) {
      validatePropertyValue({ models, model, propertyName: p, value: resource[p] })
    }
  })
}

function validateType (opts) {
  const { models, model, propertyName, value } = opts
  const prop = model.properties[propertyName]
  switch (prop.type) {
    case 'boolean':
      assert(typeof value === 'boolean', `expected boolean "${propertyName}"`)
      break
    case 'string':
    case 'enum':
      assert(typeof value === 'string', `expected string "${propertyName}"`)
      break
    case 'number':
      assert(typeof value === 'number', `expected number "${propertyName}"`)
      break
    case 'date':
      assert(!isNaN(new Date(value).getTime()), `expected date "${propertyName}"`)
      break
    case 'object':
      validateObjectPropertyValue(opts)
      break
    case 'array':
      validateArrayPropertyValue(opts)
      break
  }
}

function validateObjectPropertyValue ({ models, model, propertyName, value }) {
  const prop = model.properties[propertyName]
  const { id, title } = value
  const { type } = parseId(id)
  assert(value && typeof value === 'object', `expected "object" ${propertyName}`)
  const ref = prop.ref || prop.items.ref
  if (!ref) return

  const valueModel = models[type]
  if (valueModel.isInterface || valueModel.abstract) {
    throw new Error(`${valueModel.id} is not instantiable`)
  }

  try {
    validateId({ models, id })
  } catch (err) {
    throw new Error(`${propertyName}.id is invalid: ${err.message}`)
  }

  assert(typeof title === 'string' || typeof title === 'undefined', 'expected string "title"')
}

function validateArrayPropertyValue ({ models, model, propertyName, value }) {
  const prop = model.properties[propertyName]
  value.forEach((item, i) => {
    if (prop.inlined) {
      return validateResource({
        models,
        model: models[prop.ref || prop.items.ref],
        resource: item
      })
    }

    console.warn(`TODO: validate array property ${propertyName} of ${model.id}`)
    validateObjectPropertyValue({
      models,
      model,
      propertyName,
      value: item
    })
  })
}

function validatePropertyValue ({ models, model, propertyName, value }) {
  validateType({ models, model, propertyName, value })
}

function validateId ({ models, id }) {
  if (typeof id !== 'string') {
    throw new Error('expected string "id"')
  }

  const { type, permalink, link } = parseId(id)
  if (models && !models[type]) {
    throw new Error('unknown model')
  }

  ;[link, permalink].forEach(str => {
    if (str && str.length !== 64) {
      throw new Error('object links are 32 bytes long')
    }
  })
}

function parseId (id) {
  const [type, permalink, link] = id.split('_')
  return { type, permalink, link }
}

function assert (statement, err) {
  if (!statement) throw new Error(err || 'assertion failed')
}
