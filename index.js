const clone = require('clone')
const { utils, constants } = require('@tradle/engine')
const validateModels = require('@tradle/validate-model')
const validateModel = validateModels.model
const validateResource = require('@tradle/validate-resource')
const validateResourceProperty = validateResource.property
const {
  TYPE,
  SIG
} = constants

const FORM = 'tradle.Form'
const VERIFICATION = 'tradle.Verification'
const MY_PRODUCT = 'tradle.MyProduct'

module.exports = function builder ({ models, model, resource }) {
  validateModel(model)

  resource = clone({
    [SIG]: '__sigplaceholder__',
    [TYPE]: model.id
  }, resource)

  const api = {
    toJSON
  }

  for (let p in model.properties) {
    api[p] = makeSetter(p)
  }

  return api

  function makeSetter (propertyName) {
    const prop = model.properties[propertyName]
    return function setValue (value) {
      if (typeof value === 'undefined' || value == null) {
        throw new Error(`invalid value ${value} for property ${propertyName}`)
      }

      if (prop.type === 'array' && !prop.inlined) {
        value = buildArrayValue({ models, model, propertyName, value })
      }

      if (prop.type === 'object' && !prop.inlined && prop.ref && !value.id) {
        value = buildResourceStub({ models, model, propertyName, resource: value })
      }

      validateResourceProperty({ models, model, propertyName, value })
      resource[propertyName] = value
      return api
    }
  }

  function toJSON () {
    validateResource({ models, model, resource })
    const copy = clone(resource)
    delete copy[SIG]
    return copy
  }
}

function buildId ({ model, resource }) {
  if (!resource[SIG]) {
    throw new Error(`expected resource with type "${resource[TYPE]}" to have a signature`)
  }

  const { link, permalink } = utils.getLinks({ object: resource })
  let id = `${model.id}_${permalink}`
  if (model.subClassOf === FORM || model.id === VERIFICATION || model.id === MY_PRODUCT) {
    return `${id}_${link || permalink}`
  }

  return id
}

/**
 * severely simplified display name builder
 * @return {String}
 */
function buildDisplayName ({ model, resource }) {
  const { properties } = model
  const displayNameProps = Object.keys(properties).filter(p => {
    if (typeof resource[p] === 'undefined') return

    const prop = properties[p]
    if (prop.displayName) {
      return prop.type !== 'object' && prop.type !== 'array'
    }
  })

  return displayNameProps
    .map(p => resource[p])
    .join(' ')
}

function buildArrayValue (opts) {
  const { models, model, value, propertyName } = opts
  const prop = model.properties[propertyName]
  const ref = getRef(prop)
  if (!ref) return value

  return value.map(resource => buildResourceStub({ models, model, propertyName, resource }))
}

function buildResourceStub (opts) {
  const { models, resource } = opts
  validateResource({ models, resource })
  return {
    id: buildId({
      model: models[resource[TYPE]],
      resource
    }),
    title: buildDisplayName(opts)
  }
}

function getRef (prop) {
  return prop.ref || prop.items.ref
}
