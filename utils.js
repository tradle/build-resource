const pick = require('object.pick')
const clone = require('clone')
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

exports.id = buildId
exports.title = buildDisplayName
exports.buildResourceStub = buildResourceStub
exports.stub = buildResourceStub
exports.array = buildArrayValue
exports.pickVirtual = pickVirtual
exports.omitVirtual = omitVirtual
exports.setVirtual = setVirtual
exports.link = getLink
exports.permalink = getPermalink
exports.links = getLinks
exports.calcLink = calcLink
exports.calcPermalink = calcPermalink
exports.calcLinks = calcLinks
exports.enumValue = normalizeEnumValue
exports.version = createNewVersion
exports.fake = require('./fake')

function getVirtual (object, propertyName) {
  if (object._virtual && object._virtual.includes(propertyName)) {
    return object[propertyName]
  }
}

function calcLink (object) {
  return utils.hexLink(object)
}

function calcPermalink (object) {
  return object => object[PERMALINK] || calcLink(object)
}

function getLink (object) {
  return getVirtual(object, '_link') || calcLink(object)
}

function getPermalink (object) {
  return object[PERMALINK] ||
    getVirtual(object, '_link') ||
    getLink(object)
}

function getLinks (object) {
  const link = getLink(object)
  const links = {
    link,
    permalink: object[PERMALINK] || link
  }

  if (object[PREVLINK]) {
    links.prevlink = object[PREVLINK]
  }

  return links
}

function calcLinks (object) {
  return utils.getLinks({
    object: omitVirtual(object)
  })
}

function buildId ({ model, resource, type, link, permalink }) {
  if (resource  &&  !(link && permalink)) {
    if (!resource[SIG]) {
      throw new Error(`expected resource with type "${resource[TYPE]}" to have a signature`)
    }

    const links = calcLinks(resource)
    link = links.link
    permalink = links.permalink
  }

  if (!(link && permalink)) {
    throw new Error('expected "link" and "permalink"')
  }

  return `${type || model.id}_${permalink}_${link}`
}

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

function normalizeEnumValue ({ model, value }) {
  const id = typeof value === 'string' ? value : value.id
  const plainId = id.startsWith(model.id + '_') ? id.slice(model.id.length + 1) : id
  const match = model.enum.find(eVal => eVal.id === plainId)

  if (!match) {
    throw new Error(`enum value with id ${plainId} not found in model ${model.id}`)
  }

  const formattedId = `${model.id}_${match.id}`
  const norm = { id: formattedId, title: match.title }
  return norm
}

function createNewVersion (resource) {
  const { link, permalink } = getLinks(resource)
  resource = clone(resource)
  delete resource[SIG]
  resource[PREVLINK] = link
  resource[PERMALINK] = permalink
  return omitVirtual(resource, ['_link'])
}
