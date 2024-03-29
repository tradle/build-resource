const cloneDeep = require('lodash/cloneDeep')
const isEqual = require('lodash/isEqual')
const pick = require('lodash/pick')
const omit = require('lodash/omit')
const size = require('lodash/size')
const extend = require('lodash/extend')
const protocol = require('@tradle/protocol')
const validateResource = require('@tradle/validate-resource')
const validateModel = require('@tradle/validate-model')
const { parseId, pickVirtual, omitVirtual, setVirtual, omitBacklinks } = validateResource.utils
const {
  TYPE,
  SIG,
  PERMALINK,
  PREVLINK,
} = require('@tradle/constants')

const ENUM = 'tradle.Enum'
const { StubModel } = validateModel.utils
const { stubProps, isVirtualPropertyName, sanitize } = validateResource.utils
const requiredStubProps = stubProps.filter(prop => StubModel.required.includes(prop))

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
exports.headerHash = protocol.headerHash
exports.enumValue = normalizeEnumValue
exports.version = createNewVersion
exports.scaffoldNextVersion = scaffoldNextVersion
exports.isProbablyResourceStub = isProbablyResourceStub
exports.sanitize = sanitize
exports.fake = require('./fake')

function getVirtual (object, propertyName) {
  if (isVirtualPropertyName(propertyName)) {
    return object[propertyName]
  }
}

function calcLink (object) {
  return protocol.linkString(object)
}

function calcPermalink () {
  return object => object[PERMALINK] || calcLink(object)
}

function getLink (object) {
  return getVirtual(object, '_link') || calcLink(object)
}

function getPermalink (object) {
  return object[PERMALINK] ||
    getVirtual(object, '_permalink') ||
    getVirtual(object, '_link') ||
    getLink(object)
}

function getLinks (object) {
  const link = getLink(object)
  const links = {
    link,
    permalink: getPermalink(object)
  }

  if (object[PREVLINK]) {
    links.prevlink = object[PREVLINK]
  }

  return links
}

function calcLinks (object) {
  return protocol.links({
    object: omitVirtual(object)
  })
}

function buildId ({ model, resource, type, link, permalink }) {
  console.warn('DEPRECATED: buildResource.id(...)')
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

  if (!type) {
    if (resource) type = resource[TYPE]
    else if (model) type = model.id
  }
  return `${type}_${permalink}_${link}`
}

function buildDisplayName ({ resource, model, models }) {
  if (resource._displayName)
    return resource._displayName

  if (!model) model = models && models[resource[TYPE]]

  if (!model) return

  const properties = model.properties
  const displayName = getPropertyDisplayName(resource, model, models)
  if (displayName !== null) {
    return displayName
  }

  const vCols = model.viewCols
  if (!vCols)
    return

  const excludeProps = ['from', 'to']
  for (let i = 0; i < vCols.length; i += 1) {
    let p =  vCols[i]
    let prop = properties[p]
    if (prop.type === 'array' || prop.signature)
      continue
    if (!resource[p]  ||  excludeProps.includes(p))
      continue
    let dn = getStringValueForProperty({ resource, propertyName: p, models })
    if (dn)
      return dn
  }
}

function getPropertyDisplayName (resource, model, models) {
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
  return displayName.length > 0 ? displayName.join(' ') : null
}

function getStringValueForProperty ({ resource, propertyName, models }) {
  const meta = models[resource[TYPE]].properties[propertyName]
  if (meta.type === 'date')
    return String(getDateValue(resource[propertyName]))
  if (meta.range === 'model')
    return models[resource[propertyName]].title
  if (meta.type === 'array')
    return getStringValueForArrayProperty({ resource, propertyName, models })
  if (meta.type !== 'object')
    return String(resource[propertyName])
  if (resource[propertyName].title)
    return resource[propertyName].title

  const { ref } = meta
  if (ref) {
    const val = resource[propertyName]
    if (ref === 'tradle.Money')  {
      let c = typeof val.currency  === 'string' ? val.currency : val.currency.symbol
      return (c || '') + val.value
    }
    let v
    if (val[TYPE])
      v = val
    else
      v = Object.assign(cloneDeep(val), { [TYPE]: ref })
    return buildDisplayName({
      resource: v,
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
function getStringValueForArrayProperty({ resource, propertyName, models }) {
  const meta = models[resource[TYPE]].properties[propertyName]
  let { items } = meta
  if (items.ref  &&  models[items.ref].subClassOf === ENUM)
    return resource[propertyName].map(v => v.title).join(', ')

  if (!meta.inlined)
    return items.ref ? models[items.ref].title || '' : ''

  let mProps = items.properties
  if (size(mProps) === 1)
    return resource[propertyName][Object.keys(mProps)][0]

  let dnProps = []
  for (let ip in mProps) {
    if (mProps[ip].displayName)
      dnProps.push(ip)
  }
  if (!dnProps.length)
    return ''
  let dn = ''
  let val = resource[propertyName]
  val.forEach((v, i) => {
    if (i)
      dn += ', '
    dnProps.forEach(pr => dn += `${v[pr]}`)
  })
  return dn
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

  return value.map(resource => {
    if (isProbablyResourceStub(resource)) {
      return resource
    }

    return buildResourceStub({ models, model, propertyName, resource })
  })
}

function isProbablyResourceStub (value) {
  const keys = Object.keys(value).sort()
  if (isEqual(keys, stubProps) || isEqual(keys, requiredStubProps)) return true
  if (!value.id) return false

  try {
    const { type, permalink, link } = parseId(value.id)
    if (!(type && permalink && link)) return false
  } catch (err) {
    return false
  }

  return keys.length <= stubProps.length && keys.every(prop => {
    return stubProps.includes(prop) && typeof value[prop] === 'string'
  })
}

function buildResourceStub (opts) {
  let { models, model, resource, validate } = opts

  if (!model && models) {
    model = models[resource[TYPE]]
  }

  if (stubProps.every(prop => prop in resource)) {
    return pick(resource, stubProps)
  }

  if (model) {
    resource = omitBacklinks({ model, resource })
  }

  if (validate && model.subClassOf !== ENUM)
    validateResource({ models, resource })

  const { link, permalink } = getLinks(resource)
  const stub = {
    [TYPE]: resource[TYPE],
    _link: link,
    _permalink: permalink
  }

  const title = buildDisplayName({ models, resource })
  if (title) {
    stub._displayName = title
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

function scaffoldNextVersion (resource) {
  const links = getLinks(resource)
  return protocol.scaffoldNextVersion(resource, links)
}

function createNewVersion (resource) {
  const scaffold = scaffoldNextVersion(resource, getLinks(resource))
  resource = extend(cloneDeep(omit(resource, SIG)), scaffold)
  return omitVirtual(resource, ['_link'])
}
