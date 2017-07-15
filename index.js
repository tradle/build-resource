const clone = require('clone')
const pick = require('object.pick')
const { utils, constants } = require('@tradle/engine')
const validateModels = require('@tradle/validate-model')
const validateModel = validateModels.model
const validateResource = require('@tradle/validate-resource')
const validateResourceProperty = validateResource.property
const {
  TYPE,
  SIG,
  SEQ,
  PERMALINK,
  PREVLINK,
  PREV_TO_SENDER,
  PREV_TO_RECIPIENT,
} = constants

const PROTOCOL_PROPERTIES = [
  TYPE,
  SIG,
  SEQ,
  PERMALINK,
  PREVLINK,
  // misnamed property
  (PREV_TO_SENDER || PREV_TO_RECIPIENT)
]

const FORM = 'tradle.Form'
const VERIFICATION = 'tradle.Verification'
const MY_PRODUCT = 'tradle.MyProduct'
const ENUM = 'tradle.Enum'

exports = module.exports = builder
exports.id = buildId
exports.title = buildDisplayName
exports.fake = require('./fake')
exports.buildResourceStub = buildResourceStub
exports.stub = buildResourceStub
exports.linkProperties = getLinkProperties
exports.link = getLink
exports.links = getLinks

function builder ({ models, model, resource }) {
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

  const { link, permalink } = getLinks({ model, resource })
  let id = `${model.id}_${permalink}`
  if (model.subClassOf === FORM || model.id === VERIFICATION || model.id === MY_PRODUCT) {
    return `${id}_${link || permalink}`
  }

  return id
}

function getLink ({ model, resource }) {
  return utils.hexLink(getLinkProperties({ model, resource }))
}

function getLinks ({ model, resource }) {
  const link = getLink({ model, resource })
  const permalink = resource[PERMALINK] || link
  const links = {
    link,
    permalink
  }

  if (resource[PREVLINK]) {
    links.prevlink = resource[PREVLINK]
  }

  return links
}

function getLinkProperties ({ model, resource }) {
  const props = Object.keys(model.properties)
    .filter(propertyName => {
      const prop = model.properties[propertyName]
      return !prop.virtual
    })

  return pick(resource, props.concat(PROTOCOL_PROPERTIES))
}

/**
 * severely simplified display name builder
 * @return {String}
 */
// function buildDisplayName ({ model, resource }) {
//   const { properties } = model
//   const displayNameProps = Object.keys(properties).filter(p => {
//     if (typeof resource[p] === 'undefined') return

//     const prop = properties[p]
//     if (prop.displayName) {
//       if (prop.object)
//         return getDisplayName({resource, model})
//       return prop.type !== 'object' && prop.type !== 'array'
//     }
//   })

//   return displayNameProps
//     .map(p => resource[p])
//     .join(' ')
// }


function buildDisplayName({resource, models}) {
  if (resource.title)
    return resource.title

  let model = models[resource[TYPE]]
  const properties = model.properties
  let displayName = []
  for (var p in properties) {
    if (p.charAt(0) === '_')
      continue
    if (!resource[p])
      continue
    if (!properties[p].displayName) {
      if (!displayName  &&  model.subClassOf === 'tradle.Enum')
        return resource[p];
      continue
    }
    let dn = getStringValueForProperty(resource, p, models)
    if (dn)
      displayName.push(dn)
  }
  if (displayName.length)
    return displayName.join(' ')

  let vCols = model.viewCols
  if (!vCols)
    return
  let excludeProps = ['from', 'to']
  for (let i=0; i<vCols.length  &&  !displayName.length; i++) {
    let p =  vCols[i]
    if (properties[p].type === 'array')
      continue
    if (!resource[p]  ||  excludeProps.indexOf[p])
      continue
    let dn = getStringValueForProperty(resource, p, models)
    if (dn)
      return dn
  }
}
function getStringValueForProperty(resource, p, models) {
  let meta = models[resource[TYPE]].properties[p]
  if (meta.type === 'date')
    return getDateValue(resource[p])
  if (meta.type !== 'object')
    return resource[p];
  if (resource[p].title)
    return resource[p].title;
  if (meta.ref) {
    if (meta[p].ref == 'tradle.Money')  {
      let c = typeof resource[p].currency  === 'string' ? resource[p].currency : resource[p].currency.symbol
      return (c || '') + resource[p].value
    }
    else
      return getDisplayName({resource: resource[p], model: models[meta[p].ref]})
  }
  // else if (meta[p].displayAs) {
  //   var dn = this.templateIt(meta[p], resource);
  //   if (dn)
  //     return dn
  // }
}
function getDateValue(value) {
  return value
  // let valueMoment = moment.utc(value)
  // let format = 'MMMM Do, YYYY'
  // return valueMoment && valueMoment.format(format)
}

// function normalizeCurrencySymbol(symbol) {
//   // TODO: remove this after fixing encoding bug
//   if (!symbol  ||  typeof symbol === 'string')
//     return symbol
//   else
//     return symbol.symbol
// }

function buildArrayValue (opts) {
  const { models, model, value, propertyName } = opts
  const prop = model.properties[propertyName]
  const ref = getRef(prop)
  if (!ref) return value

  return value.map(resource => buildResourceStub({ models, model, propertyName, resource }))
}

function buildResourceStub (opts) {
  const { models, resource } = opts
  if (models[resource[TYPE]].subClassOf !== ENUM)
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
