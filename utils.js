const pick = require('object.pick')
const validateResource = require('@tradle/validate-resource')
const { pickVirtual, omitVirtual, setVirtual } = validateResource.utils
const { utils, constants } = require('@tradle/engine')
const {
  TYPE,
  TYPES,
  SIG,
  SEQ,
  PERMALINK,
  PREVLINK,
  PREV_TO_SENDER,
  PREV_TO_RECIPIENT,
} = constants

const FORM = 'tradle.Form'
const VERIFICATION = 'tradle.Verification'
const MY_PRODUCT = 'tradle.MyProduct'
const ENUM = 'tradle.Enum'

const PROTOCOL_PROPERTIES = [
  TYPE,
  SIG,
  SEQ,
  PERMALINK,
  PREVLINK,
  // misnamed property
  (PREV_TO_SENDER || PREV_TO_RECIPIENT)
]

exports.id = buildId
exports.title = buildDisplayName
exports.fake = require('./fake')
exports.buildResourceStub = buildResourceStub
exports.stub = buildResourceStub
exports.array = buildArrayValue
exports.linkProperties = getLinkProperties
exports.pickVirtual = pickVirtual
exports.omitVirtual = omitVirtual
exports.setVirtual = setVirtual

function buildId ({ model, resource }) {
  if (!resource[SIG]) {
    throw new Error(`expected resource with type "${resource[TYPE]}" to have a signature`)
  }

  const { link, permalink } = utils.getLinks({
    object: omitVirtual(resource)
  })

  let id = `${model.id}_${permalink}`
  if (model.subClassOf === FORM || model.id === VERIFICATION || model.id === MY_PRODUCT) {
    return `${id}_${link || permalink}`
  }

  return id
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


function buildDisplayName ({ resource, model, models }) {
  if (resource.title)
    return resource.title

  if (!model) model = models[resource[TYPE]]

  const properties = model.properties
  const displayName = []
  for (let p in properties) {
    if (p.charAt(0) === '_')
      continue
    if (!resource[p])
      continue
    if (!properties[p].displayName) {
      if (!displayName  &&  model.subClassOf === 'tradle.Enum')
        return resource[p]
      continue
    }
    let dn = getStringValueForProperty({ resource, propertyName: p, models })
    if (dn)
      displayName.push(dn)
  }
  if (displayName.length)
    return displayName.join(' ')

  const vCols = model.viewCols
  if (!vCols)
    return

  const excludeProps = ['from', 'to']
  for (let i = 0; i < vCols.length  &&  !displayName.length; i++) {
    let p =  vCols[i]
    if (properties[p].type === 'array')
      continue
    if (!resource[p]  ||  excludeProps.includes(p))
      continue
    let dn = getStringValueForProperty({ resource, propertyName: p, models })
    if (dn)
      return dn
  }
}

function getStringValueForProperty ({ resource, propertyName, models }) {
  const meta = models[resource[TYPE]].properties[propertyName]
  if (meta.type === 'date')
    return String(getDateValue(resource[propertyName]))
  if (meta.type !== 'object')
    return String(resource[propertyName])
  if (resource[propertyName].title)
    return resource[propertyName].title

  const { ref } = meta
  if (ref) {
    const val = resource[propertyName]
    if (ref == 'tradle.Money')  {
      let c = typeof val.currency  === 'string' ? val.currency : val.currency.symbol
      return (c || '') + val.value
    }

    return buildDisplayName({
      resource: val,
      models,
      model: models[ref]
    })
  }
  // else if (meta[propertyName].displayAs) {
  //   var dn = this.templateIt(meta[propertyName], resource);
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
  const { models, resource, validate=true } = opts
  const model = models[resource[TYPE]]
  if (validate && model.subClassOf !== ENUM)
    validateResource({ models, resource })

  const stub = {
    id: buildId({ model, resource })
  }

  const title = buildDisplayName({ models, resource })
  if (title) {
    stub.title = title
  }

  return stub
}

function getRef (prop) {
  return prop.ref || prop.items.ref
}
