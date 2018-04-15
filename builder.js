const extend = require('lodash/extend')
const cloneDeep = require('lodash/cloneDeep')
const isEqual = require('lodash/isEqual')
const { TYPE, SIG, PREVLINK, PERMALINK } = require('@tradle/constants')
const validateModels = require('@tradle/validate-model')
const validateModel = validateModels.model
const validateResource = require('@tradle/validate-resource')
const { getRef, isInlinedProperty, omitVirtual } = validateResource.utils
const validateResourceProperty = validateResource.property
const ObjectModel = require('@tradle/models').models['tradle.Object']
const utils = require('./utils')

module.exports = builder

function builder ({ models, model, resource, mutate }) {
  if (typeof model === 'string') {
    if (!models[model]) {
      throw new Error(`model ${model} not found`)
    }

    model = models[model]
  }

  validateModel(model)
  const { properties } = model

  resource = extend({
    // [SIG]: '__sigplaceholder__',
    [TYPE]: model.id
  }, cloneDeep(resource))

  const api = {
    set,
    setVirtual,
    get,
    add,
    remove,
    filterOut,
    previous,
    original,
    toJSON,
    writeTo
  }

  return api

  function get (propertyName) {
    return propertyName ? cloneDeep(resource[propertyName]) : toJSON()
  }

  function getProperty (propertyName) {
    const prop = properties[propertyName] || ObjectModel.properties[propertyName]
    if (!prop) {
      throw new Error(`model ${model.id} has no property ${propertyName}`)
    }

    return prop
  }

  function checkValue (propertyName, value) {
    if (typeof value === 'undefined' || value == null) {
      throw new Error(`invalid value ${value} for property ${propertyName}`)
    }
  }

  function add (propertyName, value) {
    const current = resource[propertyName] || []
    set(propertyName, current.concat(value))
    return api
  }

  function filterOut (propertyName, test) {
    const current = resource[propertyName] || []
    resource[propertyName] = current.filter(val => !test(val))
    return api
  }

  function remove (propertyName, value) {
    const current = resource[propertyName] || []
    const idx = resource[propertyName].findIndex(function (item) {
      return isEqual(item, value)
    })

    if (idx === -1) {
      throw new Error('value not found')
    }

    resource[propertyName] = current.filter((val, i) => i !== idx)
    return api
  }

  function set (propertyName, value) {
    if (typeof propertyName === 'object') {
      for (let key in propertyName) {
        set(key, propertyName[key])
      }

      return api
    }

    const property = getProperty(propertyName)
    checkValue(propertyName, value)

    // console.log(propertyName, prop, prop.ref && models[prop.ref].subClassOf)
    const ref = getRef(property)
    const range = ref && models[ref]
    const inlined = isInlinedProperty({ models, property })
    if (range && range.subClassOf === 'tradle.Enum') {
      value = property.type === 'array'
        ? value.map(one => utils.enumValue({ model: range, value: one }))
        : utils.enumValue({ model: range, value })
    } else if (property.type === 'array' && !inlined) {
      value = utils.array({ models, model, propertyName, value })
    } else if (property.type === 'object' && !inlined && ref && value[TYPE]) {
      value = utils.stub({ models, model, propertyName, resource: value })
    }

    if (inlined) {
      value = Array.isArray(value)
        ? value.map(value => omitVirtual(value))
        : omitVirtual(value)
    }

    validateResourceProperty({ models, model, propertyName, value })
    resource[propertyName] = value
    return api
  }

  function setVirtual (props) {
    if (typeof props === 'string') {
      return setVirtual({ [props]: arguments[1] })
    }

    validateResource.utils.setVirtual(resource, props)
    return api
  }

  function previous (link) {
    if (typeof link === 'object') {
      set(PREVLINK, link._link)
      if (link._permalink) {
        // set original too
        original(link._permalink)
      }
    }

    return set(PREVLINK, link)
  }

  function original (link) {
    if (typeof link === 'object') {
      return set(PERMALINK, link._permalink || link._link)
    }

    return set(PERMALINK, link)
  }

  function toJSON (opts={}) {
    if (opts.validate !== false) {
      validateResource({ models, model, resource })
    }

    const copy = cloneDeep(resource)
    if (opts.stripSig !== false) {
      delete copy[SIG]
    }

    return copy
  }

  function writeTo (obj) {
    return extend(obj, toJSON())
  }
}

builder.set = function ({ models, model, resource, properties }) {
  if (!model) model = models[resource[TYPE]]

  return builder({ models, model, resource })
    .set(properties)
    .writeTo(resource)
}
