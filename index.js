const clone = require('clone')
const { utils, constants } = require('@tradle/engine')
const validateModels = require('@tradle/validate').models
const validateModel = validateModels.model
const validateResource = require('@tradle/validate-resource')
const validateResourceProperty = validateResource.property
const {
  TYPE,
  PERMALINK,
  LINK,
  SIG
} = constants

const FORM = 'tradle.Form'
const VERIFICATION = 'tradle.Verification'
const MY_PRODUCT = 'tradle.MyProduct'

module.exports = function builder ({ models, model }) {
  validateModel(model)

  const resource = {
    [SIG]: 'sigplaceholder',
    [TYPE]: model.id
  }

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
      if (prop.type === 'array' && !prop.inlined) {
        value = buildArrayValue({ models, model, propertyName, value })
      }

      if (prop.type === 'object' && !prop.inlined && prop.ref && !val.id) {
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
  if (!resource[SIG]) throw new Error('expected signed object')

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
    if (resource[p] == null) return

    const prop = properties[p]
    if (prop.displayName) {
      return prop.type !== 'object' && prop.type !== 'array'
    }
  })

  return displayNameProps
    .map(p => resource[p])
    .join(' ')
}

// function getDisplayName ({ models, model, resource }) {
//   const meta = model.properties
//   if (!meta) {
//     if (resource.title) {
//       return resource.title
//     }

//     if (resource.id) {
//       return ''
//     }

//     meta = models[resource[TYPE]].properties
//   }

//   let m = resource[TYPE] ? this.getModel(resource[TYPE]) : null
//   var displayName = '';
//   for (var p in meta) {
//     if (p.charAt(0) === '_')
//       continue
//     if (!meta[p].displayName) {
//       if (!displayName  &&  m  &&  resource[p]  &&  m.value.subClassOf === 'tradle.Enum')
//         return resource[p];
//       continue
//     }
//     let dn = this.getStringValueForProperty(resource, p, meta)
//     if (dn)
//       displayName += displayName.length ? ' ' + dn : dn;
//   }
//   if (!displayName.length  &&  m) {
//     let vCols = m.value.viewCols
//     if (!vCols)
//       return displayName
//     let excludeProps = []
//     if (this.isMessage(m))
//       excludeProps = ['from', 'to']
//     for (let i=0; i<vCols.length  &&  !displayName.length; i++) {
//       if (!resource[vCols[i]]  ||  excludeProps.indexOf[vCols[i]])
//         continue
//       displayName = this.getStringValueForProperty(resource, vCols[i], m.value.properties)
//     }
//   }
//   return displayName;
// }

function buildArrayValue (opts) {
  const { models, model, value, propertyName } = opts
  const prop = model.properties[propertyName]
  const ref = getRef(prop)
  if (!ref) return value

  return value.map(resource => buildResourceStub({ models, model, propertyName, resource }))
}

function buildResourceStub (opts) {
  const { models, model, resource, propertyName } = opts
  const prop = model.properties[propertyName]
  return {
    id: buildId({ model: models[resource[TYPE]], resource }),
    title: buildDisplayName(opts)
  }
}

function assert (statement, err) {
  if (!statement) throw new Error(err || 'assertion failed')
}

function getRef (prop) {
  return prop.ref || prop.items.ref
}
